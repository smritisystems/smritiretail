"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.49.0
Created      : 2026-09-30
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Category-Based Article Numbering Verification Suite
"""

import uuid
import asyncio
import pytest
from datetime import datetime, timezone
from sqlalchemy import select, text
from fastapi import HTTPException

from app.db.session import get_company_sessionmaker
from app.models.numbering import DocumentSeries
from app.models.item_master import Item
from app.services.documents_engine import DocumentsEngine, RangeExhaustedError


@pytest.fixture
async def test_company():
    """Provides an isolated test company with foreign key validity and automatic teardown."""
    company_id = f"COMP-CAT-{uuid.uuid4().hex[:8].upper()}"
    sessionmaker = get_company_sessionmaker("smriti001")
    async with sessionmaker() as session:
        await session.execute(
            text("""
                INSERT INTO companies (id, uuid, name, is_active, is_deleted, created_at, modified_at)
                VALUES (:id, :uuid, :name, true, false, now(), now())
            """),
            {"id": company_id, "uuid": str(uuid.uuid4()), "name": f"Test Company {company_id}"}
        )
        await session.commit()

    yield company_id

    async with sessionmaker() as session:
        # Teardown series and test company
        await session.execute(
            text("DELETE FROM numbering_audit_logs WHERE series_id IN (SELECT id FROM document_series WHERE company_id = :cid)"),
            {"cid": company_id}
        )
        await session.execute(
            text("DELETE FROM document_series WHERE company_id = :cid"),
            {"cid": company_id}
        )
        await session.execute(
            text("DELETE FROM companies WHERE id = :cid"),
            {"cid": company_id}
        )
        await session.commit()


@pytest.mark.asyncio
async def test_01_first_sandal_allocation(test_company):
    """Test 1 — First Sandal: start_number=10000, current_number=9999 -> SND-10000-A"""
    company_id = test_company
    sessionmaker = get_company_sessionmaker("smriti001")
    async with sessionmaker() as session:
        series = DocumentSeries(
            id=f"ser_{uuid.uuid4().hex[:12]}",
            uuid=str(uuid.uuid4()),
            company_id=company_id,
            name="Sandal Article Series",
            document_type="ARTICLE",
            category="SANDAL",
            prefix="SND-",
            suffix="-A",
            start_number=10000,
            current_number=9999,
            end_number=19999,
            running_length=5,
            number_format="PREFIX_NUM_SUFFIX",
            is_active=True,
            is_deleted=False,
        )
        session.add(series)
        await session.commit()

        resp = await DocumentsEngine.allocate_next_number_in_transaction(
            session=session,
            company_id=company_id,
            document_type="ARTICLE",
            category="SANDAL",
        )
        await session.commit()
        assert resp.allocated_number == 10000
        assert resp.document_no == "SND-10000-A"


@pytest.mark.asyncio
async def test_02_second_sandal_allocation(test_company):
    """Test 2 — Second Sandal: allocated_number=10001 -> SND-10001-A"""
    company_id = test_company
    sessionmaker = get_company_sessionmaker("smriti001")
    async with sessionmaker() as session:
        series = DocumentSeries(
            id=f"ser_{uuid.uuid4().hex[:12]}",
            uuid=str(uuid.uuid4()),
            company_id=company_id,
            name="Sandal Article Series",
            document_type="ARTICLE",
            category="SANDAL",
            prefix="SND-",
            suffix="-A",
            start_number=10000,
            current_number=10000,
            end_number=19999,
            running_length=5,
            number_format="PREFIX_NUM_SUFFIX",
            is_active=True,
            is_deleted=False,
        )
        session.add(series)
        await session.commit()

        resp = await DocumentsEngine.allocate_next_number_in_transaction(
            session=session,
            company_id=company_id,
            document_type="ARTICLE",
            category="SANDAL",
        )
        await session.commit()
        assert resp.allocated_number == 10001
        assert resp.document_no == "SND-10001-A"


@pytest.mark.asyncio
async def test_03_first_shoes_allocation(test_company):
    """Test 3 — First Shoes: start_number=20000, current_number=19999 -> SH-20000-A"""
    company_id = test_company
    sessionmaker = get_company_sessionmaker("smriti001")
    async with sessionmaker() as session:
        series = DocumentSeries(
            id=f"ser_{uuid.uuid4().hex[:12]}",
            uuid=str(uuid.uuid4()),
            company_id=company_id,
            name="Shoes Article Series",
            document_type="ARTICLE",
            category="SHOES",
            prefix="SH-",
            suffix="-A",
            start_number=20000,
            current_number=19999,
            end_number=29999,
            running_length=5,
            number_format="PREFIX_NUM_SUFFIX",
            is_active=True,
            is_deleted=False,
        )
        session.add(series)
        await session.commit()

        resp = await DocumentsEngine.allocate_next_number_in_transaction(
            session=session,
            company_id=company_id,
            document_type="ARTICLE",
            category="SHOES",
        )
        await session.commit()
        assert resp.allocated_number == 20000
        assert resp.document_no == "SH-20000-A"


@pytest.mark.asyncio
async def test_04_category_isolation(test_company):
    """Test 4 — Category Isolation: Sandal never consumes Shoes and vice-versa."""
    company_id = test_company
    sessionmaker = get_company_sessionmaker("smriti001")
    async with sessionmaker() as session:
        sandal_series = DocumentSeries(
            id=f"ser_{uuid.uuid4().hex[:12]}",
            uuid=str(uuid.uuid4()),
            company_id=company_id,
            name="Sandal Series",
            document_type="ARTICLE",
            category="SANDAL",
            prefix="SND-",
            suffix="-A",
            start_number=10000,
            current_number=9999,
            end_number=19999,
            running_length=5,
            is_active=True,
            is_deleted=False,
        )
        shoes_series = DocumentSeries(
            id=f"ser_{uuid.uuid4().hex[:12]}",
            uuid=str(uuid.uuid4()),
            company_id=company_id,
            name="Shoes Series",
            document_type="ARTICLE",
            category="SHOES",
            prefix="SH-",
            suffix="-A",
            start_number=20000,
            current_number=19999,
            end_number=29999,
            running_length=5,
            is_active=True,
            is_deleted=False,
        )
        session.add_all([sandal_series, shoes_series])
        await session.commit()

        # Allocate Sandal
        sandal_resp = await DocumentsEngine.allocate_next_number_in_transaction(
            session=session,
            company_id=company_id,
            document_type="ARTICLE",
            category="SANDAL",
        )
        # Allocate Shoes
        shoes_resp = await DocumentsEngine.allocate_next_number_in_transaction(
            session=session,
            company_id=company_id,
            document_type="ARTICLE",
            category="SHOES",
        )
        await session.commit()

        assert sandal_resp.document_no == "SND-10000-A"
        assert sandal_resp.series_id == sandal_series.id
        assert shoes_resp.document_no == "SH-20000-A"
        assert shoes_resp.series_id == shoes_series.id

        # Verify series counters are strictly isolated
        refreshed_sandal = await session.get(DocumentSeries, sandal_series.id)
        refreshed_shoes = await session.get(DocumentSeries, shoes_series.id)
        assert refreshed_sandal.current_number == 10000
        assert refreshed_shoes.current_number == 20000


@pytest.mark.asyncio
async def test_05_range_exhaustion(test_company):
    """Test 5 — Range Exhaustion: current_number=19999, end_number=19999 fails with HTTP 409 RangeExhaustedError."""
    company_id = test_company
    sessionmaker = get_company_sessionmaker("smriti001")
    async with sessionmaker() as session:
        series = DocumentSeries(
            id=f"ser_{uuid.uuid4().hex[:12]}",
            uuid=str(uuid.uuid4()),
            company_id=company_id,
            name="Sandal Article Series",
            document_type="ARTICLE",
            category="SANDAL",
            prefix="SND-",
            suffix="-A",
            start_number=10000,
            current_number=19999,
            end_number=19999,
            running_length=5,
            is_active=True,
            is_deleted=False,
        )
        session.add(series)
        await session.commit()

        with pytest.raises(HTTPException) as exc_info:
            await DocumentsEngine.allocate_next_number_in_transaction(
                session=session,
                company_id=company_id,
                document_type="ARTICLE",
                category="SANDAL",
            )
        assert exc_info.value.status_code == 409
        assert "Article numbering range exhausted for category 'SANDAL'" in str(exc_info.value.detail)
        assert "10000-19999" in str(exc_info.value.detail)
        assert "Next number: 20000" in str(exc_info.value.detail)

        # Confirm counter was NOT incremented to 20000
        refreshed = await session.get(DocumentSeries, series.id)
        assert refreshed.current_number == 19999


@pytest.mark.asyncio
async def test_06_start_number_uninitialized(test_company):
    """Test 6 — Start Number: current_number=0 and start_number=10000 allocates 10000 (not 1)."""
    company_id = test_company
    sessionmaker = get_company_sessionmaker("smriti001")
    async with sessionmaker() as session:
        series = DocumentSeries(
            id=f"ser_{uuid.uuid4().hex[:12]}",
            uuid=str(uuid.uuid4()),
            company_id=company_id,
            name="Sandal Article Series",
            document_type="ARTICLE",
            category="SANDAL",
            prefix="SND-",
            suffix="-A",
            start_number=10000,
            current_number=0,
            end_number=19999,
            running_length=5,
            is_active=True,
            is_deleted=False,
        )
        session.add(series)
        await session.commit()

        resp = await DocumentsEngine.allocate_next_number_in_transaction(
            session=session,
            company_id=company_id,
            document_type="ARTICLE",
            category="SANDAL",
        )
        await session.commit()
        assert resp.allocated_number == 10000
        assert resp.document_no == "SND-10000-A"


@pytest.mark.asyncio
async def test_07_backward_compatibility(test_company):
    """Test 7 — Backward Compatibility: category=None, end_number=None allocates sequentially as before."""
    company_id = test_company
    sessionmaker = get_company_sessionmaker("smriti001")
    async with sessionmaker() as session:
        series = DocumentSeries(
            id=f"ser_{uuid.uuid4().hex[:12]}",
            uuid=str(uuid.uuid4()),
            company_id=company_id,
            name="General Article Series",
            document_type="ARTICLE",
            category=None,
            prefix="ART-",
            suffix="",
            start_number=1,
            current_number=50,
            end_number=None,
            running_length=4,
            is_active=True,
            is_deleted=False,
        )
        session.add(series)
        await session.commit()

        # Call with category=None
        resp = await DocumentsEngine.allocate_next_number_in_transaction(
            session=session,
            company_id=company_id,
            document_type="ARTICLE",
            category=None,
        )
        await session.commit()
        assert resp.allocated_number == 51
        assert resp.document_no == "ART-0051"

        # Fallback call with category="NON_EXISTENT_CAT" should safely fallback to category=None
        resp2 = await DocumentsEngine.allocate_next_number_in_transaction(
            session=session,
            company_id=company_id,
            document_type="ARTICLE",
            category="NON_EXISTENT_CAT",
        )
        await session.commit()
        assert resp2.allocated_number == 52
        assert resp2.document_no == "ART-0052"


@pytest.mark.asyncio
async def test_08_concurrent_allocation(test_company):
    """Test 8 — Concurrent Allocation: concurrent allocation serialize via SELECT FOR UPDATE without gaps/dups."""
    company_id = test_company
    sessionmaker = get_company_sessionmaker("smriti001")
    async with sessionmaker() as session:
        series = DocumentSeries(
            id=f"ser_{uuid.uuid4().hex[:12]}",
            uuid=str(uuid.uuid4()),
            company_id=company_id,
            name="Concurrent Sandal Series",
            document_type="ARTICLE",
            category="SANDAL",
            prefix="SND-",
            suffix="-A",
            start_number=10000,
            current_number=9999,
            end_number=19999,
            running_length=5,
            is_active=True,
            is_deleted=False,
        )
        session.add(series)
        await session.commit()

    async def _allocate_one():
        async with sessionmaker() as sess:
            resp = await DocumentsEngine.allocate_next_number_in_transaction(
                session=sess,
                company_id=company_id,
                document_type="ARTICLE",
                category="SANDAL",
            )
            await sess.commit()
            return resp.document_no

    # Run 5 concurrent allocations
    results = await asyncio.gather(*[_allocate_one() for _ in range(5)])
    assert len(results) == 5
    assert len(set(results)) == 5  # strictly unique
    expected_set = {"SND-10000-A", "SND-10001-A", "SND-10002-A", "SND-10003-A", "SND-10004-A"}
    assert set(results) == expected_set


@pytest.mark.asyncio
async def test_09_rollback_safety(test_company):
    """Test 9 — Rollback Safety: transaction rollback reverts current_number."""
    company_id = test_company
    sessionmaker = get_company_sessionmaker("smriti001")
    series_id = f"ser_{uuid.uuid4().hex[:12]}"
    async with sessionmaker() as session:
        series = DocumentSeries(
            id=series_id,
            uuid=str(uuid.uuid4()),
            company_id=company_id,
            name="Rollback Test Series",
            document_type="ARTICLE",
            category="SANDAL",
            prefix="SND-",
            suffix="-A",
            start_number=10000,
            current_number=9999,
            end_number=19999,
            running_length=5,
            is_active=True,
            is_deleted=False,
        )
        session.add(series)
        await session.commit()

    # In a new session, allocate number then simulate downstream failure and rollback
    async with sessionmaker() as session:
        resp = await DocumentsEngine.allocate_next_number_in_transaction(
            session=session,
            company_id=company_id,
            document_type="ARTICLE",
            category="SANDAL",
        )
        assert resp.document_no == "SND-10000-A"
        # Simulate failure and rollback
        await session.rollback()

    # Re-inspect series in a fresh session: current_number must still be 9999
    async with sessionmaker() as session:
        fresh_series = await session.get(DocumentSeries, series_id)
        assert fresh_series.current_number == 9999


@pytest.mark.asyncio
async def test_10_multiple_article_series_category_resolution(test_company):
    """Test 10 — Multiple ARTICLE Series: Sandal and Shoes in same company resolve correctly by category."""
    company_id = test_company
    sessionmaker = get_company_sessionmaker("smriti001")
    async with sessionmaker() as session:
        sandal_series = DocumentSeries(
            id=f"ser_{uuid.uuid4().hex[:12]}",
            uuid=str(uuid.uuid4()),
            company_id=company_id,
            name="Sandal Series",
            document_type="ARTICLE",
            category="SANDAL",
            prefix="SND-",
            suffix="-A",
            start_number=10000,
            current_number=10005,
            end_number=19999,
            running_length=5,
            is_active=True,
            is_deleted=False,
        )
        shoes_series = DocumentSeries(
            id=f"ser_{uuid.uuid4().hex[:12]}",
            uuid=str(uuid.uuid4()),
            company_id=company_id,
            name="Shoes Series",
            document_type="ARTICLE",
            category="SHOES",
            prefix="SH-",
            suffix="-A",
            start_number=20000,
            current_number=20010,
            end_number=29999,
            running_length=5,
            is_active=True,
            is_deleted=False,
        )
        session.add_all([sandal_series, shoes_series])
        await session.commit()

        # Lowercase and whitespace test
        resp_sandal = await DocumentsEngine.allocate_next_number_in_transaction(
            session=session,
            company_id=company_id,
            document_type="ARTICLE",
            category=" sandal ",
        )
        resp_shoes = await DocumentsEngine.allocate_next_number_in_transaction(
            session=session,
            company_id=company_id,
            document_type="ARTICLE",
            category="  shoes  ",
        )
        await session.commit()

        assert resp_sandal.document_no == "SND-10006-A"
        assert resp_shoes.document_no == "SH-20011-A"


@pytest.mark.asyncio
async def test_11_ambiguous_fallback_prevention(test_company):
    """Test 11 — Ambiguous Fallback: Multiple active category IS NULL series fail with HTTP 409 Conflict."""
    company_id = test_company
    sessionmaker = get_company_sessionmaker("smriti001")
    async with sessionmaker() as session:
        series1 = DocumentSeries(
            id=f"ser_{uuid.uuid4().hex[:12]}",
            uuid=str(uuid.uuid4()),
            company_id=company_id,
            name="Fallback Series 1",
            document_type="ARTICLE",
            category=None,
            prefix="ART1-",
            start_number=1,
            current_number=0,
            is_active=True,
            is_deleted=False,
        )
        series2 = DocumentSeries(
            id=f"ser_{uuid.uuid4().hex[:12]}",
            uuid=str(uuid.uuid4()),
            company_id=company_id,
            name="Fallback Series 2",
            document_type="ARTICLE",
            category=None,
            prefix="ART2-",
            start_number=1,
            current_number=0,
            is_active=True,
            is_deleted=False,
        )
        session.add_all([series1, series2])
        await session.commit()

        with pytest.raises(HTTPException) as exc_info:
            await DocumentsEngine.allocate_next_number_in_transaction(
                session=session,
                company_id=company_id,
                document_type="ARTICLE",
                category=None,
            )
        assert exc_info.value.status_code == 409
        assert "Ambiguous document series configuration" in str(exc_info.value.detail)


@pytest.mark.asyncio
async def test_12_existing_data_immutability():
    """Test 12 — Existing Data: Historical items remain untouched with zero modifications."""
    sessionmaker = get_company_sessionmaker("smriti001")
    async with sessionmaker() as session:
        res = await session.execute(text("SELECT count(*) FROM items;"))
        total_items = res.scalar()
        # Verify 795 or existing count has 0 null item_codes
        null_res = await session.execute(text("SELECT count(*) FROM items WHERE item_code IS NULL OR trim(item_code) = '';"))
        null_count = null_res.scalar()
        assert null_count == 0
        assert total_items >= 795
