from types import SimpleNamespace

from scripts.migrate_legacy_catalog import MigrationReport, add_conflict, barcode_values, normalize


def test_normalize_canonicalizes_case_and_whitespace():
    assert normalize("  ch-01-a   cream  ") == "CH-01-A CREAM"
    assert normalize(None) == ""


def test_barcode_values_deduplicates_primary_and_secondary_values():
    product = SimpleNamespace(
        barcode=" 8901234567890 ",
        secondary_barcodes=["8901234567890", " 8901234567891 ", None],
    )
    assert barcode_values(product) == ["8901234567890", "8901234567891"]


def test_report_is_blocked_when_conflicts_exist():
    report = MigrationReport(database="smriti001", company_id="001")
    add_conflict(report, "BARCODE_COLLISION", "duplicate", ["p1", "p2"])
    assert report.ready is False
    assert report.conflicts[0].kind == "BARCODE_COLLISION"
