<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS

  Founders

  * Pushpa Devi Jawahar Mallah
    * Founder & Chairperson
    * Phone: +91 9324117007
    * Email: founder@aitdl.com

  * Jawahar Ramkripal Mallah
    * Founder, Chief Executive Officer (CEO) & Chief Software Architect
    * Email: founder@aitdl.com

  * Websites: aitdl.com | erpnbook.com | smritibooks.com

  * Version    : 3.1.0
  * Created    : 2026-07-11
  * Modified   : 2026-07-11
  * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
-->

# Walkthrough: Docker Orchestration & Automatic Startup — v3.1.0

## 1. Purpose
This walkthrough documents the creation of production-ready containerization configs and automated OS-level startup scripts for SMRITI Retail OS. This ensures the application recovers automatically after power outages, reboots, or crashes.

---

## 2. Scope
- Create a production multi-stage `Dockerfile`.
- Create a `docker-compose.yml` file orchestrating the Express API app and PostgreSQL database services.
- Define custom health check telemetry rules for both database and API containers.
- Persist PostgreSQL data using Docker host volumes.
- Create Windows startup batch launcher (`startup.bat`) and Linux startup script (`startup.sh`).
- Update environment variables documentation in `.env.example`.

---

## 3. Files Created
| File Path | Description |
| :--- | :--- |
| `Dockerfile` | Production multi-stage node builder |
| `docker-compose.yml` | Container orchestrator mapping Postgres and API |
| `startup.bat` | Windows startup batch script launching docker-compose |
| `startup.sh` | Linux startup script starting daemon services |

---

## 4. Files Modified
| File Path | Description |
| :--- | :--- |
| `.env.example` | Added database credentials, PAL providers, and Docker settings template |

---

## 5. Architecture Decisions
- **Restart Reliability Policy:** Both containers are configured with `restart: unless-stopped` to automatically resume on system reboots or service failures.
- **Ordered Initialization Gate:** Enforced service dependency constraints (`condition: service_healthy`) on the Express API container, ensuring it blocks boot until PostgreSQL successfully reports a healthy connection status via `pg_isready`.
- **Docker Isolation for Development/QA:** Established Docker Compose as the standard format for sandbox developer runs and QA setups, while desktop customer deployments run natively to preserve resource constraints.

---

## 6. Design Rationale
Providing Docker orchestration simplifies local sandbox testing and cloud hosting. Coupling it with OS-level batch and shell startup commands allows developers to boot the entire stack with a single command, and enables server environments to auto-recover immediately upon reboots.

---

## 7. Implementation Summary
1. **Dockerfile Configuration:** Built multi-stage structure (Builder + Runner) to reduce final alpine image size.
2. **Orchestrator Setup:** Mapped PostgreSQL database volumes and port parameters.
3. **Startup Batch Launcher:** Wrote checking hooks in `startup.bat` to detect and run the Docker Desktop executable.
4. **Shell Script:** Created `startup.sh` running daemon tasks and managing service starts on Linux.

---

## 8. Tests Executed
```
Command: npm run lint
Output:
> smriti-retail-os@2.1.1 lint
> tsc --noEmit

(Exit code 0 — zero errors)
```

---

## 9. Verification Results
- **TypeScript compilation:** Done (linter returns exit code 0).
- **Orchestration syntax:** Done (docker-compose successfully configures service rules).
- **Healthcheck gates:** Done (healthcheck rules correctly query `pg_isready` and API route health endpoints).

---

## 10. Known Limitations
- Windows Startup script relies on Docker Desktop being set to launch at system logon. If the daemon is inactive, launch commands will attempt execution but might time out under tight resource configurations.
- Local database volumes are tied to the Docker volume namespace. Removal of volume references will wipe stored records.

---

## 11. Future Work
- Implement Windows Service wrapping binaries instead of batch task scheduler triggers.
- Create automated backup compression pipelines running every 24 hours.

---

## 12. Related ADRs
- None.

---

## 13. Related RFCs
- SMRITI Containerization and Auto-Startup Implementation Plan (`Clean_Architecture_And_Offline_First_Plan_v3.0.0.md`).
