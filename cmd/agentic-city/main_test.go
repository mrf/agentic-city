package main

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/mferree/agent-city/internal/city"
	"github.com/mferree/agent-city/internal/hub"
	"github.com/mferree/agent-city/internal/model"
	"github.com/mferree/agent-city/internal/repo"
)

// ── autoDetectMetricsFiles ────────────────────────────────────────────────────

func TestAutoDetectMetricsFiles_NoFiles(t *testing.T) {
	dir := t.TempDir()
	cov, tests := autoDetectMetricsFiles(dir)
	if len(cov) != 0 || len(tests) != 0 {
		t.Fatalf("expected empty slices, got cov=%v tests=%v", cov, tests)
	}
}

func TestAutoDetectMetricsFiles_SingleFile(t *testing.T) {
	cases := []struct {
		name     string
		filename string
		content  string
		wantCov  int
		wantTest int
	}{
		{"coverage.out", "coverage.out", "mode: set\n", 1, 0},
		{"lcov.info", "lcov.info", "TN:\nSF:foo.go\nend_of_record\n", 1, 0},
		{"test-results.xml", "test-results.xml", `<testsuite name="pkg" failures="0"></testsuite>`, 0, 1},
		{"test-results.json", "test-results.json", `{"Action":"pass","Package":"github.com/example/foo"}` + "\n", 0, 1},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			dir := t.TempDir()
			p := filepath.Join(dir, tc.filename)
			mustWriteFile(t, p, tc.content)

			cov, tests := autoDetectMetricsFiles(dir)
			if len(cov) != tc.wantCov {
				t.Errorf("coverage files: want %d, got %v", tc.wantCov, cov)
			}
			if len(tests) != tc.wantTest {
				t.Errorf("test result files: want %d, got %v", tc.wantTest, tests)
			}
			// Verify the returned path matches what we wrote.
			if tc.wantCov == 1 && (len(cov) == 0 || cov[0] != p) {
				t.Errorf("expected cov[0]=%s, got %v", p, cov)
			}
			if tc.wantTest == 1 && (len(tests) == 0 || tests[0] != p) {
				t.Errorf("expected tests[0]=%s, got %v", p, tests)
			}
		})
	}
}

func TestAutoDetectMetricsFiles_MultipleCoverageFiles(t *testing.T) {
	dir := t.TempDir()
	mustWriteFile(t, filepath.Join(dir, "coverage.out"), "mode: set\n")
	mustWriteFile(t, filepath.Join(dir, "lcov.info"), "TN:\nend_of_record\n")
	cov, _ := autoDetectMetricsFiles(dir)
	if len(cov) != 2 {
		t.Fatalf("expected 2 coverage files, got %v", cov)
	}
}

// ── buildMetricsWatcher ───────────────────────────────────────────────────────

func TestBuildMetricsWatcher_NilWhenNoFiles(t *testing.T) {
	dir := t.TempDir()
	mw := buildMetricsWatcher(dir, "", "", "")
	if mw != nil {
		mw.Stop()
		t.Fatal("expected nil when no metrics files present")
	}
}

func TestBuildMetricsWatcher_ExplicitCoveragePath(t *testing.T) {
	dir := t.TempDir()
	p := filepath.Join(dir, "cov.out")
	mustWriteFile(t, p, "mode: set\n")
	mw := buildMetricsWatcher(dir, p, "", "")
	if mw == nil {
		t.Fatal("expected non-nil watcher for explicit coverage path")
	}
	mw.Stop()
}

func TestBuildMetricsWatcher_ExplicitTestResultsPath(t *testing.T) {
	dir := t.TempDir()
	p := filepath.Join(dir, "results.json")
	mustWriteFile(t, p, `{"Action":"pass","Package":"github.com/example/foo"}`+"\n")
	mw := buildMetricsWatcher(dir, "", p, "")
	if mw == nil {
		t.Fatal("expected non-nil watcher for explicit test results path")
	}
	mw.Stop()
}

func TestBuildMetricsWatcher_AutoDetectCoverageOut(t *testing.T) {
	dir := t.TempDir()
	mustWriteFile(t, filepath.Join(dir, "coverage.out"), "mode: set\n")
	mw := buildMetricsWatcher(dir, "", "", "")
	if mw == nil {
		t.Fatal("expected non-nil watcher for auto-detected coverage.out")
	}
	mw.Stop()
}

func TestBuildMetricsWatcher_ExplicitPathOverridesAutoDetect(t *testing.T) {
	dir := t.TempDir()
	mustWriteFile(t, filepath.Join(dir, "coverage.out"), "mode: set\n")
	explicit := filepath.Join(dir, "custom.out")
	mustWriteFile(t, explicit, "mode: set\n")

	mw := buildMetricsWatcher(dir, explicit, "", "")
	if mw == nil {
		t.Fatal("expected non-nil watcher")
	}
	mw.Stop()
}

// ── runMetricsWatcher ─────────────────────────────────────────────────────────

func TestRunMetricsWatcher_ShutdownOnContextCancel(t *testing.T) {
	mw := newMinimalMetricsWatcher(t)
	state := hub.NewState(model.CityState{})
	ctx, cancel := context.WithCancel(context.Background())

	done := make(chan struct{})
	go func() {
		defer close(done)
		runMetricsWatcher(ctx, mw, state, nil)
	}()

	cancel()
	waitForDone(t, done, "runMetricsWatcher did not stop after context cancel")
}

func TestRunMetricsWatcher_AppliesUpdatesToState(t *testing.T) {
	mw := newMinimalMetricsWatcher(t)

	initial := model.CityState{
		Buildings: []model.Building{
			{ID: "internal/foo/bar.go", Coverage: -1, Status: "unknown"},
		},
	}
	state := hub.NewState(initial)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	done := make(chan struct{})
	go func() {
		defer close(done)
		runMetricsWatcher(ctx, mw, state, nil)
	}()

	mw.Updates <- repo.MetricsSource{
		Coverage:   repo.CoverageMap{"internal/foo/bar.go": 0.85},
		FileStatus: map[string]string{"internal/foo/bar.go": "ok"},
		DirStatus:  map[string]string{},
	}

	// Poll until state reflects the update or we time out.
	deadline := time.Now().Add(2 * time.Second)
	var got model.CityState
	for time.Now().Before(deadline) {
		got = state.GetState()
		if len(got.Buildings) > 0 && got.Buildings[0].Coverage >= 0 {
			break
		}
		time.Sleep(10 * time.Millisecond)
	}

	cancel()
	<-done

	if len(got.Buildings) == 0 {
		t.Fatal("no buildings in state")
	}
	b := got.Buildings[0]
	if b.Coverage != 0.85 {
		t.Errorf("coverage: want 0.85, got %f", b.Coverage)
	}
	if b.Status != "ok" {
		t.Errorf("status: want ok, got %q", b.Status)
	}
}

func TestRunMetricsWatcher_NotifiesHub(t *testing.T) {
	mw := newMinimalMetricsWatcher(t)
	state := hub.NewState(model.CityState{})
	h := hub.New(state)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go h.Run(ctx)

	done := make(chan struct{})
	go func() {
		defer close(done)
		runMetricsWatcher(ctx, mw, state, h)
	}()

	mw.Updates <- repo.MetricsSource{
		Coverage:   repo.CoverageMap{},
		FileStatus: map[string]string{},
		DirStatus:  map[string]string{},
	}

	// Give runMetricsWatcher time to process the update, then cancel.
	time.Sleep(50 * time.Millisecond)
	cancel()
	<-done
}

func TestRunMetricsWatcher_StopsOnClosedChannel(t *testing.T) {
	mw := newMinimalMetricsWatcher(t)
	state := hub.NewState(model.CityState{})
	ctx := context.Background()

	done := make(chan struct{})
	go func() {
		defer close(done)
		runMetricsWatcher(ctx, mw, state, nil)
	}()

	close(mw.Updates)
	waitForDone(t, done, "runMetricsWatcher did not stop when Updates channel closed")
}

// ── runWatcher ────────────────────────────────────────────────────────────────

func TestRunWatcher_ShutdownOnContextCancel(t *testing.T) {
	dir := t.TempDir()
	mustWriteFile(t, filepath.Join(dir, "main.go"), "package main\n")

	state := hub.NewState(model.CityState{})
	ctx, cancel := context.WithCancel(context.Background())

	done := make(chan struct{})
	go func() {
		defer close(done)
		runWatcher(ctx, dir, city.BuildConfig{}, state, nil, nil)
	}()

	cancel()
	waitForDone(t, done, "runWatcher did not stop after context cancel")
}

// Verifies runWatcher exits cleanly when pointed at a non-existent path.
func TestRunWatcher_NonExistentRepoPathCancels(t *testing.T) {
	nonExistent := filepath.Join(t.TempDir(), "no-such-dir")
	state := hub.NewState(model.CityState{})
	ctx, cancel := context.WithCancel(context.Background())

	done := make(chan struct{})
	go func() {
		defer close(done)
		runWatcher(ctx, nonExistent, city.BuildConfig{}, state, nil, nil)
	}()

	cancel()
	waitForDone(t, done, "runWatcher did not stop after context cancel (non-existent repo path)")
}

func TestRunWatcher_PropagatesContentUpdate(t *testing.T) {
	dir := t.TempDir()
	goFile := filepath.Join(dir, "foo.go")
	mustWriteFile(t, goFile, "package main\n")

	state := hub.NewState(model.CityState{})
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go runWatcher(ctx, dir, city.BuildConfig{}, state, nil, nil)

	// Give the watcher time to start, then modify the file.
	time.Sleep(100 * time.Millisecond)
	mustWriteFile(t, goFile, "package main\n\nfunc Exported() {}\n")

	// Poll for state to be updated (content change triggers incremental merge).
	deadline := time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) {
		s := state.GetState()
		if len(s.Buildings) > 0 {
			return
		}
		time.Sleep(50 * time.Millisecond)
	}
	t.Error("state was not updated after file content change")
}

// ── readModuleName ────────────────────────────────────────────────────────────

func TestReadModuleName(t *testing.T) {
	cases := []struct {
		name     string
		gomod    *string // nil means no go.mod file written
		want     string
	}{
		{"valid go.mod", strPtr("module github.com/example/myapp\n\ngo 1.21\n"), "github.com/example/myapp"},
		{"missing go.mod", nil, ""},
		{"empty go.mod", strPtr(""), ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			dir := t.TempDir()
			if tc.gomod != nil {
				mustWriteFile(t, filepath.Join(dir, "go.mod"), *tc.gomod)
			}
			got := readModuleName(dir)
			if got != tc.want {
				t.Errorf("want %q, got %q", tc.want, got)
			}
		})
	}
}

// ── helpers ───────────────────────────────────────────────────────────────────

func mustWriteFile(t *testing.T, path, content string) {
	t.Helper()
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatalf("write %s: %v", path, err)
	}
}

// newMinimalMetricsWatcher returns a MetricsWatcher without calling Start(),
// so its Updates channel can be written to directly in tests without triggering
// fsnotify.
func newMinimalMetricsWatcher(t *testing.T) *repo.MetricsWatcher {
	t.Helper()
	dir := t.TempDir()
	p := filepath.Join(dir, "coverage.out")
	mustWriteFile(t, p, "mode: set\n")
	mw, err := repo.NewMetricsWatcher(repo.MetricsConfig{
		CoverageFiles: []string{p},
		RepoRoot:      dir,
	})
	if err != nil {
		t.Fatalf("NewMetricsWatcher: %v", err)
	}
	return mw
}

// waitForDone blocks until done is closed or times out with a fatal error.
func waitForDone(t *testing.T, done <-chan struct{}, msg string) {
	t.Helper()
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal(msg)
	}
}

func strPtr(s string) *string { return &s }
