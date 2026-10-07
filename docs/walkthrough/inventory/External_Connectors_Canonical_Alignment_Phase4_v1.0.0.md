<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-10-08
  Modified     : 2026-10-08
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Technical Walkthrough — SMRITI DataBridge & Integrations
-->

# SMRITI External Third-Party Connector Payload Alignment & Canonical Export Convergence (Phase 4)

**Document ID:** `SMRITI-WGP-DATA-CONN-P4-v1.0.0`  
**Area:** DataBridge, Integrations, Connectors, Canonical Exports, Inventory Governance  
**Architectural Baseline:** Option B (Dual-Key Transitional Architecture)  
**SSOT Release Version:** `6.70.21`  
**Status:** Completed  

---

## 1. Purpose

This walkthrough documents the design, implementation, and automated verification of **Phase 4: External Third-Party Connector Payload Alignment & Canonical Export Convergence** under **Option B (Dual-Key Transitional Architecture)** in SMRITI Retail OS.

Following the successful establishment of the canonical stock identity gate and dual-key transaction writers in Phase 2, and downstream read-path convergence across reporting and procurement in Phase 3, Phase 4 systematically extends canonical schema alignment across the external interface boundaries:
1. Bi-directional third-party integration connectors (`TallyPrimeConnector`, `ShopifyConnector`, `UnicommerceConnector`, `SAPB1Connector`).
2. The universal streaming export engine (`DataBridgeExportEngine`) across all 15 retail entities and 4 supported formats (CSV, JSON, SMRITI_X, XLSX).
3. Preservation of 100% backward compatibility for external callers expecting `product_id` and legacy SKU identifiers, adhering strictly to the zero-schema-alteration and zero-historical-backfill guarantees.

---

## 2. Scope

### In Scope
1. **Universal Streaming Export Engine (`export_engine.py`)**:
   - Stamping of canonical dual keys (`item_id`, `variant_id`, `variant_sku`) alongside legacy `product_id` for single-entity (`ITEM`, `VARIANT`) and multi-line transactional documents (`SALES_INVOICE`, `PURCHASE_ORDER`, `GOODS_RECEIPT_NOTE`, `PURCHASE_INVOICE`, `SALES_ORDER`, `SALES_RETURN`, `STOCK_TRANSFER`, `STOCK_AUDIT`).
   - Model-defensive extraction using `getattr()` for foreign keys and line attributes across database model variations.
   - Exact parity verification across all four export formats: RFC 4180 CSV, JSON array, SMRITI-X sealed envelope, and OpenXML Excel (`.xlsx`).
2. **External Connector Inbound Normalization & Outbound Serialization**:
   - `TallyPrimeConnector`: Inbound XML voucher parsing preserving `variant_sku`, `variant_id`, `item_id`, and `description`. Outbound voucher XML push prioritizing `variant_sku` in `<STOCKITEMNAME>` and serializing `<BASICUSERDESCRIPTION>`, `<ITEMID>`, and `<VARIANTID>`.
   - `ShopifyConnector`: Inbound product variant unrolling capturing `variant_id`, `item_id`, `variant_sku`, `color` (`option1`), and `size` (`option2`). Outbound push serialization (`supports_push=True`) for inventory level adjustments and variant updates.
   - `UnicommerceConnector`: Inbound orders and catalog items mapping canonical variant keys and physical attributes. Outbound inventory adjustment push payloads stamped with dual keys.
   - `SAPB1Connector`: Inbound Item and DocumentLines mapping `U_VariantID`, `U_ItemID`, `U_Color`, and `U_Size`. Outbound document line push payloads serializing user-defined fields (UDFs).
3. **Automated Verification**:
   - 9-scenario dedicated automated test suite (`backend/tests/test_phase4_external_connectors_canonical_alignment.py`).
   - Full regression across existing DataBridge Connectors (7/7), DataBridge Export (7/7), Phase 3 Read Supremacy (10/10), Phase 2 Dual-Write (20/20), and TypeScript build (`tsc --noEmit`).
4. **SSOT Version Bumping**:
   - Coordinated bump to `6.70.21` across `src/config/version.ts`, `package.json`, `backend/app/core/config.py`, and `CHANGELOG.md`.

### Out of Scope
- Direct alterations or migrations to the PostgreSQL database schema (`alembic`).
- Modifications to historical database transaction lines.
- Complete deprecation of `product_id` (deferred to Phase 5: Complete Legacy Product Retirement).

---

## 3. Files Created

| File Path | Description |
|:---|:---|
| `docs/implementation/inventory/External_Connectors_Canonical_Alignment_Phase4_Plan_v1.0.0.md` | 19-section formal IPGP implementation plan for Phase 4. |
| `backend/tests/test_phase4_external_connectors_canonical_alignment.py` | Dedicated 9-test automated verification suite covering connectors, export engine dual-key stamping, and fallback mechanisms. |
| `docs/walkthrough/inventory/External_Connectors_Canonical_Alignment_Phase4_v1.0.0.md` | This 13-section formal WGP technical walkthrough. |

---

## 4. Files Modified

| File Path | Description |
|:---|:---|
| `backend/app/services/databridge/export_engine.py` | Added canonical dual keys (`item_id`, `variant_id`, `variant_sku`) to single-entity and multi-line export extraction; added model-defensive foreign key lookups; bumped header to `v1.1.0`. |
| `backend/app/services/databridge/connectors/tally_connector.py` | Updated inbound XML voucher parsing for `item_id`, `variant_id`, and `description`; aligned outbound XML serialization with canonical SKU and dual tags; bumped header to `v1.1.0`. |
| `backend/app/services/databridge/connectors/shopify_connector.py` | Aligned inbound catalog unrolling with `variant_id`, `item_id`, `variant_sku`, `color`, and `size`; implemented outbound push serialization with dual keys; bumped header to `v1.1.0`. |
| `backend/app/services/databridge/connectors/unicommerce_connector.py` | Aligned inbound items and orders with canonical dual keys and dimensions; updated outbound inventory adjustments with dual keys; bumped header to `v1.1.0`. |
| `backend/app/services/databridge/connectors/sap_b1_connector.py` | Aligned inbound OITM and OINV objects with UDF canonical keys (`U_VariantID`, `U_ItemID`, `U_Color`, `U_Size`); serialized UDFs in outbound DocumentLines; bumped header to `v1.1.0`. |
| `src/config/version.ts` | Bumped frontend SSOT version to `6.70.21`. |
| `package.json` | Bumped workspace package version to `6.70.21`. |
| `backend/app/core/config.py` | Bumped backend configuration `VERSION` to `6.70.21`. |
| `CHANGELOG.md` | Added formal release notes for `[6.70.21] - 2026-10-08`. |
| `docs/implementation/README.md` | Updated Phase 4 implementation plan entry to `Completed`. |
| `docs/walkthrough/README.md` | Appended Phase 4 walkthrough to chronological master table. |

---

## 5. Architecture Decisions

### AD-P4-01: Dual-Key Transitional Serialization in Export Engine
- **Context:** External reporting tools, accounting software, and analytics dashboards consume data exported via `DataBridgeExportEngine`. Some consumers rely on `product_id`, while modern consumers require canonical `item_id`, `variant_id`, and `variant_sku`.
- **Decision:** Every exported transaction line and item row serializes both legacy keys (`product_id`, `sku`) and canonical keys (`item_id`, `variant_id`, `variant_sku`). When a row represents a legacy product without canonical variants, `variant_id` emits `None`/empty while `product_id` and legacy `sku` remain fully populated.
- **Consequences:** Zero breakage for legacy downstream parsers; immediate readiness for modern variant-native integrations.

### AD-P4-02: Defensive Model-Attribute Access
- **Context:** In SQLAlchemy ORM models, child transaction lines utilize varying relationship attribute names across entities (e.g. `invoice_id` in `SalesInvoiceItem`, `order_id` in `PurchaseOrderItem`, `receipt_id` in `PurchaseReceiptItem`, `bill_id` in `PurchaseBillItem`).
- **Decision:** `export_engine.py` accesses line foreign keys and model columns defensibly via `getattr(item, ...)` cascades rather than hardcoded attribute paths.
- **Consequences:** Immunity to ORM attribute drift and schema variations across different test or production environments.

### AD-P4-03: Connector-Specific Dual-Key Translation
- **Context:** External platforms have differing native capabilities for storing variant metadata:
  - *TallyPrime:* Stores stock item name string and multi-line description; lacks custom fields without custom TDL.
  - *Shopify:* Native hierarchical Variant model with options (option1, option2).
  - *Unicommerce:* Uniware multichannel item master with itemTypeId and color/size attributes.
  - *SAP Business One:* Standard items with User-Defined Fields (`U_VariantID`, `U_ItemID`, `U_Color`, `U_Size`).
- **Decision:** Map canonical keys into the most idiomatic target fields for each connector:
  - TallyPrime pushes canonical `variant_sku` into `<STOCKITEMNAME>`, stamping `<ITEMID>` and `<VARIANTID>` XML tags, and preserves description.
  - Shopify maps `variant_id`, `item_id`, and unrolls `option1` (`color`) and `option2` (`size`).
  - Unicommerce maps `variant_id`, `item_id`, `color`, and `size` in inventory adjustments.
  - SAP B1 maps `U_VariantID`, `U_ItemID`, `U_Color`, and `U_Size` on `DocumentLines` and `OITM`.
- **Consequences:** Maximum interoperability with standard external ERP/e-commerce software while preserving canonical identity.

---

## 6. Design Rationale

Under Option B (Dual-Key Transitional Architecture), external systems cannot be assumed to upgrade simultaneously with internal ERP services. By incorporating canonical dual keys into export payloads and connector transformations while preserving legacy fields, SMRITI achieves:
1. **Uninterrupted Interoperability:** External warehouses, retail partners, and tax accountants can continue importing and exporting CSV, Excel, XML, or JSON files without modifying their ETL routines.
2. **Forward Convergence:** Partners ready to utilize canonical variant hierarchies can immediately query and filter by `variant_id`, `variant_sku`, `color`, and `size`.
3. **Statutory Integrity:** Exported financial documents maintain exact numerical parity across line items and grand totals regardless of the identity representation.

---

## 7. Implementation Summary

### 7.1 Export Engine (`export_engine.py`)
- Enhanced `fetch_entity_records()` for `DataBridgeEntityType.ITEM`: emits `item_id`, `product_id`, `item_code`, `name`, `category`, and UOM.
- Enhanced `DataBridgeEntityType.VARIANT`: emits `variant_id`, `item_id`, `variant_sku`, `sku`, `product_id`, `barcode`, `color`, and `size`.
- Enhanced multi-line transactional entities (`SALES_INVOICE`, `PURCHASE_ORDER`, `GOODS_RECEIPT_NOTE`, `PURCHASE_INVOICE`, `SALES_ORDER`, `SALES_RETURN`, `STOCK_TRANSFER`, `STOCK_AUDIT`):
  - Fetches associated transaction line items.
  - Resolves `product_id`, `item_id`, `variant_id`, `item_code`, `quantity`, `rate`/`price`, and line amounts.
  - Flattens into tabular format with dual keys in all columns.

### 7.2 TallyPrime Connector (`tally_connector.py`)
- Inbound: `_parse_voucher_element()` inspects `<ALLINVENTORYENTRIES.LIST>` and `<INVENTORYENTRIES.LIST>`, extracting `<STOCKITEMNAME>` (as `sku`), `<ITEMID>`, `<VARIANTID>`, and `<BASICUSERDESCRIPTION>` (as `description`).
- Normalization: `transform_to_databridge_rows()` maps `variant_sku`, `variant_id`, `item_id`, `sku`, and `product_id`.
- Outbound: `push_records()` prioritizes `variant_sku` in `<STOCKITEMNAME>`, adds `<BASICUSERDESCRIPTION>`, `<ITEMID>`, and `<VARIANTID>`.

### 7.3 Shopify Connector (`shopify_connector.py`)
- Inbound: `transform_to_databridge_rows()` maps `id` to `variant_id`, `product_id` to `item_id`, `sku` to `variant_sku`, `option1` to `color`, and `option2` to `size`.
- Outbound: `push_records()` formats canonical inventory adjustment and variant update payloads, enabling two-way sync (`supports_push=True`).

### 7.4 Unicommerce Connector (`unicommerce_connector.py`)
- Inbound: Normalizes Uniware items and sale order items, extracting `variant_id`, `item_id`, `variant_sku`, `color`, and `size`.
- Outbound: Formats `inventoryAdjustmentDTOList` with `item_id`, `variant_id`, and `variant_sku`.

### 7.5 SAP Business One Connector (`sap_b1_connector.py`)
- Inbound: Normalizes `OITM` items and `OINV` invoices, mapping `U_VariantID`, `U_ItemID`, `U_Color`, and `U_Size`.
- Outbound: Serializes `DocumentLines` with UDFs for SAP B1 Service Layer POST/PATCH.

---

## 8. Tests Executed

### Dedicated Phase 4 Automated Test Suite
Test file: `backend/tests/test_phase4_external_connectors_canonical_alignment.py`
Command: `.venv\Scripts\pytest.exe backend/tests/test_phase4_external_connectors_canonical_alignment.py -v`

| Test ID | Scenario | Result |
|:---|:---|:---:|
| `test_tc_p4_001` | Export Engine dual-key serialization across Sales Invoice & Purchase Order | **PASSED** |
| `test_tc_p4_002` | Export Engine legacy fallback when variant_id is NULL | **PASSED** |
| `test_tc_p4_003` | TallyPrime outbound push serializes canonical SKU, dual tags & description | **PASSED** |
| `test_tc_p4_004` | TallyPrime inbound XML voucher preserves dual keys & description | **PASSED** |
| `test_tc_p4_005` | Shopify inbound product & variant unrolling captures dual keys & dimensions | **PASSED** |
| `test_tc_p4_006` | Shopify outbound inventory adjustment formats canonical variant payload | **PASSED** |
| `test_tc_p4_007` | Unicommerce inbound and outbound alignment with dual keys & dimensions | **PASSED** |
| `test_tc_p4_008` | SAP B1 inbound and outbound DocumentLines serialize UDF variant keys | **PASSED** |
| `test_tc_p4_009` | Export Engine multi-format parity (CSV, JSON, SMRITI_X, XLSX) | **PASSED** |

### Regression Test Suites
1. **Existing DataBridge Connectors**: `backend/tests/test_databridge_phase8_connectors.py` (7/7 passed).
2. **Existing DataBridge Export**: `backend/tests/test_databridge_phase5_export.py` (7/7 passed).
3. **Phase 3 Read Supremacy**: `backend/tests/test_phase3_canonical_read_supremacy.py` (10/10 passed).
4. **Phase 2 Dual-Write Transaction**: `backend/tests/test_phase2_transaction_dual_write.py` (20/20 passed).
5. **Frontend Compilation**: `npx tsc --noEmit` (0 errors, exit code 0).

---

## 9. Verification Results

- **Phase 4 Automated Tests:** 9/9 Passed (100%)
- **DataBridge Connectors Regression:** 7/7 Passed (100%)
- **DataBridge Export Regression:** 7/7 Passed (100%)
- **Phase 3 Read Supremacy Regression:** 10/10 Passed (100%)
- **Phase 2 Dual-Write Regression:** 20/20 Passed (100%)
- **Total Automated Test Executions:** 53/53 Passed (100%)
- **TypeScript Static Analysis:** 0 Errors (`tsc --noEmit` clean)
- **Database Schema Integrity:** Zero migrations applied; zero schema alterations.

---

## 10. Known Limitations

1. **Connector Network Transport:** Connector `push_records()` methods serialize payloads in memory; actual HTTP dispatch depends on tenant runtime credentials and live third-party endpoint availability.
2. **SAP B1 UDF Prerequisite:** SAP Business One instances must have user-defined fields `U_VariantID`, `U_ItemID`, `U_Color`, and `U_Size` registered in `OITM` and `INV1` tables to store custom variant fields in SAP.

---

## 11. Future Work

- **Phase 5: Complete Legacy Product Retirement**: Once all external partners and frontend consumers migrate to variant-native endpoints, begin deprecation of legacy `product_id` columns and retire dual-write fallbacks.
- **Webhook Dual-Key Dispatch:** Extend outbound webhook triggers in `DataBridgeWebhookDispatcher` to include canonical variant events alongside standard entity changes.

---

## 12. Related ADRs

- `ADR-0042`: Canonical Identity Model (Item, Variant, Barcode Hierarchy).
- `ADR-0043`: Dual-Key Transitional Strategy (Option B).
- `ADR-0048`: Universal Streaming Export Engine Architecture.

---

## 13. Related RFCs

- `RFC-2026-08`: DataBridge Pluggable Third-Party Connector Architecture.
- `RFC-2026-11`: Multi-Channel Master Data Convergence for E-Commerce & ERP.
