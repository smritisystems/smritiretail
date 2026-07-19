<!--
  Project         : SMRITI Retail OS
  Organization    : SmritiSys

  Founders
  • Pushpa Devi Jawahar Mallah
    Founder & Chairperson

  • Jawahar Ramkripal Mallah
    Founder, Chief Executive Officer (CEO) &
    Chief Systems Architect

  Email           : support@smritisys.com
  Website         : https://smritisys.com
  Other Domains   : smritibooks.com | erpnbook.com | aitdl.com

  Version         : 3.32.0
  Created         : 2026-07-19
  Modified         : 2026-07-19

  Copyright       : © SmritiSys. All Rights Reserved.
  License         : Proprietary Commercial Software
  Classification  : Internal
-->

# SMRITI Retail OS Deployment Guide

This document describes the staging and production deployment procedures for SMRITI Retail OS.

---

## 1. Production Docker Infrastructure

SMRITI utilizes Docker containerization for stable deployment clusters:
* **Frontend Container:** Serves the built SPA static files via Nginx/Caddy.
* **Backend Container:** Serves the FastAPI server via Gunicorn (running Uvicorn worker classes).
* **Database Container:** Runs PostgreSQL 16.

### Run Production Compose
Ensure all credentials are set in a secure `.env` file before executing:

```bash
docker compose -f docker-compose.prod.yml up -d
```

---

## 2. Environment Configurations

Production deployment requires setting these critical environment variables:
* `DATABASE_URL`: PostgreSQL connection string.
* `JWT_SECRET_KEY`: High-entropy cryptographic string for JWT signatures.
* `JWT_ALGORITHM`: Typically `"HS256"`.
* `ACCESS_TOKEN_EXPIRE_MINUTES`: Default: `60`.
* `REFRESH_TOKEN_EXPIRE_DAYS`: Default: `7`.
* `INTERNAL_SERVICE_KEY`: Shared secret key for internal service-to-service calls.

---

## 3. Database Migration Deployment
Alembic migrations must be executed automatically during the container startup sequence before launching the application:

```bash
cd backend
alembic upgrade head
```
Ensure rollback scripts are archived in the release package in case database downgrades are required.
