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

# 09. Gap Verification & Live Database Audit

**Status:** COMPLETE_VERIFIED  
**Verification Date:** 2026-08-20  
**Verification Levels:** L1 (Live PostgreSQL Runtime), L2 (Test Suite), L3 (Source Code & ORM), L4 (Alembic Migration Revisions)

---

## 1. Code Inventory (Phase 0)

| Refactor Target | Location | Code Status | Notes |
| :--- | :--- | :---: | :--- |
| **`variant_id` on Model** | `backend/app/models/inventory.py` | `PRESENT` | Column `variant_id` (BigInteger, autoincrement=True, index=True) |
| **`variant_id` on Schema** | `backend/app/schemas/inventory.py` | `PRESENT` | Field `variant_id: Optional[int] = None` |
| **ORM `__table_args__` Indexes** | `backend/app/models/inventory.py` | `PRESENT` | Added `idx_products_variant_id` and `uq_variant_identity_active` |
| **Alembic Migration** | `backend/alembic/versions/v1336_add_variant_identity_and_reporting_view.py` | `PRESENT` | Revision `v1336_variant_identity_view` |
| **Header Alias Registry (FE)** | `src/lib/headerMapping/HeaderAliasRegistry.ts` | `PRESENT` | One-to-many alias mappings with `additionalTargets` |
| **Header Mapping Engine (FE)** | `src/lib/headerMapping/HeaderMappingEngine.ts` | `PRESENT` | Normalized mapping and preview calculation |
| **Import Preview Modal (FE)** | `src/components/HeaderMappingPrevi.tsx` | `PRESENT` | Wired into `ExcelGridEntrySec.tsx` |
| **Reporting Flat View** | PostgreSQL `report_flat_inventory_sales` | `PRESENT` | Canonical SQL View created and verified |

---

## 2. Live Database Verification (Phase 1 & Phase 2)

### A. Database: `smritisys` (System of Record)
```sql
-- 1. Columns on products table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'products'
  AND column_name IN ('variant_id','company_id','style_code','color','size','barcode','sku','is_deleted');
-- Output:
--   barcode: character varying (nullable: NO)
--   color: character varying (nullable: YES)
--   size: character varying (nullable: YES)
--   style_code: character varying (nullable: YES)
--   sku: character varying (nullable: YES)
--   company_id: character varying (nullable: YES)
--   is_deleted: boolean (nullable: YES)
--   variant_id: bigint (nullable: YES)

-- 2. Indexes on products table
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'products'
  AND (indexname ILIKE '%variant%' OR indexdef ILIKE '%style_code%');
-- Output:
--   uq_variant_identity_active: CREATE UNIQUE INDEX uq_variant_identity_active ON public.products USING btree (company_id, lower((style_code)::text), lower((color)::text), lower((size)::text)) WHERE ((is_deleted = false) AND (style_code IS NOT NULL) AND (color IS NOT NULL) AND (size IS NOT NULL))
--   idx_products_variant_id: CREATE INDEX idx_products_variant_id ON public.products USING btree (variant_id)

-- 3. Duplicate Identity Check (Blocking condition)
SELECT company_id,
       LOWER(COALESCE(style_code,'')),
       LOWER(COALESCE(color,'')),
       LOWER(COALESCE(size,'')),
       COUNT(*) AS n
FROM products
WHERE COALESCE(is_deleted, false) = false
GROUP BY 1,2,3,4
HAVING COUNT(*) > 1;
-- Output: 0 duplicates found across 588 active products.

-- 4. View report_flat_inventory_sales
SELECT COUNT(*) FROM report_flat_inventory_sales WHERE is_deleted = false;
-- Output: 588 active rows returned.
```

### B. Database: `smriti001` (Operational / Invoices)
- Additive migration applied: `variant_id` ensured, `idx_products_variant_id` ensured, `uq_variant_identity_active` ensured (0 duplicates), `report_flat_inventory_sales` view ensured (588 active rows).

---

## 3. Test Evidence

- **Vitest**: `19 passed / 19 files` (113/113 unit tests passed)
- **TypeScript**: `tsc --noEmit` clean (0 errors)
- **Pytest**: `backend/tests/t_item_gap.py` (2/2 passed)
