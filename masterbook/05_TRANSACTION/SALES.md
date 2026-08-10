<!--
  SMRITI Retail OS — Masterbook
  Document  : 05_TRANSACTION/SALES.md
  Status    : FROZEN (SCS-INV-001)
  Version   : 1.0.0  |  Created: 2026-08-10
-->

# Sales Transaction Architecture

---

## Sales Invoice — Data Flow

```
SalesBillingStudio (React)
    │
    ├── selectedCustomer  (required — must have real DB id)
    ├── items[]           (product lines with qty, rate, discount, GST)
    ├── paymentMode       (Cash | Card | UPI | Credit)
    └── docDate           (invoice date)
            │
            ▼
    handleConfirmPostInvoice()
            │
    Frontend guard: if (!selectedCustomer?.id) → toast error, return
            │
    CreateSalesInvoiceCommand({
        customerId: selectedCustomer.id,     ← MUST be present
        invoiceNumber, invoiceDate,
        items, payments, totals, ...
    })
            │
    SPK.commands.execute(command)
            │
    SalesService.saveInvoice(invoiceData)
            │
    SalesInvoiceRecord { customerId: invoiceData.customerId, ... }
            │
    apiFetchV1 POST /api/v1/sales/invoices
    Body: { customerId: "cust-abc123", ... }
            │
    FastAPI — SalesInvoiceCreate schema
    customer_id: str = Field(..., AliasChoices("customer_id", "customerId"))
            │
    SalesBusinessOrchestrator.create_sales_invoice()
            │
    ├── Customer ownership check (customer.company_id == tenant_ctx.company_id)
    ├── Numbering (auto-generate invoice_no if omitted)
    ├── Tax calculation
    └── INSERT INTO sales_invoices + sales_invoice_items + sales_invoice_payments
```

---

## SalesInvoiceBase Schema (FastAPI)

```python
class SalesInvoiceBase(BaseModel):
    invoice_no:  Optional[str]
    date:        date = Field(default_factory=date.today)
    customer_id: str  = Field(..., AliasChoices("customer_id", "customerId"))  # REQUIRED
    is_interstate: bool = Field(False, ...)
    grand_total:  Decimal
    tax_total:    Decimal
    status:       str = "Draft"
```

`customer_id` is **required** (`...`). It must not become `Optional`. The `SalesInvoiceCreate` inherits this without override — the field remains required.

---

## Invoice Line Item Schema

```python
class SalesInvoiceItemCreate(BaseModel):
    product_id:   str    = Field(..., AliasChoices("product_id", "productId"))
    quantity:     Decimal = Field(Decimal("1.0000"), ...)
    unit_price:   Decimal
    discount_pct: Decimal = Decimal("0.00")
    gst_rate:     Decimal = Field(Decimal("18.00"), AliasChoices("gst_rate","taxRate","gstRate"))
    cgst_amount:  Decimal = Decimal("0.00")
    sgst_amount:  Decimal = Decimal("0.00")
    igst_amount:  Decimal = Decimal("0.00")
```

---

## GST Tax Calculation

Handled by `STRE.calculateTaxes(TaxContext)` in the frontend. The engine determines:
- CGST + SGST (intra-state)
- IGST (inter-state)
- Tax-inclusive vs tax-exclusive pricing (`pricingPolicy: "EXCLUSIVE" | "INCLUSIVE"`)

Tax amounts are computed client-side and sent in the payload. The backend validates but does not recalculate (design choice: tax engine is in the kernel).

---

## Payment Modes

```typescript
type PaymentMode = "Cash" | "Card" | "UPI" | "Credit" | "Mixed";
```

Each payment record:
```python
class SalesInvoicePaymentCreate(BaseModel):
    payment_mode:   str    = Field(..., AliasChoices("payment_mode", "paymentMode"))
    amount:         Decimal
    transaction_no: Optional[str]  # UPI ref, card auth no, etc.
```

---

## Invoice Status Lifecycle

```
Draft → Posted → Cancelled
         ↓
      Returned (partial or full return)
```

State transitions via `SPK.workflow.executeTransition()` (UWR-002).

---

## Key Business Rules

| Rule | Mandate |
|---|---|
| `customer_id` required | Every invoice must have a named customer |
| Customer must belong to same company | Orchestrator validates ownership — 404 if not |
| `invoice_no` auto-generated if omitted | Numbering engine generates sequential codes |
| Walk-in sales | Requires ADR + provisioned walk-in customer row (open) |
| Frontend guard | Block POST if `!selectedCustomer?.id` before hitting server |
| Backend 422 | FastAPI returns 422 if `customer_id` is absent — even if frontend is bypassed |

---

## Regression Test Suite (SCS-INV-001)

| Test | Assertion |
|---|---|
| T-A / T1 | Existing customer → invoice accepted (non-422) |
| T-B / T3 | No customer_id → 422 |
| T-C / T4 | Cross-company customer → 404 |
| T-D | Customer + invoice persisted in PostgreSQL |
| T-E | Walk-in path → skipped pending ADR |
| T2 | Quick Add customer DB id → invoice accepted |
| T5 | Company B list excludes Company A customer |
| T6 | Quick Add customer persists in DB |

All 10 tests MUST pass. TS: 0 errors.

---

## Files

| File | Role |
|---|---|
| `src/components/sales/SalesBillingStudio.tsx` | UI — customer selection, quick add, POST guard |
| `src/kernel/public/ISalesService.ts` | Contract — `customerId?: string` |
| `src/kernel/internal/SalesService.ts` | Implementation — maps customerId to record |
| `backend/app/schemas/sales.py` | FastAPI schemas — AliasChoices |
| `backend/app/services/sales_orchestrator.py` | Orchestrator — customer-tenant validation |
| `backend/app/tests/test_sales_invoice_customer_wiring.py` | Original 4+1 tests |
| `backend/app/tests/test_customer_invoice_wiring_final.py` | Final 6 tests |

---

*Status: FROZEN — SCS-INV-001 | Version: 1.0.0 | 2026-08-10*
