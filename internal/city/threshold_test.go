package city

import (
	"testing"

	"github.com/mferree/agent-city/internal/model"
)

func TestMarkCoverageThresholds(t *testing.T) {
	cases := []struct {
		name     string
		settings model.Settings
		building model.Building
		want     bool
	}{
		{
			name:     "above global threshold",
			settings: model.Settings{CoverageThreshold: 0.6, DistrictThresholds: map[string]float64{}},
			building: model.Building{ID: "a.go", DistrictID: "core", Coverage: 0.7},
			want:     false,
		},
		{
			name:     "below global threshold",
			settings: model.Settings{CoverageThreshold: 0.6, DistrictThresholds: map[string]float64{}},
			building: model.Building{ID: "b.go", DistrictID: "core", Coverage: 0.5},
			want:     true,
		},
		{
			name:     "below district threshold override",
			settings: model.Settings{CoverageThreshold: 0.6, DistrictThresholds: map[string]float64{"auth": 0.8}},
			building: model.Building{ID: "c.go", DistrictID: "auth", Coverage: 0.75},
			want:     true,
		},
		{
			name:     "above district threshold override",
			settings: model.Settings{CoverageThreshold: 0.6, DistrictThresholds: map[string]float64{"auth": 0.8}},
			building: model.Building{ID: "d.go", DistrictID: "auth", Coverage: 0.85},
			want:     false,
		},
		{
			name:     "unknown coverage not warned",
			settings: model.Settings{CoverageThreshold: 0.6, DistrictThresholds: map[string]float64{}},
			building: model.Building{ID: "e.go", DistrictID: "core", Coverage: -1},
			want:     false,
		},
		{
			name:     "exactly at threshold not warned",
			settings: model.Settings{CoverageThreshold: 0.6, DistrictThresholds: map[string]float64{}},
			building: model.Building{ID: "f.go", DistrictID: "core", Coverage: 0.6},
			want:     false,
		},
		{
			name:     "zero coverage warned",
			settings: model.Settings{CoverageThreshold: 0.6, DistrictThresholds: map[string]float64{}},
			building: model.Building{ID: "g.go", DistrictID: "core", Coverage: 0.0},
			want:     true,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			state := model.CityState{
				Settings:  tc.settings,
				Buildings: []model.Building{tc.building},
			}
			result := MarkCoverageThresholds(state)
			if len(result.Buildings) != 1 {
				t.Fatalf("expected 1 building, got %d", len(result.Buildings))
			}
			got := result.Buildings[0].CoverageWarn
			if got != tc.want {
				t.Errorf("CoverageWarn = %v, want %v (coverage=%.2f, threshold=%.2f)",
					got, tc.want, tc.building.Coverage, tc.settings.CoverageThreshold)
			}
		})
	}
}

func TestMarkCoverageThresholds_OriginalUnchanged(t *testing.T) {
	state := model.CityState{
		Settings: model.Settings{CoverageThreshold: 0.6, DistrictThresholds: map[string]float64{}},
		Buildings: []model.Building{
			{ID: "a.go", DistrictID: "core", Coverage: 0.4},
		},
	}
	_ = MarkCoverageThresholds(state)
	if state.Buildings[0].CoverageWarn {
		t.Error("MarkCoverageThresholds mutated original state")
	}
}

func TestDetectThresholdCrossings(t *testing.T) {
	cases := []struct {
		name   string
		before []model.Building
		after  []model.Building
		want   []string
	}{
		{
			name: "one newly crossed",
			before: []model.Building{
				{ID: "a.go", CoverageWarn: false},
				{ID: "b.go", CoverageWarn: true},
				{ID: "c.go", CoverageWarn: false},
			},
			after: []model.Building{
				{ID: "a.go", CoverageWarn: true},
				{ID: "b.go", CoverageWarn: true},
				{ID: "c.go", CoverageWarn: false},
			},
			want: []string{"a.go"},
		},
		{
			name: "none crossed",
			before: []model.Building{
				{ID: "a.go", CoverageWarn: false},
			},
			after: []model.Building{
				{ID: "a.go", CoverageWarn: false},
			},
			want: nil,
		},
		{
			name: "recovered not reported",
			before: []model.Building{
				{ID: "a.go", CoverageWarn: true},
			},
			after: []model.Building{
				{ID: "a.go", CoverageWarn: false},
			},
			want: nil,
		},
		{
			name:   "new building below threshold",
			before: []model.Building{},
			after: []model.Building{
				{ID: "a.go", CoverageWarn: true},
			},
			want: []string{"a.go"},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			before := model.CityState{Buildings: tc.before}
			after := model.CityState{Buildings: tc.after}
			got := DetectThresholdCrossings(before, after)

			if len(got) != len(tc.want) {
				t.Fatalf("DetectThresholdCrossings = %v, want %v", got, tc.want)
			}
			for i := range tc.want {
				if got[i] != tc.want[i] {
					t.Errorf("crossing[%d] = %q, want %q", i, got[i], tc.want[i])
				}
			}
		})
	}
}
