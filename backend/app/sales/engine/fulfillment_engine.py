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
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.sales import (
    SalesOrder, SalesOrderItem,
    FulfillmentWave, PickList, PickListItem, ShipmentPackage
)
from app.models.inventory import Product
from app.api.deps import TenantContext


class FulfillmentEngine:
    """
    FulfillmentEngine — Domain service for Outbound Sales Order stock reservation,
    warehouse wave pick list generation, shipment packing, and dispatch inventory deduction.
    """

    def __init__(self, db: AsyncSession, tenant: TenantContext):
        self.db = db
        self.tenant = tenant

    async def confirm_sales_order(self, order_id: str) -> SalesOrder:
        """
        Confirms a Draft SalesOrder, reserving inventory stock on each line item.
        Prevents overselling if available stock is insufficient.
        """
        # 1. Fetch SalesOrder
        stmt = select(SalesOrder).where(
            SalesOrder.id == order_id,
            SalesOrder.company_id == self.tenant.company_id,
            SalesOrder.is_deleted == False
        )
        order = (await self.db.execute(stmt)).scalars().first()
        if not order:
            raise HTTPException(status_code=404, detail=f"Sales Order '{order_id}' not found")

        if order.status not in ("Draft", "Submitted"):
            raise HTTPException(status_code=400, detail=f"Cannot confirm sales order in status '{order.status}'. Must be 'Draft'.")

        l_stmt = select(SalesOrderItem).where(SalesOrderItem.order_id == order.id)
        items = list((await self.db.execute(l_stmt)).scalars().all())
        if not items:
            raise HTTPException(status_code=400, detail="Sales Order has no line items to confirm")

        # 2. Verify and reserve stock for each item
        for item in items:
            p_stmt = select(Product).where(Product.id == item.product_id)
            product = (await self.db.execute(p_stmt)).scalars().first()
            if not product:
                raise HTTPException(status_code=404, detail=f"Product '{item.product_id}' not found")

            stock_avail = Decimal(str(product.stock)) - Decimal(str(getattr(product, "reserved_stock", 0)))
            qty_req = Decimal(str(item.ordered_quantity))

            if qty_req > stock_avail:
                raise HTTPException(
                    status_code=400,
                    detail=f"Insufficient available stock for product '{product.name}'. Available: {stock_avail}, Requested: {qty_req}"
                )

            # Update reservations
            item.reserved_quantity = qty_req
            if hasattr(product, "reserved_stock"):
                product.reserved_stock = Decimal(str(product.reserved_stock)) + qty_req
            self.db.add(item)
            self.db.add(product)

        order.status = "Confirmed"
        order.fulfillment_status = "Allocated"
        self.db.add(order)

        order.items = items
        await self.db.commit()
        return order

    async def generate_fulfillment_wave(self, order_ids: List[str]) -> FulfillmentWave:
        """
        Consolidates multiple Confirmed SalesOrders into a single warehouse FulfillmentWave and PickList.
        """
        if not order_ids:
            raise HTTPException(status_code=400, detail="No order IDs provided for wave generation")

        stmt = select(SalesOrder).where(
            SalesOrder.id.in_(order_ids),
            SalesOrder.company_id == self.tenant.company_id,
            SalesOrder.is_deleted == False
        )
        orders = list((await self.db.execute(stmt)).scalars().all())

        for order in orders:
            if order.status != "Confirmed":
                raise HTTPException(status_code=400, detail=f"Sales Order '{order.order_no}' must be 'Confirmed' before wave picking")

        wave_id = f"wave-{uuid.uuid4().hex[:10]}"
        wave_no = f"WAVE-{uuid.uuid4().hex[:6].upper()}"

        pick_list_id = f"pkl-{uuid.uuid4().hex[:10]}"
        pick_list_no = f"PKL-{wave_no}"

        pick_items = []
        tot_items_count = 0

        for order in orders:
            order.fulfillment_status = "Picking"
            self.db.add(order)

            l_stmt = select(SalesOrderItem).where(SalesOrderItem.order_id == order.id)
            o_items = list((await self.db.execute(l_stmt)).scalars().all())

            for o_item in o_items:
                tot_items_count += 1
                p_item = PickListItem(
                    id=f"pkli-{uuid.uuid4().hex[:12]}",
                    uuid=str(uuid.uuid4()),
                    company_id=self.tenant.company_id,
                    branch_id=self.tenant.branch_id,
                    pick_list_id=pick_list_id,
                    order_id=order.id,
                    product_id=o_item.product_id,
                    quantity_to_pick=o_item.reserved_quantity,
                    quantity_picked=Decimal("0.00"),
                    status="Pending"
                )
                pick_items.append(p_item)

        wave = FulfillmentWave(
            id=wave_id,
            uuid=str(uuid.uuid4()),
            tenant_id=getattr(self.tenant, "tenant_id", None) or self.tenant.company_id,
            company_id=self.tenant.company_id,
            branch_id=self.tenant.branch_id,
            wave_no=wave_no,
            status="Created",
            total_orders=len(orders),
            total_items=tot_items_count
        )

        pick_list = PickList(
            id=pick_list_id,
            uuid=str(uuid.uuid4()),
            tenant_id=getattr(self.tenant, "tenant_id", None) or self.tenant.company_id,
            company_id=self.tenant.company_id,
            branch_id=self.tenant.branch_id,
            pick_list_no=pick_list_no,
            wave_id=wave_id,
            status="Pending"
        )

        pick_list.items = pick_items
        wave.pick_lists = [pick_list]

        self.db.add(wave)
        self.db.add(pick_list)
        self.db.add_all(pick_items)

        await self.db.commit()
        return wave

    async def pack_shipment(
        self,
        order_id: str,
        wave_id: Optional[str] = None,
        carrier: Optional[str] = "Standard Express",
        tracking_no: Optional[str] = None,
        weight_kg: Decimal = Decimal("1.500"),
        shipping_cost: Decimal = Decimal("50.00")
    ) -> ShipmentPackage:
        """
        Creates a packed ShipmentPackage for a SalesOrder.
        """
        stmt = select(SalesOrder).where(
            SalesOrder.id == order_id,
            SalesOrder.company_id == self.tenant.company_id
        )
        order = (await self.db.execute(stmt)).scalars().first()
        if not order:
            raise HTTPException(status_code=404, detail=f"Sales Order '{order_id}' not found")

        pkg_id = f"pkg-{uuid.uuid4().hex[:10]}"
        package_no = f"PKG-{order.order_no}-{uuid.uuid4().hex[:4].upper()}"

        package = ShipmentPackage(
            id=pkg_id,
            uuid=str(uuid.uuid4()),
            tenant_id=getattr(self.tenant, "tenant_id", None) or self.tenant.company_id,
            company_id=self.tenant.company_id,
            branch_id=self.tenant.branch_id,
            package_no=package_no,
            order_id=order.id,
            wave_id=wave_id,
            carrier=carrier,
            tracking_no=tracking_no or f"TRK-{uuid.uuid4().hex[:8].upper()}",
            weight_kg=weight_kg,
            shipping_cost=shipping_cost,
            status="PACKED"
        )

        order.fulfillment_status = "Packed"
        self.db.add(order)
        self.db.add(package)

        await self.db.commit()
        await self.db.refresh(package)
        return package

    async def dispatch_shipment(self, package_id: str) -> ShipmentPackage:
        """
        Dispatches a packed ShipmentPackage, deducting inventory stock and updating order status to Shipped.
        """
        stmt = select(ShipmentPackage).where(
            ShipmentPackage.id == package_id,
            ShipmentPackage.company_id == self.tenant.company_id
        )
        package = (await self.db.execute(stmt)).scalars().first()
        if not package:
            raise HTTPException(status_code=404, detail=f"Shipment Package '{package_id}' not found")

        if package.status == "SHIPPED":
            raise HTTPException(status_code=400, detail="Package is already shipped")

        # Fetch linked order and lines
        o_stmt = select(SalesOrder).where(SalesOrder.id == package.order_id)
        order = (await self.db.execute(o_stmt)).scalars().first()
        if not order:
            raise HTTPException(status_code=404, detail="Linked Sales Order not found")

        l_stmt = select(SalesOrderItem).where(SalesOrderItem.order_id == order.id)
        items = list((await self.db.execute(l_stmt)).scalars().all())

        # Deduct stock for each line item
        for item in items:
            p_stmt = select(Product).where(Product.id == item.product_id)
            product = (await self.db.execute(p_stmt)).scalars().first()
            if product:
                qty_ordered = int(Decimal(str(item.ordered_quantity)))
                qty_reserved = Decimal(str(item.reserved_quantity))

                product.stock = max(0, product.stock - qty_ordered)
                if hasattr(product, "reserved_stock"):
                    product.reserved_stock = max(Decimal("0.00"), Decimal(str(product.reserved_stock)) - qty_reserved)
                self.db.add(product)

        package.status = "SHIPPED"
        package.dispatch_date = datetime.now(timezone.utc)
        order.fulfillment_status = "Shipped"
        order.status = "Shipped"

        self.db.add(package)
        self.db.add(order)

        await self.db.commit()
        await self.db.refresh(package)
        return package
