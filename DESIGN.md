# Agent City — Architecture

> Manage AI coding agents like a SimCity mayor, not a chat user.
> Buildings are files, districts are directories, UFO agents are AI coding sessions.
> Phase 1: see the city. Phase 2: run the city.

## Current State (2026-05-16)

Phase 1 is complete. The city renders and updates from live repo data; agentwatch integration is done and passing tests. Phase 2 orchestration UI components are partially built.

### Milestone status

| Milestone | Status |
|-----------|--------|
| P1.1 — Go binary, demo mode, repo scan, treemap, canvas + keyboard nav | ✅ Complete |
| P1.2 — File watcher, WebSocket hub, Zustand store, dependency roads | ✅ Complete |
| P1.3 — Agentwatch integration, UFO rendering, agent roster | ✅ Complete |
| P1.4 — Full HUD, minimap, shortcut overlay, scanlines, visual polish | ✅ Complete |
| Phase 2 — Orchestration, dispatch wizard, agent spawning, alarm state | 🔄 In progress |

### What actually exists

**Go backend — `internal/`**

| Package | Files present | Notes |
|---------|---------------|-------|
| `internal/model/` | `model.go` | ✅ |
| `internal/repo/` | `scanner.go`, `watcher.go`, `metrics.go` | ✅ |
| `internal/deps/` | `analyzer.go`, `graph.go` | ✅ |
| `internal/city/` | `builder.go` | ✅ City-state assembly — not listed in the package layout section below |
| `internal/layout/` | `engine.go`, `packer.go`, `treemap.go` | ✅ |
| `internal/hub/` | `hub.go`, `state.go` | ✅ |
| `internal/api/` | `server.go`, `handlers.go` | ✅ |
| `internal/agents/` | `monitor.go`, `monitor_test.go`, `tracker.go`, `tracker_test.go`, `spawner.go`, `spawner_test.go` | ✅ Agentwatch integration complete (P1.3) |

**Frontend — `web/src/`**

| Path | Status | Notes |
|------|--------|-------|
| `canvas/` (all 8 renderers + camera + hittester) | ✅ | |
| `hud/` (TopBar, LeftRail, RightRail, BottomStrip, Minimap, ShortcutOverlay, ScanlineOverlay, HudOverlay, palette.ts) | ✅ | |
| `store/` (cityStore, uiStore, wsMiddleware, sessionPersist) | ✅ | |
| `hooks/useCityKeyboard.ts`, `useAnimationFrame.ts`, `useSessionPersist.ts` | ✅ | |
| `hooks/useCameraControls.ts` | ❌ | Lives inside `useCityKeyboard.ts`, not a separate file |
| `hooks/useWebSocket.ts` | ❌ | Lives inside `store/wsMiddleware.ts`, not a separate file |
| `theme/` | ✅ | `colors.ts`, `typography.ts` — SD palette and font sizes |
| `orchestration/` | 🔄 | Phase 2 — 5 files exist: `AlarmOverlay.tsx`, `CommandPalette.tsx`, `DispatchWizard.tsx`, `RapidResponse.tsx`, `ScopeSelector.tsx` |

### Key gotchas for agents reading this doc

- **`internal/agents/` exists** — `monitor.go`, `tracker.go`, `spawner.go` + tests. Agentwatch integration (P1.3) is complete.
- **`web/src/theme/` exists** — `colors.ts` and `typography.ts`. The SD palette is also mirrored at `web/src/hud/palette.ts` for HUD-specific use.
- **`web/src/orchestration/` exists** — 5 Phase 2 components are built: `AlarmOverlay.tsx`, `CommandPalette.tsx`, `DispatchWizard.tsx`, `RapidResponse.tsx`, `ScopeSelector.tsx`.
- **`useCameraControls` and `useWebSocket` are not separate files** — see `useCityKeyboard.ts` and `store/wsMiddleware.ts`.
- **`internal/city/` exists** (`builder.go`, city-state assembly) but is absent from the package layout section below.

---

## System Overview

```
┌──────────────┐     ┌─────────────────────────┐     ┌──────────────────┐
│  Git Repo    │────▶│  Agent City Go Backend   │────▶│  Browser Client  │
│  (on disk)   │     │  (HTTP + WS)             │     │  (React + Canvas)│
└──────────────┘     │                           │     └──────────────────┘
                     │  ┌─────────────────────┐ │
                     │  │ agentwatch.Monitor   │ │  ← imported library, runs in-process
                     │  │ (poll + event sink)  │ │
                     │  └────────┬─────────────┘ │
                     └───────────┼───────────────┘
                                 ▲
                  ┌──────────────┼──────────────┐
                  │              │              │
             Claude Code     Codex CLI    Gemini CLI
             (~/.claude/     (~/.codex/   (~/.gemini/
              projects/)     sessions/)    tmp/)
```

A Go backend scans a Git repository and imports the
[agentwatch](https://github.com/mrf/agentwatch) library (`go get github.com/mrf/agentwatch`)
to detect and monitor agent sessions in-process. Agentwatch handles all agent detection —
JSONL parsing, session lifecycle, stale detection — for Claude Code, Codex, and Gemini
via its `Source` interface. Agent-city creates a `monitor.Monitor` with the appropriate
sources, polls via `Monitor.Run()`, and reads session state via `Monitor.Snapshot()` or
reacts to changes via a `monitor.EventSink`.

Visual direction comes from the prototypes in `code-sim/`, primarily `sketch-A-v2.jsx`
(solarized dark isometric city with flying UFO agents).

---

## Technology Choices

| Component | Choice | Why |
|-----------|--------|-----|
| Backend | **Go 1.25+** | Excellent concurrency for file watching + WS fan-out; user preference; required by agentwatch |
| HTTP routing | **net/http** (stdlib) | Go 1.22 pattern routing covers this API surface |
| WebSocket | **gorilla/websocket** | De facto standard |
| Agent detection | **[agentwatch](https://github.com/mrf/agentwatch)** (imported library) | In-process monitor with pull (`Snapshot()`) and push (`EventSink`) APIs; built-in sources for Claude/Codex/Gemini; no external server needed |
| Git access | **go-git/v5** | Pure Go, no CGO/libgit2 |
| File watching | **fsnotify** | Cross-platform, inotify on Linux/WSL2 |
| Frontend | **React 18 + TypeScript** | Prototype already uses React |
| City rendering | **HTML5 Canvas 2D** | SVG won't scale past ~200 animated elements; Canvas handles hundreds of buildings + agents at 60fps. Wireframe aesthetic needs only 2D primitives — WebGL would be overengineering |
| HUD overlays | **React HTML/CSS** | Agent roster, activity log, stats — standard DOM positioned over the canvas |
| State | **Zustand** | Lightweight, works naturally with external WS updates |
| Build | **Vite** | Fast dev server, HMR, TypeScript, proxy to Go backend |
| Font | **JetBrains Mono** | Specified in all prototypes |

---

## Backend

### Package Layout

```
cmd/agentic-city/main.go             — entry point, wire services, embed frontend

internal/
  model/model.go                      — core data types
  city/
    builder.go                        — assemble CityState from repo scan + layout + deps
  repo/
    scanner.go                        — Git tree walk, per-file metadata (LOC, language)
    watcher.go                        — fsnotify, 500ms debounce, incremental rescan
    metrics.go                        — parse coverage/test result files
  deps/
    analyzer.go                       — regex import extraction (TS/JS, Go, Python)
    graph.go                          — adjacency list → Road edges
  agents/
    tracker.go                        — agent lifecycle, maps agentwatch sessions to city agents
    monitor.go                        — agentwatch monitor setup, source config, event sink bridge
    spawner.go                        — (planned — Phase 2) create worktree + tmux + claude session
    prompts.go                        — (planned — Phase 2) role → prompt template generation
  city/
    builder.go                        — BuildState() full scan→layout→deps pipeline; MergeBuildings() incremental updates; GatherRepoInfo() git metadata
  layout/
    treemap.go                        — squarified treemap for district placement
    packer.go                         — shelf-pack buildings within districts
    engine.go                         — files → positioned districts + buildings
  hub/
    hub.go                            — WebSocket hub, client registry, broadcast
    state.go                          — assemble CityState, compute diffs
  api/
    server.go                         — HTTP server, route registration
    handlers.go                       — REST handlers + WS upgrade
```

### Repo Scanner (`internal/repo/`)

Startup: walk Git tree via go-git, compute per-file LOC, detect language by extension.

File watcher: fsnotify on repo root, debounce 500ms, re-scan only changed files.
Layout recalculates only when files are added/removed/moved (not content-only edits).

**City state = main branch.** The city always renders the state of the main working tree
(typically `main` or `master`). Agents working in worktrees operate on branches — their
changes are *not* reflected in the city layout until merged. This means:

- Buildings represent files as they exist on `HEAD` of the main working tree
- An agent creating a new file in a worktree does NOT spawn a new building (yet)
- When a worktree branch is merged, the city rescans and buildings appear/disappear/resize
- The merge moment is the visible payoff — you see the city change as a result of the
  agent's work, like watching a SimCity construction complete

**File filtering:** not every file becomes a building. Exclude:

- Anything matched by `.gitignore`
- Known non-source directories: `node_modules/`, `vendor/`, `.git/`, `dist/`, `build/`
- Binary files (detected by extension or null-byte sniff)
- Files below a configurable LOC threshold (default: 0, show everything)
- Configurable `--exclude` glob patterns and `--max-depth` for directory traversal

### Metrics Sources (`internal/repo/metrics.go`)

The data model references coverage, test results, and CI status. Where they come from:

**Test coverage** (`Building.Coverage`):
- Parse coverage output files if present in the repo:
  - Go: `go test -coverprofile=coverage.out` → parse `coverage.out`
  - JS/TS: lcov format (`coverage/lcov.info`) → parse lcov
  - Python: `coverage.py` XML or lcov output
- On startup, look for known coverage file paths. If none found, `Coverage = -1` (unknown)
  and buildings render without window dots.
- Re-parse when coverage files change (fsnotify).

**Test results** (`RepoStats.TestsPassing/Total`, `Building.Status`):
- Not auto-run by agent-city. Parse test result files if present:
  - JUnit XML (widely supported across languages)
  - Go test JSON output
- Map test failures to specific files → set `Building.Status = "err"` or `"warn"`
- If no test data is available, default `Status = "unknown"` for all buildings.
  Unknown is rendered neutrally and must not be presented as healthy.

**CI status** (`RepoInfo.CIStatus`):
- Phase 1: manual/static — defaults to `"unknown"`
- Phase 2: optional GitHub Actions polling via `gh api` or webhook listener
- Could also be set by an agent-city config file or CLI flag

These are all best-effort. The city works without any of them — buildings render with
neutral unknown status, and coverage windows are omitted. Metrics enrich the visualization
but don't gate it.

### Dependency Analyzer (`internal/deps/`)

Best-effort regex-based import extraction for Phase 1:

- **TS/JS**: `import .* from ['"](.+)['"]`, `require\(['"](.+)['"]\)`
- **Go**: `import "(.+)"`, `import (` blocks
- **Python**: `^import (.+)`, `^from (.+) import`

Resolves relative paths to repo-relative file IDs. Produces `[]Road` with a confidence
level. These roads are useful context, not a ground-truth call graph. The UI should show
them as faint / toggleable by default, and any high-stakes "blast radius" claims must be
phrased as likely affected files unless backed by richer language-specific analysis.

### Agent Tracker (`internal/agents/`)

Imports [agentwatch](https://github.com/mrf/agentwatch) as a library and creates a
`monitor.Monitor` with built-in sources for Claude Code, Codex CLI, and Gemini CLI.
Agentwatch handles all agent detection (JSONL session parsing, session lifecycle
management, stale detection) in-process — no external server required.

**Setup:** create sources, build a monitor, run it in a goroutine:

```go
import (
    "github.com/mrf/agentwatch/monitor"
    "github.com/mrf/agentwatch/sources/claude"
    "github.com/mrf/agentwatch/sources/codex"
    "github.com/mrf/agentwatch/sources/gemini"
)

claudeSrc, _ := claude.New(claude.WithRoot(os.ExpandEnv("$HOME/.claude/projects")))
codexSrc, _  := codex.New(codex.WithRoot(os.ExpandEnv("$HOME/.codex")))
geminiSrc, _ := gemini.New(gemini.WithRoot(os.ExpandEnv("$HOME/.gemini")))

mon, _ := monitor.New(
    monitor.WithSources(claudeSrc, codexSrc, geminiSrc),
    monitor.WithSink(agentBridge),  // implements monitor.EventSink
    monitor.WithPollInterval(2 * time.Second),
)
go mon.Run(ctx)
```

**Pull API:** `mon.Snapshot()` returns a `[]session.SessionState` deep copy on demand.
**Push API:** the `monitor.EventSink` receives `monitor.Event` envelopes (delta, lifecycle,
health) after each poll cycle. Agent-city implements `EventSink` to bridge updates into
the city state.

Map each `session.SessionState` to a city Agent:

```
agentwatch session.SessionState   →  agent-city Agent
─────────────────────────────      ─────────────────────
ID: "session-uuid"                →  id (composite key, prefixed by Source)
Model: "claude-opus-4-6"          →  color (family) + size (tier) + dome glow (thinking)
Activity: "working"/"idle"/etc    →  mode: "work" | "fly" | "idle" | "error"
CurrentTool: "Edit"               →  task description
ContextUtilization: 0.45          →  progress (0–100, scaled)
WorkingDir: "/home/user/project"  →  repo/worktree hint, not a file target
Branch: "feat/auth"               →  —
```

**UFO visual encoding — model family, tier, and thinking:**

The UFO's appearance encodes three things at a glance: who made it, how powerful it is,
and how hard it's thinking.

*Color = model family:*

| Family | Color | Hex (from SD palette) |
|--------|-------|----------------------|
| Claude (Anthropic) | Blue | `#4a7a9c` (SD.blue) |
| Codex / OpenAI | Green | `#6a8a4a` (SD.green) |
| Gemini / Google | Orange | `#b06a3a` (SD.orange) |

*UFO size = model tier:*

| Tier | Scale | Disc width | Visual |
|------|-------|-----------|--------|
| Haiku (small/fast) | 0.6× | ~18px | Compact scout UFO |
| Sonnet (mid-tier) | 1.0× | ~30px | Standard UFO (prototype default) |
| Opus (large/capable) | 1.4× | ~42px | Heavy cruiser UFO |

Size is immediately readable — a big blue UFO is Opus Claude, a small green one is
a lightweight Codex model. No text needed.

*Dome glow = thinking level:*

| State | Dome appearance |
|-------|----------------|
| Not thinking (tool use, waiting) | Dome dark, outline only |
| Standard thinking | Dome has a soft inner glow (family color at 30% opacity) |
| Extended thinking (high token burn) | Dome pulses brighter (family color at 60%, `sd-pulse` animation) |

Thinking intensity is derived from the session's activity and token output rate — high
output token accumulation with `Activity: "working"` = extended thinking. The dome acts
like a brain activity indicator: dark when idle, glowing when reasoning, pulsing when
deep in thought.

*Parsing model tier from agentwatch's `SessionState.Model` field:*
```go
func tierFromModel(model string) string {
    lower := strings.ToLower(model)
    switch {
    case strings.Contains(lower, "opus"):   return "opus"
    case strings.Contains(lower, "sonnet"): return "sonnet"
    case strings.Contains(lower, "haiku"):  return "haiku"
    case strings.Contains(lower, "o3"), strings.Contains(lower, "o4"):
        return "opus"   // OpenAI frontier
    case strings.Contains(lower, "gpt"):
        return "sonnet" // OpenAI mid-tier
    case strings.Contains(lower, "pro"):
        return "opus"   // Gemini Pro
    case strings.Contains(lower, "flash"):
        return "haiku"  // Gemini Flash
    default:
        return "sonnet" // safe default
    }
}
```

**Activity → Mode mapping:**
- `"working"` → `"work"` (parked on target building with tractor beam)
- `"waiting"`, `"idle"` → `"idle"`
- `"terminal"` → `"error"` (if unexpected) or removal
- Transition between confident targets → `"fly"` animation

**Agent → Building mapping:** agentwatch provides `WorkingDir` and `CurrentTool`, but
does not currently provide a specific file path. Agent-city therefore treats location as
a confidence-scored signal, not truth:

| Confidence | Meaning | Visual treatment |
|------------|---------|------------------|
| `exact` | File came from dispatch scope or a future upstream explicit file event | Solid tractor beam on building |
| `inferred` | Most recent write/create/delete event in the agent's worktree | Dotted / softer tractor beam |
| `district` | Only directory or repo/worktree is known | UFO hovers above district |
| `unknown` | No reliable repo/building match | Agent remains in roster / city edge |

Resolution strategy:

1. **fsnotify on the repo** — when a file is modified, check which agent's worktree
   contains it. File write/create/delete events can infer an agent's target building.
   Read-only tool use often does not touch mtimes, and generated files can add noise, so
   these locations are `inferred`, not `exact`.
2. **Multiple files** — if an agent touches several files in quick succession, park the
   UFO on the most recently touched file with `inferred` confidence. Previously touched
   files show yellow edit-pulse rings but no tractor beam.
3. **No file yet** — when an agent is `Thinking` with no file activity, park the UFO
   above its district when one can be inferred from `workingDir` or dispatch scope.
4. **No reliable match** — keep the agent visible in the roster and optionally at the
   city edge rather than pretending it is working on a specific building.

**Future:** evaluate contributing a `Source` implementation back to agentwatch that
exposes agent-city dispatch metadata (role, scope, budget) alongside the session state.

### Layout Engine (`internal/layout/`)

1. **Squarified treemap** — directory tree → district rectangles, weighted by total LOC
2. **Shelf packing** — within each district, sort files by LOC desc, compute footprint
   (`w = clamp(√(LOC/20), 4, 12)`, `h = w × 0.8`), height (`z = clamp(LOC/30, 3, 30)`),
   pack with 2-unit gutters
3. **Stability** — deterministic sort by path; only repack affected district on change;
   frontend animates transitions (300ms ease-out)
4. **Nesting depth** — real codebases have deep paths (`src/components/auth/forms/`).
   Configurable `--district-depth` (default: 2). Directories deeper than this flatten
   into their parent district. `src/auth/` is a district, `src/auth/guards/` files are
   buildings inside it, not a sub-district

### Real-time Hub (`internal/hub/`)

- WebSocket server, one goroutine per client
- On connect: full `CityState` snapshot
- On change: JSON patch diff broadcast
- Two cadences: agent state ~100ms tick, repo structure on-change (debounced)

---

## Data Model

```go
type CityState struct {
    RepoInfo   RepoInfo        `json:"repoInfo"`
    Districts  []District      `json:"districts"`
    Buildings  []Building      `json:"buildings"`
    Roads      []Road          `json:"roads"`
    Agents     []Agent         `json:"agents"`
    Activities []ActivityEvent `json:"activities"`
    Stats      RepoStats       `json:"stats"`
    Timestamp  int64           `json:"ts"`
}

type RepoInfo struct {
    Name       string `json:"name"`
    Branch     string `json:"branch"`
    HeadCommit string `json:"headCommit"`
    CIStatus   string `json:"ciStatus"`   // "passing" | "failing" | "unknown"
}

type District struct {
    ID       string  `json:"id"`       // directory path: "src/auth"
    Label    string  `json:"label"`    // display: "AUTH/"
    ParentID string  `json:"parentId"`
    GX       float64 `json:"gx"`       // grid coordinates
    GY       float64 `json:"gy"`
    GW       float64 `json:"gw"`
    GH       float64 `json:"gh"`
}

type Building struct {
    ID         string  `json:"id"`         // file path relative to repo root
    DistrictID string  `json:"districtId"`
    Label      string  `json:"label"`      // filename
    Language   string  `json:"language"`   // "ts", "tsx", "go", "py", "sql"
    LOC        int     `json:"loc"`
    Coverage   float64 `json:"coverage"`   // -1 unknown, 0.0–1.0 → window dot density
    Status     string  `json:"status"`     // "ok" | "warn" | "err" | "unknown"
    Editing    bool    `json:"editing"`    // yellow pulse rings on roof
    Exports    int     `json:"exports"`
    GX         float64 `json:"gx"`        // grid position
    GY         float64 `json:"gy"`
    GW         float64 `json:"gw"`        // footprint
    GH         float64 `json:"gh"`
    GZ         float64 `json:"gz"`        // height (∝ LOC)
}

type Road struct {
    FromID     string `json:"fromId"`
    ToID       string `json:"toId"`
    Weight     int    `json:"weight"`
    Confidence string `json:"confidence"` // "exact" | "inferred" | "weak"
}

type Agent struct {
    ID                 string  `json:"id"`
    Color              string  `json:"color"`
    Mode               string  `json:"mode"`      // "idle" | "work" | "fly" | "error"
    Task               string  `json:"task"`
    Progress           int     `json:"progress"`  // 0–100
    TargetID           string  `json:"targetId,omitempty"`           // mode=work
    LocationConfidence string  `json:"locationConfidence,omitempty"` // "exact" | "inferred" | "district" | "unknown"
    FromID             string  `json:"fromId,omitempty"`             // mode=fly
    ToID               string  `json:"toId,omitempty"`               // mode=fly
    FlyProgress        float64 `json:"flyProgress,omitempty"`        // 0.0–1.0 on bezier
    ErrorMsg           string  `json:"errorMsg,omitempty"`
}

type ActivityEvent struct {
    Timestamp string `json:"ts"`
    Who       string `json:"who"`       // agent ID | "CI" | "YOU"
    Message   string `json:"message"`
    Color     string `json:"color"`
    Severity  string `json:"severity"`  // "info" | "warn" | "error"
}

type RepoStats struct {
    FileCount    int     `json:"fileCount"`
    TotalLOC     int     `json:"totalLoc"`
    Coverage     float64 `json:"coverage"`
    OpenPRs      int     `json:"openPrs"`
    BugCount     int     `json:"bugCount"`
    TestsPassing int     `json:"testsPassing"`
    TestsTotal   int     `json:"testsTotal"`
}
```

---

## API

### REST

```
GET    /api/state              — full CityState snapshot
GET    /api/buildings/{id}     — single building detail
POST   /api/dispatch           — Phase 2: spawn agent session (scope, role, budget)
DELETE /api/agents/{id}        — Phase 2: kill agent session + clean worktree
WS     /ws                     — real-time updates (city state to browser)
```

Agent *detection* is handled in-process by the agentwatch monitor. Agent *spawning* is
Phase 2 — agent-city shells out to create worktrees + tmux windows + Claude Code sessions.

### WebSocket Protocol (agent-city → browser)

**Server → Client:**

```jsonc
// Full snapshot on connect
{"type": "state.full", "data": {/* CityState */}}

// Incremental patch on change
{"type": "state.patch", "patches": [
  {"op": "replace", "path": "/agents/0/progress", "value": 65}
]}

// High-frequency agent position update
{"type": "agent.move", "agentId": "A-04", "flyProgress": 0.45}

// Layout recalculation (rare)
{"type": "layout.update", "districts": [...], "buildings": [...]}
```

**Client → Server:**

```jsonc
// Select a building
{"type": "select", "buildingId": "src/api/schema.ts"}
```

### Upstream: agentwatch API (in-process)

Agent-city uses agentwatch's in-process Go API — there is no network protocol between
agent-city and the agent monitor. Data flows through two complementary interfaces:

**Pull API — `Monitor.Snapshot()`:**
Returns a `[]session.SessionState` deep copy of all tracked sessions. Thread-safe,
callable at any time. Used for initial state population and on-demand reads.

**Push API — `monitor.EventSink`:**
Agent-city implements `monitor.EventSink` to receive events after each poll cycle:

```go
// monitor.Event envelope
type Event struct {
    Seq       uint64                    // monotonically increasing
    At        time.Time
    Type      EventType                 // "snapshot" | "delta" | "lifecycle" | "health"
    Sessions  []session.SessionState    // full state (snapshot events)
    Updates   []session.SessionState    // changed sessions (delta events)
    Removed   []string                  // removed session IDs (delta events)
    Lifecycle *session.LifecycleEvent   // discovered/updated/terminal/stale/resumed/removed
    Health    *Health                   // per-source health status changes
}
```

**`session.SessionState` fields used by agent-city:**

```go
type SessionState struct {
    ID                 string           // unique session identifier
    Source             string           // "claude" | "codex" | "gemini"
    Activity           Activity         // "idle" | "working" | "waiting" | "terminal"
    Lifecycle          LifecycleState   // "active" | "terminal"
    Model              string           // e.g. "claude-opus-4-6"
    CurrentTool        string           // e.g. "Edit", "Bash"
    WorkingDir         string           // agent's working directory
    Branch             string           // git branch if detectable
    ContextTokens      int
    MaxContextTokens   int
    ContextUtilization float64          // 0.0–1.0
    MessageCount       int
    ToolCallCount      int
    Subagents          []SubagentState  // nested agent sessions
}
```

**Source health:** `Monitor.Health()` returns per-source health (healthy/degraded/failed)
so agent-city can show source status in the HUD without needing a separate health endpoint.

---

## Frontend

### Structure

```
web/src/
  main.tsx
  App.tsx                          — top bar + left/right rails + canvas + bottom strip

  store/
    cityStore.ts                   — Zustand: CityState from backend
    uiStore.ts                     — selection, zoom, camera, dispatch step
    wsMiddleware.ts                — WebSocket connect/reconnect, dispatch
    sessionPersist.ts              — localStorage persistence (camera, selection, toggles)

  canvas/
    CityRenderer.ts                — main rAF loop, draw order orchestration
    IsometricCamera.ts             — projection math, pan/zoom, screen↔grid
    BuildingRenderer.ts            — isometric boxes, windows, pips, edit rings
    DistrictRenderer.ts            — diamond outlines, district labels
    AgentRenderer.ts               — UFOs (parked + flying), tractor beams
    RoadRenderer.ts                — dependency edges (dashed)
    AnimationManager.ts            — tween flight, pulse, blink
    HitTester.ts                   — click detection on isometric shapes

  hud/
    HudOverlay.tsx                 — top-level HUD container
    TopBar.tsx                     — repo, branch, SHA, CI, tests
    LeftRail.tsx                   — agent roster + progress bars + dispatch btn
    RightRail.tsx                  — selected building, activity log, stats, minimap
    BottomStrip.tsx                — keyboard shortcuts, status ticker
    Minimap.tsx                    — minimap overview panel
    ShortcutOverlay.tsx            — ? keyboard shortcut overlay
    ScanlineOverlay.tsx            — CRT scan line + vignette effect
    palette.ts                     — solarized dark color constants

  orchestration/                   — Phase 2 dispatch & control (partially built)
    DispatchWizard.tsx             — 3-step flow: scope → role → dispatch (sketch-E)
    CommandPalette.tsx             — Cmd+K quick-dispatch
    AlarmOverlay.tsx               — error vignette + rapid-response (sketch-D)
    RapidResponse.tsx              — rapid-response panel inside alarm state
    ScopeSelector.tsx              — lasso selection, corner brackets, scope summary
    RoleSelector.tsx               — (planned) role picker with descriptions
    DispatchPreview.tsx            — (planned) CLI preview + cost estimate + confirm button
    BudgetIndicator.tsx            — (planned) per-agent token spend, cumulative cost

  hooks/
    useCityKeyboard.ts             — all keyboard bindings, cursor state, focus zones
    useAnimationFrame.ts           — rAF hook for canvas
    useSessionPersist.ts           — sync uiStore ↔ localStorage on change
    useCameraControls.ts           — (planned) pan/zoom from keyboard + pointer
    useWebSocket.ts                — (planned) WS connection lifecycle

  theme/
    colors.ts                      — SD palette from sd-helpers.jsx
    typography.ts                  — font sizes matching prototypes
```

### Keyboard Navigation (Phase 1 requirement)

The entire interface must be operable without a mouse. This is not a nice-to-have —
it's a core design constraint from day one.

**Focus model:** the city has a spatial cursor — a highlighted building or district that
receives keyboard input. The cursor is always visible (amber highlight ring). Focus flows
naturally through the isometric grid using directional keys mapped to isometric axes.

### Production Legibility

The prototype intentionally uses dense, tiny HUD text to prove the visual direction.
The production UI should keep the solarized wireframe style but raise the information
hierarchy:

- HUD text should use practical minimum sizes (roughly 11–12px for rails, larger for
  selected-file details). The 5–8px prototype labels are visual texture, not the default
  reading size.
- Left and right rails should be resizable or collapsible once real task names, file
  paths, and errors are present.
- Canvas labels should declutter by zoom and selection state. At normal zoom, prioritize
  selected, errored, and actively edited buildings over showing every filename.
- Color encodings must be backed by shape, text, or position. Model family and status
  colors are useful, but they should not be the only way to read the interface.
- Motion should communicate state, not constantly compete for attention. Background
  animation stays subtle; alarm and active-work states get the strongest motion.

#### City Navigation

| Key | Action |
|-----|--------|
| `H` / `ArrowLeft` | Move cursor one building west (iso −x) |
| `L` / `ArrowRight` | Move cursor one building east (iso +x) |
| `K` / `ArrowUp` | Move cursor one building north (iso −y) |
| `J` / `ArrowDown` | Move cursor one building south (iso +y) |
| `Tab` | Cycle cursor to next building (within district, by LOC order) |
| `Shift+Tab` | Previous building |
| `{` / `}` | Jump cursor to previous / next district |
| `Enter` | Select focused building (populates right panel) |
| `Escape` | Deselect / dismiss modal / cancel current operation |
| `Space` | Toggle selection (add/remove building from multi-select scope) |

Cursor movement uses nearest-neighbor in the isometric grid direction, not DOM order.
`H/J/K/L` feel spatial because they map to the isometric axes — this makes the city
navigable like a vim buffer where the "lines" are isometric rows.

#### Camera

| Key | Action |
|-----|--------|
| `W` / `Shift+K` | Pan camera north |
| `S` / `Shift+J` | Pan camera south |
| `A` / `Shift+H` | Pan camera west |
| `Shift+L` | Pan camera east |
| `+` / `=` | Zoom in |
| `-` | Zoom out |
| `0` | Reset zoom to 1.0× |
| `F` | Focus camera on cursor (center + zoom to fit) |
| `Shift+F` | Focus camera on selected agent |

Camera auto-follows cursor when the cursor moves off-screen.

#### Agent Interaction

| Key | Action |
|-----|--------|
| `1`–`9` | Jump cursor to agent A-01 through A-09's current building |
| `G` | Cycle cursor through agents (next working agent) |
| `Shift+G` | Previous agent |
| `I` | Inspect focused agent (expand detail in right rail) |

#### Panels

| Key | Action |
|-----|--------|
| `[` | Focus left rail (agent roster) — `J`/`K` to scroll, `Enter` to select |
| `]` | Focus right rail (activity log / stats) — `J`/`K` to scroll |
| `Backspace` / `Escape` | Return focus to city canvas |
| `R` | Toggle dependency roads |
| `N` | Toggle building labels |
| `M` | Toggle minimap |
| `?` | Show keyboard shortcut overlay |

#### Phase 2 additions

| Key | Action |
|-----|--------|
| `D` | Open dispatch wizard (with current selection as scope) |
| `Cmd+K` / `Ctrl+K` | Open command palette |
| `X` | Quick-dispatch: refactor selected buildings |
| `Shift+D` | Dismiss / kill selected agent |

#### Implementation: `useCityKeyboard` hook

```typescript
// web/src/hooks/useCityKeyboard.ts
//
// Single hook that owns all keyboard state:
// - cursorBuildingId: string | null    — which building has keyboard focus
// - selectionSet: Set<string>          — multi-select scope (Space toggles)
// - focusZone: 'city' | 'left' | 'right' | 'modal'
//
// The hook reads building positions from cityStore and computes
// nearest-neighbor for directional movement in isometric space.
// All keybindings are listed in BottomStrip.tsx and the ? overlay.
```

#### Accessibility

**Color-blind safety:** status pips (red/yellow/green) are the worst color combo for
color blindness. Each status also gets a distinct shape:
- `ok` = filled circle
- `warn` = filled triangle (▲)
- `err` = filled diamond (◆), plus blink animation
- `unknown` = hollow square

Shape + color means status is readable even with full color blindness.
High-contrast mode toggle (`C` key) boosts all foreground opacity to 1.0.

#### Visual feedback for keyboard focus

- **Cursor building**: amber dashed ring around rooftop (distinct from selection highlight)
- **Cursor transitions**: 120ms ease-out animation when moving between buildings
- **Multi-select**: selected buildings show solid amber corner brackets (sketch-E style)
- **Panel focus**: active panel gets a brighter border; `J`/`K` scroll highlighted row
- **Bottom strip**: always shows the 4-5 most relevant shortcuts for current context

### Canvas Render Pipeline (per frame)

1. Clear, apply camera transform
2. Grid background (12px + 60px lines, matching `.sd-paper::before`)
3. District outlines (dashed diamonds, back-to-front by gx+gy)
4. Dependency roads (dashed lines on ground plane)
5. Buildings (back-to-front by gx+gy for occlusion):
   - Footprint → hidden back edges → base outline → side faces (language-tinted) → roof
   - Window dots when coverage is known (coverage × pseudo-random pattern per sketch-A-v2:334)
   - Status pip/shape (green/yellow/red/unknown, blink on err)
   - Edit pulse rings if `editing=true`
   - Floating label with backing plate
6. Tractor beams (trapezoid + scan lines + impact ellipse)
7. Parked UFOs (dome + disc + portholes, 44 units above roof)
8. Flight trails (dashed quadratic bezier curves)
9. Flying UFOs (parametric bezier: `B(t) = (1-t)²P₀ + 2(1-t)tP₁ + t²P₂`)
10. Scan line overlay, vignette

### Isometric Projection

Ported directly from `sketch-A-v2.jsx:72–84`:

```typescript
const COS30 = Math.cos(Math.PI / 6);
const SIN30 = Math.sin(Math.PI / 6);

function project(gx: number, gy: number, gz = 0): [number, number] {
  return [
    ox + (gx * COS30 + gy * COS30) * scale,
    oy + (gx * -SIN30 + gy * SIN30) * scale - gz * scale * 0.55,
  ];
}
```

### Zoom Levels (sketch-C)

| Zoom | LOD | What renders |
|------|-----|-------------|
| > 2.0× | L1 Function | Code blocks within a building |
| 0.5–2.0× | L2 File | Normal isometric city (primary view) |
| 0.15–0.5× | L3 Module | Buildings collapse into district blocks |
| < 0.15× | L4 Codebase | Orbital view, districts as circles |

---

## Build & Run

**Development:**

```bash
# Terminal 1 — backend
go run ./cmd/agentic-city --repo=/path/to/repo   # serves on :8080

# Terminal 2 — frontend
cd web && npm run dev                           # Vite on :5173, proxies /api /ws
```

Vite dev server on :5173 proxies `/api/*` and `/ws` to Go backend on :8080.

**Makefile targets:**

```bash
make run     # build (web + Go) then start server
make build   # make web + go build ./...
make web     # cd web && npm run build
make test    # go test ./...
make lint    # go vet ./...
make clean   # rm web/dist + go clean
```

**Production:** single binary.

```bash
cd web && npm run build
go build -o bin/agentic-city ./cmd/agentic-city
./bin/agentic-city --repo=/path/to/repo
# Demo mode (no real repo needed):
./bin/agentic-city --demo
```

Go binary embeds `web/dist/` via `embed.FS`.

---

## Project Structure

```
agentic-city/
  cmd/agentic-city/main.go
  internal/
    model/  repo/  deps/  agents/  layout/  hub/  api/
  web/
    index.html  package.json  vite.config.ts  tsconfig.json
    src/ ...
  code-sim/                       — design prototypes (reference only)
  go.mod
  Makefile
  DESIGN.md
```

Depends on `github.com/mrf/agentwatch` (Go library, imported via `go.mod`).

### Demo Mode

`./agentic-city --demo` starts with a synthetic city and simulated agents for frontend
development without requiring a real repo or live agent sessions. Generates:

- 5 districts, ~30 buildings with randomized LOC/coverage/language/status
  (matching the prototype's data from sketch-A-v2.jsx)
- 8 synthetic agents: 4 working, 4 flying on looping bezier paths
- Simulated activity log with timed events
- Layout uses the same treemap engine, just fed synthetic file metadata

Demo mode is also the smoke test — if the demo renders correctly, the rendering
pipeline is working. Real data plugs into the same pipeline.

### Session Persistence

Camera position, zoom level, selected building, panel states, toggle states (roads,
labels, minimap, sound) persist to `localStorage` keyed by repo path. On reload,
the city restores your viewport exactly where you left it. No account system,
no server-side state — purely local.

---

## Vision: Two Phases

**Phase 1 — Visualization.** See the city. A live isometric view of a codebase with agents
moving through it. Passive — you watch, you don't command. This validates the rendering,
layout engine, agentwatch integration, and the core "codebase as city" metaphor.

**Phase 2 — Orchestration.** Run the city. The city becomes a control surface where dispatching
agents to work on code feels like playing SimCity, not typing into a chat window. Lasso
buildings, choose a role, hit dispatch — a real Claude Code session spins up in a worktree
and you watch its UFO fly to the target, land, and start working. Errors propagate visually.
You respond by dispatching more agents or reassigning. The chat interface becomes the
*fallback*, not the primary interaction.

### The SimCity Analogy

| SimCity | Agent City |
|---------|-----------|
| Zone residential/commercial | Lasso files, choose a role (refactor, fix-bug, add-test) |
| Place a building | Dispatch an agent to the scope |
| Watch construction trucks arrive | Watch UFO fly to target, tractor beam activates |
| Monitor traffic / crime / fires | Monitor test failures, likely dependency impact, agent health |
| Respond to disasters | Alarm state (sketch-D): red vignette, likely blast radius, rapid-response dispatch |
| Budget management | Token budget, estimated cost, context utilization |
| Advisors panel | Agent roster, activity log, coverage stats |

---

## Phase 1: Visualization

Phase 1 should prove the live city without taking control of the user's machine. The
usable MVP is: repo scan → stable city layout → keyboard selection → details panel →
agentwatch session roster → confidence-scored agent locations. Everything else is polish
or Phase 2.

### P1.1 — Skeleton
Go binary serving embedded static files. Demo mode with synthetic city data. Repo scanner
(Git walk → file metadata). Treemap layout engine. React + Canvas with pan/zoom and
**keyboard navigation from day one** (`H/J/K/L` cursor movement, `Tab` cycling, `Enter`
select, camera keys). Buildings render as wireframe boxes from live or demo data, with a
visible cursor highlight and selected-building details.

### P1.2 — Live Data
File watcher with debounced incremental updates. WebSocket hub (full state on connect,
patches on change). Zustand store. Dependency analyzer with confidence-scored, faint,
toggleable roads. Unknown coverage/test state renders as unknown, not healthy.
Keyboard: `R` toggle roads, `N` toggle labels, `{`/`}` jump districts.

### P1.3 — Agent Display
Agentwatch monitor setup (create sources, configure `EventSink` bridge, start `Run` loop).
Map `session.SessionState` to city agents. Agent roster, activity log, and UFO rendering
with location confidence: solid beam for exact targets, softer/dotted beam for inferred
file targets, district hover for coarse locations, roster-only/edge placement for unknown
locations. Keyboard: `1`–`9` jump to agent, `G`/`Shift+G` cycle agents, `[`/`]` focus
panels, `I` inspect agent.

### P1.4 — Visual Polish
HUD matching the prototype's style but with production legibility. Building details
(window dots when coverage is known, status pips/shapes, edit rings). Minimap. `?`
keyboard shortcut overlay. Bottom strip shows contextual shortcuts. Vignette + scan line
+ grid.

### Post-MVP Visualization

LOD transitions from sketch-C, function-level views, alarm overlays, browser
notifications, and sound are valuable but should not block Phase 1. They depend on the
basic rendering, data confidence, and keyboard model being solid first.

---

## Phase 2: Orchestration

Phase 2 turns the city from a dashboard into a command interface. The core loop:
**select scope → choose role → dispatch agent → monitor → respond to outcomes.**

Phase 2 must be an explicit opt-in mode. It creates worktrees, opens tmux windows,
launches agent CLIs, can burn paid tokens, and can merge branches. The default app should
remain passive until the user enables orchestration for a repo.

### P2.1 — Dispatch Flow (sketch-E)

The three-step dispatch wizard, triggered by `D` key or `Cmd+K`:

**Step 1 — Select scope.** Lasso-drag on the city to select buildings, or click individual
files. Selection shows corner brackets on rooftops (blinking amber), a lasso rectangle
with `SEL · N bldg · N LOC` label, and a scope summary in the right panel.

**Step 2 — Choose role.** Right panel shows role options:

| Role | What it does |
|------|-------------|
| `fix-bug` | Patch failures in selected files |
| `refactor` | Restructure / clean up code |
| `review` | Audit and comment |
| `add-test` | Expand test coverage |
| `docs` | Write or update documentation |
| `optimize` | Performance pass |
| `custom...` | Free-form prompt |

**Step 3 — Dispatch.** System auto-picks an idle agent (or user chooses). Shows estimated
time and cost. Preview pane shows the equivalent CLI command. Hit `Enter` or click
`► DISPATCH` to launch.

Before any local automation runs, the user sees the exact command plan, target worktree
path, selected files, chosen model/agent, and budget cap. Confirmation should be required
per dispatch unless the user has explicitly enabled a trusted fast path.

### P2.2 — Agent Spawning

After confirmation, agent-city can launch a coding session:

```
Dispatch button pressed
  → agent-city backend receives dispatch command
  → spawns Claude Code session in a new worktree + tmux window
  → session targets the selected files with the chosen role as prompt
  → agentwatch monitor detects the new session on next poll (JSONL discovery)
  → EventSink delivers the new session to agent-city
  → UFO appears in the city, flies to target building, begins work
```

**Spawning mechanism:** shell out to the same flow as `/tmux-spawn`:
- `git worktree add .claude/worktrees/<slug> -b worktree-<slug>`
- `tmux new-window -n <slug>`
- Launch `claude --worktree` in the new window with a structured prompt

Spawning should run only after validating that the repo is clean enough for a worktree,
the target branch name is unique, the output path is inside the repo-owned worktree area,
and the requested CLI is installed. Failures should leave a clear activity event and no
partial UI state that implies an agent is working.

The prompt is generated from the dispatch parameters:
```
Role: refactor
Scope: src/auth/session.ts, src/auth/jwt.ts, src/auth/oauth.ts
Budget: ~14 minutes
Instructions: Restructure the AUTH module. Focus on the selected files.
Commit when done.
```

### P2.3 — Alarm State & Response (sketch-D)

When test failures or build breaks are detected, the city can enter alarm mode:

- Red vignette overlay, pulsing
- `▲ CRITICAL` banner with likely blast radius count and time-since-failure
- Lightning paths from error origin to likely affected dependencies
- Affected buildings flash red, smoke lines on `CRIT` status
- Bug origin panel: file, line, error message, stack trace
- **Rapid-response dispatch**: one-click "send agent to fix this" from the alarm panel

The alarm state is the "disaster response" moment — the interface should make it
obvious what broke, what is likely affected, and make dispatching a fix-it agent
effortless.

### P2.4 — Agent Lifecycle in the City

Agents have a visual lifecycle that maps to the orchestration flow:

```
Dispatched  → UFO appears at city edge, ID tag visible
Flying      → UFO follows bezier path to target building (9–12s animation)
Working     → UFO hovers above building, tractor beam active, progress bar in roster
Completed   → Tractor beam retracts, UFO rises, returns to idle position (or next task)
Errored     → Portholes blink red, error details in right panel, alarm if critical
```

**File-level feedback:** as the agent edits files, the corresponding buildings show
yellow edit-pulse rings on their roofs. When the agent runs tests, test buildings
flash their status pips/shapes.

### P2.5 — Merge & Completion

When an agent finishes (agentwatch reports `Lifecycle: "terminal"`):

1. UFO tractor beam retracts, UFO rises above the building
2. Building gets a **"ready to merge"** indicator — green checkmark badge on roof
3. Agent roster shows the session as complete with a `[merge]` action
4. Keyboard: `Enter` on a completed agent's building triggers merge

**Merge flow:**
- Agent-city backend previews the equivalent of `/merge-cleanup <slug>`:
  `git merge worktree-<slug>` into main, then clean up worktree + branch
- The user confirms before merge/cleanup runs unless they have explicitly enabled a
  trusted auto-merge policy for successful agents.
- On successful merge, the city rescans — buildings may appear, disappear, resize, or
  change status as the merged code enters the main working tree
- The visual payoff: you watch the city transform as agent work lands
- On merge conflict: alarm state on the affected buildings, prompt user to resolve
  manually or dispatch a new agent

**Failed agents:**
- If agentwatch reports an unexpected terminal state, the UFO's portholes blink red
- Right panel shows the error details (from the lifecycle event's reason)
- User can: retry (re-dispatch same scope+role), dismiss (kill + clean worktree),
  or inspect (jump to the tmux window via `tmuxTarget`)

### P2.6 — Multi-Agent Coordination

With multiple agents working simultaneously:

- Avoid dispatching two agents to overlapping file scopes (warn in dispatch flow)
- Show dependency roads highlighted when an agent's changes might affect another
  agent's scope, using likely/weak language unless stronger analysis exists
- Activity log shows interleaved events from all agents, color-coded
- Minimap shows all agent positions at a glance

### P2.7 — Command Palette (`Cmd+K`)

Quick-dispatch without the full wizard:
```
> refactor auth/session.ts
> fix-bug api/schema.ts
> add-test ui/Modal.tsx
> review data/
```

Natural language or structured commands. Resolves file paths to buildings,
picks role from keywords, auto-assigns agent.

---

## Sound Design (Post-MVP)

Audio feedback reduces the need to constantly visually scan the city — you hear
what's happening without having to watch every agent. All sounds are subtle, low-volume,
and non-startling. Mutable via `V` key.

| Event | Sound |
|-------|-------|
| Agent dispatched | Soft ascending tone (confirmation) |
| Agent arrives at building | Low thud + tractor beam hum loop |
| Agent completes successfully | Gentle chime (two notes, ascending) |
| Agent errors | Muted warning tone (single low note) |
| Critical alarm (sketch-D) | Slow pulse tone, not jarring — more submarine klaxon than fire alarm |
| Merge successful | Satisfying click + brief shimmer |
| Merge conflict | Discord tone (two dissonant notes) |
| Cursor movement | Very subtle tick (optional, off by default) |

Implementation: Web Audio API. Small set of synthesized tones, no sample files needed.
Volume and individual event toggles in settings.

**Browser notifications:** when the tab is backgrounded, agent completion and error
events fire `Notification` API alerts so you know to come back. Requested on first
dispatch (not on page load — no permission prompt until the user actually does something
that warrants background notification).

---

## Risks

### Phase 1

| Risk | Mitigation |
|------|------------|
| Canvas complexity — reproducing SVG details | Port exact math from prototypes; all primitives have Canvas equivalents. Add details incrementally. |
| Layout instability on repo changes | Deterministic sort; repack only affected district; animate transitions |
| Misleading inferred agent locations | Carry `locationConfidence` through the data model. Render inferred and district-level locations differently from exact targets. |
| Unknown test/coverage data looks healthy | Use explicit `unknown` status and neutral rendering. Never default missing data to `ok`. |
| Dense prototype HUD is hard to read in daily use | Keep the style, but raise production font sizes, declutter labels by zoom/selection, and make rails collapsible/resizable. |
| Agentwatch pre-release API | Agentwatch is pre-release — API may change. Pin to a specific commit in `go.mod`. Wrap agentwatch types behind an internal adapter so API changes are localized to `internal/agents/monitor.go`. |
| Large repos (10k+ files) | LOD system + viewport culling + `--max-depth` flag |
| No CSS offset-path in Canvas | Parametric bezier: `B(t) = (1-t)²P₀ + 2(1-t)tP₁ + t²P₂` |
| WebSocket disconnects | Full snapshot on reconnect; exponential backoff (1s→30s cap) |

### Phase 2

| Risk | Mitigation |
|------|------------|
| Spawning agents is destructive (creates worktrees, tmux windows, burns tokens) | Dispatch preview shows exact command + cost estimate before confirming. Undo = kill session + clean worktree. |
| Overlapping agent scopes cause merge conflicts | Warn during dispatch if selected files overlap an active agent's scope. Show dependency highlighting. |
| Agent sessions are opaque — hard to know what they're actually doing | Agentwatch provides activity state, current tool, context utilization, and message/tool-call counts. City shows this as tractor beam intensity, progress bar, tool name in roster. |
| Cost control — easy to accidentally burn budget | Show token burn rate per agent, cumulative spend, budget caps in dispatch. Auto-pause agents approaching budget limit. |
| Prompt quality — dispatch roles need to produce good agent behavior | Start with well-tested prompt templates per role. `custom...` option for free-form. Iterate on templates based on outcomes. |

---

## Prior Art

**Codebase-as-city visualization** is an established research area:

- [CodeCity](https://wettel.github.io/codecity.html) (2008, Richard Wettel, ICSE) — the
  original. Classes as buildings, packages as districts, metrics as dimensions. Proved the
  city metaphor aids comprehension. Rectangle-packing layout.
- [CodeCharta](https://codecharta.com/) (MaibornWolff, open source) — production descendant.
  Squarified treemap layout (same algorithm we're using), CI pipeline integration, interactive
  3D maps. Static metrics only, no live agents.
- [SoftVis3D](https://softvis3d.com/) — SonarQube plugin, same city metaphor.

**Agent orchestration interfaces** are emerging (2025–2026):

- [AgentCraft](https://www.getagentcraft.com/) — closest competitor. RTS game interface for
  agent orchestration. Agents as units on a map, heat maps for file collisions, spawn/steer
  visually. Uses a generic game map, not the codebase as terrain.
- [Vibe Kanban](https://vibekanban.com/) — kanban board for Claude Code agents. Visual
  task tracking but 2D board, not spatial.
- VS Code Agent HQ — Microsoft's multi-agent orchestration in the IDE.

**Agent City's differentiator:** the terrain *is* the code. You dispatch agents to buildings
that *are* the files they'll edit, and dependency roads show how changes propagate. No other
tool combines the codebase-as-city metaphor with live agent orchestration.

See also: ["From SimCity to AI Coding Agents"](https://medium.com/@sebastianhanke/from-the-gaming-world-to-the-software-development-revolution-028fd35b0ca5)
(Sebastian Hanke, 2025) — articulates the thesis that managing coding agents feels like
playing a strategy game.

---

## Design Reference

All visual specifications live in `code-sim/project/sketches/`:

- **sketch-A-v2.jsx** — primary visual spec (isometric projection, buildings, UFOs, beams, HUD)
- **sd-helpers.jsx** — solarized dark palette, animation timings, font stack
- **sketch-E-assign.jsx** — agent dispatch UX (3-step flow)
- **sketch-D-failure.jsx** — error/alarm state
- **sketch-C-zoom-levels.jsx** — LOD levels (function → codebase)
