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
from logging.config import fileConfig
from sqlalchemy.ext.asyncio import create_async_engine
from alembic import context

# Import our settings and base metadata
from app.core.config import settings
from app.db.base import Base

# Import all models to ensure they are registered on Base.metadata
from app.models.crm import CustomerGroup, Customer
from app.models.inventory import Product, StockMovement, Store, Warehouse
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
from app.models.barcode import BarcodeLayout, PrintTemplate, PrintProfile
from app.models.exchange import DataExchangeTask, DataExchangeFieldMapping
from app.models.role import Role
from app.models.master_lookup import MasterType, MasterValue

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
