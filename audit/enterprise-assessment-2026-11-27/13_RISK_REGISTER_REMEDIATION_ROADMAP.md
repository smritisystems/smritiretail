# Risk Register and Remediation Roadmap

All findings below are source-level or repository-artifact observations unless explicitly stated. No live database, production runtime or exploit test was used. Severity follows the requested P0–P4 definitions; P1/P2 items should be confirmed in an approved isolated environment before code changes. “Files/lines” refer to current working-tree line locations, which may shift because the worktree is dirty.

## Findings

### EA-SEC-03 — Webhook bearer authentication bypasses company assignment checks

1. **Severity:** P1 — High.
2. **Affected module:** E-commerce webhook ingestion and tenant authorization.
3. **Files/lines:** `backend/app/api/v1/ecom.py:133-139, 175-180, 264-310`; related `backend/app/services/db_resolver.py:146-168`.
4. **Database/table:** Selected tenant database; `integration_outbox_events`.
5. **Observed behavior:** Delegated static review found the webhook dependency accepts a decoded bearer JWT and resolves tenant access using hard-coded role `SYSADMIN`. The supplied `X-Company-ID` can select a target tenant; the route writes the payload to that tenant's outbox and commits.
6. **Expected behavior:** User bearer requests remain bound to the user's authorized tenant. Cross-tenant service ingestion is permitted only with a tenant-bound service credential/signature and validated tenant claim.
7. **Evidence:** Reviewer traced webhook dependency → resolver role bypass → tenant outbox write. No dynamic request was made.
8. **Business impact:** Potential cross-company event injection and corruption of integration/audit workflows.
9. **Technical impact:** Authorization elevation at the webhook boundary bypasses company assignment checks.
10. **Recommendation:** Remove hard-coded SYSADMIN elevation for bearer tokens; validate tenant-specific HMAC/service authentication and bind the signed tenant to database routing.
11. **Dependencies/risks:** Preserve legitimate external webhook behavior with an explicit credential model; add isolated positive/negative tests for multiple tenants.
12. **Confidence:** High for static code path; live exploitability not tested.

### EA-SEC-04 — Reversal endpoint lacks authorization, refund validation and idempotency

1. **Severity:** P2 — Medium.
2. **Affected module:** CGE unified loyalty/commission reversal.
3. **Files/lines:** `backend/app/api/v1/cge_unified.py:70-82`; related `backend/app/services/cge_unified_svc.py:151-210`.
4. **Database/table:** Tenant loyalty and commission ledger/member balances (exact table names not established by this static scan).
5. **Observed behavior:** Delegated review found the endpoint requires authentication but has no role/permission check. Service logic reverses earned loyalty/commission and commits without verifying a refund; repeated calls may repeat reversals. The supplied refund amount is not used for authorization.
6. **Expected behavior:** Only authorized finance/manager roles can submit a valid refund-linked reversal; a reversal is idempotent and audit logged.
7. **Evidence:** Reviewer traced endpoint to service mutation. No transaction was made.
8. **Business impact:** Unauthorized or duplicate reduction of customer loyalty balances and commission records.
9. **Technical impact:** Missing permission, refund linkage and idempotency allow state mutations outside a validated financial workflow.
10. **Recommendation:** Add explicit permission dependency, refund existence/status/amount validation, unique source transaction/idempotency constraints and actor/reason audit.
11. **Dependencies/risks:** Existing cancellation/return workflows may call this operation; preserve valid reversal semantics and add role/return tests.
12. **Confidence:** High for source path; runtime and schema effects untested.

### EA-SEC-01 — Tenant context can default to a company without assignment records

1. **Severity:** P1 — High (conditional; static-only).
2. **Affected module:** Authentication, tenant context, all company-scoped APIs using `get_tenant_context` / `get_company_db`.
3. **Files/lines:** `backend/app/api/deps.py:229-257, 269-307`.
4. **Database/table:** Control Plane `users`, `user_company_assignments`, `branches`, `company_database_registries`; tenant database selected from registry.
5. **Observed behavior:** If no usable company target exists, the dependency selects `COMP-001`. For non-SYSADMIN users, it checks assignment membership only when at least one assignment row exists. If the user lacks `company_id` and has no assignment rows, the default-company path may be used if the registry/default branch exists. No request was sent.
6. **Expected behavior:** Missing or unassigned company context fails closed; only an explicit active assignment or explicit privileged policy may authorize a tenant.
7. **Evidence:** `raw_target` fallback and conditional `any_comp_res` branch in `get_tenant_context()`.
8. **Business impact:** Potential cross-company exposure or transaction processing under the wrong company.
9. **Technical impact:** Implicit default tenant bypasses assignment enforcement under the stated preconditions.
10. **Recommendation:** Remove non-SYSADMIN default tenant selection; require explicit active company assignment and bind any requested company to it. Audit all routes that accept raw company headers.
11. **Dependencies/risks:** Must preserve intentional SYSADMIN and legacy login/company-selection behavior. Confirm test accounts with missing assignments in an isolated environment.
12. **Confidence:** Medium; static control-flow evidence, no runtime proof.

### EA-DB-01 — Backup target resolution silently selects a different database

1. **Severity:** P1 — High.
2. **Affected module:** Backup/restore and tenant data governance.
3. **Files/lines:** `backend/app/core/backup_engine.py:375-396, 463`.
4. **Database/table:** Requested tenant DB; fallback `smriti001`; fallback session is the default Control Plane DB session.
5. **Observed behavior:** `_resolve_target_db_name()` catches resolution exceptions and returns `"smriti001"`. `_resolve_session()` catches further errors and returns `default_async_session()`.
6. **Expected behavior:** An unresolved company/database must abort the backup job; never change the backup target or fall back to Control Plane.
7. **Evidence:** Explicit broad exception handling followed by success-shaped fallback database/session.
8. **Business impact:** Wrong company may be backed up or a Control Plane session may be used unexpectedly; required company backup could be missed.
9. **Technical impact:** Tenant routing failures are hidden, weakening backup integrity and target isolation.
10. **Recommendation:** Fail the job with a visible error unless the requested company resolves to a registered READY tenant DB; pass the validated resolved DB into the full backup lifecycle.
11. **Dependencies/risks:** Preserve only deliberate administrative all-tenant backup semantics; test failure modes with marked disposable databases.
12. **Confidence:** High for the fallback behavior; live consequences untested.

### EA-DATA-01 — Tracked spreadsheets may contain customer/invoice data

1. **Severity:** P1 — High (content not inspected).
2. **Affected module:** Repository data governance, tax/customer information.
3. **Files/lines:** Tracked root and artifact workbooks with names indicating client details/tax invoices; binary files have no line numbers.
4. **Database/table:** Not applicable; source-control artifacts.
5. **Observed behavior:** Git tracks multiple spreadsheet artifacts whose filenames identify client-details or tax-invoice content. Contents were intentionally not opened or reproduced.
6. **Expected behavior:** Repository should contain only approved, minimized, anonymized fixtures; sensitive business records should be held under approved access/retention controls.
7. **Evidence:** `git ls-files` returned tracked `*Client_Details*.xlsx` and `*Tax_Invoices*.xlsx` paths.
8. **Business impact:** Potential exposure of customer, invoice or statutory information to repository users and copies.
9. **Technical impact:** Source control history may retain data after deletion from the current tree.
10. **Recommendation:** Classify files without dumping their contents; obtain data-owner/security approval, remove or replace with synthetic data if required, and follow approved history/retention remediation.
11. **Dependencies/risks:** Do not rewrite Git history or delete records without explicit owner approval; legal retention rules may apply.
12. **Confidence:** Medium; filename evidence only.

### EA-OPS-01 — Compose may run the backend in development mode with unsafe defaults

1. **Severity:** P2 — Medium (deployment-dependent).
2. **Affected module:** Deployment security and network exposure.
3. **Files/lines:** `docker-compose.yml:14-22, 43-46, 71-81`; `backend/app/core/config.py:148-153, 182, 270-288`.
4. **Database/table:** PostgreSQL credentials; tenant database exposure is indirect through API.
5. **Observed behavior:** Compose defines `postgres` as the fallback PostgreSQL password, does not explicitly set backend `ENVIRONMENT`, and maps the API port without a loopback host bind. App mode defaults to development; weak-credential rejection runs only for production mode.
6. **Expected behavior:** Production mode is explicit and fail-closed; production DB secret has no weak fallback; API access is behind a controlled ingress.
7. **Evidence:** Compose interpolation and `Settings.ENVIRONMENT` default; production-only validation branch.
8. **Business impact:** A production deployment with incomplete overrides may miss production-only checks or expose API on all host interfaces.
9. **Technical impact:** Secure behavior depends on external, uninspected environment configuration.
10. **Recommendation:** Require an explicit deployment profile/mode, reject missing production secrets, use production Compose overrides/secrets, and bind API only to approved ingress.
11. **Dependencies/risks:** Existing local/dev installation defaults may be relied upon; separate dev and production configurations.
12. **Confidence:** High for source defaults; actual deployment unknown.

### EA-DB-02 — Control Plane table ownership and tenant migration filter are asymmetric

1. **Severity:** P2 — Medium.
2. **Affected module:** Database architecture, migration governance.
3. **Files/lines:** `backend/app/db/ownership.py` Control Plane declarations; `backend/alembic/env.py:151-177` and subsequent table allowlist.
4. **Database/table:** `companies`, `branches`, `users`, `roles`, user assignment tables and other Control Plane-owned tables.
5. **Observed behavior:** The ownership registry declares these tables Control Plane-owned; Alembic `include_object()` excludes tenant-owned tables for target `control`, but its common allowlist includes Control Plane table names and does not symmetrically exclude them for target `tenant`.
6. **Expected behavior:** Migration/autogenerate scope must enforce the same positive ownership map in both directions.
7. **Evidence:** Owner declarations and target-specific filter logic.
8. **Business impact:** Potential schema drift or inappropriate table management on a company database.
9. **Technical impact:** Inconsistent autogeneration may create or manage objects in an unexpected target.
10. **Recommendation:** Derive both target filters from the canonical ownership registry; add isolated tests proving control-only tables are excluded from tenant target and vice versa.
11. **Dependencies/risks:** Do not remove historical or required tenant-local references without inventorying deployed schemas; current tenant DB state is unknown.
12. **Confidence:** High for static filter mismatch; live schema impact unknown.

### EA-SEC-02 — Browser tokens are accessible to page JavaScript

1. **Severity:** P2 — Medium.
2. **Affected module:** Frontend authentication/session handling.
3. **Files/lines:** `src/lib/apiFetchV1.ts`; `backend/app/api/v1/auth.py`; `backend/app/main.py`.
4. **Database/table:** Not applicable.
5. **Observed behavior:** Browser auth flows previously wrote access/refresh tokens to `localStorage` and copied the access token to script-readable cookies.
6. **Expected behavior:** Session credentials should not be readable by arbitrary page scripts; cookie-based sessions should use secure server-set attributes and CSRF controls.
7. **Evidence:** The previous `localStorage.setItem` and `document.cookie` flow has been replaced by server-set HttpOnly cookies; first-party browser requests use CSRF and origin validation.
8. **Business impact:** If a script-injection vulnerability occurs, attacker script may obtain bearer credentials.
9. **Technical impact:** Browser token storage increases impact of XSS; no XSS was demonstrated.
10. **Remediation:** Browser login, refresh, logout and tenant-switch flows now use HttpOnly/SameSite cookies, Secure outside development/test, CSRF headers, and request-origin validation. Browser token storage has been removed; bearer API clients retain their token response contract.
11. **Dependencies/risks:** Cross-origin browser deployments must include the UI origin in `ALLOWED_ORIGINS`. Auth regression tests were added; database-backed tests were not run.
12. **Confidence:** High for storage pattern; exploitability depends on other controls.

### EA-ARCH-01 — Runtime and documented stack versions differ

1. **Severity:** P2 — Medium.
2. **Affected module:** Build, deployment and support lifecycle.
3. **Files/lines:** README stack section; `docker-compose.yml:14`; `backend/Dockerfile:1`.
4. **Database/table:** PostgreSQL server version.
5. **Observed behavior:** README describes PostgreSQL 17 and Python 3.13; Compose pins PostgreSQL 15 Alpine and the backend image uses Python 3.11.
6. **Expected behavior:** Canonical support matrix matches built/tested deployment artifacts.
7. **Evidence:** README technology stack and container image declarations.
8. **Business impact:** Operators may install an unsupported or untested version.
9. **Technical impact:** Version-specific migration, dependency and runtime differences are possible.
10. **Recommendation:** Establish a tested support matrix and align docs, CI, Docker images and dependency metadata.
11. **Dependencies/risks:** Upgrade only through a separately approved release plan; do not change versions in this assessment.
12. **Confidence:** High.

### EA-OPS-02 — Startup bootstrap/migrations run by default

1. **Severity:** P2 — Medium.
2. **Affected module:** Deployment and database change control.
3. **Files/lines:** `docker-compose.yml:80-81`; `backend/entrypoint.sh:16-23`.
4. **Database/table:** Control Plane and tenant schemas, subject to bootstrap target logic.
5. **Observed behavior:** `SKIP_MIGRATIONS` defaults to false; entrypoint starts the canonical database bootstrap engine before Gunicorn.
6. **Expected behavior:** Production schema changes should be explicitly approved, reviewed, backed up and gated as a deployment step.
7. **Evidence:** Startup shell branch.
8. **Business impact:** Restart/deploy can initiate schema mutations without an independent release gate.
9. **Technical impact:** Multiple replicas/startups may contend; rollback and partial failure handling need verification.
10. **Recommendation:** Separate migration job from API startup, enforce explicit deployment approval and test rolling/rollback behavior.
11. **Dependencies/risks:** Existing install flow may rely on one-command bootstrap; preserve a controlled first-install path.
12. **Confidence:** High for startup behavior; deployment impact untested.

### EA-PERF-01 — Rate limits are process-local unless externally backed

1. **Severity:** P2 — Medium.
2. **Affected module:** API protection and scalability.
3. **Files/lines:** `backend/app/middleware/rate_limiter.py:1-60`; `backend/entrypoint.sh:24-28`.
4. **Database/table:** Not applicable.
5. **Observed behavior:** `slowapi` limiter is constructed in-process and Gunicorn defaults to two workers. No shared backend is configured in the inspected code.
6. **Expected behavior:** Global limits across workers/replicas should be consistent or explicitly documented as per-process.
7. **Evidence:** Module-level singleton and in-memory key/limiter setup; worker count.
8. **Business impact:** Tenant/request limits may be multiplied by worker or replica count.
9. **Technical impact:** Rate limiting does not represent a single global quota without shared storage.
10. **Recommendation:** Use a shared limiter store for horizontally scaled deployments or set/document a per-worker budget.
11. **Dependencies/risks:** Requires selecting and operating shared storage; no performance baseline exists.
12. **Confidence:** Medium; runtime backend configuration not inspected.

### EA-TEST-01 — One full-suite test timed out under load

1. **Severity:** P3 — Low.
2. **Affected module:** Frontend architecture regression test / CI reliability.
3. **Files/lines:** `src/tests/platformPrintArchitectureCertification.test.ts:74-75`.
4. **Database/table:** Not applicable.
5. **Observed behavior:** Full Vitest run reported 2,346 passed and 1 timeout at the default 5-second limit. Running that file alone with 30 seconds passed all three tests.
6. **Expected behavior:** Suite should produce repeatable results under CI load.
7. **Evidence:** Executed test outputs.
8. **Business impact:** Intermittent CI failure can delay releases or mask real test failures.
9. **Technical impact:** Recursive source scan has variable runtime under full-suite load.
10. **Recommendation:** Optimize the scan or set a justified test-specific timeout after measuring CI performance.
11. **Dependencies/risks:** Avoid globally raising timeouts and hiding genuinely slow regressions.
12. **Confidence:** High.

## Remediation and remaining roadmap

### Stage A — Critical risk elimination

| Change | Why / affected components | Migration? | Compatibility and regression risk | Sequence / acceptance |
|---|---|---|---|---|
| Correct webhook bearer tenant authorization (EA-SEC-03) | Prevent user bearer tokens from selecting an arbitrary tenant; e-commerce webhook dependency, resolver and outbox write. | No. | Existing service-key/HMAC behavior remains; its tenant-binding model needs separate review. | Implemented in working tree: bearer auth now resolves a persisted user ID/role. Focused mocked regression passed; live cross-tenant integration verification remains pending. |
| Protect reversal workflow (EA-SEC-04) | Prevent unauthorized/duplicate loyalty and commission reversals; CGE API/service and ledger. | No schema change; uses existing sales-return reference columns. | Existing callers must supply a completed/processed return ID and matching refund amount. | Implemented in working tree: manager role, return/invoice/status/amount checks, row locking and return-ID replay guard. Mocked role, partial-return, invalid-amount and replay tests passed; database-backed verification pending. |
| Fail-closed tenant context (EA-SEC-01) | Protect all company-scoped APIs; `api/deps.py`. | No. | Legacy users without a valid company identity will now be denied; valid company identities retain existing compatibility behavior. | Implemented in working tree: non-SYSADMIN default removed and empty company context rejected. Mocked missing/empty/legacy-context tests passed; database-backed verification pending. |
| Fail-closed backup selection (EA-DB-01) | Prevent wrong-tenant or Control Plane backup; backup engine. | No. | Backup jobs now fail visibly when the company database cannot be resolved. | Implemented in working tree: target/session fallbacks removed and Control Plane target rejected. Mocked error-path tests passed; database-backed backup verification pending. |
| Classify tracked workbooks (EA-DATA-01) | Protect potential customer/statutory data; repository/data governance. | No DB migration. | Retention/legal requirements and Git history treatment require owner/security approval. | Classify without publishing contents; approve retain/anonymize/remove policy; verify scanner and repository state. |

### Stage B — Architectural corrections

| Change | Why / affected components | Migration? | Compatibility and regression risk | Sequence / acceptance |
|---|---|---|---|---|
| Make Alembic ownership filters symmetric (EA-DB-02) | Prevent target-schema ownership drift; ownership registry and migration environment. | No immediate live migration; future migration only if isolated schema diff proves required. | Existing schemas may intentionally contain copies; reconcile first. | Implemented in working tree using canonical ownership metadata. Control/tenant/shared ownership unit tests passed; isolated autogenerate and live schema verification remain pending. |
| Centralize tenant resolver and request authorization | Avoid divergent routing/legacy defaults across API paths. | No unless registry normalization needed. | Route contract and company-selection flows may change. | Inventory every company header/query dependency; all routes use same authorization/context path. |

### Stage C — Functional completion

| Change | Why / affected components | Migration? | Compatibility and regression risk | Sequence / acceptance |
|---|---|---|---|---|
| Execute purchase, sales, inventory, POS, return and accounting E2E scenarios | Presence in code does not prove complete transaction behavior. | No unless tests expose schema defects. | Use only synthetic isolated data. | Each workflow asserts persisted state, status, stock/payment ledger effects, duplicate retry behavior and audit events. |

### Stage D — UX and standardization

| Change | Why / affected components | Migration? | Compatibility and regression risk | Sequence / acceptance |
|---|---|---|---|---|
| Browser-level navigation/accessibility/error-state review | Visual/runtime UX was not inspected; shared shell and feature modules. | No. | Avoid regressions in POS keyboard flows and layouts. | Approved browser test matrix covers responsive breakpoints, keyboard, screen reader semantics, loading/error/empty states and role visibility. |

### Stage E — Performance and scalability

| Change | Why / affected components | Migration? | Compatibility and regression risk | Sequence / acceptance |
|---|---|---|---|---|
| Measure and capacity-test tenant engine pools, reports and transaction paths | No production performance measurements exist. | Index migration only after plan evidence and approval. | Pool/timeout tuning can affect latency and availability. | Representative catalog/transaction load, concurrency tests and documented SLO thresholds pass across workers/tenants. |
| Use shared rate-limit state or document process-local limits (EA-PERF-01) | Maintain rate limits across workers/replicas. | Possibly infrastructure only. | New dependency/availability path. | Global limit remains within agreed tolerance when requests are distributed across workers. |

### Stage F — Enterprise hardening

| Change | Why / affected components | Migration? | Compatibility and regression risk | Sequence / acceptance |
|---|---|---|---|---|
| Align supported runtime versions and explicit production profile (EA-OPS-01, EA-ARCH-01) | Remove configuration ambiguity and production default risk. | No DB schema migration. | Existing local installs must retain a separate dev profile. | CI, Compose, docs and built images agree; production mode fails closed on missing/weak credentials and is not reachable outside approved ingress. |
| Gate migrations, backup and restore drills (EA-OPS-02) | Ensure controlled upgrades and recoverability. | Requires test DB only for drills. | Startup install behavior must remain available for controlled first-run. | Migration is explicit, reviewed, preflighted; documented rollback/recovery drill restores verified backup successfully. |
| Make the source-tree scan stable (EA-TEST-01) | Remove intermittent CI failure. | No. | Do not weaken its architectural assertion. | Full suite passes repeatedly under normal CI resource limits. |

## Approval gate

No remediation, migration, production-data read, delete, deployment, service restart or Git-history rewrite was performed. Obtain Jawahar's explicit approval before implementing any roadmap item.
