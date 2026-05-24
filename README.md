# AI-CLI-Mobile

Run AI coding assistants (Claude Code, Aider, etc.) from your mobile browser.

A lightweight gateway that wraps CLI-based AI coding tools behind a responsive web terminal, letting you code on the go without a laptop.

## Architecture

```
┌─────────────┐     WebSocket      ┌──────────────────┐
│  Mobile      │ ◄── Terminal ───► │  Fastify Server   │
│  Browser     │ ◄── Control  ───► │  (Docker)         │
│  (xterm.js)  │                    │  ├─ WSGateway     │
│              │                    │  ├─ SessionManager │
│              │                    │  │  └─ tmux + pty  │
│              │                    │  └─ CLI Adapter    │
└─────────────┘                    └──────────────────┘
```

**Dual-Channel WebSocket:**
- **Terminal channel** — Binary data + application-layer PING/PONG (browser WS API cannot send protocol-level Ping frames)
- **Control channel** — JSON messages for auth, status, resize, quick actions

**Key design decisions:**
- Terminal instances are never disposed — `removeChild`/`appendChild` on visibility change (ADR-011)
- 16ms throttle buffer + 1MB backpressure threshold for terminal output
- 200ms debounce + 1s throttle for resize events (prevents SIGWINCH storm on mobile)
- Event-driven state fusion: stream regex → async `tmux capture-pane` confirmation → exit code
- Docker sandbox with seccomp profile, tini PID 1, non-root user

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Server | Node.js 20, Fastify 4, node-pty, tmux |
| Frontend | React 18, Vite, xterm.js (WebGL + Canvas fallback), CodeMirror 6 |
| State | Zustand |
| Auth | JWT dual-token (access 15min + refresh 7d) |
| Mobile | Custom keyboard adapter (IME/CJK), gesture handler (pinch zoom, long-press paste) |
| PWA | vite-plugin-pwa with auto-update |
| Infra | Docker multi-stage build, seccomp, GitHub Actions CI/CD |

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 8+
- tmux 3.3+

### Development

```bash
# Clone
git clone https://github.com/your-username/ai-cli-mobile.git
cd ai-cli-mobile

# Install
pnpm install

# Set environment variables
cp .env.example .env
# Edit .env — set JWT_SECRET, JWT_REFRESH_SECRET, ADMIN_PASSWORD

# Start dev servers (server on :3000, web on :5173 with proxy)
pnpm dev
```

Open `http://localhost:5173` — login with the admin credentials from `.env`.

### Docker (Production)

```bash
# Build and run
cd docker
cp ../.env.example .env
# Edit .env

docker compose up -d app
```

The container serves both the API and frontend on port 3000.

## Project Structure

```
ai-cli-mobile/
├── apps/
│   ├── server/          # Fastify backend
│   │   └── src/
│   │       ├── core/    # SessionManager, WSGateway
│   │       ├── routes/  # auth, terminal, control, fs
│   │       ├── adapters/# CLI adapter (claude, ...)
│   │       └── plugins/ # JWT auth plugin
│   └── web/             # React frontend
│       └── src/
│           ├── components/   # TerminalContainer, FileExplorer, CodeEditor, ...
│           ├── hooks/        # useAuth, useDualChannelWS
│           ├── adapters/     # MobileKeyboardAdapter
│           ├── lib/          # GestureHandler
│           └── store/        # Zustand session store
├── packages/
│   └── shared/          # Protocol types (WS messages, JWT payload, constants)
├── docker/              # Dockerfile, docker-compose, seccomp profile
└── .github/workflows/   # CI: lint → build → test → docker push
```

## Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `3000` | Server port |
| `JWT_SECRET` | Yes | — | Access token signing key (min 32 chars) |
| `JWT_REFRESH_SECRET` | Yes | — | Refresh token signing key (min 32 chars) |
| `PROJECT_ROOT` | No | `/workspace` | Directory to serve via file explorer |
| `ADMIN_USERNAME` | No | `admin` | Initial admin username |
| `ADMIN_PASSWORD` | Yes | — | Initial admin password |
| `VITE_WS_URL` | No | auto | WebSocket URL (frontend, default: same origin) |

## WS Protocol

See [`packages/shared/src/protocol.ts`](packages/shared/src/protocol.ts) for full type definitions.

**Connection flow:**
1. Terminal WS → AUTH (JWT + protocol version) → AUTH_OK → ATTACH_SESSION → binary mode
2. Control WS → AUTH → AUTH_OK → INIT_SESSION → SESSION_READY

**Close codes:** `4001` = auth failed (triggers token refresh), `4002` = protocol mismatch (triggers page reload)

## Adding a CLI Adapter

Implement the `CLIAdapter` interface from `apps/server/src/adapters/base.ts`:

```typescript
import { CLIAdapter } from './base.js'

export class MyToolAdapter implements CLIAdapter {
  startCommand = 'my-tool --interactive'
  parseStreamData(text: string): StateCandidate | null { ... }
  parseScreenSnapshot(screen: string): AgentStatus | null { ... }
  getQuickActions(): QuickAction[] { ... }
  supportsStructuredOutput = false
}
```

Register it in `apps/server/src/index.ts`:
```typescript
adapters.set('mytool', new MyToolAdapter())
```

## Roadmap

- [ ] Multi-user support (user management API, session isolation)
- [ ] Persistent session state (survive server restarts)
- [ ] More CLI adapters (Aider, Cursor, etc.)
- [ ] File editor (write support via PUT /api/fs/file)
- [ ] Proper PWA icons and splash screens

## License

MIT
