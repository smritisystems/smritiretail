# SMRITI Retail OS — Executive Assessment

**Assessment date:** 2026-11-27  
**Repository:** `smritisystems/smritiretail`, branch `smritiNX`  
**Assessment mode:** Read-only, repository and local test evidence only  
**Overall readiness:** **4.6 / 10 — not production-certified**

## Assessment status

The source-level assessment and requested reports are complete to the extent evidence was locally accessible. This is **not** a complete operational certification: no live Control Plane or company database was accessed, no API or deployed application was exercised, and no tenant-isolation request was sent. The database, deployment, runtime, recovery and end-to-end findings therefore remain unverified.

The worktree was already substantially modified and contained untracked migration, test, application and data files when this assessment began. Findings describe the current working tree, not a clean commit. Assessment reports are the only files added for this task; no application code, schema, configuration or data was changed.

## Overall condition

The repository contains substantial, broad retail functionality: a React/TypeScript application, a FastAPI backend, explicit Control Plane/tenant routing components, many domain services and migration/test assets. There is meaningful investment in tenant boundary ownership, guarded migration workflows, secret validation and frontend regression tests.

However, implementation breadth is not equivalent to verified operation. The multi-database contract is documented and represented in code, but actual database inventories, deployed schema parity, tenant-by-tenant routing, transactional outcomes, cross-company isolation, backup restores and production performance were not established. Several source-level fail-open/default behaviors and operational configuration ambiguities need resolution before enterprise production approval.

## Major strengths

- Clear intended split between `smritisys` Control Plane and company operational databases.
- Explicit database-name registration checks, a canonical table ownership registry, tenant context dependencies and migration-scope tooling.
- Domain-oriented API, service, model, schema and React component structures across procurement, sales, POS, inventory, CRM, finance and integrations.
- Production secret validation exists in configuration code; Docker Compose requires several application secrets to be supplied.
- Frontend type-check completed successfully; 2,346 of 2,347 tests passed in the full Vitest run, with the remaining timeout passing when run alone.

## Critical/high-priority findings

| ID | Severity | Summary |
|---|---|---|
| EA-SEC-01 | P1 — High | Non-SYSADMIN fallback to `COMP-001` and empty `get_company_db` context are fixed in the working tree; mocked missing/empty/legacy identity tests passed. |
| EA-SEC-03 | P1 — High | Bearer webhook routing now uses the authenticated persisted user's ID/role instead of hard-coded `SYSADMIN`; focused mocked regression passed. Existing service-key/HMAC path is preserved. |
| EA-DB-01 | P1 — High | Backup target/session fallbacks are removed and Control Plane targets rejected; focused mocked failure-path tests passed. |
| EA-DATA-01 | P1 — High | Version control tracks spreadsheet artifacts named as client details/tax invoices. Contents were deliberately not opened; classification and access controls are required. |
| EA-SEC-04 | P2 — Medium | Manager-role enforcement, completed-return/invoice/refund validation and replay protection are implemented in the working tree; focused mocked tests passed. |
| EA-OPS-01 | P2 — Medium | Compose does not explicitly set `ENVIRONMENT`; the app defaults to development, while Compose also contains a `postgres` password default and publishes the API port without a loopback bind. Actual deployment overrides were not inspected. |
| EA-DB-02 | P2 — Medium | Alembic target filtering now symmetrically excludes Control Plane-only and tenant-only tables via canonical ownership metadata; unit tests passed. Live schema impact remains unverified. |
| EA-SEC-02 | P2 — Medium | Remediated in the working tree: browser authentication uses server-set HttpOnly cookies with CSRF/origin checks; bearer API response compatibility is retained. Focused tests were added; database-backed auth tests remain unrun. |

The complete evidence, impact, expected behavior, remediation, dependencies and risk classification are in [13_RISK_REGISTER_REMEDIATION_ROADMAP.md](./13_RISK_REGISTER_REMEDIATION_ROADMAP.md). No P0 finding was confirmed from available evidence.

## Enterprise readiness scorecard

Scores are conservative source-level assessments. They are not measurements of deployed database health or application availability.

| Category | Score |
|---|---:|
| Overall Architecture | 5.5 / 10 |
| Control Plane Architecture | 5.0 / 10 |
| Company Database Architecture | 5.0 / 10 |
| Database Integrity | 3.5 / 10 |
| Backend Engineering | 5.0 / 10 |
| Frontend Engineering | 6.0 / 10 |
| UX Consistency | 5.0 / 10 |
| Business Workflow Completeness | 4.5 / 10 |
| Security | 2.5 / 10 |
| Performance | 3.5 / 10 |
| Scalability | 4.0 / 10 |
| Infrastructure | 4.0 / 10 |
| Testing | 5.5 / 10 |
| Maintainability | 4.5 / 10 |
| Production Readiness | 3.5 / 10 |

**Overall score: 4.6 / 10.** The limiting factors are lack of live database and runtime evidence, high-risk tenant authorization/backup behavior, ambiguous release configuration and unverified end-to-end business transactions.

## Inspected and not inspected

Inspected: repository layout and worktree state; README and architecture/module documentation; Compose and container startup files; FastAPI application/router registration; representative auth, tenant, purchase, POS/PSV/PDT, backup, configuration, migration and ORM ownership code; frontend shell/API clients; package/test configuration; test and type-check results. A delegated static security scan additionally examined tenant-routing and selected e-commerce/CGE routes.

Not accessed: PostgreSQL or MSSQL service instances, `smritisys` or any `Smritibus_<CompanyCode>` database, production environment variables, live API/UI, real user sessions, deployed integrations, production logs/metrics, backup objects, restore targets, cloud account/tunnel configuration or customer spreadsheet contents.

## Recommended immediate actions

1. Run the added backend regression tests in an explicitly isolated PostgreSQL test environment; no DB-backed suite was run during this remediation.
2. Classify tracked spreadsheet artifacts without printing or copying their contents; handle any customer data under the organization's approved data-retention process.
3. Confirm production Compose environment and secret injection, host-port exposure, image versions and migration gate.
4. Reconcile Control Plane/tenant ownership and validate the Alembic graph against a disposable, approved PostgreSQL environment.
5. Obtain approval and access to a dedicated test database before backend migration/integration tests; then execute tenant-boundary, workflow, backup/restore and schema-drift verification.

The user explicitly approved changes for EA-SEC-01, EA-SEC-03, EA-SEC-04, EA-DB-01 and EA-DB-02. Source changes and focused tests are present in the working tree; tests and live/deployed verification remain pending. No production database, migration or live endpoint was accessed.
