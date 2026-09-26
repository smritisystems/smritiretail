<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 4.14.2
  Created      : 2026-09-09
  Modified     : 2026-09-09
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan — Phase 2C Steps 14 & 15: Billing Route Convergence & Safe Legacy Retirement

**Plan ID:** IP-BILLING-2026-09-09-02  
**Version:** `v4.14.2`  
**Area:** `billing`  
**Lifecycle Status:** `Completed`  

---

## 1. Objective
Converge all legacy billing, POS, and EOD day-close client route invocations in `src/App.tsx` directly to the consolidated `BillingWorkspace.tsx`, and decommission obsolete 0-capability pass-through stub files (`PosTerminalTab.tsx`, `AdvancedBillingEng.tsx`) under the strict 8-Point Safe Retirement Standard.

---

## 2. Business Motivation
Eliminating competing route destinations and duplicate pass-through files removes operator confusion, simplifies UI bundle size, prevents split-brain billing state, and guarantees that every POS sale, B2B tax invoice, and EOD shift settlement executes through the canonical financial posting authority.

---

## 3. Scope
- **App.tsx Route Convergence**: Redirect `day-close`, `day-end`, and `eod-report` routes to `<BillingWorkspace initialView="EOD_Z_REPORT" />`.
- **Import Cleanup**: Remove unused and dead imports (`PosTerminalTab`, `AdvancedBillingEngine`) from `src/App.tsx`.
- **8-Point Safe Retirement**: Execute full 8-gate compliance verification and delete `src/components/PosTerminalTab.tsx` and `src/components/AdvancedBillingEng.tsx`.
- **Frontend Scanner Synchronization**: Register `billing-workspace` in `src/modules/dev_tracker/scanner/metrics.ts`.
- **Verification & Governance**: Ensure 0 TypeScript errors, 0 architecture duplication gate violations, and full test regression green.

---

## 4. Current State
- `BillingWorkspace.tsx` is fully operational with `Alt+1` (Retail POS), `Alt+2` (B2B Tax Invoice), and `Alt+3` (Wholesale Sizing Matrix).
- `src/App.tsx` already routes `billing-workspace`, `billing`, `pos`, `tax-invoice`, `dist-invoice`, and `create-tax-invoice` to `BillingWorkspace`.
- `src/App.tsx` routes `day-close`, `day-end`, and `eod-report` to `PosTerminalTab` (a 49-line wrapper that merely delegates to `ProPosWs`).
- `AdvancedBillingEng.tsx` (65 lines) is a redundant stub wrapping `ProPosWs` with zero active call sites in the application.

---

## 5. Gap Analysis
1. EOD shift settlement was split: launchpad F8 opened `PosTerminalTab` rather than the integrated modal/view in `BillingWorkspace`.
2. Two legacy files (`PosTerminalTab.tsx`, `AdvancedBillingEng.tsx`) remained in `src/components/` despite their capabilities being 100% absorbed by `BillingWorkspace.tsx`.
3. Frontend scanner `src/modules/dev_tracker/scanner/metrics.ts` lacked canonical `billing-workspace` mapping.

---

## 6. Architecture Impact
- Enforces single-entry UI architecture for all checkout, invoicing, and register closeout functions.
- Eliminates 2 duplicate UI files and reduces frontend bundle complexity.
- Upholds the 8-Point Safe Retirement Standard established in `PHASE2B_BILLING_WORKSPACE_BLUEPRINT.md`.

---

## 7. Proposed Design
1. In `src/App.tsx`:
   - Reroute `case "day-close":`, `case "day-end":`, `case "eod-report":` to `<BillingWorkspace initialView="EOD_Z_REPORT" />`.
   - Remove imports of `PosTerminalTab` and `AdvancedBillingEngine`.
2. In `src/modules/dev_tracker/scanner/metrics.ts`:
   - Add `"billing-workspace"` to `MODULE_KEYWORD_MAP`.
3. Safely delete `src/components/PosTerminalTab.tsx` and `src/components/AdvancedBillingEng.tsx`.
4. Validate with `npx tsc --noEmit` and `python scripts/architecture_duplication_gate.py`.

---

## 8. Files Created
- `docs/implementation/billing/Phase2C_Step14_15_Billing_Route_Convergence_And_Retirement_Plan_v4.14.2.md`

---

## 9. Files Modified
- `src/App.tsx`
- `src/modules/dev_tracker/scanner/metrics.ts`
- `docs/implementation/README.md`

---

## 10. Dependencies
- `src/components/billing/BillingWorkspace.tsx`
- `src/components/billing/propos/ProPosEodReportVie.tsx`
- `backend/app/services/canonical_sales_writer.py`

---

## 11. Risks
- *Risk:* Cashiers accessing Day Close (F8) lose previous form state.
- *Mitigation:* `BillingWorkspace` directly renders `SmritiProPosEodReport` with active shift detection, cash reconciliation, and Z-Report commit handlers.

---

## 12. Rollback Strategy
- Immediate git revert of commits on `smritiNX` branch if any regressions arise.

---

## 13. Verification Plan
- `npx tsc --noEmit` must return 0 errors.
- `python scripts/architecture_duplication_gate.py` must pass with 0 P0/P1 violations.
- Characterization test suite (`test_canonical_sales_writer.py`) must remain 100% green.

---

## 14. Test Plan
- Run automated unit and integration tests across backend and frontend.

---

## 15. Documentation Impact
- Update `docs/implementation/README.md` and generate formal walkthrough.

---

## 16. Deployment Plan
- Changes are client-side routing and clean file deletions; deploy via standard Git commit & CI/CD pipeline.

---

## 17. Status
- `Completed`

---

## 18. Related ADRs
- `ADR-POS-002`: Forward-Only Accounting & Foreign Key Governance.
- `ADR-FIN-001`: Phase 2B Canonical Financial Policy & Tax Determination.

---

## 19. Related Walkthroughs
- `docs/walkthrough/billing/Phase2C_Canonical_Sales_Writer_Execution_v4.14.0.md`
- `docs/walkthrough/billing/Billing_Workspace_Hotkeys_And_Dev_Scanner_Convergence_v4.14.1.md`
