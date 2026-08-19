"""
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.0
 * Created      : 2026-08-12
 * Modified     : 2026-08-19
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
"""

import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from backend.app.services.reports import ReportsService
from backend.app.api.deps import TenantContext

async def test():
    engine = create_async_engine("postgresql+asyncpg://postgres:postgres@localhost:5432/smritisys")
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

