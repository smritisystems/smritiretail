"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 4.13.0
Created      : 2026-07-20
Modified     : 2026-07-20
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

"""
Test Suite: v4.13.0 Indian Compliance Intelligence Suite

Covers:
1. Compliance Rate Registry (versioned, config-driven rates)
2. GSTR-2B Reconciliation Engine
3. GST Interest & Late Fee Calculator
4. MSME Payment Compliance Engine
5. GS1 Barcode Parser
"""

import pytest
from datetime import date
from decimal import Decimal

from app.core.compliance_rate_registry import (
    ComplianceRateRegistry, get_compliance_registry
)
from app.services.gstr2b_reconciliation import (
    reconcile_gstr2b, BookInvoice, GSTR2BInvoice,
    ITCStatus, IneligibleITCReason
)
from app.core.gst_interest_calculator import (
    calculate_gst_late_interest, calculate_gst_late_fee
)
from app.core.msme_compliance import check_msme_payment_compliance
from app.core.gs1_barcode_parser import parse_gs1_barcode, _validate_gtin_check_digit
from app.services.indian_gst_reports import (
    compile_hsn_sac_summary, evaluate_eway_bill_readiness, evaluate_einvoice_readiness
)


# ===========================================================================
# 1. Compliance Rate Registry Tests
# ===========================================================================

class TestComplianceRateRegistry:

    def test_registry_singleton_returns_same_instance(self):
        r1 = get_compliance_registry()
        r2 = get_compliance_registry()
        assert r1 is r2

    def test_tcs_rate_fy2025(self):
        reg = ComplianceRateRegistry()
        rate = reg.get_value("TCS_RATE", date(2026, 1, 1))
        assert rate == Decimal("0.001")

    def test_tds_rate_fy2025(self):
        reg = ComplianceRateRegistry()
        rate = reg.get_value("TDS_RATE", date(2026, 1, 1))
        assert rate == Decimal("0.001")

    def test_tcs_turnover_threshold(self):
        reg = ComplianceRateRegistry()
        threshold = reg.get_value("TCS_TURNOVER_THRESHOLD", date(2026, 1, 1))
        assert threshold == Decimal("10_00_00_000")

    def test_tds_purchase_threshold(self):
        reg = ComplianceRateRegistry()
        threshold = reg.get_value("TDS_PURCHASE_THRESHOLD", date(2026, 1, 1))
        assert threshold == Decimal("50_00_000")

    def test_gst_valid_slabs_contains_standard_rates(self):
        reg = ComplianceRateRegistry()
        slabs = reg.get_all_gst_slabs(date(2026, 1, 1))
        for expected_rate in [Decimal("0"), Decimal("5"), Decimal("12"), Decimal("18"), Decimal("28")]:
            assert expected_rate in slabs

    def test_gst_late_interest_normal_18pct(self):
        reg = ComplianceRateRegistry()
        rate = reg.get_value("GST_LATE_INTEREST_NORMAL", date(2026, 1, 1))
        assert rate == Decimal("18")

    def test_gst_late_interest_fraud_24pct(self):
        reg = ComplianceRateRegistry()
        rate = reg.get_value("GST_LATE_INTEREST_ITC_FRAUD", date(2026, 1, 1))
        assert rate == Decimal("24")

    def test_gst_late_fee_daily_non_nil(self):
        reg = ComplianceRateRegistry()
        fee = reg.get_value("GST_LATE_FEE_DAILY", date(2026, 1, 1))
        assert fee == Decimal("50")

    def test_gst_late_fee_daily_nil(self):
        reg = ComplianceRateRegistry()
        fee = reg.get_value("GST_LATE_FEE_NIL_DAILY", date(2026, 1, 1))
        assert fee == Decimal("20")

    def test_upi_max_txn_limit(self):
        reg = ComplianceRateRegistry()
        limit = reg.get_value("UPI_MAX_TXN_LIMIT", date(2026, 1, 1))
        assert limit == Decimal("1_00_000")

    def test_msme_payment_days_with_agreement(self):
        reg = ComplianceRateRegistry()
        days = reg.get_value("MSME_PAYMENT_DAYS_WITH_AGREEMENT", date(2026, 1, 1))
        assert days == Decimal("45")

    def test_msme_payment_days_without_agreement(self):
        reg = ComplianceRateRegistry()
        days = reg.get_value("MSME_PAYMENT_DAYS_WITHOUT_AGREEMENT", date(2026, 1, 1))
        assert days == Decimal("15")

    def test_get_rate_returns_latest_effective_entry(self):
        reg = ComplianceRateRegistry()
        entry = reg.get_rate("TCS_RATE", date(2026, 7, 1))
        assert entry is not None
        assert entry.fy_label == "FY2020+"
        assert entry.unit == "percent"

    def test_get_value_raises_for_unknown_rule(self):
        reg = ComplianceRateRegistry()
        with pytest.raises(KeyError, match="NONEXISTENT_RULE"):
            reg.get_value("NONEXISTENT_RULE", date(2026, 1, 1))

    def test_get_value_returns_default_for_unknown_rule(self):
        reg = ComplianceRateRegistry()
        val = reg.get_value("NONEXISTENT_RULE", date(2026, 1, 1), default=Decimal("99"))
        assert val == Decimal("99")

    def test_list_rules_returns_all_known_types(self):
        reg = ComplianceRateRegistry()
        rules = reg.list_rules()
        for expected in ["TCS_RATE", "TDS_RATE", "GST_SLAB", "MSME_PAYMENT_DAYS_WITH_AGREEMENT"]:
            assert expected in rules

    def test_get_history_returns_sorted_entries(self):
        reg = ComplianceRateRegistry()
        history = reg.get_history("TCS_RATE")
        assert len(history) >= 1
        dates = [e.effective_date for e in history]
        assert dates == sorted(dates)


# ===========================================================================
# 2. GSTR-2B Reconciliation Engine Tests
# ===========================================================================

class TestGSTR2BReconciliation:

    def _make_book(self, inv_no: str, gstin: str = "27ABCDE1234F1Z5",
                   itc: str = "1800.00", ineligible=None) -> BookInvoice:
        return BookInvoice(
            invoice_number=inv_no,
            supplier_gstin=gstin,
            invoice_date="2026-06-15",
            taxable_value=Decimal("10000"),
            igst=Decimal("1800"),
            cgst=Decimal("0"),
            sgst=Decimal("0"),
            itc_claimed=Decimal(itc),
            ineligible_reason=ineligible,
        )

    def _make_g2b(self, inv_no: str, gstin: str = "27ABCDE1234F1Z5",
                  itc: str = "1800.00") -> GSTR2BInvoice:
        return GSTR2BInvoice(
            invoice_number=inv_no,
            supplier_gstin=gstin,
            invoice_date="2026-06-15",
            taxable_value=Decimal("10000"),
            igst=Decimal("1800"),
            cgst=Decimal("0"),
            sgst=Decimal("0"),
            itc_available=Decimal(itc),
        )

    def test_perfect_match_single_invoice(self):
        books = [self._make_book("INV-001")]
        g2b = [self._make_g2b("INV-001")]
        report = reconcile_gstr2b("tenant-1", "2026-06", books, g2b)
        assert report.matched == 1
        assert report.books_only == 0
        assert report.itc_mismatch == 0
        assert report.items[0].status == ITCStatus.MATCHED

    def test_invoice_missing_from_gstr2b(self):
        books = [self._make_book("INV-002")]
        report = reconcile_gstr2b("tenant-1", "2026-06", books, [])
        assert report.books_only == 1
        assert report.items[0].status == ITCStatus.BOOKS_ONLY
        assert report.items[0].error_code == "SMRITI-GSTR2B-001"
        assert "follow up with supplier" in report.items[0].actionable_message.lower()

    def test_invoice_missing_from_books(self):
        g2b = [self._make_g2b("INV-003")]
        report = reconcile_gstr2b("tenant-1", "2026-06", [], g2b)
        assert report.gstr2b_only == 1
        assert report.items[0].status == ITCStatus.GSTR2B_ONLY
        assert report.items[0].error_code == "SMRITI-GSTR2B-002"

    def test_itc_amount_mismatch(self):
        books = [self._make_book("INV-004", itc="1800.00")]
        g2b = [self._make_g2b("INV-004", itc="1750.00")]
        report = reconcile_gstr2b("tenant-1", "2026-06", books, g2b)
        assert report.itc_mismatch == 1
        assert report.items[0].status == ITCStatus.ITC_MISMATCH
        assert report.items[0].error_code == "SMRITI-GSTR2B-003"
        assert report.items[0].difference == Decimal("-50.00")

    def test_gstin_mismatch(self):
        books = [self._make_book("INV-005", gstin="27ABCDE1234F1Z5")]
        g2b = [self._make_g2b("INV-005", gstin="29XYZPQ9876G1Z3")]
        report = reconcile_gstr2b("tenant-1", "2026-06", books, g2b)
        assert report.gstin_mismatch == 1
        assert report.items[0].status == ITCStatus.GSTIN_MISMATCH
        assert report.items[0].error_code == "SMRITI-GSTR2B-004"

    def test_ineligible_itc_section_17_5(self):
        books = [self._make_book("INV-006", ineligible=IneligibleITCReason.FOOD_BEVERAGE)]
        g2b = [self._make_g2b("INV-006")]
        report = reconcile_gstr2b("tenant-1", "2026-06", books, g2b)
        assert report.ineligible == 1
        assert report.items[0].status == ITCStatus.INELIGIBLE
        assert report.items[0].error_code == "SMRITI-GSTR2B-005"
        assert report.items[0].is_ineligible is True

    def test_rounding_tolerance_within_1_rupee_passes(self):
        books = [self._make_book("INV-007", itc="1800.00")]
        g2b = [self._make_g2b("INV-007", itc="1800.50")]  # 50p diff — within Rs 1
        report = reconcile_gstr2b("tenant-1", "2026-06", books, g2b)
        assert report.matched == 1

    def test_mixed_reconciliation_report_summary(self):
        books = [
            self._make_book("INV-010"),
            self._make_book("INV-011"),
            self._make_book("INV-012"),
        ]
        g2b = [
            self._make_g2b("INV-010"),
            self._make_g2b("INV-013"),  # Only in G2B
        ]
        report = reconcile_gstr2b("tenant-1", "2026-06", books, g2b)
        assert report.matched == 1
        assert report.books_only == 2   # INV-011, INV-012
        assert report.gstr2b_only == 1  # INV-013
        assert "issue" in report.summary_message.lower()

    def test_invoice_number_normalized_case_insensitive(self):
        books = [self._make_book("INV/2026/001")]
        g2b = [self._make_g2b("inv-2026-001")]  # normalized to same key
        report = reconcile_gstr2b("tenant-1", "2026-06", books, g2b)
        assert report.matched == 1

    def test_total_itc_calculation(self):
        books = [self._make_book("INV-020"), self._make_book("INV-021")]
        g2b = [self._make_g2b("INV-020"), self._make_g2b("INV-021")]
        report = reconcile_gstr2b("tenant-1", "2026-06", books, g2b)
        assert report.total_itc_claimed == Decimal("3600.00")
        assert report.total_itc_available == Decimal("3600.00")
        assert report.itc_net_difference == Decimal("0")


# ===========================================================================
# 3. GST Interest & Late Fee Calculator Tests
# ===========================================================================

class TestGSTInterestCalculator:

    def test_no_delay_zero_interest(self):
        result = calculate_gst_late_interest(
            tax_liability=Decimal("50000"),
            due_date=date(2026, 4, 20),
            payment_date=date(2026, 4, 18),
        )
        assert result.interest_amount == Decimal("0")
        assert result.days_delayed == 0

    def test_normal_delay_18pct_interest(self):
        result = calculate_gst_late_interest(
            tax_liability=Decimal("100000"),
            due_date=date(2026, 3, 20),
            payment_date=date(2026, 4, 20),
            as_of_date=date(2026, 4, 20),
        )
        assert result.days_delayed == 31
        assert result.annual_rate_percent == Decimal("18")
        # 100000 * 18% * 31/365 = 1528.77
        assert result.interest_amount > Decimal("0")
        assert "31 days" in result.calculation_note

    def test_itc_fraud_24pct_interest(self):
        result = calculate_gst_late_interest(
            tax_liability=Decimal("100000"),
            due_date=date(2026, 3, 20),
            payment_date=date(2026, 4, 20),
            is_itc_fraud=True,
            as_of_date=date(2026, 4, 20),
        )
        assert result.annual_rate_percent == Decimal("24")
        assert result.section_reference == "CGST Act Section 50(3)"
        assert result.interest_amount > Decimal("0")

    def test_fraud_interest_higher_than_normal(self):
        kwargs = dict(
            tax_liability=Decimal("100000"),
            due_date=date(2026, 3, 20),
            payment_date=date(2026, 4, 20),
            as_of_date=date(2026, 4, 20),
        )
        normal = calculate_gst_late_interest(**kwargs, is_itc_fraud=False)
        fraud = calculate_gst_late_interest(**kwargs, is_itc_fraud=True)
        assert fraud.interest_amount > normal.interest_amount

    def test_no_late_fee_for_on_time_filing(self):
        result = calculate_gst_late_fee(
            due_date=date(2026, 4, 11),
            filing_date=date(2026, 4, 11),
        )
        assert result.final_fee == Decimal("0")
        assert result.days_delayed == 0

    def test_late_fee_non_nil_return(self):
        result = calculate_gst_late_fee(
            due_date=date(2026, 3, 11),
            filing_date=date(2026, 4, 10),
            is_nil_return=False,
            as_of_date=date(2026, 4, 10),
        )
        assert result.days_delayed == 30
        assert result.daily_fee == Decimal("50")
        assert result.gross_fee == Decimal("1500")
        assert result.cgst_portion + result.sgst_portion == result.final_fee

    def test_late_fee_nil_return(self):
        result = calculate_gst_late_fee(
            due_date=date(2026, 3, 11),
            filing_date=date(2026, 4, 10),
            is_nil_return=True,
            as_of_date=date(2026, 4, 10),
        )
        assert result.daily_fee == Decimal("20")
        assert result.gross_fee == Decimal("600")

    def test_late_fee_capped_at_max(self):
        result = calculate_gst_late_fee(
            due_date=date(2025, 1, 11),
            filing_date=date(2026, 4, 10),  # ~450 days late
            is_nil_return=False,
            as_of_date=date(2026, 4, 10),
        )
        assert result.final_fee == Decimal("10000")  # Capped at Rs 10,000
        assert result.gross_fee > Decimal("10000")

    def test_late_fee_cgst_sgst_split_equal(self):
        result = calculate_gst_late_fee(
            due_date=date(2026, 3, 11),
            filing_date=date(2026, 3, 21),  # 10 days late
            is_nil_return=False,
            as_of_date=date(2026, 3, 21),
        )
        assert result.gross_fee == Decimal("500")
        assert result.cgst_portion == Decimal("250")
        assert result.sgst_portion == Decimal("250")


# ===========================================================================
# 4. MSME Payment Compliance Tests
# ===========================================================================

class TestMSMECompliance:

    def test_payment_within_45_days_no_overdue(self):
        result = check_msme_payment_compliance(
            invoice_number="PO-001",
            supplier_name="Sharma Textiles",
            supplier_msme_registration="UDYAM-MH-12-0001234",
            invoice_date=date(2026, 5, 1),
            invoice_amount=Decimal("500000"),
            payment_date=date(2026, 6, 10),  # 40 days later
            has_written_agreement=True,
        )
        assert result.is_overdue is False
        assert result.days_overdue == 0
        assert result.interest_amount == Decimal("0")

    def test_payment_overdue_with_agreement_45_days(self):
        result = check_msme_payment_compliance(
            invoice_number="PO-002",
            supplier_name="Patel Fabrics",
            supplier_msme_registration="UDYAM-GJ-05-0009876",
            invoice_date=date(2026, 4, 1),
            invoice_amount=Decimal("200000"),
            payment_date=date(2026, 6, 1),  # 61 days — 16 days overdue
            has_written_agreement=True,
        )
        assert result.is_overdue is True
        assert result.days_overdue == 16
        assert result.interest_amount > Decimal("0")
        assert "SMRITI-MSME-003" in result.error_code
        assert "samadhaan" in result.samadhaan_reference_note.lower()

    def test_no_agreement_15_day_limit(self):
        result = check_msme_payment_compliance(
            invoice_number="PO-003",
            supplier_name="Kumar Exports",
            supplier_msme_registration="UDYAM-TN-33-0005678",
            invoice_date=date(2026, 6, 1),
            invoice_amount=Decimal("100000"),
            payment_date=date(2026, 6, 20),  # 19 days — 4 days overdue
            has_written_agreement=False,
        )
        assert result.is_overdue is True
        assert result.days_overdue == 4
        assert result.payment_due_date == date(2026, 6, 16)

    def test_unpaid_invoice_overdue_as_of_today(self):
        result = check_msme_payment_compliance(
            invoice_number="PO-004",
            supplier_name="Gupta Plastics",
            supplier_msme_registration="UDYAM-UP-09-0001111",
            invoice_date=date(2026, 1, 1),
            invoice_amount=Decimal("300000"),
            payment_date=None,  # Not yet paid
            has_written_agreement=True,
            as_of_date=date(2026, 7, 20),
        )
        assert result.is_overdue is True
        assert result.days_overdue > 0
        assert result.interest_amount > Decimal("0")

    def test_interest_uses_3x_rbi_rate(self):
        result = check_msme_payment_compliance(
            invoice_number="PO-005",
            supplier_name="Test Supplier",
            supplier_msme_registration="UDYAM-MH-27-0000001",
            invoice_date=date(2026, 4, 1),
            invoice_amount=Decimal("1000000"),
            payment_date=date(2026, 7, 1),  # 91 days — 46 days overdue
            has_written_agreement=True,
            rbi_bank_rate_percent=Decimal("6.5"),
        )
        assert result.annual_interest_rate_percent == Decimal("19.5")  # 3 * 6.5


# ===========================================================================
# 5. GS1 Barcode Parser Tests
# ===========================================================================

class TestGS1BarcodeParser:

    def test_parse_bracket_format_gtin_and_expiry(self):
        barcode = "(01)08901234567894(17)261231(10)LOT2026A"
        result = parse_gs1_barcode(barcode)
        assert result.gtin == "08901234567894"
        assert result.expiry_date == date(2026, 12, 31)
        assert result.batch_number == "LOT2026A"

    def test_parse_bracket_format_gtin_only(self):
        barcode = "(01)08901234567894"
        result = parse_gs1_barcode(barcode)
        assert result.gtin == "08901234567894"
        assert result.expiry_date is None
        assert result.batch_number is None

    def test_parse_bracket_format_with_serial(self):
        barcode = "(01)08901234567894(21)SN12345678"
        result = parse_gs1_barcode(barcode)
        assert result.serial_number == "SN12345678"

    def test_expiry_date_last_day_of_month_day_zero(self):
        # AI-17 with DD=00 means last day of the month
        barcode = "(17)260200"  # Feb 2026, day 00 = last day of Feb = Feb 28
        result = parse_gs1_barcode(barcode)
        assert result.expiry_date == date(2026, 2, 28)

    def test_is_expired_flag_past_date(self):
        barcode = "(17)200101"  # Jan 2020 — clearly expired
        result = parse_gs1_barcode(barcode)
        assert result.is_expired is True

    def test_is_not_expired_future_date(self):
        barcode = "(17)351231"  # Dec 2035
        result = parse_gs1_barcode(barcode)
        assert result.is_expired is False

    def test_days_to_expiry_positive_for_future(self):
        barcode = "(17)351231"
        result = parse_gs1_barcode(barcode)
        assert result.days_to_expiry > 0

    def test_days_to_expiry_negative_for_past(self):
        barcode = "(17)200101"
        result = parse_gs1_barcode(barcode)
        assert result.days_to_expiry < 0

    def test_gtin_check_digit_valid(self):
        # EAN-13: 8901234567890 — last digit is check digit (0)
        assert _validate_gtin_check_digit("8901234567890") is True

    def test_gtin_check_digit_invalid(self):
        # EAN-13: 8901234567894 — check digit should be 0, not 4
        assert _validate_gtin_check_digit("8901234567894") is False

    def test_parse_production_date(self):
        barcode = "(11)260101(01)08901234567894"
        result = parse_gs1_barcode(barcode)
        assert result.production_date == date(2026, 1, 1)

    def test_parse_best_before_date(self):
        barcode = "(15)270630(01)08901234567894"
        result = parse_gs1_barcode(barcode)
        assert result.best_before_date == date(2027, 6, 30)

    def test_parse_multiple_ais_complete_product(self):
        barcode = "(01)08901234567894(10)BATCH001(17)270630(21)SERIAL99"
        result = parse_gs1_barcode(barcode)
        assert result.gtin == "08901234567894"
        assert result.batch_number == "BATCH001"
        assert result.expiry_date == date(2027, 6, 30)
        assert result.serial_number == "SERIAL99"

    def test_parse_fnc1_separated_barcode(self):
        # FNC1 delimiter as ASCII GS (\x1d)
        barcode = "\x1d01\x1d08901234567894\x1d17261231"
        result = parse_gs1_barcode(barcode)
        # Should not crash; may partially parse depending on FNC1 handling
        assert result is not None

    def test_empty_barcode_returns_result_object(self):
        result = parse_gs1_barcode("")
        assert result is not None
        assert result.gtin is None


# ===========================================================================
# 6. Indian GST Report Engines Tests
# ===========================================================================

class TestIndianGSTReportEngines:

    def test_compile_hsn_sac_summary_empty(self):
        result = compile_hsn_sac_summary([])
        assert len(result) == 0

    def test_compile_hsn_sac_summary_grouped(self):
        items = [
            {
                "hsn_code": "6403",
                "description": "Leather shoes",
                "uom": "NOS",
                "quantity": Decimal("10"),
                "taxable_value": Decimal("10000"),
                "igst": Decimal("1800"),
                "cgst": Decimal("0"),
                "sgst": Decimal("0"),
                "cess": Decimal("0")
            },
            {
                "hsn_code": "6403",
                "description": "Leather shoes",
                "uom": "NOS",
                "quantity": Decimal("5"),
                "taxable_value": Decimal("5000"),
                "igst": Decimal("900"),
                "cgst": Decimal("0"),
                "sgst": Decimal("0"),
                "cess": Decimal("0")
            },
            {
                "hsn_code": "9954",
                "description": "Works Contract Service",
                "uom": "OTH",
                "quantity": Decimal("1"),
                "taxable_value": Decimal("20000"),
                "igst": Decimal("0"),
                "cgst": Decimal("1800"),
                "sgst": Decimal("1800"),
                "cess": Decimal("0")
            }
        ]
        summary = compile_hsn_sac_summary(items)
        assert len(summary) == 2
        assert "6403_NOS" in summary
        assert "9954_OTH" in summary
        
        shoes = summary["6403_NOS"]
        assert shoes.total_quantity == Decimal("15")
        assert shoes.taxable_value == Decimal("15000")
        assert shoes.igst_amount == Decimal("2700")
        
        services = summary["9954_OTH"]
        assert services.total_quantity == Decimal("1")
        assert services.cgst_amount == Decimal("1800")
        assert services.sgst_amount == Decimal("1800")

    def test_eway_bill_readiness_optional_below_limit(self):
        result = evaluate_eway_bill_readiness(
            invoice_amount=Decimal("45000.00"),
            is_interstate=True,
            from_pincode="400001",
            to_pincode="560001",
            transporter_id="29ABCDE1234F1Z5",
            vehicle_number="KA-01-AB-1234",
            distance_km=650,
            mode_of_transport="ROAD"
        )
        assert result.is_ready is True
        assert result.score == 100
        assert len(result.warnings) > 0

    def test_eway_bill_readiness_mandatory_missing_vehicle_and_transporter(self):
        result = evaluate_eway_bill_readiness(
            invoice_amount=Decimal("75000.00"),
            is_interstate=True,
            from_pincode="400001",
            to_pincode="560001",
            transporter_id=None,
            vehicle_number=None,
            distance_km=650,
            mode_of_transport="ROAD"
        )
        assert result.is_ready is False
        assert "Vehicle Number or Transporter ID (GSTIN/transporter code)" in result.missing_fields
        assert result.score < 100

    def test_einvoice_readiness_b2b_complete(self):
        result = evaluate_einvoice_readiness(
            buyer_gstin="29ABCDE1234F1Z5",
            supplier_gstin="27XYZPQ9876G1Z3",
            invoice_date="2026-07-20",
            hsn_codes=["6403", "9954"],
            is_b2b=True,
            total_amount=Decimal("120000.00")
        )
        assert result.is_ready is True
        assert result.score == 100

    def test_einvoice_readiness_b2b_missing_buyer_gstin(self):
        result = evaluate_einvoice_readiness(
            buyer_gstin=None,
            supplier_gstin="27XYZPQ9876G1Z3",
            invoice_date="2026-07-20",
            hsn_codes=["6403"],
            is_b2b=True,
            total_amount=Decimal("120000.00")
        )
        assert result.is_ready is False
        assert "Buyer GSTIN (mandatory for B2B E-Invoice)" in result.missing_fields
        assert result.score < 100

