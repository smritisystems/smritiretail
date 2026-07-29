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
Classification: Organization Profile, Billing & Audit Trail Engine
"""

from typing import Dict, Any, List


class CustomerOrganizationService:
    """Manages customer organization profile, store network, billing invoices, and security audit logs."""

    _AUDIT_LOGS: List[Dict[str, Any]] = [
        {
            "event_id": "AUD-001",
            "action": "LICENSE_ACTIVATED",
            "performed_by": "Jawahar Mallah",
            "timestamp": "2026-07-21T09:00:00Z",
            "ip_address": "192.168.1.10"
        },
        {
            "event_id": "AUD-002",
            "action": "MANUAL_BACKUP_CREATED",
            "performed_by": "System Auto",
            "timestamp": "2026-07-21T18:30:00Z",
            "ip_address": "127.0.0.1"
        }
    ]

    @classmethod
    def get_organization_profile(cls, tenant_id: str = "TENANT-001") -> Dict[str, Any]:
        return {
            "organization_name": "AITDL Retail Enterprises",
            "tenant_id": tenant_id,
            "contact_email": "support@smritibooks.com",
            "contact_phone": "+91 98765 43210",
            "stores_count": 4,
            "active_subscription_plan": "Enterprise Edition",
            "next_billing_date": "2027-01-01",
            "invoices": [
                {"invoice_id": "INV-SMRITI-2026-01", "amount": "₹14,990", "date": "2026-01-01", "status": "PAID"},
                {"invoice_id": "INV-SMRITI-2025-12", "amount": "₹14,990", "date": "2025-12-01", "status": "PAID"}
            ]
        }

    @classmethod
    def get_audit_logs(cls, tenant_id: str = "TENANT-001") -> List[Dict[str, Any]]:
        return cls._AUDIT_LOGS

    @classmethod
    def record_audit_event(cls, action: str, performed_by: str, ip_address: str = "127.0.0.1") -> Dict[str, Any]:
        evt = {
            "event_id": f"AUD-{len(cls._AUDIT_LOGS)+1:03d}",
            "action": action,
            "performed_by": performed_by,
            "timestamp": "2026-07-22T02:54:00Z",
            "ip_address": ip_address
        }
        cls._AUDIT_LOGS.insert(0, evt)
        return {"status": "RECORDED", "event_id": evt["event_id"]}
