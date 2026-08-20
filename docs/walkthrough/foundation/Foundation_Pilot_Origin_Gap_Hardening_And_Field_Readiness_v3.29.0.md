<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.29.0
  Created      : 2026-08-20
  Modified     : 2026-08-20
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Commercial Pilot Origin-Gap Remediation & Field Readiness (v3.29.0)

**Date:** 2026-08-20  
**Version:** v3.29.0  
**Area:** Foundation / Pilot Operations  
**Status:** Completed & Pushed to Origin  

---

## 1. Purpose
This implementation completes the formal pre-flight hardening, origin-truth verification, multi-database schema synchronization, and operational documentation required for deploying SMRITI Retail OS into commercial pilot operations.

---

## 2. Scope
- **D1 (Version SSOT):** Single source of truth for application version (`APP_VERSION = "3.29.0"`).
- **D2 (Dual-Run Note):** Documented dual-run architecture for `DocumentStudioScreen` vs legacy `SalesStudioTab`/`PurchaseStudioTab`.
- **D3 (Smoke Checklist):** Standardized commercial pilot smoke test protocol (`docs/PILOT_SMOKE_CHECKLIST.md`).
- **D4 (Deny-by-Default RBAC):** Fixed privilege escalation fallback in Fiori Launchpad and navigation resolver (`(role || "SYSADMIN")` removed).
- **D5 (Scope Freeze):** Established formal commercial pilot scope boundary (Section 6 of `docs/PHASE1_PILOT_SUPPORTED_MODULES.md`).
- **D6 (Database Migration Requirement):** Updated `CompanyDatabaseProvisioner` to require `alembic upgrade head` with minimum revision `v1337_backfill_variant_id`.
- **Database Migration:** Discovered and upgraded all operational and control plane databases (`smritisys`, `smriti001`, `smriti_test_fresh`) to Alembic HEAD (`v1338_company_isolated_barcodes`).
- **Runbook:** Authored end-to-end commercial pilot go-live runbook (`docs/PILOT_GO_LIVE_RUNBOOK.md`).

---

## 3. Files Created
1. `docs/PILOT_SMOKE_CHECKLIST.md` — Commercial pilot smoke test checklist with pre-flight gates, Tier A operational paths, and RBAC negative checks.
2. `docs/PILOT_SMOKE_RESULTS.md` — Test execution results matrix recording `GO_SOFTWARE` verdict.
3. `docs/PILOT_DB_MIGRATE_RESULTS.md` — Multi-tenant database discovery, Alembic HEAD status, and variant ID integrity evidence.
4. `docs/PILOT_GO_LIVE_RUNBOOK.md` — Store deployment, operator provisioning, checkout happy path, non-destructive backup/recovery, and emergency escalation procedures.

---

## 4. Files Modified
1. `src/components/launchpad/launchpadCatalog.ts` — Implemented deny-by-default role filtering; added role restrictions to sensitive admin workspaces.
2. `src/components/launchpad/FioriLaunchpad.tsx` — Replaced duplicate role filter with canonical helper; replaced admin fallback with unassigned.
3. `src/App.tsx` — Removed `System Admin` fallback.
4. `src/components/shell/navigationResolver.ts` — Removed `System Admin` fallback.
5. `backend/app/services/company_database_provisioner.py` — Added `alembic_required: True`, `alembic_min_revision: "v1337_backfill_variant_id"`, and `schema_version: "3.29.0"`.
6. `backend/tests/test_company_db_provisioning.py` — Added test asserting Alembic migration head requirement and schema version.
7. `src/tests/fioriLaunchpad.test.ts` — Added test suite asserting deny-by-default behavior for null, undefined, and empty roles.
8. `docs/PHASE1_PILOT_SUPPORTED_MODULES.md` — Appended Section 6 (Pilot Scope Freeze & Production Boundary).

---

## 5. Architecture Decisions
1. **Deny-by-Default Access Control:** If a user session lacks an explicit role or provides an empty string, the system only reveals unrestricted tiles. No fallback elevation to `SYSADMIN` or `System Admin` is permitted.
2. **Dual-Run Coexistence:** Legacy `SalesStudioTab` and `PurchaseStudioTab` remain the active, mounted transaction entry points in `App.tsx` during the pilot. `DocumentStudioScreen` is available in the shell catalog for safe evaluation without risking operational disruption.
3. **Non-Destructive Database Recovery:** Destructive `alembic downgrade` commands are prohibited on live transactional databases. Runbooks mandate binary `pg_dump` snapshots and `pg_restore` clean restorations for rollback.

---

## 6. Design Rationale
- Elevating missing user identities to `SYSADMIN` created a severe privilege escalation vulnerability during transient session or token refresh glitches. Replacing this with deny-by-default ensures fail-safe security.
- Standardizing the Go-Live Runbook ensures store managers and cashiers follow an audit-compliant, deterministic operational routine.

---

## 7. Implementation Summary
- Verified that all 6 deliverable items (D1–D6) exist on `origin/smritiNX`.
- All operational databases are at Alembic HEAD (`v1338_company_isolated_barcodes`) with 0 NULL `variant_id`s in `smriti001`.
- Software dispatch endpoints for barcode printing and cash drawer hooks were validated.
- All test suites (20 Vitest files, 39 Pytest tests, TypeScript linter) pass with 100% success.

---

## 8. Tests Executed
1. `npm run lint` (`tsc --noEmit`) — 0 errors.
2. `npx vitest run` — 20 test files, 128 tests passed.
3. `pytest backend/tests/test_company_db_provisioning.py` — 5/5 tests passed.
4. `pytest backend/tests/ -k "barcode"` — 5/5 router tests passed.
5. `pytest backend/tests/test_e2e_tenant_security_and_routing.py backend/app/tests/test_ecom_connectors.py backend/tests/test_company_control_center_security.py backend/tests/test_company_db_provisioning.py backend/tests/test_indian_number_words.py` — 39/39 tests passed.

---

## 9. Verification Results

```
Pre-flight:                 PASS (0 errors)
Vitest Suite:               PASS (128/128 passed)
Pytest Suite:               PASS (39/39 passed)
Alembic Revision:           PASS (v1338_company_isolated_barcodes - HEAD)
Catalog Variant Integrity:  PASS (0 NULL variant_ids)
Remote Repository Sync:     PASS (Pushed to origin/smritiNX and origin/main)

OVERALL VERDICT: GO_SOFTWARE (Ready for Staging & Store Field Validation)
```

---

## 10. Known Limitations
- Physical thermal barcode label printing over TCP port 9100 and RJ11 physical cash drawer kick pulse require live store station hardware validation (`REQUIRES_HUMAN`).

---

## 11. Future Work
- Conduct live physical station validation on pilot retail hardware.
- Monitor cashier transaction logs during pilot week.
- Schedule Phase 3 full cutover to `DocumentStudioScreen` once commercial pilot volume is stabilized.

---

## 12. Related ADRs
- `ADR-001`: Multi-Tenant PostgreSQL Routing Architecture
- `ADR-014`: Deny-by-Default Role-Based Access Control
- `ADR-022`: Product Identity Variant ID Sequence and Backfill

---

## 13. Related RFCs
- `RFC-034`: Commercial Pilot Supported Module Boundaries & Scope Freeze
- `RFC-039`: Canonical Indian Number Words and Tax Invoice Formatting
