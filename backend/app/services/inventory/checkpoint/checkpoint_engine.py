"""
Inventory Checkpoint Engine (checkpoint/checkpoint_engine.py)
Certified Recovery Point Checkpoint Engine.
Enables fast-replay starting from the latest certified checkpoint instead of genesis ledger entry.
"""

from datetime import datetime, timezone
from decimal import Decimal
import hashlib
from typing import Optional, Dict, Any, Tuple
import uuid

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import TenantContext
from app.models.inventory_kernel import InventoryLedgerEntry, InventoryCheckpointRecord


class InventoryCheckpointEngine:
    """
    Inventory Checkpoint Engine (Checkpoint Recovery Engine).
    Creates certified recovery point checkpoints for fast balance replay.
    """
    def __init__(self, db: AsyncSession, tenant_ctx: TenantContext):
        self.db = db
        self.tenant_ctx = tenant_ctx

    async def create_checkpoint(
        self,
        product_id: str,
        location_id: str,
        certified_on_hand: Decimal,
        last_entry_id: str,
        unit_cost: Decimal = Decimal("0.00"),
    ) -> InventoryCheckpointRecord:
        ts = int(datetime.now(timezone.utc).timestamp() * 1000)
        code = f"CHK-{product_id[:8]}-{location_id[:8]}-{ts}"
        checksum_payload = f"{code}:{product_id}:{location_id}:{certified_on_hand}:{last_entry_id}"
        checksum = hashlib.sha256(checksum_payload.encode("utf-8")).hexdigest()

        checkpoint = InventoryCheckpointRecord(
            id=f"CKP-{uuid.uuid4().hex[:12]}",
            uuid=str(uuid.uuid4()),
            checkpoint_code=code,
            checkpoint_timestamp=datetime.now(timezone.utc),
            last_entry_id=last_entry_id,
            location_id=location_id,
            product_id=product_id,
            sku=product_id,
            certified_on_hand=Decimal(str(certified_on_hand)),
            certified_unit_cost=Decimal(str(unit_cost)),
            checksum=checksum,
            is_certified=True,
            company_id=self.tenant_ctx.company_id,
            branch_id=self.tenant_ctx.branch_id,
        )
        self.db.add(checkpoint)
        await self.db.flush()
        return checkpoint

    async def get_latest_checkpoint(
        self,
        product_id: str,
        location_id: str,
    ) -> Optional[InventoryCheckpointRecord]:
        stmt = (
            select(InventoryCheckpointRecord)
            .where(
                InventoryCheckpointRecord.product_id == product_id,
                InventoryCheckpointRecord.location_id == location_id,
                InventoryCheckpointRecord.is_certified.is_(True),
                InventoryCheckpointRecord.company_id == self.tenant_ctx.company_id,
            )
            .order_by(InventoryCheckpointRecord.checkpoint_timestamp.desc())
            .limit(1)
        )
        res = await self.db.execute(stmt)
        return res.scalars().first()

    async def fast_replay_balance(
        self,
        product_id: str,
        location_id: Optional[str] = None,
    ) -> Decimal:
        """
        Replays ledger balance starting from the latest certified checkpoint if available.
        """
        checkpoint = None
        if location_id:
            checkpoint = await self.get_latest_checkpoint(product_id, location_id)

        base_balance = Decimal("0.0000")
        if checkpoint:
            base_balance = Decimal(str(checkpoint.certified_on_hand))
            # Sum ledger entries strictly AFTER checkpoint.checkpoint_timestamp
            stmt = select(InventoryLedgerEntry).where(
                InventoryLedgerEntry.product_id == product_id,
                InventoryLedgerEntry.company_id == self.tenant_ctx.company_id,
                InventoryLedgerEntry.created_at > checkpoint.checkpoint_timestamp,
            )
        else:
            stmt = select(InventoryLedgerEntry).where(
                InventoryLedgerEntry.product_id == product_id,
                InventoryLedgerEntry.company_id == self.tenant_ctx.company_id,
            )

        if location_id:
            stmt = stmt.where(
                (InventoryLedgerEntry.from_location_id == location_id)
                | (InventoryLedgerEntry.to_location_id == location_id)
            )

        res = await self.db.execute(stmt)
        entries = res.scalars().all()

        delta = Decimal("0.0000")
        for entry in entries:
            qty = Decimal(str(entry.quantity))
            if location_id:
                if entry.to_location_id == location_id:
                    delta += abs(qty)
                elif entry.from_location_id == location_id:
                    delta -= abs(qty)
            else:
                if entry.to_location_id and not entry.from_location_id:
                    delta += abs(qty)
                elif entry.from_location_id and not entry.to_location_id:
                    delta -= abs(qty)

        return base_balance + delta
