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

# Implementation Plan: Vendor Master Edit Mode & Double Confirmation Deletion Protection

## 1. Objective
Establish strict, enterprise-grade mode-based controls and accidental-deletion safeguards across the SMRITI Vendor 360 Master Workspace. Enforce a zero-trust dual-confirmation modal workflow for all destructive operations (addresses, contact persons, bank accounts, and style assignments), lock editing/deletion in View Mode, independently enforce authorization and WORM audit logging at the backend API layer, and provide deterministic recovery if deletion encounters transient failures.

## 2. Business Motivation
In multi-terminal retail and ERP environments, inadvertent single-click deletions or modifications during routine vendor review cause catastrophic loss of GSTIN logistics coordinates, contact escalation paths, and disbursement bank IFSC routing. Vendors have reported sudden disappearance of warehouse dispatch addresses and payment bank details due to accidental clicks. Protecting vendor master data with explicit Edit Mode gating and mandatory two-stage confirmation ensures complete regulatory compliance, tamper-evident auditability, and zero accidental loss.

## 3. Scope
- **Frontend Workspace & Tabs (`src/components/vendor/`):**
  - View Mode (Read-Only) enforcement across `VendorMasterWs.tsx`, `VendorAddressTab.tsx`, `VendorContactTab.tsx`, `VendorBankingTab.tsx`, and `VendorArticleStyleTab`.
  - Reusable, accessible `VendorDeleteConfirmationModal.tsx` implementing explicit Step 1 (detail identification) and Step 2 (permanent deletion confirmation & audit warning).
  - Suppression of hover/inline delete buttons in View Mode; disabling keyboard/shortcut deletion paths.
  - Data preservation in local state when backend deletion fails.
- **Backend API & Service Layer (`backend/app/`):**
  - Role-based access control (`require_role(UserRole.MANAGER, UserRole.SYSADMIN)`) on all mutation and deletion endpoints.
  - Status lock: Rejection of mutations and deletions against `MERGED` vendors.
  - Integration with `ComplianceAuditService.append_audit_log` generating immutable SHA-256 chained audit records (`ComplianceImmutableAuditLog`).
  - Integration with `PlatformEventService` staging transactional outbox events (`vendor.address.deleted`, `vendor.contact.deleted`, `vendor.bank_account.deleted`).
- **Postal Code Reference Query Verification:**
  - Verify and document auto-population of city, state, state code, GST state code, and locality upon 6-digit PIN code entry.

## 4. Current State
- `VendorMasterWs.tsx` contains an `isEditing` boolean toggle, but sub-entity tabs (`VendorAddressTab`, `VendorContactTab`, `VendorBankingTab`) display hover-based action icons (edit, delete, set-primary) that can be triggered regardless of whether the user has entered Edit Mode.
- Sub-entity deletion in tabs executed on a single click of `Trash2` without any confirmation modal.
- Backend deletion methods in `vendor_svc.py` soft-delete records (`is_deleted = True`), but do not record `ComplianceImmutableAuditLog` entries or stage deletion events in the platform outbox.

## 5. Gap Analysis
| Aspect | Current State | Target State |
|---|---|---|
| View Mode Behavior | Sub-entity hover actions (delete/edit/primary) clickable in View Mode | All Add, Edit, Delete, Set Primary actions strictly locked/hidden in View Mode |
| Deletion UX | Single-click delete icon triggers immediate removal | Two-step confirmation modal: Step 1 item detail warning, Step 2 final permanent deletion confirmation |
| Error Handling | If delete failed, local state might get desynchronized | Strict data preservation on error; clear toast feedback |
| Backend Audit Trail | Deletions only toggle `is_deleted` column | Deletions append cryptographically chained `ComplianceImmutableAuditLog` records |
| Platform Outbox | Deletion events not staged | Stage 4 outbox records staged within transaction (`vendor.*.deleted`) |
| Merged Vendor Lock | Merged vendors might allow sub-entity mutation | Backend rejects modifications/deletions on merged parties with HTTP 400 |

## 6. Architecture Impact
- Reuses existing `ComplianceAuditService` and `ComplianceImmutableAuditLog` with zero schema alteration.
- Reuses existing `PlatformEventService` and `IntegrationOutboxEvent` outbox pattern.
- Introduces modular modal `VendorDeleteConfirmationModal.tsx` adhering to SMRITI design tokens.

## 7. Proposed Design
1. **View Mode vs Edit Mode UI Contract:**
   - In View Mode: Toolbar shows `View Mode (Read-Only)` status badge. Sub-tabs render cards with actions hidden or disabled. Add buttons display lock badge.
   - In Edit Mode: Toolbar shows `Edit Mode Active` status badge. Add and delete buttons appear.
2. **Double Confirmation Modal Flow:**
   - Step 1: Shows exact sub-entity details (title, type, full address, phone, account number) with warning. User can cancel or click "Proceed to Step 2".
   - Step 2: Shows red danger alert warning of permanent removal and compliance audit logging. User can cancel, return to Step 1, or click "Confirm & Delete Permanently".
3. **Backend Audit & Outbox Pipeline:**
   - Within the same atomic transaction: check vendor status -> soft-delete record -> append `ComplianceImmutableAuditLog` -> stage `IntegrationOutboxEvent` -> commit.

## 8. Files Created
- `src/components/vendor/VendorDeleteConfirmationModal.tsx`
- `docs/implementation/purchase/Purchase_Vendor_Master_Edit_Mode_And_Double_Confirmation_Deletion_Protection_Plan_v1.0.0.md`
- `docs/walkthrough/purchase/Purchase_Vendor_Master_Edit_Mode_And_Double_Confirmation_Deletion_Protection_Walkthrough_v1.0.0.md`

## 9. Files Modified
- `src/components/vendor/VendorMasterWs.tsx`
- `src/components/vendor/tabs/VendorAddressTab.tsx`
- `src/components/vendor/tabs/VendorContactTab.tsx`
- `src/components/vendor/tabs/VendorBankingTab.tsx`
- `backend/app/platform/events/service.py`
- `backend/app/services/vendor_svc.py`
- `backend/app/tests/test_vendor_subentity_persistence.py`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 10. Dependencies
- FastAPI + SQLAlchemy AsyncSession
- `ComplianceAuditService` (`backend/app/services/compliance_audit.py`)
- `PlatformEventService` (`backend/app/platform/events/service.py`)
- Lucide React icon tokens

## 11. Risks
- *Risk:* Accidental loss of local state on modal dismissal.
  *Mitigation:* Local state is only altered upon HTTP 200/201 response; cancellation or error leaves arrays 100% untouched.
- *Risk:* Latency in audit logging.
  *Mitigation:* `ComplianceAuditService.append_audit_log` computes SHA-256 synchronously within caller transaction.

## 12. Rollback Strategy
Revert frontend tab components and service methods via Git. No database schema migrations are applied, ensuring 100% zero-risk rollbacks.

## 13. Verification Plan
- Unit tests: Execute `pytest backend/app/tests/test_vendor_subentity_persistence.py -v`.
- TypeScript verification: Execute `npm run lint`.
- Browser verification: Validate View Mode read-only lock and double-step confirmation flow.

## 14. Test Plan
- `test_vendor_address_atomic_persistence`: Pass
- `test_vendor_contact_atomic_persistence`: Pass
- `test_vendor_bank_account_atomic_persistence`: Pass
- `test_vendor_deletion_compliance_audit_and_outbox_event`: Pass
- `test_merged_vendor_blocks_mutations_and_deletions`: Pass
- `test_failed_deletion_preserves_data`: Pass

## 15. Documentation Impact
- Update `docs/implementation/README.md`.
- Create Walkthrough under `docs/walkthrough/purchase/`.
- Update `docs/walkthrough/README.md`.
- Update `CHANGELOG.md`.

## 16. Deployment Plan
- Sync backend changes and rebuild frontend bundle if deployed in Docker.
- Verify zero downtime.

## 17. Status
Completed

## 18. Related ADRs
- `ADR-VEND-01`: Canonical REST API endpoints for Vendor 360
- `ADR-EVENT-04`: Stage 4 Platform Event Outbox Pattern
- `ADR-AUDIT-01`: Cryptographic WORM Compliance Audit Journal

## 19. Related Walkthroughs
- `docs/walkthrough/purchase/Purchase_Vendor_Persistence_And_Legacy_Convergence_Walkthrough_v1.0.0.md`
- `docs/walkthrough/purchase/Purchase_Vendor_Master_Edit_Mode_And_Double_Confirmation_Deletion_Protection_Walkthrough_v1.0.0.md`
