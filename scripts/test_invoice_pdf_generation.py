import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from backend.app.services.invoice_pdf_service import InvoicePdfService

async def test():
    engine = create_async_engine("postgresql+asyncpg://postgres:postgres@localhost:5432/smriti001")
    session_factory = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        html = await InvoicePdfService.generate_invoice_html(
            session=session,
            invoice_id="inv-6c514150a4e6",
            company_id="COMP-001",
            branch_id="MAIN"
        )
        print("=== INVOICE HTML GENERATION TEST ===")
        print(f"HTML generated successfully! Total size: {len(html)} bytes.")
        print(f"Contains DOCTYPE: {'<!DOCTYPE html>' in html}")
        print(f"Contains Invoice No TT2026-2027/20: {'TT2026-2027/20' in html}")
        print(f"Contains Grand Total 163315: {'163315' in html or '163,315' in html}")
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(test())
