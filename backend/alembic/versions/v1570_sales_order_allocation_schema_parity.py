"""Align legacy Sales Order allocations with the ORM entity schema.

Revision ID: v1570
Revises: v1569
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "v1570"
down_revision: Union[str, Sequence[str], None] = "v1569"
branch_labels: Union[str, Sequence[str], None] = None
depends_on = None


TABLE = "sales_order_invoice_allocations"


def _columns() -> set[str]:
    return {column["name"] for column in sa.inspect(op.get_bind()).get_columns(TABLE)}


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table(TABLE):
        op.create_table(
            TABLE,
            sa.Column("id", sa.String(50), primary_key=True),
            sa.Column("uuid", sa.String(36), nullable=False, unique=True),
            sa.Column("company_id", sa.String(50), nullable=True),
            sa.Column("branch_id", sa.String(50), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("modified_at", sa.DateTime(timezone=True), nullable=True, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("created_by", sa.String(100), nullable=True),
            sa.Column("updated_by", sa.String(100), nullable=True),
            sa.Column("is_active", sa.Boolean(), nullable=True, server_default=sa.text("true")),
            sa.Column("is_deleted", sa.Boolean(), nullable=True, server_default=sa.text("false")),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("deleted_by", sa.String(100), nullable=True),
            sa.Column("version", sa.Integer(), nullable=True, server_default=sa.text("1")),
            sa.Column("order_id", sa.String(50), nullable=False),
            sa.Column("order_no", sa.String(100), nullable=False),
            sa.Column("po_number", sa.String(100), nullable=False),
            sa.Column("invoice_id", sa.String(50), nullable=False),
            sa.Column("invoice_no", sa.String(100), nullable=False),
            sa.Column("invoice_date", sa.Date(), nullable=False),
            sa.Column("po_quantity", sa.Numeric(15, 4), nullable=False, server_default=sa.text("0.0000")),
            sa.Column("po_value", sa.Numeric(15, 2), nullable=False, server_default=sa.text("0.00")),
            sa.Column("billed_quantity", sa.Numeric(15, 4), nullable=False, server_default=sa.text("0.0000")),
            sa.Column("billed_value", sa.Numeric(15, 2), nullable=False, server_default=sa.text("0.00")),
            sa.Column("pending_quantity", sa.Numeric(15, 4), nullable=False, server_default=sa.text("0.0000")),
            sa.Column("pending_value", sa.Numeric(15, 2), nullable=False, server_default=sa.text("0.00")),
            sa.Column("status", sa.String(50), nullable=True, server_default="ALLOCATED"),
            sa.Column("allocation_metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
            sa.ForeignKeyConstraint(["order_id"], ["sales_orders.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["invoice_id"], ["sales_invoices.id"], ondelete="RESTRICT"),
        )
        return

    existing = _columns()
    required = (
        ("uuid", sa.Column("uuid", sa.String(36), nullable=True)),
        ("company_id", sa.Column("company_id", sa.String(50), nullable=True)),
        ("branch_id", sa.Column("branch_id", sa.String(50), nullable=True)),
        ("modified_at", sa.Column("modified_at", sa.DateTime(timezone=True), nullable=True, server_default=sa.text("CURRENT_TIMESTAMP"))),
        ("is_active", sa.Column("is_active", sa.Boolean(), nullable=True, server_default=sa.text("true"))),
        ("is_deleted", sa.Column("is_deleted", sa.Boolean(), nullable=True, server_default=sa.text("false"))),
        ("deleted_at", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True)),
        ("deleted_by", sa.Column("deleted_by", sa.String(100), nullable=True)),
        ("version", sa.Column("version", sa.Integer(), nullable=True, server_default=sa.text("1"))),
    )
    for name, column in required:
        if name not in existing:
            op.add_column(TABLE, column)

    bind = op.get_bind()
    bind.execute(sa.text(f"""
        UPDATE {TABLE}
        SET uuid = gen_random_uuid()::text
        WHERE uuid IS NULL
    """))
    bind.execute(sa.text(f"""
        UPDATE {TABLE} AS allocation
        SET company_id = COALESCE(allocation.company_id, sales_order.company_id),
            branch_id = COALESCE(allocation.branch_id, sales_order.branch_id),
            modified_at = COALESCE(allocation.modified_at, allocation.created_at, CURRENT_TIMESTAMP),
            is_active = COALESCE(allocation.is_active, true),
            is_deleted = COALESCE(allocation.is_deleted, false),
            version = COALESCE(allocation.version, 1)
        FROM sales_orders AS sales_order
        WHERE sales_order.id = allocation.order_id
    """))
    bind.execute(sa.text(f"""
        UPDATE {TABLE}
        SET modified_at = COALESCE(modified_at, created_at, CURRENT_TIMESTAMP),
            is_active = COALESCE(is_active, true),
            is_deleted = COALESCE(is_deleted, false),
            version = COALESCE(version, 1)
        WHERE modified_at IS NULL
           OR is_active IS NULL
           OR is_deleted IS NULL
           OR version IS NULL
    """))

    constraints = {
        constraint["name"]
        for constraint in sa.inspect(bind).get_unique_constraints(TABLE)
    }
    if "uq_sales_order_invoice_allocations_uuid" not in constraints:
        op.create_unique_constraint(
            "uq_sales_order_invoice_allocations_uuid",
            TABLE,
            ["uuid"],
        )
    op.alter_column(TABLE, "uuid", nullable=False)


def downgrade() -> None:
    # Schema-parity repair is intentionally additive and preserves allocation history.
    pass
