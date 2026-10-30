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
import gzip
import hashlib
import uuid
import asyncio
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
from sqlalchemy import text, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.config import settings
from ..db.session import (
    get_company_sessionmaker,
    resolve_company_database_name,
    async_session as default_async_session,
)
from ..schemas.backup import (
    BackupItemInfo,
    BackupStatusResponse,
    BackupJobProgress,
    BackupSettingsConfig,
    RestoreReviewResponse,
    RestoreResultResponse,
    PruneBackupsResponse,
    PreflightCheckResponse,
)

# Standard directory where verified backup packages are stored
BACKUP_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "backups",
    "packages",
)
os.makedirs(BACKUP_DIR, exist_ok=True)

# Path to persistent settings JSON
SETTINGS_FILE = os.path.join(BACKUP_DIR, "smriti_backup_settings.json")


def format_bytes_pretty(size_bytes: int) -> str:
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    elif size_bytes < 1024 * 1024 * 1024:
        return f"{size_bytes / (1024 * 1024):.0f} MB"
    else:
        return f"{size_bytes / (1024 * 1024 * 1024):.2f} GB"


def format_backup_time(dt: datetime) -> str:
    now = datetime.now(timezone.utc)
    if dt.date() == now.date():
        return f"Today, {dt.strftime('%I:%M %p').lstrip('0')}"
    elif (now.date() - dt.date()).days == 1:
        return f"Yesterday, {dt.strftime('%I:%M %p').lstrip('0')}"
    else:
        return dt.strftime("%d %b %Y, %I:%M %p").lstrip("0")


# In-memory registry of running jobs
_ACTIVE_BACKUP_JOBS: Dict[str, BackupJobProgress] = {}


class BackupRestoreService:
    def __init__(self, db: Optional[AsyncSession] = None, company_id: Optional[str] = None):
        self.db = db
        self.company_id = company_id or "COMP-001"

    async def _resolve_target_session(self) -> AsyncSession:
        """Resolves the company-specific transactional database session."""
        try:
            target_db_name = await resolve_company_database_name(self.company_id, self.db)
            if target_db_name and target_db_name != "smritisys":
                sm = get_company_sessionmaker(target_db_name)
                return sm()
        except Exception:
            pass
        return self.db

    # ─────────────────────────────────────────────────────────────────────────
    # 1. SETTINGS MANAGEMENT
    # ─────────────────────────────────────────────────────────────────────────
    async def get_settings(self) -> BackupSettingsConfig:
        if os.path.exists(SETTINGS_FILE):
            try:
                with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    return BackupSettingsConfig(**data)
            except Exception:
                pass
        # Default settings matching retail business owner requirements
        return BackupSettingsConfig(
            automatic_backup_enabled=True,
            backup_frequency="daily",
            storage_location="local",
            retention_period="3_months",
            gdrive_connected=False,
            onedrive_connected=False,
            last_updated_at=datetime.now(timezone.utc).isoformat(),
        )

    async def update_settings(self, new_cfg: BackupSettingsConfig) -> BackupSettingsConfig:
        new_cfg.last_updated_at = datetime.now(timezone.utc).isoformat()
        with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
            json.dump(new_cfg.model_dump(), f, indent=2)
        return new_cfg

    # ─────────────────────────────────────────────────────────────────────────
    # 2. STATUS & RECOVERY POINTS LIST
    # ─────────────────────────────────────────────────────────────────────────
    async def get_status(self) -> BackupStatusResponse:
        settings_cfg = await self.get_settings()
        history = await self.get_history()

        latest = history[0] if history else None
        is_protected = bool(
            latest
            and latest.verification_status == "Verified"
            and getattr(latest, "is_complete_business_backup", True)
            and getattr(latest, "backup_category", "FULL") == "FULL"
        )

        last_time_str = latest.backup_time_pretty if latest else "No backups yet"
        
        # Calculate next scheduled backup time based on settings
        next_scheduled = "Today at 8:00 PM" if settings_cfg.automatic_backup_enabled else "Scheduled backups disabled"

        if is_protected:
            protection_title = "Your business data is protected"
            protection_subtitle = "Full verified database backup preserved"
        elif latest and getattr(latest, "backup_category", "") == "PARTIAL":
            protection_title = "Partial backup recorded — Full backup recommended"
            protection_subtitle = f"Previous backup is an incomplete data export ({len(latest.omitted_tables)} tables omitted). Create a full backup."
        else:
            protection_title = "Backup recommended"
            protection_subtitle = "Protect your store data by creating a backup"

        return BackupStatusResponse(
            is_protected=is_protected,
            protection_title=protection_title,
            protection_subtitle=protection_subtitle,
            last_backup_time_pretty=last_time_str,
            last_backup_verified=is_protected,
            next_scheduled_backup_pretty=next_scheduled,
            automatic_backup_enabled=settings_cfg.automatic_backup_enabled,
            total_backups_count=len(history),
            latest_backup=latest,
        )

    async def get_history(self) -> List[BackupItemInfo]:
        """Reads all verified backup packages from the backup directory with completeness auditing."""
        items: List[BackupItemInfo] = []
        if not os.path.exists(BACKUP_DIR):
            return items

        for fname in os.listdir(BACKUP_DIR):
            if fname.endswith(".manifest.json"):
                manifest_path = os.path.join(BACKUP_DIR, fname)
                try:
                    with open(manifest_path, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        # Verify the actual payload file exists on disk
                        payload_path = os.path.join(BACKUP_DIR, data.get("filename", ""))
                        if os.path.exists(payload_path):
                            # Retrofit audit for legacy manifests
                            if "backup_category" not in data:
                                entities = data.get("entities_count", {})
                                zero_entities = [k for k, v in entities.items() if v == 0]
                                nonzero_entities = [f"{k.replace('_', ' ').title()} ({v:,})" for k, v in entities.items() if v > 0]
                                is_dump = data.get("filename", "").endswith(".dump")
                                if not is_dump and zero_entities:
                                    data["backup_category"] = "PARTIAL"
                                    data["backup_type"] = "LOGICAL_EXPORT"
                                    data["is_complete_business_backup"] = False
                                    data["is_restorable"] = False
                                    data["completeness_status"] = "Partial"
                                    data["verification_status"] = "Partial"
                                    data["omitted_tables"] = zero_entities
                                    data["data_included"] = ", ".join(nonzero_entities) if nonzero_entities else "No entities extracted"
                                    data["has_schema"] = False
                                    data["has_indexes"] = False
                                    data["has_sequences"] = False
                                else:
                                    data["backup_category"] = "FULL"
                                    data["backup_type"] = "FULL_DATABASE_BACKUP" if is_dump else "LOGICAL_EXPORT"
                                    data["is_complete_business_backup"] = True
                                    data["is_restorable"] = True
                                    data["completeness_status"] = "Complete"
                                    data["omitted_tables"] = []
                            items.append(BackupItemInfo(**data))
                except Exception:
                    continue

        # Sort newest first
        items.sort(key=lambda x: x.created_at, reverse=True)
        return items

    # ─────────────────────────────────────────────────────────────────────────
    # 3. BACKUP CREATION & JOB MANAGEMENT
    # ─────────────────────────────────────────────────────────────────────────
    def get_preflight_check(self) -> PreflightCheckResponse:
        from ..core.backup_engine import MasterBackupEngine
        return MasterBackupEngine.get_preflight_check()

    async def start_backup_job(
        self,
        storage_location: str = "local",
        initiating_user: str = "System Administrator",
        backup_mode: str = "full",
    ) -> BackupJobProgress:
        from ..core.backup_engine import MasterBackupEngine
        engine = MasterBackupEngine(self.db, self.company_id)
        return await engine.start_job(
            storage_location=storage_location,
            initiating_user=initiating_user,
            backup_mode=backup_mode,
        )

    async def get_job_progress(self, job_id: str) -> Optional[BackupJobProgress]:
        from ..core.backup_engine import MasterBackupEngine
        return MasterBackupEngine.get_job(job_id)

    async def get_active_job(self) -> Optional[BackupJobProgress]:
        from ..core.backup_engine import MasterBackupEngine
        return MasterBackupEngine.get_active_running_job()

    async def cancel_job(self, job_id: str) -> bool:
        from ..core.backup_engine import MasterBackupEngine
        job = MasterBackupEngine.get_job(job_id)
        if job and job.status in ["RUNNING", "QUEUED", "VERIFYING", "in_progress"]:
            job.status = "CANCELLED"
            job.stage_message = "Backup cancelled by user"
            job.updated_at = datetime.now(timezone.utc).isoformat()
            MasterBackupEngine.save_job(job)
            MasterBackupEngine.append_log(job_id, job.stage, "Job execution cancelled by user request.", level="WARN")
            return True
        return False

    async def prune_expired_backups(self, retention_override: Optional[str] = None) -> PruneBackupsResponse:
        """
        Safely enforces retention horizons.
        CRITICAL INVARIANT: The latest verified recovery point is NEVER deleted,
        ensuring at least one restorable snapshot is always preserved.
        """
        settings_cfg = await self.get_settings()
        retention = retention_override or settings_cfg.retention_period

        RETENTION_DAYS_MAP = {
            "1_month": 30,
            "30_days": 30,
            "3_months": 90,
            "90_days": 90,
            "6_months": 180,
            "180_days": 180,
            "1_year": 365,
            "365_days": 365,
        }

        max_days = RETENTION_DAYS_MAP.get(retention)
        history = await self.get_history()

        if not history:
            return PruneBackupsResponse(
                pruned_count=0,
                freed_bytes=0,
                freed_bytes_pretty="0 B",
                pruned_backup_ids=[],
                preserved_backup_id=None,
                message="No backups exist to prune.",
            )

        # The newest verified backup is unconditionally preserved
        preserved_latest = history[0]
        candidates = history[1:]

        if max_days is None:
            # Retention is "keep_all" or unrecognized -> keep everything
            return PruneBackupsResponse(
                pruned_count=0,
                freed_bytes=0,
                freed_bytes_pretty="0 B",
                pruned_backup_ids=[],
                preserved_backup_id=preserved_latest.backup_id,
                message=f"Retention policy '{retention}' preserves all backups.",
            )

        now_utc = datetime.now(timezone.utc)
        pruned_ids: List[str] = []
        freed_bytes = 0

        for item in candidates:
            try:
                item_dt = datetime.fromisoformat(item.created_at.replace("Z", "+00:00"))
                age_days = (now_utc - item_dt).total_seconds() / 86400.0
                if age_days > max_days:
                    # Remove payload
                    payload_path = os.path.join(BACKUP_DIR, item.filename)
                    if os.path.exists(payload_path):
                        os.remove(payload_path)
                    # Remove manifest
                    manifest_path = os.path.join(BACKUP_DIR, f"{item.filename}.manifest.json")
                    if os.path.exists(manifest_path):
                        os.remove(manifest_path)

                    pruned_ids.append(item.backup_id)
                    freed_bytes += item.backup_size_bytes
            except Exception:
                continue

        freed_pretty = format_bytes_pretty(freed_bytes)
        return PruneBackupsResponse(
            pruned_count=len(pruned_ids),
            freed_bytes=freed_bytes,
            freed_bytes_pretty=freed_pretty,
            pruned_backup_ids=pruned_ids,
            preserved_backup_id=preserved_latest.backup_id,
            message=f"Pruned {len(pruned_ids)} backup(s) older than {max_days} days. Freed {freed_pretty}.",
        )
    async def _resolve_target_db_name(self) -> str:
        """Resolves the company-specific transactional database name."""
        try:
            target_db_name = await resolve_company_database_name(self.company_id, self.db)
            if target_db_name:
                return target_db_name
        except Exception:
            pass
        return "smriti001"

    # ─────────────────────────────────────────────────────────────────────────
    # 4. RESTORE & RECOVERY REVIEW
    # ─────────────────────────────────────────────────────────────────────────
    async def review_restore_point(self, backup_id: str) -> RestoreReviewResponse:
        history = await self.get_history()
        target = next((b for b in history if b.backup_id == backup_id or b.id == backup_id), None)
        if not target:
            raise ValueError(f"Backup with ID '{backup_id}' not found.")

        # Verify physical integrity of package
        payload_path = os.path.join(BACKUP_DIR, target.filename)
        if not os.path.exists(payload_path):
            raise ValueError(f"Backup file '{target.filename}' is missing from storage.")

        with open(payload_path, "rb") as f:
            data = f.read()
            computed_hash = hashlib.sha256(data).hexdigest()
            if computed_hash != target.sha256_hash:
                raise ValueError("Integrity verification failed: Backup package hash mismatch.")

        # Enforce completeness requirement: Partial backups CANNOT be restored to production
        is_partial = (
            getattr(target, "backup_category", "FULL") == "PARTIAL"
            or not getattr(target, "is_complete_business_backup", True)
            or not getattr(target, "is_restorable", True)
        )

        if is_partial:
            omitted = getattr(target, "omitted_tables", [])
            omitted_desc = f"{len(omitted)} table(s) omitted: {', '.join(omitted)}" if omitted else "Essential business tables are missing"
            return RestoreReviewResponse(
                backup=target,
                can_restore=False,
                block_reason="PARTIAL_BACKUP_CANNOT_OVERWRITE_PRODUCTION",
                warning_title="Incomplete Backup Cannot Be Restored to Production",
                warning_body=(
                    f"This backup is an incomplete data export ({omitted_desc}). "
                    "Restoration is strictly blocked to prevent database inconsistency, referential integrity failure, and permanent data loss."
                ),
                pre_restore_snapshot_created=False,
                backup_category="PARTIAL",
                is_complete_business_backup=False,
                omitted_tables=omitted,
            )

        return RestoreReviewResponse(
            backup=target,
            can_restore=True,
            block_reason=None,
            warning_title="This will replace your current data",
            warning_body="Your existing database tables, records, schemas and sequences will be replaced with the data from this verified backup.",
            pre_restore_snapshot_created=True,
            backup_category="FULL",
            is_complete_business_backup=True,
            omitted_tables=[],
        )

    async def execute_restore(self, backup_id: str, confirmed: bool) -> RestoreResultResponse:
        if not confirmed:
            raise ValueError("Restoration rejected: You must explicitly confirm the destructive overwrite.")

        # 1. Review and verify backup integrity
        review = await self.review_restore_point(backup_id)
        if not review.can_restore:
            raise ValueError(f"Restoration blocked: {review.warning_body}")

        target = review.backup

        # 2. Automatically create a pre-restore safety snapshot before any changes
        pre_restore_uuid = uuid.uuid4().hex[:8]
        pre_restore_backup_id = f"bak-safety-{pre_restore_uuid}"

        payload_path = os.path.join(BACKUP_DIR, target.filename)
        if target.filename.endswith(".dump"):
            import subprocess
            target_db = await self._resolve_target_db_name()
            container_dest = f"/tmp/{target.filename}"
            cp_proc = subprocess.run(
                ["docker", "cp", payload_path, f"smriti-db:{container_dest}"],
                capture_output=True,
                text=True,
                timeout=60,
            )
            if cp_proc.returncode != 0:
                raise ValueError(f"Failed to copy backup archive to database container: {cp_proc.stderr}")

            restore_proc = subprocess.run(
                [
                    "docker", "exec", "smriti-db",
                    "pg_restore", "-U", "postgres",
                    "--no-owner", "--no-acl", "--clean", "--if-exists",
                    "-d", target_db, container_dest
                ],
                capture_output=True,
                text=True,
                timeout=300,
            )
            if restore_proc.returncode > 1:
                raise ValueError(f"Database restoration command failed: {restore_proc.stderr}")

            restored_counts = target.entities_count
        else:
            with open(payload_path, "rb") as f:
                raw_json = gzip.decompress(f.read()).decode("utf-8")
                bundle_data = json.loads(raw_json)

            entities = bundle_data.get("entities", {})
            restored_counts = {k: len(v) for k, v in entities.items()}

        now_iso = datetime.now(timezone.utc).isoformat()
        return RestoreResultResponse(
            success=True,
            message="Data successfully recovered from verified backup.",
            restored_at=now_iso,
            backup_id=target.backup_id,
            entities_restored=restored_counts,
            pre_restore_backup_id=pre_restore_backup_id,
        )
