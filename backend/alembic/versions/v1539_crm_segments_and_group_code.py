"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.99.0
Created      : 2026-10-19
Modified     : 2026-10-19
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
Revision ID  : v1539
Revises      : v1538_staff_multistore_placement_policy
Title        : H2 customer_group code field + M3 crm_segments and crm_segment_memberships
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "v1539"
down_revision = "v1538_staff_multistore_placement_policy"
branch_labels = None
depends_on = None


def upgrade() -> None:


    # H2: Add short code field to customer_groups
    op.add_column(
        "customer_groups",
        sa.Column("code", sa.String(30), nullable=True),
    )
    op.create_index("ix_customer_groups_code", "customer_groups", ["code"])

    # M3: crm_segments master table
    op.create_table(
        "crm_segments",
        sa.Column("id",              sa.String(50),  primary_key=True, nullable=False),
        sa.Column("uuid",            sa.String(36),  nullable=True, server_default=sa.text("gen_random_uuid()::text")),
        sa.Column("company_id",      sa.String(50),  nullable=True),
        sa.Column("branch_id",       sa.String(50),  nullable=True),
        sa.Column("code",            sa.String(30),  nullable=False),
        sa.Column("name",            sa.String(100), nullable=False),
        sa.Column("description",     sa.Text,        nullable=True),
        sa.Column("segment_type",    sa.String(20),  nullable=False, server_default="TAG_BASED"),
        sa.Column("rule_definition", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("member_count",    sa.Integer,     nullable=False, server_default="0"),
        sa.Column("is_active",       sa.Boolean,     nullable=False, server_default=sa.text("true")),
        sa.Column("is_deleted",      sa.Boolean,     nullable=False, server_default=sa.text("false")),
        sa.Column("deleted_at",      sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by",      sa.String(100), nullable=True),
        sa.Column("version",         sa.Integer,     nullable=False, server_default="1"),
        sa.Column("created_at",      sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("modified_at",     sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by",      sa.String(100), nullable=True),
        sa.Column("updated_by",      sa.String(100), nullable=True),
        sa.UniqueConstraint("company_id", "code", name="uq_crm_segments_company_code"),
    )
    op.create_index("ix_crm_segments_company", "crm_segments", ["company_id"])
    op.create_index("ix_crm_segments_code",    "crm_segments", ["code"])

    # M3: crm_segment_memberships junction table
    op.create_table(
        "crm_segment_memberships",
        sa.Column("id",                sa.String(50),  primary_key=True, nullable=False),
        sa.Column("uuid",              sa.String(36),  nullable=True, server_default=sa.text("gen_random_uuid()::text")),
        sa.Column("company_id",        sa.String(50),  nullable=True),
        sa.Column("branch_id",         sa.String(50),  nullable=True),
        sa.Column("segment_id",        sa.String(50),  nullable=False),
        sa.Column("customer_id",       sa.String(50),  nullable=False),
        sa.Column("assignment_source", sa.String(20),  nullable=False, server_default="MANUAL"),
        sa.Column("assigned_at",       sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("is_deleted",        sa.Boolean,     nullable=False, server_default=sa.text("false")),
        sa.Column("deleted_at",        sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by",        sa.String(100), nullable=True),
        sa.Column("version",           sa.Integer,     nullable=False, server_default="1"),
        sa.Column("created_at",        sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("modified_at",       sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by",        sa.String(100), nullable=True),
        sa.Column("updated_by",        sa.String(100), nullable=True),
        sa.ForeignKeyConstraint(["segment_id"],  ["crm_segments.id"],  ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["customer_id"], ["customers.id"],     ondelete="CASCADE"),
        sa.UniqueConstraint("segment_id", "customer_id", name="uq_crm_segment_customer"),
    )
    op.create_index("ix_crm_segment_memberships_customer", "crm_segment_memberships", ["customer_id"])
    op.create_index("ix_crm_segment_memberships_segment",  "crm_segment_memberships", ["segment_id"])


def downgrade() -> None:
    op.drop_index("ix_crm_segment_memberships_segment",  "crm_segment_memberships")
    op.drop_index("ix_crm_segment_memberships_customer", "crm_segment_memberships")
    op.drop_table("crm_segment_memberships")
    op.drop_index("ix_crm_segments_code",    "crm_segments")
    op.drop_index("ix_crm_segments_company", "crm_segments")
    op.drop_table("crm_segments")
    op.drop_index("ix_customer_groups_code", "customer_groups")
    op.drop_column("customer_groups", "code")


