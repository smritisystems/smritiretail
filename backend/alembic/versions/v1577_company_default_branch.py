"""Add one authoritative default branch per company.

Revision ID: v1577
Revises: v1576
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "v1577"
down_revision: Union[str, Sequence[str], None] = "v1576"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    table_exists = bind.execute(
        sa.text("""
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = current_schema() AND table_name = 'branches'
        """)
    ).scalar()
    if not table_exists:
        return

    bind.execute(sa.text(
        "ALTER TABLE branches ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT FALSE"
    ))
    bind.execute(sa.text("""
        WITH ranked AS (
            SELECT id,
                   ROW_NUMBER() OVER (
                       PARTITION BY company_id
                       ORDER BY
                           is_default DESC,
                           CASE WHEN upper(code) IN ('BR-MAIN-001', 'MAIN') THEN 0 ELSE 1 END,
                           lower(code),
                           id
                   ) AS rank
            FROM branches
            WHERE is_active IS TRUE AND is_deleted IS FALSE
        )
        UPDATE branches AS branch
        SET is_default = (ranked.rank = 1)
        FROM ranked
        WHERE branch.id = ranked.id
    """))
    bind.execute(sa.text("""
        UPDATE branches
        SET is_default = FALSE
        WHERE is_default IS TRUE
          AND (is_active IS NOT TRUE OR is_deleted IS TRUE)
    """))
    bind.execute(sa.text("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_branches_one_default_per_company
        ON branches (company_id)
        WHERE is_default IS TRUE
    """))


def downgrade() -> None:
    # Keep the canonical default flag after downgrade to avoid losing configuration.
    pass
