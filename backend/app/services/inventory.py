"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.8.0
Created      : 2026-07-11
Modified     : 2026-07-11
Copyright    : Â© SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException
from ..models.inventory import Product, StockMovement
from ..schemas.inventory import ProductCreate
from ..api.deps import TenantContext

class InventoryService:
    def __init__(self, db: AsyncSession, tenant_ctx: TenantContext):
        self.db = db
        self.tenant_ctx = tenant_ctx

    async def update_stock(
        self, 
        product_id: str, 
        quantity: float, 
        movement_type: str, 
        reference_doc_type: str, 
        reference_doc_id: str, 
        remarks: Optional[str] = None,
        unit_cost: Optional[float] = None,
        source_module: str = "inventory"
    ):
        """
        Centralized method to update product stock and record the movement.
        movement_type: 'IN', 'OUT', 'ADJUSTMENT', 'TRANSFER'
        """
        stmt = select(Product).filter(
            Product.id == product_id,
            Product.is_deleted == False,
            Product.company_id == self.tenant_ctx.company_id,
            Product.branch_id == self.tenant_ctx.branch_id
        )
        res = await self.db.execute(stmt)
        product = res.scalars().first()
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")

        if product.tracking_mode == "No-stock":
            return

        # Update product stock
        if movement_type == "IN":
            product.stock += int(quantity)
        elif movement_type == "OUT":
            product.stock -= int(quantity)
        elif movement_type == "ADJUSTMENT":
            product.stock += int(quantity) # Quantity can be negative for adjustments
        
        self.db.add(product)

        # Create StockMovement record
        movement = StockMovement(
            product_id=product.id,
            product_name=product.name,
            sku=product.sku or "",
            quantity=quantity,
            movement_type=movement_type,
            reference_doc_type=reference_doc_type,
            reference_doc_id=reference_doc_id,
            unit_cost=unit_cost,
            remarks=remarks,
            branch=self.tenant_ctx.branch_id,
            source_module=source_module,
            company_id=self.tenant_ctx.company_id,
            branch_id=self.tenant_ctx.branch_id,
        )
        self.db.add(movement)

    async def create_product(self, product_in: ProductCreate) -> Product:

        # Check for duplicate code
        existing_code = await self.db.execute(
            select(Product).filter(
                Product.code == product_in.code,
                Product.is_deleted == False,
                Product.company_id == self.tenant_ctx.company_id,
                Product.branch_id == self.tenant_ctx.branch_id
            )
        )
        if existing_code.scalars().first():
            raise HTTPException(status_code=400, detail="Product with this code already exists")

        # Check for duplicate barcode
        existing_barcode = await self.db.execute(
            select(Product).filter(
                Product.barcode == product_in.barcode,
                Product.is_deleted == False,
                Product.company_id == self.tenant_ctx.company_id,
                Product.branch_id == self.tenant_ctx.branch_id
            )
        )
        if existing_barcode.scalars().first():
            raise HTTPException(status_code=400, detail="Product with this barcode already exists")

        db_product = Product(
            **product_in.model_dump(),
            company_id=self.tenant_ctx.company_id,
            branch_id=self.tenant_ctx.branch_id
        )
        self.db.add(db_product)
        try:
            await self.db.commit()
        except IntegrityError:
            await self.db.rollback()
            raise HTTPException(
                status_code=400,
                detail="Product with this code or barcode already exists"
            )
        await self.db.refresh(db_product)
        return db_product

    async def check_stock_availability(self, product_id: str, quantity: float) -> bool:
        stmt = select(Product).filter(
            (Product.id == product_id) | (Product.code == product_id),
            Product.is_deleted == False,
            Product.company_id == self.tenant_ctx.company_id,
            Product.branch_id == self.tenant_ctx.branch_id
        )
        res = await self.db.execute(stmt)
        product = res.scalars().first()
        if not product:
            raise HTTPException(status_code=404, detail=f"Product '{product_id}' not found")
        
        # If tracking mode is No-stock, then stock is infinite
        if product.tracking_mode == "No-stock":
            return True
            
        if product.stock < quantity:
            return False
        return True

    async def transfer_stock(
        self,
        product_id: str,
        from_warehouse: str,
        to_warehouse: str,
        quantity: float,
        remarks: Optional[str] = None
    ) -> StockMovement:
        """
        Inter-warehouse stock transfer method.
        Records StockMovement and emits Transactional Outbox event.
        """
        stmt = select(Product).filter(
            Product.id == product_id,
            Product.is_deleted == False,
            Product.company_id == self.tenant_ctx.company_id,
            Product.branch_id == self.tenant_ctx.branch_id
        )
        res = await self.db.execute(stmt)
        product = res.scalars().first()
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")

        if product.tracking_mode != "No-stock" and product.stock < quantity:
            raise HTTPException(status_code=400, detail="Insufficient stock for transfer")

        import uuid
        from datetime import datetime, timezone
        movement_id = f"SM-TR-{int(datetime.now(timezone.utc).timestamp())}-{uuid.uuid4().hex[:6]}"
        movement = StockMovement(
            id=movement_id,
            product_id=product.id,
            product_name=product.name,
            sku=product.sku or "",
            quantity=quantity,
            movement_type="TRANSFER",
            reference_doc_type="Stock Transfer",
            reference_doc_id=movement_id,
            warehouse=f"{from_warehouse} -> {to_warehouse}",
            remarks=remarks or f"Transfer from {from_warehouse} to {to_warehouse}",
            branch=self.tenant_ctx.branch_id,
            source_module="Inventory",
            company_id=self.tenant_ctx.company_id,
            branch_id=self.tenant_ctx.branch_id,
        )
        self.db.add(movement)

        # Record Transactional Outbox event atomically
        from .outbox_service import OutboxService
        await OutboxService.record_event(
            session=self.db,
            target_channel="PSV_QUEUE",
            payload={
                "action": "STOCK_TRANSFERRED",
                "product_id": product.id,
                "sku": product.sku,
                "from_warehouse": from_warehouse,
                "to_warehouse": to_warehouse,
                "quantity": str(quantity),
                "company_code": self.tenant_ctx.company_id
            },
            causation_id=movement_id
        )

        await self.db.commit()
        await self.db.refresh(movement)
        return movement

    async def adjust_stock(
        self,
        product_id: str,
        new_quantity: float,
        reason: Optional[str] = None
    ) -> StockMovement:
        """
        Stock reconciliation & physical audit adjustment method.
        Computes delta, updates product.stock, records StockMovement and emits Outbox event.
        """
        stmt = select(Product).filter(
            Product.id == product_id,
            Product.is_deleted == False,
            Product.company_id == self.tenant_ctx.company_id,
            Product.branch_id == self.tenant_ctx.branch_id
        )
        res = await self.db.execute(stmt)
        product = res.scalars().first()
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")

        delta = new_quantity - float(product.stock)
        product.stock = int(new_quantity)
        self.db.add(product)

        import uuid
        from datetime import datetime, timezone
        movement_id = f"SM-ADJ-{int(datetime.now(timezone.utc).timestamp())}-{uuid.uuid4().hex[:6]}"
        movement = StockMovement(
            id=movement_id,
            product_id=product.id,
            product_name=product.name,
            sku=product.sku or "",
            quantity=delta,
            movement_type="ADJUSTMENT",
            reference_doc_type="Stock Adjustment",
            reference_doc_id=movement_id,
            remarks=reason or "Physical audit inventory adjustment",
            branch=self.tenant_ctx.branch_id,
            source_module="Inventory",
            company_id=self.tenant_ctx.company_id,
            branch_id=self.tenant_ctx.branch_id,
        )
        self.db.add(movement)

        # Record Transactional Outbox event atomically
        from .outbox_service import OutboxService
        await OutboxService.record_event(
            session=self.db,
            target_channel="PSV_QUEUE",
            payload={
                "action": "STOCK_ADJUSTED",
                "product_id": product.id,
                "sku": product.sku,
                "adjusted_quantity": str(delta),
                "new_stock": str(new_quantity),
                "reason": reason,
                "company_code": self.tenant_ctx.company_id
            },
            causation_id=movement_id
        )

        await self.db.commit()
        await self.db.refresh(movement)
        return movement


