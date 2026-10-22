"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-10-22
Modified     : 2026-10-22
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import os
import json
import pytest
import asyncio
from datetime import datetime, timezone, timedelta

from app.core.backup_engine import (
    MasterBackupEngine,
    redact_secrets,
    BACKUP_JOBS_DIR,
    BACKUP_LOGS_DIR,
    BACKUP_PACKAGES_DIR,
)
from app.schemas.backup import BackupJobProgress, BackupItemInfo
from app.services.backup_restore_service import BackupRestoreService


def test_secret_redaction():
    raw_connection_str = "postgresql://retail_user:super_secret_pwd_123@localhost:5432/smritiretail"
    sanitized = redact_secrets(raw_connection_str)
    assert "super_secret_pwd_123" not in sanitized
    assert "retail_user" in sanitized
    assert "***REDACTED***" in sanitized

    raw_log = "Error connecting to cloud with password=SuperSecretPassword! and token: eyJhbGciOi"
    sanitized_log = redact_secrets(raw_log)
    assert "SuperSecretPassword!" not in sanitized_log
    assert "***REDACTED***" in sanitized_log


def test_preflight_check():
    preflight = MasterBackupEngine.get_preflight_check(estimated_mb=50)
    assert preflight.free_space_bytes > 0
    assert "B" in preflight.free_space_pretty
    assert preflight.destination_accessible is True
    assert os.path.exists(preflight.destination_path)
    assert isinstance(preflight.passed, bool)


def test_job_logging_persistence_and_tail():
    test_job_id = f"test-log-{datetime.now(timezone.utc).strftime('%H%M%S')}"
    
    # Append structured logs with a secret
    MasterBackupEngine.append_log(
        job_id=test_job_id,
        stage="preflight",
        message="Verifying credentials with password=UnsafePlainTextPass",
        level="INFO",
    )
    MasterBackupEngine.append_log(
        job_id=test_job_id,
        stage="database_backup",
        message="Database tables exported successfully.",
        level="SUCCESS",
    )

    # Retrieve logs via engine
    res = MasterBackupEngine.get_logs(test_job_id, tail=10)
    assert res.total_lines >= 2
    assert len(res.logs) >= 2
    
    # Confirm secret was sanitized in log entries
    assert "UnsafePlainTextPass" not in res.logs[0].message
    assert "***REDACTED***" in res.logs[0].message
    assert res.logs[1].level == "SUCCESS"

    # Confirm log was physically persisted to disk
    log_file = os.path.join(BACKUP_LOGS_DIR, f"{test_job_id}.log")
    assert os.path.exists(log_file)
    with open(log_file, "r", encoding="utf-8") as f:
        content = f.read()
    assert "UnsafePlainTextPass" not in content
    assert "***REDACTED***" in content


def test_crash_reconciliation_marks_orphaned_jobs_interrupted():
    stranded_job_id = "test-job-stranded-host-reboot"
    stranded_fpath = os.path.join(BACKUP_JOBS_DIR, f"{stranded_job_id}.json")

    stranded_job = BackupJobProgress(
        job_id=stranded_job_id,
        status="RUNNING",
        stage="archive_creation",
        percent=80,
        stage_message="Compressing archive bundle",
        initiating_user="Admin",
        destination="This Device",
        storage_location_type="local",
        started_at=datetime.now(timezone.utc).isoformat(),
        updated_at=datetime.now(timezone.utc).isoformat(),
    )

    with open(stranded_fpath, "w", encoding="utf-8") as f:
        json.dump(stranded_job.model_dump(), f, indent=2)

    # Execute startup reconciliation
    reconciled_count = MasterBackupEngine.reconcile_interrupted_jobs()
    assert reconciled_count >= 1

    # Inspect persisted state on disk
    with open(stranded_fpath, "r", encoding="utf-8") as f:
        reconciled_data = json.load(f)

    # Mandatory rule: An interrupted job must NEVER be marked SUCCESS
    assert reconciled_data["status"] == "INTERRUPTED"
    assert reconciled_data["process_exit_code"] == -1
    assert "interrupted by backend restart" in reconciled_data["error_message"]

    # Clean up test artifact
    try:
        os.remove(stranded_fpath)
    except Exception:
        pass


@pytest.mark.asyncio
async def test_retention_pruning_unconditionally_preserves_newest_verified():
    service = BackupRestoreService(None, "COMP-001")
    
    # Generate 3 mock backup packages and manifests
    now = datetime.now(timezone.utc)
    test_ids = ["test-bak-oldest", "test-bak-middle", "test-bak-newest"]
    created_files = []

    try:
        for idx, bid in enumerate(test_ids):
            if bid == "test-bak-newest":
                created_dt = now + timedelta(days=1)
            else:
                created_dt = now - timedelta(days=90 - (idx * 10))
            fname = f"smriti_backup_COMP-001_retention_{bid}.json.gz"
            fpath = os.path.join(BACKUP_PACKAGES_DIR, fname)
            manifest_path = os.path.join(BACKUP_PACKAGES_DIR, f"{fname}.manifest.json")

            with open(fpath, "wb") as f:
                f.write(b"mock_backup_bytes")
            created_files.append(fpath)

            item = BackupItemInfo(
                id=bid,
                backup_id=bid,
                filename=fname,
                created_at=created_dt.isoformat(),
                backup_time_pretty="Past",
                backup_size_bytes=100,
                backup_size_pretty="100 B",
                verification_status="Verified",
                sha256_hash="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
                is_restorable=True,
            )
            with open(manifest_path, "w", encoding="utf-8") as f:
                json.dump(item.model_dump(), f, indent=2)
            created_files.append(manifest_path)

        # Trigger pruning with 30_days retention (which would prune all 3 if not protected)
        prune_res = await service.prune_expired_backups(retention_override="30_days")

        # The newest verified backup MUST be preserved
        assert prune_res.preserved_backup_id == "test-bak-newest"
        assert "test-bak-newest" not in prune_res.pruned_backup_ids
        
        # Older backups are pruned
        assert "test-bak-oldest" in prune_res.pruned_backup_ids
        assert "test-bak-middle" in prune_res.pruned_backup_ids

        # Verify disk state for newest backup
        newest_manifest = os.path.join(BACKUP_PACKAGES_DIR, f"smriti_backup_COMP-001_retention_test-bak-newest.json.gz.manifest.json")
        assert os.path.exists(newest_manifest)

    finally:
        # Cleanup test files
        for f in created_files:
            if os.path.exists(f):
                try:
                    os.remove(f)
                except Exception:
                    pass
