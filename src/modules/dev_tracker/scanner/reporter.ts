/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 *
 * Founders
 *
 * * Pushpa Devi Jawahar Mallah
 *   * Founder & Chairperson
 *   * Phone: +91 9324117007
 *   * Email: founder@aitdl.com
 *
 * * Jawahar Ramkripal Mallah
 *   * Founder, Chief Executive Officer (CEO) & Chief Software Architect
 *   * Email: founder@aitdl.com
 *
 * * Websites: smritisys.com | aitdl.com | erpnbook.com | smritibooks.com
 *
 * * Version    : 1.0.0
 * * Created    : 2026-07-11
 * * Modified   : 2026-07-11
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

import fs from "fs";
import path from "path";
import { ScanResult, ScanHistoryEntry } from "../models/interfaces.ts";
import * as templates from "./markdown.ts";

export function writeReports(res: ScanResult): void {
  const rootDir = process.cwd();
  const dateStr = new Date().toISOString().split("T")[0];
  const reportsDir = path.join(rootDir, "docs", "reports", dateStr);
  const historyFilePath = path.join(rootDir, "docs", "reports", "history.json");

  // 1. Create reports directory
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  // 2. Manage and write history.json
  let history: ScanHistoryEntry[] = [];
  try {
    if (fs.existsSync(historyFilePath)) {
      history = JSON.parse(fs.readFileSync(historyFilePath, "utf8"));
    }
  } catch (e) {
    console.error("[SDIC Reporter] Failed to read history.json, creating a new file:", e);
  }

  const newHistoryEntry: ScanHistoryEntry = {
    timestamp: res.timestamp,
    dhi: res.releaseScores.dhi,
    developmentScore: res.releaseScores.developmentScore,
    qualityScore: res.releaseScores.qualityScore,
    releaseScore: res.releaseScores.releaseScore,
    securityScore: res.releaseScores.securityScore,
    testCoverage: res.releaseScores.testCoverage,
    documentation: res.releaseScores.documentation
  };

  // Add only if not already added in the last 1 minute (to prevent duplicate entries during dev loops)
  const lastEntry = history[history.length - 1];
  if (!lastEntry || new Date(res.timestamp).getTime() - new Date(lastEntry.timestamp).getTime() > 1000 * 60) {
    history.push(newHistoryEntry);
    res.history = history; // Sync current scan result
    fs.writeFileSync(historyFilePath, JSON.stringify(history, null, 2), "utf8");
  }

  // 3. Generate and write the 15 reports
  const reportsList = [
    { name: "DEVELOPMENT_STATUS.md", content: templates.generateDevelopmentStatus(res) },
    { name: "EXECUTIVE_SUMMARY.md", content: templates.generateExecutiveSummary(res) },
    { name: "MODULE_PROGRESS.md", content: templates.generateModuleProgress(res) },
    { name: "FEATURE_MATRIX.md", content: templates.generateFeatureMatrix(res) },
    { name: "UI_STATUS.md", content: templates.generateUiStatus(res) },
    { name: "BACKEND_STATUS.md", content: templates.generateBackendStatus(res) },
    { name: "DATABASE_STATUS.md", content: templates.generateDatabaseStatus(res) },
    { name: "API_STATUS.md", content: templates.generateApiStatus(res) },
    { name: "TEST_STATUS.md", content: templates.generateTestStatus(res) },
    { name: "DOCUMENTATION_STATUS.md", content: templates.generateDocumentationStatus(res) },
    { name: "SECURITY_STATUS.md", content: templates.generateSecurityStatus(res) },
    { name: "TECHNICAL_DEBT.md", content: templates.generateTechnicalDebt(res) },
    { name: "BUG_TRACKER.md", content: templates.generateBugTracker(res) },
    { name: "RELEASE_READINESS.md", content: templates.generateReleaseReadiness(res) },
    { name: "CHANGE_HISTORY.md", content: templates.generateChangeHistory(res) }
  ];

  // Write reports to timestamped docs/reports/YYYY-MM-DD/ directory
  for (const report of reportsList) {
    const reportPath = path.join(reportsDir, report.name);
    fs.writeFileSync(reportPath, report.content, "utf8");
  }

  // Also write the master DEVELOPMENT_STATUS.md to the workspace root for direct access
  const rootDevStatusPath = path.join(rootDir, "DEVELOPMENT_STATUS.md");
  fs.writeFileSync(rootDevStatusPath, templates.generateDevelopmentStatus(res), "utf8");
}
