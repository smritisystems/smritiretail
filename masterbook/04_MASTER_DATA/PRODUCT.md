<!--
  SMRITI Retail OS — Masterbook
  Document  : 04_MASTER_DATA/PRODUCT.md
  Status    : FROZEN (AP-008)
  Version   : 1.0.0  |  Created: 2026-08-10
-->

# Product / Item Master — Architecture Reference

---

## Product Aggregate Root

The Product (Item) is a DDD Aggregate Root owning:
- `ProductVariant` (SKU variants — size/color/weight)
- `ProductBarcode` (multiple barcodes per SKU)
- `ProductPricing` (price lists per company/branch/customer group)
- `ProductTaxProfile` (HSN code, GST rate)
- `ProductAttribute` (dynamic attributes via MasterValue system)

---

## Item Attribute Snapshot Governance (AP-008) — FROZEN

**This rule is permanently closed by architectural design.**

### The Rule
- `Product` stores attribute values as **point-in-time snapshots** (strings)
- `MasterValue` is the governance registry for allowed values (dropdowns, validation)
- String equality between `Product.attribute_value` and `MasterValue.name` does **NOT** create a persistent identity link

### Consequences
1. Changing a `MasterValue` name **does not** retroactively update existing product attributes
2. Changing a `MasterValue` name **does not** affect existing invoices, POs, or stock movements
3. `MasterValue` controls only: new item creation, Excel import validation, selection dropdowns

### Why This Design
- Invoices are historical records — they must preserve the item description at the time of sale
- Updating a `MasterValue` (e.g. "Red" → "Crimson") cannot retroactively change ₹50L of historical invoice lines
- This is the same principle as accounting: once posted, a ledger entry is immutable

---

## Product Table Key Columns

```sql
products
─────────────────────────────
id              VARCHAR(50) PK   -- "prod-{hex12}"
code            VARCHAR(50)      -- SKU code
name            VARCHAR(255) NOT NULL
barcode         VARCHAR(100)     -- primary barcode
company_id      VARCHAR(50) NOT NULL FK → companies
branch_id       VARCHAR(50) FK → branches
hsn_code        VARCHAR(10)      -- GST HSN classification
gst_rate        NUMERIC(5,2)     -- default GST %
unit_of_measure VARCHAR(20)      -- PCS / KG / LTR / BOX
category_id     VARCHAR(50)
brand_id        VARCHAR(50)
is_active       BOOLEAN NOT NULL DEFAULT true
is_deleted      BOOLEAN NOT NULL DEFAULT false
```

---

## Item Master Workspace (item-master)

Single workspace for all product management:
- Product Registry (list/search/filter)
- Variant Templates
- Dynamic Attributes
- Spreadsheet Studio (bulk import/export)
- Analytics

Rule PROD-002 / SWP-001: There shall be exactly ONE Inventory Workspace (`item-master`). No duplicate product management screens.

---

## Product Pricing

Pricing is resolved through policy layers:
1. Customer Group Price List
2. Branch Price List
3. Company Price List
4. Platform Default Price

The `STRE` (SMRITI Tax and Rate Engine) resolves the applicable price and tax.

---

*Status: FROZEN — AP-008 | Version: 1.0.0 | 2026-08-10*
