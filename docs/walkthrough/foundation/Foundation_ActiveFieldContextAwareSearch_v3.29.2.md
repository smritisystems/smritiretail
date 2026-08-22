<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.29.2
  Created      : 2026-08-21
  Modified     : 2026-08-21
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Global Context-Aware Search & Real-Time Cursor Field Inspector v3.29.2

## 1. Purpose
Establish an application-wide, real-time context-aware search and inspector system where the active cursor position automatically dictates the search domain and displays relevant details (e.g. Scan/Product field shows real-time product stock, MRP, selling price, and dynamic attributes; Customer/Mobile field shows customer profile, loyalty points, credit limit, and outstanding balance).

## 2. Scope
- Global DOM focus and input tracking via `ActiveFieldContext.tsx` and `useActiveField()`.
- Intelligent multi-strategy field category inference engine (`product`, `customer`, `supplier`, `invoice`, `hsn`, `general`).
- Reactive omni-search modal (`GlobalSearch.tsx`) displaying contextual detail cards and quick "Insert into Active Field" actions.
- Floating `ContextualInspectorHUD.tsx` real-time assistant widget.
- Header integration in `GlobalHeader.tsx` displaying active cursor target badges.
- Explicit context tagging across POS Billing Terminal (`PosTerminalTab.tsx`) and Advanced B2B Billing (`AdvancedBillingEngine.tsx`).

## 3. Files Created
- `src/context/ActiveFieldContext.tsx`
- `src/components/drilldown/ContextualInspectorHUD.tsx`
- `src/tests/activeFieldContextAwareSearch.test.ts`
- `docs/walkthrough/foundation/Foundation_ActiveFieldContextAwareSearch_v3.29.2.md`

## 4. Files Modified
- `src/App.tsx`
- `src/components/shell/GlobalHeader.tsx`
- `src/components/drilldown/GlobalSearch.tsx`
- `src/components/PosTerminalTab.tsx`
- `src/components/AdvancedBillingEngine.tsx`
- `docs/walkthrough/README.md`

## 5. Architecture Decisions
- **AD-SEARCH-01**: Field category inference operates on a non-intrusive heuristic engine (`data-context-type` > explicit attributes > DOM identifier patterns > surrounding labels), ensuring zero configuration required for new screens.
- **AD-SEARCH-02**: Value insertion into focused inputs dispatches native and synthetic `input` and `change` events, ensuring bidirectional React form state synchronization.
- **AD-SEARCH-03**: Real-time contextual inspector HUD operates in a non-blocking floating overlay, collapsible via keyboard or click.

## 6. Design Rationale
Retail operators switch frequently between scanning barcodes, selecting customers, querying invoices, and checking stock. Rather than requiring manual category navigation or separate lookup dialogs, the application now listens directly to the cursor's focus context, eliminating friction and redundant clicks.

## 7. Implementation Summary
1. **Universal Field Inference**: Created `inferFieldCategory` in `ActiveFieldContext.tsx` recognizing product/scan, customer, supplier, invoice, and HSN fields.
2. **Context Provider**: Added `ActiveFieldProvider` in `App.tsx` managing global focus tracking and active query state.
3. **Omni-Search Modal Upgrade**: Rewrote `GlobalSearch.tsx` to automatically pre-select the active field category, display rich detail cards, and support direct value injection.
4. **Header Integration**: Updated `GlobalHeader.tsx` to display real-time cursor target badges.
5. **Inspector HUD**: Built `ContextualInspectorHUD.tsx` floating assistant.

## 8. Tests Executed
- `vitest run src/tests/activeFieldContextAwareSearch.test.ts` (12/12 passed in 10ms)
- `npm test` (167/167 passed across 25 test suites in 4.79s)
- `npm run lint` (`tsc --noEmit` passed with 0 errors)

## 9. Verification Results
- **Evidence Level A**: Automated test suite verification covering field inference, value injection, and multi-surface contextual routing with 100% pass rate.

## 10. Known Limitations
- Background scanning over physical USB HID scanners without active input focus defaults to global product search.

## 11. Future Work
- Voice search transcription routing to the active field category.

## 12. Related ADRs
- `AD-SEARCH-01`, `AD-SEARCH-02`

## 13. Related RFCs
- `RFC-SEARCH-002-CONTEXT-INSPECTOR`
