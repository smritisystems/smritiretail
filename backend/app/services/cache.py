"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.25.0
Created      : 2026-07-19
Modified     : 2026-07-19
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import json
import logging
import time
from abc import ABC, abstractmethod

import redis.asyncio as aioredis
from redis.exceptions import RedisError

logger = logging.getLogger("smriti.cache")


class BasePermissionCache(ABC):
    """
    Abstract Base Class for Permission Cache Providers.
    """
    @abstractmethod
    async def get(self, user_id: str) -> set[str] | None:
        """Retrieve resolved permission codes for a user."""
        pass

    @abstractmethod
    async def set(self, user_id: str, permissions: set[str], ttl: int | None = None) -> None:
        """Cache resolved permission codes for a user."""
        pass

    @abstractmethod
    async def invalidate(self, user_id: str) -> None:
        """Invalidate cache for a specific user."""
        pass

    @abstractmethod
    async def clear(self) -> None:
        """Clear all cached permissions globally."""
        pass

    @abstractmethod
    async def get_metrics(self) -> dict[str, int]:
        """Get cache hits, misses, evictions, invalidations metrics."""
        pass


class MemoryPermissionCache(BasePermissionCache):
    """
    In-memory Permission Cache Provider.
    """
    def __init__(self, default_ttl: int = 300):
        self.default_ttl = default_ttl
        self._store: dict[str, tuple[set[str], float]] = {}  # user_id -> (permissions, expires_at)
        self.hits = 0
        self.misses = 0
        self.invalidations = 0
        self.evictions = 0

    async def get(self, user_id: str) -> set[str] | None:
        if user_id not in self._store:
            self.misses += 1
            return None
        permissions, expires_at = self._store[user_id]
        if time.time() > expires_at:
            del self._store[user_id]
            self.evictions += 1
            self.misses += 1
            return None
        self.hits += 1
        return permissions

    async def set(self, user_id: str, permissions: set[str], ttl: int | None = None) -> None:
        ttl_val = ttl if ttl is not None else self.default_ttl
        expires_at = time.time() + ttl_val
        self._store[user_id] = (permissions, expires_at)

    async def invalidate(self, user_id: str) -> None:
        if user_id in self._store:
            del self._store[user_id]
            self.invalidations += 1

    async def clear(self) -> None:
        self._store.clear()

    async def get_metrics(self) -> dict[str, int]:
        return {
            "hits": self.hits,
            "misses": self.misses,
            "invalidations": self.invalidations,
            "evictions": self.evictions
        }


class RedisPermissionCache(BasePermissionCache):
    """
    Redis-based Permission Cache Provider with Memory fallback.
    """
    def __init__(
        self,
        redis_url: str,
        default_ttl: int = 300,
        prefix: str = "smriti",
        version: int = 1,
        failover_to_memory: bool = True
    ):
        self.redis_url = redis_url
        self.default_ttl = default_ttl
        self.prefix = prefix
        self.version = version
        self.failover_to_memory = failover_to_memory

        self.hits = 0
        self.misses = 0
        self.invalidations = 0
        self.redis_errors = 0

        self._redis = aioredis.from_url(redis_url, decode_responses=True)
        self._fallback_cache = MemoryPermissionCache(default_ttl=default_ttl)
        self._redis_disabled_until = 0.0

    def _get_key(self, user_id: str) -> str:
        return f"{self.prefix}:v{self.version}:permissions:user:{user_id}"

    def _should_use_fallback(self) -> bool:
        if not self.failover_to_memory:
            return False
        return time.time() < self._redis_disabled_until

    def _trigger_failover(self, error: Exception):
        logger.warning(
            f"Redis permission cache connection failure. Failing over to memory cache for 60s. Error: {error}"
        )
        self.redis_errors += 1
        self._redis_disabled_until = time.time() + 60.0

    async def get(self, user_id: str) -> set[str] | None:
        if self._should_use_fallback():
            return await self._fallback_cache.get(user_id)

        key = self._get_key(user_id)
        try:
            val = await self._redis.get(key)
            if val is None:
                self.misses += 1
                return None
            self.hits += 1
            permissions_list = json.loads(val)
            return set(permissions_list)
        except (RedisError, ConnectionError, OSError) as e:
            self._trigger_failover(e)
            if self.failover_to_memory:
                return await self._fallback_cache.get(user_id)
            raise e

    async def set(self, user_id: str, permissions: set[str], ttl: int | None = None) -> None:
        # Pre-populate fallback cache in case we need it during failover
        await self._fallback_cache.set(user_id, permissions, ttl)

        if self._should_use_fallback():
            return

        key = self._get_key(user_id)
        ttl_val = ttl if ttl is not None else self.default_ttl
        try:
            val = json.dumps(list(permissions))
            await self._redis.set(key, val, ex=ttl_val)
        except (RedisError, ConnectionError, OSError) as e:
            self._trigger_failover(e)
            if not self.failover_to_memory:
                raise e

    async def invalidate(self, user_id: str) -> None:
        await self._fallback_cache.invalidate(user_id)

        if self._should_use_fallback():
            return

        key = self._get_key(user_id)
        try:
            await self._redis.delete(key)
            self.invalidations += 1
        except (RedisError, ConnectionError, OSError) as e:
            self._trigger_failover(e)
            if not self.failover_to_memory:
                raise e

    async def clear(self) -> None:
        await self._fallback_cache.clear()

        if self._should_use_fallback():
            return

        pattern = f"{self.prefix}:v{self.version}:permissions:user:*"
        try:
            cursor = 0
            while True:
                cursor, keys = await self._redis.scan(cursor=cursor, match=pattern, count=100)
                if keys:
                    await self._redis.delete(*keys)
                if cursor == 0:
                    break
        except (RedisError, ConnectionError, OSError) as e:
            self._trigger_failover(e)
            if not self.failover_to_memory:
                raise e

    async def get_metrics(self) -> dict[str, int]:
        redis_metrics = {
            "hits": self.hits,
            "misses": self.misses,
            "invalidations": self.invalidations,
            "redis_errors": self.redis_errors,
            "using_fallback": 1 if self._should_use_fallback() else 0
        }
        fallback_metrics = await self._fallback_cache.get_metrics()
        return {
            "redis_hits": redis_metrics["hits"],
            "redis_misses": redis_metrics["misses"],
            "redis_invalidations": redis_metrics["invalidations"],
            "redis_errors": redis_metrics["redis_errors"],
            "redis_using_fallback": redis_metrics["using_fallback"],
            "memory_hits": fallback_metrics["hits"],
            "memory_misses": fallback_metrics["misses"],
            "memory_invalidations": fallback_metrics["invalidations"],
            "memory_evictions": fallback_metrics["evictions"]
        }


class PermissionCacheFactory:
    """
    Factory to retrieve the configured permission cache provider singleton instance.
    """
    _instance: BasePermissionCache | None = None

    @classmethod
    def get_provider(cls) -> BasePermissionCache:
        if cls._instance is None:
            from app.core.config import settings
            if settings.USE_REDIS_CACHE:
                cls._instance = RedisPermissionCache(
                    redis_url=settings.REDIS_URL,
                    default_ttl=settings.PERMISSION_CACHE_TTL,
                    prefix=settings.CACHE_PREFIX,
                    version=settings.CACHE_VERSION,
                    failover_to_memory=settings.CACHE_FAILOVER_TO_MEMORY
                )
            else:
                cls._instance = MemoryPermissionCache(
                    default_ttl=settings.PERMISSION_CACHE_TTL
                )
        return cls._instance

    @classmethod
    def reset_provider(cls) -> None:
        """Reset the cached provider instance."""
        cls._instance = None
