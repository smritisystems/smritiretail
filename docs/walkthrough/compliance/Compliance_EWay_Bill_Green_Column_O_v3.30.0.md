<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.30.0
  Created      : 2026-09-09
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Statutory NIC E-Way Bill Generation — 22 Green Column "O" Invoices

## 1. Purpose
Generate compliant statutory NIC E-Way Bill payloads (v1.0.1118) for the 22 sales invoices highlighted in **Green** in Column "O" of [`F:\Smriti-Clients Data\08-09-2026\RIL_Dispatch-2.xlsx`](file:///F:/Smriti-Clients%20Data/08-09-2026/RIL_Dispatch-2.xlsx) and isolate all output artifacts into a **dedicated separate folder**, avoiding mixing with the previous 25-invoice set.

---

## 2. Scope
- **Source Scope:** Exactly 22 sales invoices from `RIL_Dispatch-2.xlsx` sheet `08-09-2026` where Column O is filled with green color (`FF92D050`).
- **Database System of Record:** PostgreSQL `smriti001`, table `sales_invoices` (batch `DISPATCH_20260902_STORE_GROUPED_V2`).
- **Total Consignment Billed Quantity:** 2,121 PRS.
- **Total Taxable Value:** ₹2,474,778.24.
- **Total Consignment Value:** ₹2,598,517.00.
- **Compliance Rules:** Official NIC Schema v1.0.1118, Rule 44 mathematical tolerance (Rs 2 threshold), clean `{Article} {Color} {Size}` item names.

---

## 3. Files Created
1. `backend/scripts/generate_green_column_o_eway_bills.py` — Statutory E-Way Bill generation, validation, and packaging engine.
2. `F:\Smriti-Clients Data\Eway\Green_Column_O_Invoices_JSON\` — Dedicated separate folder with 22 individual JSON files (`TT2026-2027_145_Eway.json` to `TT2026-2027_193_Eway.json`).
3. `F:\Smriti-Clients Data\Eway\EWayBill_Bulk_Upload_Green_Column_O_22_Invoices.json` — Consolidated bulk upload JSON (666,243 bytes).
4. `F:\Smriti-Clients Data\Eway\EWayBill_Generation_Register_Green_Column_O_22_Invoices.xlsx` — Formatted consignment Excel register.
5. `F:\Smriti-Clients Data\Eway\EWayBill_Generation_Register_Green_Column_O_22_Invoices.7z` — High-compression LZMA2 archive.
6. `F:\Smriti-Clients Data\08-09-2026\Green_Column_O_Invoices_JSON\` — Mirrored separate folder for direct client access.
7. `F:\Smriti-Clients Data\08-09-2026\EWayBill_Bulk_Upload_Green_Column_O_22_Invoices.json` — Mirrored bulk upload JSON.
8. `F:\Smriti-Clients Data\08-09-2026\EWayBill_Generation_Register_Green_Column_O_22_Invoices.xlsx` — Mirrored consignment register.
9. `F:\Smriti-Clients Data\08-09-2026\EWayBill_Generation_Register_Green_Column_O_22_Invoices.7z` — Mirrored archive.

---

## 4. Files Modified
- `docs/walkthrough/README.md` — Appended master index with this walkthrough.

---

## 5. Architecture Decisions
1. **Isolated Output Segregation:** Stored generated individual and bulk JSONs in a dedicated separate directory (`Green_Column_O_Invoices_JSON`), strictly isolating them from `Updated_25_Invoices_JSON` and canonical master directories.
2. **Deterministic Postal/City Resolution:** City names and 6-digit postal codes were verified directly from store records and shipping master data.
3. **Dual Delivery Location:** Outputs mirrored to both `F:\Smriti-Clients Data\Eway\` and `F:\Smriti-Clients Data\08-09-2026\` for operational convenience.

---

## 6. Design Rationale
Column O was highlighted in green by the client to indicate pre-verified store consignments. The user specifically instructed generating their E-Way Bills in a separate folder to allow standalone submission to the NIC portal without collision with the previously updated 25 invoices.

---

## 7. Implementation Summary

### Verified Consignment Scope (22 Invoices)

| Sl | Invoice No | Store Code | Destination | State Code | Pairs | Taxable Value (Rs) | IGST (Rs) | CGST (Rs) | SGST (Rs) | Total Value (Rs) | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | TT2026-2027/145 | 9556 | Agartala | 16 | 104 | 120,970.24 | 6,048.46 | 0.00 | 0.00 | 127,019.00 | VALID - READY |
| 2 | TT2026-2027/151 | T40R | Bhagalpur | 10 | 104 | 120,970.24 | 6,048.46 | 0.00 | 0.00 | 127,019.00 | VALID - READY |
| 3 | TT2026-2027/155 | T8IY | Ranchi | 20 | 112 | 129,514.24 | 6,475.66 | 0.00 | 0.00 | 135,990.00 | VALID - READY |
| 4 | TT2026-2027/158 | T9SQ | Hyderabad | 36 | 94 | 113,214.72 | 5,660.76 | 0.00 | 0.00 | 118,875.00 | VALID - READY |
| 5 | TT2026-2027/159 | TAGG | Agartala | 16 | 112 | 129,514.24 | 6,475.66 | 0.00 | 0.00 | 135,990.00 | VALID - READY |
| 6 | TT2026-2027/160 | TAGH | Varanasi | 9 | 120 | 139,070.56 | 6,953.55 | 0.00 | 0.00 | 146,024.00 | VALID - READY |
| 7 | TT2026-2027/161 | TC64 | Shimoga | 29 | 110 | 132,102.40 | 6,605.12 | 0.00 | 0.00 | 138,708.00 | VALID - READY |
| 8 | TT2026-2027/162 | TDL2 | Ghaziabad | 9 | 120 | 139,070.56 | 6,953.55 | 0.00 | 0.00 | 146,024.00 | VALID - READY |
| 9 | TT2026-2027/164 | TDL9 | Hyderabad | 36 | 110 | 132,102.40 | 6,605.12 | 0.00 | 0.00 | 138,708.00 | VALID - READY |
| 10 | TT2026-2027/173 | TKL0 | Barrackpore | 19 | 112 | 129,514.24 | 6,475.66 | 0.00 | 0.00 | 135,990.00 | VALID - READY |
| 11 | TT2026-2027/178 | TPV2 | Siliguri | 19 | 112 | 129,514.24 | 6,475.66 | 0.00 | 0.00 | 135,990.00 | VALID - READY |
| 12 | TT2026-2027/180 | TUB7 | Purnea | 10 | 112 | 129,514.24 | 6,475.66 | 0.00 | 0.00 | 135,990.00 | VALID - READY |
| 13 | TT2026-2027/181 | TUK5 | Visakhapatnam | 37 | 104 | 123,332.32 | 6,166.66 | 0.00 | 0.00 | 129,499.00 | VALID - READY |
| 14 | TT2026-2027/185 | TVP2 | Hassan | 29 | 80 | 92,301.28 | 4,615.10 | 0.00 | 0.00 | 96,916.00 | VALID - READY |
| 15 | TT2026-2027/186 | TVT0 | New Delhi | 7 | 77 | 89,772.16 | 4,488.64 | 0.00 | 0.00 | 94,261.00 | VALID - READY |
| 16 | TT2026-2027/187 | TVU1 | Hajipur | 10 | 64 | 75,550.72 | 3,777.52 | 0.00 | 0.00 | 79,328.00 | VALID - READY |
| 17 | TT2026-2027/188 | TW07 | Tumkur | 29 | 80 | 92,301.28 | 4,615.10 | 0.00 | 0.00 | 96,916.00 | VALID - READY |
| 18 | TT2026-2027/189 | TW97 | Hyderabad | 36 | 80 | 92,301.28 | 4,615.10 | 0.00 | 0.00 | 96,916.00 | VALID - READY |
| 19 | TT2026-2027/190 | TXAJ | Chennai | 33 | 77 | 89,772.16 | 4,488.64 | 0.00 | 0.00 | 94,261.00 | VALID - READY |
| 20 | TT2026-2027/191 | TXSR | Hyderabad | 36 | 80 | 92,301.28 | 4,615.10 | 0.00 | 0.00 | 96,916.00 | VALID - READY |
| 21 | TT2026-2027/192 | TXSU | Bangalore | 29 | 80 | 92,301.28 | 4,615.10 | 0.00 | 0.00 | 96,916.00 | VALID - READY |
| 22 | TT2026-2027/193 | TY06 | Varanasi | 9 | 77 | 89,772.16 | 4,488.64 | 0.00 | 0.00 | 94,261.00 | VALID - READY |
| **TOTAL** | **22 INVOICES** | — | — | — | **2,121** | **₹2,474,778.24** | **₹123,738.92** | **₹0.00** | **₹0.00** | **₹2,598,517.00** | — |

---

## 8. Tests Executed
1. **Rule 44 Mathematical Tolerance Check:** Verified that `totalValue + taxes + otherCharges == totInvValue` within ±₹2.00 threshold for all 22 invoices (0 violations).
2. **Official NIC Schema Validation:** Validated bulk and all 22 individual JSON payloads against NIC Schema v1.0.1118 using `jsonschema` (100% pass).
3. **Archive Integrity Verification:** Tested `EWayBill_Generation_Register_Green_Column_O_22_Invoices.7z` using 7-Zip CLI (`7z t`).

---

## 9. Verification Results
- **Rule 44 Violations:** 0 / 22.
- **NIC Schema Errors:** 0 / 22.
- **7-Zip Archive Integrity:** `Everything is Ok` (25 files).

---

## 10. Known Limitations
None. All 22 invoices have valid GSTINs, pincodes, line item valuations, and tax rates.

---

## 11. Future Work
Direct automated submission via NIC GSP/ASP API gateway when live API credentials are configured.

---

## 12. Related ADRs
- `ADR-004`: NIC E-Way Bill Schema v1.0.1118 Compliance Standard.

---

## 13. Related RFCs
- `RFC-EWB-002`: Consignment Batch Segregation for Multi-Store Retail Invoicing.
