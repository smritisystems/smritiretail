"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-08-25
Modified     : 2026-08-25
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import traceback
from typing import Dict, Any, List, Optional, Tuple
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from ...api.deps import get_company_db, get_current_user
from ...services.search_engine import UniversalSearchEngine
from ...schemas.search import (
    UniversalSearchRequest,
    UniversalSearchResponse,
    BarcodeQuickScanRequest,
    BarcodeQuickScanResponse,
    SearchDomainListResponse,
)

router = APIRouter()


def _extract_user_info(current_user: Any) -> Tuple[str, str, str]:
    if isinstance(current_user, dict):
        comp_id = current_user.get("company_id", "COMP-001")
        user_id = current_user.get("sub", "usr-system")
        role = current_user.get("role", "STORE_MANAGER")
    else:
        comp_id = getattr(current_user, "company_id", "COMP-001") or "COMP-001"
        user_id = getattr(current_user, "id", None) or getattr(current_user, "username", "usr-system")
        role = getattr(current_user, "role", "STORE_MANAGER")
        if hasattr(role, "value"):
            role = role.value
    return comp_id, user_id, str(role).upper()


# ============================================================================
# UNIVERSAL SEARCH ENDPOINTS
# ============================================================================

@router.post("/universal", response_model=UniversalSearchResponse, summary="Execute Universal Omni-Search")
async def execute_universal_search_post(
    req: UniversalSearchRequest,
    db: AsyncSession = Depends(get_company_db),
    current_user: Any = Depends(get_current_user),
):
    """Executes multi-domain search respecting RBAC permissions and relevance scoring."""
    try:
        company_id, _, user_role = _extract_user_info(current_user)
        return await UniversalSearchEngine.execute_universal_search(
            session=db,
            company_id=company_id,
            req=req,
            caller_role=user_role,
        )
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/universal", response_model=UniversalSearchResponse, summary="Universal Omni-Search Query")
async def execute_universal_search_get(
    q: str = Query(..., min_length=1, max_length=100, description="Search keyword"),
    domains: Optional[str] = Query(None, description="Comma-separated list of domains e.g. ITEMS,PARTIES"),
    limit: int = Query(5, ge=1, le=50),
    db: AsyncSession = Depends(get_company_db),
    current_user: Any = Depends(get_current_user),
):
    """Executes universal search via GET query parameters."""
    try:
        company_id, _, user_role = _extract_user_info(current_user)
        domain_list = [d.strip().upper() for d in domains.split(",") if d.strip()] if domains else None
        req = UniversalSearchRequest(query=q, domains=domain_list, limit_per_domain=limit)
        return await UniversalSearchEngine.execute_universal_search(
            session=db,
            company_id=company_id,
            req=req,
            caller_role=user_role,
        )
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/barcode-scan", response_model=BarcodeQuickScanResponse, summary="High-Speed Barcode Quick Scan")
async def quick_barcode_scan(
    req: BarcodeQuickScanRequest,
    db: AsyncSession = Depends(get_company_db),
    current_user: Any = Depends(get_current_user),
):
    """Resolves a raw scanner input to an authoritative Item/Variant with pricing and UOM metadata."""
    try:
        company_id, _, _ = _extract_user_info(current_user)
        return await UniversalSearchEngine.quick_barcode_scan(
            session=db,
            company_id=company_id,
            req=req,
        )
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/domains", response_model=SearchDomainListResponse, summary="List Accessible Search Domains")
async def list_accessible_domains(
    current_user: Any = Depends(get_current_user),
):
    """Lists search domains accessible by the authenticated user's role."""
    _, _, user_role = _extract_user_info(current_user)
    allowed = UniversalSearchEngine.get_allowed_domains(user_role)
    domain_meta = [
        {"domain": "ITEMS", "label": "Items & Products", "icon": "package", "allowed": "ITEMS" in allowed},
        {"domain": "PARTIES", "label": "Customers & Vendors", "icon": "users", "allowed": "PARTIES" in allowed},
        {"domain": "BARCODES", "label": "Barcodes & SKUs", "icon": "barcode", "allowed": "BARCODES" in allowed},
        {"domain": "DOCUMENTS", "label": "Invoices, Orders & Dispatches", "icon": "file-text", "allowed": "DOCUMENTS" in allowed},
        {"domain": "WAREHOUSES", "label": "Warehouses & Stores", "icon": "warehouse", "allowed": "WAREHOUSES" in allowed},
        {"domain": "TRANSACTIONS", "label": "Payments & Ledger", "icon": "dollar-sign", "allowed": "TRANSACTIONS" in allowed},
    ]
    return SearchDomainListResponse(available_domains=domain_meta)
