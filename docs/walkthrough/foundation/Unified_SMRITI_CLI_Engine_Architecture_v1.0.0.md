<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.99.0
  Created      : 2026-10-17
  Modified     : 2026-10-17
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal Architecture Walkthrough
-->

# Unified SMRITI CLI Engine Architecture Walkthrough v1.0.0

## 1. Purpose
This walkthrough documents the design, implementation, and verification of the Unified SMRITI CLI Engine (`smriti` / `python -m backend.app.cli`). The CLI consolidates multi-tenant fleet migrations, control plane isolation guards, service health diagnostics, version SSOT validations, CI governance checks, and workforce attendance automation into an auditable, cross-platform command-line dispatcher.

## 2. Scope
- **Unified Dispatcher (`backend/app/cli/`):** Created a standard `argparse` hierarchy with subcommands:
  - `version`: Single Source of Truth 4-point parity verification.
  - `health`: Cross-platform TCP socket and HTTP availability probes with microsecond latency measurements.
  - `fleet`: Controlled multi-tenant Alembic migrations with PostgreSQL session advisory locks.
  - `db`: Control plane isolation guard (`cp_guard.py`) and physical table statistics.
  - `governance`: CI architecture guards for tenant boundary isolation and UX field governance.
  - `attendance`: Biometric IoT and workforce attendance recording.
- **Cross-Platform Parity:** Completely eliminates platform-specific discrepancies between Windows PowerShell (`.ps1`) and Linux shell scripts (`.sh`).
- **Interactive Safety Guard:** Intercepts mutating operations with `confirm_action()` interactive prompts, automatically refusing execution in non-interactive CI environments without explicit `--yes`.
- **Structured Output:** Emits parseable `--json` output across all subcommands for machine consumption.
- **NPM Integration:** Registered `"smriti": "python -m backend.app.cli"` in `package.json`.
- **Test Suite:** Implemented comprehensive unit and integration tests in `backend/tests/test_smriti_cli.py` (16/16 tests passing).

## 3. Files Created
- [`backend/app/cli/__init__.py`](file:///f:/SMRITRretailNX/backend/app/cli/__init__.py) — Package metadata and version definition.
- [`backend/app/cli/__main__.py`](file:///f:/SMRITRretailNX/backend/app/cli/__main__.py) — Direct module entrypoint with automatic `sys.path` bootstrapping.
- [`backend/app/cli/main.py`](file:///f:/SMRITRretailNX/backend/app/cli/main.py) — Root argument parser dispatcher and subcommand router.
- [`backend/app/cli/utils.py`](file:///f:/SMRITRretailNX/backend/app/cli/utils.py) — Shared utilities: `find_repo_root()`, `confirm_action()`, `output_result()`.
- [`backend/app/cli/commands/__init__.py`](file:///f:/SMRITRretailNX/backend/app/cli/commands/__init__.py) — Subcommand package initialization.
- [`backend/app/cli/commands/version_cmd.py`](file:///f:/SMRITRretailNX/backend/app/cli/commands/version_cmd.py) — SSOT version inspection command.
- [`backend/app/cli/commands/health_cmd.py`](file:///f:/SMRITRretailNX/backend/app/cli/commands/health_cmd.py) — Cross-platform socket and HTTP health probe command.
- [`backend/app/cli/commands/fleet_cmd.py`](file:///f:/SMRITRretailNX/backend/app/cli/commands/fleet_cmd.py) — Fleet migration orchestration command.
- [`backend/app/cli/commands/db_cmd.py`](file:///f:/SMRITRretailNX/backend/app/cli/commands/db_cmd.py) — Database guard and topology statistics command.
- [`backend/app/cli/commands/governance_cmd.py`](file:///f:/SMRITRretailNX/backend/app/cli/commands/governance_cmd.py) — CI architecture and UX field governance command.
- [`backend/app/cli/commands/attendance_cmd.py`](file:///f:/SMRITRretailNX/backend/app/cli/commands/attendance_cmd.py) — Biometric and workforce attendance client command.
- [`backend/tests/test_smriti_cli.py`](file:///f:/SMRITRretailNX/backend/tests/test_smriti_cli.py) — Unit and integration test suite (16 tests).
- [`docs/developer_guide/SMRITI_CLI_OPERATOR_GUIDE.md`](file:///f:/SMRITRretailNX/docs/developer_guide/SMRITI_CLI_OPERATOR_GUIDE.md) — Operator reference guide.
- [`docs/walkthrough/foundation/Unified_SMRITI_CLI_Engine_Architecture_v1.0.0.md`](file:///f:/SMRITRretailNX/docs/walkthrough/foundation/Unified_SMRITI_CLI_Engine_Architecture_v1.0.0.md) — This document.

## 4. Files Modified
- [`package.json`](file:///f:/SMRITRretailNX/package.json) — Added `"smriti": "python -m backend.app.cli"` script.
- [`docs/implementation/foundation/Unified_SMRITI_CLI_Engine_Architecture_Plan_v1.0.0.md`](file:///f:/SMRITRretailNX/docs/implementation/foundation/Unified_SMRITI_CLI_Engine_Architecture_Plan_v1.0.0.md) — Transitioned status to Completed.
- [`docs/implementation/README.md`](file:///f:/SMRITRretailNX/docs/implementation/README.md) — Updated master implementation plan index.
- [`docs/walkthrough/README.md`](file:///f:/SMRITRretailNX/docs/walkthrough/README.md) — Appended walkthrough record to master index.
- [`CHANGELOG.md`](file:///f:/SMRITRretailNX/CHANGELOG.md) — Logged unified CLI engine release.
- [`RELEASE_NOTES.md`](file:///f:/SMRITRretailNX/RELEASE_NOTES.md) — Added operator notes for CLI engine.

## 5. Architecture Decisions
- **AD-CLI-01: Consolidation without Duplication:** The CLI wraps existing canonical engines (`FleetMigrator`, `cp_guard.py`, `validate_version_ssot.py`, `ci_tenant_boundary_guard.py`) rather than duplicating domain or migration logic.
- **AD-CLI-02: Universal Python Execution Engine:** Replaced split OS-specific `.ps1` and `.sh` scripts with pure Python probes (`socket.create_connection`, `urllib.request`) ensuring byte-for-byte behavioral parity across platforms.
- **AD-CLI-03: Strict Safety Gate with Non-Interactive Abort:** Any live mutation (`fleet`, destructive resets) requires an interactive TTY confirmation prompt (`confirm_action`). If executed in a headless CI/CD environment without `--yes`, the command immediately aborts with exit code 1 to prevent unauthorized data loss.
- **AD-CLI-04: Structured JSON Output Contract:** Every subcommand supports `--json`, outputting deterministic JSON envelopes to stdout and directing operational logs to stderr.

## 6. Design Rationale
Retail environments often operate diverse POS and server hardware running varied OS platforms (Windows POS counters, Ubuntu back-office servers, Docker containers). By building the CLI engine in pure Python as part of the core backend application, zero external binary dependencies are introduced. The auto-bootstrapping `sys.path` logic in `backend/app/cli/__main__.py` ensures commands execute reliably regardless of whether the user invokes `npm run smriti`, `python -m backend.app.cli`, or runs from deep inside subdirectories.

## 7. Implementation Summary
1. **Dispatcher Hierarchy:** Configured `argparse` with `required=True` subparsers, human-readable help messages, and version reporting.
2. **Database URL Normalization:** `db_cmd.py` parses `settings.DATABASE_URL` via `urllib.parse.urlparse` to dynamically supply host, port, user, and credentials to `psycopg2` connections across all tenant environments.
3. **Fleet Result Formatting:** `fleet_cmd.py` handles dataclass `MigrationResult` lists, mapping dry-run and live results to structured audit tables and JSON envelopes.
4. **Safety Utility:** `utils.confirm_action()` verifies `sys.stdin.isatty()` before prompting; non-interactive sessions require explicit `--yes`.

## 8. Tests Executed
Executed complete test suite in `backend/tests/test_smriti_cli.py`:
- `TestSMRITICLIParser::test_parser_subcommands_registered`: PASSED
- `TestSMRITICLIParser::test_cli_version_flag`: PASSED
- `TestSMRITICLIParser::test_cli_no_args_shows_help`: PASSED
- `TestVersionCommand::test_version_text_output`: PASSED
- `TestVersionCommand::test_version_json_output`: PASSED
- `TestHealthCommand::test_health_text_output`: PASSED
- `TestHealthCommand::test_health_json_output`: PASSED
- `TestDBCommand::test_db_guard_text_output`: PASSED
- `TestDBCommand::test_db_guard_json_output`: PASSED
- `TestDBCommand::test_db_stats_json_output`: PASSED
- `TestFleetCommand::test_fleet_dry_run_text_output`: PASSED
- `TestFleetCommand::test_fleet_dry_run_json_output`: PASSED
- `TestFleetCommand::test_fleet_live_confirmation_declined`: PASSED
- `TestFleetCommand::test_confirm_action_utility`: PASSED
- `TestGovernanceCommand::test_governance_check_text_output`: PASSED
- `TestGovernanceCommand::test_governance_check_json_output`: PASSED

## 9. Verification Results
```text
============================= test session starts =============================
platform win32 -- Python 3.11.9, pytest-8.2.1, pluggy-1.6.0 -- F:\SMRITRretailNX\.venv\Scripts\python.exe
cachedir: .pytest_cache
rootdir: F:\SMRITRretailNX\backend
configfile: pyproject.toml
plugins: anyio-4.15.1, asyncio-0.23.7, cov-5.0.0
asyncio: mode=Mode.AUTO
collecting ... collected 16 items

backend\tests\test_smriti_cli.py::TestSMRITICLIParser::test_parser_subcommands_registered PASSED [  6%]
backend\tests\test_smriti_cli.py::TestSMRITICLIParser::test_cli_version_flag PASSED [ 12%]
backend\tests\test_smriti_cli.py::TestSMRITICLIParser::test_cli_no_args_shows_help PASSED [ 18%]
backend\tests\test_smriti_cli.py::TestVersionCommand::test_version_text_output PASSED [ 25%]
backend\tests\test_smriti_cli.py::TestVersionCommand::test_version_json_output PASSED [ 31%]
backend\tests\test_smriti_cli.py::TestHealthCommand::test_health_text_output PASSED [ 37%]
backend\tests\test_smriti_cli.py::TestHealthCommand::test_health_json_output PASSED [ 43%]
backend\tests\test_smriti_cli.py::TestDBCommand::test_db_guard_text_output PASSED [ 50%]
backend\tests\test_smriti_cli.py::TestDBCommand::test_db_guard_json_output PASSED [ 56%]
backend\tests\test_smriti_cli.py::TestDBCommand::test_db_stats_json_output PASSED [ 62%]
backend\tests\test_smriti_cli.py::TestFleetCommand::test_fleet_dry_run_text_output PASSED [ 68%]
backend\tests\test_smriti_cli.py::TestFleetCommand::test_fleet_dry_run_json_output PASSED [ 75%]
backend\tests\test_smriti_cli.py::TestFleetCommand::test_fleet_live_confirmation_declined PASSED [ 81%]
backend\tests\test_smriti_cli.py::TestFleetCommand::test_confirm_action_utility PASSED [ 87%]
backend\tests\test_smriti_cli.py::TestGovernanceCommand::test_governance_check_text_output PASSED [ 93%]
backend\tests\test_smriti_cli.py::TestGovernanceCommand::test_governance_check_json_output PASSED [100%]

============================= 16 passed in 25.74s =============================
```

## 10. Known Limitations
- Attendance punch recording relies on live FastAPI connectivity (`http://127.0.0.1:8000`); when the local development API server is stopped, attendance punches will fail with connection refused.

## 11. Future Work
- Add `backup` and `restore` subcommands to wrap automated PostgreSQL pg_dump snapshot rotations for individual tenant company databases.
- Integrate audit logging dispatcher to log all CLI mutations directly into `compliance_immutable_audit_logs`.

## 12. Related ADRs
- `ADR-0042`: Positive Table Ownership Registry (TDB-v2.0)
- `ADR-0051`: Unified Operational Command Architecture & Tooling Consolidation

## 13. Related RFCs
- `RFC-0019`: Multi-Tenant Fleet Migration Safety & Advisory Locking
