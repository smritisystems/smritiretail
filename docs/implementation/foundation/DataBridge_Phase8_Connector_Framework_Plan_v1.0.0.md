<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-10-06
  Modified     : 2026-10-06
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Architecture & Implementation Plan — SMRITI DataBridge Phase 8
-->

# SMRITI Transaction DataBridge Phase 8: External Third-Party Connector Framework & Bi-Directional Synchronizer Implementation Plan

## 1. Objective
Design and implement **Phase 8** of the SMRITI Transaction DataBridge. Phase 8 delivers an enterprise third-party connector framework and bi-directional synchronizer (`backend/app/services/databridge/connectors/`). The framework provides pluggable connectors for **TallyPrime XML**, **Shopify REST/GraphQL**, **SAP Business One (DI-API / Service Layer)**, and **Unicommerce (Uniware E-Commerce API)**, standardizing heterogeneous external payloads into canonical SMRITI DataBridge envelopes and dispatching outward compliance vouchers.

---

## 2. Business Motivation
1. **Automated Multi-Channel Retail Sync**: Modern retail enterprises operate across offline stores (SMRITI POS), e-commerce storefronts (Shopify), marketplaces (Amazon/Flipkart via Unicommerce), and legacy accounting systems (TallyPrime, SAP Business One). Manual export-import causes order fulfillment delays and inventory drift.
2. **Statutory XML Harmony with TallyPrime**: Indian retail accountants rely heavily on TallyPrime for final balance sheet audits and GST audits. SMRITI DataBridge must parse incoming Tally XML daybooks/vouchers as well as generate schema-valid Tally XML envelopes for outwards invoice reconciliation.
3. **Pluggable & Extensible Architecture**: The connector framework allows retailers to configure API keys, endpoint URLs, and entity mappings per tenant without hardcoded integration logic.
4. **Zero Live Database Schema Drift**: The framework operates as a pure protocol translation and orchestration layer, transforming external data structures into canonical DataBridge rows consumed directly by existing preview, commit, and async engines.

---

## 3. Scope
- **Connector Abstraction (`BaseDataBridgeConnector`)**:
  - Standardized interface for testing connectivity, pulling external payloads, normalizing them into canonical DataBridge tabular rows, and generating outward push payloads.
- **Pre-Built Enterprise Connectors**:
  - `TallyPrimeConnector`: Parses complex nested XML `<ENVELOPE>` voucher trees (Sales, Purchase, Receipts) into flat DataBridge rows; formats outward sales invoices into standard Tally XML vouchers.
  - `ShopifyConnector`: Ingests Shopify JSON responses for Products, Orders, and Customers; unrolls product variants, line items, and tax lines into canonical `ITEM`, `CUSTOMER`, and `SALES_INVOICE` rows.
  - `SAPB1Connector`: Normalizes SAP Business One OITM, OCRD, OPOR, and OINV tabular structures into SMRITI Catalog, Party, and Transaction rows.
  - `UnicommerceConnector`: Normalizes Unicommerce Uniware multi-channel orders, marketplace fees, shipping packages, and inventory sync payloads.
- **Connector Orchestrator (`DataBridgeConnectorOrchestrator`)**:
  - Central registry managing connector descriptors, credential validation, test connections, and transformation routing.
- **REST Endpoints (`backend/app/api/v1/databridge.py`)**:
  - `GET /api/v1/databridge/connectors`: List all available connectors and their schema requirements.
  - `POST /api/v1/databridge/connectors/test`: Verify credentials and network reachability.
  - `POST /api/v1/databridge/connectors/pull`: Ingest and transform external records into canonical DataBridge datasets.
  - `POST /api/v1/databridge/connectors/push`: Export canonical SMRITI records into external formats (e.g. Tally XML).
- **Models and Contracts**:
  - `DataBridgeConnectorType`, `DataBridgeConnectorConfig`, `DataBridgeConnectorDescriptor`, `DataBridgeConnectorTestRequest/Response`, `DataBridgeConnectorPullRequest/Response`, `DataBridgeConnectorPushRequest/Response`.

---

## 4. Current State
- Phases 1 through 7 are complete, verified, and pushed to GitHub (`smritiNX` commit `76cffdcf`, 87/87 tests green).
- Existing `backend/app/services/tally_service.py` provides standalone Tally sales voucher export, but is not integrated into DataBridge, lacks import capability, and does not follow the DataBridge connector abstraction.
- No general connector framework or Shopify, SAP B1, or Unicommerce adapters exist.

---

## 5. Gap Analysis
| Capability | Current State | Phase 8 Target State |
|---|---|---|
| Pluggable Connector Abstraction | None | `BaseDataBridgeConnector` with pull, push, test, transform contracts |
| Tally XML Ingestion | None (Export only in separate service) | Bidirectional Tally XML parser & generator in `TallyPrimeConnector` |
| Shopify E-Commerce Ingestion | None | Hierarchical variant/line-item unroller in `ShopifyConnector` |
| SAP B1 Normalization | None | OITM/OCRD/OINV normalization in `SAPB1Connector` |
| Unicommerce Multi-Channel | None | Multi-marketplace order normalization in `UnicommerceConnector` |
| Connector REST APIs | None | `/connectors`, `/connectors/test`, `/connectors/pull`, `/connectors/push` |

---

## 6. Architecture Impact
```text
External Systems (Shopify / Tally / SAP B1 / Unicommerce)
                 │
                 ▼
┌────────────────────────────────────────────────────────┐
│      DataBridge Connector Orchestrator                 │
│      (backend/app/services/databridge/connectors/)     │
│  ├─ TallyPrimeConnector     (XML Envelope Parser/Gen)  │
│  ├─ ShopifyConnector        (JSON Tree Normalizer)     │
│  ├─ SAPB1Connector          (DI-API / ERP Flattener)   │
│  └─ UnicommerceConnector    (Marketplace Normalizer)   │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
          Canonical SMRITI DataBridge Rows
                 │
   ┌─────────────┴─────────────┐
   ▼                           ▼
DataBridge Preview Engine   DataBridge Async Queue
 (Synchronous Preview)      (Chunked Outbox Worker)
```
- Completely decoupled: No hard external library dependencies required (uses built-in Python `xml.etree.ElementTree`, `json`, `urllib/httpx`).
- Preserves Zero DB Migration Doctrine: All ingestion flows downstream into existing DataBridge adapters.

---

## 7. Proposed Design
1. **Connector Descriptor Registry**:
   - Every connector exposes its metadata: unique ID, display name, version, supported entity types, capabilities (pull/push), and configuration field schema.
2. **Deterministic Payload Transformation**:
   - Incoming payloads from external systems may be XML strings, JSON dicts, or lists of dicts. Connectors parse and flatten them into standard SMRITI DataBridge row format:
     `{"sku": "...", "name": "...", "mrp": "...", ...}`.
3. **Statutory Integrity & Field Mapping**:
   - Tally XML extracts ledger party names, state codes, and CGST/SGST ledger amounts into SMRITI GST fields.
   - Shopify orders unpack discounts, shipping charges, customer shipping addresses, and individual line items into SMRITI sales order / invoice rows.
4. **Outbound Push Serialization**:
   - When pushing SMRITI records to external accounting platforms (e.g. TallyPrime), the connector serializes the canonical records into XML or target formats.

---

## 8. Files Created
1. `backend/app/services/databridge/connectors/__init__.py`: Package entrypoint exporting all connectors and orchestrator.
2. `backend/app/services/databridge/connectors/base.py`: `BaseDataBridgeConnector` abstract base class and result models.
3. `backend/app/services/databridge/connectors/tally_connector.py`: `TallyPrimeConnector` for bidirectional Tally XML vouchers.
4. `backend/app/services/databridge/connectors/shopify_connector.py`: `ShopifyConnector` for Shopify Products, Orders, and Customers.
5. `backend/app/services/databridge/connectors/sap_b1_connector.py`: `SAPB1Connector` for SAP Business One ERP records.
6. `backend/app/services/databridge/connectors/unicommerce_connector.py`: `UnicommerceConnector` for Uniware multi-channel orders and inventory.
7. `backend/app/services/databridge/connectors/orchestrator.py`: `DataBridgeConnectorOrchestrator` registry and runtime execution manager.
8. `backend/tests/test_databridge_phase8_connectors.py`: Comprehensive test suite verifying all connectors and API endpoints.
9. `scripts/register_databridge_phase8_architecture.py`: Architecture capability registrar for CI duplication gate.
10. `docs/walkthrough/foundation/DataBridge_Phase8_Connector_Framework_v1.0.0.md`: WGP Walkthrough document.

---

## 9. Files Modified
1. `backend/app/services/databridge/models.py`: Added connector models, enums, and request/response contracts.
2. `backend/app/services/databridge/__init__.py`: Exported connector orchestrator and models.
3. `backend/app/api/v1/databridge.py`: Mounted connector endpoints (`/connectors`, `/test`, `/pull`, `/push`).
4. `docs/implementation/README.md`: Registered Phase 8 implementation plan.
5. `docs/walkthrough/README.md`: Registered Phase 8 walkthrough.
6. `CHANGELOG.md`: Added release notes under version `[6.70.13]`.

---

## 10. Dependencies
- Python standard library (`xml.etree.ElementTree`, `json`, `re`, `datetime`, `decimal`, `typing`).
- FastAPI & Pydantic v2.
- SMRITI DataBridge Core (`models.py`, `service.py`, `exceptions.py`).

---

## 11. Risks
| Risk | Severity | Mitigation |
|---|---|---|
| Malformed XML in external Tally payloads | Medium | Strict XML syntax validation with clear statutory error messages |
| Deeply nested Shopify JSON structures | Low | Recursive flattener extracting variant and line item arrays deterministically |
| Network timeout during external API pull | Medium | Configurable timeout parameters, mock fallback mode, and non-blocking asynchronous execution |

---

## 12. Rollback Strategy
- The connector framework is completely additive.
- Disabling connector endpoints or removing the connector package has zero side-effects on core ERP or DataBridge functionality.

---

## 13. Verification Plan
1. **Automated Unit & Integration Tests**:
   - Execute dedicated test suite `backend/tests/test_databridge_phase8_connectors.py`.
   - Validate Tally XML voucher parsing, ledger allocation, and outbound XML generation.
   - Validate Shopify products, orders, and customer normalization.
   - Validate SAP B1 OITM/OINV parsing.
   - Validate Unicommerce multi-channel order mapping.
   - Validate connector orchestrator registry, test connection, and REST endpoints.
2. **Full Regression Suite**:
   - Run all 11 test suites across DataBridge Phases 1 through 8.
3. **Architecture & Lint Gates**:
   - Execute `scripts/register_databridge_phase8_architecture.py`.
   - Run `npm run architecture:check` (must pass 11/11).
   - Run `npm run lint` (`tsc --noEmit`) (must pass with exit code 0).

---

## 14. Test Plan
- `test_tc_conn_001_connector_registry_and_descriptors`: Validates listing of all 4 connectors with config schemas.
- `test_tc_conn_002_tally_xml_voucher_ingestion`: Ingests standard Tally XML sales voucher; extracts party, GSTIN, ledger items.
- `test_tc_conn_003_tally_outbound_xml_generation`: Generates Tally XML voucher from SMRITI Sales Invoice.
- `test_tc_conn_004_shopify_product_and_order_ingestion`: Unpacks Shopify product variants and order line items.
- `test_tc_conn_005_sap_b1_master_and_invoice_ingestion`: Normalizes SAP B1 OITM and OINV records.
- `test_tc_conn_006_unicommerce_multichannel_order_ingestion`: Normalizes marketplace channel orders and shipping packages.
- `test_tc_conn_007_fastapi_rest_connector_endpoints`: Tests `/connectors`, `/connectors/test`, `/connectors/pull`, `/connectors/push`.

---

## 15. Documentation Impact
- Implementation Plan: `docs/implementation/foundation/DataBridge_Phase8_Connector_Framework_Plan_v1.0.0.md`.
- Implementation Index: `docs/implementation/README.md`.
- Walkthrough: `docs/walkthrough/foundation/DataBridge_Phase8_Connector_Framework_v1.0.0.md`.
- Walkthrough Index: `docs/walkthrough/README.md`.
- CHANGELOG: `CHANGELOG.md` under `[6.70.13]`.

---

## 16. Deployment Plan
1. Implement connector contracts in `models.py`.
2. Implement base connector and individual connectors (`tally_connector.py`, `shopify_connector.py`, `sap_b1_connector.py`, `unicommerce_connector.py`).
3. Implement `orchestrator.py` and register all connectors.
4. Mount REST endpoints in `backend/app/api/v1/databridge.py`.
5. Issue architecture preflight certificates and verify gates.
6. Run test suites and verify all green.
7. Commit and push to GitHub `smritiNX`.

---

## 17. Status
**Completed**

---

## 18. Related ADRs
- `ADR-001`: FastAPI + PostgreSQL Sole Backend System of Record.
- `ADR-004`: Tenant Isolation & Multi-Tenancy Architecture.
- `ADR-009`: Statutory Compliance & Immutability Doctrine.

---

## 19. Related Walkthroughs
- `DataBridge_Core_Foundation_v1.0.0.md`
- `DataBridge_Catalog_Adapters_Phase2_v1.0.0.md`
- `DataBridge_Phase4_Async_Queue_v1.0.0.md`
- `DataBridge_Phase5_Export_Strangler_v1.0.0.md`
- `DataBridge_Phase6_Migration_Rollback_v1.0.0.md`
- `DataBridge_Phase7_Schema_Mapping_v1.0.0.md`
