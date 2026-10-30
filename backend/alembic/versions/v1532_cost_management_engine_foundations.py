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

Revision ID: v1532_cost_management_engine_foundations
Revises: v1531_harden_item_price_revisions_fk
Create Date: 2026-10-14
Classification: Cost & Valuation Engine Lineage
"""

import os
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.sql import text

from alembic import op

revision: str = "v1532_cost_management_engine_foundations"
down_revision: str | Sequence[str] | None = "v1531_harden_item_price_revisions_fk"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()

    # 1. product_cost_valuations
    if "product_cost_valuations" not in existing_tables:
        op.create_table(
            "product_cost_valuations",
            sa.Column("id", sa.String(50), primary_key=True),
            sa.Column("uuid", sa.String(36), nullable=False, unique=True),
            sa.Column(
                "company_id",
                sa.String(50),
                sa.ForeignKey("companies.id", ondelete="RESTRICT"),
                nullable=True,
                index=True,
            ),
            sa.Column(
                "branch_id",
                sa.String(50),
                sa.ForeignKey("branches.id", ondelete="RESTRICT"),
                nullable=True,
                index=True,
            ),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=text("NOW()")),
            sa.Column("modified_at", sa.DateTime(timezone=True), nullable=False, server_default=text("NOW()")),
            sa.Column("created_by", sa.String(100), nullable=True),
            sa.Column("updated_by", sa.String(100), nullable=True),
            sa.Column("is_active", sa.Boolean, nullable=False, server_default=text("TRUE")),
            sa.Column("is_deleted", sa.Boolean, nullable=False, server_default=text("FALSE")),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("deleted_by", sa.String(100), nullable=True),
            sa.Column("version", sa.Integer, nullable=False, server_default=text("1")),
            sa.Column(
                "product_id",
                sa.String(50),
                sa.ForeignKey("products.id", ondelete="CASCADE"),
                nullable=False,
                unique=True,
                index=True,
            ),
            sa.Column("purchase_cost", sa.Numeric(15, 2), nullable=True, server_default=text("0.00")),
            sa.Column("weighted_average_cost", sa.Numeric(15, 2), nullable=True, server_default=text("0.00")),
            sa.Column("last_purchase_cost", sa.Numeric(15, 2), nullable=True, server_default=text("0.00")),
            sa.Column("fifo_cost", sa.Numeric(15, 2), nullable=True, server_default=text("0.00")),
            sa.Column("landed_cost", sa.Numeric(15, 2), nullable=True, server_default=text("0.00")),
            sa.Column("standard_cost", sa.Numeric(15, 2), nullable=True, server_default=text("0.00")),
            sa.Column("mrp", sa.Numeric(15, 2), nullable=True, server_default=text("0.00")),
            sa.Column("selling_price", sa.Numeric(15, 2), nullable=True, server_default=text("0.00")),
            sa.Column("transfer_cost", sa.Numeric(15, 2), nullable=True, server_default=text("0.00")),
            sa.Column("replacement_cost", sa.Numeric(15, 2), nullable=True, server_default=text("0.00")),
            sa.Column("updated_at", sa.DateTime, nullable=True, server_default=text("NOW()")),
        )
    else:
        existing_cols = {c["name"] for c in inspector.get_columns("product_cost_valuations")}
        pcv_cols = {
            "company_id": sa.Column(
                "company_id",
                sa.String(50),
                sa.ForeignKey("companies.id", ondelete="RESTRICT"),
                nullable=True,
                index=True,
            ),
            "branch_id": sa.Column(
                "branch_id", sa.String(50), sa.ForeignKey("branches.id", ondelete="RESTRICT"), nullable=True, index=True
            ),
            "created_at": sa.Column(
                "created_at", sa.DateTime(timezone=True), nullable=False, server_default=text("NOW()")
            ),
            "modified_at": sa.Column(
                "modified_at", sa.DateTime(timezone=True), nullable=False, server_default=text("NOW()")
            ),
            "created_by": sa.Column("created_by", sa.String(100), nullable=True),
            "updated_by": sa.Column("updated_by", sa.String(100), nullable=True),
            "is_active": sa.Column("is_active", sa.Boolean, nullable=False, server_default=text("TRUE")),
            "is_deleted": sa.Column("is_deleted", sa.Boolean, nullable=False, server_default=text("FALSE")),
            "deleted_at": sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
            "deleted_by": sa.Column("deleted_by", sa.String(100), nullable=True),
            "version": sa.Column("version", sa.Integer, nullable=False, server_default=text("1")),
            "purchase_cost": sa.Column(
                "purchase_cost", sa.Numeric(15, 2), nullable=True, server_default=text("0.00")
            ),
            "weighted_average_cost": sa.Column(
                "weighted_average_cost", sa.Numeric(15, 2), nullable=True, server_default=text("0.00")
            ),
            "last_purchase_cost": sa.Column(
                "last_purchase_cost", sa.Numeric(15, 2), nullable=True, server_default=text("0.00")
            ),
            "fifo_cost": sa.Column("fifo_cost", sa.Numeric(15, 2), nullable=True, server_default=text("0.00")),
            "landed_cost": sa.Column("landed_cost", sa.Numeric(15, 2), nullable=True, server_default=text("0.00")),
            "standard_cost": sa.Column("standard_cost", sa.Numeric(15, 2), nullable=True, server_default=text("0.00")),
            "mrp": sa.Column("mrp", sa.Numeric(15, 2), nullable=True, server_default=text("0.00")),
            "selling_price": sa.Column("selling_price", sa.Numeric(15, 2), nullable=True, server_default=text("0.00")),
            "transfer_cost": sa.Column("transfer_cost", sa.Numeric(15, 2), nullable=True, server_default=text("0.00")),
            "replacement_cost": sa.Column(
                "replacement_cost", sa.Numeric(15, 2), nullable=True, server_default=text("0.00")
            ),
            "updated_at": sa.Column("updated_at", sa.DateTime, nullable=True, server_default=text("NOW()")),
        }
        for col_name, col_def in pcv_cols.items():
            if col_name not in existing_cols:
                op.add_column("product_cost_valuations", col_def)

    # 2. transaction_cost_snapshots
    if "transaction_cost_snapshots" not in existing_tables:
        op.create_table(
            "transaction_cost_snapshots",
            sa.Column("id", sa.String(50), primary_key=True),
            sa.Column("uuid", sa.String(36), nullable=False, unique=True),
            sa.Column(
                "company_id",
                sa.String(50),
                sa.ForeignKey("companies.id", ondelete="RESTRICT"),
                nullable=True,
                index=True,
            ),
            sa.Column(
                "branch_id",
                sa.String(50),
                sa.ForeignKey("branches.id", ondelete="RESTRICT"),
                nullable=True,
                index=True,
            ),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=text("NOW()")),
            sa.Column("modified_at", sa.DateTime(timezone=True), nullable=False, server_default=text("NOW()")),
            sa.Column("created_by", sa.String(100), nullable=True),
            sa.Column("updated_by", sa.String(100), nullable=True),
            sa.Column("is_active", sa.Boolean, nullable=False, server_default=text("TRUE")),
            sa.Column("is_deleted", sa.Boolean, nullable=False, server_default=text("FALSE")),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("deleted_by", sa.String(100), nullable=True),
            sa.Column("version", sa.Integer, nullable=False, server_default=text("1")),
            sa.Column("sales_invoice_id", sa.String(50), nullable=False, index=True),
            sa.Column("sales_invoice_item_id", sa.String(50), nullable=False, index=True),
            sa.Column("product_id", sa.String(50), nullable=False, index=True),
            sa.Column(
                "valuation_method_used",
                sa.String(30),
                nullable=True,
                server_default=text("'WEIGHTED_AVERAGE'"),
            ),
            sa.Column("quantity", sa.Numeric(12, 3), nullable=False),
            sa.Column("cost_per_unit", sa.Numeric(15, 2), nullable=False),
            sa.Column("total_cogs", sa.Numeric(15, 2), nullable=False),
            sa.Column("selling_price_per_unit", sa.Numeric(15, 2), nullable=False),
            sa.Column("total_gross_sales", sa.Numeric(15, 2), nullable=False),
            sa.Column("gross_profit", sa.Numeric(15, 2), nullable=False),
            sa.Column("timestamp", sa.DateTime, nullable=True, server_default=text("NOW()")),
        )
    else:
        existing_cols = {c["name"] for c in inspector.get_columns("transaction_cost_snapshots")}
        tcs_cols = {
            "company_id": sa.Column(
                "company_id",
                sa.String(50),
                sa.ForeignKey("companies.id", ondelete="RESTRICT"),
                nullable=True,
                index=True,
            ),
            "branch_id": sa.Column(
                "branch_id", sa.String(50), sa.ForeignKey("branches.id", ondelete="RESTRICT"), nullable=True, index=True
            ),
            "created_at": sa.Column(
                "created_at", sa.DateTime(timezone=True), nullable=False, server_default=text("NOW()")
            ),
            "modified_at": sa.Column(
                "modified_at", sa.DateTime(timezone=True), nullable=False, server_default=text("NOW()")
            ),
            "created_by": sa.Column("created_by", sa.String(100), nullable=True),
            "updated_by": sa.Column("updated_by", sa.String(100), nullable=True),
            "is_active": sa.Column("is_active", sa.Boolean, nullable=False, server_default=text("TRUE")),
            "is_deleted": sa.Column("is_deleted", sa.Boolean, nullable=False, server_default=text("FALSE")),
            "deleted_at": sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
            "deleted_by": sa.Column("deleted_by", sa.String(100), nullable=True),
            "version": sa.Column("version", sa.Integer, nullable=False, server_default=text("1")),
            "product_id": sa.Column("product_id", sa.String(50), nullable=True, index=True),
            "valuation_method_used": sa.Column(
                "valuation_method_used", sa.String(30), nullable=True, server_default=text("'WEIGHTED_AVERAGE'")
            ),
            "quantity": sa.Column("quantity", sa.Numeric(12, 3), nullable=False, server_default=text("0.00")),
            "cost_per_unit": sa.Column("cost_per_unit", sa.Numeric(15, 2), nullable=False, server_default=text("0.00")),
            "total_cogs": sa.Column("total_cogs", sa.Numeric(15, 2), nullable=False, server_default=text("0.00")),
            "selling_price_per_unit": sa.Column(
                "selling_price_per_unit", sa.Numeric(15, 2), nullable=False, server_default=text("0.00")
            ),
            "total_gross_sales": sa.Column(
                "total_gross_sales", sa.Numeric(15, 2), nullable=False, server_default=text("0.00")
            ),
            "gross_profit": sa.Column("gross_profit", sa.Numeric(15, 2), nullable=False, server_default=text("0.00")),
            "timestamp": sa.Column("timestamp", sa.DateTime, nullable=True, server_default=text("NOW()")),
        }
        for col_name, col_def in tcs_cols.items():
            if col_name not in existing_cols:
                op.add_column("transaction_cost_snapshots", col_def)

    # 3. invoice_profitability_ledgers
    if "invoice_profitability_ledgers" not in existing_tables:
        op.create_table(
            "invoice_profitability_ledgers",
            sa.Column("id", sa.String(50), primary_key=True),
            sa.Column("uuid", sa.String(36), nullable=False, unique=True),
            sa.Column(
                "company_id",
                sa.String(50),
                sa.ForeignKey("companies.id", ondelete="RESTRICT"),
                nullable=True,
                index=True,
            ),
            sa.Column(
                "branch_id",
                sa.String(50),
                sa.ForeignKey("branches.id", ondelete="RESTRICT"),
                nullable=True,
                index=True,
            ),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=text("NOW()")),
            sa.Column("modified_at", sa.DateTime(timezone=True), nullable=False, server_default=text("NOW()")),
            sa.Column("created_by", sa.String(100), nullable=True),
            sa.Column("updated_by", sa.String(100), nullable=True),
            sa.Column("is_active", sa.Boolean, nullable=False, server_default=text("TRUE")),
            sa.Column("is_deleted", sa.Boolean, nullable=False, server_default=text("FALSE")),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("deleted_by", sa.String(100), nullable=True),
            sa.Column("version", sa.Integer, nullable=False, server_default=text("1")),
            sa.Column("sales_invoice_id", sa.String(50), nullable=False, unique=True, index=True),
            sa.Column("gross_sales_amount", sa.Numeric(15, 2), nullable=False),
            sa.Column("total_cogs", sa.Numeric(15, 2), nullable=False),
            sa.Column("gross_profit", sa.Numeric(15, 2), nullable=False),
            sa.Column("salesperson_commission", sa.Numeric(15, 2), nullable=True, server_default=text("0.00")),
            sa.Column("driver_commission", sa.Numeric(15, 2), nullable=True, server_default=text("0.00")),
            sa.Column("promotion_discount", sa.Numeric(15, 2), nullable=True, server_default=text("0.00")),
            sa.Column("loyalty_cost", sa.Numeric(15, 2), nullable=True, server_default=text("0.00")),
            sa.Column("referral_cost", sa.Numeric(15, 2), nullable=True, server_default=text("0.00")),
            sa.Column("delivery_cost", sa.Numeric(15, 2), nullable=True, server_default=text("0.00")),
            sa.Column("net_contribution", sa.Numeric(15, 2), nullable=False),
            sa.Column("net_margin_percent", sa.Numeric(5, 2), nullable=True, server_default=text("0.00")),
            sa.Column("timestamp", sa.DateTime, nullable=True, server_default=text("NOW()")),
        )
    else:
        existing_cols = {c["name"] for c in inspector.get_columns("invoice_profitability_ledgers")}
        ipl_cols = {
            "company_id": sa.Column(
                "company_id",
                sa.String(50),
                sa.ForeignKey("companies.id", ondelete="RESTRICT"),
                nullable=True,
                index=True,
            ),
            "branch_id": sa.Column(
                "branch_id", sa.String(50), sa.ForeignKey("branches.id", ondelete="RESTRICT"), nullable=True, index=True
            ),
            "created_at": sa.Column(
                "created_at", sa.DateTime(timezone=True), nullable=False, server_default=text("NOW()")
            ),
            "modified_at": sa.Column(
                "modified_at", sa.DateTime(timezone=True), nullable=False, server_default=text("NOW()")
            ),
            "created_by": sa.Column("created_by", sa.String(100), nullable=True),
            "updated_by": sa.Column("updated_by", sa.String(100), nullable=True),
            "is_active": sa.Column("is_active", sa.Boolean, nullable=False, server_default=text("TRUE")),
            "is_deleted": sa.Column("is_deleted", sa.Boolean, nullable=False, server_default=text("FALSE")),
            "deleted_at": sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
            "deleted_by": sa.Column("deleted_by", sa.String(100), nullable=True),
            "version": sa.Column("version", sa.Integer, nullable=False, server_default=text("1")),
            "salesperson_commission": sa.Column(
                "salesperson_commission", sa.Numeric(15, 2), nullable=True, server_default=text("0.00")
            ),
            "driver_commission": sa.Column(
                "driver_commission", sa.Numeric(15, 2), nullable=True, server_default=text("0.00")
            ),
            "promotion_discount": sa.Column(
                "promotion_discount", sa.Numeric(15, 2), nullable=True, server_default=text("0.00")
            ),
            "loyalty_cost": sa.Column("loyalty_cost", sa.Numeric(15, 2), nullable=True, server_default=text("0.00")),
            "referral_cost": sa.Column(
                "referral_cost", sa.Numeric(15, 2), nullable=True, server_default=text("0.00")
            ),
            "delivery_cost": sa.Column(
                "delivery_cost", sa.Numeric(15, 2), nullable=True, server_default=text("0.00")
            ),
            "net_margin_percent": sa.Column(
                "net_margin_percent", sa.Numeric(5, 2), nullable=True, server_default=text("0.00")
            ),
            "timestamp": sa.Column("timestamp", sa.DateTime, nullable=True, server_default=text("NOW()")),
        }
        for col_name, col_def in ipl_cols.items():
            if col_name not in existing_cols:
                op.add_column("invoice_profitability_ledgers", col_def)

    # 4. sales_return_items.sales_invoice_item_id
    if "sales_return_items" in existing_tables:
        sri_cols = {c["name"]: c for c in inspector.get_columns("sales_return_items")}
        if "sales_invoice_item_id" not in sri_cols:
            op.add_column(
                "sales_return_items",
                sa.Column(
                    "sales_invoice_item_id",
                    sa.Integer(),
                    sa.ForeignKey(
                        "sales_invoice_items.id",
                        ondelete="SET NULL",
                        name="fk_sales_return_items_sales_invoice_item_id",
                    ),
                    nullable=True,
                ),
            )
            op.create_index(
                "ix_sales_return_items_sales_invoice_item_id",
                "sales_return_items",
                ["sales_invoice_item_id"],
                unique=False,
            )
        else:
            col_type = str(sri_cols["sales_invoice_item_id"]["type"]).upper()
            if "INT" not in col_type:
                raise RuntimeError(
                    f"SMRITI Schema Drift: sales_return_items.sales_invoice_item_id has unexpected type "
                    f"'{col_type}', expected INTEGER."
                )
            fks = inspector.get_foreign_keys("sales_return_items")
            has_fk = any("sales_invoice_item_id" in fk.get("constrained_columns", []) for fk in fks)
            if not has_fk:
                op.create_foreign_key(
                    "fk_sales_return_items_sales_invoice_item_id",
                    "sales_return_items",
                    "sales_invoice_items",
                    ["sales_invoice_item_id"],
                    ["id"],
                    ondelete="SET NULL",
                )
            indices = [idx["name"] for idx in inspector.get_indexes("sales_return_items")]
            if "ix_sales_return_items_sales_invoice_item_id" not in indices:
                op.create_index(
                    "ix_sales_return_items_sales_invoice_item_id",
                    "sales_return_items",
                    ["sales_invoice_item_id"],
                    unique=False,
                )


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    # 1. Safety & Reversibility Pre-check:
    # To prevent Alembic revision state from drifting out of sync with the physical schema,
    # non-empty tables must not be silently preserved while the revision rolls back.
    # If tables contain business records, abort the downgrade unless SMRITI_ALLOW_DESTRUCTIVE_DOWNGRADE=1.
    allow_destructive = os.getenv("SMRITI_ALLOW_DESTRUCTIVE_DOWNGRADE", "").strip() == "1"
    tables_to_drop = ["invoice_profitability_ledgers", "transaction_cost_snapshots", "product_cost_valuations"]
    for table in tables_to_drop:
        if table in tables:
            count = conn.execute(text(f"SELECT COUNT(*) FROM {table}")).scalar() or 0
            if count > 0 and not allow_destructive:
                raise RuntimeError(
                    f"SMRITI Migration Safety Abort: Cannot downgrade {revision}. "
                    f"Table '{table}' contains {count} business records. "
                    "Silently preserving tables would leave the Alembic revision state inconsistent "
                    "with the physical schema, while dropping them would cause irreversible data loss. "
                    "To perform a verified destructive rollback, set SMRITI_ALLOW_DESTRUCTIVE_DOWNGRADE=1."
                )

    # 2. Rollback sales_return_items column, foreign key, and index if present
    if "sales_return_items" in tables:
        sri_cols = [c["name"] for c in inspector.get_columns("sales_return_items")]
        if "sales_invoice_item_id" in sri_cols:
            fks = inspector.get_foreign_keys("sales_return_items")
            for fk in fks:
                if "sales_invoice_item_id" in fk.get("constrained_columns", []):
                    op.drop_constraint(fk["name"], table_name="sales_return_items", type_="foreignkey")
            indices = [idx["name"] for idx in inspector.get_indexes("sales_return_items")]
            if "ix_sales_return_items_sales_invoice_item_id" in indices:
                op.drop_index("ix_sales_return_items_sales_invoice_item_id", table_name="sales_return_items")
            op.drop_column("sales_return_items", "sales_invoice_item_id")

    # 3. Drop tables (verified empty or explicitly authorized for destructive rollback)
    for table in tables_to_drop:
        if table in tables:
            op.drop_table(table)
