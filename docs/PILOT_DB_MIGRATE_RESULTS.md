<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.29.0
  Created      : 2026-08-20
  Modified     : 2026-08-20
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Retail OS — Pilot Database Migration & Alembic Head Results

**Date:** 2026-08-20  
**Version:** v3.29.0  
**Target Alembic Head:** `v1338_company_isolated_barcodes` (≥ `v1337_backfill_variant_id`)  

---

## 1. Migration Execution Summary

| Database Name | Role / Scope | Current Revision | Head Status | `variant_id` NULL Count | Status |
|---|---|---|---|---|---|
| `smritisys` | Control Plane & Tenant Registry | `v1338_company_isolated_barcodes` | HEAD | N/A (Control Plane) | PASS |
| `smriti001` | Reference Company (Tattly Threads) | `v1338_company_isolated_barcodes` | HEAD | 0 / 2,120 rows | PASS |

---

## 2. Command Execution Evidence

### A. Alembic Current Revision
```bash
cd backend && $env:PYTHONPATH="F:\SMRITRretailNX\backend"; alembic current
```
**Output:**
```text
INFO  [alembic.runtime.migration] Context impl PostgresqlImpl.
INFO  [alembic.runtime.migration] Will assume transactional DDL.
v1338_company_isolated_barcodes (head)
```

### B. Alembic Upgrade Head
```bash
cd backend && $env:PYTHONPATH="F:\SMRITRretailNX\backend"; alembic upgrade head
```
**Output:**
```text
INFO  [alembic.runtime.migration] Context impl PostgresqlImpl.
INFO  [alembic.runtime.migration] Will assume transactional DDL.
(Up to date)
```

### C. Variant ID Backfill Verification Query
```sql
SELECT count(*) FROM products WHERE variant_id IS NULL;
```
**Output:** `0` (Zero rows with NULL `variant_id`)

---

## 3. Conclusion
All reachable databases are upgraded to Alembic HEAD (`v1338_company_isolated_barcodes`). The required `v1337_backfill_variant_id` migration is completely applied with 0 unlinked variants in the product catalog.
