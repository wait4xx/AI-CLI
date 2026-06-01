#!/usr/bin/env bash
set -euo pipefail
# ──────────────────────────────────────────────────
# AI CLI — Development Environment Setup
# Usage: bash scripts/dev.sh
# ──────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
# shellcheck source=scripts/check-deps.sh
source "$SCRIPT_DIR/check-deps.sh"

cd "$PROJECT_DIR"

step "Setting up development environment..."

# ── .env ──
step "Configuring .env"
ENV_FILE="$PROJECT_DIR/.env"
if ensure_env_file "$ENV_FILE"; then
  JWT_SECRET="$(random_secret)"
  JWT_REFRESH="$(random_secret)"

  echo ""
  echo -e "  ${BOLD}JWT secrets generated automatically.${NC}"
  echo ""

  ADMIN_USER="$(prompt "Admin username" "admin" "ADMIN_USERNAME" "false")"
  ADMIN_PASS="$(prompt "Admin password (>=8 chars)" "$(openssl rand -base64 12 | tr -d '/+' | head -c 16)" "ADMIN_PASSWORD" "true")"
  PROJECT_ROOT="$(prompt "Project root directory (set / to access all files)" "$HOME" "PROJECT_ROOT" "false")"
  PORT="$(prompt "Server port" "18333" "PORT" "false")"

  cat > "$ENV_FILE" << ENVEOF
NODE_ENV=development
PORT=${PORT}
PROJECT_ROOT=${PROJECT_ROOT}
JWT_SECRET=${JWT_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH}
ADMIN_USERNAME=${ADMIN_USER}
ADMIN_PASSWORD=${ADMIN_PASS}
LOG_LEVEL=info
SHELL_CMD=bash
DATA_DIR=${PROJECT_DIR}/data
ENVEOF

  info ".env created at $ENV_FILE"
  echo -e "  ${BOLD}Admin credentials:${NC}"
  echo "    Username: $ADMIN_USER"
  echo "    Password: $ADMIN_PASS"
fi

# ── Install dependencies ──
step "Installing dependencies"
pnpm install

# ── Done ──
echo ""
echo -e "${GREEN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}${BOLD}  Development environment ready!${NC}"
echo -e "${GREEN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "  Start:  pnpm dev"
echo "  Access: http://localhost:5173"
echo ""
