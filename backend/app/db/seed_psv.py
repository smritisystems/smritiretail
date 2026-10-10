"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.10.0
Created      : 2026-08-22
Modified     : 2026-09-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
Source Module: PSV (Party Stock Visibility) Canonical Database Seeding

TENANT DATA BOUNDARY POLICY (Enforced):
    PSV data (distributor parties, SKU tracking) is TENANT-OPERATIONAL data.
    This seeder MUST NEVER write to smritisys (Control Plane).
    Tenant context is REQUIRED. Missing tenant context = FAIL CLOSED.
"""

import asyncio
import argparse
import os
import sys
from decimal import Decimal
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import (
    get_company_async_engine,
    validate_company_database_name,
    get_company_sessionmaker,
)
from app.db.seed_contract import seed_contract
from app.models.psv import PSVParty, PSVPartySkuTracking


# ---------------------------------------------------------------------------
# CANONICAL PSV SEED DATA — Tenant Operational
# ---------------------------------------------------------------------------
CANONICAL_PSV_PARTIES = [
    {
        "id": "PSV-BLR-01",
        "name": "Southern Distributor Hub",
        "location": "Bangalore Central",
        "stock_count": 84,
        "sell_through": Decimal("43.50"),
        "weeks_of_cover": Decimal("5.20"),
        "capital_locked": Decimal("129500.00"),
        "status": "Healthy",
        "skus": [
            {
                "sku": "TSHIRT-BLK-M",
                "invoiced_qty": 100,
                "confirmed_sold_qty": 65,
                "returned_qty": 5
            },
            {
                "sku": "JEANS-SLIM-32",
                "invoiced_qty": 80,
                "confirmed_sold_qty": 30,
                "returned_qty": 2
            }
        ]
    },
    {
        "id": "PSV-MUM-02",
        "name": "Western Mega Distribution",
        "location": "Mumbai - Bhiwandi Hub",
        "stock_count": 142,
        "sell_through": Decimal("68.20"),
        "weeks_of_cover": Decimal("3.80"),
        "capital_locked": Decimal("318000.00"),
        "status": "Healthy",
        "skus": [
            {
                "sku": "TSHIRT-WHT-L",
                "invoiced_qty": 200,
                "confirmed_sold_qty": 150,
                "returned_qty": 8
            },
            {
                "sku": "FORMAL-SHIRT-40",
                "invoiced_qty": 120,
                "confirmed_sold_qty": 70,
                "returned_qty": 4
            }
        ]
    },
    {
        "id": "PSV-DEL-03",
        "name": "Northern Regional Franchise Hub",
        "location": "Delhi NCR - Okhla",
        "stock_count": 210,
        "sell_through": Decimal("29.00"),
        "weeks_of_cover": Decimal("8.50"),
        "capital_locked": Decimal("485000.00"),
        "status": "Monitor",
        "skus": [
            {
                "sku": "SUIT-NAVY-42",
                "invoiced_qty": 150,
                "confirmed_sold_qty": 45,
                "returned_qty": 10
            },
            {
                "sku": "TROUSER-GRY-34",
                "invoiced_qty": 180,
                "confirmed_sold_qty": 50,
                "returned_qty": 8
            }
        ]
    }
]


def _resolve_tenant(cli_tenant: str | None) -> str:
    """
    Resolve tenant database name. Priority:
      1. --tenant CLI argument
      2. PSV_SEED_TENANT_DATABASE env var

    FAIL CLOSED: raises RuntimeError if no tenant is provided.
    NEVER falls back to smritisys.
    """
    raw = (cli_tenant or os.getenv("PSV_SEED_TENANT_DATABASE") or "").strip().lower()
    if not raw:
        raise RuntimeError(
            "TENANT DATA BOUNDARY VIOLATION: No tenant database specified.\n"
            "PSV seed data is tenant-operational and MUST target a registered company database.\n"
            "Usage: python seed_psv.py --tenant smriti001\n"
            "       PSV_SEED_TENANT_DATABASE=smriti001 python seed_psv.py"
        )
    if raw == "smritisys":
        raise RuntimeError(
            "TENANT DATA BOUNDARY VIOLATION: PSV seed data MUST NOT be written to smritisys.\n"
            "smritisys is the Control Plane. PSV distributor and SKU tracking data is tenant-operational.\n"
            "Specify a registered company database: --tenant smriti001"
        )
    if not validate_company_database_name(raw):
        raise RuntimeError(
            f"TENANT DATA BOUNDARY VIOLATION: '{raw}' is not a valid registered company database name.\n"
            "Expected format: smriti001..smriti999 (registered in Control Plane registry)."
        )
    return raw


async def seed_session(session: AsyncSession, db_name: str) -> None:
    """
    Seeds canonical PSV Party and SKU tracking data into a TENANT database.
    Called only after tenant validation — never against smritisys.
    """
    print(f"[PSV Seed] Target database: [{db_name}]")
    print(f"[PSV Seed] Starting canonical Party Stock Visibility seeding...")
    seeded = 0
    skipped = 0

    for p_data in CANONICAL_PSV_PARTIES:
        existing_party = (
            await session.execute(select(PSVParty).where(PSVParty.id == p_data["id"]))
        ).scalar_one_or_none()

        if not existing_party:
            party = PSVParty(
                id=p_data["id"],
                name=p_data["name"],
                location=p_data["location"],
                stock_count=p_data["stock_count"],
                sell_through=p_data["sell_through"],
                weeks_of_cover=p_data["weeks_of_cover"],
                capital_locked=p_data["capital_locked"],
                status=p_data["status"]
            )
            session.add(party)
            await session.flush()
            print(f"  + Created PSV Party in [{db_name}]: {party.name} ({party.id})")

            for s_data in p_data["skus"]:
                sku = PSVPartySkuTracking(
                    party_id=party.id,
                    sku=s_data["sku"],
                    invoiced_qty=s_data["invoiced_qty"],
                    confirmed_sold_qty=s_data["confirmed_sold_qty"],
                    returned_qty=s_data["returned_qty"]
                )
                session.add(sku)
                print(f"    - Added SKU tracking: {sku.sku}")
            seeded += 1
        else:
            print(f"  = PSV Party already exists in [{db_name}]: {existing_party.name}")
            skipped += 1

    await session.commit()
    print(
        f"[PSV Seed] Complete for [{db_name}]: "
        f"{seeded} seeded, {skipped} already existed."
    )


@seed_contract(target="tenant")
async def seed_psv_database(database_name: str) -> None:
    """
    Seeds PSV data into the specified TENANT database only.
    smritisys is never touched — this is enforced by @seed_contract and _resolve_tenant().
    """
    tenant_db = database_name
    print(f"\n[PSV Seed] ══════════════════════════════════════════")
    print(f"[PSV Seed] SMRITI Tenant Data Boundary: ENFORCED")
    print(f"[PSV Seed] Target: [{tenant_db}] (tenant/company database)")
    print(f"[PSV Seed] Control Plane (smritisys): NOT TOUCHED")
    print(f"[PSV Seed] ══════════════════════════════════════════")

    engine = get_company_async_engine(tenant_db)
    async with AsyncSession(engine) as session:
        await seed_session(session, tenant_db)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Seed PSV (Party Stock Visibility) data into a TENANT database.\n"
                    "NEVER writes to smritisys (Control Plane)."
    )
    parser.add_argument(
        "--tenant",
        type=str,
        default=None,
        help="Target registered company/tenant database (e.g. smriti001). REQUIRED."
    )
    args = parser.parse_args()

    try:
        tenant_database = _resolve_tenant(args.tenant)
    except RuntimeError as exc:
        print(f"\n[PSV Seed] ERROR: {exc}", file=sys.stderr)
        sys.exit(1)

    asyncio.run(seed_psv_database(tenant_database))
