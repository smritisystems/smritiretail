"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.82.0
Created      : 2026-09-28
Modified     : 2026-10-15
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Core Domain Service
"""

import re
import uuid
import json
import hashlib
from datetime import datetime, timezone
from decimal import Decimal
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy import select, or_, and_, text, func, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models.item_master import (
    Item,
    ItemStyle,
    ItemVariant,
    ItemBarcode,
    ItemWarehouseLocation,
    ItemUOMSetting,
    ItemPrice,
    ItemTaxProfile,
    ItemSupplierSetting,
    ItemSalesSetting,
    ItemInventoryPolicy,
    ItemBatch,
    ItemSerial,
    BarcodeRegistryAudit,
)
from ..models.localization import UnitOfMeasurementRef
from ..models.purchase import (
    Supplier,
    PurchaseReceiptItem,
    PurchaseOrderItem,
    PurchaseBillItem,
)
from ..models.pricing import PriceBook, PriceBookEntry, ItemPriceRevision
from ..models.sales import (
    SalesInvoiceItem,
    SalesOrderItem,
    SalesReturnItem,
)
from ..models.inventory import (
    Product,
    StockMovement,
    StockTransferItem,
    StockAuditItem,
)
from ..models.customer_article_mapping import CustomerArticleMapping
from ..models.audit import ComplianceImmutableAuditLog
from ..models.master_lookup import MasterType, MasterValue
from ..services.item_readiness_svc import ItemReadinessEngine, ItemReadinessStatus
from ..schemas.item_master import (
    ItemStyleCreateRequest,
    ItemStyleUpdateRequest,
    ItemStyleResponse,
    ItemVariantCreateRequest,
    ItemVariantResponse,
    ItemVariantUpdateRequest,
    ItemVariantDeletionStatusResponse,
    ItemVariantHardDeleteResponse,
    ItemBarcodeCreateRequest,
    ItemBarcodeResponse,
    ItemBarcodeItem,
    ItemUOMSettingSchema,
    ItemPriceSchema,
    ItemTaxProfileSchema,
    ItemSupplierSettingSchema,
    ItemSalesSettingSchema,
    ItemInventoryPolicySchema,
    ItemReadinessResponse,
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
            hsn_code=req.hsn_code,
            tax_rate=Decimal(str(req.tax_rate)) if req.tax_rate is not None else Decimal("0.00"),
            primary_uom=req.primary_uom or "PRS",
            uom=req.primary_uom or "PRS",
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
    async def resolve_uom_id(cls, session: AsyncSession, uom_val: Optional[str]) -> Optional[str]:
        """Resolves a UOM string (either code like 'PRS' or id like 'uom_prs') to canonical uoms_ref.id."""
        if not uom_val or not str(uom_val).strip():
            return None
        val_clean = str(uom_val).strip()
        stmt = select(UnitOfMeasurementRef.id).where(
            or_(
                UnitOfMeasurementRef.id == val_clean,
                func.upper(UnitOfMeasurementRef.code) == val_clean.upper(),
            )
        )
        res = await session.execute(stmt)
        matched_id = res.scalars().first()
        return matched_id or val_clean

    @classmethod
    def _serialize_variant_response(cls, v: ItemVariant) -> Dict[str, Any]:
        """Serializes an ItemVariant ORM entity into ItemVariantResponse dictionary with Phase 2 telemetry."""
        b_items = [
            ItemBarcodeItem(
                id=b.id,
                variant_id=b.variant_id,
                barcode=b.barcode,
                barcode_type=b.barcode_type or "EAN13",
                is_primary=b.is_primary or False,
                is_tax_inclusive=b.is_tax_inclusive,
            )
            for b in (v.barcodes or [])
            if not b.is_deleted
        ]

        # Phase 2: UOM
        uom_schema = None
        if v.uom_setting:
            uom_schema = ItemUOMSettingSchema(
                stock_uom_id=v.uom_setting.stock_uom_id,
                stock_uom_code=getattr(v.uom_setting.stock_uom, "code", None) or v.uom_setting.stock_uom_id,
                sales_uom_id=v.uom_setting.sales_uom_id,
                sales_uom_code=getattr(v.uom_setting.sales_uom, "code", None),
                purchase_uom_id=v.uom_setting.purchase_uom_id,
                purchase_uom_code=getattr(v.uom_setting.purchase_uom, "code", None),
                conversion_factor=float(v.uom_setting.conversion_factor or 1.0),
            )
        elif v.item and v.item.primary_uom:
            uom_schema = ItemUOMSettingSchema(
                stock_uom_id=v.item.primary_uom,
                stock_uom_code=v.item.primary_uom,
                conversion_factor=1.0,
            )

        # Phase 2: Pricing
        price_schema = None
        if v.price_setting:
            price_schema = ItemPriceSchema(
                cost_price=float(v.price_setting.cost_price or 0.0),
                selling_price=float(v.price_setting.selling_price or 0.0),
                mrp=float(v.price_setting.mrp or 0.0),
                dealer_price=float(v.price_setting.dealer_price) if v.price_setting.dealer_price is not None else None,
                wholesale_price=float(v.price_setting.wholesale_price) if v.price_setting.wholesale_price is not None else None,
                minimum_selling_price=float(v.price_setting.minimum_selling_price) if v.price_setting.minimum_selling_price is not None else None,
                maximum_discount_percent=float(v.price_setting.maximum_discount_percent or 0.0),
                currency=v.price_setting.currency or "INR",
                effective_from=v.price_setting.effective_from.isoformat() if v.price_setting.effective_from else None,
                effective_to=v.price_setting.effective_to.isoformat() if v.price_setting.effective_to else None,
                is_active=v.price_setting.is_active,
            )
        elif v.selling_price is not None or v.mrp is not None or v.cost_price is not None:
            price_schema = ItemPriceSchema(
                cost_price=float(v.cost_price or 0.0),
                selling_price=float(v.selling_price or 0.0),
                mrp=float(v.mrp or 0.0),
                currency="INR",
                is_active=v.is_active,
            )

        # Phase 2: Tax Profile
        tax_schema = None
        if v.tax_profile:
            tax_schema = ItemTaxProfileSchema(
                hsn_sac_code=v.tax_profile.hsn_sac_code,
                tax_category=v.tax_profile.tax_category,
                gst_rate=float(v.tax_profile.gst_rate) if v.tax_profile.gst_rate is not None else None,
                tax_inclusive=v.tax_profile.tax_inclusive,
                sales_tax_rate=float(v.tax_profile.sales_tax_rate) if v.tax_profile.sales_tax_rate is not None else None,
                purchase_tax_rate=float(v.tax_profile.purchase_tax_rate) if v.tax_profile.purchase_tax_rate is not None else None,
                tax_exempt=v.tax_profile.tax_exempt,
            )
        elif v.hsn_code or v.tax_rate is not None or (v.item and (v.item.hsn_code or v.item.tax_rate is not None)):
            tax_schema = ItemTaxProfileSchema(
                hsn_sac_code=v.hsn_code or (v.item.hsn_code if v.item else None),
                gst_rate=float(v.tax_rate) if v.tax_rate is not None else (float(v.item.tax_rate) if v.item and v.item.tax_rate is not None else None),
                tax_inclusive=True,
                tax_exempt=False,
            )

        # Phase 2: Purchasing
        supplier_schema = None
        if v.supplier_setting:
            supplier_schema = ItemSupplierSettingSchema(
                preferred_supplier_id=v.supplier_setting.preferred_supplier_id,
                preferred_supplier_name=getattr(v.supplier_setting.preferred_supplier, "name", None),
                supplier_item_code=v.supplier_setting.supplier_item_code,
                purchase_uom_id=v.supplier_setting.purchase_uom_id,
                purchase_uom_code=getattr(v.supplier_setting.purchase_uom, "code", None),
                minimum_purchase_qty=float(v.supplier_setting.minimum_purchase_qty or 1.0),
                purchase_cost=float(v.supplier_setting.purchase_cost) if v.supplier_setting.purchase_cost is not None else None,
                last_purchase_price=float(v.supplier_setting.last_purchase_price) if v.supplier_setting.last_purchase_price is not None else None,
                purchase_lead_time=v.supplier_setting.purchase_lead_time or 0,
                is_active=v.supplier_setting.is_active,
            )

        # Phase 2: Sales
        sales_schema = None
        if v.sales_setting:
            sales_schema = ItemSalesSettingSchema(
                sales_uom_id=v.sales_setting.sales_uom_id,
                sales_uom_code=getattr(v.sales_setting.sales_uom, "code", None),
                selling_price=float(v.sales_setting.selling_price or 0.0),
                mrp=float(v.sales_setting.mrp or 0.0),
                wholesale_price=float(v.sales_setting.wholesale_price) if v.sales_setting.wholesale_price is not None else None,
                minimum_selling_price=float(v.sales_setting.minimum_selling_price) if v.sales_setting.minimum_selling_price is not None else None,
                maximum_discount_percent=float(v.sales_setting.maximum_discount_percent or 0.0),
                allow_discount=v.sales_setting.allow_discount,
                billable=v.sales_setting.billable,
            )

        # Phase 2: Inventory Policy
        inv_schema = None
        if v.inventory_policy:
            inv_schema = ItemInventoryPolicySchema(
                minimum_stock=float(v.inventory_policy.minimum_stock or 0.0),
                reorder_level=float(v.inventory_policy.reorder_level or 0.0),
                reorder_quantity=float(v.inventory_policy.reorder_quantity or 0.0),
                maximum_stock=float(v.inventory_policy.maximum_stock or 0.0),
                safety_stock=float(v.inventory_policy.safety_stock or 0.0),
                lead_time=v.inventory_policy.lead_time or 0,
                preferred_supplier_id=v.inventory_policy.preferred_supplier_id,
            )

        # Phase 2: Readiness Evaluation
        readiness_data = ItemReadinessEngine.evaluate_orm_variant(v)
        readiness_schema = ItemReadinessResponse(
            status=readiness_data["status"],
            ready_for_sale=readiness_data["ready_for_sale"],
            blocking_reasons=readiness_data["blocking_reasons"],
        )

        return {
            "id": v.id,
            "style_id": v.item_id,
            "variant_sku": v.variant_sku,
            "variant_name": v.variant_name,
            "color": v.color,
            "size": v.size,
            "hsn_code": v.hsn_code,
            "tax_rate": float(v.tax_rate) if v.tax_rate is not None else None,
            "mrp": float(v.mrp or 0.0),
            "selling_price": float(v.selling_price or 0.0),
            "cost_price": float(v.cost_price or 0.0),
            "is_active": v.is_active,
            "attributes_json": v.attributes_json or {},
            "barcodes": b_items,
            "uom": uom_schema,
            "pricing": price_schema,
            "tax": tax_schema,
            "purchasing": supplier_schema,
            "sales": sales_schema,
            "inventory_policy": inv_schema,
            "readiness": readiness_schema,
        }

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
        """Lists physical variants with attached barcodes, Phase 2 policies, and readiness telemetry."""
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
            stmt.options(
                selectinload(ItemVariant.barcodes),
                selectinload(ItemVariant.item),
                selectinload(ItemVariant.uom_setting).selectinload(ItemUOMSetting.stock_uom),
                selectinload(ItemVariant.uom_setting).selectinload(ItemUOMSetting.sales_uom),
                selectinload(ItemVariant.uom_setting).selectinload(ItemUOMSetting.purchase_uom),
                selectinload(ItemVariant.price_setting),
                selectinload(ItemVariant.tax_profile),
                selectinload(ItemVariant.supplier_setting).selectinload(ItemSupplierSetting.preferred_supplier),
                selectinload(ItemVariant.supplier_setting).selectinload(ItemSupplierSetting.purchase_uom),
                selectinload(ItemVariant.sales_setting).selectinload(ItemSalesSetting.sales_uom),
                selectinload(ItemVariant.inventory_policy),
            )
            .order_by(ItemVariant.variant_sku.asc())
            .limit(limit)
            .offset(offset)
        )

        result = await session.execute(stmt)
        variants = result.scalars().all()

        return [cls._serialize_variant_response(v) for v in variants]

    @classmethod
    async def get_variant(
        cls,
        session: AsyncSession,
        variant_id_or_sku: str,
        company_id: Optional[str] = None,
    ) -> Optional[ItemVariant]:
        """Fetches an ItemVariant by surrogate ID or variant_sku with all Phase 2 relationships loaded."""
        stmt = (
            select(ItemVariant)
            .where(
                or_(
                    ItemVariant.id == variant_id_or_sku.strip(),
                    func.lower(ItemVariant.variant_sku) == variant_id_or_sku.strip().lower(),
                ),
                ItemVariant.is_deleted == False,
            )
            .options(
                selectinload(ItemVariant.barcodes),
                selectinload(ItemVariant.item),
                selectinload(ItemVariant.uom_setting).selectinload(ItemUOMSetting.stock_uom),
                selectinload(ItemVariant.uom_setting).selectinload(ItemUOMSetting.sales_uom),
                selectinload(ItemVariant.uom_setting).selectinload(ItemUOMSetting.purchase_uom),
                selectinload(ItemVariant.price_setting),
                selectinload(ItemVariant.tax_profile),
                selectinload(ItemVariant.supplier_setting).selectinload(ItemSupplierSetting.preferred_supplier),
                selectinload(ItemVariant.supplier_setting).selectinload(ItemSupplierSetting.purchase_uom),
                selectinload(ItemVariant.sales_setting).selectinload(ItemSalesSetting.sales_uom),
                selectinload(ItemVariant.inventory_policy),
            )
        )
        if company_id:
            stmt = stmt.where(ItemVariant.company_id == company_id)

        result = await session.execute(stmt)
        found = result.scalars().first()
        if not found and company_id:
            # Fallback: check if variant_id_or_sku is a legacy Product.id
            prod_row = (await session.execute(
                select(Product).where(
                    Product.company_id == company_id,
                    Product.id == variant_id_or_sku.strip(),
                )
            )).scalars().first()
            if prod_row:
                if prod_row.item_variant_id:
                    stmt2 = select(ItemVariant).where(
                        ItemVariant.id == prod_row.item_variant_id,
                        ItemVariant.company_id == company_id,
                        ItemVariant.is_deleted == False,
                    ).options(
                        selectinload(ItemVariant.barcodes),
                        selectinload(ItemVariant.item),
                        selectinload(ItemVariant.uom_setting).selectinload(ItemUOMSetting.stock_uom),
                        selectinload(ItemVariant.uom_setting).selectinload(ItemUOMSetting.sales_uom),
                        selectinload(ItemVariant.uom_setting).selectinload(ItemUOMSetting.purchase_uom),
                        selectinload(ItemVariant.price_setting),
                        selectinload(ItemVariant.tax_profile),
                        selectinload(ItemVariant.supplier_setting).selectinload(ItemSupplierSetting.preferred_supplier),
                        selectinload(ItemVariant.supplier_setting).selectinload(ItemSupplierSetting.purchase_uom),
                        selectinload(ItemVariant.sales_setting).selectinload(ItemSalesSetting.sales_uom),
                        selectinload(ItemVariant.inventory_policy),
                    )
                    found = (await session.execute(stmt2)).scalars().first()
                if not found and (prod_row.sku or prod_row.code):
                    target_sku = (prod_row.sku or prod_row.code).strip()
                    stmt3 = select(ItemVariant).where(
                        func.lower(ItemVariant.variant_sku) == target_sku.lower(),
                        ItemVariant.company_id == company_id,
                        ItemVariant.is_deleted == False,
                    ).options(
                        selectinload(ItemVariant.barcodes),
                        selectinload(ItemVariant.item),
                        selectinload(ItemVariant.uom_setting).selectinload(ItemUOMSetting.stock_uom),
                        selectinload(ItemVariant.uom_setting).selectinload(ItemUOMSetting.sales_uom),
                        selectinload(ItemVariant.uom_setting).selectinload(ItemUOMSetting.purchase_uom),
                        selectinload(ItemVariant.price_setting),
                        selectinload(ItemVariant.tax_profile),
                        selectinload(ItemVariant.supplier_setting).selectinload(ItemSupplierSetting.preferred_supplier),
                        selectinload(ItemVariant.supplier_setting).selectinload(ItemSupplierSetting.purchase_uom),
                        selectinload(ItemVariant.sales_setting).selectinload(ItemSalesSetting.sales_uom),
                        selectinload(ItemVariant.inventory_policy),
                    )
                    found = (await session.execute(stmt3)).scalars().first()
        return found

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
        Persists Phase 2 domain extensions (UOM, Pricing, Tax, Purchasing, Sales, Inventory Policy).
        """
        style = await cls.get_style(session, req.style_id, company_id=company_id)
        if not style:
            raise BusinessLogicError(
                message=f"Parent item style '{req.style_id}' not found.",
                code="SMRITI-STYLE-NOT-FOUND",
            )

        color_clean = req.color.strip().upper()
        size_clean = req.size.strip().upper()

        # Prohibit synthetic / placeholder barcodes
        if req.primary_barcode and req.primary_barcode.strip():
            raw_bc = req.primary_barcode.strip().upper()
            if re.match(r"^(890GEN|ITM-|S\d{12})", raw_bc, re.IGNORECASE) or (len(raw_bc) == 36 and "-" in raw_bc):
                raise BusinessLogicError(
                    message="Synthetic or auto-generated placeholder barcodes are strictly prohibited.",
                    code="SMRITI-SYNTHETIC-BARCODE-PROHIBITED",
                )

        # Mandatory SKU Decision Tree:
        # Case 2: User explicitly provides SKU (takes precedence)
        if req.variant_sku and req.variant_sku.strip():
            sku = req.variant_sku.strip().upper()
        # Case 1: Official primary barcode exists AND SKU is blank (Initial assignment from primary barcode)
        elif req.primary_barcode and req.primary_barcode.strip():
            sku = req.primary_barcode.strip().upper()
        # Case 3: Neither barcode nor SKU exists (DO NOT silently generate SKU)
        else:
            raise BusinessLogicError(
                message="SKU / Item Code is required or must be approved before saving.",
                code="ITEM_MASTER_VALIDATION_ERROR",
            )

        # SKU Uniqueness check within company scope
        stmt_sku = select(ItemVariant).where(
            ItemVariant.company_id == company_id,
            ItemVariant.variant_sku == sku,
            ItemVariant.is_deleted == False,
        )
        existing_sku_record = (await session.execute(stmt_sku)).scalars().first()

        # Check existing physical variant by (company_id, style_id, color, size)
        stmt_existing = select(ItemVariant).where(
            ItemVariant.company_id == company_id,
            ItemVariant.item_id == style.id,
            func.upper(ItemVariant.color) == color_clean,
            func.upper(ItemVariant.size) == size_clean,
            ItemVariant.is_deleted == False,
        ).options(
            selectinload(ItemVariant.barcodes),
            selectinload(ItemVariant.item),
            selectinload(ItemVariant.uom_setting),
            selectinload(ItemVariant.price_setting),
            selectinload(ItemVariant.tax_profile),
            selectinload(ItemVariant.supplier_setting),
            selectinload(ItemVariant.sales_setting),
            selectinload(ItemVariant.inventory_policy),
        )
        res_existing = await session.execute(stmt_existing)
        existing_variant = res_existing.scalars().first()

        created_pbe = None
        created_barcode = None

        if existing_variant:
            if existing_sku_record and existing_sku_record.id != existing_variant.id:
                raise BusinessLogicError(
                    message=f"SKU '{sku}' is already registered for this company.",
                    code="SMRITI-SKU-COLLISION",
                )
            variant = existing_variant
        else:
            if existing_sku_record:
                raise BusinessLogicError(
                    message=f"SKU '{sku}' is already registered for this company.",
                    code="SMRITI-SKU-COLLISION",
                )
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
                    code=f"DEFAULT-{company_id}"[:50],
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

            target_pb = default_pb
            existing_pbe = (await session.execute(
                select(PriceBookEntry).where(
                    PriceBookEntry.price_book_id == default_pb.id,
                    PriceBookEntry.item_id == style.id,
                    PriceBookEntry.variant_id == variant.id,
                    PriceBookEntry.min_quantity == Decimal("1.0000"),
                )
            )).scalars().first()

            if existing_pbe:
                if existing_pbe.mrp == mrp_val:
                    created_pbe = existing_pbe
                else:
                    # Physical variant reused with different MRP: create versioned price point
                    ver_pb = PriceBook(
                        id=f"pb-{uuid.uuid4().hex[:12]}",
                        company_id=company_id,
                        branch_id=branch_id,
                        code=f"PB-{company_id[:16]}-{uuid.uuid4().hex[:8]}"[:50],
                        name=f"Price Revision MRP {mrp_val}",
                        currency="INR",
                        is_default=False,
                        status="ACTIVE",
                    )
                    session.add(ver_pb)
                    await session.flush()
                    target_pb = ver_pb

                    pbe = PriceBookEntry(
                        id=f"pbe-{uuid.uuid4().hex[:12]}",
                        company_id=company_id,
                        branch_id=branch_id,
                        price_book_id=target_pb.id,
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
            else:
                pbe = PriceBookEntry(
                    id=f"pbe-{uuid.uuid4().hex[:12]}",
                    company_id=company_id,
                    branch_id=branch_id,
                    price_book_id=target_pb.id,
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
            b_code = req.primary_barcode.strip().upper()
            # Rule 10 & 11: Demote existing primary barcodes for this variant
            existing_primaries = (await session.execute(
                select(ItemBarcode).where(
                    ItemBarcode.company_id == company_id,
                    ItemBarcode.variant_id == variant.id,
                    ItemBarcode.is_primary == True,
                    ItemBarcode.is_deleted == False
                )
            )).scalars().all()
            for ep in existing_primaries:
                if ep.barcode != b_code:
                    ep.is_primary = False

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

        # ── Phase 2: Domain Extensions Persistence (Upsert/Idempotent) ────────
        # 1. UOM Setting
        uom_in = req.uom or {}
        stock_uom_in = uom_in.get("stock_uom_id") or getattr(req, "primary_uom", None) or style.primary_uom or "PRS"
        resolved_stock_uom = await cls.resolve_uom_id(session, stock_uom_in) or "uom_prs"
        resolved_sales_uom = await cls.resolve_uom_id(session, uom_in.get("sales_uom_id"))
        resolved_purch_uom = await cls.resolve_uom_id(session, uom_in.get("purchase_uom_id"))

        conv_factor = Decimal(str(uom_in.get("conversion_factor", 1.0)))
        if conv_factor <= Decimal("0"):
            conv_factor = Decimal("1.0")

        uom_obj = existing_variant.uom_setting if existing_variant else None
        if not uom_obj:
            uom_obj = ItemUOMSetting(
                item_variant_id=variant.id,
                company_id=company_id,
                branch_id=branch_id,
                stock_uom_id=resolved_stock_uom,
                sales_uom_id=resolved_sales_uom,
                purchase_uom_id=resolved_purch_uom,
                conversion_factor=conv_factor,
            )
            session.add(uom_obj)
        else:
            uom_obj.stock_uom_id = resolved_stock_uom
            if resolved_sales_uom:
                uom_obj.sales_uom_id = resolved_sales_uom
            if resolved_purch_uom:
                uom_obj.purchase_uom_id = resolved_purch_uom
            uom_obj.conversion_factor = conv_factor

        # 2. Commercial Pricing Setting
        p_in = req.pricing or {}
        mrp_dec = Decimal(str(p_in.get("mrp", req.mrp if req.mrp is not None else 0.0)))
        sp_dec = Decimal(str(p_in.get("selling_price", req.selling_price if req.selling_price is not None else (req.mrp if req.mrp is not None else 0.0))))
        cost_dec = Decimal(str(p_in.get("cost_price", req.cost_price if req.cost_price is not None else 0.0)))
        max_disc = Decimal(str(p_in.get("maximum_discount_percent", 0.0)))
        if max_disc < Decimal("0.0"):
            max_disc = Decimal("0.0")
        elif max_disc > Decimal("100.0"):
            max_disc = Decimal("100.0")

        price_obj = existing_variant.price_setting if existing_variant else None
        if not price_obj:
            price_obj = ItemPrice(
                item_variant_id=variant.id,
                company_id=company_id,
                branch_id=branch_id,
                cost_price=cost_dec,
                selling_price=sp_dec,
                mrp=mrp_dec,
                dealer_price=Decimal(str(p_in["dealer_price"])) if p_in.get("dealer_price") is not None else None,
                wholesale_price=Decimal(str(p_in["wholesale_price"])) if p_in.get("wholesale_price") is not None else None,
                minimum_selling_price=Decimal(str(p_in["minimum_selling_price"])) if p_in.get("minimum_selling_price") is not None else None,
                maximum_discount_percent=max_disc,
                currency=p_in.get("currency", "INR"),
                is_active=bool(p_in.get("is_active", True)),
            )
            session.add(price_obj)
        else:
            if req.mrp is not None or "mrp" in p_in:
                price_obj.mrp = mrp_dec
            if req.selling_price is not None or "selling_price" in p_in:
                price_obj.selling_price = sp_dec
            if req.cost_price is not None or "cost_price" in p_in:
                price_obj.cost_price = cost_dec
            if p_in.get("dealer_price") is not None:
                price_obj.dealer_price = Decimal(str(p_in["dealer_price"]))
            if p_in.get("wholesale_price") is not None:
                price_obj.wholesale_price = Decimal(str(p_in["wholesale_price"]))
            if p_in.get("minimum_selling_price") is not None:
                price_obj.minimum_selling_price = Decimal(str(p_in["minimum_selling_price"]))
            if "maximum_discount_percent" in p_in:
                price_obj.maximum_discount_percent = max_disc

        # 3. Statutory Tax Profile Setting
        t_in = req.tax or {}
        hsn_in = t_in.get("hsn_sac_code") or req.hsn_code or style.hsn_code
        gst_in = t_in.get("gst_rate") if "gst_rate" in t_in else (req.tax_rate if req.tax_rate is not None else style.tax_rate)
        tax_obj = existing_variant.tax_profile if existing_variant else None
        if not tax_obj:
            tax_obj = ItemTaxProfile(
                item_variant_id=variant.id,
                company_id=company_id,
                branch_id=branch_id,
                hsn_sac_code=hsn_in,
                tax_category=t_in.get("tax_category"),
                gst_rate=Decimal(str(gst_in)) if gst_in is not None else None,
                tax_inclusive=bool(t_in.get("tax_inclusive", True)),
                sales_tax_rate=Decimal(str(t_in["sales_tax_rate"])) if t_in.get("sales_tax_rate") is not None else None,
                purchase_tax_rate=Decimal(str(t_in["purchase_tax_rate"])) if t_in.get("purchase_tax_rate") is not None else None,
                tax_exempt=bool(t_in.get("tax_exempt", False)),
            )
            session.add(tax_obj)
        else:
            if hsn_in:
                tax_obj.hsn_sac_code = hsn_in
            if gst_in is not None:
                tax_obj.gst_rate = Decimal(str(gst_in))
            if "tax_category" in t_in:
                tax_obj.tax_category = t_in.get("tax_category")
            if "tax_inclusive" in t_in:
                tax_obj.tax_inclusive = bool(t_in.get("tax_inclusive"))
            if "tax_exempt" in t_in:
                tax_obj.tax_exempt = bool(t_in.get("tax_exempt"))

        # 4. Supplier Setting (optional)
        if req.purchasing:
            pur_in = req.purchasing
            purch_uom_res = await cls.resolve_uom_id(session, pur_in.get("purchase_uom_id"))
            supp_obj = existing_variant.supplier_setting if existing_variant else None
            if not supp_obj:
                supp_obj = ItemSupplierSetting(
                    item_variant_id=variant.id,
                    company_id=company_id,
                    branch_id=branch_id,
                    preferred_supplier_id=pur_in.get("preferred_supplier_id"),
                    supplier_item_code=pur_in.get("supplier_item_code"),
                    purchase_uom_id=purch_uom_res,
                    minimum_purchase_qty=Decimal(str(pur_in.get("minimum_purchase_qty", 1.0))),
                    purchase_cost=Decimal(str(pur_in["purchase_cost"])) if pur_in.get("purchase_cost") is not None else None,
                    last_purchase_price=Decimal(str(pur_in["last_purchase_price"])) if pur_in.get("last_purchase_price") is not None else None,
                    purchase_lead_time=int(pur_in.get("purchase_lead_time", 0)),
                    is_active=bool(pur_in.get("is_active", True)),
                )
                session.add(supp_obj)
            else:
                if pur_in.get("preferred_supplier_id"):
                    supp_obj.preferred_supplier_id = pur_in.get("preferred_supplier_id")
                if pur_in.get("supplier_item_code"):
                    supp_obj.supplier_item_code = pur_in.get("supplier_item_code")
                if purch_uom_res:
                    supp_obj.purchase_uom_id = purch_uom_res
                if "minimum_purchase_qty" in pur_in:
                    supp_obj.minimum_purchase_qty = Decimal(str(pur_in.get("minimum_purchase_qty", 1.0)))
                if pur_in.get("purchase_cost") is not None:
                    supp_obj.purchase_cost = Decimal(str(pur_in["purchase_cost"]))
                if pur_in.get("last_purchase_price") is not None:
                    supp_obj.last_purchase_price = Decimal(str(pur_in["last_purchase_price"]))
                if "purchase_lead_time" in pur_in:
                    supp_obj.purchase_lead_time = int(pur_in.get("purchase_lead_time", 0))

        # 5. Sales Setting
        s_in = req.sales or {}
        sales_uom_res = await cls.resolve_uom_id(session, s_in.get("sales_uom_id"))
        sales_disc = Decimal(str(s_in.get("maximum_discount_percent", max_disc)))
        if sales_disc < Decimal("0.0"):
            sales_disc = Decimal("0.0")
        elif sales_disc > Decimal("100.0"):
            sales_disc = Decimal("100.0")

        sales_obj = existing_variant.sales_setting if existing_variant else None
        if not sales_obj:
            sales_obj = ItemSalesSetting(
                item_variant_id=variant.id,
                company_id=company_id,
                branch_id=branch_id,
                sales_uom_id=sales_uom_res,
                selling_price=sp_dec,
                mrp=mrp_dec,
                wholesale_price=Decimal(str(s_in["wholesale_price"])) if s_in.get("wholesale_price") is not None else None,
                minimum_selling_price=Decimal(str(s_in["minimum_selling_price"])) if s_in.get("minimum_selling_price") is not None else None,
                maximum_discount_percent=sales_disc,
                allow_discount=bool(s_in.get("allow_discount", True)),
                billable=bool(s_in.get("billable", True)),
            )
            session.add(sales_obj)
        else:
            if req.selling_price is not None or "selling_price" in s_in:
                sales_obj.selling_price = sp_dec
            if req.mrp is not None or "mrp" in s_in:
                sales_obj.mrp = mrp_dec
            if sales_uom_res:
                sales_obj.sales_uom_id = sales_uom_res
            if s_in.get("wholesale_price") is not None:
                sales_obj.wholesale_price = Decimal(str(s_in["wholesale_price"]))
            if s_in.get("minimum_selling_price") is not None:
                sales_obj.minimum_selling_price = Decimal(str(s_in["minimum_selling_price"]))
            if "maximum_discount_percent" in s_in:
                sales_obj.maximum_discount_percent = sales_disc
            if "allow_discount" in s_in:
                sales_obj.allow_discount = bool(s_in.get("allow_discount"))
            if "billable" in s_in:
                sales_obj.billable = bool(s_in.get("billable"))

        # 6. Inventory Policy Setting
        if req.inventory_policy:
            inv_in = req.inventory_policy
            min_s = Decimal(str(inv_in.get("minimum_stock", 0.0)))
            reord_l = Decimal(str(inv_in.get("reorder_level", 0.0)))
            reord_q = Decimal(str(inv_in.get("reorder_quantity", 0.0)))
            max_s = Decimal(str(inv_in.get("maximum_stock", 0.0)))
            safety_s = Decimal(str(inv_in.get("safety_stock", 0.0)))
            lead_t = int(inv_in.get("lead_time", 0))

            if min_s < Decimal("0.0") or reord_l < Decimal("0.0") or reord_q < Decimal("0.0") or max_s < Decimal("0.0") or safety_s < Decimal("0.0") or lead_t < 0:
                raise BusinessLogicError("All inventory policy values must be non-negative.", code="SMRITI-INV-POLICY-NEGATIVE")
            if max_s > Decimal("0.0") and reord_l > max_s:
                raise BusinessLogicError("Reorder level cannot exceed maximum stock.", code="SMRITI-INV-POLICY-REORDER-EXCEEDS-MAX")

            inv_obj = existing_variant.inventory_policy if existing_variant else None
            if not inv_obj:
                inv_obj = ItemInventoryPolicy(
                    item_variant_id=variant.id,
                    company_id=company_id,
                    branch_id=branch_id,
                    minimum_stock=min_s,
                    reorder_level=reord_l,
                    reorder_quantity=reord_q,
                    maximum_stock=max_s,
                    safety_stock=safety_s,
                    lead_time=lead_t,
                    preferred_supplier_id=inv_in.get("preferred_supplier_id"),
                )
                session.add(inv_obj)
            else:
                inv_obj.minimum_stock = min_s
                inv_obj.reorder_level = reord_l
                inv_obj.reorder_quantity = reord_q
                inv_obj.maximum_stock = max_s
                inv_obj.safety_stock = safety_s
                inv_obj.lead_time = lead_t
                if inv_in.get("preferred_supplier_id"):
                    inv_obj.preferred_supplier_id = inv_in.get("preferred_supplier_id")

        if commit:
            await session.commit()
            await session.refresh(variant)

        return variant, created_pbe, created_barcode

    @classmethod
    async def save_variant_phase2_settings(
        cls,
        session: AsyncSession,
        variant_id: str,
        data: Dict[str, Any],
        company_id: str,
        branch_id: Optional[str] = None,
        commit: bool = True,
    ) -> ItemVariant:
        """
        Saves or updates Phase 2 domain configurations (UOM, Pricing, Tax, Purchasing, Sales, Inventory Policy)
        for an existing ItemVariant, synchronizing compatibility cache columns and enforcing invariants.
        """
        variant = await cls.get_variant(session, variant_id, company_id=company_id)
        if not variant:
            raise BusinessLogicError(f"Target variant '{variant_id}' not found.", code="SMRITI-VARIANT-NOT-FOUND")

        # 1. UOM Settings
        if "uom" in data and data["uom"]:
            u_in = data["uom"]
            stock_uom_res = await cls.resolve_uom_id(session, u_in.get("stock_uom_id")) or "uom_prs"
            sales_uom_res = await cls.resolve_uom_id(session, u_in.get("sales_uom_id"))
            purch_uom_res = await cls.resolve_uom_id(session, u_in.get("purchase_uom_id"))
            conv_f = Decimal(str(u_in.get("conversion_factor", 1.0)))
            if conv_f <= Decimal("0"):
                conv_f = Decimal("1.0")

            if variant.uom_setting:
                variant.uom_setting.stock_uom_id = stock_uom_res
                variant.uom_setting.sales_uom_id = sales_uom_res
                variant.uom_setting.purchase_uom_id = purch_uom_res
                variant.uom_setting.conversion_factor = conv_f
            else:
                variant.uom_setting = ItemUOMSetting(
                    item_variant_id=variant.id,
                    company_id=company_id,
                    branch_id=branch_id,
                    stock_uom_id=stock_uom_res,
                    sales_uom_id=sales_uom_res,
                    purchase_uom_id=purch_uom_res,
                    conversion_factor=conv_f,
                )
                session.add(variant.uom_setting)

        # 2. Pricing Settings
        if "pricing" in data and data["pricing"]:
            p_in = data["pricing"]
            sp = Decimal(str(p_in.get("selling_price", variant.selling_price or 0.0)))
            mrp = Decimal(str(p_in.get("mrp", variant.mrp or 0.0)))
            cp = Decimal(str(p_in.get("cost_price", variant.cost_price or 0.0)))
            disc = Decimal(str(p_in.get("maximum_discount_percent", 0.0)))
            if disc < Decimal("0.0"):
                disc = Decimal("0.0")
            elif disc > Decimal("100.0"):
                disc = Decimal("100.0")

            dp = Decimal(str(p_in["dealer_price"])) if p_in.get("dealer_price") is not None else None
            wp = Decimal(str(p_in["wholesale_price"])) if p_in.get("wholesale_price") is not None else None
            msp = Decimal(str(p_in["minimum_selling_price"])) if p_in.get("minimum_selling_price") is not None else None

            if variant.price_setting:
                variant.price_setting.selling_price = sp
                variant.price_setting.mrp = mrp
                variant.price_setting.cost_price = cp
                variant.price_setting.dealer_price = dp
                variant.price_setting.wholesale_price = wp
                variant.price_setting.minimum_selling_price = msp
                variant.price_setting.maximum_discount_percent = disc
                variant.price_setting.currency = p_in.get("currency", "INR")
                if "is_active" in p_in:
                    variant.price_setting.is_active = bool(p_in["is_active"])
            else:
                variant.price_setting = ItemPrice(
                    item_variant_id=variant.id,
                    company_id=company_id,
                    branch_id=branch_id,
                    selling_price=sp,
                    mrp=mrp,
                    cost_price=cp,
                    dealer_price=dp,
                    wholesale_price=wp,
                    minimum_selling_price=msp,
                    maximum_discount_percent=disc,
                    currency=p_in.get("currency", "INR"),
                    is_active=bool(p_in.get("is_active", True)),
                )
                session.add(variant.price_setting)

            # Sync compatibility baseline fields on item_variants
            variant.selling_price = sp
            variant.mrp = mrp
            variant.cost_price = cp

        # 3. Tax Profile Settings
        if "tax" in data and data["tax"]:
            t_in = data["tax"]
            hsn = t_in.get("hsn_sac_code")
            gst = Decimal(str(t_in["gst_rate"])) if t_in.get("gst_rate") is not None else None
            tax_inc = bool(t_in.get("tax_inclusive", True))
            tax_ex = bool(t_in.get("tax_exempt", False))

            if variant.tax_profile:
                variant.tax_profile.hsn_sac_code = hsn
                variant.tax_profile.tax_category = t_in.get("tax_category")
                variant.tax_profile.gst_rate = gst
                variant.tax_profile.tax_inclusive = tax_inc
                variant.tax_profile.tax_exempt = tax_ex
                if "sales_tax_rate" in t_in:
                    variant.tax_profile.sales_tax_rate = Decimal(str(t_in["sales_tax_rate"])) if t_in["sales_tax_rate"] is not None else None
                if "purchase_tax_rate" in t_in:
                    variant.tax_profile.purchase_tax_rate = Decimal(str(t_in["purchase_tax_rate"])) if t_in["purchase_tax_rate"] is not None else None
            else:
                variant.tax_profile = ItemTaxProfile(
                    item_variant_id=variant.id,
                    company_id=company_id,
                    branch_id=branch_id,
                    hsn_sac_code=hsn,
                    tax_category=t_in.get("tax_category"),
                    gst_rate=gst,
                    tax_inclusive=tax_inc,
                    tax_exempt=tax_ex,
                    sales_tax_rate=Decimal(str(t_in["sales_tax_rate"])) if t_in.get("sales_tax_rate") is not None else None,
                    purchase_tax_rate=Decimal(str(t_in["purchase_tax_rate"])) if t_in.get("purchase_tax_rate") is not None else None,
                )
                session.add(variant.tax_profile)

            # Sync compatibility baseline fields on item_variants
            if hsn:
                variant.hsn_code = hsn
            if gst is not None:
                variant.tax_rate = gst

        # 4. Purchasing Settings
        if "purchasing" in data and data["purchasing"]:
            pur_in = data["purchasing"]
            purch_uom_res = await cls.resolve_uom_id(session, pur_in.get("purchase_uom_id"))
            pref_supp_id = pur_in.get("preferred_supplier_id")
            supp_code = pur_in.get("supplier_item_code")
            min_pq = Decimal(str(pur_in.get("minimum_purchase_qty", 1.0)))
            pcost = Decimal(str(pur_in["purchase_cost"])) if pur_in.get("purchase_cost") is not None else None
            last_pp = Decimal(str(pur_in["last_purchase_price"])) if pur_in.get("last_purchase_price") is not None else None
            lead_t = int(pur_in.get("purchase_lead_time", 0))

            if variant.supplier_setting:
                variant.supplier_setting.preferred_supplier_id = pref_supp_id
                variant.supplier_setting.supplier_item_code = supp_code
                variant.supplier_setting.purchase_uom_id = purch_uom_res
                variant.supplier_setting.minimum_purchase_qty = min_pq
                variant.supplier_setting.purchase_cost = pcost
                if last_pp is not None:
                    variant.supplier_setting.last_purchase_price = last_pp
                variant.supplier_setting.purchase_lead_time = lead_t
                if "is_active" in pur_in:
                    variant.supplier_setting.is_active = bool(pur_in["is_active"])
            else:
                variant.supplier_setting = ItemSupplierSetting(
                    item_variant_id=variant.id,
                    company_id=company_id,
                    branch_id=branch_id,
                    preferred_supplier_id=pref_supp_id,
                    supplier_item_code=supp_code,
                    purchase_uom_id=purch_uom_res,
                    minimum_purchase_qty=min_pq,
                    purchase_cost=pcost,
                    last_purchase_price=last_pp,
                    purchase_lead_time=lead_t,
                    is_active=bool(pur_in.get("is_active", True)),
                )
                session.add(variant.supplier_setting)

        # 5. Sales Settings
        if "sales" in data and data["sales"]:
            s_in = data["sales"]
            sales_uom_res = await cls.resolve_uom_id(session, s_in.get("sales_uom_id"))
            sp_val = Decimal(str(s_in.get("selling_price", variant.selling_price or 0.0)))
            mrp_val = Decimal(str(s_in.get("mrp", variant.mrp or 0.0)))
            s_disc = Decimal(str(s_in.get("maximum_discount_percent", 0.0)))
            if s_disc < Decimal("0.0"):
                s_disc = Decimal("0.0")
            elif s_disc > Decimal("100.0"):
                s_disc = Decimal("100.0")

            if variant.sales_setting:
                variant.sales_setting.sales_uom_id = sales_uom_res
                variant.sales_setting.selling_price = sp_val
                variant.sales_setting.mrp = mrp_val
                variant.sales_setting.wholesale_price = Decimal(str(s_in["wholesale_price"])) if s_in.get("wholesale_price") is not None else None
                variant.sales_setting.minimum_selling_price = Decimal(str(s_in["minimum_selling_price"])) if s_in.get("minimum_selling_price") is not None else None
                variant.sales_setting.maximum_discount_percent = s_disc
                if "allow_discount" in s_in:
                    variant.sales_setting.allow_discount = bool(s_in["allow_discount"])
                if "billable" in s_in:
                    variant.sales_setting.billable = bool(s_in["billable"])
            else:
                variant.sales_setting = ItemSalesSetting(
                    item_variant_id=variant.id,
                    company_id=company_id,
                    branch_id=branch_id,
                    sales_uom_id=sales_uom_res,
                    selling_price=sp_val,
                    mrp=mrp_val,
                    wholesale_price=Decimal(str(s_in["wholesale_price"])) if s_in.get("wholesale_price") is not None else None,
                    minimum_selling_price=Decimal(str(s_in["minimum_selling_price"])) if s_in.get("minimum_selling_price") is not None else None,
                    maximum_discount_percent=s_disc,
                    allow_discount=bool(s_in.get("allow_discount", True)),
                    billable=bool(s_in.get("billable", True)),
                )
                session.add(variant.sales_setting)

        # 6. Inventory Policy Settings
        if "inventory_policy" in data and data["inventory_policy"]:
            inv_in = data["inventory_policy"]
            min_s = Decimal(str(inv_in.get("minimum_stock", 0.0)))
            reord_l = Decimal(str(inv_in.get("reorder_level", 0.0)))
            reord_q = Decimal(str(inv_in.get("reorder_quantity", 0.0)))
            max_s = Decimal(str(inv_in.get("maximum_stock", 0.0)))
            safety_s = Decimal(str(inv_in.get("safety_stock", 0.0)))
            lead_t = int(inv_in.get("lead_time", 0))

            if min_s < Decimal("0.0") or reord_l < Decimal("0.0") or reord_q < Decimal("0.0") or max_s < Decimal("0.0") or safety_s < Decimal("0.0") or lead_t < 0:
                raise BusinessLogicError("All inventory policy values must be non-negative.", code="SMRITI-INV-POLICY-NEGATIVE")
            if max_s > Decimal("0.0") and reord_l > max_s:
                raise BusinessLogicError("Reorder level cannot exceed maximum stock.", code="SMRITI-INV-POLICY-REORDER-EXCEEDS-MAX")

            if variant.inventory_policy:
                variant.inventory_policy.minimum_stock = min_s
                variant.inventory_policy.reorder_level = reord_l
                variant.inventory_policy.reorder_quantity = reord_q
                variant.inventory_policy.maximum_stock = max_s
                variant.inventory_policy.safety_stock = safety_s
                variant.inventory_policy.lead_time = lead_t
                variant.inventory_policy.preferred_supplier_id = inv_in.get("preferred_supplier_id")
            else:
                variant.inventory_policy = ItemInventoryPolicy(
                    item_variant_id=variant.id,
                    company_id=company_id,
                    branch_id=branch_id,
                    minimum_stock=min_s,
                    reorder_level=reord_l,
                    reorder_quantity=reord_q,
                    maximum_stock=max_s,
                    safety_stock=safety_s,
                    lead_time=lead_t,
                    preferred_supplier_id=inv_in.get("preferred_supplier_id"),
                )
                session.add(variant.inventory_policy)

        if commit:
            await session.commit()

        # Reload with all relationships
        loaded = await cls.get_variant(session, variant.id, company_id=company_id)
        return loaded or variant

    @classmethod
    async def get_variant_readiness(
        cls,
        session: AsyncSession,
        variant_id: str,
        company_id: Optional[str] = None,
        require_barcode: bool = False,
    ) -> Dict[str, Any]:
        """Evaluates readiness of an ItemVariant, returning structured blocking reasons."""
        variant = await cls.get_variant(session, variant_id, company_id=company_id)
        if not variant:
            raise BusinessLogicError(f"Target variant '{variant_id}' not found.", code="SMRITI-VARIANT-NOT-FOUND")
        return ItemReadinessEngine.evaluate_orm_variant(variant, require_barcode=require_barcode)

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
        # Prohibit synthetic / placeholder barcodes
        if re.match(r"^(890GEN|ITM-|S\d{12})", b_clean, re.IGNORECASE) or (len(b_clean) == 36 and "-" in b_clean):
            raise BusinessLogicError(
                message="Synthetic or auto-generated placeholder barcodes are strictly prohibited.",
                code="SMRITI-SYNTHETIC-BARCODE-PROHIBITED",
            )

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

        # Enforce Rule: Only one active primary barcode per variant (Multiple primary barcodes rejected)
        if req.is_primary:
            stmt_prim = select(ItemBarcode).where(
                ItemBarcode.company_id == company_id,
                ItemBarcode.variant_id == variant.id,
                ItemBarcode.is_primary == True,
                ItemBarcode.is_deleted == False,
            )
            existing_prim = (await session.execute(stmt_prim)).scalars().first()
            if existing_prim:
                raise BusinessLogicError(
                    message=f"Variant '{variant.id}' already has an active primary barcode ({existing_prim.barcode}). Multiple primary barcodes are not allowed.",
                    code="SMRITI-PRIMARY-BARCODE-COLLISION",
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

    @classmethod
    async def propose_sku(
        cls,
        session: AsyncSession,
        company_id: str,
        style_code: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Deterministic, collision-safe, tenant-aware SKU proposal engine (Case 4).
        Zero persistence, zero counter burn. Candidate is only persisted after
        explicit user approval on form submission.
        """
        stmt = select(ItemVariant.variant_sku).where(
            ItemVariant.company_id == company_id,
            ItemVariant.variant_sku.like("SMR-ITM-%"),
            ItemVariant.is_deleted == False,
        )
        existing_skus = (await session.execute(stmt)).scalars().all()
        highest_seq = 0
        for s in existing_skus:
            num_part = s.replace("SMR-ITM-", "")
            if num_part.isdigit():
                highest_seq = max(highest_seq, int(num_part))

        next_cand = highest_seq + 1
        candidate_sku = f"SMR-ITM-{str(next_cand).zfill(6)}"

        # Validate collision-safe uniqueness within tenant/company scope
        while True:
            chk = await session.execute(
                select(ItemVariant.id).where(
                    ItemVariant.company_id == company_id,
                    ItemVariant.variant_sku == candidate_sku,
                    ItemVariant.is_deleted == False,
                )
            )
            if not chk.scalars().first():
                break
            next_cand += 1
            candidate_sku = f"SMR-ITM-{str(next_cand).zfill(6)}"

        return {
            "proposed_sku": candidate_sku,
            "status": "PROPOSED",
            "message": f"Proposed SKU: {candidate_sku}. Awaiting explicit user approval before persistence.",
        }

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

    # ---------------------------------------------------------------------------
    # 5. ItemVariant Mutation, Deactivation & Guarded Hard Delete
    # ---------------------------------------------------------------------------

    @classmethod
    async def check_variant_deletion_status(
        cls,
        session: AsyncSession,
        variant_id_or_sku: str,
        company_id: str,
    ) -> Dict[str, Any]:
        """
        Pre-flight check to determine if an ItemVariant can be permanently hard-deleted.
        Guarantees that 0 transactions exist across all operational ledgers.
        """
        v_clean = variant_id_or_sku.strip()
        stmt = (
            select(ItemVariant)
            .where(
                ItemVariant.company_id == company_id,
                or_(
                    ItemVariant.id == v_clean,
                    func.lower(ItemVariant.variant_sku) == v_clean.lower(),
                ),
            )
            .options(
                selectinload(ItemVariant.barcodes),
                selectinload(ItemVariant.item),
            )
        )
        variant = (await session.execute(stmt)).scalars().first()
        if not variant and company_id:
            # Fallback: check if variant_id_or_sku is a legacy Product.id
            prod_row = (await session.execute(
                select(Product).where(
                    Product.company_id == company_id,
                    Product.id == v_clean,
                )
            )).scalars().first()
            if prod_row:
                if prod_row.item_variant_id:
                    stmt2 = select(ItemVariant).where(
                        ItemVariant.id == prod_row.item_variant_id,
                        ItemVariant.company_id == company_id,
                    ).options(
                        selectinload(ItemVariant.barcodes),
                        selectinload(ItemVariant.item),
                    )
                    variant = (await session.execute(stmt2)).scalars().first()
                if not variant and (prod_row.sku or prod_row.code):
                    target_sku = (prod_row.sku or prod_row.code).strip()
                    stmt3 = select(ItemVariant).where(
                        func.lower(ItemVariant.variant_sku) == target_sku.lower(),
                        ItemVariant.company_id == company_id,
                    ).options(
                        selectinload(ItemVariant.barcodes),
                        selectinload(ItemVariant.item),
                    )
                    variant = (await session.execute(stmt3)).scalars().first()
        if not variant:
            raise BusinessLogicError(f"ItemVariant '{variant_id_or_sku}' not found.", code="SMRITI-DATA-004")

        var_id = variant.id
        sku = variant.variant_sku
        barcodes = [b.barcode for b in variant.barcodes if b.barcode and not b.is_deleted]

        # Locate legacy product row if exists
        prod_stmt = select(Product).where(
            Product.company_id == company_id,
            or_(
                Product.sku == sku,
                Product.code == sku,
                Product.item_variant_id == var_id,
            ),
        )
        prod = (await session.execute(prod_stmt)).scalars().first()
        prod_id = prod.id if prod else None

        # 1. Sales Invoices
        conds_si = [SalesInvoiceItem.variant_id == var_id, SalesInvoiceItem.code == sku]
        if prod_id:
            conds_si.append(SalesInvoiceItem.product_id == prod_id)
        count_si = await session.scalar(select(func.count(SalesInvoiceItem.id)).where(or_(*conds_si))) or 0

        # 2. Sales Orders
        conds_so = [SalesOrderItem.variant_id == var_id, SalesOrderItem.code == sku]
        if prod_id:
            conds_so.append(SalesOrderItem.product_id == prod_id)
        count_so = await session.scalar(select(func.count(SalesOrderItem.id)).where(or_(*conds_so))) or 0

        # 3. Sales Returns
        conds_sr = [SalesReturnItem.variant_id == var_id, SalesReturnItem.code == sku]
        if prod_id:
            conds_sr.append(SalesReturnItem.product_id == prod_id)
        count_sr = await session.scalar(select(func.count(SalesReturnItem.id)).where(or_(*conds_sr))) or 0

        # 4. Purchase Receipts (GRN)
        conds_grn = [PurchaseReceiptItem.variant_id == var_id, PurchaseReceiptItem.code == sku]
        if prod_id:
            conds_grn.append(PurchaseReceiptItem.product_id == prod_id)
        count_grn = await session.scalar(select(func.count(PurchaseReceiptItem.id)).where(or_(*conds_grn))) or 0

        # 5. Purchase Orders
        conds_po = [PurchaseOrderItem.variant_id == var_id, PurchaseOrderItem.code == sku]
        if prod_id:
            conds_po.append(PurchaseOrderItem.product_id == prod_id)
        count_po = await session.scalar(select(func.count(PurchaseOrderItem.id)).where(or_(*conds_po))) or 0

        # 6. Purchase Bills
        conds_pb = [PurchaseBillItem.code == sku]
        if prod_id:
            conds_pb.append(PurchaseBillItem.product_id == prod_id)
        count_pb = await session.scalar(select(func.count(PurchaseBillItem.id)).where(or_(*conds_pb))) or 0

        # 7. Stock Movements
        conds_sm = [StockMovement.variant_id == var_id, StockMovement.sku == sku]
        if prod_id:
            conds_sm.append(StockMovement.product_id == prod_id)
        count_sm = await session.scalar(select(func.count(StockMovement.id)).where(or_(*conds_sm))) or 0

        # 8. Stock Transfers
        count_st = 0
        if prod_id:
            count_st = await session.scalar(
                select(func.count(StockTransferItem.id)).where(StockTransferItem.product_id == prod_id)
            ) or 0

        # 9. Stock Audits
        count_sa = 0
        if prod_id:
            count_sa = await session.scalar(
                select(func.count(StockAuditItem.id)).where(StockAuditItem.product_id == prod_id)
            ) or 0

        # 10. Physical remaining stock
        stock_qty = float(prod.stock or 0.0) if prod else 0.0

        # 11. Batches attached to variant
        count_batches = await session.scalar(
            select(func.count(ItemBatch.id)).where(
                ItemBatch.variant_id == var_id,
                ItemBatch.is_active == True,
            )
        ) or 0

        # 12. Active Serials
        count_serials = await session.scalar(
            select(func.count(ItemSerial.id)).where(
                ItemSerial.variant_id == var_id,
            )
        ) or 0

        blocking_reasons = []
        if count_si > 0:
            blocking_reasons.append(f"{count_si} Sales Invoice item(s)")
        if count_so > 0:
            blocking_reasons.append(f"{count_so} Sales Order line(s)")
        if count_sr > 0:
            blocking_reasons.append(f"{count_sr} Sales Return line(s)")
        if count_grn > 0:
            blocking_reasons.append(f"{count_grn} Goods Receipt Note (GRN) item(s)")
        if count_po > 0:
            blocking_reasons.append(f"{count_po} Purchase Order line(s)")
        if count_pb > 0:
            blocking_reasons.append(f"{count_pb} Purchase Bill line(s)")
        if count_sm > 0:
            blocking_reasons.append(f"{count_sm} Stock Movement entry/entries")
        if count_st > 0:
            blocking_reasons.append(f"{count_st} Stock Transfer item(s)")
        if count_sa > 0:
            blocking_reasons.append(f"{count_sa} Physical Stock Audit item(s)")
        if stock_qty > 0:
            blocking_reasons.append(f"Physical Stock balance of {stock_qty:g} units")
        if count_batches > 0:
            blocking_reasons.append(f"{count_batches} active Batch record(s) with quantity")
        if count_serials > 0:
            blocking_reasons.append(f"{count_serials} active Serialized item(s)")

        total_tx = (
            count_si + count_so + count_sr + count_grn + count_po + count_pb
            + count_sm + count_st + count_sa + (1 if stock_qty > 0 else 0)
            + count_batches + count_serials
        )

        can_hard_delete = len(blocking_reasons) == 0
        rec = (
            "Record has 0 transactions and can be safely permanently deleted from the database."
            if can_hard_delete
            else f"Record has live transactions ({', '.join(blocking_reasons)}). Use Deactivate instead to preserve statutory audit and ledger integrity."
        )

        return {
            "variant_id": variant.id,
            "variant_sku": variant.variant_sku,
            "is_active": variant.is_active,
            "can_hard_delete": can_hard_delete,
            "transaction_count": total_tx,
            "blocking_reasons": blocking_reasons,
            "recommendation": rec,
        }

    @classmethod
    async def hard_delete_variant(
        cls,
        session: AsyncSession,
        variant_id_or_sku: str,
        company_id: str,
        current_user: Any,
    ) -> Dict[str, Any]:
        """
        Permanently purges an un-transacted ItemVariant, freeing its SKU and barcodes.
        Guarded: raises BusinessLogicError (code SMRITI-VARIANT-TRANSACTED) if transactions exist.
        """
        status = await cls.check_variant_deletion_status(session, variant_id_or_sku, company_id)
        if not status["can_hard_delete"]:
            raise BusinessLogicError(
                f"Cannot hard delete variant '{status['variant_sku']}': it is transacted in "
                f"{', '.join(status['blocking_reasons'])}. Please use Deactivate instead.",
                code="SMRITI-VARIANT-TRANSACTED",
            )

        variant = await cls.get_variant(session, status["variant_id"], company_id=company_id)
        if not variant:
            raise BusinessLogicError(f"Variant '{variant_id_or_sku}' not found.", code="SMRITI-DATA-004")

        released_sku = variant.variant_sku
        released_barcodes = [b.barcode for b in variant.barcodes if b.barcode]
        parent_item_id = variant.item_id
        username = (
            current_user.get("username")
            if isinstance(current_user, dict)
            else getattr(current_user, "username", "SYSTEM")
        )
        user_role = (
            current_user.get("role")
            if isinstance(current_user, dict)
            else getattr(current_user, "role", "SYSADMIN")
        )

        # 1. Prepare WORM audit snapshot
        snapshot = {
            "variant_id": variant.id,
            "item_id": variant.item_id,
            "company_id": variant.company_id,
            "variant_sku": variant.variant_sku,
            "variant_name": variant.variant_name,
            "color": variant.color,
            "size": variant.size,
            "hsn_code": variant.hsn_code,
            "tax_rate": float(variant.tax_rate) if variant.tax_rate is not None else None,
            "mrp": float(variant.mrp or 0.0),
            "selling_price": float(variant.selling_price or 0.0),
            "cost_price": float(variant.cost_price or 0.0),
            "barcodes": released_barcodes,
            "purged_by": username,
            "purged_at": datetime.now(timezone.utc).isoformat(),
            "reason": "Hard delete of un-transacted variant to release SKU and barcode.",
        }
        raw_json = json.dumps(snapshot, sort_keys=True)
        payload_hash = hashlib.sha256(raw_json.encode()).hexdigest()

        audit_entry = ComplianceImmutableAuditLog(
            id=f"aud_{uuid.uuid4().hex[:12]}",
            company_id=company_id,
            event_type="ITEM_VARIANT_HARD_DELETED",
            entity_name="item_variants",
            entity_id=variant.id,
            actor_user_id=username,
            actor_role=str(user_role),
            before_state_json=raw_json,
            after_state_json=None,
            action_summary=f"Permanently purged un-transacted SKU '{released_sku}' and released {len(released_barcodes)} barcode(s).",
            payload_hash=payload_hash,
            worm_locked=True,
        )
        session.add(audit_entry)

        # 2. Atomic Physical Cleanup
        # Barcode registry audit records (if any)
        for b in list(variant.barcodes):
            await session.execute(
                delete(BarcodeRegistryAudit).where(BarcodeRegistryAudit.barcode_id == b.id)
            )

        # Price book entries, revisions, and customer article mappings
        await session.execute(
            delete(PriceBookEntry).where(PriceBookEntry.variant_id == variant.id)
        )
        await session.execute(
            delete(ItemPriceRevision).where(ItemPriceRevision.variant_id == variant.id)
        )
        await session.execute(
            delete(CustomerArticleMapping).where(CustomerArticleMapping.variant_id == variant.id)
        )

        # Delete matching legacy Product row
        await session.execute(
            delete(Product).where(
                Product.company_id == company_id,
                or_(
                    Product.sku == released_sku,
                    Product.code == released_sku,
                    Product.item_variant_id == variant.id,
                ),
            )
        )

        # Delete variant itself (SQLAlchemy cascades delete-orphan to barcodes, batches, serials, uom, price, tax, etc.)
        await session.delete(variant)

        # Check if parent style has remaining variants
        rem_count = await session.scalar(
            select(func.count(ItemVariant.id)).where(
                ItemVariant.item_id == parent_item_id,
                ItemVariant.id != variant.id,
                ItemVariant.is_deleted == False,
            )
        ) or 0

        parent_style_deleted = False
        if rem_count == 0:
            p_cond_si = [SalesInvoiceItem.item_id == parent_item_id]
            p_cond_grn = [PurchaseReceiptItem.item_id == parent_item_id]
            p_cond_po = [PurchaseOrderItem.item_id == parent_item_id]
            tx_parent = (
                (await session.scalar(select(func.count(SalesInvoiceItem.id)).where(or_(*p_cond_si))) or 0)
                + (await session.scalar(select(func.count(PurchaseReceiptItem.id)).where(or_(*p_cond_grn))) or 0)
                + (await session.scalar(select(func.count(PurchaseOrderItem.id)).where(or_(*p_cond_po))) or 0)
            )
            if tx_parent == 0:
                parent_item = await session.get(Item, parent_item_id)
                if parent_item:
                    await session.delete(parent_item)
                    parent_style_deleted = True

        await session.commit()

        return {
            "success": True,
            "variant_id": status["variant_id"],
            "released_sku": released_sku,
            "released_barcodes": released_barcodes,
            "parent_style_deleted": parent_style_deleted,
            "message": f"SKU '{released_sku}' and {len(released_barcodes)} barcode(s) successfully permanently deleted and released from database.",
        }

    @classmethod
    async def update_variant(
        cls,
        session: AsyncSession,
        variant_id_or_sku: str,
        req: ItemVariantUpdateRequest,
        company_id: str,
        current_user: Any,
    ) -> ItemVariant:
        """
        Updates an ItemVariant.
        - Commercial & policy fields (mrp, price, cost, hsn, tax, active status) can always be updated.
        - Identity fields (sku, color, size, primary barcode) can be corrected ONLY IF the variant is un-transacted.
        - If transacted, attempts to modify identity fields are rejected with SMRITI-IDENTITY-TRANSACTED.
        """
        variant = await cls.get_variant(session, variant_id_or_sku, company_id=company_id)
        if not variant:
            raise BusinessLogicError(f"Variant '{variant_id_or_sku}' not found.", code="SMRITI-DATA-004")

        # 1. Detect identity field changes
        identity_changes = []
        new_sku = req.variant_sku.strip() if req.variant_sku else None
        if new_sku and new_sku != variant.variant_sku:
            identity_changes.append("SKU")
        new_color = req.color.strip() if req.color is not None else None
        if new_color and new_color != (variant.color or ""):
            identity_changes.append("Color")
        new_size = req.size.strip() if req.size is not None else None
        if new_size and new_size != (variant.size or ""):
            identity_changes.append("Size")

        current_primary_bc = next((b.barcode for b in variant.barcodes if b.is_primary and not b.is_deleted), None)
        new_barcode = req.primary_barcode.strip().upper() if req.primary_barcode else None
        if new_barcode and new_barcode != current_primary_bc:
            identity_changes.append("Primary Barcode")

        if identity_changes:
            status = await cls.check_variant_deletion_status(session, variant.id, company_id)
            if not status["can_hard_delete"]:
                raise BusinessLogicError(
                    f"Cannot modify {', '.join(identity_changes)} on transacted variant '{variant.variant_sku}' "
                    f"({', '.join(status['blocking_reasons'])}). Identity fields are permanent once transacted to "
                    f"preserve tax, ledger, and historical invoice integrity. You can update pricing or deactivate this variant.",
                    code="SMRITI-IDENTITY-TRANSACTED",
                )

            # Physical identity is (company, style, color, size). SKU uniqueness
            # alone does not prevent two variants in the same style from
            # acquiring the same dimensions during an edit.
            candidate_color = (new_color.strip().upper() if new_color is not None else (variant.color or "").strip().upper()) or None
            candidate_size = (new_size.strip().upper() if new_size is not None else (variant.size or "").strip().upper()) or None
            if candidate_color is not None and candidate_size is not None:
                duplicate = await session.scalar(
                    select(ItemVariant.id).where(
                        ItemVariant.company_id == company_id,
                        ItemVariant.item_id == variant.item_id,
                        func.upper(func.coalesce(ItemVariant.color, "")) == (candidate_color or ""),
                        func.upper(func.coalesce(ItemVariant.size, "")) == (candidate_size or ""),
                        ItemVariant.id != variant.id,
                        ItemVariant.is_deleted == False,
                    ).limit(1)
                )
                if duplicate:
                    raise BusinessLogicError(
                        "Another variant already uses this Style, Color, and Size combination.",
                        code="SMRITI-VARIANT-COMBINATION-COLLISION",
                    )

            # Validate SKU uniqueness if SKU changed
            if new_sku and new_sku != variant.variant_sku:
                collision = await session.scalar(
                    select(ItemVariant.id).where(
                        ItemVariant.company_id == company_id,
                        ItemVariant.variant_sku == new_sku,
                        ItemVariant.id != variant.id,
                        ItemVariant.is_deleted == False,
                    )
                )
                if collision:
                    raise BusinessLogicError(
                        f"SKU '{new_sku}' is already in use by another variant in this company.",
                        code="SMRITI-SKU-COLLISION",
                    )
                variant.variant_sku = new_sku

            if new_color is not None:
                if new_color.strip():
                    from .catalog_validation import CatalogDimensionValidator
                    norm_color = await CatalogDimensionValidator.validate_and_normalize_dimension(
                        "color", new_color, strict=True, control_db=session
                    )
                    variant.color = norm_color
                else:
                    variant.color = None
                if isinstance(variant.attributes_json, dict):
                    variant.attributes_json = {**variant.attributes_json, "color": variant.color}

            if new_size is not None:
                if new_size.strip():
                    from .catalog_validation import CatalogDimensionValidator
                    norm_size = await CatalogDimensionValidator.validate_and_normalize_dimension(
                        "size", new_size, strict=True, control_db=session
                    )
                    variant.size = norm_size
                else:
                    variant.size = None
                if isinstance(variant.attributes_json, dict):
                    variant.attributes_json = {**variant.attributes_json, "size": variant.size}

            # If color/size changed and SKU wasn't explicitly provided, recalculate SKU
            if not new_sku and (new_color or new_size):
                parent_style_code = variant.item.item_code if variant.item else "STYLE"
                c_val = variant.color or "STD"
                s_val = variant.size or "STD"
                auto_sku = f"{parent_style_code}-{c_val}-{s_val}".upper()
                collision = await session.scalar(
                    select(ItemVariant.id).where(
                        ItemVariant.company_id == company_id,
                        ItemVariant.variant_sku == auto_sku,
                        ItemVariant.id != variant.id,
                        ItemVariant.is_deleted == False,
                    )
                )
                if not collision:
                    variant.variant_sku = auto_sku

            # Update / replace primary barcode if provided
            if new_barcode and new_barcode != current_primary_bc:
                bc_collision = await session.scalar(
                    select(ItemBarcode.id).where(
                        ItemBarcode.company_id == company_id,
                        ItemBarcode.barcode == new_barcode,
                        ItemBarcode.variant_id != variant.id,
                        ItemBarcode.is_deleted == False,
                    )
                )
                if bc_collision:
                    raise BusinessLogicError(
                        f"Barcode '{new_barcode}' is already assigned to another variant.",
                        code="SMRITI-BARCODE-COLLISION",
                    )
                for b in variant.barcodes:
                    if b.is_primary:
                        b.is_primary = False
                existing_bc = next((b for b in variant.barcodes if b.barcode == new_barcode), None)
                if existing_bc:
                    existing_bc.is_primary = True
                    existing_bc.is_active = True
                else:
                    new_bc_obj = ItemBarcode(
                        id=f"bc_{uuid.uuid4().hex[:12]}",
                        company_id=company_id,
                        item_id=variant.item_id,
                        variant_id=variant.id,
                        barcode=new_barcode,
                        barcode_type="EAN13",
                        is_primary=True,
                        is_active=True,
                        is_deleted=False,
                    )
                    session.add(new_bc_obj)
                    variant.barcodes.append(new_bc_obj)

        # 2. Update commercial & metadata fields
        if req.variant_name is not None:
            variant.variant_name = req.variant_name
        if req.hsn_code is not None:
            variant.hsn_code = req.hsn_code
        if req.tax_rate is not None:
            variant.tax_rate = Decimal(str(req.tax_rate))
        if req.mrp is not None:
            variant.mrp = Decimal(str(req.mrp))
        if req.selling_price is not None:
            variant.selling_price = Decimal(str(req.selling_price))
        if req.cost_price is not None:
            variant.cost_price = Decimal(str(req.cost_price))
        if req.is_active is not None:
            variant.is_active = req.is_active
        if req.attributes_json is not None:
            # Color and Size are first-class identity columns. Generic metadata
            # writes cannot silently diverge from those canonical dimensions.
            metadata = dict(req.attributes_json)
            metadata["color"] = variant.color
            metadata["size"] = variant.size
            variant.attributes_json = metadata

        # 3. Synchronize secondary barcodes if provided
        if req.secondary_barcodes is not None:
            sec_clean = [str(x).strip().upper() for x in req.secondary_barcodes if str(x).strip()]
            current_barcodes = {b.barcode: b for b in variant.barcodes if not b.is_deleted}
            for sec_val in sec_clean:
                if sec_val not in current_barcodes:
                    bc_coll = await session.scalar(
                        select(ItemBarcode.id).where(
                            ItemBarcode.company_id == company_id,
                            ItemBarcode.barcode == sec_val,
                            ItemBarcode.variant_id != variant.id,
                            ItemBarcode.is_deleted == False,
                        )
                    )
                    if bc_coll:
                        raise BusinessLogicError(
                            f"Secondary barcode '{sec_val}' is already assigned to another variant.",
                            code="SMRITI-BARCODE-COLLISION",
                        )
                    sec_bc = ItemBarcode(
                        id=f"bc_{uuid.uuid4().hex[:12]}",
                        company_id=company_id,
                        item_id=variant.item_id,
                        variant_id=variant.id,
                        barcode=sec_val,
                        barcode_type="CODE128",
                        is_primary=False,
                        is_active=True,
                        is_deleted=False,
                    )
                    session.add(sec_bc)
                    variant.barcodes.append(sec_bc)

        # 4. Sync PriceBookEntry
        if req.selling_price is not None or req.mrp is not None:
            pbe = await session.scalar(
                select(PriceBookEntry).where(
                    PriceBookEntry.variant_id == variant.id,
                ).limit(1)
            )
            if pbe:
                if req.selling_price is not None:
                    pbe.selling_price = Decimal(str(req.selling_price))
                if req.mrp is not None:
                    pbe.mrp = Decimal(str(req.mrp))
                if req.cost_price is not None:
                    pbe.cost_price = Decimal(str(req.cost_price))

        # 5. Sync to legacy Product table
        prod_stmt = select(Product).where(
            Product.company_id == company_id,
            or_(
                Product.sku == variant.variant_sku,
                Product.code == variant.variant_sku,
                Product.item_variant_id == variant.id,
            ),
        )
        prod = (await session.execute(prod_stmt)).scalars().first()
        if prod:
            if req.variant_name:
                prod.name = req.variant_name
            if req.selling_price is not None:
                prod.price = float(req.selling_price)
            if req.mrp is not None:
                prod.mrp = float(req.mrp)
            if req.cost_price is not None:
                prod.costPrice = float(req.cost_price)
            if req.is_active is not None:
                prod.is_active = req.is_active
            if variant.color:
                prod.color = variant.color
            if variant.size:
                prod.size = variant.size
            if variant.variant_sku:
                prod.sku = variant.variant_sku
                prod.code = variant.variant_sku
            if req.primary_barcode:
                prod.barcode = req.primary_barcode
            if req.secondary_barcodes is not None:
                prod.secondary_barcodes = req.secondary_barcodes

        await session.commit()
        return await cls.get_variant(session, variant.id, company_id=company_id)

