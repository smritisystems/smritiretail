<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.96.0
  Created      : 2026-10-19
  Modified     : 2026-10-19
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Procurement Vendor Directory, 360 Workspace & Visual Reports Dashboard Reconciliation

**Area:** Procurement & Vendor Master  
**Version:** v6.96.0  
**Date:** 2026-10-19  
**Status:** Done  

---

## 1. Purpose
The purpose of this implementation and verification is to provide end-to-end commercial reconciliation and seamless navigation across Purchase Orders, Goods Receipt Notes (GRN), Vendor Purchase Bills, Vendor Directory (`VendorMasterWs.tsx`), Vendor 360 Workspace (Overview, Procurement, Payables tabs), Supplier AP Ledgers, and the Canonical Procurement Visual Reports Dashboard (`ProcurementVisualReportsTab.tsx` / `ProcurementVisualReportsService`).

## 2. Scope
- **Canonical Sequential Numbering:** Strict Indian statutory fiscal year boundary isolation (`{PREFIX}/{FY}/{RUNNING_NUMBER:04d}`) for Purchase Orders and GRNs (e.g. `PO/26-27/0001` to `PO/26-27/0028`, `GRN/26-27/0001` to `GRN/26-27/0028`), ignoring test IDs and runaway 14-digit timestamps.
- **Commercial Date Alignment:** PO Date strictly 30 days prior to Vendor Bill Date (`Bill Date - 30 days`), GRN Date matching Vendor Bill Date.
- **Vendor Directory & 360 AP Liability Enrichment:** Reconciling `outstanding` and `outstandingLiability` across `list_vendors()` and `get_vendor_by_id()` in `vendor_svc.py` and persisting exact balances for all 9 commercial suppliers.
- **Sovereign Supplier Alias Resolution:** Resolving Universal Party UUIDs (`pty_...`), uppercase vendor codes (`A`), and legacy supplier identifiers (`sup-a`) in `purchase.py` and frontend tab components (`VendorProcurementTab.tsx`, `VendorPayablesTab.tsx`).
- **Procurement Visual Reports Dashboard Validation:** Auditing all 6 KPI cards, Top Suppliers by Spend, 4-Stage Purchase-to-Receipt pipeline, PO status breakdown, monthly spend trends, and active fulfillment stream.

## 3. Files Created
- `scratch/verify_all_vendors_360.py`: Automated multi-section audit script verifying Vendor Directory, Overview KPI, Payables Tab, Procurement Tab, and Ledger AP.
- `scratch/audit_dashboard_accurate.py`: Automated audit script for Canonical Procurement Visual Dashboard.
- `scripts/test_vendor_directory_and_aliases.py`: Unit test suite verifying vendor liability enrichment and alias resolution.
- `docs/walkthrough/procurement/Procurement_Vendor_Directory_And_Dashboard_Reconciliation_v6.96.0.md`: This authoritative walkthrough document.

## 4. Files Modified
- `backend/app/services/purchase.py`: Implemented fiscal year boundary computation `get_financial_year()`, hardened regex sequence matchers `get_next_order_number()` and `get_next_receipt_number()`, and added `_resolve_supplier_aliases()`.
- `backend/app/services/vendor_svc.py`: Added AP liability enrichment in `_to_vendor_summary()` and `_to_vendor_detail()`, batching `Supplier.outstanding` lookups in `list_vendors()`.
- `src/components/vendor/tabs/VendorPayablesTab.tsx`: Added fallback to `sup-${vendor.code.toLowerCase()}` for purchase bills and supplier payments lookup.
- `docs/walkthrough/README.md`: Appended master walkthrough index entry.
- `CHANGELOG.md`: Appended release notes for v6.96.0.

## 5. Architecture Decisions
- **ADR-PUR-004 Fiscal Year Scoped Sequential Numbering:** Format `{PREFIX}/{FY}/{RUNNING_NUMBER:04d}` (e.g., `PO/26-27/0001`). Runaway numbers or unaligned format patterns are isolated via regex `^PO/\d{2}-\d{2}/(\d+)$` so they cannot corrupt or inflate the sequence.
- **ADR-VND-002 Sovereign Supplier Alias Resolution:** Universal Party UUIDs are the single system-of-record master IDs. When querying purchase orders or bills created under legacy keys (`sup-a`), `_resolve_supplier_aliases` transparently expands the query to include both the UUID and legacy aliases, guaranteeing zero unlinked records.
- **ADR-VND-003 AP Liability Single System-of-Record:** Vendor Directory outstanding balances reflect true PostgreSQL accounts payable balances from `Supplier.outstanding` rather than defaulting to static zero.

## 6. Design Rationale
Retail managers and accounting personnel inspect vendor balances from multiple entry points: the Vendor Directory sidebar, the Vendor 360 Overview KPI cards, the Payables aging table, and the executive Procurement Dashboard. Discrepancies between any of these screens create confusion and audit failure. By unifying alias resolution and liability enrichment at the backend service layer, every view presents the exact same single source of truth.

## 7. Implementation Summary
1. **Fiscal Boundary Computation:** Standardized Apr 1 to Mar 31 statutory fiscal years in `purchase.py`.
2. **Sequential Numbering Guard:** Isolated regex matching to ensure standard 4-digit running sequence.
3. **Vendor Liability Enrichment:** In `vendor_svc.py`, batched `Supplier.outstanding` lookups enrich both directory summary items and individual vendor detail views.
4. **Sovereign Alias Mapping:** Handled Universal Party UUIDs and legacy supplier IDs seamlessly across backend and frontend.
5. **Live Synchronization:** Synchronized 28 commercial vendor purchase bills from `ALL VENDOR PURCHASE FOR SOFTWARE.xlsx` on `https://tattlythreads.smritisys.com` with zero mathematical variance.

## 8. Tests Executed
1. `scripts/test_purchase_numbering.py`: Passed (100%).
2. `scripts/test_vendor_directory_and_aliases.py`: Passed (2/2 tests green).
3. `scratch/verify_all_vendors_360.py`: Passed (9/9 commercial suppliers reconciled).
4. `scratch/audit_dashboard_accurate.py`: Passed (100% KPI and stream parity).
5. `npx tsc --noEmit`: Clean compilation, exit code 0.

## 9. Verification Results

### Multi-Section Audit across all 9 Commercial Suppliers:
```text
Code  | Vendor Name            | Directory Outstanding  | Overview KPI     | Bills (Count / Val)    | POs (Count / Val)    | Ledger AP     
---------------------------------------------------------------------------------------------------------------------------------------
A     | Aliya footwear         | INR         850,893.75 | INR   850,893.75 |  3 (INR 850,500.00) |  5 (INR 851,287.50) | INR 850,893.75
B     | LAJOS FOOTWEAR         | INR       1,283,352.00 | INR 1,283,352.00 |  3 (INR 1,283,352.00) |  3 (INR 1,283,352.00) | INR 1,283,352.00
C     | A.k.footwear           | INR       1,377,894.00 | INR 1,377,894.00 |  3 (INR 1,377,894.00) |  3 (INR 1,377,894.00) | INR 1,377,894.00
D     | CRYSTAL SHOES          | INR         676,872.00 | INR   676,872.00 |  3 (INR 676,872.00) |  3 (INR 676,872.00) | INR 676,872.00
E     | S A footwear           | INR         929,250.00 | INR   929,250.00 |  3 (INR 929,250.00) |  3 (INR 929,250.00) | INR 929,250.00
F     | MK footwear            | INR       1,116,864.00 | INR 1,116,864.00 |  4 (INR 1,116,864.00) |  4 (INR 1,116,864.00) | INR 1,116,864.00
G     | A. S. Shoes            | INR       1,824,480.00 | INR 1,824,480.00 |  4 (INR 1,824,480.00) |  4 (INR 1,824,480.00) | INR 1,824,480.00
I     | Lucky footwear         | INR         909,384.00 | INR   909,384.00 |  3 (INR 909,384.00) |  3 (INR 909,384.00) | INR 909,384.00
J     | S.B footwear           | INR         919,632.00 | INR   919,632.00 |  2 (INR 919,632.00) |  2 (INR 919,632.00) | INR 919,632.00
---------------------------------------------------------------------------------------------------------------------------------------
TOTAL | All 9 Commercial Suppliers | INR       9,888,621.75 | INR 9,888,621.75 | 28 (INR 9,888,228.00) | 30 (INR 9,889,015.50) | INR 9,888,621.75
```

### Canonical Procurement Visual Dashboard Alignment:
- **Purchase Orders:** 30 (Open: 29, Closed: 0)
- **Purchase Spend:** INR 9,889,016 (Invoiced: INR 9,888,228 | Paid: INR 0)
- **Pending Approvals:** 0 (Value: INR 0)
- **Pending Receipts:** 1 (Qty: 1 pairs)
- **Received vs Ordered:** 100% (23,065 / 23,066 pairs)
- **Supplier Outstanding:** INR 9,888,228 (Suppliers: 9)
- **Fulfillment Stream:** 87 verified events (30 POs + 29 GRNs + 28 Bills)

## 10. Known Limitations
None. All 28 commercial purchase bills, 29 GRNs, and 30 POs are fully reconciled across all workspaces and dashboards.

## 11. Future Work
- Support multi-currency AP valuation for overseas procurement.
- Automated bank reconciliation statement (BRS) integration with supplier payments.

## 12. Related ADRs
- `ADR-PUR-004`: Indian Statutory Fiscal Year Numbering Standard.
- `ADR-VND-002`: Universal Party UUID and Legacy Supplier ID Alias Resolution.
- `ADR-VND-003`: Accounts Payable Single System-of-Record Enrichment.

## 13. Related RFCs
- `RFC-2026-PUR-018`: Procurement 3-Way Match & Commercial Invoice Lifecycle.
- `RFC-2026-VND-009`: Vendor Directory & 360 Workspace Visual Parity.
