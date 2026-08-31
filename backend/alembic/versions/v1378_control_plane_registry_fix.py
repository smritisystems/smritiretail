"""Repair canonical control-plane registry tables for the multi-company bootstrap."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "v1378_control_plane_registry_fix"
down_revision = "v1377_sales_return_policy"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    if "products" in existing_tables:
        product_columns = {c["name"] for c in inspector.get_columns("products")}
        if "buying_price" not in product_columns:
            op.add_column("products", sa.Column("buying_price", sa.Numeric(precision=15, scale=2), nullable=True))

    if "sales_invoice_items" in existing_tables:
        sales_invoice_item_columns = {c["name"] for c in inspector.get_columns("sales_invoice_items")}
        for column_name, column_type in {
            "mrp": sa.Numeric(precision=15, scale=2),
            "disc_pct": sa.Numeric(precision=7, scale=4),
            "taxable_value": sa.Numeric(precision=15, scale=2),
            "igst_amount": sa.Numeric(precision=15, scale=2),
            "cgst_amount": sa.Numeric(precision=15, scale=2),
            "sgst_amount": sa.Numeric(precision=15, scale=2),
            "line_no": sa.Integer(),
        }.items():
            if column_name not in sales_invoice_item_columns:
                op.add_column("sales_invoice_items", sa.Column(column_name, column_type, nullable=True))

    if "company_database_registries" not in existing_tables:
        op.create_table(
            "company_database_registries",
            sa.Column("company_id", sa.String(length=50), primary_key=True, nullable=False),
            sa.Column("database_id", sa.String(length=50), nullable=False, unique=True),
            sa.Column("database_name", sa.String(length=100), nullable=False, unique=True),
            sa.Column("database_engine", sa.String(length=50), nullable=True, server_default="postgresql"),
            sa.Column("host_reference", sa.String(length=255), nullable=True, server_default="localhost"),
            sa.Column("port_reference", sa.Integer(), nullable=True, server_default="5432"),
            sa.Column("status", sa.String(length=50), nullable=False, server_default="READY"),
            sa.Column("schema_version", sa.String(length=50), nullable=True, server_default="3.16.0"),
            sa.Column("region", sa.String(length=50), nullable=True, server_default="ap-south-1"),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("last_health_check", sa.DateTime(timezone=True), nullable=True),
            sa.Column("provisioning_status", sa.String(length=50), nullable=True, server_default="COMPLETED"),
            sa.Column("migration_status", sa.String(length=50), nullable=True, server_default="UP_TO_DATE"),
        )

    if "control_psv_configs" not in existing_tables:
        op.create_table(
            "control_psv_configs",
            sa.Column("id", sa.String(length=50), primary_key=True, nullable=False),
            sa.Column("company_id", sa.String(length=50), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, unique=True),
            sa.Column("company_code", sa.String(length=50), nullable=False, unique=True),
            sa.Column("psv_enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("psv_mode", sa.String(length=30), nullable=False, server_default="CENTRAL"),
            sa.Column("psv_database_name", sa.String(length=100), nullable=False, server_default="SmritiPSV"),
            sa.Column("tracked_customer_ids", postgresql.ARRAY(sa.String()), nullable=True, server_default="{}"),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("modified_at", sa.DateTime(timezone=True), nullable=True),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    if "control_psv_configs" in existing_tables:
        op.drop_table("control_psv_configs")
    if "company_database_registries" in existing_tables:
        op.drop_table("company_database_registries")
    if "products" in existing_tables:
        columns = {c["name"] for c in inspector.get_columns("products")}
        if "buying_price" in columns:
            op.drop_column("products", "buying_price")
    if "sales_invoice_items" in existing_tables:
        columns = {c["name"] for c in inspector.get_columns("sales_invoice_items")}
        for column_name in ["mrp", "disc_pct", "taxable_value", "igst_amount", "cgst_amount", "sgst_amount", "line_no"]:
            if column_name in columns:
                op.drop_column("sales_invoice_items", column_name)
