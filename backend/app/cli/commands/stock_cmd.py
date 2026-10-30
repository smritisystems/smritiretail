#  Project      : SMRITI Retail OS
#  Author       : Jawahar Ramkripal Mallah
#  Designation  : Chief Systems Architect & Creator
#  Email        : support@smritibooks.com
#  Websites     : smritibooks.com | erpnbook.com | aitdl.com
#  Version      : 6.99.0
#  Created      : 2026-10-20
#  Modified     : 2026-10-20
#  Copyright    : © SMRITIBooks.com. All Rights Reserved.
#  License      : Proprietary Commercial Software
#  Classification: Unified SMRITI CLI Stock Audit & Reconciliation Command

import argparse
import asyncio
import sys
from typing import Dict, Any, List

from app.cli.utils import output_result


def register_subparser(subparsers: argparse._SubParsersAction) -> None:
    parser = subparsers.add_parser(
        "stock",
        help="Stock movement invariant validation, discrepancy detection, and historical reconciliation.",
        description="Audits all inventory transactions across 9 discrepancy taxonomies without modifying live data."
    )
    stock_sub = parser.add_subparsers(dest="stock_action", required=True)

    # reconcile sub-action
    rec_parser = stock_sub.add_parser(
        "reconcile",
        help="Run read-only stock movement reconciliation and invariant audit."
    )
    rec_parser.add_argument(
        "--company",
        default="CMP-20260711-000001",
        help="Target company ID (default: CMP-20260711-000001)"
    )
    rec_parser.add_argument(
        "--warehouse",
        default=None,
        help="Optional target warehouse ID"
    )
    rec_parser.add_argument(
        "--sku",
        default=None,
        help="Filter by SKU or product code"
    )
    rec_parser.add_argument(
        "--limit",
        type=int,
        default=500,
        help="Maximum products to audit (default: 500)"
    )
    rec_parser.add_argument(
        "--json",
        action="store_true",
        dest="as_json",
        help="Output structured JSON results."
    )

    # proposal sub-action
    prop_parser = stock_sub.add_parser(
        "proposal",
        help="Generate read-only historical stock correction proposal."
    )
    prop_parser.add_argument(
        "--company",
        default="CMP-20260711-000001",
        help="Target company ID (default: CMP-20260711-000001)"
    )
    prop_parser.add_argument(
        "--warehouse",
        default=None,
        help="Optional target warehouse ID"
    )
    prop_parser.add_argument(
        "--limit",
        type=int,
        default=500,
        help="Maximum products to evaluate (default: 500)"
    )
    prop_parser.add_argument(
        "--json",
        action="store_true",
        dest="as_json",
        help="Output structured JSON results."
    )

    parser.set_defaults(func=run_stock_cmd)


def run_stock_cmd(args: argparse.Namespace) -> int:
    action = getattr(args, "stock_action", None)
    if action == "reconcile":
        return run_stock_reconcile(args)
    elif action == "proposal":
        return run_stock_proposal(args)
    else:
        print(f"Unknown stock action: {action}", file=sys.stderr)
        return 1


async def _async_reconcile(company_id: str, warehouse_id: str | None, sku: str | None, limit: int):
    from app.db.session import async_session
    from app.services.stock_reconciliation_engine import StockReconciliationEngine
    async with async_session() as session:
        return await StockReconciliationEngine.run_reconciliation_audit(
            session=session,
            company_id=company_id,
            warehouse_id=warehouse_id,
            sku=sku,
            limit=limit,
        )


async def _async_proposal(company_id: str, warehouse_id: str | None, limit: int):
    from app.db.session import async_session
    from app.services.stock_reconciliation_engine import StockReconciliationEngine
    async with async_session() as session:
        report = await StockReconciliationEngine.run_reconciliation_audit(
            session=session,
            company_id=company_id,
            warehouse_id=warehouse_id,
            limit=limit,
        )
        return await StockReconciliationEngine.generate_correction_proposal(
            session=session,
            company_id=company_id,
            audit_report=report,
        )


def run_stock_reconcile(args: argparse.Namespace) -> int:
    company_id = getattr(args, "company", "CMP-20260711-000001")
    warehouse_id = getattr(args, "warehouse", None)
    sku = getattr(args, "sku", None)
    limit = getattr(args, "limit", 500)
    as_json = getattr(args, "as_json", False)

    try:
        report = asyncio.run(_async_reconcile(company_id, warehouse_id, sku, limit))
    except Exception as exc:
        print(f"Error executing stock reconciliation: {exc}", file=sys.stderr)
        return 1

    def format_text(d: Dict[str, Any]) -> None:
        print("========================================================================")
        print(" SMRITI Retail OS — Stock Movement Validation & Reconciliation Audit")
        print("========================================================================")
        print(f" Audit ID                  : {d['audit_id']}")
        print(f" Generated At              : {d['generated_at']}")
        print(f" Target Company            : {d['company_id']}")
        print(f" Total Products Audited    : {d['total_products_audited']}")
        print(f" Balanced Products (Clean) : {d['balanced_products_count']}")
        print(f" Discrepancies Detected    : {d['discrepancy_count']}")
        print(f" Net Variance Units        : {d['total_variance_units']}")
        print("------------------------------------------------------------------------")
        print(" Discrepancies by Taxonomy:")
        for cat, count in d.get("discrepancies_by_category", {}).items():
            if count > 0:
                print(f"   * {cat:<28}: {count}")
        print("------------------------------------------------------------------------")
        print(" Severity Breakdown:")
        for sev, count in d.get("discrepancies_by_severity", {}).items():
            print(f"   * {sev:<10}: {count}")
        print("------------------------------------------------------------------------")

        discs = d.get("discrepancies", [])
        if discs:
            print(" Top Discrepancies:")
            for item in discs[:15]:
                print(f"   [{item['severity']}] {item['sku']} ({item['product_name'][:25]}):")
                print(f"       Category : {item['discrepancy_category']}")
                print(f"       Expected : {item['expected_closing_stock']} | Actual: {item['actual_ledger_stock']} | Cached: {item['cached_stock']} | Variance: {item['quantity_variance']}")
                print(f"       Cause    : {item['likely_root_cause']}")
                print(f"       Action   : {item['recommended_corrective_action']}")
        else:
            print(" [OK] All audited products strictly balance with zero inventory drift.")
        print("========================================================================")

    data = report.model_dump()
    output_result(data, as_json, format_text)
    return 0


def run_stock_proposal(args: argparse.Namespace) -> int:
    company_id = getattr(args, "company", "CMP-20260711-000001")
    warehouse_id = getattr(args, "warehouse", None)
    limit = getattr(args, "limit", 500)
    as_json = getattr(args, "as_json", False)

    try:
        plan = asyncio.run(_async_proposal(company_id, warehouse_id, limit))
    except Exception as exc:
        print(f"Error generating correction proposal: {exc}", file=sys.stderr)
        return 1

    def format_text(d: Dict[str, Any]) -> None:
        print("========================================================================")
        print(" SMRITI Retail OS — Proposed Historical Stock Correction Plan")
        print("========================================================================")
        print(f" Plan ID                   : {d['plan_id']}")
        print(f" Total Proposals Formulated: {d['total_proposals']}")
        print(f" Net Positive Delta Units  : +{d['net_positive_delta']}")
        print(f" Net Negative Delta Units  : -{d['net_negative_delta']}")
        print("------------------------------------------------------------------------")
        print(f" NOTICE: {d['authorization_notice']}")
        print("------------------------------------------------------------------------")
        for p in d.get("proposals", [])[:10]:
            print(f"   * [{p['correction_type']}] {p['sku']}: Before={p['before_stock']} -> After={p['proposed_after_stock']} (Delta={p['delta_stock']})")
            print(f"     Reason: {p['audit_trail_reason']}")
        print("========================================================================")

    data = plan.model_dump()
    output_result(data, as_json, format_text)
    return 0
