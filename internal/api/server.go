package api

import (
	"net/http"

	"github.com/mferree/agent-city/internal/model"
)

// StateProvider abstracts city state access for the API layer.
type StateProvider interface {
	GetState() model.CityState
}

// Server holds shared dependencies for all HTTP handlers.
type Server struct {
	state     StateProvider
	wsHandler http.HandlerFunc
}

// New creates an API Server backed by the given StateProvider.
func New(state StateProvider) *Server {
	return &Server{state: state}
}

// WithWSHandler replaces the default WebSocket stub with h (e.g. hub.Hub.ServeWS).
func (s *Server) WithWSHandler(h http.HandlerFunc) *Server {
	s.wsHandler = h
	return s
}

// Register mounts all API routes onto mux.
func (s *Server) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/state", s.handleGetState)
	mux.HandleFunc("GET /api/buildings/{id}", s.handleGetBuilding)
	if s.wsHandler != nil {
		mux.HandleFunc("GET /ws", s.wsHandler)
	} else {
		mux.HandleFunc("GET /ws", s.handleWebSocket)
	}
}
