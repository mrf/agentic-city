package api

import (
	"net/http"

	"github.com/gorilla/websocket"
	"github.com/mferree/agent-city/internal/model"
)

// StateProvider abstracts city state access for the API layer.
type StateProvider interface {
	GetState() model.CityState
}

// Server holds shared dependencies for all HTTP handlers.
type Server struct {
	state    StateProvider
	upgrader websocket.Upgrader
}

// New creates an API Server backed by the given StateProvider.
func New(state StateProvider) *Server {
	return &Server{
		state: state,
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool { return true },
		},
	}
}

// Register mounts all API routes onto mux.
func (s *Server) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/state", s.handleGetState)
	mux.HandleFunc("GET /api/buildings/{id}", s.handleGetBuilding)
	mux.HandleFunc("GET /ws", s.handleWebSocket)
}
