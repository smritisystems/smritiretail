"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Version      : 3.126.0
Created      : 2026-10-27
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

v1559 - Add FK constraint to pos_parked_carts.branch_id (R-014)

Previously pos_parked_carts.branch_id was an unguarded String(50) with no
foreign key. This migration adds a FK to branches.id with ondelete=RESTRICT
so parked carts cannot reference a non-existent branch.

Upgrade safety: If orphaned branch_id values exist (rows with branch IDs not
present in branches table), the FK creation will fail. Run the diagnostic query
below first:

  SELECT DISTINCT branch_id FROM pos_parked_carts
  WHERE branch_id NOT IN (SELECT id FROM branches);

Resolve any orphans before applying.
"""
from typing import Union
import sqlalchemy as sa
from alembic import op

revision: str = "v1559"
down_revision: Union[str, None] = "v1558"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_foreign_key(
        "fk_pos_parked_carts_branch_id",
        "pos_parked_carts",   # source table
        "branches",           # referent table
        ["branch_id"],        # local columns
        ["id"],               # remote columns
        ondelete="RESTRICT",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_pos_parked_carts_branch_id",
        "pos_parked_carts",
        type_="foreignkey",
    )
