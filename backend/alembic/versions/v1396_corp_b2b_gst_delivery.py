"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.19.1
Created      : 2026-09-04
Modified     : 2026-09-04
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

"""v1396_corp_b2b_gst_delivery

Revision ID: v1396_corp_b2b_gst_delivery
Revises: v1395_gov_integration
Create Date: 2026-09-04

Corporate Customer / GST Registration / Delivery Location / Store Code
Phase 1 Schema Migration — SMRITI Retail OS

Purpose:
    Establishes the corporate B2B multi-state tax and physical delivery site
    architecture for enterprise customers (e.g. Reliance Retail Limited):
    - One legal Customer entity holds many state GST registrations.
    - One legal Customer entity holds many physical Delivery Locations / Stores.
    - Each CustomerDeliveryLocation has an alphanumeric store_code (NOT integer).
    - sales_invoices gains snapshot and tracking columns for delivery site,
      destination GSTIN, billed party GSTIN, and discrete Place of Supply.

Governance Rules Preserved:
    - sales_invoices.sis_code RETAINED for historical immutability.
    - customers.gst_number RETAINED as legacy/default primary GSTIN mirror.
    - CustomerGroup credit policy and Price Lists remain 100% untouched.
    - Store Code is VARCHAR(50) - NOT INTEGER. Alphanumeric RIL codes like
      'T97D', 'TFW4', 'TYAC' in addition to numeric codes like '1888'.
    - Complete BaseEntity parity: created_by, updated_by, deleted_at, deleted_by.
    - Canonical tenancy: company_id -> companies.id, branch_id -> branches.id.
    - Partial unique constraint on customer_gst_registrations: at most one primary.
    - All new FKs on sales_invoices use ON DELETE SET NULL to guarantee
      permanent invoice audit immutability.

Changes:
    1. CREATE TABLE customer_gst_registrations (full BaseEntity + tenancy)
    2. CREATE TABLE customer_delivery_locations (replaces phantom CustomerAddress)
    3. ALTER TABLE sales_invoices ADD 6 nullable columns + 3 indexes + 2 FKs

Reviewed against: Phase 1 Architecture Review Gate (2026-09-04)
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "v1396_corp_b2b_gst_delivery"
down_revision = "v1395_gov_integration"
branch_labels = None
depends_on = None


def upgrade() -> None:

    # ── 1. customer_gst_registrations ─────────────────────────────────────────
    op.create_table(
        "customer_gst_registrations",
        sa.Column("id", sa.String(50), primary_key=True, nullable=False),
        sa.Column("uuid", sa.String(36), nullable=True),
        sa.Column("company_id", sa.String(50),
                  sa.ForeignKey("companies.id", ondelete="RESTRICT"),
                  nullable=True),
        sa.Column("branch_id", sa.String(50),
                  sa.ForeignKey("branches.id", ondelete="RESTRICT"),
                  nullable=True),
        sa.Column("created_by", sa.String(100), nullable=True),
        sa.Column("updated_by", sa.String(100), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", sa.String(100), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default=sa.text("1")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True,
                  server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("modified_at", sa.DateTime(timezone=True), nullable=True,
                  server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("customer_id", sa.String(50),
                  sa.ForeignKey("customers.id", ondelete="RESTRICT"),
                  nullable=False),
        sa.Column("gstin", sa.String(15), nullable=False),
        sa.Column("state_name", sa.String(100), nullable=False),
        sa.Column("state_code", sa.String(2), nullable=False),
        sa.Column("registration_type", sa.String(30), nullable=False,
                  server_default=sa.text("'REGULAR'")),
        sa.Column("is_primary", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("status", sa.String(20), nullable=False, server_default=sa.text("'ACTIVE'")),
        sa.Column("remarks", sa.Text(), nullable=True),
        sa.Column("metadata_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.create_index("ix_cust_gst_reg_customer_id", "customer_gst_registrations", ["customer_id"])
    op.create_index("ix_cust_gst_reg_company_id", "customer_gst_registrations", ["company_id"])
    op.create_index("ix_cust_gst_reg_gstin", "customer_gst_registrations", ["gstin"])
    op.create_unique_constraint(
        "uq_cust_gst_reg_customer_gstin",
        "customer_gst_registrations", ["customer_id", "gstin"]
    )
    # Partial unique index: at most one primary active registration per customer
    op.execute("""
        CREATE UNIQUE INDEX uq_cust_gst_reg_primary_per_customer
        ON customer_gst_registrations (customer_id)
        WHERE is_primary = true AND is_deleted = false
    """)

    # ── 2. customer_delivery_locations ────────────────────────────────────────
    op.create_table(
        "customer_delivery_locations",
        sa.Column("id", sa.String(50), primary_key=True, nullable=False),
        sa.Column("uuid", sa.String(36), nullable=True),
        sa.Column("company_id", sa.String(50),
                  sa.ForeignKey("companies.id", ondelete="RESTRICT"),
                  nullable=True),
        sa.Column("branch_id", sa.String(50),
                  sa.ForeignKey("branches.id", ondelete="RESTRICT"),
                  nullable=True),
        sa.Column("created_by", sa.String(100), nullable=True),
        sa.Column("updated_by", sa.String(100), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", sa.String(100), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default=sa.text("1")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True,
                  server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("modified_at", sa.DateTime(timezone=True), nullable=True,
                  server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("customer_id", sa.String(50),
                  sa.ForeignKey("customers.id", ondelete="RESTRICT"),
                  nullable=False),
        # Store Code: VARCHAR(50) - NOT INTEGER. Alphanumeric RIL codes are valid (e.g. 'T97D')
        sa.Column("store_code", sa.String(50), nullable=False),
        sa.Column("location_name", sa.String(255), nullable=False),
        sa.Column("address_line1", sa.Text(), nullable=True),
        sa.Column("address_line2", sa.Text(), nullable=True),
        sa.Column("city", sa.String(100), nullable=True),
        sa.Column("state", sa.String(100), nullable=True),
        sa.Column("state_code", sa.String(2), nullable=True),
        sa.Column("pincode", sa.String(10), nullable=True),
        sa.Column("country", sa.String(100), nullable=False, server_default=sa.text("'India'")),
        sa.Column("gst_registration_id", sa.String(50),
                  sa.ForeignKey("customer_gst_registrations.id", ondelete="SET NULL"),
                  nullable=True),
        sa.Column("gstin", sa.String(15), nullable=True),
        sa.Column("contact_person", sa.String(150), nullable=True),
        sa.Column("phone", sa.String(20), nullable=True),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default=sa.text("'ACTIVE'")),
        sa.Column("source", sa.String(30), nullable=True, server_default=sa.text("'MANUAL'")),
        sa.Column("remarks", sa.Text(), nullable=True),
        sa.Column("metadata_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.create_index("ix_cdl_customer_id", "customer_delivery_locations", ["customer_id"])
    op.create_index("ix_cdl_company_id", "customer_delivery_locations", ["company_id"])
    op.create_index("ix_cdl_store_code", "customer_delivery_locations", ["store_code"])
    op.create_index("ix_cdl_gst_registration_id", "customer_delivery_locations", ["gst_registration_id"])
    # Partial unique index: one active location per (customer, store_code)
    op.execute("""
        CREATE UNIQUE INDEX uq_cdl_customer_store_code_active
        ON customer_delivery_locations (customer_id, store_code)
        WHERE status = 'ACTIVE' AND is_deleted = false
    """)

    # ── 3. Extend sales_invoices with B2B snapshot columns & indexes ──────────
    # All columns are nullable with no defaults — zero impact on existing rows.

    op.add_column("sales_invoices",
        sa.Column("delivery_location_id", sa.String(50), nullable=True)
    )
    op.create_foreign_key(
        "fk_si_delivery_location",
        "sales_invoices", "customer_delivery_locations",
        ["delivery_location_id"], ["id"], ondelete="SET NULL"
    )
    op.add_column("sales_invoices",
        sa.Column("delivery_store_code", sa.String(50), nullable=True)
    )
    op.add_column("sales_invoices",
        sa.Column("delivery_gstin", sa.String(15), nullable=True)
    )
    op.add_column("sales_invoices",
        sa.Column("billed_party_gstin_id", sa.String(50), nullable=True)
    )
    op.create_foreign_key(
        "fk_si_billed_party_gstin",
        "sales_invoices", "customer_gst_registrations",
        ["billed_party_gstin_id"], ["id"], ondelete="SET NULL"
    )
    op.add_column("sales_invoices",
        sa.Column("delivery_location_snapshot",
                  postgresql.JSONB(astext_type=sa.Text()), nullable=True)
    )
    op.add_column("sales_invoices",
        sa.Column("place_of_supply_code", sa.String(2), nullable=True)
    )

    op.create_index("ix_si_delivery_location_id", "sales_invoices", ["delivery_location_id"])
    op.create_index("ix_si_delivery_store_code", "sales_invoices", ["delivery_store_code"])
    op.create_index("ix_si_billed_party_gstin_id", "sales_invoices", ["billed_party_gstin_id"])


def downgrade() -> None:
    op.drop_index("ix_si_billed_party_gstin_id", table_name="sales_invoices")
    op.drop_index("ix_si_delivery_store_code", table_name="sales_invoices")
    op.drop_index("ix_si_delivery_location_id", table_name="sales_invoices")

    op.drop_constraint("fk_si_billed_party_gstin", "sales_invoices", type_="foreignkey")
    op.drop_constraint("fk_si_delivery_location", "sales_invoices", type_="foreignkey")

    op.drop_column("sales_invoices", "place_of_supply_code")
    op.drop_column("sales_invoices", "delivery_location_snapshot")
    op.drop_column("sales_invoices", "billed_party_gstin_id")
    op.drop_column("sales_invoices", "delivery_gstin")
    op.drop_column("sales_invoices", "delivery_store_code")
    op.drop_column("sales_invoices", "delivery_location_id")

    op.execute("DROP INDEX IF EXISTS uq_cdl_customer_store_code_active")
    op.drop_index("ix_cdl_gst_registration_id", table_name="customer_delivery_locations")
    op.drop_index("ix_cdl_store_code", table_name="customer_delivery_locations")
    op.drop_index("ix_cdl_company_id", table_name="customer_delivery_locations")
    op.drop_index("ix_cdl_customer_id", table_name="customer_delivery_locations")
    op.drop_table("customer_delivery_locations")

    op.execute("DROP INDEX IF EXISTS uq_cust_gst_reg_primary_per_customer")
    op.drop_constraint("uq_cust_gst_reg_customer_gstin", "customer_gst_registrations",
                       type_="unique")
    op.drop_index("ix_cust_gst_reg_gstin", table_name="customer_gst_registrations")
    op.drop_index("ix_cust_gst_reg_company_id", table_name="customer_gst_registrations")
    op.drop_index("ix_cust_gst_reg_customer_id", table_name="customer_gst_registrations")
    op.drop_table("customer_gst_registrations")
