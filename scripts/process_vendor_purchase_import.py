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
Classification: Enterprise Inventory & Procurement Ingestion Engine
"""

import os
import sys
import uuid
import datetime
from decimal import Decimal
from collections import defaultdict
import openpyxl
import asyncio

sys.path.insert(0, r"F:\SMRITRretailNX\backend")

from app.db.session import async_session
from sqlalchemy import text
from app.models.purchase import (
    Supplier,
    PurchaseOrder, PurchaseOrderItem,
    PurchaseReceipt, PurchaseReceiptItem,
    PurchaseBill, PurchaseBillItem,
)
from app.models.inventory import Product, StockMovement

EXCEL_FILE = r"F:\Smriti-Clients Data\15-10-2026\ALL VENDOR PURCHASE FOR SOFTWARE.xlsx"
COMPANY_ID = "COMP-001"
BRANCH_ID = "BR-MAIN-001"
WAREHOUSE_ID = "WH-MAIN-001"

# Client Vendor Directory
VENDOR_DIR = {
    "A": {"name": "ALIYA FOOTWEAR", "contact": "AMIR"},
    "B": {"name": "LAJOS FOOTWEAR", "contact": "ABDUL RAB"},
    "C": {"name": "AK FOOTWEAR", "contact": "AKRAM"},
    "D": {"name": "CRYSTAL SHOES", "contact": "ASIF"},
    "E": {"name": "SA FOOTWEAR", "contact": "SHAFI"},
    "F": {"name": "MK FOOTWEAR", "contact": "MOHID"},
    "G": {"name": "AS FOOTWEAR", "contact": "YAKIN"},
    "I": {"name": "LUCKY FOOTWEAR", "contact": "JAFFER"},
    "J": {"name": "SB FOOTWEAR", "contact": "SHARAFAT"},
}

def clean_doc_no(val: str) -> str:
    """Normalize bill numbers into clean document reference identifiers."""
    return "".join(c if c.isalnum() or c in ("-", "_") else "_" for c in val).strip("_")


async def execute_purchase_ingestion(dry_run: bool = True):
    print("=" * 90)
    print(f"SMRITI RETAIL OS: VENDOR PURCHASE & GRN INGESTION ENGINE (Dry-Run: {dry_run})")
    print("=" * 90)
    print(f"Source Excel : {EXCEL_FILE}")
    print(f"Target Tenant: Company={COMPANY_ID}, Branch={BRANCH_ID}, Warehouse={WAREHOUSE_ID}")
    
    wb = openpyxl.load_workbook(EXCEL_FILE, data_only=True)
    ws = wb['Sheet1']
    rows = list(ws.iter_rows(values_only=True))[1:444] # Valid 443 rows
    print(f"Loaded {len(rows)} purchase rows from Sheet1.")

    async with async_session() as session:
        # -------------------------------------------------------------------
        # 1. Warehouse Verification / Provisioning
        # -------------------------------------------------------------------
        wh_res = await session.execute(text("SELECT id, name FROM warehouses WHERE id = :wid"), {"wid": WAREHOUSE_ID})
        wh_row = wh_res.fetchone()
        if not wh_row:
            print(f"[Provisioning] Creating Central Warehouse '{WAREHOUSE_ID}'...")
            await session.execute(text("""
                INSERT INTO warehouses (
                    id, uuid, code, name, is_transit, is_central_godown,
                    company_id, branch_id, is_active, is_deleted, created_at, modified_at
                ) VALUES (
                    :id, :uuid, 'WH-MAIN', 'Main Store Central Godown', false, true,
                    :company_id, :branch_id, true, false, NOW(), NOW()
                )
            """), {
                "id": WAREHOUSE_ID,
                "uuid": str(uuid.uuid4()),
                "company_id": COMPANY_ID,
                "branch_id": BRANCH_ID,
            })
        else:
            print(f"[OK] Warehouse '{WAREHOUSE_ID}' ({wh_row[1]}) verified.")

        # -------------------------------------------------------------------
        # 2. Vendor (Supplier) Verification / Provisioning
        # -------------------------------------------------------------------
        print("\n[Step 2] Verifying & Provisioning 9 Suppliers...")
        supplier_id_map = {}
        for code, info in VENDOR_DIR.items():
            sup_res = await session.execute(
                text("SELECT id, name, code FROM suppliers WHERE company_id = :cid AND code = :code"),
                {"cid": COMPANY_ID, "code": code}
            )
            sup_row = sup_res.fetchone()
            if sup_row:
                sup_id = sup_row[0]
                # Update with authoritative company name and contact
                await session.execute(text("""
                    UPDATE suppliers 
                    SET name = :name, 
                        mobile = :contact, 
                        is_active = true,
                        modified_at = NOW()
                    WHERE id = :id
                """), {"name": info["name"], "contact": info["contact"], "id": sup_id})
                supplier_id_map[code] = sup_id
                print(f"  * Vendor [{code}] Updated: {info['name']} (ID: {sup_id})")
            else:
                new_id = f"sup_vend_{code.lower()}_{uuid.uuid4().hex[:6]}"
                await session.execute(text("""
                    INSERT INTO suppliers (
                        id, code, name, mobile, outstanding, company_id, branch_id, is_active, created_at, modified_at
                    ) VALUES (
                        :id, :code, :name, :contact, 0.00, :cid, :bid, true, NOW(), NOW()
                    )
                """), {
                    "id": new_id,
                    "code": code,
                    "name": info["name"],
                    "contact": info["contact"],
                    "cid": COMPANY_ID,
                    "bid": BRANCH_ID,
                })
                supplier_id_map[code] = new_id
                print(f"  * Vendor [{code}] Created: {info['name']} (ID: {new_id})")

        # -------------------------------------------------------------------
        # 3. Barcode Update for SND-05-G (R-GOLD)
        # -------------------------------------------------------------------
        print("\n[Step 3] Synchronizing Official EAN-13 Barcodes for SND-05-G (R-GOLD)...")
        snd05_barcodes = {
            "36": "8904551001894",
            "37": "8904551001900",
            "38": "8904551001917",
            "39": "8904551001924",
            "40": "8904551001931",
            "41": "8904551001948",
            "42": "8904551001955",
        }
        # Clean any dummy secondary duplicate barcodes ending in D
        await session.execute(text("DELETE FROM item_barcodes WHERE barcode IN ('NA029D', 'NA030D', 'NA031D', 'NA032D', 'NA033D', 'NA034D', 'NA035D') AND company_id = :cid"), {"cid": COMPANY_ID})

        for sz, ean in snd05_barcodes.items():
            # Update product
            await session.execute(text("""
                UPDATE products p
                SET barcode = :ean,
                    modified_at = NOW()
                FROM item_variants v, items i
                WHERE p.item_variant_id = v.id
                  AND v.item_id = i.id
                  AND i.item_code = 'SND-05-G'
                  AND v.color = 'R-GOLD'
                  AND v.size = :size
                  AND p.company_id = :cid
            """), {"ean": ean, "size": sz, "cid": COMPANY_ID})
            
            # Update primary item_barcodes
            await session.execute(text("""
                UPDATE item_barcodes b
                SET barcode = :ean,
                    modified_at = NOW()
                FROM item_variants v, items i
                WHERE b.variant_id = v.id
                  AND v.item_id = i.id
                  AND i.item_code = 'SND-05-G'
                  AND v.color = 'R-GOLD'
                  AND v.size = :size
                  AND b.is_primary = true
                  AND b.company_id = :cid
            """), {"ean": ean, "size": sz, "cid": COMPANY_ID})
            print(f"  * Updated SND-05-G R-GOLD Size {sz} -> Barcode {ean}")

        # -------------------------------------------------------------------
        # 4. Load Product Catalog Resolution Map
        # -------------------------------------------------------------------
        print("\n[Step 4] Loading Product Resolution Map from DB...")
        prod_res = await session.execute(text("""
            SELECT id, barcode, sku, name, item_variant_id, item_id, price, cost_price 
            FROM products 
            WHERE company_id = :cid
        """), {"cid": COMPANY_ID})
        prod_by_barcode = {r[1]: {
            "id": r[0],
            "barcode": r[1],
            "sku": r[2],
            "name": r[3],
            "variant_id": r[4],
            "item_id": r[5],
            "price": float(r[6] or 0),
            "cost_price": float(r[7] or 0),
        } for r in prod_res.fetchall() if r[1]}

        # -------------------------------------------------------------------
        # 5. Group Rows by Bill & Prepare Ingestion Payload
        # -------------------------------------------------------------------
        print("\n[Step 5] Parsing 443 Line Items into Distinct Purchase Bills...")
        bills = defaultdict(lambda: {
            "vendor_code": "",
            "bill_no": "",
            "bill_date": None,
            "lines": []
        })

        current_bill_no = None
        current_bill_date = None
        current_vendor_code = None

        for idx, r in enumerate(rows, start=2):
            bc = str(r[0]).strip()
            art = str(r[1]).strip()
            color = str(r[2]).strip().upper()
            size = str(r[3]).strip()
            mrp = float(r[4]) if r[4] is not None else 0.0
            cost = float(r[5]) if r[5] is not None else 0.0
            v_code = str(r[6]).strip() if r[6] else current_vendor_code
            qty = float(r[7]) if r[7] is not None else 0.0
            bill_no = str(r[10]).strip() if r[10] else None
            bill_date = r[11]

            # Continuation rows handling
            if not bill_no:
                if art == 'CH-20' and color == 'BEIGE':
                    bill_no = '707'
                    bill_date = datetime.date(2026, 9, 7)
                elif art == 'CH-22':
                    bill_no = '704'
                    bill_date = datetime.date(2026, 8, 10)
                elif art == 'CH-23':
                    bill_no = '706'
                    bill_date = datetime.date(2026, 8, 22)
                else:
                    bill_no = current_bill_no
                    bill_date = current_bill_date
            else:
                current_bill_no = bill_no
                current_bill_date = bill_date
                current_vendor_code = v_code

            if isinstance(bill_date, datetime.datetime):
                bill_date = bill_date.date()

            # Fix typo 2036 -> 2026
            if bill_date and bill_date.year == 2036:
                bill_date = datetime.date(2026, bill_date.month, bill_date.day)

            # Skip 0 quantity items (sizes not ordered in this batch) to satisfy chk_poi_quantity_positive
            if qty <= 0:
                continue

            p_info = prod_by_barcode.get(bc)
            if not p_info:
                raise ValueError(f"Row {idx}: Unresolvable Barcode {bc} (Article: {art}, {color}, {size})")

            key = f"{v_code}_{bill_no}"
            b = bills[key]
            b["vendor_code"] = v_code
            b["bill_no"] = bill_no
            b["bill_date"] = bill_date
            b["lines"].append({
                "row": idx,
                "product": p_info,
                "article": art,
                "color": color,
                "size": size,
                "qty": qty,
                "cost_price": cost,
                "mrp": mrp,
            })

        print(f"Total Unique Bills: {len(bills)}")

        # -------------------------------------------------------------------
        # 6. Generate Purchase Orders, GRNs, Bills & Stock Movements
        # -------------------------------------------------------------------
        total_pos_created = 0
        total_grns_created = 0
        total_bills_created = 0
        total_movements_created = 0
        total_qty_ingested = Decimal("0")
        total_cost_ingested = Decimal("0")

        print("\n[Step 6] Ingesting Purchase Orders and Goods Received Notes (GRN)...")

        for key, b_data in sorted(bills.items()):
            v_code = b_data["vendor_code"]
            sup_id = supplier_id_map[v_code]
            clean_bno = clean_doc_no(b_data["bill_no"])
            po_number = f"PO-{v_code}-{clean_bno}"
            grn_number = f"GRN-{v_code}-{clean_bno}"
            b_date = b_data["bill_date"] or datetime.date(2026, 8, 1)

            # Compute totals
            subtotal = Decimal("0.00")
            tax_total = Decimal("0.00")
            grand_total = Decimal("0.00")
            po_items = []

            for line in b_data["lines"]:
                qty = Decimal(str(line["qty"]))
                cost = Decimal(str(line["cost_price"]))
                line_sub = qty * cost
                line_tax = (line_sub * Decimal("0.18")).quantize(Decimal("0.01"))
                line_tot = line_sub + line_tax
                subtotal += line_sub
                tax_total += line_tax
                grand_total += line_tot

                po_items.append({
                    "line": line,
                    "qty": qty,
                    "cost": cost,
                    "tax": line_tax,
                    "total": line_tot,
                })

            po_id = f"po_{uuid.uuid4().hex[:12]}"
            grn_id = f"grn_{uuid.uuid4().hex[:12]}"
            pb_id = f"pb_{uuid.uuid4().hex[:12]}"

            # A. Purchase Order
            po = PurchaseOrder(
                id=po_id,
                order_no=po_number,
                identity_code=po_number,
                supplier_id=sup_id,
                status="RECEIVED",
                subtotal=subtotal,
                tax_total=tax_total,
                grand_total=grand_total,
                notes=f"Statutory Purchase Order for Vendor Bill {b_data['bill_no']} dated {b_date}",
                company_id=COMPANY_ID,
                branch_id=BRANCH_ID,
                submitted_by="SYSTEM",
                submitted_at=datetime.datetime.now(datetime.timezone.utc),
                confirmed_by="SYSTEM",
                confirmed_at=datetime.datetime.now(datetime.timezone.utc),
                created_at=datetime.datetime.combine(b_date, datetime.time(9, 0), tzinfo=datetime.timezone.utc),
            )

            # B. Purchase Receipt (GRN)
            grn = PurchaseReceipt(
                id=grn_id,
                receipt_no=grn_number,
                identity_code=grn_number,
                supplier_id=sup_id,
                order_id=po_id,
                warehouse_id=WAREHOUSE_ID,
                status="COMPLETED",
                subtotal=subtotal,
                tax_total=tax_total,
                grand_total=grand_total,
                notes=f"GRN goods receipt verified against Vendor Bill {b_data['bill_no']}",
                company_id=COMPANY_ID,
                branch_id=BRANCH_ID,
                created_at=datetime.datetime.combine(b_date, datetime.time(11, 0), tzinfo=datetime.timezone.utc),
            )

            # C. Commercial Purchase Bill
            pb = PurchaseBill(
                id=pb_id,
                bill_no=b_data["bill_no"],
                identity_code=f"PB-{v_code}-{clean_bno}",
                supplier_id=sup_id,
                order_id=po_id,
                receipt_id=grn_id,
                bill_date=b_date,
                status="POSTED",
                taxable_amount=subtotal,
                tax_amount=tax_total,
                total_amount=grand_total,
                paid_amount=Decimal("0.00"),
                notes=f"Commercial Invoice {b_data['bill_no']} from {VENDOR_DIR[v_code]['name']}",
                company_id=COMPANY_ID,
                branch_id=BRANCH_ID,
                created_at=datetime.datetime.combine(b_date, datetime.time(12, 0), tzinfo=datetime.timezone.utc),
            )

            po_lines = []
            grn_lines = []
            pb_lines = []
            bill_stock_movements = []

            # Prepare line items
            for itm in po_items:
                line = itm["line"]
                prod = line["product"]
                qty = itm["qty"]
                cost = itm["cost"]
                tax = itm["tax"]
                tot = itm["total"]
                p_id = prod["id"]
                p_code = prod["sku"]
                p_name = prod["name"]
                v_id = prod["variant_id"]
                item_id = prod["item_id"]

                po_item_id = f"poi_{uuid.uuid4().hex[:12]}"
                po_line = PurchaseOrderItem(
                    id=po_item_id,
                    order_id=po_id,
                    product_id=p_id,
                    item_id=item_id,
                    variant_id=v_id,
                    code=p_code,
                    name=p_name,
                    quantity=qty,
                    cost_price=cost,
                    gst_rate=Decimal("18.00"),
                    tax_amount=tax,
                    line_total=tot,
                    company_id=COMPANY_ID,
                    branch_id=BRANCH_ID,
                )
                po_lines.append(po_line)

                grn_item_id = f"pri_{uuid.uuid4().hex[:12]}"
                grn_line = PurchaseReceiptItem(
                    id=grn_item_id,
                    receipt_id=grn_id,
                    product_id=p_id,
                    item_id=item_id,
                    variant_id=v_id,
                    purchase_order_id=po_id,
                    purchase_order_no=po_number,
                    purchase_order_line_id=po_item_id,
                    code=p_code,
                    name=p_name,
                    mrp=Decimal(str(line["mrp"])),
                    quantity_ordered=qty,
                    quantity_received=qty,
                    quantity_damaged=Decimal("0.00"),
                    cost_price=cost,
                    gst_rate=Decimal("18.00"),
                    tax_amount=tax,
                    line_total=tot,
                    company_id=COMPANY_ID,
                    branch_id=BRANCH_ID,
                )
                grn_lines.append(grn_line)

                pb_item_id = f"pbi_{uuid.uuid4().hex[:12]}"
                pb_line = PurchaseBillItem(
                    id=pb_item_id,
                    bill_id=pb_id,
                    product_id=p_id,
                    item_id=item_id,
                    variant_id=v_id,
                    po_item_id=po_item_id,
                    receipt_item_id=grn_item_id,
                    code=p_code,
                    name=p_name,
                    quantity=qty,
                    rate=cost,
                    taxable_amount=qty * cost,
                    tax_amount=tax,
                    total_amount=tot,
                    company_id=COMPANY_ID,
                    branch_id=BRANCH_ID,
                )
                pb_lines.append(pb_line)

                # Record StockMovement
                if qty > 0:
                    sm = StockMovement(
                        id=f"sm_{uuid.uuid4().hex[:12]}",
                        uuid=str(uuid.uuid4()),
                        company_id=COMPANY_ID,
                        branch_id=BRANCH_ID,
                        product_id=p_id,
                        product_name=p_name,
                        sku=p_code,
                        quantity=qty,
                        movement_type="INWARD_GRN",
                        reference_doc_type="PURCHASE_RECEIPT",
                        reference_doc_id=grn_number,
                        warehouse="Main Godown",
                        warehouse_id=WAREHOUSE_ID,
                        variant_id=v_id,
                        item_id=item_id,
                        unit_cost=cost,
                        remarks=f"Inward GRN {grn_number} from {VENDOR_DIR[v_code]['name']} (Bill {b_data['bill_no']})",
                        created_at=datetime.datetime.combine(b_date, datetime.time(11, 30), tzinfo=datetime.timezone.utc),
                        is_active=True,
                        is_deleted=False,
                    )
                    bill_stock_movements.append(sm)

                total_qty_ingested += qty
                total_cost_ingested += qty * cost

            # Topological Sequence Flush:
            # 1. Purchase Order & Items
            session.add(po)
            session.add_all(po_lines)
            await session.flush()
            total_pos_created += 1

            # 2. Purchase Receipt (GRN) & Items (references PO)
            session.add(grn)
            session.add_all(grn_lines)
            await session.flush()
            total_grns_created += 1

            # 3. Commercial Purchase Bill & Items (references GRN and PO)
            session.add(pb)
            session.add_all(pb_lines)
            await session.flush()
            total_bills_created += 1

            # 4. Inward Stock Movements
            if bill_stock_movements:
                session.add_all(bill_stock_movements)
                total_movements_created += len(bill_stock_movements)

            # 5. Product Stock & Cost Price Updates
            if not dry_run:
                for itm in po_items:
                    line = itm["line"]
                    prod = line["product"]
                    qty = itm["qty"]
                    cost = itm["cost"]
                    if qty > 0:
                        await session.execute(text("""
                            UPDATE products
                            SET stock = stock + :qty,
                                cost_price = :cost,
                                price = :mrp,
                                modified_at = NOW()
                            WHERE id = :pid AND company_id = :cid
                        """), {
                            "qty": float(qty),
                            "cost": float(cost),
                            "mrp": float(line["mrp"]),
                            "pid": prod["id"],
                            "cid": COMPANY_ID,
                        })

            await session.flush()

            print(f"  [Processed] {po_number} -> {grn_number} | Lines: {len(po_items):<2} | Qty: {sum(i['qty'] for i in po_items):>6.0f} | Cost: Rs. {subtotal:,.2f}")

        if dry_run:
            print("\n[Dry-Run Complete] Rolling back all session changes. Nothing was committed.")
            await session.rollback()
        else:
            print("\n[Committing Changes] Committing all 28 POs, GRNs, and Stock Movements...")
            await session.commit()
            print("[SUCCESS] All transactions committed to PostgreSQL!")

        print("\n" + "=" * 50)
        print("INGESTION METRICS SUMMARY")
        print("=" * 50)
        print(f"Suppliers Verified/Updated : 9")
        print(f"Purchase Orders Created    : {total_pos_created}")
        print(f"GRNs (Receipts) Created    : {total_grns_created}")
        print(f"Purchase Bills Created     : {total_bills_created}")
        print(f"Stock Movements Created    : {total_movements_created}")
        print(f"Total Pairs/Units Received : {total_qty_ingested:,.0f} pairs")
        print(f"Total Purchase Cost Value  : Rs. {total_cost_ingested:,.2f}")
        print(f"Target Store Warehouse     : {WAREHOUSE_ID} (Company: {COMPANY_ID})")
        print("=" * 50)


if __name__ == "__main__":
    is_live = "--commit" in sys.argv
    asyncio.run(execute_purchase_ingestion(dry_run=not is_live))
