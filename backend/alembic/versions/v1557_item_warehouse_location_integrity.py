"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Version      : 3.124.0
Created      : 2026-10-27
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

v1557 - ItemWarehouseLocation integrity hardening (R-002, R-006)

R-002: Add FK constraint from item_warehouse_locations.warehouse_id to warehouses.id.
       Prevents warehouse deletion from orphaning item-location configuration rows.
       Uses RESTRICT so existing data is protected without silent deletion.

R-006: Replace the uq_item_warehouse unique constraint (item_id, warehouse_id) with a
       company-scoped version (company_id, item_id, warehouse_id).
       The prior constraint had no company_id scope, allowing cross-company constraint
       collisions in a shared-database multi-company deployment.

Upgrade safety: Both operations are non-destructive. The FK add will fail if orphaned
rows exist (warehouse_id values referencing no row in warehouses). Run the diagnostic
query below BEFORE applying if you have production data:

  SELECT iwl.id, iwl.warehouse_id
  FROM item_warehouse_locations iwl
  LEFT JOIN warehouses w ON w.id = iwl.warehouse_id
  WHERE w.id IS NULL AND iwl.warehouse_id IS NOT NULL;

If this returns rows, resolve the orphans first (assign a valid warehouse_id or delete
the orphaned item_warehouse_location rows).
"""
from typing import Union
import sqlalchemy as sa
from alembic import op

revision: str = "v1557"
down_revision: Union[str, None] = "v1556"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ------------------------------------------------------------------
    # R-006: Replace uq_item_warehouse with company-scoped constraint.
    # Must be done BEFORE adding the FK so the index state is clean.
    # ------------------------------------------------------------------
    op.drop_constraint(
        "uq_item_warehouse",
        "item_warehouse_locations",
        type_="unique",
    )
    op.create_unique_constraint(
        "uq_item_warehouse_per_company",
        "item_warehouse_locations",
        ["company_id", "item_id", "warehouse_id"],
    )

    # ------------------------------------------------------------------
    # R-002: Add FK warehouse_id -> warehouses.id with RESTRICT.
    # ------------------------------------------------------------------
    op.create_foreign_key(
        "fk_item_wh_loc_warehouse_id",
        "item_warehouse_locations",   # source table
        "warehouses",                 # referent table
        ["warehouse_id"],             # local columns
        ["id"],                       # remote columns
        ondelete="RESTRICT",
    )


def downgrade() -> None:
    # Remove FK first (reverse of upgrade).
    op.drop_constraint(
        "fk_item_wh_loc_warehouse_id",
        "item_warehouse_locations",
        type_="foreignkey",
    )

    # Restore original narrower unique constraint.
    op.drop_constraint(
        "uq_item_warehouse_per_company",
        "item_warehouse_locations",
        type_="unique",
    )
    op.create_unique_constraint(
        "uq_item_warehouse",
        "item_warehouse_locations",
        ["item_id", "warehouse_id"],
    )
