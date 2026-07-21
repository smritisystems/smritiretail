"""
Project      : SMRITI Retail OS
Organization : AITDL NETWORKS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 5.1.3
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

Revision ID: 80c0b6c55127
Revises: 544e10dde7f6
Create Date: 2026-07-21 00:44:51.033159
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
import uuid as uuid_pkg

revision: str = '80c0b6c55127'
down_revision: Union[str, Sequence[str], None] = '544e10dde7f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    connection = op.get_bind()

    # 1. Pre-Migration Audits
    # (a) Halt if is_interstate has NULLs on sales_invoices or sales_returns
    null_inv = connection.execute(sa.text("SELECT COUNT(*) FROM sales_invoices WHERE is_interstate IS NULL")).scalar()
    null_ret = connection.execute(sa.text("SELECT COUNT(*) FROM sales_returns WHERE is_interstate IS NULL")).scalar()
    if null_inv > 0 or null_ret > 0:
        raise Exception(f"Tax Audit Failure: is_interstate IS NULL found (Invoices: {null_inv}, Returns: {null_ret}). Manual remediation required.")

    # (b) Halt if there are duplicate barcodes in products or secondary_barcodes
    result = connection.execute(sa.text("""
        SELECT COUNT(*) FROM (
            SELECT barcode, COUNT(*) FROM (
                SELECT barcode FROM products
                UNION ALL
                SELECT unnest(secondary_barcodes) FROM products
            ) AS raw_barcodes GROUP BY barcode HAVING COUNT(*) > 1
        ) AS dup_groups
    """))
    dup_count = result.scalar()
    if dup_count > 0:
        raise Exception(f"Barcode Duplicate Audit Failure: {dup_count} duplicate barcode groups found in products. Manual remediation required.")

    # 2. Tax Splits Backfill
    # (a) Sales Invoices
    connection.execute(sa.text("""
        UPDATE sales_invoices SET
          cgst_total = CASE WHEN is_interstate = FALSE THEN COALESCE(tax_total, 0) / 2 ELSE 0.00 END,
          sgst_total = CASE WHEN is_interstate = FALSE THEN COALESCE(tax_total, 0) / 2 ELSE 0.00 END,
          igst_total = CASE WHEN is_interstate = TRUE THEN COALESCE(tax_total, 0) ELSE 0.00 END
        WHERE cgst_total = 0.00;
    """))
    # (b) Sales Invoice Items
    connection.execute(sa.text("""
        UPDATE sales_invoice_items SET
          cgst_amount = CASE WHEN invoice_id IN (SELECT id FROM sales_invoices WHERE is_interstate = FALSE) THEN COALESCE(tax_amount, 0) / 2 ELSE 0.00 END,
          sgst_amount = CASE WHEN invoice_id IN (SELECT id FROM sales_invoices WHERE is_interstate = FALSE) THEN COALESCE(tax_amount, 0) / 2 ELSE 0.00 END,
          igst_amount = CASE WHEN invoice_id IN (SELECT id FROM sales_invoices WHERE is_interstate = TRUE) THEN COALESCE(tax_amount, 0) ELSE 0.00 END
        WHERE cgst_amount = 0.00;
    """))

    # (c) Sales Returns
    connection.execute(sa.text("""
        UPDATE sales_returns SET
          cgst_total = CASE WHEN is_interstate = FALSE THEN COALESCE(tax_total, 0) / 2 ELSE 0.00 END,
          sgst_total = CASE WHEN is_interstate = FALSE THEN COALESCE(tax_total, 0) / 2 ELSE 0.00 END,
          igst_total = CASE WHEN is_interstate = TRUE THEN COALESCE(tax_total, 0) ELSE 0.00 END
        WHERE cgst_total = 0.00;
    """))
    # (d) Sales Return Items
    connection.execute(sa.text("""
        UPDATE sales_return_items SET
          cgst_amount = CASE WHEN return_id IN (SELECT id FROM sales_returns WHERE is_interstate = FALSE) THEN COALESCE(tax_amount, 0) / 2 ELSE 0.00 END,
          sgst_amount = CASE WHEN return_id IN (SELECT id FROM sales_returns WHERE is_interstate = FALSE) THEN COALESCE(tax_amount, 0) / 2 ELSE 0.00 END,
          igst_amount = CASE WHEN return_id IN (SELECT id FROM sales_returns WHERE is_interstate = TRUE) THEN COALESCE(tax_amount, 0) ELSE 0.00 END
        WHERE cgst_amount = 0.00;
    """))

    # (e) Sales Quotations (Fallback to local tax splits)
    connection.execute(sa.text("""
        UPDATE sales_quotations SET
          cgst_total = COALESCE(tax_total, 0) / 2,
          sgst_total = COALESCE(tax_total, 0) / 2,
          igst_total = 0.00
        WHERE cgst_total = 0.00;
    """))
    # (f) Sales Quotation Items
    connection.execute(sa.text("""
        UPDATE sales_quotation_items SET
          cgst_amount = COALESCE(tax_amount, 0) / 2,
          sgst_amount = COALESCE(tax_amount, 0) / 2,
          igst_amount = 0.00
        WHERE cgst_amount = 0.00;
    """))

    # (g) Sales Orders (Fallback to local tax splits)
    connection.execute(sa.text("""
        UPDATE sales_orders SET
          cgst_total = COALESCE(tax_total, 0) / 2,
          sgst_total = COALESCE(tax_total, 0) / 2,
          igst_total = 0.00
        WHERE cgst_total = 0.00;
    """))
    # (h) Sales Order Items
    connection.execute(sa.text("""
        UPDATE sales_order_items SET
          cgst_amount = COALESCE(tax_amount, 0) / 2,
          sgst_amount = COALESCE(tax_amount, 0) / 2,
          igst_amount = 0.00
        WHERE cgst_amount = 0.00;
    """))

    # 3. Tenancy Backfill
    # (a) sales_invoice_items
    connection.execute(sa.text("""
        UPDATE sales_invoice_items item SET
          tenant_id = COALESCE(inv.tenant_id, 'tenant-default'),
          company_id = COALESCE(inv.company_id, 'comp-default'),
          branch_id = COALESCE(inv.branch_id, 'br-default')
        FROM sales_invoices inv
        WHERE item.invoice_id = inv.id;
    """))
    # (b) sales_quotation_items
    connection.execute(sa.text("""
        UPDATE sales_quotation_items item SET
          tenant_id = COALESCE(q.tenant_id, 'tenant-default'),
          company_id = COALESCE(q.company_id, 'comp-default'),
          branch_id = COALESCE(q.branch_id, 'br-default')
        FROM sales_quotations q
        WHERE item.quotation_id = q.id;
    """))
    # (c) sales_order_items
    connection.execute(sa.text("""
        UPDATE sales_order_items item SET
          tenant_id = COALESCE(ord.tenant_id, 'tenant-default'),
          company_id = COALESCE(ord.company_id, 'comp-default'),
          branch_id = COALESCE(ord.branch_id, 'br-default')
        FROM sales_orders ord
        WHERE item.order_id = ord.id;
    """))
    # (d) sales_return_items
    connection.execute(sa.text("""
        UPDATE sales_return_items item SET
          tenant_id = COALESCE(ret.tenant_id, 'tenant-default'),
          company_id = COALESCE(ret.company_id, 'comp-default'),
          branch_id = COALESCE(ret.branch_id, 'br-default')
        FROM sales_returns ret
        WHERE item.return_id = ret.id;
    """))

    # 4. place_of_supply backfill ( महाराष्ट्र '27' / दिल्ली '07' )
    connection.execute(sa.text("""
        UPDATE sales_invoices SET
          place_of_supply = CASE WHEN is_interstate = TRUE THEN '07' ELSE '27' END
        WHERE place_of_supply IS NULL;
    """))

    # 5. Barcode Extraction & Deduplication
    products_res = connection.execute(sa.text("SELECT id, barcode, secondary_barcodes, tenant_id, company_id, branch_id FROM products"))
    for row in products_res:
        prod_id = row[0]
        prim_barcode = row[1]
        sec_barcodes = row[2] or []
        tenant_id = row[3] or 'tenant-default'
        company_id = row[4] or 'comp-default'
        branch_id = row[5] or 'br-default'

        # Insert primary barcode
        barcode_id = f"BC-{uuid_pkg.uuid4().hex[:8]}"
        connection.execute(sa.text("""
            INSERT INTO product_barcodes (id, uuid, tenant_id, company_id, branch_id, product_id, barcode, is_primary, is_active, is_deleted, version)
            VALUES (:id, :uuid, :tenant_id, :company_id, :branch_id, :product_id, :barcode, TRUE, TRUE, FALSE, 1)
        """), {
            "id": barcode_id,
            "uuid": str(uuid_pkg.uuid4()),
            "tenant_id": tenant_id,
            "company_id": company_id,
            "branch_id": branch_id,
            "product_id": prod_id,
            "barcode": prim_barcode
        })

        # Insert secondary barcodes
        for bar in sec_barcodes:
            if not bar:
                continue
            barcode_id = f"BC-{uuid_pkg.uuid4().hex[:8]}"
            connection.execute(sa.text("""
                INSERT INTO product_barcodes (id, uuid, tenant_id, company_id, branch_id, product_id, barcode, is_primary, is_active, is_deleted, version)
                VALUES (:id, :uuid, :tenant_id, :company_id, :branch_id, :product_id, :barcode, FALSE, TRUE, FALSE, 1)
            """), {
                "id": barcode_id,
                "uuid": str(uuid_pkg.uuid4()),
                "tenant_id": tenant_id,
                "company_id": company_id,
                "branch_id": branch_id,
                "product_id": prod_id,
                "barcode": bar
            })


def downgrade() -> None:
    connection = op.get_bind()
    # Truncate barcodes and clear columns
    connection.execute(sa.text("DELETE FROM product_barcodes"))
    connection.execute(sa.text("UPDATE sales_invoices SET place_of_supply = NULL"))
    for table_name in ['sales_invoices', 'sales_quotations', 'sales_orders', 'sales_returns']:
        connection.execute(sa.text(f"UPDATE {table_name} SET cgst_total = 0.00, sgst_total = 0.00, igst_total = 0.00"))
    for table_name in ['sales_invoice_items', 'sales_quotation_items', 'sales_order_items', 'sales_return_items']:
        connection.execute(sa.text(f"UPDATE {table_name} SET tenant_id = NULL, company_id = NULL, branch_id = NULL, cgst_amount = 0.00, sgst_amount = 0.00, igst_amount = 0.00"))
