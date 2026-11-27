"""Align control-plane capability tables with their BaseEntity schema.

Revision ID: v1596_control_plane_capability_alignment
Revises: v1577
# @migration_target('control')
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import context, op
from alembic.migration_contract import validate_migration_execution

revision: str = "v1596_control_plane_capability_alignment"
down_revision: str | Sequence[str] | None = "v1577"
branch_labels: str | Sequence[str] | None = ("control",)
depends_on = None

_TABLES = (
    "platform_capabilities",
    "workspace_templates",
    "tenant_capability_bindings",
    "feature_flags",
    "user_workspace_configs",
)


def _base_entity_columns() -> tuple[sa.Column, ...]:
    return (
        sa.Column("company_id", sa.String(50), nullable=True),
        sa.Column("branch_id", sa.String(50), nullable=True),
        sa.Column(
            "modified_at",
            sa.DateTime(timezone=True),
            nullable=True,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column("created_by", sa.String(100), nullable=True),
        sa.Column("updated_by", sa.String(100), nullable=True),
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("TRUE"),
        ),
        sa.Column(
            "is_deleted",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("FALSE"),
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", sa.String(100), nullable=True),
        sa.Column(
            "version",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("1"),
        ),
    )


def _ensure_base_entity_columns(table: str) -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"]: column for column in inspector.get_columns(table)}

    if "uuid" not in columns:
        op.add_column(
            table,
            sa.Column(
                "uuid",
                sa.String(36),
                nullable=False,
                server_default=sa.text("gen_random_uuid()::varchar"),
            ),
        )
    else:
        if columns["uuid"]["nullable"]:
            bind.execute(
                sa.text(
                    f"UPDATE {table} SET uuid = gen_random_uuid()::varchar "
                    "WHERE uuid IS NULL"
                )
            )
        op.alter_column(
            table,
            "uuid",
            existing_type=columns["uuid"]["type"],
            nullable=False,
            server_default=sa.text("gen_random_uuid()::varchar"),
        )

    inspector = sa.inspect(bind)
    column_map = {column["name"]: column for column in inspector.get_columns(table)}
    for column in _base_entity_columns():
        existing = column_map.get(column.name)
        if existing is None:
            op.add_column(table, column)
            continue

        if not column.nullable and existing["nullable"]:
            if column.server_default is not None:
                bind.execute(
                    sa.text(
                        f"UPDATE {table} SET {column.name} = "
                        f"{column.server_default.arg} WHERE {column.name} IS NULL"
                    )
                )
            op.alter_column(
                table,
                column.name,
                existing_type=existing["type"],
                nullable=False,
                server_default=column.server_default,
            )
        elif column.server_default is not None:
            op.alter_column(
                table,
                column.name,
                existing_type=existing["type"],
                server_default=column.server_default,
            )

    inspector = sa.inspect(bind)
    has_unique_uuid = any(
        constraint.get("column_names") == ["uuid"]
        for constraint in inspector.get_unique_constraints(table)
    ) or any(
        index.get("column_names") == ["uuid"] and index.get("unique")
        for index in inspector.get_indexes(table)
    )
    if has_unique_uuid:
        return

    duplicate = bind.execute(
        sa.text(
            f"SELECT uuid FROM {table} WHERE uuid IS NOT NULL "
            "GROUP BY uuid HAVING count(*) > 1 LIMIT 1"
        )
    ).first()
    if duplicate:
        raise RuntimeError(
            f"Cannot add unique UUID index to {table}: duplicate UUID values exist."
        )

    op.create_index(f"ix_{table}_uuid", table, ["uuid"], unique=True)


def upgrade() -> None:
    if not context.is_offline_mode():
        database = op.get_bind().execute(sa.text("SELECT current_database()")).scalar_one()
        validate_migration_execution("control", database)

    bind = op.get_bind()
    inspector = sa.inspect(bind)
    for table in _TABLES:
        if inspector.has_table(table):
            _ensure_base_entity_columns(table)


def downgrade() -> None:
    raise RuntimeError(
        "Revision v1596 is a forward-only control-plane alignment. "
        "Restore a verified database backup instead of reverting it."
    )
