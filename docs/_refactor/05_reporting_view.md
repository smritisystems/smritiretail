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

# 05. Phase 5 — Canonical Flat Reporting View Design

---

## 1. Objectives

1. **Single Source of Truth**: Serve Excel export and multi-tier progressive drill-downs from one flat database view (`report_flat_inventory_sales`).
2. **Surrogate Key Joins**: Link all transaction ledgers via `variant_id` (BIGINT) instead of text strings or mutable barcodes.
3. **Multi-Tenant Partitioning**: Filter reports strictly by `company_id` and `branch_id`.

---

## 2. View Definition

```sql
CREATE OR REPLACE VIEW report_flat_inventory_sales AS
SELECT 
    p.variant_id,
    p.id AS product_id,
    p.company_id,
    p.branch_id,
    p.code AS sku_code,
    p.barcode,
    p.name AS product_name,
    p.category AS merchandise_category,
    p.brand,
    p.style_code,
    p.color,
    p.size,
    p.mrp,
    p.cost_price,
    p.price AS selling_price,
    p.gst_percentage,
    p.hsn_code,
    p.stock AS current_stock,
    p.attributes,
    p.is_deleted,
    p.created_at,
    p.modified_at
FROM products p;
```

---

## 3. Reporting Consumption Modes

1. **Excel Direct Dump**: `SELECT * FROM report_flat_inventory_sales WHERE company_id = :comp_id AND is_deleted = false`.
2. **Hierarchy Drill-Down (Brand/Category)**:
   ```sql
   SELECT brand, merchandise_category, COUNT(variant_id) as total_skus, SUM(current_stock) as total_qty, SUM(current_stock * cost_price) as stock_valuation
   FROM report_flat_inventory_sales
   WHERE company_id = :comp_id AND is_deleted = false
   GROUP BY brand, merchandise_category;
   ```
