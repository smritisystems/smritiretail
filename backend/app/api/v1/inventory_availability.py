"""
Author & Creator:
Jawahar Ramkripal Mallah

Founder:
SmritiSys
AITDL Networks

Role:
Chief Systems Architect

Web:
smritisys.com | smritibooks.com | aitdl.com

Email:
jawahar.mallah@gmail.com

Copyright © 2026 SmritiSys.
All Rights Reserved.
"""

"""Availability engine API."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ...api.deps import TenantContext, get_db, get_tenant_context
from ...services.inventory_availability import InventoryAvailabilityService

router = APIRouter()


@router.get(
    "/check",
    summary="Check whether a product can be fulfilled for a requested quantity",
)
async def check_inventory_availability(
    product_id: str = Query(..., min_length=1),
    qty: float = Query(..., gt=0),
    warehouse_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    svc = InventoryAvailabilityService(db, tenant_ctx)
    return await svc.can_fulfill(product_id=product_id, warehouse_id=warehouse_id, qty=qty)
