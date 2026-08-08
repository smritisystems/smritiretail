# SMRITI DATABASE AUTHORITY MAP V1 (RECONCILED & ACCEPTED)
## Canonical Architectural Data Authority & Physical Schema Registry

> **Status:** READ-ONLY RECONCILED ARCHITECTURAL AUDIT | ACCEPTED BASELINE
> **Authoritative Database:** `smriti-db-prod` | `smriti_retail_db` | Schema `public`
> **Live Physical Table Count:** EXACTLY 269 PHYSICAL TABLES

### Governance Principles:
```text
CURRENT STATE:
All 269 physical tables are immutable during the audit/certification freeze.

FUTURE STATE:
No table may be deprecated, altered, merged, renamed, or dropped until an approved
Product Mode refactoring change is opened and the table passes dependency, reader,
writer, FK, migration, and runtime verification.
```

---

## Executive Reconciliation Summary

| Metric | Verified Value | Governance Status |
|---|---|---|
| Total Verified Physical Tables | **269** | 🟢 **PASS / ACCEPTED** |
| Views | **1** (`v_active_products`) | 🟢 Verified |
| Materialized Views | **0** | 🟢 Verified |
| Sequences | **8** | 🟢 Verified |
| Total Indexes | **995** | 🟢 Verified |
| Database Consolidation / Refactoring | **FROZEN** | 🔴 **NO DB ALTERATION PERMITTED** |

---

## Physical Table Inventory (All 269 Live Tables)

| # | Physical Table Name | Domain | Table Type | Primary Key | Row Count | Cols | FKs | Model Class (File) | Authority Status |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `alembic_version` | General Platform | `SYSTEM` | `version_num` | **1** | 1 | 0 | *No Model* | CANONICAL LIVE |
| 2 | `apparel_matrix_variants` | Catalog & Item Master | `REFERENCE` | `id` | **0** | 9 | 0 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 3 | `approval_workflow_logs` | Workflow & Approval Engine | `AUDIT` | `id` | **0** | 25 | 2 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 4 | `attribute_definitions` | Catalog & Item Master | `CONFIGURATION` | `id` | **5** | 33 | 2 | `UnknownModel` | CANONICAL LIVE |
| 5 | `attribute_groups` | Catalog & Item Master | `REFERENCE` | `id` | **1** | 20 | 2 | `UnknownModel` | CANONICAL LIVE |
| 6 | `audit_logs` | Audit, Compliance & SRE | `AUDIT` | `id` | **0** | 12 | 0 | *No Model* | LIVE BASELINE (0 rows) |
| 7 | `bank_accounts` | Financial Accounting & Tax | `TRANSACTION` | `id` | **0** | 23 | 0 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 8 | `barcode_layouts` | Catalog & Item Master | `CONFIGURATION` | `id` | **0** | 22 | 2 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 9 | `barcode_providers` | Catalog & Item Master | `REFERENCE` | `id` | **0** | 22 | 2 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 10 | `blanket_purchase_agreement_lines` | Procurement & Purchasing | `REFERENCE` | `id` | **0** | 22 | 2 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 11 | `blanket_purchase_agreements` | Procurement & Purchasing | `REFERENCE` | `id` | **0** | 26 | 1 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 12 | `branches` | IAM & Security Governance | `MASTER` | `id` | **4** | 15 | 1 | `Branch` | CANONICAL LIVE |
| 13 | `cash_registers` | Sales & Retail POS | `REFERENCE` | `id` | **0** | 22 | 2 | *No Model* | LIVE BASELINE (0 rows) |
| 14 | `category_attribute_group_mappings` | Catalog & Item Master | `CONFIGURATION` | `id` | **1** | 19 | 2 | `UnknownModel` | CANONICAL LIVE |
| 15 | `chart_of_accounts` | Financial Accounting & Tax | `TRANSACTION` | `id` | **0** | 25 | 3 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 16 | `companies` | General Platform | `REFERENCE` | `id` | **4** | 27 | 1 | `Company` | CANONICAL LIVE |
| 17 | `company_financial_years` | IAM & Security Governance | `MASTER` | `id` | **0** | 13 | 1 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 18 | `company_tax_profiles` | IAM & Security Governance | `CONFIGURATION` | `id` | **0** | 22 | 1 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 19 | `compliance_audit_logs` | Audit, Compliance & SRE | `AUDIT` | `id` | **0** | 23 | 2 | *No Model* | LIVE BASELINE (0 rows) |
| 20 | `compliance_credentials` | Audit, Compliance & SRE | `REFERENCE` | `id` | **0** | 20 | 3 | *No Model* | LIVE BASELINE (0 rows) |
| 21 | `compliance_outboxes` | Audit, Compliance & SRE | `INTEGRATION` | `id` | **0** | 24 | 2 | *No Model* | LIVE BASELINE (0 rows) |
| 22 | `connector_registry` | General Platform | `REFERENCE` | `id` | **0** | 8 | 0 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 23 | `consignment_partners` | Supply Chain & Channel Distribution (SCDM) | `REFERENCE` | `id` | **0** | 22 | 2 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 24 | `consignment_return_items` | Catalog & Item Master | `MASTER` | `id` | **0** | 22 | 5 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 25 | `consignment_returns` | Sales & Retail POS | `REFERENCE` | `id` | **0** | 22 | 3 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 26 | `consignment_sale_report_items` | Catalog & Item Master | `MASTER` | `id` | **0** | 24 | 5 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 27 | `consignment_sale_reports` | Sales & Retail POS | `REFERENCE` | `id` | **0** | 23 | 3 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 28 | `consignment_settlements` | Financial Accounting & Tax | `REFERENCE` | `id` | **0** | 26 | 3 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 29 | `consignment_transfer_items` | Catalog & Item Master | `TRANSACTION` | `id` | **0** | 29 | 4 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 30 | `consignment_transfers` | Supply Chain & Channel Distribution (SCDM) | `TRANSACTION` | `id` | **0** | 24 | 4 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 31 | `corporate_gstin_registry` | Financial Accounting & Tax | `REFERENCE` | `id` | **0** | 19 | 2 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 32 | `cost_centers` | General Platform | `REFERENCE` | `id` | **0** | 15 | 0 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 33 | `cost_layer_ledger_entries` | Financial Accounting & Tax | `LEDGER` | `id` | **0** | 26 | 4 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 34 | `credit_notes` | Sales & Retail POS | `REFERENCE` | `id` | **0** | 29 | 5 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 35 | `crm_campaigns` | Customer Relationship Management (CRM) | `REFERENCE` | `id` | **0** | 19 | 0 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 36 | `crm_customer_activities` | Customer Relationship Management (CRM) | `MASTER` | `id` | **0** | 17 | 2 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 37 | `crm_leads` | Customer Relationship Management (CRM) | `REFERENCE` | `id` | **0** | 21 | 0 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 38 | `crm_opportunities` | Customer Relationship Management (CRM) | `REFERENCE` | `id` | **0** | 20 | 2 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 39 | `crm_support_tickets` | Customer Relationship Management (CRM) | `REFERENCE` | `id` | **0** | 18 | 1 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 40 | `crm_ticket_comments` | Customer Relationship Management (CRM) | `REFERENCE` | `id` | **0** | 12 | 1 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 41 | `customer_addresses` | Customer Relationship Management (CRM) | `MASTER` | `id` | **0** | 29 | 1 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 42 | `customer_channel_preferences` | Customer Relationship Management (CRM) | `CONFIGURATION` | `id` | **0** | 20 | 1 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 43 | `customer_contacts` | Customer Relationship Management (CRM) | `MASTER` | `id` | **0** | 23 | 1 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 44 | `customer_credit_profiles` | Customer Relationship Management (CRM) | `CONFIGURATION` | `id` | **0** | 24 | 1 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 45 | `customer_groups` | Customer Relationship Management (CRM) | `MASTER` | `id` | **0** | 40 | 2 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 46 | `customer_tax_profiles` | Financial Accounting & Tax | `CONFIGURATION` | `id` | **0** | 27 | 1 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 47 | `customers` | Customer Relationship Management (CRM) | `MASTER` | `id` | **0** | 55 | 4 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 48 | `dashboard_definitions` | General Platform | `CONFIGURATION` | `id` | **0** | 8 | 0 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 49 | `data_exchange_field_mappings` | Supply Chain & Channel Distribution (SCDM) | `CONFIGURATION` | `id` | **0** | 19 | 2 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 50 | `data_exchange_tasks` | Supply Chain & Channel Distribution (SCDM) | `REFERENCE` | `id` | **0** | 24 | 2 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 51 | `database_profiles` | General Platform | `CONFIGURATION` | `id` | **1** | 9 | 0 | *No Model* | CANONICAL LIVE |
| 52 | `dispatch_approval_events` | Workflow & Approval Engine | `INTEGRATION` | `id` | **0** | 22 | 4 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 53 | `document_number_series` | General Platform | `REFERENCE` | `id` | **0** | 24 | 2 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 54 | `document_posting_profiles` | Sales & Retail POS | `CONFIGURATION` | `id` | **0** | 23 | 2 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 55 | `document_series` | General Platform | `REFERENCE` | `id` | **0** | 29 | 2 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 56 | `document_workflows` | Workflow & Approval Engine | `REFERENCE` | `id` | **0** | 21 | 2 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 57 | `eway_bills` | Financial Accounting & Tax | `REFERENCE` | `id` | **0** | 27 | 3 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 58 | `financial_year` | Financial Accounting & Tax | `REFERENCE` | `id` | **0** | 26 | 2 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 59 | `fiscal_periods` | General Platform | `REFERENCE` | `id` | **0** | 21 | 2 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 60 | `fulfillment_waves` | General Platform | `REFERENCE` | `id` | **0** | 20 | 0 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 61 | `government_services` | General Platform | `REFERENCE` | `id` | **0** | 24 | 2 | *No Model* | LIVE BASELINE (0 rows) |
| 62 | `gst_reconciliation_records` | Financial Accounting & Tax | `REFERENCE` | `id` | **0** | 29 | 2 | *No Model* | LIVE BASELINE (0 rows) |
| 63 | `gst_return_filings` | Sales & Retail POS | `REFERENCE` | `id` | **0** | 28 | 2 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 64 | `gst_return_locks` | Sales & Retail POS | `REFERENCE` | `id` | **0** | 17 | 0 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 65 | `gst_tax_settlements` | Financial Accounting & Tax | `REFERENCE` | `id` | **0** | 33 | 2 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 66 | `gstr_filing_records` | Financial Accounting & Tax | `REFERENCE` | `id` | **0** | 30 | 2 | *No Model* | LIVE BASELINE (0 rows) |
| 67 | `gstr_outbox_logs` | Financial Accounting & Tax | `AUDIT` | `id` | **0** | 24 | 2 | *No Model* | LIVE BASELINE (0 rows) |
| 68 | `identity_rules` | IAM & Security Governance | `CONFIGURATION` | `id` | **0** | 22 | 2 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 69 | `in_app_notifications` | General Platform | `REFERENCE` | `id` | **0** | 8 | 0 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 70 | `integration_logs` | Audit, Compliance & SRE | `AUDIT` | `id` | **0** | 32 | 2 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 71 | `inventory_checkpoint_records` | Inventory & Stock Management | `SNAPSHOT` | `id` | **0** | 26 | 5 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 72 | `inventory_identity_records` | Inventory & Stock Management | `REFERENCE` | `id` | **0** | 30 | 3 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 73 | `inventory_ledger_entries` | Inventory & Stock Management | `LEDGER` | `id` | **7** | 34 | 5 | `UnknownModel` | CANONICAL LIVE |
| 74 | `inventory_location_nodes` | Inventory & Stock Management | `REFERENCE` | `id` | **3** | 28 | 3 | `UnknownModel` | CANONICAL LIVE |
| 75 | `inventory_lock_records` | Inventory & Stock Management | `REFERENCE` | `id` | **0** | 30 | 4 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 76 | `inventory_snapshot_records` | Inventory & Stock Management | `SNAPSHOT` | `id` | **0** | 27 | 4 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 77 | `journal_ledger_entries` | Financial Accounting & Tax | `LEDGER` | `id` | **0** | 24 | 3 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 78 | `journal_vouchers` | Financial Accounting & Tax | `LEDGER` | `id` | **0** | 27 | 2 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 79 | `kpi_metrics` | General Platform | `REFERENCE` | `id` | **0** | 9 | 0 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 80 | `landed_cost_vouchers` | Procurement & Purchasing | `TRANSACTION` | `id` | **0** | 22 | 1 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 81 | `legacy_pos_shifts` | Sales & Retail POS | `TRANSACTION` | `id` | **0** | 12 | 1 | *No Model* | LIVE BASELINE (0 rows) |
| 82 | `loyalty_customer_accounts` | Financial Accounting & Tax | `TRANSACTION` | `id` | **0** | 7 | 0 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 83 | `loyalty_gift_cards` | Customer Relationship Management (CRM) | `REFERENCE` | `id` | **0** | 5 | 0 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 84 | `loyalty_point_transactions` | Customer Relationship Management (CRM) | `TRANSACTION` | `id` | **0** | 16 | 0 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 85 | `master_types` | Catalog & Item Master | `MASTER` | `id` | **18** | 13 | 1 | `MasterType` | CANONICAL LIVE |
| 86 | `master_values` | Catalog & Item Master | `MASTER` | `id` | **80** | 19 | 3 | `MasterValue` | CANONICAL LIVE |
| 87 | `module_audit_logs` | Audit, Compliance & SRE | `AUDIT` | `id` | **0** | 8 | 0 | *No Model* | LIVE BASELINE (0 rows) |
| 88 | `module_states` | General Platform | `REFERENCE` | `id` | **0** | 7 | 0 | *No Model* | LIVE BASELINE (0 rows) |
| 89 | `notification_dispatches` | Supply Chain & Channel Distribution (SCDM) | `REFERENCE` | `id` | **0** | 12 | 0 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 90 | `notification_templates` | Platform Configuration & System | `CONFIGURATION` | `id` | **0** | 10 | 0 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 91 | `numbering_audit_logs` | Audit, Compliance & SRE | `AUDIT` | `id` | **0** | 24 | 3 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 92 | `organizations` | IAM & Security Governance | `REFERENCE` | `id` | **3** | 7 | 0 | `UnknownModel` | CANONICAL LIVE |
| 93 | `outbound_message_queue` | General Platform | `INTEGRATION` | `id` | **0** | 11 | 0 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 94 | `pharma_batches` | Inventory & Stock Management | `REFERENCE` | `id` | **0** | 11 | 0 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 95 | `pick_list_items` | Catalog & Item Master | `MASTER` | `id` | **0** | 22 | 3 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 96 | `pick_lists` | General Platform | `REFERENCE` | `id` | **0** | 19 | 1 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 97 | `platform_idempotency_records` | General Platform | `REFERENCE` | `id` | **0** | 24 | 2 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 98 | `pos_offline_sync_queue` | Sales & Retail POS | `INTEGRATION` | `id` | **0** | 24 | 2 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 99 | `pos_profiles` | Sales & Retail POS | `CONFIGURATION` | `id` | **0** | 9 | 0 | *No Model* | LIVE BASELINE (0 rows) |
| 100 | `pos_sessions` | IAM & Security Governance | `TRANSACTION` | `id` | **0** | 31 | 2 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 101 | `pos_transaction_items` | Catalog & Item Master | `TRANSACTION` | `id` | **0** | 24 | 4 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 102 | `pos_transactions` | Sales & Retail POS | `TRANSACTION` | `id` | **0** | 30 | 3 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 103 | `pricing_groups` | Catalog & Item Master | `REFERENCE` | `id` | **5** | 27 | 0 | `UnknownModel` | CANONICAL LIVE |
| 104 | `print_histories` | Platform Configuration & System | `REFERENCE` | `id` | **0** | 23 | 2 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 105 | `print_profiles` | Platform Configuration & System | `CONFIGURATION` | `id` | **0** | 24 | 3 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 106 | `print_templates` | Platform Configuration & System | `CONFIGURATION` | `id` | **0** | 23 | 2 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 107 | `procurement_rfq_items` | Catalog & Item Master | `MASTER` | `id` | **0** | 21 | 2 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 108 | `procurement_rfq_vendors` | Procurement & Purchasing | `REFERENCE` | `id` | **0** | 20 | 2 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 109 | `procurement_rfqs` | Procurement & Purchasing | `REFERENCE` | `id` | **0** | 22 | 0 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 110 | `procurement_tolerance_policies` | General Platform | `REFERENCE` | `id` | **0** | 21 | 0 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 111 | `product_barcodes` | Catalog & Item Master | `MASTER` | `id` | **0** | 19 | 3 | `ProductBarcode` | LIVE BASELINE (0 rows) |
| 112 | `product_identities` | Catalog & Item Master | `MASTER` | `id` | **0** | 25 | 5 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 113 | `product_inventory_policies` | Catalog & Item Master | `MASTER` | `id` | **0** | 22 | 1 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 114 | `product_tax_profiles` | Catalog & Item Master | `CONFIGURATION` | `id` | **0** | 24 | 1 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 115 | `product_vendors` | Catalog & Item Master | `MASTER` | `id` | **0** | 34 | 2 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 116 | `products` | Catalog & Item Master | `MASTER` | `id` | **5** | 44 | 4 | `Product` | CANONICAL LIVE |
| 117 | `psv_parties` | General Platform | `REFERENCE` | `id` | **0** | 11 | 0 | `PSVParty` | LIVE BASELINE (0 rows) |
| 118 | `psv_sku_tracking` | General Platform | `REFERENCE` | `id` | **0** | 10 | 2 | `PSVPartySkuTracking` | LIVE BASELINE (0 rows) |
| 119 | `purchase_jurisdiction_configs` | Procurement & Purchasing | `CONFIGURATION` | `id` | **0** | 17 | 2 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 120 | `purchase_order_items` | Catalog & Item Master | `TRANSACTION` | `id` | **0** | 34 | 4 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 121 | `purchase_orders` | Procurement & Purchasing | `TRANSACTION` | `id` | **0** | 25 | 4 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 122 | `purchase_receipt_items` | Catalog & Item Master | `TRANSACTION` | `id` | **0** | 29 | 4 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 123 | `purchase_receipts` | Procurement & Purchasing | `TRANSACTION` | `id` | **0** | 25 | 4 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 124 | `purchase_reorder_configs` | Inventory & Stock Management | `TRANSACTION` | `id` | **0** | 20 | 4 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 125 | `purchase_requisition_lines` | Procurement & Purchasing | `REFERENCE` | `id` | **0** | 23 | 3 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 126 | `purchase_requisitions` | Procurement & Purchasing | `REFERENCE` | `id` | **0** | 28 | 0 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 127 | `quality_inspection_items` | Catalog & Item Master | `MASTER` | `id` | **0** | 25 | 2 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 128 | `quality_inspections` | General Platform | `REFERENCE` | `id` | **0** | 28 | 2 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 129 | `quotation_evaluations` | General Platform | `REFERENCE` | `id` | **0** | 27 | 3 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 130 | `refresh_token_blacklist` | IAM & Security Governance | `REFERENCE` | `id` | **0** | 5 | 1 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 131 | `replenishment_items` | Catalog & Item Master | `MASTER` | `id` | **0** | 26 | 4 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 132 | `replenishment_plans` | Inventory & Stock Management | `REFERENCE` | `id` | **0** | 23 | 2 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 133 | `report_builder_queries` | General Platform | `REFERENCE` | `id` | **0** | 10 | 0 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 134 | `report_schedules` | General Platform | `REFERENCE` | `id` | **0** | 25 | 3 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 135 | `requisition_approval_policies` | Workflow & Approval Engine | `REFERENCE` | `id` | **0** | 22 | 0 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 136 | `requisition_approvals` | Workflow & Approval Engine | `REFERENCE` | `id` | **0** | 24 | 1 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 137 | `reservation_ledger_entries` | Inventory & Stock Management | `LEDGER` | `id` | **0** | 29 | 4 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 138 | `roles` | IAM & Security Governance | `MASTER` | `id` | **0** | 20 | 2 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 139 | `sales_invoice_items` | Catalog & Item Master | `TRANSACTION` | `id` | **56** | 31 | 4 | `UnknownModel` | CANONICAL LIVE |
| 140 | `sales_invoice_payments` | Sales & Retail POS | `TRANSACTION` | `id` | **0** | 20 | 3 | *No Model* | LIVE BASELINE (0 rows) |
| 141 | `sales_invoices` | Sales & Retail POS | `TRANSACTION` | `id` | **7** | 42 | 5 | `UnknownModel` | CANONICAL LIVE |
| 142 | `sales_order_items` | Catalog & Item Master | `TRANSACTION` | `id` | **0** | 21 | 4 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 143 | `sales_orders` | Sales & Retail POS | `TRANSACTION` | `id` | **0** | 31 | 3 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 144 | `sales_payments` | Sales & Retail POS | `TRANSACTION` | `id` | **0** | 24 | 4 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 145 | `sales_quotation_items` | Catalog & Item Master | `MASTER` | `id` | **0** | 17 | 4 | `SalesQuotationItem` | LIVE BASELINE (0 rows) |
| 146 | `sales_quotations` | Sales & Retail POS | `REFERENCE` | `id` | **0** | 26 | 2 | `SalesQuotation` | LIVE BASELINE (0 rows) |
| 147 | `sales_return_items` | Catalog & Item Master | `MASTER` | `id` | **0** | 31 | 4 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 148 | `sales_returns` | Sales & Retail POS | `REFERENCE` | `id` | **0** | 33 | 5 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 149 | `scdm_channel_dispatch_lines` | Supply Chain & Channel Distribution (SCDM) | `REFERENCE` | `id` | **0** | 25 | 4 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 150 | `scdm_channel_dispatches` | Supply Chain & Channel Distribution (SCDM) | `REFERENCE` | `id` | **0** | 33 | 3 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 151 | `scdm_channel_locations` | Supply Chain & Channel Distribution (SCDM) | `REFERENCE` | `id` | **0** | 27 | 4 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 152 | `scdm_channel_stock_movements` | Inventory & Stock Management | `LEDGER` | `id` | **0** | 34 | 5 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 153 | `scdm_claim_types` | Supply Chain & Channel Distribution (SCDM) | `REFERENCE` | `id` | **0** | 12 | 0 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 154 | `scdm_claims` | Supply Chain & Channel Distribution (SCDM) | `REFERENCE` | `id` | **0** | 22 | 3 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 155 | `scdm_sellout_import_lines` | Supply Chain & Channel Distribution (SCDM) | `REFERENCE` | `id` | **0** | 18 | 2 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 156 | `scdm_sellout_imports` | Supply Chain & Channel Distribution (SCDM) | `REFERENCE` | `id` | **0** | 34 | 2 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 157 | `scdm_settlement_lines` | Financial Accounting & Tax | `REFERENCE` | `id` | **0** | 8 | 3 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 158 | `scdm_settlements` | Financial Accounting & Tax | `REFERENCE` | `id` | **0** | 18 | 1 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 159 | `screen_layout_templates` | Platform Configuration & System | `CONFIGURATION` | `id` | **0** | 24 | 2 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 160 | `shifts` | General Platform | `TRANSACTION` | `id` | **0** | 31 | 4 | *No Model* | LIVE BASELINE (0 rows) |
| 161 | `shipment_packages` | General Platform | `REFERENCE` | `id` | **0** | 25 | 1 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 162 | `size_conversions` | Catalog & Item Master | `REFERENCE` | `id` | **0** | 19 | 1 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 163 | `size_scales` | Catalog & Item Master | `REFERENCE` | `id` | **0** | 23 | 0 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 164 | `size_values` | Catalog & Item Master | `REFERENCE` | `id` | **0** | 19 | 1 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 165 | `smriti_addresses` | General Platform | `LIVE_GOVERNANCE` | `id` | **0** | 30 | 1 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 166 | `smriti_api_key_logs` | IAM & Security Governance | `LIVE_GOVERNANCE` | `id` | **0** | 22 | 1 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 167 | `smriti_api_key_permission_sets` | IAM & Security Governance | `LIVE_GOVERNANCE` | `id` | **0** | 18 | 2 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 168 | `smriti_api_keys` | IAM & Security Governance | `LIVE_GOVERNANCE` | `id` | **0** | 24 | 1 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 169 | `smriti_approval_actions` | Workflow & Approval Engine | `LIVE_GOVERNANCE` | `id` | **0** | 24 | 1 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 170 | `smriti_approval_assignments` | IAM & Security Governance | `LIVE_GOVERNANCE` | `id` | **0** | 19 | 1 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 171 | `smriti_approval_comments` | Workflow & Approval Engine | `LIVE_GOVERNANCE` | `id` | **0** | 20 | 1 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 172 | `smriti_approval_conditions` | Workflow & Approval Engine | `LIVE_GOVERNANCE` | `id` | **0** | 18 | 1 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 173 | `smriti_approval_delegations` | Workflow & Approval Engine | `LIVE_GOVERNANCE` | `id` | **0** | 21 | 0 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 174 | `smriti_approval_escalations` | Workflow & Approval Engine | `LIVE_GOVERNANCE` | `id` | **0** | 21 | 1 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 175 | `smriti_approval_histories` | Workflow & Approval Engine | `LIVE_GOVERNANCE` | `id` | **0** | 21 | 1 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 176 | `smriti_approval_matrices` | Workflow & Approval Engine | `LIVE_GOVERNANCE` | `id` | **0** | 20 | 1 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 177 | `smriti_approval_outbox` | Workflow & Approval Engine | `LIVE_GOVERNANCE` | `id` | **0** | 21 | 0 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 178 | `smriti_approval_policies` | Workflow & Approval Engine | `LIVE_GOVERNANCE` | `id` | **0** | 26 | 0 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 179 | `smriti_approval_requests` | Workflow & Approval Engine | `LIVE_GOVERNANCE` | `id` | **0** | 24 | 0 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 180 | `smriti_approval_steps` | Workflow & Approval Engine | `LIVE_GOVERNANCE` | `id` | **0** | 22 | 1 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 181 | `smriti_audit_log` | Audit, Compliance & SRE | `LIVE_GOVERNANCE` | `id` | **0** | 20 | 0 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 182 | `smriti_bank_accounts` | Financial Accounting & Tax | `LIVE_GOVERNANCE` | `id` | **0** | 19 | 2 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 183 | `smriti_banks` | General Platform | `LIVE_GOVERNANCE` | `id` | **20** | 9 | 0 | `UnknownModel` | CANONICAL LIVE |
| 184 | `smriti_branding` | Catalog & Item Master | `LIVE_GOVERNANCE` | `id` | **0** | 11 | 1 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 185 | `smriti_comm_channels` | Supply Chain & Channel Distribution (SCDM) | `LIVE_GOVERNANCE` | `id` | **0** | 22 | 1 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 186 | `smriti_contacts` | General Platform | `LIVE_GOVERNANCE` | `id` | **0** | 24 | 1 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 187 | `smriti_entity_registry` | General Platform | `LIVE_GOVERNANCE` | `id` | **0** | 9 | 0 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 188 | `smriti_field_security_masks` | General Platform | `LIVE_GOVERNANCE` | `id` | **0** | 12 | 1 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 189 | `smriti_identity_outbox` | General Platform | `LIVE_GOVERNANCE` | `id` | **0** | 24 | 2 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 190 | `smriti_identity_rule_versions` | IAM & Security Governance | `LIVE_GOVERNANCE` | `id` | **0** | 20 | 3 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 191 | `smriti_identity_rules` | IAM & Security Governance | `LIVE_GOVERNANCE` | `id` | **0** | 24 | 2 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 192 | `smriti_menus` | General Platform | `LIVE_GOVERNANCE` | `id` | **4** | 25 | 3 | `UnknownModel` | CANONICAL LIVE |
| 193 | `smriti_permission_set_permissions` | IAM & Security Governance | `LIVE_GOVERNANCE` | `id` | **46** | 19 | 4 | `UnknownModel` | CANONICAL LIVE |
| 194 | `smriti_permission_sets` | IAM & Security Governance | `LIVE_GOVERNANCE` | `id` | **8** | 19 | 2 | `UnknownModel` | CANONICAL LIVE |
| 195 | `smriti_permissions` | IAM & Security Governance | `LIVE_GOVERNANCE` | `id` | **60** | 22 | 2 | `UnknownModel` | CANONICAL LIVE |
| 196 | `smriti_report_templates` | Platform Configuration & System | `LIVE_GOVERNANCE` | `id` | **0** | 10 | 1 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 197 | `smriti_role_permission_sets` | IAM & Security Governance | `LIVE_GOVERNANCE` | `id` | **40** | 18 | 4 | `UnknownModel` | CANONICAL LIVE |
| 198 | `smriti_roles` | IAM & Security Governance | `LIVE_GOVERNANCE` | `id` | **11** | 21 | 3 | `UnknownModel` | CANONICAL LIVE |
| 199 | `smriti_security_audits` | Audit, Compliance & SRE | `LIVE_GOVERNANCE` | `id` | **0** | 24 | 2 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 200 | `smriti_security_policies` | General Platform | `LIVE_GOVERNANCE` | `id` | **0** | 14 | 0 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 201 | `smriti_service_accounts` | Financial Accounting & Tax | `LIVE_GOVERNANCE` | `id` | **0** | 19 | 0 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 202 | `smriti_settings` | Platform Configuration & System | `LIVE_GOVERNANCE` | `id` | **0** | 20 | 0 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 203 | `smriti_social_profiles` | General Platform | `LIVE_GOVERNANCE` | `id` | **0** | 8 | 1 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 204 | `smriti_theme_variants` | General Platform | `LIVE_GOVERNANCE` | `id` | **0** | 16 | 1 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 205 | `smriti_themes` | General Platform | `LIVE_GOVERNANCE` | `id` | **0** | 12 | 1 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 206 | `smriti_universal_identities` | General Platform | `LIVE_GOVERNANCE` | `id` | **0** | 32 | 3 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 207 | `smriti_user_assignments` | IAM & Security Governance | `LIVE_GOVERNANCE` | `id` | **0** | 23 | 5 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 208 | `smriti_user_roles` | IAM & Security Governance | `LIVE_GOVERNANCE` | `id` | **3** | 18 | 4 | `UnknownModel` | CANONICAL LIVE |
| 209 | `smriti_workspace_profiles` | General Platform | `LIVE_GOVERNANCE` | `id` | **0** | 16 | 0 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 210 | `sre_compliance_decisions` | Audit, Compliance & SRE | `REFERENCE` | `id` | **0** | 22 | 2 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 211 | `sre_rule_engine` | Audit, Compliance & SRE | `CONFIGURATION` | `id` | **0** | 21 | 2 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 212 | `sre_statutory_ledger` | Financial Accounting & Tax | `LEDGER` | `id` | **0** | 31 | 3 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 213 | `stock_adjustments` | Inventory & Stock Management | `REFERENCE` | `id` | **0** | 24 | 3 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 214 | `stock_bin_assignments` | IAM & Security Governance | `REFERENCE` | `id` | **0** | 11 | 2 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 215 | `stock_count_items` | Catalog & Item Master | `TRANSACTION` | `id` | **0** | 25 | 4 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 216 | `stock_counts` | Inventory & Stock Management | `TRANSACTION` | `id` | **0** | 26 | 2 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 217 | `stock_dispatch_lines` | Inventory & Stock Management | `REFERENCE` | `id` | **0** | 28 | 4 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 218 | `stock_dispatches` | Inventory & Stock Management | `REFERENCE` | `id` | **0** | 25 | 4 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 219 | `stock_movements` | Inventory & Stock Management | `LEDGER` | `id` | **9** | 34 | 3 | `StockMovement` | CANONICAL LIVE |
| 220 | `stock_rebalancing_recommendations` | Inventory & Stock Management | `REFERENCE` | `id` | **0** | 27 | 4 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 221 | `stock_transfer_items` | Catalog & Item Master | `TRANSACTION` | `id` | **0** | 24 | 4 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 222 | `stock_transfer_order_items` | Catalog & Item Master | `TRANSACTION` | `id` | **0** | 27 | 4 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 223 | `stock_transfer_orders` | Inventory & Stock Management | `TRANSACTION` | `id` | **0** | 35 | 2 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 224 | `stock_transfer_shipments` | Inventory & Stock Management | `TRANSACTION` | `id` | **0** | 24 | 3 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 225 | `stock_transfers` | Inventory & Stock Management | `TRANSACTION` | `id` | **0** | 26 | 4 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 226 | `stores` | Inventory & Stock Management | `MASTER` | `id` | **0** | 20 | 2 | `Store` | LIVE BASELINE (0 rows) |
| 227 | `supplier_addresses` | Procurement & Purchasing | `MASTER` | `id` | **0** | 29 | 1 | `SupplierAddress` | LIVE BASELINE (0 rows) |
| 228 | `supplier_bank_details` | Procurement & Purchasing | `MASTER` | `id` | **0** | 24 | 1 | `SupplierBankDetails` | LIVE BASELINE (0 rows) |
| 229 | `supplier_compliance_profiles` | Procurement & Purchasing | `CONFIGURATION` | `id` | **0** | 25 | 1 | `SupplierComplianceProfile` | LIVE BASELINE (0 rows) |
| 230 | `supplier_contacts` | Procurement & Purchasing | `MASTER` | `id` | **0** | 23 | 1 | `SupplierContact` | LIVE BASELINE (0 rows) |
| 231 | `supplier_credit_profiles` | Procurement & Purchasing | `CONFIGURATION` | `id` | **0** | 21 | 1 | `SupplierCreditProfile` | LIVE BASELINE (0 rows) |
| 232 | `supplier_debit_notes` | Procurement & Purchasing | `MASTER` | `id` | **0** | 25 | 2 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 233 | `supplier_documents` | Procurement & Purchasing | `MASTER` | `id` | **0** | 22 | 1 | `SupplierDocument` | LIVE BASELINE (0 rows) |
| 234 | `supplier_gst_registrations` | Procurement & Purchasing | `MASTER` | `id` | **0** | 22 | 1 | `SupplierGSTRegistration` | LIVE BASELINE (0 rows) |
| 235 | `supplier_logistics` | Procurement & Purchasing | `AUDIT` | `id` | **0** | 23 | 1 | `SupplierLogistics` | LIVE BASELINE (0 rows) |
| 236 | `supplier_payment_profiles` | Procurement & Purchasing | `TRANSACTION` | `id` | **0** | 21 | 1 | `SupplierPaymentProfile` | LIVE BASELINE (0 rows) |
| 237 | `supplier_payments` | Procurement & Purchasing | `TRANSACTION` | `id` | **0** | 22 | 3 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 238 | `supplier_scorecard_metrics` | Procurement & Purchasing | `MASTER` | `id` | **0** | 22 | 1 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 239 | `supplier_scorecards` | Procurement & Purchasing | `MASTER` | `id` | **0** | 27 | 1 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 240 | `supplier_tax_profiles` | Procurement & Purchasing | `CONFIGURATION` | `id` | **0** | 24 | 1 | `SupplierTaxProfile` | LIVE BASELINE (0 rows) |
| 241 | `suppliers` | Procurement & Purchasing | `MASTER` | `id` | **0** | 50 | 2 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 242 | `sync_queue` | General Platform | `INTEGRATION` | `id` | **0** | 15 | 0 | *No Model* | LIVE BASELINE (0 rows) |
| 243 | `system_bootstrap_states` | Platform Configuration & System | `REFERENCE` | `id` | **6** | 24 | 0 | `UnknownModel` | CANONICAL LIVE |
| 244 | `system_configs` | Platform Configuration & System | `CONFIGURATION` | `id` | **1** | 19 | 2 | `UnknownModel` | CANONICAL LIVE |
| 245 | `tally_configs` | Platform Configuration & System | `CONFIGURATION` | `id` | **0** | 19 | 2 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 246 | `tds_entries` | General Platform | `REFERENCE` | `id` | **0** | 20 | 0 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 247 | `tenant_provision_journals` | IAM & Security Governance | `LEDGER` | `id` | **0** | 10 | 1 | `TenantProvisionJournal` | LIVE BASELINE (0 rows) |
| 248 | `tenant_provision_profiles` | IAM & Security Governance | `CONFIGURATION` | `id` | **0** | 12 | 1 | `TenantProvisionProfile` | LIVE BASELINE (0 rows) |
| 249 | `tenant_settings` | IAM & Security Governance | `CONFIGURATION` | `id` | **0** | 14 | 1 | `TenantSettings` | LIVE BASELINE (0 rows) |
| 250 | `tenants` | IAM & Security Governance | `REFERENCE` | `id` | **0** | 10 | 0 | `Tenant` | CANONICAL LIVE |
| 251 | `terms_clauses` | General Platform | `REFERENCE` | `id` | **0** | 24 | 2 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 252 | `terms_defaults` | General Platform | `REFERENCE` | `id` | **0** | 19 | 2 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 253 | `terms_snapshots` | General Platform | `SNAPSHOT` | `id` | **0** | 20 | 2 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 254 | `three_way_match_lines` | General Platform | `REFERENCE` | `id` | **0** | 27 | 2 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 255 | `three_way_matches` | General Platform | `REFERENCE` | `id` | **0** | 26 | 2 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 256 | `user_branch_assignments` | IAM & Security Governance | `MASTER` | `id` | **0** | 18 | 3 | `UserBranchAssignment` | LIVE BASELINE (0 rows) |
| 257 | `user_company_assignments` | IAM & Security Governance | `MASTER` | `id` | **0** | 18 | 3 | `UserCompanyAssignment` | LIVE BASELINE (0 rows) |
| 258 | `user_store_assignments` | IAM & Security Governance | `MASTER` | `id` | **0** | 18 | 4 | `UserStoreAssignment` | LIVE BASELINE (0 rows) |
| 259 | `users` | IAM & Security Governance | `MASTER` | `id` | **3** | 44 | 2 | `UnknownModel` | CANONICAL LIVE |
| 260 | `variant_templates` | Platform Configuration & System | `CONFIGURATION` | `id` | **1** | 27 | 2 | `UnknownModel` | CANONICAL LIVE |
| 261 | `vendor_contract_tiers` | Procurement & Purchasing | `REFERENCE` | `id` | **0** | 27 | 2 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 262 | `vendor_contracts` | Procurement & Purchasing | `REFERENCE` | `id` | **0** | 32 | 2 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 263 | `vendor_quotation_items` | Catalog & Item Master | `MASTER` | `id` | **0** | 23 | 2 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 264 | `vendor_quotations` | General Platform | `REFERENCE` | `id` | **0** | 29 | 3 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 265 | `warehouse_bins` | Inventory & Stock Management | `MASTER` | `id` | **0** | 22 | 2 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 266 | `warehouse_zones` | Inventory & Stock Management | `MASTER` | `id` | **0** | 16 | 1 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 267 | `warehouses` | Inventory & Stock Management | `MASTER` | `id` | **0** | 20 | 2 | `Warehouse` | LIVE BASELINE (0 rows) |
| 268 | `webhook_subscriptions` | General Platform | `REFERENCE` | `id` | **0** | 8 | 0 | `UnknownModel` | LIVE BASELINE (0 rows) |
| 269 | `workflow_events` | Workflow & Approval Engine | `INTEGRATION` | `id` | **0** | 13 | 1 | `UnknownModel` | LIVE BASELINE (0 rows) |

---

## Detailed Physical Table Specifications

### Table: `alembic_version`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** General Platform
- **Table Type:** `SYSTEM`
- **Row Count:** `1` rows
- **Columns Count:** `1` columns
- **Primary Key:** `['version_num']`
- **Foreign Keys:** `[]`
- **Code Model:** *None (No SQLAlchemy ORM mapping in app code)*

### Table: `apparel_matrix_variants`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Catalog & Item Master
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `9` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[]`
- **Code Model:** `UnknownModel` in `[backend\app\models\apparel.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\apparel.py)`

### Table: `approval_workflow_logs`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Workflow & Approval Engine
- **Table Type:** `AUDIT`
- **Row Count:** `0` rows
- **Columns Count:** `25` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'approval_workflow_logs_branch_id_fkey'}, {'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'approval_workflow_logs_company_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\terms.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\terms.py)`

### Table: `attribute_definitions`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Catalog & Item Master
- **Table Type:** `CONFIGURATION`
- **Row Count:** `5` rows
- **Columns Count:** `33` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'attribute_definitions_branch_id_fkey'}, {'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'attribute_definitions_company_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\attributes.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\attributes.py)`

### Table: `attribute_groups`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Catalog & Item Master
- **Table Type:** `REFERENCE`
- **Row Count:** `1` rows
- **Columns Count:** `20` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'attribute_groups_branch_id_fkey'}, {'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'attribute_groups_company_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\attributes.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\attributes.py)`

### Table: `audit_logs`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Audit, Compliance & SRE
- **Table Type:** `AUDIT`
- **Row Count:** `0` rows
- **Columns Count:** `12` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[]`
- **Code Model:** *None (No SQLAlchemy ORM mapping in app code)*

### Table: `bank_accounts`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Financial Accounting & Tax
- **Table Type:** `TRANSACTION`
- **Row Count:** `0` rows
- **Columns Count:** `23` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[]`
- **Code Model:** `UnknownModel` in `[backend\app\models\accounting.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\accounting.py)`

### Table: `barcode_layouts`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Catalog & Item Master
- **Table Type:** `CONFIGURATION`
- **Row Count:** `0` rows
- **Columns Count:** `22` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'barcode_layouts_branch_id_fkey'}, {'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'barcode_layouts_company_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\barcode.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\barcode.py)`

### Table: `barcode_providers`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Catalog & Item Master
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `22` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'barcode_providers_company_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'barcode_providers_branch_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\product_identity.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\product_identity.py)`

### Table: `blanket_purchase_agreement_lines`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Procurement & Purchasing
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `22` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'bpa_id', 'foreign_table': 'blanket_purchase_agreements', 'foreign_column': 'id', 'constraint': 'blanket_purchase_agreement_lines_bpa_id_fkey'}, {'column': 'product_id', 'foreign_table': 'products', 'foreign_column': 'id', 'constraint': 'blanket_purchase_agreement_lines_product_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\purchase.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\purchase.py)`

### Table: `blanket_purchase_agreements`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Procurement & Purchasing
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `26` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'supplier_id', 'foreign_table': 'suppliers', 'foreign_column': 'id', 'constraint': 'blanket_purchase_agreements_supplier_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\purchase.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\purchase.py)`

### Table: `branches`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** IAM & Security Governance
- **Table Type:** `MASTER`
- **Row Count:** `4` rows
- **Columns Count:** `15` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'branches_company_id_fkey'}]`
- **Code Model:** `Branch` in `[backend\app\models\tenant.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\tenant.py)`

### Table: `cash_registers`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Sales & Retail POS
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `22` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'cash_registers_company_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'cash_registers_branch_id_fkey'}]`
- **Code Model:** *None (No SQLAlchemy ORM mapping in app code)*

### Table: `category_attribute_group_mappings`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Catalog & Item Master
- **Table Type:** `CONFIGURATION`
- **Row Count:** `1` rows
- **Columns Count:** `19` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'category_attribute_group_mappings_branch_id_fkey'}, {'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'category_attribute_group_mappings_company_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\attributes.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\attributes.py)`

### Table: `chart_of_accounts`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Financial Accounting & Tax
- **Table Type:** `TRANSACTION`
- **Row Count:** `0` rows
- **Columns Count:** `25` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'chart_of_accounts_company_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'chart_of_accounts_branch_id_fkey'}, {'column': 'parent_id', 'foreign_table': 'chart_of_accounts', 'foreign_column': 'id', 'constraint': 'chart_of_accounts_parent_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\accounting.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\accounting.py)`

### Table: `companies`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** General Platform
- **Table Type:** `REFERENCE`
- **Row Count:** `4` rows
- **Columns Count:** `27` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'organization_id', 'foreign_table': 'organizations', 'foreign_column': 'id', 'constraint': 'companies_organization_id_fkey'}]`
- **Code Model:** `Company` in `[backend\app\models\tenant.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\tenant.py)`

### Table: `company_financial_years`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** IAM & Security Governance
- **Table Type:** `MASTER`
- **Row Count:** `0` rows
- **Columns Count:** `13` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'company_financial_years_company_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\company_master.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\company_master.py)`

### Table: `company_tax_profiles`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** IAM & Security Governance
- **Table Type:** `CONFIGURATION`
- **Row Count:** `0` rows
- **Columns Count:** `22` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'company_tax_profiles_company_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\company_master.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\company_master.py)`

### Table: `compliance_audit_logs`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Audit, Compliance & SRE
- **Table Type:** `AUDIT`
- **Row Count:** `0` rows
- **Columns Count:** `23` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'compliance_audit_logs_branch_id_fkey'}, {'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'compliance_audit_logs_company_id_fkey'}]`
- **Code Model:** *None (No SQLAlchemy ORM mapping in app code)*

### Table: `compliance_credentials`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Audit, Compliance & SRE
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `20` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'compliance_credentials_branch_id_fkey'}, {'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'compliance_credentials_company_id_fkey'}, {'column': 'service_id', 'foreign_table': 'government_services', 'foreign_column': 'id', 'constraint': 'compliance_credentials_service_id_fkey'}]`
- **Code Model:** *None (No SQLAlchemy ORM mapping in app code)*

### Table: `compliance_outboxes`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Audit, Compliance & SRE
- **Table Type:** `INTEGRATION`
- **Row Count:** `0` rows
- **Columns Count:** `24` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'compliance_outboxes_branch_id_fkey'}, {'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'compliance_outboxes_company_id_fkey'}]`
- **Code Model:** *None (No SQLAlchemy ORM mapping in app code)*

### Table: `connector_registry`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** General Platform
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `8` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[]`
- **Code Model:** `UnknownModel` in `[backend\app\models\integration_hub.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\integration_hub.py)`

### Table: `consignment_partners`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Supply Chain & Channel Distribution (SCDM)
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `22` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'consignment_partners_company_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'consignment_partners_branch_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\consignment.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\consignment.py)`

### Table: `consignment_return_items`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Catalog & Item Master
- **Table Type:** `MASTER`
- **Row Count:** `0` rows
- **Columns Count:** `22` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'consignment_return_items_company_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'consignment_return_items_branch_id_fkey'}, {'column': 'return_id', 'foreign_table': 'consignment_returns', 'foreign_column': 'id', 'constraint': 'consignment_return_items_return_id_fkey'}, {'column': 'transfer_item_id', 'foreign_table': 'consignment_transfer_items', 'foreign_column': 'id', 'constraint': 'consignment_return_items_transfer_item_id_fkey'}, {'column': 'product_id', 'foreign_table': 'products', 'foreign_column': 'id', 'constraint': 'consignment_return_items_product_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\consignment.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\consignment.py)`

### Table: `consignment_returns`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Sales & Retail POS
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `22` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'consignment_returns_company_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'consignment_returns_branch_id_fkey'}, {'column': 'partner_id', 'foreign_table': 'consignment_partners', 'foreign_column': 'id', 'constraint': 'consignment_returns_partner_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\consignment.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\consignment.py)`

### Table: `consignment_sale_report_items`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Catalog & Item Master
- **Table Type:** `MASTER`
- **Row Count:** `0` rows
- **Columns Count:** `24` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'consignment_sale_report_items_company_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'consignment_sale_report_items_branch_id_fkey'}, {'column': 'report_id', 'foreign_table': 'consignment_sale_reports', 'foreign_column': 'id', 'constraint': 'consignment_sale_report_items_report_id_fkey'}, {'column': 'transfer_item_id', 'foreign_table': 'consignment_transfer_items', 'foreign_column': 'id', 'constraint': 'consignment_sale_report_items_transfer_item_id_fkey'}, {'column': 'product_id', 'foreign_table': 'products', 'foreign_column': 'id', 'constraint': 'consignment_sale_report_items_product_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\consignment.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\consignment.py)`

### Table: `consignment_sale_reports`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Sales & Retail POS
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `23` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'consignment_sale_reports_company_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'consignment_sale_reports_branch_id_fkey'}, {'column': 'partner_id', 'foreign_table': 'consignment_partners', 'foreign_column': 'id', 'constraint': 'consignment_sale_reports_partner_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\consignment.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\consignment.py)`

### Table: `consignment_settlements`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Financial Accounting & Tax
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `26` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'consignment_settlements_company_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'consignment_settlements_branch_id_fkey'}, {'column': 'partner_id', 'foreign_table': 'consignment_partners', 'foreign_column': 'id', 'constraint': 'consignment_settlements_partner_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\consignment.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\consignment.py)`

### Table: `consignment_transfer_items`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Catalog & Item Master
- **Table Type:** `TRANSACTION`
- **Row Count:** `0` rows
- **Columns Count:** `29` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'consignment_transfer_items_company_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'consignment_transfer_items_branch_id_fkey'}, {'column': 'transfer_id', 'foreign_table': 'consignment_transfers', 'foreign_column': 'id', 'constraint': 'consignment_transfer_items_transfer_id_fkey'}, {'column': 'product_id', 'foreign_table': 'products', 'foreign_column': 'id', 'constraint': 'consignment_transfer_items_product_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\consignment.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\consignment.py)`

### Table: `consignment_transfers`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Supply Chain & Channel Distribution (SCDM)
- **Table Type:** `TRANSACTION`
- **Row Count:** `0` rows
- **Columns Count:** `24` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'consignment_transfers_company_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'consignment_transfers_branch_id_fkey'}, {'column': 'partner_id', 'foreign_table': 'consignment_partners', 'foreign_column': 'id', 'constraint': 'consignment_transfers_partner_id_fkey'}, {'column': 'invoice_id', 'foreign_table': 'sales_invoices', 'foreign_column': 'id', 'constraint': 'consignment_transfers_invoice_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\consignment.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\consignment.py)`

### Table: `corporate_gstin_registry`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Financial Accounting & Tax
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `19` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'corporate_gstin_registry_company_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'corporate_gstin_registry_branch_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\sre.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\sre.py)`

### Table: `cost_centers`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** General Platform
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `15` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[]`
- **Code Model:** `UnknownModel` in `[backend\app\models\accounting.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\accounting.py)`

### Table: `cost_layer_ledger_entries`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Financial Accounting & Tax
- **Table Type:** `LEDGER`
- **Row Count:** `0` rows
- **Columns Count:** `26` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'cost_layer_ledger_entries_company_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'cost_layer_ledger_entries_branch_id_fkey'}, {'column': 'location_id', 'foreign_table': 'inventory_location_nodes', 'foreign_column': 'id', 'constraint': 'cost_layer_ledger_entries_location_id_fkey'}, {'column': 'product_id', 'foreign_table': 'products', 'foreign_column': 'id', 'constraint': 'cost_layer_ledger_entries_product_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\inventory_kernel.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\inventory_kernel.py)`

### Table: `credit_notes`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Sales & Retail POS
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `29` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'credit_notes_company_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'credit_notes_branch_id_fkey'}, {'column': 'return_id', 'foreign_table': 'sales_returns', 'foreign_column': 'id', 'constraint': 'credit_notes_return_id_fkey'}, {'column': 'invoice_id', 'foreign_table': 'sales_invoices', 'foreign_column': 'id', 'constraint': 'credit_notes_invoice_id_fkey'}, {'column': 'customer_id', 'foreign_table': 'customers', 'foreign_column': 'id', 'constraint': 'credit_notes_customer_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\sales.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\sales.py)`

### Table: `crm_campaigns`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Customer Relationship Management (CRM)
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `19` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[]`
- **Code Model:** `UnknownModel` in `[backend\app\models\crm.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\crm.py)`

### Table: `crm_customer_activities`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Customer Relationship Management (CRM)
- **Table Type:** `MASTER`
- **Row Count:** `0` rows
- **Columns Count:** `17` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'customer_id', 'foreign_table': 'customers', 'foreign_column': 'id', 'constraint': 'crm_customer_activities_customer_id_fkey'}, {'column': 'lead_id', 'foreign_table': 'crm_leads', 'foreign_column': 'id', 'constraint': 'crm_customer_activities_lead_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\crm.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\crm.py)`

### Table: `crm_leads`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Customer Relationship Management (CRM)
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `21` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[]`
- **Code Model:** `UnknownModel` in `[backend\app\models\crm.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\crm.py)`

### Table: `crm_opportunities`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Customer Relationship Management (CRM)
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `20` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'customer_id', 'foreign_table': 'customers', 'foreign_column': 'id', 'constraint': 'crm_opportunities_customer_id_fkey'}, {'column': 'lead_id', 'foreign_table': 'crm_leads', 'foreign_column': 'id', 'constraint': 'crm_opportunities_lead_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\crm.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\crm.py)`

### Table: `crm_support_tickets`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Customer Relationship Management (CRM)
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `18` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'customer_id', 'foreign_table': 'customers', 'foreign_column': 'id', 'constraint': 'crm_support_tickets_customer_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\crm.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\crm.py)`

### Table: `crm_ticket_comments`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Customer Relationship Management (CRM)
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `12` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'ticket_id', 'foreign_table': 'crm_support_tickets', 'foreign_column': 'id', 'constraint': 'crm_ticket_comments_ticket_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\crm.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\crm.py)`

### Table: `customer_addresses`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Customer Relationship Management (CRM)
- **Table Type:** `MASTER`
- **Row Count:** `0` rows
- **Columns Count:** `29` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'customer_id', 'foreign_table': 'customers', 'foreign_column': 'id', 'constraint': 'customer_addresses_customer_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\crm.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\crm.py)`

### Table: `customer_channel_preferences`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Customer Relationship Management (CRM)
- **Table Type:** `CONFIGURATION`
- **Row Count:** `0` rows
- **Columns Count:** `20` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'customer_id', 'foreign_table': 'customers', 'foreign_column': 'id', 'constraint': 'customer_channel_preferences_customer_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\crm.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\crm.py)`

### Table: `customer_contacts`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Customer Relationship Management (CRM)
- **Table Type:** `MASTER`
- **Row Count:** `0` rows
- **Columns Count:** `23` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'customer_id', 'foreign_table': 'customers', 'foreign_column': 'id', 'constraint': 'customer_contacts_customer_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\crm.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\crm.py)`

### Table: `customer_credit_profiles`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Customer Relationship Management (CRM)
- **Table Type:** `CONFIGURATION`
- **Row Count:** `0` rows
- **Columns Count:** `24` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'customer_id', 'foreign_table': 'customers', 'foreign_column': 'id', 'constraint': 'customer_credit_profiles_customer_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\crm.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\crm.py)`

### Table: `customer_groups`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Customer Relationship Management (CRM)
- **Table Type:** `MASTER`
- **Row Count:** `0` rows
- **Columns Count:** `40` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'fk_customer_groups_company_id'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'fk_customer_groups_branch_id'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\crm.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\crm.py)`

### Table: `customer_tax_profiles`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Financial Accounting & Tax
- **Table Type:** `CONFIGURATION`
- **Row Count:** `0` rows
- **Columns Count:** `27` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'customer_id', 'foreign_table': 'customers', 'foreign_column': 'id', 'constraint': 'customer_tax_profiles_customer_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\crm.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\crm.py)`

### Table: `customers`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Customer Relationship Management (CRM)
- **Table Type:** `MASTER`
- **Row Count:** `0` rows
- **Columns Count:** `55` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'customer_group_id', 'foreign_table': 'customer_groups', 'foreign_column': 'id', 'constraint': 'customers_customer_group_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'fk_customers_branch_id'}, {'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'fk_customers_company_id'}, {'column': 'pricing_group_id', 'foreign_table': 'pricing_groups', 'foreign_column': 'id', 'constraint': 'fk_customers_pricing_group_id'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\crm.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\crm.py)`

### Table: `dashboard_definitions`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** General Platform
- **Table Type:** `CONFIGURATION`
- **Row Count:** `0` rows
- **Columns Count:** `8` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[]`
- **Code Model:** `UnknownModel` in `[backend\app\models\analytics_bi.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\analytics_bi.py)`

### Table: `data_exchange_field_mappings`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Supply Chain & Channel Distribution (SCDM)
- **Table Type:** `CONFIGURATION`
- **Row Count:** `0` rows
- **Columns Count:** `19` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'data_exchange_field_mappings_branch_id_fkey'}, {'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'data_exchange_field_mappings_company_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\exchange.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\exchange.py)`

### Table: `data_exchange_tasks`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Supply Chain & Channel Distribution (SCDM)
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `24` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'data_exchange_tasks_branch_id_fkey'}, {'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'data_exchange_tasks_company_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\exchange.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\exchange.py)`

### Table: `database_profiles`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** General Platform
- **Table Type:** `CONFIGURATION`
- **Row Count:** `1` rows
- **Columns Count:** `9` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[]`
- **Code Model:** *None (No SQLAlchemy ORM mapping in app code)*

### Table: `dispatch_approval_events`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Workflow & Approval Engine
- **Table Type:** `INTEGRATION`
- **Row Count:** `0` rows
- **Columns Count:** `22` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'dispatch_approval_events_company_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'dispatch_approval_events_branch_id_fkey'}, {'column': 'dispatch_id', 'foreign_table': 'stock_dispatches', 'foreign_column': 'id', 'constraint': 'dispatch_approval_events_dispatch_id_fkey'}, {'column': 'user_id', 'foreign_table': 'users', 'foreign_column': 'id', 'constraint': 'dispatch_approval_events_user_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\dispatch.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\dispatch.py)`

### Table: `document_number_series`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** General Platform
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `24` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'document_number_series_company_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'document_number_series_branch_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\platform.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\platform.py)`

### Table: `document_posting_profiles`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Sales & Retail POS
- **Table Type:** `CONFIGURATION`
- **Row Count:** `0` rows
- **Columns Count:** `23` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'document_posting_profiles_company_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'document_posting_profiles_branch_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\inventory_kernel.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\inventory_kernel.py)`

### Table: `document_series`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** General Platform
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `29` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'document_series_branch_id_fkey'}, {'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'document_series_company_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\numbering.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\numbering.py)`

### Table: `document_workflows`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Workflow & Approval Engine
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `21` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'document_workflows_company_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'document_workflows_branch_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\platform.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\platform.py)`

### Table: `eway_bills`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Financial Accounting & Tax
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `27` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'eway_bills_company_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'eway_bills_branch_id_fkey'}, {'column': 'invoice_id', 'foreign_table': 'sales_invoices', 'foreign_column': 'id', 'constraint': 'eway_bills_invoice_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\tax.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\tax.py)`

### Table: `financial_year`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Financial Accounting & Tax
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `26` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'financial_year_company_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'financial_year_branch_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\accounting.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\accounting.py)`

### Table: `fiscal_periods`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** General Platform
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `21` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'fiscal_periods_company_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'fiscal_periods_branch_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\accounting.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\accounting.py)`

### Table: `fulfillment_waves`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** General Platform
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `20` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[]`
- **Code Model:** `UnknownModel` in `[backend\app\models\sales.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\sales.py)`

### Table: `government_services`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** General Platform
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `24` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'government_services_branch_id_fkey'}, {'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'government_services_company_id_fkey'}]`
- **Code Model:** *None (No SQLAlchemy ORM mapping in app code)*

### Table: `gst_reconciliation_records`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Financial Accounting & Tax
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `29` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'gst_reconciliation_records_company_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'gst_reconciliation_records_branch_id_fkey'}]`
- **Code Model:** *None (No SQLAlchemy ORM mapping in app code)*

### Table: `gst_return_filings`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Sales & Retail POS
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `28` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'gst_return_filings_company_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'gst_return_filings_branch_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\tax.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\tax.py)`

### Table: `gst_return_locks`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Sales & Retail POS
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `17` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[]`
- **Code Model:** `UnknownModel` in `[backend\app\models\accounting.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\accounting.py)`

### Table: `gst_tax_settlements`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Financial Accounting & Tax
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `33` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'gst_tax_settlements_company_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'gst_tax_settlements_branch_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\tax.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\tax.py)`

### Table: `gstr_filing_records`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Financial Accounting & Tax
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `30` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'gstr_filing_records_company_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'gstr_filing_records_branch_id_fkey'}]`
- **Code Model:** *None (No SQLAlchemy ORM mapping in app code)*

### Table: `gstr_outbox_logs`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Financial Accounting & Tax
- **Table Type:** `AUDIT`
- **Row Count:** `0` rows
- **Columns Count:** `24` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'gstr_outbox_logs_company_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'gstr_outbox_logs_branch_id_fkey'}]`
- **Code Model:** *None (No SQLAlchemy ORM mapping in app code)*

### Table: `identity_rules`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** IAM & Security Governance
- **Table Type:** `CONFIGURATION`
- **Row Count:** `0` rows
- **Columns Count:** `22` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'identity_rules_branch_id_fkey'}, {'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'identity_rules_company_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\product_identity.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\product_identity.py)`

### Table: `in_app_notifications`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** General Platform
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `8` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[]`
- **Code Model:** `UnknownModel` in `[backend\app\models\notification.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\notification.py)`

### Table: `integration_logs`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Audit, Compliance & SRE
- **Table Type:** `AUDIT`
- **Row Count:** `0` rows
- **Columns Count:** `32` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'integration_logs_company_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'integration_logs_branch_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\platform.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\platform.py)`

### Table: `inventory_checkpoint_records`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Inventory & Stock Management
- **Table Type:** `SNAPSHOT`
- **Row Count:** `0` rows
- **Columns Count:** `26` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'inventory_checkpoint_records_company_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'inventory_checkpoint_records_branch_id_fkey'}, {'column': 'last_entry_id', 'foreign_table': 'inventory_ledger_entries', 'foreign_column': 'id', 'constraint': 'inventory_checkpoint_records_last_entry_id_fkey'}, {'column': 'location_id', 'foreign_table': 'inventory_location_nodes', 'foreign_column': 'id', 'constraint': 'inventory_checkpoint_records_location_id_fkey'}, {'column': 'product_id', 'foreign_table': 'products', 'foreign_column': 'id', 'constraint': 'inventory_checkpoint_records_product_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\inventory_kernel.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\inventory_kernel.py)`

### Table: `inventory_identity_records`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Inventory & Stock Management
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `30` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'inventory_identity_records_company_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'inventory_identity_records_branch_id_fkey'}, {'column': 'product_id', 'foreign_table': 'products', 'foreign_column': 'id', 'constraint': 'inventory_identity_records_product_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\inventory_kernel.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\inventory_kernel.py)`

### Table: `inventory_ledger_entries`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Inventory & Stock Management
- **Table Type:** `LEDGER`
- **Row Count:** `7` rows
- **Columns Count:** `34` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'inventory_ledger_entries_company_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'inventory_ledger_entries_branch_id_fkey'}, {'column': 'from_location_id', 'foreign_table': 'inventory_location_nodes', 'foreign_column': 'id', 'constraint': 'inventory_ledger_entries_from_location_id_fkey'}, {'column': 'to_location_id', 'foreign_table': 'inventory_location_nodes', 'foreign_column': 'id', 'constraint': 'inventory_ledger_entries_to_location_id_fkey'}, {'column': 'product_id', 'foreign_table': 'products', 'foreign_column': 'id', 'constraint': 'inventory_ledger_entries_product_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\inventory_kernel.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\inventory_kernel.py)`

### Table: `inventory_location_nodes`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Inventory & Stock Management
- **Table Type:** `REFERENCE`
- **Row Count:** `3` rows
- **Columns Count:** `28` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'inventory_location_nodes_company_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'inventory_location_nodes_branch_id_fkey'}, {'column': 'parent_id', 'foreign_table': 'inventory_location_nodes', 'foreign_column': 'id', 'constraint': 'inventory_location_nodes_parent_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\inventory_kernel.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\inventory_kernel.py)`

### Table: `inventory_lock_records`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Inventory & Stock Management
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `30` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'inventory_lock_records_company_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'inventory_lock_records_branch_id_fkey'}, {'column': 'location_id', 'foreign_table': 'inventory_location_nodes', 'foreign_column': 'id', 'constraint': 'inventory_lock_records_location_id_fkey'}, {'column': 'product_id', 'foreign_table': 'products', 'foreign_column': 'id', 'constraint': 'inventory_lock_records_product_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\inventory_kernel.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\inventory_kernel.py)`

### Table: `inventory_snapshot_records`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Inventory & Stock Management
- **Table Type:** `SNAPSHOT`
- **Row Count:** `0` rows
- **Columns Count:** `27` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'inventory_snapshot_records_company_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'inventory_snapshot_records_branch_id_fkey'}, {'column': 'location_id', 'foreign_table': 'inventory_location_nodes', 'foreign_column': 'id', 'constraint': 'inventory_snapshot_records_location_id_fkey'}, {'column': 'product_id', 'foreign_table': 'products', 'foreign_column': 'id', 'constraint': 'inventory_snapshot_records_product_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\inventory_kernel.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\inventory_kernel.py)`

### Table: `journal_ledger_entries`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Financial Accounting & Tax
- **Table Type:** `LEDGER`
- **Row Count:** `0` rows
- **Columns Count:** `24` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'journal_ledger_entries_company_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'journal_ledger_entries_branch_id_fkey'}, {'column': 'voucher_id', 'foreign_table': 'journal_vouchers', 'foreign_column': 'id', 'constraint': 'journal_ledger_entries_voucher_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\accounting.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\accounting.py)`

### Table: `journal_vouchers`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Financial Accounting & Tax
- **Table Type:** `LEDGER`
- **Row Count:** `0` rows
- **Columns Count:** `27` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'journal_vouchers_company_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'journal_vouchers_branch_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\accounting.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\accounting.py)`

### Table: `kpi_metrics`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** General Platform
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `9` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[]`
- **Code Model:** `UnknownModel` in `[backend\app\models\analytics_bi.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\analytics_bi.py)`

### Table: `landed_cost_vouchers`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Procurement & Purchasing
- **Table Type:** `TRANSACTION`
- **Row Count:** `0` rows
- **Columns Count:** `22` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'grn_id', 'foreign_table': 'purchase_receipts', 'foreign_column': 'id', 'constraint': 'landed_cost_vouchers_grn_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\purchase.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\purchase.py)`

### Table: `legacy_pos_shifts`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Sales & Retail POS
- **Table Type:** `TRANSACTION`
- **Row Count:** `0` rows
- **Columns Count:** `12` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'profile_id', 'foreign_table': 'pos_profiles', 'foreign_column': 'id', 'constraint': 'legacy_pos_shifts_profile_id_fkey'}]`
- **Code Model:** *None (No SQLAlchemy ORM mapping in app code)*

### Table: `loyalty_customer_accounts`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Financial Accounting & Tax
- **Table Type:** `TRANSACTION`
- **Row Count:** `0` rows
- **Columns Count:** `7` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[]`
- **Code Model:** `UnknownModel` in `[backend\app\models\loyalty.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\loyalty.py)`

### Table: `loyalty_gift_cards`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Customer Relationship Management (CRM)
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `5` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[]`
- **Code Model:** `UnknownModel` in `[backend\app\models\loyalty.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\loyalty.py)`

### Table: `loyalty_point_transactions`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Customer Relationship Management (CRM)
- **Table Type:** `TRANSACTION`
- **Row Count:** `0` rows
- **Columns Count:** `16` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[]`
- **Code Model:** `UnknownModel` in `[backend\app\models\loyalty.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\loyalty.py)`

### Table: `master_types`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Catalog & Item Master
- **Table Type:** `MASTER`
- **Row Count:** `18` rows
- **Columns Count:** `13` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'depends_on', 'foreign_table': 'master_types', 'foreign_column': 'code', 'constraint': 'master_types_depends_on_fkey'}]`
- **Code Model:** `MasterType` in `[backend\app\models\master_lookup.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\master_lookup.py)`

### Table: `master_values`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Catalog & Item Master
- **Table Type:** `MASTER`
- **Row Count:** `80` rows
- **Columns Count:** `19` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'master_type_id', 'foreign_table': 'master_types', 'foreign_column': 'id', 'constraint': 'master_values_master_type_id_fkey'}, {'column': 'parent_value_id', 'foreign_table': 'master_values', 'foreign_column': 'id', 'constraint': 'master_values_parent_value_id_fkey'}, {'column': 'supersedes_id', 'foreign_table': 'master_values', 'foreign_column': 'id', 'constraint': 'fk_master_values_supersedes_id'}]`
- **Code Model:** `MasterValue` in `[backend\app\models\master_lookup.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\master_lookup.py)`

### Table: `module_audit_logs`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Audit, Compliance & SRE
- **Table Type:** `AUDIT`
- **Row Count:** `0` rows
- **Columns Count:** `8` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[]`
- **Code Model:** *None (No SQLAlchemy ORM mapping in app code)*

### Table: `module_states`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** General Platform
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `7` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[]`
- **Code Model:** *None (No SQLAlchemy ORM mapping in app code)*

### Table: `notification_dispatches`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Supply Chain & Channel Distribution (SCDM)
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `12` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[]`
- **Code Model:** `UnknownModel` in `[backend\app\models\notification.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\notification.py)`

### Table: `notification_templates`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Platform Configuration & System
- **Table Type:** `CONFIGURATION`
- **Row Count:** `0` rows
- **Columns Count:** `10` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[]`
- **Code Model:** `UnknownModel` in `[backend\app\models\notification.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\notification.py)`

### Table: `numbering_audit_logs`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Audit, Compliance & SRE
- **Table Type:** `AUDIT`
- **Row Count:** `0` rows
- **Columns Count:** `24` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'numbering_audit_logs_branch_id_fkey'}, {'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'numbering_audit_logs_company_id_fkey'}, {'column': 'series_id', 'foreign_table': 'document_series', 'foreign_column': 'id', 'constraint': 'numbering_audit_logs_series_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\numbering.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\numbering.py)`

### Table: `organizations`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** IAM & Security Governance
- **Table Type:** `REFERENCE`
- **Row Count:** `3` rows
- **Columns Count:** `7` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[]`
- **Code Model:** `UnknownModel` in `[backend\app\models\company_master.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\company_master.py)`

### Table: `outbound_message_queue`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** General Platform
- **Table Type:** `INTEGRATION`
- **Row Count:** `0` rows
- **Columns Count:** `11` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[]`
- **Code Model:** `UnknownModel` in `[backend\app\models\integration_hub.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\integration_hub.py)`

### Table: `pharma_batches`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Inventory & Stock Management
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `11` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[]`
- **Code Model:** `UnknownModel` in `[backend\app\models\pharma.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\pharma.py)`

### Table: `pick_list_items`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Catalog & Item Master
- **Table Type:** `MASTER`
- **Row Count:** `0` rows
- **Columns Count:** `22` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'pick_list_id', 'foreign_table': 'pick_lists', 'foreign_column': 'id', 'constraint': 'pick_list_items_pick_list_id_fkey'}, {'column': 'order_id', 'foreign_table': 'sales_orders', 'foreign_column': 'id', 'constraint': 'pick_list_items_order_id_fkey'}, {'column': 'product_id', 'foreign_table': 'products', 'foreign_column': 'id', 'constraint': 'pick_list_items_product_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\sales.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\sales.py)`

### Table: `pick_lists`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** General Platform
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `19` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'wave_id', 'foreign_table': 'fulfillment_waves', 'foreign_column': 'id', 'constraint': 'pick_lists_wave_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\sales.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\sales.py)`

### Table: `platform_idempotency_records`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** General Platform
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `24` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'platform_idempotency_records_company_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'platform_idempotency_records_branch_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\inventory_kernel.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\inventory_kernel.py)`

### Table: `pos_offline_sync_queue`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Sales & Retail POS
- **Table Type:** `INTEGRATION`
- **Row Count:** `0` rows
- **Columns Count:** `24` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'pos_offline_sync_queue_company_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'pos_offline_sync_queue_branch_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\pos.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\pos.py)`

### Table: `pos_profiles`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Sales & Retail POS
- **Table Type:** `CONFIGURATION`
- **Row Count:** `0` rows
- **Columns Count:** `9` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[]`
- **Code Model:** *None (No SQLAlchemy ORM mapping in app code)*

### Table: `pos_sessions`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** IAM & Security Governance
- **Table Type:** `TRANSACTION`
- **Row Count:** `0` rows
- **Columns Count:** `31` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'pos_sessions_company_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'pos_sessions_branch_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\pos.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\pos.py)`

### Table: `pos_transaction_items`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Catalog & Item Master
- **Table Type:** `TRANSACTION`
- **Row Count:** `0` rows
- **Columns Count:** `24` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'pos_transaction_items_company_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'pos_transaction_items_branch_id_fkey'}, {'column': 'transaction_id', 'foreign_table': 'pos_transactions', 'foreign_column': 'id', 'constraint': 'pos_transaction_items_transaction_id_fkey'}, {'column': 'product_id', 'foreign_table': 'products', 'foreign_column': 'id', 'constraint': 'pos_transaction_items_product_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\pos.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\pos.py)`

### Table: `pos_transactions`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Sales & Retail POS
- **Table Type:** `TRANSACTION`
- **Row Count:** `0` rows
- **Columns Count:** `30` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'pos_transactions_company_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'pos_transactions_branch_id_fkey'}, {'column': 'session_id', 'foreign_table': 'pos_sessions', 'foreign_column': 'id', 'constraint': 'pos_transactions_session_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\pos.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\pos.py)`

### Table: `pricing_groups`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Catalog & Item Master
- **Table Type:** `REFERENCE`
- **Row Count:** `5` rows
- **Columns Count:** `27` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[]`
- **Code Model:** `UnknownModel` in `[backend\app\models\crm.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\crm.py)`

### Table: `print_histories`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Platform Configuration & System
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `23` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'print_histories_branch_id_fkey'}, {'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'print_histories_company_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\barcode.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\barcode.py)`

### Table: `print_profiles`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Platform Configuration & System
- **Table Type:** `CONFIGURATION`
- **Row Count:** `0` rows
- **Columns Count:** `24` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'print_profiles_branch_id_fkey'}, {'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'print_profiles_company_id_fkey'}, {'column': 'template_id', 'foreign_table': 'print_templates', 'foreign_column': 'id', 'constraint': 'print_profiles_template_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\barcode.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\barcode.py)`

### Table: `print_templates`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Platform Configuration & System
- **Table Type:** `CONFIGURATION`
- **Row Count:** `0` rows
- **Columns Count:** `23` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'print_templates_branch_id_fkey'}, {'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'print_templates_company_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\barcode.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\barcode.py)`

### Table: `procurement_rfq_items`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Catalog & Item Master
- **Table Type:** `MASTER`
- **Row Count:** `0` rows
- **Columns Count:** `21` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'rfq_id', 'foreign_table': 'procurement_rfqs', 'foreign_column': 'id', 'constraint': 'procurement_rfq_items_rfq_id_fkey'}, {'column': 'product_id', 'foreign_table': 'products', 'foreign_column': 'id', 'constraint': 'procurement_rfq_items_product_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\purchase.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\purchase.py)`

### Table: `procurement_rfq_vendors`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Procurement & Purchasing
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `20` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'rfq_id', 'foreign_table': 'procurement_rfqs', 'foreign_column': 'id', 'constraint': 'procurement_rfq_vendors_rfq_id_fkey'}, {'column': 'supplier_id', 'foreign_table': 'suppliers', 'foreign_column': 'id', 'constraint': 'procurement_rfq_vendors_supplier_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\purchase.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\purchase.py)`

### Table: `procurement_rfqs`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Procurement & Purchasing
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `22` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[]`
- **Code Model:** `UnknownModel` in `[backend\app\models\purchase.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\purchase.py)`

### Table: `procurement_tolerance_policies`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** General Platform
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `21` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[]`
- **Code Model:** `UnknownModel` in `[backend\app\models\purchase.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\purchase.py)`

### Table: `product_barcodes`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Catalog & Item Master
- **Table Type:** `MASTER`
- **Row Count:** `0` rows
- **Columns Count:** `19` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'product_barcodes_branch_id_fkey'}, {'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'product_barcodes_company_id_fkey'}, {'column': 'product_id', 'foreign_table': 'products', 'foreign_column': 'id', 'constraint': 'product_barcodes_product_id_fkey'}]`
- **Code Model:** `ProductBarcode` in `[backend\app\models\inventory.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\inventory.py)`

### Table: `product_identities`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Catalog & Item Master
- **Table Type:** `MASTER`
- **Row Count:** `0` rows
- **Columns Count:** `25` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'product_id', 'foreign_table': 'products', 'foreign_column': 'id', 'constraint': 'product_identities_product_id_fkey'}, {'column': 'barcode_provider_id', 'foreign_table': 'barcode_providers', 'foreign_column': 'id', 'constraint': 'product_identities_barcode_provider_id_fkey'}, {'column': 'rule_id', 'foreign_table': 'identity_rules', 'foreign_column': 'id', 'constraint': 'product_identities_rule_id_fkey'}, {'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'product_identities_company_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'product_identities_branch_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\product_identity.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\product_identity.py)`

### Table: `product_inventory_policies`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Catalog & Item Master
- **Table Type:** `MASTER`
- **Row Count:** `0` rows
- **Columns Count:** `22` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'product_id', 'foreign_table': 'products', 'foreign_column': 'id', 'constraint': 'product_inventory_policies_product_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\inventory.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\inventory.py)`

### Table: `product_tax_profiles`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Catalog & Item Master
- **Table Type:** `CONFIGURATION`
- **Row Count:** `0` rows
- **Columns Count:** `24` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'product_id', 'foreign_table': 'products', 'foreign_column': 'id', 'constraint': 'product_tax_profiles_product_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\inventory.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\inventory.py)`

### Table: `product_vendors`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Catalog & Item Master
- **Table Type:** `MASTER`
- **Row Count:** `0` rows
- **Columns Count:** `34` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'product_id', 'foreign_table': 'products', 'foreign_column': 'id', 'constraint': 'product_vendors_product_id_fkey'}, {'column': 'supplier_id', 'foreign_table': 'suppliers', 'foreign_column': 'id', 'constraint': 'product_vendors_supplier_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\inventory.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\inventory.py)`

### Table: `products`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Catalog & Item Master
- **Table Type:** `MASTER`
- **Row Count:** `5` rows
- **Columns Count:** `44` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'fk_products_company_id'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'fk_products_branch_id'}, {'column': 'variant_template_id', 'foreign_table': 'variant_templates', 'foreign_column': 'id', 'constraint': 'fk_products_variant_template_id'}, {'column': 'size_scale_id', 'foreign_table': 'size_scales', 'foreign_column': 'id', 'constraint': 'fk_products_size_scale_id'}]`
- **Code Model:** `Product` in `[backend\app\models\inventory.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\inventory.py)`

### Table: `psv_parties`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** General Platform
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `11` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[]`
- **Code Model:** `PSVParty` in `[backend\app\models\psv.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\psv.py)`

### Table: `psv_sku_tracking`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** General Platform
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `10` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'party_id', 'foreign_table': 'psv_parties', 'foreign_column': 'id', 'constraint': 'psv_sku_tracking_party_id_fkey'}, {'column': 'product_id', 'foreign_table': 'products', 'foreign_column': 'id', 'constraint': 'psv_sku_tracking_product_id_fkey'}]`
- **Code Model:** `PSVPartySkuTracking` in `[backend\app\models\psv.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\psv.py)`

### Table: `purchase_jurisdiction_configs`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Procurement & Purchasing
- **Table Type:** `CONFIGURATION`
- **Row Count:** `0` rows
- **Columns Count:** `17` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'purchase_jurisdiction_configs_branch_id_fkey'}, {'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'purchase_jurisdiction_configs_company_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\purchase.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\purchase.py)`

### Table: `purchase_order_items`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Catalog & Item Master
- **Table Type:** `TRANSACTION`
- **Row Count:** `0` rows
- **Columns Count:** `34` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'order_id', 'foreign_table': 'purchase_orders', 'foreign_column': 'id', 'constraint': 'purchase_order_items_order_id_fkey'}, {'column': 'product_id', 'foreign_table': 'products', 'foreign_column': 'id', 'constraint': 'purchase_order_items_product_id_fkey'}, {'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'purchase_order_items_company_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'purchase_order_items_branch_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\purchase.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\purchase.py)`

### Table: `purchase_orders`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Procurement & Purchasing
- **Table Type:** `TRANSACTION`
- **Row Count:** `0` rows
- **Columns Count:** `25` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'supplier_id', 'foreign_table': 'suppliers', 'foreign_column': 'id', 'constraint': 'purchase_orders_supplier_id_fkey'}, {'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'purchase_orders_company_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'purchase_orders_branch_id_fkey'}, {'column': 'bpa_id', 'foreign_table': 'blanket_purchase_agreements', 'foreign_column': 'id', 'constraint': 'purchase_orders_bpa_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\purchase.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\purchase.py)`

### Table: `purchase_receipt_items`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Catalog & Item Master
- **Table Type:** `TRANSACTION`
- **Row Count:** `0` rows
- **Columns Count:** `29` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'receipt_id', 'foreign_table': 'purchase_receipts', 'foreign_column': 'id', 'constraint': 'purchase_receipt_items_receipt_id_fkey'}, {'column': 'product_id', 'foreign_table': 'products', 'foreign_column': 'id', 'constraint': 'purchase_receipt_items_product_id_fkey'}, {'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'purchase_receipt_items_company_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'purchase_receipt_items_branch_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\purchase.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\purchase.py)`

### Table: `purchase_receipts`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Procurement & Purchasing
- **Table Type:** `TRANSACTION`
- **Row Count:** `0` rows
- **Columns Count:** `25` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'supplier_id', 'foreign_table': 'suppliers', 'foreign_column': 'id', 'constraint': 'purchase_receipts_supplier_id_fkey'}, {'column': 'order_id', 'foreign_table': 'purchase_orders', 'foreign_column': 'id', 'constraint': 'purchase_receipts_order_id_fkey'}, {'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'purchase_receipts_company_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'purchase_receipts_branch_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\purchase.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\purchase.py)`

### Table: `purchase_reorder_configs`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Inventory & Stock Management
- **Table Type:** `TRANSACTION`
- **Row Count:** `0` rows
- **Columns Count:** `20` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'purchase_reorder_configs_branch_id_fkey'}, {'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'purchase_reorder_configs_company_id_fkey'}, {'column': 'preferred_supplier_id', 'foreign_table': 'suppliers', 'foreign_column': 'id', 'constraint': 'purchase_reorder_configs_preferred_supplier_id_fkey'}, {'column': 'product_id', 'foreign_table': 'products', 'foreign_column': 'id', 'constraint': 'purchase_reorder_configs_product_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\purchase.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\purchase.py)`

### Table: `purchase_requisition_lines`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Procurement & Purchasing
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `23` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'requisition_id', 'foreign_table': 'purchase_requisitions', 'foreign_column': 'id', 'constraint': 'purchase_requisition_lines_requisition_id_fkey'}, {'column': 'product_id', 'foreign_table': 'products', 'foreign_column': 'id', 'constraint': 'purchase_requisition_lines_product_id_fkey'}, {'column': 'preferred_supplier_id', 'foreign_table': 'suppliers', 'foreign_column': 'id', 'constraint': 'purchase_requisition_lines_preferred_supplier_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\purchase.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\purchase.py)`

### Table: `purchase_requisitions`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Procurement & Purchasing
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `28` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[]`
- **Code Model:** `UnknownModel` in `[backend\app\models\purchase.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\purchase.py)`

### Table: `quality_inspection_items`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Catalog & Item Master
- **Table Type:** `MASTER`
- **Row Count:** `0` rows
- **Columns Count:** `25` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'inspection_id', 'foreign_table': 'quality_inspections', 'foreign_column': 'id', 'constraint': 'quality_inspection_items_inspection_id_fkey'}, {'column': 'product_id', 'foreign_table': 'products', 'foreign_column': 'id', 'constraint': 'quality_inspection_items_product_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\purchase.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\purchase.py)`

### Table: `quality_inspections`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** General Platform
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `28` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'receipt_id', 'foreign_table': 'purchase_receipts', 'foreign_column': 'id', 'constraint': 'quality_inspections_receipt_id_fkey'}, {'column': 'supplier_id', 'foreign_table': 'suppliers', 'foreign_column': 'id', 'constraint': 'quality_inspections_supplier_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\purchase.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\purchase.py)`

### Table: `quotation_evaluations`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** General Platform
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `27` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'rfq_id', 'foreign_table': 'procurement_rfqs', 'foreign_column': 'id', 'constraint': 'quotation_evaluations_rfq_id_fkey'}, {'column': 'winning_quotation_id', 'foreign_table': 'vendor_quotations', 'foreign_column': 'id', 'constraint': 'quotation_evaluations_winning_quotation_id_fkey'}, {'column': 'winning_supplier_id', 'foreign_table': 'suppliers', 'foreign_column': 'id', 'constraint': 'quotation_evaluations_winning_supplier_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\purchase.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\purchase.py)`

### Table: `refresh_token_blacklist`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** IAM & Security Governance
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `5` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'user_id', 'foreign_table': 'users', 'foreign_column': 'id', 'constraint': 'refresh_token_blacklist_user_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\auth.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\auth.py)`

### Table: `replenishment_items`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Catalog & Item Master
- **Table Type:** `MASTER`
- **Row Count:** `0` rows
- **Columns Count:** `26` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'replenishment_items_company_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'replenishment_items_branch_id_fkey'}, {'column': 'plan_id', 'foreign_table': 'replenishment_plans', 'foreign_column': 'id', 'constraint': 'replenishment_items_plan_id_fkey'}, {'column': 'product_id', 'foreign_table': 'products', 'foreign_column': 'id', 'constraint': 'replenishment_items_product_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\inventory.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\inventory.py)`

### Table: `replenishment_plans`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Inventory & Stock Management
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `23` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'replenishment_plans_company_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'replenishment_plans_branch_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\inventory.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\inventory.py)`

### Table: `report_builder_queries`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** General Platform
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `10` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[]`
- **Code Model:** `UnknownModel` in `[backend\app\models\analytics_bi.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\analytics_bi.py)`

### Table: `report_schedules`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** General Platform
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `25` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'report_schedules_company_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'report_schedules_branch_id_fkey'}, {'column': 'created_by_id', 'foreign_table': 'users', 'foreign_column': 'id', 'constraint': 'report_schedules_created_by_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\report_schedule.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\report_schedule.py)`

### Table: `requisition_approval_policies`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Workflow & Approval Engine
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `22` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[]`
- **Code Model:** `UnknownModel` in `[backend\app\models\purchase.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\purchase.py)`

### Table: `requisition_approvals`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Workflow & Approval Engine
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `24` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'requisition_id', 'foreign_table': 'purchase_requisitions', 'foreign_column': 'id', 'constraint': 'requisition_approvals_requisition_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\purchase.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\purchase.py)`

### Table: `reservation_ledger_entries`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Inventory & Stock Management
- **Table Type:** `LEDGER`
- **Row Count:** `0` rows
- **Columns Count:** `29` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'reservation_ledger_entries_company_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'reservation_ledger_entries_branch_id_fkey'}, {'column': 'location_id', 'foreign_table': 'inventory_location_nodes', 'foreign_column': 'id', 'constraint': 'reservation_ledger_entries_location_id_fkey'}, {'column': 'product_id', 'foreign_table': 'products', 'foreign_column': 'id', 'constraint': 'reservation_ledger_entries_product_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\inventory_kernel.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\inventory_kernel.py)`

### Table: `roles`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** IAM & Security Governance
- **Table Type:** `MASTER`
- **Row Count:** `0` rows
- **Columns Count:** `20` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'roles_branch_id_fkey'}, {'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'roles_company_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\role.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\role.py)`

### Table: `sales_invoice_items`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Catalog & Item Master
- **Table Type:** `TRANSACTION`
- **Row Count:** `56` rows
- **Columns Count:** `31` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'invoice_id', 'foreign_table': 'sales_invoices', 'foreign_column': 'id', 'constraint': 'sales_invoice_items_invoice_id_fkey'}, {'column': 'product_id', 'foreign_table': 'products', 'foreign_column': 'id', 'constraint': 'sales_invoice_items_product_id_fkey'}, {'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'fk_sales_invoice_items_company_id'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'fk_sales_invoice_items_branch_id'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\sales.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\sales.py)`

### Table: `sales_invoice_payments`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Sales & Retail POS
- **Table Type:** `TRANSACTION`
- **Row Count:** `0` rows
- **Columns Count:** `20` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'sales_invoice_payments_branch_id_fkey'}, {'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'sales_invoice_payments_company_id_fkey'}, {'column': 'invoice_id', 'foreign_table': 'sales_invoices', 'foreign_column': 'id', 'constraint': 'sales_invoice_payments_invoice_id_fkey'}]`
- **Code Model:** *None (No SQLAlchemy ORM mapping in app code)*

### Table: `sales_invoices`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Sales & Retail POS
- **Table Type:** `TRANSACTION`
- **Row Count:** `7` rows
- **Columns Count:** `42` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'customer_id', 'foreign_table': 'customers', 'foreign_column': 'id', 'constraint': 'sales_invoices_customer_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'fk_sales_invoices_branch_id'}, {'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'fk_sales_invoices_company_id'}, {'column': 'shift_id', 'foreign_table': 'shifts', 'foreign_column': 'id', 'constraint': 'sales_invoices_shift_id_fkey'}, {'column': 'order_id', 'foreign_table': 'sales_orders', 'foreign_column': 'id', 'constraint': 'sales_invoices_order_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\sales.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\sales.py)`

### Table: `sales_order_items`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Catalog & Item Master
- **Table Type:** `TRANSACTION`
- **Row Count:** `0` rows
- **Columns Count:** `21` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'order_id', 'foreign_table': 'sales_orders', 'foreign_column': 'id', 'constraint': 'sales_order_items_order_id_fkey'}, {'column': 'product_id', 'foreign_table': 'products', 'foreign_column': 'id', 'constraint': 'sales_order_items_product_id_fkey'}, {'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'fk_sales_order_items_company_id'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'fk_sales_order_items_branch_id'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\sales.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\sales.py)`

### Table: `sales_orders`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Sales & Retail POS
- **Table Type:** `TRANSACTION`
- **Row Count:** `0` rows
- **Columns Count:** `31` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'sales_orders_branch_id_fkey'}, {'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'sales_orders_company_id_fkey'}, {'column': 'customer_id', 'foreign_table': 'customers', 'foreign_column': 'id', 'constraint': 'sales_orders_customer_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\sales.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\sales.py)`

### Table: `sales_payments`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Sales & Retail POS
- **Table Type:** `TRANSACTION`
- **Row Count:** `0` rows
- **Columns Count:** `24` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'sales_payments_company_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'sales_payments_branch_id_fkey'}, {'column': 'invoice_id', 'foreign_table': 'sales_invoices', 'foreign_column': 'id', 'constraint': 'sales_payments_invoice_id_fkey'}, {'column': 'customer_id', 'foreign_table': 'customers', 'foreign_column': 'id', 'constraint': 'sales_payments_customer_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\sales.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\sales.py)`

### Table: `sales_quotation_items`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Catalog & Item Master
- **Table Type:** `MASTER`
- **Row Count:** `0` rows
- **Columns Count:** `17` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'product_id', 'foreign_table': 'products', 'foreign_column': 'id', 'constraint': 'sales_quotation_items_product_id_fkey'}, {'column': 'quotation_id', 'foreign_table': 'sales_quotations', 'foreign_column': 'id', 'constraint': 'sales_quotation_items_quotation_id_fkey'}, {'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'fk_sales_quotation_items_company_id'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'fk_sales_quotation_items_branch_id'}]`
- **Code Model:** `SalesQuotationItem` in `[backend\app\models\sales.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\sales.py)`

### Table: `sales_quotations`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Sales & Retail POS
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `26` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'sales_quotations_branch_id_fkey'}, {'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'sales_quotations_company_id_fkey'}]`
- **Code Model:** `SalesQuotation` in `[backend\app\models\sales.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\sales.py)`

### Table: `sales_return_items`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Catalog & Item Master
- **Table Type:** `MASTER`
- **Row Count:** `0` rows
- **Columns Count:** `31` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'product_id', 'foreign_table': 'products', 'foreign_column': 'id', 'constraint': 'sales_return_items_product_id_fkey'}, {'column': 'return_id', 'foreign_table': 'sales_returns', 'foreign_column': 'id', 'constraint': 'sales_return_items_return_id_fkey'}, {'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'fk_sales_return_items_company_id'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'fk_sales_return_items_branch_id'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\sales.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\sales.py)`

### Table: `sales_returns`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Sales & Retail POS
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `33` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'sales_returns_branch_id_fkey'}, {'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'sales_returns_company_id_fkey'}, {'column': 'original_invoice_id', 'foreign_table': 'sales_invoices', 'foreign_column': 'id', 'constraint': 'sales_returns_original_invoice_id_fkey'}, {'column': 'invoice_id', 'foreign_table': 'sales_invoices', 'foreign_column': 'id', 'constraint': 'sales_returns_invoice_id_fkey'}, {'column': 'customer_id', 'foreign_table': 'customers', 'foreign_column': 'id', 'constraint': 'sales_returns_customer_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\sales.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\sales.py)`

### Table: `scdm_channel_dispatch_lines`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Supply Chain & Channel Distribution (SCDM)
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `25` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'scdm_channel_dispatch_lines_company_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'scdm_channel_dispatch_lines_branch_id_fkey'}, {'column': 'dispatch_id', 'foreign_table': 'scdm_channel_dispatches', 'foreign_column': 'id', 'constraint': 'scdm_channel_dispatch_lines_dispatch_id_fkey'}, {'column': 'product_id', 'foreign_table': 'products', 'foreign_column': 'id', 'constraint': 'scdm_channel_dispatch_lines_product_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\scdm.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\scdm.py)`

### Table: `scdm_channel_dispatches`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Supply Chain & Channel Distribution (SCDM)
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `33` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'invoice_id', 'foreign_table': 'sales_invoices', 'foreign_column': 'id', 'constraint': 'scdm_channel_dispatches_invoice_id_fkey'}, {'column': 'customer_id', 'foreign_table': 'customers', 'foreign_column': 'id', 'constraint': 'scdm_channel_dispatches_customer_id_fkey'}, {'column': 'channel_location_id', 'foreign_table': 'scdm_channel_locations', 'foreign_column': 'id', 'constraint': 'scdm_channel_dispatches_channel_location_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\scdm.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\scdm.py)`

### Table: `scdm_channel_locations`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Supply Chain & Channel Distribution (SCDM)
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `27` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'scdm_channel_locations_company_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'scdm_channel_locations_branch_id_fkey'}, {'column': 'customer_id', 'foreign_table': 'customers', 'foreign_column': 'id', 'constraint': 'scdm_channel_locations_customer_id_fkey'}, {'column': 'parent_id', 'foreign_table': 'scdm_channel_locations', 'foreign_column': 'id', 'constraint': 'scdm_channel_locations_parent_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\scdm.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\scdm.py)`

### Table: `scdm_channel_stock_movements`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Inventory & Stock Management
- **Table Type:** `LEDGER`
- **Row Count:** `0` rows
- **Columns Count:** `34` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'customer_id', 'foreign_table': 'customers', 'foreign_column': 'id', 'constraint': 'scdm_channel_stock_movements_customer_id_fkey'}, {'column': 'channel_location_id', 'foreign_table': 'scdm_channel_locations', 'foreign_column': 'id', 'constraint': 'scdm_channel_stock_movements_channel_location_id_fkey'}, {'column': 'product_id', 'foreign_table': 'products', 'foreign_column': 'id', 'constraint': 'scdm_channel_stock_movements_product_id_fkey'}, {'column': 'dispatch_id', 'foreign_table': 'scdm_channel_dispatches', 'foreign_column': 'id', 'constraint': 'scdm_channel_stock_movements_dispatch_id_fkey'}, {'column': 'sellout_import_id', 'foreign_table': 'scdm_sellout_imports', 'foreign_column': 'id', 'constraint': 'fk_scdm_movement_sellout_import'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\scdm.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\scdm.py)`

### Table: `scdm_claim_types`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Supply Chain & Channel Distribution (SCDM)
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `12` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[]`
- **Code Model:** `UnknownModel` in `[backend\app\models\scdm_settlement.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\scdm_settlement.py)`

### Table: `scdm_claims`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Supply Chain & Channel Distribution (SCDM)
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `22` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'customer_id', 'foreign_table': 'customers', 'foreign_column': 'id', 'constraint': 'scdm_claims_customer_id_fkey'}, {'column': 'dispatch_id', 'foreign_table': 'scdm_channel_dispatches', 'foreign_column': 'id', 'constraint': 'scdm_claims_dispatch_id_fkey'}, {'column': 'claim_type_id', 'foreign_table': 'scdm_claim_types', 'foreign_column': 'id', 'constraint': 'scdm_claims_claim_type_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\scdm_settlement.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\scdm_settlement.py)`

### Table: `scdm_sellout_import_lines`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Supply Chain & Channel Distribution (SCDM)
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `18` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'import_id', 'foreign_table': 'scdm_sellout_imports', 'foreign_column': 'id', 'constraint': 'scdm_sellout_import_lines_import_id_fkey'}, {'column': 'product_id', 'foreign_table': 'products', 'foreign_column': 'id', 'constraint': 'scdm_sellout_import_lines_product_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\scdm.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\scdm.py)`

### Table: `scdm_sellout_imports`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Supply Chain & Channel Distribution (SCDM)
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `34` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'customer_id', 'foreign_table': 'customers', 'foreign_column': 'id', 'constraint': 'scdm_sellout_imports_customer_id_fkey'}, {'column': 'channel_location_id', 'foreign_table': 'scdm_channel_locations', 'foreign_column': 'id', 'constraint': 'scdm_sellout_imports_channel_location_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\scdm.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\scdm.py)`

### Table: `scdm_settlement_lines`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Financial Accounting & Tax
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `8` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'settlement_id', 'foreign_table': 'scdm_settlements', 'foreign_column': 'id', 'constraint': 'scdm_settlement_lines_settlement_id_fkey'}, {'column': 'dispatch_id', 'foreign_table': 'scdm_channel_dispatches', 'foreign_column': 'id', 'constraint': 'scdm_settlement_lines_dispatch_id_fkey'}, {'column': 'claim_id', 'foreign_table': 'scdm_claims', 'foreign_column': 'id', 'constraint': 'scdm_settlement_lines_claim_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\scdm_settlement.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\scdm_settlement.py)`

### Table: `scdm_settlements`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Financial Accounting & Tax
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `18` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'customer_id', 'foreign_table': 'customers', 'foreign_column': 'id', 'constraint': 'scdm_settlements_customer_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\scdm_settlement.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\scdm_settlement.py)`

### Table: `screen_layout_templates`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Platform Configuration & System
- **Table Type:** `CONFIGURATION`
- **Row Count:** `0` rows
- **Columns Count:** `24` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'screen_layout_templates_company_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'screen_layout_templates_branch_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\screen_studio.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\screen_studio.py)`

### Table: `shifts`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** General Platform
- **Table Type:** `TRANSACTION`
- **Row Count:** `0` rows
- **Columns Count:** `31` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'register_id', 'foreign_table': 'cash_registers', 'foreign_column': 'id', 'constraint': 'shifts_register_id_fkey'}, {'column': 'cashier_id', 'foreign_table': 'users', 'foreign_column': 'id', 'constraint': 'shifts_cashier_id_fkey'}, {'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'shifts_company_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'shifts_branch_id_fkey'}]`
- **Code Model:** *None (No SQLAlchemy ORM mapping in app code)*

### Table: `shipment_packages`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** General Platform
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `25` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'order_id', 'foreign_table': 'sales_orders', 'foreign_column': 'id', 'constraint': 'shipment_packages_order_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\sales.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\sales.py)`

### Table: `size_conversions`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Catalog & Item Master
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `19` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'size_value_id', 'foreign_table': 'size_values', 'foreign_column': 'id', 'constraint': 'size_conversions_size_value_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\size_master.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\size_master.py)`

### Table: `size_scales`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Catalog & Item Master
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `23` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[]`
- **Code Model:** `UnknownModel` in `[backend\app\models\size_master.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\size_master.py)`

### Table: `size_values`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Catalog & Item Master
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `19` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'size_scale_id', 'foreign_table': 'size_scales', 'foreign_column': 'id', 'constraint': 'size_values_size_scale_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\size_master.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\size_master.py)`

### Table: `smriti_addresses`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** General Platform
- **Table Type:** `LIVE_GOVERNANCE`
- **Row Count:** `0` rows
- **Columns Count:** `30` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'entity_id', 'foreign_table': 'smriti_entity_registry', 'foreign_column': 'id', 'constraint': 'smriti_addresses_entity_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\foundation.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\foundation.py)`

### Table: `smriti_api_key_logs`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** IAM & Security Governance
- **Table Type:** `LIVE_GOVERNANCE`
- **Row Count:** `0` rows
- **Columns Count:** `22` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'api_key_id', 'foreign_table': 'smriti_api_keys', 'foreign_column': 'id', 'constraint': 'smriti_api_key_logs_api_key_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\api_key.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\api_key.py)`

### Table: `smriti_api_key_permission_sets`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** IAM & Security Governance
- **Table Type:** `LIVE_GOVERNANCE`
- **Row Count:** `0` rows
- **Columns Count:** `18` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'api_key_id', 'foreign_table': 'smriti_api_keys', 'foreign_column': 'id', 'constraint': 'smriti_api_key_permission_sets_api_key_id_fkey'}, {'column': 'permission_set_id', 'foreign_table': 'smriti_permission_sets', 'foreign_column': 'id', 'constraint': 'smriti_api_key_permission_sets_permission_set_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\api_key.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\api_key.py)`

### Table: `smriti_api_keys`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** IAM & Security Governance
- **Table Type:** `LIVE_GOVERNANCE`
- **Row Count:** `0` rows
- **Columns Count:** `24` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'service_account_id', 'foreign_table': 'smriti_service_accounts', 'foreign_column': 'id', 'constraint': 'smriti_api_keys_service_account_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\api_key.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\api_key.py)`

### Table: `smriti_approval_actions`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Workflow & Approval Engine
- **Table Type:** `LIVE_GOVERNANCE`
- **Row Count:** `0` rows
- **Columns Count:** `24` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'request_id', 'foreign_table': 'smriti_approval_requests', 'foreign_column': 'id', 'constraint': 'smriti_approval_actions_request_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\approval.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\approval.py)`

### Table: `smriti_approval_assignments`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** IAM & Security Governance
- **Table Type:** `LIVE_GOVERNANCE`
- **Row Count:** `0` rows
- **Columns Count:** `19` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'step_id', 'foreign_table': 'smriti_approval_steps', 'foreign_column': 'id', 'constraint': 'smriti_approval_assignments_step_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\approval.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\approval.py)`

### Table: `smriti_approval_comments`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Workflow & Approval Engine
- **Table Type:** `LIVE_GOVERNANCE`
- **Row Count:** `0` rows
- **Columns Count:** `20` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'request_id', 'foreign_table': 'smriti_approval_requests', 'foreign_column': 'id', 'constraint': 'smriti_approval_comments_request_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\approval.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\approval.py)`

### Table: `smriti_approval_conditions`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Workflow & Approval Engine
- **Table Type:** `LIVE_GOVERNANCE`
- **Row Count:** `0` rows
- **Columns Count:** `18` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'step_id', 'foreign_table': 'smriti_approval_steps', 'foreign_column': 'id', 'constraint': 'smriti_approval_conditions_step_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\approval.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\approval.py)`

### Table: `smriti_approval_delegations`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Workflow & Approval Engine
- **Table Type:** `LIVE_GOVERNANCE`
- **Row Count:** `0` rows
- **Columns Count:** `21` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[]`
- **Code Model:** `UnknownModel` in `[backend\app\models\approval.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\approval.py)`

### Table: `smriti_approval_escalations`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Workflow & Approval Engine
- **Table Type:** `LIVE_GOVERNANCE`
- **Row Count:** `0` rows
- **Columns Count:** `21` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'request_id', 'foreign_table': 'smriti_approval_requests', 'foreign_column': 'id', 'constraint': 'smriti_approval_escalations_request_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\approval.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\approval.py)`

### Table: `smriti_approval_histories`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Workflow & Approval Engine
- **Table Type:** `LIVE_GOVERNANCE`
- **Row Count:** `0` rows
- **Columns Count:** `21` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'request_id', 'foreign_table': 'smriti_approval_requests', 'foreign_column': 'id', 'constraint': 'smriti_approval_histories_request_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\approval.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\approval.py)`

### Table: `smriti_approval_matrices`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Workflow & Approval Engine
- **Table Type:** `LIVE_GOVERNANCE`
- **Row Count:** `0` rows
- **Columns Count:** `20` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'policy_id', 'foreign_table': 'smriti_approval_policies', 'foreign_column': 'id', 'constraint': 'smriti_approval_matrices_policy_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\approval.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\approval.py)`

### Table: `smriti_approval_outbox`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Workflow & Approval Engine
- **Table Type:** `LIVE_GOVERNANCE`
- **Row Count:** `0` rows
- **Columns Count:** `21` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[]`
- **Code Model:** `UnknownModel` in `[backend\app\models\approval.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\approval.py)`

### Table: `smriti_approval_policies`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Workflow & Approval Engine
- **Table Type:** `LIVE_GOVERNANCE`
- **Row Count:** `0` rows
- **Columns Count:** `26` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[]`
- **Code Model:** `UnknownModel` in `[backend\app\models\approval.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\approval.py)`

### Table: `smriti_approval_requests`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Workflow & Approval Engine
- **Table Type:** `LIVE_GOVERNANCE`
- **Row Count:** `0` rows
- **Columns Count:** `24` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[]`
- **Code Model:** `UnknownModel` in `[backend\app\models\approval.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\approval.py)`

### Table: `smriti_approval_steps`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Workflow & Approval Engine
- **Table Type:** `LIVE_GOVERNANCE`
- **Row Count:** `0` rows
- **Columns Count:** `22` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'matrix_id', 'foreign_table': 'smriti_approval_matrices', 'foreign_column': 'id', 'constraint': 'smriti_approval_steps_matrix_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\approval.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\approval.py)`

### Table: `smriti_audit_log`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Audit, Compliance & SRE
- **Table Type:** `LIVE_GOVERNANCE`
- **Row Count:** `0` rows
- **Columns Count:** `20` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[]`
- **Code Model:** `UnknownModel` in `[backend\app\models\foundation.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\foundation.py)`

### Table: `smriti_bank_accounts`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Financial Accounting & Tax
- **Table Type:** `LIVE_GOVERNANCE`
- **Row Count:** `0` rows
- **Columns Count:** `19` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'entity_id', 'foreign_table': 'smriti_entity_registry', 'foreign_column': 'id', 'constraint': 'smriti_bank_accounts_entity_id_fkey'}, {'column': 'bank_id', 'foreign_table': 'smriti_banks', 'foreign_column': 'id', 'constraint': 'smriti_bank_accounts_bank_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\foundation.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\foundation.py)`

### Table: `smriti_banks`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** General Platform
- **Table Type:** `LIVE_GOVERNANCE`
- **Row Count:** `20` rows
- **Columns Count:** `9` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[]`
- **Code Model:** `UnknownModel` in `[backend\app\models\foundation.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\foundation.py)`

### Table: `smriti_branding`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Catalog & Item Master
- **Table Type:** `LIVE_GOVERNANCE`
- **Row Count:** `0` rows
- **Columns Count:** `11` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'smriti_branding_company_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\foundation.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\foundation.py)`

### Table: `smriti_comm_channels`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Supply Chain & Channel Distribution (SCDM)
- **Table Type:** `LIVE_GOVERNANCE`
- **Row Count:** `0` rows
- **Columns Count:** `22` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'smriti_comm_channels_company_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\foundation.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\foundation.py)`

### Table: `smriti_contacts`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** General Platform
- **Table Type:** `LIVE_GOVERNANCE`
- **Row Count:** `0` rows
- **Columns Count:** `24` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'entity_id', 'foreign_table': 'smriti_entity_registry', 'foreign_column': 'id', 'constraint': 'smriti_contacts_entity_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\foundation.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\foundation.py)`

### Table: `smriti_entity_registry`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** General Platform
- **Table Type:** `LIVE_GOVERNANCE`
- **Row Count:** `0` rows
- **Columns Count:** `9` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[]`
- **Code Model:** `UnknownModel` in `[backend\app\models\foundation.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\foundation.py)`

### Table: `smriti_field_security_masks`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** General Platform
- **Table Type:** `LIVE_GOVERNANCE`
- **Row Count:** `0` rows
- **Columns Count:** `12` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'role_id', 'foreign_table': 'smriti_roles', 'foreign_column': 'id', 'constraint': 'smriti_field_security_masks_role_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\security.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\security.py)`

### Table: `smriti_identity_outbox`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** General Platform
- **Table Type:** `LIVE_GOVERNANCE`
- **Row Count:** `0` rows
- **Columns Count:** `24` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'smriti_identity_outbox_company_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'smriti_identity_outbox_branch_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\sip.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\sip.py)`

### Table: `smriti_identity_rule_versions`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** IAM & Security Governance
- **Table Type:** `LIVE_GOVERNANCE`
- **Row Count:** `0` rows
- **Columns Count:** `20` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'rule_id', 'foreign_table': 'smriti_identity_rules', 'foreign_column': 'id', 'constraint': 'smriti_identity_rule_versions_rule_id_fkey'}, {'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'smriti_identity_rule_versions_company_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'smriti_identity_rule_versions_branch_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\sip.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\sip.py)`

### Table: `smriti_identity_rules`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** IAM & Security Governance
- **Table Type:** `LIVE_GOVERNANCE`
- **Row Count:** `0` rows
- **Columns Count:** `24` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'smriti_identity_rules_company_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'smriti_identity_rules_branch_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\sip.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\sip.py)`

### Table: `smriti_menus`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** General Platform
- **Table Type:** `LIVE_GOVERNANCE`
- **Row Count:** `4` rows
- **Columns Count:** `25` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'smriti_menus_company_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'smriti_menus_branch_id_fkey'}, {'column': 'parent_id', 'foreign_table': 'smriti_menus', 'foreign_column': 'id', 'constraint': 'smriti_menus_parent_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\security.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\security.py)`

### Table: `smriti_permission_set_permissions`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** IAM & Security Governance
- **Table Type:** `LIVE_GOVERNANCE`
- **Row Count:** `46` rows
- **Columns Count:** `19` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'smriti_policy_permissions_company_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'smriti_policy_permissions_branch_id_fkey'}, {'column': 'permission_set_id', 'foreign_table': 'smriti_permission_sets', 'foreign_column': 'id', 'constraint': 'smriti_policy_permissions_policy_id_fkey'}, {'column': 'permission_id', 'foreign_table': 'smriti_permissions', 'foreign_column': 'id', 'constraint': 'smriti_policy_permissions_permission_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\security.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\security.py)`

### Table: `smriti_permission_sets`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** IAM & Security Governance
- **Table Type:** `LIVE_GOVERNANCE`
- **Row Count:** `8` rows
- **Columns Count:** `19` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'smriti_policies_company_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'smriti_policies_branch_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\security.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\security.py)`

### Table: `smriti_permissions`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** IAM & Security Governance
- **Table Type:** `LIVE_GOVERNANCE`
- **Row Count:** `60` rows
- **Columns Count:** `22` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'smriti_permissions_company_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'smriti_permissions_branch_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\security.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\security.py)`

### Table: `smriti_report_templates`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Platform Configuration & System
- **Table Type:** `LIVE_GOVERNANCE`
- **Row Count:** `0` rows
- **Columns Count:** `10` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'smriti_report_templates_company_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\foundation.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\foundation.py)`

### Table: `smriti_role_permission_sets`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** IAM & Security Governance
- **Table Type:** `LIVE_GOVERNANCE`
- **Row Count:** `40` rows
- **Columns Count:** `18` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'smriti_role_policies_company_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'smriti_role_policies_branch_id_fkey'}, {'column': 'role_id', 'foreign_table': 'smriti_roles', 'foreign_column': 'id', 'constraint': 'smriti_role_policies_role_id_fkey'}, {'column': 'permission_set_id', 'foreign_table': 'smriti_permission_sets', 'foreign_column': 'id', 'constraint': 'smriti_role_policies_policy_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\security.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\security.py)`

### Table: `smriti_roles`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** IAM & Security Governance
- **Table Type:** `LIVE_GOVERNANCE`
- **Row Count:** `11` rows
- **Columns Count:** `21` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'smriti_roles_company_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'smriti_roles_branch_id_fkey'}, {'column': 'parent_role_id', 'foreign_table': 'smriti_roles', 'foreign_column': 'id', 'constraint': 'smriti_roles_parent_role_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\security.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\security.py)`

### Table: `smriti_security_audits`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Audit, Compliance & SRE
- **Table Type:** `LIVE_GOVERNANCE`
- **Row Count:** `0` rows
- **Columns Count:** `24` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'smriti_security_audits_company_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'smriti_security_audits_branch_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\security.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\security.py)`

### Table: `smriti_security_policies`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** General Platform
- **Table Type:** `LIVE_GOVERNANCE`
- **Row Count:** `0` rows
- **Columns Count:** `14` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[]`
- **Code Model:** `UnknownModel` in `[backend\app\models\security.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\security.py)`

### Table: `smriti_service_accounts`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Financial Accounting & Tax
- **Table Type:** `LIVE_GOVERNANCE`
- **Row Count:** `0` rows
- **Columns Count:** `19` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[]`
- **Code Model:** `UnknownModel` in `[backend\app\models\api_key.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\api_key.py)`

### Table: `smriti_settings`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Platform Configuration & System
- **Table Type:** `LIVE_GOVERNANCE`
- **Row Count:** `0` rows
- **Columns Count:** `20` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[]`
- **Code Model:** `UnknownModel` in `[backend\app\models\foundation.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\foundation.py)`

### Table: `smriti_social_profiles`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** General Platform
- **Table Type:** `LIVE_GOVERNANCE`
- **Row Count:** `0` rows
- **Columns Count:** `8` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'smriti_social_profiles_company_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\foundation.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\foundation.py)`

### Table: `smriti_theme_variants`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** General Platform
- **Table Type:** `LIVE_GOVERNANCE`
- **Row Count:** `0` rows
- **Columns Count:** `16` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'theme_id', 'foreign_table': 'smriti_themes', 'foreign_column': 'id', 'constraint': 'smriti_theme_variants_theme_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\foundation.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\foundation.py)`

### Table: `smriti_themes`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** General Platform
- **Table Type:** `LIVE_GOVERNANCE`
- **Row Count:** `0` rows
- **Columns Count:** `12` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'smriti_themes_company_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\foundation.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\foundation.py)`

### Table: `smriti_universal_identities`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** General Platform
- **Table Type:** `LIVE_GOVERNANCE`
- **Row Count:** `0` rows
- **Columns Count:** `32` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'rule_id', 'foreign_table': 'smriti_identity_rules', 'foreign_column': 'id', 'constraint': 'smriti_universal_identities_rule_id_fkey'}, {'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'smriti_universal_identities_company_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'smriti_universal_identities_branch_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\sip.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\sip.py)`

### Table: `smriti_user_assignments`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** IAM & Security Governance
- **Table Type:** `LIVE_GOVERNANCE`
- **Row Count:** `0` rows
- **Columns Count:** `23` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'user_id', 'foreign_table': 'users', 'foreign_column': 'id', 'constraint': 'smriti_user_assignments_user_id_fkey'}, {'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'smriti_user_assignments_company_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'smriti_user_assignments_branch_id_fkey'}, {'column': 'role_id', 'foreign_table': 'smriti_roles', 'foreign_column': 'id', 'constraint': 'smriti_user_assignments_role_id_fkey'}, {'column': 'permission_set_id', 'foreign_table': 'smriti_permission_sets', 'foreign_column': 'id', 'constraint': 'smriti_user_assignments_permission_set_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\security.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\security.py)`

### Table: `smriti_user_roles`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** IAM & Security Governance
- **Table Type:** `LIVE_GOVERNANCE`
- **Row Count:** `3` rows
- **Columns Count:** `18` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'smriti_user_roles_company_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'smriti_user_roles_branch_id_fkey'}, {'column': 'user_id', 'foreign_table': 'users', 'foreign_column': 'id', 'constraint': 'smriti_user_roles_user_id_fkey'}, {'column': 'role_id', 'foreign_table': 'smriti_roles', 'foreign_column': 'id', 'constraint': 'smriti_user_roles_role_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\security.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\security.py)`

### Table: `smriti_workspace_profiles`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** General Platform
- **Table Type:** `LIVE_GOVERNANCE`
- **Row Count:** `0` rows
- **Columns Count:** `16` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[]`
- **Code Model:** `UnknownModel` in `[backend\app\models\security.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\security.py)`

### Table: `sre_compliance_decisions`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Audit, Compliance & SRE
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `22` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'sre_compliance_decisions_company_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'sre_compliance_decisions_branch_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\sre.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\sre.py)`

### Table: `sre_rule_engine`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Audit, Compliance & SRE
- **Table Type:** `CONFIGURATION`
- **Row Count:** `0` rows
- **Columns Count:** `21` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'sre_rule_engine_company_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'sre_rule_engine_branch_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\sre.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\sre.py)`

### Table: `sre_statutory_ledger`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Financial Accounting & Tax
- **Table Type:** `LEDGER`
- **Row Count:** `0` rows
- **Columns Count:** `31` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'sre_statutory_ledger_company_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'sre_statutory_ledger_branch_id_fkey'}, {'column': 'origin_gstin_id', 'foreign_table': 'corporate_gstin_registry', 'foreign_column': 'id', 'constraint': 'sre_statutory_ledger_origin_gstin_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\sre.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\sre.py)`

### Table: `stock_adjustments`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Inventory & Stock Management
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `24` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'stock_adjustments_company_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'stock_adjustments_branch_id_fkey'}, {'column': 'count_id', 'foreign_table': 'stock_counts', 'foreign_column': 'id', 'constraint': 'stock_adjustments_count_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\inventory.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\inventory.py)`

### Table: `stock_bin_assignments`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** IAM & Security Governance
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `11` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'bin_id', 'foreign_table': 'warehouse_bins', 'foreign_column': 'id', 'constraint': 'stock_bin_assignments_bin_id_fkey'}, {'column': 'product_id', 'foreign_table': 'products', 'foreign_column': 'id', 'constraint': 'stock_bin_assignments_product_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\wms.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\wms.py)`

### Table: `stock_count_items`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Catalog & Item Master
- **Table Type:** `TRANSACTION`
- **Row Count:** `0` rows
- **Columns Count:** `25` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'stock_count_items_company_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'stock_count_items_branch_id_fkey'}, {'column': 'count_id', 'foreign_table': 'stock_counts', 'foreign_column': 'id', 'constraint': 'stock_count_items_count_id_fkey'}, {'column': 'product_id', 'foreign_table': 'products', 'foreign_column': 'id', 'constraint': 'stock_count_items_product_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\inventory.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\inventory.py)`

### Table: `stock_counts`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Inventory & Stock Management
- **Table Type:** `TRANSACTION`
- **Row Count:** `0` rows
- **Columns Count:** `26` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'stock_counts_company_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'stock_counts_branch_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\inventory.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\inventory.py)`

### Table: `stock_dispatch_lines`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Inventory & Stock Management
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `28` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'stock_dispatch_lines_company_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'stock_dispatch_lines_branch_id_fkey'}, {'column': 'dispatch_id', 'foreign_table': 'stock_dispatches', 'foreign_column': 'id', 'constraint': 'stock_dispatch_lines_dispatch_id_fkey'}, {'column': 'product_id', 'foreign_table': 'products', 'foreign_column': 'id', 'constraint': 'stock_dispatch_lines_product_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\dispatch.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\dispatch.py)`

### Table: `stock_dispatches`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Inventory & Stock Management
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `25` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'stock_dispatches_company_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'stock_dispatches_branch_id_fkey'}, {'column': 'partner_id', 'foreign_table': 'consignment_partners', 'foreign_column': 'id', 'constraint': 'stock_dispatches_partner_id_fkey'}, {'column': 'invoice_id', 'foreign_table': 'sales_invoices', 'foreign_column': 'id', 'constraint': 'stock_dispatches_invoice_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\dispatch.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\dispatch.py)`

### Table: `stock_movements`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Inventory & Stock Management
- **Table Type:** `LEDGER`
- **Row Count:** `9` rows
- **Columns Count:** `34` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'stock_movements_branch_id_fkey'}, {'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'stock_movements_company_id_fkey'}, {'column': 'product_id', 'foreign_table': 'products', 'foreign_column': 'id', 'constraint': 'stock_movements_product_id_fkey'}]`
- **Code Model:** `StockMovement` in `[backend\app\models\inventory.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\inventory.py)`

### Table: `stock_rebalancing_recommendations`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Inventory & Stock Management
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `27` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'product_id', 'foreign_table': 'products', 'foreign_column': 'id', 'constraint': 'stock_rebalancing_recommendations_product_id_fkey'}, {'column': 'transfer_order_id', 'foreign_table': 'stock_transfer_orders', 'foreign_column': 'id', 'constraint': 'stock_rebalancing_recommendations_transfer_order_id_fkey'}, {'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'stock_rebalancing_recommendations_company_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'stock_rebalancing_recommendations_branch_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\transfer.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\transfer.py)`

### Table: `stock_transfer_items`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Catalog & Item Master
- **Table Type:** `TRANSACTION`
- **Row Count:** `0` rows
- **Columns Count:** `24` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'stock_transfer_items_company_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'stock_transfer_items_branch_id_fkey'}, {'column': 'transfer_id', 'foreign_table': 'stock_transfers', 'foreign_column': 'id', 'constraint': 'stock_transfer_items_transfer_id_fkey'}, {'column': 'product_id', 'foreign_table': 'products', 'foreign_column': 'id', 'constraint': 'stock_transfer_items_product_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\inventory.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\inventory.py)`

### Table: `stock_transfer_order_items`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Catalog & Item Master
- **Table Type:** `TRANSACTION`
- **Row Count:** `0` rows
- **Columns Count:** `27` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'transfer_order_id', 'foreign_table': 'stock_transfer_orders', 'foreign_column': 'id', 'constraint': 'stock_transfer_order_items_transfer_order_id_fkey'}, {'column': 'product_id', 'foreign_table': 'products', 'foreign_column': 'id', 'constraint': 'stock_transfer_order_items_product_id_fkey'}, {'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'stock_transfer_order_items_company_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'stock_transfer_order_items_branch_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\transfer.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\transfer.py)`

### Table: `stock_transfer_orders`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Inventory & Stock Management
- **Table Type:** `TRANSACTION`
- **Row Count:** `0` rows
- **Columns Count:** `35` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'stock_transfer_orders_company_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'stock_transfer_orders_branch_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\transfer.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\transfer.py)`

### Table: `stock_transfer_shipments`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Inventory & Stock Management
- **Table Type:** `TRANSACTION`
- **Row Count:** `0` rows
- **Columns Count:** `24` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'stock_transfer_shipments_company_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'stock_transfer_shipments_branch_id_fkey'}, {'column': 'transfer_id', 'foreign_table': 'stock_transfers', 'foreign_column': 'id', 'constraint': 'stock_transfer_shipments_transfer_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\inventory.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\inventory.py)`

### Table: `stock_transfers`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Inventory & Stock Management
- **Table Type:** `TRANSACTION`
- **Row Count:** `0` rows
- **Columns Count:** `26` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'stock_transfers_company_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'stock_transfers_branch_id_fkey'}, {'column': 'source_branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'stock_transfers_source_branch_id_fkey'}, {'column': 'destination_branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'stock_transfers_destination_branch_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\inventory.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\inventory.py)`

### Table: `stores`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Inventory & Stock Management
- **Table Type:** `MASTER`
- **Row Count:** `0` rows
- **Columns Count:** `20` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'stores_branch_id_fkey'}, {'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'stores_company_id_fkey'}]`
- **Code Model:** `Store` in `[backend\app\models\inventory.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\inventory.py)`

### Table: `supplier_addresses`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Procurement & Purchasing
- **Table Type:** `MASTER`
- **Row Count:** `0` rows
- **Columns Count:** `29` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'supplier_id', 'foreign_table': 'suppliers', 'foreign_column': 'id', 'constraint': 'supplier_addresses_supplier_id_fkey'}]`
- **Code Model:** `SupplierAddress` in `[backend\app\models\purchase.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\purchase.py)`

### Table: `supplier_bank_details`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Procurement & Purchasing
- **Table Type:** `MASTER`
- **Row Count:** `0` rows
- **Columns Count:** `24` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'supplier_id', 'foreign_table': 'suppliers', 'foreign_column': 'id', 'constraint': 'supplier_bank_details_supplier_id_fkey'}]`
- **Code Model:** `SupplierBankDetails` in `[backend\app\models\purchase.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\purchase.py)`

### Table: `supplier_compliance_profiles`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Procurement & Purchasing
- **Table Type:** `CONFIGURATION`
- **Row Count:** `0` rows
- **Columns Count:** `25` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'supplier_id', 'foreign_table': 'suppliers', 'foreign_column': 'id', 'constraint': 'supplier_compliance_profiles_supplier_id_fkey'}]`
- **Code Model:** `SupplierComplianceProfile` in `[backend\app\models\purchase.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\purchase.py)`

### Table: `supplier_contacts`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Procurement & Purchasing
- **Table Type:** `MASTER`
- **Row Count:** `0` rows
- **Columns Count:** `23` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'supplier_id', 'foreign_table': 'suppliers', 'foreign_column': 'id', 'constraint': 'supplier_contacts_supplier_id_fkey'}]`
- **Code Model:** `SupplierContact` in `[backend\app\models\purchase.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\purchase.py)`

### Table: `supplier_credit_profiles`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Procurement & Purchasing
- **Table Type:** `CONFIGURATION`
- **Row Count:** `0` rows
- **Columns Count:** `21` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'supplier_id', 'foreign_table': 'suppliers', 'foreign_column': 'id', 'constraint': 'supplier_credit_profiles_supplier_id_fkey'}]`
- **Code Model:** `SupplierCreditProfile` in `[backend\app\models\purchase.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\purchase.py)`

### Table: `supplier_debit_notes`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Procurement & Purchasing
- **Table Type:** `MASTER`
- **Row Count:** `0` rows
- **Columns Count:** `25` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'supplier_id', 'foreign_table': 'suppliers', 'foreign_column': 'id', 'constraint': 'supplier_debit_notes_supplier_id_fkey'}, {'column': 'receipt_id', 'foreign_table': 'purchase_receipts', 'foreign_column': 'id', 'constraint': 'supplier_debit_notes_receipt_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\purchase.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\purchase.py)`

### Table: `supplier_documents`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Procurement & Purchasing
- **Table Type:** `MASTER`
- **Row Count:** `0` rows
- **Columns Count:** `22` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'supplier_id', 'foreign_table': 'suppliers', 'foreign_column': 'id', 'constraint': 'supplier_documents_supplier_id_fkey'}]`
- **Code Model:** `SupplierDocument` in `[backend\app\models\purchase.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\purchase.py)`

### Table: `supplier_gst_registrations`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Procurement & Purchasing
- **Table Type:** `MASTER`
- **Row Count:** `0` rows
- **Columns Count:** `22` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'supplier_id', 'foreign_table': 'suppliers', 'foreign_column': 'id', 'constraint': 'supplier_gst_registrations_supplier_id_fkey'}]`
- **Code Model:** `SupplierGSTRegistration` in `[backend\app\models\purchase.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\purchase.py)`

### Table: `supplier_logistics`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Procurement & Purchasing
- **Table Type:** `AUDIT`
- **Row Count:** `0` rows
- **Columns Count:** `23` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'supplier_id', 'foreign_table': 'suppliers', 'foreign_column': 'id', 'constraint': 'supplier_logistics_supplier_id_fkey'}]`
- **Code Model:** `SupplierLogistics` in `[backend\app\models\purchase.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\purchase.py)`

### Table: `supplier_payment_profiles`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Procurement & Purchasing
- **Table Type:** `TRANSACTION`
- **Row Count:** `0` rows
- **Columns Count:** `21` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'supplier_id', 'foreign_table': 'suppliers', 'foreign_column': 'id', 'constraint': 'supplier_payment_profiles_supplier_id_fkey'}]`
- **Code Model:** `SupplierPaymentProfile` in `[backend\app\models\purchase.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\purchase.py)`

### Table: `supplier_payments`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Procurement & Purchasing
- **Table Type:** `TRANSACTION`
- **Row Count:** `0` rows
- **Columns Count:** `22` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'supplier_id', 'foreign_table': 'suppliers', 'foreign_column': 'id', 'constraint': 'supplier_payments_supplier_id_fkey'}, {'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'supplier_payments_company_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'supplier_payments_branch_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\supplier_payment.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\supplier_payment.py)`

### Table: `supplier_scorecard_metrics`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Procurement & Purchasing
- **Table Type:** `MASTER`
- **Row Count:** `0` rows
- **Columns Count:** `22` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'scorecard_id', 'foreign_table': 'supplier_scorecards', 'foreign_column': 'id', 'constraint': 'supplier_scorecard_metrics_scorecard_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\purchase.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\purchase.py)`

### Table: `supplier_scorecards`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Procurement & Purchasing
- **Table Type:** `MASTER`
- **Row Count:** `0` rows
- **Columns Count:** `27` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'supplier_id', 'foreign_table': 'suppliers', 'foreign_column': 'id', 'constraint': 'supplier_scorecards_supplier_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\purchase.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\purchase.py)`

### Table: `supplier_tax_profiles`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Procurement & Purchasing
- **Table Type:** `CONFIGURATION`
- **Row Count:** `0` rows
- **Columns Count:** `24` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'supplier_id', 'foreign_table': 'suppliers', 'foreign_column': 'id', 'constraint': 'supplier_tax_profiles_supplier_id_fkey'}]`
- **Code Model:** `SupplierTaxProfile` in `[backend\app\models\purchase.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\purchase.py)`

### Table: `suppliers`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Procurement & Purchasing
- **Table Type:** `MASTER`
- **Row Count:** `0` rows
- **Columns Count:** `50` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'suppliers_company_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'suppliers_branch_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\purchase.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\purchase.py)`

### Table: `sync_queue`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** General Platform
- **Table Type:** `INTEGRATION`
- **Row Count:** `0` rows
- **Columns Count:** `15` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[]`
- **Code Model:** *None (No SQLAlchemy ORM mapping in app code)*

### Table: `system_bootstrap_states`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Platform Configuration & System
- **Table Type:** `REFERENCE`
- **Row Count:** `6` rows
- **Columns Count:** `24` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[]`
- **Code Model:** `UnknownModel` in `[backend\app\models\system.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\system.py)`

### Table: `system_configs`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Platform Configuration & System
- **Table Type:** `CONFIGURATION`
- **Row Count:** `1` rows
- **Columns Count:** `19` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'system_configs_branch_id_fkey'}, {'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'system_configs_company_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\system.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\system.py)`

### Table: `tally_configs`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Platform Configuration & System
- **Table Type:** `CONFIGURATION`
- **Row Count:** `0` rows
- **Columns Count:** `19` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'tally_configs_company_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'tally_configs_branch_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\system.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\system.py)`

### Table: `tds_entries`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** General Platform
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `20` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[]`
- **Code Model:** `UnknownModel` in `[backend\app\models\accounting.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\accounting.py)`

### Table: `tenant_provision_journals`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** IAM & Security Governance
- **Table Type:** `LEDGER`
- **Row Count:** `0` rows
- **Columns Count:** `10` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'tenant_id', 'foreign_table': 'tenants', 'foreign_column': 'id', 'constraint': 'tenant_provision_journals_tenant_id_fkey'}]`
- **Code Model:** `TenantProvisionJournal` in `[backend\app\models\tenant.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\tenant.py)`

### Table: `tenant_provision_profiles`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** IAM & Security Governance
- **Table Type:** `CONFIGURATION`
- **Row Count:** `0` rows
- **Columns Count:** `12` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'tenant_id', 'foreign_table': 'tenants', 'foreign_column': 'id', 'constraint': 'tenant_provision_profiles_tenant_id_fkey'}]`
- **Code Model:** `TenantProvisionProfile` in `[backend\app\models\tenant.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\tenant.py)`

### Table: `tenant_settings`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** IAM & Security Governance
- **Table Type:** `CONFIGURATION`
- **Row Count:** `0` rows
- **Columns Count:** `14` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'tenant_id', 'foreign_table': 'tenants', 'foreign_column': 'id', 'constraint': 'tenant_settings_tenant_id_fkey'}]`
- **Code Model:** `TenantSettings` in `[backend\app\models\tenant.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\tenant.py)`

### Table: `tenants`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** IAM & Security Governance
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `10` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[]`
- **Code Model:** `Tenant` in `[backend\app\models\tenant.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\tenant.py)`

### Table: `terms_clauses`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** General Platform
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `24` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'terms_clauses_branch_id_fkey'}, {'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'terms_clauses_company_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\terms.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\terms.py)`

### Table: `terms_defaults`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** General Platform
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `19` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'terms_defaults_branch_id_fkey'}, {'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'terms_defaults_company_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\terms.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\terms.py)`

### Table: `terms_snapshots`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** General Platform
- **Table Type:** `SNAPSHOT`
- **Row Count:** `0` rows
- **Columns Count:** `20` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'terms_snapshots_branch_id_fkey'}, {'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'terms_snapshots_company_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\terms.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\terms.py)`

### Table: `three_way_match_lines`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** General Platform
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `27` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'match_id', 'foreign_table': 'three_way_matches', 'foreign_column': 'id', 'constraint': 'three_way_match_lines_match_id_fkey'}, {'column': 'product_id', 'foreign_table': 'products', 'foreign_column': 'id', 'constraint': 'three_way_match_lines_product_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\purchase.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\purchase.py)`

### Table: `three_way_matches`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** General Platform
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `26` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'po_id', 'foreign_table': 'purchase_orders', 'foreign_column': 'id', 'constraint': 'three_way_matches_po_id_fkey'}, {'column': 'grn_id', 'foreign_table': 'purchase_receipts', 'foreign_column': 'id', 'constraint': 'three_way_matches_grn_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\purchase.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\purchase.py)`

### Table: `user_branch_assignments`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** IAM & Security Governance
- **Table Type:** `MASTER`
- **Row Count:** `0` rows
- **Columns Count:** `18` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'user_branch_assignments_company_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'user_branch_assignments_branch_id_fkey'}, {'column': 'user_id', 'foreign_table': 'users', 'foreign_column': 'id', 'constraint': 'user_branch_assignments_user_id_fkey'}]`
- **Code Model:** `UserBranchAssignment` in `[backend\app\models\user_assignment.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\user_assignment.py)`

### Table: `user_company_assignments`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** IAM & Security Governance
- **Table Type:** `MASTER`
- **Row Count:** `0` rows
- **Columns Count:** `18` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'user_company_assignments_company_id_fkey'}, {'column': 'user_id', 'foreign_table': 'users', 'foreign_column': 'id', 'constraint': 'user_company_assignments_user_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'user_company_assignments_branch_id_fkey'}]`
- **Code Model:** `UserCompanyAssignment` in `[backend\app\models\user_assignment.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\user_assignment.py)`

### Table: `user_store_assignments`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** IAM & Security Governance
- **Table Type:** `MASTER`
- **Row Count:** `0` rows
- **Columns Count:** `18` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'user_store_assignments_company_id_fkey'}, {'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'user_store_assignments_branch_id_fkey'}, {'column': 'user_id', 'foreign_table': 'users', 'foreign_column': 'id', 'constraint': 'user_store_assignments_user_id_fkey'}, {'column': 'store_id', 'foreign_table': 'stores', 'foreign_column': 'id', 'constraint': 'user_store_assignments_store_id_fkey'}]`
- **Code Model:** `UserStoreAssignment` in `[backend\app\models\user_assignment.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\user_assignment.py)`

### Table: `users`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** IAM & Security Governance
- **Table Type:** `MASTER`
- **Row Count:** `3` rows
- **Columns Count:** `44` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'users_branch_id_fkey'}, {'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'users_company_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\auth.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\auth.py)`

### Table: `variant_templates`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Platform Configuration & System
- **Table Type:** `CONFIGURATION`
- **Row Count:** `1` rows
- **Columns Count:** `27` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'variant_templates_branch_id_fkey'}, {'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'variant_templates_company_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\attributes.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\attributes.py)`

### Table: `vendor_contract_tiers`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Procurement & Purchasing
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `27` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'contract_id', 'foreign_table': 'vendor_contracts', 'foreign_column': 'id', 'constraint': 'vendor_contract_tiers_contract_id_fkey'}, {'column': 'product_id', 'foreign_table': 'products', 'foreign_column': 'id', 'constraint': 'vendor_contract_tiers_product_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\purchase.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\purchase.py)`

### Table: `vendor_contracts`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Procurement & Purchasing
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `32` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'supplier_id', 'foreign_table': 'suppliers', 'foreign_column': 'id', 'constraint': 'vendor_contracts_supplier_id_fkey'}, {'column': 'parent_contract_id', 'foreign_table': 'vendor_contracts', 'foreign_column': 'id', 'constraint': 'vendor_contracts_parent_contract_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\purchase.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\purchase.py)`

### Table: `vendor_quotation_items`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Catalog & Item Master
- **Table Type:** `MASTER`
- **Row Count:** `0` rows
- **Columns Count:** `23` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'quotation_id', 'foreign_table': 'vendor_quotations', 'foreign_column': 'id', 'constraint': 'vendor_quotation_items_quotation_id_fkey'}, {'column': 'product_id', 'foreign_table': 'products', 'foreign_column': 'id', 'constraint': 'vendor_quotation_items_product_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\purchase.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\purchase.py)`

### Table: `vendor_quotations`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** General Platform
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `29` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'rfq_id', 'foreign_table': 'procurement_rfqs', 'foreign_column': 'id', 'constraint': 'vendor_quotations_rfq_id_fkey'}, {'column': 'supplier_id', 'foreign_table': 'suppliers', 'foreign_column': 'id', 'constraint': 'vendor_quotations_supplier_id_fkey'}, {'column': 'parent_quotation_id', 'foreign_table': 'vendor_quotations', 'foreign_column': 'id', 'constraint': 'vendor_quotations_parent_quotation_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\purchase.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\purchase.py)`

### Table: `warehouse_bins`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Inventory & Stock Management
- **Table Type:** `MASTER`
- **Row Count:** `0` rows
- **Columns Count:** `22` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'warehouse_id', 'foreign_table': 'warehouses', 'foreign_column': 'id', 'constraint': 'warehouse_bins_warehouse_id_fkey'}, {'column': 'zone_id', 'foreign_table': 'warehouse_zones', 'foreign_column': 'id', 'constraint': 'warehouse_bins_zone_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\wms.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\wms.py)`

### Table: `warehouse_zones`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Inventory & Stock Management
- **Table Type:** `MASTER`
- **Row Count:** `0` rows
- **Columns Count:** `16` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'warehouse_id', 'foreign_table': 'warehouses', 'foreign_column': 'id', 'constraint': 'warehouse_zones_warehouse_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\wms.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\wms.py)`

### Table: `warehouses`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Inventory & Stock Management
- **Table Type:** `MASTER`
- **Row Count:** `0` rows
- **Columns Count:** `20` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'branch_id', 'foreign_table': 'branches', 'foreign_column': 'id', 'constraint': 'warehouses_branch_id_fkey'}, {'column': 'company_id', 'foreign_table': 'companies', 'foreign_column': 'id', 'constraint': 'warehouses_company_id_fkey'}]`
- **Code Model:** `Warehouse` in `[backend\app\models\inventory.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\inventory.py)`

### Table: `webhook_subscriptions`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** General Platform
- **Table Type:** `REFERENCE`
- **Row Count:** `0` rows
- **Columns Count:** `8` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[]`
- **Code Model:** `UnknownModel` in `[backend\app\models\integration_hub.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\integration_hub.py)`

### Table: `workflow_events`
- **Physical Status:** PHYSICAL TABLE IN LIVE POSTGRESQL (`smriti_retail_db`)
- **Domain:** Workflow & Approval Engine
- **Table Type:** `INTEGRATION`
- **Row Count:** `0` rows
- **Columns Count:** `13` columns
- **Primary Key:** `['id']`
- **Foreign Keys:** `[{'column': 'performed_by_id', 'foreign_table': 'users', 'foreign_column': 'id', 'constraint': 'workflow_events_performed_by_id_fkey'}]`
- **Code Model:** `UnknownModel` in `[backend\app\models\workflow.py](file:///f:/SMRITRretailNXmgrt/backend\app\models\workflow.py)`
