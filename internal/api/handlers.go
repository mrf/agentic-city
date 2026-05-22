package api

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
	"path"
	"time"

	"github.com/gorilla/websocket"
	"github.com/mferree/agent-city/internal/agents"
	"github.com/mferree/agent-city/internal/city"
	"github.com/mferree/agent-city/internal/model"
)

// upgrader is used only by the fallback handleWebSocket stub.
var upgrader = websocket.Upgrader{CheckOrigin: checkOrigin}

func checkOrigin(r *http.Request) bool {
	origin := r.Header.Get("Origin")
	if origin == "" {
		return true
	}
	u, err := url.Parse(origin)
	if err != nil {
		return false
	}
	return u.Host == r.Host
}

func (s *Server) writeJSON(w http.ResponseWriter, r *http.Request, v any) {
	s.setCORSHeaders(w, r)
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(v); err != nil {
		slog.Error("json encode failed", "err", err)
	}
}

func (s *Server) handleGetState(w http.ResponseWriter, r *http.Request) {
	s.writeJSON(w, r, s.state.GetState())
}

func (s *Server) handleGetBuilding(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		http.Error(w, "missing building id", http.StatusBadRequest)
		return
	}

	for _, b := range s.state.GetState().Buildings {
		if b.ID == id {
			s.writeJSON(w, r, b)
			return
		}
	}

	http.Error(w, "building not found", http.StatusNotFound)
}

// handleWebSocket upgrades the connection and sends a single state.full
// message. Full hub with real-time updates is planned for P1.2.
func (s *Server) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		slog.Error("ws upgrade failed", "err", err)
		return
	}
	defer conn.Close()

	msg := struct {
		Type string `json:"type"`
		Data any    `json:"data"`
	}{
		Type: "state.full",
		Data: s.state.GetState(),
	}
	if err := conn.WriteJSON(msg); err != nil {
		slog.Error("ws write failed", "err", err)
		return
	}

	// Block until the client disconnects.
	for {
		if _, _, err := conn.NextReader(); err != nil {
			break
		}
	}
}

// handleGetCoverageHistory returns all stored coverage snapshots in
// chronological order (oldest first).
func (s *Server) handleGetCoverageHistory(w http.ResponseWriter, r *http.Request) {
	snaps := s.history.Snapshots()
	s.writeJSON(w, r, map[string]any{"snapshots": snaps})
}

// handleDispatch spawns a new agent session (worktree + tmux + claude).
func (s *Server) handleDispatch(w http.ResponseWriter, r *http.Request) {
	var req agents.SpawnRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	result, err := s.spawner.Spawn(req)
	if err != nil {
		slog.Error("dispatch failed", "slug", req.Slug, "err", err)
		s.emitActivity("YOU", "Dispatch failed: "+err.Error(), "#dc322f", "error")
		s.writeJSON(w, r, map[string]string{"error": err.Error()})
		return
	}

	slog.Info("dispatch succeeded", "slug", result.Slug, "branch", result.Branch)
	s.emitActivity("YOU", "Dispatched agent "+result.Slug+" ("+req.Role+")", "#6a8a4a", "info")
	s.writeJSON(w, r, result)
}

// handleGetSettings returns the current settings as JSON.
func (s *Server) handleGetSettings(w http.ResponseWriter, r *http.Request) {
	s.writeJSON(w, r, s.state.GetState().Settings)
}

// handleUpdateSettings parses a new Settings value, applies it to the state,
// re-marks coverage thresholds, and emits activity events for any buildings that
// newly drop below threshold as a result of the change.
func (s *Server) handleUpdateSettings(w http.ResponseWriter, r *http.Request) {
	var newSettings model.Settings
	if err := json.NewDecoder(r.Body).Decode(&newSettings); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if newSettings.CoverageThreshold < 0 || newSettings.CoverageThreshold > 1 {
		http.Error(w, "coverageThreshold must be between 0 and 1", http.StatusBadRequest)
		return
	}
	for districtID, t := range newSettings.DistrictThresholds {
		if t < 0 || t > 1 {
			http.Error(w, fmt.Sprintf("districtThreshold for %q must be between 0 and 1", districtID), http.StatusBadRequest)
			return
		}
	}
	if newSettings.DistrictThresholds == nil {
		newSettings.DistrictThresholds = map[string]float64{}
	}

	var crossings []string
	s.updater.Update(func(curr model.CityState) model.CityState {
		prev := curr
		curr.Settings = newSettings
		next := city.MarkCoverageThresholds(curr)
		crossings = city.DetectThresholdCrossings(prev, next)
		return next
	})

	for _, id := range crossings {
		label := path.Base(id)
		s.emitActivity("COV", fmt.Sprintf("Coverage below threshold: %s", label), "#b58900", "warn")
		slog.Info("coverage threshold crossed", "file", id)
	}

	if s.notifier != nil && len(crossings) == 0 {
		// Settings changed but no new crossings — still broadcast the settings update.
		s.notifier.Notify()
	}

	s.writeJSON(w, r, s.state.GetState().Settings)
}

// emitActivity pushes an ActivityEvent into the hub state and triggers a broadcast.
func (s *Server) emitActivity(who, message, color, severity string) {
	if s.sink == nil {
		return
	}
	s.sink.AddActivity(model.ActivityEvent{
		Timestamp: time.Now().Format(time.RFC3339),
		Who:       who,
		Message:   message,
		Color:     color,
		Severity:  severity,
	})
	if s.notifier != nil {
		s.notifier.Notify()
	}
}
