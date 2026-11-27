"""Align sales order invoice allocations with the shared entity model."""

from alembic import op
import sqlalchemy as sa


revision = "v1394_so_alloc_entity_fields"
down_revision = "v1393_product_type_dimension"
branch_labels = None
depends_on = None


TABLE = "sales_order_invoice_allocations"


def upgrade() -> None:
    op.add_column(
        TABLE,
        sa.Column(
            "uuid",
            sa.String(36),
            nullable=False,
            server_default=sa.text("gen_random_uuid()::text"),
        ),
    )
    op.create_unique_constraint(
        "uq_sales_order_invoice_allocations_uuid",
        TABLE,
        ["uuid"],
    )
    op.add_column(TABLE, sa.Column("company_id", sa.String(50), nullable=True))
    op.add_column(TABLE, sa.Column("branch_id", sa.String(50), nullable=True))
    op.create_foreign_key(
        "fk_sales_order_invoice_allocations_company_id",
        TABLE,
        "companies",
        ["company_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_foreign_key(
        "fk_sales_order_invoice_allocations_branch_id",
        TABLE,
        "branches",
        ["branch_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.add_column(
        TABLE,
        sa.Column(
            "modified_at",
            sa.DateTime(timezone=True),
            nullable=True,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    )
    op.add_column(
        TABLE,
        sa.Column("is_active", sa.Boolean(), nullable=True, server_default=sa.true()),
    )
    op.add_column(
        TABLE,
        sa.Column("is_deleted", sa.Boolean(), nullable=True, server_default=sa.false()),
    )
    op.add_column(TABLE, sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column(TABLE, sa.Column("deleted_by", sa.String(100), nullable=True))
    op.add_column(
        TABLE,
        sa.Column("version", sa.Integer(), nullable=True, server_default=sa.text("1")),
    )


def downgrade() -> None:
    op.drop_column(TABLE, "version")
    op.drop_column(TABLE, "deleted_by")
    op.drop_column(TABLE, "deleted_at")
    op.drop_column(TABLE, "is_deleted")
    op.drop_column(TABLE, "is_active")
    op.drop_column(TABLE, "modified_at")
    op.drop_constraint(
        "fk_sales_order_invoice_allocations_branch_id",
        TABLE,
        type_="foreignkey",
    )
    op.drop_constraint(
        "fk_sales_order_invoice_allocations_company_id",
        TABLE,
        type_="foreignkey",
    )
    op.drop_column(TABLE, "branch_id")
    op.drop_column(TABLE, "company_id")
    op.drop_constraint(
        "uq_sales_order_invoice_allocations_uuid",
        TABLE,
        type_="unique",
    )
    op.drop_column(TABLE, "uuid")
