<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.33.0
  Created      : 2026-07-25
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
-->

# SMRITI Retail OS - Enterprise Installation & Operational Deployment Guide

---

## 1. Architecture & Container Ecosystem

SMRITI Retail OS is built upon a Four-Tier Enterprise Architecture governed by strict isolation principles:

```text
 ┌────────────────────────────────────────────────────────────────────────┐
 │                    SMRITI RETAIL OS CLUSTER                             │
 ├────────────────────────────────────────────────────────────────────────┤
 │  [smriti-workspace]  ──►  [smriti-api]  ──►  [smriti-db]                │
 │  React / Vite            FastAPI Engine       PostgreSQL 15-Alpine     │
 │  Port 3000               Port 8000            Port 5432                │
 └────────────────────────────────────────────────────────────────────────┘
```

1. **`smriti-workspace` (Frontend Tier)**: High-performance React web application running in a Node 20 / Vite container. Serves POS, Item Master, Barcode Studio, Sales Studio, and Accounting Sync.
2. **`smriti-api` (Platform API Engine Core)**: Headless Python 3.11 / FastAPI System-of-Record API engine. Handles OAuth2/JWT authorization, transactional business logic, domain events, and database persistence.
3. **`smriti-db` (System-of-Record Database)**: PostgreSQL 15 database container mounted on persistent docker volume `smriti_db_volume`.

---

## 2. Prerequisites & Environment Setup

### 2.1 Enabling WSL2 & Virtualization on Windows
SMRITI Docker containers require Windows Subsystem for Linux (WSL2) or Hyper-V:

1. Open PowerShell as Administrator and run:
   ```powershell
   wsl --install
   ```
2. Restart Windows.
3. Install **Docker Desktop for Windows** from [docker.com](https://www.docker.com/).
4. In Docker Desktop Settings:
   - Enable **Use the WSL 2 based engine**.
   - Ensure **Resource allocation** has at least 4 GB RAM assigned to Docker.

---

## 3. Environment Variables Reference (`.env`)

`install.ps1` automatically generates `.env` from `.env.example`. Key configuration options include:

| Environment Variable | Default Value | Description |
| :--- | :--- | :--- |
| `PORT` | `3000` | Local port mapping for Workspace Frontend |
| `BACKEND_API_PORT` | `8000` | Local port mapping for Platform API Core |
| `POSTGRES_USER` | `postgres` | Database superuser account name |
| `POSTGRES_PASSWORD` | *(Auto-generated)* | Secure database superuser password |
| `POSTGRES_DB` | `smriti_retail_db` | Main relational database name |
| `POSTGRES_PORT` | `5432` | Local port mapping for PostgreSQL DB |
| `JWT_SECRET_KEY` | *(Auto-generated)* | 256-bit cryptographic signature key for OAuth2 tokens |
| `INTERNAL_SERVICE_KEY` | *(Auto-generated)* | Mutual authentication key for internal API gateway calls |
| `SKIP_MIGRATIONS` | `false` | When true, skips automatic Alembic schema migrations on container startup |

---

## 4. One-Click Installation Protocol

Run the installer from PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File install.ps1
```

### Installation Execution Sequence:
1. **Prerequisite Check**: Validates Windows OS, PowerShell, Git, Docker, Docker Compose, and WSL2 daemon.
2. **Environment Assembly**: Creates `.env` and generates secure cryptographic keys (`JWT_SECRET_KEY`, `INTERNAL_SERVICE_KEY`).
3. **Cluster Build**: Executes `docker compose build` to package frontend and backend images.
4. **Container Orchestration**: Starts `smriti-db`, `smriti-api`, and `smriti-workspace` containers via `docker compose up -d`.
5. **Health Verification Loop**: Polls health metrics until all 3 services report `HEALTHY`.
6. **Schema Migration & Seeding**: Runs `alembic upgrade head` and `app.db.seed` inside `smriti-api`.
7. **Endpoint Verification**: Probes `http://localhost:8000/health` and `http://localhost:3000/`.

---

## 5. Operations & Lifecycle Management

### Updating the Installation (`update.ps1`)
To pull the latest codebase, rebuild changed Docker layers, and apply schema migrations:
```powershell
powershell -ExecutionPolicy Bypass -File update.ps1
```

### Self-Healing & Diagnostic Repair (`repair.ps1`)
If a container fails or network bindings break:
```powershell
powershell -ExecutionPolicy Bypass -File repair.ps1
```

### Database Backup & Disaster Recovery (`backup.ps1` & `restore.ps1`)
- **Backup**:
  ```powershell
  powershell -ExecutionPolicy Bypass -File backup.ps1
  ```
  Generates a timestamped dump under `backups/smriti_db_backup_YYYYMMDD_HHMMSS.sql`.

- **Restore**:
  ```powershell
  powershell -ExecutionPolicy Bypass -File restore.ps1 -BackupFile "backups/smriti_db_backup_20260725_120000.sql"
  ```

---

## 6. Enterprise Production Security Guidelines

1. **Firewall & Binding**: For production environments, bind `PORT` and `BACKEND_API_PORT` behind a reverse proxy (e.g. NGINX / Caddy) with TLS 1.3 SSL certificates.
2. **Secret Storage**: Store `.env` securely and never commit production credentials to source repositories.
3. **Volume Isolation**: Maintain regular off-site copies of the `backups/` folder.
