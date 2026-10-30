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
Classification: Numbering Authority & Database Boundary Verification Suite
"""

import uuid
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select, text

from app.main import app
from app.db.session import get_company_sessionmaker
from app.core.security import create_access_token
from app.models.numbering import DocumentSeries
from app.services.documents_engine import DocumentsEngine
from app.services.item_master_svc import UniversalItemMasterService
from app.schemas.item_master import ItemCreateRequest, ItemVariantItem


def _get_auth_headers(company_id: str = "COMP-001", role: str = "SYSADMIN") -> dict:
    token = create_access_token(
        data={
            "sub": "usr-admin",
            "username": "admin",
            "role": role,
            "company_id": company_id,
            "branch_id": "BR-001",
            "tenant_id": "smriti001" if company_id == "COMP-001" else "smriti002",
            "db_name": "smriti001" if company_id == "COMP-001" else "smriti002",
            "is_active": True,
        }
    )
    return {
        "Authorization": f"Bearer {token}",
        "X-Company-ID": company_id,
        "X-Company-Code": company_id,
    }


@pytest.mark.asyncio
async def test_a_ui_preview_uses_tenant_article_series():
    """Test A — UI preview: GET /api/v1/numbering/series reads tenant Article series from smriti001."""
    sessionmaker = get_company_sessionmaker("smriti001")
    unique_suffix = uuid.uuid4().hex[:6].upper()
    series_id = f"SER-TENANT-{unique_suffix}"

    async with sessionmaker() as session:
        series = DocumentSeries(
            id=series_id,
            uuid=str(uuid.uuid4()),
            company_id="COMP-001",
            name=f"Tenant Preview Series {unique_suffix}",
            document_type="ARTICLE",
            category="SANDAL",
            prefix=f"SND-{unique_suffix[:3]}-",
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

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get("/api/v1/numbering/series", headers=_get_auth_headers("COMP-001"))
            assert resp.status_code == 200
            data = resp.json()
            assert isinstance(data, list)
            # Must find the tenant-scoped series in the returned payload
            found = [s for s in data if s.get("id") == series_id]
            assert len(found) == 1, f"Expected tenant series {series_id} in GET /numbering/series output."
            assert found[0]["category"] == "SANDAL"
            assert found[0]["startNumber"] == 10000
            assert found[0]["endNumber"] == 19999
    finally:
        async with sessionmaker() as session:
            await session.execute(text("DELETE FROM numbering_audit_logs WHERE series_id = :sid"), {"sid": series_id})
            await session.execute(text("DELETE FROM document_series WHERE id = :sid"), {"sid": series_id})
            await session.commit()


@pytest.mark.asyncio
async def test_b_backend_article_creation_uses_same_tenant_series():
    """Test B — Backend Article creation uses the same tenant Article series in smriti001."""
    sessionmaker = get_company_sessionmaker("smriti001")
    unique_suffix = uuid.uuid4().hex[:6].upper()
    series_id = f"SER-TENANT-{unique_suffix}"

    async with sessionmaker() as session:
        await session.execute(text("UPDATE document_series SET is_active = FALSE WHERE company_id = 'COMP-001' AND document_type = 'ARTICLE' AND category = 'SANDAL'"))
        series = DocumentSeries(
            id=series_id,
            uuid=str(uuid.uuid4()),
            company_id="COMP-001",
            name=f"Tenant Creation Series {unique_suffix}",
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

    try:
        async with sessionmaker() as session:
            item_req = ItemCreateRequest(
                item_name=f"Authority Test Sandal {unique_suffix}",
                category="SANDAL",
                auto_generate_article_number=True,
                variants=[
                    ItemVariantItem(
                        variant_sku=f"SND-{unique_suffix}-8",
                        variant_name=f"Authority Test Sandal {unique_suffix} (8)",
                        size="8",
                        color="Tan",
                        mrp=1999.0,
                        selling_price=1499.0,
                    )
                ],
            )
            item = await UniversalItemMasterService.create_item(
                session=session,
                req=item_req,
                company_id="COMP-001",
                commit=True,
            )
            assert item.item_code == "SND-10000-A"

            # Verify that series in smriti001 was the one incremented
            refreshed = await session.get(DocumentSeries, series_id)
            assert refreshed.current_number == 10000
    finally:
        async with sessionmaker() as session:
            await session.execute(text("DELETE FROM item_barcodes WHERE variant_id IN (SELECT id FROM item_variants WHERE item_id IN (SELECT id FROM items WHERE item_code = 'SND-10000-A'))"))
            await session.execute(text("DELETE FROM item_variants WHERE item_id IN (SELECT id FROM items WHERE item_code = 'SND-10000-A')"))
            await session.execute(text("DELETE FROM items WHERE item_code = 'SND-10000-A'"))
            await session.execute(text("DELETE FROM numbering_audit_logs WHERE series_id = :sid"), {"sid": series_id})
            await session.execute(text("DELETE FROM document_series WHERE id = :sid"), {"sid": series_id})
            await session.execute(text("UPDATE document_series SET is_active = TRUE WHERE company_id = 'COMP-001' AND document_type = 'ARTICLE' AND category = 'SANDAL' AND id != :sid"), {"sid": series_id})
            await session.commit()


@pytest.mark.asyncio
async def test_c_sandal_preview_and_allocation_same_series():
    """Test C — SANDAL preview and allocation use the same series."""
    sessionmaker = get_company_sessionmaker("smriti001")
    series_id = f"SER-SANDAL-{uuid.uuid4().hex[:6].upper()}"

    async with sessionmaker() as session:
        await session.execute(text("UPDATE document_series SET is_active = FALSE WHERE company_id = 'COMP-001' AND document_type = 'ARTICLE' AND category = 'SANDAL'"))
        series = DocumentSeries(
            id=series_id,
            uuid=str(uuid.uuid4()),
            company_id="COMP-001",
            name="Sandal Verified Series",
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

    try:
        # 1. Preview calculation via GET /api/v1/numbering/series
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get("/api/v1/numbering/series", headers=_get_auth_headers("COMP-001"))
            assert resp.status_code == 200
            sandal_series = next(s for s in resp.json() if s.get("id") == series_id)
            # Simulated UI preview computation
            cur = sandal_series.get("currentNumber") or 0
            start = sandal_series.get("startNumber") or 1
            next_num = start if cur < start - 1 else cur + 1
            preview_doc_no = f"{sandal_series['prefix']}{str(next_num).zfill(sandal_series['runningLength'])}{sandal_series['suffix']}"
            assert preview_doc_no == "SND-10000-A"

        # 2. Allocation via DocumentsEngine in smriti001
        async with sessionmaker() as session:
            alloc_resp = await DocumentsEngine.allocate_next_number_in_transaction(
                session=session,
                company_id="COMP-001",
                document_type="ARTICLE",
                category="SANDAL",
            )
            await session.commit()
            assert alloc_resp.series_id == series_id
            assert alloc_resp.document_no == "SND-10000-A"
            assert alloc_resp.document_no == preview_doc_no
    finally:
        async with sessionmaker() as session:
            await session.execute(text("DELETE FROM numbering_audit_logs WHERE series_id = :sid"), {"sid": series_id})
            await session.execute(text("DELETE FROM document_series WHERE id = :sid"), {"sid": series_id})
            await session.execute(text("UPDATE document_series SET is_active = TRUE WHERE company_id = 'COMP-001' AND document_type = 'ARTICLE' AND category = 'SANDAL' AND id != :sid"), {"sid": series_id})
            await session.commit()


@pytest.mark.asyncio
async def test_d_shoes_preview_and_allocation_same_series():
    """Test D — SHOES preview and allocation use the same series."""
    sessionmaker = get_company_sessionmaker("smriti001")
    series_id = f"SER-SHOES-{uuid.uuid4().hex[:6].upper()}"

    async with sessionmaker() as session:
        await session.execute(text("UPDATE document_series SET is_active = FALSE WHERE company_id = 'COMP-001' AND document_type = 'ARTICLE' AND category = 'SHOES'"))
        series = DocumentSeries(
            id=series_id,
            uuid=str(uuid.uuid4()),
            company_id="COMP-001",
            name="Shoes Verified Series",
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
        session.add(series)
        await session.commit()

    try:
        # 1. Preview calculation via GET /api/v1/numbering/series
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get("/api/v1/numbering/series", headers=_get_auth_headers("COMP-001"))
            assert resp.status_code == 200
            shoes_series = next(s for s in resp.json() if s.get("id") == series_id)
            cur = shoes_series.get("currentNumber") or 0
            start = shoes_series.get("startNumber") or 1
            next_num = start if cur < start - 1 else cur + 1
            preview_doc_no = f"{shoes_series['prefix']}{str(next_num).zfill(shoes_series['runningLength'])}{shoes_series['suffix']}"
            assert preview_doc_no == "SH-20000-A"

        # 2. Allocation via DocumentsEngine in smriti001
        async with sessionmaker() as session:
            alloc_resp = await DocumentsEngine.allocate_next_number_in_transaction(
                session=session,
                company_id="COMP-001",
                document_type="ARTICLE",
                category="SHOES",
            )
            await session.commit()
            assert alloc_resp.series_id == series_id
            assert alloc_resp.document_no == "SH-20000-A"
            assert alloc_resp.document_no == preview_doc_no
    finally:
        async with sessionmaker() as session:
            await session.execute(text("DELETE FROM numbering_audit_logs WHERE series_id = :sid"), {"sid": series_id})
            await session.execute(text("DELETE FROM document_series WHERE id = :sid"), {"sid": series_id})
            await session.execute(text("UPDATE document_series SET is_active = TRUE WHERE company_id = 'COMP-001' AND document_type = 'ARTICLE' AND category = 'SHOES' AND id != :sid"), {"sid": series_id})
            await session.commit()


@pytest.mark.asyncio
async def test_e_preview_does_not_increment_counter():
    """Test E — Preview (calling GET /api/v1/numbering/series multiple times) does not increment current_number."""
    sessionmaker = get_company_sessionmaker("smriti001")
    series_id = f"SER-RO-{uuid.uuid4().hex[:6].upper()}"

    async with sessionmaker() as session:
        series = DocumentSeries(
            id=series_id,
            uuid=str(uuid.uuid4()),
            company_id="COMP-001",
            name="Read-Only Preview Series",
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
        session.add(series)
        await session.commit()

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # Query preview endpoint 5 consecutive times
            for _ in range(5):
                resp = await client.get("/api/v1/numbering/series", headers=_get_auth_headers("COMP-001"))
                assert resp.status_code == 200

        # Assert current_number is still strictly 10005
        async with sessionmaker() as session:
            refreshed = await session.get(DocumentSeries, series_id)
            assert refreshed.current_number == 10005
    finally:
        async with sessionmaker() as session:
            await session.execute(text("DELETE FROM document_series WHERE id = :sid"), {"sid": series_id})
            await session.commit()


@pytest.mark.asyncio
async def test_f_article_creation_increments_counter_exactly_once():
    """Test F — Article creation increments current_number exactly once."""
    sessionmaker = get_company_sessionmaker("smriti001")
    series_id = f"SER-INC-{uuid.uuid4().hex[:6].upper()}"

    async with sessionmaker() as session:
        await session.execute(text("UPDATE document_series SET is_active = FALSE WHERE company_id = 'COMP-001' AND document_type = 'ARTICLE' AND category = 'SANDAL'"))
        series = DocumentSeries(
            id=series_id,
            uuid=str(uuid.uuid4()),
            company_id="COMP-001",
            name="Increment Series",
            document_type="ARTICLE",
            category="SANDAL",
            prefix="SND-",
            suffix="-A",
            start_number=10000,
            current_number=10000,
            end_number=19999,
            running_length=5,
            is_active=True,
            is_deleted=False,
        )
        session.add(series)
        await session.commit()

    try:
        async with sessionmaker() as session:
            resp = await DocumentsEngine.allocate_next_number_in_transaction(
                session=session,
                company_id="COMP-001",
                document_type="ARTICLE",
                category="SANDAL",
            )
            await session.commit()
            assert resp.allocated_number == 10001
            assert resp.document_no == "SND-10001-A"

        async with sessionmaker() as session:
            refreshed = await session.get(DocumentSeries, series_id)
            assert refreshed.current_number == 10001
    finally:
        async with sessionmaker() as session:
            await session.execute(text("DELETE FROM numbering_audit_logs WHERE series_id = :sid"), {"sid": series_id})
            await session.execute(text("DELETE FROM document_series WHERE id = :sid"), {"sid": series_id})
            await session.execute(text("UPDATE document_series SET is_active = TRUE WHERE company_id = 'COMP-001' AND document_type = 'ARTICLE' AND category = 'SANDAL' AND id != :sid"), {"sid": series_id})
            await session.commit()


@pytest.mark.asyncio
async def test_g_two_tenants_remain_isolated():
    """Test G — Two tenants remain isolated: COMP-001 series not visible to or consumed by COMP-002."""
    sessionmaker_001 = get_company_sessionmaker("smriti001")
    series_id = f"SER-COMP001-ONLY-{uuid.uuid4().hex[:6].upper()}"

    async with sessionmaker_001() as session:
        series = DocumentSeries(
            id=series_id,
            uuid=str(uuid.uuid4()),
            company_id="COMP-001",
            name="Company 001 Isolated Series",
            document_type="ARTICLE",
            category="SANDAL",
            prefix="SND1-",
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

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # Query as COMP-001: must see the series
            resp1 = await client.get("/api/v1/numbering/series", headers=_get_auth_headers("COMP-001"))
            assert resp1.status_code == 200
            found1 = [s for s in resp1.json() if s.get("id") == series_id]
            assert len(found1) == 1

            # Query as COMP-002: must NOT see COMP-001 series
            resp2 = await client.get("/api/v1/numbering/series", headers=_get_auth_headers("COMP-002"))
            assert resp2.status_code == 200
            found2 = [s for s in resp2.json() if s.get("id") == series_id]
            assert len(found2) == 0, f"Tenant boundary leak: COMP-002 saw series {series_id} belonging to COMP-001."
    finally:
        async with sessionmaker_001() as session:
            await session.execute(text("DELETE FROM document_series WHERE id = :sid"), {"sid": series_id})
            await session.commit()


@pytest.mark.asyncio
async def test_h_existing_non_article_numbering_still_works():
    """Test H — Existing non-Article numbering still works sequentially."""
    sessionmaker = get_company_sessionmaker("smriti001")
    unique_doc = f"SALES_INV_{uuid.uuid4().hex[:6].upper()}"

    async with sessionmaker() as session:
        series = DocumentSeries(
            id=f"ser_{uuid.uuid4().hex[:12]}",
            uuid=str(uuid.uuid4()),
            company_id="COMP-001",
            name="Non-Article Test Series",
            document_type=unique_doc,
            prefix="INV-TEST-",
            suffix="",
            start_number=1,
            current_number=10,
            running_length=4,
            is_active=True,
            is_deleted=False,
        )
        session.add(series)
        await session.commit()

        # Allocate
        alloc = await DocumentsEngine.allocate_next_number_in_transaction(
            session=session,
            company_id="COMP-001",
            document_type=unique_doc,
        )
        await session.commit()
        assert alloc.allocated_number == 11
        assert alloc.document_no == "INV-TEST-0011"

        # Cleanup
        await session.execute(text("DELETE FROM numbering_audit_logs WHERE series_name = 'Non-Article Test Series'"))
        await session.execute(text("DELETE FROM document_series WHERE document_type = :dt"), {"dt": unique_doc})
        await session.commit()
