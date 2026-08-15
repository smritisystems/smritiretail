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
import uuid
import asyncio
from decimal import Decimal
import pandas as pd
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text

DB_URL = "postgresql+asyncpg://postgres:postgres@localhost:5432/smritisys"
EXCEL_PATH = r"F:\Smriti-Clients Data\Tattly Threads\Invoice\RIL_Dispatch_09-08-2026.xlsx"


async def process_dispatch_and_item_master():
    if not os.path.exists(EXCEL_PATH):
        print(f"Error: File not found at {EXCEL_PATH}")
        return

    df = pd.read_excel(EXCEL_PATH)
    engine = create_async_engine(DB_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    print(f"Processing {len(df)} dispatch rows from Excel...")

    sizes = [36, 37, 38, 39, 40, 41, 42]
    item_master = {}

    # 1. Build Item Master map across all rows
    for idx, row in df.iterrows():
        article = str(row["ARTICLE"]).strip().upper()
        color = str(row["COLOR"]).strip().upper()
        mrp = Decimal(str(row["MRP"]))

        for size in sizes:
            qty_val = row.get(size)
            if pd.notna(qty_val) and float(qty_val) > 0:
                qty = int(float(qty_val))
                sku = f"{article}-{color}-{size}".replace(" ", "_")
                barcode = f"BC-{sku}"
                
                if sku not in item_master:
                    # Estimate taxable price (~56.24% of MRP based on standard 43.76% discount)
                    taxable_price = (mrp * Decimal("0.5624")).quantize(Decimal("0.01"))
                    item_master[sku] = {
                        "sku": sku,
                        "code": sku,
                        "barcode": barcode,
                        "name": f"{article} {color} {size}",
                        "article": article,
                        "color": color,
                        "size": str(size),
                        "mrp": mrp,
                        "price": taxable_price,
                        "stock": 0,
                        "hsn": "64041990",
                        "gst_rate": Decimal("5.00")
                    }
                item_master[sku]["stock"] += qty

    print(f"Generated {len(item_master)} unique SKU items for Item Master.")

    async with async_session() as session:
        # Ensure company & branch exist
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

        # 2. Upsert Item Master into `products` table
        prod_count = 0
        for sku, prod in item_master.items():
            prod_id = f"prod-{sku.lower()}"
            prod_uuid = str(uuid.uuid4())

            await session.execute(text("""
                INSERT INTO products (
                    id, uuid, code, barcode, name, sku, category, color, size, mrp, price, cost_price, stock, reserved_stock,
                    hsn_code, gst_percentage, is_active, is_deleted, company_id, branch_id, created_at, modified_at
                )
                VALUES (
                    :id, :uuid, :code, :barcode, :name, :sku, 'Footwear', :color, :size, :mrp, :price, :price * 0.7, :stock, 0,
                    :hsn, :gst_rate, true, false, 'TATTLY', 'MAIN', NOW(), NOW()
                )
                ON CONFLICT (code) DO UPDATE SET
                    name = EXCLUDED.name,
                    barcode = EXCLUDED.barcode,
                    color = EXCLUDED.color,
                    size = EXCLUDED.size,
                    mrp = EXCLUDED.mrp,
                    price = EXCLUDED.price,
                    stock = EXCLUDED.stock,
                    modified_at = NOW();
            """), {
                "id": prod_id,
                "uuid": prod_uuid,
                "code": prod["code"],
                "barcode": prod["barcode"],
                "name": prod["name"],
                "sku": prod["sku"],
                "color": prod["color"],
                "size": prod["size"],
                "mrp": float(prod["mrp"]),
                "price": float(prod["price"]),
                "stock": prod["stock"],
                "hsn": prod["hsn"],
                "gst_rate": float(prod["gst_rate"])
            })
            prod_count += 1

        await session.commit()
        print(f"Successfully populated {prod_count} Items in Item Master (`products` table)!")

        # 3. Process Dispatch Billing Records per SIS Store
        stores_dispatch = {}

        for idx, row in df.iterrows():
            sis_code = str(row["SIS Code"]).strip()
            if sis_code.endswith(".0"):
                sis_code = sis_code[:-2]
            
            article = str(row["ARTICLE"]).strip().upper()
            color = str(row["COLOR"]).strip().upper()
            mrp = Decimal(str(row["MRP"]))
            carton = str(row.get("Cartoon number") or "").strip()

            if sis_code not in stores_dispatch:
                stores_dispatch[sis_code] = []

            for size in sizes:
                qty_val = row.get(size)
                if pd.notna(qty_val) and float(qty_val) > 0:
                    qty = int(float(qty_val))
                    sku = f"{article}-{color}-{size}".replace(" ", "_")
                    taxable_price = (mrp * Decimal("0.5624")).quantize(Decimal("0.01"))
                    tax_amount = (taxable_price * qty * Decimal("0.05")).quantize(Decimal("0.01"))
                    total_amount = (taxable_price * qty + tax_amount).quantize(Decimal("0.01"))

                    stores_dispatch[sis_code].append({
                        "sku": sku,
                        "code": sku,
                        "name": f"{article} {color} {size}",
                        "qty": qty,
                        "mrp": mrp,
                        "price": taxable_price,
                        "tax_amount": tax_amount,
                        "total_amount": total_amount,
                        "carton": carton
                    })

        print(f"Grouped dispatch billing for {len(stores_dispatch)} SIS customer stores.")

        bill_count = 0
        total_items_billed = 0

        for sis_code, items in stores_dispatch.items():
            inv_no = f"DISPATCH_RIL_{sis_code}"
            inv_id = f"inv-disp-{sis_code.lower()}"
            inv_uuid = str(uuid.uuid4())

            subtotal = sum(i["price"] * i["qty"] for i in items)
            tax_total = sum(i["tax_amount"] for i in items)
            grand_total = sum(i["total_amount"] for i in items)

            # Match Customer ID if exists
            cust_res = await session.execute(text("SELECT id FROM customers WHERE code = :code AND is_deleted = false"), {"code": sis_code})
            cust_row = cust_res.fetchone()
            cust_id = cust_row[0] if cust_row else None

            await session.execute(text("""
                INSERT INTO sales_invoices (
                    id, uuid, invoice_no, customer_id, date, subtotal, tax_total, grand_total,
                    payment_mode, status, is_interstate, is_deleted, company_id, branch_id, created_at, modified_at
                )
                VALUES (
                    :id, :uuid, :invoice_no, :customer_id, CURRENT_DATE, :subtotal, :tax_total, :grand_total,
                    'CREDIT', 'Submitted', true, false, 'TATTLY', 'MAIN', NOW(), NOW()
                )
                ON CONFLICT (invoice_no) DO UPDATE SET
                    subtotal = EXCLUDED.subtotal,
                    tax_total = EXCLUDED.tax_total,
                    grand_total = EXCLUDED.grand_total,
                    modified_at = NOW();
            """), {
                "id": inv_id,
                "uuid": inv_uuid,
                "invoice_no": inv_no,
                "customer_id": cust_id,
                "subtotal": float(subtotal),
                "tax_total": float(tax_total),
                "grand_total": float(grand_total)
            })

            await session.execute(text("DELETE FROM sales_invoice_items WHERE invoice_id = :inv_id"), {"inv_id": inv_id})

            for item in items:
                # Match product_id
                prod_id = f"prod-{item['sku'].lower()}"

                await session.execute(text("""
                    INSERT INTO sales_invoice_items (
                        invoice_id, product_id, code, name, quantity, price, hsn_code, gst_rate, tax_amount, total_amount
                    )
                    VALUES (
                        :inv_id, :prod_id, :code, :name, :qty, :price, '64041990', 5.00, :tax_amount, :total_amount
                    );
                """), {
                    "inv_id": inv_id,
                    "prod_id": prod_id,
                    "code": item["code"],
                    "name": item["name"],
                    "qty": float(item["qty"]),
                    "price": float(item["price"]),
                    "tax_amount": float(item["tax_amount"]),
                    "total_amount": float(item["total_amount"])
                })
                total_items_billed += item["qty"]

            bill_count += 1

        await session.commit()
        print(f"Successfully created and updated {bill_count} Store Dispatch Bills ({total_items_billed} Total Pairs) in `sales_invoices`!")

if __name__ == "__main__":
    asyncio.run(process_dispatch_and_item_master())
