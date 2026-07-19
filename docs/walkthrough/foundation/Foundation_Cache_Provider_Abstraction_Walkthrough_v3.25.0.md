<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.25.0
  Created      : 2026-07-19
  Modified     : 2026-07-19
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Foundation Cache Provider Abstraction v3.25.0

## 1. Purpose
Introduce a clean cache provider abstraction to isolate the security and access control engine from the concrete caching implementation. This ensures SMRITI Retail OS can run with standard local memory caching for simple or local development installations while seamlessly scaling to Redis-based caching in distributed multi-worker enterprise environments.

## 2. Scope
This walkthrough covers:
* Defining the `BasePermissionCache` interface.
* Implementing `MemoryPermissionCache` (with TTL support and metrics counters).
* Implementing `RedisPermissionCache` (with namespace formatting, try-except failover to memory cache, and telemetry metrics).
* Implementing `PermissionCacheFactory` to retrieve the active singleton cache provider.
* Integrating the cache provider inside `SecurityService`.
* Implementing unit tests validating TTL expiration, telemetry metrics, and Redis auto-failover capability.

## 3. Files Created
* [cache.py](file:///f:/SMRITRretailNXmgrt/backend/app/services/cache.py) — Defines `BasePermissionCache`, concrete implementations (`MemoryPermissionCache`, `RedisPermissionCache`), and `PermissionCacheFactory`.

## 4. Files Modified
* [config.py](file:///f:/SMRITRretailNXmgrt/backend/app/core/config.py) — Added settings variables (`USE_REDIS_CACHE`, `REDIS_URL`, `PERMISSION_CACHE_TTL`, `CACHE_PREFIX`, `CACHE_VERSION`, `CACHE_FAILOVER_TO_MEMORY`).
* [security.py](file:///f:/SMRITRretailNXmgrt/backend/app/services/security.py) — Refactored `SecurityService` cache lookups/invalidations to use the provider from `PermissionCacheFactory`.
* [test_security_engine.py](file:///f:/SMRITRretailNXmgrt/backend/app/tests/test_security_engine.py) — Updated cache clear operations to be awaited and added new unit tests for cache TTL, metrics, and failover behavior.

## 5. Architecture Decisions
* **Factory-Based Resolution:** The security service is decoupled from the actual cache implementation. It resolves the cache provider interface from `PermissionCacheFactory`.
* **Asynchronous Interface:** All cache methods (`get`, `set`, `invalidate`, `clear`) are asynchronous to native async calls in Redis and database tasks.
* **Namespace Formatting:** Redis keys follow structured paths (`{prefix}:v{version}:permissions:user:{user_id}`) to enable domain isolation and versioned namespace invalidation.

## 6. Design Rationale
* **Optional Redis Dependency:** Memory caching is retained as the default behavior. Developers do not need a Redis daemon running locally to run the test suite or development environment.
* **Auto-Failover with Cooldown:** If Redis goes offline, the cache provider logs a warning and routes all calls to the fallback memory cache for 60 seconds. This avoids blocking pos/checkout workflows with repeated connection timeout penalties.
* **Cache Expirations (TTL):** Standard cache entries decay after `PERMISSION_CACHE_TTL` (default: 5 minutes) preventing stale caches.

## 7. Implementation Summary
* `MemoryPermissionCache` uses standard Python dictionary storage mapped to timestamps to compute eviction checks.
* `RedisPermissionCache` serializes permission sets as JSON arrays and stores them as string values under namespaced keys.
* `PermissionCacheFactory` handles singleton management of the resolved provider.

## 8. Tests Executed
* `python -m pytest backend/app/tests/test_security_engine.py` (which includes 5 tests: 3 existing security tests + 2 new caching tests).

## 9. Verification Results
```text
============================= test session starts =============================
platform win32 -- Python 3.14.3, pytest-9.0.2, pluggy-1.6.0
rootdir: F:\SMRITRretailNXmgrt\backend
configfile: pyproject.toml
plugins: anyio-4.12.1, langsmith-0.8.5, asyncio-1.3.0
asyncio: mode=Mode.AUTO, debug=False, asyncio_default_fixture_loop_scope=None, asyncio_default_test_loop_scope=function
collected 5 items

backend\app\tests\test_security_engine.py .....                          [100%]

======================== 5 passed, 9 warnings in 5.43s ========================
```

## 10. Known Limitations
* Scan commands in Redis for `clear()` operate synchronously under the async scan loop, which can cause minor latency if there are millions of keys. (Mitigated by prefix namespacing and low key count in typical installs).

## 11. Future Work
* Integrate distributed eviction policies across multiple app workers using Redis pub/sub.

## 12. Related ADRs
* None.

## 13. Related RFCs
* None.
