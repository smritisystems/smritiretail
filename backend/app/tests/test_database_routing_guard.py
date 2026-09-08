import pytest

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