"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.22.0
Created      : 2026-08-23
Modified     : 2026-08-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

FORWARD-ONLY MIGRATION -- see ADR-POS-002

Preconditions verified before applying this migration:
  1. Zero orphan account_id values in shift_cash_transactions
     (all account_id references exist in accounts table)
  2. Zero orphan gl_voucher_id on shift_cash_transactions
     (all gl_voucher_id references exist in journal_vouchers table)
  3. DEFERRABLE INITIALLY DEFERRED DDL validated with PostgreSQL

Run precondition checks:
  SELECT COUNT(*) FROM shift_cash_transactions sct
    LEFT JOIN accounts acc ON acc.id = sct.account_id
   WHERE sct.account_id IS NOT NULL AND acc.id IS NULL;

  SELECT COUNT(*) FROM shift_cash_transactions sct
    LEFT JOIN journal_vouchers jv ON jv.id = sct.gl_voucher_id
   WHERE sct.gl_voucher_id IS NOT NULL AND jv.id IS NULL;

Both must return 0 before applying.
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic (<= 32 characters).
revision: str = "v1360_pos_sct_fk_constraints"
down_revision: Union[str, None] = "v1346_pos_cash_denominations"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    """
    Add DEFERRABLE INITIALLY DEFERRED FK constraints on ShiftCashTransaction
    GL reference columns.

    DEFERRABLE INITIALLY DEFERRED means:
      - Constraints are checked at COMMIT time, not at statement time.
      - This is required because gl_voucher_id is written after SCT flush
        within the same transaction; an immediate constraint would fail.
      - The DEFERRED mode ensures both SCT and JournalVoucher are committed
        atomically before the DB engine checks the FK relationship.

    PostgreSQL-specific DDL — not portable to SQLite.
    """
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    # Guard: only apply if the tables exist (idempotent)
    if "shift_cash_transactions" not in tables:
        return
    if "accounts" not in tables:
        return
    if "journal_vouchers" not in tables:
        return

    # ------------------------------------------------------------------
    # Precondition verification at migration time
    # ------------------------------------------------------------------
    result = conn.execute(sa.text("""
        SELECT COUNT(*)
          FROM shift_cash_transactions sct
          LEFT JOIN accounts acc ON acc.id = sct.account_id
         WHERE sct.account_id IS NOT NULL
           AND acc.id IS NULL
    """))
    orphan_accounts = result.scalar()
    if orphan_accounts and orphan_accounts > 0:
        raise RuntimeError(
            f"MIGRATION BLOCKED: {orphan_accounts} row(s) in shift_cash_transactions "
            f"have account_id values that do not exist in accounts table. "
            f"Resolve orphans before applying v1360. See ADR-POS-002."
        )

    result2 = conn.execute(sa.text("""
        SELECT COUNT(*)
          FROM shift_cash_transactions sct
          LEFT JOIN journal_vouchers jv ON jv.id = sct.gl_voucher_id
         WHERE sct.gl_voucher_id IS NOT NULL
           AND jv.id IS NULL
    """))
    orphan_vouchers = result2.scalar()
    if orphan_vouchers and orphan_vouchers > 0:
        raise RuntimeError(
            f"MIGRATION BLOCKED: {orphan_vouchers} row(s) in shift_cash_transactions "
            f"have gl_voucher_id values that do not exist in journal_vouchers table. "
            f"Resolve orphans before applying v1360. See ADR-POS-002."
        )

    # ------------------------------------------------------------------
    # Check whether constraints already exist (idempotent re-run safety)
    # ------------------------------------------------------------------
    existing_constraints = {
        c["name"]
        for c in inspector.get_foreign_keys("shift_cash_transactions")
    }

    # FK on account_id -> accounts.id
    if "fk_sct_account_id" not in existing_constraints:
        op.execute(sa.text("""
            ALTER TABLE shift_cash_transactions
              ADD CONSTRAINT fk_sct_account_id
                FOREIGN KEY (account_id)
                REFERENCES accounts(id)
                ON DELETE RESTRICT
                DEFERRABLE INITIALLY DEFERRED
        """))

    # FK on gl_voucher_id -> journal_vouchers.id
    if "fk_sct_gl_voucher_id" not in existing_constraints:
        op.execute(sa.text("""
            ALTER TABLE shift_cash_transactions
              ADD CONSTRAINT fk_sct_gl_voucher_id
                FOREIGN KEY (gl_voucher_id)
                REFERENCES journal_vouchers(id)
                ON DELETE RESTRICT
                DEFERRABLE INITIALLY DEFERRED
        """))


def downgrade():
    """
    FORWARD-ONLY MIGRATION -- downgrade is intentionally blocked.

    Financial integrity: removing FK constraints from shift_cash_transactions
    after they have been enforced would silently allow orphaned GL references
    to accumulate. This is a governance violation.

    Rollback procedure:
      1. Stop all POS services.
      2. Run the precondition queries from the migration header.
      3. Restore from a pre-migration database backup.
      4. Apply a forward repair migration if schema correction is needed.
    """
    raise NotImplementedError(
        "v1360_pos_sct_fk_constraints is a FORWARD-ONLY migration. "
        "Downgrade is blocked by financial data governance policy (ADR-POS-002). "
        "To revert, restore from a pre-migration backup and apply a forward repair migration."
    )
