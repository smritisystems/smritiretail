/**
 * Project      : SMRITI Retail OS
 * Module       : Zone H — System Status Bar Component
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * Version      : 5.4.0
 */

import React, { useState, useEffect } from "react";
import { Database, Printer, RefreshCw, ShieldCheck, Cpu } from "lucide-react";
import { getSystemStatusSnapshot, SystemStatusSnapshot } from "../services/launchpadService.ts";

export const StatusBar: React.FC = () => {
  const [status, setStatus] = useState<SystemStatusSnapshot>({
    version: "v5.4.0",
    financialYear: "2026-2027",
    companyName: "SMRITI Enterprise HQ",
    branchName: "Main Store",
    databaseStatus: "Operational",
    printerStatus: "Ready",
    syncStatus: "Synced",
    licenseType: "Enterprise Offline",
    aiStatus: "Disabled (Rule AI-001)"
  });

  useEffect(() => {
    getSystemStatusSnapshot().then(setStatus);
  }, []);

  return (
    <div className="pt-4 border-t border-theme-divider flex flex-col md:flex-row items-center justify-between text-xs text-theme-muted gap-3 font-mono">
      <div className="flex flex-wrap items-center gap-4">
        <span>© SMRITIBooks.com — SMRITI Retail OS ({status.version})</span>
        <span>•</span>
        <span>FY: <strong>{status.financialYear}</strong></span>
        <span>•</span>
        <span>License: <strong>{status.licenseType}</strong></span>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
          <Database className="w-3.5 h-3.5" /> DB: {status.databaseStatus}
        </span>
        <span className="flex items-center gap-1 text-sky-600 dark:text-sky-400">
          <Printer className="w-3.5 h-3.5" /> Thermal Printer: {status.printerStatus}
        </span>
        <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400">
          <RefreshCw className="w-3.5 h-3.5" /> Sync: {status.syncStatus}
        </span>
        <span className="flex items-center gap-1 text-purple-600 dark:text-purple-400">
          <Cpu className="w-3.5 h-3.5" /> AI: {status.aiStatus}
        </span>
      </div>
    </div>
  );
};
