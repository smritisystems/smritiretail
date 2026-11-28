import uuid
from decimal import Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.item_master import Item


async def seed_catalog_items(session: AsyncSession, rows: list[dict[str, Any]]) -> None:
    company_id = "COMP-001"
    branch_id = "BR-MAIN-001"
    item_names = {}
    for row in rows:
        item_code = str(row.get("item_code") or "").strip().upper()
        if item_code:
            item_names.setdefault(item_code, str(row.get("item_name") or item_code))

    for item_code, item_name in item_names.items():
        existing = await session.scalar(
            select(Item.id).where(
                Item.company_id == company_id,
                Item.item_code == item_code,
            )
        )
        if existing is None:
            session.add(Item(
                id=f"dbtest-{uuid.uuid4().hex[:12]}",
                company_id=company_id,
                branch_id=branch_id,
                item_code=item_code,
                item_name=item_name,
                item_type="FINISHED_GOOD",
                hsn_code="6403",
                tax_rate=Decimal("18.00"),
                primary_uom="PCS",
                status="ACTIVE",
                is_active=True,
                is_deleted=False,
            ))
    await session.flush()
