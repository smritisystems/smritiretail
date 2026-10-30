"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.122.0
Created      : 2026-10-27
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

EOD Phase 2 — Store Business-Day Model (v1555)
===============================================
Introduces the store-business-day anchor for the End-of-Day closing workflow.

Tables created:
  store_business_days
    Tracks one logical business day per store (branch). A business day has a
    status lifecycle (OPEN -> CLOSED -> LOCKED) and a sign-off record.
    One OPEN day per store is enforced by a unique partial index.

  store_day_shift_assignments
    Links one or more cashier shifts to the store business day they belong to.
    Allows a store to operate multiple cashier shifts within a single business day.

Design rationale:
  - No shadow aggregation columns. All sales/cash totals are computed at query
    time from the existing ledger tables (shifts, shift_cash_transactions, sales).
  - exception_summary_json stores the serialised exception checklist snapshotted
    at closing time — for historical record only, not as a live query target.
  - Store-day close is blocked by the API layer if any ApprovalRequest for the
    store is in PENDING status (enforced in service, not here in DDL).

# @migration_target('tenant')  -- UMGP-G1: applies to tenant databases only
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


revision = "v1555"
down_revision = "v1554"
branch_labels = None
depends_on = None


# @migration_target('tenant')  -- UMGP-G1: applies to tenant databases only
def upgrade() -> None:
    # ── store_business_days ────────────────────────────────────────────────
    op.create_table(
        "store_business_days",
        sa.Column("id", sa.String(50), primary_key=True),
        sa.Column("uuid", sa.String(36), nullable=True),
        sa.Column("company_id", sa.String(50), nullable=True, index=True),
        sa.Column("branch_id", sa.String(50), nullable=False, index=True),

        # Business-date context
        sa.Column("business_date", sa.Date(), nullable=False, index=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="OPEN"),
        # OPEN -> CLOSED -> LOCKED

        # Lifecycle timestamps
        sa.Column("opened_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("locked_at", sa.DateTime(timezone=True), nullable=True),

        # Identity & sign-off
        sa.Column("opened_by", sa.String(100), nullable=True),
        sa.Column("closed_by", sa.String(100), nullable=True),
        sa.Column("locked_by", sa.String(100), nullable=True),
        sa.Column("sign_off_notes", sa.Text(), nullable=True),

        # Exception snapshot (serialised at closing time — read-only history)
        sa.Column("exception_summary_json", JSONB, nullable=True),

        # BaseEntity-compatible tracking columns
        sa.Column("created_at", sa.DateTime(timezone=True),
                  nullable=False, server_default=sa.text("NOW()")),
        sa.Column("modified_at", sa.DateTime(timezone=True),
                  nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False,
                  server_default=sa.text("TRUE")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", sa.String(50), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False,
                  server_default=sa.text("1")),
    )

    # One OPEN day per branch — partial unique index
    op.create_index(
        "ix_store_business_days_branch_open",
        "store_business_days",
        ["branch_id"],
        unique=True,
        postgresql_where=sa.text("status = 'OPEN'"),
    )
    op.create_index(
        "ix_store_business_days_branch_date",
        "store_business_days",
        ["branch_id", "business_date"],
    )

    # ── store_day_shift_assignments ────────────────────────────────────────
    op.create_table(
        "store_day_shift_assignments",
        sa.Column("id", sa.String(50), primary_key=True),
        sa.Column("uuid", sa.String(36), nullable=True),
        sa.Column("company_id", sa.String(50), nullable=True, index=True),
        sa.Column("branch_id", sa.String(50), nullable=True, index=True),

        sa.Column(
            "store_day_id",
            sa.String(50),
            sa.ForeignKey("store_business_days.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "shift_id",
            sa.String(50),
            sa.ForeignKey("shifts.id", ondelete="RESTRICT"),
            nullable=False,
            index=True,
        ),
        sa.Column("assigned_at", sa.DateTime(timezone=True),
                  nullable=False, server_default=sa.text("NOW()")),
        sa.Column("assigned_by", sa.String(100), nullable=True),

        # Prevent the same shift being assigned to two different business days
        sa.UniqueConstraint("shift_id", name="uq_shift_day_assignment"),

        sa.Column("created_at", sa.DateTime(timezone=True),
                  nullable=False, server_default=sa.text("NOW()")),
        sa.Column("is_active", sa.Boolean(), nullable=False,
                  server_default=sa.text("TRUE")),
        sa.Column("version", sa.Integer(), nullable=False,
                  server_default=sa.text("1")),
    )


def downgrade() -> None:
    # UMGP:DESTRUCTIVE_APPROVED — downgrade removes EOD store-day tables (v1555 rollback only)
    op.drop_table("store_day_shift_assignments")
    # UMGP:DESTRUCTIVE_APPROVED
    op.drop_index("ix_store_business_days_branch_date",
                  table_name="store_business_days")
    # UMGP:DESTRUCTIVE_APPROVED
    op.drop_index("ix_store_business_days_branch_open",
                  table_name="store_business_days")
    # UMGP:DESTRUCTIVE_APPROVED
    op.drop_table("store_business_days")
