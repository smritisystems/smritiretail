"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.19.0
Created      : 2026-07-15
Modified     : 2026-07-15
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from fastapi import APIRouter
from typing import Dict, Any

router = APIRouter()

# Contract URL endpoints that must be reachable for each feature flag
FLAG_ENDPOINTS: Dict[str, list] = {
    "USE_FASTAPI_POS": [
        "POST /api/v1/pos/shifts/open",
        "POST /api/v1/pos/shifts/close/{shift_id}",
        "POST /api/v1/pos/checkout",
    ],
    "USE_FASTAPI_SALES": [
        "GET  /api/v1/sales/invoices",
        "POST /api/v1/sales/invoices",
        "GET  /api/v1/sales/returns",
        "POST /api/v1/sales/returns",
        "GET  /api/v1/sales/quotations",
        "POST /api/v1/sales/quotations",
    ],
    "USE_FASTAPI_PURCHASE": [
        "GET  /api/v1/purchase/orders",
        "POST /api/v1/purchase/orders",
        "GET  /api/v1/purchase/suppliers",
        "POST /api/v1/purchase/suppliers",
        "POST /api/v1/purchase/orders/{id}/cancel",
        "POST /api/v1/purchase/orders/{id}/amend",
    ],
}

DEPRECATED_ENDPOINTS: Dict[str, list] = {
    "USE_FASTAPI_POS": [
        "POST /api/v1/shifts/open (deprecated — REMOVED in v3.20.0)",
        "POST /api/v1/shifts/{id}/close (deprecated — REMOVED in v3.20.0)",
    ],
    "USE_FASTAPI_SALES": [
        "GET  /api/v1/sales-invoices/ (deprecated — REMOVED in v3.20.0)",
        "POST /api/v1/sales-invoices/ (deprecated — REMOVED in v3.20.0)",
    ],
    "USE_FASTAPI_PURCHASE": [
        "GET  /api/v1/purchase-orders/ (deprecated — REMOVED in v3.20.0)",
        "POST /api/v1/purchase-orders/ (deprecated — REMOVED in v3.20.0)",
    ],
}


@router.get("/flags", summary="Feature Flag Health Check")
async def flag_health() -> Dict[str, Any]:
    """
    Returns the current state of each FastAPI feature flag cutover.
    Shows which contract URL endpoints are registered and which legacy
    endpoints are deprecated and scheduled for removal.
    Use this to verify a feature flag is safe to enable before switching.
    """
    result = {}
    for flag, endpoints in FLAG_ENDPOINTS.items():
        result[flag] = {
            "status": "active",
            "contract_endpoints": endpoints,
            "deprecated_endpoints": DEPRECATED_ENDPOINTS.get(flag, []),
            "deprecated_removal_version": "v3.20.0 — REMOVED",
        }
    return {
        "flags": result,
        "policy": "Activate a flag only when its contract_endpoints are all reachable (HTTP 2xx or 4xx with valid auth).",
    }
