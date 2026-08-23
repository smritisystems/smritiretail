"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.22.0
Created      : 2026-08-23
Modified     : 2026-08-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

FORWARD-ONLY MIGRATION -- Distribution Core & Territory Management (Section 8)
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "v1365_distribution_core"
down_revision: Union[str, None] = "v1364_party_item_snapshots"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    # 1. distribution_territories
    if "distribution_territories" not in tables:
        op.create_table(
            "distribution_territories",
            sa.Column("id", sa.String(50), primary_key=True),
            sa.Column("uuid", sa.String(36), server_default=sa.text("md5(random()::text || clock_timestamp()::text)::uuid::text"), nullable=False),
            sa.Column("company_id", sa.String(50), nullable=True),
            sa.Column("branch_id", sa.String(50), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
            sa.Column("modified_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
            sa.Column("created_by", sa.String(100), nullable=True),
            sa.Column("updated_by", sa.String(100), nullable=True),
            sa.Column("is_active", sa.Boolean, server_default="true", nullable=False),
            sa.Column("is_deleted", sa.Boolean, server_default="false", nullable=False),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("deleted_by", sa.String(100), nullable=True),
            sa.Column("version", sa.Integer, server_default="1", nullable=False),
            sa.Column("code", sa.String(50), nullable=False, unique=True),
            sa.Column("name", sa.String(100), nullable=False),
            sa.Column("region", sa.String(50), server_default="'WEST'", nullable=False),
            sa.Column("parent_territory_code", sa.String(50), nullable=True),
            sa.Column("status", sa.String(30), server_default="'ACTIVE'", nullable=False),
        )
        op.create_index("ix_distribution_territories_code", "distribution_territories", ["code"])

    # 2. dealer_assignments
    if "dealer_assignments" not in tables:
        op.create_table(
            "dealer_assignments",
            sa.Column("id", sa.String(50), primary_key=True),
            sa.Column("uuid", sa.String(36), server_default=sa.text("md5(random()::text || clock_timestamp()::text)::uuid::text"), nullable=False),
            sa.Column("company_id", sa.String(50), nullable=True),
            sa.Column("branch_id", sa.String(50), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
            sa.Column("modified_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
            sa.Column("created_by", sa.String(100), nullable=True),
            sa.Column("updated_by", sa.String(100), nullable=True),
            sa.Column("is_active", sa.Boolean, server_default="true", nullable=False),
            sa.Column("is_deleted", sa.Boolean, server_default="false", nullable=False),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("deleted_by", sa.String(100), nullable=True),
            sa.Column("version", sa.Integer, server_default="1", nullable=False),
            sa.Column("party_id", sa.String(50), sa.ForeignKey("parties.id", ondelete="CASCADE"), nullable=False),
            sa.Column("territory_code", sa.String(50), nullable=False),
            sa.Column("salesman_id", sa.String(50), nullable=True),
            sa.Column("credit_limit", sa.Numeric(15, 2), server_default="0.00", nullable=False),
            sa.Column("credit_days", sa.Integer, server_default="30", nullable=False),
            sa.UniqueConstraint("party_id", "territory_code", name="uq_dealer_territory_assignment")
        )
        op.create_index("ix_dealer_assignments_party_id", "dealer_assignments", ["party_id"])
        op.create_index("ix_dealer_assignments_territory_code", "dealer_assignments", ["territory_code"])

    # 3. distribution_orders
    if "distribution_orders" not in tables:
        op.create_table(
            "distribution_orders",
            sa.Column("id", sa.String(50), primary_key=True),
            sa.Column("uuid", sa.String(36), server_default=sa.text("md5(random()::text || clock_timestamp()::text)::uuid::text"), nullable=False),
            sa.Column("company_id", sa.String(50), nullable=True),
            sa.Column("branch_id", sa.String(50), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
            sa.Column("modified_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
            sa.Column("created_by", sa.String(100), nullable=True),
            sa.Column("updated_by", sa.String(100), nullable=True),
            sa.Column("is_active", sa.Boolean, server_default="true", nullable=False),
            sa.Column("is_deleted", sa.Boolean, server_default="false", nullable=False),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("deleted_by", sa.String(100), nullable=True),
            sa.Column("version", sa.Integer, server_default="1", nullable=False),
            sa.Column("order_no", sa.String(100), nullable=False, unique=True),
            sa.Column("party_id", sa.String(50), sa.ForeignKey("parties.id", ondelete="RESTRICT"), nullable=False),
            sa.Column("order_type", sa.String(30), server_default="'PRIMARY'", nullable=False),
            sa.Column("status", sa.String(30), server_default="'DRAFT'", nullable=False),
            sa.Column("territory_code", sa.String(50), nullable=True),
            sa.Column("salesman_id", sa.String(50), nullable=True),
            sa.Column("delivery_route", sa.String(100), nullable=True),
            sa.Column("delivery_challan_no", sa.String(100), nullable=True),
            sa.Column("taxable_amount", sa.Numeric(15, 2), server_default="0.00", nullable=False),
            sa.Column("tax_total", sa.Numeric(15, 2), server_default="0.00", nullable=False),
            sa.Column("grand_total", sa.Numeric(15, 2), server_default="0.00", nullable=False),
            sa.Column("governance_snapshot_id", sa.String(50), nullable=True),
            sa.Column("rule_snapshots", JSONB, server_default=sa.text("'{}'::jsonb"), nullable=False),
        )
        op.create_index("ix_distribution_orders_order_no", "distribution_orders", ["order_no"])
        op.create_index("ix_distribution_orders_party_id", "distribution_orders", ["party_id"])

    # 4. distribution_order_items
    if "distribution_order_items" not in tables:
        op.create_table(
            "distribution_order_items",
            sa.Column("id", sa.String(50), primary_key=True),
            sa.Column("uuid", sa.String(36), server_default=sa.text("md5(random()::text || clock_timestamp()::text)::uuid::text"), nullable=False),
            sa.Column("company_id", sa.String(50), nullable=True),
            sa.Column("branch_id", sa.String(50), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
            sa.Column("modified_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
            sa.Column("created_by", sa.String(100), nullable=True),
            sa.Column("updated_by", sa.String(100), nullable=True),
            sa.Column("is_active", sa.Boolean, server_default="true", nullable=False),
            sa.Column("is_deleted", sa.Boolean, server_default="false", nullable=False),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("deleted_by", sa.String(100), nullable=True),
            sa.Column("version", sa.Integer, server_default="1", nullable=False),
            sa.Column("order_id", sa.String(50), sa.ForeignKey("distribution_orders.id", ondelete="CASCADE"), nullable=False),
            sa.Column("item_id", sa.String(50), sa.ForeignKey("items.id", ondelete="RESTRICT"), nullable=False),
            sa.Column("variant_id", sa.String(50), sa.ForeignKey("item_variants.id", ondelete="SET NULL"), nullable=True),
            sa.Column("quantity", sa.Numeric(12, 4), server_default="1.0000", nullable=False),
            sa.Column("unit_price", sa.Numeric(15, 2), server_default="0.00", nullable=False),
            sa.Column("discount_amount", sa.Numeric(15, 2), server_default="0.00", nullable=False),
            sa.Column("tax_rate", sa.Numeric(5, 2), server_default="18.00", nullable=False),
            sa.Column("tax_amount", sa.Numeric(15, 2), server_default="0.00", nullable=False),
            sa.Column("line_total", sa.Numeric(15, 2), server_default="0.00", nullable=False),
        )
        op.create_index("ix_distribution_order_items_order_id", "distribution_order_items", ["order_id"])
        op.create_index("ix_distribution_order_items_item_id", "distribution_order_items", ["item_id"])


def downgrade():
    raise NotImplementedError(
        "v1365_distribution_core is a FORWARD-ONLY migration. "
        "Downgrade is blocked by SMRITI Data Governance Policy."
    )
