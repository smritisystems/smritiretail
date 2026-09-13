"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.31.0
Created      : 2026-09-13
Modified     : 2026-09-13
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import uuid
import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from sqlalchemy import select, delete

from app.main import app
from app.core.security import create_access_token
from app.models.auth import User, UserRole
from app.db.session import get_company_sessionmaker
from app.models.master_lookup import MasterType, MasterValue
from app.models.audit import ComplianceImmutableAuditLog
from app.services.compliance_audit import ComplianceAuditService


@pytest.mark.asyncio
async def test_master_lookup_audit_lifecycle_and_integrity():
    """
    Verifies that Master Lookup creation and updates append SHA-256
    tamper-evident audit logs with verifiable before/after states,
    and search_audit_logs exposes those diffs to managers.
    """
    sessionmaker = get_company_sessionmaker("smriti001")
    async with sessionmaker() as session:
        # Ensure a test department MasterType exists
        type_res = await session.execute(
            select(MasterType).where(MasterType.code == "department")
        )
        m_type = type_res.scalar_one_or_none()
        if not m_type:
            m_type = MasterType(
                id=uuid.uuid4(),
                code="department",
                name="Department",
                field_schema={},
                version=1,
                company_id="COMP-001",
                is_active=True,
            )
            session.add(m_type)
            await session.flush()

        test_code = f"AUD-DEPT-{uuid.uuid4().hex[:6].upper()}"
        item_id = uuid.uuid4()

        # 1. Create MasterValue
        item = MasterValue(
            id=item_id,
            master_type_id=m_type.id,
            company_id="COMP-001",
            branch_id="BR-MAIN-001",
            code=test_code,
            name="Initial Audit Department",
            active=True,
            sort_order=10,
            data={"description": "Original Department Description"},
            is_deleted=False,
        )
        session.add(item)
        await session.flush()

        # Authoritatively record CREATE event
        create_log = await ComplianceAuditService.record_audit_event(
            session=session,
            company_id="COMP-001",
            branch_id="BR-MAIN-001",
            event_type="MASTER_LOOKUP_CREATE",
            entity_name="master_lookup:department",
            entity_id=str(item.id),
            action_summary=f"Created department lookup value '{item.code}'.",
            actor_user_id="usr-manager-direct",
            actor_role="MANAGER",
            before_state=None,
            after_state={
                "code": item.code,
                "name": item.name,
                "active": item.active,
                "sort_order": item.sort_order,
                "data": item.data,
            },
        )
        await session.commit()

        # Verify SHA-256 integrity on authentic record
        assert await ComplianceAuditService.verify_audit_integrity(create_log) is True

        # 2. Update MasterValue (change description, status, sort_order)
        before_state = {
            "code": item.code,
            "name": item.name,
            "active": item.active,
            "sort_order": item.sort_order,
            "data": item.data,
        }
        item.name = "Updated Audit Department"
        item.sort_order = 25
        item.active = False
        item.data = {"description": "Updated Department Description"}

        update_log = await ComplianceAuditService.record_audit_event(
            session=session,
            company_id="COMP-001",
            branch_id="BR-MAIN-001",
            event_type="MASTER_LOOKUP_UPDATE",
            entity_name="master_lookup:department",
            entity_id=str(item.id),
            action_summary=f"Updated department lookup value '{item.code}'.",
            actor_user_id="usr-manager-direct",
            actor_role="MANAGER",
            before_state=before_state,
            after_state={
                "code": item.code,
                "name": item.name,
                "active": item.active,
                "sort_order": item.sort_order,
                "data": item.data,
            },
        )
        await session.commit()

        assert await ComplianceAuditService.verify_audit_integrity(update_log) is True

        # 3. Test search_audit_logs by entity_name and entity_id
        searched = await ComplianceAuditService.search_audit_logs(
            session=session,
            company_id="COMP-001",
            entity_name="master_lookup:department",
            entity_id=str(item.id),
            limit=10,
        )

        assert len(searched) >= 2
        # Latest first (UPDATE then CREATE)
        latest = searched[0]
        assert latest["event_type"] == "MASTER_LOOKUP_UPDATE"
        assert latest["entity_id"] == str(item.id)
        assert latest["before_state"]["sort_order"] == 10
        assert latest["after_state"]["sort_order"] == 25
        assert latest["before_state"]["active"] is True
        assert latest["after_state"]["active"] is False
        assert latest["payload_hash"] == update_log.payload_hash

        # 4. Test search with prefix "master_lookup"
        prefix_searched = await ComplianceAuditService.search_audit_logs(
            session=session,
            company_id="COMP-001",
            entity_name="master_lookup",
            entity_id=str(item.id),
            limit=10,
        )
        assert len(prefix_searched) >= 2

        # Cleanup
        await session.execute(
            delete(ComplianceImmutableAuditLog).where(
                ComplianceImmutableAuditLog.entity_id == str(item.id)
            )
        )
        await session.execute(
            delete(MasterValue).where(MasterValue.id == item.id)
        )
        await session.commit()
