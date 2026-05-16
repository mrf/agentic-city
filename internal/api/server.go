package api

import (
	"net/http"
	"net/url"

	"github.com/mferree/agent-city/internal/agents"
	"github.com/mferree/agent-city/internal/model"
)

// StateProvider abstracts city state access for the API layer.
type StateProvider interface {
	GetState() model.CityState
}

// ActivitySink can append activity events and notify connected clients.
type ActivitySink interface {
	AddActivity(ev model.ActivityEvent)
}

// Notifier triggers a broadcast to connected WebSocket clients.
type Notifier interface {
	Notify()
}

// Server holds shared dependencies for all HTTP handlers.
type Server struct {
	state     StateProvider
	wsHandler http.HandlerFunc
	spawner   *agents.Spawner
	sink      ActivitySink
	notifier  Notifier
	devMode   bool
}

// New creates an API Server backed by the given StateProvider.
func New(state StateProvider) *Server {
	return &Server{state: state}
}

// WithDevMode controls CORS behaviour. In dev mode (default: false) the
// Access-Control-Allow-Origin header is set to "*". In production mode only
// requests from localhost origins are allowed.
func (s *Server) WithDevMode(dev bool) *Server {
	s.devMode = dev
	return s
}

// setCORSHeaders sets the Access-Control-Allow-Origin response header.
// In dev mode it uses the wildcard "*". Otherwise it reflects the request
// Origin only when it is a localhost address.
func (s *Server) setCORSHeaders(w http.ResponseWriter, r *http.Request) {
	if s.devMode {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		return
	}
	origin := r.Header.Get("Origin")
	if isLocalhostOrigin(origin) {
		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Add("Vary", "Origin")
	}
}

// isLocalhostOrigin reports whether origin refers to a localhost address.
func isLocalhostOrigin(origin string) bool {
	if origin == "" {
		return false
	}
	u, err := url.Parse(origin)
	if err != nil {
		return false
	}
	host := u.Hostname()
	return host == "localhost" || host == "127.0.0.1" || host == "::1"
}

// WithWSHandler replaces the default WebSocket stub with h (e.g. hub.Hub.ServeWS).
func (s *Server) WithWSHandler(h http.HandlerFunc) *Server {
	s.wsHandler = h
	return s
}

// WithSpawner enables the POST /api/dispatch endpoint.
func (s *Server) WithSpawner(sp *agents.Spawner, sink ActivitySink, notifier Notifier) *Server {
	s.spawner = sp
	s.sink = sink
	s.notifier = notifier
	return s
}

// Register mounts all API routes onto mux.
func (s *Server) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/state", s.handleGetState)
	mux.HandleFunc("GET /api/buildings/{id...}", s.handleGetBuilding)
	if s.spawner != nil {
		mux.HandleFunc("POST /api/dispatch", s.handleDispatch)
	}
	if s.wsHandler != nil {
		mux.HandleFunc("GET /ws", s.wsHandler)
	} else {
		mux.HandleFunc("GET /ws", s.handleWebSocket)
	}
}
