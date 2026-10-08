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

# Walkthrough: System Lookups & Core Master Directory — Clipboard Paste, CSV Import & Standard Presets Recommendation Engine

**Version:** 6.70.0  
**Date:** 2026-10-08  
**Area:** Foundation & Master Data Management  
**Status:** Done  

---

## 1. Purpose

Provide seamless, high-volume ingestion and authoritative standard recommendations for System Lookups & Core Master Directory (`MasterMgmtTab.tsx`). Users can:
1. Ingest lookup values via **Universal Grid Import** (drag-and-drop CSV/TSV or direct copy-paste from Excel/Google Sheets).
2. 1-click preview and apply **Industry Standard Recommendations & Presets** across 22+ retail and ERP lookup types (departments, designations, payment modes, banks, expense categories, currencies, GST rates, UOMs, genders, product types, materials, sizes, and colors).
3. Ingest records with transaction safety, duplicate protection, and compliance audit trail recording.

---

## 2. Scope

- **Frontend Core Master Management**: Wire `GlobalGridImportModal` and `LookupRecommendModal` into `MasterMgmtTab.tsx` header actions.
- **Global Grid Profile**: Register `LOOKUP_VALUE` profile in `GRID_PROFILES` and `GridProfileId`.
- **Recommendation Catalog**: Deliver `lookupStandardPresets.ts` with canonical retail and statutory master catalogs and intelligent missing-item filtering.
- **Interactive Preset Modal**: Deliver `LookupRecommendModal.tsx` with search, multi-selection, live item badges, and atomic ingestion.
- **Backend Bulk Ingestion Endpoint**: Add `POST /api/v1/masters/lookup/{type_code}/bulk-values` in `backend/app/api/v1/master_lookup.py` with multi-tenant company context and duplicate skipping.
- **Test Automation**: Add 5 comprehensive Vitest unit tests in `src/tests/lookupImportRecommend.test.ts`.

---

## 3. Files Created

1. `src/components/global/master/lookupStandardPresets.ts`: Standard retail and ERP presets covering 22+ lookup types, with case-insensitive lookup and `getMissingRecommendations` algorithms.
2. `src/components/global/master/LookupRecommendModal.tsx`: Visual drawer/modal for previewing, filtering, and 1-click importing industry presets into active lookup types.
3. `src/tests/lookupImportRecommend.test.ts`: Automated test suite certifying profile registration, catalog coverage, case insensitivity, and missing-item filtering.
4. `docs/walkthrough/foundation/System_Lookups_Import_Paste_And_Recommendation_Engine_v6.70.0.md`: This governance walkthrough document.

---

## 4. Files Modified

1. `src/services/gridInput/types.ts`: Added `"LOOKUP_VALUE"` to `GridProfileId` union.
2. `src/services/gridInput/gridProfiles.ts`: Configured `LOOKUP_VALUE` profile with required `code` and `name` fields, optional descriptions, active indicators, vendor codes, and ordered values.
3. `src/components/MasterMgmtTab.tsx`: Added `showGridImport` and `showRecommendModal` states, wired `extraHeaderActions` buttons, implemented `persistLookupValues`, and rendered both modals.
4. `backend/app/schemas/master_lookup.py`: Defined `MasterValueBulkCreate` and `MasterValueBulkResponse` Pydantic schemas.
5. `backend/app/api/v1/master_lookup.py`: Implemented `POST /lookup/{type_code}/bulk-values` endpoint with single-pass duplicate checking and audit trail logging.
6. `docs/walkthrough/README.md`: Appended record to master walkthrough index.

---

## 5. Architecture Decisions

- **AD-LOOKUP-01 (Unified Grid Integration):** Rather than creating an isolated custom file uploader, the System Lookups screen reuses the battle-tested `GlobalGridImportModal` with `LOOKUP_VALUE` profile, immediately unlocking Excel delimiter parsing, PDT scanner support, column alias auto-mapping, and duplicate resolution policies.
- **AD-LOOKUP-02 (Atomic Batch Endpoint with Client Fallback):** High-volume imports execute in a single round-trip via `POST /masters/lookup/{type_code}/bulk-values`. If an older backend environment lacks the bulk endpoint, the client transparently falls back to sequential single-item posts without failing the user's workflow.
- **AD-LOOKUP-03 (Canonical Recommendation Engine):** Presets are cataloged in `lookupStandardPresets.ts` and filtered against active items using both `code` and `name` collision checks, preventing duplicate insertions while providing 1-click industry standard onboarding.

---

## 6. Design Rationale

Retail stores onboarding to SMRITI Retail OS frequently need to establish dozens of base dimensions (sizes 38–46, colors, payment modes, GST rates, departments, expense categories). Manually entering each row via a single-item drawer was slow and prone to typographical inconsistencies. Providing both clipboard paste from existing spreadsheets and 1-click pre-populated industry standards dramatically reduces setup time from hours to seconds.

---

## 7. Implementation Summary

1. **`LOOKUP_VALUE` Grid Profile**: Configured with `requireProductResolution: false`, `atomicTransactionSafety: true`, and field aliases matching common Excel column names (`Code`, `Value`, `Title`, `Name`, `Description`, `Notes`, `Status`, `Vendor`).
2. **Standard Catalog Engine**: Pre-loaded comprehensive, statutory-accurate presets for GST rates (0%, 3%, 5%, 12%, 18%, 28%), payment modes (Cash, UPI, Credit Card, Debit Card, Net Banking, Store Credit, Voucher), UOMs (PCS, PAIR, BOX, MTR, KG), sizes, footwear curves, and apparel groupings.
3. **`LookupRecommendModal`**: Features instant search, multi-selection, "Select All Missing" / "Clear", active/inactive status badges, and progress feedback during ingestion.
4. **Backend Router & Schemas**: Implemented `POST /lookup/{type_code}/bulk-values` with `MasterValueBulkCreate` (up to 500 items), company context scoping, and audit journal logging.

---

## 8. Tests Executed

Terminal Test Execution:
```bash
npx vitest run src/tests/lookupImportRecommend.test.ts src/tests/masterPage.test.ts
```

Console Output:
```text
 RUN  v4.1.11 F:/SMRITRretailNX

 ✓ src/tests/lookupImportRecommend.test.ts (5 tests) 21ms
 ✓ src/tests/masterPage.test.ts (6 tests) 9ms

 Test Files  2 passed (2)
      Tests  11 passed (11)
   Start at  20:18:52
   Duration  1.23s (transform 383ms, setup 0ms, import 1.08s, tests 30ms, environment 0ms)
```

Linter & Launchpad Execution:
```bash
npm run validate-launchpad
```
```text
Catalog tiles: 51
Unique tile IDs: 51
App render cases: 109
PASSED: every Launchpad tile has a unique ID and an App render case.
```

---

## 9. Verification Results

| Target | Test Claim / Verification Area | Metric | Status |
|---|---|---|---|
| Grid Profile | `LOOKUP_VALUE` profile in `GRID_PROFILES` | 1/1 verified | Done |
| Presets Catalog | 22 retail & ERP lookup categories | 22/22 verified | Done |
| Missing Filter | Duplicate suppression by Code & Name | 2/2 verified | Done |
| Vitest Suite | Unit tests in `lookupImportRecommend.test.ts` | 5/5 green | Done |
| Regression Suite | Master page tests in `masterPage.test.ts` | 6/6 green | Done |
| Launchpad Registry | Fiori Launchpad routes & tiles | 51/51 valid | Done |

---

## 10. Known Limitations

- Bulk ingestion is limited to 500 items per HTTP request payload to maintain optimal database connection timeouts. Datasets larger than 500 items should be pasted or uploaded in batches.
- Vendor code ownership is enforced exclusively for `style_article` lookup type in accordance with SMRITI catalog governance rules.

---

## 11. Future Work

- Add CSV download template button in `LookupRecommendModal` pre-populated with active lookup field headers.
- Extend recommendation engine to support localized regional language titles for lookup values.

---

## 12. Related ADRs

- `AD-INV-01`: Product vs Lookup Boundary (Catalog dimensions strictly governed in System Lookups).
- `AD-LOOKUP-01`: Unified Grid Integration for System Lookups.
- `AD-LOOKUP-02`: Atomic Batch Ingestion with Client Fallback.

---

## 13. Related RFCs

- RFC 4180: Common Format and MIME Type for Comma-Separated Values (CSV).
- RFC 8594: Sunset HTTP Header Field and Deprecation Notice Standard.
