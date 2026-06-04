#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  Mavericks Inventory — Dev Startup Script
#  Starts: Backend (8080) · Frontend (5173) · Agent (9090)
#  Usage:  bash start.sh   OR   chmod +x start.sh && ./start.sh
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors
R='\033[0;31m'   G='\033[0;32m'   Y='\033[1;33m'
B='\033[0;34m'   C='\033[0;36m'   W='\033[1;37m'   NC='\033[0m'

step() { echo -e "\n${C}▸ $*${NC}"; }
ok()   { echo -e "  ${G}✓ $*${NC}"; }
warn() { echo -e "  ${Y}⚠ $*${NC}"; }
err()  { echo -e "  ${R}✗ $*${NC}"; }

banner() {
  echo -e "${C}"
  echo "  ╔══════════════════════════════════════╗"
  echo "  ║     Mavericks Inventory System       ║"
  echo "  ╚══════════════════════════════════════╝"
  echo -e "${NC}"
}

# Kill all child processes on exit (Ctrl+C or error)
cleanup() {
  echo -e "\n${Y}Stopping all services...${NC}"
  kill $(jobs -p) 2>/dev/null || true
  wait 2>/dev/null || true
  echo -e "${G}All services stopped.${NC}"
}
trap cleanup EXIT INT TERM

banner

# ─── 1. Environment files ─────────────────────────────────────────────────────
step "Environment setup"
for svc in backend frontend agent; do
  dir="$SCRIPT_DIR/src/$svc"
  if [ ! -f "$dir/.env" ]; then
    if [ -f "$dir/.env.example" ]; then
      cp "$dir/.env.example" "$dir/.env"
      warn "src/$svc/.env created from .env.example — fill in your Azure credentials before running"
    else
      warn "No .env.example in src/$svc"
    fi
  else
    ok "src/$svc/.env found"
  fi
done

# ─── 2. Install dependencies ──────────────────────────────────────────────────
step "Checking dependencies"
for svc in backend frontend agent; do
  dir="$SCRIPT_DIR/src/$svc"
  if [ ! -d "$dir/node_modules" ]; then
    echo -e "  ${Y}Installing src/$svc (this may take a minute)...${NC}"
    (cd "$dir" && npm install --silent 2>&1)
    ok "src/$svc — installed"
  else
    ok "src/$svc — node_modules OK"
  fi
done

# ─── 3. Launch all services ───────────────────────────────────────────────────
step "Starting services"
echo -e "  ${W}Backend ${NC} → ${B}http://localhost:8080${NC}  (API)"
echo -e "  ${W}Frontend${NC} → ${B}http://localhost:5173${NC}  (UI)"
echo -e "  ${W}Agent   ${NC} → ${B}http://localhost:9090${NC}  (AI Agent)"
echo -e "\n  Press ${R}Ctrl+C${NC} to stop everything\n"
echo "────────────────────────────────────────────────────────────────────────"

prefix_lines() {
  local label="$1" color="$2"
  while IFS= read -r line; do
    printf "${color}%-10s${NC} %s\n" "$label" "$line"
  done
}

(cd "$SCRIPT_DIR/src/backend"  && npm run dev 2>&1 | prefix_lines "[backend]"  "$G") &
(cd "$SCRIPT_DIR/src/frontend" && npm run dev 2>&1 | prefix_lines "[frontend]" "$B") &
(cd "$SCRIPT_DIR/src/agent"    && npm run dev 2>&1 | prefix_lines "[agent]"    "$Y") &

# Wait for all background jobs
wait
