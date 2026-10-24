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

def test_sequential_number_resolution():
    import re
    # Test case 1: Empty list -> Starts at 1
    pfx = "PO"
    fy = "26-27"
    p1 = re.compile(rf"^{re.escape(pfx)}[/\-_]{re.escape(fy)}[/\-_](\d+)", re.IGNORECASE)
    order_nos = []
    canonical_seqs = [int(p1.search(no).group(1)) for no in order_nos if p1.search(no)]
    next_seq = max(canonical_seqs) + 1 if canonical_seqs else 1
    assert next_seq == 1
    assert f"{pfx}/{fy}/{next_seq:04d}" == "PO/26-27/0001"

    # Test case 2: Existing 28 historical records -> Next is 29
    order_nos = [f"PO/26-27/{i:04d}" for i in range(1, 29)]
    # Plus unrelated legacy garbage from tests:
    order_nos.extend(["PO-978768", "PO-API-C90096", "PO-P4-D65570"])
    canonical_seqs = [int(p1.search(no).group(1)) for no in order_nos if p1.search(no)]
    next_seq = max(canonical_seqs) + 1 if canonical_seqs else 1
    assert next_seq == 29
    assert f"{pfx}/{fy}/{next_seq:04d}" == "PO/26-27/0029"

    # Test case 3: Next FY (27-28) -> Resets to 1
    fy_next = "27-28"
    p1_next = re.compile(rf"^{re.escape(pfx)}[/\-_]{re.escape(fy_next)}[/\-_](\d+)", re.IGNORECASE)
    canonical_seqs_next = [int(p1_next.search(no).group(1)) for no in order_nos if p1_next.search(no)]
    next_seq_next = max(canonical_seqs_next) + 1 if canonical_seqs_next else 1
    assert next_seq_next == 1
    assert f"{pfx}/{fy_next}/{next_seq_next:04d}" == "PO/27-28/0001"

    print("[PASS] All sequential number resolution and FY isolation assertions passed!")

if __name__ == "__main__":
    test_financial_year()
    test_sequential_number_resolution()
