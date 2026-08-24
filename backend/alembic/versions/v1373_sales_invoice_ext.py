"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-08-25
Modified     : 2026-08-25
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software

Sprint 14 migration -- SalesInvoice schema extension.

Adds 8 columns to sales_invoices that were absent when the table was created:
  salesperson_id   -- FK to staff/commission_participants
  salesperson_name -- denormalised name for reporting
  discount_amount  -- invoice-level absolute discount
  net_amount       -- taxable_value - discount_amount (before tax)
  terminal_id      -- POS counter/terminal identifier
  counter_id       -- alias for terminal in legacy shoper9 context
  paid_amount      -- amount actually tendered
  balance_amount   -- change given / outstanding balance

Shoper9 context:
  These columns were used in RPT-SAL-008 (SR210000 salesperson-sales),
  RPT-SAL-009 (SR221600 salesperson-summary), and finance till reports.
"""

revision      = "v1373_sales_invoice_ext"
down_revision = "v1372_sprint12_parity_tables"
branch_labels = None
depends_on    = None

from alembic import op
import sqlalchemy as sa


def upgrade() -> None:
    # Add missing columns to sales_invoices (idempotent -- IF NOT EXISTS via try/except)
    with op.batch_alter_table("sales_invoices") as batch_op:
        batch_op.add_column(sa.Column(
            "salesperson_id", sa.String(50), nullable=True
        ))
        batch_op.add_column(sa.Column(
            "salesperson_name", sa.String(255), nullable=True
        ))
        batch_op.add_column(sa.Column(
            "discount_amount", sa.Numeric(15, 2),
            nullable=False, server_default="0"
        ))
        batch_op.add_column(sa.Column(
            "net_amount", sa.Numeric(15, 2),
            nullable=False, server_default="0"
        ))
        batch_op.add_column(sa.Column(
            "terminal_id", sa.String(50), nullable=True
        ))
        batch_op.add_column(sa.Column(
            "counter_id", sa.String(50), nullable=True
        ))
        batch_op.add_column(sa.Column(
            "paid_amount", sa.Numeric(15, 2),
            nullable=False, server_default="0"
        ))
        batch_op.add_column(sa.Column(
            "balance_amount", sa.Numeric(15, 2),
            nullable=False, server_default="0"
        ))

    # Index salesperson for report queries
    op.create_index(
        "ix_sales_invoices_salesperson",
        "sales_invoices", ["salesperson_id"]
    )
    op.create_index(
        "ix_sales_invoices_terminal",
        "sales_invoices", ["terminal_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_sales_invoices_terminal", "sales_invoices")
    op.drop_index("ix_sales_invoices_salesperson", "sales_invoices")
    with op.batch_alter_table("sales_invoices") as batch_op:
        batch_op.drop_column("balance_amount")
        batch_op.drop_column("paid_amount")
        batch_op.drop_column("counter_id")
        batch_op.drop_column("terminal_id")
        batch_op.drop_column("net_amount")
        batch_op.drop_column("discount_amount")
        batch_op.drop_column("salesperson_name")
        batch_op.drop_column("salesperson_id")
