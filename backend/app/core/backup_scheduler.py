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
import asyncio
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any

from .logging import logger
from .backup_engine import MasterBackupEngine, BACKUP_PACKAGES_DIR, SETTINGS_FILE
from ..schemas.backup import BackupSchedulerStatusResponse, BackupSettingsConfig


class BackupSchedulerDaemon:
    """
    Pure asyncio background worker for automated off-hours backups and retention pruning.
    Monitors configuration, triggers automated backups when due, and safely isolates ticks.
    """

    def __init__(self, poll_interval_seconds: int = 60) -> None:
        self.poll_interval = poll_interval_seconds
        self._running = False
        self._last_run_at: Optional[str] = None
        self._last_prune_at: Optional[str] = None
        self._total_automated_runs: int = 0
        self._total_pruned_packages: int = 0

    def get_status(self) -> BackupSchedulerStatusResponse:
        cfg = self._load_settings()
        next_run = self.calculate_next_run(cfg)
        return BackupSchedulerStatusResponse(
            running=self._running,
            poll_interval_seconds=self.poll_interval,
            automatic_backup_enabled=cfg.automatic_backup_enabled,
            backup_frequency=cfg.backup_frequency,
            retention_period=cfg.retention_period,
            last_run_at=self._last_run_at,
            next_run_at=next_run,
            total_automated_runs=self._total_automated_runs,
            last_prune_at=self._last_prune_at,
            total_pruned_packages=self._total_pruned_packages,
        )

    def _load_settings(self) -> BackupSettingsConfig:
        if os.path.exists(SETTINGS_FILE):
            try:
                with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    return BackupSettingsConfig(**data)
            except Exception:
                pass
        return BackupSettingsConfig()

    def calculate_next_run(self, cfg: BackupSettingsConfig) -> Optional[str]:
        if not cfg.automatic_backup_enabled:
            return "Automatic backups disabled"

        # Check last backup timestamp
        latest_dt = self._get_latest_backup_datetime()
        interval = timedelta(days=1)
        if cfg.backup_frequency == "weekly":
            interval = timedelta(days=7)
        elif cfg.backup_frequency == "monthly":
            interval = timedelta(days=30)

        if latest_dt:
            next_dt = latest_dt + interval
            now = datetime.now(timezone.utc)
            if next_dt <= now:
                return "Due now (next cycle)"
            return next_dt.strftime("%d %b %Y, %I:%M %p UTC")
        return "Today at 8:00 PM UTC"

    def _get_latest_backup_datetime(self) -> Optional[datetime]:
        if not os.path.exists(BACKUP_PACKAGES_DIR):
            return None
        newest_dt: Optional[datetime] = None
        for fname in os.listdir(BACKUP_PACKAGES_DIR):
            if fname.endswith(".manifest.json"):
                fpath = os.path.join(BACKUP_PACKAGES_DIR, fname)
                try:
                    with open(fpath, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    created_str = data.get("created_at")
                    if created_str:
                        dt = datetime.fromisoformat(created_str.replace("Z", "+00:00"))
                        if newest_dt is None or dt > newest_dt:
                            newest_dt = dt
                except Exception:
                    continue
        return newest_dt

    def is_backup_due(self, cfg: BackupSettingsConfig) -> bool:
        if not cfg.automatic_backup_enabled:
            return False

        latest_dt = self._get_latest_backup_datetime()
        if not latest_dt:
            return True  # No backup has ever been made

        now = datetime.now(timezone.utc)
        elapsed = (now - latest_dt).total_seconds()

        THRESHOLD_SECONDS = {
            "daily": 24 * 3600,
            "weekly": 7 * 24 * 3600,
            "monthly": 30 * 24 * 3600,
        }
        required_interval = THRESHOLD_SECONDS.get(cfg.backup_frequency, 24 * 3600)
        return elapsed >= required_interval

    async def run(self) -> None:
        """Main scheduler loop."""
        self._running = True
        logger.info(
            f"[BackupScheduler] Daemon loop started (poll_interval={self.poll_interval}s)."
        )
        try:
            while self._running:
                await asyncio.sleep(self.poll_interval)
                await self._tick()
        except asyncio.CancelledError:
            logger.info("[BackupScheduler] Daemon received cancellation signal. Stopping.")
            self._running = False
        except Exception as exc:
            logger.error(f"[BackupScheduler] Daemon loop error: {exc}", exc_info=True)
            self._running = False

    async def _tick(self) -> None:
        """Evaluates schedule and triggers backup if due."""
        try:
            cfg = self._load_settings()
            if not cfg.automatic_backup_enabled:
                return

            if not self.is_backup_due(cfg):
                return

            # Check if any backup job is currently running
            active = MasterBackupEngine.get_active_running_job()
            if active:
                logger.info(f"[BackupScheduler] Tick: Active job '{active.job_id}' is running. Skipping tick.")
                return

            logger.info("[BackupScheduler] Tick: Scheduled backup is due. Triggering automated backup.")
            from ..db.session import async_session
            from ..services.backup_restore_service import BackupRestoreService

            async with async_session() as db:
                svc = BackupRestoreService(db, "COMP-001")
                job = await svc.start_backup_job(
                    storage_location=cfg.storage_location,
                    initiating_user="Automated Scheduler Daemon",
                )
                self._last_run_at = datetime.now(timezone.utc).isoformat()
                self._total_automated_runs += 1
                logger.info(f"[BackupScheduler] Triggered automated backup job '{job.job_id}'.")

        except Exception as tick_exc:
            logger.error(f"[BackupScheduler] Tick error: {tick_exc}", exc_info=True)


_backup_daemon: Optional[BackupSchedulerDaemon] = None
_backup_daemon_task: Optional[asyncio.Task] = None


def start_backup_scheduler(poll_interval_seconds: int = 60) -> None:
    global _backup_daemon, _backup_daemon_task
    if _backup_daemon_task is not None and not _backup_daemon_task.done():
        logger.warning("[BackupScheduler] start_backup_scheduler() called but daemon is already active.")
        return

    _backup_daemon = BackupSchedulerDaemon(poll_interval_seconds=poll_interval_seconds)
    _backup_daemon_task = asyncio.create_task(_backup_daemon.run(), name="smriti_backup_scheduler")
    logger.info("[BackupScheduler] Background task spawned.")


async def stop_backup_scheduler() -> None:
    global _backup_daemon_task
    if _backup_daemon_task is None or _backup_daemon_task.done():
        return
    _backup_daemon_task.cancel()
    await asyncio.gather(_backup_daemon_task, return_exceptions=True)
    logger.info("[BackupScheduler] Background task terminated cleanly.")
    _backup_daemon_task = None


def get_backup_scheduler_status() -> BackupSchedulerStatusResponse:
    global _backup_daemon
    if _backup_daemon:
        return _backup_daemon.get_status()
    return BackupSchedulerStatusResponse(
        running=False,
        poll_interval_seconds=60,
        automatic_backup_enabled=True,
        backup_frequency="daily",
        retention_period="3_months",
    )
