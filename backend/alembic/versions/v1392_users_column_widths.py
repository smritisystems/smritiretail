"""Align users column widths with the ORM model."""

from alembic import op


revision = "v1392_users_column_widths"
down_revision = "v1391_missing_platform_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Current revision identifiers exceed Alembic's historical VARCHAR(32) default.
    op.execute(
        "ALTER TABLE IF EXISTS alembic_version ALTER COLUMN version_num TYPE VARCHAR(100);"
    )
    op.execute(
        "ALTER TABLE IF EXISTS users ALTER COLUMN uuid TYPE VARCHAR(36) USING uuid::VARCHAR(36);"
    )
    op.execute(
        "ALTER TABLE IF EXISTS users ALTER COLUMN status TYPE VARCHAR(50) USING status::VARCHAR(50);"
    )


def downgrade() -> None:
    pass