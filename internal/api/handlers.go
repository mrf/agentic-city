package api

import (
	"encoding/json"
	"log"
	"net/http"
	"net/url"

	"github.com/gorilla/websocket"
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

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	if err := json.NewEncoder(w).Encode(v); err != nil {
		log.Printf("api: encode json: %v", err)
	}
}

func (s *Server) handleGetState(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, s.state.GetState())
}

func (s *Server) handleGetBuilding(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		http.Error(w, "missing building id", http.StatusBadRequest)
		return
	}

	for _, b := range s.state.GetState().Buildings {
		if b.ID == id {
			writeJSON(w, b)
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
		log.Printf("api: ws upgrade: %v", err)
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
		log.Printf("api: ws write: %v", err)
		return
	}

	// Block until the client disconnects.
	for {
		if _, _, err := conn.NextReader(); err != nil {
			break
		}
	}
}
