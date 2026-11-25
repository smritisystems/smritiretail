"""Align PDT tables with their BaseEntity ORM models.

Revision ID: v1591
Revises: v1590
# @migration_target('tenant')
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "v1591"
down_revision: str | Sequence[str] | None = "v1590"
branch_labels = None
depends_on = None

_PDT_TABLES = (
    "pdt_model_registry",
    "pdt_sku_twin_cache",
    "pdt_demand_signals",
    "pdt_distribution_predictions",
)


def upgrade() -> None:
    for table in _PDT_TABLES:
        op.add_column(
            table,
            sa.Column(
                "uuid",
                sa.String(36),
                nullable=False,
                server_default=sa.text("gen_random_uuid()::text"),
            ),
        )
        op.create_unique_constraint(f"uq_{table}_uuid", table, ["uuid"])

        op.add_column(table, sa.Column("company_id", sa.String(50), nullable=True))
        op.add_column(table, sa.Column("branch_id", sa.String(50), nullable=True))
        op.create_foreign_key(
            f"fk_{table}_company_id_companies",
            table,
            "companies",
            ["company_id"],
            ["id"],
            ondelete="RESTRICT",
        )
        op.create_foreign_key(
            f"fk_{table}_branch_id_branches",
            table,
            "branches",
            ["branch_id"],
            ["id"],
            ondelete="RESTRICT",
        )

        op.add_column(
            table,
            sa.Column(
                "modified_at",
                sa.DateTime(timezone=True),
                nullable=True,
                server_default=sa.text("now()"),
            ),
        )
        op.add_column(table, sa.Column("created_by", sa.String(100), nullable=True))
        op.add_column(table, sa.Column("updated_by", sa.String(100), nullable=True))
        op.add_column(
            table,
            sa.Column("is_active", sa.Boolean(), nullable=True, server_default=sa.text("true")),
        )
        op.add_column(
            table,
            sa.Column("is_deleted", sa.Boolean(), nullable=True, server_default=sa.text("false")),
        )
        op.add_column(table, sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))
        op.add_column(table, sa.Column("deleted_by", sa.String(100), nullable=True))

        if table != "pdt_model_registry":
            op.add_column(
                table,
                sa.Column("version", sa.Integer(), nullable=True, server_default=sa.text("1")),
            )


def downgrade() -> None:
    for table in reversed(_PDT_TABLES):
        if table != "pdt_model_registry":
            op.drop_column(table, "version")
        op.drop_column(table, "deleted_by")
        op.drop_column(table, "deleted_at")
        op.drop_column(table, "is_deleted")
        op.drop_column(table, "is_active")
        op.drop_column(table, "updated_by")
        op.drop_column(table, "created_by")
        op.drop_column(table, "modified_at")
        op.drop_constraint(f"fk_{table}_branch_id_branches", table, type_="foreignkey")
        op.drop_constraint(f"fk_{table}_company_id_companies", table, type_="foreignkey")
        op.drop_column(table, "branch_id")
        op.drop_column(table, "company_id")
        op.drop_constraint(f"uq_{table}_uuid", table, type_="unique")
        op.drop_column(table, "uuid")
