"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.8.0
Created      : 2026-07-11
Modified     : 2026-07-11
Copyright    : Â© SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from typing import Optional
from sqlalchemy import func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException
from ..models.inventory import Product, StockMovement
from ..models.master_lookup import MasterType, MasterValue
from ..schemas.inventory import ProductCreate
from ..api.deps import TenantContext


def _build_sku(p) -> str:
    sku = getattr(p, "sku", None)
    if sku and str(sku).strip():
        return str(sku).strip()
    parts = [
        getattr(p, "style_code", None),
        getattr(p, "color", None),
        getattr(p, "size", None),
    ]
    filled = [str(x).strip() for x in parts if x is not None and str(x).strip()]
    return "-".join(filled) if filled else ""


async def _validate_master_field(
    db: AsyncSession,
    field_name: str,
    type_code: str,
    raw_value: str | None,
    tenant_id: str | None = None
) -> str | None:
    """
    Normalize and validate a product field against master_values.
    - Sizes: UPPER() match  (xxl → XXL)
    - All others: Title Case (red → Red)
    - Returns canonical name from DB (correct casing guaranteed)
    - If master_type not seeded yet: passes through (safe degradation)
    """
    if not raw_value or not raw_value.strip():
        return None

    normalized = (
        raw_value.strip().upper()
        if type_code == "product_size"
        else raw_value.strip().title()
    )

    # Find master type
    mt_res = await db.execute(
        select(MasterType).where(MasterType.code == type_code)
    )
    mt = mt_res.scalar_one_or_none()
    if not mt:
        return normalized  # type not seeded yet — allow through safely

    # Find value: system values OR this tenant's custom values
    mv_res = await db.execute(
        select(MasterValue).where(
            MasterValue.master_type_id == mt.id,
            MasterValue.is_deleted.is_(False),
            MasterValue.active.is_(True),
            func.upper(MasterValue.name) == normalized.upper(),
            or_(
                MasterValue.is_system.is_(True),
                MasterValue.tenant_id == tenant_id
            )
        )
    )
    mv = mv_res.scalar_one_or_none()

    if not mv:
        # Fetch valid options for helpful error message
        opts_res = await db.execute(
            select(MasterValue.name).where(
                MasterValue.master_type_id == mt.id,
                MasterValue.is_deleted.is_(False),
                MasterValue.active.is_(True),
                or_(
                    MasterValue.is_system.is_(True),
                    MasterValue.tenant_id == tenant_id
                )
            ).order_by(MasterValue.sort_order.asc(), MasterValue.name.asc())
        )
        valid = [r[0] for r in opts_res.fetchall()]
        raise HTTPException(
            status_code=422,
            detail={
                "title": f"Invalid {field_name.title()}",
                "explanation": (
                    f"'{raw_value}' is not a valid {field_name}. "
                    f"Valid options are: {', '.join(valid) if valid else 'none configured yet'}."
                ),
                "suggested_action": (
                    f"Check spelling, or add '{normalized}' from "
                    f"Settings → Master Values → {field_name.title()}."
                ),
                "reference_id": "SMRITI-VAL-010"
            }
        )
    return mv.name  # canonical casing from DB


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
            sku=_build_sku(product),
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

        tenant_id = getattr(self.tenant_ctx, "tenant_id", None) or getattr(self.tenant_ctx, "company_id", None)

        from ..core.validation import get_validation_engine
        pve = get_validation_engine()
        val_res = await pve.validate_entity(
            db=self.db,
            entity_type="product",
            data=product_in.model_dump(),
            tenant_id=tenant_id,
            user_role=getattr(self.tenant_ctx, "role", "MANAGER")
        )
        product_data = val_res.normalized_data

        db_product = Product(
            **product_data,
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
            Product.id == product_id,
            Product.is_deleted == False,
            Product.company_id == self.tenant_ctx.company_id,
            Product.branch_id == self.tenant_ctx.branch_id
        )
        res = await self.db.execute(stmt)
        product = res.scalars().first()
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        
        # If tracking mode is No-stock, then stock is infinite
        if product.tracking_mode == "No-stock":
            return True
            
        if product.stock < quantity:
            return False
        return True

    async def resolve_effective_gst_percentage(self, product: Product) -> float:
        """
        Resolves effective GST percentage for a product following v5.1.0 Architecture:
        1. Item Classification / HSN Registry (VariantTemplate) [Single Source of Truth]
        2. Legacy Product.gst_percentage [Legacy Transitional Fallback - Scheduled for Deprecation]
        3. System Default (18.0) [Safety Net]
        """
        if product.variant_template_id:
            from ..models.attributes import VariantTemplate
            stmt = select(VariantTemplate).filter(
                VariantTemplate.id == product.variant_template_id,
                VariantTemplate.is_deleted == False
            )
            res = await self.db.execute(stmt)
            vt = res.scalars().first()
            if vt and vt.gst_percentage is not None:
                return float(vt.gst_percentage)
        
        if product.gst_percentage is not None:
            return float(product.gst_percentage)

        return 18.0


