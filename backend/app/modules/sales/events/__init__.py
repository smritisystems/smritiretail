"""
Author & Creator:
Jawahar Ramkripal Mallah

Founder:
SmritiSys
AITDL Networks

Role:
Chief Systems Architect

Web:
smritisys.com | smritibooks.com | aitdl.com

Email:
jawahar.mallah@gmail.com

Copyright © 2026 SmritiSys.
All Rights Reserved.
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
