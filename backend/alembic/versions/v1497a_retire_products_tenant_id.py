"""v1497a: retire products.tenant_id (I-001) — tenant-plane migration

Table: smriti001.products.tenant_id

5-Gate retirement evidence (all gates passed before commit):
  Gate 1 — Row-level data: 1899 rows, 0 populated. Confirmed 2026-09-29.
  Gate 2 — Write paths: grep api/v1/**, services/** — zero write sites.
            item_master_svc.py writes tenant_id to IdentityEngine (not products).
  Gate 3 — No FK constraint exists on products.tenant_id.
  Gate 4 — DDL archived: character varying, nullable, no default.
  Gate 5 — Test suite green before and after.

Run as: alembic -x target=tenant -x db=smriti001 upgrade v1497a

Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Version      : 1.0.0
Created      : 2026-09-29
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from alembic import op
import sqlalchemy as sa

revision = "v1497a"
down_revision = "v1496"
branch_labels = None
depends_on = None


def _is_system_or_control_db(bind) -> bool:
    current_db = bind.execute(sa.text("SELECT current_database();")).scalar()
    return not current_db or current_db.lower() in ("smritisys", "postgres", "template0", "template1")


def upgrade() -> None:
    bind = op.get_bind()
    if _is_system_or_control_db(bind):
        return
    col_exists = bind.execute(sa.text(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name = 'products' AND column_name = 'tenant_id'"
    )).scalar()
    if col_exists:
        result = bind.execute(
            sa.text("SELECT COUNT(*) FROM products WHERE tenant_id IS NOT NULL")
        )
        count = result.scalar()
        if count != 0:
            raise RuntimeError(
                f"v1497a upgrade aborted: products.tenant_id is not empty "
                f"({count} non-NULL rows). Investigate before retiring."
            )
        op.drop_column("products", "tenant_id")


def downgrade() -> None:
    bind = op.get_bind()
    if _is_system_or_control_db(bind):
        return
    op.add_column(
        "products",
        sa.Column("tenant_id", sa.String(50), nullable=True),
    )
