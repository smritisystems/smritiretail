"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Version      : 1.0.0
Created      : 2026-10-27
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

Description  : G5 Remediation -- Historical Transaction Immutability Sprint.
               Adds valuation_method_used to invoice_profitability_ledgers.

               InvoiceProfitabilityLedger stores the rolled-up COGS and net
               contribution for a posted invoice. Before this migration the
               COGS figure was present but the method used to derive it
               (WEIGHTED_AVERAGE, FIFO, LANDED_COST, LAST_PURCHASE, etc.)
               was not recorded. TransactionCostSnapshot already carried this
               per-line; this column promotes the dominant method to the ledger
               header for direct audit and reporting.

               If a single invoice uses multiple methods across its lines
               (e.g. some WAC, some LANDED), the stamped value is
               'MIXED' to avoid false precision.

               Zero-destructive: nullable. Existing rows will be NULL
               (pre-v1550); the service stamps from this version onward.

               v1550a: Changed to IF NOT EXISTS DDL so migration is safe to
               replay against test databases cloned from a live template that
               already has the column applied.
"""

import sqlalchemy as sa
from alembic import op

revision = "v1550"
down_revision = "v1549"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Raw DDL with IF NOT EXISTS makes this migration idempotent.
    # Test databases are cloned from the live template (which already had
    # v1550 applied) so a plain ADD COLUMN would fail with DuplicateColumn.
    op.execute(
        "ALTER TABLE invoice_profitability_ledgers "
        "ADD COLUMN IF NOT EXISTS valuation_method_used VARCHAR(30)"
    )
    print("  v1550: valuation_method_used on invoice_profitability_ledgers (idempotent)")


def downgrade() -> None:
    op.execute(
        "ALTER TABLE invoice_profitability_ledgers "
        "DROP COLUMN IF EXISTS valuation_method_used"
    )
