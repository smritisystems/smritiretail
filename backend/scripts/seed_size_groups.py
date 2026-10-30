from __future__ import annotations

import asyncio
from sqlalchemy import select

from app.api.v1.master_lookup import create_size_group
from app.db.session import AsyncSessionLocal
from app.models.auth import User
from app.models.size_groups import SizeGroup


DEFAULT_SIZE_GROUPS = [
    {
        "code": "APPAREL_ALPHA",
        "name": "Apparel Alpha Sizes",
        "data": {
            "category": "APPAREL",
            "dimension": "size",
            "values": ["XS", "S", "M", "L", "XL", "XXL"],
            "description": "Core apparel sizing master set",
        },
    },
    {
        "code": "FOOTWEAR_EU",
        "name": "Footwear EU Sizes",
        "data": {
            "category": "FOOTWEAR",
            "dimension": "size",
            "values": ["36", "37", "38", "39", "40", "41", "42", "43", "44"],
            "description": "European footwear sizing master set",
        },
    },
]


async def seed_size_groups() -> None:
    async with AsyncSessionLocal() as db:
        for payload in DEFAULT_SIZE_GROUPS:
            existing = await db.scalar(
                select(SizeGroup).where(SizeGroup.code == payload["code"], SizeGroup.is_deleted.is_(False))
            )
            if not existing:
                dummy_user = User(username="system")
                dummy_user.company_id = None
                dummy_user.branch_id = None
                await create_size_group(payload, db, dummy_user)
        await db.commit()
        print("Seeded size groups:", [group["code"] for group in DEFAULT_SIZE_GROUPS])


if __name__ == "__main__":
    asyncio.run(seed_size_groups())
