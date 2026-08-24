"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.22.0
Created      : 2026-08-23
Modified     : 2026-08-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import uuid
from decimal import Decimal
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy import select, or_, and_, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models.item_master import Item, ItemVariant, ItemBarcode
from ..models.inventory import Product


class UniversalItemService:
    """
    Universal Item Master Service (P1 Section 6.2).
    Canonical Item, Variant & Barcode catalog across POS, Sales, Purchase, WMS, and eCommerce.
    Provides fast barcode/SKU resolution and legacy Product synchronization.
    """

    @classmethod
    async def converge_product_to_item(
        cls,
        session: AsyncSession,
        product: Product
    ) -> Item:
        """
        Idempotently synchronizes a legacy Product record into canonical Item, ItemVariant, and ItemBarcode entities.
        """
        sku = product.sku if hasattr(product, "sku") and product.sku else f"SKU-{product.id[:8]}"
        name = product.name if hasattr(product, "name") and product.name else "Standard Product"
        barcode_val = getattr(product, "barcode", None) or sku

        # 1. Check existing Item by item_code (sku)
        stmt = select(Item).options(
            selectinload(Item.variants),
            selectinload(Item.barcodes)
        ).where(Item.item_code == sku)
        item = (await session.execute(stmt)).scalars().first()

        if not item:
            item = Item(
                id=f"itm_{uuid.uuid4().hex[:12]}",
                item_code=sku,
                item_name=name,
                item_type="FINISHED_GOOD",
                category=getattr(product, "category", "GENERAL") or "GENERAL",
                brand=getattr(product, "brand", None),
                hsn_code=getattr(product, "hsn_code", "0000"),
                tax_rate=Decimal(str(getattr(product, "tax_rate", 18.00) or 18.00)),
                primary_uom=getattr(product, "uom", "PCS") or "PCS",
                mrp=Decimal(str(getattr(product, "mrp", 0.00) or 0.00)),
                selling_price=Decimal(str(getattr(product, "selling_price", 0.00) or getattr(product, "price", 0.00) or 0.00)),
                cost_price=Decimal(str(getattr(product, "cost_price", 0.00) or getattr(product, "cost", 0.00) or 0.00)),
                is_batch_tracked=bool(getattr(product, "is_batch_tracked", False)),
                is_serial_tracked=bool(getattr(product, "is_serial_tracked", False)),
                status="ACTIVE"
            )
            session.add(item)
            await session.flush()

        # 2. Ensure default ItemVariant exists
        variant_sku = f"{sku}-STD"
        variant_stmt = select(ItemVariant).where(ItemVariant.variant_sku == variant_sku)
        variant = (await session.execute(variant_stmt)).scalars().first()

        if not variant:
            variant = ItemVariant(
                id=f"var_{uuid.uuid4().hex[:12]}",
                item_id=item.id,
                variant_sku=variant_sku,
                variant_name=f"{name} (Standard)",
                mrp=item.mrp,
                selling_price=item.selling_price,
                cost_price=item.cost_price,
                is_active=True
            )
            session.add(variant)
            await session.flush()

        # 3. Ensure ItemBarcode exists
        if barcode_val:
            bc_stmt = select(ItemBarcode).where(ItemBarcode.barcode == barcode_val)
            bc = (await session.execute(bc_stmt)).scalars().first()
            if not bc:
                bc = ItemBarcode(
                    id=f"bc_{uuid.uuid4().hex[:12]}",
                    item_id=item.id,
                    variant_id=variant.id,
                    barcode=barcode_val,
                    barcode_type="EAN13" if len(barcode_val) == 13 and barcode_val.isdigit() else "CUSTOM",
                    is_primary=True
                )
                session.add(bc)

        await session.flush()
        return item

    @classmethod
    async def resolve_item_by_barcode_or_sku(
        cls,
        session: AsyncSession,
        query_str: str
    ) -> Optional[Dict[str, Any]]:
        """
        Canonical Universal Item Resolver:
        Priority 1: Exact Barcode Match
        Priority 2: Variant SKU Match
        Priority 3: Item Code Match
        """
        q = query_str.strip()
        if not q:
            return None

        # 1. Barcode Lookup
        bc_stmt = select(ItemBarcode).options(
            selectinload(ItemBarcode.item),
            selectinload(ItemBarcode.variant)
        ).where(ItemBarcode.barcode == q)
        barcode_match = (await session.execute(bc_stmt)).scalars().first()

        if barcode_match and barcode_match.item:
            item = barcode_match.item
            variant = barcode_match.variant
            return {
                "matched_by": "BARCODE",
                "item_id": item.id,
                "item_code": item.item_code,
                "item_name": item.item_name,
                "variant_id": variant.id if variant else None,
                "variant_sku": variant.variant_sku if variant else None,
                "barcode": barcode_match.barcode,
                "tax_rate": float(item.tax_rate),
                "mrp": float(variant.mrp if variant else item.mrp),
                "selling_price": float(variant.selling_price if variant else item.selling_price),
                "cost_price": float(variant.cost_price if variant else item.cost_price),
                "primary_uom": item.primary_uom
            }

        # 2. Variant SKU Lookup
        var_stmt = select(ItemVariant).options(
            selectinload(ItemVariant.item)
        ).where(ItemVariant.variant_sku == q)
        variant_match = (await session.execute(var_stmt)).scalars().first()

        if variant_match and variant_match.item:
            item = variant_match.item
            return {
                "matched_by": "VARIANT_SKU",
                "item_id": item.id,
                "item_code": item.item_code,
                "item_name": item.item_name,
                "variant_id": variant_match.id,
                "variant_sku": variant_match.variant_sku,
                "barcode": None,
                "tax_rate": float(item.tax_rate),
                "mrp": float(variant_match.mrp),
                "selling_price": float(variant_match.selling_price),
                "cost_price": float(variant_match.cost_price),
                "primary_uom": item.primary_uom
            }

        # 3. Item Code Lookup
        item_stmt = select(Item).options(
            selectinload(Item.variants)
        ).where(Item.item_code == q)
        item_match = (await session.execute(item_stmt)).scalars().first()

        if item_match:
            first_variant = item_match.variants[0] if item_match.variants else None
            return {
                "matched_by": "ITEM_CODE",
                "item_id": item_match.id,
                "item_code": item_match.item_code,
                "item_name": item_match.item_name,
                "variant_id": first_variant.id if first_variant else None,
                "variant_sku": first_variant.variant_sku if first_variant else None,
                "barcode": None,
                "tax_rate": float(item_match.tax_rate),
                "mrp": float(first_variant.mrp if first_variant else item_match.mrp),
                "selling_price": float(first_variant.selling_price if first_variant else item_match.selling_price),
                "cost_price": float(first_variant.cost_price if first_variant else item_match.cost_price),
                "primary_uom": item_match.primary_uom
            }

        return None

    @classmethod
    async def sync_all_legacy_products(cls, session: AsyncSession) -> int:
        """
        Batch convergence utility:
        Scans all Products in the database and synchronizes to Item, ItemVariant, and ItemBarcode.
        """
        tbl_prod = await session.execute(text("SELECT to_regclass('public.products');"))
        if not tbl_prod.scalar():
            return 0

        products = (await session.execute(select(Product))).scalars().all()
        count = 0
        for p in products:
            await cls.converge_product_to_item(session, p)
            count += 1

        await session.commit()
        return count
