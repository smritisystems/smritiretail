"""
Project      : SMRITI Retail OS
Module       : Sales Domain Event Subscriptions (ADR-007 & GR-003)
Author       : Jawahar Ramkripal Mallah
"""
from app.core.events.domain_events import event_bus, DomainEvent
import logging

logger = logging.getLogger("smriti.sales.events")


async def _on_sale_completed(event: DomainEvent):
    logger.info(
        f"[SALES] SaleCompleted received: invoice={event.payload.get('invoice_number')} "
        f"total={event.payload.get('total_amount')} items={event.payload.get('item_count')}"
    )


def register_subscriptions():
    event_bus.subscribe("SaleCompleted", _on_sale_completed)
    logger.info("[SALES] Domain event subscriptions registered.")
