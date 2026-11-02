# -----------------------------------------------------------------------------
# Project      : SMRITI Retail OS
# Author       : Jawahar Ramkripal Mallah
# Designation  : Chief Systems Architect & Creator
# Email        : support@smritibooks.com
# Websites     : smritibooks.com | erpnbook.com | aitdl.com
# Version      : 3.17.0
# Created      : 2026-11-02
# Copyright    : © SMRITIBooks.com. All Rights Reserved.
# License      : Proprietary Commercial Software
# Classification: Internal
# -----------------------------------------------------------------------------
"""Correct TT2026 invoices incorrectly labeled as cash.

Revision ID: v1575
Revises: v1574
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "v1575"
down_revision: Union[str, Sequence[str], None] = "v1574"
branch_labels = None
depends_on = None


_CORRECTION = """
DO $$
DECLARE
    matching_count INTEGER;
    updated_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO matching_count
    FROM sales_invoices
    WHERE invoice_no LIKE 'TT2026-2027/%'
      AND status = 'Submitted'
      AND payment_mode = 'CASH'
      AND paid_amount = 0
      AND balance_amount = grand_total
      AND grand_total > 0;

    IF matching_count = 0 THEN
        RETURN;
    ELSIF matching_count <> 54 THEN
        RAISE EXCEPTION
            'TT2026 credit correction expected 54 qualifying invoices, found %; no rows changed',
            matching_count;
    END IF;

    UPDATE sales_invoices
    SET payment_mode = 'CREDIT',
        modified_at = CURRENT_TIMESTAMP,
        updated_by = 'v1575_tt2026_credit_correction'
    WHERE invoice_no LIKE 'TT2026-2027/%'
      AND status = 'Submitted'
      AND payment_mode = 'CASH'
      AND paid_amount = 0
      AND balance_amount = grand_total
      AND grand_total > 0;

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    IF updated_count <> 54 THEN
        RAISE EXCEPTION
            'TT2026 credit correction updated % invoices; expected 54',
            updated_count;
    END IF;
END
$$;
"""


def upgrade() -> None:
    op.execute(sa.text(_CORRECTION))


def downgrade() -> None:
    # Keep posted invoice payment-mode corrections; reverting would misstate terms.
    pass
