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
  Classification: Walkthrough Document
-->

# Walkthrough: Global Grid Import Standard Rollout — Goods Receipt Note (GRN) Inward Workspace

**Version:** 6.62.0  
**Area:** Procurement & Inward Logistics / Goods Receipt Note (GRN)  
**Date:** 2026-10-03  
**Status:** Completed  
**Branch:** `smritiNX`  

---

## 1. Purpose
This phase brings the **SMRITI Goods Receipt Note (GRN) Receiving Studio** (`GrnReceiptTab.tsx`) and vendor manifest intake under the **SMRITI Global Grid Input, Paste, Import & Product Resolution Standard**. Historically, GRN intake depended on fragmented local CSV parsing (`GrnCsvImportModal.tsx`) that synthesized fake fallback SKUs (`ITEM-${lineIdx + 1}`) and dummy IDs (`PROD-${idx + 1}`) when barcodes were unresolvable, bypassing server-side database validation and atomic transaction safety. Furthermore, the receiving table container lacked direct clipboard paste (`Ctrl+V`) interception. This rollout unifies GRN inward processing with `GlobalGridImportModal`, adds direct clipboard table paste, links contract purchase order lines with Purchase Price Variance (PPV) tracking, and guarantees zero phantom product generation.

---

## 2. Scope
1. **Direct Inward Table Clipboard Paste**: Integrating `handleTableContainerPaste` on the scrollable receiving lines table container in `GrnReceiptTab.tsx` (`tabIndex={0}`, `onPaste`), capturing multi-line or delimited text (`\t`, `,`, `~`, `|`) and opening `GlobalGridImportModal` pre-populated with parsed spreadsheet content.
2. **Global Grid Import Modal Integration**: Wiring `GlobalGridImportModal` with `GRID_PROFILES.PURCHASE` and catalog batch resolution (`POST /api/v1/products/batch-resolve`) into GRN receiving.
3. **Pure Line Mapper with PO Contract Matching**: Exporting `mapParsedGridRowsToGrnLines` to transform resolved products and raw values into canonical `GrnLineRow` records. When an active PO is loaded, matching PO lines supply `quantity_ordered` and contract `cost_price` to accurately compute Purchase Price Variance (PPV); ad-hoc lines are assigned `quantity_ordered: 0`.
4. **Pure Merge Utility**: Exporting `mergeGrnLines` supporting `APPEND`, `MERGE` (accumulating received and damaged quantities, updating invoice rates and MRP without dropping existing attributes), and `REPLACE` modes.
5. **Eradication of Dummy Item Fallbacks**: Sanitizing `GrnCsvImportModal.tsx` to eliminate `ITEM-${lineIdx + 1}` generation, properly marking identity-missing rows as `UNRECOGNIZED`.
6. **Automated Testing & Governance**: Creating dedicated unit tests in `src/tests/grnGridIntake.test.ts` and synchronizing the Version SSOT to `6.62.0`.

---

## 3. Files Created
1. `src/tests/grnGridIntake.test.ts` — Unit test suite verifying vendor ASN TSV quotation protection, PO contract matching, PPV calculation, ad-hoc item mapping, and all three merge modes (`APPEND`, `MERGE`, `REPLACE`) with zero phantom dummy IDs (4/4 tests green).
2. `docs/walkthrough/procurement/Global_Grid_Import_GRN_Inward_v1.0.md` — This walkthrough document.

---

## 4. Files Modified
1. `src/components/purchase/GrnReceiptTab.tsx`:
   - Exported `GrnLineRow` interface.
   - Exported `mapParsedGridRowsToGrnLines` and `mergeGrnLines` pure functions.
   - Added `showGlobalGridImportModal` and `globalImportInitialText` state.
   - Added `handleTableContainerPaste` interceptor on the receiving lines table container (`tabIndex={0}`, `onPaste`).
   - Modernized "Fast Import (Excel / CSV)" action button on the "Barcode Scanner & Inward Tools" card to open `GlobalGridImportModal`.
   - Added `handleGlobalGridImportCommit` with notification dispatch.
   - Rendered `GlobalGridImportModal` alongside existing dialogs.
   - Updated UADHP header version to `6.62.0`.
2. `src/components/purchase/GrnCsvImportModal.tsx`:
   - Eliminated fake dummy item synthesis (`ITEM-${lineIdx + 1}`); rows missing both barcode and SKU are now flagged with status `UNRECOGNIZED` and message "Row missing both barcode and SKU identifier."
   - Updated UADHP header version to `6.62.0`.
3. `package.json`:
   - Bumped version to `6.62.0`.
4. `src/config/version.ts`:
   - Bumped `APP_VERSION` and `ENTERPRISE_BILLING_SUITE_VERSION` to `6.62.0`.
5. `backend/app/core/config.py`:
   - Bumped `VERSION` setting and docstring to `6.62.0`.
6. `CHANGELOG.md`:
   - Added `[6.62.0]` release notes and updated header version.
7. `docs/walkthrough/README.md`:
   - Appended entry for this walkthrough in the master index table.
8. `docs/implementation/inventory/Global_Grid_Input_And_Import_Standard_Plan_v1.0.md`:
   - Updated status and walkthrough references for Phase 37.

---

## 5. Architecture Decisions
- **Contract Rate vs Invoice Rate Distinction**: In SMRITI Procurement, inward lines maintain both `cost_price` (the agreed purchase order contract rate) and `invoice_rate` (the vendor's billed rate on the physical invoice). `mapParsedGridRowsToGrnLines` matches inward lines against loaded PO lines so that contract costs are preserved and any difference (`invoice_rate - cost_price`) feeds directly into downstream Purchase Price Variance (PPV) accounting and debit note generation.
- **Atomic Product Resolution Pre-Commit**: Rather than allowing unverified supplier barcodes into the GRN workspace where they could fail during final posting (`POST /api/v1/purchase/receipts/`), `GlobalGridImportModal` validates every line against PostgreSQL `items`, `item_variants`, and `item_barcodes` upfront via `POST /api/v1/products/batch-resolve`. Commit is strictly blocked if any line is invalid.
- **Zero Phantom Item Synthesis**: Naive fallback generators (`ITEM-${i}`, `PROD-${i}`) have been permanently eradicated. Inward items must carry verifiable identity from either the vendor manifest or the PostgreSQL catalog.

---

## 6. Design Rationale
- **Seamless Operator Workflow**: Warehouse operators receiving deliveries often have ASN spreadsheets open in Excel alongside SMRITI. Allowing them to highlight rows in Excel, press `Ctrl+C`, click anywhere on the receiving table in SMRITI, and press `Ctrl+V` drastically reduces receiving friction and eliminates manual re-entry errors.
- **Non-Destructive MERGE Policy**: When merging an ASN import into an active PO receiving workspace, quantities received and damaged are accumulated, but PO contract rates and order quantities are never overwritten by missing spreadsheet cells.

---

## 7. Implementation Summary
- **Table Container Clipboard Interception**:
  ```tsx
  const handleTableContainerPaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData("text");
    if (!text) return;
    if (text.includes("\n") || text.includes("\t") || text.includes(",") || text.includes("~") || text.includes("|")) {
      e.preventDefault();
      setGlobalImportInitialText(text);
      setShowGlobalGridImportModal(true);
    }
  };
  ```
- **Line Transformation & Merge Engine**:
  - `mapParsedGridRowsToGrnLines(rows, existingPoLines)` converts parsed grid rows to `GrnLineRow[]`, matching SKU/barcode against active PO lines.
  - `mergeGrnLines(existing, incoming, mode)` executes clean `APPEND`, `MERGE`, or `REPLACE` state transitions.

---

## 8. Tests Executed
```bash
npx vitest run src/tests/grnGridIntake.test.ts src/tests/grnCsvImportEngine.test.ts src/tests/itemMasterStudioIntake.test.ts src/tests/barcodeManagementIntake.test.ts src/tests/globalGridInputEngine.test.ts src/tests/poGenerateUX.test.ts src/tests/multiMap.test.ts src/tests/aliasMap.test.ts
```
Terminal Output:
```text
 RUN  v4.1.11 F:/SMRITRretailNX

 ✓ src/tests/itemMasterStudioIntake.test.ts (4 tests) 14ms
 ✓ src/tests/aliasMap.test.ts (4 tests) 43ms
 ✓ src/tests/globalGridInputEngine.test.ts (19 tests) 25ms
 ✓ src/tests/multiMap.test.ts (9 tests) 11ms
 ✓ src/tests/barcodeManagementIntake.test.ts (7 tests) 9ms
 ✓ src/tests/grnCsvImportEngine.test.ts (4 tests) 10ms
 ✓ src/tests/grnGridIntake.test.ts (4 tests) 9ms
 ✓ src/tests/poGenerateUX.test.ts (11 tests) 11ms

 Test Files  8 passed (8)
      Tests  62 passed (62)
   Start at  13:05:46
   Duration  2.77s
```

TypeScript Compiler Verification:
```bash
npx tsc --noEmit
```
Terminal Output: Exit code 0 (zero errors).

Version SSOT Validator:
```bash
python scripts/validate_version_ssot.py
```
Terminal Output:
```text
--- SMRITI Version SSOT Inspection ---
package.json          : 6.62.0
backend/core/config.py: 6.62.0
src/config/version.ts : 6.62.0
CHANGELOG.md (head)   : 6.62.0

[PASS] Version SSOT consistent across all boundaries: 6.62.0
```

---

## 9. Verification Results
- `src/tests/grnGridIntake.test.ts`: 4/4 passed.
- All 8 grid intake regression suites: 62/62 passed.
- TypeScript compiler: 0 errors.
- Version SSOT: Clean 4-way match on `6.62.0`.

---

## 10. Known Limitations
- When receiving goods against a multi-currency import purchase order, rate conversion uses the fixed exchange rate stored on the order header rather than a dynamic spot rate.

---

## 11. Future Work
- Add direct image capture attachment for damaged goods lines during grid import preview.
- Integrate direct GS1-128 SSCC logistic pallet label barcode scanning into `GlobalGridImportModal`.

---

## 12. Related ADRs
- `ADR-0042`: Canonical Client-Side Tabular Parsing with GridInputEngine.
- `ADR-0043`: Universal Header Mapping Engine and Flexible Aliases.
- `ADR-0044`: Authoritative Goods Receipt and Landed Cost Accounting.

---

## 13. Related RFCs
- `RFC-2026-GRID-INPUT-01`: SMRITI Global Grid Input & Import Standard.
