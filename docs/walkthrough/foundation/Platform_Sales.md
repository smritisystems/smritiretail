<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.16.0
  Created      : 2026-08-23
  Modified     : 2026-08-23
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Vertical Slice 3 — Sales, POS, and Inventory Lifecycle & Ledger Unification

## 1. Purpose
Unify B2B Sales Invoicing, POS Checkout, and Inventory Lifecycle posting against the canonical `stock_movements` operational ledger in the SMRITI tenant data plane (`smritiXXX`). This guarantees that every confirmed invoice and POS transaction atomically posts debit entries to `stock_movements`, decrements batch stocks, immutably snapshots statutory tax/pricing calculations, and enables audited reversal idempotency upon cancellation.

---

## 2. Scope
- **Tenant Data Plane (`smritiXXX`) Only**: All invoice headers, line items, and stock movements reside strictly in tenant databases.
- **Inviolable Stock Truth**: `stock_movements` remains the sole operational source of truth.
- **Immutable Transaction Snapshotting**: Permanent line-item capture of `taxable_value`, `gst_rate`, `cgst_amount`, `sgst_amount`, `igst_amount`, `price`, `mrp`, and `disc_pct`.
- **Audited Idempotent Reversals**: Invoice cancellation generates matching `RETURN_INWARD` movements and restores batch/product inventory.

---

## 3. Files Created
1. `backend/app/services/sales_ledger_svc.py`: `UnifiedSalesLedgerService` orchestrating invoice creation, line-level tax calculation, stock debit posting, and cancellation reversals.
2. `backend/tests/t_sales_ledger.py`: Automated verification suite certifying B2B sales posting, IGST calculations, cancellation reversals, and tenant isolation.
3. `docs/implementation/foundation/Platform_Refactor_4.md`: Master 19-section implementation plan for Slice 3.

---

## 4. Files Modified
1. `docs/implementation/README.md`: Appended Slice 3 implementation plan to master index.
2. `docs/architecture/PLATFORM.md`: Updated platform tracker with verified Slice 3 status.
3. `docs/walkthrough/README.md`: Appended Slice 3 walkthrough to chronological master index.

---

## 5. Architecture Decisions
- **ADR-005: Atomic Sales-Ledger Unit of Work**: Invoicing and stock debit posting execute within a single database transaction boundary (`session.begin()`). It is architecturally impossible to generate a confirmed invoice without corresponding `OUTWARD_SALE` movements in `stock_movements`.
- **ADR-006: Immutable Tax & Rate Snapshotting**: Historical invoices must never recalculate taxes based on active master rates. All statutory amounts (`cgst_amount`, `sgst_amount`, `igst_amount`) and discounts are permanently frozen on `sales_invoice_items`.

---

## 6. Design Rationale
Decoupled stock movements and on-the-fly tax calculations cause inventory drift and regulatory reporting discrepancies. Binding sales directly to `stock_movements` and freezing statutory amounts ensures 100% auditability and historical reproducibility.

---

## 7. Implementation Summary
- **B2B Invoicing Flow**:
  - Validates customer and items.
  - Automatically calculates line discounts and GST splits (Intra-state CGST+SGST vs Inter-state IGST).
  - Persists `SalesInvoice` (status="Confirmed") and `SalesInvoiceItem` snapshot records.
  - Posts `StockMovement` (`movement_type="OUTWARD_SALE"`, negative quantity) linked to `invoice_id`.
  - Atomically decrements `Product.stock` and `ProductBatchStock.current_stock_qty`.
- **Cancellation & Reversal Flow**:
  - Transitions `SalesInvoice.status` to `"Cancelled"`.
  - Posts compensating `StockMovement` (`movement_type="RETURN_INWARD"`, positive quantity).
  - Restores master stock and active batch stock balances.

---

## 8. Tests Executed
1. `backend/tests/t_sales_ledger.py`:
   - `test_b2b_sales_invoice_posting_and_stock_debit` (Passed)
   - `test_interstate_sales_invoice_igst_calculation` (Passed)
   - `test_invoice_cancellation_and_stock_reversal` (Passed)
   - `test_sales_invoice_tenant_isolation` (Passed)
2. Full Multi-Module Regression Suite:
   - 73/73 automated tests passed in 26.68s across Routing Boundary, Tenant DB Provisioning, Menu Governance, Security Access, WMS Phases 1–4, Slice 2 Universal Party/Item Masters, and Slice 3 Sales/POS & Stock Ledger Unification.

---

## 9. Verification Results

```text
============================= test session starts =============================
platform win32 -- Python 3.13.11, pytest-9.1.1, pluggy-1.6.0
rootdir: F:\SMRITRretailNX\backend
configfile: pyproject.toml
plugins: anyio-4.14.2, asyncio-1.4.0
asyncio: mode=Mode.AUTO, debug=False, asyncio_default_fixture_loop_scope=None, asyncio_default_test_loop_scope=function
collected 73 items

backend\tests\t_sales_ledger.py ....                          [  5%]
backend\tests\t_univ_party.py ...                         [  9%]
backend\tests\t_univ_item.py ...                          [ 13%]
backend\tests\t_route_boundary.py .............           [ 31%]
backend\tests\t_comp_db_route.py .......                 [ 41%]
backend\tests\t_comp_db_name.py ......                [ 49%]
backend\tests\t_comp_db_wire.py .....                        [ 56%]
backend\tests\t_multi_comp_db.py ......         [ 64%]
backend\tests\t_comp_db_prov.py .....                      [ 71%]
backend\tests\t_menu_gov.py .                                  [ 72%]
backend\tests\t_sec_menu.py ..                            [ 75%]
backend\tests\test_wms_phase1.py ....                                    [ 80%]
backend\tests\t_wms_phase2.py ...                           [ 84%]
backend\tests\t_wms_phase3.py .....                         [ 91%]
backend\tests\t_wms_phase4.py ......             [100%]

======================= 73 passed, 1 warning in 26.68s ========================
```

---

## 10. Known Limitations
- General ledger financial journal posting (debit Accounts Receivable / credit Sales Revenue & Tax Payable) is decoupled from operational stock movements; general ledger unification is scheduled for Slice 4.

---

## 11. Future Work
- **Slice 4**: Pricing, GST, Payments, and Document Engine Unification.
- **Slice 5**: Approval, Workflow, and Communicator Engines.

---

## 12. Related ADRs
- `ADR-001`: Multi-Company Database Architecture.
- `ADR-005`: Inviolable Stock Movement Ledger & Transaction Snapshotting.

---

## 13. Related RFCs
- `RFC-010`: Unified Sales & Operational Stock Ledger Posting.
