<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.89.0
  Created      : 2026-10-24
  Modified     : 2026-10-24
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Retail OS — Premium Billing Desk UX Transformation Implementation Plan (v6.89.0)

## 1. Objective
Transform the canonical SMRITI Retail OS Billing Desk (`BillingTerm.tsx`, `BillingWorkspace.tsx`, and `CtxInspectorHUD.tsx`) into a high-density, modern, enterprise-grade retail billing experience embodying the design principle: **"Power of an Enterprise ERP. Simplicity of WhatsApp."**

## 2. Business Motivation
Retail cashier throughput, speed, and accuracy are paramount to retail operations. The legacy billing desk exhibited dual-header competition, occluded totals panels caused by floating inspectors, button clipping on checkout triggers, and vertical sprawling that required unnecessary scrolling. Resolving these UX defects creates an effortless, fast checkout experience while preserving 100% of GST compliance and enterprise accounting guarantees.

## 3. Scope
- Modify existing `BillingWorkspace.tsx`, `BillingTerm.tsx`, and `CtxInspectorHUD.tsx` in place.
- Do NOT create duplicate billing workspaces or routes.
- Preserve 100% of existing calculation logic, statutory GST Rule 46(b) prefixing, Section 15 add-ons/deductions, keyboard shortcuts, and backend APIs.

## 4. Current State
- Dual headers rendered by `BillingWorkspace` and `BillingTerm` competing for screen real estate.
- `CtxInspectorHUD.tsx` floating at `bottom-6 right-6` with 320px width, occluding totals and F8 settlement buttons upon focus.
- Grid rows and totals stacked vertically in a single column, pushing net amount and checkout buttons below the 900px fold.
- `Exact Cash (F7)` and `Settle & Save (F8)` buttons appearing crowded or clipped on smaller viewport widths.

## 5. Gap Analysis
- Missing unified, single-tier header with live clock, doc number edit pencil, and quick action icons.
- Missing 3-column organized transaction card grouping Customer, Transaction parameters, and Staff & Recall.
- Missing side-by-side grid (~74%) and dedicated bill summary card (~26%) layout.
- Missing bottom drawer architecture to conceal optional B2B transporter and add-on tables when not in use.

## 6. Architecture Impact
- Pure presentation and component architecture optimization. Zero database schema migrations required.
- Seamless coordination between `BillingWorkspace` (host router) and `BillingTerm` (canonical desk engine).
- Contextual HUD suppression ensures zero interference with transactional checkout.

## 7. Proposed Design
- **Zone A (Compact Top Header):** Single canonical header with menu toggle, brand badge, sales channel pill, live date/time, doc number pill with edit pencil, status mode pill (`[ NEW ]` / `[ DRAFT ]` / `[ AUDIT ]`), quick action buttons (`[ 📄 New ]`, `[ 💾 Save ]`, `[ 🖨 Print ]`, `[ ⋯ More ▾ ]`), shift status, and avatar.
- **Zone B (Transaction Details Card):** 3-column card: Customer search (`F2`) + active chip; 2×2 grid of selects (Source, Channel, Bill Type, Transaction) + expandable `▾ More Details` drawer; Sales Staff select + `[ ⏱ Recall ]` button.
- **Zone C (Line Items Grid, ~74% width):** High-density 34px row table with 10 columns, double-click edit, row inspector, and inline `F11` Direct Entry row.
- **Zone D (Dedicated Bill Summary Card, ~26% width):** Dedicated right sidebar card with breakdown, item/qty pills, and prominent Net Payable banner.
- **Zone E (Drawer Container & Bottom Action Bar):** Collapsible drawer above action bar for Transporter, Payment, AddOns, and Remarks. Action bar features drawer tabs on the left, and prominent `[ 💵 Exact Cash (F7) ]` and `[ ✔ Settle & Save (F8) ]` on the right.

## 8. Files Created
- `docs/walkthrough/billing/Billing_Desk_UX_Transformation_v6.89.0.md`
- `docs/implementation/billing/Billing_Desk_UX_Transformation_Plan_v6.89.0.md`

## 9. Files Modified
- `src/components/drilldown/CtxInspectorHUD.tsx`
- `src/components/billing/BillingWorkspace.tsx`
- `src/components/billing/BillingTerm.tsx`

## 10. Dependencies
- React 18
- Lucide React (icons)
- Tailwind CSS (styling)
- Vitest & Playwright (testing & verification)

## 11. Risks
- *Risk:* Layout breakage on narrow screens (<1024px).
  - *Mitigation:* Responsive column wrapping (`flex-col lg:flex-row`, `grid-cols-1 lg:grid-cols-12`).
- *Risk:* Regressions in keyboard shortcut dispatchers.
  - *Mitigation:* Preserved identical event listeners and refs (`directStockNoRef`, `customerInputRef`, `handleExactCashSettlementRef`).

## 12. Rollback Strategy
Git revert on `src/components/billing/BillingTerm.tsx`, `BillingWorkspace.tsx`, and `CtxInspectorHUD.tsx` restores previous layout cleanly without database impact.

## 13. Verification Plan
1. Type checking with `npx tsc --noEmit`.
2. Unit and integration tests with `npx vitest run`.
3. Headless Playwright visual inspection across viewports (1440×900, 1920×1080).
4. Interactive transaction flow: customer search, barcode entry, rate/qty auto-calculation, drawer toggle, and settlement modal trigger.

## 14. Test Plan
- Run `src/tests/canonicalBillingConsolidation.test.ts` (10/10)
- Run `src/tests/billingTerm.test.ts` (8/8)
- Run `src/tests/smritiF2BillingSearch.test.ts` (22/22)
- Run `src/tests/invoicingTransactionBrowser.test.ts` (5/5)
- Run `src/tests/billingWorkspaceConvergence.test.ts` (5/5)

## 15. Documentation Impact
- Update `docs/walkthrough/README.md`
- Update `docs/implementation/README.md`
- Update `CHANGELOG.md`

## 16. Deployment Plan
Sync working tree to development branch `smritiNX`, verify with automated CI suite, and deploy via standard container reload.

## 17. Status
Completed

## 18. Related ADRs
- `docs/adr/ADR-0042_Canonical_Billing_Consolidation.md`
- `docs/adr/ADR-0058_Statutory_Section_15_GST_Computation_Engine.md`

## 19. Related Walkthroughs
- `docs/walkthrough/billing/Billing_Desk_UX_Transformation_v6.89.0.md`
