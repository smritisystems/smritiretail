"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-07-12
Modified     : 2026-07-12
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


@pytest.mark.asyncio
async def test_landing_page_html(client: AsyncClient):
    """Verify that browser requesting GET / receives the HTML landing page."""
    response = await client.get("/", headers={"accept": "text/html"})
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    assert "SMRITI Retail OS" in response.text
    assert "Diagnostics &amp; State" in response.text or "Diagnostics & State" in response.text
    assert "API Status" in response.text


@pytest.mark.asyncio
async def test_landing_page_json(client: AsyncClient):
    """Verify that API requesting GET / receives the JSON landing stats."""
    response = await client.get("/", headers={"accept": "application/json"})
    assert response.status_code == 200
    assert "application/json" in response.headers["content-type"]
    data = response.json()
    assert data["product"] == "SMRITI Retail OS"
    assert data["api_status"] == "healthy"
    assert "uptime" in data
    assert "mounted_routes" in data


@pytest.mark.asyncio
async def test_404_error_html(client: AsyncClient):
    """Verify that browser requesting unknown path receives branded HTML error page."""
    response = await client.get("/nonexistent-endpoint-abc", headers={"accept": "text/html"})
    assert response.status_code == 404
    assert "text/html" in response.headers["content-type"]
    assert "Page Not Found" in response.text
    assert "SMRITI Error Code" in response.text
    assert "SMRITI-VAL-001" in response.text
    assert "Technical Details" in response.text


@pytest.mark.asyncio
async def test_404_error_json(client: AsyncClient):
    """Verify that API client requesting unknown path receives enhanced JSON response."""
    response = await client.get("/nonexistent-endpoint-abc", headers={"accept": "application/json"})
    assert response.status_code == 404
    assert "application/json" in response.headers["content-type"]
    data = response.json()
    
    # Assert legacy model properties (backward compatibility)
    assert "detail" in data
    assert "error" in data
    assert data["error"]["error_code"] == "SMRITI-VAL-001"
    assert data["error"]["title"] == "Page Not Found"
    
    # Assert new flat SEEF properties
    assert data["success"] is False
    assert data["status"] == 404
    assert data["title"] == "Page Not Found"
    assert data["error_code"] == "SMRITI-VAL-001"
    assert "reference_id" in data
    assert "timestamp" in data
