package layout

import (
	"math"
	"sort"

	"github.com/mferree/agent-city/internal/model"
)

const gutterSize = 2.0

// packDistrict computes layout fields (GX, GY, GW, GH, GZ) for buildings within
// the given district rectangle. Buildings are sorted by LOC descending (path
// ascending as tiebreaker) before packing, producing a deterministic shelf layout.
// Footprints are scaled down uniformly if necessary so all buildings stay within
// bw × bh. Returns the buildings with layout fields filled; original slice is not
// modified.
func packDistrict(buildings []model.Building, bx, by, bw, bh float64) []model.Building {
	out := make([]model.Building, len(buildings))
	copy(out, buildings)

	if len(out) == 0 {
		return out
	}

	// Deterministic order: LOC desc, path asc.
	sort.Slice(out, func(i, j int) bool {
		if out[i].LOC != out[j].LOC {
			return out[i].LOC > out[j].LOC
		}
		return out[i].ID < out[j].ID
	})

	// Scale footprints down if needed so buildings fit within bh.
	scale := footprintScale(out, bw, bh)

	// Shelf-pack: place buildings left-to-right; start a new shelf when width overflows.
	curX := bx + gutterSize
	curY := by + gutterSize
	shelfH := 0.0

	for i := range out {
		fw, fh, fz := footprint(out[i].LOC)
		fw *= scale
		fh *= scale

		// Start a new shelf if the building doesn't fit horizontally.
		if curX+fw+gutterSize > bx+bw && curX > bx+gutterSize {
			curY += shelfH + gutterSize
			curX = bx + gutterSize
			shelfH = 0
		}

		out[i].GX = curX
		out[i].GY = curY
		out[i].GW = fw
		out[i].GH = fh
		out[i].GZ = fz

		curX += fw + gutterSize
		if fh > shelfH {
			shelfH = fh
		}
	}

	return out
}

// footprintScale returns a uniform scale factor (≤ 1.0) so that shelf-packed
// buildings fit within bw × bh. Uses binary search to converge on the largest
// scale where measurePackHeight(buildings, bw, s) ≤ bh. The two-pass estimate
// failed to converge when many shelves existed because gutters are fixed-size
// and compound non-linearly with the number of rows (agentic-city-y1o).
func footprintScale(buildings []model.Building, bw, bh float64) float64 {
	if bh <= 0 {
		return 1.0
	}
	if measurePackHeight(buildings, bw, 1.0) <= bh {
		return 1.0
	}

	const minScale = 0.05
	lo, hi := minScale, 1.0

	// ~20 iterations gives sub-micron precision on the scale factor.
	for range 20 {
		mid := (lo + hi) / 2
		if measurePackHeight(buildings, bw, mid) <= bh {
			lo = mid
		} else {
			hi = mid
		}
	}
	return lo
}

// measurePackHeight simulates shelf packing at the given scale and returns the
// total height consumed (relative to origin 0).
func measurePackHeight(buildings []model.Building, bw, scale float64) float64 {
	curX := gutterSize
	curY := gutterSize
	shelfH := 0.0
	for _, b := range buildings {
		fw, fh, _ := footprint(b.LOC)
		fw *= scale
		fh *= scale
		if curX+fw+gutterSize > bw && curX > gutterSize {
			curY += shelfH + gutterSize
			curX = gutterSize
			shelfH = 0
		}
		curX += fw + gutterSize
		if fh > shelfH {
			shelfH = fh
		}
	}
	return curY + shelfH + gutterSize
}

// footprint returns the (width, depth, height) for a building with the given LOC.
//
//	w = clamp(√(LOC/20), 4, 12)
//	h = w × 0.8   (footprint depth)
//	z = clamp(LOC/30, 3, 30)  (visual height)
func footprint(loc int) (float64, float64, float64) {
	w := clamp(math.Sqrt(float64(loc)/20.0), 4.0, 12.0)
	h := w * 0.8
	z := clamp(float64(loc)/30.0, 3.0, 30.0)
	return w, h, z
}

func clamp(v, lo, hi float64) float64 {
	if v < lo {
		return lo
	}
	if v > hi {
		return hi
	}
	return v
}
