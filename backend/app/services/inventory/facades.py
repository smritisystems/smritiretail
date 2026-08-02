from __future__ import annotations
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
Description  : Inventory Kernel Facades v1.0.0 (InventoryQueryFacade v1 & InventoryCommandFacade v1).
"""

from decimal import Decimal
from typing import Any, List, Optional, Dict
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from ...api.deps import TenantContext
from ...models.inventory import Product, StockMovement
from ...models.inventory_kernel import (
    InventoryLedgerEntry,
    ReservationLedgerEntry,
    InventoryLocationNode,
    InventorySnapshotRecord,
)
from .ilg_engine import InventoryLedgerEngine
from .itex_engine import InventoryTransactionEngine
from .state_engine import InventoryStateService
from .availability_engine import InventoryAvailabilityService
from .reservation_engine import InventoryReservationService
from .trace_engine import InventoryTraceService
from .timeline_engine import InventoryTimelineService


class InventoryQueryFacade:
    """
    InventoryQueryFacade v1 — Read-Only Facts, Availability, Network Aggregation & Projections
    """
    def __init__(self, db: AsyncSession, tenant_ctx: TenantContext):
        self.db = db
        self.tenant_ctx = tenant_ctx
        self.ilg_engine = InventoryLedgerEngine(db, tenant_ctx)
        self.state_service = InventoryStateService(db, tenant_ctx)
        self.availability_service = InventoryAvailabilityService(db, tenant_ctx)
        self.trace_service = InventoryTraceService(db, tenant_ctx)
        self.timeline_service = InventoryTimelineService(db, tenant_ctx)

    async def get_canonical_state(self, product_id: str) -> Dict[str, Any]:
        return await self.state_service.get_product_state(product_id)

    async def get_stock(self, product_id: str, location_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Fetches dynamic on-hand balance derived from InventoryLedger.
        """
        on_hand = await self.ilg_engine.calculate_location_balance(product_id, location_id)
        return {
            "product_id": product_id,
            "location_id": location_id,
            "on_hand": float(on_hand),
        }

    async def get_available(self, product_id: str, location_id: Optional[str] = None) -> float:
        """
        Rule 3 (Derived Availability Rule): ATP = On Hand - Reserved.
        """
        on_hand = await self.ilg_engine.calculate_location_balance(product_id, location_id)
        # Sum active reservations
        stmt = select(func.coalesce(func.sum(ReservationLedgerEntry.reserved_qty - ReservationLedgerEntry.released_qty - ReservationLedgerEntry.allocated_qty), Decimal("0.0000"))).where(
            ReservationLedgerEntry.product_id == product_id,
            ReservationLedgerEntry.status == "ACTIVE",
            ReservationLedgerEntry.company_id == self.tenant_ctx.company_id,
        )
        if location_id:
            stmt = stmt.where(ReservationLedgerEntry.location_id == location_id)
        res = await self.db.execute(stmt)
        reserved = Decimal(str(res.scalar() or 0))
        available = max(Decimal("0.0000"), on_hand - reserved)
        return float(available)

    async def get_network_stock(self, product_id: str) -> Dict[str, Any]:
        """
        Rule 4 (Derived Network Aggregation Rule): Sum of location balances.
        """
        network_qty = await self.ilg_engine.calculate_network_balance(product_id)
        return {
            "product_id": product_id,
            "network_stock": float(network_qty),
        }

    async def get_projected_stock(
        self,
        product_id: str,
        location_id: Optional[str] = None,
        incoming_po_qty: float = 0.0,
        transfer_in_qty: float = 0.0,
        transfer_out_qty: float = 0.0,
    ) -> float:
        """
        Calculates projected availability: On Hand - Reserved + Incoming PO + Transfer In - Transfer Out
        """
        atp = await self.get_available(product_id, location_id)
        projected = atp + incoming_po_qty + transfer_in_qty - transfer_out_qty
        return projected

    async def can_fulfill(
        self,
        product_id: str,
        qty: float | int | Decimal = 0,
        warehouse_id: str | None = None,
    ) -> Dict[str, Any]:
        return await self.availability_service.can_fulfill(
            product_id=product_id,
            warehouse_id=warehouse_id,
            qty=qty,
        )

    async def get_stock_movements(self, product_id: str, limit: int = 100) -> List[Dict[str, Any]]:
        return await self.trace_service.get_product_trace(product_id=product_id, limit=limit)


class InventoryCommandFacade:
    """
    InventoryCommandFacade v1 — State Mutations, Commitments & Business Intent Commands
    All inventory movement directives MUST route through ITEX.
    """
    def __init__(self, db: AsyncSession, tenant_ctx: TenantContext):
        self.db = db
        self.tenant_ctx = tenant_ctx
        self.itex_engine = InventoryTransactionEngine(db, tenant_ctx)
        self.reservation_service = InventoryReservationService(db, tenant_ctx)

    async def move_inventory(
        self,
        transaction_id: str,
        from_location_id: Optional[str],
        to_location_id: Optional[str],
        items: List[Dict[str, Any]],
        movement_type: str,
        ownership_type: str = "COMPANY",
        remarks: Optional[str] = None,
    ) -> List[InventoryLedgerEntry]:
        """
        Executes an atomic directional inventory movement via ITEX.
        """
        return await self.itex_engine.execute_transaction(
            transaction_id=transaction_id,
            from_location_id=from_location_id,
            to_location_id=to_location_id,
            items=items,
            movement_type=movement_type,
            ownership_type=ownership_type,
            remarks=remarks,
        )

    async def reserve_stock(
        self,
        product_id: str,
        qty: float | int | Decimal,
        reference_doc: str,
        idempotency_key: str,
    ) -> Dict[str, Any]:
        return await self.reservation_service.reserve(
            product_id=product_id,
            qty=qty,
            reservation_type=reference_doc,
            reservation_id=idempotency_key,
        )

    async def issue_sale(
        self,
        invoice_id: str,
        invoice_no: str,
        items: List[Dict[str, Any]],
        warehouse: str = "Default Warehouse",
    ) -> List[InventoryLedgerEntry]:
        """
        Routes Sales Invoice stock issuance through ITEX.
        """
        transaction_id = f"TX-SALE-{invoice_no}"
        return await self.itex_engine.execute_transaction(
            transaction_id=transaction_id,
            from_location_id=warehouse,
            to_location_id=None, # Exit (Consumer Sale)
            items=items,
            movement_type="SALE",
            document_no=invoice_no,
            ownership_type="COMPANY",
            remarks=f"Stock issued for sales invoice: {invoice_no}",
        )

    async def return_sale(
        self,
        return_id: str,
        return_no: str,
        items: List[Dict[str, Any]],
        warehouse: str = "Default Warehouse",
    ) -> List[InventoryLedgerEntry]:
        """
        Routes Sales Return stock restoration through ITEX.
        """
        transaction_id = f"TX-SALERET-{return_no}"
        return await self.itex_engine.execute_transaction(
            transaction_id=transaction_id,
            from_location_id=None,
            to_location_id=warehouse,
            items=items,
            movement_type="SALE_RETURN",
            document_no=return_no,
            ownership_type="COMPANY",
            remarks=f"Stock restored for sales return: {return_no}",
        )

    async def receive_purchase(
        self,
        grn_id: str,
        grn_no: str,
        items: List[Dict[str, Any]],
        warehouse: str = "Default Warehouse",
    ) -> List[InventoryLedgerEntry]:
        """
        Routes Purchase GRN receipt through ITEX.
        """
        transaction_id = f"TX-GRN-{grn_no}"
        return await self.itex_engine.execute_transaction(
            transaction_id=transaction_id,
            from_location_id=None,
            to_location_id=warehouse,
            items=items,
            movement_type="PURCHASE",
            document_no=grn_no,
            ownership_type="COMPANY",
            remarks=f"Stock received for purchase GRN: {grn_no}",
        )

    async def return_purchase(
        self,
        return_id: str,
        return_no: str,
        items: List[Dict[str, Any]],
        warehouse: str = "Default Warehouse",
    ) -> List[InventoryLedgerEntry]:
        """
        Routes Purchase Debit Note return through ITEX.
        """
        transaction_id = f"TX-PURCHRET-{return_no}"
        return await self.itex_engine.execute_transaction(
            transaction_id=transaction_id,
            from_location_id=warehouse,
            to_location_id=None,
            items=items,
            movement_type="PURCHASE_RETURN",
            document_no=return_no,
            ownership_type="COMPANY",
            remarks=f"Stock returned for purchase debit note: {return_no}",
        )

    async def issue_pos_sale(
        self,
        receipt_id: str,
        receipt_no: str,
        items: List[Dict[str, Any]],
        warehouse: str = "Default Warehouse",
    ) -> List[InventoryLedgerEntry]:
        """
        Routes POS checkout issuance through ITEX.
        """
        transaction_id = f"TX-POS-{receipt_no}"
        return await self.itex_engine.execute_transaction(
            transaction_id=transaction_id,
            from_location_id=warehouse,
            to_location_id=None, # Exit (Consumer Sale)
            items=items,
            movement_type="POS_SALE",
            document_no=receipt_no,
            ownership_type="COMPANY",
            remarks=f"Stock issued for POS checkout: {receipt_no}",
        )

    async def adjust_stock(
        self,
        audit_id: str,
        audit_no: str,
        items: List[Dict[str, Any]],
        warehouse: str = "Default Warehouse",
    ) -> List[InventoryLedgerEntry]:
        """
        Routes physical stock count variance adjustments through ITEX.
        """
        transaction_id = f"TX-ADJ-{audit_no}"
        adjusted_items = []
        last_var_qty = Decimal("0")
        for item in items:
            raw_qty = item.get("variance_quantity") if "variance_quantity" in item else item.get("quantity", "0")
            var_qty = Decimal(str(raw_qty))
            if var_qty == Decimal("0"):
                continue
            last_var_qty = var_qty
            adjusted_items.append({
                "product_id": item["product_id"],
                "quantity": abs(var_qty),
                "sku": item.get("sku", ""),
                "unit_cost": item.get("unit_cost", "0.00"),
            })

        if not adjusted_items:
            return []

        return await self.itex_engine.execute_transaction(
            transaction_id=transaction_id,
            from_location_id=warehouse if last_var_qty < 0 else None,
            to_location_id=warehouse if last_var_qty >= 0 else None,
            items=adjusted_items,
            movement_type="ADJUSTMENT",
            document_no=audit_no,
            ownership_type="COMPANY",
            remarks=f"Physical stock adjustment audit: {audit_no}",
        )

    async def transfer_out(
        self,
        transfer_id: str,
        transfer_no: str,
        items: List[Dict[str, Any]],
        source_warehouse: str = "Default Warehouse",
        target_warehouse: str = "Transit Warehouse",
    ) -> List[InventoryLedgerEntry]:
        """
        Routes transfer outbound shipment through ITEX.
        """
        transaction_id = f"TX-TR-OUT-{transfer_no}"
        return await self.itex_engine.execute_transaction(
            transaction_id=transaction_id,
            from_location_id=source_warehouse,
            to_location_id=target_warehouse,
            items=items,
            movement_type="TRANSFER_OUT",
            document_no=transfer_no,
            ownership_type="COMPANY",
            remarks=f"Stock transfer outbound to {target_warehouse}: {transfer_no}",
        )

    async def transfer_in(
        self,
        transfer_id: str,
        transfer_no: str,
        items: List[Dict[str, Any]],
        target_warehouse: str = "Default Warehouse",
        source_warehouse: str = "Transit Warehouse",
    ) -> List[InventoryLedgerEntry]:
        """
        Routes transfer inbound receipt through ITEX.
        """
        transaction_id = f"TX-TR-IN-{transfer_no}"
        return await self.itex_engine.execute_transaction(
            transaction_id=transaction_id,
            from_location_id=source_warehouse,
            to_location_id=target_warehouse,
            items=items,
            movement_type="TRANSFER_IN",
            document_no=transfer_no,
            ownership_type="COMPANY",
            remarks=f"Stock transfer inbound from {source_warehouse}: {transfer_no}",
        )
