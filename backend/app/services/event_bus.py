"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.27.0
Created      : 2026-07-19
Modified     : 2026-07-19
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software

SmritiEventBus -- Synchronous domain event bus for SMRITI Retail OS.

Architecture:
  v3.27.0: Synchronous in-process handlers (simple, reliable, testable)
  v4.x:    Drop-in replacement with async Celery/Redis workers

Usage:
    from app.services.event_bus import event_bus

    # Register a handler (at app startup)
    @event_bus.on("consignment.transfer.created")
    async def handle_transfer(payload: dict, session: AsyncSession):
        ...

    # Publish an event (inside a service method, within a transaction)
    await event_bus.publish("consignment.transfer.created", {
        "transfer_id": transfer.id,
        "partner_id": transfer.partner_id,
        "items": [...],
    }, session)

Events are published synchronously within the caller's transaction.
If any handler raises, the transaction rolls back. This ensures atomicity.
"""

import logging
from collections import defaultdict
from typing import Callable, Awaitable
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger("smriti.event_bus")


# ---------------------------------------------------------------------------
# Canonical event names (all events in SMRITI must use these constants)
# ---------------------------------------------------------------------------

class Events:
    # Consignment / Modern Trade
    CONSIGNMENT_TRANSFER_CREATED          = "consignment.transfer.created"
    CONSIGNMENT_TRANSFER_DISPATCHED       = "consignment.transfer.dispatched"
    CONSIGNMENT_SALE_REPORT_SUBMITTED     = "consignment.sale_report.submitted"
    CONSIGNMENT_SETTLEMENT_AGREED         = "consignment.settlement.agreed"
    CONSIGNMENT_PAYMENT_RECEIVED          = "consignment.payment.received"
    CONSIGNMENT_RETURN_PROCESSED          = "consignment.return.processed"
    CONSIGNMENT_TRANSFER_CLOSED           = "consignment.transfer.closed"

    # Sales
    SALES_INVOICE_CREATED                 = "sales.invoice.created"
    SALES_INVOICE_POSTED                  = "sales.invoice.posted"
    SALES_INVOICE_CANCELLED               = "sales.invoice.cancelled"
    SALES_PAYMENT_RECEIVED                = "sales.payment.received"
    SALES_RETURN_CREATED                  = "sales.return.created"

    # Purchase
    PURCHASE_ORDER_CREATED                = "purchase.order.created"
    PURCHASE_GRN_CREATED                  = "purchase.grn.created"
    PURCHASE_PAYMENT_MADE                 = "purchase.payment.made"

    # Inventory
    INVENTORY_STOCK_REDUCED               = "inventory.stock.reduced"
    INVENTORY_STOCK_RESTORED              = "inventory.stock.restored"
    INVENTORY_STOCK_ADJUSTED              = "inventory.stock.adjusted"

    # CRM
    CRM_CUSTOMER_CREATED                  = "crm.customer.created"
    CRM_CUSTOMER_BLOCKED                  = "crm.customer.blocked"

    # Security / Auth
    AUTH_USER_LOGIN                       = "auth.user.login"
    AUTH_USER_LOGOUT                      = "auth.user.logout"
    AUTH_PERMISSION_DENIED                = "auth.permission.denied"


HandlerFn = Callable[[dict, AsyncSession], Awaitable[None]]


class SmritiEventBus:
    """
    Synchronous domain event bus.

    Handlers are async functions called in registration order.
    All handlers run inside the caller's DB transaction.
    """

    def __init__(self) -> None:
        self._handlers: dict[str, list[HandlerFn]] = defaultdict(list)

    def on(self, event_type: str) -> Callable[[HandlerFn], HandlerFn]:
        """Decorator to register an async event handler."""
        def decorator(fn: HandlerFn) -> HandlerFn:
            self._handlers[event_type].append(fn)
            logger.debug("EventBus: registered handler '%s' for event '%s'",
                         fn.__name__, event_type)
            return fn
        return decorator

    def subscribe(self, event_type: str, handler: HandlerFn) -> None:
        """Programmatic handler registration (alternative to @event_bus.on)."""
        self._handlers[event_type].append(handler)

    async def publish(
        self,
        event_type: str,
        payload: dict,
        session: AsyncSession,
    ) -> None:
        """
        Publish an event to all registered handlers synchronously.

        Args:
            event_type: Event name constant from Events class
            payload:    Event data dict (must be JSON-serialisable)
            session:    Current DB session (handlers may read/write within the transaction)

        Raises:
            Any exception from a handler propagates upward and rolls back the transaction.
        """
        handlers = self._handlers.get(event_type, [])
        if not handlers:
            logger.debug("EventBus: no handlers for event '%s'", event_type)
            return

        logger.info("EventBus: publishing '%s' to %d handler(s)", event_type, len(handlers))
        for handler in handlers:
            await handler(payload, session)

    def handler_count(self, event_type: str) -> int:
        return len(self._handlers.get(event_type, []))


# Module-level singleton
event_bus = SmritiEventBus()
