<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS

  Founders

  * Pushpa Devi Jawahar Mallah
    * Founder & Chairperson
    * Phone: +91 9324117007
    * Email: founder@aitdl.com

  * Jawahar Ramkripal Mallah
    * Founder, Chief Executive Officer (CEO) & Chief Software Architect
    * Email: founder@aitdl.com

  * Websites: aitdl.com | erpnbook.com | smritibooks.com

  * Version    : 4.16.0
  * Created    : 2026-09-10
  * Modified   : 2026-09-10
  * Copyright  : © SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
  * Classification: Internal
-->

# Walkthrough: Warehouse & Godown Domain Canonical Unification & Statutory Validation Convergence

**Module Area:** Inventory / WMS / Masters / POS  
**Version:** v4.16.0  
**Status:** Completed  
**Verification Level:** Level A (Direct Executable Terminal Output & Database AST Parity)

---

## 1. Purpose
This implementation performs an exhaustive forensic audit, architectural reconciliation, and code hardening of the Warehouse and Godown domain in SMRITI Retail OS. It reconciles empirical database realities against previous audit assertions, enforces statutory Indian postal PIN code and GST state validations across warehouse creation and updates, unifies dual warehouse schema contracts (`schemas/wms.py` vs `schemas/masters_tier2.py`), and introduces formal referential integrity linking POS cash registers (`cash_registers.warehouse_id`) to warehouses (`warehouses.id`) with complete Alembic migration lineage.

---

## 2. Scope
- **Forensic Audit & Fact Verification:**
  - Verified presence of table `public.stores` in PostgreSQL database `smriti001` (refuting claims that it was missing; 17 columns present, matching SQLAlchemy model `inventory.py:Store`).
  - Audited 81 rows of warehouses titled "Central Warehouse" and determined they belong to 81 distinct transient multi-tenant test suites (`comp-sal-*`), while production tenant `COMP-001` (Tattly Threads) holds exactly one central godown.
  - Audited warehouse address, city, state, and PIN code compliance across all active warehouses under `COMP-001`, confirming 100% compliance for active dispatch depots (Nagpur `wh-ngp-001` PIN `440029`, Mumbai `wh-mum-001` PIN `400001`, Central `wh-central-001` PIN `400001`).
- **Pydantic Validation Hardening:**
  - Added strict 6-digit Indian PIN regex validation (`^[0-9]{6}$`) in `WarehouseBase`.
  - Added GST State Code normalization and validation in `WarehouseBase` (accepting numeric state codes like `"27"`, formatted strings like `"27 - Maharashtra"`, or canonical state names like `"Maharashtra"`).
  - Unified `backend/app/schemas/masters_tier2.py` warehouse schemas to inherit directly from `WarehouseBase` to guarantee uniform validation across `/api/v1/wms/warehouses` and `/api/v1/masters/warehouses`.
- **API Persistence Alignment:**
  - Updated `backend/app/api/v1/masters.py` warehouse create/update endpoints to persist address, city, state, pincode, contact person, phone, and `is_central_godown`.
- **Referential Integrity & Alembic Lineage:**
  - Added `warehouse_id` foreign key (`warehouses.id`, `ondelete="SET NULL"`) and `warehouse_rel` relationship on SQLAlchemy model `CashRegister` (`backend/app/models/pos.py`).
  - Added `warehouse_id` to Pydantic schemas `CashRegisterCreate` and `CashRegisterResponse`.
  - Authored Alembic migration `backend/alembic/versions/v1420_cash_registers_warehouse_id.py` revising `v1419_dispatch_from`.
  - Executed DDL on live database `smriti001` and backfilled existing registers.

---

## 3. Files Created
1. `backend/alembic/versions/v1420_cash_registers_warehouse_id.py`: Alembic migration script adding `warehouse_id` foreign key and index to `cash_registers`.
2. `backend/tests/test_warehouse_validation.py`: Unit and contract test suite verifying pincode regex, GST state validation, tier-2 inheritance, and cash register foreign key structure.
3. `docs/walkthrough/inventory/Warehouse_Domain_Canonical_Unification_v4.16.0.md`: This comprehensive walkthrough document.

---

## 4. Files Modified
1. `backend/app/schemas/wms.py`: Added field validators for 6-digit PIN code and GST state normalization.
2. `backend/app/schemas/masters_tier2.py`: Re-based `WarehouseCreate`, `WarehouseUpdate`, and `WarehouseResponse` onto `WarehouseBase`.
3. `backend/app/api/v1/masters.py`: Updated `masters.py` warehouse handler to persist address, city, state, pincode, contact person, phone, and `is_central_godown`.
4. `backend/app/models/pos.py`: Added `warehouse_id` foreign key column and `warehouse_rel` relationship to `CashRegister`.
5. `backend/app/schemas/pos.py`: Added `warehouse_id` to `CashRegisterCreate` and `CashRegisterResponse`.
6. `docs/walkthrough/README.md`: Appended entry to master walkthrough index.

---

## 5. Architecture Decisions
1. **Pydantic Inheritance over Code Duplication (DRY):**
   Instead of maintaining separate Pydantic definitions in `schemas/masters_tier2.py` and `schemas/wms.py`, `masters_tier2.py` imports and subclasses `wms.WarehouseBase`. This guarantees single-point-of-truth validation across all warehouse ingestion routes.
2. **Backward Compatibility on `cash_registers`:**
   Retained the legacy `warehouse` string column alongside `warehouse_id` foreign key. Existing code reading `reg.warehouse` continues uninterrupted, while new code and migrations bind cleanly to `reg.warehouse_id`.
3. **Multi-Tenant Test Artifact Isolation:**
   Multi-tenant automated test fixtures generate transient tenants (`comp-sal-*`). The audit demonstrated that `is_deleted=false` and company tenant filtering must always be respected to prevent test fixtures from being misclassified as production data corruption.

---

## 6. Design Rationale
In GST-compliant ERP systems, a dispatch warehouse or godown is the statutory *Place of Dispatch* (distinct from *Place of Supply*). An invalid or truncated PIN code causes immediate rejection by government E-Way Bill and E-Invoice portals. By enforcing Indian postal 6-digit regex and canonical GST state matching at the Pydantic schema layer, invalid data is rejected before hitting the database or invoice generation pipeline.

---

## 7. Implementation Summary
- **Database Schema Diff (Rule 12):**
  ```sql
  ALTER TABLE public.cash_registers
    ADD COLUMN warehouse_id VARCHAR(50) REFERENCES public.warehouses(id) ON DELETE SET NULL;
  CREATE INDEX ix_cash_registers_warehouse_id ON public.cash_registers(warehouse_id);
  ```
- **Validation Engine:**
  - PIN: `re.match(r"^[0-9]{6}$", v)`
  - State: Normalizes `"27-Maharashtra"`, `"27 - Maharashtra"`, or `"27"` into canonical state names mapped from `GST_STATE_CODES`.

---

## 8. Tests Executed
1. `backend/app/tests/test_pos.py`: Ran full POS test suite across ephemeral PostgreSQL test harness provisioning `v1420` migration. (16 passed in 157.52s).
2. `backend/app/tests/test_gst_engine.py`: Ran GST tax calculation engine tests. (10 passed).
3. `backend/tests/test_b2b_credit_sales_contract.py`: Ran B2B credit sales contract tests. (2 passed).
4. `backend/tests/test_customer_po_billing_lifecycle.py`: Ran customer PO billing lifecycle tests. (18 passed).
5. `backend/tests/test_warehouse_validation.py`: Ran dedicated warehouse validation and model tests. (7 passed).
6. `src/tests/billingTerm.test.ts`, `src/tests/gstEngine.test.ts`, `src/tests/distTaxInvoiceStitchFlow.test.ts`: Ran Vitest frontend test suite. (24 passed).
7. `npx tsc --noEmit`: Full TypeScript repository compiler check. (0 errors).

---

## 9. Verification Results
- **POS Test Suite:**
  ```text
  16 passed, 75 warnings in 157.52s (0:02:37)
  ```
- **GST & B2B Billing Test Suite:**
  ```text
  30 passed, 83 warnings in 64.10s (0:01:04)
  ```
- **Warehouse Validation Suite:**
  ```text
  7 passed in 2.99s
  ```
- **Frontend Vitest Suite:**
  ```text
  Test Files  3 passed (3)
       Tests  24 passed (24)
    Duration  909ms
  ```
- **TypeScript Compilation:**
  ```text
  Exit Code: 0 (Zero type errors)
  ```

---

## 10. Known Limitations
- Warehouse contact person and phone validation are currently optional; if supplied, phone format is not strictly validated against 10-digit mobile standards.
- Legacy text column `cash_registers.warehouse` will remain until a future major phase deprecates all references.

---

## 11. Future Work
- Add phone number regex validation (`^[6-9][0-9]{9}$`) for warehouse contact persons.
- Migrate any remaining frontend POS terminal configuration screens to submit `warehouse_id` instead of string warehouse names.

---

## 12. Related ADRs
- `ADR-0021`: System of Record Architecture (FastAPI + PostgreSQL Sole Authority).
- `ADR-0034`: Universal Item Master 5-Tier Product Resolution Engine.
- `ADR-0042`: Canonical Statutory GST & Dispatch Origin Derivation.

---

## 13. Related RFCs
- `RFC-2026-08-WMS`: WMS Phase 1 Warehouse & Godown Hierarchy.
- `RFC-2026-09-STATUTORY`: Statutory E-Way Bill & Dispatch Address Parity.
