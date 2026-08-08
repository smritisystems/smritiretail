#!/bin/bash
# Author & Creator:
# Jawahar Ramkripal Mallah
#
# Founder:
# SmritiSys
# AITDL Networks
#
# Role:
# Chief Systems Architect
#
# Web:
# smritisys.com | smritibooks.com | aitdl.com
#
# Email:
# jawahar.mallah@gmail.com
#
# Copyright © 2026 SmritiSys.
# All Rights Reserved.

# Project      : SMRITI Retail OS
# Organization : SmritiSys
# Author       : Jawahar Ramkripal Mallah
# Copyright    : © SMRITIBooks.com. All Rights Reserved.
# Zero-Downtime Production Deployment & Health Check Script

set -e

echo "=== SMRITI Retail OS Zero-Downtime Production Deployment ==="
echo "1. Pulling latest release artifacts..."
git pull origin smritiNX

echo "2. Building & starting Docker Compose Production Stack..."
docker-compose -f docker-compose.prod.yml up -d --build --remove-orphans

echo "3. Running database migrations..."
docker exec smriti-api-prod alembic upgrade head

echo "4. Executing health audit script..."
python scripts/health_check.py

echo "=== PRODUCTION DEPLOYMENT COMPLETE & HEALTHY ==="
