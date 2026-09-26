#!/usr/bin/env bash
# Project      : SMRITI Retail OS
# Author       : Jawahar Ramkripal Mallah
# Email        : support@smritibooks.com
# Websites     : smritibooks.com | erpnbook.com | aitdl.com
# Version      : 3.16.0
# Created      : 2026-09-23
# Modified     : 2026-09-23
# Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
# License      : Proprietary Commercial Software
# Classification: Internal

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

echo -e "\n${YELLOW}[1/5] Pulling latest repository updates...${NC}"
git pull origin smritiNX || git pull || echo -e "  ${YELLOW}[WARNING] Git pull reported non-zero status. Proceeding with local code...${NC}"

echo -e "\n${YELLOW}[2/5] Rebuilding container images...${NC}"
docker compose build

echo -e "\n${YELLOW}[3/5] Restarting services with preserved volumes...${NC}"
docker compose up -d

echo -e "\n${YELLOW}[4/5] Applying Alembic database migrations...${NC}"
echo -e "  Control-plane (smritisys)..."
docker compose exec -T -e PYTHONPATH="" smriti-api alembic -x target=control -x db=smritisys upgrade head 2>&1 || true

echo -e "  Tenant database (smriti001)..."
docker compose exec -T smriti-db psql -U postgres -d postgres -t -c "SELECT 1 FROM pg_database WHERE datname = 'smriti001';" | grep -q 1 || \
    docker compose exec -T smriti-db psql -U postgres -d postgres -c "CREATE DATABASE smriti001;" 2>&1 || true
docker compose exec -T -e PYTHONPATH="" smriti-api alembic -x target=tenant -x db=smriti001 upgrade head 2>&1 || true

echo -e "  Syncing baseline users and customer registries..."
docker compose exec -T smriti-api python -m app.db.seed_baseline_users 2>&1 || true

echo -e "\n${YELLOW}[5/5] Running health verification...${NC}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "$SCRIPT_DIR/health.sh"

echo -e "${GREEN}=====================================================================${NC}"
echo -e "${GREEN} SMRITI Retail OS update completed successfully!${NC}"
echo -e "${GREEN}=====================================================================${NC}\n"
