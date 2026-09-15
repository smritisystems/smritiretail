"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-07-12
Modified     : 2026-07-12
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""


from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import TenantContext, get_db, get_tenant_context
from app.compliance.exceptions import PolicyViolationException
from app.compliance.schemas.compliance import (
    CancelComplianceDocRequest,
    ComplianceOutboxOut,
    DebugOutboxIn,
    EInvoiceGenerationRequest,
    EInvoiceResponse,
    EWayBillGenerationRequest,
    EWayBillResponse,
    HealthStatusOut,
)
from app.compliance.services.compliance_service import ComplianceService
from app.compliance.services.policy_service import PolicyService
from app.compliance.services.registry_service import RegistryService
from app.compliance.vault.crypto import master_key_str
from app.core.config import settings


def get_registry_service() -> RegistryService:
    return RegistryService()

router = APIRouter(prefix="/compliance", tags=["Compliance"])

@router.get(
    "/health",
    response_model=HealthStatusOut,
    summary="Compliance System Health Check",
    description="Probes database, vault credentials state, and active connectors."
)
async def check_compliance_health(
    db: AsyncSession = Depends(get_db),
    registry_service: RegistryService = Depends(get_registry_service)
) -> HealthStatusOut:
    """
    轻量级健康检查 (Probes DB, Vault, and loaded connectors count).
    """
    # 1. Probe database
    try:
        await db.execute(text("SELECT 1"))
        db_status = "healthy"
    except Exception:
        db_status = "unhealthy"

    # 2. Probe vault master key presence
    vault_status = "healthy" if master_key_str else "unhealthy"

    # 3. Probe registry state
    try:
        connectors_count = registry_service.get_connectors_count()
        registry_status = "healthy"
    except Exception:
        connectors_count = 0
        registry_status = "unhealthy"

    overall_status = "healthy"
    if "unhealthy" in [db_status, vault_status, registry_status]:
        overall_status = "unhealthy"

    return HealthStatusOut(
        status=overall_status,
        database=db_status,
        vault=vault_status,
        registry=registry_status,
        connectors=connectors_count,
        version=settings.VERSION,
        milestone="1"
    )

@router.post(
    "/debug/outbox",
    response_model=ComplianceOutboxOut,
    summary="Insert Debug Outbox Event",
    description="Inserts outbox payload for integration testing. Admin-only, disabled in production."
)
async def insert_debug_outbox(
    payload: DebugOutboxIn,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext | None = Depends(get_tenant_context),
    registry_service: RegistryService = Depends(get_registry_service)
) -> Any:
    """
    Allows developers/integrators to manually insert an outbox event.
    Strictly disabled and hidden in production environments.
    """
    # Gated check for production environment
    if settings.ENVIRONMENT == "production":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Not Found"
        )

    policy_service = PolicyService(registry_service)
    compliance_service = ComplianceService(db, tenant_ctx, policy_service)
    try:
        event = await compliance_service.queue_outbox_event(
            service_id=payload.service_id,
            action=payload.action,
            payload=payload.payload,
            idempotency_key=payload.idempotency_key
        )
        return event
    except PolicyViolationException as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        ) from e


@router.get(
    "/connectors",
    summary="List Registered Connectors",
    description="Returns all active compliance connectors discovered by the registry."
)
async def list_connectors(
    registry_service: RegistryService = Depends(get_registry_service)
) -> list[dict[str, Any]]:
    return registry_service.list_manifests()


@router.post(
    "/einvoice/generate",
    response_model=EInvoiceResponse,
    summary="Generate GSTN E-Invoice (IRN & QR)",
    description="Transforms sales tax invoice into GSTN INV-01 format, computes IRN hash, and generates signed QR code."
)
async def generate_einvoice_endpoint(
    payload: EInvoiceGenerationRequest,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext | None = Depends(get_tenant_context),
) -> EInvoiceResponse:
    from app.compliance.services.einvoice_service import EInvoiceService
    svc = EInvoiceService(db, tenant_ctx)
    try:
        return await svc.generate_einvoice(payload)
    except PolicyViolationException as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e


@router.post(
    "/einvoice/cancel",
    summary="Cancel GSTN E-Invoice (IRN)",
    description="Cancels an active IRN within the statutory 24-hour window."
)
async def cancel_einvoice_endpoint(
    payload: CancelComplianceDocRequest,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext | None = Depends(get_tenant_context),
) -> dict[str, Any]:
    from app.compliance.services.einvoice_service import EInvoiceService
    svc = EInvoiceService(db, tenant_ctx)
    try:
        return await svc.cancel_einvoice(payload)
    except PolicyViolationException as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e


@router.post(
    "/ewaybill/generate",
    response_model=EWayBillResponse,
    summary="Generate NIC E-Way Bill",
    description="Generates statutory 12-digit E-Way Bill Part A and Part B with distance-based validity."
)
async def generate_ewaybill_endpoint(
    payload: EWayBillGenerationRequest,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext | None = Depends(get_tenant_context),
) -> EWayBillResponse:
    from app.compliance.services.ewaybill_service import EWayBillService
    svc = EWayBillService(db, tenant_ctx)
    try:
        return await svc.generate_ewaybill(payload)
    except PolicyViolationException as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e


@router.post(
    "/ewaybill/cancel",
    summary="Cancel NIC E-Way Bill",
    description="Cancels an active E-Way Bill within 24 hours of generation."
)
async def cancel_ewaybill_endpoint(
    payload: CancelComplianceDocRequest,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext | None = Depends(get_tenant_context),
) -> dict[str, Any]:
    from app.compliance.services.ewaybill_service import EWayBillService
    svc = EWayBillService(db, tenant_ctx)
    try:
        return await svc.cancel_ewaybill(payload)
    except PolicyViolationException as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e


@router.get(
    "/ewaybill/{document_no_or_id:path}",
    summary="Get E-Way Bill Details",
    description="Retrieves canonical E-Way Bill details by E-Way Bill number, document number, or invoice ID."
)
async def get_ewaybill_endpoint(
    document_no_or_id: str,
    db: AsyncSession = Depends(get_db),
    tenant_ctx: TenantContext | None = Depends(get_tenant_context),
) -> dict[str, Any]:
    from sqlalchemy import select
    from app.models.distribution import EWayBill
    from app.db.session import resolve_company_database_name, get_company_sessionmaker

    target_session = db
    company_session = None
    if tenant_ctx and tenant_ctx.company_id:
        try:
            target_db = await resolve_company_database_name(tenant_ctx.company_id)
            if target_db and target_db != "smritisys":
                sm = get_company_sessionmaker(target_db)
                company_session = sm()
                target_session = company_session
        except Exception:
            pass

    try:
        stmt = select(EWayBill).where(
            (EWayBill.eway_bill_no == document_no_or_id) |
            (EWayBill.document_no == document_no_or_id) |
            (EWayBill.invoice_id == document_no_or_id)
        )
        res = await target_session.execute(stmt)
        ewb = res.scalars().first()
        if not ewb and target_session != db:
            res_ctrl = await db.execute(stmt)
            ewb = res_ctrl.scalars().first()
    finally:
        if company_session:
            await company_session.close()

    if not ewb:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="E-Way Bill not found.")
    return {
        "id": ewb.id,
        "eway_bill_no": ewb.eway_bill_no,
        "document_no": ewb.document_no,
        "document_type": ewb.document_type,
        "invoice_id": ewb.invoice_id,
        "supply_type": ewb.supply_type,
        "trans_type": ewb.trans_type,
        "gstin_from": ewb.gstin_from,
        "trade_name_from": ewb.trade_name_from,
        "gstin_to": ewb.gstin_to,
        "trade_name_to": ewb.trade_name_to,
        "dispatch_from": {
            "gstin": ewb.dispatch_from_gstin,
            "trade_name": ewb.dispatch_from_trade_name,
            "place": ewb.dispatch_from_place,
            "pincode": ewb.dispatch_from_pincode,
            "state_code": ewb.dispatch_from_state_code,
            "addr1": ewb.dispatch_from_addr1,
            "addr2": ewb.dispatch_from_addr2,
        },
        "ship_to": {
            "gstin": ewb.ship_to_gstin,
            "trade_name": ewb.ship_to_trade_name,
            "place": ewb.ship_to_place,
            "pincode": ewb.ship_to_pincode,
            "state_code": ewb.ship_to_state_code,
            "addr1": ewb.ship_to_addr1,
            "addr2": ewb.ship_to_addr2,
        },
        "total_taxable_amount": float(ewb.total_taxable_amount or 0),
        "igst_amount": float(ewb.igst_amount or 0),
        "consignment_value": float(ewb.consignment_value or 0),
        "main_hsn_code": ewb.main_hsn_code,
        "distance_km": float(ewb.distance_km or 0),
        "vehicle_no": ewb.vehicle_no,
        "transporter_id": ewb.transporter_id,
        "transporter_name": ewb.transporter_name,
        "part_b_status": ewb.part_b_status,
        "status": ewb.status,
        "ewb_date": ewb.ewb_date.isoformat() if ewb.ewb_date else None,
        "valid_from": ewb.valid_from.isoformat() if ewb.valid_from else None,
        "valid_until": ewb.valid_until.isoformat() if ewb.valid_until else None,
        "nic_payload_snapshot": ewb.nic_payload_snapshot,
    }


