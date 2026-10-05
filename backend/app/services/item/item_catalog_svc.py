"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.17.0
Created      : 2026-10-05
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

ItemCatalogService
──────────────────
Responsibility: Item master catalog lifecycle, CRUD, search, and atomic creation.
Extracted from: item_master_svc.py::generate_placeholder_barcode (L60–L88)
                item_master_svc.py::get_item_by_code (L89–L115)
                item_master_svc.py::create_item (L116–L929)
                item_master_svc.py::get_item_by_id (L1528–L1544)
                item_master_svc.py::list_items (L1545–L1584)

SRP: Manages the canonical item definitions, catalog dimensions, and query retrieval.
"""

import uuid
import re
from datetime import date
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import select, or_, and_, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from fastapi import HTTPException

from ..identity.engine import IdentityEngine
from ..documents_engine import DocumentsEngine

from ...models.item_master import (
    Item,
    ItemVariant,
    ItemBarcode,
    ItemBatch,
    ItemSerial,
    ItemWarehouseLocation,
    LegacyIdMapping,
)
from ...models.inventory import Product
from ...models.pricing import PriceBook, PriceBookEntry
from ...models.vendor_product_assignment import VendorProductAssignment
from ...schemas.item_master import (
    ItemCreateRequest,
)


class ItemCatalogService:
    """
    Item Master Catalog Service.
    Handles canonical item creation, unique code retrieval, ID retrieval, and listing.
    """

    @classmethod
    def generate_placeholder_barcode(
        cls,
        prefix: Optional[str] = "S",
        allow_no_prefix: bool = True,
    ) -> str:
        """Return a system-generated placeholder barcode.

        Policy rules:
        - Default prefix is 'S' (e.g. S8A7F3D1B2C4E).
        - If prefix is provided (e.g. GEN, SMRITI, SKU, VX, BRC), it is sanitized,
          converted to uppercase, and prepended to a 12-char hex token.
        - If prefix is None or empty (""):
            - If allow_no_prefix is True: emits the bare 12-char uppercase hex token (e.g. 8A7F3D1B2C4E).
            - If allow_no_prefix is False: defaults back to the canonical 'S' prefix.
        - Only alphanumeric prefixes (and underscores/hyphens) are permitted; unsafe characters are stripped.
        """
        raw_token = uuid.uuid4().hex[:12].upper()
        if prefix is None or (isinstance(prefix, str) and not prefix.strip()):
            if allow_no_prefix:
                return raw_token
            return f"S{raw_token}"

        clean_pfx = re.sub(r"[^A-Za-z0-9_-]", "", str(prefix).strip()).upper()
        if not clean_pfx:
            return raw_token if allow_no_prefix else f"S{raw_token}"
        return f"{clean_pfx}{raw_token}"

    @classmethod
    async def get_item_by_code(
        cls,
        session: AsyncSession,
        item_code: str,
        company_id: Optional[str] = None,
    ) -> Optional[Item]:
        """Fetches an item by unique SKU / item_code with loaded variants and barcodes."""
        stmt = (
            select(Item)
            .where(
                Item.item_code == item_code.strip().upper(),
                Item.is_deleted == False,
            )
            .options(
                selectinload(Item.variants).selectinload(ItemVariant.barcodes),
                selectinload(Item.barcodes),
                selectinload(Item.batches),
                selectinload(Item.serials),
                selectinload(Item.locations),
            )
        )
        if company_id:
            stmt = stmt.where(Item.company_id == company_id)
        res = await session.execute(stmt)
        return res.scalar_one_or_none()

    @classmethod
    async def get_item_by_id(cls, session: AsyncSession, item_id: str) -> Optional[Item]:
        """Fetches item by ID with variants, barcodes, batches, and locations."""
        stmt = (
            select(Item)
            .options(
                selectinload(Item.variants).selectinload(ItemVariant.barcodes),
                selectinload(Item.barcodes),
                selectinload(Item.batches),
                selectinload(Item.serials),
                selectinload(Item.locations),
            )
            .where(Item.id == item_id)
            .execution_options(populate_existing=True)
        )
        return (await session.execute(stmt)).scalars().first()

    @classmethod
    async def list_items(
        cls,
        session: AsyncSession,
        category: Optional[str] = None,
        brand: Optional[str] = None,
        query: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Item]:
        """Searches and lists items."""
        stmt = (
            select(Item)
            .options(
                selectinload(Item.variants).selectinload(ItemVariant.barcodes),
                selectinload(Item.barcodes),
                selectinload(Item.batches),
                selectinload(Item.locations),
            )
            .execution_options(populate_existing=True)
        )
        if category:
            stmt = stmt.where(Item.category == category)
        if brand:
            stmt = stmt.where(Item.brand == brand)

        if query:
            q = f"%{query.strip()}%"
            stmt = stmt.where(
                or_(
                    Item.item_name.ilike(q),
                    Item.item_code.ilike(q),
                    Item.brand.ilike(q),
                    Item.category.ilike(q),
                )
            )

        stmt = stmt.order_by(Item.item_name).limit(limit).offset(offset)
        return (await session.execute(stmt)).scalars().all()

    @classmethod
    async def create_item(
        cls,
        session: AsyncSession,
        req: Optional[ItemCreateRequest] = None,
        company_id: Optional[str] = None,
        item_code: Optional[str] = None,
        item_name: Optional[str] = None,
        category: Optional[str] = None,
        tax_rate: float = 18.00,
        mrp: float = 0.00,
        selling_price: float = 0.00,
        buying_price: Optional[float] = None,
        cost_price: float = 0.00,
        primary_barcode: Optional[str] = None,
        primary_uom: str = "PCS",
        item_type: str = "FINISHED_GOOD",
        hsn_code: str = "64041990",
        brand: Optional[str] = None,
        is_batch_tracked: bool = False,
        variants_data: Optional[List[Dict[str, Any]]] = None,
        branch_id: str = "BR-001",
        commit: bool = True,
        **kwargs: Any,
    ) -> Item:
        """
        Atomically creates a Universal Item with default or custom variants, barcodes, batches, and warehouse locations.
        Supports both schema-based (ItemCreateRequest) and direct parameter invocations.
        """
        if req is not None:
            effective_company_id = company_id or getattr(req, "company_id", None) or "COMP-001"

            # 1. Numbering resolution (Requirements 4, 5, 6)
            if getattr(req, "auto_generate_article_number", False):
                alloc_resp = await DocumentsEngine.allocate_next_number_in_transaction(
                    session=session,
                    company_id=effective_company_id,
                    document_type="ARTICLE",
                    branch_id=branch_id,
                    company_code=effective_company_id,
                    category=getattr(req, "category", None),
                )
                sku = alloc_resp.document_no
            else:
                raw_code = (req.item_code or "").strip().upper()
                if not raw_code:
                    raise HTTPException(
                        status_code=400,
                        detail="Article Number (item_code) is required when automatic numbering is not selected."
                    )
                sku = raw_code

            # IM-001 Unified Catalog Controlled-Field Governance
            from ..catalog_validation import CatalogDimensionValidator, IM001ControlledFieldValidator

            governed_payload = {
                "brand": req.brand,
                "category": req.category,
                "department": req.department,
                "style_code": req.style_code,
                "color": req.color,
                "size": req.size,
                "vendor_code": req.vendor_code,
                "uom": getattr(req, "uom", None) or req.primary_uom or "PCS",
                "hsn_code": req.hsn_code,
                "gst_rate_percent": float(req.tax_rate) if req.tax_rate is not None else None,
                "gender": getattr(req, "gender", None),
                "product_type": getattr(req, "product_type", None),
                "heel_type": getattr(req, "heel_type", None),
                "upper_material": getattr(req, "upper_material", None),
                "design_attribute": getattr(req, "design_attribute", None),
                "outsole_material": getattr(req, "outsole_material", None),
                "collection_type": getattr(req, "collection_type", None),
            }
            await IM001ControlledFieldValidator.validate_dict(
                payload=governed_payload,
                company_id=effective_company_id,
                strict=True,
            )

            # Validate and normalize catalog dimensions
            normalized_brand = req.brand
            normalized_category = req.category
            normalized_department = req.department
            normalized_style_code = req.style_code
            normalized_color = req.color
            normalized_size = req.size
            normalized_vendor_code = req.vendor_code
            if req.brand and str(req.brand).strip():
                normalized_brand = await CatalogDimensionValidator.validate_and_normalize_dimension(
                    dimension_field="brand",
                    value=req.brand,
                    strict=True,
                )
            if req.category and str(req.category).strip():
                normalized_category = await CatalogDimensionValidator.validate_and_normalize_dimension(
                    dimension_field="category",
                    value=req.category,
                    strict=True,
                )
            if req.department and str(req.department).strip():
                normalized_department = await CatalogDimensionValidator.validate_and_normalize_dimension(
                    dimension_field="department",
                    value=req.department,
                    strict=True,
                )
            if req.style_code and str(req.style_code).strip():
                normalized_style_code = await CatalogDimensionValidator.validate_and_normalize_dimension(
                    dimension_field="style_code",
                    value=req.style_code,
                    strict=True,
                )
            if req.color and str(req.color).strip():
                normalized_color = await CatalogDimensionValidator.validate_and_normalize_dimension(
                    dimension_field="color",
                    value=req.color,
                    strict=True,
                )
            if req.size and str(req.size).strip():
                normalized_size = await CatalogDimensionValidator.validate_and_normalize_dimension(
                    dimension_field="size",
                    value=req.size,
                    strict=True,
                )
            if req.vendor_code and str(req.vendor_code).strip():
                normalized_vendor_code = await CatalogDimensionValidator.validate_and_normalize_dimension(
                    dimension_field="vendor_code",
                    value=req.vendor_code,
                    strict=True,
                )

            requested_barcodes = [bc.barcode.strip().upper() for bc in req.barcodes]
            requested_barcodes.extend(
                bc.barcode.strip().upper()
                for variant in req.variants
                for bc in variant.barcodes
            )
            if not req.variants and not requested_barcodes:
                requested_barcodes.append(sku.strip().upper())
            for barcode in requested_barcodes:
                barcode_owner = (
                    await session.execute(
                        select(ItemBarcode).where(
                            ItemBarcode.company_id == effective_company_id,
                            ItemBarcode.barcode == barcode,
                            ItemBarcode.is_deleted == False,
                        )
                    )
                ).scalars().first()
                if barcode_owner:
                    raise HTTPException(
                        status_code=409,
                        detail=f"Barcode '{barcode}' is already attached to an SKU and cannot be reused"
                    )

            # Check if parent item already exists by item_code
            existing_item = await cls.get_item_by_code(session, sku)
            if existing_item:
                if req.variants:
                    item = existing_item
                    if normalized_brand:
                        item.brand = normalized_brand
                    if normalized_category:
                        item.category = normalized_category
                else:
                    raise HTTPException(
                        status_code=409,
                        detail=f"Article code '{sku}' already exists; article identity is immutable."
                    )
            else:
                # 2. Allocate internal technical ID and identity code from IdentityEngine
                item_id, item_identity_code = await IdentityEngine.allocate_internal(
                    session=session,
                    entity_type="ITEM",
                    tenant_id=effective_company_id,
                    company_id=effective_company_id,
                )

                item = Item(
                    id=item_id,
                    identity_code=item_identity_code,
                    company_id=effective_company_id,
                    branch_id=branch_id,
                    item_code=sku,
                    item_name=req.item_name,
                    item_type=req.item_type,
                    category=normalized_category,
                    category_code=req.category_code,
                    department=normalized_department,
                    brand=normalized_brand,
                    style_code=normalized_style_code or sku,
                    color=normalized_color,
                    size=normalized_size,
                    vendor_code=normalized_vendor_code,
                    hsn_code=req.hsn_code or "0000",
                    tax_rate=Decimal(str(req.tax_rate)),
                    primary_uom=req.primary_uom or getattr(req, "uom", "PCS"),
                    uom=getattr(req, "uom", None) or req.primary_uom or "PCS",
                    mrp=Decimal(str(req.mrp)),
                    selling_price=Decimal(str(req.selling_price)),
                    cost_price=Decimal(str(req.cost_price)),
                    buying_price=Decimal(str(req.buying_price)) if req.buying_price is not None else None,
                    is_batch_tracked=req.is_batch_tracked,
                    is_serial_tracked=req.is_serial_tracked,
                    is_favorite=req.is_favorite,
                    primary_image_url=req.primary_image_url,
                    tags=req.tags,
                    attributes_json=req.attributes_json,
                    # ── v2.2 Promoted Attribute Columns ──────────────────────────────
                    gender=getattr(req, "gender", None),
                    purchase_class=getattr(req, "purchase_class", None),
                    product_type=getattr(req, "product_type", None),
                    design_attribute=getattr(req, "design_attribute", None),
                    heel_type=getattr(req, "heel_type", None),
                    upper_material=getattr(req, "upper_material", None),
                    outsole_material=getattr(req, "outsole_material", None),
                    collection_type=getattr(req, "collection_type", None),
                    # ── v2.2 Business Logic Flags ───────────────────────────────────────
                    is_inventory_yn=getattr(req, "is_inventory_yn", True),
                    is_billable_yn=getattr(req, "is_billable_yn", True),
                    is_service_yn=getattr(req, "is_service_yn", False),
                    status="ACTIVE",
                    tracking_type=getattr(req, "tracking_type", "STANDARD") or "STANDARD",
                    is_active=True,
                    is_deleted=False
                )
                session.add(item)
                await session.flush()

            # 3. Process Variants
            processed_variants: List[Tuple[ItemVariant, Optional[str]]] = []
            if req.variants:
                for v_data in req.variants:
                    v_sku = (v_data.variant_sku or "").strip().upper()
                    if not v_sku or v_sku == "AUTO":
                        c_part = str(getattr(v_data, "color", None) or (v_data.attributes_json.get("color") if v_data.attributes_json else None) or "STD").strip().upper()
                        s_part = str(getattr(v_data, "size", None) or (v_data.attributes_json.get("size") if v_data.attributes_json else None) or "STD").strip().upper()
                        v_sku = f"{item.item_code}-{c_part}-{s_part}"
                    # Check if variant already exists in company
                    var_stmt = select(ItemVariant).where(
                        ItemVariant.company_id == effective_company_id,
                        ItemVariant.variant_sku == v_sku,
                        ItemVariant.is_deleted == False
                    )
                    existing_variant = (await session.execute(var_stmt)).scalar_one_or_none()
                    if existing_variant:
                        if existing_variant.item_id != item.id:
                            raise HTTPException(
                                status_code=409,
                                detail=f"Variant SKU '{v_sku}' is already attached to another article in this company."
                            )
                        variant = existing_variant
                    else:
                        variant = ItemVariant(
                            id=f"var_{uuid.uuid4().hex[:12]}",
                            uuid=str(uuid.uuid4()),
                            company_id=effective_company_id,
                            branch_id=branch_id,
                            item_id=item.id,
                            variant_sku=v_sku,
                            variant_name=v_data.variant_name or f"{item.item_name} ({v_sku})",
                            color=getattr(v_data, "color", None) or (v_data.attributes_json.get("color") if v_data.attributes_json else None),
                            size=getattr(v_data, "size", None) or (v_data.attributes_json.get("size") if v_data.attributes_json else None),
                            attributes_json=v_data.attributes_json or {},
                            mrp=Decimal(str(v_data.mrp or item.mrp)),
                            selling_price=Decimal(str(v_data.selling_price or item.selling_price)),
                            cost_price=Decimal(str(v_data.cost_price or item.cost_price)),
                            is_active=v_data.is_active,
                            is_deleted=False
                        )
                        session.add(variant)
                        await session.flush()

                    primary_bc = None
                    for bc in v_data.barcodes:
                        bc_clean = bc.barcode.strip().upper()
                        bc_stmt = select(ItemBarcode).where(
                            ItemBarcode.company_id == effective_company_id,
                            ItemBarcode.barcode == bc_clean,
                            ItemBarcode.is_deleted == False
                        )
                        bc_obj = (await session.execute(bc_stmt)).scalar_one_or_none()
                        if not bc_obj:
                            bc_obj = ItemBarcode(
                                id=f"bc_{uuid.uuid4().hex[:12]}",
                                uuid=str(uuid.uuid4()),
                                company_id=effective_company_id,
                                branch_id=branch_id,
                                item_id=item.id,
                                variant_id=variant.id,
                                barcode=bc_clean,
                                barcode_type=bc.barcode_type or "EAN13",
                                is_primary=bc.is_primary,
                                is_tax_inclusive=getattr(bc, "is_tax_inclusive", None),
                                is_active=True,
                                is_deleted=False
                            )
                            session.add(bc_obj)
                            await session.flush()
                        if bc.is_primary or primary_bc is None:
                            primary_bc = bc_clean

                    processed_variants.append((variant, primary_bc))
            else:
                def_sku = f"{sku}-STD"
                var_stmt = select(ItemVariant).where(
                    ItemVariant.item_id == item.id,
                    ItemVariant.variant_sku == def_sku,
                    ItemVariant.is_deleted == False
                )
                variant = (await session.execute(var_stmt)).scalar_one_or_none()
                if not variant:
                    variant = ItemVariant(
                        id=f"var_{uuid.uuid4().hex[:12]}",
                        uuid=str(uuid.uuid4()),
                        company_id=effective_company_id,
                        branch_id=branch_id,
                        item_id=item.id,
                        variant_sku=def_sku,
                        variant_name=f"{req.item_name} (Standard)",
                        color=req.color,
                        size=req.size,
                        attributes_json=req.attributes_json or {},
                        mrp=item.mrp,
                        selling_price=item.selling_price,
                        cost_price=item.cost_price,
                        is_active=True,
                        is_deleted=False
                    )
                    session.add(variant)
                    await session.flush()

                primary_bc = None
                if req.barcodes:
                    for bc in req.barcodes:
                        bc_clean = bc.barcode.strip().upper()
                        bc_stmt = select(ItemBarcode).where(
                            ItemBarcode.company_id == effective_company_id,
                            ItemBarcode.barcode == bc_clean,
                            ItemBarcode.is_deleted == False
                        )
                        bc_obj = (await session.execute(bc_stmt)).scalar_one_or_none()
                        if not bc_obj:
                            bc_obj = ItemBarcode(
                                id=f"bc_{uuid.uuid4().hex[:12]}",
                                uuid=str(uuid.uuid4()),
                                company_id=effective_company_id,
                                branch_id=branch_id,
                                item_id=item.id,
                                variant_id=variant.id,
                                barcode=bc_clean,
                                barcode_type=bc.barcode_type or "EAN13",
                                is_primary=bc.is_primary,
                                is_tax_inclusive=getattr(bc, "is_tax_inclusive", None),
                                is_active=True,
                                is_deleted=False
                            )
                            session.add(bc_obj)
                            await session.flush()
                        if bc.is_primary or primary_bc is None:
                            primary_bc = bc_clean
                else:
                    placeholder_bc = cls.generate_placeholder_barcode()
                    session.add(
                        ItemBarcode(
                            id=f"bc_{uuid.uuid4().hex[:12]}",
                            uuid=str(uuid.uuid4()),
                            company_id=effective_company_id,
                            branch_id=branch_id,
                            item_id=item.id,
                            variant_id=variant.id,
                            barcode=placeholder_bc,
                            barcode_type="CUSTOM",
                            is_primary=True,
                            is_active=True,
                            is_deleted=False
                        )
                    )
                    primary_bc = placeholder_bc

                processed_variants.append((variant, primary_bc))

            # 4. Synchronize each variant to products table (Requirement 8)
            for var_item, p_bc in processed_variants:
                conditions = [
                    and_(Product.item_id == item.id, Product.item_variant_id == var_item.id),
                    Product.sku == var_item.variant_sku,
                    Product.code == var_item.variant_sku,
                ]
                v_color = var_item.color or getattr(req, "color", None)
                v_size = var_item.size or getattr(req, "size", None)
                v_style = normalized_style_code or req.style_code or item.style_code or item.item_code
                if v_style and v_color and v_size:
                    conditions.append(
                        and_(
                            func.lower(Product.style_code) == v_style.strip().lower(),
                            func.lower(Product.color) == str(v_color).strip().lower(),
                            func.lower(Product.size) == str(v_size).strip().lower(),
                        )
                    )
                prod_stmt = select(Product).where(
                    Product.company_id == effective_company_id,
                    or_(*conditions),
                    Product.is_deleted == False
                )
                if not p_bc:
                    eff_bc = cls.generate_placeholder_barcode()
                    auto_bc_obj = ItemBarcode(
                        id=f"bc_{uuid.uuid4().hex[:12]}",
                        uuid=str(uuid.uuid4()),
                        company_id=effective_company_id,
                        branch_id=branch_id,
                        item_id=item.id,
                        variant_id=var_item.id,
                        barcode=eff_bc,
                        barcode_type="CODE128_INTERNAL",
                        is_primary=True,
                        is_active=True,
                        is_deleted=False
                    )
                    session.add(auto_bc_obj)
                    await session.flush()
                    p_bc = eff_bc

                prod_obj = (await session.execute(prod_stmt)).scalars().first()
                if not prod_obj:
                    prod_id = f"prod_{uuid.uuid4().hex[:12]}"
                    prod_obj = Product(
                        id=prod_id,
                        uuid=str(uuid.uuid4()),
                        company_id=effective_company_id,
                        branch_id=branch_id,
                        code=var_item.variant_sku,
                        sku=var_item.variant_sku,
                        name=var_item.variant_name or item.item_name,
                        style_code=normalized_style_code or req.style_code or item.style_code or item.item_code,
                        brand=normalized_brand or req.brand or item.brand,
                        category=normalized_category or req.category or item.category,
                        category_code=item.category_code,
                        color=var_item.color or getattr(req, "color", None),
                        size=var_item.size or getattr(req, "size", None),
                        vendor_code=normalized_vendor_code or getattr(req, "vendor_code", None) or item.vendor_code,
                        item_id=item.id,
                        item_variant_id=var_item.id,
                        mrp=var_item.mrp or item.mrp,
                        price=var_item.selling_price or item.selling_price,
                        cost_price=var_item.cost_price or item.cost_price,
                        buying_price=item.buying_price,
                        gst_percentage=item.tax_rate,
                        hsn_code=var_item.hsn_code or item.hsn_code,
                        barcode=p_bc,
                        attributes=var_item.attributes_json or {},
                        is_active=True,
                        is_deleted=False
                    )
                    session.add(prod_obj)
                    await session.flush()
                else:
                    prod_obj.item_id = item.id
                    prod_obj.item_variant_id = var_item.id
                    if var_item.variant_sku:
                        prod_obj.code = var_item.variant_sku
                        prod_obj.sku = var_item.variant_sku
                    if normalized_brand:
                        prod_obj.brand = normalized_brand
                    if normalized_category:
                        prod_obj.category = normalized_category
                    if normalized_style_code:
                        prod_obj.style_code = normalized_style_code
                    if normalized_vendor_code:
                        prod_obj.vendor_code = normalized_vendor_code
                    if var_item.color:
                        prod_obj.color = var_item.color
                    if var_item.size:
                        prod_obj.size = var_item.size
                    if p_bc and not prod_obj.barcode:
                        prod_obj.barcode = p_bc

                # Ensure default PriceBookEntry exists
                res_pb = await session.execute(
                    select(PriceBook).filter(
                        PriceBook.company_id == effective_company_id,
                        PriceBook.is_default == True,
                        PriceBook.is_deleted == False
                    )
                )
                default_pb = res_pb.scalars().first()
                if not default_pb:
                    default_pb = PriceBook(
                        id=f"pb_{uuid.uuid4().hex[:12]}",
                        uuid=str(uuid.uuid4()),
                        company_id=effective_company_id,
                        branch_id=branch_id,
                        name=f"Standard Retail Price List ({effective_company_id})",
                        code=f"DEFAULT-{effective_company_id}",
                        currency="INR",
                        is_default=True,
                        status="ACTIVE",
                        is_active=True,
                        is_deleted=False
                    )
                    session.add(default_pb)
                    await session.flush()

                pbe_stmt = select(PriceBookEntry).where(
                    PriceBookEntry.price_book_id == default_pb.id,
                    PriceBookEntry.variant_id == var_item.id,
                    PriceBookEntry.is_deleted == False
                )
                pbe_obj = (await session.execute(pbe_stmt)).scalars().first()
                if not pbe_obj:
                    session.add(PriceBookEntry(
                        id=f"pbe_{uuid.uuid4().hex[:12]}",
                        uuid=str(uuid.uuid4()),
                        company_id=effective_company_id,
                        branch_id=branch_id,
                        price_book_id=default_pb.id,
                        item_id=item.id,
                        variant_id=var_item.id,
                        min_quantity=Decimal("1.0000"),
                        selling_price=var_item.selling_price or Decimal("0.00"),
                        mrp=var_item.mrp or Decimal("0.00"),
                        cost_price=var_item.cost_price or Decimal("0.00"),
                        is_active=True,
                        is_deleted=False
                    ))

                # Legacy ID mapping
                map_stmt = select(LegacyIdMapping).where(
                    LegacyIdMapping.legacy_table == "products",
                    LegacyIdMapping.legacy_id == prod_obj.id,
                )
                map_obj = (await session.execute(map_stmt)).scalars().first()
                if not map_obj:
                    session.add(LegacyIdMapping(
                        id=f"map_{uuid.uuid4().hex[:12]}",
                        uuid=str(uuid.uuid4()),
                        company_id=effective_company_id,
                        branch_id=branch_id,
                        migration_run_id="canonical_creation",
                        legacy_table="products",
                        legacy_id=prod_obj.id,
                        legacy_uuid=prod_obj.uuid,
                        canonical_table="item_variants",
                        canonical_id=var_item.id,
                        canonical_uuid=var_item.uuid,
                        disposition="SYNCED",
                        is_active=True,
                        is_deleted=False
                    ))

            # 5. Batches
            for b_data in req.batches:
                session.add(
                    ItemBatch(
                        id=f"batch_{uuid.uuid4().hex[:12]}",
                        item_id=item.id,
                        variant_id=b_data.variant_id or processed_variants[0][0].id,
                        batch_number=b_data.batch_number,
                        mrp=Decimal(str(b_data.mrp or item.mrp)),
                        cost_price=Decimal(str(b_data.cost_price or item.cost_price)),
                        is_active=b_data.is_active,
                    )
                )

            # 6. Warehouse Locations
            for loc in req.locations:
                session.add(
                    ItemWarehouseLocation(
                        id=f"loc_{uuid.uuid4().hex[:12]}",
                        item_id=item.id,
                        warehouse_id=loc.warehouse_id,
                        location_bin=loc.location_bin,
                        min_reorder_level=Decimal(str(loc.min_reorder_level)),
                        max_capacity=Decimal(str(loc.max_capacity)),
                        reorder_quantity=Decimal(str(loc.reorder_quantity)),
                    )
                )

            # 7. Optional Initial Supplier Assignment (Requirement 10)
            supplier_payload = getattr(req, "supplier", None)
            if supplier_payload and isinstance(supplier_payload, dict) and supplier_payload.get("vendor_party_id"):
                v_party_id = supplier_payload["vendor_party_id"]
                vpa_stmt = select(VendorProductAssignment).where(
                    VendorProductAssignment.company_id == effective_company_id,
                    VendorProductAssignment.vendor_party_id == v_party_id,
                    VendorProductAssignment.assignment_level == "ARTICLE",
                    VendorProductAssignment.assignment_target_id == item.id,
                    VendorProductAssignment.is_deleted == False
                )
                vpa_existing = (await session.execute(vpa_stmt)).scalars().first()
                if not vpa_existing:
                    session.add(VendorProductAssignment(
                        id=f"vpa_{uuid.uuid4().hex[:12]}",
                        uuid=str(uuid.uuid4()),
                        company_id=effective_company_id,
                        branch_id=branch_id,
                        vendor_party_id=v_party_id,
                        assignment_level="ARTICLE",
                        assignment_target_id=item.id,
                        assignment_target_code=item.item_code,
                        assignment_target_name=item.item_name,
                        vendor_priority=supplier_payload.get("vendor_priority", "PRIMARY"),
                        status="ACTIVE",
                        allow_purchase=supplier_payload.get("allow_purchase", True),
                        allow_po=supplier_payload.get("allow_po", True),
                        allow_grn=supplier_payload.get("allow_grn", True),
                        approval_required=supplier_payload.get("approval_required", False),
                        effective_from=supplier_payload.get("effective_from") or date.today(),
                        effective_to=supplier_payload.get("effective_to"),
                        remarks=supplier_payload.get("remarks"),
                        is_active=True,
                        is_deleted=False
                    ))

            if commit:
                await session.commit()
            else:
                await session.flush()
            return await cls.get_item_by_id(session, item.id)

        # Direct parameter workflow
        clean_code = (item_code or "").strip().upper()
        clean_hsn = (hsn_code or "64041990").strip()
        existing = await cls.get_item_by_code(session, clean_code) if clean_code else None

        if existing:
            raise ValueError(
                f"Item code '{clean_code}' already exists; item identity and details are immutable after creation"
            )

        # Extract and normalize dimensions from direct parameters or kwargs
        raw_brand = brand or kwargs.get("brand")
        raw_cat = category or kwargs.get("category")
        raw_dept = kwargs.get("department")
        raw_style = (
            kwargs.get("style_code")
            or kwargs.get("styleCode")
            or kwargs.get("style")
            or kwargs.get("stylecode")
            or kwargs.get("article")
            or kwargs.get("article_no")
            or kwargs.get("style_article")
        )
        raw_color = kwargs.get("color") or kwargs.get("colour") or kwargs.get("shade")
        raw_size = kwargs.get("size")
        raw_vendor = kwargs.get("vendor_code") or kwargs.get("vendorCode")

        from ..catalog_validation import CatalogDimensionValidator
        normalized_brand = await CatalogDimensionValidator.validate_and_normalize_dimension("brand", raw_brand, strict=True) if raw_brand else None
        normalized_cat = await CatalogDimensionValidator.validate_and_normalize_dimension("category", raw_cat, strict=True) if raw_cat else (category or "Footwear")
        normalized_dept = await CatalogDimensionValidator.validate_and_normalize_dimension("department", raw_dept, strict=True) if raw_dept else None
        normalized_style = await CatalogDimensionValidator.validate_and_normalize_dimension("style_code", raw_style, strict=False) if raw_style else None
        normalized_color = await CatalogDimensionValidator.validate_and_normalize_dimension("color", raw_color, strict=False) if raw_color else None
        normalized_size = await CatalogDimensionValidator.validate_and_normalize_dimension("size", raw_size, strict=False) if raw_size else None
        normalized_vendor = await CatalogDimensionValidator.validate_and_normalize_dimension("vendor_code", raw_vendor, strict=False) if raw_vendor else None

        effective_company_id = company_id or "COMP-001"
        tech_id, item_identity_code = await IdentityEngine.allocate_internal(
            session=session,
            entity_type="ITEM",
            tenant_id=effective_company_id,
            company_id=effective_company_id,
        )

        item = Item(
            id=tech_id,
            identity_code=item_identity_code,
            company_id=effective_company_id,
            branch_id=branch_id,
            item_code=clean_code,
            item_name=item_name or clean_code,
            item_type=item_type,
            category=normalized_cat,
            department=normalized_dept,
            brand=normalized_brand,
            style_code=normalized_style,
            color=normalized_color,
            size=normalized_size,
            vendor_code=normalized_vendor,
            hsn_code=clean_hsn,
            tax_rate=Decimal(str(tax_rate)),
            primary_uom=primary_uom,
            mrp=Decimal(str(mrp)),
            selling_price=Decimal(str(selling_price)),
            buying_price=Decimal(str(buying_price)) if buying_price is not None else None,
            cost_price=Decimal(str(cost_price)),
            is_batch_tracked=is_batch_tracked,
            attributes_json=kwargs.get("attributes_json") or {},
            primary_image_url=kwargs.get("primary_image_url"),
            status=kwargs.get("status") or "ACTIVE",
            is_active=True,
            is_deleted=False,
            # ── v2.2 Promoted Attribute Columns ──────────────────────────────
            gender=kwargs.get("gender"),
            purchase_class=kwargs.get("purchase_class"),
            product_type=kwargs.get("product_type"),
            design_attribute=kwargs.get("design_attribute"),
            heel_type=kwargs.get("heel_type"),
            upper_material=kwargs.get("upper_material"),
            outsole_material=kwargs.get("outsole_material"),
            collection_type=kwargs.get("collection_type"),
            # ── v2.2 Business Logic Flags ───────────────────────────────────────
            is_inventory_yn=kwargs.get("is_inventory_yn", True),
            is_billable_yn=kwargs.get("is_billable_yn", True),
            is_service_yn=kwargs.get("is_service_yn", False),
        )
        session.add(item)
        await session.flush()

        # Process Variants
        if variants_data:
            for v_data in variants_data:
                v_sku = v_data.get("variant_sku", f"{clean_code}-{v_data.get('variant_name', 'VAR')}").strip().upper()
                v_stmt = select(ItemVariant).where(
                    ItemVariant.item_id == item.id,
                    ItemVariant.variant_sku == v_sku,
                    ItemVariant.is_deleted == False,
                )
                variant = (await session.execute(v_stmt)).scalar_one_or_none()
                if not variant:
                    variant = ItemVariant(
                        id=f"var_{uuid.uuid4().hex[:12]}",
                        company_id=company_id or "COMP-001",
                        branch_id=branch_id,
                        item_id=item.id,
                        variant_sku=v_sku,
                        variant_name=v_data.get("variant_name", "Standard Variant"),
                        attributes_json=v_data.get("attributes_json", {}),
                        mrp=Decimal(str(v_data.get("mrp", mrp))),
                        selling_price=Decimal(str(v_data.get("selling_price", selling_price))),
                        cost_price=Decimal(str(v_data.get("cost_price", cost_price))),
                        is_active=True,
                        is_deleted=False,
                    )
                    session.add(variant)
                    await session.flush()

                # Variant barcode if provided
                if v_data.get("barcode"):
                    bc_val = str(v_data["barcode"]).strip().upper()
                    bc_stmt = select(ItemBarcode).where(
                        ItemBarcode.barcode == bc_val,
                        ItemBarcode.is_deleted == False,
                    )
                    bc_obj = (await session.execute(bc_stmt)).scalar_one_or_none()
                    if not bc_obj:
                        bc_obj = ItemBarcode(
                            id=f"ibc_{uuid.uuid4().hex[:12]}",
                            company_id=company_id or "COMP-001",
                            branch_id=branch_id,
                            item_id=item.id,
                            variant_id=variant.id,
                            barcode=bc_val,
                            barcode_type="EAN13",
                            is_primary=False,
                            is_tax_inclusive=v_data.get("is_tax_inclusive", None),
                            is_active=True,
                            is_deleted=False,
                        )
                        session.add(bc_obj)

        # Primary Barcode
        if primary_barcode:
            bc_clean = str(primary_barcode).strip().upper()
            bc_stmt = select(ItemBarcode).where(
                ItemBarcode.barcode == bc_clean,
                ItemBarcode.is_deleted == False,
            )
            bc_obj = (await session.execute(bc_stmt)).scalar_one_or_none()
            if not bc_obj:
                bc_obj = ItemBarcode(
                    id=f"ibc_{uuid.uuid4().hex[:12]}",
                    company_id=company_id or "COMP-001",
                    branch_id=branch_id,
                    item_id=item.id,
                    variant_id=None,
                    barcode=bc_clean,
                    barcode_type="EAN13",
                    is_primary=True,
                    is_active=True,
                    is_deleted=False,
                )
                session.add(bc_obj)
        else:
            # Direct parameter callers also need a consistent provisional identity
            # when no human-supplied barcode was provided.
            placeholder_barcode = cls.generate_placeholder_barcode()
            placeholder_stmt = select(ItemBarcode).where(
                ItemBarcode.barcode == placeholder_barcode,
                ItemBarcode.is_deleted == False,
            )
            placeholder_obj = (await session.execute(placeholder_stmt)).scalar_one_or_none()
            if not placeholder_obj:
                placeholder_obj = ItemBarcode(
                    id=f"ibc_{uuid.uuid4().hex[:12]}",
                    company_id=company_id or "COMP-001",
                    branch_id=branch_id,
                    item_id=item.id,
                    variant_id=None,
                    barcode=placeholder_barcode,
                    barcode_type="CUSTOM",
                    is_primary=True,
                    is_active=True,
                    is_deleted=False,
                )
                session.add(placeholder_obj)

        if commit:
            await session.commit()
        else:
            await session.flush()
        return await cls.get_item_by_code(session, clean_code)
