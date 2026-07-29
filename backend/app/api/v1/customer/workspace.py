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
Classification: Customer Workspace Portal REST API Gateway
"""

from typing import Dict, Any
from fastapi import APIRouter, Body, Query

from app.core.customer.license_service import CustomerLicenseService
from app.core.customer.backup_manager import CustomerBackupManager
from app.core.customer.ticket_service import CustomerTicketDeskService
from app.core.customer.organization_service import CustomerOrganizationService
from app.schemas.customer import TicketCreateSchema, TicketStatusUpdateSchema

router = APIRouter(prefix="/customer/workspace", tags=["Customer Workspace Portal & License Management"])


@router.get("/dashboard")
async def get_customer_workspace_overview(tenant_id: str = Query("TENANT-001")):
    """Returns Customer Dashboard overview widgets."""
    licenses = CustomerLicenseService.get_tenant_licenses(tenant_id)
    snapshots = CustomerBackupManager.get_snapshots(tenant_id)
    tickets = CustomerTicketDeskService.get_tenant_tickets(tenant_id)
    org = CustomerOrganizationService.get_organization_profile(tenant_id)

    return {
        "tenant_id": tenant_id,
        "organization_name": org["organization_name"],
        "active_subscription": org["active_subscription_plan"],
        "active_licenses_count": len(licenses),
        "recent_snapshots_count": len(snapshots),
        "open_tickets_count": len([t for t in tickets if t["status"] not in ["RESOLVED", "CLOSED"]]),
        "licenses": licenses,
        "latest_backup": snapshots[0] if snapshots else None
    }


@router.get("/licenses")
async def get_customer_licenses(tenant_id: str = Query("TENANT-001")):
    """Returns tenant active licenses and capacity limits."""
    return CustomerLicenseService.get_tenant_licenses(tenant_id)


@router.post("/licenses/validate-terminal")
async def validate_terminal_cap(current_terminals: int = Body(...), tenant_id: str = Body("TENANT-001")):
    """Validates POS terminal capacity allocation limits."""
    return CustomerLicenseService.validate_terminal_cap(tenant_id, current_terminals)


@router.get("/backups")
async def get_backup_snapshots(tenant_id: str = Query("TENANT-001")):
    """Returns database snapshot history and verification status."""
    return CustomerBackupManager.get_snapshots(tenant_id)


@router.post("/backups/manual")
async def create_manual_backup(tenant_id: str = Body("TENANT-001")):
    """Triggers manual database snapshot creation."""
    res = CustomerBackupManager.create_manual_backup(tenant_id)
    CustomerOrganizationService.record_audit_event("MANUAL_BACKUP_CREATED", "Customer Admin")
    return res


@router.post("/backups/restore")
async def trigger_restore_job(snapshot_id: str = Body(...), tenant_id: str = Body("TENANT-001")):
    """Triggers database snapshot restore job."""
    res = CustomerBackupManager.trigger_restore_request(snapshot_id, tenant_id)
    CustomerOrganizationService.record_audit_event(f"RESTORE_TRIGGERED_{snapshot_id}", "Customer Admin")
    return res


@router.get("/tickets")
async def get_support_tickets(tenant_id: str = Query("TENANT-001")):
    """Returns technical support tickets."""
    return CustomerTicketDeskService.get_tenant_tickets(tenant_id)


@router.post("/tickets")
async def create_support_ticket(ticket: TicketCreateSchema = Body(...), tenant_id: str = Body("TENANT-001")):
    """Submits technical support ticket with priority SLA tracking."""
    res = CustomerTicketDeskService.create_ticket(ticket, tenant_id)
    CustomerOrganizationService.record_audit_event(f"TICKET_CREATED_{res['ticket_id']}", "Customer Admin")
    return res


@router.put("/tickets/status")
async def update_ticket_status(update: TicketStatusUpdateSchema = Body(...)):
    """Updates support ticket status lifecycle."""
    return CustomerTicketDeskService.update_ticket_status(update.ticket_id, update.status, update.comment)


@router.get("/organization")
async def get_organization_profile(tenant_id: str = Query("TENANT-001")):
    """Returns organization store profile and billing invoice history."""
    return CustomerOrganizationService.get_organization_profile(tenant_id)


@router.get("/audit-logs")
async def get_security_audit_logs(tenant_id: str = Query("TENANT-001")):
    """Returns tenant security audit trail logs."""
    return CustomerOrganizationService.get_audit_logs(tenant_id)
