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
Classification: Official Product Website REST API Gateway
"""

from typing import Dict, Any
from fastapi import APIRouter, Body

from app.core.website.website_content import WebsiteContentService
from app.core.website.solutions_catalog import IndustrySolutionsCatalog
from app.core.website.lead_capture import LeadCapturePipelineEngine
from app.core.website.website_analytics import WebsiteAnalyticsEngine
from app.schemas.website import DemoRequestSchema, LeadStatusUpdateSchema, AnalyticsEventSchema

router = APIRouter(prefix="/website", tags=["Official Product Website & Marketing"])


@router.get("/content")
async def get_homepage_content():
    """Returns dynamic website copy, hero text, statistics, and edition pricing matrix."""
    return WebsiteContentService.get_homepage_content()


@router.get("/solutions")
async def get_industry_solutions():
    """Returns catalog of domain-specific retail engines (Pharma, Apparel, GST, Franchise)."""
    return IndustrySolutionsCatalog.get_solutions()


@router.post("/demo-request")
async def submit_demo_request(request: DemoRequestSchema = Body(...)):
    """Registers a qualified demo booking request into the lead capture pipeline."""
    return LeadCapturePipelineEngine.register_demo_request(request)


@router.put("/lead-status")
async def update_lead_status(update: LeadStatusUpdateSchema = Body(...)):
    """Updates lead qualification lifecycle status (NEW -> QUALIFIED -> DEMO_SCHEDULED -> WON)."""
    return LeadCapturePipelineEngine.update_lead_status(update.lead_id, update.status)


@router.post("/analytics")
async def record_analytics_event(event: AnalyticsEventSchema = Body(...)):
    """Records anonymous product marketing telemetry events."""
    return WebsiteAnalyticsEngine.record_event(event)


@router.get("/analytics-summary")
async def get_analytics_summary():
    """Returns marketing site engagement summary."""
    return WebsiteAnalyticsEngine.get_analytics_summary()
