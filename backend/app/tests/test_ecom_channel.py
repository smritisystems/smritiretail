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


@pytest.mark.asyncio
async def test_ecom_channels_status():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/api/v1/ecom/channels/status")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "OPERATIONAL"
        assert data["core_channel_engine"] == "COMPANY_LOCAL_DATABASE_ENABLED"
        assert "shopify" in data["channels"]
        assert data["channels"]["shopify"]["status"] == "NOT_CONFIGURED"
        assert data["channels"]["internal_store"]["status"] == "ACTIVE"


@pytest.mark.asyncio
async def test_ecom_webhook_ingress_routing():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        payload = {
            "channel": "shopify",
            "event_type": "orders/create",
            "order_id": "SHOP-TEST-99881",
            "payload": {"line_items": [{"sku": "CH-01-A-CREAM-36", "qty": 1}]}
        }
        headers = {
            "X-Company-ID": "COMP-001",
            "X-Company-Code": "001"
        }
        response = await ac.post("/api/v1/ecom/webhooks/ingress", json=payload, headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["received"] is True
        assert data["order_id"] == "SHOP-TEST-99881"
        assert data["status"] == "ACCEPTED_FOR_ROUTING"
