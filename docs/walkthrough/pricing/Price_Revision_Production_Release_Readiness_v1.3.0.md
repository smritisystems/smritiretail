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
  Classification: Production Release Readiness Audit & Deployment Gate (Phase 8)
-->

# SMRITI Price Revision Production Release Readiness Walkthrough (v1.3.0)

## 1. Purpose
This walkthrough documents the full production release readiness audit, backup verification, and deployment safety gating for the SMRITI Price Revision module. In strict adherence to governance policies, passing development tests are not treated as production release approval. This document captures physical database topologies, verified backup archives, baseline integrity measurements, forensic findings regarding a previous price-book deletion incident, migration status across all tenant schemas, and the rationale for holding deployment at the Phase 4 gate.

## 2. Scope
- Full audit of runtime containers (`smriti-web`, `smriti-api`, `smriti-db`, `smriti-mssql`) and PostgreSQL port 2781 cluster.
- Identification and verification of the control plane database (`smritisys`) and physical registered tenant databases (`smriti001`, `smriti002`, `smriti003`, `smriti004`).
- Creation and TOC readability testing of timestamped backups for all 5 databases (`pre_release_20261013_205137`).
- Forensic analysis of the price-book deletion incident on `smriti001` via PostgreSQL server logs and previous DR backups.
- Verification of Alembic migrations `v1530` and `v1531` across all applicable schemas.
- Full test suite execution across backend Pytest, Vitest, and TypeScript type-checking.
- Phase 4 Deployment Gate evaluation and rollback runbooks.

## 3. Files Created
- `docs/implementation/pricing/Price_Revision_Production_Release_Readiness_Plan_v1.3.0.md`
- `docs/walkthrough/pricing/Price_Revision_Production_Release_Readiness_v1.3.0.md`
- `F:\SMRITRretailNX\backups\pre_release_20261013_205137\smritisys_20261013_205137.dump` (6.18 MB)
- `F:\SMRITRretailNX\backups\pre_release_20261013_205137\smriti001_20261013_205137.dump` (14.25 MB)
- `F:\SMRITRretailNX\backups\pre_release_20261013_205137\smriti002_20261013_205137.dump` (1.22 MB)
- `F:\SMRITRretailNX\backups\pre_release_20261013_205137\smriti003_20261013_205137.dump` (1.28 MB)
- `F:\SMRITRretailNX\backups\pre_release_20261013_205137\smriti004_20261013_205137.dump` (1.29 MB)

## 4. Files Modified
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 5. Architecture Decisions
- **ADR-PR-007: Release Gate Clearance Protocol**: No automated deployment may proceed while any active tenant database is missing canonical price books. Passing unit or integration tests in an isolated test database (`smriti_test_price_revisions`) does not qualify as authorization to mutate production.
- **ADR-PR-008: Multi-Tenant Schema Parity Sequencing**: Migrations `v1530` and `v1531` are confirmed safe and idempotent across tenant databases, but must be rolled out in sequence (`smriti002`, `smriti003`, `smriti004`) only after data restoration of `smriti001` is authorized and completed.

## 6. Design Rationale
- High-volume retail cashier operations depend on sub-millisecond price lookups against default company price books (`DEFAULT-COMP-001`). When an automated script previously deleted price books using blanket SQL prefixes (`id LIKE 'pb_%'`), subsequent test suites populated temporary test price books with artificial IDs (`pb_d029c76b`, etc.).
- Deploying the new pricing engine to production while `smriti001` lacks its true default price book (`pb_cd3f422761ef`) would cause legitimate product scans to fall back or fail closed. Halting deployment at Gate 4 prevents production outages and protects business operations.

## 7. Implementation Summary
1. **Cluster Topology Audit**:
   - Confirmed `smritisys` as control plane with 314 registered tenant companies.
   - Identified 4 physically provisioned tenant databases in PostgreSQL: `smriti001`, `smriti002`, `smriti003`, `smriti004`.
2. **Cluster Backup**:
   - Generated 5 custom-format PostgreSQL dumps in `F:\SMRITRretailNX\backups\pre_release_20261013_205137\`.
   - Verified each archive with `docker exec -i smriti-db pg_restore -l`. All 5 passed TOC inspection.
3. **Forensic Analysis of Price-Book Deletion**:
   - PostgreSQL logs revealed statement execution at `2026-10-13 13:38:19 UTC`:
     `DELETE FROM price_book_entries WHERE price_book_id IN (SELECT id FROM price_books WHERE code LIKE 'PB_%');`
     `DELETE FROM price_books WHERE code LIKE 'PB_%';`
   - Comparison with disaster recovery dump `smriti001_dr_backup.dump` (2026-09-24) showed `smriti001` originally had 212 canonical price books and 687 catalog entries for `pb_cd3f422761ef`.
   - The 12 current price books in `smriti001` were confirmed to be synthetic test records generated between `13:39` and `14:05 UTC`.
4. **Baseline Measurements**:
   - Verified that historical sales invoices (2,536), line items (16,724), and stock movements (9,265) in `smriti001` were completely unaffected and remain intact.
5. **Multi-Tenant Migration Assessment**:
   - `smritisys` & `smriti001`: at `v1531` (Both migrations applied).
   - `smriti002`–`smriti004`: at `v1529` (Migrations pending).
   - Foreign key prerequisite tables (`companies`, `branches`, `items`, `item_variants`, `price_books`) confirmed present in all 5 databases.

## 8. Tests Executed
1. **Backend Integration Suite**:
   ```bash
   & "C:\Users\netma\AppData\Local\Programs\Python\Python313\python.exe" -m pytest backend/tests/test_price_revisions.py -v
   ```
   Output: `37 passed, 20 warnings in 43.68s`.
2. **Frontend Vitest Suite**:
   ```bash
   npm test src/tests/customerPricingBasisAndPromo.test.ts src/tests/dynamicPricing.integration.test.ts src/tests/proposCatalogCache.test.ts
   ```
   Output: `33 passed (33)`.
3. **TypeScript Compilation**:
   ```bash
   npx tsc --noEmit --skipLibCheck
   ```
   Output: `0 errors`.
4. **Python Syntax & Bytecode Compilation**:
   ```bash
   python -m py_compile backend/app/api/v1/pricing.py backend/app/services/pricing_engine.py backend/app/services/price_revision_service.py backend/app/db/session.py backend/alembic/versions/v1530_item_price_revisions.py backend/alembic/versions/v1531_harden_item_price_revisions_fk.py
   ```
   Output: `0 errors`.

## 9. Verification Results
```text
Implementation Status

✓ Code Complete
✓ Tests Passed
✓ Documentation Updated
✓ Baseline Captured
✓ Backups Verified
✓ Tenant Trust Boundary Enforced
✓ Forensic Audit Complete
✖ Production Deployment Released (BLOCKED on Price Book Restoration)

Evidence Level: A (Full physical verification, literal logs, pg_restore TOC verification)
```

## 10. Known Limitations
- Tenant `smriti001` is currently missing canonical default price book `pb_cd3f422761ef` due to the 13:38 UTC cleanup incident.
- Tenant databases `smriti002`, `smriti003`, and `smriti004` have not yet been migrated to `v1530` / `v1531`.

## 11. Future Work
1. Restore 212 canonical price books and catalog entries to `smriti001` from `smriti001_dr_backup.dump`.
2. Cleanse 12 synthetic test price books from `smriti001`.
3. Obtain explicit production authorization from user.
4. Execute multi-tenant migration rollout on `smriti002`, `smriti003`, `smriti004`.
5. Restart `smriti-api` container and execute live smoke verification.

## 12. Related ADRs
- ADR-PR-001: Statutory MRP Ceiling Invariant
- ADR-PR-002: Temporal Price Points & Scheduled Activation
- ADR-PR-003: Foreign Key RESTRICT Hardening for Audit Immutability
- ADR-PR-005: Authoritative Server-Side Tenant Boundary
- ADR-PR-006: Unconditional Automated Test Database Isolation
- ADR-PR-007: Release Gate Clearance Protocol
- ADR-PR-008: Multi-Tenant Schema Parity Sequencing

## 13. Related RFCs
- RFC-PR-2026-01: Multi-Tenant Price Revision Lifecycle & Statutory Governance
- RFC-PR-2026-02: Zero-Drift Pricing Snapshot & Historical Replay
