"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders
* Pushpa Devi Jawahar Mallah
  * Founder & Chairperson
* Jawahar Ramkripal Mallah
  * Founder, Chief Executive Officer (CEO) & Chief Software Architect

Websites: aitdl.com | erpnbook.com | smritibooks.com

Revision ID: v1544
Revises: v1543
Create Date: 2026-10-25
Classification: Customer Billing Channel & PO Policy Overrides
"""

from alembic import op
import sqlalchemy as sa

revision = "v1544"
down_revision = "v1543"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    current_db = (bind.execute(sa.text("SELECT current_database();")).scalar() or "").strip().lower()
    if not current_db or current_db in ("smritisys", "postgres", "template0", "template1"):
        return

    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())
    if "customer_policies" not in tables:
        return

    columns = {col["name"] for col in inspector.get_columns("customer_policies")}
    if "default_sales_channel" not in columns:
        op.add_column(
            "customer_policies",
            sa.Column("default_sales_channel", sa.String(length=50), nullable=True),
        )
    if "require_po_number" not in columns:
        op.add_column(
            "customer_policies",
            sa.Column("require_po_number", sa.Boolean(), nullable=True),
        )


def downgrade() -> None:
    bind = op.get_bind()
    current_db = (bind.execute(sa.text("SELECT current_database();")).scalar() or "").strip().lower()
    if not current_db or current_db in ("smritisys", "postgres", "template0", "template1"):
        return

    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())
    if "customer_policies" not in tables:
        return

    columns = {col["name"] for col in inspector.get_columns("customer_policies")}
    if "require_po_number" in columns:
        op.drop_column("customer_policies", "require_po_number")
    if "default_sales_channel" in columns:
        op.drop_column("customer_policies", "default_sales_channel")
