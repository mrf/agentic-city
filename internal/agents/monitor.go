// Package agents implements the agentwatch integration for agent-city.
//
// StartMonitor configures Claude Code, Codex, and Gemini CLI sources,
// creates a monitor.Monitor, and runs a goroutine that bridges session
// state changes into the city's agent roster.
package agents

import (
	"context"
	"errors"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/mferree/agent-city/internal/hub"
	"github.com/mferree/agent-city/internal/model"
	"github.com/mrf/agentwatch/monitor"
	"github.com/mrf/agentwatch/session"
	"github.com/mrf/agentwatch/source"
	"github.com/mrf/agentwatch/sources/claude"
	"github.com/mrf/agentwatch/sources/codex"
	"github.com/mrf/agentwatch/sources/gemini"
)

// StartMonitor configures agentwatch sources (Claude, Codex, Gemini),
// creates a monitor.Monitor, and starts a goroutine that bridges session
// state changes into the Agents slice of cityState.
//
// Graceful degradation: if no agent tool directories are present on the local
// machine, the function returns without starting a goroutine; the city renders
// without agents until sessions are discovered on a subsequent restart.
//
// The goroutine runs until ctx is canceled.
func StartMonitor(ctx context.Context, repoPath string, cityState *hub.State, h *hub.Hub) {
	absRepo, absErr := filepath.Abs(repoPath)
	if absErr != nil {
		slog.Error("agents: cannot resolve repo path", "path", repoPath, "err", absErr)
		return
	}

	sources := buildSources()
	if len(sources) == 0 {
		slog.Info("agents: no agentwatch sources found — city will render without agents")
		return
	}

	// mon is declared before the closure so the closure captures a reference to
	// the variable; by the time the closure is called (inside mon.Run), mon is
	// fully initialised.
	var mon *monitor.Monitor

	sink := monitor.EventSinkFunc(func(_ context.Context, ev monitor.Event) error {
		if ev.Type != monitor.EventDelta && ev.Type != monitor.EventLifecycle {
			return nil
		}
		sessions := mon.Snapshot()
		agents := sessionsToAgents(sessions, absRepo)
		curr := cityState.GetState()
		curr.Agents = agents
		cityState.SetState(curr)
		if h != nil {
			h.Notify()
		}
		return nil
	})

	var err error
	mon, err = monitor.New(
		monitor.WithSources(sources...),
		monitor.WithSink(sink),
		monitor.WithPollInterval(2*time.Second),
	)
	if err != nil {
		slog.Error("agents: monitor create failed", "err", err)
		return
	}

	go func() {
		if runErr := mon.Run(ctx); runErr != nil && !errors.Is(runErr, context.Canceled) {
			slog.Error("agents: monitor stopped unexpectedly", "err", runErr)
		}
	}()

	slog.Info("agents: monitor started", "sources", mon.Sources())
}

// buildSources discovers available agent tool directories and returns
// configured agentwatch sources for each tool found.
// Missing directories are skipped silently; only successful initialisations
// are included in the returned slice.
func buildSources() []source.Source {
	home, err := os.UserHomeDir()
	if err != nil {
		slog.Warn("agents: cannot determine home directory", "err", err)
		return nil
	}

	var sources []source.Source

	// Claude Code: ~/.claude/projects
	claudeRoot := filepath.Join(home, ".claude", "projects")
	if _, statErr := os.Stat(claudeRoot); statErr == nil {
		src, newErr := claude.New(claude.WithRoot(claudeRoot))
		if newErr != nil {
			slog.Warn("agents: claude source init failed", "err", newErr)
		} else {
			sources = append(sources, src)
			slog.Info("agents: claude source configured", "root", claudeRoot)
		}
	}

	// Codex CLI: $CODEX_HOME or ~/.codex
	codexRoot := os.Getenv("CODEX_HOME")
	if codexRoot == "" {
		codexRoot = filepath.Join(home, ".codex")
	}
	if _, statErr := os.Stat(codexRoot); statErr == nil {
		sources = append(sources, codex.New(codex.WithRoot(codexRoot)))
		slog.Info("agents: codex source configured", "root", codexRoot)
	}

	// Gemini CLI: ~/.gemini/tmp
	geminiRoot := filepath.Join(home, ".gemini", "tmp")
	if _, statErr := os.Stat(geminiRoot); statErr == nil {
		src, newErr := gemini.New(gemini.WithRoot(geminiRoot))
		if newErr != nil {
			slog.Warn("agents: gemini source init failed", "err", newErr)
		} else {
			sources = append(sources, src)
			slog.Info("agents: gemini source configured", "root", geminiRoot)
		}
	}

	return sources
}

// sessionsToAgents converts a slice of agentwatch SessionState values to
// city model.Agent values. Terminal sessions and sessions whose WorkingDir
// is not under repoPath are excluded; the city roster reflects only active
// sessions for the target repository. An empty slice is returned (not nil)
// when no matching sessions exist.
func sessionsToAgents(sessions []session.SessionState, repoPath string) []model.Agent {
	agents := make([]model.Agent, 0, len(sessions))
	for i := range sessions {
		if sessions[i].Lifecycle == session.LifecycleTerminal {
			continue
		}
		if !strings.HasPrefix(sessions[i].WorkingDir, repoPath) {
			continue
		}
		agents = append(agents, sessionToAgent(sessions[i]))
	}
	return agents
}

// sessionToAgent maps a single SessionState to a model.Agent.
// Active sessions are shown in "idle" mode; specific file targeting is left
// for future work once working-directory-to-building mapping is implemented.
func sessionToAgent(s session.SessionState) model.Agent {
	return model.Agent{
		ID:        s.Source + ":" + s.ID,
		Color:     sourceColor(s.Source),
		Mode:      agentMode(s.Activity),
		Task:      agentTask(s),
		Progress:  int(s.ContextUtilization * 100),
		ModelTier: modelTier(s.Model),
	}
}

// agentMode maps a session Activity to a city Agent mode string.
// "working" maps to "work"; all other activities map to "idle".
// Location fields (TargetID, LocationConfidence) are left to callers who
// can supply building context.
func agentMode(a session.Activity) string {
	if a == session.ActivityWorking {
		return "work"
	}
	return "idle"
}

// agentTask returns a short human-readable description of what the session
// is doing. Preference order: slug → current tool → activity string.
func agentTask(s session.SessionState) string {
	if s.Slug != "" {
		return s.Slug
	}
	if s.CurrentTool != "" {
		return s.CurrentTool
	}
	return string(s.Activity)
}

// sourceColor maps an agentwatch source name to a display colour.
// Colours match the solarized-dark palette used across the city UI.
func sourceColor(src string) string {
	switch src {
	case "claude":
		return "#4a7a9c" // blue
	case "codex":
		return "#6a8a4a" // green
	case "gemini":
		return "#b06a3a" // orange
	default:
		return "#657b83" // solarized base00 (grey)
	}
}

// modelTier maps a model name string to a display tier for the city HUD.
// Matching is substring-based so it handles full model IDs such as
// "claude-sonnet-4-6" or "gemini-1.5-pro".
func modelTier(m string) string {
	lower := strings.ToLower(m)
	switch {
	case strings.Contains(lower, "opus"):
		return "opus"
	case strings.Contains(lower, "sonnet"):
		return "sonnet"
	case strings.Contains(lower, "haiku"):
		return "haiku"
	default:
		return "unknown"
	}
}
