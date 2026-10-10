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

# Implementation Plan: High-Value Domain Modals Wiring & Legacy UX Retirement v6.65.0

## 1. Objective
Connect orphaned, high-value frontend domain calculation engines and interactive modals (Auto-PO Reorder, Stock Expiry & Quarantines, Smart Replenishment & Safety Stock, Customer 360 Loyalty, Customer Credit Limits & Aging) into their canonical parent studio workspaces (`PurchaseStudioTab`, `WmsStudioTab`, and `CrmStudioTab`), while formally deprecating superseded legacy duplicate components (`LabelPrintModal`, `ProPosWs`, `BulkImportSection`) to ensure clean UX navigation and eliminate dead or shadowed interface patterns.

## 2. Business Motivation
SMRITI possesses rich client-side and hybrid calculation engines for retail operations:
- **Auto-PO Engine**: Calculates reorder points, economic order quantities (EOQ), safety stock breaches, and auto-generates purchase order drafts.
- **Stock Expiry Engine**: Tracks batch expiration dates, quarantine statuses, and manufacturer shelf-life across warehouses.
- **Smart Replenishment Engine**: Real-time safety stock and seasonal demand push calculations across multi-echelon godowns.
- **Customer 360 & Credit Engines**: Complete loyalty tier progression, points bonus/expiry controls, and receivable aging buckets (1–30d, 31–60d, 61–90d, >90d).

Previously, these modals were unreferenced in parent navigation trees. Conversely, older prototypes (`ProPosWs`, `LabelPrintModal`, and `BulkImportSection`) lingered in the source tree without formal deprecation, creating confusion for developers and users. This implementation integrates the canonical capabilities and marks obsolete artifacts.

## 3. Scope
- **Parent Workspace Wiring:**
  - `src/components/PurchaseStudioTab.tsx`: Wire `AutoPOModal.tsx` with header action button `#purchase-studio-autopo-btn`.
  - `src/components/wms/WmsStudioTab.tsx`: Wire `StockExpiryModal.tsx` and `SmartReplenishmentModal.tsx` with header action buttons `#wms-stock-expiry-btn` and `#wms-smart-replenish-btn`.
  - `src/components/CrmStudioTab.tsx`: Wire `Customer360LoyaltyModal.tsx` and `CustomerCreditModal.tsx` with header action buttons `#crm-studio-cust360-btn` and `#crm-studio-credit-btn`.
- **Legacy Component Deprecation:**
  - `src/components/warehouse/LabelPrintModal.tsx`: Add `@deprecated` annotation referencing `LabelPrintingSec.tsx` and in-app notice banner.
  - `src/components/billing/propos/ProPosWs.tsx`: Add `@deprecated` annotation referencing `BillingWorkspace.tsx` and in-app notice banner.
  - `src/components/BulkImportSection.tsx`: Add `@deprecated` annotation referencing `ItemMasterStudio.tsx` and `GlobalGridImportModal.tsx` and in-app notice banner.

## 4. Current State
- The 5 high-value modals existed as complete, functional React components backed by rich calculation engines (`stockExpiryEngine.ts`, `replenishmentEngine.ts`, `loyaltyEngine.ts`, `customerCreditEngine.ts`, `autoPoEngine.ts`).
- They were categorized as `Unreferenced Modals` in `scripts/audit_pending_ux.py`.
- Older components (`ProPosWs`, `LabelPrintModal`, `BulkImportSection`) were unreferenced but lacked deprecation signaling.

## 5. Gap Analysis
| Component | Status Before | Gap | Target State |
|---|---|---|---|
| `AutoPOModal.tsx` | Unreferenced | Not triggerable from Purchase Studio | Triggerable via header button `#purchase-studio-autopo-btn` |
| `StockExpiryModal.tsx` | Unreferenced | Not triggerable from WMS Studio | Triggerable via header button `#wms-stock-expiry-btn` |
| `SmartReplenishmentModal.tsx` | Unreferenced | Not triggerable from WMS Studio | Triggerable via header button `#wms-smart-replenish-btn` |
| `Customer360LoyaltyModal.tsx` | Unreferenced | Not triggerable from CRM Studio | Triggerable via header button `#crm-studio-cust360-btn` |
| `CustomerCreditModal.tsx` | Unreferenced | Not triggerable from CRM Studio | Triggerable via header button `#crm-studio-credit-btn` |
| `LabelPrintModal.tsx` | Unreferenced | Superseded by `LabelPrintingSec.tsx` | Formally `@deprecated` with visual banner |
| `ProPosWs.tsx` | Unreferenced | Superseded by `BillingWorkspace.tsx` | Formally `@deprecated` with visual banner |
| `BulkImportSection.tsx` | Unreferenced | Superseded by `ItemMasterStudio.tsx` | Formally `@deprecated` with visual banner |

## 6. Architecture Impact
- Zero database schema drift.
- Zero breaking API changes.
- Frontend state architecture remains clean with controlled React state hooks for modal visibility (`isOpen`, `onClose`, `onNotification`).
- Clean separation between active studios and superseded prototypes.

## 7. Proposed Design
1. **Purchase Studio:**
   - Toolbar button with icon `auto_mode` styled with amber theme accents.
   - Modal lifecycle cleanly controlled by `showAutoPOModal`.
2. **WMS Studio:**
   - Toolbar buttons beside refresh button with `AlertTriangle` ("Stock Expiry") and `Layers` ("Smart Replenish").
   - Modals rendered conditionally at the container root.
3. **CRM Studio:**
   - Action bar buttons beside Export Pipeline with `UserCheck` ("Customer 360") and `CreditCard` ("Credit & Aging").
   - Modals rendered conditionally at the container root.
4. **Deprecation Banners:**
   - Top-edge amber alert banner indicating the canonical replacement component.

## 8. Files Created
- `docs/implementation/foundation/Domain_Modals_Wiring_And_Legacy_UX_Retirement_Plan_v6.65.0.md`
- `docs/walkthrough/foundation/Domain_Modals_Wiring_And_Legacy_UX_Retirement_v6.65.0.md`

## 9. Files Modified
- `src/components/PurchaseStudioTab.tsx`
- `src/components/wms/WmsStudioTab.tsx`
- `src/components/CrmStudioTab.tsx`
- `src/components/warehouse/LabelPrintModal.tsx`
- `src/components/billing/propos/ProPosWs.tsx`
- `src/components/BulkImportSection.tsx`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 10. Dependencies
- React 18, Lucide React icons, Material Symbols.
- Existing engine utilities in `src/utils/`.

## 11. Risks
- Minor UI layout crowding on small mobile viewports.
  - *Mitigation:* Responsive labels (`hidden lg:inline`, `hidden sm:inline`) collapse button text to icons on smaller screens.

## 12. Rollback Strategy
- Atomic Git commit revert (`git revert <commit>`).

## 13. Verification Plan
- `npx tsc --noEmit` — 0 errors.
- `scripts/audit_pending_ux.py` — Assert targeted modals transition to `[Rendered]`.
- Vitest suites (`poGenerateUX.test.ts`, `threeWayMatching.test.ts`) — 100% green.
- Pytest backend suite (`test_core_api_parity_wiring.py`) — 9/9 green.

## 14. Test Plan
- Unit tests: Execute existing Vitest test files.
- Static analysis: Full TypeScript type check.

## 15. Documentation Impact
- Updated Walkthrough Master Index (`docs/walkthrough/README.md`).
- Walkthrough document created.
- CHANGELOG updated.

## 16. Deployment Plan
- Merge to `smritiNX` branch and deploy via standard CI/CD pipeline.

## 17. Status
Completed

## 18. Related ADRs
- `docs/architecture/ADR-005-Canonical-Table-Convergence.md`
- `docs/architecture/RESOLVER_FRAGMENTATION_DECISION_DOC.md`

## 19. Related Walkthroughs
- `docs/walkthrough/foundation/Domain_Modals_Wiring_And_Legacy_UX_Retirement_v6.65.0.md`
- `docs/walkthrough/procurement/Procurement_PO_To_GRN_Headless_Cycle_And_Studio_Decoupling_v1.0.0.md`
