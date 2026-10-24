<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.70.1
  Created      : 2026-10-08
  Modified     : 2026-10-08
  Copyright    : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: SMRITI Walkthrough Governance Policy (WGP)
-->

# Walkthrough: Global Grid Import Blank Sample CSV Template Generator (v6.70.1)

## 1. Purpose
Empower enterprise store operators and system administrators to immediately download pre-configured, profile-compliant blank sample CSV templates directly from `GlobalGridImportModal.tsx`, preventing column misalignment and spelling mistakes during bulk master lookup and transaction intakes.

## 2. Scope
- Developed `src/services/gridInput/templateGenerator.ts` providing deterministic CSV generation and browser download helpers.
- Enhanced `GlobalGridImportModal.tsx` toolbar with `[Sample Template]` button.
- Added reference format banner in `GlobalGridImportModal.tsx` File Upload tab.
- Integrated unit test coverage in `src/tests/lookupImportRecommend.test.ts`.

## 3. Files Created
- `src/services/gridInput/templateGenerator.ts`
- `docs/implementation/foundation/GlobalGridImport_Sample_CSV_Template_Generator_Plan_v6.70.1.md`
- `docs/walkthrough/foundation/GlobalGridImport_Sample_CSV_Template_Generator_v6.70.1.md`

## 4. Files Modified
- `src/components/gridInput/GlobalGridImportModal.tsx`
- `src/tests/lookupImportRecommend.test.ts`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 5. Architecture Decisions
- **Zero-Latency In-Memory Generation**: CSV templates are generated client-side from `profile.allowedFields` definitions without round-trips to the server.
- **Record-Based Field Mapping**: Utilized keyed dictionaries instead of array index offsets to ensure sample cell values align precisely with profile header keys regardless of internal field ordering.

## 6. Design Rationale
Operators frequently struggle with determining the required CSV column headers when uploading reference data. Providing a 1-click template download button pre-populated with active profile headers ensures seamless ingestion and zero mapping friction.

## 7. Implementation Summary
- `generateSampleCsvContent(profile, options)`: Inspects `profile.allowedFields` and formats header line and aligned sample records. Escapes fields containing commas or quotes.
- `triggerCsvDownload(filename, content)`: Creates a Blob object with MIME type `text/csv;charset=utf-8;`, instantiates a temporary anchor element, triggers click, and revokes object URL.
- Added visual elements to `GlobalGridImportModal.tsx`:
  - Step 1 top toolbar: `[Sample Template]` button with `Download` icon.
  - File upload tab: Informative card with `[Download Sample CSV]` button.

## 8. Tests Executed
- `lookupImportRecommend.test.ts`:
  - `generateSampleCsvContent produces valid CSV headers and data rows for LOOKUP_VALUE`
  - `generateSampleCsvContent handles other grid profiles like PURCHASE and ITEM_MASTER`
- Vitest test runner across master data suites.
- Launchpad registry validation.

## 9. Verification Results
- 13/13 Vitest tests passed green in 30ms.
- 51/51 Launchpad tiles verified.
- 0 TypeScript compiler errors.

## 10. Known Limitations
Templates currently output standard comma-separated values (CSV). For tab-delimited (TSV) requirements, users can copy directly from the clipboard paste tab.

## 11. Future Work
Add option in the download dialog to choose between CSV, TSV, and XLSX template formats.

## 12. Related ADRs
- `AD-GRID-01`: SMRITI Global Grid Input & Import Standard
- `AD-LOOKUP-01`: SMRITI Core System Lookups & Master Directory Governance

## 13. Related RFCs
- `RFC-GRID-IMPORT-V2`: Universal Delimited Data Intake and Clipboard Streaming
