<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 5.5.3
  Created      : 2026-09-11
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Canonical Dispatch Invoices Date Reconciliation Walkthrough
-->

# Dispatch Invoices Date Reconciliation Walkthrough (v5.5.3)

## 1. Purpose
This walkthrough documents the full reconciliation and reversion of invoice dates for **20 synchronized sales invoices** back to their canonical issuance date of **`2026-09-02` (2nd September 2026)** across the PostgreSQL database `smriti001`, all generated statutory PDF tax invoices, and individual/bulk NIC E-Way Bill JSON payloads.

## 2. Scope
- **Target Invoices (20 Invoices):**  
  `TT2026-2027/150`, `TT2026-2027/167`, `TT2026-2027/168`, `TT2026-2027/169`, `TT2026-2027/170`, `TT2026-2027/171`, `TT2026-2027/172`, `TT2026-2027/174`, `TT2026-2027/176`, `TT2026-2027/179`, `TT2026-2027/185`, `TT2026-2027/186`, `TT2026-2027/187`, `TT2026-2027/188`, `TT2026-2027/189`, `TT2026-2027/190`, `TT2026-2027/191`, `TT2026-2027/192`, `TT2026-2027/193`, `TT2026-2027/194`.
- **Target Date Contract:**  
  - Database `sales_invoices.date`: `2026-09-02`
  - Statutory PDF Header Date: `02-09-2026`
  - NIC E-Way Bill `docDate`: `02/09/2026`
- **Resulting Dispatch Series Parity:**  
  Exactly **57/57 invoices** (`TT2026-2027/138` through `TT2026-2027/194`) are unified on `2026-09-02`.

## 3. Files Created
1. `backend/scripts/revert_invoices_date_to_sep2.py`: Automated reconciliation engine to update DB, re-render PDFs, and update E-Way JSONs.
2. `docs/walkthrough/billing/Dispatch_Invoices_Date_Reconciliation_v5.5.3.md`: Formal WGP compliance walkthrough.

## 4. Files Modified
1. `docs/walkthrough/README.md`: Appended chronological index entry for v5.5.3.
2. All 20 statutory PDF pairs across `F:\Smriti-Clients Data\10-09-2026\Final\Tax_Invoice_PDFs\`, `Tax_Invoices_Rotated_Logo\All_57_Stores\`, `Tax_Invoices_Rotated_Logo\12_Stores_Updated\`, and `08-09-2026` archive directories.
3. All 20 individual E-Way JSONs and consolidated bulk upload JSONs (`EWayBill_Bulk_Upload_15_Invoices_10092026.json`, `EWayBill_Bulk_Upload_All_Updated_Invoices.json`).

## 5. Architecture Decisions
- **ADR-DATE-01: Canonical Invoice Date Immutable under Packing Revisions:** Invoice issuance date is a statutory legal property established at initial generation (`2026-09-02`) that remains invariant across packing revisions, carton assignments, or dispatch workbook updates.
- **ADR-DATE-02: Universal Batch Consistency:** Maintained 100% date consistency across the entire 57-invoice dispatch series (`TT138`–`TT194`), eliminating date fragmentation between untouched and updated stores.

## 6. Design Rationale
When previous automation scripts imported updated quantities and packing assignments from the Excel tab titled `"08-09-2026"`, they erroneously updated `sales_invoices.date` to `'2026-09-08'`. By executing an atomic SQL migration and re-rendering statutory assets, all accounting ledgers, tax registers, printed invoices, and E-Way bills are aligned to the canonical invoice issuance date of September 2, 2026.

## 7. Implementation Summary
- **PostgreSQL Records Updated:** 20 invoices reverted to `2026-09-02`.
- **Statutory PDFs Re-rendered:** 20 invoices (40 files including standard and portal-named copies).
- **E-Way Bill Payloads Updated:** 20 individual files + 4 consolidated bulk files updated to `docDate: "02/09/2026"`.

## 8. Tests Executed
```bash
python -m py_compile backend/scripts/revert_invoices_date_to_sep2.py
python backend/scripts/revert_invoices_date_to_sep2.py
```

## 9. Verification Results
- **Database Query:**
  ```sql
  SELECT date, count(*) FROM sales_invoices
  WHERE invoice_no ~ '^TT2026-2027/(13[8-9]|1[4-8][0-9]|19[0-4])$'
  GROUP BY date;
  -- Result: date: 2026-09-02 | count: 57 (100% parity, 0 drift)
  ```
- **PDF Visual Inspection:** High-resolution page extraction confirmed `Date: 02-09-2026` across target invoices.
- **E-Way Bulk JSON:** Verified `set(b['docDate']) == {'02/09/2026'}` for all 15 bills in the consolidated bulk file.

## 10. Known Limitations
- None.

## 11. Future Work
- Add schema-level constraint or guard in dispatch update scripts preventing alteration of `sales_invoices.date` unless explicitly requested.

## 12. Related ADRs
- `ADR-001`: PostgreSQL System of Record Architecture
- `ADR-014`: Statutory PDF Printing Standard Engine

## 13. Related RFCs
- `RFC-2026-08`: Retail B2B Dispatch & Multi-Store Consolidation Architecture
