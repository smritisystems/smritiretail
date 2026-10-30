"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.82.0
Created      : 2026-10-15
Modified     : 2026-10-15
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Demo Data Provisioning Utility
"""

import asyncio
from decimal import Decimal
from sqlalchemy import select
from app.db.session import async_session, get_company_sessionmaker
from app.models.item_master import Item, ItemVariant, ItemBarcode, ItemBatch
from app.models.inventory import Product
from app.services.item_domain_svc import ItemDomainService

async def seed_demo():
    session_maker = get_company_sessionmaker("smriti001")
    async with session_maker() as session:
        # Check or create Item
        stmt = select(Item).where(Item.company_id == "COMP-001", Item.item_code == "STYLE-DEMO-01")
        item = (await session.execute(stmt)).scalars().first()
        if not item:
            item = Item(
                id="itm_demo_01",
                company_id="COMP-001",
                branch_id="BR-MAIN-001",
                item_code="STYLE-DEMO-01",
                item_name="Executive Silk Cotton Polo",
                category="Apparel",
                brand="SMRITI LUXE",
                primary_uom="PCS",
                uom="PCS",
                is_active=True,
            )
            session.add(item)
            await session.flush()

        # Variant 1: Un-transacted mistake
        stmt_v1 = select(ItemVariant).where(ItemVariant.company_id == "COMP-001", ItemVariant.variant_sku == "MISTAKE-SKU-99")
        v1 = (await session.execute(stmt_v1)).scalars().first()
        if not v1:
            v1 = ItemVariant(
                id="var_mistake_99",
                company_id="COMP-001",
                item_id=item.id,
                variant_sku="MISTAKE-SKU-99",
                variant_name="Executive Silk Cotton Polo (Neon Pink, 8)",
                color="NEON PINK",
                size="8",
                mrp=Decimal("1999.00"),
                selling_price=Decimal("1499.00"),
                cost_price=Decimal("750.00"),
                is_active=True,
            )
            session.add(v1)
            await session.flush()

            bc1 = ItemBarcode(
                id="bc_mistake_99",
                company_id="COMP-001",
                item_id=item.id,
                variant_id=v1.id,
                barcode="8909988776655",
                barcode_normalized="8909988776655",
                is_primary=True,
                status="ASSIGNED",
            )
            session.add(bc1)

            p1 = Product(
                id="prod_mistake_99",
                company_id="COMP-001",
                branch_id="BR-MAIN-001",
                code="MISTAKE-SKU-99",
                sku="MISTAKE-SKU-99",
                name="Executive Silk Cotton Polo (Neon Pink, 8)",
                barcode="8909988776655",
                color="NEON PINK",
                size="8",
                brand="SMRITI LUXE",
                category="Apparel",
                price=Decimal("1499.00"),
                mrp=Decimal("1999.00"),
                cost_price=Decimal("750.00"),
                stock=Decimal("0.00"),
                item_id=item.id,
                item_variant_id=v1.id,
                is_active=True,
                is_deleted=False,
            )
            session.add(p1)

        # Variant 2: Transacted locked variant
        stmt_v2 = select(ItemVariant).where(ItemVariant.company_id == "COMP-001", ItemVariant.variant_sku == "LOCKED-SKU-01")
        v2 = (await session.execute(stmt_v2)).scalars().first()
        if not v2:
            v2 = ItemVariant(
                id="var_locked_01",
                company_id="COMP-001",
                item_id=item.id,
                variant_sku="LOCKED-SKU-01",
                variant_name="Executive Silk Cotton Polo (Royal Blue, XL)",
                color="ROYAL BLUE",
                size="XL",
                mrp=Decimal("1999.00"),
                selling_price=Decimal("1499.00"),
                cost_price=Decimal("750.00"),
                is_active=True,
            )
            session.add(v2)
            await session.flush()

            bc2 = ItemBarcode(
                id="bc_locked_01",
                company_id="COMP-001",
                item_id=item.id,
                variant_id=v2.id,
                barcode="8907766554433",
                barcode_normalized="8907766554433",
                is_primary=True,
                status="ASSIGNED",
            )
            session.add(bc2)

            b2 = ItemBatch(
                id="batch_locked_01",
                company_id="COMP-001",
                item_id=item.id,
                variant_id=v2.id,
                batch_number="BATCH-2026-X1",
                is_active=True,
            )
            session.add(b2)

            p2 = Product(
                id="prod_locked_01",
                company_id="COMP-001",
                branch_id="BR-MAIN-001",
                code="LOCKED-SKU-01",
                sku="LOCKED-SKU-01",
                name="Executive Silk Cotton Polo (Royal Blue, XL)",
                barcode="8907766554433",
                color="ROYAL BLUE",
                size="XL",
                brand="SMRITI LUXE",
                category="Apparel",
                price=Decimal("1499.00"),
                mrp=Decimal("1999.00"),
                cost_price=Decimal("750.00"),
                stock=Decimal("25.00"),
                item_id=item.id,
                item_variant_id=v2.id,
                is_active=True,
                is_deleted=False,
            )
            session.add(p2)

        await session.commit()
        print("SEED COMPLETED SUCCESSFULLY!")

        st1 = await ItemDomainService.check_variant_deletion_status(session, v1.id, "COMP-001")
        st2 = await ItemDomainService.check_variant_deletion_status(session, v2.id, "COMP-001")
        print(f"v1 (MISTAKE-SKU-99): can_hard_delete={st1['can_hard_delete']}, trans={st1['transaction_count']}")
        print(f"v2 (LOCKED-SKU-01): can_hard_delete={st2['can_hard_delete']}, trans={st2['transaction_count']}, reasons={st2['blocking_reasons']}")

if __name__ == "__main__":
    asyncio.run(seed_demo())
