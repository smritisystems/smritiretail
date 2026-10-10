"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.70.5
Created      : 2026-10-05
Modified     : 2026-10-05
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

ItemAttributeSyncService
────────────────────────
Multi-tenant catalog attribute consolidation and variant SSOT engine:
1. Backfills missing variant color and size attributes from parent items.
2. Parses structured SKU and variant tokens to populate missing variant attributes.
3. Deprecates and clears style-level color/size on items, eliminating conflicts.
"""

import re
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, text

from app.models.item_master import Item, ItemVariant

logger = logging.getLogger(__name__)

# Standard Footwear / Apparel sizes
KNOWN_NUMERIC_SIZES = {str(i) for i in range(20, 55)}
KNOWN_ALPHA_SIZES = {"XXS", "XS", "S", "M", "L", "XL", "XXL", "2XL", "3XL", "FREE", "FS"}
KNOWN_SIZES = KNOWN_NUMERIC_SIZES | KNOWN_ALPHA_SIZES

# Standard Colors
KNOWN_COLORS = {
    "BLACK", "BLK", "WHITE", "WHT", "CREAM", "CRM", "BRONZE", "BRZ", "BLUE", "BLU",
    "NAVY", "RED", "GREEN", "GRN", "GREY", "GRAY", "YELLOW", "YLW", "PINK", "BROWN",
    "BRN", "BEIGE", "BGE", "TAN", "GOLD", "SILVER", "SLV", "ORANGE", "PURPLE", "MAROON"
}

COLOR_EXPANSION = {
    "BLK": "BLACK",
    "WHT": "WHITE",
    "CRM": "CREAM",
    "BRZ": "BRONZE",
    "BLU": "BLUE",
    "GRN": "GREEN",
    "YLW": "YELLOW",
    "BRN": "BROWN",
    "BGE": "BEIGE",
    "SLV": "SILVER",
}


class ItemAttributeSyncService:
    """
    Domain service for variant-level attribute deduplication,
    SKU attribute parsing, and style-level attribute retirement.
    """

    @classmethod
    async def backfill_missing_variant_attributes(
        cls,
        session: AsyncSession,
        company_id: Optional[str] = None,
        auto_commit: bool = False,
    ) -> Dict[str, int]:
        """
        Propagates style-level color and size from items to item_variants
        where variant attributes are missing or empty.
        """
        comp_filter = "AND iv.company_id = :comp_id" if company_id else ""
        params = {"comp_id": company_id} if company_id else {}

        # 1. Color backfill
        color_sql = f"""
            UPDATE item_variants iv
            SET color = TRIM(i.color),
                modified_at = NOW()
            FROM items i
            WHERE iv.item_id = i.id
              AND (iv.color IS NULL OR TRIM(iv.color) = '')
              AND (i.color IS NOT NULL AND TRIM(i.color) != '')
              {comp_filter};
        """
        color_res = await session.execute(text(color_sql), params)
        color_count = color_res.rowcount

        # 2. Size backfill
        size_sql = f"""
            UPDATE item_variants iv
            SET size = TRIM(i.size),
                modified_at = NOW()
            FROM items i
            WHERE iv.item_id = i.id
              AND (iv.size IS NULL OR TRIM(iv.size) = '')
              AND (i.size IS NOT NULL AND TRIM(i.size) != '')
              {comp_filter};
        """
        size_res = await session.execute(text(size_sql), params)
        size_count = size_res.rowcount

        if auto_commit:
            await session.commit()

        logger.info(
            "Backfilled variant attributes from item: color=%d, size=%d",
            color_count, size_count
        )
        return {
            "variant_color_inherited": color_count,
            "variant_size_inherited": size_count,
            "total_inherited": color_count + size_count,
        }

    @classmethod
    async def parse_structured_sku_attributes(
        cls,
        session: AsyncSession,
        company_id: Optional[str] = None,
        auto_commit: bool = False,
    ) -> Dict[str, int]:
        """
        Inspects variant_sku and variant_name for variants still missing
        color or size, parsing recognized color and size tokens.
        """
        query = (
            select(ItemVariant)
            .where(
                ItemVariant.is_active == True,
                ItemVariant.is_deleted == False,
            )
        )
        if company_id:
            query = query.where(ItemVariant.company_id == company_id)

        variants = (await session.execute(query)).scalars().all()

        color_parsed_count = 0
        size_parsed_count = 0
        now_utc = datetime.now(timezone.utc)

        for var in variants:
            needs_color = not var.color or not var.color.strip()
            needs_size = not var.size or not var.size.strip()

            if not needs_color and not needs_size:
                continue

            text_sources = [var.variant_sku or "", var.variant_name or ""]
            extracted_color = None
            extracted_size = None

            for src in text_sources:
                tokens = re.split(r"[-_\s/]+", src.strip().upper())
                for token in tokens:
                    if not token:
                        continue
                    # Check size match
                    if needs_size and not extracted_size and token in KNOWN_SIZES:
                        extracted_size = token
                    # Check color match
                    if needs_color and not extracted_color and token in KNOWN_COLORS:
                        extracted_color = COLOR_EXPANSION.get(token, token)

            # Apply parsed attributes
            modified = False
            if needs_color and extracted_color:
                var.color = extracted_color
                color_parsed_count += 1
                modified = True
            if needs_size and extracted_size:
                var.size = extracted_size
                size_parsed_count += 1
                modified = True

            if modified:
                var.modified_at = now_utc

        if auto_commit:
            await session.commit()

        logger.info(
            "Parsed structured SKU attributes: color=%d, size=%d",
            color_parsed_count, size_parsed_count
        )
        return {
            "variant_color_parsed": color_parsed_count,
            "variant_size_parsed": size_parsed_count,
            "total_parsed": color_parsed_count + size_parsed_count,
        }

    @classmethod
    async def retire_style_level_attributes(
        cls,
        session: AsyncSession,
        company_id: Optional[str] = None,
        auto_commit: bool = False,
    ) -> Dict[str, int]:
        """
        Clears style-level color and size on items to NULL.
        Establishes item_variants as the sole canonical SSOT for variations.
        """
        comp_filter = "AND company_id = :comp_id" if company_id else ""
        params = {"comp_id": company_id} if company_id else {}

        sql = f"""
            UPDATE items
            SET color = NULL,
                size = NULL,
                modified_at = NOW()
            WHERE (color IS NOT NULL OR size IS NOT NULL)
              {comp_filter};
        """
        res = await session.execute(text(sql), params)
        retired_count = res.rowcount

        if auto_commit:
            await session.commit()

        logger.info("Retired style-level attributes on %d items", retired_count)
        return {
            "style_attributes_retired": retired_count,
        }

    @classmethod
    async def run_full_attribute_synchronization(
        cls,
        session: AsyncSession,
        company_id: Optional[str] = None,
        auto_commit: bool = True,
    ) -> Dict[str, Any]:
        """
        Coordinates full attribute deduplication pipeline:
        1. Backfill missing variant attributes from item styles
        2. Parse structured SKU attributes for remaining blanks
        3. Retire style-level attributes on items
        """
        inherit_res = await cls.backfill_missing_variant_attributes(session, company_id=company_id, auto_commit=False)
        parse_res = await cls.parse_structured_sku_attributes(session, company_id=company_id, auto_commit=False)
        retire_res = await cls.retire_style_level_attributes(session, company_id=company_id, auto_commit=False)

        if auto_commit:
            await session.commit()

        return {
            "inherited": inherit_res,
            "parsed": parse_res,
            "retired": retire_res,
        }
