package model

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

type RepoInfo struct {
	Name       string `json:"name"`
	Branch     string `json:"branch"`
	HeadCommit string `json:"headCommit"`
	CIStatus   string `json:"ciStatus"` // "passing" | "failing" | "unknown"
}

type District struct {
	ID       string  `json:"id"`
	Label    string  `json:"label"`
	ParentID string  `json:"parentId"`
	GX       float64 `json:"gx"`
	GY       float64 `json:"gy"`
	GW       float64 `json:"gw"`
	GH       float64 `json:"gh"`
}

type Building struct {
	ID         string  `json:"id"`
	DistrictID string  `json:"districtId"`
	Label      string  `json:"label"`
	Language   string  `json:"language"` // "ts" | "tsx" | "go" | "py" | "sql"
	LOC        int     `json:"loc"`
	Coverage   float64 `json:"coverage"` // -1 unknown, 0.0–1.0
	Status     string  `json:"status"`   // "ok" | "warn" | "err" | "unknown"
	Editing    bool    `json:"editing"`
	Exports    int     `json:"exports"`
	GX         float64 `json:"gx"`
	GY         float64 `json:"gy"`
	GW         float64 `json:"gw"`
	GH         float64 `json:"gh"`
	GZ         float64 `json:"gz"`
}

type Road struct {
	FromID     string `json:"fromId"`
	ToID       string `json:"toId"`
	Weight     int    `json:"weight"`
	Confidence string `json:"confidence"` // "exact" | "inferred" | "weak"
}

type Agent struct {
	ID                 string  `json:"id"`
	Color              string  `json:"color"`
	Mode               string  `json:"mode"`                        // "idle" | "work" | "fly" | "error"
	Task               string  `json:"task"`
	Progress           int     `json:"progress"`                    // 0–100
	TargetID           string  `json:"targetId,omitempty"`          // mode=work
	LocationConfidence string  `json:"locationConfidence,omitempty"` // "exact" | "inferred" | "district" | "unknown"
	FromID             string  `json:"fromId,omitempty"`            // mode=fly
	ToID               string  `json:"toId,omitempty"`              // mode=fly
	FlyProgress        float64 `json:"flyProgress,omitempty"`       // 0.0–1.0 on bezier
	ErrorMsg           string  `json:"errorMsg,omitempty"`
}

type ActivityEvent struct {
	Timestamp string `json:"ts"`
	Who       string `json:"who"`      // agent ID | "CI" | "YOU"
	Message   string `json:"message"`
	Color     string `json:"color"`
	Severity  string `json:"severity"` // "info" | "warn" | "error"
}

type RepoStats struct {
	FileCount    int     `json:"fileCount"`
	TotalLOC     int     `json:"totalLoc"`
	Coverage     float64 `json:"coverage"`
	OpenPRs      int     `json:"openPrs"`
	BugCount     int     `json:"bugCount"`
	TestsPassing int     `json:"testsPassing"`
	TestsTotal   int     `json:"testsTotal"`
}
