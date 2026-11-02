"""Allow explicitly authorized negative stock in synthetic DEFAULT batches.

Revision ID: v1573
Revises: v1572
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "v1573"
down_revision: Union[str, Sequence[str], None] = "v1572"
branch_labels = None
depends_on = None

_CONSTRAINT = "chk_batch_stock_positive"
_CHECK = (
    "(quantity >= 0 OR batch_no = 'DEFAULT') "
    "AND reserved_quantity >= 0 AND damaged_quantity >= 0"
)


def upgrade() -> None:
    op.drop_constraint(_CONSTRAINT, "product_batch_stocks", type_="check")
    op.create_check_constraint(_CONSTRAINT, "product_batch_stocks", _CHECK)


def downgrade() -> None:
    bind = op.get_bind()
    negative_default_rows = bind.execute(
        sa.text(
            "SELECT COUNT(*) FROM product_batch_stocks "
            "WHERE batch_no = 'DEFAULT' AND quantity < 0"
        )
    ).scalar_one()
    if negative_default_rows:
        raise RuntimeError(
            "Cannot restore nonnegative batch stock while negative DEFAULT batches remain; "
            "reconcile those balances before downgrading v1573."
        )

    op.drop_constraint(_CONSTRAINT, "product_batch_stocks", type_="check")
    op.create_check_constraint(
        _CONSTRAINT,
        "product_batch_stocks",
        "quantity >= 0 AND reserved_quantity >= 0 AND damaged_quantity >= 0",
    )
