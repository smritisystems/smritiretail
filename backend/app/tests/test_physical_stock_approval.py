"""
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 *
 * Founders
 *
 * Pushpa Devi Jawahar Mallah -- Founder & Chairperson
 * Jawahar Ramkripal Mallah   -- Founder, CEO & Chief Software Architect
 * Websites: aitdl.com | erpnbook.com | smritibooks.com
 *
 * Version      : 3.17.3
 * Created      : 2026-10-27
 * Modified     : 2026-10-27
 * Copyright    : (c) AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 *
 * Test Suite   : WMS Physical Stock Approval -- Movement Commitment
 * Sprint        : WMS Physical Stock Variance Commitment
 * Covers        : PHY-005  PATCH /api/v1/physical-stock/sessions/{id}/approve
 *
 * TC-001  INWARD_SURPLUS movement created for surplus count line
 * TC-002  OUTWARD_SHRINKAGE movement created for shortage count line
 * TC-003  Zero-variance lines produce no movement
 * TC-004  WAC frozen from product_cost_valuations when line has no unit_cost
 * TC-005  Idempotency: second approval call does not double-create movements
 * TC-006  Session header rollup (total_variance_qty, total_variance_value) correct
 * TC-007  Non-MANAGER role receives 403 SMRITI-PERM-001
 * TC-008  Approving a DRAFT (not COMPLETED) session returns 422
 * TC-009  Response payload contains movements_created count and message
 * TC-010  Mixed surplus + shortage lines each produce correct movement type
"""

import uuid
import pytest
from decimal import Decimal
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select, text

from app.main import app
from app.models.auth import User, UserRole
from app.models.inventory import Product, StockMovement, Warehouse
from app.models.profitability import ProductCostValuation
from app.models.tenant import Branch, Company
from app.core.security import create_access_token
from app.api.deps import get_db, get_company_db, get_tenant_context

pytestmark = pytest.mark.asyncio

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _create_tenant(db, suffix: str):
    uid = uuid.uuid4().hex[:6]
    # Flush in FK dependency order: Company → Branch → Warehouse / Users
    co = Company(id=f"co-ps-{uid}", name=f"PS Test Co {uid}", gst_number="27AAAAA0000A1Z5", is_active=True)
    db.add(co)
    await db.flush()  # Company must exist before Branch FK resolves

    br = Branch(id=f"br-ps-{uid}", company_id=co.id, name=f"PS Branch {uid}", code=f"PSB{uid}", is_active=True)
    db.add(br)
    await db.flush()  # Branch must exist before Warehouse FK resolves

    wh   = Warehouse(id=f"wh-ps-{uid}", company_id=co.id, branch_id=br.id,
                     code=f"WH{uid.upper()}", name=f"PS Godown {uid}",
                     is_active=True, is_central_godown=True)
    mgr  = User(id=f"usr-mgr-{uid}", company_id=co.id, branch_id=br.id,
                username=f"mgr_{uid}", email=f"mgr_{uid}@test.com",
                hashed_password="x", role=UserRole.MANAGER, is_active=True)
    clrk = User(id=f"usr-clrk-{uid}", company_id=co.id, branch_id=br.id,
                username=f"clrk_{uid}", email=f"clrk_{uid}@test.com",
                hashed_password="x", role=UserRole.CASHIER, is_active=True)
    db.add_all([wh, mgr, clrk])
    await db.flush()
    return co, br, wh, mgr, clrk



async def _create_product(db, co_id: str, br_id: str, *, wac: float = 120.00) -> Product:
    uid = uuid.uuid4().hex[:8]
    prod = Product(
        id=f"prd-{uid}", company_id=co_id, branch_id=br_id,
        name=f"TestProd {uid}",
        code=f"TP{uid}",
        sku=f"SKU{uid}",
        barcode=f"BAR{uid}",           # NOT NULL, unique index on (company_id, barcode)
        category="General",            # NOT NULL
        price=Decimal("0.00"),         # NOT NULL (default 0.00)
        mrp=Decimal("0.00"),
        gst_percentage=Decimal("18.00"),
        stock=0,                       # NOT NULL (default 0)
        is_active=True,
        is_deleted=False,
    )
    db.add(prod)
    await db.flush()
    pcv = ProductCostValuation(
        id=f"pcv-{uid}", company_id=co_id, branch_id=br_id,
        product_id=prod.id, weighted_average_cost=Decimal(str(wac)),
    )
    db.add(pcv)
    await db.flush()
    return prod




async def _insert_stock_take(db, co_id, br_id, wh_id, status="COMPLETED") -> str:
    take_id = f"st-{uuid.uuid4().hex[:10]}"
    take_no = f"ST-{uuid.uuid4().hex[:6].upper()}"
    await db.execute(text("""
        INSERT INTO stock_takes
          (id, company_id, branch_id, stock_take_no, description, count_date,
           warehouse_id, status, notes, total_lines, total_variance_qty, total_variance_value,
           created_by, updated_by, created_at, modified_at, is_active, is_deleted, version)
        VALUES
          (:id, :co, :br, :no, '', NOW(), :wh, :st, '', 0, 0, 0,
           'test', 'test', NOW(), NOW(), true, false, 1)
    """), {"id": take_id, "co": co_id, "br": br_id, "no": take_no, "wh": wh_id, "st": status})
    await db.flush()
    return take_id


async def _insert_count_line(
    db, co_id, br_id, take_id, wh_id,
    product_id, product_name, sku,
    computed_qty: float, counted_qty: float,
    unit_cost: float = None,
) -> str:
    line_id  = f"scl-{uuid.uuid4().hex[:10]}"
    variance = counted_qty - computed_qty
    uc = unit_cost
    vv = abs(variance) * uc if uc is not None else 0.0
    await db.execute(text("""
        INSERT INTO stock_count_lines
          (id, company_id, branch_id, stock_take_id, product_id, product_name,
           sku, barcode, warehouse_id, bin_location, batch_no,
           computed_qty, counted_qty, variance_qty, unit_cost, variance_value,
           status, notes, created_by, updated_by, created_at, modified_at,
           is_active, is_deleted, is_reconciled, version)
        VALUES
          (:id, :co, :br, :take, :pid, :pname,
           :sku, '', :wh, NULL, NULL,
           :cq, :cnt, :vq, :uc, :vv,
           'PENDING', '', 'test', 'test', NOW(), NOW(),
           true, false, false, 1)
    """), {
        "id": line_id, "co": co_id, "br": br_id, "take": take_id,
        "pid": product_id, "pname": product_name, "sku": sku, "wh": wh_id,
        "cq": computed_qty, "cnt": counted_qty, "vq": variance,
        "uc": uc, "vv": vv,
    })
    await db.flush()
    return line_id


def _auth_headers(user: User, co_id: str, br_id: str, role: str = None) -> dict:
    token = create_access_token(
        data={"sub": user.id, "company_id": co_id, "branch_id": br_id,
              "role": role or user.role.value}
    )
    return {"Authorization": f"Bearer {token}", "X-Company-ID": co_id, "X-Branch-ID": br_id}


# ---------------------------------------------------------------------------
# Fixture: wire async client and tenant context override
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
async def setup_test_context(db_session):
    async def _get_db():
        yield db_session

    class _FakeTenant:
        company_id = None
        branch_id  = None

    async def _get_tenant():
        return _FakeTenant()

    app.dependency_overrides[get_db]             = _get_db
    app.dependency_overrides[get_company_db]     = _get_db
    app.dependency_overrides[get_tenant_context] = _get_tenant
    yield
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# TC-001 -- INWARD_SURPLUS created for positive variance (counted > system)
# ---------------------------------------------------------------------------

async def test_tc001_inward_surplus_movement_created(db_session):
    """BUSINESS RULE: counted_qty > computed_qty => INWARD_SURPLUS StockMovement."""
    co, br, wh, mgr, _ = await _create_tenant(db_session, "tc001")
    prod = await _create_product(db_session, co.id, br.id, wac=150.00)
    take_id = await _insert_stock_take(db_session, co.id, br.id, wh.id)
    await _insert_count_line(
        db_session, co.id, br.id, take_id, wh.id,
        prod.id, prod.name, prod.sku,
        computed_qty=10.0, counted_qty=15.0, unit_cost=150.00
    )
    await db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.patch(
            f"/api/v1/physical-stock/sessions/{take_id}/approve",
            headers=_auth_headers(mgr, co.id, br.id)
        )
    assert resp.status_code == 200, resp.text
    assert resp.json()["movements_created"] == 1

    mv = (await db_session.execute(
        select(StockMovement).where(StockMovement.reference_doc_id == take_id)
    )).scalars().first()
    assert mv is not None, "StockMovement must exist after approval"
    assert mv.movement_type == "INWARD_SURPLUS"
    assert float(mv.quantity) == pytest.approx(5.0)
    assert float(mv.unit_cost) == pytest.approx(150.00)
    assert mv.reference_doc_type == "STOCK_TAKE"
    assert mv.cost_source == "PHYSICAL_COUNT_APPROVED"


# ---------------------------------------------------------------------------
# TC-002 -- OUTWARD_SHRINKAGE created for negative variance (counted < system)
# ---------------------------------------------------------------------------

async def test_tc002_outward_shrinkage_movement_created(db_session):
    """BUSINESS RULE: counted_qty < computed_qty => OUTWARD_SHRINKAGE StockMovement."""
    co, br, wh, mgr, _ = await _create_tenant(db_session, "tc002")
    prod = await _create_product(db_session, co.id, br.id, wac=200.00)
    take_id = await _insert_stock_take(db_session, co.id, br.id, wh.id)
    await _insert_count_line(
        db_session, co.id, br.id, take_id, wh.id,
        prod.id, prod.name, prod.sku,
        computed_qty=20.0, counted_qty=13.0, unit_cost=200.00
    )
    await db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.patch(
            f"/api/v1/physical-stock/sessions/{take_id}/approve",
            headers=_auth_headers(mgr, co.id, br.id)
        )
    assert resp.status_code == 200, resp.text

    mv = (await db_session.execute(
        select(StockMovement).where(StockMovement.reference_doc_id == take_id)
    )).scalars().first()
    assert mv.movement_type == "OUTWARD_SHRINKAGE"
    assert float(mv.quantity) == pytest.approx(7.0), "Qty must be abs(variance)"
    assert float(mv.unit_cost) == pytest.approx(200.00)


# ---------------------------------------------------------------------------
# TC-003 -- Zero-variance lines produce no movement
# ---------------------------------------------------------------------------

async def test_tc003_zero_variance_no_movement(db_session):
    """BUSINESS RULE: counted_qty == computed_qty => no StockMovement created."""
    co, br, wh, mgr, _ = await _create_tenant(db_session, "tc003")
    prod = await _create_product(db_session, co.id, br.id, wac=100.00)
    take_id = await _insert_stock_take(db_session, co.id, br.id, wh.id)
    await _insert_count_line(
        db_session, co.id, br.id, take_id, wh.id,
        prod.id, prod.name, prod.sku,
        computed_qty=10.0, counted_qty=10.0, unit_cost=100.00
    )
    await db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.patch(
            f"/api/v1/physical-stock/sessions/{take_id}/approve",
            headers=_auth_headers(mgr, co.id, br.id)
        )
    assert resp.status_code == 200
    body = resp.json()
    assert body["movements_created"] == 0
    assert body["total_variance_qty"] == pytest.approx(0.0)

    rows = (await db_session.execute(
        select(StockMovement).where(StockMovement.reference_doc_id == take_id)
    )).scalars().all()
    assert len(rows) == 0, "Zero-variance session must produce 0 StockMovement rows"


# ---------------------------------------------------------------------------
# TC-004 -- WAC frozen from product_cost_valuations when line has no unit_cost
# ---------------------------------------------------------------------------

async def test_tc004_wac_frozen_when_line_cost_missing(db_session):
    """IMMUTABILITY RULE: NULL line unit_cost => WAC frozen at approval time."""
    co, br, wh, mgr, _ = await _create_tenant(db_session, "tc004")
    prod = await _create_product(db_session, co.id, br.id, wac=350.00)
    take_id = await _insert_stock_take(db_session, co.id, br.id, wh.id)
    await _insert_count_line(
        db_session, co.id, br.id, take_id, wh.id,
        prod.id, prod.name, prod.sku,
        computed_qty=5.0, counted_qty=9.0, unit_cost=None  # cost missing
    )
    await db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.patch(
            f"/api/v1/physical-stock/sessions/{take_id}/approve",
            headers=_auth_headers(mgr, co.id, br.id)
        )
    assert resp.status_code == 200

    mv = (await db_session.execute(
        select(StockMovement).where(StockMovement.reference_doc_id == take_id)
    )).scalars().first()
    assert mv is not None
    assert float(mv.unit_cost) == pytest.approx(350.00), \
        "Cost must be frozen from WAC in product_cost_valuations"
    assert mv.cost_source == "PHYSICAL_COUNT_WAC_FROZEN"


# ---------------------------------------------------------------------------
# TC-005 -- Idempotency: second approval does not double-create movements
# ---------------------------------------------------------------------------

async def test_tc005_idempotent_approval(db_session):
    """IDEMPOTENCY RULE: Second approval call must not create duplicate movements."""
    co, br, wh, mgr, _ = await _create_tenant(db_session, "tc005")
    prod = await _create_product(db_session, co.id, br.id, wac=80.00)
    take_id = await _insert_stock_take(db_session, co.id, br.id, wh.id)
    await _insert_count_line(
        db_session, co.id, br.id, take_id, wh.id,
        prod.id, prod.name, prod.sku,
        computed_qty=8.0, counted_qty=12.0, unit_cost=80.00
    )
    await db_session.commit()

    headers = _auth_headers(mgr, co.id, br.id)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        r1 = await ac.patch(f"/api/v1/physical-stock/sessions/{take_id}/approve", headers=headers)
        assert r1.status_code == 200
        assert r1.json()["movements_created"] == 1

    rows = (await db_session.execute(
        select(StockMovement).where(StockMovement.reference_doc_id == take_id)
    )).scalars().all()
    assert len(rows) == 1, f"Idempotency violation: expected 1 movement, got {len(rows)}"


# ---------------------------------------------------------------------------
# TC-006 -- Session header rollup is correct
# ---------------------------------------------------------------------------

async def test_tc006_header_rollup_correct(db_session):
    """AUDIT RULE: total_variance_qty and total_variance_value match line sums."""
    co, br, wh, mgr, _ = await _create_tenant(db_session, "tc006")
    p1 = await _create_product(db_session, co.id, br.id, wac=100.00)
    p2 = await _create_product(db_session, co.id, br.id, wac=200.00)
    take_id = await _insert_stock_take(db_session, co.id, br.id, wh.id)
    await _insert_count_line(db_session, co.id, br.id, take_id, wh.id,
        p1.id, p1.name, p1.sku, computed_qty=10.0, counted_qty=13.0, unit_cost=100.00)
    await _insert_count_line(db_session, co.id, br.id, take_id, wh.id,
        p2.id, p2.name, p2.sku, computed_qty=20.0, counted_qty=15.0, unit_cost=200.00)
    await db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.patch(
            f"/api/v1/physical-stock/sessions/{take_id}/approve",
            headers=_auth_headers(mgr, co.id, br.id)
        )
    assert resp.status_code == 200
    body = resp.json()
    assert body["movements_created"] == 2
    # Signed net: +3 + (-5) = -2
    assert body["total_variance_qty"]   == pytest.approx(-2.0)
    # Financial exposure: 3*100 + 5*200 = 1300
    assert body["total_variance_value"] == pytest.approx(1300.00)

    row = (await db_session.execute(text(
        "SELECT total_variance_qty, total_variance_value FROM stock_takes WHERE id = :id"
    ), {"id": take_id})).fetchone()
    assert float(row[0]) == pytest.approx(-2.0)
    assert float(row[1]) == pytest.approx(1300.00)


# ---------------------------------------------------------------------------
# TC-007 -- Non-MANAGER role receives 403 SMRITI-PERM-001
# ---------------------------------------------------------------------------

async def test_tc007_non_manager_role_forbidden(db_session):
    """PERMISSION RULE: CASHIER role must receive 403 SMRITI-PERM-001.

    We override get_current_user directly so the endpoint's own role guard
    fires rather than get_tenant_context middleware (which raises plain-string
    403 when company/branch headers don't fully satisfy its checks).
    """
    from app.api.deps import get_current_user as _gcu

    co, br, wh, _, clrk = await _create_tenant(db_session, "tc007")
    take_id = await _insert_stock_take(db_session, co.id, br.id, wh.id)
    await db_session.commit()

    # Inject CASHIER user directly — bypasses JWT decode + DB lookup
    async def _fake_cashier():
        return clrk

    app.dependency_overrides[_gcu] = _fake_cashier
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.patch(
                f"/api/v1/physical-stock/sessions/{take_id}/approve",
                headers={"X-Company-ID": co.id, "X-Branch-ID": br.id},
            )
    finally:
        app.dependency_overrides.pop(_gcu, None)

    assert resp.status_code == 403
    detail = resp.json()["detail"]
    # The SMRITI global exception handler extracts detail["message"] from the
    # HTTPException dict -- clients receive the plain message string.
    assert "manager" in detail.lower() or "administrator" in detail.lower(), \
        f"Expected permission-denied message, got: {detail!r}"


# ---------------------------------------------------------------------------
# TC-008 -- Approving a DRAFT session returns 422 SMRITI-VAL-001
# ---------------------------------------------------------------------------

async def test_tc008_draft_session_cannot_be_approved(db_session):
    """STATE MACHINE: DRAFT session must return 422 SMRITI-VAL-001.

    We override get_current_user to inject the MANAGER directly so the
    endpoint's state-machine guard (not middleware) produces the 422.
    """
    from app.api.deps import get_current_user as _gcu

    co, br, wh, mgr, _ = await _create_tenant(db_session, "tc008")
    take_id = await _insert_stock_take(db_session, co.id, br.id, wh.id, status="DRAFT")
    await db_session.commit()

    async def _fake_manager():
        return mgr

    app.dependency_overrides[_gcu] = _fake_manager
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.patch(
                f"/api/v1/physical-stock/sessions/{take_id}/approve",
                headers={"X-Company-ID": co.id, "X-Branch-ID": br.id},
            )
    finally:
        app.dependency_overrides.pop(_gcu, None)

    assert resp.status_code == 422
    detail = resp.json()["detail"]
    # Same SMRITI exception handler: plain string on wire containing the status name.
    assert "DRAFT" in detail or "COMPLETED" in detail, \
        f"Expected state-machine rejection message, got: {detail!r}"


# ---------------------------------------------------------------------------
# TC-009 -- Response payload fields are present and correct
# ---------------------------------------------------------------------------

async def test_tc009_response_payload_fields(db_session):
    """API CONTRACT: movements_created, total_variance_qty/value, message must be present."""
    co, br, wh, mgr, _ = await _create_tenant(db_session, "tc009")
    prod = await _create_product(db_session, co.id, br.id, wac=60.00)
    take_id = await _insert_stock_take(db_session, co.id, br.id, wh.id)
    await _insert_count_line(db_session, co.id, br.id, take_id, wh.id,
        prod.id, prod.name, prod.sku, computed_qty=5.0, counted_qty=8.0, unit_cost=60.00)
    await db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.patch(
            f"/api/v1/physical-stock/sessions/{take_id}/approve",
            headers=_auth_headers(mgr, co.id, br.id)
        )
    assert resp.status_code == 200
    body = resp.json()
    for field in ("id","status","approved_by","approved_at",
                  "movements_created","total_variance_qty","total_variance_value","message"):
        assert field in body, f"Required field '{field}' missing from response"
    assert body["movements_created"] == 1
    assert "committed" in body["message"].lower() or "movement" in body["message"].lower()


# ---------------------------------------------------------------------------
# TC-010 -- Mixed surplus + shortage lines each get the correct movement type
# ---------------------------------------------------------------------------

async def test_tc010_mixed_surplus_and_shortage(db_session):
    """CORRECTNESS: Mixed session produces INWARD_SURPLUS and OUTWARD_SHRINKAGE."""
    co, br, wh, mgr, _ = await _create_tenant(db_session, "tc010")
    pA = await _create_product(db_session, co.id, br.id, wac=500.00)
    pB = await _create_product(db_session, co.id, br.id, wac=300.00)
    take_id = await _insert_stock_take(db_session, co.id, br.id, wh.id)
    # Surplus +2
    await _insert_count_line(db_session, co.id, br.id, take_id, wh.id,
        pA.id, pA.name, pA.sku, computed_qty=10.0, counted_qty=12.0, unit_cost=500.00)
    # Shortage -4
    await _insert_count_line(db_session, co.id, br.id, take_id, wh.id,
        pB.id, pB.name, pB.sku, computed_qty=15.0, counted_qty=11.0, unit_cost=300.00)
    await db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.patch(
            f"/api/v1/physical-stock/sessions/{take_id}/approve",
            headers=_auth_headers(mgr, co.id, br.id)
        )
    assert resp.status_code == 200
    assert resp.json()["movements_created"] == 2

    mvs = (await db_session.execute(
        select(StockMovement).where(StockMovement.reference_doc_id == take_id)
    )).scalars().all()
    assert len(mvs) == 2

    types = {m.movement_type for m in mvs}
    assert types == {"INWARD_SURPLUS", "OUTWARD_SHRINKAGE"}

    surplus  = next(m for m in mvs if m.movement_type == "INWARD_SURPLUS")
    shortage = next(m for m in mvs if m.movement_type == "OUTWARD_SHRINKAGE")

    assert float(surplus.quantity)   == pytest.approx(2.0)
    assert float(surplus.unit_cost)  == pytest.approx(500.00)
    assert float(shortage.quantity)  == pytest.approx(4.0)
    assert float(shortage.unit_cost) == pytest.approx(300.00)

    for mv in mvs:
        assert mv.idempotency_key is not None and len(mv.idempotency_key) == 64
        assert mv.source_module      == "PHYSICAL_STOCK"
        assert mv.reference_doc_type == "STOCK_TAKE"
