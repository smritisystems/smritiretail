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
from app.services.esc_pos_printer import ESCPOSThermalPrinter

def test_esc_pos_receipt_encoding():
    items = [
        {"name": "Paracetamol 500", "qty": 2, "price": Decimal("25.00")},
        {"name": "Cotton Roll", "qty": 1, "price": Decimal("50.00")}
    ]
    raw_bytes = ESCPOSThermalPrinter.generate_receipt_bytes("SMRITI PHARMA", "INV-10023", items, Decimal("100.00"))

    assert b"SMRITI PHARMA" in raw_bytes
    assert b"INV-10023" in raw_bytes
    assert b"TOTAL: RS. 100.00" in raw_bytes
    assert raw_bytes.endswith(ESCPOSThermalPrinter.CUT_PAPER)
