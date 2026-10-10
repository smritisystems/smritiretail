# SMRITI Item Master — Template vs. Implementation Gap List

**Purpose:** Handoff reference for whoever executes the bulk item-master import — what will work as-is, what needs a backend change first, and what's just a data/process decision.
**Source template:** `SMRITI_Item_Master_Standard_Template_fnal.xlsx` (uploaded, footwear/Tattly Threads pattern)
**Implementation reviewed:** `github.com/smritisystems/smritiretail`, branch `smritiNX`, commit `718843a7` (2026-09-25)
**Key files:** `backend/app/models/item_master.py`, `backend/app/schemas/item_master.py`, `backend/app/services/item_master_svc.py`, `backend/app/services/catalog_validation.py`, `backend/app/models/attributes.py`, `backend/app/api/v1/universal_import.py`

---

## 1. Confirmed working — no action needed

| Template field | Maps to | Why it's solid |
|---|---|---|
| BARCODE_NO | `ItemBarcode.barcode` | Own table, one-to-many — better than the template's 1:1 assumption |
| SKU_CODE | `ItemVariant.variant_sku` | Matches template's per-row SKU |
| ARTICLE_STYLE_CODE | `Item.style_code` | Governed (see §2), and Item/ItemVariant split matches the template's own "one style code across all sizes" fix |
| BRAND_NAME | `Item.brand` | Governed |
| VENDOR_CODE | `Item.vendor_code` | Governed. The alpha-sequential *assignment* (A, B, C…AA) is a manual data-entry convention for populating the master list — not something code needs to enforce, not a gap |
| MERCHANDISE_DEPARTMENT | `Item.department` | Governed |
| MERCHANDISE_CATEGORY | `Item.category` | Governed |
| IMAGE_LINK | `Item.primary_image_url` | Direct match |
| BUYING_PRICE | `Item.buying_price` | Direct match |
| DESIGN_ATTRIBUTE, OUTSOLE_MATERIAL | `attributes_json` | Template marks these "N" (free-text OK) — the unvalidated JSONB catch-all is the correct home for these |
| Bulk import path | `universal_import.py` → `UniversalItemMasterService.create_item` | Confirmed: bulk import reuses the *same* governed creation service as single-item entry, including the strict-mode validator below. No separate, laxer bulk path to worry about. |

**Governance mechanism (why the above are "solid"):** `CatalogDimensionValidator.validate_and_normalize_dimension(..., strict=True)` (`catalog_validation.py`, last modified 2026-09-24) queries a real `MasterType`/`MasterValue` table and raises HTTP 422 (`SMRITI-VAL-002`) on any value not already in the master list. This is genuinely enforced, not decorative — confirmed by reading the implementation, not just the interface.

---

## 2. Governed but incomplete — template says "must come from System Master Lookup," code doesn't check

The template's "From System Master Lookup" sheet marks 13 fields `Y`. Only 7 are actually wired into `CatalogDimensionValidator`. These 3 have a real lookup endpoint but nothing calls it at creation time:

| Field | Lookup exists? | Enforced at item creation? | Fix needed |
|---|---|---|---|
| GST_RATE_PERCENT | No dedicated master; only a hardcoded standard-slab check `{0,5,12,18,28}` at *pricing-resolution* time (`item_master_svc.py:785`), not at creation | ❌ | Add to `CatalogDimensionValidator.DIMENSION_FIELD_MAP`, or at minimum reject non-slab values at `create_item` |
| HSN_CODE | Yes — `/hsn-codes` in `master_lookup.py` | ❌ | Wire that endpoint's lookup into `create_item`/`UniversalItemMasterService` |
| UOM | Yes — `/uom` in `master_lookup.py` | ❌ | Same |

These 4 have neither a schema field nor any governance — they'd currently fall into the unvalidated `attributes_json` blob (or be silently dropped if the importer doesn't know to put them there):

| Field | Template says | What exists today |
|---|---|---|
| GENDER | Y (lookup-mandatory) | No `Item` column. No governance. |
| PRODUCT_TYPE | Y | No `Item` column. No governance. |
| HEEL_TYPE | Y | No `Item` column. No governance. |
| UPPER_MATERIAL | Y | No `Item` column. No governance. |

**Note:** `models/attributes.py` already has the right shape for this — `AttributeDefinition` (with `data_type="Select"`, `valid_values`, `is_mandatory`), `AttributeGroup`, `CategoryAttributeGroupMapping`. It's just not called from `create_item` as a validation gate. Two ways to close this, pick one before import:
- **(a)** Add GENDER/PRODUCT_TYPE/HEEL_TYPE/UPPER_MATERIAL as real `Item` columns and add them to `CatalogDimensionValidator`, matching how COLOR/SIZE/etc. already work, or
- **(b)** Actually wire `create_item` to validate `attributes_json` entries against `AttributeDefinition.valid_values` for whichever attributes are marked `is_mandatory` for the Footwear category (via `CategoryAttributeGroupMapping`) — this is the more scalable option since it doesn't require a schema migration per new footwear-specific attribute, but it's unbuilt today.

---

## 3. Structural mismatches — field exists, but not shaped like the template expects

| Template field | Where it actually lives | Implication for import |
|---|---|---|
| MRP / SELLING_PRICE | `Item.mrp` / `Item.selling_price` — model docstring explicitly labels these **"Non-authoritative legacy baseline; Pricing Domain (price_books/price_book_entries) is sole system-of-record"** | Importing this template populates inert baseline values only. A **separate Price Book setup step** (not covered by this template at all) is required before these prices are live in POS/billing. Confirmed: `create_item` never touches `price_book`. |
| LANDED_COST_PRICE | `Item.cost_price` | It's a flat manually-entered field here, not a computed landed cost (freight/duty/packing apportionment). If a real landed-cost engine exists elsewhere (e.g. GRN-side), it doesn't feed this field at item-creation time. Treat the template's LANDED_COST_PRICE as an initial estimate, not the final figure. |
| REORDER_LEVEL | `ItemWarehouseLocation.min_reorder_level` — correctly modeled *per warehouse*, not per item | The template's flat one-column-per-row shape can't map directly; the importer needs a target warehouse per row, which the template doesn't collect. Decide: default all rows to one warehouse, or add a WAREHOUSE_CODE column to the template. |
| TAX_INCLUSIVE_YN | `ItemBarcode.is_tax_inclusive`, not on `Item` | Lives at the barcode/sellable-unit level (arguably more correct — a "pack" barcode could differ from a "single" barcode) but the template puts it at the item-row level. Needs a mapping decision, not a code fix. |
| IS_SERVICE_YN | `Item.item_type` enum (`SERVICE` is one of its values) | Captured as a type choice, not a standalone boolean. Import logic should set `item_type="SERVICE"` when this template flag is Y, rather than expecting a literal boolean field to exist. |
| COLOR / SIZE | `Item.color` / `Item.size` (flat, governed columns) **and separately** `ItemVariant.attributes_json` (JSONB, documented in-code as `{"size": "XL", "color": "Navy"}`, unvalidated) | **This is an open design ambiguity, not just an import-mapping question.** Two places can hold color/size simultaneously with no reconciliation between them. Worth raising with whoever owns the Item/ItemVariant split before import: which one is authoritative for a size/color matrix SKU? |

---

## 4. No home at all — will be lost or misfiled on import unless addressed

| Field | Template says | Status |
|---|---|---|
| COLLECTION_TYPE | Not in the lookup-mandatory list, but is a real column in the template | No `Item` field; would need `attributes_json` |
| PURCHASE_CLASS | Not in the lookup-mandatory list | No `Item` field; would need `attributes_json` |
| ITEM_DESCRIPTION | Distinct column in template | No separate field — only `item_name` exists. Decide whether description gets appended to item_name or dropped. |
| IS_INVENTORY_YN | Boolean flag | No equivalent anywhere |
| IS_BILLABLE_YN | Boolean flag | No equivalent anywhere |
| LEAST_SALABLE_QTY | Present on the `Item` **model** | Not exposed in `ItemCreateRequest` schema — any value in the template will be silently ignored on import; item gets the server default (1.0000) instead |

---

## 5. Compliance flag carried over from the template's own Field Notes

The template's author already flagged: *"GST rate stored as a flat static number — recompute against the Rs.2,500 GST 2.0 threshold whenever Selling Price changes."* Confirmed in code: no such threshold check exists anywhere. The only GST-slab logic found (`item_master_svc.py:785`) validates against the fixed legal slab set `{0, 5, 12, 18, 28}` at pricing-resolution time — it has no concept of an MRP-based rate-switching threshold. This remains a manual/process responsibility until built; importing at scale without a manual QC pass on this risks exactly the "silent compliance bug" the template warned about.

---

## 6. Recommended sequencing before running a real import

1. **Decide COLOR/SIZE authority** (§3) — this affects how every SKU row in the template gets parsed, so resolve it first.
2. **Close the GENDER / PRODUCT_TYPE / HEEL_TYPE / UPPER_MATERIAL gap** (§2) — either add columns + governance, or wire `attributes_json` validation. Importing without this means four of the template's mandatory-lookup fields go in ungoverned or nowhere.
3. **Decide the REORDER_LEVEL → warehouse mapping** (§3) and, if needed, add a WAREHOUSE_CODE column to the template.
4. **Plan the Price Book step separately** (§3) — the import will not make prices live on its own.
5. **Add HSN_CODE / UOM / GST_RATE_PERCENT to `CatalogDimensionValidator`** (§2), or accept that these three "Y" fields are currently unenforced and rely on manual QC of the source file (the template's own Field Notes sheet already suggests this is fragile).
6. **Decide fate of COLLECTION_TYPE, PURCHASE_CLASS, ITEM_DESCRIPTION, IS_INVENTORY_YN, IS_BILLABLE_YN** (§4) — confirm with the business whether these are needed at go-live or can be deferred.
7. Only then run the actual bulk import — the underlying mechanism (`universal_import.py` → governed `create_item`) is sound and doesn't need rework itself.
