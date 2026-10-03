import json
from datetime import datetime, timezone

from app.models.audit import ComplianceImmutableAuditLog
from app.services.compliance_audit import ComplianceAuditService


def test_serialize_audit_log_exposes_before_after_and_actor_fields():
    log = ComplianceImmutableAuditLog(
        id="aud_1234",
        uuid="uuid-1",
        company_id="C-001",
        branch_id="BR-001",
        event_type="MASTER_LOOKUP_UPDATE",
        entity_name="master_lookup:department",
        entity_id="lookup-123",
        actor_user_id="user-42",
        actor_role="MANAGER",
        ip_address="127.0.0.1",
        before_state_json=json.dumps({"code": "DPT", "name": "Dept", "active": True, "sort_order": 1}),
        after_state_json=json.dumps({"code": "DPT", "name": "Department", "active": True, "sort_order": 2}),
        action_summary="Updated department lookup value 'DPT'.",
        payload_hash="abc123",
        timestamp=datetime.now(timezone.utc),
        is_active=True,
        is_deleted=False,
    )

    data = ComplianceAuditService.serialize_audit_log(log)

    assert data["company_id"] == "C-001"
    assert data["branch_id"] == "BR-001"
    assert data["event_type"] == "MASTER_LOOKUP_UPDATE"
    assert data["entity_name"] == "master_lookup:department"
    assert data["entity_id"] == "lookup-123"
    assert data["actor_user_id"] == "user-42"
    assert data["actor_role"] == "MANAGER"
    assert data["ip_address"] == "127.0.0.1"
    assert data["before_state"]["name"] == "Dept"
    assert data["after_state"]["name"] == "Department"
    assert data["before_state"]["sort_order"] == 1
    assert data["after_state"]["sort_order"] == 2
    assert data["action_summary"] == "Updated department lookup value 'DPT'."
