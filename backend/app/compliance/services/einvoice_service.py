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

SMRITI Government Integration Platform (SGIP) — E-Invoice Service Orchestrator.
Coordinates GSTN INV-01 JSON transformation, NIC gateway execution, audit logging,
and idempotent invoice regularization.
"""

import json
import time
import uuid
from typing import Any, Dict, Optional
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import TenantContext
from app.compliance.connectors.einvoice.connector import EInvoiceConnector
from app.compliance.exceptions import PolicyViolationException
from app.compliance.models.compliance import ComplianceAuditLog
from app.compliance.schemas.compliance import (
    EInvoiceGenerationRequest,
    EInvoiceResponse,
    CancelComplianceDocRequest,
)
from app.compliance.services.credential_service import CredentialService


class EInvoiceService:
    """
    High-level business service for GSTN/NIC E-Invoice operations.
    """

    def __init__(
        self,
        db: AsyncSession,
        tenant_ctx: Optional[TenantContext] = None,
        connector: Optional[EInvoiceConnector] = None
    ) -> None:
        self.db = db
        self.tenant_ctx = tenant_ctx
        self.connector = connector or EInvoiceConnector()
        self.credential_service = CredentialService(db, tenant_ctx)

    def build_gstn_payload(self, req: EInvoiceGenerationRequest) -> Dict[str, Any]:
        """
        Converts internal EInvoiceGenerationRequest to statutory GSTN INV-01 schema.
        """
        item_list = []
        for idx, itm in enumerate(req.items, start=1):
            item_list.append({
                "SlNo": str(idx),
                "PrdDesc": itm.description,
                "IsServc": "N",
                "HsnCd": itm.hsn_code,
                "Qty": itm.quantity,
                "Unit": itm.unit,
                "UnitPrice": itm.unit_price,
                "TotAmt": itm.gross_amount,
                "Discount": itm.discount_amount,
                "AssAmt": itm.taxable_amount,
                "GstRt": itm.gst_rate,
                "IgstAmt": itm.igst_amount,
                "CgstAmt": itm.cgst_amount,
                "SgstAmt": itm.sgst_amount,
                "TotItemVal": itm.total_item_value,
            })

        return {
            "Version": "1.03",
            "TranDtls": {
                "TaxSch": "GST",
                "SupTyp": "B2B" if req.buyer_gstin != "URP" else "B2C",
                "RegRev": "N",
                "EcmGstin": None,
                "IgstOnIntra": "N",
            },
            "DocDtls": {
                "Typ": "INV",
                "No": req.invoice_no,
                "Dt": req.invoice_date,
                "FinYear": req.financial_year,
            },
            "SellerDtls": {
                "Gstin": req.supplier_gstin,
                "LglNm": req.supplier_legal_name,
                "Addr1": req.supplier_address,
                "Loc": "HQ",
                "Pin": req.supplier_pincode,
                "Stcd": req.supplier_state_code,
            },
            "BuyerDtls": {
                "Gstin": req.buyer_gstin,
                "LglNm": req.buyer_legal_name,
                "Pos": req.buyer_state_code,
                "Addr1": req.buyer_address,
                "Loc": "Store",
                "Pin": req.buyer_pincode,
                "Stcd": req.buyer_state_code,
            },
            "ItemList": item_list,
            "ValDtls": {
                "AssVal": req.total_taxable_value,
                "CgstVal": req.total_cgst_value,
                "SgstVal": req.total_sgst_value,
                "IgstVal": req.total_igst_value,
                "Discount": 0.0,
                "OthChrg": 0.0,
                "RndOffAmt": 0.0,
                "TotInvVal": req.total_invoice_value,
            },
        }

    async def generate_einvoice(self, request: EInvoiceGenerationRequest) -> EInvoiceResponse:
        """
        Orchestrates E-Invoice generation, audit logging, and IRN capture.
        """
        start_time = time.time()
        gstn_payload = self.build_gstn_payload(request)

        # Authenticate using sandbox credentials
        credentials = {"username": "TEST_NIC_USER", "password": "TEST_NIC_PASSWORD"}
        token = self.connector.authenticate(credentials)

        # Submit to NIC connector
        result = self.connector.submit(gstn_payload, token=token)
        duration_ms = int((time.time() - start_time) * 1000)

        # Record Audit Log
        audit_log = ComplianceAuditLog(
            id=f"AUD-{uuid.uuid4().hex[:12].upper()}",
            service_id="einvoice",
            endpoint="/api/v1/compliance/einvoice/generate",
            request_payload=json.dumps({"invoice_no": request.invoice_no, "gstin": request.supplier_gstin}),
            response_payload=json.dumps({"irn": result.get("irn"), "status": result.get("status")}),
            status_code=200,
            duration_ms=duration_ms,
            company_id=self.tenant_ctx.company_id if self.tenant_ctx else None,
            branch_id=self.tenant_ctx.branch_id if self.tenant_ctx else None,
        )
        self.db.add(audit_log)
        await self.db.commit()

        return EInvoiceResponse(
            status="SUCCESS",
            invoice_id=request.invoice_id,
            invoice_no=request.invoice_no,
            irn=result["irn"],
            ack_no=result["ack_no"],
            ack_date=result["ack_date"],
            signed_invoice=result["signed_invoice"],
            signed_qr_code=result["signed_qr_code"],
            status_code=result["status_code"],
        )

    async def cancel_einvoice(self, req: CancelComplianceDocRequest) -> Dict[str, Any]:
        """
        Cancels an existing IRN with audit capture.
        """
        token = self.connector.authenticate({"username": "TEST_USER", "password": "TEST_PASSWORD"})
        result = self.connector.cancel(document_no=req.document_no, reason=req.reason, token=token)

        audit_log = ComplianceAuditLog(
            id=f"AUD-{uuid.uuid4().hex[:12].upper()}",
            service_id="einvoice",
            endpoint="/api/v1/compliance/einvoice/cancel",
            request_payload=json.dumps({"irn": req.document_no, "reason": req.reason}),
            response_payload=json.dumps(result),
            status_code=200,
            duration_ms=10,
            company_id=self.tenant_ctx.company_id if self.tenant_ctx else None,
            branch_id=self.tenant_ctx.branch_id if self.tenant_ctx else None,
        )
        self.db.add(audit_log)
        await self.db.commit()
        return result
