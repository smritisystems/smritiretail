"""
Timeline Engine (timeline/timeline_service.py)
Unified filter-based inventory timeline projection service.
Projects chronological event feeds across SKU, Batch, Serial, Location, and Document filters.
"""

from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlalchemy import select, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import TenantContext
from app.models.inventory import StockMovement
from app.models.inventory_kernel import InventoryLedgerEntry, InventoryLockRecord


class TimelineEngine:
    """
    Unified Filter-Based Timeline Engine.
    Projects chronological lifecycle events across SKU, Batch, Serial, Location, and Document dimensions.
    """
    def __init__(self, db: AsyncSession, tenant_ctx: TenantContext):
        self.db = db
        self.tenant_ctx = tenant_ctx

    async def get_timeline(
        self,
        product_id: Optional[str] = None,
        sku: Optional[str] = None,
        batch_no: Optional[str] = None,
        serial_no: Optional[str] = None,
        location_id: Optional[str] = None,
        document_no: Optional[str] = None,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        stmt = select(InventoryLedgerEntry).where(
            InventoryLedgerEntry.company_id == self.tenant_ctx.company_id,
        )

        if product_id:
            stmt = stmt.where(InventoryLedgerEntry.product_id == product_id)
        if sku:
            stmt = stmt.where(InventoryLedgerEntry.sku == sku)
        if batch_no:
            stmt = stmt.where(InventoryLedgerEntry.batch_no == batch_no)
        if serial_no:
            stmt = stmt.where(InventoryLedgerEntry.serial_no == serial_no)
        if location_id:
            stmt = stmt.where(
                or_(
                    InventoryLedgerEntry.from_location_id == location_id,
                    InventoryLedgerEntry.to_location_id == location_id,
                )
            )
        if document_no:
            stmt = stmt.where(InventoryLedgerEntry.document_no == document_no)

        stmt = stmt.order_by(InventoryLedgerEntry.posting_timestamp.asc()).limit(limit)

        res = await self.db.execute(stmt)
        entries = res.scalars().all()

        timeline_events = []
        for entry in entries:
            timeline_events.append({
                "event_id": entry.id,
                "entry_no": entry.entry_no,
                "transaction_id": entry.transaction_id,
                "document_no": entry.document_no,
                "movement_type": entry.movement_type,
                "product_id": entry.product_id,
                "sku": entry.sku,
                "quantity": float(entry.quantity),
                "from_location_id": entry.from_location_id,
                "to_location_id": entry.to_location_id,
                "batch_no": entry.batch_no,
                "serial_no": entry.serial_no,
                "timestamp": entry.posting_timestamp.isoformat() if entry.posting_timestamp else None,
                "remarks": entry.remarks,
            })

        return timeline_events
