"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.31.0
Created      : 2026-08-23
Modified     : 2026-09-13
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import json
import uuid
import hashlib
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from sqlalchemy import select, desc, or_
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.audit import ComplianceImmutableAuditLog


class ComplianceAuditService:
    """
    SMRITI Compliance & Immutable Regulatory Audit Service (Section 12).
    Records cryptographic, tamper-evident audit trails with SHA-256 integrity verification.
    """

    @classmethod
    def serialize_audit_log(
        cls,
        log: ComplianceImmutableAuditLog,
        actor_username: Optional[str] = None
    ) -> Dict[str, Any]:
        """Return an operationally visible audit record shape for managers and search screens."""

        def parse_json(value: Optional[str]) -> Optional[Any]:
            if not value:
                return None
            try:
                parsed = json.loads(value)
                return parsed
            except Exception:
                return None

        return {
            "id": log.id,
            "uuid": str(getattr(log, "uuid", "")),
            "company_id": log.company_id,
            "branch_id": log.branch_id,
            "event_type": log.event_type,
            "entity_name": log.entity_name,
            "entity_id": log.entity_id,
            "actor_user_id": log.actor_user_id,
            "actor_username": actor_username or log.actor_user_id,
            "actor_role": log.actor_role,
            "ip_address": log.ip_address,
            "before_state": parse_json(log.before_state_json),
            "after_state": parse_json(log.after_state_json),
            "action_summary": log.action_summary,
            "payload_hash": log.payload_hash,
            "previous_hash": getattr(log, "previous_hash", None),
            "hash_chain_verified": getattr(log, "hash_chain_verified", True),
            "request_id": getattr(log, "request_id", None),
            "client_user_agent": getattr(log, "client_user_agent", None),
            "retention_policy": getattr(log, "retention_policy", "STATUTORY_7_YEARS"),
            "worm_locked": getattr(log, "worm_locked", True),
            "timestamp": log.timestamp.isoformat() if log.timestamp else None,
        }

    GENESIS_HASH: str = "0" * 64

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
        after_state: Optional[str] = None,
        previous_hash: Optional[str] = None,
    ) -> str:
        """Computes deterministic SHA-256 checksum over the audit event properties and chain predecessor."""
        raw_payload = f"{company_id}|{event_type}|{entity_name}|{entity_id}|{timestamp_str}|{action_summary}|{before_state or ''}|{after_state or ''}|{previous_hash or ''}"
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
        branch_id: str = "BR-001",
        request_id: Optional[str] = None,
        client_user_agent: Optional[str] = None,
        retention_policy: str = "STATUTORY_7_YEARS",
        worm_locked: bool = True,
    ) -> ComplianceImmutableAuditLog:
        """
        Authoritatively creates and appends an immutable compliance audit record
        linked cryptographically into the company's SHA-256 hash chain.
        """
        now = datetime.now(timezone.utc)
        before_json = json.dumps(before_state, default=str) if before_state else None
        after_json = json.dumps(after_state, default=str) if after_state else None

        # Fetch latest predecessor payload_hash for cryptographic chaining
        prev_stmt = (
            select(ComplianceImmutableAuditLog.payload_hash)
            .where(
                ComplianceImmutableAuditLog.company_id == company_id,
                ComplianceImmutableAuditLog.is_deleted == False,
            )
            .order_by(ComplianceImmutableAuditLog.timestamp.desc(), ComplianceImmutableAuditLog.id.desc())
            .limit(1)
        )
        prev_res = await session.execute(prev_stmt)
        prev_row = prev_res.scalar_one_or_none()
        previous_hash = prev_row if prev_row else cls.GENESIS_HASH

        payload_hash = cls.compute_payload_hash(
            company_id=company_id,
            event_type=event_type,
            entity_name=entity_name,
            entity_id=entity_id,
            timestamp_str=now.isoformat(),
            action_summary=action_summary,
            before_state=before_json,
            after_state=after_json,
            previous_hash=previous_hash,
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
            previous_hash=previous_hash,
            hash_chain_verified=True,
            request_id=request_id,
            client_user_agent=client_user_agent,
            retention_policy=retention_policy,
            worm_locked=worm_locked,
            timestamp=now,
            is_active=True,
            is_deleted=False,
        )
        session.add(log)
        await session.flush()
        return log

    @classmethod
    async def verify_audit_integrity(
        cls,
        log: ComplianceImmutableAuditLog,
    ) -> bool:
        """Verifies if the log record has been tampered with by re-computing the SHA-256 hash."""
        expected_hash = cls.compute_payload_hash(
            company_id=log.company_id,
            event_type=log.event_type,
            entity_name=log.entity_name,
            entity_id=log.entity_id,
            timestamp_str=log.timestamp.isoformat() if log.timestamp else "",
            action_summary=log.action_summary,
            before_state=log.before_state_json,
            after_state=log.after_state_json,
            previous_hash=log.previous_hash,
        )
        if log.payload_hash == expected_hash:
            return True
        # Backwards compatibility check for pre-chaining legacy hashes (no previous_hash)
        if not log.previous_hash or log.previous_hash == cls.GENESIS_HASH:
            legacy_hash = cls.compute_payload_hash(
                company_id=log.company_id,
                event_type=log.event_type,
                entity_name=log.entity_name,
                entity_id=log.entity_id,
                timestamp_str=log.timestamp.isoformat() if log.timestamp else "",
                action_summary=log.action_summary,
                before_state=log.before_state_json,
                after_state=log.after_state_json,
                previous_hash=None,
            )
            return log.payload_hash == legacy_hash
        return False

    @classmethod
    async def verify_chain_integrity(
        cls,
        session: AsyncSession,
        company_id: str,
        limit: int = 500,
    ) -> Dict[str, Any]:
        """
        Traverses the cryptographic hash chain for a company in chronological order,
        verifying that:
        1. Each record's payload_hash is cryptographically authentic.
        2. Each record's previous_hash matches the prior record's payload_hash.
        Returns an authoritative forensic verification report.
        """
        stmt = (
            select(ComplianceImmutableAuditLog)
            .where(
                ComplianceImmutableAuditLog.company_id == company_id,
                ComplianceImmutableAuditLog.is_deleted == False,
            )
            .order_by(ComplianceImmutableAuditLog.timestamp.asc(), ComplianceImmutableAuditLog.id.asc())
            .limit(limit)
        )
        logs = (await session.execute(stmt)).scalars().all()
        if not logs:
            return {
                "verified": True,
                "inspected_count": 0,
                "broken_at_id": None,
                "details": "No audit records found for company.",
            }

        prev_expected_hash: Optional[str] = None
        for idx, log in enumerate(logs):
            # Check individual payload hash integrity
            is_valid = await cls.verify_audit_integrity(log)
            if not is_valid:
                return {
                    "verified": False,
                    "inspected_count": idx + 1,
                    "broken_at_id": log.id,
                    "reason": "PAYLOAD_HASH_MISMATCH",
                    "details": f"Record {log.id} has invalid payload_hash {log.payload_hash}",
                }

            # Check chain linkage
            if idx > 0 and log.previous_hash and log.previous_hash != cls.GENESIS_HASH:
                if prev_expected_hash and log.previous_hash != prev_expected_hash:
                    return {
                        "verified": False,
                        "inspected_count": idx + 1,
                        "broken_at_id": log.id,
                        "reason": "CHAIN_LINK_BROKEN",
                        "details": f"Record {log.id} previous_hash {log.previous_hash} does not match expected prior hash {prev_expected_hash}",
                    }
            prev_expected_hash = log.payload_hash

        return {
            "verified": True,
            "inspected_count": len(logs),
            "broken_at_id": None,
            "details": f"Cryptographic hash chain verified unbroken across {len(logs)} records.",
        }


    @classmethod
    async def search_audit_logs(
        cls,
        session: AsyncSession,
        company_id: str,
        entity_name: Optional[str] = None,
        entity_id: Optional[str] = None,
        event_type: Optional[str] = None,
        limit: int = 50,
        include_all_companies: bool = False,
    ) -> List[Dict[str, Any]]:
        """Search immutable audit logs for compliance review while surfacing the full
        before/after operational payload as part of the standard audit record envelope.
        """
        stmt = select(ComplianceImmutableAuditLog).where(
            ComplianceImmutableAuditLog.is_deleted == False,
            ComplianceImmutableAuditLog.is_active == True,
        ).order_by(ComplianceImmutableAuditLog.timestamp.desc()).limit(limit)

        if not include_all_companies:
            if company_id:
                stmt = stmt.where(ComplianceImmutableAuditLog.company_id.in_([company_id, "GLOBAL"]))
            else:
                stmt = stmt.where(ComplianceImmutableAuditLog.company_id == "GLOBAL")

        if entity_name:
            stmt = stmt.where(
                or_(
                    ComplianceImmutableAuditLog.entity_name == entity_name,
                    ComplianceImmutableAuditLog.entity_name.like(f"{entity_name}:%"),
                )
            )
        if entity_id:
            stmt = stmt.where(ComplianceImmutableAuditLog.entity_id == entity_id)
        if event_type:
            stmt = stmt.where(ComplianceImmutableAuditLog.event_type == event_type)

        logs = (await session.execute(stmt)).scalars().all()
        user_ids = {l.actor_user_id for l in logs if l.actor_user_id}
        user_map: Dict[str, str] = {}
        if user_ids:
            try:
                from ..models.auth import User
                res = await session.execute(
                    select(User.id, User.username).where(User.id.in_(user_ids))
                )
                for row in res.all():
                    user_map[str(row[0])] = str(row[1])
            except Exception:
                pass

        return [cls.serialize_audit_log(log, user_map.get(log.actor_user_id)) for log in logs]
