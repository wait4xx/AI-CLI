#!/usr/bin/env bash
set -euo pipefail
# ──────────────────────────────────────────────────
# AI CLI — Production Environment Setup
# Usage: sudo bash scripts/prod.sh [install-dir]
#   install-dir defaults to /opt/ai-cli
# ──────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
# shellcheck source=scripts/check-deps.sh
source "$SCRIPT_DIR/check-deps.sh"

INSTALL_DIR="${1:-/opt/ai-cli}"

if [ "$(id -u)" -ne 0 ]; then
  fail "Production setup requires root. Run: sudo bash scripts/prod.sh [install-dir]"
fi

cd "$PROJECT_DIR"

step "Setting up production environment..."
echo -e "  Install directory: ${BOLD}${INSTALL_DIR}${NC}"

# ── Copy project files ──
step "Copying project files to $INSTALL_DIR"
mkdir -p "$INSTALL_DIR"
cp -r "$PROJECT_DIR"/* "$INSTALL_DIR/" 2>/dev/null || true
cp "$PROJECT_DIR/.env.example" "$INSTALL_DIR/.env.example" 2>/dev/null || true
cp "$PROJECT_DIR/.gitignore" "$INSTALL_DIR/.gitignore" 2>/dev/null || true
cp "$PROJECT_DIR/package.json" "$INSTALL_DIR/" 2>/dev/null || true
cp "$PROJECT_DIR/pnpm-lock.yaml" "$INSTALL_DIR/" 2>/dev/null || true
cp "$PROJECT_DIR/pnpm-workspace.yaml" "$INSTALL_DIR/" 2>/dev/null || true
cp "$PROJECT_DIR/turbo.json" "$INSTALL_DIR/" 2>/dev/null || true
info "Project files copied"

# ── .env ──
step "Configuring .env"
ENV_FILE="$INSTALL_DIR/.env"
if ensure_env_file "$ENV_FILE"; then
  JWT_SECRET="$(random_secret)"
  JWT_REFRESH="$(random_secret)"

  echo ""
  echo -e "  ${BOLD}JWT secrets generated automatically (strong random).${NC}"
  echo ""

  PORT="$(prompt "Server port" "18333" "PORT" "false")"
  PROJECT_ROOT="$(prompt "Project root directory (set / to access all files)" "/workspace" "PROJECT_ROOT" "false")"
  ADMIN_USER="$(prompt "Admin username" "admin" "ADMIN_USERNAME" "false")"
  ADMIN_PASS="$(prompt "Admin password (>=8 chars)" "" "ADMIN_PASSWORD" "true")"
  LOG_LEVEL="$(prompt "Log level (info/warn/error)" "warn" "LOG_LEVEL" "false")"

  mkdir -p "$PROJECT_ROOT"
  RUN_USER="$(logname 2>/dev/null || echo 'nobody')"
  RUN_GROUP="$(id -gn "$RUN_USER" 2>/dev/null || echo "$RUN_USER")"
  chown -R "$RUN_USER:$RUN_GROUP" "$PROJECT_ROOT" 2>/dev/null || true

  cat > "$ENV_FILE" << ENVEOF
NODE_ENV=production
PORT=${PORT}
PROJECT_ROOT=${PROJECT_ROOT}
JWT_SECRET=${JWT_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH}
ADMIN_USERNAME=${ADMIN_USER}
ADMIN_PASSWORD=${ADMIN_PASS}
LOG_LEVEL=${LOG_LEVEL}
SHELL_CMD=bash
DATA_DIR=${INSTALL_DIR}/data
ENVEOF

  info ".env created at $ENV_FILE"
  echo -e "  ${BOLD}Admin credentials (save these!):${NC}"
  echo "    Username: $ADMIN_USER"
  echo "    Password: $ADMIN_PASS"
fi

# ── Install dependencies & build ──
step "Installing dependencies"
cd "$INSTALL_DIR"
pnpm install --frozen-lockfile 2>/dev/null || pnpm install

step "Building project"
pnpm build
info "Build complete"

# ── systemd service ──
step "Setting up systemd service"
SERVICE_FILE="/etc/systemd/system/ai-cli.service"
RUN_USER="$(logname 2>/dev/null || echo 'root')"

cat > "$SERVICE_FILE" << EOF
[Unit]
Description=AI CLI Mobile
After=network.target

[Service]
Type=simple
WorkingDirectory=${INSTALL_DIR}
ExecStart=$(which node) ${INSTALL_DIR}/apps/server/dist/index.js
EnvironmentFile=${INSTALL_DIR}/.env
Restart=on-failure
RestartSec=5
User=${RUN_USER}

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable ai-cli > /dev/null 2>&1

echo -n "  Start the service now? [Y/n]: "
read -r start_now
if [[ ! "$start_now" =~ ^[Nn]$ ]]; then
  systemctl start ai-cli
  sleep 1
  if systemctl is-active --quiet ai-cli; then
    info "Service started successfully"
  else
    fail "Service failed to start. Check: journalctl -u ai-cli -n 20"
  fi
fi

# ── Done ──
echo ""
echo -e "${GREEN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}${BOLD}  Production environment ready!${NC}"
echo -e "${GREEN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "  Install dir:  $INSTALL_DIR"
echo "  Config file:  $INSTALL_DIR/.env"
echo "  Service file: $SERVICE_FILE"
echo "  Access:       http://<server-ip>:$(grep '^PORT=' "$ENV_FILE" | cut -d= -f2)"
echo ""
echo "  Commands:"
echo "    sudo systemctl status ai-cli    # Check status"
echo "    sudo systemctl restart ai-cli   # Restart"
echo "    sudo journalctl -u ai-cli -f    # View logs"
echo ""
echo -e "  ${YELLOW}Tip: Place a reverse proxy (nginx) with TLS in front for production HTTPS.${NC}"
echo ""
