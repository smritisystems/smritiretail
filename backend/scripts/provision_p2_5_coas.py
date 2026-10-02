"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.49.4
Created      : 2026-10-02
Modified     : 2026-10-02
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import sys
import os
import uuid
import asyncio
import argparse
from typing import Dict, Any, List, Optional
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

# Ensure backend root is on sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import app.models
try:
    from app.models.customer_po import CustomerPurchaseOrder
except ImportError:
    pass
from sqlalchemy.orm import configure_mappers
configure_mappers()

from app.models.accounting import Account

CANONICAL_P2_5_COA_SPECS = {
    "2050": {
        "code": "2050",
        "name": "Customer Advance Liability",
        "type": "LIABILITY",
        "root": "LIABILITY",
        "is_group": False,
        "parent_code": "2000",
        "party_type": "CUSTOMER",
        "currency": "INR",
        "is_active": True,
        "is_system": True,
    },
    "2060": {
        "code": "2060",
        "name": "Customer Credit Note & Wallet Liability",
        "type": "LIABILITY",
        "root": "LIABILITY",
        "is_group": False,
        "parent_code": "2000",
        "party_type": "CUSTOMER",
        "currency": "INR",
        "is_active": True,
        "is_system": True,
    },
}


async def audit_company_coa_status(session: AsyncSession, company_id: str) -> Dict[str, Any]:
    """Audits the presence, definition, and integrity of 2000, 2050, and 2060 accounts for a company."""
    parent_2000 = (await session.execute(
        select(Account.id, Account.branch_id).where(
            Account.company_id == company_id,
            Account.account_code == "2000",
            Account.is_deleted == False
        )
    )).first()

    acc_2050 = (await session.execute(
        select(Account.id, Account.account_type, Account.root_type, Account.parent_account_id).where(
            Account.company_id == company_id,
            Account.account_code == "2050",
            Account.is_deleted == False
        )
    )).first()

    acc_2060 = (await session.execute(
        select(Account.id, Account.account_type, Account.root_type, Account.parent_account_id).where(
            Account.company_id == company_id,
            Account.account_code == "2060",
            Account.is_deleted == False
        )
    )).first()

    return {
        "company_id": company_id,
        "parent_2000_exists": parent_2000 is not None,
        "parent_2000_id": parent_2000.id if parent_2000 else None,
        "parent_2000_branch": parent_2000.branch_id if parent_2000 else None,
        "acc_2050_exists": acc_2050 is not None,
        "acc_2050_id": acc_2050.id if acc_2050 else None,
        "acc_2050_valid": (
            acc_2050 is not None
            and acc_2050.account_type == "LIABILITY"
            and acc_2050.root_type == "LIABILITY"
            and (parent_2000 is not None and acc_2050.parent_account_id == parent_2000.id)
        ),
        "acc_2060_exists": acc_2060 is not None,
        "acc_2060_id": acc_2060.id if acc_2060 else None,
        "acc_2060_valid": (
            acc_2060 is not None
            and acc_2060.account_type == "LIABILITY"
            and acc_2060.root_type == "LIABILITY"
            and (parent_2000 is not None and acc_2060.parent_account_id == parent_2000.id)
        ),
    }


async def provision_company_p2_5_coas(
    session: AsyncSession,
    company_id: str,
    dry_run: bool = False
) -> Dict[str, Any]:
    """
    Idempotently and atomically provisions canonical accounts 2050 and 2060 for a company.
    Enforces pessimistic row locking on parent 2000 and checks existing accounts before insertion.
    Rolls back automatically on failure; commits only when both accounts are safely established.
    """
    # 1. Pessimistic lock on Parent 2000 account to serialize concurrent provisioning
    stmt_parent = (
        select(Account.id, Account.branch_id)
        .where(
            Account.company_id == company_id,
            Account.account_code == "2000",
            Account.is_deleted == False
        )
        .with_for_update()
    )
    parent_2000 = (await session.execute(stmt_parent)).first()
    if not parent_2000:
        raise ValueError(
            f"Cannot provision 2050/2060 for company '{company_id}': "
            f"Parent liability group account '2000' does not exist."
        )

    created_accounts: List[str] = []
    already_existing: List[str] = []

    # 2. Check and stage each account
    for code, spec in CANONICAL_P2_5_COA_SPECS.items():
        stmt_existing = (
            select(Account.id, Account.account_type, Account.root_type, Account.parent_account_id)
            .where(
                Account.company_id == company_id,
                Account.account_code == code,
                Account.is_deleted == False
            )
            .with_for_update()
        )
        acc = (await session.execute(stmt_existing)).first()

        if acc:
            # Validate canonical compliance
            if (
                acc.account_type != spec["type"]
                or acc.root_type != spec["root"]
                or acc.parent_account_id != parent_2000.id
            ):
                raise ValueError(
                    f"Account '{code}' exists for company '{company_id}' but deviates from canonical specification: "
                    f"type={acc.account_type} (expected {spec['type']}), "
                    f"root={acc.root_type} (expected {spec['root']}), "
                    f"parent={acc.parent_account_id} (expected {parent_2000.id})"
                )
            already_existing.append(code)
        else:
            # Stage canonical account
            new_acc_id = f"acc_{code}_{company_id}"
            new_acc = Account(
                id=new_acc_id,
                uuid=str(uuid.uuid4()),
                company_id=company_id,
                branch_id=parent_2000.branch_id,
                account_code=code,
                account_name=spec["name"],
                account_type=spec["type"],
                root_type=spec["root"],
                parent_account_id=parent_2000.id,
                is_group=spec["is_group"],
                currency=spec["currency"],
                is_active=spec["is_active"],
                is_system=spec["is_system"],
                party_type=spec["party_type"],
                version=1,
            )
            session.add(new_acc)
            created_accounts.append(code)

    await session.flush()

    if not dry_run:
        await session.commit()
    else:
        await session.rollback()

    return {
        "company_id": company_id,
        "created": created_accounts,
        "already_existing": already_existing,
        "dry_run": dry_run,
        "parent_2000_id": parent_2000.id,
    }


async def main():
    parser = argparse.ArgumentParser(description="Provision canonical 2050 and 2060 COA accounts safely and idempotently.")
    parser.add_argument("--db-url", default=os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:2781/smriti001"), help="Target database URL")
    parser.add_argument("--company-id", default="COMP-001", help="Target company ID (default: COMP-001)")
    parser.add_argument("--all-with-coa", action="store_true", help="Provision all active companies that currently have Chart of Accounts")
    parser.add_argument("--dry-run", action="store_true", help="Simulate execution without committing changes")
    args = parser.parse_args()

    raw_url = args.db_url
    if raw_url.startswith("postgresql://"):
        db_url = raw_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    else:
        db_url = raw_url

    engine = create_async_engine(db_url, echo=False)
    session_factory = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    print(f"=== SMRITI P2.5 COA PROVISIONING ENGINE ===")
    print(f"Database URL : {args.db_url.split('@')[-1] if '@' in args.db_url else args.db_url}")
    print(f"Dry Run      : {args.dry_run}")

    async with session_factory() as session:
        # Determine target companies
        if args.all_with_coa:
            stmt_comps = select(Account.company_id).distinct().where(Account.is_deleted == False)
            target_company_ids = (await session.execute(stmt_comps)).scalars().all()
            print(f"Targeting ALL companies with existing COA ({len(target_company_ids)} companies)")
        else:
            target_company_ids = [args.company_id]
            print(f"Targeting single company: {args.company_id}")

        print("\n--- PRE-PROVISION AUDIT ---")
        for cid in target_company_ids:
            audit = await audit_company_coa_status(session, cid)
            print(
                f"Company {cid:<15} | Parent 2000: {'YES' if audit['parent_2000_exists'] else 'NO'} "
                f"| 2050: {'EXISTS' if audit['acc_2050_exists'] else 'MISSING'} "
                f"| 2060: {'EXISTS' if audit['acc_2060_exists'] else 'MISSING'}"
            )

        print("\n--- PROVISIONING EXECUTION ---")
        total_created = 0
        total_existing = 0
        for cid in target_company_ids:
            try:
                res = await provision_company_p2_5_coas(session, cid, dry_run=args.dry_run)
                print(f"Company {cid:<15} | Created: {res['created']} | Already Existing: {res['already_existing']}")
                total_created += len(res["created"])
                total_existing += len(res["already_existing"])
            except Exception as e:
                print(f"Company {cid:<15} | ERROR: {e}")

        print("\n--- POST-PROVISION AUDIT ---")
        for cid in target_company_ids:
            audit = await audit_company_coa_status(session, cid)
            status_2050 = "VALID" if audit["acc_2050_valid"] else ("INVALID" if audit["acc_2050_exists"] else "MISSING")
            status_2060 = "VALID" if audit["acc_2060_valid"] else ("INVALID" if audit["acc_2060_exists"] else "MISSING")
            print(
                f"Company {cid:<15} | Parent 2000: {audit['parent_2000_id']} "
                f"| 2050: {status_2050} ({audit['acc_2050_id']}) "
                f"| 2060: {status_2060} ({audit['acc_2060_id']})"
            )

        print(f"\nSummary: Total Created = {total_created}, Total Already Existing = {total_existing}")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
