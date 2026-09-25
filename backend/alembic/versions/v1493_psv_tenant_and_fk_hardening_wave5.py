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
Classification: Database Migration — Wave 5 PSV Hardening
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "v1493_psv_tenant_and_fk_hardening_wave5"
down_revision: str | None = "v1492b_create_psv_stock_tables"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # -------------------------------------------------------------------------
    # 1. psv_stock_balances — Add company_id and product_id columns
    # -------------------------------------------------------------------------
    op.add_column(
        "psv_stock_balances",
        sa.Column("company_id", sa.String(length=50), nullable=True),
    )
    op.add_column(
        "psv_stock_balances",
        sa.Column("product_id", sa.String(length=50), nullable=True),
    )

    # Backfill company_id from company_code or companies table
    op.execute(
        sa.text(
            """
            UPDATE psv_stock_balances
            SET company_id = COALESCE(
                (SELECT id FROM companies
                 WHERE company_code = psv_stock_balances.company_code
                    OR id = psv_stock_balances.company_code
                 LIMIT 1),
                company_code
            )
            WHERE company_id IS NULL;
            """
        )
    )

    # Backfill product_id by SKU/code match against products table
    op.execute(
        sa.text(
            """
            UPDATE psv_stock_balances b
            SET product_id = p.id
            FROM products p
            WHERE b.product_id IS NULL AND (p.sku = b.sku OR p.code = b.sku);
            """
        )
    )

    # Create indexes and FKs on psv_stock_balances
    op.create_index(
        "idx_psv_balances_company_id",
        "psv_stock_balances",
        ["company_id"],
        unique=False,
    )
    op.create_index(
        "idx_psv_balances_product_id",
        "psv_stock_balances",
        ["product_id"],
        unique=False,
    )
    op.create_index(
        "idx_psv_balances_company_party_sku",
        "psv_stock_balances",
        ["company_id", "psv_party_id", "sku"],
        unique=False,
    )
    op.create_unique_constraint(
        "uq_psv_stock_balances_party_sku",
        "psv_stock_balances",
        ["company_code", "psv_party_id", "sku"],
    )
    op.create_foreign_key(
        "fk_psv_balances_company_id_restrict",
        "psv_stock_balances",
        "companies",
        ["company_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_foreign_key(
        "fk_psv_balances_product_id_restrict",
        "psv_stock_balances",
        "products",
        ["product_id"],
        ["id"],
        ondelete="RESTRICT",
    )

    # -------------------------------------------------------------------------
    # 2. psv_stock_events — Add company_id and product_id columns
    # -------------------------------------------------------------------------
    op.add_column(
        "psv_stock_events",
        sa.Column("company_id", sa.String(length=50), nullable=True),
    )
    op.add_column(
        "psv_stock_events",
        sa.Column("product_id", sa.String(length=50), nullable=True),
    )

    # Backfill company_id
    op.execute(
        sa.text(
            """
            UPDATE psv_stock_events
            SET company_id = COALESCE(
                (SELECT id FROM companies
                 WHERE company_code = psv_stock_events.company_code
                    OR id = psv_stock_events.company_code
                 LIMIT 1),
                company_code
            )
            WHERE company_id IS NULL;
            """
        )
    )

    # Backfill product_id
    op.execute(
        sa.text(
            """
            UPDATE psv_stock_events e
            SET product_id = p.id
            FROM products p
            WHERE e.product_id IS NULL AND (p.sku = e.sku OR p.code = e.sku);
            """
        )
    )

    # Create indexes and FKs on psv_stock_events
    op.create_index(
        "idx_psv_events_company_id",
        "psv_stock_events",
        ["company_id"],
        unique=False,
    )
    op.create_index(
        "idx_psv_events_product_id",
        "psv_stock_events",
        ["product_id"],
        unique=False,
    )
    op.create_index(
        "idx_psv_events_company_party_sku",
        "psv_stock_events",
        ["company_id", "psv_party_id", "sku"],
        unique=False,
    )
    op.create_foreign_key(
        "fk_psv_events_company_id_restrict",
        "psv_stock_events",
        "companies",
        ["company_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_foreign_key(
        "fk_psv_events_product_id_restrict",
        "psv_stock_events",
        "products",
        ["product_id"],
        ["id"],
        ondelete="RESTRICT",
    )


def downgrade() -> None:
    # -------------------------------------------------------------------------
    # Revert psv_stock_events
    # -------------------------------------------------------------------------
    op.drop_constraint("fk_psv_events_product_id_restrict", "psv_stock_events", type_="foreignkey")
    op.drop_constraint("fk_psv_events_company_id_restrict", "psv_stock_events", type_="foreignkey")
    op.drop_index("idx_psv_events_company_party_sku", table_name="psv_stock_events")
    op.drop_index("idx_psv_events_product_id", table_name="psv_stock_events")
    op.drop_index("idx_psv_events_company_id", table_name="psv_stock_events")
    op.drop_column("psv_stock_events", "product_id")
    op.drop_column("psv_stock_events", "company_id")

    # -------------------------------------------------------------------------
    # Revert psv_stock_balances
    # -------------------------------------------------------------------------
    op.drop_constraint("fk_psv_balances_product_id_restrict", "psv_stock_balances", type_="foreignkey")
    op.drop_constraint("fk_psv_balances_company_id_restrict", "psv_stock_balances", type_="foreignkey")
    op.drop_constraint("uq_psv_stock_balances_party_sku", "psv_stock_balances", type_="unique")
    op.drop_index("idx_psv_balances_company_party_sku", table_name="psv_stock_balances")
    op.drop_index("idx_psv_balances_product_id", table_name="psv_stock_balances")
    op.drop_index("idx_psv_balances_company_id", table_name="psv_stock_balances")
    op.drop_column("psv_stock_balances", "product_id")
    op.drop_column("psv_stock_balances", "company_id")
