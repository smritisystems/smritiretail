"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 4.7.0
Created      : 2026-07-20
Modified     : 2026-07-20
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field


class NICEWayBillLineItem(BaseModel):
    product_name: str = Field(..., json_schema_extra={"example": "Basmati Rice 5kg"})
    hsn_code: str = Field(..., json_schema_extra={"example": "10063020"})
    quantity: float = Field(..., json_schema_extra={"example": 10.0})
    unit: str = Field(..., json_schema_extra={"example": "KGS"})
    taxable_amount: float = Field(..., json_schema_extra={"example": 2500.00})
    cgst_rate: float = Field(default=2.5, json_schema_extra={"example": 2.5})
    sgst_rate: float = Field(default=2.5, json_schema_extra={"example": 2.5})
    igst_rate: float = Field(default=0.0, json_schema_extra={"example": 0.0})


class NICEWayBillRequest(BaseModel):
    document_number: str = Field(..., json_schema_extra={"example": "INV-2026-0089"})
    document_date: str = Field(..., json_schema_extra={"example": "2026-07-20"})
    supply_type: str = Field(default="O", json_schema_extra={"example": "O"})  # O = Outward, I = Inward
    sub_supply_type: str = Field(default="1", json_schema_extra={"example": "1"})  # 1 = Supply
    doc_type: str = Field(default="INV", json_schema_extra={"example": "INV"})
    from_gstin: str = Field(..., json_schema_extra={"example": "27ABCDE1234F1Z5"})
    from_trd_name: str = Field(..., json_schema_extra={"example": "SMRITI Retail Store"})
    from_addr1: str = Field(..., json_schema_extra={"example": "Plot 45, MG Road"})
    from_place: str = Field(..., json_schema_extra={"example": "Mumbai"})
    from_pincode: int = Field(..., json_schema_extra={"example": 400001})
    to_gstin: str = Field(..., json_schema_extra={"example": "27XYZAB5678G2Z9"})
    to_trd_name: str = Field(..., json_schema_extra={"example": "Apex Wholesalers"})
    to_addr1: str = Field(..., json_schema_extra={"example": "Sector 18"})
    to_place: str = Field(..., json_schema_extra={"example": "Thane"})
    to_pincode: int = Field(..., json_schema_extra={"example": 400601})
    total_value: float = Field(..., json_schema_extra={"example": 2500.00})
    cgst_value: float = Field(default=62.50, json_schema_extra={"example": 62.50})
    sgst_value: float = Field(default=62.50, json_schema_extra={"example": 62.50})
    igst_value: float = Field(default=0.0, json_schema_extra={"example": 0.0})
    transporter_id: Optional[str] = Field(None, json_schema_extra={"example": "27TRNSP1234F1Z0"})
    transporter_name: Optional[str] = Field(None, json_schema_extra={"example": "VRL Logistics"})
    trans_distance: int = Field(default=25, json_schema_extra={"example": 25})
    items: List[NICEWayBillLineItem]


class NICEWayBillResponse(BaseModel):
    success: bool
    ewb_number: Optional[str] = Field(None, json_schema_extra={"example": "141009876543"})
    ewb_date: Optional[str] = Field(None, json_schema_extra={"example": "2026-07-20 10:30:00"})
    valid_until: Optional[str] = Field(None, json_schema_extra={"example": "2026-07-21 23:59:59"})
    qr_code_url: Optional[str] = None
    error_code: Optional[str] = None
    error_message: Optional[str] = None


class NICEInvoiceRequest(BaseModel):
    document_number: str = Field(..., json_schema_extra={"example": "INV-2026-0089"})
    document_date: str = Field(..., json_schema_extra={"example": "2026-07-20"})
    document_type: str = Field(default="INV", json_schema_extra={"example": "INV"})
    seller_gstin: str = Field(..., json_schema_extra={"example": "27ABCDE1234F1Z5"})
    buyer_gstin: str = Field(..., json_schema_extra={"example": "27XYZAB5678G2Z9"})
    total_invoice_value: float = Field(..., json_schema_extra={"example": 2625.00})
    items: List[NICEWayBillLineItem]


class NICEInvoiceResponse(BaseModel):
    success: bool
    irn: Optional[str] = Field(None, json_schema_extra={"example": "3f89a2b7c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1"})
    ack_no: Optional[str] = Field(None, json_schema_extra={"example": "122610098765"})
    ack_date: Optional[str] = Field(None, json_schema_extra={"example": "2026-07-20 10:31:00"})
    signed_qr_code: Optional[str] = None
    error_code: Optional[str] = None
    error_message: Optional[str] = None


class NICEWayBillCancelRequest(BaseModel):
    ewb_number: str = Field(..., json_schema_extra={"example": "141009876543"})
    cancel_reason: str = Field(default="1", json_schema_extra={"example": "1"})  # 1 = Duplicate, 2 = Order Cancelled, 3 = Data Entry Error
    remarks: str = Field(..., json_schema_extra={"example": "Cancelled due to duplicate entry"})
