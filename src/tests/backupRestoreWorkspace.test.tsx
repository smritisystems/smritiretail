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

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { BackupRestoreWorkspace } from "../components/backup/BackupRestoreWorkspace.tsx";

// Mock apiFetchV1
vi.mock("../lib/apiFetchV1", () => ({
  apiFetchV1: vi.fn(),
}));

import { apiFetchV1 } from "../lib/apiFetchV1";

describe("BackupRestoreWorkspace Rendering & Interaction Contracts", () => {
  const mockStatus = {
    is_protected: true,
    protection_title: "Your business data is protected",
    protection_subtitle: "Backup verified and stored securely",
    last_backup_time_pretty: "Today, 9:30 AM",
    last_backup_verified: true,
    next_scheduled_backup_pretty: "Today at 8:00 PM",
    automatic_backup_enabled: true,
    total_backups_count: 2,
    latest_backup: {
      id: "bak-001",
      backup_id: "bak-001",
      filename: "backup_001.json.gz",
      created_at: "2026-10-22T04:00:00Z",
      backup_time_pretty: "Today, 9:30 AM",
      data_included: "Products, Sales, Customers, Settings, Files",
      storage_location: "This Device",
      storage_location_type: "local",
      backup_size_bytes: 256000000,
      backup_size_pretty: "245 MB",
      verification_status: "Verified",
      sha256_hash: "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
      is_restorable: true,
    },
  };

  const mockSettings = {
    automatic_backup_enabled: true,
    backup_frequency: "daily",
    storage_location: "local",
    retention_period: "3_months",
    gdrive_connected: false,
    onedrive_connected: false,
  };

  const mockHistory = [
    {
      id: "bak-001",
      backup_id: "bak-001",
      filename: "backup_001.json.gz",
      created_at: "2026-10-22T04:00:00Z",
      backup_time_pretty: "Today, 9:30 AM",
      data_included: "Products, Sales, Customers, Settings, Files",
      storage_location: "Google Drive",
      storage_location_type: "gdrive",
      backup_size_bytes: 256000000,
      backup_size_pretty: "245 MB",
      verification_status: "Verified",
      sha256_hash: "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
      is_restorable: true,
    },
    {
      id: "bak-002",
      backup_id: "bak-002",
      filename: "backup_002.json.gz",
      created_at: "2026-10-21T14:30:00Z",
      backup_time_pretty: "Yesterday, 8:00 PM",
      data_included: "Products, Sales, Customers, Settings, Files",
      storage_location: "Google Drive",
      storage_location_type: "gdrive",
      backup_size_bytes: 251658240,
      backup_size_pretty: "240 MB",
      verification_status: "Verified",
      sha256_hash: "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      is_restorable: true,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (apiFetchV1 as any).mockImplementation((endpoint: string) => {
      if (endpoint === "/backup/status") return Promise.resolve(mockStatus);
      if (endpoint === "/backup/settings") return Promise.resolve(mockSettings);
      if (endpoint === "/backup/history") return Promise.resolve(mockHistory);
      return Promise.resolve({});
    });
  });

  it("1. renders markup with protection banner, 3 primary actions and automatic backup toggle", () => {
    const markup = renderToStaticMarkup(
      <BackupRestoreWorkspace
        initialStatus={mockStatus}
        initialSettings={mockSettings}
        initialHistory={mockHistory}
      />
    );

    // Check header and protection card
    expect(markup).toContain("Backup &amp; Restore");
    expect(markup).toContain("Keep your business data safe and always recoverable");
    expect(markup).toContain("Your business data is protected");
    expect(markup).toContain("Last backup:");
    expect(markup).toContain("Today, 9:30 AM");

    // Check 3 Primary Action Cards
    expect(markup).toContain("Back Up Now");
    expect(markup).toContain("Create a fresh copy of your business data.");
    expect(markup).toContain("Restore My Data");
    expect(markup).toContain("Recover your business from an earlier backup.");
    expect(markup).toContain("Backup Settings");
    expect(markup).toContain("Choose automatic backups and storage.");

    // Check automatic backup row
    expect(markup).toContain("Automatic backup");
    expect(markup).toContain("Next backup:");
    expect(markup).toContain("toggle-auto-backup-btn");
  });

  it("2. ensures action button IDs and accessibility targets exist in the DOM structure", () => {
    const markup = renderToStaticMarkup(
      <BackupRestoreWorkspace
        initialStatus={mockStatus}
        initialSettings={mockSettings}
        initialHistory={mockHistory}
      />
    );
    expect(markup).toContain('id="backup-now-card-btn"');
    expect(markup).toContain('id="restore-data-card-btn"');
    expect(markup).toContain('id="backup-settings-card-btn"');
  });

  it("3. renders Screen 2: Backup in Progress with stepper and cancel button", () => {
    const markup = renderToStaticMarkup(
      <BackupRestoreWorkspace
        initialStatus={mockStatus}
        initialSettings={mockSettings}
        initialHistory={mockHistory}
        initialScreen="backup_progress"
      />
    );
    expect(markup).toContain("Back Up Now");
    expect(markup).toContain("Please keep this window open.");
    expect(markup).toContain("Preparing backup");
    expect(markup).toContain("Creating backup");
    expect(markup).toContain("Verifying backup");
    expect(markup).toContain("Finalizing");
    expect(markup).toContain("Cancel Backup");
  });

  it("4. renders Screen 3: Backup Completed with summary details", () => {
    const markup = renderToStaticMarkup(
      <BackupRestoreWorkspace
        initialStatus={mockStatus}
        initialSettings={mockSettings}
        initialHistory={mockHistory}
        initialScreen="backup_completed"
      />
    );
    expect(markup).toContain("Backup completed successfully!");
    expect(markup).toContain("Your business data has been backed up and verified.");
    expect(markup).toContain("Backup time");
    expect(markup).toContain("Data included");
    expect(markup).toContain("Storage location");
    expect(markup).toContain("Verification");
    expect(markup).toContain("Passed");
    expect(markup).toContain("View Backup History");
    expect(markup).toContain("Back to Home");
  });

  it("5. renders Screen 4: Restore My Data point selector", () => {
    const markup = renderToStaticMarkup(
      <BackupRestoreWorkspace
        initialStatus={mockStatus}
        initialSettings={mockSettings}
        initialHistory={mockHistory}
        initialScreen="restore_select"
      />
    );
    expect(markup).toContain("Restore My Data");
    expect(markup).toContain("Choose a backup to recover your business data.");
    expect(markup).toContain("Today, 9:30 AM");
    expect(markup).toContain("Yesterday, 8:00 PM");
    expect(markup).toContain("Verified");
    expect(markup).toContain("Continue to Review");
  });

  it("6. renders Screen 5: Review and Confirm with destructive warning and checkbox", () => {
    const markup = renderToStaticMarkup(
      <BackupRestoreWorkspace
        initialStatus={mockStatus}
        initialSettings={mockSettings}
        initialHistory={mockHistory}
        initialScreen="restore_confirm"
      />
    );
    expect(markup).toContain("Review and Confirm");
    expect(markup).toContain("Please review the backup details before restoring.");
    expect(markup).toContain("This will replace your current data");
    expect(markup).toContain(
      "Your existing products, sales, customers, settings and files will be replaced"
    );
    expect(markup).toContain(
      "I understand and want to restore my data from this backup."
    );
    expect(markup).toContain('id="restore-confirm-checkbox"');
    expect(markup).toContain('id="execute-restore-btn"');
  });

  it("7. renders Screen 6: Backup Settings with frequency and storage options", () => {
    const markup = renderToStaticMarkup(
      <BackupRestoreWorkspace
        initialStatus={mockStatus}
        initialSettings={mockSettings}
        initialHistory={mockHistory}
        initialScreen="settings"
      />
    );
    expect(markup).toContain("Backup Settings");
    expect(markup).toContain("Choose how your business data is backed up.");
    expect(markup).toContain("Automatic backup");
    expect(markup).toContain("Backup frequency");
    expect(markup).toContain("daily");
    expect(markup).toContain("weekly");
    expect(markup).toContain("monthly");
    expect(markup).toContain("Storage location");
    expect(markup).toContain("Google Drive");
    expect(markup).toContain("OneDrive");
    expect(markup).toContain("This Device");
    expect(markup).toContain("Keep backups for");
  });

  it("8. validates backup history and settings payload mapping contracts", async () => {
    const statusResult = await apiFetchV1("/backup/status");
    expect(statusResult).toEqual(mockStatus);

    const historyResult = await apiFetchV1("/backup/history");
    expect(historyResult).toEqual(mockHistory);
    expect(Array.isArray(historyResult)).toBe(true);
    expect((historyResult as any[]).length).toBe(2);

    const settingsResult = await apiFetchV1("/backup/settings");
    expect(settingsResult).toEqual(mockSettings);
    expect((settingsResult as any).automatic_backup_enabled).toBe(true);
    expect((settingsResult as any).backup_frequency).toBe("daily");
    expect((settingsResult as any).storage_location).toBe("local");
  });
});
