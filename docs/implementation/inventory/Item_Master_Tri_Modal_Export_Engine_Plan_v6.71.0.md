<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.71.0
  Created      : 2026-10-12
  Modified     : 2026-10-12
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Implementation Plan — Inventory & Item Master
-->

# Implementation Plan: Item Master Tri-Modal Export Engine (All Fields, Selected Presets & Forensic Audit)

## 1. Objective
Architect and deliver an enterprise-grade Tri-Modal Export Engine for SMRITI Retail OS Item Master, providing seamless dispatch across:
1. **All Fields Export** (complete catalog dump with all core, extended, dynamic, and system metadata fields).
2. **Selected Fields & Role Presets** (one-click operational configurations for POS Price List, Physical Stocktaking, Procurement PO, E-Commerce feeds, and Statutory HSN/GST compliance).
3. **Forensic & Data Quality Audit Export** (in-depth compliance validation, Legal Metrology pricing checks, margin variance calculations, statutory exception flags, and version audit trails).

## 2. Business Motivation
Floor staff, store managers, procurement buyers, and financial auditors have vastly different requirements when exporting catalog items:
- Cashiers and store managers only need retail price lists without sensitive supplier costs.
- Warehouse staff require physical inventory count sheets with barcode, SKU, and bin locations.
- Purchasing agents need buying price, landed cost, vendor code, and HSN codes for purchase orders.
- Auditors and loss prevention managers require a forensic audit of price discrepancies (e.g. Selling Price > MRP), negative margins, missing HSN/GST codes, and modification timestamps.
- System administrators require a full, uncorrupted master catalog dump for backups, DataBridge migrations, and cross-system sync.

Providing a single, un-curated 40-column export causes user friction, spreadsheet bloat, and security risks. The Tri-Modal Export Engine solves this cleanly.

## 3. Scope
- Add `ExportPreset` schema and interface to `src/components/export/types.ts`.
- Upgrade `ExportCenterModal.tsx` with a responsive Presets Control Bar with one-click selection, active state indicators, and preset column mapping.
- Forward presets through `ExportButton.tsx`.
- Create `src/components/itemMaster/itemMasterExportPresets.ts` containing canonical retail presets and the forensic audit enrichment engine (`enrichItemRowsWithAuditMetadata`).
- Integrate presets and audit columns into `src/components/itemMaster/ItemDetailsGrid.tsx`.
- Add comprehensive Vitest test suite `src/tests/itemMasterExport.test.ts`.

## 4. Current State
- `ItemDetailsGrid.tsx` uses `<ExportButton>` with a single list of `catalogFields` (approx. 13-20 visible columns).
- Users have to manually check/uncheck 30+ checkboxes to build an operational sheet.
- Audit metadata (`created_at`, `modified_at`, `version`) and compliance validations (`validateRowRequiredFields`) exist in memory but are not exported in a structured audit report.

## 5. Gap Analysis
1. No pre-configured presets: Users cannot switch between "POS Price List", "Stocktaking", and "All Fields" in one click.
2. Missing Audit Mode: No dedicated export for catalog exceptions (missing HSN, missing GST, Selling Price > MRP violations, negative margins).
3. Incomplete "All Fields" set: System fields (`created_at`, `modified_at`, `version`, `weight_grams`, `gender`, etc.) are omitted from the export columns.

## 6. Architecture Impact
- **Frontend Layer:** `ExportCenterModal.tsx` gains modular preset buttons without breaking backward compatibility for any existing consumers (`LedgerScreen`, `CustMasterWs`, `TaxHeaderBar`).
- **Domain Layer:** `itemMasterExportPresets.ts` centralizes retail presets and audit calculations cleanly decoupled from UI components.
- **Security & RBAC:** Presets support field-level safety; sensitive financial columns remain governed.

## 7. Proposed Design
```
┌────────────────────────────────────────────────────────────────────────┐
│                        Item Master Export Modal                        │
├────────────────────────────────────────────────────────────────────────┤
│ Quick Presets:                                                         │
│ [All Fields (42)] [POS Price List] [Stocktaking] [Vendor PO] [Audit]   │
├────────────────────────────────────────────────────────────────────────┤
│ 1. File Format:  [Excel .xlsx] [Google Sheets] [CSV] [JSON] [Text]     │
│ 2. Export Scope: (•) Current Page  ( ) All Items  ( ) Filtered  ( ) Sel│
│ 3. Choose Columns: [42/42 Selected]  Select All | Clear               │
│    [x] SKU Code  [x] Barcode  [x] Product Title  [x] MRP  ...          │
├────────────────────────────────────────────────────────────────────────┤
│ [Cancel]                                             [Download File ↓] │
└────────────────────────────────────────────────────────────────────────┘
```

## 8. Files Created
1. `docs/implementation/inventory/Item_Master_Tri_Modal_Export_Engine_Plan_v6.71.0.md`
2. `src/components/itemMaster/itemMasterExportPresets.ts`
3. `src/tests/itemMasterExport.test.ts`
4. `docs/walkthrough/inventory/Item_Master_Tri_Modal_Export_Engine_v6.71.0.md`

## 9. Files Modified
1. `src/components/export/types.ts`
2. `src/components/export/ExportCenterModal.tsx`
3. `src/components/export/ExportButton.tsx`
4. `src/components/itemMaster/ItemDetailsGrid.tsx`
5. `docs/implementation/README.md`
6. `docs/walkthrough/README.md`
7. `CHANGELOG.md`

## 10. Dependencies
- `vitest` for test execution.
- `lucide-react` for icon indicators.
- `pako` for OpenXML zip compression.

## 11. Risks
- Risk of breaking existing `ExportButton` consumers: Mitigated by making `presets` strictly optional with standard fallback.
- Memory pressure on large datasets: Mitigated by streaming pagination in `GlobalExportService` and client-side chunked processing.

## 12. Rollback Strategy
Git revert commits on `src/components/export/` and `src/components/itemMaster/`. Existing export functionality remains 100% backward-compatible.

## 13. Verification Plan
1. Run `npm test src/tests/itemMasterExport.test.ts` to verify preset selection, audit column enrichment, and anomaly detection.
2. Run `npm test src/tests/globalExport.test.ts` to verify core export engine.
3. Verify TypeScript build correctness.

## 14. Test Plan
- Test Case 1: All Fields preset selects 100% of available catalog and audit fields.
- Test Case 2: POS Price List preset selects only retail-facing columns.
- Test Case 3: Stocktaking preset selects inventory count fields.
- Test Case 4: Audit preset correctly flags missing HSN, missing GST, and SP > MRP violations.
- Test Case 5: Audit calculation accurately generates margin amounts and discount percentages.

## 15. Documentation Impact
- Update `docs/implementation/README.md`.
- Update `docs/walkthrough/README.md`.
- Update `CHANGELOG.md`.

## 16. Deployment Plan
Frontend client release with version bump to v6.71.0. Zero database migrations required.

## 17. Status
Approved — In Progress.

## 18. Related ADRs
- ADR-0021: Canonical Item Variant Architecture & SMRITI Tenant Data Plane.
- ADR-0034: Global DataBridge Multi-Format Export Standards.

## 19. Related Walkthroughs
- `docs/walkthrough/inventory/Item_Master_Tri_Modal_Export_Engine_v6.71.0.md`.
