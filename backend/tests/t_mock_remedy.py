"""
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.0
 * Created      : 2026-08-15
 * Modified     : 2026-08-15
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
"""

import pytest

def test_supplier_dashboard_component_zero_state_remediation():
    """
    Test Blocker #8 P2 Data Trust: Wire/Remove All Identified Mock Business KPI Data.
    Asserts:
    - SupplierDashTab.tsx file does not contain hardcoded demo figures ('4,25,800', 'TechCorp Distributors')
    - Zero-record state renders honest zeroes ('₹0.00', '0 Open POs', '0.0 Days')
    """
    filepath = r"F:\SMRITRretailNX\src\components\SupplierDashTab.tsx"
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    # Assert removal of hardcoded fake demo values
    assert "4,25,800" not in content, "Mock payables figure ₹4,25,800 must be removed"
    assert "TechCorp Distributors" not in content, "Fake demo vendor TechCorp Distributors must be removed"
    assert "1,85,000" not in content, "Fake PO value ₹1,85,000 must be removed"

    # Assert presence of honest zero-state values
    assert "₹0.00" in content, "Zero-state must display honest ₹0.00"
    assert "0.0 Days" in content, "Zero-state must display honest 0.0 Days"
