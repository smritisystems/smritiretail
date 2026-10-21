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

from decimal import Decimal
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, and_, or_
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException
import uuid
import re
from ..models.inventory import Product, StockMovement, Warehouse, ProductBatchStock
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

    async def _resolve_canonical_identity(
        self,
        product: Product,
        provided_item_id: Optional[str] = None,
        provided_variant_id: Optional[str] = None,
    ) -> tuple[str, str]:
        """
        Enforces Phase 2 Non-Negotiable Architecture Rule:
        NO STOCK WITHOUT CANONICAL IDENTITY.
        Resolves item_id and variant_id for product. Rejects unlinked products with 422.
        Rejects mismatched item_id or variant_id with 422 PRODUCT_CANONICAL_MISMATCH.
        """
        canonical_item_id = product.item_id
        canonical_variant_id = product.item_variant_id

        if not (canonical_item_id and canonical_variant_id):
            from .product_resolution_service import ProductResolutionService
            res = await ProductResolutionService.resolve_by_product_id(
                session=self.db,
                company_id=self.tenant_ctx.company_id,
                product_id=product.id,
            )
            if res.success and res.item_id and res.variant_id:
                canonical_item_id = res.item_id
                canonical_variant_id = res.variant_id

        if not (canonical_item_id and canonical_variant_id):
            raise HTTPException(
                status_code=422,
                detail={
                    "code": "UNLINKED_PRODUCT_NOT_ALLOWED",
                    "message": f"Product '{product.id}' is not linked to canonical Item Master. Stock movements are strictly prohibited."
                }
            )

        if provided_item_id and provided_item_id != canonical_item_id:
            raise HTTPException(
                status_code=422,
                detail={
                    "code": "PRODUCT_CANONICAL_MISMATCH",
                    "message": f"Provided item_id '{provided_item_id}' does not match canonical item '{canonical_item_id}' for product '{product.id}'."
                }
            )

        if provided_variant_id and provided_variant_id != canonical_variant_id:
            raise HTTPException(
                status_code=422,
                detail={
                    "code": "PRODUCT_CANONICAL_MISMATCH",
                    "message": f"Provided variant_id '{provided_variant_id}' does not match canonical variant '{canonical_variant_id}' for product '{product.id}'."
                }
            )

        return canonical_item_id, canonical_variant_id

    async def update_stock(
        self, 
        product_id: str, 
        quantity: float, 
        movement_type: str, 
        reference_doc_type: str, 
        reference_doc_id: str, 
        remarks: Optional[str] = None,
        unit_cost: Optional[float] = None,
        source_module: str = "inventory",
        item_id: Optional[str] = None,
        variant_id: Optional[str] = None,
    ) -> Optional[StockMovement]:
        """
        Centralized method to update product stock and record the movement.
        movement_type: 'IN', 'OUT', 'ADJUSTMENT', 'TRANSFER'
        Dual-key converged: writes product_id, item_id, variant_id.
        """
        stmt = select(Product).filter(
            Product.id == product_id,
            Product.is_deleted == False,
            Product.company_id == self.tenant_ctx.company_id,
        )
        if self.tenant_ctx.branch_id:
            stmt = stmt.filter(
                (Product.branch_id == self.tenant_ctx.branch_id) | (Product.branch_id.is_(None))
            )
        res = await self.db.execute(stmt)
        product = res.scalars().first()
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")

        canonical_item_id, canonical_variant_id = await self._resolve_canonical_identity(
            product=product,
            provided_item_id=item_id,
            provided_variant_id=variant_id,
        )

        if product.tracking_mode == "No-stock":
            return None

        # Stock is updated automatically by PostgreSQL trigger trg_inventory_state_reconciliation on StockMovement insert
        self.db.add(product)

        # Create StockMovement record with dual-key canonical identity
        movement = StockMovement(
            id=IdentityEngine.generate_technical_id(),
            product_id=product.id,
            item_id=canonical_item_id,
            variant_id=canonical_variant_id,
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
        return movement

    async def record_movement(
        self,
        product_id: str,
        quantity: float,
        movement_type: str,
        reference_doc_type: str,
        reference_doc_id: str,
        remarks: Optional[str] = None,
        unit_cost: Optional[float] = None,
        source_module: str = "inventory",
        item_id: Optional[str] = None,
        variant_id: Optional[str] = None,
    ) -> StockMovement:
        """
        Authoritative single movement writer for inventory transactions.
        Dual-key converged: commits and returns StockMovement with canonical identity.
        """
        movement = await self.update_stock(
            product_id=product_id,
            quantity=quantity,
            movement_type=movement_type,
            reference_doc_type=reference_doc_type,
            reference_doc_id=reference_doc_id,
            remarks=remarks,
            unit_cost=unit_cost,
            source_module=source_module,
            item_id=item_id,
            variant_id=variant_id,
        )
        await self.db.commit()
        if movement:
            await self.db.refresh(movement)
        return movement

    async def create_product(self, product_in: ProductCreate) -> Product:
        # Multi-Tenant Isolation Enforcement (Blocker 5)
        if not self.tenant_ctx or not self.tenant_ctx.company_id:
            raise HTTPException(status_code=400, detail="Multi-tenant security violation: company_id is required")

        cid = self.tenant_ctx.company_id
        bid = self.tenant_ctx.branch_id or "BR-001"

        from .catalog_validation import CatalogDimensionValidator, IM001ControlledFieldValidator

        attrs = product_in.attributes or {}
        governed_row = {
            "brand": product_in.brand,
            "category": product_in.category,
            "color": product_in.color,
            "size": product_in.size,
            "style_code": product_in.style_code,
            "vendor_code": product_in.vendor_code,
            "hsn_code": product_in.hsn_code,
            "gst_rate_percent": float(product_in.gst_percentage) if product_in.gst_percentage is not None else None,
            "gender": getattr(product_in, "gender", None) or attrs.get("gender"),
            "product_type": getattr(product_in, "product_type", None) or attrs.get("product_type") or attrs.get("productType"),
            "heel_type": getattr(product_in, "heel_type", None) or attrs.get("heel_type") or attrs.get("heelType") or attrs.get("heels"),
            "upper_material": getattr(product_in, "upper_material", None) or attrs.get("upper_material") or attrs.get("upperMaterial") or attrs.get("upper"),
            "design_attribute": getattr(product_in, "design_attribute", None) or attrs.get("design_attribute") or attrs.get("sub_category") or attrs.get("subcategory"),
            "outsole_material": getattr(product_in, "outsole_material", None) or attrs.get("outsole_material") or attrs.get("outsole"),
            "collection_type": getattr(product_in, "collection_type", None) or attrs.get("collection_type") or attrs.get("item_description"),
        }

        # Unified IM-001 Catalog Governance: Fail closed if invalid or unseeded mandatory dimension
        await IM001ControlledFieldValidator.validate_dict(
            payload=governed_row,
            company_id=cid,
            strict=True,
        )

        # Ensure mandatory style/article_no attributes default from style_code/code
        if attrs is not None:
            if not attrs.get("style") and product_in.style_code:
                attrs["style"] = product_in.style_code
            if not attrs.get("style_no") and (product_in.style_code or attrs.get("style")):
                attrs["style_no"] = product_in.style_code or attrs.get("style")
            if not attrs.get("article_no") and (product_in.style_code or product_in.code):
                attrs["article_no"] = product_in.style_code or product_in.code

        await AttributesService(self.db).validate_product_attributes(
            attrs,
            cid,
        )

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

        # Normalize promoted footwear dimensions
        promoted_dims = {
            "gender": getattr(product_in, "gender", None) or attrs.get("gender"),
            "product_type": getattr(product_in, "product_type", None) or attrs.get("product_type") or attrs.get("productType"),
            "heel_type": getattr(product_in, "heel_type", None) or attrs.get("heel_type") or attrs.get("heelType") or attrs.get("heels"),
            "upper_material": getattr(product_in, "upper_material", None) or attrs.get("upper_material") or attrs.get("upperMaterial") or attrs.get("upper"),
            "design_attribute": getattr(product_in, "design_attribute", None) or attrs.get("design_attribute") or attrs.get("sub_category") or attrs.get("subcategory"),
            "outsole_material": getattr(product_in, "outsole_material", None) or attrs.get("outsole_material") or attrs.get("outsole"),
            "collection_type": getattr(product_in, "collection_type", None) or attrs.get("collection_type") or attrs.get("item_description"),
        }
        for p_field, p_val in promoted_dims.items():
            if p_val and str(p_val).strip():
                norm_p = await CatalogDimensionValidator.validate_and_normalize_dimension(
                    dimension_field=p_field,
                    value=p_val,
                    strict=True,
                )
                if hasattr(product_in, p_field):
                    setattr(product_in, p_field, norm_p)
                if attrs is not None:
                    attrs[p_field] = norm_p
        product_in.attributes = attrs

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
            hsn_code=getattr(product_in, "hsn_code", None),
            tax_rate=float(getattr(product_in, "gst_percentage", None)) if getattr(product_in, "gst_percentage", None) is not None else None,
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
            supplier=sup_payload,
            gender=getattr(product_in, "gender", None) or (product_in.attributes.get("gender") if product_in.attributes else None),
            product_type=getattr(product_in, "product_type", None) or (product_in.attributes.get("product_type") if product_in.attributes else None),
            heel_type=getattr(product_in, "heel_type", None) or (product_in.attributes.get("heel_type") or product_in.attributes.get("heels") if product_in.attributes else None),
            upper_material=getattr(product_in, "upper_material", None) or (product_in.attributes.get("upper_material") or product_in.attributes.get("upper") if product_in.attributes else None),
            design_attribute=getattr(product_in, "design_attribute", None) or (product_in.attributes.get("design_attribute") or product_in.attributes.get("sub_category") if product_in.attributes else None),
            outsole_material=getattr(product_in, "outsole_material", None) or (product_in.attributes.get("outsole_material") or product_in.attributes.get("outsole") if product_in.attributes else None),
            collection_type=getattr(product_in, "collection_type", None) or (product_in.attributes.get("collection_type") if product_in.attributes else None),
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
        remarks: Optional[str] = None,
        item_id: Optional[str] = None,
        variant_id: Optional[str] = None,
    ) -> StockMovement:
        """
        Inter-warehouse stock transfer method.
        Posts a paired TRANSFER_OUT and TRANSFER_IN with warehouse_ids.
        Validates source-warehouse availability; net effect on product.stock is zero.
        Records StockMovements and emits Transactional Outbox event.
        Dual-key converged: writes product_id, item_id, variant_id.
        """
        from .stock_synchronizer import StockSynchronizer, INFLOW_MOVEMENT_TYPES, OUTFLOW_MOVEMENT_TYPES

        stmt = select(Product).filter(
            Product.id == product_id,
            Product.is_deleted == False,
            Product.company_id == self.tenant_ctx.company_id,
        ).with_for_update()
        if self.tenant_ctx.branch_id:
            stmt = stmt.filter(
                (Product.branch_id == self.tenant_ctx.branch_id) | (Product.branch_id.is_(None))
            )
        res = await self.db.execute(stmt)
        product = res.scalars().first()
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")

        canonical_item_id, canonical_variant_id = await self._resolve_canonical_identity(
            product=product,
            provided_item_id=item_id,
            provided_variant_id=variant_id,
        )

        qty_decimal = Decimal(str(quantity))

        # Resolve warehouse IDs and codes
        wh_from = (await self.db.execute(
            select(Warehouse).where(
                Warehouse.company_id == self.tenant_ctx.company_id,
                or_(Warehouse.id == from_warehouse, Warehouse.code == from_warehouse),
                Warehouse.is_deleted == False,
            )
        )).scalar_one_or_none()
        from_wh_id = wh_from.id if wh_from else (from_warehouse if (await self.db.execute(select(Warehouse.id).where(Warehouse.id == from_warehouse))).scalar_one_or_none() else None)
        from_wh_code = wh_from.code if wh_from else from_warehouse

        wh_to = (await self.db.execute(
            select(Warehouse).where(
                Warehouse.company_id == self.tenant_ctx.company_id,
                or_(Warehouse.id == to_warehouse, Warehouse.code == to_warehouse),
                Warehouse.is_deleted == False,
            )
        )).scalar_one_or_none()
        to_wh_id = wh_to.id if wh_to else (to_warehouse if (await self.db.execute(select(Warehouse.id).where(Warehouse.id == to_warehouse))).scalar_one_or_none() else None)
        to_wh_code = wh_to.code if wh_to else to_warehouse

        # Validate against source-warehouse availability
        if product.tracking_mode != "No-stock":
            batch_filters = [
                ProductBatchStock.company_id == self.tenant_ctx.company_id,
                ProductBatchStock.product_id == product.id,
                ProductBatchStock.is_deleted == False,
            ]
            if from_wh_id:
                batch_filters.append(ProductBatchStock.warehouse_id == from_wh_id)

            batch_count = (await self.db.execute(
                select(func.count(ProductBatchStock.id)).where(*batch_filters)
            )).scalar() or 0

            if batch_count > 0:
                source_avail = Decimal(str((await self.db.execute(
                    select(func.coalesce(func.sum(ProductBatchStock.quantity - ProductBatchStock.damaged_quantity), 0)).where(*batch_filters)
                )).scalar() or 0))
            else:
                wh_conds = []
                if from_wh_id:
                    wh_conds.append(StockMovement.warehouse_id == from_wh_id)
                wh_conds.append(StockMovement.warehouse == from_wh_code)
                if from_warehouse != from_wh_code:
                    wh_conds.append(StockMovement.warehouse == from_warehouse)

                source_moves = (await self.db.execute(
                    select(StockMovement).where(
                        StockMovement.company_id == self.tenant_ctx.company_id,
                        StockMovement.product_id == product.id,
                        StockMovement.is_deleted == False,
                        or_(*wh_conds),
                    )
                )).scalars().all()

                if source_moves:
                    source_avail = Decimal("0.00")
                    for m in source_moves:
                        mtype = (m.movement_type or "").upper()
                        q = Decimal(str(m.quantity or 0))
                        if mtype in INFLOW_MOVEMENT_TYPES:
                            source_avail += abs(q)
                        elif mtype in OUTFLOW_MOVEMENT_TYPES:
                            source_avail -= abs(q)
                        elif mtype in ("ADJUSTMENT", "STOCK_ADJUSTMENT"):
                            source_avail += q
                else:
                    source_avail = Decimal(str(product.stock or 0))

            if source_avail < qty_decimal:
                raise HTTPException(status_code=400, detail="Insufficient stock for transfer at source warehouse")

        transfer_doc_id = IdentityEngine.generate_technical_id()
        out_id = IdentityEngine.generate_technical_id()
        in_id = IdentityEngine.generate_technical_id()

        # Paired stock movements: TRANSFER_OUT and TRANSFER_IN
        mov_out = StockMovement(
            id=out_id,
            product_id=product.id,
            item_id=canonical_item_id,
            variant_id=canonical_variant_id,
            product_name=product.name,
            sku=product.sku or product.code or "",
            quantity=qty_decimal,
            movement_type="TRANSFER_OUT",
            reference_doc_type="Stock Transfer",
            reference_doc_id=transfer_doc_id,
            warehouse=from_wh_code,
            warehouse_id=from_wh_id,
            remarks=remarks or f"Transfer OUT to {to_wh_code}",
            branch=self.tenant_ctx.branch_id,
            source_module="Inventory",
            company_id=self.tenant_ctx.company_id,
            branch_id=self.tenant_ctx.branch_id,
        )

        mov_in = StockMovement(
            id=in_id,
            product_id=product.id,
            item_id=canonical_item_id,
            variant_id=canonical_variant_id,
            product_name=product.name,
            sku=product.sku or product.code or "",
            quantity=qty_decimal,
            movement_type="TRANSFER_IN",
            reference_doc_type="Stock Transfer",
            reference_doc_id=transfer_doc_id,
            warehouse=to_wh_code,
            warehouse_id=to_wh_id,
            remarks=remarks or f"Transfer IN from {from_wh_code}",
            branch=self.tenant_ctx.branch_id,
            source_module="Inventory",
            company_id=self.tenant_ctx.company_id,
            branch_id=self.tenant_ctx.branch_id,
        )

        self.db.add(mov_out)
        self.db.add(mov_in)
        await self.db.flush()

        # Synchronize stock cache: net ledger impact of TRANSFER_OUT (-qty) and TRANSFER_IN (+qty) is exactly zero
        await StockSynchronizer.sync_product_stock_cache(self.db, product.id, self.tenant_ctx.company_id)

        # Record Transactional Outbox event atomically
        from .outbox_service import OutboxService
        await OutboxService.record_event(
            session=self.db,
            target_channel="PSV_QUEUE",
            payload={
                "action": "STOCK_TRANSFERRED",
                "product_id": product.id,
                "sku": product.sku or product.code,
                "from_warehouse": from_wh_code,
                "to_warehouse": to_wh_code,
                "quantity": str(quantity),
                "company_code": self.tenant_ctx.company_id,
            },
            causation_id=transfer_doc_id,
        )

        saved_out_id = mov_out.id
        await self.db.commit()

        # Reload mov_out
        res_mov = await self.db.execute(select(StockMovement).where(StockMovement.id == saved_out_id))
        return res_mov.scalar_one()

    async def adjust_stock(
        self,
        product_id: str,
        new_quantity: float,
        reason: Optional[str] = None,
        item_id: Optional[str] = None,
        variant_id: Optional[str] = None,
    ) -> StockMovement:
        """
        Stock reconciliation & physical audit adjustment method.
        Computes delta against authoritative ledger balance, records signed StockMovement,
        synchronizes cache via StockSynchronizer, and emits Outbox event.
        Rejects fractional adjustments with 422 as products.stock is an integer column.
        Dual-key converged: writes product_id, item_id, variant_id.
        """
        qty_dec = Decimal(str(new_quantity))
        if qty_dec % Decimal("1") != Decimal("0"):
            raise HTTPException(
                status_code=422,
                detail={
                    "code": "FRACTIONAL_STOCK_NOT_PERMITTED",
                    "message": "Fractional stock adjustments are not permitted; products.stock column type is Integer."
                }
            )

        from .stock_synchronizer import StockSynchronizer, INFLOW_MOVEMENT_TYPES, OUTFLOW_MOVEMENT_TYPES

        stmt = select(Product).filter(
            Product.id == product_id,
            Product.is_deleted == False,
            Product.company_id == self.tenant_ctx.company_id,
        ).with_for_update()
        if self.tenant_ctx.branch_id:
            stmt = stmt.filter(
                (Product.branch_id == self.tenant_ctx.branch_id) | (Product.branch_id.is_(None))
            )
        res = await self.db.execute(stmt)
        product = res.scalars().first()
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")

        canonical_item_id, canonical_variant_id = await self._resolve_canonical_identity(
            product=product,
            provided_item_id=item_id,
            provided_variant_id=variant_id,
        )

        # Compute authoritative ledger balance (not stale products.stock cache)
        batch_count = (await self.db.execute(
            select(func.count(ProductBatchStock.id)).where(
                ProductBatchStock.company_id == self.tenant_ctx.company_id,
                ProductBatchStock.product_id == product.id,
                ProductBatchStock.is_deleted == False,
            )
        )).scalar() or 0

        if batch_count > 0:
            ledger_stock = (await self.db.execute(
                select(
                    func.coalesce(
                        func.sum(ProductBatchStock.quantity - ProductBatchStock.damaged_quantity),
                        0,
                    )
                ).where(
                    ProductBatchStock.company_id == self.tenant_ctx.company_id,
                    ProductBatchStock.product_id == product.id,
                    ProductBatchStock.is_deleted == False,
                )
            )).scalar() or Decimal("0.00")
        else:
            canon_var_id = getattr(product, "item_variant_id", None) or (str(product.variant_id) if getattr(product, "variant_id", None) else None)
            moves_filter = [
                StockMovement.company_id == self.tenant_ctx.company_id,
                StockMovement.is_deleted == False,
            ]
            if canon_var_id:
                moves_filter.append(
                    or_(
                        StockMovement.product_id == product.id,
                        StockMovement.variant_id == canon_var_id,
                    )
                )
            else:
                moves_filter.append(StockMovement.product_id == product.id)

            moves = (await self.db.execute(select(StockMovement).where(*moves_filter))).scalars().all()
            computed = Decimal("0.00")
            for m in moves:
                mtype = (m.movement_type or "").upper()
                q = Decimal(str(m.quantity or 0))
                if mtype in INFLOW_MOVEMENT_TYPES:
                    computed += abs(q)
                elif mtype in OUTFLOW_MOVEMENT_TYPES:
                    computed -= abs(q)
                elif mtype in ("ADJUSTMENT", "STOCK_ADJUSTMENT"):
                    computed += q
            ledger_stock = computed

        delta = qty_dec - Decimal(str(ledger_stock))

        movement_id = IdentityEngine.generate_technical_id()
        movement = StockMovement(
            id=movement_id,
            product_id=product.id,
            item_id=canonical_item_id,
            variant_id=canonical_variant_id,
            product_name=product.name,
            sku=product.sku or product.code or "",
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
        await self.db.flush()

        # Synchronize cached products.stock from authoritative ledger
        await StockSynchronizer.sync_product_stock_cache(self.db, product.id, self.tenant_ctx.company_id)

        # Record Transactional Outbox event atomically
        from .outbox_service import OutboxService
        await OutboxService.record_event(
            session=self.db,
            target_channel="PSV_QUEUE",
            payload={
                "action": "STOCK_ADJUSTED",
                "product_id": product.id,
                "sku": product.sku or product.code,
                "adjusted_quantity": str(delta),
                "new_stock": str(qty_dec),
                "reason": reason,
                "company_code": self.tenant_ctx.company_id
            },
            causation_id=movement_id
        )

        saved_mov_id = movement.id
        await self.db.commit()

        res_mov = await self.db.execute(select(StockMovement).where(StockMovement.id == saved_mov_id))
        return res_mov.scalar_one()


