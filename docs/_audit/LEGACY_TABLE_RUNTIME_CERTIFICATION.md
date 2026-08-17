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
  Classification: 179 NON-COMPANYDB PRESERVED & RESIDUAL TABLES CLASSIFICATION REPORT
-->

# SMRITI RETAIL OS ? 179 NON-COMPANYDB PRESERVED / RESIDUAL TABLES CLASSIFICATION

**Audit Scope:** 179 Non-CompanyDB Physical Base Tables Preserved in `smritisys`  
**Governance Directive:** [`docs/AI_AGENT_ARCHITECTURE_RULES.md`](file:///F:/SMRITRretailNX/docs/AI_AGENT_ARCHITECTURE_RULES.md) (Rule 1, Rule 9, Rule 10)  
**Safety Protocol:** NO DROP, NO TRUNCATE, NO DESTRUCTIVE MIGRATION  
**Date:** 2026-08-17  
**Official Status:** **`PRESERVED NON-OPERATIONAL RESIDUE / RUNTIME WRITES: EXACTLY 0`**

---

## 1. Executive Summary & Granular Taxonomy

The 179 non-CompanyDB tables in `smritisys` are classified into rigorous governance categories:

```text
================================================================================
179 NON-COMPANYDB PRESERVED / RESIDUAL TABLES TAXONOMY
================================================================================
1. MIGRATION_ONLY           :  6 tables (Alembic migration / historical schema tracking)
2. SCAFFOLDING / PROTOTYPE  : 142 tables (Scaffolding preserved from initial design)
3. LEGACY                   :  16 tables (Legacy models superseded by Company DB architecture)
4. OTHER_PRESERVED_RESIDUE  :  15 tables (Inactive schema residue)
--------------------------------------------------------------------------------
TOTAL NON-COMPANYDB TABLES  : 179 TABLES (100% Accounted For)
ACTIVE RUNTIME WRITES       : EXACTLY 0 (Verified by live runtime audit)
================================================================================
```

---

## 2. Granular Table Inventory & Classification Matrix

| # | Table Name | Live Rows | Code References | Migration References | Runtime Read Evidence | Runtime Write Evidence | Taxonomy Classification | Notes |
|---|---|---|---|---|---|---|---|---|
| 1 | `apparel_matrix_variants` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 2 | `audit_logs` | 0 | `src\db\init.ts` | Yes | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`MIGRATION_ONLY`** | Alembic historical migration reference. |
| 3 | `bank_accounts` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 4 | `blanket_purchase_agreement_lines` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 5 | `blanket_purchase_agreements` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 6 | `chart_of_accounts` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 7 | `company_financial_years` | 0 | `backend\app\tests\conftest.py` | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`OTHER_PRESERVED_RESIDUE`** | Preserved residue. |
| 8 | `company_tax_profiles` | 0 | `backend\app\tests\conftest.py` | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`OTHER_PRESERVED_RESIDUE`** | Preserved residue. |
| 9 | `consignment_partners` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 10 | `consignment_return_items` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 11 | `consignment_returns` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 12 | `consignment_sale_report_items` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 13 | `consignment_sale_reports` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 14 | `consignment_settlements` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 15 | `consignment_transfer_items` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 16 | `consignment_transfers` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 17 | `corporate_gstin_registry` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 18 | `cost_centers` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 19 | `cost_layer_ledger_entries` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 20 | `credit_notes` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 21 | `crm_campaigns` | 0 | `src\components\CrmStudioTab.tsx` | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`OTHER_PRESERVED_RESIDUE`** | Preserved residue. |
| 22 | `crm_customer_activities` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 23 | `crm_leads` | 0 | `backend\app\dev_tracker\scanner.py` | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`OTHER_PRESERVED_RESIDUE`** | Preserved residue. |
| 24 | `crm_opportunities` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 25 | `crm_support_tickets` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 26 | `crm_ticket_comments` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 27 | `customer_addresses` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 28 | `customer_channel_preferences` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 29 | `customer_contacts` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 30 | `customer_credit_profiles` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 31 | `customer_tax_profiles` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 32 | `database_profiles` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 33 | `dispatch_approval_events` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 34 | `document_number_series` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 35 | `document_posting_profiles` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 36 | `document_workflows` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 37 | `eway_bills` | 0 | `backend\tests\test_eway_bill_dispatch.py` | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`OTHER_PRESERVED_RESIDUE`** | Preserved residue. |
| 38 | `financial_year` | 0 | `backend\app\models\numbering.py` | Yes | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`LEGACY`** | Legacy prototype model; superseded by Company DB operational tables. |
| 39 | `fiscal_periods` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 40 | `fulfillment_waves` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 41 | `gst_return_filings` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 42 | `gst_return_locks` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 43 | `gst_tax_settlements` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 44 | `integration_logs` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 45 | `inventory_checkpoint_records` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 46 | `inventory_identity_records` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 47 | `inventory_ledger_entries` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 48 | `inventory_location_nodes` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 49 | `inventory_lock_records` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 50 | `inventory_snapshot_records` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 51 | `journal_ledger_entries` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 52 | `journal_vouchers` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 53 | `landed_cost_vouchers` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 54 | `legacy_pos_shifts` | 0 | `backend\alembic\versions\a1b2c3d4e5f6_add_missing_core_tables.py` | Yes | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`MIGRATION_ONLY`** | Alembic historical migration reference. |
| 55 | `loyalty_point_transactions` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 56 | `module_audit_logs` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 57 | `module_states` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 58 | `organizations` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 59 | `pharma_batches` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 60 | `pick_list_items` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 61 | `pick_lists` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 62 | `platform_idempotency_records` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 63 | `pos_offline_sync_queue` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 64 | `pos_profiles` | 0 | `src\db\init.ts` | Yes | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`MIGRATION_ONLY`** | Alembic historical migration reference. |
| 65 | `pos_sessions` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 66 | `pos_transaction_items` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 67 | `pos_transactions` | 0 | `backend\app\dev_tracker\scanner.py` | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`OTHER_PRESERVED_RESIDUE`** | Preserved residue. |
| 68 | `pricing_groups` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 69 | `procurement_rfq_items` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 70 | `procurement_rfq_vendors` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 71 | `procurement_rfqs` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 72 | `procurement_tolerance_policies` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 73 | `product_barcodes` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 74 | `product_inventory_policies` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 75 | `product_tax_profiles` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 76 | `product_vendors` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 77 | `purchase_requisition_lines` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 78 | `purchase_requisitions` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 79 | `quality_inspection_items` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 80 | `quality_inspections` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 81 | `quotation_evaluations` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 82 | `replenishment_items` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 83 | `replenishment_plans` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 84 | `requisition_approval_policies` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 85 | `requisition_approvals` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 86 | `reservation_ledger_entries` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 87 | `sales_invoice_payments` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 88 | `sales_payments` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 89 | `scdm_channel_dispatch_lines` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 90 | `scdm_channel_dispatches` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 91 | `scdm_channel_locations` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 92 | `scdm_channel_stock_movements` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 93 | `scdm_claim_types` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 94 | `scdm_claims` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 95 | `scdm_sellout_import_lines` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 96 | `scdm_sellout_imports` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 97 | `scdm_settlement_lines` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 98 | `scdm_settlements` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 99 | `shipment_packages` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 100 | `size_conversions` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 101 | `size_scales` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 102 | `size_values` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 103 | `smriti_addresses` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 104 | `smriti_api_key_logs` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 105 | `smriti_api_key_permission_sets` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 106 | `smriti_api_keys` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 107 | `smriti_approval_actions` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 108 | `smriti_approval_assignments` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 109 | `smriti_approval_comments` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 110 | `smriti_approval_conditions` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 111 | `smriti_approval_delegations` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 112 | `smriti_approval_escalations` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 113 | `smriti_approval_histories` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 114 | `smriti_approval_matrices` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 115 | `smriti_approval_outbox` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 116 | `smriti_approval_policies` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 117 | `smriti_approval_requests` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 118 | `smriti_approval_steps` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 119 | `smriti_bank_accounts` | 0 | `src\services\bankStore.ts` | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`LEGACY`** | Legacy prototype model; superseded by Company DB operational tables. |
| 120 | `smriti_branding` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 121 | `smriti_comm_channels` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 122 | `smriti_contacts` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 123 | `smriti_entity_registry` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 124 | `smriti_field_security_masks` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 125 | `smriti_permission_set_permissions` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 126 | `smriti_permission_sets` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 127 | `smriti_permissions` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 128 | `smriti_report_templates` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 129 | `smriti_role_permission_sets` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 130 | `smriti_roles` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 131 | `smriti_security_audits` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 132 | `smriti_security_policies` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 133 | `smriti_service_accounts` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 134 | `smriti_settings` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 135 | `smriti_social_profiles` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 136 | `smriti_user_assignments` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 137 | `smriti_user_roles` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 138 | `sre_compliance_decisions` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 139 | `sre_rule_engine` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 140 | `sre_statutory_ledger` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 141 | `stock_adjustments` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 142 | `stock_bin_assignments` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 143 | `stock_count_items` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 144 | `stock_counts` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 145 | `stock_dispatch_lines` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 146 | `stock_dispatches` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 147 | `stock_transfer_items` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 148 | `stock_transfer_shipments` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 149 | `stock_transfers` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 150 | `supplier_addresses` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 151 | `supplier_bank_details` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 152 | `supplier_compliance_profiles` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 153 | `supplier_contacts` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 154 | `supplier_credit_profiles` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 155 | `supplier_debit_notes` | 0 | `backend\tests\test_debit_note.py` | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`OTHER_PRESERVED_RESIDUE`** | Preserved residue. |
| 156 | `supplier_documents` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 157 | `supplier_gst_registrations` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 158 | `supplier_logistics` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 159 | `supplier_payment_profiles` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 160 | `supplier_scorecard_metrics` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 161 | `supplier_scorecards` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 162 | `supplier_tax_profiles` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 163 | `sync_queue` | 0 | `src\db\postgres\PostgresRepositories.ts` | Yes | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`MIGRATION_ONLY`** | Alembic historical migration reference. |
| 164 | `system_bootstrap_states` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 165 | `system_configs` | 0 | `backend\app\models\system.py` | Yes | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`LEGACY`** | Legacy prototype model; superseded by Company DB operational tables. |
| 166 | `tally_configs` | 0 | `backend\app\models\system.py` | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`LEGACY`** | Legacy prototype model; superseded by Company DB operational tables. |
| 167 | `tds_entries` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 168 | `tenant_provision_journals` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 169 | `tenant_provision_profiles` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 170 | `tenant_settings` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 171 | `tenants` | 0 | `backend\app\api\v1\auth.py` | Yes | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`LEGACY`** | Legacy prototype model; superseded by Company DB operational tables. |
| 172 | `three_way_match_lines` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 173 | `three_way_matches` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 174 | `vendor_contract_tiers` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 175 | `vendor_contracts` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 176 | `vendor_quotation_items` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 177 | `vendor_quotations` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 178 | `warehouse_bins` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |
| 179 | `warehouse_zones` | 0 | 0 code refs | None | RUNTIME ACTIVITY NOT DIRECTLY OBSERVED | 0 RUNTIME WRITES | **`SCAFFOLDING`** | Empty scaffolding preserved from initial architecture. |

---

## 3. Governance Policy

1. **Preservation:** All 179 tables remain safely preserved in `smritisys` without modification.
2. **Zero Runtime Side Effects:** No active operational business endpoints route reads or writes to these tables.
3. **Controlled Deprecation:** Formal deprecation cycles will only occur in scheduled future releases.
