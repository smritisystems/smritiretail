# Barcode and SKU Immutability Policy

**Status:** Implemented and validated 2026-09-13

## Rule

A generated item code, stock number, SKU, variant SKU, primary barcode, or secondary barcode is a permanent identity. After the first successful attachment, the value cannot be edited, replaced, deleted, or reassigned to another item.

This is intentionally separate from operational transactions. Stock movements, price-book entries, sales, purchases, and reservations may change quantities or commercial values without changing item identity.

## Enforced Write Paths

- `backend/app/services/item_master_svc.py`
  - Duplicate canonical item codes are rejected before insert.
  - Duplicate canonical barcodes are rejected before insert.
  - Direct create calls no longer update an existing item.
  - Matrix-generated variant SKUs are insert-once; existing variants are not overwritten.
- `backend/app/api/v1/inventory.py`
  - Product `code`, `sku`, and primary `barcode` cannot be supplied to an update.
  - A secondary barcode cannot be reused if it is already a primary or secondary barcode.
  - Attached secondary barcodes cannot be deleted.
- `backend/app/api/v1/attributes.py`
  - Attribute variant generation and CSV import reject an existing SKU instead of updating it.
- Database identity constraints remain active for canonical item codes, variant SKUs, and canonical barcodes.

## Validation Evidence

Focused command:

```text
python -m pytest backend/tests/t_item_master.py -q
```

Result: **8 passed**.

The API fixture now uses the canonical `BR-MAIN-001` branch for `COMP-001`; the previous `403` was caused by the invalid `BR-001` test claim. The full service, matrix, duplicate item-code, duplicate barcode, and API endpoint coverage now passes.

## Deep-Research Findings

1. The legacy product update route previously allowed `code`, `sku`, and `barcode` changes. It now returns HTTP `409` for those fields.
2. The canonical direct item-create workflow previously found an existing item code and updated its business details. It now rejects the duplicate.
3. Attribute variant generation and import previously mutated an existing product's stock, prices, attributes, SKU, or barcode. They now reject the existing SKU with HTTP `409`.
4. Secondary barcode deletion previously removed an attached identifier. It now returns HTTP `409`.
5. Matrix generation already used insert-only behavior for existing variant SKUs; that behavior is covered by the existing matrix regression test.
6. Barcode lookup, sales, purchase, and stock movement paths only read or reference identifiers and do not change ownership.

## Operational Note

Existing historical data is not rewritten by this change. Any pre-existing duplicate or conflicting barcode records require a separate migration and business review; automatic reassignment would violate this policy.
