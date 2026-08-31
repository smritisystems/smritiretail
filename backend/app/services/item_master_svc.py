"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-08-25
Modified     : 2026-08-25
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import uuid
import itertools
from decimal import Decimal
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy import select, or_, and_, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models.item_master import (
    Item,
    ItemVariant,
    ItemBarcode,
    ItemBatch,
    ItemSerial,
    ItemWarehouseLocation,
)
from ..schemas.item_master import (
    ItemCreateRequest,
    ItemUpdateRequest,
    ItemBatchItem,
    ItemSerialItem,
    MatrixVariantGenRequest,
    ItemResolutionResponse,
    LegacyProductAdapterResponse,
)


class UniversalItemMasterService:
    """
    Complete Universal Item Master Service (P1.2).
    Canonical Item, Variant matrix generator, Universal Barcode mapper, Batch/Serial tracking, and scanner resolver.
    """

    @classmethod
    async def create_item(
        cls,
        session: AsyncSession,
        req: ItemCreateRequest,
    ) -> Item:
        """
        Atomically creates a Universal Item with default or custom variants, barcodes, batches, and warehouse locations.
        """
        sku = req.item_code or f"ITM-{uuid.uuid4().hex[:8].upper()}"
        item_id = f"itm_{uuid.uuid4().hex[:12]}"

        item = Item(
            id=item_id,
            item_code=sku,
            item_name=req.item_name,
            item_type=req.item_type,
            category=req.category,
            category_code=req.category_code,
            brand=req.brand,
            hsn_code=req.hsn_code or "0000",
            tax_rate=Decimal(str(req.tax_rate)),
            primary_uom=req.primary_uom,
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
            status="ACTIVE",
        )
        session.add(item)
        await session.flush()

        # 1. Custom or Default Variants
        if req.variants:
            for v_data in req.variants:
                variant = ItemVariant(
                    id=f"var_{uuid.uuid4().hex[:12]}",
                    item_id=item.id,
                    variant_sku=v_data.variant_sku,
                    variant_name=v_data.variant_name,
                    attributes_json=v_data.attributes_json,
                    mrp=Decimal(str(v_data.mrp or item.mrp)),
                    selling_price=Decimal(str(v_data.selling_price or item.selling_price)),
                    cost_price=Decimal(str(v_data.cost_price or item.cost_price)),
                    is_active=v_data.is_active,
                )
                session.add(variant)
                await session.flush()

                # Add barcodes tied to variant
                for bc in v_data.barcodes:
                    session.add(
                        ItemBarcode(
                            id=f"bc_{uuid.uuid4().hex[:12]}",
                            item_id=item.id,
                            variant_id=variant.id,
                            barcode=bc.barcode,
                            barcode_type=bc.barcode_type,
                            is_primary=bc.is_primary,
                        )
                    )
        else:
            # Create standard default variant
            variant = ItemVariant(
                id=f"var_{uuid.uuid4().hex[:12]}",
                item_id=item.id,
                variant_sku=f"{sku}-STD",
                variant_name=f"{req.item_name} (Standard)",
                mrp=item.mrp,
                selling_price=item.selling_price,
                cost_price=item.cost_price,
                is_active=True,
            )
            session.add(variant)
            await session.flush()

            # Add primary item barcode if supplied or auto-generate EAN-style barcode
            if req.barcodes:
                for bc in req.barcodes:
                    session.add(
                        ItemBarcode(
                            id=f"bc_{uuid.uuid4().hex[:12]}",
                            item_id=item.id,
                            variant_id=variant.id,
                            barcode=bc.barcode,
                            barcode_type=bc.barcode_type,
                            is_primary=bc.is_primary,
                        )
                    )
            else:
                session.add(
                    ItemBarcode(
                        id=f"bc_{uuid.uuid4().hex[:12]}",
                        item_id=item.id,
                        variant_id=variant.id,
                        barcode=sku,
                        barcode_type="CUSTOM",
                        is_primary=True,
                    )
                )

        # 2. Batches
        for b_data in req.batches:
            session.add(
                ItemBatch(
                    id=f"batch_{uuid.uuid4().hex[:12]}",
                    item_id=item.id,
                    variant_id=b_data.variant_id or variant.id,
                    batch_number=b_data.batch_number,
                    mrp=Decimal(str(b_data.mrp or item.mrp)),
                    cost_price=Decimal(str(b_data.cost_price or item.cost_price)),
                    is_active=b_data.is_active,
                )
            )

        # 3. Warehouse Locations
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

        await session.commit()
        return await cls.get_item_by_id(session, item.id)

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
    async def generate_matrix_variants(
        cls,
        session: AsyncSession,
        item_id: str,
        req: MatrixVariantGenRequest,
    ) -> List[ItemVariant]:
        """
        Matrix Variant Generator (Size x Color Cartesian product):
        Generates unique SKU dimensions and primary barcodes automatically.
        """
        item = await cls.get_item_by_id(session, item_id)
        if not item:
            raise ValueError(f"Item '{item_id}' not found.")

        dim_names = [d.dimension_name for d in req.dimensions]
        dim_values = [d.values for d in req.dimensions]

        combinations = list(itertools.product(*dim_values))
        created_variants = []

        for combo in combinations:
            attr_dict = {dim_names[i]: combo[i] for i in range(len(combo))}
            sku_suffix = "-".join(str(val).upper().replace(" ", "") for val in combo)
            variant_sku = f"{item.item_code}-{sku_suffix}"
            variant_name = f"{item.item_name} ({', '.join(combo)})"

            # Check if variant exists
            existing_var = (
                await session.execute(
                    select(ItemVariant).where(ItemVariant.variant_sku == variant_sku)
                )
            ).scalars().first()

            if not existing_var:
                mrp_val = Decimal(str(req.base_mrp if req.base_mrp is not None else item.mrp))
                selling_val = Decimal(str(req.base_selling_price if req.base_selling_price is not None else item.selling_price))
                cost_val = Decimal(str(req.base_cost_price if req.base_cost_price is not None else item.cost_price))

                var = ItemVariant(
                    id=f"var_{uuid.uuid4().hex[:12]}",
                    item_id=item.id,
                    variant_sku=variant_sku,
                    variant_name=variant_name,
                    attributes_json=attr_dict,
                    mrp=mrp_val,
                    selling_price=selling_val,
                    cost_price=cost_val,
                    is_active=True,
                )
                session.add(var)
                await session.flush()

                if req.auto_generate_barcodes:
                    bc_val = f"890{uuid.uuid4().int % 10000000000:010d}"
                    session.add(
                        ItemBarcode(
                            id=f"bc_{uuid.uuid4().hex[:12]}",
                            item_id=item.id,
                            variant_id=var.id,
                            barcode=bc_val,
                            barcode_type="EAN13",
                            is_primary=True,
                        )
                    )

                created_variants.append(var)
                item.variants.append(var)

        await session.commit()
        return created_variants

    @classmethod
    async def resolve_item_by_barcode_or_sku(
        cls,
        session: AsyncSession,
        query_str: str,
    ) -> Optional[ItemResolutionResponse]:
        """
        Fast 4-Tier Universal Scanner Resolver:
        Tier 1: Exact Barcode Match
        Tier 2: Variant SKU Match
        Tier 3: Item Code Match
        Tier 4: Serial Number Match
        """
        q = query_str.strip()
        if not q:
            return None

        # 1. Tier 1: Barcode Match
        bc_stmt = (
            select(ItemBarcode)
            .options(
                selectinload(ItemBarcode.item),
                selectinload(ItemBarcode.variant),
            )
            .where(ItemBarcode.barcode == q)
        )
        bc_match = (await session.execute(bc_stmt)).scalars().first()
        if bc_match and bc_match.item:
            item = bc_match.item
            variant = bc_match.variant
            return ItemResolutionResponse(
                matched_by="BARCODE",
                item_id=item.id,
                item_code=item.item_code,
                item_name=item.item_name,
                variant_id=variant.id if variant else None,
                variant_sku=variant.variant_sku if variant else None,
                barcode=bc_match.barcode,
                tax_rate=float(item.tax_rate),
                mrp=float(variant.mrp if variant else item.mrp),
                selling_price=float(variant.selling_price if variant else item.selling_price),
                cost_price=float(variant.cost_price if variant else item.cost_price),
                primary_uom=item.primary_uom,
                category=item.category,
                brand=item.brand,
            )

        # 2. Tier 2: Variant SKU Match
        var_stmt = (
            select(ItemVariant)
            .options(
                selectinload(ItemVariant.item),
                selectinload(ItemVariant.barcodes),
            )
            .where(ItemVariant.variant_sku.ilike(q))
        )
        var_match = (await session.execute(var_stmt)).scalars().first()
        if var_match and var_match.item:
            item = var_match.item
            primary_bc = next((b.barcode for b in var_match.barcodes if b.is_primary), None)
            return ItemResolutionResponse(
                matched_by="VARIANT_SKU",
                item_id=item.id,
                item_code=item.item_code,
                item_name=item.item_name,
                variant_id=var_match.id,
                variant_sku=var_match.variant_sku,
                barcode=primary_bc,
                tax_rate=float(item.tax_rate),
                mrp=float(var_match.mrp),
                selling_price=float(var_match.selling_price),
                cost_price=float(var_match.cost_price),
                primary_uom=item.primary_uom,
                category=item.category,
                brand=item.brand,
            )

        # 3. Tier 3: Item Code Match
        item_stmt = (
            select(Item)
            .options(
                selectinload(Item.variants),
                selectinload(Item.barcodes),
            )
            .where(Item.item_code.ilike(q))
        )
        item_match = (await session.execute(item_stmt)).scalars().first()
        if item_match:
            primary_bc = next((b.barcode for b in item_match.barcodes if b.is_primary), None)
            return ItemResolutionResponse(
                matched_by="ITEM_CODE",
                item_id=item_match.id,
                item_code=item_match.item_code,
                item_name=item_match.item_name,
                variant_id=item_match.variants[0].id if item_match.variants else None,
                variant_sku=item_match.variants[0].variant_sku if item_match.variants else None,
                barcode=primary_bc,
                tax_rate=float(item_match.tax_rate),
                mrp=float(item_match.mrp),
                selling_price=float(item_match.selling_price),
                cost_price=float(item_match.cost_price),
                primary_uom=item_match.primary_uom,
                category=item_match.category,
                brand=item_match.brand,
            )

        # 4. Tier 4: Serial Number Match
        serial_stmt = (
            select(ItemSerial)
            .options(
                selectinload(ItemSerial.item),
                selectinload(ItemSerial.variant),
            )
            .where(ItemSerial.serial_number == q)
        )
        serial_match = (await session.execute(serial_stmt)).scalars().first()
        if serial_match and serial_match.item:
            item = serial_match.item
            variant = serial_match.variant
            return ItemResolutionResponse(
                matched_by="SERIAL",
                item_id=item.id,
                item_code=item.item_code,
                item_name=item.item_name,
                variant_id=variant.id if variant else None,
                variant_sku=variant.variant_sku if variant else None,
                serial_number=serial_match.serial_number,
                tax_rate=float(item.tax_rate),
                mrp=float(variant.mrp if variant else item.mrp),
                selling_price=float(variant.selling_price if variant else item.selling_price),
                cost_price=float(variant.cost_price if variant else item.cost_price),
                primary_uom=item.primary_uom,
                category=item.category,
                brand=item.brand,
            )

        return None

    @classmethod
    async def create_batch(
        cls,
        session: AsyncSession,
        item_id: str,
        b_data: ItemBatchItem,
    ) -> ItemBatch:
        """Registers an inventory batch with manufacturing and expiration dates."""
        item = await cls.get_item_by_id(session, item_id)
        if not item:
            raise ValueError(f"Item '{item_id}' not found.")

        batch = ItemBatch(
            id=f"batch_{uuid.uuid4().hex[:12]}",
            item_id=item.id,
            variant_id=b_data.variant_id or (item.variants[0].id if item.variants else None),
            batch_number=b_data.batch_number,
            mrp=Decimal(str(b_data.mrp or item.mrp)),
            cost_price=Decimal(str(b_data.cost_price or item.cost_price)),
            is_active=b_data.is_active,
        )
        session.add(batch)
        item.batches.append(batch)
        await session.commit()
        return batch

    @classmethod
    async def register_serial_numbers(
        cls,
        session: AsyncSession,
        item_id: str,
        serial_items: List[ItemSerialItem],
    ) -> List[ItemSerial]:
        """Registers a collection of serialized unit IDs."""
        item = await cls.get_item_by_id(session, item_id)
        if not item:
            raise ValueError(f"Item '{item_id}' not found.")

        created = []
        for s_data in serial_items:
            ser = ItemSerial(
                id=f"ser_{uuid.uuid4().hex[:12]}",
                item_id=item.id,
                variant_id=s_data.variant_id or (item.variants[0].id if item.variants else None),
                serial_number=s_data.serial_number,
                status=s_data.status,
                warehouse_id=s_data.warehouse_id,
            )
            session.add(ser)
            item.serials.append(ser)
            created.append(ser)

        await session.commit()
        return created

    @classmethod
    async def get_legacy_product_view(
        cls,
        session: AsyncSession,
        item_id: str,
    ) -> Optional[LegacyProductAdapterResponse]:
        """Compatibility adapter: Projects Universal Item as a legacy Product object."""
        item = await cls.get_item_by_id(session, item_id)
        if not item:
            return None

        return LegacyProductAdapterResponse(
            id=item.id,
            sku=item.item_code,
            name=item.item_name,
            category=item.category,
            brand=item.brand,
            hsn_code=item.hsn_code,
            tax_rate=float(item.tax_rate),
            price=float(item.selling_price),
            cost=float(item.cost_price),
            mrp=float(item.mrp),
            uom=item.primary_uom,
            is_active=item.status == "ACTIVE",
        )
