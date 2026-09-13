# Master Lookup Deletion Policy

**Status:** Implemented and validated 2026-09-13

## Rule

Vendor codes, Style / Article values, and parent lookup values may be soft-deleted only when no live record anywhere in the software references them. A linked deletion returns HTTP `409`; the transaction is not committed and the lookup remains active.

## References Checked

The deletion guard in `backend/app/api/v1/master_lookup.py` checks:

- Child `master_values.parent_value_id` links for every lookup type.
- Style / Article values linked by `variant_templates.master_value_id`.
- Style / Article values used by live `products.style_code`.
- Style / Article values preserved in live `sales_order_items.article_no` or `sales_order_items.vendor_style`.
- Vendor values used by live `variant_templates.vendor_code`.
- Vendor values used by live `products.vendor_code`.
- Vendor values owned by live Style / Article lookup values through `master_values.vendor_code`.
- Vendor values preserved in `sales_orders.vendor_code`.

This covers current master data, item/variant templates, legacy inventory, and historical sales/order references.

## API Behavior

- `409 Conflict`: one or more live references exist; remove or retire the dependent records first.
- `200 OK`: no live references exist; the lookup is soft-deleted with audit fields.
- `404 Not Found`: the lookup or its type is missing, already retired, or outside the caller's scope.

Deletion is never a hard database delete. Existing transactions and audit history are preserved.

## Database Defense

Migration `v1446_enforce_master_value_reference_guard` adds a PostgreSQL trigger on `master_values`. It rejects direct SQL retirement of a referenced value with a database constraint error, including writes from future services or maintenance scripts that bypass the API. The API converts concurrent trigger rejections to the same `409 Conflict` contract.

## UI Behavior

The Master Management confirmation dialog warns that deletion is allowed only when there are no active references. The backend remains authoritative and protects all callers, including imports and direct API clients.

## Validation

Focused command:

```text
python -m pytest backend/app/tests/t_masters_consol.py -q
```

Result: **4 passed**.

The regression covers linked vendor/style values returning `409`, unchanged linked records after rejection, and successful soft deletion of an unlinked value. Existing master CRUD, validation, and scope tests also pass.

## Tenant Rollout

- `smriti001`: upgraded to `v1446_enforce_master_value_reference_guard`; trigger verified.
- `smriti002`: reconciled missing legacy foundation tables (`master_types`, `master_values`, `variant_templates`, and attribute foundations), then upgraded through the normal Alembic chain to `v1446`; trigger verified.

Both operational tenants now enforce the database guard. The `smriti002` foundation repair was required because its recorded `v1421` revision did not match its physical schema.

## Operational Guidance

Do not bypass this check with direct SQL or bulk scripts. To retire a linked value, first migrate or retire every dependent template, product, order reference, and child lookup value, then retry deletion. Historical references should normally remain preserved rather than rewritten.
