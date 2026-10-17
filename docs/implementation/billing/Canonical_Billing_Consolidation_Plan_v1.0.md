<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.87.0
  Created      : 2026-10-17
  Modified     : 2026-10-17
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: Canonical Billing Workspace Consolidation (Phase 1)

**Version:** 1.0.0  
**Date:** 2026-10-17  
**Area:** Sales & POS Billing Architecture  
**Status:** In Progress  

---

## 1. Objective
Consolidate fragmented billing entry points, competing POS screens, and distributor invoicing terminals in SMRITI Retail OS into a single, cohesive, authoritative billing workspace (`BillingWorkspace.tsx`). Eliminate navigation inversions where distributor tax invoicing was trapped inside a deprecated workspace (`ProPosWs.tsx`) while statutory routes (`tax-invoice`, `dist-invoice`) dumped users into the retail cashier screen.

---

## 2. Business Motivation
1. **Operator Productivity & Confusion Reduction**: Cashiers, wholesale billing clerks, and distributor order desk operators require dedicated workflows (retail counter speed vs credit account exposure vs B2B statutory dispatch), but navigating between fragmented, duplicate, and deprecated screens causes cognitive overhead and billing errors.
2. **Statutory Tax Invoice Integrity**: Modern Trade transactions (e.g. Reliance Retail, Trent, DMart) require Customer PO linking, store code capture, and automatic PSV party mapping. These capabilities must be directly accessible from the primary billing workspace rather than hidden in deprecated components.
3. **Audit & Compliance Safety**: Retiring orphaned duplicate components (`DistTaxInvoice.tsx`, legacy `BillingService.ts`) and unifying all client billing on canonical backend services (`CanonicalSalesPostingWriter`, `SalesStockAuthority`) guarantees zero double-booking, robust stock ledger mutation, and full tenant boundary enforcement.

---

## 3. Scope
- **Frontend Architecture**:
  - `BillingWorkspace.tsx`: Expand to tri-modal operational workspace (`RETAIL_POS`, `CREDIT_BILLING`, `B2B_DISTRIBUTOR`), mount `BillingTerm.tsx`, add header mode switcher, and wire `Alt+1`, `Alt+2`, `Alt+3` hotkeys.
  - `TabRenderer.tsx`: Harmonize all billing routes (`pos`, `billing`, `credit-billing`, `tax-invoice`, `dist-invoice`, `propos-workspace`) to instantiate `BillingWorkspace` with appropriate `initialMode` and `initialView`.
  - `ProPosWs.tsx`: Deprecate and safely redirect to `BillingWorkspace`.
  - `DistTaxInvoice.tsx`: Mark as superseded duplicate.
- **Backend Architecture**:
  - Maintain canonical transaction posting authority in `CanonicalSalesPostingWriter.post_sales_transaction` and `SalesStockAuthority`.
  - Zero breaking changes to existing endpoints (`/api/v1/billing/checkout`, `/api/v1/pos/checkout`, `/api/v1/sales/invoices`).
- **Test Automation**:
  - Update `billingWorkspaceConvergence.test.ts` to validate tri-modal contracts.
  - Verify all 119 existing automated unit and integration tests remain 100% green.

---

## 4. Current State
- `BillingWorkspace.tsx` only renders `SmritiProPosBillingTerminal` (Retail POS) and `SmritiCreditBillingTerminal` (Credit Billing).
- `BillingTerm.tsx` (authoritative distributor terminal with Modern Trade store codes and PSV mapping) is only rendered in `ProPosWs.tsx`, which displays a warning that it is deprecated.
- Routes `tax-invoice` and `dist-invoice` route to `BillingWorkspace` with `initialMode="RETAIL_POS"`, dumping B2B operators into the retail cashier screen.
- Orphaned component `DistTaxInvoice.tsx` duplicates 1,310 lines of legacy code with zero UI routing.

---

## 5. Gap Analysis
| Requirement | Current State | Target State | Gap |
|---|---|---|---|
| Single Canonical Billing Entry | Fragmented across `BillingWorkspace`, `ProPosWs`, `DistTaxInvoice` | `BillingWorkspace.tsx` sole entry point | Incomplete mode coverage in container shell |
| Distributor Invoicing Access | Trapped inside deprecated `ProPosWs.tsx` | Mounted in `BillingWorkspace` under `B2B_DISTRIBUTOR` mode | Missing mount and mode handler in `BillingWorkspace.tsx` |
| Route Directing for Tax Invoices | `tax-invoice` and `dist-invoice` open Retail POS | Opens `BillingWorkspace` with `initialMode="B2B_DISTRIBUTOR"` | `TabRenderer.tsx` lacks mode parameterization |
| Keyboard Ergonomics | `Alt+1` toggles Retail POS only | `Alt+1` (POS), `Alt+2` (Credit), `Alt+3` (B2B Distributor) | Missing shortcuts for Credit and B2B modes |

---

## 6. Architecture Impact
- **Component Hierarchy**: `BillingWorkspace` becomes the master shell orchestrating three domain-specific terminal engines (`SmritiProPosBillingTerminal`, `SmritiCreditBillingTerminal`, `BillingTerm`) while sharing auxiliary views (`SmritiProPosEodReport`, `SmritiDailyReportsDashboard`).
- **State Management**: Clean local mode switching without cross-contaminating cart or header states.
- **Backend Contract**: 100% invariant preservation. All transactions converge onto `CanonicalSalesPostingWriter`.

---

## 7. Proposed Design
1. **Mode Switcher in `BillingWorkspace.tsx` Header**:
   - Tab 1: **Retail POS** (`Alt+1`) — Counter cash/card/UPI, active shift HUD, thermal slip printing.
   - Tab 2: **Credit Billing** (`Alt+2`) — Wholesale on-account sales, live exposure limit checks, docked catalog.
   - Tab 3: **B2B / Tax Invoice** (`Alt+3`) — Customer PO conversion, Modern Trade store codes, PSV resolution, A4 tax invoice print.
2. **TabRenderer Direct Route Mapping**:
   - `pos`, `billing`, `billing-workspace` -> `initialMode="RETAIL_POS"`
   - `credit-billing`, `credit-sale` -> `initialMode="CREDIT_BILLING"`
   - `tax-invoice`, `dist-invoice`, `create-tax-invoice` -> `initialMode="B2B_DISTRIBUTOR"`
   - `propos`, `propos-workspace`, `enterprise-billing-suite` -> `initialMode="RETAIL_POS"` (safe redirect)

---

## 8. Files Created
1. `docs/implementation/billing/Canonical_Billing_Consolidation_Plan_v1.0.md` — This formal 19-section plan.
2. `docs/walkthrough/billing/Canonical_Billing_Consolidation_v1.0.md` — Formal 13-section walkthrough.
3. `src/tests/canonicalBillingConsolidation.test.ts` — Comprehensive Vitest suite validating tri-modal switching and route parity.

---

## 9. Files Modified
1. `src/components/billing/BillingWorkspace.tsx` — Added `B2B_DISTRIBUTOR` mode, mounted `BillingTerm`, added header mode switcher and `Alt+1`/`Alt+2`/`Alt+3` hotkeys.
2. `src/components/shell/TabRenderer.tsx` — Parameterized billing cases with `initialMode` and redirected `propos-workspace`.
3. `src/tests/billingWorkspaceConvergence.test.ts` — Extended mode and view contract assertions.
4. `docs/implementation/README.md` — Appended master index with this plan.
5. `docs/walkthrough/README.md` — Appended master index with walkthrough.

---

## 10. Dependencies
- React 18, Lucide React icons.
- `CanonicalSalesPostingWriter` in backend (`canonical_sales_writer.py`).
- Existing terminal components (`ProPosBillingTerm.tsx`, `SmritiCreditBillingTerminal.tsx`, `BillingTerm.tsx`).

---

## 11. Risks
| Risk | Severity | Mitigation |
|---|---|---|
| Existing POS tests breaking on type change | Medium | Expand type union non-destructively: `"RETAIL_POS" \| "CREDIT_BILLING" \| "B2B_DISTRIBUTOR"`. |
| Unintended state sharing between terminals | Low | Each terminal maintains independent internal component state; rendered conditionally based on `auxView`. |
| Breaking deep links to `tax-invoice` | Low | `TabRenderer.tsx` forwards `tax-invoice` directly to `initialMode="B2B_DISTRIBUTOR"` with zero URL schema changes. |

---

## 12. Rollback Strategy
Revert git commit on `BillingWorkspace.tsx` and `TabRenderer.tsx`. No database migrations or schema alterations are executed in this frontend consolidation phase.

---

## 13. Verification Plan
1. Run `npx vitest run src/tests/billingWorkspaceConvergence.test.ts`.
2. Run `npx vitest run src/tests/canonicalBillingConsolidation.test.ts`.
3. Run all 13 billing test suites across the repository to verify 0 regressions.
4. Run `npx tsc --noEmit` to verify 0 TypeScript compiler errors.

---

## 14. Test Plan
- Unit tests verifying `BillingWorkspaceMode` contains `"RETAIL_POS"`, `"CREDIT_BILLING"`, `"B2B_DISTRIBUTOR"`.
- Unit tests verifying `BillingAuxiliaryView` contains `"WORKSPACE"`, `"EOD_Z_REPORT"`, `"SHIFT_REPORTS"`, `"CREDIT_BILLING"`, `"B2B_DISTRIBUTOR"`.
- Unit tests verifying `TabRenderer.mapModuleId` resolves all aliases accurately.
- Keyboard shortcut simulation tests for `Alt+1`, `Alt+2`, `Alt+3`.

---

## 15. Documentation Impact
- Update `docs/implementation/README.md` with new plan entry.
- Create official walkthrough in `docs/walkthrough/billing/Canonical_Billing_Consolidation_v1.0.md`.
- Update `docs/walkthrough/README.md` with walkthrough entry.

---

## 16. Deployment Plan
Pure frontend component consolidation and route alignment. Deployed with standard frontend bundle build (`npm run build`).

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
- `docs/walkthrough/billing/Canonical_Billing_Consolidation_v1.0.md`
