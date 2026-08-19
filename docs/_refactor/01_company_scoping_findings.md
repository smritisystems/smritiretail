<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.17.0
  Created      : 2026-08-19
  Modified     : 2026-08-19
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
-->

# 01. Phase 0 — Company Scoping Verification Findings

**Verification Date:** 2026-08-19  
**Status:** `VERIFIED — PROCEED TO PHASE 1`

---

## 1. Table Company Scoping Analysis

| Table Name | Scope Classification | `company_id` Column Present? | Existing Scoping Behavior |
| :--- | :--- | :---: | :--- |
| **`products`** | **`COMPANY-SCOPED`** | **YES** (`character varying`) | Every product is scoped to `company_id` and `branch_id`. Multi-tenant queries filter by `company_id`. |
| **`attribute_definitions`** | **`GLOBAL / TENANT-EXTENSIBLE`** | **YES** (`character varying`) | Default seed attributes carry `company_id: null` (global templates), while custom company attributes store `company_id`. |

---

## 2. Evidence (Direct PostgreSQL Inspection)

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('products', 'attribute_definitions') 
  AND column_name = 'company_id';
```
**Output:**
```text
table_name            | column_name | data_type
----------------------+-------------+-------------------
products              | company_id  | character varying
attribute_definitions | company_id  | character varying
```

---

## 3. Decision & Constraint Rule

Because `products` is `COMPANY-SCOPED`:
- Any new variant identity constraint **MUST** include `company_id`:
  ```sql
  UNIQUE (company_id, style_code, color, size)
  ```
- Two different companies can have the same `(style_code, color, size)` without collision.
- A single company cannot have duplicate `(style_code, color, size)` combinations.
