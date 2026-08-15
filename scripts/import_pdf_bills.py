"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.21.0
Created      : 2026-08-14
Modified     : 2026-08-14
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import os
import glob
import re
import uuid
import asyncio
from decimal import Decimal
from datetime import datetime, timezone
import pymupdf
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text

DB_URL = "postgresql+asyncpg://postgres:postgres@localhost:5432/smritisys"
EXPORT_DIR = r"F:\Smriti-Clients Data\Tattly Threads\exports\exported_pdf_invoices"


def parse_pdf_invoice(pdf_path: str) -> dict:
    doc = pymupdf.open(pdf_path)
    full_text = ""
    for page in doc:
        full_text += page.get_text() + "\n"

    # Extract Invoice No
    inv_match = re.search(r"Invoice No:\s*([A-Za-z0-9_\-\/]+)", full_text)
    if inv_match:
        raw_inv = inv_match.group(1).strip()
        invoice_no = raw_inv.replace("/", "_")
    else:
        file_base = os.path.basename(pdf_path)
        m = re.search(r"TT2026-2027_\d+", file_base)
        invoice_no = m.group(0) if m else file_base.replace(".pdf", "")

    # Extract Grand Total (handling Rupee symbol \u20b9 or Rs)
    gt_match = re.search(r"GRAND TOTAL:\s*[\u20b9₹Rs\.]*\s*([0-9,]+\.[0-9]{2})", full_text, re.IGNORECASE)
    grand_total = Decimal(gt_match.group(1).replace(",", "")) if gt_match else Decimal("0.00")

    # Extract Taxable Value
    tv_match = re.search(r"Taxable Value:\s*[\u20b9₹Rs\.]*\s*([0-9,]+\.[0-9]{2})", full_text, re.IGNORECASE)
    taxable_val = Decimal(tv_match.group(1).replace(",", "")) if tv_match else Decimal("0.00")

    # Extract IGST Tax Total
    igst_match = re.search(r"IGST\s*@\s*5%:\s*[\u20b9₹Rs\.]*\s*([0-9,]+\.[0-9]{2})", full_text, re.IGNORECASE)
    if igst_match:
        tax_total = Decimal(igst_match.group(1).replace(",", ""))
    else:
        tax_total = grand_total - taxable_val

    # Parse Item Lines
    item_pattern = re.compile(
        r"([A-Z0-9\-\s\/\.\(\)]+)\n"              # Description
        r"([0-9]{6,8})\n"                         # HSN
        r"([0-9]+)\n"                             # Qty
        r"[\u20b9₹Rs\.]*\s*([0-9,]+\.[0-9]{2})\n" # MRP
        r"([0-9\.]+%)\n"                          # Disc %
        r"[\u20b9₹Rs\.]*\s*([0-9,]+\.[0-9]{2})\n" # Taxable
        r"[\u20b9₹Rs\.]*\s*([0-9,]+\.[0-9]{2})\n" # IGST
        r"[\u20b9₹Rs\.]*\s*([0-9,]+\.[0-9]{2})"   # Amount
    )

    items = []
    for m in item_pattern.finditer(full_text):
        name = m.group(1).strip()
        hsn = m.group(2).strip()
        qty = Decimal(m.group(3).strip())
        price = Decimal(m.group(6).strip().replace(",", ""))  # Taxable value per line
        tax_amt = Decimal(m.group(7).strip().replace(",", ""))
        tot_amt = Decimal(m.group(8).strip().replace(",", ""))

        if name and not name.startswith("TATTLY") and not name.startswith("TAX INVOICE"):
            items.append({
                "code": name.split()[0] if name else "ITEM",
                "name": name,
                "hsn": hsn,
                "qty": qty,
                "price": price,
                "tax_amount": tax_amt,
                "total_amount": tot_amt
            })

    return {
        "invoice_no": invoice_no,
        "grand_total": grand_total,
        "tax_total": tax_total,
        "items": items
    }


async def main():
    engine = create_async_engine(DB_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    pdf_files = glob.glob(os.path.join(EXPORT_DIR, "*.pdf"))
    unique_invoices = {}

    for p in sorted(pdf_files):
        if "tmp" in p or "verification" in p or "headless" in p:
            continue
        try:
            parsed = parse_pdf_invoice(p)
            inv_no = parsed["invoice_no"]
            if inv_no not in unique_invoices or parsed["grand_total"] > 0:
                unique_invoices[inv_no] = parsed
        except Exception as e:
            print(f"Error parsing {p}: {e}")

    print(f"Parsed {len(unique_invoices)} unique client PDF invoices.")

    async with async_session() as session:
        # Ensure default company and branch seed records exist
        await session.execute(text("""
            INSERT INTO companies (id, uuid, name, is_active, is_deleted, created_at, modified_at)
            VALUES ('TATTLY', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Tattly Threads', true, false, NOW(), NOW())
            ON CONFLICT (id) DO NOTHING;
        """))
        await session.execute(text("""
            INSERT INTO branches (id, uuid, code, name, company_id, is_active, is_deleted, created_at, modified_at)
            VALUES ('MAIN', 'b2c3d4e5-f6a7-8901-bcde-f23456789012', 'MAIN', 'Main Branch', 'TATTLY', true, false, NOW(), NOW())
            ON CONFLICT (id) DO NOTHING;
        """))
        await session.commit()

        count = 0
        for inv_no, data in unique_invoices.items():
            inv_id = f"inv-{inv_no.lower()}"
            gt = float(data["grand_total"])
            tt = float(data["tax_total"])
            inv_uuid = str(uuid.uuid4())

            # Insert Header
            await session.execute(text("""
                INSERT INTO sales_invoices (id, uuid, invoice_no, date, grand_total, tax_total, payment_mode, status, is_interstate, is_deleted, company_id, branch_id, created_at, modified_at)
                VALUES (:id, :uuid, :invoice_no, CURRENT_DATE, :gt, :tt, 'CREDIT', 'Submitted', true, false, 'TATTLY', 'MAIN', NOW(), NOW())
                ON CONFLICT (invoice_no) DO UPDATE SET 
                    grand_total = EXCLUDED.grand_total,
                    tax_total = EXCLUDED.tax_total,
                    modified_at = NOW();
            """), {"id": inv_id, "uuid": inv_uuid, "invoice_no": inv_no, "gt": gt, "tt": tt})

            # Delete old line items before inserting fresh ones
            await session.execute(text("DELETE FROM sales_invoice_items WHERE invoice_id = :inv_id"), {"inv_id": inv_id})

            # Insert Line Items
            for item in data["items"]:
                await session.execute(text("""
                    INSERT INTO sales_invoice_items (invoice_id, code, name, quantity, price, hsn_code, gst_rate, tax_amount, total_amount)
                    VALUES (:inv_id, :code, :name, :qty, :price, :hsn, 5.00, :tax_amount, :total_amount);
                """), {
                    "inv_id": inv_id,
                    "code": item["code"],
                    "name": item["name"],
                    "qty": float(item["qty"]),
                    "price": float(item["price"]),
                    "hsn": item["hsn"],
                    "tax_amount": float(item["tax_amount"]),
                    "total_amount": float(item["total_amount"])
                })

            count += 1

        await session.commit()
        print(f"Successfully created and synchronized {count} client bills into PostgreSQL database smritisys!")

if __name__ == "__main__":
    asyncio.run(main())
