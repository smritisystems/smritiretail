"""Extend PSV with customer store identity and approved projection metadata.

Revision ID: v1425_psv_partner_identity
Revises: v1424_staff_placement_assignments
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "v1425_psv_partner_identity"
down_revision: Union[str, Sequence[str], None] = "v1424_staff_placement_assignments"
branch_labels = None
depends_on = None


def _add_column_if_missing(bind, table: str, column: sa.Column) -> None:
    columns = {item["name"] for item in sa.inspect(bind).get_columns(table)}
    if column.name not in columns:
        op.add_column(table, column)


def _create_index_if_missing(bind, name: str, table: str, columns: list[str]) -> None:
    indexes = {item["name"] for item in sa.inspect(bind).get_indexes(table)}
    if name not in indexes:
        op.create_index(name, table, columns, unique=False)


def upgrade() -> None:
    bind = op.get_bind()
    tables = set(sa.inspect(bind).get_table_names())

    if "psv_parties" in tables:
        for column in (
            sa.Column("company_id", sa.String(50), nullable=True),
            sa.Column("branch_id", sa.String(50), nullable=True),
            sa.Column("host_customer_id", sa.String(50), nullable=True),
            sa.Column("delivery_location_id", sa.String(50), nullable=True),
            sa.Column("store_code", sa.String(50), nullable=True),
            sa.Column("store_name_snapshot", sa.String(255), nullable=True),
            sa.Column("stock_model", sa.String(30), server_default="'OUTRIGHT_SALE'", nullable=False),
        ):
            _add_column_if_missing(bind, "psv_parties", column)
        _create_index_if_missing(bind, "ix_psv_parties_company_store", "psv_parties", ["company_id", "store_code"])

    if "psv_stock_events" in tables:
        for column in (
            sa.Column("host_customer_id", sa.String(50), nullable=True),
            sa.Column("delivery_location_id", sa.String(50), nullable=True),
            sa.Column("store_code_snapshot", sa.String(50), nullable=True),
            sa.Column("invoice_id", sa.String(50), nullable=True),
            sa.Column("invoice_line_id", sa.String(50), nullable=True),
            sa.Column("staff_placement_id", sa.String(50), nullable=True),
            sa.Column("approval_status", sa.String(20), server_default="'APPROVED'", nullable=False),
            sa.Column("reported_by", sa.String(50), nullable=True),
            sa.Column("approval_reason", sa.Text, nullable=True),
        ):
            _add_column_if_missing(bind, "psv_stock_events", column)
        for name, columns in (
            ("ix_psv_events_store_code", ["company_code", "store_code_snapshot"]),
            ("ix_psv_events_invoice_line", ["invoice_id", "invoice_line_id"]),
        ):
            _create_index_if_missing(bind, name, "psv_stock_events", columns)

    if "psv_stock_balances" in tables:
        for column in (
            sa.Column("delivery_location_id", sa.String(50), nullable=True),
            sa.Column("store_code_snapshot", sa.String(50), nullable=True),
            sa.Column("last_reported_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("reconciliation_status", sa.String(30), server_default="'AUTO_MATCHED'", nullable=False),
        ):
            _add_column_if_missing(bind, "psv_stock_balances", column)
        _create_index_if_missing(bind, "ix_psv_balances_store_code", "psv_stock_balances", ["company_code", "store_code_snapshot"])


def downgrade() -> None:
    bind = op.get_bind()
    for name, table in (
        ("ix_psv_balances_store_code", "psv_stock_balances"),
        ("ix_psv_events_invoice_line", "psv_stock_events"),
        ("ix_psv_events_store_code", "psv_stock_events"),
        ("ix_psv_parties_company_store", "psv_parties"),
    ):
        try:
            op.drop_index(name, table_name=table)
        except Exception:
            pass