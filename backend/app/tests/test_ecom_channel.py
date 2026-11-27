"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.21.0
Created      : 2026-08-17
Modified     : 2026-08-17
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.config import settings
from app.models.company_registry import CompanyDatabaseRegistry
from app.models.tenant import Company


@pytest.mark.asyncio
async def test_ecom_channels_status():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/api/v1/ecom/channels/status")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "OPERATIONAL"
        assert data["core_channel_engine"] == "COMPANY_LOCAL_DATABASE_ENABLED"
        assert "shopify" in data["channels"]
        assert data["channels"]["shopify"]["status"] in ["NOT_CONFIGURED", "CONFIGURED_ACTIVE"]
        assert data["channels"]["internal_store"]["status"] == "ACTIVE"


import uuid

@pytest.mark.asyncio
async def test_ecom_webhook_ingress_routing(db_session):
    unique_ord = f"SHOP-TEST-{uuid.uuid4().hex[:8]}"
    db_session.add_all(
        [
            Company(
                id="COMP-001",
                name="E-commerce Test Company",
                is_active=True,
                is_deleted=False,
            ),
            CompanyDatabaseRegistry(
                company_id="COMP-001",
                database_id="db-ecom-test",
                database_name="smritisys",
                status="READY",
            ),
        ]
    )
    await db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        payload = {
            "channel": "shopify",
            "event_type": "orders/create",
            "order_id": unique_ord,
            "payload": {"line_items": [{"sku": "CH-01-A-CREAM-36", "qty": 1}]}
        }
        headers = {
            "X-Company-ID": "COMP-001",
            "X-Internal-Service-Key": settings.INTERNAL_SERVICE_KEY,
        }
        response = await ac.post("/api/v1/ecom/webhooks/ingress", json=payload, headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["received"] is True
        assert data["order_id"] == unique_ord
        assert data["status"] in ["ACCEPTED_FOR_ROUTING", "DUPLICATE_IGNORED"]
