"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 4.2.0
Created      : 2026-07-20
Modified     : 2026-07-20
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.api.deps import get_db
from app.services.screen_studio_service import ScreenStudioService
from app.tests.conftest import clear_db
from app.db.base import BaseEntity


@pytest.fixture(autouse=True)
async def override_db(db_session):
    async with db_session.bind.begin() as conn:
        await conn.run_sync(BaseEntity.metadata.create_all)
    try:
        await clear_db(db_session)
    except Exception:
        await db_session.rollback()
        await clear_db(db_session)

    async def _get_db():
        yield db_session

    app.dependency_overrides[get_db] = _get_db
    yield
    app.dependency_overrides.pop(get_db, None)
    try:
        await clear_db(db_session)
    except Exception:
        await db_session.rollback()
        await clear_db(db_session)


@pytest.mark.asyncio
async def test_screen_studio_service_save_and_list(db_session):
    """Verifies ScreenStudioService template saving and listing."""
    svc = ScreenStudioService(db_session)
    tpl = await svc.save_layout_template(
        screen_id="pos",
        template_name="Footwear Specialized Grid",
        industry_pack="FOOTWEAR",
        max_primary_buttons=9,
        fields_config=[{"id": "size", "visible": True}, {"id": "color", "visible": True}],
        buttons_config=[{"id": "scan", "isPrimary": True}],
        is_default=True,
    )

    assert tpl.screen_id == "pos"
    assert tpl.industry_pack == "FOOTWEAR"
    assert tpl.max_primary_buttons == 9

    templates = await svc.list_layout_templates(screen_id="pos")
    assert len(templates) >= 1
    assert templates[0].template_name == "Footwear Specialized Grid"


@pytest.mark.asyncio
async def test_screen_studio_rest_api_save_and_list(db_session):
    """Verifies REST endpoints under /api/v1/screen-studio/*."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 1. Save template endpoint
        res_save = await ac.post(
            "/api/v1/screen-studio/templates/save",
            json={
                "screen_id": "items",
                "template_name": "Apparel Layout",
                "industry_pack": "APPAREL",
                "max_primary_buttons": 8,
                "fields_config": [{"id": "fit", "visible": True}],
            }
        )
        assert res_save.status_code == 200
        assert res_save.json()["success"] is True
        assert res_save.json()["screen_id"] == "items"

        # 2. List templates endpoint
        res_list = await ac.get("/api/v1/screen-studio/templates/list?screen_id=items")
        assert res_list.status_code == 200
        assert res_list.json()["count"] >= 1
