<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.73.0
  Created      : 2026-10-13
  Modified     : 2026-10-13
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Architecture & Foundation Plan
-->

# Implementation Plan: Unified SMRITI CLI Engine Architecture Plan v1.0.0

## 1. Objective
Design and implement a single canonical command-line interface (`smriti` / `python -m app.cli`) that consolidates SMRITI Retail OS's fragmented operational tools, migration engines, governance guards, and diagnostic scripts into an auditable, cross-platform CLI dispatcher without duplicating existing business logic or replacing client-side command palettes.

## 2. Business Motivation
SMRITI Retail OS currently possesses extensive operational capabilities (multi-tenant fleet migrations, database ownership guards, version SSOT validation, health probes, biometric attendance syncing). However, these tools are split across Python scripts, PowerShell scripts (`.ps1`), Linux shell scripts (`.sh`), and npm scripts. This fragmentation:
- Increases cognitive load on system administrators, devops teams, and store technicians.
- Introduces platform drift between Windows development workstations and Linux Docker containers.
- Lacks a centralized interactive safety guard for destructive operations.
A unified `smriti` CLI dispatcher creates an ergonomic, standard operational surface while preserving all underlying engines.

## 3. Scope
- **Canonical Entry Point:** Package and expose `python -m app.cli` and a root `smriti` console script / npm command (`npm run smriti -- <args>`).
- **Core Subcommands:**
  1. `version`: Wrap `scripts/validate_version_ssot.py` (SSOT inspection & bump).
  2. `health`: Port `scripts/health.ps1` & `scripts/health.sh` into unified, cross-platform Python socket and HTTP health probes.
  3. `fleet`: Delegate directly to `backend/tools/migrate_fleet.py` (`FleetMigrator` engine).
  4. `db`: Sub-commands for topology verification (`verify_installation.py`), table ownership verification (`cp_guard.py`), and table statistics.
  5. `governance`: Sub-commands for `fields` (UX field guard), `dto` (API DTO reconciliation), and `boundary` (tenant isolation guard).
  6. `attendance`: Delegate to `scripts/headless_attendance_client.py` for IoT biometric and punch automation.
- **Client Complementarity:** Explicitly retain and complement the `Alt + Space` Command Palette (`ShortcutPalette.tsx`) and `Ctrl + K` Global Search (`GlobalSearch.tsx`).
- **Safety & Confirmation:** Mandatory interactive `[y/N]` confirmation prompts on all non-dry-run database upgrades, tenant resets, or service restarts.
- **Structured Output:** Support `--json` flag on all subcommands for programmatic consumption by CI/CD pipelines and administrative dashboards.

## 4. Current State
- Multiple detached tools:
  - `python backend/tools/migrate_fleet.py`
  - `python backend/app/db/cp_guard.py`
  - `python scripts/validate_version_ssot.py`
  - `python scripts/architecture_preflight.py`
  - `scripts/health.ps1` / `scripts/health.sh`
  - `scripts/repair.ps1` / `scripts/repair.sh`
  - `scripts/headless_attendance_client.py`
- Operators must memorize file paths and environment configurations across multiple subdirectories.

## 5. Gap Analysis
| Operational Requirement | Current Tooling | Target `smriti` CLI Dispatcher |
|---|---|---|
| Single Entrypoint | None (manual script invocations) | `smriti <subcommand>` or `python -m app.cli <subcommand>` |
| Cross-Platform Parity | Separate `.ps1` and `.sh` files with logic drift | Unified Python execution engine working identically on Windows, macOS, and Linux |
| Destructive Operation Safeguard | Missing or ad-hoc flags | Interactive confirmation prompt `Are you sure you want to proceed? [y/N]` unless `--yes` is passed |
| Centralized Audit Log | Standard stdout only | Dispatches execution records to `system_audit_logs` or structured log format |
| Dry-Run Support | Present in some scripts (`migrate_fleet.py`), missing in others | Uniform `--dry-run` flag supported across all mutation commands |

## 6. Architecture Impact
```text
┌────────────────────────────────────────────────────────────────────────┐
│                        smriti (Console Dispatcher)                     │
│                        python -m app.cli [args]                        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
    ┌──────────────┬────────────────┼──────────────┬────────────────┐
    ▼              ▼                ▼              ▼                ▼
[version]       [health]         [fleet]          [db]        [governance]
scripts/        Cross-Platform   FleetMigrator    cp_guard    AST CI Guards
validate_ssot   Probe Engine     (Advisory Lock)  Topology    (Boundary/DTO)
```
- No duplicate business logic: The CLI dispatcher acts as a thin routing and argument-normalization layer.
- Zero extra external dependencies: Uses Python's standard `argparse`, `sys`, `socket`, `urllib.request`.

## 7. Proposed Design
1. **Directory Structure (`backend/app/cli/`):**
   - `backend/app/cli/__init__.py`: Package init.
   - `backend/app/cli/__main__.py`: Allows direct invocation via `python -m app.cli`.
   - `backend/app/cli/main.py`: Main `argparse` parser and dispatcher.
   - `backend/app/cli/commands/`:
     - `version_cmd.py`: Delegates to `validate_version_ssot`.
     - `health_cmd.py`: Executes unified health probes.
     - `fleet_cmd.py`: Wraps `FleetMigrator`.
     - `db_cmd.py`: Wraps `cp_guard` and `verify_installation`.
     - `governance_cmd.py`: Wraps CI guard engines.
     - `attendance_cmd.py`: Wraps `headless_attendance_client`.
2. **Interactive Confirmation Guard Utility:**
   - Helper function `confirm_action(prompt: str, force: bool = False) -> bool` requiring explicit `y` / `yes`.
3. **Execution Audit Logger:**
   - Emits structured JSON telemetry to internal audit log.

## 8. Files Created (Upon Approval in Phase 2)
- `backend/app/cli/__init__.py`
- `backend/app/cli/__main__.py`
- `backend/app/cli/main.py`
- `backend/app/cli/commands/version_cmd.py`
- `backend/app/cli/commands/health_cmd.py`
- `backend/app/cli/commands/fleet_cmd.py`
- `backend/app/cli/commands/db_cmd.py`
- `backend/app/cli/commands/governance_cmd.py`
- `backend/app/cli/commands/attendance_cmd.py`
- `backend/tests/test_smriti_cli.py`

## 9. Files Modified (Upon Approval in Phase 2)
- `package.json` (add `"smriti": "python -m app.cli"` to scripts)
- `CHANGELOG.md`

## 10. Dependencies
- Python 3.11+
- Standard library: `argparse`, `dataclasses`, `json`, `sys`, `socket`, `urllib`
- Existing backend modules: `app.core.config`, `app.db.fleet_migrator`, `app.db.cp_guard`

## 11. Risks
- **Risk:** Potential path resolution issues when invoked from different working directories (e.g. root vs `backend/`).
- **Mitigation:** Implement deterministic repository root detection in `main.py` by walking up until `package.json` or `.agents/` is found.

## 12. Rollback Strategy
- The CLI is purely additive and wraps existing scripts. If any issue occurs, existing scripts remain 100% accessible directly without interruption.

## 13. Verification Plan
1. `python -m app.cli --help` — Returns global help with all subcommands.
2. `python -m app.cli version` — Validates 4-point SSOT version lock.
3. `python -m app.cli health` — Executes non-mutating socket and HTTP probes.
4. `python -m app.cli fleet --dry-run` — Runs read-only fleet inspection.
5. `python -m app.cli db guard` — Runs TDB-v2.0 control plane guard.
6. `python -m app.cli governance check` — Runs tenant boundary and DTO reconciliation guards.

## 14. Test Plan
- Unit tests in `backend/tests/test_smriti_cli.py`:
  - Argument parsing for each subcommand.
  - `--json` flag output formatting.
  - Interactive prompt rejection on EOF or 'n'.
  - Exit code propagation on failures.

## 15. Documentation Impact
- Create User & Operator Guide: `docs/guide/SMRITI_CLI_OPERATOR_GUIDE.md`.
- Update `README.md` with CLI usage instructions.
- Update `docs/architecture/SMRITI_PLATFORM_IMPLEMENTATION_STATUS.md`.
- Append Walkthrough upon completion.

## 16. Deployment Plan
- Phase 1: Planning and Security Remediation (Current).
- Phase 2: Implementation of `app.cli` after Tenant Boundary Guard passes 100%.
- Phase 3: Automated testing and documentation.

## 17. Status
Approved for Planning (Implementation on Hold pending Tenant Boundary Remediation).

## 18. Related ADRs
- `ADR-0042`: Positive Table Ownership Registry (TDB-v2.0)
- `ADR-0051`: Unified Operational Command Architecture & Tooling Consolidation

## 19. Related Walkthroughs
- To be created: `docs/walkthrough/foundation/Unified_SMRITI_CLI_Engine_Architecture_v1.0.0.md`
