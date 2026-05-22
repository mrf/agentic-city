package repo

import (
	"bytes"
	"io"
	"os"
	"os/exec"
	"path"
	"path/filepath"
	"strings"

	git "github.com/go-git/go-git/v5"
	"github.com/mferree/agent-city/internal/model"
)

// ScanConfig controls the behaviour of ScanRepo.
type ScanConfig struct {
	// ExcludeGlobs are additional glob patterns matched against the repo-relative file path.
	// Standard path.Match syntax, e.g. "*.pb.go" or "testdata/*".
	ExcludeGlobs []string

	// MaxDepth is the maximum directory depth to include.
	// 0 means unlimited. A file at "a/b/c.go" has depth 2.
	MaxDepth int

	// MinLOC is the minimum line count required to produce a Building.
	// Defaults to 0 (include everything).
	MinLOC int
}

// knownSkipDirs are directory names whose contents are never treated as source.
var knownSkipDirs = map[string]bool{
	"node_modules": true,
	"vendor":       true,
	".git":         true,
	"dist":         true,
	"build":        true,
}

// binaryExtensions are extensions whose files are skipped without null-byte sniffing.
var binaryExtensions = map[string]bool{
	".png":   true,
	".jpg":   true,
	".jpeg":  true,
	".gif":   true,
	".ico":   true,
	".pdf":   true,
	".zip":   true,
	".tar":   true,
	".gz":    true,
	".bz2":   true,
	".xz":    true,
	".mp4":   true,
	".mp3":   true,
	".wav":   true,
	".woff":  true,
	".woff2": true,
	".ttf":   true,
	".eot":   true,
	".exe":   true,
	".dll":   true,
	".so":    true,
	".dylib": true,
	".a":     true,
	".o":     true,
	".bin":   true,
	".pyc":   true,
	".class": true,
	".jar":   true,
}

// extensionToLanguage maps lowercase file extensions to language identifiers.
var extensionToLanguage = map[string]string{
	".go":     "go",
	".ts":     "ts",
	".tsx":    "tsx",
	".js":     "js",
	".jsx":    "jsx",
	".py":     "py",
	".rs":     "rs",
	".java":   "java",
	".rb":     "rb",
	".sql":    "sql",
	".sh":     "sh",
	".bash":   "sh",
	".zsh":    "sh",
	".yaml":   "yaml",
	".yml":    "yaml",
	".json":   "json",
	".md":     "md",
	".css":    "css",
	".scss":   "scss",
	".sass":   "sass",
	".html":   "html",
	".htm":    "html",
	".toml":   "toml",
	".proto":  "proto",
	".c":      "c",
	".cpp":    "cpp",
	".cc":     "cpp",
	".cxx":    "cpp",
	".h":      "h",
	".hpp":    "h",
	".cs":     "cs",
	".kt":     "kt",
	".swift":  "swift",
	".tf":     "tf",
	".mod":    "mod",
	".sum":    "sum",
	".xml":    "xml",
	".svelte": "svelte",
	".vue":    "vue",
	".lua":    "lua",
	".r":      "r",
	".jl":     "jl",
	".env":    "env",
	".txt":    "txt",
	".lock":   "lock",
	".gradle": "gradle",
	".groovy": "groovy",
	".hcl":    "hcl",
	".nix":    "nix",
	".zig":    "zig",
	".dart":   "dart",
	".ex":     "elixir",
	".exs":    "elixir",
	".erl":    "erlang",
	".hrl":    "erlang",
	".clj":    "clojure",
	".cljs":   "clojure",
	".elm":    "elm",
	".hs":     "haskell",
	".ml":     "ocaml",
	".mli":    "ocaml",
	".fs":     "fsharp",
	".fsx":    "fsharp",
	".php":    "php",
	".pl":     "perl",
	".pm":     "perl",
	".ps1":      "powershell",
	".psm1":     "powershell",
	".gitignore": "gitignore",
	".dockerignore": "gitignore",
}

// filenameToLanguage maps bare filenames (no extension) to language identifiers.
// Used for files like Dockerfile or Makefile whose full basename is the identifier.
var filenameToLanguage = map[string]string{
	"Dockerfile":  "dockerfile",
	"Makefile":    "makefile",
	"Justfile":    "makefile",
	"Rakefile":    "ruby",
	"Gemfile":     "ruby",
	"Podfile":     "ruby",
	"Vagrantfile": "ruby",
	"Brewfile":    "ruby",
}

// ScanRepo opens the git repository at repoPath, walks its HEAD tree, and
// returns a []model.Building for every source file that passes the filters in cfg.
//
// Only ID, DistrictID, Label, Language, LOC, Coverage, and Status are populated.
// Layout fields (GX/GY/GW/GH/GZ) are left at zero for the layout engine to fill.
//
// EnableDotGitCommonDir is set so ScanRepo works correctly inside git worktrees.
func ScanRepo(repoPath string, cfg ScanConfig) ([]model.Building, error) {
	buildings, err := scanWithGoGit(repoPath, cfg)
	if err == nil {
		return buildings, nil
	}
	// go-git fails on repos with extensions it doesn't support (e.g.
	// worktreeConfig). Fall back to git CLI + filesystem reads.
	return scanWithGitCLI(repoPath, cfg)
}

// scanWithGoGit uses go-git to walk the HEAD tree and read blob content.
func scanWithGoGit(repoPath string, cfg ScanConfig) ([]model.Building, error) {
	r, err := git.PlainOpenWithOptions(repoPath, &git.PlainOpenOptions{
		DetectDotGit:          true,
		EnableDotGitCommonDir: true,
	})
	if err != nil {
		return nil, err
	}

	ref, err := r.Head()
	if err != nil {
		return nil, err
	}

	commit, err := r.CommitObject(ref.Hash())
	if err != nil {
		return nil, err
	}

	tree, err := commit.Tree()
	if err != nil {
		return nil, err
	}

	var buildings []model.Building

	fileIter := tree.Files()
	defer fileIter.Close()

	for {
		f, iterErr := fileIter.Next()
		if iterErr == io.EOF {
			break
		}
		if iterErr != nil {
			return nil, iterErr
		}

		filePath := f.Name

		// known non-source directory filter
		if inSkipDir(filePath) {
			continue
		}

		// max-depth filter
		if cfg.MaxDepth > 0 && dirDepth(filePath) > cfg.MaxDepth {
			continue
		}

		// binary-by-extension filter
		ext := strings.ToLower(path.Ext(filePath))
		if binaryExtensions[ext] {
			continue
		}

		// configurable exclude globs
		if len(cfg.ExcludeGlobs) > 0 && matchesAnyGlob(filePath, cfg.ExcludeGlobs) {
			continue
		}

		// stream content from the git blob to count lines and sniff for binary
		rc, readErr := f.Reader()
		if readErr != nil {
			continue // skip unreadable blobs
		}
		loc, isBinary := countLinesAndSniff(rc)
		rc.Close()
		if isBinary {
			continue
		}

		// min-LOC filter
		if loc < cfg.MinLOC {
			continue
		}

		buildings = append(buildings, newBuilding(filePath, ext, loc))
	}

	return buildings, nil
}

// scanWithGitCLI uses `git ls-files` to enumerate tracked files and reads
// their content from the working tree. This path handles repos whose config
// extensions are not supported by go-git (e.g. worktreeConfig).
func scanWithGitCLI(repoPath string, cfg ScanConfig) ([]model.Building, error) {
	cmd := exec.Command("git", "ls-files", "-z")
	cmd.Dir = repoPath
	out, err := cmd.Output()
	if err != nil {
		return nil, err
	}

	files := strings.Split(string(out), "\x00")
	var buildings []model.Building

	for _, filePath := range files {
		if filePath == "" {
			continue
		}

		if inSkipDir(filePath) {
			continue
		}

		if cfg.MaxDepth > 0 && dirDepth(filePath) > cfg.MaxDepth {
			continue
		}

		ext := strings.ToLower(path.Ext(filePath))
		if binaryExtensions[ext] {
			continue
		}

		if len(cfg.ExcludeGlobs) > 0 && matchesAnyGlob(filePath, cfg.ExcludeGlobs) {
			continue
		}

		absPath := filepath.Join(repoPath, filePath)
		f, openErr := os.Open(absPath)
		if openErr != nil {
			continue
		}
		loc, isBinary := countLinesAndSniff(f)
		f.Close()
		if isBinary {
			continue
		}

		if loc < cfg.MinLOC {
			continue
		}

		buildings = append(buildings, newBuilding(filePath, ext, loc))
	}

	return buildings, nil
}

// inSkipDir reports whether filePath has any directory component that is a known skip dir.
func inSkipDir(filePath string) bool {
	parts := strings.Split(filePath, "/")
	for _, part := range parts[:len(parts)-1] {
		if knownSkipDirs[part] {
			return true
		}
	}
	return false
}

// dirDepth returns the number of directory components in filePath.
// "foo.go" → 0, "a/foo.go" → 1, "a/b/foo.go" → 2.
func dirDepth(filePath string) int {
	parts := strings.Split(filePath, "/")
	if len(parts) <= 1 {
		return 0
	}
	return len(parts) - 1
}

// matchesAnyGlob reports whether filePath matches any of the given glob patterns.
// Patterns are tested against both the full path and the base filename.
func matchesAnyGlob(filePath string, globs []string) bool {
	base := path.Base(filePath)
	for _, g := range globs {
		if matched, err := path.Match(g, filePath); err == nil && matched {
			return true
		}
		if matched, err := path.Match(g, base); err == nil && matched {
			return true
		}
	}
	return false
}

// sniffSize is the number of leading bytes checked for null bytes to detect binary files.
const sniffSize = 512

// countLinesAndSniff reads r, counting newlines and checking for binary content
// (null bytes in the first 512 bytes). It returns the line count and whether
// the content appears to be binary.
func countLinesAndSniff(r io.Reader) (loc int, binary bool) {
	var (
		totalRead int
		lastByte  byte
	)
	buf := make([]byte, 32*1024)
	for {
		n, err := r.Read(buf)
		chunk := buf[:n]

		// binary sniff on the leading bytes
		if totalRead < sniffSize {
			end := sniffSize - totalRead
			if end > n {
				end = n
			}
			if bytes.IndexByte(chunk[:end], 0) >= 0 {
				return 0, true
			}
		}
		totalRead += n

		loc += bytes.Count(chunk, []byte{'\n'})
		if n > 0 {
			lastByte = chunk[n-1]
		}

		if err == io.EOF {
			break
		}
		if err != nil {
			return 0, false
		}
	}
	// count the last line if it doesn't end with a newline
	if totalRead > 0 && lastByte != '\n' {
		loc++
	}
	return loc, false
}

// newBuilding constructs a Building from a repo-relative file path, its
// lowercased extension, and a line count. Layout fields are left at zero.
func newBuilding(relPath, ext string, loc int) model.Building {
	lang := extensionToLanguage[ext]
	if lang == "" && ext == "" {
		lang = filenameToLanguage[path.Base(relPath)]
	}
	if lang == "" {
		lang = "unknown"
	}

	districtID := path.Dir(relPath)
	if districtID == "." {
		districtID = ""
	}

	return model.Building{
		ID:         relPath,
		DistrictID: districtID,
		Label:      path.Base(relPath),
		Language:   lang,
		LOC:        loc,
		Coverage:   -1,
		Status:     "unknown",
	}
}
