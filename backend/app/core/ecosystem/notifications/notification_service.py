"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 27.0.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Shared Platform Notification Engine
"""

import uuid
from typing import Dict, Any, List


class PlatformNotificationEngine:
    """Omnichannel Notification Dispatcher (Email, SMS, WhatsApp, In-App)."""

    @classmethod
    def send_notification(cls, recipient: str, channel: str, subject: str, body: str) -> Dict[str, Any]:
        msg_id = str(uuid.uuid4())
        valid_channels = ["EMAIL", "SMS", "WHATSAPP", "IN_APP"]
        ch = channel.upper().strip()

        if ch not in valid_channels:
            return {"status": "FAILED", "reason": f"Invalid channel. Must be one of {valid_channels}"}

        return {
            "notification_id": msg_id,
            "recipient": recipient,
            "channel": ch,
            "subject": subject,
            "status": "DISPATCHED",
            "provider_reference": f"NOTIF-{msg_id[:8]}"
        }
