package hub

import (
	"bytes"
	"context"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/gorilla/websocket"
	"github.com/mferree/agent-city/internal/model"
)

const (
	// agentTickInterval is the cadence for broadcasting agent-state patches.
	agentTickInterval = 100 * time.Millisecond

	writeWait  = 10 * time.Second
	pongWait   = 60 * time.Second
	pingPeriod = (pongWait * 9) / 10

	// maxMessageSize caps inbound client messages (select, ping, etc.).
	maxMessageSize = 4096
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

// Hub manages WebSocket clients and broadcasts CityState updates.
//
// Two broadcast cadences:
//   - 100 ms ticker: picks up agent-state changes.
//   - Notify(): immediate diff+broadcast triggered by the repo watcher.
type Hub struct {
	state      *State
	clients    map[*client]struct{}
	broadcast  chan []byte
	register   chan *client
	unregister chan *client
	notifyCh   chan struct{}
	prevJSON   []byte
}

// New creates a Hub backed by the given State.
func New(s *State) *Hub {
	return &Hub{
		state:      s,
		clients:    make(map[*client]struct{}),
		broadcast:  make(chan []byte, 256),
		register:   make(chan *client),
		unregister: make(chan *client),
		notifyCh:   make(chan struct{}, 1),
	}
}

// Notify signals that the city state has changed and a patch should be
// broadcast immediately. Non-blocking: coalesces rapid-fire notifications.
func (h *Hub) Notify() {
	select {
	case h.notifyCh <- struct{}{}:
	default:
	}
}

// ServeWS upgrades the HTTP connection to WebSocket and registers the client
// with the hub. The client immediately receives a state.full snapshot.
func (h *Hub) ServeWS(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("hub: ws upgrade: %v", err)
		return
	}
	c := &client{
		hub:  h,
		conn: conn,
		send: make(chan []byte, 256),
	}
	h.register <- c
	go c.writePump()
	go c.readPump()
}

// Run is the hub's main loop. It must be called in a goroutine. It returns
// when ctx is cancelled.
func (h *Hub) Run(ctx context.Context) {
	ticker := time.NewTicker(agentTickInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return

		case c := <-h.register:
			h.clients[c] = struct{}{}
			h.sendFull(c)

		case c := <-h.unregister:
			if _, ok := h.clients[c]; ok {
				delete(h.clients, c)
				close(c.send)
			}

		case msg := <-h.broadcast:
			for c := range h.clients {
				select {
				case c.send <- msg:
				default:
					delete(h.clients, c)
					close(c.send)
				}
			}

		case <-h.notifyCh:
			h.maybeBroadcastPatch()

		case <-ticker.C:
			h.maybeBroadcastPatch()
		}
	}
}

// sendFull serialises the current CityState as a state.full message and
// enqueues it on a single newly connected client.
func (h *Hub) sendFull(c *client) {
	state := h.state.GetState()
	msg, err := marshalFull(state)
	if err != nil {
		log.Printf("hub: marshal full: %v", err)
		return
	}
	if len(h.prevJSON) == 0 {
		h.prevJSON = h.state.getStateJSON()
	}
	select {
	case c.send <- msg:
	default:
		delete(h.clients, c)
		close(c.send)
	}
}

// maybeBroadcastPatch checks whether the state has changed since the last
// broadcast and, if so, diffs it and enqueues a state.patch message.
//
// The dirty flag on State is consumed first; if it is clear, the tick is a
// no-op and no JSON work is done at all.
func (h *Hub) maybeBroadcastPatch() {
	if len(h.clients) == 0 {
		return
	}
	currJSON, dirty := h.state.consumeStateJSON()
	if !dirty {
		return // state unchanged since last tick
	}
	if bytes.Equal(currJSON, h.prevJSON) {
		return // content identical (e.g. SetState called with same data)
	}

	patches := Diff(h.prevJSON, currJSON)
	h.prevJSON = currJSON

	if len(patches) == 0 {
		return
	}

	msg, err := marshalPatch(patches)
	if err != nil {
		log.Printf("hub: marshal patch: %v", err)
		return
	}
	h.broadcast <- msg
}

// --- wire protocol helpers ---------------------------------------------------

type fullMsg struct {
	Type string          `json:"type"`
	Data model.CityState `json:"data"`
}

type patchMsg struct {
	Type    string      `json:"type"`
	Patches []JSONPatch `json:"patches"`
}

func marshalFull(s model.CityState) ([]byte, error) {
	return json.Marshal(fullMsg{Type: "state.full", Data: s})
}

func marshalPatch(patches []JSONPatch) ([]byte, error) {
	return json.Marshal(patchMsg{Type: "state.patch", Patches: patches})
}

// --- client ------------------------------------------------------------------

// client represents a single connected WebSocket peer.
type client struct {
	hub  *Hub
	conn *websocket.Conn
	send chan []byte
}

// readPump drains inbound messages and unregisters the client on disconnect.
// Client → server messages (e.g. {"type":"select","buildingId":"..."}) are
// accepted but not yet acted on.
func (c *client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()
	c.conn.SetReadLimit(maxMessageSize)
	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})
	for {
		if _, _, err := c.conn.ReadMessage(); err != nil {
			break
		}
	}
}

// writePump drains the send queue and forwards messages to the WebSocket.
// It also sends periodic pings to keep the connection alive.
func (c *client) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()
	for {
		select {
		case msg, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			if err := c.conn.WriteMessage(websocket.TextMessage, msg); err != nil {
				return
			}
		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
