"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.22.0
Created      : 2026-08-23
Modified     : 2026-08-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from typing import Dict, Any, List, Optional
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from ...api.deps import get_company_db, get_current_user
from ...services.distribution_service import DistributionService
from ...services.pricing_engine import PricingEngine

router = APIRouter()


class TerritoryCreateReq(BaseModel):
    code: str
    name: str
    region: str = "WEST"
    parent_code: Optional[str] = None


class DealerAssignReq(BaseModel):
    party_id: str
    territory_code: str
    salesman_id: Optional[str] = None
    credit_limit: float = 500000.0
    credit_days: int = 30


class OrderLineReq(BaseModel):
    item_id: str
    variant_id: Optional[str] = None
    quantity: float = 1.0


class DistributionOrderCreateReq(BaseModel):
    party_id: str
    order_type: str = "PRIMARY"
    territory_code: Optional[str] = None
    salesman_id: Optional[str] = None
    delivery_route: Optional[str] = None
    line_items: List[OrderLineReq]
    supplier_state: str = "27"
    recipient_state: str = "27"
    price_book_code: Optional[str] = None


@router.post("/territories", summary="Create or register distribution territory")
async def create_territory(
    req: TerritoryCreateReq,
    db: AsyncSession = Depends(get_company_db),
    current_user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """Registers a geographic distribution territory."""
    terr = await DistributionService.create_territory(
        session=db,
        code=req.code,
        name=req.name,
        region=req.region,
        parent_code=req.parent_code
    )
    await db.commit()
    return {
        "status": "SUCCESS",
        "territory": {
            "id": terr.id,
            "code": terr.code,
            "name": terr.name,
            "region": terr.region
        }
    }


@router.post("/dealers/assign", summary="Assign dealer to territory")
async def assign_dealer(
    req: DealerAssignReq,
    db: AsyncSession = Depends(get_company_db),
    current_user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """Assigns a dealer or distributor party to a territory with credit limits."""
    assignment = await DistributionService.assign_dealer(
        session=db,
        party_id=req.party_id,
        territory_code=req.territory_code,
        salesman_id=req.salesman_id,
        credit_limit=Decimal(str(req.credit_limit)),
        credit_days=req.credit_days
    )
    await db.commit()
    return {
        "status": "SUCCESS",
        "assignment_id": assignment.id,
        "party_id": assignment.party_id,
        "territory_code": assignment.territory_code,
        "credit_limit": float(assignment.credit_limit)
    }


@router.post("/orders", summary="Create distribution order with pricing and GST evaluation")
async def create_distribution_order(
    req: DistributionOrderCreateReq,
    db: AsyncSession = Depends(get_company_db),
    current_user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """Creates a Primary or Secondary distribution order with rule snapshots."""
    lines_data = [line.model_dump() for line in req.line_items]
    try:
        order = await DistributionService.create_distribution_order(
            session=db,
            party_id=req.party_id,
            order_type=req.order_type,
            territory_code=req.territory_code,
            salesman_id=req.salesman_id,
            delivery_route=req.delivery_route,
            line_items_data=lines_data,
            supplier_state=req.supplier_state,
            recipient_state=req.recipient_state,
            price_book_code=req.price_book_code
        )
        await db.commit()
        return {
            "status": "SUCCESS",
            "order_id": order.id,
            "order_no": order.order_no,
            "taxable_amount": float(order.taxable_amount),
            "tax_total": float(order.tax_total),
            "grand_total": float(order.grand_total),
            "governance_snapshot_id": order.governance_snapshot_id,
            "lines_count": len(order.lines)
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/orders/{order_id}/dispatch", summary="Dispatch distribution order and record stock movement")
async def dispatch_distribution_order(
    order_id: str,
    delivery_challan_no: Optional[str] = None,
    db: AsyncSession = Depends(get_company_db),
    current_user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """Dispatches order and posts authoritative outward stock movements."""
    try:
        order = await DistributionService.dispatch_distribution_order(
            session=db,
            order_id=order_id,
            delivery_challan_no=delivery_challan_no
        )
        await db.commit()
        return {
            "status": "SUCCESS",
            "order_no": order.order_no,
            "order_status": order.status,
            "delivery_challan_no": order.delivery_challan_no
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
