package agents

import (
	"fmt"
	"strings"
	"testing"
)

// mockRunner records calls and returns pre-configured responses.
type mockRunner struct {
	lookPathErr map[string]error         // binary name → error (nil = found)
	runResults  map[string]mockRunResult // key = "name args..." → result
	runCalls    []mockRunCall            // recorded calls in order
}

type mockRunResult struct {
	output []byte
	err    error
}

type mockRunCall struct {
	Dir  string
	Name string
	Args []string
}

func newMockRunner() *mockRunner {
	return &mockRunner{
		lookPathErr: make(map[string]error),
		runResults:  make(map[string]mockRunResult),
	}
}

func (m *mockRunner) LookPath(name string) error {
	if err, ok := m.lookPathErr[name]; ok {
		return err
	}
	return nil // default: found
}

func (m *mockRunner) Run(dir string, name string, args ...string) ([]byte, error) {
	m.runCalls = append(m.runCalls, mockRunCall{Dir: dir, Name: name, Args: args})
	key := name + " " + strings.Join(args, " ")
	if r, ok := m.runResults[key]; ok {
		return r.output, r.err
	}
	return nil, nil // default: success with empty output
}

// setRunResult configures the response for a specific command.
func (m *mockRunner) setRunResult(key string, output []byte, err error) {
	m.runResults[key] = mockRunResult{output: output, err: err}
}

func TestValidateSlug(t *testing.T) {
	cases := []struct {
		name    string
		slug    string
		wantErr string
	}{
		{"empty slug", "", "slug is required"},
		{"too long", strings.Repeat("a", 51), "50 characters or fewer"},
		{"leading hyphen", "-foo", "lowercase alphanumeric"},
		{"trailing hyphen", "foo-", "lowercase alphanumeric"},
		{"uppercase", "Foo", "lowercase alphanumeric"},
		{"spaces", "foo bar", "lowercase alphanumeric"},
		{"special chars", "foo_bar", "lowercase alphanumeric"},
		{"valid simple", "fix", ""},
		{"valid single char", "x", ""},
		{"valid with hyphens", "fix-auth-bug", ""},
		{"valid with numbers", "ac-42", ""},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			err := validateSlug(tc.slug)
			if tc.wantErr == "" {
				if err != nil {
					t.Fatalf("expected no error, got %v", err)
				}
				return
			}
			if err == nil {
				t.Fatalf("expected error containing %q, got nil", tc.wantErr)
			}
			if !strings.Contains(err.Error(), tc.wantErr) {
				t.Fatalf("expected error containing %q, got %q", tc.wantErr, err.Error())
			}
		})
	}
}

func TestValidate_CLINotFound(t *testing.T) {
	cases := []struct {
		name    string
		missing string
		wantErr string
	}{
		{"claude missing", "claude", "claude not found on PATH"},
		{"tmux missing", "tmux", "tmux not found on PATH"},
		{"git missing", "git", "git not found on PATH"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			runner := newMockRunner()
			runner.lookPathErr[tc.missing] = fmt.Errorf("not found")

			sp := NewSpawnerWithRunner("/repo", runner)
			err := sp.Validate(SpawnRequest{Slug: "test"})
			if err == nil {
				t.Fatalf("expected error, got nil")
			}
			if !strings.Contains(err.Error(), tc.wantErr) {
				t.Fatalf("expected error containing %q, got %q", tc.wantErr, err.Error())
			}
		})
	}
}

func TestValidate_DirtyRepo(t *testing.T) {
	runner := newMockRunner()
	runner.setRunResult("git status --porcelain", []byte(" M dirty-file.go\n"), nil)
	// Branch check should fail (branch doesn't exist) — this is the happy path for that check
	runner.setRunResult("git rev-parse --verify worktree-test", nil, fmt.Errorf("not found"))

	sp := NewSpawnerWithRunner("/repo", runner)
	err := sp.Validate(SpawnRequest{Slug: "test"})
	if err == nil {
		t.Fatal("expected error for dirty repo, got nil")
	}
	if !strings.Contains(err.Error(), "uncommitted changes") {
		t.Fatalf("expected 'uncommitted changes' error, got %q", err.Error())
	}
}

func TestValidate_BranchExists(t *testing.T) {
	runner := newMockRunner()
	// Clean repo
	runner.setRunResult("git status --porcelain", nil, nil)
	// Branch exists (rev-parse succeeds)
	runner.setRunResult("git rev-parse --verify worktree-fix-auth", nil, nil)

	sp := NewSpawnerWithRunner("/repo", runner)
	err := sp.Validate(SpawnRequest{Slug: "fix-auth"})
	if err == nil {
		t.Fatal("expected error for existing branch, got nil")
	}
	if !strings.Contains(err.Error(), "already exists") {
		t.Fatalf("expected 'already exists' error, got %q", err.Error())
	}
}

func TestValidate_WorktreePathExists(t *testing.T) {
	runner := newMockRunner()
	// Clean repo
	runner.setRunResult("git status --porcelain", nil, nil)
	// Branch does not exist
	runner.setRunResult("git rev-parse --verify worktree-fix-auth", nil, fmt.Errorf("not found"))
	// Worktree dir exists (test -d succeeds)
	runner.setRunResult("test -d /repo/.claude/worktrees/fix-auth", nil, nil)

	sp := NewSpawnerWithRunner("/repo", runner)
	err := sp.Validate(SpawnRequest{Slug: "fix-auth"})
	if err == nil {
		t.Fatal("expected error for existing worktree dir, got nil")
	}
	if !strings.Contains(err.Error(), "worktree directory already exists") {
		t.Fatalf("expected 'worktree directory already exists' error, got %q", err.Error())
	}
}

func TestValidate_AllPassing(t *testing.T) {
	runner := newMockRunner()
	// Clean repo
	runner.setRunResult("git status --porcelain", nil, nil)
	// Branch does not exist
	runner.setRunResult("git rev-parse --verify worktree-fix-auth", nil, fmt.Errorf("not found"))
	// Worktree dir does not exist
	runner.setRunResult("test -d /repo/.claude/worktrees/fix-auth", nil, fmt.Errorf("not a dir"))

	sp := NewSpawnerWithRunner("/repo", runner)
	err := sp.Validate(SpawnRequest{Slug: "fix-auth"})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
}

func TestBuildPrompt(t *testing.T) {
	cases := []struct {
		name     string
		req      SpawnRequest
		contains []string
	}{
		{
			"full request",
			SpawnRequest{
				Slug:         "refactor-auth",
				Role:         "refactor",
				Scope:        []string{"src/auth/session.ts", "src/auth/jwt.ts"},
				Instructions: "Restructure the AUTH module",
			},
			[]string{"Role: refactor", "Scope: src/auth/session.ts, src/auth/jwt.ts", "Instructions: Restructure the AUTH module", "Commit when done."},
		},
		{
			"no scope",
			SpawnRequest{
				Slug:         "fix",
				Role:         "bugfix",
				Instructions: "Fix the login timeout",
			},
			[]string{"Role: bugfix", "Instructions: Fix the login timeout", "Commit when done."},
		},
		{
			"no instructions",
			SpawnRequest{
				Slug:  "review",
				Role:  "review",
				Scope: []string{"main.go"},
			},
			[]string{"Role: review", "Scope: main.go", "Commit when done."},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			prompt := BuildPrompt(tc.req)
			for _, want := range tc.contains {
				if !strings.Contains(prompt, want) {
					t.Errorf("prompt missing %q\ngot: %s", want, prompt)
				}
			}
		})
	}
}

func TestSpawn_Success(t *testing.T) {
	runner := newMockRunner()
	// Validation passes
	runner.setRunResult("git status --porcelain", nil, nil)
	runner.setRunResult("git rev-parse --verify worktree-fix-auth", nil, fmt.Errorf("not found"))
	runner.setRunResult("test -d /repo/.claude/worktrees/fix-auth", nil, fmt.Errorf("not a dir"))

	sp := NewSpawnerWithRunner("/repo", runner)
	result, err := sp.Spawn(SpawnRequest{
		Slug:         "fix-auth",
		Role:         "bugfix",
		Scope:        []string{"auth.go"},
		Instructions: "Fix the timeout bug",
	})
	if err != nil {
		t.Fatalf("expected success, got %v", err)
	}
	if result.Slug != "fix-auth" {
		t.Errorf("slug: got %q, want %q", result.Slug, "fix-auth")
	}
	if result.Branch != "worktree-fix-auth" {
		t.Errorf("branch: got %q, want %q", result.Branch, "worktree-fix-auth")
	}
	if !strings.HasSuffix(result.WorktreeDir, ".claude/worktrees/fix-auth") {
		t.Errorf("worktreeDir: got %q, want suffix %q", result.WorktreeDir, ".claude/worktrees/fix-auth")
	}

	// Verify the runner was called with the right commands
	var cmds []string
	for _, c := range runner.runCalls {
		cmds = append(cmds, c.Name+" "+strings.Join(c.Args, " "))
	}

	found := map[string]bool{
		"worktree add": false,
		"new-window":   false,
		"send-keys":    false,
	}
	for _, cmd := range cmds {
		if strings.Contains(cmd, "worktree add") {
			found["worktree add"] = true
		}
		if strings.Contains(cmd, "new-window") {
			found["new-window"] = true
		}
		if strings.Contains(cmd, "send-keys") {
			found["send-keys"] = true
		}
	}
	for step, ok := range found {
		if !ok {
			t.Errorf("expected command containing %q to be called", step)
		}
	}
}

func TestSpawn_RollbackOnTmuxFailure(t *testing.T) {
	runner := newMockRunner()
	// Validation passes
	runner.setRunResult("git status --porcelain", nil, nil)
	runner.setRunResult("git rev-parse --verify worktree-fix-auth", nil, fmt.Errorf("not found"))
	runner.setRunResult("test -d /repo/.claude/worktrees/fix-auth", nil, fmt.Errorf("not a dir"))
	// tmux new-window fails
	runner.setRunResult("tmux new-window -d -n fix-auth -c /repo/.claude/worktrees/fix-auth", nil, fmt.Errorf("no tmux server"))

	sp := NewSpawnerWithRunner("/repo", runner)
	_, err := sp.Spawn(SpawnRequest{Slug: "fix-auth", Role: "bugfix"})
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if !strings.Contains(err.Error(), "tmux new-window failed") {
		t.Fatalf("expected tmux error, got %q", err.Error())
	}

	// Verify rollback: worktree remove + branch delete were called
	var rollbackCmds []string
	for _, c := range runner.runCalls {
		cmd := c.Name + " " + strings.Join(c.Args, " ")
		if strings.Contains(cmd, "worktree remove") || strings.Contains(cmd, "branch -d") {
			rollbackCmds = append(rollbackCmds, cmd)
		}
	}
	if len(rollbackCmds) < 2 {
		t.Errorf("expected rollback commands (worktree remove + branch -d), got %v", rollbackCmds)
	}
}

func TestSpawn_RollbackOnClaudeFailure(t *testing.T) {
	runner := newMockRunner()
	// Validation passes
	runner.setRunResult("git status --porcelain", nil, nil)
	runner.setRunResult("git rev-parse --verify worktree-fix-auth", nil, fmt.Errorf("not found"))
	runner.setRunResult("test -d /repo/.claude/worktrees/fix-auth", nil, fmt.Errorf("not a dir"))
	// tmux send-keys fails (simulate claude launch failure)
	// Override Run to make send-keys fail specifically.
	runner2 := &sendKeysFailRunner{mockRunner: runner}

	sp := NewSpawnerWithRunner("/repo", runner2)
	_, err := sp.Spawn(SpawnRequest{Slug: "fix-auth", Role: "bugfix"})
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if !strings.Contains(err.Error(), "tmux send-keys failed") {
		t.Fatalf("expected send-keys error, got %q", err.Error())
	}

	// Verify full rollback: kill-window + worktree remove + branch -d
	var rollbackCmds []string
	for _, c := range runner2.mockRunner.runCalls {
		cmd := c.Name + " " + strings.Join(c.Args, " ")
		if strings.Contains(cmd, "kill-window") || strings.Contains(cmd, "worktree remove") || strings.Contains(cmd, "branch -d") {
			rollbackCmds = append(rollbackCmds, cmd)
		}
	}
	if len(rollbackCmds) < 3 {
		t.Errorf("expected 3 rollback commands (kill-window + worktree remove + branch -d), got %v", rollbackCmds)
	}
}

// sendKeysFailRunner wraps mockRunner but fails on tmux send-keys.
type sendKeysFailRunner struct {
	mockRunner *mockRunner
}

func (r *sendKeysFailRunner) LookPath(name string) error {
	return r.mockRunner.LookPath(name)
}

func (r *sendKeysFailRunner) Run(dir string, name string, args ...string) ([]byte, error) {
	r.mockRunner.runCalls = append(r.mockRunner.runCalls, mockRunCall{Dir: dir, Name: name, Args: args})
	if name == "tmux" && len(args) > 0 && args[0] == "send-keys" {
		return []byte("send-keys error"), fmt.Errorf("send-keys failed")
	}
	key := name + " " + strings.Join(args, " ")
	if result, ok := r.mockRunner.runResults[key]; ok {
		return result.output, result.err
	}
	return nil, nil
}
