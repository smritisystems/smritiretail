"""
Inventory State Engine endpoints.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ...api.deps import TenantContext, get_db, get_tenant_context
from ...services.inventory_state import InventoryStateService

router = APIRouter()


@router.get(
    "/product/{product_id}",
    summary="Get canonical inventory state snapshot for a product",
)
async def get_inventory_state_for_product(
    product_id: str,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    svc = InventoryStateService(db, tenant_ctx)
    return await svc.get_product_state(product_id)


@router.get(
    "/availability/{product_id}",
    summary="Check whether a requested quantity can be fulfilled",
)
async def check_inventory_availability(
    product_id: str,
    quantity: float = Query(..., gt=0),
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    svc = InventoryStateService(db, tenant_ctx)
    return await svc.can_fulfill(product_id, quantity)
