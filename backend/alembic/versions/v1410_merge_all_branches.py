"""Merge the remaining divergent migration branches into a single final head.

Revision ID: v1410_merge_all_branches
Revises: v1385_merge_company_crm, v1409_merge_so_branches
"""

from alembic import op

revision = "v1410_merge_all_branches"
down_revision = ("v1385_merge_company_crm", "v1409_merge_so_branches")
branch_labels = None
depends_on = None


def upgrade() -> None:
    # This merge file resolves the historical branch divergence and preserves the
    # canonical migration lineage without altering business schema.
    pass


def downgrade() -> None:
    pass
