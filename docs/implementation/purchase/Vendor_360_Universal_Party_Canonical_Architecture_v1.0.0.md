<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.16.0
  Created      : 2026-09-11
  Modified     : 2026-09-11
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: Vendor 360 Workspace & Universal Party Convergence

**Plan ID:** IP-PUR-2026-09-001  
**Version:** 1.0.0  
**Status:** Approved by User Directive (Ready for Sprint 1)  
**Target Area:** `purchase` / `foundation`  
**Related ADRs:** ADR-001 (Universal Party Master), ADR-004 (Stage 4 Contract-First Architecture)  
**Related Walkthroughs:** None (Initial Phase)

---

## 1. Objective
Establish **Universal Party** (`Party` + `PartyRole(SUPPLIER)` + `SupplierProfile`) as the canonical System of Record for all vendor entities in SMRITI Retail OS. Retire fragmented supplier screens and disparate return-to-vendor dialogs by introducing a contract-first, policy-driven **Vendor 360 Workspace** (`VendorMasterWs.tsx`) with zero downtime and non-destructive transactional foreign key compatibility.

---

## 2. Business Motivation
1. **Elimination of Master Data Drift:** Eliminates the current dual-write disconnect where legacy `suppliers` table and `parties` table operate independently.
2. **Statutory & Tax Compliance:** Indian retail procurement mandates PAN for TDS deduction under Sections 194Q and 206AB, MSME Udyam registration for Section 43B(h) payment timelines (15/45 days), and valid bank coordinates for disbursement. These attributes are completely absent in the legacy supplier schema.
3. **Consolidated Operational Experience:** Replaces 5 isolated modals and forms with a single unified Vendor 360 Workspace conforming to SMRITI's Single Workspace Principle.
4. **Standardized Domain Language:** Codifies the architectural standard: **Vendor** for UI/business terminology and **Supplier** for domain/role entities.

---

## 3. Scope
- **Backend Models:** Enhancements to `backend/app/models/party.py` (`SupplierBankAccount`, contact categorizations, vendor statuses, commercial classifications).
- **Audit & Migration Ledger:** Addition of `vendor_identity_migrations` table for auditable legacy reconciliation.
- **Contract Layer:** Pydantic v2 DTOs (`backend/app/schemas/vendor.py`) and TypeScript interfaces (`src/types/vendor.ts`).
- **Application Services:** Implementation of `VendorService` wrapping `UniversalPartyMasterService` with non-destructive legacy projection.
- **Frontend Workspace:** Construction of `VendorMasterWs.tsx` featuring 9 dedicated operational tabs.
- **Workflow Consolidation:** Staged convergence of `PRTVModal` and `VendorReturnModal` into a canonical RTV domain model.

---

## 4. Current State
- `backend/app/models/purchase.py`: Contains flat `Supplier` table (`id`, `name`, `code`, `gst_number`, `mobile`, `email`, `address`, `city`, `state`, `pincode`, `outstanding`).
- `backend/app/models/party.py`: Contains polymorphic `Party`, `PartyRole`, `SupplierProfile`, `PartyAddress`, `PartyContact`.
- `backend/app/api/v1/purchase.py`: Implements CRUD on `suppliers` table only, creating instant data drift from `Party`.
- Transactional FKs (`purchase_orders.supplier_id`, `purchase_receipts.supplier_id`, `supplier_payments.supplier_id`, `purchase_reorder_configs.preferred_supplier_id`) strictly point to `suppliers.id`.
- UI: Fragmented between `SupplierDashTab` (generic list), `SupplierScorecardModal` (mocked SLA), `SupplierPaymentModal` (aging calculation), and two duplicate return dialogs (`PRTVModal` vs `VendorReturnModal`).

---

## 5. Gap Analysis
| Capability | Legacy `suppliers` | Universal Party (`Party`) | Vendor 360 Target |
| :--- | :--- | :--- | :--- |
| **Identity Contract** | Flat single-row | Polymorphic multi-role | Contract-first `VendorDetail` DTO |
| **PAN & Statutory** | None | `pan` (unverified) | Formally validated PAN & TDS profile |
| **MSME & 43B(h)** | None | `msme_registration_no` only | Category (Micro/Small/Med), Udyam No, 45d Guard |
| **Banking Coordinates**| None | None | Controlled `SupplierBankAccount` entity |
| **Contacts** | Single mobile/email | `PartyContact` (uncategorized) | First-class contacts (Sales, Accounts, Logistics) |
| **Status / Lifecycle** | Deleted flag only | Status string | Operational (`ACTIVE`, `BLOCKED`, `ON_HOLD`, `MERGED`) |
| **UI Integration** | Generic master grid | None | 9-tab integrated Vendor 360 Workspace |
| **Return to Vendor** | Fragmented PRTV / RTV | None | Canonical RTV Domain Engine |

---

## 6. Architecture Impact
Adheres to the Stage 4 Hexagonal Architecture:
```text
UI (VendorMasterWs) ──> Canonical API (/api/v1/purchase/vendors) 
                    ──> Vendor Application Service 
                    ──> Universal Party Domain Service 
                    ──> Database Repositories (PostgreSQL)
                    ──> Legacy Supplier Compatibility Projection (Temporary)
```

---

## 7. Proposed Design

### A. Data Schema Enhancements (`backend/app/models/party.py`)
1. **`SupplierBankAccount` Entity (`party_bank_accounts` table):**
   - `id`, `party_id` (FK), `bank_name`, `account_holder_name`, `account_number`, `ifsc`, `branch`, `account_type`, `is_primary`, `verification_status` (`PENDING`, `VERIFIED`, `REJECTED`), `verified_at`.
2. **`PartyContact` Entity Enhancements:**
   - Add `contact_category` (`SALES`, `ACCOUNTS`, `LOGISTICS`, `MANAGEMENT`, `OTHER`).
3. **`SupplierProfile` Entity Enhancements:**
   - Add `msme_category` (`MICRO`, `SMALL`, `MEDIUM`, `NOT_APPLICABLE`), `commercial_classification` (`PREFERRED`, `APPROVED`, `CONDITIONAL`, `RESTRICTED`, `BLOCKED`), `tds_section` (`194Q`, `194C`, `NONE`), `tds_rate`.
4. **`VendorIdentityMigration` Entity (`vendor_identity_migrations` table):**
   - `legacy_supplier_id`, `party_id`, `migration_status` (`COMPLETED`, `FAILED`, `PENDING`), `migration_reason`, `migrated_at`, `migrated_by`.

### B. Canonical DTO Contract (`backend/app/schemas/vendor.py`)
- `VendorSummary`, `VendorDetail`, `VendorCreateRequest`, `VendorUpdateRequest`, `VendorBankAccountDTO`, `VendorContactDTO`, `VendorAddressDTO`, `VendorCommercialProfileDTO`, `VendorComplianceProfileDTO`, `VendorMergeRequest`.

### C. Application Service (`backend/app/services/vendor_svc.py`)
- Coordinates atomic creation of `Party` + `PartyRole(SUPPLIER)` + `SupplierProfile` + `PartyAddress` + `PartyContact` + `SupplierBankAccount`.
- Manages dual-write projection into `suppliers` table for legacy FK compatibility.
- Implements Vendor Merge logic: migrates references, merges roles, marks source `MERGED`.

### D. Vendor 360 Workspace (`src/components/vendor/VendorMasterWs.tsx`)
- 9 Tabs:
  1. Overview (Key metrics, status, quick actions)
  2. Identity & Statutory (Legal, trade, GSTIN, PAN, MSME)
  3. Addresses (Registered, billing, godowns)
  4. Contacts (Categorized: Sales, Accounts, Logistics)
  5. Commercial & Terms (Payment terms, credit limits, TDS)
  6. Banking & Disbursement (Bank accounts, IFSC, primary toggle)
  7. Procurement History (Orders, receipts, fill rate)
  8. Payables & Aging (Integrated Accounts Payable ledger)
  9. SLA & Performance Scorecard (Delay penalties, quality rate)

---

## 8. Files Created
- `backend/app/schemas/vendor.py`
- `backend/app/services/vendor_svc.py`
- `backend/app/api/v1/vendor.py`
- `src/types/vendor.ts`
- `src/components/vendor/VendorMasterWs.tsx`
- `src/components/vendor/tabs/VendorOverviewTab.tsx`
- `src/components/vendor/tabs/VendorIdentityTab.tsx`
- `src/components/vendor/tabs/VendorAddressTab.tsx`
- `src/components/vendor/tabs/VendorContactTab.tsx`
- `src/components/vendor/tabs/VendorCommercialTab.tsx`
- `src/components/vendor/tabs/VendorBankingTab.tsx`
- `src/components/vendor/tabs/VendorProcurementTab.tsx`
- `src/components/vendor/tabs/VendorPayablesTab.tsx`
- `src/components/vendor/tabs/VendorScorecardTab.tsx`
- `src/utils/rtvEngine.ts`

---

## 9. Files Modified
- `backend/app/models/party.py` (Bank account model, profile enhancements)
- `backend/app/api/v1/__init__.py` (Register vendor router)
- `backend/app/api/v1/purchase.py` (Forward legacy supplier calls to `VendorService`)
- `src/types.ts` (Import canonical vendor types)
- `src/components/SupplierDashTab.tsx` (Route to `VendorMasterWs`)
- `src/components/purchase/PoGenerateTab.tsx` (Use canonical vendor contract)

---

## 10. Dependencies
- FastAPI 0.110+
- SQLAlchemy 2.0 AsyncSession
- PostgreSQL 15+ (JSONB & foreign keys)
- React 18, TailwindCSS / SMRITI CSS design tokens, Lucide React

---

## 11. Risks & Mitigation
| Risk | Severity | Mitigation Strategy |
| :--- | :--- | :--- |
| Breaking active purchase orders / GRNs | HIGH | Maintain dual-write projection to legacy `suppliers` table until Sprint 9. |
| Incomplete GSTIN or PAN data in legacy rows | MEDIUM | Allow `PENDING_VERIFICATION` status; allow migration with flagged missing attributes. |
| Duplicate vendor records during convergence | MEDIUM | Implement deduplication engine (GSTIN -> PAN -> Phone) and Vendor Merge utility. |

---

## 12. Rollback Strategy
All database enhancements are additive. If `VendorService` experiences runtime exceptions, endpoints revert to legacy `PurchaseService.create_supplier` directly without modifying underlying transactional structures.

---

## 13. Verification Plan
- Unit tests validating atomic `VendorService` operations.
- Schema parity checks adhering to Rule 12 in `AGENTS.md`.
- Legacy compatibility test verifying `/api/v1/purchase/suppliers` returns expected contract.
- End-to-end browser walkthrough creating a vendor and issuing a PO.

---

## 14. Test Plan
- `backend/tests/test_vendor_service.py`:
  - `test_create_vendor_atomic`: Asserts `parties`, `party_roles`, `supplier_profiles`, `party_bank_accounts` are populated.
  - `test_legacy_dual_write_projection`: Asserts row is also inserted into `suppliers`.
  - `test_vendor_merge`: Asserts source marked `MERGED` and target acquires consolidated attributes.

---

## 15. Documentation Impact
- Update `docs/architecture/SMRITI_PLATFORM_IMPLEMENTATION_STATUS.md`.
- Append Walkthrough upon completion to `docs/walkthrough/README.md`.
- Update User Guide and API Reference.

---

## 16. Deployment Plan
- Phase 1: Deploy schema updates (additive migration).
- Phase 2: Deploy backend service & DTOs with dual-write enabled.
- Phase 3: Deploy frontend `VendorMasterWs.tsx`.
- Phase 4: Run batch migration audit script.
- Phase 5: Repoint transaction FKs and deprecate legacy table.

---

## 17. Status
**Status:** Completed

---

## 18. Related ADRs
- `docs/adr/ADR-001_Universal_Party_Master.md`
- `docs/adr/ADR-004_Stage4_Contract_First_Architecture.md`

---

## 19. Related Walkthroughs
- [`docs/walkthrough/purchase/Vendor_360_Universal_Party_Canonical_Architecture_v1.0.0.md`](file:///F:/SMRITRretailNX/docs/walkthrough/purchase/Vendor_360_Universal_Party_Canonical_Architecture_v1.0.0.md)
