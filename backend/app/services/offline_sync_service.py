"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 4.3.0
Created      : 2026-07-20
Modified     : 2026-07-20
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import uuid
import logging
from typing import Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.sales import SalesInvoice

logger = logging.getLogger("smriti.offline_sync_service")


class OfflineSyncService:
    """
    Offline POS Sync Service providing idempotent sync for client-queued offline invoices.
    """
    def __init__(self, db: AsyncSession):
        self.db = db

    async def sync_offline_invoices(
        self,
        invoices: List[Dict[str, Any]],
        shift_id: str = "SHIFT-OFFLINE-01",
    ) -> Dict[str, Any]:
        synced_invoices = []
        skipped_duplicates = 0

        for inv_data in invoices:
            client_id = inv_data.get("client_invoice_id", str(uuid.uuid4()))
            invoice_num = inv_data.get("invoice_number", f"INV-OFF-{uuid.uuid4().hex[:6].upper()}")
            grand_total = float(inv_data.get("grand_total", 0.0))

            # Idempotency check by invoice_no (the actual model column name)
            stmt = select(SalesInvoice).where(SalesInvoice.invoice_no == invoice_num)
            res = await self.db.execute(stmt)
            existing = res.scalar_one_or_none()

            if existing:
                skipped_duplicates += 1
                continue

            invoice = SalesInvoice(
                id=f"inv_{uuid.uuid4().hex[:12]}",
                uuid=str(uuid.uuid4()),
                invoice_no=invoice_num,
                grand_total=grand_total,
                status="Draft",
                payment_mode="CASH",
            )
            self.db.add(invoice)
            synced_invoices.append(invoice_num)

        await self.db.commit()


        return {
            "status": "COMPLETED",
            "batch_id": f"BATCH-{uuid.uuid4().hex[:8].upper()}",
            "processed_count": len(synced_invoices),
            "skipped_duplicates": skipped_duplicates,
            "synced_invoice_numbers": synced_invoices,
        }
