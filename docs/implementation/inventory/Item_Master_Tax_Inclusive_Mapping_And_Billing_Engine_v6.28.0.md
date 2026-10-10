<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS

  Founders

  * Pushpa Devi Jawahar Mallah
    * Founder & Chairperson
    * Phone: +91 9324117007
    * Email: founder@aitdl.com

  * Jawahar Ramkripal Mallah
    * Founder, Chief Executive Officer (CEO) & Chief Software Architect
    * Email: founder@aitdl.com

  * Websites: aitdl.com | erpnbook.com | smritibooks.com

  * Version    : 6.28.0
  * Created    : 2026-09-16
  * Modified   : 2026-09-16
  * Copyright  : © SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
  * Classification: Internal
-->

# Implementation Plan: Item Master Tax-Inclusive Mapping & Dual-Mode Calculation Engine (v6.28.0)

## 1. Objective
Establish explicit, catalog-authoritative mapping of tax inclusion (`is_tax_inclusive: bool`) on catalog items (`products`, `items`, `item_variants`) in Item Master creation and propagate this configuration seamlessly across Sales Invoicing, POS checkout, and statutory GST calculation engines.

## 2. Business Motivation
In Indian retail, statutory MRP (Maximum Retail Price) is strictly inclusive of all taxes under the Legal Metrology (Packaged Commodities) Rules, 2011. However, wholesale merchandise, fabric yardage, custom services, freight charges, and B2B orders are priced as raw base rates (exclusive of taxes), where GST must be added on top. Without catalog-level tax inclusion flags, systems either force all lines to be inclusive (breaking B2B wholesale quotation margins) or force all lines to be exclusive (causing checkout discrepancies where register prices exceed printed shelf MRPs).

## 3. Scope
- **In Scope:**
  - Alembic migration adding `is_tax_inclusive` boolean column (`default=True`) to `products`, `items`, and `item_variants`.
  - Pydantic schemas update for `ItemCreateRequest`, `ItemUpdateRequest`, `ProductCreate`, `ProductUpdate`.
  - Item Master UI grid & drawer support in `ItemDetailsGrid.tsx` allowing operators to choose `Inclusive (MRP)` vs `Exclusive (Base)`.
  - Hierarchical resolution chain in `CanonicalSalesWriter`, `SalesService`, and `UnifiedSalesLedgerService`.
  - POS cart resolution in `ProPosBillingTerm.tsx` ensuring mixed carts (inclusive + exclusive) calculate exact statutory GST splits.
  - Automated test suite verifying 5 business scenarios.
- **Out of Scope:**
  - Altering statutory MRP ceiling checks (`unit_price <= mrp` remains mandatory).
  - Altering tax slab rates (0%, 5%, 12%, 18%, 28% remain catalog-authoritative).

## 4. Current State
- `products` has `mrp`, `price`, `gst_percentage`, and `attributes` (JSONB).
- `items` has `mrp`, `selling_price`, `cost_price`, `tax_rate`, and `attributes_json` (JSONB).
- `customer_groups` has `tax_inclusive: Column(Boolean, default=True)`.
- `SalesInvoiceItemCreate` and `CanonicalItemLine` accept optional `is_tax_inclusive`.
- If unspecified on the line, backend defaults to channel heuristic (`POS_RETAIL -> True`, `B2B -> False`).

## 5. Gap Analysis
- Operators cannot designate whether a catalog item's selling price is tax-inclusive or exclusive at the product master level.
- Multi-category stores selling both packaged goods (MRP inclusive) and bulk/fabric items (tax exclusive) require manual line toggling at checkout, creating cashier error risk.

## 6. Architecture Impact
- Enforces single source of truth for pricing mode at the catalog item level while preserving customer-level contract overrides.
- Zero dual-write hazard: values are committed to PostgreSQL `products` and `items` synchronously.

## 7. Proposed Design
### 3-Tier Tax Mode Resolution Hierarchy
```text
Tier 1: Explicit Line Item Override (request item.is_tax_inclusive)
                     │
                     ▼ (if None)
Tier 2: Item Master Catalog Master (product.is_tax_inclusive / item.is_tax_inclusive)
                     │
                     ▼ (if None)
Tier 3: Customer Group Policy (customer_groups.tax_inclusive)
                     │
                     ▼ (if None)
Tier 4: Channel Default (POS Retail = True; B2B Wholesale = False)
```

### Dual-Mode Calculation Formulas (gst_engine.py & gstEngine.ts)
- **Inclusive (`is_tax_inclusive = True`):**
  - $\text{Taxable Value} = \frac{\text{Gross Total}}{1 + (\text{GST Rate} / 100)}$
  - $\text{Tax Amount} = \text{Gross Total} - \text{Taxable Value}$
  - $\text{Total} = \text{Gross Total}$
- **Exclusive (`is_tax_inclusive = False`):**
  - $\text{Taxable Value} = \text{Gross Total}$
  - $\text{Tax Amount} = \text{Taxable Value} \times (\text{GST Rate} / 100)$
  - $\text{Total} = \text{Taxable Value} + \text{Tax Amount}$

## 8. Files Created
1. `backend/alembic/versions/v1455_add_is_tax_inclusive_to_items_products.py`
2. `backend/tests/test_item_tax_inclusive_governance.py`
3. `docs/implementation/inventory/Item_Master_Tax_Inclusive_Mapping_And_Billing_Engine_v6.28.0.md`

## 9. Files Modified
1. `backend/app/models/inventory.py`
2. `backend/app/models/item_master.py`
3. `backend/app/schemas/inventory.py`
4. `backend/app/schemas/item_master.py`
5. `backend/app/services/item_master_svc.py`
6. `backend/app/services/canonical_sales_writer.py`
7. `backend/app/services/sales.py`
8. `backend/app/services/sales_ledger_svc.py`
9. `src/components/itemMaster/types.ts`
10. `src/components/itemMaster/ItemDetailsGrid.tsx`
11. `src/components/billing/propos/ProPosBillingTerm.tsx`
12. `docs/implementation/README.md`
13. `CHANGELOG.md`

## 10. Dependencies
- SQLAlchemy 2.0 async engine
- Alembic migration framework
- PostgreSQL 15 (`smriti001`, `smritisys`)
- React 18 + Vite client

## 11. Risks
- **Risk:** Existing catalog records might have NULL values if migration does not specify `server_default`.
  - **Mitigation:** Migration applies `server_default=sa.text('true')` and sets `nullable=False`, ensuring 100% of historical products seamlessly default to retail MRP inclusive.

## 12. Rollback Strategy
- Alembic downgrade script drops `is_tax_inclusive` from `products`, `items`, and `item_variants`.
- Code changes gracefully fall back to existing channel defaults if column is absent.

## 13. Verification Plan
- Column inspection in PostgreSQL verifying AST parity across tables.
- Migration upgrade and downgrade round-trip test.

## 14. Test Plan
- `test_item_tax_inclusive_governance.py`:
  1. Default schema validation on `Product` and `Item`.
  2. Tax-inclusive line math test (₹1,180 with 18% GST -> ₹1,000 base + ₹180 tax).
  3. Tax-exclusive line math test (₹1,000 with 18% GST -> ₹1,000 base + ₹180 tax -> ₹1,180 total).
  4. Mixed cart calculation aggregating both inclusive and exclusive items.
  5. POS checkout end-to-end integration test.

## 15. Documentation Impact
- Update `docs/implementation/README.md`
- Update `docs/walkthrough/README.md`
- Update `CHANGELOG.md` with version `6.28.0`.

## 16. Deployment Plan
- Run `alembic upgrade head`.
- Rebuild production client bundle `npm run build`.
- Rebuild docker containers `docker compose build && docker compose up -d`.

## 17. Status
Draft (Awaiting User Review & Approval)

## 18. Related ADRs
- `ADR-005`: Canonical Table Convergence & One-Way Projections
- `ADR-FROZEN-003`: Universal Item Master Sole Product System of Record

## 19. Related Walkthroughs
- `docs/walkthrough/billing/Billing_Statutory_Sales_Factors_And_Customer_Price_Groups_v6.17.1.md`
- `docs/walkthrough/inventory/Universal_Item_Master_5Tier_Resolution_And_Retirement_v4.13.0.md`
