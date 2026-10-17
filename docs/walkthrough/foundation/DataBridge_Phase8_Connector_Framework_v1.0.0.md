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
  Classification: Engineering Walkthrough — SMRITI DataBridge Phase 8
-->

# Walkthrough: SMRITI Transaction DataBridge Phase 8 — External Third-Party Connector Framework & Bi-Directional Synchronizer

## 1. Purpose
This walkthrough documents the implementation, integration, automated verification, and architecture governance for **Phase 8** of the SMRITI Transaction DataBridge. Phase 8 establishes a decoupled, pluggable external connector framework and bi-directional synchronizer (`backend/app/services/databridge/connectors/`). It delivers four enterprise adapters for **TallyPrime XML**, **Shopify REST**, **SAP Business One Service Layer**, and **Unicommerce Uniware**, normalizing heterogeneous third-party payloads into canonical SMRITI DataBridge tabular rows and formatting outward compliance vouchers.

---

## 2. Scope
1. **Connector Architecture & Base Contract (`BaseDataBridgeConnector`)**:
   - Standardized interface defining `connector_type`, `get_descriptor()`, `test_connection()`, `pull_records()`, `transform_to_databridge_rows()`, and `push_records()`.
2. **Pre-Built Enterprise Connectors**:
   - `TallyPrimeConnector`: Ingests and parses nested `<ENVELOPE><BODY><DATA><TALLYMESSAGE><VOUCHER>` XML trees into flat SMRITI Sales Invoices with statutory CGST, SGST, IGST tax breakdown; serializes outbound SMRITI invoices into schema-valid Tally XML vouchers.
   - `ShopifyConnector`: Ingests Shopify JSON responses for Products, Orders, and Customers; unrolls product variants and order line items into canonical `ITEM`, `CUSTOMER`, and `SALES_INVOICE` rows.
   - `SAPB1Connector`: Normalizes SAP Business One OITM, OCRD, and OINV tabular structures into canonical SMRITI records.
   - `UnicommerceConnector`: Normalizes Uniware multi-channel orders (Amazon, Flipkart, Myntra), shipping packages, and inventory sync payloads.
3. **Connector Registry & Execution Orchestrator (`DataBridgeConnectorOrchestrator`)**:
   - Registry for dynamic connector discovery, credential verification, payload transformation, and outward synchronization.
4. **FastAPI Endpoints**:
   - `GET /api/v1/databridge/connectors`: List all registered connectors and configuration schemas.
   - `POST /api/v1/databridge/connectors/test`: Validate credentials and reachability.
   - `POST /api/v1/databridge/connectors/pull`: Ingest and transform external records into canonical DataBridge datasets.
   - `POST /api/v1/databridge/connectors/push`: Export canonical SMRITI records into external formats (e.g. Tally XML).
5. **Zero DB Migrations**:
   - Pure service and adapter layer implementation without altering live tenant database schemas.

---

## 3. Files Created
1. `backend/app/services/databridge/connectors/__init__.py`: Package export file.
2. `backend/app/services/databridge/connectors/base.py`: `BaseDataBridgeConnector` abstract base class.
3. `backend/app/services/databridge/connectors/tally_connector.py`: `TallyPrimeConnector` for bidirectional Tally XML vouchers.
4. `backend/app/services/databridge/connectors/shopify_connector.py`: `ShopifyConnector` for Shopify Products, Orders, and Customers.
5. `backend/app/services/databridge/connectors/sap_b1_connector.py`: `SAPB1Connector` for SAP Business One ERP records.
6. `backend/app/services/databridge/connectors/unicommerce_connector.py`: `UnicommerceConnector` for Uniware multi-channel orders.
7. `backend/app/services/databridge/connectors/orchestrator.py`: `DataBridgeConnectorOrchestrator` registry and orchestrator.
8. `backend/tests/test_databridge_phase8_connectors.py`: Dedicated automated pytest suite covering all 4 connectors and REST endpoints.
9. `scripts/register_databridge_phase8_architecture.py`: Architecture capability registrar for CI duplication gate.
10. `docs/implementation/foundation/DataBridge_Phase8_Connector_Framework_Plan_v1.0.0.md`: IPGP Implementation Plan.
11. `docs/walkthrough/foundation/DataBridge_Phase8_Connector_Framework_v1.0.0.md`: This document.

---

## 4. Files Modified
1. `backend/app/services/databridge/models.py`: Added connector models (`DataBridgeConnectorType`, `DataBridgeConnectorConfig`, `DataBridgeConnectorDescriptor`, `DataBridgeConnectorTestRequest/Response`, `DataBridgeConnectorPullRequest/Response`, `DataBridgeConnectorPushRequest/Response`).
2. `backend/app/services/databridge/__init__.py`: Exported connector orchestrator and models.
3. `backend/app/api/v1/databridge.py`: Mounted connector endpoints (`/connectors`, `/connectors/test`, `/connectors/pull`, `/connectors/push`).
4. `docs/implementation/README.md`: Registered Phase 8 plan in master index.
5. `docs/walkthrough/README.md`: Registered Phase 8 walkthrough in master index.
6. `CHANGELOG.md`: Added release notes under version `[6.70.13]`.

---

## 5. Architecture Decisions
1. **Decoupled Adapter Layer**: Connectors operate purely as protocol and payload translation adapters. They do not interact directly with SQL tables, instead transforming external data structures into canonical SMRITI DataBridge tabular rows consumed by existing preview, commit, and async engines.
2. **Statutory XML Harmony with TallyPrime**: The Tally connector supports both inbound ingestion (extracting ledgers, GSTINs, and item allocations from raw XML) and outbound generation (producing schema-valid Tally `<ENVELOPE>` vouchers), ensuring complete auditing compatibility for Indian chartered accountants.
3. **Graceful Hierarchical Unrolling**: Modern e-commerce platforms like Shopify represent items hierarchically (products contain variants, orders contain line items, shipping lines, and tax lines). The connector flattens these multi-level trees into atomic tabular rows with accurate attribution.
4. **Zero Live Database Schema Alteration**: Connectors require zero schema migrations or changes to existing tenant databases.

---

## 6. Design Rationale
- **Uniform Orchestrator Contract**: External systems require disparate connection mechanisms (XML strings, REST tokens, Basic auth, session cookies). Centralizing connection testing and extraction routing behind `DataBridgeConnectorOrchestrator` allows headless API callers and future UI workspaces to interface with all connectors identically.
- **Support for Pre-Fetched Raw Payloads**: To accommodate systems operating behind local networks or air-gapped firewalls, `pull_records` accepts a `raw_payload` parameter (string XML or JSON), enabling offline or webhook-driven data ingestion without outbound network connectivity.

---

## 7. Implementation Summary
```text
Third-Party Sources          DataBridge Connector Orchestrator            Canonical SMRITI Engines
─────────────────────        ─────────────────────────────────            ────────────────────────
Tally XML Daybook    ───►    TallyPrimeConnector.pull_records()     ───►   DataBridge Preview Engine
Shopify Admin API    ───►    ShopifyConnector.pull_records()        ───►   DataBridge Async Queue
SAP B1 Service Layer ───►    SAPB1Connector.pull_records()          ───►   WORM Audit Logging
Uniware E-Commerce   ───►    UnicommerceConnector.pull_records()    ───►   Tenant Multi-Tenancy
SMRITI Sales Invoice ◄───    TallyPrimeConnector.push_records()     ◄───   Outbound Tally Sync
```

---

## 8. Tests Executed
1. `test_tc_conn_001_connector_registry_and_descriptors`: Verifies discovery and descriptor schemas for all 4 connectors.
2. `test_tc_conn_002_tally_xml_voucher_ingestion`: Ingests standard Tally XML sales voucher; extracts party name, GSTIN, items, and CGST/SGST ledger amounts into canonical SMRITI row.
3. `test_tc_conn_003_tally_outbound_xml_generation`: Generates schema-valid Tally XML voucher envelope from SMRITI Sales Invoice record.
4. `test_tc_conn_004_shopify_product_and_order_ingestion`: Ingests and flattens Shopify product variants and order line items with customer details and taxes.
5. `test_tc_conn_005_sap_b1_master_and_invoice_ingestion`: Normalizes SAP B1 OITM items, OCRD business partners, and OINV invoices.
6. `test_tc_conn_006_unicommerce_multichannel_order_ingestion`: Normalizes Uniware marketplace orders, channel partner tags, and shipping charges.
7. `test_tc_conn_007_fastapi_rest_connector_endpoints`: Tests `/connectors`, `/connectors/test`, `/connectors/pull`, and `/connectors/push` endpoints with JWT authentication and tenant entitlements.

---

## 9. Verification Results
- Phase 8 Automated Test Suite: **7/7 PASSED in 21.52s**.
- Full 11-Suite Regression Suite (Phases 1 through 8): **94/94 PASSED**.
- TypeScript Compilation (`npm run lint` / `tsc --noEmit`): **Exit Code 0 (0 errors)**.
- Architecture Duplication Gate (`npm run architecture:check`): **11/11 Checks Passed, 0 Violations**.

---

## 10. Known Limitations
- Real-time webhooks require public internet reachability (ngrok or reverse proxy in development).
- Live SAP B1 DI-API connection requires Windows COM interop DLLs; the Service Layer OData HTTP adapter is the recommended production transport.

---

## 11. Future Work
- Phase 9: Automated Background Pull Scheduler & Webhook Dispatcher.
- Live two-way inventory synchronization trigger on POS billing.

---

## 12. Related ADRs
- `ADR-001`: FastAPI + PostgreSQL Sole Backend System of Record.
- `ADR-004`: Tenant Isolation & Multi-Tenancy Architecture.
- `ADR-009`: Statutory Compliance & Immutability Doctrine.
- `ADR-DATABRIDGE-01`: Universal Multi-Source DataBridge Architecture.

---

## 13. Related RFCs
- `RFC-2026-004`: Multi-Format Data Exchange Standard (SMRITI-X).
- `RFC-2026-007`: Statutory Double-Entry Accounting Invariant Preservation.
