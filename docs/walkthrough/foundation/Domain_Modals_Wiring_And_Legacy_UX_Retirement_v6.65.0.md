<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.65.0
  Created      : 2026-10-03
  Modified     : 2026-10-03
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: High-Value Domain Modals Wiring & Legacy UX Retirement v6.65.0

## 1. Purpose
This walkthrough documents the full-stack wiring of orphaned, high-value client calculation engines and modals into their canonical parent studio workspaces (`PurchaseStudioTab`, `WmsStudioTab`, and `CrmStudioTab`), and the formal deprecation of legacy duplicate components (`LabelPrintModal`, `ProPosWs`, and `BulkImportSection`).

## 2. Scope
- **Procurement & Purchase Studio:**
  - Integrated `AutoPOModal.tsx` into `PurchaseStudioTab.tsx` with dedicated `#purchase-studio-autopo-btn` trigger.
- **Warehouse & WMS Studio:**
  - Integrated `StockExpiryModal.tsx` and `SmartReplenishmentModal.tsx` into `WmsStudioTab.tsx` with `#wms-stock-expiry-btn` and `#wms-smart-replenish-btn` triggers.
- **CRM & Loyalty Studio:**
  - Integrated `Customer360LoyaltyModal.tsx` and `CustomerCreditModal.tsx` into `CrmStudioTab.tsx` with `#crm-studio-cust360-btn` and `#crm-studio-credit-btn` triggers.
- **Deprecation Governance:**
  - Formally annotated `LabelPrintModal.tsx` (superseded by `LabelPrintingSec.tsx`).
  - Formally annotated `ProPosWs.tsx` (superseded by `BillingWorkspace.tsx`).
  - Formally annotated `BulkImportSection.tsx` (superseded by `ItemMasterStudio.tsx` & `GlobalGridImportModal.tsx`).
  - Embedded in-app amber alert notices inside superseded components.

## 3. Files Created
- `docs/implementation/foundation/Domain_Modals_Wiring_And_Legacy_UX_Retirement_Plan_v6.65.0.md`
- `docs/walkthrough/foundation/Domain_Modals_Wiring_And_Legacy_UX_Retirement_v6.65.0.md`

## 4. Files Modified
- `src/components/PurchaseStudioTab.tsx`
- `src/components/wms/WmsStudioTab.tsx`
- `src/components/CrmStudioTab.tsx`
- `src/components/warehouse/LabelPrintModal.tsx`
- `src/components/billing/propos/ProPosWs.tsx`
- `src/components/BulkImportSection.tsx`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 5. Architecture Decisions
1. **Direct Workspace Action Bar Integration:** Instead of burying advanced calculation engines in hidden submenu trees, domain engines are exposed as first-class action buttons in the respective workspace headers.
2. **Non-Destructive Deprecation:** Superseded prototypes are not immediately removed from disk to preserve backward compatibility for any potential external scripts or references; instead, they are annotated with `@deprecated` in JSDoc and render explicit in-app notices directing developers and users to the canonical replacements.
3. **Responsive Visual Fallback:** Action button labels in toolbars automatically collapse on compact viewports using responsive Tailwind utility classes (`hidden sm:inline`, `hidden lg:inline`), preserving button iconography and touch targets.

## 6. Design Rationale
- Operators conducting stock audits in WMS frequently need to check batch shelf life and near-expiry goods without navigating away from the warehouse godown matrix.
- Buyers in Purchase Studio need instant access to safety-stock deficit calculations and economic order quantity (EOQ) auto-generation.
- CRM operators need unified 360 customer profiles, tier advancement tracking, and accounts receivable credit aging buckets (1–30d, 31–60d, 61–90d, >90d) directly in the CRM workspace.

## 7. Implementation Summary
- **Auto-PO Reorder:** Wired into `PurchaseStudioTab.tsx` with state `showAutoPOModal` and button `#purchase-studio-autopo-btn`.
- **Stock Expiry & Quarantines:** Wired into `WmsStudioTab.tsx` with state `showExpiryModal` and button `#wms-stock-expiry-btn`.
- **Smart Replenishment:** Wired into `WmsStudioTab.tsx` with state `showReplenishModal` and button `#wms-smart-replenish-btn`.
- **Customer 360 Loyalty:** Wired into `CrmStudioTab.tsx` with state `showLoyalty360Modal` and button `#crm-studio-cust360-btn`.
- **Customer Credit & Aging:** Wired into `CrmStudioTab.tsx` with state `showCreditModal` and button `#crm-studio-credit-btn`.
- **Deprecation Notices:** Added to `LabelPrintModal.tsx`, `ProPosWs.tsx`, and `BulkImportSection.tsx`.

## 8. Tests Executed
1. **TypeScript Typecheck:** `npx tsc --noEmit` — 0 errors (Exit code 0).
2. **Vitest Procurement Suite:** `npx vitest run src/tests/poGenerateUX.test.ts` — 11/11 passed (1.59s).
3. **Vitest 3-Way Matching Suite:** `npx vitest run src/tests/threeWayMatching.test.ts` — 4/4 passed (457ms).
4. **Backend Parity Test Suite:** `.venv\Scripts\python.exe -m pytest backend/tests/test_core_api_parity_wiring.py` — 9/9 passed (21.95s).
5. **Pending UX Audit Script:** `.venv\Scripts\python.exe scripts/audit_pending_ux.py` — Confirmed 5 domain modals transitioned from `[Unreferenced]` to `[Rendered]`.

## 9. Verification Results
- All 5 domain modals are active and rendered in parent workspaces.
- 0 TypeScript compiler errors across the entire codebase.
- Zero regressions in existing frontend and backend unit test suites.
- Code changes strictly comply with UADHP author headers and version `6.65.0`.

## 10. Known Limitations
- The underlying calculation engines for these modals currently operate on client-side state models. Future iterations will wire asynchronous batch persistence to PostgreSQL backend endpoints where applicable.

## 11. Future Work
- Connect `StockExpiryModal` batch status updates (quarantine, recall, write-off) directly to `POST /api/v1/wms/batch-stocks/{id}/quarantine`.
- Connect `AutoPOModal` generated PO drafts directly to `POST /api/v1/purchase/orders`.

## 12. Related ADRs
- `docs/architecture/ADR-005-Canonical-Table-Convergence.md`
- `docs/architecture/RESOLVER_FRAGMENTATION_DECISION_DOC.md`

## 13. Related RFCs
- `RFC-2026-08-WMS-Multi-Godown-FEFO.md`
- `RFC-2026-08-CRM-Loyalty-Tier-Engine.md`
