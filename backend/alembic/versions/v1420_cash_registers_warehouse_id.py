"""
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.32.0
 * Created      : 2026-09-10
 * Modified     : 2026-09-10
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
"""

"""Add warehouse_id foreign key column and index to cash_registers.

Revision ID: v1420_cash_reg_wh
Revises: v1419_dispatch_from
Create Date: 2026-09-10
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "v1420_cash_reg_wh"
down_revision: Union[str, Sequence[str], None] = "v1419_dispatch_from"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()

    current_db = bind.execute(sa.text("SELECT current_database();")).scalar()
    if not current_db or current_db.lower() in ("smritisys", "postgres", "template0", "template1"):
        return

    inspector = sa.inspect(bind)
    table_names = inspector.get_table_names()
    if "cash_registers" not in table_names:
        return

    existing_cols = {col["name"] for col in inspector.get_columns("cash_registers")}

    if "warehouse_id" not in existing_cols:
        op.add_column(
            "cash_registers",
            sa.Column(
                "warehouse_id",
                sa.String(50),
                sa.ForeignKey("warehouses.id", ondelete="SET NULL"),
                nullable=True,
            ),
        )

    existing_indexes = {idx["name"] for idx in inspector.get_indexes("cash_registers")}
    if "ix_cash_registers_warehouse_id" not in existing_indexes:
        op.create_index(
            "ix_cash_registers_warehouse_id",
            "cash_registers",
            ["warehouse_id"],
        )


def downgrade() -> None:
    bind = op.get_bind()
    current_db = bind.execute(sa.text("SELECT current_database();")).scalar()
    if not current_db or current_db.lower() in ("smritisys", "postgres", "template0", "template1"):
        return

    inspector = sa.inspect(bind)
    if "cash_registers" not in inspector.get_table_names():
        return

    existing_indexes = {idx["name"] for idx in inspector.get_indexes("cash_registers")}
    if "ix_cash_registers_warehouse_id" in existing_indexes:
        op.drop_index("ix_cash_registers_warehouse_id", table_name="cash_registers")

    existing_cols = {col["name"] for col in inspector.get_columns("cash_registers")}
    if "warehouse_id" in existing_cols:
        op.drop_column("cash_registers", "warehouse_id")
