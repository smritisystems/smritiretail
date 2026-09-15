"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.27.1
Created      : 2026-09-16
Modified     : 2026-09-16
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Platform Kernel Contract — Stage 5.1 Hardened
"""

from enum import Enum
from typing import Dict, Optional


class RetentionTier(str, Enum):
    """
    Event retention tiers preventing blind blanket deletion of critical records.
    Governed by business operations, system observability, and statutory tax laws.
    """
    EPHEMERAL = "EPHEMERAL"                      # 7 Days: pings, heartbeats, transient cache updates
    OPERATIONAL = "OPERATIONAL"                  # 90 Days: standard operational notifications, inventory pings
    STATUTORY_FINANCIAL = "STATUTORY_FINANCIAL"  # Default 8 Years (2,920 Days): Subject to applicable record type & legal/tax rules (e.g. CGST Sec 36)
    AUDIT_COMPLIANCE = "AUDIT_COMPLIANCE"        # Permanent: immutable governance and security audit logs


DEFAULT_RETENTION_DAYS: Dict[RetentionTier, int] = {
    RetentionTier.EPHEMERAL: 7,
    RetentionTier.OPERATIONAL: 90,
    RetentionTier.STATUTORY_FINANCIAL: 2920,   # 8 statutory fiscal years
    RetentionTier.AUDIT_COMPLIANCE: -1,        # -1 = permanent, never purge
}


class EventRetentionPolicy:
    """
    Contract-first Event Retention Policy Resolver.
    Determines retention tier and lifespan based on canonical event namespace.
    """

    PREFIX_MAPPINGS = {
        "billing.": RetentionTier.STATUTORY_FINANCIAL,
        "sales.": RetentionTier.STATUTORY_FINANCIAL,
        "purchase.": RetentionTier.STATUTORY_FINANCIAL,
        "accounting.": RetentionTier.STATUTORY_FINANCIAL,
        "gst.": RetentionTier.STATUTORY_FINANCIAL,
        "payment.": RetentionTier.STATUTORY_FINANCIAL,
        "compliance.": RetentionTier.AUDIT_COMPLIANCE,
        "governance.": RetentionTier.AUDIT_COMPLIANCE,
        "security.": RetentionTier.AUDIT_COMPLIANCE,
        "heartbeat.": RetentionTier.EPHEMERAL,
        "cache.": RetentionTier.EPHEMERAL,
    }

    @classmethod
    def resolve_tier(cls, event_type: str) -> RetentionTier:
        clean = str(event_type).strip().lower()
        for prefix, tier in cls.PREFIX_MAPPINGS.items():
            if clean.startswith(prefix):
                return tier
        return RetentionTier.OPERATIONAL

    @classmethod
    def resolve_retention_days(cls, event_type: str) -> int:
        tier = cls.resolve_tier(event_type)
        return DEFAULT_RETENTION_DAYS.get(tier, 90)
