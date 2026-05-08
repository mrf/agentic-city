package main

import (
	"flag"
	"fmt"
	"io/fs"
	"log"
	"math"
	"math/rand"
	"net/http"
	"os"
	"time"

	"github.com/mferree/agent-city/internal/api"
	"github.com/mferree/agent-city/internal/model"
	agentcityweb "github.com/mferree/agent-city/web"
)

type staticState struct{ state model.CityState }

func (s staticState) GetState() model.CityState { return s.state }

func main() {
	demo := flag.Bool("demo", false, "Run in demo mode with synthetic city data")
	addr := flag.String("addr", ":8080", "HTTP listen address")
	flag.Parse()

	mux := http.NewServeMux()

	var provider api.StateProvider
	if *demo {
		state := generateDemoState()
		provider = staticState{state}
		log.Printf("demo mode: %d districts, %d buildings, %d agents",
			len(state.Districts), len(state.Buildings), len(state.Agents))
	} else {
		provider = staticState{model.CityState{Timestamp: time.Now().UnixMilli()}}
		log.Printf("live mode: repo scanning not yet implemented — serving empty state")
	}

	api.New(provider).Register(mux)

	distFS, err := fs.Sub(agentcityweb.Dist, "dist")
	if err != nil {
		log.Printf("static embed unavailable: %v", err)
	} else {
		mux.Handle("/", http.FileServer(http.FS(distFS)))
	}

	log.Printf("agent-city listening on %s", *addr)
	if err := http.ListenAndServe(*addr, mux); err != nil {
		fmt.Fprintf(os.Stderr, "server error: %v\n", err)
		os.Exit(1)
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
		{ID: "cmd/agent-city", Label: "CMD/", ParentID: "", GX: 0, GY: 0, GW: 10, GH: 8},
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
		// cmd/agent-city
		{"main.go", "cmd/agent-city", "go", 180},
		{"server.go", "cmd/agent-city", "go", 95},

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
