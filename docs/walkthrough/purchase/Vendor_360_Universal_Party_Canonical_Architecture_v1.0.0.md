<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-09-11
  Modified     : 2026-09-11
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Vendor 360 Workspace & Universal Party Master Canonical Architecture Walkthrough

**Document Version:** 1.0.0  
**Status:** Completed  
**Area:** Purchase / Procurement / Master Data  
**Implementation Plan:** [`docs/implementation/purchase/Vendor_360_Universal_Party_Canonical_Architecture_v1.0.0.md`](file:///F:/SMRITRretailNX/docs/implementation/purchase/Vendor_360_Universal_Party_Canonical_Architecture_v1.0.0.md)

---

## 1. Purpose
This implementation establishes the canonical domain model, service boundaries, migration ledger, and unified enterprise frontend for suppliers and vendors in SMRITI Retail OS. It resolves historical architectural fragmentation between the legacy `suppliers` table and the `parties` / `supplier_profiles` tables, enforces Universal Party as the sole system-of-record (`Party` + `PartyRole(SUPPLIER)` + `SupplierProfile`), introduces non-destructive dual-write compatibility projections, consolidates Return to Vendor (RTV) engines, and launches the full-bleed **Vendor 360 Workspace** (`VendorMasterWs`).

---

## 2. Scope
- **Domain Layer (`backend/app/models/party.py`):** Extended Universal Party schema with `SupplierBankAccount` (`party_bank_accounts`), `VendorIdentityMigration` (`vendor_identity_migrations`), enhanced `SupplierProfile` (MSME categories, commercial classification, TDS section/rate, verification flags), and categorized `PartyContact`.
- **Database Migrations (`backend/alembic/versions/v1421_vendor_360_canonical_foundations.py`):** Created and executed Alembic migration `v1421_vendor_360` with full column-level parity across both `smriti001` and `smriti002`.
- **Contract Layer (`backend/app/schemas/vendor.py` & `src/types/vendor.ts`):** Established strict contract-first DTO interfaces (`VendorSummary`, `VendorDetail`, `VendorCreateRequest`, `VendorUpdateRequest`, `VendorMergeRequest`, `VendorMergeResponse`, statutory sub-entities).
- **Application Service Layer (`backend/app/services/vendor_svc.py`):** Implemented atomic multi-entity orchestration, deduplication guards (Code/GSTIN/PAN/Mobile), legacy projection dual-write to `suppliers`, and auditable vendor merge.
- **REST API Layer (`backend/app/api/v1/vendor.py` & `backend/app/main.py`):** Mounted canonical endpoints under `/api/v1/purchase/vendors` and `/api/v1/vendors`.
- **Frontend Workspace (`src/components/vendor/` & `src/components/SupplierDashTab.tsx`):** Built 9-tab **Vendor 360 Workspace** (`VendorMasterWs`) covering Overview, Identity & Statutory, Addresses, Contacts, Commercial, Banking, Procurement, Payables Aging, and Scorecard, plus Vendor Merge Modal.
- **RTV Consolidation (`src/utils/rtvEngine.ts` & `src/components/procurement/PRTVModal.tsx`):** Standardized on canonical 6-stage RTV domain model (Request → Approval → Dispatch → Vendor Receipt → Debit Note → Settle) and converted `PRTVModal` into a backward-compatible adapter.

---

## 3. Files Created
1. `backend/alembic/versions/v1421_vendor_360_canonical_foundations.py`
2. `backend/app/schemas/vendor.py`
3. `backend/app/services/vendor_svc.py`
4. `backend/app/api/v1/vendor.py`
5. `backend/tests/test_vendor_service.py`
6. `src/types/vendor.ts`
7. `src/utils/rtvEngine.ts`
8. `src/tests/rtvEngine.test.ts`
9. `src/components/vendor/VendorMasterWs.tsx`
10. `src/components/vendor/tabs/VendorOverviewTab.tsx`
11. `src/components/vendor/tabs/VendorIdentityTab.tsx`
12. `src/components/vendor/tabs/VendorAddressTab.tsx`
13. `src/components/vendor/tabs/VendorContactTab.tsx`
14. `src/components/vendor/tabs/VendorCommercialTab.tsx`
15. `src/components/vendor/tabs/VendorBankingTab.tsx`
16. `src/components/vendor/tabs/VendorProcurementTab.tsx`
17. `src/components/vendor/tabs/VendorPayablesTab.tsx`
18. `src/components/vendor/tabs/VendorScorecardTab.tsx`
19. `src/components/vendor/tabs/VendorMergeModal.tsx`
20. `docs/implementation/purchase/Vendor_360_Universal_Party_Canonical_Architecture_v1.0.0.md`

---

## 4. Files Modified
1. `backend/app/models/party.py`
2. `backend/app/models/__init__.py`
3. `backend/app/api/v1/__init__.py`
4. `backend/app/main.py`
5. `src/types.ts`
6. `src/App.tsx`
7. `src/components/SupplierDashTab.tsx`
8. `src/components/launchpad/launchpadCatalog.ts`
9. `src/components/procurement/PRTVModal.tsx`
10. `docs/implementation/README.md`
11. `docs/walkthrough/README.md`

---

## 5. Architecture Decisions
- **AD-VEND-01: Universal Party as Single Source of Truth:** `Party` + `PartyRole(SUPPLIER)` + `SupplierProfile` is the sole canonical write-path.
- **AD-VEND-02: Non-Destructive Dual-Write Legacy Projection:** In Sprints 1–8, `VendorService` projects created/updated vendors into `suppliers` with primary key `sup-<code.lower()>` to preserve transactional integrity for foreign keys (`purchase_orders.supplier_id`, `purchase_receipts.supplier_id`, `supplier_payments.supplier_id`).
- **AD-VEND-03: Auditable Migration Ledger (`vendor_identity_migrations`):** Every creation, update, sync, and merge generates a row in `vendor_identity_migrations` with user ID, timestamp, reasons, and JSON payload.
- **AD-VEND-04: Terminology Standardization:** Standardized on "Vendor" for UI/business layers and "Supplier" for domain role/database entities.
- **AD-VEND-05: Controlled Sub-Entities:** Bank accounts (`party_bank_accounts`) and contacts (`party_contacts` with `contact_category`) are first-class controlled entities, enabling historical change tracking without data loss.

---

## 6. Design Rationale
Prior to this implementation, SMRITI suffered from split-brain supplier data models: the transactional core wrote to `suppliers`, while the Universal Party subsystem wrote to `parties`. Reconciling this by migrating all transactional FKs immediately would have created severe downtime and schema breakage risks across live purchase orders and payments. By instituting a phased strangler-fig pattern with an auditable dual-write projection, legacy queries continue to function seamlessly while all new operations converge into the Universal Party model.

---

## 7. Implementation Summary
1. **Schema & Models:** Added `SupplierBankAccount` and `VendorIdentityMigration` tables; added statutory fields (`msme_category`, `commercial_classification`, `tds_section`, `tds_rate`, `verification_flags`) to `SupplierProfile`; added `contact_category` to `PartyContact`.
2. **Alembic Migration:** Applied `v1421_vendor_360` to both `smriti001` and `smriti002`.
3. **Application Service:** Implemented `VendorService` orchestrating atomic multi-table writes, duplicate prevention, and partial updates with automatic legacy projection sync.
4. **API Router:** Exposed REST endpoints under `/api/v1/purchase/vendors` and `/api/v1/vendors` with role-based access control.
5. **Frontend Workspace:** Built responsive, keyboard-navigable `VendorMasterWs` with 9 specialized tabs and unified launchpad tile routing.
6. **RTV Engine:** Reconciled `prtvEngine` and `vendorReturnEngine` into `CanonicalRTVDomainEngine` with 6-stage lifecycle validation.

---

## 8. Tests Executed
1. **Pytest Backend Suite:** `python -m pytest tests/test_vendor_service.py -v`
   - `test_create_vendor_atomic_party_and_legacy_projection`
   - `test_vendor_duplicate_prevention`
   - `test_vendor_partial_update_and_legacy_sync`
   - `test_vendor_merge_lifecycle`
2. **Vitest Frontend Suites:** `npx vitest run src/tests/rtvEngine.test.ts src/tests/vendorReturnEngine.test.ts src/tests/prtvEngine.test.ts`
   - 10/10 tests passed across 3 test files.
3. **TypeScript Static Compilation:** `npx tsc --noEmit`
   - 0 errors across the entire codebase.

---

## 9. Verification Results
- **Backend Tests:** 4/4 passed in 4.77s.
- **Frontend Vitest:** 10/10 passed in 401ms.
- **TypeScript Check:** Clean exit code 0.
- **Database Schema Parity:** Migration `v1421_vendor_360` verified on `smriti001` and `smriti002`.

---

## 10. Known Limitations
- Transaction foreign keys (`purchase_orders.supplier_id`, `purchase_receipts.supplier_id`, `supplier_payments.supplier_id`) still point to `suppliers.id` via the non-destructive projection. FK migration to `parties.id` is scheduled for Sprint 9–10.

---

## 11. Future Work
- **Sprint 9:** Staged migration of transactional foreign keys (`purchase_orders`, `purchase_receipts`, `supplier_payments`) to reference `parties.id`.
- **Sprint 10:** Retirement of legacy `suppliers` table and removal of dual-write projection logic.
- **Real-time GSTN API Integration:** Automated GSTIN verification hook in `VendorComplianceProfile`.

---

## 12. Related ADRs
- `ADR-008`: Universal Party Master Model
- `ADR-019`: Multi-Tenant Dual-Database Architecture
- `ADR-VEND-01`: Vendor 360 Workspace & Single Source of Truth

---

## 13. Related RFCs
- `RFC-2026-07`: Enterprise Procurement & Supplier Lifecycle Unification
