<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.73.3
  Created      : 2026-10-13
  Modified     : 2026-10-13
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Production Release Readiness & Deployment Gate (Phase 8)
-->

# SMRITI Price Revision Production Release Readiness Plan (v1.3.0)

## 1. Objective
Establish an uncompromising, multi-tenant production release readiness gate for the SMRITI Price Revision Module across the control plane (`smritisys`) and tenant databases (`smriti001`–`smriti004`). Ensure that no passing development test is treated as deployment approval, conduct a forensic investigation into prior price book data deletion incidents, enforce database backup verifiability, validate migration safety, and hold production mutations until explicit user authorization.

## 2. Business Motivation
Price revision governance directly protects statutory retail compliance (preventing sales exceeding Maximum Retail Price ceiling under the Legal Metrology Act) and gross margin integrity across retail chains. Releasing unverified code or deploying against a corrupted production price book state would cause billing errors, customer dispute escalation, and tax audit non-compliance.

## 3. Scope
- Full audit of runtime deployment topology, active containers, environment configuration, and PostgreSQL cluster databases.
- Multi-database physical backup creation (`smritisys`, `smriti001`, `smriti002`, `smriti003`, `smriti004`) and readability verification (`pg_restore -l`).
- Forensic investigation into the price-book deletion incident in `smriti001` via PostgreSQL transaction logs, historical dump comparisons, and audit records.
- Validation of Alembic migrations `v1530` and `v1531` across all applicable production tenant schemas.
- Enforcement of server-side authoritative tenant identity boundaries and unconditional test-database isolation guards.
- Comprehensive test suite execution (Pytest, Vitest, TypeScript, Python compilation).
- Production deployment gating with PASS/FAIL/BLOCKED reporting and clear rollback runbooks.

## 4. Current State
- Code implementation of Temporal Price Revision Engine, foreign key hardening, tenant trust boundary guard, and UI studios is complete.
- Unconditional test database guard in `backend/app/db/session.py` prevents automated tests from modifying shared company databases.
- 37/37 Pytest tests and 33/33 Vitest tests pass against isolated test database `smriti_test_price_revisions`.
- Forensic discovery: Ad-hoc execution of `scratch/cleanup.py` at `13:38:19 UTC` deleted all 212 canonical price books and catalog entries in tenant `smriti001`. `smriti001` currently holds 12 synthetic test price books.
- Migrations `v1530` and `v1531` are applied in `smritisys` and `smriti001`, but pending in `smriti002`–`smriti004`.

## 5. Gap Analysis
1. **Price Book Restoration Gap**: `smriti001` lacks its canonical default price list (`pb_cd3f422761ef`, `DEFAULT-COMP-001`). Deploying without restoring canonical price books leaves live POS billing uncalibrated.
2. **Multi-Tenant Migration Parity Gap**: Tenants `smriti002`, `smriti003`, and `smriti004` remain on schema `v1529` without `item_price_revisions` table.
3. **Deployment Clearance Gate**: Production deployment cannot execute automatically without resolving the price-book state and obtaining explicit user authorization.

## 6. Architecture Impact
- **Database Architecture**: Physical tenant databases (`smriti001`–`smriti004`) remain partitioned with dedicated AsyncEngine pools validated via `smritisys.company_database_registries`.
- **Statutory Enforcement**: Invariant `revised_selling_price <= revised_mrp` enforced at both DB level (check constraint) and ORM service level.
- **Audit Immutability**: Historical sales invoices, stock ledgers, and posted documents remain strictly read-only during price adjustments.

## 7. Proposed Design
1. **Gate 1 — Forensic Audit & Incident Reporting**: Expose literal evidence of the deletion query from PostgreSQL logs and historical backups (`smriti001_dr_backup.dump`).
2. **Gate 2 — Verified Cluster Backup**: Execute timestamped `pg_dump -Fc` across `smritisys` and all 4 tenant databases with TOC inspection.
3. **Gate 3 — Release Clearance Gate**: Mark deployment as BLOCKED until user provides explicit authorization to restore canonical price books and roll out migrations to `smriti002`–`smriti004`.
4. **Gate 4 — Multi-Tenant Migration Rollout Runbook**: Apply `v1530` and `v1531` per tenant via versioned Alembic CLI commands once authorized.

## 8. Files Created
- `docs/implementation/pricing/Price_Revision_Production_Release_Readiness_Plan_v1.3.0.md`
- `docs/walkthrough/pricing/Price_Revision_Production_Release_Readiness_v1.3.0.md`
- `F:\SMRITRretailNX\backups\pre_release_20261013_205137\smritisys_20261013_205137.dump`
- `F:\SMRITRretailNX\backups\pre_release_20261013_205137\smriti001_20261013_205137.dump`
- `F:\SMRITRretailNX\backups\pre_release_20261013_205137\smriti002_20261013_205137.dump`
- `F:\SMRITRretailNX\backups\pre_release_20261013_205137\smriti003_20261013_205137.dump`
- `F:\SMRITRretailNX\backups\pre_release_20261013_205137\smriti004_20261013_205137.dump`

## 9. Files Modified
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 10. Dependencies
- PostgreSQL 15 running on port 2781.
- Docker services `smriti-db`, `smriti-api`, `smriti-web`.
- Alembic 1.13+ runtime.
- Python 3.13 virtual environment with FastAPI, SQLAlchemy 2.0, asyncpg.

## 11. Risks
| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Price resolution failure in `smriti001` | High | High | Block deployment until canonical price books are restored from `smriti001_dr_backup.dump`. |
| Migration lock contention during Alembic run | Low | Medium | Execute migrations sequentially per tenant with connection timeouts. |
| Inadvertent test execution targeting live DB | Zero | Critical | Unconditional test isolation guard in `backend/app/db/session.py` blocks any non-`smriti_test_*` target. |

## 12. Rollback Strategy
1. **Database Rollback**: In case of migration failure on `smriti002`–`smriti004`, execute `alembic -x target=tenant -x db=<tenant> downgrade v1529_warehouse_location_zone_and_matrix_enhancements`.
2. **Disaster Recovery**: If table corruption occurs, restore verified timestamped dumps from `F:\SMRITRretailNX\backups\pre_release_20261013_205137\`.
3. **Application Rollback**: Revert `smriti-api` container to previous commit or restart container with preserved environment.

## 13. Verification Plan
- [x] Full PostgreSQL database dump creation and TOC validation.
- [x] Forensic comparison between current `smriti001` and backup `smriti001_dr_backup.dump`.
- [x] Baseline counts of invoices, stock movements, and customers.
- [x] Schema check on foreign key parents (`companies`, `branches`, `items`, `item_variants`, `price_books`).
- [x] Tenant boundary spoofing tests via `test_price_revisions.py`.
- [x] Vitest and TypeScript compilation zero-error validation.

## 14. Test Plan
- Run 37 integration tests in `backend/tests/test_price_revisions.py`.
- Run 33 Vitest pricing and catalog cache tests.
- Verify TypeScript zero-error compilation with `tsc --noEmit`.

## 15. Documentation Impact
- Update `docs/implementation/README.md` with v1.3.0 readiness plan.
- Update `docs/walkthrough/README.md` with v1.3.0 readiness walkthrough.
- Update `CHANGELOG.md` with release audit status.

## 16. Deployment Plan
1. Present production release readiness report with PASS/FAIL/BLOCKED status.
2. Await explicit user authorization.
3. Upon authorization:
   a. Restore canonical price books to `smriti001` from `smriti001_dr_backup.dump`.
   b. Purge 12 synthetic test price books.
   c. Upgrade `smriti002`, `smriti003`, `smriti004` to `v1531`.
   d. Restart `smriti-api` container.
   e. Run live multi-tenant health and pricing smoke checks.

## 17. Status
**BLOCKED** — Initial audit complete. Production deployment on hold pending resolution of `smriti001` price book restoration and user authorization.

## 18. Related ADRs
- ADR-PR-001: Statutory MRP Ceiling Invariant
- ADR-PR-002: Temporal Price Points & Scheduled Activation
- ADR-PR-003: Foreign Key RESTRICT Hardening for Audit Immutability
- ADR-PR-005: Authoritative Server-Side Tenant Boundary
- ADR-PR-006: Unconditional Automated Test Database Isolation

## 19. Related Walkthroughs
- `docs/walkthrough/pricing/MRP_And_Selling_Price_Revision_Engine_v1.0.0.md`
- `docs/walkthrough/pricing/Price_Revision_Security_Hardening_And_Verification_v1.1.0.md`
- `docs/walkthrough/pricing/Price_Revision_Tenant_Trust_Boundary_Audit_v1.2.0.md`
- `docs/walkthrough/pricing/Price_Revision_Production_Release_Readiness_v1.3.0.md`
