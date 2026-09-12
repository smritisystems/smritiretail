<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.34.0
  Created      : 2026-09-09
  Modified     : 2026-09-09
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Canonical Walkthrough Document
-->

# Walkthrough: Sales RIL Dispatch 4 Invoices TT167-TT171 Alignment & Excel Parity

## 1. Purpose
Align PostgreSQL database invoices (`TT2026-2027/167` through `TT2026-2027/171`) with physical packing cartons from `F:\Smriti-Clients Data\08-09-2026\RIL_Dispatch4.xlsx` (sheet `08-09-2026`), re-generate PDF Tax Invoices, NIC schema-compliant E-Way Bill JSONs, and highlight the updated consignments green (`FF92D050`) in the dispatch spreadsheet.

## 2. Scope
- Scope: Invoices `TT2026-2027/167` through `TT2026-2027/171` (Stores: `TGX1`, `TGX9`, `TJI4`, `TKF4`, `TKG3`).
- Database: `smriti001` (`sales_invoices`, `sales_invoice_items`).
- File System: `RIL_Dispatch4_Updated.xlsx`, PDF Tax Invoices, and NIC v1.0.1118 E-Way JSONs.

## 3. Files Created
- `backend/scripts/update_invoices_167_to_171.py`
- `docs/walkthrough/sales/Sales_RIL_Dispatch4_Invoices_TT167_TT171_Update_v1.0.0.md`

## 4. Files Modified
- `docs/walkthrough/README.md`
- `F:\Smriti-Clients Data\08-09-2026\RIL_Dispatch4_Updated.xlsx`

## 5. Architecture Decisions
- Preserved existing invoice IDs (`inv-dispatch-9d6157a2a002`, etc.) in `sales_invoices` while atomistically refreshing child `sales_invoice_items` to prevent breaking external audit trails or relational foreign keys.
- Applied canonical rate derivation formula: `unit_rate = round(mrp * 0.5624, 2)` and interstate IGST calculation (`5.0%`).
- Enforced zero-loss fallback staging in `RIL_Dispatch4_Updated.xlsx` when original Excel file is locked by user desktop processes.

## 6. Design Rationale
In the previous batch (`DISPATCH_20260902_STORE_GROUPED_V2`), invoices `TT167`–`TT171` were seeded with 100% PO demand quantities (112–122 pairs). Physical packing resulted in slight count variance (107, 110, 112, 109, 108 pairs). Updating line items to exact physical packing counts prevents GST discrepancy upon customer receipt and transport e-way inspection.

## 7. Implementation Summary
- Deleted old line items and inserted 406 exact size-level line items into `sales_invoice_items`.
- Re-calculated totals, taxable amounts, and IGST for all 5 invoices.
- Rendered PDF Invoices via `InvoicePdfService` and generated NIC schema v1.0.1118 E-Way JSON payloads.
- Highlighted all 70 corresponding rows in `RIL_Dispatch4_Updated.xlsx` with Green (`FF92D050`).

## 8. Tests Executed
- `python -m py_compile backend/scripts/update_invoices_167_to_171.py`
- Executed `backend/scripts/update_invoices_167_to_171.py`
- Executed database verification query verifying row counts, quantities, and totals.

## 9. Verification Results
| Store | Invoice No | Date | Items | Pairs | Taxable (Rs) | Tax (Rs) | Grand Total (Rs) |
|---|---|---|---|---|---|---|---|
| TGX1 | TT2026-2027/167 | 2026-09-08 | 79 | 107 | 1,28,560.96 | 6,428.04 | Rs. 1,34,989.00 |
| TGX9 | TT2026-2027/168 | 2026-09-08 | 82 | 110 | 1,32,102.40 | 6,605.12 | Rs. 1,38,708.00 |
| TJI4 | TT2026-2027/169 | 2026-09-08 | 84 | 112 | 1,29,514.24 | 6,475.72 | Rs. 1,35,990.00 |
| TKF4 | TT2026-2027/170 | 2026-09-08 | 81 | 109 | 1,30,865.68 | 6,543.28 | Rs. 1,37,409.00 |
| TKG3 | TT2026-2027/171 | 2026-09-08 | 80 | 108 | 1,29,628.96 | 6,481.44 | Rs. 1,36,110.00 |

## 10. Known Limitations
- Stores `TKI6` (147 pairs with `*`), `TKU5` (43 pairs with `*`), `TMN2` (43 pairs with `*`), and `TUA7` (43 pairs with `*`) remain uncolored and pending carton completion.

## 11. Future Work
- Process pending 4 stores once carton numbers are finalized physically.

## 12. Related ADRs
- `ADR-0042`: Database-First Transactional Invoice Model
- `ADR-0051`: NIC E-Way Bill Schema Strict Conformity

## 13. Related RFCs
- `RFC-2026-09-08-DISPATCH-V4`
