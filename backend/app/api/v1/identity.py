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
    IdentityEnvelopeResponse,
    IdentityBatchResolveRequest,
    IdentityBatchResolveResponse,
    IdentitySearchRequest,
    IdentitySearchResponse,
    IdentitySearchItem,
    IdentityCacheStatsResponse,
)
from ...services.identity import (
    IdentityEngine,
    IdentityValidator,
)
from ...services.identity.cache import get_identity_cache

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


@router.post(
    "/resolve-batch",
    response_model=IdentityBatchResolveResponse,
    summary="Batch resolve up to 100 identifiers across architectural tiers",
)
async def resolve_batch_identifiers(
    req: IdentityBatchResolveRequest,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user),
):
    cid = req.company_id or getattr(tenant_ctx, "company_id", None)
    bid = req.branch_id or getattr(tenant_ctx, "branch_id", None)
    tid = getattr(tenant_ctx, "tenant_id", None)

    batch_map = await IdentityEngine.resolve_batch(
        session=db,
        identifiers=req.identifiers,
        entity_type_hint=req.entity_type_hint,
        tenant_id=tid,
        company_id=cid,
        branch_id=bid,
        use_cache=req.use_cache,
    )

    serialized_results = {
        k: IdentityResolveResponse(**v.to_dict()) for k, v in batch_map.items()
    }
    resolved_count = sum(1 for v in batch_map.values() if v.found)

    return IdentityBatchResolveResponse(
        results=serialized_results,
        total_requested=len(req.identifiers),
        total_resolved=resolved_count,
    )


@router.get(
    "/envelope/{identifier}",
    response_model=IdentityEnvelopeResponse,
    summary="Hydrate full Identity Envelope with active aliases, audit trail, and UI deep link",
)
async def get_identity_envelope(
    identifier: str,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user),
):
    cid = getattr(tenant_ctx, "company_id", None)
    tid = getattr(tenant_ctx, "tenant_id", None)

    envelope = await IdentityEngine.get_identity_envelope(
        session=db,
        identifier=identifier,
        company_id=cid,
        tenant_id=tid,
    )
    if not envelope:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Identifier '{identifier}' could not be resolved to a canonical entity.",
        )
    return IdentityEnvelopeResponse(**envelope)


@router.post(
    "/search",
    response_model=IdentitySearchResponse,
    summary="Omnichannel cross-domain entity discovery matching across codes and aliases",
)
async def search_entities(
    req: IdentitySearchRequest,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user),
):
    cid = req.company_id or getattr(tenant_ctx, "company_id", None)

    raw_matches = await IdentityEngine.search_entities(
        session=db,
        query=req.query,
        entity_types=req.entity_types,
        company_id=cid,
        limit=req.limit,
    )

    items = [IdentitySearchItem(**m) for m in raw_matches]
    return IdentitySearchResponse(
        query=req.query,
        total_matches=len(items),
        matches=items,
    )


@router.get(
    "/cache/stats",
    response_model=IdentityCacheStatsResponse,
    summary="Get in-memory resolution cache diagnostic and telemetry metrics",
    dependencies=[Depends(require_role(UserRole.SYSADMIN, UserRole.MANAGER))],
)
async def get_cache_stats(
    current_user: User = Depends(get_current_user),
):
    stats = await get_identity_cache().get_stats()
    return IdentityCacheStatsResponse(**stats)

