"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 27.0.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Pytest Suite for SMRITI Digital Platform Ecosystem (v27.0.0)

test_ecosystem_engine.py — Integration test suite for Digital Platform Ecosystem Hub (v27.0.0).
"""

import pytest

from app.core.ecosystem.portal_registry import PortalRegistry
from app.core.ecosystem.customer_portal import CustomerWorkspaceEngine
from app.core.ecosystem.academy_engine import AcademyLMSEngine
from app.core.ecosystem.notifications.notification_service import PlatformNotificationEngine
from app.core.ecosystem.search.global_search_service import GlobalUnifiedSearchEngine


@pytest.mark.asyncio
async def test_portal_registry_filtering():
    """Verify PortalRegistry returns 8 portals across public and authenticated tiers."""
    all_portals = PortalRegistry.get_portals()
    assert len(all_portals) == 8

    public_portals = PortalRegistry.get_portals(visibility_filter="public")
    assert len(public_portals) == 4
    public_ids = [p["id"] for p in public_portals]
    assert "marketing" in public_ids
    assert "documentation" in public_ids
    assert "marketplace" in public_ids
    assert "community" in public_ids

    auth_portals = PortalRegistry.get_portals(visibility_filter="authenticated")
    assert len(auth_portals) == 4
    auth_ids = [p["id"] for p in auth_portals]
    assert "customer" in auth_ids
    assert "developer" in auth_ids
    assert "partner" in auth_ids
    assert "academy" in auth_ids


@pytest.mark.asyncio
async def test_portal_manifest_validation():
    """Verify PortalRegistry validates Portal Manifest compatibility with CMP-001 baseline."""
    res = PortalRegistry.validate_portal_manifest("academy")
    assert res["valid"] is True
    assert res["minimum_foundation"] == "v1.0"
    assert res["minimum_kernel"] == "v12.1.0"
    assert res["cmp_001_compliant"] is True


@pytest.mark.asyncio
async def test_customer_workspace_dashboard():
    """Verify CustomerWorkspaceEngine aggregates customer workspace metrics."""
    res = CustomerWorkspaceEngine.get_workspace_dashboard("CUST-001")
    assert res["customer_name"] == "AITDL Retail Enterprises"
    assert res["active_licenses_count"] >= 2
    assert res["installed_extensions_count"] == 12
    assert res["latest_update_version"] == "v27.0.0"


@pytest.mark.asyncio
async def test_learning_academy_lms_courses():
    """Verify AcademyLMSEngine returns courses and manages course enrollment."""
    courses = AcademyLMSEngine.get_courses()
    assert len(courses) == 3
    course_codes = [c["course_code"] for c in courses]
    assert "SMRITI-101" in course_codes

    enroll_res = AcademyLMSEngine.enroll_course("SMRITI-101", "USER-99")
    assert enroll_res["status"] == "ENROLLED"
    assert enroll_res["course_code"] == "SMRITI-101"
    assert enroll_res["certification_eligible"] is True


@pytest.mark.asyncio
async def test_platform_notification_dispatch():
    """Verify PlatformNotificationEngine dispatches notifications across channels."""
    res_email = PlatformNotificationEngine.send_notification("user@smritisys.com", "EMAIL", "Welcome to SMRITI", "Welcome aboard!")
    assert res_email["status"] == "DISPATCHED"
    assert res_email["channel"] == "EMAIL"

    res_sms = PlatformNotificationEngine.send_notification("+919876543210", "SMS", "OTP", "Your code is 123456")
    assert res_sms["status"] == "DISPATCHED"
    assert res_sms["channel"] == "SMS"


@pytest.mark.asyncio
async def test_global_unified_search():
    """Verify GlobalUnifiedSearchEngine queries across Docs, Academy, Marketplace, and APIs."""
    res = GlobalUnifiedSearchEngine.query("Prescription")
    assert res["results_count"] >= 1
    assert res["results"][0]["category"] == "DOCS"

    res_api = GlobalUnifiedSearchEngine.query("E-Invoice")
    assert res_api["results_count"] >= 1
    assert res_api["results"][0]["category"] == "DEVELOPER_APIS"
