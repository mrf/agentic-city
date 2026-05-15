package layout

import (
	"fmt"
	"math"
	"testing"

	"github.com/mferree/agent-city/internal/model"
)

// eps is the tolerance used to distinguish genuine overlaps from floating-point
// rounding at shared edges.
const eps = 1e-6

// treemapRectsOverlap returns true when two placed rectangles share interior
// area (touching edges are not considered an overlap).
func treemapRectsOverlap(a, b treemapRect) bool {
	return a.x+a.w > b.x+eps && b.x+b.w > a.x+eps &&
		a.y+a.h > b.y+eps && b.y+b.h > a.y+eps
}

// buildingsOverlap returns true when two buildings share interior area.
func buildingsOverlap(a, b model.Building) bool {
	return a.GX+a.GW > b.GX+eps && b.GX+b.GW > a.GX+eps &&
		a.GY+a.GH > b.GY+eps && b.GY+b.GH > a.GY+eps
}

// ---- squarify tests ---------------------------------------------------------

func TestSquarify_EmptyInput(t *testing.T) {
	rects := squarify(nil, 0, 0, 100, 100)
	if len(rects) != 0 {
		t.Errorf("expected 0 rects, got %d", len(rects))
	}
}

func TestSquarify_SingleNode(t *testing.T) {
	nodes := []treemapNode{{id: "a", weight: 1.0}}
	rects := squarify(nodes, 0, 0, 100, 50)
	if len(rects) != 1 {
		t.Fatalf("expected 1 rect, got %d", len(rects))
	}
	r := rects[0]
	if r.id != "a" {
		t.Errorf("id = %q, want %q", r.id, "a")
	}
	if math.Abs(r.x) > eps || math.Abs(r.y) > eps {
		t.Errorf("origin = (%v, %v), want (0, 0)", r.x, r.y)
	}
	if math.Abs(r.w-100) > eps || math.Abs(r.h-50) > eps {
		t.Errorf("size = (%v, %v), want (100, 50)", r.w, r.h)
	}
}

func TestSquarify_NoOverlap(t *testing.T) {
	cases := []struct {
		name  string
		nodes []treemapNode
	}{
		{
			"two equal nodes",
			[]treemapNode{{id: "a", weight: 5}, {id: "b", weight: 5}},
		},
		{
			"three nodes varying weight",
			[]treemapNode{{id: "a", weight: 10}, {id: "b", weight: 5}, {id: "c", weight: 1}},
		},
		{
			"ten nodes ascending weight",
			func() []treemapNode {
				ns := make([]treemapNode, 10)
				for i := range ns {
					ns[i] = treemapNode{id: fmt.Sprintf("n%d", i), weight: float64(i + 1)}
				}
				return ns
			}(),
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			rects := squarify(tc.nodes, 0, 0, 100, 100)
			if len(rects) != len(tc.nodes) {
				t.Fatalf("expected %d rects, got %d", len(tc.nodes), len(rects))
			}
			for i := range rects {
				for j := i + 1; j < len(rects); j++ {
					// Skip degenerate rects produced for zero-area inputs.
					if rects[i].w <= 0 || rects[i].h <= 0 ||
						rects[j].w <= 0 || rects[j].h <= 0 {
						continue
					}
					if treemapRectsOverlap(rects[i], rects[j]) {
						t.Errorf("rect[%d] (%s) overlaps rect[%d] (%s)",
							i, rects[i].id, j, rects[j].id)
						t.Logf("  [%d]: x=%.6f y=%.6f w=%.6f h=%.6f",
							i, rects[i].x, rects[i].y, rects[i].w, rects[i].h)
						t.Logf("  [%d]: x=%.6f y=%.6f w=%.6f h=%.6f",
							j, rects[j].x, rects[j].y, rects[j].w, rects[j].h)
					}
				}
			}
		})
	}
}

func TestSquarify_TotalAreaPreserved(t *testing.T) {
	nodes := []treemapNode{
		{id: "a", weight: 3}, {id: "b", weight: 5}, {id: "c", weight: 2},
	}
	w, h := 80.0, 60.0
	rects := squarify(nodes, 0, 0, w, h)

	total := 0.0
	for _, r := range rects {
		total += r.w * r.h
	}
	want := w * h
	if math.Abs(total-want) > 0.01 {
		t.Errorf("total area = %.6f, want %.6f", total, want)
	}
}

func TestSquarify_AllWithinBounds(t *testing.T) {
	nodes := []treemapNode{
		{id: "a", weight: 1}, {id: "b", weight: 2},
		{id: "c", weight: 3}, {id: "d", weight: 4},
	}
	ox, oy, w, h := 10.0, 20.0, 100.0, 80.0
	rects := squarify(nodes, ox, oy, w, h)

	for i, r := range rects {
		if r.w <= 0 || r.h <= 0 {
			continue
		}
		if r.x < ox-eps || r.y < oy-eps {
			t.Errorf("rect[%d] origin (%.6f, %.6f) before canvas origin (%.6f, %.6f)",
				i, r.x, r.y, ox, oy)
		}
		if r.x+r.w > ox+w+eps || r.y+r.h > oy+h+eps {
			t.Errorf("rect[%d] (%.6f+%.6f, %.6f+%.6f) extends beyond canvas (%.6f, %.6f)",
				i, r.x, r.w, r.y, r.h, ox+w, oy+h)
		}
	}
}

func TestSquarify_IDsPreservedInInputOrder(t *testing.T) {
	// Despite internal sort by weight, output must map back to input order.
	nodes := []treemapNode{
		{id: "first", weight: 1},
		{id: "second", weight: 100},
		{id: "third", weight: 50},
	}
	rects := squarify(nodes, 0, 0, 100, 100)
	if len(rects) != 3 {
		t.Fatalf("expected 3 rects, got %d", len(rects))
	}
	for i, nd := range nodes {
		if rects[i].id != nd.id {
			t.Errorf("rects[%d].id = %q, want %q", i, rects[i].id, nd.id)
		}
	}
}

func TestSquarify_ZeroDimensionCanvas(t *testing.T) {
	nodes := []treemapNode{{id: "a", weight: 1}, {id: "b", weight: 1}}
	rects := squarify(nodes, 0, 0, 0, 0)
	if len(rects) != 2 {
		t.Fatalf("expected 2 rects, got %d", len(rects))
	}
	// Degenerate rects should still have their IDs preserved.
	if rects[0].id != "a" || rects[1].id != "b" {
		t.Errorf("IDs not preserved for zero-size canvas: got %q, %q", rects[0].id, rects[1].id)
	}
}

// ---- footprint tests --------------------------------------------------------

func TestFootprint(t *testing.T) {
	cases := []struct {
		name  string
		loc   int
		wantW float64
		wantZ float64
	}{
		// LOC=0: √(0/20)=0 → clamped to w=4; z=0/30=0 → clamped to z=3
		{"zero LOC clamps to min", 0, 4.0, 3.0},
		// LOC=100000: √(100000/20)=√5000≈70.7 → clamped to w=12; z=100000/30≈3333 → clamped to z=30
		{"large LOC clamps to max", 100000, 12.0, 30.0},
		// LOC=500: √(500/20)=√25=5 → w=5; z=500/30≈16.67
		{"middle range unclamped", 500, 5.0, 500.0 / 30.0},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			w, h, z := footprint(tc.loc)
			if math.Abs(w-tc.wantW) > eps {
				t.Errorf("w = %.6f, want %.6f", w, tc.wantW)
			}
			if math.Abs(h-w*0.8) > eps {
				t.Errorf("h = %.6f, want %.6f (w×0.8)", h, w*0.8)
			}
			if math.Abs(z-tc.wantZ) > 0.001 {
				t.Errorf("z = %.6f, want %.6f", z, tc.wantZ)
			}
		})
	}
}

// ---- packDistrict tests -----------------------------------------------------

func TestPackDistrict_Empty(t *testing.T) {
	result := packDistrict(nil, 0, 0, 100, 100)
	if len(result) != 0 {
		t.Errorf("expected 0 buildings, got %d", len(result))
	}
}

func TestPackDistrict_DimensionsSet(t *testing.T) {
	b := model.Building{ID: "main.go", LOC: 500}
	result := packDistrict([]model.Building{b}, 0, 0, 200, 200)
	if len(result) != 1 {
		t.Fatalf("expected 1 building, got %d", len(result))
	}
	r := result[0]
	if r.GW <= 0 || r.GH <= 0 || r.GZ <= 0 {
		t.Errorf("dimensions not set: GW=%.3f GH=%.3f GZ=%.3f", r.GW, r.GH, r.GZ)
	}
}

func TestPackDistrict_AllWithinBounds(t *testing.T) {
	buildings := []model.Building{
		{ID: "a.go", LOC: 100},
		{ID: "b.go", LOC: 200},
		{ID: "c.go", LOC: 50},
	}
	bx, by, bw, bh := 10.0, 20.0, 200.0, 100.0
	result := packDistrict(buildings, bx, by, bw, bh)

	for _, b := range result {
		if b.GX < bx-eps {
			t.Errorf("building %q GX=%.3f < bx=%.3f", b.ID, b.GX, bx)
		}
		if b.GY < by-eps {
			t.Errorf("building %q GY=%.3f < by=%.3f", b.ID, b.GY, by)
		}
	}
}

func TestPackDistrict_NoOverlap(t *testing.T) {
	buildings := []model.Building{
		{ID: "a.go", LOC: 100},
		{ID: "b.go", LOC: 200},
		{ID: "c.go", LOC: 50},
		{ID: "d.go", LOC: 300},
	}
	result := packDistrict(buildings, 0, 0, 200, 200)

	for i := range result {
		for j := i + 1; j < len(result); j++ {
			if buildingsOverlap(result[i], result[j]) {
				t.Errorf("buildings %q and %q overlap", result[i].ID, result[j].ID)
				t.Logf("  %s: GX=%.3f GY=%.3f GW=%.3f GH=%.3f",
					result[i].ID, result[i].GX, result[i].GY, result[i].GW, result[i].GH)
				t.Logf("  %s: GX=%.3f GY=%.3f GW=%.3f GH=%.3f",
					result[j].ID, result[j].GX, result[j].GY, result[j].GW, result[j].GH)
			}
		}
	}
}

func TestPackDistrict_SortsByLOCDesc(t *testing.T) {
	// The largest building (by LOC) should appear first in the output
	// because packDistrict sorts LOC desc.
	buildings := []model.Building{
		{ID: "small.go", LOC: 10},
		{ID: "large.go", LOC: 999},
		{ID: "medium.go", LOC: 200},
	}
	result := packDistrict(buildings, 0, 0, 500, 500)
	if len(result) != 3 {
		t.Fatalf("expected 3, got %d", len(result))
	}
	if result[0].ID != "large.go" {
		t.Errorf("first building = %q, want %q (largest LOC)", result[0].ID, "large.go")
	}
}

// ---- districtIDAtDepth tests ------------------------------------------------

func TestDistrictIDAtDepth(t *testing.T) {
	cases := []struct {
		filePath string
		depth    int
		want     string
	}{
		{"src/auth/guards/jwt.go", 2, "src/auth"},
		{"src/auth/foo.go", 2, "src/auth"},
		{"src/foo.go", 2, "src"},
		{"foo.go", 2, ""},
		{"a/b/c/d.go", 1, "a"},
		{"a/b/c/d.go", 3, "a/b/c"},
		{"a/b.go", 3, "a"},
	}
	for _, tc := range cases {
		t.Run(fmt.Sprintf("%s/depth%d", tc.filePath, tc.depth), func(t *testing.T) {
			got := districtIDAtDepth(tc.filePath, tc.depth)
			if got != tc.want {
				t.Errorf("districtIDAtDepth(%q, %d) = %q, want %q",
					tc.filePath, tc.depth, got, tc.want)
			}
		})
	}
}

// ---- Layout (full engine) tests ---------------------------------------------

func TestLayout_EmptyBuildings(t *testing.T) {
	result := Layout(nil, Config{})
	if len(result.Districts) != 0 || len(result.Buildings) != 0 {
		t.Errorf("expected empty result, got %d districts %d buildings",
			len(result.Districts), len(result.Buildings))
	}
}

func TestLayout_DistrictCount(t *testing.T) {
	buildings := []model.Building{
		{ID: "src/a.go", LOC: 100},
		{ID: "src/b.go", LOC: 100},
		{ID: "cmd/main.go", LOC: 50},
	}
	result := Layout(buildings, Config{DistrictDepth: 2})
	if len(result.Districts) != 2 {
		t.Errorf("expected 2 districts (src, cmd), got %d", len(result.Districts))
	}
	if len(result.Buildings) != 3 {
		t.Errorf("expected 3 buildings, got %d", len(result.Buildings))
	}
}

func TestLayout_DistrictIDAssigned(t *testing.T) {
	buildings := []model.Building{
		{ID: "src/auth/login.go", LOC: 200},
	}
	result := Layout(buildings, Config{DistrictDepth: 2})
	if len(result.Buildings) != 1 {
		t.Fatalf("expected 1 building, got %d", len(result.Buildings))
	}
	if result.Buildings[0].DistrictID != "src/auth" {
		t.Errorf("DistrictID = %q, want %q", result.Buildings[0].DistrictID, "src/auth")
	}
}

func TestLayout_BuildingDimensionsSet(t *testing.T) {
	buildings := []model.Building{
		{ID: "src/main.go", LOC: 200},
		{ID: "internal/hub.go", LOC: 400},
	}
	result := Layout(buildings, Config{})
	for _, b := range result.Buildings {
		if b.GW <= 0 || b.GH <= 0 || b.GZ <= 0 {
			t.Errorf("building %q has zero/negative dimensions GW=%.3f GH=%.3f GZ=%.3f",
				b.ID, b.GW, b.GH, b.GZ)
		}
	}
}

// TestLayout_BuildingsNoOverlap is the primary treemap no-overlap invariant test.
// Buildings within the same district must not share footprint area.
func TestLayout_BuildingsNoOverlap(t *testing.T) {
	buildings := []model.Building{
		{ID: "src/main.go", LOC: 200},
		{ID: "src/auth.go", LOC: 300},
		{ID: "src/hub.go", LOC: 150},
		{ID: "internal/deps/analyzer.go", LOC: 400},
		{ID: "internal/deps/parser.go", LOC: 250},
		{ID: "internal/repo/watcher.go", LOC: 180},
		{ID: "cmd/main.go", LOC: 100},
	}
	result := Layout(buildings, Config{DistrictDepth: 2})

	// Group by district, then check all pairs within each district.
	byDistrict := make(map[string][]model.Building)
	for _, b := range result.Buildings {
		byDistrict[b.DistrictID] = append(byDistrict[b.DistrictID], b)
	}

	for dID, bs := range byDistrict {
		for i := range bs {
			for j := i + 1; j < len(bs); j++ {
				if buildingsOverlap(bs[i], bs[j]) {
					t.Errorf("district %q: building %q overlaps %q",
						dID, bs[i].ID, bs[j].ID)
					t.Logf("  %s: GX=%.3f GY=%.3f GW=%.3f GH=%.3f",
						bs[i].ID, bs[i].GX, bs[i].GY, bs[i].GW, bs[i].GH)
					t.Logf("  %s: GX=%.3f GY=%.3f GW=%.3f GH=%.3f",
						bs[j].ID, bs[j].GX, bs[j].GY, bs[j].GW, bs[j].GH)
				}
			}
		}
	}
}

func TestLayout_DefaultDepthIsTwo(t *testing.T) {
	// DistrictDepth=0 should behave the same as DistrictDepth=2.
	buildings := []model.Building{
		{ID: "src/auth/guards/jwt.go", LOC: 100},
	}
	r0 := Layout(buildings, Config{DistrictDepth: 0})
	r2 := Layout(buildings, Config{DistrictDepth: 2})

	if len(r0.Districts) != len(r2.Districts) {
		t.Fatalf("DistrictDepth=0 gives %d districts, DistrictDepth=2 gives %d",
			len(r0.Districts), len(r2.Districts))
	}
	if r0.Districts[0].ID != r2.Districts[0].ID {
		t.Errorf("district ID mismatch: depth=0 → %q, depth=2 → %q",
			r0.Districts[0].ID, r2.Districts[0].ID)
	}
}

// TestLayout_BuildingsWithinDistrictBounds verifies that the district GH expands
// to cover buildings that would otherwise overflow a 4th+ row. This is the
// regression test for agentic-city-5nt.
//
// The treemap sizes districts by total LOC weight. District B has 12 buildings
// with LOC=10 each (total 120), while district A has LOC=10000 — so B gets a
// tiny treemap rect (~30 units²) that is far too small to hold 12 minimum-size
// buildings (each 4×3.2 + gutters). The district GH must grow to fit them.
func TestLayout_BuildingsWithinDistrictBounds(t *testing.T) {
	buildings := []model.Building{
		// District A: single huge file — takes most of the treemap canvas.
		{ID: "bigpkg/huge.go", LOC: 10000},
	}
	// District B: 12 tiny files — gets a small treemap slice but buildings
	// all have minimum footprint 4×3.2, so they easily overflow vertically.
	for i := 0; i < 12; i++ {
		buildings = append(buildings, model.Building{
			ID:  fmt.Sprintf("smallpkg/f%02d.go", i),
			LOC: 10,
		})
	}
	result := Layout(buildings, Config{DistrictDepth: 1})

	distByID := make(map[string]model.District)
	for _, d := range result.Districts {
		distByID[d.ID] = d
	}

	for _, b := range result.Buildings {
		d, ok := distByID[b.DistrictID]
		if !ok {
			t.Fatalf("building %q has unknown districtID %q", b.ID, b.DistrictID)
		}
		if b.GX < d.GX-eps {
			t.Errorf("building %q GX=%.3f < district GX=%.3f", b.ID, b.GX, d.GX)
		}
		if b.GY < d.GY-eps {
			t.Errorf("building %q GY=%.3f < district GY=%.3f", b.ID, b.GY, d.GY)
		}
		if b.GX+b.GW > d.GX+d.GW+eps {
			t.Errorf("building %q right=%.3f > district right=%.3f",
				b.ID, b.GX+b.GW, d.GX+d.GW)
		}
		if b.GY+b.GH > d.GY+d.GH+eps {
			t.Errorf("building %q bottom=%.3f > district bottom=%.3f",
				b.ID, b.GY+b.GH, d.GY+d.GH)
		}
	}
}

func TestLayout_OutputSortedByID(t *testing.T) {
	buildings := []model.Building{
		{ID: "z/last.go", LOC: 100},
		{ID: "a/first.go", LOC: 100},
		{ID: "m/middle.go", LOC: 100},
	}
	result := Layout(buildings, Config{DistrictDepth: 1})

	for i := 1; i < len(result.Districts); i++ {
		if result.Districts[i].ID < result.Districts[i-1].ID {
			t.Errorf("districts not sorted: %q before %q",
				result.Districts[i-1].ID, result.Districts[i].ID)
		}
	}
	for i := 1; i < len(result.Buildings); i++ {
		if result.Buildings[i].ID < result.Buildings[i-1].ID {
			t.Errorf("buildings not sorted: %q before %q",
				result.Buildings[i-1].ID, result.Buildings[i].ID)
		}
	}
}
