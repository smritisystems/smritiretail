import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from backend.app.services.reports import ReportsService
from backend.app.api.deps import TenantContext

async def test():
    engine = create_async_engine("postgresql+asyncpg://postgres:postgres@localhost:5432/smriti001")
    session_factory = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        ctx = TenantContext(company_id="COMP-001", branch_id="MAIN")
        service = ReportsService(session, ctx)
        val = await service.stock_valuation()
        print("=== STOCK VALUATION REPORT TEST ===")
        print(f"Total Products Valued: {val.total_items}")
        print(f"Total Inventory Valuation: Rs. {val.total_value}")
        for line in val.lines[:5]:
            print(f"  [{line.code}] {line.name} | Stock: {line.stock} | Cost: Rs. {line.cost_price} | Value: Rs. {line.stock_value}")
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(test())
