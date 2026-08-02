"""
Inventory Lock Engine (locks/lock_engine.py)
Operational stock lock registry (Audit, Recall, Quarantine, Legal Hold, Maintenance).
Enforces lock acquisition, release, and ATP exclusion across multi-scope boundaries.
"""

from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional, List, Dict, Any
import uuid

from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import TenantContext
from app.models.inventory_kernel import InventoryLockRecord


class InventoryLockEngine:
    """
    Inventory Lock Engine (ILE-Lock)
    Operational stock lock management across LOCATION, BIN, SKU, BATCH, and SERIAL scopes.
    """
    LOCK_TYPES = [
        "CYCLE_COUNT",
        "STOCK_AUDIT",
        "QUALITY_HOLD",
        "BATCH_RECALL",
        "LEGAL_HOLD",
        "QUARANTINE",
        "PHYSICAL_DAMAGE",
        "SYSTEM_MAINTENANCE",
    ]

    LOCK_SCOPES = [
        "LOCATION",
        "BIN",
        "SKU",
        "BATCH",
        "SERIAL",
    ]

    def __init__(self, db: AsyncSession, tenant_ctx: TenantContext):
        self.db = db
        self.tenant_ctx = tenant_ctx

    async def acquire_lock(
        self,
        lock_type: str,
        lock_scope: str,
        target_id: str,
        reason: str,
        location_id: Optional[str] = None,
        product_id: Optional[str] = None,
        locked_qty: Decimal = Decimal("0.0000"),
        effective_until: Optional[datetime] = None,
    ) -> InventoryLockRecord:
        if lock_type not in self.LOCK_TYPES:
            raise ValueError(f"Invalid lock_type '{lock_type}'. Must be one of {self.LOCK_TYPES}")
        if lock_scope not in self.LOCK_SCOPES:
            raise ValueError(f"Invalid lock_scope '{lock_scope}'. Must be one of {self.LOCK_SCOPES}")

        ts = int(datetime.now(timezone.utc).timestamp() * 1000)
        lock_code = f"LOCK-{lock_type}-{ts}-{uuid.uuid4().hex[:6].upper()}"

        lock_record = InventoryLockRecord(
            id=f"LCK-{uuid.uuid4().hex[:12]}",
            uuid=str(uuid.uuid4()),
            lock_code=lock_code,
            lock_type=lock_type,
            lock_scope=lock_scope,
            target_id=target_id,
            location_id=location_id,
            product_id=product_id,
            locked_qty=Decimal(str(locked_qty)),
            reason=reason,
            status="ACTIVE",
            effective_from=datetime.now(timezone.utc),
            effective_until=effective_until,
            company_id=self.tenant_ctx.company_id,
            branch_id=self.tenant_ctx.branch_id,
        )
        self.db.add(lock_record)
        await self.db.flush()
        return lock_record

    async def release_lock(
        self,
        lock_id_or_code: str,
        released_by: str,
        release_reason: str,
    ) -> InventoryLockRecord:
        stmt = select(InventoryLockRecord).where(
            or_(
                InventoryLockRecord.id == lock_id_or_code,
                InventoryLockRecord.lock_code == lock_id_or_code,
            ),
            InventoryLockRecord.company_id == self.tenant_ctx.company_id,
            InventoryLockRecord.status == "ACTIVE",
        )
        res = await self.db.execute(stmt)
        lock_record = res.scalars().first()
        if not lock_record:
            raise ValueError(f"Active lock '{lock_id_or_code}' not found.")

        lock_record.status = "RELEASED"
        lock_record.released_by = released_by
        lock_record.released_at = datetime.now(timezone.utc)
        lock_record.release_reason = release_reason
        await self.db.flush()
        return lock_record

    async def get_active_locked_quantity(
        self,
        product_id: str,
        location_id: Optional[str] = None,
    ) -> Decimal:
        """
        Calculates total operational locked stock for ATP deduction.
        """
        stmt = select(InventoryLockRecord).where(
            InventoryLockRecord.product_id == product_id,
            InventoryLockRecord.company_id == self.tenant_ctx.company_id,
            InventoryLockRecord.status == "ACTIVE",
        )
        if location_id:
            stmt = stmt.where(
                or_(
                    InventoryLockRecord.location_id == location_id,
                    InventoryLockRecord.location_id.is_(None),
                )
            )

        res = await self.db.execute(stmt)
        locks = res.scalars().all()
        total_locked = Decimal("0.0000")
        for lck in locks:
            total_locked += Decimal(str(lck.locked_qty or 0))
        return total_locked
