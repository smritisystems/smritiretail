"""Flag active catalog items using the retired 12% GST slab for review.

Revision ID: v1599_flag_legacy_gst_12_items_for_review
Revises: v1598_scope_item_barcodes_by_company
# @migration_target('tenant')
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import context, op
from alembic.migration_contract import validate_migration_execution

revision: str = "v1599_flag_legacy_gst_12_items_for_review"
down_revision: str | Sequence[str] | None = "v1598_scope_item_barcodes_by_company"
branch_labels: str | Sequence[str] | None = None
depends_on = None


def upgrade() -> None:
    if not context.is_offline_mode():
        database = op.get_bind().execute(sa.text("SELECT current_database()")).scalar_one()
        validate_migration_execution("tenant", database)

    op.execute(
        """
        UPDATE items
        SET validation_status = 'REQUIRES_REVIEW',
            validation_message = 'GST 2.0: 12% tax rate is retired; CA review is required.'
        WHERE tax_rate = 12
          AND is_deleted IS NOT TRUE
          AND (validation_status IS NULL OR validation_status = 'PASS')
        """
    )


def downgrade() -> None:
    raise RuntimeError(
        "Revision v1599 is a forward-only compliance data remediation. "
        "Restore a verified database backup instead of reverting it."
    )
