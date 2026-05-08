package deps

import (
	"os"
	"path"
	"path/filepath"

	"github.com/mferree/agent-city/internal/model"
)

// Config holds options for the dependency graph builder.
type Config struct {
	// ModuleName is the Go module name (e.g. "github.com/mferree/agent-city").
	// Used to strip the module prefix from Go import paths so they can be
	// resolved to repo-relative directories. Leave empty to skip Go resolution.
	ModuleName string
}

// BuildGraph reads every building's source content and produces Road edges
// connecting files that import each other.
//
// readContent is called with a repo-relative file ID and should return the
// file's raw bytes. Errors from readContent cause the file to be silently
// skipped (best-effort). Only files whose Language is supported by
// ExtractImports produce edges.
//
// Duplicate edges (same FromID→ToID pair) are merged: Weight counts the
// number of distinct source references, and the highest Confidence wins.
func BuildGraph(buildings []model.Building, readContent func(id string) ([]byte, error), cfg Config) []model.Road {
	known := make(map[string]bool, len(buildings))
	// dirFiles maps repo-relative directory path → slice of Go file IDs in that dir.
	dirFiles := make(map[string][]string)

	for _, b := range buildings {
		known[b.ID] = true
		if b.Language == "go" {
			dir := path.Dir(b.ID)
			if dir == "." {
				dir = ""
			}
			dirFiles[dir] = append(dirFiles[dir], b.ID)
		}
	}

	type edgeKey struct{ from, to string }
	edges := make(map[edgeKey]*model.Road)

	for _, b := range buildings {
		content, err := readContent(b.ID)
		if err != nil || len(content) == 0 {
			continue
		}

		imports := ExtractImports(b.Language, string(content))
		for _, imp := range imports {
			toID, conf := resolve(b, imp.Path, known, dirFiles, cfg)
			if toID == "" || toID == b.ID {
				continue
			}

			key := edgeKey{from: b.ID, to: toID}
			if existing, ok := edges[key]; ok {
				existing.Weight++
				existing.Confidence = highestConfidence(existing.Confidence, conf)
			} else {
				edges[key] = &model.Road{
					FromID:     b.ID,
					ToID:       toID,
					Weight:     1,
					Confidence: conf,
				}
			}
		}
	}

	roads := make([]model.Road, 0, len(edges))
	for _, r := range edges {
		roads = append(roads, *r)
	}
	return roads
}

// resolve dispatches to the language-specific resolver for a single import specifier.
func resolve(b model.Building, importPath string, known map[string]bool, dirFiles map[string][]string, cfg Config) (string, string) {
	switch b.Language {
	case "ts", "tsx", "js", "jsx":
		return resolveJS(b.ID, importPath, known)
	case "go":
		return resolveGo(importPath, cfg.ModuleName, dirFiles)
	case "py":
		return resolvePython(b.ID, importPath, known)
	}
	return "", ""
}

// highestConfidence returns the more precise of two confidence values.
// Order: ConfidenceExact > ConfidenceInferred > ConfidenceWeak.
func highestConfidence(a, b string) string {
	rank := func(c string) int {
		switch c {
		case ConfidenceExact:
			return 2
		case ConfidenceInferred:
			return 1
		case ConfidenceWeak:
			return 0
		}
		return -1
	}
	if rank(a) >= rank(b) {
		return a
	}
	return b
}

// DirReader returns a readContent function that reads files from repoRoot on disk.
func DirReader(repoRoot string) func(id string) ([]byte, error) {
	return func(id string) ([]byte, error) {
		return os.ReadFile(filepath.Join(repoRoot, id))
	}
}
