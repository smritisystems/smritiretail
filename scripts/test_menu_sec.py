"""
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.0
 * Created      : 2026-08-15
 * Modified     : 2026-08-15
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
"""

import sys, os
sys.path.insert(0, r"F:\SMRITRretailNX\backend")
sys.stdout.reconfigure(encoding='utf-8')

import pytest
import asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.security import create_access_token
from app.models.auth import UserRole

@pytest.mark.asyncio
async def test_role_based_menu_resolver_and_security_boundaries():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Create access tokens for real users in DB
        token_sysadmin = create_access_token({"sub": "usr-super", "type": "access", "role": "SYSADMIN", "company_id": "comp-1786046519947", "branch_id": "br-1786046519947"})
        token_manager = create_access_token({"sub": "usr-manager", "type": "access", "role": "MANAGER", "company_id": "comp-default", "branch_id": "br-default"})
        token_cashier = create_access_token({"sub": "usr-cashier", "type": "access", "role": "CASHIER", "company_id": "comp-default", "branch_id": "br-default"})

        headers_sysadmin = {"Authorization": f"Bearer {token_sysadmin}", "X-Company-Code": "comp-1786046519947", "X-Branch-Code": "br-1786046519947"}
        headers_cashier = {"Authorization": f"Bearer {token_cashier}", "X-Company-Code": "comp-default", "X-Branch-Code": "br-default"}

        # 1. SYSADMIN Resolver Test (Returns 200, includes restricted admin routes)
        res_sysadmin = await client.get("/api/v1/menus/resolved", headers=headers_sysadmin)
        assert res_sysadmin.status_code == 200, f"SYSADMIN menu resolver failed: {res_sysadmin.status_code}"
        menus_sysadmin = res_sysadmin.json()
        routes_sysadmin = [m["route"] for m in menus_sysadmin if m["route"]]
        assert "/dev-tracker" in routes_sysadmin or "/audit-logs" in routes_sysadmin, "SYSADMIN must see admin routes"

        # 2. CASHIER Resolver Test (Returns 200, restricted admin menus hidden)
        res_cashier = await client.get("/api/v1/menus/resolved", headers=headers_cashier)
        assert res_cashier.status_code == 200, f"CASHIER menu resolver failed: {res_cashier.status_code}"
        menus_cashier = res_cashier.json()
        routes_cashier = [m["route"] for m in menus_cashier if m["route"]]
        assert "/dev-tracker" not in routes_cashier, "CASHIER must NOT see /dev-tracker menu"
        assert "/audit-logs" not in routes_cashier, "CASHIER must NOT see /audit-logs menu"

        # 3. Security Boundary Rule 5 Test: Hidden Menu != API Bypass
        # CASHIER attempts direct POST to protected endpoint requiring SYSADMIN/MANAGER
        res_direct_api = await client.post("/api/v1/products/", json={"code": "TEST-PROD-99"}, headers=headers_cashier)
        assert res_direct_api.status_code == 403, f"Direct API access by CASHIER must return 403 Forbidden! Got {res_direct_api.status_code}"

        # 4. Admin Menu Editing Guard Test: system.menu.manage
        # CASHIER tries PUT /api/v1/menus/menu-pos
        res_edit_cashier = await client.put("/api/v1/menus/menu-pos", json={"title": "Hacked Title"}, headers=headers_cashier)
        assert res_edit_cashier.status_code == 403, "CASHIER cannot edit menu definitions!"

        # SYSADMIN edits menu definition
        res_edit_sys = await client.put("/api/v1/menus/menu-pos", json={"title": "Billing Desk (Security Tested)"}, headers=headers_sysadmin)
        assert res_edit_sys.status_code == 200, f"SYSADMIN menu edit failed! {res_edit_sys.status_code}"
        assert res_edit_sys.json()["title"] == "Billing Desk (Security Tested)"

        # Revert menu title back
        await client.put("/api/v1/menus/menu-pos", json={"title": "Billing Desk"}, headers=headers_sysadmin)

        print("✅ SECURITY MATRIX PASSED: SYSADMIN status=200, CASHIER status=200 with admin routes hidden, Direct API returned 403, system.menu.manage enforced.")

if __name__ == "__main__":
    asyncio.run(test_role_based_menu_resolver_and_security_boundaries())
