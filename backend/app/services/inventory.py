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
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException
import uuid
import re
from ..models.inventory import Product, StockMovement
from ..models.item_master import Item, ItemVariant, ItemBarcode, LegacyIdMapping
from ..models.pricing import PriceBook, PriceBookEntry
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

        # Stock is updated automatically by PostgreSQL trigger trg_inventory_state_reconciliation on StockMovement insert
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

        # Check for duplicate barcode (only if barcode is non-empty)
        if product_in.barcode and str(product_in.barcode).strip():
            clean_barcode = str(product_in.barcode).strip()
            existing_barcode = await self.db.execute(
                select(Product).filter(
                    Product.barcode == clean_barcode,
                    Product.is_deleted == False,
                    Product.company_id == self.tenant_ctx.company_id,
                    Product.branch_id == self.tenant_ctx.branch_id
                )
            )
            if existing_barcode.scalars().first():
                raise HTTPException(status_code=400, detail="Product with this barcode already exists")

        # Multi-Tenant Isolation Enforcement (Blocker 5)
        if not self.tenant_ctx or not self.tenant_ctx.company_id:
            raise HTTPException(status_code=400, detail="Multi-tenant security violation: company_id is required")

        cid = self.tenant_ctx.company_id
        bid = self.tenant_ctx.branch_id

        prod_data = product_in.model_dump()
        if not prod_data.get("id"):
            prod_data["id"] = f"PROD-{uuid.uuid4().hex[:8]}"

        db_product = Product(
            **prod_data,
            company_id=cid,
            branch_id=bid
        )
        self.db.add(db_product)

        # Dual-Write Canonical Staging (Gate 5 Dual-Read/Write Compatibility)
        # Deterministic Parent Style Identity (Blocker 4)
        style = (db_product.style_code or "").strip()
        if style:
            item_code = style
            item_status = "ACTIVE"
        else:
            item_code = f"ITM-UNASSIGNED-{db_product.id}"
            item_status = "REQUIRES_REVIEW"

        # Check or create parent Item without inventing business defaults (Blockers 2 & 3)
        existing_item_res = await self.db.execute(
            select(Item).filter(
                Item.company_id == cid,
                Item.item_code == item_code,
                Item.is_deleted == False
            )
        )
        canonical_item = existing_item_res.scalars().first()
        if not canonical_item:
            canonical_item = Item(
                id=f"itm_{uuid.uuid4().hex[:12]}",
                uuid=str(uuid.uuid4()),
                company_id=cid,
                branch_id=bid,
                item_code=item_code,
                item_name=db_product.name,
                item_type="FINISHED_GOOD",
                category=db_product.category or None,
                category_code=db_product.category_code or None,
                brand=db_product.brand or None,
                hsn_code=db_product.hsn_code or None,
                tax_rate=db_product.gst_percentage or None,
                primary_uom=None,
                status=item_status,
                is_active=True,
                is_deleted=False
            )
            self.db.add(canonical_item)

        # Create Canonical Variant (Physical identity only — Blocker 1)
        var_id = f"var_{uuid.uuid4().hex[:12]}"
        var_uuid = str(uuid.uuid4())
        canonical_variant = ItemVariant(
            id=var_id,
            uuid=var_uuid,
            company_id=cid,
            branch_id=bid,
            item_id=canonical_item.id,
            variant_sku=db_product.code,
            variant_name=db_product.name,
            attributes_json={"color": db_product.color, "size": db_product.size} if (db_product.color or db_product.size) else {},
            is_active=True,
            is_deleted=False
        )
        self.db.add(canonical_variant)

        # Keep the legacy product directly linked to its canonical ItemMaster records.
        db_product.item_id = canonical_item.id
        db_product.item_variant_id = canonical_variant.id

        # Authoritative Pricing Domain: Insert PriceBookEntry (Blocker 1)
        res_pb = await self.db.execute(
            select(PriceBook).filter(
                PriceBook.company_id == cid,
                PriceBook.is_default == True,
                PriceBook.is_deleted == False
            )
        )
        default_pb = res_pb.scalars().first()
        if not default_pb:
            default_pb = PriceBook(
                id=f"pb_{uuid.uuid4().hex[:12]}",
                uuid=str(uuid.uuid4()),
                company_id=cid,
                branch_id=bid,
                name=f"Standard Retail Price List ({cid})",
                code=f"DEFAULT-{cid}",
                currency="INR",
                is_default=True,
                status="ACTIVE",
                is_active=True,
                is_deleted=False
            )
            self.db.add(default_pb)

        price_entry = PriceBookEntry(
            id=f"pbe_{uuid.uuid4().hex[:12]}",
            uuid=str(uuid.uuid4()),
            company_id=cid,
            branch_id=bid,
            price_book_id=default_pb.id,
            item_id=canonical_item.id,
            variant_id=canonical_variant.id,
            min_quantity=1.0000,
            selling_price=db_product.price or 0.00,
            mrp=db_product.mrp or 0.00,
            cost_price=db_product.cost_price or 0.00,
            is_active=True,
            is_deleted=False
        )
        self.db.add(price_entry)

        # Create Canonical Barcode if provided
        if db_product.barcode and str(db_product.barcode).strip():
            clean_bc = str(db_product.barcode).strip()
            bc_type = "EAN13" if len(clean_bc) == 13 and clean_bc.isdigit() else "CODE128_INTERNAL"
            canonical_barcode = ItemBarcode(
                id=f"bc_{uuid.uuid4().hex[:12]}",
                uuid=str(uuid.uuid4()),
                company_id=cid,
                branch_id=bid,
                item_id=canonical_item.id,
                variant_id=canonical_variant.id,
                barcode=clean_bc,
                barcode_type=bc_type,
                is_primary=True,
                is_active=True,
                is_deleted=False
            )
            self.db.add(canonical_barcode)

        # Record Permanent Lineage Mapping
        mapping = LegacyIdMapping(
            id=f"map_{uuid.uuid4().hex[:12]}",
            uuid=str(uuid.uuid4()),
            company_id=cid,
            branch_id=bid,
            migration_run_id="live_sync",
            legacy_table="products",
            legacy_id=db_product.id,
            legacy_uuid=db_product.uuid,
            canonical_table="item_variants",
            canonical_id=canonical_variant.id,
            canonical_uuid=canonical_variant.uuid,
            disposition="MIGRATED",
            is_active=True,
            is_deleted=False
        )
        self.db.add(mapping)

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


