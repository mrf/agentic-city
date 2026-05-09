package hub

import (
	"testing"
	"time"

	"github.com/mferree/agent-city/internal/model"
)

// TestMaybeBroadcastPatch_NoDeadlock verifies that maybeBroadcastPatch fans
// out directly to clients and never blocks the hub goroutine.
//
// The original bug: maybeBroadcastPatch sent on h.broadcast (buffered 256).
// Run() is the only reader of that channel, and Run() is the same goroutine
// that calls maybeBroadcastPatch — a full buffer caused permanent self-block.
// Fix: fan out directly to each client's send channel, drop slow clients.
func TestMaybeBroadcastPatch_NoDeadlock(t *testing.T) {
	t.Parallel()

	s := NewState(model.CityState{})
	h := New(s)

	// Register a client with headroom to receive the patch.
	recv := make(chan []byte, 4)
	h.clients[&client{send: recv}] = struct{}{}

	// Register a "slow" client (full send buffer) — should be dropped, not block.
	fullBuf := make(chan []byte, 1)
	fullBuf <- []byte(`{}`) // fill it
	h.clients[&client{send: fullBuf}] = struct{}{}

	// Prime prevJSON so the diff produces patches.
	h.prevJSON = []byte(`{"repoInfo":{},"districts":null,"buildings":null,"roads":null,"agents":null,"activities":null,"stats":{},"ts":0}`)
	s.SetState(model.CityState{
		Agents: []model.Agent{{ID: "agent-1", Mode: "work"}},
	})

	done := make(chan struct{})
	go func() {
		h.maybeBroadcastPatch()
		close(done)
	}()

	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("maybeBroadcastPatch deadlocked")
	}

	// The healthy client should have received one message.
	select {
	case msg := <-recv:
		if len(msg) == 0 {
			t.Error("received empty message")
		}
	default:
		t.Error("healthy client did not receive patch")
	}

	// The slow client should have been dropped from the hub.
	if len(h.clients) != 1 {
		t.Errorf("expected 1 client remaining after drop, got %d", len(h.clients))
	}
}
