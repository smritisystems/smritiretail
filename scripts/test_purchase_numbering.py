"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.95.0
Created      : 2026-10-19
Modified     : 2026-10-19
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Unit Test for PO and GRN Numbering Standard
"""

import datetime
from backend.app.services.purchase import PurchaseService

def test_financial_year():
    # Tests Indian Financial Year (Apr 1 - Mar 31)
    fy1 = PurchaseService.get_financial_year(datetime.date(2026, 4, 1))
    assert fy1 == "26-27", f"Expected 26-27, got {fy1}"

    fy2 = PurchaseService.get_financial_year(datetime.date(2026, 6, 26))
    assert fy2 == "26-27", f"Expected 26-27, got {fy2}"

    fy3 = PurchaseService.get_financial_year(datetime.date(2026, 12, 31))
    assert fy3 == "26-27", f"Expected 26-27, got {fy3}"

    fy4 = PurchaseService.get_financial_year(datetime.date(2027, 1, 1))
    assert fy4 == "26-27", f"Expected 26-27, got {fy4}"

    fy5 = PurchaseService.get_financial_year(datetime.date(2027, 3, 31))
    assert fy5 == "26-27", f"Expected 26-27, got {fy5}"

    fy6 = PurchaseService.get_financial_year(datetime.date(2027, 4, 1))
    assert fy6 == "27-28", f"Expected 27-28, got {fy6}"

    print("[PASS] All financial year boundary assertions passed!")

if __name__ == "__main__":
    test_financial_year()
