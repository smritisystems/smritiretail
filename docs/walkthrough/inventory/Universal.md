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

# Walkthrough: Universal View Configuration as Global Schema & Visibility Control

**Version:** 5.4.0  
**Area:** Inventory & UI Platform Engine  
**Author:** Jawahar Ramkripal Mallah  

---

## 1. Purpose
Establish the **View Configuration** studio as the central control panel for both field visibility and sequence ordering across all application screens, modules, tables, and reports.

## 2. Scope
* Centralized field catalog registry (`unifiedFieldCatalog.ts`).
* Real-time reactive broadcast engine (`smriti_field_visibility_updated`).
* Integration across Item Details Grid, Item Catalog Search, and Report Designer tables.

## 3. Files Created
* `docs/implementation/inventory/Plan_Universal.md`
* `docs/walkthrough/inventory/Universal.md`

## 4. Files Modified
* `src/services/unifiedFieldCatalog.ts`
* `src/components/itemMaster/ItemDetGrid.tsx`
* `src/components/itemMaster/ItemCatGrid.tsx`
* `src/components/itemMaster/ViewConfig.tsx`
* `src/components/ReportDesignerTab.tsx`
* `docs/implementation/README.md`
* `docs/walkthrough/README.md`
* `CHANGELOG.md`

## 5. Architecture Decisions
* Dynamic attribute resolution utilizes $O(1)$ key lookup maps in local state.
* Reactive `window.dispatchEvent` eliminates the need for full page refreshes when changing view configurations.

## 6. Design Rationale
Retailers must have full autonomy to hide irrelevant attributes (e.g., hiding Heel Type in an electronics store or Weight in a clothing boutique) with zero code modifications.

## 7. Implementation Summary
* Added `saveGlobalFieldVisibility`, `getGlobalFieldVisibility`, and `isFieldGloballyVisible` to `unifiedFieldCatalog.ts`.
* Updated `ViewConfig.tsx` to persist global visibility state.
* Subscribed `ItemDetGrid.tsx`, `ItemCatGrid.tsx`, and `ReportDesignerTab.tsx` to reactive updates.

## 8. Tests Executed
* Toggled column visibility in View Configuration and confirmed instant removal from Item Details Grid, Catalog Browser, and Report Viewer tables.
* Reordered columns (moving Barcode next to Stock No) and verified identical sequence order across all matrices.

## 9. Verification Results
* Clean compilation (`✓ built in 17.52s`).
* Zero console errors.
* Dynamic broadcast events update all tabs seamlessly.

## 10. Known Limitations
* Primary ID columns retain fallback safety guards to ensure basic row navigation remains stable.

## 11. Future Work
* Persist user-specific view configurations to backend PostgreSQL user profile preferences.

## 12. Related ADRs
* `ADR-0045-Global-Column-Ordering-Engine`

## 13. Related RFCs
* `RFC-0089-Dynamic-Retail-Attributes`
