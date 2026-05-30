# Contributing to AI-CLI-Mobile

Thank you for your interest in contributing! This guide will help you get started.

## Development Setup

**Prerequisites:** Node.js 20+, pnpm 8+, tmux 3.3+

```bash
git clone https://github.com/wait4xx/AI-CLI-Mobile.git
cd AI-CLI-Mobile
pnpm install
cp .env.example .env
# Edit .env — set JWT_SECRET (≥32 chars), JWT_REFRESH_SECRET (≥32 chars), ADMIN_PASSWORD (≥8 chars)
pnpm dev
```

## Project Structure

This is a pnpm monorepo with Turborepo:

- `apps/server/` — Fastify backend (WebSocket gateway, session management, CLI adapters)
- `apps/web/` — React frontend (xterm.js terminal, file explorer, mobile-optimized UI)
- `packages/shared/` — Shared protocol types and constants
- `packages/config/` — Shared ESLint, Prettier, TypeScript configs
- `e2e/` — Playwright end-to-end tests

## Development Workflow

1. Create a feature branch from `main`
2. Make your changes
3. Ensure tests pass: `pnpm test`
4. Run linting: `pnpm lint`
5. Format code: `pnpm format`
6. Submit a pull request

## Code Style

Code style is enforced via shared configs in `packages/config/`:

- **TypeScript** — Strict mode, no `any` without explicit annotation
- **ESLint** — Run `pnpm lint` before committing
- **Prettier** — Run `pnpm format` to auto-format
- **Pre-commit hooks** — Husky + lint-staged auto-runs ESLint and Prettier on staged files

## Testing

```bash
# All unit/integration tests
pnpm test

# Single package
cd apps/server && pnpm test
cd apps/web && pnpm test
cd packages/shared && pnpm test

# E2E tests (requires running server)
pnpm e2e
```

When adding new features, please include corresponding tests.

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

## Pull Request Guidelines

- Keep PRs focused on a single concern
- Include tests for new functionality
- Update documentation (README, Swagger annotations) when changing APIs
- Ensure CI passes (lint → build → test → audit)

## Reporting Issues

- Use [GitHub Issues](https://github.com/wait4xx/AI-CLI-Mobile/issues)
- Include reproduction steps, expected behavior, and actual behavior
- Mention your environment (OS, Node.js version, browser)

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
