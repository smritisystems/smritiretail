<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 5.6.0
  Created      : 2026-09-14
  Modified     : 2026-09-14
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Canonical Dispatch Walkthrough
-->

# Walkthrough: Generation of 3 Statutory GST Tax Invoices for Reliance Retail (West Bengal DC Dispatch - PO 5182778172)

## 1. Purpose
Generate 3 statutory GST Tax Invoices dated **05-09-2026** (`2026-09-05`) for **Reliance Retail Limited** corresponding to the 3 retail stores (`TDK9`, `TKI4`, `TYAL`) present in sheet `'14-09-2026'` of `F:\Smriti-Clients Data\14-09-2026\RIL_Dispatch14-09-2026.xlsx`, consolidated to the single **West Bengal DC Dispatch** shipping address under **PO NO.: 5182778172** (`TA0A`, Sankrail DC, West Bengal).

## 2. Scope
- **Source Sheet:** Sheet `'14-09-2026'` in `F:\Smriti-Clients Data\14-09-2026\RIL_Dispatch14-09-2026.xlsx` (111 rows).
- **Statutory Date:** `05-09-2026` (`2026-09-05`).
- **Sequential Invoices:** `TT2026-2027/195`, `TT2026-2027/196`, `TT2026-2027/197`.
- **Target Recipient:** Reliance Retail Limited, Salt Lake Sector-V, Kolkata (GSTIN: `19AABCR1718E1ZM`).
- **Delivery Address:** Distribution Center, RRL DAG No 248-250, Mouza Surakahalli, PS Uluberia, Panchla Block, Sankrail, West Bengal - 711310 (Site: `TA0A`, GSTIN: `19AABCR1718E1ZM`).
- **Supplier:** TATTLY THREADS, Mumbai / Nagpur Depot (`27AAXFT2508H1ZR`).
- **Outputs:** Database records in PostgreSQL `smriti001`, updated source Excel, 3 pixel-faithful A4 PDF invoices via Playwright, individual & bulk NIC E-Way Bill JSON payloads, and client summary matrix workbook.

## 3. Files Created
- `backend/scripts/generate_ril_dispatch_14092026_invoices.py`
- `F:\Smriti-Clients Data\14-09-2026\Final_Invoices\Tax_Invoice_PDFs\TDK9_5182778172_TT2026-2027_195.pdf`
- `F:\Smriti-Clients Data\14-09-2026\Final_Invoices\Tax_Invoice_PDFs\TKI4_5182778172_TT2026-2027_196.pdf`
- `F:\Smriti-Clients Data\14-09-2026\Final_Invoices\Tax_Invoice_PDFs\TYAL_5182778172_TT2026-2027_197.pdf`
- `F:\Smriti-Clients Data\14-09-2026\Invoices_Store_PO_Invoice\TDK9_5182778172_TT2026-2027_195.pdf`
- `F:\Smriti-Clients Data\14-09-2026\Invoices_Store_PO_Invoice\TKI4_5182778172_TT2026-2027_196.pdf`
- `F:\Smriti-Clients Data\14-09-2026\Invoices_Store_PO_Invoice\TYAL_5182778172_TT2026-2027_197.pdf`
- `F:\Smriti-Clients Data\14-09-2026\Final_Invoices\Eway_JSON\TT2026-2027_195_Eway.json`
- `F:\Smriti-Clients Data\14-09-2026\Final_Invoices\Eway_JSON\TT2026-2027_196_Eway.json`
- `F:\Smriti-Clients Data\14-09-2026\Final_Invoices\Eway_JSON\TT2026-2027_197_Eway.json`
- `F:\Smriti-Clients Data\14-09-2026\Final_Invoices\EWayBill_Bulk_Upload_14092026_WB_DC.json`
- `F:\Smriti-Clients Data\Eway\Final_14092026\EWayBill_Bulk_Upload_14092026_WB_DC.json`
- `F:\Smriti-Clients Data\14-09-2026\Final_Invoices\Tax_Invoice_Summary_14-09-2026.xlsx`
- `F:\Smriti-Clients Data\14-09-2026\Final_Invoices\RIL_Dispatch14-09-2026_Invoiced.xlsx`
- `docs/walkthrough/sales/Sales_Dispatch_WB_DC_Invoices_v5.6.0.md`

## 4. Files Modified
- `F:\Smriti-Clients Data\14-09-2026\RIL_Dispatch14-09-2026.xlsx` (Sheet `'14-09-2026'`: Columns M, N, O, P populated with Invoice details, Invoice Date, PO Number, and Dispatch From).

## 5. Architecture Decisions
- **PO 5182778172 Consolidation:** All 3 store allocations are billed and shipped to the centralized West Bengal DC (`TA0A`, Sankrail DC, West Bengal) per user directive and PO contract terms, while preserving store-level SIS allocations (`TDK9`, `TKI4`, `TYAL`) in snapshots and line item metadata.
- **Interstate IGST 5% Taxation:** Origin is Nagpur Depot, Maharashtra (`27`) and Destination is Sankrail, West Bengal (`19`). IGST of 5% is strictly levied with zero CGST/SGST.
- **Commercial Pricing Formula:** Basic unit rate is computed via `round(MRP * 0.5624, 2)` (43.76% promotional discount on MRP), ensuring exact parity with PO line item base costs.

## 6. Design Rationale
- Dual output of PDFs into both `Tax_Invoice_PDFs` and `Invoices_Store_PO_Invoice` guarantees backward compatibility with automated client billing scanners.
- Bulk E-Way Bill JSON generation simplifies single-click statutory portal compliance for transport clearance.
- Source spreadsheet modification ensures audit trail alignment between client dispatch manifests and issued tax invoices.

## 7. Implementation Summary
| Parameter | TDK9 | TKI4 | TYAL | Total |
| :--- | :--- | :--- | :--- | :--- |
| **Invoice No** | `TT2026-2027/195` | `TT2026-2027/196` | `TT2026-2027/197` | 3 Invoices |
| **Store Name** | Cuttack - SIS | Ideal Regency | RRL FIF CITI MART KO | 3 Stores |
| **PO Reference** | `5182778172` | `5182778172` | `5182778172` | `5182778172` |
| **Delivery Site** | `TA0A` | `TA0A` | `TA0A` | `TA0A` |
| **Total Pairs** | 281 | 296 | 301 | 878 |
| **Gross MRP** | ₹572,619.00 | ₹610,104.00 | ₹619,599.00 | ₹1,802,322.00 |
| **Taxable Value** | ₹322,041.60 | ₹343,123.20 | ₹348,463.20 | ₹1,013,628.00 |
| **IGST (5%)** | ₹16,102.09 | ₹17,156.14 | ₹17,423.14 | ₹50,681.37 |
| **Round Adj** | +₹0.31 | -₹0.34 | -₹0.34 | -₹0.37 |
| **Grand Total** | ₹338,144.00 | ₹360,279.00 | ₹365,886.00 | ₹1,064,309.00 |

## 8. Tests Executed
- Syntax compilation via `python -m py_compile backend/scripts/generate_ril_dispatch_14092026_invoices.py`.
- Full end-to-end execution of pipeline script `generate_ril_dispatch_14092026_invoices.py`.
- SQL database parity check joining `sales_invoices` and `sales_invoice_items` for 100% mathematical reconciliation.
- Disk verification of PDF files, E-Way Bill JSON schemas, and Excel spreadsheet columns.

## 9. Verification Results
- Database insertion: 3 invoices and 589 unpivoted line items verified in PostgreSQL `smriti001`.
- PDF generation: 3 files rendered (415 KB each, 7 pages per document, valid A4 format, all tables, DISPATCH FROM header, and signatures rendered).
- E-Way Bill JSON: Schema version `1.0.1118`, 3 valid payloads matching invoice, dispatch origin (Nagpur Depot 440029), and delivery addresses.
- Excel manifest: Columns 13, 14, 15, 16 (Invoice details, Invoice Date, PO Number, Dispatch From) populated across all 111 rows in `RIL_Dispatch14-09-2026.xlsx`.

## 10. Known Limitations
- Transporter details (Transporter ID, Transporter Name, Vehicle Number) remain blank pending courier assignment; can be filled during Part-B generation.

## 11. Future Work
- Direct NIC API integration for automated Part-A generation without manual JSON file upload.

## 12. Related ADRs
- `ADR-0042`: Canonical Invoice Storage and Playwright-Based Tax Invoice PDF Rendering.
- `ADR-0051`: NIC E-Way Bill Schema v1.0.1118 Payloads Architecture.

## 13. Related RFCs
- `RFC-2026-0814-TAX-INV-A4`: Golden Standard for Footwear B2B Tax Invoices.
