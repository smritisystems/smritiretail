"""
Project      : SMRITI Retail OS
Module       : Accounting Domain Event Subscriptions (ADR-007 & GR-003)
Author       : Jawahar Ramkripal Mallah
"""
from app.core.events.domain_events import event_bus, DomainEvent
import logging

logger = logging.getLogger("smriti.accounting.events")


async def _on_sale_completed_for_ledger(event: DomainEvent):
    logger.info(
        f"[ACCOUNTING] SaleCompleted → Ledger update triggered: invoice={event.payload.get('invoice_number')} "
        f"total={event.payload.get('total_amount')}"
    )


async def _on_invoice_cancelled_for_ledger(event: DomainEvent):
    logger.info(
        f"[ACCOUNTING] InvoiceCancelled → Ledger reversal triggered: invoice={event.payload.get('invoice_number')} "
        f"refund={event.payload.get('refund_amount')}"
    )


def register_subscriptions():
    event_bus.subscribe("SaleCompleted", _on_sale_completed_for_ledger)
    event_bus.subscribe("InvoiceCancelled", _on_invoice_cancelled_for_ledger)
    logger.info("[ACCOUNTING] Domain event subscriptions registered.")
