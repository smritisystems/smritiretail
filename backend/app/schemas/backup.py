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

from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field


class BackupItemInfo(BaseModel):
    id: str
    backup_id: str
    filename: str
    created_at: str
    backup_time_pretty: str
    data_included: str = "Products, Sales, Customers, Settings, Files"
    storage_location: str = "This Device"
    storage_location_type: str = "local"  # "local", "gdrive", "onedrive"
    backup_size_bytes: int
    backup_size_pretty: str
    verification_status: str = "Verified"  # "Verified", "Failed", "Pending"
    sha256_hash: str
    entities_count: Dict[str, int] = Field(default_factory=dict)
    is_restorable: bool = True


class BackupStatusResponse(BaseModel):
    is_protected: bool = True
    protection_title: str = "Your business data is protected"
    protection_subtitle: str = "Backup verified and stored securely"
    last_backup_time_pretty: Optional[str] = "Today, 9:30 AM"
    last_backup_verified: bool = True
    next_scheduled_backup_pretty: Optional[str] = "Today at 8:00 PM"
    automatic_backup_enabled: bool = True
    total_backups_count: int = 0
    latest_backup: Optional[BackupItemInfo] = None


class BackupLogEntry(BaseModel):
    timestamp: str
    level: str = "INFO"  # "INFO", "WARN", "ERROR", "SUCCESS"
    stage: str
    message: str


class BackupLogsResponse(BaseModel):
    job_id: str
    status: str
    logs: List[BackupLogEntry] = Field(default_factory=list)
    total_lines: int = 0


class PreflightCheckResponse(BaseModel):
    passed: bool
    free_space_bytes: int
    free_space_pretty: str
    estimated_required_bytes: int
    estimated_required_pretty: str
    destination_accessible: bool
    destination_path: str
    active_job_running: bool
    active_job_id: Optional[str] = None
    message: str


class BackupJobProgress(BaseModel):
    job_id: str
    status: str = "RUNNING"  # "QUEUED", "RUNNING", "VERIFYING", "SUCCESS", "FAILED", "CANCELLED", "INTERRUPTED"
    stage: str = "preflight"  # preflight, database_backup, app_config, persistent_files, archive_creation, integrity_verification, manifest_finalization, retention_cleanup, completed
    percent: int = 0
    stage_message: str = "Performing preflight system checks"
    initiating_user: str = "System Administrator"
    destination: str = "This Device"
    storage_location_type: str = "local"
    archive_size_bytes: Optional[int] = None
    archive_size_pretty: Optional[str] = None
    process_exit_code: Optional[int] = None
    verification_result: Optional[str] = None
    error_message: Optional[str] = None
    backup_result: Optional[BackupItemInfo] = None
    started_at: str
    updated_at: str
    completed_at: Optional[str] = None
    elapsed_seconds: float = 0.0



class BackupCreateRequest(BaseModel):
    company_id: Optional[str] = None
    storage_location: Optional[str] = "local"  # "local", "gdrive", "onedrive"
    include_files: bool = True


class RestoreReviewRequest(BaseModel):
    backup_id: str


class RestoreReviewResponse(BaseModel):
    backup: BackupItemInfo
    can_restore: bool = True
    warning_title: str = "This will replace your current data"
    warning_body: str = (
        "Your existing products, sales, customers, settings and files will be replaced with the data from this backup."
    )
    pre_restore_snapshot_created: bool = True


class RestoreExecuteRequest(BaseModel):
    backup_id: str
    confirmed_destructive_overwrite: bool = False


class RestoreResultResponse(BaseModel):
    success: bool
    message: str
    restored_at: str
    backup_id: str
    entities_restored: Dict[str, int] = Field(default_factory=dict)
    pre_restore_backup_id: Optional[str] = None


class BackupSettingsConfig(BaseModel):
    automatic_backup_enabled: bool = True
    backup_frequency: str = "daily"  # "daily", "weekly", "monthly"
    storage_location: str = "local"  # "local", "gdrive", "onedrive"
    retention_period: str = "3_months"  # "1_month", "3_months", "6_months", "1_year"
    gdrive_connected: bool = False
    onedrive_connected: bool = False
    last_updated_at: Optional[str] = None


class PruneBackupsRequest(BaseModel):
    retention_override: Optional[str] = None  # e.g. "1_month", "3_months"


class PruneBackupsResponse(BaseModel):
    pruned_count: int
    freed_bytes: int
    freed_bytes_pretty: str
    pruned_backup_ids: List[str] = Field(default_factory=list)
    preserved_backup_id: Optional[str] = None
    message: str


class BackupSchedulerStatusResponse(BaseModel):
    running: bool
    poll_interval_seconds: int
    automatic_backup_enabled: bool
    backup_frequency: str
    retention_period: str
    last_run_at: Optional[str] = None
    next_run_at: Optional[str] = None
    total_automated_runs: int = 0
    last_prune_at: Optional[str] = None
    total_pruned_packages: int = 0

