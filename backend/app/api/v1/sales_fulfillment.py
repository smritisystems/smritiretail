"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 7.0.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Architecture Standard
"""

import uuid
from decimal import Decimal
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.db.session import get_db
from app.api.deps import TenantContext, get_tenant_context
from app.models.sales import SalesOrder, SalesOrderItem, FulfillmentWave, PickList, PickListItem, ShipmentPackage
from app.models.inventory import Product
from app.models.crm import Customer
from app.schemas.sales_fulfillment import (
    SalesOrderCreate, SalesOrderResponse,
    FulfillmentWaveRequest, FulfillmentWaveResponse,
    PackShipmentRequest, ShipmentPackageResponse
)
from app.sales.engine.fulfillment_engine import FulfillmentEngine

router = APIRouter(prefix="/sales", tags=["Sales Orders & Outbound Fulfillment"])


@router.post("/orders", response_model=SalesOrderResponse, status_code=status.HTTP_201_CREATED)
async def create_sales_order(
    order_in: SalesOrderCreate,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_tenant_context)
):
    """
    Creates a new draft SalesOrder with line items.
    """
    c_stmt = select(Customer).where(Customer.id == order_in.customer_id, Customer.is_deleted == False)
    customer = (await db.execute(c_stmt)).scalars().first()
    if not customer:
        raise HTTPException(status_code=404, detail=f"Customer '{order_in.customer_id}' not found")

    order_id = f"so-{uuid.uuid4().hex[:12]}"
    subtotal = Decimal("0.00")
    tax_total = Decimal("0.00")
    item_objs = []

    for item in order_in.items:
        p_stmt = select(Product).where(Product.id == item.product_id, Product.is_deleted == False)
        product = (await db.execute(p_stmt)).scalars().first()
        if not product:
            raise HTTPException(status_code=404, detail=f"Product '{item.product_id}' not found")

        gst_rate = Decimal(str(product.gst_percentage)) if product.gst_percentage is not None else Decimal("18.00")
        qty = Decimal(str(item.ordered_quantity))
        price = Decimal(str(item.unit_price))

        line_val = (qty * price).quantize(Decimal("0.01"))
        tax_amt = (line_val * gst_rate / Decimal("100.00")).quantize(Decimal("0.01"))
        line_tot = (line_val + tax_amt).quantize(Decimal("0.01"))

        subtotal += line_val
        tax_total += tax_amt

        soi = SalesOrderItem(
            tenant_id=getattr(tenant, "tenant_id", None) or tenant.company_id,
            company_id=tenant.company_id,
            branch_id=tenant.branch_id,
            order_id=order_id,
            product_id=item.product_id,
            ordered_quantity=qty,
            reserved_quantity=Decimal("0.00"),
            unit_price=price,
            line_total=line_tot
        )
        item_objs.append(soi)

    order = SalesOrder(
        id=order_id,
        uuid=str(uuid.uuid4()),
        tenant_id=getattr(tenant, "tenant_id", None) or tenant.company_id,
        company_id=tenant.company_id,
        branch_id=tenant.branch_id,
        order_no=order_in.order_no,
        customer_id=order_in.customer_id,
        subtotal=subtotal.quantize(Decimal("0.01")),
        tax_total=tax_total.quantize(Decimal("0.01")),
        grand_total=(subtotal + tax_total).quantize(Decimal("0.01")),
        status="Draft",
        fulfillment_status="Unfulfilled",
        payment_status="Unpaid",
        notes=order_in.notes
    )

    db.add(order)
    db.add_all(item_objs)
    await db.commit()
    await db.refresh(order)

    order.items = item_objs
    return order


@router.get("/orders", response_model=List[SalesOrderResponse])
async def list_sales_orders(
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_tenant_context)
):
    """
    Lists all SalesOrders for the tenant.
    """
    stmt = select(SalesOrder).where(
        SalesOrder.company_id == tenant.company_id,
        SalesOrder.is_deleted == False
    )
    orders = list((await db.execute(stmt)).scalars().all())
    for o in orders:
        l_stmt = select(SalesOrderItem).where(SalesOrderItem.order_id == o.id)
        o.items = list((await db.execute(l_stmt)).scalars().all())
    return orders


@router.get("/orders/{order_id}", response_model=SalesOrderResponse)
async def get_sales_order(
    order_id: str,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_tenant_context)
):
    """
    Retrieves a SalesOrder by ID.
    """
    stmt = select(SalesOrder).where(
        SalesOrder.id == order_id,
        SalesOrder.company_id == tenant.company_id,
        SalesOrder.is_deleted == False
    )
    order = (await db.execute(stmt)).scalars().first()
    if not order:
        raise HTTPException(status_code=404, detail="Sales Order not found")

    l_stmt = select(SalesOrderItem).where(SalesOrderItem.order_id == order.id)
    order.items = list((await db.execute(l_stmt)).scalars().all())
    return order


@router.post("/orders/{order_id}/confirm", response_model=SalesOrderResponse)
async def confirm_sales_order(
    order_id: str,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_tenant_context)
):
    """
    Confirms a Draft SalesOrder and reserves product stock using FulfillmentEngine.
    """
    engine = FulfillmentEngine(db, tenant)
    return await engine.confirm_sales_order(order_id)


@router.post("/fulfillment/waves", response_model=FulfillmentWaveResponse, status_code=status.HTTP_201_CREATED)
async def create_fulfillment_wave(
    req_body: FulfillmentWaveRequest,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_tenant_context)
):
    """
    Generates a warehouse FulfillmentWave and consolidated PickList for a batch of confirmed SalesOrders.
    """
    engine = FulfillmentEngine(db, tenant)
    return await engine.generate_fulfillment_wave(req_body.order_ids)


@router.post("/fulfillment/pack", response_model=ShipmentPackageResponse, status_code=status.HTTP_201_CREATED)
async def pack_shipment_package(
    req_body: PackShipmentRequest,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_tenant_context)
):
    """
    Creates a packed ShipmentPackage for an order.
    """
    engine = FulfillmentEngine(db, tenant)
    return await engine.pack_shipment(
        order_id=req_body.order_id,
        wave_id=req_body.wave_id,
        carrier=req_body.carrier,
        tracking_no=req_body.tracking_no,
        weight_kg=req_body.weight_kg,
        shipping_cost=req_body.shipping_cost
    )


@router.post("/fulfillment/dispatch/{package_id}", response_model=ShipmentPackageResponse)
async def dispatch_shipment_package(
    package_id: str,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_tenant_context)
):
    """
    Dispatches a packed ShipmentPackage, deducting inventory stock and updating SO status to Shipped.
    """
    engine = FulfillmentEngine(db, tenant)
    return await engine.dispatch_shipment(package_id)
