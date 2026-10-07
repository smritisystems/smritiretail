"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-10-08
Modified     : 2026-10-08
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: API Gateway Middleware (RFC 8594 Legacy Deprecation Gateway)
"""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from ..services.legacy_product_telemetry import LegacyProductTelemetrySink

LEGACY_PATH_PREFIXES = (
    "/api/v1/products",
    "/api/v1/inventory/products",
    "/api/v1/variants",
)

EXCLUDED_EXACT_PREFIXES = (
    "/api/v1/product-identity",
    "/api/v1/product-resolution",
    "/api/v1/products/resolve",
)


class LegacyDeprecationMiddleware(BaseHTTPMiddleware):
    """
    RFC 8594 Compliant HTTP Deprecation Gateway Middleware.
    Intercepts calls to legacy product endpoints and attaches standard:
      - Deprecation: @1798761600 (RFC 8594 Unix epoch timestamp)
      - Sunset: Sat, 01 Jan 2028 00:00:00 GMT (RFC 8594 HTTP-date)
      - Link: </api/v1/universal/items>; rel="successor-version" (RFC 8288 Web Linking)
      - X-Smriti-Warning: SMRITI-DEPR-002: Legacy product endpoint is deprecated...
    and emits structured audit telemetry to LegacyProductTelemetrySink.
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        path = request.url.path

        is_legacy = False
        # Check if matches legacy prefixes but not modern resolution engines
        for prefix in LEGACY_PATH_PREFIXES:
            if path == prefix or path.startswith(f"{prefix}/"):
                is_excluded = any(path == exc or path.startswith(f"{exc}/") for exc in EXCLUDED_EXACT_PREFIXES)
                if not is_excluded:
                    is_legacy = True
                    break

        response: Response = await call_next(request)

        if is_legacy:
            response.headers["Deprecation"] = "@1798761600"
            response.headers["Sunset"] = "Sat, 01 Jan 2028 00:00:00 GMT"
            response.headers["Link"] = '</api/v1/universal/items>; rel="successor-version"'
            response.headers["X-Smriti-Warning"] = (
                "SMRITI-DEPR-002: Legacy product endpoint is deprecated; migrate to /api/v1/universal/items"
            )

            try:
                company_id = request.headers.get("X-Company-ID") or getattr(request.state, "company_id", None)
                client_ip = request.client.host if request.client else None
                LegacyProductTelemetrySink.record_endpoint_access(
                    path=path,
                    method=request.method,
                    client_ip=client_ip,
                    company_id=company_id,
                    successor_endpoint="/api/v1/universal/items",
                )
            except Exception:
                pass

        return response
