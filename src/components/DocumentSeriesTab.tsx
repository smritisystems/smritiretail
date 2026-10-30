/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS & SMRITI Systems
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.50.3
 * Created      : 2026-07-10
 * Modified     : 2026-10-30
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Target UI    : Document Series Studio & Interactive Numbering Audit Ledger
 */

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  History,
  X,
  Search,
  RefreshCw,
  Download,
  AlertCircle,
  ArrowRight,
  Loader2,
  FileText,
  Clock,
  User
} from "lucide-react";
import { MasterListScreen } from "./global/master/MasterListScreen.tsx";
import { documentSeriesConfig } from "./global/configs/documentSeries.con.tsx";
import { DocumentSeries, NumberingEngine, NumberingAuditLog } from "../services/numberingEngine.ts";

/**
 * Interactive Document Numbering Audit Drawer Component
 */
export const NumberingAuditDrawer: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  const [logs, setLogs] = useState<NumberingAuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAction, setSelectedAction] = useState<string>("ALL");

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await NumberingEngine.getAuditLogsAsync();
      setLogs(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err?.message || "Failed to load numbering audit logs from server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchLogs();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesAction = selectedAction === "ALL" || log.action === selectedAction;
      if (!matchesAction) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        (log.documentNo && log.documentNo.toLowerCase().includes(q)) ||
        (log.seriesName && log.seriesName.toLowerCase().includes(q)) ||
        (log.seriesId && log.seriesId.toLowerCase().includes(q)) ||
        (log.user && log.user.toLowerCase().includes(q)) ||
        (log.action && log.action.toLowerCase().includes(q)) ||
        (log.details && log.details.toLowerCase().includes(q))
      );
    });
  }, [logs, selectedAction, searchQuery]);

  const handleExportCSV = () => {
    if (filteredLogs.length === 0) return;
    const headers = ["Timestamp", "Series ID", "Series Name", "Action", "Document No", "Operator", "Old Value", "New Value", "Details"];
    const rows = filteredLogs.map((l) => [
      `"${l.timestamp || ""}"`,
      `"${l.seriesId || ""}"`,
      `"${(l.seriesName || "").replace(/"/g, '""')}"`,
      `"${l.action || ""}"`,
      `"${l.documentNo || ""}"`,
      `"${l.user || ""}"`,
      `"${l.oldValue || ""}"`,
      `"${l.newValue || ""}"`,
      `"${(l.details || "").replace(/"/g, '""')}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `numbering_audit_ledger_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const actionBadgeClass = (action: string) => {
    switch (action) {
      case "ALLOCATE":
        return "bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border-emerald-500/20";
      case "CREATE":
        return "bg-blue-500/10 text-blue-500 dark:text-blue-400 border-blue-500/20";
      case "UPDATE":
        return "bg-amber-500/10 text-amber-500 dark:text-amber-400 border-amber-500/20";
      case "RESET":
        return "bg-rose-500/10 text-rose-500 dark:text-rose-400 border-rose-500/20";
      default:
        return "bg-gray-500/10 text-gray-400 border-gray-500/20";
    }
  };

  const allocateCount = useMemo(() => logs.filter((l) => l.action === "ALLOCATE").length, [logs]);
  const configChangeCount = useMemo(() => logs.filter((l) => l.action !== "ALLOCATE").length, [logs]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-end overflow-hidden bg-black/40 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0"
          onClick={onClose}
        />

        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="relative z-10 flex flex-col h-full w-full max-w-3xl bg-theme-surface-1 border-l border-theme-divider shadow-2xl overflow-hidden font-sans"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-theme-divider bg-theme-surface-2 shrink-0">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center font-bold text-sm shadow-xs">
                <History size={18} />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-base font-bold text-theme-primary font-display tracking-tight">
                    Document Numbering Audit Ledger
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-theme-surface-3 text-theme-muted border border-theme-divider">
                    {filteredLogs.length} Entries
                  </span>
                </div>
                <p className="text-[11px] text-theme-muted mt-0.5">
                  Authoritative sequential number allocations, adjustments, and resets across all tenant series.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-theme-muted hover:text-theme-primary hover:bg-theme-surface-hover transition-colors cursor-pointer"
              title="Close Drawer (Esc)"
            >
              <X size={16} />
            </button>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-3 gap-2 px-6 py-2.5 bg-theme-surface-1 border-b border-theme-divider text-xs shrink-0">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-mono text-theme-muted">Total Events</span>
              <span className="text-sm font-bold font-mono text-theme-primary">{logs.length}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-mono text-emerald-400">Allocations</span>
              <span className="text-sm font-bold font-mono text-emerald-400">{allocateCount}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-mono text-amber-400">Config Changes</span>
              <span className="text-sm font-bold font-mono text-amber-400">{configChangeCount}</span>
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 px-6 py-3 border-b border-theme-divider bg-theme-surface-2 shrink-0">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by series, document no, operator, action..."
                className="w-full pl-8.5 pr-3 py-1.5 bg-theme-surface-1 border border-theme-divider rounded-lg text-xs text-theme-primary placeholder-theme-muted focus:outline-none focus:border-blue-500 font-mono transition-colors"
              />
            </div>

            <div className="flex items-center space-x-1 overflow-x-auto pb-1 sm:pb-0">
              {["ALL", "ALLOCATE", "CREATE", "UPDATE", "RESET"].map((action) => (
                <button
                  key={action}
                  type="button"
                  onClick={() => setSelectedAction(action)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold font-mono transition-all cursor-pointer whitespace-nowrap ${
                    selectedAction === action
                      ? "bg-blue-600 text-white shadow-xs"
                      : "bg-theme-surface-1 text-theme-muted hover:text-theme-primary border border-theme-divider"
                  }`}
                >
                  {action}
                </button>
              ))}
            </div>

            <div className="flex items-center space-x-1.5 shrink-0">
              <button
                type="button"
                onClick={fetchLogs}
                disabled={loading}
                title="Refresh Ledger"
                className="p-1.5 rounded-lg bg-theme-surface-1 hover:bg-theme-surface-hover text-theme-muted hover:text-theme-primary border border-theme-divider transition-all cursor-pointer disabled:opacity-50"
              >
                <RefreshCw size={13} className={loading ? "animate-spin text-blue-400" : ""} />
              </button>

              <button
                type="button"
                onClick={handleExportCSV}
                disabled={filteredLogs.length === 0}
                title="Export Filtered Logs as CSV"
                className="px-2.5 py-1.5 rounded-lg bg-theme-surface-1 hover:bg-theme-surface-hover text-theme-primary border border-theme-divider transition-all text-[11px] font-bold font-mono flex items-center space-x-1 cursor-pointer disabled:opacity-40"
              >
                <Download size={12} />
                <span>CSV</span>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
            {error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs flex items-center space-x-2">
                <AlertCircle size={15} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 text-theme-muted space-y-2">
                <Loader2 size={24} className="animate-spin text-blue-400" />
                <span className="text-xs font-mono">Fetching sequence audit ledger...</span>
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-theme-muted space-y-2 border border-dashed border-theme-divider rounded-2xl bg-theme-surface-2/30">
                <FileText size={32} className="opacity-40" />
                <span className="text-xs font-mono">No numbering audit records matched the filter.</span>
                <span className="text-[10px] text-theme-muted">
                  Document allocations and series updates will record entries in this immutable ledger.
                </span>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3.5 rounded-xl bg-theme-surface-1 border border-theme-divider hover:border-blue-500/30 transition-all flex flex-col space-y-2 shadow-2xs"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono border ${actionBadgeClass(log.action)}`}>
                          {log.action}
                        </span>
                        <span className="font-mono font-bold text-xs text-theme-primary">
                          {log.documentNo || "N/A"}
                        </span>
                      </div>

                      <div className="flex items-center space-x-2 text-[10px] font-mono text-theme-muted">
                        <span className="flex items-center space-x-1">
                          <Clock size={11} />
                          <span>{log.timestamp ? new Date(log.timestamp).toLocaleString("en-IN") : "—"}</span>
                        </span>
                        <span>•</span>
                        <span className="flex items-center space-x-1">
                          <User size={11} />
                          <span>{log.user || "System"}</span>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-theme-muted pt-1 border-t border-theme-divider/50">
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-theme-primary">{log.seriesName}</span>
                        <span className="text-[10px] font-mono text-theme-muted">({log.seriesId})</span>
                      </div>

                      {(log.oldValue || log.newValue) && (
                        <div className="flex items-center space-x-1.5 font-mono text-[10px] bg-theme-surface-2 px-2 py-0.5 rounded border border-theme-divider">
                          <span className="text-theme-muted line-through">{log.oldValue ?? "0"}</span>
                          <ArrowRight size={10} className="text-blue-400" />
                          <span className="text-emerald-400 font-bold">{log.newValue}</span>
                        </div>
                      )}
                    </div>

                    {log.details && (
                      <p className="text-[11px] text-theme-muted leading-relaxed font-mono bg-theme-surface-2/50 px-2 py-1 rounded">
                        {log.details}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-3.5 border-t border-theme-divider bg-theme-surface-2 shrink-0">
            <span className="text-[11px] font-mono text-theme-muted">
              Showing {filteredLogs.length} of {logs.length} total events
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg text-xs font-bold text-theme-muted hover:text-theme-primary bg-theme-surface-3 hover:bg-theme-surface-hover border border-theme-divider transition-all cursor-pointer"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export const DocumentSeriesTab: React.FC = () => {
  const [isAuditDrawerOpen, setIsAuditDrawerOpen] = useState(false);

  const memoizedConfig = useMemo(() => ({
    ...documentSeriesConfig,
    slots: {
      ...documentSeriesConfig.slots,
      extraHeaderActions: (refetch: () => void, items: DocumentSeries[]) => (
        <>
          {documentSeriesConfig.slots?.extraHeaderActions?.(refetch, items)}
          <button
            type="button"
            onClick={() => setIsAuditDrawerOpen(true)}
            className="px-3.5 py-2.5 rounded-xl bg-theme-surface-2 hover:bg-theme-surface-hover text-theme-primary border border-theme-divider transition-all text-xs font-bold font-mono flex items-center space-x-1.5 cursor-pointer shadow-xs"
            title="View Numbering Allocation & Change Audit Logs"
          >
            <History size={14} className="text-blue-400" />
            <span>Audit History</span>
          </button>
        </>
      )
    }
  }), []);

  return (
    <div
      role="region"
      aria-label="Enterprise Document Numbering Engine"
      title="Enterprise Document Numbering Engine (en-IN Locale & Currency Compliant)"
      className="w-full h-full sm:px-2 md:px-4 space-y-4"
    >
      <MasterListScreen<DocumentSeries>
        config={memoizedConfig}
      />

      <NumberingAuditDrawer
        isOpen={isAuditDrawerOpen}
        onClose={() => setIsAuditDrawerOpen(false)}
      />
    </div>
  );
};
