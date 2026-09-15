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

SMRITI Government Integration Platform (SGIP) — E-Way Bill Service Orchestrator.
Coordinates statutory ₹50,000 threshold evaluation, NIC EWB Part A & Part B generation,
distance calculation, vehicle updates, and audit logging.
"""

import json
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import TenantContext
from app.compliance.connectors.ewaybill.connector import EWayBillConnector
from app.compliance.connectors.ewaybill.payloads import build_generate_payload
from app.compliance.exceptions import PolicyViolationException
from app.compliance.models.compliance import ComplianceAuditLog
from app.compliance.schemas.compliance import (
    EWayBillGenerationRequest,
    EWayBillResponse,
    CancelComplianceDocRequest,
)
from app.models.distribution import EWayBill
from app.core.config import settings


class EWayBillService:
    """
    High-level business service for NIC E-Way Bill operations.
    Orchestrates statutory 2026 E-Way Bill lifecycle, entity persistence,
    and audit tracking.
    """

    STATUTORY_THRESHOLD_INR = 50000.00

    def __init__(
        self,
        db: AsyncSession,
        tenant_ctx: Optional[TenantContext] = None,
        connector: Optional[EWayBillConnector] = None
    ) -> None:
        self.db = db
        self.tenant_ctx = tenant_ctx
        self.connector = connector or EWayBillConnector()

    @classmethod
    def requires_eway_bill(cls, invoice_value: float, is_interstate: bool = False) -> bool:
        """
        Determines whether an invoice legally mandates an E-Way Bill.
        Statutory Rule: Required if Total Invoice Value >= ₹50,000 or mandatory interstate transit.
        """
        return invoice_value >= cls.STATUTORY_THRESHOLD_INR or (is_interstate and invoice_value > 0)

    async def generate_ewaybill(self, request: EWayBillGenerationRequest) -> EWayBillResponse:
        """
        Generates statutory E-Way Bill via NIC connector with database entity persistence and audit logging.
        """
        start_time = time.time()
        
        raw_payload = {
            "supplyType": "O",
            "subSupplyType": "1",
            "docType": request.doc_type,
            "docNo": request.doc_no,
            "document_date": request.document_date,
            "fromGstin": request.from_gstin,
            "toGstin": request.to_gstin,
            "from_trade_name": request.from_trade_name or "",
            "from_addr1": request.from_addr1 or "",
            "from_addr2": request.from_addr2 or "",
            "from_place": request.from_place or "",
            "from_state_code": request.from_state_code or int(request.from_gstin[:2]),
            "actual_from_state_code": request.actual_from_state_code or request.from_state_code or int(request.from_gstin[:2]),
            "from_pincode": request.from_pincode,
            "to_trade_name": request.to_trade_name or "",
            "to_addr1": request.to_addr1 or "",
            "to_addr2": request.to_addr2 or "",
            "to_place": request.to_place or "",
            "to_state_code": request.to_state_code or int(request.to_gstin[:2]) if request.to_gstin != "URP" else 96,
            "actual_to_state_code": request.actual_to_state_code or request.to_state_code or (int(request.to_gstin[:2]) if request.to_gstin != "URP" else 96),
            "to_pincode": request.to_pincode,
            "total_invoice_value": request.total_invoice_value,
            "total_taxable_amount": request.total_taxable_amount or request.total_invoice_value,
            "cgst_amount": request.cgst_amount,
            "sgst_amount": request.sgst_amount,
            "igst_amount": request.igst_amount,
            "cess_amount": request.cess_amount,
            "other_value": request.other_value,
            "cess_non_advol_value": request.cess_non_advol_value,
            "trans_distance_km": request.trans_distance_km,
            "trans_mode": request.trans_mode,
            "transporterId": request.transporter_id or "",
            "transporterName": request.transporter_name or "",
            "trans_doc_no": request.trans_doc_no or "",
            "trans_doc_date": request.trans_doc_date or "",
            "vehicleNo": request.vehicle_no or "",
            "vehicle_type": request.vehicle_type,
            "transaction_type": request.trans_type,
            "items": [item.model_dump() for item in request.items],
        }

        if settings.EWAYBILL_LIVE_ENABLED:
            if not request.items:
                raise PolicyViolationException("SGIP-EWB-VAL-007: Item details are required for live NIC submission.")
            payload = build_generate_payload(raw_payload)
        else:
            payload = {
                "supplyType": raw_payload["supplyType"],
                "subSupplyType": raw_payload["subSupplyType"],
                "docType": raw_payload["docType"],
                "docNo": raw_payload["docNo"],
                "fromGstin": raw_payload["fromGstin"],
                "toGstin": raw_payload["toGstin"],
                "fromPincode": raw_payload["from_pincode"],
                "toPincode": raw_payload["to_pincode"],
                "totInvValue": raw_payload["total_invoice_value"],
                "transDistance": raw_payload["trans_distance_km"],
                "transporterId": raw_payload["transporterId"],
                "transporterName": raw_payload["transporterName"],
                "vehicleNo": raw_payload["vehicleNo"],
            }

        # Authenticate
        credentials = (
            {"username": settings.EWAYBILL_USERNAME, "password": settings.EWAYBILL_PASSWORD}
            if settings.EWAYBILL_LIVE_ENABLED
            else {"username": "TEST_EWB_USER", "password": "TEST_EWB_PASSWORD"}
        )
        token = self.connector.authenticate(credentials)
        result = self.connector.submit(payload, token=token)
        duration_ms = int((time.time() - start_time) * 1000)

        # Parse statutory timestamps
        ewb_date_dt = datetime.strptime(result["eway_bill_date"], "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
        valid_upto_dt = datetime.strptime(result["valid_upto"], "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)

        # Record or update canonical EWayBill database entity
        stmt = select(EWayBill).where(
            (EWayBill.invoice_id == request.invoice_id) | (EWayBill.document_no == request.doc_no)
        )
        existing_res = await self.db.execute(stmt)
        ewb_record = existing_res.scalars().first()

        if not ewb_record:
            ewb_record = EWayBill(
                id=f"EWB-{uuid.uuid4().hex[:12].upper()}",
                eway_bill_no=result["eway_bill_no"],
                document_type=request.doc_type or "INVOICE",
                document_id=request.invoice_id,
                document_no=request.doc_no,
                invoice_id=request.invoice_id,
                supply_type=payload.get("supplyType", "O"),
                sub_supply_type=int(payload.get("subSupplyType", 1)),
                trans_type=request.trans_type or 1,
                gstin_from=request.from_gstin,
                gstin_to=request.to_gstin,
                dispatch_from_gstin=request.dispatch_from_gstin or request.from_gstin,
                dispatch_from_trade_name=request.dispatch_from_trade_name,
                dispatch_from_place=request.dispatch_from_place,
                dispatch_from_pincode=request.dispatch_from_pincode or request.from_pincode,
                dispatch_from_state_code=request.dispatch_from_state_code,
                dispatch_from_addr1=request.dispatch_from_addr1,
                dispatch_from_addr2=request.dispatch_from_addr2,
                ship_to_gstin=request.ship_to_gstin or request.to_gstin,
                ship_to_trade_name=request.ship_to_trade_name,
                ship_to_place=request.ship_to_place,
                ship_to_pincode=request.ship_to_pincode or request.to_pincode,
                ship_to_state_code=request.ship_to_state_code,
                ship_to_addr1=request.ship_to_addr1,
                ship_to_addr2=request.ship_to_addr2,
                total_taxable_amount=request.total_taxable_amount or request.total_invoice_value,
                cgst_amount=request.cgst_amount or 0.0,
                sgst_amount=request.sgst_amount or 0.0,
                igst_amount=request.igst_amount or 0.0,
                consignment_value=request.total_invoice_value,
                document_value=request.total_invoice_value,
                main_hsn_code=request.main_hsn_code,
                distance_km=result["trans_distance_km"],
                transporter_id=result.get("transporter_id"),
                transporter_name=payload.get("transporterName"),
                vehicle_no=result.get("vehicle_no"),
                vehicle_number=result.get("vehicle_no"),
                part_b_status="UPDATED" if result.get("vehicle_no") else "PENDING",
                irn=request.irn,
                ewb_date=ewb_date_dt,
                valid_from=ewb_date_dt,
                valid_until=valid_upto_dt,
                status="GENERATED",
                company_id=self.tenant_ctx.company_id if self.tenant_ctx else None,
                branch_id=self.tenant_ctx.branch_id if self.tenant_ctx else None,
            )
            self.db.add(ewb_record)
        else:
            ewb_record.eway_bill_no = result["eway_bill_no"]
            ewb_record.status = "GENERATED"
            ewb_record.ewb_date = ewb_date_dt
            ewb_record.valid_from = ewb_date_dt
            ewb_record.valid_until = valid_upto_dt
            ewb_record.distance_km = result["trans_distance_km"]
            ewb_record.vehicle_no = result.get("vehicle_no")
            ewb_record.vehicle_number = result.get("vehicle_no")
            ewb_record.transporter_id = result.get("transporter_id")
            ewb_record.part_b_status = "UPDATED" if result.get("vehicle_no") else "PENDING"
            if request.irn:
                ewb_record.irn = request.irn

        # Record Audit Log
        audit_log = ComplianceAuditLog(
            id=f"AUD-{uuid.uuid4().hex[:12].upper()}",
            service_id="ewaybill",
            endpoint="/api/v1/compliance/ewaybill/generate",
            request_payload=json.dumps({"doc_no": request.doc_no, "from_gstin": request.from_gstin}),
            response_payload=json.dumps({"ewb_no": result.get("eway_bill_no"), "status": result.get("status")}),
            status_code=200,
            duration_ms=duration_ms,
            company_id=self.tenant_ctx.company_id if self.tenant_ctx else None,
            branch_id=self.tenant_ctx.branch_id if self.tenant_ctx else None,
        )
        self.db.add(audit_log)
        await self.db.commit()

        return EWayBillResponse(
            status="SUCCESS",
            invoice_id=request.invoice_id,
            doc_no=request.doc_no,
            eway_bill_no=result["eway_bill_no"],
            eway_bill_date=result["eway_bill_date"],
            valid_upto=result["valid_upto"],
            trans_distance_km=result["trans_distance_km"],
            vehicle_no=result.get("vehicle_no"),
            transporter_id=result.get("transporter_id"),
            status_code=result["status_code"],
        )

    async def cancel_ewaybill(self, req: CancelComplianceDocRequest) -> Dict[str, Any]:
        """
        Cancels an active E-Way Bill within 24 hours and synchronizes database status.
        """
        credentials = (
            {"username": settings.EWAYBILL_USERNAME, "password": settings.EWAYBILL_PASSWORD}
            if settings.EWAYBILL_LIVE_ENABLED
            else {"username": "TEST_EWB_USER", "password": "TEST_EWB_PASSWORD"}
        )
        token = self.connector.authenticate(credentials)
        result = self.connector.cancel(document_no=req.document_no, reason=req.reason, token=token)

        # Update canonical EWayBill record if present
        stmt = select(EWayBill).where(EWayBill.eway_bill_no == req.document_no)
        existing_res = await self.db.execute(stmt)
        ewb = existing_res.scalar_one_or_none()
        if ewb:
            ewb.status = "CANCELLED"
            ewb.cancel_date = datetime.now(timezone.utc)
            ewb.cancel_remarks = req.reason

        audit_log = ComplianceAuditLog(
            id=f"AUD-{uuid.uuid4().hex[:12].upper()}",
            service_id="ewaybill",
            endpoint="/api/v1/compliance/ewaybill/cancel",
            request_payload=json.dumps({"ewb_no": req.document_no, "reason": req.reason}),
            response_payload=json.dumps(result),
            status_code=200,
            duration_ms=10,
            company_id=self.tenant_ctx.company_id if self.tenant_ctx else None,
            branch_id=self.tenant_ctx.branch_id if self.tenant_ctx else None,
        )
        self.db.add(audit_log)
        await self.db.commit()
        return result

