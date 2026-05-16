package main

import (
	"context"
	"flag"
	"fmt"
	"io/fs"
	"log"
	"math"
	"math/rand"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"github.com/mferree/agent-city/internal/agents"
	"github.com/mferree/agent-city/internal/api"
	"github.com/mferree/agent-city/internal/city"
	"github.com/mferree/agent-city/internal/deps"
	"github.com/mferree/agent-city/internal/hub"
	"github.com/mferree/agent-city/internal/model"
	"github.com/mferree/agent-city/internal/repo"
	agentcityweb "github.com/mferree/agent-city/web"
)

func main() {
	demo := flag.Bool("demo", false, "Run in demo mode with synthetic city data")
	addr := flag.String("addr", ":8080", "HTTP listen address")
	repoPath := flag.String("repo", ".", "Path to the git repository to visualise")
	coveragePath := flag.String("coverage", "", "Path to coverage file (coverage.out, lcov.info, coverage.json); auto-detected if empty")
	testResultsPath := flag.String("test-results", "", "Path to test result file (JUnit XML or Go test JSON); auto-detected if empty")
	flag.Parse()

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	mux := http.NewServeMux()

	var cityState *hub.State
	var buildCfg city.BuildConfig

	if *demo {
		s := generateDemoState()
		cityState = hub.NewState(s)
		log.Printf("demo mode: %d districts, %d buildings, %d agents",
			len(s.Districts), len(s.Buildings), len(s.Agents))
	} else {
		buildCfg = city.BuildConfig{
			DepsCfg: deps.Config{ModuleName: readModuleName(*repoPath)},
		}

		initial, err := city.BuildState(*repoPath, buildCfg)
		if err != nil {
			log.Printf("live mode: initial scan failed (%v) — serving empty state", err)
			initial = model.CityState{Timestamp: time.Now().UnixMilli()}
		} else {
			log.Printf("live mode: scanned %d buildings in %d districts",
				len(initial.Buildings), len(initial.Districts))
		}

		cityState = hub.NewState(initial)
	}

	h := hub.New(cityState)
	go h.Run(ctx)

	if !*demo {
		tracker := agents.StartMonitor(ctx, *repoPath, cityState, h)
		go runWatcher(ctx, *repoPath, buildCfg, cityState, h, tracker)

		if mw := buildMetricsWatcher(*repoPath, *coveragePath, *testResultsPath, readModuleName(*repoPath)); mw != nil {
			if err := mw.Start(); err != nil {
				log.Printf("metrics watcher: start failed: %v", err)
				mw.Stop()
			} else {
				go runMetricsWatcher(ctx, mw, cityState, h)
			}
		}
	}

	// Dev mode: --demo flag or --repo not explicitly set (default ".").
	repoExplicitlySet := false
	flag.Visit(func(f *flag.Flag) {
		if f.Name == "repo" {
			repoExplicitlySet = true
		}
	})
	devMode := *demo || !repoExplicitlySet

	api.New(cityState).WithDevMode(devMode).WithWSHandler(h.ServeWS).Register(mux)

	distFS, err := fs.Sub(agentcityweb.Dist, "dist")
	if err != nil {
		log.Printf("static embed unavailable: %v", err)
	} else {
		mux.Handle("/", http.FileServer(http.FS(distFS)))
	}

	srv := &http.Server{
		Addr:    *addr,
		Handler: mux,
	}

	go func() {
		log.Printf("agent-city listening on %s", *addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server error: %v", err)
		}
	}()

	<-ctx.Done()
	log.Printf("shutting down...")

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Printf("shutdown error: %v", err)
	}
}

func generateDemoState() model.CityState {
	rng := rand.New(rand.NewSource(42))

	districts := makeDemoDistricts()
	buildings := makeDemoBuildings(rng, districts)
	agents := makeDemoAgents(rng, buildings)
	activities := makeDemoActivities()

	var totalLOC int
	var coveredCount int
	var coverageSum float64
	for _, b := range buildings {
		totalLOC += b.LOC
		if b.Coverage >= 0 {
			coverageSum += b.Coverage
			coveredCount++
		}
	}
	var avgCoverage float64
	if coveredCount > 0 {
		avgCoverage = coverageSum / float64(coveredCount)
	}

	return model.CityState{
		RepoInfo: model.RepoInfo{
			Name:       "agent-city",
			Branch:     "main",
			HeadCommit: "ada42f8",
			CIStatus:   "passing",
		},
		Districts:  districts,
		Buildings:  buildings,
		Roads:      makeDemoRoads(buildings, rng),
		Agents:     agents,
		Activities: activities,
		Stats: model.RepoStats{
			FileCount:    len(buildings),
			TotalLOC:     totalLOC,
			Coverage:     avgCoverage,
			OpenPRs:      3,
			BugCount:     2,
			TestsPassing: 47,
			TestsTotal:   52,
		},
		Timestamp: time.Now().UnixMilli(),
	}
}

func makeDemoDistricts() []model.District {
	return []model.District{
		{ID: "cmd/agentic-city", Label: "CMD/", ParentID: "", GX: 0, GY: 0, GW: 10, GH: 8},
		{ID: "internal/model", Label: "MODEL/", ParentID: "internal", GX: 10, GY: 0, GW: 8, GH: 8},
		{ID: "internal/agents", Label: "AGENTS/", ParentID: "internal", GX: 18, GY: 0, GW: 12, GH: 10},
		{ID: "internal/layout", Label: "LAYOUT/", ParentID: "internal", GX: 0, GY: 8, GW: 14, GH: 10},
		{ID: "internal/hub", Label: "HUB/", ParentID: "internal", GX: 14, GY: 8, GW: 16, GH: 10},
	}
}

type demoFile struct {
	name       string
	districtID string
	lang       string
	loc        int
}

func makeDemoBuildings(rng *rand.Rand, districts []model.District) []model.Building {
	files := []demoFile{
		// cmd/agentic-city
		{"main.go", "cmd/agentic-city", "go", 180},
		{"server.go", "cmd/agentic-city", "go", 95},

		// internal/model
		{"model.go", "internal/model", "go", 120},
		{"types.go", "internal/model", "go", 60},

		// internal/agents
		{"tracker.go", "internal/agents", "go", 210},
		{"racer.go", "internal/agents", "go", 175},
		{"spawner.go", "internal/agents", "go", 140},
		{"prompts.go", "internal/agents", "go", 85},
		{"session.go", "internal/agents", "go", 130},
		{"mapper.go", "internal/agents", "go", 95},

		// internal/layout
		{"treemap.go", "internal/layout", "go", 280},
		{"packer.go", "internal/layout", "go", 190},
		{"engine.go", "internal/layout", "go", 245},
		{"coords.go", "internal/layout", "go", 75},

		// internal/hub
		{"hub.go", "internal/hub", "go", 310},
		{"state.go", "internal/hub", "go", 220},
		{"client.go", "internal/hub", "go", 145},
		{"broadcast.go", "internal/hub", "go", 110},

		// Synthetic TS/TSX files for variety
		{"App.tsx", "internal/hub", "tsx", 380},
		{"CityCanvas.tsx", "internal/hub", "tsx", 495},
		{"AgentRoster.tsx", "internal/hub", "tsx", 260},
		{"ActivityLog.tsx", "internal/hub", "tsx", 175},
		{"HUD.tsx", "internal/hub", "tsx", 140},
		{"store.ts", "internal/hub", "ts", 95},
		{"api.ts", "internal/hub", "ts", 120},
		{"types.ts", "internal/hub", "ts", 85},
		{"useWebSocket.ts", "internal/hub", "ts", 155},
		{"useCity.ts", "internal/hub", "ts", 90},

		// Python tooling
		{"analyze.py", "internal/agents", "py", 145},
		{"metrics.py", "internal/agents", "py", 210},
	}

	statuses := []string{"ok", "ok", "ok", "warn", "err", "unknown"}

	buildings := make([]model.Building, 0, len(files))

	districtByID := map[string]model.District{}
	districtCursor := map[string][2]float64{}
	for _, d := range districts {
		districtByID[d.ID] = d
		districtCursor[d.ID] = [2]float64{d.GX + 0.5, d.GY + 0.5}
	}

	for i, f := range files {
		loc := f.loc + rng.Intn(100) - 50
		if loc < 50 {
			loc = 50
		}

		coverage := rng.Float64()
		if rng.Intn(5) == 0 {
			coverage = -1 // unknown
		}

		status := statuses[rng.Intn(len(statuses))]

		w := clamp(math.Sqrt(float64(loc)/20.0), 2, 8)
		h := w * 0.8
		z := clamp(float64(loc)/30.0, 3, 30)

		cursor := districtCursor[f.districtID]
		gx := cursor[0]
		gy := cursor[1]

		districtCursor[f.districtID] = [2]float64{gx + w + 0.5, gy}
		if d := districtByID[f.districtID]; gx+w+0.5 > d.GX+d.GW-1 {
			districtCursor[f.districtID] = [2]float64{d.GX + 0.5, gy + h + 0.5}
		}

		buildings = append(buildings, model.Building{
			ID:         f.districtID + "/" + f.name,
			DistrictID: f.districtID,
			Label:      f.name,
			Language:   f.lang,
			LOC:        loc,
			Coverage:   coverage,
			Status:     status,
			Editing:    i < 3 && rng.Intn(3) == 0,
			Exports:    rng.Intn(15),
			GX:         gx,
			GY:         gy,
			GW:         w,
			GH:         h,
			GZ:         z,
		})
	}

	return buildings
}

func makeDemoAgents(rng *rand.Rand, buildings []model.Building) []model.Agent {
	colors := []string{"#4a7a9c", "#4a7a9c", "#6a8a4a", "#b06a3a"} // blue×2, green, orange
	tasks := []string{
		"Implementing WebSocket hub",
		"Refactoring treemap layout",
		"Writing unit tests",
		"Fixing coverage parser",
		"Adding agent tracker",
		"Optimizing packer algorithm",
		"Reviewing API handlers",
		"Debugging race condition",
	}

	agents := make([]model.Agent, 0, 8)

	// 4 working agents — parked on buildings
	for i := 0; i < 4; i++ {
		b := buildings[rng.Intn(len(buildings))]
		agents = append(agents, model.Agent{
			ID:                 fmt.Sprintf("claude:session-%04d", i+1),
			Color:              colors[i%len(colors)],
			Mode:               "work",
			Task:               tasks[i%len(tasks)],
			Progress:           20 + rng.Intn(70),
			TargetID:           b.ID,
			LocationConfidence: "inferred",
		})
	}

	// 4 flying agents — on looping paths between buildings
	for i := 0; i < 4; i++ {
		fromIdx := rng.Intn(len(buildings))
		toIdx := (fromIdx + 1 + rng.Intn(len(buildings)-1)) % len(buildings)
		family := []string{"claude", "codex", "gemini"}[i%3]
		agents = append(agents, model.Agent{
			ID:          fmt.Sprintf("%s:session-%04d", family, i+10),
			Color:       colors[(i+1)%len(colors)],
			Mode:        "fly",
			Task:        tasks[(i+4)%len(tasks)],
			Progress:    rng.Intn(100),
			FromID:      buildings[fromIdx].ID,
			ToID:        buildings[toIdx].ID,
			FlyProgress: rng.Float64(),
		})
	}

	return agents
}

func makeDemoRoads(buildings []model.Building, rng *rand.Rand) []model.Road {
	roads := make([]model.Road, 0, 20)
	confidences := []string{"exact", "inferred", "weak"}
	for i := 0; i < 20 && i < len(buildings)-1; i++ {
		from := buildings[i]
		to := buildings[(i+3+rng.Intn(5))%len(buildings)]
		if from.ID == to.ID {
			continue
		}
		roads = append(roads, model.Road{
			FromID:     from.ID,
			ToID:       to.ID,
			Weight:     1 + rng.Intn(5),
			Confidence: confidences[rng.Intn(len(confidences))],
		})
	}
	return roads
}

func makeDemoActivities() []model.ActivityEvent {
	now := time.Now()
	entries := []struct {
		ago      time.Duration
		who      string
		message  string
		color    string
		severity string
	}{
		{5 * time.Second, "claude:session-0001", "Wrote hub.go — broadcast fan-out complete", "#4a7a9c", "info"},
		{23 * time.Second, "CI", "Test suite: 47/52 passing", "#6a8a4a", "warn"},
		{45 * time.Second, "claude:session-0002", "Refactored treemap — squarified algorithm", "#4a7a9c", "info"},
		{2 * time.Minute, "codex:session-0010", "Added Python metrics analyzer", "#6a8a4a", "info"},
		{3 * time.Minute, "claude:session-0003", "Fixed race condition in watcher debounce", "#4a7a9c", "info"},
		{5 * time.Minute, "YOU", "Dispatched 3 agents to layout work", "#b06a3a", "info"},
		{8 * time.Minute, "CI", "Build failed: missing import path", "#dc322f", "error"},
		{12 * time.Minute, "gemini:session-0012", "Exploring dependency graph edges", "#b06a3a", "info"},
	}

	activities := make([]model.ActivityEvent, 0, len(entries))
	for _, e := range entries {
		activities = append(activities, model.ActivityEvent{
			Timestamp: now.Add(-e.ago).Format(time.RFC3339),
			Who:       e.who,
			Message:   e.message,
			Color:     e.color,
			Severity:  e.severity,
		})
	}
	return activities
}

func clamp(v, lo, hi float64) float64 {
	return max(lo, min(hi, v))
}

// runWatcher watches repoPath for file changes and applies them to cityState,
// then calls h.Notify() so the hub broadcasts a patch to all connected clients.
//
// Structural changes (creates/deletes/renames) trigger a full rescan to keep
// the layout consistent. Content-only changes are merged incrementally.
// Agents and Activities are always preserved across refreshes.
//
// When tracker is non-nil, each changed file is fed as a FileEvent so the
// tracker can correlate file activity with agent working directories.
func runWatcher(ctx context.Context, repoPath string, cfg city.BuildConfig, state *hub.State, h *hub.Hub, tracker *agents.Tracker) {
	w, err := repo.NewWatcher(repoPath, cfg.ScanCfg)
	if err != nil {
		log.Printf("watcher: init failed: %v", err)
		return
	}
	if err := w.Start(); err != nil {
		log.Printf("watcher: start failed: %v", err)
		return
	}
	defer w.Stop()

	absRepo, _ := filepath.Abs(repoPath)

	for {
		select {
		case <-ctx.Done():
			return

		case update, ok := <-w.Updates:
			if !ok {
				return
			}

			// Feed file events to the tracker for agent location inference.
			if tracker != nil {
				now := time.Now()
				for _, b := range update.Buildings {
					if b.ID == "" {
						continue
					}
					tracker.ObserveFileEvent(agents.FileEvent{
						AbsPath: filepath.Join(absRepo, filepath.FromSlash(b.ID)),
						At:      now,
					})
				}
			}

			if update.HasStructural {
				// A file was created, deleted, or renamed — full rescan to
				// recompute layout and dependency graph.
				next, err := city.BuildState(repoPath, cfg)
				if err != nil {
					log.Printf("watcher: full rescan failed: %v", err)
					continue
				}
				curr := state.GetState()
				next.Agents = curr.Agents
				next.Activities = curr.Activities
				state.SetState(next)
				log.Printf("watcher: full rescan — %d buildings", len(next.Buildings))
			} else {
				// Content-only changes — merge incrementally.
				curr := state.GetState()
				next := city.MergeBuildings(curr, update.Buildings)
				state.SetState(next)
			}

			if h != nil {
				h.Notify()
			}
		}
	}
}

// buildMetricsWatcher constructs a MetricsWatcher using explicit paths when
// provided, falling back to auto-detection of well-known filenames at repoPath.
// Returns nil when no coverage or test-result files are found.
func buildMetricsWatcher(repoPath, coveragePath, testResultsPath, modulePath string) *repo.MetricsWatcher {
	coverageFiles, testResultFiles := autoDetectMetricsFiles(repoPath)

	if coveragePath != "" {
		coverageFiles = []string{coveragePath}
	}
	if testResultsPath != "" {
		testResultFiles = []string{testResultsPath}
	}

	if len(coverageFiles) == 0 && len(testResultFiles) == 0 {
		return nil
	}

	log.Printf("metrics watcher: coverage=%v test-results=%v", coverageFiles, testResultFiles)

	mw, err := repo.NewMetricsWatcher(repo.MetricsConfig{
		CoverageFiles:   coverageFiles,
		TestResultFiles: testResultFiles,
		RepoRoot:        repoPath,
		ModulePath:      modulePath,
	})
	if err != nil {
		log.Printf("metrics watcher: init failed: %v", err)
		return nil
	}
	return mw
}

// autoDetectMetricsFiles scans repoPath for well-known coverage and test-result
// filenames and returns their absolute paths grouped by type.
func autoDetectMetricsFiles(repoPath string) (coverageFiles, testResultFiles []string) {
	for _, name := range []string{"coverage.out", "lcov.info", "coverage.json"} {
		p := filepath.Join(repoPath, name)
		if _, err := os.Stat(p); err == nil {
			coverageFiles = append(coverageFiles, p)
		}
	}
	for _, name := range []string{"test-results.xml", "test-results.json"} {
		p := filepath.Join(repoPath, name)
		if _, err := os.Stat(p); err == nil {
			testResultFiles = append(testResultFiles, p)
		}
	}
	return coverageFiles, testResultFiles
}

// runMetricsWatcher consumes MetricsWatcher updates and applies coverage and
// test status to all buildings in state, notifying connected clients via h.
func runMetricsWatcher(ctx context.Context, mw *repo.MetricsWatcher, state *hub.State, h *hub.Hub) {
	defer mw.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case src, ok := <-mw.Updates:
			if !ok {
				return
			}
			curr := state.GetState()
			next := city.ApplyMetrics(curr, src)
			state.SetState(next)
			if h != nil {
				h.Notify()
			}
		}
	}
}

// readModuleName reads the Go module name from go.mod at repoRoot.
// Returns an empty string if go.mod is missing or malformed.
func readModuleName(repoRoot string) string {
	data, err := os.ReadFile(filepath.Join(repoRoot, "go.mod"))
	if err != nil {
		return ""
	}
	for _, line := range strings.Split(string(data), "\n") {
		if after, ok := strings.CutPrefix(strings.TrimSpace(line), "module "); ok {
			return strings.TrimSpace(after)
		}
	}
	return ""
}
