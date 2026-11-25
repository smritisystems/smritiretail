import pytest

from app.db import session
from app.db.session import validate_company_database_name


@pytest.mark.parametrize(
    "database_name, expected",
    [
        ("smriti001", True),
        ("smritiABC", True),
        ("smritiSYS1", True),
        ("smritisys", False),
        ("postgres", False),
        ("smriti_001", False),
    ],
)
def test_company_database_name_never_accepts_control_plane(database_name, expected):
    assert validate_company_database_name(database_name) is expected


@pytest.mark.parametrize(
    "requested, expected",
    [
        ("smriti001", "smriti_test_001"),
        ("smriti002", "smriti_test_002"),
        ("smriti_test_001", "smriti_test_001"),
        ("smriti000", "smriti000"),
    ],
)
def test_legacy_tenant_names_route_to_isolated_test_databases(monkeypatch, requested, expected):
    monkeypatch.setattr(session, "_is_testing", lambda: True)
    assert session._normalize_company_database_name(requested) == expected


def test_legacy_tenant_names_are_unchanged_outside_tests(monkeypatch):
    monkeypatch.setattr(session, "_is_testing", lambda: False)
    assert session._normalize_company_database_name("smriti001") == "smriti001"
