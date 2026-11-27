"""Repair schema drift left by partially applied tenant migrations.

Revision ID: v1593
Revises: v1592
# @migration_target('tenant')
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

from alembic import op

revision: str = "v1593"
down_revision: str | Sequence[str] | None = "v1592"
branch_labels = None
depends_on = None

_PDT_TABLES = (
    "pdt_model_registry",
    "pdt_sku_twin_cache",
    "pdt_demand_signals",
    "pdt_distribution_predictions",
)


def _bind():
    return op.get_bind()


def _inspector():
    return sa.inspect(_bind())


def _column_names(table: str) -> set[str]:
    return {column["name"] for column in _inspector().get_columns(table)}


def _ensure_column(table: str, column: sa.Column) -> None:
    if column.name not in _column_names(table):
        op.add_column(table, column)


def _ensure_pricing_basis_constraint() -> None:
    inspector = _inspector()
    if not inspector.has_table("customers"):
        raise RuntimeError("Cannot repair pricing-basis constraint: customers is missing.")
    if "pricing_basis" not in _column_names("customers"):
        raise RuntimeError(
            "Cannot repair pricing-basis constraint: customers.pricing_basis is missing."
        )

    _bind().execute(
        sa.text(
            "UPDATE customers SET pricing_basis = 'MRP' "
            "WHERE pricing_basis IS NULL OR pricing_basis = ''"
        )
    )
    invalid_values = _bind().execute(
        sa.text(
            """
            SELECT pricing_basis, count(*)
            FROM customers
            WHERE pricing_basis IS NULL
               OR pricing_basis NOT IN ('MRP', 'RATE', 'WHOLESALE_PRICE', 'PRICE_BOOK')
            GROUP BY pricing_basis
            """
        )
    ).fetchall()
    if invalid_values:
        raise RuntimeError(
            "Cannot validate customers.pricing_basis: unsupported or NULL values remain."
        )

    existing = _bind().execute(
        sa.text(
            """
            SELECT convalidated
            FROM pg_constraint
            WHERE conrelid = 'customers'::regclass
              AND conname = 'chk_customers_pricing_basis'
              AND contype = 'c'
            """
        )
    ).scalar()
    if existing is None:
        op.create_check_constraint(
            "chk_customers_pricing_basis",
            "customers",
            "pricing_basis IN ('MRP', 'RATE', 'WHOLESALE_PRICE', 'PRICE_BOOK')",
        )
    elif not existing:
        _bind().execute(
            sa.text(
                "ALTER TABLE customers "
                "VALIDATE CONSTRAINT chk_customers_pricing_basis"
            )
        )


def _create_store_business_days() -> None:
    op.create_table(
        "store_business_days",
        sa.Column("id", sa.String(50), primary_key=True),
        sa.Column("uuid", sa.String(36), nullable=True),
        sa.Column("company_id", sa.String(50), nullable=True, index=True),
        sa.Column("branch_id", sa.String(50), nullable=False, index=True),
        sa.Column("business_date", sa.Date(), nullable=False, index=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="OPEN"),
        sa.Column("opened_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("locked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("opened_by", sa.String(100), nullable=True),
        sa.Column("closed_by", sa.String(100), nullable=True),
        sa.Column("locked_by", sa.String(100), nullable=True),
        sa.Column("sign_off_notes", sa.Text(), nullable=True),
        sa.Column("exception_summary_json", JSONB, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column("modified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", sa.String(100), nullable=True),
        sa.Column("updated_by", sa.String(100), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("TRUE")),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("FALSE")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", sa.String(50), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default=sa.text("1")),
    )


def _create_store_day_shift_assignments() -> None:
    op.create_table(
        "store_day_shift_assignments",
        sa.Column("id", sa.String(50), primary_key=True),
        sa.Column("uuid", sa.String(36), nullable=True),
        sa.Column("company_id", sa.String(50), nullable=True, index=True),
        sa.Column("branch_id", sa.String(50), nullable=True, index=True),
        sa.Column(
            "store_day_id",
            sa.String(50),
            sa.ForeignKey("store_business_days.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "shift_id",
            sa.String(50),
            sa.ForeignKey("shifts.id", ondelete="RESTRICT"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "assigned_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column("assigned_by", sa.String(100), nullable=True),
        sa.UniqueConstraint("shift_id", name="uq_shift_day_assignment"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column("modified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", sa.String(100), nullable=True),
        sa.Column("updated_by", sa.String(100), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("TRUE")),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("FALSE")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", sa.String(50), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default=sa.text("1")),
    )


def _ensure_store_day_indexes() -> None:
    indexes = {
        index["name"] for index in _inspector().get_indexes("store_business_days")
    }
    if "ix_store_business_days_branch_open" not in indexes:
        duplicate_open_day = _bind().execute(
            sa.text(
                """
                SELECT branch_id
                FROM store_business_days
                WHERE status = 'OPEN'
                GROUP BY branch_id
                HAVING count(*) > 1
                LIMIT 1
                """
            )
        ).first()
        if duplicate_open_day:
            raise RuntimeError(
                "Cannot create the one-open-business-day index: duplicate OPEN days exist."
            )
        op.create_index(
            "ix_store_business_days_branch_open",
            "store_business_days",
            ["branch_id"],
            unique=True,
            postgresql_where=sa.text("status = 'OPEN'"),
        )
    if "ix_store_business_days_branch_date" not in indexes:
        op.create_index(
            "ix_store_business_days_branch_date",
            "store_business_days",
            ["branch_id", "business_date"],
        )


def _ensure_store_day_foreign_key(
    table: str,
    column: str,
    referred_table: str,
    ondelete: str,
) -> None:
    if any(
        foreign_key["constrained_columns"] == [column]
        and foreign_key["referred_table"] == referred_table
        for foreign_key in _inspector().get_foreign_keys(table)
    ):
        return

    orphans = _bind().execute(
        sa.text(
            f"SELECT count(*) FROM {table} child "
            f"LEFT JOIN {referred_table} parent ON parent.id = child.{column} "
            f"WHERE child.{column} IS NOT NULL AND parent.id IS NULL"
        )
    ).scalar_one()
    if orphans:
        raise RuntimeError(
            f"Cannot add {table}.{column} foreign key: {orphans} orphaned value(s) exist."
        )
    op.create_foreign_key(
        f"fk_{table}_{column}_{referred_table}",
        table,
        referred_table,
        [column],
        ["id"],
        ondelete=ondelete,
    )


def _ensure_store_day_schema() -> None:
    inspector = _inspector()
    if not inspector.has_table("store_business_days"):
        _create_store_business_days()
    if not _inspector().has_table("store_day_shift_assignments"):
        if not _inspector().has_table("shifts"):
            raise RuntimeError(
                "Cannot create store_day_shift_assignments: shifts table is missing."
            )
        _create_store_day_shift_assignments()

    for table, columns in (
        (
            "store_business_days",
            (
                sa.Column("created_by", sa.String(100), nullable=True),
                sa.Column("updated_by", sa.String(100), nullable=True),
                sa.Column(
                    "is_deleted",
                    sa.Boolean(),
                    nullable=False,
                    server_default=sa.text("FALSE"),
                ),
            ),
        ),
        (
            "store_day_shift_assignments",
            (
                sa.Column("created_by", sa.String(100), nullable=True),
                sa.Column("updated_by", sa.String(100), nullable=True),
                sa.Column(
                    "is_deleted",
                    sa.Boolean(),
                    nullable=False,
                    server_default=sa.text("FALSE"),
                ),
                sa.Column("modified_at", sa.DateTime(timezone=True), nullable=True),
                sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
                sa.Column("deleted_by", sa.String(50), nullable=True),
            ),
        ),
    ):
        for column in columns:
            _ensure_column(table, column)

    required_columns = {
        "store_business_days": {
            "id", "uuid", "company_id", "branch_id", "business_date", "status",
            "opened_at", "closed_at", "locked_at", "opened_by", "closed_by",
            "locked_by", "sign_off_notes", "exception_summary_json", "created_at",
            "modified_at", "created_by", "updated_by", "is_active", "is_deleted",
            "deleted_at", "deleted_by", "version",
        },
        "store_day_shift_assignments": {
            "id", "uuid", "company_id", "branch_id", "store_day_id", "shift_id",
            "assigned_at", "assigned_by", "created_at", "modified_at", "created_by",
            "updated_by", "is_active", "is_deleted", "deleted_at", "deleted_by",
            "version",
        },
    }
    for table, required in required_columns.items():
        missing = required - _column_names(table)
        if missing:
            raise RuntimeError(
                f"Cannot safely repair partially created {table}: missing columns "
                f"{', '.join(sorted(missing))} require data-aware remediation."
            )

    _ensure_store_day_foreign_key(
        "store_day_shift_assignments",
        "store_day_id",
        "store_business_days",
        "CASCADE",
    )
    _ensure_store_day_foreign_key(
        "store_day_shift_assignments",
        "shift_id",
        "shifts",
        "RESTRICT",
    )

    assignment_constraints = _inspector().get_unique_constraints(
        "store_day_shift_assignments"
    )
    if not any(
        constraint["name"] == "uq_shift_day_assignment"
        for constraint in assignment_constraints
    ):
        duplicate_shift = _bind().execute(
            sa.text(
                """
                SELECT shift_id
                FROM store_day_shift_assignments
                GROUP BY shift_id
                HAVING count(*) > 1
                LIMIT 1
                """
            )
        ).first()
        if duplicate_shift:
            raise RuntimeError(
                "Cannot make shift assignments unique: duplicate shift assignments exist."
            )
        op.create_unique_constraint(
            "uq_shift_day_assignment",
            "store_day_shift_assignments",
            ["shift_id"],
        )

    _ensure_store_day_indexes()


def _ensure_warehouse_schema() -> None:
    inspector = _inspector()
    if not inspector.has_table("warehouses"):
        raise RuntimeError("Cannot repair warehouse indexes: warehouses is missing.")

    _ensure_column(
        "warehouses",
        sa.Column(
            "is_default_for_branch",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    indexes = {index["name"] for index in _inspector().get_indexes("warehouses")}
    if "uq_warehouse_branch_default" not in indexes:
        duplicates = _bind().execute(
            sa.text(
                """
                SELECT company_id, branch_id
                FROM warehouses
                WHERE is_default_for_branch = true AND is_deleted = false
                  AND company_id IS NOT NULL AND branch_id IS NOT NULL
                GROUP BY company_id, branch_id
                HAVING count(*) > 1
                LIMIT 1
                """
            )
        ).first()
        if duplicates:
            raise RuntimeError(
                "Cannot create default warehouse index: multiple active defaults "
                "exist for a company and branch."
            )
        op.create_index(
            "uq_warehouse_branch_default",
            "warehouses",
            ["company_id", "branch_id"],
            unique=True,
            postgresql_where=sa.text(
                "is_default_for_branch = true AND is_deleted = false"
            ),
        )

    indexes = {index["name"] for index in _inspector().get_indexes("warehouses")}
    if "uq_company_warehouse_code_active" not in indexes:
        duplicates = _bind().execute(
            sa.text(
                """
                SELECT company_id, code
                FROM warehouses
                WHERE is_deleted = false AND company_id IS NOT NULL AND code IS NOT NULL
                GROUP BY company_id, code
                HAVING count(*) > 1
                LIMIT 1
                """
            )
        ).first()
        if duplicates:
            raise RuntimeError(
                "Cannot create active warehouse-code index: duplicate active codes exist."
            )
        op.create_index(
            "uq_company_warehouse_code_active",
            "warehouses",
            ["company_id", "code"],
            unique=True,
            postgresql_where=sa.text("is_deleted = false"),
        )


def _ensure_sales_order_discount_columns() -> None:
    if not _inspector().has_table("sales_order_items"):
        raise RuntimeError("Cannot repair sales-order discounts: sales_order_items is missing.")
    _ensure_column(
        "sales_order_items",
        sa.Column(
            "discount_percent",
            sa.Numeric(5, 2),
            nullable=False,
            server_default="0",
        ),
    )
    _ensure_column(
        "sales_order_items",
        sa.Column(
            "discount_amount",
            sa.Numeric(15, 2),
            nullable=False,
            server_default="0",
        ),
    )


def _has_foreign_key(table: str, column: str, referred_table: str) -> bool:
    return any(
        foreign_key["constrained_columns"] == [column]
        and foreign_key["referred_table"] == referred_table
        for foreign_key in _inspector().get_foreign_keys(table)
    )


def _ensure_pdt_base_entity_columns() -> None:
    bind = _bind()
    for table in _PDT_TABLES:
        if not _inspector().has_table(table):
            raise RuntimeError(f"Cannot align PDT BaseEntity fields: table '{table}' is missing.")

        columns = {column["name"]: column for column in _inspector().get_columns(table)}
        if "uuid" not in columns:
            op.add_column(
                table,
                sa.Column(
                    "uuid",
                    sa.String(36),
                    nullable=False,
                    server_default=sa.text("gen_random_uuid()::text"),
                ),
            )
        elif columns["uuid"]["nullable"]:
            bind.execute(
                sa.text(f"UPDATE {table} SET uuid = gen_random_uuid()::text WHERE uuid IS NULL")
            )
            op.alter_column(
                table,
                "uuid",
                existing_type=columns["uuid"]["type"],
                nullable=False,
            )

        unique_constraints = {
            constraint["name"]
            for constraint in _inspector().get_unique_constraints(table)
        }
        uuid_constraint = f"uq_{table}_uuid"
        if uuid_constraint not in unique_constraints:
            duplicate_uuid = bind.execute(
                sa.text(
                    f"SELECT uuid FROM {table} GROUP BY uuid "
                    "HAVING count(*) > 1 LIMIT 1"
                )
            ).first()
            if duplicate_uuid:
                raise RuntimeError(
                    f"Cannot add unique UUID constraint to '{table}': "
                    "duplicate UUID values exist."
                )
            op.create_unique_constraint(uuid_constraint, table, ["uuid"])

        _ensure_column(table, sa.Column("company_id", sa.String(50), nullable=True))
        _ensure_column(table, sa.Column("branch_id", sa.String(50), nullable=True))
        for column, referred_table in (
            ("company_id", "companies"),
            ("branch_id", "branches"),
        ):
            if _has_foreign_key(table, column, referred_table):
                continue
            orphan_count = bind.execute(
                sa.text(
                    f"SELECT count(*) FROM {table} child "
                    f"LEFT JOIN {referred_table} parent ON parent.id = child.{column} "
                    f"WHERE child.{column} IS NOT NULL AND parent.id IS NULL"
                )
            ).scalar_one()
            if orphan_count:
                raise RuntimeError(
                    f"Cannot add {column} foreign key to '{table}': "
                    f"{orphan_count} orphaned value(s) exist."
                )
            op.create_foreign_key(
                f"fk_{table}_{column}_{referred_table}",
                table,
                referred_table,
                [column],
                ["id"],
                ondelete="RESTRICT",
            )

        for column in (
            sa.Column(
                "modified_at",
                sa.DateTime(timezone=True),
                nullable=True,
                server_default=sa.text("now()"),
            ),
            sa.Column("created_by", sa.String(100), nullable=True),
            sa.Column("updated_by", sa.String(100), nullable=True),
            sa.Column(
                "is_active",
                sa.Boolean(),
                nullable=True,
                server_default=sa.text("true"),
            ),
            sa.Column(
                "is_deleted",
                sa.Boolean(),
                nullable=True,
                server_default=sa.text("false"),
            ),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("deleted_by", sa.String(100), nullable=True),
        ):
            _ensure_column(table, column)
        if table != "pdt_model_registry":
            _ensure_column(
                table,
                sa.Column("version", sa.Integer(), nullable=True, server_default=sa.text("1")),
            )


def upgrade() -> None:
    _ensure_pricing_basis_constraint()
    _ensure_store_day_schema()
    _ensure_warehouse_schema()
    _ensure_sales_order_discount_columns()
    _ensure_pdt_base_entity_columns()


def downgrade() -> None:
    raise RuntimeError(
        "Revision v1593 is a forward-only schema repair. Restore from a database backup "
        "instead of dropping repaired columns or constraints."
    )
