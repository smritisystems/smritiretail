"""Merge Phase E heads with IAM Enterprise.

Revision ID: v1402_merge_phase_e_heads
Revises: v1220_iam_enterprise, v1401_phase_e_backfill
"""

from typing import Sequence, Union

# revision identifiers, used by Alembic.
revision: str = "v1402_merge_phase_e_heads"
down_revision: Union[str, Sequence[str], None] = ("v1220_iam_enterprise", "v1401_phase_e_backfill")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
