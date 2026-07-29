"""
Project      : SMRITI Retail OS
Organization : SmritiSys
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 12.0.0
Created      : 2026-07-28
Modified     : 2026-07-28
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software

nic_gst.py — NIC GSTN E-Invoice & E-Way Bill REST API Router
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from decimal import Decimal
from app.services.nic_einvoice_gateway import NICEInvoiceGatewayService
from app.api.deps import get_tenant_context, TenantContext

router = APIRouter(prefix="/nic-gst", tags=["NIC GST E-Invoice"])

class EInvoiceRequest(BaseModel):
    supplier_gstin: str = Field(..., example="09AAACS1234A1Z1")
    customer_gstin: str = Field(..., example="27AABCU9603R1ZM")
    invoice_no: str = Field(..., example="INV-2026-001")
    invoice_date: str = Field(..., example="28/07/2026")
    items: List[Dict[str, Any]] = []
    total_val: Decimal = Decimal("1000.00")

@router.post("/generate-irn")
async def generate_einvoice_irn(
    req: EInvoiceRequest,
    tenant_ctx: TenantContext = Depends(get_tenant_context)
):
    """Generates statutory NIC E-Invoice payload and IRN hash."""
    payload = NICEInvoiceGatewayService.compile_einvoice_payload(
        req.supplier_gstin, req.customer_gstin, req.invoice_no, req.invoice_date, req.items, req.total_val
    )
    return {"status": "SUCCESS", "data": payload}
