"""Seed footwear color group and map footwear attribute groups."""

import json
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "v1445_seed_footwear_color_group"
down_revision: Union[str, Sequence[str], None] = "v1444_backfill_all_attribute_groups_governed_dimensions"
branch_labels = None
depends_on = None

FOOTWEAR_COLOR_GROUP = (
    "COLOR_FOOTWEAR",
    "Footwear Colors",
    ["BLACK", "WHITE", "BROWN", "TAN", "NAVY", "RED", "GREY"],
)

FOOTWEAR_SIZE_GROUP = (
    "FOOTWEAR_EU",
    "Footwear EU Sizes",
    ["36", "37", "38", "39", "40", "41", "42", "43", "44"],
)


def upgrade() -> None:
    bind = op.get_bind()
    code, name, values = FOOTWEAR_COLOR_GROUP
    payload = json.dumps({"dimension": "color", "values": values, "category": "FOOTWEAR"})

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
            ON CONFLICT (code) DO NOTHING
            """
        ),
        {
            "field_schema": '{"type":"object","properties":{"dimension":{"type":"string"},"values":{"type":"array","items":{"type":"string"}},"category":{"type":"string"}}}',
            "ui_schema": '{"type":"object","valueFields":["code","name","dimension","values","category"]}',
        },
    )

    color_group_type_id = bind.execute(
        sa.text("SELECT id FROM master_types WHERE code = 'color_group'")
    ).scalar_one()

    bind.execute(
        sa.text(
            """
            INSERT INTO master_types (
                id, code, label, field_schema, ui_schema,
                used_in_modules, version, evidence_level, created_by, created_at
            )
            VALUES (
                gen_random_uuid(), 'size_group', 'Size Group',
                CAST(:field_schema AS jsonb), CAST(:ui_schema AS jsonb),
                ARRAY['item_master', 'master_registry', 'variant_matrix'],
                1, 'D', 'system', NOW()
            )
            ON CONFLICT (code) DO NOTHING
            """
        ),
        {
            "field_schema": '{"type":"object","properties":{"dimension":{"type":"string"},"values":{"type":"array","items":{"type":"string"}},"category":{"type":"string"}}}',
            "ui_schema": '{"type":"object","valueFields":["code","name","dimension","values","category"]}',
        },
    )

    size_group_type_id = bind.execute(
        sa.text("SELECT id FROM master_types WHERE code = 'size_group'")
    ).scalar_one()

    size_code, size_name, size_values = FOOTWEAR_SIZE_GROUP
    bind.execute(
        sa.text(
            """
            INSERT INTO master_values (
                id, master_type_id, company_id, branch_id, code, name, data,
                active, sort_order, updated_at, is_deleted
            )
            VALUES (
                gen_random_uuid(), :master_type_id, NULL, NULL, :code, :name,
                CAST(:data AS jsonb), TRUE, 0, NOW(), FALSE
            )
            ON CONFLICT DO NOTHING
            """
        ),
        {
            "master_type_id": size_group_type_id,
            "code": size_code,
            "name": size_name,
            "data": json.dumps({"dimension": "size", "values": size_values, "category": "FOOTWEAR"}),
        },
    )

    bind.execute(
        sa.text(
            """
            INSERT INTO master_values (
                id, master_type_id, company_id, branch_id, code, name, data,
                active, sort_order, updated_at, is_deleted
            )
            VALUES (
                gen_random_uuid(), :master_type_id, NULL, NULL, :code, :name,
                CAST(:data AS jsonb), TRUE, 0, NOW(), FALSE
            )
            ON CONFLICT DO NOTHING
            """
        ),
        {
            "master_type_id": color_group_type_id,
            "code": code,
            "name": name,
            "data": payload,
        },
    )

    bind.execute(
        sa.text(
            """
            UPDATE attribute_groups
            SET size_group_id = 'FOOTWEAR_EU', color_group_id = 'COLOR_FOOTWEAR'
            WHERE lower(name) LIKE '%footwear%' OR lower(name) LIKE '%shoe%'
            """
        )
    )


def downgrade() -> None:
    bind = op.get_bind()
    bind.execute(
        sa.text(
            """
            UPDATE attribute_groups
            SET size_group_id = 'APPAREL_ALPHA', color_group_id = 'COLOR_BASIC'
            WHERE lower(name) LIKE '%footwear%' OR lower(name) LIKE '%shoe%'
            """
        )
    )
    bind.execute(
        sa.text(
            """
            DELETE FROM master_values
            WHERE master_type_id = (SELECT id FROM master_types WHERE code = 'color_group')
              AND code = 'COLOR_FOOTWEAR'
            """
        )
    )
    bind.execute(
        sa.text(
            """
            DELETE FROM master_values
            WHERE master_type_id = (SELECT id FROM master_types WHERE code = 'size_group')
              AND code = 'FOOTWEAR_EU'
            """
        )
    )
