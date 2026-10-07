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
  Classification: Implementation Plan — Phase 4: External Connectors & Export Alignment
-->

# SMRITI External Third-Party Connector Payload Alignment & Canonical Export Convergence — Phase 4 Implementation Plan

## 1. Objective
Following the completion of Phase 2 (Global Stock Identity Gate & Dual-Key Transaction Write Convergence) and Phase 3 (Canonical Transaction Supremacy — Read-Path & Reporting Convergence), the primary objective of Phase 4 is to align external third-party sync connectors (TallyPrime, Shopify, Unicommerce, SAP B1) and the DataBridge Streaming Exporter (`backend/app/services/databridge/export_engine.py`) with canonical entity schemas. Outbound serialization and inbound normalization must fully carry canonical identities (`variant_id`, `item_id`, variant dimensions `color`, `size`, `variant_sku`) under Option B (Dual-Key Transitional Architecture) while guaranteeing 100% backward compatibility for downstream legacy systems requiring traditional `product_id` and legacy SKU values.

## 2. Business Motivation
In modern multi-channel retail environments, the central ERP/POS system must synchronize catalog, order, and inventory data across heterogeneous external platforms:
- **Statutory Accounting Systems (TallyPrime / Tally.ERP 9)**: Must reflect exact canonical SKUs and variation descriptions on daybook sales vouchers without disrupting account ledgers.
- **E-Commerce Marketplaces & Frontends (Shopify, Unicommerce / Uniware)**: Require granular variant dimension mapping (Color, Size, Option1/2) and canonical SKU identifiers for accurate inventory reconciliation across Amazon, Flipkart, Myntra, and online stores.
- **Enterprise ERPs (SAP Business One DI-API / Service Layer)**: Require item codes and user-defined fields (UDFs) for variant tracking (`U_VariantID`, `U_ItemID`, `U_Color`, `U_Size`) alongside traditional master keys.
- **DataBridge Streaming Exporter**: Enterprise data exports (CSV, JSON, SMRITI-X, OpenXML XLSX) must provide tabular parity across all 15 supported entities, emitting canonical identifiers (`variant_id`, `item_id`, `variant_sku`) alongside legacy fields to ensure data warehouse reporting and external BI pipelines can aggregate by canonical product dimensions.

## 3. Scope
- **In Scope**:
  - `backend/app/services/databridge/export_engine.py`: Multi-format streaming exporter for catalog and transactional entities (`ITEM`, `VARIANT`, `PURCHASE_ORDER`, `GOODS_RECEIPT_NOTE`, `PURCHASE_INVOICE`, `SALES_INVOICE`, `SALES_ORDER`, `SALES_RETURN`, `STOCK_TRANSFER`, `STOCK_AUDIT`).
  - `backend/app/services/databridge/connectors/tally_connector.py`: Outbound voucher XML generation and inbound voucher normalization with canonical SKU and variant descriptions.
  - `backend/app/services/databridge/connectors/shopify_connector.py`: Product variant ingestion and order normalization with canonical variant dimensions and dual keys.
  - `backend/app/services/databridge/connectors/unicommerce_connector.py`: Multi-channel order normalization and inventory push synchronization with canonical variant identity.
  - `backend/app/services/databridge/connectors/sap_b1_connector.py`: Service Layer OData payload transformation for OITM and OINV document lines with canonical variant UDFs and dual keys.
  - Regression verification across existing Phase 2, Phase 3, and DataBridge test suites.
- **Out of Scope / Schema Freeze**:
  - No database migrations or schema alterations (strict schema freeze).
  - No alteration of historical transaction records.
  - No changes to frozen core transactional services (`ProductResolutionService`, `CanonicalSalesWriter`, `SalesStockAuthority`, `HeadlessBillingCore`).

## 4. Current State
- Inbound DataBridge domain adapters (`sales_invoice_adapter.py`, `grn_adapter.py`, etc.) utilize `ProductResolutionService` to resolve canonical identities during import.
- However, the multi-format exporter (`export_engine.py`) extracts `"item_code": getattr(li, "item_code", str(li.product_id))` without exporting `item_id`, `variant_id`, or `product_id` across multi-line documents.
- Connector transformations (`tally_connector.py`, `shopify_connector.py`, `unicommerce_connector.py`, `sap_b1_connector.py`) discard variant IDs or fail to serialize canonical variant attributes in outbound payloads.

## 5. Gap Analysis
1. **Export Engine Tabular Omission**: Flat file exports (CSV/JSON/XLSX/SMRITI-X) lack `item_id`, `variant_id`, and `product_id` columns on line-item records, forcing external consumers to infer variants solely from textual item names.
2. **TallyPrime Outbound Voucher Missing Variant Identity**: Tally XML `<ALLINVENTORYENTRIES.LIST>` serializes `<STOCKITEMNAME>` without prioritizing `variant_sku`, and omits variant attributes (`color`, `size`, `variant_id`) in `<BASICUSERDESCRIPTION>` or custom tags.
3. **Shopify & Unicommerce Normalization Gaps**: Inbound order normalization drops `product_id` and `variant_id` from line items, delivering only string SKUs to downstream adapters.
4. **SAP B1 UDF Incomplete Mapping**: Service Layer push serialization does not map canonical `variant_id` or `item_id` to standard SAP B1 user fields (`U_VariantID`, `U_ItemID`).

## 6. Architecture Impact
- **Non-Breaking Dual-Key Output**: Outbound payloads and exported tabular datasets include both legacy `product_id` and canonical `variant_id`/`item_id`.
- **System of Record Integrity**: Adheres to the SMRITI Backend System-of-Record Policy (FastAPI + PostgreSQL sole backend).
- **Format Parity**: All 4 export formats (CSV with UTF-8 BOM, JSON, SMRITI-X sealed package with SHA256 integrity, OpenXML XLSX) serialize identical canonical columns.

## 7. Proposed Design
1. **Export Engine Dual-Key Expansion**:
   - `ITEM`: Emits `item_id`, `item_code`, `item_name`, etc.
   - `VARIANT`: Emits `variant_id`, `variant_code`, `variant_sku`, `sku`, `item_id`, `color`, `size`, etc.
   - All line-item entities (`PURCHASE_ORDER`, `GOODS_RECEIPT_NOTE`, `PURCHASE_INVOICE`, `SALES_INVOICE`, `SALES_ORDER`, `SALES_RETURN`, `STOCK_TRANSFER`, `STOCK_AUDIT`): Emit `product_id`, `item_id`, `variant_id`, `item_code` (with fallback to `product_id` if code is missing).
2. **TallyPrime Outbound & Inbound Convergence**:
   - Outbound: Prioritize `variant_sku` in `<STOCKITEMNAME>`. Include `<BASICUSERDESCRIPTION>` and custom `<ITEMID>`, `<VARIANTID>` elements.
   - Inbound: Extract canonical variant keys and dimensions into normalized rows.
3. **Shopify & Unicommerce Convergence**:
   - Inbound: Flatten variant options (`option1` -> `color`, `option2` -> `size`) and map `variant_id`, `item_id`, `variant_sku`.
   - Outbound: Push records serialize canonical SKU and dual keys.
4. **SAP B1 Convergence**:
   - Inbound: Extract `U_VariantID`, `U_ItemID`, `U_Color`, `U_Size` from DocumentLines / Items.
   - Outbound: Include `U_VariantID`, `U_ItemID`, `U_Color`, `U_Size` in `DocumentLines`.

## 8. Files Created
- `docs/implementation/inventory/External_Connectors_Canonical_Alignment_Phase4_Plan_v1.0.0.md` (this plan).
- `docs/walkthrough/inventory/External_Connectors_Canonical_Alignment_Phase4_v1.0.0.md` (walkthrough document).
- `backend/tests/test_phase4_external_connectors_canonical_alignment.py` (automated verification test suite).

## 9. Files Modified
- `backend/app/services/databridge/export_engine.py`
- `backend/app/services/databridge/connectors/tally_connector.py`
- `backend/app/services/databridge/connectors/shopify_connector.py`
- `backend/app/services/databridge/connectors/unicommerce_connector.py`
- `backend/app/services/databridge/connectors/sap_b1_connector.py`
- `src/config/version.ts`
- `package.json`
- `backend/app/core/config.py`
- `CHANGELOG.md`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`

## 10. Dependencies
- FastAPI 0.111+ / SQLAlchemy 2.0+ AsyncSession.
- OpenPyXL for XLSX generation.
- Python standard library (`xml.etree.ElementTree`, `csv`, `json`, `hashlib`).

## 11. Risks
- **Risk**: Downstream CSV parsers expecting fixed header order.
  - **Mitigation**: New columns (`item_id`, `variant_id`) are appended alongside existing fields; field names match canonical database column conventions.
- **Risk**: Tally XML parser rejecting unknown tags.
  - **Mitigation**: Canonical variant information is packaged inside standard `<BASICUSERDESCRIPTION>` while `<STOCKITEMNAME>` holds the canonical SKU.
- **Risk**: Null variant IDs on historical legacy rows causing runtime exceptions.
  - **Mitigation**: Defensive `getattr(li, "variant_id", None)` and safe fallback strings ensure 100% null-safe execution.

## 12. Rollback Strategy
- In case of regressions, the changes are code-only within stateless exporters and connectors.
- Git revert to commit `664bd2e7b45c49af70c2592fa6e9d8650cc956b9` restores previous export engine behavior without any database state corruption.

## 13. Verification Plan
- Verify multi-format exporter exports dual keys (`product_id`, `item_id`, `variant_id`) for all transaction types.
- Verify historical records with NULL variant IDs export gracefully without regression.
- Verify TallyPrime, Shopify, Unicommerce, and SAP B1 connectors bi-directionally handle canonical variant identifiers.
- Execute full regression suites across Phase 2, Phase 3, and DataBridge components.

## 14. Test Plan
- Run `backend/tests/test_phase4_external_connectors_canonical_alignment.py` (9 test cases covering all connectors and export formats).
- Run `backend/tests/test_databridge_phase8_connectors.py` and `test_databridge_phase5_export.py`.
- Run Phase 3 read supremacy suite: `backend/tests/test_phase3_canonical_read_supremacy.py`.
- Run Phase 2 dual-write regression suite: `backend/tests/test_phase2_transaction_dual_write.py`.
- Run frontend type check: `npx tsc --noEmit`.

## 15. Documentation Impact
- Update `CHANGELOG.md` for version `6.70.21`.
- Append master index in `docs/implementation/README.md`.
- Create and register 13-section walkthrough in `docs/walkthrough/inventory/External_Connectors_Canonical_Alignment_Phase4_v1.0.0.md` and `docs/walkthrough/README.md`.

## 16. Deployment Plan
- Code deployed to DEV (`D:\Smriti_Retail_OS`), committed, pushed to `origin/smritiNX`, and pulled into TEST (`F:\Smriti9`).

## 17. Status
Completed

## 18. Related ADRs
- `ADR-0021`: Variant-Level Attribute Authority & Canonical Item Schema.
- `ADR-0024`: Dual-Key Transitional Strategy (Option B).
- `ADR-0025`: DataBridge Multi-Format Streaming & Third-Party Integration Framework.

## 19. Related Walkthroughs
- `docs/walkthrough/inventory/Canonical_Transaction_Supremacy_Phase3_v1.0.0.md`
- `docs/walkthrough/inventory/Global_Stock_Identity_Dual_Key_Transaction_Convergence_Phase2_v1.0.0.md`
- `docs/walkthrough/foundation/DataBridge_Phase8_Connector_Framework_v1.0.0.md`
- `docs/walkthrough/foundation/DataBridge_Phase5_Export_Strangler_v1.0.0.md`
