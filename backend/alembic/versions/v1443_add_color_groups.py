"""Add governed color groups and map them to attribute groups."""

import json
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "v1443_add_color_groups"
down_revision: Union[str, Sequence[str], None] = "v1442_add_variant_template_base_cost_price"
branch_labels = None
depends_on = None

COLOR_GROUPS = (
    ("COLOR_BASIC", "Basic Colors", ["BLACK", "WHITE", "RED", "BLUE", "GREEN"]),
    ("COLOR_NEUTRAL", "Neutral Colors", ["BLACK", "WHITE", "GREY", "BEIGE", "BROWN"]),
)


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("attribute_groups")}
    indexes = {index["name"] for index in inspector.get_indexes("attribute_groups")}
    if "color_group_id" not in columns:
        op.add_column("attribute_groups", sa.Column("color_group_id", sa.String(length=100), nullable=True))
    if "ix_attribute_groups_color_group_id" not in indexes:
        op.create_index("ix_attribute_groups_color_group_id", "attribute_groups", ["color_group_id"])

    bind.execute(
        sa.text(
            """
            INSERT INTO master_types (
                id, code, label, field_schema, ui_schema,
                used_in_modules, version, evidence_level, created_by, created_at
            )
            VALUES (
                gen_random_uuid(), 'color_group', 'Color Group',
                CAST(:field_schema AS jsonb), CAST(:ui_schema AS jsonb),
                ARRAY['item_master', 'master_registry', 'variant_matrix'],
                1, 'D', 'system', NOW()
            )
            ON CONFLICT (code) DO UPDATE SET
                label = EXCLUDED.label,
                field_schema = EXCLUDED.field_schema,
                ui_schema = EXCLUDED.ui_schema,
                used_in_modules = EXCLUDED.used_in_modules,
                version = EXCLUDED.version
            """
        ),
        {
            "field_schema": '{"type":"object","properties":{"dimension":{"type":"string"},"values":{"type":"array","items":{"type":"string"}},"category":{"type":"string"}}}',
            "ui_schema": '{"type":"object","valueFields":["code","name","dimension","values","category"]}',
        },
    )

    color_group_id = bind.execute(
        sa.text("SELECT id FROM master_types WHERE code = 'color_group'")
    ).scalar_one()

    for code, name, values in COLOR_GROUPS:
        payload = json.dumps({"dimension": "color", "values": values, "category": "GENERAL"})
        existing_id = bind.execute(
            sa.text(
                "SELECT id FROM master_values WHERE master_type_id = :master_type_id "
                "AND company_id IS NULL AND branch_id IS NULL AND code = :code "
                "AND is_deleted = FALSE LIMIT 1"
            ),
            {"master_type_id": color_group_id, "code": code},
        ).scalar_one_or_none()
        if existing_id:
            bind.execute(
                sa.text(
                    "UPDATE master_values SET name = :name, data = CAST(:data AS jsonb), "
                    "active = TRUE, is_deleted = FALSE, updated_at = NOW() WHERE id = :id"
                ),
                {"id": existing_id, "name": name, "data": payload},
            )
        else:
            bind.execute(
                sa.text(
                    "INSERT INTO master_values (id, master_type_id, company_id, branch_id, code, name, data, active, sort_order, updated_at, is_deleted) "
                    "VALUES (gen_random_uuid(), :master_type_id, NULL, NULL, :code, :name, CAST(:data AS jsonb), TRUE, 0, NOW(), FALSE)"
                ),
                {"master_type_id": color_group_id, "code": code, "name": name, "data": payload},
            )

    bind.execute(
        sa.text(
            """
            UPDATE attribute_groups SET color_group_id = 'COLOR_BASIC'
            WHERE (color_group_id IS NULL OR color_group_id = '');
            """
        )
    )


def downgrade() -> None:
    bind = op.get_bind()
    bind.execute(
        sa.text(
            "DELETE FROM master_values WHERE master_type_id = (SELECT id FROM master_types WHERE code = 'color_group') "
            "AND code IN ('COLOR_BASIC', 'COLOR_NEUTRAL')"
        )
    )
    bind.execute(sa.text("DELETE FROM master_types WHERE code = 'color_group'"))
    inspector = sa.inspect(bind)
    indexes = {index["name"] for index in inspector.get_indexes("attribute_groups")}
    columns = {column["name"] for column in inspector.get_columns("attribute_groups")}
    if "ix_attribute_groups_color_group_id" in indexes:
        op.drop_index("ix_attribute_groups_color_group_id", table_name="attribute_groups")
    if "color_group_id" in columns:
        op.drop_column("attribute_groups", "color_group_id")
