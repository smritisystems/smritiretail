"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.34.1
Created      : 2026-09-18
Modified     : 2026-09-18
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

# smriti_capability(entity="IDENTITY", capability="UNIFIED_IDENTITY_CONTROL_PLANE", role="ADAPTER", canonicalOwner="backend/app/services/identity/engine.py")

import re
from typing import Optional, Set
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from ...models.identity_registry import SmritiIdentityRegistry
from .uuid7 import is_valid_uuidv7

# SMRITI Governed Identity Groups (Blueprint Section 10)
SMRITI_APPROVED_GROUPS: Set[str] = {
    "ORG",  # Organization
    "MST",  # Master Data
    "INV",  # Inventory
    "SAL",  # Sales
    "PUR",  # Purchase
    "POS",  # Point of Sale
    "FIN",  # Finance
    "TAX",  # Tax & Compliance
    "CRM",  # Customer Relations
    "RPT",  # Reporting & BI
    "FCT",  # Forecast & SICE
    "COL",  # Collaboration
    "ACT",  # Action Center
    "AUD",  # Audit & Governance
    "INT",  # Integration
    "SYS",  # System
}

# Generic syntactic pattern: GROUP(3)-ENTITY(2..6)-SEQUENCE(4..12 digits)
GENERIC_CODE_PATTERN = re.compile(r"^([A-Z]{3})-([A-Z0-9]{2,6})-(\d{4,12})$")


class IdentityValidator:
    """
    Registry-driven validation engine enforcing SMRITI Identity Architecture rules:
    - Syntactic validation of identity codes
    - Taxonomy validation against SMRITI_APPROVED_GROUPS
    - Schema validation against SmritiIdentityRegistry definitions
    - Technical UUIDv7 format validation
    """

    @classmethod
    def validate_syntax(cls, identity_code: str) -> bool:
        """
        Fast syntactic check: format matches GROUP-ENTITY-SEQ and group is in approved taxonomy.
        """
        if not identity_code or not isinstance(identity_code, str):
            return False
        clean = identity_code.strip()
        match = GENERIC_CODE_PATTERN.match(clean)
        if not match:
            return False
        group, _, _ = match.groups()
        return group in SMRITI_APPROVED_GROUPS

    @classmethod
    def parse_identity_code(cls, identity_code: str) -> Optional[dict]:
        """
        Parse an identity code into its structural components.
        """
        if not cls.validate_syntax(identity_code):
            return None
        match = GENERIC_CODE_PATTERN.match(identity_code.strip())
        group, entity, seq = match.groups()
        return {
            "identity_group": group,
            "entity_code": entity,
            "sequence_number": int(seq),
            "raw_sequence": seq,
            "canonical_code": f"{group}-{entity}-{seq}"
        }

    @classmethod
    async def validate_identity_code(
        cls,
        session: Optional[AsyncSession],
        identity_code: str,
    ) -> bool:
        """
        Registry-driven validation: verifies syntax and checks against SmritiIdentityRegistry if session provided.
        """
        parsed = cls.parse_identity_code(identity_code)
        if not parsed:
            return False

        if session is None:
            return True

        # Check if entity code and group are registered
        stmt = select(SmritiIdentityRegistry).where(
            SmritiIdentityRegistry.group_code == parsed["identity_group"],
            SmritiIdentityRegistry.entity_code == parsed["entity_code"],
            SmritiIdentityRegistry.status == "ACTIVE",
        )
        res = await session.execute(stmt)
        reg = res.scalars().first()
        return reg is not None

    @classmethod
    def validate_technical_id(cls, technical_id: str) -> bool:
        """Validate whether technical_id is a valid RFC 9562 UUIDv7."""
        return is_valid_uuidv7(technical_id)

    @classmethod
    def is_group_approved(cls, group_code: str) -> bool:
        """Check if group code is one of the 16 governed SMRITI groups."""
        return str(group_code).strip().upper() in SMRITI_APPROVED_GROUPS
