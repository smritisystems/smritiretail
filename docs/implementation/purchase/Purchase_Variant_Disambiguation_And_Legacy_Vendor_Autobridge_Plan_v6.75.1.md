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

# Purchase Variant Disambiguation & Legacy Vendor Auto-Bridge Implementation Plan (v6.75.1)

## 1. Objective
Eliminate runtime blocking rejections during Purchase Order generation and catalog browsing:
1. HTTP 422 rejections (`Vendor '<id>' was found in the legacy supplier register but has not been migrated to the Vendor 360 canonical master`) on `/api/v1/purchase/evaluate-products` by establishing on-demand automatic convergence of legacy suppliers into the canonical Vendor 360 Party Master.
2. HTTP 400 rejections (`AMBIGUOUS_ITEM_VARIANT`) on `/api/v1/purchase/orders/` when purchasing specific variant SKUs (e.g. `'CH-533-CREAM-36'`) of multi-variant articles by resolving explicit variant identity prior to evaluating the ambiguity guard.

## 2. Business Motivation
Store managers and procurement operators using Purchase Studio (`PurchBrowseDlg` and `PoGenerateTab`) were blocked when trying to purchase shoes with active size/color variants. Legacy suppliers in the register produced false 422 blocks during catalog evaluation, and purchasing specific sizes produced false `AMBIGUOUS_ITEM_VARIANT` 400 errors despite the user selecting an exact SKU.

## 3. Scope
- Backend Vendor Resolution (`backend/app/services/vendor_product_assignment.py`): On-demand legacy supplier auto-migration to `Party` and `VendorIdentityMigration`.
- Backend Purchase Line Resolution (`backend/app/services/purchase.py`): PO and GRN variant identity pre-resolution and exact SKU matching before ambiguity guard checks.
- Frontend Purchase Studios (`src/components/purchase/PoGenerateTab.tsx`, `src/components/purchase/PoSizewiseTab.tsx`): Explicit propagation of `variant_id` and `item_id` in line payloads.
- Automated Test Suite (`backend/tests/test_purchase_variant_and_vendor_autobridge.py`): Verification of legacy supplier auto-bridge and variant disambiguation.

## 4. Current State
- `VendorProductAssignmentService.resolve_vendor_party_id` queried `VendorIdentityMigration`. If missing, it raised an immediate HTTP 422 error halting catalog evaluation.
- `PurchaseService.create_purchase_order` inspected only `getattr(item, "variant_id", None)`. If omitted in the JSON line, it branched into `if not po_variant_id and canonical_item_id:`, counted parent variants, and raised 400 `AMBIGUOUS_ITEM_VARIANT` even if `product.item_variant_id` or `res.variant_id` was resolved.
- Fallback logic was located inside an unreachable `elif`.

## 5. Gap Analysis
| Component | Existing Behavior | Expected Behavior |
| :--- | :--- | :--- |
| **Vendor 360 Bridge** | Raises 422 if legacy supplier not in migration ledger | Auto-provisions canonical `Party` + `VendorIdentityMigration` on-demand |
| **PO Variant Resolution** | Fails fast on multi-variant items if `item.variant_id` is None | Pre-resolves from `product.item_variant_id`, `res.variant_id`, and matches `variant_sku` |
| **GRN Variant Resolution** | Evaluates ambiguity before checking `product.item_variant_id` | Checks `product.item_variant_id` and SKU match before ambiguity check |
| **PO Client Payloads** | Omits `variant_id` in line items | Passes `variant_id` and `item_id` from `originalProduct` |

## 6. Architecture Impact
- **Universal Party Master Integration:** Conforms to Universal Party Master (UPM) architecture by maintaining `VendorIdentityMigration` idempotency.
- **ADR-001 / R-01 Invariant:** Retains the fundamental guarantee: truly ambiguous purchases (only parent style code supplied without variant identification) still strictly fail fast with 400 `AMBIGUOUS_ITEM_VARIANT`.

## 7. Proposed Design
1. In `VendorProductAssignmentService.resolve_vendor_party_id`:
   - If legacy supplier is found without migration record, check if a matching `Party` exists by `party_code` or `gstin`.
   - If not found, create canonical `Party` with `pty_` technical ID and status `"ACTIVE"`.
   - Insert `VendorIdentityMigration` with `migration_status="COMPLETED"` and `migration_reason="AUTO_ON_DEMAND_CONVERGENCE"`.
   - Return canonical `party_id`.
2. In `PurchaseService.create_purchase_order`:
   - Pass `variant_id` into `TransactionLineItemInput`.
   - Compute `po_variant_id = getattr(item, "variant_id", None) or getattr(product, "item_variant_id", None) or res.variant_id`.
   - In ambiguity check, verify if `clean_item_code` or `product.code` matches any variant's `variant_sku`. If matched, set `po_variant_id = matched_var.id`. Only fail if genuinely ambiguous with >1 variant.
3. In `PurchaseService.create_goods_receipt`:
   - Compute `grn_variant_id = grn_variant_id or resolved_canon.variant_id or getattr(product, "item_variant_id", None)`.
   - Check variant SKU match before raising `AMBIGUOUS_ITEM_VARIANT`.
4. In `PoGenerateTab.tsx` and `PoSizewiseTab.tsx`:
   - Send `variant_id: l.originalProduct?.item_variant_id || (l.originalProduct as any)?.variant_id || undefined` in item payload.

## 8. Files Created
- `backend/tests/test_purchase_variant_and_vendor_autobridge.py`: Unit test battery covering vendor auto-bridge, variant SKU resolution, and ambiguous style rejection.

## 9. Files Modified
- `backend/app/services/vendor_product_assignment.py`
- `backend/app/services/purchase.py`
- `src/components/purchase/PoGenerateTab.tsx`
- `src/components/purchase/PoSizewiseTab.tsx`

## 10. Dependencies
- FastAPI Core
- SQLAlchemy AsyncSession
- SMRITI Universal Item Master & Party Master models

## 11. Risks
- Risk: Inadvertent bypass of ambiguity check for generic styles.
- Mitigation: Dedicated test `test_po_creation_truly_ambiguous_item_fails_fast` verifies that generic styles without variant identity strictly fail with HTTP 400.

## 12. Rollback Strategy
Git revert of the affected commits on `vendor_product_assignment.py`, `purchase.py`, and frontend tab components.

## 13. Verification Plan
- Unit tests via `pytest backend/tests/test_purchase_variant_and_vendor_autobridge.py`.
- Regression suite via `pytest backend/tests/test_po_vendor_product_control.py`.
- TypeScript validation via `npx tsc --noEmit`.

## 14. Test Plan
- Test 1: Auto-convergence of legacy supplier into `Party` + `VendorIdentityMigration`.
- Test 2: Resolution of specific variant SKU under 14-variant article without `AMBIGUOUS_ITEM_VARIANT`.
- Test 3: Failure of generic style without variant with 400 `AMBIGUOUS_ITEM_VARIANT`.

## 15. Documentation Impact
- Update `docs/walkthrough/README.md`.
- Update `docs/implementation/README.md`.
- Update `CHANGELOG.md`.

## 16. Deployment Plan
Deployed directly to live backend and frontend runtime containers. No schema migration required as `parties` and `vendor_identity_migrations` already exist.

## 17. Status
Completed

## 18. Related ADRs
- `ADR-001`: Strict Canonical Variant Identity and Fail-Fast Ambiguity Guard.

## 19. Related Walkthroughs
- `docs/walkthrough/purchase/Purchase_Variant_Disambiguation_And_Legacy_Vendor_Autobridge_v6.75.1.md`
