<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 4.2.0
  Created      : 2026-08-20
  Modified     : 2026-08-20
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# 11. Item Master Post-Gap Residual Follow-Ups

**Status:** RESIDUALS_CLOSED  
**Execution Timestamp:** 2026-08-20 01:29:27 UTC  
**Target Databases:** `smritisys` (System of Record) and `smriti001` (Operational)

---

## 1. Residual Follow-Up Summary

| Residual Task | Action Taken | Result / Metric | Status |
| :--- | :--- | :--- | :---: |
| **1. Gate Doc Truth** | Updated `ITEM_MASTER_REFACTOR_GATE.md` | Status: `COMPLETE_VERIFIED`, Gate: `ITEM_MASTER_REFACTOR_APPLIED` | `CLOSED` |
| **2. Backfill `variant_id`** | Applied Alembic `v1337_backfill_variant_id.py` + sequence | `smritisys`: 0 nulls / `smriti001`: 0 nulls | `CLOSED` |
| **3. Identity Coverage** | Ran SQL identity coverage metric | **100.00%** coverage (588/588 active products) | `CLOSED` |
| **4. `report_flat` Honesty** | Documented products-only catalog projection | No fake sales facts; documented future extension | `CLOSED` |
| **5. Provision Path** | Verified Alembic linear revision chain | Single linear head: `v1337_backfill_variant_id` | `CLOSED` |

---

## 2. SQL Evidence & Measurements

### A. Backfill Measurement (`variant_id`)
```sql
SELECT
  COUNT(*) AS total,
  COUNT(variant_id) AS with_id,
  COUNT(*) FILTER (WHERE variant_id IS NULL) AS null_ids,
  MIN(variant_id),
  MAX(variant_id)
FROM products;
```

**Results:**
- **`smritisys`**:
  - Total: `599`
  - With variant_id: `599`
  - NULL variant_id: `0`
  - Range: `[2, 4215]`
- **`smriti001`**:
  - Total: `588`
  - With variant_id: `588` (backfilled from 0)
  - NULL variant_id: `0`
  - Range: `[1, 588]`

---

### B. Identity Coverage Metric
```sql
SELECT
  COUNT(*) FILTER (
    WHERE COALESCE(is_deleted,false)=false
  ) AS active_products,
  COUNT(*) FILTER (
    WHERE COALESCE(is_deleted,false)=false
      AND style_code IS NOT NULL
      AND color IS NOT NULL
      AND size IS NOT NULL
  ) AS identity_covered,
  ROUND(
    100.0 * COUNT(*) FILTER (
      WHERE COALESCE(is_deleted,false)=false
        AND style_code IS NOT NULL
        AND color IS NOT NULL
        AND size IS NOT NULL
    ) / NULLIF(COUNT(*) FILTER (WHERE COALESCE(is_deleted,false)=false), 0),
    2
  ) AS pct_identity_covered
FROM products;
```

**Results:**
- **`smritisys`**: `588` active / `588` covered $\rightarrow$ **`100.00%`**
- **`smriti001`**: `588` active / `588` covered $\rightarrow$ **`100.00%`**

---

### C. Alembic Revision Chain Verification
```text
Alembic Current Heads: ['v1337_backfill_variant_id']
Down Revision: v1336_variant_identity_view -> v1335_seed_roles -> ...
Linear revision chain verified successfully!
```
All new database provisions running `alembic upgrade head` will automatically apply both `v1336` and `v1337`.
