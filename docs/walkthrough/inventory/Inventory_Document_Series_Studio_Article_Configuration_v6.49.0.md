<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.49.0
  Created      : 2026-09-30
  Modified     : 2026-09-30
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: SMRITI Document Series Studio — Category-Aware Article Numbering Configuration

**Document ID:** WT-INV-SERIES-STUDIO-v6.49.0  
**Area:** Inventory & System Numbering Architecture  
**Status:** Done  
**Release Target:** v6.49.0  

---

## 1. Purpose
This implementation enhances the existing **"Document Series & Numbering Studio"** (accessible via the `document-series` master configuration tab) to support category-aware Article Numbering Series (`document_type = 'ARTICLE'`). It enables enterprise retail administrators to configure sequential ranges, floor-to-ceiling boundaries, prefix/suffix formats, and category bindings for master Article creation while strictly preserving backward compatibility, statutory sales invoice numbering, and database sequence safety.

---

## 2. Scope
- **Studio Interface Hardening:** Reconnected `documentSeriesConfig` from legacy unrouted paths to the canonical FastAPI `/api/v1/numbering/series` endpoint.
- **Dynamic Category Binding:** Added conditional category selection for `ARTICLE` series with options fetched dynamically from `/api/v1/masters/lookup/category/values`.
- **Range & Guard Enforcement:** Extended grid columns and drawer form fields with floor (`startNumber`), ceiling (`endNumber`), and system-controlled sequence counters (`currentNumber`).
- **Live Sequence Preview:** Integrated an interactive, read-only sequential preview card computing the next allocated identifier, range span, and capacity tracking.
- **Collision & Overlap Prevention:** Implemented mathematical interval overlap checking in `customValidation` to prohibit conflicting active ranges within the same category.
- **Zero Database Drift:** Preserved existing database state (`smriti001`) with zero mutations, zero sequence consumption, and zero schema changes.

---

## 3. Files Created
1. `src/tests/documentSeriesStudio.test.ts` — Comprehensive unit test suite covering Studio metadata, dynamic category visibility, sequence counter controls, range validations, overlap detection, and payload transforms (13/13 tests green).
2. `docs/walkthrough/inventory/Inventory_Document_Series_Studio_Article_Configuration_v6.49.0.md` — This formal walkthrough document.
3. `docs/ux-audit/article-numbering/series-studio-list-desktop.png` — FHD desktop screenshot of Document Series Studio table.
4. `docs/ux-audit/article-numbering/series-studio-create-desktop.png` — FHD desktop screenshot of creation drawer.
5. `docs/ux-audit/article-numbering/series-studio-article-selected-desktop.png` — FHD desktop screenshot with Article document type selected.
6. `docs/ux-audit/article-numbering/series-studio-sandal-config-desktop.png` — FHD desktop screenshot showing SANDAL series live preview (`SND-10000-A`).
7. `docs/ux-audit/article-numbering/series-studio-shoes-config-desktop.png` — FHD desktop screenshot showing SHOES series live preview (`SH-20000-A`).
8. `docs/ux-audit/article-numbering/series-studio-article-mobile.png` — Mobile (390×844) viewport capture of drawer form.
9. `docs/ux-audit/article-numbering/series-studio-advanced-collapsed.png` — Desktop screenshot of collapsed advanced accordion.
10. `docs/ux-audit/article-numbering/series-studio-advanced-expanded.png` — Desktop screenshot of expanded advanced accordion.
11. `docs/ux-audit/article-numbering/series-studio-live-preview.png` — High-resolution detail of live sequential preview card.

---

## 4. Files Modified
1. `src/services/numberingEngine.ts` — Extended `DocumentSeries` interface to include `startNumber?`, `endNumber?`, `category?`, and `numberFormat?`.
2. `src/components/global/configs/documentSeries.con.tsx` — Updated `documentSeriesConfig` with canonical API endpoint, range columns, dynamic category lookup, live preview component, advanced accordion slot, and custom range validation.
3. `docs/walkthrough/README.md` — Updated master index table with entry for v6.49.0.

---

## 5. Architecture Decisions
- **Reuse Existing Engine & Infrastructure:** Rather than building a parallel "Article Numbering Manager", the existing `DocumentSeriesTab`, `MasterListScreen`, `MasterFormDrawer`, `DocumentsEngine`, and `NumberingService` were unified.
- **System-Controlled Counter Security:** In edit mode, `currentNumber` is set to read-only/disabled (`disabled: (_fs, isEdit) => Boolean(isEdit)`) to prevent manual operator sequence tampering.
- **Interval Overlap Arithmetic:** Range validity is verified using closed-interval overlap math: `max(A_start, B_start) <= min(A_end, B_end)`. Overlaps are blocked only for active series within the same category.
- **Progressive Disclosure:** Advanced settings (reset cycle, number format, POS terminal scope) are housed inside a collapsible accordion within `slots.extraFields`, keeping the primary drawer focused.

---

## 6. Design Rationale
- Retail operators need immediate visual feedback on how number prefixes and padding will materialize before committing configurations to production. The `LiveSeriesPreview` card renders exact allocations (e.g. `SND-10000-A` or `SH-20000-A`) alongside capacity indicators (emerald/amber/rose).
- Distinct footwear lines (e.g., Sandals vs Shoes) utilize distinct numbering conventions and numbering intervals. Binding `category` directly to the series ensures deterministic number allocation during product onboarding.

---

## 7. Implementation Summary
```
+---------------------------------------------------------------------------------+
|                          DOCUMENT SERIES & NUMBERING STUDIO                     |
|                                                                                 |
|  [+ New Document Series]  [Search...]  [Filters: Module / Status]               |
|  +---------------------------------------------------------------------------+  |
|  | Name               | Prefix/Pattern | Range (Floor -> Ceil) | Current Seq |  |
|  | SER-ART-SANDAL-001 | SND-[00000]-A  | 10,000 -> 19,999      | 9,999       |  |
|  | SER-ART-SHOES-001  | SH-[00000]-A   | 20,000 -> 29,999      | 19,999      |  |
|  | SER-ART-COMP001    | ART/{FY}/[000] | 1 -> Continuous (∞)   | 0           |  |
|  | ... (53 Statutory Sales & Purchase Series)                                |  |
|  +---------------------------------------------------------------------------+  |
|                                                                                 |
|  DRAWER FORM:                                                                   |
|  - Document Type: Article / Design (Master)                                     |
|  - Category: [ SANDAL v ] (dynamically fetched from lookup master)              |
|  - Series Name: Article Series - Sandal                                         |
|  - Prefix: SND-  | Suffix: -A                                                   |
|  - Start Number: 10000  | End Number: 19999                                     |
|  - LIVE PREVIEW CARD: "Next Allocated Number: SND-10000-A"                      |
|    "Range Scope: 10,000 ➔ 19,999" (10,000 allocations remaining)               |
|  - [v] Advanced Options Accordion (Reset Rule: Never, Unified Terminal Pool)    |
+---------------------------------------------------------------------------------+
```

---

## 8. Tests Executed
1. **Unit Test Suite:** `npx vitest run src/tests/documentSeriesStudio.test.ts`
   - 13/13 tests passed (API contract, dynamic `showWhen`, sequence lock, range validation, category overlap detection, payload transforms).
2. **TypeScript Compilation:** `npx tsc --noEmit`
   - Clean exit 0 with 0 errors.
3. **Database Integrity Audit:** `scratch/check_db_safety.py`
   - Verified untouched sequence counters:
     - `SER-ART-SANDAL-001`: `current_number = 9999`
     - `SER-ART-SHOES-001`: `current_number = 19999`
     - `SER-ART-COMP001`: `current_number = 0`
     - `SND-10000-A` count: 0
     - `SH-20000-A` count: 0
     - Total items: 796
4. **End-to-End Headless Browser Validation:** `scratch/test_studio_e2e.py`
   - Playwright test executed across desktop (1920×1080) and mobile (390×844) viewports.

---

## 9. Verification Results
- **Evidence Level:** A (Direct observable diffs, literal terminal logs, and visual telemetry artifacts).
- **Status:** Done.
- **Visual Telemetry Artifacts:**
  - `docs/ux-audit/article-numbering/series-studio-list-desktop.png` (1920×1080)
  - `docs/ux-audit/article-numbering/series-studio-sandal-config-desktop.png` (1920×1080)
  - `docs/ux-audit/article-numbering/series-studio-shoes-config-desktop.png` (1920×1080)
  - `docs/ux-audit/article-numbering/series-studio-article-mobile.png` (390×844)
  - `docs/ux-audit/article-numbering/series-studio-live-preview.png` (Detail)

---

## 10. Known Limitations
- The sequence counter in PostgreSQL increments atomically inside transaction locks; sequence rollbacks do not decrement `current_number` to guarantee audit trail integrity.
- Category lookup requires network access to `/api/v1/masters/lookup/category/values`; offline fallback provides canonical standard categories (`SANDAL`, `SHOES`, `CHAPPAL`, `APPAREL`, etc.).

---

## 11. Future Work
- Sequence threshold alert notifications (e.g., dispatching alert when remaining series allocations drop below 5%).
- Automated creation of next-tier series when current range reaches ceiling capacity.

---

## 12. Related ADRs
- `ADR-NUM-001`: Unified Sequential Numbering Engine Architecture
- `ADR-INV-003`: Dynamic Article Identity & Category-Aware Series Allocation

---

## 13. Related RFCs
- `RFC-CAT-2026-08`: Enterprise Category-Aware Sequence Governance in Retail Footwear
