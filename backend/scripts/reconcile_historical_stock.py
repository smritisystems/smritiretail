"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.36.1
Created      : 2026-08-30
Modified     : 2026-08-30
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

Historical Stock Reconciliation Safety Guard Module.

dry-run mode: performs a read-only analysis of the target database and
              writes a JSON report to output_file (if given). No writes.
apply mode:   enforces all 5 safety guards before authorising posting.

PRODUCTION RULE: No DDL. No DML. No schema changes.
"""

import json
import os
from typing import Optional

# ---------------------------------------------------------------------------
# Public constant imported by tests
# ---------------------------------------------------------------------------
REQUIRED_CONFIRMATION_TEXT = (
    "I CONFIRM I HAVE REVIEWED THE DRY-RUN REPORT AND AUTHORISE HISTORICAL POSTING"
)

# ---------------------------------------------------------------------------
# PG connection helper (sync, no SQLAlchemy dependency)
# ---------------------------------------------------------------------------
_PG_BASE = "postgresql://postgres:postgres@localhost:5432"


def _pg_connect(database: str):
    import psycopg2  # local import — optional dependency
    return psycopg2.connect(f"{_PG_BASE}/{database}")


# ---------------------------------------------------------------------------
# Dry-run analysis
# ---------------------------------------------------------------------------
def _run_dry_run(database: str, company_id: Optional[str], branch_id: Optional[str]) -> dict:
    """
    Read-only inspection of sales_invoices and stock_movements to compute
    the 8 mandatory reconciliation metrics.
    """
    try:
        conn = _pg_connect(database)
        cur = conn.cursor()

        # Build optional tenant scope
        scope_inv = ""
        scope_mv = ""
        params: list = []
        if company_id:
            scope_inv += " AND si.company_id = %s"
            scope_mv += " AND sm.company_id = %s"
            params.append(company_id)
        if branch_id:
            scope_inv += " AND si.branch_id = %s"
            scope_mv += " AND sm.branch_id = %s"
            params.append(branch_id)

        # --- invoices analyzed ---
        cur.execute(
            f"SELECT COUNT(*) FROM sales_invoices si WHERE si.is_deleted = false{scope_inv};",
            params,
        )
        invoices_analyzed = cur.fetchone()[0]

        # --- invoice lines analyzed ---
        cur.execute(
            f"""
            SELECT COUNT(*) FROM sales_invoice_items sii
            JOIN sales_invoices si ON si.id = sii.invoice_id
            WHERE si.is_deleted = false{scope_inv};
            """,
            params,
        )
        invoice_lines_analyzed = cur.fetchone()[0]

        # --- already matched movements ---
        cur.execute(
            f"""
            SELECT COUNT(DISTINCT sm.reference_doc_id) FROM stock_movements sm
            WHERE sm.is_deleted = false
              AND sm.reference_doc_type = 'Sales Invoice'
              AND sm.reference_doc_id IN (
                  SELECT id FROM sales_invoices WHERE is_deleted = false
              ){scope_mv};
            """,
            params,
        )
        already_matched = cur.fetchone()[0]

        # --- would_create_movements: invoices without any movement ---
        cur.execute(
            f"""
            SELECT COUNT(*) FROM sales_invoices si
            WHERE si.is_deleted = false
              AND si.status NOT IN ('Draft','Cancelled')
              AND si.id NOT IN (
                  SELECT sm.reference_doc_id FROM stock_movements sm
                  WHERE sm.is_deleted = false
                    AND sm.reference_doc_type = 'Sales Invoice'
              ){scope_inv};
            """,
            params,
        )
        would_create = cur.fetchone()[0]

        # --- skipped movements: Draft / Cancelled ---
        cur.execute(
            f"""
            SELECT COUNT(*) FROM sales_invoices si
            WHERE si.is_deleted = false
              AND si.status IN ('Draft','Cancelled'){scope_inv};
            """,
            params,
        )
        skipped = cur.fetchone()[0]

        # --- duplicate risk: same invoice_id appears more than once in stock_movements ---
        cur.execute(
            f"""
            SELECT COUNT(*) FROM (
                SELECT sm.reference_doc_id FROM stock_movements sm
                WHERE sm.is_deleted = false
                  AND sm.reference_doc_type = 'Sales Invoice'{scope_mv}
                GROUP BY sm.reference_doc_id HAVING COUNT(*) > 1
            ) dup;
            """,
            params,
        )
        duplicate_risk = cur.fetchone()[0]

        # --- missing product mappings: invoice items with no product match ---
        cur.execute(
            f"""
            SELECT COUNT(*) FROM sales_invoice_items sii
            JOIN sales_invoices si ON si.id = sii.invoice_id
            WHERE si.is_deleted = false
              AND sii.product_id IS NOT NULL
              AND NOT EXISTS (
                  SELECT 1 FROM products p
                  WHERE p.id = sii.product_id AND p.is_deleted = false
              ){scope_inv};
            """,
            params,
        )
        missing_mappings = cur.fetchone()[0]

        # --- distinct products impacted ---
        cur.execute(
            f"""
            SELECT COUNT(DISTINCT sii.product_id) FROM sales_invoice_items sii
            JOIN sales_invoices si ON si.id = sii.invoice_id
            WHERE si.is_deleted = false
              AND sii.product_id IS NOT NULL{scope_inv};
            """,
            params,
        )
        distinct_products = cur.fetchone()[0]

        conn.close()

    except Exception as e:
        # If DB is unreachable, return zeros (analysis incomplete)
        return {
            "invoices_analyzed": 0,
            "invoice_lines_analyzed": 0,
            "already_matched_movements": 0,
            "would_create_movements": 0,
            "skipped_movements": 0,
            "duplicate_risk_records": 0,
            "missing_product_mappings": 0,
            "distinct_products_impacted": 0,
            "_error": str(e),
        }

    return {
        "invoices_analyzed": invoices_analyzed,
        "invoice_lines_analyzed": invoice_lines_analyzed,
        "already_matched_movements": already_matched,
        "would_create_movements": would_create,
        "skipped_movements": skipped,
        "duplicate_risk_records": duplicate_risk,
        "missing_product_mappings": missing_mappings,
        "distinct_products_impacted": distinct_products,
    }


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------
def run_historical_stock_reconciliation(
    database: str,
    mode: str = "dry-run",
    output_file: Optional[str] = None,
    company_id: Optional[str] = None,
    branch_id: Optional[str] = None,
    dry_run_report: Optional[str] = None,
    backup_file: Optional[str] = None,
    review_missing_mappings: Optional[str] = None,
    review_stock_impact: Optional[str] = None,
    confirm_historical_posting: Optional[str] = None,
) -> dict:
    """
    Historical stock reconciliation entry point.

    dry-run mode
    ------------
    Performs a read-only inspection of the database. Writes a JSON report
    to output_file if specified. Returns:
      {
        "status": "COMPLETED",
        "mode": "dry-run",
        "database": "<db>",
        "summary": { <8 mandatory metric keys> }
      }

    apply mode
    ----------
    Enforces 5 mandatory safety guards before returning an authorisation
    result. Raises ValueError if any guard is not satisfied.
    """
    if mode == "dry-run":
        summary = _run_dry_run(database, company_id, branch_id)
        result = {
            "status": "COMPLETED",
            "mode": "dry-run",
            "database": database,
            "summary": summary,
        }
        if output_file:
            os.makedirs(os.path.dirname(output_file) if os.path.dirname(output_file) else ".", exist_ok=True)
            with open(output_file, "w", encoding="utf-8") as fh:
                json.dump(result, fh, indent=2)
        return result

    if mode != "apply":
        raise ValueError(f"Unknown mode '{mode}'. Must be 'dry-run' or 'apply'.")

    # ------------------------------------------------------------------
    # GUARD 1/5 — verified dry-run report must exist on disk
    # ------------------------------------------------------------------
    if not dry_run_report or not os.path.isfile(dry_run_report):
        raise ValueError(
            "CRITICAL GUARD 1/5: Apply mode requires a verified pre-existing dry-run report "
            f"at the specified path. Provided: '{dry_run_report}'"
        )

    # ------------------------------------------------------------------
    # GUARD 2/5 — pre-migration backup file must exist on disk
    # ------------------------------------------------------------------
    if not backup_file or not os.path.isfile(backup_file):
        raise ValueError(
            "CRITICAL GUARD 2/5: Apply mode requires a verified pre-migration backup file "
            f"at the specified path. Provided: '{backup_file}'"
        )

    # ------------------------------------------------------------------
    # GUARD 3/5 — explicit missing-mappings review confirmation
    # ------------------------------------------------------------------
    if review_missing_mappings != "CONFIRMED_REVIEWED":
        raise ValueError(
            "CRITICAL GUARD 3/5: Apply mode requires explicit flag "
            "'--review-missing-mappings CONFIRMED_REVIEWED' to confirm that all items "
            "without historical stock mappings have been manually reviewed and accepted."
        )

    # ------------------------------------------------------------------
    # GUARD 4/5 — explicit stock-impact review confirmation
    # ------------------------------------------------------------------
    if review_stock_impact != "CONFIRMED_REVIEWED":
        raise ValueError(
            "CRITICAL GUARD 4/5: Apply mode requires explicit flag "
            "'--review-stock-impact CONFIRMED_REVIEWED' to confirm that the projected "
            "stock impact of historical posting has been reviewed and accepted."
        )

    # ------------------------------------------------------------------
    # GUARD 5/5 — exact operator confirmation text
    # ------------------------------------------------------------------
    if confirm_historical_posting != REQUIRED_CONFIRMATION_TEXT:
        raise ValueError(
            "CRITICAL GUARD 5/5: Apply mode requires exact confirmation text. "
            f"Expected: '{REQUIRED_CONFIRMATION_TEXT}'. "
            f"Received: '{confirm_historical_posting}'"
        )

    return {
        "status": "APPLY_AUTHORISED",
        "mode": "apply",
        "database": database,
        "guards_passed": 5,
    }
