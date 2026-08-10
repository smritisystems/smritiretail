<!--
  SMRITI Retail OS — Masterbook
  Document  : 03_SECURITY/COMPANY_ISOLATION.md
  Status    : FROZEN (PROD-004, SCS-INV-001)
  Version   : 1.0.0  |  Created: 2026-08-10
-->

# Company Isolation

---

## Isolation Contract

**Every business data row belongs to exactly one company.**
**No query may return data across company boundaries.**
**No transaction may reference master data from another company.**

---

## Enforcement Layers

### Layer 1 — Database Column
Every business table has `company_id NOT NULL`. The column is the physical boundary.

### Layer 2 — TenantContext Injection
```python
tenant_ctx: TenantContext = Depends(get_tenant_context)
# Resolved from JWT. Immutable. company_id is authoritative.
```

### Layer 3 — Service Query Filter
```python
# Every SELECT must include company_id filter
select(Customer).where(
    Customer.company_id == self.tenant_ctx.company_id,
    Customer.is_deleted == False,
)
```

### Layer 4 — Orchestrator Ownership Validation
For transactions, validate that EVERY referenced master belongs to the current company:

```python
# Invoice creation — customer ownership check
cust = await db.execute(
    select(Customer).where(
        Customer.id == invoice_in.customer_id,
        Customer.company_id == tenant_ctx.company_id,  # ← isolation
    )
)
if not cust.scalars().first():
    raise HTTPException(404, "Customer not found in this company")
```

### Layer 5 — Frontend Cache Flush
On company switch, `Workspace.Changed.v1` event forces all services to flush local caches. Company A data cannot leak into Company B's UI session.

---

## Known Isolation Violations (Never Do These)

| Anti-Pattern | Why It's a Violation |
|---|---|
| `SELECT * FROM customers` without `company_id` filter | Returns all companies' customers |
| Using `customer.id` from frontend without orchestrator check | Allows cross-company customer injection |
| `CustomerService` cache not flushed on company switch | Company A customer IDs appear in Company B invoices |
| Making `customer_id` optional in `SalesInvoiceCreate` | Allows ghost invoices with no customer association |
| Fake local ID fallback in `CustomerService.save()` | A fake `cust_${Date.now()}` ID has no DB row → orchestrator 404 |

---

## Regression Tests — Company Isolation

These tests MUST pass on every release:

| Test | File | What It Proves |
|---|---|---|
| `test_tc_cross_company_customer_rejected` | `test_sales_invoice_customer_wiring.py` | Company A customer → Company B invoice → 404 |
| `test_4_company_isolation_rejects_cross_company_customer` | `test_customer_invoice_wiring_final.py` | Same — final suite |
| `test_5_company_switch_customer_not_in_new_company` | `test_customer_invoice_wiring_final.py` | GET /customers/ is tenant-scoped |

---

## Environment Isolation (PROD-004)

| Environment | DB Name | Rule |
|---|---|---|
| Production | `smriti_prod` | Zero demo/test data. Never deletable from UI. |
| Demo | `smriti_demo` | Isolated. Watermark on all documents. |
| Training | `smriti_training` | Isolated. Separate users. |
| Test | `smriti_test` | Automated test target. Never prod data. |
| Development | `smriti_dev` | Local dev only. |

Data movement across environments only via explicit backup/restore/import/export operations.

---

*Status: FROZEN — PROD-004, SCS-INV-001 | Version: 1.0.0 | 2026-08-10*
