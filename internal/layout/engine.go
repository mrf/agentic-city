package layout

import (
	"math"
	"path"
	"sort"
	"strings"

	"github.com/mferree/agent-city/internal/model"
)

// Config controls the layout engine.
type Config struct {
	// DistrictDepth is the maximum directory-depth used as a district boundary.
	// Files in directories deeper than this are flattened into their ancestor at
	// DistrictDepth. Default (0) is treated as 2.
	//
	// Example with DistrictDepth=2:
	//   "src/auth/guards/jwt.go" → district "src/auth"
	//   "src/auth/login.go"      → district "src/auth"
	//   "src/foo.go"             → district "src"
	DistrictDepth int
}

// Result holds the positioned districts and buildings from a layout run.
type Result struct {
	Districts []model.District
	Buildings []model.Building
}

// Layout computes city positions for all buildings.
// It groups files into districts based on Config.DistrictDepth, applies a
// squarified treemap to position districts, then shelf-packs buildings within
// each district. Output is deterministically sorted by ID.
func Layout(buildings []model.Building, cfg Config) Result {
	depth := cfg.DistrictDepth
	if depth <= 0 {
		depth = 2
	}

	if len(buildings) == 0 {
		return Result{}
	}

	// --- Group buildings into districts ----------------------------------------

	type districtEntry struct {
		id        string
		buildings []model.Building
		totalLOC  int
	}

	districtMap := make(map[string]*districtEntry)

	for _, b := range buildings {
		dID := districtIDAtDepth(b.ID, depth)
		de, ok := districtMap[dID]
		if !ok {
			de = &districtEntry{id: dID}
			districtMap[dID] = de
		}
		b.DistrictID = dID
		de.buildings = append(de.buildings, b)
		de.totalLOC += b.LOC
	}

	// Collect and sort districts deterministically by path.
	entries := make([]*districtEntry, 0, len(districtMap))
	for _, de := range districtMap {
		entries = append(entries, de)
	}
	sort.Slice(entries, func(i, j int) bool {
		return entries[i].id < entries[j].id
	})

	// --- Size the canvas based on total building footprint ----------------------

	totalFootprint := 0.0
	for _, de := range entries {
		for _, b := range de.buildings {
			fw, fh, _ := footprint(b.LOC)
			totalFootprint += fw * fh
		}
	}
	// Multiply by an overhead factor to account for gutters and district borders.
	const overhead = 4.0
	canvasSize := math.Sqrt(totalFootprint * overhead)
	if canvasSize < 50 {
		canvasSize = 50
	}

	// --- Squarified treemap for districts ---------------------------------------

	nodes := make([]treemapNode, len(entries))
	for i, de := range entries {
		w := float64(de.totalLOC)
		if w == 0 {
			w = 1
		}
		nodes[i] = treemapNode{id: de.id, weight: w}
	}

	rects := squarify(nodes, 0, 0, canvasSize, canvasSize)

	rectByID := make(map[string]treemapRect, len(rects))
	for _, r := range rects {
		rectByID[r.id] = r
	}

	// --- Pack buildings within each district ------------------------------------

	outDistricts := make([]model.District, 0, len(entries))
	var outBuildings []model.Building

	for _, de := range entries {
		r := rectByID[de.id]

		label := strings.ToUpper(path.Base(de.id)) + "/"
		if de.id == "" {
			label = "(root)/"
		}

		parentID := path.Dir(de.id)
		if parentID == "." || parentID == de.id {
			parentID = ""
		}

		packed := packDistrict(de.buildings, r.x, r.y, r.w, r.h)

		// Expand district height to cover any buildings that overflow the
		// treemap-allocated bounds (happens when many low-LOC files produce
		// more rows than the slot's height accommodates).
		actualH := r.h
		for _, b := range packed {
			if bottom := b.GY + b.GH + gutterSize; bottom > r.y+actualH {
				actualH = bottom - r.y
			}
		}

		outDistricts = append(outDistricts, model.District{
			ID:       de.id,
			Label:    label,
			ParentID: parentID,
			GX:       r.x,
			GY:       r.y,
			GW:       r.w,
			GH:       actualH,
		})

		outBuildings = append(outBuildings, packed...)
	}

	// Sort outputs deterministically by ID.
	sort.Slice(outDistricts, func(i, j int) bool {
		return outDistricts[i].ID < outDistricts[j].ID
	})
	sort.Slice(outBuildings, func(i, j int) bool {
		return outBuildings[i].ID < outBuildings[j].ID
	})

	return Result{
		Districts: outDistricts,
		Buildings: outBuildings,
	}
}

// districtIDAtDepth returns the district ID for a file at the configured depth.
// Components beyond depth are trimmed:
//
//	depth=2, "src/auth/guards/foo.go" → "src/auth"
//	depth=2, "src/auth/foo.go"        → "src/auth"
//	depth=2, "src/foo.go"             → "src"
//	depth=2, "foo.go"                 → ""
func districtIDAtDepth(filePath string, depth int) string {
	dir := path.Dir(filePath)
	if dir == "." {
		return ""
	}
	parts := strings.Split(dir, "/")
	if len(parts) > depth {
		parts = parts[:depth]
	}
	return strings.Join(parts, "/")
}
