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

# smriti_capability(entity="IDENTITY", capability="UNIFIED_IDENTITY_CONTROL_PLANE", role="CANONICAL")

from typing import Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from .uuid7 import uuid7, is_valid_uuidv7
from .code_generator import IdentityCodeGenerator
from .validator import IdentityValidator, SMRITI_APPROVED_GROUPS
from .resolver import IdentityResolver, IdentityResolutionResult


class IdentityEngine:
    """
    SMRITI Universal Identity Engine (Blueprint Section 16, 94).
    Platform-wide authority for technical identity (UUIDv7) and governed human-friendly Identity Codes.
    """

    @staticmethod
    def generate_technical_id() -> str:
        """
        Generate an immutable, sortable, RFC 9562 compliant technical UUIDv7 string.
        (Layer A)
        """
        return uuid7()

    @classmethod
    async def generate_identity(
        cls,
        session: AsyncSession,
        entity_type: str,
        group_code: Optional[str] = None,
        tenant_id: Optional[str] = None,
        company_id: Optional[str] = None,
        branch_id: Optional[str] = None,
        financial_year: Optional[str] = None,
        purpose: str = "ENTITY_CREATION",
        correlation_id: Optional[str] = None,
    ) -> Tuple[str, str]:
        """
        Atomically generate both:
        1. Technical ID: UUIDv7 (Layer A)
        2. SMRITI Identity Code: GROUP-ENTITY-SEQUENCE (Layer D)
        Records allocation provenance in smriti_identity_allocation_logs.

        Returns: (technical_id, identity_code)
        """
        tech_id = cls.generate_technical_id()
        code = await IdentityCodeGenerator.allocate_identity_code(
            session=session,
            entity_type=entity_type,
            group_code=group_code,
            tenant_id=tenant_id,
            company_id=company_id,
            branch_id=branch_id,
            financial_year=financial_year,
            canonical_id=tech_id,
            purpose=purpose,
            correlation_id=correlation_id,
        )
        return tech_id, code

    @classmethod
    async def allocate_internal(
        cls,
        session: AsyncSession,
        entity_type: str,
        group_code: Optional[str] = None,
        tenant_id: Optional[str] = None,
        company_id: Optional[str] = None,
        branch_id: Optional[str] = None,
        financial_year: Optional[str] = None,
        purpose: str = "ENTITY_CREATION",
        correlation_id: Optional[str] = None,
    ) -> Tuple[str, str]:
        """
        Internal entity creation identity allocation.
        Allocates canonical UUIDv7 technical ID and governed identity_code.
        Enforces that services obtain identities strictly via IdentityEngine.
        """
        return await cls.generate_identity(
            session=session,
            entity_type=entity_type,
            group_code=group_code,
            tenant_id=tenant_id,
            company_id=company_id,
            branch_id=branch_id,
            financial_year=financial_year,
            purpose=purpose,
            correlation_id=correlation_id,
        )

    @staticmethod
    async def validate_code(session: AsyncSession, identity_code: str) -> bool:
        """Validate human-friendly identity code format, registered entity, and group."""
        return await IdentityValidator.validate_identity_code(session, identity_code)

    @staticmethod
    def validate_uuid(technical_id: str) -> bool:
        """Validate technical UUIDv7 format and version."""
        return IdentityValidator.validate_technical_id(technical_id)

    @staticmethod
    async def resolve_identifier(
        session: AsyncSession,
        identifier: str,
        entity_type_hint: Optional[str] = None,
        tenant_id: Optional[str] = None,
        company_id: Optional[str] = None,
        branch_id: Optional[str] = None,
    ) -> IdentityResolutionResult:
        """Universal multi-tier identifier resolution with tenant isolation."""
        return await IdentityResolver.resolve(
            session=session,
            identifier=identifier,
            entity_type_hint=entity_type_hint,
            tenant_id=tenant_id,
            company_id=company_id,
            branch_id=branch_id,
        )
