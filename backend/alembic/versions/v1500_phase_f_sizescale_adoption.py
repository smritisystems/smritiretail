"""Phase F SizeScale Adoption — Foreign Key Constraint.

Revision ID: v1500_phase_f_sizescale_adoption
Revises: v1402_merge_phase_e_heads
"""

from typing import Sequence, Union
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "v1500_phase_f_sizescale_adoption"
down_revision: Union[str, Sequence[str], None] = "v1402_merge_phase_e_heads"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_foreign_key(
        "fk_products_size_scale_id",
        "products",
        "size_scales",
        ["size_scale_id"],
        ["id"],
        ondelete="SET NULL"
    )


def downgrade() -> None:
    op.drop_constraint("fk_products_size_scale_id", "products", type_="foreignkey")
