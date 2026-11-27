"""Reconcile legacy migration schema repairs without rewriting history.

Revision ID: v1594
Revises: v1593
# @migration_target('tenant')
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "v1594"
down_revision: str | Sequence[str] | None = "v1593"
branch_labels = None
depends_on = None

_BASE_ENTITY_TABLES = (
    "customer_groups",
    "customers",
    "products",
    "sales_invoices",
)

_BASE_ENTITY_COLUMNS = (
    ("company_id", sa.String(50), True),
    ("branch_id", sa.String(50), True),
    ("created_by", sa.String(100), True),
    ("updated_by", sa.String(100), True),
    ("is_active", sa.Boolean(), True),
    ("is_deleted", sa.Boolean(), True),
    ("deleted_at", sa.DateTime(timezone=True), True),
    ("deleted_by", sa.String(100), True),
    ("version", sa.Integer(), True),
)

_INVOICE_COMPAT_COLUMNS = (
    ("source_type", sa.String(50), sa.text("'LIVE'")),
    ("source_system", sa.String(50), None),
    ("source_file", sa.String(500), None),
    ("import_batch_id", sa.String(100), None),
    ("imported_at", sa.Date(), None),
    ("import_validation_status", sa.String(50), None),
    ("import_validation_notes", sa.Text(), None),
    ("sis_code", sa.String(50), None),
    ("pos_state", sa.String(100), None),
    ("reverse_charge", sa.Boolean(), sa.text("false")),
    ("is_reverse_charge", sa.Boolean(), sa.text("false")),
    ("po_reference", sa.String(100), None),
    ("customer_name", sa.String(255), None),
    ("customer_gstin", sa.String(50), None),
    ("billing_address", sa.Text(), None),
    ("shipping_address", sa.Text(), None),
    ("site_name", sa.String(255), None),
    ("taxable_value", sa.Numeric(15, 2), None),
    ("rounding_amount", sa.Numeric(10, 4), sa.text("0.0000")),
    ("amount_in_words", sa.Text(), None),
    ("bank_name", sa.String(100), None),
    ("account_no", sa.String(100), None),
    ("ifsc_code", sa.String(50), None),
    ("original_pdf_sha256", sa.String(64), None),
    ("original_pdf_path", sa.String(500), None),
    ("original_pdf_size", sa.Integer(), None),
    ("original_pdf_pages", sa.Integer(), None),
    ("e_invoice_status", sa.String(50), sa.text("'NOT_APPLICABLE'")),
    ("irn", sa.String(100), None),
    ("ack_no", sa.String(100), None),
    ("ack_date", sa.String(100), None),
    ("signed_qr_payload", sa.Text(), None),
)


def _bind():
    return op.get_bind()


def _inspector():
    return sa.inspect(_bind())


def _has_table(table: str) -> bool:
    return _inspector().has_table(table)


def _column_map(table: str) -> dict[str, dict]:
    if not _has_table(table):
        raise RuntimeError(f"Cannot repair tenant schema: required table '{table}' is missing.")
    return {column["name"]: column for column in _inspector().get_columns(table)}


def _ensure_column(table: str, column: sa.Column) -> None:
    if column.name not in _column_map(table):
        op.add_column(table, column)


def _ensure_base_entity_columns() -> None:
    for table in _BASE_ENTITY_TABLES:
        columns = _column_map(table)
        if "uuid" not in columns:
            op.add_column(
                table,
                sa.Column(
                    "uuid",
                    sa.String(36),
                    nullable=False,
                    server_default=sa.text("uuid_generate_v4()::varchar"),
                ),
            )
        else:
            _bind().execute(
                sa.text(
                    f"UPDATE {table} SET uuid = uuid_generate_v4()::varchar "
                    "WHERE uuid IS NULL"
                )
            )
            if columns["uuid"]["nullable"]:
                op.alter_column(
                    table,
                    "uuid",
                    existing_type=columns["uuid"]["type"],
                    nullable=False,
                )
            op.alter_column(
                table,
                "uuid",
                existing_type=columns["uuid"]["type"],
                server_default=sa.text("uuid_generate_v4()::varchar"),
            )

        for name, column_type, nullable in _BASE_ENTITY_COLUMNS:
            _ensure_column(
                table,
                sa.Column(name, column_type, nullable=nullable),
            )

        _ensure_unique_constraint(table, "uuid", f"{table}_uuid_key")


def _ensure_unique_constraint(table: str, column: str, name: str) -> None:
    inspector = _inspector()
    constraints = inspector.get_unique_constraints(table)
    if any(constraint.get("column_names") == [column] for constraint in constraints):
        return
    if any(
        index.get("column_names") == [column] and index.get("unique")
        for index in inspector.get_indexes(table)
    ):
        return

    duplicates = _bind().execute(
        sa.text(
            f"SELECT {column} FROM {table} WHERE {column} IS NOT NULL "
            f"GROUP BY {column} HAVING count(*) > 1 LIMIT 1"
        )
    ).first()
    if duplicates:
        raise RuntimeError(
            f"Cannot add unique constraint {name} to {table}: duplicate {column} values exist."
        )
    op.create_unique_constraint(name, table, [column])


def _ensure_index(
    table: str,
    name: str,
    columns: list[str],
    unique: bool = False,
) -> None:
    indexes = {index["name"]: index for index in _inspector().get_indexes(table)}
    if name in indexes:
        index = indexes[name]
        if index.get("column_names") != columns or bool(index.get("unique")) != unique:
            raise RuntimeError(f"Index {name} on {table} has an unexpected definition.")
        return

    if unique:
        columns_sql = ", ".join(columns)
        duplicate = _bind().execute(
            sa.text(
                f"SELECT {columns_sql} FROM {table} "
                f"WHERE {' AND '.join(f'{column} IS NOT NULL' for column in columns)} "
                f"GROUP BY {columns_sql} HAVING count(*) > 1 LIMIT 1"
            )
        ).first()
        if duplicate:
            raise RuntimeError(
                f"Cannot create unique index {name} on {table}: duplicate key values exist."
            )
    op.create_index(name, table, columns, unique=unique)


def _drop_index_if_present(table: str, name: str) -> None:
    if name in {index["name"] for index in _inspector().get_indexes(table)}:
        op.drop_index(name, table_name=table)


def _ensure_foreign_key(
    table: str,
    column: str,
    referred_table: str,
    name: str,
    ondelete: str = "RESTRICT",
) -> None:
    foreign_keys = _inspector().get_foreign_keys(table)
    if any(
        foreign_key.get("constrained_columns") == [column]
        and foreign_key.get("referred_table") == referred_table
        for foreign_key in foreign_keys
    ):
        return

    orphan_count = _bind().execute(
        sa.text(
            f"SELECT count(*) FROM {table} child "
            f"LEFT JOIN {referred_table} parent ON parent.id = child.{column} "
            f"WHERE child.{column} IS NOT NULL AND parent.id IS NULL"
        )
    ).scalar_one()
    if orphan_count:
        raise RuntimeError(
            f"Cannot add foreign key {name}: {orphan_count} orphaned "
            f"{table}.{column} value(s) exist."
        )
    op.create_foreign_key(
        name,
        table,
        referred_table,
        [column],
        ["id"],
        ondelete=ondelete,
    )


def _ensure_array_column_type(table: str, column: str) -> None:
    columns = _column_map(table)
    if column not in columns:
        raise RuntimeError(f"Cannot align {table}.{column}: required column is missing.")
    column_type = columns[column]["type"]
    rendered = str(column_type.compile(dialect=_bind().dialect)).upper()
    if "TEXT[]" in rendered:
        op.execute(
            sa.text(
                f"ALTER TABLE {table} ALTER COLUMN {column} "
                f"TYPE VARCHAR[] USING {column}::varchar[]"
            )
        )


def _ensure_baseline_indexes_and_types() -> None:
    for table, column in (
        ("customer_groups", "allowed_payment_methods"),
        ("customers", "tags"),
        ("products", "secondary_barcodes"),
    ):
        _ensure_array_column_type(table, column)

    for legacy_name, table in (
        ("idx_customers_group", "customers"),
        ("idx_customers_mobile", "customers"),
        ("idx_products_barcode", "products"),
        ("idx_products_category", "products"),
        ("idx_sales_invoice_item_invoice", "sales_invoice_items"),
        ("idx_sales_invoice_customer", "sales_invoices"),
    ):
        _drop_index_if_present(table, legacy_name)

    _ensure_index(
        "customers",
        "ix_customers_customer_group_id",
        ["customer_group_id"],
    )
    _ensure_index("customers", "ix_customers_mobile", ["mobile"])
    _ensure_index("products", "ix_products_category", ["category"])

    product_constraints = {
        constraint["name"]: constraint
        for constraint in _inspector().get_unique_constraints("products")
    }
    if "products_barcode_key" in product_constraints:
        op.drop_constraint("products_barcode_key", "products", type_="unique")
    _ensure_index("products", "ix_products_barcode", ["barcode"], unique=True)

    _ensure_index(
        "sales_invoice_items",
        "ix_sales_invoice_items_invoice_id",
        ["invoice_id"],
    )
    _ensure_index(
        "sales_invoices",
        "ix_sales_invoices_customer_id",
        ["customer_id"],
    )


def _ensure_company_branch_foreign_keys() -> None:
    if not _has_table("companies") or not _has_table("branches"):
        raise RuntimeError(
            "Cannot reconcile company and branch references: companies or branches is missing."
        )

    _ensure_index("branches", "ix_branches_company_id", ["company_id"])
    _ensure_foreign_key(
        "branches",
        "company_id",
        "companies",
        "fk_branches_company_id",
    )

    for table in ("customer_groups", "customers", "products", "sales_invoices"):
        for column, referred_table in (
            ("company_id", "companies"),
            ("branch_id", "branches"),
        ):
            if column in _column_map(table):
                _ensure_foreign_key(
                    table,
                    column,
                    referred_table,
                    f"fk_{table}_{column}",
                )


def _ensure_auth_indexes() -> None:
    required = {
        "users": {
            "id", "uuid", "username", "email", "mobile", "hashed_password", "role",
            "is_active", "is_deleted", "company_id", "branch_id", "created_at",
            "modified_at",
        },
        "refresh_token_blacklist": {
            "id", "token_jti", "user_id", "revoked_at", "expires_at",
        },
    }
    for table, expected in required.items():
        missing = expected - set(_column_map(table))
        if missing:
            raise RuntimeError(
                f"Cannot repair {table}: required columns are missing: "
                f"{', '.join(sorted(missing))}."
            )

    enum_labels = {
        row[0]
        for row in _bind().execute(
            sa.text(
                """
                SELECT enumlabel
                FROM pg_enum
                JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
                WHERE pg_type.typname = 'userrole'
                """
            )
        ).fetchall()
    }
    if not {"SYSADMIN", "MANAGER", "CASHIER", "VIEWER"}.issubset(enum_labels):
        raise RuntimeError(
            "Cannot repair users: userrole enum is missing or has incompatible labels."
        )

    _ensure_unique_constraint("users", "uuid", "users_uuid_key")
    _ensure_index("users", "ix_users_branch_id", ["branch_id"])
    _ensure_index("users", "ix_users_company_id", ["company_id"])
    _ensure_index("users", "ix_users_email", ["email"], unique=True)
    _ensure_index("users", "ix_users_username", ["username"], unique=True)
    _ensure_index(
        "refresh_token_blacklist",
        "ix_refresh_token_blacklist_token_jti",
        ["token_jti"],
        unique=True,
    )
    _ensure_index(
        "refresh_token_blacklist",
        "ix_refresh_token_blacklist_user_id",
        ["user_id"],
    )
    _ensure_foreign_key(
        "users",
        "company_id",
        "companies",
        "users_company_id_fkey",
    )
    _ensure_foreign_key(
        "users",
        "branch_id",
        "branches",
        "users_branch_id_fkey",
    )
    _ensure_foreign_key(
        "refresh_token_blacklist",
        "user_id",
        "users",
        "refresh_token_blacklist_user_id_fkey",
        "CASCADE",
    )


def _ensure_purchase_table_columns() -> None:
    required = {
        "suppliers": {
            "id", "uuid", "name", "code", "gst_number", "mobile", "email",
            "address", "city", "state", "pincode", "outstanding", "company_id",
            "branch_id", "created_at", "modified_at", "created_by", "updated_by",
            "is_active", "is_deleted", "deleted_at", "deleted_by", "version",
        },
        "purchase_orders": {
            "id", "uuid", "order_no", "supplier_id", "status", "notes", "subtotal",
            "tax_total", "grand_total", "company_id", "branch_id", "created_at",
            "modified_at", "created_by", "updated_by", "is_active", "is_deleted",
            "deleted_at", "deleted_by", "version",
        },
        "purchase_order_items": {
            "id", "uuid", "order_id", "product_id", "code", "name", "quantity",
            "cost_price", "gst_rate", "tax_amount", "line_total", "company_id",
            "branch_id", "created_at", "modified_at", "created_by", "updated_by",
            "is_active", "is_deleted", "deleted_at", "deleted_by", "version",
        },
        "purchase_receipts": {
            "id", "uuid", "receipt_no", "supplier_id", "order_id", "status", "notes",
            "subtotal", "tax_total", "grand_total", "company_id", "branch_id",
            "created_at", "modified_at", "created_by", "updated_by", "is_active",
            "is_deleted", "deleted_at", "deleted_by", "version",
        },
        "purchase_receipt_items": {
            "id", "uuid", "receipt_id", "product_id", "code", "name",
            "quantity_ordered", "quantity_received", "cost_price", "gst_rate",
            "tax_amount", "line_total", "company_id", "branch_id", "created_at",
            "modified_at", "created_by", "updated_by", "is_active", "is_deleted",
            "deleted_at", "deleted_by", "version",
        },
    }
    for table, expected in required.items():
        missing = expected - set(_column_map(table))
        if missing:
            raise RuntimeError(
                f"Cannot safely repair partial purchase table {table}; "
                f"missing columns: {', '.join(sorted(missing))}."
            )

    for table, column in (
        ("suppliers", "uuid"),
        ("purchase_orders", "uuid"),
        ("purchase_order_items", "uuid"),
        ("purchase_receipts", "uuid"),
        ("purchase_receipts", "receipt_no"),
        ("purchase_receipt_items", "uuid"),
    ):
        _ensure_unique_constraint(table, column, f"{table}_{column}_key")


def _ensure_invoice_compatibility_columns() -> None:
    for name, column_type, server_default in _INVOICE_COMPAT_COLUMNS:
        _ensure_column(
            "sales_invoices",
            sa.Column(name, column_type, nullable=True, server_default=server_default),
        )
        if server_default is not None:
            column = _column_map("sales_invoices")[name]
            op.alter_column(
                "sales_invoices",
                name,
                existing_type=column["type"],
                server_default=server_default,
            )

    invoice_item_columns = _column_map("sales_invoice_items")
    if invoice_item_columns["invoice_id"]["nullable"]:
        null_count = _bind().execute(
            sa.text("SELECT count(*) FROM sales_invoice_items WHERE invoice_id IS NULL")
        ).scalar_one()
        if null_count:
            raise RuntimeError(
                "Cannot require sales_invoice_items.invoice_id: "
                f"{null_count} row(s) have no invoice."
            )
        op.alter_column(
            "sales_invoice_items",
            "invoice_id",
            existing_type=invoice_item_columns["invoice_id"]["type"],
            nullable=False,
        )


def _remove_generated_psv_columns() -> None:
    columns = _column_map("psv_sku_tracking")
    if "idx_psv_lying_stock" in {
        index["name"] for index in _inspector().get_indexes("psv_sku_tracking")
    }:
        op.drop_index("idx_psv_lying_stock", table_name="psv_sku_tracking")

    for column in ("lying_stock", "sell_through_pct"):
        if column in columns:
            op.drop_column("psv_sku_tracking", column)


def _ensure_identity_json_defaults() -> None:
    for table, column in (
        ("barcode_providers", "config"),
        ("identity_rules", "scope"),
        ("product_identities", "identity_metadata"),
    ):
        columns = _column_map(table)
        if column not in columns:
            raise RuntimeError(f"Cannot align identity schema: {table}.{column} is missing.")
        op.alter_column(
            table,
            column,
            existing_type=postgresql.JSONB(),
            server_default=sa.text("'{}'::jsonb"),
        )


def upgrade() -> None:
    _ensure_base_entity_columns()
    _ensure_baseline_indexes_and_types()
    _ensure_company_branch_foreign_keys()
    _ensure_auth_indexes()
    _ensure_purchase_table_columns()
    _ensure_invoice_compatibility_columns()
    _remove_generated_psv_columns()
    _ensure_identity_json_defaults()


def downgrade() -> None:
    raise RuntimeError(
        "Revision v1594 is a forward-only schema repair. Restore a database backup "
        "instead of dropping or reverting reconciled tenant schema."
    )
