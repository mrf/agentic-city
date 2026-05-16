// Package agents maps agentwatch session state onto city Agent structs.
// SessionState is an internal adapter type; monitor.go is responsible for
// translating from agentwatch's real session.SessionState into this type so
// that agentwatch API changes are localised to a single file.
package agents

import (
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/mferree/agent-city/internal/model"
)

// SessionState mirrors the agentwatch session.SessionState fields used by agent-city.
// monitor.go translates from agentwatch's real type into this adapter so the rest of
// the package is insulated from upstream API changes.
type SessionState struct {
	ID                 string
	Source             string  // "claude" | "codex" | "gemini"
	Activity           string  // "idle" | "working" | "waiting" | "terminal"
	Lifecycle          string  // "active" | "terminal"
	Model              string  // e.g. "claude-opus-4-6"
	CurrentTool        string  // e.g. "Edit", "Bash"
	WorkingDir         string  // agent's working directory (root of worktree or project)
	Branch             string  // git branch if detectable
	ContextUtilization float64 // 0.0–1.0
}

// FileEvent represents a file system event observed by the repo watcher.
type FileEvent struct {
	AbsPath string    // absolute filesystem path
	At      time.Time // when the event was observed
}

// agentLocation is the tracker's last-known building placement for a session.
type agentLocation struct {
	buildingID string
	confidence string // "exact" | "inferred" | "district" | "unknown"
	updatedAt  time.Time
}

// Tracker maps agentwatch SessionState objects to city Agent structs.
// It maintains confidence-scored agent-to-building assignments using
// file system events correlated with agent working directories.
//
// All exported methods are safe for concurrent use.
type Tracker struct {
	mu        sync.Mutex
	repoRoot  string
	sessions  map[string]SessionState  // session ID → state
	locations map[string]agentLocation // session ID → last known location
	worktrees map[string]string        // cleaned WorkingDir abs path → session ID
}

// New creates a Tracker for the given repo root.
func New(repoRoot string) *Tracker {
	return &Tracker{
		repoRoot:  filepath.Clean(repoRoot),
		sessions:  make(map[string]SessionState),
		locations: make(map[string]agentLocation),
		worktrees: make(map[string]string),
	}
}

// UpdateSession upserts a session's state. Called by monitor.go when the EventSink
// receives a delta or snapshot event from agentwatch.
func (t *Tracker) UpdateSession(s SessionState) {
	t.mu.Lock()
	defer t.mu.Unlock()

	// Remove stale worktree mapping for this session before updating.
	if old, ok := t.sessions[s.ID]; ok && old.WorkingDir != "" {
		delete(t.worktrees, filepath.Clean(old.WorkingDir))
	}

	t.sessions[s.ID] = s

	if s.WorkingDir != "" {
		t.worktrees[filepath.Clean(s.WorkingDir)] = s.ID
	}
}

// RemoveSession removes a session from tracking. Called by monitor.go when agentwatch
// reports a lifecycle removal.
func (t *Tracker) RemoveSession(id string) {
	t.mu.Lock()
	defer t.mu.Unlock()

	if s, ok := t.sessions[id]; ok && s.WorkingDir != "" {
		delete(t.worktrees, filepath.Clean(s.WorkingDir))
	}
	delete(t.sessions, id)
	delete(t.locations, id)
}

// ObserveFileEvent updates the inferred location for any agent whose working
// directory contains the changed file. Called by the repo watcher on each
// debounced file update.
func (t *Tracker) ObserveFileEvent(ev FileEvent) {
	t.mu.Lock()
	defer t.mu.Unlock()

	sessionID := t.sessionForFile(ev.AbsPath)
	if sessionID == "" {
		return
	}

	rel, err := filepath.Rel(t.repoRoot, ev.AbsPath)
	if err != nil {
		return
	}
	rel = filepath.ToSlash(rel)
	// Discard paths that escape the repo root.
	if strings.HasPrefix(rel, "..") {
		return
	}

	prev, hasPrev := t.locations[sessionID]
	if !hasPrev || ev.At.After(prev.updatedAt) {
		t.locations[sessionID] = agentLocation{
			buildingID: rel,
			confidence: "inferred",
			updatedAt:  ev.At,
		}
	}
}

// Agents returns a snapshot of city Agent structs derived from all currently tracked
// sessions. buildings is the current building list, used to infer district-level location
// when no file event has established a more precise target.
func (t *Tracker) Agents(buildings []model.Building) []model.Agent {
	t.mu.Lock()
	defer t.mu.Unlock()

	agents := make([]model.Agent, 0, len(t.sessions))
	for _, s := range t.sessions {
		agents = append(agents, t.toAgent(s, buildings))
	}
	return agents
}

// toAgent converts a single SessionState to a city Agent. Must be called with t.mu held.
func (t *Tracker) toAgent(s SessionState, buildings []model.Building) model.Agent {
	mode := modeFromActivity(s.Activity, s.Lifecycle)

	a := model.Agent{
		ID:        agentID(s),
		Color:     colorForSource(s.Source),
		Mode:      mode,
		Task:      taskFromSession(s),
		Progress:  progressFromUtilization(s.ContextUtilization),
		ModelTier: tierFromModel(s.Model),
	}

	switch mode {
	case "work":
		t.applyLocation(&a, s, buildings)
	case "error":
		a.ErrorMsg = "terminal state"
	}

	return a
}

// applyLocation fills TargetID and LocationConfidence on a in work mode.
// Priority: file-event location > WorkingDir district inference > unknown.
// Must be called with t.mu held.
func (t *Tracker) applyLocation(a *model.Agent, s SessionState, buildings []model.Building) {
	if loc, ok := t.locations[s.ID]; ok && loc.buildingID != "" {
		a.TargetID = loc.buildingID
		a.LocationConfidence = loc.confidence
		return
	}

	if districtID := t.districtFromWorkingDir(s.WorkingDir, buildings); districtID != "" {
		a.TargetID = districtID
		a.LocationConfidence = "district"
		return
	}

	a.LocationConfidence = "unknown"
}

// sessionForFile returns the session ID whose working directory is the nearest
// ancestor of absPath. If multiple working directories match, the longest one
// (most specific) wins. Returns "" when no session matches.
// Must be called with t.mu held.
func (t *Tracker) sessionForFile(absPath string) string {
	absPath = filepath.Clean(absPath)
	best := ""
	bestLen := 0
	for dir, id := range t.worktrees {
		prefix := dir + string(filepath.Separator)
		if strings.HasPrefix(absPath, prefix) && len(dir) > bestLen {
			best = id
			bestLen = len(dir)
		}
	}
	return best
}

// districtFromWorkingDir attempts to infer a district ID from an agent's working
// directory. If workingDir is within repoRoot, the repo-relative path is compared
// against known district IDs; the longest matching prefix wins.
// Must be called with t.mu held.
func (t *Tracker) districtFromWorkingDir(workingDir string, buildings []model.Building) string {
	if workingDir == "" || t.repoRoot == "" {
		return ""
	}

	rel, err := filepath.Rel(t.repoRoot, filepath.Clean(workingDir))
	if err != nil || strings.HasPrefix(rel, "..") {
		return ""
	}
	rel = filepath.ToSlash(rel)
	if rel == "." {
		return ""
	}

	// Collect unique district IDs and find the best (longest) match.
	seen := make(map[string]bool)
	best := ""
	for _, b := range buildings {
		if b.DistrictID == "" || seen[b.DistrictID] {
			continue
		}
		seen[b.DistrictID] = true
		if rel == b.DistrictID || strings.HasPrefix(rel, b.DistrictID+"/") {
			if len(b.DistrictID) > len(best) {
				best = b.DistrictID
			}
		}
	}
	return best
}

// agentID builds a composite agent ID from source and session ID.
// Format: "<source>:<id>" when source is non-empty, otherwise just "<id>".
func agentID(s SessionState) string {
	if s.Source != "" {
		return s.Source + ":" + s.ID
	}
	return s.ID
}

// colorForSource returns the logical colour name for a given model family.
// The frontend agentColor() function maps these names to solarized-dark hex values.
func colorForSource(source string) string {
	switch strings.ToLower(source) {
	case "claude":
		return "blue"
	case "codex":
		return "green"
	case "gemini":
		return "orange"
	default:
		return "blue"
	}
}

// modeFromActivity maps agentwatch Activity and Lifecycle strings to city Agent mode.
//
//	"working"           → "work"
//	"waiting" | "idle"  → "idle"
//	"terminal" lifecycle or activity → "error"
//	anything else       → "idle"
func modeFromActivity(activity, lifecycle string) string {
	if strings.ToLower(lifecycle) == "terminal" {
		return "error"
	}
	switch strings.ToLower(activity) {
	case "working":
		return "work"
	case "waiting", "idle":
		return "idle"
	case "terminal":
		return "error"
	default:
		return "idle"
	}
}

// tierFromModel parses a model identifier string and returns the capability tier.
// Matches sub-strings case-insensitively. Falls back to "sonnet" when no pattern matches.
//
// Claude: opus > sonnet > haiku
// OpenAI: o3/o4 → opus, gpt → sonnet
// Gemini: pro → opus, flash → haiku
func tierFromModel(model string) string {
	lower := strings.ToLower(model)
	switch {
	case strings.Contains(lower, "opus"):
		return "opus"
	case strings.Contains(lower, "sonnet"):
		return "sonnet"
	case strings.Contains(lower, "haiku"):
		return "haiku"
	case strings.Contains(lower, "o3"), strings.Contains(lower, "o4"):
		return "opus" // OpenAI frontier
	case strings.Contains(lower, "gpt"):
		return "sonnet" // OpenAI mid-tier
	case strings.Contains(lower, "pro"):
		return "opus" // Gemini Pro
	case strings.Contains(lower, "flash"):
		return "haiku" // Gemini Flash
	default:
		return "sonnet"
	}
}

// taskFromSession derives a short task description from session metadata.
// Preference order: CurrentTool → Branch → "".
func taskFromSession(s SessionState) string {
	if s.CurrentTool != "" {
		return s.CurrentTool
	}
	return s.Branch
}

// progressFromUtilization converts context utilization (0.0–1.0) to an integer
// progress value (0–100) clamped to [0, 100].
func progressFromUtilization(utilization float64) int {
	if utilization <= 0 {
		return 0
	}
	if utilization >= 1 {
		return 100
	}
	return int(utilization * 100)
}
