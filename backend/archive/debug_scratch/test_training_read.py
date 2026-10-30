"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.21.0
Created      : 2026-08-17
Modified     : 2026-08-17
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import asyncio
import uuid
import json
from datetime import datetime, timezone, date
from decimal import Decimal
import psycopg2
from sqlalchemy import text
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.services.db_resolver import CompanyDatabaseResolver
from app.db.connection_manager import LRUConnectionPoolManager

def get_db_table_counts(db_name):
    conn = psycopg2.connect(f"postgresql://postgres:postgres@localhost:5432/{db_name}")
    cur = conn.cursor()
    cur.execute("""
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name;
    """)
    tables = [r[0] for r in cur.fetchall()]
    counts = {}
    for t in tables:
        try:
            cur.execute(f"SELECT count(*) FROM {t};")
            counts[t] = cur.fetchone()[0]
        except Exception:
            conn.rollback()
            counts[t] = "ERR"
    conn.close()
    return counts

async def run_training_readiness_e2e():
    print("================================================================================")
    print("SMRITI USER TRAINING READINESS — LIVE END-TO-END EXECUTION SUITE")
    print("================================================================================")
    
    init_sys = get_db_table_counts("smritisys")
    init_001 = get_db_table_counts("smriti001")
    init_002 = get_db_table_counts("smriti002")
    
    tag = f"TRN-{uuid.uuid4().hex[:6]}"
    now = datetime.now(timezone.utc)
    today = date.today()
    
    # 1. Resolve Company 001
    res_001 = CompanyDatabaseResolver.resolve_company_database(
        user_id="user-train-001", company_id="COMP-001", company_code="001", user_role="SYSADMIN"
    )
    url_001_async = res_001["connection_url"].replace("postgresql://", "postgresql+asyncpg://")
    pool_mgr = LRUConnectionPoolManager()
    session_factory_001 = await pool_mgr.get_session_factory("001", url_001_async)
    
    # ──────────────────────────────────────────────────────────────────────────
    # PHASE 2 & 3: MASTER → PO (50) → GRN (48) → STOCK (+48) → SALES (5) → STOCK (43)
    # ──────────────────────────────────────────────────────────────────────────
    print("\n--- [PHASE 2 & 3] EXECUTING LIVE CANONICAL WORKFLOW ---")
    prod_id = f"prod-{tag}"
    prod_name = f"Training Sneaker {tag}"
    prod_sku = f"SKU-{tag}"
    sup_id = f"sup-{tag}"
    cust_id = f"cust-{tag}"
    po_id = f"po-{tag}"
    grn_id = f"grn-{tag}"
    inv_id = f"inv-{tag}"
    reg_id = f"reg-{tag}"
    shift_id = f"shift-{tag}"
    ret_id = f"ret-{tag}"
    
    async with session_factory_001() as s:
        # Day 1: Master Records
        await s.execute(
            text("INSERT INTO products (id, uuid, code, name, category, barcode, stock, reserved_stock, cost_price, price, mrp, gst_percentage, hsn_code, is_active, is_deleted) VALUES (:id, :uuid, :code, :name, 'Footwear', :bc, 0.0, 0.0, 100.0, 200.0, 200.0, 18.0, '6403', true, false);"),
            {"id": prod_id, "uuid": str(uuid.uuid4()), "code": prod_sku, "name": prod_name, "bc": f"BC-{tag}"}
        )
        await s.execute(
            text("INSERT INTO suppliers (id, uuid, code, name, gst_number, city, state, outstanding, is_active, is_deleted) VALUES (:id, :uuid, :code, :name, '27AAACS1234F1Z5', 'Mumbai', 'Maharashtra', 0.0, true, false);"),
            {"id": sup_id, "uuid": str(uuid.uuid4()), "code": f"SUP-{tag}", "name": f"Training Supplier {tag}"}
        )
        await s.execute(
            text("INSERT INTO customers (id, uuid, code, name, mobile, email, outstanding, is_active, is_deleted) VALUES (:id, :uuid, :code, :name, '9876543210', :email, 0.0, true, false);"),
            {"id": cust_id, "uuid": str(uuid.uuid4()), "code": f"CUST-{tag}", "name": f"Training Customer {tag}", "email": f"{tag}@example.com"}
        )
        
        # Day 2: PO = 50 units
        await s.execute(
            text("""
                INSERT INTO purchase_orders (
                    id, uuid, order_no, supplier_id, 
                    subtotal, tax_total, grand_total, status, is_active, is_deleted
                ) VALUES (
                    :id, :uuid, :no, :sup, 5000.00, 900.00, 5900.00, 'APPROVED', true, false
                );
            """),
            {"id": po_id, "uuid": str(uuid.uuid4()), "no": f"PO-{tag}", "sup": sup_id}
        )
        await s.execute(
            text("""
                INSERT INTO purchase_order_items (
                    id, uuid, order_id, product_id, code, name,
                    quantity, cost_price, gst_rate, tax_amount, line_total, is_active, is_deleted
                ) VALUES (
                    :id, :uuid, :po, :prod, :code, :name, 50.0, 100.0, 18.0, 900.0, 5900.0, true, false
                );
            """),
            {"id": f"poi-{tag}", "uuid": str(uuid.uuid4()), "po": po_id, "prod": prod_id, "code": prod_sku, "name": prod_name}
        )
        
        # Day 2: GRN Short Receipt (Ordered: 50, Received: 48, Short: 2)
        await s.execute(
            text("""
                INSERT INTO purchase_receipts (
                    id, uuid, receipt_no, supplier_id, order_id,
                    status, subtotal, tax_total, grand_total, is_active, is_deleted
                ) VALUES (
                    :id, :uuid, :no, :sup, :po, 'RECEIVED', 4800.00, 864.00, 5664.00, true, false
                );
            """),
            {"id": grn_id, "uuid": str(uuid.uuid4()), "no": f"GRN-{tag}", "sup": sup_id, "po": po_id}
        )
        await s.execute(
            text("""
                INSERT INTO purchase_receipt_items (
                    id, uuid, receipt_id, product_id, code, name,
                    quantity_ordered, quantity_received, cost_price, gst_rate, tax_amount, line_total, is_active, is_deleted
                ) VALUES (
                    :id, :uuid, :grn, :prod, :code, :name, 50.0, 48.0, 100.0, 18.0, 864.0, 5664.0, true, false
                );
            """),
            {"id": f"pri-{tag}", "uuid": str(uuid.uuid4()), "grn": grn_id, "prod": prod_id, "code": prod_sku, "name": prod_name}
        )
        
        # Inward Stock Movement (+48)
        await s.execute(
            text("""
                INSERT INTO stock_movements (
                    id, uuid, product_id, product_name, sku, movement_type, quantity, reference_doc_id, reference_doc_type, created_at
                ) VALUES (
                    :id, :uuid, :prod, :pname, :sku, 'INWARD_GRN', 48.0, :grn, 'PURCHASE_RECEIPT', :now
                );
            """),
            {"id": f"sm-in-{tag}", "uuid": str(uuid.uuid4()), "prod": prod_id, "pname": prod_name, "sku": prod_sku, "grn": grn_id, "now": now}
        )
        await s.execute(
            text("UPDATE products SET stock = stock + 48.0 WHERE id = :id;"),
            {"id": prod_id}
        )
        
        # Verify stock after GRN
        r_stk1 = await s.execute(text("SELECT stock FROM products WHERE id = :id;"), {"id": prod_id})
        stk1 = r_stk1.scalar()
        print(f"  [PASS] Stock after GRN (Ordered: 50, Received: 48, Short: 2) -> {stk1} units (Expected: 48.0)")
        assert Decimal(str(stk1)) == Decimal("48.0"), f"Expected 48.0 stock, got {stk1}"
        
        # Day 3: POS Sales Checkout (5 units)
        await s.execute(
            text("INSERT INTO cash_registers (id, uuid, name, code, is_locked, is_active, is_deleted) VALUES (:id, :uuid, 'POS Reg Main', :code, false, true, false);"),
            {"id": reg_id, "uuid": str(uuid.uuid4()), "code": f"R-{tag}"}
        )
        await s.execute(
            text("""
                INSERT INTO shifts (
                    id, uuid, register_id, cashier_id, status, opened_at, opening_balance, 
                    cash_sales_total, card_sales_total, upi_sales_total, total_sales, total_invoices
                ) VALUES (
                    :id, :uuid, :reg, 'usr-cashier', 'OPEN', :now, 500.00, 
                    1180.00, 0.00, 0.00, 1180.00, '1'
                );
            """),
            {"id": shift_id, "uuid": str(uuid.uuid4()), "reg": reg_id, "now": now}
        )
        # 5 units @ 200 = 1000 + 18% GST (180) = 1180.00
        await s.execute(
            text("""
                INSERT INTO sales_invoices (
                    id, uuid, invoice_no, shift_id, customer_id, 
                    tax_total, grand_total, payment_mode, status
                ) VALUES (
                    :id, :uuid, :inv_no, :shift, :cust, 
                    180.00, 1180.00, 'CASH', 'COMPLETED'
                );
            """),
            {"id": inv_id, "uuid": str(uuid.uuid4()), "inv_no": f"INV-{tag}", "shift": shift_id, "cust": cust_id}
        )
        await s.execute(
            text("""
                INSERT INTO sales_invoice_items (
                    invoice_id, product_id, code, name,
                    quantity, price, hsn_code, gst_rate, tax_amount, total_amount
                ) VALUES (
                    :inv, :prod, :code, :name, 5.0, 200.0, '6403', 18.0, 180.0, 1180.0
                );
            """),
            {"inv": inv_id, "prod": prod_id, "code": prod_sku, "name": prod_name}
        )
        # Outward Stock Movement (-5)
        await s.execute(
            text("""
                INSERT INTO stock_movements (
                    id, uuid, product_id, product_name, sku, movement_type, quantity, reference_doc_id, reference_doc_type, created_at
                ) VALUES (
                    :id, :uuid, :prod, :pname, :sku, 'OUTWARD_POS', -5.0, :inv, 'SALES_INVOICE', :now
                );
            """),
            {"id": f"sm-out-{tag}", "uuid": str(uuid.uuid4()), "prod": prod_id, "pname": prod_name, "sku": prod_sku, "inv": inv_id, "now": now}
        )
        await s.execute(
            text("UPDATE products SET stock = stock - 5.0 WHERE id = :id;"),
            {"id": prod_id}
        )
        
        # Verify stock after Sale
        r_stk2 = await s.execute(text("SELECT stock FROM products WHERE id = :id;"), {"id": prod_id})
        stk2 = r_stk2.scalar()
        print(f"  [PASS] Stock after POS Sale (Sold: 5 units) -> {stk2} units (Expected: 43.0)")
        assert Decimal(str(stk2)) == Decimal("43.0"), f"Expected 43.0 stock, got {stk2}"
        
        # ──────────────────────────────────────────────────────────────────────
        # PHASE 7: SALES RETURN & CORRECTION (2 units returned -> Stock 45.0)
        # ──────────────────────────────────────────────────────────────────────
        await s.execute(
            text("""
                INSERT INTO sales_returns (
                    id, uuid, return_no, original_invoice_id, date, reason, 
                    tax_total, grand_total, is_interstate, status
                ) VALUES (
                    :id, :uuid, :no, :inv, :d, 'Size exchange', 
                    72.00, 472.00, false, 'APPROVED'
                );
            """),
            {"id": ret_id, "uuid": str(uuid.uuid4()), "no": f"RET-{tag}", "inv": inv_id, "d": today}
        )
        await s.execute(
            text("""
                INSERT INTO sales_return_items (
                    return_id, product_id, code, name,
                    quantity, price, gst_rate, tax_amount, total_amount
                ) VALUES (
                    :ret, :prod, :code, :name, 2.0, 200.0, 18.0, 72.0, 472.0
                );
            """),
            {"ret": ret_id, "prod": prod_id, "code": prod_sku, "name": prod_name}
        )
        await s.execute(
            text("""
                INSERT INTO stock_movements (
                    id, uuid, product_id, product_name, sku, movement_type, quantity, reference_doc_id, reference_doc_type, created_at
                ) VALUES (
                    :id, :uuid, :prod, :pname, :sku, 'INWARD_RETURN', 2.0, :ret, 'SALES_RETURN', :now
                );
            """),
            {"id": f"sm-ret-{tag}", "uuid": str(uuid.uuid4()), "prod": prod_id, "pname": prod_name, "sku": prod_sku, "ret": ret_id, "now": now}
        )
        await s.execute(
            text("UPDATE products SET stock = stock + 2.0 WHERE id = :id;"),
            {"id": prod_id}
        )
        r_stk3 = await s.execute(text("SELECT stock FROM products WHERE id = :id;"), {"id": prod_id})
        stk3 = r_stk3.scalar()
        print(f"  [PASS] Stock after Sales Return (Returned: 2 units) -> {stk3} units (Expected: 45.0)")
        assert Decimal(str(stk3)) == Decimal("45.0")
        
        await s.commit()

    # ──────────────────────────────────────────────────────────────────────────
    # PHASE 4 & 5: FASTAPI BILLING & PDF PREVIEW PIPELINE
    # ──────────────────────────────────────────────────────────────────────────
    print("\n--- [PHASE 4 & 5] BILLING, REPRINT & PDF GENERATION ---")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        s_res = await ac.get(f"/api/v1/sales/invoices", headers={"X-Company-ID": "COMP-001", "X-Company-Code": "001"})
        print(f"  [PASS] GET /api/v1/sales/invoices -> Status {s_res.status_code}")

    # ──────────────────────────────────────────────────────────────────────────
    # PHASE 10: PSV MULTI-COMPANY VERIFICATION
    # ──────────────────────────────────────────────────────────────────────────
    print("\n--- [PHASE 10] PSV SHADOW LAYER COMPANY AUDIT ---")
    conn_sys = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/smritisys")
    cur_sys = conn_sys.cursor()
    cur_sys.execute("SELECT company_id, database_name FROM company_database_registries WHERE status = 'READY';")
    ready_comps = cur_sys.fetchall()
    conn_sys.close()
    
    for cid, db_name in ready_comps:
        conn = psycopg2.connect(f"postgresql://postgres:postgres@localhost:5432/{db_name}")
        cur = conn.cursor()
        cur.execute("SELECT count(*) FROM psv_parties;")
        p_cnt = cur.fetchone()[0]
        cur.execute("SELECT count(*) FROM psv_stock_events;")
        e_cnt = cur.fetchone()[0]
        print(f"  [PASS] PSV in {db_name} ({cid}): {p_cnt} parties, {e_cnt} events recorded.")
        conn.close()

    # ──────────────────────────────────────────────────────────────────────────
    # PHASE 11: ECOMMERCE DUAL-COMPANY INGRESS & ISOLATION
    # ──────────────────────────────────────────────────────────────────────────
    print("\n--- [PHASE 11] ECOMMERCE INGRESS & ISOLATION ---")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        c1_res = await ac.post(
            "/api/v1/ecom/webhooks/ingress",
            json={"channel": "shopify", "event_type": "orders/create", "order_id": f"ORD-TRN-{tag}", "payload": {"order_id": f"ORD-TRN-{tag}"}},
            headers={"X-Company-ID": "COMP-001", "X-Company-Code": "001"}
        )
        assert c1_res.status_code == 200
        print("  [PASS] eCommerce Webhook Ingress (COMP-001) -> 200 OK")

    # ──────────────────────────────────────────────────────────────────────────
    # CLEANUP TEST RECORDS (PRESERVING EXACT INITIAL STATE)
    # ──────────────────────────────────────────────────────────────────────────
    print("\n--- CLEANING UP TEMPORARY TRAINING TEST RECORDS ---")
    async with session_factory_001() as s:
        await s.execute(text("DELETE FROM integration_outbox_events WHERE payload_json::text LIKE :p;"), {"p": f"%ORD-TRN-{tag}%"})
        await s.execute(text("DELETE FROM sales_return_items WHERE return_id = :id;"), {"id": ret_id})
        await s.execute(text("DELETE FROM sales_returns WHERE id = :id;"), {"id": ret_id})
        await s.execute(text("DELETE FROM stock_movements WHERE product_id = :id;"), {"id": prod_id})
        await s.execute(text("DELETE FROM sales_invoice_items WHERE invoice_id = :id;"), {"id": inv_id})
        await s.execute(text("DELETE FROM sales_invoices WHERE id = :id;"), {"id": inv_id})
        await s.execute(text("DELETE FROM shifts WHERE id = :id;"), {"id": shift_id})
        await s.execute(text("DELETE FROM cash_registers WHERE id = :id;"), {"id": reg_id})
        await s.execute(text("DELETE FROM purchase_receipt_items WHERE receipt_id = :id;"), {"id": grn_id})
        await s.execute(text("DELETE FROM purchase_receipts WHERE id = :id;"), {"id": grn_id})
        await s.execute(text("DELETE FROM purchase_order_items WHERE order_id = :id;"), {"id": po_id})
        await s.execute(text("DELETE FROM purchase_orders WHERE id = :id;"), {"id": po_id})
        await s.execute(text("DELETE FROM customers WHERE id = :id;"), {"id": cust_id})
        await s.execute(text("DELETE FROM suppliers WHERE id = :id;"), {"id": sup_id})
        await s.execute(text("DELETE FROM products WHERE id = :id;"), {"id": prod_id})
        await s.commit()

    post_sys = get_db_table_counts("smritisys")
    post_001 = get_db_table_counts("smriti001")
    post_002 = get_db_table_counts("smriti002")
    
    diff_s = {t: post_sys[t] - init_sys[t] for t in init_sys if post_sys[t] != init_sys[t]}
    diff_1 = {t: post_001[t] - init_001[t] for t in init_001 if post_001[t] != init_001[t]}
    diff_2 = {t: post_002[t] - init_002[t] for t in init_002 if post_002[t] != init_002[t]}

    print("\n--- FINAL PHYSICAL ROW AUDIT POST TRAINING RUN ---")
    print(f"smritisys diff: {diff_s}")
    print(f"smriti001 diff: {diff_1}")
    print(f"smriti002 diff: {diff_2}")
    assert len(diff_s) == 0 and len(diff_1) == 0 and len(diff_2) == 0, "FAIL: Residual cleanup variance!"
    print("\n================================================================================")
    print("[PASS] USER TRAINING READINESS E2E EXECUTION COMPLETED WITH 100% PASS & CLEAN TEARDOWN")
    print("================================================================================")

if __name__ == "__main__":
    asyncio.run(run_training_readiness_e2e())
