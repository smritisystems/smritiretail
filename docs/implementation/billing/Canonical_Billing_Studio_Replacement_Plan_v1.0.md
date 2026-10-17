<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.88.0
  Created      : 2026-10-17
  Modified     : 2026-10-17
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: SMRITI Complete Billing UX Replacement (Canonical Billing Studio)

**Version:** 1.0.0  
**Date:** 2026-10-17  
**Area:** Sales & Billing UX Architecture  
**Status:** Approved & In Execution  

---

## 1. Objective
Completely replace legacy, fragmented billing UX implementations with one fresh, authoritative, cashier-facing **SMRITI Billing Studio** (`SmritiBillingStudio.tsx`). The new studio enforces a clean, ergonomic, **SIMPLE-first workflow**: `Customer` → `Scan/Search Product` → `Cart` → `Review` → `Payment` → `Save/Print/Share`. Retire obsolete UI implementations, eliminate duplicate forms and competing workspaces, and redirect legacy billing routes into the single canonical workspace (`BillingWorkspace.tsx`).

---

## 2. Business Motivation
1. **Cashier Speed & Cognitive Load Reduction**: Fragmented screens with scattered dialogs, competing workspaces (`ProPosBillingTerm`, `BillingTerm`, `DistTaxInvoice`, `ProPosWs`), and confusing route fallbacks slow down counter checkouts and cause cashier errors.
2. **Authoritative Transaction Lifecycle**: Retail cash sales, wholesale credit sales, and distributor tax invoices must follow one disciplined, deterministic lifecycle: selecting the customer, scanning items, reviewing taxes, choosing tenders, and issuing verified receipts without duplicate submissions or stock corruption.
3. **Ergonomic SMRITI UI & Theme Support**: Modern high-density POS terminals require responsive UI layout, keyboard ergonomics (`F1` through `F10`), high contrast for barcode scanning, and native integration with the SMRITI UI Configuration & Theme Engine (supporting light and dark presets).
4. **Non-Destructive Governance Compliance**: All verified backend services (`CanonicalSalesPostingWriter`, `SalesStockAuthority`), GST calculation engines, PSV rules, pricing matrices, and database tables must remain 100% untouched and preserved.

---

## 3. Scope
- **Component Creation**:
  - `src/components/billing/SmritiBillingStudio.tsx`: Fresh canonical billing studio implementing the 6-stage SIMPLE-first workflow, keyboard hotkeys, multi-tender settlement, thermal/A4 receipt generation, and offline sync resilience.
- **Master Container Integration**:
  - `src/components/billing/BillingWorkspace.tsx`: Host `SmritiBillingStudio` as the primary billing experience across Retail POS, Credit Billing, and B2B Distributor modes while maintaining auxiliary HUD tools (Shift HUD, Z-Report, Daily Reports).
- **Route & Navigation Harmonization**:
  - `src/components/shell/TabRenderer.tsx`: Redirect all legacy billing routes (`pos`, `billing`, `billing-workspace`, `credit-billing`, `tax-invoice`, `dist-invoice`, `create-tax-invoice`, `propos`, `propos-workspace`, `propos-ws`, `enterprise-billing-suite`) into `BillingWorkspace`.
- **Legacy UI Retirement**:
  - `ProPosWs.tsx`: Formally retire and forward to `BillingWorkspace`.
  - `DistTaxInvoice.tsx`: Mark UI as superseded; preserve exported calculation helper functions for existing unit test compatibility.
  - Document complete list of retired legacy UI files.
- **Verification & Testing**:
  - Create comprehensive end-to-end lifecycle test suite: `src/tests/smritiBillingStudio.test.ts`.
  - Maintain 100% green status across all 119 existing test suites.

---

## 4. Current State
- Multiple competing billing implementations exist:
  - `ProPosBillingTerm.tsx` (3,770 lines): Complex legacy cashier terminal with 20+ scattered modal dialogs.
  - `BillingTerm.tsx` (4,305 lines): Monolithic distributor tax invoice terminal with older procedural UI.
  - `DistTaxInvoice.tsx` (1,310 lines) + 7 components in `src/components/sales/components/`: Orphaned duplicate of `BillingTerm.tsx` with zero UI routing.
  - `ProPosWs.tsx` (225 lines): Wrapper displaying deprecation alert badge.
  - `SmritiCreditBillingTerminal.tsx` (1,114 lines): Credit-specific terminal.
- Routes in `TabRenderer.tsx` send B2B routes (`tax-invoice`, `dist-invoice`) to retail POS and `propos-workspace` to deprecated `ProPosWs`.

---

## 5. Gap Analysis
| Workflow Stage | Legacy State | Canonical Billing Studio Target |
|---|---|---|
| **1. Customer** | Scattered modals, disconnected loyalty lookups, hidden credit limits | Unified customer bar with instant walk-in default, typeahead search, GSTIN validation, live credit limit, loyalty points, and PSV store codes |
| **2. Scan/Search** | Separate barcode listeners, multi-step F2 item search | Unified high-speed barcode input with auto-add, instant catalog typeahead, and modal F2 item lookup |
| **3. Cart** | Cluttered tables with varying column orders across terminals | Responsive line-item table with row numbering, barcode, stock availability warning, inline qty (+/-), unit rate, discount, GST %, and line total |
| **4. Review** | Tax calculations scattered across disparate utility functions | Live summary HUD with Subtotal, Line Discounts, Bill Promo/Coupons, Taxable Value, CGST/SGST/IGST breakdown, Round-off, and Net Payable |
| **5. Payment** | Complex modals with multi-step flows | Fast multi-tender settlement: Cash (with quick denomination chips & change due), UPI QR, Card EDC, Credit On-Account, with duplicate submission lockout |
| **6. Save/Print/Share** | Inconsistent receipt generation, print failures | Direct post to canonical API (`CanonicalSalesPostingWriter`), instant Thermal (80mm/58mm) and A4 Tax Invoice preview, barcode/QR receipt, and WhatsApp/Email sharing |

---

## 6. Architecture Impact
- **Architecture Pattern**: Unidirectional data flow with clean state transitions (`DRAFT` → `REVIEW` → `SETTLEMENT` → `COMMITTED`).
- **Single Point of Write**: All sales transactions converge onto `CanonicalSalesPostingWriter.post_sales_transaction` and `SalesStockAuthority` in PostgreSQL. Zero backend API alterations.
- **UI Configuration Engine**: Native integration with `ThemeContext` (`light` and `dark` modes, density tokens, and CSS variables).

---

## 7. Proposed Design

### The SIMPLE-First Workflow Architecture
```text
┌────────────────────────────────────────────────────────────────────────┐
│                        SMRITI Billing Studio                           │
├────────────────────────────────────────────────────────────────────────┤
│ 1. CUSTOMER   : Walk-in Cash [Default] | Search by Mobile/Name/GSTIN   │
│                 Shows: Loyalty Balance | Credit Limit | PSV Store Code │
├────────────────────────────────────────────────────────────────────────┤
│ 2. SCAN/SEARCH: Barcode Scanner (Autofocused) | F2 Advanced Lookup     │
│                 Instant Item Add with Audio/Toast confirmation         │
├────────────────────────────────────────────────────────────────────────┤
│ 3. CART       : High-Speed Grid (Qty +/-, Discounts, Stock Alert)       │
│                 Hold/Park Bill (F5) | Recall Parked Bill (F6)          │
├────────────────────────────────────────────────────────────────────────┤
│ 4. REVIEW     : Live Totals HUD (Gross, Disc, CGST+SGST/IGST, Round)   │
│                 Prominent Net Payable Grand Total                      │
├────────────────────────────────────────────────────────────────────────┤
│ 5. PAYMENT    : Cash (Fast Denominations + Change Due) | UPI QR | Card │
│                 Credit / On-Account | Split Tender | Anti-Duplicate     │
├────────────────────────────────────────────────────────────────────────┤
│ 6. SAVE/PRINT : Canonical Sales Post | Thermal / A4 Receipt | Share    │
│                 Press F1 / Enter to start fresh cart for next customer  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Files Created
1. `src/components/billing/SmritiBillingStudio.tsx`: The canonical SMRITI Billing Studio component.
2. `src/tests/smritiBillingStudio.test.ts`: Complete billing lifecycle automated test suite.
3. `docs/implementation/billing/Canonical_Billing_Studio_Replacement_Plan_v1.0.md`: This implementation plan.
4. `docs/walkthrough/billing/Canonical_Billing_Studio_Replacement_v1.0.md`: Formal 13-section walkthrough.

---

## 9. Files Modified
1. `src/components/billing/BillingWorkspace.tsx`: Host `SmritiBillingStudio` as default primary billing studio; tri-modal switching and auxiliary tools.
2. `src/components/shell/TabRenderer.tsx`: Harmonize all billing routes to `BillingWorkspace`.
3. `src/components/billing/propos/ProPosWs.tsx`: Forward to `BillingWorkspace`.
4. `docs/implementation/README.md`: Master index update.
5. `docs/walkthrough/README.md`: Master index update.

---

## 10. Dependencies
- React 18, TypeScript, Tailwind CSS with SMRITI design tokens.
- Lucide React icon set.
- Backend canonical endpoints: `/api/v1/pos/checkout`, `/api/v1/billing/checkout`, `/api/v1/sales/invoices`.
- Offline sync engine: `ProPosOfflineSyncEngine`.

---

## 11. Risks & Mitigations
| Risk | Severity | Mitigation |
|---|---|---|
| Double-clicking payment triggers multiple invoices | High | Strict `isSubmitting` flag lockout with client transaction UUID idempotency token. |
| Cashier offline during counter rush | High | Immediate fallback to `ProPosOfflineSyncEngine.queueOfflineSale` with visual indicator. |
| Customer credit limit exceeded on credit mode | Medium | Hard stop in payment review preventing submission when net amount > available credit. |
| Legacy test suites break on file changes | Medium | Non-destructive replacement; existing helper functions and calculation interfaces preserved. |

---

## 12. Rollback Strategy
All changes are isolated to frontend UI components and route definitions. Rollback is instantly achieved via Git revert of the target commit without impacting backend database migrations, schemas, or ledgers.

---

## 13. Verification Plan
1. **Automated Unit Tests**: Execute `npx vitest run src/tests/smritiBillingStudio.test.ts`.
2. **Regression Verification**: Execute all 13 billing-related test suites.
3. **TypeScript Validation**: Execute `npx tsc --noEmit` to verify 0 errors.
4. **Theme & Responsiveness**: Verify both light and dark theme classes and responsive layout.

---

## 14. Test Plan
- Customer selection & walk-in default validation.
- Product barcode scanning & item quantity manipulation.
- Line and bill-level discount calculation with GST tax slab breakdown.
- Multi-tender payment settlement with cash change calculation.
- Double-submission lock verification.
- Offline queuing fallback verification.
- Route redirect and alias verification in `TabRenderer`.

---

## 15. Documentation Impact
- Update `docs/implementation/README.md`.
- Create `docs/walkthrough/billing/Canonical_Billing_Studio_Replacement_v1.0.md`.
- Update `docs/walkthrough/README.md`.

---

## 16. Deployment Plan
Pure client-side code modification. Included in standard frontend Vite bundle compilation (`npm run build`).

---

## 17. Status
Approved & In Execution.

---

## 18. Related ADRs
- `ADR-002`: Strangler Fig Migration of Legacy Billing.
- `ADR-011`: Single Point of Write for Sales Invoices (`CanonicalSalesPostingWriter`).

---

## 19. Related Walkthroughs
- `docs/walkthrough/sales/Conditional_Store_Code_And_PSV_Mapping_v1.0.md`
- `docs/walkthrough/billing/Canonical_Billing_Studio_Replacement_v1.0.md`
