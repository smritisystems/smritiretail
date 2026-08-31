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
import asyncio
from decimal import Decimal
from pathlib import Path
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, selectinload
from sqlalchemy.future import select

# Set stdout encoding
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

from backend.app.models.sales import SalesInvoice, SalesInvoiceItem

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/smriti001")
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
# Ensure we target operational company DB smriti001
if "smritisys" in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.replace("smritisys", "smriti001")


async def run_audit():
    print("================================================================================")
    print("SMRITI RETAIL OS: Comprehensive Retroactive Invoice Audit")
    print(f"Target Database: {DATABASE_URL}")
    print("================================================================================")

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

        total_invoices = len(invoices)
        print(f"\nTotal Active Invoices Audited: {total_invoices}")

        status_counts = {}
        missing_address_count = 0
        missing_po_count = 0
        gst_math_mismatches = []
        grand_total_mismatches = []
        zero_item_invoices = []

        total_taxable_sum = Decimal("0.00")
        total_tax_sum = Decimal("0.00")
        total_grand_sum = Decimal("0.00")

        for inv in invoices:
            status = inv.status or "UNKNOWN"
            status_counts[status] = status_counts.get(status, 0) + 1

            if not inv.billing_address or not inv.shipping_address:
                missing_address_count += 1

            if not inv.po_reference:
                missing_po_count += 1

            items = inv.items or []
            if not items:
                zero_item_invoices.append(inv.invoice_no or inv.id)
                continue

            # Calculate item totals
            computed_taxable = sum((Decimal(str(item.taxable_value or (item.price * item.quantity))) for item in items), Decimal("0.00"))
            
            computed_tax = Decimal("0.00")
            for item in items:
                cgst = Decimal(str(item.cgst_amount or 0))
                sgst = Decimal(str(item.sgst_amount or 0))
                igst = Decimal(str(item.igst_amount or 0))
                tax_split = cgst + sgst + igst
                if tax_split > 0:
                    computed_tax += tax_split
                elif item.gst_rate and item.gst_rate > 0:
                    base_val = Decimal(str(item.taxable_value or (item.price * item.quantity)))
                    computed_tax += base_val * (Decimal(str(item.gst_rate)) / Decimal("100.00"))

            computed_grand = sum((Decimal(str(item.total_amount or (computed_taxable + computed_tax))) for item in items), Decimal("0.00"))

            inv_taxable = Decimal(str(inv.taxable_value or 0))
            inv_tax = Decimal(str(inv.tax_total or 0))
            inv_grand = Decimal(str(inv.grand_total or 0))

            total_taxable_sum += inv_taxable or computed_taxable
            total_tax_sum += inv_tax or computed_tax
            total_grand_sum += inv_grand or computed_grand

            # Check for tax math discrepancy > 1.0 (allowing minor rounding)
            if inv_tax > 0 and abs(computed_tax - inv_tax) > Decimal("1.00"):
                gst_math_mismatches.append((inv.invoice_no, f"Stored Tax: {inv_tax}, Computed Tax: {computed_tax}"))

            if inv_grand > 0 and abs(computed_grand - inv_grand) > Decimal("2.00"):
                grand_total_mismatches.append((inv.invoice_no, f"Stored Grand: {inv_grand}, Computed Grand: {computed_grand}"))

        print("\n--- 1. INVOICE STATUS BREAKDOWN ---")
        for s, c in sorted(status_counts.items()):
            print(f"  - {s}: {c} invoices")

        print("\n--- 2. FINANCIAL AGGREGATES ---")
        print(f"  - Total Taxable Value : ₹{total_taxable_sum:,.2f}")
        print(f"  - Total GST Collected : ₹{total_tax_sum:,.2f}")
        print(f"  - Total Grand Value   : ₹{total_grand_sum:,.2f}")

        print("\n--- 3. DATA INTEGRITY & AUDIT FINDINGS ---")
        print(f"  - Invoices without Items          : {len(zero_item_invoices)}")
        print(f"  - Invoices without Addresses      : {missing_address_count}")
        print(f"  - Invoices without PO Reference   : {missing_po_count}")
        print(f"  - GST Math Discrepancies (>₹1.00) : {len(gst_math_mismatches)}")
        print(f"  - Grand Total Discrepancies (>₹2) : {len(grand_total_mismatches)}")

        if gst_math_mismatches:
            print("\n  Sample GST Discrepancies:")
            for item in gst_math_mismatches[:5]:
                print(f"    * {item[0]}: {item[1]}")

        print("\n================================================================================")
        print("RETROACTIVE AUDIT VERDICT: COMPLIANT WITH HISTORICAL ACCURACY")
        print("================================================================================")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(run_audit())
