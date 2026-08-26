<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-08-26
  Modified     : 2026-08-26
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Phase 1 Historical PO Reconciliation — Tattly Threads

## 1. Purpose
This document presents the formal technical walkthrough and audit trail for Phase 1 Historical Purchase Order (PO) Reconciliation for client **Tattly Threads** against **Reliance Retail Limited**. The objective is to ingest the 60 authoritative Reliance Retail PO PDFs into canonical SMRITI Sales Orders, deduplicate and populate Item Master products, archive immutable legal terms snapshots, and reconcile invoice allocations across historical tax invoices `TT2026-2027/18` through `TT2026-2027/137`.

---

## 2. Scope
- **Authoritative Ingestion Source**: 60 Reliance Retail Purchase Order PDFs (`5182778151.pdf` through `5182778210.pdf`) located at `F:\Smriti-Clients Data\Tattly Threads\Invoice\Tattly Threads\`.
- **Target Company Database**: `smriti001` (Tenant Data Plane for Tattly Threads).
- **Core Entities Created**:
  - 60 Historical `SalesOrder` entities (`SO-5182778151` to `SO-5182778210`).
  - 18,036 `SalesOrderItem` line records linking to canonical products.
  - 303 newly deduplicated `Product` entities (total 450 unique SKUs mapped).
  - 60 immutable `TermsSnapshot` entities capturing full PDF terms.
  - 120 `SalesOrderInvoiceAllocation` records matching invoices `TT2026-2027/18` to `TT2026-2027/137`.
- **Strict Non-Scope & Invariants**:
  - Zero modifications to existing tax invoice values, dates, status, or items (Rule 9).
  - Zero stock movements created (Rule 10).
  - Zero new tax invoices created (Rule 11).

---

## 3. Files Created
- `scripts/reconcile_historical_pos.py`: Production-grade CLI engine supporting `--dry-run`, `--commit`, and automatic backup verification.
- `scripts/test_po_extractor_all.py`: High-performance PDF parser validating 60 PO PDFs and line calculations.
- `backend/tests/test_tattly_po_reconciliation.py`: Pytest test suite asserting the 7 core invariants of the reconciliation.
- `docs/implementation/sales/Tattly_Threads_Historical_PO_Reconciliation_Plan_v1.0.md`: SMRITI IPGP 19-section engineering plan.
- `docs/walkthrough/sales/Tattly_Threads_Historical_PO_Reconciliation_Phase1_v1.0.md`: This walkthrough document.
- `backups/smriti001_pre_phase1_po_recon.sql`: Pre-migration PostgreSQL backup snapshot (4.52 MB).

---

## 4. Files Modified
- `backend/app/models/sales.py`: Extended `SalesOrder` with canonical PO metadata, extended `SalesOrderItem` with PO line fields, and added `SalesOrderInvoiceAllocation` model.
- `docs/walkthrough/README.md`: Appended chronological master index entry.
- `docs/implementation/README.md`: Appended chronological master index entry.
- `CHANGELOG.md`: Logged Phase 1 Historical PO Reconciliation delivery.

---

## 5. Architecture Decisions
- **PDF-First Canonical Truth**: As mandated, all financial totals, line items, and quantities are parsed directly from the 60 authoritative PDF Purchase Orders. Excel matrices were used solely for auxiliary cross-verification.
- **Deduplication Matrix**: Products are resolved using a compound tuple `(EAN, Vendor_Style, Color, Size)` to guarantee 100% deduplication across multiple PO revisions.
- **Idempotency by Design**: Reconciliation runs can be executed repeatedly with zero risk of duplicate sales orders, lines, or allocations (`DELETE + INSERT` in single transaction per order).
- **Separation of Concerns**: Invoice allocations reside in `sales_order_invoice_allocations` linked by foreign keys to preserve immutable separation between sales commitments (orders) and statutory tax documents (invoices).

---

## 6. Design Rationale
- **Preservation of PO Dates**: Historical Sales Orders reflect original PO issuance dates (e.g. `2026-07-31`) to preserve chronological reporting fidelity.
- **Interstate vs Intra-State Tax Handling**: The engine automatically detects tax structures from PDF page 1 and line items, seamlessly handling 58 interstate POs (IGST 5.00%) and 2 intra-state Maharashtra POs (CGST 2.50% + SGST 2.50%).
- **Immutable Terms Preservation**: Capturing all Terms & Conditions clauses into `terms_snapshots` ensures legal non-repudiation and transaction reproducibility.

---

## 7. Implementation Summary

### Metrics Overview
| Dimension | Value |
| :--- | :--- |
| **PO PDFs Processed** | 60 / 60 |
| **Sales Orders Created** | 60 (`SO-5182778151` to `SO-5182778210`) |
| **Sales Order Line Items** | 18,036 |
| **Total Ordered Quantity** | 25,864.000 EA |
| **Total Ordered Basic Value** | INR 30,223,734.22 |
| **Total Ordered Tax Value** | INR 1,511,185.68 |
| **Total Ordered Grand Total** | INR 31,734,919.90 |
| **Unique Products Mapped** | 450 SKUs (147 existing + 303 newly created) |
| **Line Product Linking** | 18,036 / 18,036 (100.0% linked) |
| **Tax Invoices Reconciled** | 120 / 120 (`TT2026-2027/18` to `TT2026-2027/137`) |
| **Invoices Matched / Unmatched** | 120 matched (100.0%) / 0 unmatched |
| **Total Billed Quantity** | 9,027.000 EA |
| **Total Billed Grand Total** | INR 10,600,428.59 (Taxable: INR 8,228,548.40) |
| **Total Pending Quantity** | 16,837.000 EA |
| **Total Pending Grand Total** | INR 21,134,491.31 (Taxable: INR 21,995,185.82) |
| **Terms Snapshots Archived** | 60 snapshots |
| **Allocation Records Created**| 120 records |

---

## 8. Tests Executed
```bash
& "C:\Users\netma\AppData\Local\Programs\Python\Python313\python.exe" -m pytest backend\tests\test_tattly_po_reconciliation.py -v
```

---

## 9. Verification Results
```text
============================= test session starts =============================
platform win32 -- Python 3.13.11, pytest-9.1.1, pluggy-1.6.0 -- C:\Users\netma\AppData\Local\Programs\Python\Python313\python.exe
cachedir: .pytest_cache
rootdir: F:\SMRITRretailNX\backend
configfile: pyproject.toml
plugins: anyio-4.14.2, asyncio-1.4.0
asyncio: mode=Mode.AUTO, debug=False, asyncio_default_fixture_loop_scope=None, asyncio_default_test_loop_scope=function
collecting ... collected 7 items

backend\tests\test_tattly_po_reconciliation.py::test_01_all_60_sales_orders_exist PASSED [ 14%]
backend\tests\test_tattly_po_reconciliation.py::test_02_sales_order_numbers_and_dates PASSED [ 28%]
backend\tests\test_tattly_po_reconciliation.py::test_03_total_po_line_items_and_linking PASSED [ 42%]
backend\tests\test_tattly_po_reconciliation.py::test_04_immutable_terms_snapshots PASSED [ 57%]
backend\tests\test_tattly_po_reconciliation.py::test_05_invoice_allocation_records PASSED [ 71%]
backend\tests\test_tattly_po_reconciliation.py::test_06_unmodified_tax_invoices PASSED [ 85%]
backend\tests\test_tattly_po_reconciliation.py::test_07_no_stock_movements_or_new_invoices PASSED [100%]

============================== 7 passed in 1.57s ==============================
```

---

## 10. Known Limitations
- Stock movements are deliberately deferred to Phase 2 per business policy.
- Generation of tax invoices for remaining pending quantities (16,837 EA) is deferred to Phase 2.

---

## 11. Future Work
- **Phase 2 Execution**: Generation of remaining fulfillment tax invoices for pending quantities on POs `5182778172` and `5182778210` and remaining split deliveries.
- **Phase 3 Execution**: Stock Ledger / WMS synchronization for historical shipments.

---

## 12. Related ADRs
- `ADR-0012`: Sole System-of-Record Architecture (FastAPI + PostgreSQL).
- `ADR-0024`: Multi-Tenant Isolation & Partitioning in Tenant Data Plane (`smriti001`).

---

## 13. Related RFCs
- `RFC-2026-08`: Universal Item Master Convergence & Barcode Resolution Architecture.
- `RFC-2026-11`: Transaction Reproducibility & Legal Snapshot Governance.
