"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.9.0
Created      : 2026-08-22
Modified     : 2026-08-22
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
Source Module: PSV (Party Stock Visibility) Canonical Database Seeding
"""

import asyncio
from decimal import Decimal
from sqlalchemy import select, text
from app.db.session import async_session, get_company_async_engine
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.psv import PSVParty, PSVPartySkuTracking

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

async def seed_session(session: AsyncSession, db_name: str):
    print(f"[PSV Seed] Starting canonical Party Stock Visibility seeding for {db_name}...")
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
            print(f"  + Created PSV Party in {db_name}: {party.name} ({party.id})")

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
        else:
            print(f"  = PSV Party already exists in {db_name}: {existing_party.name}")

    await session.commit()
    print(f"[PSV Seed] Canonical Party Stock Visibility seeding complete for {db_name}.")

async def seed_psv_database():
    # 1. Seed smritisys
    async with async_session() as session:
        await seed_session(session, "smritisys")
    
    # 2. Seed smriti001
    engine001 = get_company_async_engine("smriti001")
    async with AsyncSession(engine001) as session001:
        await seed_session(session001, "smriti001")

if __name__ == "__main__":
    asyncio.run(seed_psv_database())
