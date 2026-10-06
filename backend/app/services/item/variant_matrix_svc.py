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

VariantMatrixService
────────────────────
Responsibility: Size x Color Cartesian product variant matrix generation.
Extracted from: item_master_svc.py::generate_matrix_variants (L1586–L1747)

SRP: Generates permutations of attributes (dimensions) into ItemVariant rows,
     assigns primary barcodes, synchronizes to legacy products table,
     and provisions default PriceBookEntry rows.
"""

import uuid
import itertools
import re
from decimal import Decimal
from typing import Any, Dict, List, Optional
from sqlalchemy import select, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession

from ...models.item_master import (
    Item,
    ItemVariant,
    ItemBarcode,
    LegacyIdMapping,
)
from ...models.inventory import Product
from ...models.pricing import PriceBook, PriceBookEntry
from ...schemas.item_master import MatrixVariantGenRequest


class VariantMatrixService:
    """
    Matrix Variant Generator (Cartesian SKU Combinator).

    Generates all permutations across specified dimensions (e.g. Size x Color),
    creates ItemVariant records with generated SKUs, generates provisional barcodes,
    and synchronizes records to legacy Product and PriceBook registries.
    """

    @classmethod
    def generate_placeholder_barcode(
        cls,
        prefix: Optional[str] = "S",
        allow_no_prefix: bool = True,
    ) -> str:
        """
        [DEPRECATED / PROHIBITED - ADR-001 / R-01]
        Runtime synthetic barcode generation is strictly prohibited.
        Official barcodes must be assigned or left unassigned.
        """
        raise RuntimeError(
            "Synthetic barcode generation is prohibited under SMRITI Item Master Architecture (ADR-001/R-01). "
            "Official barcodes must be assigned or left unassigned."
        )

    @classmethod
    async def generate_matrix_variants(
        cls,
        session: AsyncSession,
        item_id: str,
        req: MatrixVariantGenRequest,
    ) -> List[ItemVariant]:
        """
        Matrix Variant Generator (Size x Color Cartesian product):
        Generates unique SKU dimensions without synthetic barcodes per ADR-001/R-01.
        """
        from .item_catalog_svc import ItemCatalogService

        item = await ItemCatalogService.get_item_by_id(session, item_id)
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
                    select(ItemVariant).where(
                        ItemVariant.company_id == item.company_id,
                        ItemVariant.variant_sku == variant_sku,
                        ItemVariant.is_deleted == False,
                    )
                )
            ).scalars().first()

            if not existing_var:
                mrp_val = Decimal(str(req.base_mrp if req.base_mrp is not None else item.mrp))
                selling_val = Decimal(str(req.base_selling_price if req.base_selling_price is not None else item.selling_price))
                cost_val = Decimal(str(req.base_cost_price if req.base_cost_price is not None else item.cost_price))

                # Extract first-class color and size from attributes if present
                v_color = None
                v_size = None
                for k, v in attr_dict.items():
                    if str(k).lower() == "color":
                        v_color = str(v).strip()
                    elif str(k).lower() == "size":
                        v_size = str(v).strip()

                var = ItemVariant(
                    id=f"var_{uuid.uuid4().hex[:12]}",
                    uuid=str(uuid.uuid4()),
                    company_id=item.company_id,
                    branch_id=item.branch_id,
                    item_id=item.id,
                    variant_sku=variant_sku,
                    variant_name=variant_name,
                    color=v_color,
                    size=v_size,
                    attributes_json=attr_dict,
                    mrp=mrp_val,
                    selling_price=selling_val,
                    cost_price=cost_val,
                    is_active=True,
                    is_deleted=False,
                )
                session.add(var)
                await session.flush()

                # ADR-001 / R-01: NO synthetic barcodes can be created at runtime.
                # Barcode remains unassigned (None) until officially assigned.

                created_variants.append(var)
                item.variants.append(var)

                # Synchronize variant to products table (Requirement 8)
                prod_stmt = select(Product).where(
                    Product.company_id == item.company_id,
                    or_(
                        and_(Product.item_id == item.id, Product.item_variant_id == var.id),
                        Product.sku == var.variant_sku,
                        Product.code == var.variant_sku
                    ),
                    Product.is_deleted == False
                )
                existing_p = (await session.execute(prod_stmt)).scalars().first()
                if not existing_p:
                    new_prod = Product(
                        id=f"prod_{uuid.uuid4().hex[:12]}",
                        uuid=str(uuid.uuid4()),
                        company_id=item.company_id,
                        branch_id=item.branch_id,
                        code=var.variant_sku,
                        sku=var.variant_sku,
                        name=var.variant_name or item.item_name,
                        style_code=item.style_code or item.item_code,
                        brand=item.brand,
                        category=item.category,
                        category_code=item.category_code,
                        item_id=item.id,
                        item_variant_id=var.id,
                        mrp=var.mrp or item.mrp,
                        price=var.selling_price or item.selling_price,
                        cost_price=var.cost_price or item.cost_price,
                        buying_price=item.buying_price,
                        gst_percentage=item.tax_rate,
                        hsn_code=var.hsn_code or item.hsn_code,
                        barcode=var.variant_sku,
                        attributes=attr_dict,
                        is_active=True,
                        is_deleted=False
                    )
                    session.add(new_prod)
                    await session.flush()
                    session.add(LegacyIdMapping(
                        id=f"map_{uuid.uuid4().hex[:12]}",
                        uuid=str(uuid.uuid4()),
                        company_id=item.company_id,
                        branch_id=item.branch_id,
                        migration_run_id="matrix_gen",
                        legacy_table="products",
                        legacy_id=new_prod.id,
                        legacy_uuid=new_prod.uuid,
                        canonical_table="item_variants",
                        canonical_id=var.id,
                        canonical_uuid=var.uuid,
                        disposition="SYNCED",
                        is_active=True,
                        is_deleted=False
                    ))
                else:
                    existing_p.item_id = item.id
                    existing_p.item_variant_id = var.id

                # Ensure default PriceBookEntry exists
                res_pb = await session.execute(
                    select(PriceBook).filter(
                        PriceBook.company_id == item.company_id,
                        PriceBook.is_default == True,
                        PriceBook.is_deleted == False
                    )
                )
                default_pb = res_pb.scalars().first()
                if default_pb:
                    pbe_stmt = select(PriceBookEntry).where(
                        PriceBookEntry.price_book_id == default_pb.id,
                        PriceBookEntry.variant_id == var.id,
                        PriceBookEntry.is_deleted == False
                    )
                    pbe_obj = (await session.execute(pbe_stmt)).scalars().first()
                    if not pbe_obj:
                        session.add(PriceBookEntry(
                            id=f"pbe_{uuid.uuid4().hex[:12]}",
                            uuid=str(uuid.uuid4()),
                            company_id=item.company_id,
                            branch_id=item.branch_id,
                            price_book_id=default_pb.id,
                            item_id=item.id,
                            variant_id=var.id,
                            min_quantity=Decimal("1.0000"),
                            selling_price=var.selling_price or Decimal("0.00"),
                            mrp=var.mrp or Decimal("0.00"),
                            cost_price=var.cost_price or Decimal("0.00"),
                            is_active=True,
                            is_deleted=False
                        ))

        await session.commit()
        return created_variants
