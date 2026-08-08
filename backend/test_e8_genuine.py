import asyncio
from app.db.session import AsyncSessionLocal
from sqlalchemy.future import select
from app.models.size_master import SizeScale
from app.models.inventory import Product
from app.models.master_lookup import MasterType, MasterValue
from app.services.master_lookup import LookupService
from app.schemas.master_lookup import MasterValueCreate, MasterValueUpdate

async def genuine_e8_test():
    async with AsyncSessionLocal() as db:
        service = LookupService(db)
        
        # 1. Get or create MasterType 'product_color'
        mtype_res = await db.execute(select(MasterType).where(MasterType.code == "product_color"))
        mtype = mtype_res.scalars().first()
        if not mtype:
            mtype = MasterType(
                id="mt-test-color",
                code="product_color",
                name="Product Color",
                is_system=False
            )
            db.add(mtype)
            await db.commit()

        # 2. Create real MasterValue: RED
        val_code = f"TEST_RED_{int(asyncio.get_event_loop().time())}"
        mv_create = MasterValueCreate(
            code=val_code,
            name="RED"
        )
        mv_obj = await service.create_value("product_color", mv_create)
        val_id = str(mv_obj.id)
        await db.commit()
        print(f"STEP 1: Created MasterValue ID={val_id}, code='{val_code}', name='{mv_obj.name}'")

        # 3. Create Product referencing RED
        p_id = f"p-e8-genuine-{int(asyncio.get_event_loop().time())}"
        prod = Product(
            id=p_id,
            code=f"SKU-{val_code}-M",
            sku=f"SKU-{val_code}-M",
            name="Genuine E8 Test Product",
            category="General",
            color="RED",
            size="M",
            price=1000.0,
            mrp=1200.0,
            stock=10,
            barcode=f"890{int(asyncio.get_event_loop().time()) % 1000000000:09d}",
            attributes={"color": "RED", "color_code": val_code, "size": "M"}
        )
        db.add(prod)
        await db.commit()

        # 4. Record BEFORE state from DB
        res_before = await db.execute(select(Product).where(Product.id == p_id))
        p_before = res_before.scalars().first()
        print(f"BEFORE EDIT: MasterValue name='{mv_obj.name}' | Product.color='{p_before.color}' | Product.attributes['color']='{p_before.attributes.get('color')}'")

        # 5. Execute production update path: RED -> CRIMSON via LookupService.update_value
        mv_update = MasterValueUpdate(name="CRIMSON")
        updated_mv = await service.update_value(val_id, mv_update)
        await db.commit()
        print(f"STEP 5: Executed LookupService.update_value() -> MasterValue name is now '{updated_mv.name}'")

        # 6. Re-query Product independently from database AFTER commit
        res_after = await db.execute(select(Product).where(Product.id == p_id))
        p_after = res_after.scalars().first()
        print(f"AFTER EDIT:  MasterValue name='{updated_mv.name}' | Product.color='{p_after.color}' | Product.attributes['color']='{p_after.attributes.get('color')}'")

        # Check propagation
        if p_after.color == "CRIMSON" or p_after.attributes.get("color") == "CRIMSON":
            print("RESULT: VERIFIED — Product color propagated to CRIMSON")
        else:
            print("RESULT: CONFIRMED OPEN — MasterValue updated to CRIMSON, but existing Product remains RED")

        # Clean up test records
        await db.delete(p_after)
        await db.delete(updated_mv)
        await db.commit()

if __name__ == "__main__":
    asyncio.run(genuine_e8_test())
