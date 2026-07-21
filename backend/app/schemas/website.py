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
Classification: Pydantic DTO Schemas for Official Product Website
"""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, EmailStr


class DemoRequestSchema(BaseModel):
    company_name: str
    contact_name: str
    email: str
    phone: str
    industry: str  # "pharma", "apparel", "grocery", "electronics", "general"
    stores_count: int = 1
    country: str = "India"
    preferred_date: Optional[str] = None
    product_interest: List[str] = ["Retail OS Core"]
    notes: Optional[str] = None


class LeadStatusUpdateSchema(BaseModel):
    lead_id: str
    status: str  # "NEW", "QUALIFIED", "DEMO_SCHEDULED", "DEMO_COMPLETED", "WON", "LOST"


class AnalyticsEventSchema(BaseModel):
    event_type: str  # "PAGEVIEW", "CTA_CLICK", "PRICING_VIEW", "DEMO_MODAL_OPEN"
    page_route: str
    metadata: Optional[Dict[str, Any]] = None
