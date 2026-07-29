"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 4.12.0
Created      : 2026-07-20
Modified     : 2026-07-20
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

"""
Test Suite: v4.12.0 Indian Retail Market Hardening Suite

Tests:
1. HSN/SAC Validation Engine
2. UPI Payment Reference Validator
3. Indian State Code Registry
4. Multilingual/Vernacular Product Label Schema
5. TCS/TDS Rate Engine
6. GST Filing Health Score Engine
"""

import pytest
from decimal import Decimal
from datetime import date

from app.core.hsn_validator import validate_hsn, get_hsn_description
from app.core.upi_validator import validate_vpa, validate_upi_ref_id, validate_upi_amount
from app.core.indian_state_registry import (
    get_state_by_code, get_state_by_name, get_state_by_abbreviation,
    extract_state_from_gstin, is_intrastate_supply, get_states_by_region,
)
from app.schemas.multilingual import MultilingualLabel, ProductVernacularExtension
from app.core.tcs_tds_engine import calculate_tcs, calculate_tds
from app.services.gst_health_score import calculate_gst_health_score


# ===========================================================================
# 1. HSN/SAC Validation Engine Tests
# ===========================================================================

class TestHSNValidator:

    def test_valid_2_digit_hsn(self):
        result = validate_hsn("64")
        assert result.is_valid is True
        assert result.chapter == "64"
        assert "Footwear" in result.tax_band or "28%" in result.tax_band
        assert result.digits == 2
        assert result.is_service is False

    def test_valid_4_digit_hsn(self):
        result = validate_hsn("6403")
        assert result.is_valid is True
        assert result.digits == 4
        assert result.chapter == "64"

    def test_valid_6_digit_hsn(self):
        result = validate_hsn("640359")
        assert result.is_valid is True
        assert result.digits == 6

    def test_valid_8_digit_hsn(self):
        result = validate_hsn("64035910")
        assert result.is_valid is True
        assert result.digits == 8

    def test_sac_code_chapter_99(self):
        result = validate_hsn("9954")
        assert result.is_valid is True
        assert result.is_service is True
        assert result.chapter == "99"

    def test_invalid_non_numeric_hsn(self):
        result = validate_hsn("AB12")
        assert result.is_valid is False
        assert result.error_message is not None

    def test_invalid_5_digit_hsn(self):
        result = validate_hsn("12345")
        assert result.is_valid is False
        assert "exactly 2, 4, 6, or 8" in result.error_message

    def test_textile_hsn_chapter(self):
        result = validate_hsn("52")
        assert result.is_valid is True
        assert "5%" in result.tax_band  # Cotton textiles

    def test_pharma_hsn_chapter(self):
        result = validate_hsn("30")
        assert result.is_valid is True
        assert "5%" in result.tax_band  # Pharmaceuticals at 5%/12%

    def test_hsn_description_chapter_64(self):
        desc = get_hsn_description("64")
        assert "Footwear" in desc

    def test_hsn_description_chapter_99(self):
        desc = get_hsn_description("99")
        assert "Service" in desc or "SAC" in desc


# ===========================================================================
# 2. UPI Payment Reference Validator Tests
# ===========================================================================

class TestUPIValidator:

    def test_valid_vpa_known_handle(self):
        result = validate_vpa("merchant@hdfc")
        assert result.is_valid is True
        assert result.handle == "hdfc"
        assert result.is_known_handle is True

    def test_valid_vpa_phonepay(self):
        result = validate_vpa("user@ybl")
        assert result.is_valid is True
        assert result.is_known_handle is True

    def test_valid_vpa_unknown_handle(self):
        result = validate_vpa("store@newbank")
        assert result.is_valid is True
        assert result.is_known_handle is False  # Unknown but still valid format

    def test_invalid_vpa_no_at(self):
        result = validate_vpa("merchanthdfc")
        assert result.is_valid is False
        assert result.error_code == "SMRITI-UPI-001"

    def test_invalid_vpa_too_short_local(self):
        result = validate_vpa("ab@hdfc")
        assert result.is_valid is False
        assert result.error_code == "SMRITI-UPI-001"

    def test_invalid_vpa_special_chars_in_handle(self):
        result = validate_vpa("user@hd-fc")
        assert result.is_valid is False

    def test_valid_upi_ref_id(self):
        result = validate_upi_ref_id("4F8C91AB23DE")
        assert result.is_valid is True

    def test_valid_upi_ref_id_numeric(self):
        result = validate_upi_ref_id("123456789012")
        assert result.is_valid is True

    def test_invalid_upi_ref_too_short(self):
        result = validate_upi_ref_id("123")
        assert result.is_valid is False
        assert result.error_code == "SMRITI-UPI-002"

    def test_invalid_upi_ref_special_chars(self):
        result = validate_upi_ref_id("123456-89012")
        assert result.is_valid is False

    def test_valid_upi_amount_within_limit(self):
        result = validate_upi_amount(Decimal("5000.00"))
        assert result.is_valid is True

    def test_invalid_upi_amount_exceeds_limit(self):
        result = validate_upi_amount(Decimal("150000.00"))
        assert result.is_valid is False
        assert result.error_code == "SMRITI-UPI-003"

    def test_invalid_upi_amount_zero(self):
        result = validate_upi_amount(Decimal("0"))
        assert result.is_valid is False


# ===========================================================================
# 3. Indian State Code Registry Tests
# ===========================================================================

class TestIndianStateRegistry:

    def test_lookup_maharashtra_by_code(self):
        state = get_state_by_code("27")
        assert state is not None
        assert state.name == "Maharashtra"
        assert state.abbreviation == "MH"
        assert state.region == "West"

    def test_lookup_karnataka_by_code(self):
        state = get_state_by_code("29")
        assert state is not None
        assert state.name == "Karnataka"

    def test_lookup_delhi_by_code(self):
        state = get_state_by_code("07")
        assert state is not None
        assert state.is_ut is True

    def test_lookup_by_abbreviation_mh(self):
        state = get_state_by_abbreviation("MH")
        assert state is not None
        assert state.code == "27"

    def test_lookup_by_name_goa(self):
        state = get_state_by_name("goa")
        assert state is not None
        assert state.code == "30"

    def test_lookup_by_name_partial(self):
        state = get_state_by_name("tamil")
        assert state is not None
        assert state.code == "33"

    def test_extract_state_from_gstin(self):
        # GSTIN starting with 27 = Maharashtra
        state = extract_state_from_gstin("27ABCDE1234F1Z5")
        assert state is not None
        assert state.name == "Maharashtra"

    def test_is_intrastate_same_state(self):
        result = is_intrastate_supply("27ABCDE1234F1Z5", "27XYZPQ9876G1Z3")
        assert result is True

    def test_is_interstate_different_states(self):
        result = is_intrastate_supply("27ABCDE1234F1Z5", "29XYZPQ9876G1Z3")
        assert result is False

    def test_states_by_region_south(self):
        states = get_states_by_region("South")
        codes = [s.code for s in states]
        assert "33" in codes  # Tamil Nadu
        assert "29" in codes  # Karnataka
        assert "32" in codes  # Kerala

    def test_unknown_state_code_returns_none(self):
        state = get_state_by_code("99")
        assert state is None


# ===========================================================================
# 4. Multilingual Label Schema Tests
# ===========================================================================

class TestMultilingualSchema:

    def test_create_multilingual_label_hindi_tamil(self):
        label = MultilingualLabel(
            hi="कपास की साड़ी",
            ta="பருத்தி புடவை",
        )
        assert label.hi == "कपास की साड़ी"
        assert label.ta == "பருத்தி புடவை"
        assert label.te is None

    def test_available_locales(self):
        label = MultilingualLabel(hi="हिंदी", kn="ಕನ್ನಡ")
        locales = label.available_locales()
        assert "hi" in locales
        assert "kn" in locales
        assert "ta" not in locales

    def test_get_label_for_locale(self):
        label = MultilingualLabel(hi="जूते", ta="காலணி")
        assert label.get_label_for_locale("hi") == "जूते"
        assert label.get_label_for_locale("ta") == "காலணி"
        assert label.get_label_for_locale("te", fallback="N/A") == "N/A"

    def test_is_empty_true(self):
        label = MultilingualLabel()
        assert label.is_empty() is True

    def test_is_empty_false(self):
        label = MultilingualLabel(gu="ગુજરાતી")
        assert label.is_empty() is False

    def test_product_vernacular_extension(self):
        ext = ProductVernacularExtension(
            vernacular_name=MultilingualLabel(hi="चावल", bn="চাল"),
            vernacular_unit=MultilingualLabel(hi="किलो"),
        )
        assert ext.vernacular_name.hi == "चावल"
        assert ext.vernacular_unit.hi == "किलो"

    def test_empty_vernacular_extension(self):
        ext = ProductVernacularExtension()
        assert ext.vernacular_name is None
        assert ext.vernacular_description is None


# ===========================================================================
# 5. TCS/TDS Rate Engine Tests
# ===========================================================================

class TestTCSTDSEngine:

    def test_tcs_not_applicable_low_turnover(self):
        result = calculate_tcs(
            seller_turnover_previous_fy=Decimal("5_00_00_000"),  # Rs 5 Crore
            buyer_cumulative_purchases_this_fy=Decimal("60_00_000"),
            current_transaction_amount=Decimal("1_00_000"),
        )
        assert result.applicable is False
        assert result.tcs_amount == Decimal("0")
        assert result.seller_turnover_exceeds_threshold is False

    def test_tcs_not_applicable_buyer_threshold_not_crossed(self):
        result = calculate_tcs(
            seller_turnover_previous_fy=Decimal("12_00_00_000"),  # Rs 12 Crore
            buyer_cumulative_purchases_this_fy=Decimal("30_00_000"),  # Rs 30L < 50L
            current_transaction_amount=Decimal("5_00_000"),
        )
        assert result.applicable is False
        assert result.buyer_purchases_exceed_threshold is False

    def test_tcs_applicable_full_scenario(self):
        result = calculate_tcs(
            seller_turnover_previous_fy=Decimal("15_00_00_000"),  # Rs 15 Crore
            buyer_cumulative_purchases_this_fy=Decimal("80_00_000"),  # Rs 80L > 50L
            current_transaction_amount=Decimal("10_00_000"),  # Rs 10L
        )
        assert result.applicable is True
        assert result.tcs_amount == Decimal("1000.00")  # 0.1% of 10L
        assert result.section_reference.startswith("Section 206C")

    def test_tds_not_applicable_threshold_not_crossed(self):
        result = calculate_tds(
            buyer_cumulative_purchases_this_fy=Decimal("30_00_000"),  # Rs 30L < 50L
            current_transaction_amount=Decimal("5_00_000"),
        )
        assert result.applicable is False
        assert result.tds_amount == Decimal("0")

    def test_tds_applicable_full_scenario(self):
        result = calculate_tds(
            buyer_cumulative_purchases_this_fy=Decimal("60_00_000"),  # Rs 60L > 50L
            current_transaction_amount=Decimal("5_00_000"),  # Rs 5L
        )
        assert result.applicable is True
        assert result.tds_amount == Decimal("500.00")  # 0.1% of 5L
        assert result.section_reference.startswith("Section 194Q")

    def test_tds_not_applicable_no_tan(self):
        result = calculate_tds(
            buyer_cumulative_purchases_this_fy=Decimal("60_00_000"),
            current_transaction_amount=Decimal("5_00_000"),
            buyer_has_tan=False,
        )
        assert result.applicable is False
        assert "TAN" in result.reason


# ===========================================================================
# 6. GST Filing Health Score Engine Tests
# ===========================================================================

class TestGSTHealthScore:

    def _perfect_invoice(self, **overrides):
        defaults = dict(
            supplier_gstin="27AABCU9603R1ZX",
            buyer_gstin="29AABCU9603R1ZX",
            invoice_date=date(2026, 7, 10),
            filing_period_start=date(2026, 7, 1),
            filing_period_end=date(2026, 7, 31),
            hsn_code="64035910",
            declared_tax_rate_percent=Decimal("18"),
            place_of_supply_state_code="29",
            reverse_charge_applicable=False,
            reverse_charge_flag_set=False,
            invoice_total_declared=Decimal("11800.00"),
            sum_of_line_items=Decimal("11800.00"),
        )
        defaults.update(overrides)
        return calculate_gst_health_score(**defaults)

    def test_perfect_invoice_score_100(self):
        result = self._perfect_invoice()
        assert result.score == 100
        assert result.is_filing_ready is True
        assert result.pass_count == 7
        assert result.fail_count == 0

    def test_invalid_gstin_deducts_score(self):
        result = self._perfect_invoice(supplier_gstin="INVALID_GSTIN")
        assert result.score < 100
        assert result.fail_count >= 1
        assert any("SMRITI-GST-HEALTH-001" in c.error_code for c in result.checks if not c.passed)

    def test_missing_hsn_deducts_score(self):
        result = self._perfect_invoice(hsn_code="")
        assert result.score < 100
        assert any("SMRITI-GST-HEALTH-002" in c.error_code for c in result.checks if not c.passed)

    def test_invalid_tax_rate_deducts_score(self):
        result = self._perfect_invoice(declared_tax_rate_percent=Decimal("15"))
        assert result.score < 100
        assert any("SMRITI-GST-HEALTH-004" in c.error_code for c in result.checks if not c.passed)

    def test_pos_mismatch_deducts_score(self):
        # Buyer GSTIN from state 29 (Karnataka) but POS says 27 (Maharashtra)
        result = self._perfect_invoice(
            buyer_gstin="29AABCU9603R1ZX",
            place_of_supply_state_code="27",
        )
        assert result.score < 100
        assert any("SMRITI-GST-HEALTH-005" in c.error_code for c in result.checks if not c.passed)

    def test_rcm_flag_mismatch_deducts_score(self):
        result = self._perfect_invoice(
            reverse_charge_applicable=True,
            reverse_charge_flag_set=False,
        )
        assert result.score < 100
        assert any("SMRITI-GST-HEALTH-006" in c.error_code for c in result.checks if not c.passed)

    def test_roundoff_excess_deducts_score(self):
        result = self._perfect_invoice(
            invoice_total_declared=Decimal("11802.00"),
            sum_of_line_items=Decimal("11800.00"),
        )
        assert result.score < 100
        assert any("SMRITI-GST-HEALTH-007" in c.error_code for c in result.checks if not c.passed)

    def test_recommendations_generated_on_failure(self):
        result = self._perfect_invoice(supplier_gstin="BADGSTIN")
        assert len(result.recommendations) > 0
        assert len(result.issues) > 0

    def test_multiple_failures_compound_score_reduction(self):
        result = self._perfect_invoice(
            supplier_gstin="BADGSTIN",
            hsn_code="",
            declared_tax_rate_percent=Decimal("15"),
        )
        assert result.score <= 55  # 3 checks failed: 20 + 20 + 15 = 55 deducted
        assert result.fail_count >= 3
