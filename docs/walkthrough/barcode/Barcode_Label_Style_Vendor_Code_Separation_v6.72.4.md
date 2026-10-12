<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS

  Founders
  * Pushpa Devi Jawahar Mallah - Founder & Chairperson
  * Jawahar Ramkripal Mallah - Founder, CEO & Chief Software Architect
  Websites     : aitdl.com | erpnbook.com | smritibooks.com

  Version      : 6.72.4
  Created      : 2026-10-12
  Modified     : 2026-10-12
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Barcode Label Style & Vendor Code Separation and Label Concatenation Engine (v6.72.4)

## 1. Purpose
This walkthrough documents the end-to-end decoupling of vendor code suffixes from Article / Style identifiers in the Item Master and catalog database, paired with the automated formatting engine for barcode labels where single-letter vendor codes retain a trailing hyphen (`[Style]-[VendorCode]-`, e.g. `CH-01-A-`), while in-house vendor `TT` (and multi-letter codes) format strictly without trailing hyphen (`[Style]-[VendorCode]`, e.g. `CH-501-TT`).

## 2. Scope
- Decoupling of vendor code suffixes from base article/style identifiers across the live database on `https://tattlythreads.smritisys.com/`.
- Enhancement of the barcode printing engine (`prnInterpolation.ts`, `PrintLabelsStudio.tsx`, `TagLabelPrintingTa.tsx`, and `types.ts`) to dynamically format article/style strings for thermal ZPL/DPL/PRN script generation and SVG previews.
- Pre-registration and approval of 38 clean base styles in master lookup `style_article` and vendor code `TT` in `vendor_code` lookup.
- Migration and normalization of 532 live product records on `https://tattlythreads.smritisys.com/` to clean `style_code` and separate `vendor_code`.
- Regeneration of the full 1,136-record barcode export workbooks (Excel and CSV) containing both clean `Style / Article`, separate `Vendor Code`, and formatted `Barcode Label Style (Printed)`.

## 3. Files Created
- [`scripts/clean_live_products_styles.py`](file:///f:/SMRITRretailNX/scripts/clean_live_products_styles.py): Asynchronous concurrent runner for migrating live product records to clean style codes and isolated vendor codes.

## 4. Files Modified
- [`src/components/barcode/prnInterpolation.ts`](file:///f:/SMRITRretailNX/src/components/barcode/prnInterpolation.ts): Added `vendorCode` to `PrnItemData`; implemented `formatStyleForBarcodeLabel`; enhanced token interpolation with `{vendor_code}`, `{vendor}`, `#VENDOR_CODE#`, `#VENDOR#`.
- [`src/components/barcode/types.ts`](file:///f:/SMRITRretailNX/src/components/barcode/types.ts): Added `vendorCode?: string` to `LabelPrintRow`.
- [`src/components/barcode/PrintLabelsStudio.tsx`](file:///f:/SMRITRretailNX/src/components/barcode/PrintLabelsStudio.tsx): Added `vendorCode` to `StudioRow`; wired `formatStyleForBarcodeLabel` into SVG preview rendering, ZPL/DPL string compilers, and inventory/transaction mappings.
- [`src/components/barcode/TagLabelPrintingTa.tsx`](file:///f:/SMRITRretailNX/src/components/barcode/TagLabelPrintingTa.tsx): Propagated `vendorCode` through `activePrintItems` into `compilePrnBatch`, manual DPL generators, and preview components.
- [`src/tests/prnInterpolation.test.ts`](file:///f:/SMRITRretailNX/src/tests/prnInterpolation.test.ts): Added unit test cases for `formatStyleForBarcodeLabel` and template token interpolation with trailing dashes for single-letter vendors and no trailing dash for `TT`.
- [`src/components/itemMaster/ItemMasterWs.tsx`](file:///f:/SMRITRretailNX/src/components/itemMaster/ItemMasterWs.tsx): Enhanced live badge from ambiguous `{products.length} Articles Live` to dual-hierarchy `{uniqueArticlesCount} Articles • {products.length} SKUs Live` (`91 Articles • 1137 SKUs Live`).
- [`scripts/export_all_1136_barcodes.py`](file:///f:/SMRITRretailNX/scripts/export_all_1136_barcodes.py): Updated export schemas to include clean `Style / Article`, `Vendor Code`, and `Barcode Label Style (Printed)`.

## 5. Architecture Decisions
- **ADR-BARCODE-01: Separation of Catalog Identity and Label Rendering Presentation**:
  Base style codes in the system of record must remain pure product identities (e.g. `CH-01`, `CH-41`, `CH-501`), enabling multi-vendor sourcing and unified inventory reporting without catalog fragmentation. Suffixing (`-A-`) is strictly a presentation-layer transform for physical labeling.
- **ADR-BARCODE-02: Idempotent Label Formatting Normalizer**:
  `formatStyleForBarcodeLabel` is engineered to be strictly idempotent. If an incoming style already contains the vendor code suffix or trailing hyphen, it does not double-append (`CH-01-A-` remains `CH-01-A-`, `CH-501-TT-` normalizes to `CH-501-TT`). Leading quotation marks or commas (such as `",CH-01"`) and legacy prefixes (`V-00A` -> `A`) are automatically stripped and normalized.

## 6. Design Rationale
Retail barcode scanners and store personnel frequently read the human-readable text on shoe box labels and hang tags to verify both the style and vendor source at a glance. Single-letter external supplier codes require a trailing delimiter (`CH-01-A-`, `CH-41-V-`) for delimiter separation on packaging labels, whereas Tattly Threads in-house production articles (`CH-501` to `CH-541`) use vendor code `TT` without trailing punctuation (`CH-501-TT`).

## 7. Implementation Summary
1. **Barcode Engine & Template Interpolation**:
   Implemented `formatStyleForBarcodeLabel(rawStyle?: string, vendorCode?: string)`:
   - Returns clean style if no vendor code provided.
   - Trims and normalizes legacy vendor formats (e.g. `V-00A` -> `A`).
   - For single-letter vendors (`A` through `N`, `V`): Appends `-[Vendor]-` to produce standard formats: `CH-01-A-`, `CH-41-V-`.
   - For in-house vendor `TT` (or multi-letter codes): Appends `-[Vendor]` without trailing hyphen: `CH-501-TT`.
2. **UI & Studio Propagation**:
   Integrated `formatStyleForBarcodeLabel` into:
   - `PrintLabelsStudio.tsx`: `generateThermalLabelSvgString`, `compilePrnString`, `compileDplFootwearString`.
   - `TagLabelPrintingTa.tsx`: `compilePrnBatch`, `generateRawDplScript`, and live dialog preview elements.
3. **Live Catalog Migration (`https://tattlythreads.smritisys.com/`)**:
   - Registered 38 clean styles (`CH-01` through `CH-25`, `SH-02`, `SH-03`, `SND-01` through `SND-19`) in master lookup `style_article`.
   - Registered vendor code `TT` in `vendor_code` lookup.
   - Executed `scripts/clean_live_products_styles.py` updating 532 product records with zero errors.
   - Verified 1,137 products across 91 distinct styles in Postgres now possess clean styles and separate vendor codes.
4. **Data Export Workbooks**:
   Regenerated complete workbooks across client data directory, repository exports, and artifacts directory.

## 8. Tests Executed
1. `npx vitest run src/tests/prnInterpolation.test.ts` (8/8 tests passed).
2. `npx tsc --noEmit` (TypeScript typecheck passed with 0 errors).
3. `python scripts/validate_zpl_footwear_template.py` (all 8 validation gates passed).
4. `python scripts/clean_live_products_styles.py` (532/532 live product updates completed with 0 errors).
5. `python scripts/export_all_1136_barcodes.py` (1,136 distinct barcode records verified and exported).

## 9. Verification Results
- Vitest suite: 8/8 tests green.
- TypeScript compiler: 0 errors (`tsc --noEmit` clean).
- Database audit: 1,137 products scanned on live server, 0 products with vendor suffixes in `style_code`, 91 distinct clean styles confirmed.
- Export verification: 1,136 rows generated with verified columns: `Style / Article: CH-01`, `Vendor Code: A`, `Barcode Label Style (Printed): CH-01-A-`.

## 10. Known Limitations
- The Excel CSV file at `F:\SMRITRretailNX\exports\TATTLY_THREADS_ALL_1136_BARCODES_WITH_STYLES.csv` was temporarily locked by an active external Windows application process; updated versions are persisted in `F:\Smriti-Clients Data\Tattly Threads\ItemMaster\` and the artifacts directory.

## 11. Future Work
- Extend server-side `render_zpl` in `barcode_engine` to incorporate the identical `format_style_for_barcode_label` presentation transformer.

## 12. Related ADRs
- `ADR-0021`: Universal Item Master Three-Tier Hierarchy.
- `ADR-BARCODE-01`: Decoupled Presentation Suffixing for Industrial Printing.

## 13. Related RFCs
- `RFC-2026-08`: Retail Thermal Barcode Hardware Architecture.
