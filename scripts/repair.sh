#!/usr/bin/env bash
# Project      : SMRITI Retail OS
# Author       : Jawahar Ramkripal Mallah
# Email        : support@smritibooks.com
# Websites     : smritibooks.com | erpnbook.com | aitdl.com
# Version      : 3.16.0
# Created      : 2026-09-23
# Modified     : 2026-09-23
# Copyright    : © SMRITIBooks.com. All Rights Reserved.
# License      : Proprietary Commercial Software
# Classification: Internal

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${CYAN}=====================================================================${NC}"
echo -e "${GREEN} SMRITI Retail OS - Non-Destructive System Repair${NC}"
echo -e "${CYAN}=====================================================================${NC}"

echo -e "\n${YELLOW}[1/4] Restarting containers safely...${NC}"
docker compose restart || docker compose up -d

echo -e "\n${YELLOW}[2/4] Waiting for database readiness...${NC}"
for i in {1..20}; do
    STATUS=$(docker inspect smriti-db --format '{{.State.Health.Status}}' 2>/dev/null || true)
    if [ "$STATUS" = "healthy" ]; then
        echo -e "  ${GREEN}[OK] Database is healthy.${NC}"
        break
    fi
    sleep 2
done

echo -e "\n${YELLOW}[3/4] Re-verifying database migrations...${NC}"
docker compose exec -T -e PYTHONPATH="" smriti-api alembic -x target=control -x db=smritisys upgrade head 2>&1 || true

echo -e "\n${YELLOW}[4/4] Auditing service health...${NC}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "$SCRIPT_DIR/health.sh"

echo -e "${GREEN}=====================================================================${NC}"
echo -e "${GREEN} System repair sequence completed.${NC}"
echo -e "${GREEN}=====================================================================${NC}\n"
