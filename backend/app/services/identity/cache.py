"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.38.0
Created      : 2026-09-18
Modified     : 2026-09-18
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Core Architecture
"""

# smriti_capability(entity="IDENTITY", capability="UNIFIED_IDENTITY_CONTROL_PLANE", role="CORE", canonicalOwner="backend/app/services/identity/engine.py")

import time
import asyncio
from typing import Optional, Dict, Any, Tuple
from collections import OrderedDict


class IdentityResolutionCache:
    """
    High-Performance, Tenant-Isolated In-Memory Resolution Cache for SMRITI Unified Identity.
    Accelerates high-frequency retail POS barcode scans, SKU lookups, and transactional resolution.
    Features:
    - Multi-tenant key scoping: (tenant_id, company_id, normalized_identifier)
    - LRU eviction policy with bounded maximum capacity.
    - Time-to-Live (TTL) expiration per resolution tier.
    - Programmatic invalidation hooks on entity modification or alias creation.
    - Diagnostics and hit/miss telemetry.
    """

    def __init__(self, max_size: int = 10000, default_ttl_seconds: int = 300):
        self._max_size = max_size
        self._default_ttl = default_ttl_seconds
        self._cache: OrderedDict[Tuple[str, str, str], Tuple[Any, float]] = OrderedDict()
        self._lock = asyncio.Lock()
        self._hits = 0
        self._misses = 0
        self._evictions = 0

    def _normalize_key(self, identifier: str, tenant_id: Optional[str] = None, company_id: Optional[str] = None) -> Tuple[str, str, str]:
        tid = str(tenant_id or "").strip().lower()
        cid = str(company_id or "").strip().lower()
        ident = str(identifier or "").strip().lower()
        return (tid, cid, ident)

    async def get(
        self,
        identifier: str,
        tenant_id: Optional[str] = None,
        company_id: Optional[str] = None,
    ) -> Optional[Any]:
        key = self._normalize_key(identifier, tenant_id, company_id)
        now = time.time()

        async with self._lock:
            if key not in self._cache:
                self._misses += 1
                return None

            val, expiry = self._cache[key]
            if now > expiry:
                del self._cache[key]
                self._misses += 1
                return None

            # LRU hit: move to end
            self._cache.move_to_end(key)
            self._hits += 1
            return val

    async def set(
        self,
        identifier: str,
        value: Any,
        tenant_id: Optional[str] = None,
        company_id: Optional[str] = None,
        ttl_seconds: Optional[int] = None,
    ) -> None:
        key = self._normalize_key(identifier, tenant_id, company_id)
        ttl = ttl_seconds if ttl_seconds is not None else self._default_ttl
        expiry = time.time() + ttl

        async with self._lock:
            if key in self._cache:
                del self._cache[key]
            elif len(self._cache) >= self._max_size:
                # Evict least recently used (first item)
                self._cache.popitem(last=False)
                self._evictions += 1

            self._cache[key] = (value, expiry)

    async def invalidate(
        self,
        identifier: str,
        tenant_id: Optional[str] = None,
        company_id: Optional[str] = None,
    ) -> bool:
        """Invalidate a specific cached identifier."""
        key = self._normalize_key(identifier, tenant_id, company_id)
        async with self._lock:
            if key in self._cache:
                del self._cache[key]
                return True
            # Also purge any wildcard company match if company_id was specified
            purged = False
            if company_id:
                wildcard_key = (str(tenant_id or "").strip().lower(), "", str(identifier or "").strip().lower())
                if wildcard_key in self._cache:
                    del self._cache[wildcard_key]
                    purged = True
            return purged

    async def clear(self) -> None:
        """Purge all cached entries."""
        async with self._lock:
            self._cache.clear()

    async def get_stats(self) -> Dict[str, Any]:
        """Return diagnostic metrics."""
        async with self._lock:
            total_requests = self._hits + self._misses
            hit_ratio = (self._hits / total_requests) if total_requests > 0 else 0.0
            return {
                "size": len(self._cache),
                "max_size": self._max_size,
                "hits": self._hits,
                "misses": self._misses,
                "evictions": self._evictions,
                "hit_ratio_percent": round(hit_ratio * 100, 2),
            }


# Singleton Cache Instance
_GLOBAL_IDENTITY_CACHE = IdentityResolutionCache()


def get_identity_cache() -> IdentityResolutionCache:
    return _GLOBAL_IDENTITY_CACHE
