"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.17.0
Created      : 2026-07-11
Modified     : 2026-07-14
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import asyncio
import os
import re
import sys
from logging.config import fileConfig
from sqlalchemy.ext.asyncio import create_async_engine
from alembic import context

# Ensure backend root is in sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# Load root .env if present before importing settings
try:
    from dotenv import dotenv_values
    root_env = os.path.abspath(os.path.join(backend_dir, "..", ".env"))
    if os.path.exists(root_env):
        for k, v in dotenv_values(root_env).items():
            if v is not None and k not in os.environ:
                os.environ[k] = v
except ImportError:
    pass

# Import our settings and base metadata
from app.core.config import settings
from app.db.base import Base

# Import all models to ensure they are registered on Base.metadata
from app.models.crm import (
    CustomerGroup, Customer, CustomerGSTRegistration, CustomerDeliveryLocation,
    CustomerBillingLocation, CustomerExternalIdentity, CustomerPolicy,
    CustomerRelationship,
)
from app.models.loyalty import LoyaltyMember
from app.models.inventory import Product, StockMovement, Warehouse
from app.models.sales import (
    SalesInvoice, SalesInvoiceItem,
    SalesQuotation, SalesQuotationItem,
    SalesOrder, SalesOrderItem,
    SalesReturn, SalesReturnItem,
)
from app.models.customer_po import CustomerPurchaseOrder, CustomerPurchaseOrderLine, CustomerPOInvoiceAllocation
from app.models.customer_article_mapping import CustomerArticleMapping
from app.models.tenant import Company, Branch
from app.models.auth import User, RefreshTokenBlacklist
from app.models.purchase import (
    Supplier,
    PurchaseOrder, PurchaseOrderItem,
    PurchaseReceipt, PurchaseReceiptItem,
    PurchaseReorderConfig, PurchaseJurisdictionConfig,
)
from app.models.pos import CashRegister, Shift
from app.models.supplier_payment import SupplierPayment
from app.compliance.models import (
    GovernmentService,
    ComplianceCredentials,
    ComplianceAuditLog,
    ComplianceOutbox,
)
from app.models.numbering import DocumentSeries, NumberingAuditLog
from app.models.terms import TermsClause, TermsDefault, TermsSnapshot, ApprovalWorkflowLog
from app.models.attributes import AttributeDefinition, AttributeGroup, VariantTemplate, CategoryAttributeGroupMapping
from app.models.size_groups import SizeGroup, SizeGroupValue
from app.models.barcode import BarcodeLayout, PrintTemplate, PrintProfile
from app.models.exchange import DataExchangeTask, DataExchangeFieldMapping
from app.models.product_identity import BarcodeProvider, IdentityRule, ProductIdentity
from app.models.role import Role
from app.models.master_lookup import MasterType, MasterValue
from app.models.user_assignment import UserCompanyAssignment, UserBranchAssignment
from app.models.staff_profile import StaffProfile
from app.models.staff_profile_history import StaffProfileHistory
# v1368: UI/Experience Engine (smritisys Control Plane)
from app.models.ui_control_plane import (
    SmritiTheme, SmritiThemeVariant, SmritiWorkspaceProfile,
    ScreenDefinition, FieldDefinition, ActionDefinition, LayoutDefinition, IconRegistry,
)
# v1369: Integration Hub Registry (smritisys Control Plane)
from app.models.integration_hub import (
    ProviderRegistry, ConnectorRegistry, IntegrationRegistry,
    IntegrationCredentialReference, IntegrationPolicy, IntegrationVersion,
)
# v1464: Unified Identity Control Plane
from app.models.identity_registry import (
    SmritiIdentityRegistry, SmritiNumberingRegistry,
    SmritiIdentityAlias, SmritiIdentityAllocationLog,
)
config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def validate_company_database_name(database_name: str) -> bool:
    """Allow registered-company database naming shapes and ephemeral test databases for tenant runs."""
    if not database_name:
        return False
    clean_name = str(database_name).strip().lower()
    return bool(
        re.fullmatch(r"smriti(?!000$|sys$)[a-z0-9]{3,12}", clean_name)
        or re.fullmatch(r"smriti_test_[a-z0-9_]+", clean_name)
    )


try:
    from app.db.ownership import TENANT_OWNED_TABLES
    TENANT_ONLY_TABLES = TENANT_OWNED_TABLES
except ImportError:
    TENANT_ONLY_TABLES = {
        "customer_groups", "customers", "customer_gst_registrations", "customer_delivery_locations",
        "customer_billing_locations", "customer_external_identities", "customer_policies",
        "customer_relationships", "loyalty_tiers", "loyalty_rules", "loyalty_members",
        "loyalty_points_ledgers", "customer_credit_ledger_entries",
    }

def include_object(object, name, type_, reflected, compare_to):
    """
    Filter objects so that Alembic only manages the SMRITI tables,
    preventing drops on other tables.
    """
    if type_ == "table":
        target = (context.get_x_argument(as_dictionary=True).get("target") or os.getenv("ALEMBIC_TARGET") or "").lower()
        if target == "control" and name in TENANT_ONLY_TABLES:
            return False
        return name in [
            "customer_groups",
            "customers",
            "customer_gst_registrations",
            "customer_delivery_locations",
            "customer_billing_locations",
            "customer_external_identities",
            "customer_policies",
            "customer_relationships",
            "products",
            "stock_movements",
            "sales_invoices",
            "sales_invoice_items",
            "customer_purchase_orders",
            "customer_purchase_order_lines",
            "customer_po_invoice_allocations",
            "customer_article_mappings",
            "companies",
            "branches",
            "user_company_assignments",
            "user_branch_assignments",
            "user_store_assignments",
            "users",
            "refresh_token_blacklist",
            "purchase_orders",
            "purchase_order_items",
            "purchase_receipts",
            "purchase_receipt_items",
            "suppliers",
            "cash_registers",
            "shifts",
            "supplier_payments",
            "government_services",
            "compliance_credentials",
            "compliance_audit_logs",
            "compliance_outboxes",
            "document_series",
            "numbering_audit_logs",
            "terms_clauses",
            "terms_defaults",
            "terms_snapshots",
            "approval_workflow_logs",
            "attribute_definitions",
            "attribute_groups",
            "variant_templates",
            "category_attribute_group_mappings",
            "size_groups",
            "size_group_values",
            "barcode_layouts",
            "print_templates",
            "print_profiles",
            "data_exchange_tasks",
            "data_exchange_field_mappings",
            "roles",
            "stores",
            "warehouses",
            "barcode_providers",
            "identity_rules",
            "product_identities",
            "items",
            "item_variants",
            "item_barcodes",
            "barcode_registry_audit",
            "master_types",
            "master_values",
            "sales_quotations",
            "sales_quotation_items",
            "sales_orders",
            "sales_order_items",
            "sales_returns",
            "sales_return_items",
            "purchase_reorder_configs",
            "purchase_jurisdiction_configs",
            "product_batch_stocks",
            "stock_transfers",
            "stock_transfer_items",
            "stock_audits",
            "stock_audit_items",
            "eway_bills",
            "pricing_rules",
            "price_books",
            "price_book_entries",
            "payment_transactions",
            "approval_rules",
            "approval_requests",
            "communication_templates",
            "communication_dispatches",
            "integration_outbox_events",
            "accounts",
            "journal_vouchers",
            "general_ledger_entries",
            "account_balance_snapshots",
            "fiscal_years",
            "fiscal_periods",
            "bank_statements",
            "bank_statement_lines",
            "currency_exchange_rates",
            "shift_cash_transactions",
            # v1368: UI/Experience Engine
            "screen_definitions",
            "field_definitions",
            "action_definitions",
            "layout_definitions",
            "icon_registry",
            # v1369: Integration Hub Registry
            "provider_registry",
            "connector_registry",
            "integration_registry",
            "integration_credentials_reference",
            "integration_policies",
            "integration_versions",
            # v1464: Unified Identity Control Plane
            "smriti_identity_registry",
            "smriti_numbering_registry",
            "smriti_identity_alias",
            "smriti_identity_allocation_log",
        ]
    return True




def get_target_db_url() -> str:
    x_args = context.get_x_argument(as_dictionary=True)
    target = (x_args.get("target") or os.getenv("ALEMBIC_TARGET") or "").strip().lower()
    if "db_url" in x_args:
        target_url = x_args["db_url"]
    elif "db" in x_args:
        db_name = x_args["db"]
        from urllib.parse import urlparse
        parsed = urlparse(settings.DATABASE_URL)
        scheme = parsed.scheme or "postgresql+asyncpg"
        user = parsed.username or os.getenv("POSTGRES_USER")
        password = parsed.password or os.getenv("POSTGRES_PASSWORD")
        host = parsed.hostname or os.getenv("POSTGRES_HOST") or "localhost"
        port = int(parsed.port or os.getenv("POSTGRES_PORT") or 5432)
        auth = f"{user}:{password}@" if (user and password) else (f"{user}@" if user else "")
        target_url = f"{scheme}://{auth}{host}:{port}/{db_name}"
    else:
        target_url = config.get_main_option("sqlalchemy.url") or settings.DATABASE_URL

    from urllib.parse import urlparse
    target_database = (urlparse(target_url).path or "").lstrip("/").split("?", 1)[0].lower()
    if target not in {"control", "tenant"}:
        raise RuntimeError(
            "Alembic target is required: use -x target=control -x db=smritisys "
            "or -x target=tenant -x db=<company database>."
        )
    if target == "control" and target_database != "smritisys":
        raise RuntimeError("Control-plane migrations must target database smritisys.")
    if target == "tenant" and target_database == "smritisys":
        raise RuntimeError("Tenant migrations must not target database smritisys.")
    if target == "tenant" and not validate_company_database_name(target_database):
        raise RuntimeError(f"Invalid tenant migration database: {target_database}")
    return target_url



def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = get_target_db_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        include_object=include_object
    )

    with context.begin_transaction():
        context.run_migrations()

def do_run_migrations(connection) -> None:
    context.configure(
        connection=connection, 
        target_metadata=target_metadata,
        include_object=include_object
    )

    # Candidate #5 Track 1: Fresh-Install Bootstrap Prerequisite Hook
    # Ensures sales_orders.po_number is present on fresh installs before v1403 executes.
    mig_ctx = context.get_context()
    orig_migrations_fn = mig_ctx._migrations_fn

    if orig_migrations_fn is not None:
        def wrapped_migrations_fn(heads, m_ctx):
            for step in orig_migrations_fn(heads, m_ctx):
                if step.is_upgrade and "v1403_so_line_reconcile" in getattr(step, "to_revisions_no_deps", ()):
                    orig_step_fn = step.migration_fn
                    def wrapped_step_fn(**kw):
                        from app.db.bootstrap import (
                            bootstrap_company_database_prerequisites,
                            is_company_database_target,
                        )
                        import sqlalchemy as sa
                        curr_db = connection.execute(sa.text("SELECT current_database();")).scalar()
                        if is_company_database_target(curr_db):
                            bootstrap_company_database_prerequisites(connection, db_name=curr_db)
                        return orig_step_fn(**kw)
                    step.migration_fn = wrapped_step_fn
                yield step
        mig_ctx._migrations_fn = wrapped_migrations_fn

    with context.begin_transaction():
        context.run_migrations()


from sqlalchemy import create_engine

async def run_async_migrations() -> None:
    database_url = get_target_db_url()
    connectable = create_async_engine(database_url)

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()

def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    database_url = get_target_db_url()
    sync_url = database_url.replace("postgresql+asyncpg://", "postgresql+psycopg2://")
    connectable = create_engine(sync_url)
    with connectable.connect() as connection:
        do_run_migrations(connection)
    connectable.dispose()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
