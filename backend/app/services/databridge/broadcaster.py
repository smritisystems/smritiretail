"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-10-07
Modified     : 2026-10-07
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal — Foundation Service
"""

# smriti_capability(entity="DATABRIDGE", capability="DATABRIDGE_TELEMETRY_BROADCASTER", role="SERVICE", canonicalOwner="backend/app/services/databridge/broadcaster.py")

import asyncio
import json
from datetime import datetime, timezone
from typing import Dict, Set, Any, List, Optional, Union
from fastapi import WebSocket

from .models import DataBridgeProgressFrame


class DataBridgeBroadcaster:
    """
    In-Memory Pub/Sub Telemetry Broadcaster for SMRITI DataBridge.
    Maintains real-time WebSocket subscriptions partitioned by job_id,
    delivering sub-second progress frames and handling automatic subscriber cleanup.
    """

    # job_id -> Set of active connected WebSockets
    _subscribers: Dict[str, Set[WebSocket]] = {}
    _lock = asyncio.Lock()

    @classmethod
    async def subscribe(cls, job_id: str, websocket: WebSocket) -> None:
        """Registers a connected WebSocket client to listen for job progress frames."""
        async with cls._lock:
            if job_id not in cls._subscribers:
                cls._subscribers[job_id] = set()
            cls._subscribers[job_id].add(websocket)

    @classmethod
    async def unsubscribe(cls, job_id: str, websocket: WebSocket) -> None:
        """Removes a disconnected or finished WebSocket client."""
        async with cls._lock:
            if job_id in cls._subscribers:
                cls._subscribers[job_id].discard(websocket)
                if not cls._subscribers[job_id]:
                    del cls._subscribers[job_id]

    @classmethod
    def subscriber_count(cls, job_id: str) -> int:
        """Returns the number of active listeners for a given job."""
        return len(cls._subscribers.get(job_id, set()))

    @classmethod
    def has_subscribers(cls, job_id: str) -> bool:
        """Checks if any active WebSocket listeners exist for a given job."""
        return bool(cls._subscribers.get(job_id))

    @classmethod
    def get_active_jobs(cls) -> List[str]:
        """Returns a list of all job IDs currently being listened to."""
        return list(cls._subscribers.keys())

    @classmethod
    async def broadcast_progress(
        cls,
        job_id: str,
        frame: Union[DataBridgeProgressFrame, Dict[str, Any]],
    ) -> int:
        """
        Broadcasts a progress telemetry frame to all active listeners of job_id.
        Automatically catches disconnected/dead sockets and purges them.
        Returns the number of successful deliveries.
        """
        active_sockets = list(cls._subscribers.get(job_id, set()))
        if not active_sockets:
            return 0

        # Serialize frame to JSON payload
        if isinstance(frame, DataBridgeProgressFrame):
            payload_str = frame.model_dump_json()
        elif isinstance(frame, dict):
            if "timestamp" not in frame:
                frame["timestamp"] = datetime.now(timezone.utc).isoformat()
            payload_str = json.dumps(frame)
        else:
            payload_str = json.dumps(str(frame))

        dead_sockets: List[WebSocket] = []
        delivered = 0

        for ws in active_sockets:
            try:
                await ws.send_text(payload_str)
                delivered += 1
            except Exception:
                dead_sockets.append(ws)

        # Purge dead sockets
        if dead_sockets:
            async with cls._lock:
                for dead in dead_sockets:
                    if job_id in cls._subscribers:
                        cls._subscribers[job_id].discard(dead)
                if job_id in cls._subscribers and not cls._subscribers[job_id]:
                    del cls._subscribers[job_id]

        return delivered

    @classmethod
    async def clear_all(cls) -> None:
        """Clears all active subscriptions (used primarily for test isolation)."""
        async with cls._lock:
            cls._subscribers.clear()
