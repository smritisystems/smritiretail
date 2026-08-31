<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.122.0
  Created      : 2026-08-28
  Modified     : 2026-08-28
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Purchase Order Auto-Generation Engine (v1.0.0-GA)

## 1. Purpose
Documents the Purchase Order Auto-Generation Engine — reorder breach detection, supplier-consolidated PO generation with MOQ enforcement, DRAFT→ACKNOWLEDGED status lifecycle, and PO summary metrics.

## 2. Scope
- `AutoPOEngine` covering `detectBreaches()`, `generatePO()`, `consolidatePOs()`, `submit()`, `acknowledge()`, `cancel()`, `poSummary()`.
- Breach severity: CRITICAL (stock=0), LOW (stock ≤ reorderPoint/2), NORMAL.
- `suggestedQty = max(reorderQty, supplierMOQ)` — MOQ enforcement.
- `consolidatePOs()`: one PO per unique `supplierId + branchCode` pair.
- `AutoPOModal`: PO sidebar, summary strip, 2-tab (Breach cards with severity colour, PO Lines with action buttons).

## 3. Files Created
- `src/utils/autoPOEngine.ts`
- `src/components/procurement/AutoPOModal.tsx`
- `src/tests/autoPOEngine.test.ts`
- `docs/walkthrough/procurement/Auto_PO_Engine_v1.0.0.md`

## 4. Files Modified
- `docs/walkthrough/README.md`, `docs/implementation/README.md`, `CHANGELOG.md`

## 5. Architecture Decisions
1. **`detectBreaches()` is a pure filter+map+sort over `StockItem[]`**: No side effects — it computes breach records from current stock without modifying any state. The caller decides whether to act on breaches (generate POs, alert manager, etc.).
2. **`suggestedQty = max(reorderQty, supplierMOQ)`**: If the supplier's minimum order quantity exceeds the store's preferred replenishment quantity, the MOQ wins. This prevents partial orders that suppliers would reject, which is the #1 cause of manual PO re-work.
3. **`consolidatePOs()` groups by `supplierId__branchCode` (not just `supplierId`)**: A multi-branch retailer may have different pricing tiers per branch from the same supplier — separate POs per branch are required for correct billing. The double-key ensures branch isolation.
4. **`expectedDelivery = max(leadTimeDays)` across all lines in the PO**: The PO is not considered delivered until the last item arrives. Using `max` rather than `avg` prevents premature closure of a PO when fast-lead items arrive early.
5. **`cancel()` is forbidden once ACKNOWLEDGED**: Once a supplier acknowledges a PO, it enters their production/picking queue. Cancellation requires a separate supplier communication — the engine enforces this boundary by throwing, not soft-warning.

## 6. Design Rationale
Manual PO generation is the most time-consuming procurement activity for store managers. Auto-generation from reorder-point breach eliminates the daily stock-check-and-order workflow. The CRITICAL severity (stockout) appears first in the UI to direct buyer attention to the most urgent items. MOQ enforcement prevents the costly back-and-forth of supplier rejection and manual PO correction.

## 7. Implementation Summary
- `detectBreaches()`: Filter `currentStock <= reorderPoint`; compute `shortfall`, `suggestedQty`, `lineTotal`, `severity`; sort CRITICAL→LOW→NORMAL.
- `generatePO()`: Filter breach list for `supplierId+branchCode`; map to `AutoPOLine[]`; sum `totalQty`, `totalValue`; `expectedDelivery = generatedAt + max(leadTimeDays)d`; generate `poNo = APO-<branch>-<YYYYMMDD>-<seq>`.
- `consolidatePOs()`: Build `Map<supplierId__branchCode, breach[]>`; call `generatePO()` per entry.
- `submit()` / `acknowledge()` / `cancel()`: Status guard throws on invalid transitions; set `submittedAt`, `acknowledgedAt`, `cancelledAt`, `cancelReason`.
- `poSummary()`: Single-pass accumulate `totalValue`, `totalQty`, `byStatus` counts.

## 8. Tests Executed
```
npm test
```

## 9. Verification Results
- **`src/tests/autoPOEngine.test.ts`**: 4/4 passed (no patches required).
  - Test 1: 5 items → 4 breaches (LINEN stock=200 > ROP=50 excluded); PARA severity=CRITICAL (stock=0), suggestedQty=200 (max(200,100)), lineTotal=₹2,400; AMOX severity=LOW (20 ≤ 50/2=25), suggestedQty=100; DENIM severity=NORMAL (80 > 50); sorted CRITICAL first ✓
  - Test 2: generatePO for SUP-001 → 2 lines (PARA+AMOX), totalQty=300, totalValue=₹5,200, poNo matches `APO-BR-MUM-01-*`, expectedDelivery defined ✓
  - Test 3: consolidatePOs → 2 POs (SUP-001: 2 lines, SUP-002: 1 line DENIM), SUP-002 totalValue=₹54,000 (300×₹180) ✓
  - Test 4: submit→SUBMITTED; acknowledge→ACKNOWLEDGED; cancel on ACKNOWLEDGED throws; cancel DRAFT→CANCELLED with reason; poSummary byStatus ACKNOWLEDGED=1, CANCELLED=1 ✓
- **Total Frontend Suite**: 93/93 test files, 544/544 tests green, exit code 0.

## 10. Known Limitations
- `poSummary()` `criticalLines` field is always 0 — cross-referencing breach severity with PO lines was deferred. Production joins the breach list to the PO line list.
- No duplicate PO prevention: running `consolidatePOs()` twice on the same breach list creates two identical DRAFT POs. Production checks for existing open POs for the same supplier+branch before generating.

## 11. Future Work
- FastAPI `POST /api/v1/purchase-orders/auto-generate`, `PATCH /api/v1/purchase-orders/{id}/submit`, `PATCH /api/v1/purchase-orders/{id}/acknowledge`.
- GRN (Goods Receipt Note) auto-creation on acknowledgement: pre-populate GRN with PO lines for receiving clerk.
- Demand forecasting integration: `suggestedQty` driven by 30-day rolling average sales rather than static `reorderQty`.

## 12. Related ADRs
- `ADR-001`: FastAPI Sole System of Record. `ADR-056`: Auto-PO Trigger Policy, MOQ Enforcement Rules, Breach Severity Definitions, PO Consolidation Strategy.

## 13. Related RFCs
- `RFC-125`: Procurement Automation Policy, Supplier MOQ Negotiation Guidelines, Reorder Point Calibration Methodology.
