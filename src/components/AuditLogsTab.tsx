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

export const AuditLogsTab: React.FC = () => {
  const memoizedConfig = useMemo(() => auditLogsConfig, []);

  return (
    <div
      role="region"
      aria-label="Enterprise Audit Logs & Compliance Ledger"
      title="Enterprise Audit Logs & Compliance Ledger (en-IN Locale & Currency Compliant)"
      className="w-full h-full sm:px-2 md:px-4 space-y-4"
    >
      <LedgerScreen config={memoizedConfig} />
    </div>
  );
};

