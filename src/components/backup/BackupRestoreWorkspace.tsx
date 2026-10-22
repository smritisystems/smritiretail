/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 1.0.0
 * Created      : 2026-10-22
 * Modified     : 2026-10-22
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  Clock,
  UploadCloud,
  RotateCcw,
  Settings as SettingsIcon,
  ChevronRight,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  HardDrive,
  Cloud,
  FileCheck2,
  Calendar,
  Database,
  RefreshCw,
  Loader2,
  XCircle,
  Terminal,
} from "lucide-react";
import { apiFetchV1 } from "../../lib/apiFetchV1";

export interface BackupLogEntry {
  timestamp: string;
  level: string;
  stage: string;
  message: string;
}


export interface BackupItemInfo {
  id: string;
  backup_id: string;
  filename: string;
  created_at: string;
  backup_time_pretty: string;
  data_included: string;
  storage_location: string;
  storage_location_type: "local" | "gdrive" | "onedrive";
  backup_size_bytes: number;
  backup_size_pretty: string;
  verification_status: "Verified" | "Failed" | "Pending";
  sha256_hash: string;
  entities_count?: Record<string, number>;
  is_restorable: boolean;
}

export interface BackupStatus {
  is_protected: boolean;
  protection_title: string;
  protection_subtitle: string;
  last_backup_time_pretty: string;
  last_backup_verified: boolean;
  next_scheduled_backup_pretty: string;
  automatic_backup_enabled: boolean;
  total_backups_count: number;
  latest_backup?: BackupItemInfo | null;
}

export interface BackupSettings {
  automatic_backup_enabled: boolean;
  backup_frequency: "daily" | "weekly" | "monthly";
  storage_location: "local" | "gdrive" | "onedrive";
  retention_period: string;
  gdrive_connected: boolean;
  onedrive_connected: boolean;
}

export interface BackupJobProgress {
  job_id: string;
  status: string; // "QUEUED" | "RUNNING" | "VERIFYING" | "SUCCESS" | "FAILED" | "CANCELLED" | "INTERRUPTED" | "in_progress" | "completed" | "failed" | "cancelled"
  stage: string;
  percent: number;
  stage_message: string;
  initiating_user?: string;
  destination?: string;
  storage_location_type?: string;
  archive_size_bytes?: number;
  archive_size_pretty?: string;
  process_exit_code?: number;
  verification_result?: string;
  error_message?: string;
  backup_result?: BackupItemInfo;
  started_at?: string;
  updated_at?: string;
  completed_at?: string;
  elapsed_seconds?: number;
}


type ScreenType =
  | "main"
  | "backup_progress"
  | "backup_completed"
  | "restore_select"
  | "restore_confirm"
  | "settings";
export interface BackupRestoreWorkspaceProps {
  initialStatus?: BackupStatus | null;
  initialSettings?: BackupSettings | null;
  initialHistory?: BackupItemInfo[];
  initialScreen?: ScreenType;
}

export const BackupRestoreWorkspace: React.FC<BackupRestoreWorkspaceProps> = ({
  initialStatus = null,
  initialSettings = null,
  initialHistory = [],
  initialScreen = "main",
}) => {
  const [currentScreen, setCurrentScreen] = useState<ScreenType>(initialScreen);
  const [loadingStatus, setLoadingStatus] = useState<boolean>(!initialStatus);
  const [statusData, setStatusData] = useState<BackupStatus | null>(initialStatus);
  const [history, setHistory] = useState<BackupItemInfo[]>(initialHistory);
  const [settings, setSettings] = useState<BackupSettings>(
    initialSettings || {
      automatic_backup_enabled: true,
      backup_frequency: "daily",
      storage_location: "local",
      retention_period: "3_months",
      gdrive_connected: false,
      onedrive_connected: false,
    }
  );

  // Active Job State & Live Monitoring
  const [activeJob, setActiveJob] = useState<BackupJobProgress | null>(null);
  const [completedBackup, setCompletedBackup] = useState<BackupItemInfo | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [preflightInfo, setPreflightInfo] = useState<{
    passed: boolean;
    free_space_pretty: string;
    destination_path: string;
    message: string;
  } | null>(null);
  const [liveLogs, setLiveLogs] = useState<BackupLogEntry[]>([]);
  const [showLogsConsole, setShowLogsConsole] = useState<boolean>(false);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  // Restore flow state
  const [selectedRestoreId, setSelectedRestoreId] = useState<string | null>(null);
  const [restoreConfirmed, setRestoreConfirmed] = useState<boolean>(false);
  const [restoringInProgress, setRestoringInProgress] = useState<boolean>(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoreSuccessMsg, setRestoreSuccessMsg] = useState<string | null>(null);

  // Load Status, Settings, and Reconcile Active Running Jobs on Mount
  useEffect(() => {
    if (!initialStatus) {
      loadStatusAndSettings();
    }
  }, []);

  const loadStatusAndSettings = async () => {
    setLoadingStatus(true);
    try {
      const [statusRes, settingsRes, historyRes, activeRes] = await Promise.all([
        apiFetchV1<BackupStatus>("/backup/status"),
        apiFetchV1<BackupSettings>("/backup/settings"),
        apiFetchV1<BackupItemInfo[]>("/backup/history"),
        apiFetchV1<BackupJobProgress | null>("/backup/active-job").catch(() => null),
      ]);
      setStatusData(statusRes);
      setSettings(settingsRes);
      setHistory(Array.isArray(historyRes) ? historyRes : []);
      if (Array.isArray(historyRes) && historyRes.length > 0) {
        setSelectedRestoreId(historyRes[0].backup_id);
      }

      // Browser Refresh Resilience: Reconnect to active running job if one is in-flight
      if (
        activeRes &&
        (activeRes.status === "RUNNING" ||
          activeRes.status === "QUEUED" ||
          activeRes.status === "VERIFYING" ||
          activeRes.status === "in_progress")
      ) {
        setActiveJob(activeRes);
        setCurrentScreen("backup_progress");
        pollJobProgress(activeRes.job_id);
      }
    } catch (err) {
      console.error("[BackupWorkspace] Failed to fetch backup metadata", err);
    } finally {
      setLoadingStatus(false);
    }
  };

  // Toggle Automatic Backup directly from Home card
  const handleToggleAutoBackup = async () => {
    if (!settings) return;
    const updated = {
      ...settings,
      automatic_backup_enabled: !settings.automatic_backup_enabled,
    };
    setSettings(updated);
    try {
      await apiFetchV1("/backup/settings", {
        method: "PUT",
        body: JSON.stringify(updated),
      });
      if (statusData) {
        setStatusData({
          ...statusData,
          automatic_backup_enabled: updated.automatic_backup_enabled,
          next_scheduled_backup_pretty: updated.automatic_backup_enabled
            ? "Today at 8:00 PM"
            : "Scheduled backups disabled",
        });
      }
    } catch (err) {
      console.error("Failed to update auto-backup status", err);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // ACTION 1: BACK UP NOW (WITH PREFLIGHT & CONFIRMATION MODAL)
  // ─────────────────────────────────────────────────────────────────────────
  const handleStartBackupNow = async () => {
    try {
      const pf = await apiFetchV1<any>("/backup/preflight");
      setPreflightInfo(pf);
    } catch {
      setPreflightInfo(null);
    }
    setShowConfirmModal(true);
  };

  const confirmAndExecuteBackup = async () => {
    setShowConfirmModal(false);
    setCurrentScreen("backup_progress");
    setLiveLogs([]);
    setElapsedSeconds(0);
    try {
      const job = await apiFetchV1<BackupJobProgress>("/backup/create", {
        method: "POST",
        body: JSON.stringify({
          storage_location: settings.storage_location,
          include_files: true,
        }),
      });
      setActiveJob(job);
      pollJobProgress(job.job_id);
    } catch (err) {
      console.error("Failed to start backup job", err);
    }
  };

  const pollJobProgress = (jobId: string) => {
    const startTime = Date.now();
    const interval = setInterval(async () => {
      try {
        const [updated, logsRes] = await Promise.all([
          apiFetchV1<BackupJobProgress>(`/backup/jobs/${jobId}`),
          apiFetchV1<{ logs: BackupLogEntry[] }>(`/backup/jobs/${jobId}/logs?tail=80`).catch(() => null),
        ]);
        setActiveJob(updated);
        setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
        if (logsRes && Array.isArray(logsRes.logs)) {
          setLiveLogs(logsRes.logs);
        }

        if (updated.status === "completed" || updated.status === "SUCCESS") {
          clearInterval(interval);
          setCompletedBackup(updated.backup_result || null);
          loadStatusAndSettings();
          setTimeout(() => {
            setCurrentScreen("backup_completed");
          }, 800);
        } else if (
          updated.status === "failed" ||
          updated.status === "FAILED" ||
          updated.status === "cancelled" ||
          updated.status === "CANCELLED" ||
          updated.status === "INTERRUPTED"
        ) {
          clearInterval(interval);
        }
      } catch (e) {
        clearInterval(interval);
      }
    }, 600);
  };

  const handleCancelBackup = async () => {
    if (!activeJob) return;
    try {
      await apiFetchV1(`/backup/jobs/${activeJob.job_id}/cancel`, {
        method: "POST",
      });
      setCurrentScreen("main");
    } catch (err) {
      console.error("Cancel failed", err);
    }
  };

  const handleCloseMonitor = () => {
    // Navigates to dashboard without terminating the active background backup
    setCurrentScreen("main");
  };

  const handleRetryBackup = async () => {
    if (!activeJob) return;
    try {
      const retried = await apiFetchV1<BackupJobProgress>(`/backup/jobs/${activeJob.job_id}/retry`, {
        method: "POST",
      });
      setActiveJob(retried);
      setLiveLogs([]);
      pollJobProgress(retried.job_id);
    } catch (err) {
      console.error("Retry failed", err);
    }
  };


  // ─────────────────────────────────────────────────────────────────────────
  // ACTION 2: RESTORE MY DATA
  // ─────────────────────────────────────────────────────────────────────────
  const selectedBackup = history.find(
    (b) => b.backup_id === selectedRestoreId || b.id === selectedRestoreId
  );

  const handleExecuteRestore = async () => {
    if (!selectedRestoreId || !restoreConfirmed) return;
    setRestoringInProgress(true);
    setRestoreError(null);
    try {
      const res = await apiFetchV1<{ success: boolean; message: string }>(
        "/backup/restore/execute",
        {
          method: "POST",
          body: JSON.stringify({
            backup_id: selectedRestoreId,
            confirmed_destructive_overwrite: true,
          }),
        }
      );
      setRestoreSuccessMsg(res.message || "Data restored successfully.");
      setTimeout(() => {
        setRestoringInProgress(false);
        setCurrentScreen("main");
        loadStatusAndSettings();
      }, 1000);
    } catch (err: any) {
      setRestoreError(err?.message || "Restore operation failed.");
      setRestoringInProgress(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // ACTION 3: BACKUP SETTINGS
  // ─────────────────────────────────────────────────────────────────────────
  const handleSaveSettings = async (newSettings: BackupSettings) => {
    setSettings(newSettings);
    try {
      await apiFetchV1("/backup/settings", {
        method: "PUT",
        body: JSON.stringify(newSettings),
      });
      loadStatusAndSettings();
    } catch (err) {
      console.error("Failed to save backup settings", err);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // SCREEN 1: MAIN PROTECTION DASHBOARD
  // ─────────────────────────────────────────────────────────────────────────
  const renderMainScreen = () => {
    const isProtected = statusData ? statusData.is_protected : true;
    const lastBackupTime = statusData ? statusData.last_backup_time_pretty : "Today, 9:30 AM";
    const nextBackup = statusData ? statusData.next_scheduled_backup_pretty : "Today at 8:00 PM";
    const autoOn = settings.automatic_backup_enabled;

    return (
      <div className="max-w-2xl mx-auto space-y-6 pt-4 pb-12 animate-in fade-in duration-200">
        <div>
          <h1 className="text-2xl font-bold text-theme-primary font-display tracking-tight">
            Backup & Restore
          </h1>
          <p className="text-sm text-theme-muted mt-1">
            Keep your business data safe and always recoverable
          </p>
        </div>

        {/* 1. Green Protection Status Card */}
        <div className="bg-[#ECFDF5] dark:bg-emerald-950/40 border border-[#A7F3D0] dark:border-emerald-800/60 rounded-2xl p-5 flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-[#10B981] flex items-center justify-center shrink-0 shadow-sm shadow-emerald-500/20">
            <CheckCircle2 size={28} className="text-white" strokeWidth={2.5} />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-bold text-gray-900 dark:text-emerald-100 font-display">
              {statusData?.protection_title || "Your business data is protected"}
            </h2>
            <p className="text-xs font-medium text-gray-700 dark:text-emerald-300">
              Last backup: <span className="font-semibold">{lastBackupTime}</span>
            </p>
            <p className="text-xs text-gray-500 dark:text-emerald-400">
              Backup verified and stored securely
            </p>
          </div>
        </div>

        {/* 2. Automatic Backup Schedule Toggle Row */}
        <div className="bg-theme-surface-1 border border-theme-divider rounded-2xl px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-600 dark:text-gray-300">
              <Clock size={20} />
            </div>
            <div>
              <p className="text-sm font-semibold text-theme-body font-display">
                Automatic backup
              </p>
              <p className="text-xs text-theme-muted">
                Next backup: {nextBackup}
              </p>
            </div>
          </div>
          <button
            id="toggle-auto-backup-btn"
            onClick={handleToggleAutoBackup}
            className={`w-14 h-8 flex items-center rounded-full p-1 transition-colors duration-200 cursor-pointer ${
              autoOn ? "bg-[#10B981]" : "bg-gray-300 dark:bg-gray-700"
            }`}
            title="Toggle Automatic Backup"
          >
            <div
              className={`bg-white w-6 h-6 rounded-full shadow-md transform transition-transform duration-200 flex items-center justify-center text-[9px] font-bold ${
                autoOn
                  ? "translate-x-6 text-[#10B981]"
                  : "translate-x-0 text-gray-400"
              }`}
            >
              {autoOn ? "ON" : "OFF"}
            </div>
          </button>
        </div>

        {/* 3. Three Primary Action Cards */}
        <div className="space-y-3 pt-1">
          {/* Action 1: Back Up Now */}
          <button
            id="backup-now-card-btn"
            onClick={handleStartBackupNow}
            className="w-full bg-theme-surface-1 hover:bg-theme-surface-2 border border-theme-divider rounded-2xl p-4 flex items-center justify-between group transition-all text-left shadow-sm cursor-pointer"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900/60 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:scale-105 transition-transform">
                <UploadCloud size={24} />
              </div>
              <div>
                <h3 className="text-base font-bold text-theme-primary font-display group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  Back Up Now
                </h3>
                <p className="text-xs text-theme-muted mt-0.5">
                  Create a fresh copy of your business data.
                </p>
              </div>
            </div>
            <ChevronRight size={20} className="text-theme-muted group-hover:text-theme-primary transition-colors" />
          </button>

          {/* Action 2: Restore My Data */}
          <button
            id="restore-data-card-btn"
            onClick={() => setCurrentScreen("restore_select")}
            className="w-full bg-theme-surface-1 hover:bg-theme-surface-2 border border-theme-divider rounded-2xl p-4 flex items-center justify-between group transition-all text-left shadow-sm cursor-pointer"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-900/60 flex items-center justify-center text-purple-600 dark:text-purple-400 group-hover:scale-105 transition-transform">
                <RotateCcw size={22} />
              </div>
              <div>
                <h3 className="text-base font-bold text-theme-primary font-display group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                  Restore My Data
                </h3>
                <p className="text-xs text-theme-muted mt-0.5">
                  Recover your business from an earlier backup.
                </p>
              </div>
            </div>
            <ChevronRight size={20} className="text-theme-muted group-hover:text-theme-primary transition-colors" />
          </button>

          {/* Action 3: Backup Settings */}
          <button
            id="backup-settings-card-btn"
            onClick={() => setCurrentScreen("settings")}
            className="w-full bg-theme-surface-1 hover:bg-theme-surface-2 border border-theme-divider rounded-2xl p-4 flex items-center justify-between group transition-all text-left shadow-sm cursor-pointer"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900/60 flex items-center justify-center text-amber-600 dark:text-amber-400 group-hover:scale-105 transition-transform">
                <SettingsIcon size={22} />
              </div>
              <div>
                <h3 className="text-base font-bold text-theme-primary font-display group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                  Backup Settings
                </h3>
                <p className="text-xs text-theme-muted mt-0.5">
                  Choose automatic backups and storage.
                </p>
              </div>
            </div>
            <ChevronRight size={20} className="text-theme-muted group-hover:text-theme-primary transition-colors" />
          </button>
        </div>

        {/* Create System Backup Confirmation Modal */}
        {showConfirmModal && renderConfirmationModal()}
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // CONFIRMATION MODAL: CREATE SYSTEM BACKUP
  // ─────────────────────────────────────────────────────────────────────────
  const renderConfirmationModal = () => {
    const dest =
      settings.storage_location === "local"
        ? "This Device (Local Host Storage)"
        : settings.storage_location === "gdrive"
        ? "Google Drive"
        : "OneDrive";

    return (
      <div
        id="backup-confirmation-modal"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      >
        <div className="bg-theme-surface-1 border border-theme-divider rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900/60 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
              <UploadCloud size={24} />
            </div>
            <div>
              <h3 className="text-base font-bold text-theme-primary font-display">
                Create System Backup?
              </h3>
              <p className="text-xs text-theme-muted mt-1 leading-relaxed">
                This will create a backup of the configured SMRITI Retail OS databases, application configuration, and required persistent files.
              </p>
            </div>
          </div>

          <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-3.5 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-theme-muted">Configured Destination:</span>
              <span className="font-semibold text-theme-primary">{dest}</span>
            </div>
            <div className="flex items-start justify-between gap-2">
              <span className="text-theme-muted">Backup Scope:</span>
              <span className="font-semibold text-theme-primary text-right">
                PostgreSQL Databases, Config, Persistent Files & Ledgers
              </span>
            </div>
            {preflightInfo && (
              <div className="flex items-center justify-between pt-1 border-t border-theme-divider/40">
                <span className="text-theme-muted">Available Disk Space:</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {preflightInfo.free_space_pretty}
                </span>
              </div>
            )}
          </div>

          <div className="bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 rounded-xl p-3 text-[11px] text-blue-800 dark:text-blue-300">
            <p className="leading-normal">
              Normal billing can continue consistently during the backup operation. Starting a backup does not delete existing data.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              id="backup-confirm-cancel-btn"
              onClick={() => setShowConfirmModal(false)}
              className="px-4 py-2 rounded-xl border border-theme-divider text-xs font-semibold text-theme-muted hover:text-theme-primary hover:bg-theme-surface-2 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="backup-confirm-start-btn"
              onClick={confirmAndExecuteBackup}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-colors cursor-pointer"
            >
              Start Backup
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // SCREEN 2: BACK UP NOW (LIVE MONITOR & REAL-TIME LOGS)
  // ─────────────────────────────────────────────────────────────────────────
  const renderProgressScreen = () => {
    const percent = activeJob ? activeJob.percent : 68;
    const stage = activeJob ? activeJob.stage : "creating";
    const stageMessage = activeJob ? activeJob.stage_message : "Building a secure backup file";
    const jobStatus = activeJob ? activeJob.status : "RUNNING";
    const isFailed = jobStatus === "FAILED" || jobStatus === "INTERRUPTED";
    const isSuccess = jobStatus === "SUCCESS" || jobStatus === "completed";

    const steps = [
      { id: "preflight", label: "Preflight checks", desc: "Checking disk space and permissions" },
      { id: "database_backup", label: "Database backup", desc: "Exporting relational transactional tables" },
      { id: "app_config", label: "Application configuration", desc: "Recording system settings and migration lineage" },
      { id: "persistent_files", label: "Persistent files", desc: "Indexing document attachments and ledgers" },
      { id: "archive_creation", label: "Archive creation", desc: "Building compressed encrypted package" },
      { id: "integrity_verification", label: "Integrity verification", desc: "Verifying SHA-256 and test decompression" },
      { id: "manifest_finalization", label: "Manifest creation", desc: "Writing tamper-evident manifest" },
      { id: "retention_cleanup", label: "Retention cleanup", desc: "Enforcing backup retention policy" },
    ];

    const stageOrder = [
      "preflight",
      "database_backup",
      "app_config",
      "persistent_files",
      "archive_creation",
      "integrity_verification",
      "manifest_finalization",
      "retention_cleanup",
      "completed",
    ];

    const getStepStatus = (stepId: string) => {
      const currentIdx = stageOrder.indexOf(stage);
      const stepIdx = stageOrder.indexOf(stepId);
      if (isSuccess || currentIdx > stepIdx) return "done";
      if (currentIdx === stepIdx) return isFailed ? "failed" : "active";
      return "pending";
    };

    return (
      <div className="max-w-xl mx-auto space-y-6 pt-4 pb-12 animate-in fade-in duration-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={handleCloseMonitor}
              className="p-1.5 rounded-lg text-theme-muted hover:text-theme-primary hover:bg-theme-surface-2 cursor-pointer"
              title="Return to Dashboard (Backup will continue in background)"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h2 className="text-xl font-bold text-theme-primary font-display flex items-center gap-2">
                Back Up Now
                <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-mono font-bold ${
                  isFailed
                    ? "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400"
                    : isSuccess
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                    : "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 animate-pulse"
                }`}>
                  {jobStatus}
                </span>
              </h2>
              <p className="text-xs text-theme-muted">
                {activeJob?.job_id ? `Job ID: ${activeJob.job_id}` : "Creating a backup of your business data."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-theme-muted bg-theme-surface-2 px-2.5 py-1 rounded-lg border border-theme-divider">
              Elapsed: {Math.floor(elapsedSeconds / 60)}m {elapsedSeconds % 60}s
            </span>
          </div>
        </div>

        {/* Progress Card */}
        <div className="bg-theme-surface-1 border border-theme-divider rounded-2xl p-6 sm:p-8 flex flex-col items-center space-y-6 shadow-sm">
          {/* Circular Progress Ring */}
          <div className="relative w-36 h-36 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="42"
                strokeWidth="8"
                className="stroke-gray-100 dark:stroke-gray-800"
                fill="none"
              />
              <circle
                cx="50"
                cy="50"
                r="42"
                strokeWidth="8"
                strokeDasharray={264}
                strokeDashoffset={264 - (264 * percent) / 100}
                strokeLinecap="round"
                className={`transition-all duration-300 ease-out ${
                  isFailed ? "stroke-red-500" : isSuccess ? "stroke-emerald-500" : "stroke-blue-600"
                }`}
                fill="none"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-3xl font-extrabold text-theme-primary font-display">
                {percent}%
              </span>
            </div>
          </div>

          <div className="text-center space-y-1">
            <h3 className="text-base font-bold text-theme-primary font-display">
              {stageMessage}...
            </h3>
            <p className="text-xs text-theme-muted">
              {isFailed ? "Backup process halted." : "Normal billing operations can safely continue."}
            </p>
          </div>

          {/* Failure Alert Box */}
          {isFailed && (
            <div className="w-full bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-xl p-4 text-xs space-y-2 text-red-800 dark:text-red-300">
              <div className="flex items-center gap-2 font-bold">
                <AlertCircle size={16} className="text-red-600 shrink-0" />
                <span>Backup failed or could not be verified.</span>
              </div>
              <p className="text-[11px] text-red-700 dark:text-red-400">
                {activeJob?.error_message || "An unexpected error occurred during execution."}
              </p>
              <p className="text-[11px] text-theme-muted">
                Your previous verified recovery point has been preserved intact.
              </p>
              <div className="pt-2 flex items-center gap-3">
                <button
                  id="retry-backup-btn"
                  onClick={handleRetryBackup}
                  className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-sm cursor-pointer"
                >
                  Retry Backup
                </button>
              </div>
            </div>
          )}

          {/* Real 8-Stage Stepper List */}
          <div className="w-full max-w-md space-y-3 pt-2">
            {steps.map((s) => {
              const st = getStepStatus(s.id);
              return (
                <div key={s.id} className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {st === "done" ? (
                      <CheckCircle2 size={16} className="text-[#10B981]" />
                    ) : st === "failed" ? (
                      <XCircle size={16} className="text-red-500" />
                    ) : st === "active" ? (
                      <div className="w-4 h-4 rounded-full border-2 border-blue-600 flex items-center justify-center animate-pulse">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                      </div>
                    ) : (
                      <div className="w-4 h-4 rounded-full border-2 border-gray-300 dark:border-gray-700" />
                    )}
                  </div>
                  <div>
                    <p
                      className={`text-xs font-semibold ${
                        st === "done"
                          ? "text-[#10B981]"
                          : st === "failed"
                          ? "text-red-500 font-bold"
                          : st === "active"
                          ? "text-blue-600 font-bold"
                          : "text-theme-muted"
                      }`}
                    >
                      {s.label}
                    </p>
                    <p className="text-[11px] text-theme-muted">{s.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Live Structured Logs Collapsible Console */}
          <div className="w-full max-w-md pt-2 border-t border-theme-divider/60">
            <button
              id="toggle-live-logs-btn"
              onClick={() => setShowLogsConsole(!showLogsConsole)}
              className="flex items-center justify-between w-full text-xs font-semibold text-theme-muted hover:text-theme-primary py-1 cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Terminal size={14} />
                <span>Live Process Logs ({liveLogs.length} entries)</span>
              </div>
              <ChevronRight
                size={16}
                className={`transform transition-transform ${showLogsConsole ? "rotate-90" : ""}`}
              />
            </button>

            {showLogsConsole && (
              <div className="mt-2 bg-gray-950 text-gray-200 rounded-xl p-3 font-mono text-[11px] max-h-48 overflow-y-auto space-y-1 shadow-inner border border-gray-800">
                {liveLogs.length === 0 ? (
                  <p className="text-gray-500 italic">Connecting to process log stream...</p>
                ) : (
                  liveLogs.map((log, idx) => (
                    <div key={idx} className="leading-snug flex items-start gap-2">
                      <span className="text-gray-500 shrink-0 text-[10px]">
                        {log.timestamp ? log.timestamp.substring(11, 19) : ""}
                      </span>
                      <span
                        className={`text-[10px] font-bold shrink-0 ${
                          log.level === "SUCCESS"
                            ? "text-emerald-400"
                            : log.level === "WARN"
                            ? "text-amber-400"
                            : log.level === "ERROR"
                            ? "text-red-400"
                            : "text-blue-400"
                        }`}
                      >
                        [{log.stage}]
                      </span>
                      <span className="text-gray-300 break-words">{log.message}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Footer Controls */}
          <div className="flex items-center gap-3 w-full max-w-md pt-2">
            {!isFailed && !isSuccess && (
              <button
                id="cancel-backup-btn"
                onClick={handleCancelBackup}
                className="flex-1 py-2 px-4 rounded-xl border border-theme-divider text-xs font-semibold text-theme-muted hover:text-red-600 hover:bg-theme-surface-2 transition-colors cursor-pointer"
              >
                Cancel Backup
              </button>
            )}
            <button
              id="close-monitor-btn"
              onClick={handleCloseMonitor}
              className="flex-1 py-2 px-4 rounded-xl border border-theme-divider text-xs font-semibold text-theme-muted hover:text-theme-primary hover:bg-theme-surface-2 transition-colors cursor-pointer text-center"
            >
              Close Monitor
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // SCREEN 3: BACKUP COMPLETED
  // ─────────────────────────────────────────────────────────────────────────
  const renderCompletedScreen = () => {
    const item = completedBackup || statusData?.latest_backup;
    const backupTime = item ? item.backup_time_pretty : "Today, 9:30 AM";
    const dataIncluded = item ? item.data_included : "Products, Sales, Customers, Settings, Files";
    const storageLocation = item ? item.storage_location : "This Device";
    const backupSize = item ? item.backup_size_pretty : "245 MB";

    return (
      <div className="max-w-xl mx-auto space-y-6 pt-4 pb-12 animate-in fade-in duration-200">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCurrentScreen("main")}
            className="p-1.5 rounded-lg text-theme-muted hover:text-theme-primary hover:bg-theme-surface-2"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-xl font-bold text-theme-primary font-display">
              Backup Completed
            </h2>
          </div>
        </div>

        <div className="bg-theme-surface-1 border border-theme-divider rounded-2xl p-8 flex flex-col items-center space-y-6 shadow-sm">
          {/* Green Check Icon */}
          <div className="w-16 h-16 rounded-full bg-[#10B981] flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <CheckCircle2 size={36} className="text-white" strokeWidth={2.5} />
          </div>

          <div className="text-center space-y-1">
            <h3 className="text-lg font-bold text-theme-primary font-display">
              Backup completed successfully!
            </h3>
            <p className="text-xs text-theme-muted">
              Your business data has been backed up and verified.
            </p>
          </div>

          {/* Manifest Summary Details Card */}
          <div className="w-full bg-theme-surface-2 border border-theme-divider rounded-xl p-4 space-y-3 text-xs">
            <div className="flex items-center justify-between py-1 border-b border-theme-divider/40">
              <div className="flex items-center gap-2 text-theme-muted">
                <Calendar size={14} />
                <span>Backup time</span>
              </div>
              <span className="font-semibold text-theme-primary">{backupTime}</span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-theme-divider/40">
              <div className="flex items-center gap-2 text-theme-muted">
                <Database size={14} />
                <span>Data included</span>
              </div>
              <span className="font-semibold text-theme-primary truncate max-w-[220px]">
                {dataIncluded}
              </span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-theme-divider/40">
              <div className="flex items-center gap-2 text-theme-muted">
                <Cloud size={14} />
                <span>Storage location</span>
              </div>
              <span className="font-semibold text-theme-primary">{storageLocation}</span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-theme-divider/40">
              <div className="flex items-center gap-2 text-theme-muted">
                <FileCheck2 size={14} />
                <span>Verification</span>
              </div>
              <span className="font-bold text-[#10B981] flex items-center gap-1">
                Passed
              </span>
            </div>

            <div className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2 text-theme-muted">
                <HardDrive size={14} />
                <span>Backup size</span>
              </div>
              <span className="font-semibold text-theme-primary">{backupSize}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="w-full space-y-2 pt-2">
            <button
              onClick={() => setCurrentScreen("restore_select")}
              className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors shadow-sm cursor-pointer"
            >
              View Backup History
            </button>
            <button
              onClick={() => setCurrentScreen("main")}
              className="w-full py-2.5 px-4 rounded-xl border border-theme-divider text-xs font-semibold text-theme-muted hover:text-theme-body hover:bg-theme-surface-2 transition-colors cursor-pointer"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // SCREEN 4: RESTORE MY DATA (STEP 1: SELECTION)
  // ─────────────────────────────────────────────────────────────────────────
  const renderRestoreSelectScreen = () => {
    return (
      <div className="max-w-2xl mx-auto space-y-6 pt-4 pb-12 animate-in fade-in duration-200">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCurrentScreen("main")}
            className="p-1.5 rounded-lg text-theme-muted hover:text-theme-primary hover:bg-theme-surface-2"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-xl font-bold text-theme-primary font-display">
              Restore My Data
            </h2>
            <p className="text-xs text-theme-muted">
              Choose a backup to recover your business data.
            </p>
          </div>
        </div>

        {/* List of Verified Recovery Points */}
        <div className="space-y-3">
          {history.length === 0 ? (
            <div className="bg-theme-surface-1 border border-theme-divider rounded-2xl p-8 text-center space-y-2">
              <p className="text-sm font-semibold text-theme-primary">No backups available yet</p>
              <p className="text-xs text-theme-muted">
                Create a backup to enable recovery points.
              </p>
              <button
                onClick={handleStartBackupNow}
                className="mt-3 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 cursor-pointer"
              >
                Back Up Now
              </button>
            </div>
          ) : (
            history.map((b) => {
              const isSelected = selectedRestoreId === b.backup_id || selectedRestoreId === b.id;
              return (
                <div
                  key={b.id || b.backup_id}
                  onClick={() => setSelectedRestoreId(b.backup_id || b.id)}
                  className={`bg-theme-surface-1 border rounded-2xl p-4 flex items-start gap-4 cursor-pointer transition-all ${
                    isSelected
                      ? "border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/20 dark:bg-blue-950/20"
                      : "border-theme-divider hover:border-theme-primary/40"
                  }`}
                >
                  {/* Custom Radio Button */}
                  <div className="mt-1">
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                        isSelected
                          ? "border-blue-600 bg-blue-600"
                          : "border-gray-400 dark:border-gray-600"
                      }`}
                    >
                      {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                  </div>

                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-theme-primary font-display">
                        {b.backup_time_pretty}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0] dark:bg-emerald-950 dark:border-emerald-800">
                        Verified
                      </span>
                    </div>
                    <p className="text-xs text-theme-muted truncate">{b.data_included}</p>
                    <p className="text-[11px] text-theme-muted font-mono">
                      {b.backup_size_pretty} • {b.storage_location}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {history.length > 0 && (
          <div className="pt-2">
            <button
              id="continue-to-restore-confirm-btn"
              onClick={() => setCurrentScreen("restore_confirm")}
              className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors shadow-sm cursor-pointer"
            >
              Continue to Review
            </button>
          </div>
        )}
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // SCREEN 5: REVIEW AND CONFIRM RESTORE
  // ─────────────────────────────────────────────────────────────────────────
  const renderRestoreConfirmScreen = () => {
    const item = selectedBackup || history[0];
    const backupTime = item ? item.backup_time_pretty : "Today, 9:30 AM";
    const dataIncluded = item ? item.data_included : "Products, Sales, Customers, Settings, Files";
    const storageLocation = item ? item.storage_location : "This Device";
    const backupSize = item ? item.backup_size_pretty : "245 MB";

    return (
      <div className="max-w-xl mx-auto space-y-6 pt-4 pb-12 animate-in fade-in duration-200">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCurrentScreen("restore_select")}
            className="p-1.5 rounded-lg text-theme-muted hover:text-theme-primary hover:bg-theme-surface-2"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-xl font-bold text-theme-primary font-display">
              Review and Confirm
            </h2>
            <p className="text-xs text-theme-muted">
              Please review the backup details before restoring.
            </p>
          </div>
        </div>

        {/* Details Card */}
        <div className="bg-theme-surface-1 border border-theme-divider rounded-2xl p-5 space-y-3 text-xs shadow-sm">
          <div className="flex items-center justify-between py-1.5 border-b border-theme-divider/40">
            <div className="flex items-center gap-2 text-theme-muted">
              <Calendar size={14} />
              <span>Backup time</span>
            </div>
            <span className="font-semibold text-theme-primary">{backupTime}</span>
          </div>

          <div className="flex items-center justify-between py-1.5 border-b border-theme-divider/40">
            <div className="flex items-center gap-2 text-theme-muted">
              <Database size={14} />
              <span>Data included</span>
            </div>
            <span className="font-semibold text-theme-primary truncate max-w-[240px]">
              {dataIncluded}
            </span>
          </div>

          <div className="flex items-center justify-between py-1.5 border-b border-theme-divider/40">
            <div className="flex items-center gap-2 text-theme-muted">
              <Cloud size={14} />
              <span>Storage location</span>
            </div>
            <span className="font-semibold text-theme-primary">{storageLocation}</span>
          </div>

          <div className="flex items-center justify-between py-1.5 border-b border-theme-divider/40">
            <div className="flex items-center gap-2 text-theme-muted">
              <HardDrive size={14} />
              <span>Backup size</span>
            </div>
            <span className="font-semibold text-theme-primary">{backupSize}</span>
          </div>

          <div className="flex items-center justify-between py-1.5">
            <div className="flex items-center gap-2 text-theme-muted">
              <FileCheck2 size={14} />
              <span>Verification</span>
            </div>
            <span className="font-bold text-[#10B981]">Passed</span>
          </div>
        </div>

        {/* Amber Warning Banner */}
        <div className="bg-[#FEF3C7] dark:bg-amber-950/40 border border-[#FCD34D] dark:border-amber-800/60 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle size={20} className="text-[#D97706] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-[#92400E] dark:text-amber-200">
              This will replace your current data
            </h4>
            <p className="text-[11px] text-[#B45309] dark:text-amber-300 leading-relaxed">
              Your existing products, sales, customers, settings and files will be replaced with
              the data from this backup.
            </p>
          </div>
        </div>

        {/* Checkbox confirmation */}
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <input
            id="restore-confirm-checkbox"
            type="checkbox"
            checked={restoreConfirmed}
            onChange={(e) => setRestoreConfirmed(e.target.checked)}
            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 cursor-pointer"
          />
          <span className="text-xs text-theme-body font-medium">
            I understand and want to restore my data from this backup.
          </span>
        </label>

        {restoreError && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 text-xs text-red-600">
            {restoreError}
          </div>
        )}

        {/* Actions */}
        <div className="space-y-2 pt-2">
          <button
            id="execute-restore-btn"
            disabled={!restoreConfirmed || restoringInProgress}
            onClick={handleExecuteRestore}
            className={`w-full py-3 px-4 rounded-xl text-white font-semibold text-xs transition-all shadow-sm flex items-center justify-center gap-2 ${
              restoreConfirmed && !restoringInProgress
                ? "bg-blue-600 hover:bg-blue-700 cursor-pointer"
                : "bg-gray-300 dark:bg-gray-700 cursor-not-allowed opacity-60"
            }`}
          >
            {restoringInProgress ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Restoring Data...</span>
              </>
            ) : (
              <span>Restore My Data</span>
            )}
          </button>
          <button
            onClick={() => setCurrentScreen("main")}
            disabled={restoringInProgress}
            className="w-full py-2.5 px-4 rounded-xl border border-theme-divider text-xs font-semibold text-theme-muted hover:text-theme-body hover:bg-theme-surface-2 transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // SCREEN 6: BACKUP SETTINGS
  // ─────────────────────────────────────────────────────────────────────────
  const renderSettingsScreen = () => {
    return (
      <div className="max-w-xl mx-auto space-y-6 pt-4 pb-12 animate-in fade-in duration-200">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCurrentScreen("main")}
            className="p-1.5 rounded-lg text-theme-muted hover:text-theme-primary hover:bg-theme-surface-2"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-xl font-bold text-theme-primary font-display">
              Backup Settings
            </h2>
            <p className="text-xs text-theme-muted">
              Choose how your business data is backed up.
            </p>
          </div>
        </div>

        {/* 1. Automatic Backup Toggle Card */}
        <div className="bg-theme-surface-1 border border-theme-divider rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#ECFDF5] text-[#10B981] flex items-center justify-center">
              <CheckCircle2 size={24} />
            </div>
            <div>
              <p className="text-sm font-bold text-theme-primary font-display">
                Automatic backup
              </p>
              <p className="text-xs text-theme-muted">
                Your data will be backed up automatically.
              </p>
            </div>
          </div>
          <button
            onClick={() =>
              handleSaveSettings({
                ...settings,
                automatic_backup_enabled: !settings.automatic_backup_enabled,
              })
            }
            className={`w-12 h-7 flex items-center rounded-full p-1 transition-colors duration-200 cursor-pointer ${
              settings.automatic_backup_enabled
                ? "bg-[#10B981]"
                : "bg-gray-300 dark:bg-gray-700"
            }`}
          >
            <div
              className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform duration-200 flex items-center justify-center text-[8px] font-bold ${
                settings.automatic_backup_enabled
                  ? "translate-x-5 text-[#10B981]"
                  : "translate-x-0 text-gray-400"
              }`}
            >
              {settings.automatic_backup_enabled ? "ON" : "OFF"}
            </div>
          </button>
        </div>

        {/* 2. Backup Frequency Segmented Control */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-theme-primary font-display">
            Backup frequency
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(["daily", "weekly", "monthly"] as const).map((freq) => {
              const isSelected = settings.backup_frequency === freq;
              return (
                <button
                  key={freq}
                  onClick={() =>
                    handleSaveSettings({
                      ...settings,
                      backup_frequency: freq,
                    })
                  }
                  className={`py-2 px-3 rounded-xl border text-xs font-semibold capitalize flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    isSelected
                      ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/40 text-blue-600 font-bold"
                      : "border-theme-divider bg-theme-surface-1 text-theme-muted hover:text-theme-body"
                  }`}
                >
                  {isSelected && <CheckCircle2 size={13} className="text-blue-600" />}
                  <span>{freq}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Storage Location Radio Options */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-theme-primary font-display">
            Storage location
          </label>
          <div className="space-y-2">
            {/* Google Drive */}
            <div
              onClick={() =>
                handleSaveSettings({
                  ...settings,
                  storage_location: "gdrive",
                })
              }
              className={`bg-theme-surface-1 border rounded-xl p-3 flex items-center gap-3 cursor-pointer transition-all ${
                settings.storage_location === "gdrive"
                  ? "border-blue-500 bg-blue-50/20 dark:bg-blue-950/20"
                  : "border-theme-divider hover:border-theme-primary/40"
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                  settings.storage_location === "gdrive"
                    ? "border-blue-600 bg-blue-600"
                    : "border-gray-400"
                }`}
              >
                {settings.storage_location === "gdrive" && (
                  <div className="w-1.5 h-1.5 rounded-full bg-white" />
                )}
              </div>
              <Cloud size={18} className="text-blue-500" />
              <div>
                <p className="text-xs font-bold text-theme-primary">Google Drive</p>
                <p className="text-[11px] text-theme-muted">
                  Store backups securely in your Google Drive.
                </p>
              </div>
            </div>

            {/* OneDrive */}
            <div
              onClick={() =>
                handleSaveSettings({
                  ...settings,
                  storage_location: "onedrive",
                })
              }
              className={`bg-theme-surface-1 border rounded-xl p-3 flex items-center gap-3 cursor-pointer transition-all ${
                settings.storage_location === "onedrive"
                  ? "border-blue-500 bg-blue-50/20 dark:bg-blue-950/20"
                  : "border-theme-divider hover:border-theme-primary/40"
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                  settings.storage_location === "onedrive"
                    ? "border-blue-600 bg-blue-600"
                    : "border-gray-400"
                }`}
              >
                {settings.storage_location === "onedrive" && (
                  <div className="w-1.5 h-1.5 rounded-full bg-white" />
                )}
              </div>
              <Cloud size={18} className="text-sky-500" />
              <div>
                <p className="text-xs font-bold text-theme-primary">OneDrive</p>
                <p className="text-[11px] text-theme-muted">
                  Store backups securely in your OneDrive.
                </p>
              </div>
            </div>

            {/* This Device */}
            <div
              onClick={() =>
                handleSaveSettings({
                  ...settings,
                  storage_location: "local",
                })
              }
              className={`bg-theme-surface-1 border rounded-xl p-3 flex items-center gap-3 cursor-pointer transition-all ${
                settings.storage_location === "local"
                  ? "border-blue-500 bg-blue-50/20 dark:bg-blue-950/20"
                  : "border-theme-divider hover:border-theme-primary/40"
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                  settings.storage_location === "local"
                    ? "border-blue-600 bg-blue-600"
                    : "border-gray-400"
                }`}
              >
                {settings.storage_location === "local" && (
                  <div className="w-1.5 h-1.5 rounded-full bg-white" />
                )}
              </div>
              <HardDrive size={18} className="text-gray-500" />
              <div>
                <p className="text-xs font-bold text-theme-primary">This Device</p>
                <p className="text-[11px] text-theme-muted">
                  Store backups on this computer or server.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 4. Keep Backups For Dropdown */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-theme-primary font-display">
            Keep backups for
          </label>
          <select
            value={settings.retention_period}
            onChange={(e) =>
              handleSaveSettings({
                ...settings,
                retention_period: e.target.value,
              })
            }
            className="w-full bg-theme-surface-1 border border-theme-divider rounded-xl px-3 py-2 text-xs font-medium text-theme-body focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="1_month">1 month</option>
            <option value="3_months">3 months (Recommended)</option>
            <option value="6_months">6 months</option>
            <option value="1_year">1 year</option>
          </select>
          <p className="text-[11px] text-theme-muted">
            Older backups will be automatically deleted.
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-full bg-theme-base p-6">
      {loadingStatus ? (
        <div className="flex flex-col items-center justify-center h-96 space-y-3">
          <Loader2 size={32} className="animate-spin text-blue-600" />
          <p className="text-xs font-mono text-theme-muted">Loading backup status...</p>
        </div>
      ) : currentScreen === "backup_progress" ? (
        renderProgressScreen()
      ) : currentScreen === "backup_completed" ? (
        renderCompletedScreen()
      ) : currentScreen === "restore_select" ? (
        renderRestoreSelectScreen()
      ) : currentScreen === "restore_confirm" ? (
        renderRestoreConfirmScreen()
      ) : currentScreen === "settings" ? (
        renderSettingsScreen()
      ) : (
        renderMainScreen()
      )}
    </div>
  );
};
