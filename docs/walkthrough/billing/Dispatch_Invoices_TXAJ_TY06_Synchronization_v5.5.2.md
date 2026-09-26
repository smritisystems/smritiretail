<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 5.5.2
  Created      : 2026-09-10
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Canonical Dispatch Invoice TXAJ & TY06 Synchronization & Export Walkthrough
-->

# Dispatch Invoices TXAJ & TY06 Synchronization & Statutory Export Walkthrough (v5.5.2)

## 1. Purpose
This walkthrough documents the canonical synchronization and statutory export of **Sales Invoice TT2026-2027/190** (Store `TXAJ` — *Reliance Retail Limited, RRL TRENDS FOOTWEAR PALAVAKKAM*, Chennai, Tamil Nadu) and **Sales Invoice TT2026-2027/193** (Store `TY06` — *Reliance Retail Limited, VARANASI DURGAKUND*, Varanasi, Uttar Pradesh) from revised dispatch workbook `F:\Smriti-Clients Data\10-09-2026\RIL_Dispatch10092026-2.xlsx` into PostgreSQL database `smriti001`.

## 2. Scope
- **Target Invoices:**
  1. `TT2026-2027/190` (Store: `TXAJ`, PO: `5182778205`, GSTIN: `33AABCR1718E1ZW`, Place of Supply: `Tamil Nadu (33)`)
  2. `TT2026-2027/193` (Store: `TY06`, PO: `5182778208`, GSTIN: `09AABCR1718E1ZN`, Place of Supply: `Uttar Pradesh (09)`)
- **Data Source:** Sheet `'08-09-2026'` in `F:\Smriti-Clients Data\10-09-2026\RIL_Dispatch10092026-2.xlsx`
- **Reconciliation & Expansion:**
  - Resolved pending unassigned cartons (`*`) from previous batches by capturing newly assigned cartons `392` (TXAJ) and `391` (TY06).
  - 14 rows per store unpivoted across sizes 36..42 into 89 canonical line items (117 physical pairs) per store.
- **Statutory Artifacts:**
  - Standard & portal named A4 PDF Tax Invoices with rotated company header logo and 0.5px dashed vertical separator.
  - NIC v1.0.1118 compliant individual E-Way Bill JSON payloads.
  - Consolidated 15-store bulk upload payload (`EWayBill_Bulk_Upload_15_Invoices_10092026.json`).
  - Dispatch Excel workbook update highlighting 14 rows per store green (`FF92D050`) in Column O.

## 3. Files Created
1. `backend/scripts/update_and_export_txaj_ty06.py`: Canonical synchronization, database update, and multi-directory export script for TXAJ and TY06.
2. `docs/walkthrough/billing/Dispatch_Invoices_TXAJ_TY06_Synchronization_v5.5.2.md`: Formal WGP compliance walkthrough.
3. `F:\Smriti-Clients Data\10-09-2026\Final\Tax_Invoice_PDFs\TXAJ_5182778205_TT2026-2027_190.pdf`: Statutory client portal named PDF for TXAJ.
4. `F:\Smriti-Clients Data\10-09-2026\Final\Tax_Invoice_PDFs\Tax_Invoice_TT2026-2027_190.pdf`: Standard named PDF for TXAJ.
5. `F:\Smriti-Clients Data\10-09-2026\Final\Tax_Invoice_PDFs\TY06_5182778208_TT2026-2027_193.pdf`: Statutory client portal named PDF for TY06.
6. `F:\Smriti-Clients Data\10-09-2026\Final\Tax_Invoice_PDFs\Tax_Invoice_TT2026-2027_193.pdf`: Standard named PDF for TY06.
7. `F:\Smriti-Clients Data\10-09-2026\Final\Eway_JSON\TT2026-2027_190_Eway.json`: NIC v1.0.1118 E-Way JSON for TXAJ.
8. `F:\Smriti-Clients Data\10-09-2026\Final\Eway_JSON\TT2026-2027_193_Eway.json`: NIC v1.0.1118 E-Way JSON for TY06.
9. `F:\Smriti-Clients Data\10-09-2026\Final\EWayBill_Bulk_Upload_15_Invoices_10092026.json`: Complete 15-store consolidated NIC bulk upload payload.

## 4. Files Modified
1. `docs/walkthrough/README.md`: Appended chronological index entry for v5.5.2.
2. `F:\Smriti-Clients Data\10-09-2026\RIL_Dispatch10092026-2.xlsx`: 28 rows (14 TXAJ + 14 TY06) updated with respective invoice numbers and green fill (`FF92D050`).
3. `F:\Smriti-Clients Data\10-09-2026\RIL_Dispatch10092026.xlsx`: Synced green highlights for parity across revisions.

## 5. Architecture Decisions
- **ADR-DISPATCH-04: Deterministic Resolution of Pending Cartons:** In previous batches, stores `TXAJ` and `TY06` had asterisks (`*`) in place of physical carton numbers for select articles. The revised workbook `RIL_Dispatch10092026-2.xlsx` fully resolved these items into physical cartons `392` (TXAJ) and `391` (TY06), enabling compliant statutory invoice issuance.
- **ADR-DISPATCH-05: Consolidated 15-Invoice NIC Bulk Upload Standard:** Aggregated all completed invoices (`12` updated stores + `Bill 150` + `TXAJ` + `TY06` = `15` total invoices) into a unified NIC v1.0.1118 bulk upload payload for automated filing.

## 6. Design Rationale
Stores `TXAJ` and `TY06` represent major retail store shipments to Tamil Nadu and Uttar Pradesh. Ensuring exact AST parity in PostgreSQL between the client dispatch packing list and database invoice lines guarantees that physical stock movements match tax filings and warehouse gate passes.

## 7. Implementation Summary
- **Store TXAJ (`TT2026-2027/190`):**
  - Total Quantity: 117 pairs (Cartons `299`, `300`, `392`)
  - Taxable Value: ₹1,35,191.68
  - IGST (5%): ₹6,759.60
  - Rounding Adjustment: -₹0.28
  - Grand Total: ₹1,41,951.00
  - Amount in Words: One Lakh Forty One Thousand Nine Hundred Fifty One Rupees Only
- **Store TY06 (`TT2026-2027/193`):**
  - Total Quantity: 117 pairs (Cartons `297`, `298`, `391`)
  - Taxable Value: ₹1,35,191.68
  - IGST (5%): ₹6,759.60
  - Rounding Adjustment: -₹0.28
  - Grand Total: ₹1,41,951.00
  - Amount in Words: One Lakh Forty One Thousand Nine Hundred Fifty One Rupees Only

## 8. Tests Executed
```bash
python -m py_compile backend/scripts/update_and_export_txaj_ty06.py
python backend/scripts/update_and_export_txaj_ty06.py
```

## 9. Verification Results
- **PostgreSQL Database Verification:**
  ```text
  invoice_no: TT2026-2027/190 | store: TXAJ | items: 89 | qty: 117.00 | total: 141951.00
  invoice_no: TT2026-2027/193 | store: TY06 | items: 89 | qty: 117.00 | total: 141951.00
  ```
- **PDF Visual Verification:** High-resolution page extraction confirmed proper rendering of rotated company header logo, 0.5px dashed vertical separator line, barcode generation, item table alignment, and bank account details.
- **Excel Cell Fill Verification:** Verified all 14 rows for `TXAJ` and 14 rows for `TY06` in sheet `'08-09-2026'` carry invoice numbers and background color `#FF92D050`.

## 10. Known Limitations
- Transporter document details awaiting physical vehicle dispatch assignment.

## 11. Future Work
- Direct NIC API webhook integration for live E-Way bill generation.

## 12. Related ADRs
- `ADR-001`: PostgreSQL System of Record Architecture
- `ADR-014`: Statutory PDF Printing Standard Engine

## 13. Related RFCs
- `RFC-2026-08`: Retail B2B Dispatch & Multi-Store Consolidation Architecture
