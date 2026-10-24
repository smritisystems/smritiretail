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

# Walkthrough: Purchase Studio Phase 1 — Sizewise Matrix UX Clean-up & Architecture Alignment

## 1. Purpose
This document records the completion of Phase 1 of the Purchase Studio UX and Architecture alignment for SMRITI Retail OS (`PoSizewiseTab.tsx`). It addresses the high-priority ergonomic and architectural items identified in `PurchaseStudio_UX_Architecture_Audit.md`: eliminating phantom blank rows on initialization, establishing a clean empty state with action triggers, standardizing F2 item lookup via the platform's Universal F2 Dispatcher, presenting an authoritative read-only composite document identity, gating row actions to prevent runtime errors on empty rows, and consolidating duplicate Save triggers into a single standardized footer path.

## 2. Scope
The scope of Phase 1 is strictly constrained to the 5 approved architectural items in `PoSizewiseTab.tsx`:
1. **Empty State & Zero Fake Rows:** Removed `DEFAULT_BLANK_ROWS = 8` pre-initialization. The Sizewise PO lines array now initializes strictly as `[]`. When zero lines exist, a clean empty state displays with clear calls to action: `Add Item`, `Import from Excel`, and `F2 / Scan`.
2. **F2 Universal Dispatcher Integration:** Wired `useF2Screen` and `useF2Dispatcher` in `PoSizewiseTab.tsx`. Both the keyboard F2 shortcut (handled by `F2DispatcherProvider`) and the empty state `F2 / Scan` button route through the platform's canonical `UniversalBrowseEngine` via `openLookup("variant", f2Adapter)`.
3. **Composite Read-Only Document Identity:** Replaced separate editable `<input>` fields for Prefix and Number with a single read-only composite document identity badge (`PO-37067`). Retains full backward compatibility with backend API schemas (submitting `prefix` and `orderNumber` as allocated by the document series engine).
4. **Gated Row Actions:** Gated the View/Edit and Delete action buttons behind an explicit `hasItem = Boolean(line.itemCode)` check. Placeholder rows render a clean placeholder dash (`—`) and cannot trigger empty dialogs or invalid state mutations.
5. **Consolidated Save Path:** Removed the redundant `Save` button from the top header action toolbar, consolidating document persistence to the authoritative bottom footer actions: `Save Draft` and `Save & Confirm`.

## 3. Files Created
- `docs/walkthrough/purchase/Purchase_Studio_Phase_1_v1.0.0.md`

## 4. Files Modified
- `src/components/purchase/PoSizewiseTab.tsx`
- `src/tests/poSizewiseUX.test.ts`
- `docs/walkthrough/README.md`

## 5. Architecture Decisions
- **ADR-PS1-01: Zero Pre-allocated Blank Rows.** Initializing grids with pre-populated dummy lines causes cognitive clutter, skewed summary calculations if unvalidated, and awkward empty-row cleanup workflows. Grid state begins at `lines = []`.
- **ADR-PS1-02: Platform F2 Dispatcher as Single Look-up Surface.** In accordance with the SMRITI F2 Universal Lookup Architecture, screens must not attach isolated `keydown` listeners or render ad-hoc browse dialogs for F2. `PoSizewiseTab` registers its lookup context via `useF2Screen` and triggers programmatically via `useF2Dispatcher().openLookup("variant", f2Adapter)`.
- **ADR-PS1-03: Read-Only Document Identity.** Document numbers are authoritative sequence tokens allocated by `DocumentSeriesEngine`. Editable text inputs in the UI risk accidental numbering drift or duplicate sequence attempts. The UI renders the composite string `${header.prefix}-${header.orderNumber}` in a read-only tag badge.

## 6. Design Rationale
- **Clarity over Clutter:** Rather than presenting operators with 8 empty rows that might imply partially completed orders, the clean empty state clearly communicates that no products are added yet and provides direct buttons for all three addition modalities (manual add, spreadsheet import, and barcode/F2 scan).
- **Single Source of Truth for Document Series:** Transactional identity is governed centrally; manual modification of prefixes and numbers within transaction entry workspaces is prohibited.

## 7. Implementation Summary
- **Lines State Initialization:**
  ```tsx
  // PoSizewiseTab.tsx
  const [lines, setLines] = useState<SizewisePOLine[]>([]);
  ```
- **Empty State Component:** Rendered conditionally when `lines.length === 0`, with `sw-empty-f2-btn`, `Add Item`, and `Import from Excel`.
- **F2 Dispatcher Registration:**
  ```tsx
  useF2Screen({
    screenId: "po_sizewise",
    defaultEntity: "variant",
    adapter: f2Adapter,
  });
  const f2Dispatcher = useF2Dispatcher();
  ```
- **Composite Document Identity Badge:**
  ```tsx
  <div
    title="Document number is assigned automatically. Contact your administrator to change the series."
    className="inline-flex items-center gap-1.5 h-7 px-3 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold text-xs text-slate-700 select-all cursor-default"
  >
    <span className="material-symbols-outlined text-[13px] text-slate-400">tag</span>
    {header.prefix}-{header.orderNumber}
  </div>
  ```
- **Row Action Guard:**
  ```tsx
  {hasItem ? (
    <div className="flex items-center justify-center gap-1">
      <button ...>View</button>
      <button ...>Delete</button>
    </div>
  ) : (
    <span className="text-slate-300 text-[10px]">—</span>
  )}
  ```

## 8. Tests Executed
1. `npx vitest run src/tests/poSizewiseUX.test.ts`
   - Test 14: Verifies empty state lines array starts empty `[]` with 0 summary values.
   - Test 15: Verifies composite read-only document identity string format (`PO-37067`).
   - Test 16: Verifies row action gating (`hasItem` predicate distinguishes populated vs empty rows).
   - Tests 1-13: Full footwear and sizewise matrix calculations, GST tier thresholds, and scale presets.
2. `npx tsc --noEmit`
   - Complete TypeScript compilation across the entire project.

## 9. Verification Results
- `src/tests/poSizewiseUX.test.ts`: 16/16 tests passing green (100% pass rate).
- `npx tsc --noEmit`: Exited with code 0 (0 compilation errors).
- `git diff --check HEAD`: Exited with code 0 (0 whitespace errors).

## 10. Known Limitations
- Advanced multi-grid keyboard navigation (arrow key matrix traversal) and batch size-distribution presets will be addressed in Phase 2.

## 11. Future Work
- Phase 2: Matrix Grid Ergonomics & Keyboard Navigation.
- Phase 3: Supplier Sourcing & Dynamic Catalog Price Matrix integration.

## 12. Related ADRs
- `ADR-F2-001`: Universal F2 Lookup Architecture & Dispatcher Protocol.
- `ADR-DOC-002`: Authoritative Document Series & Sequence Allocation.

## 13. Related RFCs
- `RFC-PO-2026-01`: SMRITI Retail OS Modern Purchase Order & Sizewise Studio Architecture.
