"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.82.0
Created      : 2026-10-15
Modified     : 2026-10-15
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Database Post-Ingestion Verification Engine
"""

import sys
import asyncio
sys.path.insert(0, r"F:\SMRITRretailNX\backend")

from app.db.session import async_session
from sqlalchemy import text

COMPANY_ID = "COMP-001"

async def verify():
    async with async_session() as s:
        print("=" * 80)
        print(f"DATABASE VERIFICATION REPORT FOR TENANT: {COMPANY_ID}")
        print("=" * 80)

        # 1. Suppliers
        sup_rows = (await s.execute(text("""
            SELECT code, name, mobile, outstanding 
            FROM suppliers 
            WHERE company_id = :cid AND code IN ('A','B','C','D','E','F','G','I','J')
            ORDER BY code
        """), {"cid": COMPANY_ID})).fetchall()
        print("\n=== 1. SUPPLIERS (9 VENDORS) ===")
        for r in sup_rows:
            print(f"Vendor [{r[0]}]: {r[1]:<20} | Contact: {r[2]} | Outstanding: Rs. {r[3]}")

        # 2. Purchase Orders
        po_stat = (await s.execute(text("""
            SELECT status, count(1), sum(subtotal), sum(grand_total) 
            FROM purchase_orders 
            WHERE company_id = :cid 
            GROUP BY status
        """), {"cid": COMPANY_ID})).fetchall()
        print("\n=== 2. PURCHASE ORDERS ===")
        for r in po_stat:
            print(f"Status: {r[0]} | Count: {r[1]} | Subtotal: Rs. {r[2]:,.2f} | Grand Total: Rs. {r[3]:,.2f}")

        # 3. Purchase Receipts (GRN)
        pr_stat = (await s.execute(text("""
            SELECT status, count(1), sum(subtotal), sum(grand_total) 
            FROM purchase_receipts 
            WHERE company_id = :cid 
            GROUP BY status
        """), {"cid": COMPANY_ID})).fetchall()
        print("\n=== 3. PURCHASE RECEIPTS (GRN) ===")
        for r in pr_stat:
            print(f"Status: {r[0]} | Count: {r[1]} | Subtotal: Rs. {r[2]:,.2f} | Grand Total: Rs. {r[3]:,.2f}")

        # 4. Purchase Bills
        pb_stat = (await s.execute(text("""
            SELECT status, count(1), sum(taxable_amount), sum(total_amount) 
            FROM purchase_bills 
            WHERE company_id = :cid 
            GROUP BY status
        """), {"cid": COMPANY_ID})).fetchall()
        print("\n=== 4. PURCHASE COMMERCIAL BILLS ===")
        for r in pb_stat:
            print(f"Status: {r[0]} | Count: {r[1]} | Taxable: Rs. {r[2]:,.2f} | Total: Rs. {r[3]:,.2f}")

        # 5. Stock Movements
        sm_stat = (await s.execute(text("""
            SELECT movement_type, count(1), sum(quantity), sum(quantity * unit_cost) 
            FROM stock_movements 
            WHERE company_id = :cid 
            GROUP BY movement_type
        """), {"cid": COMPANY_ID})).fetchall()
        print("\n=== 5. STOCK MOVEMENTS ===")
        for r in sm_stat:
            print(f"Type: {r[0]} | Movements: {r[1]} | Pairs Ingested: {r[2]:,.0f} | Valuation: Rs. {r[3]:,.2f}")

        # 6. Product Inventory Summary
        prod_stat = (await s.execute(text("""
            SELECT count(1), sum(stock), sum(stock * cost_price), sum(stock * price) 
            FROM products 
            WHERE company_id = :cid AND stock > 0
        """), {"cid": COMPANY_ID})).fetchone()
        print("\n=== 6. PRODUCT CATALOG INVENTORY SUMMARY ===")
        print(f"Active Stocked SKUs       : {prod_stat[0]}")
        print(f"Total Current Stock Units : {prod_stat[1]:,.0f} pairs")
        print(f"Total Cost Valuation      : Rs. {prod_stat[2]:,.2f}")
        print(f"Total MRP Valuation       : Rs. {prod_stat[3]:,.2f}")

        # 7. SND-05-G Barcode & Stock Check
        snd_stat = (await s.execute(text("""
            SELECT p.barcode, v.size, v.color, p.stock, p.cost_price, p.price 
            FROM products p
            JOIN item_variants v ON p.item_variant_id = v.id
            JOIN items i ON v.item_id = i.id
            WHERE i.item_code = 'SND-05-G' AND p.company_id = :cid
            ORDER BY v.size
        """), {"cid": COMPANY_ID})).fetchall()
        print("\n=== 7. SND-05-G (R-GOLD) BARCODE & STOCK VERIFICATION ===")
        for r in snd_stat:
            print(f"Size {r[1]}: Barcode {r[0]} | Color: {r[2]} | Stock: {r[3]:.0f} | Cost: Rs. {r[4]} | MRP: Rs. {r[5]}")

        # 8. Warehouse inventory check
        wh_stat = (await s.execute(text("""
            SELECT w.id, w.name, count(sm.id), sum(sm.quantity)
            FROM warehouses w
            LEFT JOIN stock_movements sm ON sm.warehouse_id = w.id
            WHERE w.company_id = :cid
            GROUP BY w.id, w.name
        """), {"cid": COMPANY_ID})).fetchall()
        print("\n=== 8. WAREHOUSE STOCK DISTRIBUTION ===")
        for r in wh_stat:
            print(f"Warehouse [{r[0]}]: {r[1]} | Movement Count: {r[2]} | Pairs: {r[3]:,.0f}")
        print("=" * 80)

if __name__ == "__main__":
    asyncio.run(verify())
