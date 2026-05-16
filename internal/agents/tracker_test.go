package agents

import (
	"path/filepath"
	"testing"
	"time"

	"github.com/mferree/agent-city/internal/model"
)

// ─── tierFromModel ────────────────────────────────────────────────────────────

func TestTierFromModel(t *testing.T) {
	cases := []struct {
		name  string
		model string
		want  string
	}{
		{"claude opus", "claude-opus-4-6", "opus"},
		{"claude sonnet", "claude-sonnet-4-6", "sonnet"},
		{"claude haiku", "claude-haiku-4-5-20251001", "haiku"},
		{"uppercase OPUS", "CLAUDE-OPUS-4", "opus"},
		{"openai o3", "o3-mini", "opus"},
		{"openai o4", "o4-preview", "opus"},
		{"openai gpt4", "gpt-4o", "sonnet"},
		{"gemini pro", "gemini-pro-1.5", "opus"},
		{"gemini flash", "gemini-1.5-flash", "haiku"},
		{"unknown model", "llama-3", "sonnet"},
		{"empty string", "", "sonnet"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := tierFromModel(tc.model)
			if got != tc.want {
				t.Errorf("tierFromModel(%q) = %q, want %q", tc.model, got, tc.want)
			}
		})
	}
}

// ─── modeFromActivity ─────────────────────────────────────────────────────────

func TestModeFromActivity(t *testing.T) {
	cases := []struct {
		name      string
		activity  string
		lifecycle string
		want      string
	}{
		{"working active", "working", "active", "work"},
		{"idle active", "idle", "active", "idle"},
		{"waiting active", "waiting", "active", "idle"},
		{"terminal activity", "terminal", "active", "error"},
		{"terminal lifecycle overrides", "working", "terminal", "error"},
		{"terminal lifecycle idle", "idle", "terminal", "error"},
		{"unknown activity", "thinking", "active", "idle"},
		{"empty activity", "", "active", "idle"},
		{"case insensitive WORKING", "WORKING", "active", "work"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := modeFromActivity(tc.activity, tc.lifecycle)
			if got != tc.want {
				t.Errorf("modeFromActivity(%q, %q) = %q, want %q", tc.activity, tc.lifecycle, got, tc.want)
			}
		})
	}
}

// ─── colorForSource ───────────────────────────────────────────────────────────

func TestColorForSource(t *testing.T) {
	cases := []struct {
		source string
		want   string
	}{
		{"claude", "blue"},
		{"CLAUDE", "blue"},
		{"codex", "green"},
		{"gemini", "orange"},
		{"unknown", "blue"},
		{"", "blue"},
	}

	for _, tc := range cases {
		t.Run(tc.source, func(t *testing.T) {
			got := colorForSource(tc.source)
			if got != tc.want {
				t.Errorf("colorForSource(%q) = %q, want %q", tc.source, got, tc.want)
			}
		})
	}
}

// ─── progressFromUtilization ──────────────────────────────────────────────────

func TestProgressFromUtilization(t *testing.T) {
	cases := []struct {
		util float64
		want int
	}{
		{0.0, 0},
		{0.45, 45},
		{1.0, 100},
		{-0.5, 0},   // clamp negative
		{1.5, 100},  // clamp over 1
		{0.999, 99}, // truncated, not rounded
	}

	for _, tc := range cases {
		got := progressFromUtilization(tc.util)
		if got != tc.want {
			t.Errorf("progressFromUtilization(%v) = %d, want %d", tc.util, got, tc.want)
		}
	}
}

// ─── agentID ──────────────────────────────────────────────────────────────────

func TestAgentID(t *testing.T) {
	cases := []struct {
		s    SessionState
		want string
	}{
		{SessionState{ID: "abc123", Source: "claude"}, "claude:abc123"},
		{SessionState{ID: "xyz", Source: "codex"}, "codex:xyz"},
		{SessionState{ID: "no-source", Source: ""}, "no-source"},
	}

	for _, tc := range cases {
		got := agentID(tc.s)
		if got != tc.want {
			t.Errorf("agentID(%+v) = %q, want %q", tc.s, got, tc.want)
		}
	}
}

// ─── taskFromSession ──────────────────────────────────────────────────────────

func TestTaskFromSession(t *testing.T) {
	cases := []struct {
		name string
		s    SessionState
		want string
	}{
		{"current tool preferred", SessionState{CurrentTool: "Edit", Branch: "feat/auth"}, "Edit"},
		{"branch fallback", SessionState{CurrentTool: "", Branch: "fix/race"}, "fix/race"},
		{"both empty", SessionState{}, ""},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := taskFromSession(tc.s)
			if got != tc.want {
				t.Errorf("taskFromSession(%+v) = %q, want %q", tc.s, got, tc.want)
			}
		})
	}
}

// ─── Tracker.UpdateSession / RemoveSession ────────────────────────────────────

func TestTrackerUpdateAndRemove(t *testing.T) {
	tr := New("/repo")

	s := SessionState{ID: "s1", Source: "claude", Activity: "working", Lifecycle: "active"}
	tr.UpdateSession(s)

	tr.mu.Lock()
	_, ok := tr.sessions["s1"]
	tr.mu.Unlock()
	if !ok {
		t.Fatal("session s1 not found after UpdateSession")
	}

	tr.RemoveSession("s1")

	tr.mu.Lock()
	_, ok = tr.sessions["s1"]
	tr.mu.Unlock()
	if ok {
		t.Fatal("session s1 still present after RemoveSession")
	}
}

func TestTrackerUpdateChangesWorkingDir(t *testing.T) {
	tr := New("/repo")

	s1 := SessionState{ID: "s1", WorkingDir: "/worktrees/wt1"}
	tr.UpdateSession(s1)

	// Update with a different working dir — old entry must be removed.
	s2 := SessionState{ID: "s1", WorkingDir: "/worktrees/wt2"}
	tr.UpdateSession(s2)

	tr.mu.Lock()
	_, hadOld := tr.worktrees[filepath.Clean("/worktrees/wt1")]
	_, hasNew := tr.worktrees[filepath.Clean("/worktrees/wt2")]
	tr.mu.Unlock()

	if hadOld {
		t.Error("old worktree mapping not removed after WorkingDir change")
	}
	if !hasNew {
		t.Error("new worktree mapping not registered after WorkingDir change")
	}
}

// ─── Tracker.ObserveFileEvent ─────────────────────────────────────────────────

func TestObserveFileEventSetsInferredLocation(t *testing.T) {
	repoRoot := "/repo"
	tr := New(repoRoot)

	tr.UpdateSession(SessionState{
		ID:         "s1",
		Source:     "claude",
		WorkingDir: repoRoot, // agent working in the repo root
		Activity:   "working",
		Lifecycle:  "active",
	})

	ev := FileEvent{
		AbsPath: filepath.Join(repoRoot, "internal", "agents", "tracker.go"),
		At:      time.Now(),
	}
	tr.ObserveFileEvent(ev)

	tr.mu.Lock()
	loc, ok := tr.locations["s1"]
	tr.mu.Unlock()

	if !ok {
		t.Fatal("no location recorded after file event")
	}
	if loc.confidence != "inferred" {
		t.Errorf("confidence = %q, want %q", loc.confidence, "inferred")
	}
	wantBuildingID := "internal/agents/tracker.go"
	if loc.buildingID != wantBuildingID {
		t.Errorf("buildingID = %q, want %q", loc.buildingID, wantBuildingID)
	}
}

func TestObserveFileEventUnmatchedDir(t *testing.T) {
	tr := New("/repo")
	tr.UpdateSession(SessionState{
		ID:         "s1",
		WorkingDir: "/other-repo",
	})

	// File in /repo shouldn't match a session working in /other-repo.
	tr.ObserveFileEvent(FileEvent{
		AbsPath: "/repo/main.go",
		At:      time.Now(),
	})

	tr.mu.Lock()
	_, ok := tr.locations["s1"]
	tr.mu.Unlock()

	if ok {
		t.Error("location should not be set when file is outside session worktree")
	}
}

func TestObserveFileEventNewerEventWins(t *testing.T) {
	repoRoot := "/repo"
	tr := New(repoRoot)
	tr.UpdateSession(SessionState{ID: "s1", WorkingDir: repoRoot, Activity: "working"})

	t1 := time.Now()
	t2 := t1.Add(time.Second)

	tr.ObserveFileEvent(FileEvent{AbsPath: repoRoot + "/a.go", At: t2})
	tr.ObserveFileEvent(FileEvent{AbsPath: repoRoot + "/b.go", At: t1}) // older — must not overwrite

	tr.mu.Lock()
	loc := tr.locations["s1"]
	tr.mu.Unlock()

	if loc.buildingID != "a.go" {
		t.Errorf("buildingID = %q, want %q (newer event should win)", loc.buildingID, "a.go")
	}
}

// ─── Tracker.Agents ───────────────────────────────────────────────────────────

func TestAgentsWorkModeWithFileEvent(t *testing.T) {
	repoRoot := "/repo"
	tr := New(repoRoot)
	tr.UpdateSession(SessionState{
		ID:                 "sess1",
		Source:             "claude",
		Model:              "claude-sonnet-4-6",
		Activity:           "working",
		Lifecycle:          "active",
		WorkingDir:         repoRoot,
		ContextUtilization: 0.6,
		CurrentTool:        "Edit",
	})
	tr.ObserveFileEvent(FileEvent{
		AbsPath: filepath.Join(repoRoot, "internal", "model", "model.go"),
		At:      time.Now(),
	})

	buildings := []model.Building{
		{ID: "internal/model/model.go", DistrictID: "internal/model"},
	}

	agents := tr.Agents(buildings)
	if len(agents) != 1 {
		t.Fatalf("expected 1 agent, got %d", len(agents))
	}
	a := agents[0]

	if a.ID != "claude:sess1" {
		t.Errorf("ID = %q, want %q", a.ID, "claude:sess1")
	}
	if a.Mode != "work" {
		t.Errorf("Mode = %q, want %q", a.Mode, "work")
	}
	if a.TargetID != "internal/model/model.go" {
		t.Errorf("TargetID = %q, want %q", a.TargetID, "internal/model/model.go")
	}
	if a.LocationConfidence != "inferred" {
		t.Errorf("LocationConfidence = %q, want %q", a.LocationConfidence, "inferred")
	}
	if a.ModelTier != "sonnet" {
		t.Errorf("ModelTier = %q, want %q", a.ModelTier, "sonnet")
	}
	if a.Progress != 60 {
		t.Errorf("Progress = %d, want 60", a.Progress)
	}
	if a.Color != "blue" {
		t.Errorf("Color = %q, want %q", a.Color, "blue")
	}
}

func TestAgentsWorkModeDistrictFallback(t *testing.T) {
	repoRoot := "/repo"
	tr := New(repoRoot)
	tr.UpdateSession(SessionState{
		ID:         "sess2",
		Source:     "codex",
		Activity:   "working",
		Lifecycle:  "active",
		WorkingDir: filepath.Join(repoRoot, "internal/hub"),
	})

	buildings := []model.Building{
		{ID: "internal/hub/hub.go", DistrictID: "internal/hub"},
		{ID: "internal/hub/state.go", DistrictID: "internal/hub"},
	}

	agents := tr.Agents(buildings)
	if len(agents) != 1 {
		t.Fatalf("expected 1 agent, got %d", len(agents))
	}
	a := agents[0]

	if a.LocationConfidence != "district" {
		t.Errorf("LocationConfidence = %q, want %q", a.LocationConfidence, "district")
	}
	if a.TargetID != "internal/hub" {
		t.Errorf("TargetID = %q, want %q", a.TargetID, "internal/hub")
	}
}

func TestAgentsWorkModeUnknownFallback(t *testing.T) {
	tr := New("/repo")
	tr.UpdateSession(SessionState{
		ID:         "sess3",
		Activity:   "working",
		Lifecycle:  "active",
		WorkingDir: "/completely/different/path",
	})

	agents := tr.Agents(nil)
	if len(agents) != 1 {
		t.Fatalf("expected 1 agent, got %d", len(agents))
	}
	a := agents[0]

	if a.LocationConfidence != "unknown" {
		t.Errorf("LocationConfidence = %q, want %q", a.LocationConfidence, "unknown")
	}
	if a.TargetID != "" {
		t.Errorf("TargetID = %q, want empty", a.TargetID)
	}
}

func TestAgentsIdleMode(t *testing.T) {
	tr := New("/repo")
	tr.UpdateSession(SessionState{
		ID:        "sess4",
		Source:    "gemini",
		Activity:  "idle",
		Lifecycle: "active",
		Model:     "gemini-1.5-flash",
	})

	agents := tr.Agents(nil)
	if len(agents) != 1 {
		t.Fatalf("expected 1 agent, got %d", len(agents))
	}
	a := agents[0]

	if a.Mode != "idle" {
		t.Errorf("Mode = %q, want %q", a.Mode, "idle")
	}
	if a.ModelTier != "haiku" {
		t.Errorf("ModelTier = %q, want %q", a.ModelTier, "haiku")
	}
	if a.Color != "orange" {
		t.Errorf("Color = %q, want %q (gemini orange)", a.Color, "orange")
	}
}

func TestAgentsTerminalLifecycle(t *testing.T) {
	tr := New("/repo")
	tr.UpdateSession(SessionState{
		ID:        "sess5",
		Activity:  "working",
		Lifecycle: "terminal",
	})

	agents := tr.Agents(nil)
	if len(agents) != 1 {
		t.Fatalf("expected 1 agent, got %d", len(agents))
	}
	a := agents[0]

	if a.Mode != "error" {
		t.Errorf("Mode = %q, want %q", a.Mode, "error")
	}
	if a.ErrorMsg == "" {
		t.Error("ErrorMsg should be set for terminal lifecycle")
	}
}

func TestAgentsEmptyWhenNoSessions(t *testing.T) {
	tr := New("/repo")
	agents := tr.Agents(nil)
	if len(agents) != 0 {
		t.Errorf("expected 0 agents, got %d", len(agents))
	}
}

func TestAgentsMultipleSessions(t *testing.T) {
	repoRoot := "/repo"
	tr := New(repoRoot)

	for _, s := range []SessionState{
		{ID: "a", Source: "claude", Activity: "working", Lifecycle: "active"},
		{ID: "b", Source: "codex", Activity: "idle", Lifecycle: "active"},
		{ID: "c", Source: "gemini", Activity: "working", Lifecycle: "terminal"},
	} {
		tr.UpdateSession(s)
	}

	agents := tr.Agents(nil)
	if len(agents) != 3 {
		t.Errorf("expected 3 agents, got %d", len(agents))
	}
}
