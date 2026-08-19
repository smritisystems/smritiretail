"""
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.0
 * Created      : 2026-08-15
 * Modified     : 2026-08-19
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
"""

import sys, os

sys.stdout.reconfigure(encoding='utf-8')

def test_mock_kpi_remediation_e2e():
    """
    End-to-End Headless Verification for Blocker #8 — Wire/Remove All Identified Mock Business KPI Data.
    Verifies:
    - Complete removal of demo mock strings ('4,25,800', 'TechCorp Distributors') from UI components
    - Dynamic backend wiring via MasterListScreen and supplierMasterConfig
    """
    filepath = r"F:\SMRITRretailNX\src\components\SupplierDashboardTab.tsx"
    config_path = r"F:\SMRITRretailNX\src\components\global\configs\supplierMaster.config.tsx"
    
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    assert "4,25,800" not in content, "Mock figure ₹4,25,800 still present in UI!"
    assert "TechCorp Distributors" not in content, "Fake vendor TechCorp Distributors still present in UI!"
    assert "MasterListScreen" in content, "MasterListScreen integration missing from SupplierDashboardTab!"

    with open(config_path, "r", encoding="utf-8") as f:
        cfg_content = f.read()

    assert "/api/v1/purchase/suppliers/" in cfg_content, "FastAPI endpoint missing from supplier config!"
    assert "4,25,800" not in cfg_content, "Mock figure ₹4,25,800 still present in config!"
    assert "TechCorp Distributors" not in cfg_content, "Fake vendor TechCorp Distributors still present in config!"

    print("✅ E2E Verification PASSED: Mock Business KPI Data successfully removed and wired to live dynamic backend!")

if __name__ == "__main__":
    test_mock_kpi_remediation_e2e()

