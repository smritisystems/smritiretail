<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.70.0
  Created      : 2026-10-08
  Modified     : 2026-10-08
  Copyright    : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: System Lookups & Core Master Directory — Clipboard Paste, CSV Import & Standard Presets Recommendation Engine

**Version:** 6.70.0  
**Date:** 2026-10-08  
**Area:** Foundation & Master Data Management  
**Status:** Completed  

---

## 1. Objective

Provide high-efficiency ingestion and authoritative industry standard presets for **System Lookups & Core Master Directory** (`MasterMgmtTab.tsx`), eliminating manual repetitive entry through:
1. Direct Excel/Google Sheets clipboard copy-paste and CSV/TSV file import via the universal `GlobalGridImportModal`.
2. 1-click industry standard catalog recommendations via `LookupRecommendModal.tsx` and `lookupStandardPresets.ts` across 22+ retail and ERP lookup categories.
3. Atomic, high-volume server-side batch creation via `POST /api/v1/masters/lookup/{type_code}/bulk-values` in FastAPI Core with multi-tenant company context and duplicate skipping.

---

## 2. Business Motivation

When onboarding retail tenants, establishing core catalog dimensions (sizes, colors, categories, materials, departments, designations, payment modes, GST rates, UOMs) manually via single-entry forms consumes hours of operator effort and introduces typo risks. Providing both clipboard paste from existing vendor spreadsheets and 1-click pre-populated industry standards reduces master setup to seconds while enforcing strict catalog governance.

---

## 3. Scope

- **Frontend Wiring**: Integrate `GlobalGridImportModal` and `LookupRecommendModal` into `MasterMgmtTab.tsx` header toolbar.
- **Grid Profile**: Define and register `LOOKUP_VALUE` profile in `GRID_PROFILES` and `GridProfileId`.
- **Recommendation Catalog**: Deliver `lookupStandardPresets.ts` with comprehensive presets for 22+ lookup types and duplicate-filtering logic.
- **Interactive UI**: Deliver `LookupRecommendModal.tsx` with search, multi-selection, live status indicators, and atomic ingestion.
- **Backend Batch Endpoint**: Mount `POST /api/v1/masters/lookup/{type_code}/bulk-values` in FastAPI Core with audit trail logging.
- **Automated Testing**: 5 unit tests in `src/tests/lookupImportRecommend.test.ts`.

---

## 4. Current State

Previously, `MasterMgmtTab.tsx` only supported single-item drawer creation (`MasterFormDrawer.tsx`), CSV export, and an audit trail button. Bulk creation required running ad-hoc SQL migrations or inserting records one-by-one.

---

## 5. Gap Analysis

| Capability | Current State | Target State |
|---|---|---|
| Clipboard Paste | Not supported | Tabular matrix parsing (tabs, newlines) via `GlobalGridImportModal` |
| CSV File Import | Export only | Full CSV/TSV upload with dynamic column auto-mapping |
| Standard Presets | None in UI | 1-click preview and apply across 22+ retail/ERP categories |
| Server Batch Ingestion | Single-row `POST` only | Atomic `POST /lookup/{type_code}/bulk-values` (up to 500 items) |

---

## 6. Architecture Impact

- **UI Layer**: Seamlessly leverages `GlobalGridImportModal` and `GridInputEngine`, maintaining UI consistency across SMRITI Retail OS modules (POS, GRN, WMS, Item Master, Barcode Studio).
- **Backend Layer**: Adds high-throughput batch ingestion route in `master_lookup.py` using single-query preloaded code set for O(1) duplicate checks and atomic transaction commit.
- **Tenant Scope**: Respects multi-tenant isolation rules, company context scoping, and audit journal logging.

---

## 7. Proposed Design

1. Register `LOOKUP_VALUE` in `src/services/gridInput/types.ts` and `gridProfiles.ts`.
2. Catalog industry standard datasets in `src/components/global/master/lookupStandardPresets.ts`.
3. Create `LookupRecommendModal.tsx` displaying available vs registered items with select-all-missing functionality.
4. Wire extra header action buttons and modals into `MasterMgmtTab.tsx`.
5. Implement `POST /api/v1/masters/lookup/{type_code}/bulk-values` with `MasterValueBulkCreate` and `MasterValueBulkResponse` schemas.

---

## 8. Files Created

1. `src/components/global/master/lookupStandardPresets.ts`
2. `src/components/global/master/LookupRecommendModal.tsx`
3. `src/tests/lookupImportRecommend.test.ts`
4. `docs/walkthrough/foundation/System_Lookups_Import_Paste_And_Recommendation_Engine_v6.70.0.md`
5. `docs/implementation/foundation/System_Lookups_Import_Paste_And_Recommendation_Engine_Plan_v6.70.0.md`

---

## 9. Files Modified

1. `src/services/gridInput/types.ts`
2. `src/services/gridInput/gridProfiles.ts`
3. `src/components/MasterMgmtTab.tsx`
4. `backend/app/schemas/master_lookup.py`
5. `backend/app/api/v1/master_lookup.py`
6. `docs/implementation/README.md`
7. `docs/walkthrough/README.md`
8. `CHANGELOG.md`

---

## 10. Dependencies

- `@smriti/grid-input-engine` (internal)
- FastAPI + SQLAlchemy AsyncSession
- Lucide React icons (`Upload`, `Sparkles`, `History`)

---

## 11. Risks

- **Data Integrity**: Handled by backend validation, duplicate code suppression (`skip_existing`), and active tenant boundary enforcement.
- **Payload Limits**: Capped at 500 items per bulk request to prevent database statement timeouts.

---

## 12. Rollback Strategy

Changes are strictly additive:
- Backend bulk endpoint is non-breaking and leaves single-item endpoints unchanged.
- Frontend header actions and modals operate independently of existing view drawers.
- Git revert of the commit safely restores baseline without database schema changes.

---

## 13. Verification Plan

1. Vitest unit tests in `lookupImportRecommend.test.ts`.
2. Master regression tests in `masterPage.test.ts`.
3. Launchpad registry validation (`npm run validate-launchpad`).
4. End-to-end inspection of CSV upload, clipboard paste, and preset recommendation dialogs.

---

## 14. Test Plan

- Test `LOOKUP_VALUE` profile registration in `GRID_PROFILES`.
- Test `STANDARD_LOOKUP_PRESETS` catalog completeness across all 22 lookup types.
- Test case insensitivity and whitespace handling.
- Test duplicate suppression logic in `getMissingRecommendations`.
- Test complex dimension groups (`size_group`, `color_group`).

---

## 15. Documentation Impact

- Walkthrough created in `docs/walkthrough/foundation/`.
- Master walkthrough index updated in `docs/walkthrough/README.md`.
- Master implementation index updated in `docs/implementation/README.md`.
- CHANGELOG updated with version entry.

---

## 16. Deployment Plan

Standard git commit on `smritiNX` development branch, deployable via standard container build. Zero database migrations required.

---

## 17. Status

**Completed**

---

## 18. Related ADRs

- `AD-INV-01`: Product vs Lookup Boundary
- `AD-LOOKUP-01`: Unified Grid Integration for System Lookups
- `AD-LOOKUP-02`: Atomic Batch Ingestion with Client Fallback

---

## 19. Related Walkthroughs

- [`System_Lookups_Import_Paste_And_Recommendation_Engine_v6.70.0.md`](../walkthrough/foundation/System_Lookups_Import_Paste_And_Recommendation_Engine_v6.70.0.md)
