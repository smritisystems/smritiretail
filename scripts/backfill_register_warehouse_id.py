"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.125.0
Created      : 2026-10-27
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

backfill_register_warehouse_id.py
One-time database backfill script for R-001 / R-004.
Reconciles legacy CashRegister.warehouse text codes to CashRegister.warehouse_id FKs.
"""

import os
import sys
import argparse
import asyncio
from typing import Optional

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKEND_DIR = os.path.join(REPO_ROOT, "backend")
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from sqlalchemy import select, or_, update
from app.db.session import get_company_sessionmaker
from app.models.pos import CashRegister
from app.models.inventory import Warehouse


async def backfill_registers(database_name: str, company_id: Optional[str] = None, dry_run: bool = True):
    print(f"=== SMRITI CashRegister Warehouse FK Backfill ===")
    print(f"Target Database : {database_name}")
    print(f"Company ID Scope: {company_id or 'ALL'}")
    print(f"Execution Mode  : {'DRY RUN (no changes committed)' if dry_run else 'LIVE COMMIT'}")
    print("-" * 50)

    session_factory = get_company_sessionmaker(database_name)
    async with session_factory() as session:
        stmt = select(CashRegister).where(
            CashRegister.warehouse_id.is_(None),
            CashRegister.warehouse.is_not(None),
            CashRegister.is_deleted == False,
        )
        if company_id:
            stmt = stmt.where(CashRegister.company_id == company_id)

        res = await session.execute(stmt)
        registers = res.scalars().all()
        print(f"Found {len(registers)} registers with NULL warehouse_id and populated warehouse code.")

        matched_count = 0
        unmatched_count = 0

        for reg in registers:
            wh_code = reg.warehouse.strip() if reg.warehouse else ""
            if not wh_code:
                continue

            wh_stmt = select(Warehouse).where(
                Warehouse.company_id == reg.company_id,
                Warehouse.is_deleted == False,
                or_(Warehouse.code == wh_code, Warehouse.id == wh_code)
            )
            wh_res = await session.execute(wh_stmt)
            warehouse = wh_res.scalars().first()

            if warehouse:
                matched_count += 1
                print(f"  [MATCH] Register '{reg.id}' ('{reg.name}') [Company: {reg.company_id}]: '{wh_code}' -> Warehouse ID '{warehouse.id}' ('{warehouse.name}')")
                if not dry_run:
                    reg.warehouse_id = warehouse.id
            else:
                unmatched_count += 1
                print(f"  [WARN] Register '{reg.id}' ('{reg.name}') [Company: {reg.company_id}]: No active warehouse matches code '{wh_code}'")

        if not dry_run and matched_count > 0:
            await session.commit()
            print(f"\nSuccessfully committed {matched_count} warehouse_id FK updates.")
        elif dry_run:
            print(f"\nDry run complete. {matched_count} registers would be updated; {unmatched_count} unresolvable.")


def main():
    parser = argparse.ArgumentParser(description="Backfill CashRegister warehouse_id FK from legacy warehouse text code.")
    parser.add_argument("--database", "-d", default="smriti001", help="Target company database name (default: smriti001)")
    parser.add_argument("--company-id", "-c", default=None, help="Optional company_id filter")
    parser.add_argument("--commit", action="store_true", help="Execute live commit (default is dry-run)")
    args = parser.parse_args()

    asyncio.run(backfill_registers(
        database_name=args.database,
        company_id=args.company_id,
        dry_run=not args.commit,
    ))


if __name__ == "__main__":
    main()
