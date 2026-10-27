"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Version      : 3.123.0
Created      : 2026-10-27
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

v1556 — Patch: add missing BaseEntity tracking columns to the two
         EOD tables created in v1555.

store_business_days    : + created_by, updated_by, is_deleted
store_day_shift_assignments : + created_by, updated_by, is_deleted,
                               modified_at, deleted_at, deleted_by

These columns exist in the SQLAlchemy ORM models (via BaseEntity) but
were omitted from the v1555 CREATE TABLE DDL, causing ORM-to-DB drift.
"""
from typing import Union
import sqlalchemy as sa
from alembic import op

revision: str = "v1556"
down_revision: Union[str, None] = "v1555"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    tables = sa.inspect(conn).get_table_names()

    # ── store_business_days ────────────────────────────────────────────────
    if "store_business_days" in tables:
        cols = {c["name"] for c in sa.inspect(conn).get_columns("store_business_days")}

        if "created_by" not in cols:
            op.add_column(
                "store_business_days",
                sa.Column("created_by", sa.String(100), nullable=True),
            )
        if "updated_by" not in cols:
            op.add_column(
                "store_business_days",
                sa.Column("updated_by", sa.String(100), nullable=True),
            )
        if "is_deleted" not in cols:
            op.add_column(
                "store_business_days",
                sa.Column(
                    "is_deleted",
                    sa.Boolean(),
                    nullable=False,
                    server_default=sa.text("FALSE"),
                ),
            )

    # ── store_day_shift_assignments ───────────────────────────────────────
    if "store_day_shift_assignments" in tables:
        cols2 = {c["name"] for c in sa.inspect(conn).get_columns("store_day_shift_assignments")}

        if "created_by" not in cols2:
            op.add_column(
                "store_day_shift_assignments",
                sa.Column("created_by", sa.String(100), nullable=True),
            )
        if "updated_by" not in cols2:
            op.add_column(
                "store_day_shift_assignments",
                sa.Column("updated_by", sa.String(100), nullable=True),
            )
        if "is_deleted" not in cols2:
            op.add_column(
                "store_day_shift_assignments",
                sa.Column(
                    "is_deleted",
                    sa.Boolean(),
                    nullable=False,
                    server_default=sa.text("FALSE"),
                ),
            )
        if "modified_at" not in cols2:
            op.add_column(
                "store_day_shift_assignments",
                sa.Column("modified_at", sa.DateTime(timezone=True), nullable=True),
            )
        if "deleted_at" not in cols2:
            op.add_column(
                "store_day_shift_assignments",
                sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
            )
        if "deleted_by" not in cols2:
            op.add_column(
                "store_day_shift_assignments",
                sa.Column("deleted_by", sa.String(50), nullable=True),
            )


def downgrade() -> None:
    # UMGP:DESTRUCTIVE_APPROVED — downgrade removes patch columns (v1556 rollback only)
    conn = op.get_bind()
    tables = sa.inspect(conn).get_table_names()

    if "store_business_days" in tables:
        cols = {c["name"] for c in sa.inspect(conn).get_columns("store_business_days")}
        for col in ["created_by", "updated_by", "is_deleted"]:
            if col in cols:
                op.drop_column("store_business_days", col)

    if "store_day_shift_assignments" in tables:
        cols2 = {c["name"] for c in sa.inspect(conn).get_columns("store_day_shift_assignments")}
        for col in ["created_by", "updated_by", "is_deleted", "modified_at", "deleted_at", "deleted_by"]:
            if col in cols2:
                op.drop_column("store_day_shift_assignments", col)
