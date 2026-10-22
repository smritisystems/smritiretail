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

import pytest
import os
import asyncio
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.services.backup_restore_service import (
    BackupRestoreService,
    BACKUP_DIR,
    format_bytes_pretty,
    format_backup_time,
)
from app.schemas.backup import BackupSettingsConfig


@pytest.mark.asyncio
async def test_backup_settings_lifecycle(db_session: AsyncSession):
    service = BackupRestoreService(db_session, "COMP-001")
    settings = await service.get_settings()
    assert settings is not None
    assert settings.automatic_backup_enabled is True
    assert settings.storage_location in ["local", "gdrive", "onedrive"]

    # Update settings
    updated = await service.update_settings(
        BackupSettingsConfig(
            automatic_backup_enabled=False,
            backup_frequency="weekly",
            storage_location="gdrive",
            retention_period="6_months",
            gdrive_connected=True,
            onedrive_connected=False,
        )
    )
    assert updated.automatic_backup_enabled is False
    assert updated.backup_frequency == "weekly"
    assert updated.storage_location == "gdrive"

    # Reset
    await service.update_settings(
        BackupSettingsConfig(
            automatic_backup_enabled=True,
            backup_frequency="daily",
            storage_location="local",
            retention_period="3_months",
            gdrive_connected=False,
            onedrive_connected=False,
        )
    )


@pytest.mark.asyncio
async def test_backup_creation_and_manifest_verification(db_session: AsyncSession):
    service = BackupRestoreService(db_session, "COMP-001")
    
    # Trigger backup job
    job = await service.start_backup_job(storage_location="local")
    assert job.job_id is not None
    assert job.status in ["in_progress", "completed"]

    # Await worker completion (wait up to 5 seconds)
    completed_job = None
    for _ in range(25):
        await asyncio.sleep(0.2)
        progress = await service.get_job_progress(job.job_id)
        if progress and progress.status in ["completed", "failed"]:
            completed_job = progress
            break

    assert completed_job is not None, "Backup job timed out"
    assert completed_job.status == "completed", f"Backup failed: {completed_job.error_message}"
    assert completed_job.percent == 100
    assert completed_job.backup_result is not None

    result = completed_job.backup_result
    assert result.verification_status == "Verified"
    assert result.backup_size_bytes > 0
    assert len(result.sha256_hash) == 64
    assert result.storage_location == "This Device"

    # Verify history picks it up
    history = await service.get_history()
    assert len(history) > 0
    found = any(b.backup_id == result.backup_id for b in history)
    assert found is True

    # Verify status
    status = await service.get_status()
    assert status.is_protected is True
    assert status.total_backups_count > 0


@pytest.mark.asyncio
async def test_restore_review_and_execution_guard(db_session: AsyncSession):
    service = BackupRestoreService(db_session, "COMP-001")
    history = await service.get_history()
    assert len(history) > 0, "Requires at least one backup in history"

    latest_backup = history[0]

    # Review restore point
    review = await service.review_restore_point(latest_backup.backup_id)
    assert review.can_restore is True
    assert review.backup.backup_id == latest_backup.backup_id
    assert "replace your current data" in review.warning_title.lower()

    # Rejection on missing confirmation
    with pytest.raises(ValueError, match="must explicitly confirm"):
        await service.execute_restore(latest_backup.backup_id, confirmed=False)

    # Execution with explicit confirmation
    restore_res = await service.execute_restore(latest_backup.backup_id, confirmed=True)
    assert restore_res.success is True
    assert restore_res.backup_id == latest_backup.backup_id
    assert restore_res.pre_restore_backup_id is not None


@pytest.mark.asyncio
async def test_format_helpers():
    assert format_bytes_pretty(500) == "500 B"
    assert format_bytes_pretty(1024 * 1024 * 245) == "245 MB"
    assert format_bytes_pretty(1024 * 1024 * 1024 * 2) == "2.00 GB"

    now = datetime.now(timezone.utc)
    assert "Today" in format_backup_time(now)
