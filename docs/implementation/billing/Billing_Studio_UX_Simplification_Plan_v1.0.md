<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.90.0
  Created      : 2026-10-17
  Modified     : 2026-10-17
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: SMRITI Billing Studio UX Simplification & Barcode Optimization

**Topic:** SMRITI Billing Studio UX Simplification & Barcode Optimization  
**Area:** Sales & Billing Architecture  
**Version:** 1.0.0  
**Date:** 2026-10-17  
**Status:** Completed  

---

## 1. Objective
Simplify and harden the user interface and barcode scanning workflows of the canonical SMRITI Billing Studio (`SmritiBillingStudio.tsx`). Transform the counter experience into a distraction-free, high-throughput retail workflow by collapsing non-essential secondary panels by default, encapsulating scanner preferences inside a dedicated modal dialog, hardening scanner input with debouncing and quantity multipliers, validating multi-outlet store selection for corporate accounts, and removing hardcoded calculation offsets in favor of pure, verifiable totals.

---

## 2. Business Motivation
In high-volume retail environments, cashiers need an intuitive, rapid checkout flow (`Customer` → `Cart` → `Add Item` → `Bill Summary` → `Payment`). Permanently visible settings panels and secondary forms (such as PO reference and warehouse selection) consume valuable screen space, confuse cashiers, and slow down checkout speed. Encapsulating configuration in a modal and collapsing optional details provides maximum focus and visual clarity while retaining full enterprise flexibility.

---

## 3. Scope
- Primary workflow enforcement across numbered cards 1 through 5.
- Collapsing the right-side More Details panel by default (`showMoreDetails = false`).
- Encapsulating Scan & Add Settings into a dedicated Settings Dialog modal and removing the permanent red-bordered card.
- Eliminating duplicate More Details entry points.
- Barcode scanning optimization: `AUTO_ADD`, `EDIT_THEN_ADD`, and `CONFIRM_PRODUCT` modes, 350ms duplicate debounce, quantity multiplier syntax (`3*BARCODE`), and auto-refocus.
- Cart cleanup: default clean columns, removal of redundant SKU and Variant columns, preservation of column configuration.
- Customer and store clarification: mandatory store/outlet selection for multi-outlet corporate accounts, prevention of master data modification during billing.
- Bill Summary: prominent Payable Amount, pure canonical calculations (`computeBillingTotals`) with zero magic offsets.
- Multi-tender payment settlement with clear Cash, UPI, Card, and Credit options, change due computation, and anti-duplicate submission lockouts.

---

## 4. Current State
`SmritiBillingStudio.tsx` previously rendered a permanently open right-hand panel containing secondary transaction attributes and an intrusive, red-bordered Scan & Add Settings card that occupied 28% of the viewport width. The cart footer contained a misleading "More Details >" button that toggled the settings card. The calculation engine contained an arbitrary offset adjustment to force a demo total rather than using pure mathematical logic.

---

## 5. Gap Analysis
1. **Screen Real Estate**: Cashiers on standard 1080p POS terminals suffered from horizontal compression in the item cart due to the permanent right-side panel.
2. **Duplicate Entry Points**: Clicking "More Details >" in the cart footer activated the scan settings card instead of transaction metadata.
3. **Scanner Robustness**: Hardware scanners emitting bounce pulses could trigger duplicate cart additions.
4. **Price Override Security**: Standard cashier roles had uninhibited access to edit line-item unit rates.
5. **Outlet Selection Ambiguity**: Corporate accounts with multiple retail stores could be billed without an explicit outlet choice.

---

## 6. Architecture Impact
- **Component Layer**: `SmritiBillingStudio.tsx` remains the authoritative billing studio hosted inside `BillingWorkspace.tsx`.
- **Backend & Database**: Zero changes to PostgreSQL tables, Alembic migrations, or `/api/v1/pos/checkout` API contracts. All transactions post cleanly through the canonical sales writer.
- **State Management**: Encapsulated layout states (`showMoreDetails`, `showSettingsModal`, `scanMode`, `visibleCols`) with local component reactivity.

---

## 7. Proposed Design
1. **Collapsed-First Layout**:
   - `showMoreDetails`: defaults to `false`.
   - Header toggle button with rotating chevron reveals the panel as a smooth slide-in drawer on demand.
2. **Settings Dialog**:
   - Dedicated modal accessible via the header Settings button. Houses scan mode selection, post-scan focus, duplicate barcode behavior, and safety permissions.
3. **Pure Totals Engine**:
   - `computeBillingTotals`: pure function taking cart items, bill discount, discount type, and state codes, returning exact gross, discounts, taxable value, GST, round-off, and net payable.
4. **Scanner Engine**:
   - Debounce window: 350ms.
   - Multiplier support: `3*890123...` or `5x890123...`.
   - Price lock: read-only for cashiers without manager override.

---

## 8. Files Created
1. `docs/walkthrough/billing/Billing_Studio_UX_Simplification_v1.0.md`
2. `docs/implementation/billing/Billing_Studio_UX_Simplification_Plan_v1.0.md`

---

## 9. Files Modified
1. `src/components/billing/SmritiBillingStudio.tsx`
2. `src/tests/smritiBillingStudio.test.ts`
3. `scripts/verify_canonical_billing_studio_headless.py`
4. `docs/walkthrough/README.md`
5. `docs/implementation/README.md`

---

## 10. Dependencies
- React 18
- Lucide React icons
- `gstEngine.ts` (`calculateGST`, `parseAndValidateGSTIN`)
- `SmritiPosParkedCartService`
- `ProPosOfflineSyncEngine`
- `apiFetchV1.ts`

---

## 11. Risks
- **Risk**: Cashiers used to having More Details open on wide 4K screens might prefer it open.
  - **Mitigation**: Dedicated header toggle button with hotkey `F4` makes toggling instant and effortless.

---

## 12. Rollback Strategy
Git revert on `src/components/billing/SmritiBillingStudio.tsx` restores the prior component state with zero database or backend impact.

---

## 13. Verification Plan
1. Unit tests in `src/tests/smritiBillingStudio.test.ts` verifying all 18 test cases.
2. Regression tests across all 6 billing test suites.
3. TypeScript compiler validation (`npx tsc --noEmit`).
4. Production bundle build validation (`npm run build`).
5. Headless Playwright end-to-end transaction test against live backend and PostgreSQL.

---

## 14. Test Plan
- Test pure totals calculation with item discounts and flat/percentage bill discounts.
- Test barcode scan modes (`AUTO_ADD`, `EDIT_THEN_ADD`, `CONFIRM_PRODUCT`).
- Test quantity multiplier parsing (`3*BARCODE`).
- Test scanner double-trigger debounce.
- Test corporate outlet selection requirement.
- Test price override role authorization.
- Test collapsed default state for More Details.

---

## 15. Documentation Impact
- Updated `docs/walkthrough/README.md` master index.
- Updated `docs/implementation/README.md` master index.
- Created `Billing_Studio_UX_Simplification_v1.0.md` walkthrough.

---

## 16. Deployment Plan
Code change is frontend-only; deploy by rebuilding Vite production assets (`npm run build`) and deploying static assets to the web server.

---

## 17. Status
Completed

---

## 18. Related ADRs
- `ADR-0042`: Canonical Sales Posting Writer and Single Point of Write Architecture.
- `ADR-0078`: Unified POS Offline Sync Queue Engine.

---

## 19. Related Walkthroughs
- `docs/walkthrough/billing/Billing_Studio_UX_Simplification_v1.0.md`
- `docs/walkthrough/billing/Canonical_Billing_Studio_Replacement_v1.0.md`
