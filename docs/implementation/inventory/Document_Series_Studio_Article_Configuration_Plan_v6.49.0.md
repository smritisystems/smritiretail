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

# Implementation Plan: Document Series & Numbering Studio — Flexible Article Series Configuration

**Document ID:** IP-INV-SERIES-STUDIO-v6.49.0  
**Area:** Inventory / Document Series & Numbering Architecture  
**Status:** Completed  
**Release Target:** v6.49.0  

---

## 1. Objective
Enhance the existing "Document Series & Numbering Studio" (`document-series` master configuration) to support category-aware Article Numbering Series (`document_type = 'ARTICLE'`), keeping the architecture generic, extensible, and fully backward-compatible with statutory sales numbering rules while enforcing zero database drift and zero sequence consumption during auditing.

---

## 2. Business Motivation
Footwear and apparel retail enterprises require distinct sequential numbering series partitioned by product category (e.g. `SND-10000-A` for SANDAL, `SH-20000-A` for SHOES) with explicit allocation ranges. Without studio UI configuration, administrators are forced to seed database records manually. Bringing this capability into the unified Document Series Studio empowers retail managers to administer numbering conventions directly with real-time visual feedback and safety checks.

---

## 3. Scope
- Reconnect Document Series Studio to the live FastAPI `/api/v1/numbering/series` endpoint.
- Provide dynamic, category-aware field disclosure in `MasterFormDrawer`.
- Display range floor (`startNumber`) and ceiling (`endNumber`) columns in `MasterListScreen`.
- Provide read-only live sequence allocation preview (`LiveSeriesPreview`).
- Prohibit sequence counter tampering by disabling `currentNumber` in edit mode.
- Prevent overlapping active ranges within the same category via arithmetic validation.
- Preserve all existing statutory sales invoice series and database integrity.

---

## 4. Current State
- Backend database table `document_series` and SQLAlchemy model `DocumentSeries` already contain columns `category`, `start_number`, `end_number`, and `running_length`.
- Three Article series exist on tenant `smriti001`: `SER-ART-SANDAL-001` (`current_number = 9999`), `SER-ART-SHOES-001` (`current_number = 19999`), and `SER-ART-COMP001` (`current_number = 0`).
- The frontend studio configuration (`documentSeries.con.tsx`) pointed to an unrouted legacy path `/api/v1/system/document-series` resulting in HTTP 404.

---

## 5. Gap Analysis
1. **API Endpoint Mismatch:** Frontend called `/api/v1/system/document-series`; live FastAPI router is mounted at `/api/v1/numbering/series`.
2. **Category Binding Missing:** No category selector was available when creating or editing Article series.
3. **Range Fields Absent:** Form lacked `startNumber` (floor) and `endNumber` (ceiling) controls.
4. **Sequence Tampering Risk:** `currentNumber` was an open editable input.
5. **Lack of Visual Confirmation:** Operators had no live preview of how prefixes and zero-padding materialize into barcodes/SKUs.

---

## 6. Architecture Impact
- **Zero Schema Migrations:** Reuses existing PostgreSQL `document_series` columns with zero DDL or Alembic migrations.
- **Zero Engine Duplication:** Leverages the existing `DocumentsEngine` and `NumberingService`.
- **Framework Uniformity:** Retains `MasterConfig<DocumentSeries>`, `MasterListScreen`, and `MasterFormDrawer`.

---

## 7. Proposed Design
- Update `documentSeriesConfig.apiEndpoint` to `/api/v1/numbering/series`.
- Add `category` field with `showWhen: (formState) => formState.documentType === "ARTICLE"` and dynamic options endpoint `/api/v1/masters/lookup/category/values`.
- Add `startNumber`, `endNumber`, and lock `currentNumber` when `isEdit === true`.
- Implement `LiveSeriesPreview` card rendering the next allocation and remaining range capacity.
- House reset cycle, numbering format, and multi-terminal scope inside `slots.extraFields` accordion.
- Validate closed intervals in `customValidation` via `max(s1, s2) <= min(e1, e2)` for matching active categories.

---

## 8. Files Created
1. `src/tests/documentSeriesStudio.test.ts` — Comprehensive Vitest unit test suite (13/13 tests green).
2. `docs/walkthrough/inventory/Inventory_Document_Series_Studio_Article_Configuration_v6.49.0.md` — Formal walkthrough document.
3. `docs/implementation/inventory/Document_Series_Studio_Article_Configuration_Plan_v6.49.0.md` — This implementation plan.
4. Visual telemetry artifacts (9 screenshots) under `docs/ux-audit/article-numbering/`.

---

## 9. Files Modified
1. `src/services/numberingEngine.ts` — Added `startNumber?`, `endNumber?`, `category?`, and `numberFormat?` to `DocumentSeries` interface.
2. `src/components/global/configs/documentSeries.con.tsx` — Studio configuration enhancements.
3. `docs/walkthrough/README.md` — Appended walkthrough entry.
4. `docs/implementation/README.md` — Appended implementation plan entry.
5. `CHANGELOG.md` — Release notes for v6.49.0.

---

## 10. Dependencies
- FastAPI Numbering Router (`backend/app/api/v1/numbering.py`).
- PostgreSQL Tenant Database (`smriti001`, port 2781).
- Lucide React Icons (`Sparkles`, `Lock`, `Layers`, `ChevronDown`, `ChevronRight`).

---

## 11. Risks
- **Risk:** Manual editing of sequence counter could cause primary key or barcode collisions.
  - **Mitigation:** Counter input is locked (`disabled: (_fs, isEdit) => Boolean(isEdit)`) during edits.
- **Risk:** Range collisions across series.
  - **Mitigation:** Real-time interval overlap algorithm in `customValidation`.

---

## 12. Rollback Strategy
Git revert on `src/components/global/configs/documentSeries.con.tsx` and `src/services/numberingEngine.ts`. No database rollback or migration downgrade is required since zero database mutations occurred.

---

## 13. Verification Plan
- Typecheck workspace using `npx tsc --noEmit`.
- Run automated Vitest test suite (`src/tests/documentSeriesStudio.test.ts`).
- Verify database sequence integrity via `scratch/check_db_safety.py`.
- Headless browser validation across desktop (1920×1080) and mobile (390×844) viewports.

---

## 14. Test Plan
- Unit test suite verifying:
  1. API endpoint metadata.
  2. Category `showWhen` logic for ARTICLE vs non-ARTICLE.
  3. Category lookup option mapping.
  4. Sequence counter disabled state on edit.
  5. Floor/ceiling range validation and category overlap detection.
  6. Payload transformations for ARTICLE and statutory series.

---

## 15. Documentation Impact
- Formal walkthrough created: `docs/walkthrough/inventory/Inventory_Document_Series_Studio_Article_Configuration_v6.49.0.md`.
- Master walkthrough index updated: `docs/walkthrough/README.md`.
- Implementation index updated: `docs/implementation/README.md`.
- Release notes published: `CHANGELOG.md`.

---

## 16. Deployment Plan
Deploy changes directly within standard Vite frontend bundle. Backend requires no restarts as existing endpoints and models are utilized as-is.

---

## 17. Status
Completed.

---

## 18. Related ADRs
- `ADR-NUM-001`: Unified Sequential Numbering Engine Architecture
- `ADR-INV-003`: Dynamic Article Identity & Category-Aware Series Allocation

---

## 19. Related Walkthroughs
- `docs/walkthrough/inventory/Inventory_Document_Series_Studio_Article_Configuration_v6.49.0.md`
- `docs/walkthrough/catalog/Catalog_Article_Numbering_Backend_Wiring_And_Zero_Hardcoding_v6.48.1.md`
