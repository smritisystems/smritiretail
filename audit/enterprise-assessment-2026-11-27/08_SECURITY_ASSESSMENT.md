# Security Assessment

## Scope

Read-only static review of security-relevant source/configuration. No penetration tests, parameter tampering, live API calls, credential use, production database inspection or external requests were performed. Sensitive local `.env` content and tracked workbook contents were not opened.

The delegated security reviewer clarified that its first response covered only a diff and was not a full-repository review. It then performed a bounded static scan of `deps.py`, `session.py`, `company_router.py`, auth context switching and selected routes (`ecom.py`, `cge_unified.py`, `pdt.py`, `psv.py`, `grn.py`, `capability_registry.py`). It reported two high-confidence issues below. The scan was not exhaustive and no dynamic tests or production databases were used.

## Approved remediation status

After the assessment, the user authorized code changes for EA-SEC-01, EA-SEC-03, EA-SEC-04, EA-DB-01 and EA-DB-02. Source changes and focused regression tests are present in the working tree. Twelve focused regression test functions were directly executed with mocked sessions/dependencies and passed. The database-backed backend suite was not run because its fixtures require an explicitly configured isolated PostgreSQL environment; no production database or migration was used.

## Security-review summary table

| # | Severity | File | Lines | Vulnerability | Confidence |
|---|----------|------|-------|---------------|------------|
| 1 | 🟠 HIGH | `backend/app/api/v1/ecom.py` | 133-139, 175-180, 264-310 | Webhook accepts a bearer JWT then resolves tenant access as `SYSADMIN`, allowing the supplied `X-Company-ID` to select the destination tenant for outbox writes. | 10/10 |
| 2 | 🟡 MEDIUM | `backend/app/api/v1/cge_unified.py` | 70-82 | Authenticated user can request loyalty/commission reversals without a role check, refund validation or idempotency protection. | 9/10 |
| 3 | 🟡 MEDIUM | `backend/app/api/deps.py` | 229-257 | Conditional company-assignment enforcement and a `COMP-001` fallback may allow a user with no company identity/assignment records into the default tenant. Static-only; not exercised. | 7/10 |
| 4 | 🟡 MEDIUM | `src/lib/apiFetchV1.ts` | 155-160, 209-212 | Access/refresh tokens are stored in JavaScript-readable local storage/cookies, increasing impact if an XSS exists. No XSS was demonstrated. | 8/10 |

## Security controls observed

- JWT decode/expiry validation and password hashing helpers are present.
- Current-user and tenant dependencies exist; company access checks include user assignments.
- Company database names are validated and registry status must be `READY`.
- A table ownership registry and Control Plane boundary guard exist.
- Production configuration contains checks for JWT/internal keys and default PostgreSQL passwords when `ENVIRONMENT` is production.
- Rate limiting is wired when `slowapi` is available; local frontend storage and API middleware include session handling.

## Risks to resolve

### EA-SEC-03 — Webhook tenant authorization bypass (P1)

The reviewer observed that the webhook dependency accepted a decoded bearer JWT and then invoked company resolution using a hard-coded `SYSADMIN` role. The resolver consequently bypassed user/company assignment checks. The request-provided `X-Company-ID` selected a tenant destination, and the webhook wrote its payload to that tenant's `integration_outbox_events` table and committed. This was static source evidence; no endpoint was called.

**Working-tree remediation:** bearer credentials are now resolved to an active persisted user and the resolver receives that user's ID and database role rather than `SYSADMIN`. Existing service-key/HMAC ingress behavior was intentionally preserved. The focused regression test passed with mocked user/resolver/session dependencies; it did not exercise a live tenant database. Service-key/HMAC tenant binding remains dependent on the existing integration-secret model and was not redesigned in this change.

### EA-SEC-04 — Unprivileged, non-idempotent financial reversals (P2)

The reviewer observed that `POST /cge-unified/reversals` required authentication but lacked role/permission checks. The service reversed earned loyalty/commission and committed without verifying a refund; repeated calls could create repeated reversals. The request's refund amount was not used for authorization. No mutation was performed.

**Working-tree remediation:** the route now requires the manager role hierarchy and passes the validated tenant context to the service. Requests identify a company-owned completed/processed sales return, match its original posted/paid invoice and exact return total, and store the return ID on reversal ledger entries. The service locks the return row, detects both new and legacy invoice reversals, and returns a stable duplicate response for repeat requests; partial-return ledger values are prorated to the verified return amount. Mocked partial-return, invalid-amount, replay, tenant-routing and role-denial regression tests passed. The database-backed workflow test was not run. No migration was added.

### EA-SEC-01 — Default company context when identity/assignments are absent (P1, static-only)

`get_tenant_context()` previously fell back to `COMP-001` when a non-SYSADMIN had no usable target/company ID. The fallback is removed for non-SYSADMIN users, and `get_company_db()` now rejects an empty company context. Existing legacy users with a valid company identity continue through the existing assignment-compatibility behavior. Missing-identity, empty-context and legacy-identity regression tests passed with mocked database results. The separate policy question of requiring assignment rows for every legacy user with a valid company identity remains outside this remediation.

### EA-SEC-02 — Browser token storage (P2)

**Remediated in the working tree:** Browser login, refresh, and tenant-switch flows now receive server-set `HttpOnly`, `SameSite=Lax` access/refresh cookies (with `Secure` enabled outside development/test), and no bearer credentials in their JSON response. The frontend no longer persists bearer credentials and sends a double-submit CSRF header for cookie-authenticated writes; the backend also checks the request origin. Non-browser bearer-token API clients retain their existing response contract. Legacy browser token storage/cookies are purged during startup. Focused frontend and backend regression tests were added; database-backed backend auth tests were not run in this environment.

The assessment did not demonstrate an XSS vulnerability. Cross-origin browser deployments must configure their UI origin in `ALLOWED_ORIGINS`.

### EA-OPS-01 — Runtime environment can default to development (P2)

Compose does not explicitly set the backend `ENVIRONMENT`; application settings default to `"development"`. Compose also provides a `postgres` fallback password and exposes API port `1981` without binding it to loopback. `config.py` rejects weak database passwords only when environment is production. The actual deployment's environment overrides were not read. Production should set mode explicitly and fail startup if the intended secure mode is absent.

### EA-DATA-01 — Tracked financial/customer workbooks (P1, content unverified)

Git tracks spreadsheet artifacts whose filenames indicate client details and tax invoices. The workbooks were deliberately not opened, so contents and any actual personal data are unverified. Treat as potential sensitive-data exposure until classified; use approved repository retention/secret-scanning processes.

### EA-DB-01 — Backup target fallback (P1)

The original implementation caught target-resolution errors and returned `smriti001`; session acquisition could also fall back to the default session. Both fallbacks are removed in the working tree. Target-resolution errors now propagate, and a Control Plane target is rejected. Mocked tests for lookup failure and Control Plane rejection passed.

### EA-DB-02 — Asymmetric migration ownership filter (P2)

The original Alembic filter excluded tenant-owned tables for Control Plane targets but did not symmetrically exclude Control Plane-only tables for tenant targets. `include_object()` now applies both exclusions through the canonical ownership helper while leaving shared-reference and platform-template ownership unchanged. Target-scope unit tests passed; live schema drift and autogenerate behavior remain unverified.

## Remaining security tests not executed

- Cross-company access with altered IDs/headers/query parameters (including webhook auth-bypass scenarios).
- AuthN/AuthZ/RBAC integration matrix, including absent assignments and deactivated users.
- SQL injection, XSS, CSRF, upload/path traversal, CORS and rate-limit behavior.
- Production cookie/TLS/session configuration.
- Database role/permission and backup encryption checks.
- Dependency vulnerability scanning.

## Disposition

**Security score: 2.5/10 (baseline assessment).** The score predates the working-tree remediation above and is not recalculated without executing the regression suite and validating the deployed configuration. Token storage, potential workbook data classification, production configuration and the unreviewed routes remain open; this bounded review does not certify the deployed system.
