// Package deps provides best-effort, regex-based dependency analysis for
// TS/JS, Go, and Python source files. It extracts import specifiers from file
// content and resolves them to repo-relative file IDs.
package deps

import (
	"path"
	"regexp"
	"strings"
)

// Confidence levels for resolved dependency edges.
const (
	ConfidenceExact    = "exact"    // relative import matched a known file directly
	ConfidenceInferred = "inferred" // relative import matched after extension probing, or module path matched a known directory
	ConfidenceWeak     = "weak"     // heuristic match only
)

// RawImport is an unresolved import specifier as written in source.
type RawImport struct {
	Path string // e.g. "./auth", "react", "github.com/foo/bar"
}

// ---- language-specific regex patterns ----------------------------------------

var (
	// TS/JS: `import ... from 'path'`, `export ... from 'path'`
	reJSFrom = regexp.MustCompile(
		`(?:import|export)[^;'"` + "`" + `]*?from\s*['"]([^'"` + "`" + `]+)['"]`,
	)
	// TS/JS: side-effect `import 'path'`
	reJSSide = regexp.MustCompile(`(?m)^\s*import\s+['"]([^'"]+)['"]`)
	// TS/JS: `require('path')`
	reJSRequire = regexp.MustCompile(`require\s*\(\s*['"]([^'"]+)['"]\s*\)`)
	// TS/JS: dynamic `import('path')`
	reJSDynamic = regexp.MustCompile(`import\s*\(\s*['"]([^'"]+)['"]\s*\)`)

	// Go: `import ( ... )` block — captures the block body
	reGoBlock = regexp.MustCompile(`(?s)import\s*\(([^)]+)\)`)
	// Go: `import "pkg"` or `import alias "pkg"` on a single line
	reGoSingle = regexp.MustCompile(`(?m)^\s*import\s+(?:\w+\s+)?"([^"]+)"`)
	// Inside a Go import block: optional alias then `"pkg"`
	reGoBlockEntry = regexp.MustCompile(`(?:\w+\s+)?"([^"]+)"`)

	// Python: `import foo` or `import foo as bar`
	rePyImport = regexp.MustCompile(`(?m)^import\s+(\S+)`)
	// Python: `from foo import ...` or `from .foo import ...`
	rePyFrom = regexp.MustCompile(`(?m)^from\s+(\S+)\s+import`)
)

// ExtractImports returns the raw import specifiers found in content for the
// given language. lang must be one of "ts", "tsx", "js", "jsx", "go", "py".
// Other values return nil.
func ExtractImports(lang, content string) []RawImport {
	switch lang {
	case "ts", "tsx", "js", "jsx":
		return extractJS(content)
	case "go":
		return extractGo(content)
	case "py":
		return extractPython(content)
	default:
		return nil
	}
}

// extractJS collects import specifiers from TS/JS/TSX/JSX source.
func extractJS(content string) []RawImport {
	seen := map[string]bool{}
	var out []RawImport

	add := func(p string) {
		if p != "" && !seen[p] {
			seen[p] = true
			out = append(out, RawImport{Path: p})
		}
	}

	for _, m := range reJSFrom.FindAllStringSubmatch(content, -1) {
		add(m[1])
	}
	for _, m := range reJSSide.FindAllStringSubmatch(content, -1) {
		add(m[1])
	}
	for _, m := range reJSRequire.FindAllStringSubmatch(content, -1) {
		add(m[1])
	}
	for _, m := range reJSDynamic.FindAllStringSubmatch(content, -1) {
		add(m[1])
	}

	return out
}

// extractGo collects import paths from Go source.
func extractGo(content string) []RawImport {
	seen := map[string]bool{}
	var out []RawImport

	add := func(p string) {
		if p != "" && !seen[p] {
			seen[p] = true
			out = append(out, RawImport{Path: p})
		}
	}

	// Track byte ranges covered by block imports to skip re-matching as singles.
	var blockRanges [][2]int

	for _, m := range reGoBlock.FindAllStringSubmatchIndex(content, -1) {
		blockRanges = append(blockRanges, [2]int{m[0], m[1]})
		blockBody := content[m[2]:m[3]]
		for _, bm := range reGoBlockEntry.FindAllStringSubmatch(blockBody, -1) {
			add(bm[1])
		}
	}

	// Single-line imports outside any block range.
	for _, loc := range reGoSingle.FindAllStringIndex(content, -1) {
		if inAnyRange(loc[0], blockRanges) {
			continue
		}
		if m := reGoSingle.FindStringSubmatch(content[loc[0]:loc[1]]); m != nil {
			add(m[1])
		}
	}

	return out
}

// extractPython collects import module paths from Python source.
func extractPython(content string) []RawImport {
	seen := map[string]bool{}
	var out []RawImport

	add := func(raw string) {
		p := strings.TrimRight(raw, ",")
		if p != "" && !seen[p] {
			seen[p] = true
			out = append(out, RawImport{Path: p})
		}
	}

	for _, m := range rePyImport.FindAllStringSubmatch(content, -1) {
		add(m[1])
	}
	for _, m := range rePyFrom.FindAllStringSubmatch(content, -1) {
		add(m[1])
	}

	return out
}

// inAnyRange reports whether pos falls within any of the given [start,end) ranges.
func inAnyRange(pos int, ranges [][2]int) bool {
	for _, r := range ranges {
		if pos >= r[0] && pos < r[1] {
			return true
		}
	}
	return false
}

// ---- path resolution ---------------------------------------------------------

// jsExtensions lists the candidate extensions tried when resolving a bare
// TS/JS relative import (e.g. `./foo` → `./foo.ts`).
var jsExtensions = []string{".ts", ".tsx", ".js", ".jsx"}

// jsIndexNames lists index file candidates inside a directory.
var jsIndexNames = []string{"index.ts", "index.tsx", "index.js", "index.jsx"}

// resolveJS resolves a TS/JS import specifier relative to fromFile.
// Returns the repo-relative file ID and confidence, or ("", "") if unresolvable.
// Only relative specifiers (starting with ".") are resolved; bare module names
// (e.g. "react") are skipped because those files are not in the repo.
func resolveJS(fromFile, importPath string, known map[string]bool) (string, string) {
	if !strings.HasPrefix(importPath, ".") {
		return "", ""
	}

	base := path.Join(path.Dir(fromFile), importPath)

	if known[base] {
		return base, ConfidenceExact
	}
	for _, ext := range jsExtensions {
		if c := base + ext; known[c] {
			return c, ConfidenceInferred
		}
	}
	for _, idx := range jsIndexNames {
		if c := path.Join(base, idx); known[c] {
			return c, ConfidenceInferred
		}
	}

	return "", ""
}

// resolveGo resolves a Go import path to a repo-relative file ID.
// moduleName is the Go module name (e.g. "github.com/mferree/agent-city");
// empty string causes all imports to be skipped.
// Returns the resolved file ID and confidence, or ("", "") if unresolvable.
func resolveGo(importPath, moduleName string, dirFiles map[string][]string) (string, string) {
	if moduleName == "" || strings.HasPrefix(importPath, ".") {
		return "", ""
	}

	var pkgPath string
	switch {
	case strings.HasPrefix(importPath, moduleName+"/"):
		pkgPath = strings.TrimPrefix(importPath, moduleName+"/")
	case importPath == moduleName:
		pkgPath = ""
	default:
		return "", "" // stdlib or external package
	}

	if files := dirFiles[pkgPath]; len(files) > 0 {
		return files[0], ConfidenceInferred
	}
	return "", ""
}

// resolvePython resolves a Python import specifier to a repo-relative file ID.
// fromFile is the importing file (e.g. "src/auth/session.py").
//
// Handles:
//   - Relative imports: `.foo`, `..foo` → resolved against fromFile's directory.
//   - Absolute dotted imports: `pkg.sub` → `pkg/sub.py` or `pkg/sub/__init__.py`.
func resolvePython(fromFile, importPath string, known map[string]bool) (string, string) {
	if strings.HasPrefix(importPath, ".") {
		// Count leading dots to determine directory levels to ascend.
		dots := 0
		for dots < len(importPath) && importPath[dots] == '.' {
			dots++
		}
		rest := importPath[dots:]
		if rest == "" {
			return "", "" // `from . import X` — can't resolve to a specific file
		}

		baseDir := path.Dir(fromFile)
		for i := 1; i < dots; i++ { // one dot = same package, no ascent
			baseDir = path.Dir(baseDir)
		}

		base := path.Join(baseDir, strings.ReplaceAll(rest, ".", "/"))
		if c := base + ".py"; known[c] {
			return c, ConfidenceInferred
		}
		if c := base + "/__init__.py"; known[c] {
			return c, ConfidenceInferred
		}
		return "", ""
	}

	// Absolute import: convert dots to slashes.
	base := strings.ReplaceAll(importPath, ".", "/")
	if c := base + ".py"; known[c] {
		return c, ConfidenceInferred
	}
	if c := base + "/__init__.py"; known[c] {
		return c, ConfidenceInferred
	}
	return "", ""
}
