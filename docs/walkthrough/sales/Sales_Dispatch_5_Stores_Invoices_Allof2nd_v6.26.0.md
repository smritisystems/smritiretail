<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.26.0
  Created      : 2026-09-16
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Canonical Dispatch Invoice Engine (Sheet 16-09-26(2) - 5 Stores Allof2nd)
-->

# Generation of 5 Statutory GST Tax Invoices for Reliance Retail (RIL_Dispatch1_16092026_Allof2nd.xlsx)

## 1. Purpose
This walkthrough documents the end-to-end processing and generation of 5 statutory GST Tax Invoices (`TT2026-2027/250` through `TT2026-2027/254`) on invoice date **05-Sep-2026** (`2026-09-05`) for Reliance Retail Limited from Sheet `16-09-26(2)` of [`F:\Smriti-Clients Data\16-09-2026\RIL_Dispatch1_16092026_Allof2nd.xlsx`](file:///F:/Smriti-Clients%20Data/16-09-2026/RIL_Dispatch1_16092026_Allof2nd.xlsx).

## 2. Scope
- Processing 32 matrix data rows across 5 distinct Reliance Retail store destinations:
  1. `TXAJ` — RRL TRENDS FOOTWEAR PALAVAKKAM, Chennai, Tamil Nadu (PO `5182778205`) -> `TT2026-2027/250`
  2. `TW07` — RRL FOOTPRINT Tumkur NDC, Tumkur, Karnataka (PO `5182778158`) -> `TT2026-2027/251`
  3. `TW97` — AS RAO NAGAR, Hyderabad, Telangana (PO `5182778204`) -> `TT2026-2027/252`
  4. `TXSR` — RRL FIF HYDERABAD SU, Hyderabad, Telangana (PO `5182778206`) -> `TT2026-2027/253`
  5. `TXSU` — RRL FIF BANGALORE KR, Bangalore, Karnataka (PO `5182778207`) -> `TT2026-2027/254`
- Unpivoting size columns (36 to 42) into 185 line items representing 249 physical footwear pairs.
- Financial Totals:
  - Total Pairs: 249 PRS
  - Gross MRP: ₹535,051.00
  - Taxable Value: ₹300,913.28
  - 5% IGST: ₹15,045.51
  - Net Invoiced Value: ₹315,958.00
- Persistent storage in PostgreSQL database `smriti001`: `sales_invoices`, `sales_invoice_items`, `eway_bills`.
- Statutory PDF Invoices rendered via Playwright A4 format.
- Statutory E-Way Bill JSON generation (NIC v1.0.1118) for individual and bulk upload.
- Comprehensive 2-tab summary matrix Excel generation.
- Dispatch sheet Columns M, N, O, P population with green fill (`#FF92D050`).

## 3. Files Created
1. `backend/scripts/generate_ril_dispatch_16092026_2nd_invoices.py`: Automated pipeline script.
2. `docs/walkthrough/sales/Sales_Dispatch_5_Stores_Invoices_Allof2nd_v6.26.0.md`: This WGP documentation.
3. `F:\Smriti-Clients Data\16-09-2026\Final_Invoices\Tax_Invoice_PDFs\`:
   - `TXAJ_5182778205_TT2026-2027_250.pdf` (354,496 bytes)
   - `TW07_5182778158_TT2026-2027_251.pdf` (360,170 bytes)
   - `TW97_5182778204_TT2026-2027_252.pdf` (359,679 bytes)
   - `TXSR_5182778206_TT2026-2027_253.pdf` (353,536 bytes)
   - `TXSU_5182778207_TT2026-2027_254.pdf` (354,061 bytes)
4. `F:\Smriti-Clients Data\16-09-2026\Final_Invoices\Eway_JSON\`:
   - `TT2026-2027_250_Eway.json`
   - `TT2026-2027_251_Eway.json`
   - `TT2026-2027_252_Eway.json`
   - `TT2026-2027_253_Eway.json`
   - `TT2026-2027_254_Eway.json`
   - `EWayBill_Bulk_Upload_16092026_2nd.json`
5. `F:\Smriti-Clients Data\16-09-2026\Final_Invoices\Tax_Invoice_Summary_16-09-2026_2nd.xlsx`: Two-sheet summary matrix.
6. `F:\Smriti-Clients Data\16-09-2026\RIL_Dispatch1_16092026_Allof2nd_Updated.xlsx`: Invoiced spreadsheet with green fill.
7. `F:\Smriti-Clients Data\16-09-2026\Final_Invoices\RIL_Dispatch1_16092026_Allof2nd_Invoiced.xlsx`: Preserved copy.

## 4. Files Modified
1. `docs/walkthrough/README.md`: Added v6.26.0 entry to master index table.
2. `CHANGELOG.md`: Appended entry for v6.26.0.

## 5. Architecture Decisions
- **ADR-DISPATCH-09: Sequence Continuation Beyond Batch 1:** Invoices `TT2026-2027/231` through `249` covered Batch 1 (19 stores). Batch 2 cleanly continues the serial invoice sequence starting at `TT2026-2027/250` up to `254`.
- **ADR-DISPATCH-10: Decoupled Physical Logistics Architecture:** Dispatch origin is pinned to `Tattly Threads (Nagpur Depot)` (`440029`, Maharashtra `27`), while billing legal entity remains `Tattly Threads` (`27AAXFT2508H1ZR`). All 5 stores are interstate (Tamil Nadu `33`, Karnataka `29`, Telangana `36`) with 5.00% IGST.

## 6. Design Rationale
Commercial wholesale supply contracts require exact price derivation from MRP using the standardized contractual formula `unit_rate = round(mrp * 0.5624, 2)` (43.76% trade discount). Individual pair unpivoting guarantees audit parity between physical warehouse cartons, database line items, and statutory GST e-filing payloads.

## 7. Implementation Summary
| Store Code | Site Name | State | PO Number | Invoice No | Pairs | Gross MRP (₹) | Taxable (₹) | 5% IGST (₹) | Grand Total (₹) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `TXAJ` | RRL TRENDS FOOTWEAR PALAVAKKAM | Tamil Nadu (33) | `5182778205` | `TT2026-2027/250` | 40 | 87,160.00 | 49,018.88 | 2,450.96 | 51,470.00 |
| `TW07` | RRL FOOTPRINT Tumkur NDC | Karnataka (29) | `5182778158` | `TT2026-2027/251` | 55 | 118,245.00 | 66,501.12 | 3,325.01 | 69,826.00 |
| `TW97` | AS RAO NAGAR | Telangana (36) | `5182778204` | `TT2026-2027/252` | 55 | 118,245.00 | 66,501.12 | 3,325.01 | 69,826.00 |
| `TXSR` | RRL FIF HYDERABAD SU | Telangana (36) | `5182778206` | `TT2026-2027/253` | 53 | 114,447.00 | 64,365.12 | 3,218.21 | 67,583.00 |
| `TXSU` | RRL FIF BANGALORE KR | Karnataka (29) | `5182778207` | `TT2026-2027/254` | 46 | 96,954.00 | 54,527.04 | 2,726.32 | 57,253.00 |
| **TOTAL**| **5 STORES** | — | — | — | **249** | **535,051.00** | **300,913.28** | **15,045.51** | **315,958.00** |

## 8. Tests Executed
1. `python -m py_compile backend/scripts/generate_ril_dispatch_16092026_2nd_invoices.py`
2. `python backend/scripts/generate_ril_dispatch_16092026_2nd_invoices.py`
3. `python verify_2nd_batch.py` (Database, Line Items, E-Way bills, PDF, JSON, and Excel verification)

## 9. Verification Results
- Database `sales_invoices`: 5 records created with status `POSTED`.
- Database `sales_invoice_items`: 185 line items matching exactly 249 pairs and ₹300,913.28 taxable total.
- Database `eway_bills`: 5 canonical records created with status `PENDING_UPLOAD`.
- A4 PDF Tax Invoices: 5 PDFs generated, verified on disk with sizes 353 KB to 360 KB.
- E-Way Bill JSON: 5 individual files + 1 consolidated bulk upload JSON generated.
- Excel Column M, N, O, P updated with `#FF92D050` green fill.

## 10. Known Limitations
None. All 5 stores have 100% complete metadata and verified master profiles.

## 11. Future Work
Upload `EWayBill_Bulk_Upload_16092026_2nd.json` to the Government of India NIC E-Way Bill portal to obtain statutory 12-digit E-Way Bill numbers.

## 12. Related ADRs
- `ADR-DISPATCH-09`: Continuation of consecutive invoice serial numbers for multi-batch dispatches.
- `ADR-DISPATCH-10`: Decoupled Physical Depot and Billing Origin Logistics Standard.

## 13. Related RFCs
- `RFC-EWAY-2026`: NIC v1.0.1118 Multi-State Consignment Movement Standard.
