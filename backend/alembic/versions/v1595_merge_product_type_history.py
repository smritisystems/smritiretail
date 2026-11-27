"""Merge the legacy product-type revision with the canonical migration line.

Revision ID: v1595
Revises: v1594, v1393_product_type_dimension
# @migration_target('tenant')
"""

from collections.abc import Sequence

revision: str = "v1595"
down_revision: str | Sequence[str] | None = (
    "v1594",
    "v1393_product_type_dimension",
)
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    raise RuntimeError(
        "Revision v1595 merges deployed migration histories and is forward-only."
    )
