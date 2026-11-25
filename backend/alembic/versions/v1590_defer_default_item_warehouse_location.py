"""Seed the default item warehouse location after explicit locations are written.

Revision ID: v1590
Revises: v1589
# @migration_target('tenant')
"""

from collections.abc import Sequence

from alembic import op

revision: str = "v1590"
down_revision: str | Sequence[str] | None = "v1589"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_seed_warehouse_location ON items")
    op.execute("""
        CREATE CONSTRAINT TRIGGER trg_seed_warehouse_location
        AFTER INSERT ON items
        DEFERRABLE INITIALLY DEFERRED
        FOR EACH ROW
        EXECUTE FUNCTION fn_seed_default_warehouse_location();
    """)


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_seed_warehouse_location ON items")
    op.execute("""
        CREATE TRIGGER trg_seed_warehouse_location
        AFTER INSERT ON items
        FOR EACH ROW
        EXECUTE FUNCTION fn_seed_default_warehouse_location();
    """)
