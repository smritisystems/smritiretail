<!--
  SMRITI Retail OS — Masterbook
  Document  : 02_ARCHITECTURE/SCHEMA_GOVERNANCE.md
  Status    : FROZEN (AFR-002)
  Version   : 1.0.0  |  Created: 2026-08-10
-->

# Schema Governance

---

## Pydantic Schema Design Rules

### camelCase ↔ snake_case Bridge

All Pydantic schemas use `AliasChoices` to accept both camelCase (frontend) and snake_case (backend) field names:

```python
from pydantic import Field, AliasChoices

customer_id: str = Field(
    ...,
    max_length=50,
    validation_alias=AliasChoices("customer_id", "customerId")
)
```

**Why:** The frontend (TypeScript) sends camelCase JSON. The backend (Python) uses snake_case. `AliasChoices` bridges both without transformation middleware.

### Schema Tiers

| Schema Class | Purpose | Notes |
|---|---|---|
| `*Base` | Shared field definitions | No id, no audit fields |
| `*Create` | Input for POST | Inherits Base; id is optional (server may generate) |
| `*Update` | Input for PUT/PATCH | All fields `Optional[T] = None` |
| `*Response` | Output serialization | Includes id, uuid, audit timestamps, sub-entities |

### Response Schema Contract

`*Response` classes use `model_config = ConfigDict(from_attributes=True)` to serialize ORM objects directly.

**Critical:** Every field in a `*Response` class that has no default MUST be present on the ORM model, or Pydantic will raise `ResponseValidationError`.

Common pitfalls:
- `created_date`: must be a `date` object, not `datetime` (Column uses `Date` type)
- `code`, `uuid`, `version`: non-optional in response — must be set on every created row
- `loyalty_tier`, `loyalty_points_balance`, `lifetime_points`: required on `CustomerResponse`

---

## FastAPI Endpoint Patterns

### Standard Create Endpoint
```python
@router.post("/customers", response_model=CustomerResponse, status_code=201)
async def create_customer(
    customer_in: CustomerCreate,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    service = CrmService(db, tenant_ctx)
    return await service.create_customer(customer_in)
```

**Rules:**
- Always use `status_code=201` for creates
- Always inject `tenant_ctx` — never access `company_id` from the request body
- Never use trailing slashes in endpoint paths (causes 307 redirect)

### Trailing Slash Rule

```python
# CORRECT
@router.post("/customers")
@router.get("/customers")

# WRONG — causes 307 Temporary Redirect
@router.post("/customers/")
@router.get("/customers/")
```

---

## TypeScript → Backend Field Mapping

| Frontend (TS) | Backend schema field | AliasChoices |
|---|---|---|
| `customerId` | `customer_id` | `AliasChoices("customer_id", "customerId")` |
| `invoiceDate` | `date` | `AliasChoices("date", "invoiceDate")` |
| `isInterstate` | `is_interstate` | `AliasChoices("is_interstate", "isInterstate")` |
| `paymentMode` | `payment_mode` | `AliasChoices("payment_mode", "paymentMode")` |
| `productId` | `product_id` | `AliasChoices("product_id", "productId")` |
| `taxRate` | `gst_rate` | `AliasChoices("gst_rate", "taxRate", "gstRate")` |

**Rule:** When adding a new field, always add `AliasChoices` accepting both camelCase and snake_case.

---

## Required vs Optional Fields — Decision Rule

| Field | Rule |
|---|---|
| Foreign Keys (e.g. `customer_id`) | **Required** — never make optional |
| Business identifiers (e.g. `invoice_no`) | Required at creation |
| Audit fields | Auto-populated by the server |
| Optional master data | `Optional[T] = None` |
| Nested sub-entities in Create | `Optional[SubEntity] = None` or `List[Sub] = []` |

**Specifically:** `customer_id` in `SalesInvoiceCreate` MUST remain required (`str = Field(...)`). Making it optional breaks the FK contract and enables ghost invoices with no customer.

---

*Status: FROZEN | Version: 1.0.0 | 2026-08-10*
