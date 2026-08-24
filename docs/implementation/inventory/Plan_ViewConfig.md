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

# Implementation Plan — View Configuration & Excel Mapping Engine Stabilization (v5.6.0)

## 1. Objective
Document and stabilize all operational updates resolved across the SMRITI Retail OS Item Master, Bulk Excel Paste & Mapping Engine, Attribute Management Studio, and View Configuration subsystems.

## 2. Business Motivation
Ensure high-throughput inventory ingestion, zero-error spreadsheet mapping, predictable field alias management, and global schema visibility control across all operational grids and reports.

## 3. Scope
* **Attribute Alias Suppression & Reset**: Persistent suppression blacklist for deleted default/custom aliases with un-blacklisting on re-add and per-attribute reset controls.
* **Spreadsheet Header Row Detection & Delimiters**: Intelligent delimiter parser (tabs, commas, semicolons, multiple spaces) and normalized header matching.
* **Auto-Mapper Field Visibility Alignment**: Fixed undefined property lookup in `HeaderMappingEngine` field filtering to eliminate `(Skip Column)` defaults.
* **Fields to Display & Column Order (View Configuration)**: Dynamic attribute resolution, double-click transfers, 4-way ordering controls, presets, and universal event broadcasting.

## 4. Current State
* Previously, deleted default aliases reappeared due to lack of a persistent blacklist.
* The Excel mapper defaulted to `(Skip Column)` because `f.canonicalKey` was undefined in the visibility filter.
* The View Configuration screen was passed a static prop list, omitting dynamic attributes and custom labels.

## 5. Gap Analysis
* Missing blacklist store for alias deletions in `HeaderAliasRegistry.ts`.
* Normalization omission in `isKnownHeader` check during header row extraction.
* Property name mismatch (`f.canonicalKey` vs `f.key`) causing empty mapper candidate arrays.
* Lack of double-click and Move-to-Top/Bottom controls in View Configuration.

## 6. Architecture Impact
* Updated `HeaderAliasRegistry.ts` with `REMOVED_ALIASES_STORAGE_KEY` and suppression logic.
* Updated `unifiedFieldCatalog.ts` with custom alias synchronization.
* Refactored `SmritiViewConfiguration.tsx` with dynamic attribute resolution and 4-way ordering.
* Fixed mapper filter in `SmritiItemMasterStudio.tsx`.

## 7. Proposed Design
* Single unified source of truth for all field definitions, aliases, and custom business labels.
* Reactive `smriti_field_visibility_updated` CustomEvent to synchronize all client components instantly.

## 8. Files Created
* `docs/implementation/inventory/Implementation_Plan_ViewConfiguration_And_ExcelMapper_Stabilization_v5.6.0.md`
* `docs/walkthrough/inventory/ViewConfiguration_And_ExcelMapper_Stabilization_v5.6.0.md`

## 9. Files Modified
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

## 10. Dependencies
* `localStorage` client persistence.
* `CustomEvent` API for reactive cross-component broadcast.
* `lucide-react` icons.

## 11. Risks
* Low risk — All changes are backward-compatible with graceful fallbacks.

## 12. Rollback Strategy
* Revert modified component files to previous commit revisions.

## 13. Verification Plan
* `npm run build` validation.
* Docker Compose full stack build and container health inspection.
* Live testing on `http://localhost:3000`.

## 14. Test Plan
* Test alias deletion and "Reset Defaults" in Attribute Management Studio.
* Paste sample tabular text in Bulk Excel Paste and verify automatic header matching.
* Move columns in View Configuration using double-click and Move-to-Top buttons, save, and verify sequence in Item Details Grid.

## 15. Documentation Impact
* Walkthrough document created.
* Master indexes and CHANGELOG updated.

## 16. Deployment Plan
Containerized Docker deployment on port 3000.

## 17. Status
Completed

## 18. Related ADRs
* `ADR-0014`: Platform Abstraction Layer UI Standard.

## 19. Related Walkthroughs
* `docs/walkthrough/inventory/ViewConfiguration_And_ExcelMapper_Stabilization_v5.6.0.md`
