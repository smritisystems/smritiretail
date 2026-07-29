<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 7.1.0
  Created      : 2026-07-21
  Modified     : 2026-07-21
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal Architecture Standard
-->

# Sales & Financial Accounting — Outbound Customer Sales Invoicing & Multi-Channel Payment Settlement Engine
**Walkthrough Version:** v7.1.0  
**Date:** 2026-07-21  
**Author:** Jawahar Ramkripal Mallah  
**Status:** Completed & Verified (64/64 PASSED)

---

## 1. Purpose

Establishes the enterprise **Outbound Customer Sales Invoicing & Multi-Channel Payment Settlement Engine** in SMRITI Retail OS. Provides automated conversion of customer sales orders into tax-compliant `SalesInvoice` documents, item-level GST tax breakdown (CGST, SGST, IGST), multi-channel customer payment receipt settlement (`CASH`, `CARD`, `UPI`, `CREDIT`), and real-time customer account ledger balance (`Customer.outstanding`) updates.

---

## 2. Scope

- New Alembic DDL migration: `v710_sales_invoicing_engine.py` — creates `sales_invoices`, `sales_invoice_items`, and `sales_payments` tables with full `BaseEntity` audit columns.
- Unified ORM models in `app/models/sales.py`: `SalesInvoice`, `SalesInvoiceItem`, `SalesPayment`.
- New `SalesInvoicingEngine` domain service (`app/sales/engine/invoicing_engine.py`):
  - `generate_invoice_from_order()`: converts confirmed/shipped sales order into tax invoice with intra-state (CGST + SGST) or inter-state (IGST) line item tax breakdown.
  - `record_payment()`: records customer payment receipt (`CASH`, `CARD`, `UPI`, `CREDIT`), updates invoice `paid_amount` and `balance_due`, sets status to `Paid` or `Partial`, and adjusts `Customer.outstanding` ledger in real time.
  - `get_customer_statement()`: calculates total customer billed amount, total payments, and current outstanding ledger balance.
- New REST API router: `/api/v1/sales` (`POST /invoices/from-order/{id}`, `GET /invoices/{id}`, `POST /payments`, `GET /customers/{id}/statement`).
- Pydantic DTO schemas: `SalesInvoiceResponse`, `SalesInvoiceItemResponse`, `SalesPaymentCreate`, `SalesPaymentResponse`, `CustomerStatementResponse`.
- 6 integration test assertions verifying GST tax computation, cash/card/UPI full/partial settlement, credit sale ledger balance increase, overpayment rejection, and multi-tenant isolation.

---

## 3. Files Created

| File | Role |
|------|------|
| `backend/alembic/versions/v710_sales_invoicing_engine.py` | Alembic DDL migration — creates `sales_invoices`, `sales_invoice_items`, `sales_payments` tables |
| `backend/app/sales/engine/invoicing_engine.py` | SalesInvoicingEngine domain service — invoice generation, GST tax breakdown, payment settlement, customer ledger |
| `backend/app/schemas/sales_invoicing.py` | Pydantic DTO schemas for sales invoices, invoice items, payments, and customer ledger statements |
| `backend/app/api/v1/sales_invoicing.py` | REST API gateway: `/sales/invoices`, `/sales/payments`, `/sales/customers/{id}/statement` |
| `backend/app/tests/test_sales_invoicing.py` | 6 integration test assertions for complete outbound sales invoicing and payment settlement lifecycle |

---

## 4. Files Modified

| File | Change |
|------|--------|
| `backend/app/models/sales.py` | Unified `SalesInvoice`, `SalesInvoiceItem`, and `SalesPayment` ORM models |
| `backend/app/models/__init__.py` | Exported `SalesPayment` |
| `backend/app/main.py` | Imported and mounted `sales_invoicing.router` under `/api/v1` |
| `docs/walkthrough/README.md` | Appended v7.1.0 entry to master walkthrough index |

---

## 5. Architecture Decisions

### AD-01: Real-Time Dual Ledger Settlement
Customer settlement modes operate as follows:
- **CASH / CARD / UPI**: Immediate financial settlement. Decreases `SalesInvoice.balance_due` and reduces `Customer.outstanding` balance if an existing credit balance exists.
- **CREDIT**: Deferred settlement. Decreases `SalesInvoice.balance_due` (marking invoice settled on credit terms) and increases `Customer.outstanding` ledger balance in real time.

### AD-02: Intra-State vs Inter-State GST Engine
- **Intra-State Supply**: Total GST rate split equally into CGST ($\frac{\text{GST \%}}{2}$) and SGST ($\frac{\text{GST \%}}{2}$).
- **Inter-State Supply**: Full GST rate assigned to IGST ($\text{GST \%}$).

---

## 6. Implementation Summary

### Database Schema

```text
sales_invoices
    id, uuid, tenant_id, company_id, branch_id, invoice_no, order_id, customer_id,
    invoice_date, due_date, subtotal, tax_total, cgst_amount, sgst_amount, igst_amount,
    discount_amount, grand_total, paid_amount, balance_due, status (Unpaid/Partial/Paid), notes

sales_invoice_items
    id, uuid, tenant_id, company_id, branch_id, invoice_id, product_id,
    quantity, unit_price, gst_percentage, cgst_amount, sgst_amount, igst_amount, line_total

sales_payments
    id, uuid, tenant_id, company_id, branch_id, payment_no, invoice_id, customer_id,
    payment_date, payment_mode (CASH/CARD/UPI/CREDIT), amount, reference_no, notes
```

### API Endpoints

| Method | Path | Operation |
|--------|------|-----------|
| `POST` | `/api/v1/sales/invoices/from-order/{order_id}` | Generate sales invoice from order |
| `GET` | `/api/v1/sales/invoices/{id}` | Get sales invoice details |
| `POST` | `/api/v1/sales/payments` | Record customer payment receipt |
| `GET` | `/api/v1/sales/customers/{customer_id}/statement` | Get customer account ledger statement |

---

## 7. Tests Executed & Results

**Command:**
```powershell
$env:PYTHONPATH="."; python -m pytest app/tests/test_product_vendor.py app/tests/test_vendor_contract.py app/tests/test_three_way_matching.py app/tests/test_rfq_quotation.py app/tests/test_blanket_agreement.py app/tests/test_purchase_requisition.py app/tests/test_quality_inspection.py app/tests/test_supplier_scorecard.py app/tests/test_sales_fulfillment.py app/tests/test_sales_invoicing.py -v
```

**Verification Results:**

| # | Test | Status |
|---|------|--------|
| 1 | `test_generate_invoice_from_sales_order_calculates_gst` | **PASSED** |
| 2 | `test_record_cash_payment_reduces_invoice_balance` | **PASSED** |
| 3 | `test_partial_payment_updates_status_to_partial` | **PASSED** |
| 4 | `test_credit_sale_increases_customer_outstanding` | **PASSED** |
| 5 | `test_overpayment_rejected_with_http_400` | **PASSED** |
| 6 | `test_multi_tenant_isolation_for_sales_invoicing` | **PASSED** |

**Overall Result: 64/64 PASSED across complete procurement, receiving, sales fulfillment, and sales invoicing stack**

**Verification Status: Done**
