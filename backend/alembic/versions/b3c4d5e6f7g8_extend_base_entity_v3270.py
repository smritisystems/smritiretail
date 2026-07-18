"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Email        : support@smritibooks.com
Version      : 3.27.0
Created      : 2026-07-19
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software

Alembic Migration: Extend BaseEntity with workflow_status and document_number
Revision: b3c4d5e6f7g8
"""

from typing import Union, Sequence
import sqlalchemy as sa
from alembic import op

# Revision identifiers
revision: str = "b3c4d5e6f7g8"
down_revision: Union[str, Sequence[str], None] = "a2b3c4d5e6f7"
branch_labels = None
depends_on = None

# All tables inheriting from BaseEntity
TABLES_TO_MIGRATE = [
    "customer_groups",
    "pricing_groups",
    "customers",
    "products",
    "stock_movements",
    "stores",
    "warehouses",
    "sales_invoices",
    "sales_quotations",
    "sales_orders",
    "sales_returns",
    "suppliers",
    "purchase_orders",
    "purchase_order_items",
    "purchase_receipts",
    "purchase_receipt_items",
    "purchase_reorder_configs",
    "purchase_jurisdiction_configs",
    "cash_registers",
    "shifts",
    "barcode_providers",
    "identity_rules",
    "product_identities",
    "user_company_assignments",
    "user_branch_assignments",
    "user_store_assignments",
    "supplier_payments",
    "report_schedules",
    "smriti_roles",
    "smriti_permissions",
    "smriti_policies",
    "smriti_role_policies",
    "smriti_policy_permissions",
    "smriti_user_roles",
    "smriti_menus",
    "smriti_security_audits",
    "document_number_series",
    "document_workflows",
    "integration_logs"
]

def column_exists(table_name: str, column_name: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = [c["name"] for c in inspector.get_columns(table_name)]
    return column_name in columns

def upgrade() -> None:
    for table_name in TABLES_TO_MIGRATE:
        if not column_exists(table_name, "workflow_status"):
            op.add_column(table_name, sa.Column("workflow_status", sa.String(30), nullable=True))
        if not column_exists(table_name, "document_number"):
            op.add_column(table_name, sa.Column("document_number", sa.String(80), nullable=True))

def downgrade() -> None:
    for table_name in TABLES_TO_MIGRATE:
        if column_exists(table_name, "document_number"):
            # Don't drop it if it was part of the original table definition (e.g. document_workflows)
            if table_name != "document_workflows":
                op.drop_column(table_name, "document_number")
        if column_exists(table_name, "workflow_status"):
            op.drop_column(table_name, "workflow_status")
