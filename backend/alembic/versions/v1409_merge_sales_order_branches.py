"""Merge the sales-order branch revisions after the barcode reservation work.

Revision ID: v1409_merge_so_branches
Revises: v1407_restore_so_metrics, v1408_so_reservation
"""

from alembic import op

revision = "v1409_merge_so_branches"
down_revision = ("v1407_restore_so_metrics", "v1408_so_reservation")
branch_labels = None
depends_on = None


def upgrade() -> None:
    # This merge migration resolves the divergent sales-order history.
    pass


def downgrade() -> None:
    pass
