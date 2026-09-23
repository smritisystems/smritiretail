"""Add kpi_definitions table.

Provides a data-driven KPI Definition Registry that replaces the hard-coded
KPI values in Executive Hub dashboards. Supports CRUD management of KPI
formulas, targets, alert thresholds, and dashboard placement metadata.

Revision ID  : v1484_kpi_definitions_table
Revises      : v1483_dispatch_batch_tables
Create Date  : 2026-09-24
"""
# Project      : SMRITI Retail OS
# Author       : Jawahar Ramkripal Mallah
# Designation  : Chief Systems Architect & Creator
# Email        : support@smritibooks.com
# Websites     : smritibooks.com | erpnbook.com | aitdl.com
# Version      : 1.0.0
# Created      : 2026-09-24
# Copyright    : © SMRITIBooks.com. All Rights Reserved.
# License      : Proprietary Commercial Software

from alembic import op
import sqlalchemy as sa

revision = "v1484_kpi_definitions_table"
down_revision = "v1483_dispatch_batch_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "kpi_definitions",
        sa.Column("id",                  sa.String(50),     nullable=False),
        sa.Column("uuid",                sa.String(36),     nullable=False),
        sa.Column("company_id",          sa.String(50),     nullable=True),
        sa.Column("name",                sa.String(150),    nullable=False),
        sa.Column("code",                sa.String(60),     nullable=False),
        sa.Column("description",         sa.Text(),         nullable=True),
        sa.Column("category",            sa.String(80),     nullable=True),
        sa.Column("icon",                sa.String(50),     nullable=True),
        sa.Column("color",               sa.String(30),     nullable=True),
        sa.Column("formula_key",         sa.String(250),    nullable=False),
        sa.Column("unit",                sa.String(30),     nullable=True),
        sa.Column("aggregation",         sa.String(30),     nullable=True, server_default="SUM"),
        sa.Column("target_value",        sa.Numeric(18, 4), nullable=True),
        sa.Column("alert_below",         sa.Numeric(18, 4), nullable=True),
        sa.Column("alert_above",         sa.Numeric(18, 4), nullable=True),
        sa.Column("alert_severity",      sa.String(20),     nullable=True),
        sa.Column("dashboard_placement", sa.String(80),     nullable=True),
        sa.Column("sort_order",          sa.String(10),     nullable=True, server_default="0"),
        sa.Column("status",              sa.String(20),     nullable=False, server_default="ACTIVE"),
        sa.Column("is_active",           sa.Boolean(),      nullable=False, server_default=sa.true()),
        sa.Column("is_deleted",          sa.Boolean(),      nullable=False, server_default=sa.false()),
        sa.Column("created_by",          sa.String(100),    nullable=True),
        sa.Column("updated_by",          sa.String(100),    nullable=True),
        sa.Column("created_at",          sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
        sa.Column("updated_at",          sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("uuid", name="uq_kpi_definitions_uuid"),
    )

    # Index: code lookup per company (with NULL-safe composite unique)
    op.create_index("ix_kpi_definitions_company_code", "kpi_definitions",
                    ["company_id", "code"], unique=True)
    op.create_index("ix_kpi_definitions_company_id",   "kpi_definitions", ["company_id"])
    op.create_index("ix_kpi_definitions_code",         "kpi_definitions", ["code"])
    op.create_index("ix_kpi_definitions_status",       "kpi_definitions", ["status"])
    op.create_index("ix_kpi_definitions_is_active",    "kpi_definitions", ["is_active"])
    op.create_index("ix_kpi_definitions_is_deleted",   "kpi_definitions", ["is_deleted"])
    op.create_index("ix_kpi_definitions_category",     "kpi_definitions", ["category"])


def downgrade() -> None:
    op.drop_index("ix_kpi_definitions_category",     table_name="kpi_definitions")
    op.drop_index("ix_kpi_definitions_is_deleted",   table_name="kpi_definitions")
    op.drop_index("ix_kpi_definitions_is_active",    table_name="kpi_definitions")
    op.drop_index("ix_kpi_definitions_status",       table_name="kpi_definitions")
    op.drop_index("ix_kpi_definitions_code",         table_name="kpi_definitions")
    op.drop_index("ix_kpi_definitions_company_id",   table_name="kpi_definitions")
    op.drop_index("ix_kpi_definitions_company_code", table_name="kpi_definitions")
    op.drop_table("kpi_definitions")
