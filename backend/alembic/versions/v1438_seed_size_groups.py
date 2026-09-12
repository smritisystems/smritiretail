"""Add reusable category-aware Size Group values to the Master Registry."""

import json
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "v1438_seed_size_groups"
down_revision: Union[str, Sequence[str], None] = "v1437_link_variant_templates_to_master_articles"
branch_labels = None
depends_on = None


SIZE_GROUPS = (
    (
        "APPAREL_ALPHA",
        "Apparel Alpha Sizes",
        ["XS", "S", "M", "L", "XL", "XXL"],
        "APPAREL",
    ),
    (
        "FOOTWEAR_EU",
        "Footwear EU Sizes",
        ["36", "37", "38", "39", "40", "41", "42", "43", "44"],
        "FOOTWEAR",
    ),
)


def upgrade() -> None:
    bind = op.get_bind()
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

    size_group_id = bind.execute(
        sa.text("SELECT id FROM master_types WHERE code = 'size_group'")
    ).scalar_one()

    for code, name, values, category in SIZE_GROUPS:
        payload = json.dumps({"dimension": "size", "values": values, "category": category})
        existing_id = bind.execute(
            sa.text(
                "SELECT id FROM master_values "
                "WHERE master_type_id = :master_type_id AND company_id IS NULL "
                "AND branch_id IS NULL AND code = :code AND is_deleted = FALSE "
                "LIMIT 1"
            ),
            {"master_type_id": size_group_id, "code": code},
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
                    "INSERT INTO master_values "
                    "(id, master_type_id, company_id, branch_id, code, name, data, active, sort_order, updated_at, is_deleted) "
                    "VALUES (gen_random_uuid(), :master_type_id, NULL, NULL, :code, :name, CAST(:data AS jsonb), TRUE, 0, NOW(), FALSE)"
                ),
                {"master_type_id": size_group_id, "code": code, "name": name, "data": payload},
            )


def downgrade() -> None:
    bind = op.get_bind()
    bind.execute(
        sa.text(
            """
            DELETE FROM master_values
            WHERE master_type_id = (SELECT id FROM master_types WHERE code = 'size_group')
              AND code IN ('APPAREL_ALPHA', 'FOOTWEAR_EU')
            """
        )
    )