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

import asyncio
import os
import sys
from pathlib import Path
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, selectinload
from sqlalchemy.future import select

# Set stdout encoding
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

from backend.app.models.sales import SalesInvoice
from backend.app.services.invoice_pdf_service import InvoicePdfService
from playwright.async_api import async_playwright

OUTPUT_DIR_CANONICAL = REPO_ROOT / "exports" / "canonical_tax_invoices"
OUTPUT_DIR_FINAL = REPO_ROOT / "exports" / "Final_TaxInvoice"
OUTPUT_DIR_ALL54 = REPO_ROOT / "exports" / "all_54_pdf_invoices"
OUTPUT_DIR_BATCH = REPO_ROOT / "exports" / "tt_batch_104_106"

for d in [OUTPUT_DIR_CANONICAL, OUTPUT_DIR_FINAL, OUTPUT_DIR_ALL54, OUTPUT_DIR_BATCH]:
    d.mkdir(parents=True, exist_ok=True)

DATABASE_URL = "postgresql+asyncpg://postgres:postgres@localhost:5432/smriti001"

async def export_bill_106():
    print("=== EXPORTING BILL 106 CANONICAL TAX INVOICE ===")
    engine = create_async_engine(DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        stmt = (
            select(SalesInvoice)
            .options(selectinload(SalesInvoice.items))
            .where(SalesInvoice.invoice_no == "TT2026-2027/106")
        )
        res = await session.execute(stmt)
        inv = res.scalars().first()
        if not inv:
            print("ERROR: Bill 106 not found!")
            return

        print(f"Loaded invoice: {inv.invoice_no}")
        print(f"SIS Code: {inv.sis_code}")
        print(f"PO Reference: {inv.po_reference}")
        print(f"Billing: {inv.billing_address}")
        print(f"Shipping: {inv.shipping_address}")

        html = InvoicePdfService.generate_invoice_html_from_model(inv)

        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"]
            )
            page = await browser.new_page()
            await page.set_content(html)

            pdf_bytes = await page.pdf(
                format="A4",
                print_background=True,
                margin={"top": "0mm", "bottom": "0mm", "left": "0mm", "right": "0mm"}
            )

            inv_no_clean = inv.invoice_no.replace("/", "_").replace("\\", "_")
            sis_clean = str(inv.sis_code or "").replace("/", "_").replace("\\", "_").replace(" ", "_")

            paths = [
                OUTPUT_DIR_CANONICAL / f"{inv_no_clean}_CANONICAL.pdf",
                OUTPUT_DIR_FINAL / f"{sis_clean}_{inv_no_clean}.pdf",
                OUTPUT_DIR_ALL54 / f"{sis_clean}_{inv_no_clean}.pdf",
                OUTPUT_DIR_BATCH / f"SIS_{sis_clean}_TaxInvoice_{inv_no_clean}.pdf",
            ]

            for path in paths:
                with open(path, "wb") as f:
                    f.write(pdf_bytes)
                print(f"  Saved: {path}")

            await browser.close()
            print("Successfully exported Bill 106 PDF across all export destinations.")

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(export_bill_106())
