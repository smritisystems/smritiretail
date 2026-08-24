"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.22.0
Created      : 2026-08-23
Modified     : 2026-08-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from app.main import app
from app.core.security import create_access_token
from app.models.auth import UserRole
from app.models.ui_control_plane import SmritiTheme, SmritiWorkspaceProfile
from app.models.capability_template import WorkspaceTemplate
from app.db.session import get_company_sessionmaker


@pytest.fixture
def client():
    return TestClient(app)


def get_auth_headers(role: str = "SYSADMIN", company_id: str = "COMP-001", branch_id: str = "BR-001") -> dict:
    """Helper to generate JWT auth headers with tenant claims."""
    user_map = {
        "SYSADMIN": ("usr-super", "usr_super", UserRole.SYSADMIN.value),
        "CASHIER": ("usr-cashier", "usr_cashier", UserRole.CASHIER.value),
        "STORE_MANAGER": ("usr-manager", "usr_manager", UserRole.MANAGER.value),
        "MANAGER": ("usr-manager", "usr_manager", UserRole.MANAGER.value),
    }
    user_id, username, user_role = user_map.get(role, ("usr-super", "usr_super", UserRole.SYSADMIN.value))
    token = create_access_token(
        data={
            "sub": user_id,
            "role": user_role,
            "company_id": company_id,
            "branch_id": branch_id,
            "username": username,
        }
    )
    return {
        "Authorization": f"Bearer {token}",
        "X-Company-ID": company_id,
        "X-Branch-ID": branch_id,
    }


def test_themes_and_variants_api(client):
    """Verify active themes and color variants returned from smriti_themes in control plane."""
    headers = get_auth_headers("SYSADMIN")
    res = client.get("/api/v1/ui/themes", headers=headers)
    assert res.status_code == 200
    themes = res.json()
    assert len(themes) >= 1

    obsidian = next((t for t in themes if "Obsidian" in t["theme_name"] or t["id"] == "theme_smriti_obsidian"), None)
    assert obsidian is not None
    assert len(obsidian["variants"]) >= 2
    variant_types = {v["variant"] for v in obsidian["variants"]}
    assert "dark" in variant_types
    assert "light" in variant_types


def test_workspace_profiles_api(client):
    """Verify standard persona workspace profiles returned from smriti_workspace_profiles."""
    headers = get_auth_headers("SYSADMIN")
    res = client.get("/api/v1/ui/workspace-profiles", headers=headers)
    assert res.status_code == 200
    profiles = res.json()
    assert len(profiles) >= 4

    personas = {p["persona"] for p in profiles}
    assert "SYSADMIN" in personas
    assert "CASHIER" in personas
    assert "STORE_MANAGER" in personas
    assert "ACCOUNTANT" in personas


def test_my_workspace_profile_persona_resolution(client):
    """Verify my-profile endpoint dynamically resolves correct persona layout."""
    # Cashier
    cashier_hdr = get_auth_headers("CASHIER")
    c_res = client.get("/api/v1/ui/workspace-profiles/my-profile", headers=cashier_hdr)
    assert c_res.status_code == 200
    assert c_res.json()["persona"] == "CASHIER"
    assert c_res.json()["code"] == "PROF_CASHIER"

    # Store Manager
    mgr_hdr = get_auth_headers("STORE_MANAGER")
    m_res = client.get("/api/v1/ui/workspace-profiles/my-profile", headers=mgr_hdr)
    assert m_res.status_code == 200
    assert m_res.json()["persona"] == "STORE_MANAGER"

    # Sysadmin
    sys_hdr = get_auth_headers("SYSADMIN")
    s_res = client.get("/api/v1/ui/workspace-profiles/my-profile", headers=sys_hdr)
    assert s_res.status_code == 200
    assert s_res.json()["persona"] == "SYSADMIN"


def test_resolved_menus_sysadmin_full_access(client):
    """Verify SYSADMIN receives full 34 canonical menus in navigation tree."""
    sys_hdr = get_auth_headers("SYSADMIN")
    res = client.get("/api/v1/menus/resolved", headers=sys_hdr)
    assert res.status_code == 200
    menus = res.json()
    assert len(menus) == 34

    menu_ids = {m["id"] for m in menus}
    assert "menu-pos" in menu_ids
    assert "menu-inventory" in menu_ids
    assert "menu-reports" in menu_ids
    assert "menu-masters" in menu_ids
    assert "menu-company-setup" in menu_ids


def test_resolved_menus_cashier_pruning_and_security(client):
    """Verify CASHIER receives pruned navigation tree and cannot see restricted administrative modules."""
    cashier_hdr = get_auth_headers("CASHIER")
    res = client.get("/api/v1/menus/resolved", headers=cashier_hdr)
    assert res.status_code == 200
    menus = res.json()

    menu_ids = {m["id"] for m in menus}
    # Cashier should not have system administration, dev tracker, or audit logs in menu
    assert "menu-dev-tracker" not in menu_ids
    assert "menu-company-setup" not in menu_ids
    assert "menu-audit-logs" not in menu_ids


@pytest.mark.asyncio
async def test_database_backed_workspace_templates():
    """Verify SmritiSys contains populated workspace templates with included capability bundles."""
    sessionmaker = get_company_sessionmaker("smritisys")
    async with sessionmaker() as session:
        res = await session.execute(select(WorkspaceTemplate))
        templates = res.scalars().all()
        assert len(templates) >= 4

        supermarket = next((t for t in templates if t.code == "RETAIL_SUPERMARKET"), None)
        assert supermarket is not None
        assert "POS" in supermarket.included_capabilities
        assert "INVENTORY" in supermarket.included_capabilities
        assert "GST" in supermarket.included_capabilities

        wms_hub = next((t for t in templates if t.code == "WMS_DISTRIBUTION"), None)
        assert wms_hub is not None
        assert "WMS" in wms_hub.included_capabilities
        assert "DISTRIBUTION" in wms_hub.included_capabilities
