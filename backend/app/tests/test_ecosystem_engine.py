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
