<!--
  Project      : SMRITI Retail OS
  Organization : SmritiSys
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.1.0
  Generated    : 2026-07-28 18:02:54
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Auto-Generated System Architecture Inventory Report
-->

# SMRITI Retail OS — System Architecture & Database Inventory Report

> **Auto-Generated Evidence Artifact**: Produced by `scripts/generate_architecture_report.py`  
> **Timestamp**: `2026-07-28 18:02:54`  
> **Repository Path**: `f:\SMRITRretailNXmgrt`

---

## 1. Measured System Inventory & Provenance

All metrics in this report are dynamically collected from source code inspection:

| Metric Category | Measured Value | Measurement Provenance / Script Source |
| :--- | :---: | :--- |
| **Total Python Files** | **591** | Scanned by `scan_codebase_metrics()` in `backend/app/` |
| **Total Lines of Code (LOC)** | **87,311** | Scanned by `scan_codebase_metrics()` in `backend/app/` |
| **Relational DB Tables** | **217 Tables** | Parsed from `__tablename__` in `backend/app/models/*.py` |
| **API Endpoints (Routed)** | **511 Endpoints** | Parsed `@router` decorators in `backend/app/api/` |
| **Automated Test Suites** | **119 Test Files (209 Tests)** | Parsed `test_*.py` functions in `backend/app/tests/` |

---

## 2. Directory & Layer Distribution

| Directory Layer | Lines of Code | Share of Codebase |
| :--- | :---: | :---: |
| `tests/` | 23,130 | 26.5% |
| `services/` | 16,940 | 19.4% |
| `api/` | 13,854 | 15.9% |
| `core/` | 10,367 | 11.9% |
| `schemas/` | 6,722 | 7.7% |
| `models/` | 5,313 | 6.1% |
| `compliance/` | 3,174 | 3.6% |
| `procurement/` | 1,984 | 2.3% |
| `repositories/` | 1,709 | 2.0% |
| `db/` | 1,069 | 1.2% |
| `sales/` | 803 | 0.9% |
| `dev_tracker/` | 777 | 0.9% |
| `root/` | 536 | 0.6% |
| `modules/` | 397 | 0.5% |
| `ai/` | 377 | 0.4% |
| `middleware/` | 159 | 0.2% |

---

## 3. Database Schema & ORM Table Breakdown (217 Tables)

The ORM schema spans 47 model modules in `backend/app/models/`:

| ORM Model Module | Table Count | Sample Table Names |
| :--- | :---: | :--- |
| `models/purchase.py` | **37** | `suppliers, supplier_tax_profiles, supplier_compliance_profiles (+34 more)` |
| `models/inventory.py` | **16** | `products, product_barcodes, stock_movements (+13 more)` |
| `models/crm.py` | **14** | `customer_groups, pricing_groups, customers (+11 more)` |
| `models/sales.py` | **14** | `sales_invoices, sales_invoice_items, sales_payments (+11 more)` |
| `models/approval.py` | **12** | `smriti_approval_policies, smriti_approval_matrices, smriti_approval_steps (+9 more)` |
| `models/accounting.py` | **9** | `chart_of_accounts, journal_vouchers, journal_ledger_entries (+6 more)` |
| `models/consignment.py` | **8** | `consignment_partners, consignment_transfers, consignment_transfer_items (+5 more)` |
| `models/security.py` | **8** | `smriti_roles, smriti_permissions, smriti_permission_sets (+5 more)` |
| `models/api_key.py` | **4** | `smriti_service_accounts, smriti_api_keys, smriti_api_key_permission_sets (+1 more)` |
| `models/attributes.py` | **4** | `attribute_definitions, attribute_groups, variant_templates (+1 more)` |
| `models/barcode.py` | **4** | `barcode_layouts, print_histories, print_templates (+1 more)` |
| `models/pos.py` | **4** | `pos_sessions, pos_transactions, pos_transaction_items (+1 more)` |
| `models/sip.py` | **4** | `smriti_universal_identities, smriti_identity_rules, smriti_identity_rule_versions (+1 more)` |
| `models/sre.py` | **4** | `corporate_gstin_registry, sre_rule_engine, sre_statutory_ledger (+1 more)` |
| `models/terms.py` | **4** | `terms_clauses, terms_defaults, terms_snapshots (+1 more)` |
| `models/analytics_bi.py` | **3** | `dashboard_definitions, kpi_metrics, report_builder_queries` |
| `models/attachment.py` | **3** | `documents, document_versions, attachments` |
| `models/dispatch.py` | **3** | `stock_dispatches, stock_dispatch_lines, dispatch_approval_events` |
| `models/integration_hub.py` | **3** | `webhook_subscriptions, outbound_message_queue, connector_registry` |
| `models/loyalty.py` | **3** | `loyalty_customer_accounts, loyalty_gift_cards, loyalty_point_transactions` |
| `models/notification.py` | **3** | `notification_templates, notification_dispatches, in_app_notifications` |
| `models/pharma.py` | **3** | `pharma_batches, pharma_prescriptions, pharma_salt_mappings` |
| `models/platform.py` | **3** | `document_number_series, document_workflows, integration_logs` |
| `models/product_identity.py` | **3** | `barcode_providers, identity_rules, product_identities` |
| `models/size_master.py` | **3** | `size_scales, size_values, size_conversions` |
| `models/tax.py` | **3** | `gst_tax_settlements, gst_return_filings, eway_bills` |
| `models/transfer.py` | **3** | `stock_transfer_orders, stock_transfer_order_items, stock_rebalancing_recommendations` |
| `models/user_assignment.py` | **3** | `user_company_assignments, user_branch_assignments, user_store_assignments` |
| `models/wms.py` | **3** | `warehouse_zones, warehouse_bins, stock_bin_assignments` |
| `models/apparel.py` | **2** | `apparel_matrix_variants, apparel_seasonal_markdowns` |
| `models/auth.py` | **2** | `users, refresh_token_blacklist` |
| `models/ecommerce.py` | **2** | `ecommerce_channels, ecommerce_orders` |
| `models/ecosystem.py` | **2** | `ecosystem_customer_licenses, ecosystem_academy_courses` |
| `models/exchange.py` | **2** | `data_exchange_tasks, data_exchange_field_mappings` |
| `models/master_lookup.py` | **2** | `master_types, master_values` |
| `models/nic_gst.py` | **2** | `nic_einvoice_records, nic_ewaybill_records` |
| `models/numbering.py` | **2** | `document_series, numbering_audit_logs` |
| `models/psv.py` | **2** | `psv_parties, psv_sku_tracking` |
| `models/system.py` | **2** | `tally_configs, system_configs` |
| `models/tenant.py` | **2** | `companies, branches` |
| `models/analytics.py` | **1** | `analytics_financial_snapshots` |
| `models/franchise.py` | **1** | `franchise_stores` |
| `models/report_schedule.py` | **1** | `report_schedules` |
| `models/role.py` | **1** | `roles` |
| `models/screen_studio.py` | **1** | `screen_layout_templates` |
| `models/supplier_payment.py` | **1** | `supplier_payments` |
| `models/workflow.py` | **1** | `workflow_events` |

---

## 4. API Endpoint Inventory

Extracted from FastAPI router decorators in `backend/app/api/`:

| HTTP Method | Endpoint Count | Purpose |
| :--- | :---: | :--- |
| **GET** | 230 | Query, search, and list report retrievals |
| **POST** | 222 | Record creation, transactional posting, and RPC actions |
| **PUT** | 25 | Entity update and full payload replacement |
| **DELETE** | 28 | Entity soft deletion and resource cancellation |
| **PATCH** | 6 | Partial attribute updates |
| **TOTAL** | **511** | **All Configured REST Endpoints** |

---

## 5. Architectural Layer Dependency Map

```text
       ┌──────────────────────────────────────────────────────────┐
       │                   SMRITI WORKSPACE UI                    │
       └────────────────────────────┬─────────────────────────────┘
                                    │ HTTP REST / JSON
                                    ▼
       ┌──────────────────────────────────────────────────────────┐
       │     Platform API Routers (`backend/app/api/`)            │
       └────────────────────────────┬─────────────────────────────┘
                                    │ Domain DTOs (Pydantic)
                                    ▼
       ┌──────────────────────────────────────────────────────────┐
       │    Domain Services & Core (`backend/app/services/ & core/`)│
       └────────────────────────────┬─────────────────────────────┘
                                    │ Repository Interfaces (ADR-006)
                                    ▼
       ┌──────────────────────────────────────────────────────────┐
       │      Repositories Layer (`backend/app/repositories/`)    │
       └────────────────────────────┬─────────────────────────────┘
                                    │ SQLAlchemy ORM Session
                                    ▼
       ┌──────────────────────────────────────────────────────────┐
       │           PostgreSQL Database (`smriti-db`)              │
       └──────────────────────────────────────────────────────────┘
```

---

## 6. Entity-to-Layer Coverage Matrix (13-Layer Gate Audit)

| Primary Domain Entity | ORM Model | Repository Layer | Domain Service | API Endpoint | Test Suite |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Product** | `backend/app/models/inventory.py` | `backend/app/repositories/inventory.py` | `backend/app/services/product.py` | `backend/app/api/v1/products.py` | `backend/app/tests/` |
| **Supplier** | `backend/app/models/purchase.py` | `backend/app/repositories/purchase.py` | `backend/app/services/supplier.py` | `backend/app/api/v1/suppliers.py` | `backend/app/tests/` |
| **Customer** | `backend/app/models/crm.py` | `backend/app/repositories/crm.py` | `backend/app/services/customer.py` | `backend/app/api/v1/customers.py` | `backend/app/tests/` |
| **Sales Invoice** | `backend/app/models/sales.py` | `backend/app/repositories/sales.py` | `backend/app/services/sales.py` | `backend/app/api/v1/sales.py` | `backend/app/tests/` |
| **Purchase Order** | `backend/app/models/purchase.py` | `backend/app/repositories/purchase.py` | `backend/app/services/purchase.py` | `backend/app/api/v1/purchase.py` | `backend/app/tests/` |
| **Journal Entry** | `backend/app/models/accounting.py` | `backend/app/repositories/accounting.py` | `backend/app/services/accounting.py` | `backend/app/api/v1/accounting.py` | `backend/app/tests/` |

---

## 7. Technical Debt & Known Refactoring Items

| Module / Component | Item / Description | Status / Decision | Remediation Plan |
| :--- | :--- | :---: | :--- |
| **Event Bus** | Deprecated `domain_events.py` in favor of `SmritiEventBus` | **DEPRECATED** | Canonical event bus registered under ADR-013 |
| **Database Cache** | Redis caching layer integration for stock balance queries | **PENDING** | Currently using in-process cache; Redis planned |
| **Public Gateway** | API key rate limiting per IP | **SUPPORTED** | Configured in `backend/app/api/public/v1/gateway.py` |

---

## 8. Release Readiness Matrix (CVE v6.0 Gate)

| Release Dimension | Evaluation Gate | Status | Evidence |
| :--- | :--- | :---: | :--- |
| **Architecture** | Level 1 Constitution & 11 ADR Suite Alignment | **PASS** | Verified via `cve_blueprint_v6.md` |
| **Unit & Core Tests** | Pytest Execution in `F:\SMRITI9TEST` | **PASS** | 23/23 Test modules 100% Passed |

| **DB Migrations** | Alembic Revision Chain (v1212 to v1216) | **PASS** | Linear migration chain verified |
| **Governance** | `validate_governance.py` Gate Execution | **PASS** | UADHP, ADR & Changelog checks PASSED |
