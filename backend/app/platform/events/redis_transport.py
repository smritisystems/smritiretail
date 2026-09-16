"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.27.2
Created      : 2026-09-16
Modified     : 2026-09-16
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Platform Kernel Event Transport — Distributed
"""

import asyncio
import logging
from typing import Callable, Awaitable, Dict, List, Optional, Any
import redis.asyncio as aioredis

from .transport import IEventTransport
from .idempotency import IIdempotencyStore, IdempotencyRecord

logger = logging.getLogger("smriti.platform.events.redis_transport")


class RedisStreamTransport(IEventTransport):
    """
    Distributed Redis Streams event transport for horizontally scaled, multi-worker
    production deployments. Implements IEventTransport boundary.
    """

    def __init__(
        self,
        redis_url: str = "redis://localhost:6379/0",
        stream_prefix: str = "smriti:events:",
        consumer_group: str = "smriti_workers",
    ):
        self._redis_url = redis_url
        self._stream_prefix = stream_prefix
        self._consumer_group = consumer_group
        self._client: Optional[aioredis.Redis] = None
        self._running = False
        self._subscriber_tasks: List[asyncio.Task] = []
        self._subscriptions: Dict[str, List[Callable[[bytes], Awaitable[None]]]] = {}

    async def start(self) -> None:
        if self._running:
            return
        self._client = aioredis.from_url(
            self._redis_url,
            decode_responses=False,
            auto_close_connection_pool=True,
        )
        self._running = True
        logger.info("RedisStreamTransport started connected to %s", self._redis_url)

    async def stop(self) -> None:
        self._running = False
        for task in self._subscriber_tasks:
            task.cancel()
        if self._subscriber_tasks:
            await asyncio.gather(*self._subscriber_tasks, return_exceptions=True)
        self._subscriber_tasks.clear()

        if self._client:
            await self._client.aclose()
            self._client = None
        self._subscriptions.clear()
        logger.info("RedisStreamTransport stopped gracefully.")

    def _stream_name(self, topic: str) -> str:
        return f"{self._stream_prefix}{topic}"

    async def publish(self, topic: str, envelope_bytes: bytes) -> None:
        if not self._running or not self._client:
            raise RuntimeError("Cannot publish to RedisStreamTransport while stopped.")

        stream_key = self._stream_name(topic)
        await self._client.xadd(stream_key, {b"payload": envelope_bytes})

    async def subscribe(
        self, topic_pattern: str, handler: Callable[[bytes], Awaitable[None]]
    ) -> None:
        if topic_pattern not in self._subscriptions:
            self._subscriptions[topic_pattern] = []
        self._subscriptions[topic_pattern].append(handler)

        if self._running:
            task = asyncio.create_task(self._consume_loop(topic_pattern, handler))
            self._subscriber_tasks.append(task)

    async def _consume_loop(
        self, topic: str, handler: Callable[[bytes], Awaitable[None]]
    ) -> None:
        stream_key = self._stream_name(topic)
        last_id = "$"
        while self._running and self._client:
            try:
                streams = await self._client.xread({stream_key: last_id}, count=10, block=2000)
                if not streams:
                    continue
                for _, messages in streams:
                    for msg_id, data in messages:
                        last_id = msg_id
                        payload = data.get(b"payload")
                        if payload:
                            try:
                                await handler(payload)
                            except Exception as ex:
                                logger.exception("Error executing subscriber handler for %s: %s", topic, ex)
            except asyncio.CancelledError:
                break
            except Exception as e:
                if self._running:
                    logger.warning("Redis stream read error on %s: %s, retrying...", stream_key, e)
                    await asyncio.sleep(1)


class RedisIdempotencyStore(IIdempotencyStore):
    """
    Distributed Redis-backed idempotency ledger for multi-instance production environments.
    """

    def __init__(self, redis_url: str = "redis://localhost:6379/0", ttl_seconds: int = 604800):
        self._redis_url = redis_url
        self._ttl_seconds = ttl_seconds
        self._client: Optional[aioredis.Redis] = None

    async def _get_client(self) -> aioredis.Redis:
        if self._client is None:
            self._client = aioredis.from_url(self._redis_url, decode_responses=True)
        return self._client

    def _key(self, event_id: str, consumer_id: str) -> str:
        return f"smriti:idemp:{consumer_id}:{event_id}"

    async def is_duplicate(self, event_id: str, consumer_id: str) -> bool:
        client = await self._get_client()
        return bool(await client.exists(self._key(event_id, consumer_id)))

    async def record_execution(
        self, event_id: str, consumer_id: str, result_payload: Optional[Any] = None
    ) -> None:
        client = await self._get_client()
        key = self._key(event_id, consumer_id)
        await client.set(key, "COMPLETED", ex=self._ttl_seconds)

    async def close(self) -> None:
        if self._client:
            await self._client.aclose()
            self._client = None
