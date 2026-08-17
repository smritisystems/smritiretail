<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.21.0
  Created      : 2026-08-17
  Modified     : 2026-08-17
  Copyright    : ? SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal -- Audit & Governance Artifact
-->

# SMRITI RETAIL OS ? TABLE OWNERSHIP & MIGRATION MAP

**Date:** 2026-08-17  
**Source Database:** `smritisys` (PostgreSQL 15, Total 283 Base Tables)  
**Target Architecture:** Control Plane (`smritisys`) + Company Databases (`smriti<company_code>`)

---

## 1. Classification Summary

| Classification | Count | Description | Target Authority Database |
|---|---|---|---|
| **CONTROL_PLANE** | 23 | Authentication, Users, Roles, Company/Branch master registries, DB routing registries, Menus, Audit | `smritisys` (Remains in Central Control Plane) |
| **CENTRAL_MASTER** | 1 | Global static lookups (Banks IFSC, GST HSN/SAC, States, Currencies) | `smritisys` (Central Reference) |
| **COMPANY_OPERATIONAL** | 76 | Transactional business documents, local inventory, sales, purchasing, customer/supplier ledgers | `smriti001`, `smriti002`, `smriti<Code>` (Company DB) |
| **PSV (SHADOW INVENTORY)** | 4 | Party Stock Visibility shadow event ledger and stock balance projections | `smritisys` (Currently Co-located) / `SmritiPSV` (Target) |
| **REPORTING & ANALYTICS** | 4 | Report templates, dashboard compositions, saved views | `smriti001` / `smritisys` (Co-located / Local execution) |
| **LEGACY / RETIRED** | 175 | Historical / experimental tables slated for controlled retirement | `smritisys` (Read-only / Slated for future retirement) |
| **TOTAL** | **283** | **All Base Tables in PostgreSQL** | |

---

## 2. Control Plane Tables (`smritisys` Authority)

These tables define the global multi-company governance plane and MUST remain in `smritisys`:

| Table Name | Source Rows | Primary Key Columns | Description |
|---|---|---|---|
| `alembic_version` | 1 | `version_num` | Control Plane metadata / registry |
| `audit_logs` | 0 | `id, operator, action_type` | Control Plane metadata / registry |
| `barcode_providers` | 0 | `id, uuid, company_id` | Control Plane metadata / registry |
| `branches` | 1 | `id, uuid, company_id` | Control Plane metadata / registry |
| `companies` | 1 | `id, uuid, name` | Control Plane metadata / registry |
| `company_database_registries` | 2 | `company_id, database_id, database_name` | Control Plane metadata / registry |
| `control_companies` | 1 | `id, uuid, company_code` | Control Plane metadata / registry |
| `control_company_databases` | 0 | `id, company_id, company_code` | Control Plane metadata / registry |
| `control_psv_configs` | 1 | `id, company_id, company_code` | Control Plane metadata / registry |
| `control_users` | 0 | `id, uuid, username` | Control Plane metadata / registry |
| `database_profiles` | 1 | `id, database_name, environment_type` | Control Plane metadata / registry |
| `identity_rules` | 0 | `id, uuid, company_id` | Control Plane metadata / registry |
| `product_identities` | 0 | `id, uuid, company_id` | Control Plane metadata / registry |
| `roles` | 0 | `name, description, permissions_json` | Control Plane metadata / registry |
| `smriti_audit_log` | 61 | `id, tenant_id, entity_id` | Control Plane metadata / registry |
| `smriti_menus` | 34 | `id, uuid, company_id` | Control Plane metadata / registry |
| `system_bootstrap_states` | 6 | `id, uuid, tenant_id` | Control Plane metadata / registry |
| `system_configs` | 0 | `id, uuid, company_id` | Control Plane metadata / registry |
| `tenant_provision_profiles` | 2 | `id, tenant_id, setup_version` | Control Plane metadata / registry |
| `tenant_settings` | 2 | `id, tenant_id, language_code` | Control Plane metadata / registry |
| `tenants` | 2 | `id, uuid, tenant_code` | Control Plane metadata / registry |
| `user_company_assignments` | 0 | `id, uuid, company_id` | Control Plane metadata / registry |
| `users` | 1 | `id, uuid, username` | Control Plane metadata / registry |

---

## 3. Company Operational Tables (Company DB Authority)

These tables hold operational transactional state and are partitioned per company:

| Table Name | Source Rows | Discriminator Column | Target Routing | Migration Action |
|---|---|---|---|---|
| `credit_notes` | 0 | `company_id` | `smriti<Code>` | `SCHEMA_READY_IN_COMPANY_DB` |
| `customer_addresses` | 0 | `company_id` | `smriti<Code>` | `SCHEMA_READY_IN_COMPANY_DB` |
| `customer_channel_preferences` | 0 | `company_id` | `smriti<Code>` | `SCHEMA_READY_IN_COMPANY_DB` |
| `customer_contacts` | 0 | `company_id` | `smriti<Code>` | `SCHEMA_READY_IN_COMPANY_DB` |
| `customer_credit_profiles` | 0 | `company_id` | `smriti<Code>` | `SCHEMA_READY_IN_COMPANY_DB` |
| `customer_groups` | 0 | `company_id` | `smriti<Code>` | `SCHEMA_READY_IN_COMPANY_DB` |
| `customer_tax_profiles` | 0 | `company_id` | `smriti<Code>` | `SCHEMA_READY_IN_COMPANY_DB` |
| `customers` | 0 | `company_id` | `smriti<Code>` | `SCHEMA_READY_IN_COMPANY_DB` |
| `delivery_commission_settlements` | 0 | `company_id` | `smriti<Code>` | `SCHEMA_READY_IN_COMPANY_DB` |
| `document_series` | 12 | `company_id` | `smriti<Code>` | `MIGRATE_TO_COMPANY_DB` |
| `integration_outbox_events` | 140 | `tenant_id / Local` | `smriti<Code>` | `MIGRATE_TO_COMPANY_DB` |
| `inventory_checkpoint_records` | 0 | `company_id` | `smriti<Code>` | `SCHEMA_READY_IN_COMPANY_DB` |
| `inventory_identity_records` | 0 | `company_id` | `smriti<Code>` | `SCHEMA_READY_IN_COMPANY_DB` |
| `inventory_ledger_entries` | 0 | `company_id` | `smriti<Code>` | `SCHEMA_READY_IN_COMPANY_DB` |
| `inventory_location_nodes` | 0 | `company_id` | `smriti<Code>` | `SCHEMA_READY_IN_COMPANY_DB` |
| `inventory_lock_records` | 0 | `company_id` | `smriti<Code>` | `SCHEMA_READY_IN_COMPANY_DB` |
| `inventory_snapshot_records` | 0 | `company_id` | `smriti<Code>` | `SCHEMA_READY_IN_COMPANY_DB` |
| `invoice_profitability_ledgers` | 0 | `company_id` | `smriti<Code>` | `SCHEMA_READY_IN_COMPANY_DB` |
| `journal_ledger_entries` | 0 | `company_id` | `smriti<Code>` | `SCHEMA_READY_IN_COMPANY_DB` |
| `journal_vouchers` | 0 | `company_id` | `smriti<Code>` | `SCHEMA_READY_IN_COMPANY_DB` |
| `numbering_audit_logs` | 12 | `company_id` | `smriti<Code>` | `MIGRATE_TO_COMPANY_DB` |
| `pos_offline_sync_queue` | 0 | `company_id` | `smriti<Code>` | `SCHEMA_READY_IN_COMPANY_DB` |
| `pos_profiles` | 0 | `tenant_id / Local` | `smriti<Code>` | `SCHEMA_READY_IN_COMPANY_DB` |
| `pos_sessions` | 0 | `company_id` | `smriti<Code>` | `SCHEMA_READY_IN_COMPANY_DB` |
| `pos_transaction_items` | 0 | `company_id` | `smriti<Code>` | `SCHEMA_READY_IN_COMPANY_DB` |
| `pos_transactions` | 0 | `company_id` | `smriti<Code>` | `SCHEMA_READY_IN_COMPANY_DB` |
| `pricing_groups` | 5 | `company_id` | `smriti<Code>` | `MIGRATE_TO_COMPANY_DB` |
| `product_barcodes` | 0 | `company_id` | `smriti<Code>` | `SCHEMA_READY_IN_COMPANY_DB` |
| `product_cost_valuations` | 0 | `company_id` | `smriti<Code>` | `SCHEMA_READY_IN_COMPANY_DB` |
| `product_inventory_policies` | 0 | `company_id` | `smriti<Code>` | `SCHEMA_READY_IN_COMPANY_DB` |
| `product_tax_profiles` | 0 | `company_id` | `smriti<Code>` | `SCHEMA_READY_IN_COMPANY_DB` |
| `product_vendors` | 0 | `company_id` | `smriti<Code>` | `SCHEMA_READY_IN_COMPANY_DB` |
| `products` | 0 | `company_id` | `smriti<Code>` | `SCHEMA_READY_IN_COMPANY_DB` |
| `purchase_jurisdiction_configs` | 0 | `company_id` | `smriti<Code>` | `SCHEMA_READY_IN_COMPANY_DB` |
| `purchase_order_items` | 0 | `company_id` | `smriti<Code>` | `SCHEMA_READY_IN_COMPANY_DB` |
| `purchase_orders` | 0 | `company_id` | `smriti<Code>` | `SCHEMA_READY_IN_COMPANY_DB` |
| `purchase_receipt_items` | 0 | `company_id` | `smriti<Code>` | `SCHEMA_READY_IN_COMPANY_DB` |
| `purchase_receipts` | 0 | `company_id` | `smriti<Code>` | `SCHEMA_READY_IN_COMPANY_DB` |
| `purchase_reorder_configs` | 0 | `company_id` | `smriti<Code>` | `SCHEMA_READY_IN_COMPANY_DB` |
| `purchase_requisition_lines` | 0 | `company_id` | `smriti<Code>` | `SCHEMA_READY_IN_COMPANY_DB` |
| `purchase_requisitions` | 0 | `company_id` | `smriti<Code>` | `SCHEMA_READY_IN_COMPANY_DB` |
| `sales_invoice_items` | 0 | `company_id` | `smriti<Code>` | `SCHEMA_READY_IN_COMPANY_DB` |
| `sales_invoice_payments` | 0 | `company_id` | `smriti<Code>` | `SCHEMA_READY_IN_COMPANY_DB` |
| `sales_invoices` | 0 | `company_id` | `smriti<Code>` | `SCHEMA_READY_IN_COMPANY_DB` |
| `sales_order_items` | 0 | `company_id` | `smriti<Code>` | `SCHEMA_READY_IN_COMPANY_DB` |
| `sales_orders` | 0 | `company_id` | `smriti<Code>` | `SCHEMA_READY_IN_COMPANY_DB` |
| `sales_payments` | 0 | `company_id` | `smriti<Code>` | `SCHEMA_READY_IN_COMPANY_DB` |
| `sales_quotation_items` | 0 | `company_id` | `smriti<Code>` | `SCHEMA_READY_IN_COMPANY_DB` |
| `sales_quotations` | 0 | `company_id` | `smriti<Code>` | `SCHEMA_READY_IN_COMPANY_DB` |
| `sales_return_items` | 0 | `company_id` | `smriti<Code>` | `SCHEMA_READY_IN_COMPANY_DB` |
| `sales_returns` | 0 | `company_id` | `smriti<Code>` | `SCHEMA_READY_IN_COMPANY_DB` |
| `stock_adjustments` | 0 | `company_id` | `smriti<Code>` | `SCHEMA_READY_IN_COMPANY_DB` |
| `stock_bin_assignments` | 0 | `tenant_id / Local` | `smriti<Code>` | `SCHEMA_READY_IN_COMPANY_DB` |
| `stock_count_items` | 0 | `company_id` | `smriti<Code>` | `SCHEMA_READY_IN_COMPANY_DB` |
| `stock_counts` | 0 | `company_id` | `smriti<Code>` | `SCHEMA_READY_IN_COMPANY_DB` |
| `stock_dispatch_lines` | 0 | `company_id` | `smriti<Code>` | `SCHEMA_READY_IN_COMPANY_DB` |
| `stock_dispatches` | 0 | `company_id` | `smriti<Code>` | `SCHEMA_READY_IN_COMPANY_DB` |
| `stock_movements` | 0 | `company_id` | `smriti<Code>` | `SCHEMA_READY_IN_COMPANY_DB` |
| `stock_transfer_items` | 0 | `company_id` | `smriti<Code>` | `SCHEMA_READY_IN_COMPANY_DB` |
| `stock_transfer_shipments` | 0 | `company_id` | `smriti<Code>` | `SCHEMA_READY_IN_COMPANY_DB` |
| `stock_transfers` | 0 | `company_id` | `smriti<Code>` | `SCHEMA_READY_IN_COMPANY_DB` |
| `supplier_addresses` | 0 | `company_id` | `smriti<Code>` | `SCHEMA_READY_IN_COMPANY_DB` |
| `supplier_bank_details` | 0 | `company_id` | `smriti<Code>` | `SCHEMA_READY_IN_COMPANY_DB` |
| `supplier_compliance_profiles` | 0 | `company_id` | `smriti<Code>` | `SCHEMA_READY_IN_COMPANY_DB` |
| `supplier_contacts` | 0 | `company_id` | `smriti<Code>` | `SCHEMA_READY_IN_COMPANY_DB` |
| `supplier_credit_profiles` | 0 | `company_id` | `smriti<Code>` | `SCHEMA_READY_IN_COMPANY_DB` |
| `supplier_debit_notes` | 0 | `company_id` | `smriti<Code>` | `SCHEMA_READY_IN_COMPANY_DB` |
| `supplier_documents` | 0 | `company_id` | `smriti<Code>` | `SCHEMA_READY_IN_COMPANY_DB` |
| `supplier_gst_registrations` | 0 | `company_id` | `smriti<Code>` | `SCHEMA_READY_IN_COMPANY_DB` |
| `supplier_logistics` | 0 | `company_id` | `smriti<Code>` | `SCHEMA_READY_IN_COMPANY_DB` |
| `supplier_payment_profiles` | 0 | `company_id` | `smriti<Code>` | `SCHEMA_READY_IN_COMPANY_DB` |
| `supplier_payments` | 0 | `company_id` | `smriti<Code>` | `SCHEMA_READY_IN_COMPANY_DB` |
| `supplier_scorecard_metrics` | 0 | `company_id` | `smriti<Code>` | `SCHEMA_READY_IN_COMPANY_DB` |
| `supplier_scorecards` | 0 | `company_id` | `smriti<Code>` | `SCHEMA_READY_IN_COMPANY_DB` |
| `supplier_tax_profiles` | 0 | `company_id` | `smriti<Code>` | `SCHEMA_READY_IN_COMPANY_DB` |
| `suppliers` | 0 | `company_id` | `smriti<Code>` | `SCHEMA_READY_IN_COMPANY_DB` |

---

## 4. Central Master & Reference Tables (`smritisys` Authority)

| Table Name | Source Rows | Purpose | Target Storage |
|---|---|---|---|
| `smriti_banks` | 20 | Global Static Master | `smritisys` |

---

## 5. Party Stock Visibility (PSV) Tables

| Table Name | Source Rows | Purpose | Target Storage | Current Reality |
|---|---|---|---|---|
| `psv_parties` | 0 | PSV Shadow Ledger / Balance | `SmritiPSV` | Co-located in `smritisys` |
| `psv_sku_tracking` | 0 | PSV Shadow Ledger / Balance | `SmritiPSV` | Co-located in `smritisys` |
| `psv_stock_balances` | 1 | PSV Shadow Ledger / Balance | `SmritiPSV` | Co-located in `smritisys` |
| `psv_stock_events` | 1 | PSV Shadow Ledger / Balance | `SmritiPSV` | Co-located in `smritisys` |

---

## 6. Legacy / Retained Inactive Tables

| Table Name | Source Rows | Classification | Status |
|---|---|---|---|
| `apparel_matrix_variants` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `approval_workflow_logs` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `attribute_definitions` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `attribute_groups` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `bank_accounts` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `barcode_layouts` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `blanket_purchase_agreement_lines` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `blanket_purchase_agreements` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `cash_registers` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `category_attribute_group_mappings` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `chart_of_accounts` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `commission_ledgers` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `commission_participants` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `commission_programs` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `commission_rules` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `company_financial_years` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `company_tax_profiles` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `compliance_audit_logs` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `compliance_credentials` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `compliance_outboxes` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `consignment_partners` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `consignment_return_items` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `consignment_returns` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `consignment_sale_report_items` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `consignment_sale_reports` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `consignment_settlements` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `consignment_transfer_items` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `consignment_transfers` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `corporate_gstin_registry` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `cost_centers` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `cost_layer_ledger_entries` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `coupons` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `crm_campaigns` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `crm_customer_activities` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `crm_leads` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `crm_opportunities` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `crm_support_tickets` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `crm_ticket_comments` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `dashboards` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `data_exchange_field_mappings` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `data_exchange_tasks` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `dispatch_approval_events` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `dispatch_items` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `dispatches` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `document_number_series` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `document_posting_profiles` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `document_workflows` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `eway_bills` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `financial_year` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `fiscal_periods` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `fulfillment_waves` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `government_services` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `gst_return_filings` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `gst_return_locks` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `gst_tax_settlements` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `integration_logs` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `landed_cost_vouchers` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `legacy_pos_shifts` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `loyalty_members` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `loyalty_point_transactions` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `loyalty_points_ledgers` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `loyalty_rules` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `loyalty_tiers` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `master_types` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `master_values` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `module_audit_logs` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `module_states` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `organizations` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `packing_slip_items` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `packing_slips` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `pharma_batches` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `pick_list_items` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `pick_lists` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `platform_idempotency_records` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `print_histories` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `print_profiles` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `print_templates` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `procurement_rfq_items` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `procurement_rfq_vendors` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `procurement_rfqs` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `procurement_tolerance_policies` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `promotion_campaigns` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `promotion_redemptions` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `promotion_rules` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `quality_inspection_items` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `quality_inspections` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `quotation_evaluations` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `referral_programs` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `referral_relationships` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `referral_rewards` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `refresh_token_blacklist` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `replenishment_items` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `replenishment_plans` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `requisition_approval_policies` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `requisition_approvals` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `reservation_ledger_entries` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `reverse_logistics_returns` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `scdm_channel_dispatch_lines` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `scdm_channel_dispatches` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `scdm_channel_locations` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `scdm_channel_stock_movements` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `scdm_claim_types` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `scdm_claims` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `scdm_sellout_import_lines` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `scdm_sellout_imports` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `scdm_settlement_lines` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `scdm_settlements` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `shifts` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `shipment_packages` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `size_conversions` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `size_scales` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `size_values` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `smriti_addresses` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `smriti_api_key_logs` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `smriti_api_key_permission_sets` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `smriti_api_keys` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `smriti_approval_actions` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `smriti_approval_assignments` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `smriti_approval_comments` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `smriti_approval_conditions` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `smriti_approval_delegations` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `smriti_approval_escalations` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `smriti_approval_histories` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `smriti_approval_matrices` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `smriti_approval_outbox` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `smriti_approval_policies` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `smriti_approval_requests` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `smriti_approval_steps` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `smriti_bank_accounts` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `smriti_branding` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `smriti_comm_channels` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `smriti_contacts` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `smriti_entity_registry` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `smriti_field_security_masks` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `smriti_permission_set_permissions` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `smriti_permission_sets` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `smriti_permissions` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `smriti_report_templates` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `smriti_role_permission_sets` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `smriti_roles` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `smriti_security_audits` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `smriti_security_policies` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `smriti_service_accounts` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `smriti_settings` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `smriti_social_profiles` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `smriti_theme_variants` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `smriti_themes` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `smriti_user_assignments` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `smriti_user_roles` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `smriti_workspace_profiles` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `sre_compliance_decisions` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `sre_rule_engine` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `sre_statutory_ledger` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `stores` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `sync_queue` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `tally_configs` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `tds_entries` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `tenant_provision_journals` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `terms_clauses` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `terms_defaults` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `terms_snapshots` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `three_way_match_lines` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `three_way_matches` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `transaction_cost_snapshots` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `user_branch_assignments` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `user_store_assignments` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `variant_templates` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `vendor_contract_tiers` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `vendor_contracts` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `vendor_quotation_items` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `vendor_quotations` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `warehouse_bins` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `warehouse_zones` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `warehouses` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
| `workflow_events` | 0 | Legacy / Domain Scaffolding | `RETIRED_IN_SMRITISYS` |
