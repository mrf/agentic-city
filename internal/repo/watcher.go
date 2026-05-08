package repo

import (
	"os"
	"path"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"
	"github.com/mferree/agent-city/internal/model"
)

const debounceDuration = 500 * time.Millisecond

// Update is delivered on Watcher.Updates when the debounce window closes.
type Update struct {
	// HasStructural is true when at least one create, delete, or rename was seen.
	// Consumers should recalculate layout when this is set.
	HasStructural bool

	// Buildings contains updated Building metadata for each changed file.
	// A Building with LOC == 0 signals deletion (consumers should remove it by ID).
	Buildings []model.Building
}

// Watcher watches a repo root directory with fsnotify, debounces events into
// 500 ms windows, and delivers incremental Updates to the Updates channel.
type Watcher struct {
	root    string
	cfg     ScanConfig
	fw      *fsnotify.Watcher
	Updates chan Update
	quit    chan struct{}
	once    sync.Once
}

// NewWatcher creates a Watcher for root. Call Start to begin watching.
func NewWatcher(root string, cfg ScanConfig) (*Watcher, error) {
	fw, err := fsnotify.NewWatcher()
	if err != nil {
		return nil, err
	}
	return &Watcher{
		root:    root,
		cfg:     cfg,
		fw:      fw,
		Updates: make(chan Update, 16),
		quit:    make(chan struct{}),
	}, nil
}

// Start adds the repo root (and all subdirectories) to the fsnotify watch list,
// then spawns the event loop. Updates arrive on w.Updates.
// Start returns immediately; call Stop to shut down.
func (w *Watcher) Start() error {
	if err := w.addDirsRecursively(w.root); err != nil {
		return err
	}
	go w.loop()
	return nil
}

// Stop shuts down the watcher and closes the Updates channel.
func (w *Watcher) Stop() {
	w.once.Do(func() {
		close(w.quit)
		w.fw.Close()
	})
}

// addDirsRecursively registers root and all non-skipped subdirectories with fsnotify.
func (w *Watcher) addDirsRecursively(root string) error {
	return filepath.WalkDir(root, func(p string, d os.DirEntry, err error) error {
		if err != nil {
			return nil // skip unreadable paths
		}
		if !d.IsDir() {
			return nil
		}
		name := d.Name()
		if knownSkipDirs[name] || strings.HasPrefix(name, ".") {
			return filepath.SkipDir
		}
		return w.fw.Add(p)
	})
}

// loop is the event loop: it reads raw fsnotify events and debounces them into
// Update batches using a channel-based 500 ms rolling window.
func (w *Watcher) loop() {
	defer close(w.Updates)

	pending := make(map[string]fsnotify.Op)
	var debounce <-chan time.Time

	for {
		select {
		case <-w.quit:
			return

		case event, ok := <-w.fw.Events:
			if !ok {
				return
			}
			pending[event.Name] |= event.Op
			// Rolling 500 ms window — each new event restarts the timer.
			debounce = time.After(debounceDuration)

		case <-debounce:
			batch := pending
			pending = make(map[string]fsnotify.Op)
			debounce = nil
			w.processBatch(batch)

		case _, ok := <-w.fw.Errors:
			if !ok {
				return
			}
			// Swallow watch errors; the city continues with stale data.
		}
	}
}

// processBatch converts a debounced path→op batch into an Update and sends it
// on w.Updates. It applies the same file-level filters as ScanRepo.
func (w *Watcher) processBatch(batch map[string]fsnotify.Op) {
	update := Update{}

	for absPath, op := range batch {
		rel, err := filepath.Rel(w.root, absPath)
		if err != nil {
			continue
		}
		rel = filepath.ToSlash(rel)

		// Classify the change before any filtering.
		isStructural := op&(fsnotify.Create|fsnotify.Remove|fsnotify.Rename) != 0
		if isStructural {
			update.HasStructural = true
		}

		// When a new directory is created, start watching it so future files
		// inside it are caught.
		if op&fsnotify.Create != 0 {
			if info, statErr := os.Stat(absPath); statErr == nil && info.IsDir() {
				_ = w.addDirsRecursively(absPath)
				continue
			}
		}

		// Skip events for directories themselves.
		if info, statErr := os.Stat(absPath); statErr == nil && info.IsDir() {
			continue
		}

		// Apply scanner filters.
		if inSkipDir(rel) {
			continue
		}
		if w.cfg.MaxDepth > 0 && dirDepth(rel) > w.cfg.MaxDepth {
			continue
		}
		ext := strings.ToLower(path.Ext(rel))
		if binaryExtensions[ext] {
			continue
		}
		if len(w.cfg.ExcludeGlobs) > 0 && matchesAnyGlob(rel, w.cfg.ExcludeGlobs) {
			continue
		}

		// File was deleted or renamed away — emit a tombstone Building so consumers
		// know to remove it.
		if op&(fsnotify.Remove|fsnotify.Rename) != 0 {
			if _, statErr := os.Stat(absPath); os.IsNotExist(statErr) {
				update.Buildings = append(update.Buildings, model.Building{ID: rel})
				continue
			}
		}

		// Re-scan this file from the filesystem for updated metadata.
		b, scanErr := scanFile(w.root, rel, w.cfg)
		if scanErr == nil {
			update.Buildings = append(update.Buildings, b)
		}
	}

	if len(update.Buildings) == 0 && !update.HasStructural {
		return
	}

	select {
	case w.Updates <- update:
	default:
		// Drop if consumer is not keeping up; watcher must not block the event loop.
	}
}

// scanFile scans a single file at relPath (relative to root) from the filesystem
// and returns its Building metadata, applying the same content filters as ScanRepo.
// Returns an error if the file should be skipped.
func scanFile(root, relPath string, cfg ScanConfig) (model.Building, error) {
	absPath := filepath.Join(root, relPath)
	f, err := os.Open(absPath)
	if err != nil {
		return model.Building{}, err
	}
	defer f.Close()

	loc, isBinary := countLinesAndSniff(f)
	if isBinary {
		return model.Building{}, errSkip
	}
	if loc < cfg.MinLOC {
		return model.Building{}, errSkip
	}

	ext := strings.ToLower(path.Ext(relPath))
	return newBuilding(relPath, ext, loc), nil
}

// errSkip is a sentinel returned by scanFile when the file should be excluded.
var errSkip = &skipError{}

type skipError struct{}

func (*skipError) Error() string { return "skip" }
