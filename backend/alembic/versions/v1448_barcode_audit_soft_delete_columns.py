"""Complete barcode audit BaseEntity columns for existing installations."""

from typing import Sequence, Union

from alembic import op


revision: str = "v1448_barcode_audit_soft_delete_columns"
down_revision: Union[str, Sequence[str], None] = "v1447_barcode_registry_lifecycle"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE barcode_registry_audit ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL")
    op.execute("ALTER TABLE barcode_registry_audit ADD COLUMN IF NOT EXISTS deleted_by VARCHAR(100) NULL")


def downgrade() -> None:
    op.execute("ALTER TABLE barcode_registry_audit DROP COLUMN IF EXISTS deleted_by")
    op.execute("ALTER TABLE barcode_registry_audit DROP COLUMN IF EXISTS deleted_at")