# Contributing to AI-CLI-Mobile

Thanks for your interest in contributing! This guide covers everything you need to get started.

## Table of Contents

- [Development Setup](#development-setup)
- [Architecture Overview](#architecture-overview)
- [Code Style](#code-style)
- [Testing Guidelines](#testing-guidelines)
- [Commit Messages](#commit-messages)
- [Pull Request Process](#pull-request-process)
- [Adding a CLI Adapter](#adding-a-cli-adapter)
- [Reporting Issues](#reporting-issues)

## Development Setup

**Prerequisites:** Node.js 20+, pnpm 8+, tmux 3.3+

```bash
git clone https://github.com/wait4xx/AI-CLI-Mobile.git
cd AI-CLI-Mobile
pnpm install
cp .env.example .env
# Edit .env — set JWT_SECRET, JWT_REFRESH_SECRET (≥32 chars each), ADMIN_PASSWORD (≥8 chars)
pnpm dev
```

This starts:

- **Backend** on `http://localhost:18333` (Fastify + WebSocket)
- **Frontend** on `http://localhost:5173` (Vite dev server with HMR, proxying API/WS requests to `:18333`)

## Architecture Overview

This is a pnpm monorepo with three packages:

```
apps/server/     Fastify backend — WebSocket gateway, session management, CLI adapters
apps/web/        React frontend — xterm.js terminal, code editor, split-pane layout
packages/shared/  Protocol types — WS message constants, JWT payload, TypeScript interfaces
```

### Core Data Flow

```
Browser                          Server
┌───────────┐                    ┌──────────────────┐
│ xterm.js  │──binary WS──────►│ WSGateway         │
│           │◄──terminal data──│   ├─ termDeviceMap│
│ Zustand   │──JSON WS────────►│   └─ ctrlDeviceMap│
│ store     │◄──control msgs───│ SessionManager    │
└───────────┘                    │   └─ tmux + node-pty
                                └──────────────────┘
```

**Dual-channel WebSocket:**

- **Terminal channel** — Raw binary PTY I/O. Handles AUTH → ATTACH_SESSION → bidirectional data.
- **Control channel** — JSON messages for INIT_SESSION, state sync (agent status, exit codes), resize, quick actions, device tracking, observer mode.

**CLI Adapter pattern:** Each adapter (`claude.ts`, `aider.ts`, `shell.ts`) implements `CLIAdapter` from `base.ts`. It translates raw terminal output into structured state (idle/running/approval/error) via stream regex + `tmux capture-pane` snapshots. The frontend renders status badges and quick-action buttons based on this state.

**Frontend state:** A single Zustand store (`sessionStore.ts`) with `persist` middleware manages all UI state: sessions, split-pane tree, terminal-session mapping, auth tokens, and UI preferences. Split panes use a recursive tree model (`SplitNode = SplitPanel | SplitContainer`) with immutable updates.

## Code Style

Enforced via shared configs. Run `pnpm lint` and `pnpm format` before committing.

**TypeScript:**

- Strict mode enabled
- No `any` without explicit `// eslint-disable-next-line` justification
- Use `interface` for object shapes, `type` for unions/intersections
- Prefer `const` over `let`; never use `var`

**Naming conventions:**

- Files: `PascalCase.tsx` for React components, `camelCase.ts` for utilities
- Directories: `camelCase` (e.g., `adapters/`, `hooks/`, `lib/`)
- Components: PascalCase (e.g., `TerminalContainer`, `SessionTabs`)
- Hooks: `use` prefix (e.g., `useAuth`, `useDualChannelWS`)
- Store actions: camelCase verbs (e.g., `splitPanelWithSession`, `setActivePanelId`)
- Constants: `UPPER_SNAKE_CASE` (e.g., `DEFAULT_TERMINAL_THEME`, `MAX_FONT_SIZE`)
- Types/interfaces: PascalCase (e.g., `SplitNode`, `PanelFileState`)

**React patterns:**

- Functional components with hooks only (no class components)
- `memo()` for expensive components that receive stable props
- Extract complex callbacks with `useCallback` when passed as props
- Module-level caches for expensive singletons (e.g., `terminalCache` Map in TerminalContainer)

**File organization:**

- One component per file (co-located with tests: `Component.test.tsx`)
- Shared types in `packages/shared/`
- Utility functions in `lib/`, hooks in `hooks/`

## Testing Guidelines

```bash
# All unit/integration tests
pnpm test

# Watch mode (single package)
cd apps/server && pnpm test -- --watch

# E2E tests (requires running server on :18333)
pnpm e2e

# Coverage report
cd apps/server && pnpm test -- --coverage
```

**What to test:**

- **Adapters:** Test `parseStreamData()` and `parseScreenSnapshot()` with realistic terminal output samples. Verify state transitions (idle → running → approval → idle).
- **Routes:** Test HTTP endpoints with valid/invalid inputs, auth failures, and edge cases (path traversal, empty bodies, oversized payloads).
- **Core modules:** Test `SessionManager` and `WSGateway` with mock WebSocket connections. Verify attach/detach, device registration/unregistration, observer mode.
- **React components:** Test rendering with different prop combinations, user interactions (click, type), and store integration.
- **Shared types:** Test constants, heartbeat calculations, close code mappings.

**Writing good tests:**

- Use descriptive test names: `should transition to RUNNING when Claude outputs "[Thinking]" block`
- Test edge cases alongside happy paths
- Mock external dependencies (node-pty, tmux, filesystem) — don't depend on runtime state
- For WS tests, use mock WebSocket objects with `send`/`close` spies

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add split-pane drag-and-drop layout
fix: observer mode incorrectly triggered for single user
refactor: extract split tree operations into splitLayout.ts
test: add WSGateway device lifecycle tests
docs: update API documentation for user management
chore: upgrade xterm.js to 5.x
```

**Scope prefixes we use:** `server`, `web`, `shared`, `e2e`, `docker`, `ci`

Examples: `feat(server): add role field to user schema`, `fix(web): prevent blank terminal on self-split`

## Pull Request Process

1. **Branch** — Create a feature branch from `main`: `feat/my-feature` or `fix/my-bugfix`
2. **Develop** — Make changes with corresponding tests
3. **Validate** — Run `pnpm lint && pnpm test` and ensure no failures
4. **Commit** — Use conventional commit messages (see above)
5. **Push** — Push to your fork and open a PR against `main`
6. **Review** — Address review feedback; keep PRs focused on a single concern

**CI checks that must pass:** lint → type-check → build → unit/integration tests → security audit

**PR checklist:**

- [ ] Tests pass locally (`pnpm test`)
- [ ] Lint passes (`pnpm lint`)
- [ ] New features include tests
- [ ] API changes update Swagger annotations
- [ ] No secrets or credentials committed

## Adding a CLI Adapter

Implement the `CLIAdapter` interface from `apps/server/src/adapters/base.ts`:

```typescript
import { CLIAdapter } from './base.js'

export class MyToolAdapter implements CLIAdapter {
  /** Command to start the interactive CLI process */
  startCommand = 'my-tool --interactive'

  /** Parse streaming output for real-time state detection */
  parseStreamData(text: string): StateCandidate | null {
    /* ... */
  }

  /** Parse full terminal snapshot for confirmation */
  parseScreenSnapshot(screen: string): AgentStatus | null {
    /* ... */
  }

  /** Define quick-action buttons shown in the mobile UI */
  getQuickActions(): QuickAction[] {
    /* ... */
  }

  /** Whether the tool supports structured JSON output */
  supportsStructuredOutput = false
}
```

Register in `apps/server/src/index.ts`:

```typescript
adapters.set('mytool', new MyToolAdapter())
```

Add tests in `apps/server/src/__tests__/` covering stream parsing and snapshot parsing with realistic output samples.

## Reporting Issues

When filing a bug report, please include:

1. **Reproduction steps** — Minimal steps to reproduce the issue
2. **Expected behavior** — What you expected to happen
3. **Actual behavior** — What actually happened (include screenshots if applicable)
4. **Environment** — OS, Node.js version, browser/device, deployment method (Docker/dev)
5. **Logs** — Relevant server logs and browser console output

Use [GitHub Issues](https://github.com/wait4xx/AI-CLI-Mobile/issues) with the appropriate template.

## License

By contributing to this project, you agree that your contributions will be licensed under the [MIT License](LICENSE).
