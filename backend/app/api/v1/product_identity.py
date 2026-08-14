"""
Product Identity Engine API router.
"""

from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ...api.deps import get_db, get_current_user, get_tenant_context, require_role, TenantContext
from ...models.auth import UserRole, User
from ...schemas.product_identity import (
    BarcodeProviderCreate, BarcodeProviderResponse, BarcodeProviderUpdate,
    IdentityRuleCreate, IdentityRuleResponse, IdentityRuleUpdate,
    ProductIdentityCreate, ProductIdentityResponse, ProductIdentityUpdate,
)
from ...services.product_identity import ProductIdentityService

router = APIRouter()


@router.get(
    "/providers",
    response_model=List[BarcodeProviderResponse],
)
async def list_providers(
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user),
):
    service = ProductIdentityService(db, tenant_ctx)
    return await service.list_providers()


@router.post(
    "/providers",
    response_model=BarcodeProviderResponse,
    status_code=201,
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def create_provider(
    req: BarcodeProviderCreate,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user),
):
    service = ProductIdentityService(db, tenant_ctx)
    provider = await service.create_provider(req)
    return provider


@router.put(
    "/providers/{id}",
    response_model=BarcodeProviderResponse,
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def update_provider(
    id: str,
    req: BarcodeProviderUpdate,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user),
):
    service = ProductIdentityService(db, tenant_ctx)
    return await service.update_provider(id, req)


@router.get(
    "/rules",
    response_model=List[IdentityRuleResponse],
)
async def list_rules(
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user),
):
    service = ProductIdentityService(db, tenant_ctx)
    return await service.list_rules()


@router.post(
    "/rules",
    response_model=IdentityRuleResponse,
    status_code=201,
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def create_rule(
    req: IdentityRuleCreate,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user),
):
    service = ProductIdentityService(db, tenant_ctx)
    rule = await service.create_rule(req)
    return rule


@router.put(
    "/rules/{id}",
    response_model=IdentityRuleResponse,
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def update_rule(
    id: str,
    req: IdentityRuleUpdate,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user),
):
    service = ProductIdentityService(db, tenant_ctx)
    return await service.update_rule(id, req)


@router.get(
    "/identities",
    response_model=List[ProductIdentityResponse],
)
async def list_identities(
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user),
):
    service = ProductIdentityService(db, tenant_ctx)
    return await service.list_identities()


@router.post(
    "/identities",
    response_model=ProductIdentityResponse,
    status_code=201,
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def create_identity(
    req: ProductIdentityCreate,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user),
):
    service = ProductIdentityService(db, tenant_ctx)
    identity = await service.create_identity(req)
    return identity


@router.get(
    "/identities/{id}",
    response_model=ProductIdentityResponse,
)
async def get_identity(
    id: str,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user),
):
    service = ProductIdentityService(db, tenant_ctx)
    return await service.get_identity(id)


@router.put(
    "/identities/{id}",
    response_model=ProductIdentityResponse,
    dependencies=[Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN))],
)
async def update_identity(
    id: str,
    req: ProductIdentityUpdate,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user),
):
    service = ProductIdentityService(db, tenant_ctx)
    return await service.update_identity(id, req)
