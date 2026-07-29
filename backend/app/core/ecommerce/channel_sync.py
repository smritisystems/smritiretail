"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 19.0.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Multi-Channel Store Integration Sync Engine
"""

import uuid
from typing import Dict, Any, List


class ChannelRecord:
    def __init__(self, channel_id: str, name: str, store_url: str):
        self.id = channel_id
        self.channel_name = name
        self.store_url = store_url
        self.sync_status = "CONNECTED"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "channel_name": self.channel_name,
            "store_url": self.store_url,
            "sync_status": self.sync_status
        }


class ChannelSyncEngine:
    """Multi-Channel Integration Sync Connector Engine."""

    _channels: Dict[str, ChannelRecord] = {}

    @classmethod
    def register_channel(cls, name: str, store_url: str) -> ChannelRecord:
        cid = str(uuid.uuid4())
        ch = ChannelRecord(cid, name.upper(), store_url)
        cls._channels[cid] = ch
        return ch

    @classmethod
    def list_channels(cls) -> List[Dict[str, Any]]:
        return [c.to_dict() for c in cls._channels.values()]
