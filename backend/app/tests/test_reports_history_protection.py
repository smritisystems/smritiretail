import json
import subprocess
from pathlib import Path

from app.dev_tracker.reports import write_reports


def test_python_reporter_does_not_overwrite_canonical_files(tmp_path):
    root = Path(__file__).resolve().parents[3]
    raw_path = root / "docs" / "reports" / "latest_raw_scan.json"
    if not raw_path.exists():
        subprocess.run(["node", str(root / "scripts" / "run_scanner.mjs")], check=True)
    assert raw_path.exists(), "latest_raw_scan.json must exist for this test"

    # read raw
    raw = json.loads(raw_path.read_text(encoding="utf8"))

    # backup canonical files bytes
    dev_path = root / "DEVELOPMENT_STATUS.md"
    hist_path = root / "docs" / "reports" / "history.json"

    dev_before = dev_path.read_bytes() if dev_path.exists() else None
    hist_before = hist_path.read_bytes() if hist_path.exists() else None

    # run python reporter
    write_reports(raw)

    # After run, canonical files must be unchanged (byte-for-byte)
    if dev_before is not None:
        assert dev_path.exists(), "DEVELOPMENT_STATUS.md deleted by python reporter"
        assert dev_path.read_bytes() == dev_before, "Python reporter must NOT modify DEVELOPMENT_STATUS.md"

    if hist_before is not None:
        assert hist_path.exists(), "history.json deleted by python reporter"
        assert hist_path.read_bytes() == hist_before, "Python reporter must NOT modify docs/reports/history.json"

    # Ensure python-generated output exists
    python_generated = root / "docs" / "reports" / "python-generated"
    assert python_generated.exists(), "python-generated directory must be created"
    assert any(python_generated.rglob('DEVELOPMENT_STATUS.md')), "python-generated DEVELOPMENT_STATUS.md must exist"
