"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.25.0
Created      : 2026-09-04
Modified     : 2026-09-04
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

"""v1397_cust_identity_protection

Revision ID: v1397_cust_identity_protection
Revises: v1396_corp_b2b_gst_delivery
Create Date: 2026-09-04

Customer Identity, Duplicate Protection, Billing Locations & External Identities
Phase 2F Schema Migration — SMRITI Retail OS

Purpose:
    Enforces the single authoritative Customer Identity and Duplicate Protection
    mechanism across Customer Master, Corporate/B2B Billing, and Integrations:
    - Creates customer_billing_locations for commercial/billing store identities.
    - Creates customer_external_identities for ERP integrations (SAP, Oracle, RIL, Tally).
    - Adds is_default column and single active default constraint on customer_delivery_locations.
    - Adds billing_location_id and billing_store_code snapshot columns to sales_invoices.
    - Enforces tenant-scoped unique Customer code for active non-deleted customers.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "v1397_cust_identity_protection"
down_revision = "v1396_corp_b2b_gst_delivery"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Add is_default to customer_delivery_locations
    op.add_column(
        "customer_delivery_locations",
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.create_index(
        "uq_cdl_customer_default",
        "customer_delivery_locations",
        ["customer_id"],
        unique=True,
        postgresql_where=sa.text("is_default = true AND status = 'ACTIVE' AND is_deleted = false"),
    )

    # 2. Add partial unique index on customers (company_id, code)
    op.create_index(
        "uq_customers_company_code_active",
        "customers",
        ["company_id", "code"],
        unique=True,
        postgresql_where=sa.text("code IS NOT NULL AND status = 'Active' AND is_deleted = false"),
    )

    op.create_index(
        "uq_cgr_company_gstin_active",
        "customer_gst_registrations",
        ["company_id", "gstin"],
        unique=True,
        postgresql_where=sa.text("status = 'ACTIVE' AND is_deleted = false AND company_id IS NOT NULL"),
    )

    # 3. Create customer_billing_locations table
    op.create_table(
        "customer_billing_locations",
        sa.Column("id", sa.String(50), primary_key=True, nullable=False),
        sa.Column("uuid", sa.String(36), unique=True, nullable=False),
        sa.Column("company_id", sa.String(50), sa.ForeignKey("companies.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("branch_id", sa.String(50), sa.ForeignKey("branches.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("created_by", sa.String(100), nullable=True),
        sa.Column("updated_by", sa.String(100), nullable=True),
        sa.Column("deleted_by", sa.String(100), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default=sa.text("1")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("modified_at", sa.DateTime(timezone=True), nullable=True, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("customer_id", sa.String(50), sa.ForeignKey("customers.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("billing_store_code", sa.String(50), nullable=False),
        sa.Column("location_name", sa.String(255), nullable=False),
        sa.Column("address_line1", sa.Text(), nullable=False),
        sa.Column("address_line2", sa.Text(), nullable=True),
        sa.Column("city", sa.String(100), nullable=False),
        sa.Column("state", sa.String(100), nullable=False),
        sa.Column("state_code", sa.String(2), nullable=False),
        sa.Column("pincode", sa.String(10), nullable=False),
        sa.Column("country", sa.String(100), nullable=False, server_default=sa.text("'India'")),
        sa.Column("gst_registration_id", sa.String(50), sa.ForeignKey("customer_gst_registrations.id", ondelete="SET NULL"), nullable=True),
        sa.Column("gstin", sa.String(15), nullable=True),
        sa.Column("contact_person", sa.String(150), nullable=True),
        sa.Column("phone", sa.String(20), nullable=True),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("status", sa.String(20), nullable=False, server_default=sa.text("'ACTIVE'")),
        sa.Column("source", sa.String(30), nullable=True, server_default=sa.text("'MANUAL'")),
        sa.Column("remarks", sa.Text(), nullable=True),
        sa.Column("metadata_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.create_index("idx_cbl_customer_id", "customer_billing_locations", ["customer_id"])
    op.create_index("idx_cbl_company_id", "customer_billing_locations", ["company_id"])
    op.create_index("idx_cbl_billing_store_code", "customer_billing_locations", ["billing_store_code"])
    op.create_index("idx_cbl_gst_registration_id", "customer_billing_locations", ["gst_registration_id"])
    op.create_index(
        "uq_cbl_customer_store_code_active",
        "customer_billing_locations",
        ["customer_id", "billing_store_code"],
        unique=True,
        postgresql_where=sa.text("status = 'ACTIVE' AND is_deleted = false"),
    )
    op.create_index(
        "uq_cbl_customer_default",
        "customer_billing_locations",
        ["customer_id"],
        unique=True,
        postgresql_where=sa.text("is_default = true AND status = 'ACTIVE' AND is_deleted = false"),
    )

    # 4. Create customer_external_identities table
    op.create_table(
        "customer_external_identities",
        sa.Column("id", sa.String(50), primary_key=True, nullable=False),
        sa.Column("uuid", sa.String(36), unique=True, nullable=False),
        sa.Column("company_id", sa.String(50), sa.ForeignKey("companies.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("branch_id", sa.String(50), sa.ForeignKey("branches.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("created_by", sa.String(100), nullable=True),
        sa.Column("updated_by", sa.String(100), nullable=True),
        sa.Column("deleted_by", sa.String(100), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default=sa.text("1")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("modified_at", sa.DateTime(timezone=True), nullable=True, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("customer_id", sa.String(50), sa.ForeignKey("customers.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("source_system", sa.String(50), nullable=False),
        sa.Column("external_type", sa.String(50), nullable=False, server_default=sa.text("'CUSTOMER'")),
        sa.Column("external_code", sa.String(100), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default=sa.text("'ACTIVE'")),
        sa.Column("metadata_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.create_index("idx_cust_ext_ident_customer_id", "customer_external_identities", ["customer_id"])
    op.create_index("idx_cust_ext_ident_company_id", "customer_external_identities", ["company_id"])
    op.create_index(
        "uq_cust_ext_ident_composite",
        "customer_external_identities",
        ["company_id", "source_system", "external_type", "external_code"],
        unique=True,
        postgresql_where=sa.text("status = 'ACTIVE' AND is_deleted = false"),
    )

    # 5. Add billing snapshot columns to sales_invoices
    op.add_column(
        "sales_invoices",
        sa.Column("billing_location_id", sa.String(50), sa.ForeignKey("customer_billing_locations.id", ondelete="SET NULL"), nullable=True),
    )
    op.add_column(
        "sales_invoices",
        sa.Column("billing_store_code", sa.String(50), nullable=True),
    )
    op.create_index("idx_sales_invoices_billing_loc", "sales_invoices", ["billing_location_id"])
    op.create_index("ix_sales_invoices_billing_store_code", "sales_invoices", ["billing_store_code"])


def downgrade() -> None:
    op.drop_index("ix_sales_invoices_billing_store_code", table_name="sales_invoices")
    op.drop_index("idx_sales_invoices_billing_loc", table_name="sales_invoices")
    op.drop_column("sales_invoices", "billing_store_code")
    op.drop_column("sales_invoices", "billing_location_id")

    op.drop_index("uq_cust_ext_ident_composite", table_name="customer_external_identities")
    op.drop_index("idx_cust_ext_ident_company_id", table_name="customer_external_identities")
    op.drop_index("idx_cust_ext_ident_customer_id", table_name="customer_external_identities")
    op.drop_table("customer_external_identities")

    op.drop_index("uq_cgr_company_gstin_active", table_name="customer_gst_registrations")

    op.drop_index("uq_cbl_customer_default", table_name="customer_billing_locations")
    op.drop_index("uq_cbl_customer_store_code_active", table_name="customer_billing_locations")
    op.drop_index("idx_cbl_gst_registration_id", table_name="customer_billing_locations")
    op.drop_index("idx_cbl_billing_store_code", table_name="customer_billing_locations")
    op.drop_index("idx_cbl_company_id", table_name="customer_billing_locations")
    op.drop_index("idx_cbl_customer_id", table_name="customer_billing_locations")
    op.drop_table("customer_billing_locations")

    op.drop_index("uq_customers_company_code_active", table_name="customers")
    op.drop_index("uq_cdl_customer_default", table_name="customer_delivery_locations")
    op.drop_column("customer_delivery_locations", "is_default")
