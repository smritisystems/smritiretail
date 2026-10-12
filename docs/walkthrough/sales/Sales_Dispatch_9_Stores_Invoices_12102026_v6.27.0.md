<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.27.0
  Created      : 2026-10-12
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Canonical Dispatch Invoicing & Statutory Governance
-->

# Sales Walkthrough: Generation of 9 Statutory GST Tax Invoices for Reliance Retail (TATTLY_THREADS_INDENT_FORMATTED (1).xlsx) (v6.27.0)

**Walkthrough Version:** v6.27.0  
**Release Milestone:** Milestone 6.27.0 / Commercial Dispatch Invoicing Gateway  
**Date:** 2026-10-12  
**Author:** Jawahar Ramkripal Mallah (Chief Systems Architect & Creator)  
**Classification:** Canonical Commercial Dispatch Invoicing  

---

## 1. Purpose
This release executes statutory commercial dispatch billing for `F:\Smriti-Clients Data\Tattly Threads\12-10-2026\TATTLY_THREADS_INDENT_FORMATTED (1).xlsx` for **Reliance Retail Limited**. Continuing the verified sequential invoice series from `TT2026-2027/286`, it establishes store-specific direct billing and delivery for 9 retail stores across Assam, Tripura, Karnataka, and West Bengal (`TT2026-2027/287` through `TT2026-2027/295`). Per client requirement, all invoices in this dispatch run are generated **strictly without PO / Reference** (PO Number and PO Date omitted / left blank on physical invoices, database headers, and filenames). All tax invoices are dated `12-10-2026` (`2026-10-12`), apply the standard 43.76% promotional wholesale discount on MRP (`unit_rate = round(mrp * 0.5624, 2)`), resolve 100% of footwear barcodes from vendor purchases (`ALL VENDOR PURCHASE FOR SOFTWARE.xlsx`) and item masters (`TATTLY THREADS ITEM MASTER 2026 - Copyfinal2.xlsx`), enforce GST Section 15 tax rules (Interstate IGST 5.00%), generate high-resolution A4 vector tax invoice PDFs via Playwright, generate Government of India (NIC v1.0.1118) E-Way Bill JSON payloads, and generate two-tab Client Summary Excel matrix workbooks.

---

## 2. Scope
1. **Spreadsheet Ingestion & Unpivoting:** Ingest indent matrix from `Indent Matrix` in `F:\Smriti-Clients Data\Tattly Threads\12-10-2026\TATTLY_THREADS_INDENT_FORMATTED (1).xlsx`, unpivoting 7 size columns (36–42) across 9 stores into exactly 254 line items and 441 pairs.
2. **Barcode Resolution:** Resolve barcodes and article specs for all 254 items by cross-referencing vendor purchases (`ALL VENDOR PURCHASE FOR SOFTWARE.xlsx`) and canonical master catalog (`TATTLY THREADS ITEM MASTER 2026 - Copyfinal2.xlsx`).
3. **Store Mapping Without PO / Reference:** Map all 9 stores to registered delivery and shipping addresses with PO Reference and PO Date explicitly omitted / left empty per client instruction.
4. **Database Staging:** Insert 9 sales invoices (`TT2026-2027/287` to `TT2026-2027/295` with `po_reference = None`), 254 line items, and 9 canonical E-Way Bill records into PostgreSQL tables `smriti001.sales_invoices`, `smriti001.sales_invoice_items`, and `smriti001.eway_bills`.
5. **Vector A4 PDF Invoices:** Render 9 statutory vector A4 tax invoices using Playwright and `InvoicePdfService`, writing cleanly formatted filenames (`{store_code}_{invoice_clean_no}.pdf`) to both `Final_Invoices/Tax_Invoice_PDFs` and mirror directory `Invoices_Store_PO_Invoice`.
6. **NIC Statutory E-Way Bill Payloads:** Generate 9 individual store JSONs and 1 consolidated bulk upload JSON (`EWayBill_Bulk_Upload_12102026.json`) adhering strictly to NIC schema v1.0.1118 with statutory combination movement (`transType: 4`).
7. **Client Audit Matrix & Invoiced Indent Copy:** Generate multi-tab client summary workbook `Tax_Invoice_Summary_12-10-2026.xlsx` and green-annotated client indent workbook `TATTLY_THREADS_INDENT_FORMATTED_Invoiced.xlsx`.

---

## 3. Files Created
1. `backend/scripts/generate_ril_dispatch_12102026_invoices.py` — Authoritative end-to-end pipeline script orchestrating unpivoting, DB insertion, Playwright PDF rendering, NIC JSON export, and Excel matrix generation.
2. `docs/walkthrough/sales/Sales_Dispatch_9_Stores_Invoices_12102026_v6.27.0.md` — This formal walkthrough document.
3. `docs/implementation/sales/Sales_Dispatch_9_Stores_Invoices_12102026_Plan_v6.27.0.md` — Formal implementation plan.

---

## 4. Files Modified
1. `docs/walkthrough/README.md` — Updated master walkthrough index.
2. `docs/implementation/README.md` — Updated master implementation index.
3. `CHANGELOG.md` — Documented release notes for v6.27.0.

---

## 5. Architecture Decisions
1. **Omission of PO Reference / PO Date:** As explicitly mandated by the client, PO / Reference fields are suppressed/empty across invoice headers, PDF presentation, database columns, and PDF filenames.
2. **Store-Specific Direct Billing & Delivery:** Each store is billed and shipped directly to its registered site address.
3. **Sequential Numbering Continuity:** Allocated sequential document numbers `TT2026-2027/287` through `TT2026-2027/295`, maintaining continuous statutory sequence following `TT2026-2027/286`.
4. **Statutory Pricing Formula:** Used `unit_rate = round(MRP * 0.5624, 2)` representing a 43.76% promotional wholesale discount from MRP, with 5% IGST on taxable value for interstate dispatches.
5. **Dual-Folder Delivery Artifacts:** Generated outputs in `12-10-2026/Final_Invoices` and `12-10-2026/Invoices_Store_PO_Invoice` and mirrored NIC E-Way Bill payloads to `F:\Smriti-Clients Data\Eway\Final_12102026`.

---

## 6. Design Rationale
- **Traceability:** Embedding `source_line_type: "INDENT_DISPATCH_IMPORT"` and `source_line_id: "<STORE>:<ROW>:<SIZE>"` ensures full end-to-end auditability from raw spreadsheet cells to GL postings.
- **Fail-Safe File Operations:** By detecting `PermissionError` when files are open in Excel or PDF viewers and automatically saving `_Updated.xlsx` / `_Clean.pdf`, the pipeline prevents data corruption without interrupting generation.

---

## 7. Implementation Summary

### Stores and Invoices Table

| Sr | Invoice No | Date | Store Code | Site Name | State | GSTIN | PO Reference | Pairs | Gross MRP (₹) | Taxable Value (₹) | IGST 5% (₹) | Grand Total (₹) |
|:---|:---|:---:|:---|:---|:---|:---|:---:|:---:|:---:|:---:|:---:|:---:|
| 1 | `TT2026-2027/287` | 12-10-2026 | `1888` | RRL FOOTPRINT RKB PATH DIBRUGARH AS | ASSAM | `18AABCR1718E1ZO` | *None* | 45 | 1,06,955.00 | 60,151.60 | 3,007.55 | 63,159.00 |
| 2 | `TT2026-2027/288` | 12-10-2026 | `1969` | RRL FOOTPRINT FORTUNE CENTRAL GUWAH | ASSAM | `18AABCR1718E1ZO` | *None* | 43 | 1,02,757.00 | 57,790.64 | 2,889.49 | 60,680.00 |
| 3 | `TT2026-2027/289` | 12-10-2026 | `9556` | RRL FT CITY CENTRE AGARTALA | TRIPURA | `16AABCR1718E1ZS` | *None* | 63 | 1,42,337.00 | 80,050.48 | 4,002.49 | 84,053.00 |
| 4 | `TT2026-2027/290` | 12-10-2026 | `T51H` | RRL TFW Bangalore KR Puram | KARNATAKA | `29AABCR1718E1ZL` | *None* | 48 | 1,12,752.00 | 63,411.84 | 3,170.55 | 66,582.00 |
| 5 | `TT2026-2027/291` | 12-10-2026 | `TAGG` | RRL TRENDS FOOTWEAR IMPERIAL HEIGHTS | TRIPURA | `16AABCR1718E1ZS` | *None* | 49 | 1,12,651.00 | 63,355.04 | 3,167.69 | 66,523.00 |
| 6 | `TT2026-2027/292` | 12-10-2026 | `TKL0` | BARRACKPORE | WEST BENGAL | `19AABCR1718E1ZM` | *None* | 66 | 1,50,834.00 | 84,829.20 | 4,241.43 | 89,071.00 |
| 7 | `TT2026-2027/293` | 12-10-2026 | `TPV2` | RRL TF SEVOKE ROAD S | WEST BENGAL | `19AABCR1718E1ZM` | *None* | 44 | 1,03,456.00 | 58,183.76 | 2,909.15 | 61,093.00 |
| 8 | `TT2026-2027/294` | 12-10-2026 | `TUA7` | RRL TF STAR MALL MAD | WEST BENGAL | `19AABCR1718E1ZM` | *None* | 38 | 92,862.00 | 52,225.68 | 2,611.25 | 54,837.00 |
| 9 | `TT2026-2027/295` | 12-10-2026 | `TV81` | STAR CITY MALL GUWA | ASSAM | `18AABCR1718E1ZO` | *None* | 45 | 1,06,455.00 | 59,870.40 | 2,993.49 | 62,864.00 |
| **TOTAL** | **9 Invoices** | | **9 Stores** | | | | | **441** | **10,31,059.00** | **5,79,868.64** | **28,993.09** | **6,08,862.00** |

---

## 8. Tests Executed
1. `backend/scripts/generate_ril_dispatch_12102026_invoices.py` — Complete pipeline execution.
2. `scratch/verify_output_12102026.py` — Database integrity, PDF rendering verification, E-Way Bill schema parity, and Excel summary reconciliation suite.
3. `python -m py_compile backend/scripts/generate_ril_dispatch_12102026_invoices.py` — Python compilation verification.

---

## 9. Verification Results
```text
=== VERIFYING 12-10-2026 DISPATCH INVOICES ===

[1] sales_invoices DB Records Found: 9 / 9
  TT2026-2027/287 | Store: 1888 | PO: None | Taxable: Rs 60,151.60 | Tax: Rs 3,007.55 | Total: Rs 63,159.00 | Date: 2026-10-12
  TT2026-2027/288 | Store: 1969 | PO: None | Taxable: Rs 57,790.64 | Tax: Rs 2,889.49 | Total: Rs 60,680.00 | Date: 2026-10-12
  TT2026-2027/289 | Store: 9556 | PO: None | Taxable: Rs 80,050.48 | Tax: Rs 4,002.49 | Total: Rs 84,053.00 | Date: 2026-10-12
  TT2026-2027/290 | Store: T51H | PO: None | Taxable: Rs 63,411.84 | Tax: Rs 3,170.55 | Total: Rs 66,582.00 | Date: 2026-10-12
  TT2026-2027/291 | Store: TAGG | PO: None | Taxable: Rs 63,355.04 | Tax: Rs 3,167.69 | Total: Rs 66,523.00 | Date: 2026-10-12
  TT2026-2027/292 | Store: TKL0 | PO: None | Taxable: Rs 84,829.20 | Tax: Rs 4,241.43 | Total: Rs 89,071.00 | Date: 2026-10-12
  TT2026-2027/293 | Store: TPV2 | PO: None | Taxable: Rs 58,183.76 | Tax: Rs 2,909.15 | Total: Rs 61,093.00 | Date: 2026-10-12
  TT2026-2027/294 | Store: TUA7 | PO: None | Taxable: Rs 52,225.68 | Tax: Rs 2,611.25 | Total: Rs 54,837.00 | Date: 2026-10-12
  TT2026-2027/295 | Store: TV81 | PO: None | Taxable: Rs 59,870.40 | Tax: Rs 2,993.49 | Total: Rs 62,864.00 | Date: 2026-10-12
  Total Grand Total across DB invoices: Rs 608,862.00

[2] sales_invoice_items DB Rows Found: 254
[3] eway_bills DB Records Found: 9 / 9

[4] PDF Files in Final_Invoices/Tax_Invoice_PDFs:
  1888_TT2026-2027_287.pdf (1,075,791 bytes)
  1969_TT2026-2027_288.pdf (1,076,563 bytes)
  9556_TT2026-2027_289.pdf (1,088,136 bytes)
  T51H_TT2026-2027_290.pdf (1,080,823 bytes)
  TAGG_TT2026-2027_291.pdf (1,079,997 bytes)
  TKL0_TT2026-2027_292.pdf (1,088,427 bytes)
  TPV2_TT2026-2027_293.pdf (1,076,870 bytes)
  TUA7_TT2026-2027_294.pdf (1,076,625 bytes)
  TV81_TT2026-2027_295.pdf (1,078,936 bytes)
  Total PDFs: 9 / 9

[5] PDF Files in Invoices_Store_PO_Invoice:
  Total Mirror PDFs: 9 / 9

[6] E-Way JSON Files:
  Total JSON files: 10 (including bulk upload)

[7] Summary Excel Workbook:
  Workbook exists: F:\Smriti-Clients Data\Tattly Threads\12-10-2026\Tax_Invoice_Summary_12-10-2026.xlsx
  Sheets: ['Tax_Invoice_Summary', 'All_Items_Consolidated']
  Sheet 1 Rows: 11, Cols: 18
  Sheet 2 Rows: 255, Cols: 21

[8] Invoiced Indent Copy:
  Workbook exists: F:\Smriti-Clients Data\Tattly Threads\12-10-2026\TATTLY_THREADS_INDENT_FORMATTED_Invoiced.xlsx
  Sheets: ['Indent Matrix', 'Store Breakdown']

ALL VERIFICATION CHECKS PASSED WITH 100% PARITY!
```

---

## 10. Known Limitations
- E-Way Bill numbers on physical PDFs remain blank until government NIC portal generation returns official 12-digit E-Way Bill numbers.
- Vehicle registration numbers default to regular transport mode pending transporter allotment.

---

## 11. Future Work
- Integration with direct NIC E-Way Bill GSP API for real-time one-click generation and QR code embedding.

---

## 12. Related ADRs
- `ADR-038`: Store-Specific Direct Billing and Dispatch Governance.
- `ADR-041`: NIC E-Way Bill Schema v1.0.1118 Compliance Standard.

---

## 13. Related RFCs
- `RFC-089`: High-Resolution Headless Playwright PDF Invoicing Engine.
