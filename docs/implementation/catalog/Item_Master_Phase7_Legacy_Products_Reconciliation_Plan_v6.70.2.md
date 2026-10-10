<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.70.2
  Created      : 2026-10-05
  Modified     : 2026-10-05
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: Item Master Phase 7 — Legacy Products Reconciliation & Transactional Backfill v6.70.2

## 1. Objective
Reconcile and migrate the remaining 1,566 unmigrated legacy `products` records into canonical `items`, `item_variants`, and `item_barcodes`, backfilling `products.item_id` and `products.item_variant_id`. Furthermore, backfill the 2,831 unlinked `sales_invoice_items`, 2,457 unlinked `stock_movements`, and 48 unlinked `purchase_receipt_items` so that all historical and active transactions point to canonical Item Master records, concluding the strangler-fig migration with 100% catalog parity.

## 2. Business Motivation
- **Catalog Fragmentation Risk**: Currently, 66.4% (1,566 out of 2,359) of rows in `products` have `item_id = NULL`. These items cannot be managed through the modernized Item Master interface, lack PriceBook integration, and bypass domain-driven validation policies.
- **Transactional Audit Integrity**: 2,831 sales invoice lines and 2,457 stock movements reference legacy `product_id` values whose `item_id` and `item_variant_id` remain `NULL`. This impairs unified inventory valuation (COGS), WMS bin allocation, and cross-channel reporting.
- **Strangler-Fig Migration Closure**: Completing this reconciliation allows the legacy `products` table to transition into a sealed read-only or compatibility view, removing dual-write requirements.

## 3. Scope
1. **Reconciliation Service (`backend/app/services/item/legacy_reconciliation_svc.py`)**:
   - Multi-tenant aware reconciliation engine with strict `company_id` propagation.
   - Matching hierarchy:
     1. Match existing canonical Item by `item_code == product.style_code` or `item_code == product.code`.
     2. Match existing ItemVariant by `(company_id, variant_sku)`.
     3. Match existing ItemBarcode by `(company_id, barcode)`.
     4. Create canonical Item, ItemVariant, and ItemBarcode where no match exists.
   - Link `products.item_id = item.id` and `products.item_variant_id = variant.id`.
2. **Transactional Line Backfill**:
   - Reconcile `sales_invoice_items` with `item_id IS NULL` using `products.item_id` and `products.item_variant_id`.
   - Reconcile `stock_movements` with `item_id IS NULL` using `products.item_id` and `products.item_variant_id`.
   - Reconcile `purchase_receipt_items` with `item_id IS NULL` using `products.item_id` and `products.item_variant_id`.
3. **Execution Script & Dry-Run CLI (`scripts/reconcile_legacy_products.py`)**:
   - Provide a safe CLI tool supporting `--dry-run` and `--execute` modes with batch processing and progress reporting.
4. **Automated Verification Suite (`backend/app/tests/test_item_master_phase7_legacy_reconciliation.py`)**:
   - Validate idempotent reconciliation across test and live products.
   - Verify transaction line backfills and company scoping.

## 4. Current State
- `products`: 2,359 total rows; 793 linked (`item_id NOT NULL`), 1,566 unlinked (`item_id IS NULL`).
- `sales_invoice_items`: 16,360 total rows; 2,831 with `item_id IS NULL`.
- `stock_movements`: 9,097 total rows; 2,457 with `item_id IS NULL`.
- `purchase_receipt_items`: 76 total rows; 48 with `item_id IS NULL`.
- Compound unique constraints enforced: `(company_id, barcode)` on `item_barcodes` and `(company_id, variant_sku)` on `item_variants`.

## 5. Gap Analysis
| Entity / Dimension | Pre-Phase 7 State | Phase 7 Target State |
|---|---|---|
| Unmigrated Products | 1,566 unlinked products (66.4%) | 0 unlinked active products (100% linked) |
| Multi-tenant scoping | Products without company_id | Standardized fallback to 'COMP-001' |
| Transactional Sales Lines | 2,831 NULL `item_id` | 0 NULL `item_id` for migrated products |
| Stock Movements | 2,457 NULL `item_id` | 0 NULL `item_id` for migrated products |
| Purchase Receipt Lines | 48 NULL `item_id` | 0 NULL `item_id` for migrated products |
| Strangler-Fig Migration | 33.6% complete | 100% complete |

## 6. Architecture Impact
- **Non-Destructive Evolution**: Legacy `products` table is untouched structurally; only foreign keys `item_id` and `item_variant_id` are populated.
- **Domain Decoupling**: POS, GRN, and reporting systems now resolve catalog data entirely through canonical `items`, `item_variants`, and `item_barcodes`.
- **Constraint Safety**: New canonical records strictly honor compound unique constraints `(company_id, barcode)` and `(company_id, variant_sku)` without collision exceptions.

## 7. Proposed Design
```text
Legacy Product (products)
    │
    ├── Step 1: Match or Create Item
    │     ├── Query items WHERE company_id = p.company_id AND item_code IN (p.style_code, p.code, p.sku)
    │     └── If match: link item; Else: create Item(item_code=..., primary_uom=..., tracking_type=...)
    │
    ├── Step 2: Match or Create ItemVariant
    │     ├── Query item_variants WHERE company_id = p.company_id AND variant_sku IN (p.sku, p.code)
    │     └── If match: link variant; Else: create ItemVariant(variant_sku=..., mrp=..., selling_price=...)
    │
    ├── Step 3: Match or Create ItemBarcode
    │     ├── If p.barcode: Query item_barcodes WHERE company_id = p.company_id AND barcode = p.barcode
    │     └── If missing: create ItemBarcode(barcode=p.barcode, is_primary=True)
    │
    ├── Step 4: Link Product
    │     └── UPDATE products SET item_id = item.id, item_variant_id = variant.id WHERE id = p.id
    │
    └── Step 5: Backfill Transactional References
          ├── UPDATE sales_invoice_items SET item_id = p.item_id, item_variant_id = p.item_variant_id
          ├── UPDATE stock_movements SET item_id = p.item_id, item_variant_id = p.item_variant_id
          └── UPDATE purchase_receipt_items SET item_id = p.item_id, item_variant_id = p.item_variant_id
```

## 8. Files Created
1. `backend/app/services/item/legacy_reconciliation_svc.py`: Domain reconciliation service.
2. `scripts/reconcile_legacy_products.py`: CLI reconciliation runner with dry-run and transaction controls.
3. `backend/app/tests/test_item_master_phase7_legacy_reconciliation.py`: Automated pytest test suite.
4. `docs/implementation/catalog/Item_Master_Phase7_Legacy_Products_Reconciliation_Plan_v6.70.2.md`: This 19-section plan.
5. `docs/walkthrough/catalog/Item_Master_Phase7_Legacy_Products_Reconciliation_v6.70.2.md`: 13-section walkthrough.

## 9. Files Modified
1. `package.json`: Version bump to 6.70.2.
2. `backend/app/core/config.py`: Version bump to 6.70.2.
3. `src/config/version.ts`: Version bump to 6.70.2.
4. `CHANGELOG.md`: Record Phase 7 changes under [6.70.2].
5. `docs/implementation/README.md`: Register Phase 7 plan.
6. `docs/walkthrough/README.md`: Register Phase 7 walkthrough.

## 10. Dependencies
- PostgreSQL 15 on port 2781 (`smriti001`).
- SQLAlchemy 2.0 with asyncpg session engine.
- Existing tables: `products`, `items`, `item_variants`, `item_barcodes`, `sales_invoice_items`, `stock_movements`, `purchase_receipt_items`.

## 11. Risks
- **Barcode Collisions**: Products sharing barcode with existing variants in same company. Mitigated by checking `(company_id, barcode)` and linking existing variant rather than raising unique constraint violation.
- **Transaction Table Volume**: 16k sales lines and 9k stock movements. Mitigated by targeted indexed updates joining on `product_id`.

## 12. Rollback Strategy
All updates are additive (populating existing NULL foreign keys). In the event of a rollback, `item_id` and `item_variant_id` on newly migrated products can be reset to NULL without affecting existing transactions.

## 13. Verification Plan
- Dry-run analysis verifying 100% of candidate mappings.
- Live execution verifying 0 active unlinked products in `products`.
- Post-migration count verification on `sales_invoice_items`, `stock_movements`, and `purchase_receipt_items`.
- Execution of automated test suite `test_item_master_phase7_legacy_reconciliation.py`.
- Clean TypeScript compiler check (`npx tsc --noEmit`).
- Version SSOT validator (`scripts/validate_version_ssot.py`).

## 14. Test Plan
- Run `pytest backend/app/tests/test_item_master_phase7_legacy_reconciliation.py -v`.
- Run `pytest backend/app/tests/test_item_master_phase6_pos_grn_tracking_wiring.py -v`.
- Run `pytest backend/app/tests/test_item_master_phase5_tracking_wiring.py -v`.

## 15. Documentation Impact
- Implementation Plan in `docs/implementation/catalog/`.
- Walkthrough in `docs/walkthrough/catalog/`.
- Indices in `docs/implementation/README.md` and `docs/walkthrough/README.md`.
- Release notes in `CHANGELOG.md`.

## 16. Deployment Plan
1. Validate database connection and take snapshot/backup if applicable.
2. Run `scripts/reconcile_legacy_products.py --dry-run` to preview reconciliations.
3. Run `scripts/reconcile_legacy_products.py --execute` to perform transactional migration.
4. Deploy code updates via `git pull` on test node `F:\Smriti9`.

## 17. Status
Completed

## 18. Related ADRs
- `docs/adr/ADR-0045_Universal_Item_Master_Architecture.md`
- `docs/adr/ADR-0046_FastAPI_Postgres_Sole_System_of_Record.md`

## 19. Related Walkthroughs
- `docs/walkthrough/catalog/Item_Master_Phase6_POS_GRN_Tracking_UI_Wiring_v6.70.1.md`
- `docs/walkthrough/catalog/Item_Master_Phase7_Legacy_Products_Reconciliation_v6.70.2.md`
