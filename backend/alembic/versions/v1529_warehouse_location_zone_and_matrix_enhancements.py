"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.72.9
Created      : 2026-10-13
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

Alembic Migration: v1529_warehouse_location_zone_and_matrix_enhancements
Add zone, barcode, max_capacity_units, and is_locked to warehouse_locations table.
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "v1529_warehouse_location_zone_and_matrix_enhancements"
down_revision: Union[str, Sequence[str], None] = "v1528_canonical_role_permissions_remediation"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = {c["name"] for c in inspector.get_columns("warehouse_locations")}

    if "zone" not in columns:
        op.add_column("warehouse_locations", sa.Column("zone", sa.String(50), nullable=True, server_default="STORAGE"))
    if "barcode" not in columns:
        op.add_column("warehouse_locations", sa.Column("barcode", sa.String(100), nullable=True))
        op.create_index("ix_warehouse_locations_barcode", "warehouse_locations", ["barcode"])
    if "max_capacity_units" not in columns:
        op.add_column("warehouse_locations", sa.Column("max_capacity_units", sa.Integer(), nullable=True, server_default="100"))
    if "is_locked" not in columns:
        op.add_column("warehouse_locations", sa.Column("is_locked", sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = {c["name"] for c in inspector.get_columns("warehouse_locations")}

    if "is_locked" in columns:
        op.drop_column("warehouse_locations", "is_locked")
    if "max_capacity_units" in columns:
        op.drop_column("warehouse_locations", "max_capacity_units")
    if "barcode" in columns:
        op.drop_index("ix_warehouse_locations_barcode", table_name="warehouse_locations")
        op.drop_column("warehouse_locations", "barcode")
    if "zone" in columns:
        op.drop_column("warehouse_locations", "zone")
