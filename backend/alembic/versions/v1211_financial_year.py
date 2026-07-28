"""Add financial_year table — Phase 1 Accounting Gap

DBP Reference : SMRITI_DATABASE_BLUEPRINT_v1.0.md §2.10 — Accounting
CDM Reference : SMRITI_CANONICAL_DATA_MODEL_v1.0.md — FinancialYear
ADR Reference : ADR-012 (Database Blueprint Governance — Phase 1 Accounting Gap)
GR Reference  : GR-009 (YAGNI — only what is needed now), GR-001 (SSOT)

Purpose:
    Introduces the canonical `financial_year` table for formal fiscal period management.
    Required for:
    - GST return filing period locking
    - Ledger close and period lock enforcement
    - Future: `journal_entries` FK reference to financial year

Revision ID   : v1211_financial_year
Revises       : v1210_smriti_modular_platform
Create Date   : 2026-07-28
"""

from alembic import op
import sqlalchemy as sa

revision = "v1211_financial_year"
down_revision = "v1210_smriti_modular_platform"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "financial_year",
        sa.Column("id",            sa.String(50),  primary_key=True, nullable=False),
        sa.Column("uuid",          sa.String(36),  nullable=False, unique=True),
        sa.Column("tenant_id",     sa.String(50),  nullable=True,  index=True),
        sa.Column("company_id",    sa.String(50),  sa.ForeignKey("companies.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("branch_id",     sa.String(50),  sa.ForeignKey("branches.id",  ondelete="RESTRICT"), nullable=True),

        # FinancialYear-specific fields
        sa.Column("name",           sa.String(50),  nullable=False),          # e.g. "2025-26"
        sa.Column("label",          sa.String(100), nullable=True),           # e.g. "FY 2025-2026"
        sa.Column("start_date",     sa.Date(),      nullable=False),          # April 1
        sa.Column("end_date",       sa.Date(),      nullable=False),          # March 31
        sa.Column("is_current",     sa.Boolean(),   nullable=False, server_default="false"),
        sa.Column("is_locked",      sa.Boolean(),   nullable=False, server_default="false"),
        sa.Column("locked_at",      sa.DateTime(timezone=True), nullable=True),
        sa.Column("locked_by",      sa.String(100), nullable=True),
        sa.Column("gst_period_code",sa.String(20),  nullable=True),           # e.g. "2025-2026"
        sa.Column("status",         sa.String(30),  nullable=False, server_default="'OPEN'"),  # OPEN, CLOSED, ARCHIVED

        # BaseEntity audit fields
        sa.Column("created_at",     sa.DateTime(timezone=True), nullable=True, server_default=sa.text("now()")),
        sa.Column("modified_at",    sa.DateTime(timezone=True), nullable=True, server_default=sa.text("now()")),
        sa.Column("created_by",     sa.String(100), nullable=True),
        sa.Column("updated_by",     sa.String(100), nullable=True),
        sa.Column("is_active",      sa.Boolean(),   nullable=False, server_default="true"),
        sa.Column("is_deleted",     sa.Boolean(),   nullable=False, server_default="false"),
        sa.Column("deleted_at",     sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by",     sa.String(100), nullable=True),
        sa.Column("version",        sa.Integer(),   nullable=False, server_default="1"),
        sa.Column("workflow_status",sa.String(30),  nullable=True),
        sa.Column("document_number",sa.String(80),  nullable=True),
    )

    # Composite unique: one financial year name per company
    op.create_unique_constraint(
        "uq_financial_year_company_name",
        "financial_year",
        ["company_id", "name"]
    )

    # Index for active year lookup
    op.create_index(
        "ix_financial_year_company_current",
        "financial_year",
        ["company_id", "is_current"]
    )


def downgrade() -> None:
    op.drop_index("ix_financial_year_company_current", table_name="financial_year")
    op.drop_constraint("uq_financial_year_company_name", "financial_year", type_="unique")
    op.drop_table("financial_year")
