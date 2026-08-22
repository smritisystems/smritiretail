"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-08-23
Modified     : 2026-08-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import uuid
from typing import Optional, List, Dict, Any
from sqlalchemy import select, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models.item_master import Item, ItemVariant, ItemBarcode
from ..models.inventory import Product, ProductBatchStock


class UniversalItemMasterService:
    """
    Authoritative Universal Item Master Domain Service for Tenant Data Planes (smritiXXX).
    Provides canonical item management, multi-attribute variants, barcode lookup, and batch ledger linking.
    """

    @classmethod
    async def get_item_by_code(
        cls,
        session: AsyncSession,
        item_code: str
    ) -> Optional[Item]:
        """Fetches an item by unique SKU / item_code with loaded variants and barcodes."""
        stmt = (
            select(Item)
            .where(
                Item.item_code == item_code.strip().upper(),
                Item.is_deleted == False
            )
            .options(
                selectinload(Item.variants),
                selectinload(Item.barcodes)
            )
        )
        res = await session.execute(stmt)
        return res.scalar_one_or_none()

    @classmethod
    async def create_item(
        cls,
        session: AsyncSession,
        company_id: str,
        item_code: str,
        item_name: str,
        category: str,
        tax_rate: float = 18.00,
        mrp: float = 0.00,
        selling_price: float = 0.00,
        cost_price: float = 0.00,
        primary_barcode: Optional[str] = None,
        primary_uom: str = "PCS",
        item_type: str = "FINISHED_GOOD",
        hsn_code: Optional[str] = None,
        brand: Optional[str] = None,
        is_batch_tracked: bool = False,
        variants_data: Optional[List[Dict[str, Any]]] = None,
        branch_id: str = "BR-001"
    ) -> Item:
        """
        Creates or updates a canonical Universal Item with variants and barcodes.
        """
        clean_code = item_code.strip().upper()
        existing = await cls.get_item_by_code(session, clean_code)

        if not existing:
            item = Item(
                id=f"itm_{uuid.uuid4().hex[:12]}",
                company_id=company_id,
                branch_id=branch_id,
                item_code=clean_code,
                item_name=item_name,
                item_type=item_type,
                category=category,
                brand=brand,
                hsn_code=hsn_code,
                tax_rate=tax_rate,
                primary_uom=primary_uom,
                mrp=mrp,
                selling_price=selling_price,
                cost_price=cost_price,
                is_batch_tracked=is_batch_tracked,
                status="ACTIVE",
                is_active=True,
                is_deleted=False
            )
            session.add(item)
            await session.flush()
        else:
            item = existing
            item.item_name = item_name
            item.category = category
            item.tax_rate = tax_rate
            item.mrp = mrp
            item.selling_price = selling_price
            item.cost_price = cost_price
            if hsn_code:
                item.hsn_code = hsn_code
            if brand:
                item.brand = brand

        # Process Variants
        if variants_data:
            for v_data in variants_data:
                v_sku = v_data.get("variant_sku", f"{clean_code}-{v_data.get('variant_name', 'VAR')}").strip().upper()
                v_stmt = select(ItemVariant).where(
                    ItemVariant.item_id == item.id,
                    ItemVariant.variant_sku == v_sku,
                    ItemVariant.is_deleted == False
                )
                variant = (await session.execute(v_stmt)).scalar_one_or_none()
                if not variant:
                    variant = ItemVariant(
                        id=f"var_{uuid.uuid4().hex[:12]}",
                        company_id=company_id,
                        branch_id=branch_id,
                        item_id=item.id,
                        variant_sku=v_sku,
                        variant_name=v_data.get("variant_name", "Standard Variant"),
                        attributes_json=v_data.get("attributes_json", {}),
                        mrp=v_data.get("mrp", mrp),
                        selling_price=v_data.get("selling_price", selling_price),
                        cost_price=v_data.get("cost_price", cost_price),
                        is_active=True,
                        is_deleted=False
                    )
                    session.add(variant)
                    await session.flush()

                # Variant barcode if provided
                if v_data.get("barcode"):
                    bc_val = str(v_data["barcode"]).strip()
                    bc_stmt = select(ItemBarcode).where(
                        ItemBarcode.barcode == bc_val,
                        ItemBarcode.is_deleted == False
                    )
                    bc_obj = (await session.execute(bc_stmt)).scalar_one_or_none()
                    if not bc_obj:
                        bc_obj = ItemBarcode(
                            id=f"ibc_{uuid.uuid4().hex[:12]}",
                            company_id=company_id,
                            branch_id=branch_id,
                            item_id=item.id,
                            variant_id=variant.id,
                            barcode=bc_val,
                            barcode_type="EAN13",
                            is_primary=False,
                            is_active=True,
                            is_deleted=False
                        )
                        session.add(bc_obj)

        # Primary Barcode
        if primary_barcode:
            bc_clean = str(primary_barcode).strip()
            bc_stmt = select(ItemBarcode).where(
                ItemBarcode.barcode == bc_clean,
                ItemBarcode.is_deleted == False
            )
            bc_obj = (await session.execute(bc_stmt)).scalar_one_or_none()
            if not bc_obj:
                bc_obj = ItemBarcode(
                    id=f"ibc_{uuid.uuid4().hex[:12]}",
                    company_id=company_id,
                    branch_id=branch_id,
                    item_id=item.id,
                    variant_id=None,
                    barcode=bc_clean,
                    barcode_type="EAN13",
                    is_primary=True,
                    is_active=True,
                    is_deleted=False
                )
                session.add(bc_obj)

        await session.commit()
        return await cls.get_item_by_code(session, clean_code)

    @classmethod
    async def lookup_by_barcode(
        cls,
        session: AsyncSession,
        barcode: str
    ) -> Optional[Dict[str, Any]]:
        """
        Universal Barcode Resolver. Resolves barcode across canonical ItemBarcode registry,
        linking with item metadata and active batch inventory.
        """
        clean_bc = str(barcode).strip()
        
        # 1. Search canonical ItemBarcode table
        stmt = (
            select(ItemBarcode)
            .where(
                ItemBarcode.barcode == clean_bc,
                ItemBarcode.is_deleted == False
            )
            .options(
                selectinload(ItemBarcode.item),
                selectinload(ItemBarcode.variant)
            )
        )
        res = await session.execute(stmt)
        barcode_row = res.scalar_one_or_none()

        if barcode_row and barcode_row.item:
            item = barcode_row.item
            variant = barcode_row.variant
            return {
                "item_id": item.id,
                "item_code": item.item_code,
                "item_name": item.item_name,
                "variant_id": variant.id if variant else None,
                "variant_sku": variant.variant_sku if variant else item.item_code,
                "variant_name": variant.variant_name if variant else None,
                "barcode": clean_bc,
                "mrp": float(variant.mrp if variant else item.mrp),
                "selling_price": float(variant.selling_price if variant else item.selling_price),
                "cost_price": float(variant.cost_price if variant else item.cost_price),
                "tax_rate": float(item.tax_rate),
                "is_batch_tracked": item.is_batch_tracked
            }

        # 2. Backward compatibility fallback to Product table
        prod_stmt = select(Product).where(
            or_(
                Product.barcode == clean_bc,
                Product.secondary_barcodes.any(clean_bc)
            ),
            Product.is_deleted == False
        )
        prod_res = await session.execute(prod_stmt)
        prod = prod_res.scalar_one_or_none()
        if prod:
            return {
                "item_id": prod.id,
                "item_code": prod.sku or prod.code,
                "item_name": prod.name,
                "variant_id": None,
                "variant_sku": prod.sku or prod.code,
                "variant_name": None,
                "barcode": clean_bc,
                "mrp": float(prod.mrp or prod.price),
                "selling_price": float(prod.price),
                "cost_price": float(prod.cost_price or 0.0),
                "tax_rate": float(prod.gst_percentage or 18.0),
                "is_batch_tracked": getattr(prod, "is_batch_tracked", False)
            }

        return None
