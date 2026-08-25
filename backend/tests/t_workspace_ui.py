"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.42.0
Created      : 2026-08-25
Modified     : 2026-08-25
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.core.security import create_access_token


def _get_auth_headers(role: str = "SYSADMIN", company_id: str = "COMP-001") -> dict:
    sub_id = "usr-cashier" if role == "CASHIER" else "usr-super"
    username = "usr_cashier" if role == "CASHIER" else "usr_super"
    token = create_access_token(
        data={
            "sub": sub_id,
            "username": username,
            "role": role,
            "company_id": company_id,
            "branch_id": "BR-001",
            "tenant_id": "smriti001",
            "db_name": "smriti001",
            "is_active": True,
        }
    )
    return {
        "Authorization": f"Bearer {token}",
        "X-Company-ID": company_id,
        "X-Company-Code": "001",
        "X-Branch-ID": "BR-001",
    }


@pytest.mark.asyncio
async def test_workspace_templates_catalog():
    """Verify standard workspace templates catalog."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/ui/templates", headers=_get_auth_headers())
        assert res.status_code == 200
        templates = res.json()
        assert len(templates) >= 6
        codes = [t["code"] for t in templates]
        assert "RETAIL_SUPERMARKET" in codes
        assert "APPAREL_FASHION" in codes
        assert "DISTRIBUTION_HUB" in codes
        assert "PHARMACY_HEALTHCARE" in codes
        assert "RESTAURANT_DINEIN" in codes
        assert "ENTERPRISE_HQ" in codes


@pytest.mark.asyncio
async def test_resolve_user_workspace_supermarket():
    """Verify workspace resolution for supermarket template."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get(
            "/api/v1/ui/workspaces/resolve?template_code=RETAIL_SUPERMARKET",
            headers=_get_auth_headers(role="SYSADMIN"),
        )
        assert res.status_code == 200
        data = res.json()
        assert data["template_code"] == "RETAIL_SUPERMARKET"
        assert data["persona"] == "PROF_SYSADMIN"
        assert "POS_FAST_BILLING" in data["layout_config"].get("default_view", "")
        assert len(data["widgets"]) > 0


@pytest.mark.asyncio
async def test_resolve_user_workspace_cashier_persona():
    """Verify workspace resolution for Cashier persona."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get(
            "/api/v1/ui/workspaces/resolve",
            headers=_get_auth_headers(role="CASHIER"),
        )
        assert res.status_code == 200
        data = res.json()
        assert data["persona"] == "PROF_CASHIER"
        assert "theme-smriti-default" in data["theme_code"]


@pytest.mark.asyncio
async def test_resolved_navigation_sysadmin():
    """Verify resolved navigation tree for SYSADMIN includes all top-level roots."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get(
            "/api/v1/ui/navigation/resolved",
            headers=_get_auth_headers(role="SYSADMIN"),
        )
        assert res.status_code == 200
        nav_nodes = res.json()
        assert len(nav_nodes) > 0
        titles = [n["title"] for n in nav_nodes]
        # Top-level menus
        assert any("POS" in t or "Sales" in t or "Inventory" in t for t in titles)


@pytest.mark.asyncio
async def test_resolved_navigation_cashier_role_gating():
    """Verify resolved navigation for CASHIER role excludes admin modules."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get(
            "/api/v1/ui/navigation/resolved",
            headers=_get_auth_headers(role="CASHIER"),
        )
        assert res.status_code == 200
        nav_nodes = res.json()
        
        # Flatten all routes in cashier navigation tree
        def extract_routes(nodes):
            routes = []
            for n in nodes:
                if n.get("path"):
                    routes.append(n["path"])
                if n.get("children"):
                    routes.extend(extract_routes(n["children"]))
            return routes

        cashier_routes = extract_routes(nav_nodes)
        # Ensure system config / security admin routes are excluded
        assert not any("/admin" in r or "/security" in r or "/dev/tracker" in r for r in cashier_routes)


@pytest.mark.asyncio
async def test_theme_design_tokens():
    """Verify CSS design tokens resolution."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get(
            "/api/v1/ui/themes/tokens?variant=dark",
            headers=_get_auth_headers(),
        )
        assert res.status_code == 200
        tokens = res.json()
        assert tokens["font_heading"] != ""
        assert tokens["font_body"] != ""
        assert "primary" in tokens["colors"]
        assert "background" in tokens["colors"]
        assert "surface" in tokens["colors"]
        assert "border_radius_px" in tokens
        assert "spacing" in tokens


@pytest.mark.asyncio
async def test_complete_screen_package_pos_billing():
    """Verify complete screen definition package for SCR_POS_BILLING."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get(
            "/api/v1/ui/screens/SCR_POS_BILLING/complete",
            headers=_get_auth_headers(),
        )
        assert res.status_code == 200
        pkg = res.json()
        assert pkg["screen_code"] == "SCR_POS_BILLING"
        assert pkg["module_code"] == "POS"
        assert pkg["route_path"] == "/pos/terminal"
        assert len(pkg["actions"]) >= 3
        act_codes = [a["code"] for a in pkg["actions"]]
        assert "ACT_POS_SAVE" in act_codes
        assert "ACT_POS_HOLD" in act_codes
        assert "ACT_POS_CANCEL" in act_codes


@pytest.mark.asyncio
async def test_complete_screen_package_not_found():
    """Verify 404 response for nonexistent screen code."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get(
            "/api/v1/ui/screens/SCR_NONEXISTENT_XYZ/complete",
            headers=_get_auth_headers(),
        )
        assert res.status_code == 404
