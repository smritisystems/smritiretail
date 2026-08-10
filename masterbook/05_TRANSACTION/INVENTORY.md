<!--
  SMRITI Retail OS — Masterbook
  Document  : 05_TRANSACTION/INVENTORY.md
  Status    : FROZEN
  Version   : 1.0.0  |  Created: 2026-08-10
-->

# Inventory Management Architecture

---

## Stock Ledger — Immutable Audit Trail

The stock ledger is the **single source of truth** for all inventory movements. It is an **append-only** ledger — records are never updated or deleted.

```sql
stock_ledger
────────────────────────────────────────────────────────
id              VARCHAR(50) PK
product_id      VARCHAR(50) NOT NULL FK → products
company_id      VARCHAR(50) NOT NULL
branch_id       VARCHAR(50) NOT NULL
movement_type   VARCHAR(30) NOT NULL    -- see below
quantity        NUMERIC(15,4) NOT NULL
reference_id    VARCHAR(50)             -- invoice_id / PO_id / adj_id
reference_type  VARCHAR(30)             -- SALES_INVOICE | PO_RECEIPT | ADJUSTMENT
movement_date   DATE NOT NULL
is_deleted      BOOLEAN DEFAULT false   -- soft-delete only
```

---

## Movement Types

| Type | Direction | Trigger |
|---|---|---|
| `SALE` | Outbound (-) | Sales invoice posted |
| `SALE_RETURN` | Inbound (+) | Sales return posted |
| `PO_RECEIPT` | Inbound (+) | GRN posted |
| `PO_RETURN` | Outbound (-) | Purchase return |
| `STOCK_ADJUSTMENT_IN` | Inbound (+) | Manual adjustment |
| `STOCK_ADJUSTMENT_OUT` | Outbound (-) | Manual adjustment |
| `OPENING_STOCK` | Inbound (+) | Initial stock entry |
| `TRANSFER_IN` | Inbound (+) | Branch transfer received |
| `TRANSFER_OUT` | Outbound (-) | Branch transfer sent |

---

## Stock Ledger Trigger

```sql
CREATE TRIGGER stock_ledger_trigger
AFTER INSERT ON stock_ledger
FOR EACH ROW EXECUTE FUNCTION update_current_stock();
```

The trigger auto-updates `current_stock` on the `product_stock` table (materialized current balance). The ledger itself is immutable.

---

## Current Stock Query Pattern

```python
# Always query current_stock from the materialized table
# Never compute SUM(quantity) from stock_ledger in UI queries — use the materialized view
select(ProductStock).where(
    ProductStock.product_id == product_id,
    ProductStock.branch_id  == tenant_ctx.branch_id,
    ProductStock.company_id == tenant_ctx.company_id,
)
```

---

## Business Rules

| Rule | Mandate |
|---|---|
| Stock goes negative | Allowed by default (oversell permitted) — configurable per company |
| Stock ledger is append-only | Never UPDATE or DELETE a ledger row |
| Every movement references a document | `reference_id` + `reference_type` mandatory |
| Company isolation | Stock queries always filter by `company_id` + `branch_id` |

---

*Status: FROZEN | Version: 1.0.0 | 2026-08-10*
