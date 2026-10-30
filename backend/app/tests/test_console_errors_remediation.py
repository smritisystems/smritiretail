"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-10-07
Modified     : 2026-10-07
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import pytest
from fastapi import HTTPException
from app.core.item_master_validation import (
    ItemMasterValidationMapper,
    is_item_master_endpoint,
)
from app.core.security import validate_password_strength
from app.models.auth import UserRole
from app.schemas.user import StaffUserCreate, UserCreate, UserUpdate


class TestUniversalImportEndpointAndErrorMapping:
    """Verify endpoint recognition and 422 error normalization for universal import."""

    def test_universal_import_endpoints_recognized(self):
        assert is_item_master_endpoint("/api/v1/universal-import") is True
        assert is_item_master_endpoint("/api/v1/universal-import/") is True
        assert is_item_master_endpoint("/api/v1/universal-import/preview") is True
        assert is_item_master_endpoint("/api/v1/universal-import/commit") is True

    def test_dynamic_attr_422_with_single_message_and_row_number(self):
        detail = {
            "row_number": 3,
            "message": "ARTICLE_STYLE_CODE required — style/article column is missing or empty. Cannot derive style from SKU code."
        }
        res = ItemMasterValidationMapper.build_dynamic_attr_422_response(detail)
        assert res is not None
        assert res["error"]["code"] == "ITEM_MASTER_VALIDATION_ERROR"
        assert res["error"]["row_number"] == 3
        assert "Row 3:" in res["error"]["message"]
        assert len(res["error"]["fields"]) == 1
        assert res["error"]["fields"][0]["field"] == "style_code"
        assert "Article / Style Code is required" in res["error"]["fields"][0]["message"]

    def test_dynamic_attr_422_with_im001_validation_error(self):
        detail = {
            "row_number": 5,
            "message": "IM-001 Validation Error: Controlled field 'GENDER' value 'UNKNOWN' is not in the approved list"
        }
        res = ItemMasterValidationMapper.build_dynamic_attr_422_response(detail)
        assert res is not None
        assert res["error"]["code"] == "ITEM_MASTER_VALIDATION_ERROR"
        assert res["error"]["row_number"] == 5
        assert len(res["error"]["fields"]) >= 1
        assert res["error"]["fields"][0]["field"] == "gender"


class TestStaffAndUserRoleValidation:
    """Verify role parsing and tolerance for ADMIN alias."""

    def test_staff_user_create_accepts_admin_as_sysadmin(self):
        req = StaffUserCreate(
            username="staff_admin",
            fullName="Admin Staff",
            role="ADMIN",  # type: ignore[arg-type]
            password="SecurePassword@2026",
        )
        assert req.role == UserRole.SYSADMIN

    def test_staff_user_create_accepts_standard_roles(self):
        for role_name in ("CASHIER", "MANAGER", "SYSADMIN", "REPORT_USER", "VIEWER"):
            req = StaffUserCreate(
                username=f"user_{role_name.lower()}",
                fullName=f"User {role_name}",
                role=role_name,  # type: ignore[arg-type]
                password="SecurePassword@2026",
            )
            assert req.role == UserRole[role_name]

    def test_user_create_accepts_admin_as_sysadmin(self):
        req = UserCreate(
            username="new_admin",
            password="SecurePassword@2026",
            role="ADMIN",  # type: ignore[arg-type]
        )
        assert req.role == UserRole.SYSADMIN

    def test_user_update_accepts_admin_as_sysadmin(self):
        upd = UserUpdate(role="ADMIN")  # type: ignore[arg-type]
        assert upd.role == UserRole.SYSADMIN


class TestPasswordPolicyEnforcement:
    """Verify validate_password_strength against edge cases."""

    def test_valid_strong_passwords_pass(self):
        validate_password_strength("Staff@2026")
        validate_password_strength("MyP@ssw0rd!")
        validate_password_strength("Retail#9876X")

    def test_short_password_rejected(self):
        with pytest.raises(HTTPException) as exc_info:
            validate_password_strength("Aa1!")
        assert exc_info.value.status_code == 400
        assert "at least 8 characters" in exc_info.value.detail

    def test_missing_uppercase_rejected(self):
        with pytest.raises(HTTPException) as exc_info:
            validate_password_strength("password@123")
        assert exc_info.value.status_code == 400
        assert "uppercase" in exc_info.value.detail

    def test_missing_lowercase_rejected(self):
        with pytest.raises(HTTPException) as exc_info:
            validate_password_strength("PASSWORD@123")
        assert exc_info.value.status_code == 400
        assert "lowercase" in exc_info.value.detail

    def test_missing_number_rejected(self):
        with pytest.raises(HTTPException) as exc_info:
            validate_password_strength("Password@abc")
        assert exc_info.value.status_code == 400
        assert "number" in exc_info.value.detail

    def test_missing_special_char_rejected(self):
        with pytest.raises(HTTPException) as exc_info:
            validate_password_strength("Password1234")
        assert exc_info.value.status_code == 400
        assert "special character" in exc_info.value.detail


class TestMediaFallbackAndRouteParity:
    """Validate photo/image fallback SVGs and route slash normalization."""

    @pytest.mark.asyncio
    async def test_get_staff_photo_missing_file_returns_fallback_svg(self):
        from app.api.v1.staff import get_staff_photo, DEFAULT_STAFF_AVATAR_SVG
        resp = await get_staff_photo("non_existent_staff_photo_12345.webp")
        assert resp.status_code == 200
        assert resp.media_type == "image/svg+xml"
        assert resp.body.decode("utf-8") == DEFAULT_STAFF_AVATAR_SVG

    @pytest.mark.asyncio
    async def test_get_product_image_missing_file_returns_fallback_svg(self):
        from app.api.v1.inventory import get_product_image, DEFAULT_PRODUCT_PLACEHOLDER_SVG
        resp = await get_product_image("non_existent_product_image_12345.webp")
        assert resp.status_code == 200
        assert resp.media_type == "image/svg+xml"
        assert resp.body.decode("utf-8") == DEFAULT_PRODUCT_PLACEHOLDER_SVG

    def test_users_router_has_both_slashed_and_unslashed_routes(self):
        from app.api.v1.users import router
        paths = [route.path for route in router.routes]
        assert "" in paths or "/" in paths
        # Check both empty and slashed versions of list_staff_users exist
        get_paths = [route.path for route in router.routes if "GET" in getattr(route, "methods", set())]
        assert "" in get_paths
        assert "/" in get_paths
        # Check both empty and slashed versions of create_staff_user exist
        post_paths = [route.path for route in router.routes if "POST" in getattr(route, "methods", set())]
        assert "" in post_paths
        assert "/" in post_paths

