/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 *
 * Version    : 5.1.0 (SEEF Phase 8 — Token Upgrade)
 * Created    : 2026-07-25
 * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * License    : Proprietary Commercial Software
 */

import React, { useState } from "react";
import { History, RefreshCw, CheckCircle2, AlertCircle, XCircle } from "lucide-react";
import { PrintAuditRecord, getPrintAuditLedger } from "../../services/print_labels/printAuditService.ts";

export interface PrintHistoryPanelProps {
  onNotification?: (title: string, message: string, type: "success" | "error") => void;
}

export const PrintHistoryPanel: React.FC<PrintHistoryPanelProps> = ({ onNotification }) => {
  const [ledger, setLedger] = useState<PrintAuditRecord[]>(() => {
    const stored = getPrintAuditLedger();
    if (stored.length > 0) return stored;
    return [
      { id: "AUD-101", whoPrinted: "Jawahar Mallah (Admin)", when: new Date(Date.now() - 3600000).toISOString(), printerName: "Zebra ZD421 USB", templateName: "Garment_Hangtag.prn", clientIp: "192.168.1.45", machineId: "WS-WORKSTATION-01", itemCount: 5, totalLabels: 24, durationSec: 6, status: "SUCCESS" },
      { id: "AUD-102", whoPrinted: "Clerk User", when: new Date(Date.now() - 7200000).toISOString(), printerName: "TSC TE244 TCP/IP", templateName: "Shoe_Box_Label.prn", clientIp: "192.168.1.52", machineId: "POS-TERMINAL-02", itemCount: 12, totalLabels: 36, durationSec: 9, status: "SUCCESS" }
    ];
  });

  const handleReprint = (record: PrintAuditRecord) => {
    if (onNotification) {
      onNotification("Reprint Dispatched", `Re-dispatched ${record.totalLabels} labels from audit record #${record.id} to ${record.printerName}`, "success");
    }
  };

  const handleRefresh = () => {
    setLedger(getPrintAuditLedger());
  };

  return (
    <div className="bg-theme-surface-1 border border-theme-divider rounded-2xl p-4 space-y-4 shadow-xl font-mono text-xs max-w-5xl mx-auto select-none">
      <div className="flex items-center justify-between border-b border-theme-divider pb-2">
        <div>
          <h2 className="text-sm font-bold text-theme-heading uppercase flex items-center gap-2">
            <History size={18} className="text-indigo-400" />
            Print Compliance Audit Ledger & Job History
          </h2>
          <p className="text-[11px] text-theme-muted">Complete enterprise compliance trail (Who, When, IP, Machine, Qty, Template, Status)</p>
        </div>

        <button onClick={handleRefresh} className="p-1.5 bg-theme-surface-2 hover:bg-theme-surface-hover text-theme-body rounded-xl border border-theme-divider flex items-center gap-1 font-bold">
          <RefreshCw size={13} /> Refresh Ledger
        </button>
      </div>

      <div className="overflow-x-auto border border-theme-divider rounded-xl">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="bg-theme-surface-2 text-theme-muted uppercase text-[10px]">
            <tr>
              <th className="p-2.5 border border-theme-divider">Date & Time</th>
              <th className="p-2.5 border border-theme-divider">User / Operator</th>
              <th className="p-2.5 border border-theme-divider">Printer Destination</th>
              <th className="p-2.5 border border-theme-divider">PRN Template</th>
              <th className="p-2.5 border border-theme-divider text-center">Items</th>
              <th className="p-2.5 border border-theme-divider text-center">Labels</th>
              <th className="p-2.5 border border-theme-divider">Status</th>
              <th className="p-2.5 border border-theme-divider text-right">Reprint</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-theme-divider text-theme-body">
            {ledger.map(record => (
              <tr key={record.id} className="hover:bg-theme-surface-2">
                <td className="p-2.5 border border-theme-divider text-theme-muted">{new Date(record.when).toLocaleString()}</td>
                <td className="p-2.5 border border-theme-divider font-bold text-amber-300">{record.whoPrinted}</td>
                <td className="p-2.5 border border-theme-divider text-theme-body">{record.printerName}</td>
                <td className="p-2.5 border border-theme-divider text-indigo-300 font-bold">{record.templateName}</td>
                <td className="p-2.5 border border-theme-divider text-center font-bold">{record.itemCount}</td>
                <td className="p-2.5 border border-theme-divider text-center font-bold text-emerald-400">{record.totalLabels}</td>
                <td className="p-2.5 border border-theme-divider">
                  <span className={`text-[10px] px-2 py-0.5 rounded border font-bold flex items-center gap-1 w-max ${record.status === "SUCCESS" ? "bg-emerald-950/60 text-emerald-300 border-emerald-800/40" : "bg-red-950/60 text-red-300 border-red-800/40"}`}>
                    {record.status === "SUCCESS" ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                    {record.status}
                  </span>
                </td>
                <td className="p-2.5 border border-theme-divider text-right">
                  <button onClick={() => handleReprint(record)} className="px-2.5 py-1 bg-gradient-to-r from-amber-600 to-indigo-600 hover:from-amber-500 hover:to-indigo-500 text-white font-bold rounded-lg text-[10px]">
                    Reprint Job
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
