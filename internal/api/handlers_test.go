package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/mferree/agent-city/internal/agents"
	"github.com/mferree/agent-city/internal/model"
)

type fakeState struct {
	state model.CityState
}

func (f *fakeState) GetState() model.CityState { return f.state }

type fakeSink struct {
	events []model.ActivityEvent
}

func (f *fakeSink) AddActivity(ev model.ActivityEvent) {
	f.events = append(f.events, ev)
}

type fakeNotifier struct {
	called int
}

func (f *fakeNotifier) Notify() { f.called++ }

func TestHandleGetBuilding(t *testing.T) {
	tests := []struct {
		name string
		id   string
	}{
		{"slashed ID", "internal/hub/hub.go"},
		{"simple ID", "main.go"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			srv := New(&fakeState{
				state: model.CityState{
					Buildings: []model.Building{
						{ID: tt.id, Label: tt.id},
					},
				},
			})
			mux := http.NewServeMux()
			srv.Register(mux)

			req := httptest.NewRequest("GET", "/api/buildings/"+tt.id, nil)
			w := httptest.NewRecorder()
			mux.ServeHTTP(w, req)

			if w.Code != http.StatusOK {
				t.Fatalf("expected 200, got %d", w.Code)
			}

			var b model.Building
			if err := json.NewDecoder(w.Body).Decode(&b); err != nil {
				t.Fatalf("decoding response: %v", err)
			}
			if b.ID != tt.id {
				t.Fatalf("expected ID %q, got %q", tt.id, b.ID)
			}
		})
	}
}

func TestHandleDispatch_NoSpawner(t *testing.T) {
	srv := New(&fakeState{})
	mux := http.NewServeMux()
	srv.Register(mux)

	body := `{"slug":"test","role":"refactor"}`
	req := httptest.NewRequest("POST", "/api/dispatch", strings.NewReader(body))
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	// Without a spawner, the route is not registered → 404
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404 when spawner not wired, got %d", w.Code)
	}
}

func TestHandleDispatch_InvalidBody(t *testing.T) {
	sink := &fakeSink{}
	notifier := &fakeNotifier{}
	sp := agents.NewSpawner("/nonexistent")

	srv := New(&fakeState{})
	srv.WithSpawner(sp, sink, notifier)
	mux := http.NewServeMux()
	srv.Register(mux)

	req := httptest.NewRequest("POST", "/api/dispatch", strings.NewReader("not json"))
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for invalid JSON, got %d", w.Code)
	}
}

func TestHandleDispatch_ValidationFailure(t *testing.T) {
	sink := &fakeSink{}
	notifier := &fakeNotifier{}
	// Spawner pointed at nonexistent repo — validation will fail
	sp := agents.NewSpawner("/nonexistent")

	srv := New(&fakeState{})
	srv.WithSpawner(sp, sink, notifier)
	mux := http.NewServeMux()
	srv.Register(mux)

	body := `{"slug":"test","role":"refactor","scope":["main.go"]}`
	req := httptest.NewRequest("POST", "/api/dispatch", strings.NewReader(body))
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	// Response should be 200 with an error field (spawner validation fails)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 with error body, got %d", w.Code)
	}

	var resp map[string]string
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("decoding response: %v", err)
	}
	if resp["error"] == "" {
		t.Fatal("expected error field in response")
	}

	// Activity event should have been emitted
	if len(sink.events) == 0 {
		t.Fatal("expected activity event for dispatch failure")
	}
	if sink.events[0].Severity != "error" {
		t.Fatalf("expected error severity, got %q", sink.events[0].Severity)
	}
	if notifier.called == 0 {
		t.Fatal("expected notifier to be called")
	}
}
