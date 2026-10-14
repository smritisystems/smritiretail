<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.75.1
  Created      : 2026-10-14
  Modified     : 2026-10-14
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Purchase Variant Disambiguation & Legacy Vendor Auto-Bridge Walkthrough (v6.75.1)

## 1. Purpose
This walkthrough documents the investigation, remediation, and verification of two runtime rejections affecting Purchase Studio:
1. HTTP 422 (`Unprocessable Entity`) during catalog browsing on `/api/v1/purchase/evaluate-products` caused by unmigrated legacy suppliers.
2. HTTP 400 (`Bad Request`) on `/api/v1/purchase/orders/` (`AMBIGUOUS_ITEM_VARIANT`) when purchasing specific variant SKUs (e.g. `'CH-533-CREAM-36'`) belonging to multi-variant articles.

## 2. Scope
- Legacy supplier on-demand convergence into Universal Party Master (`parties`) and audit ledger (`vendor_identity_migrations`).
- PO and GRN variant identity resolution order and exact variant SKU matching prior to ambiguity checks in `backend/app/services/purchase.py`.
- Frontend PO line item construction in `PoGenerateTab.tsx` and `PoSizewiseTab.tsx` forwarding explicit `variant_id` and `item_id`.
- Automated test coverage in `backend/tests/test_purchase_variant_and_vendor_autobridge.py`.

## 3. Files Created
- `backend/tests/test_purchase_variant_and_vendor_autobridge.py`: Unit test battery covering vendor auto-bridge, variant SKU resolution, and ambiguous style rejection.

## 4. Files Modified
- `backend/app/services/vendor_product_assignment.py`: Added automatic on-demand legacy supplier convergence to canonical Party master.
- `backend/app/services/purchase.py`: Refined `create_purchase_order` and `create_goods_receipt` to resolve variant identity and match SKU before evaluating ambiguity guard.
- `src/components/purchase/PoGenerateTab.tsx`: Added `variant_id` and `item_id` to PO line item payload.
- `src/components/purchase/PoSizewiseTab.tsx`: Added `variant_id` and `item_id` to PO line item payload.
- `docs/implementation/purchase/Purchase_Variant_Disambiguation_And_Legacy_Vendor_Autobridge_Plan_v6.75.1.md`: Implementation plan.
- `docs/implementation/README.md`: Master implementation index.
- `docs/walkthrough/README.md`: Master walkthrough index.
- `CHANGELOG.md`: Chronological log.

## 5. Architecture Decisions
1. **On-Demand Vendor Convergence (Self-Healing Bridge):** Rather than blocking purchase workflows with HTTP 422 when legacy suppliers are encountered, `resolve_vendor_party_id` automatically provisions a canonical `Party` and writes a `VendorIdentityMigration` audit record.
2. **Explicit Variant Pre-Resolution:** In accordance with ADR-001, variant identity (`po_variant_id`) is pre-resolved from all available authoritative sources (`item.variant_id`, `product.item_variant_id`, `res.variant_id`) and checked against active variant SKUs before entering the ambiguity guard. Truly ambiguous inputs (e.g., parent style with multiple variants and no SKU) still fail fast with HTTP 400.

## 6. Design Rationale
- **Zero-Friction Operations:** Store clerks should not need to perform administrative vendor migrations while in the middle of creating purchase orders.
- **Fail-Fast Safety Preserved:** The system still prevents indeterminate stock receiving. If an operator submits a generic style code without indicating which size or color is being purchased, the system halts with `AMBIGUOUS_ITEM_VARIANT`.

## 7. Implementation Summary
- **Vendor Product Assignment:** In `resolve_vendor_party_id`, replaced the static 422 error on unmigrated legacy suppliers with logic that checks for existing parties or provisions a new canonical `Party` with `pty_` technical ID, records the migration in `vendor_identity_migrations`, and returns the canonical `party_id`.
- **Purchase Order Service:** In `create_purchase_order`, updated `line_input` to receive `variant_id`, pre-resolved `po_variant_id` across `item.variant_id`, `product.item_variant_id`, and `res.variant_id`, and added SKU matching against `active_vars`.
- **Goods Receipt Note Service:** In `create_goods_receipt`, pre-resolved `grn_variant_id` before ambiguity checking and added SKU matching.
- **Frontend Clients:** Updated `PoGenerateTab.tsx` and `PoSizewiseTab.tsx` to forward `variant_id` and `item_id` from `originalProduct`.

## 8. Tests Executed
```powershell
pytest backend/tests/test_purchase_variant_and_vendor_autobridge.py -v
pytest backend/tests/test_po_vendor_product_control.py -v
pytest backend/app/tests/test_cost_valuation_batch2.py -v
npx tsc --noEmit
```

## 9. Verification Results
- `test_purchase_variant_and_vendor_autobridge.py`: 3/3 passed (100%).
- `test_po_vendor_product_control.py`: 53/53 passed (100%).
- `test_cost_valuation_batch2.py`: 27/27 passed (100%).
- `npx tsc --noEmit`: 0 errors (exit code 0).

## 10. Known Limitations
None. All legacy supplier lookups and multi-variant purchases resolve cleanly.

## 11. Future Work
Add a background batch task to pre-migrate any remaining legacy suppliers in bulk so that real-time convergence is rarely triggered.

## 12. Related ADRs
- `ADR-001`: Strict Canonical Variant Identity and Fail-Fast Ambiguity Guard.

## 13. Related RFCs
- `RFC-008`: Universal Party Master & Vendor 360 Architecture.
