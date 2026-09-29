"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.8.0
Created      : 2026-07-11
Modified     : 2026-07-11
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, and_, or_
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException
import uuid
import re
from ..models.inventory import Product, StockMovement
from ..models.item_master import Item, ItemVariant, ItemBarcode, LegacyIdMapping
from ..models.pricing import PriceBook, PriceBookEntry
from ..schemas.inventory import ProductCreate
from ..api.deps import TenantContext
from .attributes import AttributesService
from .identity.engine import IdentityEngine

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

        # Stock is updated automatically by PostgreSQL trigger trg_inventory_state_reconciliation on StockMovement insert
        self.db.add(product)


        # Create StockMovement record
        movement = StockMovement(
            id=IdentityEngine.generate_technical_id(),
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
        # Multi-Tenant Isolation Enforcement (Blocker 5)
        if not self.tenant_ctx or not self.tenant_ctx.company_id:
            raise HTTPException(status_code=400, detail="Multi-tenant security violation: company_id is required")

        cid = self.tenant_ctx.company_id
        bid = self.tenant_ctx.branch_id or "BR-001"

        await AttributesService(self.db).validate_product_attributes(
            product_in.attributes,
            cid,
        )

        from .catalog_validation import CatalogDimensionValidator
        dim_map = {
            "brand": product_in.brand,
            "category": product_in.category,
            "color": product_in.color,
            "size": product_in.size,
            "style_code": product_in.style_code,
            "vendor_code": product_in.vendor_code,
        }
        for field_name, field_val in dim_map.items():
            if field_val and str(field_val).strip():
                normalized = await CatalogDimensionValidator.validate_and_normalize_dimension(
                    dimension_field=field_name,
                    value=field_val,
                    strict=True,
                )
                setattr(product_in, field_name, normalized)

        auto_gen = bool(getattr(product_in, "auto_generate_article_number", False))
        prod_code = (product_in.code or "").strip().upper()
        if not prod_code and not auto_gen:
            raise HTTPException(status_code=400, detail="Product code / SKU is required")

        if prod_code and prod_code != "AUTO":
            # Check for duplicate code within company/branch
            existing_code = await self.db.execute(
                select(Product).filter(
                    Product.code == prod_code,
                    Product.is_deleted == False,
                    Product.company_id == cid,
                    Product.branch_id == bid
                )
            )
            if existing_code.scalars().first():
                raise HTTPException(status_code=400, detail="Product with this code already exists")

        # Determine canonical Article / Style Code
        style = (product_in.style_code or "").strip().upper()
        article_code = style if style else (None if auto_gen else prod_code)

        # Build canonical ItemCreateRequest delegating to UniversalItemMasterService (Requirement 3)
        from ..schemas.item_master import ItemCreateRequest, ItemVariantItem, ItemBarcodeItem
        from .item_master_svc import UniversalItemMasterService

        barcodes = []
        if product_in.barcode and str(product_in.barcode).strip():
            clean_bc = str(product_in.barcode).strip().upper()
            bc_type = "EAN13" if len(clean_bc) == 13 and clean_bc.isdigit() else "CODE128_INTERNAL"
            barcodes.append(ItemBarcodeItem(barcode=clean_bc, barcode_type=bc_type, is_primary=True))

        variant_item = ItemVariantItem(
            variant_sku=prod_code,
            variant_name=product_in.name,
            size=product_in.size,
            color=product_in.color,
            mrp=float(product_in.mrp or 0.0),
            selling_price=float(product_in.price or 0.0),
            cost_price=float(product_in.cost_price or 0.0),
            is_active=True,
            barcodes=barcodes,
            attributes_json=product_in.attributes or {}
        )

        auto_gen = bool(getattr(product_in, "auto_generate_article_number", False))
        sup_payload = getattr(product_in, "supplier", None) or (product_in.attributes.get("supplier") if product_in.attributes else None)

        item_req = ItemCreateRequest(
            item_code=None if auto_gen else article_code,
            item_name=product_in.name,
            category=getattr(product_in, "category", None) or "Footwear",
            category_code=getattr(product_in, "category_code", None),
            brand=getattr(product_in, "brand", None),
            style_code=style or (None if auto_gen else article_code),
            color=getattr(product_in, "color", None),
            size=getattr(product_in, "size", None),
            vendor_code=getattr(product_in, "vendor_code", None),
            hsn_code=getattr(product_in, "hsn_code", None) or "64041990",
            tax_rate=float(getattr(product_in, "gst_percentage", None) or 18.0),
            primary_uom=getattr(product_in, "uom", None) or "PCS",
            mrp=float(getattr(product_in, "mrp", None) or 0.0),
            selling_price=float(getattr(product_in, "price", None) or 0.0),
            cost_price=float(getattr(product_in, "cost_price", None) or 0.0),
            buying_price=float(product_in.buying_price) if getattr(product_in, "buying_price", None) is not None else None,
            is_batch_tracked=bool(getattr(product_in, "is_batch_tracked", False)),
            is_serial_tracked=bool(getattr(product_in, "is_serial_tracked", False)),
            attributes_json=getattr(product_in, "attributes", None) or {},
            variants=[variant_item],
            auto_generate_article_number=auto_gen,
            supplier=sup_payload
        )

        canonical_item = await UniversalItemMasterService.create_item(
            session=self.db,
            req=item_req,
            company_id=cid,
            branch_id=bid,
            commit=True
        )

        # Retrieve the synchronized Product record representing this variant
        prod_stmt = select(Product).where(
            Product.company_id == cid,
            Product.code == prod_code,
            Product.is_deleted == False
        )
        prod = (await self.db.execute(prod_stmt)).scalars().first()
        if not prod:
            fallback_conditions = [Product.sku == prod_code]
            if product_in.color and product_in.size:
                fallback_conditions.append(
                    and_(
                        Product.item_id == canonical_item.id,
                        func.lower(Product.color) == str(product_in.color).strip().lower(),
                        func.lower(Product.size) == str(product_in.size).strip().lower(),
                    )
                )
            prod_stmt = select(Product).where(
                Product.company_id == cid,
                Product.is_deleted == False,
                or_(*fallback_conditions)
            )
            prod = (await self.db.execute(prod_stmt)).scalars().first()
        if not prod:
            prod_stmt = select(Product).where(
                Product.company_id == cid,
                Product.item_id == canonical_item.id,
                Product.is_deleted == False
            ).order_by(Product.created_at.desc())
            prod = (await self.db.execute(prod_stmt)).scalars().first()

        return prod

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

        movement_id = IdentityEngine.generate_technical_id()
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

        movement_id = IdentityEngine.generate_technical_id()
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


