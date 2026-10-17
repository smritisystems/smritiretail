<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.99.0
  Created      : 2026-10-17
  Modified     : 2026-10-17
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal Architecture & Security Walkthrough
-->

# Tenant Data Boundary (TDB-v2.0) Guard Remediation Walkthrough v1.0.0

## 1. Purpose
This walkthrough documents the full remediation of the 22 tenant data boundary violations detected by `scripts/ci_tenant_boundary_guard.py` and `backend/app/db/cp_guard.py`. It establishes 100% AST parity and positive table ownership declarations across all canonical SQLAlchemy ORM models, and ensures the control plane database (`smritisys`) is never targeted by tenant master data seed loops.

## 2. Scope
- **Tenant Seeding Loop Remediation (`scripts/seed_uom.py`):** Eliminated `"smritisys"` from the tenant loop iteration, ensuring UOM master values are seeded strictly into tenant company databases (`smriti001`, `smriti002`, `smriti003`).
- **Canonical Table Ownership Registration (`backend/app/db/ownership.py`):** Classified and registered 21 untracked ORM model tables:
  - 20 Tenant-owned tables (`TableOwner.TENANT`):
    - `gift_cards`, `gift_card_transactions`, `gift_vouchers` (Loyalty & CRM Operational)
    - `item_price_revisions` (Item Catalog & Pricing)
    - `dispatch_batches`, `dispatch_batch_invoices` (Warehouses & Logistics)
    - `goods_receipt_notes`, `goods_receipt_lines` (Procurement & Inward)
    - `purchase_bills`, `purchase_bill_items` (Procurement & AP)
    - `purchase_requisitions`, `purchase_requisition_items` (Procurement Phase 2)
    - `supplier_rfqs`, `supplier_rfq_items` (Procurement Phase 2)
    - `supplier_quotations`, `supplier_quotation_items` (Procurement Phase 2)
    - `e_invoices`, `e_invoice_batches` (GST & Compliance)
    - `barcode_print_jobs` (Barcode & Label Printing)
    - `transaction_idempotency_records` (Security & Idempotency Integrity)
  - 1 Platform template table (`TableOwner.PLATFORM_TEMPLATE`):
    - `kpi_definitions` (Governance & Executive Analytics)

## 3. Files Created
- [`docs/walkthrough/security/Tenant_Data_Boundary_Guard_Remediation_v1.0.0.md`](file:///f:/SMRITRretailNX/docs/walkthrough/security/Tenant_Data_Boundary_Guard_Remediation_v1.0.0.md)

## 4. Files Modified
- [`scripts/seed_uom.py`](file:///f:/SMRITRretailNX/scripts/seed_uom.py) — Removed `smritisys` from target database loop; added standard UADHP header.
- [`backend/app/db/ownership.py`](file:///f:/SMRITRretailNX/backend/app/db/ownership.py) — Declared 21 model tables in `TABLE_OWNERSHIP`; updated header metadata.
- [`docs/implementation/security/Tenant_Data_Boundary_Guard_Remediation_Plan_v1.0.0.md`](file:///f:/SMRITRretailNX/docs/implementation/security/Tenant_Data_Boundary_Guard_Remediation_Plan_v1.0.0.md) — Marked status as Completed and referenced walkthrough.
- [`docs/implementation/README.md`](file:///f:/SMRITRretailNX/docs/implementation/README.md) — Updated master implementation plan index.
- [`docs/walkthrough/README.md`](file:///f:/SMRITRretailNX/docs/walkthrough/README.md) — Appended walkthrough record to master index.
- [`CHANGELOG.md`](file:///f:/SMRITRretailNX/CHANGELOG.md) — Logged security governance remediation.
- [`RELEASE_NOTES.md`](file:///f:/SMRITRretailNX/RELEASE_NOTES.md) — Documented release note for v6.99.0.

## 5. Architecture Decisions
- **AD-TDB-01: Positive Ownership Model Enforcement**: Under TDB-v2.0 (`ADR-0042`), every table must have an explicit declaration. Unmapped tables fail CI immediately, preventing silent data pollution.
- **AD-TDB-02: Control Plane Strict Physical Isolation**: `smritisys` contains only governance, routing, identity, and template metadata. Operational and transactional tables (`TableOwner.TENANT`) are strictly forbidden in `smritisys`.

## 6. Design Rationale
- Declarative registration in `backend/app/db/ownership.py` serves as the authoritative Single Source of Truth (SSOT). All migrations, CI guards, and runtime session routers derive their authorization sets from `TABLE_OWNERSHIP`.
- Removing `smritisys` from `seed_uom.py` prevents accidental insertion of tenant UOM master values into the control plane database during local or automated bootstrap.

## 7. Implementation Summary
- `scripts/seed_uom.py`:
  - Updated loop from `["smritisys", "smriti001", "smriti002", "smriti003"]` to `["smriti001", "smriti002", "smriti003"]`.
- `backend/app/db/ownership.py`:
  - Added 20 operational tables to `TABLE_OWNERSHIP` as `TableOwner.TENANT`.
  - Added `kpi_definitions` as `TableOwner.PLATFORM_TEMPLATE`.
  - Maintained zero set overlap invariants enforced by `assert_no_overlap()`.

## 8. Tests Executed
1. `scripts/ci_tenant_boundary_guard.py`:
   - Executed full 10-check static analysis suite.
2. `backend/app/db/cp_guard.py`:
   - Inspected live PostgreSQL `smritisys` database schema and validated 0 undeclared tables.
3. `scripts/ci_ux_field_governance_guard.py`:
   - Validated zero-drift across canonical field registry and physical DB schemas.
4. `npm run architecture:check`:
   - Verified 11 pre-commit CI architecture gates.

## 9. Verification Results
- `ci_tenant_boundary_guard.py`: **10/10 Passed, 0 Violations**.
- `cp_guard.py`: **0 Undeclared Tables**.
- `ci_ux_field_governance_guard.py`: **Passed (0 Critical/Error Violations)**.
- `architecture:check`: **11/11 Passed, 0 Violations**.

## 10. Known Limitations
- Historical empty tenant tables present in local dev `smritisys` database from legacy un-split migrations remain tracked as schema debt, scheduled for disposition in a dedicated CP cleanup script.

## 11. Future Work
- Execute automated control plane cleanup script (`scripts/cleanup_control_plane.py`) in staging environments to drop legacy unpopulated tenant table shells from `smritisys`.

## 12. Related ADRs
- `ADR-0042`: Positive Table Ownership Registry (TDB-v2.0)
- `ADR-0048`: Elimination of Cross-Database Foreign Keys & Separation of Concerns

## 13. Related RFCs
- `RFC-0088`: Control Plane Tenant Boundary Enforcement
