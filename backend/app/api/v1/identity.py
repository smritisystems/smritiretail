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

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...api.deps import get_db, get_current_user, get_tenant_context, TenantContext, require_role
from ...models.auth import User, UserRole
from ...models.identity_registry import SmritiIdentityRegistry, SmritiNumberingRegistry
from ...schemas.identity import (
    IdentityRegistryResponse,
    NumberingRegistryResponse,
    IdentityAllocateRequest,
    IdentityAllocateResponse,
    IdentityResolveRequest,
    IdentityResolveResponse,
    IdentityValidateRequest,
    IdentityValidateResponse,
)
from ...services.identity import (
    IdentityEngine,
    IdentityValidator,
)

router = APIRouter()


@router.get(
    "/registry",
    response_model=List[IdentityRegistryResponse],
    summary="List all registered platform entity types and identity governance rules",
)
async def list_registered_entities(
    group: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user),
):
    stmt = select(SmritiIdentityRegistry).where(SmritiIdentityRegistry.status == "ACTIVE")
    if group:
        stmt = stmt.where(SmritiIdentityRegistry.group_code == group.strip().upper())
    stmt = stmt.order_by(SmritiIdentityRegistry.group_code, SmritiIdentityRegistry.entity_type)
    res = await db.execute(stmt)
    return res.scalars().all()


@router.get(
    "/registry/{entity_type}",
    response_model=IdentityRegistryResponse,
    summary="Get identity governance rules for a specific entity type",
)
async def get_entity_registry(
    entity_type: str,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user),
):
    stmt = select(SmritiIdentityRegistry).where(
        SmritiIdentityRegistry.entity_type == entity_type.strip().upper(),
        SmritiIdentityRegistry.status == "ACTIVE",
    )
    res = await db.execute(stmt)
    record = res.scalars().first()
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Entity type '{entity_type}' is not registered in SMRITI Identity Control Plane.",
        )
    return record


@router.post(
    "/allocate",
    response_model=IdentityAllocateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Administrative / preview identity allocation (Entity creation occurs in domain services)",
    dependencies=[Depends(require_role(UserRole.SYSADMIN, UserRole.MANAGER))],
)
async def allocate_identity(
    req: IdentityAllocateRequest,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user),
):
    """
    Administrative allocation endpoint.
    Production entity creation should call IdentityEngine internally within domain transactions.
    """
    scope = req.scope
    cid = (scope.company_id if scope else None) or getattr(tenant_ctx, "company_id", None)
    bid = (scope.branch_id if scope else None) or getattr(tenant_ctx, "branch_id", None)
    tid = (scope.tenant_id if scope else None) or getattr(tenant_ctx, "tenant_id", None)
    fy = (scope.financial_year if scope else None)

    tech_id, code = await IdentityEngine.generate_identity(
        session=db,
        entity_type=req.entity_type,
        group_code=req.group_code,
        tenant_id=tid,
        company_id=cid,
        branch_id=bid,
        financial_year=fy,
        purpose=req.purpose,
        correlation_id=req.correlation_id,
    )
    await db.commit()

    group_code = code.split("-")[0] if "-" in code else "SYS"

    return IdentityAllocateResponse(
        technical_id=tech_id,
        identity_code=code,
        entity_type=req.entity_type.upper(),
        group_code=group_code,
        purpose=req.purpose,
    )


@router.post(
    "/resolve",
    response_model=IdentityResolveResponse,
    summary="Universal multi-tier identifier resolution with tenant isolation",
)
async def resolve_identifier(
    req: IdentityResolveRequest,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user),
):
    cid = req.company_id or getattr(tenant_ctx, "company_id", None)
    bid = req.branch_id or getattr(tenant_ctx, "branch_id", None)
    tid = getattr(tenant_ctx, "tenant_id", None)

    result = await IdentityEngine.resolve_identifier(
        session=db,
        identifier=req.identifier,
        entity_type_hint=req.entity_type_hint,
        tenant_id=tid,
        company_id=cid,
        branch_id=bid,
    )
    return IdentityResolveResponse(**result.to_dict())


@router.post(
    "/validate",
    response_model=IdentityValidateResponse,
    summary="Validate an identity code syntax and registry governance",
)
async def validate_identity_code(
    req: IdentityValidateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    is_valid = await IdentityEngine.validate_code(db, req.identity_code)
    parsed = IdentityValidator.parse_identity_code(req.identity_code)
    if is_valid and parsed:
        return IdentityValidateResponse(
            is_valid=True,
            identity_group=parsed["identity_group"],
            entity_code=parsed["entity_code"],
            sequence_number=parsed["sequence_number"],
            canonical_code=parsed["canonical_code"],
        )
    return IdentityValidateResponse(is_valid=False)


@router.get(
    "/numbering",
    response_model=List[NumberingRegistryResponse],
    summary="List active sequential numbering series counters",
)
async def list_numbering_series(
    group: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user),
):
    stmt = select(SmritiNumberingRegistry).where(SmritiNumberingRegistry.status == "ACTIVE")
    if group:
        stmt = stmt.where(SmritiNumberingRegistry.group_code == group.strip().upper())
    stmt = stmt.order_by(SmritiNumberingRegistry.group_code, SmritiNumberingRegistry.entity_type)
    res = await db.execute(stmt)
    return res.scalars().all()
