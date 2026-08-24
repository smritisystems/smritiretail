<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 5.4.0
  Created      : 2026-08-21
  Modified     : 2026-08-21
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: Universal View Configuration as Global Schema & Visibility Control

**Document ID:** IP-INV-5.4.0  
**Status:** Completed  
**Author:** Jawahar Ramkripal Mallah  
**Target:** SMRITI Retail OS — Global UI Schema & Column Ordering Governance  

---

## 1. Objective
Establish "View Configuration" as the universal, application-wide Single Source of Truth (SSOT) for field visibility, sequence ordering, and attribute display across all modules, grids, forms, and reporting engines.

## 2. Business Motivation
In modern retail operations, different industry verticals (Footwear, Apparel, Electronics, Supermarkets) track different product dimensions. Providing a centralized control panel where configuring visibility once applies everywhere eliminates redundant screen-by-screen setup, prevents cognitive overload, and guarantees uniform reporting and muscle memory.

## 3. Scope
* Centralized field catalog registry (`unifiedFieldCatalog.ts`).
* Real-time reactive event dispatching (`smriti_field_visibility_updated`).
* Matrix spreadsheet grid, catalog search browser, and report designer integration.

## 4. Current State
Previously, View Configuration saved the custom column arrangement locally for the main spreadsheet grid only. Other grids and report viewer tables rendered hardcoded column sets.

## 5. Gap Analysis
* Deselecting an attribute in View Configuration did not hide it from catalog browsers or report tables.
* Changes in field sequence were not broadcasted in real time across simultaneously open components.

## 6. Architecture Impact
* Zero database schema changes required.
* Utilizes reactive DOM custom event listeners with instant in-memory $O(1)$ lookup maps.

## 7. Proposed Design
* `saveGlobalFieldVisibility(visibleKeys: string[])` persists both visibility and sequence ordering into local storage and dispatches `smriti_field_visibility_updated`.
* All catalog, matrix, and report viewer tables consume `isFieldGloballyVisible(key)` and `getGloballyVisibleFields()`.

## 8. Files Created
* `docs/implementation/inventory/Implementation_Plan_Universal_ViewConfiguration_GlobalSchemaControl_v5.4.0.md`
* `docs/walkthrough/inventory/Universal_ViewConfiguration_GlobalSchemaControl_v5.4.0.md`

## 9. Files Modified
* `src/services/unifiedFieldCatalog.ts`
* `src/components/itemMaster/SmritiItemDetailsGrid.tsx`
* `src/components/itemMaster/SmritiItemCatalogGrid.tsx`
* `src/components/itemMaster/SmritiViewConfiguration.tsx`
* `src/components/ReportDesignerTab.tsx`
* `docs/implementation/README.md`
* `docs/walkthrough/README.md`
* `CHANGELOG.md`

## 10. Dependencies
* `localStorage` API
* CustomEvent Web API
* SMRITI Header Alias Registry

## 11. Risks
* Accidental hiding of primary identifier columns (mitigated by retaining mandatory fallback keys).

## 12. Rollback Strategy
* Calling `localStorage.removeItem("smriti_global_field_visibility")` restores standard defaults.

## 13. Verification Plan
* Toggle field visibility in View Configuration and verify instant reflection in both Item Details Matrix and Report Designer tables.

## 14. Test Plan
* Validate that deselecting `A1`, `A2`, `mrp`, or `price` hides the corresponding columns across all grids and reports.

## 15. Documentation Impact
* Walkthrough, Implementation Plan, Master Indexes, and CHANGELOG updated.

## 16. Deployment Plan
* Standard Vite production build and Docker container restart.

## 17. Status
Completed.

## 18. Related ADRs
* `ADR-0045-Global-Column-Ordering-Engine`

## 19. Related Walkthroughs
* `docs/walkthrough/inventory/Universal_ViewConfiguration_GlobalSchemaControl_v5.4.0.md`
