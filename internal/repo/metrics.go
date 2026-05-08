package repo

import (
	"bufio"
	"bytes"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"io"
	"os"
	"path"
	"path/filepath"
	"strconv"
	"strings"
	"sync"

	"github.com/fsnotify/fsnotify"
)

// CoverageMap maps repo-relative file paths to coverage ratios [0.0, 1.0].
// A value of -1 means the coverage is unknown.
type CoverageMap map[string]float64

// MetricsSource holds parsed coverage and test-result data.
// Absent keys mean unknown — callers must never treat a missing entry as "ok".
type MetricsSource struct {
	// Coverage maps repo-relative file paths to coverage ratios [0.0, 1.0].
	// -1 means unknown.
	Coverage CoverageMap

	// FileStatus maps exact repo-relative file paths to test status.
	// Values: "ok" | "err". Missing key means unknown.
	FileStatus map[string]string

	// DirStatus maps repo-relative directory paths to test status.
	// Fallback for files with no explicit FileStatus entry.
	// Values: "ok" | "err". Missing key means unknown.
	DirStatus map[string]string
}

// StatusFor returns the building status for the given repo-relative file path.
// FileStatus is checked first; DirStatus is the fallback.
// Returns "unknown" when no data is available — never "ok" by default.
func (m MetricsSource) StatusFor(relPath string) string {
	if st, ok := m.FileStatus[relPath]; ok {
		return st
	}
	dir := path.Dir(relPath)
	if dir == "." {
		dir = ""
	}
	if st, ok := m.DirStatus[dir]; ok {
		return st
	}
	return "unknown"
}

// MetricsConfig specifies which files to parse and watch for metrics data.
type MetricsConfig struct {
	// CoverageFiles lists absolute paths to coverage output files.
	// Auto-detected formats: Go coverage.out, LCOV (.info), coverage.py JSON.
	CoverageFiles []string

	// TestResultFiles lists absolute paths to test result files.
	// Auto-detected formats: JUnit XML, Go test JSON (newline-delimited).
	TestResultFiles []string

	// RepoRoot is the absolute path to the repository root.
	RepoRoot string

	// ModulePath is the Go module path (e.g. "github.com/mferree/agent-city").
	// Used to strip the module prefix from package/file paths in output files.
	ModulePath string
}

// MetricsWatcher watches coverage and test-result files for changes and
// delivers updated MetricsSource values on Updates when files are modified.
type MetricsWatcher struct {
	cfg     MetricsConfig
	fw      *fsnotify.Watcher
	Updates chan MetricsSource
	quit    chan struct{}
	once    sync.Once
}

// NewMetricsWatcher creates a MetricsWatcher. Call Start to begin watching.
func NewMetricsWatcher(cfg MetricsConfig) (*MetricsWatcher, error) {
	fw, err := fsnotify.NewWatcher()
	if err != nil {
		return nil, err
	}
	return &MetricsWatcher{
		cfg:     cfg,
		fw:      fw,
		Updates: make(chan MetricsSource, 8),
		quit:    make(chan struct{}),
	}, nil
}

// Start registers all configured files with fsnotify, performs an initial parse,
// and spawns the event loop. Updates arrive on w.Updates.
// Start returns immediately; call Stop to shut down.
func (w *MetricsWatcher) Start() error {
	// Watch parent directories rather than individual files. On Linux, inotify
	// stops tracking a file that is atomically replaced (write → rename). Watching
	// the directory catches renames and creates targeting the same basename.
	seen := make(map[string]bool)
	for _, p := range append(w.cfg.CoverageFiles, w.cfg.TestResultFiles...) {
		dir := filepath.Dir(p)
		if !seen[dir] {
			_ = w.fw.Add(dir) // best-effort; parse still works if dir is absent
			seen[dir] = true
		}
	}

	// Deliver an initial snapshot so callers don't wait for the first file event.
	src := w.parseAll()
	select {
	case w.Updates <- src:
	default:
	}

	go w.loop()
	return nil
}

// Stop shuts down the watcher and closes the Updates channel.
func (w *MetricsWatcher) Stop() {
	w.once.Do(func() {
		close(w.quit)
		w.fw.Close()
	})
}

// loop reads fsnotify events and triggers a re-parse when a watched file changes.
func (w *MetricsWatcher) loop() {
	defer close(w.Updates)

	watchSet := make(map[string]bool, len(w.cfg.CoverageFiles)+len(w.cfg.TestResultFiles))
	for _, p := range append(w.cfg.CoverageFiles, w.cfg.TestResultFiles...) {
		watchSet[filepath.Clean(p)] = true
	}

	for {
		select {
		case <-w.quit:
			return

		case event, ok := <-w.fw.Events:
			if !ok {
				return
			}
			if !watchSet[filepath.Clean(event.Name)] {
				continue
			}
			if event.Op&(fsnotify.Write|fsnotify.Create|fsnotify.Rename) == 0 {
				continue
			}
			src := w.parseAll()
			select {
			case w.Updates <- src:
			default:
				// Drop if consumer is not keeping up; watcher must not block.
			}

		case _, ok := <-w.fw.Errors:
			if !ok {
				return
			}
		}
	}
}

// parseAll parses all configured coverage and test-result files and merges
// the results into a single MetricsSource.
func (w *MetricsWatcher) parseAll() MetricsSource {
	src := MetricsSource{
		Coverage:   make(CoverageMap),
		FileStatus: make(map[string]string),
		DirStatus:  make(map[string]string),
	}

	for _, p := range w.cfg.CoverageFiles {
		cov, err := parseCoverageFile(p, w.cfg.ModulePath)
		if err != nil {
			continue
		}
		for k, v := range cov {
			src.Coverage[k] = v
		}
	}

	for _, p := range w.cfg.TestResultFiles {
		fileStatus, dirStatus, err := parseTestResultFile(p, w.cfg.ModulePath)
		if err != nil {
			continue
		}
		mergeStatus(src.FileStatus, fileStatus)
		mergeStatus(src.DirStatus, dirStatus)
	}

	return src
}

// mergeStatus merges src into dst, preferring "err" over "ok".
func mergeStatus(dst, src map[string]string) {
	for k, v := range src {
		if dst[k] != "err" {
			dst[k] = v
		}
	}
}

// ─── format auto-detection ───────────────────────────────────────────────────

// parseCoverageFile reads a coverage file and auto-detects its format.
func parseCoverageFile(filePath, modulePath string) (CoverageMap, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, err
	}
	if len(data) == 0 {
		return nil, fmt.Errorf("metrics: empty coverage file %q", filepath.Base(filePath))
	}

	firstLine := firstNonEmptyLine(data)
	r := bytes.NewReader(data)

	switch {
	case strings.HasPrefix(firstLine, "mode:"):
		return ParseGoCoverage(r, modulePath)
	case strings.HasPrefix(firstLine, "TN:") || strings.HasPrefix(firstLine, "SF:"):
		return ParseLCOV(r)
	case strings.HasPrefix(firstLine, "{"):
		return ParseCoveragePyJSON(r)
	default:
		return nil, fmt.Errorf("metrics: unknown coverage format in %q (first line: %q)",
			filepath.Base(filePath), firstLine)
	}
}

// parseTestResultFile reads a test result file and auto-detects its format.
// Returns separate fileStatus and dirStatus maps; fileStatus is always non-nil.
func parseTestResultFile(filePath, modulePath string) (fileStatus, dirStatus map[string]string, err error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, nil, err
	}
	if len(data) == 0 {
		return nil, nil, fmt.Errorf("metrics: empty test result file %q", filepath.Base(filePath))
	}

	firstLine := firstNonEmptyLine(data)
	r := bytes.NewReader(data)

	var ds map[string]string
	switch {
	case strings.HasPrefix(firstLine, "<"):
		ds, err = ParseJUnitXML(r, modulePath)
	case strings.HasPrefix(firstLine, "{"):
		ds, err = ParseGoTestJSON(r, modulePath)
	default:
		return nil, nil, fmt.Errorf("metrics: unknown test result format in %q (first line: %q)",
			filepath.Base(filePath), firstLine)
	}
	if err != nil {
		return nil, nil, err
	}
	return make(map[string]string), ds, nil
}

// firstNonEmptyLine returns the first non-empty, trimmed line from data.
func firstNonEmptyLine(data []byte) string {
	scanner := bufio.NewScanner(bytes.NewReader(data))
	for scanner.Scan() {
		if line := strings.TrimSpace(scanner.Text()); line != "" {
			return line
		}
	}
	return ""
}

// ─── Go coverage.out ─────────────────────────────────────────────────────────

// ParseGoCoverage parses a Go coverage profile produced by go test -coverprofile.
//
// Format per data line:
//
//	file:startLine.startCol,endLine.endCol numStmts count
//
// Coverage per file = covered_stmts / total_stmts. Returns -1 when a file
// has zero statement blocks (no measurable code).
func ParseGoCoverage(r io.Reader, modulePath string) (CoverageMap, error) {
	type counts struct{ covered, total int }
	fileCounts := make(map[string]counts)

	scanner := bufio.NewScanner(r)
	lineNum := 0
	for scanner.Scan() {
		line := scanner.Text()
		lineNum++

		// First line is the mode header: "mode: set|count|atomic"
		if lineNum == 1 && strings.HasPrefix(line, "mode:") {
			continue
		}
		if line == "" {
			continue
		}

		// Module-qualified paths contain no colons, so the last colon in the
		// line separates the file path from the range "startLine.startCol,endLine.endCol".
		colonIdx := strings.LastIndex(line, ":")
		if colonIdx < 0 {
			continue
		}

		filePath := line[:colonIdx]
		fields := strings.Fields(line[colonIdx+1:])
		// fields: ["startLine.startCol,endLine.endCol", "numStmts", "count"]
		if len(fields) < 3 {
			continue
		}

		numStmts, err := strconv.Atoi(fields[1])
		if err != nil || numStmts < 0 {
			continue
		}
		count, err := strconv.Atoi(fields[2])
		if err != nil {
			continue
		}

		relPath := stripModulePath(filePath, modulePath)
		c := fileCounts[relPath]
		c.total += numStmts
		if count > 0 {
			c.covered += numStmts
		}
		fileCounts[relPath] = c
	}
	if err := scanner.Err(); err != nil {
		return nil, err
	}

	result := make(CoverageMap, len(fileCounts))
	for file, c := range fileCounts {
		if c.total == 0 {
			result[file] = -1
		} else {
			result[file] = float64(c.covered) / float64(c.total)
		}
	}
	return result, nil
}

// ─── LCOV ────────────────────────────────────────────────────────────────────

// ParseLCOV parses an LCOV coverage info file (produced by lcov or geninfo).
//
// Relevant records:
//
//	SF:<source file>
//	LH:<lines hit>
//	LF:<lines found>
//	end_of_record
//
// Coverage per file = LH / LF. Returns -1 when LF is zero or absent.
func ParseLCOV(r io.Reader) (CoverageMap, error) {
	result := make(CoverageMap)

	var currentFile string
	var linesHit, linesFound int
	hasLF := false

	flush := func() {
		if currentFile == "" {
			return
		}
		if !hasLF || linesFound == 0 {
			result[currentFile] = -1
		} else {
			result[currentFile] = float64(linesHit) / float64(linesFound)
		}
		currentFile = ""
		linesHit, linesFound = 0, 0
		hasLF = false
	}

	scanner := bufio.NewScanner(r)
	for scanner.Scan() {
		line := scanner.Text()
		switch {
		case strings.HasPrefix(line, "SF:"):
			flush()
			currentFile = strings.TrimPrefix(line, "SF:")
		case strings.HasPrefix(line, "LH:"):
			if n, err := strconv.Atoi(strings.TrimPrefix(line, "LH:")); err == nil {
				linesHit = n
			}
		case strings.HasPrefix(line, "LF:"):
			if n, err := strconv.Atoi(strings.TrimPrefix(line, "LF:")); err == nil {
				linesFound = n
				hasLF = true
			}
		case line == "end_of_record":
			flush()
		}
	}
	flush()

	return result, scanner.Err()
}

// ─── coverage.py JSON ────────────────────────────────────────────────────────

// ParseCoveragePyJSON parses a coverage.py JSON report (coverage json -o coverage.json).
//
// Expected schema:
//
//	{"files": {"path/to/file.py": {"summary": {"percent_covered": 85.0, "num_statements": 100}}}}
//
// Coverage per file = percent_covered / 100. Returns -1 when num_statements is 0.
func ParseCoveragePyJSON(r io.Reader) (CoverageMap, error) {
	var report struct {
		Files map[string]struct {
			Summary struct {
				PercentCovered float64 `json:"percent_covered"`
				NumStatements  int     `json:"num_statements"`
			} `json:"summary"`
		} `json:"files"`
	}

	if err := json.NewDecoder(r).Decode(&report); err != nil {
		return nil, fmt.Errorf("coverage.py json: %w", err)
	}

	result := make(CoverageMap, len(report.Files))
	for file, info := range report.Files {
		if info.Summary.NumStatements == 0 {
			result[file] = -1
		} else {
			result[file] = info.Summary.PercentCovered / 100.0
		}
	}
	return result, nil
}

// ─── JUnit XML ───────────────────────────────────────────────────────────────

type xmlSuite struct {
	XMLName  xml.Name      `xml:"testsuite"`
	Name     string        `xml:"name,attr"`
	Failures int           `xml:"failures,attr"`
	Errors   int           `xml:"errors,attr"`
	Cases    []xmlTestCase `xml:"testcase"`
}

type xmlTestCase struct {
	Name      string   `xml:"name,attr"`
	Classname string   `xml:"classname,attr"`
	Failure   *xmlText `xml:"failure"`
	Error     *xmlText `xml:"error"`
}

type xmlText struct {
	Message string `xml:",chardata"`
}

// ParseJUnitXML parses a JUnit XML report and returns a dirStatus map.
//
// Both <testsuites><testsuite/></testsuites> and bare <testsuite/> roots are
// handled by streaming tokens and collecting every <testsuite> element.
//
// A directory is "err" if its corresponding testsuite has any failures or
// errors. Once "err", subsequent suites for the same directory cannot clear it.
func ParseJUnitXML(r io.Reader, modulePath string) (map[string]string, error) {
	dirStatus := make(map[string]string)

	decoder := xml.NewDecoder(r)
	for {
		tok, err := decoder.Token()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("junit xml: %w", err)
		}

		se, ok := tok.(xml.StartElement)
		if !ok || se.Name.Local != "testsuite" {
			continue
		}

		var suite xmlSuite
		if decErr := decoder.DecodeElement(&suite, &se); decErr != nil {
			continue // skip malformed suites, keep parsing
		}

		dir := packageToDir(suite.Name, modulePath)
		if dir == "" {
			continue
		}

		failed := suite.Failures > 0 || suite.Errors > 0
		if !failed {
			for _, tc := range suite.Cases {
				if tc.Failure != nil || tc.Error != nil {
					failed = true
					break
				}
			}
		}

		if failed {
			dirStatus[dir] = "err"
		} else if dirStatus[dir] != "err" {
			dirStatus[dir] = "ok"
		}
	}

	return dirStatus, nil
}

// ─── Go test JSON ────────────────────────────────────────────────────────────

type goTestEvent struct {
	Action  string `json:"Action"`
	Package string `json:"Package"`
	Test    string `json:"Test"`
}

// ParseGoTestJSON parses newline-delimited Go test JSON output (go test -json).
//
// Only package-level events (no "Test" field) with action "pass" or "fail"
// are used. Returns a dirStatus map keyed by repo-relative directory paths.
func ParseGoTestJSON(r io.Reader, modulePath string) (map[string]string, error) {
	dirStatus := make(map[string]string)

	scanner := bufio.NewScanner(r)
	scanner.Buffer(make([]byte, 64*1024), 64*1024)

	for scanner.Scan() {
		line := scanner.Bytes()
		if len(line) == 0 {
			continue
		}

		var event goTestEvent
		if err := json.Unmarshal(line, &event); err != nil {
			continue // skip malformed lines
		}

		// Skip test-case-level events; only package-level outcomes matter.
		if event.Test != "" {
			continue
		}
		if event.Action != "pass" && event.Action != "fail" {
			continue
		}

		dir := packageToDir(event.Package, modulePath)
		if dir == "" {
			continue
		}

		if event.Action == "fail" {
			dirStatus[dir] = "err"
		} else if dirStatus[dir] != "err" {
			dirStatus[dir] = "ok"
		}
	}

	return dirStatus, scanner.Err()
}

// ─── helpers ─────────────────────────────────────────────────────────────────

// stripModulePath converts a module-qualified file path to a repo-relative path.
// "github.com/mferree/agent-city/internal/repo/file.go" → "internal/repo/file.go"
func stripModulePath(filePath, modulePath string) string {
	if modulePath != "" && strings.HasPrefix(filePath, modulePath+"/") {
		return filePath[len(modulePath)+1:]
	}
	return filePath
}

// packageToDir converts a Go package path to a repo-relative directory path.
// "github.com/mferree/agent-city/internal/repo" → "internal/repo"
func packageToDir(pkgPath, modulePath string) string {
	pkgPath = strings.TrimSpace(pkgPath)
	if pkgPath == "" {
		return ""
	}
	return stripModulePath(pkgPath, modulePath)
}
