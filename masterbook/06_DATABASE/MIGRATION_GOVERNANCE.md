<!--
  SMRITI Retail OS — Masterbook
  Document  : 06_DATABASE/MIGRATION_GOVERNANCE.md
  Status    : FROZEN
  Version   : 1.0.0  |  Created: 2026-08-10
-->

# Migration Governance

---

## Tool: Alembic

All schema changes are managed via Alembic migrations. Raw SQL DDL in application code is prohibited.

```bash
# Generate migration
alembic revision --autogenerate -m "add_customer_loyalty_tier"

# Apply migrations
alembic upgrade head

# Rollback one step
alembic downgrade -1
```

---

## Migration Rules

| Rule | Mandate |
|---|---|
| One concern per migration | Never combine schema + data migration |
| Backward-compatible | New columns must be nullable or have defaults |
| Never drop columns | Set `is_deleted = True` or rename to `_deprecated_{name}` |
| Never rename tables | Add new table + migration script + deprecate old |
| No business data in migrations | Schema only — no INSERT of customer/product/invoice data |
| Test migrations | Run against `smriti_test` before applying to production |
| Version stamp | `alembic stamp head` after manual fixes |

---

## Column Addition Pattern

```python
# Safe — backward compatible
def upgrade():
    op.add_column("customers", sa.Column(
        "loyalty_tier",
        sa.String(30),
        nullable=True,           # ← Always nullable on add
        server_default="Bronze"  # ← Always provide a server default
    ))

def downgrade():
    op.drop_column("customers", "loyalty_tier")
```

---

## Migration Numbering

Alembic generates hash-based revision IDs. Maintain a human-readable description:

```
20260810_001_add_customer_loyalty_tier.py
20260810_002_add_sales_invoice_round_off.py
```

---

## Production Migration Checklist

Before applying any migration to `smriti_prod`:
1. ✅ Migration tested on `smriti_test`
2. ✅ Backup taken of `smriti_prod`
3. ✅ Downtime window confirmed (if table lock needed)
4. ✅ Rollback script ready
5. ✅ CHANGELOG updated

---

*Status: FROZEN | Version: 1.0.0 | 2026-08-10*
