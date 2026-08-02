"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-08-03
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
Description  : Inventory Ledger Engine (ILG) — Core Engine owning the append-only InventoryLedger, compensating reversals, and dynamic balance projections.
"""

from decimal import Decimal
from typing import Any, List, Optional, Dict
import uuid
from datetime import datetime, timezone

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from ...api.deps import TenantContext
from ...models.inventory import Product
from ...models.inventory_kernel import (
    InventoryLedgerEntry,
    InventoryLocationNode,
    InventorySnapshotRecord,
    ReservationLedgerEntry,
)


class InventoryLedgerEngine:
    """
    Inventory Ledger Engine (ILG)
    Enforces Rule LIM-006 (Ledger Immutability Rule):
    Append-only physical stock ledger. All balance changes append new ledger entries.
    Corrections execute via compensating reversal entries.
    """
    def __init__(self, db: AsyncSession, tenant_ctx: TenantContext):
        self.db = db
        self.tenant_ctx = tenant_ctx

    async def _ensure_location_node(self, loc_id: Optional[str]) -> None:
        if not loc_id:
            return
        stmt = select(InventoryLocationNode.id).where(
            InventoryLocationNode.id == loc_id,
            InventoryLocationNode.company_id == self.tenant_ctx.company_id,
        )
        res = await self.db.execute(stmt)
        if not res.scalar():
            node = InventoryLocationNode(
                id=loc_id,
                uuid=str(uuid.uuid4()),
                code=loc_id[:50],
                name=loc_id[:200],
                location_type="WAREHOUSE",
                company_id=self.tenant_ctx.company_id,
                branch_id=self.tenant_ctx.branch_id,
            )
            self.db.add(node)
            await self.db.flush()

    async def post_ledger_entry(
        self,
        transaction_id: str,
        from_location_id: Optional[str],
        to_location_id: Optional[str],
        product_id: str,
        sku: str,
        quantity: Decimal,
        movement_type: str,
        unit_cost: Decimal = Decimal("0.00"),
        batch_no: Optional[str] = None,
        serial_no: Optional[str] = None,
        document_no: Optional[str] = None,
        ownership_type: str = "COMPANY",
        posting_profile_id: Optional[str] = None,
        remarks: Optional[str] = None,
        is_reversal: bool = False,
        reversal_entry_id: Optional[str] = None,
    ) -> InventoryLedgerEntry:
        """
        Appends an immutable entry to the InventoryLedger.
        """
        ts = int(datetime.now(timezone.utc).timestamp() * 1000)
        entry_no = f"ILG-{ts}-{uuid.uuid4().hex[:6].upper()}"

        await self._ensure_location_node(from_location_id)
        await self._ensure_location_node(to_location_id)

        entry = InventoryLedgerEntry(
            id=f"ILE-{uuid.uuid4().hex[:12]}",
            uuid=str(uuid.uuid4()),
            entry_no=entry_no,
            transaction_id=transaction_id,
            document_no=document_no,
            from_location_id=from_location_id,
            to_location_id=to_location_id,
            product_id=product_id,
            sku=sku,
            quantity=Decimal(str(quantity)),
            batch_no=batch_no,
            serial_no=serial_no,
            unit_cost=Decimal(str(unit_cost)),
            movement_type=movement_type,
            ownership_type=ownership_type,
            posting_profile_id=posting_profile_id,
            remarks=remarks,
            is_reversal=is_reversal,
            reversal_entry_id=reversal_entry_id,
            company_id=self.tenant_ctx.company_id,
            branch_id=self.tenant_ctx.branch_id,
        )
        self.db.add(entry)
        return entry

    async def post_reversal_entry(
        self,
        original_entry_id: str,
        remarks: Optional[str] = "Compensating Reversal Movement",
    ) -> InventoryLedgerEntry:
        """
        Rule LIM-006: Posts a compensating reversal entry for an existing ledger entry.
        """
        stmt = select(InventoryLedgerEntry).where(
            InventoryLedgerEntry.id == original_entry_id,
            InventoryLedgerEntry.company_id == self.tenant_ctx.company_id,
        )
        res = await self.db.execute(stmt)
        orig = res.scalars().first()
        if not orig:
            raise ValueError(f"Ledger entry {original_entry_id} not found for reversal.")

        # Reversal swaps from and to locations
        return await self.post_ledger_entry(
            transaction_id=f"REV-{orig.transaction_id}",
            from_location_id=orig.to_location_id,
            to_location_id=orig.from_location_id,
            product_id=orig.product_id,
            sku=orig.sku,
            quantity=orig.quantity,
            movement_type=f"REVERSAL_{orig.movement_type}",
            unit_cost=orig.unit_cost,
            batch_no=orig.batch_no,
            serial_no=orig.serial_no,
            document_no=orig.document_no,
            ownership_type=orig.ownership_type,
            remarks=remarks or f"Reversal of {orig.entry_no}",
            is_reversal=True,
            reversal_entry_id=orig.id,
        )

    async def calculate_location_balance(
        self,
        product_id: str,
        location_id: Optional[str] = None,
    ) -> Decimal:
        """
        Derives real-time stock balance dynamically from append-only InventoryLedger.
        """
        # Sum inbound movements (TO location)
        in_stmt = select(func.coalesce(func.sum(InventoryLedgerEntry.quantity), Decimal("0.0000"))).where(
            InventoryLedgerEntry.product_id == product_id,
            InventoryLedgerEntry.company_id == self.tenant_ctx.company_id,
        )
        if location_id:
            in_stmt = in_stmt.where(InventoryLedgerEntry.to_location_id == location_id)
        else:
            in_stmt = in_stmt.where(InventoryLedgerEntry.to_location_id.isnot(None))

        in_res = await self.db.execute(in_stmt)
        total_in = Decimal(str(in_res.scalar() or 0))

        # Sum outbound movements (FROM location)
        out_stmt = select(func.coalesce(func.sum(InventoryLedgerEntry.quantity), Decimal("0.0000"))).where(
            InventoryLedgerEntry.product_id == product_id,
            InventoryLedgerEntry.company_id == self.tenant_ctx.company_id,
        )
        if location_id:
            out_stmt = out_stmt.where(InventoryLedgerEntry.from_location_id == location_id)
        else:
            out_stmt = out_stmt.where(InventoryLedgerEntry.from_location_id.isnot(None))

        out_res = await self.db.execute(out_stmt)
        total_out = Decimal(str(out_res.scalar() or 0))

        return total_in - total_out

    async def calculate_network_balance(self, product_id: str) -> Decimal:
        """
        Rule 4: Dynamically aggregates network stock across all active location nodes.
        """
        return await self.calculate_location_balance(product_id=product_id, location_id=None)
