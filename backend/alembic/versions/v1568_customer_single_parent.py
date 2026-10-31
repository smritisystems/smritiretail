"""Enforce one active parent account per customer and company.

Revision ID: v1568
Revises: v1567
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "v1568"
down_revision: Union[str, Sequence[str], None] = "v1567"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


INDEX_NAME = "uq_customer_relationship_company_dependant_active"
LEGACY_CONSTRAINT = "uq_customer_relationship_pair"


def _inspector():
    return sa.inspect(op.get_bind())


def upgrade() -> None:
    if op.get_bind().exec_driver_sql("SELECT current_database()").scalar() == "smritisys":
        return

    if not _inspector().has_table("customer_relationships"):
        raise RuntimeError(
            "Cannot enforce single-parent customer policy: "
            "customer_relationships table is missing."
        )

    connection = op.get_bind()
    unscoped_ids = connection.execute(sa.text("""
        SELECT id
        FROM customer_relationships
        WHERE is_deleted = false AND company_id IS NULL
        ORDER BY id
    """)).scalars().all()
    if unscoped_ids:
        raise RuntimeError(
            "Cannot enforce single-parent customer policy: active relationships "
            f"have no company scope (IDs: {', '.join(unscoped_ids)}). "
            "Reconcile these records before retrying this migration."
        )

    conflicts = connection.execute(sa.text("""
        SELECT company_id, dependant_customer_id, array_agg(id ORDER BY id) AS ids
        FROM customer_relationships
        WHERE is_deleted = false
        GROUP BY company_id, dependant_customer_id
        HAVING count(*) > 1
        ORDER BY company_id, dependant_customer_id
    """)).all()
    if conflicts:
        details = "; ".join(
            f"company={row.company_id}, child={row.dependant_customer_id}, "
            f"relationship_ids={', '.join(row.ids)}"
            for row in conflicts
        )
        raise RuntimeError(
            "Cannot enforce single-parent customer policy while active child "
            f"relationships are ambiguous: {details}. Reconcile before retrying."
        )

    unique_constraints = {
        constraint["name"]
        for constraint in _inspector().get_unique_constraints("customer_relationships")
    }
    if LEGACY_CONSTRAINT in unique_constraints:
        op.drop_constraint(
            LEGACY_CONSTRAINT,
            "customer_relationships",
            type_="unique",
        )

    indexes = {
        index["name"] for index in _inspector().get_indexes("customer_relationships")
    }
    if INDEX_NAME not in indexes:
        op.create_index(
            INDEX_NAME,
            "customer_relationships",
            ["company_id", "dependant_customer_id"],
            unique=True,
            postgresql_where=sa.text("is_deleted = false"),
        )


def downgrade() -> None:
    indexes = {
        index["name"] for index in _inspector().get_indexes("customer_relationships")
    }
    if INDEX_NAME in indexes:
        op.drop_index(INDEX_NAME, table_name="customer_relationships")

    duplicates = op.get_bind().execute(sa.text("""
        SELECT parent_customer_id, dependant_customer_id, array_agg(id ORDER BY id) AS ids
        FROM customer_relationships
        GROUP BY parent_customer_id, dependant_customer_id
        HAVING count(*) > 1
        ORDER BY parent_customer_id, dependant_customer_id
    """)).all()
    if duplicates:
        details = "; ".join(
            f"parent={row.parent_customer_id}, child={row.dependant_customer_id}, "
            f"relationship_ids={', '.join(row.ids)}"
            for row in duplicates
        )
        raise RuntimeError(
            "Cannot restore the legacy customer relationship constraint after "
            f"historical parent reassignment: {details}."
        )
    op.create_unique_constraint(
        LEGACY_CONSTRAINT,
        "customer_relationships",
        ["parent_customer_id", "dependant_customer_id"],
    )
