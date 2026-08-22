<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.12.0
  Created      : 2026-08-22
  Modified     : 2026-08-22
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: Decommissioning & Removal of "Common Fields Setup" Module

## 1. Objective
Permanently decommission and purge the redundant **Common Fields Setup** module (`SmritiCommonFieldsSetup.tsx` and `tabs/CommonFieldsTab.tsx`), streamlining the **Item Master Management System** into a direct, high-performance tactical grid and view configuration workspace.

## 2. Business Motivation
The "Common Fields Setup" tab introduced unnecessary navigation friction by attempting to maintain an ephemeral session-level overlay of shared attributes across item entry lines. Real-world retail operators and catalog administrators configure global attribute defaults and column visibility via **View Configuration** and bulk imports, rendering the dedicated Common Fields setup tab redundant.

## 3. Scope
- **Component Deletion**: Removed `src/components/itemMaster/SmritiCommonFieldsSetup.tsx` and `src/components/itemMaster/tabs/CommonFieldsTab.tsx`.
- **Item Master Workspace Cleanup**: Cleaned up `SmritiItemMasterWorkspace.tsx`, removing the navigation tab, state, and shortcuts.
- **Item Details Grid Decoupling**: Decoupled `SmritiItemDetailsGrid.tsx` and `ItemMasterEntryView.tsx` from `CommonFieldsData` interfaces.
- **Keyboard Shortcuts Alignment**: Updated `SmritiKeyboardShortcutsModal.tsx` and global shortcut listeners to re-index Alt+1..6 directly.
- **Test Suite & Build Verification**: Verified that all 37 Vitest test suites (277 tests) and Docker frontend container build pass with zero errors.

## 4. Current State
Previously, the Item Master sidebar displayed "Common Fields" with an `<Settings />` icon and Alt+2 shortcut, rendering a dedicated form with checkboxes.

## 5. Gap Analysis
- Common fields duplicated functionality already handled by View Configuration defaults and direct batch editing.
- Operators were required to navigate between multiple tabs rather than editing directly in the grid.

## 6. Architecture Impact
- **Streamlined Component Hierarchy**: Reduces bundle size and removes unnecessary `localStorage` key operations (`smriti_item_master_common_fields_v1`).
- **Zero Database Changes**: PostgreSQL schema and product catalog endpoints remain unaffected.

## 7. Proposed Design
- Direct Item Master workflow: `Item Details` -> `View Configuration` -> `Imports & Bulk Paste` -> `Attributes Catalog` -> `Image Path Config` -> `Variant Templates`.

## 8. Files Created
None.

## 9. Files Modified
- `src/components/itemMaster/SmritiItemMasterWorkspace.tsx`
- `src/components/itemMaster/SmritiItemDetailsGrid.tsx`
- `src/components/itemMaster/ItemMasterEntryView.tsx`
- `src/components/itemMaster/SmritiKeyboardShortcutsModal.tsx`
- `src/components/itemMaster/types.ts`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 10. Files Deleted
- `src/components/itemMaster/SmritiCommonFieldsSetup.tsx`
- `src/components/itemMaster/tabs/CommonFieldsTab.tsx`

## 11. Dependencies
- React 18, Vite, Vitest, Lucide React icons.

## 12. Risks
- None. All imports and props decoupled and verified via automated test suite.

## 13. Rollback Strategy
Git revert commits if necessary.

## 14. Verification Plan
- Run `npx vitest run` across all test files.
- Run `npm run build` to verify clean bundle generation.
- Rebuild Docker container `smriti-web` and verify health check.

## 15. Test Plan
- Run `npx vitest run src/tests/itemMasterTacticalGrid.test.ts`.

## 16. Deployment Plan
Sync to development workspace and pull into test environment.

## 17. Status
Completed

## 18. Related ADRs
- ADR-0015: Item Master Workspace Modernization & Redundant Module Decommissioning.

## 19. Related Walkthroughs
- `docs/walkthrough/inventory/Inventory_Remove_Common_Fields_Setup_Module_v6.12.0.md`.
