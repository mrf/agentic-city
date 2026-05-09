package hub

import (
	"encoding/json"
	"fmt"
	"testing"

	"github.com/mferree/agent-city/internal/model"
)

// TestGetState_SlicesAreIndependent verifies that GetState returns a deep copy:
// mutating slice elements in the returned value must not affect internal state.
func TestGetState_SlicesAreIndependent(t *testing.T) {
	orig := model.CityState{
		Districts:  []model.District{{ID: "d1"}},
		Buildings:  []model.Building{{ID: "b1"}},
		Roads:      []model.Road{{FromID: "x", ToID: "y"}},
		Agents:     []model.Agent{{ID: "a1", Task: "original"}},
		Activities: []model.ActivityEvent{{Who: "agent1", Message: "hello"}},
	}
	s := NewState(orig)

	got := s.GetState()

	// Mutate every slice element in the copy.
	got.Districts[0].ID = "MUTATED"
	got.Buildings[0].ID = "MUTATED"
	got.Roads[0].FromID = "MUTATED"
	got.Agents[0].Task = "MUTATED"
	got.Activities[0].Message = "MUTATED"

	// Re-fetch the state; internal state must be unchanged.
	back := s.GetState()
	if back.Districts[0].ID != "d1" {
		t.Errorf("Districts backing array shared: got %q, want %q", back.Districts[0].ID, "d1")
	}
	if back.Buildings[0].ID != "b1" {
		t.Errorf("Buildings backing array shared: got %q, want %q", back.Buildings[0].ID, "b1")
	}
	if back.Roads[0].FromID != "x" {
		t.Errorf("Roads backing array shared: got %q, want %q", back.Roads[0].FromID, "x")
	}
	if back.Agents[0].Task != "original" {
		t.Errorf("Agents backing array shared: got %q, want %q", back.Agents[0].Task, "original")
	}
	if back.Activities[0].Message != "hello" {
		t.Errorf("Activities backing array shared: got %q, want %q", back.Activities[0].Message, "hello")
	}
}

// TestState_DirtyFlagLifecycle verifies that SetState marks the state dirty and
// consumeStateJSON clears it atomically.
func TestState_DirtyFlagLifecycle(t *testing.T) {
	s := NewState(model.CityState{})

	// Fresh state should be dirty so the first snapshot is broadcast.
	_, dirty := s.consumeStateJSON()
	if !dirty {
		t.Error("expected new State to be dirty")
	}

	// After consuming, state should be clean.
	_, dirty = s.consumeStateJSON()
	if dirty {
		t.Error("expected State to be clean after consumeStateJSON")
	}

	// SetState should mark dirty again.
	s.SetState(model.CityState{Stats: model.RepoStats{FileCount: 5}})
	_, dirty = s.consumeStateJSON()
	if !dirty {
		t.Error("expected State to be dirty after SetState")
	}
}

// TestHub_NoopTickSkipsBroadcast verifies that repeated ticks without any
// intervening SetState do not send messages to clients.
func TestHub_NoopTickSkipsBroadcast(t *testing.T) {
	initial := model.CityState{Stats: model.RepoStats{FileCount: 1}}
	s := NewState(initial)
	h := New(s)

	// Drain the state's dirty flag (simulate the hub having already sent a full
	// snapshot so prevJSON is populated and the dirty flag is clear).
	h.prevJSON, _ = s.consumeStateJSON()

	// With no intervening SetState, maybeBroadcastPatch must not send anything.
	// Register a synthetic client with a buffered send channel.
	recv := make(chan []byte, 4)
	h.clients[&client{send: recv}] = struct{}{}

	h.maybeBroadcastPatch()

	select {
	case <-recv:
		t.Error("client received a message on a no-op tick")
	default:
		// expected — no message sent
	}
}

// TestHub_SetStateTriggersBroadcast verifies that after SetState the next
// maybeBroadcastPatch call sends a patch to clients.
func TestHub_SetStateTriggersBroadcast(t *testing.T) {
	initial := model.CityState{Stats: model.RepoStats{FileCount: 1}}
	s := NewState(initial)
	h := New(s)

	// Simulate the hub having already sent the initial snapshot.
	h.prevJSON, _ = s.consumeStateJSON()
	recv := make(chan []byte, 4)
	h.clients[&client{send: recv}] = struct{}{}

	// Mutate state.
	s.SetState(model.CityState{Stats: model.RepoStats{FileCount: 99}})

	h.maybeBroadcastPatch()

	select {
	case msg := <-recv:
		if len(msg) == 0 {
			t.Error("received empty message")
		}
	default:
		t.Fatal("client did not receive patch after SetState")
	}
}

// mustJSON marshals v to JSON bytes, panicking on error.
func mustJSON(t *testing.T, v any) []byte {
	t.Helper()
	b, err := json.Marshal(v)
	if err != nil {
		t.Fatalf("mustJSON: %v", err)
	}
	return b
}

// patchOp is a convenience builder for expected patches.
func patchOp(op, path string, value ...any) JSONPatch {
	p := JSONPatch{Op: op, Path: path}
	if len(value) > 0 {
		p.Value = value[0]
	}
	return p
}

// assertPatchOps checks that patches contain the expected operations,
// ignoring value equality for simplicity.
func assertPatchOps(t *testing.T, got []JSONPatch, wantOps []JSONPatch) {
	t.Helper()
	if len(got) != len(wantOps) {
		t.Errorf("patch count: got %d, want %d", len(got), len(wantOps))
		for i, p := range got {
			t.Logf("  got[%d]: op=%s path=%s", i, p.Op, p.Path)
		}
		for i, p := range wantOps {
			t.Logf("  want[%d]: op=%s path=%s", i, p.Op, p.Path)
		}
		return
	}
	for i := range got {
		if got[i].Op != wantOps[i].Op || got[i].Path != wantOps[i].Path {
			t.Errorf("patch[%d]: got {op:%s path:%s}, want {op:%s path:%s}",
				i, got[i].Op, got[i].Path, wantOps[i].Op, wantOps[i].Path)
		}
	}
}

// findPatch returns the first patch matching op and path, or nil.
func findPatch(patches []JSONPatch, op, path string) *JSONPatch {
	for i := range patches {
		if patches[i].Op == op && patches[i].Path == path {
			return &patches[i]
		}
	}
	return nil
}

// ───────────────────────────────────────────────────────────────────
// Diff: basic cases
// ───────────────────────────────────────────────────────────────────

func TestDiff_EmptyOldReturnsNil(t *testing.T) {
	patches := Diff(nil, []byte(`{"a":1}`))
	if patches != nil {
		t.Errorf("expected nil, got %d patches", len(patches))
	}
}

func TestDiff_InvalidJSONReturnsNil(t *testing.T) {
	patches := Diff([]byte(`not json`), []byte(`{"a":1}`))
	if patches != nil {
		t.Errorf("expected nil for invalid old, got %d patches", len(patches))
	}
	patches = Diff([]byte(`{"a":1}`), []byte(`not json`))
	if patches != nil {
		t.Errorf("expected nil for invalid new, got %d patches", len(patches))
	}
}

func TestDiff_IdenticalInputReturnsNil(t *testing.T) {
	j := []byte(`{"name":"test","value":42,"active":true}`)
	patches := Diff(j, j)
	if len(patches) != 0 {
		t.Errorf("expected 0 patches for identical input, got %d", len(patches))
	}
}

// ───────────────────────────────────────────────────────────────────
// Diff: primitive values
// ───────────────────────────────────────────────────────────────────

func TestDiff_PrimitiveStringChange(t *testing.T) {
	old := mustJSON(t, map[string]any{"name": "alpha"})
	cur := mustJSON(t, map[string]any{"name": "beta"})
	patches := Diff(old, cur)
	assertPatchOps(t, patches, []JSONPatch{patchOp("replace", "/name")})
}

func TestDiff_PrimitiveNumberChange(t *testing.T) {
	old := mustJSON(t, map[string]any{"count": 1.0})
	cur := mustJSON(t, map[string]any{"count": 2.0})
	patches := Diff(old, cur)
	assertPatchOps(t, patches, []JSONPatch{patchOp("replace", "/count")})
}

func TestDiff_PrimitiveBoolChange(t *testing.T) {
	old := mustJSON(t, map[string]any{"active": true})
	cur := mustJSON(t, map[string]any{"active": false})
	patches := Diff(old, cur)
	assertPatchOps(t, patches, []JSONPatch{patchOp("replace", "/active")})
}

func TestDiff_PrimitiveNullChange(t *testing.T) {
	old := mustJSON(t, map[string]any{"val": "hello"})
	cur := mustJSON(t, map[string]any{"val": nil})
	patches := Diff(old, cur)
	assertPatchOps(t, patches, []JSONPatch{patchOp("replace", "/val")})
}

func TestDiff_PrimitiveUnchangedGeneratesNothing(t *testing.T) {
	old := mustJSON(t, map[string]any{"s": "x", "n": 3.14, "b": true})
	cur := mustJSON(t, map[string]any{"s": "x", "n": 3.14, "b": true})
	patches := Diff(old, cur)
	if len(patches) != 0 {
		t.Errorf("expected 0 patches, got %d", len(patches))
	}
}

// ───────────────────────────────────────────────────────────────────
// Diff: object fields
// ───────────────────────────────────────────────────────────────────

func TestDiff_ObjectFieldAdded(t *testing.T) {
	old := mustJSON(t, map[string]any{"a": 1.0})
	cur := mustJSON(t, map[string]any{"a": 1.0, "b": 2.0})
	patches := Diff(old, cur)
	assertPatchOps(t, patches, []JSONPatch{patchOp("add", "/b")})
}

func TestDiff_ObjectFieldRemoved(t *testing.T) {
	old := mustJSON(t, map[string]any{"a": 1.0, "b": 2.0})
	cur := mustJSON(t, map[string]any{"a": 1.0})
	patches := Diff(old, cur)
	assertPatchOps(t, patches, []JSONPatch{patchOp("remove", "/b")})
}

func TestDiff_NestedObjectChange(t *testing.T) {
	old := mustJSON(t, map[string]any{"outer": map[string]any{"inner": "old"}})
	cur := mustJSON(t, map[string]any{"outer": map[string]any{"inner": "new"}})
	patches := Diff(old, cur)
	assertPatchOps(t, patches, []JSONPatch{patchOp("replace", "/outer/inner")})
}

func TestDiff_TypeChangeObjectToPrimitive(t *testing.T) {
	old := mustJSON(t, map[string]any{"x": map[string]any{"a": 1.0}})
	cur := mustJSON(t, map[string]any{"x": "flat"})
	patches := Diff(old, cur)
	assertPatchOps(t, patches, []JSONPatch{patchOp("replace", "/x")})
}

func TestDiff_TypeChangePrimitiveToObject(t *testing.T) {
	old := mustJSON(t, map[string]any{"x": "flat"})
	cur := mustJSON(t, map[string]any{"x": map[string]any{"a": 1.0}})
	patches := Diff(old, cur)
	assertPatchOps(t, patches, []JSONPatch{patchOp("replace", "/x")})
}

// ───────────────────────────────────────────────────────────────────
// Diff: unkeyed arrays (positional diffing)
// ───────────────────────────────────────────────────────────────────

func TestDiff_UnkeyedArrayAppend(t *testing.T) {
	old := mustJSON(t, map[string]any{"items": []any{1.0, 2.0}})
	cur := mustJSON(t, map[string]any{"items": []any{1.0, 2.0, 3.0}})
	patches := Diff(old, cur)
	assertPatchOps(t, patches, []JSONPatch{patchOp("add", "/items/-")})
}

func TestDiff_UnkeyedArrayRemoveLast(t *testing.T) {
	old := mustJSON(t, map[string]any{"items": []any{1.0, 2.0, 3.0}})
	cur := mustJSON(t, map[string]any{"items": []any{1.0, 2.0}})
	patches := Diff(old, cur)
	assertPatchOps(t, patches, []JSONPatch{patchOp("remove", "/items/2")})
}

func TestDiff_UnkeyedArrayModifyElement(t *testing.T) {
	old := mustJSON(t, map[string]any{"items": []any{1.0, 2.0, 3.0}})
	cur := mustJSON(t, map[string]any{"items": []any{1.0, 99.0, 3.0}})
	patches := Diff(old, cur)
	assertPatchOps(t, patches, []JSONPatch{patchOp("replace", "/items/1")})
}

func TestDiff_UnkeyedArrayTypeChangeToSlice(t *testing.T) {
	old := mustJSON(t, map[string]any{"items": "not an array"})
	cur := mustJSON(t, map[string]any{"items": []any{1.0}})
	patches := Diff(old, cur)
	assertPatchOps(t, patches, []JSONPatch{patchOp("replace", "/items")})
}

// ───────────────────────────────────────────────────────────────────
// Diff: keyed arrays (by "id" field)
// This is the core improvement: matching by ID instead of position.
// ───────────────────────────────────────────────────────────────────

func building(id, label, status string) map[string]any {
	return map[string]any{
		"id":     id,
		"label":  label,
		"status": status,
		"loc":    100.0,
	}
}

func TestDiff_KeyedArrayInsertAtBeginning(t *testing.T) {
	// The motivating bug: inserting one element at index 0 should NOT
	// generate N replace ops for every subsequent element.
	old := mustJSON(t, map[string]any{"buildings": []any{
		building("b1", "auth.go", "ok"),
		building("b2", "main.go", "ok"),
		building("b3", "hub.go", "ok"),
	}})
	cur := mustJSON(t, map[string]any{"buildings": []any{
		building("b0", "new.go", "ok"), // inserted at front
		building("b1", "auth.go", "ok"),
		building("b2", "main.go", "ok"),
		building("b3", "hub.go", "ok"),
	}})

	patches := Diff(old, cur)

	// Should be exactly 1 add op, NOT 3 replaces + 1 add.
	if len(patches) != 1 {
		t.Errorf("expected 1 patch (add), got %d:", len(patches))
		for i, p := range patches {
			t.Logf("  [%d] op=%s path=%s", i, p.Op, p.Path)
		}
		return
	}
	if patches[0].Op != "add" {
		t.Errorf("expected add op, got %s", patches[0].Op)
	}
	if patches[0].Path != "/buildings/0" {
		t.Errorf("expected path /buildings/0, got %s", patches[0].Path)
	}
}

func TestDiff_KeyedArrayInsertInMiddle(t *testing.T) {
	old := mustJSON(t, map[string]any{"buildings": []any{
		building("b1", "a.go", "ok"),
		building("b3", "c.go", "ok"),
	}})
	cur := mustJSON(t, map[string]any{"buildings": []any{
		building("b1", "a.go", "ok"),
		building("b2", "b.go", "ok"), // inserted in middle
		building("b3", "c.go", "ok"),
	}})

	patches := Diff(old, cur)

	if len(patches) != 1 {
		t.Errorf("expected 1 patch (add at middle), got %d:", len(patches))
		for i, p := range patches {
			t.Logf("  [%d] op=%s path=%s", i, p.Op, p.Path)
		}
		return
	}
	if patches[0].Op != "add" || patches[0].Path != "/buildings/1" {
		t.Errorf("expected add at /buildings/1, got op=%s path=%s", patches[0].Op, patches[0].Path)
	}
}

func TestDiff_KeyedArrayRemoveFromMiddle(t *testing.T) {
	old := mustJSON(t, map[string]any{"buildings": []any{
		building("b1", "a.go", "ok"),
		building("b2", "b.go", "ok"),
		building("b3", "c.go", "ok"),
	}})
	cur := mustJSON(t, map[string]any{"buildings": []any{
		building("b1", "a.go", "ok"),
		building("b3", "c.go", "ok"),
	}})

	patches := Diff(old, cur)

	if len(patches) != 1 {
		t.Errorf("expected 1 patch (remove), got %d:", len(patches))
		for i, p := range patches {
			t.Logf("  [%d] op=%s path=%s", i, p.Op, p.Path)
		}
		return
	}
	if patches[0].Op != "remove" || patches[0].Path != "/buildings/1" {
		t.Errorf("expected remove at /buildings/1, got op=%s path=%s", patches[0].Op, patches[0].Path)
	}
}

func TestDiff_KeyedArrayPropertyUpdate(t *testing.T) {
	// Same set of IDs, same order — should diff recursively per element.
	old := mustJSON(t, map[string]any{"agents": []any{
		map[string]any{"id": "a1", "mode": "idle", "progress": 0.0},
		map[string]any{"id": "a2", "mode": "work", "progress": 50.0},
	}})
	cur := mustJSON(t, map[string]any{"agents": []any{
		map[string]any{"id": "a1", "mode": "work", "progress": 10.0},
		map[string]any{"id": "a2", "mode": "work", "progress": 75.0},
	}})

	patches := Diff(old, cur)

	// Should get 3 replaces: a1.mode, a1.progress, a2.progress
	if len(patches) != 3 {
		t.Errorf("expected 3 property patches, got %d:", len(patches))
		for i, p := range patches {
			t.Logf("  [%d] op=%s path=%s", i, p.Op, p.Path)
		}
		return
	}
	// All should be "replace" ops targeting nested paths
	for _, p := range patches {
		if p.Op != "replace" {
			t.Errorf("expected replace op, got %s at %s", p.Op, p.Path)
		}
	}
}

func TestDiff_KeyedArrayInsertAndModify(t *testing.T) {
	old := mustJSON(t, map[string]any{"agents": []any{
		map[string]any{"id": "a1", "mode": "idle"},
		map[string]any{"id": "a2", "mode": "work"},
	}})
	cur := mustJSON(t, map[string]any{"agents": []any{
		map[string]any{"id": "a0", "mode": "fly"},  // new
		map[string]any{"id": "a1", "mode": "work"},  // changed
		map[string]any{"id": "a2", "mode": "work"},  // unchanged
	}})

	patches := Diff(old, cur)

	// Should have: 1 add (a0) + 1 replace (a1.mode) = 2 patches
	addPatch := findPatch(patches, "add", "/agents/0")
	if addPatch == nil {
		t.Error("missing add at /agents/0")
	}
	replacePatch := findPatch(patches, "replace", "/agents/1/mode")
	if replacePatch == nil {
		t.Error("missing replace at /agents/1/mode")
	}
	if len(patches) != 2 {
		t.Errorf("expected 2 patches, got %d:", len(patches))
		for i, p := range patches {
			t.Logf("  [%d] op=%s path=%s", i, p.Op, p.Path)
		}
	}
}

func TestDiff_KeyedArrayRemoveAndModify(t *testing.T) {
	old := mustJSON(t, map[string]any{"buildings": []any{
		building("b1", "a.go", "ok"),
		building("b2", "b.go", "ok"),
		building("b3", "c.go", "ok"),
	}})
	cur := mustJSON(t, map[string]any{"buildings": []any{
		building("b1", "a.go", "warn"), // modified
		building("b3", "c.go", "ok"),   // b2 removed
	}})

	patches := Diff(old, cur)

	removePatch := findPatch(patches, "remove", "/buildings/1")
	if removePatch == nil {
		t.Error("missing remove at /buildings/1")
	}
	replacePatch := findPatch(patches, "replace", "/buildings/0/status")
	if replacePatch == nil {
		t.Error("missing replace at /buildings/0/status")
	}
	if len(patches) != 2 {
		t.Errorf("expected 2 patches, got %d:", len(patches))
		for i, p := range patches {
			t.Logf("  [%d] op=%s path=%s", i, p.Op, p.Path)
		}
	}
}

func TestDiff_KeyedArrayMultipleInserts(t *testing.T) {
	old := mustJSON(t, map[string]any{"items": []any{
		map[string]any{"id": "a", "v": 1.0},
	}})
	cur := mustJSON(t, map[string]any{"items": []any{
		map[string]any{"id": "x", "v": 10.0},
		map[string]any{"id": "a", "v": 1.0},
		map[string]any{"id": "y", "v": 20.0},
	}})

	patches := Diff(old, cur)

	// 2 adds: x at 0, y at 2
	if len(patches) != 2 {
		t.Errorf("expected 2 add patches, got %d:", len(patches))
		for i, p := range patches {
			t.Logf("  [%d] op=%s path=%s", i, p.Op, p.Path)
		}
		return
	}
	if findPatch(patches, "add", "/items/0") == nil {
		t.Error("missing add at /items/0")
	}
	if findPatch(patches, "add", "/items/2") == nil {
		t.Error("missing add at /items/2")
	}
}

func TestDiff_KeyedArrayMultipleRemoves(t *testing.T) {
	old := mustJSON(t, map[string]any{"items": []any{
		map[string]any{"id": "a", "v": 1.0},
		map[string]any{"id": "b", "v": 2.0},
		map[string]any{"id": "c", "v": 3.0},
		map[string]any{"id": "d", "v": 4.0},
	}})
	cur := mustJSON(t, map[string]any{"items": []any{
		map[string]any{"id": "a", "v": 1.0},
		map[string]any{"id": "d", "v": 4.0},
	}})

	patches := Diff(old, cur)

	// 2 removes: b at old index 1, c at old index 2 (highest first: 2, then 1)
	if len(patches) != 2 {
		t.Errorf("expected 2 remove patches, got %d:", len(patches))
		for i, p := range patches {
			t.Logf("  [%d] op=%s path=%s", i, p.Op, p.Path)
		}
		return
	}
	// Removes must be highest index first for correct sequential application
	if patches[0].Op != "remove" || patches[0].Path != "/items/2" {
		t.Errorf("first remove should be /items/2, got op=%s path=%s", patches[0].Op, patches[0].Path)
	}
	if patches[1].Op != "remove" || patches[1].Path != "/items/1" {
		t.Errorf("second remove should be /items/1, got op=%s path=%s", patches[1].Op, patches[1].Path)
	}
}

func TestDiff_KeyedArrayReorderFallsBackToReplace(t *testing.T) {
	// Reordering elements (same IDs, different order) should generate
	// a replace for the whole array since move ops are complex.
	old := mustJSON(t, map[string]any{"items": []any{
		map[string]any{"id": "a", "v": 1.0},
		map[string]any{"id": "b", "v": 2.0},
		map[string]any{"id": "c", "v": 3.0},
	}})
	cur := mustJSON(t, map[string]any{"items": []any{
		map[string]any{"id": "c", "v": 3.0},
		map[string]any{"id": "a", "v": 1.0},
		map[string]any{"id": "b", "v": 2.0},
	}})

	patches := Diff(old, cur)

	if len(patches) != 1 || patches[0].Op != "replace" || patches[0].Path != "/items" {
		t.Errorf("expected 1 replace of /items for reorder, got %d patches:", len(patches))
		for i, p := range patches {
			t.Logf("  [%d] op=%s path=%s", i, p.Op, p.Path)
		}
	}
}

func TestDiff_KeyedArrayEmptyToPopulated(t *testing.T) {
	old := mustJSON(t, map[string]any{"items": []any{}})
	cur := mustJSON(t, map[string]any{"items": []any{
		map[string]any{"id": "a", "v": 1.0},
		map[string]any{"id": "b", "v": 2.0},
	}})

	patches := Diff(old, cur)

	// Empty old has no IDs to extract, so falls back to positional.
	// Both elements appended via add /-.
	if len(patches) != 2 {
		t.Errorf("expected 2 add patches, got %d", len(patches))
	}
}

func TestDiff_KeyedArrayPopulatedToEmpty(t *testing.T) {
	old := mustJSON(t, map[string]any{"items": []any{
		map[string]any{"id": "a", "v": 1.0},
		map[string]any{"id": "b", "v": 2.0},
	}})
	cur := mustJSON(t, map[string]any{"items": []any{}})

	patches := Diff(old, cur)

	// All removed — should be 2 remove ops (highest index first).
	if len(patches) != 2 {
		t.Errorf("expected 2 remove patches, got %d:", len(patches))
		for i, p := range patches {
			t.Logf("  [%d] op=%s path=%s", i, p.Op, p.Path)
		}
		return
	}
	if patches[0].Op != "remove" || patches[0].Path != "/items/1" {
		t.Errorf("first remove should be /items/1, got %s %s", patches[0].Op, patches[0].Path)
	}
}

func TestDiff_KeyedArrayDuplicateIDsFallsBack(t *testing.T) {
	// Duplicate IDs in the array: keyed diffing should bail out.
	old := mustJSON(t, map[string]any{"items": []any{
		map[string]any{"id": "a", "v": 1.0},
		map[string]any{"id": "a", "v": 2.0}, // duplicate
	}})
	cur := mustJSON(t, map[string]any{"items": []any{
		map[string]any{"id": "a", "v": 3.0},
		map[string]any{"id": "a", "v": 4.0},
	}})

	patches := Diff(old, cur)

	// Should fall back to positional diffing, generating 2 replaces for /v
	for _, p := range patches {
		if p.Op == "add" || p.Op == "remove" {
			t.Errorf("unexpected structural op for duplicate IDs: %s %s", p.Op, p.Path)
		}
	}
}

func TestDiff_MixedArrayElementsFallsBackToPositional(t *testing.T) {
	// Array with a mix of objects (with id) and primitives:
	// keyed diffing should bail out, fall back to positional.
	old := mustJSON(t, map[string]any{"items": []any{
		map[string]any{"id": "a"},
		"not an object",
	}})
	cur := mustJSON(t, map[string]any{"items": []any{
		map[string]any{"id": "a"},
		"changed",
	}})

	patches := Diff(old, cur)
	assertPatchOps(t, patches, []JSONPatch{patchOp("replace", "/items/1")})
}

func TestDiff_ObjectsWithoutIDFallBackToPositional(t *testing.T) {
	// Array of objects that don't have an "id" field.
	old := mustJSON(t, map[string]any{"items": []any{
		map[string]any{"name": "a"},
		map[string]any{"name": "b"},
	}})
	cur := mustJSON(t, map[string]any{"items": []any{
		map[string]any{"name": "x"}, // inserted
		map[string]any{"name": "a"},
		map[string]any{"name": "b"},
	}})

	patches := Diff(old, cur)

	// Without IDs, positional diffing applies: 2 replaces + 1 add
	if len(patches) != 3 {
		t.Errorf("expected 3 positional patches, got %d:", len(patches))
		for i, p := range patches {
			t.Logf("  [%d] op=%s path=%s", i, p.Op, p.Path)
		}
	}
}

// ───────────────────────────────────────────────────────────────────
// Diff: JSON Pointer escaping
// ───────────────────────────────────────────────────────────────────

func TestDiff_PathEscaping(t *testing.T) {
	old := mustJSON(t, map[string]any{"a/b": 1.0, "c~d": 2.0})
	cur := mustJSON(t, map[string]any{"a/b": 10.0, "c~d": 20.0})
	patches := Diff(old, cur)

	paths := map[string]bool{}
	for _, p := range patches {
		paths[p.Path] = true
	}
	if !paths["/a~1b"] {
		t.Error("missing escaped path /a~1b for key a/b")
	}
	if !paths["/c~0d"] {
		t.Error("missing escaped path /c~0d for key c~d")
	}
}

// ───────────────────────────────────────────────────────────────────
// primitiveEqual
// ───────────────────────────────────────────────────────────────────

func TestPrimitiveEqual_SameStrings(t *testing.T) {
	if !primitiveEqual("hello", "hello") {
		t.Error("same strings should be equal")
	}
}

func TestPrimitiveEqual_DifferentStrings(t *testing.T) {
	if primitiveEqual("hello", "world") {
		t.Error("different strings should not be equal")
	}
}

func TestPrimitiveEqual_SameNumbers(t *testing.T) {
	if !primitiveEqual(3.14, 3.14) {
		t.Error("same numbers should be equal")
	}
}

func TestPrimitiveEqual_DifferentNumbers(t *testing.T) {
	if primitiveEqual(1.0, 2.0) {
		t.Error("different numbers should not be equal")
	}
}

func TestPrimitiveEqual_SameBools(t *testing.T) {
	if !primitiveEqual(true, true) {
		t.Error("same bools should be equal")
	}
}

func TestPrimitiveEqual_DifferentBools(t *testing.T) {
	if primitiveEqual(true, false) {
		t.Error("different bools should not be equal")
	}
}

func TestPrimitiveEqual_BothNil(t *testing.T) {
	if !primitiveEqual(nil, nil) {
		t.Error("both nil should be equal")
	}
}

func TestPrimitiveEqual_NilVsValue(t *testing.T) {
	if primitiveEqual(nil, "hello") {
		t.Error("nil vs string should not be equal")
	}
	if primitiveEqual("hello", nil) {
		t.Error("string vs nil should not be equal")
	}
}

func TestPrimitiveEqual_DifferentTypes(t *testing.T) {
	if primitiveEqual("1", 1.0) {
		t.Error("string vs number should not be equal")
	}
	if primitiveEqual(true, 1.0) {
		t.Error("bool vs number should not be equal")
	}
}

func TestPrimitiveEqual_MapVsPrimitive(t *testing.T) {
	// Old value was a map, new value is a primitive (type changed).
	m := map[string]any{"a": 1.0}
	if primitiveEqual(m, "hello") {
		t.Error("map vs string should not be equal")
	}
}

func TestPrimitiveEqual_SliceVsPrimitive(t *testing.T) {
	s := []any{1.0, 2.0}
	if primitiveEqual(s, "hello") {
		t.Error("slice vs string should not be equal")
	}
}

// ───────────────────────────────────────────────────────────────────
// ptrEscape
// ───────────────────────────────────────────────────────────────────

func TestPtrEscape(t *testing.T) {
	tests := []struct {
		in, want string
	}{
		{"simple", "simple"},
		{"a/b", "a~1b"},
		{"a~b", "a~0b"},
		{"a~/b", "a~0~1b"},
		{"~/~", "~0~1~0"},
	}
	for _, tt := range tests {
		t.Run(tt.in, func(t *testing.T) {
			if got := ptrEscape(tt.in); got != tt.want {
				t.Errorf("ptrEscape(%q) = %q, want %q", tt.in, got, tt.want)
			}
		})
	}
}

// ───────────────────────────────────────────────────────────────────
// Realistic scenario: CityState-like structure
// ───────────────────────────────────────────────────────────────────

func TestDiff_CityStateAgentProgressUpdate(t *testing.T) {
	// Most common real-world diff: agent properties change each tick.
	state := func(progress float64) map[string]any {
		return map[string]any{
			"agents": []any{
				map[string]any{
					"id":       "agent-1",
					"mode":     "work",
					"progress": progress,
					"targetId": "src/main.go",
				},
			},
			"ts": 1000.0,
		}
	}
	old := mustJSON(t, state(50.0))
	cur := mustJSON(t, state(75.0))

	patches := Diff(old, cur)

	// Only the progress field should change.
	if len(patches) != 1 {
		t.Errorf("expected 1 patch for progress update, got %d:", len(patches))
		for i, p := range patches {
			t.Logf("  [%d] op=%s path=%s val=%v", i, p.Op, p.Path, p.Value)
		}
		return
	}
	if patches[0].Path != "/agents/0/progress" {
		t.Errorf("expected /agents/0/progress, got %s", patches[0].Path)
	}
}

func TestDiff_CityStateNewBuilding(t *testing.T) {
	// A new file is scanned — building added to the array.
	old := mustJSON(t, map[string]any{
		"buildings": []any{
			building("src/main.go", "main.go", "ok"),
			building("src/hub.go", "hub.go", "ok"),
		},
	})
	cur := mustJSON(t, map[string]any{
		"buildings": []any{
			building("src/auth.go", "auth.go", "ok"), // new file, sorted first
			building("src/main.go", "main.go", "ok"),
			building("src/hub.go", "hub.go", "ok"),
		},
	})

	patches := Diff(old, cur)

	// Should be 1 add op, not 2 replaces + 1 add.
	if len(patches) != 1 {
		t.Errorf("expected 1 add patch, got %d:", len(patches))
		for i, p := range patches {
			t.Logf("  [%d] op=%s path=%s", i, p.Op, p.Path)
		}
	}
}

func TestDiff_CityStateBuildingDeleted(t *testing.T) {
	// A file is deleted — building removed from the array.
	old := mustJSON(t, map[string]any{
		"buildings": []any{
			building("src/auth.go", "auth.go", "ok"),
			building("src/main.go", "main.go", "ok"),
			building("src/hub.go", "hub.go", "ok"),
		},
	})
	cur := mustJSON(t, map[string]any{
		"buildings": []any{
			building("src/auth.go", "auth.go", "ok"),
			building("src/hub.go", "hub.go", "ok"),
		},
	})

	patches := Diff(old, cur)

	// Should be 1 remove op.
	if len(patches) != 1 {
		t.Errorf("expected 1 remove patch, got %d:", len(patches))
		for i, p := range patches {
			t.Logf("  [%d] op=%s path=%s", i, p.Op, p.Path)
		}
	}
}

// ───────────────────────────────────────────────────────────────────
// Benchmark: primitiveEqual without JSON marshaling
// ───────────────────────────────────────────────────────────────────

func BenchmarkPrimitiveEqual_String(b *testing.B) {
	for i := 0; i < b.N; i++ {
		primitiveEqual("hello world", "hello world")
	}
}

func BenchmarkPrimitiveEqual_Number(b *testing.B) {
	for i := 0; i < b.N; i++ {
		primitiveEqual(3.14159, 3.14159)
	}
}

func BenchmarkPrimitiveEqual_Bool(b *testing.B) {
	for i := 0; i < b.N; i++ {
		primitiveEqual(true, true)
	}
}

func BenchmarkDiff_KeyedArray10Elements(b *testing.B) {
	items := make([]any, 10)
	for i := range items {
		items[i] = map[string]any{
			"id":     fmt.Sprintf("item-%d", i),
			"status": "ok",
			"value":  float64(i),
		}
	}
	old, _ := json.Marshal(map[string]any{"items": items})

	// Modify one element's status.
	modified := make([]any, 10)
	copy(modified, items)
	m := map[string]any{}
	for k, v := range items[5].(map[string]any) {
		m[k] = v
	}
	m["status"] = "warn"
	modified[5] = m
	cur, _ := json.Marshal(map[string]any{"items": modified})

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		Diff(old, cur)
	}
}
