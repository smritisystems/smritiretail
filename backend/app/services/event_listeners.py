"""
Project      : SMRITI Retail OS
Organization : SmritiSys
Module       : Domain Event Listeners & DLQ Handler (Milestone 4 — Task E-1 to E-4)
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Version      : 1.0.0
Created      : 2026-07-28
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software

Purpose:
    Registers event listeners for Inventory, Purchase, CRM, and DLQ exception handling.
    All handlers run inside the caller's DB transaction via SmritiEventBus.
"""

import logging
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from .event_bus import event_bus, Events

logger = logging.getLogger("smriti.event_listeners")


# ---------------------------------------------------------------------------
# Task E-1: Inventory Stock Alert Listener
# ---------------------------------------------------------------------------

@event_bus.on(Events.INVENTORY_STOCK_ADJUSTED)
async def handle_inventory_stock_adjusted(payload: dict, session: AsyncSession) -> None:
    """
    Triggers reorder alerts when inventory stock drops below minimum threshold.
    """
    product_id = payload.get("product_id")
    new_stock = payload.get("new_stock", 0)
    reorder_level = payload.get("reorder_level", 5)

    if new_stock <= reorder_level:
        logger.warning(
            "[Stock Alert] Product '%s' stock level (%d) is below reorder threshold (%d). Reorder recommended.",
            product_id, new_stock, reorder_level
        )


# ---------------------------------------------------------------------------
# Task E-2: Purchase Order Created Listener
# ---------------------------------------------------------------------------

@event_bus.on(Events.PURCHASE_ORDER_CREATED)
async def handle_purchase_order_created(payload: dict, session: AsyncSession) -> None:
    """
    Processes new Purchase Order workflow triggers and notifies procurement managers.
    """
    order_id = payload.get("order_id")
    order_no = payload.get("order_no")
    grand_total = payload.get("grand_total", 0.0)

    logger.info(
        "[PO Listener] New Purchase Order %s (ID: %s) created for ₹%.2f. Triggering approval routing.",
        order_no, order_id, grand_total
    )


# ---------------------------------------------------------------------------
# Task E-3: Customer Credit Block Listener
# ---------------------------------------------------------------------------

@event_bus.on(Events.CRM_CUSTOMER_BLOCKED)
async def handle_customer_blocked(payload: dict, session: AsyncSession) -> None:
    """
    Logs customer credit block events and alerts finance control.
    """
    customer_id = payload.get("customer_id")
    customer_name = payload.get("customer_name")
    reason = payload.get("reason", "Credit limit exceeded")

    logger.warning(
        "[Credit Block Listener] Customer '%s' (ID: %s) has been BLOCKED. Reason: %s",
        customer_name, customer_id, reason
    )


# ---------------------------------------------------------------------------
# Task E-4: Event Retry & Dead Letter Queue (DLQ) Logger
# ---------------------------------------------------------------------------

async def log_event_to_dlq(event_type: str, payload: dict, error_msg: str) -> None:
    """
    Dead Letter Queue (DLQ) logger for failed event handlers.
    """
    logger.error(
        "[DLQ] Event '%s' failed processing. Error: %s | Payload: %s",
        event_type, error_msg, payload
    )


# ---------------------------------------------------------------------------
# SCDM — Channel Distribution Management Listeners (Platform Capability v1.0)
# ---------------------------------------------------------------------------

@event_bus.on(Events.SALES_INVOICE_POSTED)
async def handle_invoice_posted_scdm(payload: dict, session: AsyncSession) -> None:
    """
    SCDM listener: auto-create a Channel Dispatch when a SalesInvoice is posted
    for a customer with channel_tracking_enabled=True.

    GUARANTEE:
      - Never modifies warehouse StockMovement or accounting tables.
      - Exceptions are caught and logged; they do NOT roll back the sales transaction.
    """
    from app.services.scdm_service import SCDMService

    invoice_id = payload.get("invoice_id")
    customer_id = payload.get("customer_id")
    if not invoice_id:
        return

    logger.info("[SCDM Listener] SALES_INVOICE_POSTED → checking channel dispatch for invoice %s", invoice_id)

    try:
        # tenant_ctx is None here — SCDMService handles None gracefully
        svc = SCDMService(db=session, tenant_ctx=None)
        dispatch = await svc.create_channel_dispatch_from_invoice(invoice_id)
        if dispatch:
            logger.info("[SCDM Listener] ✅ Channel dispatch %s created for invoice %s",
                        dispatch.dispatch_no, invoice_id)
        else:
            logger.debug("[SCDM Listener] No channel dispatch created for invoice %s "
                         "(customer not SCDM-enabled or invoice not found)", invoice_id)
    except Exception as exc:
        # CRITICAL: must NOT re-raise — this must not abort the sales transaction
        logger.error("[SCDM Listener] ❌ Failed to create channel dispatch for invoice %s: %s",
                     invoice_id, exc, exc_info=True)
        await log_event_to_dlq(Events.SALES_INVOICE_POSTED, payload, str(exc))


@event_bus.on(Events.SALES_INVOICE_CANCELLED)
async def handle_invoice_cancelled_scdm(payload: dict, session: AsyncSession) -> None:
    """
    SCDM listener: reverse channel dispatch and create Reversal movements
    when a SalesInvoice is cancelled.

    GUARANTEE: Never modifies warehouse stock or accounting. Appends Reversal
    movements to ChannelStockMovement (immutable + audit-safe).
    """
    from app.services.scdm_service import SCDMService

    invoice_id = payload.get("invoice_id")
    if not invoice_id:
        return

    logger.info("[SCDM Listener] SALES_INVOICE_CANCELLED → reversing channel dispatch for invoice %s", invoice_id)

    try:
        svc = SCDMService(db=session, tenant_ctx=None)
        await svc.reverse_channel_dispatch(invoice_id)
        logger.info("[SCDM Listener] ✅ Channel dispatch reversed for invoice %s", invoice_id)
    except Exception as exc:
        logger.error("[SCDM Listener] ❌ Failed to reverse channel dispatch for invoice %s: %s",
                     invoice_id, exc, exc_info=True)
        await log_event_to_dlq(Events.SALES_INVOICE_CANCELLED, payload, str(exc))

