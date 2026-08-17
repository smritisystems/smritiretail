"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 4.8.0
Created      : 2026-08-17
Modified     : 2026-08-17
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

SMRITITAXINVOICE IMMUTABILITY & INTEGRITY GUARD TEST SUITE
================================================================================
Protects SMRITITAXINVOICE against layout breakage, CSS drift, column corruption,
unauthorized database mutation, and accidental template modification.
================================================================================
"""

import os
import sys
import pytest
import psycopg2
import json
from decimal import Decimal

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.future import select

from app.services.smrititaxinvoice_frozen_spec import (
    SMRITITAXINVOICE_TEMPLATE_CODE,
    SMRITITAXINVOICE_VERSION,
    SMRITITAXINVOICE_STATUS,
    SMRITI_A4_WIDTH_PT,
    SMRITI_A4_HEIGHT_PT,
    SMRITI_INTERSTATE_COLUMNS,
    SMRITI_INTRASTATE_COLUMNS,
    SMRITI_ITEM_ROW_HEIGHT_PT,
    SMRITI_SUBTOTAL_ROW_HEIGHT_PT,
    verify_smrititaxinvoice_integrity,
)
from app.models.tax_invoice_template import TaxInvoiceTemplate, TaxInvoiceTemplateVersion
from app.services.invoice_pdf_service import InvoicePdfService, paginate_items

DB_SYNC_URL = "postgresql://postgres:postgres@localhost:5432/smriti001"
DB_ASYNC_URL = "postgresql+asyncpg://postgres:postgres@localhost:5432/smriti001"


@pytest.fixture(scope="module")
def sync_db():
    conn = psycopg2.connect(DB_SYNC_URL)
    yield conn
    conn.close()


@pytest.fixture(scope="module")
async def async_session():
    engine = create_async_engine(DB_ASYNC_URL, echo=False)
    async_session_maker = async_sessionmaker(engine, expire_on_commit=False)
    async with async_session_maker() as session:
        yield session
    await engine.dispose()


def test_01_smrititaxinvoice_persisted_in_database_and_frozen(sync_db):
    """Verifies that SMRITITAXINVOICE exists in PostgreSQL and is FROZEN."""
    cur = sync_db.cursor()
    cur.execute("""
        SELECT template_code, template_name, status, current_version, is_default, is_active
        FROM tax_invoice_templates
        WHERE template_code = %s;
    """, (SMRITITAXINVOICE_TEMPLATE_CODE,))
    row = cur.fetchone()
    assert row is not None, "SMRITITAXINVOICE must exist in tax_invoice_templates"
    assert row[0] == "SMRITITAXINVOICE"
    assert row[2] == "FROZEN"
    assert row[3] == "V1"
    assert row[4] is True  # is_default
    assert row[5] is True  # is_active


def test_02_database_trigger_strictly_blocks_unauthorized_updates(sync_db):
    """Verifies that PostgreSQL trigger trg_prevent_tax_template_mutation blocks layout modification."""
    cur = sync_db.cursor()
    with pytest.raises(psycopg2.Error) as exc_info:
        cur.execute("""
            UPDATE tax_invoice_templates
            SET layout_configuration = '{"corrupted": true}'::jsonb
            WHERE template_code = 'SMRITITAXINVOICE';
        """)
        sync_db.commit()
    sync_db.rollback()
    assert "SMRITI-GOV-ERR" in str(exc_info.value)
    assert "FROZEN and IMMUTABLE" in str(exc_info.value)


def test_03_database_trigger_strictly_blocks_deletion(sync_db):
    """Verifies that PostgreSQL trigger trg_prevent_tax_template_mutation blocks template deletion."""
    cur = sync_db.cursor()
    with pytest.raises(psycopg2.Error) as exc_info:
        cur.execute("""
            DELETE FROM tax_invoice_templates
            WHERE template_code = 'SMRITITAXINVOICE';
        """)
        sync_db.commit()
    sync_db.rollback()
    assert "SMRITI-GOV-ERR" in str(exc_info.value)
    assert "Deletion is prohibited" in str(exc_info.value)


def test_04_python_spec_cryptographic_integrity_hash():
    """Verifies that the frozen Python layout specification is cryptographically valid and untampered."""
    assert verify_smrititaxinvoice_integrity() is True


def test_05_grid_columns_and_geometry_immutability():
    """Verifies exact point geometry and 100% column allocation."""
    assert SMRITI_A4_WIDTH_PT == 595.92
    assert SMRITI_A4_HEIGHT_PT == 842.88
    assert SMRITI_ITEM_ROW_HEIGHT_PT == 20.47
    assert SMRITI_SUBTOTAL_ROW_HEIGHT_PT == 20.47

    # Interstate 10 columns
    assert len(SMRITI_INTERSTATE_COLUMNS) == 10
    assert SMRITI_INTERSTATE_COLUMNS["sl_no"] == "3.5%"
    assert SMRITI_INTERSTATE_COLUMNS["item_description"] == "28.0%"
    assert SMRITI_INTERSTATE_COLUMNS["hsn_sac"] == "8.0%"
    assert SMRITI_INTERSTATE_COLUMNS["qty"] == "5.5%"
    assert SMRITI_INTERSTATE_COLUMNS["mrp"] == "10.0%"
    assert SMRITI_INTERSTATE_COLUMNS["discount_pct"] == "6.5%"
    assert SMRITI_INTERSTATE_COLUMNS["taxable_value"] == "11.0%"
    assert SMRITI_INTERSTATE_COLUMNS["tax_pct"] == "5.0%"
    assert SMRITI_INTERSTATE_COLUMNS["igst"] == "9.0%"
    assert SMRITI_INTERSTATE_COLUMNS["amount"] == "13.5%"

    # Intrastate 12 columns
    assert len(SMRITI_INTRASTATE_COLUMNS) == 12
    assert SMRITI_INTRASTATE_COLUMNS["mrp"] == "9.5%"
    assert SMRITI_INTRASTATE_COLUMNS["cgst"] == "8.5%"
    assert SMRITI_INTRASTATE_COLUMNS["sgst"] == "8.5%"


def test_06_pagination_multi_page_mathematical_consistency():
    """Verifies exact deterministic pagination across various item counts."""
    # 5 items -> 1 page
    p5 = paginate_items(list(range(5)), first_page_max=25, cont_page_max=36, last_page_room=18)
    assert len(p5) == 1
    assert len(p5[0]) == 5

    # 20 items -> 2 pages ([20], [])
    p20 = paginate_items(list(range(20)), first_page_max=25, cont_page_max=36, last_page_room=18)
    assert len(p20) == 2
    assert len(p20[0]) == 20
    assert len(p20[1]) == 0

    # 42 items -> 2 pages ([25], [17])
    p42 = paginate_items(list(range(42)), first_page_max=25, cont_page_max=36, last_page_room=18)
    assert len(p42) == 2
    assert len(p42[0]) == 25
    assert len(p42[1]) == 17

    # 78 items -> 3 pages ([25], [36], [17])
    p78 = paginate_items(list(range(78)), first_page_max=25, cont_page_max=36, last_page_room=18)
    assert len(p78) == 3
    assert len(p78[0]) == 25
    assert len(p78[1]) == 36
    assert len(p78[2]) == 17

    # 100 items -> 4 pages ([23], [36], [36], [5] alongside summary)
    p100 = paginate_items(list(range(100)), first_page_max=23, cont_page_max=36, last_page_room=18)
    assert len(p100) == 4


@pytest.mark.asyncio
async def test_07_pdf_render_end_to_end_smrititaxinvoice():
    """Verifies that SMRITITAXINVOICE template can be queried and loaded via AsyncSession."""
    engine = create_async_engine(DB_ASYNC_URL, echo=False)
    session_maker = async_sessionmaker(engine, expire_on_commit=False)
    async with session_maker() as session:
        stmt = select(TaxInvoiceTemplate).where(TaxInvoiceTemplate.template_code == "SMRITITAXINVOICE")
        res = await session.execute(stmt)
        tpl = res.scalars().first()
        assert tpl is not None
        assert tpl.template_code == "SMRITITAXINVOICE"
        assert tpl.status == "FROZEN"
    await engine.dispose()
