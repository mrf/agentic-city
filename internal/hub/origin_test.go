package hub

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCheckOriginRejectsArbitraryOrigins(t *testing.T) {
	tests := []struct {
		name       string
		host       string
		origin     string
		wantAllow  bool
	}{
		{
			name:      "same host allowed",
			host:      "localhost:8080",
			origin:    "http://localhost:8080",
			wantAllow: true,
		},
		{
			name:      "empty origin allowed (same-origin request)",
			host:      "localhost:8080",
			origin:    "",
			wantAllow: true,
		},
		{
			name:      "cross-origin rejected",
			host:      "localhost:8080",
			origin:    "http://evil.example.com",
			wantAllow: false,
		},
		{
			name:      "subdomain rejected",
			host:      "app.example.com",
			origin:    "http://evil.app.example.com",
			wantAllow: false,
		},
		{
			name:      "different port rejected",
			host:      "localhost:8080",
			origin:    "http://localhost:9000",
			wantAllow: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := httptest.NewRequest(http.MethodGet, "/ws", nil)
			r.Host = tt.host
			if tt.origin != "" {
				r.Header.Set("Origin", tt.origin)
			}
			got := checkOrigin(r)
			if got != tt.wantAllow {
				t.Errorf("checkOrigin(%q, Origin=%q) = %v, want %v",
					tt.host, tt.origin, got, tt.wantAllow)
			}
		})
	}
}
