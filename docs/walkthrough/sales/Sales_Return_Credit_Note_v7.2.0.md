<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 7.2.0
  Created      : 2026-07-21
  Modified     : 2026-07-21
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal Architecture Standard
-->

# Sales & Financial Accounting — Outbound Customer Sales Returns & Credit Note Engine
**Walkthrough Version:** v7.2.0  
**Date:** 2026-07-21  
**Author:** Jawahar Ramkripal Mallah  
**Status:** Completed & Verified (70/70 PASSED)

---

## 1. Purpose

Establishes the enterprise **Outbound Customer Sales Returns & Credit Note Engine** in SMRITI Retail OS. Provides automated processing of customer return requests (`SalesReturn`), product condition inspection (`Restockable` vs `Damaged`), automatic inventory restocking for usable stock, tax-compliant `CreditNote` issuance with GST reversal (CGST, SGST, IGST), and real-time customer account ledger balance (`Customer.outstanding`) reduction.

---

## 2. Scope

- New Alembic DDL migration: `v720_sales_return_credit_note.py` — creates `sales_returns`, `sales_return_items`, and `credit_notes` tables with full `BaseEntity` audit columns.
- Unified ORM models in `app/models/sales.py`: `SalesReturn`, `SalesReturnItem`, `CreditNote`.
- New `SalesReturnEngine` domain service (`app/sales/engine/return_engine.py`):
  - `create_sales_return()`: converts customer return request against an active `SalesInvoice` into a draft return order, validating returned quantities against invoiced item quantities.
  - `evaluate_and_process_return()`: inspects line items; restocks `Restockable` items back into `Product.stock`, routes `Damaged` items to scrap without stock increment, generates a `CreditNote` with GST reversal, updates `Customer.outstanding`, and sets return status to `Approved`.
- New REST API router: `/api/v1/sales` (`POST /returns`, `POST /returns/{id}/evaluate`, `GET /returns/{id}`, `GET /credit-notes/{id}`).
- Pydantic DTO schemas: `SalesReturnCreate`, `SalesReturnResponse`, `ReturnEvaluationRequest`, `CreditNoteResponse`.
- 6 integration test assertions verifying return creation, usable stock restocking, damaged stock quarantine, GST credit note reversal, excess quantity rejection, and multi-tenant isolation.

---

## 3. Files Created

| File | Role |
|------|------|
| `backend/alembic/versions/v720_sales_return_credit_note.py` | Alembic DDL migration — creates `sales_returns`, `sales_return_items`, `credit_notes` tables |
| `backend/app/sales/engine/return_engine.py` | SalesReturnEngine domain service — return processing, condition evaluation, inventory restocking, CreditNote generation |
| `backend/app/schemas/sales_return.py` | Pydantic DTO schemas for sales returns, return items, evaluation requests, and credit notes |
| `backend/app/api/v1/sales_return.py` | REST API gateway: `/sales/returns`, `/sales/returns/{id}/evaluate`, `/sales/credit-notes/{id}` |
| `backend/app/tests/test_sales_return.py` | 6 integration test assertions for complete outbound sales return and credit note lifecycle |

---

## 4. Files Modified

| File | Change |
|------|--------|
| `backend/app/models/sales.py` | Unified `SalesReturn`, `SalesReturnItem`, and `CreditNote` ORM models |
| `backend/app/main.py` | Imported and mounted `sales_return.router` under `/api/v1` |
| `docs/walkthrough/README.md` | Appended v7.2.0 entry to master walkthrough index |

---

## 5. Architecture Decisions

### AD-01: Product Condition Inspection Rules
- **Restockable**: Item is salable; immediately increments `Product.stock += quantity`.
- **Damaged**: Item is spoiled/broken; recorded for salvage/scrap, does NOT increment salable `Product.stock`.

### AD-02: Credit Note Tax Reversal Engine
- Reverses line-item GST amounts (CGST, SGST, IGST) proportionally to returned quantities.
- Reduces `Customer.outstanding` ledger balance by `CreditNote.grand_total`.

---

## 6. Implementation Summary

### Database Schema

```text
sales_returns
    id, uuid, tenant_id, company_id, branch_id, return_no, invoice_id, customer_id,
    return_date, reason, status (Draft/Approved/Rejected), refund_amount, credit_note_id

sales_return_items
    id, uuid, tenant_id, company_id, branch_id, return_id, product_id,
    quantity, unit_price, condition (Restockable/Damaged), gst_percentage,
    cgst_amount, sgst_amount, igst_amount, line_total

credit_notes
    id, uuid, tenant_id, company_id, branch_id, credit_note_no, return_id, invoice_id, customer_id,
    issue_date, subtotal, tax_amount, cgst_amount, sgst_amount, igst_amount, grand_total, status, notes
```

### API Endpoints

| Method | Path | Operation |
|--------|------|-----------|
| `POST` | `/api/v1/sales/returns` | Create draft sales return request |
| `POST` | `/api/v1/sales/returns/{id}/evaluate` | Evaluate line condition & issue credit note |
| `GET` | `/api/v1/sales/returns/{id}` | Get sales return details |
| `GET` | `/api/v1/sales/credit-notes/{id}` | Get credit note details |

---

## 7. Tests Executed & Results

**Command:**
```powershell
$env:PYTHONPATH="."; python -m pytest app/tests/test_product_vendor.py app/tests/test_vendor_contract.py app/tests/test_three_way_matching.py app/tests/test_rfq_quotation.py app/tests/test_blanket_agreement.py app/tests/test_purchase_requisition.py app/tests/test_quality_inspection.py app/tests/test_supplier_scorecard.py app/tests/test_sales_fulfillment.py app/tests/test_sales_invoicing.py app/tests/test_sales_return.py -v
```

**Verification Results:**

| # | Test | Status |
|---|------|--------|
| 1 | `test_create_sales_return_for_valid_invoice` | **PASSED** |
| 2 | `test_evaluate_return_restocks_inventory` | **PASSED** |
| 3 | `test_damaged_return_does_not_restock` | **PASSED** |
| 4 | `test_issue_credit_note_reverses_gst` | **PASSED** |
| 5 | `test_excess_return_quantity_rejected_with_http_400` | **PASSED** |
| 6 | `test_multi_tenant_isolation_for_sales_returns` | **PASSED** |

**Overall Result: 70/70 PASSED across complete procurement, receiving, sales fulfillment, invoicing, and return stack**

**Verification Status: Done**
