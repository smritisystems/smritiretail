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

BarcodeResolverService
───────────────────────
Responsibility: 5-tier barcode/SKU/buyer-code/item-code/serial resolution.
Extracted from: item_master_svc.py::lookup_by_barcode (L1258–L1394)
                item_master_svc.py::resolve_by_key (L1396–L1526)
                item_master_svc.py::resolve_item_by_barcode_or_sku (L1750–L2183)

SRP: Resolves a scan/search key to a fully priced, inventoried item payload.
     It delegates pricing to ItemPricingService and inventory to ItemTrackingService.
"""

from datetime import date
from typing import Any, Dict, Optional

from sqlalchemy import select, or_, and_, case
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ...models.item_master import (
    Item,
    ItemVariant,
    ItemBarcode,
    ItemSerial,
)
from ...models.customer_article_mapping import CustomerArticleMapping
from ...models.inventory import Product
from ...schemas.item_master import ItemResolutionResponse


class BarcodeResolverService:
    """
    Universal 5-Tier Scanner Resolver.

    Resolution tiers (priority order):
        Tier 1 — Exact Barcode Match         (item_barcodes)
        Tier 2 — Variant SKU Match            (item_variants.variant_sku)
        Tier 3 — Buyer Article Code Match     (customer_article_mappings)
        Tier 4 — Item Code Match              (items.item_code)
        Tier 5 — Serial Number Match          (item_serials)

    Each tier returns a fully enriched ItemResolutionResponse with:
        - Effective price (contract-governed)
        - 5-bucket inventory (physical, in-transit, reserved, committed, quarantine)
        - GST split (CGST/SGST/IGST)
        - Pricing audit trail
    """

    @classmethod
    async def lookup_by_barcode(
        cls,
        session: AsyncSession,
        barcode: str,
        branch_id: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Universal Barcode Resolver (simple dict output).
        Used by POS quick-scan path where a full ItemResolutionResponse is not needed.
        Falls back to legacy Product table if not found in canonical item_barcodes.
        """
        from .item_pricing_svc import ItemPricingService
        from .item_tracking_svc import ItemTrackingService

        clean_bc = str(barcode).strip()

        # ── 1. Canonical ItemBarcode table ─────────────────────────────────
        stmt = (
            select(ItemBarcode)
            .where(ItemBarcode.barcode == clean_bc, ItemBarcode.is_deleted == False)
            .options(
                selectinload(ItemBarcode.item),
                selectinload(ItemBarcode.variant),
            )
        )
        barcode_row = (await session.execute(stmt)).scalar_one_or_none()

        if barcode_row and barcode_row.item:
            item = barcode_row.item
            variant = barcode_row.variant
            mrp = float(variant.mrp if variant and variant.mrp else (item.mrp or 0.0))
            selling_price = float(
                variant.selling_price if variant and variant.selling_price else (item.selling_price or 0.0)
            )
            cost_price = float(
                variant.cost_price if variant and variant.cost_price else (item.cost_price or 0.0)
            )
            tax_rate = float(
                variant.tax_rate if variant and variant.tax_rate is not None else (item.tax_rate or 0.0)
            )

            inv_buckets = await ItemTrackingService._compute_inventory_buckets(
                session=session,
                item_id=item.id,
                variant_id=variant.id if variant else None,
                branch_id=branch_id,
                item_code=item.item_code,
                variant_sku=variant.variant_sku if variant else None,
            )
            tax_amount = round(selling_price * (tax_rate / 100.0), 2)

            return {
                "item_id": item.id,
                "item_code": item.item_code,
                "item_name": item.item_name,
                "variant_id": variant.id if variant else None,
                "variant_sku": variant.variant_sku if variant else item.item_code,
                "variant_name": variant.variant_name if variant else None,
                "barcode": clean_bc,
                "barcode_type": barcode_row.barcode_type or "EAN13",
                "mrp": mrp,
                "base_mrp": mrp,
                "selling_price": selling_price,
                "cost_price": cost_price,
                "effective_price": selling_price if selling_price > 0 else mrp,
                "currency": "INR",
                "tax_rate": tax_rate,
                "tax_treatment": "TAXABLE_EXCLUSIVE",
                "tax_amount": tax_amount,
                "effective_price_inclusive": round(selling_price + tax_amount, 2),
                "hsn_code": (variant.hsn_code if variant else None) or item.hsn_code or "64041990",
                "primary_uom": item.primary_uom or "PAIR",
                "is_batch_tracked": item.is_batch_tracked,
                "inventory": inv_buckets,
                "physical_on_hand": inv_buckets["physical_on_hand"],
                "in_transit_qty": inv_buckets["in_transit_qty"],
                "reserved_qty": inv_buckets["reserved_qty"],
                "committed_qty": inv_buckets["committed_qty"],
                "quarantine_qty": inv_buckets["quarantine_qty"],
                "available_to_promise": inv_buckets["available_to_promise"],
            }

        # ── 2. Fallback: legacy Product table ─────────────────────────────
        prod_stmt = select(Product).where(
            or_(
                Product.barcode == clean_bc,
                Product.secondary_barcodes.any(clean_bc),
            ),
            Product.is_deleted == False,
        )
        prod = (await session.execute(prod_stmt)).scalar_one_or_none()
        if prod:
            mrp = float(prod.mrp or prod.price or 0.0)
            selling_price = float(prod.price or 0.0)
            tax_rate = float(prod.gst_percentage or 18.0)
            tax_amount = round(selling_price * (tax_rate / 100.0), 2)
            on_hand = float(prod.stock or 0.0)
            res_stock = float(prod.reserved_stock or 0.0)
            atp = max(0.0, round(on_hand - res_stock, 4))
            inv_buckets = {
                "physical_on_hand": on_hand,
                "in_transit_qty": 0.0,
                "reserved_qty": res_stock,
                "committed_qty": 0.0,
                "quarantine_qty": 0.0,
                "available_to_promise": atp,
            }
            return {
                "item_id": prod.id,
                "item_code": prod.sku or prod.code,
                "item_name": prod.name,
                "variant_id": None,
                "variant_sku": prod.sku or prod.code,
                "variant_name": None,
                "barcode": clean_bc,
                "barcode_type": "EAN13",
                "mrp": mrp,
                "base_mrp": mrp,
                "selling_price": selling_price,
                "cost_price": float(prod.cost_price or 0.0),
                "effective_price": selling_price if selling_price > 0 else mrp,
                "currency": "INR",
                "tax_rate": tax_rate,
                "tax_treatment": "TAXABLE_EXCLUSIVE",
                "tax_amount": tax_amount,
                "effective_price_inclusive": round(selling_price + tax_amount, 2),
                "hsn_code": prod.hsn_code or "6403",
                "primary_uom": "PAIR",
                "is_batch_tracked": getattr(prod, "is_batch_tracked", False),
                "inventory": inv_buckets,
                "physical_on_hand": on_hand,
                "in_transit_qty": 0.0,
                "reserved_qty": res_stock,
                "committed_qty": 0.0,
                "quarantine_qty": 0.0,
                "available_to_promise": atp,
            }

        return None

    @classmethod
    async def resolve_by_key(
        cls,
        session: AsyncSession,
        key: str,
        customer_id: Optional[str] = None,
        branch_id: Optional[str] = None,
        as_of_date: Optional[date] = None,
        transaction_currency: Optional[str] = "INR",
        customer_group_id: Optional[str] = None,
        place_of_supply: Optional[str] = None,
        company_state: Optional[str] = "27",
    ) -> Optional[Dict[str, Any]]:
        """
        Universal 3-Way Product Resolver (barcode OR variant SKU OR buyer material code).
        Returns a pricing-evaluated, inventory-computed dict payload.
        """
        from .item_pricing_svc import ItemPricingService
        from .item_tracking_svc import ItemTrackingService

        clean_key = str(key).strip().upper()
        if not clean_key:
            return None

        stmt = (
            select(Item, ItemVariant, ItemBarcode, CustomerArticleMapping)
            .join(ItemVariant, ItemVariant.item_id == Item.id)
            .outerjoin(
                ItemBarcode,
                and_(ItemBarcode.variant_id == ItemVariant.id, ItemBarcode.is_deleted == False),
            )
            .outerjoin(
                CustomerArticleMapping,
                and_(
                    CustomerArticleMapping.variant_id == ItemVariant.id,
                    CustomerArticleMapping.is_active == True,
                    CustomerArticleMapping.is_deleted == False,
                ),
            )
            .where(
                Item.is_deleted == False,
                ItemVariant.is_deleted == False,
                or_(
                    ItemBarcode.barcode == clean_key,
                    ItemVariant.variant_sku == clean_key,
                    CustomerArticleMapping.customer_article == clean_key,
                ),
            )
            .order_by(
                case((CustomerArticleMapping.customer_id == customer_id, 1), else_=2)
                if customer_id
                else CustomerArticleMapping.id
            )
            .limit(1)
        )
        row = (await session.execute(stmt)).first()

        if row:
            item, variant, barcode_obj, cam = row
            mrp = float(variant.mrp) if variant and variant.mrp and variant.mrp > 0 else float(item.mrp or 0.0)
            selling_price = (
                float(variant.selling_price)
                if variant and variant.selling_price and variant.selling_price > 0
                else float(item.selling_price or 0.0)
            )
            cost_price = (
                float(variant.cost_price)
                if variant and variant.cost_price and variant.cost_price > 0
                else float(item.cost_price or 0.0)
            )

            pricing_eval = await ItemPricingService._evaluate_pricing_contract(
                session=session,
                cam=cam,
                customer_id=customer_id,
                base_mrp=mrp,
                selling_price=selling_price,
                tax_rate=float(item.tax_rate or 0.0),
                as_of_date=as_of_date,
                transaction_currency=transaction_currency,
                customer_group_id=customer_group_id,
                place_of_supply=place_of_supply,
                company_state=company_state,
            )
            inv_buckets = await ItemTrackingService._compute_inventory_buckets(
                session=session,
                item_id=item.id,
                variant_id=variant.id if variant else None,
                branch_id=branch_id,
                item_code=item.item_code,
                variant_sku=variant.variant_sku if variant else None,
            )

            return {
                "item_id": item.id,
                "vendor_article": item.item_code,
                "item_code": item.item_code,
                "item_name": item.item_name,
                "brand": item.brand,
                "category": item.category,
                "hsn_code": (cam.buyer_hsn if (cam and cam.buyer_hsn) else (item.hsn_code or "64041990")),
                "tax_rate": pricing_eval["tax_rate"],
                "tax_treatment": pricing_eval["tax_treatment"],
                "tax_amount": pricing_eval["tax_amount"],
                "effective_price_inclusive": pricing_eval["effective_price_inclusive"],
                "primary_uom": item.primary_uom or "PAIR",
                "variant_id": variant.id,
                "variant_sku": variant.variant_sku,
                "variant_name": variant.variant_name,
                "attributes_json": variant.attributes_json or {},
                "mrp": mrp,
                "base_mrp": mrp,
                "selling_price": selling_price,
                "cost_price": cost_price,
                "effective_price": pricing_eval["effective_price"],
                "currency": pricing_eval["currency"],
                "barcode": barcode_obj.barcode if barcode_obj else (cam.barcode if cam else None),
                "barcode_type": barcode_obj.barcode_type if barcode_obj else "EAN13",
                "customer_article": cam.customer_article if cam else None,
                "contract_discount_pct": pricing_eval["contract_discount_pct"],
                "contract_rate": pricing_eval["contract_rate"],
                "customer_style_description": cam.customer_style_description if cam else None,
                "verification_status": cam.verification_status if cam else "UNMAPPED",
                "is_batch_tracked": item.is_batch_tracked,
                "inventory": inv_buckets,
                "physical_on_hand": inv_buckets["physical_on_hand"],
                "in_transit_qty": inv_buckets["in_transit_qty"],
                "reserved_qty": inv_buckets["reserved_qty"],
                "committed_qty": inv_buckets["committed_qty"],
                "quarantine_qty": inv_buckets["quarantine_qty"],
                "available_to_promise": inv_buckets["available_to_promise"],
                "pricing_audit": pricing_eval["pricing_audit"],
            }

        return await cls.lookup_by_barcode(session, clean_key, branch_id=branch_id)

    @classmethod
    async def resolve_item_by_barcode_or_sku(
        cls,
        session: AsyncSession,
        query_str: str,
        customer_id: Optional[str] = None,
        branch_id: Optional[str] = None,
        as_of_date: Optional[date] = None,
        transaction_currency: Optional[str] = "INR",
        customer_group_id: Optional[str] = None,
        place_of_supply: Optional[str] = None,
        company_state: Optional[str] = "27",
    ) -> Optional[ItemResolutionResponse]:
        """
        Fast 5-Tier Universal Scanner Resolver returning a typed ItemResolutionResponse.
        Used by POS, Sales Order line lookup, and B2B order entry.

        Tier 1 → Barcode
        Tier 2 → Variant SKU
        Tier 3 → Customer/Buyer Article Code
        Tier 4 → Item Code
        Tier 5 → Serial Number
        """
        from .item_pricing_svc import ItemPricingService
        from .item_tracking_svc import ItemTrackingService

        q = query_str.strip()
        if not q:
            return None

        # ── Tier 1: Exact Barcode Match ────────────────────────────────────
        bc_stmt = (
            select(ItemBarcode)
            .options(
                selectinload(ItemBarcode.item),
                selectinload(ItemBarcode.variant),
            )
            .where(ItemBarcode.barcode == q, ItemBarcode.is_deleted == False)
        )
        bc_match = (await session.execute(bc_stmt)).scalars().first()
        if bc_match and bc_match.item:
            item = bc_match.item
            variant = bc_match.variant
            cam = None
            if variant:
                cam_stmt = (
                    select(CustomerArticleMapping)
                    .where(
                        CustomerArticleMapping.variant_id == variant.id,
                        CustomerArticleMapping.is_active == True,
                        CustomerArticleMapping.is_deleted == False,
                        or_(customer_id is None, CustomerArticleMapping.customer_id == customer_id),
                    )
                    .limit(1)
                )
                cam = (await session.execute(cam_stmt)).scalars().first()

            attrs = variant.attributes_json if variant and variant.attributes_json else {}
            mrp_val = float(
                variant.mrp if (variant and variant.mrp and variant.mrp > 0) else (item.mrp or 0.00)
            )
            selling_val = float(
                variant.selling_price
                if (variant and variant.selling_price and variant.selling_price > 0)
                else (item.selling_price or 0.00)
            )
            tax_rate_val = float(
                variant.tax_rate
                if (variant and variant.tax_rate is not None)
                else (item.tax_rate or 0.00)
            )

            pricing_eval = await ItemPricingService._evaluate_pricing_contract(
                session=session, cam=cam, customer_id=customer_id,
                base_mrp=mrp_val, selling_price=selling_val, tax_rate=tax_rate_val,
                as_of_date=as_of_date, transaction_currency=transaction_currency,
                customer_group_id=customer_group_id, place_of_supply=place_of_supply,
                company_state=company_state,
            )
            inv_buckets = await ItemTrackingService._compute_inventory_buckets(
                session=session, item_id=item.id,
                variant_id=variant.id if variant else None,
                branch_id=branch_id, item_code=item.item_code,
                variant_sku=variant.variant_sku if variant else None,
            )

            return ItemResolutionResponse(
                matched_by="BARCODE",
                item_id=item.id, item_code=item.item_code, item_name=item.item_name,
                variant_id=variant.id if variant else None,
                variant_sku=variant.variant_sku if variant else None,
                barcode=bc_match.barcode,
                hsn_code=(cam.buyer_hsn if (cam and cam.buyer_hsn) else (item.hsn_code or "64041990")),
                tax_rate=tax_rate_val, mrp=mrp_val, selling_price=selling_val,
                cost_price=float(variant.cost_price if (variant and variant.cost_price and variant.cost_price > 0) else (item.cost_price or 0.00)),
                effective_price=pricing_eval["effective_price"],
                currency=pricing_eval["currency"],
                tax_treatment=pricing_eval["tax_treatment"],
                tax_amount=pricing_eval["tax_amount"],
                effective_price_inclusive=pricing_eval["effective_price_inclusive"],
                primary_uom=item.primary_uom, category=item.category, brand=item.brand,
                color=attrs.get("color"), size=attrs.get("size"), attributes_json=attrs,
                customer_article=cam.customer_article if cam else None,
                contract_rate=pricing_eval["contract_rate"],
                contract_discount_pct=pricing_eval["contract_discount_pct"],
                customer_style_description=cam.customer_style_description if cam else None,
                physical_on_hand=inv_buckets["physical_on_hand"],
                in_transit_qty=inv_buckets["in_transit_qty"],
                reserved_qty=inv_buckets["reserved_qty"],
                committed_qty=inv_buckets["committed_qty"],
                quarantine_qty=inv_buckets["quarantine_qty"],
                available_to_promise=inv_buckets["available_to_promise"],
                inventory=inv_buckets, pricing_audit=pricing_eval["pricing_audit"],
            )

        # ── Tier 2: Variant SKU Match ──────────────────────────────────────
        var_stmt = (
            select(ItemVariant)
            .options(selectinload(ItemVariant.item), selectinload(ItemVariant.barcodes))
            .where(ItemVariant.variant_sku.ilike(q), ItemVariant.is_deleted == False)
        )
        var_match = (await session.execute(var_stmt)).scalars().first()
        if var_match and var_match.item:
            item = var_match.item
            primary_bc = (
                next((b.barcode for b in var_match.barcodes if b.is_primary and not b.is_deleted), None)
                or (var_match.barcodes[0].barcode if var_match.barcodes else None)
            )
            cam_stmt = (
                select(CustomerArticleMapping)
                .where(
                    CustomerArticleMapping.variant_id == var_match.id,
                    CustomerArticleMapping.is_active == True,
                    CustomerArticleMapping.is_deleted == False,
                    or_(customer_id is None, CustomerArticleMapping.customer_id == customer_id),
                )
                .limit(1)
            )
            cam = (await session.execute(cam_stmt)).scalars().first()
            attrs = var_match.attributes_json or {}
            mrp_val = float(var_match.mrp if (var_match.mrp and var_match.mrp > 0) else (item.mrp or 0.00))
            selling_val = float(
                var_match.selling_price
                if (var_match.selling_price and var_match.selling_price > 0)
                else (item.selling_price or 0.00)
            )
            tax_rate_val = float(
                var_match.tax_rate if var_match.tax_rate is not None else (item.tax_rate or 0.00)
            )

            pricing_eval = await ItemPricingService._evaluate_pricing_contract(
                session=session, cam=cam, customer_id=customer_id,
                base_mrp=mrp_val, selling_price=selling_val, tax_rate=tax_rate_val,
                as_of_date=as_of_date, transaction_currency=transaction_currency,
                customer_group_id=customer_group_id, place_of_supply=place_of_supply,
                company_state=company_state,
            )
            inv_buckets = await ItemTrackingService._compute_inventory_buckets(
                session=session, item_id=item.id, variant_id=var_match.id,
                branch_id=branch_id, item_code=item.item_code, variant_sku=var_match.variant_sku,
            )

            return ItemResolutionResponse(
                matched_by="VARIANT_SKU",
                item_id=item.id, item_code=item.item_code, item_name=item.item_name,
                variant_id=var_match.id, variant_sku=var_match.variant_sku,
                barcode=primary_bc,
                hsn_code=(cam.buyer_hsn if (cam and cam.buyer_hsn) else (item.hsn_code or "64041990")),
                tax_rate=tax_rate_val, mrp=mrp_val, selling_price=selling_val,
                cost_price=float(var_match.cost_price if (var_match.cost_price and var_match.cost_price > 0) else (item.cost_price or 0.00)),
                effective_price=pricing_eval["effective_price"],
                currency=pricing_eval["currency"],
                tax_treatment=pricing_eval["tax_treatment"],
                tax_amount=pricing_eval["tax_amount"],
                effective_price_inclusive=pricing_eval["effective_price_inclusive"],
                primary_uom=item.primary_uom, category=item.category, brand=item.brand,
                color=attrs.get("color"), size=attrs.get("size"), attributes_json=attrs,
                customer_article=cam.customer_article if cam else None,
                contract_rate=pricing_eval["contract_rate"],
                contract_discount_pct=pricing_eval["contract_discount_pct"],
                customer_style_description=cam.customer_style_description if cam else None,
                physical_on_hand=inv_buckets["physical_on_hand"],
                in_transit_qty=inv_buckets["in_transit_qty"],
                reserved_qty=inv_buckets["reserved_qty"],
                committed_qty=inv_buckets["committed_qty"],
                quarantine_qty=inv_buckets["quarantine_qty"],
                available_to_promise=inv_buckets["available_to_promise"],
                inventory=inv_buckets, pricing_audit=pricing_eval["pricing_audit"],
            )

        # ── Tier 3: Customer / Buyer Article Code Match ────────────────────
        cam_stmt = (
            select(CustomerArticleMapping)
            .options(
                selectinload(CustomerArticleMapping.item),
                selectinload(CustomerArticleMapping.variant),
            )
            .where(
                CustomerArticleMapping.customer_article == q,
                CustomerArticleMapping.is_active == True,
                CustomerArticleMapping.is_deleted == False,
            )
            .order_by(
                case((CustomerArticleMapping.customer_id == customer_id, 1), else_=2)
                if customer_id
                else CustomerArticleMapping.id
            )
        )
        cam_match = (await session.execute(cam_stmt)).scalars().first()
        if cam_match and cam_match.item and cam_match.variant:
            item = cam_match.item
            variant = cam_match.variant
            attrs = variant.attributes_json or {}
            mrp_val = float(
                cam_match.base_mrp
                if (cam_match.base_mrp and cam_match.base_mrp > 0)
                else (variant.mrp or item.mrp or 0.00)
            )
            selling_val = float(
                variant.selling_price
                if (variant.selling_price and variant.selling_price > 0)
                else (item.selling_price or 0.00)
            )
            tax_rate_val = float(
                variant.tax_rate if variant.tax_rate is not None else (item.tax_rate or 0.00)
            )

            pricing_eval = await ItemPricingService._evaluate_pricing_contract(
                session=session, cam=cam_match, customer_id=customer_id,
                base_mrp=mrp_val, selling_price=selling_val, tax_rate=tax_rate_val,
                as_of_date=as_of_date, transaction_currency=transaction_currency,
                customer_group_id=customer_group_id, place_of_supply=place_of_supply,
                company_state=company_state,
            )
            inv_buckets = await ItemTrackingService._compute_inventory_buckets(
                session=session, item_id=item.id, variant_id=variant.id,
                branch_id=branch_id, item_code=item.item_code, variant_sku=variant.variant_sku,
            )

            return ItemResolutionResponse(
                matched_by="BUYER_CODE",
                item_id=item.id, item_code=item.item_code, item_name=item.item_name,
                variant_id=variant.id, variant_sku=variant.variant_sku,
                barcode=cam_match.barcode, hsn_code=cam_match.buyer_hsn or item.hsn_code,
                tax_rate=tax_rate_val, mrp=mrp_val, selling_price=selling_val,
                cost_price=float(variant.cost_price if (variant.cost_price and variant.cost_price > 0) else (item.cost_price or 0.00)),
                effective_price=pricing_eval["effective_price"],
                currency=pricing_eval["currency"],
                tax_treatment=pricing_eval["tax_treatment"],
                tax_amount=pricing_eval["tax_amount"],
                effective_price_inclusive=pricing_eval["effective_price_inclusive"],
                primary_uom=item.primary_uom, category=item.category, brand=item.brand,
                color=cam_match.color or attrs.get("color"),
                size=cam_match.size or attrs.get("size"),
                attributes_json=attrs,
                customer_article=cam_match.customer_article,
                contract_rate=pricing_eval["contract_rate"],
                contract_discount_pct=pricing_eval["contract_discount_pct"],
                customer_style_description=cam_match.customer_style_description,
                physical_on_hand=inv_buckets["physical_on_hand"],
                in_transit_qty=inv_buckets["in_transit_qty"],
                reserved_qty=inv_buckets["reserved_qty"],
                committed_qty=inv_buckets["committed_qty"],
                quarantine_qty=inv_buckets["quarantine_qty"],
                available_to_promise=inv_buckets["available_to_promise"],
                inventory=inv_buckets, pricing_audit=pricing_eval["pricing_audit"],
            )

        # ── Tier 4: Item Code Match ────────────────────────────────────────
        item_stmt = (
            select(Item)
            .options(selectinload(Item.variants), selectinload(Item.barcodes))
            .where(Item.item_code.ilike(q), Item.is_deleted == False)
        )
        item_match = (await session.execute(item_stmt)).scalars().first()
        if item_match:
            primary_bc = (
                next((b.barcode for b in item_match.barcodes if b.is_primary and not b.is_deleted), None)
                or (item_match.barcodes[0].barcode if item_match.barcodes else None)
            )
            var0 = item_match.variants[0] if item_match.variants else None
            attrs = var0.attributes_json if var0 and var0.attributes_json else {}
            mrp_val = float(item_match.mrp or 0.00)
            selling_val = float(item_match.selling_price or 0.00)
            tax_rate_val = float(item_match.tax_rate or 0.00)

            pricing_eval = await ItemPricingService._evaluate_pricing_contract(
                session=session, cam=None, customer_id=customer_id,
                base_mrp=mrp_val, selling_price=selling_val, tax_rate=tax_rate_val,
                as_of_date=as_of_date, transaction_currency=transaction_currency,
                customer_group_id=customer_group_id, place_of_supply=place_of_supply,
                company_state=company_state,
            )
            inv_buckets = await ItemTrackingService._compute_inventory_buckets(
                session=session, item_id=item_match.id,
                variant_id=var0.id if var0 else None,
                branch_id=branch_id, item_code=item_match.item_code,
                variant_sku=var0.variant_sku if var0 else None,
            )

            return ItemResolutionResponse(
                matched_by="ITEM_CODE",
                item_id=item_match.id, item_code=item_match.item_code, item_name=item_match.item_name,
                variant_id=var0.id if var0 else None,
                variant_sku=var0.variant_sku if var0 else None,
                barcode=primary_bc, hsn_code=item_match.hsn_code,
                tax_rate=tax_rate_val, mrp=mrp_val, selling_price=selling_val,
                cost_price=float(item_match.cost_price or 0.00),
                effective_price=pricing_eval["effective_price"],
                currency=pricing_eval["currency"],
                tax_treatment=pricing_eval["tax_treatment"],
                tax_amount=pricing_eval["tax_amount"],
                effective_price_inclusive=pricing_eval["effective_price_inclusive"],
                primary_uom=item_match.primary_uom, category=item_match.category, brand=item_match.brand,
                color=attrs.get("color"), size=attrs.get("size"), attributes_json=attrs,
                physical_on_hand=inv_buckets["physical_on_hand"],
                in_transit_qty=inv_buckets["in_transit_qty"],
                reserved_qty=inv_buckets["reserved_qty"],
                committed_qty=inv_buckets["committed_qty"],
                quarantine_qty=inv_buckets["quarantine_qty"],
                available_to_promise=inv_buckets["available_to_promise"],
                inventory=inv_buckets, pricing_audit=pricing_eval["pricing_audit"],
            )

        # ── Tier 5: Serial Number Match ────────────────────────────────────
        serial_stmt = (
            select(ItemSerial)
            .options(selectinload(ItemSerial.item), selectinload(ItemSerial.variant))
            .where(ItemSerial.serial_number == q)
        )
        serial_match = (await session.execute(serial_stmt)).scalars().first()
        if serial_match and serial_match.item:
            item = serial_match.item
            variant = serial_match.variant
            attrs = variant.attributes_json if variant and variant.attributes_json else {}
            mrp_val = float(variant.mrp if variant and variant.mrp else (item.mrp or 0.00))
            selling_val = float(
                variant.selling_price if variant and variant.selling_price else (item.selling_price or 0.00)
            )
            tax_rate_val = float(item.tax_rate or 0.00)

            pricing_eval = await ItemPricingService._evaluate_pricing_contract(
                session=session, cam=None, customer_id=customer_id,
                base_mrp=mrp_val, selling_price=selling_val, tax_rate=tax_rate_val,
                as_of_date=as_of_date, transaction_currency=transaction_currency,
                customer_group_id=customer_group_id, place_of_supply=place_of_supply,
                company_state=company_state,
            )
            inv_buckets = await ItemTrackingService._compute_inventory_buckets(
                session=session, item_id=item.id,
                variant_id=variant.id if variant else None,
                branch_id=branch_id, item_code=item.item_code,
                variant_sku=variant.variant_sku if variant else None,
            )

            return ItemResolutionResponse(
                matched_by="SERIAL",
                item_id=item.id, item_code=item.item_code, item_name=item.item_name,
                variant_id=variant.id if variant else None,
                variant_sku=variant.variant_sku if variant else None,
                serial_number=serial_match.serial_number,
                hsn_code=item.hsn_code, tax_rate=tax_rate_val,
                mrp=mrp_val, selling_price=selling_val,
                cost_price=float(variant.cost_price if variant and variant.cost_price else (item.cost_price or 0.00)),
                effective_price=pricing_eval["effective_price"],
                currency=pricing_eval["currency"],
                tax_treatment=pricing_eval["tax_treatment"],
                tax_amount=pricing_eval["tax_amount"],
                effective_price_inclusive=pricing_eval["effective_price_inclusive"],
                primary_uom=item.primary_uom, category=item.category, brand=item.brand,
                color=attrs.get("color"), size=attrs.get("size"), attributes_json=attrs,
                physical_on_hand=inv_buckets["physical_on_hand"],
                in_transit_qty=inv_buckets["in_transit_qty"],
                reserved_qty=inv_buckets["reserved_qty"],
                committed_qty=inv_buckets["committed_qty"],
                quarantine_qty=inv_buckets["quarantine_qty"],
                available_to_promise=inv_buckets["available_to_promise"],
                inventory=inv_buckets, pricing_audit=pricing_eval["pricing_audit"],
            )

        return None
