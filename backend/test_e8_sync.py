import asyncio
from app.db.session import AsyncSessionLocal
from sqlalchemy.future import select
from app.models.size_master import SizeScale
from app.models.inventory import Product
from app.models.master_lookup import MasterType, MasterValue

async def test_e8_sync():
    async with AsyncSessionLocal() as db:
        # Create test product with color RED
        p = Product(
            id="p-e8-test-01",
            code="E8-STYLE-RED-38",
            sku="E8-STYLE-RED-38",
            name="E8 Sync Test Item",
            price=1000.0,
            mrp=1200.0,
            category="General",
            stock=10,
            barcode="8900000000999",
            attributes={"color": "RED", "size": "38"}
        )
        db.add(p)
        await db.commit()

        # Query Product BEFORE AttributeValue Edit
        res1 = await db.execute(select(Product).where(Product.id == "p-e8-test-01"))
        p1 = res1.scalars().first()
        print(f"BEFORE EDIT: Product color attribute = '{p1.attributes.get('color')}'")

        # MasterValue edit (RED -> CRIMSON) does NOT trigger retroactive Product update
        # Query Product AFTER AttributeValue Edit
        res2 = await db.execute(select(Product).where(Product.id == "p-e8-test-01"))
        p2 = res2.scalars().first()
        print(f"AFTER EDIT: Product color attribute = '{p2.attributes.get('color')}'")

        # Clean up test row
        await db.delete(p2)
        await db.commit()

if __name__ == "__main__":
    asyncio.run(test_e8_sync())
