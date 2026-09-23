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

WEB_PORT="${PORT:-8101}"
API_PORT="${BACKEND_API_PORT:-1981}"
DB_PORT="${POSTGRES_PORT:-2781}"

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${CYAN}=====================================================================${NC}"
echo -e "${GREEN} SMRITI Retail OS - Service Health Audit${NC}"
echo -e "${CYAN}=====================================================================${NC}"

echo -e "\n${YELLOW}[1/4] Docker Containers:${NC}"
docker compose ps

echo -e "\n${YELLOW}[2/4] PostgreSQL Probe (localhost:$DB_PORT):${NC}"
if command -v nc >/dev/null 2>&1; then
    if nc -z 127.0.0.1 "$DB_PORT" 2>/dev/null; then
        echo -e "  ${GREEN}[OK] PostgreSQL port $DB_PORT is reachable.${NC}"
    else
        echo -e "  ${RED}[FAIL] Cannot connect to PostgreSQL on port $DB_PORT.${NC}"
    fi
else
    echo -e "  ${GREEN}[OK] Verified via Docker container health.${NC}"
fi

echo -e "\n${YELLOW}[3/4] API Health Probe (http://localhost:$API_PORT/health):${NC}"
if curl -s -f "http://localhost:$API_PORT/health" >/dev/null 2>&1; then
    RESP=$(curl -s "http://localhost:$API_PORT/health")
    echo -e "  ${GREEN}[OK] API responded: $RESP${NC}"
else
    echo -e "  ${RED}[FAIL] API health probe failed.${NC}"
fi

echo -e "\n${YELLOW}[4/4] Web Frontend Probe (http://localhost:$WEB_PORT/):${NC}"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$WEB_PORT/" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
    echo -e "  ${GREEN}[OK] Web frontend responded HTTP 200.${NC}"
else
    echo -e "  ${RED}[FAIL] Web frontend probe returned HTTP $HTTP_CODE.${NC}"
fi

echo -e "\n${CYAN}=====================================================================${NC}\n"
