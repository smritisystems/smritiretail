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

upi_qr_generator.py — NPCI Dynamic UPI QR Code String Encoder for POS Terminals
Conforms to Level 1 SMRITI Architecture Constitution (ADR-003 & Rule GR-001).
"""

import urllib.parse
from decimal import Decimal
from typing import Dict, Any

class DynamicUPIQRGenerator:
    """NPCI Unified Payments Interface (UPI) Specification v1.6 QR URI Encoder."""

    @staticmethod
    def generate_upi_uri(
        payee_vpa: str,
        payee_name: str,
        amount: Decimal,
        txn_ref_id: str,
        note: str = "SMRITI POS Checkout",
        mcc: str = "5411"  # Grocery Stores / Supermarkets
    ) -> str:
        """
        Generates statutory NPCI UPI QR string.
        Format: upi://pay?pa=VPA&pn=NAME&am=AMOUNT&tr=REFID&tn=NOTE&mc=MCC&cu=INR
        """
        formatted_amount = f"{Decimal(str(amount)):.2f}"
        params = {
            "pa": payee_vpa,
            "pn": payee_name,
            "am": formatted_amount,
            "tr": txn_ref_id,
            "tn": note,
            "mc": mcc,
            "cu": "INR"
        }
        encoded_query = urllib.parse.urlencode(params)
        return f"upi://pay?{encoded_query}"
