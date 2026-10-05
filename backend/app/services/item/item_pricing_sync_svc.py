"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.70.4
Created      : 2026-10-05
Modified     : 2026-10-05
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

ItemPricingSyncService
──────────────────────
Multi-tenant catalog pricing reconciliation and synchronization engine:
1. Harmonizes parent items and variants commercial selling prices and MRPs.
2. Synchronizes canonical PriceBookEntry records under default retail price books.
3. Populates authoritative variant sales settings (ItemSalesSetting).
"""

import uuid
import logging
from decimal import Decimal
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, text, func, and_

from app.models.item_master import Item, ItemVariant, ItemSalesSetting
from app.models.pricing import PriceBook, PriceBookEntry

logger = logging.getLogger(__name__)


class ItemPricingSyncService:
    """
    Domain service for catalog pricing discrepancy resolution,
    default price book synchronization, and sales settings enforcement.
    """

    @classmethod
    async def harmonize_catalog_prices(
        cls,
        session: AsyncSession,
        company_id: Optional[str] = None,
        auto_commit: bool = False,
    ) -> Dict[str, int]:
        """
        Bidirectionally reconciles commercial prices between items and variants:
        - Variants with 0/NULL prices inherit parent item prices.
        - Items with 0/NULL prices inherit minimum active variant prices.
        """
        comp_filter_var = "AND iv.company_id = :comp_id" if company_id else ""
        comp_filter_item = "AND i.company_id = :comp_id" if company_id else ""
        params = {"comp_id": company_id} if company_id else {}

        # 1. Variants inheriting from parent item
        var_inherit_sql = f"""
            UPDATE item_variants iv
            SET selling_price = i.selling_price,
                mrp = COALESCE(NULLIF(i.mrp, 0), i.selling_price),
                modified_at = NOW()
            FROM items i
            WHERE iv.item_id = i.id
              AND (iv.selling_price IS NULL OR iv.selling_price = 0)
              AND (i.selling_price IS NOT NULL AND i.selling_price > 0)
              {comp_filter_var};
        """
        var_res = await session.execute(text(var_inherit_sql), params)
        var_inherited_count = var_res.rowcount

        # 2. Parent items inheriting from representative variant (minimum selling price > 0)
        item_inherit_sql = f"""
            WITH var_prices AS (
                SELECT 
                    item_id,
                    MIN(selling_price) AS min_sp,
                    MIN(mrp) AS min_mrp
                FROM item_variants
                WHERE selling_price IS NOT NULL AND selling_price > 0
                GROUP BY item_id
            )
            UPDATE items i
            SET selling_price = vp.min_sp,
                mrp = COALESCE(NULLIF(vp.min_mrp, 0), vp.min_sp),
                modified_at = NOW()
            FROM var_prices vp
            WHERE i.id = vp.item_id
              AND (i.selling_price IS NULL OR i.selling_price = 0)
              {comp_filter_item};
        """
        item_res = await session.execute(text(item_inherit_sql), params)
        item_inherited_count = item_res.rowcount

        if auto_commit:
            await session.commit()

        logger.info(
            "Harmonized prices: variants_inherited=%d, items_inherited=%d",
            var_inherited_count, item_inherited_count
        )
        return {
            "variants_inherited_from_item": var_inherited_count,
            "items_inherited_from_variant": item_inherited_count,
            "total_harmonized": var_inherited_count + item_inherited_count,
        }

    @classmethod
    async def sync_default_price_book_entries(
        cls,
        session: AsyncSession,
        company_id: Optional[str] = None,
        auto_commit: bool = False,
    ) -> Dict[str, Any]:
        """
        Ensures all active variants belong to a default price book with valid
        price_book_entries (selling_price, mrp, cost_price, min_quantity = 1).
        """
        # Determine companies to process
        if company_id:
            companies = [company_id]
        else:
            comp_stmt = select(Item.company_id).distinct().where(Item.company_id.isnot(None))
            companies = (await session.execute(comp_stmt)).scalars().all()

        total_created = 0
        total_updated = 0
        price_books_ensured = 0

        for comp_id in companies:
            if not comp_id:
                continue

            # 1. Resolve or create default price book
            pb_stmt = select(PriceBook).where(
                PriceBook.company_id == comp_id,
                PriceBook.is_default == True,
                PriceBook.is_deleted == False,
            )
            price_book = (await session.execute(pb_stmt)).scalars().first()

            if not price_book:
                price_book = PriceBook(
                    id=f"pb_{uuid.uuid4().hex[:12]}",
                    uuid=str(uuid.uuid4()),
                    company_id=comp_id,
                    branch_id=None,
                    name=f"Standard Retail Price List ({comp_id})",
                    code=f"DEFAULT-{comp_id}",
                    currency="INR",
                    is_default=True,
                    status="ACTIVE",
                    is_active=True,
                    is_deleted=False,
                )
                session.add(price_book)
                await session.flush()
                price_books_ensured += 1

            # 2. Find all active variants for this company
            var_stmt = (
                select(ItemVariant, Item)
                .join(Item, ItemVariant.item_id == Item.id)
                .where(
                    ItemVariant.company_id == comp_id,
                    ItemVariant.is_active == True,
                    ItemVariant.is_deleted == False,
                )
            )
            variants_with_items = (await session.execute(var_stmt)).all()

            # 3. Find existing entries in this price book (min_quantity = 1)
            pbe_stmt = select(PriceBookEntry).where(
                PriceBookEntry.price_book_id == price_book.id,
                PriceBookEntry.min_quantity == Decimal("1.0000"),
                PriceBookEntry.is_deleted == False,
            )
            existing_pbes = (await session.execute(pbe_stmt)).scalars().all()
            existing_pbe_map = {pbe.variant_id: pbe for pbe in existing_pbes if pbe.variant_id}

            now_utc = datetime.now(timezone.utc)

            # 4. Upsert price book entries
            for var, item in variants_with_items:
                # Calculate authoritative prices
                var_sp = var.selling_price if (var.selling_price is not None and var.selling_price > 0) else (item.selling_price or Decimal("0.00"))
                var_mrp = var.mrp if (var.mrp is not None and var.mrp > 0) else (item.mrp or var_sp)
                var_cost = var.cost_price if (var.cost_price is not None and var.cost_price > 0) else item.cost_price

                pbe = existing_pbe_map.get(var.id)
                if pbe:
                    # Update if prices diverged
                    if pbe.selling_price != var_sp or pbe.mrp != var_mrp:
                        pbe.selling_price = var_sp
                        pbe.mrp = var_mrp
                        pbe.cost_price = var_cost
                        pbe.modified_at = now_utc
                        total_updated += 1
                else:
                    # Insert new PriceBookEntry
                    new_pbe = PriceBookEntry(
                        id=f"pbe_{uuid.uuid4().hex[:12]}",
                        uuid=str(uuid.uuid4()),
                        company_id=comp_id,
                        branch_id=var.branch_id,
                        price_book_id=price_book.id,
                        item_id=var.item_id,
                        variant_id=var.id,
                        min_quantity=Decimal("1.0000"),
                        selling_price=var_sp,
                        mrp=var_mrp,
                        cost_price=var_cost,
                        is_active=True,
                        is_deleted=False,
                    )
                    session.add(new_pbe)
                    total_created += 1

            # 5. Ensure active items without variants receive item-level PriceBookEntry
            item_stmt = (
                select(Item)
                .where(
                    Item.company_id == comp_id,
                    Item.is_active == True,
                    Item.is_deleted == False,
                )
            )
            comp_items = (await session.execute(item_stmt)).scalars().all()
            for itm in comp_items:
                has_entry = (await session.execute(
                    select(func.count()).select_from(PriceBookEntry).where(
                        PriceBookEntry.price_book_id == price_book.id,
                        PriceBookEntry.item_id == itm.id,
                        PriceBookEntry.is_deleted == False,
                    )
                )).scalar() > 0
                if not has_entry:
                    itm_sp = itm.selling_price if (itm.selling_price is not None and itm.selling_price > 0) else Decimal("0.00")
                    itm_mrp = itm.mrp if (itm.mrp is not None and itm.mrp > 0) else itm_sp
                    itm_cost = itm.cost_price if (itm.cost_price is not None and itm.cost_price > 0) else Decimal("0.00")
                    item_pbe = PriceBookEntry(
                        id=f"pbe_{uuid.uuid4().hex[:12]}",
                        uuid=str(uuid.uuid4()),
                        company_id=comp_id,
                        branch_id=itm.branch_id,
                        price_book_id=price_book.id,
                        item_id=itm.id,
                        variant_id=None,
                        min_quantity=Decimal("1.0000"),
                        selling_price=itm_sp,
                        mrp=itm_mrp,
                        cost_price=itm_cost,
                        is_active=True,
                        is_deleted=False,
                    )
                    session.add(item_pbe)
                    total_created += 1

        if auto_commit:
            await session.commit()

        logger.info(
            "PriceBookEntry sync: created=%d, updated=%d, price_books_ensured=%d",
            total_created, total_updated, price_books_ensured
        )
        return {
            "price_books_ensured": price_books_ensured,
            "entries_created": total_created,
            "entries_updated": total_updated,
            "total_synced": total_created + total_updated,
        }

    @classmethod
    async def sync_item_sales_settings(
        cls,
        session: AsyncSession,
        company_id: Optional[str] = None,
        auto_commit: bool = False,
    ) -> Dict[str, int]:
        """
        Synchronizes authoritative variant sales configurations into item_sales_settings.
        """
        # Load variants with items
        query = (
            select(ItemVariant, Item)
            .join(Item, ItemVariant.item_id == Item.id)
            .where(
                ItemVariant.is_active == True,
                ItemVariant.is_deleted == False,
            )
        )
        if company_id:
            query = query.where(ItemVariant.company_id == company_id)

        variants = (await session.execute(query)).all()

        # Load existing sales settings
        ss_query = select(ItemSalesSetting)
        if company_id:
            ss_query = ss_query.where(ItemSalesSetting.company_id == company_id)
        existing_ss = (await session.execute(ss_query)).scalars().all()
        existing_ss_map = {ss.item_variant_id: ss for ss in existing_ss}

        created = 0
        updated_count = 0
        now_utc = datetime.now(timezone.utc)

        for var, item in variants:
            sp = var.selling_price if (var.selling_price is not None and var.selling_price > 0) else (item.selling_price or Decimal("0.00"))
            mrp = var.mrp if (var.mrp is not None and var.mrp > 0) else (item.mrp or sp)

            ss = existing_ss_map.get(var.id)
            if ss:
                if ss.selling_price != sp or ss.mrp != mrp:
                    ss.selling_price = sp
                    ss.mrp = mrp
                    ss.wholesale_price = sp
                    ss.modified_at = now_utc
                    updated_count += 1
            else:
                new_ss = ItemSalesSetting(
                    item_variant_id=var.id,
                    company_id=var.company_id or item.company_id,
                    branch_id=var.branch_id or item.branch_id,
                    sales_uom_id=None,
                    selling_price=sp,
                    mrp=mrp,
                    wholesale_price=sp,
                    minimum_selling_price=Decimal("0.00"),
                    maximum_discount_percent=Decimal("0.00"),
                    allow_discount=True,
                    billable=True,
                )
                session.add(new_ss)
                created += 1

        if auto_commit:
            await session.commit()

        logger.info("ItemSalesSettings sync: created=%d, updated=%d", created, updated_count)
        return {
            "sales_settings_created": created,
            "sales_settings_updated": updated_count,
            "total_sales_settings_processed": created + updated_count,
        }

    @classmethod
    async def run_full_pricing_synchronization(
        cls,
        session: AsyncSession,
        company_id: Optional[str] = None,
        auto_commit: bool = True,
    ) -> Dict[str, Any]:
        """
        Coordinates full pipeline:
        1. Harmonize catalog prices (items vs variants)
        2. Sync default price book entries
        3. Sync item sales settings
        """
        harmonize_res = await cls.harmonize_catalog_prices(session, company_id=company_id, auto_commit=False)
        pbe_res = await cls.sync_default_price_book_entries(session, company_id=company_id, auto_commit=False)
        ss_res = await cls.sync_item_sales_settings(session, company_id=company_id, auto_commit=False)

        if auto_commit:
            await session.commit()

        return {
            "harmonize": harmonize_res,
            "price_book_entries": pbe_res,
            "sales_settings": ss_res,
        }
