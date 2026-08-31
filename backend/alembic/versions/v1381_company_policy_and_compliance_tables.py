"""
Alembic v1381 -- Company policy, bank accounts, and compliance thresholds.

Adds the per-company policy tables and the system-regulatory compliance table
required for configurable thresholds and logo/bank metadata.
"""

from alembic import op
import sqlalchemy as sa

revision = "v1381_policy"
down_revision = "v1380_payment_transactions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "companies" in tables:
        company_columns = {c["name"] for c in inspector.get_columns("companies")}
        if "company_code" not in company_columns:
            op.add_column("companies", sa.Column("company_code", sa.String(50), nullable=True, unique=True))
        if "logo_url" not in company_columns:
            op.add_column("companies", sa.Column("logo_url", sa.String(500), nullable=True))

    if "company_bank_accounts" not in tables:
        op.create_table(
            "company_bank_accounts",
            sa.Column("id", sa.String(50), primary_key=True, nullable=False),
            sa.Column("company_id", sa.String(50), sa.ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True),
            sa.Column("bank_name", sa.String(255), nullable=True),
            sa.Column("account_no", sa.String(50), nullable=True),
            sa.Column("ifsc", sa.String(20), nullable=True),
            sa.Column("branch", sa.String(255), nullable=True),
            sa.Column("is_default", sa.Boolean(), server_default="true", nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        )

    if "company_policy_settings" not in tables:
        op.create_table(
            "company_policy_settings",
            sa.Column("company_id", sa.String(50), sa.ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True),
            sa.Column("key", sa.String(100), nullable=False),
            sa.Column("value", sa.Text(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
            sa.Column("updated_by", sa.String(50), nullable=True),
            sa.PrimaryKeyConstraint("company_id", "key"),
        )

    if "compliance_thresholds" not in tables:
        op.create_table(
            "compliance_thresholds",
            sa.Column("key", sa.String(100), nullable=False),
            sa.Column("value", sa.Text(), nullable=False),
            sa.Column("effective_from", sa.Date(), nullable=False),
            sa.Column("effective_to", sa.Date(), nullable=True),
            sa.Column("source_reference", sa.String(255), nullable=True),
            sa.Column("updated_by", sa.String(50), nullable=True),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
            sa.PrimaryKeyConstraint("key", "effective_from"),
        )

    op.execute(
        sa.text(
            """
            INSERT INTO compliance_thresholds (key, value, effective_from, effective_to, source_reference, updated_by, updated_at)
            VALUES ('EWAY_BILL_THRESHOLD_INR', '50000', '2021-04-01', NULL, 'Rule 138 CGST Rules', 'system', NOW())
            ON CONFLICT (key, effective_from) DO NOTHING
            """
        )
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "compliance_thresholds" in tables:
        op.drop_table("compliance_thresholds")
    if "company_policy_settings" in tables:
        op.drop_table("company_policy_settings")
    if "company_bank_accounts" in tables:
        op.drop_table("company_bank_accounts")
    if "companies" in tables:
        company_columns = [c["name"] for c in inspector.get_columns("companies")]
        if "logo_url" in company_columns:
            op.drop_column("companies", "logo_url")
        if "company_code" in company_columns:
            op.drop_column("companies", "company_code")
