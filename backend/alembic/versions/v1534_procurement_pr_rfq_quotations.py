"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders
* Pushpa Devi Jawahar Mallah
  * Founder & Chairperson
* Jawahar Ramkripal Mallah
  * Founder, Chief Executive Officer (CEO) & Chief Software Architect

Websites: aitdl.com | erpnbook.com | smritibooks.com

Revision ID: v1534_procurement_pr_rfq_quotations
Revises: v1533_attendance_weekly_off_and_wage_statements
Create Date: 2026-10-16
Classification: Procurement Phase 2 — PR, RFQ & Quotation Comparison
"""

from collections.abc import Sequence
import sqlalchemy as sa
from alembic import op

revision: str = "v1534_procurement_pr_rfq_quotations"
down_revision: str | Sequence[str] | None = "v1533_attendance_weekly_off_and_wage_statements"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. purchase_requisitions
    op.create_table(
        "purchase_requisitions",
        sa.Column("id", sa.String(50), primary_key=True),
        sa.Column("uuid", sa.String(36), nullable=False, unique=True),
        sa.Column("company_id", sa.String(50), sa.ForeignKey("companies.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("branch_id", sa.String(50), sa.ForeignKey("branches.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("requisition_no", sa.String(100), nullable=False, index=True),
        sa.Column("requisition_date", sa.Date(), nullable=False),
        sa.Column("required_by_date", sa.Date(), nullable=False),
        sa.Column("department", sa.String(100), nullable=True),
        sa.Column("priority", sa.String(20), nullable=False, server_default="NORMAL"),
        sa.Column("status", sa.String(30), nullable=False, server_default="DRAFT", index=True),
        sa.Column("justification", sa.Text(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("estimated_total", sa.Numeric(15, 2), nullable=False, server_default="0.00"),
        sa.Column("approved_total", sa.Numeric(15, 2), nullable=False, server_default="0.00"),
        sa.Column("submitted_by", sa.String(100), nullable=True),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("approved_by", sa.String(100), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("rejected_by", sa.String(100), nullable=True),
        sa.Column("rejected_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("rejection_reason", sa.Text(), nullable=True),
        sa.Column("cancelled_by", sa.String(100), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancellation_reason", sa.Text(), nullable=True),
        sa.Column("po_id", sa.String(50), sa.ForeignKey("purchase_orders.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("po_no", sa.String(100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("modified_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("created_by", sa.String(100), nullable=True),
        sa.Column("updated_by", sa.String(100), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", sa.String(100), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.UniqueConstraint("requisition_no", "company_id", name="uq_purchase_requisitions_no_company"),
    )

    # 2. purchase_requisition_items
    op.create_table(
        "purchase_requisition_items",
        sa.Column("id", sa.String(50), primary_key=True),
        sa.Column("uuid", sa.String(36), nullable=False, unique=True),
        sa.Column("company_id", sa.String(50), sa.ForeignKey("companies.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("branch_id", sa.String(50), sa.ForeignKey("branches.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("requisition_id", sa.String(50), sa.ForeignKey("purchase_requisitions.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("product_id", sa.String(50), sa.ForeignKey("products.id", ondelete="RESTRICT"), nullable=False, index=True),
        sa.Column("item_id", sa.String(50), sa.ForeignKey("items.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("variant_id", sa.String(50), nullable=True, index=True),
        sa.Column("code", sa.String(50), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("quantity_requested", sa.Numeric(12, 4), nullable=False),
        sa.Column("quantity_approved", sa.Numeric(12, 4), nullable=False, server_default="0.0000"),
        sa.Column("quantity_ordered", sa.Numeric(12, 4), nullable=False, server_default="0.0000"),
        sa.Column("estimated_cost", sa.Numeric(15, 2), nullable=False, server_default="0.00"),
        sa.Column("line_total", sa.Numeric(15, 2), nullable=False, server_default="0.00"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("modified_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("created_by", sa.String(100), nullable=True),
        sa.Column("updated_by", sa.String(100), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", sa.String(100), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
    )

    # 3. supplier_rfqs
    op.create_table(
        "supplier_rfqs",
        sa.Column("id", sa.String(50), primary_key=True),
        sa.Column("uuid", sa.String(36), nullable=False, unique=True),
        sa.Column("company_id", sa.String(50), sa.ForeignKey("companies.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("branch_id", sa.String(50), sa.ForeignKey("branches.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("rfq_no", sa.String(100), nullable=False, index=True),
        sa.Column("rfq_date", sa.Date(), nullable=False),
        sa.Column("due_date", sa.Date(), nullable=False),
        sa.Column("requisition_id", sa.String(50), sa.ForeignKey("purchase_requisitions.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("status", sa.String(30), nullable=False, server_default="DRAFT", index=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("terms_conditions", sa.Text(), nullable=True),
        sa.Column("awarded_quotation_id", sa.String(50), nullable=True),
        sa.Column("awarded_supplier_id", sa.String(50), sa.ForeignKey("suppliers.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("awarded_notes", sa.Text(), nullable=True),
        sa.Column("awarded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("awarded_by", sa.String(100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("modified_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("created_by", sa.String(100), nullable=True),
        sa.Column("updated_by", sa.String(100), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", sa.String(100), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.UniqueConstraint("rfq_no", "company_id", name="uq_supplier_rfqs_no_company"),
    )

    # 4. supplier_rfq_items
    op.create_table(
        "supplier_rfq_items",
        sa.Column("id", sa.String(50), primary_key=True),
        sa.Column("uuid", sa.String(36), nullable=False, unique=True),
        sa.Column("company_id", sa.String(50), sa.ForeignKey("companies.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("branch_id", sa.String(50), sa.ForeignKey("branches.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("rfq_id", sa.String(50), sa.ForeignKey("supplier_rfqs.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("product_id", sa.String(50), sa.ForeignKey("products.id", ondelete="RESTRICT"), nullable=False, index=True),
        sa.Column("item_id", sa.String(50), sa.ForeignKey("items.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("variant_id", sa.String(50), nullable=True, index=True),
        sa.Column("code", sa.String(50), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("target_quantity", sa.Numeric(12, 4), nullable=False),
        sa.Column("target_cost", sa.Numeric(15, 2), nullable=True),
        sa.Column("specifications", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("modified_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("created_by", sa.String(100), nullable=True),
        sa.Column("updated_by", sa.String(100), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", sa.String(100), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
    )

    # 5. supplier_quotations
    op.create_table(
        "supplier_quotations",
        sa.Column("id", sa.String(50), primary_key=True),
        sa.Column("uuid", sa.String(36), nullable=False, unique=True),
        sa.Column("company_id", sa.String(50), sa.ForeignKey("companies.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("branch_id", sa.String(50), sa.ForeignKey("branches.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("quotation_no", sa.String(100), nullable=False, index=True),
        sa.Column("rfq_id", sa.String(50), sa.ForeignKey("supplier_rfqs.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("supplier_id", sa.String(50), sa.ForeignKey("suppliers.id", ondelete="RESTRICT"), nullable=False, index=True),
        sa.Column("quotation_date", sa.Date(), nullable=False),
        sa.Column("valid_until", sa.Date(), nullable=False),
        sa.Column("status", sa.String(30), nullable=False, server_default="RECEIVED", index=True),
        sa.Column("payment_terms", sa.String(255), nullable=True),
        sa.Column("delivery_timeline", sa.String(255), nullable=True),
        sa.Column("subtotal", sa.Numeric(15, 2), nullable=False, server_default="0.00"),
        sa.Column("tax_total", sa.Numeric(15, 2), nullable=False, server_default="0.00"),
        sa.Column("freight_charges", sa.Numeric(15, 2), nullable=False, server_default="0.00"),
        sa.Column("other_charges", sa.Numeric(15, 2), nullable=False, server_default="0.00"),
        sa.Column("total_landed_cost", sa.Numeric(15, 2), nullable=False, server_default="0.00"),
        sa.Column("rank", sa.Integer(), nullable=True),
        sa.Column("evaluation_score", sa.Numeric(5, 2), nullable=True),
        sa.Column("evaluation_notes", sa.Text(), nullable=True),
        sa.Column("selection_justification", sa.Text(), nullable=True),
        sa.Column("selected_by", sa.String(100), nullable=True),
        sa.Column("selected_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("po_id", sa.String(50), sa.ForeignKey("purchase_orders.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("po_no", sa.String(100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("modified_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("created_by", sa.String(100), nullable=True),
        sa.Column("updated_by", sa.String(100), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", sa.String(100), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.UniqueConstraint("quotation_no", "supplier_id", "company_id", name="uq_supplier_quotations_no_supplier_company"),
    )

    # 6. supplier_quotation_items
    op.create_table(
        "supplier_quotation_items",
        sa.Column("id", sa.String(50), primary_key=True),
        sa.Column("uuid", sa.String(36), nullable=False, unique=True),
        sa.Column("company_id", sa.String(50), sa.ForeignKey("companies.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("branch_id", sa.String(50), sa.ForeignKey("branches.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("quotation_id", sa.String(50), sa.ForeignKey("supplier_quotations.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("rfq_item_id", sa.String(50), sa.ForeignKey("supplier_rfq_items.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("product_id", sa.String(50), sa.ForeignKey("products.id", ondelete="RESTRICT"), nullable=False, index=True),
        sa.Column("item_id", sa.String(50), sa.ForeignKey("items.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("variant_id", sa.String(50), nullable=True, index=True),
        sa.Column("code", sa.String(50), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("quoted_quantity", sa.Numeric(12, 4), nullable=False),
        sa.Column("unit_price", sa.Numeric(15, 2), nullable=False),
        sa.Column("discount_percent", sa.Numeric(5, 2), nullable=False, server_default="0.00"),
        sa.Column("discount_amount", sa.Numeric(15, 2), nullable=False, server_default="0.00"),
        sa.Column("tax_rate", sa.Numeric(5, 2), nullable=False, server_default="18.00"),
        sa.Column("tax_amount", sa.Numeric(15, 2), nullable=False, server_default="0.00"),
        sa.Column("freight_allocation", sa.Numeric(15, 2), nullable=False, server_default="0.00"),
        sa.Column("net_landed_cost_per_unit", sa.Numeric(15, 2), nullable=False, server_default="0.00"),
        sa.Column("line_total", sa.Numeric(15, 2), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("modified_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("created_by", sa.String(100), nullable=True),
        sa.Column("updated_by", sa.String(100), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", sa.String(100), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
    )


def downgrade() -> None:
    op.drop_table("supplier_quotation_items")
    op.drop_table("supplier_quotations")
    op.drop_table("supplier_rfq_items")
    op.drop_table("supplier_rfqs")
    op.drop_table("purchase_requisition_items")
    op.drop_table("purchase_requisitions")
