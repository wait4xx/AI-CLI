# ============================================================
# Stage 1: deps — install all dependencies (including devDependencies)
# ============================================================
FROM node:22-bookworm-slim AS deps

RUN corepack enable && corepack prepare pnpm@8.15.4 --activate

# node-pty native addon requires build tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential python3 git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY packages/ packages/
COPY apps/ apps/

RUN pnpm install --frozen-lockfile

# ============================================================
# Stage 2: build — compile TypeScript
# ============================================================
FROM deps AS build

RUN pnpm build

# ============================================================
# Stage 2b: prod-deps — prune devDependencies after build
# ============================================================
FROM build AS prod-deps

RUN pnpm prune --prod

# ============================================================
# Stage 3: runtime — minimal production image
# ============================================================
FROM node:22-bookworm-slim AS runtime

# tini: PID 1 init (signal forwarding + zombie reaping, ADR-009)
# tmux: terminal session persistence (>=3.3a)
# python3: CLI tool runtime dependency (ADR-013)
# ca-certificates: TLS certificate bundle
# Purge compilers and pip to prevent build-based attacks
RUN apt-get update && apt-get install -y --no-install-recommends \
    tini tmux python3 ca-certificates \
    && apt-get purge -y gcc g++ make \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/* \
    && rm -f /usr/bin/pip* /usr/bin/pip3* /usr/local/bin/pip*

# Non-root user
RUN groupadd -r appuser && useradd -r -g appuser -d /app -s /sbin/nologin appuser

WORKDIR /app

# Copy built artifacts from build stage
COPY --from=build /app/apps/server/dist ./apps/server/dist
COPY --from=build /app/apps/web/dist ./apps/web/dist
COPY --from=build /app/apps/server/package.json ./apps/server/
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/shared/package.json ./packages/shared/

# Copy production node_modules from prod-deps stage (pruned, no devDeps)
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/apps/server/node_modules ./apps/server/node_modules
COPY --from=prod-deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=prod-deps /app/packages/shared/node_modules ./packages/shared/node_modules

# Create workspace directory with correct ownership
RUN mkdir -p /workspace && chown -R appuser:appuser /app /workspace

USER appuser

EXPOSE 18333

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "fetch('http://localhost:18333/api/auth/login').then(r => r.status === 400 || r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "apps/server/dist/index.js"]
