from datetime import date

from app.schemas.system import BusinessInfo, NumberingSeriesConfig, current_financial_year_defaults


def test_financial_year_defaults_follow_april_start_boundary():
    assert current_financial_year_defaults(date(2027, 3, 31)) == ("2026-2027", "2026-04-01")
    assert current_financial_year_defaults(date(2027, 4, 1)) == ("2027-2028", "2027-04-01")


def test_business_info_defaults_and_nulls_use_current_financial_year():
    expected_year, expected_start_date = current_financial_year_defaults()

    default_business = BusinessInfo(name="Example Shop")
    null_business = BusinessInfo(name="Example Shop", financialYear=None, booksStartDate=None)

    assert (default_business.financialYear, default_business.booksStartDate) == (expected_year, expected_start_date)
    assert (null_business.financialYear, null_business.booksStartDate) == (expected_year, expected_start_date)


def test_numbering_series_uses_current_financial_year_by_default():
    expected_year, _ = current_financial_year_defaults()
    series = NumberingSeriesConfig(name="Invoice", documentType="Sales Invoice")

    assert series.financialYear == expected_year
