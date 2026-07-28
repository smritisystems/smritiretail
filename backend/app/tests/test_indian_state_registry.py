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

from app.core.indian_state_registry import get_state_by_code, get_all_states

def test_indian_state_code_lookup():
    up = get_state_by_code("09")
    assert up is not None
    assert up.name == "Uttar Pradesh"
    assert up.abbreviation == "UP"

    mh = get_state_by_code("27")
    assert mh is not None
    assert mh.name == "Maharashtra"

    states = get_all_states()
    assert len(states) >= 36
