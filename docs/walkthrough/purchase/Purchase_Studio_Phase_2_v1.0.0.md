<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS

  Founders

  * Pushpa Devi Jawahar Mallah
    * Founder & Chairperson
    * Email: founder@aitdl.com

  * Jawahar Ramkripal Mallah
    * Founder, Chief Executive Officer (CEO) & Chief Software Architect
    * Email: founder@aitdl.com

  * Websites: aitdl.com | erpnbook.com | smritibooks.com

  * Version    : 1.0.0
  * Created    : 2026-09-30
  * Modified   : 2026-09-30
  * Copyright  : © SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
  * Classification: Internal
-->

# Walkthrough: Purchase Studio Phase 2 — UX Hardening, Safety Modals & Statutory Print Integration

## 1. Purpose
This document records the completion of Phase 2 of the Purchase Studio Sizewise Matrix (`PoSizewiseTab.tsx`) hardening in SMRITI Retail OS. Following the foundational layout improvements delivered in Phase 1, Phase 2 implements robust operational safety guards, eliminates unstyled browser dialogs (`window.confirm`), introduces an accessible governed modal confirmation framework, restructures the top action toolbar to a clean 7-action budget with an overflow popover menu, provides mathematical summary defenses against malformed numerical data, implements real previous purchase order duplication, and deeply integrates the statutory `POPrintPreviewModal` for pre- and post-save voucher document workflows.

## 2. Scope
The scope of Phase 2 encompasses the following functional and architectural capabilities:
1. **Governed Confirmation Modal Framework:** Replaced all blocking native `window.confirm` calls with a styled, accessible in-app confirmation modal dialog with distinct variant badges (`warning`, `danger`, `primary`).
2. **Footwear Scale Change Confirmation:** Guarded size scale switches when active quantities exist; prompts the operator with the specific size range re-mapping impact before clearing or redistributing columns.
3. **Real "Copy Previous PO" Orchestration:** Fetches the most recent purchase order from `/purchase/orders/?page=1&page_size=1&sort=created_at&order=desc`, rehydrates line items into `SizewisePOLine` format with size quantities and pricing, updates vendor information, and validates non-empty state replacement.
4. **Toolbar 7-Action Budget & Overflow Popover:** Structured the top matrix action toolbar to adhere to a clean 7-action budget (Search, Add Item, Import Excel, Size Scale, Price List, Delete Row, and More Actions popover). Secondary actions (`Copy Previous PO`, `Export Matrix to CSV`, `Clear All Rows`) are cleanly tucked into the overflow popover.
5. **CSV Matrix Export:** Allows operators to export the full horizontally-pivoted sizewise matrix into statutory CSV format with escaped product names and per-size column quantities.
6. **Mathematical Summary Guards:** Hardened `calculateSizewiseSummaryTotals` defensively against `null`, `undefined`, non-finite, or `NaN` values, ensuring zero division safety and uniform `0.00%` percentage formatting.
7. **Statutory Print Preview Integration:** Connected the header `Print` button and post-save modal `Print PO` button to `POPrintPreviewModal`, rendering authentic footwear purchase orders and size pivot matrices (`SizePivotMatrixA4`) rather than raw browser `window.print()`.

## 3. Files Created
- `docs/implementation/purchase/Purchase_Studio_Phase_2_Plan_v1.0.0.md`
- `docs/walkthrough/purchase/Purchase_Studio_Phase_2_v1.0.0.md`

## 4. Files Modified
- `src/components/purchase/PoSizewiseTab.tsx`
- `src/tests/poSizewiseUX.test.ts`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`

## 5. Architecture Decisions
- **ADR-PS2-01: Prohibition of Blocking Native Browser Dialogs.** Native `window.confirm` and `window.alert` block the browser event loop, provide poor mobile/tablet ergonomics, cannot be styled or themed according to SMRITI design tokens, and fail accessibility audits. All confirmation actions are replaced by a non-blocking in-app modal state.
- **ADR-PS2-02: Toolbar Action Budget (Max 7 Primary Actions).** Dense enterprise transaction grids often suffer from toolbar button creep. Primary actions are limited to 7 high-frequency triggers, with peripheral and destructive utilities grouped into a governed `More Actions` overflow popover.
- **ADR-PS2-03: Real Database-Backed Rehydration for Duplicate/Copy PO.** Replaced dummy client-side placeholders with asynchronous retrieval of canonical purchase orders from the FastAPI `/purchase/orders/` repository, re-mapping items into size columns.
- **ADR-PS2-04: Canonical Print Modal Integration.** Bypassed raw unstructured browser printing in favor of the platform's statutory print engine (`POPrintPreviewModal`), supporting footwear A4 vouchers, size pivot matrices, and statutory GST breakdowns.

## 6. Design Rationale
- **Accidental Data Loss Prevention:** In high-speed retail purchasing, accidental clicks on destructive buttons (such as deleting a multi-size line, clearing all rows, or changing size scale) can cause loss of minutes of manual size entry. The governed modal ensures clear context and single-click confirmation.
- **Visual Harmony:** The confirmation modal uses Tailwind CSS with subtle blur backdrops (`backdrop-blur-xs`), smooth fade-in animations, clear semantic icon badges (`warning`, `priority_high`, `delete`), and explicit confirmation buttons.

## 7. Implementation Summary
- **Accessible Confirmation Modal State:**
  ```tsx
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    variant?: "danger" | "warning" | "primary";
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    confirmLabel: "Confirm",
    variant: "primary",
    onConfirm: () => {},
  });
  ```
- **Scale Switch Confirmation Trigger:**
  ```tsx
  const handleScaleSelectChange = useCallback((newScaleKey: string) => {
    if (newScaleKey === selectedScaleKey) return;
    const populatedCount = lines.filter(l => Boolean(l.itemCode && l.totalQty > 0)).length;
    if (populatedCount === 0) {
      handleScaleChange(newScaleKey);
      return;
    }
    const newPreset = SIZE_SCALE_PRESETS[newScaleKey];
    setConfirmModal({
      isOpen: true,
      title: "Change Size Scale Preset?",
      message: `You currently have ${populatedCount} active item(s) in this Purchase Order. Switching to "${newPreset?.label || newScaleKey}" will adjust size columns to (${newPreset?.sizes.join(", ")}). Quantities for sizes outside this range will be cleared. Do you wish to proceed?`,
      confirmLabel: "Switch Scale & Re-map",
      variant: "warning",
      onConfirm: () => handleScaleChange(newScaleKey),
    });
  }, [selectedScaleKey, lines, handleScaleChange]);
  ```
- **Copy Previous PO Orchestration:**
  ```tsx
  const res = await apiFetchV1("/purchase/orders/?page=1&page_size=1&sort=created_at&order=desc");
  const fullPo = await apiFetchV1(`/purchase/orders/${prevOrderSummary.id || prevOrderSummary.order_no}`);
  // Maps previous order items into horizontal size-wise columns
  ```
- **Statutory Print Preview Props Mapping:**
  ```tsx
  <POPrintPreviewModal
    isOpen={showPrintPreview}
    onClose={() => setShowPrintPreview(false)}
    header={printHeader}
    lineItems={printLineItems}
    sizePivotRows={printSizePivotRows}
    activeTab="pivot"
    vendor={selectedSupplier}
  />
  ```

## 8. Tests Executed
Executed the comprehensive Vitest test suite `src/tests/poSizewiseUX.test.ts` covering all 21 test cases:
1. `calculateSizewiseSummaryTotals` per-size totals matching specification exactly.
2. Size percentage distribution with two-decimal precision.
3. Item summary financial calculations with statutory GST tiers.
4. Freight and auxiliary charges addition.
5. Blank line initialization with zero size quantities.
6. Date offsets and lead time calculations.
7. Filtering and ignoring empty lines.
8. Footwear EU and UK scale presets conformation.
9. Indian GST rate tiers (<= ₹2500 is 5%, > ₹2500 is 18%).
10. Single footwear PO matrix calculations for Campus Running Shoes.
11. Multi-item footwear PO combining catalog items with mixed statutory GST.
12. Blank line initialization for 9-size Footwear EU scale.
13. Footwear UK scale (6-11) initialization and calculations.
14. Empty state lines array initialization (`lines = []`).
15. Composite read-only document identity string (`PO-37067`).
16. Identification of populated rows vs blank rows via `hasItem`.
17. Defensive guards against malformed, null, or undefined inputs in summary calculations.
18. Zero `grandTotalQty` handling without NaN in size percentage distributions.
19. Accurate re-mapping of size quantities on footwear scale transitions.
20. Serialization of sizewise matrix to RFC-4180 CSV format with escaped product names.
21. Expansion of matrix rows into discrete line items for statutory print engine.

## 9. Verification Results
- **Vitest Result:** 21/21 passed (100% green).
- **TypeScript Typecheck:** Clean compilation across all modified purchase components.
- **Git Working Tree Hygiene:** No untracked build artifacts; zero lint errors.

## 10. Known Limitations
- "Copy Previous PO" relies on the latest purchase order created in PostgreSQL. If the tenant database has zero prior purchase orders, an informative notification banner is displayed instructing the user that no history is available to duplicate.

## 11. Future Work
- Phase 3: Statutory E-Way Bill and E-Invoice metadata validation triggers in the purchase studio before dispatching purchase orders to suppliers.
- Phase 4: Size-wise barcode label generation modal for direct barcode thermal printing upon purchase order generation.

## 12. Related ADRs
- `ADR-PS1-01`: Zero Pre-allocated Blank Rows
- `ADR-PS1-02`: Platform F2 Dispatcher as Single Look-up Surface
- `ADR-PS1-03`: Read-Only Document Identity
- `ADR-PS2-01`: Prohibition of Blocking Native Browser Dialogs
- `ADR-PS2-02`: Toolbar Action Budget (Max 7 Primary Actions)
- `ADR-PS2-03`: Real Database-Backed Rehydration for Duplicate/Copy PO
- `ADR-PS2-04`: Canonical Print Modal Integration

## 13. Related RFCs
- `RFC-2026-09-PO-SIZEWISE-01`: Purchase Studio Ergonomics & Footwear Matrix UX
