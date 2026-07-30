"""
Project      : SMRITI Retail OS
Organization : SmritiSys
Module       : Company Onboarding Setup & State Machine Unit Tests
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.future import select

from app.main import app
from app.models.tenant import Company, Branch
from app.models.inventory import Store
from app.models.auth import User
from app.models.system import SystemConfig


@pytest.mark.asyncio
async def test_company_setup_provisioning(db_session):
    """
    Verify POST /api/v1/company/setup provisions Company, Branch, Store, User,
    sets setup_state = INITIALIZED and setup_completed = true, and commits cleanly.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        setup_payload = {
            "businessInfo": {
                "name": "Smriti Retail India Pvt Ltd",
                "tradeName": "Smriti Hypermarket",
                "businessType": "retail",
                "gstin": "09AAACS1234A1ZP",
                "pan": "AAACS1234A",
                "state": "Uttar Pradesh",
                "financialYear": "2026-2027",
                "booksStartDate": "2026-04-01"
            },
            "orgStructure": {
                "layout": "single",
                "stores": [
                    {
                        "name": "Gorakhpur Main Branch",
                        "code": "GKP-01",
                        "type": "Company Owned",
                        "address": "Civil Lines",
                        "city": "Gorakhpur",
                        "state": "Uttar Pradesh",
                        "pinCode": "273001",
                        "contactPerson": "Branch Manager",
                        "mobile": "9876543210",
                        "email": "gkp@smritisys.com"
                    },
                    {
                        "name": "Lucknow Express Branch",
                        "code": "LKO-02",
                        "type": "Company Owned",
                        "address": "Hazratganj",
                        "city": "Lucknow",
                        "state": "Uttar Pradesh",
                        "pinCode": "226001",
                        "contactPerson": "Regional Manager",
                        "mobile": "9876543211",
                        "email": "lko@smritisys.com"
                    }
                ]
            },
            "operations": {
                "modules": {"pos": True, "inventory": True, "sales": True}
            },
            "accounting": {
                "gstType": "regular",
                "createLedgers": True,
                "roundOffMode": "auto"
            },
            "inventory": {
                "valuation": "FIFO",
                "negativeStock": "block",
                "baseUOM": "Pcs"
            },
            "pos": {
                "printerWidth": "80mm",
                "paymentModes": {"Cash": True, "Card": True, "UPI": True}
            },
            "users": {
                "staff": [
                    {
                        "name": "Vikram Singh",
                        "username": "vikram_smriti",
                        "role": "Store Manager",
                        "email": "vikram@smritisys.com"
                    }
                ]
            }
        }

        res = await client.post("/api/v1/company/setup", json=setup_payload)
        assert res.status_code == 200, f"Expected 200 OK, got {res.status_code}: {res.text}"
        data = res.json()
        assert data["success"] is True
        assert data["company"]["name"] == "Smriti Retail India Pvt Ltd"
        assert len(data["company"]["branches"]) == 2
        assert len(data["company"]["stores"]) == 2

        # 1. Verify Database Persisted Company
        companies = (await db_session.execute(select(Company))).scalars().all()
        assert len(companies) >= 1
        created_comp = companies[-1]
        assert created_comp.name == "Smriti Retail India Pvt Ltd"
        assert created_comp.gst_number == "09AAACS1234A1ZP"

        # 2. Verify Database Persisted Branches
        branches = (await db_session.execute(select(Branch).where(Branch.company_id == created_comp.id))).scalars().all()
        assert len(branches) == 2

        # 3. Verify Database Persisted Stores
        stores = (await db_session.execute(select(Store).where(Store.company_id == created_comp.id))).scalars().all()
        assert len(stores) == 2

        # 4. Verify Database Persisted Users
        users = (await db_session.execute(select(User).where(User.company_id == created_comp.id))).scalars().all()
        assert len(users) >= 1
        assert users[0].username == "vikram_smriti"

        # 5. Verify Database Setup Completed Config & State Machine
        configs = (await db_session.execute(select(SystemConfig))).scalars().all()
        config_map = {c.key: c.value for c in configs}
        assert config_map.get("setup_completed") == "true"
        assert config_map.get("setup_state") == "INITIALIZED"

        # 6. Verify duplicate setup attempt is blocked with 400
        dup_res = await client.post("/api/v1/company/setup", json=setup_payload)
        assert dup_res.status_code == 400
        assert "already been completed" in dup_res.json()["detail"]
