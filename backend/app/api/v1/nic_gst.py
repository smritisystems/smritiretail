"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 26.0.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: NIC GSTN E-Way Bill & E-Invoice REST API Gateway
"""

from typing import Dict, Any
from fastapi import APIRouter, Body, Query

from app.core.nic_gst.nic_einvoice import NICEInvoiceEngine
from app.core.nic_gst.nic_ewaybill import NICEWayBillEngine
from app.core.nic_gst.nic_gstr_reconciler import NICGSTRReconcilerEngine

router = APIRouter(prefix="/nic-gst", tags=["Domain Release: NIC GSTN E-Way Bill & E-Invoice Gateway (v26.0.0)"])


@router.post("/einvoice/generate")
async def generate_einvoice_irn(invoice_number: str = Body(...), seller_gstin: str = Body(...), buyer_gstin: str = Body(...), total_value: float = Body(...)):
    """Computes SHA-256 IRN hash and produces signed B2B QR code."""
    return NICEInvoiceEngine.generate_irn_and_qr(invoice_number, seller_gstin, buyer_gstin, total_value)


@router.post("/ewaybill/generate")
async def generate_eway_bill(invoice_number: str = Body(...), transporter_id: str = Body(...), vehicle_number: str = Body(...), consignment_value: float = Body(...), distance_km: int = Body(100)):
    """Evaluates > Rs.50,000 threshold and generates NIC E-Way Bill."""
    return NICEWayBillEngine.generate_eway_bill(invoice_number, transporter_id, vehicle_number, consignment_value, distance_km)


@router.get("/gstr1/summary")
async def get_gstr1_summary(period: str = Query("2026-07")):
    """Compiles GSTR-1 and GSTR-3B monthly tax portal return summary payload."""
    return NICGSTRReconcilerEngine.compile_gstr1_summary(period)
