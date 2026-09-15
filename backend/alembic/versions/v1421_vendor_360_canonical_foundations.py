"""
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.16.0
 * Created      : 2026-09-11
 * Modified     : 2026-09-11
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
"""

"""Vendor 360 Canonical Foundations & Universal Party Enhancements.

Creates party_bank_accounts, vendor_identity_migrations, enhances supplier_profiles
with statutory/compliance attributes, and categorizes party_contacts.

Revision ID: v1421_vendor_360
Revises: v1420_cash_reg_wh
Create Date: 2026-09-11
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "v1421_vendor_360"
down_revision: Union[str, Sequence[str], None] = "v1420_cash_reg_wh"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()

    current_db = bind.execute(sa.text("SELECT current_database();")).scalar()
    if not current_db or current_db.lower() in ("smritisys", "postgres", "template0", "template1"):
        return

    inspector = sa.inspect(bind)
    table_names = inspector.get_table_names()

    # 1. party_bank_accounts
    if "party_bank_accounts" not in table_names:
        op.create_table(
            "party_bank_accounts",
            sa.Column("id", sa.String(50), primary_key=True),
            sa.Column("uuid", sa.String(36), server_default=sa.text("md5(random()::text || clock_timestamp()::text)::uuid::text"), nullable=False),
            sa.Column("company_id", sa.String(50), nullable=True),
            sa.Column("branch_id", sa.String(50), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
            sa.Column("modified_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
            sa.Column("created_by", sa.String(100), nullable=True),
            sa.Column("updated_by", sa.String(100), nullable=True),
            sa.Column("is_active", sa.Boolean, server_default="true", nullable=False),
            sa.Column("is_deleted", sa.Boolean, server_default="false", nullable=False),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("deleted_by", sa.String(100), nullable=True),
            sa.Column("version", sa.Integer, server_default="1", nullable=False),
            sa.Column("party_id", sa.String(50), sa.ForeignKey("parties.id", ondelete="CASCADE"), nullable=False),
            sa.Column("bank_name", sa.String(150), nullable=False),
            sa.Column("account_holder_name", sa.String(150), nullable=False),
            sa.Column("account_number", sa.String(50), nullable=False),
            sa.Column("ifsc", sa.String(20), nullable=False),
            sa.Column("branch", sa.String(100), nullable=True),
            sa.Column("account_type", sa.String(30), server_default="'CURRENT'", nullable=False),
            sa.Column("is_primary", sa.Boolean, server_default="false", nullable=False),
            sa.Column("verification_status", sa.String(30), server_default="'PENDING'", nullable=False),
            sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        )
        op.create_index("ix_party_bank_accounts_party_id", "party_bank_accounts", ["party_id"])

    # 2. vendor_identity_migrations
    if "vendor_identity_migrations" not in table_names:
        op.create_table(
            "vendor_identity_migrations",
            sa.Column("id", sa.String(50), primary_key=True),
            sa.Column("uuid", sa.String(36), server_default=sa.text("md5(random()::text || clock_timestamp()::text)::uuid::text"), nullable=False),
            sa.Column("company_id", sa.String(50), nullable=True),
            sa.Column("branch_id", sa.String(50), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
            sa.Column("modified_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
            sa.Column("created_by", sa.String(100), nullable=True),
            sa.Column("updated_by", sa.String(100), nullable=True),
            sa.Column("is_active", sa.Boolean, server_default="true", nullable=False),
            sa.Column("is_deleted", sa.Boolean, server_default="false", nullable=False),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("deleted_by", sa.String(100), nullable=True),
            sa.Column("version", sa.Integer, server_default="1", nullable=False),
            sa.Column("legacy_supplier_id", sa.String(50), nullable=False),
            sa.Column("party_id", sa.String(50), sa.ForeignKey("parties.id", ondelete="CASCADE"), nullable=False),
            sa.Column("migration_status", sa.String(30), server_default="'COMPLETED'", nullable=False),
            sa.Column("migration_reason", sa.String(100), server_default="'LEGACY_CONVERGENCE'", nullable=False),
            sa.Column("migrated_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
            sa.Column("migrated_by", sa.String(50), nullable=True),
            sa.Column("details_json", JSONB, server_default=sa.text("'{}'::jsonb"), nullable=False),
        )
        op.create_index("ix_vendor_identity_migrations_legacy_supplier_id", "vendor_identity_migrations", ["legacy_supplier_id"])
        op.create_index("ix_vendor_identity_migrations_party_id", "vendor_identity_migrations", ["party_id"])

    # 3. Enhance party_contacts with contact_category
    if "party_contacts" in table_names:
        contact_cols = {col["name"] for col in inspector.get_columns("party_contacts")}
        if "contact_category" not in contact_cols:
            op.add_column(
                "party_contacts",
                sa.Column("contact_category", sa.String(30), server_default="'GENERAL'", nullable=False)
            )

    # 4. Enhance supplier_profiles with statutory & classification attributes
    if "supplier_profiles" in table_names:
        supp_cols = {col["name"] for col in inspector.get_columns("supplier_profiles")}
        if "msme_category" not in supp_cols:
            op.add_column(
                "supplier_profiles",
                sa.Column("msme_category", sa.String(30), server_default="'NOT_APPLICABLE'", nullable=True)
            )
        if "commercial_classification" not in supp_cols:
            op.add_column(
                "supplier_profiles",
                sa.Column("commercial_classification", sa.String(30), server_default="'APPROVED'", nullable=False)
            )
        if "tds_section" not in supp_cols:
            op.add_column(
                "supplier_profiles",
                sa.Column("tds_section", sa.String(20), server_default="'194Q'", nullable=True)
            )
        if "tds_rate" not in supp_cols:
            op.add_column(
                "supplier_profiles",
                sa.Column("tds_rate", sa.Numeric(5, 2), server_default="0.10", nullable=False)
            )
        if "verification_flags" not in supp_cols:
            op.add_column(
                "supplier_profiles",
                sa.Column("verification_flags", JSONB, server_default=sa.text("'{}'::jsonb"), nullable=False)
            )


def downgrade() -> None:
    bind = op.get_bind()
    current_db = bind.execute(sa.text("SELECT current_database();")).scalar()
    if not current_db or current_db.lower() in ("smritisys", "postgres", "template0", "template1"):
        return

    inspector = sa.inspect(bind)
    table_names = inspector.get_table_names()

    if "supplier_profiles" in table_names:
        supp_cols = {col["name"] for col in inspector.get_columns("supplier_profiles")}
        for col_name in ("verification_flags", "tds_rate", "tds_section", "commercial_classification", "msme_category"):
            if col_name in supp_cols:
                op.drop_column("supplier_profiles", col_name)

    if "party_contacts" in table_names:
        contact_cols = {col["name"] for col in inspector.get_columns("party_contacts")}
        if "contact_category" in contact_cols:
            op.drop_column("party_contacts", "contact_category")

    if "vendor_identity_migrations" in table_names:
        op.drop_table("vendor_identity_migrations")

    if "party_bank_accounts" in table_names:
        op.drop_table("party_bank_accounts")
