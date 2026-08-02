"""Reservation engine API."""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from ...api.deps import TenantContext, get_db, get_tenant_context
from ...services.inventory_reservation import InventoryReservationService

router = APIRouter()


class ReserveInventoryPayload(BaseModel):
    product_id: str
    qty: float
    reservation_type: str = "SO"
    reservation_id: str


@router.post(
    "/reserve",
    summary="Reserve available inventory for a sales or operational hold",
)
async def reserve_inventory(
    payload: ReserveInventoryPayload,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    svc = InventoryReservationService(db, tenant_ctx)
    return await svc.reserve(
        product_id=payload.product_id,
        qty=payload.qty,
        reservation_type=payload.reservation_type,
        reservation_id=payload.reservation_id,
    )
