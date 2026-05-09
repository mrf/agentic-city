package model

import (
	"fmt"
	"testing"
)

func TestAppendActivity_cap(t *testing.T) {
	var acts []ActivityEvent

	// Add more than ActivityCap entries.
	total := ActivityCap + 50
	for i := 0; i < total; i++ {
		acts = AppendActivity(acts, ActivityEvent{
			Timestamp: fmt.Sprintf("t%d", i),
			Who:       "agent",
			Message:   fmt.Sprintf("msg %d", i),
		})
	}

	if len(acts) != ActivityCap {
		t.Fatalf("expected %d activities after cap, got %d", ActivityCap, len(acts))
	}

	// Oldest entries should have been evicted; newest entry should be last.
	last := acts[len(acts)-1]
	if last.Message != fmt.Sprintf("msg %d", total-1) {
		t.Errorf("expected newest entry at end, got %q", last.Message)
	}

	// First entry should be the (total-ActivityCap)th item.
	first := acts[0]
	expectedFirst := fmt.Sprintf("msg %d", total-ActivityCap)
	if first.Message != expectedFirst {
		t.Errorf("expected oldest kept entry %q, got %q", expectedFirst, first.Message)
	}
}

func TestAppendActivity_belowCap(t *testing.T) {
	var acts []ActivityEvent
	for i := 0; i < 10; i++ {
		acts = AppendActivity(acts, ActivityEvent{Message: fmt.Sprintf("msg %d", i)})
	}
	if len(acts) != 10 {
		t.Fatalf("expected 10 activities, got %d", len(acts))
	}
}
