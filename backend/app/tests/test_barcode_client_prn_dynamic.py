"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.47.0
Created      : 2026-10-08
Modified     : 2026-10-08
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import uuid
import pytest
from httpx import ASGITransport, AsyncClient

from app.api.deps import TenantContext, get_db, get_company_db, get_tenant_context, get_current_user
from app.db.session import get_db as session_get_db
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.auth import User, UserRole
from app.models.system import SystemConfig
from app.models.tenant import Branch, Company
from app.tests.conftest import clear_db
from app.api.v1.barcode import generate_footwear_3stub_zpl


@pytest.fixture(autouse=True)
async def override_db_and_tenant(db_session):
    """
    Wire the test DB session into the app and clean all tables.
    """
    await clear_db(db_session)

    async def _get_db():
        yield db_session
    app.dependency_overrides[get_db] = _get_db
    app.dependency_overrides[session_get_db] = _get_db
    app.dependency_overrides[get_company_db] = _get_db
    try:
        yield
    finally:
        try:
            await clear_db(db_session)
        except Exception:
            pass
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(session_get_db, None)
        app.dependency_overrides.pop(get_company_db, None)
        app.dependency_overrides.pop(get_tenant_context, None)


async def _make_tenant(db_session, suffix="dyn"):
    s = f"{suffix}_{uuid.uuid4().hex[:6]}"
    comp = Company(
        id=f"comp-bar-{s}",
        name=f"Footwear Co {s}",
        gst_number="27ABCDE1234F1Z5",
        is_active=True,
    )
    br = Branch(
        id=f"br-bar-{s}",
        company_id=comp.id,
        name=f"Footwear Br {s}",
        code=f"BRFT-{s}",
        is_active=True,
    )
    db_session.add_all([comp, br])
    await db_session.commit()
    return comp, br


async def _make_user(db_session, suffix, comp_id, br_id, role=UserRole.MANAGER):
    s = f"{suffix}_{uuid.uuid4().hex[:6]}"
    user = User(
        id=f"usr-bar-{s}",
        username=f"usr_bar_{s}",
        hashed_password=hash_password("Test@1234"),
        role=role,
        is_active=True,
        is_deleted=False,
        company_id=comp_id,
        branch_id=br_id,
    )
    db_session.add(user)
    await db_session.commit()
    return user


def _bearer(user: User, comp_id: str, br_id: str) -> dict:
    token = create_access_token({
        "sub": user.id,
        "username": user.username,
        "role": user.role.value,
        "company_id": comp_id,
        "branch_id": br_id,
        "jti": str(uuid.uuid4()),
        "type": "access",
    })
    return {"Authorization": f"Bearer {token}"}


def _set_tenant(comp_id: str, br_id: str, user=None):
    async def _gt():
        return TenantContext(company_id=comp_id, branch_id=br_id)
    app.dependency_overrides[get_tenant_context] = _gt
    if user:
        async def _gu():
            return user
        app.dependency_overrides[get_current_user] = _gu


# =========================================================================
# 1. Pure Generator Tests (Unit)
# =========================================================================

def test_generate_footwear_3stub_zpl_exact_structure():
    """
    Validates that the ZPL generator faithfully produces the 3-stub footwear box
    layout with reverse-print black boxes and dynamic parameters.
    """
    item = {
        "barcode": "8904551005335",
        "style_code": "CH-30-K",
        "size": "37",
        "color": "BLACK",
        "mrp": 1199.00,
        "brand": "TATTLY THREADS",
        "net_contents": "NET CONTENTS:1 Pair Footwear",
    }
    zpl = generate_footwear_3stub_zpl(
        item=item,
        company_name="Tattly Threads",
        company_address="81,Umerkhadi,Mumbai,400003",
        company_email="care@tattlythreads.com",
        default_mfg_date="10/26",
    )

    # 1. Page Pitch and dimensions
    assert "<page quantity='0' pitch='50.7 mm'>" in zpl
    assert "^PW804" in zpl

    # 2. Article number padded to 12 chars for black box fill
    assert "^GB284,47,47^FS" in zpl
    assert "^FT416,54\n^A0N,45,44^FR^FDCH-30-K     ^FS" in zpl

    # 3. Size boxes (Zone 1, 2, 3)
    assert "^GB70,67,67^FS" in zpl
    assert "^FT627,116\n^A0N,65,72^FR^FD37^FS" in zpl
    assert "^FT37,101\n^A0N,65,72^FR^FD37^FS" in zpl
    assert "^FT33,328\n^A0N,65,72^FR^FD37^FS" in zpl

    # 4. Color and pricing
    assert "^A0N,37,49^FDBLACK^FS" in zpl
    assert "^A0N,42,56^FD1199/-^FS" in zpl
    assert "MRP:1199/-" in zpl

    # 5. Barcode symbol and value
    assert "^BCN,66,N,N^FD8904551005335^FS" in zpl
    assert "^AAN,27,15^FD8904551005335^FS" in zpl

    # 6. Legal metrology
    assert "^A0N,20,27^FDMKTD.By:Tattly Threads^FS" in zpl
    assert "^ADN,18,10^FD81,Umerkhadi,Mumbai,400003^FS" in zpl
    assert "^ADN,18,10^FDcare@tattlythreads.com^FS" in zpl

    # 7. Print quantity and terminator
    assert "^PQ1,0,1,Y" in zpl
    assert "^XZ" in zpl


def test_generate_footwear_3stub_zpl_variant_toupe():
    """
    Tests dynamic generation for TOUPE size 42 variant.
    """
    item = {
        "barcode": "8904551005458",
        "style": "CH-30-K",
        "size": "42",
        "shade": "TOUPE",
        "price": 1199,
        "mfg_date": "10/26",
    }
    zpl = generate_footwear_3stub_zpl(item=item)

    assert "^FD8904551005458^FS" in zpl
    assert "^FR^FD42^FS" in zpl
    assert "^FDTOUPE^FS" in zpl
    assert "^FD1199/-^FS" in zpl
    assert "MFG.Dt.:10/26" in zpl


# =========================================================================
# 2. API Endpoints Integration Tests
# =========================================================================

@pytest.mark.asyncio
async def test_get_layouts_includes_footwear_3stub(db_session):
    """
    Verifies that GET /api/v1/barcode/layouts includes 'lay-footwear-100x50-3stub'.
    """
    comp, br = await _make_tenant(db_session, "lay")
    user = await _make_user(db_session, "lay", comp.id, br.id)
    headers = _bearer(user, comp.id, br.id)
    _set_tenant(comp.id, br.id, user)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        r = await ac.get("/api/v1/barcode/layouts", headers=headers)
        assert r.status_code == 200
        layouts = r.json()
        ids = [l["id"] for l in layouts]
        assert "lay-footwear-100x50-3stub" in ids

        footwear_lay = next(l for l in layouts if l["id"] == "lay-footwear-100x50-3stub")
        assert footwear_lay["widthMm"] == 100.0
        assert footwear_lay["heightMm"] == 50.7


@pytest.mark.asyncio
async def test_print_footwear_3stub_prn_dispatch(db_session):
    """
    Verifies POST /api/v1/barcode/print with layout 'lay-footwear-100x50-3stub'
    and dispatchMode 'prn' returns the raw ZPL stream populated dynamically.
    """
    comp, br = await _make_tenant(db_session, "prn")
    user = await _make_user(db_session, "prn", comp.id, br.id)
    headers = _bearer(user, comp.id, br.id)
    _set_tenant(comp.id, br.id, user)

    # Insert SystemConfig legal metrology overrides
    cfg1 = SystemConfig(
        id=f"cfg-{uuid.uuid4().hex[:8]}",
        company_id=comp.id,
        key="business_trade_name",
        value="Apex Retail Ventures",
    )
    cfg2 = SystemConfig(
        id=f"cfg-{uuid.uuid4().hex[:8]}",
        company_id=comp.id,
        key="legal_metrology_address",
        value="Plot 42, MIDC Industrial Area, Pune 411018",
    )
    cfg3 = SystemConfig(
        id=f"cfg-{uuid.uuid4().hex[:8]}",
        company_id=comp.id,
        key="legal_metrology_email",
        value="care@apexventures.com",
    )
    db_session.add_all([cfg1, cfg2, cfg3])
    await db_session.commit()

    payload = {
        "layout_id": "lay-footwear-100x50-3stub",
        "dispatch_mode": "prn",
        "items": [
            {
                "code": "8904551005335",
                "barcode": "8904551005335",
                "name": "CH-30-K Heel (Black 37)",
                "style_code": "CH-30-K",
                "color": "BLACK",
                "size": "37",
                "mrp": 1199.00,
                "price": 1199.00,
                "qty": 1,
            }
        ]
    }

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        r = await ac.post("/api/v1/barcode/print", json=payload, headers=headers)
        assert r.status_code == 200
        data = r.json()
        assert data.get("success") is True
        raw_stream = data.get("prn_content", "")

        # Verify dynamic resolution from SystemConfig
        assert "MKTD.By:Apex Retail Ventures" in raw_stream
        assert "Plot 42, MIDC Industrial Area, Pune 411018" in raw_stream
        assert "care@apexventures.com" in raw_stream

        # Verify Article, Size, Barcode
        assert "CH-30-K     " in raw_stream
        assert "^FR^FD37^FS" in raw_stream
        assert "^FD8904551005335^FS" in raw_stream
        assert "MRP:1199/-" in raw_stream
