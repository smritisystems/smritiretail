"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.46.1
Created      : 2026-09-28
Modified     : 2026-09-28
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Core Domain Service
"""

import uuid
from decimal import Decimal
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy import select, or_, and_, text, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models.item_master import (
    Item,
    ItemStyle,
    ItemVariant,
    ItemBarcode,
    ItemWarehouseLocation,
)
from ..models.pricing import PriceBook, PriceBookEntry
from ..models.master_lookup import MasterType, MasterValue
from ..schemas.item_master import (
    ItemStyleCreateRequest,
    ItemStyleUpdateRequest,
    ItemStyleResponse,
    ItemVariantCreateRequest,
    ItemVariantResponse,
    ItemBarcodeCreateRequest,
    ItemBarcodeResponse,
    ItemBarcodeItem,
)
class BusinessLogicError(Exception):
    """Business rule or invariant validation violation in Item Master Domain."""
    def __init__(self, message: str, code: str = "SMRITI-DATA-001"):
        super().__init__(message)
        self.message = message
        self.code = code


class ItemDomainService:
    """
    SMRITI Canonical Item Master Domain Service (v2.2).
    Enforces 3-tier domain hierarchy:
      ItemStyle (Product/Style Identity)
         ↓
      ItemVariant (Physical Variant Identity: Style + Color + Size)
         ↓
      ItemBarcode (Physical Barcode Identity)
         ↓
      Pricing Domain (Decoupled Commercial PriceBook / Versioned MRP)
    """

    # ---------------------------------------------------------------------------
    # 1. ItemStyle Domain Methods
    # ---------------------------------------------------------------------------

    @classmethod
    async def list_styles(
        cls,
        session: AsyncSession,
        category: Optional[str] = None,
        brand: Optional[str] = None,
        query: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
        company_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Lists Item Styles with attached variant & barcode counts."""
        stmt = select(Item).where(Item.is_deleted == False)

        if company_id:
            stmt = stmt.where(Item.company_id == company_id)
        if category:
            stmt = stmt.where(func.lower(Item.category) == category.strip().lower())
        if brand:
            stmt = stmt.where(func.lower(Item.brand) == brand.strip().lower())
        if query:
            q_clean = f"%{query.strip().lower()}%"
            stmt = stmt.where(
                or_(
                    func.lower(Item.item_code).like(q_clean),
                    func.lower(Item.item_name).like(q_clean),
                    func.lower(Item.brand).like(q_clean),
                    func.lower(Item.style_code).like(q_clean),
                )
            )

        stmt = stmt.options(
            selectinload(Item.variants).selectinload(ItemVariant.barcodes)
        ).order_by(Item.item_code.asc()).limit(limit).offset(offset)

        result = await session.execute(stmt)
        items = result.scalars().all()

        output = []
        for it in items:
            v_count = len([v for v in it.variants if not v.is_deleted])
            b_count = sum(len([b for b in v.barcodes if not b.is_deleted]) for v in it.variants)
            style_dict = {
                "id": it.id,
                "style_code": it.item_code,
                "style_name": it.item_name,
                "item_type": it.item_type or "FINISHED_GOOD",
                "category": it.category,
                "department": it.department,
                "brand": it.brand,
                "vendor_code": it.vendor_code,
                "hsn_code": it.hsn_code,
                "tax_rate": float(it.tax_rate or 18.0),
                "primary_uom": it.primary_uom or "PRS",
                "gender": it.gender,
                "product_type": it.product_type,
                "heel_type": it.heel_type,
                "upper_material": it.upper_material,
                "outsole_material": it.outsole_material,
                "collection_type": it.collection_type,
                "status": it.status or "ACTIVE",
                "is_inventory_yn": it.is_inventory_yn,
                "is_billable_yn": it.is_billable_yn,
                "is_service_yn": it.is_service_yn,
                "variant_count": v_count,
                "barcode_count": b_count,
            }
            output.append(style_dict)

        return output

    @classmethod
    async def get_style(
        cls,
        session: AsyncSession,
        style_id_or_code: str,
        company_id: Optional[str] = None,
    ) -> Optional[Item]:
        """Fetches an ItemStyle by surrogate ID or unique style_code."""
        stmt = (
            select(Item)
            .where(
                or_(
                    Item.id == style_id_or_code.strip(),
                    func.lower(Item.item_code) == style_id_or_code.strip().lower(),
                ),
                Item.is_deleted == False,
            )
            .options(
                selectinload(Item.variants).selectinload(ItemVariant.barcodes),
                selectinload(Item.barcodes),
            )
        )
        if company_id:
            stmt = stmt.where(Item.company_id == company_id)

        result = await session.execute(stmt)
        return result.scalars().first()

    @classmethod
    async def create_style(
        cls,
        session: AsyncSession,
        req: ItemStyleCreateRequest,
        company_id: str,
        branch_id: Optional[str] = None,
        commit: bool = True,
    ) -> Item:
        """Creates a new ItemStyle parent catalog record."""
        existing = await cls.get_style(session, req.style_code, company_id=company_id)
        if existing:
            raise BusinessLogicError(
                message=f"Item style with code '{req.style_code}' already exists.",
                code="SMRITI-ITEM-STYLE-EXISTS",
            )

        new_id = f"itm-{uuid.uuid4().hex[:12]}"
        style = Item(
            id=new_id,
            company_id=company_id,
            branch_id=branch_id,
            item_code=req.style_code.strip().upper(),
            style_code=req.style_code.strip().upper(),
            item_name=req.style_name.strip(),
            item_type=req.item_type,
            category=req.category,
            category_code=req.category_code,
            department=req.department,
            brand=req.brand,
            vendor_code=req.vendor_code,
            hsn_code=req.hsn_code or "64041990",
            tax_rate=Decimal(str(req.tax_rate)),
            primary_uom=req.primary_uom or "PRS",
            least_saleable_qty=Decimal(str(req.least_saleable_qty or 1.0)),
            gender=req.gender,
            product_type=req.product_type,
            design_attribute=req.design_attribute,
            heel_type=req.heel_type,
            upper_material=req.upper_material,
            outsole_material=req.outsole_material,
            collection_type=req.collection_type,
            is_inventory_yn=req.is_inventory_yn,
            is_billable_yn=req.is_billable_yn,
            is_service_yn=req.is_service_yn,
            attributes_json=req.attributes_json,
            tags=req.tags,
            status="ACTIVE",
        )

        session.add(style)
        if commit:
            await session.commit()
            await session.refresh(style)

        return style

    # ---------------------------------------------------------------------------
    # 2. ItemVariant Domain Methods (Physical Variant: Style + Color + Size)
    # ---------------------------------------------------------------------------

    @classmethod
    async def list_variants(
        cls,
        session: AsyncSession,
        style_id: Optional[str] = None,
        color: Optional[str] = None,
        size: Optional[str] = None,
        query: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
        company_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Lists physical variants with their attached barcodes."""
        stmt = select(ItemVariant).where(ItemVariant.is_deleted == False)

        if company_id:
            stmt = stmt.where(ItemVariant.company_id == company_id)
        if style_id:
            stmt = stmt.where(ItemVariant.item_id == style_id.strip())
        if color:
            stmt = stmt.where(func.lower(ItemVariant.color) == color.strip().lower())
        if size:
            stmt = stmt.where(ItemVariant.size == size.strip())
        if query:
            q_clean = f"%{query.strip().lower()}%"
            stmt = stmt.where(
                or_(
                    func.lower(ItemVariant.variant_sku).like(q_clean),
                    func.lower(ItemVariant.variant_name).like(q_clean),
                )
            )

        stmt = (
            stmt.options(selectinload(ItemVariant.barcodes))
            .order_by(ItemVariant.variant_sku.asc())
            .limit(limit)
            .offset(offset)
        )

        result = await session.execute(stmt)
        variants = result.scalars().all()

        output = []
        for v in variants:
            b_items = [
                ItemBarcodeItem(
                    id=b.id,
                    variant_id=b.variant_id,
                    barcode=b.barcode,
                    barcode_type=b.barcode_type or "EAN13",
                    is_primary=b.is_primary or False,
                    is_tax_inclusive=b.is_tax_inclusive,
                )
                for b in v.barcodes
                if not b.is_deleted
            ]
            output.append({
                "id": v.id,
                "style_id": v.item_id,
                "variant_sku": v.variant_sku,
                "variant_name": v.variant_name,
                "color": v.color,
                "size": v.size,
                "hsn_code": v.hsn_code,
                "tax_rate": float(v.tax_rate) if v.tax_rate is not None else None,
                "is_active": v.is_active,
                "attributes_json": v.attributes_json or {},
                "barcodes": b_items,
            })

        return output

    @classmethod
    async def get_variant(
        cls,
        session: AsyncSession,
        variant_id_or_sku: str,
        company_id: Optional[str] = None,
    ) -> Optional[ItemVariant]:
        """Fetches an ItemVariant by surrogate ID or variant_sku."""
        stmt = (
            select(ItemVariant)
            .where(
                or_(
                    ItemVariant.id == variant_id_or_sku.strip(),
                    func.lower(ItemVariant.variant_sku) == variant_id_or_sku.strip().lower(),
                ),
                ItemVariant.is_deleted == False,
            )
            .options(selectinload(ItemVariant.barcodes))
        )
        if company_id:
            stmt = stmt.where(ItemVariant.company_id == company_id)

        result = await session.execute(stmt)
        return result.scalars().first()

    @classmethod
    async def create_variant(
        cls,
        session: AsyncSession,
        req: ItemVariantCreateRequest,
        company_id: str,
        branch_id: Optional[str] = None,
        commit: bool = True,
    ) -> Tuple[ItemVariant, Optional[PriceBookEntry], Optional[ItemBarcode]]:
        """
        Creates a physical ItemVariant strictly governed by Style + Color + Size.
        MRP does NOT participate in physical variant identity.
        If pricing is provided, it is registered in the Pricing Domain (PriceBookEntry).
        If a physical variant already exists for (style_id, color, size), the existing variant
        is reused, and any new MRP is recorded as a versioned price point!
        """
        style = await cls.get_style(session, req.style_id, company_id=company_id)
        if not style:
            raise BusinessLogicError(
                message=f"Parent item style '{req.style_id}' not found.",
                code="SMRITI-STYLE-NOT-FOUND",
            )

        color_clean = req.color.strip().upper()
        size_clean = req.size.strip().upper()
        sku = req.variant_sku or f"{style.item_code}-{color_clean}-{size_clean}"
        sku = sku.strip().upper()

        # Check existing physical variant by (company_id, style_id, color, size)
        stmt_existing = select(ItemVariant).where(
            ItemVariant.company_id == company_id,
            ItemVariant.item_id == style.id,
            func.upper(ItemVariant.color) == color_clean,
            func.upper(ItemVariant.size) == size_clean,
            ItemVariant.is_deleted == False,
        ).options(selectinload(ItemVariant.barcodes))
        res_existing = await session.execute(stmt_existing)
        existing_variant = res_existing.scalars().first()

        created_pbe = None
        created_barcode = None

        if existing_variant:
            variant = existing_variant
        else:
            var_id = f"var-{uuid.uuid4().hex[:12]}"
            name = req.variant_name or f"{style.item_name} ({color_clean}/{size_clean})"
            attr_bag = dict(req.attributes_json)
            attr_bag["color"] = color_clean
            attr_bag["size"] = size_clean

            variant = ItemVariant(
                id=var_id,
                company_id=company_id,
                branch_id=branch_id,
                item_id=style.id,
                variant_sku=sku,
                variant_name=name,
                color=color_clean,
                size=size_clean,
                attributes_json=attr_bag,
                hsn_code=req.hsn_code or style.hsn_code,
                tax_rate=Decimal(str(req.tax_rate)) if req.tax_rate is not None else style.tax_rate,
                mrp=Decimal(str(req.mrp or 0.0)),
                selling_price=Decimal(str(req.selling_price or req.mrp or 0.0)),
                cost_price=Decimal(str(req.cost_price or 0.0)),
                is_active=True,
            )
            session.add(variant)
            await session.flush()

        # Commercial Pricing Domain Integration (PriceBookEntry)
        if req.mrp is not None or req.selling_price is not None:
            # Resolve or create default price book
            pb_stmt = select(PriceBook).where(
                PriceBook.company_id == company_id,
                PriceBook.is_default == True,
                PriceBook.is_deleted == False,
            )
            pb_res = await session.execute(pb_stmt)
            default_pb = pb_res.scalars().first()
            if not default_pb:
                default_pb = PriceBook(
                    id=f"pb-{uuid.uuid4().hex[:12]}",
                    company_id=company_id,
                    branch_id=branch_id,
                    code="DEFAULT",
                    name="Standard Retail Price Book",
                    currency="INR",
                    is_default=True,
                    status="ACTIVE",
                )
                session.add(default_pb)
                await session.flush()

            mrp_val = Decimal(str(req.mrp or 0.0))
            sp_val = Decimal(str(req.selling_price or req.mrp or 0.0))
            cost_val = Decimal(str(req.cost_price or 0.0))

            pbe = PriceBookEntry(
                id=f"pbe-{uuid.uuid4().hex[:12]}",
                company_id=company_id,
                branch_id=branch_id,
                price_book_id=default_pb.id,
                item_id=style.id,
                variant_id=variant.id,
                min_quantity=Decimal("1.0000"),
                selling_price=sp_val,
                mrp=mrp_val,
                cost_price=cost_val,
            )
            session.add(pbe)
            await session.flush()
            created_pbe = pbe

        # Optional Primary Barcode Assignment
        if req.primary_barcode:
            b_code = req.primary_barcode.strip()
            barcode_obj = ItemBarcode(
                id=f"bar-{uuid.uuid4().hex[:12]}",
                company_id=company_id,
                branch_id=branch_id,
                item_id=style.id,
                variant_id=variant.id,
                barcode=b_code,
                barcode_normalized="".join(c for c in b_code if c.isalnum()).upper(),
                barcode_type="EAN13" if len(b_code) == 13 and b_code.isdigit() else "CODE128",
                barcode_purpose="RETAIL",
                is_primary=True,
                is_tax_inclusive=True,
                price_book_entry_id=created_pbe.id if created_pbe else None,
                status="ASSIGNED",
                source="DOMAIN_API",
            )
            session.add(barcode_obj)
            await session.flush()
            created_barcode = barcode_obj

        if commit:
            await session.commit()
            await session.refresh(variant)

        return variant, created_pbe, created_barcode

    # ---------------------------------------------------------------------------
    # 3. ItemBarcode Domain Methods (Physical Optical Identity)
    # ---------------------------------------------------------------------------

    @classmethod
    async def list_barcodes(
        cls,
        session: AsyncSession,
        variant_id: Optional[str] = None,
        barcode: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
        company_id: Optional[str] = None,
    ) -> List[ItemBarcodeResponse]:
        """Lists registered barcodes with multi-MRP pricing linkages."""
        stmt = select(ItemBarcode).where(ItemBarcode.is_deleted == False)

        if company_id:
            stmt = stmt.where(ItemBarcode.company_id == company_id)
        if variant_id:
            stmt = stmt.where(ItemBarcode.variant_id == variant_id.strip())
        if barcode:
            stmt = stmt.where(ItemBarcode.barcode == barcode.strip())

        stmt = stmt.order_by(ItemBarcode.created_at.desc()).limit(limit).offset(offset)
        result = await session.execute(stmt)
        barcodes = result.scalars().all()

        return [
            ItemBarcodeResponse(
                id=b.id,
                style_id=b.item_id,
                variant_id=b.variant_id,
                barcode=b.barcode,
                barcode_type=b.barcode_type or "EAN13",
                barcode_purpose=b.barcode_purpose or "RETAIL",
                is_primary=b.is_primary or False,
                is_tax_inclusive=b.is_tax_inclusive,
                least_saleable_qty=float(b.least_saleable_qty or 1.0),
                price_book_entry_id=b.price_book_entry_id,
                status=b.status or "ASSIGNED",
            )
            for b in barcodes
        ]

    @classmethod
    async def create_barcode(
        cls,
        session: AsyncSession,
        req: ItemBarcodeCreateRequest,
        company_id: str,
        branch_id: Optional[str] = None,
        commit: bool = True,
    ) -> ItemBarcode:
        """Registers a physical barcode linked to a specific physical variant and price point."""
        variant = await cls.get_variant(session, req.variant_id, company_id=company_id)
        if not variant:
            raise BusinessLogicError(
                message=f"Target variant '{req.variant_id}' not found.",
                code="SMRITI-VARIANT-NOT-FOUND",
            )

        b_clean = req.barcode.strip()
        # Verify barcode uniqueness within company
        stmt_check = select(ItemBarcode).where(
            ItemBarcode.company_id == company_id,
            ItemBarcode.barcode == b_clean,
            ItemBarcode.is_deleted == False,
        )
        existing_bc = (await session.execute(stmt_check)).scalars().first()
        if existing_bc:
            raise BusinessLogicError(
                message=f"Barcode '{b_clean}' is already registered in company catalog.",
                code="SMRITI-BARCODE-COLLISION",
            )

        pbe_id = req.price_book_entry_id
        # If barcode-specific commercial price point provided, register it in Pricing Domain
        if req.mrp is not None or req.selling_price is not None:
            pb_stmt = select(PriceBook).where(
                PriceBook.company_id == company_id,
                PriceBook.is_default == True,
                PriceBook.is_deleted == False,
            )
            default_pb = (await session.execute(pb_stmt)).scalars().first()
            if default_pb:
                pbe = PriceBookEntry(
                    id=f"pbe-{uuid.uuid4().hex[:12]}",
                    company_id=company_id,
                    branch_id=branch_id,
                    price_book_id=default_pb.id,
                    item_id=variant.item_id,
                    variant_id=variant.id,
                    min_quantity=Decimal("1.0000"),
                    selling_price=Decimal(str(req.selling_price or req.mrp or 0.0)),
                    mrp=Decimal(str(req.mrp or 0.0)),
                )
                session.add(pbe)
                await session.flush()
                pbe_id = pbe.id

        barcode_obj = ItemBarcode(
            id=f"bar-{uuid.uuid4().hex[:12]}",
            company_id=company_id,
            branch_id=branch_id,
            item_id=variant.item_id,
            variant_id=variant.id,
            barcode=b_clean,
            barcode_normalized="".join(c for c in b_clean if c.isalnum()).upper(),
            barcode_type=req.barcode_type,
            barcode_purpose=req.barcode_purpose,
            is_primary=req.is_primary,
            is_tax_inclusive=req.is_tax_inclusive,
            least_saleable_qty=Decimal(str(req.least_saleable_qty or 1.0)),
            price_book_entry_id=pbe_id,
            status="ASSIGNED",
            source="DOMAIN_API",
        )
        session.add(barcode_obj)

        if commit:
            await session.commit()
            await session.refresh(barcode_obj)

        return barcode_obj

    # ---------------------------------------------------------------------------
    # 4. Governed Master Lookups Domain Method
    # ---------------------------------------------------------------------------

    @classmethod
    async def get_governed_lookups(
        cls,
        control_db: AsyncSession,
        company_id: Optional[str] = None,
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        Fetches approved master lookup values from the control plane master_values table
        across all 14 governed dimensions required by SMRITI Standard v2.2.
        """
        stmt = (
            select(MasterValue, MasterType.code.label("type_code"))
            .join(MasterType, MasterValue.master_type_id == MasterType.id)
            .where(
                MasterValue.active == True,
                MasterValue.is_deleted == False,
            )
        )
        if company_id:
            stmt = stmt.where(
                or_(
                    MasterValue.company_id == company_id,
                    MasterValue.company_id.is_(None),
                )
            )

        result = await control_db.execute(stmt)
        rows = result.all()

        catalog: Dict[str, List[Dict[str, Any]]] = {}
        for val, type_code in rows:
            catalog.setdefault(type_code, []).append({
                "id": str(val.id),
                "code": val.code,
                "name": val.name,
                "data": val.data or {},
            })

        return catalog
