<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.17.0
  Created      : 2026-08-16
  Modified     : 2026-08-16
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Item Master Universal Header Alias & Auto-Mapping Engine Walkthrough v3.17.0

## 1. Purpose
This walkthrough documents the design and implementation of the **SMRITI Item Master Universal Header Alias & Auto-Mapping Engine**. It enables seamless paste/import of Excel, CSV, TSV, and Google Sheets data with non-standard column headers without forcing end users to manually rename source Excel headers before importing.

## 2. Scope
* **Decoupled Engine Core**:
  * Created `types.ts`, `HeaderNormalizer.ts`, `HeaderAliasRegistry.ts`, and `HeaderMappingEngine.ts`.
* **Interactive Mapping Preview & Review UI**:
  * Created `HeaderMappingPrevi.tsx` for confidence scoring review (`✓ Exact`, `✓ High`, `⚠ Fuzzy`, `? Ambiguous`, `○ Unmapped`), manual dropdown overrides, missing required field detection, and LocalStorage profile save/load.
* **Item Master Spreadsheet Integration**:
  * Integrated mapping engine into `ExcelGridEntrySec.tsx` clipboard paste workflow with live status badge indicators (`✓ X auto-mapped | ⚠ Y review | ○ Z ignored`).
* **Unit Testing & Readiness Verification**:
  * Created unit test suite `src/tests/headerMap.test.ts` (9 tests passed, 73 total suite passed).
  * Executed production build (3,413 modules transformed, 0 leaks in `dist/`, COMP-001 readiness score 98 / 100).

## 3. Files Created
* `src/lib/headerMapping/types.ts`
* `src/lib/headerMapping/HeaderNormalizer.ts`
* `src/lib/headerMapping/HeaderAliasRegistry.ts`
* `src/lib/headerMapping/HeaderMappingEngine.ts`
* `src/components/HeaderMappingPrevi.tsx`
* `src/tests/headerMap.test.ts`
* `docs/walkthrough/foundation/Header_Alias_Auto.md`

## 4. Files Modified
* `src/components/ExcelGridEntrySec.tsx`
* `docs/walkthrough/README.md`

## 5. Architecture Decisions
* **Decoupled Engine Architecture**: Kept all normalization, alias matching, scoring, and profile persistence outside UI components in dedicated modules under `src/lib/headerMapping/`.
* **Multi-Stage Scoring**: Pipeline evaluates Exact Match (Score 100) $\rightarrow$ Known Alias Registry Match (Score 90) $\rightarrow$ Normalized Fuzzy Match (Score 55–85) $\rightarrow$ Ambiguity Detection $\rightarrow$ Unmapped.
* **Zero Silent Guessing**: Ambiguous headers (e.g., `"Price"`, `"Rate"`) are flagged for explicit user confirmation rather than silently choosing a candidate field.

## 6. Design Rationale
* **User-Centric Flexibility**: Retail users receive vendor Excel catalogs in hundreds of different header formats (`EAN`, `Style No`, `Make`, `Product Category`, `Sale Rate`). SMRITI adapts to the user's headers rather than requiring Excel pre-processing.

## 7. Implementation Summary
* Integrated `HeaderMappingEngine` into `ExcelGridEntrySec.tsx` `handlePaste`.
* Auto-mapped columns stream cleanly into grid rows upon user confirmation in `HeaderMappingPreviewModal`.

## 8. Tests Executed
* `npx vitest run src/tests/headerMap.test.ts`: 9/9 tests passed.
* `npx vitest run`: 12/12 test files passed (73/73 tests passed).
* `npx tsc --noEmit`: 0 static errors.
* `npm run build`: 3,413 modules transformed cleanly into `dist/`.
* `python scripts/verify_comp001.py`: 0 leaks, Score 98 / 100 (`READY_FOR_PRODUCTION_REFERENCE`).

## 9. Verification Results
```text
Implementation Status

✓ Code Complete
✓ Vitest Test Suite Passed (73/73 passed)
✓ Static Type Check Passed (0 errors)
✓ Production Build Complete (3,413 modules, 0 leaks in dist/)
✓ COMP-001 Readiness Classification: READY_FOR_PRODUCTION_REFERENCE (Score: 98 / 100)

Evidence Level: [A]
```

## 10. Known Limitations
* Advanced OCR or AI image-based header extraction requires Python FastAPI backend endpoint (scaffolded under `backend/app/ai/`).

## 11. Future Work
* Support server-side mapping profile sync across multi-tenant store branches.

## 12. Related ADRs
* `ADR-019`: Decoupled Header Normalization & Alias Mapping Architecture.

## 13. Related RFCs
* `RFC-044`: Universal Excel Import Auto-Detection Standard.
