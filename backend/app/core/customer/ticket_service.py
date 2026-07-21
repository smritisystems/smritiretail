"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 30.0.0
Created      : 2026-07-22
Modified     : 2026-07-22
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Customer Support Ticket & SLA Tracking Engine
"""

import uuid
from typing import Dict, Any, List
from app.schemas.customer import TicketCreateSchema


class CustomerTicketDeskService:
    """Support Ticket Desk managing ticket creation, SLA priority escalations, and status transitions."""

    VALID_STATUSES = ["NEW", "ACKNOWLEDGED", "IN_PROGRESS", "WAITING_FOR_CUSTOMER", "RESOLVED", "CLOSED"]

    _TICKETS_DB: Dict[str, Dict[str, Any]] = {
        "TCK-8801": {
            "ticket_id": "TCK-8801",
            "subject": "E-Way Bill NIC Gateway Auth Renewal",
            "category": "GST_COMPLIANCE",
            "priority": "HIGH",
            "description": "Renewing NIC production gateway API credentials for GSTR returns.",
            "status": "IN_PROGRESS",
            "sla_target_hours": 4,
            "created_at": "2026-07-21T10:00:00Z",
            "comments": ["Assigned to Senior Compliance Specialist."]
        }
    }

    @classmethod
    def get_tenant_tickets(cls, tenant_id: str = "TENANT-001") -> List[Dict[str, Any]]:
        return list(cls._TICKETS_DB.values())

    @classmethod
    def create_ticket(cls, req: TicketCreateSchema, tenant_id: str = "TENANT-001") -> Dict[str, Any]:
        ticket_id = f"TCK-{str(uuid.uuid4())[:4].upper()}"
        sla_hours = 2 if req.priority == "CRITICAL" else (4 if req.priority == "HIGH" else 24)

        ticket_record = {
            "ticket_id": ticket_id,
            "subject": req.subject,
            "category": req.category,
            "priority": req.priority,
            "description": req.description,
            "status": "NEW",
            "sla_target_hours": sla_hours,
            "created_at": "2026-07-22T02:54:00Z",
            "comments": []
        }
        cls._TICKETS_DB[ticket_id] = ticket_record
        return {
            "ticket_id": ticket_id,
            "status": "NEW",
            "sla_target_hours": sla_hours,
            "message": "Support ticket created. SLA response time acknowledged."
        }

    @classmethod
    def update_ticket_status(cls, ticket_id: str, new_status: str, comment: str = None) -> Dict[str, Any]:
        if ticket_id not in cls._TICKETS_DB:
            return {"error": "Ticket not found"}

        st = new_status.upper().strip()
        if st not in cls.VALID_STATUSES:
            return {"error": f"Invalid status. Must be one of {cls.VALID_STATUSES}"}

        cls._TICKETS_DB[ticket_id]["status"] = st
        if comment:
            cls._TICKETS_DB[ticket_id]["comments"].append(comment)

        return {
            "ticket_id": ticket_id,
            "current_status": st,
            "updated": True
        }
