"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-07-12
Modified     : 2026-07-12
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import TenantContext
from app.compliance.exceptions import PolicyViolationException
from app.compliance.models.compliance import ComplianceOutbox
from app.compliance.repositories.outbox_repository import ComplianceOutboxRepository
from app.compliance.services.policy_service import PolicyService


class ComplianceService:
    """
    Primary orchestrator for SMRITI compliance operations and transactional outbox.
    Coordinates database, policy check, and outbox state.
    """
    def __init__(
        self,
        db: AsyncSession,
        tenant_ctx: TenantContext | None = None,
        policy_service: PolicyService | None = None
    ) -> None:
        self.db = db
        self.tenant_ctx = tenant_ctx
        self.repo = ComplianceOutboxRepository(db, tenant_ctx)
        self.policy_service = policy_service or PolicyService()

    async def queue_outbox_event(
        self,
        service_id: str,
        action: str,
        payload: str,
        idempotency_key: str,
        environment: str = "sandbox"
    ) -> ComplianceOutbox:
        """
        Validates the submission policy rules and queues the event in the transactional outbox.
        Raises PolicyViolationException if policies are violated or duplicate key is found.
        """
        # Validate submission policy
        self.policy_service.validate_submission(service_id, action, environment)

        # Check for duplicate idempotency key
        existing = await self.repo.get_by_idempotency_key(idempotency_key)
        if existing:
            raise PolicyViolationException(
                f"SGIP-POL-005: Submission with idempotency key '{idempotency_key}' already exists."
            )

        new_event = ComplianceOutbox(
            id=f"outbox-{uuid.uuid4().hex[:8]}",
            service_id=service_id,
            state="DRAFT",
            action=action,
            payload=payload,
            idempotency_key=idempotency_key,
            attempts=0
        )
        created = await self.repo.create(new_event)
        await self.db.commit()
        return created

    async def get_outbox_event(self, idempotency_key: str) -> ComplianceOutbox | None:
        """
        Retrieves outbox event by unique idempotency key.
        """
        return await self.repo.get_by_idempotency_key(idempotency_key)
