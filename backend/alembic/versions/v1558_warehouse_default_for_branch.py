"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Version      : 3.125.0
Created      : 2026-10-27
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

v1558 - Add is_default_for_branch governance column to warehouses (R-007)

Adds a boolean column `is_default_for_branch` (default FALSE) to the warehouses
table, with a partial unique index enforcing that at most one active, non-deleted
warehouse per (company_id, branch_id) may be flagged as the default.

This gives the InventoryWarehouseResolver a governed, explicit signal instead of
silently falling back to the oldest warehouse by created_at when resolving
branch -> warehouse.

No existing rows are disrupted: all warehouses start with is_default_for_branch = FALSE.
Operators or an admin script may then explicitly mark the preferred warehouse per branch.
"""
from typing import Union
import sqlalchemy as sa
from alembic import op

revision: str = "v1558"
down_revision: Union[str, None] = "v1557"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add is_default_for_branch column. Default and server_default both FALSE so
    # existing warehouses remain neutral and no unique constraint is violated.
    op.add_column(
        "warehouses",
        sa.Column(
            "is_default_for_branch",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )

    # Partial unique index: at most one default per (company_id, branch_id) pair
    # among active, non-deleted warehouses.
    op.create_index(
        "uq_warehouse_branch_default",
        "warehouses",
        ["company_id", "branch_id"],
        unique=True,
        postgresql_where=sa.text("is_default_for_branch = true AND is_deleted = false"),
    )


def downgrade() -> None:
    op.drop_index("uq_warehouse_branch_default", table_name="warehouses")
    op.drop_column("warehouses", "is_default_for_branch")
