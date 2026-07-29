"""
Project      : SMRITI Retail OS
Organization : SmritiSys
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.0.0
Created      : 2026-07-28
Modified     : 2026-07-28
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import pytest
import datetime
from app.core.ewaybill_calculator import calculate_ewaybill_validity

def test_standard_cargo_ewaybill_validity():
    dispatch_time = datetime.datetime(2026, 7, 28, 10, 0, 0)

    # 1. Distance <= 200 km -> 1 Day
    res1 = calculate_ewaybill_validity(150.0, is_odc=False, dispatch_at=dispatch_time)
    assert res1.validity_days == 1
    assert res1.expires_at == datetime.datetime(2026, 7, 29, 23, 59, 59)

    # 2. Distance 201 km -> 2 Days (math.ceil(201/200) = 2)
    res2 = calculate_ewaybill_validity(201.0, is_odc=False, dispatch_at=dispatch_time)
    assert res2.validity_days == 2
    assert res2.expires_at == datetime.datetime(2026, 7, 30, 23, 59, 59)

    # 3. Distance 550 km -> 3 Days (math.ceil(550/200) = 3)
    res3 = calculate_ewaybill_validity(550.0, is_odc=False, dispatch_at=dispatch_time)
    assert res3.validity_days == 3

def test_odc_cargo_ewaybill_validity():
    dispatch_time = datetime.datetime(2026, 7, 28, 10, 0, 0)

    # ODC: 15 km -> 1 Day
    res1 = calculate_ewaybill_validity(15.0, is_odc=True, dispatch_at=dispatch_time)
    assert res1.validity_days == 1

    # ODC: 45 km -> 3 Days (math.ceil(45/20) = 3)
    res2 = calculate_ewaybill_validity(45.0, is_odc=True, dispatch_at=dispatch_time)
    assert res2.validity_days == 3

def test_invalid_distance():
    with pytest.raises(ValueError, match="Distance must be a positive number"):
        calculate_ewaybill_validity(0.0)
