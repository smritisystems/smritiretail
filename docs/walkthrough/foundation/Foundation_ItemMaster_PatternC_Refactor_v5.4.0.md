<!--
Author & Creator:
Jawahar Ramkripal Mallah

Founder:
SmritiSys
AITDL Networks

Role:
Chief Systems Architect

Web:
smritisys.com | smritibooks.com | aitdl.com

Email:
jawahar.mallah@gmail.com

Copyright © 2026 SmritiSys.
All Rights Reserved.
-->

# Walkthrough: SMRITI Product Master (`ItemMasterTab.tsx`) Pattern C Master-Detail Refactoring

## 1. Purpose
Refactor **SMRITI Product Master (`ItemMasterTab.tsx`)** from a monolithic 2,899-line file into a modular **Pattern C Master–Detail Workspace** adhering to the **SMRITI Viewport & Layout Governance Framework (`SLGP-001 v2.0`)**, **WNG-002 Object Page Standard**, and Level 1 Architecture Constitution **Rule SLGP-R6**.

---

## 2. Scope
- Replaced 2,899-line monolithic `ItemMasterTab.tsx` with modular sub-components in `src/components/item_master/`:
  - `ItemMasterToolbar.tsx`: Operational action bar with view switcher, search, barcode print trigger, and new product creation.
  - `ItemMasterMasterList.tsx`: Left-hand master SKU list (`w-96`, `shrink-0`) with category pills and search filtering.
  - `ItemMasterFormInspector.tsx`: Right-hand selected SKU inspector using `SEEFObjectPage` (`FioriObjectPage.tsx`).
  - `ItemMasterUomMatrix.tsx`: Multi-UOM and Packaging Unit Conversion component (e.g. 1 Box = 12 Pieces).
  - `BarcodePrintDialog.tsx`: Thermal label print dialog wrapped in `<SmritiDialog />`.
- Wrapped `ItemMasterTab.tsx` in `<WorkspaceLayout mode="master-detail" />` (Pattern C) for primary master registry view and `<WorkspaceLayout mode="studio" />` for full-bleed spreadsheet grid view.
- Expanded `Product` data model in `src/types.ts` to support Multi-UOM packaging conversions and inventory tracking flags (`has_batch_tracking`, `has_expiry_date`, `has_serial_number`).

---

## 3. Files Created
- `src/components/item_master/ItemMasterToolbar.tsx`
- `src/components/item_master/ItemMasterMasterList.tsx`
- `src/components/item_master/ItemMasterFormInspector.tsx`
- `src/components/item_master/ItemMasterUomMatrix.tsx`
- `src/components/item_master/BarcodePrintDialog.tsx`
- `docs/walkthrough/foundation/Foundation_ItemMaster_PatternC_Refactor_v5.4.0.md`

---

## 4. Files Modified
- `src/types.ts`
- `src/components/ItemMasterTab.tsx`
- `docs/walkthrough/README.md`

---

## 5. Architecture Decisions
- **AD-1: Pattern C Split-Pane Layout**: The Product Master now renders as a split pane (left SKU list + right inspector) inside a single viewport bounding box, eliminating full-page reloads and scrollbar conflicts.
- **AD-2: Component Modularization**: Decomposed 2,899 lines into clean, focused sub-components under 300 lines each.
- **AD-3: Standardized Dialogs**: Replaced custom overlay divs with `<SmritiDialog />` (`BarcodePrintDialog.tsx`).

---

## 6. Design Rationale
Modularity improves codebase maintainability and allows inventory managers to rapidly search and edit SKUs without losing master list context.

---

## 7. Implementation Summary
1. Created `ItemMasterToolbar.tsx`, `ItemMasterMasterList.tsx`, `ItemMasterFormInspector.tsx`, `ItemMasterUomMatrix.tsx`, and `BarcodePrintDialog.tsx`.
2. Updated `src/types.ts` with optional inventory control fields.
3. Refactored `src/components/ItemMasterTab.tsx` into a composition host wrapping `<WorkspaceLayout mode="master-detail" />`.
4. Verified layout rules with `python scripts/validate_layout_tokens.py` (327 files scanned, 0 errors).
5. Verified TypeScript compilation with `npx tsc --noEmit` (Exit 0).
6. Verified End-to-End browser tests with `node tests/e2e/playwright_e2e_runner.cjs` (4/4 passed).

---

## 8. Tests Executed
1. **Layout Linter Verification**:
   ```bash
   python scripts/validate_layout_tokens.py
   ```
2. **TypeScript Compilation Verification**:
   ```bash
   npx tsc --noEmit
   ```
3. **Playwright E2E Runner**:
   ```bash
   node tests/e2e/playwright_e2e_runner.cjs
   ```

---

## 9. Verification Results
- **Layout Linter**: Passed (`[OK] LINTER PASSED: Zero layout governance violations found in src/`).
- **TypeScript Compiler**: Passed (0 compilation errors).
- **Playwright Suite**: Passed (4/4 tests passed).

---

## 10. Known Limitations
- None.

---

## 11. Future Work
- Add Excel bulk export adapter for Multi-UOM matrices.

---

## 12. Related ADRs
- `ADR-001`: Four-Tier Independent Architecture

---

## 13. Related RFCs
- `RFC-SLGP-001`: Viewport Governance Specification
