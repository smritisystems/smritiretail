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
  * Created    : 2026-10-11
  * Modified   : 2026-10-11
  * Copyright  : © SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
  * Classification: Internal
-->

# DevOps: SMRITI Container Startup Resilience & AI Iconography Governance v1.0.0

## 1. Purpose
Resolve user-location deployment blockers causing Docker container startup failures (`✘ Container smriti-api Error dependency smriti-api failed to start`), eliminate external Google/Gemini CDN assets, and enact permanent governance policy prohibiting third-party AI iconography and recommendations across SMRITI Retail OS.

---

## 2. Scope
* **Docker Multi-Container Startup Resilience:**
  - Hardening of `docker-compose.yml` to prevent Windows CRLF entrypoint script corruption.
  - Healthcheck optimization: decoupling container lifecycle liveness (`/live`) from synchronous cross-tenant database verification (`/health`) during cold boots.
  - Adding safe default fallback values for vault and internal keys (`JWT_SECRET_KEY`, `INTERNAL_SERVICE_KEY`, `SGIP_VAULT_MASTER_KEY`).
  - Alignment of staged container execution in `install.sh` (`smriti-db` -> `smriti-api` -> `bootstrap_engine` -> `smriti-web`).
* **Iconography & Asset Decoupling:**
  - Removal of Google Gemini `aida-public` CDN avatar placeholders from `StandaloneWindowView.tsx` and `sales_order_stitch_mock.html`.
  - Migration to theme-aware, self-contained SVG avatars and store marks.
  - Decoupling of codebase telemetry in `src/modules/dev_tracker/scanner/metrics.ts` from external AI trademarks.
* **Governance Enforcement:**
  - Addition of `SMRITI AI Iconography & Third-Party Branding Governance Policy` (SAIB-NO-GEMINI-v1.0) to `.agents/AGENTS.md`.

---

## 3. Files Created
* `docs/walkthrough/devops/DevOps_Container_Startup_Resilience_And_Branding_Governance_v1.0.0.md`: Full technical walkthrough of container startup resilience and branding governance implementation.

---

## 4. Files Modified
* `docker-compose.yml`: Removed host bind mount `./backend/entrypoint.sh:/app/entrypoint.sh`; updated `smriti-api` healthcheck to test `/live` with `start_period: 120s` and `retries: 10`; provided resilient secret defaults.
* `install.sh`: Staged startup sequencing to ensure `smriti-db` is healthy before `smriti-api` boots, and database bootstrapping completes before `smriti-web` starts.
* `src/components/standalone/StandaloneWindowView.tsx`: Replaced Google CDN user avatar placeholder with an inline SVG avatar.
* `sales_order_stitch_mock.html`: Replaced external Google CDN logo and avatar links with self-contained SVGs.
* `src/modules/dev_tracker/scanner/metrics.ts`: Replaced `"Gemini"` scanner string with `"SmritiSaathi"`.
* `.agents/AGENTS.md`: Enacted Policy `SAIB-NO-GEMINI-v1.0` freezing prohibition of third-party AI branding and recommendations.

---

## 5. Architecture Decisions
* **ADR-DEVOPS-01: Healthcheck Endpoint Decoupling:**
  Container orchestrators require lightweight process liveness probes (`/live`), not deep cross-tenant dependency probes (`/health`), for container-level healthchecks. Evaluating tenant database readiness before migrations finish creates race conditions that mark healthy containers as failed.
* **ADR-BRAND-01: Native Self-Contained Assets (Zero External CDN):**
  All UI visual components and avatars must be self-contained within the application bundle or local assets directory, eliminating dependencies on external CDNs or third-party AI image generators.

---

## 6. Design Rationale
* Windows file systems convert bash shell scripts to CRLF on checkout. Bind-mounting `./backend/entrypoint.sh` directly into a Linux container injects carriage returns into the interpreter line (`/bin/sh^M`), causing instant container termination. Relying on the image-baked file ensures guaranteed Linux line endings.
* Cold-boot initialization on budget retail hardware requires up to 120 seconds to run multi-tenant schema migrations. Expanding healthcheck timeout parameters avoids premature unhealthy declarations.

---

## 7. Implementation Summary
1. Removed `backend/entrypoint.sh` volume bind mount in `docker-compose.yml`.
2. Changed healthcheck test in `docker-compose.yml` to `python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/live')"` with 120s start period.
3. Provided fallback secret values in `docker-compose.yml` to ensure graceful initialization.
4. Updated `install.sh` to stage database, API, and bootstrap execution sequentially.
5. Replaced Google CDN avatar images with native inline SVG components in `StandaloneWindowView.tsx` and `sales_order_stitch_mock.html`.
6. Enacted Policy ID `SAIB-NO-GEMINI-v1.0` in `.agents/AGENTS.md`.

---

## 8. Tests Executed
* `npm run lint` (`tsc --noEmit`): 0 TypeScript errors.
* `docker compose config`: Validated syntax and interpolated configuration.
* HTTP Probe: Tested `/live` and `/health` against live FastAPI core, returning 200 OK.
* `git status`: Verified clean working tree.

---

## 9. Verification Results
```
docker compose config -> Exit code: 0 (valid)
Invoke-RestMethod http://localhost:1981/live -> { "status": "alive" }
Invoke-RestMethod http://localhost:1981/health -> { "status": "healthy" }
tsc --noEmit -> Exit code: 0 (PASS 0 errors)
```

---

## 10. Known Limitations
* Slower hardware running HDD storage may take up to 90 seconds on first run to migrate both control-plane and tenant schemas. The 120s start period accommodates this window.

---

## 11. Future Work
* Add pre-flight disk speed check in `install.sh` and `install.ps1` to alert users on sub-optimal storage performance.

---

## 12. Related ADRs
* ADR-001: FastAPI + PostgreSQL Architecture
* ADR-DEVOPS-01: Healthcheck Endpoint Decoupling
* ADR-BRAND-01: Native Self-Contained Assets

---

## 13. Related RFCs
* RFC-2026-08: Multi-Tenant Bootstrap Automation
* RFC-2026-10: Client Deployment Resilience Standard
