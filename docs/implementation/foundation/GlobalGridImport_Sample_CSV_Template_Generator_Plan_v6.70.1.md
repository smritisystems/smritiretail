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
  Classification: SMRITI Implementation Plan Governance Policy (IPGP)
-->

# Implementation Plan: Global Grid Import Blank Sample CSV Template Generator (v6.70.1)

## 1. Objective
Enable instant 1-click downloading of blank sample CSV templates across all grid import profiles (`LOOKUP_VALUE`, `PURCHASE`, `STOCK_MOVEMENT`, `BARCODE_PRINTING`, `ITEM_MASTER`) directly inside `GlobalGridImportModal.tsx`, guaranteeing exact header parity and zero column mismatch errors during data onboarding.

## 2. Business Motivation
When operators import or paste bulk reference catalogs into System Lookups, Master Data, or Inward Grids, manual CSV authoring often suffers from misspelled header keys (e.g. `lookup_code` vs `code`) or misplaced columns. Providing an instant, profile-aware sample template eliminates user friction and onboarding errors.

## 3. Scope
- Add `templateGenerator.ts` in `src/services/gridInput/` with record-mapped sample row generation and browser download helpers.
- Embed `[Sample Template]` button in `GlobalGridImportModal.tsx` toolbar.
- Embed reference download card in the `FILE` upload tab of `GlobalGridImportModal.tsx`.
- Automated test coverage in `src/tests/lookupImportRecommend.test.ts`.

## 4. Current State
`GlobalGridImportModal` supports delimiter auto-detection, clipboard parsing, and file upload, but required operators to construct their own CSV files from memory or external documentation.

## 5. Gap Analysis
Absence of a 1-click client-side template generator caused onboarding delays when importing new lookup values and master items.

## 6. Architecture Impact
Zero backend changes or database schema adjustments. Pure client-side Blob generation with zero network overhead.

## 7. Proposed Design
- `generateSampleCsvContent(profile, options)`: Inspects `profile.allowedFields` and matches values from domain-tailored sample records.
- `triggerCsvDownload(filename, content)`: Creates an in-memory `Blob([content], { type: "text/csv;charset=utf-8;" })`, programmatic download anchor, and cleanly revokes object URLs.

## 8. Files Created
- `src/services/gridInput/templateGenerator.ts`
- `docs/implementation/foundation/GlobalGridImport_Sample_CSV_Template_Generator_Plan_v6.70.1.md`
- `docs/walkthrough/foundation/GlobalGridImport_Sample_CSV_Template_Generator_v6.70.1.md`

## 9. Files Modified
- `src/components/gridInput/GlobalGridImportModal.tsx`
- `src/tests/lookupImportRecommend.test.ts`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 10. Dependencies
`lucide-react` (`Download`, `FileText`), `Blob`, `URL.createObjectURL`.

## 11. Risks
Browser clipboard or download popup blockers; mitigated by native standard anchor click trigger.

## 12. Rollback Strategy
Remove `handleDownloadSampleCsv` and template download buttons from `GlobalGridImportModal.tsx`.

## 13. Verification Plan
- Unit tests verifying CSV header generation and sample record alignment across profiles.
- Vitest test suite execution.
- Launchpad registry validation.

## 14. Test Plan
- Run `npx vitest run src/tests/lookupImportRecommend.test.ts src/tests/masterPage.test.ts`.
- Run `npm run validate-launchpad`.

## 15. Documentation Impact
Walkthrough created under `docs/walkthrough/foundation/`, master index tables updated in `docs/walkthrough/README.md` and `docs/implementation/README.md`.

## 16. Deployment Plan
Commit and push to `origin/smritiNX`. Sync downstream test environments via `git pull`.

## 17. Status
Completed

## 18. Related ADRs
- `AD-GRID-01`: SMRITI Global Grid Input & Import Standard
- `AD-LOOKUP-01`: SMRITI Core System Lookups & Master Directory Governance

## 19. Related Walkthroughs
- `docs/walkthrough/foundation/GlobalGridImport_Sample_CSV_Template_Generator_v6.70.1.md`
- `docs/walkthrough/foundation/System_Lookups_Import_Paste_And_Recommendation_Engine_v6.70.0.md`
