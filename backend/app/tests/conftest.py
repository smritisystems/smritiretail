"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.21.0
Created      : 2026-07-11
Modified     : 2026-08-17
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import os
os.environ.setdefault("JWT_SECRET_KEY", "dev-test-jwt-secret-key-32-chars-long-smriti")
os.environ.setdefault("INTERNAL_SERVICE_KEY", "dev-test-internal-service-key-32-chars")
import asyncio
import sys

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

# Force SelectorEventLoop on Windows to avoid proactor loop lifecycle race conditions in tests
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

@pytest.fixture(scope="session")
def event_loop():
    """Create a session-scoped event loop to prevent event loop mismatch errors."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture(scope="session", autouse=True)
def restore_baseline_after_tests():
    """Restores development baseline users and companies after pytest completes."""
    yield
    try:
        try:
            from app.db.seed_baseline_users import seed
        except ImportError:
            from backend.app.db.seed_baseline_users import seed
        import asyncio
        asyncio.run(seed())
    except Exception as e:
        print(f"[conftest] Post-test seed error: {e}")

@pytest.fixture
async def db_engine():
    engine = create_async_engine(settings.DATABASE_URL)
    from app.db.base import Base
    from sqlalchemy import text
    import app.models.psv  # noqa: F401
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        try:
            await conn.execute(text("""
                DO $$
                BEGIN
                    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'journal_vouchers') THEN
                        ALTER TABLE journal_vouchers ADD COLUMN IF NOT EXISTS voucher_no VARCHAR(100);
                        ALTER TABLE journal_vouchers ADD COLUMN IF NOT EXISTS voucher_type VARCHAR(50) DEFAULT 'JOURNAL';
                        ALTER TABLE journal_vouchers ADD COLUMN IF NOT EXISTS voucher_date DATE DEFAULT CURRENT_DATE;
                        ALTER TABLE journal_vouchers ADD COLUMN IF NOT EXISTS posting_date TIMESTAMPTZ DEFAULT NOW();
                        ALTER TABLE journal_vouchers ADD COLUMN IF NOT EXISTS reference_doc_type VARCHAR(50);
                        ALTER TABLE journal_vouchers ADD COLUMN IF NOT EXISTS reference_doc_id VARCHAR(50);
                        ALTER TABLE journal_vouchers ADD COLUMN IF NOT EXISTS reference_doc_no VARCHAR(100);
                        ALTER TABLE journal_vouchers ADD COLUMN IF NOT EXISTS narration TEXT;
                        ALTER TABLE journal_vouchers ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'INR';
                        ALTER TABLE journal_vouchers ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(18,6) DEFAULT 1.000000;
                        ALTER TABLE journal_vouchers ADD COLUMN IF NOT EXISTS total_foreign_debit NUMERIC(15,2) DEFAULT 0.00;
                        ALTER TABLE journal_vouchers ADD COLUMN IF NOT EXISTS total_foreign_credit NUMERIC(15,2) DEFAULT 0.00;
                        ALTER TABLE journal_vouchers ADD COLUMN IF NOT EXISTS total_debit NUMERIC(15,2) DEFAULT 0.00;
                        ALTER TABLE journal_vouchers ADD COLUMN IF NOT EXISTS total_credit NUMERIC(15,2) DEFAULT 0.00;
                        ALTER TABLE journal_vouchers ADD COLUMN IF NOT EXISTS is_posted BOOLEAN DEFAULT TRUE;
                        ALTER TABLE journal_vouchers ADD COLUMN IF NOT EXISTS is_cancelled BOOLEAN DEFAULT FALSE;
                        ALTER TABLE journal_vouchers ADD COLUMN IF NOT EXISTS posted_at TIMESTAMPTZ;
                        ALTER TABLE journal_vouchers ADD COLUMN IF NOT EXISTS created_by VARCHAR(100);
                        BEGIN
                            ALTER TABLE journal_vouchers ALTER COLUMN ref_document_type DROP NOT NULL;
                        EXCEPTION WHEN OTHERS THEN NULL;
                        END;
                        BEGIN
                            ALTER TABLE journal_vouchers ALTER COLUMN ref_document_id DROP NOT NULL;
                        EXCEPTION WHEN OTHERS THEN NULL;
                        END;
                        BEGIN
                            ALTER TABLE journal_vouchers ALTER COLUMN ref_document_no DROP NOT NULL;
                        EXCEPTION WHEN OTHERS THEN NULL;
                        END;
                    END IF;
                    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'general_ledger_entries') THEN
                        ALTER TABLE general_ledger_entries ADD COLUMN IF NOT EXISTS voucher_id VARCHAR(50);
                        ALTER TABLE general_ledger_entries ADD COLUMN IF NOT EXISTS account_id VARCHAR(50);
                        ALTER TABLE general_ledger_entries ADD COLUMN IF NOT EXISTS entry_type VARCHAR(10);
                        ALTER TABLE general_ledger_entries ADD COLUMN IF NOT EXISTS posting_date TIMESTAMPTZ DEFAULT NOW();
                        ALTER TABLE general_ledger_entries ADD COLUMN IF NOT EXISTS amount NUMERIC(15,2) DEFAULT 0.00;
                        ALTER TABLE general_ledger_entries ADD COLUMN IF NOT EXISTS debit_amount NUMERIC(15,2) DEFAULT 0.00;
                        ALTER TABLE general_ledger_entries ADD COLUMN IF NOT EXISTS credit_amount NUMERIC(15,2) DEFAULT 0.00;
                        ALTER TABLE general_ledger_entries ADD COLUMN IF NOT EXISTS foreign_amount NUMERIC(15,2) DEFAULT 0.00;
                        ALTER TABLE general_ledger_entries ADD COLUMN IF NOT EXISTS foreign_debit NUMERIC(15,2) DEFAULT 0.00;
                        ALTER TABLE general_ledger_entries ADD COLUMN IF NOT EXISTS foreign_credit NUMERIC(15,2) DEFAULT 0.00;
                        ALTER TABLE general_ledger_entries ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'INR';
                        ALTER TABLE general_ledger_entries ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(18,6) DEFAULT 1.000000;
                        ALTER TABLE general_ledger_entries ADD COLUMN IF NOT EXISTS narration TEXT;
                        ALTER TABLE general_ledger_entries ADD COLUMN IF NOT EXISTS reference_doc_type VARCHAR(50);
                        ALTER TABLE general_ledger_entries ADD COLUMN IF NOT EXISTS reference_doc_id VARCHAR(50);
                    END IF;
                    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'fiscal_periods') THEN
                        ALTER TABLE fiscal_periods ADD COLUMN IF NOT EXISTS fiscal_year_id VARCHAR(50);
                        ALTER TABLE fiscal_periods ADD COLUMN IF NOT EXISTS period_name VARCHAR(50) DEFAULT 'P1';
                        ALTER TABLE fiscal_periods ADD COLUMN IF NOT EXISTS period_number INTEGER DEFAULT 1;
                        ALTER TABLE fiscal_periods ADD COLUMN IF NOT EXISTS start_date DATE DEFAULT CURRENT_DATE;
                        ALTER TABLE fiscal_periods ADD COLUMN IF NOT EXISTS end_date DATE DEFAULT CURRENT_DATE;
                        ALTER TABLE fiscal_periods ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'OPEN';
                        ALTER TABLE fiscal_periods ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
                        ALTER TABLE fiscal_periods ADD COLUMN IF NOT EXISTS closed_by VARCHAR(100);
                    END IF;
                    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'fiscal_years') THEN
                        ALTER TABLE fiscal_years ADD COLUMN IF NOT EXISTS financial_year_code VARCHAR(20) DEFAULT 'FY2026-27';
                        ALTER TABLE fiscal_years ADD COLUMN IF NOT EXISTS start_date DATE DEFAULT CURRENT_DATE;
                        ALTER TABLE fiscal_years ADD COLUMN IF NOT EXISTS end_date DATE DEFAULT CURRENT_DATE;
                        ALTER TABLE fiscal_years ADD COLUMN IF NOT EXISTS is_closed BOOLEAN DEFAULT FALSE;
                        ALTER TABLE fiscal_years ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE;
                        ALTER TABLE fiscal_years ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
                        ALTER TABLE fiscal_years ADD COLUMN IF NOT EXISTS closed_by VARCHAR(100);
                    END IF;
                    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'bank_statements') THEN
                        ALTER TABLE bank_statements ADD COLUMN IF NOT EXISTS bank_account_id VARCHAR(50);
                        ALTER TABLE bank_statements ADD COLUMN IF NOT EXISTS statement_no VARCHAR(100);
                        ALTER TABLE bank_statements ADD COLUMN IF NOT EXISTS statement_date DATE DEFAULT CURRENT_DATE;
                        ALTER TABLE bank_statements ADD COLUMN IF NOT EXISTS from_date DATE DEFAULT CURRENT_DATE;
                        ALTER TABLE bank_statements ADD COLUMN IF NOT EXISTS to_date DATE DEFAULT CURRENT_DATE;
                        ALTER TABLE bank_statements ADD COLUMN IF NOT EXISTS opening_balance NUMERIC(15,2) DEFAULT 0.00;
                        ALTER TABLE bank_statements ADD COLUMN IF NOT EXISTS closing_balance NUMERIC(15,2) DEFAULT 0.00;
                        ALTER TABLE bank_statements ADD COLUMN IF NOT EXISTS is_reconciled BOOLEAN DEFAULT FALSE;
                        ALTER TABLE bank_statements ADD COLUMN IF NOT EXISTS reconciled_at TIMESTAMPTZ;
                        ALTER TABLE bank_statements ADD COLUMN IF NOT EXISTS reconciled_by VARCHAR(100);
                    END IF;
                    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'bank_statement_lines') THEN
                        ALTER TABLE bank_statement_lines ADD COLUMN IF NOT EXISTS statement_id VARCHAR(50);
                        ALTER TABLE bank_statement_lines ADD COLUMN IF NOT EXISTS line_number INTEGER DEFAULT 1;
                        ALTER TABLE bank_statement_lines ADD COLUMN IF NOT EXISTS transaction_date DATE DEFAULT CURRENT_DATE;
                        ALTER TABLE bank_statement_lines ADD COLUMN IF NOT EXISTS value_date DATE DEFAULT CURRENT_DATE;
                        ALTER TABLE bank_statement_lines ADD COLUMN IF NOT EXISTS reference_no VARCHAR(100);
                        ALTER TABLE bank_statement_lines ADD COLUMN IF NOT EXISTS description TEXT;
                        ALTER TABLE bank_statement_lines ADD COLUMN IF NOT EXISTS deposit_amount NUMERIC(15,2) DEFAULT 0.00;
                        ALTER TABLE bank_statement_lines ADD COLUMN IF NOT EXISTS withdrawal_amount NUMERIC(15,2) DEFAULT 0.00;
                        ALTER TABLE bank_statement_lines ADD COLUMN IF NOT EXISTS balance_after_transaction NUMERIC(15,2);
                        ALTER TABLE bank_statement_lines ADD COLUMN IF NOT EXISTS reconciled_gl_entry_id VARCHAR(50);
                        ALTER TABLE bank_statement_lines ADD COLUMN IF NOT EXISTS reconciliation_status VARCHAR(30) DEFAULT 'UNMATCHED';
                        ALTER TABLE bank_statement_lines ADD COLUMN IF NOT EXISTS cleared_at TIMESTAMPTZ;
                    END IF;
                    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'products') THEN
                        ALTER TABLE products ALTER COLUMN mrp SET DEFAULT 0.00;
                        ALTER TABLE products ALTER COLUMN gst_percentage SET DEFAULT 18.00;
                        ALTER TABLE products ALTER COLUMN hsn_code SET DEFAULT '6403';
                        ALTER TABLE products ALTER COLUMN mrp DROP NOT NULL;
                    END IF;
                    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'integration_outbox_events') THEN
                        ALTER TABLE integration_outbox_events ADD COLUMN IF NOT EXISTS source_event_id VARCHAR(100);
                        ALTER TABLE integration_outbox_events ADD COLUMN IF NOT EXISTS correlation_id VARCHAR(100);
                        ALTER TABLE integration_outbox_events ADD COLUMN IF NOT EXISTS causation_id VARCHAR(100);
                        ALTER TABLE integration_outbox_events ADD COLUMN IF NOT EXISTS event_type VARCHAR(100);
                        ALTER TABLE integration_outbox_events ADD COLUMN IF NOT EXISTS aggregate_type VARCHAR(50);
                        ALTER TABLE integration_outbox_events ADD COLUMN IF NOT EXISTS aggregate_id VARCHAR(50);
                        ALTER TABLE integration_outbox_events ADD COLUMN IF NOT EXISTS company_id VARCHAR(50);
                        ALTER TABLE integration_outbox_events ADD COLUMN IF NOT EXISTS branch_id VARCHAR(50);
                        ALTER TABLE integration_outbox_events ADD COLUMN IF NOT EXISTS event_schema_version VARCHAR(20) DEFAULT '1.0';
                        ALTER TABLE integration_outbox_events ADD COLUMN IF NOT EXISTS target_channel VARCHAR(50) DEFAULT 'GENERAL_OUTBOX';
                        ALTER TABLE integration_outbox_events ADD COLUMN IF NOT EXISTS payload_json JSONB;
                        ALTER TABLE integration_outbox_events ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'PENDING';
                        ALTER TABLE integration_outbox_events ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;
                        ALTER TABLE integration_outbox_events ADD COLUMN IF NOT EXISTS error_message TEXT;
                        ALTER TABLE integration_outbox_events ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ;
                        ALTER TABLE integration_outbox_events ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ;
                        ALTER TABLE integration_outbox_events ADD COLUMN IF NOT EXISTS claim_expires_at TIMESTAMPTZ;
                        ALTER TABLE integration_outbox_events ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
                        ALTER TABLE integration_outbox_events ADD COLUMN IF NOT EXISTS dispatched_at TIMESTAMPTZ;
                    END IF;
                END $$;
            """))
            await conn.execute(text("CREATE OR REPLACE FUNCTION fn_reconcile_inventory_state() RETURNS TRIGGER AS 'BEGIN UPDATE products SET stock = COALESCE(stock, 0) + NEW.quantity WHERE id = NEW.product_id; RETURN NEW; END;' LANGUAGE plpgsql;"))
            await conn.execute(text("DROP TRIGGER IF EXISTS trg_inventory_state_reconciliation ON stock_movements;"))
            await conn.execute(text("CREATE TRIGGER trg_inventory_state_reconciliation AFTER INSERT ON stock_movements FOR EACH ROW EXECUTE FUNCTION fn_reconcile_inventory_state();"))
        except Exception:
            pass
    yield engine
    await engine.dispose()

@pytest.fixture
async def db_session(db_engine) -> AsyncSession:
    async_session = sessionmaker(
        db_engine, class_=AsyncSession, expire_on_commit=False
    )
    async with async_session() as session:  # type: ignore[attr-defined]  # SQLAlchemy async sessionmaker known limitation
        yield session
        await session.rollback()

@pytest.fixture(autouse=True)
async def auto_override_company_db(db_session):
    from app.main import app
    from app.api.deps import get_db, get_company_db
    async def _get_db():
        yield db_session
    app.dependency_overrides[get_db] = _get_db
    app.dependency_overrides[get_company_db] = _get_db
    yield
    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_company_db, None)

async def clear_db(db_session: AsyncSession):
    """
    Cleans up all database tables cleanly using TRUNCATE CASCADE.
    Ensures that test runs across different modules do not conflict or cause integrity errors.
    """
    from sqlalchemy import text
    try:
        await db_session.execute(text("""
            DO $$
            DECLARE
                r RECORD;
            BEGIN
                FOR r IN (
                    SELECT tablename FROM pg_tables 
                    WHERE schemaname = 'public' 
                    AND tablename NOT IN ('spatial_ref_sys')
                ) LOOP
                    EXECUTE 'TRUNCATE TABLE public.' || quote_ident(r.tablename) || ' CASCADE;';
                END LOOP;
            END $$;
        """))
        await db_session.commit()
    except Exception as e:
        await db_session.rollback()
    await db_session.commit()

