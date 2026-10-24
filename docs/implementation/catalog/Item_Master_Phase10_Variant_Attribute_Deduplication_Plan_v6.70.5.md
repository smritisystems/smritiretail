<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.70.5
  Created      : 2026-10-05
  Modified     : 2026-10-05
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: Item Master Phase 10 — Variant-Level Attribute Deduplication

**Document ID:** `PLAN-CATALOG-P10-ATTRIB-v6.70.5`  
**Area:** Catalog, Attributes, Variant Architecture, Single Source of Truth  
**Status:** Completed  
**Version:** `6.70.5`  
**Related Walkthrough:** [`Item_Master_Phase10_Variant_Attribute_Deduplication_v6.70.5.md`](../../walkthrough/catalog/Item_Master_Phase10_Variant_Attribute_Deduplication_v6.70.5.md)

---

## 1. Objective
Establish `item_variants` as the sole canonical Single Source of Truth (SSOT) for physical product variation attributes (`color` and `size`). Eliminate contradictory style-level attribute definitions on `items` (which currently cause 56 color and 65 size conflicts in `smriti001`), backfill missing variant attributes from style and SKU representations, and deprecate `items.color` and `items.size`.

---

## 2. Business Motivation
In retail merchandise hierarchy standards (GS1, SAP Retail, Odoo Product Matrix), a parent product or style (e.g. `CH-01-A` or `CH-24-G`) represents a design archetype, not a single physical stock-keeping unit. When `items` stores `color='CREAM'` and `size='36'`, but has 14 child variants with distinct colors (`BLACK`, `BRONZE`, `CREAM`) and sizes (`36` to `42`), style-level queries yield contradictory information, barcode labels display wrong attributes, and warehouse picking tickets suffer attribute drift. Consolidating attributes at the variant level enforces strict multi-variant modeling.

---

## 3. Scope
1. **Attribute Inheritance Pipeline**:
   - For variants missing `color` or `size` whose parent item contains valid attribute values, inherit the parent's attribute before clearing.
   - For variants with structured SKU strings (e.g. `STYLE-COLOR-SIZE`), parse and populate missing `color` and `size` fields.
2. **Style-Level Attribute Deprecation**:
   - Clear legacy `items.color` and `items.size` values to `NULL`, eliminating conflicting style-level representations.
   - Annotate `Item.color` and `Item.size` as deprecated in `backend/app/models/item_master.py`.
3. **Domain Service & CLI Tooling**:
   - Create `backend/app/services/item/item_attribute_sync_svc.py` (`ItemAttributeSyncService`).
   - Create `scripts/sync_variant_attributes.py` (`--dry-run` and `--execute`).
   - Create automated test suite `backend/app/tests/test_item_master_phase10_attribute_dedup.py`.

---

## 4. Current State
- `items`: 2,727 rows (2 items with `color` and `size` populated: `CH-01-A` and legacy style).
- `item_variants`: 3,425 rows (951 with `color`, 912 with `size`).
- Style-to-variant conflicts: 56 color mismatches and 65 size mismatches where style attributes clash with child variant attributes.
- Variants missing attributes under populated styles: 25 variants missing `color`, 25 variants missing `size`.

---

## 5. Gap Analysis
| Attribute Layer | Current State | Required Target State |
|---|---|---|
| Variant SSOT | Redundant, conflicting attributes on `items` | 100% of color and size attributes governed exclusively by `item_variants` |
| Style/Variant Conflicts | 56 color & 65 size conflicts | 0 conflicts; `items.color` and `items.size` cleared to `NULL` |
| Missing Variant Attributes | 25 variants missing color/size under populated parent | Inherited and normalized onto `item_variants` |
| Model Governance | `Item.color` unannotated | Marked `@deprecated: use ItemVariant.color/size` in ORM & Schemas |

---

## 6. Architecture Impact
- Re-enforces **Domain-Driven Variant Modeling**: `items` represents styles, `item_variants` represents sellable SKUs.
- Zero breaking changes to POS or billing resolvers, which already read `item_variants.color` and `item_variants.size`.
- Prepares catalog for clean matrix imports and export catalogs.

---

## 7. Proposed Design
### Execution Flow:
1. `backfill_missing_variant_attributes()`:
   ```sql
   UPDATE item_variants iv
   SET color = i.color
   FROM items i
   WHERE iv.item_id = i.id
     AND (iv.color IS NULL OR iv.color = '')
     AND (i.color IS NOT NULL AND i.color != '');
   ```
   (Repeated for `size`).
2. `parse_structured_sku_attributes()`:
   Inspects `variant_sku` patterns (e.g. `<STYLE>-<COLOR>-<SIZE>`) to fill remaining blank variant attributes.
3. `deprecate_and_clear_item_attributes()`:
   ```sql
   UPDATE items
   SET color = NULL, size = NULL, modified_at = NOW()
   WHERE color IS NOT NULL OR size IS NOT NULL;
   ```

---

## 8. Files Created
1. `backend/app/services/item/item_attribute_sync_svc.py`
2. `scripts/sync_variant_attributes.py`
3. `backend/app/tests/test_item_master_phase10_attribute_dedup.py`
4. `docs/implementation/catalog/Item_Master_Phase10_Variant_Attribute_Deduplication_Plan_v6.70.5.md`
5. `docs/walkthrough/catalog/Item_Master_Phase10_Variant_Attribute_Deduplication_v6.70.5.md`

---

## 9. Files Modified
1. `package.json`
2. `backend/app/core/config.py`
3. `src/config/version.ts`
4. `CHANGELOG.md`
5. `backend/app/models/item_master.py`
6. `backend/app/services/item/__init__.py`
7. `docs/implementation/README.md`
8. `docs/walkthrough/README.md`

---

## 10. Dependencies
- PostgreSQL async session (`app.db.session.get_company_sessionmaker`).
- ORM models: `Item`, `ItemVariant` (`app.models.item_master`).

---

## 11. Risks
- *Risk:* An external consumer or legacy query reading `items.color` instead of `item_variants.color`.  
  *Mitigation:* Retain the columns `items.color` and `items.size` in the database schema (non-destructive deprecation), but establish `item_variants` as the authoritative source.

---

## 12. Rollback Strategy
All database modifications are wrapped in an atomic transaction. A rollback script or database transaction rollback restores the previous state without data loss.

---

## 13. Verification Plan
1. Check count of color and size mismatches before and after (target: 0).
2. Check count of variants with color/size before and after.
3. Check `items` color/size count (target: 0).
4. Run `python scripts/validate_version_ssot.py` (Rule 3).
5. Run `npx tsc --noEmit` (Rule 3).
6. Run `pytest backend/app/tests/test_item_master_phase10_attribute_dedup.py -v` (Rule 2).

---

## 14. Test Plan
- `test_variant_inherits_item_color_and_size`: Verifies variant inherits missing attributes from parent item.
- `test_variant_preserves_distinct_variant_attributes`: Verifies existing variant attributes are not overwritten.
- `test_style_level_attributes_cleared`: Verifies `items.color` and `items.size` are set to `NULL`.
- `test_idempotent_synchronization`: Verifies multiple runs yield consistent state without side effects.

---

## 15. Documentation Impact
- Updated Walkthrough (`docs/walkthrough/catalog/Item_Master_Phase10_Variant_Attribute_Deduplication_v6.70.5.md`).
- Master indexes updated in `docs/implementation/README.md` and `docs/walkthrough/README.md`.
- `CHANGELOG.md` updated with `6.70.5` release notes.

---

## 16. Deployment Plan
1. Deploy code updates to backend.
2. Execute `python scripts/sync_variant_attributes.py --execute` against target database node (`smriti001`).
3. Verify zero style-variant attribute drift.

---

## 17. Status
In Progress

---

## 18. Related ADRs
- `ADR-0021: Variant-Level Attribute and Pricing Independence`
- `ADR-0028: Multi-Variant Footwear & Apparel SKU Modeling`

---

## 19. Related Walkthroughs
- [`docs/walkthrough/catalog/Item_Master_Phase10_Variant_Attribute_Deduplication_v6.70.5.md`](../../walkthrough/catalog/Item_Master_Phase10_Variant_Attribute_Deduplication_v6.70.5.md)
- [`docs/walkthrough/catalog/Item_Master_Phase9_Price_Discrepancy_Sync_v6.70.4.md`](../../walkthrough/catalog/Item_Master_Phase9_Price_Discrepancy_Sync_v6.70.4.md)
