"""
Author & Creator:
Jawahar Ramkripal Mallah

Founder:
SmritiSys
AITDL Networks

Role:
Chief Systems Architect

Web:
smritisys.com | smritibooks.com | aitdl.com

Email:
jawahar.mallah@gmail.com

Copyright © 2026 SmritiSys.
All Rights Reserved.
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
    sets setup_state = LOCKED and setup_completed = true, and commits cleanly.
    """
    from app.db.session import active_tenant_ctx, active_security_context
    active_tenant_ctx.set(None)
    active_security_context.set(None)

    created_comp = None
    # Clean setup state and test entities in test session (order matters for FK constraints)
    from sqlalchemy import delete
    await db_session.execute(delete(SystemConfig).where(SystemConfig.key.in_(["setup_completed", "setup_state"])))
    await db_session.execute(delete(SystemConfig).where(SystemConfig.company_id.in_(select(Company.id).where(Company.name == "Smriti Retail India Pvt Ltd"))))
    await db_session.execute(delete(User).where(User.username == "vikram_smriti"))
    await db_session.execute(delete(Store).where(Store.code.in_(["GKP-01", "LKO-02"])))
    await db_session.execute(delete(Branch).where(Branch.code.in_(["GKP-01", "LKO-02"])))
    await db_session.execute(delete(Company).where(Company.name == "Smriti Retail India Pvt Ltd"))
    await db_session.commit()

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
                        "name": "Lucknow Regional Store",
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
                "modules": {
                    "pos": True,
                    "inventory": True,
                    "accounting": True
                }
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
                "paymentModes": {
                    "Cash": True,
                    "UPI": True,
                    "Card": True
                }
            },
            "users": {
                "staff": [
                    {
                        "username": "vikram_smriti",
                        "name": "Vikram Mallah",
                        "email": "vikram@smritisys.com",
                        "role": "Store Manager",
                        "mobile": "9876543299"
                    }
                ]
            }

        }

        res = await client.post("/api/v1/company/setup", json=setup_payload)
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"

        data = res.json()
        assert data["success"] is True
        assert data["company"]["name"] == "Smriti Retail India Pvt Ltd"
        assert len(data["company"]["branches"]) == 2
        assert len(data["company"]["stores"]) == 2

        # Verify duplicate setup call returns HTTP 400 Locked
        dup_res = await client.post("/api/v1/company/setup", json=setup_payload)
        assert dup_res.status_code == 400, f"Expected 400 Locked on dup request, got {dup_res.status_code}: {dup_res.text}"
        assert "locked and cannot be re-executed" in dup_res.json()["detail"]

    try:
        from app.db.session import async_session
        async with async_session() as fresh_db:
            # 1. Verify Database Persisted Company
            created_comp = (await fresh_db.execute(
                select(Company).where(Company.name == "Smriti Retail India Pvt Ltd").execution_options(ignore_rls_isolation=True, ignore_tenant_isolation=True)
            )).scalar_one_or_none()
            assert created_comp is not None
            assert created_comp.name == "Smriti Retail India Pvt Ltd"
            assert created_comp.gst_number == "09AAACS1234A1ZP"

            # 2. Verify Database Persisted Branches
            branches = (await fresh_db.execute(
                select(Branch).where(Branch.company_id == created_comp.id).execution_options(ignore_rls_isolation=True, ignore_tenant_isolation=True)
            )).scalars().all()
            assert len(branches) == 2

            # 3. Verify Database Persisted Stores
            stores = (await fresh_db.execute(
                select(Store).where(Store.company_id == created_comp.id).execution_options(ignore_rls_isolation=True, ignore_tenant_isolation=True)
            )).scalars().all()
            assert len(stores) == 2

            # 4. Verify Database Persisted Users
            users = (await fresh_db.execute(
                select(User).where(User.username == "vikram_smriti").execution_options(ignore_rls_isolation=True, ignore_tenant_isolation=True)
            )).scalars().all()
            assert len(users) >= 1
            assert users[0].username == "vikram_smriti"

            # 5. Verify Database Setup Completed Config & State Machine (NEW -> BOOTSTRAPPING -> INITIALIZED -> LOCKED)
            sc_completed = (await fresh_db.execute(
                select(SystemConfig).where(SystemConfig.key == "setup_completed").execution_options(ignore_rls_isolation=True, ignore_tenant_isolation=True)
            )).scalar_one_or_none()
            sc_state = (await fresh_db.execute(
                select(SystemConfig).where(SystemConfig.key == "setup_state").execution_options(ignore_rls_isolation=True, ignore_tenant_isolation=True)
            )).scalar_one_or_none()

            assert sc_completed is not None, f"setup_completed config not found in DB"
            assert sc_completed.value == "true", f"Expected setup_completed 'true', got '{sc_completed.value}'"
            assert sc_state is not None, f"setup_state config not found in DB"
            assert sc_state.value == "LOCKED", f"Expected setup_state 'LOCKED', got '{sc_state.value}'"

    finally:


        app.dependency_overrides.clear()
        if created_comp:
            await db_session.execute(delete(SystemConfig).where(SystemConfig.company_id == created_comp.id))
            await db_session.execute(delete(User).where(User.company_id == created_comp.id))
            await db_session.execute(delete(Store).where(Store.company_id == created_comp.id))
            await db_session.execute(delete(Branch).where(Branch.company_id == created_comp.id))
            await db_session.execute(delete(Company).where(Company.id == created_comp.id))

        await db_session.execute(delete(User).where(User.username == "vikram_smriti"))
        await db_session.execute(delete(SystemConfig).where(SystemConfig.key.in_(["setup_completed", "setup_state"])))
        await db_session.commit()




