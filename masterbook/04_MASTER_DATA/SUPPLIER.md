<!--
  SMRITI Retail OS — Masterbook
  Document  : 04_MASTER_DATA/SUPPLIER.md
  Status    : FROZEN
  Version   : 1.0.0  |  Created: 2026-08-10
-->

# Supplier Master — Architecture Reference

---

## Overview

Supplier is a first-class DDD Aggregate Root in SMRITI, symmetrical to Customer in the CRM domain. It is managed through the Universal Person Workspace (`crm-studio`).

---

## Supplier Table Key Columns

```sql
suppliers
─────────────────────────────
id              VARCHAR(50) PK   -- "supp-{hex12}"
code            VARCHAR(50) NOT NULL
name            VARCHAR(255) NOT NULL
mobile          VARCHAR(20)
email           VARCHAR(255)
gst_number      VARCHAR(15)      -- GSTIN
pan_number      VARCHAR(10)      -- PAN
company_id      VARCHAR(50) NOT NULL FK → companies
branch_id       VARCHAR(50) FK → branches
credit_days     INT DEFAULT 30
payment_terms   VARCHAR(50)
is_active       BOOLEAN NOT NULL DEFAULT true
is_deleted      BOOLEAN NOT NULL DEFAULT false
```

---

## Supplier Policy Engine

Business behavior for suppliers is driven by `SupplierPolicyEngine`, not duplicate screens.

Policy dimensions:
- Credit terms (30 / 60 / 90 days)
- Payment discount
- Return policy
- GST TDS applicability

Rule PROD-001: If a supplier behavior difference can be achieved via policy → extend `SupplierPolicyEngine`. Do NOT create a new screen or module.

---

## Supplier-Invoice Wiring

Every Purchase Order must reference a valid `supplier_id` from the same company. The same orchestrator ownership validation pattern applies:

```python
supp_check = await db.execute(
    select(Supplier).where(
        Supplier.id == po_in.supplier_id,
        Supplier.company_id == tenant_ctx.company_id,
        Supplier.is_deleted == False,
    )
)
if not supp_check.scalars().first():
    raise HTTPException(404, "Supplier not found in this company")
```

---

*Status: FROZEN | Version: 1.0.0 | 2026-08-10*
