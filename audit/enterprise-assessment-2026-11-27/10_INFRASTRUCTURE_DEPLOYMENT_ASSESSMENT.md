# Infrastructure and Deployment Assessment

## Compose topology observed

`docker-compose.yml` declares:

1. PostgreSQL 15 Alpine with a named persistent volume and host port bound to `127.0.0.1`.
2. React/web container on host port 8101 by default.
3. FastAPI container on host port 1981 by default, health checked through `/live`, with repository/application mounts.
4. MSSQL Server 2022 service, host-bound to loopback, with persistent volume and readiness check.

No reverse proxy, TLS termination or Cloudflare Tunnel service is declared in the inspected Compose file. Other deployment integrations were not live-verified.

## Findings

- **EA-OPS-01:** Compose does not explicitly pass `ENVIRONMENT`; `Settings` defaults to development. It contains PostgreSQL password defaults of `postgres`; production configuration rejects those only if the runtime environment is explicitly production. The API port mapping is not loopback-bound. Actual `.env` overrides were not inspected.
- **EA-OPS-02:** Backend `entrypoint.sh` runs the canonical bootstrap/migration engine unless `SKIP_MIGRATIONS=true`; Compose defaults this to `false`. A deploy/restart can therefore apply migration/bootstrap behavior automatically. No migration was executed during the assessment.
- README claims PostgreSQL 17 and Python 3.13, while Compose declares PostgreSQL 15 and the backend Dockerfile uses Python 3.11 (EA-ARCH-01).
- Health checks exist, but startup code can log schema/guard issues and continue. `/health` also checks a hardcoded tenant example `smriti001`; its usefulness for installations without that tenant is not verified.
- The backup guide describes RPO/RTO and scheduled strategies; those targets are documentation, not evidence of configured archive storage, successful backups, restore drills or alerting.
- Compose volume mounts and writable paths were not tested for least privilege, persistence, host isolation or production suitability. Container runtime user hardening was not established.

## Deployment readiness

**Infrastructure: 4.0/10. Production Readiness: 3.5/10.** A local Compose stack exists with health checks and persistent data volumes. TLS, production secrets injection, actual resource sizing, automated deployment, rollback, restore and live health were not verified.

Before production sign-off, set runtime mode explicitly, remove unsafe defaults from production configuration, bind API behind a controlled ingress, pin and align supported image versions, gate migrations as a release step, and run an isolated restart/backup/restore/rollback drill.
