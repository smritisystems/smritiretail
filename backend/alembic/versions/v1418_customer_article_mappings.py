"""Add customer_article_mappings table for enterprise buyer catalog cross-referencing.

Revision ID: v1418_cust_art_map
Revises: v1417_so_po_compat
Create Date: 2026-09-09
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "v1418_cust_art_map"
down_revision: Union[str, Sequence[str], None] = "v1417_so_po_compat"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()

    # 1. Company DB routing guard — NEVER execute on smritisys Control Plane or system DBs
    current_db = bind.execute(sa.text("SELECT current_database();")).scalar()
    if not current_db or current_db.lower() in ("smritisys", "postgres", "template0", "template1"):
        return

    inspector = sa.inspect(bind)
    table_names = inspector.get_table_names()

    # 2. Idempotent table creation
    if "customer_article_mappings" not in table_names:
        op.create_table(
            "customer_article_mappings",
            sa.Column("id", sa.String(50), primary_key=True),
            sa.Column("uuid", sa.String(36), nullable=False),
            sa.Column("company_id", sa.String(50), nullable=True),
            sa.Column("branch_id", sa.String(50), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=True),
            sa.Column("modified_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_by", sa.String(100), nullable=True),
            sa.Column("updated_by", sa.String(100), nullable=True),
            sa.Column("is_active", sa.Boolean(), server_default="true", nullable=True),
            sa.Column("is_deleted", sa.Boolean(), server_default="false", nullable=True),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("deleted_by", sa.String(100), nullable=True),
            sa.Column("version", sa.Integer(), server_default="1", nullable=True),

            sa.Column("customer_id", sa.String(50), sa.ForeignKey("customers.id", ondelete="RESTRICT"), nullable=False),
            sa.Column("item_id", sa.String(50), sa.ForeignKey("items.id", ondelete="RESTRICT"), nullable=False),
            sa.Column("variant_id", sa.String(50), sa.ForeignKey("item_variants.id", ondelete="RESTRICT"), nullable=False),
            sa.Column("barcode_id", sa.String(50), sa.ForeignKey("item_barcodes.id", ondelete="SET NULL"), nullable=True),

            sa.Column("customer_article", sa.String(100), nullable=False),
            sa.Column("vendor_article", sa.String(100), nullable=False),
            sa.Column("color", sa.String(50), nullable=False),
            sa.Column("size", sa.String(20), nullable=False),
            sa.Column("barcode", sa.String(50), nullable=False),

            sa.Column("customer_style_description", sa.String(255), nullable=True),
            sa.Column("buyer_division", sa.String(100), nullable=True),
            sa.Column("buyer_hsn", sa.String(15), nullable=True),

            sa.Column("currency", sa.String(3), server_default="INR", nullable=False),
            sa.Column("base_mrp", sa.Numeric(15, 2), server_default="0.00", nullable=False),
            sa.Column("contract_discount_pct", sa.Numeric(7, 4), nullable=True),
            sa.Column("contract_rate", sa.Numeric(15, 2), nullable=True),

            sa.Column("effective_from", sa.Date(), server_default=sa.text("CURRENT_DATE"), nullable=False),
            sa.Column("effective_to", sa.Date(), nullable=True),
            sa.Column("status", sa.String(30), server_default="ACTIVE", nullable=False),

            sa.Column("source_system", sa.String(50), server_default="EXCEL_IMPORT", nullable=False),
            sa.Column("source_reference", sa.String(100), nullable=True),
            sa.Column("verification_status", sa.String(30), server_default="VERIFIED", nullable=False),
            sa.Column("verified_by", sa.String(100), nullable=True),
            sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("metadata_json", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
        )

    # 3. Ensure indexes and partial unique constraints exist
    indexes = {idx["name"] for idx in inspector.get_indexes("customer_article_mappings")} if "customer_article_mappings" in table_names or "customer_article_mappings" in inspector.get_table_names() else set()

    if "uq_cam_customer_article_active" not in indexes:
        op.create_index(
            "uq_cam_customer_article_active",
            "customer_article_mappings",
            ["company_id", "customer_id", "customer_article"],
            unique=True,
            postgresql_where=sa.text("is_active = true AND is_deleted = false")
        )

    if "uq_cam_customer_variant_active" not in indexes:
        op.create_index(
            "uq_cam_customer_variant_active",
            "customer_article_mappings",
            ["company_id", "customer_id", "variant_id"],
            unique=True,
            postgresql_where=sa.text("is_active = true AND is_deleted = false")
        )

    if "ix_cam_lookup" not in indexes:
        op.create_index(
            "ix_cam_lookup",
            "customer_article_mappings",
            ["company_id", "customer_id", "customer_article"]
        )

    if "ix_cam_barcode" not in indexes:
        op.create_index(
            "ix_cam_barcode",
            "customer_article_mappings",
            ["company_id", "barcode"]
        )

    if "ix_cam_vendor_article" not in indexes:
        op.create_index(
            "ix_cam_vendor_article",
            "customer_article_mappings",
            ["company_id", "vendor_article"]
        )


def downgrade() -> None:
    bind = op.get_bind()
    current_db = bind.execute(sa.text("SELECT current_database();")).scalar()
    if not current_db or current_db.lower() in ("smritisys", "postgres", "template0", "template1"):
        return

    op.drop_table("customer_article_mappings")
