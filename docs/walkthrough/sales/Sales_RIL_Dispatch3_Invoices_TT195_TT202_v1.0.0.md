# SMRITI Walkthrough: RIL Dispatch 3 Invoicing Engine & Statutory Artifacts (TT195 to TT202)

**Topic:** RIL Dispatch 3 Invoicing Pipeline, Footwear Size Matrix Unpivoting, Database Ingestion, PDF Rendering & E-Way Bill Export  
**Version:** 1.0.0  
**Date:** 2026-09-09  
**Author:** Jawahar Ramkripal Mallah, Chief Systems Architect & Creator  
**Status:** Completed  
**Classification:** Canonical Operational & Billing Walkthrough  

---

## 1. Purpose
This walkthrough documents the end-to-end execution of the billing and statutory dispatch pipeline for client consignment sheet `RIL_Dispatch3.xlsx` (Sheet `08-09-2026`). The pipeline excludes non-packed rows containing `*` in Column N (`Cartoon number`), unpivots footwear size matrices (Sizes 36–42), generates 8 sequential invoices (`TT2026-2027/195` to `TT2026-2027/202`), inserts transactional records into PostgreSQL (`smriti001`), renders corporate GST Tax Invoice PDFs via `InvoicePdfService`, generates NIC Rule 10 Part-A clean E-Way Bill JSON payloads and registers, updates the source Excel workbook, and packages the complete artifact suite.

---

## 2. Scope
- **Source File:** `F:\Smriti-Clients Data\08-09-2026\RIL_Dispatch3.xlsx`, Sheet `08-09-2026`.
- **Filtering Rule:** Filter out all rows where Column N (`Cartoon number`) equals `*` (32 rows of store `TKI6` excluded).
- **Clean Invoicing Consignments:** Exactly 97 rows across 8 destination stores:
  1. `TGX1` -> `TT2026-2027/195` (PO `5182778183`, Cartons `[368, 369]`, 107 pairs, Net: ₹1,34,989.00)
  2. `TGX9` -> `TT2026-2027/196` (PO `5182778184`, Cartons `[362, 363]`, 110 pairs, Net: ₹1,38,708.00)
  3. `TKF4` -> `TT2026-2027/197` (PO `5182778186`, Cartons `[364, 365]`, 109 pairs, Net: ₹1,37,409.00)
  4. `TKG3` -> `TT2026-2027/198` (PO `5182778187`, Cartons `[366, 367]`, 110 pairs, Net: ₹1,38,117.00)
  5. `TJI4` -> `TT2026-2027/199` (PO `5182778185`, Cartons `[370, 371]`, 112 pairs, Net: ₹1,35,990.00)
  6. `TKU5` -> `TT2026-2027/200` (PO `5182778190`, Cartons `[307, 308]`, 77 pairs, Net: ₹94,261.00)
  7. `TMN2` -> `TT2026-2027/201` (PO `5182778192`, Cartons `[305, 306]`, 77 pairs, Net: ₹94,261.00 - Intra-state Maharashtra CGST+SGST)
  8. `TUA7` -> `TT2026-2027/202` (PO `5182778196`, Cartons `[303, 304]`, 77 pairs, Net: ₹94,261.00)
- **Database Target:** `smriti001` (`sales_invoices`, `sales_invoice_items`).
- **Export Folders:** `F:\Smriti-Clients Data\08-09-2026\Final_RIL3\` and mirror `F:\Smriti-Clients Data\Eway\Final_RIL3\`.

---

## 3. Files Created
1. `backend/scripts/generate_ril_dispatch3_invoices.py` — Canonical Dispatch 3 Invoicing, DB persistence, PDF rendering & E-Way Export Suite.
2. `F:\Smriti-Clients Data\08-09-2026\Final_RIL3\EWayBill_Bulk_Upload_RIL3.json` — Bulk E-Way Bill JSON upload payload (8 bills).
3. `F:\Smriti-Clients Data\08-09-2026\Final_RIL3\EWayBill_Generation_Register_RIL3.xlsx` — Consolidated statutory audit register.
4. `F:\Smriti-Clients Data\08-09-2026\Final_RIL3\Eway_JSON\` — 8 individual E-Way Bill JSON files.
5. `F:\Smriti-Clients Data\08-09-2026\Final_RIL3\Tax_Invoice_PDFs\` — 8 rendered Tax Invoice PDFs.
6. `F:\Smriti-Clients Data\08-09-2026\Final_RIL3\Final_RIL3_Package.7z` — High-compression 7-Zip package.
7. `F:\Smriti-Clients Data\08-09-2026\RIL_Dispatch3_Updated.xlsx` — Updated workbook with Column O (`Invoice details`) populated.
8. `docs/walkthrough/sales/Sales_RIL_Dispatch3_Invoices_TT195_TT202_v1.0.0.md` — This official walkthrough document.

---

## 4. Files Modified
1. `docs/walkthrough/README.md` — Master walkthrough index updated with the new implementation entry.

---

## 5. Architecture Decisions
- **Sequential Invoice Numbering Series:** Issued brand-new sequential invoice numbers `TT2026-2027/195` through `TT2026-2027/202` directly continuing after `TT2026-2027/194`.
- **Statutory Physical Origin (NIC Rule 10):** Set `dispatch_from_location_id = 'wh-ngp-001'` with physical origin at Kalamana, Nagpur (PIN `440029`), while maintaining the legal supplier registered office at Mumbai (PIN `400003`). E-Way Bill transaction types set to `transType = 4` (Combination) for interstate and `transType = 3` (Bill From - Dispatch From) for intra-state Maharashtra (`TMN2`).
- **Wholesale Footwear Pricing Invariant:** Rate formula strictly enforced as `unit_rate = round(mrp * 0.5624, 2)` (reflecting a 43.76% trade discount off MRP).
- **Graceful Excel Lock Handling:** Because Windows Excel held an exclusive lock on `RIL_Dispatch3.xlsx`, the system safely wrote the updated workbook to `RIL_Dispatch3_Updated.xlsx` and inside the distribution package without disrupting pipeline execution.

---

## 6. Design Rationale
- Stores with unassigned cartons (`*`) in Column N indicate items currently not packed or physically held back. Omitting them prevents fraudulent invoicing and premature E-Way bill generation on the government portal.
- All 8 destinations map 1-to-1 to active Customer Purchase Orders, pre-registered store codes, and verified GSTINs.
- Clean letterheads without redundant "BILL FROM" labels provide an aesthetically superior, auditor-approved PDF presentation.

---

## 7. Implementation Summary
- **97 Clean Rows Processed:** Excluded all 32 rows of store `TKI6` where `Cartoon number = '*'`.
- **585 Total Line Items Ingested:** Unpivoted individual size columns (36 to 42) into distinct item rows with HSN `64032012`, MRP, price, quantity, taxable value, and tax amounts.
- **779 Total Pairs Billed:**
  - Net Value: ₹9,67,996.00
  - Taxable Value: ₹9,21,899.76
  - Tax Total: ₹46,095.12 (IGST 5% for interstate, CGST 2.5% + SGST 2.5% for TMN2)
- **8 PDFs Rendered:** Stored in `Final_RIL3/Tax_Invoice_PDFs/` (332 KB – 343 KB each) with barcodes, QR codes, and Nagpur depot dispatch details.
- **E-Way Payloads & Register Created:** Part-A clean JSON with transporter fields blank and distance accurately derived.

---

## 8. Tests Executed
1. `backend/scripts/generate_ril_dispatch3_invoices.py` — Successful pipeline run (Exit Code 0).
2. `scratch/verify_ril3_pipeline.py` — Database parity check and screenshot generation (Exit Code 0).
3. `python -m py_compile backend/scripts/generate_ril_dispatch3_invoices.py` — AST syntax verification (Exit Code 0).
4. Visual image inspection of rendered PDF pages for `TT195` (Interstate) and `TT201` (Intra-state).

---

## 9. Verification Results
- **Database Parity:** 8/8 invoices present in `sales_invoices`, 585/585 items in `sales_invoice_items`.
- **Total Financials Reconciled:** 100% match between Excel source calculations, DB records, PDF summaries, and E-Way JSON payloads.
- **Physical Package:** `Final_RIL3_Package.7z` (716,651 bytes) successfully created and mirrored to `F:\Smriti-Clients Data\Eway\Final_RIL3`.

---

## 10. Known Limitations
- `RIL_Dispatch3.xlsx` was locked by an active Microsoft Excel process during execution; the updated file is preserved in `RIL_Dispatch3_Updated.xlsx` and `Final_RIL3/RIL_Dispatch3.xlsx`. Once Excel is closed, it can be copied directly over the original.

---

## 11. Future Work
- Automated watcher to overwrite `RIL_Dispatch3.xlsx` immediately upon file handle release.
- Store `TKI6` backlog fulfillment once cartons are assigned.

---

## 12. Related ADRs
- `ADR-0042` — Statutory Dispatch From Segregation (NIC Rule 10).
- `ADR-0043` — B2B Wholesale Matrix Pricing and Rounding Policy.

---

## 13. Related RFCs
- `RFC-2026-08-01` — SMRITI Retail Multi-Store Footwear Matrix Invoicing.
