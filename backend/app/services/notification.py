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

NotificationService -- Shared platform notification routing engine.
Supports multiple dispatch channels:
  - InApp (toast/bell)
  - Email (stubbed)
  - WhatsApp (stubbed)
  - SMS (stubbed)
  - Webhook (stubbed)
"""

import logging
from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger("smriti.notification")

class NotificationChannels:
    IN_APP   = "in-app"
    EMAIL    = "email"
    WHATSAPP = "whatsapp"
    SMS      = "sms"
    WEBHOOK  = "webhook"

class NotificationService:
    """
    Centralized notification routing engine.
    Allows services to dispatch notifications without deciding delivery channels.
    """

    async def send(
        self,
        recipient_id: str,
        title: str,
        message: str,
        session: Optional[AsyncSession] = None,
        *,
        channels: Optional[List[str]] = None,
        context_data: Optional[Dict[str, Any]] = None,
        sender_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Send notification through designated channels.
        If no channels specified, defaults to IN_APP.
        """
        target_channels = channels or [NotificationChannels.IN_APP]
        results = {}

        logger.info(
            "NotificationService | Send | To: %s | Title: %s | Channels: %s",
            recipient_id, title, target_channels
        )

        for channel in target_channels:
            if channel == NotificationChannels.IN_APP:
                results[channel] = await self._send_in_app(recipient_id, title, message, context_data)
            elif channel == NotificationChannels.EMAIL:
                results[channel] = await self._send_email(recipient_id, title, message, context_data)
            elif channel == NotificationChannels.WHATSAPP:
                results[channel] = await self._send_whatsapp(recipient_id, message, context_data)
            elif channel == NotificationChannels.SMS:
                results[channel] = await self._send_sms(recipient_id, message, context_data)
            elif channel == NotificationChannels.WEBHOOK:
                results[channel] = await self._send_webhook(recipient_id, title, message, context_data)
            else:
                logger.warning("NotificationService | Unsupported channel: %s", channel)
                results[channel] = {"status": "Unsupported"}

        return results

    async def _send_in_app(
        self, recipient_id: str, title: str, message: str, context_data: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        # Log and return success. Toast UI fetches notifications or we emit via WebSocket.
        logger.debug("NotificationService [IN-APP] | To: %s | Msg: %s", recipient_id, message)
        return {"status": "Dispatched", "channel": "in-app", "delivered": True}

    async def _send_email(
        self, recipient_id: str, title: str, message: str, context_data: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        logger.debug("NotificationService [EMAIL Stub] | To: %s | Title: %s", recipient_id, title)
        return {"status": "Stubbed", "channel": "email", "delivered": False}

    async def _send_whatsapp(
        self, recipient_id: str, message: str, context_data: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        logger.debug("NotificationService [WHATSAPP Stub] | To: %s | Msg: %s", recipient_id, message)
        return {"status": "Stubbed", "channel": "whatsapp", "delivered": False}

    async def _send_sms(
        self, recipient_id: str, message: str, context_data: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        logger.debug("NotificationService [SMS Stub] | To: %s | Msg: %s", recipient_id, message)
        return {"status": "Stubbed", "channel": "sms", "delivered": False}

    async def _send_webhook(
        self, recipient_id: str, title: str, message: str, context_data: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        logger.debug("NotificationService [WEBHOOK Stub] | Ref: %s | Title: %s", recipient_id, title)
        return {"status": "Stubbed", "channel": "webhook", "delivered": False}

# Module-level singleton
notification_service = NotificationService()
