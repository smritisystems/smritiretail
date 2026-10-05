"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.70.3
Created      : 2026-10-05
Modified     : 2026-10-05
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import logging
from decimal import Decimal
from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, text

from app.models.item_master import Item, ItemVariant, ItemBarcode

logger = logging.getLogger(__name__)


class ItemReviewTriageService:
    """
    Domain service for multi-tenant catalog integrity and review triage:
    1. Backfills company_id on child records (variants, barcodes, batches, serials, locations)
       directly from parent items.
    2. Triages items in REQUIRES_REVIEW status: auto-resolves missing statutory attributes (UOM),
       activates legitimate items, and preserves strict security quarantine boundaries.
    """

    @classmethod
    async def backfill_child_company_ids(
        cls,
        session: AsyncSession,
        auto_commit: bool = True,
    ) -> Dict[str, int]:
        """
        Synchronizes company_id across all 5 catalog child tables from parent items.
        """
        # 1. item_variants
        var_res = await session.execute(text("""
            UPDATE item_variants iv
            SET company_id = i.company_id
            FROM items i
            WHERE iv.item_id = i.id
              AND iv.company_id IS NULL
              AND i.company_id IS NOT NULL;
        """))
        var_count = var_res.rowcount

        # 2. item_barcodes
        bc_res = await session.execute(text("""
            UPDATE item_barcodes ib
            SET company_id = i.company_id
            FROM items i
            WHERE ib.item_id = i.id
              AND ib.company_id IS NULL
              AND i.company_id IS NOT NULL;
        """))
        bc_count = bc_res.rowcount

        # 3. item_batches
        batch_res = await session.execute(text("""
            UPDATE item_batches ibt
            SET company_id = i.company_id
            FROM items i
            WHERE ibt.item_id = i.id
              AND ibt.company_id IS NULL
              AND i.company_id IS NOT NULL;
        """))
        batch_count = batch_res.rowcount

        # 4. item_serials
        serial_res = await session.execute(text("""
            UPDATE item_serials isr
            SET company_id = i.company_id
            FROM items i
            WHERE isr.item_id = i.id
              AND isr.company_id IS NULL
              AND i.company_id IS NOT NULL;
        """))
        serial_count = serial_res.rowcount

        # 5. item_warehouse_locations
        loc_res = await session.execute(text("""
            UPDATE item_warehouse_locations iwl
            SET company_id = i.company_id
            FROM items i
            WHERE iwl.item_id = i.id
              AND iwl.company_id IS NULL
              AND iwl.company_id IS NOT NULL;
        """))
        loc_count = loc_res.rowcount

        if auto_commit:
            await session.commit()

        logger.info(
            "Backfilled company_id: variants=%d, barcodes=%d, batches=%d, serials=%d, locations=%d",
            var_count, bc_count, batch_count, serial_count, loc_count
        )

        return {
            "item_variants": var_count,
            "item_barcodes": bc_count,
            "item_batches": batch_count,
            "item_serials": serial_count,
            "item_warehouse_locations": loc_count,
            "total_backfilled": var_count + bc_count + batch_count + serial_count + loc_count,
        }

    @classmethod
    async def triage_requires_review_items(
        cls,
        session: AsyncSession,
        auto_commit: bool = True,
    ) -> Dict[str, Any]:
        """
        Audits and resolves items currently in REQUIRES_REVIEW status.
        - Preserves QUAR-* items as REQUIRES_REVIEW (quarantine test boundary).
        - Populates missing statutory UOM (PRS for footwear, PCS for others) for ITM-UNASSIGNED-*
          and unblocks them to ACTIVE.
        """
        stmt = select(Item).where(Item.status == "REQUIRES_REVIEW")
        items = (await session.execute(stmt)).scalars().all()

        total = len(items)
        quarantined_count = 0
        activated_count = 0
        resolved_details = []

        for item in items:
            code = (item.item_code or "").strip().upper()
            if code.startswith("QUAR-"):
                # Preserve quarantine boundary
                quarantined_count += 1
                continue

            # Resolve missing statutory attributes
            cat = (item.category or "").strip().upper()
            if not item.primary_uom:
                if "FOOTWEAR" in cat or "SHOE" in cat or "CH-" in code:
                    item.primary_uom = "PRS"
                    item.uom = "PRS"
                else:
                    item.primary_uom = "PCS"
                    item.uom = "PCS"

            if not item.uom:
                item.uom = item.primary_uom

            if item.tax_rate is None:
                item.tax_rate = Decimal("18.00") if "FOOTWEAR" in cat else Decimal("5.00")

            # Transition to ACTIVE
            item.status = "ACTIVE"
            item.is_active = True
            activated_count += 1

            # Ensure linked variants are active
            await session.execute(
                update(ItemVariant)
                .where(ItemVariant.item_id == item.id)
                .values(is_active=True, is_deleted=False)
            )

            resolved_details.append({
                "item_id": item.id,
                "item_code": item.item_code,
                "category": item.category,
                "primary_uom": item.primary_uom,
                "new_status": item.status,
            })

        if auto_commit:
            await session.commit()

        logger.info(
            "Triage complete: total=%d, activated=%d, preserved_quarantine=%d",
            total, activated_count, quarantined_count
        )

        return {
            "total_evaluated": total,
            "activated": activated_count,
            "preserved_quarantine": quarantined_count,
            "resolved_items": resolved_details,
        }
