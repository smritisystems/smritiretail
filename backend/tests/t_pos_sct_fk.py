"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.24.0
Created      : 2026-08-25
Modified     : 2026-08-25
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import uuid
import pytest
from decimal import Decimal
import psycopg2
import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.db.session import get_company_sessionmaker
from app.services.db_resolver import CompanyDatabaseResolver


def test_pos_sct_fk_constraints_and_zero_orphans():
    """
    P0.1 Certification: Verify shift_cash_transactions Foreign Key constraints
    and zero orphan records across all tenant databases.
    """
    for db_name in ["smriti001", "smriti002", "smritisys"]:
        try:
            conn = psycopg2.connect(f"postgresql://postgres:postgres@localhost:5432/{db_name}")
            cur = conn.cursor()

            # 1. Verify constraints exist
            cur.execute("""
                SELECT constraint_name
                FROM information_schema.table_constraints
                WHERE table_name = 'shift_cash_transactions' AND constraint_type = 'FOREIGN KEY';
            """)
            fks = {r[0] for r in cur.fetchall()}
            assert "fk_sct_account_id" in fks, f"Missing fk_sct_account_id in {db_name}"
            assert "fk_sct_gl_voucher_id" in fks, f"Missing fk_sct_gl_voucher_id in {db_name}"

            # 2. Check orphan accounts
            cur.execute("""
                SELECT COUNT(*)
                FROM shift_cash_transactions sct
                LEFT JOIN accounts acc ON acc.id = sct.account_id
                WHERE sct.account_id IS NOT NULL AND acc.id IS NULL;
            """)
            orphan_accs = cur.fetchone()[0]
            assert orphan_accs == 0, f"Found {orphan_accs} orphan accounts in {db_name}"

            # 3. Check orphan vouchers
            cur.execute("""
                SELECT COUNT(*)
                FROM shift_cash_transactions sct
                LEFT JOIN journal_vouchers jv ON jv.id = sct.gl_voucher_id
                WHERE sct.gl_voucher_id IS NOT NULL AND jv.id IS NULL;
            """)
            orphan_vouchers = cur.fetchone()[0]
            assert orphan_vouchers == 0, f"Found {orphan_vouchers} orphan vouchers in {db_name}"

            conn.close()
        except Exception as e:
            pytest.fail(f"Database check failed for {db_name}: {e}")


def test_v1360_forward_only_migration_governance():
    """
    Verify v1360_pos_sct_fk_constraints blocks downgrade by raising NotImplementedError
    per financial data governance policy (ADR-POS-002).
    """
    import importlib.util
    spec = importlib.util.spec_from_file_location(
        "v1360",
        r"F:\SMRITRretailNX\backend\alembic\versions\v1360_pos_sct_fk_constraints.py"
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)

    assert hasattr(mod, "upgrade"), "v1360 must have upgrade function"
    assert hasattr(mod, "downgrade"), "v1360 must have downgrade function"

    with pytest.raises(NotImplementedError, match="FORWARD-ONLY migration"):
        mod.downgrade()


@pytest.mark.asyncio
async def test_pos_sct_fk_rejection_on_invalid_account_id():
    """
    Verify database enforces foreign key constraint when inserting invalid account_id.
    """
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        # Fetch a valid shift ID
        res = await session.execute(text("SELECT id FROM shifts LIMIT 1;"))
        shift_id = res.scalar() or "SH-TEST-001"

        fake_acc_id = f"acc-invalid-{uuid.uuid4().hex[:8]}"
        fake_tx_id = f"sct-test-{uuid.uuid4().hex[:8]}"

        # Attempt insertion with invalid account_id
        with pytest.raises(Exception) as exc_info:
            await session.execute(text("""
                INSERT INTO shift_cash_transactions (
                    id, uuid, company_id, branch_id, shift_id, transaction_type,
                    amount, reason, performed_by, account_id, created_at, modified_at,
                    is_active, is_deleted, version
                ) VALUES (
                    :id, :uuid, 'COMP-001', 'BR-001', :shift_id, 'PAID_IN',
                    100.00, 'Test invalid account', 'usr-test-runner', :acc_id, NOW(), NOW(),
                    true, false, 1
                );
            """), {
                "id": fake_tx_id,
                "uuid": str(uuid.uuid4()),
                "shift_id": shift_id,
                "acc_id": fake_acc_id
            })
            await session.commit()

        err_str = str(exc_info.value)
        assert "fk_sct_account_id" in err_str or "violates foreign key constraint" in err_str
        await session.rollback()


@pytest.mark.asyncio
async def test_pos_sct_fk_rejection_on_invalid_gl_voucher_id():
    """
    Verify database enforces foreign key constraint when inserting invalid gl_voucher_id.
    """
    session_factory = get_company_sessionmaker("smriti001")
    async with session_factory() as session:
        res = await session.execute(text("SELECT id FROM shifts LIMIT 1;"))
        shift_id = res.scalar() or "SH-TEST-001"

        fake_voucher_id = f"jv-invalid-{uuid.uuid4().hex[:8]}"
        fake_tx_id = f"sct-test-{uuid.uuid4().hex[:8]}"

        # Attempt insertion with invalid gl_voucher_id
        with pytest.raises(Exception) as exc_info:
            await session.execute(text("""
                INSERT INTO shift_cash_transactions (
                    id, uuid, company_id, branch_id, shift_id, transaction_type,
                    amount, reason, performed_by, gl_voucher_id, created_at, modified_at,
                    is_active, is_deleted, version
                ) VALUES (
                    :id, :uuid, 'COMP-001', 'BR-001', :shift_id, 'PAID_IN',
                    100.00, 'Test invalid gl voucher', 'usr-test-runner', :voucher_id, NOW(), NOW(),
                    true, false, 1
                );
            """), {
                "id": fake_tx_id,
                "uuid": str(uuid.uuid4()),
                "shift_id": shift_id,
                "voucher_id": fake_voucher_id
            })
            await session.commit()

        err_str = str(exc_info.value)
        assert "fk_sct_gl_voucher_id" in err_str or "violates foreign key constraint" in err_str
        await session.rollback()
