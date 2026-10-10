"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-10-01
Modified     : 2026-10-01
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

Migration v1509
───────────────
Purpose : Add merged_into_party_id column to parties table.
          The Party ORM model (party.py v6.16.0) defines this column but it
          was never materialised via Alembic, causing
          asyncpg.UndefinedColumnError on any query that touches parties.
Scope   : Tenant databases only.
Down    : Drop the column (safe — NULL only, no FK constraint).
"""

from alembic import op
import sqlalchemy as sa

revision = "v1509"
down_revision = "v1508"
branch_labels = None
depends_on = None

# ── Guard helpers ─────────────────────────────────────────────────────────────

def _is_system_or_control_db(conn) -> bool:
    """Skip control-plane databases (smritisys, postgres, template*)."""
    dbname = conn.execute(sa.text("SELECT current_database()")).scalar()
    return dbname in ("smritisys", "postgres", "template0", "template1")


def _column_exists(conn, table: str, column: str) -> bool:
    row = conn.execute(sa.text(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name = :t AND column_name = :c"
    ), {"t": table, "c": column}).fetchone()
    return row is not None


# ── Upgrade ───────────────────────────────────────────────────────────────────

def upgrade() -> None:
    conn = op.get_bind()
    if _is_system_or_control_db(conn):
        return

    if not _column_exists(conn, "parties", "merged_into_party_id"):
        op.add_column(
            "parties",
            sa.Column("merged_into_party_id", sa.String(50), nullable=True),
        )
        op.create_index(
            "ix_parties_merged_into_party_id",
            "parties",
            ["merged_into_party_id"],
        )


# ── Downgrade ─────────────────────────────────────────────────────────────────

def downgrade() -> None:
    conn = op.get_bind()
    if _is_system_or_control_db(conn):
        return

    if _column_exists(conn, "parties", "merged_into_party_id"):
        op.drop_index("ix_parties_merged_into_party_id", table_name="parties")
        op.drop_column("parties", "merged_into_party_id")
