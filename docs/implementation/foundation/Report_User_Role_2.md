<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.16.0
  Created      : 2026-07-13
  Modified     : 2026-07-13
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: Report User Role & Auditing Expansion (v3.16.0)

## 1. Objective
Extend the read-only visual restrictions, input blocking, and deep action audit logging for the **Report User** role across all remaining master and transaction components of SMRITI Retail OS.

## 2. Business Motivation
Guarantees complete business auditing and data protection, satisfying governance constraints where non-writing operators (e.g. auditors, external accountants) are fully restricted from modifying transaction states or settings.

## 3. Scope
- Add `isReadOnly` state flags in target tab components.
- Render warning banners and disable input fields/save buttons.
- Record view, search, export, and print events to `/api/system/audit-logs`.

## 4. Current State
Only `ItemMasterTab.tsx` and `SalesStudioTab.tsx` have partial or complete `isReadOnly` support. Remaining transaction and master tabs permit modifications or lack read-only banners and deep search/view audit logging.

## 5. Gap Analysis
- Missing write-blocking UI banners in CRM, Purchase, Barcode print, and Ledger tabs.
- Missing input disabled states in CRM, Purchase, Barcode print, and Ledger tabs.
- Lacking telemetry audit event logging for search inputs and row selection detailed views.

## 6. Architecture Impact
Uses the Platform Abstraction Layer (PAL) and the unified Express logger. Frontend actions map directly to the system audit trails without bypasses.

## 7. Proposed Design
For each target tab:
- Determine if `currentUser.role === 'Report User'`.
- Render a standard alert banner: `Operating under a Read-Only Report User role. Write operations are prohibited.`
- Add `disabled={isReadOnly}` and disable click action triggers.
- Trigger `recordAuditAction` upon item detail view or debounced searches.

## 8. Files Created
None.

## 9. Files Modified
- `src/components/CrmLoyaltyTab.tsx`
- `src/components/LabelPrintingSection.tsx`
- `src/components/PurchaseStudioTab.tsx`
- `src/components/BusinessLedgerTab.tsx`
- `src/components/StockLedgerTab.tsx`
- `src/components/SupplierDashboardTab.tsx`
- `src/components/StaffManagementTab.tsx`

## 10. Dependencies
React, Express, PostgreSQL, TSX.

## 11. Risks
None. Exclusions are explicitly managed.

## 12. Rollback Strategy
Revert frontend component files via Git.

## 13. Verification Plan
- Build check using `npm run lint`.
- Test verification using `npm run test`.

## 14. Test Plan
Run Vitest and pytest test suites.

## 15. Documentation Impact
Update Developer Guide, Wiki, and Walkthroughs.

## 16. Deployment Plan
Commit and pull changes to testing environment.

## 17. Status
Completed

## 18. Related ADRs
None.

## 19. Related Walkthroughs
- [Foundation_Report_User_Role_Expansion_v3.16.0.md](../../walkthrough/foundation/Foundation_Report_User_Role_Expansion_v3.16.0.md)
