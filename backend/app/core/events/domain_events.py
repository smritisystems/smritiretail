"""
Project      : SMRITI Retail OS
Organization : SmritiSys
Module       : Domain Event Publishers — DEPRECATED (ADR-013)
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Copyright    : © SMRITIBooks.com. All Rights Reserved.
Version      : 5.4.0 — DEPRECATED

⚠️  DEPRECATION NOTICE (ADR-013, 2026-07-28):
    This module is deprecated. The canonical event bus is:
        backend/app/services/event_bus.py → SmritiEventBus

    DO NOT add new publisher functions here.
    DO NOT add new subscribers to DomainEventBus.

    Migration plan:
      Phase 1 (now)    — Freeze: no new publishers/subscribers here.
      Phase 2 (M1-C)   — Replace all 6 call sites with SmritiEventBus.publish().
      Phase 3 (cleanup) — Delete this file.

    Reason: DomainEventBus has no DB session coupling, no typed constants,
    and no registered subscribers. SmritiEventBus is transactional, typed,
    and supports the Celery/Redis upgrade path. See ADR-013.
"""


import asyncio
import logging
from typing import Callable, Dict, List, Any
from dataclasses import dataclass, field
from datetime import datetime

logger = logging.getLogger("smriti.events")

@dataclass
class DomainEvent:
    event_id: str
    event_type: str
    timestamp: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    payload: Dict[str, Any] = field(default_factory=dict)

class DomainEventBus:
    def __init__(self):
        self._subscribers: Dict[str, List[Callable[[DomainEvent], Any]]] = {}

    def subscribe(self, event_type: str, handler: Callable[[DomainEvent], Any]):
        if event_type not in self._subscribers:
            self._subscribers[event_type] = []
        self._subscribers[event_type].append(handler)
        logger.info(f"[EVENT_BUS] Handler subscribed to topic: {event_type}")

    async def publish(self, event: DomainEvent):
        logger.info(f"[EVENT_BUS] Publishing event: {event.event_type} (ID: {event.event_id})")
        handlers = self._subscribers.get(event.event_type, [])
        for handler in handlers:
            try:
                if asyncio.iscoroutinefunction(handler):
                    await handler(event)
                else:
                    handler(event)
            except Exception as err:
                logger.error(f"[EVENT_BUS_ERROR] Failed handling {event.event_type}: {err}")

# Singleton Event Bus Instance
event_bus = DomainEventBus()

# Strongly-Typed Domain Publisher Functions (ADR-007 Compliant)
async def publish_sale_completed(invoice_number: str, total_amount: float, item_count: int, customer_id: str = None):
    event = DomainEvent(
        event_id=f"evt_sale_{int(datetime.utcnow().timestamp())}",
        event_type="SaleCompleted",
        payload={
            "invoice_number": invoice_number,
            "total_amount": total_amount,
            "item_count": item_count,
            "customer_id": customer_id
        }
    )
    await event_bus.publish(event)

async def publish_stock_adjusted(product_id: str, warehouse_id: str, quantity_delta: float, reason: str):
    event = DomainEvent(
        event_id=f"evt_stock_{int(datetime.utcnow().timestamp())}",
        event_type="StockAdjusted",
        payload={
            "product_id": product_id,
            "warehouse_id": warehouse_id,
            "quantity_delta": quantity_delta,
            "reason": reason
        }
    )
    await event_bus.publish(event)

async def publish_invoice_cancelled(invoice_number: str, refund_amount: float, reason: str):
    event = DomainEvent(
        event_id=f"evt_cancel_{int(datetime.utcnow().timestamp())}",
        event_type="InvoiceCancelled",
        payload={
            "invoice_number": invoice_number,
            "refund_amount": refund_amount,
            "reason": reason
        }
    )
    await event_bus.publish(event)

async def publish_purchase_order_created(
    order_id: str,
    order_no: str,
    supplier_id: str,
    grand_total: float,
    item_count: int,
    company_id: str,
):
    event = DomainEvent(
        event_id=f"evt_po_{int(datetime.utcnow().timestamp())}",
        event_type="PurchaseOrderCreated",
        payload={
            "order_id": order_id,
            "order_no": order_no,
            "supplier_id": supplier_id,
            "grand_total": grand_total,
            "item_count": item_count,
            "company_id": company_id,
        }
    )
    await event_bus.publish(event)

async def publish_grn_completed(
    receipt_id: str,
    receipt_no: str,
    supplier_id: str,
    order_id: str,
    grand_total: float,
    item_count: int,
    company_id: str,
):
    event = DomainEvent(
        event_id=f"evt_grn_{int(datetime.utcnow().timestamp())}",
        event_type="GRNCompleted",
        payload={
            "receipt_id": receipt_id,
            "receipt_no": receipt_no,
            "supplier_id": supplier_id,
            "order_id": order_id,
            "grand_total": grand_total,
            "item_count": item_count,
            "company_id": company_id,
        }
    )
    await event_bus.publish(event)

async def publish_customer_created(
    customer_id: str,
    customer_name: str,
    mobile: str = None,
    email: str = None,
    company_id: str = None,
):
    event = DomainEvent(
        event_id=f"evt_cust_{int(datetime.utcnow().timestamp())}",
        event_type="CustomerCreated",
        payload={
            "customer_id": customer_id,
            "customer_name": customer_name,
            "mobile": mobile,
            "email": email,
            "company_id": company_id,
        }
    )
    await event_bus.publish(event)

