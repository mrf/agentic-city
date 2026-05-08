package hub

import (
	"encoding/json"
	"fmt"
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
type State struct {
	mu    sync.RWMutex
	state model.CityState
}

// NewState returns a State initialised with s.
func NewState(s model.CityState) *State {
	return &State{state: s}
}

// GetState returns a copy of the current CityState. Thread-safe.
func (s *State) GetState() model.CityState {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.state
}

// SetState replaces the current CityState. Thread-safe.
func (s *State) SetState(next model.CityState) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.state = next
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

func primitiveEqual(a, b any) bool {
	aj, _ := json.Marshal(a)
	bj, _ := json.Marshal(b)
	return string(aj) == string(bj)
}

// ptrEscape applies RFC 6901 JSON Pointer escape sequences (~0 for ~, ~1 for /).
func ptrEscape(s string) string {
	s = strings.ReplaceAll(s, "~", "~0")
	s = strings.ReplaceAll(s, "/", "~1")
	return s
}
