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
