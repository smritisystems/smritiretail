<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 4.1.0
  Created      : 2026-08-20
  Modified     : 2026-08-20
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# 10. Gap Migration Execution Log

**Migration Revision ID:** `v1336_variant_identity_view`  
**File:** `backend/alembic/versions/v1336_add_variant_identity_and_reporting_view.py`  
**Execution Timestamp:** 2026-08-20 01:09:08 UTC  
**Databases Target:** `smritisys` (System of Record) and `smriti001` (Operational)

---

## 1. Migration Steps Executed

1. **`products.variant_id` Column**:
   - `ALTER TABLE products ADD COLUMN IF NOT EXISTS variant_id BIGINT;`
   - Status: `APPLIED / VERIFIED`

2. **`idx_products_variant_id` Non-Unique Index**:
   - `CREATE INDEX IF NOT EXISTS idx_products_variant_id ON products USING btree (variant_id);`
   - Status: `APPLIED / VERIFIED`

3. **`uq_variant_identity_active` Partial Unique Index**:
   - Duplicate count check: `0 duplicates`
   - `CREATE UNIQUE INDEX IF NOT EXISTS uq_variant_identity_active ON products (company_id, lower(style_code), lower(color), lower(size)) WHERE (is_deleted = false AND style_code IS NOT NULL AND color IS NOT NULL AND size IS NOT NULL);`
   - Status: `APPLIED / VERIFIED`

4. **`report_flat_inventory_sales` Canonical Reporting View**:
   - `CREATE OR REPLACE VIEW report_flat_inventory_sales AS SELECT ... FROM products p;`
   - Status: `APPLIED / VERIFIED`

---

## 2. Verification Query Output

```text
======================================================================
APPLYING ADDITIVE MIGRATION TO: smritisys
======================================================================
  ✓ Column variant_id ensured
  ✓ Index idx_products_variant_id ensured
  ✓ Unique index uq_variant_identity_active ensured (0 duplicates)
  ✓ View report_flat_inventory_sales ensured
  ✓ Verification: report_flat_inventory_sales returned 588 active rows.

======================================================================
APPLYING ADDITIVE MIGRATION TO: smriti001
======================================================================
  ✓ Column variant_id ensured
  ✓ Index idx_products_variant_id ensured
  ✓ Unique index uq_variant_identity_active ensured (0 duplicates)
  ✓ View report_flat_inventory_sales ensured
  ✓ Verification: report_flat_inventory_sales returned 588 active rows.
```
