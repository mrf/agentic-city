package model

import (
	"testing"
)

func TestCoverageHistory_empty(t *testing.T) {
	h := NewCoverageHistory(10)
	snaps := h.Snapshots()
	if len(snaps) != 0 {
		t.Fatalf("expected 0 snapshots on empty history, got %d", len(snaps))
	}
}

func TestCoverageHistory_recordAndRetrieve(t *testing.T) {
	h := NewCoverageHistory(10)
	snap := CoverageSnapshot{
		Timestamp: 1000,
		Aggregate: 0.75,
		Files:     map[string]float64{"foo.go": 0.9, "bar.go": 0.6},
	}
	h.Record(snap)

	snaps := h.Snapshots()
	if len(snaps) != 1 {
		t.Fatalf("expected 1 snapshot, got %d", len(snaps))
	}
	if snaps[0].Aggregate != 0.75 {
		t.Errorf("expected Aggregate 0.75, got %f", snaps[0].Aggregate)
	}
	if snaps[0].Files["foo.go"] != 0.9 {
		t.Errorf("expected foo.go=0.9, got %f", snaps[0].Files["foo.go"])
	}
}

func TestCoverageHistory_cap(t *testing.T) {
	cap := 5
	h := NewCoverageHistory(cap)
	for i := range 10 {
		h.Record(CoverageSnapshot{Timestamp: int64(i), Aggregate: float64(i) * 0.1})
	}

	snaps := h.Snapshots()
	if len(snaps) != cap {
		t.Fatalf("expected %d snapshots (capped), got %d", cap, len(snaps))
	}
	// oldest kept should be index 5 (ts=5), newest should be ts=9
	if snaps[0].Timestamp != 5 {
		t.Errorf("expected oldest ts=5, got %d", snaps[0].Timestamp)
	}
	if snaps[cap-1].Timestamp != 9 {
		t.Errorf("expected newest ts=9, got %d", snaps[cap-1].Timestamp)
	}
}

func TestCoverageHistory_snapshotsReturnsIndependentCopy(t *testing.T) {
	h := NewCoverageHistory(10)
	h.Record(CoverageSnapshot{Timestamp: 1, Aggregate: 0.5, Files: map[string]float64{"f.go": 0.5}})

	snaps := h.Snapshots()
	// Mutate the returned slice — should not affect the history.
	snaps[0].Aggregate = 0.99

	snaps2 := h.Snapshots()
	if snaps2[0].Aggregate != 0.5 {
		t.Errorf("Snapshots must return a copy; history was mutated")
	}
}

func TestSnapshotFromState(t *testing.T) {
	state := CityState{
		Timestamp: 42000,
		Stats:     RepoStats{Coverage: 0.72},
		Buildings: []Building{
			{ID: "a.go", Coverage: 0.9},
			{ID: "b.go", Coverage: -1}, // unknown — should be excluded
			{ID: "c.go", Coverage: 0.4},
		},
	}

	snap := SnapshotFromState(state)

	if snap.Timestamp != 42000 {
		t.Errorf("expected Timestamp 42000, got %d", snap.Timestamp)
	}
	if snap.Aggregate != 0.72 {
		t.Errorf("expected Aggregate 0.72, got %f", snap.Aggregate)
	}
	if _, ok := snap.Files["b.go"]; ok {
		t.Error("b.go (coverage=-1) should not appear in snapshot files")
	}
	if snap.Files["a.go"] != 0.9 {
		t.Errorf("expected a.go=0.9, got %f", snap.Files["a.go"])
	}
	if snap.Files["c.go"] != 0.4 {
		t.Errorf("expected c.go=0.4, got %f", snap.Files["c.go"])
	}
}
