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
"""

from decimal import Decimal
from app.services.upi_qr_generator import DynamicUPIQRGenerator

def test_generate_upi_qr_uri():
    uri = DynamicUPIQRGenerator.generate_upi_uri(
        payee_vpa="smritisys@icici",
        payee_name="SMRITI Retail Ltd",
        amount=Decimal("450.00"),
        txn_ref_id="TXN-998877",
        note="POS Checkout Invoice #102"
    )

    assert uri.startswith("upi://pay?")
    assert "pa=smritisys%40icici" in uri or "pa=smritisys@icici" in uri
    assert "am=450.00" in uri
    assert "tr=TXN-998877" in uri
    assert "cu=INR" in uri
