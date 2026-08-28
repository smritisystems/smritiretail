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
from typing import Any, Dict, Optional
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import TenantContext
from app.compliance.connectors.ewaybill.connector import EWayBillConnector
from app.compliance.exceptions import PolicyViolationException
from app.compliance.models.compliance import ComplianceAuditLog
from app.compliance.schemas.compliance import (
    EWayBillGenerationRequest,
    EWayBillResponse,
    CancelComplianceDocRequest,
)


class EWayBillService:
    """
    High-level business service for NIC E-Way Bill operations.
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
        Generates statutory E-Way Bill via NIC connector with audit logging.
        """
        start_time = time.time()
        
        payload = {
            "supplyType": "O",
            "subSupplyType": "1",
            "docType": request.doc_type,
            "docNo": request.doc_no,
            "fromGstin": request.from_gstin,
            "toGstin": request.to_gstin,
            "fromPincode": request.from_pincode,
            "toPincode": request.to_pincode,
            "totInvValue": request.total_invoice_value,
            "transDistance": request.trans_distance_km,
            "transporterId": request.transporter_id or "",
            "transporterName": request.transporter_name or "",
            "vehicleNo": request.vehicle_no or "",
        }

        # Authenticate
        token = self.connector.authenticate({"username": "TEST_EWB_USER", "password": "TEST_EWB_PASSWORD"})
        result = self.connector.submit(payload, token=token)
        duration_ms = int((time.time() - start_time) * 1000)

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
        Cancels an active E-Way Bill within 24 hours.
        """
        token = self.connector.authenticate({"username": "TEST_EWB_USER", "password": "TEST_EWB_PASSWORD"})
        result = self.connector.cancel(document_no=req.document_no, reason=req.reason, token=token)

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
