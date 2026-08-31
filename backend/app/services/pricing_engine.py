"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-08-23
Modified     : 2026-08-25
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import uuid
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, Any, List, Optional
from sqlalchemy import select, and_, or_, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models.pricing import PriceBook, PriceBookEntry, CustomerPriceTier
from ..models.item_master import Item, ItemVariant
from ..models.inventory import Product
from ..schemas.pricing import (
    PriceBookCreateRequest,
    PriceBookUpdateRequest,
    PriceBookResponse,
    PriceBookEntryCreateRequest,
    PriceBookEntryResponse,
    CustomerPriceTierCreateRequest,
    CustomerPriceTierResponse,
    PricingResolutionRequest,
    PricingResolutionResponse,
    BulkPricingRequest,
    BulkPricingResponse,
    PricingSnapshot,
)


class PricingEngine:
    """
    Authoritative SMRITI Pricing Engine (Section 7).
    Determines effective selling prices across retail, wholesale, dealer tiers, volume breaks, and promo modifiers.
    Guarantees historical pricing snapshots and immutable calculation replays.
    """

    @classmethod
    async def create_price_book(
        cls,
        session: AsyncSession,
        company_id: str,
        req: PriceBookCreateRequest,
        created_by: Optional[str] = None,
    ) -> PriceBook:
        """Creates a new Price Book header with date validity and currency controls."""
        stmt_check = select(PriceBook).where(
            PriceBook.code == req.code,
        )
        existing = (await session.execute(stmt_check)).scalars().first()
        if existing:
            raise ValueError(f"Price Book with code '{req.code}' already exists.")

        # If marked default, unset existing default
        if req.is_default:
            stmt_def = select(PriceBook).where(PriceBook.is_default == True)
            def_books = (await session.execute(stmt_def)).scalars().all()
            for b in def_books:
                b.is_default = False

        pb = PriceBook(
            id=f"pb_{uuid.uuid4().hex[:12]}",
            company_id=company_id,
            name=req.name,
            code=req.code,
            currency=req.currency,
            is_default=req.is_default,
            valid_from=req.valid_from,
            valid_to=req.valid_to,
            status=req.status.upper(),
            description=req.description,
            created_by=created_by,
        )
        session.add(pb)
        await session.commit()
        return pb

    @classmethod
    async def add_price_book_entry(
        cls,
        session: AsyncSession,
        company_id: str,
        price_book_id: str,
        req: PriceBookEntryCreateRequest,
        created_by: Optional[str] = None,
    ) -> PriceBookEntry:
        """Adds or updates a price point for an Item / Variant with volume break support."""
        stmt_pb = select(PriceBook).where(PriceBook.id == price_book_id)
        pb = (await session.execute(stmt_pb)).scalars().first()
        if not pb:
            raise ValueError(f"Price Book '{price_book_id}' not found.")

        # Check existing entry with same volume break
        stmt_e = select(PriceBookEntry).where(
            PriceBookEntry.price_book_id == price_book_id,
            PriceBookEntry.item_id == req.item_id,
            PriceBookEntry.variant_id == req.variant_id,
            PriceBookEntry.min_quantity == Decimal(str(req.min_quantity)),
        )
        entry = (await session.execute(stmt_e)).scalars().first()

        if entry:
            entry.selling_price = Decimal(str(req.selling_price))
            entry.mrp = Decimal(str(req.mrp))
            entry.cost_price = Decimal(str(req.cost_price)) if req.cost_price is not None else None
            entry.updated_by = created_by
        else:
            entry = PriceBookEntry(
                id=f"pbe_{uuid.uuid4().hex[:12]}",
                company_id=company_id,
                price_book_id=price_book_id,
                item_id=req.item_id,
                variant_id=req.variant_id,
                min_quantity=Decimal(str(req.min_quantity)),
                selling_price=Decimal(str(req.selling_price)),
                mrp=Decimal(str(req.mrp)),
                cost_price=Decimal(str(req.cost_price)) if req.cost_price is not None else None,
                created_by=created_by,
            )
            session.add(entry)

        await session.commit()
        return entry

    @classmethod
    async def create_customer_tier(
        cls,
        session: AsyncSession,
        company_id: str,
        req: CustomerPriceTierCreateRequest,
        created_by: Optional[str] = None,
    ) -> CustomerPriceTier:
        """Creates a Customer Price Tier with default percentage discounts or price book bindings."""
        stmt_check = select(CustomerPriceTier).where(CustomerPriceTier.code == req.code)
        existing = (await session.execute(stmt_check)).scalars().first()
        if existing:
            raise ValueError(f"Customer Price Tier with code '{req.code}' already exists.")

        tier = CustomerPriceTier(
            id=f"cpt_{uuid.uuid4().hex[:12]}",
            company_id=company_id,
            name=req.name,
            code=req.code,
            price_book_id=req.price_book_id,
            discount_percentage=Decimal(str(req.discount_percentage)),
            description=req.description,
            created_by=created_by,
        )
        session.add(tier)
        await session.commit()
        return tier

    @classmethod
    async def calculate_effective_price(
        cls,
        session: AsyncSession,
        item_id: str,
        variant_id: Optional[str] = None,
        quantity: Decimal = Decimal("1.00"),
        price_book_code: Optional[str] = None,
        customer_tier_code: Optional[str] = None,
        as_of_date: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        """
        Authoritatively resolves the effective unit price in order of precedence:
        1. Explicit or active Price Book volume break (quantity >= min_quantity) with date validity gating.
        2. Customer Price Tier discount percentage modifier.
        3. ItemVariant selling_price baseline.
        4. Item selling_price baseline.
        5. Fallback Product Master price.
        """
        now = as_of_date or datetime.now(timezone.utc)
        qty_dec = Decimal(str(quantity)) if not isinstance(quantity, Decimal) else quantity

        # 1. Query base Item and Variant
        base_selling_price = Decimal("0.00")
        base_mrp = Decimal("0.00")
        pricing_source = "ITEM_MASTER"

        stmt_item = select(Item).where(Item.id == item_id)
        item = (await session.execute(stmt_item)).scalars().first()
        if item:
            base_selling_price = Decimal(str(item.selling_price or 0.0))
            base_mrp = Decimal(str(item.mrp or item.selling_price or 0.0))
        else:
            # Fallback to Product master
            stmt_prod = select(Product).where(or_(Product.id == item_id, Product.code == item_id, Product.sku == item_id))
            prod = (await session.execute(stmt_prod)).scalars().first()
            if prod:
                base_selling_price = Decimal(str(prod.price or 0.0))
                base_mrp = Decimal(str(prod.mrp or prod.price or 0.0))
                pricing_source = "PRODUCT_MASTER"
            else:
                raise ValueError(f"Item or Product '{item_id}' not found.")

        if variant_id:
            stmt_var = select(ItemVariant).where(ItemVariant.id == variant_id)
            variant = (await session.execute(stmt_var)).scalars().first()
            if variant:
                base_selling_price = Decimal(str(variant.selling_price or base_selling_price))
                base_mrp = Decimal(str(variant.mrp or base_mrp))
                pricing_source = "VARIANT_MASTER"

        effective_price = base_selling_price
        applied_price_book = None
        applied_tier = None
        discount_percentage = Decimal("0.00")

        # 2. Resolve Price Book (Explicit code, or Tier-bound price book, or Default active book)
        resolved_pb_code = price_book_code
        if not resolved_pb_code and customer_tier_code:
            stmt_tier_pb = select(CustomerPriceTier).where(CustomerPriceTier.code == customer_tier_code)
            tier_match = (await session.execute(stmt_tier_pb)).scalars().first()
            if tier_match and tier_match.price_book_id:
                stmt_pb_id = select(PriceBook).where(PriceBook.id == tier_match.price_book_id)
                pb_match = (await session.execute(stmt_pb_id)).scalars().first()
                if pb_match:
                    resolved_pb_code = pb_match.code

        if resolved_pb_code:
            stmt_pb = select(PriceBook).where(
                PriceBook.code == resolved_pb_code,
                PriceBook.status == "ACTIVE",
            )
            price_book = (await session.execute(stmt_pb)).scalars().first()
            if price_book:
                # Check date validity gating
                is_valid = True
                if price_book.valid_from and now < price_book.valid_from:
                    is_valid = False
                if price_book.valid_to and now > price_book.valid_to:
                    is_valid = False

                if is_valid:
                    # Find matching volume break entry
                    stmt_pbe = select(PriceBookEntry).where(
                        PriceBookEntry.price_book_id == price_book.id,
                        PriceBookEntry.item_id == item_id,
                        PriceBookEntry.min_quantity <= qty_dec,
                    ).order_by(PriceBookEntry.min_quantity.desc())
                    
                    if variant_id:
                        stmt_pbe = stmt_pbe.where(
                            or_(PriceBookEntry.variant_id == variant_id, PriceBookEntry.variant_id.is_(None))
                        )

                    pbe = (await session.execute(stmt_pbe)).scalars().first()
                    if pbe:
                        effective_price = Decimal(str(pbe.selling_price))
                        base_mrp = Decimal(str(pbe.mrp or base_mrp))
                        applied_price_book = price_book.code
                        pricing_source = "PRICE_BOOK_VOLUME"

        # 3. Customer Price Tier Modifier (if tier provided and has discount)
        if customer_tier_code:
            stmt_tier = select(CustomerPriceTier).where(CustomerPriceTier.code == customer_tier_code)
            tier = (await session.execute(stmt_tier)).scalars().first()
            if tier and tier.discount_percentage > 0:
                discount_percentage = Decimal(str(tier.discount_percentage))
                effective_price = effective_price * (Decimal("1.00") - (discount_percentage / Decimal("100.00")))
                applied_tier = tier.code
                if pricing_source != "PRICE_BOOK_VOLUME":
                    pricing_source = "CUSTOMER_TIER"

        effective_price = effective_price.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        subtotal = (effective_price * qty_dec).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

        return {
            "item_id": item_id,
            "variant_id": variant_id,
            "quantity": float(qty_dec),
            "base_mrp": float(base_mrp),
            "base_selling_price": float(base_selling_price),
            "effective_unit_price": float(effective_price),
            "line_subtotal": float(subtotal),
            "applied_price_book": applied_price_book,
            "applied_tier": applied_tier,
            "discount_percentage": float(discount_percentage),
            "pricing_source": pricing_source,
            "rule_version": 1,
        }

    @classmethod
    async def calculate_bulk_pricing(
        cls,
        session: AsyncSession,
        req: BulkPricingRequest,
    ) -> BulkPricingResponse:
        """Calculates multi-line item pricing for complete cart, invoice, or quotation workflows."""
        lines = []
        tot_qty = 0.0
        tot_mrp = 0.0
        tot_subtotal = 0.0

        for line in req.items:
            res = await cls.calculate_effective_price(
                session=session,
                item_id=line.item_id,
                variant_id=line.variant_id,
                quantity=Decimal(str(line.quantity)),
                price_book_code=req.price_book_code,
                customer_tier_code=req.customer_tier_code,
                as_of_date=req.as_of_date,
            )

            # Apply additional line-level custom discount if any
            if line.custom_discount_percentage and line.custom_discount_percentage > 0:
                cd_dec = Decimal(str(line.custom_discount_percentage))
                unit_p = Decimal(str(res["effective_unit_price"])) * (Decimal("1.00") - (cd_dec / Decimal("100.00")))
                unit_p = unit_p.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                res["effective_unit_price"] = float(unit_p)
                res["line_subtotal"] = float((unit_p * Decimal(str(line.quantity))).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))
                res["discount_percentage"] = float(res["discount_percentage"] + line.custom_discount_percentage)

            lines.append(PricingResolutionResponse(**res))
            tot_qty += res["quantity"]
            tot_mrp += res["base_mrp"] * res["quantity"]
            tot_subtotal += res["line_subtotal"]

        tot_savings = max(0.0, round(tot_mrp - tot_subtotal, 2))

        return BulkPricingResponse(
            lines=lines,
            total_quantity=round(tot_qty, 4),
            total_mrp=round(tot_mrp, 2),
            total_subtotal=round(tot_subtotal, 2),
            total_savings=tot_savings,
            applied_price_book=req.price_book_code,
            applied_customer_tier=req.customer_tier_code,
        )

    @classmethod
    async def generate_pricing_snapshot(
        cls,
        session: AsyncSession,
        req: BulkPricingRequest,
    ) -> PricingSnapshot:
        """
        Generates an immutable pricing snapshot designed to be stored inside Sales Invoices,
        Quotations, or Orders for zero-drift historical replay.
        """
        bulk_res = await cls.calculate_bulk_pricing(session, req)
        return PricingSnapshot(
            pricing_engine_version=1,
            calculation_timestamp=datetime.now(timezone.utc).isoformat(),
            applied_price_book=bulk_res.applied_price_book,
            applied_tier=bulk_res.applied_customer_tier,
            lines=bulk_res.lines,
            total_subtotal=bulk_res.total_subtotal,
            total_savings=bulk_res.total_savings,
        )
