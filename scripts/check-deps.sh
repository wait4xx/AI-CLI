#!/usr/bin/env bash
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

info()  { echo -e "${GREEN}[OK]${NC} $*"; }
warn()  { echo -e "${YELLOW}[MISSING]${NC} $*"; }
fail()  { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }
step() { echo -e "\n${BOLD}${CYAN}▸ $*${NC}"; }

check_version() {
  local name="$1" got="$2" want="$3"
  if [ "$(printf '%s\n' "$got" "$want" | sort -V | head -1)" = "$want" ]; then
    info "$name $got (>= $want)"
    return 0
  else
    fail "$name $got < $want, please upgrade"
  fi
}

install_prerequisites() {
  step "Checking prerequisites..."

  missing=0

  # ── Node.js ──
  if command -v node &>/dev/null; then
    node_ver=$(node -v | sed 's/^v//')
    check_version "Node.js" "$node_ver" "20.0.0" || missing=1
  else
    warn "Node.js not found"
    if command -v apt-get &>/dev/null; then
      echo "  Run: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs"
    elif command -v brew &>/dev/null; then
      echo "  Run: brew install node@20"
    else
      echo "  Visit: https://nodejs.org/"
    fi
    missing=1
  fi

  # ── pnpm ──
  if command -v pnpm &>/dev/null; then
    pnpm_ver=$(pnpm -v)
    check_version "pnpm" "$pnpm_ver" "8.0.0" || missing=1
  else
    warn "pnpm not found"
    echo "  Run: corepack enable && corepack prepare pnpm@8.15.4 --activate"
    missing=1
  fi

  # ── tmux ──
  if command -v tmux &>/dev/null; then
    tmux_ver=$(tmux -V | sed 's/tmux //')
    check_version "tmux" "$tmux_ver" "3.3" || missing=1
  else
    warn "tmux not found"
    if command -v apt-get &>/dev/null; then
      echo "  Run: sudo apt-get install -y tmux"
    elif command -v brew &>/dev/null; then
      echo "  Run: brew install tmux"
    fi
    missing=1
  fi

  if [ "$missing" -ne 0 ]; then
    fail "Install missing prerequisites above, then re-run this script."
  fi
}

random_secret() {
  openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | xxd -p | tr -d '\n'
}

prompt() {
  local desc="$1" default="$2" var="$3" required="$4"
  if [ "$required" = "true" ] && [ -z "$default" ]; then
    echo -n "  $desc: "
  else
    echo -n "  $desc [$default]: "
  fi
  local val
  read -r val
  val="${val:-$default}"
  echo "$val"
}

ensure_env_file() {
  local env_file="$1"
  if [ -f "$env_file" ]; then
    echo -e "${YELLOW}Found existing $env_file${NC}"
    echo -n "  Overwrite? [y/N]: "
    local overwrite
    read -r overwrite
    if [[ ! "$overwrite" =~ ^[Yy]$ ]]; then
      echo "  Keeping existing $env_file"
      return 1
    fi
  fi
  return 0
}
