"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.29.0
Created      : 2026-08-20
Modified     : 2026-08-20
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import pytest
from httpx import ASGITransport, AsyncClient

from app.api.deps import get_db, get_company_db, get_tenant_context, TenantContext
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.auth import User, UserRole
from app.models.tenant import Company, Branch
from app.tests.conftest import clear_db


@pytest.fixture(autouse=True)
async def override_db_and_tenant(db_session):
    """Wire test DB session into app and clean tables."""
    await clear_db(db_session)

    async def _get_db():
        yield db_session

    app.dependency_overrides[get_db] = _get_db
    app.dependency_overrides[get_company_db] = _get_db
    try:
        yield
    finally:
        try:
            await clear_db(db_session)
        except Exception:
            pass
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_company_db, None)
        app.dependency_overrides.pop(get_tenant_context, None)


import uuid

async def _make_user(db_session, username, role):
    comp = Company(id=f"comp-db-{username}", name="DB Co", gst_number="27ABCDE1234F1Z5", is_active=True)
    br = Branch(id=f"br-db-{username}", company_id=comp.id, name="DB Br", code=f"BRDB-{username[:6]}", is_active=True)
    db_session.add_all([comp, br])
    await db_session.commit()

    u = User(
        id=f"user-{username}",
        username=username,
        email=f"{username}@smritibooks.com",
        hashed_password=hash_password("admin123"),
        role=role,
        is_active=True,
        is_deleted=False,
        company_id=comp.id,
        branch_id=br.id,
    )
    db_session.add(u)
    await db_session.commit()
    token = create_access_token({
        "sub": u.id,
        "username": u.username,
        "role": u.role.value if hasattr(u.role, "value") else u.role,
        "company_id": comp.id,
        "branch_id": br.id,
        "jti": str(uuid.uuid4()),
        "type": "access"
    })
    return token, comp, br


@pytest.mark.asyncio
async def test_list_databases_sysadmin(db_session):
    token, _, _ = await _make_user(db_session, "sysadmin_user", UserRole.SYSADMIN.value)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get(
            "/api/v1/database-manager/databases",
            headers={"Authorization": f"Bearer {token}"}
        )
    assert res.status_code == 200, res.text
    data = res.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    db_names = [d["name"] for d in data]
    assert "postgres" in db_names or "smritisys" in db_names or "smriti001" in db_names


@pytest.mark.asyncio
async def test_list_tables_and_schema(db_session):
    token, _, _ = await _make_user(db_session, "sysadmin_user2", UserRole.SYSADMIN.value)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Tables
        res = await ac.get(
            "/api/v1/database-manager/tables?database=smritisys",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert res.status_code == 200, res.text
        tables = res.json()
        assert isinstance(tables, list)
        table_names = [t["name"] for t in tables]
        assert "users" in table_names

        # Schema
        schema_res = await ac.get(
            "/api/v1/database-manager/tables/users/schema?database=smritisys",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert schema_res.status_code == 200, schema_res.text
        schema = schema_res.json()
        assert schema["table_name"] == "users"
        assert "id" in schema["primary_keys"]
        col_names = [c["name"] for c in schema["columns"]]
        assert "username" in col_names
        assert "email" in col_names


@pytest.mark.asyncio
async def test_table_data_pagination(db_session):
    token, _, _ = await _make_user(db_session, "sysadmin_user3", UserRole.SYSADMIN.value)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get(
            "/api/v1/database-manager/tables/users/data?database=smritisys&page=1&limit=10",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert res.status_code == 200, res.text
        data = res.json()
        assert data["table_name"] == "users"
        assert data["page"] == 1
        assert data["limit"] == 10
        assert isinstance(data["rows"], list)
        assert data["total_rows"] >= 1


@pytest.mark.asyncio
async def test_safe_sql_query_runner(db_session):
    token, _, _ = await _make_user(db_session, "sysadmin_user4", UserRole.SYSADMIN.value)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Valid SELECT query
        res = await ac.post(
            "/api/v1/database-manager/query",
            json={"query": "SELECT count(*) as total_users FROM users;", "database": "smritisys"},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert res.status_code == 200, res.text
        q_data = res.json()
        assert q_data["success"] is True
        assert "total_users" in q_data["columns"]
        assert len(q_data["rows"]) == 1

        # Blocked destructive query (DELETE)
        res_del = await ac.post(
            "/api/v1/database-manager/query",
            json={"query": "DELETE FROM users WHERE 1=1;", "database": "smritisys"},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert res_del.status_code == 400
        assert "Forbidden" in res_del.json()["detail"]

        # Blocked destructive query (DROP)
        res_drop = await ac.post(
            "/api/v1/database-manager/query",
            json={"query": "DROP TABLE users;", "database": "smritisys"},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert res_drop.status_code == 400


@pytest.mark.asyncio
async def test_database_manager_role_gate(db_session):
    cashier_token, _, _ = await _make_user(db_session, "cashier_user", UserRole.CASHIER.value)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get(
            "/api/v1/database-manager/databases",
            headers={"Authorization": f"Bearer {cashier_token}"}
        )
        assert res.status_code == 403
        assert "SYSADMIN" in res.json()["detail"]
