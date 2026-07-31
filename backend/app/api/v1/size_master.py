"""Tenant-scoped Size Master API used by Item Master and transaction clients."""

from typing import List

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from ...api.deps import TenantContext, get_db, get_tenant_context, require_permission
from ...schemas.size_master import SizeScaleCreate, SizeScaleResponse
from ...services.size_master import SizeMasterService

router = APIRouter()


@router.get(
    "/size-scales",
    response_model=List[SizeScaleResponse],
    dependencies=[Depends(require_permission("ITEM.VIEW"))],
)
async def list_size_scales(
    scale_type: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_tenant_context),
):
    """List approved tenant size scales, optionally filtered by domain type."""
    service = SizeMasterService(db, tenant)
    scales = await service.repo.get_all()
    if scale_type:
        scales = [scale for scale in scales if (scale.scale_type_id or "").lower() == scale_type.lower()]
    return scales


@router.post(
    "/size-scales",
    response_model=SizeScaleResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("ITEM.CREATE"))],
)
async def create_size_scale(
    payload: SizeScaleCreate,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_tenant_context),
):
    """Create a governed size scale through the Item Master permission boundary."""
    return await SizeMasterService(db, tenant).create_size_scale(payload)
