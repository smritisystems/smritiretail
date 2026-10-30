"""Seed the dedicated Style / Article requiredness system parameter.

Revision ID: v1565
Revises: v1564
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "v1565"
down_revision: Union[str, Sequence[str], None] = "v1564"
branch_labels = None
depends_on = None


PARAM_CODE = "SMRITI.CATALOG.ITEM.MANDATORY_STYLE_ARTICLE"


def upgrade() -> None:
    op.execute(
        sa.text(
            """
            INSERT INTO system_parameters (
                id, uuid, company_id, branch_id, param_code, canonical_code,
                category, category_name, description, data_type, mutability,
                profile_type, scope_level, terminal_id, val_boolean, val_text,
                is_active, is_deleted, is_locked, created_at, modified_at
            )
            SELECT
                'sp-catalog-style-article-required',
                'a1100001-0001-4000-8000-000000000004',
                NULL, NULL, :param_code, :param_code,
                '04. Item Master', 'Item Master',
                'Require an approved Style / Article code when creating or importing an item.',
                'Boolean', 'Variable', 'COMMON', 'GLOBAL', 'COMMON', TRUE, '1',
                TRUE, FALSE, FALSE, NOW(), NOW()
            WHERE NOT EXISTS (
                SELECT 1
                FROM system_parameters
                WHERE canonical_code = :param_code AND company_id IS NULL
            )
            """
        ).bindparams(param_code=PARAM_CODE)
    )


def downgrade() -> None:
    op.execute(
        sa.text(
            """
            DELETE FROM system_parameters
            WHERE id = 'sp-catalog-style-article-required'
              AND canonical_code = :param_code
              AND company_id IS NULL
            """
        ).bindparams(param_code=PARAM_CODE)
    )
