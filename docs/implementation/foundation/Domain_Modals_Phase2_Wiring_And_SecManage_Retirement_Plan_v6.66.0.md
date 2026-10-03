<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.66.0
  Created      : 2026-10-03
  Modified     : 2026-10-03
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: Domain Modals Phase 2 Wiring & SecManage Retirement Plan v6.66.0

## 1. Objective
Complete Phase 2 of pending UX remediation by wiring five import-only domain modals (`ComplaintCRMModal`, `LoyaltyLedgerModal`, `GiftCardLifecycleModal`, `GiftVoucherModal`, `PricingStudioModal`) into their authoritative parent workspaces (`CrmStudioTab.tsx`, `BillingWorkspace.tsx`, and `SmritiSalesPromotionsStudio.tsx`), while formally deprecating the legacy security modal (`SecManageDlg.tsx`) in favor of the canonical full-page `SecurityAccessShell.tsx`.

## 2. Business Motivation
Following the forensic audit of pending frontend interfaces, 6 modals were identified as imported or scaffolded without active mounting in user journeys:
- **Customer Complaints & Escalations (`ComplaintCRMModal.tsx`)**: Service ticket registration, SLA tracking, priority routing, and issue resolution workflows for retail CRM operators.
- **Loyalty Points Ledger (`LoyaltyLedgerModal.tsx`)**: Granular transaction-by-transaction customer loyalty audit trail (earned, burned, expired points) with balance verification.
- **Gift Card Lifecycle Management (`GiftCardLifecycleModal.tsx`)**: Card issuance, PIN activation, balance reloads, multi-use redemptions, and freeze/block governance at the POS billing terminal.
- **Gift Voucher Issuance & Redemption (`GiftVoucherModal.tsx`)**: Campaign-driven single/multi-use promo voucher verification and POS checkout deductions.
- **Dynamic Pricing & Discount Simulator (`PricingStudioModal.tsx`)**: Real-time evaluation sandbox testing multi-tier customer group pricing (VIP, Wholesale, Staff), SKU-specific discounts, stackable coupon codes, and line-level discount breakdowns.
- **Legacy Security Dialog (`SecManageDlg.tsx`)**: Superseded on 2026-09-26 by `SecurityAccessShell.tsx`, which provides a full-page modern light studio design replacing modal-in-tab nesting.

Connecting these components gives retail cashiers, loyalty managers, and merchandisers immediate access to these core tools directly within their native workspaces.

## 3. Scope
- **CRM Studio Workspace (`src/components/CrmStudioTab.tsx`):**
  - Mount `ComplaintCRMModal` with header action button `#crm-studio-complaints-btn` ("Complaints").
  - Mount `LoyaltyLedgerModal` with header action button `#crm-studio-loyalty-ledger-btn` ("Points Ledger").
- **POS Billing Workspace (`src/components/billing/BillingWorkspace.tsx`):**
  - Mount `GiftCardLifecycleModal` with header action button `#pos-gift-cards-btn` ("Gift Cards").
  - Mount `GiftVoucherModal` with header action button `#pos-gift-vouchers-btn` ("Vouchers").
- **Sales Promotions & Schemes Studio (`src/components/promotions/SmritiSalesPromotionsStudio.tsx`):**
  - Mount `PricingStudioModal` with header action button `#promotions-pricing-studio-btn` ("Pricing Studio").
- **Legacy Security Dialog (`src/components/security/SecManageDlg.tsx`):**
  - Add formal `@deprecated` JSDoc annotation referencing `SecurityAccessShell.tsx`.
  - Add top-edge amber notice banner signaling legacy status.
- **Audit Script Hardening (`scripts/audit_pending_ux.py`):**
  - Enhance component export detection via regex AST (`export (default)? const|function|class <name>`) to eliminate false-positive import-only detection on re-exported components.
  - Exclude test files (`src/tests/`) from the `imported_by` reference graph.

## 4. Current State
- All 5 domain modals are fully implemented React components with comprehensive state handling.
- `SecManageDlg.tsx` was unmounted because the application router (`TabRenderer.tsx`) routes all security views to `SecurityAccessShell.tsx`.
- Modals were previously imported in their respective parent files or test suites but were never mounted in the JSX tree.

## 5. Gap Analysis
| Component | Prior Status | Gap | Target State (v6.66.0) |
|---|---|---|---|
| `ComplaintCRMModal.tsx` | Import-Only | Not mounted in `CrmStudioTab` JSX | Mounted, triggered via `#crm-studio-complaints-btn` |
| `LoyaltyLedgerModal.tsx` | Import-Only | Not mounted in `CrmStudioTab` JSX | Mounted, triggered via `#crm-studio-loyalty-ledger-btn` |
| `GiftCardLifecycleModal.tsx` | Import-Only | Not mounted in `BillingWorkspace` JSX | Mounted, triggered via `#pos-gift-cards-btn` |
| `GiftVoucherModal.tsx` | Import-Only | Not mounted in `BillingWorkspace` JSX | Mounted, triggered via `#pos-gift-vouchers-btn` |
| `PricingStudioModal.tsx` | Import-Only / Test-only | Not mounted in `SmritiSalesPromotionsStudio` JSX | Mounted, triggered via `#promotions-pricing-studio-btn` |
| `SecManageDlg.tsx` | Import-Only | Superseded by `SecurityAccessShell` | Marked `@deprecated` with visual banner |

## 6. Architecture Impact
- **Database Schema:** Zero schema drift; all backend endpoints remain authoritative.
- **State Management:** Parent components control modal open/close states via local React `useState` hooks.
- **Accessibility:** All trigger buttons include explicit `id`, `aria-label`, and `title` attributes.
- **Modularity:** No tightly-coupled dependencies introduced; modals accept standard `isOpen`, `onClose`, and `onNotification` props.

## 7. Proposed Design
- Header action bars in `CrmStudioTab`, `BillingWorkspace`, and `SmritiSalesPromotionsStudio` receive lightweight, styled button triggers adhering to SAP Fiori Horizon / SMRITI Design Tokens.
- Modals open in modal overlays with backdrop blur and escape key dismissal.
- `SecManageDlg` displays an amber `AlertTriangle` banner at the top of the dialog header.

## 8. Files Created
- `docs/implementation/foundation/Domain_Modals_Phase2_Wiring_And_SecManage_Retirement_Plan_v6.66.0.md`
- `docs/walkthrough/foundation/Domain_Modals_Phase2_Wiring_And_SecManage_Retirement_v6.66.0.md`

## 9. Files Modified
- `src/components/CrmStudioTab.tsx`
- `src/components/billing/BillingWorkspace.tsx`
- `src/components/promotions/SmritiSalesPromotionsStudio.tsx`
- `src/components/security/SecManageDlg.tsx`
- `scripts/audit_pending_ux.py`
- `package.json`
- `src/config/version.ts`
- `backend/app/core/config.py`
- `CHANGELOG.md`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`

## 10. Dependencies
- React 18
- Lucide React iconography
- Existing engine utilities (`complaintCRMEngine.ts`, `loyaltyEngine.ts`, `pricingDiscountEngine.ts`)

## 11. Risks
- Risk: Modal state leaks across tab switches. Mitigation: Modal states are scoped to parent component lifecycle.
- Risk: Cluttering action bars on small mobile screens. Mitigation: Button labels collapse responsively (`hidden md:inline`, `hidden sm:flex`).

## 12. Rollback Strategy
All changes are purely additive JSX mountings and deprecation annotations. Rollback can be performed cleanly via `git revert` without database migrations or schema alterations.

## 13. Verification Plan
1. `npx tsc --noEmit` must pass with exit code 0 (0 errors).
2. Vitest test runner must pass 100% of related test suites (`proposSupervisorAuth.test.ts`, `complaintCRMEngine.test.ts`, `dynamicPricingEngine.test.ts`).
3. Audit script `scripts/audit_pending_ux.py` must verify that the 5 wired modals transition from `Import-Only` to `Rendered`.
4. Version SSOT script `scripts/validate_version_ssot.py` must pass with exit code 0.

## 14. Test Plan
- Unit tests: Execute Vitest suites for CRM, POS, and Pricing engines.
- Static analysis: Typecheck via TypeScript compiler.
- Architectural audit: Run `audit_pending_ux.py`.

## 15. Documentation Impact
- Update `CHANGELOG.md` under `[6.66.0]`.
- Update master indices in `docs/implementation/README.md` and `docs/walkthrough/README.md`.
- Produce comprehensive walkthrough `Domain_Modals_Phase2_Wiring_And_SecManage_Retirement_v6.66.0.md`.

## 16. Deployment Plan
Commit and push from `D:\Smriti_Retail_OS\apps\smriti_retail_os` or local branch `smritiNX`, pull into test environments, and run frontend production build `npm run build`.

## 17. Status
Completed

## 18. Related ADRs
- `ADR-PROMO-01`: SMRITI Sales Promotion & Pricing Scheme Visual Rule Builder Architecture
- `ADR-RBAC-01`: SMRITI Security & Access Control Shell

## 19. Related Walkthroughs
- `docs/walkthrough/foundation/Domain_Modals_Phase2_Wiring_And_SecManage_Retirement_v6.66.0.md`
- `docs/walkthrough/foundation/Domain_Modals_Wiring_And_Legacy_UX_Retirement_v6.65.0.md`
