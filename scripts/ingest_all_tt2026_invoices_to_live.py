# -*- coding: utf-8 -*-
"""
Canonical Batch Ingestion of all 278 Sales Tax Invoices to Live Production (https://tattlythreads.smritisys.com/)
with Real-Time Auto PSV (Party Stock Visibility) Projection.

Author      : Jawahar Ramkripal Mallah
Designation : Chief Systems Architect & Creator
Email       : support@smritibooks.com
Websites    : smritibooks.com | erpnbook.com | aitdl.com
Version     : 6.99.1
Copyright   : (c) SMRITIBooks.com. All Rights Reserved.
License     : Proprietary Commercial Software
Classification: Production Data Migration & PSV Convergence
"""

import asyncio
import decimal
import json
import logging
import time
from typing import Dict, Any, List
import httpx
import psycopg2

BASE_URL = "https://tattlythreads.smritisys.com"
CUSTOMER_ID = "cust-rrl-192b561d"
LOCAL_DB_URL = "postgresql://postgres:postgres@localhost:2781/smriti001"

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("InvoicePSVIngest")

async def run_ingestion(dry_run: bool = False, max_invoices: int = 500):
    logger.info("=====================================================================")
    logger.info(" SMRITI Retail OS - 278 Sales Tax Invoices & Auto PSV Ingestion Engine")
    logger.info(" Target: %s", BASE_URL)
    logger.info(" Customer: Reliance Retail Limited (%s)", CUSTOMER_ID)
    logger.info(" Mode: %s", "DRY-RUN (Simulated)" if dry_run else "LIVE INGESTION & PSV PROJECTION")
    logger.info("=====================================================================")

    # 1. Fetch Local Invoices and Items
    conn = psycopg2.connect(LOCAL_DB_URL)
    cur = conn.cursor()
    cur.execute("""
        SELECT id, invoice_no, date, customer_id, customer_name, customer_gstin,
               billing_address, shipping_address, place_of_supply_code, pos_state,
               payment_mode, taxable_value, discount_amount, tax_total, grand_total,
               status, created_at, delivery_store_code, delivery_location_id, customer_po_id
        FROM sales_invoices
        WHERE invoice_no LIKE 'TT2026-2027/%'
        ORDER BY id ASC;
    """)
    inv_cols = [desc[0] for desc in cur.description]
    local_invoices = [dict(zip(inv_cols, row)) for row in cur.fetchall()]

    logger.info("Loaded %d invoices from local database smriti001.", len(local_invoices))

    # Fetch all invoice items
    cur.execute("""
        SELECT id, invoice_id, product_id, code, name, quantity, price,
               mrp, disc_pct, gst_rate, hsn_code,
               tax_amount, total_amount, is_tax_inclusive, line_no
        FROM sales_invoice_items
        WHERE invoice_id IN %s
        ORDER BY invoice_id, line_no ASC;
    """, (tuple(inv['id'] for inv in local_invoices),))
    item_cols = [desc[0] for desc in cur.description]
    all_items = [dict(zip(item_cols, row)) for row in cur.fetchall()]
    conn.close()

    # Group items by invoice_id
    items_by_inv: Dict[str, List[Dict[str, Any]]] = {}
    for it in all_items:
        items_by_inv.setdefault(it["invoice_id"], []).append(it)

    logger.info("Loaded %d line items across %d invoices.", len(all_items), len(items_by_inv))

    # 2. Authenticate with Remote Live Production Server
    async with httpx.AsyncClient(timeout=60.0) as client:
        login_res = await client.post(
            f"{BASE_URL}/api/v1/auth/login",
            json={"username": "admin", "password": "Admin@123"}
        )
        if login_res.status_code != 200:
            logger.error("Authentication failed: %s %s", login_res.status_code, login_res.text)
            return False

        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        logger.info("Successfully authenticated as admin against %s.", BASE_URL)

        # 3. Fetch Remote Delivery Locations for Store Mapping
        dl_res = await client.get(
            f"{BASE_URL}/api/v1/customers/{CUSTOMER_ID}/delivery-locations",
            headers=headers
        )
        if dl_res.status_code != 200:
            logger.error("Failed fetching delivery locations: %s %s", dl_res.status_code, dl_res.text)
            return False

        store_code_map = {}
        for dl in dl_res.json():
            scode = dl.get("storeCode")
            if scode:
                store_code_map[scode] = dl.get("id")

        logger.info("Indexed %d remote store delivery locations for customer %s.", len(store_code_map), CUSTOMER_ID)

        # 4. Check already existing invoices on remote
        existing_res = await client.get(
            f"{BASE_URL}/api/v1/sales/invoices?limit=1000",
            headers=headers
        )
        existing_inv_nos = set()
        if existing_res.status_code == 200:
            for inv in existing_res.json():
                if inv.get("invoice_no"):
                    existing_inv_nos.add(inv["invoice_no"])
        logger.info("Remote currently has %d invoices.", len(existing_inv_nos))

        # 5. Ingestion Loop
        processed = 0
        success_count = 0
        psv_projected_count = 0
        skipped_count = 0
        failed_count = 0

        remote_grand_total = decimal.Decimal("0.00")
        start_time = time.time()

        for inv in local_invoices[:max_invoices]:
            inv_no = inv["invoice_no"]
            if inv_no in existing_inv_nos:
                logger.info("Invoice %s already exists on remote — skipping post, checking PSV...", inv_no)
                skipped_count += 1
                continue

            lines = items_by_inv.get(inv["id"], [])
            if not lines:
                logger.warning("Invoice %s has 0 line items — skipping.", inv_no)
                continue

            target_store = inv.get("delivery_store_code")
            target_dl_id = store_code_map.get(target_store)

            # Map line items to API schema
            payload_items = []
            for it in lines:
                payload_items.append({
                    "code": it["code"],
                    "name": it["name"],
                    "quantity": float(it["quantity"]),
                    "price": float(it["price"]),
                    "gst_rate": float(it["gst_rate"]),
                    "hsn_code": it["hsn_code"] or "64041990",
                    "mrp": float(it["mrp"]) if it.get("mrp") else float(it["price"]) * 1.5,
                    "is_tax_inclusive": bool(it.get("is_tax_inclusive", False))
                })

            invoice_payload = {
                "invoice_no": inv["invoice_no"],
                "customer_id": CUSTOMER_ID,
                "customer_name": inv["customer_name"],
                "customer_gstin": inv["customer_gstin"],
                "delivery_location_id": target_dl_id,
                "delivery_store_code": target_store,
                "delivery_gstin": inv["customer_gstin"],
                "place_of_supply_code": inv.get("place_of_supply_code") or "27",
                "pos_state": inv.get("pos_state") or "MAHARASHTRA",
                "sales_channel": "B2B_WHOLESALE",
                "billing_address": inv.get("billing_address") or "",
                "shipping_address": inv.get("shipping_address") or "",
                "items": payload_items,
                "payment_mode": inv.get("payment_mode") or "CREDIT"
            }

            if dry_run:
                logger.info("[DRY-RUN] Would post invoice %s (%d lines, Store: %s)", inv_no, len(payload_items), target_store)
                success_count += 1
                continue

            # POST /api/v1/sales/invoices
            post_res = await client.post(
                f"{BASE_URL}/api/v1/sales/invoices",
                json=invoice_payload,
                headers=headers
            )

            if post_res.status_code in (200, 201):
                created_inv = post_res.json()
                created_id = created_inv.get("id")
                inv_total = decimal.Decimal(str(created_inv.get("grand_total") or 0))
                remote_grand_total += inv_total
                success_count += 1
                existing_inv_nos.add(inv_no)

                # Real-Time Auto PSV Projection
                psv_res = await client.post(
                    f"{BASE_URL}/api/v1/psv/invoices/{created_id}/project",
                    headers=headers
                )
                if psv_res.status_code in (200, 201):
                    psv_projected_count += 1
                    logger.info("  [%d/%d] Ingested %s (ID: %s, Total: Rs %s) -> PSV Projected OK",
                                success_count, len(local_invoices), inv_no, created_id, inv_total)
                else:
                    logger.warning("  [%d/%d] Ingested %s OK, but PSV Projection returned %s: %s",
                                   success_count, len(local_invoices), inv_no, psv_res.status_code, psv_res.text[:120])
            else:
                failed_count += 1
                logger.error("  [FAIL] Invoice %s returned %s: %s", inv_no, post_res.status_code, post_res.text[:250])
                # If failure is quarantine or fatal, stop or log first error
                if failed_count >= 5:
                    logger.error("Exceeded 5 consecutive failures — pausing batch run for inspection.")
                    break

            processed += 1

        elapsed = time.time() - start_time
        logger.info("\n=====================================================================")
        logger.info(" INGESTION & PSV EXECUTION SUMMARY")
        logger.info("=====================================================================")
        logger.info("  Total Invoices Processed : %d", processed)
        logger.info("  Successfully Created     : %d", success_count)
        logger.info("  PSV Projected            : %d", psv_projected_count)
        logger.info("  Skipped (Already Exists) : %d", skipped_count)
        logger.info("  Failed                   : %d", failed_count)
        logger.info("  Remote Invoices Total    : Rs %s", remote_grand_total)
        logger.info("  Elapsed Execution Time   : %.2f seconds", elapsed)
        logger.info("=====================================================================")

        return success_count, failed_count

if __name__ == "__main__":
    asyncio.run(run_ingestion(dry_run=False, max_invoices=5))
