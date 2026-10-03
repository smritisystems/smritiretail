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

* Version    : 6.48.2
* Created    : 2026-10-01
* Modified   : 2026-10-01
* Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software
Classification: Internal

v1515 — Sales Schema & Multi-Tenant Hardening (Phase S1).
- Scopes sales document uniqueness to (company_id, doc_no).
- Elevates line items to BaseEntity parity (uuid, tenant, version, audit).
Revision ID: v1515_sales_schema_tenant_hardening
Revises: v1514_purchase_bills_hardening
"""

import uuid
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "v1515_sales_schema_tenant_hardening"
down_revision: Union[str, Sequence[str], None] = "v1514_purchase_bills_hardening"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = set(inspector.get_table_names())

    # =========================================================================
    # PART 1: Unique Constraints / Indexes Scoping to (company_id, doc_no)
    # =========================================================================

    # 1. sales_orders
    if "sales_orders" in tables:
        so_uqs = {c["name"] for c in inspector.get_unique_constraints("sales_orders")}
        if "sales_orders_order_no_key" in so_uqs:
            op.drop_constraint("sales_orders_order_no_key", "sales_orders", type_="unique")
        if "uq_sales_orders_company_order_no" not in so_uqs:
            op.create_unique_constraint(
                "uq_sales_orders_company_order_no",
                "sales_orders",
                ["company_id", "order_no"]
            )

    # 2. sales_invoices
    if "sales_invoices" in tables:
        si_uqs = {c["name"] for c in inspector.get_unique_constraints("sales_invoices")}
        if "sales_invoices_invoice_no_key" in si_uqs:
            op.drop_constraint("sales_invoices_invoice_no_key", "sales_invoices", type_="unique")
        if "uq_sales_invoices_company_invoice_no" not in si_uqs:
            op.create_unique_constraint(
                "uq_sales_invoices_company_invoice_no",
                "sales_invoices",
                ["company_id", "invoice_no"]
            )

    # 3. sales_quotations
    if "sales_quotations" in tables:
        sq_uqs = {c["name"] for c in inspector.get_unique_constraints("sales_quotations")}
        if "sales_quotations_quotation_no_key" in sq_uqs:
            op.drop_constraint("sales_quotations_quotation_no_key", "sales_quotations", type_="unique")
        if "uq_sales_quotations_company_quotation_no" not in sq_uqs:
            op.create_unique_constraint(
                "uq_sales_quotations_company_quotation_no",
                "sales_quotations",
                ["company_id", "quotation_no"]
            )

    # 4. sales_returns
    if "sales_returns" in tables:
        sr_uqs = {c["name"] for c in inspector.get_unique_constraints("sales_returns")}
        if "sales_returns_return_no_key" in sr_uqs:
            op.drop_constraint("sales_returns_return_no_key", "sales_returns", type_="unique")
        if "uq_sales_returns_company_return_no" not in sr_uqs:
            op.create_unique_constraint(
                "uq_sales_returns_company_return_no",
                "sales_returns",
                ["company_id", "return_no"]
            )

    # 5. packing_slips
    if "packing_slips" in tables:
        ps_indexes = {idx["name"] for idx in inspector.get_indexes("packing_slips")}
        ps_uqs = {c["name"] for c in inspector.get_unique_constraints("packing_slips")}
        if "ix_packing_slips_packing_slip_number" in ps_indexes:
            op.drop_index("ix_packing_slips_packing_slip_number", table_name="packing_slips")
        if "packing_slips_packing_slip_number_key" in ps_uqs:
            op.drop_constraint("packing_slips_packing_slip_number_key", "packing_slips", type_="unique")
        if "uq_packing_slips_company_num" not in ps_uqs:
            op.create_unique_constraint(
                "uq_packing_slips_company_num",
                "packing_slips",
                ["company_id", "packing_slip_number"]
            )

    # 6. dispatches
    if "dispatches" in tables:
        disp_indexes = {idx["name"] for idx in inspector.get_indexes("dispatches")}
        disp_uqs = {c["name"] for c in inspector.get_unique_constraints("dispatches")}
        if "ix_dispatches_dispatch_number" in disp_indexes:
            op.drop_index("ix_dispatches_dispatch_number", table_name="dispatches")
        if "dispatches_dispatch_number_key" in disp_uqs:
            op.drop_constraint("dispatches_dispatch_number_key", "dispatches", type_="unique")
        if "uq_dispatches_company_num" not in disp_uqs:
            op.create_unique_constraint(
                "uq_dispatches_company_num",
                "dispatches",
                ["company_id", "dispatch_number"]
            )

    # =========================================================================
    # PART 2: Line Items BaseEntity Structural Parity
    # =========================================================================

    item_tables = [
        "sales_order_items",
        "sales_invoice_items",
        "sales_return_items",
        "sales_quotation_items",
    ]

    for tbl in item_tables:
        if tbl not in tables:
            continue
        cols = {c["name"] for c in inspector.get_columns(tbl)}

        # 1. uuid
        if "uuid" not in cols:
            op.add_column(tbl, sa.Column("uuid", sa.String(36), nullable=True))
            # Generate UUIDs for any existing rows
            op.execute(f"UPDATE {tbl} SET uuid = gen_random_uuid()::text WHERE uuid IS NULL")
            op.alter_column(tbl, "uuid", nullable=False)
            op.create_unique_constraint(f"uq_{tbl}_uuid", tbl, ["uuid"])

        # 2. company_id
        if "company_id" not in cols:
            op.add_column(tbl, sa.Column("company_id", sa.String(50), sa.ForeignKey("companies.id", ondelete="RESTRICT"), nullable=True, index=True))

        # 3. branch_id
        if "branch_id" not in cols:
            op.add_column(tbl, sa.Column("branch_id", sa.String(50), sa.ForeignKey("branches.id", ondelete="RESTRICT"), nullable=True, index=True))

        # 4. is_active
        if "is_active" not in cols:
            op.add_column(tbl, sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")))

        # 5. is_deleted
        if "is_deleted" not in cols:
            op.add_column(tbl, sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false"), index=True))

        # 6. deleted_at
        if "deleted_at" not in cols:
            op.add_column(tbl, sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))

        # 7. deleted_by
        if "deleted_by" not in cols:
            op.add_column(tbl, sa.Column("deleted_by", sa.String(100), nullable=True))

        # 8. version
        if "version" not in cols:
            op.add_column(tbl, sa.Column("version", sa.Integer(), nullable=False, server_default="1"))

        # 9. created_at
        if "created_at" not in cols:
            op.add_column(tbl, sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")))

        # 10. modified_at
        if "modified_at" not in cols:
            op.add_column(tbl, sa.Column("modified_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")))

        # 11. created_by
        if "created_by" not in cols:
            op.add_column(tbl, sa.Column("created_by", sa.String(100), nullable=True))

        # 12. updated_by
        if "updated_by" not in cols:
            op.add_column(tbl, sa.Column("updated_by", sa.String(100), nullable=True))

    # =========================================================================
    # PART 3: Data Backfill from Parent Documents
    # =========================================================================

    # Backfill sales_invoice_items from sales_invoices
    op.execute("""
        UPDATE sales_invoice_items sii
        SET company_id = si.company_id,
            branch_id = si.branch_id
        FROM sales_invoices si
        WHERE sii.invoice_id = si.id
          AND sii.company_id IS NULL;
    """)

    # Backfill sales_order_items from sales_orders
    op.execute("""
        UPDATE sales_order_items soi
        SET company_id = so.company_id,
            branch_id = so.branch_id
        FROM sales_orders so
        WHERE soi.order_id = so.id
          AND soi.company_id IS NULL;
    """)

    # Backfill sales_return_items from sales_returns
    op.execute("""
        UPDATE sales_return_items sri
        SET company_id = sr.company_id,
            branch_id = sr.branch_id
        FROM sales_returns sr
        WHERE sri.return_id = sr.id
          AND sri.company_id IS NULL;
    """)

    # Backfill sales_quotation_items from sales_quotations
    op.execute("""
        UPDATE sales_quotation_items sqi
        SET company_id = sq.company_id,
            branch_id = sq.branch_id
        FROM sales_quotations sq
        WHERE sqi.quotation_id = sq.id
          AND sqi.company_id IS NULL;
    """)


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = set(inspector.get_table_names())

    item_tables = [
        "sales_quotation_items",
        "sales_return_items",
        "sales_invoice_items",
        "sales_order_items",
    ]

    for tbl in item_tables:
        if tbl not in tables:
            continue
        cols = {c["name"] for c in inspector.get_columns(tbl)}
        uqs = {c["name"] for c in inspector.get_unique_constraints(tbl)}
        if f"uq_{tbl}_uuid" in uqs:
            op.drop_constraint(f"uq_{tbl}_uuid", tbl, type_="unique")
        for col in ["uuid", "company_id", "branch_id", "is_active", "is_deleted", "deleted_at", "deleted_by", "version", "created_at", "modified_at", "created_by", "updated_by"]:
            if col in cols:
                op.drop_column(tbl, col)

    if "dispatches" in tables:
        disp_uqs = {c["name"] for c in inspector.get_unique_constraints("dispatches")}
        if "uq_dispatches_company_num" in disp_uqs:
            op.drop_constraint("uq_dispatches_company_num", "dispatches", type_="unique")
        op.create_index("ix_dispatches_dispatch_number", "dispatches", ["dispatch_number"], unique=True)

    if "packing_slips" in tables:
        ps_uqs = {c["name"] for c in inspector.get_unique_constraints("packing_slips")}
        if "uq_packing_slips_company_num" in ps_uqs:
            op.drop_constraint("uq_packing_slips_company_num", "packing_slips", type_="unique")
        op.create_index("ix_packing_slips_packing_slip_number", "packing_slips", ["packing_slip_number"], unique=True)

    if "sales_returns" in tables:
        sr_uqs = {c["name"] for c in inspector.get_unique_constraints("sales_returns")}
        if "uq_sales_returns_company_return_no" in sr_uqs:
            op.drop_constraint("uq_sales_returns_company_return_no", "sales_returns", type_="unique")
        op.create_unique_constraint("sales_returns_return_no_key", "sales_returns", ["return_no"])

    if "sales_quotations" in tables:
        sq_uqs = {c["name"] for c in inspector.get_unique_constraints("sales_quotations")}
        if "uq_sales_quotations_company_quotation_no" in sq_uqs:
            op.drop_constraint("uq_sales_quotations_company_quotation_no", "sales_quotations", type_="unique")
        op.create_unique_constraint("sales_quotations_quotation_no_key", "sales_quotations", ["quotation_no"])

    if "sales_invoices" in tables:
        si_uqs = {c["name"] for c in inspector.get_unique_constraints("sales_invoices")}
        op.create_unique_constraint("sales_invoices_invoice_no_key", "sales_invoices", ["invoice_no"])

    if "sales_orders" in tables:
        so_uqs = {c["name"] for c in inspector.get_unique_constraints("sales_orders")}
        if "uq_sales_orders_company_order_no" in so_uqs:
            op.drop_constraint("uq_sales_orders_company_order_no", "sales_orders", type_="unique")
        op.create_unique_constraint("sales_orders_order_no_key", "sales_orders", ["order_no"])
