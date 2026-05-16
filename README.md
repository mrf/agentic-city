# Agent City

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Manage AI coding agents like a SimCity mayor. Buildings are files, districts are directories, UFO agents are your running Claude/Codex/Gemini sessions.

Agent City turns your codebase into a living isometric city. File sizes determine building heights, directory structure defines districts, and each active AI coding session appears as a UFO flying overhead. Changes in the repo — new files, edits, agent activity — flow in real-time over WebSockets so you always see what's happening and where.

**Status:** Phase 1 (see the city) is complete. Phase 2 (dispatch and control agents from the UI) is in progress.

## Learn More

Architecture, design decisions, and the full keyboard binding table are in **[DESIGN.md](DESIGN.md)**.

## Quick Start

```bash
git clone <repo> && cd agentic-city
make dev          # start frontend dev server (http://localhost:5173)
make run          # start Go backend (http://localhost:8080)
```

Open `http://localhost:5173` and point it at a repo.

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `←` `→` `↑` `↓` | Pan city |
| `+` / `-` | Zoom in / out |
| `Tab` | Cycle through active agents |
| `Enter` | Focus selected agent |
| `Esc` | Deselect / close panel |
| `R` | Recenter view |
| `?` | Toggle help |

## Stack

Go backend · React + Canvas frontend · [agentwatch](https://github.com/mrf/agentwatch) for agent detection
