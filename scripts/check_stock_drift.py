"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.99.1
Created      : 2026-10-21
Modified     : 2026-10-21
Copyright    : (C) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: CLI / Scheduled Stock Drift Detection Guard
"""

import argparse
import asyncio
import logging
import sys
from pathlib import Path

# Add repo root and backend to sys.path
REPO_ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR = REPO_ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Ensure UTF-8 stdout on Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from sqlalchemy import select
from app.db.session import get_company_sessionmaker, async_session
from app.models.tenant import Company
from app.services.stock_synchronizer import StockSynchronizer

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("smriti.drift_check")


async def run_stock_drift_check(auto_repair: bool = False, target_company_id: str | None = None) -> int:
    """
    Scans registered companies and runs detect_stock_drift.
    Logs and alerts on any non-zero drift.
    Does NOT auto-repair by default.
    """
    logger.info("=== SMRITI STOCK DRIFT DETECTION JOB STARTED ===")
    logger.info(f"Auto-repair enabled: {auto_repair}")

    async with async_session() as session:
        if target_company_id:
            query = select(Company).where(Company.id == target_company_id, Company.is_deleted == False)
        else:
            query = select(Company).where(Company.is_deleted == False, Company.is_active == True)
        companies_res = await session.execute(query)
        companies = companies_res.scalars().all()

    if not companies:
        logger.warning("No active companies found for drift checking.")
        return 0

    total_drifts = 0
    drift_details = []

    for company in companies:
        company_id = company.id
        logger.info(f"Auditing company: {company_id} ({company.name})...")
        try:
            db_sessionmaker = get_company_sessionmaker(company_id)
            async with db_sessionmaker() as comp_session:
                if auto_repair:
                    summary = await StockSynchronizer.reconcile_and_repair_drift(
                        session=comp_session,
                        company_id=company_id,
                        fix_drift=True,
                        commit=True,
                    )
                    if summary.drift_count > 0:
                        logger.warning(
                            f"Company {company_id}: Repaired {summary.repaired_count} drifted products."
                        )
                else:
                    drifts = await StockSynchronizer.detect_stock_drift(
                        session=comp_session,
                        company_id=company_id,
                    )
                    if drifts:
                        total_drifts += len(drifts)
                        for d in drifts:
                            msg = (
                                f"[DRIFT DETECTED] Company={company_id} Product={d.product_id} "
                                f"SKU={d.sku} Name='{d.product_name}' "
                                f"Cached={d.cached_stock} Authoritative={d.authoritative_stock} "
                                f"Drift={d.drift:+.2f} ({d.status}, SOT={d.source_of_truth})"
                            )
                            logger.error(msg)
                            drift_details.append(msg)
                    else:
                        logger.info(f"Company {company_id}: 0 drifts detected (BALANCED).")
        except Exception as ex:
            logger.exception(f"Error auditing company {company_id}: {ex}")

    logger.info("=== SMRITI STOCK DRIFT DETECTION JOB COMPLETED ===")
    if total_drifts > 0:
        logger.error(f"FAILURE: Total of {total_drifts} drifted products detected!")
        return 1

    logger.info("SUCCESS: Zero stock drift detected across all audited companies.")
    return 0


def main():
    parser = argparse.ArgumentParser(description="SMRITI Stock Drift Detection CLI")
    parser.add_argument("--auto-repair", action="store_true", default=False, help="Automatically repair detected drift")
    parser.add_argument("--company-id", type=str, default=None, help="Target specific company ID")
    args = parser.parse_args()

    exit_code = asyncio.run(run_stock_drift_check(auto_repair=args.auto_repair, target_company_id=args.company_id))
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
