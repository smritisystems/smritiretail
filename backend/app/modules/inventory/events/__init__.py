"""
Project      : SMRITI Retail OS
Module       : Inventory Domain Event Subscriptions (ADR-007 & GR-003)
Author       : Jawahar Ramkripal Mallah
"""
from app.core.events.domain_events import event_bus, DomainEvent
import logging

logger = logging.getLogger("smriti.inventory.events")


async def _on_stock_adjusted(event: DomainEvent):
    logger.info(
        f"[INVENTORY] StockAdjusted received: product={event.payload.get('product_id')} "
        f"delta={event.payload.get('quantity_delta')} reason={event.payload.get('reason')}"
    )


def register_subscriptions():
    event_bus.subscribe("StockAdjusted", _on_stock_adjusted)
    logger.info("[INVENTORY] Domain event subscriptions registered.")
