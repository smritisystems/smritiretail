<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.25.0
  Created      : 2026-09-16
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Canonical Dispatch Invoicing & Statutory Governance
-->

# Sales Walkthrough: Generation of 19 Statutory GST Tax Invoices for Reliance Retail (RIL_Dispatch1_16092026_All.xlsx) (v6.25.0)

**Walkthrough Version:** v6.25.0  
**Release Milestone:** Milestone 6.25.0 / Sales & Distribution Dispatch Gateway  
**Date:** 2026-09-16  
**Author:** Jawahar Ramkripal Mallah (Chief Systems Architect & Creator)  
**Classification:** Canonical Commercial Dispatch Invoicing  

---

## 1. Purpose
This release executes statutory commercial dispatch billing for `F:\Smriti-Clients Data\16-09-2026\RIL_Dispatch1_16092026_All.xlsx` for **Reliance Retail Limited**. It establishes store-specific direct billing and delivery for 19 retail stores across Assam, Tripura, Bihar, Jharkhand, West Bengal, Andhra Pradesh, Telangana, and Karnataka. All tax invoices are dated `05-09-2026` (`2026-09-05`), apply the standard 43.76% promotional wholesale discount on MRP (`unit_rate = round(mrp * 0.5624, 2)`), enforce GST Section 15 tax rules (Interstate IGST 5.00%), maintain pre-dispatch E-Way Bill fields blank on physical PDFs pending portal upload, generate 100% compliant Government of India (NIC v1.0.1118) E-Way Bill JSON payloads, generate two-tab Client Summary Excel matrix workbooks, and highlight client dispatch records in green.

---

## 2. Scope
1. **Spreadsheet Ingestion & Unpivoting:** Ingest 114 rows from sheet `Sheet1` of `F:\Smriti-Clients Data\16-09-2026\RIL_Dispatch1_16092026_All.xlsx`, unpivoting 7 size columns (36–42) across 19 stores into 645 line items and exactly 904 pairs.
2. **Master PO & Store Mapping:** Map all 19 stores to individual PO references and registered shipping addresses from the Reliance Retail Master 60 PO register and `smriti001.sales_invoices`.
3. **Database Staging:** Insert 19 sales invoices (`TT2026-2027/231` to `TT2026-2027/249`), 645 line items, and 19 canonical E-Way Bill records into PostgreSQL tables `smriti001.sales_invoices`, `smriti001.sales_invoice_items`, and `smriti001.eway_bills`.
4. **Pre-Portal E-Way Bill Governance:** Enforce statutory separation between pre-dispatch invoices and government issuance: keep `sales_invoices.eway_bill_no` as `NULL` and render E-Way Bill fields blank on physical tax invoice PDFs.
5. **NIC Statutory E-Way Bill Payloads:** Generate 19 individual store JSONs and 1 consolidated bulk upload JSON (`EWayBill_Bulk_Upload_16092026.json`) adhering strictly to NIC schema v1.0.1118 with statutory combination movement (`transType: 4`).
6. **Client Audit Matrix & Dispatch Marking:** Generate multi-tab client summary workbook `Tax_Invoice_Summary_16-09-2026.xlsx` and highlight Columns M, N, O, P green (`#FF92D050`) in `RIL_Dispatch1_16092026_All_Updated.xlsx` and `RIL_Dispatch1_16092026_All_Invoiced.xlsx`.

---

## 3. Files Created
1. `backend/scripts/generate_ril_dispatch_16092026_invoices.py` — Authoritative end-to-end pipeline script orchestrating unpivoting, DB insertion, Playwright PDF rendering, NIC JSON export, and Excel matrix generation.
2. `docs/walkthrough/sales/Sales_Dispatch_19_Stores_Invoices_v6.25.0.md` — This formal walkthrough document.

---

## 4. Files Modified
1. `docs/walkthrough/README.md` — Updated master walkthrough index.
2. `CHANGELOG.md` — Documented release notes for v6.25.0.

---

## 5. Architecture Decisions
1. **Store-Specific Direct Billing & Delivery:** Rather than consolidating to a central DC, each store is billed and shipped directly to its registered site address under its individual PO from Reliance Retail's master PO register.
2. **Sequential Numbering Continuity:** Allocated sequential document numbers `TT2026-2027/231` through `TT2026-2027/249`, maintaining continuous statutory sequence following `TT2026-2027/230`.
3. **Statutory Pricing Formula:** Used `unit_rate = round(MRP * 0.5624, 2)` representing a 43.76% promotional wholesale discount from MRP, with 5% IGST on taxable value for interstate dispatches.
4. **Dual-Folder Delivery Artifacts:** Generated outputs in `16-09-2026/Final_Invoices` and `16-09-2026/Invoices_Store_PO_Invoice` and mirrored NIC E-Way Bill payloads to `F:\Smriti-Clients Data\Eway\Final_16092026`.

---

## 6. Design Rationale
- **Traceability:** Embedding `source_line_type: "DISPATCH_IMPORT"` and `source_line_id: "<STORE>:<ROW>:<SIZE>"` ensures full end-to-end auditability from raw spreadsheet cells to GL postings.
- **Fail-Safe File Operations:** By detecting `PermissionError` when files are open in Excel or PDF viewers and automatically saving `_Updated.xlsx` / `_Clean.pdf`, the pipeline prevents data corruption without interrupting generation.

---

## 7. Implementation Summary

### Stores and Invoices Table

| Sr | Invoice No | Date | Store Code | Site Name | State | GSTIN | PO Number | Pairs | Gross MRP (₹) | Taxable Value (₹) | IGST 5% (₹) | Grand Total (₹) |
|:---|:---|:---:|:---|:---|:---|:---|:---|:---:|:---:|:---:|:---:|:---:|
| 1 | `TT2026-2027/231` | 05-09-2026 | `1888` | RRL FOOTPRINT RKB PATH DIBRUGARH AS | ASSAM | `18AABCR1718E1ZO` | 5182778151 | 40 | 87,160.00 | 49,018.88 | 2,450.96 | 51,470.00 |
| 2 | `TT2026-2027/232` | 05-09-2026 | `1969` | RRL FOOTPRINT FORTUNE CENTRAL GUWAH | ASSAM | `18AABCR1718E1ZO` | 5182778152 | 40 | 87,160.00 | 49,018.88 | 2,450.96 | 51,470.00 |
| 3 | `TT2026-2027/233` | 05-09-2026 | `9556` | RRL FT CITY CENTRE AGARTALA | TRIPURA | `16AABCR1718E1ZS` | 5182778157 | 40 | 87,160.00 | 49,018.88 | 2,450.96 | 51,470.00 |
| 4 | `TT2026-2027/234` | 05-09-2026 | `T40R` | TILKAMANJI | BIHAR | `10AABCR1718E1Z4` | 5182778164 | 40 | 87,160.00 | 49,018.88 | 2,450.96 | 51,470.00 |
| 5 | `TT2026-2027/235` | 05-09-2026 | `T8IY` | RIDDHI SIDDHI COMPLEX | JHARKHAND | `20AABCR1718E1Z3` | 5182778168 | 40 | 87,160.00 | 49,018.88 | 2,450.96 | 51,470.00 |
| 6 | `TT2026-2027/236` | 05-09-2026 | `TAGG` | RRL TRENDS FOOTWEAR IMPERIAL HEIGHTS | TRIPURA | `16AABCR1718E1ZS` | 5182778173 | 40 | 87,160.00 | 49,018.88 | 2,450.96 | 51,470.00 |
| 7 | `TT2026-2027/237` | 05-09-2026 | `TKL0` | BARRACKPORE | WEST BENGAL | `19AABCR1718E1ZM` | 5182778189 | 40 | 87,160.00 | 49,018.88 | 2,450.96 | 51,470.00 |
| 8 | `TT2026-2027/238` | 05-09-2026 | `TPV2` | RRL TF SEVOKE ROAD S | WEST BENGAL | `19AABCR1718E1ZM` | 5182778195 | 40 | 87,160.00 | 49,018.88 | 2,450.96 | 51,470.00 |
| 9 | `TT2026-2027/239` | 05-09-2026 | `TUB7` | RRL TF BHATTA BAZAAR | BIHAR | `10AABCR1718E1Z4` | 5182778197 | 40 | 87,160.00 | 49,018.88 | 2,450.96 | 51,470.00 |
| 10 | `TT2026-2027/240` | 05-09-2026 | `TV81` | STAR CITY MALL GUWA | ASSAM | `18AABCR1718E1ZO` | 5182778199 | 40 | 87,160.00 | 49,018.88 | 2,450.96 | 51,470.00 |
| 11 | `TT2026-2027/241` | 05-09-2026 | `TVU1` | RRL FIF HAJIPUR | BIHAR | `10AABCR1718E1Z4` | 5182778203 | 40 | 87,160.00 | 49,018.88 | 2,450.96 | 51,470.00 |
| 12 | `TT2026-2027/242` | 05-09-2026 | `TUK5` | RRL TF CMR MALL | ANDHRA PRADESH | `37AABCR1718E1ZO` | 5182778198 | 72 | 1,49,528.00 | 84,094.72 | 4,204.72 | 88,299.00 |
| 13 | `TT2026-2027/243` | 05-09-2026 | `8155` | RRL FOOTPRINT  RAMA TALKIES RO | ANDHRA PRADESH | `37AABCR1718E1ZO` | 5182778154 | 56 | 1,20,744.00 | 67,906.56 | 3,395.28 | 71,302.00 |
| 14 | `TT2026-2027/244` | 05-09-2026 | `8313` | RRL FOOTPRINT  B H  ROAD TUMKU | KARNATAKA | `29AABCR1718E1ZL` | 5182778155 | 56 | 1,20,744.00 | 67,906.56 | 3,395.28 | 71,302.00 |
| 15 | `TT2026-2027/245` | 05-09-2026 | `T0N6` | RRL TFW GUNTUR PHOENIX MALL | ANDHRA PRADESH | `37AABCR1718E1ZO` | 5182778159 | 56 | 1,20,744.00 | 67,906.56 | 3,395.28 | 71,302.00 |
| 16 | `TT2026-2027/246` | 05-09-2026 | `TMV9` | RRL FIF AMEERPET | TELANGANA | `36AABCR1718E1ZQ` | 5182778193 | 56 | 1,20,744.00 | 67,906.56 | 3,395.28 | 71,302.00 |
| 17 | `TT2026-2027/247` | 05-09-2026 | `TV78` | Distribution Center (Tumkur) | KARNATAKA | `29AABCR1718E1ZL` | 5182778210 | 56 | 1,20,744.00 | 67,906.56 | 3,395.28 | 71,302.00 |
| 18 | `TT2026-2027/248` | 05-09-2026 | `TVB6` | RRL TRENDS FOOTWEAR SS MALL & MULTIPLEX | ANDHRA PRADESH | `37AABCR1718E1ZO` | 5182778200 | 56 | 1,20,744.00 | 67,906.56 | 3,395.28 | 71,302.00 |
| 19 | `TT2026-2027/249` | 05-09-2026 | `TYAC` | RRL TF MB HABITAT MALL | KARNATAKA | `29AABCR1718E1ZL` | 5182778209 | 56 | 1,20,744.00 | 67,906.56 | 3,395.28 | 71,302.00 |
| **TOTAL** | **19 Invoices** | | **19 Stores** | | | | | **904** | **19,53,496.00** | **10,98,648.32** | **54,932.24** | **11,53,583.00** |

---

## 8. Tests Executed
1. `backend/scripts/generate_ril_dispatch_16092026_invoices.py` — Pipeline execution.
2. `scratch/verify_output.py` — Comprehensive database, file existence, and numerical reconciliation suite.
3. `pytest backend/tests/test_b2b_sales_wiring.py` — 16 passed tests in sales invoicing and tax engine.
4. `python -m py_compile backend/scripts/generate_ril_dispatch_16092026_invoices.py` — Python syntax verification.

---

## 9. Verification Results
- **PostgreSQL Database Verification**:
  - `sales_invoices`: 19/19 rows inserted (`TT2026-2027/231` to `TT2026-2027/249`)
  - `sales_invoice_items`: 645 unpivoted items inserted, sum of quantity = 904 pairs, total taxable = ₹10,98,648.32
  - `eway_bills`: 19 pre-dispatch staging records created
- **File System Outputs**:
  - 19 Statutory A4 PDFs generated in `F:\Smriti-Clients Data\16-09-2026\Final_Invoices\Tax_Invoice_PDFs\` (all valid `%PDF-` format, 350 KB - 364 KB each)
  - 19 Mirror PDFs generated in `F:\Smriti-Clients Data\16-09-2026\Invoices_Store_PO_Invoice\`
  - 19 NIC E-Way Bill JSON payloads in `F:\Smriti-Clients Data\16-09-2026\Final_Invoices\Eway_JSON\`
  - 1 Consolidated Bulk Upload JSON: `EWayBill_Bulk_Upload_16092026.json` (19 bills)
  - 20 JSON files mirrored in `F:\Smriti-Clients Data\Eway\Final_16092026\`
  - 1 Multi-tab Excel Summary: `Tax_Invoice_Summary_16-09-2026.xlsx` (21 summary rows, 646 consolidated item rows)
  - Source Excel Updated: `RIL_Dispatch1_16092026_All_Updated.xlsx` and preserved copy `RIL_Dispatch1_16092026_All_Invoiced.xlsx`

---

## 10. Known Limitations
- The NIC government portal upload requires live credentials; JSON files are staged for upload via the E-Way Bill web portal.
- Physical source spreadsheet `RIL_Dispatch1_16092026_All.xlsx` was open in Excel during generation; changes were preserved in `RIL_Dispatch1_16092026_All_Updated.xlsx` and `RIL_Dispatch1_16092026_All_Invoiced.xlsx`.

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
