"""Seed Electronics as an independent governed Category Registry value."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "v1439_seed_electronics_category"
down_revision: Union[str, Sequence[str], None] = "v1438_seed_size_groups"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    category_type_id = bind.execute(
        sa.text("SELECT id FROM master_types WHERE code = 'category'")
    ).scalar_one_or_none()
    if not category_type_id:
        return

    existing_id = bind.execute(
        sa.text(
            "SELECT id FROM master_values WHERE master_type_id = :type_id "
            "AND company_id IS NULL AND branch_id IS NULL AND code = 'ELECTRONICS' "
            "AND is_deleted = FALSE LIMIT 1"
        ),
        {"type_id": category_type_id},
    ).scalar_one_or_none()
    payload = '{"description":"Electronic goods and devices"}'
    if existing_id:
        bind.execute(
            sa.text(
                "UPDATE master_values SET name = 'Electronics', data = CAST(:data AS jsonb), "
                "active = TRUE, is_deleted = FALSE, updated_at = NOW() WHERE id = :id"
            ),
            {"id": existing_id, "data": payload},
        )
    else:
        bind.execute(
            sa.text(
                "INSERT INTO master_values "
                "(id, master_type_id, company_id, branch_id, code, name, data, active, sort_order, updated_at, is_deleted) "
                "VALUES (gen_random_uuid(), :type_id, NULL, NULL, 'ELECTRONICS', 'Electronics', CAST(:data AS jsonb), TRUE, 10, NOW(), FALSE)"
            ),
            {"type_id": category_type_id, "data": payload},
        )


def downgrade() -> None:
    bind = op.get_bind()
    bind.execute(
        sa.text(
            "DELETE FROM master_values WHERE code = 'ELECTRONICS' "
            "AND master_type_id = (SELECT id FROM master_types WHERE code = 'category')"
        )
    )