<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.72.0
  Created      : 2026-10-12
  Modified     : 2026-10-12
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Walkthrough — Item Master Export Parity and Field Resolution
-->

# SMRITI Item Master & Catalog: Export Parity, Universal Field Resolution, and Tri-Modal Output Walkthrough

## 1. Purpose
To resolve the discrepancy between on-screen catalog views and exported files where fields like `Article` (Column H), `Gender` (Column F), and `Product Type` (Column G) exported as blank cells despite appearing correctly on the screen. This walkthrough documents the implementation of universal field resolution, multi-format export capability (OpenXML Excel `.xlsx` and RFC-4180 CSV with UTF-8 BOM), and defensive deep key resolution across the SMRITI Retail OS catalog stack.

## 2. Scope
- Universal field resolution in `ItemCatalogGrid.tsx` across `resolveProductArticle`, `resolveProductColor`, `resolveProductSize`, `resolveProductGender`, `resolveProductType`, and `resolveProductHsn`.
- Multi-format Export dropdown menu in the top bar of `ItemCatalogGrid.tsx` with instant Excel (.xlsx) and CSV (.csv) output options.
- Contextual floating bulk action bar integration exporting selected rows with high fidelity.
- Deep key resolution engine `getRowValue` in `globalExportService.ts` handling case conversions and alias lookups.
- Parity enrichment in `ItemDetailsGrid.tsx` (`mapProductToGridRow`).
- Vitest automated test suite verification in `itemMasterExport.test.ts`.

## 3. Files Created
- `docs/implementation/inventory/Item_Master_Export_Parity_And_Field_Resolution_Plan_v6.72.0.md`
- `docs/walkthrough/inventory/Item_Master_Export_Parity_And_Field_Resolution_v6.72.0.md`

## 4. Files Modified
- `src/components/itemMaster/ItemCatalogGrid.tsx`
- `src/services/globalExportService.ts`
- `src/components/itemMaster/ItemDetailsGrid.tsx`
- `src/tests/itemMasterExport.test.ts`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`

## 5. Architecture Decisions
1. **Single Source of Truth for Attribute Resolution:** Extracted resolution logic into standalone helper functions (`resolveProductArticle`, `resolveProductColor`, etc.) shared identically between table rendering (`paginated.map`) and export formatting (`mapProductToExportRow`).
2. **Tri-Modal Export in Catalog Grid:** Upgraded catalog export from a single unformatted CSV download to full multi-format capability utilizing `serializeToOpenXMLXLSX` and `downloadExportBlob`.
3. **Defensive Data Access in Global Export Engine:** Introduced `getRowValue` in `globalExportService.ts` to automatically bridge snake_case, camelCase, and JSON attributes without altering callers' underlying data contracts.
4. **Excel Barcode Protection:** Encoded numeric barcodes in CSV as `="<barcode>"` to guarantee that Microsoft Excel preserves all 13 digits and avoids scientific notation conversion.

## 6. Design Rationale
In retail operations, the Article/Design code (e.g. `SND-10-J`, `SH-03-I`) is the foundational business identifier used by vendors, distributors, and warehouse teams. When an export emits empty article cells, buyers cannot verify delivery manifests. By unifying screen rendering and export serializers under canonical resolvers, human operators and automated export pipelines are guaranteed identical, high-fidelity datasets.

## 7. Implementation Summary
- **Universal Resolvers (`ItemCatalogGrid.tsx`):**
  - `resolveProductArticle`: inspects `attributes.article`, `attributes.style_code`, `style_code`, `styleCode`, `article`, `article_code`, `style`, `design_code`.
  - `resolveProductColor`: inspects `color`, `colour`, `attributes.color`, `attributes.shade`, `attributes.color_shade`.
  - `resolveProductSize`: inspects `size`, `attributes.size`, `size_eu`, `size_uk`.
  - `resolveProductGender`: inspects `gender`, `attributes.gender`, `target_gender`, `a4`, with category/name fallback.
  - `resolveProductType`: inspects `product_type`, `productType`, `attributes.type`, falling back to `category`.
  - `resolveProductHsn`: inspects `hsn_code`, `hsnCode`, `hsn`, `attributes.hsn`.
- **Top Bar Export Split Button:**
  - Added primary button for instant Excel `.xlsx` download.
  - Added chevron dropdown with explicit options: `Excel Spreadsheet (.xlsx)` and `CSV Document (.csv)`.
- **Global Export Engine (`globalExportService.ts`):**
  - Integrated `getRowValue` into `serializeToCSV`, `serializeToTSV`, `serializeToSpreadsheetML`, `serializeToOpenXMLXLSX`, and `serializeToHTML`.
  - Prepend UTF-8 Byte Order Mark (`\uFEFF`) to all CSV payloads.

## 8. Tests Executed
Executed Vitest test suite covering:
1. Standard retail preset coverage.
2. Forensic compliance and anomaly audit rules.
3. Serialization of CSV, SpreadsheetML, and OpenXML XLSX buffers.
4. Field parity and resolver verification across style codes, colors, genders, and types.
5. `tsc --noEmit` full typecheck.

## 9. Verification Results
- **Vitest:** 19/19 tests passed in 61ms (`src/tests/itemMasterExport.test.ts`).
- **TypeScript:** `npx tsc --noEmit` exited with code 0 (zero errors).
- **Field Parity:** Article code `SND-10-J` verified present and non-empty in exported CSV and OpenXML structures.

## 10. Known Limitations
If an item was created with no name, category, or attributes, gender cannot be inferred and defaults gracefully to `"—"` or empty string.

## 11. Future Work
Add automatic batch attribute backfilling in the backend so newly inferred genders and product types can be permanently persisted to PostgreSQL during indents.

## 12. Related ADRs
- `ADR-0028`: Universal Item Master Attribute Model & Extensible Schema
- `ADR-0044`: Tri-Modal Export Engine & Forensic Audit Compliance

## 13. Related RFCs
- `RFC-0019`: Enterprise Retail Data Interchange & Export Specification
