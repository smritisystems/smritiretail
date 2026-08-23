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

from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, Any, List, Optional
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.pricing import PriceBook, PriceBookEntry, CustomerPriceTier
from ..models.item_master import Item, ItemVariant


class PricingEngine:
    """
    Unified SMRITI Pricing Engine (Section 7).
    Determines effective selling price across retail, wholesale, dealer tiers, volume breaks, and promo modifiers.
    """

    @classmethod
    async def calculate_effective_price(
        cls,
        session: AsyncSession,
        item_id: str,
        variant_id: Optional[str] = None,
        quantity: Decimal = Decimal("1.00"),
        price_book_code: Optional[str] = None,
        customer_tier_code: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Resolves effective unit price in order of precedence:
        1. Price Book Entry with matching volume tier (quantity >= min_quantity)
        2. Customer Price Tier discount percentage
        3. ItemVariant selling_price baseline
        4. Item selling_price baseline
        """
        # Step 1: Query base Item and Variant
        item_stmt = select(Item).where(Item.id == item_id)
        item = (await session.execute(item_stmt)).scalars().first()
        if not item:
            raise ValueError(f"Item '{item_id}' not found.")

        base_selling_price = Decimal(str(item.selling_price))
        base_mrp = Decimal(str(item.mrp))

        if variant_id:
            var_stmt = select(ItemVariant).where(ItemVariant.id == variant_id)
            variant = (await session.execute(var_stmt)).scalars().first()
            if variant:
                base_selling_price = Decimal(str(variant.selling_price))
                base_mrp = Decimal(str(variant.mrp))

        effective_price = base_selling_price
        applied_price_book = None
        applied_tier = None
        discount_percentage = Decimal("0.00")

        # Step 2: Price Book Lookup (if specified)
        if price_book_code:
            pb_stmt = select(PriceBook).where(
                PriceBook.code == price_book_code,
                PriceBook.status == "ACTIVE"
            )
            price_book = (await session.execute(pb_stmt)).scalars().first()
            if price_book:
                # Find matching volume break entry
                pbe_stmt = select(PriceBookEntry).where(
                    PriceBookEntry.price_book_id == price_book.id,
                    PriceBookEntry.item_id == item_id,
                    PriceBookEntry.min_quantity <= quantity
                ).order_by(PriceBookEntry.min_quantity.desc())
                
                pbe = (await session.execute(pbe_stmt)).scalars().first()
                if pbe:
                    effective_price = Decimal(str(pbe.selling_price))
                    applied_price_book = price_book.code

        # Step 3: Customer Price Tier Modifier (if tier provided)
        if customer_tier_code:
            tier_stmt = select(CustomerPriceTier).where(CustomerPriceTier.code == customer_tier_code)
            tier = (await session.execute(tier_stmt)).scalars().first()
            if tier and tier.discount_percentage > 0:
                discount_percentage = Decimal(str(tier.discount_percentage))
                effective_price = effective_price * (Decimal("1.00") - (discount_percentage / Decimal("100.00")))
                applied_tier = tier.code

        effective_price = effective_price.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

        return {
            "item_id": item.id,
            "variant_id": variant_id,
            "quantity": float(quantity),
            "base_mrp": float(base_mrp),
            "base_selling_price": float(base_selling_price),
            "effective_unit_price": float(effective_price),
            "discount_percentage": float(discount_percentage),
            "applied_price_book": applied_price_book,
            "applied_customer_tier": applied_tier,
            "line_subtotal": float((effective_price * quantity).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))
        }
