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

v1513 — Add purchase_bills table for Universal Lifecycle Framework Phase 2.
Revision ID: v1513_purchase_bills_table
Revises: v1512_po_amendment_audit
"""

import uuid
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "v1513_purchase_bills_table"
down_revision: Union[str, Sequence[str], None] = "v1512_po_amendment_audit"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = set(inspector.get_table_names())

    if "purchase_bills" not in tables:
        op.create_table(
            "purchase_bills",
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
            sa.Column("bill_no", sa.String(100), nullable=False, index=True),
            sa.Column("identity_code", sa.String(100), nullable=True, unique=True, index=True),
            sa.Column("supplier_id", sa.String(50), sa.ForeignKey("suppliers.id", ondelete="RESTRICT"), nullable=False, index=True),
            sa.Column("receipt_id", sa.String(50), sa.ForeignKey("purchase_receipts.id", ondelete="SET NULL"), nullable=True, index=True),
            sa.Column("order_id", sa.String(50), sa.ForeignKey("purchase_orders.id", ondelete="SET NULL"), nullable=True, index=True),
            sa.Column("bill_date", sa.Date(), nullable=True),
            sa.Column("due_date", sa.Date(), nullable=True),
            sa.Column("status", sa.String(30), nullable=False, server_default="DRAFT", index=True),
            sa.Column("taxable_amount", sa.Numeric(15, 2), nullable=False, server_default="0.00"),
            sa.Column("tax_amount", sa.Numeric(15, 2), nullable=False, server_default="0.00"),
            sa.Column("total_amount", sa.Numeric(15, 2), nullable=False, server_default="0.00"),
            sa.Column("paid_amount", sa.Numeric(15, 2), nullable=False, server_default="0.00"),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("cancellation_reason", sa.Text(), nullable=True),
        )
        op.create_index(
            "ix_purchase_bills_company_bill_no",
            "purchase_bills",
            ["company_id", "bill_no"],
        )


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if "purchase_bills" in inspector.get_table_names():
        op.drop_table("purchase_bills")
