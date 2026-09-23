<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS

  Founders

  * Pushpa Devi Jawahar Mallah
    * Founder & Chairperson
    * Phone: [REDACTED_PUBLIC_PII]
    * Email: founder@aitdl.com

  * Jawahar Ramkripal Mallah
    * Founder, Chief Executive Officer (CEO) & Chief Software Architect
    * Email: founder@aitdl.com

  * Websites: aitdl.com | erpnbook.com | smritibooks.com

  * Version    : 1.0.0
  * Created    : 2026-09-23
  * Modified   : 2026-09-23
  * Copyright  : © SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
  * Classification: Internal
-->

# DevOps: SMRITI Date-Based Docker Port Standard v1.0.0

## 1. Purpose
Apply the SMRITI date-based host port standard derived from the project owner's birthdate (`27-01-1981`) to the Docker multi-container stack and active runtime configuration:
* **PostgreSQL host port**: `2781` → container `5432`
* **SMRITI API host port**: `1981` → container `8000`
* **SMRITI Web host port**: `8101` → container `3000`

Ensure all internal container ports (`5432`, `8000`, `3000`) and container-to-container service communication (`smriti-db:5432`, `smriti-api:8000`) remain strictly intact and isolated from host-side port modifications.

---

## 2. Scope
* Configuration of `docker-compose.yml` canonical service naming (`smriti-db`, `smriti-api`, `smriti-web`) and published port mappings.
* Active environment variable definitions in `.env`, `.env.example`, `backend/.env`, and `backend/.env.example`.
* Cross-origin resource sharing (CORS) and dynamic local PostgreSQL port resolution probing in `backend/app/core/config.py`.
* Development proxy and client fallback configuration in `vite.config.ts`, `src/db/pool.ts`, and `src/lib/apiFetchV1.ts`.
* Startup banner scripts and installer automation templates in `startup.bat`, `startup.sh`, `install.ps1`, `install.sh`.
* API test verification harnesses in `test_report_api.py` and `scripts/test_live_api.py`.
* Live container restart, health check verification, and runtime connectivity verification.

---

## 3. Files Created
* `docs/walkthrough/devops/DevOps_Docker_Port_Standard_27011981_v1.0.0.md`: Comprehensive walkthrough documenting the port migration, architecture rules, and runtime evidence.

---

## 4. Files Modified
* `docker-compose.yml`: Renamed service `db` to `smriti-db` with network aliases `db` and `smriti-db`; updated published ports to `2781:5432`, `1981:8000`, `8101:3000`; preserved internal ports; updated `depends_on` and `DATABASE_URL` references to `@smriti-db:5432`.
* `.env`: Updated `POSTGRES_PORT=2781`, `BACKEND_API_PORT=1981`, `PORT=8101`, `DATABASE_URL=postgresql://postgres:postgres@localhost:2781/smritisys`.
* `.env.example`: Updated `POSTGRES_PORT=2781`, `BACKEND_API_PORT=1981`, `PORT=8101`, `DATABASE_URL` default.
* `backend/.env`: Updated `POSTGRES_PORT=2781`, `BACKEND_API_PORT=1981`, `PORT=8101`, `DATABASE_URL=postgresql://postgres:postgres@localhost:2781/smritisys`.
* `backend/.env.example`: Updated `POSTGRES_PORT=${POSTGRES_PORT:-2781}`, `BACKEND_API_PORT=${BACKEND_API_PORT:-1981}`, `PORT=${PORT:-8101}`, `DATABASE_URL` default.
* `backend/app/core/config.py`: Added `http://localhost:8101` and `http://127.0.0.1:8101` to `ALLOWED_ORIGINS`; added `2781` to local dev postgres alt_port probe tuple.
* `vite.config.ts`: Updated fallback `BACKEND_API_URL` to `"http://127.0.0.1:1981"`.
* `src/db/pool.ts`: Updated fallback connection string port from `5432` to `2781`.
* `src/lib/apiFetchV1.ts`: Updated fallback `FASTAPI_BASE_URL` to `http://127.0.0.1:1981` and fallback origin to `http://localhost:8101`.
* `startup.bat`: Updated operational info banner with Web (8101), API (1981), and Database (2781).
* `startup.sh`: Updated operational info banner with Web (8101), API (1981), and Database (2781).
* `install.ps1`: Updated default `.env` template generation and completion output to ports 8101, 1981, 2781.
* `install.sh`: Updated default `.env` template generation and completion output to ports 8101, 1981, 2781.
* `test_report_api.py`: Updated connection endpoint to use `BACKEND_API_PORT` (default `1981`).
* `scripts/test_live_api.py`: Updated connection endpoint to use `BACKEND_API_PORT` (default `1981`).
* `docs/walkthrough/README.md`: Appended entry to chronological walkthrough master index table.

---

## 5. Architecture Decisions
* **Strict Separation of Host vs Container Ports**: Host-published ports (`2781`, `1981`, `8101`) provide accessible entry points on developer and staging machines without colliding with default local daemons. Container-internal ports (`5432`, `8000`, `3000`) remain immutable.
* **Canonical Container Service Naming**: Aligned the Compose service name with container name `smriti-db` while maintaining the `db` network alias to guarantee 100% backwards compatibility for any legacy references.
* **Container-to-Container Isolation**: Containers communicate exclusively over the internal bridge network using service names (`smriti-db:5432`, `smriti-api:8000`). Inter-container traffic never routes through `localhost`.

---

## 6. Design Rationale
* The date-based formula `2781` (Day 27 + Year 81), `1981` (Year 1981), and `8101` (Year 81 + Month 01) establishes an authoritative, memorable, collision-free standard across all SMRITI Retail OS environments.
* Eliminates port conflict risks on developer systems that run local PostgreSQL (`5432`), default dev servers (`3000`), or other FastAPI instances (`8000`).

---

## 7. Implementation Summary
* Verified no active listeners on ports `2781`, `1981`, `8101` prior to modification.
* Updated Docker Compose configurations and environment files with strict default parameter expansions (`${POSTGRES_PORT:-2781}:5432`, `${BACKEND_API_PORT:-1981}:8000`, `${PORT:-8101}:3000`).
* Re-created containers via `docker compose up -d`.
* Validated health checks:
  - `smriti-db`: `healthy` via internal `pg_isready -U postgres -d smritisys` on port `5432`
  - `smriti-api`: `healthy` via internal `http://localhost:8000/health` on port `8000`
  - `smriti-web`: `healthy` via internal `http://localhost:3000/` on port `3000`
* Validated host reachability:
  - PostgreSQL: `psql` connection to `localhost:2781` successful
  - API: `http://localhost:1981/health` returned HTTP 200 OK (`{"status":"healthy","database":"connected","service":"operational"}`)
  - Web: `http://localhost:8101/` returned HTTP 200 OK HTML payload
  - Vite Reverse Proxy: `http://localhost:8101/api/v1/health` forwarded cleanly to `smriti-api:8000` returning HTTP 200 OK

---

## 8. Tests Executed
1. `npm test -- --run` — 150 test files, 1022 tests executed.
2. `npm run lint` (`tsc --noEmit`) — full TypeScript compilation check across all project modules.
3. `npm run validate-registry` — form registry validator.
4. `npm run validate-launchpad` — launchpad tile and route registration validator.
5. `python -c "import psycopg2; conn = psycopg2.connect(host='localhost', port=2781, user='postgres', password='postgres', dbname='smritisys'); print(conn.status)"` — direct database connectivity on host port 2781.
6. `curl.exe -i http://localhost:1981/health` — direct API health check on host port 1981.
7. `curl.exe -i http://localhost:8101/` — frontend index check on host port 8101.
8. `curl.exe -i http://localhost:8101/api/v1/health` — frontend reverse proxy verification to API.
9. `.\.venv\Scripts\python.exe scripts/test_live_api.py` — live report studio and order API verification.

---

## 9. Verification Results
* **Vitest Suite**: 150/150 test files passed (1,022/1,022 tests green).
* **TypeScript Compiler**: 0 errors (`tsc --noEmit` exited with code 0).
* **Launchpad & Registry Linters**: Passed with 0 violations.
* **Database Connection**: `localhost:2781` connected to `PostgreSQL 15.18 on x86_64-pc-linux-musl`.
* **API Response**: `localhost:1981/health` returned HTTP 200 OK in 5.64ms.
* **Frontend Response**: `localhost:8101/` returned HTTP 200 OK with full SMRITI React shell.
* **Reverse Proxy**: `localhost:8101/api/v1/health` returned HTTP 200 OK with `services.database: "Connected"`.
* **Container Health**: All 3 containers (`smriti-db`, `smriti-api`, `smriti-web`) verified `(healthy)`.

---

## 10. Known Limitations
* External scripts or tools that hardcode legacy host ports (`5432`, `8000`, `3000`) without referencing `.env` or standard environment variables will need to read `POSTGRES_PORT`, `BACKEND_API_PORT`, or `PORT`.

---

## 11. Future Work
* Update CI/CD automated staging deploy runners to ensure staging environment injects standard ports.
* Add pre-flight diagnostic check in `scripts/architecture_preflight.py` verifying ports match the SMRITI Date-Based Port Standard.

---

## 12. Related ADRs
* ADR-001: Platform Architecture & Communication Layer
* ADR-028: Multi-Container Docker Deployment Governance

---

## 13. Related RFCs
* RFC-2026-0923-DOCKER-PORTS: SMRITI Date-Based Host Port Standard (`27-01-1981`)
