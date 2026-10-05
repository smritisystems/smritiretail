"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.70.2
Created      : 2026-10-05
Modified     : 2026-10-05
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

LegacyProductReconciliationService:
Multi-tenant aware reconciliation engine resolving unmigrated legacy `products`
into canonical `items`, `item_variants`, and `item_barcodes`, backfilling
`products.item_id`, `products.item_variant_id`, and transactional lines
(sales, purchases, stock movements) with zero data loss.
"""

import uuid
import logging
from decimal import Decimal
from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, text, and_, or_

from app.models.inventory import Product, StockMovement
from app.models.item_master import Item, ItemVariant, ItemBarcode
from app.models.sales import SalesInvoiceItem
from app.models.purchase import PurchaseReceiptItem

logger = logging.getLogger("smriti.catalog.reconciliation")


class LegacyProductReconciliationService:
    """
    Transactional reconciliation engine executing strangler-fig migration
    from legacy `products` into canonical Item Master entities.
    """

    @classmethod
    async def reconcile_single_product(
        cls,
        session: AsyncSession,
        product: Product,
        auto_commit: bool = False,
    ) -> Dict[str, Any]:
        """
        Idempotently reconciles a single legacy Product record into canonical
        Item, ItemVariant, and ItemBarcode records, populating product.item_id
        and product.item_variant_id.
        """
        company_id = product.company_id or "COMP-001"
        branch_id = product.branch_id or "BR-MAIN"
        if not product.company_id:
            product.company_id = company_id

        # -------------------------------------------------------------
        # 1. Resolve or Create Canonical Item (Style / Parent entity)
        # -------------------------------------------------------------
        item: Optional[Item] = None
        if product.item_id:
            stmt = select(Item).where(Item.id == product.item_id)
            item = (await session.execute(stmt)).scalars().first()

        if not item:
            # Candidate match identifiers: style_code, code, sku
            candidates = []
            if product.style_code and product.style_code.strip():
                candidates.append(product.style_code.strip())
            if product.code and product.code.strip():
                candidates.append(product.code.strip())
            if product.sku and product.sku.strip():
                candidates.append(product.sku.strip())

            for c in candidates:
                match_stmt = select(Item).where(
                    Item.company_id == company_id,
                    or_(Item.item_code == c, Item.style_code == c),
                    Item.is_deleted == False,
                )
                item = (await session.execute(match_stmt)).scalars().first()
                if item:
                    break

        if not item:
            # Create a new canonical Item
            base_code = (product.style_code or product.code or product.sku or f"ITM-{product.id[:8]}").strip()
            # Verify code uniqueness within tenant
            code_chk = await session.execute(
                select(Item.id).where(Item.company_id == company_id, Item.item_code == base_code)
            )
            final_item_code = base_code
            if code_chk.scalar():
                final_item_code = f"{base_code}-{uuid.uuid4().hex[:4].upper()}"

            is_batch = bool(getattr(product, "is_batch_tracked", False) or (getattr(product, "tracking_mode", "") or "").upper() == "BATCH")
            is_serial = bool(getattr(product, "is_serial_tracked", False) or (getattr(product, "tracking_mode", "") or "").upper() == "SERIAL")
            # CHECK constraint chk_items_no_dual_tracking enforcement
            if is_batch and is_serial:
                is_serial = False

            tracking_mode = "BATCH" if is_batch else ("SERIAL" if is_serial else "NONE")
            category_str = (product.category or "GENERAL").strip()
            primary_uom = "PRS" if "FOOTWEAR" in category_str.upper() else "PCS"

            item = Item(
                id=f"itm_{uuid.uuid4().hex[:12]}",
                uuid=str(uuid.uuid4()),
                company_id=company_id,
                branch_id=branch_id,
                item_code=final_item_code,
                style_code=product.style_code,
                item_name=product.name or f"Legacy Item {final_item_code}",
                item_type="FINISHED_GOOD",
                category=category_str,
                brand=product.brand,
                hsn_code=product.hsn_code or "0000",
                tax_rate=Decimal(str(product.gst_percentage or 18.00)),
                primary_uom=primary_uom,
                uom=primary_uom,
                tracking_type=tracking_mode,
                tracking_mode=tracking_mode,
                is_batch_tracked=is_batch,
                is_serial_tracked=is_serial,
                mrp=Decimal(str(product.mrp or product.price or 0.00)),
                selling_price=Decimal(str(product.price or product.mrp or 0.00)),
                cost_price=Decimal(str(product.cost_price or 0.00)),
                status="ACTIVE",
                is_active=True,
                is_deleted=False,
            )
            session.add(item)
            await session.flush()

        # -------------------------------------------------------------
        # 2. Resolve or Create Canonical ItemVariant
        # -------------------------------------------------------------
        variant: Optional[ItemVariant] = None
        if product.item_variant_id:
            var_stmt = select(ItemVariant).where(ItemVariant.id == product.item_variant_id)
            variant = (await session.execute(var_stmt)).scalars().first()

        if not variant:
            var_candidates = []
            if product.sku and product.sku.strip():
                var_candidates.append(product.sku.strip())
            if product.code and product.code.strip():
                var_candidates.append(product.code.strip())
            var_candidates.append(f"{item.item_code}-STD")

            for vc in var_candidates:
                v_match_stmt = select(ItemVariant).where(
                    ItemVariant.company_id == company_id,
                    ItemVariant.variant_sku == vc,
                    ItemVariant.is_deleted == False,
                )
                variant = (await session.execute(v_match_stmt)).scalars().first()
                if variant:
                    break

        if not variant:
            base_sku = (product.sku or product.code or f"{item.item_code}-STD").strip()
            # Enforce (company_id, variant_sku) uniqueness
            sku_chk = await session.execute(
                select(ItemVariant.id).where(ItemVariant.company_id == company_id, ItemVariant.variant_sku == base_sku)
            )
            final_sku = base_sku
            if sku_chk.scalar():
                final_sku = f"{base_sku}-{uuid.uuid4().hex[:4].upper()}"

            variant = ItemVariant(
                id=f"var_{uuid.uuid4().hex[:12]}",
                uuid=str(uuid.uuid4()),
                company_id=company_id,
                branch_id=branch_id,
                item_id=item.id,
                variant_sku=final_sku,
                variant_name=product.name or f"{item.item_name} (Standard)",
                color=product.color,
                size=product.size,
                mrp=Decimal(str(product.mrp or product.price or 0.00)),
                selling_price=Decimal(str(product.price or product.mrp or 0.00)),
                cost_price=Decimal(str(product.cost_price or 0.00)),
                is_active=bool(product.is_active) if product.is_active is not None else True,
                is_deleted=False,
            )
            session.add(variant)
            await session.flush()

        # -------------------------------------------------------------
        # 3. Resolve or Create Canonical ItemBarcode
        # -------------------------------------------------------------
        barcode_val = (product.barcode or "").strip()
        if barcode_val:
            bc_stmt = select(ItemBarcode).where(
                ItemBarcode.company_id == company_id,
                ItemBarcode.barcode == barcode_val,
                ItemBarcode.is_deleted == False,
            )
            existing_bc = (await session.execute(bc_stmt)).scalars().first()

            if not existing_bc:
                bc = ItemBarcode(
                    id=f"bc_{uuid.uuid4().hex[:12]}",
                    uuid=str(uuid.uuid4()),
                    company_id=company_id,
                    branch_id=branch_id,
                    item_id=item.id,
                    variant_id=variant.id,
                    barcode=barcode_val,
                    barcode_type="EAN13" if len(barcode_val) == 13 and barcode_val.isdigit() else "CUSTOM",
                    is_primary=True,
                    is_active=True,
                    is_deleted=False,
                )
                session.add(bc)
                await session.flush()

        # -------------------------------------------------------------
        # 4. Link Product to Canonical Entities
        # -------------------------------------------------------------
        product.item_id = item.id
        product.item_variant_id = variant.id
        await session.flush()

        if auto_commit:
            await session.commit()

        return {
            "product_id": product.id,
            "item_id": item.id,
            "item_variant_id": variant.id,
            "item_code": item.item_code,
            "variant_sku": variant.variant_sku,
            "barcode": barcode_val,
            "company_id": company_id,
        }

    @classmethod
    async def reconcile_all_unlinked_products(
        cls,
        session: AsyncSession,
        limit: Optional[int] = None,
        batch_size: int = 100,
        auto_commit: bool = True,
    ) -> Dict[str, Any]:
        """
        Batch-reconciles all unlinked active products, committing per batch
        and backfilling transactional tables.
        """
        query = select(Product).where(
            Product.item_id.is_(None),
            Product.is_deleted.isnot(True),
            Product.is_active.isnot(False),
        ).order_by(Product.id)

        if limit:
            query = query.limit(limit)

        products = (await session.execute(query)).scalars().all()
        total_found = len(products)
        reconciled_count = 0

        for i in range(0, total_found, batch_size):
            batch = products[i : i + batch_size]
            for p in batch:
                await cls.reconcile_single_product(session, p, auto_commit=False)
                reconciled_count += 1
            if auto_commit:
                await session.commit()
            logger.info("Reconciled %d / %d products", reconciled_count, total_found)

        # Backfill transactional tables
        tx_stats = await cls.backfill_transaction_lines(session, auto_commit=auto_commit)

        return {
            "total_found": total_found,
            "reconciled_products": reconciled_count,
            "transactions_backfilled": tx_stats,
        }

    @classmethod
    async def backfill_transaction_lines(
        cls,
        session: AsyncSession,
        auto_commit: bool = True,
    ) -> Dict[str, int]:
        """
        Backfills canonical item_id and item_variant_id across sales, purchase,
        and stock movements where rows were linked to legacy product_id.
        """
        # 1. Sales Invoice Items
        sii_res = await session.execute(text("""
            UPDATE sales_invoice_items sii
            SET item_id = p.item_id,
                variant_id = p.item_variant_id
            FROM products p
            WHERE sii.product_id = p.id
              AND (sii.item_id IS NULL OR sii.variant_id IS NULL)
              AND p.item_id IS NOT NULL;
        """))
        sii_count = sii_res.rowcount

        # 2. Stock Movements
        sm_res = await session.execute(text("""
            UPDATE stock_movements sm
            SET item_id = p.item_id,
                variant_id = p.item_variant_id
            FROM products p
            WHERE sm.product_id = p.id
              AND (sm.item_id IS NULL OR sm.variant_id IS NULL)
              AND p.item_id IS NOT NULL;
        """))
        sm_count = sm_res.rowcount

        # 3. Purchase Receipt Items
        pri_res = await session.execute(text("""
            UPDATE purchase_receipt_items pri
            SET item_id = p.item_id,
                variant_id = p.item_variant_id
            FROM products p
            WHERE pri.product_id = p.id
              AND (pri.item_id IS NULL OR pri.variant_id IS NULL)
              AND p.item_id IS NOT NULL;
        """))
        pri_count = pri_res.rowcount

        if auto_commit:
            await session.commit()

        return {
            "sales_invoice_items": sii_count,
            "stock_movements": sm_count,
            "purchase_receipt_items": pri_count,
        }
