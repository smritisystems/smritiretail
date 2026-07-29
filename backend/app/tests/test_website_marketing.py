"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 28.0.0
Created      : 2026-07-22
Modified     : 2026-07-22
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Pytest Suite for Official Product Website & Marketing (v28.0.0)

test_website_marketing.py — Integration test suite for Phase 34 Official Product Website.
"""

import pytest

from app.core.website.website_content import WebsiteContentService
from app.core.website.solutions_catalog import IndustrySolutionsCatalog
from app.core.website.lead_capture import LeadCapturePipelineEngine
from app.core.website.website_analytics import WebsiteAnalyticsEngine
from app.schemas.website import DemoRequestSchema, AnalyticsEventSchema


@pytest.mark.asyncio
async def test_homepage_content_retrieval():
    """Verify WebsiteContentService returns dynamic hero copy, statistics, and edition pricing."""
    content = WebsiteContentService.get_homepage_content()
    assert "Sovereign Operating System" in content["hero"]["headline"]
    assert len(content["statistics"]) == 4
    assert len(content["editions"]) == 3
    edition_ids = [e["id"] for e in content["editions"]]
    assert "community" in edition_ids
    assert "professional" in edition_ids
    assert "enterprise" in edition_ids


@pytest.mark.asyncio
async def test_industry_solutions_catalog():
    """Verify IndustrySolutionsCatalog returns vertical retail engines."""
    solutions = IndustrySolutionsCatalog.get_solutions()
    assert len(solutions) == 4
    sol_ids = [s["id"] for s in solutions]
    assert "pharma" in sol_ids
    assert "apparel" in sol_ids
    assert "nic_gst" in sol_ids
    assert "franchise" in sol_ids


@pytest.mark.asyncio
async def test_demo_request_lead_capture_pipeline():
    """Verify LeadCapturePipelineEngine registers demo requests and manages status updates."""
    req = DemoRequestSchema(
        company_name="AITDL Supermarkets",
        contact_name="Jawahar Mallah",
        email="support@smritibooks.com",
        phone="+919876543210",
        industry="pharma",
        stores_count=5,
        notes="Interested in Pharma FEFO and NIC GST E-Invoicing."
    )
    reg_res = LeadCapturePipelineEngine.register_demo_request(req)
    assert reg_res["status"] == "NEW"
    assert "lead_id" in reg_res
    lead_id = reg_res["lead_id"]

    # Update lead status transition NEW -> QUALIFIED
    update_res = LeadCapturePipelineEngine.update_lead_status(lead_id, "QUALIFIED")
    assert update_res["current_status"] == "QUALIFIED"

    # Update status transition QUALIFIED -> DEMO_SCHEDULED
    update_res2 = LeadCapturePipelineEngine.update_lead_status(lead_id, "DEMO_SCHEDULED")
    assert update_res2["current_status"] == "DEMO_SCHEDULED"


@pytest.mark.asyncio
async def test_website_analytics_logging():
    """Verify WebsiteAnalyticsEngine records anonymous telemetry events."""
    event = AnalyticsEventSchema(
        event_type="CTA_CLICK",
        page_route="/",
        metadata={"cta_label": "Book Live Product Demo"}
    )
    rec_res = WebsiteAnalyticsEngine.record_event(event)
    assert rec_res["status"] == "RECORDED"

    summary = WebsiteAnalyticsEngine.get_analytics_summary()
    assert summary["total_events"] >= 1
    assert summary["cta_clicks"] >= 1
