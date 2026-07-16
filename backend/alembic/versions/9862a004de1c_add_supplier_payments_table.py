"""add_supplier_payments_table

Revision ID: 9862a004de1c
Revises: cc8a527deb42
Create Date: 2026-07-11 20:25:43.067391

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9862a004de1c'
down_revision: Union[str, Sequence[str], None] = 'cc8a527deb42'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # autogenerate produced empty migration because an empty-shell 'supplier_payments'
    # table existed in the DB already. Drop it and recreate with the correct schema.
    op.execute("DROP TABLE IF EXISTS supplier_payments CASCADE")
    op.execute("""
        CREATE TABLE supplier_payments (
            supplier_id    VARCHAR(50)  NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
            amount         NUMERIC(15,2) NOT NULL,
            payment_mode   VARCHAR(30)  NOT NULL DEFAULT 'CASH',
            payment_date   DATE         NOT NULL,
            reference_no   VARCHAR(100),
            notes          TEXT,
            id          VARCHAR(50)  NOT NULL PRIMARY KEY,
            uuid        VARCHAR(36)  NOT NULL UNIQUE,
            company_id  VARCHAR(50)  REFERENCES companies(id) ON DELETE RESTRICT,
            branch_id   VARCHAR(50)  REFERENCES branches(id)  ON DELETE RESTRICT,
            created_at  TIMESTAMPTZ,
            modified_at TIMESTAMPTZ,
            created_by  VARCHAR(100),
            updated_by  VARCHAR(100),
            is_active   BOOLEAN DEFAULT TRUE,
            is_deleted  BOOLEAN DEFAULT FALSE,
            deleted_at  TIMESTAMPTZ,
            deleted_by  VARCHAR(100),
            version     INTEGER DEFAULT 1
        )
    """)
    op.execute("CREATE INDEX ix_supplier_payments_supplier_id ON supplier_payments(supplier_id)")


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("DROP TABLE IF EXISTS supplier_payments CASCADE")
