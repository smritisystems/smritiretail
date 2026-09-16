"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.30.1
Created      : 2026-09-16
Modified     : 2026-09-16
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

Rate Limiting Middleware — SMRITI Retail OS
Uses slowapi (in-process, per-worker) for request rate limiting keyed on:
  - Tenant (X-Company-ID header) for business API endpoints
  - Client IP for auth endpoints (anonymous-safe)

Limits are designed for a typical retail branch with:
  - High-frequency POS billing and barcode scanning
  - Moderate-frequency report generation
  - Low-frequency auth/admin operations
"""

from fastapi import Request

try:
    from slowapi import Limiter
    from slowapi.util import get_remote_address
    SLOWAPI_AVAILABLE = True
except ImportError:
    SLOWAPI_AVAILABLE = False

    class Limiter:  # type: ignore
        def __init__(self, *args, **kwargs):
            pass

        def limit(self, *args, **kwargs):
            def decorator(func):
                return func
            return decorator

    def get_remote_address(request: Request) -> str:  # type: ignore
        return getattr(request.client, "host", "127.0.0.1") if request.client else "127.0.0.1"


def _get_tenant_key(request: Request) -> str:
    """
    Rate limit key function.
    Uses X-Company-ID for authenticated tenant-scoped endpoints.
    Falls back to remote IP for unauthenticated endpoints (e.g., login).
    """
    company_id = request.headers.get("X-Company-ID", "").strip()
    if company_id:
        return f"tenant:{company_id}"
    return f"ip:{get_remote_address(request)}"


# ---------------------------------------------------------------------------
# Singleton limiter instance — attach to FastAPI app via SlowAPIMiddleware
# ---------------------------------------------------------------------------
limiter = Limiter(
    key_func=_get_tenant_key,
    default_limits=["300/minute"],   # Default ceiling for all unlisted endpoints
    headers_enabled=True,            # Expose X-RateLimit-* headers to clients
)

# ---------------------------------------------------------------------------
# Endpoint-category rate limit decorators for use in router files
# ---------------------------------------------------------------------------

# Auth endpoints (IP-scoped, strict)
AUTH_LIMIT = "5/minute"

# POS / Billing (high-frequency real-time scanning)
POS_LIMIT = "200/minute"

# Heavy reports (DB-intensive queries)
REPORT_LIMIT = "20/minute"

# General API read operations
API_READ_LIMIT = "300/minute"

# General API write operations (invoices, purchase orders)
API_WRITE_LIMIT = "120/minute"


def get_limiter() -> Limiter:
    """Returns the singleton SMRITI rate limiter instance."""
    return limiter
