package repo

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

// TestDebounceMaxDuration verifies that rapid file writes do not starve delivery.
// A continuous stream of writes must still flush within maxDebounceDuration,
// regardless of the rolling debounce window.
func TestDebounceMaxDuration(t *testing.T) {
	root := t.TempDir()

	cfg := ScanConfig{MinLOC: 0}
	w, err := NewWatcher(root, cfg)
	if err != nil {
		t.Fatalf("NewWatcher: %v", err)
	}
	if err := w.Start(); err != nil {
		t.Fatalf("Start: %v", err)
	}
	defer w.Stop()

	// Write a file repeatedly at an interval shorter than debounceDuration,
	// but longer than 1ms so fsnotify actually sees the events.
	// This simulates a formatter rewriting a file continuously.
	target := filepath.Join(root, "busy.go")
	content := []byte("package main\nfunc main(){}\n")

	stop := make(chan struct{})
	go func() {
		for i := 0; i < 40; i++ {
			select {
			case <-stop:
				return
			default:
			}
			_ = os.WriteFile(target, content, 0o644)
			time.Sleep(debounceDuration / 4) // 125ms — much faster than 500ms debounce
		}
	}()

	// We expect an Update to arrive within maxDebounceDuration + a small buffer,
	// even though events keep resetting the 500ms rolling timer.
	deadline := time.After(maxDebounceDuration + 500*time.Millisecond)
	select {
	case u, ok := <-w.Updates:
		close(stop) // stop writer
		if !ok {
			t.Fatal("Updates channel closed unexpectedly")
		}
		if len(u.Buildings) == 0 && !u.HasStructural {
			t.Fatal("received empty Update")
		}
	case <-deadline:
		close(stop)
		t.Fatalf("no Update received within %v; debounce starved delivery", maxDebounceDuration+500*time.Millisecond)
	}
}
