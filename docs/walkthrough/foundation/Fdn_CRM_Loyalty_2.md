<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.16.1
  Created      : 2026-07-14
  Modified     : 2026-07-14
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Deprecated Legacy CRM & Loyalty Console Removal

## 1. Purpose
This walkthrough documents the clean removal of the deprecated monolith `CrmLoyaltyTab` view from the application. This completes the CRM & Loyalty migration phase, ensuring that users utilize the split and modern `Customer Master`, `CRM Studio`, and `Loyalty Studio` modules.

## 2. Scope
- Removal of the deprecated `src/components/CrmLoyaltyTab.tsx` file.
- Removal of the `crm-legacy` workspace definition and route case from `src/layout_engine/layout_store.tsx` and `src/App.tsx`.
- Update of the dynamic scanner metrics inside `src/modules/dev_tracker/scanner/metrics.ts` to map to the new split tabs.

## 3. Files Created
None.

## 4. Files Modified
- [App.tsx](file:///d:/IMP/GitHub/SMRITRretailNX/src/App.tsx)
- [layout_store.tsx](file:///d:/IMP/GitHub/SMRITRretailNX/src/layout_engine/layout_store.tsx)
- [metrics.ts](file:///d:/IMP/GitHub/SMRITRretailNX/src/modules/dev_tracker/scanner/metrics.ts)

## 5. Architecture Decisions
Deprecated code was completely removed to prevent maintenance overhead, minimize bundle sizes, and avoid confusing end users with legacy navigation pathways.

## 6. Design Rationale
Since the Customer Master, CRM Studio, and Loyalty Studio tabs are fully populated and integrated into the Postgres backend, the monolithic legacy component is obsolete.

## 7. Implementation Summary
- Removed `CrmLoyaltyTab` imports and matching router path switch (`crm-legacy`).
- Cleaned up the `crm-legacy` object from `LayoutEngineProvider` default workspaces.
- Refactored `metrics.ts` mappings, replacing the dynamic heuristic scan criteria of `"crm"` to use the newer `CrmStudioTab.tsx` and added distinct scans for `customer-master` and `loyalty`.

## 8. Tests Executed
Unit tests were run locally to ensure no compilation issues or navigation regression occurred.

## 9. Verification Results
All 64 test cases in `vitest` pass cleanly. Build outputs are free of any warnings or errors regarding missing imports.

## 10. Known Limitations
None.

## 11. Future Work
Deprecate Express-level legacy CRM endpoints once FastAPI Strangler-fig migrations cover CRM/loyalty actions.

## 12. Related ADRs
None.

## 13. Related RFCs
None.
