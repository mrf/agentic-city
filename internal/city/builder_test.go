package city

import (
	"path/filepath"
	"runtime"
	"sort"
	"testing"
	"time"

	"github.com/mferree/agent-city/internal/deps"
	"github.com/mferree/agent-city/internal/layout"
	"github.com/mferree/agent-city/internal/model"
)

// noopReader returns nil content for any file.
func noopReader(id string) ([]byte, error) { return nil, nil }

// mapReader returns file content from a static map.
func mapReader(files map[string]string) func(string) ([]byte, error) {
	return func(id string) ([]byte, error) {
		return []byte(files[id]), nil
	}
}

// ─── AssembleState ────────────────────────────────────────────────────────────

func TestAssembleState_Empty(t *testing.T) {
	info := model.RepoInfo{Name: "test-repo", Branch: "main"}
	state := AssembleState(nil, info, noopReader, layout.Config{}, deps.Config{})

	if state.RepoInfo.Name != "test-repo" {
		t.Errorf("RepoInfo.Name = %q, want %q", state.RepoInfo.Name, "test-repo")
	}
	if state.RepoInfo.Branch != "main" {
		t.Errorf("RepoInfo.Branch = %q, want %q", state.RepoInfo.Branch, "main")
	}
	if len(state.Districts) != 0 {
		t.Errorf("Districts: want 0, got %d", len(state.Districts))
	}
	if len(state.Buildings) != 0 {
		t.Errorf("Buildings: want 0, got %d", len(state.Buildings))
	}
	if len(state.Roads) != 0 {
		t.Errorf("Roads: want 0, got %d", len(state.Roads))
	}
	if state.Stats.FileCount != 0 {
		t.Errorf("Stats.FileCount = %d, want 0", state.Stats.FileCount)
	}
}

func TestAssembleState_Timestamp(t *testing.T) {
	before := time.Now().UnixMilli()
	state := AssembleState(nil, model.RepoInfo{}, noopReader, layout.Config{}, deps.Config{})
	after := time.Now().UnixMilli()

	if state.Timestamp < before || state.Timestamp > after {
		t.Errorf("Timestamp %d not in [%d, %d]", state.Timestamp, before, after)
	}
}

func TestAssembleState_BuildingsAndDistricts(t *testing.T) {
	buildings := []model.Building{
		{ID: "src/main.ts", Language: "ts", LOC: 100},
		{ID: "src/utils.ts", Language: "ts", LOC: 50},
		{ID: "lib/helper.go", Language: "go", LOC: 75},
	}
	files := map[string]string{
		"src/main.ts":  `import { helper } from './utils';`,
		"src/utils.ts": `export const helper = () => {};`,
		"lib/helper.go": `package lib`,
	}

	info := model.RepoInfo{Name: "myrepo", Branch: "main", HeadCommit: "abc1234"}
	state := AssembleState(buildings, info, mapReader(files), layout.Config{}, deps.Config{})

	if len(state.Buildings) != 3 {
		t.Errorf("Buildings: want 3, got %d", len(state.Buildings))
	}
	if len(state.Districts) == 0 {
		t.Error("Districts: want at least 1, got 0")
	}

	// Verify layout fields are populated.
	for _, b := range state.Buildings {
		if b.GW == 0 || b.GH == 0 {
			t.Errorf("building %q has zero footprint (GW=%v GH=%v)", b.ID, b.GW, b.GH)
		}
	}
}

func TestAssembleState_Roads(t *testing.T) {
	buildings := []model.Building{
		{ID: "src/main.ts", Language: "ts", LOC: 100},
		{ID: "src/utils.ts", Language: "ts", LOC: 50},
	}
	files := map[string]string{
		"src/main.ts":  `import { helper } from './utils';`,
		"src/utils.ts": `export const helper = () => {};`,
	}

	state := AssembleState(buildings, model.RepoInfo{}, mapReader(files), layout.Config{}, deps.Config{})

	found := false
	for _, r := range state.Roads {
		if r.FromID == "src/main.ts" && r.ToID == "src/utils.ts" {
			found = true
			if r.Weight < 1 {
				t.Errorf("road weight = %d, want >= 1", r.Weight)
			}
		}
	}
	if !found {
		t.Errorf("expected road main.ts→utils.ts; roads: %+v", state.Roads)
	}
}

func TestAssembleState_Stats(t *testing.T) {
	buildings := []model.Building{
		{ID: "a.go", Language: "go", LOC: 100, Coverage: 0.8},
		{ID: "b.go", Language: "go", LOC: 200, Coverage: 0.6},
		{ID: "c.go", Language: "go", LOC: 50, Coverage: -1}, // unknown
	}

	state := AssembleState(buildings, model.RepoInfo{}, noopReader, layout.Config{}, deps.Config{})

	if state.Stats.FileCount != 3 {
		t.Errorf("FileCount = %d, want 3", state.Stats.FileCount)
	}
	if state.Stats.TotalLOC != 350 {
		t.Errorf("TotalLOC = %d, want 350", state.Stats.TotalLOC)
	}
	// Average coverage of a.go and b.go (c.go unknown): (0.8 + 0.6) / 2 = 0.7
	if state.Stats.Coverage < 0.69 || state.Stats.Coverage > 0.71 {
		t.Errorf("Coverage = %v, want ~0.7", state.Stats.Coverage)
	}
}

// ─── MergeBuildings ───────────────────────────────────────────────────────────

func TestMergeBuildings_UpdateLOC(t *testing.T) {
	current := model.CityState{
		Buildings: []model.Building{
			{ID: "a.ts", LOC: 100, GX: 1, GY: 2, GW: 3, GH: 4, GZ: 10},
			{ID: "b.ts", LOC: 50, GX: 5, GY: 6, GW: 2, GH: 2, GZ: 5},
		},
	}

	updates := []model.Building{{ID: "a.ts", LOC: 120}}
	next := MergeBuildings(current, updates)

	var a model.Building
	for _, b := range next.Buildings {
		if b.ID == "a.ts" {
			a = b
		}
	}

	if a.LOC != 120 {
		t.Errorf("LOC = %d, want 120", a.LOC)
	}
	// Layout fields must be preserved from original.
	if a.GX != 1 || a.GY != 2 || a.GW != 3 || a.GH != 4 || a.GZ != 10 {
		t.Errorf("layout not preserved: GX=%v GY=%v GW=%v GH=%v GZ=%v", a.GX, a.GY, a.GW, a.GH, a.GZ)
	}
}

func TestMergeBuildings_Tombstone(t *testing.T) {
	current := model.CityState{
		Buildings: []model.Building{
			{ID: "a.ts", LOC: 100},
			{ID: "b.ts", LOC: 50},
		},
	}

	// Tombstone for a.ts: LOC == 0 signals deletion.
	next := MergeBuildings(current, []model.Building{{ID: "a.ts", LOC: 0}})

	if len(next.Buildings) != 1 {
		t.Fatalf("Buildings: want 1 after tombstone, got %d", len(next.Buildings))
	}
	if next.Buildings[0].ID != "b.ts" {
		t.Errorf("remaining building = %q, want %q", next.Buildings[0].ID, "b.ts")
	}
	if next.Stats.FileCount != 1 {
		t.Errorf("Stats.FileCount = %d, want 1", next.Stats.FileCount)
	}
}

func TestMergeBuildings_AddNew(t *testing.T) {
	current := model.CityState{
		Buildings: []model.Building{
			{ID: "a.ts", LOC: 100},
		},
	}

	updates := []model.Building{{ID: "new.ts", LOC: 30, Language: "ts"}}
	next := MergeBuildings(current, updates)

	if len(next.Buildings) != 2 {
		t.Fatalf("Buildings: want 2, got %d", len(next.Buildings))
	}

	ids := make([]string, len(next.Buildings))
	for i, b := range next.Buildings {
		ids[i] = b.ID
	}
	sort.Strings(ids)
	if ids[0] != "a.ts" || ids[1] != "new.ts" {
		t.Errorf("unexpected IDs: %v", ids)
	}
	if next.Stats.FileCount != 2 {
		t.Errorf("Stats.FileCount = %d, want 2", next.Stats.FileCount)
	}
}

func TestMergeBuildings_PreservesTimestamp(t *testing.T) {
	current := model.CityState{
		Buildings: []model.Building{{ID: "a.ts", LOC: 10}},
		Timestamp: 999,
	}

	before := time.Now().UnixMilli()
	next := MergeBuildings(current, []model.Building{{ID: "a.ts", LOC: 20}})
	after := time.Now().UnixMilli()

	if next.Timestamp < before || next.Timestamp > after {
		t.Errorf("Timestamp %d not in [%d, %d]", next.Timestamp, before, after)
	}
}

// ─── BuildState (integration smoke test) ─────────────────────────────────────

// TestBuildState_SelfScan scans the project's own repository as a smoke test.
// It verifies BuildState doesn't panic, returns buildings, and populates basic stats.
func TestBuildState_SelfScan(t *testing.T) {
	// Locate repo root: this file is at internal/city/builder_test.go.
	_, thisFile, _, ok := runtime.Caller(0)
	if !ok {
		t.Skip("runtime.Caller failed")
	}
	repoRoot := filepath.Join(filepath.Dir(thisFile), "..", "..")

	cfg := BuildConfig{
		DepsCfg: deps.Config{ModuleName: "github.com/mferree/agent-city"},
	}

	state, err := BuildState(repoRoot, cfg)
	if err != nil {
		t.Fatalf("BuildState: %v", err)
	}

	if len(state.Buildings) == 0 {
		t.Error("Buildings: want > 0, got 0")
	}
	if state.Stats.FileCount != len(state.Buildings) {
		t.Errorf("Stats.FileCount = %d, want %d", state.Stats.FileCount, len(state.Buildings))
	}
	if state.Stats.TotalLOC == 0 {
		t.Error("Stats.TotalLOC: want > 0, got 0")
	}
	if state.RepoInfo.Name == "" {
		t.Error("RepoInfo.Name: want non-empty")
	}
	if state.Timestamp == 0 {
		t.Error("Timestamp: want non-zero")
	}
}

// ─── GatherRepoInfo ───────────────────────────────────────────────────────────

func TestGatherRepoInfo_SelfRepo(t *testing.T) {
	_, thisFile, _, ok := runtime.Caller(0)
	if !ok {
		t.Skip("runtime.Caller failed")
	}
	repoRoot := filepath.Join(filepath.Dir(thisFile), "..", "..")

	info, err := GatherRepoInfo(repoRoot)
	if err != nil {
		t.Fatalf("GatherRepoInfo: %v", err)
	}

	if info.Name == "" {
		t.Error("Name: want non-empty")
	}
	if info.Branch == "" {
		t.Error("Branch: want non-empty")
	}
	if info.HeadCommit == "" {
		t.Error("HeadCommit: want non-empty")
	}
	if len(info.HeadCommit) > 7 {
		t.Errorf("HeadCommit = %q, want at most 7 chars", info.HeadCommit)
	}
	if info.CIStatus == "" {
		t.Error("CIStatus: want non-empty (at least 'unknown')")
	}
}
