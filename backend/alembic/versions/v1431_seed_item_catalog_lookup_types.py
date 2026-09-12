"""Seed governed Item Master catalog lookup types."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "v1431_seed_item_catalog_lookup_types"
down_revision: Union[str, Sequence[str], None] = "v1430_enforce_staff_snapshot_immutability"
branch_labels = None
depends_on = None


LOOKUP_TYPES = (
    ("brand", "Brand"),
    ("style_article", "Style / Article"),
    ("size", "Size"),
    ("color", "Color"),
    ("category", "Category"),
    ("subcategory", "Subcategory"),
    ("vendor_code", "Vendor Code"),
    ("item_attribute", "Configurable Attribute"),
)


def upgrade() -> None:
    bind = op.get_bind()
    for code, label in LOOKUP_TYPES:
        bind.execute(
            sa.text(
                """
                INSERT INTO master_types (
                    id, code, label, field_schema, ui_schema,
                    used_in_modules, version, evidence_level, created_by, created_at
                )
                VALUES (
                    gen_random_uuid(), :code, :label,
                    CAST(:field_schema AS jsonb), CAST(:ui_schema AS jsonb),
                    ARRAY['item_master', 'master_registry'], 1, 'D', 'system', NOW()
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
                "code": code,
                "label": label,
                "field_schema": '{"type":"object","properties":{"description":{"type":"string"}}}',
                "ui_schema": '{"type":"object","valueFields":["code","name","description"]}',
            },
        )


def downgrade() -> None:
    bind = op.get_bind()
    bind.execute(
        sa.text("DELETE FROM master_types WHERE code = ANY(:codes)"),
        {"codes": [code for code, _ in LOOKUP_TYPES]},
    )