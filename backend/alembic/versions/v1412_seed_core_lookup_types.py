"""Seed lookup types required by the Master Registry UI."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "v1412_seed_core_lookup_types"
down_revision: Union[str, Sequence[str], None] = "v1411_reference_location_integrity"
branch_labels = None
depends_on = None


LOOKUP_TYPES = (
    ("bank", "Bank Account"),
    ("currency", "Currency"),
    ("department", "Department"),
    ("designation", "Designation"),
    ("expense_category", "Expense Category"),
    ("payment_mode", "Payment Mode"),
)


def upgrade() -> None:
    bind = op.get_bind()
    for code, label in LOOKUP_TYPES:
        bind.execute(
            sa.text(
                """
                INSERT INTO master_types (
                    id, code, label, field_schema, ui_schema,
                    used_in_modules, version, evidence_level, created_by
                )
                VALUES (
                    gen_random_uuid(), :code, :label,
                    CAST(:field_schema AS jsonb), CAST(:ui_schema AS jsonb),
                    ARRAY['master_registry'], 1, 'D', 'system'
                )
                ON CONFLICT (code) DO NOTHING
                """
            ),
            {
                "code": code,
                "label": label,
                "field_schema": '{"type":"object"}',
                "ui_schema": '{"type":"object"}',
            },
        )


def downgrade() -> None:
    bind = op.get_bind()
    bind.execute(
        sa.text("DELETE FROM master_types WHERE code = ANY(:codes)"),
        {"codes": [code for code, _ in LOOKUP_TYPES]},
    )
