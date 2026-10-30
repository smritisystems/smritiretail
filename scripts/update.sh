#!/usr/bin/env bash
# Project      : SMRITI Retail OS
# Author       : Jawahar Ramkripal Mallah
# Email        : support@smritibooks.com
# Websites     : smritibooks.com | erpnbook.com | aitdl.com
# Version      : 3.17.3
# Created      : 2026-09-23
# Modified     : 2026-10-27
# Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
# License      : Proprietary Commercial Software
# Classification: Internal
# Change       : UMGP-001 — Added mandatory preflight backup before migrations;
#                upgraded step count 5→6; replaced silent || true migration
#                failures with hard-fail + actionable recovery instructions.

set -e

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${CYAN}=====================================================================${NC}"
echo -e "${GREEN} SMRITI Retail OS - Non-Destructive System Update${NC}"
echo -e "${CYAN}=====================================================================${NC}"

# Ensure execution from repository root
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"
echo -e "  Working Directory: ${REPO_ROOT}"

# --- Step 1: Git Pull ---
echo -e "\n${YELLOW}[1/6] Pulling latest repository updates...${NC}"
git pull origin smritiNX || git pull || echo -e "  ${YELLOW}[WARNING] Git pull reported non-zero status. Proceeding with local code...${NC}"

# --- Step 2: Preflight Backup (UMGP-001 Mandatory) ---
echo -e "\n${YELLOW}[2/6] Pre-Migration Backup (mandatory — UMGP-001)...${NC}"
# Creates verified pg_dump snapshots with SHA-256 manifest BEFORE any
# schema changes or container restarts. Failure here aborts the entire update.
PYTHON_BIN="${REPO_ROOT}/.venv/bin/python"
if [ ! -f "$PYTHON_BIN" ]; then PYTHON_BIN="python3"; fi
if "$PYTHON_BIN" scripts/auto_migrate.py --backup-only; then
    echo -e "  ${GREEN}[OK] Pre-migration backup completed.${NC}"
    echo -e "  ${GREEN}      Snapshot: backend/backups/pre_migration/${NC}"
else
    echo -e "  ${RED}[FAIL] Pre-migration backup failed. Update ABORTED to protect data.${NC}"
    echo -e "  ${YELLOW}  Recovery:${NC}"
    echo -e "  ${YELLOW}    1. Verify PostgreSQL reachable: check .env POSTGRES_HOST/PORT${NC}"
    echo -e "  ${YELLOW}    2. Re-run once DB is accessible: ./scripts/update.sh${NC}"
    exit 1
fi

# --- Step 3: Docker Build ---
echo -e "\n${YELLOW}[3/6] Rebuilding container images...${NC}"
docker compose build

# --- Step 4: Service Restart ---
echo -e "\n${YELLOW}[4/6] Restarting services with preserved volumes...${NC}"
docker compose up -d

# --- Step 5: Database Migration via Bootstrap Engine ---
echo -e "\n${YELLOW}[5/6] Applying database migrations (bootstrap engine)...${NC}"
# bootstrap_engine.py is the canonical migration orchestrator:
# - Runs Alembic to head on smritisys (control plane)
# - Discovers all tenant DBs from company_database_registries
# - Creates missing tenant DBs and migrates them to head
# - Applies baseline data seeds idempotently
if ! docker compose exec -T smriti-api python -m app.db.bootstrap_engine; then
    echo -e "  ${RED}[FAIL] Database bootstrap/migration failed. Services are running on pre-migration code.${NC}"
    echo -e "  ${YELLOW}  Recovery options:${NC}"
    echo -e "  ${YELLOW}    1. View logs    : docker compose logs smriti-api${NC}"
    echo -e "  ${YELLOW}    2. Verify only  : ${PYTHON_BIN} scripts/auto_migrate.py --verify-only${NC}"
    echo -e "  ${YELLOW}    3. Auto rollback: ${PYTHON_BIN} scripts/auto_migrate.py --auto-rollback${NC}"
    echo -e "  ${YELLOW}    4. Manual restore: see backend/backups/pre_migration/ for dump paths${NC}"
    exit 1
fi

# --- Step 6: Health Verification ---
echo -e "\n${YELLOW}[6/6] Running health verification...${NC}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "$SCRIPT_DIR/health.sh"

echo -e "${GREEN}=====================================================================${NC}"
echo -e "${GREEN} SMRITI Retail OS update completed successfully!${NC}"
echo -e "${GREEN}=====================================================================${NC}\n"
