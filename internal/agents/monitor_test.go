package agents

import (
	"testing"

	"github.com/mferree/agent-city/internal/model"
	"github.com/mrf/agentwatch/session"
)

func TestSessionsToAgents_filtersTerminal(t *testing.T) {
	sessions := []session.SessionState{
		{ID: "a1", Source: "claude", Lifecycle: session.LifecycleActive, Activity: session.ActivityIdle},
		{ID: "a2", Source: "codex", Lifecycle: session.LifecycleTerminal, Activity: session.ActivityIdle},
		{ID: "a3", Source: "gemini", Lifecycle: session.LifecycleActive, Activity: session.ActivityWorking},
	}

	got := sessionsToAgents(sessions, "")

	if len(got) != 2 {
		t.Fatalf("got %d agents, want 2", len(got))
	}
	for _, a := range got {
		if a.ID == "codex:a2" {
			t.Errorf("terminal session should be excluded but found %s", a.ID)
		}
	}
}

func TestSessionsToAgents_emptyReturnsEmpty(t *testing.T) {
	got := sessionsToAgents(nil, "")
	if got == nil {
		t.Error("sessionsToAgents(nil) returned nil, want empty slice")
	}
	if len(got) != 0 {
		t.Errorf("got %d agents, want 0", len(got))
	}
}

func TestSessionToAgent_idFormat(t *testing.T) {
	s := session.SessionState{
		ID:        "sess-001",
		Source:    "claude",
		Lifecycle: session.LifecycleActive,
		Activity:  session.ActivityIdle,
	}
	a := sessionToAgent(s)
	if a.ID != "claude:sess-001" {
		t.Errorf("ID = %q, want %q", a.ID, "claude:sess-001")
	}
}

func TestSessionToAgent_progressClamped(t *testing.T) {
	cases := []struct {
		utilization float64
		wantPct     int
	}{
		{0.0, 0},
		{0.5, 50},
		{1.0, 100},
		{0.753, 75},
	}
	for _, tc := range cases {
		s := session.SessionState{
			Source:             "claude",
			Lifecycle:          session.LifecycleActive,
			ContextUtilization: tc.utilization,
		}
		got := sessionToAgent(s).Progress
		if got != tc.wantPct {
			t.Errorf("utilization=%.3f: Progress=%d, want %d", tc.utilization, got, tc.wantPct)
		}
	}
}

func TestAgentMode(t *testing.T) {
	cases := []struct {
		activity session.Activity
		want     string
	}{
		{session.ActivityWorking, "work"},
		{session.ActivityIdle, "idle"},
		{session.ActivityWaiting, "idle"},
		{session.ActivityTerminal, "idle"},
		{"unknown-future-value", "idle"},
	}
	for _, tc := range cases {
		got := agentMode(tc.activity)
		if got != tc.want {
			t.Errorf("agentMode(%q) = %q, want %q", tc.activity, got, tc.want)
		}
	}
}

func TestAgentTask_preferenceOrder(t *testing.T) {
	cases := []struct {
		name        string
		s           session.SessionState
		wantContain string
	}{
		{
			name:        "slug preferred over tool",
			s:           session.SessionState{Slug: "fix-auth-bug", CurrentTool: "Bash", Activity: session.ActivityWorking},
			wantContain: "fix-auth-bug",
		},
		{
			name:        "tool preferred over activity",
			s:           session.SessionState{CurrentTool: "Read", Activity: session.ActivityWorking},
			wantContain: "Read",
		},
		{
			name:        "activity as fallback",
			s:           session.SessionState{Activity: session.ActivityIdle},
			wantContain: "idle",
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := agentTask(tc.s)
			if got != tc.wantContain {
				t.Errorf("agentTask() = %q, want %q", got, tc.wantContain)
			}
		})
	}
}

func TestSourceColor(t *testing.T) {
	cases := []struct {
		source string
		want   string
	}{
		{"claude", "blue"},
		{"codex", "green"},
		{"gemini", "orange"},
		{"unknown", "grey"},
		{"", "grey"},
	}
	for _, tc := range cases {
		got := sourceColor(tc.source)
		if got != tc.want {
			t.Errorf("sourceColor(%q) = %q, want %q", tc.source, got, tc.want)
		}
	}
}

func TestModelTier(t *testing.T) {
	cases := []struct {
		model string
		want  string
	}{
		{"claude-opus-4-6", "opus"},
		{"claude-sonnet-4-6", "sonnet"},
		{"claude-haiku-4-5-20251001", "haiku"},
		{"gpt-4o", "unknown"},
		{"", "unknown"},
		{"CLAUDE-OPUS-3", "opus"},    // case-insensitive
		{"Claude-Sonnet-3-7", "sonnet"}, // mixed case
	}
	for _, tc := range cases {
		got := modelTier(tc.model)
		if got != tc.want {
			t.Errorf("modelTier(%q) = %q, want %q", tc.model, got, tc.want)
		}
	}
}

func TestSessionsToAgents_colorAndMode(t *testing.T) {
	sessions := []session.SessionState{
		{ID: "c1", Source: "claude", Lifecycle: session.LifecycleActive, Activity: session.ActivityWorking},
		{ID: "x1", Source: "codex", Lifecycle: session.LifecycleActive, Activity: session.ActivityIdle},
		{ID: "g1", Source: "gemini", Lifecycle: session.LifecycleActive, Activity: session.ActivityWaiting},
	}

	agents := sessionsToAgents(sessions, "")

	wantByID := map[string]model.Agent{
		"claude:c1": {Color: "blue", Mode: "work"},
		"codex:x1":  {Color: "green", Mode: "idle"},
		"gemini:g1": {Color: "orange", Mode: "idle"},
	}

	if len(agents) != len(wantByID) {
		t.Fatalf("got %d agents, want %d", len(agents), len(wantByID))
	}

	for _, a := range agents {
		want, ok := wantByID[a.ID]
		if !ok {
			t.Errorf("unexpected agent ID %q", a.ID)
			continue
		}
		if a.Color != want.Color {
			t.Errorf("%s: Color=%q, want %q", a.ID, a.Color, want.Color)
		}
		if a.Mode != want.Mode {
			t.Errorf("%s: Mode=%q, want %q", a.ID, a.Mode, want.Mode)
		}
	}
}

func TestSessionsToAgents_filtersWorkingDir(t *testing.T) {
	sessions := []session.SessionState{
		{ID: "a1", Source: "claude", Lifecycle: session.LifecycleActive, WorkingDir: "/home/user/myrepo"},
		{ID: "a2", Source: "claude", Lifecycle: session.LifecycleActive, WorkingDir: "/home/user/myrepo/.claude/worktrees/fix-bug"},
		{ID: "a3", Source: "claude", Lifecycle: session.LifecycleActive, WorkingDir: "/home/user/other-project"},
		{ID: "a4", Source: "codex", Lifecycle: session.LifecycleActive, WorkingDir: "/tmp/scratch"},
	}

	got := sessionsToAgents(sessions, "/home/user/myrepo")
	if len(got) != 2 {
		t.Fatalf("got %d agents, want 2 (only sessions under /home/user/myrepo)", len(got))
	}
	ids := map[string]bool{}
	for _, a := range got {
		ids[a.ID] = true
	}
	if !ids["claude:a1"] || !ids["claude:a2"] {
		t.Errorf("expected claude:a1 and claude:a2, got %v", ids)
	}
}

func TestSyncTracker_updatesAndRemovesTerminal(t *testing.T) {
	tracker := New("/home/user/myrepo")

	sessions := []session.SessionState{
		{ID: "a1", Source: "claude", Lifecycle: session.LifecycleActive, Activity: session.ActivityWorking, WorkingDir: "/home/user/myrepo"},
		{ID: "a2", Source: "codex", Lifecycle: session.LifecycleActive, Activity: session.ActivityIdle, WorkingDir: "/home/user/myrepo/subdir"},
		{ID: "a3", Source: "gemini", Lifecycle: session.LifecycleTerminal, Activity: session.ActivityTerminal, WorkingDir: "/home/user/myrepo"},
		{ID: "a4", Source: "claude", Lifecycle: session.LifecycleActive, Activity: session.ActivityWorking, WorkingDir: "/other/repo"},
	}

	syncTracker(tracker, sessions, "/home/user/myrepo")

	tracker.mu.Lock()
	defer tracker.mu.Unlock()

	// a1 and a2 should be tracked (active + under repoPath)
	if _, ok := tracker.sessions["claude:a1"]; !ok {
		t.Error("session claude:a1 should be tracked")
	}
	if _, ok := tracker.sessions["codex:a2"]; !ok {
		t.Error("session codex:a2 should be tracked")
	}
	// a3 (terminal) should be removed
	if _, ok := tracker.sessions["gemini:a3"]; ok {
		t.Error("terminal session gemini:a3 should be removed")
	}
	// a4 is under a different repo, should not be tracked
	if _, ok := tracker.sessions["claude:a4"]; ok {
		t.Error("session claude:a4 (different repo) should not be tracked")
	}
}

// TestSyncTracker_removesStaleSessionsOnWorkingDirChange reproduces the UFO count
// inflation bug: a session that was previously tracked under repoPath must be removed
// from the tracker when its WorkingDir moves to a different repo, not left as a phantom.
func TestSyncTracker_removesStaleSessionsOnWorkingDirChange(t *testing.T) {
	tracker := New("/home/user/myrepo")

	// First sync: session is active under repoPath — gets tracked.
	syncTracker(tracker, []session.SessionState{
		{ID: "s1", Source: "claude", Lifecycle: session.LifecycleActive, Activity: session.ActivityWorking, WorkingDir: "/home/user/myrepo"},
	}, "/home/user/myrepo")

	tracker.mu.Lock()
	if _, ok := tracker.sessions["claude:s1"]; !ok {
		tracker.mu.Unlock()
		t.Fatal("setup: claude:s1 should be tracked after first sync")
	}
	tracker.mu.Unlock()

	// Second sync: same session now reports a different WorkingDir — must be evicted.
	syncTracker(tracker, []session.SessionState{
		{ID: "s1", Source: "claude", Lifecycle: session.LifecycleActive, Activity: session.ActivityWorking, WorkingDir: "/home/user/other-project"},
	}, "/home/user/myrepo")

	tracker.mu.Lock()
	defer tracker.mu.Unlock()
	if _, ok := tracker.sessions["claude:s1"]; ok {
		t.Error("stale session claude:s1 should have been removed when WorkingDir moved outside repoPath")
	}
}

func TestAwToSessionState_fieldsMapCorrectly(t *testing.T) {
	input := session.SessionState{
		ID:                 "sess-123",
		Source:             "claude",
		Activity:           session.ActivityWorking,
		Lifecycle:          session.LifecycleActive,
		Model:              "claude-opus-4-6",
		CurrentTool:        "Edit",
		WorkingDir:         "/home/user/myrepo",
		Branch:             "feature/foo",
		ContextUtilization: 0.75,
	}

	got := awToSessionState(input)

	if got.ID != "claude:sess-123" {
		t.Errorf("ID = %q, want %q", got.ID, "claude:sess-123")
	}
	if got.Source != "claude" {
		t.Errorf("Source = %q, want %q", got.Source, "claude")
	}
	if got.Activity != "working" {
		t.Errorf("Activity = %q, want %q", got.Activity, "working")
	}
	if got.Lifecycle != "active" {
		t.Errorf("Lifecycle = %q, want %q", got.Lifecycle, "active")
	}
	if got.Model != "claude-opus-4-6" {
		t.Errorf("Model = %q, want %q", got.Model, "claude-opus-4-6")
	}
	if got.CurrentTool != "Edit" {
		t.Errorf("CurrentTool = %q, want %q", got.CurrentTool, "Edit")
	}
	if got.WorkingDir != "/home/user/myrepo" {
		t.Errorf("WorkingDir = %q, want %q", got.WorkingDir, "/home/user/myrepo")
	}
	if got.Branch != "feature/foo" {
		t.Errorf("Branch = %q, want %q", got.Branch, "feature/foo")
	}
	if got.ContextUtilization != 0.75 {
		t.Errorf("ContextUtilization = %v, want %v", got.ContextUtilization, 0.75)
	}
}
