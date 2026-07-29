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
Classification: Pytest Suite for Customer Workspace Portal (v30.0.0)

test_customer_workspace.py — Integration test suite for Phase 36 Customer Workspace Portal.
"""

import pytest

from app.core.customer.license_service import CustomerLicenseService
from app.core.customer.backup_manager import CustomerBackupManager
from app.core.customer.ticket_service import CustomerTicketDeskService
from app.core.customer.organization_service import CustomerOrganizationService
from app.schemas.customer import TicketCreateSchema


@pytest.mark.asyncio
async def test_license_service_and_terminal_cap():
    """Verify CustomerLicenseService returns license details and evaluates terminal capacity."""
    licenses = CustomerLicenseService.get_tenant_licenses("TENANT-001")
    assert len(licenses) == 1
    lic = licenses[0]
    assert lic["edition"] == "ENTERPRISE"
    assert lic["max_pos_terminals"] == 50

    cap_res = CustomerLicenseService.validate_terminal_cap("TENANT-001", 18)
    assert cap_res["allowed"] is True

    cap_res_overflow = CustomerLicenseService.validate_terminal_cap("TENANT-001", 55)
    assert cap_res_overflow["allowed"] is False


@pytest.mark.asyncio
async def test_backup_manager_manual_and_restore():
    """Verify CustomerBackupManager creates manual backups and triggers restore jobs."""
    snapshots_before = CustomerBackupManager.get_snapshots("TENANT-001")
    count_before = len(snapshots_before)

    create_res = CustomerBackupManager.create_manual_backup("TENANT-001")
    assert create_res["status"] == "CREATED"
    snap_id = create_res["snapshot_id"]

    snapshots_after = CustomerBackupManager.get_snapshots("TENANT-001")
    assert len(snapshots_after) == count_before + 1

    restore_res = CustomerBackupManager.trigger_restore_request(snap_id, "TENANT-001")
    assert restore_res["status"] == "INITIATED"
    assert restore_res["snapshot_id"] == snap_id


@pytest.mark.asyncio
async def test_ticket_service_lifecycle():
    """Verify CustomerTicketDeskService creates tickets and updates lifecycle statuses."""
    req = TicketCreateSchema(
        subject="WMS Stock Transfer Error",
        category="WMS_INVENTORY",
        priority="HIGH",
        description="In-transit stock transfer reconciliation timeout."
    )
    create_res = CustomerTicketDeskService.create_ticket(req, "TENANT-001")
    assert create_res["status"] == "NEW"
    assert create_res["sla_target_hours"] == 4
    ticket_id = create_res["ticket_id"]

    # Transition NEW -> ACKNOWLEDGED
    up1 = CustomerTicketDeskService.update_ticket_status(ticket_id, "ACKNOWLEDGED")
    assert up1["current_status"] == "ACKNOWLEDGED"

    # Transition ACKNOWLEDGED -> IN_PROGRESS
    up2 = CustomerTicketDeskService.update_ticket_status(ticket_id, "IN_PROGRESS", "Specialist investigating.")
    assert up2["current_status"] == "IN_PROGRESS"


@pytest.mark.asyncio
async def test_organization_service_profile_and_audit():
    """Verify CustomerOrganizationService retrieves profile and records security audit events."""
    org = CustomerOrganizationService.get_organization_profile("TENANT-001")
    assert org["organization_name"] == "AITDL Retail Enterprises"
    assert len(org["invoices"]) >= 2

    audit_res = CustomerOrganizationService.record_audit_event("PASSWORD_CHANGED", "Jawahar Mallah")
    assert audit_res["status"] == "RECORDED"

    logs = CustomerOrganizationService.get_audit_logs("TENANT-001")
    assert len(logs) >= 3
    assert logs[0]["action"] == "PASSWORD_CHANGED"
