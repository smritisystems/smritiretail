"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.42.0
Created      : 2026-09-19
Modified     : 2026-09-19
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Core Architecture

Revision ID: v1473_scope_purchase_order_unique_constraint
Revises: v1472_backfill_canonical_codes
Create Date: 2026-09-19 10:55:00.000000

Governance Standard: AGENTS.md Rules 1-12, UADHP-v1.0
Scope of Migration:
  - Drops global unique constraint purchase_orders_order_no_key on purchase_orders.order_no.
  - Adds composite unique constraint uq_purchase_orders_order_no_company on purchase_orders (order_no, company_id).
  - Ensures multi-tenant isolation so identical PO numbers in different companies or tenants do not collide.
  - Fully idempotent execution across PostgreSQL tenant databases.
"""

from alembic import op
import sqlalchemy as sa

revision = "v1473_scope_purchase_order_unique_constraint"
down_revision = "v1472_backfill_canonical_codes"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    insp = sa.inspect(bind)

    if not insp.has_table("purchase_orders"):
        return

    # Check unique constraints
    uqs = [c["name"] for c in insp.get_unique_constraints("purchase_orders") if c.get("name")]
    if "purchase_orders_order_no_key" in uqs:
        op.drop_constraint("purchase_orders_order_no_key", "purchase_orders", type_="unique")

    # Check indexes
    indexes = [idx["name"] for idx in insp.get_indexes("purchase_orders") if idx.get("name")]
    if "purchase_orders_order_no_key" in indexes:
        op.drop_index("purchase_orders_order_no_key", table_name="purchase_orders")

    # Create composite unique constraint if not already present
    if "uq_purchase_orders_order_no_company" not in uqs:
        op.create_unique_constraint(
            "uq_purchase_orders_order_no_company",
            "purchase_orders",
            ["order_no", "company_id"],
        )


def downgrade():
    bind = op.get_bind()
    insp = sa.inspect(bind)

    if not insp.has_table("purchase_orders"):
        return

    uqs = [c["name"] for c in insp.get_unique_constraints("purchase_orders") if c.get("name")]
    if "uq_purchase_orders_order_no_company" in uqs:
        op.drop_constraint("uq_purchase_orders_order_no_company", "purchase_orders", type_="unique")

    if "purchase_orders_order_no_key" not in uqs:
        op.create_unique_constraint(
            "purchase_orders_order_no_key",
            "purchase_orders",
            ["order_no"],
        )
