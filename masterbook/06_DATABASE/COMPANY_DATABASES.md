<!--
  SMRITI Retail OS — Masterbook
  Document  : 06_DATABASE/COMPANY_DATABASES.md
  Status    : FROZEN (PROD-003, PROD-004)
  Version   : 1.0.0  |  Created: 2026-08-10
-->

# Company Databases

---

## Database Architecture Decision

SMRITI uses **one shared PostgreSQL database** with company-level row isolation (`company_id`), not separate databases per company.

| Option | Decision |
|---|---|
| Separate DB per company | ❌ Not chosen |
| Shared DB with `company_id` | ✅ **CHOSEN** |

---

## Environment Databases

| Environment | Database Name | Purpose |
|---|---|---|
| Production | `smriti_prod` | Live business data |
| Demo | `smriti_demo` | Sales demos — isolated |
| Training | `smriti_training` | Staff training |
| Test | `smriti_test` | Automated test suite |
| Development | `smriti_dev` | Local development |

---

## Clean Production Install (PROD-003)

A fresh `smriti_prod` installation contains ONLY:

| Category | Included |
|---|---|
| Company setup record | ✅ |
| Branch setup record | ✅ |
| Admin user account | ✅ |
| System configuration | ✅ |
| Roles and permissions | ✅ |
| Tax rates (GST slabs) | ✅ |
| UOM master | ✅ |
| Currencies | ✅ |
| Countries | ✅ |
| Customers | ❌ None |
| Suppliers | ❌ None |
| Products | ❌ None |
| Sales invoices | ❌ None |
| Purchase orders | ❌ None |
| Stock ledger | ❌ None |
| Payment records | ❌ None |

**Dashboard must show 0 records on first login.**

---

## Environment Metadata (PROD-004)

Every database profile carries:

```sql
environment_metadata
─────────────────────
database_id      VARCHAR(50) UNIQUE
database_name    VARCHAR(100)
environment_type VARCHAR(20)    -- PRODUCTION | DEMO | TRAINING | TEST | DEVELOPMENT
is_demo          BOOLEAN
created_on       TIMESTAMP
version          VARCHAR(20)
```

This badge is displayed on every login screen and application header (PROD-005).

---

## Production Delete Protection (PROD-003)

`smriti_prod` deletion from the application UI is **strictly prohibited**. Only a platform admin with direct DB access can remove a production database. The application must never expose a "Delete Database" option for production environments.

---

*Status: FROZEN — PROD-003, PROD-004 | Version: 1.0.0 | 2026-08-10*
