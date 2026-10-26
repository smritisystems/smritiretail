<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-10-26
  Modified     : 2026-10-26
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Vendor Master Data Integrity, Atomic Modal Persistence & Legacy Convergence

**Document ID:** WGP-PUR-2026-10-001  
**Version:** 1.0.0  
**Status:** Completed  
**Execution Date:** 2026-10-26  
**Target Area:** `purchase` / `foundation`  
**Related Plan:** [Purchase_Vendor_Persistence_And_Legacy_Convergence_Plan_v1.0.0.md](../../implementation/purchase/Purchase_Vendor_Persistence_And_Legacy_Convergence_Plan_v1.0.0.md)  
**Related ADRs:** ADR-001 (Universal Party Master), ADR-004 (Stage 4 Contract-First Architecture), ADR-VEND-01 (Canonical Vendor 360 Workspace)  

---

## 1. Purpose
Eliminate reported vendor data loss across SMRITI Retail OS by replacing client-side in-memory sub-entity buffering with atomic, server-confirmed database persistence for addresses, contact persons, and bank disbursement accounts. Concurrently resolve directory invisibility for archived/merged parties and safely reconcile 218 unlinked legacy suppliers into the Universal Party Master (`parties`) via a dry-run-first, audit-logged idempotent migration without modifying or breaking historical transaction references.

---

## 2. Scope
- **Backend API & Service Layer:**
  - 6 atomic REST endpoints under `/api/v1/vendors/{vendor_id}` for adding/updating and deleting addresses, contacts, and bank accounts.
  - Transaction-safe service layer methods in `VendorService` with tenant context boundary enforcement and rollback protection.
  - Dedicated automated pytest integration tests in `backend/app/tests/test_vendor_subentity_persistence.py`.
- **Frontend Workspace & Tab Ergonomics:**
  - `VendorAddressTab.tsx`: Atomic modal saving, deletion, and primary designation with live notification feedback.
  - `VendorContactTab.tsx`: Atomic modal saving, deletion, and primary designation with live notification feedback.
  - `VendorBankingTab.tsx`: Atomic modal saving, deletion, and primary designation with live notification feedback.
  - `VendorMasterWs.tsx`:
    - Pristine snapshot comparison and `isDirty` state tracking.
    - Floating sticky bottom warning bar and modal guard preventing accidental discard when switching vendors.
    - Window `beforeunload` browser guard.
    - Directory status pills (`Active`, `All`, `Archived`, `Merged`) and intelligent search fallback banner for archived/merged matches.
- **Legacy Supplier Convergence:**
  - Production CLI utility `scripts/converge_legacy_suppliers.py` with `--dry-run` (default) and `--execute` modes.
  - Deterministic disambiguation for duplicate legacy vendor codes (`'A'`, `'C'`).
  - Full audit logging in `vendor_identity_migrations`.
- **Data Protection & Disaster Recovery:**
  - Pre-execution full cluster backup `backups/pre_vendor_persistence_20261026_full.sql` (477.8 MB).
  - Pre-execution tenant database backup `backups/pre_vendor_persistence_smriti001.sql` (143.8 MB).

---

## 3. Files Created
- `backend/app/tests/test_vendor_subentity_persistence.py` — Automated integration tests covering atomic sub-entity persistence.
- `scripts/converge_legacy_suppliers.py` — Idempotent legacy supplier convergence and identity reconciliation tool.
- `docs/implementation/purchase/Purchase_Vendor_Persistence_And_Legacy_Convergence_Plan_v1.0.0.md` — Formal 19-section implementation plan.
- `docs/walkthrough/purchase/Purchase_Vendor_Persistence_And_Legacy_Convergence_Walkthrough_v1.0.0.md` — This walkthrough document.

---

## 4. Files Modified
- `backend/app/schemas/vendor.py` — Exported `VendorAddressDTO`, `VendorContactDTO`, and `VendorBankAccountDTO`.
- `backend/app/services/vendor_svc.py` — Added 6 atomic sub-entity persistence methods (`save_address`, `delete_address`, `save_contact`, `delete_contact`, `save_bank_account`, `delete_bank_account`).
- `backend/app/api/v1/vendor.py` — Registered 6 atomic REST endpoints under `/vendors/{vendor_id}/...`.
- `src/components/vendor/tabs/VendorAddressTab.tsx` — Direct modal database persistence via `apiFetchV1` and toast notifications.
- `src/components/vendor/tabs/VendorContactTab.tsx` — Direct modal database persistence via `apiFetchV1` and toast notifications.
- `src/components/vendor/tabs/VendorBankingTab.tsx` — Direct modal database persistence via `apiFetchV1` and toast notifications.
- `src/components/vendor/VendorMasterWs.tsx` — Wired `onNotification`, dirty-state guard, status pills, and smart search fallback.
- `docs/implementation/README.md` — Updated master implementation index.
- `docs/walkthrough/README.md` — Appended walkthrough to master index.

---

## 5. Architecture Decisions
- **ADR-VEND-02 (Atomic Sub-Entity Modal Persistence):** Sub-entities (addresses, contacts, bank accounts) have independent operational lifecycles and must not be trapped in top-level form state. Each sub-entity modal submission immediately hits a dedicated atomic endpoint that validates, commits, and returns the persisted record.
- **ADR-VEND-03 (Pristine Snapshot & Two-Tier Dirty State):** Top-level `isDirty` state tracks only identity and commercial fields against an immutable pristine snapshot. Direct modal operations update both active state and pristine snapshot, preventing sub-entity operations from falsely triggering the profile dirty warning.
- **ADR-VEND-04 (Non-Destructive Supplier Convergence):** Legacy records in `suppliers` are never deleted, renamed, or altered because historical purchase orders, bills, and receipts retain foreign key references (`ON DELETE RESTRICT`). Convergence creates corresponding entries in `parties`, `party_roles`, `supplier_profiles`, and logs lineage in `vendor_identity_migrations`.

---

## 6. Design Rationale
The core defect reported by users ("data already added in vendor form gets lost after some time") was caused by an in-memory client-side trap: modal forms only updated local React arrays (`selectedVendor.addresses / contacts / bankAccounts`). If an operator filled out an address or bank account, closed the modal, and navigated away without clicking "Edit Vendor" and "Save Changes" on the top header, the changes evaporated without ever reaching PostgreSQL. By moving sub-entity saves to atomic REST calls with immediate database commits, every modal confirmation is permanently persisted on click.

---

## 7. Implementation Summary
1. **Database Pre-Flight & Data Protection:**
   - Captured full PostgreSQL cluster backup (`backups/pre_vendor_persistence_20261026_full.sql`, 477,836,248 bytes).
   - Captured tenant database backup (`backups/pre_vendor_persistence_smriti001.sql`, 143,796,074 bytes).
   - Verified Docker named volume `smriti_db_volume` mounted at `/var/lib/postgresql/data`.
2. **Backend Atomic REST Endpoints:**
   - `POST /api/v1/vendors/{vendor_id}/addresses` & `DELETE /api/v1/vendors/{vendor_id}/addresses/{address_id}`
   - `POST /api/v1/vendors/{vendor_id}/contacts` & `DELETE /api/v1/vendors/{vendor_id}/contacts/{contact_id}`
   - `POST /api/v1/vendors/{vendor_id}/bank-accounts` & `DELETE /api/v1/vendors/{vendor_id}/bank-accounts/{bank_id}`
3. **Frontend Modal Direct Persistence:**
   - Updated `VendorAddressTab`, `VendorContactTab`, and `VendorBankingTab` to call `apiFetchV1` directly on submit, display success/error notifications via `onNotification`, and update parent state upon commit.
4. **Unsaved Profile Changes Guard & Ergonomics:**
   - Added pristine snapshot comparison (`isDirty`) in `VendorMasterWs.tsx`.
   - Added sticky bottom notification bar with "Discard" and "Save Now" triggers.
   - Added `confirmDiscardModal` preventing switching vendors with unsaved edits.
   - Added `beforeunload` listener guarding against accidental tab closure or refresh.
5. **Directory Visibility & Smart Fallback:**
   - Added status filter pills (`Active`, `All`, `Archived`, `Merged`) with live counters.
   - Added intelligent search fallback banner that detects when query matches archived or merged records and allows 1-click switching to `ALL`.
6. **Legacy Convergence Execution:**
   - Authored `scripts/converge_legacy_suppliers.py`.
   - Verified dry-run execution: 218 unmigrated suppliers found, 217 new parties, 1 linked, 2 collisions disambiguated ('A-2', 'C-2'), 16 addresses, 0 records modified.
   - Executed live migration: 218 legacy suppliers reconciled, 0 unmigrated remain, 100% idempotent.

---

## 8. Tests Executed
1. **Frontend TypeScript Compilation:**
   ```bash
   npm run lint
   # Output: tsc --noEmit -> Exit code 0 (0 errors)
   ```
2. **Backend Automated Pytest Suite:**
   ```bash
   pytest backend/app/tests/test_vendor_subentity_persistence.py backend/app/tests/test_vendor_statement_of_account.py
   # Output: 7 passed, 24 warnings in 114.66s
   ```
3. **Legacy Supplier Convergence Idempotency Test:**
   ```bash
   python scripts/converge_legacy_suppliers.py --dry-run
   # Output: Unmigrated Suppliers Found: 0. All legacy suppliers are already converged.
   ```

---

## 9. Verification Results

| Target Area | Test / Verification Method | Literal Output / Metric | Status |
|---|---|---|---|
| Frontend Compilation | `tsc --noEmit` via `npm run lint` | 0 errors, Exit code 0 | Done |
| Sub-Entity Address Persistence | `test_vendor_address_atomic_persistence` | `PASSED [14%]` | Done |
| Sub-Entity Contact Persistence | `test_vendor_contact_atomic_persistence` | `PASSED [28%]` | Done |
| Sub-Entity Bank Persistence | `test_vendor_bank_account_atomic_persistence` | `PASSED [42%]` | Done |
| Realtime Vendor Statement | `test_vendor_statement_of_account_realtime` | `PASSED [57%]` | Done |
| Vendor Statement Date Filter | `test_vendor_statement_date_range_filter` | `PASSED [71%]` | Done |
| Vendor Statement Tenant Isolation | `test_vendor_statement_tenant_isolation` | `PASSED [85%]` | Done |
| Vendor Statement Opening Balance | `test_vendor_statement_opening_balance` | `PASSED [100%]` | Done |
| Legacy Supplier Convergence | `python scripts/converge_legacy_suppliers.py` | 218 processed, 0 unmigrated remaining | Done |
| Database Snapshot Safety | `pg_dump` verification on disk | 477.8 MB full, 143.8 MB tenant backups | Done |

---

## 10. Known Limitations
- Legacy suppliers with multiple contacts in unstructured notes were not parsed into structured `PartyContact` entities; only primary contact mobile/email were mapped.
- Merged vendors (`MERGED`) remain read-only historical records; operational transactions cannot be created under a merged party ID.

---

## 11. Future Work
- Stage 4 Platform Event Service: Implement domain event outbox for vendor status changes (`VendorCreated`, `VendorArchived`, `VendorAddressAdded`).
- Vendor Self-Service Portal: Enable suppliers to submit KYC documentation and bank details directly via public magic links.

---

## 12. Related ADRs
- `ADR-001`: Universal Party Master Architecture
- `ADR-004`: Stage 4 Contract-First Enterprise Architecture
- `ADR-VEND-01`: Canonical Vendor 360 Workspace

---

## 13. Related RFCs
- `RFC-VEND-2026-01`: Atomic Sub-Entity Modal Persistence Specification
- `RFC-VEND-2026-02`: Universal Party Legacy Reconciliation Protocol
