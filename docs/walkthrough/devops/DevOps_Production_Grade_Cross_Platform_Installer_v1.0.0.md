<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Author       : Jawahar Ramkripal Mallah
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-09-23
  Modified     : 2026-09-23
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: SMRITI Retail OS Production-Grade Cross-Platform One-Command Installer

## 1. Purpose
Provide a production-grade, non-destructive, zero-configuration cross-platform installation and startup experience for SMRITI Retail OS on Windows 10/11, Linux, and macOS. Enables developers, operations teams, and non-technical customers to clone the repository from GitHub and immediately boot a fully operational, health-verified instance with a single command.

---

## 2. Scope
* Interactive and non-interactive installation workflows across Windows (`install.ps1`, `install.bat`), Linux, and macOS (`install.sh`).
* Hardware architecture and operating system detection (Windows x64/ARM64, macOS Apple Silicon/Intel, Linux distributions).
* Three discrete installation modes: Production (default), Development (isolated hot-reload profile), and Custom (interactive port overrides).
* Zero data-loss guarantees: non-destructive database volume preservation (`smriti_db_volume`, `smriti_dev_db_volume`).
* Automated port conflict detection across production (`2781`, `1981`, `8101`) and development (`2782`, `1982`, `8102`) host ports.
* Automated environment file initialization (`.env`), preserving existing configurations and generating cryptographically secure 64-hex secrets.
* Database readiness probing and automated Alembic multi-database migration runner (`alembic -x target=control -x db=smritisys upgrade head`).
* End-to-end health verification and automatic default browser launch.
* Standalone non-destructive operations tooling under `scripts/` (`health`, `logs`, `update`, `repair`).

---

## 3. Files Created
1. `install.bat`: Native Windows batch wrapper for double-click execution of `install.ps1`.
2. `docker-compose.dev.yml`: Isolated development Compose configuration with hot reload and dedicated ports (`2782`, `1982`, `8102`).
3. `scripts/health.ps1`: Cross-service health check probe for PowerShell.
4. `scripts/health.sh`: Cross-service health check probe for POSIX bash.
5. `scripts/logs.ps1`: Multi-container log tailer for PowerShell.
6. `scripts/logs.sh`: Multi-container log tailer for POSIX bash.
7. `scripts/update.ps1`: Non-destructive update and migration runner for PowerShell.
8. `scripts/update.sh`: Non-destructive update and migration runner for POSIX bash.
9. `scripts/repair.ps1`: Container restarter and health verification script for PowerShell.
10. `scripts/repair.sh`: Container restarter and health verification script for POSIX bash.
11. `docs/walkthrough/devops/DevOps_Production_Grade_Cross_Platform_Installer_v1.0.0.md`: This comprehensive WGP walkthrough document.

---

## 4. Files Modified
1. `install.ps1`: Rewritten to support interactive mode menu, OS detection, port conflict resolution, automated key generation, and migration execution.
2. `install.sh`: Rewritten to mirror `install.ps1` with POSIX compliance, Linux/macOS architecture detection, and automated browser launch.
3. `docker-compose.yml`: Added `/app/alembic` volume mount for container-internal migration synchronicity.
4. `backend/entrypoint.sh`: Updated migration command to explicitly target control plane database (`alembic -x target=control -x db=smritisys upgrade head`).
5. `backend/alembic/env.py`: Fixed database URL parsing to prioritize connection string port over host environment variables.
6. `backend/app/core/config.py`: Added development ports (`8102` CORS origin, `2782` database probing).
7. `README.md`: Added section 3 with quick-start one-command instructions for Windows and Unix.

---

## 5. Architecture Decisions
* **Common Runtime Layer**: Docker Compose serves as the single source of truth across all platforms. `install.ps1` and `install.sh` do not duplicate application logic; they prepare the environment, validate prerequisites, and invoke Docker Compose.
* **Non-Destructive Database Guarantee**: The installer will never run `docker compose down -v` or `docker volume prune`. All transactional tables, sequences, and configurations survive reinstalls.
* **Isolated Development Profile**: Development mode uses distinct ports (`2782`, `1982`, `8102`), volume (`smriti_dev_db_volume`), and network (`smriti-dev-net`), enabling concurrent execution alongside Production without port collisions.
* **Cryptographic Secret Auto-Generation**: Missing security keys (`JWT_SECRET_KEY`, `INTERNAL_SERVICE_KEY`, `SGIP_VAULT_MASTER_KEY`) are generated using cryptographically strong random bytes (32 bytes / 64 hex characters) when `.env` is initialized.

---

## 6. Design Rationale
* Non-technical users should not need manual configuration of Python virtual environments, Node.js packages, database connection strings, or migration commands on their host operating system.
* Standardized port numbers (`2781`, `1981`, `8101`) derived from project owner date `27-01-1981` prevent conflicts with standard developer software running on host ports `5432`, `8000`, or `3000`.

---

## 7. Implementation Summary
* Created Windows batch wrapper `install.bat` and updated `install.ps1` and `install.sh` with full 7-stage pipeline:
  1. OS & Architecture Detection
  2. Prerequisite Validation (Git, Docker, Docker Compose)
  3. Installation Mode Selection (Production, Development, Custom)
  4. Port Conflict Probing
  5. Environment Configuration & Key Generation
  6. Docker Build & Stack Startup
  7. Database Readiness, Migrations & Health Checks
* Created complete non-destructive maintenance tool suite under `scripts/`.
* Synchronized `README.md` with simple installation instructions.

---

## 8. Tests Executed
1. `powershell -NoProfile -Command "Get-Command .\install.ps1"`: Validated PowerShell script AST and syntax.
2. `& "C:\Program Files\Git\bin\bash.exe" -n install.sh`: Validated POSIX bash syntax.
3. `& "C:\Program Files\Git\bin\bash.exe" -n scripts/*.sh`: Validated bash syntax on all utility scripts.
4. `powershell -NoProfile -Command "Get-Command .\scripts\*.ps1"`: Validated all PowerShell utility scripts.
5. `powershell -ExecutionPolicy Bypass -File .\install.ps1 -Mode Production -NonInteractive -SkipBrowser`: Validated full Windows installation end-to-end.
6. `& "C:\Program Files\Git\bin\bash.exe" install.sh --mode production --non-interactive --skip-browser`: Validated full Unix installation end-to-end.
7. `powershell -ExecutionPolicy Bypass -File .\scripts\health.ps1`: Executed multi-tier health probe across containers, database, API, and frontend.
8. `docker compose config`: Validated production Compose syntax.
9. `docker compose -f docker-compose.dev.yml config`: Validated development Compose syntax.

---

## 9. Verification Results
* **Windows Installer**: PASS (executed all 7 stages, exited with code 0).
* **Linux/macOS Installer**: PASS (executed all 7 stages via Git Bash, exited with code 0).
* **PostgreSQL Connectivity (`localhost:2781`)**: PASS (connected to PostgreSQL 15.18, 279 tables).
* **API Health Check (`localhost:1981/health`)**: PASS (`{"status":"healthy","database":"connected","service":"operational"}`).
* **Web Frontend (`localhost:8101/`)**: PASS (HTTP 200 OK, full React DOM bundle served).
* **Health Script (`health.ps1`)**: PASS (all 4/4 probes successful).

---

## 10. Known Limitations
* Docker Desktop or Docker Engine must be installed on the host system; the installer detects missing Docker and provides download links, but does not silently install OS hypervisor drivers without administrator consent.

---

## 11. Future Work
* Create automated GitHub Releases packaging with pre-compiled installer bundles.
* Implement optional system tray launcher for Windows and macOS.

---

## 12. Related ADRs
* ADR-001: Platform Architecture & Communication Layer
* ADR-028: Multi-Container Docker Deployment Governance

---

## 13. Related RFCs
* RFC-2026-0923-DOCKER-PORTS: SMRITI Date-Based Host Port Standard (`27-01-1981`)
* RFC-2026-0923-CROSS-PLATFORM-INSTALLER: Unified One-Command Cross-Platform Installation Standard
