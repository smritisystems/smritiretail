"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.95.0
Created      : 2026-10-18
Modified     : 2026-10-18
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Visual Reports Dashboard Test Suite
"""

import uuid
from datetime import date, timedelta
from decimal import Decimal
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.api.deps import TenantContext, get_tenant_context
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.auth import User, UserRole
from app.models.tenant import Company, Branch
from app.models.inventory import Product, StockMovement
from app.models.sales import SalesInvoice, SalesOrder, SalesOrderReservation
from app.models.fulfillment import PackingSlip, Dispatch
from app.services.visual_reports_service import VisualReportsService
from app.schemas.visual_reports import DashboardConfigPayload, VisualReportsSummaryResponse


async def _make_tenant(db_session, suffix: str):
    s = f"{suffix}_{uuid.uuid4().hex[:6]}"
    comp = Company(
        id=f"comp-vr-{s}",
        name=f"Visual Reports Test Co {s}",
        gst_number="27ABCDE1234F1Z5",
        is_active=True,
    )
    br = Branch(
        id=f"br-vr-{s}",
        company_id=comp.id,
        name=f"Main Branch {s}",
        code=f"BR-{s.upper()}",
        is_active=True,
    )
    db_session.add_all([comp, br])
    await db_session.commit()
    return comp, br


async def _make_user(db_session, suffix: str, comp_id: str, br_id: str, role: UserRole = UserRole.MANAGER):
    s = f"{suffix}_{uuid.uuid4().hex[:6]}"
    user = User(
        id=f"usr-vr-{s}",
        username=f"usr_vr_{s}",
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


def _set_tenant(comp_id: str, br_id: str):
    async def _gt():
        return TenantContext(company_id=comp_id, branch_id=br_id)
    app.dependency_overrides[get_tenant_context] = _gt


@pytest.mark.asyncio
async def test_visual_dashboard_summary_api(db_session):
    """
    Verifies that GET /api/v1/reports/visual-dashboard/summary executes cleanly
    with explicit date parameters and returns consolidated KPI cards, stock flow timeline,
    workflow stages, category positions, and dispatch/invoice summaries.
    """
    comp, br = await _make_tenant(db_session, "dash1")
    manager = await _make_user(db_session, "mgr", comp.id, br.id, role=UserRole.MANAGER)
    headers = _bearer(manager, comp.id, br.id)
    _set_tenant(comp.id, br.id)

    today = date.today()
    start_date = today - timedelta(days=14)
    end_date = today

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get(
            f"/api/v1/reports/visual-dashboard/summary?company_id={comp.id}&start_date={start_date}&end_date={end_date}",
            headers=headers,
        )
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        data = res.json()
        assert "company_name" in data
        assert "kpis" in data
        assert len(data["kpis"]) == 6
        assert "stock_flow_timeline" in data
        assert "workflow_stages" in data
        assert len(data["workflow_stages"]) == 4
        assert "dispatch_invoice_summary" in data
        assert len(data["dispatch_invoice_summary"]) == 2
        assert "config" in data


@pytest.mark.asyncio
async def test_visual_dashboard_config_get_and_post(db_session):
    """
    Verifies GET and POST for /api/v1/reports/visual-dashboard/config.
    Ensures persistent storage and retrieval of visual dashboard layout preferences.
    """
    comp, br = await _make_tenant(db_session, "cfg1")
    manager = await _make_user(db_session, "mgr", comp.id, br.id, role=UserRole.MANAGER)
    headers = _bearer(manager, comp.id, br.id)
    _set_tenant(comp.id, br.id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Get default config
        get_res = await ac.get("/api/v1/reports/visual-dashboard/config", headers=headers)
        assert get_res.status_code == 200
        cfg = get_res.json()
        assert cfg["layout_mode"] == "focused"

        # 2. Update config
        cfg["layout_mode"] = "compact"
        cfg["custom_accent_color"] = "#10b981"
        post_res = await ac.post("/api/v1/reports/visual-dashboard/config", json=cfg, headers=headers)
        assert post_res.status_code == 200
        saved = post_res.json()
        assert saved["layout_mode"] == "compact"
        assert saved["custom_accent_color"] == "#10b981"

        # 3. Verify get returns updated config
        get_res2 = await ac.get("/api/v1/reports/visual-dashboard/config", headers=headers)
        assert get_res2.status_code == 200
        assert get_res2.json()["layout_mode"] == "compact"
