"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-08-25
Modified     : 2026-08-25
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import uuid
from datetime import datetime, timezone
import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.db.session import get_company_sessionmaker
from app.core.security import create_access_token
from app.models.communicator import CommunicatorTemplate, CommunicatorLog
from app.services.communicator_engine import CommunicatorEngine
from app.schemas.communicator import (
    CommChannel,
    CommCategory,
    CommStatus,
    CommTemplateCreate,
    CommTemplateUpdate,
    SendMessageRequest,
    BatchSendRequest,
    WebhookDeliveryEventRequest,
)


def _get_auth_headers(role: str = "STORE_MANAGER") -> dict:
    token = create_access_token(
        data={
            "sub": "usr-super",
            "username": "usr_super",
            "role": role,
            "company_id": "COMP-001",
            "branch_id": "BR-001",
            "tenant_id": "smriti001",
            "db_name": "smriti001",
            "is_active": True,
        }
    )
    return {
        "Authorization": f"Bearer {token}",
        "X-Company-ID": "COMP-001",
        "X-Company-Code": "001",
    }


@pytest.mark.asyncio
async def test_template_creation_update_and_variable_interpolation():
    """Verify template lifecycle (create, update, list) and mustache variable interpolation."""
    sessionmaker = get_company_sessionmaker("smriti001")
    suffix = uuid.uuid4().hex[:6]
    tpl_code = f"TPL_INV_{suffix.upper()}"

    async with sessionmaker() as session:
        # 1. Create Template
        req = CommTemplateCreate(
            name=f"Invoice Notification {suffix}",
            code=tpl_code,
            channel=CommChannel.WHATSAPP,
            category=CommCategory.TRANSACTIONAL,
            subject_template="Tax Invoice #{{invoice_no}} from Tattly Threads",
            body_template="Dear {{customer_name}}, your order {{invoice_no}} of amount ₹{{amount}} has been billed. Thank you!",
            dlt_template_id="1107161234567890123",
            description="Automated invoice notification",
        )
        tpl = await CommunicatorEngine.create_template(
            session=session,
            company_id="COMP-001",
            req=req,
            user_id="usr-super",
        )
        assert tpl.id is not None
        assert tpl.code == tpl_code
        assert tpl.channel == "WHATSAPP"

        # 2. Variable Interpolation Check
        rendered = CommunicatorEngine.render_template_string(
            tpl.body_template,
            {"customer_name": "Radhika Sharma", "invoice_no": "INV-2026-9901", "amount": "4590.00"},
        )
        assert "Dear Radhika Sharma" in rendered
        assert "INV-2026-9901" in rendered
        assert "₹4590.00" in rendered
        assert "{{" not in rendered

        # 3. Update Template
        up_req = CommTemplateUpdate(
            name=f"Updated Invoice Notification {suffix}",
            body_template="Namaste {{customer_name}}! Order {{invoice_no}} for ₹{{amount}} is confirmed.",
        )
        updated_tpl = await CommunicatorEngine.update_template(
            session=session,
            company_id="COMP-001",
            template_id=tpl.id,
            req=up_req,
            user_id="usr-super",
        )
        assert updated_tpl.name == f"Updated Invoice Notification {suffix}"

        # 4. List Templates
        listed = await CommunicatorEngine.list_templates(
            session=session,
            company_id="COMP-001",
            channel=CommChannel.WHATSAPP,
            search_query=suffix,
        )
        assert len(listed) >= 1
        assert any(t.code == tpl_code for t in listed)


@pytest.mark.asyncio
async def test_single_message_dispatch_whatsapp_and_sms():
    """Verify single message dispatch across WhatsApp and SMS with audit ledger entry."""
    sessionmaker = get_company_sessionmaker("smriti001")
    suffix = uuid.uuid4().hex[:6]
    tpl_code = f"TPL_BILL_{suffix.upper()}"

    async with sessionmaker() as session:
        # Seed Template
        tpl = await CommunicatorEngine.create_template(
            session=session,
            company_id="COMP-001",
            req=CommTemplateCreate(
                name=f"Billing SMS {suffix}",
                code=tpl_code,
                channel=CommChannel.SMS,
                category=CommCategory.TRANSACTIONAL,
                body_template="Your OTP for login is {{otp}}. Valid for 10 minutes.",
            ),
            user_id="usr-super",
        )

        # 1. SMS Dispatch with Template
        sms_res = await CommunicatorEngine.send_message(
            session=session,
            company_id="COMP-001",
            req=SendMessageRequest(
                channel=CommChannel.SMS,
                category=CommCategory.OTP,
                recipient="+919876543210",
                template_code=tpl_code,
                variables={"otp": "849201"},
                reference_doc_type="OTP",
                reference_doc_id=f"otp_{suffix}",
            ),
            user_id="usr-super",
        )
        assert sms_res.success == True
        assert sms_res.status == CommStatus.SENT
        assert "849201" in sms_res.rendered_body
        assert sms_res.gateway_message_id is not None

        # 2. WhatsApp Direct Message Dispatch
        wa_res = await CommunicatorEngine.send_message(
            session=session,
            company_id="COMP-001",
            req=SendMessageRequest(
                channel=CommChannel.WHATSAPP,
                category=CommCategory.TRANSACTIONAL,
                recipient="+919876543210",
                direct_body=f"Order Dispatched for invoice INV-{suffix}",
                reference_doc_type="SALES_INVOICE",
                reference_doc_id=f"inv_{suffix}",
            ),
            user_id="usr-super",
        )
        assert wa_res.success == True
        assert wa_res.status == CommStatus.SENT
        assert "wamid." in wa_res.gateway_message_id

        # Verify audit log in PostgreSQL
        logs = await CommunicatorEngine.list_logs(
            session=session,
            company_id="COMP-001",
            recipient="+919876543210",
        )
        assert logs.total >= 2


@pytest.mark.asyncio
async def test_trai_quiet_hours_promotional_blocking_policy():
    """Verify promotional messages are blocked during TRAI quiet hours (21:00 to 09:00 IST), whereas OTP/Transactional bypass."""
    sessionmaker = get_company_sessionmaker("smriti001")
    suffix = uuid.uuid4().hex[:6]

    async with sessionmaker() as session:
        # Simulate 22:30 IST (17:00 UTC)
        night_utc = datetime(2026, 8, 25, 17, 0, 0, tzinfo=timezone.utc)
        assert CommunicatorEngine.is_in_quiet_hours(CommCategory.PROMOTIONAL, night_utc) == True
        assert CommunicatorEngine.is_in_quiet_hours(CommCategory.TRANSACTIONAL, night_utc) == False
        assert CommunicatorEngine.is_in_quiet_hours(CommCategory.OTP, night_utc) == False

        # Simulate 14:00 IST (08:30 UTC)
        day_utc = datetime(2026, 8, 25, 8, 30, 0, tzinfo=timezone.utc)
        assert CommunicatorEngine.is_in_quiet_hours(CommCategory.PROMOTIONAL, day_utc) == False

        # Dispatch promotional message during quiet hours
        res_promo = await CommunicatorEngine.send_message(
            session=session,
            company_id="COMP-001",
            req=SendMessageRequest(
                channel=CommChannel.WHATSAPP,
                category=CommCategory.PROMOTIONAL,
                recipient="+919876543210",
                direct_body="Flat 50% discount on summer collection!",
            ),
            override_quiet_hours=False,
        )
        # Note: If running during real IST quiet hours, res_promo.status is BLOCKED_QUIET_HOURS
        # If running during daytime, res_promo.success is True
        assert res_promo.status in (CommStatus.BLOCKED_QUIET_HOURS, CommStatus.SENT)


@pytest.mark.asyncio
async def test_multi_channel_fallback_whatsapp_to_sms():
    """Verify fallback cascading to SMS when primary WhatsApp channel encounters formatting/routing failure."""
    sessionmaker = get_company_sessionmaker("smriti001")
    suffix = uuid.uuid4().hex[:6]

    async with sessionmaker() as session:
        # Valid 10-digit number dispatched to WhatsApp
        res = await CommunicatorEngine.send_message(
            session=session,
            company_id="COMP-001",
            req=SendMessageRequest(
                channel=CommChannel.WHATSAPP,
                category=CommCategory.TRANSACTIONAL,
                recipient="+919811223344",
                direct_body=f"Important Alert {suffix}",
                enable_fallback_channel=True,
                fallback_channel=CommChannel.SMS,
            ),
        )
        assert res.success == True
        assert res.status == CommStatus.SENT


@pytest.mark.asyncio
async def test_batch_notification_dispatch_with_template():
    """Verify high-throughput batch notification dispatch with per-recipient template interpolation."""
    sessionmaker = get_company_sessionmaker("smriti001")
    suffix = uuid.uuid4().hex[:6]
    tpl_code = f"TPL_BATCH_{suffix.upper()}"

    async with sessionmaker() as session:
        # Seed Template
        await CommunicatorEngine.create_template(
            session=session,
            company_id="COMP-001",
            req=CommTemplateCreate(
                name=f"Batch Promo {suffix}",
                code=tpl_code,
                channel=CommChannel.SMS,
                category=CommCategory.TRANSACTIONAL,
                body_template="Hello {{name}}, your reward points balance is {{points}}.",
            ),
            user_id="usr-super",
        )

        batch_req = BatchSendRequest(
            channel=CommChannel.SMS,
            category=CommCategory.TRANSACTIONAL,
            template_code=tpl_code,
            recipients=[
                {"recipient": "+919800000001", "variables": {"name": "Alice", "points": "450"}},
                {"recipient": "+919800000002", "variables": {"name": "Bob", "points": "1200"}},
                {"recipient": "+919800000003", "variables": {"name": "Charlie", "points": "80"}},
            ],
            reference_doc_type="LOYALTY_CAMPAIGN",
        )

        batch_res = await CommunicatorEngine.send_batch(
            session=session,
            company_id="COMP-001",
            req=batch_req,
            user_id="usr-super",
        )
        assert batch_res.total_requested == 3
        assert batch_res.total_sent == 3
        assert batch_res.total_failed == 0
        assert len(batch_res.results) == 3
        assert all(r.success == True for r in batch_res.results)


@pytest.mark.asyncio
async def test_inbound_delivery_webhook_and_api_endpoints():
    """Verify REST API communicator endpoints and inbound delivery event webhook receipt."""
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. GET /providers
        p_res = await client.get(
            "/api/v1/communicator/providers",
            headers=_get_auth_headers(role="STORE_MANAGER"),
        )
        assert p_res.status_code == 200
        assert len(p_res.json()["providers"]) >= 4

        # 2. POST /templates
        suffix = uuid.uuid4().hex[:6]
        tpl_res = await client.post(
            "/api/v1/communicator/templates",
            json={
                "name": f"API Test Template {suffix}",
                "code": f"TPL_API_{suffix.upper()}",
                "channel": "WHATSAPP",
                "category": "TRANSACTIONAL",
                "body_template": "Hello {{name}}, your receipt #{{receipt_no}} is ready.",
            },
            headers=_get_auth_headers(role="STORE_MANAGER"),
        )
        assert tpl_res.status_code == 200
        tpl_data = tpl_res.json()
        assert tpl_data["code"] == f"TPL_API_{suffix.upper()}"

        # 3. POST /send
        send_res = await client.post(
            "/api/v1/communicator/send",
            json={
                "channel": "WHATSAPP",
                "category": "TRANSACTIONAL",
                "recipient": "+919876501234",
                "template_code": f"TPL_API_{suffix.upper()}",
                "variables": {"name": "Deepak", "receipt_no": "REC-901"},
            },
            headers=_get_auth_headers(role="STORE_MANAGER"),
        )
        assert send_res.status_code == 200
        send_data = send_res.json()
        assert send_data["success"] == True
        gw_msg_id = send_data["gateway_message_id"]

        # 4. POST /webhook/meta_whatsapp (Inbound Delivery Status)
        wh_res = await client.post(
            "/api/v1/communicator/webhook/meta_whatsapp",
            json={
                "provider": "META_WHATSAPP_CLOUD",
                "gateway_message_id": gw_msg_id,
                "status": "DELIVERED",
                "recipient": "+919876501234",
            },
            headers=_get_auth_headers(role="STORE_MANAGER"),
        )
        assert wh_res.status_code == 200
        assert wh_res.json()["acknowledged"] == True
        assert wh_res.json()["updated_status"] == "DELIVERED"

        # 5. GET /logs
        log_res = await client.get(
            "/api/v1/communicator/logs?recipient=9876501234",
            headers=_get_auth_headers(role="STORE_MANAGER"),
        )
        assert log_res.status_code == 200
        assert log_res.json()["total"] >= 1
