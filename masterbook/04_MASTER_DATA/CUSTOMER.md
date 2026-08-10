<!--
  SMRITI Retail OS — Masterbook
  Document  : 04_MASTER_DATA/CUSTOMER.md
  Status    : FROZEN (SCS-INV-001, AP-008)
  Version   : 1.0.0  |  Created: 2026-08-10
-->

# Customer Master — Architecture Reference

---

## Customer Aggregate Root

Customer is a **DDD Aggregate Root** in SMRITI. It governs:
- `CustomerAddress` (sub-entity)
- `CustomerContact` (sub-entity)
- `CustomerTaxProfile` (sub-entity)
- `CustomerCreditProfile` (sub-entity)
- `CustomerCommunicationPreference` (sub-entity)

All operations on customer sub-entities go through the aggregate root (`CrmService`).

---

## Customer Table Key Columns

```sql
customers
─────────────────────────────────────────────────────
id                  VARCHAR(50) PK   -- "cust-{hex12}"
uuid                VARCHAR(36)      -- Public external ID
code                VARCHAR(50) NOT NULL  -- "CUS-100001" (auto-generated)
name                VARCHAR(255) NOT NULL
mobile              VARCHAR(20)
email               VARCHAR(255)
gst_number          VARCHAR(15)      -- GSTIN (validated)
company_id          VARCHAR(50) NOT NULL FK → companies
branch_id           VARCHAR(50) FK → branches
tenant_id           VARCHAR(50)
version             INT NOT NULL DEFAULT 1
loyalty_tier        VARCHAR(30) DEFAULT 'Bronze'
loyalty_points_balance NUMERIC(15,2) DEFAULT 0.00
lifetime_points     NUMERIC(15,2) DEFAULT 0.00
lifecycle_stage     VARCHAR(30) DEFAULT 'Customer'
account_status      VARCHAR(20) DEFAULT 'Active'
status              VARCHAR(20) DEFAULT 'Active'
created_date        DATE DEFAULT today()   -- NOTE: DATE not DATETIME
billing_policy      VARCHAR(30) DEFAULT 'InvoiceOnDispatch'
is_active           BOOLEAN NOT NULL DEFAULT true
is_deleted          BOOLEAN NOT NULL DEFAULT false
```

> ⚠️ `created_date` is `DATE` type. If the ORM uses `default=datetime.utcnow`, it stores a `datetime` object — Pydantic's `CustomerResponse` will raise `date_from_datetime_inexact`. Always store `date.today()`.

---

## Customer Code Auto-Generation

```python
async def _generate_customer_code(self) -> str:
    count = await db.scalar(select(func.count(Customer.id)).where(
        Customer.company_id == tenant_ctx.company_id
    ))
    return f"CUS-{100001 + count}"
```

Customer codes are company-scoped. "CUS-100001" in Company A is different from "CUS-100001" in Company B.

---

## Customer API Endpoints

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/v1/customers` | Create customer (no trailing slash) |
| `GET` | `/api/v1/customers` | List customers (tenant-scoped) |
| `GET` | `/api/v1/customers/{id}` | Get by ID |
| `PUT` | `/api/v1/customers/{id}` | Update |
| `DELETE` | `/api/v1/customers/{id}` | Soft-delete |
| `GET` | `/api/v1/customers/search` | Search by name/mobile/GSTIN |

---

## Quick Add Customer Flow (SCS-INV-001)

Used in the Sales Billing Studio for adding customers on the fly:

```
User clicks "+ Add New" in customer selector
    ↓
Quick Add Modal (Name, Mobile, GSTIN)
    ↓
ICustomerService.save(customerData)
    ↓
POST /api/v1/customers  { name, mobile, gst_number }
    ↓
Backend: CrmService.create_customer()
    ↓
  - Auto-generates code ("CUS-XXXXXX")
  - Sets company_id from TenantContext
  - Commits to PostgreSQL
  - Returns CustomerResponse with real DB id
    ↓
Frontend: normalizeBackendCustomer(response)  → id = response.id
    ↓
setSelectedCustomer(newCustomer)  ← auto-selected
    ↓
refreshCustomerList()
    ↓
Invoice POST includes customerId = newCustomer.id ✅
```

**Critical:** `CustomerService.save()` must NOT silently return a local fake ID (`cust_${Date.now()}`) on backend failure. It must throw so the modal shows an error. A fake ID would pass the frontend guard but fail the orchestrator's customer-tenant validation.

---

## Customer-Invoice Wiring Contract (SCS-INV-001)

```
Frontend: selectedCustomer.id  (from dropdown OR Quick Add)
    ↓
CreateSalesInvoiceCommand.customerId = selectedCustomer.id
    ↓
SalesService.saveInvoice(): record.customerId = invoiceData.customerId
    ↓
apiFetchV1 POST /api/v1/sales/invoices
Body: { customerId: "cust-abc123", ... }
    ↓
FastAPI: SalesInvoiceBase.customer_id via AliasChoices("customer_id","customerId")
    ↓
SalesBusinessOrchestrator: verify customer.company_id == tenant_ctx.company_id
    ↓
INSERT INTO sales_invoices (customer_id = "cust-abc123", ...)
```

**If `customer_id` is absent from the payload → FastAPI returns 422 immediately.**
**If `customer_id` belongs to another company → Orchestrator returns 404.**

---

## Walk-In / Cash Sale (Open — ADR Required)

Walk-in invoicing (no named customer) requires:
1. An ADR documenting the decision
2. A provisioned "Walk-In Customer" row per company (`id: "cust-walkin-{company_id}"`)

`customer_id` cannot be made optional — this is a hard FK and business integrity rule.

---

*Status: FROZEN — SCS-INV-001, AP-008 | Version: 1.0.0 | 2026-08-10*
