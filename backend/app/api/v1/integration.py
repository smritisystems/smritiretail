"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.23.0
Created      : 2026-08-23
Modified     : 2026-08-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, Query, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from ...api.deps import get_company_db, get_tenant_context, TenantContext
from ...services.tally_integration_service import TallyIntegrationService
from ...services.compliance_audit_service import ComplianceAuditService

router = APIRouter()


class AuditLogSearchRequest(BaseModel):
    entity_name: Optional[str] = None
    entity_id: Optional[str] = None
    event_type: Optional[str] = None
    limit: int = 50


@router.get("/tally/sales-invoice/{invoice_id}/xml")
async def export_tally_sales_invoice_xml(
    invoice_id: str,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """
    Exports a B2B/B2C Sales Invoice into a standard TallyPrime XML Voucher payload.
    """
    try:
        xml_content = await TallyIntegrationService.generate_tally_sales_voucher_xml(
            session=db,
            company_id=tenant_ctx.company_id,
            invoice_id=invoice_id
        )
        return Response(content=xml_content, media_type="application/xml")
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/tally/journal-voucher/{voucher_id}/xml")
async def export_tally_journal_voucher_xml(
    voucher_id: str,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """
    Exports a Double-Entry General Ledger Journal Voucher into standard TallyPrime XML format.
    """
    try:
        xml_content = await TallyIntegrationService.generate_tally_journal_voucher_xml(
            session=db,
            company_id=tenant_ctx.company_id,
            voucher_id=voucher_id
        )
        return Response(content=xml_content, media_type="application/xml")
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/audit/logs")
async def search_compliance_audit_logs(
    entity_name: Optional[str] = None,
    entity_id: Optional[str] = None,
    event_type: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """
    Searches tamper-evident regulatory compliance audit logs.
    """
    logs = await ComplianceAuditService.search_audit_logs(
        session=db,
        company_id=tenant_ctx.company_id,
        entity_name=entity_name,
        entity_id=entity_id,
        event_type=event_type,
        limit=limit
    )
    return {
        "company_id": tenant_ctx.company_id,
        "count": len(logs),
        "logs": logs
    }
