<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.31.1
  Created      : 2026-09-17
  Modified     : 2026-09-17
  Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Product Search and Live Inventory 500 Fix + PDT Retirement (v6.31.1)

## 1. Purpose
Resolve two production HTTP 500 regressions on GET /api/v1/products/search
and StandaloneWindowView live inventory loader. Also complete legacy PDT
module retirement.

## 2. Root Cause
ProductBase.validate_pricing_hierarchy (model_validator mode=after) raised
'Buying Price is mandatory for stock items.' during response serialization
when buying_price was NULL in DB. Pydantic v2 populates model_fields_set
with all ORM attribute names, triggering the raise branch for every legacy
product row. FastAPI wrapped this as ResponseValidationError -> HTTP 500.

## 3. Fix
ProductResponse overrides validate_pricing_hierarchy with coerce-not-raise
semantics. NULL buying_price/cost_price are coerced to price value. Input
validation (ProductCreate, ProductUpdate) remains strict and unaffected.

## 4. Files Modified
- backend/app/schemas/inventory.py: ProductResponse validator override
- backend/app/tests/test_inventory.py: 2 new regression tests

## 5. Files Deleted
- src/components/billing/PdtImportModal.tsx (PDT retirement)
- src/components/billing/propos/ProPosPdtImportDlg.tsx (PDT retirement)

## 6. Tests Executed
Command: python3 -m pytest app/tests/test_inventory.py -v --tb=short
Result:  4 passed, 17 warnings in 93.47s
Run 2:   4 passed, 17 warnings in 86.16s (confirmed on rebuilt container)

## 7. Commit
SHA: 6db45067126b941c7be87a66fe22dc27dfd99208

## 8. Known Limitations
Products with NULL buying_price receive coerced values in API responses.
A DB backfill migration would eliminate the coercion path permanently.

## 9. Future Work
- Alembic migration to backfill buying_price = price where NULL
- Fix pre-existing test collection errors in tests/ directory
- Evaluate revalidate_instances = 'never' for all *Response schemas
