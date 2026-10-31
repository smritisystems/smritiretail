"""Add durable Sales Order and Packing Slip billing ownership/allocation.

Revision ID: v1567
Revises: v1566
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "v1567"
down_revision: Union[str, Sequence[str], None] = "v1566"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _inspector():
    return sa.inspect(op.get_bind())


def _has_table(table_name: str) -> bool:
    return _inspector().has_table(table_name)


def _has_column(table_name: str, column_name: str) -> bool:
    if not _has_table(table_name):
        return False
    return column_name in {column["name"] for column in _inspector().get_columns(table_name)}


def _has_index(table_name: str, index_name: str) -> bool:
    if not _has_table(table_name):
        return False
    return index_name in {index["name"] for index in _inspector().get_indexes(table_name)}


def _has_foreign_key(table_name: str, columns: list[str], referred_table: str) -> bool:
    if not _has_table(table_name):
        return False
    return any(
        foreign_key["constrained_columns"] == columns
        and foreign_key["referred_table"] == referred_table
        for foreign_key in _inspector().get_foreign_keys(table_name)
    )


def _create_index_if_missing(name: str, table_name: str, columns: list[str], **kwargs) -> None:
    if not _has_index(table_name, name):
        op.create_index(name, table_name, columns, **kwargs)


def upgrade() -> None:
    columns = (
        ("packing_slips", "customer_id", sa.Column("customer_id", sa.String(length=50), nullable=True)),
        ("packing_slips", "order_id", sa.Column("order_id", sa.String(length=50), nullable=True)),
        (
            "packing_slips",
            "billing_ownership_status",
            sa.Column(
                "billing_ownership_status",
                sa.String(length=20),
                nullable=False,
                server_default=sa.text("'UNVERIFIED'"),
            ),
        ),
        ("packing_slip_items", "order_item_id", sa.Column("order_item_id", sa.Integer(), nullable=True)),
    )
    for table_name, column_name, column in columns:
        if not _has_column(table_name, column_name):
            op.add_column(table_name, column)

    foreign_keys = (
        ("fk_packing_slips_customer_id_customers", "packing_slips", ["customer_id"], "customers"),
        ("fk_packing_slips_order_id_sales_orders", "packing_slips", ["order_id"], "sales_orders"),
        ("fk_packing_slip_items_order_item_id_sales_order_items", "packing_slip_items", ["order_item_id"], "sales_order_items"),
    )
    for name, table_name, columns, referred_table in foreign_keys:
        if not _has_foreign_key(table_name, columns, referred_table):
            op.create_foreign_key(name, table_name, referred_table, columns, ["id"], ondelete="RESTRICT")

    _create_index_if_missing("ix_packing_slips_customer_id", "packing_slips", ["customer_id"])
    _create_index_if_missing("ix_packing_slips_order_id", "packing_slips", ["order_id"])
    _create_index_if_missing("ix_packing_slip_items_order_item_id", "packing_slip_items", ["order_item_id"])

    # Backfill ownership only from a linked invoice, or from the invoice's
    # persisted Sales Order snapshot. Ambiguous/manual UNBILLED slips remain
    # quarantined for reconciliation rather than being inferred from UI text.
    op.execute(sa.text("""
        UPDATE packing_slips AS ps
        SET customer_id = si.customer_id,
            billing_ownership_status = 'VERIFIED'
        FROM sales_invoices AS si
        WHERE ps.company_id = si.company_id
          AND (ps.sales_invoice_id = si.id OR ps.sales_invoice_id = si.invoice_no)
          AND si.customer_id IS NOT NULL
          AND ps.customer_id IS NULL
    """))
    op.execute(sa.text("""
        UPDATE packing_slips AS ps
        SET order_id = so.id
        FROM sales_invoices AS si
        JOIN sales_orders AS so
          ON so.id = si.rule_snapshots ->> 'source_order_id'
         AND so.company_id = si.company_id
        WHERE ps.company_id = si.company_id
          AND (ps.sales_invoice_id = si.id OR ps.sales_invoice_id = si.invoice_no)
          AND ps.order_id IS NULL
    """))
    op.execute(sa.text("""
        UPDATE packing_slips
        SET billing_ownership_status = 'QUARANTINED'
        WHERE customer_id IS NULL
          AND billing_ownership_status = 'UNVERIFIED'
    """))
    op.execute(sa.text("""
        WITH unique_order_product AS (
            SELECT so.id AS order_id, soi.product_id, min(soi.id) AS order_item_id
            FROM sales_orders AS so
            JOIN sales_order_items AS soi ON soi.order_id = so.id
            WHERE soi.is_deleted = false
            GROUP BY so.id, soi.product_id
            HAVING count(*) = 1
        )
        UPDATE packing_slip_items AS psi
        SET order_item_id = uop.order_item_id
        FROM packing_slips AS ps
        JOIN unique_order_product AS uop
          ON uop.order_id = ps.order_id
        WHERE psi.packing_slip_id = ps.id
          AND psi.product_id = uop.product_id
          AND psi.order_item_id IS NULL
    """))

    allocation_table = "sales_source_invoice_allocations"
    if not _has_table(allocation_table):
        op.create_table(
            allocation_table,
            sa.Column("id", sa.String(length=50), primary_key=True),
            sa.Column("uuid", sa.String(length=36), nullable=False, unique=True),
            sa.Column("company_id", sa.String(length=50), nullable=True),
            sa.Column("branch_id", sa.String(length=50), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("modified_at", sa.DateTime(timezone=True), nullable=True, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("created_by", sa.String(length=100), nullable=True),
            sa.Column("updated_by", sa.String(length=100), nullable=True),
            sa.Column("is_active", sa.Boolean(), nullable=True, server_default=sa.text("true")),
            sa.Column("is_deleted", sa.Boolean(), nullable=True, server_default=sa.text("false")),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("deleted_by", sa.String(length=100), nullable=True),
            sa.Column("version", sa.Integer(), nullable=True, server_default=sa.text("1")),
            sa.Column("sales_order_id", sa.String(length=50), nullable=True),
            sa.Column("sales_order_item_id", sa.Integer(), nullable=True),
            sa.Column("packing_slip_id", sa.String(length=50), nullable=True),
            sa.Column("packing_slip_item_id", sa.String(length=50), nullable=True),
            sa.Column("invoice_id", sa.String(length=50), nullable=False),
            sa.Column("invoice_item_id", sa.Integer(), nullable=False),
            sa.Column("allocated_quantity", sa.Numeric(12, 4), nullable=False),
            sa.Column("allocated_value", sa.Numeric(15, 2), nullable=False, server_default=sa.text("0")),
            sa.Column("reversed_quantity", sa.Numeric(12, 4), nullable=False, server_default=sa.text("0")),
            sa.Column("reversed_value", sa.Numeric(15, 2), nullable=False, server_default=sa.text("0")),
            sa.Column("status", sa.String(length=20), nullable=False, server_default=sa.text("'COMMITTED'")),
            sa.Column("idempotency_key", sa.String(length=150), nullable=True),
            sa.CheckConstraint(
                "sales_order_item_id IS NOT NULL OR packing_slip_item_id IS NOT NULL",
                name="ck_source_invoice_allocation_has_source_line",
            ),
            sa.CheckConstraint(
                "allocated_quantity > 0 AND reversed_quantity >= 0 AND reversed_quantity <= allocated_quantity",
                name="ck_source_invoice_allocation_quantity_bounds",
            ),
            sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="RESTRICT"),
            sa.ForeignKeyConstraint(["branch_id"], ["branches.id"], ondelete="RESTRICT"),
            sa.ForeignKeyConstraint(["sales_order_id"], ["sales_orders.id"], ondelete="RESTRICT"),
            sa.ForeignKeyConstraint(["sales_order_item_id"], ["sales_order_items.id"], ondelete="RESTRICT"),
            sa.ForeignKeyConstraint(["packing_slip_id"], ["packing_slips.id"], ondelete="RESTRICT"),
            sa.ForeignKeyConstraint(["packing_slip_item_id"], ["packing_slip_items.id"], ondelete="RESTRICT"),
            sa.ForeignKeyConstraint(["invoice_id"], ["sales_invoices.id"], ondelete="RESTRICT"),
            sa.ForeignKeyConstraint(["invoice_item_id"], ["sales_invoice_items.id"], ondelete="RESTRICT"),
        )

    allocation_foreign_keys = (
        ("fk_sales_source_invoice_allocations_company_id_companies", ["company_id"], "companies"),
        ("fk_sales_source_invoice_allocations_branch_id_branches", ["branch_id"], "branches"),
        ("fk_sales_source_invoice_allocations_sales_order_id_sales_orders", ["sales_order_id"], "sales_orders"),
        ("fk_sales_source_invoice_allocations_sales_order_item_id_sales_order_items", ["sales_order_item_id"], "sales_order_items"),
        ("fk_sales_source_invoice_allocations_packing_slip_id_packing_slips", ["packing_slip_id"], "packing_slips"),
        ("fk_sales_source_invoice_allocations_packing_slip_item_id_packing_slip_items", ["packing_slip_item_id"], "packing_slip_items"),
        ("fk_sales_source_invoice_allocations_invoice_id_sales_invoices", ["invoice_id"], "sales_invoices"),
        ("fk_sales_source_invoice_allocations_invoice_item_id_sales_invoice_items", ["invoice_item_id"], "sales_invoice_items"),
    )
    for name, columns, referred_table in allocation_foreign_keys:
        if not _has_foreign_key(allocation_table, columns, referred_table):
            op.create_foreign_key(name, allocation_table, referred_table, columns, ["id"], ondelete="RESTRICT")

    for name, columns in (
        ("ix_sales_source_invoice_allocations_company_id", ["company_id"]),
        ("ix_sales_source_invoice_allocations_branch_id", ["branch_id"]),
        ("ix_sales_source_invoice_allocations_invoice_id", ["invoice_id"]),
        ("ix_sales_source_invoice_allocations_invoice_item_id", ["invoice_item_id"]),
        ("ix_sales_source_invoice_allocations_sales_order_id", ["sales_order_id"]),
        ("ix_sales_source_invoice_allocations_sales_order_item_id", ["sales_order_item_id"]),
        ("ix_sales_source_invoice_allocations_packing_slip_id", ["packing_slip_id"]),
        ("ix_sales_source_invoice_allocations_packing_slip_item_id", ["packing_slip_item_id"]),
        ("ix_source_invoice_so_available", ["company_id", "sales_order_item_id", "status"]),
        ("ix_source_invoice_ps_available", ["company_id", "packing_slip_item_id", "status"]),
        ("ix_source_invoice_idempotency", ["company_id", "idempotency_key"]),
    ):
        _create_index_if_missing(name, allocation_table, columns)
    _create_index_if_missing(
        "uq_source_invoice_so_line",
        allocation_table,
        ["company_id", "sales_order_item_id", "invoice_item_id"],
        unique=True,
        postgresql_where=sa.text("sales_order_item_id IS NOT NULL"),
    )
    _create_index_if_missing(
        "uq_source_invoice_ps_line",
        allocation_table,
        ["company_id", "packing_slip_item_id", "invoice_item_id"],
        unique=True,
        postgresql_where=sa.text("packing_slip_item_id IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_table("sales_source_invoice_allocations")
    op.drop_index("ix_packing_slip_items_order_item_id", table_name="packing_slip_items")
    op.drop_index("ix_packing_slips_order_id", table_name="packing_slips")
    op.drop_index("ix_packing_slips_customer_id", table_name="packing_slips")
    op.drop_constraint("fk_packing_slip_items_order_item_id_sales_order_items", "packing_slip_items", type_="foreignkey")
    op.drop_constraint("fk_packing_slips_order_id_sales_orders", "packing_slips", type_="foreignkey")
    op.drop_constraint("fk_packing_slips_customer_id_customers", "packing_slips", type_="foreignkey")
    op.drop_column("packing_slip_items", "order_item_id")
    op.drop_column("packing_slips", "billing_ownership_status")
    op.drop_column("packing_slips", "order_id")
    op.drop_column("packing_slips", "customer_id")
