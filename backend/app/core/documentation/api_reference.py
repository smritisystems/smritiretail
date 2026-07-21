"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 29.0.0
Created      : 2026-07-22
Modified     : 2026-07-22
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Interactive OpenAPI Reference Engine
"""

from typing import Dict, Any, List


class ApiReferenceEngine:
    """Interactive OpenAPI Endpoint Explorer with request/response examples and SDK snippets."""

    _ENDPOINTS = [
        {
            "endpoint_id": "ep-nic-einvoice",
            "path": "/api/v1/nic-gst/einvoice/generate",
            "method": "POST",
            "summary": "Computes SHA-256 IRN Hash and returns Signed B2B QR Code.",
            "category": "NIC GST Gateway",
            "authentication": "Bearer JWT Token (SIP-001)",
            "request_example": {
                "invoice_number": "INV-2026-001",
                "taxable_amount": 10000.0,
                "gst_rate": 18.0
            },
            "response_example": {
                "irn_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
                "signed_qr_code": "data:image/png;base64,iVBORw0KGgoAAA...",
                "status": "GENERATED"
            },
            "sdk_snippet_python": "from smriti_sdk import NicGstClient\nclient = NicGstClient(token='...')\nres = client.generate_einvoice(inv_no='INV-2026-001', amount=10000)"
        },
        {
            "endpoint_id": "ep-pharma-expiry",
            "path": "/api/v1/pharma/expiry-lock/check",
            "method": "POST",
            "summary": "Evaluates FEFO near-expiry locks (blocks items expiring in < 30 days).",
            "category": "Pharma Engine",
            "authentication": "Bearer JWT Token (SIP-001)",
            "request_example": {
                "batch_number": "BATCH-2026-X",
                "expiry_date": "2026-08-01"
            },
            "response_example": {
                "batch_number": "BATCH-2026-X",
                "days_remaining": 10,
                "locked": True,
                "reason": "FEFO Policy: Expires in less than 30 days"
            },
            "sdk_snippet_python": "from smriti_sdk import PharmaClient\nclient = PharmaClient(token='...')\nres = client.check_expiry_lock(batch='BATCH-2026-X')"
        }
    ]

    @classmethod
    def get_api_endpoints(cls) -> List[Dict[str, Any]]:
        return cls._ENDPOINTS
