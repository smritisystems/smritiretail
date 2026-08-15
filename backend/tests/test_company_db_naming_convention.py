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

import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
from app.services.company_database_resolver import (
    generate_company_database_name,
    validate_company_database_name,
    CompanyDatabaseResolver
)

def test_generate_company_database_name_valid_alphanumeric():
    """Verify smriti<3-character-alphanumeric> generation rules."""
    assert generate_company_database_name("001") == "smriti001"
    assert generate_company_database_name("007") == "smriti007"
    assert generate_company_database_name("125") == "smriti125"
    assert generate_company_database_name("ABC") == "smritiABC"
    assert generate_company_database_name("A01") == "smritiA01"
    assert generate_company_database_name("R01") == "smritiR01"
    assert generate_company_database_name("MUM") == "smritiMUM"
    assert generate_company_database_name("RET") == "smritiRET"
    assert generate_company_database_name("TT1") == "smritiTT1"
    assert generate_company_database_name("abc") == "smritiABC"  # Normalization

def test_generate_company_database_name_reserved_codes():
    """Verify 000 and SYS are permanently reserved and rejected."""
    with pytest.raises(ValueError) as exc_info_000:
        generate_company_database_name("000")
    assert "reserved" in str(exc_info_000.value)

    with pytest.raises(ValueError) as exc_info_sys:
        generate_company_database_name("SYS")
    assert "reserved" in str(exc_info_sys.value)

def test_generate_company_database_name_invalid_format():
    """Verify non-3-character or special-character codes are rejected."""
    with pytest.raises(ValueError):
        generate_company_database_name("ABCD")  # 4 chars
    with pytest.raises(ValueError):
        generate_company_database_name("A1")    # 2 chars
    with pytest.raises(ValueError):
        generate_company_database_name("A-1")   # Hyphen
    with pytest.raises(ValueError):
        generate_company_database_name("A_1")   # Underscore
    with pytest.raises(ValueError):
        generate_company_database_name("A 1")   # Space

def test_validate_company_database_name_valid():
    """Verify valid database names comply with smriti<3-alphanumeric>."""
    assert validate_company_database_name("smriti001") is True
    assert validate_company_database_name("smritiABC") is True
    assert validate_company_database_name("smritiA01") is True
    assert validate_company_database_name("smritiMUM") is True
    assert validate_company_database_name("smritiTT1") is True
    assert validate_company_database_name("smritisys") is True  # Control Plane

def test_validate_company_database_name_invalid():
    """Verify reserved or invalid database names are rejected."""
    assert validate_company_database_name("smriti000") is False  # Reserved
    assert validate_company_database_name("smritiSYS") is False  # Reserved Control Plane
    assert validate_company_database_name("smriti_001") is False # Separator forbidden
    assert validate_company_database_name("company_comp_001") is False  # Legacy prefix
    assert validate_company_database_name("smriti-ABC") is False # Hyphen forbidden
    assert validate_company_database_name("smritiABCD") is False  # 4 chars forbidden

def test_resolver_enforces_alphanumeric_codes():
    """Verify CompanyDatabaseResolver resolves alphanumeric codes correctly."""
    res_001 = CompanyDatabaseResolver.resolve_company_database("usr_sysadmin", "COMP-001")
    assert res_001["database_name"] == "smriti001"
    assert generate_company_database_name("MUM") == "smritiMUM"
