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
  Classification: Technical Operator Guide
-->

# SMRITI Unified CLI Operator Guide

## 1. Overview
The SMRITI Unified Operational CLI (`smriti`) provides a single, canonical command-line interface for systems architects, DevOps engineers, and retail operators. It consolidates database topology management, fleet migrations, CI architecture guards, service health diagnostics, and biometric attendance recording.

The CLI is executable cross-platform across Windows, macOS, and Linux via three equivalent entry mechanisms:
```bash
# 1. Direct Python module execution (Backend sys.path auto-bootstrapped)
python -m backend.app.cli <command> [options]

# 2. Package-managed npm execution
npm run smriti -- <command> [options]

# 3. Direct app.cli module with PYTHONPATH
PYTHONPATH=backend python -m app.cli <command> [options]
```

---

## 2. Global Flags & Options
| Flag | Description |
|---|---|
| `-h`, `--help` | Display command usage and descriptions. |
| `--version` | Display the canonical SMRITI Retail OS version (`6.99.0`). |
| `--json` | Emit pure, parseable JSON output on stdout (available on all subcommands). |

---

## 3. Subcommands & Reference

### 3.1 `version` — 4-Point SSOT Verification
Validates that all four Single Source of Truth version anchors (`package.json`, `config.py`, `version.ts`, `CHANGELOG.md`) are strictly synchronized.

```bash
# Human-readable table
npm run smriti -- version

# Machine-readable JSON output for CI gates
npm run smriti -- version --json
```

**JSON Output Format:**
```json
{
  "status": "PASS",
  "canonical_version": "6.99.0",
  "is_synchronized": true,
  "components": {
    "package_json": "6.99.0",
    "backend_config_py": "6.99.0",
    "frontend_version_ts": "6.99.0",
    "changelog_md": "6.99.0"
  },
  "missing_files": []
}
```

---

### 3.2 `health` — Unified Service Health Audit
Performs non-mutating socket-level and HTTP-level availability probes with microsecond latency measurements.

- **PostgreSQL**: TCP socket probe to port 2781.
- **FastAPI Core**: HTTP GET probe to `http://127.0.0.1:8000/health`.
- **React Frontend**: HTTP GET probe to `http://127.0.0.1:3000/`.

```bash
# Run health audit
npm run smriti -- health

# JSON output for monitoring daemons
npm run smriti -- health --json
```

---

### 3.3 `fleet` — Multi-Tenant Fleet Migration Engine
Safely inspects and applies Alembic schema migrations across the control plane (`smritisys`) and all provisioned tenant databases (`smriti001`, `smriti002`, etc.) with PostgreSQL session advisory locks.

#### Safety Gates
Live migrations (non-dry-run) require interactive confirmation unless bypassed with `--yes`:
`Are you sure you want to execute migrations on ENTIRE FLEET? [y/N]`
In non-interactive CI environments without a TTY, the CLI refuses execution unless `--yes` is supplied.

```bash
# Read-only dry-run parity check across all tenants
npm run smriti -- fleet --dry-run

# Migrate a specific tenant database with safety prompt
npm run smriti -- fleet --db smriti001

# Migrate the entire fleet in non-interactive CI automation
npm run smriti -- fleet --fleet --yes --json
```

---

### 3.4 `db` — Database Administration & Control Plane Guard
Inspects database topology, row distributions, and enforces TDB-v2.0 positive table ownership isolation.

#### Actions:
- `db guard`: Runs `cp_guard.py` to ensure `smritisys` has zero undeclared tables.
- `db stats`: Connects to target database and displays public table count and top tables by row volume.

```bash
# Run control plane isolation guard
npm run smriti -- db guard

# Run guard with strict failure on non-empty tenant tables
npm run smriti -- db guard --fail-on-non-empty

# Inspect tenant table statistics
npm run smriti -- db stats --db smriti001 --json
```

---

### 3.5 `governance` — CI Architecture & Field Governance Suite
Consolidates the automated test suite guards:
- `governance boundary`: Runs `scripts/ci_tenant_boundary_guard.py`.
- `governance fields`: Runs `scripts/ci_ux_field_governance_guard.py`.
- `governance check`: Runs both checks and aggregates status.

```bash
# Run full governance verification
npm run smriti -- governance check

# Machine-readable JSON for GitHub Actions / CI runners
npm run smriti -- governance check --json
```

---

### 3.6 `attendance` — Biometric IoT & Attendance Client
Automates workforce attendance punch recording and staff directory lookups for retail counter terminals.

```bash
# Query active staff roster
npm run smriti -- attendance list-staff --company COMP-001

# Record an attendance punch
npm run smriti -- attendance punch --company COMP-001 --employee-id EMP-0101 --type IN
```

---

## 4. Exit Codes & CI Integration
The CLI strictly honors POSIX return codes:
- `0`: Operation succeeded or all validation checks passed.
- `1`: Operation failed, validation violation detected, or action aborted by user.
