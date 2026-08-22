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

# Implementation Plan: Vertical Slice 3 — Sales, POS, and Inventory Lifecycle & Ledger Unification

## 1. Objective
Unify B2B Sales Invoicing, POS Checkout Sessions, and Inventory Lifecycle posting against the canonical `stock_movements` operational ledger in the tenant data plane (`smritiXXX`), enforcing immutable tax/pricing snapshots and guaranteed reversal idempotency.

---

## 2. Business Motivation
In retail and distributor operations, stock balances and sales records must never drift. Every sales invoice confirmation and POS checkout must atomically post debit ledger entries to `stock_movements` and update active batch stocks (`product_batch_stocks`). Furthermore, statutory tax calculations and pricing rules must be permanently snapshotted onto line items to guarantee historical reproducibility.

---

## 3. Scope

### In-Scope
1. **Unified Sales & POS Transaction Lifecycle**:
   - Atomic invoice creation and confirmation with line-level immutable snapshotting (`taxable_value`, `gst_rate`, `cgst_amount`, `sgst_amount`, `igst_amount`, `price`, `mrp`).
   - POS checkout integration with shift binding and tender recording.
2. **Authoritative Stock Movement Posting**:
   - Deterministic creation of `StockMovement` records (`OUTWARD_SALE`, `RETURN_INWARD`) linked to invoices.
   - Atomic decrement and restoration of `product_batch_stocks` and `products.stock`.
3. **Idempotent Reversal & Cancellation**:
   - Cancellation lifecycle restoring stock with audit reference tracking.
4. **Tenant Isolation**:
   - Strict physical isolation of all sales, POS, and stock ledger entries inside `smritiXXX`.

### Out-of-Scope (Deferred)
- External government gateway e-invoice API submissions (handled in separate integration layer).
- Generalized accounting general ledger journal posting (scheduled for Slice 4).
- Offline event synchronization (scheduled for Slice 7).

---

## 4. Current State
- `sales_invoices`, `sales_invoice_items`, `shifts`, and `stock_movements` exist in tenant databases.
- Some legacy endpoints wrote invoice records without guaranteed atomic `stock_movements` ledger entries or left batch decrements decoupled from invoice transactions.

---

## 5. Gap Analysis
| Dimension | Current State | Target Architecture (Slice 3) |
| :--- | :--- | :--- |
| **Stock Ledger Binding** | Inconsistent across legacy sales paths | 100% atomic posting to `stock_movements` for every confirmed invoice and POS checkout |
| **Tax & Pricing Snapshot** | Partially calculated on-the-fly | Immutable line-item snapshotting (`taxable_value`, `gst_rate`, `cgst_amount`, `sgst_amount`, `igst_amount`, `mrp`, `disc_pct`) |
| **Cancellation Reversal** | Manual stock adjustments | Automated, audited `RETURN_INWARD` movement posting with original invoice linkage |
| **Data Plane Boundary** | Tenant DB | Strictly tenant data plane (`smritiXXX`) |

---

## 6. Architecture Impact
- **Inviolable Stock Truth**: `stock_movements` remains the sole, authoritative source of truth for stock quantities.
- **Historical Reproducibility**: Changes to master tax rates or product prices will never alter historical invoice valuations.

---

## 7. Proposed Design

### A. Sales Ledger Service (`backend/app/services/unified_sales_ledger_service.py`)
- `post_sales_invoice_with_stock_ledger`:
  1. Validate party (customer) status.
  2. Compute line-level statutory GST splits (Intra-state CGST+SGST vs Inter-state IGST).
  3. Insert `SalesInvoice` and `SalesInvoiceItem` records.
  4. Post corresponding `StockMovement` records with `movement_type="OUTWARD_SALE"`.
  5. Atomically decrement `ProductBatchStock.current_stock_qty` and `Product.stock`.
- `cancel_sales_invoice_with_stock_reversal`:
  1. Verify invoice is in cancellable state.
  2. Mark invoice status as `CANCELLED`.
  3. Post corresponding `StockMovement` records with `movement_type="RETURN_INWARD"`.
  4. Atomically restore `ProductBatchStock.current_stock_qty` and `Product.stock`.

---

## 8. Files Created
- `backend/app/services/unified_sales_ledger_service.py`: Domain service orchestrating atomic sales invoice creation, POS checkout, stock ledger posting, and reversals.
- `backend/tests/test_unified_sales_ledger.py`: Automated test suite certifying B2B sales posting, POS session checkout, stock movements, tax snapshots, and cancellation reversals.
- `docs/implementation/foundation/Platform_Refactor_Slice3_Sales_POS_Ledger_Plan_v1.0.md`: This implementation plan.

---

## 9. Files Modified
- `docs/implementation/README.md`: Append Slice 3 plan to master index.
- `docs/architecture/SMRITI_PLATFORM_IMPLEMENTATION_STATUS.md`: Track Slice 3 verification.

---

## 10. Dependencies
- Vertical Slice 2: Universal Party and Item Master foundations.
- PostgreSQL tenant databases (`smriti001`, `smriti002`).

---

## 11. Risks
| Risk | Severity | Mitigation |
| :--- | :--- | :--- |
| Concurrency race on batch stock decrement | Medium | Use atomic update queries with row-level locks on `ProductBatchStock` |
| Negative stock edge cases | Medium | Enforce configurable credit limit and stock availability validation |

---

## 12. Rollback Strategy
Database transactions operate within explicit unit-of-work boundaries (`session.begin()`). If an invoice or stock ledger write fails, the entire transaction rolls back cleanly with zero orphaned records.

---

## 13. Verification Plan
1. Create and confirm B2B sales invoices with multi-line items.
2. Verify corresponding `stock_movements` rows are generated with matching `invoice_id`, quantities, and batch numbers.
3. Verify line-level GST amounts (`cgst_amount`, `sgst_amount`, `igst_amount`) match exact mathematical statutory formulas.
4. Execute invoice cancellation and verify stock reversal movements.
5. Verify tenant isolation between `smriti001` and `smriti002`.

---

## 14. Test Plan
- Execute `backend/tests/test_unified_sales_ledger.py`.
- Execute full 70+ test multi-module regression suite.

---

## 15. Documentation Impact
- Update `docs/architecture/SMRITI_PLATFORM_IMPLEMENTATION_STATUS.md`.
- Generate Walkthrough `docs/walkthrough/foundation/Platform_Sales_POS_Ledger_Unification_v6.16.0.md`.
- Update `docs/walkthrough/README.md`.

---

## 16. Deployment Plan
1. Deploy `unified_sales_ledger_service.py`.
2. Run test verification suite.
3. Validate operational state.

---

## 17. Status
**Draft — Ready for Review & Execution**

---

## 18. Related ADRs
- `ADR-001`: Multi-Company Database Architecture.
- `ADR-005`: Inviolable Stock Movement Ledger & Transaction Snapshotting.

---

## 19. Related Walkthroughs
- `docs/walkthrough/foundation/Platform_Universal_Party_Item_Master_v6.16.0.md`.
