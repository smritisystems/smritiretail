/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.0
 * Created      : 2026-07-10
 * Modified     : 2026-08-19
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import React, { useMemo } from "react";
import { LedgerScreen } from "./global/ledger/LedgerScreen.tsx";
import { auditLogsConfig } from "./global/ledger/configs/auditLogs.config.tsx";
import { Lock } from "lucide-react";

export const AuditLogsTab: React.FC = () => {
  const memoizedConfig = useMemo(() => auditLogsConfig, []);

  return (
    <div
      role="region"
      aria-label="Enterprise Audit Logs & Compliance Ledger"
      title="Enterprise Audit Logs & Compliance Ledger (en-IN Locale & Currency Compliant)"
      className="w-full h-full sm:px-2 md:px-4 space-y-4"
    >
      {/* REC-10: Tamper-Proof Ledger immutability badge */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/5 border border-emerald-500/20 w-fit">
        <Lock size={13} className="text-emerald-400 shrink-0" />
        <span className="text-[11px] font-semibold text-emerald-400 font-mono">
          Tamper-Proof Ledger
        </span>
        <span className="text-[10px] text-theme-muted font-sans">
          — All entries are write-once and cryptographically immutable. No record can be modified or deleted.
        </span>
      </div>

      <LedgerScreen config={memoizedConfig} />
    </div>
  );
};


