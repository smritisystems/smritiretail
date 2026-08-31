<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 5.5.0
  Created      : 2026-08-21
  Modified     : 2026-08-21
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan — Retail Customer Catalogue & Advanced Search Workspace (v5.5.0)

## 1. Objective
Refactor and modernize the Customer Management module into a high-density, 3-tab **Customer Catalogue** and **Advanced Customer Search** suite aligning with SMRITI Retail OS UI/UX standards.

## 2. Business Motivation
Provide cashiers, store managers, and retail administrators with an administrative and operational interface to create, audit, search, and manage retail customer profiles, demographic classifications, loyalty program associations, multi-address profiles, and financial credit limits.

## 3. Scope
* Central Customer Catalogue workspace with 3 core tabs:
  1. **Form Tab**: General details, classification criteria, profile notes, details of shoper.
  2. **Retail Details Tab**: Dependant/sub-ordinate relations, personal demographics, loyalty program tier/points.
  3. **Additional Details Tab**: Payment categories, credit limits & utilization, logistics/transport, price/tax factors, transaction permissions, LST/CST/GSTIN.
* **Mailing Address Sub-Form Dialog**: Comprehensive multi-address manager with lines 1-5, locality, city, state, postal code, multiple phone/fax numbers, and multiple emails.
* **Advanced Customer Search Utility**: Dual-panel search with General and Demographic criteria plus instant live results grid.
* Full keyboard shortcuts (<kbd>Alt+N</kbd>, <kbd>F2</kbd> / <kbd>Alt+S</kbd>, <kbd>Ctrl+S</kbd>, <kbd>Alt+D</kbd>, <kbd>Alt+1..3</kbd>).

## 4. Current State
Previous customer screens were basic CRUD tables lacking retail-specific attributes like dependants, wedding anniversaries, shoper flat file settings, multi-line mailing addresses, and multivariate demographic search filters.

## 5. Gap Analysis
* Missing sub-form dialog for multi-line mailing addresses and multiple contact numbers.
* Missing demographic classification (religion, ethnicity, age groups).
* Missing financial transaction permissions (Cash Bill, DC Gen, Credit Invoice toggles).
* Missing advanced search filter matrix.

## 6. Architecture Impact
* New domain components under `src/components/customer/`.
* Updated `CustomerMasterTab.tsx` to mount `CustMasterWs.tsx`.
* Local storage persistence for zero-latency offline browsing and synchronization.

## 7. Proposed Design
Adopts high-density enterprise layout with primary deep blue (`#00355f`), crisp inputs, clear status badges, and instant keyboard navigation.

## 8. Files Created
* `src/components/customer/types.ts`
* `src/components/customer/CustFormTab.tsx`
* `src/components/customer/CustRetailDetTab.tsx`
* `src/components/customer/CustAddlDetTab.tsx`
* `src/components/customer/CustMailingDlg.tsx`
* `src/components/customer/AdvancedCustSearch.tsx`
* `src/components/customer/CustMasterWs.tsx`

## 9. Files Modified
* `src/components/CustomerMasterTab.tsx`
* `CHANGELOG.md`
* `docs/implementation/README.md`
* `docs/walkthrough/README.md`

## 10. Dependencies
* `lucide-react` for high-density UI icons.
* React hooks (`useMemo`, `useCallback`, `useState`, `useEffect`).

## 11. Risks
* Form complexity — mitigated by clear 3-tab categorization and keyboard shortcuts.

## 12. Rollback Strategy
Revert `CustomerMasterTab.tsx` to previous MasterListScreen reference.

## 13. Verification Plan
* Validate build via `npm run build`.
* Validate container startup via `docker compose up -d --build`.
* Test keyboard shortcuts, tab transitions, address additions, and search filter operations.

## 14. Test Plan
* Test New (<kbd>Alt+N</kbd>), Save (<kbd>Ctrl+S</kbd>), Search (<kbd>F2</kbd>), Delete (<kbd>Alt+D</kbd>).
* Verify Mailing Address Sub-Form saves multiple lines, phones, and emails.
* Verify Advanced Customer Search filters by Religion, Ethnicity, Age Group, and City.

## 15. Documentation Impact
* Walkthrough document created.
* Implementation master index and CHANGELOG updated.

## 16. Deployment Plan
Containerized deployment via Docker Compose.

## 17. Status
Completed

## 18. Related ADRs
* `ADR-0014`: Platform Abstraction Layer & UI Standard.

## 19. Related Walkthroughs
* `docs/walkthrough/crm/Retail_Customer.md`
