<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.23.0
  Created      : 2026-09-15
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Canonical Dispatch Invoicing & Statutory Governance
-->

# Sales Walkthrough: Generation of 17 Statutory GST Tax Invoices for Reliance Retail (Sheet '15-09-2026') & Nagpur Jurisdiction Alignment (v6.23.0)

**Walkthrough Version:** v6.23.0  
**Release Milestone:** Milestone 6.23.0 / Sales & Distribution Dispatch Gateway  
**Date:** 2026-09-15  
**Author:** Jawahar Ramkripal Mallah (Chief Systems Architect & Creator)  
**Classification:** Canonical Commercial Dispatch Invoicing  

---

## 1. Purpose
This release executes statutory commercial dispatch billing for sheet `'15-09-2026'` of `RIL_Dispatch15092026.xlsx` for **Reliance Retail Limited**. It establishes store-specific direct billing and delivery for 17 retail stores, dates all tax invoices as `05-09-2026` (`2026-09-05`), applies the standard 43.76% promotional wholesale discount on MRP, enforces GST Section 15 tax rules (Intrastate Maharashtra CGST 2.5% + SGST 2.5% vs. Interstate IGST 5%), keeps E-Way Bill fields strictly blank pending official NIC portal generation, updates legal dispute jurisdiction across the platform from Mumbai to **Nagpur Jurisdiction**, generates 100% compliant Government of India (NIC v1.0.1118) E-Way Bill payloads, and highlights client dispatch records in green.

---

## 2. Scope
1. **Spreadsheet Ingestion & Unpivoting:** Ingest 119 rows from sheet `'15-09-2026'` of `F:\Smriti-Clients Data\15-09-2026\RIL_Dispatch15092026.xlsx`, unpivoting 7 size categories (36–42) across 17 stores into 765 line items and exactly 1,003 pairs.
2. **Master PO & Store Mapping:** Map all 17 stores to individual PO references and billing/shipping addresses from the Reliance Retail Master 60 PO register and `smriti001.sales_invoices` (resolving `8319` to PO `5182778158`).
3. **Database Staging:** Insert 17 sales invoices (`TT2026-2027/198` to `TT2026-2027/214`) and 765 line items into `smriti001.sales_invoices` and `smriti001.sales_invoice_items`.
4. **Pre-Portal E-Way Bill Governance:** Enforce statutory separation between pre-dispatch invoices and government issuance: keep `sales_invoices.eway_bill_no` as `NULL` and render E-Way Bill fields blank on physical tax invoice PDFs.
5. **Nagpur Legal Jurisdiction Alignment:** Update dispute jurisdiction and footer disclaimers from Mumbai to **Nagpur Jurisdiction** across backend PDF generators, seed data, and frontend templates.
6. **NIC Statutory E-Way Bill Payloads:** Generate 17 individual store JSONs and 1 consolidated bulk upload JSON (`EWayBill_Bulk_Upload_15092026.json`) adhering strictly to NIC schema v1.0.1118 with statutory 4-party combination movement (`transType: 4`).
7. **Client Audit Matrix & Dispatch Marking:** Generate multi-tab client summary workbook `Tax_Invoice_Summary_15-09-2026.xlsx` and highlight Columns M, N, O, P green (`#FF92D050`) in `RIL_Dispatch15092026_Invoiced.xlsx`.

---

## 3. Files Created
1. `backend/scripts/generate_ril_dispatch_15092026_invoices.py` — Authoritative end-to-end pipeline script orchestrating unpivoting, DB insertion, Playwright PDF rendering, NIC JSON export, and Excel matrix generation.
2. `docs/walkthrough/sales/Sales_Dispatch_17_Stores_Invoices_v6.23.0.md` — This formal walkthrough document.

---

## 4. Files Modified
1. `backend/app/services/invoice_pdf_service.py` — Updated dispute jurisdiction and footer disclaimer to **Nagpur Jurisdiction**.
2. `backend/app/db/seed_tax_invoice.py` — Updated default terms and disclaimer configuration to Nagpur Jurisdiction.
3. `backend/generate_tt_tax_in.py` — Updated standalone invoice template terms and footer to Nagpur Jurisdiction.
4. `src/print_engine/templates/StandardInvoiceA4.tsx` — Updated print engine terms and declaration to Nagpur Jurisdiction.
5. `src/components/templates/TaxInvoiceA4.tsx` — Updated UI template declaration to Nagpur Jurisdiction.
6. `src/components/TaxInvoicePrintPag.tsx` — Updated default footer text to Nagpur Jurisdiction.
7. `docs/walkthrough/README.md` — Updated master walkthrough index.
8. `CHANGELOG.md` — Documented release notes for v6.23.0.

---

## 5. Architecture Decisions
1. **Store-Specific Direct Billing & Delivery:** Rather than consolidating to a central DC, each store is billed and shipped directly to its registered site address under its individual PO from Reliance Retail's 60-PO register.
2. **Sequential Numbering Continuity:** Allocated sequential document numbers `TT2026-2027/198` through `TT2026-2027/214`, maintaining continuous statutory sequence following `TT2026-2027/197`.
3. **Statutory Commercial Discount on MRP:** Applied 43.76% promotional wholesale discount (`unit_rate = round(mrp * 0.5624, 2)`) prior to GST calculation in compliance with Section 15 of the CGST Act.
4. **Pre-Portal E-Way Bill Decoupling:** Prohibited printing provisional or dummy E-Way bill numbers on exported invoices. The invoice E-Way Bill field remains clean and blank until authentic 12-digit numbers are issued by the NIC portal.
5. **Forum / Jurisdiction Realignment:** Decoupled statutory tax place of supply (which depends on destination state) from civil contract dispute forum, aligning company terms to the principal depot location: **Nagpur Jurisdiction**.

---

## 6. Design Rationale
Prematurely printing provisional or internal reference numbers on customer-facing tax invoices creates compliance risks during transportation: check-post authorities querying unissued numbers on the government portal will flag them as invalid. Leaving the E-Way bill field blank while simultaneously supplying the authentic bulk upload JSON (`EWayBill_Bulk_Upload_15092026.json`) provides a smooth operational bridge: the transporter/client can inspect clean invoices, upload the bulk file to `ewaybillgst.gov.in`, and receive government-stamped slips.

---

## 7. Implementation Summary
- **17 Invoices Generated (`TT2026-2027/198` to `TT2026-2027/214`):**
  - Dated: `05-09-2026` (`2026-09-05`).
  - Total Pairs: **1,003 PRS** (59 pairs per store).
  - Total Gross MRP: **₹2,078,097.00** (₹122,241.00 per store).
  - Total Taxable Value: **₹1,168,724.16** (₹68,748.48 per store).
  - Total CGST (Maharashtra 2 Stores): **₹3,437.36** (₹1,718.68/store for `TFW4`, `TMN2`).
  - Total SGST (Maharashtra 2 Stores): **₹3,437.36** (₹1,718.68/store for `TFW4`, `TMN2`).
  - Total IGST (Interstate 15 Stores): **₹51,562.05** (₹3,437.47/store).
  - Total Net Invoiced Value: **₹1,227,162.00** (₹72,186.00 net per invoice × 17).
- **Physical Logistics Snapshot:** Decoupled billing from physical dispatch origin (`Tattly Threads Nagpur Depot`, PIN `440029`, State Code `27`).
- **Disk Artifacts Generated:**
  - 17 Tax Invoice PDFs in `F:\Smriti-Clients Data\15-09-2026\Final_Invoices\Tax_Invoice_PDFs\`
  - 17 Individual E-Way Bill JSONs in `F:\Smriti-Clients Data\15-09-2026\Final_Invoices\Eway_JSON\`
  - 1 Consolidated Bulk Upload E-Way Bill JSON: `EWayBill_Bulk_Upload_15092026.json`
  - 1 Client Audit Matrix Workbook: `Tax_Invoice_Summary_15-09-2026.xlsx`
  - 1 Invoiced Dispatch Excel: `RIL_Dispatch15092026_Invoiced.xlsx`

---

## 8. Tests Executed
1. Database Integrity Verification: Validated row counts, grand totals, and NULL status of `eway_bill_no` across all 17 invoices in `smriti001.sales_invoices`.
2. PDF Content Extraction: Inspected generated PDF text streams using `pypdf`, verifying that "Nagpur Jurisdiction" is present, "Mumbai Jurisdiction" is absent, and the E-Way bill line is blank.
3. NIC Payload Schema Verification: Verified all 17 records inside `EWayBill_Bulk_Upload_15092026.json` against NIC v1.0.1118 rules.

---

## 9. Verification Results
```text
=== DB Verification: sales_invoices (17/17) ===
  * TT2026-2027/198 | EWB: None (BLANK/NULL) | Net: Rs. 72186.00 | Status: POSTED
  * TT2026-2027/199 | EWB: None (BLANK/NULL) | Net: Rs. 72186.00 | Status: POSTED
  * TT2026-2027/200 | EWB: None (BLANK/NULL) | Net: Rs. 72186.00 | Status: POSTED
  * TT2026-2027/201 | EWB: None (BLANK/NULL) | Net: Rs. 72186.00 | Status: POSTED
  * TT2026-2027/202 | EWB: None (BLANK/NULL) | Net: Rs. 72186.00 | Status: POSTED
  * TT2026-2027/203 | EWB: None (BLANK/NULL) | Net: Rs. 72186.00 | Status: POSTED
  * TT2026-2027/204 | EWB: None (BLANK/NULL) | Net: Rs. 72186.00 | Status: POSTED
  * TT2026-2027/205 | EWB: None (BLANK/NULL) | Net: Rs. 72186.00 | Status: POSTED
  * TT2026-2027/206 | EWB: None (BLANK/NULL) | Net: Rs. 72186.00 | Status: POSTED
  * TT2026-2027/207 | EWB: None (BLANK/NULL) | Net: Rs. 72186.00 | Status: POSTED
  * TT2026-2027/208 | EWB: None (BLANK/NULL) | Net: Rs. 72186.00 | Status: POSTED
  * TT2026-2027/209 | EWB: None (BLANK/NULL) | Net: Rs. 72186.00 | Status: POSTED
  * TT2026-2027/210 | EWB: None (BLANK/NULL) | Net: Rs. 72186.00 | Status: POSTED
  * TT2026-2027/211 | EWB: None (BLANK/NULL) | Net: Rs. 72186.00 | Status: POSTED
  * TT2026-2027/212 | EWB: None (BLANK/NULL) | Net: Rs. 72186.00 | Status: POSTED
  * TT2026-2027/213 | EWB: None (BLANK/NULL) | Net: Rs. 72186.00 | Status: POSTED
  * TT2026-2027/214 | EWB: None (BLANK/NULL) | Net: Rs. 72186.00 | Status: POSTED

=== DB Verification: eway_bills (17/17) ===
  * TT2026-2027/198 to TT2026-2027/214 | EWB No: None | Status: PENDING_UPLOAD

=== PDF Text Content Verification: 1977_5182778153_TT2026-2027_198.pdf ===
  Contains 'Nagpur Jurisdiction': True
  Contains 'Mumbai Jurisdiction': False
  E-Way line in PDF: 'E-Way Bill No:' (BLANK)

ALL 17 INVOICES VERIFIED: E-WAY BILL IS BLANK & JURISDICTION IS NAGPUR!
```

---

## 10. Known Limitations
- The original workbook `RIL_Dispatch15092026.xlsx` was locked by Windows file locking because the user had it open in Microsoft Excel during generation; the fully highlighted version was saved to `RIL_Dispatch15092026_Invoiced.xlsx` and `RIL_Dispatch15092026.xlsx.updated.xlsx`.

---

## 11. Future Work
- Upon uploading `EWayBill_Bulk_Upload_15092026.json` to `ewaybillgst.gov.in`, synchronize the returned 12-digit government E-Way Bill numbers into `smriti001.sales_invoices.eway_bill_no` and `smriti001.eway_bills`.

---

## 12. Related ADRs
- `ADR-0046`: Statutory 4-Party Combination Movement (`transType: 4`) for B2B Retail Supply Chains.
- `ADR-0048`: Decoupling Statutory Place of Supply from Civil Court Dispute Forum Jurisdiction.

---

## 13. Related RFCs
- `RFC-2026-09`: Government of India NIC E-Way Bill Schema v1.0.1118 Compliance.
