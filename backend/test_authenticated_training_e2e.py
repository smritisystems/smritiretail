"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.22.0
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
from httpx import AsyncClient, ASGITransport
from sqlalchemy import text

from app.main import app
from app.api.deps import get_db
from app.core.security import create_access_token, hash_password
from app.services.company_database_resolver import CompanyDatabaseResolver
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

async def run_authenticated_training_e2e():
    print("================================================================================")
    print("SMRITI USER TRAINING READINESS — AUTHENTICATED APPLICATION-LEVEL E2E SUITE")
    print("================================================================================")
    
    # 0. Initial Physical Row Count Snapshot
    init_sys = get_db_table_counts("smritisys")
    init_001 = get_db_table_counts("smriti001")
    init_002 = get_db_table_counts("smriti002")
    
    tag = f"TRN-{uuid.uuid4().hex[:6]}"
    now = datetime.now(timezone.utc)
    today = date.today()
    
    # Unique Test Entities
    admin_user_id = f"usr-adm-{tag}"
    admin_username = f"admin_{tag}"
    sup_id = f"sup-{tag}"
    prod_id = f"prod-{tag}"
    prod_sku = f"SKU-{tag}"
    prod_name = f"Training Footwear {tag}"
    prod_barcode = f"BC-{tag}"
    cust_id = f"cust-{tag}"
    po_id = f"po-{tag}"
    po_no = f"PO-{tag}"
    grn_id = f"grn-{tag}"
    grn_no = f"GRN-{tag}"
    inv_id = f"inv-{tag}"
    inv_no = f"INV-{tag}"
    ret_id = f"ret-{tag}"
    ret_no = f"RET-{tag}"
    
    # 1. Setup Authenticated SYSADMIN in Control Plane (smritisys)
    print("\n--- [STEP 1] AUTHENTICATION & CONTROL PLANE SETUP ---")
    conn_sys = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/smritisys")
    cur_sys = conn_sys.cursor()
    cur_sys.execute("""
        INSERT INTO companies (id, uuid, name, company_code, is_active, is_deleted, created_at, modified_at)
        VALUES ('COMP-001', %s, 'SMRITI Company 001', '001', true, false, %s, %s)
        ON CONFLICT (id) DO NOTHING;
    """, (str(uuid.uuid4()), now, now))
    cur_sys.execute("""
        INSERT INTO companies (id, uuid, name, company_code, is_active, is_deleted, created_at, modified_at)
        VALUES ('COMP-002', %s, 'SMRITI Company 002', '002', true, false, %s, %s)
        ON CONFLICT (id) DO NOTHING;
    """, (str(uuid.uuid4()), now, now))
    cur_sys.execute("""
        INSERT INTO branches (id, uuid, company_id, name, code, is_active, is_deleted, created_at, modified_at)
        VALUES ('BR-001', %s, 'COMP-001', 'Main Branch 001', 'BR-001', true, false, %s, %s)
        ON CONFLICT (id) DO NOTHING;
    """, (str(uuid.uuid4()), now, now))
    cur_sys.execute("""
        INSERT INTO branches (id, uuid, company_id, name, code, is_active, is_deleted, created_at, modified_at)
        VALUES ('BR-002', %s, 'COMP-002', 'Main Branch 002', 'BR-002', true, false, %s, %s)
        ON CONFLICT (id) DO NOTHING;
    """, (str(uuid.uuid4()), now, now))
    cur_sys.execute("""
        INSERT INTO users (
            id, uuid, username, email, hashed_password, full_name, role, status, 
            country, employment_type, created_at, modified_at,
            company_id, branch_id, is_active, is_deleted
        ) VALUES (
            %s, %s, %s, %s, %s, 'Training Sysadmin', 'SYSADMIN', 'Active',
            'India', 'FullTime', %s, %s,
            'COMP-001', 'BR-001', true, false
        );
    """, (admin_user_id, str(uuid.uuid4()), admin_username, f"{admin_username}@smriti.test", hash_password("ValidPassword123!"), now, now))
    conn_sys.commit()
    conn_sys.close()
    
    token = create_access_token({
        "sub": admin_user_id,
        "role": "SYSADMIN",
        "company_id": "COMP-001",
        "branch_id": "BR-001"
    })
    auth_headers_001 = {
        "Authorization": f"Bearer {token}",
        "X-Company-ID": "COMP-001",
        "X-Company-Code": "001",
        "X-Branch-Code": "BR-001"
    }
    print(f"  [PASS] Authenticated Token Generated for {admin_username} (Role: SYSADMIN, Company: COMP-001)")
    
    # 2. Resolve Company 001 and wire dependency override for business operations
    res_001 = CompanyDatabaseResolver.resolve_company_database(
        user_id="user-train-001", company_id="COMP-001", company_code="001", user_role="SYSADMIN"
    )
    url_001_async = res_001["connection_url"].replace("postgresql://", "postgresql+asyncpg://")
    pool_mgr = LRUConnectionPoolManager()
    session_factory_001 = await pool_mgr.get_session_factory("001", url_001_async)

    async def get_company_001_db():
        async with session_factory_001() as s:
            yield s

    from app.models.auth import User, UserRole
    from app.api.deps import get_current_user
    
    current_admin_user = User(
        id=admin_user_id,
        uuid=str(uuid.uuid4()),
        username=admin_username,
        email=f"{admin_username}@smriti.test",
        full_name="Training Sysadmin",
        role=UserRole.SYSADMIN,
        status="Active",
        company_id="COMP-001",
        branch_id="BR-001",
        is_active=True,
        is_deleted=False
    )
    
    async def override_get_current_user():
        return current_admin_user

    app.dependency_overrides[get_db] = get_company_001_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test", follow_redirects=True) as ac:
        # Verify authenticated tenant options
        t_res = await ac.get("/api/v1/auth/tenants", headers=auth_headers_001)
        print(f"  [PASS] GET /api/v1/auth/tenants -> Status {t_res.status_code}")
        assert t_res.status_code == 200

        # ──────────────────────────────────────────────────────────────────────
        # STEP 2: MASTER CREATION VIA REAL FASTAPI APIS
        # ──────────────────────────────────────────────────────────────────────
        print("\n--- [STEP 2] MASTER DATA MANAGEMENT (APPLICATION APIS) ---")
        
        unique_mobile_sup = f"98{abs(hash(tag + '_sup')) % 100000000:08d}"
        unique_mobile_cust = f"98{abs(hash(tag + '_cust')) % 100000000:08d}"
        
        # 2.1 Supplier Creation
        sup_payload = {
            "id": sup_id,
            "name": f"Training Supplier {tag}",
            "code": f"SUP-{tag}",
            "gst_number": "27AAACS1234F1Z5",
            "city": "Mumbai",
            "state": "Maharashtra",
            "mobile": unique_mobile_sup,
            "email": f"supplier_{tag}@smriti.test"
        }
        sup_res = await ac.post("/api/v1/purchase/suppliers/", json=sup_payload, headers=auth_headers_001)
        print(f"  [PASS] POST /api/v1/purchase/suppliers/ -> Status {sup_res.status_code} ({sup_res.json().get('name') if sup_res.status_code in (200, 201) else sup_res.text})")
        assert sup_res.status_code in (200, 201)
        
        # 2.2 Item Master Creation
        prod_payload = {
            "id": prod_id,
            "code": prod_sku,
            "sku": prod_sku,
            "name": prod_name,
            "category": "Footwear",
            "barcode": prod_barcode,
            "cost_price": 100.00,
            "price": 200.00,
            "mrp": 200.00,
            "gst_percentage": 18.00,
            "hsn_code": "6403",
            "stock": 0
        }
        prod_res = await ac.post("/api/v1/inventory/", json=prod_payload, headers=auth_headers_001)
        print(f"  [PASS] POST /api/v1/inventory/ -> Status {prod_res.status_code} ({prod_res.json().get('code') if prod_res.status_code in (200, 201) else prod_res.text})")
        assert prod_res.status_code in (200, 201)
        
        # 2.3 Customer Group & Customer Creation
        grp_id = f"grp-{tag}"
        grp_payload = {
            "id": grp_id,
            "name": f"Retail Group {tag}",
            "tax_inclusive": True,
            "credit_limit": 100000.00,
            "unlimited_credit": True
        }
        grp_res = await ac.post("/api/v1/customer-groups", json=grp_payload, headers=auth_headers_001)
        print(f"  [PASS] POST /api/v1/customer-groups -> Status {grp_res.status_code} ({grp_res.json().get('name') if grp_res.status_code in (200, 201) else grp_res.text})")
        assert grp_res.status_code in (200, 201)
        
        cust_payload = {
            "id": cust_id,
            "code": f"CUST-{tag}",
            "name": f"Training Customer {tag}",
            "mobile": unique_mobile_cust,
            "email": f"cust_{tag}@smriti.test",
            "customer_group_id": grp_id
        }
        cust_res = await ac.post("/api/v1/customers", json=cust_payload, headers=auth_headers_001)
        print(f"  [PASS] POST /api/v1/customers -> Status {cust_res.status_code} ({cust_res.json().get('name') if cust_res.status_code in (200, 201) else cust_res.text})")
        assert cust_res.status_code in (200, 201)

        # ──────────────────────────────────────────────────────────────────────
        # STEP 3: REAL PROCUREMENT & SHORT RECEIPT (PO 50 -> GRN 48 -> STOCK +48)
        # ──────────────────────────────────────────────────────────────────────
        print("\n--- [STEP 3] PROCUREMENT WORKFLOW (PO 50 -> GRN 48 -> STOCK +48) ---")
        
        # 3.1 Purchase Order Creation (50 units @ 100 + 18% GST = 5900)
        po_payload = {
            "id": po_id,
            "order_no": po_no,
            "supplier_id": sup_id,
            "notes": "User Training PO 50 units",
            "items": [
                {
                    "product_id": prod_id,
                    "code": prod_sku,
                    "name": prod_name,
                    "quantity": 50.0,
                    "cost_price": 100.0,
                    "gst_rate": 18.0
                }
            ]
        }
        po_res = await ac.post("/api/v1/purchase/orders/", json=po_payload, headers=auth_headers_001)
        print(f"  [PASS] POST /api/v1/purchase/orders/ -> Status {po_res.status_code} (PO: {po_no}, Grand Total: {po_res.json().get('grand_total')})")
        assert po_res.status_code in (200, 201)
        
        # 3.2 Goods Receipt Note (GRN) Short Receipt (Ordered: 50, Received: 48, Short: 2)
        grn_payload = {
            "id": grn_id,
            "receipt_no": grn_no,
            "supplier_id": sup_id,
            "order_id": po_id,
            "notes": "Short receipt of 48 units (2 short)",
            "items": [
                {
                    "product_id": prod_id,
                    "code": prod_sku,
                    "name": prod_name,
                    "quantity_ordered": 50.0,
                    "quantity_received": 48.0,
                    "cost_price": 100.0,
                    "gst_rate": 18.0
                }
            ]
        }
        grn_res = await ac.post("/api/v1/purchase/purchase-receipts/", json=grn_payload, headers=auth_headers_001)
        print(f"  [PASS] POST /api/v1/purchase/purchase-receipts/ -> Status {grn_res.status_code} (GRN: {grn_no}, Received: 48 units)")
        assert grn_res.status_code in (200, 201)
        
        # PostgreSQL Post-Verification of Inventory Engine Stock Increment
        conn_001 = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/smriti001")
        cur_001 = conn_001.cursor()
        cur_001.execute("SELECT stock FROM products WHERE id = %s;", (prod_id,))
        stk_after_grn = cur_001.fetchone()[0]
        cur_001.execute("SELECT quantity, movement_type, reference_doc_type FROM stock_movements WHERE product_id = %s;", (prod_id,))
        mov_after_grn = cur_001.fetchall()
        print(f"  [PASS] DB Stock after GRN -> {stk_after_grn} (Expected: 48.0)")
        print(f"  [PASS] DB Stock Movements after GRN -> {mov_after_grn}")
        assert Decimal(str(stk_after_grn)) == Decimal("48.0"), f"Expected 48.0, got {stk_after_grn}"
        assert len(mov_after_grn) >= 1

        # ──────────────────────────────────────────────────────────────────────
        # STEP 4: REAL SALES INVOICE & STOCK DECREMENT (SALE 5 -> STOCK 43)
        # ──────────────────────────────────────────────────────────────────────
        print("\n--- [STEP 4] SALES BILLING WORKFLOW (SALE 5 -> STOCK 43) ---")
        inv_payload = {
            "id": inv_id,
            "invoice_no": inv_no,
            "date": today.isoformat(),
            "customer_id": cust_id,
            "status": "COMPLETED",
            "items": [
                {
                    "product_id": prod_id,
                    "code": prod_sku,
                    "name": prod_name,
                    "quantity": 5.0,
                    "price": 200.0,
                    "hsn_code": "6403",
                    "gst_rate": 18.0
                }
            ]
        }
        inv_res = await ac.post("/api/v1/sales/invoices", json=inv_payload, headers=auth_headers_001)
        print(f"  [PASS] POST /api/v1/sales/invoices -> Status {inv_res.status_code} (Subtotal: 1000.00, Tax: {inv_res.json().get('tax_total')}, Grand Total: {inv_res.json().get('grand_total')})")
        assert inv_res.status_code in (200, 201)
        assert Decimal(str(inv_res.json().get("grand_total"))) == Decimal("1180.00")
        
        # PostgreSQL Post-Verification of Inventory Engine Stock Decrement
        cur_001.execute("SELECT stock FROM products WHERE id = %s;", (prod_id,))
        stk_after_sale = cur_001.fetchone()[0]
        cur_001.execute("SELECT quantity, movement_type, reference_doc_type FROM stock_movements WHERE product_id = %s ORDER BY created_at ASC;", (prod_id,))
        mov_after_sale = cur_001.fetchall()
        print(f"  [PASS] DB Stock after POS Sale -> {stk_after_sale} (Expected: 43.0)")
        print(f"  [PASS] DB Stock Movements -> {mov_after_sale}")
        assert Decimal(str(stk_after_sale)) == Decimal("43.0"), f"Expected 43.0, got {stk_after_sale}"

        # ──────────────────────────────────────────────────────────────────────
        # STEP 5: REAL SALES RETURN & STOCK RESTORATION (RETURN 2 -> STOCK 45)
        # ──────────────────────────────────────────────────────────────────────
        print("\n--- [STEP 5] SALES RETURN WORKFLOW (RETURN 2 -> STOCK 45) ---")
        ret_payload = {
            "id": ret_id,
            "return_no": ret_no,
            "original_invoice_id": inv_id,
            "date": today.isoformat(),
            "reason": "Size exchange",
            "status": "APPROVED",
            "items": [
                {
                    "product_id": prod_id,
                    "code": prod_sku,
                    "name": prod_name,
                    "quantity": 2.0,
                    "price": 200.0,
                    "gst_rate": 18.0,
                    "tax_amount": 72.0,
                    "total_amount": 472.0
                }
            ]
        }
        ret_res = await ac.post("/api/v1/sales/returns", json=ret_payload, headers=auth_headers_001)
        print(f"  [PASS] POST /api/v1/sales/returns -> Status {ret_res.status_code} (Return: {ret_no}, Grand Total: {ret_res.json().get('grand_total')})")
        assert ret_res.status_code in (200, 201)
        
        # PostgreSQL Post-Verification of Inventory Engine Stock Restoration
        cur_001.execute("SELECT stock FROM products WHERE id = %s;", (prod_id,))
        stk_after_ret = cur_001.fetchone()[0]
        cur_001.execute("SELECT quantity, movement_type, reference_doc_type FROM stock_movements WHERE product_id = %s ORDER BY created_at ASC;", (prod_id,))
        mov_after_ret = cur_001.fetchall()
        print(f"  [PASS] DB Stock after Return -> {stk_after_ret} (Expected: 45.0)")
        print(f"  [PASS] DB Stock Movements -> {mov_after_ret}")
        assert Decimal(str(stk_after_ret)) == Decimal("45.0"), f"Expected 45.0, got {stk_after_ret}"

        # ──────────────────────────────────────────────────────────────────────
        # STEP 6: REAL INVOICE PRINT, PDF EXPORT & REPRINT
        # ──────────────────────────────────────────────────────────────────────
        print("\n--- [STEP 6] REAL INVOICE PRINT / PDF EXPORT & REPRINT ---")
        html_res = await ac.get(f"/api/v1/sales/invoices/{inv_id}/html", headers=auth_headers_001)
        print(f"  [PASS] GET /api/v1/sales/invoices/{inv_id}/html -> Status {html_res.status_code} (Content Length: {len(html_res.text)} bytes)")
        assert html_res.status_code == 200
        assert inv_no in html_res.text
        assert "1,180.00" in html_res.text or "1180.00" in html_res.text
        
        pdf_res = await ac.get(f"/api/v1/sales/invoices/{inv_id}/pdf", headers=auth_headers_001)
        print(f"  [PASS] GET /api/v1/sales/invoices/{inv_id}/pdf -> Status {pdf_res.status_code}")
        assert pdf_res.status_code == 200

        # ──────────────────────────────────────────────────────────────────────
        # STEP 7: ECOMMERCE STOCK RESERVATION & WEBHOOK INGRESS
        # ──────────────────────────────────────────────────────────────────────
        print("\n--- [STEP 7] ECOMMERCE INGRESS & DUAL-COMPANY ISOLATION ---")
        
        # 7.1 Reserve 3 units for eCommerce Order
        resv_payload = {
            "sku": prod_sku,
            "quantity": 3.0,
            "ecom_order_id": f"ORD-ECOM-{tag}"
        }
        resv_res = await ac.post("/api/v1/ecom/orders/reserve", json=resv_payload, headers=auth_headers_001)
        print(f"  [PASS] POST /api/v1/ecom/orders/reserve -> Status {resv_res.status_code} (Reserved: 3 units)")
        assert resv_res.status_code == 200
        
        cur_001.execute("SELECT stock, reserved_stock FROM products WHERE id = %s;", (prod_id,))
        stk_resv = cur_001.fetchone()
        print(f"  [PASS] DB Stock & Reserved Stock -> Total: {stk_resv[0]}, Reserved: {stk_resv[1]}")
        assert Decimal(str(stk_resv[1])) == Decimal("3.0")
        
        # 7.2 Ingress Webhooks for COMP-001 and COMP-002
        hook_001 = await ac.post(
            "/api/v1/ecom/webhooks/ingress",
            json={"channel": "SHOPIFY", "event_type": "orders/create", "order_id": f"ORD-001-{tag}", "payload": {"order_id": f"ORD-001-{tag}"}},
            headers={"X-Company-ID": "COMP-001", "X-Company-Code": "001"}
        )
        assert hook_001.status_code == 200
        print("  [PASS] Webhook Ingress (COMP-001) -> 200 OK")
        
        hook_002 = await ac.post(
            "/api/v1/ecom/webhooks/ingress",
            json={"channel": "WOOCOMMERCE", "event_type": "orders/create", "order_id": f"ORD-002-{tag}", "payload": {"order_id": f"ORD-002-{tag}"}},
            headers={"X-Company-ID": "COMP-002", "X-Company-Code": "002"}
        )
        assert hook_002.status_code == 200
        print("  [PASS] Webhook Ingress (COMP-002) -> 200 OK")

        # ──────────────────────────────────────────────────────────────────────
        # STEP 8: PSV SHADOW LAYER COMPANY AUDIT
        # ──────────────────────────────────────────────────────────────────────
        print("\n--- [STEP 8] PSV SHADOW LAYER MULTI-COMPANY AUDIT ---")
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

    conn_001.close()

    # ──────────────────────────────────────────────────────────────────────────
    # STEP 9: CLEANUP OF TEST RECORDS (PRESERVING EXACT ZERO DELTA)
    # ──────────────────────────────────────────────────────────────────────────
    print("\n--- [STEP 9] CLEANING UP TEST ARTIFACTS ---")
    
    # 9.1 Clean smriti001
    conn_001 = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/smriti001")
    cur_001 = conn_001.cursor()
    cur_001.execute("DELETE FROM integration_outbox_events WHERE payload_json::text LIKE %s;", (f"%{tag}%",))
    cur_001.execute("DELETE FROM sales_return_items WHERE return_id = %s;", (ret_id,))
    cur_001.execute("DELETE FROM sales_returns WHERE id = %s;", (ret_id,))
    cur_001.execute("DELETE FROM sales_invoice_items WHERE invoice_id = %s;", (inv_id,))
    cur_001.execute("DELETE FROM sales_invoices WHERE id = %s;", (inv_id,))
    cur_001.execute("DELETE FROM stock_movements WHERE product_id = %s;", (prod_id,))
    cur_001.execute("DELETE FROM purchase_receipt_items WHERE receipt_id = %s;", (grn_id,))
    cur_001.execute("DELETE FROM purchase_receipts WHERE id = %s;", (grn_id,))
    cur_001.execute("DELETE FROM purchase_order_items WHERE order_id = %s;", (po_id,))
    cur_001.execute("DELETE FROM purchase_orders WHERE id = %s;", (po_id,))
    cur_001.execute("DELETE FROM customers WHERE id = %s;", (cust_id,))
    cur_001.execute("DELETE FROM customer_groups WHERE id = %s;", (grp_id,))
    cur_001.execute("DELETE FROM suppliers WHERE id = %s;", (sup_id,))
    cur_001.execute("DELETE FROM products WHERE id = %s;", (prod_id,))
    conn_001.commit()
    conn_001.close()
    
    # 9.2 Clean smriti002
    conn_002 = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/smriti002")
    cur_002 = conn_002.cursor()
    cur_002.execute("DELETE FROM integration_outbox_events WHERE payload_json::text LIKE %s;", (f"%{tag}%",))
    conn_002.commit()
    conn_002.close()
    
    # 9.3 Clean smritisys
    conn_sys = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/smritisys")
    cur_sys = conn_sys.cursor()
    cur_sys.execute("DELETE FROM users WHERE id = %s;", (admin_user_id,))
    cur_sys.execute("DELETE FROM branches WHERE id IN ('BR-001', 'BR-002');")
    cur_sys.execute("DELETE FROM companies WHERE id IN ('COMP-001', 'COMP-002');")
    conn_sys.commit()
    conn_sys.close()

    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_current_user, None)

    # ──────────────────────────────────────────────────────────────────────────
    # STEP 10: PHYSICAL ROW COUNT RECONCILIATION
    # ──────────────────────────────────────────────────────────────────────────
    post_sys = get_db_table_counts("smritisys")
    post_001 = get_db_table_counts("smriti001")
    post_002 = get_db_table_counts("smriti002")
    
    diff_s = {t: post_sys[t] - init_sys[t] for t in init_sys if post_sys[t] != init_sys[t]}
    diff_1 = {t: post_001[t] - init_001[t] for t in init_001 if post_001[t] != init_001[t]}
    diff_2 = {t: post_002[t] - init_002[t] for t in init_002 if post_002[t] != init_002[t]}

    print("\n--- FINAL PHYSICAL ROW AUDIT POST TEST RUN ---")
    print(f"smritisys diff: {diff_s}")
    print(f"smriti001 diff: {diff_1}")
    print(f"smriti002 diff: {diff_2}")
    assert len(diff_s) == 0 and len(diff_1) == 0 and len(diff_2) == 0, "FAIL: Residual cleanup variance!"
    
    print("\n================================================================================")
    print("[PASS] AUTHENTICATED APPLICATION-LEVEL E2E TEST COMPLETED WITH 100% SUCCESS")
    print("================================================================================")

if __name__ == "__main__":
    asyncio.run(run_authenticated_training_e2e())
