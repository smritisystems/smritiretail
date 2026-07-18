"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-07-13
Modified     : 2026-07-18
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import os
import uuid
import pytest
from httpx import ASGITransport, AsyncClient

from app.api.deps import TenantContext, get_db, get_tenant_context
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.auth import User, UserRole
from app.models.inventory import Product
from app.models.tenant import Branch, Company
from app.tests.conftest import clear_db
from app.services.spif import SpifService

# Dummy 1x1 black pixel PNG in base64 format
TINY_BASE64_IMAGE = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

@pytest.fixture(autouse=True)
async def override_db_and_tenant(db_session):
    """
    Wire the test DB session into the app and clean all tables
    before and after each test.
    """
    await clear_db(db_session)

    async def _get_db():
        yield db_session
    app.dependency_overrides[get_db] = _get_db
    try:
        yield
    finally:
        try:
            await clear_db(db_session)
        except Exception:
            pass
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_tenant_context, None)


async def _make_tenant(db_session, suffix):
    comp = Company(id=f"comp-spif-{suffix}", name=f"SPIF Co {suffix}",
                   gst_number="27ABCDE1234F1Z5", is_active=True)
    br   = Branch(id=f"br-spif-{suffix}", company_id=comp.id,
                   name=f"SPIF Br {suffix}", code=f"BRSPIF-{suffix}", is_active=True)
    db_session.add_all([comp, br])
    await db_session.commit()
    return comp, br


async def _make_user(db_session, suffix, comp_id, br_id, role=UserRole.MANAGER):
    user = User(
        id=f"usr-spif-{suffix}", username=f"usr_spif_{suffix}",
        hashed_password=hash_password("Test@1234"),
        role=role, is_active=True, is_deleted=False,
        company_id=comp_id, branch_id=br_id,
    )
    db_session.add(user)
    await db_session.commit()
    return user


def _bearer(user: User, comp_id: str, br_id: str) -> dict:
    token = create_access_token({
        "sub": user.id, "username": user.username,
        "role": user.role.value, "company_id": comp_id, "branch_id": br_id,
        "jti": str(uuid.uuid4()), "type": "access",
    })
    return {"Authorization": f"Bearer {token}"}


def _set_tenant(db_session, comp_id, br_id):
    async def _gt():
        return TenantContext(company_id=comp_id, branch_id=br_id)
    app.dependency_overrides[get_tenant_context] = _gt


@pytest.mark.asyncio
async def test_spif_lifecycle_success(db_session):
    # Setup company, branch, user and headers
    comp, br = await _make_tenant(db_session, "life")
    manager = await _make_user(db_session, "mgr", comp.id, br.id, role=UserRole.MANAGER)
    headers = _bearer(manager, comp.id, br.id)
    _set_tenant(db_session, comp.id, br.id)

    # Create dummy product
    product = Product(
        id="prod-spif-test",
        code="PROD-SPIF",
        name="SPIF Test Product",
        price=150.0,
        stock=20,
        category="General",
        barcode="9876543210123",
        company_id=comp.id,
        branch_id=br.id,
        is_deleted=False
    )
    db_session.add(product)
    await db_session.commit()

    uploaded_filename = None

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Upload Primary Product Image
        payload = {"image_data": TINY_BASE64_IMAGE}
        res_upload = await ac.post("/api/v1/inventory/prod-spif-test/image", json=payload, headers=headers)
        assert res_upload.status_code == 200
        data_upload = res_upload.json()
        assert data_upload["primary_image_url"] is not None
        assert "/products/images/" in data_upload["primary_image_url"]

        uploaded_filename = data_upload["primary_image_url"].split("/")[-1]

        # 2. Get / Serve the Uploaded Image
        res_serve = await ac.get(f"/api/v1/inventory/images/{uploaded_filename}")
        assert res_serve.status_code == 200
        assert res_serve.headers["content-type"] == "image/webp"

        # 3. Add Image to Gallery
        res_gal = await ac.post("/api/v1/inventory/prod-spif-test/gallery", json=payload, headers=headers)
        assert res_gal.status_code == 200
        data_gal = res_gal.json()
        assert len(data_gal["gallery_images"]) == 1
        assert "/products/images/" in data_gal["gallery_images"][0]

        gal_filename = data_gal["gallery_images"][0].split("/")[-1]

        # 4. Delete Gallery Image
        res_del_gal = await ac.delete(f"/api/v1/inventory/prod-spif-test/gallery/{gal_filename}", headers=headers)
        assert res_del_gal.status_code == 200
        data_del_gal = res_del_gal.json()
        assert len(data_del_gal["gallery_images"]) == 0

        # 5. Delete Primary Product Image
        res_del = await ac.delete("/api/v1/inventory/prod-spif-test/image", headers=headers)
        assert res_del.status_code == 200
        data_del = res_del.json()
        assert data_del["primary_image_url"] is None

    # Cleanup any residue files if delete calls failed or did not run
    if uploaded_filename:
        SpifService.delete_image_file(uploaded_filename)
    SpifService.delete_image_file(gal_filename)
