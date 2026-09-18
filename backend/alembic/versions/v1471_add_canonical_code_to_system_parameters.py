"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.41.0
Created      : 2026-09-18
Modified     : 2026-09-18
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Core Architecture

Revision ID: v1471_add_canonical_code_to_system_parameters
Revises: v1470_purchase_grn_debit_note_purchase_bill_identity
Create Date: 2026-09-18 23:15:00.000000

Governance Standard: AGENTS.md Rules 1-12, UADHP-v1.0
Scope of Migration:
  - Adds `canonical_code` column (VARCHAR 150, nullable) to `system_parameters` table.
  - Creates index `idx_sys_param_canonical_code` on `canonical_code` for fast dual-key
    resolution (canonical SMRITI.DOMAIN.FEATURE keys alongside legacy Shoper 9 param_code).
  - This is a non-breaking additive migration. All existing param_code values are preserved.
  - The canonical_code column is populated by the subsequent backfill migration v1472.

Architecture Context:
  - Activates the SMRITI canonical parameter namespace defined in ADR-042.
  - Enables dual-key resolution: SMRITI.* -> canonical_code; legacy -> param_code.
  - Zero regression on existing POS billing, seeding, and test suites.
"""

from alembic import op
import sqlalchemy as sa

revision = "v1471_add_canonical_code_to_system_parameters"
down_revision = "v1470_purchase_grn_debit_note_purchase_bill_identity"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = inspector.get_table_names()

    if "system_parameters" not in tables:
        # Create system_parameters table if running in fresh test/isolated tenant DB
        op.create_table(
            "system_parameters",
            sa.Column("id", sa.String(50), primary_key=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("modified_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
            sa.Column("created_by", sa.String(100), nullable=True),
            sa.Column("updated_by", sa.String(100), nullable=True),
            sa.Column("tenant_id", sa.String(50), nullable=True, index=True),
            sa.Column("company_id", sa.String(50), nullable=True, index=True),
            sa.Column("branch_id", sa.String(50), nullable=True, index=True),
            sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
            sa.Column("is_deleted", sa.Boolean(), server_default=sa.false(), nullable=False),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("deleted_by", sa.String(100), nullable=True),
            sa.Column("version", sa.Integer(), server_default="1", nullable=False),
            sa.Column("uuid", sa.String(36), nullable=True),
            sa.Column("param_code", sa.String(100), nullable=False, index=True),
            sa.Column("canonical_code", sa.String(150), nullable=True, index=True),
            sa.Column("category", sa.String(50), nullable=False, index=True),
            sa.Column("category_name", sa.String(100), nullable=False),
            sa.Column("description", sa.String(255), nullable=False),
            sa.Column("data_type", sa.String(10), nullable=False),
            sa.Column("mutability", sa.String(20), server_default="Variable", nullable=False),
            sa.Column("profile_type", sa.String(20), server_default="COMMON", nullable=False),
            sa.Column("val_boolean", sa.Boolean(), nullable=True),
            sa.Column("val_integer", sa.Integer(), nullable=True),
            sa.Column("val_text", sa.Text(), nullable=True),
            sa.Column("val_decimal", sa.Numeric(14, 4), nullable=True),
            sa.Column("val_date", sa.Date(), nullable=True),
            sa.Column("scope_level", sa.String(20), server_default="COMPANY", nullable=False),
            sa.Column("terminal_id", sa.String(50), server_default="COMMON", nullable=False),
            sa.Column("is_locked", sa.Boolean(), server_default=sa.false(), nullable=False),
        )
        op.create_index("idx_sys_param_comp_code_term", "system_parameters", ["company_id", "param_code", "terminal_id"])
        op.create_index("idx_sys_param_cat", "system_parameters", ["category"])
        op.create_index("idx_sys_param_code", "system_parameters", ["param_code"])
        op.create_index("idx_sys_param_canonical_code", "system_parameters", ["canonical_code"])
    else:
        columns = [c["name"] for c in inspector.get_columns("system_parameters")]
        if "canonical_code" not in columns:
            op.add_column(
                "system_parameters",
                sa.Column("canonical_code", sa.String(150), nullable=True),
            )
            op.create_index(
                "idx_sys_param_canonical_code",
                "system_parameters",
                ["canonical_code"],
                unique=False,
            )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = inspector.get_table_names()
    if "system_parameters" in tables:
        columns = [c["name"] for c in inspector.get_columns("system_parameters")]
        if "canonical_code" in columns:
            op.drop_index("idx_sys_param_canonical_code", table_name="system_parameters")
            op.drop_column("system_parameters", "canonical_code")
