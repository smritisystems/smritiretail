"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.35.0
Created      : 2026-08-28
Modified     : 2026-08-28
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

SMRITI Reporting & BI Engine — Canonical Governance & Registry API Router.
Exposes:
- GET /api/v1/reporting/catalog (All 22 reports across 5 studios)
- GET /api/v1/reporting/catalog/{report_id}
- GET /api/v1/reporting/alias-lookup (Decoupled Shoper 9 jump code resolver)
- GET /api/v1/reporting/metrics (Governed Metric Dictionary definitions)
- POST /api/v1/reporting/validate-envelope (Forensic Execution Envelope)
"""

from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from ...api.deps import get_db, get_current_user, get_tenant_context, TenantContext
from ...models.auth import User
from ...schemas.report_registry import (
    ReportRegistryEntry,
    StudioType,
    ReportCatalogResponse,
    LegacyAliasResolutionResponse,
    ExecutionEnvelope,
)
from ...services.report_registry_svc import ReportRegistryService
from ...core.metric_dictionary import GovernedMetricDictionary, GovernedMetric

router = APIRouter(prefix="/reporting", tags=["Reporting Governance & Catalog"])


@router.get(
    "/catalog",
    response_model=ReportCatalogResponse,
    summary="List all canonical report contracts",
    description="Returns all registered reports grouped by studio with dimension, measure, and RBAC metadata."
)
async def get_report_catalog(
    studio: Optional[StudioType] = Query(None, description="Filter by studio"),
    current_user: Optional[User] = Depends(get_current_user),
):
    user_role = current_user.role.value if current_user and hasattr(current_user.role, "value") else (str(current_user.role) if current_user else "GUEST")
    reports = ReportRegistryService.list_reports(studio=studio, role=user_role if current_user else None)
    
    studios = list(set(r.studio for r in reports))
    return ReportCatalogResponse(
        total_reports=len(reports),
        studios=studios,
        reports=reports,
    )


@router.get(
    "/catalog/{report_id}",
    response_model=ReportRegistryEntry,
    summary="Get single report contract",
)
async def get_report_contract(report_id: str):
    return ReportRegistryService.get_report(report_id)


@router.get(
    "/alias-lookup",
    response_model=LegacyAliasResolutionResponse,
    summary="Resolve legacy Shoper 9 jump-code",
    description="Resolves legacy codes (e.g., '411', '412', 'SR202000', 'SR236300') to canonical SMRITI report IDs."
)
async def resolve_legacy_alias(
    q: str = Query(..., description="Legacy Shoper 9 MnuNo or EXE code")
):
    return ReportRegistryService.resolve_legacy_alias(query_code=q)


@router.get(
    "/metrics",
    response_model=List[GovernedMetric],
    summary="List all Governed Metric definitions",
    description="Returns the canonical mathematical formula and category for all governed retail KPIs."
)
async def list_governed_metrics():
    return GovernedMetricDictionary.list_metrics()


@router.post(
    "/validate-envelope",
    response_model=ExecutionEnvelope,
    summary="Validate and build forensic execution envelope",
    description="Constructs the 5-vector temporal execution envelope for report runs."
)
async def build_execution_envelope(
    report_id: str = Query(..., description="Report ID to execute"),
    current_user: User = Depends(get_current_user),
    tenant: TenantContext = Depends(get_tenant_context),
):
    user_role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    
    # 1. Validate RBAC and report status
    ReportRegistryService.validate_execution_request(
        report_id=report_id,
        user_role=user_role
    )

    # 2. Build 5-vector envelope
    envelope = ReportRegistryService.build_execution_envelope(
        report_id=report_id,
        executed_by_user=current_user.id or current_user.username,
        executed_by_role=user_role,
        company_id=tenant.company_id if tenant else None,
        branch_id=tenant.branch_id if tenant else None,
    )

    return envelope
