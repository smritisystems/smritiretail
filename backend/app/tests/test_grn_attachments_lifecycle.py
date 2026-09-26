"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders

* Pushpa Devi Jawahar Mallah
  * Founder & Chairperson
  * Email: founder@aitdl.com

* Jawahar Ramkripal Mallah
  * Founder, Chief Executive Officer (CEO) & Chief Software Architect
  * Email: founder@aitdl.com

* Websites: aitdl.com | erpnbook.com | smritibooks.com

* Version    : 3.45.0
* Created    : 2026-09-24
* Modified   : 2026-09-24
* Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software
* Classification: Internal Verification Suite
"""

import asyncio
import uuid
from decimal import Decimal
from datetime import datetime, timezone
import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.api.deps import TenantContext, get_db, get_company_db, get_tenant_context, get_current_user
from app.core.security import create_access_token, hash_password
from app.models.auth import User, UserRole
from app.models.inventory import Product, Warehouse
from app.models.tenant import Branch, Company
from app.models.purchase import Supplier, PurchaseOrder, PurchaseOrderItem
from app.models.inward_cost import InwardCostComponent
from app.db.ctrl_seeder import ControlPlaneSeeder
from app.tests.conftest import clear_db


@pytest.mark.asyncio
async def test_grn_attachments_and_edit_lifecycle(db_session):
    """
    Rigorously test the GRN lifecycle:
    1. GRN without attachment: PASS
    2. GRN + 1 attachment: PASS
    3. GRN + 3 attachments: PASS
    4. Save + reload: PASS
    5. Edit existing GRN: PASS
    """
    await clear_db(db_session)
    await ControlPlaneSeeder.seed_governed_logic(db_session)
    await db_session.commit()

    suffix = uuid.uuid4().hex[:6]
    comp = Company(
        id=f"comp-att-{suffix}",
        name=f"Attachment Test Co {suffix}",
        gst_number="27ABCDE1234F1Z5",
        is_active=True,
    )
    br = Branch(
        id=f"br-att-{suffix}",
        company_id=comp.id,
        name=f"Attachment Branch {suffix}",
        code=f"BRATT-{suffix}",
        is_active=True,
    )
    db_session.add_all([comp, br])
    await db_session.commit()

    wh = Warehouse(
        id=f"wh-att-{suffix}",
        company_id=comp.id,
        branch_id=br.id,
        code=f"WH-ATT-{suffix}",
        name="Central Receiving Godown",
        is_active=True,
    )
    db_session.add(wh)
    await db_session.commit()

    user = User(
        id=f"usr-att-{suffix}",
        username=f"usr_att_{suffix}",
        hashed_password=hash_password("Pass@1234"),
        role=UserRole.SYSADMIN,
        is_active=True,
        is_deleted=False,
        company_id=comp.id,
        branch_id=br.id,
    )
    sup = Supplier(
        id=f"sup-att-{suffix}",
        company_id=comp.id,
        name="Century Fabrics & Yarns Ltd",
        code=f"SUP-CF-{suffix}",
        gst_number="27AAACC1206D1ZM",
        is_active=True,
    )
    prod = Product(
        id=f"prod-att-{suffix}",
        company_id=comp.id,
        code=f"SKU-ATT-{suffix}",
        barcode=f"BAR-ATT-{suffix}",
        sku=f"SKU-ATT-{suffix}",
        name="100% Linen Executive Shirt",
        buying_price=800.0,
        cost_price=800.0,
        price=1800.0,
        category="Apparel",
        is_active=True,
    )
    db_session.add_all([user, sup, prod])
    await db_session.commit()

    tenant_ctx = TenantContext(
        company_id=comp.id,
        branch_id=br.id,
    )

    async def _get_db():
        yield db_session

    async def _get_tenant():
        return tenant_ctx

    async def _get_usr():
        return user

    app.dependency_overrides[get_db] = _get_db
    app.dependency_overrides[get_company_db] = _get_db
    app.dependency_overrides[get_tenant_context] = _get_tenant
    app.dependency_overrides[get_current_user] = _get_usr

    token = create_access_token({
        "sub": user.id,
        "username": user.username,
        "role": user.role.value,
        "company_id": comp.id,
        "branch_id": br.id,
        "jti": str(uuid.uuid4()),
        "type": "access",
    })
    headers = {
        "Authorization": f"Bearer {token}",
        "X-Company-Id": comp.id,
    }

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # TEST 1: GRN without attachment
        payload_1 = {
            "supplier_id": sup.id,
            "receipt_no": f"GRN-2026-001-{suffix}",
            "notes": "Consignment received in good order without attachments.",
            "items": [
                {
                    "product_id": prod.id,
                    "code": prod.code,
                    "name": prod.name,
                    "quantity_ordered": 100,
                    "quantity_received": 100,
                    "quantity_damaged": 0,
                    "cost_price": 800.0,
                    "gst_rate": 18.0,
                }
            ],
        }
        res1 = await client.post("/api/v1/purchase/receipts/", headers=headers, json=payload_1)
        assert res1.status_code == 201, f"Test 1 Failed: {res1.text}"
        data1 = res1.json()
        assert data1["receipt_no"] == f"GRN-2026-001-{suffix}"
        assert data1["status"] == "RECEIVED"
        assert data1["attachments"] is None or data1["attachments"] == []
        receipt_1_id = data1["id"]
        print("\n[PASS] 1. GRN without attachment: 201 Created")

        # TEST 2: GRN + 1 attachment
        payload_2 = {
            "supplier_id": sup.id,
            "receipt_no": f"GRN-2026-002-{suffix}",
            "notes": "Consignment with vendor invoice copy attached.",
            "attachments": [
                {"name": "001.pdf", "size": "240 KB", "type": "application/pdf"}
            ],
            "items": [
                {
                    "product_id": prod.id,
                    "code": prod.code,
                    "name": prod.name,
                    "quantity_ordered": 50,
                    "quantity_received": 50,
                    "quantity_damaged": 5,
                    "cost_price": 800.0,
                    "gst_rate": 18.0,
                }
            ],
        }
        res2 = await client.post("/api/v1/purchase/receipts/", headers=headers, json=payload_2)
        assert res2.status_code == 201, f"Test 2 Failed: {res2.text}"
        data2 = res2.json()
        assert data2["receipt_no"] == f"GRN-2026-002-{suffix}"
        assert len(data2["attachments"]) == 1
        assert data2["attachments"][0]["name"] == "001.pdf"
        print("[PASS] 2. GRN + 1 attachment: 201 Created with verified attachment metadata")

        # TEST 3: GRN + 3 attachments
        payload_3 = {
            "supplier_id": sup.id,
            "receipt_no": f"GRN-2026-003-{suffix}",
            "notes": "Consignment with 3 documents: LR, Weighbridge, and Inward Packing List.",
            "attachments": [
                {"name": "001.pdf", "size": "240 KB", "type": "application/pdf"},
                {"name": "IMG_20260515_0001.pdf", "size": "1.2 MB", "type": "application/pdf"},
                {"name": "tt2.PNG", "size": "850 KB", "type": "image/png"}
            ],
            "items": [
                {
                    "product_id": prod.id,
                    "code": prod.code,
                    "name": prod.name,
                    "quantity_ordered": 122,
                    "quantity_received": 122,
                    "quantity_damaged": 13,
                    "cost_price": 800.0,
                    "gst_rate": 18.0,
                }
            ],
        }
        res3 = await client.post("/api/v1/purchase/receipts/", headers=headers, json=payload_3)
        assert res3.status_code == 201, f"Test 3 Failed: {res3.text}"
        data3 = res3.json()
        assert len(data3["attachments"]) == 3
        receipt_3_id = data3["id"]
        print("[PASS] 3. GRN + 3 attachments: 201 Created with 3 attachments preserved")

        # TEST 4: Save + reload
        reload_res = await client.get(f"/api/v1/purchase/receipts/{receipt_3_id}", headers=headers)
        assert reload_res.status_code == 200, f"Test 4 Failed: {reload_res.text}"
        reloaded = reload_res.json()
        assert reloaded["id"] == receipt_3_id
        assert reloaded["receipt_no"] == f"GRN-2026-003-{suffix}"
        assert len(reloaded["attachments"]) == 3
        assert [a["name"] for a in reloaded["attachments"]] == ["001.pdf", "IMG_20260515_0001.pdf", "tt2.PNG"]
        print("[PASS] 4. Save + reload: 200 OK with 100% attachment parity")

        # TEST 5: Edit existing GRN
        edit_payload = {
            "notes": "Updated remarks: Lorry driver verified hamali charges. Attached signed QC slip.",
            "attachments": [
                {"name": "001.pdf", "size": "240 KB", "type": "application/pdf"},
                {"name": "IMG_20260515_0001.pdf", "size": "1.2 MB", "type": "application/pdf"},
                {"name": "tt2.PNG", "size": "850 KB", "type": "image/png"},
                {"name": "Signed_QC_Slip_Approved.pdf", "size": "512 KB", "type": "application/pdf"}
            ],
        }
        edit_res = await client.put(f"/api/v1/purchase/receipts/{receipt_3_id}", headers=headers, json=edit_payload)
        assert edit_res.status_code == 200, f"Test 5 Failed: {edit_res.text}"
        edited = edit_res.json()
        assert "signed QC slip" in edited["notes"].lower() or "signed QC slip" in edited["notes"]
        assert len(edited["attachments"]) == 4
        print("[PASS] 5. Edit existing GRN (PUT /receipts/{id}): 200 OK with 4 attachments")

        # TEST 6: List Receipts (Zero 500 regressions)
        list_res = await client.get("/api/v1/purchase/receipts/", headers=headers)
        assert list_res.status_code == 200, f"Test 6 Failed: {list_res.text}"
        all_receipts = list_res.json()
        assert len(all_receipts) >= 3
        print(f"[PASS] 6. List all receipts: 200 OK across {len(all_receipts)} receipts without 500 error")

    # Cleanup overrides
    app.dependency_overrides.clear()
