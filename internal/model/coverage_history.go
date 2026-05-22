package model

import "sync"

// HistoryCap is the default maximum number of CoverageSnapshot entries kept
// in a CoverageHistory ring buffer.
const HistoryCap = 100

// CoverageSnapshot captures the coverage state of the repository at a single
// point in time. Aggregate is the mean coverage across all files with known
// coverage. Files maps each file path to its individual coverage ratio.
// Files with unknown coverage (value -1) are omitted.
type CoverageSnapshot struct {
	Timestamp int64              `json:"ts"`
	Aggregate float64            `json:"aggregate"` // -1 if no files have known coverage
	Files     map[string]float64 `json:"files"`
}

// CoverageHistory is a thread-safe, capped ring buffer of CoverageSnapshots.
// Once the cap is reached, the oldest snapshot is evicted on each new Record.
type CoverageHistory struct {
	mu  sync.RWMutex
	buf []CoverageSnapshot
	cap int
}

// NewCoverageHistory returns a CoverageHistory that retains at most cap snapshots.
func NewCoverageHistory(cap int) *CoverageHistory {
	return &CoverageHistory{cap: cap, buf: make([]CoverageSnapshot, 0, cap)}
}

// Record appends snap to the history, evicting the oldest entry when the
// buffer is at capacity.
func (h *CoverageHistory) Record(snap CoverageSnapshot) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.buf = append(h.buf, snap)
	if len(h.buf) > h.cap {
		h.buf = h.buf[1:]
	}
}

// Snapshots returns an independent copy of all stored snapshots in
// chronological order (oldest first).
func (h *CoverageHistory) Snapshots() []CoverageSnapshot {
	h.mu.RLock()
	defer h.mu.RUnlock()
	result := make([]CoverageSnapshot, len(h.buf))
	copy(result, h.buf)
	return result
}

// SnapshotFromState builds a CoverageSnapshot from a CityState.
// Only buildings with Coverage >= 0 are included in Files.
func SnapshotFromState(state CityState) CoverageSnapshot {
	files := make(map[string]float64, len(state.Buildings))
	for _, b := range state.Buildings {
		if b.Coverage >= 0 {
			files[b.ID] = b.Coverage
		}
	}
	return CoverageSnapshot{
		Timestamp: state.Timestamp,
		Aggregate: state.Stats.Coverage,
		Files:     files,
	}
}
