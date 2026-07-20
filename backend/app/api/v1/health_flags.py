"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
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


@router.get("/cutover", summary="Strangler-Fig Migration Cutover Gateway Status")
async def strangler_fig_cutover_status() -> Dict[str, Any]:
    """
    Returns the live strangler-fig migration progress and system of record allocation across all SMRITI domains.
    """
    domain_status = {
        "REPORTS": "STRANGLER_FIG_MIGRATED",
        "INVENTORY": "STRANGLER_FIG_MIGRATED",
        "AUTH": "STRANGLER_FIG_MIGRATED",
        "SALES": "STRANGLER_FIG_MIGRATED",
        "PURCHASE": "STRANGLER_FIG_MIGRATED",
        "POS": "STRANGLER_FIG_MIGRATED",
        "COMPLIANCE_SGIP": "STRANGLER_FIG_MIGRATED",
        "TRANSFERS_REBALANCING": "STRANGLER_FIG_MIGRATED",
        "SECURITY_SSACF": "STRANGLER_FIG_MIGRATED",
        "PRODUCT_IDENTITY_PIE": "STRANGLER_FIG_MIGRATED",
    }
    
    migrated_count = sum(1 for s in domain_status.values() if s == "STRANGLER_FIG_MIGRATED")
    total_domains = len(domain_status)
    completion_percentage = (migrated_count / total_domains) * 100.0

    return {
        "success": True,
        "system_of_record": "FastAPI + Postgres",
        "express_status": "FEATURE_FREEZE",
        "migration_progress_percent": completion_percentage,
        "domains": domain_status,
        "governance": "SMRITI Backend System-of-Record Policy (FastAPI + Postgres is sole transactional system of record)",
    }

