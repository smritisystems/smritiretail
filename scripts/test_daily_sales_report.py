import asyncio
from datetime import date
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
        summary = await service.daily_sales(report_date=date(2026, 8, 12))
        print("=== DAILY SALES SUMMARY REPORT TEST ===")
        print(f"Report Date: {summary.report_date}")
        print(f"Total Invoices: {summary.total_invoices}")
        print(f"Total Sales Revenue: Rs. {summary.total_sales}")
        print(f"Cash Sales: Rs. {summary.cash_sales}")
        print(f"Bank / Other Sales: Rs. {summary.total_sales - summary.cash_sales}")
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(test())
