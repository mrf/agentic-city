# Agent City — Coding Standards

Go backend + React/TypeScript frontend. Go binary serves embedded frontend as a single
binary. Agents monitored via the `agentwatch` library (in-process, no sidecar needed).

## Quick orientation

```
cmd/agentic-city/main.go        entry point, wire services, embed frontend
internal/
  model/model.go                core data types (CityState, Building, Agent, …)
  repo/                         Git tree walk, file watcher (fsnotify, 500ms debounce)
  deps/                         regex import extractor → Road edges
  agents/                       agentwatch monitor setup, session → city-agent mapping
  layout/                       squarified treemap + shelf packer
  hub/                          WebSocket hub, state assembly, JSON-patch broadcast
  api/                          HTTP server, REST handlers, WS upgrade
web/src/
  store/                        Zustand: cityStore, uiStore, wsMiddleware
  canvas/                       rAF render loop, isometric projection, all renderers
  hud/                          React overlays (TopBar, LeftRail, RightRail, BottomStrip)
  hooks/                        useCityKeyboard, useCameraControls, useAnimationFrame
  orchestration/                Phase 2 dispatch UI (not yet active)
code-sim/                       design reference sketches — read-only, do not modify
```

## Build & run

```bash
# Development (two terminals)
go run ./cmd/agentic-city --repo=/path/to/repo  # backend on :8080
cd web && npm run dev                           # Vite dev server on :5173 (proxies /api /ws)

# Full dev via Makefile
make run            # make build (web + Go) then run binary

# Individual steps
make web            # cd web && npm run build
make build          # make web + go build ./...
make test           # go test ./...
make lint           # go vet ./...
make clean          # rm web/dist + go clean

# Frontend only
cd web && npm run build     # tsc + vite build
cd web && npm run preview   # preview production build
```

Single production binary: `go build -o bin/agentic-city ./cmd/agentic-city`. Embeds
`web/dist/` via `embed.FS`. Run with `./bin/agentic-city --repo=/path/to/repo`.

Demo mode (no real repo needed): `./bin/agentic-city --demo`

---

## Go standards

### Testing

Run tests with `go test ./internal/deps/...` (single package) or `go test ./...`
(full suite). Use table-driven tests for anything with more than two cases:

```go
func TestExtractImports(t *testing.T) {
    cases := []struct {
        name     string
        src      string
        wantIDs  []string
    }{
        {"ts named import", `import { foo } from "./bar"`, []string{"./bar"}},
        {"ts require", `const x = require("./baz")`, []string{"./baz"}},
    }
    for _, tc := range cases {
        t.Run(tc.name, func(t *testing.T) {
            got := extractImports(tc.src)
            // assert …
        })
    }
}
```

### A+ Report Card — enforced rules

Target zero findings across: `golint`, `go vet`, `gofmt`, `gocyclo`, `ineffassign`,
`misspell`, `staticcheck`.

**Formatting:** always `gofmt`-clean. Run `gofmt -w .` before committing.

**Linting:** `go vet ./...` must be clean. Install and run `staticcheck ./...` for
additional checks.

**Cyclomatic complexity:** keep functions under complexity 10. Split large switch blocks
and nested conditionals into named helpers.

**Error handling:** every error must be handled. No `_` on error returns except in
`_test.go` when the test intent is clear and documented.

```go
// correct
conn, err := upgrader.Upgrade(w, r, nil)
if err != nil {
    log.Error("ws upgrade failed", "err", err)
    return
}

// wrong — never ignore errors
conn, _ := upgrader.Upgrade(w, r, nil)
```

**No naked returns.** Always return values explicitly in the `return` statement.

```go
// wrong
func parse(s string) (result int, err error) {
    result, err = strconv.Atoi(s)
    return
}

// correct
func parse(s string) (int, error) {
    return strconv.Atoi(s)
}
```

**Structured logging.** Use `log/slog` (stdlib, Go 1.21+). Never `fmt.Println` for
operational output. Always pass contextual key-value pairs:

```go
slog.Info("session discovered", "id", sess.ID, "source", sess.Source)
slog.Error("scan failed", "path", path, "err", err)
```

**Package naming:** short, lowercase, no underscores. One concept per package.

**Interfaces:** define interfaces in the package that uses them, not the package that
implements them. Keep interfaces small (1–3 methods).

**Goroutines:** every goroutine must have a clear owner and a shutdown path. Pass
`context.Context` for cancellation. Never spawn fire-and-forget goroutines without
a `WaitGroup` or `errgroup`.

---

## TypeScript standards

### Strict mode — non-negotiable

`tsconfig.json` already has `"strict": true`. Do not weaken it. The compiler must
emit zero errors on `npm run build`.

**No `any`.** If you don't know the type, use `unknown` and narrow it. If you're
tempted to cast with `as any`, stop and redesign.

```typescript
// wrong
function processEvent(e: any) { … }

// correct
function processEvent(e: unknown) {
  if (!isAgentEvent(e)) return;
  // e is now narrowed
}
```

**Discriminated unions over optional fields.** Model state machines explicitly:

```typescript
// wrong
type Agent = { mode: string; targetId?: string; flyProgress?: number }

// correct
type Agent =
  | { mode: 'idle' }
  | { mode: 'work'; targetId: string; locationConfidence: Confidence }
  | { mode: 'fly'; fromId: string; toId: string; flyProgress: number }
  | { mode: 'error'; errorMsg: string }
```

**Type all function signatures.** Return types on exported functions, parameter types
always. Do not rely on inference for public API shapes.

### Testing

Coverage is required for all new non-UI code. Canvas renderers are tested via
golden-output or unit-level geometry tests on the pure math functions (projection,
packing, treemap); full render tests are not required.

```bash
cd web && npm test
```

### ESLint

ESLint must be clean before committing. Run:

```bash
cd web && npx eslint src --ext .ts,.tsx
```

Do not add `// eslint-disable` comments without a documented reason in the same line.

---

## Both languages — shared rules

### Test first, always

Before writing any implementation:

1. Write a failing test that describes the desired behavior.
2. Run the test suite — confirm it fails for the right reason.
3. Write the minimum implementation to make it pass.
4. Refactor while tests stay green.

This is not optional. If a reviewer sees implementation without a corresponding test
committed first, the PR is returned.

### No speculative abstractions

Build for the current requirement. Three similar lines of code is better than a
premature abstraction. Extract only when the third real use case appears.

### Boundaries and validation

Validate at system boundaries: HTTP request bodies, WebSocket messages from the
browser, file system input. Trust internal types — do not re-validate inside a
package what was already validated at the entry point.

### Error propagation

Errors propagate up to the handler that can make a user-visible decision. Don't swallow
errors mid-stack just to avoid threading them through returns. Don't wrap errors
unnecessarily — use `fmt.Errorf("context: %w", err)` in Go for errors that need
context, bare `err` returns otherwise.

---

## Keyboard-first UI requirement

The entire interface must be fully operable without a mouse. This is a hard constraint
from day one, not post-launch polish. See `DESIGN.md` for the full keyboard binding
table. When adding any new interactive element, it must have:

- A keyboard binding or tab-focusable path
- A visible focus indicator
- A listing in `BottomStrip.tsx` or the `?` overlay

---

## Design reference

Visual specs live in `code-sim/project/sketches/` — treat them as the source of
truth for rendering math and visual style:

- `sketch-A-v2.jsx` — primary spec (isometric projection, buildings, UFOs, HUD)
- `sd-helpers.jsx` — solarized dark palette, animation timings, font stack
- `sketch-E-assign.jsx` — dispatch UX
- `sketch-D-failure.jsx` — alarm state
- `sketch-C-zoom-levels.jsx` — LOD levels

Port from these files and reference them, but never modify them (see tree above).
