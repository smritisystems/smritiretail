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
  Classification: Implementation Plan — Item Master Export Parity and Field Resolution
-->

# SMRITI Item Master & Catalog: Export Parity, Universal Field Resolution, and Tri-Modal Output Plan

## 1. Objective
Eliminate blank fields (specifically Column H `Article`, Column F `Gender`, and Column G `Product Type`) during catalog data exports, establishing 100% field parity between the UI table view (`ItemCatalogGrid.tsx`), Quick-Audit mode (`ItemDetailsGrid.tsx`), and exported workbooks (`.xlsx` and `.csv`). Provide multi-format export capabilities with native styled OpenXML Excel spreadsheets, RFC-4180 compliant CSV serialization with UTF-8 BOM, and universal fallback resolution across naming conventions and attribute schemas.

## 2. Business Motivation
Operators, store managers, and merchandisers rely on catalog exports to reconcile physical inventory with distributor indents, update e-commerce marketplaces, and share price lists with buyers. When article codes appear correctly on screen (e.g. `SND-10-J`, `SH-03-I`) but export as blank columns in Excel/CSV, downstream ERP reconciliations, purchase orders, and stock audits fail. Furthermore, barcodes exported without protection convert to scientific notation in Microsoft Excel, leading to broken scans and data corruption.

## 3. Scope
- **In Scope:**
  - `src/components/itemMaster/ItemCatalogGrid.tsx`: Implement canonical universal field resolvers (`resolveProductArticle`, `resolveProductColor`, `resolveProductSize`, `resolveProductGender`, `resolveProductType`, `resolveProductHsn`).
  - Upgrade `handleExport` and `handleBulkExportSelected` to support direct multi-format output (Excel `.xlsx` and CSV `.csv`).
  - Add an Export dropdown menu in the catalog top navigation bar.
  - `src/services/globalExportService.ts`: Implement `getRowValue` supporting case sensitivity fallback, canonical aliases (`style_code` <-> `styleCode` <-> `article`, `buying_price` <-> `buyingPrice`), and extensible attributes lookup across CSV, TSV, SpreadsheetML, OpenXML XLSX, and HTML serializers.
  - `src/components/itemMaster/ItemDetailsGrid.tsx`: Enrich `mapProductToGridRow` with complete alias properties to guarantee zero blank fields across all preset exports.
  - `src/tests/itemMasterExport.test.ts`: Add automated unit and integration tests certifying 100% field parity and non-blank export output.
- **Out of Scope:**
  - Schema alterations to PostgreSQL database tables.
  - Changes to vendor purchase ingest endpoints.

## 4. Current State
- On-screen rendering in `ItemCatalogGrid.tsx` utilized fallback logic:
  `const article = getAttr(p, "article") || (p as any).style_code || p.styleCode || "";`
- However, `handleExport` and `handleBulkExportSelected` evaluated only `getAttr(p, "article")`.
- `getAttr` strictly checked `p.attributes?.article` and `p.article`, omitting `style_code`. Because the database stores article codes in `style_code`, exports produced blank strings for Column H.
- `gender` and `product_type` suffered from casing blindness and missing attribute fallbacks.
- Exports lacked RFC-4180 quote escaping on brands and categories, lacked UTF-8 BOM, and lacked native Excel `.xlsx` generation.

## 5. Gap Analysis
| Component | Gap | Remediation |
|---|---|---|
| `ItemCatalogGrid.tsx` | Export handler bypassed `style_code` fallback present in UI | Introduced `resolveProductArticle` shared between UI render and export serializers |
| `ItemCatalogGrid.tsx` | Export format restricted to unescaped CSV | Added multi-format export with `serializeToOpenXMLXLSX` and RFC-4180 CSV with BOM |
| `ItemCatalogGrid.tsx` | Search omitted article code from `style_code` | Integrated `resolveProductArticle` into omni-search matching |
| `globalExportService.ts` | Row access relied solely on literal key `row[col.key]` | Added `getRowValue` with alias fallback across snake_case, camelCase, and `attributes` |
| `ItemDetailsGrid.tsx` | `mapProductToGridRow` omitted `style_code`, `article`, `buying_price` | Added full bidirectional aliasing in grid row projection |

## 6. Architecture Impact
- **Parity Guarantee:** The on-screen representation and exported file datasets now consume the identical deterministic resolver functions.
- **Tri-Modal Export Engine:** Seamlessly delivers OpenXML Excel (`.xlsx`), RFC-4180 CSV (`.csv`), and Tab-Separated Values (`.tsv`).
- **Defensive Data Access:** `globalExportService.ts` automatically repairs casing and alias mismatches across all system modules without requiring callers to pre-flatten objects.

## 7. Proposed Design
1. **Universal Field Resolvers:**
   - `resolveProductArticle(p)`: inspects `attributes.article`, `attributes.style_code`, `style_code`, `styleCode`, `article`, `article_code`, `style`, `design_code`.
   - `resolveProductColor(p)`: inspects `color`, `colour`, `attributes.color`, `attributes.shade`, `attributes.color_shade`.
   - `resolveProductSize(p)`: inspects `size`, `attributes.size`, `size_eu`, `size_uk`.
   - `resolveProductGender(p)`: inspects `gender`, `attributes.gender`, `target_gender`, `a4`, with category/name classification fallback.
   - `resolveProductType(p)`: inspects `product_type`, `productType`, `attributes.type`, falling back to `category`.
2. **Defensive Value Retrieval (`getRowValue`):**
   - Implements 5-tier lookup: Direct match -> CamelCase/SnakeCase conversion -> Domain alias registry -> Extensible attributes dictionary -> Category inferrer.
3. **Multi-Format UI Interaction:**
   - Top bar provides a split button: One-click primary Excel `.xlsx` download + Chevron dropdown for CSV.
   - Bulk floating bar supports immediate Excel `.xlsx` export of selected items.

## 8. Files Created
- `docs/implementation/inventory/Item_Master_Export_Parity_And_Field_Resolution_Plan_v6.72.0.md`
- `docs/walkthrough/inventory/Item_Master_Export_Parity_And_Field_Resolution_v6.72.0.md`

## 9. Files Modified
- `src/components/itemMaster/ItemCatalogGrid.tsx`
- `src/services/globalExportService.ts`
- `src/components/itemMaster/ItemDetailsGrid.tsx`
- `src/tests/itemMasterExport.test.ts`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`

## 10. Dependencies
- `pako`: Used by OpenXML ZIP engine in `globalExportService.ts`.
- `lucide-react`: UI icons for Excel, CSV, and export controls.
- `vitest`: Automated test runner.

## 11. Risks
- **Risk:** Existing custom presets might expect literal unmapped keys.
  - *Mitigation:* `getRowValue` only falls back to aliases when the direct key is `undefined` or `null`, preserving exact preset overrides.

## 12. Rollback Strategy
Git revert commits on branch `smritiNX`. All changes are self-contained in client-side presentation and serialization components.

## 13. Verification Plan
1. Run automated test suite: `npx vitest run src/tests/itemMasterExport.test.ts` (19/19 tests green).
2. Run TypeScript compilation: `npx tsc --noEmit` (0 errors).
3. Validate CSV output contains UTF-8 BOM, escaped quotes, and non-blank article values.
4. Validate OpenXML XLSX output contains valid ZIP PK magic headers and formatted cell entries.

## 14. Test Plan
- Unit tests verifying `resolveProductArticle` extracts from `style_code`, `styleCode`, and `attributes`.
- Unit tests verifying `getRowValue` handles snake/camel conversion.
- End-to-end serialization test asserting `SND-10-J` is populated under `Article` column.

## 15. Documentation Impact
- Update `docs/implementation/README.md` with Plan entry.
- Update `docs/walkthrough/README.md` with Walkthrough entry.

## 16. Deployment Plan
Commit and push to `smritiNX`. Sync test environment via standard git pull.

## 17. Status
Completed

## 18. Related ADRs
- `ADR-0028`: Universal Item Master Attribute Model & Extensible Schema
- `ADR-0044`: Tri-Modal Export Engine & Forensic Audit Compliance

## 19. Related Walkthroughs
- `docs/walkthrough/inventory/Item_Master_Export_Parity_And_Field_Resolution_v6.72.0.md`
- `docs/walkthrough/inventory/Item_Master_Tri_Modal_Export_Engine_v6.71.0.md`
