/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.99.0
 * Created      : 2026-10-19
 * Modified     : 2026-10-19
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Target UI    : EDI & Integration Activity Logs Modal
  * Capability    : withCapability("customer.crud", "CRM")
 */

import React from "react";
import { X, CheckCircle2, Clock, AlertCircle, RefreshCw, FileText } from "lucide-react";

interface IntegrationLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerCode?: string;
}

export const IntegrationLogsModal: React.FC<IntegrationLogsModalProps> = ({
  isOpen,
  onClose,
  customerCode = "RRL-001"
}) => {
  if (!isOpen) return null;

  const mockLogs = [
    {
      id: "log-1",
      timestamp: "15 Oct 2026 14:30:22",
      feedType: "B2B_INVOICE_DISPATCH_CSV",
      recordsCount: 45,
      status: "Success",
      hash: "8f7a2b91c4d3",
      details: "Processed multi-store invoice dispatch batch for 45 retail stores."
    },
    {
      id: "log-2",
      timestamp: "14 Oct 2026 18:15:05",
      feedType: "STORE_MASTER_NETWORK_SYNC",
      recordsCount: 67,
      status: "Success",
      hash: "3c9e1a55f802",
      details: "Automated network sync synchronized 67 store delivery locations."
    },
    {
      id: "log-3",
      timestamp: "13 Oct 2026 09:45:12",
      feedType: "CREDIT_EXPOSURE_REFRESH",
      recordsCount: 1,
      status: "Success",
      hash: "e44d0188bb39",
      details: "Updated party ledger balance and credit limit parameters."
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-[#1e222d] border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2">
            <RefreshCw size={18} className="text-[#00355f] dark:text-[#8ebdf9]" />
            <div>
              <h3 className="font-bold text-sm text-[#00355f] dark:text-[#8ebdf9]">
                Integration &amp; EDI Data Exchange Logs
              </h3>
              <span className="text-[10px] text-slate-500 font-mono">
                Customer Account: {customerCode}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto max-h-[60vh] space-y-3 text-xs">
          <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="p-2.5">Timestamp</th>
                  <th className="p-2.5">Feed Type</th>
                  <th className="p-2.5 text-center">Records</th>
                  <th className="p-2.5">Status</th>
                  <th className="p-2.5">Summary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
                {mockLogs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                    <td className="p-2.5 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {log.timestamp}
                    </td>
                    <td className="p-2.5 font-bold text-slate-800 dark:text-slate-200">
                      {log.feedType}
                    </td>
                    <td className="p-2.5 text-center text-slate-600 dark:text-slate-400">
                      {log.recordsCount}
                    </td>
                    <td className="p-2.5 font-sans">
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 size={12} />
                        {log.status}
                      </span>
                    </td>
                    <td className="p-2.5 font-sans text-slate-600 dark:text-slate-400">
                      {log.details}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-[#00355f] text-white rounded-xl text-xs font-bold hover:bg-[#0f4c81] transition shadow-xs"
          >
            Close Logs
          </button>
        </div>

      </div>
    </div>
  );
};
