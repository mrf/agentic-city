package hub

import (
	"testing"
	"time"

	"github.com/mferree/agent-city/internal/model"
)

// TestGetState_SlicesAreIndependent verifies that GetState returns a deep copy:
// mutating slice elements in the returned value must not affect internal state.
func TestGetState_SlicesAreIndependent(t *testing.T) {
	orig := model.CityState{
		Districts:  []model.District{{ID: "d1"}},
		Buildings:  []model.Building{{ID: "b1"}},
		Roads:      []model.Road{{FromID: "x", ToID: "y"}},
		Agents:     []model.Agent{{ID: "a1", Task: "original"}},
		Activities: []model.ActivityEvent{{Who: "agent1", Message: "hello"}},
	}
	s := NewState(orig)

	got := s.GetState()

	// Mutate every slice element in the copy.
	got.Districts[0].ID = "MUTATED"
	got.Buildings[0].ID = "MUTATED"
	got.Roads[0].FromID = "MUTATED"
	got.Agents[0].Task = "MUTATED"
	got.Activities[0].Message = "MUTATED"

	// Re-fetch the state; internal state must be unchanged.
	back := s.GetState()
	if back.Districts[0].ID != "d1" {
		t.Errorf("Districts backing array shared: got %q, want %q", back.Districts[0].ID, "d1")
	}
	if back.Buildings[0].ID != "b1" {
		t.Errorf("Buildings backing array shared: got %q, want %q", back.Buildings[0].ID, "b1")
	}
	if back.Roads[0].FromID != "x" {
		t.Errorf("Roads backing array shared: got %q, want %q", back.Roads[0].FromID, "x")
	}
	if back.Agents[0].Task != "original" {
		t.Errorf("Agents backing array shared: got %q, want %q", back.Agents[0].Task, "original")
	}
	if back.Activities[0].Message != "hello" {
		t.Errorf("Activities backing array shared: got %q, want %q", back.Activities[0].Message, "hello")
	}
}

// TestState_DirtyFlagLifecycle verifies that SetState marks the state dirty and
// consumeStateJSON clears it atomically.
func TestState_DirtyFlagLifecycle(t *testing.T) {
	s := NewState(model.CityState{})

	// Fresh state should be dirty so the first snapshot is broadcast.
	_, dirty := s.consumeStateJSON()
	if !dirty {
		t.Error("expected new State to be dirty")
	}

	// After consuming, state should be clean.
	_, dirty = s.consumeStateJSON()
	if dirty {
		t.Error("expected State to be clean after consumeStateJSON")
	}

	// SetState should mark dirty again.
	s.SetState(model.CityState{Stats: model.RepoStats{FileCount: 5}})
	_, dirty = s.consumeStateJSON()
	if !dirty {
		t.Error("expected State to be dirty after SetState")
	}
}

// TestHub_NoopTickSkipsBroadcast verifies that repeated ticks without any
// intervening SetState do not enqueue messages on the broadcast channel.
func TestHub_NoopTickSkipsBroadcast(t *testing.T) {
	initial := model.CityState{Stats: model.RepoStats{FileCount: 1}}
	s := NewState(initial)
	h := New(s)

	// Drain the state's dirty flag (simulate the hub having already sent a full
	// snapshot so prevJSON is populated and the dirty flag is clear).
	h.prevJSON, _ = s.consumeStateJSON()

	// With no intervening SetState, maybeBroadcastPatch must not enqueue anything.
	// Register a synthetic client so the early-exit "no clients" check doesn't fire.
	h.clients[&client{}] = struct{}{}

	before := len(h.broadcast)
	h.maybeBroadcastPatch()
	after := len(h.broadcast)

	if after > before {
		t.Errorf("broadcast channel grew by %d on a no-op tick", after-before)
	}
}

// TestHub_SetStateTriggersBroadcast verifies that after SetState the next
// maybeBroadcastPatch call does enqueue a patch.
func TestHub_SetStateTriggersBroadcast(t *testing.T) {
	initial := model.CityState{Stats: model.RepoStats{FileCount: 1}}
	s := NewState(initial)
	h := New(s)

	// Simulate the hub having already sent the initial snapshot.
	h.prevJSON, _ = s.consumeStateJSON()
	h.clients[&client{}] = struct{}{}

	// Mutate state.
	s.SetState(model.CityState{Stats: model.RepoStats{FileCount: 99}})

	// Allow the broadcast to be drained in a background goroutine so the
	// buffered send in maybeBroadcastPatch doesn't block.
	done := make(chan struct{})
	go func() {
		defer close(done)
		select {
		case <-h.broadcast:
		case <-time.After(time.Second):
		}
	}()

	h.maybeBroadcastPatch()

	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("timeout waiting for broadcast after SetState")
	}
}
