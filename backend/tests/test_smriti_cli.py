#  Project      : SMRITI Retail OS
#  Author       : Jawahar Ramkripal Mallah
#  Designation  : Chief Systems Architect & Creator
#  Email        : support@smritibooks.com
#  Websites     : smritibooks.com | erpnbook.com | aitdl.com
#  Version      : 6.99.0
#  Created      : 2026-10-17
#  Modified     : 2026-10-17
#  Copyright    : © SMRITIBooks.com. All Rights Reserved.
#  License      : Proprietary Commercial Software
#  Classification: Unified SMRITI CLI Engine Test Suite

import io
import json
import os
import sys
from pathlib import Path
from unittest.mock import patch

import pytest

# Ensure backend root is in sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.cli.main import build_parser, main
from app.cli.utils import confirm_action, output_result


class TestSMRITICLIParser:
    """Verifies CLI argument parsing, subparser hierarchy, and help output."""

    def test_parser_subcommands_registered(self):
        parser = build_parser()
        subparsers_action = next(
            (act for act in parser._actions if act.dest == "subcommand"),
            None
        )
        assert subparsers_action is not None
        expected_subcommands = {"version", "health", "fleet", "db", "governance", "attendance"}
        assert expected_subcommands.issubset(set(subparsers_action.choices.keys()))

    def test_cli_version_flag(self, capsys):
        parser = build_parser()
        with pytest.raises(SystemExit) as exc:
            parser.parse_args(["--version"])
        assert exc.value.code == 0
        captured = capsys.readouterr()
        assert "6.99.0" in captured.out

    def test_cli_no_args_shows_help(self, capsys):
        code = main([])
        assert code == 0
        captured = capsys.readouterr()
        assert "SMRITI Retail OS" in captured.out
        assert "Operational Subcommands:" in captured.out


class TestVersionCommand:
    """Verifies version SSOT validation command and output formats."""

    def test_version_text_output(self, capsys):
        code = main(["version"])
        assert code == 0
        captured = capsys.readouterr()
        assert "Version SSOT Verification" in captured.out
        assert "PASS" in captured.out
        assert "6.99.0" in captured.out

    def test_version_json_output(self, capsys):
        code = main(["version", "--json"])
        assert code == 0
        captured = capsys.readouterr()
        payload = json.loads(captured.out)
        assert payload["status"] == "PASS"
        assert payload["canonical_version"] == "6.99.0"
        assert payload["is_synchronized"] is True
        assert "components" in payload
        assert payload["components"]["package_json"] == "6.99.0"
        assert payload["components"]["backend_config_py"] == "6.99.0"


class TestHealthCommand:
    """Verifies service health audit probes across database and local endpoints."""

    def test_health_text_output(self, capsys):
        code = main(["health"])
        assert code == 0
        captured = capsys.readouterr()
        assert "Service Health Audit" in captured.out
        assert "PostgreSQL" in captured.out

    def test_health_json_output(self, capsys):
        code = main(["health", "--json"])
        assert code == 0
        captured = capsys.readouterr()
        payload = json.loads(captured.out)
        assert "overall_status" in payload
        assert "checks" in payload
        assert "database" in payload["checks"]
        assert payload["checks"]["database"]["status"] == "PASS"


class TestDBCommand:
    """Verifies control plane guard and database statistics commands."""

    def test_db_guard_text_output(self, capsys):
        code = main(["db", "guard"])
        assert code == 0
        captured = capsys.readouterr()
        assert "SMRITI Control Plane Isolation Guard" in captured.out
        assert "smritisys" in captured.out

    def test_db_guard_json_output(self, capsys):
        code = main(["db", "guard", "--json"])
        assert code == 0
        captured = capsys.readouterr()
        payload = json.loads(captured.out)
        assert payload["database"] == "smritisys"
        assert payload["status"] == "PASS"
        assert isinstance(payload["undeclared_tables"], list)
        assert len(payload["undeclared_tables"]) == 0

    def test_db_stats_json_output(self, capsys):
        code = main(["db", "stats", "--db", "smritisys", "--json"])
        assert code == 0
        captured = capsys.readouterr()
        payload = json.loads(captured.out)
        assert payload["status"] == "PASS"
        assert payload["database"] == "smritisys"
        assert payload["total_public_tables"] > 0
        assert isinstance(payload["top_tables_by_rows"], list)


class TestFleetCommand:
    """Verifies fleet migration orchestration, dry-runs, and confirmation safety."""

    def test_fleet_dry_run_text_output(self, capsys):
        code = main(["fleet", "--dry-run"])
        assert code == 0
        captured = capsys.readouterr()
        assert "Company ID" in captured.out
        assert "smriti001" in captured.out
        assert "SKIPPED_DRY_RUN" in captured.out

    def test_fleet_dry_run_json_output(self, capsys):
        code = main(["fleet", "--dry-run", "--json"])
        assert code == 0
        captured = capsys.readouterr()
        payload = json.loads(captured.out)
        assert payload["status"] == "PASS"
        assert payload["dry_run"] is True
        assert payload["total_targets"] > 0
        assert len(payload["results"]) > 0

    def test_fleet_live_confirmation_declined(self, monkeypatch):
        # When live execution is requested without --yes, declining prompt should abort with code 1
        monkeypatch.setattr("builtins.input", lambda _: "n")
        code = main(["fleet", "--fleet"])
        assert code == 1

    def test_confirm_action_utility(self, monkeypatch):
        assert confirm_action("Test prompt", force=True) is True

        # Non-interactive TTY refusal
        monkeypatch.setattr(sys.stdin, "isatty", lambda: False)
        assert confirm_action("Test prompt", force=False) is False

        # Interactive TTY confirmation
        monkeypatch.setattr(sys.stdin, "isatty", lambda: True)
        monkeypatch.setattr("builtins.input", lambda _: "yes")
        assert confirm_action("Test prompt", force=False) is True

        monkeypatch.setattr("builtins.input", lambda _: "no")
        assert confirm_action("Test prompt", force=False) is False


class TestGovernanceCommand:
    """Verifies tenant boundary and UX field governance execution."""

    def test_governance_check_text_output(self, capsys):
        code = main(["governance", "check"])
        assert code == 0
        captured = capsys.readouterr()
        assert "Architecture & CI Governance Suite" in captured.out
        assert "PASS" in captured.out

    def test_governance_check_json_output(self, capsys):
        code = main(["governance", "check", "--json"])
        assert code == 0
        captured = capsys.readouterr()
        payload = json.loads(captured.out)
        assert payload["overall_status"] == "PASS"
        assert payload["guards"]["tenant_boundary"] == "PASS"
        assert payload["guards"]["ux_field_governance"] == "PASS"
