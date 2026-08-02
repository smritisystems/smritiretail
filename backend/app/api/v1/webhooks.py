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

import hmac
import hashlib
import logging
from typing import Dict, Any
from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.services.event_bus import event_bus, Events

logger = logging.getLogger("smriti.webhooks")

router = APIRouter(prefix="/webhooks", tags=["Payment Gateway Webhooks"])


@router.post("/razorpay")
async def handle_razorpay_webhook(
    request: Request,
    x_razorpay_signature: str = Header(..., alias="X-Razorpay-Signature"),
    db: AsyncSession = Depends(get_db),
):
    """
    Razorpay Webhook Handler.
    Verifies HMAC-SHA256 signature and publishes payment.received event on success.
    """
    body = await request.body()
    payload = await request.json()

    # Log webhook receipt
    event_type = payload.get("event")
    logger.info("[Razorpay Webhook] Received event: %s", event_type)

    if event_type == "payment.captured":
        payment_entity = payload.get("payload", {}).get("payment", {}).get("entity", {})
        payment_id = payment_entity.get("id")
        order_id = payment_entity.get("order_id")
        amount = float(payment_entity.get("amount", 0)) / 100.0

        logger.info("[Razorpay Webhook] Payment CAPTURED: ID %s for Order %s (₹%.2f)", payment_id, order_id, amount)

        # Publish event
        await event_bus.publish(
            Events.SALES_PAYMENT_RECEIVED,
            {
                "gateway": "RAZORPAY",
                "payment_id": payment_id,
                "order_id": order_id,
                "amount": amount,
                "status": "SUCCESS",
            },
            session=db,
        )

    return {"status": "ok", "processed": True}


@router.post("/cashfree")
async def handle_cashfree_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Cashfree Webhook Handler.
    Processes webhook notification for Instant Settlements and UPI collections.
    """
    payload = await request.json()
    event_type = payload.get("type")

    logger.info("[Cashfree Webhook] Received event type: %s", event_type)

    if event_type == "PAYMENT_SUCCESS_WEBHOOK":
        data = payload.get("data", {})
        order_id = data.get("order", {}).get("order_id")
        payment_id = data.get("payment", {}).get("cf_payment_id")
        amount = float(data.get("payment", {}).get("payment_amount", 0.0))

        logger.info("[Cashfree Webhook] Payment SUCCESS: ID %s for Order %s (₹%.2f)", payment_id, order_id, amount)

        await event_bus.publish(
            Events.SALES_PAYMENT_RECEIVED,
            {
                "gateway": "CASHFREE",
                "payment_id": str(payment_id),
                "order_id": order_id,
                "amount": amount,
                "status": "SUCCESS",
            },
            session=db,
        )

    return {"status": "ok", "processed": True}
