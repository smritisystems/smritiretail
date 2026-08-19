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

# 00. Item Master Refactor — Repository Baseline Snapshot

## 1. Schema Baseline

### `products` Table (PostgreSQL)
- **Primary Key:** `id` (VARCHAR(50))
- **Surrogate Identity UUID:** `uuid` (VARCHAR(50))
- **Tenant Columns:** `company_id` (VARCHAR), `branch_id` (VARCHAR), `tenant_id` (VARCHAR)
- **Existing Identity Fields:**
  - `code` (VARCHAR)
  - `style_code` (VARCHAR)
  - `color` (VARCHAR)
  - `size` (VARCHAR)
  - `barcode` (VARCHAR)
  - `sku` (VARCHAR)
  - `attributes` (JSONB)
- **Financial / Tax Fields:** `price`, `mrp`, `cost_price`, `gst_percentage`, `hsn_code`
- **Soft Delete:** `is_deleted` (BOOLEAN), `deleted_at`, `deleted_by`

### `attribute_definitions` Table (PostgreSQL)
- **Primary Key:** `id`
- **Columns:** `name`, `label`, `data_type`, `is_variant_dimension`, `is_mandatory`, `valid_values`, `group_id`, `company_id`

## 2. Active Product Count
- Total Active Records: **36 rows** across tenant partitions.
- Duplicates on `(company_id, style_code, color, size)`: **0 found**.
