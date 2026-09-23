"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-09-23
Modified     : 2026-09-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal — Architecture Contract

SMRITI Canonical Table Ownership Registry (TDB-v2.0)
═════════════════════════════════════════════════════
This is the Single Source of Truth for every database table's ownership.

Architecture Rule:
    smritisys = CONTROL_PLANE tables only
    smritiXXX = TENANT + SHARED_REFERENCE tables

TableOwner values:
    CONTROL_PLANE     → belongs exclusively in smritisys
    TENANT            → belongs exclusively in smritiXXX (forbidden in smritisys)
    SHARED_REFERENCE  → present in ALL databases (global read-only master data)
    PLATFORM_TEMPLATE → present in smritisys as a template; copied to tenants at provisioning

All guards, seeders, migrations, and tests DERIVE their enforcement from this module.
No hardcoded forbidden-table lists anywhere else in the codebase.

MANDATORY: When adding a new table (via Alembic or ORM), you MUST add its ownership entry
here BEFORE the migration is run. The CI guard enforces this.
"""

from enum import Enum
from typing import Dict, FrozenSet


class TableOwner(str, Enum):
    CONTROL_PLANE = "control"
    TENANT = "tenant"
    SHARED_REFERENCE = "shared"
    PLATFORM_TEMPLATE = "template"


# ---------------------------------------------------------------------------
# CANONICAL TABLE OWNERSHIP REGISTRY
# Every table in the system is declared here exactly once.
# ---------------------------------------------------------------------------
TABLE_OWNERSHIP: Dict[str, TableOwner] = {

    # ================================================================
    # CONTROL PLANE — smritisys ONLY
    # Governance, routing, identity, platform configuration
    # ================================================================

    # Company & Branch Registry
    "companies":                             TableOwner.CONTROL_PLANE,
    "branches":                              TableOwner.CONTROL_PLANE,
    "company_database_registries":           TableOwner.CONTROL_PLANE,

    # Auth & Identity
    "users":                                 TableOwner.CONTROL_PLANE,
    "roles":                                 TableOwner.CONTROL_PLANE,
    "refresh_token_blacklist":               TableOwner.CONTROL_PLANE,
    "user_company_assignments":              TableOwner.CONTROL_PLANE,
    "user_branch_assignments":               TableOwner.CONTROL_PLANE,
    "user_store_assignments":                TableOwner.CONTROL_PLANE,
    "smriti_identity_registry":              TableOwner.CONTROL_PLANE,
    "smriti_identity_alias":                TableOwner.CONTROL_PLANE,
    "smriti_identity_allocation_log":       TableOwner.CONTROL_PLANE,

    # Menu & Navigation
    "smriti_menus":                          TableOwner.CONTROL_PLANE,
    "smriti_permissions":                    TableOwner.CONTROL_PLANE,
    "smriti_audit_log":                      TableOwner.CONTROL_PLANE,
    "smriti_legacy_menu_map":                TableOwner.CONTROL_PLANE,
    "smriti_numbering_registry":             TableOwner.CONTROL_PLANE,

    # System Configuration
    "system_configs":                        TableOwner.CONTROL_PLANE,

    # Platform Capabilities & Workspace
    "platform_capabilities":                 TableOwner.CONTROL_PLANE,
    "workspace_templates":                   TableOwner.CONTROL_PLANE,

    # UI Control Plane
    "smriti_themes":                         TableOwner.CONTROL_PLANE,
    "smriti_theme_variants":                 TableOwner.CONTROL_PLANE,
    "smriti_workspace_profiles":             TableOwner.CONTROL_PLANE,
    "screen_definitions":                    TableOwner.CONTROL_PLANE,
    "field_definitions":                     TableOwner.CONTROL_PLANE,
    "action_definitions":                    TableOwner.CONTROL_PLANE,
    "layout_definitions":                    TableOwner.CONTROL_PLANE,
    "icon_registry":                         TableOwner.CONTROL_PLANE,

    # Integration Hub Registry (platform metadata)
    "provider_registry":                     TableOwner.CONTROL_PLANE,
    "connector_registry":                    TableOwner.CONTROL_PLANE,
    "integration_registry":                  TableOwner.CONTROL_PLANE,
    "integration_credentials_reference":     TableOwner.CONTROL_PLANE,
    "integration_policies":                  TableOwner.CONTROL_PLANE,
    "integration_versions":                  TableOwner.CONTROL_PLANE,

    # Governed Logic — Platform Definitions
    "formula_definitions":                   TableOwner.CONTROL_PLANE,
    "business_rule_definitions":             TableOwner.CONTROL_PLANE,
    "workflow_definitions":                  TableOwner.CONTROL_PLANE,

    # Architecture Governance
    "architecture_domains":                  TableOwner.CONTROL_PLANE,
    "architecture_entities":                 TableOwner.CONTROL_PLANE,
    "architecture_capabilities":             TableOwner.CONTROL_PLANE,
    "architecture_decisions":                TableOwner.CONTROL_PLANE,

    # Architecture Governance Additional
    "architecture_apis":                     TableOwner.CONTROL_PLANE,
    "architecture_certificates":             TableOwner.CONTROL_PLANE,
    "architecture_files":                    TableOwner.CONTROL_PLANE,
    "module_audit_logs":                     TableOwner.CONTROL_PLANE,
    "module_states":                         TableOwner.CONTROL_PLANE,
    "control_psv_configs":                   TableOwner.CONTROL_PLANE,
    "system_parameters":                     TableOwner.CONTROL_PLANE,

    # Migration tracking
    "alembic_version":                       TableOwner.CONTROL_PLANE,

    # ================================================================
    # TENANT — smritiXXX ONLY (FORBIDDEN in smritisys)
    # All company operational, master, and transactional data
    # ================================================================

    # CRM / Customer Master & Parties
    "customers":                             TableOwner.TENANT,
    "customer_groups":                       TableOwner.TENANT,
    "customer_gst_registrations":            TableOwner.TENANT,
    "customer_delivery_locations":           TableOwner.TENANT,
    "customer_billing_locations":            TableOwner.TENANT,
    "customer_external_identities":          TableOwner.TENANT,
    "customer_article_mappings":             TableOwner.TENANT,
    "customer_credit_ledger_entries":        TableOwner.TENANT,
    "customer_purchase_orders":              TableOwner.TENANT,
    "customer_purchase_order_lines":         TableOwner.TENANT,
    "customer_po_invoice_allocations":       TableOwner.TENANT,
    "customer_price_assignments":            TableOwner.TENANT,
    "customer_price_tiers":                  TableOwner.TENANT,
    "customer_profiles":                     TableOwner.TENANT,
    "crm_campaigns":                         TableOwner.TENANT,
    "crm_customer_activities":               TableOwner.TENANT,
    "crm_leads":                             TableOwner.TENANT,
    "crm_opportunities":                     TableOwner.TENANT,
    "parties":                               TableOwner.TENANT,
    "party_addresses":                       TableOwner.TENANT,
    "party_contacts":                        TableOwner.TENANT,
    "party_relationships":                   TableOwner.TENANT,
    "party_roles":                           TableOwner.TENANT,
    "party_bank_accounts":                   TableOwner.TENANT,
    "vendor_identity_migrations":            TableOwner.TENANT,
    "customer_policies":                     TableOwner.TENANT,
    "customer_relationships":                TableOwner.TENANT,
    "dealer_assignments":                    TableOwner.TENANT,

    # Loyalty & CRM Operational
    "loyalty_members":                       TableOwner.TENANT,
    "loyalty_tiers":                         TableOwner.TENANT,
    "loyalty_rules":                         TableOwner.TENANT,
    "loyalty_points_ledgers":                TableOwner.TENANT,
    "loyalty_redemptions":                   TableOwner.TENANT,
    "loyalty_transactions":                  TableOwner.TENANT,
    "referral_programs":                     TableOwner.TENANT,
    "referral_relationships":                TableOwner.TENANT,
    "referral_rewards":                      TableOwner.TENANT,

    # Sales & Billing
    "sales_invoices":                        TableOwner.TENANT,
    "sales_invoice_items":                   TableOwner.TENANT,
    "sales_invoice_lines":                   TableOwner.TENANT,
    "sales_orders":                          TableOwner.TENANT,
    "sales_order_items":                     TableOwner.TENANT,
    "sales_order_invoice_allocations":       TableOwner.TENANT,
    "sales_order_reservations":              TableOwner.TENANT,
    "sales_quotations":                      TableOwner.TENANT,
    "sales_quotation_items":                 TableOwner.TENANT,
    "sales_returns":                         TableOwner.TENANT,
    "sales_return_items":                    TableOwner.TENANT,
    "sales_factors":                         TableOwner.TENANT,
    "billing_csv_import_logs":               TableOwner.TENANT,
    "billing_csv_templates":                 TableOwner.TENANT,
    "invoice_customer_change_logs":          TableOwner.TENANT,
    "invoice_document_artifacts":            TableOwner.TENANT,
    "invoice_profitability_ledgers":          TableOwner.TENANT,
    "tax_invoice_templates":                 TableOwner.TENANT,
    "tax_invoice_template_versions":         TableOwner.TENANT,

    # POS
    "shifts":                                TableOwner.TENANT,
    "cash_registers":                        TableOwner.TENANT,
    "shift_cash_transactions":               TableOwner.TENANT,
    "pos_sessions":                          TableOwner.TENANT,
    "pos_offline_sync_queue":                TableOwner.TENANT,
    "pos_parked_carts":                      TableOwner.TENANT,
    "pos_profiles":                          TableOwner.TENANT,
    "pos_shift_denomination_counts":         TableOwner.TENANT,
    "legacy_pos_shifts":                     TableOwner.TENANT,

    # Item / Product Catalog & Attributes
    "products":                              TableOwner.TENANT,
    "items":                                 TableOwner.TENANT,
    "item_variants":                         TableOwner.TENANT,
    "item_barcodes":                         TableOwner.TENANT,
    "item_price_lists":                      TableOwner.TENANT,
    "item_batches":                          TableOwner.TENANT,
    "item_serials":                          TableOwner.TENANT,
    "item_warehouse_locations":              TableOwner.TENANT,
    "attribute_definitions":                 TableOwner.TENANT,
    "attribute_groups":                      TableOwner.TENANT,
    "category_attribute_group_mappings":     TableOwner.TENANT,
    "size_groups":                           TableOwner.TENANT,
    "size_group_values":                     TableOwner.TENANT,
    "variant_templates":                     TableOwner.TENANT,
    "vendor_product_assignments":            TableOwner.TENANT,
    "product_cost_valuations":               TableOwner.TENANT,
    "po_product_decision_log":               TableOwner.TENANT,

    # Inventory / Stock
    "stock_movements":                       TableOwner.TENANT,
    "product_batch_stocks":                  TableOwner.TENANT,
    "stock_transfers":                       TableOwner.TENANT,
    "stock_transfer_items":                  TableOwner.TENANT,
    "stock_audits":                          TableOwner.TENANT,
    "stock_audit_items":                     TableOwner.TENANT,
    "inventory_snapshots":                   TableOwner.TENANT,
    "stock_takes":                           TableOwner.TENANT,
    "stock_count_lines":                     TableOwner.TENANT,

    # Warehouses / WMS / Logistics
    "warehouses":                            TableOwner.TENANT,
    "stores":                                TableOwner.TENANT,
    "warehouse_locations":                   TableOwner.TENANT,
    "warehouse_zones":                       TableOwner.TENANT,
    "packing_slips":                         TableOwner.TENANT,
    "packing_slip_items":                    TableOwner.TENANT,
    "dispatches":                            TableOwner.TENANT,
    "dispatch_items":                        TableOwner.TENANT,
    "loading_sheets":                        TableOwner.TENANT,
    "loading_sheet_items":                   TableOwner.TENANT,
    "reverse_logistics_returns":             TableOwner.TENANT,

    # Distribution
    "distribution_claims":                   TableOwner.TENANT,
    "distribution_orders":                   TableOwner.TENANT,
    "distribution_order_items":              TableOwner.TENANT,
    "distribution_routes":                   TableOwner.TENANT,
    "distribution_route_stops":              TableOwner.TENANT,
    "distribution_settlements":              TableOwner.TENANT,
    "distribution_territories":              TableOwner.TENANT,
    "delivery_commission_settlements":       TableOwner.TENANT,

    # eCommerce
    "ecom_channels":                         TableOwner.TENANT,
    "ecom_order_imports":                    TableOwner.TENANT,
    "ecom_reconciliations":                  TableOwner.TENANT,
    "ecom_sku_mappings":                     TableOwner.TENANT,
    "ecom_stock_sync_logs":                  TableOwner.TENANT,

    # Purchase / Procurement
    "purchase_orders":                       TableOwner.TENANT,
    "purchase_order_items":                  TableOwner.TENANT,
    "purchase_receipts":                     TableOwner.TENANT,
    "purchase_receipt_items":                TableOwner.TENANT,
    "purchase_reorder_configs":              TableOwner.TENANT,
    "purchase_jurisdiction_configs":         TableOwner.TENANT,
    "suppliers":                             TableOwner.TENANT,
    "supplier_payments":                     TableOwner.TENANT,
    "supplier_profiles":                     TableOwner.TENANT,
    "inward_cost_adjustments":               TableOwner.TENANT,
    "inward_cost_allocations":               TableOwner.TENANT,
    "inward_cost_components":                TableOwner.TENANT,
    "inward_cost_component_types":           TableOwner.TENANT,
    "transaction_cost_snapshots":            TableOwner.TENANT,

    # Accounting / Finance
    "accounts":                              TableOwner.TENANT,
    "journal_vouchers":                      TableOwner.TENANT,
    "general_ledger_entries":                TableOwner.TENANT,
    "account_balance_snapshots":             TableOwner.TENANT,
    "fiscal_years":                          TableOwner.TENANT,
    "fiscal_periods":                        TableOwner.TENANT,
    "bank_statements":                       TableOwner.TENANT,
    "bank_statement_lines":                  TableOwner.TENANT,
    "bank_reconciliations":                  TableOwner.TENANT,
    "company_bank_accounts":                 TableOwner.TENANT,
    "company_policy_settings":               TableOwner.TENANT,
    "payment_allocations":                   TableOwner.TENANT,
    "payment_transactions":                  TableOwner.TENANT,
    "tally_configs":                         TableOwner.TENANT,

    # GST / Compliance
    "compliance_credentials":                TableOwner.TENANT,
    "compliance_outboxes":                   TableOwner.TENANT,
    "eway_bills":                            TableOwner.TENANT,
    "einvoice_records":                      TableOwner.TENANT,
    "gstin_registrations":                   TableOwner.TENANT,
    "compliance_audit_logs":                 TableOwner.TENANT,
    "compliance_immutable_audit_logs":       TableOwner.TENANT,
    "compliance_thresholds":                 TableOwner.TENANT,
    "government_services":                   TableOwner.TENANT,

    # PSV (Party Stock Visibility — distributor operations)
    "psv_parties":                           TableOwner.TENANT,
    "psv_party_sku_tracking":                TableOwner.TENANT,
    "psv_party_scopes":                      TableOwner.TENANT,
    "psv_sku_tracking":                      TableOwner.TENANT,
    "psv_stock_balances":                    TableOwner.TENANT,
    "psv_stock_events":                      TableOwner.TENANT,
    "psv_visibility_policies":               TableOwner.TENANT,

    # PDT (Product Digital Twin)
    "pdt_demand_signals":                    TableOwner.TENANT,
    "pdt_distribution_predictions":          TableOwner.TENANT,
    "pdt_model_registry":                    TableOwner.TENANT,
    "pdt_sku_twin_cache":                    TableOwner.TENANT,

    # Barcode & Label Printing
    "barcode_layouts":                       TableOwner.TENANT,
    "barcode_providers":                     TableOwner.TENANT,
    "barcode_registry_audit":                TableOwner.TENANT,
    "identity_rules":                        TableOwner.TENANT,
    "print_histories":                       TableOwner.TENANT,
    "print_history":                         TableOwner.TENANT,
    "print_profiles":                        TableOwner.TENANT,
    "print_templates":                       TableOwner.TENANT,
    "product_identities":                    TableOwner.TENANT,

    # Document Management & Series
    "document_series":                       TableOwner.TENANT,
    "document_series_sequences":             TableOwner.TENANT,
    "numbering_audit_logs":                  TableOwner.TENANT,

    # Company Configuration & Overrides
    "company_settings":                      TableOwner.TENANT,
    "company_feature_overrides":             TableOwner.TENANT,
    "master_values":                         TableOwner.TENANT,
    "tenant_capability_bindings":            TableOwner.TENANT,
    "feature_flags":                         TableOwner.TENANT,
    "policy_definitions":                    TableOwner.TENANT,
    "user_workspace_configs":                TableOwner.TENANT,
    "legacy_id_mappings":                    TableOwner.TENANT,

    # HR & Commission
    "employees":                             TableOwner.TENANT,
    "employee_shifts":                       TableOwner.TENANT,
    "attendance_records":                    TableOwner.TENANT,
    "commission_programs":                   TableOwner.TENANT,
    "commission_entries":                    TableOwner.TENANT,
    "commission_ledgers":                    TableOwner.TENANT,
    "commission_participants":               TableOwner.TENANT,
    "commission_rules":                      TableOwner.TENANT,
    "leave_balances":                        TableOwner.TENANT,
    "leave_requests":                        TableOwner.TENANT,
    "staff_profiles":                        TableOwner.TENANT,
    "staff_profile_history":                 TableOwner.TENANT,
    "staff_placement_assignments":           TableOwner.TENANT,
    "training_sessions":                     TableOwner.TENANT,
    "training_progress":                     TableOwner.TENANT,
    "training_certificates":                 TableOwner.TENANT,

    # Promotions & Dynamic Pricing
    "promotions":                            TableOwner.TENANT,
    "promotion_rules":                       TableOwner.TENANT,
    "discount_schedules":                    TableOwner.TENANT,
    "cge_unified_policies":                  TableOwner.TENANT,
    "coupons":                               TableOwner.TENANT,
    "price_books":                           TableOwner.TENANT,
    "price_book_entries":                    TableOwner.TENANT,
    "promotion_campaigns":                   TableOwner.TENANT,
    "promotion_redemptions":                 TableOwner.TENANT,
    "smriti_promotion_audit":                TableOwner.TENANT,
    "smriti_promotion_conditions":           TableOwner.TENANT,
    "smriti_promotion_conflicts":            TableOwner.TENANT,
    "smriti_promotion_declines":             TableOwner.TENANT,
    "smriti_promotion_import_rows":          TableOwner.TENANT,
    "smriti_promotion_imports":              TableOwner.TENANT,
    "smriti_promotion_overrides":            TableOwner.TENANT,
    "smriti_promotion_qualifications":       TableOwner.TENANT,
    "smriti_promotion_redemption_items":     TableOwner.TENANT,
    "smriti_promotion_redemptions":          TableOwner.TENANT,
    "smriti_promotion_rewards":              TableOwner.TENANT,
    "smriti_promotion_rules":                TableOwner.TENANT,
    "smriti_promotion_scope_items":          TableOwner.TENANT,
    "smriti_promotion_scopes":               TableOwner.TENANT,
    "smriti_promotion_simulation_items":     TableOwner.TENANT,
    "smriti_promotion_simulations":          TableOwner.TENANT,
    "smriti_promotion_versions":             TableOwner.TENANT,
    "smriti_promotions":                     TableOwner.TENANT,

    # Terms & Approvals
    "terms_clauses":                         TableOwner.TENANT,
    "terms_defaults":                        TableOwner.TENANT,
    "terms_snapshots":                       TableOwner.TENANT,
    "approval_actions":                      TableOwner.TENANT,
    "approval_policies":                     TableOwner.TENANT,
    "approval_requests":                     TableOwner.TENANT,
    "approval_workflow_logs":                TableOwner.TENANT,
    "workflow_events":                       TableOwner.TENANT,

    # Communication & Exchange
    "communicator_logs":                     TableOwner.TENANT,
    "communicator_templates":                TableOwner.TENANT,
    "data_exchange_field_mappings":          TableOwner.TENANT,
    "data_exchange_tasks":                   TableOwner.TENANT,
    "sync_queue":                            TableOwner.TENANT,
    "integration_outbox_events":             TableOwner.TENANT,
    "audit_logs":                            TableOwner.TENANT,

    # Reports & Analytics
    "report_definitions":                    TableOwner.TENANT,
    "report_schedules":                      TableOwner.TENANT,
    "report_outputs":                        TableOwner.TENANT,
    "report_dispatch_logs":                  TableOwner.TENANT,
    "report_saved_views":                    TableOwner.TENANT,
    "prepared_reports":                      TableOwner.TENANT,
    "analytics_daily_sales_facts":           TableOwner.TENANT,
    "dashboard_widgets":                     TableOwner.TENANT,
    "dashboards":                            TableOwner.TENANT,

    # ================================================================
    # SHARED_REFERENCE — Present in ALL databases (read-only master)
    # Seeded identically into smritisys and all tenant DBs
    # ================================================================
    "countries_ref":                         TableOwner.SHARED_REFERENCE,
    "states_ref":                            TableOwner.SHARED_REFERENCE,
    "districts_ref":                         TableOwner.SHARED_REFERENCE,
    "postal_codes_ref":                      TableOwner.SHARED_REFERENCE,
    "language_refs":                         TableOwner.SHARED_REFERENCE,
    "languages_ref":                         TableOwner.SHARED_REFERENCE,
    "locale_refs":                           TableOwner.SHARED_REFERENCE,
    "locales_ref":                           TableOwner.SHARED_REFERENCE,
    "translation_key_refs":                  TableOwner.SHARED_REFERENCE,
    "translation_keys_ref":                  TableOwner.SHARED_REFERENCE,
    "translation_refs":                      TableOwner.SHARED_REFERENCE,
    "translations_ref":                      TableOwner.SHARED_REFERENCE,
    "currency_refs":                         TableOwner.SHARED_REFERENCE,
    "currencies_ref":                        TableOwner.SHARED_REFERENCE,
    "currency_exchange_rates":               TableOwner.SHARED_REFERENCE,
    "uom_refs":                              TableOwner.SHARED_REFERENCE,
    "uoms_ref":                              TableOwner.SHARED_REFERENCE,
    "uom_conversion_refs":                   TableOwner.SHARED_REFERENCE,
    "uom_conversions_ref":                   TableOwner.SHARED_REFERENCE,
    "tax_reference_refs":                    TableOwner.SHARED_REFERENCE,
    "tax_references_ref":                    TableOwner.SHARED_REFERENCE,
    "hsn_sac_code_refs":                     TableOwner.SHARED_REFERENCE,
    "hsn_sac_codes_ref":                     TableOwner.SHARED_REFERENCE,
    "platform_reference_data":               TableOwner.SHARED_REFERENCE,
    "master_types":                          TableOwner.SHARED_REFERENCE,
    # Older schema names (for backward compatibility)
    "countries":                             TableOwner.SHARED_REFERENCE,
    "states":                                TableOwner.SHARED_REFERENCE,
    "districts":                             TableOwner.SHARED_REFERENCE,
    "hsn_codes":                             TableOwner.SHARED_REFERENCE,
    "tax_rates":                             TableOwner.SHARED_REFERENCE,

    # ================================================================
    # PLATFORM_TEMPLATE — In smritisys as template for tenant provisioning
    # Copied to each tenant DB during company provisioning.
    # NOT operational data — read-only template in smritisys.
    # ================================================================

    # (Currently empty — accounts moved to TENANT based on audit evidence.
    #  Chart of Accounts contamination in smritisys is disposition-pending.)
}


# ---------------------------------------------------------------------------
# Derived sets — computed once at import time from TABLE_OWNERSHIP
# ---------------------------------------------------------------------------

def _derive_set(owner: TableOwner) -> FrozenSet[str]:
    return frozenset(t for t, o in TABLE_OWNERSHIP.items() if o == owner)


#: Tables that MUST NOT appear in smritisys (the primary guard set)
TENANT_OWNED_TABLES: FrozenSet[str] = _derive_set(TableOwner.TENANT)

#: Tables that belong only in smritisys
CONTROL_PLANE_TABLES: FrozenSet[str] = _derive_set(TableOwner.CONTROL_PLANE)

#: Tables present in all databases (global reference data)
SHARED_REFERENCE_TABLES: FrozenSet[str] = _derive_set(TableOwner.SHARED_REFERENCE)

#: Tables used as templates in smritisys for tenant bootstrapping
PLATFORM_TEMPLATE_TABLES: FrozenSet[str] = _derive_set(TableOwner.PLATFORM_TEMPLATE)

#: All tables with a declared owner
ALL_DECLARED_TABLES: FrozenSet[str] = frozenset(TABLE_OWNERSHIP.keys())

#: Tables permitted in smritisys (CP + templates + shared)
PERMITTED_IN_CONTROL_PLANE: FrozenSet[str] = (
    CONTROL_PLANE_TABLES | PLATFORM_TEMPLATE_TABLES | SHARED_REFERENCE_TABLES
    | frozenset({"alembic_version"})
)


def get_owner(table_name: str) -> TableOwner | None:
    """Return the canonical owner of a table, or None if undeclared."""
    return TABLE_OWNERSHIP.get(str(table_name).lower().strip())


def is_tenant_table(table_name: str) -> bool:
    """Return True if the table is tenant-operational (forbidden in smritisys)."""
    return get_owner(table_name) == TableOwner.TENANT


def is_control_plane_table(table_name: str) -> bool:
    """Return True if the table belongs exclusively in smritisys."""
    return get_owner(table_name) == TableOwner.CONTROL_PLANE


def is_permitted_in_smritisys(table_name: str) -> bool:
    """Return True if the table may legitimately exist in smritisys."""
    owner = get_owner(table_name)
    return owner in (
        TableOwner.CONTROL_PLANE,
        TableOwner.SHARED_REFERENCE,
        TableOwner.PLATFORM_TEMPLATE,
    )


def assert_no_overlap() -> None:
    """
    Invariant check: no table should appear in more than one non-SHARED owner.
    Called at module import and in tests.
    """
    cp = CONTROL_PLANE_TABLES
    tenant = TENANT_OWNED_TABLES
    template = PLATFORM_TEMPLATE_TABLES

    overlap_cp_tenant = cp & tenant
    overlap_cp_template = cp & template
    overlap_tenant_template = tenant & template

    errors = []
    if overlap_cp_tenant:
        errors.append(f"Tables in both CONTROL_PLANE and TENANT: {overlap_cp_tenant}")
    if overlap_cp_template:
        errors.append(f"Tables in both CONTROL_PLANE and PLATFORM_TEMPLATE: {overlap_cp_template}")
    if overlap_tenant_template:
        errors.append(f"Tables in both TENANT and PLATFORM_TEMPLATE: {overlap_tenant_template}")
    if errors:
        raise ValueError(
            "TABLE_OWNERSHIP invariant violated:\n" + "\n".join(errors)
        )


# Run invariant check at import time — catches misconfiguration immediately
assert_no_overlap()
