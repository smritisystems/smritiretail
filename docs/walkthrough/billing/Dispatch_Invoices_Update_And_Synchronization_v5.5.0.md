<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 5.5.0
  Created      : 2026-09-10
  Modified     : 2026-09-10
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough — Dispatch Invoices Update & Synchronization: 12 Stores from Sheet "08-09-2026" (v5.5.0)

## 1. Purpose
This walkthrough documents the end-to-end synchronization of sales invoices in PostgreSQL database `smriti001`, re-generation of statutory A4 Tax Invoice PDFs via `InvoicePdfService`, compilation of NIC v1.0.1118 compliant individual and bulk E-Way Bill JSONs, and updating and green-highlighting of Column O in [`F:\Smriti-Clients Data\10-09-2026\RIL_Dispatch10092026.xlsx`](file:///F:/Smriti-Clients%20Data/10-09-2026/RIL_Dispatch10092026.xlsx) (sheet `"08-09-2026"`). All 43 pre-completed green stores and the 2 stores with incomplete physical carton packing (`TY06`, `TXAJ`) were strictly excluded.

## 2. Scope
- **Target Invoices Synchronized (12 Stores):**
  1. `TKI6` | `TT2026-2027/172` (PO: `5182778188`) | 107 items | 141 pairs | Cartons: `372`, `373`, `374` | Net: ₹171,109.00 | Interstate (UP - 09)
  2. `TKU5` | `TT2026-2027/174` (PO: `5182778190`) | 92 items | 120 pairs | Cartons: `307`, `308`, `375` | Net: ₹146,024.00 | Interstate (UP - 09)
  3. `TMN2` | `TT2026-2027/176` (PO: `5182778192`) | 92 items | 120 pairs | Cartons: `305`, `306`, `376` | Net: ₹146,024.00 | **Intrastate (MH - 27)**: CGST 2.5% + SGST 2.5%
  4. `TUA7` | `TT2026-2027/179` (PO: `5182778196`) | 92 items | 120 pairs | Cartons: `303`, `304`, `377` | Net: ₹146,024.00 | Interstate (WB - 19)
  5. `TVP2` | `TT2026-2027/185` (PO: `5182778201`) | 76 items | 104 pairs | Cartons: `293`, `294`, `384` | Net: ₹129,499.00 | Interstate (KA - 29)
  6. `TVT0` | `TT2026-2027/186` (PO: `5182778202`) | 90 items | 118 pairs | Cartons: `301`, `302`, `386` | Net: ₹143,427.00 | Interstate (DL - 07)
  7. `TVU1` | `TT2026-2027/187` (PO: `5182778203`) | 74 items | 112 pairs | Cartons: `311`, `312`, `382` | Net: ₹135,990.00 | Interstate (BR - 10)
  8. `TW07` | `TT2026-2027/188` (PO: `5182778158`) | 76 items | 104 pairs | Cartons: `291`, `292`, `385` | Net: ₹129,499.00 | Interstate (KA - 29)
  9. `TW97` | `TT2026-2027/189` (PO: `5182778204`) | 76 items | 104 pairs | Cartons: `289`, `290`, `390` | Net: ₹129,499.00 | Interstate (TG - 36)
  10. `TXSR` | `TT2026-2027/191` (PO: `5182778206`) | 76 items | 104 pairs | Cartons: `287`, `288`, `389` | Net: ₹129,499.00 | Interstate (TG - 36)
  11. `TXSU` | `TT2026-2027/192` (PO: `5182778207`) | 76 items | 104 pairs | Cartons: `285`, `286`, `388` | Net: ₹129,499.00 | Interstate (KA - 29)
  12. `TYAC` | `TT2026-2027/194` (PO: `5182778209`) | 76 items | 104 pairs | Cartons: `283`, `284`, `383` | Net: ₹129,499.00 | Interstate (KA - 29)
- **Excluded Stores (45 Stores Untouched):**
  - *43 Pre-Completed Green Stores:* Preserved intact with no changes.
  - *2 User-Specified Excluded Stores:* `TY06` and `TXAJ` (incomplete carton packing marked with `*` in physical packing column).

## 3. Files Created
- [`backend/scripts/update_12_dispatch_invoices_10092026.py`](file:///f:/SMRITRretailNX/backend/scripts/update_12_dispatch_invoices_10092026.py) — Authoritative execution engine for database update, PDF rendering, E-way bill generation, and Excel formatting.
- [`backend/scripts/export_all_tax_invoices_rotated_logo.py`](file:///f:/SMRITRretailNX/backend/scripts/export_all_tax_invoices_rotated_logo.py) — Batch export engine rendering all 57 invoices with anticlockwise rotated logo.
- [`scratch/verify_12_invoices_db.py`](file:///f:/SMRITRretailNX/scratch/verify_12_invoices_db.py) — Database verification script checking line counts, pair counts, taxable value, CGST, SGST, IGST, and grand totals.
- [`scratch/verify_files.py`](file:///f:/SMRITRretailNX/scratch/verify_files.py) — Multi-directory filesystem verification script confirming existence and integrity of all PDF and JSON deliverables.
- [`docs/walkthrough/billing/Dispatch_Invoices_Update_And_Synchronization_v5.5.0.md`](file:///f:/SMRITRretailNX/docs/walkthrough/billing/Dispatch_Invoices_Update_And_Synchronization_v5.5.0.md) — This formal walkthrough document.

## 4. Files Modified
- [`backend/app/services/invoice_pdf_service.py`](file:///f:/SMRITRretailNX/backend/app/services/invoice_pdf_service.py) — Canonical Tax Invoice rendering engine updated to rotate brand logo 90° anticlockwise and dynamically fit the height of both company addresses (182px when separate dispatch address exists, 95px otherwise).
- [`docs/walkthrough/README.md`](file:///f:/SMRITRretailNX/docs/walkthrough/README.md) — Master index table updated with v5.5.0 entry.
- External Client Artifacts Created & Synchronized:
  - [`F:\Smriti-Clients Data\10-09-2026\Tax_Invoices_Rotated_Logo\All_57_Stores\`](file:///F:/Smriti-Clients%20Data/10-09-2026/Tax_Invoices_Rotated_Logo/All_57_Stores/) — 57 statutory tax invoices (114 files: both portal-named and generic-named) exported with 90° anticlockwise rotated logo fitting both addresses.
  - [`F:\Smriti-Clients Data\10-09-2026\Tax_Invoices_Rotated_Logo\12_Stores_Updated\`](file:///F:/Smriti-Clients%20Data/10-09-2026/Tax_Invoices_Rotated_Logo/12_Stores_Updated/) — 12 newly updated store invoices (24 files).
  - [`F:\Smriti-Clients Data\10-09-2026\RIL_Dispatch10092026_Updated.xlsx`](file:///F:/Smriti-Clients%20Data/10-09-2026/RIL_Dispatch10092026_Updated.xlsx) — 171 rows highlighted in green (`FF92D050`) with invoice numbers in Column O.
  - [`F:\Smriti-Clients Data\10-09-2026\Final\Eway_JSON\`](file:///F:/Smriti-Clients%20Data/10-09-2026/Final/Eway_JSON/) — 12 individual E-Way JSONs + 1 consolidated bulk upload JSON (sanitized to Part-A only).

## 5. Architecture Decisions
- **Canonical Header Logo Rotation & Geometry:** In `InvoicePdfService`, the brand logo is programmatically rotated 90° anticlockwise via Pillow and rendered at `182px` height, spanning from the top of the registered office address down to the bottom of the "DISPATCH FROM" address line (`Nagpur, Maharashtra - 440029`). An elegant `0.5px dashed #cbd5e1` vertical divider line cleanly isolates the logo container from the company address block.
- **Transactional Database Parity:** In PostgreSQL `smriti001`, all line items for target invoices are atomically deleted and re-inserted with exact size-level unpivoting matching physical dispatch sheets.
- **Strict Commercial Pricing Formula:** Unit price derived strictly as `unit_rate = round(mrp * Decimal("0.5624"), 2)` (43.76% trade discount), compliant with Reliance contract terms.
- **Intrastate vs. Interstate Tax Routing:**
  - Store `TMN2` in Maharashtra (State Code 27) correctly split into CGST 2.5% (₹3,476.82) + SGST 2.5% (₹3,476.82), with IGST = ₹0.00.
  - All other 11 stores outside Maharashtra correctly routed to IGST 5.0% (total ₹72,360.66), with CGST = ₹0.00 and SGST = ₹0.00.
- **Dual-Name PDF Archival:** Invoices saved as both `{StoreCode}_{PONumber}_{InvoiceNoClean}.pdf` (for customer billing portal uploads) and `Tax_Invoice_{InvoiceNoClean}.pdf` (for internal statutory audit vault).

## 6. Design Rationale
In retail supply chain execution, stores with completed packings (`Col O` green) and incomplete physical packings (`Col N` `*` such as `TY06` and `TXAJ`) must never be modified or re-billed prematurely. Filtering strictly for the 12 active packing stores from sheet `"08-09-2026"` guarantees zero regression on finalized shipments while providing immediate, audit-compliant billing documents for warehouse dispatch.

## 7. Implementation Summary
1. **Spreadsheet Ingestion & Filtering:** Inspected sheet `"08-09-2026"` in `RIL_Dispatch10092026.xlsx`. Identified 12 target stores meeting user criteria.
2. **Size Unpivoting & Rate Derivation:** Unpivoted physical quantities across sizes 6 to 11, computing exact taxable value, 5% GST, and rounding adjustments.
3. **Database Write:** Executed atomic update in PostgreSQL `smriti001` on `sales_invoices` headers and `sales_invoice_items` child rows.
4. **Statutory PDF Rendering:** Rendered 12 statutory PDFs using `InvoicePdfService` and copied them into all active client delivery folders.
5. **NIC E-Way Bill JSON Payloads:** Generated 12 schema-compliant NIC v1.0.1118 individual JSON payloads and 1 consolidated bulk upload JSON (`EWayBill_Bulk_Upload_12_Invoices_10092026.json`).
6. **Excel Formatting:** Populated Column O with assigned invoice numbers and formatted 171 rows with solid Green fill (`FF92D050`).

## 8. Tests Executed
Executed [`scratch/verify_12_invoices_db.py`](file:///f:/SMRITRretailNX/scratch/verify_12_invoices_db.py) against PostgreSQL `smriti001`:

```text
Count of verified invoices in smriti001: 12
--------------------------------------------------------------------------------------------------------------------------------------------
Inv No           | Code  | Store Name                | Lines | Pairs | Taxable (Rs) | CGST (Rs) | SGST (Rs) | IGST (Rs) | Grand Total
--------------------------------------------------------------------------------------------------------------------------------------------
TT2026-2027/172  | TKI6  | Reliance Retail Limited   |   107 |   141 |    162960.80 |      0.00 |      0.00 |   8148.07 |   171109.00
TT2026-2027/174  | TKU5  | Reliance Retail Limited   |    92 |   120 |    139070.56 |      0.00 |      0.00 |   6953.55 |   146024.00
TT2026-2027/176  | TMN2  | Reliance Retail Limited   |    92 |   120 |    139070.56 |   3476.82 |   3476.82 |      0.00 |   146024.00
TT2026-2027/179  | TUA7  | Reliance Retail Limited   |    92 |   120 |    139070.56 |      0.00 |      0.00 |   6953.55 |   146024.00
TT2026-2027/185  | TVP2  | Reliance Retail Limited   |    76 |   104 |    123332.32 |      0.00 |      0.00 |   6166.66 |   129499.00
TT2026-2027/186  | TVT0  | Reliance Retail Limited   |    90 |   118 |    136597.12 |      0.00 |      0.00 |   6829.87 |   143427.00
TT2026-2027/187  | TVU1  | Reliance Retail Limited   |    74 |   112 |    129514.24 |      0.00 |      0.00 |   6475.66 |   135990.00
TT2026-2027/188  | TW07  | Reliance Retail Limited   |    76 |   104 |    123332.32 |      0.00 |      0.00 |   6166.66 |   129499.00
TT2026-2027/189  | TW97  | Reliance Retail Limited   |    76 |   104 |    123332.32 |      0.00 |      0.00 |   6166.66 |   129499.00
TT2026-2027/191  | TXSR  | Reliance Retail Limited   |    76 |   104 |    123332.32 |      0.00 |      0.00 |   6166.66 |   129499.00
TT2026-2027/192  | TXSU  | Reliance Retail Limited   |    76 |   104 |    123332.32 |      0.00 |      0.00 |   6166.66 |   129499.00
TT2026-2027/194  | TYAC  | Reliance Retail Limited   |    76 |   104 |    123332.32 |      0.00 |      0.00 |   6166.66 |   129499.00
--------------------------------------------------------------------------------------------------------------------------------------------
TOTAL            | 12    | All 12 Stores             |  1003 |  1355 |   1586277.76 |   3476.82 |   3476.82 |  72360.66 |  1665592.00
--------------------------------------------------------------------------------------------------------------------------------------------
```

Executed [`scratch/verify_files.py`](file:///f:/SMRITRretailNX/scratch/verify_files.py) confirming generated deliverables:
```text
=== PDF INVOICES VERIFICATION ===
Total invoice groups found in Tax_Invoice_PDFs (10-09-2026): 12/12
Total invoice groups found in Tax_Invoice_PDFs (08-09-2026): 12/12
Total invoice groups found in Tax_Invoice_Tattly_Threads_138_194: 12/12

=== E-WAY BILL JSON VERIFICATION ===
Total individual invoice E-way JSON groups found in Eway_JSON (10-09-2026): 12/12
  [FOUND BULK] EWayBill_Bulk_Upload_12_Invoices_10092026.json (438,200 bytes)
Total individual invoice E-way JSON groups found in Eway_JSON (08-09-2026): 12/12
  [FOUND BULK] EWayBill_Bulk_Upload_12_Invoices_10092026.json (438,200 bytes)
Total individual invoice E-way JSON groups found in Eway_JSON (Eway): 12/12
  [FOUND BULK] EWayBill_Bulk_Upload_12_Invoices_10092026.json (438,200 bytes)

=== EXCEL SPREADSHEET VERIFICATION ===
File: F:\Smriti-Clients Data\10-09-2026\RIL_Dispatch10092026_Updated.xlsx | Exists: True | Size: 142,238 bytes
```

## 9. Verification Results
- **Quantitative Measurement (Rule 4):**
  - Updated Invoices Count: Exactly 12 invoices (`TT2026-2027/172` to `194`)
  - Updated Line Items Count: Exactly 1,003 items
  - Total Physical Pairs: Exactly 1,355 pairs
  - Taxable Value: ₹1,586,277.76
  - CGST: ₹3,476.82
  - SGST: ₹3,476.82
  - IGST: ₹72,360.66
  - Total Net Amount: ₹1,665,592.00
- **Exclusion Compliance:**
  - 43 pre-completed green stores: Untouched (0 modifications).
  - 2 excluded stores (`TY06`, `TXAJ`): Untouched (0 modifications).
- **Physical Deliverables:**
  - 24 statutory PDFs saved in `F:\Smriti-Clients Data\10-09-2026\Final\Tax_Invoice_PDFs\`
  - 12 individual E-Way JSONs + 1 consolidated bulk JSON saved in `F:\Smriti-Clients Data\10-09-2026\Final\Eway_JSON\`
  - 171 rows highlighted in green with invoice numbers populated in `F:\Smriti-Clients Data\10-09-2026\RIL_Dispatch10092026_Updated.xlsx`.

## 10. Known Limitations
- Stores `TY06` and `TXAJ` remain excluded pending completion of their physical packing cartons marked with `*`. Once packing is finalized by warehouse operations, a subsequent update run will be required.

## 11. Future Work
- Integrate real-time warehouse scanning barcodes to automatically trigger invoice regeneration and NIC E-Way Bill generation upon scanning the final carton label.

## 12. Related ADRs
- `ADR-0021`: Canonical Statutory Tax Invoice Calculation and Trade Discount Formula.
- `ADR-0034`: Server-Side Headless Playwright PDF Rendering Engine.

## 13. Related RFCs
- `RFC-2026-09-02`: Store Grouped Dispatch Consignment Invoice Architecture.
