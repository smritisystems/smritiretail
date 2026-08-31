"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.36.0
Created      : 2026-08-27
Modified     : 2026-08-27
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import argparse
import json
import os
import sys
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional
import psycopg2
from psycopg2.extras import RealDictCursor


REQUIRED_CONFIRMATION_TEXT = "CONFIRM_APPLY_HISTORICAL_STOCK_MOVEMENTS"


def decimal_serializer(obj):
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, (datetime, )):
        return obj.isoformat()
    raise TypeError(f"Type {type(obj)} not serializable")


def run_historical_stock_reconciliation(
    database: str = "smriti001",
    db_url: Optional[str] = None,
    source: str = "invoices",
    mode: str = "dry-run",
    apply_mode: bool = False,
    dry_run_report: Optional[str] = None,
    backup_file: Optional[str] = None,
    review_missing_mappings: Optional[str] = None,
    review_stock_impact: Optional[str] = None,
    confirm_historical_posting: Optional[str] = None,
    output_file: str = "reports/historical_stock_reconciliation.json",
    company_id: str = "COMP-001",
    branch_id: str = "MAIN",
) -> Dict[str, Any]:
    """
    Analyzes historical sales invoices and determines stock ledger reconciliation status.
    In dry-run mode (default), no changes are made to the database.
    In apply mode, strictly requires all 5 safety requirements:
      1. A successful dry-run report file with status COMPLETED
      2. A verified backup file existing on disk
      3. Explicit review confirmation of missing product mappings
      4. Explicit review confirmation of expected stock impact
      5. Exact operator confirmation text ('CONFIRM_APPLY_HISTORICAL_STOCK_MOVEMENTS')
    """
    is_apply = (mode == "apply" or apply_mode)

    if is_apply:
        # Guard 1: Successful dry-run report
        if not dry_run_report or not os.path.exists(dry_run_report):
            raise ValueError(
                f"CRITICAL GUARD 1/5: Apply mode requires a verified pre-existing dry-run report file. Provided: {dry_run_report}"
            )
        try:
            with open(dry_run_report, "r", encoding="utf-8") as f:
                report_data = json.load(f)
            if report_data.get("status") != "COMPLETED":
                raise ValueError("Dry-run report status is not COMPLETED.")
        except Exception as e:
            raise ValueError(f"CRITICAL GUARD 1/5: Failed to validate dry-run report: {e}")

        # Guard 2: Verified backup file
        if not backup_file or not os.path.exists(backup_file):
            raise ValueError(
                f"CRITICAL GUARD 2/5: Apply mode requires a verified pre-migration backup file that exists on disk. Provided: {backup_file}"
            )

        # Guard 3: Review of missing product mappings
        if review_missing_mappings != "CONFIRMED_REVIEWED":
            raise ValueError(
                "CRITICAL GUARD 3/5: Apply mode requires explicit flag '--review-missing-mappings CONFIRMED_REVIEWED'."
            )

        # Guard 4: Review of expected stock impact
        if review_stock_impact != "CONFIRMED_REVIEWED":
            raise ValueError(
                "CRITICAL GUARD 4/5: Apply mode requires explicit flag '--review-stock-impact CONFIRMED_REVIEWED'."
            )

        # Guard 5: Exact operator confirmation text
        if confirm_historical_posting != REQUIRED_CONFIRMATION_TEXT:
            raise ValueError(
                f"CRITICAL GUARD 5/5: Apply mode requires exact confirmation text: '--confirm-historical-posting {REQUIRED_CONFIRMATION_TEXT}'."
            )

    connection_url = db_url or f"postgresql://postgres:postgres@localhost:5432/{database}"
    print(f"Connecting to database '{database}' at {connection_url}...")

    conn = psycopg2.connect(connection_url)
    cur = conn.cursor(cursor_factory=RealDictCursor)

    # 1. Fetch all sales invoices and their items
    cur.execute("""
        SELECT
            i.id as invoice_id,
            i.invoice_no,
            i.date as invoice_date,
            i.company_id,
            i.branch_id,
            i.customer_name,
            i.grand_total,
            i.tax_total,
            i.status,
            i.source_type,
            it.id as item_id,
            it.product_id,
            it.code as item_code,
            it.name as item_name,
            it.quantity,
            it.price,
            it.tax_amount,
            it.total_amount,
            it.gst_rate
        FROM sales_invoices i
        JOIN sales_invoice_items it ON it.invoice_id = i.id
        WHERE i.is_deleted = false
          AND (i.company_id = %s OR i.company_id IS NULL)
          AND (i.branch_id = %s OR i.branch_id IS NULL)
        ORDER BY i.date ASC, i.invoice_no ASC, it.id ASC;
    """, (company_id, branch_id))
    invoice_rows = cur.fetchall()

    # 2. Fetch existing stock movements referencing sales invoices
    cur.execute("""
        SELECT
            id,
            product_id,
            sku,
            quantity,
            movement_type,
            reference_doc_type,
            reference_doc_id,
            company_id,
            branch_id
        FROM stock_movements
        WHERE reference_doc_type IN ('Sales Invoice', 'SALES_INVOICE', 'Sales', 'SALE')
           OR movement_type IN ('OUTWARD_SALE', 'SALES_OUTWARD', 'SALE');
    """)
    existing_movements = cur.fetchall()

    # Index existing movements by (reference_doc_id, product_id/sku)
    existing_by_invoice: Dict[str, List[Dict[str, Any]]] = {}
    for m in existing_movements:
        doc_id = str(m.get("reference_doc_id") or "").strip()
        if doc_id:
            existing_by_invoice.setdefault(doc_id, []).append(dict(m))

    # 3. Fetch product master to check tracking mode and current stock
    cur.execute("""
        SELECT
            id,
            code,
            sku,
            name,
            stock,
            tracking_mode,
            company_id,
            branch_id
        FROM products
        WHERE is_deleted = false;
    """)
    products_list = cur.fetchall()
    products_by_id = {p["id"]: p for p in products_list}
    products_by_code = {p["code"]: p for p in products_list if p.get("code")}

    invoices_seen = set()
    invoices_analyzed = 0
    lines_analyzed = 0
    already_matched = []
    would_create = []
    skipped = []
    duplicate_risk = []
    missing_products = []
    stock_impact_by_product: Dict[str, Dict[str, Any]] = {}

    for row in invoice_rows:
        inv_no = row["invoice_no"]
        inv_id = row["invoice_id"]
        if inv_no not in invoices_seen:
            invoices_seen.add(inv_no)
            invoices_analyzed += 1
        lines_analyzed += 1

        p_id = row["product_id"]
        p_code = row["item_code"]
        qty = Decimal(str(row["quantity"] or "0.0000"))

        product = products_by_id.get(p_id) or products_by_code.get(p_code)

        if not product:
            missing_products.append({
                "invoice_no": inv_no,
                "invoice_id": inv_id,
                "product_id": p_id,
                "item_code": p_code,
                "item_name": row["item_name"],
                "quantity": qty,
                "reason": "Product ID/code not found in products table (unmapped legacy SKU)"
            })
            continue

        if product.get("tracking_mode") == "No-stock":
            skipped.append({
                "invoice_no": inv_no,
                "invoice_id": inv_id,
                "product_code": product["code"],
                "product_name": product["name"],
                "quantity": qty,
                "reason": "Product tracking_mode is No-stock"
            })
            continue

        # Check if already matched in stock_movements (by invoice ID or invoice number)
        inv_moves = existing_by_invoice.get(inv_id, []) or existing_by_invoice.get(inv_no, [])
        matching_move = None
        for m in inv_moves:
            m_pid = m.get("product_id")
            m_sku = m.get("sku")
            if m_pid == product["id"] or m_sku == product["code"] or m_sku == product.get("sku"):
                matching_move = m
                break

        if matching_move:
            # Check for quantity discrepancy
            move_qty = Decimal(str(matching_move.get("quantity") or "0"))
            if abs(move_qty - qty) > Decimal("0.0001"):
                duplicate_risk.append({
                    "invoice_no": inv_no,
                    "invoice_id": inv_id,
                    "movement_id": matching_move.get("id"),
                    "product_code": product["code"],
                    "invoice_quantity": qty,
                    "movement_quantity": move_qty,
                    "risk": "Quantity mismatch between invoice line and stock movement; manual review required to prevent double-deduction."
                })
            else:
                already_matched.append({
                    "invoice_no": inv_no,
                    "invoice_id": inv_id,
                    "movement_id": matching_move.get("id"),
                    "product_code": product["code"],
                    "quantity": qty,
                    "status": "MATCHED"
                })
        else:
            would_create.append({
                "invoice_no": inv_no,
                "invoice_id": inv_id,
                "product_id": product["id"],
                "product_code": product["code"],
                "product_name": product["name"],
                "quantity": qty,
                "movement_type": "OUTWARD_SALE",
                "reference_doc_type": "Sales Invoice",
                "reference_doc_id": inv_id,
                "remarks": f"Historical outward sale: {inv_no}",
                "company_id": row["company_id"] or company_id,
                "branch_id": row["branch_id"] or branch_id,
                "source_module": "HISTORICAL_IMPORT",
            })

            # Accumulate stock impact
            p_key = product["code"]
            if p_key not in stock_impact_by_product:
                stock_impact_by_product[p_key] = {
                    "product_id": product["id"],
                    "code": product["code"],
                    "name": product["name"],
                    "current_stock": Decimal(str(product.get("stock") or "0.0000")),
                    "pending_deduction_qty": Decimal("0.0000"),
                    "projected_stock": Decimal(str(product.get("stock") or "0.0000")),
                }
            stock_impact_by_product[p_key]["pending_deduction_qty"] += qty
            stock_impact_by_product[p_key]["projected_stock"] -= qty

    # 4. If in apply mode, insert movements with transaction safety and rollback on any failure
    inserted_count = 0
    if is_apply:
        try:
            print(f"Applying {len(would_create)} historical stock movements...")
            for wc in would_create:
                m_id = f"sm-hist-{uuid.uuid4().hex[:12]}"
                m_uuid = str(uuid.uuid4())
                cur.execute("""
                    INSERT INTO stock_movements (
                        id, uuid, product_id, product_name, sku, quantity, movement_type,
                        reference_doc_type, reference_doc_id, warehouse, remarks, source_module,
                        company_id, branch_id, created_at, modified_at, is_active, is_deleted, version
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s, %s,
                        %s, %s, 'Main Outlet Retail WH', %s, %s,
                        %s, %s, NOW(), NOW(), true, false, 1
                    );
                """, (
                    m_id, m_uuid, wc["product_id"], wc["product_name"], wc["product_code"],
                    wc["quantity"], wc["movement_type"], wc["reference_doc_type"], wc["reference_doc_id"],
                    wc["remarks"], wc["source_module"], wc["company_id"], wc["branch_id"]
                ))
                inserted_count += 1
            conn.commit()
            print(f"Successfully committed {inserted_count} historical movements.")
        except Exception as e:
            conn.rollback()
            conn.close()
            raise RuntimeError(f"Historical posting transaction failed and was rolled back: {e}")

    conn.close()

    result = {
        "status": "COMPLETED",
        "mode": "apply" if is_apply else "dry-run",
        "database": database,
        "source": source,
        "company_id": company_id,
        "branch_id": branch_id,
        "executed_at": datetime.now(timezone.utc).isoformat(),
        "summary": {
            "invoices_analyzed": invoices_analyzed,
            "invoice_lines_analyzed": lines_analyzed,
            "already_matched_movements": len(already_matched),
            "would_create_movements": len(would_create),
            "inserted_movements": inserted_count,
            "skipped_movements": len(skipped),
            "duplicate_risk_records": len(duplicate_risk),
            "missing_product_mappings": len(missing_products),
            "distinct_products_impacted": len(stock_impact_by_product),
        },
        "details": {
            "already_matched": already_matched,
            "would_create": would_create,
            "skipped": skipped,
            "duplicate_risk": duplicate_risk,
            "missing_products": missing_products,
            "stock_impact": list(stock_impact_by_product.values()),
        }
    }

    # Ensure output directory exists
    os.makedirs(os.path.dirname(output_file) or ".", exist_ok=True)
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, default=decimal_serializer)

    print("\n" + "=" * 60)
    print(f" SMRITI HISTORICAL STOCK RECONCILIATION ({('APPLY' if is_apply else 'DRY-RUN')})")
    print("=" * 60)
    print(f" Database                   : {database}")
    print(f" Invoices analyzed          : {invoices_analyzed}")
    print(f" Invoice lines analyzed     : {lines_analyzed}")
    print(f" Already matched movements  : {len(already_matched)}")
    print(f" Would-create movements     : {len(would_create)}")
    if is_apply:
        print(f" Inserted movements         : {inserted_count}")
    print(f" Skipped movements          : {len(skipped)}")
    print(f" Duplicate-risk records     : {len(duplicate_risk)}")
    print(f" Missing product mappings   : {len(missing_products)}")
    print(f" Distinct products impacted : {len(stock_impact_by_product)}")
    print(f" Report written to          : {output_file}")
    print("=" * 60 + "\n")

    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="SMRITI Historical Stock Reconciliation Engine")
    parser.add_argument("--database", default="smriti001", help="Database name (default: smriti001)")
    parser.add_argument("--db-url", default=None, help="Full database connection URL")
    parser.add_argument("--source", default="invoices", help="Source to reconcile (default: invoices)")
    parser.add_argument("--mode", default="dry-run", choices=["dry-run", "apply"], help="Execution mode (default: dry-run)")
    parser.add_argument("--apply", action="store_true", help="Execute actual insertion of historical movements")
    parser.add_argument("--dry-run-report", default=None, help="Path to verified pre-existing dry-run report")
    parser.add_argument("--backup-file", default=None, help="Path to verified pre-migration backup file")
    parser.add_argument("--review-missing-mappings", default=None, help="Review confirmation of missing product mappings (CONFIRMED_REVIEWED)")
    parser.add_argument("--review-stock-impact", default=None, help="Review confirmation of expected stock impact (CONFIRMED_REVIEWED)")
    parser.add_argument("--confirm-historical-posting", default=None, help="Operator confirmation text ('CONFIRM_APPLY_HISTORICAL_STOCK_MOVEMENTS')")
    parser.add_argument("--output", default="reports/historical_stock_reconciliation.json", help="Path to write JSON reconciliation report")
    parser.add_argument("--company-id", default="COMP-001", help="Company ID filter (default: COMP-001)")
    parser.add_argument("--branch-id", default="MAIN", help="Branch ID filter (default: MAIN)")

    args = parser.parse_args()
    run_historical_stock_reconciliation(
        database=args.database,
        db_url=args.db_url,
        source=args.source,
        mode=args.mode,
        apply_mode=args.apply,
        dry_run_report=args.dry_run_report,
        backup_file=args.backup_file,
        review_missing_mappings=args.review_missing_mappings,
        review_stock_impact=args.review_stock_impact,
        confirm_historical_posting=args.confirm_historical_posting,
        output_file=args.output,
        company_id=args.company_id,
        branch_id=args.branch_id,
    )
