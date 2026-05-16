package api

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"net/url"
	"time"

	"github.com/gorilla/websocket"
	"github.com/mferree/agent-city/internal/agents"
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
