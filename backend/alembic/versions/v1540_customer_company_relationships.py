"""v1540: Create customer_company_relationships table and execute idempotent backfill

Revision ID: v1540
Revises: v1539
Create Date: 2026-10-19

Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.99.0
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Database Migration
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "v1540"
down_revision = "v1539"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Create customer_company_relationships table with full BaseEntity columns
    op.create_table(
        "customer_company_relationships",
        sa.Column("id", sa.String(50), primary_key=True, nullable=False),
        sa.Column("uuid", sa.String(36), nullable=False, server_default=sa.text("gen_random_uuid()::text"), unique=True),
        sa.Column("company_id", sa.String(50), sa.ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("branch_id", sa.String(50), sa.ForeignKey("branches.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("customer_id", sa.String(50), sa.ForeignKey("customers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("customer_group_id", sa.String(50), sa.ForeignKey("customer_groups.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("price_tier_id", sa.String(50), nullable=True),
        sa.Column("credit_limit", sa.Numeric(15, 2), nullable=False, server_default=sa.text("0.00")),
        sa.Column("credit_days", sa.Integer, nullable=False, server_default=sa.text("0")),
        sa.Column("credit_hold", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("status", sa.String(20), nullable=False, server_default="Active"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.text("true")),
        sa.Column("is_deleted", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", sa.String(100), nullable=True),
        sa.Column("version", sa.Integer, nullable=False, server_default=sa.text("1")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("modified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", sa.String(100), nullable=True),
        sa.Column("updated_by", sa.String(100), nullable=True),
        sa.UniqueConstraint("customer_id", "company_id", name="uq_ccr_customer_company"),
    )

    op.create_index("ix_ccr_company_customer", "customer_company_relationships", ["company_id", "customer_id"])
    op.create_index("ix_ccr_customer_group", "customer_company_relationships", ["customer_group_id"])
    op.create_index("ix_ccr_customer", "customer_company_relationships", ["customer_id"])

    # 2. Fully idempotent backfill for existing customers
    op.execute(sa.text("""
        INSERT INTO customer_company_relationships (
            id,
            uuid,
            company_id,
            branch_id,
            customer_id,
            customer_group_id,
            price_tier_id,
            credit_limit,
            credit_days,
            credit_hold,
            status,
            is_active,
            is_deleted,
            version,
            created_at,
            modified_at,
            created_by,
            updated_by
        )
        SELECT
            'ccr-' || substr(md5(c.id || '-' || c.company_id), 1, 16) AS id,
            gen_random_uuid()::varchar(36) AS uuid,
            c.company_id,
            c.branch_id,
            c.id AS customer_id,
            c.customer_group_id,
            NULL AS price_tier_id,
            COALESCE(cg.credit_limit, 0.00) AS credit_limit,
            COALESCE(cg.credit_days, 0) AS credit_days,
            COALESCE(cg.credit_hold, false) AS credit_hold,
            COALESCE(c.status, 'Active') AS status,
            c.is_active,
            c.is_deleted,
            1 AS version,
            clock_timestamp() AS created_at,
            clock_timestamp() AS modified_at,
            'system_backfill_v1540' AS created_by,
            'system_backfill_v1540' AS updated_by
        FROM customers c
        LEFT JOIN customer_groups cg ON cg.id = c.customer_group_id
        WHERE c.is_deleted = false AND c.company_id IS NOT NULL
        ON CONFLICT (customer_id, company_id) DO UPDATE
        SET
            customer_group_id = EXCLUDED.customer_group_id,
            credit_limit      = EXCLUDED.credit_limit,
            credit_days       = EXCLUDED.credit_days,
            credit_hold       = EXCLUDED.credit_hold,
            modified_at       = clock_timestamp(),
            updated_by        = 'system_backfill_v1540_update';
    """))


def downgrade() -> None:
    op.drop_table("customer_company_relationships")
