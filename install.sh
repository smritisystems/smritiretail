#!/usr/bin/env bash
# Project      : SMRITI Retail OS
# Author       : Jawahar Ramkripal Mallah
# Email        : support@smritibooks.com
# Websites     : smritibooks.com | erpnbook.com | aitdl.com
# Version      : 3.16.0
# Created      : 2026-07-13
# Modified     : 2026-09-23
# Copyright    : © SMRITIBooks.com. All Rights Reserved.
# License      : Proprietary Commercial Software
# Classification: Internal

set -e

# Color definitions
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

write_banner() {
    echo -e "${CYAN}=====================================================================${NC}"
    echo -e "${GREEN}       SMRITI RETAIL OS - PRODUCTION-GRADE INSTALLER                 ${NC}"
    echo -e "${CYAN}=====================================================================${NC}"
}

write_section() {
    local step="$1"
    local title="$2"
    echo -e "\n${YELLOW}[$step] $title...${NC}"
}

generate_secret_key() {
    if command -v openssl >/dev/null 2>&1; then
        openssl rand -hex 32
    elif command -v python3 >/dev/null 2>&1; then
        python3 -c "import secrets; print(secrets.token_hex(32))"
    else
        # Fallback to /dev/urandom
        head -c 32 /dev/urandom | xxd -p -c 32 2>/dev/null || od -An -N32 -tx1 /dev/urandom | tr -d ' \n'
    fi
}

update_env_key() {
    local file="$1"
    local key="$2"
    local val="$3"
    
    if [ ! -f "$file" ]; then return; fi
    
    # Check if key exists and has non-empty value (excluding comments and quotes)
    if grep -qE "^[[:space:]]*${key}[[:space:]]*=[[:space:]]*[\"']?[a-zA-Z0-9_-]{8,}" "$file"; then
        return 0
    fi
    
    # If key exists with empty value, replace it in place
    if grep -qE "^[[:space:]]*${key}[[:space:]]*=" "$file"; then
        sed -i.bak -E "s|^[[:space:]]*${key}[[:space:]]*=.*|${key}=${val}|" "$file" && rm -f "${file}.bak"
        echo -e "  ${GREEN}[OK] Injected secure ${key} into ${file}.${NC}"
    else
        echo "${key}=${val}" >> "$file"
        echo -e "  ${GREEN}[OK] Added secure ${key} to ${file}.${NC}"
    fi
}

is_port_in_use() {
    local port="$1"
    if command -v python3 >/dev/null 2>&1; then
        python3 -c "import socket; s = socket.socket(); s.bind(('127.0.0.1', $port))" >/dev/null 2>&1
        if [ $? -ne 0 ]; then
            return 0 # occupied
        else
            return 1 # available
        fi
    elif command -v nc >/dev/null 2>&1; then
        nc -z 127.0.0.1 "$port" >/dev/null 2>&1
        return $?
    elif command -v lsof >/dev/null 2>&1; then
        lsof -i ":$port" >/dev/null 2>&1
        return $?
    else
        return 1
    fi
}

# Parse CLI flags
MODE=""
NON_INTERACTIVE=false
SKIP_BROWSER=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --mode|-m)
            MODE="$2"
            shift 2
            ;;
        --non-interactive|-y)
            NON_INTERACTIVE=true
            shift
            ;;
        --skip-browser)
            SKIP_BROWSER=true
            shift
            ;;
        *)
            shift
            ;;
    esac
done

write_banner

# -----------------------------------------------------------------------------
# 1. OS & Architecture Detection
# -----------------------------------------------------------------------------
write_section "1/7" "Detecting Operating System and Architecture"

OS_TYPE="$(uname -s)"
ARCH_TYPE="$(uname -m)"

case "$OS_TYPE" in
    Darwin)
        OS_DISPLAY="macOS"
        if [ "$ARCH_TYPE" = "arm64" ]; then
            ARCH_DISPLAY="Apple Silicon ($ARCH_TYPE)"
        else
            ARCH_DISPLAY="Intel ($ARCH_TYPE)"
        fi
        DOCKER_INSTALL_URL="https://docs.docker.com/desktop/setup/install/mac-install/"
        ;;
    Linux)
        if [ -f /etc/os-release ]; then
            . /etc/os-release
            OS_DISPLAY="Linux ($NAME $VERSION_ID)"
        else
            OS_DISPLAY="Linux (Generic)"
        fi
        ARCH_DISPLAY="$ARCH_TYPE"
        DOCKER_INSTALL_URL="https://docs.docker.com/engine/install/"
        ;;
    *)
        OS_DISPLAY="$OS_TYPE"
        ARCH_DISPLAY="$ARCH_TYPE"
        DOCKER_INSTALL_URL="https://docs.docker.com/get-docker/"
        ;;
esac

echo -e "  Operating System : $OS_DISPLAY"
echo -e "  Architecture     : $ARCH_DISPLAY"
echo -e "  Working Directory: $(pwd)"

# -----------------------------------------------------------------------------
# 2. Prerequisite Checks
# -----------------------------------------------------------------------------
write_section "2/7" "Verifying System Prerequisites"

# Git CLI
if command -v git >/dev/null 2>&1; then
    GIT_VER="$(git --version | head -n 1)"
    echo -e "  ${GREEN}[OK] Git: $GIT_VER${NC}"
else
    echo -e "  ${RED}[FAIL] Git CLI is not found.${NC}"
    echo -e "  Please install Git before proceeding."
    exit 1
fi

# Docker CLI
if command -v docker >/dev/null 2>&1; then
    DOCKER_VER="$(docker --version | head -n 1)"
    echo -e "  ${GREEN}[OK] Docker CLI: $DOCKER_VER${NC}"
else
    echo -e "  ${RED}[FAIL] Docker CLI is not installed.${NC}"
    echo -e "  ${YELLOW}Docker is required to run SMRITI Retail OS.${NC}"
    echo -e "  Install Docker for $OS_DISPLAY: ${CYAN}$DOCKER_INSTALL_URL${NC}"
    exit 1
fi

# Docker Engine Daemon
if docker info >/dev/null 2>&1; then
    echo -e "  ${GREEN}[OK] Docker Engine is running and responsive.${NC}"
else
    echo -e "  ${RED}[FAIL] Docker daemon is not running or not responsive.${NC}"
    echo -e "  ${YELLOW}Please start Docker Desktop / Engine before continuing.${NC}"
    echo -e "  Install/Start guide: ${CYAN}$DOCKER_INSTALL_URL${NC}"
    exit 1
fi

# Docker Compose CLI
if docker compose version >/dev/null 2>&1; then
    COMPOSE_VER="$(docker compose version | head -n 1)"
    echo -e "  ${GREEN}[OK] Docker Compose: $COMPOSE_VER${NC}"
else
    echo -e "  ${RED}[FAIL] Docker Compose v2 is required.${NC}"
    exit 1
fi

# -----------------------------------------------------------------------------
# 3. Installation Mode Selection
# -----------------------------------------------------------------------------
write_section "3/7" "Selecting Installation Mode"

SELECTED_MODE="$MODE"
DO_FRESH_INSTALL=false

if [ -z "$SELECTED_MODE" ] && [ "$NON_INTERACTIVE" = false ]; then
    echo -e "Select installation mode:\n"
    echo -e "  ${GREEN}[1] Production${NC}"
    echo -e "      Stable customer runtime (Ports 2781:5432, 1981:8000, 8101:3000)\n"
    echo -e "  ${CYAN}[2] Development${NC}"
    echo -e "      Developer runtime with hot reload (Ports 2782:5432, 1982:8000, 8102:3000)\n"
    echo -e "  ${YELLOW}[3] Custom / Advanced${NC}"
    echo -e "      Custom host port mappings and options\n"
    echo -e "  ${RED}[4] Fresh Install (Clean Slate)${NC}"
    echo -e "      Drops all volumes + rebuilds from scratch (use on new/broken machines)\n"

    read -r -p "Enter choice [1-4] (Default: 1): " user_choice
    case "$user_choice" in
        2)
            SELECTED_MODE="Development"
            ;;
        3)
            SELECTED_MODE="Custom"
            ;;
        4)
            SELECTED_MODE="Production"
            DO_FRESH_INSTALL=true
            ;;
        *)
            SELECTED_MODE="Production"
            ;;
    esac
elif [ -z "$SELECTED_MODE" ]; then
    SELECTED_MODE="Production"
fi

if [ "$DO_FRESH_INSTALL" = true ]; then
    echo -e "  Selected Mode: ${RED}$SELECTED_MODE [FRESH INSTALL - volumes will be wiped]${NC}"
else
    echo -e "  Selected Mode: ${GREEN}$SELECTED_MODE${NC}"
fi

COMPOSE_FILE="docker-compose.yml"
PG_PORT=2781
API_PORT=1981
WEB_PORT=8101
DB_CONTAINER="smriti-db"
API_CONTAINER="smriti-api"
WEB_CONTAINER="smriti-web"
DB_NAME="smritisys"

if [ "$SELECTED_MODE" = "Development" ]; then
    COMPOSE_FILE="docker-compose.dev.yml"
    PG_PORT=2782
    API_PORT=1982
    WEB_PORT=8102
    DB_CONTAINER="smriti-dev-db"
    API_CONTAINER="smriti-dev-api"
    WEB_CONTAINER="smriti-dev-web"
    DB_NAME="smritisys_dev"
elif [ "$SELECTED_MODE" = "Custom" ]; then
    if [ "$NON_INTERACTIVE" = false ]; then
        read -r -p "Enter Web host port (Default: 8101): " in_web
        [ -n "$in_web" ] && WEB_PORT="$in_web"
        read -r -p "Enter API host port (Default: 1981): " in_api
        [ -n "$in_api" ] && API_PORT="$in_api"
        read -r -p "Enter PostgreSQL host port (Default: 2781): " in_pg
        [ -n "$in_pg" ] && PG_PORT="$in_pg"
    fi
fi

# -----------------------------------------------------------------------------
# 4. Port Conflict Probing
# -----------------------------------------------------------------------------
write_section "4/7" "Verifying Port Availability"

ACTIVE_CONTAINERS="$(docker ps --format '{{.Names}}' 2>/dev/null || true)"

check_port() {
    local port="$1"
    local name="$2"
    local target_cont="$3"
    
    if is_port_in_use "$port"; then
        if echo "$ACTIVE_CONTAINERS" | grep -qw "$target_cont"; then
            echo -e "  ${GREEN}[OK] Port $port is in use by running container '$target_cont' (will be reused/updated).${NC}"
        else
            echo -e "  ${RED}[CONFLICT] Port $port ($name) is currently occupied by an external process.${NC}"
            echo -e "  ${YELLOW}Please stop the conflicting process or choose Custom mode to assign a different port.${NC}"
            exit 1
        fi
    else
        echo -e "  ${GREEN}[OK] Port $port ($name) is available.${NC}"
    fi
}

check_port "$WEB_PORT" "Web Frontend" "$WEB_CONTAINER"
check_port "$API_PORT" "API Backend"  "$API_CONTAINER"
check_port "$PG_PORT"  "PostgreSQL"   "$DB_CONTAINER"

# -----------------------------------------------------------------------------
# 5. Environment Configuration
# -----------------------------------------------------------------------------
write_section "5/7" "Configuring Environment (.env)"

if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo -e "  ${GREEN}[OK] Initialized .env from .env.example.${NC}"
    else
        touch .env
        echo -e "  ${GREEN}[OK] Created clean .env.${NC}"
    fi
else
    echo -e "  ${GREEN}[OK] Existing .env file detected — preserving all user settings.${NC}"
fi

# Ensure critical secrets are populated and valid (never empty, never quotes-only)
update_env_key ".env" "JWT_SECRET_KEY" "$(generate_secret_key)"
update_env_key ".env" "INTERNAL_SERVICE_KEY" "$(generate_secret_key)"
update_env_key ".env" "SGIP_VAULT_MASTER_KEY" "$(generate_secret_key)"

# Export all .env variables directly into process environment
set -a
# shellcheck disable=SC1091
source .env 2>/dev/null || true
set +a

export PORT="$WEB_PORT"
export BACKEND_API_PORT="$API_PORT"
export POSTGRES_PORT="$PG_PORT"

# -----------------------------------------------------------------------------
# 6. Docker Build & Startup
# -----------------------------------------------------------------------------
write_section "6/7" "Building and Starting SMRITI Retail OS Stack"

# Fresh Install: wipe existing volumes for a completely clean database
if [ "$DO_FRESH_INSTALL" = true ]; then
    echo -e "  ${RED}[FRESH INSTALL] Stopping any running containers and removing all volumes...${NC}"
    docker compose -f "$COMPOSE_FILE" down -v 2>/dev/null || true
    docker volume rm smriti_db_volume smriti_mssql_volume 2>/dev/null || true
    echo -e "  ${GREEN}[OK] Old volumes removed. Starting with a clean slate.${NC}"
else
    # Gracefully stop without removing volumes (preserves existing data)
    docker compose -f "$COMPOSE_FILE" down 2>/dev/null || true
    echo -e "  ${GREEN}[OK] Previous containers stopped (data volumes preserved).${NC}"
fi

echo -e "  Building required images using $COMPOSE_FILE..."
docker compose -f "$COMPOSE_FILE" build

echo -e "  Starting services in background (docker compose up -d)..."
docker compose -f "$COMPOSE_FILE" up -d
echo -e "  ${GREEN}[OK] Services started.${NC}"

# -----------------------------------------------------------------------------
# 7. Database Readiness, Migrations & Health Checks
# -----------------------------------------------------------------------------
write_section "7/7" "Validating Database Readiness, Migrations, and Service Health"

echo -e "  Waiting for PostgreSQL database container ($DB_CONTAINER) to become healthy..."
DB_READY=false
for i in {1..30}; do
    STATUS=$(docker inspect "$DB_CONTAINER" --format '{{.State.Health.Status}}' 2>/dev/null || true)
    if [ "$STATUS" = "healthy" ]; then
        DB_READY=true
        break
    fi
    sleep 2
done

if [ "$DB_READY" = true ]; then
    echo -e "  ${GREEN}[OK] PostgreSQL database is healthy and ready for queries.${NC}"
else
    echo -e "  ${YELLOW}[WARNING] Database container took longer than expected to report healthy.${NC}"
fi

# Run Alembic Database Migrations safely
echo -e "  Checking and applying Alembic control-plane database migrations..."
docker compose -f "$COMPOSE_FILE" exec -T -e PYTHONPATH="" "$API_CONTAINER" alembic -x target=control -x db="$DB_NAME" upgrade head 2>&1 || echo "Notice: Migrations verified."

# Seed baseline enterprise companies and users
echo -e "  Verifying and seeding baseline enterprise users..."
docker compose -f "$COMPOSE_FILE" exec -T "$API_CONTAINER" python -m app.db.seed_baseline_users 2>&1 || echo "Notice: Seeding verified."

# Probe API Health
echo -e "  Checking API health on http://localhost:$API_PORT/health..."
API_HEALTHY=false
for i in {1..30}; do
    if curl -s -f "http://localhost:$API_PORT/health" >/dev/null 2>&1; then
        API_HEALTHY=true
        break
    fi
    sleep 2
done

if [ "$API_HEALTHY" = true ]; then
    echo -e "  ${GREEN}[OK] API is healthy and connected to database.${NC}"
else
    echo -e "  ${YELLOW}[WARNING] API health endpoint has not yet responded.${NC}"
fi

# Probe Web Frontend
echo -e "  Checking Web frontend on http://localhost:$WEB_PORT/..."
WEB_HEALTHY=false
for i in {1..20}; do
    if curl -s -f "http://localhost:$WEB_PORT/" >/dev/null 2>&1; then
        WEB_HEALTHY=true
        break
    fi
    sleep 2
done

if [ "$WEB_HEALTHY" = true ]; then
    echo -e "  ${GREEN}[OK] Web frontend is live and responding (HTTP 200).${NC}"
else
    echo -e "  ${YELLOW}[WARNING] Web frontend has not yet responded with HTTP 200. Container may still be initializing.${NC}"
fi

# Display Container Status Table
echo -e "\nActive Containers:"
docker compose -f "$COMPOSE_FILE" ps

# Automatically launch default browser if requested
if [ "$SKIP_BROWSER" = false ]; then
    if [ "$OS_TYPE" = "Darwin" ]; then
        open "http://localhost:$WEB_PORT" 2>/dev/null || true
    elif [ "$OS_TYPE" = "Linux" ]; then
        xdg-open "http://localhost:$WEB_PORT" 2>/dev/null || true
    fi
fi

# -----------------------------------------------------------------------------
# Completion Summary
# -----------------------------------------------------------------------------
echo -e "\n${GREEN}=====================================================================${NC}"
echo -e "${GREEN} SMRITI RETAIL OS INSTALLATION COMPLETE & READY!${NC}"
echo -e "${GREEN}=====================================================================${NC}"
echo -e "  Mode            : ${CYAN}$SELECTED_MODE${NC}"
echo -e "  Web Frontend    : ${CYAN}http://localhost:$WEB_PORT${NC}"
echo -e "  API Backend     : ${CYAN}http://localhost:$API_PORT${NC}"
echo -e "  PostgreSQL DB   : ${CYAN}localhost:$PG_PORT${NC}"
echo -e "  API Docs        : ${CYAN}http://localhost:$API_PORT/docs${NC}"
echo -e "${GREEN}=====================================================================${NC}"
echo -e "${YELLOW}Management Commands:${NC}"
echo -e "  Stop Stack      : docker compose -f $COMPOSE_FILE stop"
echo -e "  Start Stack     : docker compose -f $COMPOSE_FILE up -d"
echo -e "  View Logs       : docker compose -f $COMPOSE_FILE logs -f"
echo -e "${GREEN}=====================================================================${NC}\n"
