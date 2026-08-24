"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.25.0
Created      : 2026-08-23
Modified     : 2026-08-24
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, Query, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from ...api.deps import get_db, get_company_db, get_tenant_context, TenantContext, get_current_user
from ...models.integration_hub import ProviderRegistry, ConnectorRegistry, IntegrationRegistry
from ...models.auth import User
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


# ---------------------------------------------------------------------------
# Integration Hub Registry Endpoints (smritisys Control Plane)
# Blueprint §45: connector_registry, provider_registry, integration_registry
# ---------------------------------------------------------------------------

@router.get("/hub/providers", summary="Integration Provider Registry")
async def get_integration_providers(
    category: Optional[str] = None,
    provider_type: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns the canonical integration provider catalogue from smritisys.provider_registry.
    Optional filters: category (GOVERNMENT | PAYMENT | ECOMMERCE | ACCOUNTING | COMMUNICATION),
    provider_type (GST | ERP | MARKETPLACE | SMS | EMAIL).
    """
    stmt = select(ProviderRegistry).where(ProviderRegistry.is_active == True)
    if category:
        stmt = stmt.where(ProviderRegistry.provider_category == category.upper())
    if provider_type:
        stmt = stmt.where(ProviderRegistry.provider_type == provider_type.upper())
    result = await db.execute(stmt)
    providers = result.scalars().all()
    return {
        "count": len(providers),
        "providers": [
            {
                "id": p.id, "code": p.code, "name": p.name,
                "provider_category": p.provider_category, "provider_type": p.provider_type,
                "homepage_url": p.homepage_url, "docs_url": p.docs_url,
                "supported_auth_types": p.supported_auth_types,
                "supported_environments": p.supported_environments,
                "capabilities_required": p.capabilities_required,
                "status": p.status,
            }
            for p in providers
        ],
    }


@router.get("/hub/connectors", summary="Connector Registry")
async def get_connector_registry(
    provider_code: Optional[str] = None,
    connector_type: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns connector type definitions from smritisys.connector_registry.
    Optional filters: provider_code, connector_type.
    """
    stmt = select(ConnectorRegistry).where(ConnectorRegistry.is_active == True)
    if provider_code:
        stmt = stmt.where(ConnectorRegistry.provider_code == provider_code.upper())
    if connector_type:
        stmt = stmt.where(ConnectorRegistry.connector_type == connector_type.upper())
    result = await db.execute(stmt)
    connectors = result.scalars().all()
    return {
        "count": len(connectors),
        "connectors": [
            {
                "id": c.id, "code": c.code, "version": c.version, "name": c.name,
                "provider_code": c.provider_code, "connector_type": c.connector_type,
                "protocol": c.protocol, "direction": c.direction,
                "event_triggers": c.event_triggers, "timeout_seconds": c.timeout_seconds,
                "retry_policy": c.retry_policy, "status": c.status,
            }
            for c in connectors
        ],
    }


@router.get("/hub/integrations", summary="Integration Registry")
async def get_integration_registry(
    integration_category: Optional[str] = None,
    provider_code: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns named integration definitions from smritisys.integration_registry.
    Optional filters: integration_category, provider_code.
    """
    stmt = select(IntegrationRegistry).where(
        IntegrationRegistry.is_active == True,
        IntegrationRegistry.is_deleted == False,
    )
    if integration_category:
        stmt = stmt.where(IntegrationRegistry.integration_category == integration_category.upper())
    if provider_code:
        stmt = stmt.where(IntegrationRegistry.provider_code == provider_code.upper())
    result = await db.execute(stmt)
    integrations = result.scalars().all()
    return {
        "count": len(integrations),
        "integrations": [
            {
                "id": i.id, "code": i.code, "version": i.version, "name": i.name,
                "connector_code": i.connector_code, "provider_code": i.provider_code,
                "integration_category": i.integration_category, "direction": i.direction,
                "trigger_mode": i.trigger_mode, "uses_outbox": i.uses_outbox,
                "outbox_event_types": i.outbox_event_types, "status": i.status,
            }
            for i in integrations
        ],
    }
