"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 4.9.5
Created      : 2026-08-19
Modified     : 2026-08-19
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import os
import sys
import asyncio
import json
import time
from pathlib import Path
from decimal import Decimal
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, selectinload
from sqlalchemy.future import select

# Set stdout encoding
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# Add repo root to path
REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

from backend.app.models.sales import SalesInvoice, SalesInvoiceItem
from backend.app.services.invoice_pdf_service import InvoicePdfService

try:
    from playwright.async_api import async_playwright
except ImportError:
    print("Error: Playwright is required.")
    sys.exit(1)

OUTPUT_DIR_CANONICAL = REPO_ROOT / "exports" / "canonical_tax_invoices"
OUTPUT_DIR_FINAL = REPO_ROOT / "exports" / "Final_TaxInvoice"
OUTPUT_DIR_ALL54 = REPO_ROOT / "exports" / "all_54_pdf_invoices"

for d in [OUTPUT_DIR_CANONICAL, OUTPUT_DIR_FINAL, OUTPUT_DIR_ALL54]:
    d.mkdir(parents=True, exist_ok=True)

DATABASE_URL = "postgresql+asyncpg://postgres:postgres@localhost:5432/smriti001"

async def save_pdf_with_retry(page, target_path: Path):
    temp_path = target_path.with_suffix(".tmp.pdf")
    pdf_bytes = await page.pdf(
        format="A4",
        print_background=True,
        margin={"top": "0mm", "bottom": "0mm", "left": "0mm", "right": "0mm"}
    )
    for attempt in range(5):
        try:
            with open(target_path, "wb") as f:
                f.write(pdf_bytes)
            break
        except PermissionError:
            time.sleep(0.5)

async def export_all_invoices():
    print("=== SMRITI RETAIL OS CANONICAL PDF EXPORT ENGINE ===")
    print("Connecting to database: smriti001")
    
    engine = create_async_engine(DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        stmt = (
            select(SalesInvoice)
            .options(selectinload(SalesInvoice.items))
            .where(SalesInvoice.is_deleted == False)
            .order_by(SalesInvoice.id)
        )
        res = await session.execute(stmt)
        invoices = res.scalars().all()
        print(f"Total active invoices fetched from Postgres: {len(invoices)}")

        async with async_playwright() as p:
            browser = await p.chromium.launch()
            page = await browser.new_page()

            exported_count = 0
            for inv in invoices:
                inv_no = inv.invoice_no or f"INV-{inv.id}"
                clean_inv_no = inv_no.replace("/", "_").replace("\\", "_")
                sis_code = getattr(inv, "sis_code", "") or "DEFAULT"
                clean_sis = str(sis_code).replace("/", "_").replace("\\", "_").replace(" ", "_")

                html = InvoicePdfService.generate_invoice_html_from_model(inv)
                
                # Check that updated header exists
                assert "<div>Web: www.tattlythreads.com</div>" in html
                assert "<div>Dispatch: dispatch@tattlythreads.com</div>" in html
                assert "<div>Accounts: accounts@tattlythreads.com</div>" in html

                await page.set_content(html)
                
                # Primary canonical PDF
                canonical_path = OUTPUT_DIR_CANONICAL / f"{clean_inv_no}_CANONICAL.pdf"
                await save_pdf_with_retry(page, canonical_path)

                # Final TaxInvoice PDF
                final_path = OUTPUT_DIR_FINAL / f"{clean_sis}_{clean_inv_no}.pdf"
                await save_pdf_with_retry(page, final_path)

                # All 54 / master PDF
                all54_path = OUTPUT_DIR_ALL54 / f"{clean_sis}_{clean_inv_no}.pdf"
                await save_pdf_with_retry(page, all54_path)

                exported_count += 1
                if exported_count % 10 == 0 or exported_count == len(invoices):
                    print(f"  [{exported_count}/{len(invoices)}] Exported: {clean_inv_no}")

            await browser.close()
            print(f"\nSUCCESS: Exported all {exported_count} Tax Invoices with updated header.")

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(export_all_invoices())
