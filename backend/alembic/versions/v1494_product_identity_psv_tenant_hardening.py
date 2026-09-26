"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-09-25
Modified     : 2026-09-25
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Database Migration — Product Identity & PSV Tenant Hardening
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "v1494_product_identity_psv_tenant_hardening"
down_revision: str | None = "v1493_psv_tenant_and_fk_hardening_wave5"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()

    # -------------------------------------------------------------------------
    # 1. Remediate duplicate unreferenced test items from 2026-09-12
    # -------------------------------------------------------------------------
    bind.execute(
        sa.text(
            """
            UPDATE items 
            SET is_deleted = true, deleted_at = NOW(), deleted_by = 'migration_v1494'
            WHERE id = 'itm_8e5e3af6d51a' AND item_code = 'IMMUTABLE-86A1E8' AND company_id IS NULL;
            """
        )
    )
    bind.execute(
        sa.text(
            """
            UPDATE item_variants 
            SET is_deleted = true, deleted_at = NOW(), deleted_by = 'migration_v1494'
            WHERE id = 'var_7bd86419ab20' AND variant_sku = 'IMMUTABLE-86A1E8-STD' AND company_id IS NULL;
            """
        )
    )
    bind.execute(
        sa.text(
            """
            UPDATE item_barcodes 
            SET is_deleted = true, deleted_at = NOW(), deleted_by = 'migration_v1494'
            WHERE id = 'bc_1f68781bd2bc' AND barcode = 'IMMUTABLE-86A1E8' AND company_id IS NULL;
            """
        )
    )

    # -------------------------------------------------------------------------
    # 2. PSV Stock Balances: Compound Tenant Uniqueness
    # -------------------------------------------------------------------------
    # Enforces tenant-authoritative uniqueness per (company_id, psv_party_id, sku)
    op.create_index(
        "uq_psv_stock_balances_company_party_sku",
        "psv_stock_balances",
        ["company_id", "psv_party_id", "sku"],
        unique=True,
        postgresql_where=sa.text("company_id IS NOT NULL"),
    )

    # -------------------------------------------------------------------------
    # 3. Item Barcodes: Normalized & Primary Fast-Lookup Indexes
    # -------------------------------------------------------------------------
    op.create_index(
        "ix_item_barcodes_company_normalized",
        "item_barcodes",
        ["company_id", "barcode_normalized"],
        unique=False,
        postgresql_where=sa.text("barcode_normalized IS NOT NULL AND is_deleted = false"),
    )
    op.create_index(
        "ix_item_barcodes_company_primary",
        "item_barcodes",
        ["company_id", "variant_id"],
        unique=False,
        postgresql_where=sa.text("is_primary = true AND is_deleted = false"),
    )

    # -------------------------------------------------------------------------
    # 4. Line Items: Variant Lookups for Stock & Billing
    # Note: sales_invoice_items inherits tenant scoping from sales_invoices via invoice_id (ADR-DB-006)
    # -------------------------------------------------------------------------
    op.create_index(
        "ix_sales_invoice_items_variant",
        "sales_invoice_items",
        ["variant_id"],
        unique=False,
        postgresql_where=sa.text("variant_id IS NOT NULL"),
    )
    op.create_index(
        "ix_purchase_order_items_company_variant",
        "purchase_order_items",
        ["company_id", "variant_id"],
        unique=False,
        postgresql_where=sa.text("variant_id IS NOT NULL"),
    )


def downgrade() -> None:
    bind = op.get_bind()

    # Revert line item indexes
    op.drop_index("ix_purchase_order_items_company_variant", table_name="purchase_order_items")
    op.drop_index("ix_sales_invoice_items_variant", table_name="sales_invoice_items")

    # Revert item barcodes indexes
    op.drop_index("ix_item_barcodes_company_primary", table_name="item_barcodes")
    op.drop_index("ix_item_barcodes_company_normalized", table_name="item_barcodes")

    # Revert PSV compound unique index
    op.drop_index("uq_psv_stock_balances_company_party_sku", table_name="psv_stock_balances")

    # Restore unreferenced test items
    bind.execute(
        sa.text(
            """
            UPDATE items 
            SET is_deleted = false, deleted_at = NULL, deleted_by = NULL
            WHERE id = 'itm_8e5e3af6d51a';
            """
        )
    )
    bind.execute(
        sa.text(
            """
            UPDATE item_variants 
            SET is_deleted = false, deleted_at = NULL, deleted_by = NULL
            WHERE id = 'var_7bd86419ab20';
            """
        )
    )
    bind.execute(
        sa.text(
            """
            UPDATE item_barcodes 
            SET is_deleted = false, deleted_at = NULL, deleted_by = NULL
            WHERE id = 'bc_1f68781bd2bc';
            """
        )
    )
