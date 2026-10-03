<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 4.0.0
  Created      : 2026-09-23
  Modified     : 2026-09-23
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: Legacy UX Remediation & Baseline Zero (v4.0.0)

**Version:** 4.0.0  
**Area:** Foundation / UX Governance  
**Status:** Completed  
**Author:** Jawahar Ramkripal Mallah, Chief Systems Architect & Creator  

---

## 1. Objective
Retire all 25 baselined legacy exceptions (`EXC-LEGACY-0001` to `EXC-LEGACY-0025`) across 8 transactional modal components, achieving a zero-exception baseline (`[]`) enforced by `ci_ux_field_governance_guard.py`.

## 2. Business Motivation
SMRITI's Canonical Field Ownership Contract (CFOC) ensures that every UX input is backed by authoritative backend metadata, eliminating untracked fields, schema drift, and unvalidated data flows.

## 3. Scope
- 8 transactional modals (`ComplaintCRMModal`, `LoyaltyLedgerModal`, `GiftVoucherModal`, `VendorReturnModal`, `GiftCardLifecycleModal`, `PricingStudioModal`, `BarcodeManagementTab`, `GrnReceiptTab`).
- Creation of `CanonicalInlineInput.tsx`.
- Backend canonical registration of `sales_invoice_line.quantity`.
- Frontend TS SSOT regeneration and test synchronization.

## 4. Current State
Prior to v4.0.0, 25 raw JSX `<input>` / `<textarea>` elements bypassed canonical governance, tracked in `scripts/ux_field_governance_baseline.json`.

## 5. Gap Analysis
Transactional action modals are not CRUD forms and cannot use `MasterFormDrawer`. A lightweight, transparent wrapper (`CanonicalInlineInput`) was needed to provide canonical DOM metadata without altering UX or styling.

## 6. Architecture Impact
Establishes the Two-Track UX Governance Architecture:
- Track A (Master Data CRUD): `MasterFormDrawer` + `FieldRenderer`
- Track B (Transactional Modals & Inline Controls): `CanonicalInlineInput`

## 7. Proposed Design
`CanonicalInlineInput` is implemented with `React.forwardRef<HTMLInputElement, CanonicalInlineInputProps>` to support ref forwarding, passing native HTML props through while injecting `data-field-key`, `data-canonical-id`, and `aria-label`.

## 8. Files Created
- `src/components/global/CanonicalInlineInput.tsx`

## 9. Files Modified
- `backend/app/governance/field_registry.py`
- `backend/app/governance/column_classification.py`
- `src/services/canonicalFieldRegistry.ts`
- `src/tests/canonicalFieldRegistry.test.ts`
- `src/components/crm/ComplaintCRMModal.tsx`
- `src/components/crm/LoyaltyLedgerModal.tsx`
- `src/components/pos/GiftVoucherModal.tsx`
- `src/components/procurement/VendorReturnModal.tsx`
- `src/components/pos/GiftCardLifecycleModal.tsx`
- `src/components/pricing/PricingStudioModal.tsx`
- `src/components/BarcodeManagementTab.tsx`
- `scripts/ux_field_governance_baseline.json`

## 10. Dependencies
- React 18
- `canonicalFieldRegistry.ts`
- PostgreSQL tenant database `smriti001` (`public` schema)

## 11. Risks
- Risk of breaking uncontrolled/controlled input state in complex modals: Mitigated by 100% prop pass-through in `CanonicalInlineInput`.

## 12. Rollback Strategy
Git revert commits on target files; restore previous baseline JSON.

## 13. Verification Plan
- `npx vitest run src/tests/canonicalFieldRegistry.test.ts`
- `python scripts/ci_ux_field_governance_guard.py`
- `npx tsc --noEmit`

## 14. Test Plan
- Verify all 11 CI governance checks pass with 0 critical errors.
- Confirm `baselined_legacy_fields == 0`.

## 15. Documentation Impact
- Updated `docs/walkthrough/README.md`
- Created `docs/walkthrough/foundation/Foundation_Legacy_UX_Remediation_And_Baseline_Zero_v4.0.0.md`
- Updated audit reports `UX_FIELD_GOVERNANCE_AUDIT.json` and `UX_FIELD_GOVERNANCE_AUDIT.md`.

## 16. Deployment Plan
Sync changes to `F:\Smriti9` testing environment via git pull per environment rule.

## 17. Status
Completed

## 18. Related ADRs
- `ADR-044`: Canonical Field Ownership Contract (CFOC) and SSOT Architecture
- `ADR-045`: Positive Database Table Ownership and Tenant Boundary Model

## 19. Related Walkthroughs
- `Foundation_Legacy_UX_Remediation_And_Baseline_Zero_v4.0.0.md`
