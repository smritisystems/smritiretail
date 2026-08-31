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

FORWARD-ONLY MIGRATION -- Party/Item Convergence & Transaction Governance Snapshots (P1 Section 6)
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, ARRAY

revision: str = "v1364_party_item_snapshots"
down_revision: Union[str, None] = "v1363_governed_logic"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    # 1. parties
    if "parties" not in tables:
        op.create_table(
            "parties",
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
            sa.Column("party_code", sa.String(50), nullable=False, unique=True),
            sa.Column("party_type", sa.String(30), server_default="'ORGANIZATION'", nullable=False),
            sa.Column("legal_name", sa.String(255), nullable=False),
            sa.Column("trade_name", sa.String(255), nullable=True),
            sa.Column("gstin", sa.String(15), nullable=True),
            sa.Column("pan", sa.String(10), nullable=True),
            sa.Column("email", sa.String(255), nullable=True),
            sa.Column("phone", sa.String(20), nullable=True),
            sa.Column("mobile", sa.String(20), nullable=True),
            sa.Column("address_line1", sa.Text, nullable=True),
            sa.Column("address_line2", sa.Text, nullable=True),
            sa.Column("city", sa.String(100), nullable=True),
            sa.Column("state", sa.String(100), nullable=True),
            sa.Column("pincode", sa.String(10), nullable=True),
            sa.Column("country", sa.String(100), server_default="'India'", nullable=False),
            sa.Column("status", sa.String(30), server_default="'ACTIVE'", nullable=False),
            sa.Column("metadata_json", JSONB, server_default=sa.text("'{}'::jsonb"), nullable=False),
            sa.Column("tags", ARRAY(sa.String), server_default=sa.text("'{}'"), nullable=False),
        )
        op.create_index("ix_parties_party_code", "parties", ["party_code"])
        op.create_index("ix_parties_gstin", "parties", ["gstin"])
        op.create_index("ix_parties_pan", "parties", ["pan"])

    # 2. party_roles
    if "party_roles" not in tables:
        op.create_table(
            "party_roles",
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
            sa.Column("role_type", sa.String(30), nullable=False),
            sa.UniqueConstraint("party_id", "role_type", name="uq_party_role_type")
        )
        op.create_index("ix_party_roles_party_id", "party_roles", ["party_id"])

    # 3. customer_profiles
    if "customer_profiles" not in tables:
        op.create_table(
            "customer_profiles",
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
            sa.Column("party_id", sa.String(50), sa.ForeignKey("parties.id", ondelete="CASCADE"), nullable=False, unique=True),
            sa.Column("customer_group_id", sa.String(50), nullable=True),
            sa.Column("customer_category", sa.String(30), server_default="'RETAIL'", nullable=False),
            sa.Column("credit_limit", sa.Numeric(15, 2), server_default="0.00", nullable=False),
            sa.Column("credit_days", sa.Integer, server_default="0", nullable=False),
            sa.Column("tax_category", sa.String(30), server_default="'B2C'", nullable=False),
            sa.Column("is_credit_hold", sa.Boolean, server_default="false", nullable=False),
            sa.Column("price_tier_id", sa.String(50), nullable=True),
            sa.Column("loyalty_tier_id", sa.String(50), nullable=True),
            sa.Column("outstanding_balance", sa.Numeric(15, 2), server_default="0.00", nullable=False),
        )
        op.create_index("ix_customer_profiles_party_id", "customer_profiles", ["party_id"])

    # 4. supplier_profiles
    if "supplier_profiles" not in tables:
        op.create_table(
            "supplier_profiles",
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
            sa.Column("party_id", sa.String(50), sa.ForeignKey("parties.id", ondelete="CASCADE"), nullable=False, unique=True),
            sa.Column("supplier_type", sa.String(30), server_default="'DISTRIBUTOR'", nullable=False),
            sa.Column("payment_terms_days", sa.Integer, server_default="30", nullable=False),
            sa.Column("msme_registration_no", sa.String(50), nullable=True),
            sa.Column("tax_treatment", sa.String(30), server_default="'REGISTERED_REGULAR'", nullable=False),
            sa.Column("outstanding_liability", sa.Numeric(15, 2), server_default="0.00", nullable=False),
        )
        op.create_index("ix_supplier_profiles_party_id", "supplier_profiles", ["party_id"])

    # 5. items
    if "items" not in tables:
        op.create_table(
            "items",
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
            sa.Column("item_code", sa.String(50), nullable=False, unique=True),
            sa.Column("item_name", sa.String(255), nullable=False),
            sa.Column("category", sa.String(100), server_default="'GENERAL'", nullable=False),
            sa.Column("brand", sa.String(100), nullable=True),
            sa.Column("hsn_sac_code", sa.String(20), nullable=True),
            sa.Column("uom", sa.String(20), server_default="'NOS'", nullable=False),
            sa.Column("tax_rate", sa.Numeric(5, 2), server_default="18.00", nullable=False),
            sa.Column("mrp", sa.Numeric(15, 2), server_default="0.00", nullable=False),
            sa.Column("selling_price", sa.Numeric(15, 2), server_default="0.00", nullable=False),
            sa.Column("cost_price", sa.Numeric(15, 2), nullable=True),
            sa.Column("tracking_type", sa.String(30), server_default="'STANDARD'", nullable=False),
            sa.Column("status", sa.String(30), server_default="'ACTIVE'", nullable=False),
            sa.Column("metadata_json", JSONB, server_default=sa.text("'{}'::jsonb"), nullable=False),
        )
        op.create_index("ix_items_item_code", "items", ["item_code"])

    # 6. item_variants
    if "item_variants" not in tables:
        op.create_table(
            "item_variants",
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
            sa.Column("item_id", sa.String(50), sa.ForeignKey("items.id", ondelete="CASCADE"), nullable=False),
            sa.Column("variant_sku", sa.String(100), nullable=False, unique=True),
            sa.Column("variant_name", sa.String(255), nullable=False),
            sa.Column("color", sa.String(50), nullable=True),
            sa.Column("size", sa.String(50), nullable=True),
            sa.Column("material", sa.String(50), nullable=True),
            sa.Column("selling_price", sa.Numeric(15, 2), server_default="0.00", nullable=False),
            sa.Column("mrp", sa.Numeric(15, 2), server_default="0.00", nullable=False),
            sa.Column("is_default", sa.Boolean, server_default="false", nullable=False),
            sa.Column("status", sa.String(30), server_default="'ACTIVE'", nullable=False),
            sa.Column("metadata_json", JSONB, server_default=sa.text("'{}'::jsonb"), nullable=False),
        )
        op.create_index("ix_item_variants_item_id", "item_variants", ["item_id"])
        op.create_index("ix_item_variants_variant_sku", "item_variants", ["variant_sku"])

    # 7. item_barcodes
    if "item_barcodes" not in tables:
        op.create_table(
            "item_barcodes",
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
            sa.Column("item_id", sa.String(50), sa.ForeignKey("items.id", ondelete="CASCADE"), nullable=False),
            sa.Column("variant_id", sa.String(50), sa.ForeignKey("item_variants.id", ondelete="SET NULL"), nullable=True),
            sa.Column("barcode", sa.String(100), nullable=False, unique=True),
            sa.Column("barcode_type", sa.String(30), server_default="'EAN13'", nullable=False),
            sa.Column("is_primary", sa.Boolean, server_default="true", nullable=False),
        )
        op.create_index("ix_item_barcodes_item_id", "item_barcodes", ["item_id"])
        op.create_index("ix_item_barcodes_barcode", "item_barcodes", ["barcode"])

    # 8. price_books
    if "price_books" not in tables:
        op.create_table(
            "price_books",
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
            sa.Column("name", sa.String(200), nullable=False),
            sa.Column("code", sa.String(50), nullable=False, unique=True),
            sa.Column("currency", sa.String(10), server_default="'INR'", nullable=False),
            sa.Column("is_default", sa.Boolean, server_default="false", nullable=False),
            sa.Column("valid_from", sa.DateTime(timezone=True), nullable=True),
            sa.Column("valid_to", sa.DateTime(timezone=True), nullable=True),
            sa.Column("status", sa.String(30), server_default="'ACTIVE'", nullable=False),
            sa.Column("description", sa.Text, nullable=True),
        )
        op.create_index("ix_price_books_code", "price_books", ["code"])

    # 9. price_book_entries
    if "price_book_entries" not in tables:
        op.create_table(
            "price_book_entries",
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
            sa.Column("price_book_id", sa.String(50), sa.ForeignKey("price_books.id", ondelete="CASCADE"), nullable=False),
            sa.Column("item_id", sa.String(50), sa.ForeignKey("items.id", ondelete="CASCADE"), nullable=False),
            sa.Column("variant_id", sa.String(50), sa.ForeignKey("item_variants.id", ondelete="CASCADE"), nullable=True),
            sa.Column("min_quantity", sa.Numeric(12, 4), server_default="1.0000", nullable=False),
            sa.Column("selling_price", sa.Numeric(15, 2), nullable=False),
            sa.Column("mrp", sa.Numeric(15, 2), nullable=False),
            sa.Column("cost_price", sa.Numeric(15, 2), nullable=True),
            sa.UniqueConstraint("price_book_id", "item_id", "variant_id", "min_quantity", name="uq_pbe_matrix")
        )
        op.create_index("ix_price_book_entries_price_book_id", "price_book_entries", ["price_book_id"])
        op.create_index("ix_price_book_entries_item_id", "price_book_entries", ["item_id"])

    # 10. customer_price_tiers
    if "customer_price_tiers" not in tables:
        op.create_table(
            "customer_price_tiers",
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
            sa.Column("name", sa.String(100), nullable=False),
            sa.Column("code", sa.String(50), nullable=False, unique=True),
            sa.Column("price_book_id", sa.String(50), sa.ForeignKey("price_books.id", ondelete="SET NULL"), nullable=True),
            sa.Column("discount_percentage", sa.Numeric(5, 2), server_default="0.00", nullable=False),
            sa.Column("description", sa.Text, nullable=True),
        )
        op.create_index("ix_customer_price_tiers_code", "customer_price_tiers", ["code"])

    # 11. Update sales_invoices with party_id, governance_snapshot_id, and rule_snapshots
    if "sales_invoices" in tables:
        cols = {c["name"] for c in inspector.get_columns("sales_invoices")}
        if "party_id" not in cols:
            op.add_column("sales_invoices", sa.Column("party_id", sa.String(50), nullable=True))
            op.create_index("ix_sales_invoices_party_id", "sales_invoices", ["party_id"])
        if "governance_snapshot_id" not in cols:
            op.add_column("sales_invoices", sa.Column("governance_snapshot_id", sa.String(50), nullable=True))
        if "rule_snapshots" not in cols:
            op.add_column("sales_invoices", sa.Column("rule_snapshots", JSONB, server_default=sa.text("'{}'::jsonb"), nullable=False))

    # 12. Update purchase_orders with party_id, governance_snapshot_id, and rule_snapshots
    if "purchase_orders" in tables:
        cols = {c["name"] for c in inspector.get_columns("purchase_orders")}
        if "party_id" not in cols:
            op.add_column("purchase_orders", sa.Column("party_id", sa.String(50), nullable=True))
            op.create_index("ix_purchase_orders_party_id", "purchase_orders", ["party_id"])
        if "governance_snapshot_id" not in cols:
            op.add_column("purchase_orders", sa.Column("governance_snapshot_id", sa.String(50), nullable=True))
        if "rule_snapshots" not in cols:
            op.add_column("purchase_orders", sa.Column("rule_snapshots", JSONB, server_default=sa.text("'{}'::jsonb"), nullable=False))


def downgrade():
    raise NotImplementedError(
        "v1364_party_item_snapshots is a FORWARD-ONLY migration. "
        "Downgrade is blocked by SMRITI Data Governance Policy."
    )
