<!--
  SMRITI Retail OS — Masterbook
  Document  : 02_ARCHITECTURE/MASTER_OWNERSHIP_POLICY.md
  Status    : FROZEN (AFR-002, AP-008)
  Version   : 1.0.0  |  Created: 2026-08-10
-->

# Master Ownership Policy

---

## Principle

Every master record (Customer, Supplier, Product, Price List) is **owned by one company**.
A master record created in Company A is NOT visible, usable, or modifiable by Company B.

---

## Ownership Column Contract

```sql
-- Every master table must have:
company_id  VARCHAR(50) NOT NULL REFERENCES companies(id)
branch_id   VARCHAR(50) REFERENCES branches(id)  -- optional for company-wide masters
tenant_id   VARCHAR(50)                           -- SaaS tenant
```

---

## Cross-Company Master Use

| Scenario | Policy |
|---|---|
| Company A customer used in Company A invoice | ✅ Allowed |
| Company A customer used in Company B invoice | ❌ REJECTED — orchestrator returns 404 |
| Company A product visible in Company B POS | ❌ — product list filtered by company_id |
| Shared product catalog across companies | ✅ Via Platform-level master (tenant_id, no company_id) |

---

## Item Attribute Snapshot Governance (AP-008) — FROZEN

**Rule:** String equality between a Product attribute value and a `MasterValue.name` does NOT constitute persistent identity linkage.

- `MasterValue` governs: future item creation, Excel import validation, selection dropdowns
- `Product` retains: point-in-time historical item snapshot

**Master lookup value updates MUST NOT retroactively mutate:**
- Existing item attributes
- SKUs or barcodes
- Transaction document ledgers (invoices, POs, stock movements)

E8 Edit-Time Synchronization is **CLOSED BY ARCHITECTURAL DESIGN**.

---

## Service Layer Ownership Enforcement Pattern

```python
# Pattern: Every service query filters by company_id from TenantContext
async def get_customer(self, customer_id: str) -> Customer:
    result = await self.db.execute(
        select(Customer).where(
            Customer.id == customer_id,
            Customer.company_id == self.tenant_ctx.company_id,  # ← MANDATORY
            Customer.is_deleted == False,
        )
    )
    customer = result.scalars().first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer
```

**Rule:** Never fetch a master record by ID alone. Always include `company_id == tenant_ctx.company_id`.

---

## Orchestrator-Level Ownership Validation

For transaction creation (e.g. sales invoices), the orchestrator MUST validate that every referenced master record belongs to the current company:

```python
# SalesBusinessOrchestrator — customer-tenant check (F-INV-TC, SCS-INV-001)
if invoice_in.customer_id:
    cust_check = await self.db.execute(
        select(Customer).where(
            Customer.id == invoice_in.customer_id,
            Customer.company_id == self.tenant_ctx.company_id,
            Customer.is_deleted == False,
        )
    )
    if not cust_check.scalars().first():
        raise HTTPException(status_code=404, detail="Customer not found in this company")
```

This pattern applies to: customer, supplier, product, price list, tax profile references.

---

*Status: FROZEN — AP-008, AFR-002 | Version: 1.0.0 | 2026-08-10*
