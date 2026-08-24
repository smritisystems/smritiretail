<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 5.6.0
  Created      : 2026-08-21
  Modified     : 2026-08-21
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough — View Configuration, Excel Mapping & Alias Stabilization (v5.6.0)

## 1. Purpose
This walkthrough documents the full suite of operational fixes and enhancements applied to the SMRITI Retail OS Item Master, Attribute Management Studio, Bulk Excel Paste & Mapping Engine, and View Configuration subsystems.

## 2. Scope
* `src/lib/headerMapping/HeaderAliasRegistry.ts`
* `src/lib/headerMapping/HeaderMappingEngine.ts`
* `src/services/unifiedFieldCatalog.ts`
* `src/components/itemMaster/SmritiItemMasterStudio.tsx`
* `src/components/itemMaster/SmritiAttributeManagementStudio.tsx`
* `src/components/itemMaster/SmritiViewConfiguration.tsx`
* `src/components/itemMaster/SmritiItemMasterWorkspace.tsx`

## 3. Files Created
* `docs/implementation/inventory/Implementation_Plan_ViewConfiguration_And_ExcelMapper_Stabilization_v5.6.0.md`
* `docs/walkthrough/inventory/ViewConfiguration_And_ExcelMapper_Stabilization_v5.6.0.md`

## 4. Files Modified
* `src/lib/headerMapping/HeaderAliasRegistry.ts`
* `src/lib/headerMapping/HeaderMappingEngine.ts`
* `src/services/unifiedFieldCatalog.ts`
* `src/components/itemMaster/SmritiItemMasterStudio.tsx`
* `src/components/itemMaster/SmritiAttributeManagementStudio.tsx`
* `src/components/itemMaster/SmritiViewConfiguration.tsx`
* `src/components/itemMaster/SmritiItemMasterWorkspace.tsx`
* `CHANGELOG.md`
* `docs/implementation/README.md`
* `docs/walkthrough/README.md`

## 5. Architecture Decisions

### 1. Persistent Alias Suppression Engine
* Hardcoded default aliases in standard item definitions could not previously be removed because deleting them only cleared custom aliases from `localStorage`.
* **Solution**: Introduced `REMOVED_ALIASES_STORAGE_KEY` (`smriti_header_removed_aliases`) to persist suppressed aliases. When clicking `×` on any alias chip, the alias is blacklisted and suppressed from all catalog resolvers (`getSmritiItemMasterFields`, `getUnifiedItemMasterFields`). Added a **Reset Defaults** action per attribute.

### 2. Multi-Delimiter Parser & Normalized Header Row Detection
* When pasting tabular data copied from non-Excel documents or space-separated files, rows were not split correctly and `isKnownHeader` failed due to unnormalized strings.
* **Solution**: Enhanced `matrix` parsing in `SmritiItemMasterStudio.tsx` to detect tabs (`\t`), commas (CSV), semicolons, and multiple spaces (`\s{2,}`). Normalized strings inside `isKnownHeader` and `detectHeaderRow` so `Article CODE` correctly matches `article code`.

### 3. Auto-Mapper Field Candidate Registry Fix
* The auto-mapper candidate list was filtered with `f.canonicalKey`, which evaluated to `undefined` (the property name is `f.key`), leaving `mappingEngine.fields` empty (`[]`) and defaulting all column dropdowns to `(Skip Column)` in red.
* **Solution**: Fixed filter in `SmritiItemMasterStudio.tsx` to check `isFieldGloballyVisible(cleanKey) || isFieldGloballyVisible(f.key)`, and synchronized custom/removed aliases in `getUnifiedHeaderMappingFields`.

### 4. High-Density View Configuration & Global Arrangement Upgrade
* Refactored `SmritiViewConfiguration.tsx` to dynamically load all system fields and dynamic attributes from `/attributes/definitions`.
* Added **Double-Click** transfers between Available (Hidden) and Selected (Visible) column lists.
* Added **4-Way Reordering Controls**: Move to Top, Move Up, Move Down, Move to Bottom.
* Added **Quick Presets**: Essential (8 Columns), Standard (14 Columns), and All Fields.
* Configured `saveGlobalColumnOrder` to persist visible keys and broadcast `smriti_field_visibility_updated` across all client grids and reports.

## 6. Design Rationale
Provides intuitive, frictionless controls where spreadsheet data auto-maps instantly on paste and column layouts reconfigure globally with zero page reload.

## 7. Implementation Summary
* Updated header registry and alias suppression blacklist in `HeaderAliasRegistry.ts`.
* Fixed normalization and delimiter detection in `HeaderMappingEngine.ts` and `SmritiItemMasterStudio.tsx`.
* Synchronized alias mapping in `unifiedFieldCatalog.ts`.
* Overhauled `SmritiViewConfiguration.tsx` with presets and 4-way reordering.
* Rebuilt and deployed via Vite and Docker Compose.

## 8. Tests Executed
* `npm run build` — Passed (0 errors, 18.06s build time).
* `docker compose up -d --build` — All containers healthy.

## 9. Verification Results
```
dist/assets/index-CiYJfgIv.js  952.56 kB │ gzip: 213.90 kB
✓ built in 18.06s
Container smriti-db   Healthy
Container smriti-api  Healthy
Container smriti-web  Started
```

## 10. Known Limitations
None.

## 11. Future Work
* Drag-and-drop reordering using HTML5 drag API.

## 12. Related ADRs
* `ADR-0014`: Platform Abstraction Layer UI Standard.

## 13. Related RFCs
* `RFC-0091`: Universal View Configuration & Field Visibility Control.
