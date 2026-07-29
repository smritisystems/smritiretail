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

from app.core.gs1_barcode_parser import parse_gs1_barcode

def test_parse_gs1_gtin_and_batch_and_expiry():
    raw_gs1 = "(01)08901234567894(10)BATCH9988(17)261231"
    parsed = parse_gs1_barcode(raw_gs1)

    assert parsed.is_valid is True
    assert parsed.gtin == "08901234567894"
    assert parsed.batch_number == "BATCH9988"
    assert parsed.expiry_date.strftime("%Y-%m-%d") == "2026-12-31"
