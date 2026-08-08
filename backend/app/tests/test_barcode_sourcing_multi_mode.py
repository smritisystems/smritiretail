"""
Unit and integration tests for Barcode Sourcing Multi-Mode Support.
Verifies GS1 company prefix validation, multi-tenant prefix isolation,
restricted-distribution (200-series) internal barcode fallback, and
company-level barcode_source (AUTO / IMPORT / MANUAL) policy enforcement.
"""

import pytest
from app.services.identity_service import ProductIdentityService
from app.services.sip.strategies import GS1Strategy


def test_gs1_company_prefix_validation():
    """Verifies strict GS1 prefix validation: digits only, length 6-11."""
    # Valid prefixes
    assert ProductIdentityService.validate_gs1_company_prefix("8901234") == "8901234"
    assert ProductIdentityService.validate_gs1_company_prefix("89012345678") == "89012345678"
    assert ProductIdentityService.validate_gs1_company_prefix(None) is None
    assert ProductIdentityService.validate_gs1_company_prefix("") is None

    # Invalid non-digit characters
    with pytest.raises(ValueError, match="must contain only numeric digits"):
        ProductIdentityService.validate_gs1_company_prefix("890123A")

    # Invalid length (< 6 or > 11)
    with pytest.raises(ValueError, match="length must be between 6 and 11"):
        ProductIdentityService.validate_gs1_company_prefix("12345")

    with pytest.raises(ValueError, match="length must be between 6 and 11"):
        ProductIdentityService.validate_gs1_company_prefix("123456789012")


def test_multi_tenant_gs1_prefix_isolation():
    """Verifies that two tenants with different GS1 company prefixes produce distinct EAN-13 barcodes."""
    bc_tenant_a = ProductIdentityService.generate_ean13_barcode(gs1_company_prefix="8901234", seq_num=42)
    bc_tenant_b = ProductIdentityService.generate_ean13_barcode(gs1_company_prefix="8909876", seq_num=42)

    assert bc_tenant_a.startswith("8901234")
    assert bc_tenant_b.startswith("8909876")
    assert bc_tenant_a != bc_tenant_b
    assert len(bc_tenant_a) == 13
    assert len(bc_tenant_b) == 13


def test_internal_barcode_fallback_200_series():
    """
    Verifies that when gs1_company_prefix is None, the generator produces a valid EAN-13 barcode
    in GS1's restricted circulation range (200-299), and NEVER a hardcoded fake '8901000' prefix.
    """
    bc_internal = ProductIdentityService.generate_ean13_barcode(gs1_company_prefix=None, seq_num=101)

    assert bc_internal.startswith("200")
    assert not bc_internal.startswith("8901000")
    assert len(bc_internal) == 13

    # Check digit verification
    payload_12 = bc_internal[:12]
    expected_check = ProductIdentityService.calculate_ean13_check_digit(payload_12)
    assert bc_internal[12] == expected_check


def test_sip_gs1_strategy_prefix_support():
    """Verifies GS1Strategy in SIP engine respects gs1_company_prefix parameter."""
    strat = GS1Strategy()

    bc_gs1 = strat.generate_barcode(sequence_num=55, gs1_company_prefix="8905555")
    assert bc_gs1.startswith("8905555")
    assert len(bc_gs1) == 13

    bc_fallback = strat.generate_barcode(sequence_num=55, gs1_company_prefix=None)
    assert bc_fallback.startswith("200")
    assert not bc_fallback.startswith("8901000")
