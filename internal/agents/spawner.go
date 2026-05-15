// Package agents implements agent session spawning and lifecycle management.
package agents

import (
	"fmt"
	"log/slog"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
)

// SpawnRequest describes the parameters for spawning an agent session.
type SpawnRequest struct {
	Slug         string   `json:"slug"`
	Role         string   `json:"role"`
	Scope        []string `json:"scope"`
	Instructions string   `json:"instructions"`
}

// SpawnResult is the outcome of a successful spawn.
type SpawnResult struct {
	Slug        string `json:"slug"`
	Branch      string `json:"branch"`
	WorktreeDir string `json:"worktreeDir"`
}

// CommandRunner abstracts shell command execution for testability.
type CommandRunner interface {
	// Run executes a command in dir and returns combined stdout+stderr.
	Run(dir string, name string, args ...string) ([]byte, error)
	// LookPath checks whether a binary is on PATH.
	LookPath(name string) error
}

// execRunner implements CommandRunner using os/exec.
type execRunner struct{}

func (execRunner) Run(dir string, name string, args ...string) ([]byte, error) {
	cmd := exec.Command(name, args...)
	cmd.Dir = dir
	return cmd.CombinedOutput()
}

func (execRunner) LookPath(name string) error {
	_, err := exec.LookPath(name)
	return err
}

// Spawner manages agent session creation via worktree + tmux + CLI.
type Spawner struct {
	repoPath string
	runner   CommandRunner
}

// NewSpawner creates a Spawner for the given repository path.
func NewSpawner(repoPath string) *Spawner {
	return &Spawner{repoPath: repoPath, runner: execRunner{}}
}

// NewSpawnerWithRunner creates a Spawner with a custom CommandRunner (for testing).
func NewSpawnerWithRunner(repoPath string, runner CommandRunner) *Spawner {
	return &Spawner{repoPath: repoPath, runner: runner}
}

var slugPattern = regexp.MustCompile(`^[a-z0-9]([a-z0-9-]*[a-z0-9])?$`)

// Validate checks all preconditions for spawning an agent.
func (s *Spawner) Validate(req SpawnRequest) error {
	if err := validateSlug(req.Slug); err != nil {
		return err
	}

	for _, bin := range []string{"claude", "tmux", "git"} {
		if err := s.runner.LookPath(bin); err != nil {
			return fmt.Errorf("%s not found on PATH: %w", bin, err)
		}
	}

	out, err := s.runner.Run(s.repoPath, "git", "status", "--porcelain")
	if err != nil {
		return fmt.Errorf("git status failed: %w", err)
	}
	if len(strings.TrimSpace(string(out))) > 0 {
		return fmt.Errorf("repository has uncommitted changes")
	}

	branch := "worktree-" + req.Slug
	_, err = s.runner.Run(s.repoPath, "git", "rev-parse", "--verify", branch)
	if err == nil {
		return fmt.Errorf("branch %q already exists", branch)
	}

	wtDir := filepath.Join(s.repoPath, ".claude", "worktrees", req.Slug)
	_, err = s.runner.Run(wtDir, "test", "-d", wtDir)
	if err == nil {
		return fmt.Errorf("worktree directory already exists: %s", wtDir)
	}

	return nil
}

// validateSlug checks slug format rules.
func validateSlug(slug string) error {
	if slug == "" {
		return fmt.Errorf("slug is required")
	}
	if len(slug) > 50 {
		return fmt.Errorf("slug must be 50 characters or fewer")
	}
	if !slugPattern.MatchString(slug) {
		return fmt.Errorf("slug must be lowercase alphanumeric with hyphens, no leading/trailing hyphens")
	}
	return nil
}

// Spawn creates a git worktree, tmux window, and claude session.
// On any step failure, previously created resources are rolled back.
func (s *Spawner) Spawn(req SpawnRequest) (SpawnResult, error) {
	if err := s.Validate(req); err != nil {
		return SpawnResult{}, err
	}

	branch := "worktree-" + req.Slug
	wtDir := filepath.Join(s.repoPath, ".claude", "worktrees", req.Slug)

	// Step 1: git worktree add
	out, err := s.runner.Run(s.repoPath, "git", "worktree", "add", wtDir, "-b", branch)
	if err != nil {
		return SpawnResult{}, fmt.Errorf("git worktree add failed: %s: %w", strings.TrimSpace(string(out)), err)
	}

	// Step 2: tmux new-window (detached, starting in worktree dir)
	out, err = s.runner.Run(s.repoPath, "tmux", "new-window", "-d", "-n", req.Slug, "-c", wtDir)
	if err != nil {
		s.rollbackWorktree(wtDir, branch)
		return SpawnResult{}, fmt.Errorf("tmux new-window failed: %s: %w", strings.TrimSpace(string(out)), err)
	}

	// Step 3: launch claude in the tmux window
	prompt := BuildPrompt(req)
	claudeCmd := fmt.Sprintf("claude %q", prompt)
	out, err = s.runner.Run(s.repoPath, "tmux", "send-keys", "-t", req.Slug, claudeCmd, "Enter")
	if err != nil {
		s.rollbackTmux(req.Slug)
		s.rollbackWorktree(wtDir, branch)
		return SpawnResult{}, fmt.Errorf("tmux send-keys failed: %s: %w", strings.TrimSpace(string(out)), err)
	}

	slog.Info("agent spawned", "slug", req.Slug, "branch", branch, "role", req.Role)

	return SpawnResult{
		Slug:        req.Slug,
		Branch:      branch,
		WorktreeDir: wtDir,
	}, nil
}

// BuildPrompt generates the prompt string from dispatch parameters.
func BuildPrompt(req SpawnRequest) string {
	var sb strings.Builder
	fmt.Fprintf(&sb, "Role: %s\n", req.Role)
	if len(req.Scope) > 0 {
		fmt.Fprintf(&sb, "Scope: %s\n", strings.Join(req.Scope, ", "))
	}
	if req.Instructions != "" {
		fmt.Fprintf(&sb, "Instructions: %s\n", req.Instructions)
	}
	sb.WriteString("Commit when done.\n")
	return sb.String()
}

func (s *Spawner) rollbackWorktree(wtDir, branch string) {
	if out, err := s.runner.Run(s.repoPath, "git", "worktree", "remove", "--force", wtDir); err != nil {
		slog.Warn("rollback: worktree remove failed", "dir", wtDir, "err", err, "output", string(out))
	}
	if out, err := s.runner.Run(s.repoPath, "git", "branch", "-d", branch); err != nil {
		slog.Warn("rollback: branch delete failed", "branch", branch, "err", err, "output", string(out))
	}
}

func (s *Spawner) rollbackTmux(slug string) {
	if out, err := s.runner.Run(s.repoPath, "tmux", "kill-window", "-t", slug); err != nil {
		slog.Warn("rollback: tmux kill-window failed", "slug", slug, "err", err, "output", string(out))
	}
}
