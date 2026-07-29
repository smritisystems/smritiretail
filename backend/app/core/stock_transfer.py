"""
Project      : SMRITI Retail OS
Organization : SmritiSys
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.0.0
Created      : 2026-07-28
Modified     : 2026-07-28
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

"""
SMRITI Indian Compliance & Inventory Core Layer - Inter-Store Stock Transfer Engine
Conforms to Level 1 SMRITI Architecture Constitution (Rule GR-011 Canonical Ownership: Inventory).

Handles multi-store stock movement:
1. Transfer Request Creation
2. Dispatch & In-Transit Locking (Prevents double allocation while stock is on truck)
3. Receiving & Inventory Realization
4. Rejection & Lock Release
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional, Dict, List
import datetime


class TransferStatus(str, Enum):
    DRAFT = "DRAFT"
    REQUESTED = "REQUESTED"
    DISPATCHED_IN_TRANSIT = "DISPATCHED_IN_TRANSIT"
    RECEIVED = "RECEIVED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"


@dataclass
class StockTransferItem:
    sku: str
    item_name: str
    requested_qty: float
    dispatched_qty: float = 0.0
    received_qty: float = 0.0
    uom: str = "Pcs"


@dataclass
class StockTransferRequest:
    transfer_id: str
    source_warehouse_id: str
    target_warehouse_id: str
    items: List[StockTransferItem]
    status: TransferStatus = TransferStatus.DRAFT
    created_at: datetime.datetime = field(default_factory=datetime.datetime.now)
    dispatched_at: Optional[datetime.datetime] = None
    received_at: Optional[datetime.datetime] = None
    rejection_reason: Optional[str] = None


class StockTransferEngine:
    """
    Canonical Inventory Engine for Inter-Store Stock Movements & In-Transit Locks.
    """

    def __init__(self, warehouse_stock: Optional[Dict[str, Dict[str, float]]] = None):
        # warehouse_stock format: {warehouse_id: {sku: quantity}}
        self.warehouse_stock: Dict[str, Dict[str, float]] = warehouse_stock or {}
        self.in_transit_locks: Dict[str, Dict[str, float]] = {}
        self.transfer_records: Dict[str, StockTransferRequest] = {}

    def get_stock(self, warehouse_id: str, sku: str) -> float:
        return self.warehouse_stock.get(warehouse_id, {}).get(sku, 0.0)

    def get_in_transit_stock(self, source_warehouse_id: str, sku: str) -> float:
        return self.in_transit_locks.get(source_warehouse_id, {}).get(sku, 0.0)

    def create_transfer_request(
        self, transfer_id: str, source_wh: str, target_wh: str, items: List[StockTransferItem]
    ) -> StockTransferRequest:
        if source_wh == target_wh:
            raise ValueError("Source and target warehouse cannot be the same.")

        if not items:
            raise ValueError("Stock transfer request must contain at least one item.")

        transfer = StockTransferRequest(
            transfer_id=transfer_id,
            source_warehouse_id=source_wh,
            target_warehouse_id=target_wh,
            items=items,
            status=TransferStatus.REQUESTED,
        )
        self.transfer_records[transfer_id] = transfer
        return transfer

    def dispatch_transfer(
        self, transfer_id: str, dispatched_quantities: Dict[str, float]
    ) -> StockTransferRequest:
        transfer = self.transfer_records.get(transfer_id)
        if not transfer:
            raise KeyError(f"Transfer request '{transfer_id}' not found.")

        if transfer.status != TransferStatus.REQUESTED:
            raise ValueError(f"Cannot dispatch transfer in status '{transfer.status.value}'.")

        source_wh = transfer.source_warehouse_id

        # Validate stock availability at source
        for item in transfer.items:
            dispatch_qty = dispatched_quantities.get(item.sku, item.requested_qty)
            avail = self.get_stock(source_wh, item.sku)
            if avail < dispatch_qty:
                raise ValueError(
                    f"Insufficient stock for SKU '{item.sku}' at source warehouse '{source_wh}'. "
                    f"Available: {avail}, Requested dispatch: {dispatch_qty}"
                )

        # Deduct from source & move to in-transit lock
        for item in transfer.items:
            dispatch_qty = dispatched_quantities.get(item.sku, item.requested_qty)
            item.dispatched_qty = dispatch_qty

            # Deduct source stock
            self.warehouse_stock[source_wh][item.sku] -= dispatch_qty

            # Add to in-transit lock
            if source_wh not in self.in_transit_locks:
                self.in_transit_locks[source_wh] = {}
            self.in_transit_locks[source_wh][item.sku] = (
                self.in_transit_locks[source_wh].get(item.sku, 0.0) + dispatch_qty
            )

        transfer.status = TransferStatus.DISPATCHED_IN_TRANSIT
        transfer.dispatched_at = datetime.datetime.now()
        return transfer

    def receive_transfer(
        self, transfer_id: str, received_quantities: Dict[str, float]
    ) -> StockTransferRequest:
        transfer = self.transfer_records.get(transfer_id)
        if not transfer:
            raise KeyError(f"Transfer request '{transfer_id}' not found.")

        if transfer.status != TransferStatus.DISPATCHED_IN_TRANSIT:
            raise ValueError(f"Cannot receive transfer in status '{transfer.status.value}'.")

        source_wh = transfer.source_warehouse_id
        target_wh = transfer.target_warehouse_id

        if target_wh not in self.warehouse_stock:
            self.warehouse_stock[target_wh] = {}

        for item in transfer.items:
            recv_qty = received_quantities.get(item.sku, item.dispatched_qty)
            item.received_qty = recv_qty

            # Add to target warehouse stock
            self.warehouse_stock[target_wh][item.sku] = (
                self.warehouse_stock[target_wh].get(item.sku, 0.0) + recv_qty
            )

            # Release in-transit lock
            if source_wh in self.in_transit_locks and item.sku in self.in_transit_locks[source_wh]:
                self.in_transit_locks[source_wh][item.sku] -= item.dispatched_qty
                if self.in_transit_locks[source_wh][item.sku] <= 0:
                    del self.in_transit_locks[source_wh][item.sku]

        transfer.status = TransferStatus.RECEIVED
        transfer.received_at = datetime.datetime.now()
        return transfer

    def reject_transfer(self, transfer_id: str, reason: str) -> StockTransferRequest:
        transfer = self.transfer_records.get(transfer_id)
        if not transfer:
            raise KeyError(f"Transfer request '{transfer_id}' not found.")

        if transfer.status != TransferStatus.DISPATCHED_IN_TRANSIT:
            raise ValueError(f"Cannot reject transfer in status '{transfer.status.value}'.")

        source_wh = transfer.source_warehouse_id

        # Return stock to source warehouse & clear lock
        for item in transfer.items:
            self.warehouse_stock[source_wh][item.sku] += item.dispatched_qty
            if source_wh in self.in_transit_locks and item.sku in self.in_transit_locks[source_wh]:
                self.in_transit_locks[source_wh][item.sku] -= item.dispatched_qty
                if self.in_transit_locks[source_wh][item.sku] <= 0:
                    del self.in_transit_locks[source_wh][item.sku]

        transfer.status = TransferStatus.REJECTED
        transfer.rejection_reason = reason
        return transfer
