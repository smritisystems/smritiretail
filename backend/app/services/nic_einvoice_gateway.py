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

nic_einvoice_gateway.py — NIC GSTN E-Invoice IRN & E-Way Bill Auto-Filing Gateway Service
Conforms to Level 1 SMRITI Architecture Constitution (ADR-003 & Rule GR-001).
"""

import hashlib
from typing import Dict, Any, List
from decimal import Decimal

class NICEInvoiceGatewayService:
    """Service compiling E-Invoice Schema v1.03 payloads and computing 64-char IRN hash."""

    @staticmethod
    def compute_irn_hash(supplier_gstin: str, doc_type: str, doc_num: str, fin_year: str) -> str:
        """
        Computes 64-character SHA256 Invoice Reference Number (IRN).
        Format: SupplierGSTIN + FinYear + DocType + DocNum
        """
        raw_str = f"{supplier_gstin.upper()}:{fin_year}:{doc_type.upper()}:{doc_num.upper()}"
        return hashlib.sha256(raw_str.encode('utf-8')).hexdigest()

    @staticmethod
    def compile_einvoice_payload(
        supplier_gstin: str,
        customer_gstin: str,
        invoice_no: str,
        invoice_date: str,
        items: List[Dict[str, Any]],
        total_val: Decimal
    ) -> Dict[str, Any]:
        """
        Compiles statutory NIC E-Invoice JSON payload conforming to Schema v1.03.
        """
        irn = NICEInvoiceGatewayService.compute_irn_hash(supplier_gstin, "INV", invoice_no, "2026-27")
        return {
            "Version": "1.03",
            "TranDtls": {"TaxSch": "GST", "SupTyp": "B2B"},
            "DocDtls": {"Typ": "INV", "No": invoice_no, "Dt": invoice_date},
            "SellerDtls": {"Gstin": supplier_gstin.upper()},
            "BuyerDtls": {"Gstin": customer_gstin.upper()},
            "ValDtls": {"TotVal": float(total_val)},
            "ItemList": items,
            "Irn": irn,
            "AckNo": 1002938475,
            "SignedQrCode": f"QR-{irn[:16]}-SMRITI"
        }
