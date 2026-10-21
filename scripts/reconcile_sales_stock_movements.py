"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.99.2
Created      : 2026-10-21
Modified     : 2026-10-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Inventory Reconciliation Engine
"""

import argparse
import asyncio
import os
import sys
from decimal import Decimal
from typing import Dict, List, Optional, Set

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

# Ensure backend directory is in sys.path
backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from app.models.inventory import Product, Warehouse
from app.services.stock_ledger import MovementRequest, StockLedger


async def reconcile_unledgered_sales(
    db_url: str,
    company_id: Optional[str] = None,
    invoice_no: Optional[str] = None,
    apply: bool = False,
    allow_negative_stock: bool = True,
):
    print("=" * 80)
    print("SMRITI RETAIL OS: UNLEDGERED SALES STOCK RECONCILIATION ENGINE")
    print(f"Target DB     : {db_url}")
    print(f"Target Company: {company_id or 'ALL'}")
    print(f"Target Invoice: {invoice_no or 'ALL'}")
    print(f"Execution Mode: {'APPLY (COMMITTING LIVE MUTATIONS)' if apply else 'DRY RUN (AUDIT ONLY)'}")
    print("=" * 80)

    engine = create_async_engine(db_url, echo=False)
    async with AsyncSession(engine) as session:
        # 1. Fetch relevant submitted sales invoices
        query_sql = """
            SELECT id, invoice_no, company_id, branch_id, warehouse_id, status, created_at
            FROM sales_invoices
            WHERE is_deleted = false
              AND status NOT IN ('CANCELLED', 'DRAFT', 'DELETED')
        """
        params: Dict[str, str] = {}
        if company_id:
            query_sql += " AND company_id = :cid"
            params["cid"] = company_id
        if invoice_no:
            query_sql += " AND invoice_no = :inv_no"
            params["inv_no"] = invoice_no

        query_sql += " ORDER BY created_at ASC"

        res = await session.execute(text(query_sql), params)
        invoices = res.fetchall()

        print(f"Found {len(invoices)} active submitted invoices.")
        if not invoices:
            print("No invoices to evaluate.")
            return

        # Introspect sales_invoice_lines schema for column compatibility
        col_res = await session.execute(
            text("SELECT column_name FROM information_schema.columns WHERE table_name = 'sales_invoice_lines'")
        )
        line_cols = {r[0].lower() for r in col_res.fetchall()}
        has_pid = "product_id" in line_cols
        has_vid = "variant_id" in line_cols
        if has_pid and has_vid:
            pid_expr = "COALESCE(product_id, variant_id)"
        elif has_pid:
            pid_expr = "product_id"
        elif has_vid:
            pid_expr = "variant_id"
        else:
            pid_expr = "NULL"

        # Introspect stock_movements schema for idempotency_key support
        mv_col_res = await session.execute(
            text("SELECT column_name FROM information_schema.columns WHERE table_name = 'stock_movements'")
        )
        mv_cols = {r[0].lower() for r in mv_col_res.fetchall()}
        has_idem = "idempotency_key" in mv_cols
        idem_expr = "idempotency_key" if has_idem else "NULL AS idempotency_key"

        total_missing_movements = 0
        total_missing_quantity = Decimal("0")
        invoices_needing_reconciliation = 0

        for inv in invoices:
            inv_id = str(inv[0])
            inv_no = str(inv[1])
            inv_cid = str(inv[2])
            inv_branch = str(inv[3]) if inv[3] else None
            inv_wh = str(inv[4]) if inv[4] else None

            # Check existing OUTWARD_SALE stock movements for this invoice
            mv_res = await session.execute(
                text(f"""
                    SELECT id, product_id, batch, quantity, {idem_expr}
                    FROM stock_movements
                    WHERE reference_doc_type IN ('SALES_INVOICE', 'Sales Invoice', 'INV')
                      AND reference_doc_id = :inv_id
                      AND company_id = :cid
                      AND movement_type = 'OUTWARD_SALE'
                      AND is_deleted = false
                """),
                {"inv_id": inv_id, "cid": inv_cid},
            )
            existing_movements = mv_res.fetchall()
            existing_idem_keys: Set[str] = {
                str(r[4]) for r in existing_movements if r[4] is not None
            }

            # Fetch line items
            lines_res = await session.execute(
                text(f"""
                    SELECT id, {pid_expr} AS pid, sku, barcode, warehouse_id, batch_no, quantity
                    FROM sales_invoice_lines
                    WHERE invoice_id = :inv_id
                      AND is_deleted = false
                    ORDER BY line_no ASC
                """),
                {"inv_id": inv_id},
            )
            lines = lines_res.fetchall()
            if not lines:
                continue

            if not has_idem and len(existing_movements) >= len(lines):
                continue

            # Resolve default warehouse for company if invoice warehouse is empty
            effective_wh = inv_wh
            if not effective_wh:
                wh_res = await session.execute(
                    text("""
                        SELECT id FROM warehouses 
                        WHERE company_id = :cid AND is_active = true AND is_deleted = false 
                        ORDER BY is_central_godown DESC, created_at ASC 
                        LIMIT 1
                    """),
                    {"cid": inv_cid},
                )
                wh_row = wh_res.fetchone()
                if wh_row:
                    effective_wh = str(wh_row[0])

            movement_requests: List[MovementRequest] = []

            for line in lines:
                line_id = str(line[0])
                line_pid = str(line[1]) if line[1] else None
                line_sku = str(line[2]) if line[2] else None
                line_bc = str(line[3]) if line[3] else None
                line_wh = str(line[4]) if line[4] else effective_wh
                line_batch = str(line[5]) if line[5] else "DEFAULT"
                line_qty = Decimal(str(line[6]))

                # Resolve to authoritative Product.id
                resolved_product_id = None
                if line_pid:
                    # Check if line_pid directly matches a Product
                    p_res = await session.execute(
                        text("SELECT id FROM products WHERE id = :pid AND company_id = :cid AND is_deleted = false"),
                        {"pid": line_pid, "cid": inv_cid},
                    )
                    p_row = p_res.fetchone()
                    if p_row:
                        resolved_product_id = str(p_row[0])

                if not resolved_product_id:
                    # Fallback lookup by item_variant_id, sku, barcode in products
                    fb_res = await session.execute(
                        text("""
                            SELECT id FROM products 
                            WHERE (item_variant_id = :pid OR sku = :sku OR code = :sku OR code = :bc)
                              AND company_id = :cid AND is_deleted = false
                            LIMIT 1
                        """),
                        {"pid": line_pid, "sku": line_sku, "bc": line_bc, "cid": inv_cid},
                    )
                    fb_row = fb_res.fetchone()
                    if fb_row:
                        resolved_product_id = str(fb_row[0])

                if not resolved_product_id:
                    # Fallback lookup via canonical item_variants + legacy_id_mappings
                    c_res = await session.execute(
                        text("""
                            SELECT COALESCE(lim.legacy_id, p.id)
                            FROM item_variants v
                            LEFT JOIN legacy_id_mappings lim ON lim.canonical_id = v.id AND lim.entity_type = 'PRODUCT'
                            LEFT JOIN products p ON (p.item_variant_id = v.id OR p.sku = v.variant_sku OR p.code = v.variant_sku) AND p.company_id = :cid AND p.is_deleted = false
                            WHERE (v.id = :pid OR v.variant_sku = :sku OR v.barcode = :bc)
                              AND v.company_id = :cid
                            LIMIT 1
                        """),
                        {"pid": line_pid, "sku": line_sku, "bc": line_bc, "cid": inv_cid},
                    )
                    c_row = c_res.fetchone()
                    if c_row and c_row[0]:
                        resolved_product_id = str(c_row[0])

                if not resolved_product_id:
                    print(f"  WARNING: Could not resolve Product for line {line_id} (pid={line_pid}, sku={line_sku}, bc={line_bc}). Skipping.")
                    continue

                # Compute idempotency key and verify if already posted
                cand_key = StockLedger.compute_idempotency_key(
                    company_id=inv_cid,
                    reference_doc_type="SALES_INVOICE",
                    reference_doc_id=inv_id,
                    product_id=resolved_product_id,
                    batch_no=line_batch,
                    movement_type="OUTWARD_SALE",
                    line_ref=line_id,
                )
                if cand_key in existing_idem_keys:
                    continue

                total_missing_movements += 1
                total_missing_quantity += line_qty

                movement_requests.append(
                    MovementRequest(
                        company_id=inv_cid,
                        branch_id=inv_branch,
                        product_id=resolved_product_id,
                        movement_type="OUTWARD_SALE",
                        quantity=line_qty,
                        reference_doc_type="SALES_INVOICE",
                        reference_doc_id=inv_id,
                        warehouse_id=line_wh,
                        batch_no=line_batch,
                        line_ref=line_id,
                        remarks=f"Reconciliation: unledgered sale for invoice {inv_no}",
                        user="SYSTEM-RECONCILIATION",
                        source_module="SALES_RECONCILIATION",
                        allow_negative_stock=allow_negative_stock,
                    )
                )

            if movement_requests:
                invoices_needing_reconciliation += 1
                print(f"\n[UNLEDGERED] Invoice: {inv_no} (ID: {inv_id}) | Missing Lines: {len(movement_requests)} / {len(lines)}")

            if apply and movement_requests:
                try:
                    results = await StockLedger.post_many(session, movement_requests)
                    await session.commit()
                    print(f"  [POSTED] Successfully posted {len(results)} OUTWARD_SALE movements through Single Door.")
                except Exception as e:
                    await session.rollback()
                    print(f"  [FAILED] Error posting stock movements for {inv_no}: {e}")
            elif not apply and movement_requests:
                print(f"  [DRY RUN] Would post {len(movement_requests)} OUTWARD_SALE movements through Single Door.")

        print("\n" + "=" * 80)
        print("RECONCILIATION AUDIT SUMMARY")
        print("=" * 80)
        print(f"Invoices checked                : {len(invoices)}")
        print(f"Invoices needing reconciliation : {invoices_needing_reconciliation}")
        print(f"Total missing stock movements   : {total_missing_movements}")
        print(f"Total unledgered quantity       : {total_missing_quantity}")
        print(f"Status                          : {'COMPLETED (APPLIED)' if apply else 'AUDIT COMPLETE (DRY RUN)'}")
        print("=" * 80)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Reconcile unledgered sales stock movements.")
    parser.add_argument(
        "--db-url",
        default="postgresql+asyncpg://postgres:postgres@localhost:2781/smritisys",
        help="Asyncpg PostgreSQL database URL",
    )
    parser.add_argument("--company-id", default=None, help="Filter by Company ID")
    parser.add_argument("--invoice-no", default=None, help="Filter by specific Invoice Number")
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Execute mutations and commit to database (defaults to dry-run)",
    )
    args = parser.parse_args()

    asyncio.run(
        reconcile_unledgered_sales(
            db_url=args.db_url,
            company_id=args.company_id,
            invoice_no=args.invoice_no,
            apply=args.apply,
        )
    )
