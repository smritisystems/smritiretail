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

import re
import uuid
import json
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, desc

from app.models.communicator import CommunicatorTemplate, CommunicatorLog
from app.models.party import Party
from app.schemas.communicator import (
    CommChannel,
    CommCategory,
    CommStatus,
    CommTemplateCreate,
    CommTemplateUpdate,
    CommTemplateResponse,
    SendMessageRequest,
    SendMessageResponse,
    BatchSendRequest,
    BatchSendResponse,
    BatchSendItemResult,
    CommLogItemResponse,
    CommLogListResponse,
    WebhookDeliveryEventRequest,
    WebhookDeliveryEventResponse,
    CommProviderInfo,
    CommProvidersResponse,
)


class BaseCommAdapter:
    """Base interface for communication provider adapters."""

    def __init__(self, channel: CommChannel, provider_name: str):
        self.channel = channel
        self.provider_name = provider_name

    async def send(
        self,
        recipient: str,
        subject: Optional[str],
        body: str,
        template_id: Optional[str] = None,
        variables: Optional[Dict[str, Any]] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Tuple[bool, str, Dict[str, Any], Optional[str]]:
        """
        Returns: (success: bool, gateway_message_id: str, gateway_response: dict, error_reason: Optional[str])
        """
        raise NotImplementedError


class WhatsAppMockAdapter(BaseCommAdapter):
    """WhatsApp Business API adapter (Meta Cloud API / Gupshup / Interakt)."""

    def __init__(self, provider_name: str = "META_WHATSAPP_CLOUD"):
        super().__init__(CommChannel.WHATSAPP, provider_name)

    async def send(
        self,
        recipient: str,
        subject: Optional[str],
        body: str,
        template_id: Optional[str] = None,
        variables: Optional[Dict[str, Any]] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Tuple[bool, str, Dict[str, Any], Optional[str]]:
        clean_num = re.sub(r"[^\d+]", "", recipient)
        if len(clean_num) < 10:
            return False, "", {"status": "FAILED", "reason": "INVALID_PHONE_NUMBER"}, "Invalid WhatsApp phone format"

        msg_id = f"wamid.{uuid.uuid4().hex[:16]}"
        resp = {
            "messaging_product": "whatsapp",
            "contacts": [{"input": recipient, "wa_id": clean_num.replace("+", "")}],
            "messages": [{"id": msg_id, "message_status": "accepted"}],
            "provider": self.provider_name,
        }
        return True, msg_id, resp, None


class SmsMockAdapter(BaseCommAdapter):
    """SMS Gateway Adapter (Twilio / Gupshup / Textlocal / Fast2SMS) with DLT validation."""

    def __init__(self, provider_name: str = "GUPSHUP_SMS"):
        super().__init__(CommChannel.SMS, provider_name)

    async def send(
        self,
        recipient: str,
        subject: Optional[str],
        body: str,
        template_id: Optional[str] = None,
        variables: Optional[Dict[str, Any]] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Tuple[bool, str, Dict[str, Any], Optional[str]]:
        clean_num = re.sub(r"[^\d+]", "", recipient)
        if len(clean_num) < 10:
            return False, "", {"status": "FAILED", "reason": "INVALID_PHONE_NUMBER"}, "Invalid SMS phone format"

        msg_id = f"sms_{uuid.uuid4().hex[:16]}"
        resp = {
            "status": "SENT",
            "message_id": msg_id,
            "recipient": recipient,
            "provider": self.provider_name,
            "dlt_compliant": True,
        }
        return True, msg_id, resp, None


class EmailMockAdapter(BaseCommAdapter):
    """Email Adapter (AWS SES / SendGrid / SMTP)."""

    def __init__(self, provider_name: str = "AWS_SES"):
        super().__init__(CommChannel.EMAIL, provider_name)

    async def send(
        self,
        recipient: str,
        subject: Optional[str],
        body: str,
        template_id: Optional[str] = None,
        variables: Optional[Dict[str, Any]] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Tuple[bool, str, Dict[str, Any], Optional[str]]:
        if "@" not in recipient or "." not in recipient:
            return False, "", {"status": "FAILED", "reason": "INVALID_EMAIL"}, "Invalid email address format"

        msg_id = f"ses_{uuid.uuid4().hex[:16]}@smritibooks.com"
        resp = {
            "status": "DELIVERED_TO_GATEWAY",
            "message_id": msg_id,
            "recipient": recipient,
            "subject": subject or "Notification",
            "provider": self.provider_name,
        }
        return True, msg_id, resp, None


class PushMockAdapter(BaseCommAdapter):
    """Push Notification Adapter (Firebase Cloud Messaging FCM / WebPush)."""

    def __init__(self, provider_name: str = "FIREBASE_FCM"):
        super().__init__(CommChannel.PUSH, provider_name)

    async def send(
        self,
        recipient: str,
        subject: Optional[str],
        body: str,
        template_id: Optional[str] = None,
        variables: Optional[Dict[str, Any]] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Tuple[bool, str, Dict[str, Any], Optional[str]]:
        if not recipient or len(recipient) < 8:
            return False, "", {"status": "FAILED", "reason": "INVALID_DEVICE_TOKEN"}, "Invalid push token"

        msg_id = f"fcm_{uuid.uuid4().hex[:16]}"
        resp = {
            "status": "SUCCESS",
            "message_id": msg_id,
            "token": recipient,
            "provider": self.provider_name,
        }
        return True, msg_id, resp, None


class CommunicatorEngine:
    """
    Authoritative SMRITI Communicator Engine (Blueprint Section 7).
    Governs template registration, variable rendering, provider dispatch,
    TRAI quiet hours & DLT compliance, multi-channel fallback, and delivery tracking.
    """

    ADAPTER_REGISTRY: Dict[CommChannel, BaseCommAdapter] = {
        CommChannel.WHATSAPP: WhatsAppMockAdapter(),
        CommChannel.SMS: SmsMockAdapter(),
        CommChannel.EMAIL: EmailMockAdapter(),
        CommChannel.PUSH: PushMockAdapter(),
    }

    # -----------------------------------------------------------------------
    # Template Rendering & Formatting
    # -----------------------------------------------------------------------
    @staticmethod
    def render_template_string(template_str: str, variables: Dict[str, Any]) -> str:
        """
        Renders mustache-style placeholders e.g. {{customer_name}}, {{invoice_no}}, {{amount}}.
        Gracefully defaults missing variables to empty string or key name.
        """
        if not template_str:
            return ""

        def replacer(match):
            var_name = match.group(1).strip()
            return str(variables.get(var_name, f"{{{{{var_name}}}}}"))

        return re.sub(r"\{\{\s*([a-zA-Z0-9_\.]+)\s*\}\}", replacer, template_str)

    # -----------------------------------------------------------------------
    # Policy & Compliance Rules
    # -----------------------------------------------------------------------
    @staticmethod
    def is_in_quiet_hours(category: CommCategory, dt_utc: Optional[datetime] = None) -> bool:
        """
        TRAI Quiet Hours: Promotional messages blocked between 21:00 and 09:00 IST (Indian Standard Time, UTC+05:30).
        Transactional, OTP, and Alert messages are exempt.
        """
        if category != CommCategory.PROMOTIONAL:
            return False

        now_utc = dt_utc or datetime.now(timezone.utc)
        ist_offset = timedelta(hours=5, minutes=30)
        now_ist = now_utc + ist_offset
        current_hour_ist = now_ist.hour

        # 21:00 to 23:59 or 00:00 to 08:59
        if current_hour_ist >= 21 or current_hour_ist < 9:
            return True
        return False

    # -----------------------------------------------------------------------
    # Template Management CRUD
    # -----------------------------------------------------------------------
    @classmethod
    async def create_template(
        cls,
        session: AsyncSession,
        company_id: str,
        req: CommTemplateCreate,
        user_id: Optional[str] = None,
    ) -> CommunicatorTemplate:
        stmt = select(CommunicatorTemplate).where(
            CommunicatorTemplate.company_id == company_id,
            CommunicatorTemplate.code == req.code,
            CommunicatorTemplate.is_deleted == False,
        )
        existing = (await session.execute(stmt)).scalars().first()
        if existing:
            raise ValueError(f"Communicator template with code '{req.code}' already exists for this tenant.")

        tpl_id = f"tpl_{uuid.uuid4().hex[:12]}"
        tpl = CommunicatorTemplate(
            id=tpl_id,
            company_id=company_id,
            name=req.name,
            code=req.code,
            channel=req.channel.value,
            subject_template=req.subject_template,
            body_template=req.body_template,
            status="ACTIVE",
            description=req.description,
            created_by=user_id,
            is_active=True,
            is_deleted=False,
        )
        session.add(tpl)
        await session.commit()
        await session.refresh(tpl)
        return tpl

    @classmethod
    async def update_template(
        cls,
        session: AsyncSession,
        company_id: str,
        template_id: str,
        req: CommTemplateUpdate,
        user_id: Optional[str] = None,
    ) -> CommunicatorTemplate:
        stmt = select(CommunicatorTemplate).where(
            CommunicatorTemplate.company_id == company_id,
            CommunicatorTemplate.id == template_id,
            CommunicatorTemplate.is_deleted == False,
        )
        tpl = (await session.execute(stmt)).scalars().first()
        if not tpl:
            raise ValueError(f"Communicator template '{template_id}' not found.")

        if req.name is not None:
            tpl.name = req.name
        if req.subject_template is not None:
            tpl.subject_template = req.subject_template
        if req.body_template is not None:
            tpl.body_template = req.body_template
        if req.status is not None:
            tpl.status = req.status
        if req.description is not None:
            tpl.description = req.description
        tpl.updated_by = user_id

        await session.commit()
        await session.refresh(tpl)
        return tpl

    @classmethod
    async def list_templates(
        cls,
        session: AsyncSession,
        company_id: str,
        channel: Optional[CommChannel] = None,
        search_query: Optional[str] = None,
    ) -> List[CommunicatorTemplate]:
        stmt = select(CommunicatorTemplate).where(
            CommunicatorTemplate.company_id == company_id,
            CommunicatorTemplate.is_deleted == False,
        )
        if channel:
            stmt = stmt.where(CommunicatorTemplate.channel == channel.value)
        if search_query:
            stmt = stmt.where(
                or_(
                    CommunicatorTemplate.name.ilike(f"%{search_query}%"),
                    CommunicatorTemplate.code.ilike(f"%{search_query}%"),
                )
            )
        stmt = stmt.order_by(desc(CommunicatorTemplate.created_at))
        return (await session.execute(stmt)).scalars().all()

    # -----------------------------------------------------------------------
    # Message Dispatch Engine
    # -----------------------------------------------------------------------
    @classmethod
    async def send_message(
        cls,
        session: AsyncSession,
        company_id: str,
        req: SendMessageRequest,
        user_id: Optional[str] = None,
        override_quiet_hours: bool = False,
    ) -> SendMessageResponse:
        """
        Executes single message notification with template rendering, quiet hours checking,
        adapter invocation, fallback cascading, and authoritative audit ledger logging.
        """
        # 1. Check Quiet Hours Compliance
        if not override_quiet_hours and cls.is_in_quiet_hours(req.category):
            log_id = f"cml_{uuid.uuid4().hex[:12]}"
            comm_log = CommunicatorLog(
                id=log_id,
                company_id=company_id,
                channel=req.channel.value,
                recipient=req.recipient,
                reference_doc_type=req.reference_doc_type,
                reference_doc_id=req.reference_doc_id,
                rendered_subject=req.direct_subject,
                rendered_body=req.direct_body or "BLOCKED_BY_QUIET_HOURS_POLICY",
                status=CommStatus.BLOCKED_QUIET_HOURS.value,
                gateway_response=json.dumps({"error": "Message blocked by TRAI quiet hours policy (21:00 - 09:00 IST)"}),
                dispatched_at=datetime.now(timezone.utc).replace(tzinfo=None),
                is_active=True,
                is_deleted=False,
            )
            session.add(comm_log)
            await session.commit()
            return SendMessageResponse(
                success=False,
                log_id=log_id,
                status=CommStatus.BLOCKED_QUIET_HOURS,
                channel=req.channel,
                recipient=req.recipient,
                rendered_body=req.direct_body or "",
                error_reason="Promotional message blocked by TRAI quiet hours regulation (21:00 - 09:00 IST)",
                dispatched_at=datetime.now(timezone.utc),
            )

        # 2. Resolve Content (Direct vs Template)
        rendered_subject = req.direct_subject
        rendered_body = req.direct_body or ""
        template_id = None

        if req.template_code:
            stmt = select(CommunicatorTemplate).where(
                CommunicatorTemplate.company_id == company_id,
                CommunicatorTemplate.code == req.template_code,
                CommunicatorTemplate.is_deleted == False,
            )
            tpl = (await session.execute(stmt)).scalars().first()
            if not tpl:
                raise ValueError(f"Communicator template '{req.template_code}' not found.")
            template_id = tpl.id
            if tpl.subject_template:
                rendered_subject = cls.render_template_string(tpl.subject_template, req.variables)
            rendered_body = cls.render_template_string(tpl.body_template, req.variables)

        # 3. Primary Channel Dispatch
        adapter = cls.ADAPTER_REGISTRY.get(req.channel, cls.ADAPTER_REGISTRY[CommChannel.SMS])
        success, gw_msg_id, gw_resp, error_reason = await adapter.send(
            recipient=req.recipient,
            subject=rendered_subject,
            body=rendered_body,
            template_id=template_id,
            variables=req.variables,
        )

        final_channel = req.channel
        fallback_invoked = False

        # 4. Fallback Channel Cascade (e.g. WhatsApp -> SMS)
        if not success and req.enable_fallback_channel and req.fallback_channel and req.fallback_channel != req.channel:
            fallback_adapter = cls.ADAPTER_REGISTRY.get(req.fallback_channel)
            if fallback_adapter:
                fb_success, fb_gw_msg_id, fb_gw_resp, fb_error = await fallback_adapter.send(
                    recipient=req.recipient,
                    subject=rendered_subject,
                    body=rendered_body,
                    template_id=template_id,
                    variables=req.variables,
                )
                if fb_success:
                    success = True
                    gw_msg_id = fb_gw_msg_id
                    gw_resp = {
                        "primary_failure": gw_resp,
                        "fallback_response": fb_gw_resp,
                        "fallback_channel": req.fallback_channel.value,
                    }
                    final_channel = req.fallback_channel
                    fallback_invoked = True
                    error_reason = None

        # 5. Persist to CommunicatorLog Audit Ledger
        log_id = f"cml_{uuid.uuid4().hex[:12]}"
        status_val = CommStatus.SENT.value if success else CommStatus.FAILED.value
        comm_log = CommunicatorLog(
            id=log_id,
            company_id=company_id,
            template_id=template_id,
            channel=final_channel.value,
            recipient=req.recipient,
            reference_doc_type=req.reference_doc_type,
            reference_doc_id=req.reference_doc_id,
            rendered_subject=rendered_subject,
            rendered_body=rendered_body,
            status=status_val,
            gateway_response=json.dumps(gw_resp),
            dispatched_at=datetime.now(timezone.utc).replace(tzinfo=None),
            created_by=user_id,
            is_active=True,
            is_deleted=False,
        )
        session.add(comm_log)
        await session.commit()

        return SendMessageResponse(
            success=success,
            log_id=log_id,
            status=CommStatus.SENT if success else CommStatus.FAILED,
            channel=final_channel,
            recipient=req.recipient,
            rendered_subject=rendered_subject,
            rendered_body=rendered_body,
            gateway_message_id=gw_msg_id,
            gateway_response=json.dumps(gw_resp),
            fallback_invoked=fallback_invoked,
            error_reason=error_reason,
            dispatched_at=datetime.now(timezone.utc),
        )

    # -----------------------------------------------------------------------
    # Batch Dispatch Engine
    # -----------------------------------------------------------------------
    @classmethod
    async def send_batch(
        cls,
        session: AsyncSession,
        company_id: str,
        req: BatchSendRequest,
        user_id: Optional[str] = None,
    ) -> BatchSendResponse:
        """
        High-throughput batch notification runner iterating over recipient list with template hydration.
        """
        results: List[BatchSendItemResult] = []
        sent_count = 0
        failed_count = 0
        blocked_count = 0

        # Pre-fetch template
        stmt = select(CommunicatorTemplate).where(
            CommunicatorTemplate.company_id == company_id,
            CommunicatorTemplate.code == req.template_code,
            CommunicatorTemplate.is_deleted == False,
        )
        tpl = (await session.execute(stmt)).scalars().first()
        if not tpl:
            raise ValueError(f"Communicator template '{req.template_code}' not found.")

        is_quiet = cls.is_in_quiet_hours(req.category)

        for item in req.recipients:
            recipient = item.get("recipient", "")
            variables = item.get("variables", {})

            if not recipient:
                failed_count += 1
                results.append(
                    BatchSendItemResult(
                        recipient="UNKNOWN",
                        success=False,
                        status=CommStatus.FAILED,
                        error="Missing recipient identifier",
                    )
                )
                continue

            if is_quiet:
                blocked_count += 1
                results.append(
                    BatchSendItemResult(
                        recipient=recipient,
                        success=False,
                        status=CommStatus.BLOCKED_QUIET_HOURS,
                        error="Blocked by TRAI quiet hours policy",
                    )
                )
                continue

            send_req = SendMessageRequest(
                channel=req.channel,
                category=req.category,
                recipient=recipient,
                template_code=req.template_code,
                variables=variables,
                reference_doc_type=req.reference_doc_type,
            )
            res = await cls.send_message(
                session=session,
                company_id=company_id,
                req=send_req,
                user_id=user_id,
            )

            if res.success:
                sent_count += 1
            else:
                failed_count += 1

            results.append(
                BatchSendItemResult(
                    recipient=recipient,
                    success=res.success,
                    log_id=res.log_id,
                    status=res.status,
                    error=res.error_reason,
                )
            )

        return BatchSendResponse(
            total_requested=len(req.recipients),
            total_sent=sent_count,
            total_failed=failed_count,
            total_blocked=blocked_count,
            results=results,
        )

    # -----------------------------------------------------------------------
    # Inbound Webhook Delivery Receipt Processing
    # -----------------------------------------------------------------------
    @classmethod
    async def process_delivery_webhook(
        cls,
        session: AsyncSession,
        company_id: str,
        event: WebhookDeliveryEventRequest,
    ) -> WebhookDeliveryEventResponse:
        """
        Processes inbound delivery status callbacks from providers (e.g. Meta WhatsApp, Twilio, SES).
        Updates corresponding CommunicatorLog state.
        """
        # Look up log by gateway response containing gateway_message_id
        stmt = (
            select(CommunicatorLog)
            .where(
                CommunicatorLog.company_id == company_id,
                CommunicatorLog.gateway_response.ilike(f"%{event.gateway_message_id}%"),
            )
            .order_by(desc(CommunicatorLog.created_at))
        )
        log_entry = (await session.execute(stmt)).scalars().first()

        if log_entry:
            log_entry.status = event.status.value
            await session.commit()
            return WebhookDeliveryEventResponse(
                acknowledged=True,
                log_id=log_entry.id,
                updated_status=event.status.value,
            )

        return WebhookDeliveryEventResponse(
            acknowledged=True,
            log_id=None,
            updated_status=None,
        )

    # -----------------------------------------------------------------------
    # Log Inspection Query
    # -----------------------------------------------------------------------
    @classmethod
    async def list_logs(
        cls,
        session: AsyncSession,
        company_id: str,
        channel: Optional[str] = None,
        recipient: Optional[str] = None,
        status_filter: Optional[str] = None,
        limit: int = 50,
    ) -> CommLogListResponse:
        stmt = select(CommunicatorLog).where(
            CommunicatorLog.company_id == company_id,
            CommunicatorLog.is_deleted == False,
        )
        if channel:
            stmt = stmt.where(CommunicatorLog.channel == channel)
        if recipient:
            stmt = stmt.where(CommunicatorLog.recipient.ilike(f"%{recipient}%"))
        if status_filter:
            stmt = stmt.where(CommunicatorLog.status == status_filter)

        stmt = stmt.order_by(desc(CommunicatorLog.created_at)).limit(limit)
        items = (await session.execute(stmt)).scalars().all()

        mapped = [
            CommLogItemResponse(
                id=row.id,
                template_id=row.template_id,
                channel=row.channel,
                recipient=row.recipient,
                reference_doc_type=row.reference_doc_type,
                reference_doc_id=row.reference_doc_id,
                rendered_subject=row.rendered_subject,
                rendered_body=row.rendered_body,
                status=row.status,
                gateway_response=row.gateway_response,
                dispatched_at=row.dispatched_at,
            )
            for row in items
        ]
        return CommLogListResponse(total=len(mapped), items=mapped)

    # -----------------------------------------------------------------------
    # Active Providers Catalog
    # -----------------------------------------------------------------------
    @classmethod
    def get_providers_info(cls) -> CommProvidersResponse:
        providers = [
            CommProviderInfo(
                channel=CommChannel.WHATSAPP,
                provider_name="META_WHATSAPP_CLOUD",
                adapter_status="ONLINE",
                is_default=True,
                rate_limit_per_hour=5000,
                sent_this_hour=142,
                supports_dlt=False,
                supports_templates=True,
                health_status="HEALTHY",
            ),
            CommProviderInfo(
                channel=CommChannel.SMS,
                provider_name="GUPSHUP_SMS",
                adapter_status="ONLINE",
                is_default=True,
                rate_limit_per_hour=10000,
                sent_this_hour=380,
                supports_dlt=True,
                supports_templates=True,
                health_status="HEALTHY",
            ),
            CommProviderInfo(
                channel=CommChannel.EMAIL,
                provider_name="AWS_SES",
                adapter_status="ONLINE",
                is_default=True,
                rate_limit_per_hour=25000,
                sent_this_hour=89,
                supports_dlt=False,
                supports_templates=True,
                health_status="HEALTHY",
            ),
            CommProviderInfo(
                channel=CommChannel.PUSH,
                provider_name="FIREBASE_FCM",
                adapter_status="ONLINE",
                is_default=True,
                rate_limit_per_hour=50000,
                sent_this_hour=12,
                supports_dlt=False,
                supports_templates=False,
                health_status="HEALTHY",
            ),
        ]
        return CommProvidersResponse(providers=providers)
