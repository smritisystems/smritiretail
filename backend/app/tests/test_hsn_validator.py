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

from app.core.hsn_validator import validate_hsn_code

def test_hsn_sac_code_validation():
    # Valid HSN 3004 (Medicaments)
    res = validate_hsn_code("300490")
    assert res.is_valid is True
    assert res.digits == 6
    assert res.is_sac is False

    # Valid SAC 9983 (IT Services)
    sac = validate_hsn_code("998311")
    assert sac.is_valid is True
    assert sac.is_sac is True
