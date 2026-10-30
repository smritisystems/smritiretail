<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.99.20
  Created      : 2026-10-26
  Modified     : 2026-10-26
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: Vendor Master Data Integrity, Atomic Modal Persistence & Legacy Convergence

**Plan ID:** IP-PUR-2026-10-002  
**Version:** 1.0.0  
**Status:** Completed  
**Target Area:** `purchase` / `foundation`  
**Related ADRs:** ADR-001 (Universal Party Master), ADR-004 (Stage 4 Contract-First Architecture), ADR-VEND-01 (Canonical Vendor 360 Workspace)  
**Related Walkthroughs:** [Purchase_Vendor_Persistence_And_Legacy_Convergence_Walkthrough_v1.0.0.md](../../walkthrough/purchase/Purchase_Vendor_Persistence_And_Legacy_Convergence_Walkthrough_v1.0.0.md)  

---

## 1. Objective
Eliminate reported vendor data loss across SMRITI Retail OS by replacing client-side in-memory sub-entity buffering with atomic, server-confirmed database persistence for addresses, contact persons, and bank disbursement accounts. Concurrently resolve directory invisibility for archived/merged parties and safely reconcile 218 legacy suppliers into the Universal Party Master (`parties`) via a dry-run-first, audit-logged idempotent migration without modifying or breaking historical transaction references.

---

## 2. Business Motivation
1. **Zero Data Loss Guarantee:** Users adding dispatch locations, warehouse delivery coordinates, contact persons, and bank accounts in `VendorMasterWs.tsx` currently experience data loss upon page reload if they do not manually enter global edit mode and click the top-level "Save Changes" button. Atomic modal persistence guarantees that confirming any sub-entity modal writes directly to PostgreSQL immediately.
2. **Directory Transparency & Search Resilience:** 25 vendors are in `ARCHIVED` status and 14 are in `MERGED` status. Default directory filtering excludes these states, causing operators to falsely conclude records have been deleted when searching by vendor name, PAN, or GSTIN.
3. **Legacy Master Data Disconnect:** 218 legacy suppliers exist solely in the `suppliers` table without counterpart entries in `parties`, making them invisible in the modern Vendor 360 Workspace and blocking procurement modernization.
4. **Statutory & Audit Compliance:** GST e-Way bills and Section 194Q/43B(h) compliance require multi-location dispatch addresses, valid PAN/MSME attributes, and audited bank disbursement coordinates.

---

## 3. Scope

### In Scope (Phase 1 — Vendor Data Integrity)
- **Pre-Change System Audit:** Verification of git baseline, endpoint contracts, schema constraints, tenant isolation boundaries, and duplicate mappings.
- **Backend Sub-Entity API Endpoints:** Dedicated atomic CRUD operations on `/api/v1/purchase/vendors/{vendor_id}/addresses`, `/contacts`, and `/bank-accounts`.
- **Frontend Atomic Modal Persistence:** Direct API submission upon modal save in `VendorAddressTab.tsx`, `VendorContactTab.tsx`, and `VendorBankingTab.tsx` with instant UI update and toast notification.
- **Unsaved Changes Guard:** Dirty-state tracking for top-level vendor profile fields with sticky bottom warning bar and tab/vendor switch confirmation guard.
- **Directory Status Filtering & Search Fallback:** Status filter pills (`Active`, `Archived`, `Merged`, `All`) and fallback search banner pointing to archived/merged records when active search yields zero matches.
- **Dry-Run Legacy Supplier Convergence:** Idempotent reconciliation script (`scripts/converge_legacy_suppliers.py`) mapping the 218 unlinked legacy suppliers into `parties` + `party_roles` (role: `SUPPLIER`) + `supplier_profiles` + `party_addresses` with `vendor_identity_migrations` audit logging.
- **Automated Verification Battery:** Comprehensive pytest test suite validating endpoint persistence, tenant isolation, cascade deletes, and page reload survival.

### Out of Scope (Deferred to Later Phases)
- Phase 2: Platform Event Service (`EventEnvelope`, `EventRegistry`, `IEventTransport`).
- Phase 3: External Notification Service (SMS, Email, Webhook delivery adapters).
- Modification of historical purchase orders, GRNs, or accounting subledger entries.

---

## 4. Current State (Pre-Change Audit Findings)

### A. Git & Workspace Baseline
- **Branch:** `smritiNX` (in sync with `origin/smritiNX`).
- **Working Tree:** Clean (0 uncommitted modifications).
- **Baseline Commit Hash:** `e99f0d3d` (`feat: add legacy endpoint deprecation telemetry log file`).

### B. Database Inventory (`smriti001` Tenant Database on Port 2781)
- **Soft Deletion Check:** `is_deleted = true` is `0` across `parties`, `party_addresses`, `party_contacts`, `party_bank_accounts`, and `suppliers`.
- **Status Distribution in `parties`:** `ACTIVE`: 253, `ARCHIVED`: 25, `MERGED`: 14 (Total: 292 parties).
- **Legacy `suppliers` Count:** 510 total records, of which 292 are linked and 218 are completely unlinked from `parties`.
- **Foreign Key Constraints:**
  - `party_addresses.party_id` -> `parties.id` (`ON DELETE CASCADE`)
  - `party_contacts.party_id` -> `parties.id` (`ON DELETE CASCADE`)
  - `party_bank_accounts.party_id` -> `parties.id` (`ON DELETE CASCADE`)
  - `vendor_identity_migrations.party_id` -> `parties.id` (`ON DELETE CASCADE`)

### C. Duplicate & Collision Audit
- Duplicate codes inside `parties`: **0**.
- Duplicate codes inside `suppliers`: **2** (Code `'A'` has `sup_vendor_a` and `9631c977-...`; Code `'C'` has `sup_vendor_c` and `e8f36e10-...`).
- Cross-entity ID/Code mismatches between `suppliers` and `parties`: **56** records where `s.code == p.party_code` but `s.id != p.id` (e.g. `s.id = 'sup-v-0ff'`, `p.id = 'pty_90fbf2021f32'`).
- **Conclusion:** Naive matching by code or id alone will cause collision or foreign key violation. Convergence must use an explicit disambiguation resolution hierarchy.

### D. Client Persistence Defect
- In `VendorAddressTab.tsx` (lines 118-161), `handleSaveAddress` calls `onUpdateAddresses(nextAddresses)`, which only mutates parent component state `selectedVendor.addresses` in `VendorMasterWs.tsx`.
- The top-level "Save Changes" button is hidden unless `isEditing === true`, but sub-entity add buttons are open at all times.
- Navigating to another tab or vendor silently discards in-memory sub-entities.

---

## 5. Gap Analysis

| Capability / Flow | Current Defective State | Target Phase 1 Architecture |
| :--- | :--- | :--- |
| **Address Modal Save** | Mutates React state in-memory; lost on reload | Dispatches `POST /vendors/{id}/addresses`; writes to PostgreSQL immediately |
| **Contact Modal Save** | Mutates React state in-memory; lost on reload | Dispatches `POST /vendors/{id}/contacts`; writes to PostgreSQL immediately |
| **Bank Modal Save** | Mutates React state in-memory; lost on reload | Dispatches `POST /vendors/{id}/bank-accounts`; writes to PostgreSQL immediately |
| **Sub-Entity Primary Key** | Generates temporary pseudo-IDs (`va-...`, `vc-...`) | Receives canonical database ID (`pa_...`, `pc_...`, `pba_...`) from server |
| **Dirty State Guard** | None; switching vendor loses uncommitted edits | Sticky bottom banner warning + navigation lock modal |
| **Archived / Merged Vendors**| Excluded from list; search returns 0 results | Status pills (`Active 253`, `Archived 25`, `Merged 14`) + search fallback banner |
| **218 Legacy Suppliers** | Unlinked, inaccessible in Vendor 360 Workspace | Dry-run idempotent migration into `parties` with full audit trail |

---

## 6. Architecture Impact

```
┌────────────────────────────────────────────────────────────────────────┐
│                        HEXAGONAL ARCHITECTURE LAYER                    │
├────────────────────────────────┬───────────────────────────────────────┤
│ Frontend (Client)              │ React 18 + Vite (Port 3000 / 8101)     │
│  - VendorMasterWs.tsx          │  - Directory filter pills & search hint│
│  - VendorAddressTab.tsx        │  - Atomic modal save to sub-entity API │
│  - VendorContactTab.tsx        │  - Atomic modal save to sub-entity API │
│  - VendorBankingTab.tsx        │  - Atomic modal save to sub-entity API │
├────────────────────────────────┼───────────────────────────────────────┤
│ API Gateway / REST Endpoints   │ FastAPI Core (Port 8000 / 1981)        │
│  - /api/v1/purchase/vendors/   │  - POST/DELETE /addresses              │
│                                │  - POST/DELETE /contacts               │
│                                │  - POST/DELETE /bank-accounts          │
├────────────────────────────────┼───────────────────────────────────────┤
│ Application Service            │ VendorService (backend/app/services/)  │
│  - vendor_svc.py               │  - Sub-entity atomic persistence       │
│                                │  - Dry-run legacy reconciliation       │
├────────────────────────────────┼───────────────────────────────────────┤
│ Storage & Relational Database  │ PostgreSQL 16 (Port 2781)              │
│  - Tenant DB: smriti001        │  - parties, party_addresses,           │
│                                │    party_contacts, party_bank_accounts,│
│                                │    vendor_identity_migrations          │
└────────────────────────────────┴───────────────────────────────────────┘
```

---

## 7. Proposed Design

### A. Sub-Entity Persistence Endpoints (`backend/app/api/v1/vendor.py`)
1. **Address Endpoints:**
   - `POST /vendors/{vendor_id}/addresses`: Accepts `VendorAddressDTO`. If `id` starts with `pa_` and exists, updates the record; otherwise generates `pa_{uuid12}` and inserts. If `is_primary=True`, resets other addresses for that vendor to `is_primary=False`.
   - `DELETE /vendors/{vendor_id}/addresses/{address_id}`: Sets `is_deleted=True` (soft-delete) or removes record, ensuring primary address integrity.
2. **Contact Endpoints:**
   - `POST /vendors/{vendor_id}/contacts`: Accepts `VendorContactDTO`. Upserts contact with role categorization (`SALES`, `ACCOUNTS`, `LOGISTICS`, `MANAGEMENT`, `GENERAL`).
   - `DELETE /vendors/{vendor_id}/contacts/{contact_id}`: Soft-deletes contact.
3. **Bank Account Endpoints:**
   - `POST /vendors/{vendor_id}/bank-accounts`: Accepts `VendorBankAccountDTO`. Enforces uppercase IFSC format and single primary account constraint.
   - `DELETE /vendors/{vendor_id}/bank-accounts/{bank_id}`: Soft-deletes bank record.

### B. Client Atomic Handlers (`VendorAddressTab.tsx`, `VendorContactTab.tsx`, `VendorBankingTab.tsx`)
- Inside `handleSaveAddress`:
  ```typescript
  setSaving(true);
  try {
    const persisted = await apiFetchV1(`/purchase/vendors/${vendor.id}/addresses`, {
      method: "POST",
      body: JSON.stringify(newAddrPayload)
    });
    // Optimistically update parent vendor state with server canonical record
    onUpdateAddresses(updatedListWithPersisted);
    notify("Saved", "Address persisted to database.", "success");
    setShowAddModal(false);
  } catch (err: any) {
    notify("Error", err.message || "Failed to persist address.", "error");
  } finally {
    setSaving(false);
  }
  ```

### C. Unsaved Changes Guard (`VendorMasterWs.tsx`)
- Track `initialVendorState` upon selection. Compare on field change to set `isDirty: boolean`.
- Render a bottom floating warning bar when `isDirty` is true:
  `⚠️ You have unsaved profile changes for ${selectedVendor.legalName} — [Discard] [Save Changes]`.
- Intercept vendor selection and tab navigation when `isDirty` is true with a confirmation prompt.

### D. Directory Filtering & Search Hints
- Add filter pills above the search bar: `All (${counts.all})`, `Active (${counts.active})`, `Archived (${counts.archived})`, `Merged (${counts.merged})`.
- When an active directory search returns 0 rows, run a quick client-side or backend search across archived/merged items. If matches exist, display:
  `Found ${archivedCount} archived/merged vendors matching "${searchTerm}". Click here to view.`

### E. Idempotent Legacy Supplier Convergence (`scripts/converge_legacy_suppliers.py`)
- **Execution Mode:** Default to `--dry-run`. Only apply changes when `--execute` flag is explicitly passed.
- **Disambiguation Rules:**
  1. If `supplier.id` already exists in `parties.id`, link to existing.
  2. If `supplier.code` exists in `parties.party_code` and has 1 matching party, link and record in `vendor_identity_migrations`.
  3. If `supplier.code` is duplicate in `suppliers` (e.g. `'A'` or `'C'`), use ID-based disambiguation: allocate next governed party code `V-XXX` for duplicates, preserving legacy ID in `vendor_identity_migrations.legacy_supplier_id`.
  4. For unlinked suppliers, create `Party` (`status=ACTIVE`), `PartyRole(role=SUPPLIER)`, `SupplierProfile`, and default `PartyAddress` if address fields are populated.

---

## 8. Files Created
1. `docs/implementation/purchase/Purchase_Vendor_Persistence_And_Legacy_Convergence_Plan_v1.0.0.md` (This file).
2. `scripts/converge_legacy_suppliers.py` (CLI runner with `--dry-run` and `--execute` modes).
3. `backend/app/tests/test_vendor_subentity_persistence.py` (Pytest battery for sub-entity endpoints).
4. `docs/walkthrough/purchase/Purchase_Vendor_Persistence_And_Legacy_Convergence_Walkthrough_v1.0.0.md` (Post-implementation walkthrough).

---

## 9. Files Modified
1. `docs/implementation/README.md` (Append master index table).
2. `backend/app/api/v1/vendor.py` (Add `/addresses`, `/contacts`, `/bank-accounts` endpoints).
3. `backend/app/services/vendor_svc.py` (Add sub-entity atomic methods & convergence service method).
4. `src/components/vendor/tabs/VendorAddressTab.tsx` (Wire atomic modal persistence).
5. `src/components/vendor/tabs/VendorContactTab.tsx` (Wire atomic modal persistence).
6. `src/components/vendor/tabs/VendorBankingTab.tsx` (Wire atomic modal persistence).
7. `src/components/vendor/VendorMasterWs.tsx` (Add dirty guard, directory status pills, and smart search fallback).

---

## 10. Dependencies
- FastAPI 0.115+
- SQLAlchemy 2.0+ (AsyncSession)
- PostgreSQL 16 (Port 2781)
- React 18 + Lucide Icons + TailwindCSS

---

## 11. Risks
1. **Accidental Overwrite of Sub-Entities:** Concurrent edits to addresses could cause overwrites. *Mitigation:* Sub-entity endpoints operate on discrete UUIDs rather than replacing full entity arrays.
2. **Legacy Transaction Broken FKs:** Changing legacy `suppliers.id` could break purchase orders. *Mitigation:* The migration never alters or deletes records in `suppliers`; it only creates projected `parties` records and maps them in `vendor_identity_migrations`.
3. **Primary Key Mismatches:** 56 existing suppliers share a code with parties but have different IDs. *Mitigation:* Convergence records both `legacy_supplier_id` and canonical `party_id` in `vendor_identity_migrations`.

---

## 12. Rollback Strategy
1. **Frontend:** In-memory modal save is backward-compatible; frontend code can be rolled back via git without requiring database schema reverts.
2. **Backend:** New endpoints are additive.
3. **Database Migration:** The convergence script logs all inserted party IDs with `migration_reason='LEGACY_CONVERGENCE'` in `vendor_identity_migrations`. If rollback is required, an automated rollback script deletes only rows created under that migration batch ID, leaving pre-existing party data untouched.

---

## 13. Verification Plan
1. **Baseline Test:** Run existing `pytest backend/app/tests/test_vendor_statement_of_account.py` (verified 4/4 passed).
2. **Sub-Entity Endpoint Test:** Execute `pytest backend/app/tests/test_vendor_subentity_persistence.py` verifying HTTP 201/200 on add, update, and delete for addresses, contacts, and banks.
3. **Dry-Run Convergence Verification:** Execute `python scripts/converge_legacy_suppliers.py --dry-run` and inspect logged mapping decisions, verifying 0 database changes.
4. **Browser Persistence Validation:**
   - Open Vendor Master in browser.
   - Add a new branch address in modal.
   - Refresh browser page completely (Ctrl + Shift + R).
   - Verify newly added address remains present and displays canonical `pa_` database ID.

---

## 14. Test Plan
- Unit tests for `VendorService.save_address`, `save_contact`, `save_bank_account`.
- Multi-tenant boundary test: confirm addresses saved for `smriti001` are invisible to other company databases.
- Validation test: ensure invalid IFSC or empty contact name triggers human-readable validation error (HREP).

---

## 15. Documentation Impact
- Update `docs/implementation/README.md`.
- Create post-implementation walkthrough under `docs/walkthrough/purchase/`.
- Update `CHANGELOG.md`.

---

## 16. Deployment Plan
1. Commit backend API endpoints and run test suite.
2. Commit frontend modal persistence updates and build frontend.
3. Deploy to test environment (`F:\Smriti9`) via `git pull origin smritiNX`.
4. Run dry-run convergence script on staging database.
5. Review dry-run report with system administrator before executing live migration.

---

## 17. Status
**Completed** (All 5 implementation phases executed, verified with 7/7 backend Pytest tests, clean TypeScript compilation, and 100% idempotent legacy convergence).

---

## 18. Related ADRs
- `ADR-001`: Universal Party Master Architecture
- `ADR-004`: Contract-First Hexagonal Architecture
- `ADR-VEND-01`: Vendor 360 Workspace and Subledger Audit

---

## 19. Related Walkthroughs
- [Purchase_Vendor_Persistence_And_Legacy_Convergence_Walkthrough_v1.0.0.md](../../walkthrough/purchase/Purchase_Vendor_Persistence_And_Legacy_Convergence_Walkthrough_v1.0.0.md)
