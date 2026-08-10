"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.24.0
Created      : 2026-07-11
Modified     : 2026-07-19
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import sys
import os
import asyncio
from logging.config import fileConfig
from sqlalchemy.ext.asyncio import create_async_engine
import sqlalchemy as sa
from alembic import context

# Ensure backend root is in sys.path for app module imports
backend_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_root not in sys.path:
    sys.path.insert(0, backend_root)

# Import our settings and base metadata
from app.core.config import settings
from app.db.base import Base

# Import all models to ensure they are registered on Base.metadata
from app.models.crm import CustomerGroup, PricingGroup, Customer
from app.models.inventory import Product, StockMovement, Store, Warehouse
from app.models.inventory_kernel import (
    InventoryLocationNode,
    InventoryIdentityRecord,
    InventoryLedgerEntry,
    ReservationLedgerEntry,
    CostLayerLedgerEntry,
    InventorySnapshotRecord,
    DocumentPostingProfileRecord,
    InventoryLockRecord,
    PlatformIdempotencyRecord,
    InventoryCheckpointRecord,
)
from app.models.sales import (
    SalesInvoice, SalesInvoiceItem,
    SalesQuotation, SalesQuotationItem,
    SalesOrder, SalesOrderItem,
    SalesReturn, SalesReturnItem,
)
from app.models.tenant import Company, Branch
from app.models.auth import User, RefreshTokenBlacklist
from app.models.purchase import (
    Supplier,
    PurchaseOrder, PurchaseOrderItem,
    PurchaseReceipt, PurchaseReceiptItem,
    PurchaseReorderConfig, PurchaseJurisdictionConfig,
)
from app.models.pos import PosSession, PosTransaction, PosTransactionItem, PosOfflineSyncQueue
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
from app.models.barcode import BarcodeLayout, PrintTemplate, PrintProfile
from app.models.exchange import DataExchangeTask, DataExchangeFieldMapping
from app.models.product_identity import BarcodeProvider, IdentityRule, ProductIdentity
from app.models.role import Role
from app.models.master_lookup import MasterType, MasterValue
from app.models.user_assignment import UserCompanyAssignment, UserBranchAssignment, UserStoreAssignment
from app.models.security import (
    SMRITIRole,
    SMRITIPermission,
    SMRITIPermissionSet,
    SMRITIRolePermissionSet,
    SMRITIPermissionSetPermission,
    SMRITIUserRole,
    SMRITIMenu,
    SMRITISecurityAudit,
)
config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

def include_object(object, name, type_, reflected, compare_to):
    """
    Filter objects so that Alembic only manages the SMRITI tables,
    preventing drops on other tables.
    """
    if type_ == "table":
        return name in [
            "customer_groups",
            "customers",
            "products",
            "stock_movements",
            "sales_invoices",
            "sales_invoice_items",
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
            "smriti_roles",
            "smriti_permissions",
            "smriti_permission_sets",
            "smriti_role_permission_sets",
            "smriti_permission_set_permissions",
            "smriti_user_roles",
            "smriti_menus",
            "smriti_security_audits",
            # Level 1 Inventory Kernel v1.0.0
            "inventory_location_nodes",
            "inventory_identity_records",
            "inventory_ledger_entries",
            "reservation_ledger_entries",
            "cost_layer_ledger_entries",
            "inventory_snapshot_records",
            "document_posting_profiles",
            "inventory_lock_records",
            "platform_idempotency_records",
            "inventory_checkpoint_records",
        ]
    return True


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = settings.DATABASE_URL
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
    # ── Stage 1: Legacy revision ID compatibility mapping ──────────────────
    # Revision IDs were shortened to fit standard Alembic VARCHAR(32) width.
    # Existing databases may still contain the old (>32 char) revision IDs.
    # This block remaps them BEFORE Alembic resolves the active revision.
    #
    # FRESH DATABASE SAFETY: alembic_version does not exist on a brand-new
    # database. We check table existence first. If absent, no UPDATE is
    # executed and Alembic bootstraps normally.
    #
    # Each UPDATE is a separate execute() call to prevent transaction abort
    # propagation when running in PostgreSQL asyncpg mode.
    try:
        table_exists = connection.scalar(sa.text(
            "SELECT EXISTS ("
            "  SELECT 1 FROM information_schema.tables"
            "  WHERE table_schema = 'public' AND table_name = 'alembic_version'"
            ");"
        ))
    except Exception:
        table_exists = False

    if table_exists:
        _legacy_map = [
            ("v900_multi_group_category_mapping",    "v900_multigroup_catmap"),
            ("v1400_phase_e_authority_hardening",    "v1400_phase_e_auth_hardening"),
            ("v1501_barcode_sourcing_multi_mode",    "v1501_barcode_src_mode"),
            ("v1502_tenant_scoped_product_code_sku", "v1502_tenant_prod_sku"),
        ]
        for old_id, new_id in _legacy_map:
            try:
                connection.execute(
                    sa.text(
                        "UPDATE alembic_version SET version_num = :new WHERE version_num = :old"
                    ),
                    {"new": new_id, "old": old_id}
                )
            except Exception:
                pass
        try:
            connection.commit()
        except Exception:
            pass


    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        include_object=include_object
    )

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    connectable = create_async_engine(settings.DATABASE_URL)

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()

def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    asyncio.run(run_async_migrations())

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
