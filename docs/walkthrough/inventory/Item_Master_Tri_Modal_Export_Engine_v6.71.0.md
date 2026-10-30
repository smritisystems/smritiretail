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
  Classification: Walkthrough — Universal Item Master
-->

# Walkthrough: Item Master Tri-Modal Export Engine (All Fields, Selected Presets & Forensic Audit)

## 1. Purpose
This walkthrough documents the design, implementation, and verification of the **Tri-Modal Export Engine** in SMRITI Retail OS for the Item Master module. It provides full-breadth data extraction for system migrations ("All Fields"), one-click operational presets for daily retail workflows ("Selected Presets"), and automated compliance validation for financial and legal governance ("Forensic Audit").

## 2. Scope
- Definition of canonical retail column presets (`ITEM_MASTER_EXPORT_PRESETS`).
- Expansion of the universal export contracts (`ExportPreset` interface in `types.ts`).
- Responsive Presets Control Bar in `ExportCenterModal.tsx` enabling instant column configuration.
- Creation of the forensic audit calculation engine (`enrichItemRowsWithAuditMetadata`) verifying Legal Metrology constraints, negative margins, and statutory GST/HSN completeness.
- Integration of preset switching, audit columns, and data enrichment in `ItemDetailsGrid.tsx`.
- Comprehensive Vitest unit test suite covering preset mapping, anomaly detection, and multi-format serialization (`CSV`, `SpreadsheetML`, and `OpenXML XLSX`).

## 3. Files Created
1. `docs/implementation/inventory/Item_Master_Tri_Modal_Export_Engine_Plan_v6.71.0.md`
2. `src/components/itemMaster/itemMasterExportPresets.ts`
3. `src/tests/itemMasterExport.test.ts`
4. `docs/walkthrough/inventory/Item_Master_Tri_Modal_Export_Engine_v6.71.0.md`

## 4. Files Modified
1. `src/components/export/types.ts`
2. `src/components/export/ExportCenterModal.tsx`
3. `src/components/export/ExportButton.tsx`
4. `src/components/itemMaster/ItemDetailsGrid.tsx`
5. `docs/implementation/README.md`
6. `docs/walkthrough/README.md`
7. `CHANGELOG.md`

## 5. Architecture Decisions
- **Decoupled Preset Engine:** Defined presets in `itemMasterExportPresets.ts` instead of hardcoding them into UI components, ensuring testability and modularity across different catalog grids.
- **Client-Side Audit Enrichment:** Embedded `enrichItemRowsWithAuditMetadata` to perform instantaneous statutory and Legal Metrology rule checks against the loaded catalog buffer without incurring unnecessary backend roundtrips.
- **Backward-Compatible Modal Extension:** Made `presets`, `defaultPresetId`, and `onEnrichData` optional in `ExportCenterModalProps` and `ExportButtonProps`, ensuring zero regressions for other consumers (`LedgerScreen`, `CustMasterWs`, `TaxHeaderBar`).

## 6. Design Rationale
Retail catalogs contain over 40 attributes. Forcing users to manually configure 40 column checkboxes on every export creates operational fatigue, while dumping all fields into every spreadsheet exposes sensitive cost margins to cashiers and floor staff. The Tri-Modal architecture provides immediate role-based views while preserving full administrative backup and auditing power.

## 7. Implementation Summary
- **Export Presets:**
  - `all`: All Fields (Full catalog and system dump).
  - `pos_price_list`: Store & POS Price List (SKU, barcode, name, brand, category, dimensions, MRP, SP, tax).
  - `stocktake`: Physical Stocktaking Sheet (SKU, barcode, name, stock on hand, UOM).
  - `procurement`: Vendor & PO Catalog (SKU, style code, vendor code, buying price, cost price, HSN, UOM).
  - `ecom_catalog`: E-Commerce Digital Feed (SKU, barcode, title, weights, images, online price).
  - `statutory_tax`: Statutory GST & HSN (SKU, name, HSN code, GST %, MRP, SP, UOM).
  - `forensic_audit`: Forensic & Quality Audit (SKU, barcode, prices, margins, compliance status, exception list, timestamps, version).
- **Audit Rules Enforced:**
  - Mandatory SKU, Barcode, and Product Name.
  - Statutory HSN Code (non-empty, non-`0000`) and GST Tax Rate (>= 0%).
  - Legal Metrology Compliance: Selling Price <= MRP.
  - Loss Prevention: Cost Price <= Buying Price, Selling Price >= Cost Price (positive gross margin).

## 8. Tests Executed
```bash
npm test src/tests/itemMasterExport.test.ts
npm test src/tests/globalExport.test.ts
npm test src/tests/itemGrid.test.ts
```

## 9. Verification Results
- `src/tests/itemMasterExport.test.ts`: 13/13 tests passed (100% green).
- `src/tests/globalExport.test.ts`: 15/15 tests passed (100% green).
- `src/tests/itemGrid.test.ts`: 13/13 tests passed (100% green).

## 10. Known Limitations
- Background multi-page streaming for Audit Mode uses the client's current filter/page state unless executed against the backend DataBridge export worker.

## 11. Future Work
- Integration with scheduled report daemon for automatic weekly audit exception email dispatches to store comptrollers.
- Real-time notification badge on Item Master header showing the number of un-remediated compliance exceptions.

## 12. Related ADRs
- ADR-0021: Canonical Item Variant Architecture & SMRITI Tenant Data Plane.
- ADR-0034: Global DataBridge Multi-Format Export Standards.

## 13. Related RFCs
- RFC-2026-08: Universal Catalog Grid & Header Alias Normalization.
