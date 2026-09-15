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


from datetime import date
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import and_, or_, select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import TenantContext, get_company_db, get_db, get_tenant_context, require_permission
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
from app.models.sales import SalesInvoice
from app.compliance.schemas.compliance import EWayBillItem
from app.compliance.connectors.ewaybill.payloads import build_generate_payload
from app.compliance.services.ewaybill_service import EWayBillService


def get_registry_service() -> RegistryService:
    return RegistryService()

router = APIRouter(prefix="/compliance", tags=["Compliance"])


class EWayBillManagementFilter(BaseModel):
    mode: Literal["selected", "all", "date_range", "bill_range"] = "selected"
    invoice_ids: list[str] = Field(default_factory=list, max_length=500)
    date_from: date | None = None
    date_to: date | None = None
    bill_from: str | None = Field(None, max_length=100)
    bill_to: str | None = Field(None, max_length=100)
    include_existing: bool = False
    distance_km: int | None = Field(None, ge=0, le=4000)
    trans_mode: str | None = Field(None, pattern="^[1-4]$")
    vehicle_no: str | None = Field(None, max_length=15)
    transporter_id: str | None = Field(None, max_length=15)
    transporter_name: str | None = Field(None, max_length=100)
    trans_doc_no: str | None = Field(None, max_length=15)


class EWayBillBatchRequest(EWayBillManagementFilter):
    distance_km: int = Field(..., ge=0, le=4000)
    trans_mode: str = Field(..., pattern="^[1-4]$")
    vehicle_no: str | None = Field(None, max_length=15)
    transporter_id: str | None = Field(None, max_length=15)
    transporter_name: str | None = Field(None, max_length=100)
    dry_run: bool = False


def _invoice_date(invoice: SalesInvoice) -> date:
    return invoice.date or invoice.created_at.date()


def _invoice_row(invoice: SalesInvoice, reason: str | None = None) -> dict[str, Any]:
    return {
        "invoice_id": invoice.id,
        "invoice_no": invoice.invoice_no,
        "invoice_date": _invoice_date(invoice).isoformat(),
        "status": invoice.status,
        "customer_name": invoice.customer_name,
        "customer_gstin": invoice.customer_gstin,
        "grand_total": float(invoice.grand_total or 0),
        "item_count": len(invoice.items or []),
        "eway_bill_no": invoice.eway_bill_no,
        "eligible": not bool(invoice.eway_bill_no) and str(invoice.status or "").lower() not in {"cancelled", "void"},
        "reason": reason,
    }


def _validate_management_transport(filters: EWayBillManagementFilter) -> None:
    if filters.distance_km is None or filters.trans_mode is None:
        raise HTTPException(status_code=422, detail="distance_km and trans_mode are required for E-Way Bill JSON generation.")
    if filters.trans_mode == "1" and not filters.vehicle_no:
        raise HTTPException(status_code=422, detail="vehicle_no is required for road transport.")
    if filters.trans_mode in {"2", "3", "4"} and not filters.trans_doc_no:
        raise HTTPException(status_code=422, detail="trans_doc_no is required for non-road transport.")


async def _select_management_invoices(db: AsyncSession, tenant_ctx: TenantContext, filters: EWayBillManagementFilter) -> list[SalesInvoice]:
    stmt = select(SalesInvoice).where(
        SalesInvoice.company_id == tenant_ctx.company_id,
        SalesInvoice.is_deleted == False,
    ).options(selectinload(SalesInvoice.items))
    if filters.mode == "selected":
        if not filters.invoice_ids:
            return []
        stmt = stmt.where(SalesInvoice.id.in_(filters.invoice_ids))
    elif filters.mode == "date_range":
        if not filters.date_from or not filters.date_to or filters.date_from > filters.date_to:
            raise HTTPException(status_code=422, detail="date_from and date_to are required in ascending order.")
        stmt = stmt.where(SalesInvoice.date.between(filters.date_from, filters.date_to))
    elif filters.mode == "bill_range":
        if not filters.bill_from or not filters.bill_to or filters.bill_from > filters.bill_to:
            raise HTTPException(status_code=422, detail="bill_from and bill_to are required in ascending order.")
        stmt = stmt.where(SalesInvoice.invoice_no.between(filters.bill_from, filters.bill_to))
    result = await db.execute(stmt.order_by(SalesInvoice.date, SalesInvoice.invoice_no))
    return list(result.scalars().unique().all())


def _nic_payload_from_export(export_payload: dict[str, Any]) -> dict[str, Any]:
    bill = export_payload["billLists"][0]
    return build_generate_payload({
        "supply_type": bill.get("supplyType", "O"),
        "sub_supply_type": bill.get("subSupplyType", 1),
        "doc_type": bill.get("docType", "INV"),
        "doc_no": bill["docNo"],
        "document_date": bill.get("docDate"),
        "from_gstin": bill["fromGstin"],
        "from_trade_name": bill.get("fromTrdName", ""),
        "from_addr1": bill.get("fromAddr1", ""),
        "from_addr2": bill.get("fromAddr2", ""),
        "from_place": bill.get("fromPlace", ""),
        "from_pincode": bill["fromPincode"],
        "from_state_code": bill.get("fromStateCode"),
        "actual_from_state_code": bill.get("actFromStateCode"),
        "to_gstin": bill.get("toGstin", "URP"),
        "to_trade_name": bill.get("toTrdName", ""),
        "to_addr1": bill.get("toAddr1", ""),
        "to_addr2": bill.get("toAddr2", ""),
        "to_place": bill.get("toPlace", ""),
        "to_pincode": bill["toPincode"],
        "to_state_code": bill.get("toStateCode", 96),
        "actual_to_state_code": bill.get("actToStateCode", 96),
        "transaction_type": bill.get("transType", 1),
        "other_value": bill.get("otherValue", 0),
        "total_taxable_amount": bill.get("totalValue", 0),
        "total_invoice_value": bill["totInvValue"],
        "cgst_amount": bill.get("cgstValue", 0),
        "sgst_amount": bill.get("sgstValue", 0),
        "igst_amount": bill.get("igstValue", 0),
        "cess_amount": bill.get("cessValue", 0),
        "trans_mode": bill.get("transMode", "1"),
        "trans_distance_km": bill.get("transDistance", 0),
        "transporter_id": bill.get("transporterId", ""),
        "transporter_name": bill.get("transporterName", ""),
        "trans_doc_no": bill.get("transDocNo", ""),
        "trans_doc_date": bill.get("transDocDate", ""),
        "vehicle_no": bill.get("vehicleNo", ""),
        "vehicle_type": bill.get("vehicleType", "R"),
        "items": [{
            "product_name": item.get("productName", ""),
            "product_desc": item.get("productDesc", ""),
            "hsn_code": str(item["hsnCode"]),
            "quantity": item.get("quantity", 0),
            "qty_unit": item.get("qtyUnit", "NOS"),
            "taxable_amount": item["taxableAmount"],
            "cgst_rate": item.get("cgstRate", 0),
            "sgst_rate": item.get("sgstRate", 0),
            "igst_rate": item.get("igstRate", 0),
            "cess_rate": item.get("cessRate", 0),
        } for item in bill.get("itemList", [])],
    })

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


@router.post(
    "/ewaybill-management/preview",
    summary="Preview Invoice E-Way Bill Batch",
    dependencies=[Depends(require_permission("sales_billing", "VIEW"))],
)
async def preview_ewaybill_management(
    filters: EWayBillManagementFilter,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
) -> dict[str, Any]:
    """Return the exact invoice set and export-ready JSON without calling NIC."""
    _validate_management_transport(filters)
    invoices = await _select_management_invoices(db, tenant_ctx, filters)
    service = EWayBillService(db, tenant_ctx)
    rows: list[dict[str, Any]] = []
    for invoice in invoices:
        row = _invoice_row(invoice)
        if invoice.eway_bill_no and not filters.include_existing:
            row["eligible"] = False
            row["reason"] = "E-Way Bill already exists"
        elif row["status"].lower() in {"cancelled", "void"}:
            row["eligible"] = False
            row["reason"] = "Invoice is cancelled or void"
        else:
            try:
                export_payload = await service.generate_invoice_eway_bill_payload(
                    invoice.id,
                    vehicle_no=filters.vehicle_no,
                    transporter_id=filters.transporter_id,
                    transporter_name=filters.transporter_name,
                    lr_number=filters.trans_doc_no,
                    trans_distance_km=filters.distance_km,
                    trans_mode=filters.trans_mode,
                    require_complete_data=True,
                )
                row["payload"] = _nic_payload_from_export(export_payload)
                row["export_payload"] = export_payload
            except HTTPException as exc:
                row["eligible"] = False
                row["reason"] = str(exc.detail)
        rows.append(row)
    return {
        "mode": filters.mode,
        "total": len(rows),
        "eligible": sum(1 for row in rows if row["eligible"]),
        "ineligible": sum(1 for row in rows if not row["eligible"]),
        "invoices": rows,
    }


@router.post(
    "/ewaybill-management/generate",
    summary="Generate E-Way Bills for Invoice Batch",
    dependencies=[Depends(require_permission("sales_billing", "EDIT"))],
)
async def generate_ewaybill_management(
    request: EWayBillBatchRequest,
    db: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
) -> dict[str, Any]:
    """Generate one E-Way Bill per eligible invoice with isolated result reporting."""
    _validate_management_transport(request)
    invoices = await _select_management_invoices(db, tenant_ctx, request)
    service = EWayBillService(db, tenant_ctx)
    results: list[dict[str, Any]] = []
    for invoice in invoices:
        row = _invoice_row(invoice)
        if invoice.eway_bill_no and not request.include_existing:
            row.update(eligible=False, result="SKIPPED", reason="E-Way Bill already exists")
            results.append(row)
            continue
        if str(invoice.status or "").lower() in {"cancelled", "void"}:
            row.update(eligible=False, result="SKIPPED", reason="Invoice is cancelled or void")
            results.append(row)
            continue
        try:
            export_payload = await service.generate_invoice_eway_bill_payload(
                invoice.id,
                vehicle_no=request.vehicle_no,
                transporter_id=request.transporter_id,
                transporter_name=request.transporter_name,
                lr_number=request.trans_doc_no,
                trans_distance_km=request.distance_km,
                trans_mode=request.trans_mode,
                require_complete_data=True,
            )
            bill = export_payload["billLists"][0]
            row["payload"] = export_payload
            row["nic_payload"] = _nic_payload_from_export(export_payload)
            if request.dry_run:
                row.update(eligible=True, result="PREVIEWED")
                results.append(row)
                continue
            generation_request = EWayBillGenerationRequest(
                invoice_id=invoice.id,
                doc_no=bill["docNo"],
                doc_type=bill["docType"],
                document_date=_invoice_date(invoice),
                from_gstin=bill["fromGstin"],
                from_trade_name=bill.get("fromTrdName"),
                from_addr1=bill.get("fromAddr1"),
                from_addr2=bill.get("fromAddr2"),
                from_place=bill.get("fromPlace"),
                from_pincode=str(bill["fromPincode"]),
                from_state_code=bill.get("fromStateCode"),
                actual_from_state_code=bill.get("actFromStateCode"),
                to_gstin=bill.get("toGstin", "URP"),
                to_trade_name=bill.get("toTrdName"),
                to_addr1=bill.get("toAddr1"),
                to_addr2=bill.get("toAddr2"),
                to_place=bill.get("toPlace"),
                to_pincode=str(bill["toPincode"]),
                to_state_code=bill.get("toStateCode"),
                actual_to_state_code=bill.get("actToStateCode"),
                trans_distance_km=request.distance_km,
                trans_mode=request.trans_mode,
                trans_doc_no=bill.get("transDocNo"),
                trans_doc_date=bill.get("transDocDate"),
                vehicle_type=bill.get("vehicleType", "R"),
                transporter_id=request.transporter_id,
                transporter_name=request.transporter_name,
                vehicle_no=request.vehicle_no,
                total_invoice_value=float(bill["totInvValue"]),
                total_taxable_amount=float(bill["totalValue"]),
                cgst_amount=float(bill.get("cgstValue", 0)),
                sgst_amount=float(bill.get("sgstValue", 0)),
                igst_amount=float(bill.get("igstValue", 0)),
                main_hsn_code=str(bill.get("itemList", [{}])[0].get("hsnCode", "")),
                items=[
                    EWayBillItem(
                        product_name=item.get("productName", ""),
                        product_desc=item.get("productDesc", ""),
                        hsn_code=str(item["hsnCode"]),
                        quantity=item.get("quantity", 0),
                        qty_unit=item.get("qtyUnit", "NOS"),
                        taxable_amount=item["taxableAmount"],
                        cgst_rate=item.get("cgstRate", 0),
                        sgst_rate=item.get("sgstRate", 0),
                        igst_rate=item.get("igstRate", 0),
                        cess_rate=item.get("cessRate", 0),
                    )
                    for item in bill.get("itemList", [])
                ],
            )
            response = await service.generate_ewaybill(generation_request)
            row.update(eligible=True, result="GENERATED", eway_bill_no=response.eway_bill_no, valid_upto=response.valid_upto)
        except (HTTPException, PolicyViolationException, ValueError) as exc:
            row.update(eligible=False, result="FAILED", reason=getattr(exc, "detail", str(exc)))
        results.append(row)
    return {
        "mode": request.mode,
        "dry_run": request.dry_run,
        "total": len(results),
        "generated": sum(1 for row in results if row["result"] == "GENERATED"),
        "previewed": sum(1 for row in results if row["result"] == "PREVIEWED"),
        "skipped": sum(1 for row in results if row["result"] == "SKIPPED"),
        "failed": sum(1 for row in results if row["result"] == "FAILED"),
        "results": results,
    }


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


