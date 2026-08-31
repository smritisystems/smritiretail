<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS

  Founders

  * Pushpa Devi Jawahar Mallah — Founder & Chairperson
  * Jawahar Ramkripal Mallah  — Founder, CEO & Chief Software Architect
  * Websites: aitdl.com | erpnbook.com | smritibooks.com

  * Version    : 3.14.0
  * Created    : 2026-07-11
  * Modified   : 2026-07-11
  * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
-->

# Foundation — Database Backfill — Walkthrough v3.14.0

**Date:** 2026-07-11  
**Status:** Done

---

## 1. Purpose

Provide a database backfill script to populate `company_id` and `branch_id` tenant identifier fields for legacy records (e.g. products, customers, customer groups) that were created with null tenant references.

---

## 2. Scope

| Included | Excluded |
|---|---|
| Auto-discovery of all public tables containing `company_id` and `branch_id` | Altering table schemas |
| Automatic detection of existing active company/branch, falling back to system defaults | Deleting or altering non-null data |
| Backfilling all null tenant identifier columns with valid foreign key values | Multi-tenant migration logic |

---

## 3. Files Created

| File | Purpose |
|---|---|
| `backend/app/db/backfill.py` | One-shot async database backfill script utilizing `asyncpg` |

---

## 4. Files Modified

None.

---

## 5. Architecture Decisions

### A. Discovery-driven updates
The script queries PostgreSQL metadata (`information_schema.columns`) dynamically to discover which tables possess both `company_id` and `branch_id` columns, rather than hardcoding a list of tables. This makes the backfill robust against future schema expansions.

---

## 6. Design Rationale

- Using `asyncpg` directly bypasses SQLAlchemy ORM overhead and avoids potential lifecycle validation hooks when doing bulk updates.

---

## 7. Implementation Summary

### Backfill Execution

- Resolves default `company_id` and `branch_id` from existing database records (selecting the first found).
- If database is empty, creates a default company `comp-default` (GST: `27ABCDE1234F1Z5`) and branch `br-default`.
- Updates `customer_groups`, `products`, `customers`, and any other discovered tables where tenant identifiers are null.

---

## 8. Tests Executed

**Command:**
```
python app/db/backfill.py
```

**Output:**
```
Using Default Company ID: comp-e15d45, Branch ID: br-e15d45
Backfilling 6 null rows in table 'customer_groups'...
Finished backfilling table 'customer_groups'.
Backfilling 1 null rows in table 'products'...
Finished backfilling table 'products'.
Backfilling 6 null rows in table 'customers'...
Finished backfilling table 'customers'.
```

**Verification Check:**
```
Inspecting tables for null company_id or branch_id:
  customer_groups: 0 null rows
  products: 0 null rows
  customers: 0 null rows
```

---

## 9. Verification Results

| Check | Status |
|---|---|
| Dynamic table discovery | Done |
| All null columns backfilled successfully | Done |

---

## 10. Known Limitations

- The script picks the first available tenant in the database, which is appropriate for dev/test environments but might require parameterization in staging/production with multiple active tenants.

---

## 11. Future Work

- Command-line arguments to pass specific `company_id` and `branch_id` parameters.

---

## 12. Related ADRs

None.

---

## 13. Related RFCs

None.
