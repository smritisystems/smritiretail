<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.24.0
  Created      : 2026-09-15
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Canonical Dispatch Invoicing & Statutory Governance
-->

# Sales Walkthrough: Generation of 16 Statutory GST Tax Invoices for Reliance Retail (Sheet '15-09-2026-1' in RIL_Dispatch15092026-2.xlsx) (v6.24.0)

**Walkthrough Version:** v6.24.0  
**Release Milestone:** Milestone 6.24.0 / Sales & Distribution Dispatch Gateway  
**Date:** 2026-09-15  
**Author:** Jawahar Ramkripal Mallah (Chief Systems Architect & Creator)  
**Classification:** Canonical Commercial Dispatch Invoicing  

---

## 1. Purpose
This release executes statutory commercial dispatch billing for sheet `'15-09-2026-1'` of `F:\Smriti-Clients Data\15-09-2026\RIL_Dispatch15092026-2.xlsx` for **Reliance Retail Limited**. It establishes store-specific direct billing and delivery for 16 retail stores across Karnataka, Tamil Nadu, and Telangana, dates all tax invoices as `05-09-2026` (`2026-09-05`), applies the standard 43.76% promotional wholesale discount on MRP (`unit_rate = round(mrp * 0.5624, 2)`), enforces GST Section 15 tax rules (Interstate IGST 5.00%), keeps E-Way Bill fields strictly blank pending official NIC portal generation, generates 100% compliant Government of India (NIC v1.0.1118) E-Way Bill JSON payloads, creates two-tab Client Summary Excel matrix workbooks, and highlights client dispatch records in green.

---

## 2. Scope
1. **Spreadsheet Ingestion & Unpivoting:** Ingest 144 rows from sheet `'15-09-2026-1'` of `F:\Smriti-Clients Data\15-09-2026\RIL_Dispatch15092026-2.xlsx`, unpivoting 7 size categories (36–42) across 16 stores into 828 line items and exactly 1,116 pairs.
2. **Master PO & Store Mapping:** Map all 16 stores to individual PO references and billing/shipping addresses from the Reliance Retail Master 60 PO register and `smriti001.sales_invoices` (resolving `T91M` / `T9IM` to PO `5182778170`).
3. **Database Staging:** Insert 16 sales invoices (`TT2026-2027/215` to `TT2026-2027/230`), 828 line items, and 16 canonical E-Way Bill records into PostgreSQL tables `smriti001.sales_invoices`, `smriti001.sales_invoice_items`, and `smriti001.eway_bills`.
4. **Pre-Portal E-Way Bill Governance:** Enforce statutory separation between pre-dispatch invoices and government issuance: keep `sales_invoices.eway_bill_no` as `NULL` and render E-Way Bill fields blank on physical tax invoice PDFs.
5. **NIC Statutory E-Way Bill Payloads:** Generate 16 individual store JSONs and 1 consolidated bulk upload JSON (`EWayBill_Bulk_Upload_15092026_Batch2.json`) adhering strictly to NIC schema v1.0.1118 with statutory combination movement (`transType: 4`).
6. **Client Audit Matrix & Dispatch Marking:** Generate multi-tab client summary workbook `Tax_Invoice_Summary_15-09-2026_Batch2.xlsx` and highlight Columns M, N, O, P green (`#FF92D050`) in `RIL_Dispatch15092026-2_Updated.xlsx` and `RIL_Dispatch15092026-2_Invoiced.xlsx`.

---

## 3. Files Created
1. `backend/scripts/generate_ril_dispatch_15092026_2_invoices.py` — Authoritative end-to-end pipeline script orchestrating unpivoting, DB insertion, Playwright PDF rendering, NIC JSON export, and Excel matrix generation.
2. `docs/walkthrough/sales/Sales_Dispatch_16_Stores_Invoices_v6.24.0.md` — This formal walkthrough document.

---

## 4. Files Modified
1. `docs/walkthrough/README.md` — Updated master walkthrough index.
2. `CHANGELOG.md` — Documented release notes for v6.24.0.

---

## 5. Architecture Decisions
1. **Store-Specific Direct Billing & Delivery:** Rather than consolidating to a central DC, each store is billed and shipped directly to its registered site address under its individual PO from Reliance Retail's master PO register.
2. **Sequential Numbering Continuity:** Allocated sequential document numbers `TT2026-2027/215` through `TT2026-2027/230`, maintaining continuous statutory sequence following `TT2026-2027/214`.
3. **Statutory Pricing Formula:** Used `unit_rate = round(MRP * 0.5624, 2)` representing a 43.76% promotional wholesale discount from MRP, with 5% IGST on taxable value for interstate dispatches.
4. **Dual-Folder Delivery Artifacts:** Generated outputs in both `inv2/Final_Invoices` and `inv2/Invoices_Store_PO_Invoice` and mirrored NIC E-Way Bill payloads to `F:\Smriti-Clients Data\Eway\Final_15092026_Batch2`.

---

## 6. Design Rationale
- **Traceability:** Embedding `source_line_type: "DISPATCH_IMPORT"` and `source_line_id: "<STORE>:<ROW>:<SIZE>"` ensures full end-to-end auditability from raw spreadsheet cells to GL postings.
- **Fail-Safe File Operations:** By detecting `PermissionError` when files are open in Excel or PDF viewers and automatically saving `_Updated.xlsx` / `_Clean.pdf`, the pipeline prevents data corruption without interrupting generation.

---

## 7. Implementation Summary

### Stores and Invoices Table

| Sr | Store Code | Site Name | State | GSTIN | PO Number | Pairs | Gross MRP (₹) | Taxable Value (₹) | IGST 5% (₹) | Grand Total (₹) |
|:---|:---|:---|:---|:---|:---|:---:|:---:|:---:|:---:|:---:|
| 1 | `T25I` | RRL FIF Chennai Express Avenue | TAMIL NADU | `33AABCR1718E1ZW` | 5182778161 | 69 | 1,44,131.00 | 81,059.44 | 4,052.95 | 85,112.00 |
| 2 | `T38X` | RRL FIF Sarjapur Road Bangalor | KARNATAKA | `29AABCR1718E1ZL` | 5182778162 | 69 | 1,44,131.00 | 81,059.44 | 4,052.95 | 85,112.00 |
| 3 | `T40K` | RRL FIF Hessargatta Bangalore | KARNATAKA | `29AABCR1718E1ZL` | 5182778163 | 69 | 1,44,131.00 | 81,059.44 | 4,052.95 | 85,112.00 |
| 4 | `T51H` | RRL TFW Bangalore KR Puram | KARNATAKA | `29AABCR1718E1ZL` | 5182778165 | 69 | 1,44,131.00 | 81,059.44 | 4,052.95 | 85,112.00 |
| 5 | `T91M` | RRL SIS BENGALURU KORAMANGALA | KARNATAKA | `29AABCR1718E1ZL` | 5182778170 | 70 | 1,45,930.00 | 82,071.20 | 4,103.54 | 86,175.00 |
| 6 | `T97D` | RRL SIS Ramagundam | TELANGANA | `36AABCR1718E1ZQ` | 5182778169 | 70 | 1,45,930.00 | 82,071.20 | 4,103.54 | 86,175.00 |
| 7 | `T9SQ` | RRL SIS Hyderabad | TELANGANA | `36AABCR1718E1ZQ` | 5182778171 | 70 | 1,45,930.00 | 82,071.20 | 4,103.54 | 86,175.00 |
| 8 | `TC64` | RRL Footprint Bearys CCM Shimo | KARNATAKA | `29AABCR1718E1ZL` | 5182778176 | 70 | 1,45,930.00 | 82,071.20 | 4,103.54 | 86,175.00 |
| 9 | `TDL9` | RRL FP FIF Kukatpally Telangan | TELANGANA | `36AABCR1718E1ZQ` | 5182778180 | 70 | 1,45,930.00 | 82,071.20 | 4,103.54 | 86,175.00 |
| 10 | `TDM4` | RRL FP FIF Saroornagar Village | TELANGANA | `36AABCR1718E1ZQ` | 5182778181 | 70 | 1,45,930.00 | 82,071.20 | 4,103.54 | 86,175.00 |
| 11 | `TGX1` | RRL FIF Sangareddy | TELANGANA | `36AABCR1718E1ZQ` | 5182778183 | 70 | 1,45,930.00 | 82,071.20 | 4,103.54 | 86,175.00 |
| 12 | `TGX9` | RRL FIF Miyapur Hyderabad | TELANGANA | `36AABCR1718E1ZQ` | 5182778184 | 70 | 1,45,930.00 | 82,071.20 | 4,103.54 | 86,175.00 |
| 13 | `TKF4` | RRL FIF BLR Orion OMR | KARNATAKA | `29AABCR1718E1ZL` | 5182778186 | 70 | 1,45,930.00 | 82,071.20 | 4,103.54 | 86,175.00 |
| 14 | `TKG3` | RRL FIF Banashankari Bangal | KARNATAKA | `29AABCR1718E1ZL` | 5182778187 | 70 | 1,45,930.00 | 82,071.20 | 4,103.54 | 86,175.00 |
| 15 | `TKU6` | RRL FIF Guduvancherry Chenn | TAMIL NADU | `33AABCR1718E1ZW` | 5182778191 | 70 | 1,45,930.00 | 82,071.20 | 4,103.54 | 86,175.00 |
| 16 | `TVP2` | RRL TF Hassan | KARNATAKA | `29AABCR1718E1ZL` | 5182778201 | 70 | 1,45,930.00 | 82,071.20 | 4,103.54 | 86,175.00 |
| **TOTAL** | **16 Stores** | | | | | **1,116** | **23,27,684.00** | **13,09,092.16** | **65,454.28** | **13,74,548.00** |

---

## 8. Tests Executed
1. `backend/scripts/generate_ril_dispatch_15092026_2_invoices.py` — Pipeline execution.
2. `scratch/verify_batch2.py` — 8-point automated regression and integrity suite.
3. `pytest backend/tests/test_bill_prefix.py -v` — Bill prefix and GST Rule 46(b) validation.
4. `python -m py_compile backend/scripts/generate_ril_dispatch_15092026_2_invoices.py` — Python syntax verification.

---

## 9. Verification Results
- **PostgreSQL Database Verification**:
  - `sales_invoices`: 16/16 rows inserted (`TT2026-2027/215` to `TT2026-2027/230`)
  - `sales_invoice_items`: 828/828 unpivoted items inserted, sum of quantity = 1,116 pairs
  - `eway_bills`: 16/16 pre-dispatch staging records created
- **File System Outputs**:
  - 16 Statutory A4 PDFs generated in `F:\Smriti-Clients Data\15-09-2026\inv2\Final_Invoices\Tax_Invoice_PDFs\` (all valid `%PDF-` format, 360 KB - 364 KB each)
  - 16 Mirror PDFs generated in `F:\Smriti-Clients Data\15-09-2026\inv2\Invoices_Store_PO_Invoice\`
  - 16 NIC E-Way Bill JSON payloads in `F:\Smriti-Clients Data\15-09-2026\inv2\Final_Invoices\Eway_JSON\`
  - 1 Consolidated Bulk Upload JSON: `EWayBill_Bulk_Upload_15092026_Batch2.json` (16 bills)
  - 17 JSON files mirrored in `F:\Smriti-Clients Data\Eway\Final_15092026_Batch2\`
  - 1 Multi-tab Excel Summary: `Tax_Invoice_Summary_15-09-2026_Batch2.xlsx` (18 summary rows, 829 consolidated item rows)
  - Source Excel Updated: `RIL_Dispatch15092026-2_Updated.xlsx` and preserved copy `RIL_Dispatch15092026-2_Invoiced.xlsx`

---

## 10. Known Limitations
- The NIC government portal upload requires live credentials; JSON files are staged for upload via the E-Way Bill web portal.
- Physical source spreadsheet `RIL_Dispatch15092026-2.xlsx` was open in Excel during generation; changes were preserved in `RIL_Dispatch15092026-2_Updated.xlsx` and `RIL_Dispatch15092026-2_Invoiced.xlsx`.

---

## 11. Future Work
- Integration with direct NIC GSP/ASP API gateway for headless auto-generation of E-Way Bill numbers upon dispatch confirmation.

---

## 12. Related ADRs
- `ADR-0029`: Statutory Invoicing Pre-Portal E-Way Bill Separation.
- `ADR-0034`: Playwright Headless Engine for Statutory A4 Invoice Generation.

---

## 13. Related RFCs
- `RFC-2026-0812`: Canonical Dispatch Invoicing Engine and Reliance Master PO Reconciler.
