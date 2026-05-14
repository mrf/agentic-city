package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/mferree/agent-city/internal/model"
)

func TestHandleGetState_Returns200WithBody(t *testing.T) {
	want := model.CityState{
		RepoInfo: model.RepoInfo{Name: "test-repo", Branch: "main"},
		Stats:    model.RepoStats{FileCount: 5, TotalLOC: 1000},
	}
	srv := New(&fakeState{state: want})
	mux := http.NewServeMux()
	srv.Register(mux)

	req := httptest.NewRequest("GET", "/api/state", nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	var got model.CityState
	if err := json.NewDecoder(w.Body).Decode(&got); err != nil {
		t.Fatalf("decoding response: %v", err)
	}
	if got.RepoInfo.Name != want.RepoInfo.Name {
		t.Errorf("RepoInfo.Name = %q, want %q", got.RepoInfo.Name, want.RepoInfo.Name)
	}
	if got.Stats.FileCount != want.Stats.FileCount {
		t.Errorf("Stats.FileCount = %d, want %d", got.Stats.FileCount, want.Stats.FileCount)
	}
}

func TestHandleGetBuilding_NotFound(t *testing.T) {
	srv := New(&fakeState{state: model.CityState{
		Buildings: []model.Building{{ID: "main.go", Label: "main.go"}},
	}})
	mux := http.NewServeMux()
	srv.Register(mux)

	req := httptest.NewRequest("GET", "/api/buildings/nonexistent.go", nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
}
