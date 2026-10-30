"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders

* Pushpa Devi Jawahar Mallah
  * Founder & Chairperson
  * Phone: +91 9324117007
  * Email: founder@aitdl.com

* Jawahar Ramkripal Mallah
  * Founder, Chief Executive Officer (CEO) & Chief Software Architect
  * Email: founder@aitdl.com

* Websites: aitdl.com | erpnbook.com | smritibooks.com

* Version    : 6.47.4
* Created    : 2026-10-01
* Modified   : 2026-10-01
* Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software
Classification: Internal

v1514 — Add uq_purchase_bills_company_bill_no unique constraint & purchase_bill_items table.
Revision ID: v1514_purchase_bills_hardening
Revises: v1513_purchase_bills_table
"""

import uuid
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "v1514_purchase_bills_hardening"
down_revision: Union[str, Sequence[str], None] = "v1513_purchase_bills_table"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = set(inspector.get_table_names())

    # 1. Add Unique Constraint on purchase_bills(company_id, bill_no)
    if "purchase_bills" in tables:
        existing_cons = {c["name"] for c in inspector.get_unique_constraints("purchase_bills")}
        if "uq_purchase_bills_company_bill_no" not in existing_cons:
            op.create_unique_constraint(
                "uq_purchase_bills_company_bill_no",
                "purchase_bills",
                ["company_id", "bill_no"]
            )

    # 2. Create purchase_bill_items table
    if "purchase_bill_items" not in tables:
        op.create_table(
            "purchase_bill_items",
            sa.Column("id", sa.String(50), primary_key=True),
            sa.Column("uuid", sa.String(36), nullable=False, unique=True, default=lambda: str(uuid.uuid4())),
            sa.Column("company_id", sa.String(50), sa.ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True),
            sa.Column("branch_id", sa.String(50), sa.ForeignKey("branches.id", ondelete="RESTRICT"), nullable=True, index=True),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false"), index=True),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("modified_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("created_by", sa.String(100), nullable=True),
            sa.Column("updated_by", sa.String(100), nullable=True),
            sa.Column("deleted_by", sa.String(100), nullable=True),

            # Domain fields
            sa.Column("bill_id", sa.String(50), sa.ForeignKey("purchase_bills.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("product_id", sa.String(50), sa.ForeignKey("products.id", ondelete="RESTRICT"), nullable=False, index=True),
            sa.Column("item_id", sa.String(50), sa.ForeignKey("items.id", ondelete="SET NULL"), nullable=True, index=True),
            sa.Column("variant_id", sa.String(50), nullable=True, index=True),
            sa.Column("po_item_id", sa.String(50), sa.ForeignKey("purchase_order_items.id", ondelete="SET NULL"), nullable=True, index=True),
            sa.Column("receipt_item_id", sa.String(50), sa.ForeignKey("purchase_receipt_items.id", ondelete="SET NULL"), nullable=True, index=True),
            sa.Column("code", sa.String(50), nullable=False),
            sa.Column("name", sa.String(255), nullable=False),
            sa.Column("quantity", sa.Numeric(12, 4), nullable=False, server_default="0.0000"),
            sa.Column("rate", sa.Numeric(15, 4), nullable=False, server_default="0.0000"),
            sa.Column("taxable_amount", sa.Numeric(15, 2), nullable=False, server_default="0.00"),
            sa.Column("tax_amount", sa.Numeric(15, 2), nullable=False, server_default="0.00"),
            sa.Column("total_amount", sa.Numeric(15, 2), nullable=False, server_default="0.00"),
        )
        op.create_index(
            "ix_purchase_bill_items_bill_product",
            "purchase_bill_items",
            ["bill_id", "product_id"]
        )


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = set(inspector.get_table_names())

    if "purchase_bill_items" in tables:
        op.drop_table("purchase_bill_items")

    if "purchase_bills" in tables:
        existing_cons = {c["name"] for c in inspector.get_unique_constraints("purchase_bills")}
        if "uq_purchase_bills_company_bill_no" in existing_cons:
            op.drop_constraint("uq_purchase_bills_company_bill_no", "purchase_bills", type_="unique")
