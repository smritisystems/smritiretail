"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.23.0
Created      : 2026-08-23
Modified     : 2026-08-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import json
import uuid
import hashlib
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.audit import ComplianceImmutableAuditLog


class ComplianceAuditService:
    """
    SMRITI Compliance & Immutable Regulatory Audit Service (Section 12).
    Records cryptographic, tamper-evident audit trails with SHA-256 integrity verification.
    """

    @classmethod
    def compute_payload_hash(
        cls,
        company_id: str,
        event_type: str,
        entity_name: str,
        entity_id: str,
        timestamp_str: str,
        action_summary: str,
        before_state: Optional[str] = None,
        after_state: Optional[str] = None
    ) -> str:
        """Computes deterministic SHA-256 checksum over the audit event properties."""
        raw_payload = f"{company_id}|{event_type}|{entity_name}|{entity_id}|{timestamp_str}|{action_summary}|{before_state or ''}|{after_state or ''}"
        return hashlib.sha256(raw_payload.encode("utf-8")).hexdigest()

    @classmethod
    async def record_audit_event(
        cls,
        session: AsyncSession,
        company_id: str,
        event_type: str,
        entity_name: str,
        entity_id: str,
        action_summary: str,
        actor_user_id: Optional[str] = None,
        actor_role: Optional[str] = None,
        ip_address: Optional[str] = None,
        before_state: Optional[Dict[str, Any]] = None,
        after_state: Optional[Dict[str, Any]] = None,
        branch_id: str = "BR-001"
    ) -> ComplianceImmutableAuditLog:
        """
        Authoritatively creates and appends an immutable compliance audit record.
        """
        now = datetime.now(timezone.utc)
        before_json = json.dumps(before_state, default=str) if before_state else None
        after_json = json.dumps(after_state, default=str) if after_state else None

        payload_hash = cls.compute_payload_hash(
            company_id=company_id,
            event_type=event_type,
            entity_name=entity_name,
            entity_id=entity_id,
            timestamp_str=now.isoformat(),
            action_summary=action_summary,
            before_state=before_json,
            after_state=after_json
        )

        log = ComplianceImmutableAuditLog(
            id=f"aud_{uuid.uuid4().hex[:12]}",
            uuid=str(uuid.uuid4()),
            company_id=company_id,
            branch_id=branch_id,
            event_type=event_type,
            entity_name=entity_name,
            entity_id=entity_id,
            actor_user_id=actor_user_id,
            actor_role=actor_role,
            ip_address=ip_address,
            before_state_json=before_json,
            after_state_json=after_json,
            action_summary=action_summary,
            payload_hash=payload_hash,
            timestamp=now,
            is_active=True,
            is_deleted=False
        )
        session.add(log)
        await session.flush()
        return log

    @classmethod
    async def verify_audit_integrity(
        cls,
        log: ComplianceImmutableAuditLog
    ) -> bool:
        """Verifies if the log record has been tampered with by re-computing the SHA-256 hash."""
        expected_hash = cls.compute_payload_hash(
            company_id=log.company_id,
            event_type=log.event_type,
            entity_name=log.entity_name,
            entity_id=log.entity_id,
            timestamp_str=log.timestamp.isoformat(),
            action_summary=log.action_summary,
            before_state=log.before_state_json,
            after_state=log.after_state_json
        )
        return log.payload_hash == expected_hash

    @classmethod
    async def search_audit_logs(
        cls,
        session: AsyncSession,
        company_id: str,
        entity_name: Optional[str] = None,
        entity_id: Optional[str] = None,
        event_type: Optional[str] = None,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """Searches immutable audit logs for regulatory and compliance review."""
        stmt = select(ComplianceImmutableAuditLog).where(
            ComplianceImmutableAuditLog.company_id == company_id,
            ComplianceImmutableAuditLog.is_deleted == False
        ).order_by(ComplianceImmutableAuditLog.timestamp.desc()).limit(limit)

        if entity_name:
            stmt = stmt.where(ComplianceImmutableAuditLog.entity_name == entity_name)
        if entity_id:
            stmt = stmt.where(ComplianceImmutableAuditLog.entity_id == entity_id)
        if event_type:
            stmt = stmt.where(ComplianceImmutableAuditLog.event_type == event_type)

        logs = (await session.execute(stmt)).scalars().all()
        return [
            {
                "id": l.id,
                "event_type": l.event_type,
                "entity_name": l.entity_name,
                "entity_id": l.entity_id,
                "actor_user_id": l.actor_user_id,
                "actor_role": l.actor_role,
                "ip_address": l.ip_address,
                "action_summary": l.action_summary,
                "payload_hash": l.payload_hash,
                "timestamp": l.timestamp.isoformat() if l.timestamp else None
            }
            for l in logs
        ]
