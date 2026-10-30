"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-10-27
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal - Upgrade and Migration Governance Test Suite (UMGP-v1.0)
"""

import os
import sys
import json
import subprocess
from pathlib import Path

import pytest

WORKSPACE = Path(__file__).resolve().parent.parent.parent.parent
BACKEND = WORKSPACE / "backend"
SCRIPTS = WORKSPACE / "scripts"
ALEMBIC_VERSIONS = BACKEND / "alembic" / "versions"
VENV_PYTHON = WORKSPACE / ".venv" / "Scripts" / "python.exe"
if not VENV_PYTHON.exists():
    VENV_PYTHON = Path(sys.executable)

PG_PORT = int(os.getenv("POSTGRES_PORT", "2781"))
PG_HOST = os.getenv("POSTGRES_HOST", "localhost")
PG_USER = os.getenv("POSTGRES_USER", "postgres")
PG_PASS = os.getenv("POSTGRES_PASSWORD", "postgres")
CTRL_DB = os.getenv("POSTGRES_DB", "smritisys")


def _run(args, cwd=None, timeout=60):
    return subprocess.run(
        [str(a) for a in args],
        cwd=str(cwd or WORKSPACE),
        env=os.environ.copy(),
        capture_output=True,
        text=True,
        timeout=timeout,
    )


def _pg_available():
    try:
        import psycopg2
        conn = psycopg2.connect(
            host=PG_HOST, port=PG_PORT, user=PG_USER,
            password=PG_PASS, dbname=CTRL_DB, connect_timeout=5,
        )
        conn.close()
        return True
    except Exception:
        return False


# TC-UMGP-001
def test_ci_gate_passes_on_existing_migrations():
    gate = SCRIPTS / "check_migration_governance.py"
    assert gate.exists(), "check_migration_governance.py must exist in scripts/"
    r = _run([VENV_PYTHON, gate], timeout=60)
    assert r.returncode == 0, f"Gate failed:\nSTDOUT:\n{r.stdout[-2000:]}\nSTDERR:\n{r.stderr[-500:]}"
    assert "PASS" in r.stdout


# TC-UMGP-002
def test_ci_gate_blocks_migration_missing_target():
    bad = ALEMBIC_VERSIONS / "v9999_test_umgp_g1_missing_target.py"
    bad.write_text(
        'revision = "v9999"\ndown_revision = "v1552"\n\ndef upgrade():\n    pass\n\ndef downgrade():\n    pass\n',
        encoding="utf-8",
    )
    try:
        r = _run([VENV_PYTHON, SCRIPTS / "check_migration_governance.py"], timeout=60)
        assert r.returncode == 1, "Gate must exit 1 when @migration_target is missing"
        assert "UMGP-G1" in r.stdout
    finally:
        bad.unlink(missing_ok=True)


# TC-UMGP-003
def test_ci_gate_blocks_destructive_without_approval():
    bad = ALEMBIC_VERSIONS / "v9998_test_umgp_g2_destructive.py"
    bad.write_text(
        'revision = "v9998"\ndown_revision = "v1552"\nfrom alembic import op\n\n'
        'def upgrade():\n    op.drop_table("test_tbl")\n\ndef downgrade():\n    pass\n',
        encoding="utf-8",
    )
    try:
        r = _run([VENV_PYTHON, SCRIPTS / "check_migration_governance.py"], timeout=60)
        assert r.returncode == 1, "Gate must exit 1 on unapproved destructive op"
        assert "UMGP-G2" in r.stdout
    finally:
        bad.unlink(missing_ok=True)


# TC-UMGP-004
def test_migration_boundary_tenant_blocked_on_control():
    sys.path.insert(0, str(BACKEND))
    try:
        from alembic.migration_contract import validate_migration_execution, MigrationBoundaryViolation
        with pytest.raises(MigrationBoundaryViolation):
            validate_migration_execution("tenant", "smritisys")
    finally:
        sys.path.pop(0)


# TC-UMGP-005
def test_migration_boundary_control_blocked_on_tenant():
    sys.path.insert(0, str(BACKEND))
    try:
        from alembic.migration_contract import validate_migration_execution, MigrationBoundaryViolation
        with pytest.raises(MigrationBoundaryViolation):
            validate_migration_execution("control", "smriti001")
    finally:
        sys.path.pop(0)


# TC-UMGP-006
def test_migration_boundary_both_allowed_everywhere():
    sys.path.insert(0, str(BACKEND))
    try:
        from alembic.migration_contract import validate_migration_execution
        validate_migration_execution("both", "smritisys")
        validate_migration_execution("both", "smriti001")
        validate_migration_execution("both", "smriti002")
    finally:
        sys.path.pop(0)


# TC-UMGP-007
@pytest.mark.skipif(not _pg_available(), reason="PostgreSQL not reachable")
def test_auto_migrate_verify_only():
    r = _run([VENV_PYTHON, SCRIPTS / "auto_migrate.py", "--verify-only", "--db", "control"], timeout=90)
    assert r.returncode == 0, f"verify-only failed:\n{r.stdout}\n{r.stderr}"


# TC-UMGP-008
@pytest.mark.skipif(not _pg_available(), reason="PostgreSQL not reachable")
def test_auto_migrate_backup_creates_manifest():
    backup_base = BACKEND / "backups" / "pre_migration"
    existing = {d.name for d in backup_base.iterdir() if d.is_dir()} if backup_base.exists() else set()
    r = _run([VENV_PYTHON, SCRIPTS / "auto_migrate.py", "--backup-only", "--db", "control"], timeout=120)
    assert r.returncode == 0, f"backup-only failed:\n{r.stdout[-2000:]}\n{r.stderr}"
    if backup_base.exists():
        new_dirs = [d for d in backup_base.iterdir() if d.is_dir() and d.name not in existing]
        assert len(new_dirs) >= 1, "backup-only must create a new session directory"
        manifests = list(new_dirs[0].glob("backup_manifest*.json"))
        assert len(manifests) >= 1, "Session must produce a backup_manifest*.json"
        data = json.loads(manifests[0].read_text())
        assert "backups" in data


# TC-UMGP-009
def test_update_sh_has_preflight_backup():
    sh = SCRIPTS / "update.sh"
    assert sh.exists(), "scripts/update.sh must exist"
    content = sh.read_text(encoding="utf-8", errors="replace")
    assert "backup-only" in content, "update.sh must call --backup-only"
    backup_pos = content.find("backup-only")
    migration_pos = content.find("bootstrap_engine")
    assert migration_pos > 0, "update.sh must call bootstrap_engine"
    assert backup_pos < migration_pos, "Backup step must appear BEFORE migrations in update.sh"


# TC-UMGP-010
def test_update_ps1_uses_bootstrap_engine():
    ps1 = SCRIPTS / "update.ps1"
    assert ps1.exists(), "scripts/update.ps1 must exist"
    content = ps1.read_text(encoding="utf-8", errors="replace")
    assert "bootstrap_engine" in content, "update.ps1 must delegate to bootstrap_engine.py"


# TC-UMGP-011
def test_migration_inventory_count():
    files = [f for f in ALEMBIC_VERSIONS.glob("*.py") if not f.name.startswith("__")]
    assert len(files) >= 238, f"Expected >= 238 migrations, found {len(files)}"


# TC-UMGP-012
def test_migration_contract_exports():
    sys.path.insert(0, str(BACKEND))
    try:
        from alembic.migration_contract import (
            migration_target,
            validate_migration_execution,
            MigrationBoundaryViolation,
        )
        assert callable(migration_target)
        assert callable(validate_migration_execution)
    finally:
        sys.path.pop(0)


# TC-UMGP-013
def test_docker_compose_db_healthcheck():
    compose = WORKSPACE / "docker-compose.yml"
    assert compose.exists(), "docker-compose.yml must exist"
    content = compose.read_text(encoding="utf-8", errors="replace")
    assert "pg_isready" in content, "smriti-db must have a pg_isready healthcheck"
    assert "service_healthy" in content, "smriti-api must depend on smriti-db with service_healthy"


# TC-UMGP-014
def test_umgp_governance_document_exists():
    doc = WORKSPACE / "docs" / "governance" / "UPGRADE_MIGRATION_GOVERNANCE_POLICY.md"
    assert doc.exists(), "UMGP governance policy must exist at docs/governance/UPGRADE_MIGRATION_GOVERNANCE_POLICY.md"
    content = doc.read_text(encoding="utf-8", errors="replace")
    for section in ["UMGP-001", "UMGP-002", "UMGP-003", "Preflight", "Rollback", "Acceptance Criteria"]:
        assert section in content, f"Governance doc must contain: {section}"
