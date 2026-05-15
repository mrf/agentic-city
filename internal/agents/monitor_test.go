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
		{"claude", "#4a7a9c"},
		{"codex", "#6a8a4a"},
		{"gemini", "#b06a3a"},
		{"unknown", "#657b83"},
		{"", "#657b83"},
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
		"claude:c1": {Color: "#4a7a9c", Mode: "work"},
		"codex:x1":  {Color: "#6a8a4a", Mode: "idle"},
		"gemini:g1": {Color: "#b06a3a", Mode: "idle"},
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
