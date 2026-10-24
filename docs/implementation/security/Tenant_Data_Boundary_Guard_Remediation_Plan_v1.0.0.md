<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.73.0
  Created      : 2026-10-13
  Modified     : 2026-10-13
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal Architecture & Security Plan
-->

# Implementation Plan: Tenant Data Boundary (TDB-v2.0) Guard Remediation Plan v1.0.0

## 1. Objective
Remediate the 15 security and architectural violations detected by `scripts/ci_tenant_boundary_guard.py`, eliminating the `smritisys` control plane tenant seeding loop in `scripts/seed_uom.py` and registering all 14 untracked ORM model tables in the canonical `TABLE_OWNERSHIP` contract (`backend/app/db/ownership.py`) under the TDB-v2.0 positive ownership model.

## 2. Business Motivation
In SMRITI Retail OS, the multi-tenant architecture mandates strict physical separation between the Control Plane (`smritisys`) and Tenant Data Planes (`smriti001`, `smriti002`, etc.). If tenant data or operational tables bleed into `smritisys`:
- Tenant isolation is compromised, risking cross-tenant data leaks and statutory audit non-compliance.
- Control plane database migrations become contaminated with transactional tables.
- Automation engines (e.g. `FleetMigrator` and backup engines) cannot deterministically guarantee tenant data privacy.
Achieving a 100% green pass on `ci_tenant_boundary_guard.py` is a mandatory prerequisite before expanding privileged CLI operations or production deployment.

## 3. Scope
- **Violation 1 (`seed_uom.py:12`):** Remove `"smritisys"` from the tenant database seeding loop so UOM master records are seeded exclusively into tenant databases.
- **Violations 2–15 (`TABLE_OWNERSHIP` Registry):** Classify and register the 14 unmapped ORM model tables into `backend/app/db/ownership.py`:
  1. `barcode_print_jobs` (`TableOwner.TENANT`)
  2. `dispatch_batches` (`TableOwner.TENANT`)
  3. `dispatch_batch_invoices` (`TableOwner.TENANT`)
  4. `e_invoices` (`TableOwner.TENANT`)
  5. `e_invoice_batches` (`TableOwner.TENANT`)
  6. `gift_cards` (`TableOwner.TENANT`)
  7. `gift_card_transactions` (`TableOwner.TENANT`)
  8. `gift_vouchers` (`TableOwner.TENANT`)
  9. `goods_receipt_notes` (`TableOwner.TENANT`)
  10. `goods_receipt_lines` (`TableOwner.TENANT`)
  11. `kpi_definitions` (`TableOwner.PLATFORM_TEMPLATE`)
  12. `purchase_bills` (`TableOwner.TENANT`)
  13. `purchase_bill_items` (`TableOwner.TENANT`)
  14. `transaction_idempotency_records` (`TableOwner.TENANT`)
- **Control Plane Scrub Verification:** Validate that `smritisys` contains 0 rows of tenant UOM data using `python -m app.db.cp_guard --fail-on-non-empty`.

## 4. Current State
- `python scripts/ci_tenant_boundary_guard.py` currently exits with code `1`:
  - 10 checks run: 8 passed, 2 failed, with 15 granular violations.
  - Check `smritisys_in_tenant_loops`: Fails due to `seed_uom.py:12`.
  - Check `ownership_declarations_complete`: Fails due to 14 unmapped ORM tables.

## 5. Gap Analysis
| Violation Target | Current Problem | Required Target State |
|---|---|---|
| `scripts/seed_uom.py:12` | Iterates `["smritisys", "smriti001", ...]` | Iterates tenant databases only (e.g. `["smriti001", "smriti002", "smriti003"]`) or queries active tenant registries. |
| `barcode.py:83` | `barcode_print_jobs` missing from `TABLE_OWNERSHIP` | Explicit `TableOwner.TENANT` entry added to `TABLE_OWNERSHIP`. |
| `dispatch_batch.py:37, 100` | `dispatch_batches`, `dispatch_batch_invoices` missing | Explicit `TableOwner.TENANT` entries added. |
| `einvoice.py:23, 48` | `e_invoices`, `e_invoice_batches` missing | Explicit `TableOwner.TENANT` entries added. |
| `gift_cards.py:23, 43, 56` | `gift_cards`, `gift_card_transactions`, `gift_vouchers` missing | Explicit `TableOwner.TENANT` entries added. |
| `goods_receipt.py:43, 118` | `goods_receipt_notes`, `goods_receipt_lines` missing | Explicit `TableOwner.TENANT` entries added. |
| `kpi_definition.py:45` | `kpi_definitions` missing | Explicit `TableOwner.PLATFORM_TEMPLATE` entry added. |
| `purchase.py:208, 237` | `purchase_bills`, `purchase_bill_items` missing | Explicit `TableOwner.TENANT` entries added. |
| `transaction_integrity.py:33` | `transaction_idempotency_records` missing | Explicit `TableOwner.TENANT` entry added. |

## 6. Architecture Impact
- Re-establishes complete AST parity between SQLAlchemy ORM models and the TDB-v2.0 security contract.
- Guarantees that `backend/app/db/cp_guard.py` and `scripts/ci_tenant_boundary_guard.py` cleanly pass in CI preflight gates.
- No schema migrations required (the underlying tables already exist in tenant schemas; this restores the architectural registry classification).

## 7. Proposed Design
1. **Remediate `scripts/seed_uom.py`:**
   - Change target array to exclude `smritisys`.
   - Ensure seeding only applies to verified tenant databases.
2. **Update `backend/app/db/ownership.py`:**
   - Append the 13 `TableOwner.TENANT` tables under their respective domain sections (Invoicing & Dispatch, Hardware & Barcode, Goods Receipt & AP Bills, Gift Vouchers & Loyalty, Idempotency Integrity).
   - Append `kpi_definitions` under `TableOwner.PLATFORM_TEMPLATE` (present as templates in control plane, instantiated per tenant).
3. **Execution & CI Guard Re-run:**
   - Execute `python scripts/ci_tenant_boundary_guard.py`.
   - Execute `python -m app.db.cp_guard --verbose`.

## 8. Files Created
None (Phase 1 planning artifact; implementation only modifies existing files).

## 9. Files Modified
- [`scripts/seed_uom.py`](file:///F:/SMRITRretailNX/scripts/seed_uom.py)
- [`backend/app/db/ownership.py`](file:///F:/SMRITRretailNX/backend/app/db/ownership.py)

## 10. Dependencies
- Python 3.11+ AST parser
- `backend/app/db/ownership.py` TableOwner enumeration

## 11. Risks
- **Risk:** If any unmapped table was accidentally placed in `smritisys`, registering it as `TENANT` will cause `cp_guard.py` to flag an empty/non-empty table violation in the control plane DB.
- **Mitigation:** Inspect physical table existence in `smritisys` prior to commit using `python -m app.db.cp_guard`.

## 12. Rollback Strategy
Git revert of changes to `backend/app/db/ownership.py` and `scripts/seed_uom.py`. The changes are purely declarative and do not drop tables or delete data.

## 13. Verification Plan
1. Run `python scripts/ci_tenant_boundary_guard.py` — MUST exit with code `0` (10/10 checks passed, 0 violations).
2. Run `python scripts/ci_ux_field_governance_guard.py` — MUST pass.
3. Run `python -m app.db.cp_guard` — MUST report `0 forbidden tables in smritisys`.

## 14. Test Plan
- Static AST test: `python scripts/ci_tenant_boundary_guard.py`.
- Runtime DB test: `python -m app.db.cp_guard --fail-on-non-empty`.

## 15. Documentation Impact
- Update `docs/architecture/SMRITI_PLATFORM_IMPLEMENTATION_STATUS.md`.
- Append entry to `docs/walkthrough/README.md` upon completion.
- Document in `CHANGELOG.md`.

## 16. Deployment Plan
Apply changes to development environment, verify AST guard, and sync via Git push.

## 17. Status
Completed.

## 18. Related ADRs
- `ADR-0042`: Positive Table Ownership Registry (TDB-v2.0)
- `ADR-0048`: Elimination of Cross-Database Foreign Keys & Separation of Concerns

## 19. Related Walkthroughs
- `docs/walkthrough/security/Tenant_Data_Boundary_Guard_Remediation_v1.0.0.md`
- `docs/walkthrough/foundation/Sprint39_Universal_Search_Engine_Completion_v1.0.0.md`
