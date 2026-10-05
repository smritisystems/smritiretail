<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.70.4
  Created      : 2026-10-05
  Modified     : 2026-10-05
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: Item Master Phase 9 — Price Discrepancy & Price Book Synchronization

**Document ID:** `PLAN-CATALOG-P9-SYNC-v6.70.4`  
**Area:** Catalog, Pricing Architecture, Price Books, Revenue Integrity  
**Status:** Completed  
**Version:** `6.70.4`  
**Related Walkthrough:** [`Item_Master_Phase9_Price_Discrepancy_Sync_v6.70.4.md`](../../walkthrough/catalog/Item_Master_Phase9_Price_Discrepancy_Sync_v6.70.4.md)

---

## 1. Objective
Resolve historical commercial pricing divergence across the item catalog hierarchy (`items` vs. `item_variants` vs. `price_book_entries` vs. `item_sales_settings`). Synchronize authoritative variant selling prices and MRPs into company default price books (`price_books` / `price_book_entries`) and populate variant-level sales configurations (`item_sales_settings`) across all active tenant catalog records in `smriti001`.

---

## 2. Business Motivation
In modern retail ERP architecture (SAP, Odoo, SMRITI Pricing Domain), the Price Book is the canonical System of Record for transaction pricing. The audit identified that 2,625 out of 3,425 variants lack entries in company default price books, 609 variants have divergent selling prices compared to parent items, and 636 have divergent MRPs. This divergence risks billing inaccuracies, checkout price fluctuations, and reporting inconsistencies between POS counter terminals and back-office financial ledger postings.

---

## 3. Scope
1. **Bidirectional Price Harmonization**:
   - For variants with established commercial selling prices (`selling_price > 0`), synchronize parent `items.selling_price` and `items.mrp` to reflect variant prices as style reference prices.
   - For variants missing selling prices (`selling_price = 0` or `NULL`), inherit pricing from the parent item when parent price exists.
2. **Default Price Book Entry Synchronization**:
   - Ensure every company has a standard active default price book (`DEFAULT-<company_id>`).
   - Upsert `price_book_entries` for all 3,425 variants under their company's default price book, populating `selling_price`, `mrp`, `cost_price`, `min_quantity = 1`, and active tenant scoping.
3. **Item Sales Settings (Phase 2 Model) Population**:
   - Upsert `item_sales_settings` for all variants, binding `selling_price`, `mrp`, `allow_discount = True`, and `billable = True`.
4. **Service & Operational Tooling**:
   - Create domain service `ItemPricingSyncService` (`backend/app/services/item/item_pricing_sync_svc.py`).
   - Create CLI tool `scripts/sync_catalog_prices.py` (`--dry-run` and `--execute`).
   - Create test suite `backend/app/tests/test_item_master_phase9_pricing_sync.py`.

---

## 4. Current State
- `items`: 2,727 rows (467 rows with 0/NULL `selling_price`).
- `item_variants`: 3,425 rows (873 rows with 0/NULL `selling_price`).
- `items.mrp` vs `item_variants.mrp`: 636 mismatches.
- `items.selling_price` vs `item_variants.selling_price`: 609 mismatches.
- `price_book_entries`: 863 rows total (only 800 distinct variants covered; 2,625 variants uncovered).
- `item_sales_settings`: 20 rows total (3,405 variants unconfigured).

---

## 5. Gap Analysis
| Layer | Current State | Required Target State |
|---|---|---|
| Parent/Child Alignment | 609 SP & 636 MRP discrepancies | 0 unharmonized discrepancies between active variants and parent styles |
| Price Book Entries | 800 variants with PBEs (23.4%) | 100% active variants with default `price_book_entries` |
| Variant Sales Settings | 20 rows in `item_sales_settings` | 100% active variants configured in `item_sales_settings` |
| Tenant Isolation | Multiple company default price books unpopulated | Each tenant company's default price book populated |

---

## 6. Architecture Impact
- Re-enforces the **Pricing Domain as Sole System of Record** for commercial pricing evaluation.
- Preserves the `(price_book_id, variant_id)` unique constraint on `price_book_entries`.
- Populates the 1-to-1 extension table `item_sales_settings` introduced in Phase 2.
- Zero breaking changes to existing POS or sales order endpoints.

---

## 7. Proposed Design
### Price Hierarchy Resolution Rules:
```text
IF variant.selling_price > 0:
    authoritative_sp  = variant.selling_price
    authoritative_mrp = variant.mrp or variant.selling_price
ELSE IF item.selling_price > 0:
    authoritative_sp  = item.selling_price
    authoritative_mrp = item.mrp or item.selling_price
ELSE:
    authoritative_sp  = 0.00
    authoritative_mrp = 0.00
```
### Synchronization Pipeline:
1. `reconcile_catalog_prices()`: Sets `item_variants.selling_price = item.selling_price` where variant price is 0; sets `items.selling_price = min(variant.selling_price)` where item price is 0.
2. `sync_default_price_book_entries()`: Iterates over tenant companies, verifies or creates `DEFAULT-<company_id>` price book, and inserts/updates `price_book_entries` for all variants.
3. `sync_variant_sales_settings()`: Upserts `item_sales_settings` for each variant with authoritative commercial prices.

---

## 8. Files Created
1. `backend/app/services/item/item_pricing_sync_svc.py`
2. `scripts/sync_catalog_prices.py`
3. `backend/app/tests/test_item_master_phase9_pricing_sync.py`
4. `docs/implementation/catalog/Item_Master_Phase9_Price_Discrepancy_Sync_Plan_v6.70.4.md`
5. `docs/walkthrough/catalog/Item_Master_Phase9_Price_Discrepancy_Sync_v6.70.4.md`

---

## 9. Files Modified
1. `package.json`
2. `backend/app/core/config.py`
3. `src/config/version.ts`
4. `CHANGELOG.md`
5. `backend/app/services/item/__init__.py`
6. `docs/implementation/README.md`
7. `docs/walkthrough/README.md`

---

## 10. Dependencies
- PostgreSQL async session (`app.db.session.get_company_sessionmaker`).
- ORM models: `Item`, `ItemVariant`, `PriceBook`, `PriceBookEntry`, `ItemSalesSetting` (`app.models.item_master`, `app.models.pricing`).

---

## 11. Risks
- *Risk:* Overwriting intentional variant-specific price differentials (e.g. Size 42 priced higher than Size 36).  
  *Mitigation:* The hierarchy prioritizes variant price over parent item price. Variant price is only overridden if variant price is 0.00 or NULL.
- *Risk:* Locking large tables during bulk upsert.  
  *Mitigation:* Batched chunk processing (500 rows per batch) within single transaction scope.

---

## 12. Rollback Strategy
All changes are reversible via database backup or transactional rollback. Since no columns are deleted, rollback consists of rolling back the executing transaction or restoring price book snapshots if needed.

---

## 13. Verification Plan
1. Check before-and-after row counts for `price_book_entries` and `item_sales_settings`.
2. Check before-and-after count of variants without price book entries.
3. Check before-and-after count of price discrepancies.
4. Execute `validate_version_ssot.py` (Rule 3).
5. Execute `npx tsc --noEmit` (Rule 3).
6. Run `test_item_master_phase9_pricing_sync.py` (Rule 2).

---

## 14. Test Plan
- `test_reconcile_prices_inherits_parent_when_variant_zero`: Verifies variant with 0 price inherits parent item price.
- `test_reconcile_prices_preserves_variant_differential`: Verifies variant with positive price preserves its differential.
- `test_sync_price_book_entries_creates_entries`: Verifies missing variants receive default price book entries.
- `test_sync_sales_settings_upserts_correctly`: Verifies `item_sales_settings` are populated.

---

## 15. Documentation Impact
- Updated Walkthrough (`docs/walkthrough/catalog/Item_Master_Phase9_Price_Discrepancy_Sync_v6.70.4.md`).
- Master indexes updated in `docs/implementation/README.md` and `docs/walkthrough/README.md`.
- `CHANGELOG.md` updated with `6.70.4` release notes.

---

## 16. Deployment Plan
1. Deploy code updates to backend.
2. Execute `python scripts/sync_catalog_prices.py --execute` against target database node (`smriti001`).
3. Verify entry counts and POS lookup performance.

---

## 17. Status
In Progress

---

## 18. Related ADRs
- `ADR-0014: Pricing Domain as Canonical System of Record for Commercial Prices`
- `ADR-0021: Variant-Level Attribute and Pricing Independence`

---

## 19. Related Walkthroughs
- [`docs/walkthrough/catalog/Item_Master_Phase9_Price_Discrepancy_Sync_v6.70.4.md`](../../walkthrough/catalog/Item_Master_Phase9_Price_Discrepancy_Sync_v6.70.4.md)
- [`docs/walkthrough/catalog/Item_Master_Phase8_MultiTenant_Scope_Hardening_v6.70.3.md`](../../walkthrough/catalog/Item_Master_Phase8_MultiTenant_Scope_Hardening_v6.70.3.md)
