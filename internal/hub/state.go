package hub

import (
	"encoding/json"
	"fmt"
	"slices"
	"strings"
	"sync"

	"github.com/mferree/agent-city/internal/model"
)

// JSONPatch represents a single RFC 6902 JSON Patch operation.
type JSONPatch struct {
	Op    string `json:"op"`
	Path  string `json:"path"`
	Value any    `json:"value,omitempty"`
}

// State is a thread-safe holder for the current CityState.
// It implements api.StateProvider.
//
// It caches pre-marshaled JSON on every write and tracks a dirty flag so the
// hub's broadcast loop can skip no-op ticks entirely without re-marshaling.
type State struct {
	mu        sync.RWMutex
	state     model.CityState
	stateJSON []byte // pre-serialized; updated by SetState
	dirty     bool   // true until consumeStateJSON clears it
}

// NewState returns a State initialised with s.
// The initial dirty flag is true so the first broadcast delivers a snapshot.
func NewState(s model.CityState) *State {
	j, _ := json.Marshal(s)
	return &State{state: s, stateJSON: j, dirty: true}
}

// GetState returns a deep copy of the current CityState. Thread-safe.
//
// Slice fields are independently allocated so callers cannot inadvertently
// mutate the backing arrays held inside State (data-race safety).
func (s *State) GetState() model.CityState {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return deepCopyState(s.state)
}

// SetState replaces the current CityState and pre-marshals its JSON
// representation. Thread-safe.
func (s *State) SetState(next model.CityState) {
	j, _ := json.Marshal(next)
	s.mu.Lock()
	defer s.mu.Unlock()
	s.state = next
	s.stateJSON = j
	s.dirty = true
}

// AddActivity appends an activity event to the current state. Thread-safe.
// Re-marshals JSON and sets the dirty flag so the hub broadcasts the change.
func (s *State) AddActivity(ev model.ActivityEvent) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.state.Activities = model.AppendActivity(s.state.Activities, ev)
	j, _ := json.Marshal(s.state)
	s.stateJSON = j
	s.dirty = true
}

// getStateJSON returns the pre-marshaled JSON without modifying the dirty flag.
// Safe for read paths (e.g. seeding prevJSON on first connect) that must not
// interfere with the broadcast loop's change detection.
func (s *State) getStateJSON() []byte {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.stateJSON
}

// consumeStateJSON returns the pre-marshaled JSON and whether the state has
// changed since the last call, atomically clearing the dirty flag.
// Called exclusively from the Hub's Run goroutine.
func (s *State) consumeStateJSON() ([]byte, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	dirty := s.dirty
	s.dirty = false
	return s.stateJSON, dirty
}

// deepCopyState returns a copy of cs whose slice fields own independent backing
// arrays. All element types are value types, so a shallow clone of each slice
// is sufficient. slices.Clone returns nil for nil input, avoiding needless
// allocations for unpopulated fields.
func deepCopyState(cs model.CityState) model.CityState {
	cs.Districts = slices.Clone(cs.Districts)
	cs.Buildings = slices.Clone(cs.Buildings)
	cs.Roads = slices.Clone(cs.Roads)
	cs.Agents = slices.Clone(cs.Agents)
	cs.Activities = slices.Clone(cs.Activities)
	return cs
}

// Diff computes RFC 6902 JSON Patch operations transforming oldJSON into newJSON.
// Returns nil when oldJSON is empty (first snapshot) or when parsing fails.
func Diff(oldJSON, newJSON []byte) []JSONPatch {
	if len(oldJSON) == 0 {
		return nil
	}
	var old, curr any
	if err := json.Unmarshal(oldJSON, &old); err != nil {
		return nil
	}
	if err := json.Unmarshal(newJSON, &curr); err != nil {
		return nil
	}
	var patches []JSONPatch
	diffValues("", old, curr, &patches)
	return patches
}

func diffValues(path string, old, curr any, patches *[]JSONPatch) {
	switch currV := curr.(type) {
	case map[string]any:
		oldMap, ok := old.(map[string]any)
		if !ok {
			*patches = append(*patches, JSONPatch{Op: "replace", Path: path, Value: curr})
			return
		}
		for k := range oldMap {
			if _, exists := currV[k]; !exists {
				*patches = append(*patches, JSONPatch{Op: "remove", Path: path + "/" + ptrEscape(k)})
			}
		}
		for k, v := range currV {
			childPath := path + "/" + ptrEscape(k)
			if oldVal, exists := oldMap[k]; !exists {
				*patches = append(*patches, JSONPatch{Op: "add", Path: childPath, Value: v})
			} else {
				diffValues(childPath, oldVal, v, patches)
			}
		}

	case []any:
		oldSlice, ok := old.([]any)
		if !ok {
			*patches = append(*patches, JSONPatch{Op: "replace", Path: path, Value: curr})
			return
		}
		// Try keyed diffing for arrays of objects with "id" fields.
		if diffKeyedArray(path, oldSlice, currV, patches) {
			return
		}
		// Fall back to positional diffing.
		minLen := min(len(oldSlice), len(currV))
		for i := 0; i < minLen; i++ {
			diffValues(fmt.Sprintf("%s/%d", path, i), oldSlice[i], currV[i], patches)
		}
		// Append new elements using "-" (RFC 6902 end-of-array token).
		for i := minLen; i < len(currV); i++ {
			*patches = append(*patches, JSONPatch{Op: "add", Path: path + "/-", Value: currV[i]})
		}
		// Remove excess elements from highest index first to preserve indices.
		for i := len(oldSlice) - 1; i >= len(currV); i-- {
			*patches = append(*patches, JSONPatch{Op: "remove", Path: fmt.Sprintf("%s/%d", path, i)})
		}

	default:
		if !primitiveEqual(old, curr) {
			*patches = append(*patches, JSONPatch{Op: "replace", Path: path, Value: curr})
		}
	}
}

// primitiveEqual compares two JSON primitive values (float64, string, bool, nil).
// Safe because diffValues only reaches the default branch for these types.
func primitiveEqual(a, b any) bool {
	switch av := a.(type) {
	case string:
		bv, ok := b.(string)
		return ok && av == bv
	case float64:
		bv, ok := b.(float64)
		return ok && av == bv
	case bool:
		bv, ok := b.(bool)
		return ok && av == bv
	case nil:
		return b == nil
	default:
		return false
	}
}

// diffKeyedArray attempts keyed diffing on arrays of objects that all have an
// "id" field. Returns true if keyed diffing was applied, false to fall back to
// positional diffing.
//
// Keyed diffing matches elements by ID instead of position, so inserting an
// element at index 0 generates one add op instead of N replace ops.
//
// Structural operations are ordered for correct sequential RFC 6902 application:
//  1. Removes: highest old index first (preserves lower indices)
//  2. Adds: lowest new index first (shifts correctly as each is applied)
//  3. Property diffs: at final (new) indices
func diffKeyedArray(path string, old, curr []any, patches *[]JSONPatch) bool {
	oldIDs, oldByID := extractIDMap(old)
	currIDs, currByID := extractIDMap(curr)
	if oldIDs == nil || currIDs == nil {
		return false
	}

	// Check that the relative order of common elements is preserved.
	// If not, elements were reordered — replace the whole array.
	commonOld := filterPresent(oldIDs, currByID)
	commonCurr := filterPresent(currIDs, oldByID)
	if len(commonOld) != len(commonCurr) {
		// Should not happen if maps are consistent, but guard anyway.
		*patches = append(*patches, JSONPatch{Op: "replace", Path: path, Value: curr})
		return true
	}
	for i := range commonOld {
		if commonOld[i] != commonCurr[i] {
			*patches = append(*patches, JSONPatch{Op: "replace", Path: path, Value: curr})
			return true
		}
	}

	// Phase 1: Remove deleted elements (highest old index first).
	for i := len(old) - 1; i >= 0; i-- {
		id := oldIDs[i]
		if _, exists := currByID[id]; !exists {
			*patches = append(*patches, JSONPatch{
				Op:   "remove",
				Path: fmt.Sprintf("%s/%d", path, i),
			})
		}
	}

	// Phase 2: Add new elements (lowest new index first).
	for i, id := range currIDs {
		if _, exists := oldByID[id]; !exists {
			*patches = append(*patches, JSONPatch{
				Op:    "add",
				Path:  fmt.Sprintf("%s/%d", path, i),
				Value: curr[i],
			})
		}
	}

	// Phase 3: Diff common elements at their new indices.
	for i, id := range currIDs {
		if oldVal, exists := oldByID[id]; exists {
			diffValues(fmt.Sprintf("%s/%d", path, i), oldVal, curr[i], patches)
		}
	}

	return true
}

// extractIDMap extracts "id" string values from an array of maps.
// Returns (ids, byID) where ids is the ordered slice of IDs and byID maps
// each ID to its value. Returns (nil, nil) if any element is not a map with
// a string "id" field, or if duplicate IDs are found.
func extractIDMap(arr []any) ([]string, map[string]any) {
	if len(arr) == 0 {
		return nil, nil
	}
	ids := make([]string, 0, len(arr))
	byID := make(map[string]any, len(arr))
	for _, elem := range arr {
		m, ok := elem.(map[string]any)
		if !ok {
			return nil, nil
		}
		idVal, ok := m["id"]
		if !ok {
			return nil, nil
		}
		id, ok := idVal.(string)
		if !ok {
			return nil, nil
		}
		if _, dup := byID[id]; dup {
			return nil, nil
		}
		ids = append(ids, id)
		byID[id] = elem
	}
	return ids, byID
}

// filterPresent returns the subset of ids that exist in the lookup map,
// preserving their original order.
func filterPresent(ids []string, lookup map[string]any) []string {
	out := make([]string, 0, len(ids))
	for _, id := range ids {
		if _, ok := lookup[id]; ok {
			out = append(out, id)
		}
	}
	return out
}

// ptrEscape applies RFC 6901 JSON Pointer escape sequences (~0 for ~, ~1 for /).
func ptrEscape(s string) string {
	s = strings.ReplaceAll(s, "~", "~0")
	s = strings.ReplaceAll(s, "/", "~1")
	return s
}
