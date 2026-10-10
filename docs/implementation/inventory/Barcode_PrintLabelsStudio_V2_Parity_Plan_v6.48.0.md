<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.48.0
  Created      : 2026-10-08
  Modified     : 2026-10-08
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan — SMRITI Print Labels Studio V2 Feature Parity & Operational Modernization

## 1. Objective
Achieve 100% operational and ergonomic feature parity between SMRITI Print Labels Studio and the legacy standalone "Label Studio V2" (identified from client operational audits). Deliver high-productivity tools directly into `src/components/barcode/PrintLabelsStudio.tsx`: 1-Click Variant Matrix Loader (`[Load Variants]`), Pre-Print Data Sanitizer, Recent Print Jobs & 1-Click Reprint drawer, Direct Raw PRN code editor modal, Instant PRN file download, Dynamic Token Mapping Reference, and an Image-to-Hex monochrome ZPL graphic converter.

## 2. Business Motivation
In high-volume footwear and apparel distribution centers, warehouse operators routinely receive stock by style/article number (e.g. `CH-30-K`) and need to instantly generate labels across all sizes (37 through 42) and colorways without manual row-by-row selection. Furthermore, printing errors resulting from duplicate barcodes or missing sizes lead to costly returns and billing rejections. Adding live pre-flight sanitization, raw PRN scripting capabilities, and instant reprinting guarantees operational speed, zero label re-entry, and error-free barcode labeling.

## 3. Scope
- **In Scope:**
  - **1-Click `[Load Variants]` Action:** Expands any searched article / style code (e.g. `CH-30-K`) into all variant sizes (37, 38, 39, 40, 41, 42) and shades with canonical EAN-13 barcodes, stocking levels, and default print quantities directly in the worksheet.
  - **Pre-Print Sanitizer Card:** Live pre-flight inspection engine validating selected rows for duplicate barcodes, missing sizes, missing colors, and zero/negative pricing.
  - **Recent Jobs & 1-Click Reprint Card:** Asynchronous history loader connecting to `/api/v1/barcode/print-history` with instant one-click reprint triggers.
  - **Direct Raw PRN Modal & Download PRN Action:** Monospace raw ZPL/PRN script editor with syntax hints, line counting, token interpolation, direct printer dispatch, and instant `.prn` text download.
  - **Mapping Reference Modal:** Interactive modal detailing all dynamic label replacement tokens (`{barcode}`, `{art_no}`, `{mrp}`, `{size}`, `{color}`, etc.).
  - **Image to Hex (PRN) Utility Modal:** Client-side 1-bit monochrome image thresholding canvas generating Zebra ZPL `^GFA` graphic hex payloads for logos and icons.
  - **Hardware Diagnostics & QZ Status:** Persistent connection status (`● QZ Connected`, `● TCP Spooler`), Ping IP test, and test label trigger.
  - **Comprehensive Vitest Suite:** New tests in `src/tests/printLabelsStudio.test.ts` certifying sanitizer validation logic, variant loading, and PRN generation.
- **Out of Scope:**
  - Modifying underlying PostgreSQL schemas or altering existing database tables.
  - Deprecating existing layout templates (`lay-footwear-100x50-3stub` or standard presets).

## 4. Current State
- `PrintLabelsStudio.tsx` allows manual search and selection from inward documents and product catalog, but requires operators to check each variant individually.
- No pre-print validation exists; operators only discover duplicate barcodes or missing prices after labels are already printed.
- Reprints require searching and reconstructing past batches manually.
- Direct raw PRN customization requires external terminal tools.

## 5. Gap Analysis
1. **Variant Expansion Gap:** Legacy Label Studio V2 had a dedicated `[Load Variants]` button that populated the full size curve (37–42) in a single click; current studio required individual checkmarking.
2. **Data Sanitization Gap:** Legacy system featured a "Pre-Print Sanitizer" alerting operators to duplicate barcodes and missing attributes; current studio had no pre-flight inspection.
3. **Reprint Gap:** Backend `/api/v1/barcode/print-history` recorded jobs, but the frontend lacked a visible recent jobs list with 1-click reprint buttons.
4. **Raw PRN Interactivity Gap:** Operators could not download the raw `.prn` file directly from the table or paste raw ZPL code for ad-hoc label testing.
5. **Auxiliary Utilities Gap:** Operators lacked an in-app reference for template token placeholders and an image-to-ZPL hex conversion tool for custom logos.

## 6. Architecture Impact
- **Frontend Architecture:** Modernizes `PrintLabelsStudio.tsx` by modularizing pre-print sanitizer logic, modal utilities, and variant expansion algorithms while maintaining clean state separation and zero performance regressions.
- **Backend Architecture:** Fully leverages existing `/api/v1/barcode/print-history`, `/api/v1/barcode/print`, and `/api/v1/products` endpoints with zero breaking API contract modifications.
- **Zero Database Migration:** No schema alterations required.

## 7. Proposed Design
1. **Pre-Print Sanitizer Engine (`runPrePrintSanitizer`):**
   - Scans active/selected rows for:
     - `duplicateBarcodes`: Set-based collision check across non-empty barcodes.
     - `missingSizes`: Rows with empty or whitespace `size`.
     - `missingColors`: Rows with empty `shade` / `color`.
     - `invalidMrp`: Rows with `mrp <= 0` or NaN.
     - `missingBarcodes`: Rows with empty or length < 5 barcode string.
   - Outputs structured health report with status badge (`All Clean` vs `Warnings Found`) and click-to-filter capability.
2. **Variant Matrix Expansion (`handleLoadVariants`):**
   - Resolves style query from search input or selected row.
   - Queries `/api/v1/products?style=...` or `/api/v1/universal/items/resolve`.
   - Populates rows with size curve (37–42), proper EAN-13 barcodes, and default label count.
3. **Recent Jobs Drawer & 1-Click Reprint (`fetchRecentJobs`, `handleReprintJob`):**
   - Queries `GET /api/v1/barcode/print-history` and displays top 6 recent jobs.
   - Clicking `[Reprint]` automatically loads row items or sends print request to target printer.
4. **Direct Raw PRN Editor & Download:**
   - Compiles selected rows into raw ZPL string using selected template.
   - Downloads as `.prn` text file with MIME type `text/plain`.
   - Direct Raw PRN modal allows custom editing, variable preview, and socket dispatch.
5. **Image to Hex (PRN) Utility:**
   - HTML5 `<canvas>` grayscale + threshold (luminance < 128 = 1, else 0).
   - Generates `^GFA,bytes,total,width,HEX_DATA^FS` block for Zebra printers.

## 8. Files Created
- `docs/implementation/inventory/Barcode_PrintLabelsStudio_V2_Parity_Plan_v6.48.0.md` (This document)
- `docs/walkthrough/barcode/Barcode_PrintLabelsStudio_V2_Parity_v6.48.0.md` (Walkthrough)

## 9. Files Modified
- `src/components/barcode/PrintLabelsStudio.tsx`: Component enhancements for all 6 features.
- `src/tests/printLabelsStudio.test.ts`: Expanded Vitest test suite for sanitizer, variants, and PRN download.
- `docs/implementation/README.md`: Master index update.
- `docs/walkthrough/README.md`: Master index update.
- `CHANGELOG.md`: Version 6.48.0 release notes.

## 10. Dependencies
- React 18
- Lucide React icons
- Vitest 4.x
- FastAPI backend on port 8000

## 11. Risks
- *Risk:* Loading variants for very generic searches could return too many rows.
  *Mitigation:* Limit search to current article/style code with fallback curve generator up to 12 sizes.
- *Risk:* Raw PRN downloads might fail in browsers with strict blob policies.
  *Mitigation:* Use standard HTML5 `Blob` with `URL.createObjectURL` and explicit cleanup.

## 12. Rollback Strategy
All changes reside in client-side component code and non-breaking test suites. If regressions occur, revert `PrintLabelsStudio.tsx` to commit `v6.47.0`.

## 13. Verification Plan
1. Run `npx vitest run src/tests/printLabelsStudio.test.ts` to verify all domain logic and sanitizer rules pass.
2. Run `npx tsc --noEmit` to verify complete TypeScript type safety and zero compiler errors.
3. Run backend pytest suites to ensure barcode API stability.

## 14. Test Plan
- Unit test for pre-print sanitizer duplicate barcode detection.
- Unit test for pre-print sanitizer missing size/mrp detection.
- Unit test for raw PRN generator text download string formatting.
- Unit test for variant curve generation and quantity aggregation.

## 15. Documentation Impact
- Update `docs/implementation/README.md`.
- Update `docs/walkthrough/README.md`.
- Update `CHANGELOG.md`.

## 16. Deployment Plan
- Merge frontend changes into `smritiNX` branch.
- Sync development code to test environment.

## 17. Status
Approved — In Progress.

## 18. Related ADRs
- `ADR-0042`: Barcode Architecture and Thermal Hardware Spooling Standards.

## 19. Related Walkthroughs
- `docs/walkthrough/barcode/Barcode_ClientPRN_DynamicMapping_And_Template_v6.47.0.md`
- `docs/walkthrough/barcode/Barcode_PrintLabelsStudio_RemoteIntake_And_LegacyRetirement_v6.46.2.md`
