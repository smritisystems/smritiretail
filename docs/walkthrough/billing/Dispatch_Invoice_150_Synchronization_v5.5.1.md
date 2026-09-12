<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 5.5.1
  Created      : 2026-09-10
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Canonical Dispatch Invoice 150 Synchronization & Export Walkthrough
-->

# Dispatch Invoice 150 Synchronization & Statutory Export Walkthrough (v5.5.1)

## 1. Purpose
This walkthrough documents the canonical synchronization and export of **Sales Invoice TT2026-2027/150** (Delivery Store: `T40K` — *Reliance Retail Limited, RRL FIF HESSARGATTA*, Bangalore, Karnataka) from sheet `'08-09-2026'` of dispatch workbook `F:\Smriti-Clients Data\10-09-2026\RIL_Dispatch10092026.xlsx` into the transactional PostgreSQL database `smriti001`.

## 2. Scope
- **Target Invoice:** `TT2026-2027/150` (Internal UUID: `inv-dispatch-d954a6e60b69`)
- **Store Code:** `T40K` (RRL FIF HESSARGATTA, Bangalore — PIN 560073)
- **Customer PO Snapshot:** `5182778163`
- **Data Source:** Sheet `'08-09-2026'` in `F:\Smriti-Clients Data\10-09-2026\RIL_Dispatch10092026.xlsx`
- **Artifacts Produced:**
  - Database line items: 70 unpivoted lines (94 physical pairs) across cartons `243`, `244`, and `387`.
  - Statutory PDF Tax Invoices generated via canonical `InvoicePdfService` (with 90° CCW rotated company header logo, dashed 0.5px vertical separator line, and precise A4 layout).
  - NIC v1.0.1118 compliant individual E-Way Bill JSON payload and consolidated 13-store bulk upload payload.
  - Dispatch Excel workbook update highlighting all 12 rows of store `T40K` green (`FF92D050`) in Column O.

## 3. Files Created
1. `backend/scripts/update_and_export_bill_150.py`: Canonical synchronization, database update, and multi-directory export script for Bill 150.
2. `docs/walkthrough/billing/Dispatch_Invoice_150_Synchronization_v5.5.1.md`: Formal WGP compliance walkthrough.
3. `F:\Smriti-Clients Data\10-09-2026\Final\Tax_Invoice_PDFs\T40K_5182778163_TT2026-2027_150.pdf`: Statutory client portal named PDF.
4. `F:\Smriti-Clients Data\10-09-2026\Final\Tax_Invoice_PDFs\Tax_Invoice_TT2026-2027_150.pdf`: Standard named PDF.
5. `F:\Smriti-Clients Data\10-09-2026\Final\Eway_JSON\TT2026-2027_150_Eway.json`: NIC v1.0.1118 E-Way JSON.
6. `F:\Smriti-Clients Data\10-09-2026\Final\EWayBill_Bulk_Upload_13_Invoices_10092026.json`: Complete 13-store consolidated NIC bulk upload payload.

## 4. Files Modified
1. `docs/walkthrough/README.md`: Appended chronological index entry for v5.5.1.
2. `F:\Smriti-Clients Data\10-09-2026\RIL_Dispatch10092026.xlsx`: 12 rows for `T40K` updated with value `TT2026-2027_150` and solid green fill (`FF92D050`).

## 5. Architecture Decisions
- **ADR-BILL150-01: Canonical PostgreSQL Transactional System-of-Record:** Maintained strict adherence to FastAPI + PostgreSQL as the sole system of record. Replaced 52 obsolete line items with 70 authoritative line items derived directly from the canonical dispatch sheet.
- **ADR-BILL150-02: Synchronized Pricing & Taxation Contract:** Applied standard commercial discount formula `unit_rate = round(mrp * 0.5624, 2)` (43.76% trade discount) and 5.00% IGST inter-state tax rate for Bangalore destination (Place of Supply Code 29).
- **ADR-BILL150-03: Consolidated E-Way Bill Bulk Upload Ingestion:** Expanded the 12-store bulk upload payload to a complete 13-store payload (`EWayBill_Bulk_Upload_13_Invoices_10092026.json`) allowing single-click bulk filing on the NIC portal.

## 6. Design Rationale
During the initial batch processing of sheet `'08-09-2026'`, Store `T40K` exhibited an OpenPyXL theme fill (`theme=0`, pure white) rather than an explicit RGB or null fill. This caused an automated fill classifier to prematurely mark it as pre-completed. By isolating and synchronizing `T40K`, all 12 rows (including newly assigned carton `387` containing articles `CH-07-B BLACK`, `CH-07-B TAN`, and `SH-02-I BLACK`) are fully reconciled with zero line leakage.

## 7. Implementation Summary
- **Total Physical Pairs:** 94 pairs (70 pairs from cartons 243 & 244 + 24 pairs from carton 387).
- **Taxable Subtotal:** ₹1,13,214.72
- **Tax (IGST 5%):** ₹5,660.76
- **Rounding Adjustment:** -₹0.48
- **Final Grand Total:** ₹1,18,875.00
- **Amount in Words:** One Lakh Eighteen Thousand Eight Hundred Seventy Five Rupees Only

## 8. Tests Executed
```bash
python -m py_compile backend/scripts/update_and_export_bill_150.py
python backend/scripts/update_and_export_bill_150.py
```

## 9. Verification Results
- **PostgreSQL Database Verification:**
  ```text
  invoice_no: TT2026-2027/150
  date: 2026-09-08
  taxable_value: 113214.72
  tax_total: 5660.76
  grand_total: 118875.00
  amount_in_words: One Lakh Eighteen Thousand Eight Hundred Seventy Five Rupees Only
  item_count: 70
  total_qty: 94.0000
  item_total: 118875.48
  ```
- **PDF Visual Verification:** High-resolution page extraction confirmed proper rendering of rotated company header logo, 0.5px dashed vertical separator line, barcode generation, item table alignment, and bank account details.
- **Excel Cell Fill Verification:** Verified all 12 rows for `T40K` in sheet `'08-09-2026'` carry value `TT2026-2027_150` and background color `#FF92D050`.

## 10. Known Limitations
- Transport details (`transDocNo`, `vehicleNo`) remain blank in the E-Way JSON per standard practice awaiting physical dispatch carrier assignment.

## 11. Future Work
- Integration with direct NIC GSP API for automated real-time E-Way bill generation without manual JSON file upload.

## 12. Related ADRs
- `ADR-001`: PostgreSQL System of Record Architecture
- `ADR-014`: Statutory PDF Printing Standard Engine

## 13. Related RFCs
- `RFC-2026-08`: Retail B2B Dispatch & Multi-Store Consolidation Architecture
