"""Create loyalty studio core tables.

Authoritatively provisions the four missing Loyalty Studio tables that were
never covered by a CREATE TABLE migration, causing 500 errors on fresh
installations where the loyalty router (v1486+) is active:

  - loyalty_tiers          — tier definitions (Bronze / Silver / Gold etc.)
  - loyalty_rules          — earning / redemption rule engine
  - loyalty_members        — per-customer enrolment + running balance
  - loyalty_points_ledgers — immutable points earn / redeem ledger

Background
----------
The v1372_sprint12_parity_tables migration created `loyalty_transactions`
with a FK to `loyalty_members.id`, implicitly assuming those tables were
already present (they were hand-created in some environments). This migration
closes that schema gap idempotently via IF NOT EXISTS guards so it is safe
to apply on both fresh installs and any environment where the tables were
created outside Alembic.

Revision ID  : v1486_loyalty_studio_tables
Revises      : v1485_audit_log_hash_chain
Create Date  : 2026-09-24
"""
# Project      : SMRITI Retail OS
# Author       : Jawahar Ramkripal Mallah
# Designation  : Chief Systems Architect & Creator
# Email        : support@smritibooks.com
# Websites     : smritibooks.com | erpnbook.com | aitdl.com
# Version      : 1.0.0
# Created      : 2026-09-24
# Modified     : 2026-09-24
# Copyright    : © SMRITIBooks.com. All Rights Reserved.
# License      : Proprietary Commercial Software
# Classification: Internal

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "v1486_loyalty_studio_tables"
down_revision = "v1485_audit_log_hash_chain"
branch_labels = None
depends_on = None

# ---------------------------------------------------------------------------
# Shared BaseEntity audit columns block
# ---------------------------------------------------------------------------
_BASE_AUDIT_COLS = [
    sa.Column("created_at",  sa.DateTime(timezone=True), nullable=True, server_default=sa.text("NOW()")),
    sa.Column("modified_at", sa.DateTime(timezone=True), nullable=True, server_default=sa.text("NOW()")),
    sa.Column("created_by",  sa.String(100), nullable=True),
    sa.Column("updated_by",  sa.String(100), nullable=True),
    sa.Column("is_active",   sa.Boolean(),   nullable=False, server_default=sa.true()),
    sa.Column("is_deleted",  sa.Boolean(),   nullable=False, server_default=sa.false()),
    sa.Column("deleted_at",  sa.DateTime(timezone=True), nullable=True),
    sa.Column("deleted_by",  sa.String(100), nullable=True),
    sa.Column("version",     sa.Integer(),   nullable=False, server_default="1"),
]


def _base_entity_cols() -> list:
    """Returns a fresh copy of the BaseEntity audit columns for each table."""
    return [
        sa.Column("created_at",  sa.DateTime(timezone=True), nullable=True, server_default=sa.text("NOW()")),
        sa.Column("modified_at", sa.DateTime(timezone=True), nullable=True, server_default=sa.text("NOW()")),
        sa.Column("created_by",  sa.String(100), nullable=True),
        sa.Column("updated_by",  sa.String(100), nullable=True),
        sa.Column("is_active",   sa.Boolean(),   nullable=False, server_default=sa.true()),
        sa.Column("is_deleted",  sa.Boolean(),   nullable=False, server_default=sa.false()),
        sa.Column("deleted_at",  sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by",  sa.String(100), nullable=True),
        sa.Column("version",     sa.Integer(),   nullable=False, server_default="1"),
    ]


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = set(inspector.get_table_names())

    # -----------------------------------------------------------------------
    # 1. loyalty_tiers — Tier definitions (Bronze / Silver / Gold / Platinum)
    # -----------------------------------------------------------------------
    if "loyalty_tiers" not in existing_tables:
        op.create_table(
            "loyalty_tiers",
            sa.Column("id",                 sa.String(50),      nullable=False),
            sa.Column("uuid",               sa.String(36),      nullable=False),
            sa.Column("company_id",         sa.String(50),      nullable=True),
            sa.Column("branch_id",          sa.String(50),      nullable=True),
            # Business fields
            sa.Column("name",               sa.String(100),     nullable=False),
            sa.Column("min_spend",          sa.Numeric(15, 2),  nullable=True,  server_default="0.00"),
            sa.Column("earn_multiplier",    sa.Numeric(5, 2),   nullable=True,  server_default="1.00"),
            sa.Column("redemption_ratio",   sa.Numeric(5, 2),   nullable=True,  server_default="1.00"),
            sa.Column("benefits",           JSONB,              nullable=True,  server_default=sa.text("'{}'")),
            sa.Column("is_active",          sa.Boolean(),       nullable=False, server_default=sa.true()),
            sa.Column("is_deleted",         sa.Boolean(),       nullable=False, server_default=sa.false()),
            sa.Column("deleted_at",         sa.DateTime(timezone=True), nullable=True),
            sa.Column("deleted_by",         sa.String(100),     nullable=True),
            sa.Column("version",            sa.Integer(),       nullable=False, server_default="1"),
            sa.Column("created_at",         sa.DateTime(timezone=True), nullable=True, server_default=sa.text("NOW()")),
            sa.Column("modified_at",        sa.DateTime(timezone=True), nullable=True, server_default=sa.text("NOW()")),
            sa.Column("created_by",         sa.String(100),     nullable=True),
            sa.Column("updated_by",         sa.String(100),     nullable=True),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("uuid", name="uq_loyalty_tiers_uuid"),
            sa.UniqueConstraint("name", name="uq_loyalty_tiers_name"),
        )
        op.create_index("ix_loyalty_tiers_company_id",  "loyalty_tiers", ["company_id"])
        op.create_index("ix_loyalty_tiers_is_active",   "loyalty_tiers", ["is_active"])
        op.create_index("ix_loyalty_tiers_is_deleted",  "loyalty_tiers", ["is_deleted"])

    # -----------------------------------------------------------------------
    # 2. loyalty_rules — Earning and Redemption rule engine
    # -----------------------------------------------------------------------
    if "loyalty_rules" not in existing_tables:
        op.create_table(
            "loyalty_rules",
            sa.Column("id",                      sa.String(50),      nullable=False),
            sa.Column("uuid",                    sa.String(36),      nullable=False),
            sa.Column("company_id",              sa.String(50),      nullable=True),
            sa.Column("branch_id",               sa.String(50),      nullable=True),
            # Business fields
            sa.Column("name",                    sa.String(100),     nullable=False),
            sa.Column("rule_type",               sa.String(50),      nullable=False),
            # SPEND_BASED | CATEGORY_BONUS | BIRTHDAY_BONUS
            sa.Column("min_invoice_amount",      sa.Numeric(15, 2),  nullable=True, server_default="0.00"),
            sa.Column("points_per_unit_spend",   sa.Numeric(10, 2),  nullable=True, server_default="1.00"),
            sa.Column("unit_spend_amount",       sa.Numeric(15, 2),  nullable=True, server_default="100.00"),
            sa.Column("expiry_days",             sa.Integer(),       nullable=True, server_default="365"),
            sa.Column("is_active",               sa.Boolean(),       nullable=False, server_default=sa.true()),
            sa.Column("is_deleted",              sa.Boolean(),       nullable=False, server_default=sa.false()),
            sa.Column("deleted_at",              sa.DateTime(timezone=True), nullable=True),
            sa.Column("deleted_by",              sa.String(100),     nullable=True),
            sa.Column("version",                 sa.Integer(),       nullable=False, server_default="1"),
            sa.Column("created_at",              sa.DateTime(timezone=True), nullable=True, server_default=sa.text("NOW()")),
            sa.Column("modified_at",             sa.DateTime(timezone=True), nullable=True, server_default=sa.text("NOW()")),
            sa.Column("created_by",              sa.String(100),     nullable=True),
            sa.Column("updated_by",              sa.String(100),     nullable=True),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("uuid", name="uq_loyalty_rules_uuid"),
        )
        op.create_index("ix_loyalty_rules_company_id",  "loyalty_rules", ["company_id"])
        op.create_index("ix_loyalty_rules_rule_type",   "loyalty_rules", ["rule_type"])
        op.create_index("ix_loyalty_rules_is_active",   "loyalty_rules", ["is_active"])
        op.create_index("ix_loyalty_rules_is_deleted",  "loyalty_rules", ["is_deleted"])

    # -----------------------------------------------------------------------
    # 3. loyalty_members — Per-customer enrolment + running point balance
    # -----------------------------------------------------------------------
    if "loyalty_members" not in existing_tables:
        op.create_table(
            "loyalty_members",
            sa.Column("id",                      sa.String(50),      nullable=False),
            sa.Column("uuid",                    sa.String(36),      nullable=False),
            sa.Column("company_id",              sa.String(50),      nullable=True),
            sa.Column("branch_id",               sa.String(50),      nullable=True),
            # Business fields
            sa.Column("customer_id",             sa.String(50),      nullable=False),
            sa.Column("loyalty_program_id",      sa.String(50),      nullable=True),
            sa.Column("loyalty_program_code",    sa.String(50),      nullable=True),
            sa.Column("loyalty_tier_id",         sa.String(50),      nullable=True),
            sa.Column("card_number",             sa.String(50),      nullable=True),
            sa.Column("total_points_earned",     sa.Numeric(15, 2),  nullable=True, server_default="0.00"),
            sa.Column("total_points_redeemed",   sa.Numeric(15, 2),  nullable=True, server_default="0.00"),
            sa.Column("current_points_balance",  sa.Numeric(15, 2),  nullable=True, server_default="0.00"),
            sa.Column("total_lifetime_spend",    sa.Numeric(15, 2),  nullable=True, server_default="0.00"),
            sa.Column("joined_date",             sa.DateTime(timezone=True), nullable=True, server_default=sa.text("NOW()")),
            sa.Column("is_active",               sa.Boolean(),       nullable=False, server_default=sa.true()),
            sa.Column("is_deleted",              sa.Boolean(),       nullable=False, server_default=sa.false()),
            sa.Column("deleted_at",              sa.DateTime(timezone=True), nullable=True),
            sa.Column("deleted_by",              sa.String(100),     nullable=True),
            sa.Column("version",                 sa.Integer(),       nullable=False, server_default="1"),
            sa.Column("created_at",              sa.DateTime(timezone=True), nullable=True, server_default=sa.text("NOW()")),
            sa.Column("modified_at",             sa.DateTime(timezone=True), nullable=True, server_default=sa.text("NOW()")),
            sa.Column("created_by",              sa.String(100),     nullable=True),
            sa.Column("updated_by",              sa.String(100),     nullable=True),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("uuid",        name="uq_loyalty_members_uuid"),
            sa.UniqueConstraint("card_number", name="uq_loyalty_members_card_number"),
            sa.ForeignKeyConstraint(
                ["customer_id"],
                ["customers.id"],
                name="fk_loyalty_members_customer",
                ondelete="CASCADE",
            ),
            sa.ForeignKeyConstraint(
                ["loyalty_tier_id"],
                ["loyalty_tiers.id"],
                name="fk_loyalty_members_tier",
                ondelete="SET NULL",
            ),
        )
        op.create_index("ix_loyalty_members_customer_id",     "loyalty_members", ["customer_id"])
        op.create_index("ix_loyalty_members_program_id",      "loyalty_members", ["loyalty_program_id"])
        op.create_index("ix_loyalty_members_program_code",    "loyalty_members", ["loyalty_program_code"])
        op.create_index("ix_loyalty_members_card_number",     "loyalty_members", ["card_number"])
        op.create_index("ix_loyalty_members_is_active",       "loyalty_members", ["is_active"])
        op.create_index("ix_loyalty_members_is_deleted",      "loyalty_members", ["is_deleted"])

    # -----------------------------------------------------------------------
    # 4. loyalty_points_ledgers — Immutable authoritative points earn/redeem ledger
    # -----------------------------------------------------------------------
    if "loyalty_points_ledgers" not in existing_tables:
        op.create_table(
            "loyalty_points_ledgers",
            sa.Column("id",                      sa.String(50),      nullable=False),
            sa.Column("uuid",                    sa.String(36),      nullable=False),
            sa.Column("company_id",              sa.String(50),      nullable=True),
            sa.Column("branch_id",               sa.String(50),      nullable=True),
            # Business fields
            sa.Column("member_id",               sa.String(50),      nullable=False),
            sa.Column("transaction_type",        sa.String(50),      nullable=False),
            # EARN | REDEEM | REVERSAL | EXPIRY | ADJUSTMENT
            sa.Column("points",                  sa.Numeric(15, 2),  nullable=False),
            # Positive = Earn, Negative = Redeem/Reversal
            sa.Column("reference_invoice_id",    sa.String(50),      nullable=True),
            sa.Column("reference_return_id",     sa.String(50),      nullable=True),
            sa.Column("narration",               sa.Text(),          nullable=True),
            sa.Column("timestamp",               sa.DateTime(timezone=True), nullable=True, server_default=sa.text("NOW()")),
            sa.Column("is_active",               sa.Boolean(),       nullable=False, server_default=sa.true()),
            sa.Column("is_deleted",              sa.Boolean(),       nullable=False, server_default=sa.false()),
            sa.Column("deleted_at",              sa.DateTime(timezone=True), nullable=True),
            sa.Column("deleted_by",              sa.String(100),     nullable=True),
            sa.Column("version",                 sa.Integer(),       nullable=False, server_default="1"),
            sa.Column("created_at",              sa.DateTime(timezone=True), nullable=True, server_default=sa.text("NOW()")),
            sa.Column("modified_at",             sa.DateTime(timezone=True), nullable=True, server_default=sa.text("NOW()")),
            sa.Column("created_by",              sa.String(100),     nullable=True),
            sa.Column("updated_by",              sa.String(100),     nullable=True),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("uuid", name="uq_loyalty_points_ledgers_uuid"),
            sa.ForeignKeyConstraint(
                ["member_id"],
                ["loyalty_members.id"],
                name="fk_loyalty_points_ledgers_member",
                ondelete="CASCADE",
            ),
        )
        op.create_index("ix_loyalty_ledger_member_id",        "loyalty_points_ledgers", ["member_id"])
        op.create_index("ix_loyalty_ledger_transaction_type", "loyalty_points_ledgers", ["transaction_type"])
        op.create_index("ix_loyalty_ledger_invoice_id",       "loyalty_points_ledgers", ["reference_invoice_id"])
        op.create_index("ix_loyalty_ledger_return_id",        "loyalty_points_ledgers", ["reference_return_id"])
        op.create_index("ix_loyalty_ledger_timestamp",        "loyalty_points_ledgers", ["timestamp"])
        op.create_index("ix_loyalty_ledger_is_deleted",       "loyalty_points_ledgers", ["is_deleted"])


def downgrade() -> None:
    op.drop_table("loyalty_points_ledgers")
    op.drop_table("loyalty_members")
    op.drop_table("loyalty_rules")
    op.drop_table("loyalty_tiers")
