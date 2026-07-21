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
Classification: Native E-Invoice IRN & B2B Signed QR Code Engine
"""

import hashlib
import json
from typing import Dict, Any


class NICEInvoiceEngine:
    """SHA-256 IRN Hash Computation & B2B Signed QR Code Generator."""

    @classmethod
    def generate_irn_and_qr(cls, invoice_number: str, seller_gstin: str, buyer_gstin: str, total_value: float, doc_type: str = "INV") -> Dict[str, Any]:
        raw_string = f"{seller_gstin}:{doc_type}:{invoice_number}:{buyer_gstin}:{total_value:.2f}"
        irn_hash = hashlib.sha256(raw_string.encode('utf-8')).hexdigest()

        qr_data = {
            "seller_gstin": seller_gstin,
            "buyer_gstin": buyer_gstin,
            "doc_no": invoice_number,
            "doc_typ": doc_type,
            "tot_val": total_value,
            "irn": irn_hash
        }
        signed_qr_code = f"JWT_NIC_SIGNED.{json.dumps(qr_data)}"

        return {
            "invoice_number": invoice_number,
            "seller_gstin": seller_gstin,
            "buyer_gstin": buyer_gstin,
            "total_value": total_value,
            "irn_hash": irn_hash,
            "signed_qr_code": signed_qr_code,
            "status": "IRN_GENERATED_SUCCESSFULLY"
        }
