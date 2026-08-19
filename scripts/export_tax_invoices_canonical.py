"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.25.0
Created      : 2026-08-20
Modified     : 2026-08-20
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import os
import sys
import json
import csv
import time
import argparse
import asyncio
from pathlib import Path
from decimal import Decimal
from typing import List, Optional
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, selectinload
from sqlalchemy.future import select

# Set stdout encoding
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

from backend.app.models.sales import SalesInvoice, SalesInvoiceItem
from backend.app.services.invoice_pdf_service import InvoicePdfService

try:
    from playwright.async_api import async_playwright
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False


async def fetch_invoices(db_name: str, invoice_no: Optional[str] = None, last_n: Optional[int] = None) -> List[SalesInvoice]:
    """Fetches invoices from the target company database with line items eagerly loaded."""
    db_url = f"postgresql+asyncpg://postgres:postgres@localhost:5432/{db_name}"
    engine = create_async_engine(db_url)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        query = (
            select(SalesInvoice)
            .options(selectinload(SalesInvoice.items))
            .where(SalesInvoice.is_deleted == False)
        )
        if invoice_no:
            query = query.where(SalesInvoice.invoice_no == invoice_no)
        
        query = query.order_by(SalesInvoice.id)
        res = await session.execute(query)
        invoices = res.scalars().all()

        if last_n and len(invoices) > last_n:
            invoices = invoices[-last_n:]

    await engine.dispose()
    return invoices


async def export_invoices_pdf(invoices: List[SalesInvoice], out_dir: Path):
    """Exports invoices to canonical A4 PDF using Playwright and InvoicePdfService."""
    if not PLAYWRIGHT_AVAILABLE:
        print("Error: Playwright is required for PDF rendering. Install with: pip install playwright && playwright install chromium")
        sys.exit(1)

    out_dir.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        for idx, inv in enumerate(invoices, 1):
            inv_no = inv.invoice_no or f"INV-{inv.id}"
            clean_name = inv_no.replace("/", "_").replace("\\", "_")
            html_content = InvoicePdfService.generate_invoice_html_from_model(inv)

            await page.set_content(html_content)
            target_path = out_dir / f"{clean_name}.pdf"
            
            pdf_bytes = await page.pdf(
                format="A4",
                print_background=True,
                margin={"top": "0mm", "bottom": "0mm", "left": "0mm", "right": "0mm"}
            )
            with open(target_path, "wb") as f:
                f.write(pdf_bytes)

            print(f"  [{idx}/{len(invoices)}] Generated PDF: {target_path.name}")

        await browser.close()


def export_invoices_html(invoices: List[SalesInvoice], out_dir: Path):
    """Exports invoices to standalone HTML documents."""
    out_dir.mkdir(parents=True, exist_ok=True)
    for idx, inv in enumerate(invoices, 1):
        inv_no = inv.invoice_no or f"INV-{inv.id}"
        clean_name = inv_no.replace("/", "_").replace("\\", "_")
        html_content = InvoicePdfService.generate_invoice_html_from_model(inv)
        target_path = out_dir / f"{clean_name}.html"
        with open(target_path, "w", encoding="utf-8") as f:
            f.write(html_content)
        print(f"  [{idx}/{len(invoices)}] Generated HTML: {target_path.name}")


def export_invoices_json(invoices: List[SalesInvoice], out_file: Path):
    """Exports structured invoice metadata to JSON."""
    out_file.parent.mkdir(parents=True, exist_ok=True)
    data = []
    for inv in invoices:
        items_data = []
        for it in (inv.items or []):
            items_data.append({
                "code": it.code,
                "name": it.name,
                "quantity": float(it.quantity) if it.quantity else 0.0,
                "price": float(it.price) if it.price else 0.0,
                "gst_rate": float(it.gst_rate) if it.gst_rate else 0.0,
                "tax_amount": float(it.tax_amount) if it.tax_amount else 0.0,
                "total_amount": float(it.total_amount) if it.total_amount else 0.0
            })
        data.append({
            "id": inv.id,
            "invoice_no": inv.invoice_no,
            "date": str(inv.date),
            "customer_name": inv.customer_name,
            "customer_gstin": inv.customer_gstin,
            "po_reference": inv.po_reference,
            "eway_bill_no": inv.eway_bill_no,
            "taxable_value": float(inv.taxable_value) if inv.taxable_value else 0.0,
            "tax_total": float(inv.tax_total) if inv.tax_total else 0.0,
            "grand_total": float(inv.grand_total) if inv.grand_total else 0.0,
            "status": inv.status,
            "items": items_data
        })
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    print(f"  Exported {len(invoices)} invoices to JSON: {out_file}")


def export_invoices_csv(invoices: List[SalesInvoice], out_file: Path):
    """Exports structured invoice summary rows to CSV."""
    out_file.parent.mkdir(parents=True, exist_ok=True)
    headers = [
        "invoice_no", "date", "customer_name", "customer_gstin",
        "po_reference", "eway_bill_no", "item_count", "taxable_value",
        "tax_total", "grand_total", "status"
    ]
    with open(out_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(headers)
        for inv in invoices:
            writer.writerow([
                inv.invoice_no,
                str(inv.date),
                inv.customer_name,
                inv.customer_gstin,
                inv.po_reference,
                inv.eway_bill_no,
                len(inv.items or []),
                float(inv.taxable_value or 0),
                float(inv.tax_total or 0),
                float(inv.grand_total or 0),
                inv.status
            ])
    print(f"  Exported {len(invoices)} invoices to CSV: {out_file}")


async def main():
    parser = argparse.ArgumentParser(description="SMRITI Canonical Tax Invoice Multi-Format Exporter")
    parser.add_argument("--db", default="smriti001", help="Target company database name (default: smriti001)")
    parser.add_argument("--invoice", help="Specific invoice number to export (e.g. TT2026-2027/18)")
    parser.add_argument("--last", type=int, help="Export last N invoices")
    parser.add_argument("--format", default="pdf", choices=["pdf", "html", "json", "csv", "all"], help="Export format")
    parser.add_argument("--out-dir", default=str(REPO_ROOT / "exports" / "canonical_tax_invoices"), help="Output directory")

    args = parser.parse_args()
    out_path = Path(args.out_dir)

    print("================================================================================")
    print(f"SMRITI CANONICAL INVOICE EXPORTER (DB: {args.db}, Format: {args.format})")
    print("================================================================================")

    invoices = await fetch_invoices(args.db, invoice_no=args.invoice, last_n=args.last)
    print(f"Fetched {len(invoices)} active invoices.")

    if not invoices:
        print("No invoices matched the criteria.")
        return

    fmt = args.format.lower()
    if fmt in ("pdf", "all"):
        print("\n--- Exporting PDFs ---")
        await export_invoices_pdf(invoices, out_path)
    if fmt in ("html", "all"):
        print("\n--- Exporting HTMLs ---")
        export_invoices_html(invoices, out_path / "html")
    if fmt in ("json", "all"):
        print("\n--- Exporting JSON ---")
        export_invoices_json(invoices, out_path / "invoices_master.json")
    if fmt in ("csv", "all"):
        print("\n--- Exporting CSV ---")
        export_invoices_csv(invoices, out_path / "invoices_master.csv")

    print("\n================================================================================")
    print("EXPORTER VERDICT: COMPLETED SUCCESSFULLY")
    print("================================================================================")


if __name__ == "__main__":
    asyncio.run(main())
