<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.62.0
  Created      : 2026-10-03
  Modified     : 2026-10-03
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: SMRITI Global Grid Input, Paste, Import & Product Resolution Standard

**Plan ID:** IP-CATALOG-GRID-IMPORT-v1.0  
**Version:** 6.62.0  
**Date:** 2026-10-03  
**Status:** Completed  
**Author:** Jawahar Ramkripal Mallah (Chief Systems Architect & Creator)  

---

## 1. Objective
Establish a single, authoritative, reusable Global Grid Input & Import capability across SMRITI Retail OS. Provide universal support for Direct Excel Clipboard Paste (`Ctrl+V`), CSV/TSV/TXT file upload, rapid barcode scanner collection, header mapping, batch product resolution, and pre-commit preview, eliminating fragmented ad-hoc parsers and competing product lookup logic.

## 2. Business Motivation
In retail enterprise operations, operators copy transaction lines directly from spreadsheets (Excel, Google Sheets) or scan physical barcodes in bulk. Previously, fragmented parsers existed across Billing, Goods Receipt (GRN), Item Master, and Barcode Label Printing with inconsistent delimiter handling, duplicate policy discrepancies, and rogue dummy SKU generation. Centralizing this into a single engine ensures uniform behavior, zero phantom product commits, and accelerated operator workflows.

## 3. Scope
- **Input Channels:** Native Excel/Sheets Clipboard TSV (`\t`), RFC 4180 CSV (`,`), Semicolon (`;`), Pipe (`|`), PDT Tilde (`~`), Hardware Barcode Scanner.
- **Profiles Supported:** `BILLING`, `PURCHASE`, `STOCK_MOVEMENT`, `BARCODE_PRINTING`, `ITEM_MASTER`.
- **Modes:** `APPEND`, `MERGE` (quantity accumulation), `REPLACE` (with confirmation).
- **Duplicate Policies:** `MERGE_ROWS`, `ADD_AS_SEPARATE_ROWS`, `REJECT_DUPLICATE`.
- **Atomic Safety:** In transactional grids, any unresolved product prevents batch commitment unless valid-only override is explicitly confirmed.
- **Backend Batch Resolution:** Fast single-roundtrip batch resolution endpoint `/api/v1/products/batch-resolve`.

## 4. Current State
Prior to this standard:
- `src/components/ExcelGridEntrySec.tsx` used tab-only splitting (`split("\t")`), failing on CSV/quotes.
- `src/components/purchase/GrnCsvImportModal.tsx` maintained private CSV splitting logic and generated fake `ITEM-${lineIdx + 1}` SKUs for missing products.
- `src/components/barcode/ptFileParser.ts` maintained private delimited parsing.
- Billing CSV import maintained separate catalog lookup SQL queries.

## 5. Gap Analysis
- No unified batch resolution endpoint on backend (`/products/resolve` was single-item only).
- No shared React hook for wiring Excel clipboard paste directly into table bodies.
- Header ambiguity rules were not utilizing context defaults (`GRN` vs `ITEM_MASTER` for rate/costPrice).
- No centralized preview modal supporting live product status badges (`VALID`, `WARNING`, `PRODUCT_NOT_FOUND`, `PRODUCT_INACTIVE`, `PRODUCT_QUARANTINED`).

## 6. Architecture Impact
```text
Spreadsheet (Ctrl+V) / CSV / TSV / TXT / Scanner
                       ↓
         GridInputEngine.parseDelimitedText()
                       ↓
         HeaderMappingEngine.mapColumns()
                       ↓
   POST /api/v1/products/batch-resolve (Backend)
                       ↓
         Pre-Commit Preview & Validation
                       ↓
         Document Line Insertion (Mode: APPEND/MERGE/REPLACE)
```

## 7. Proposed Design
1. **Engine Layer:** `src/services/gridInput/gridInputEngine.ts` containing pure, framework-agnostic parsing, column mapping, row normalization, duplicate policy application, and import mode application.
2. **Hook Layer:** `src/services/gridInput/useGridClipboardPaste.ts` providing hook bindings for table `onPaste` events and clipboard API access.
3. **UI Layer:** `src/components/gridInput/GlobalGridImportModal.tsx` providing a multi-tab wizard (Clipboard Paste, File Upload, Rapid Scanner), header mapping review, live metrics, status filters, and atomic transaction commit protection.
4. **Backend Layer:** `backend/app/services/product_resolution_service.py` (`resolve_batch`) and `POST /api/v1/products/batch-resolve`.

## 8. Files Created
- `src/services/gridInput/types.ts`
- `src/services/gridInput/gridProfiles.ts`
- `src/services/gridInput/gridInputEngine.ts`
- `src/services/gridInput/useGridClipboardPaste.ts`
- `src/components/gridInput/GlobalGridImportModal.tsx`
- `src/tests/globalGridInputEngine.test.ts`
- `backend/tests/test_batch_product_resolution.py`
- `src/tests/barcodeManagementIntake.test.ts`
- `src/tests/itemMasterStudioIntake.test.ts`
- `src/tests/grnGridIntake.test.ts`

## 9. Files Modified
- `backend/app/schemas/product_resolution.py`
- `backend/app/services/product_resolution_service.py`
- `backend/app/api/v1/product_resolution.py`
- `backend/app/api/v1/billing_csv.py`
- `src/lib/headerMapping/HeaderMappingEngine.ts`
- `src/components/ExcelGridEntrySec.tsx`
- `src/components/barcode/ptFileParser.ts`
- `src/components/purchase/GrnCsvImportModal.tsx`
- `src/components/barcode/TagLabelPrintingTa.tsx`
- `src/components/inventory/PhysicalStockTab.tsx`
- `src/components/items/BulkImportSection.tsx`
- `src/components/billing/ProPosBillingTerm.tsx`
- `src/components/sales/SalesOrderFormPremium.tsx`
- `src/components/wms/WmsStudioTab.tsx`
- `src/components/purchase/PoSizewiseTab.tsx`
- `src/components/purchase/PoGenerateTab.tsx`
- `src/components/itemMaster/ItemMasterStudio.tsx`
- `src/components/BarcodeManagementTab.tsx`
- `src/components/purchase/GrnReceiptTab.tsx`

## 10. Dependencies
- Zero external frontend dependencies added (vanilla TSV/CSV parsing without heavy third-party bundles).
- `apiFetchV1` for standard communication.
- `HeaderMappingEngine` and `HeaderAliasRegistry` for column detection.

## 11. Risks
- Risk of breaking legacy imports: Mitigated by maintaining exact props and data contracts on refactored components (`GrnCsvImportModal`, `ptFileParser`, `ExcelGridEntrySec`).
- Large clipboard pastes (>1,000 rows): Mitigated by batch resolution and RFC 4180 parsing in O(N) linear time.

## 12. Rollback Strategy
Git revert of affected components restores previous module-specific parsers. No database migrations were altered.

## 13. Verification Plan
- Vitest suite `globalGridInputEngine.test.ts` verifying parser, mappings, row building, duplicate policies, and import modes.
- Vitest suite `barcodeManagementIntake.test.ts` verifying barcode intake parser, aliases, and headerless fallback.
- Pytest suite `test_batch_product_resolution.py` verifying backend resolution, inactive checks, dedup cache, and HTTP endpoint.
- Existing regression suites across item grid, tag printing, GRN import, and billing CSV.

## 14. Test Plan
- Unit tests: Delimiter detection (`\t`, `,`, `;`, `|`, `~`), quote escaping (`""`), BOM stripping.
- Integration tests: Batch resolution against Postgres `items`, `item_variants`, `item_barcodes`.
- Contract tests: API response shapes and HREP-compliant error codes.

## 15. Documentation Impact
- Update `docs/implementation/README.md`.
- Create `docs/walkthrough/catalog/Global_Grid_Input_And_Import_Standard_v1.0.md`.
- Create `docs/walkthrough/catalog/Global_Grid_Import_Rollout_v1.0.md`.
- Create `docs/walkthrough/sales/Global_Grid_Import_POS_And_Sales_Order_v1.0.md`.
- Create `docs/walkthrough/wms/Global_Grid_Import_WMS_STO_v1.0.md`.
- Create `docs/walkthrough/purchase/Global_Grid_Import_Sizewise_PO_v1.0.md`.
- Create `docs/walkthrough/purchase/Global_Grid_Import_PO_Generate_v1.0.md`.
- Create `docs/walkthrough/catalog/Global_Grid_Import_Item_Master_And_Barcode_Registry_v1.0.md`.
- Create `docs/walkthrough/catalog/Global_Grid_Import_Item_Master_File_Upload_And_Headerless_Mode_v1.0.md`.
- Create `docs/walkthrough/procurement/Global_Grid_Import_GRN_Inward_v1.0.md`.
- Update `docs/walkthrough/README.md`.
- Record entries in `CHANGELOG.md` (`[6.55.0]` through `[6.62.0]`).

## 16. Deployment Plan
Shipped in versions `6.55.0` through `6.62.0` via standard Git pull and Vite build.

## 17. Status
Completed — All phases rolled out:
- Phase 30 (v6.55.0): Core Standard & Initial Migration
- Phase 31 (v6.56.0): Barcode Label Studio & Physical Stock Count
- Phase 31.1 (v6.56.1): Item Master Bulk Spreadsheet Paste
- Phase 32 (v6.57.0): POS Counter Billing & Sales Order Studio
- Phase 32.1 (v6.57.1): WMS Studio Stock Transfer Orders (STO) Multi-Item Staging & Fast Import
- Phase 33 (v6.58.0): Footwear & Apparel Sizewise Purchase Order Matrix Direct Paste & Fast Import
- Phase 34 (v6.59.0): Standard Purchase Order Generator (`PoGenerateTab.tsx`) Direct Paste & Fast Import
- Phase 35 (v6.60.0): Item Master Studio Matrix Parser & Barcode Registry Intake Modernization
- Phase 36 (v6.61.0): Item Master Studio File Upload, Drag-and-Drop, Template Download & Headerless Row Mode Hardening
- Phase 37 (v6.62.0): Goods Receipt Note (GRN) Inward Workspace Direct Clipboard Paste, Fast Import & PO Contract Matching

## 18. Related ADRs
- `docs/architecture/ADR_GLOBAL_PRODUCT_RESOLUTION.md`

## 19. Related Walkthroughs
- `docs/walkthrough/catalog/Global_Grid_Input_And_Import_Standard_v1.0.md`
- `docs/walkthrough/catalog/Global_Grid_Import_Rollout_v1.0.md`
- `docs/walkthrough/sales/Global_Grid_Import_POS_And_Sales_Order_v1.0.md`
- `docs/walkthrough/wms/Global_Grid_Import_WMS_STO_v1.0.md`
- `docs/walkthrough/purchase/Global_Grid_Import_Sizewise_PO_v1.0.md`
- `docs/walkthrough/purchase/Global_Grid_Import_PO_Generate_v1.0.md`
- `docs/walkthrough/catalog/Global_Grid_Import_Item_Master_And_Barcode_Registry_v1.0.md`
- `docs/walkthrough/catalog/Global_Grid_Import_Item_Master_File_Upload_And_Headerless_Mode_v1.0.md`
- `docs/walkthrough/procurement/Global_Grid_Import_GRN_Inward_v1.0.md`


