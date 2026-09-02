<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-09-02
  Modified     : 2026-09-02
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# F2 Universal Lookup Architecture v2 — Phase C Implementation Walkthrough

**Area:** Foundation / Platform UX Protocol
**Version:** 1.0.0
**Date:** 2026-09-02
**Commits:** `cade22ac` (Batch 1) · `4398d6a5` (Batch 2A)
**Batch:** `F2-ARCH-V2-PHASE-C`

---

## 1. Purpose

Complete the F2 Universal Lookup Architecture v2 migration by:

1. **Batch 1** — Migrating the two remaining un-migrated screens (`TagLabelPrintingTa`, `CustMasterWs`) to `useF2Screen()` + `FieldAdapter` pattern.
2. **Batch 2A** — Atomically decommissioning all legacy F2 infrastructure (`GlobalF2BrowseDlg`, deprecated `ActiveFieldContext` stubs) once zero production callers remain.

After Phase C, the F2 Universal Lookup Architecture v2 migration is **complete** for all actively migrated screens. `GlobalF2BrowseDlg.tsx` is permanently removed from the codebase and the bundle.

---

## 2. Scope

- **Screens migrated (Batch 1):** `TagLabelPrintingTa.tsx`, `CustMasterWs.tsx`
- **Infrastructure decommissioned (Batch 2A):** `GlobalF2BrowseDlg.tsx` (deleted), `ActiveFieldContext.tsx` deprecated stubs, `GlobalSearch.tsx` no-op call
- **Explicitly out of scope:** `ItemDetailsGrid.tsx` (domain-specific F2 code-entry modal — retained by design), `GlobalSearch.tsx` Ctrl+K core behavior (preserved), `F2DispatcherContext.tsx`, `UniversalBrowseEngine.tsx`, `f2LookupRegistry.ts`

---

## 3. Files Created

| File | Purpose |
|---|---|
| `src/tests/f2PhaseC_Batch1.test.ts` | 17-test regression suite for Batch 1 migrations |

---

## 4. Files Modified

### Batch 1 — Screen Migrations

| File | Version | Change |
|---|---|---|
| `src/components/barcode/TagLabelPrintingTa.tsx` | 6.8.0 → 6.9.0 | Replaced local `e.key==='F2'` handler with `useF2Screen` + `useF2Dispatcher`. Tagged `stockNoFrom` and `stockNoTo` with `id` + `data-f2-entity="variant"`. Adapter routes deterministically via `dispatcher.originElementRef.current.id`. `PurchBrowseDlg` button trigger and F11/F8 preserved. |
| `src/components/customer/CustMasterWs.tsx` | 5.5.0 → 5.6.0 | Removed `e.key==='F2'` branch. Registered `useF2Screen(screenId=CustMasterWs, entity=customer)`. Adapter resolves by canonical `id` then `code`. `Alt+S` and `SmritiAdvancedCustomerSearchModal` preserved entirely. |

### Batch 2A — Legacy Decommission

| File | Version | Change |
|---|---|---|
| `src/components/drilldown/GlobalF2BrowseDlg.tsx` | — | **DELETED** — 1,118-line file permanently removed from codebase and production bundle |
| `src/App.tsx` | — | Removed `GlobalF2BrowseModal` static import (L48) and JSX comment+element (L1930–1932) |
| `src/context/ActiveFieldContext.tsx` | 7.0.0 → 7.1.0 | Removed `isF2ModalOpen` state/interface/provider value, `openF2Modal`, `closeF2Modal`, `insertValueIntoActiveField` (no-op). All focus/input tracking preserved. |
| `src/components/drilldown/GlobalSearch.tsx` | 3.32.0 → 3.33.0 | Removed `insertValueIntoActiveField` destructure and its no-op call. Ctrl+K, `openPanel`, `pushContext`, drill-down, keyboard navigation all preserved. |

---

## 5. Architecture Decisions

### AD-1: Deterministic field routing via `originElementRef`

`useF2Dispatcher` exposes `originElementRef` — a ref captured at keydown time, before the lookup modal opens. The `TagLabelPrintingTa` adapter reads `dispatcher.originElementRef.current.id` to distinguish `stockNoFrom` from `stockNoTo` without relying on `document.activeElement` (stale once the modal is focused).

### AD-2: Canonical ID-first customer resolution in CustMasterWs

The adapter resolves selected customers by `id` first, then `code`, mirroring the existing `SmritiAdvancedCustomerSearchModal` resolution pattern. Avoids positional array index resolution which is brittle against filter/sort state.

### AD-3: Atomic single-commit decommission (Batch 2A)

All four legacy changes staged and committed atomically: prevents any window where the file is deleted but the import still references it (broken build).

### AD-4: Comment-only references in UniversalBrowseEngine acceptable

Three lines in `UniversalBrowseEngine.tsx` reference legacy symbol names in JSDoc comments as architectural lineage documentation. Not executable references — intentionally retained.

### AD-5: GlobalSearch insertValueIntoActiveField was a silent no-op since Phase A

Already a no-op stub since Phase A. Its removal produces no visible behavioral change. GlobalSearch drill-down flows through `openPanel`/`pushContext` independently.

---

## 6. Design Rationale

- **Why delete GlobalF2BrowseDlg immediately?** After Phase B + C Batch 1, zero screens called `openF2Modal`. `isF2ModalOpen` was permanently `false` at runtime. The component rendered `null` on every React render cycle, consuming ~58 KB of compiled bundle with no benefit.
- **Why preserve `lastFocusedInputRef` after removing `closeF2Modal`?** It is still used by `handleFocusIn` for contextual HUD display — not exclusively owned by `closeF2Modal`.
- **Why remove `insertValueIntoActiveField` entirely?** The stub existed only to prevent compile errors in legacy call sites during migration. With zero external call sites remaining, the stub's purpose was eliminated.

---

## 7. Implementation Summary

### Batch 1 (commit `cade22ac`)

1. Audited `PurchBrowseDlg` — confirmed opened by UI button, not F2
2. Added `useF2Screen` registration with correct `screenId` and `entity`
3. Tagged input fields with deterministic `id` + `data-f2-entity`
4. Wrote `FieldAdapter` callbacks using `originElementRef` for disambiguation
5. Preserved all non-F2 behavior (F11, F8, Alt+S, PurchBrowseDlg, SmritiAdvancedCustomerSearchModal)
6. Created 17-test regression suite; 59/59 total tests pass

### Batch 2A (commit `4398d6a5`)

1. Read-only preflight audit — mapped all 6 legacy symbols across entire `src/` tree
2. Confirmed `GlobalF2BrowseModal` has zero external callers; `isF2ModalOpen` permanently `false`
3. Deleted `GlobalF2BrowseDlg.tsx`
4. Patched `App.tsx`, `ActiveFieldContext.tsx`, `GlobalSearch.tsx`
5. Full verification pass (TSC, Vitest, build, zero-reference scan) before commit

---

## 8. Tests Executed

```
Command: npx vitest run src/tests/f2UniversalArchV2.test.ts src/tests/sofpF2RowIdentity.test.ts src/tests/f2PhaseC_Batch1.test.ts

 ✓ src/tests/f2PhaseC_Batch1.test.ts    (17 tests)  8ms
 ✓ src/tests/sofpF2RowIdentity.test.ts  (10 tests)  9ms
 ✓ src/tests/f2UniversalArchV2.test.ts  (32 tests) 25ms

 Test Files  3 passed (3)
      Tests  59 passed (59)
   Duration  511ms
```

---

## 9. Verification Results

| Gate | Command | Result |
|---|---|---|
| TypeScript | `npx tsc --noEmit` | Exit 0 — zero errors |
| Tests | `npx vitest run` | 59/59 pass |
| Build | `npm run build` | Exit 0 — 3526 modules (−1 vs pre-Batch 2A), 25.66s |
| Whitespace | `git diff --check` | Exit 0 |
| Legacy symbols (executable) | Repo-wide scan | **0 executable hits** |
| Legacy symbols (comments) | Repo-wide scan | 3 JSDoc lines in `UniversalBrowseEngine.tsx` — acceptable |
| ItemDetailsGrid F2 | Targeted scan | L369 `e.key === "F2"` present and unmodified |
| Pre-existing working-tree | `git diff --stat` | `SalesOrderTab.tsx` and App.tsx pre-existing hunks intact |

---

## 10. Known Limitations

- `ItemDetailsGrid.tsx` L369 domain-specific F2 code-entry modal is not part of Universal Lookup Architecture v2 by design.
- `GlobalSearch.tsx` Ctrl+K row selection no longer injects selected value into the previously focused input (was already a no-op since Phase A — no regression introduced).

---

## 11. Future Work

- **Phase D:** Production load verification — confirm `UniversalBrowseEngine` lookup latency under realistic concurrent session load.
- **GlobalSearch field injection:** If active-field value injection from Ctrl+K is needed, implement via `F2DispatcherContext` `FieldAdapter` pattern — not `ActiveFieldContext`.
- **`ItemDetailsGrid` migration (optional):** Separate tracked migration with its own Batch designation if standardization is required.

---

## 12. Related ADRs

- F2 Universal Lookup Architecture v2 ADR (Phase A)
- `F2DispatcherContext` Architecture ADR
- `useF2Screen` + `FieldAdapter` Screen Contract

---

## 13. Related RFCs

- RFC: Universal Keyboard Protocol for SMRITI Retail OS
- RFC: ActiveFieldContext Deprecation Schedule
