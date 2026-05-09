package model

// ActivityCap is the maximum number of ActivityEvent entries kept in CityState.Activities.
// When the cap is reached, the oldest entries are evicted.
const ActivityCap = 200

// AppendActivity appends ev to activities, evicting the oldest entries when len exceeds ActivityCap.
func AppendActivity(activities []ActivityEvent, ev ActivityEvent) []ActivityEvent {
	activities = append(activities, ev)
	if len(activities) > ActivityCap {
		activities = activities[len(activities)-ActivityCap:]
	}
	return activities
}

// CityState is the top-level snapshot sent to browser clients.
type CityState struct {
	RepoInfo   RepoInfo        `json:"repoInfo"`
	Districts  []District      `json:"districts"`
	Buildings  []Building      `json:"buildings"`
	Roads      []Road          `json:"roads"`
	Agents     []Agent         `json:"agents"`
	Activities []ActivityEvent `json:"activities"`
	Stats      RepoStats       `json:"stats"`
	Timestamp  int64           `json:"ts"`
}

// RepoInfo holds metadata about the scanned repository.
type RepoInfo struct {
	Name       string `json:"name"`
	Branch     string `json:"branch"`
	HeadCommit string `json:"headCommit"`
	CIStatus   string `json:"ciStatus"` // "passing" | "failing" | "unknown"
}

// District represents a directory in the city layout.
type District struct {
	ID       string  `json:"id"`       // directory path: "src/auth"
	Label    string  `json:"label"`    // display: "AUTH/"
	ParentID string  `json:"parentId"`
	GX       float64 `json:"gx"` // grid coordinates
	GY       float64 `json:"gy"`
	GW       float64 `json:"gw"`
	GH       float64 `json:"gh"`
}

// Building represents a source file in the city layout.
type Building struct {
	ID         string  `json:"id"`         // file path relative to repo root
	DistrictID string  `json:"districtId"`
	Label      string  `json:"label"`      // filename
	Language   string  `json:"language"`   // "ts", "tsx", "go", "py", "sql"
	LOC        int     `json:"loc"`
	Coverage   float64 `json:"coverage"`   // -1 unknown, 0.0–1.0 → window dot density
	Status     string  `json:"status"`     // "ok" | "warn" | "err" | "unknown"
	Editing    bool    `json:"editing"`    // yellow pulse rings on roof
	Exports    int     `json:"exports"`
	GX         float64 `json:"gx"`         // grid position
	GY         float64 `json:"gy"`
	GW         float64 `json:"gw"`         // footprint
	GH         float64 `json:"gh"`
	GZ         float64 `json:"gz"`         // height (∝ LOC)
}

// Road represents a dependency edge between two buildings.
type Road struct {
	FromID     string `json:"fromId"`
	ToID       string `json:"toId"`
	Weight     int    `json:"weight"`
	Confidence string `json:"confidence"` // "exact" | "inferred" | "weak"
}

// Agent represents an AI coding session mapped onto the city.
type Agent struct {
	ID                 string  `json:"id"`
	Color              string  `json:"color"`
	Mode               string  `json:"mode"`                        // "idle" | "work" | "fly" | "error"
	Task               string  `json:"task"`
	Progress           int     `json:"progress"`                    // 0–100
	TargetID           string  `json:"targetId,omitempty"`           // mode=work
	LocationConfidence string  `json:"locationConfidence,omitempty"` // "exact" | "inferred" | "district" | "unknown"
	FromID             string  `json:"fromId,omitempty"`             // mode=fly
	ToID               string  `json:"toId,omitempty"`               // mode=fly
	FlyProgress        float64 `json:"flyProgress,omitempty"`        // 0.0–1.0 on bezier
	ErrorMsg           string  `json:"errorMsg,omitempty"`
	ModelTier          string  `json:"modelTier,omitempty"`          // "opus" | "sonnet" | "haiku" | "unknown"
}

// ActivityEvent is an entry in the city's activity log.
type ActivityEvent struct {
	Timestamp string `json:"ts"`
	Who       string `json:"who"`      // agent ID | "CI" | "YOU"
	Message   string `json:"message"`
	Color     string `json:"color"`
	Severity  string `json:"severity"` // "info" | "warn" | "error"
}

// RepoStats holds aggregate statistics for the repository.
type RepoStats struct {
	FileCount    int     `json:"fileCount"`
	TotalLOC     int     `json:"totalLoc"`
	Coverage     float64 `json:"coverage"`
	OpenPRs      int     `json:"openPrs"`
	BugCount     int     `json:"bugCount"`
	TestsPassing int     `json:"testsPassing"`
	TestsTotal   int     `json:"testsTotal"`
}
