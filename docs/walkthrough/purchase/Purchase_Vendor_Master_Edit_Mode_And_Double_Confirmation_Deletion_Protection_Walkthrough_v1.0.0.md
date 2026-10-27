<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-10-27
  Modified     : 2026-10-27
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Vendor Master — Edit Mode & Double-Confirmation Deletion Protection Walkthrough

**Policy Enforcement:** WGP (Walkthrough Governance Policy) & IPGP  
**Status:** Completed  
**Author:** Jawahar Ramkripal Mallah, Chief Systems Architect & Creator (`support@smritibooks.com`)  
**Version:** 1.0.0  
**Domain:** Purchase / Vendor Master  
**Implementation Plan Reference:** `docs/implementation/purchase/Purchase_Vendor_Master_Edit_Mode_And_Double_Confirmation_Deletion_Protection_Plan_v1.0.0.md`

---

## 1. Purpose
This walkthrough documents the end-to-end implementation of strict mode-based access control and two-step irreversible deletion protection across all Vendor Master sub-entities (Locations/Godowns, Key Contacts, Disbursement Bank Accounts, and Catalog Style/Articles) within the SMRITI Retail OS platform.

---

## 2. Scope
1. **Frontend View Mode (Read-Only):**
   - Universal locking of all mutation actions across all Vendor tabs.
   - Distinct "View Mode (Read-Only)" badge in the primary command toolbar.
   - Inline action buttons (Add, Edit, Set Primary, Delete, Unassign) disabled, locked, or replaced with lock indicators in View Mode.
2. **Frontend Edit Mode:**
   - Explicit user activation via "Edit Vendor" button.
   - Pulsing "Edit Mode Active" banner and notification.
   - Enables addition, editing, and double-confirmation deletions.
3. **Double Confirmation for Deletion:**
   - Dedicated modal (`VendorDeleteConfirmationModal.tsx`) requiring two discrete confirmation steps.
   - **Step 1:** Detailed entity summary inspection (titles, GSTIN, coordinates, contacts, IFSC/account).
   - **Step 2:** Statutory compliance and irreversible WORM audit warning requiring explicit acknowledgment.
4. **Backend Enforcement & Outbox:**
   - Backend status guards blocking mutations and deletions on `MERGED` vendors (`HTTP 400 Bad Request`).
   - Tenant-level cryptographic WORM audit trail logging (`ComplianceImmutableAuditLog` via `ComplianceAuditService`).
   - Stage 4 Domain Event Outbox registration (`vendor.address.deleted`, `vendor.contact.deleted`, `vendor.bank_account.deleted`).
5. **PIN Code Auto-Population:**
   - Clarified and verified bidirectional integration with `smritisys.postal_codes_ref` via `GET /api/v1/control/reference/postal-codes/{clean}`.

---

## 3. Files Created
1. `src/components/vendor/VendorDeleteConfirmationModal.tsx`
   - Universal two-step modal preventing accidental deletions with full entity attribute inspection in Step 1 and WORM statutory warning in Step 2.
2. `docs/implementation/purchase/Purchase_Vendor_Master_Edit_Mode_And_Double_Confirmation_Deletion_Protection_Plan_v1.0.0.md`
   - Complete 19-section IPGP implementation plan.
3. `docs/walkthrough/purchase/Purchase_Vendor_Master_Edit_Mode_And_Double_Confirmation_Deletion_Protection_Walkthrough_v1.0.0.md`
   - This document.

---

## 4. Files Modified
1. `src/components/vendor/VendorMasterWs.tsx`
   - Added toolbar Mode Badges (`View Mode (Read-Only)` vs `Edit Mode Active`).
   - Propagated `isEditing` to `VendorArticleStyleTab`.
   - Locked all article actions (Sync from PO, New Article, Assign, Unassign) in View Mode.
2. `src/components/vendor/tabs/VendorAddressTab.tsx`
   - Integrated `VendorDeleteConfirmationModal`.
   - Locked "Add Location" button and inline card actions in View Mode.
   - Eliminated single-click `handleDeleteAddress`.
3. `src/components/vendor/tabs/VendorContactTab.tsx`
   - Integrated `VendorDeleteConfirmationModal`.
   - Locked "Add Contact Person" button and inline card actions in View Mode.
   - Eliminated single-click `handleDeleteContact`.
4. `src/components/vendor/tabs/VendorBankingTab.tsx`
   - Integrated `VendorDeleteConfirmationModal`.
   - Locked "Add Bank Account" button and inline card actions in View Mode.
   - Eliminated single-click `handleDeleteBank`.
5. `backend/app/platform/events/service.py`
   - Registered deletion domain event types (`VENDOR_ADDRESS_DELETED`, `VENDOR_CONTACT_DELETED`, `VENDOR_BANK_ACCOUNT_DELETED`).
6. `backend/app/services/vendor_svc.py`
   - Added `party.status == "MERGED"` modification and deletion lock.
   - Added `ComplianceAuditService` record generation on address, contact, and bank account deletions.
   - Staged Stage 4 Outbox events with masked sensitive data.
7. `backend/app/services/compliance_audit.py`
   - Added backward-compatible alias `append_audit_log = record_audit_event`.
8. `backend/app/tests/test_vendor_subentity_persistence.py`
   - Added deletion compliance audit and outbox verification test.
   - Added merged vendor lock test.
   - Added deletion failure data preservation test.
9. `docs/implementation/README.md`
   - Appended implementation plan entry to master index table.

---

## 5. Architecture Decisions
- **Decision 1: Zero Single-Click Destructive Actions:**
  Single-click deletions are completely eliminated from the DOM. Deletion buttons now solely trigger the two-step modal state machine (`step: 1 | 2`).
- **Decision 2: Strict UI & Backend Parity:**
  UI restrictions are reinforced by backend validation. Merged vendors and unauthorized roles are blocked at the FastAPI service layer regardless of frontend state.
- **Decision 3: Immutable Statutory Audit Chaining:**
  Every sub-entity deletion records an immutable event in `compliance_immutable_audit_logs` cryptographically chained using SHA-256 hashes (`payload_hash`).
- **Decision 4: Data Preservation on Failure:**
  If a deletion API call fails (network partition, database constraint, authorization denial), local React state is never modified and error messages guide the user without clearing valid entries.

---

## 6. Design Rationale
- Accidental deletions in master data compromise downstream statutory reports (e.g., GSTR-2B reconciliation, MSME Form 1, e-Invoice IRN).
- Two separate modal confirmations ensure the operator consciously inspects the specific entity attributes (Step 1) and acknowledges irreversible compliance logging (Step 2) before the HTTP DELETE request is dispatched.

---

## 7. Implementation Summary
1. **Modal Workflow:**
   - User clicks `Trash2` icon on Address, Contact, or Bank card.
   - `handleRequestDelete` sets the entity payload and opens `VendorDeleteConfirmationModal`.
   - **Step 1:** Displays entity category, title, address/contact/bank details, and a clear warning. "Proceed to Permanent Deletion" advances to Step 2.
   - **Step 2:** Displays statutory WORM warning with high-contrast amber/rose badges. Clicking "Confirm & Delete Permanently" executes the async backend deletion.
2. **Backend Deletion Lifecycle:**
   - Loads party entity and verifies `status != 'MERGED'`.
   - Marks target sub-entity record `is_deleted = True`.
   - Emits immutable audit log with before/after state.
   - Stages transactional outbox event.
   - Commits transaction atomically.

---

## 8. Tests Executed
- `backend/app/tests/test_vendor_subentity_persistence.py`:
  - `test_vendor_address_atomic_persistence`
  - `test_vendor_contact_atomic_persistence`
  - `test_vendor_bank_account_atomic_persistence`
  - `test_vendor_deletion_compliance_audit_and_outbox_event`
  - `test_merged_vendor_blocks_mutations_and_deletions`
  - `test_failed_deletion_preserves_data`

---

## 9. Verification Results
- All automated backend test cases executed and verified against PostgreSQL.
- Frontend components verified with zero TypeScript compilation errors.
- Both deletion steps, cancellation, and data preservation confirmed.

---

## 10. Known Limitations
- Hard deletion is prohibited by design; all deletions are soft-deletions (`is_deleted = True`) backed by statutory WORM audit records.

---

## 11. Future Work
- Add automated restore modal in the audit history view for authorized System Administrators.

---

## 12. Related ADRs
- `docs/adr/ADR-0042_Universal_Party_Subentity_Persistence_And_Outbox.md`
- `docs/adr/ADR-0048_Tamper_Evident_Audit_Log_Architecture.md`

---

## 13. Related RFCs
- `RFC-2026-PURCHASE-VENDOR-MASTER-v1`
