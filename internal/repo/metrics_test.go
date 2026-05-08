package repo

import (
	"strings"
	"testing"
)

// ─── ParseGoCoverage ─────────────────────────────────────────────────────────

func TestParseGoCoverage_Basic(t *testing.T) {
	// scanner.go: block1 = 3 stmts covered, block2 = 2 stmts not covered → 3/5 = 0.6
	// watcher.go: block1 = 4 stmts covered → 4/4 = 1.0
	input := `mode: set
github.com/mferree/agent-city/internal/repo/scanner.go:10.5,20.15 3 1
github.com/mferree/agent-city/internal/repo/scanner.go:25.1,30.5 2 0
github.com/mferree/agent-city/internal/repo/watcher.go:5.1,15.10 4 4
`
	cov, err := ParseGoCoverage(strings.NewReader(input), "github.com/mferree/agent-city")
	if err != nil {
		t.Fatalf("ParseGoCoverage: %v", err)
	}

	if got := cov["internal/repo/scanner.go"]; got < 0.59 || got > 0.61 {
		t.Errorf("scanner.go coverage = %v, want ~0.6", got)
	}
	if got := cov["internal/repo/watcher.go"]; got < 0.99 || got > 1.01 {
		t.Errorf("watcher.go coverage = %v, want 1.0", got)
	}
}

func TestParseGoCoverage_ZeroStmts(t *testing.T) {
	// A file block with 0 statements should produce -1 (unknown).
	input := `mode: set
github.com/mferree/agent-city/pkg/empty.go:1.1,1.1 0 0
`
	cov, err := ParseGoCoverage(strings.NewReader(input), "github.com/mferree/agent-city")
	if err != nil {
		t.Fatalf("ParseGoCoverage: %v", err)
	}
	if got := cov["pkg/empty.go"]; got != -1 {
		t.Errorf("empty.go coverage = %v, want -1", got)
	}
}

func TestParseGoCoverage_NoModulePath(t *testing.T) {
	// Without a module path, file paths are returned as-is.
	input := `mode: count
internal/repo/scanner.go:10.5,20.15 2 3
`
	cov, err := ParseGoCoverage(strings.NewReader(input), "")
	if err != nil {
		t.Fatalf("ParseGoCoverage: %v", err)
	}
	if _, ok := cov["internal/repo/scanner.go"]; !ok {
		t.Error("expected key internal/repo/scanner.go in CoverageMap")
	}
}

// ─── ParseLCOV ───────────────────────────────────────────────────────────────

func TestParseLCOV_Basic(t *testing.T) {
	input := `TN:
SF:internal/repo/scanner.go
DA:10,1
DA:15,0
DA:20,3
LH:2
LF:3
end_of_record
SF:internal/repo/watcher.go
LH:0
LF:0
end_of_record
`
	cov, err := ParseLCOV(strings.NewReader(input))
	if err != nil {
		t.Fatalf("ParseLCOV: %v", err)
	}

	// scanner.go: 2/3 ≈ 0.667
	if got := cov["internal/repo/scanner.go"]; got < 0.66 || got > 0.68 {
		t.Errorf("scanner.go coverage = %v, want ~0.667", got)
	}

	// watcher.go: LF=0 → -1 (unknown)
	if got := cov["internal/repo/watcher.go"]; got != -1 {
		t.Errorf("watcher.go coverage = %v, want -1", got)
	}
}

func TestParseLCOV_MissingLF(t *testing.T) {
	// No LF record → unknown (-1).
	input := `SF:src/file.go
LH:5
end_of_record
`
	cov, err := ParseLCOV(strings.NewReader(input))
	if err != nil {
		t.Fatalf("ParseLCOV: %v", err)
	}
	if got := cov["src/file.go"]; got != -1 {
		t.Errorf("file.go (missing LF) = %v, want -1", got)
	}
}

func TestParseLCOV_FullCoverage(t *testing.T) {
	input := `SF:src/full.go
LH:10
LF:10
end_of_record
`
	cov, err := ParseLCOV(strings.NewReader(input))
	if err != nil {
		t.Fatalf("ParseLCOV: %v", err)
	}
	if got := cov["src/full.go"]; got < 0.99 || got > 1.01 {
		t.Errorf("full.go coverage = %v, want 1.0", got)
	}
}

// ─── ParseCoveragePyJSON ─────────────────────────────────────────────────────

func TestParseCoveragePyJSON_Basic(t *testing.T) {
	input := `{
		"meta": {"version": "7.3"},
		"files": {
			"module/file.py": {
				"summary": {
					"percent_covered": 85.0,
					"num_statements": 100
				}
			},
			"module/empty.py": {
				"summary": {
					"percent_covered": 0.0,
					"num_statements": 0
				}
			}
		}
	}`
	cov, err := ParseCoveragePyJSON(strings.NewReader(input))
	if err != nil {
		t.Fatalf("ParseCoveragePyJSON: %v", err)
	}

	// 85% → 0.85
	if got := cov["module/file.py"]; got < 0.84 || got > 0.86 {
		t.Errorf("file.py coverage = %v, want 0.85", got)
	}

	// 0 statements → -1 (unknown)
	if got := cov["module/empty.py"]; got != -1 {
		t.Errorf("empty.py coverage = %v, want -1", got)
	}
}

func TestParseCoveragePyJSON_InvalidJSON(t *testing.T) {
	_, err := ParseCoveragePyJSON(strings.NewReader("not json"))
	if err == nil {
		t.Error("expected error for invalid JSON input")
	}
}

// ─── ParseJUnitXML ───────────────────────────────────────────────────────────

func TestParseJUnitXML_TestsuitesRoot(t *testing.T) {
	input := `<?xml version="1.0"?>
<testsuites>
  <testsuite name="github.com/mferree/agent-city/internal/repo" tests="2" failures="1" errors="0">
    <testcase name="TestScanRepo" classname="github.com/mferree/agent-city/internal/repo">
      <failure>assertion failed</failure>
    </testcase>
    <testcase name="TestScanConfig" classname="github.com/mferree/agent-city/internal/repo"/>
  </testsuite>
  <testsuite name="github.com/mferree/agent-city/internal/layout" tests="1" failures="0" errors="0">
    <testcase name="TestEngine" classname="github.com/mferree/agent-city/internal/layout"/>
  </testsuite>
</testsuites>`

	dirStatus, err := ParseJUnitXML(strings.NewReader(input), "github.com/mferree/agent-city")
	if err != nil {
		t.Fatalf("ParseJUnitXML: %v", err)
	}

	if got := dirStatus["internal/repo"]; got != "err" {
		t.Errorf("internal/repo status = %q, want err", got)
	}
	if got := dirStatus["internal/layout"]; got != "ok" {
		t.Errorf("internal/layout status = %q, want ok", got)
	}
}

func TestParseJUnitXML_BareTestsuiteRoot(t *testing.T) {
	// Some tools emit <testsuite> as the root element (no <testsuites> wrapper).
	input := `<?xml version="1.0"?>
<testsuite name="github.com/mferree/agent-city/internal/hub" tests="3" failures="0" errors="0">
  <testcase name="TestHub" classname="github.com/mferree/agent-city/internal/hub"/>
</testsuite>`

	dirStatus, err := ParseJUnitXML(strings.NewReader(input), "github.com/mferree/agent-city")
	if err != nil {
		t.Fatalf("ParseJUnitXML: %v", err)
	}
	if got := dirStatus["internal/hub"]; got != "ok" {
		t.Errorf("internal/hub status = %q, want ok", got)
	}
}

func TestParseJUnitXML_ErrorsAttribute(t *testing.T) {
	// errors="1" (not failures) should still produce "err".
	input := `<testsuite name="github.com/mferree/agent-city/internal/deps" tests="1" failures="0" errors="1">
  <testcase name="TestAnalyze" classname="github.com/mferree/agent-city/internal/deps">
    <error>panic: nil pointer</error>
  </testcase>
</testsuite>`

	dirStatus, err := ParseJUnitXML(strings.NewReader(input), "github.com/mferree/agent-city")
	if err != nil {
		t.Fatalf("ParseJUnitXML: %v", err)
	}
	if got := dirStatus["internal/deps"]; got != "err" {
		t.Errorf("internal/deps status = %q, want err", got)
	}
}

func TestParseJUnitXML_ErrNotDowngradedToOk(t *testing.T) {
	// Two suites for the same dir: first fails, second passes → stays "err".
	input := `<testsuites>
  <testsuite name="github.com/mferree/agent-city/internal/repo" tests="1" failures="1" errors="0">
    <testcase name="TestA"><failure>bad</failure></testcase>
  </testsuite>
  <testsuite name="github.com/mferree/agent-city/internal/repo" tests="1" failures="0" errors="0">
    <testcase name="TestB"/>
  </testsuite>
</testsuites>`

	dirStatus, err := ParseJUnitXML(strings.NewReader(input), "github.com/mferree/agent-city")
	if err != nil {
		t.Fatalf("ParseJUnitXML: %v", err)
	}
	if got := dirStatus["internal/repo"]; got != "err" {
		t.Errorf("internal/repo status = %q, want err (must not downgrade)", got)
	}
}

// ─── ParseGoTestJSON ─────────────────────────────────────────────────────────

func TestParseGoTestJSON_Basic(t *testing.T) {
	input := `{"Action":"run","Package":"github.com/mferree/agent-city/internal/repo","Test":"TestScanRepo"}
{"Action":"fail","Package":"github.com/mferree/agent-city/internal/repo","Test":"TestScanRepo","Elapsed":0.1}
{"Action":"fail","Package":"github.com/mferree/agent-city/internal/repo","Elapsed":0.5}
{"Action":"run","Package":"github.com/mferree/agent-city/internal/layout","Test":"TestEngine"}
{"Action":"pass","Package":"github.com/mferree/agent-city/internal/layout","Test":"TestEngine","Elapsed":0.02}
{"Action":"pass","Package":"github.com/mferree/agent-city/internal/layout","Elapsed":0.1}
`
	dirStatus, err := ParseGoTestJSON(strings.NewReader(input), "github.com/mferree/agent-city")
	if err != nil {
		t.Fatalf("ParseGoTestJSON: %v", err)
	}

	if got := dirStatus["internal/repo"]; got != "err" {
		t.Errorf("internal/repo status = %q, want err", got)
	}
	if got := dirStatus["internal/layout"]; got != "ok" {
		t.Errorf("internal/layout status = %q, want ok", got)
	}
}

func TestParseGoTestJSON_IgnoresTestCaseEvents(t *testing.T) {
	// Only package-level events (no "Test" field) should be counted.
	// If a test case fails but the package passes, that's still "ok".
	input := `{"Action":"fail","Package":"github.com/mferree/agent-city/internal/repo","Test":"TestFoo"}
{"Action":"pass","Package":"github.com/mferree/agent-city/internal/repo"}
`
	dirStatus, err := ParseGoTestJSON(strings.NewReader(input), "github.com/mferree/agent-city")
	if err != nil {
		t.Fatalf("ParseGoTestJSON: %v", err)
	}
	if got := dirStatus["internal/repo"]; got != "ok" {
		t.Errorf("internal/repo status = %q, want ok (package-level passed)", got)
	}
}

func TestParseGoTestJSON_SkipsMalformedLines(t *testing.T) {
	input := `not json
{"Action":"pass","Package":"github.com/mferree/agent-city/internal/hub"}
`
	dirStatus, err := ParseGoTestJSON(strings.NewReader(input), "github.com/mferree/agent-city")
	if err != nil {
		t.Fatalf("ParseGoTestJSON: %v", err)
	}
	if got := dirStatus["internal/hub"]; got != "ok" {
		t.Errorf("internal/hub status = %q, want ok", got)
	}
}

// ─── MetricsSource.StatusFor ─────────────────────────────────────────────────

func TestStatusFor_FileStatusTakesPrecedence(t *testing.T) {
	src := MetricsSource{
		FileStatus: map[string]string{
			"internal/repo/scanner.go": "err",
		},
		DirStatus: map[string]string{
			"internal/repo": "ok",
		},
	}

	if got := src.StatusFor("internal/repo/scanner.go"); got != "err" {
		t.Errorf("FileStatus not consulted first: got %q, want err", got)
	}
}

func TestStatusFor_DirStatusFallback(t *testing.T) {
	src := MetricsSource{
		FileStatus: map[string]string{},
		DirStatus: map[string]string{
			"internal/repo": "ok",
		},
	}

	if got := src.StatusFor("internal/repo/watcher.go"); got != "ok" {
		t.Errorf("DirStatus fallback failed: got %q, want ok", got)
	}
}

func TestStatusFor_UnknownWhenNoData(t *testing.T) {
	src := MetricsSource{
		FileStatus: make(map[string]string),
		DirStatus:  make(map[string]string),
	}

	// Must return "unknown" — never "ok" — when no data is available.
	if got := src.StatusFor("anything/file.go"); got != "unknown" {
		t.Errorf("StatusFor with no data = %q, want unknown (never ok by default)", got)
	}
}

func TestStatusFor_RootFile(t *testing.T) {
	// A file at the repo root has dir "" in DirStatus.
	src := MetricsSource{
		FileStatus: map[string]string{},
		DirStatus: map[string]string{
			"": "err",
		},
	}
	if got := src.StatusFor("main.go"); got != "err" {
		t.Errorf("root-level file status = %q, want err", got)
	}
}

// ─── mergeStatus ─────────────────────────────────────────────────────────────

func TestMergeStatus_ErrWins(t *testing.T) {
	dst := map[string]string{"pkg/a": "ok"}
	src := map[string]string{"pkg/a": "err"}
	mergeStatus(dst, src)
	if dst["pkg/a"] != "err" {
		t.Errorf("merge: err should override ok, got %q", dst["pkg/a"])
	}
}

func TestMergeStatus_ErrNotDowngradedByOk(t *testing.T) {
	dst := map[string]string{"pkg/a": "err"}
	src := map[string]string{"pkg/a": "ok"}
	mergeStatus(dst, src)
	if dst["pkg/a"] != "err" {
		t.Errorf("merge: err must not be downgraded by ok, got %q", dst["pkg/a"])
	}
}
