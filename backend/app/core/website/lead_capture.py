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
Classification: Demo Booking & Lead Capture Pipeline Engine
"""

import uuid
from typing import Dict, Any, List

from app.schemas.website import DemoRequestSchema


class LeadCapturePipelineEngine:
    """Lead Capture & Demo Request Lifecycle Engine."""

    _LEADS_DB: Dict[str, Dict[str, Any]] = {}

    VALID_STATUSES = ["NEW", "QUALIFIED", "DEMO_SCHEDULED", "DEMO_COMPLETED", "WON", "LOST"]

    @classmethod
    def register_demo_request(cls, req: DemoRequestSchema) -> Dict[str, Any]:
        lead_id = f"LEAD-{str(uuid.uuid4())[:8].upper()}"
        lead_record = {
            "lead_id": lead_id,
            "company_name": req.company_name,
            "contact_name": req.contact_name,
            "email": req.email,
            "phone": req.phone,
            "industry": req.industry,
            "stores_count": req.stores_count,
            "country": req.country,
            "preferred_date": req.preferred_date or "2026-07-25",
            "product_interest": req.product_interest,
            "notes": req.notes,
            "status": "NEW",
            "created_at": "2026-07-22T02:47:00Z"
        }
        cls._LEADS_DB[lead_id] = lead_record
        return {
            "lead_id": lead_id,
            "status": "NEW",
            "message": "Demo request successfully registered. Our retail specialist will contact you shortly."
        }

    @classmethod
    def update_lead_status(cls, lead_id: str, new_status: str) -> Dict[str, Any]:
        if lead_id not in cls._LEADS_DB:
            return {"error": "Lead not found"}

        st = new_status.upper().strip()
        if st not in cls.VALID_STATUSES:
            return {"error": f"Invalid status. Must be one of {cls.VALID_STATUSES}"}

        cls._LEADS_DB[lead_id]["status"] = st
        return {
            "lead_id": lead_id,
            "previous_status": cls._LEADS_DB[lead_id]["status"],
            "current_status": st,
            "updated": True
        }
