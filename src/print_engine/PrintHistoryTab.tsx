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
 * * Websites: aitdl.com | erpnbook.com | smritibooks.com
 *
 * * Version    : 2.1.2
 * * Created    : 2026-07-10
 * * Modified   : 2026-07-11
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

import React, { useState, useMemo } from "react";
import { 
  Printer, 
  Search, 
  Trash2, 
  Filter, 
  Clock, 
  Database, 
  FileText, 
  RotateCcw, 
  Eye, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Sliders,
  Calendar,
  Layers,
  ChevronRight,
  Sparkles,
  RefreshCw
} from "lucide-react";
import { usePrintEngine, PrintHistoryItem } from "./print_store.tsx";
import { SmritiScrollArea } from "../components/SmritiScrollArea.tsx";

const MOCK_DATA = {
  invoiceNo: "INV-2023-0891",
  date: "2023-10-25",
  companyName: "SMRITI Enterprise Co.",
  customerName: "Acme Corp Ltd.",
  items: [
    { name: "Wireless Keyboard", qty: 2, rate: 45.00 },
    { name: "Optical Mouse", qty: 5, rate: 15.50 },
    { name: "USB-C Hub", qty: 1, rate: 25.00 }
  ],
  subtotal: 192.50,
  tax: 17.32,
  total: 209.82,
  cashier: "John D.",
  paymentMethod: "CARD",
  paid: 209.82
};

export const PrintHistoryTab: React.FC = () => {
  const { printHistory, clearPrintHistory, print, printerStatus } = usePrintEngine();
  
  // Search and filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "success" | "warning" | "failed">("all");
  const [formatFilter, setFormatFilter] = useState<"all" | "A4" | "Thermal80mm" | "Label">("all");
  
  // Detail Modal view
  const [selectedLog, setSelectedLog] = useState<PrintHistoryItem | null>(null);

  // Filtered print logs
  const filteredLogs = useMemo(() => {
    return printHistory.filter(log => {
      const matchesSearch = 
        log.documentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.templateName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.printerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.timestamp.toLowerCase().includes(searchTerm.toLowerCase());
        
      const matchesStatus = statusFilter === "all" || log.status === statusFilter;
      const matchesFormat = formatFilter === "all" || log.format === formatFilter;
      
      return matchesSearch && matchesStatus && matchesFormat;
    });
  }, [printHistory, searchTerm, statusFilter, formatFilter]);

  // Analytics Calculations
  const stats = useMemo(() => {
    const total = printHistory.length;
    const successes = printHistory.filter(l => l.status === "success").length;
    const warnings = printHistory.filter(l => l.status === "warning").length;
    const failures = printHistory.filter(l => l.status === "failed").length;
    const successRate = total > 0 ? Math.round((successes / total) * 100) : 100;
    
    return {
      total,
      successes,
      warnings,
      failures,
      successRate
    };
  }, [printHistory]);

  const handleReprint = (log: PrintHistoryItem) => {
    print({
      templateId: log.templateId,
      data: MOCK_DATA
    });
  };

  return (
    <div className="flex flex-col h-full bg-theme-base font-sans overflow-hidden text-theme-body">
      {/* Top Header */}
      <div className="p-4 border-b border-theme-divider bg-theme-surface-1 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-500/10 text-blue-500 rounded-xl border border-blue-500/20">
            <Clock size={20} className="animate-pulse" />
          </div>
          <div>
            <h1 className="text-base font-bold font-display text-theme-primary flex items-center gap-2">
              Print Spooler & Logs
              <span className="text-[9px] uppercase bg-blue-500/10 border border-blue-500/25 text-blue-400 px-1.5 py-0.5 rounded font-mono font-bold">
                AITDL Hardware Engine v2
              </span>
            </h1>
            <p className="text-[10px] text-theme-muted uppercase tracking-wider font-mono">
              Audit trails, recently printed document caches, and route history
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Active Printer Brief Indicator */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-theme-surface-2 border border-theme-divider rounded-lg">
            <div className={`w-2 h-2 rounded-full ${
              printerStatus.status === "ready" ? "bg-emerald-500" : printerStatus.status === "busy" ? "bg-amber-500 animate-pulse" : "bg-rose-500"
            }`} />
            <div className="text-[10px] font-mono">
              <span className="text-theme-muted">ACTIVE:</span>{" "}
              <span className="font-bold text-theme-primary">{printerStatus.activePrinter?.name || "None Selected"}</span>
            </div>
          </div>

          <button
            onClick={clearPrintHistory}
            disabled={printHistory.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg text-xs font-semibold transition-all border border-rose-500/20 cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
          >
            <Trash2 size={13} />
            Purge Spool Log
          </button>
        </div>
      </div>

      {/* Analytics Bento Grid Row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 p-4 shrink-0 bg-theme-surface-2/40 border-b border-theme-divider">
        {/* Card 1: Total Jobs */}
        <div className="bg-theme-surface-1 border border-theme-divider p-3.5 rounded-xl shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-theme-muted font-mono uppercase tracking-wider block">Jobs Spooled</span>
            <span className="text-xl font-bold font-mono text-theme-primary block leading-none">{stats.total}</span>
          </div>
          <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg border border-blue-500/10">
            <Database size={16} />
          </div>
        </div>

        {/* Card 2: Success Rate */}
        <div className="bg-theme-surface-1 border border-theme-divider p-3.5 rounded-xl shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-theme-muted font-mono uppercase tracking-wider block">Success Rate</span>
            <span className="text-xl font-bold font-mono text-emerald-400 block leading-none">{stats.successRate}%</span>
          </div>
          <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg border border-emerald-500/10">
            <CheckCircle2 size={16} />
          </div>
        </div>

        {/* Card 3: Warnings */}
        <div className="bg-theme-surface-1 border border-theme-divider p-3.5 rounded-xl shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-theme-muted font-mono uppercase tracking-wider block">Warnings</span>
            <span className="text-xl font-bold font-mono text-amber-500 block leading-none">{stats.warnings}</span>
          </div>
          <div className="p-2 bg-amber-500/10 text-amber-500 rounded-lg border border-amber-500/10">
            <AlertTriangle size={16} />
          </div>
        </div>

        {/* Card 4: Hardware Faults */}
        <div className="bg-theme-surface-1 border border-theme-divider p-3.5 rounded-xl shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-theme-muted font-mono uppercase tracking-wider block">Faults/Offline</span>
            <span className="text-xl font-bold font-mono text-rose-500 block leading-none">{stats.failures}</span>
          </div>
          <div className="p-2 bg-rose-500/10 text-rose-500 rounded-lg border border-rose-500/10">
            <XCircle size={16} />
          </div>
        </div>

        {/* Card 5: Real-time Signal status */}
        <div className="col-span-2 lg:col-span-1 bg-theme-surface-1 border border-theme-divider p-3.5 rounded-xl shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-theme-muted font-mono uppercase tracking-wider block">Spooler Signal</span>
            <span className="text-xs font-semibold text-theme-primary flex items-center gap-1">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Telemetry Live
            </span>
          </div>
          <div className="p-2 bg-purple-500/10 text-purple-500 rounded-lg border border-purple-500/10">
            <Sparkles size={15} />
          </div>
        </div>
      </div>

      {/* Filter and Control Toolbar */}
      <div className="p-4 bg-theme-surface-1 border-b border-theme-divider flex flex-col md:flex-row md:items-center gap-3 shrink-0">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 text-theme-muted" size={14} />
          <input 
            type="text" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search spool queue by document ID, template name, or targeted printer..."
            className="w-full bg-theme-surface-2 border border-theme-divider rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-blue-500 placeholder-theme-muted text-theme-primary"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter buttons */}
          <div className="flex bg-theme-surface-2 p-0.5 rounded-xl border border-theme-divider text-[10px]">
            <button
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${statusFilter === "all" ? "bg-blue-500 text-white shadow-sm" : "text-theme-muted hover:text-theme-primary"}`}
            >
              All Statuses
            </button>
            <button
              onClick={() => setStatusFilter("success")}
              className={`px-3 py-1 rounded-lg font-bold transition-all flex items-center gap-1 ${statusFilter === "success" ? "bg-emerald-600 text-white shadow-sm" : "text-emerald-500/80 hover:text-emerald-400"}`}
            >
              Success
            </button>
            <button
              onClick={() => setStatusFilter("warning")}
              className={`px-3 py-1 rounded-lg font-bold transition-all flex items-center gap-1 ${statusFilter === "warning" ? "bg-amber-500 text-black shadow-sm" : "text-amber-500 hover:text-amber-400"}`}
            >
              Warning
            </button>
            <button
              onClick={() => setStatusFilter("failed")}
              className={`px-3 py-1 rounded-lg font-bold transition-all flex items-center gap-1 ${statusFilter === "failed" ? "bg-rose-500 text-white shadow-sm" : "text-rose-500 hover:text-rose-400"}`}
            >
              Failures
            </button>
          </div>

          {/* Format Filter selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] text-theme-muted font-mono uppercase">Format:</span>
            <select
              value={formatFilter}
              onChange={(e) => setFormatFilter(e.target.value as any)}
              className="bg-theme-surface-2 border border-theme-divider rounded-xl px-2.5 py-1 text-xs text-theme-primary focus:outline-none focus:border-blue-500"
            >
              <option value="all">All Formats</option>
              <option value="A4">A4 Documents</option>
              <option value="Thermal80mm">Thermal 80mm</option>
              <option value="Label">Barcode Labels</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Spool Logs List Table */}
      <div className="flex-1 overflow-hidden relative">
        <SmritiScrollArea className="h-full">
          <div className="p-4">
            {filteredLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-20 bg-theme-surface-1 border border-theme-divider border-dashed rounded-2xl p-8 max-w-lg mx-auto mt-10">
                <div className="p-4 bg-theme-surface-2 text-theme-muted rounded-full border border-theme-divider mb-4">
                  <Printer size={32} />
                </div>
                <h3 className="font-bold text-sm text-theme-primary font-display">No Spool Logs Located</h3>
                <p className="text-[11px] text-theme-muted mt-1 leading-relaxed max-w-sm">
                  There are no printed document receipts matching your active filter configuration or no printing activities have been spooled yet.
                </p>
                <div className="mt-4 flex gap-2">
                  <button 
                    onClick={() => {
                      setSearchTerm("");
                      setStatusFilter("all");
                      setFormatFilter("all");
                    }} 
                    className="px-3 py-1.5 bg-theme-surface-2 border border-theme-divider text-theme-primary text-xs rounded-lg font-semibold hover:bg-theme-surface-3 cursor-pointer"
                  >
                    Clear Search Filters
                  </button>
                </div>
              </div>
            ) : (
              <div className="border border-theme-divider rounded-2xl overflow-hidden bg-theme-surface-1 shadow-md">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-theme-surface-2 border-b border-theme-divider text-[10px] font-mono text-theme-muted uppercase tracking-wider">
                        <th className="p-4 font-semibold">Timestamp</th>
                        <th className="p-4 font-semibold">Spool Item / Doc Ref</th>
                        <th className="p-4 font-semibold">Layout Template</th>
                        <th className="p-4 font-semibold">Target Hardware</th>
                        <th className="p-4 font-semibold">Job Status</th>
                        <th className="p-4 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-theme-divider">
                      {filteredLogs.map((log) => (
                        <tr 
                          key={log.id}
                          className="text-xs hover:bg-theme-surface-hover/50 transition-colors group"
                        >
                          {/* Timestamp */}
                          <td className="p-4 font-mono text-theme-muted text-[11px]">
                            <div className="flex items-center gap-1.5">
                              <Calendar size={12} className="text-theme-muted" />
                              {log.timestamp}
                            </div>
                          </td>

                          {/* Spool Item / Doc Ref */}
                          <td className="p-4">
                            <div className="font-bold text-theme-primary font-mono">{log.documentName}</div>
                            <div className="text-[10px] text-theme-muted font-mono">{log.id}</div>
                          </td>

                          {/* Layout Template */}
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 bg-theme-surface-2 border border-theme-divider text-theme-primary rounded-lg shrink-0">
                                {log.format === "A4" ? <FileText size={12} /> : <Layers size={12} />}
                              </div>
                              <div>
                                <span className="font-semibold text-theme-primary block">{log.templateName}</span>
                                <span className={`inline-block text-[8px] font-bold font-mono px-1.5 py-0.2 rounded border ${
                                  log.format === "A4" 
                                    ? "bg-blue-500/10 border-blue-500/20 text-blue-400" 
                                    : log.format === "Thermal80mm"
                                    ? "bg-purple-500/10 border-purple-500/20 text-purple-400"
                                    : "bg-amber-500/10 border-amber-500/20 text-amber-400"
                                }`}>
                                  {log.format}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Target Hardware */}
                          <td className="p-4">
                            <span className="font-mono font-medium text-theme-primary block">{log.printerName}</span>
                          </td>

                          {/* Job Status */}
                          <td className="p-4">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[10px] font-bold font-mono border uppercase ${
                              log.status === "success" 
                                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                                : log.status === "warning"
                                ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                                : "bg-rose-500/10 border-rose-500/20 text-rose-400"
                            }`}>
                              {log.status === "success" && <CheckCircle2 size={11} />}
                              {log.status === "warning" && <AlertTriangle size={11} />}
                              {log.status === "failed" && <XCircle size={11} />}
                              {log.status}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => setSelectedLog(log)}
                                className="p-2 text-theme-muted hover:text-theme-primary hover:bg-theme-surface-2 rounded-lg transition-all border border-transparent hover:border-theme-divider cursor-pointer"
                                title="Inspect Logs"
                              >
                                <Eye size={13} />
                              </button>
                              
                              <button
                                onClick={() => handleReprint(log)}
                                className="flex items-center gap-1 py-1 px-2 text-blue-400 bg-blue-500/5 hover:bg-blue-500/10 border border-blue-500/10 hover:border-blue-500/20 rounded-lg font-semibold transition-all text-[11px] cursor-pointer"
                                title="Reprint Document"
                              >
                                <RotateCcw size={12} className="group-hover:rotate-180 transition-transform duration-500" />
                                Reprint
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </SmritiScrollArea>
      </div>

      {/* Detailed Audit Modal Overlay */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-theme-surface-1 border border-theme-divider rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl animate-in scale-in duration-150">
            {/* Modal Header */}
            <div className="p-4 border-b border-theme-divider bg-theme-surface-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-blue-500" />
                <h3 className="font-bold text-sm text-theme-primary font-display uppercase tracking-wider">Inspect Spool Ledger</h3>
              </div>
              <button 
                onClick={() => setSelectedLog(null)}
                className="p-1.5 rounded-lg text-theme-muted hover:text-theme-primary hover:bg-theme-surface-3 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3.5 text-xs">
                <div className="space-y-1">
                  <span className="text-[10px] text-theme-muted font-mono uppercase tracking-wider block">Spool Reference ID</span>
                  <span className="font-bold text-theme-primary font-mono block select-all bg-theme-surface-2 px-2 py-1 rounded border border-theme-divider">
                    {selectedLog.id}
                  </span>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-theme-muted font-mono uppercase tracking-wider block">Dispatched Timestamp</span>
                  <span className="font-semibold text-theme-primary font-mono block bg-theme-surface-2 px-2 py-1 rounded border border-theme-divider">
                    {selectedLog.timestamp}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-theme-muted font-mono uppercase tracking-wider block">Document reference</span>
                <div className="font-bold text-theme-primary bg-theme-surface-2 px-3 py-1.5 rounded-xl border border-theme-divider flex items-center justify-between">
                  <span className="font-mono">{selectedLog.documentName}</span>
                  <span className="text-[9px] font-mono bg-blue-500/10 border border-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded uppercase font-bold">
                    {selectedLog.format} format
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3.5 text-xs">
                <div className="space-y-1">
                  <span className="text-[10px] text-theme-muted font-mono uppercase tracking-wider block">Layout Template</span>
                  <span className="font-semibold text-theme-primary block bg-theme-surface-2 px-2.5 py-1.5 rounded-lg border border-theme-divider">
                    {selectedLog.templateName}
                  </span>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-theme-muted font-mono uppercase tracking-wider block">Targeted Printer</span>
                  <span className="font-semibold text-theme-primary block bg-theme-surface-2 px-2.5 py-1.5 rounded-lg border border-theme-divider">
                    {selectedLog.printerName}
                  </span>
                </div>
              </div>

              {/* Status & Detailed Message */}
              <div className="space-y-1 pt-2">
                <span className="text-[10px] text-theme-muted font-mono uppercase tracking-wider block">Transmission Logs</span>
                <div className={`p-3.5 rounded-xl border ${
                  selectedLog.status === "success" 
                    ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-200" 
                    : selectedLog.status === "warning"
                    ? "bg-amber-950/40 border-amber-500/30 text-amber-200"
                    : "bg-rose-950/40 border-rose-500/30 text-rose-200"
                }`}>
                  <div className="flex items-start gap-2.5">
                    <div className="mt-0.5">
                      {selectedLog.status === "success" && <CheckCircle2 size={14} className="text-emerald-500" />}
                      {selectedLog.status === "warning" && <AlertTriangle size={14} className="text-amber-500" />}
                      {selectedLog.status === "failed" && <XCircle size={14} className="text-rose-500" />}
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wide block">
                        Transmission {selectedLog.status === "success" ? "Completed" : selectedLog.status === "warning" ? "Flagged Warning" : "Failed / Offline"}
                      </span>
                      <p className="text-[11px] leading-relaxed opacity-90">{selectedLog.details || "No supplementary system driver logs were reported by the hardware controller interface."}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-theme-divider bg-theme-surface-2 flex items-center justify-end gap-2 shrink-0">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-1.5 border border-theme-divider text-theme-primary text-xs rounded-lg font-semibold hover:bg-theme-surface-3 transition-colors cursor-pointer"
              >
                Close Logs
              </button>
              <button
                onClick={() => {
                  handleReprint(selectedLog);
                  setSelectedLog(null);
                }}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm cursor-pointer"
              >
                <RotateCcw size={12} />
                Reprint Document
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
