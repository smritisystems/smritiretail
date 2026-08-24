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

# 02. Schema Migration Plan — Additive Surrogate Key & Variant Identity Constraint

**Migration Version:** `v3_18_0_add_variant_identity_surrogate`  
**Safety Classification:** `ADDITIVE ONLY — ZERO DATA LOSS — REVERSIBLE`

---

## 1. Migration SQL (Forward)

```sql
-- Step 1: Add numeric surrogate key variant_id if not present
ALTER TABLE products ADD COLUMN IF NOT EXISTS variant_id BIGSERIAL;

-- Step 2: Add Active Variant Identity Unique Constraint per Company Scope
CREATE UNIQUE INDEX IF NOT EXISTS uq_variant_identity_active 
ON products (company_id, LOWER(style_code), LOWER(color), LOWER(size)) 
WHERE is_deleted = false AND style_code IS NOT NULL AND color IS NOT NULL AND size IS NOT NULL;

-- Step 3: Add index on variant_id for high-speed reporting joins
CREATE INDEX IF NOT EXISTS idx_products_variant_id ON products (variant_id);
```

---

## 2. Pre-Conditions Verified
- [x] Phase 0 Company Scoping confirmed (`company_id` is present and active).
- [x] Phase 1 Duplicate Check executed (`0 duplicate groups found across all active products`).

---

## 3. Rollback SQL (Reverse)

```sql
DROP INDEX IF EXISTS idx_products_variant_id;
DROP INDEX IF EXISTS uq_variant_identity_active;
ALTER TABLE products DROP COLUMN IF EXISTS variant_id;
```
