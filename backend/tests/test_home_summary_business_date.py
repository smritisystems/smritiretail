from datetime import date, datetime, timezone

from app.api.v1.analytics import retail_business_date


def test_home_summary_business_date_changes_at_kolkata_midnight():
    before_midnight_ist = datetime(2026, 11, 24, 18, 29, tzinfo=timezone.utc)
    at_midnight_ist = datetime(2026, 11, 24, 18, 30, tzinfo=timezone.utc)

    assert retail_business_date(before_midnight_ist) == date(2026, 11, 24)
    assert retail_business_date(at_midnight_ist) == date(2026, 11, 25)
