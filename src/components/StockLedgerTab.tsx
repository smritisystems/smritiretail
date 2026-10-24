/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.99.0
 * Created      : 2026-07-10
 * Modified     : 2026-10-20
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import React, { useState } from "react";
import { ShieldAlert } from "lucide-react";
import { LedgerScreen } from "./global/ledger/LedgerScreen.tsx";
import { stockLedgerConfig } from "./global/ledger/configs/stockLedger.config.tsx";
import { StockReconciliationAuditModal } from "./inventory/StockReconciliationAuditModal.tsx";

interface StockLedgerTabProps {
  currentUser?: { role: string; name: string } | null;
}

export const StockLedgerTab: React.FC<StockLedgerTabProps> = () => {
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);

  return (
    <div className="relative w-full h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800 text-xs text-slate-300">
        <div className="flex items-center space-x-2">
          <span className="font-semibold text-slate-200">Stock Movement Ledger</span>
          <span className="text-slate-500">•</span>
          <span className="text-slate-400">Authoritative Physical & Transaction Audit Trail</span>
        </div>
        <button
          onClick={() => setIsAuditModalOpen(true)}
          className="flex items-center space-x-1.5 px-3 py-1 rounded-md bg-indigo-600/90 hover:bg-indigo-600 text-white font-medium text-xs shadow-sm transition"
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>Reconciliation Audit & Diagnostics</span>
        </button>
      </div>

      <div className="flex-1 overflow-hidden">
        <LedgerScreen config={stockLedgerConfig} />
      </div>

      <StockReconciliationAuditModal
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
      />
    </div>
  );
};

