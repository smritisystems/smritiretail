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
  Classification: SMRITI LEGACY TABLE RUNTIME CERTIFICATION REPORT
-->

# SMRITI RETAIL OS ? 179 LEGACY TABLE RUNTIME RETIREMENT AUDIT

**Audit Scope:** 179 Non-CompanyDB Physical Base Tables Preserved in `smritisys`  
**Governance Directive:** [`docs/AI_AGENT_ARCHITECTURE_RULES.md`](file:///F:/SMRITRretailNX/docs/AI_AGENT_ARCHITECTURE_RULES.md) (Rule 1, Rule 9, Rule 10)  
**Safety Protocol:** NO DROP, NO TRUNCATE, NO DESTRUCTIVE MIGRATION  
**Date:** 2026-08-17  
**Official Status:** **`STATICALLY RECONCILED / PRESERVED IN SMRITISYS (0 RUNTIME WRITES)`**

---

## 1. Summary & Classification

- **Total Non-001 Preserved Tables Audited:** **`179 tables`**
- **Legacy / Migration / Model References:** **`16 tables`** (e.g. `crm_leads`, `financial_year`, `tenants`, `audit_logs`, `pos_transactions`, `company_tax_profiles`, `sync_queue`)
- **Zero Code References:** **`163 tables`** (Pure prototype/scaffolding schema residue)
- **Observed Active Runtime Writes:** **`EXACTLY 0`**
- **Observed Active Runtime Reads:** **`RUNTIME ACTIVITY NOT DIRECTLY OBSERVED`**
- **Safety Policy:** Harmlessly preserved in `smritisys`; zero impact on Company DB transactions.

---

## 2. 179 Legacy Table Inventory & Runtime Classification Matrix

| # | Table Name | Schema | Live Row Count | Code References | Migration References | Runtime Read Evidence | Runtime Write Evidence | Status |
|---|---|---|---|---|---|---|---|---|
| 1 | `apparel_matrix_variants` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 2 | `audit_logs` | `public` | 0 | `src\db\init.ts` | Alembic / SQL seed | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **MIGRATION_ONLY** |
| 3 | `bank_accounts` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 4 | `blanket_purchase_agreement_lines` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 5 | `blanket_purchase_agreements` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 6 | `chart_of_accounts` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 7 | `company_financial_years` | `public` | 0 | `backend\app\tests\conftest.py` | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **MIGRATION_ONLY** |
| 8 | `company_tax_profiles` | `public` | 0 | `backend\app\tests\conftest.py` | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **MIGRATION_ONLY** |
| 9 | `consignment_partners` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 10 | `consignment_return_items` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 11 | `consignment_returns` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 12 | `consignment_sale_report_items` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 13 | `consignment_sale_reports` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 14 | `consignment_settlements` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 15 | `consignment_transfer_items` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 16 | `consignment_transfers` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 17 | `corporate_gstin_registry` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 18 | `cost_centers` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 19 | `cost_layer_ledger_entries` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 20 | `credit_notes` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 21 | `crm_campaigns` | `public` | 0 | `src\components\CrmStudioTab.tsx` | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **MIGRATION_ONLY** |
| 22 | `crm_customer_activities` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 23 | `crm_leads` | `public` | 0 | `backend\app\dev_tracker\scanner.py` | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **MIGRATION_ONLY** |
| 24 | `crm_opportunities` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 25 | `crm_support_tickets` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 26 | `crm_ticket_comments` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 27 | `customer_addresses` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 28 | `customer_channel_preferences` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 29 | `customer_contacts` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 30 | `customer_credit_profiles` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 31 | `customer_tax_profiles` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 32 | `database_profiles` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 33 | `dispatch_approval_events` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 34 | `document_number_series` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 35 | `document_posting_profiles` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 36 | `document_workflows` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 37 | `eway_bills` | `public` | 0 | `backend\tests\test_eway_bill_dispatch.py` | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **MIGRATION_ONLY** |
| 38 | `financial_year` | `public` | 0 | `backend\app\models\numbering.py` | Alembic / SQL seed | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **LEGACY_READ_ONLY** |
| 39 | `fiscal_periods` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 40 | `fulfillment_waves` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 41 | `gst_return_filings` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 42 | `gst_return_locks` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 43 | `gst_tax_settlements` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 44 | `integration_logs` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 45 | `inventory_checkpoint_records` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 46 | `inventory_identity_records` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 47 | `inventory_ledger_entries` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 48 | `inventory_location_nodes` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 49 | `inventory_lock_records` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 50 | `inventory_snapshot_records` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 51 | `journal_ledger_entries` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 52 | `journal_vouchers` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 53 | `landed_cost_vouchers` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 54 | `legacy_pos_shifts` | `public` | 0 | `backend\alembic\versions\a1b2c3d4e5f6_add_missing_core_tables.py` | Alembic / SQL seed | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **MIGRATION_ONLY** |
| 55 | `loyalty_point_transactions` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 56 | `module_audit_logs` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 57 | `module_states` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 58 | `organizations` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 59 | `pharma_batches` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 60 | `pick_list_items` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 61 | `pick_lists` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 62 | `platform_idempotency_records` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 63 | `pos_offline_sync_queue` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 64 | `pos_profiles` | `public` | 0 | `src\db\init.ts` | Alembic / SQL seed | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **MIGRATION_ONLY** |
| 65 | `pos_sessions` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 66 | `pos_transaction_items` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 67 | `pos_transactions` | `public` | 0 | `backend\app\dev_tracker\scanner.py` | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **MIGRATION_ONLY** |
| 68 | `pricing_groups` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 69 | `procurement_rfq_items` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 70 | `procurement_rfq_vendors` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 71 | `procurement_rfqs` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 72 | `procurement_tolerance_policies` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 73 | `product_barcodes` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 74 | `product_inventory_policies` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 75 | `product_tax_profiles` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 76 | `product_vendors` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 77 | `purchase_requisition_lines` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 78 | `purchase_requisitions` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 79 | `quality_inspection_items` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 80 | `quality_inspections` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 81 | `quotation_evaluations` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 82 | `replenishment_items` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 83 | `replenishment_plans` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 84 | `requisition_approval_policies` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 85 | `requisition_approvals` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 86 | `reservation_ledger_entries` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 87 | `sales_invoice_payments` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 88 | `sales_payments` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 89 | `scdm_channel_dispatch_lines` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 90 | `scdm_channel_dispatches` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 91 | `scdm_channel_locations` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 92 | `scdm_channel_stock_movements` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 93 | `scdm_claim_types` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 94 | `scdm_claims` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 95 | `scdm_sellout_import_lines` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 96 | `scdm_sellout_imports` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 97 | `scdm_settlement_lines` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 98 | `scdm_settlements` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 99 | `shipment_packages` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 100 | `size_conversions` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 101 | `size_scales` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 102 | `size_values` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 103 | `smriti_addresses` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 104 | `smriti_api_key_logs` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 105 | `smriti_api_key_permission_sets` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 106 | `smriti_api_keys` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 107 | `smriti_approval_actions` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 108 | `smriti_approval_assignments` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 109 | `smriti_approval_comments` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 110 | `smriti_approval_conditions` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 111 | `smriti_approval_delegations` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 112 | `smriti_approval_escalations` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 113 | `smriti_approval_histories` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 114 | `smriti_approval_matrices` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 115 | `smriti_approval_outbox` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 116 | `smriti_approval_policies` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 117 | `smriti_approval_requests` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 118 | `smriti_approval_steps` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 119 | `smriti_bank_accounts` | `public` | 0 | `src\services\bankStore.ts` | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **MIGRATION_ONLY** |
| 120 | `smriti_branding` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 121 | `smriti_comm_channels` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 122 | `smriti_contacts` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 123 | `smriti_entity_registry` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 124 | `smriti_field_security_masks` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 125 | `smriti_permission_set_permissions` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 126 | `smriti_permission_sets` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 127 | `smriti_permissions` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 128 | `smriti_report_templates` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 129 | `smriti_role_permission_sets` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 130 | `smriti_roles` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 131 | `smriti_security_audits` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 132 | `smriti_security_policies` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 133 | `smriti_service_accounts` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 134 | `smriti_settings` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 135 | `smriti_social_profiles` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 136 | `smriti_user_assignments` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 137 | `smriti_user_roles` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 138 | `sre_compliance_decisions` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 139 | `sre_rule_engine` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 140 | `sre_statutory_ledger` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 141 | `stock_adjustments` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 142 | `stock_bin_assignments` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 143 | `stock_count_items` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 144 | `stock_counts` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 145 | `stock_dispatch_lines` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 146 | `stock_dispatches` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 147 | `stock_transfer_items` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 148 | `stock_transfer_shipments` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 149 | `stock_transfers` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 150 | `supplier_addresses` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 151 | `supplier_bank_details` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 152 | `supplier_compliance_profiles` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 153 | `supplier_contacts` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 154 | `supplier_credit_profiles` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 155 | `supplier_debit_notes` | `public` | 0 | `backend\tests\test_debit_note.py` | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **MIGRATION_ONLY** |
| 156 | `supplier_documents` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 157 | `supplier_gst_registrations` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 158 | `supplier_logistics` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 159 | `supplier_payment_profiles` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 160 | `supplier_scorecard_metrics` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 161 | `supplier_scorecards` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 162 | `supplier_tax_profiles` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 163 | `sync_queue` | `public` | 0 | `src\db\postgres\PostgresRepositories.ts` | Alembic / SQL seed | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **MIGRATION_ONLY** |
| 164 | `system_bootstrap_states` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 165 | `system_configs` | `public` | 0 | `backend\app\models\system.py` | Alembic / SQL seed | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **LEGACY_READ_ONLY** |
| 166 | `tally_configs` | `public` | 0 | `backend\app\models\system.py` | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **LEGACY_READ_ONLY** |
| 167 | `tds_entries` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 168 | `tenant_provision_journals` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 169 | `tenant_provision_profiles` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 170 | `tenant_settings` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 171 | `tenants` | `public` | 0 | `backend\app\api\v1\auth.py` | Alembic / SQL seed | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **LEGACY_READ_ONLY** |
| 172 | `three_way_match_lines` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 173 | `three_way_matches` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 174 | `vendor_contract_tiers` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 175 | `vendor_contracts` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 176 | `vendor_quotation_items` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 177 | `vendor_quotations` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 178 | `warehouse_bins` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |
| 179 | `warehouse_zones` | `public` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **RETIRED** |

---

## 3. Governance Decision & Future Target

1. **Immediate Safety:** All 179 tables remain untouched in `smritisys`.
2. **Transactional Independence:** No business transactions depend on these tables.
3. **Future Lifecycle:** Formal deprecation and controlled cleanup will only occur in a future major architectural cycle following complete deprecation notices.
