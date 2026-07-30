"""
Alembic Migration: SCDM v1.1 Settlement & Claims Engine
Revision     : v1310_scdm_settlements
Revises      : v1300_scdm_channel_distribution
"""

from typing import Union, Sequence
import sqlalchemy as sa
from alembic import op

revision: str = "v1310_scdm_settlements"
down_revision: Union[str, Sequence[str], None] = "v1300_scdm_channel_distribution"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Create scdm_claim_types
    op.create_table(
        "scdm_claim_types",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("tenant_id", sa.String(length=50), nullable=True),
        sa.Column("company_id", sa.String(length=50), nullable=True),
        sa.Column("code", sa.String(length=50), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("category", sa.String(length=50), nullable=False, server_default="Shortage"),
        sa.Column("requires_approval", sa.Boolean(), nullable=True, server_default="true"),
        sa.Column("requires_evidence", sa.Boolean(), nullable=True, server_default="false"),
        sa.Column("tax_treatment", sa.String(length=50), nullable=True, server_default="GST_Reversal"),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=True, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_scdm_claim_types_code", "scdm_claim_types", ["code"], unique=True)
    op.create_index("ix_scdm_claim_types_tenant_id", "scdm_claim_types", ["tenant_id"], unique=False)
    op.create_index("ix_scdm_claim_types_company_id", "scdm_claim_types", ["company_id"], unique=False)

    # 2. Create scdm_claims
    op.create_table(
        "scdm_claims",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("tenant_id", sa.String(length=50), nullable=True),
        sa.Column("company_id", sa.String(length=50), nullable=True),
        sa.Column("branch_id", sa.String(length=50), nullable=True),
        sa.Column("claim_number", sa.String(length=50), nullable=False),
        sa.Column("customer_id", sa.String(length=50), nullable=False),
        sa.Column("dispatch_id", sa.String(length=50), nullable=True),
        sa.Column("claim_type_id", sa.String(length=50), nullable=True),
        sa.Column("claim_category", sa.String(length=50), nullable=False, server_default="Shortage"),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="Draft"),
        sa.Column("claimed_amount", sa.Numeric(precision=14, scale=2), nullable=False, server_default="0.00"),
        sa.Column("approved_amount", sa.Numeric(precision=14, scale=2), nullable=False, server_default="0.00"),
        sa.Column("rejected_amount", sa.Numeric(precision=14, scale=2), nullable=False, server_default="0.00"),
        sa.Column("reference_doc_no", sa.String(length=100), nullable=True),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("rejection_reason", sa.Text(), nullable=True),
        sa.Column("attachments_json", sa.JSON(), nullable=True),
        sa.Column("created_by", sa.String(length=100), nullable=True),
        sa.Column("reviewed_by", sa.String(length=100), nullable=True),
        sa.Column("approved_by", sa.String(length=100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["customer_id"], ["customers.id"]),
        sa.ForeignKeyConstraint(["dispatch_id"], ["scdm_channel_dispatches.id"]),
        sa.ForeignKeyConstraint(["claim_type_id"], ["scdm_claim_types.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_scdm_claims_claim_number", "scdm_claims", ["claim_number"], unique=True)
    op.create_index("ix_scdm_claims_customer_id", "scdm_claims", ["customer_id"], unique=False)
    op.create_index("ix_scdm_claims_dispatch_id", "scdm_claims", ["dispatch_id"], unique=False)
    op.create_index("ix_scdm_claims_status", "scdm_claims", ["status"], unique=False)

    # 3. Create scdm_settlements
    op.create_table(
        "scdm_settlements",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("tenant_id", sa.String(length=50), nullable=True),
        sa.Column("company_id", sa.String(length=50), nullable=True),
        sa.Column("branch_id", sa.String(length=50), nullable=True),
        sa.Column("settlement_number", sa.String(length=50), nullable=False),
        sa.Column("customer_id", sa.String(length=50), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="Draft"),
        sa.Column("remittance_ref", sa.String(length=100), nullable=True),
        sa.Column("remittance_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("gross_dispatch_value", sa.Numeric(precision=14, scale=2), nullable=False, server_default="0.00"),
        sa.Column("total_deductions", sa.Numeric(precision=14, scale=2), nullable=False, server_default="0.00"),
        sa.Column("net_received_amount", sa.Numeric(precision=14, scale=2), nullable=False, server_default="0.00"),
        sa.Column("unreconciled_variance", sa.Numeric(precision=14, scale=2), nullable=False, server_default="0.00"),
        sa.Column("payment_advice_doc", sa.String(length=255), nullable=True),
        sa.Column("remarks", sa.Text(), nullable=True),
        sa.Column("created_by", sa.String(length=100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reconciled_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["customer_id"], ["customers.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_scdm_settlements_settlement_number", "scdm_settlements", ["settlement_number"], unique=True)
    op.create_index("ix_scdm_settlements_customer_id", "scdm_settlements", ["customer_id"], unique=False)
    op.create_index("ix_scdm_settlements_status", "scdm_settlements", ["status"], unique=False)

    # 4. Create scdm_settlement_lines
    op.create_table(
        "scdm_settlement_lines",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("settlement_id", sa.String(length=50), nullable=False),
        sa.Column("dispatch_id", sa.String(length=50), nullable=True),
        sa.Column("claim_id", sa.String(length=50), nullable=True),
        sa.Column("line_type", sa.String(length=50), nullable=False, server_default="Dispatch"),
        sa.Column("amount", sa.Numeric(precision=14, scale=2), nullable=False, server_default="0.00"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["settlement_id"], ["scdm_settlements.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["dispatch_id"], ["scdm_channel_dispatches.id"]),
        sa.ForeignKeyConstraint(["claim_id"], ["scdm_claims.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_scdm_settlement_lines_settlement_id", "scdm_settlement_lines", ["settlement_id"], unique=False)
    op.create_index("ix_scdm_settlement_lines_dispatch_id", "scdm_settlement_lines", ["dispatch_id"], unique=False)
    op.create_index("ix_scdm_settlement_lines_claim_id", "scdm_settlement_lines", ["claim_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_scdm_settlement_lines_claim_id", table_name="scdm_settlement_lines")
    op.drop_index("ix_scdm_settlement_lines_dispatch_id", table_name="scdm_settlement_lines")
    op.drop_index("ix_scdm_settlement_lines_settlement_id", table_name="scdm_settlement_lines")
    op.drop_table("scdm_settlement_lines")

    op.drop_index("ix_scdm_settlements_status", table_name="scdm_settlements")
    op.drop_index("ix_scdm_settlements_customer_id", table_name="scdm_settlements")
    op.drop_index("ix_scdm_settlements_settlement_number", table_name="scdm_settlements")
    op.drop_table("scdm_settlements")

    op.drop_index("ix_scdm_claims_status", table_name="scdm_claims")
    op.drop_index("ix_scdm_claims_dispatch_id", table_name="scdm_claims")
    op.drop_index("ix_scdm_claims_customer_id", table_name="scdm_claims")
    op.drop_index("ix_scdm_claims_claim_number", table_name="scdm_claims")
    op.drop_table("scdm_claims")

    op.drop_index("ix_scdm_claim_types_company_id", table_name="scdm_claim_types")
    op.drop_index("ix_scdm_claim_types_tenant_id", table_name="scdm_claim_types")
    op.drop_index("ix_scdm_claim_types_code", table_name="scdm_claim_types")
    op.drop_table("scdm_claim_types")
