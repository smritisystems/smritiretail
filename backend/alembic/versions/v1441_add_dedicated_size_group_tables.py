"""Add dedicated database tables for size groups and ordered size values."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "v1441_add_dedicated_size_group_tables"
down_revision: Union[str, Sequence[str], None] = "v1440_link_attribute_groups_to_size_groups"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "size_groups" not in tables:
        op.create_table(
            "size_groups",
            sa.Column("id", sa.String(length=100), primary_key=True, nullable=False),
            sa.Column("uuid", sa.String(length=36), nullable=False, unique=True),
            sa.Column("company_id", sa.String(length=50), nullable=True),
            sa.Column("branch_id", sa.String(length=50), nullable=True),
            sa.Column("code", sa.String(length=100), nullable=False, unique=True),
            sa.Column("name", sa.String(length=200), nullable=False),
            sa.Column("category", sa.String(length=100), nullable=False, server_default="GENERAL"),
            sa.Column("dimension", sa.String(length=100), nullable=False, server_default="size"),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("modified_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_by", sa.String(length=100), nullable=True),
            sa.Column("updated_by", sa.String(length=100), nullable=True),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("deleted_by", sa.String(length=100), nullable=True),
            sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        )
        op.create_index("ix_size_groups_company_id", "size_groups", ["company_id"], unique=False)
        op.create_index("ix_size_groups_branch_id", "size_groups", ["branch_id"], unique=False)

    if "size_group_values" not in tables:
        op.create_table(
            "size_group_values",
            sa.Column("id", sa.String(length=50), primary_key=True, nullable=False),
            sa.Column("uuid", sa.String(length=36), nullable=False, unique=True),
            sa.Column("company_id", sa.String(length=50), nullable=True),
            sa.Column("branch_id", sa.String(length=50), nullable=True),
            sa.Column("size_group_id", sa.String(length=100), nullable=False),
            sa.Column("value", sa.String(length=50), nullable=False),
            sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("modified_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_by", sa.String(length=100), nullable=True),
            sa.Column("updated_by", sa.String(length=100), nullable=True),
            sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("deleted_by", sa.String(length=100), nullable=True),
            sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
            sa.ForeignKeyConstraint(["size_group_id"], ["size_groups.id"], ondelete="CASCADE"),
            sa.UniqueConstraint("size_group_id", "value", name="uq_size_group_values_group_value"),
        )
        op.create_index("ix_size_group_values_size_group_id", "size_group_values", ["size_group_id"], unique=False)

    # Backfill from master registry values so current working data is preserved.
    op.execute(
        sa.text(
            """
            INSERT INTO size_groups (
                id, uuid, code, name, category, dimension, company_id, branch_id,
                created_at, modified_at, created_by, updated_by, is_active, is_deleted, version
            )
            SELECT
                mv.code || '-group',
                gen_random_uuid()::text,
                mv.code,
                mv.name,
                COALESCE(mv.data->>'category', 'GENERAL'),
                COALESCE(mv.data->>'dimension', 'size'),
                mv.company_id,
                mv.branch_id,
                NOW(), NOW(), 'migration', 'migration', TRUE, FALSE, 1
            FROM master_values mv
            JOIN master_types mt ON mt.id = mv.master_type_id
            WHERE mt.code = 'size_group'
            ON CONFLICT (code) DO NOTHING
            """
        )
    )

    op.execute(
        sa.text(
            """
            INSERT INTO size_group_values (
                id, uuid, size_group_id, value, sort_order, is_active,
                company_id, branch_id, created_at, modified_at, created_by, updated_by,
                is_deleted, version
            )
            SELECT
                concat(mv.code, '-', ROW_NUMBER() OVER (PARTITION BY mv.code ORDER BY idx.value_index)),
                gen_random_uuid()::text,
                sg.id,
                idx.value,
                idx.value_index,
                TRUE,
                mv.company_id,
                mv.branch_id,
                NOW(), NOW(), 'migration', 'migration', FALSE, 1
            FROM master_values mv
            JOIN master_types mt ON mt.id = mv.master_type_id
            JOIN size_groups sg ON sg.code = mv.code
            CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(mv.data->'values', '[]'::jsonb)) WITH ORDINALITY AS idx(value, value_index)
            WHERE mt.code = 'size_group'
            ON CONFLICT (size_group_id, value) DO NOTHING
            """
        )
    )


def downgrade() -> None:
    op.drop_table("size_group_values")
    op.drop_table("size_groups")
