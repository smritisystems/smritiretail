"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.34.1
Created      : 2026-09-18
Modified     : 2026-09-18
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

"""v1464 – smriti_unified_identity_control_plane: Unified Identity Control Plane Phase 1

Creates the four foundational control-plane tables:
  1. smriti_identity_registry
  2. smriti_numbering_registry
  3. smriti_identity_alias
  4. smriti_identity_allocation_log

Seeds the canonical 16-group entity taxonomy and initial sequence counters.
Enforces guarded rollback safety.

Revision ID: v1464_smriti_unified_identity_control_plane
Revises:     v1463_customer_pricing_basis_and_promotions_on_rate
Create Date: 2026-09-18
"""

import uuid
from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import table, column


revision: str = "v1464_smriti_unified_identity_control_plane"
down_revision: str = "v1463_customer_pricing_basis_and_promotions_on_rate"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # -------------------------------------------------------------------------
    # 1. Create Table: smriti_identity_registry
    # -------------------------------------------------------------------------
    op.create_table(
        "smriti_identity_registry",
        sa.Column("id", sa.String(length=50), nullable=False),
        sa.Column("uuid", sa.String(length=36), nullable=False),
        sa.Column("entity_type", sa.String(length=50), nullable=False),
        sa.Column("entity_code", sa.String(length=20), nullable=False),
        sa.Column("identity_group", sa.String(length=50), nullable=False),
        sa.Column("group_code", sa.String(length=10), nullable=False),
        sa.Column("display_name", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("system_id_strategy", sa.String(length=50), server_default="UUIDv7", nullable=False),
        sa.Column("system_id_format", sa.String(length=50), server_default="UUID_HYPHENATED", nullable=False),
        sa.Column("system_id_immutable", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("identity_code_enabled", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("identity_code_format", sa.String(length=100), server_default="{group_code}-{entity_code}-{seq:08d}", nullable=False),
        sa.Column("identity_code_prefix", sa.String(length=30), nullable=False),
        sa.Column("identity_code_strategy", sa.String(length=50), server_default="SEQUENTIAL", nullable=False),
        sa.Column("identity_code_scope", sa.String(length=50), server_default="TENANT", nullable=False),
        sa.Column("identity_code_immutable", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("business_code_enabled", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("business_code_field", sa.String(length=50), nullable=True),
        sa.Column("business_code_strategy", sa.String(length=50), server_default="USER_SPECIFIED_OR_AUTOGEN", nullable=False),
        sa.Column("tenant_scoped", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("company_scoped", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("branch_scoped", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("warehouse_scoped", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("database_table", sa.String(length=100), nullable=False),
        sa.Column("primary_key_field", sa.String(length=50), server_default="id", nullable=False),
        sa.Column("identity_code_field", sa.String(length=50), server_default="identity_code", nullable=False),
        sa.Column("parent_entity_type", sa.String(length=50), nullable=True),
        sa.Column("user_visible", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("searchable", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("status", sa.String(length=20), server_default="ACTIVE", nullable=False),
        sa.Column("registry_version", sa.Integer(), server_default="1", nullable=False),
        sa.Column("company_id", sa.String(length=50), nullable=True),
        sa.Column("branch_id", sa.String(length=50), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column("modified_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column("created_by", sa.String(length=100), nullable=True),
        sa.Column("updated_by", sa.String(length=100), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.false(), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", sa.String(length=100), nullable=True),
        sa.Column("version", sa.Integer(), server_default="1", nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("uuid"),
        sa.UniqueConstraint("entity_type", name="uq_smriti_identity_registry_entity_type"),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["branch_id"], ["branches.id"], ondelete="RESTRICT"),
    )
    op.create_index("ix_smriti_identity_reg_group", "smriti_identity_registry", ["identity_group"])
    op.create_index("ix_smriti_identity_reg_group_code", "smriti_identity_registry", ["group_code"])

    # -------------------------------------------------------------------------
    # 2. Create Table: smriti_numbering_registry
    # -------------------------------------------------------------------------
    op.create_table(
        "smriti_numbering_registry",
        sa.Column("id", sa.String(length=50), nullable=False),
        sa.Column("uuid", sa.String(length=36), nullable=False),
        sa.Column("entity_type", sa.String(length=50), nullable=False),
        sa.Column("identity_group", sa.String(length=50), nullable=False),
        sa.Column("group_code", sa.String(length=10), nullable=False),
        sa.Column("prefix", sa.String(length=50), nullable=False),
        sa.Column("format_template", sa.String(length=100), server_default="{prefix}-{seq:08d}", nullable=False),
        sa.Column("scope", sa.String(length=50), server_default="TENANT", nullable=False),
        sa.Column("sequence_value", sa.Integer(), server_default="0", nullable=False),
        sa.Column("padding", sa.Integer(), server_default="8", nullable=False),
        sa.Column("reset_policy", sa.String(length=50), server_default="NEVER", nullable=False),
        sa.Column("financial_year", sa.String(length=20), server_default="", nullable=False),
        sa.Column("tenant_id", sa.String(length=50), server_default="", nullable=False),
        sa.Column("status", sa.String(length=20), server_default="ACTIVE", nullable=False),
        sa.Column("company_id", sa.String(length=50), nullable=True),
        sa.Column("branch_id", sa.String(length=50), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column("modified_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column("created_by", sa.String(length=100), nullable=True),
        sa.Column("updated_by", sa.String(length=100), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.false(), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", sa.String(length=100), nullable=True),
        sa.Column("version", sa.Integer(), server_default="1", nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("uuid"),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["branch_id"], ["branches.id"], ondelete="RESTRICT"),
    )
    op.create_index("ix_smriti_num_reg_entity_type", "smriti_numbering_registry", ["entity_type"])
    op.create_index("ix_smriti_num_reg_group", "smriti_numbering_registry", ["identity_group"])
    op.execute(
        """
        CREATE UNIQUE INDEX uq_smriti_numbering_registry_scope
        ON smriti_numbering_registry (
            entity_type, group_code, prefix, scope, tenant_id,
            COALESCE(company_id, ''), COALESCE(branch_id, ''), financial_year
        );
        """
    )

    # -------------------------------------------------------------------------
    # 3. Create Table: smriti_identity_alias
    # -------------------------------------------------------------------------
    op.create_table(
        "smriti_identity_alias",
        sa.Column("id", sa.String(length=50), nullable=False),
        sa.Column("uuid", sa.String(length=36), nullable=False),
        sa.Column("entity_type", sa.String(length=50), nullable=False),
        sa.Column("entity_id", sa.String(length=50), nullable=False),
        sa.Column("canonical_identity_code", sa.String(length=100), nullable=True),
        sa.Column("alias_code", sa.String(length=100), nullable=False),
        sa.Column("alias_type", sa.String(length=50), server_default="HISTORICAL_RENAME", nullable=False),
        sa.Column("source_system", sa.String(length=50), server_default="SMRITI", nullable=False),
        sa.Column("valid_from", sa.DateTime(timezone=True), nullable=True),
        sa.Column("valid_to", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("company_id", sa.String(length=50), nullable=True),
        sa.Column("branch_id", sa.String(length=50), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column("modified_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column("created_by", sa.String(length=100), nullable=True),
        sa.Column("updated_by", sa.String(length=100), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.false(), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", sa.String(length=100), nullable=True),
        sa.Column("version", sa.Integer(), server_default="1", nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("uuid"),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["branch_id"], ["branches.id"], ondelete="RESTRICT"),
    )
    op.create_index("ix_smriti_alias_entity_type", "smriti_identity_alias", ["entity_type"])
    op.create_index("ix_smriti_alias_entity_id", "smriti_identity_alias", ["entity_id"])
    op.create_index("ix_smriti_alias_canonical_code", "smriti_identity_alias", ["canonical_identity_code"])
    op.create_index("ix_smriti_alias_alias_code", "smriti_identity_alias", ["alias_code"])
    op.execute(
        """
        CREATE UNIQUE INDEX uq_smriti_identity_alias_code
        ON smriti_identity_alias (
            entity_type, alias_code, COALESCE(company_id, '')
        );
        """
    )

    # -------------------------------------------------------------------------
    # 4. Create Table: smriti_identity_allocation_log
    # -------------------------------------------------------------------------
    op.create_table(
        "smriti_identity_allocation_log",
        sa.Column("id", sa.String(length=50), nullable=False),
        sa.Column("uuid", sa.String(length=36), nullable=False),
        sa.Column("tenant_id", sa.String(length=50), nullable=True),
        sa.Column("entity_type", sa.String(length=50), nullable=False),
        sa.Column("group_code", sa.String(length=10), nullable=False),
        sa.Column("canonical_id", sa.String(length=50), nullable=False),
        sa.Column("identity_code", sa.String(length=100), nullable=False),
        sa.Column("scope", sa.String(length=50), server_default="TENANT", nullable=False),
        sa.Column("purpose", sa.String(length=50), server_default="ENTITY_CREATION", nullable=False),
        sa.Column("correlation_id", sa.String(length=100), nullable=True),
        sa.Column("company_id", sa.String(length=50), nullable=True),
        sa.Column("branch_id", sa.String(length=50), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column("modified_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column("created_by", sa.String(length=100), nullable=True),
        sa.Column("updated_by", sa.String(length=100), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.false(), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", sa.String(length=100), nullable=True),
        sa.Column("version", sa.Integer(), server_default="1", nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("uuid"),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["branch_id"], ["branches.id"], ondelete="RESTRICT"),
    )
    op.create_index("ix_smriti_alloc_log_tenant", "smriti_identity_allocation_log", ["tenant_id"])
    op.create_index("ix_smriti_alloc_log_entity_type", "smriti_identity_allocation_log", ["entity_type"])
    op.create_index("ix_smriti_alloc_log_group_code", "smriti_identity_allocation_log", ["group_code"])
    op.create_index("ix_smriti_alloc_log_canonical_id", "smriti_identity_allocation_log", ["canonical_id"])
    op.create_index("ix_smriti_alloc_log_identity_code", "smriti_identity_allocation_log", ["identity_code"])

    # -------------------------------------------------------------------------
    # 5. Seed Core Taxonomy into smriti_identity_registry
    # -------------------------------------------------------------------------
    registry_table = table(
        "smriti_identity_registry",
        column("id", sa.String),
        column("uuid", sa.String),
        column("entity_type", sa.String),
        column("entity_code", sa.String),
        column("identity_group", sa.String),
        column("group_code", sa.String),
        column("display_name", sa.String),
        column("description", sa.Text),
        column("system_id_strategy", sa.String),
        column("system_id_format", sa.String),
        column("system_id_immutable", sa.Boolean),
        column("identity_code_enabled", sa.Boolean),
        column("identity_code_format", sa.String),
        column("identity_code_prefix", sa.String),
        column("identity_code_strategy", sa.String),
        column("identity_code_scope", sa.String),
        column("identity_code_immutable", sa.Boolean),
        column("business_code_enabled", sa.Boolean),
        column("business_code_field", sa.String),
        column("business_code_strategy", sa.String),
        column("tenant_scoped", sa.Boolean),
        column("company_scoped", sa.Boolean),
        column("branch_scoped", sa.Boolean),
        column("warehouse_scoped", sa.Boolean),
        column("database_table", sa.String),
        column("primary_key_field", sa.String),
        column("identity_code_field", sa.String),
        column("parent_entity_type", sa.String),
        column("user_visible", sa.Boolean),
        column("searchable", sa.Boolean),
        column("status", sa.String),
        column("registry_version", sa.Integer),
    )

    core_entities = [
        # ORG - Organization Structure
        {
            "id": "idreg_org_company",
            "uuid": str(uuid.uuid4()),
            "entity_type": "COMPANY",
            "entity_code": "CMP",
            "identity_group": "ORGANIZATION",
            "group_code": "ORG",
            "display_name": "Company Legal Entity",
            "description": "Top-level legal entity and corporate accounting organization unit",
            "system_id_strategy": "UUIDv7",
            "system_id_format": "UUID_HYPHENATED",
            "system_id_immutable": True,
            "identity_code_enabled": True,
            "identity_code_format": "{group_code}-{entity_code}-{seq:08d}",
            "identity_code_prefix": "ORG-CMP",
            "identity_code_strategy": "SEQUENTIAL",
            "identity_code_scope": "GLOBAL",
            "identity_code_immutable": True,
            "business_code_enabled": True,
            "business_code_field": "code",
            "business_code_strategy": "USER_SPECIFIED",
            "tenant_scoped": True,
            "company_scoped": False,
            "branch_scoped": False,
            "warehouse_scoped": False,
            "database_table": "companies",
            "primary_key_field": "id",
            "identity_code_field": "identity_code",
            "parent_entity_type": None,
            "user_visible": True,
            "searchable": True,
            "status": "ACTIVE",
            "registry_version": 1,
        },
        {
            "id": "idreg_org_branch",
            "uuid": str(uuid.uuid4()),
            "entity_type": "BRANCH",
            "entity_code": "BRN",
            "identity_group": "ORGANIZATION",
            "group_code": "ORG",
            "display_name": "Branch / Operating Location",
            "description": "Operating location, physical facility, or sales outlet",
            "system_id_strategy": "UUIDv7",
            "system_id_format": "UUID_HYPHENATED",
            "system_id_immutable": True,
            "identity_code_enabled": True,
            "identity_code_format": "{group_code}-{entity_code}-{seq:08d}",
            "identity_code_prefix": "ORG-BRN",
            "identity_code_strategy": "SEQUENTIAL",
            "identity_code_scope": "COMPANY",
            "identity_code_immutable": True,
            "business_code_enabled": True,
            "business_code_field": "code",
            "business_code_strategy": "USER_SPECIFIED",
            "tenant_scoped": True,
            "company_scoped": True,
            "branch_scoped": False,
            "warehouse_scoped": False,
            "database_table": "branches",
            "primary_key_field": "id",
            "identity_code_field": "identity_code",
            "parent_entity_type": "COMPANY",
            "user_visible": True,
            "searchable": True,
            "status": "ACTIVE",
            "registry_version": 1,
        },
        {
            "id": "idreg_org_warehouse",
            "uuid": str(uuid.uuid4()),
            "entity_type": "WAREHOUSE",
            "entity_code": "WHS",
            "identity_group": "ORGANIZATION",
            "group_code": "ORG",
            "display_name": "Warehouse / Storage Facility",
            "description": "Inventory storage and logistics fulfillment node",
            "system_id_strategy": "UUIDv7",
            "system_id_format": "UUID_HYPHENATED",
            "system_id_immutable": True,
            "identity_code_enabled": True,
            "identity_code_format": "{group_code}-{entity_code}-{seq:08d}",
            "identity_code_prefix": "ORG-WHS",
            "identity_code_strategy": "SEQUENTIAL",
            "identity_code_scope": "COMPANY",
            "identity_code_immutable": True,
            "business_code_enabled": True,
            "business_code_field": "warehouse_code",
            "business_code_strategy": "USER_SPECIFIED",
            "tenant_scoped": True,
            "company_scoped": True,
            "branch_scoped": True,
            "warehouse_scoped": False,
            "database_table": "warehouses",
            "primary_key_field": "id",
            "identity_code_field": "identity_code",
            "parent_entity_type": "BRANCH",
            "user_visible": True,
            "searchable": True,
            "status": "ACTIVE",
            "registry_version": 1,
        },
        # MST - Master Data
        {
            "id": "idreg_mst_item",
            "uuid": str(uuid.uuid4()),
            "entity_type": "ITEM",
            "entity_code": "ITM",
            "identity_group": "MASTER_DATA",
            "group_code": "MST",
            "display_name": "Product / Catalog Item",
            "description": "Stock Keeping Unit (SKU), inventory article, or finished good",
            "system_id_strategy": "UUIDv7",
            "system_id_format": "UUID_HYPHENATED",
            "system_id_immutable": True,
            "identity_code_enabled": True,
            "identity_code_format": "{group_code}-{entity_code}-{seq:08d}",
            "identity_code_prefix": "MST-ITM",
            "identity_code_strategy": "SEQUENTIAL",
            "identity_code_scope": "TENANT",
            "identity_code_immutable": True,
            "business_code_enabled": True,
            "business_code_field": "item_code",
            "business_code_strategy": "USER_SPECIFIED_OR_AUTOGEN",
            "tenant_scoped": True,
            "company_scoped": True,
            "branch_scoped": False,
            "warehouse_scoped": False,
            "database_table": "items",
            "primary_key_field": "id",
            "identity_code_field": "identity_code",
            "parent_entity_type": None,
            "user_visible": True,
            "searchable": True,
            "status": "ACTIVE",
            "registry_version": 1,
        },
        # CRM - Customer Management
        {
            "id": "idreg_crm_customer",
            "uuid": str(uuid.uuid4()),
            "entity_type": "CUSTOMER",
            "entity_code": "CUS",
            "identity_group": "CUSTOMER",
            "group_code": "CRM",
            "display_name": "Customer Account",
            "description": "Debtor, B2B wholesale client, or retail loyalty consumer",
            "system_id_strategy": "UUIDv7",
            "system_id_format": "UUID_HYPHENATED",
            "system_id_immutable": True,
            "identity_code_enabled": True,
            "identity_code_format": "{group_code}-{entity_code}-{seq:08d}",
            "identity_code_prefix": "CRM-CUS",
            "identity_code_strategy": "SEQUENTIAL",
            "identity_code_scope": "TENANT",
            "identity_code_immutable": True,
            "business_code_enabled": True,
            "business_code_field": "customer_code",
            "business_code_strategy": "USER_SPECIFIED_OR_AUTOGEN",
            "tenant_scoped": True,
            "company_scoped": True,
            "branch_scoped": False,
            "warehouse_scoped": False,
            "database_table": "customers",
            "primary_key_field": "id",
            "identity_code_field": "identity_code",
            "parent_entity_type": None,
            "user_visible": True,
            "searchable": True,
            "status": "ACTIVE",
            "registry_version": 1,
        },
        # PUR - Procurement
        {
            "id": "idreg_pur_supplier",
            "uuid": str(uuid.uuid4()),
            "entity_type": "SUPPLIER",
            "entity_code": "SUP",
            "identity_group": "PROCUREMENT",
            "group_code": "PUR",
            "display_name": "Supplier / Vendor Account",
            "description": "Creditor, manufacturer, or wholesale distributor",
            "system_id_strategy": "UUIDv7",
            "system_id_format": "UUID_HYPHENATED",
            "system_id_immutable": True,
            "identity_code_enabled": True,
            "identity_code_format": "{group_code}-{entity_code}-{seq:08d}",
            "identity_code_prefix": "PUR-SUP",
            "identity_code_strategy": "SEQUENTIAL",
            "identity_code_scope": "TENANT",
            "identity_code_immutable": True,
            "business_code_enabled": True,
            "business_code_field": "supplier_code",
            "business_code_strategy": "USER_SPECIFIED_OR_AUTOGEN",
            "tenant_scoped": True,
            "company_scoped": True,
            "branch_scoped": False,
            "warehouse_scoped": False,
            "database_table": "suppliers",
            "primary_key_field": "id",
            "identity_code_field": "identity_code",
            "parent_entity_type": None,
            "user_visible": True,
            "searchable": True,
            "status": "ACTIVE",
            "registry_version": 1,
        },
        # SAL - Sales
        {
            "id": "idreg_sal_invoice",
            "uuid": str(uuid.uuid4()),
            "entity_type": "SALES_INVOICE",
            "entity_code": "INV",
            "identity_group": "SALES",
            "group_code": "SAL",
            "display_name": "Sales Tax Invoice",
            "description": "Outward tax invoice, retail bill, or commercial sales billing document",
            "system_id_strategy": "UUIDv7",
            "system_id_format": "UUID_HYPHENATED",
            "system_id_immutable": True,
            "identity_code_enabled": True,
            "identity_code_format": "{group_code}-{entity_code}-{seq:08d}",
            "identity_code_prefix": "SAL-INV",
            "identity_code_strategy": "SEQUENTIAL",
            "identity_code_scope": "BRANCH",
            "identity_code_immutable": True,
            "business_code_enabled": True,
            "business_code_field": "invoice_no",
            "business_code_strategy": "DOCUMENT_SERIES",
            "tenant_scoped": True,
            "company_scoped": True,
            "branch_scoped": True,
            "warehouse_scoped": False,
            "database_table": "sales_invoices",
            "primary_key_field": "id",
            "identity_code_field": "identity_code",
            "parent_entity_type": "BRANCH",
            "user_visible": True,
            "searchable": True,
            "status": "ACTIVE",
            "registry_version": 1,
        },
        {
            "id": "idreg_sal_order",
            "uuid": str(uuid.uuid4()),
            "entity_type": "SALES_ORDER",
            "entity_code": "ORD",
            "identity_group": "SALES",
            "group_code": "SAL",
            "display_name": "Sales Order",
            "description": "Customer sales commitment and order booking document",
            "system_id_strategy": "UUIDv7",
            "system_id_format": "UUID_HYPHENATED",
            "system_id_immutable": True,
            "identity_code_enabled": True,
            "identity_code_format": "{group_code}-{entity_code}-{seq:08d}",
            "identity_code_prefix": "SAL-ORD",
            "identity_code_strategy": "SEQUENTIAL",
            "identity_code_scope": "BRANCH",
            "identity_code_immutable": True,
            "business_code_enabled": True,
            "business_code_field": "order_no",
            "business_code_strategy": "DOCUMENT_SERIES",
            "tenant_scoped": True,
            "company_scoped": True,
            "branch_scoped": True,
            "warehouse_scoped": False,
            "database_table": "sales_orders",
            "primary_key_field": "id",
            "identity_code_field": "identity_code",
            "parent_entity_type": "BRANCH",
            "user_visible": True,
            "searchable": True,
            "status": "ACTIVE",
            "registry_version": 1,
        },
        # PUR - Purchase Order
        {
            "id": "idreg_pur_order",
            "uuid": str(uuid.uuid4()),
            "entity_type": "PURCHASE_ORDER",
            "entity_code": "PO",
            "identity_group": "PROCUREMENT",
            "group_code": "PUR",
            "display_name": "Purchase Order",
            "description": "Outward procurement commitment issued to supplier",
            "system_id_strategy": "UUIDv7",
            "system_id_format": "UUID_HYPHENATED",
            "system_id_immutable": True,
            "identity_code_enabled": True,
            "identity_code_format": "{group_code}-{entity_code}-{seq:08d}",
            "identity_code_prefix": "PUR-PO",
            "identity_code_strategy": "SEQUENTIAL",
            "identity_code_scope": "COMPANY",
            "identity_code_immutable": True,
            "business_code_enabled": True,
            "business_code_field": "po_number",
            "business_code_strategy": "DOCUMENT_SERIES",
            "tenant_scoped": True,
            "company_scoped": True,
            "branch_scoped": False,
            "warehouse_scoped": False,
            "database_table": "purchase_orders",
            "primary_key_field": "id",
            "identity_code_field": "identity_code",
            "parent_entity_type": "COMPANY",
            "user_visible": True,
            "searchable": True,
            "status": "ACTIVE",
            "registry_version": 1,
        },
        # RPT - Reports & Dashboards
        {
            "id": "idreg_rpt_report",
            "uuid": str(uuid.uuid4()),
            "entity_type": "REPORT",
            "entity_code": "REP",
            "identity_group": "REPORTING",
            "group_code": "RPT",
            "display_name": "Analytical Report Specification",
            "description": "Saved Report Studio query definition and report manifest",
            "system_id_strategy": "UUIDv7",
            "system_id_format": "UUID_HYPHENATED",
            "system_id_immutable": True,
            "identity_code_enabled": True,
            "identity_code_format": "{group_code}-{entity_code}-{seq:08d}",
            "identity_code_prefix": "RPT-REP",
            "identity_code_strategy": "SEQUENTIAL",
            "identity_code_scope": "TENANT",
            "identity_code_immutable": True,
            "business_code_enabled": True,
            "business_code_field": "report_code",
            "business_code_strategy": "USER_SPECIFIED_OR_AUTOGEN",
            "tenant_scoped": True,
            "company_scoped": False,
            "branch_scoped": False,
            "warehouse_scoped": False,
            "database_table": "reports",
            "primary_key_field": "id",
            "identity_code_field": "identity_code",
            "parent_entity_type": None,
            "user_visible": True,
            "searchable": True,
            "status": "ACTIVE",
            "registry_version": 1,
        },
        {
            "id": "idreg_rpt_dashboard",
            "uuid": str(uuid.uuid4()),
            "entity_type": "DASHBOARD",
            "entity_code": "DSH",
            "identity_group": "REPORTING",
            "group_code": "RPT",
            "display_name": "Analytical Dashboard Layout",
            "description": "Report Studio executive dashboard workspace and card layout",
            "system_id_strategy": "UUIDv7",
            "system_id_format": "UUID_HYPHENATED",
            "system_id_immutable": True,
            "identity_code_enabled": True,
            "identity_code_format": "{group_code}-{entity_code}-{seq:08d}",
            "identity_code_prefix": "RPT-DSH",
            "identity_code_strategy": "SEQUENTIAL",
            "identity_code_scope": "TENANT",
            "identity_code_immutable": True,
            "business_code_enabled": True,
            "business_code_field": "dashboard_code",
            "business_code_strategy": "USER_SPECIFIED_OR_AUTOGEN",
            "tenant_scoped": True,
            "company_scoped": False,
            "branch_scoped": False,
            "warehouse_scoped": False,
            "database_table": "dashboards",
            "primary_key_field": "id",
            "identity_code_field": "identity_code",
            "parent_entity_type": None,
            "user_visible": True,
            "searchable": True,
            "status": "ACTIVE",
            "registry_version": 1,
        },
        # ACT - Actions & Workflow
        {
            "id": "idreg_act_action",
            "uuid": str(uuid.uuid4()),
            "entity_type": "ACTION",
            "entity_code": "ACT",
            "identity_group": "ACTION_WORKFLOW",
            "group_code": "ACT",
            "display_name": "Action / Workflow Definition",
            "description": "Triggerable system action, approval step, or automated workflow event",
            "system_id_strategy": "UUIDv7",
            "system_id_format": "UUID_HYPHENATED",
            "system_id_immutable": True,
            "identity_code_enabled": True,
            "identity_code_format": "{group_code}-{entity_code}-{seq:08d}",
            "identity_code_prefix": "ACT-ACT",
            "identity_code_strategy": "SEQUENTIAL",
            "identity_code_scope": "GLOBAL",
            "identity_code_immutable": True,
            "business_code_enabled": True,
            "business_code_field": "action_code",
            "business_code_strategy": "USER_SPECIFIED",
            "tenant_scoped": False,
            "company_scoped": False,
            "branch_scoped": False,
            "warehouse_scoped": False,
            "database_table": "action_definitions",
            "primary_key_field": "id",
            "identity_code_field": "identity_code",
            "parent_entity_type": None,
            "user_visible": True,
            "searchable": True,
            "status": "ACTIVE",
            "registry_version": 1,
        },
        # AUD - Audit & Security
        {
            "id": "idreg_aud_event",
            "uuid": str(uuid.uuid4()),
            "entity_type": "AUDIT_EVENT",
            "entity_code": "EVT",
            "identity_group": "AUDIT_SECURITY",
            "group_code": "AUD",
            "display_name": "Compliance & Security Audit Event",
            "description": "Immutable ledger record of regulatory compliance, login, or state change",
            "system_id_strategy": "UUIDv7",
            "system_id_format": "UUID_HYPHENATED",
            "system_id_immutable": True,
            "identity_code_enabled": True,
            "identity_code_format": "{group_code}-{entity_code}-{seq:08d}",
            "identity_code_prefix": "AUD-EVT",
            "identity_code_strategy": "SEQUENTIAL",
            "identity_code_scope": "TENANT",
            "identity_code_immutable": True,
            "business_code_enabled": False,
            "business_code_field": None,
            "business_code_strategy": "NONE",
            "tenant_scoped": True,
            "company_scoped": True,
            "branch_scoped": True,
            "warehouse_scoped": False,
            "database_table": "compliance_audit_logs",
            "primary_key_field": "id",
            "identity_code_field": "identity_code",
            "parent_entity_type": None,
            "user_visible": False,
            "searchable": True,
            "status": "ACTIVE",
            "registry_version": 1,
        },
    ]

    op.bulk_insert(registry_table, core_entities)

    # -------------------------------------------------------------------------
    # 6. Seed Default Global Numbering Sequences
    # -------------------------------------------------------------------------
    numbering_table = table(
        "smriti_numbering_registry",
        column("id", sa.String),
        column("uuid", sa.String),
        column("entity_type", sa.String),
        column("identity_group", sa.String),
        column("group_code", sa.String),
        column("prefix", sa.String),
        column("format_template", sa.String),
        column("scope", sa.String),
        column("sequence_value", sa.Integer),
        column("padding", sa.Integer),
        column("reset_policy", sa.String),
        column("financial_year", sa.String),
        column("tenant_id", sa.String),
        column("company_id", sa.String),
        column("branch_id", sa.String),
        column("status", sa.String),
    )

    initial_sequences = [
        {
            "id": "numreg_mst_itm_default",
            "uuid": str(uuid.uuid4()),
            "entity_type": "ITEM",
            "identity_group": "MASTER_DATA",
            "group_code": "MST",
            "prefix": "MST-ITM",
            "format_template": "{prefix}-{seq:08d}",
            "scope": "TENANT",
            "sequence_value": 0,
            "padding": 8,
            "reset_policy": "NEVER",
            "financial_year": "",
            "tenant_id": "",
            "company_id": None,
            "branch_id": None,
            "status": "ACTIVE",
        },
        {
            "id": "numreg_crm_cus_default",
            "uuid": str(uuid.uuid4()),
            "entity_type": "CUSTOMER",
            "identity_group": "CUSTOMER",
            "group_code": "CRM",
            "prefix": "CRM-CUS",
            "format_template": "{prefix}-{seq:08d}",
            "scope": "TENANT",
            "sequence_value": 0,
            "padding": 8,
            "reset_policy": "NEVER",
            "financial_year": "",
            "tenant_id": "",
            "company_id": None,
            "branch_id": None,
            "status": "ACTIVE",
        },
        {
            "id": "numreg_pur_sup_default",
            "uuid": str(uuid.uuid4()),
            "entity_type": "SUPPLIER",
            "identity_group": "PROCUREMENT",
            "group_code": "PUR",
            "prefix": "PUR-SUP",
            "format_template": "{prefix}-{seq:08d}",
            "scope": "TENANT",
            "sequence_value": 0,
            "padding": 8,
            "reset_policy": "NEVER",
            "financial_year": "",
            "tenant_id": "",
            "company_id": None,
            "branch_id": None,
            "status": "ACTIVE",
        },
        {
            "id": "numreg_rpt_rep_default",
            "uuid": str(uuid.uuid4()),
            "entity_type": "REPORT",
            "identity_group": "REPORTING",
            "group_code": "RPT",
            "prefix": "RPT-REP",
            "format_template": "{prefix}-{seq:08d}",
            "scope": "TENANT",
            "sequence_value": 0,
            "padding": 8,
            "reset_policy": "NEVER",
            "financial_year": "",
            "tenant_id": "",
            "company_id": None,
            "branch_id": None,
            "status": "ACTIVE",
        },
        {
            "id": "numreg_rpt_dsh_default",
            "uuid": str(uuid.uuid4()),
            "entity_type": "DASHBOARD",
            "identity_group": "REPORTING",
            "group_code": "RPT",
            "prefix": "RPT-DSH",
            "format_template": "{prefix}-{seq:08d}",
            "scope": "TENANT",
            "sequence_value": 0,
            "padding": 8,
            "reset_policy": "NEVER",
            "financial_year": "",
            "tenant_id": "",
            "company_id": None,
            "branch_id": None,
            "status": "ACTIVE",
        },
        {
            "id": "numreg_act_act_default",
            "uuid": str(uuid.uuid4()),
            "entity_type": "ACTION",
            "identity_group": "ACTION_WORKFLOW",
            "group_code": "ACT",
            "prefix": "ACT-ACT",
            "format_template": "{prefix}-{seq:08d}",
            "scope": "GLOBAL",
            "sequence_value": 0,
            "padding": 8,
            "reset_policy": "NEVER",
            "financial_year": "",
            "tenant_id": "",
            "company_id": None,
            "branch_id": None,
            "status": "ACTIVE",
        },
    ]

    op.bulk_insert(numbering_table, initial_sequences)


def downgrade() -> None:
    # -------------------------------------------------------------------------
    # Guarded Downgrade (Rule 16): Prevent accidental destruction if records exist
    # -------------------------------------------------------------------------
    conn = op.get_bind()

    alloc_count = conn.execute(
        sa.text("SELECT COUNT(*) FROM smriti_identity_allocation_log")
    ).scalar()

    alias_count = conn.execute(
        sa.text("SELECT COUNT(*) FROM smriti_identity_alias")
    ).scalar()

    advanced_seq_count = conn.execute(
        sa.text("SELECT COUNT(*) FROM smriti_numbering_registry WHERE sequence_value > 0")
    ).scalar()

    if (alloc_count and alloc_count > 0) or (alias_count and alias_count > 0) or (advanced_seq_count and advanced_seq_count > 0):
        raise RuntimeError(
            f"ABORT DOWNGRADE: Active identity records detected in SMRITI Unified Identity Control Plane. "
            f"Allocations: {alloc_count}, Aliases: {alias_count}, Advanced sequences: {advanced_seq_count}. "
            f"Rolling back would result in catastrophic orphan identities or sequence corruption. "
            f"Explicit DBA remediation is required."
        )

    # Clean rollback in reverse dependency order
    op.drop_table("smriti_identity_allocation_log")
    op.drop_table("smriti_identity_alias")
    op.drop_table("smriti_numbering_registry")
    op.drop_table("smriti_identity_registry")
