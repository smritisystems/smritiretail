"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.47.0
Created      : 2026-07-20
Modified     : 2026-07-20
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import uuid
from typing import Dict, Any, Set
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.sip import SIPIdentityRule, SIPIdentityRuleVersion, SIPIdentityOutbox


class SIPRuleGovernanceFSM:
    """
    State machine enforcing formal governance lifecycle state transitions for Identity Rules:
    DRAFT -> REVIEW -> APPROVED -> SIMULATION -> PILOT -> PRODUCTION -> DEPRECATED -> ARCHIVED.
    """
    ALLOWED_TRANSITIONS: Dict[str, Set[str]] = {
        "DRAFT": {"REVIEW", "ARCHIVED"},
        "REVIEW": {"APPROVED", "DRAFT", "ARCHIVED"},
        "APPROVED": {"SIMULATION", "DEPRECATED"},
        "SIMULATION": {"PILOT", "APPROVED", "DEPRECATED"},
        "PILOT": {"PRODUCTION", "SIMULATION", "DEPRECATED"},
        "PRODUCTION": {"DEPRECATED"},
        "DEPRECATED": {"ARCHIVED"},
        "ARCHIVED": set(),
    }

    async def transition_rule_state(
        self,
        db: AsyncSession,
        rule_id: str,
        target_state: str,
        change_summary: str,
    ) -> SIPIdentityRule:
        stmt = select(SIPIdentityRule).where(SIPIdentityRule.id == rule_id)
        rule = (await db.execute(stmt)).scalar_one_or_none()
        if not rule:
            raise ValueError(f"SIP Identity Rule '{rule_id}' not found.")

        current = rule.lifecycle_state.upper()
        target = target_state.upper()

        if target not in self.ALLOWED_TRANSITIONS.get(current, set()):
            raise ValueError(f"Invalid FSM transition for SIP rule: '{current}' -> '{target}'. Allowed: {list(self.ALLOWED_TRANSITIONS.get(current, set()))}")

        rule.lifecycle_state = target
        rule.version += 1

        # Audit version record
        ver = SIPIdentityRuleVersion(
            id=str(uuid.uuid4()),
            rule_id=rule.id,
            version=rule.version,
            pattern_template=rule.pattern_template,
            lifecycle_state=target,
            change_summary=change_summary,
        )
        db.add(ver)

        # Emit outbox event
        event_name = "RuleActivated" if target == "PRODUCTION" else "RuleStateChanged"
        outbox = SIPIdentityOutbox(
            id=str(uuid.uuid4()),
            event_type=event_name,
            aggregate_type="SIPIdentityRule",
            aggregate_id=rule.id,
            payload={"rule_code": rule.code, "previous_state": current, "new_state": target, "version": rule.version},
            status="PENDING",
        )
        db.add(outbox)
        await db.commit()
        return rule
