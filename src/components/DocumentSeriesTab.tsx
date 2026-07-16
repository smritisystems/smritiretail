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
 * * Version    : 2.1.1
 * * Created    : 2026-07-10
 * * Modified   : 2026-07-11
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { SmritiScrollArea } from "./SmritiScrollArea.tsx";
import { NumberingEngine, DocumentSeries, NumberingAuditLog } from "../services/numberingEngine.ts";
import { 
  FileDigit, Settings2, Plus, Search, Edit3, Trash2, Eye, ShieldCheck, 
  ArrowRight, Hash, Database, RefreshCw, Copy, CheckCircle2, XCircle, ChevronDown, ChevronRight,
  History, Cpu, Lock, FileSpreadsheet, Activity, HelpCircle, Save
} from "lucide-react";

export const DocumentSeriesTab: React.FC = () => {
  const [activeView, setActiveView] = useState<"registry" | "editor">("registry");
  const [activeSubView, setActiveSubView] = useState<"list" | "audit" | "simulator">("list");
  
  const [seriesList, setSeriesList] = useState<DocumentSeries[]>([]);
  const [auditLogs, setAuditLogs] = useState<NumberingAuditLog[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSeries, setActiveSeries] = useState<DocumentSeries | null>(null);
  
  // Concurrency Simulator State
  const [isSimulating, setIsSimulating] = useState(false);
  const [simResults, setSimResults] = useState<{ id: number; timestamp: string; invoiceNo: string; status: string }[]>([]);
  const [selectedSimSeries, setSelectedSimSeries] = useState<string>("SER-001");

  // Focus Tracker for dynamic prefix builder insertion
  const [focusedField, setFocusedField] = useState<"prefix" | "suffix">("prefix");
  const prefixRef = useRef<HTMLInputElement>(null);
  const suffixRef = useRef<HTMLInputElement>(null);

  // Load Data from Backend
  const loadData = async () => {
    const series = await NumberingEngine.getAllSeriesAsync();
    setSeriesList(series);
    const logs = await NumberingEngine.getAuditLogsAsync();
    // Sort log history descending by time
    setAuditLogs(logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = () => {
    setActiveSeries({
      id: "NEW",
      name: "",
      documentType: "Retail Invoice",
      module: "Sales",
      branch: "All",
      financialYear: "2026-2027",
      prefix: "INV/{FY}/{Branch}/",
      suffix: "",
      runningLength: 6,
      currentNumber: 0,
      resetRule: "Financial Year",
      mode: "Auto",
      isActive: true,
      effectiveFrom: new Date().toISOString().split('T')[0],
      effectiveTo: "2099-12-31",
      
      // Defaults for extensions
      tallyVoucherType: "Sales",
      dateLockEnabled: true,
      periodLockEnabled: false,
      preventManualOverrides: true,
      preventDuplicateCheck: true,
      allowGaplessSequencing: true,
      enforceChronologicalDate: true,
      companyCode: "SMRITI_IND",
      description: ""
    });
    setActiveView("editor");
  };

  const handleEdit = (s: DocumentSeries) => {
    setActiveSeries({
      ...s,
      tallyVoucherType: s.tallyVoucherType || "Sales",
      dateLockEnabled: s.dateLockEnabled ?? true,
      periodLockEnabled: s.periodLockEnabled ?? false,
      preventManualOverrides: s.preventManualOverrides ?? true,
      preventDuplicateCheck: s.preventDuplicateCheck ?? true,
      allowGaplessSequencing: s.allowGaplessSequencing ?? true,
      enforceChronologicalDate: s.enforceChronologicalDate ?? true,
      companyCode: s.companyCode || "SMRITI_IND",
      description: s.description || ""
    });
    setActiveView("editor");
  };

  const handleSave = async () => {
    if (!activeSeries) return;
    if (!activeSeries.name.trim()) {
      alert("Please provide a series name.");
      return;
    }

    try {
      if (activeSeries.id === "NEW") {
        await NumberingEngine.createSeriesAsync(activeSeries);
      } else {
        await NumberingEngine.updateSeriesAsync(activeSeries.id, activeSeries);
      }
      setActiveView("registry");
      loadData();
    } catch (err) {
      console.error(err);
      alert("Error saving document series.");
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to deactivate/retire this series? Active operations will no longer fall back to this format.")) {
      await NumberingEngine.deleteSeriesAsync(id);
      loadData();
    }
  };

  const handleCopy = (s: DocumentSeries) => {
    setActiveSeries({
      ...s,
      id: "NEW",
      name: `${s.name} (Copy)`
    });
    setActiveView("editor");
  };

  const handleTokenClick = (token: string) => {
    if (!activeSeries) return;
    if (focusedField === "prefix") {
      const updatedPrefix = (activeSeries.prefix || "") + token;
      setActiveSeries({ ...activeSeries, prefix: updatedPrefix });
    } else {
      const updatedSuffix = (activeSeries.suffix || "") + token;
      setActiveSeries({ ...activeSeries, suffix: updatedSuffix });
    }
  };

  // Run Parallel Concurrency Simulation
  const runConcurrencyTest = async () => {
    if (isSimulating) return;
    setIsSimulating(true);
    setSimResults([]);

    const seriesId = selectedSimSeries;
    const series = seriesList.find(s => s.id === seriesId);
    if (!series) return;

    // We will fire off 40 parallel requests to test atomic serial locks
    const testPromises = Array.from({ length: 40 }, (_, index) => {
      return new Promise<{ id: number; timestamp: string; invoiceNo: string; status: string }>(async (resolve) => {
        // Random slight delay to emulate real distributed REST billing triggers
        await new Promise(r => setTimeout(r, Math.random() * 800));
        try {
          const formattedNumber = await NumberingEngine.allocateNextNumberAsync(seriesId, {
            branch: "MUM",
            fy: "26-27"
          });
          resolve({
            id: index + 1,
            timestamp: new Date().toISOString().split("T")[1].slice(0, 8),
            invoiceNo: formattedNumber,
            status: "SUCCESS (ATOMIC_LOCKED)"
          });
        } catch (err) {
          resolve({
            id: index + 1,
            timestamp: new Date().toISOString().split("T")[1].slice(0, 8),
            invoiceNo: "COLLISION / BLOCKED",
            status: "FAILED"
          });
        }
      });
    });

    const results = await Promise.all(testPromises);
    // Sort by sequence number inside invoice format to visually verify consecutive gapless allocation!
    results.sort((a, b) => a.invoiceNo.localeCompare(b.invoiceNo));
    setSimResults(results);
    setIsSimulating(false);
    // Reload main tables to reflect updated currentNumber counter
    loadData();
  };

  const filteredSeries = seriesList.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.documentType.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.prefix && s.prefix.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Universal Heading Banner */}
      <div className="bg-theme-surface-1 border border-theme-divider rounded-2xl p-5 shadow-xl flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold font-display tracking-tight text-theme-body flex items-center gap-2">
            <FileDigit className="text-indigo-500" />
            Universal Numbering Engine
          </h2>
          <p className="text-xs text-theme-muted mt-1 max-w-2xl">
            Centralized document series management. Control prefixes, suffixes, and running sequences across POS, Purchase, Sales, and Warehouse modules.
          </p>
        </div>
        
        {activeView === "editor" ? (
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setActiveView("registry")}
              className="px-4 py-2 border border-theme-divider text-theme-muted hover:text-theme-primary rounded-lg text-xs font-semibold transition-colors"
            >
              Back to Registry
            </button>
            <button 
              onClick={handleSave}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-lg shadow-indigo-500/20 flex items-center gap-2 transition-colors"
            >
              <Save size={14} /> Save Series
            </button>
          </div>
        ) : (
          <button 
            onClick={handleCreate}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-lg shadow-indigo-500/20 flex items-center gap-2 transition-colors"
          >
            <Plus size={14} /> New Series
          </button>
        )}
      </div>

      {activeView === "registry" ? (
        <div className="space-y-6">
          {/* Sub Navigation */}
          <div className="flex items-center gap-2 border-b border-theme-divider">
            <button 
              onClick={() => setActiveSubView("list")}
              className={`px-4 py-2 text-xs font-semibold transition-all border-b-2 -mb-[1px] flex items-center gap-2 ${activeSubView === "list" ? "border-indigo-500 text-indigo-400" : "border-transparent text-theme-muted hover:text-theme-body"}`}
            >
              <Database size={14} /> Series Registry
            </button>
            <button 
              onClick={() => setActiveSubView("audit")}
              className={`px-4 py-2 text-xs font-semibold transition-all border-b-2 -mb-[1px] flex items-center gap-2 ${activeSubView === "audit" ? "border-indigo-500 text-indigo-400" : "border-transparent text-theme-muted hover:text-theme-body"}`}
            >
              <History size={14} /> Sequence Audit Logs
            </button>
            <button 
              onClick={() => setActiveSubView("simulator")}
              className={`px-4 py-2 text-xs font-semibold transition-all border-b-2 -mb-[1px] flex items-center gap-2 ${activeSubView === "simulator" ? "border-indigo-500 text-indigo-400" : "border-transparent text-theme-muted hover:text-theme-body"}`}
            >
              <Cpu size={14} /> Concurrency Lock Test
            </button>
          </div>

          {activeSubView === "list" && (
            <div className="bg-theme-surface-1 border border-theme-divider rounded-2xl shadow-xl overflow-hidden flex flex-col min-h-[500px]">
              <div className="p-4 border-b border-theme-divider bg-theme-surface-2 flex items-center justify-between">
                <div className="text-xs font-bold text-theme-body flex items-center gap-2">
                  <Activity size={14} className="text-emerald-500 animate-pulse" />
                  Live Operational Formats
                </div>
                <div className="relative w-64">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted" />
                  <input 
                    type="text" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search series, types, prefix..." 
                    className="w-full bg-theme-surface-1 border border-theme-divider rounded-lg pl-9 pr-3 py-1.5 text-xs text-theme-body focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
              </div>
              
              <SmritiScrollArea className="flex-1">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-theme-surface-3/50 text-theme-muted uppercase font-mono tracking-wider border-b border-theme-divider">
                      <th className="px-5 py-3">ID</th>
                      <th className="px-5 py-3">Series Name / Scope</th>
                      <th className="px-5 py-3">Module</th>
                      <th className="px-5 py-3">Document Type</th>
                      <th className="px-5 py-3">Voucher Preview</th>
                      <th className="px-5 py-3">Tally Map</th>
                      <th className="px-5 py-3">Last Index</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSeries.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-5 py-12 text-center text-theme-muted">
                          No document numbering series configured.
                        </td>
                      </tr>
                    ) : (
                      filteredSeries.map((s, idx) => (
                        <tr 
                          key={s.id} 
                          className="border-b border-theme-divider/40 hover:bg-theme-surface-2 cursor-pointer transition-colors" 
                          onDoubleClick={() => handleEdit(s)}
                        >
                          <td className="px-5 py-4 font-mono font-bold text-indigo-400">{s.id}</td>
                          <td className="px-5 py-4">
                            <div className="font-bold text-theme-body">{s.name}</div>
                            <div className="text-[10px] text-theme-muted mt-0.5">{s.description || "No description provided"}</div>
                          </td>
                          <td className="px-5 py-4 font-semibold text-theme-muted">{s.module}</td>
                          <td className="px-5 py-4 text-theme-body font-medium">{s.documentType}</td>
                          <td className="px-5 py-4 font-mono text-theme-primary">
                            {s.prefix}<span className="text-indigo-400">{'#'.repeat(s.runningLength)}</span>{s.suffix}
                          </td>
                          <td className="px-5 py-4">
                            <span className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-mono rounded font-medium">
                              {s.tallyVoucherType || s.documentType}
                            </span>
                          </td>
                          <td className="px-5 py-4 font-mono font-bold">{s.currentNumber}</td>
                          <td className="px-5 py-4">
                            {s.isActive ? (
                              <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20">
                                <CheckCircle2 size={10} /> Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold text-rose-500 bg-rose-500/10 px-2 py-1 rounded border border-rose-500/20">
                                <XCircle size={10} /> Retired
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-4 text-right space-x-1">
                            <button 
                              className="p-1.5 text-theme-muted hover:text-indigo-400 bg-theme-surface-3 rounded transition-colors" 
                              onClick={(e) => { e.stopPropagation(); handleEdit(s); }}
                              title="Edit Configuration"
                            >
                              <Edit3 size={13} />
                            </button>
                            <button 
                              className="p-1.5 text-theme-muted hover:text-theme-body bg-theme-surface-3 rounded transition-colors"
                              onClick={(e) => { e.stopPropagation(); handleCopy(s); }}
                              title="Clone Series"
                            >
                              <Copy size={13} />
                            </button>
                            <button 
                              className="p-1.5 text-theme-muted hover:text-rose-400 bg-theme-surface-3 rounded transition-colors"
                              onClick={(e) => { e.stopPropagation(); handleDelete(s.id); }}
                              title="Deactivate Series"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </SmritiScrollArea>
            </div>
          )}

          {activeSubView === "audit" && (
            <div className="bg-theme-surface-1 border border-theme-divider rounded-2xl shadow-xl overflow-hidden flex flex-col min-h-[500px]">
              <div className="p-4 border-b border-theme-divider bg-theme-surface-2 flex items-center justify-between">
                <div className="text-xs font-bold text-theme-body flex items-center gap-2">
                  <History size={15} className="text-blue-500" />
                  Chronological Generation & Event Log (GAPLESS AUDIT)
                </div>
                <button 
                  onClick={loadData}
                  className="px-2.5 py-1.5 bg-theme-surface-3 hover:bg-theme-surface-2 text-theme-body border border-theme-divider rounded-lg text-[10px] font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <RefreshCw size={11} /> Sync Feed
                </button>
              </div>

              <SmritiScrollArea className="flex-1">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="bg-theme-surface-3/50 text-theme-muted uppercase font-sans tracking-wider border-b border-theme-divider">
                      <th className="px-5 py-3">Timestamp</th>
                      <th className="px-5 py-3">Event Action</th>
                      <th className="px-5 py-3">Series ID / Name</th>
                      <th className="px-5 py-3">Resolved Voucher No.</th>
                      <th className="px-5 py-3">Operator</th>
                      <th className="px-5 py-3">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-5 py-12 text-center text-theme-muted font-sans">
                          No allocation history tracked yet.
                        </td>
                      </tr>
                    ) : (
                      auditLogs.map((log) => (
                        <tr key={log.id} className="border-b border-theme-divider/40 hover:bg-theme-surface-2 transition-colors">
                          <td className="px-5 py-3.5 text-theme-muted whitespace-nowrap">
                            {new Date(log.timestamp).toLocaleString("en-IN", { timeZone: "IST" })}
                          </td>
                          <td className="px-5 py-3.5">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                              log.action === "ALLOCATE" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                              log.action === "CREATE" ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20" :
                              log.action === "UPDATE" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
                              "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                            }`}>
                              {log.action}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            <span className="font-bold text-indigo-400">{log.seriesId}</span>
                            <span className="text-theme-muted font-sans text-[11px] ml-1.5 font-medium">({log.seriesName})</span>
                          </td>
                          <td className="px-5 py-3.5 text-theme-primary font-bold">{log.documentNo}</td>
                          <td className="px-5 py-3.5 text-theme-body font-sans font-semibold">{log.user}</td>
                          <td className="px-5 py-3.5 text-theme-muted font-sans max-w-sm truncate" title={log.details}>
                            {log.details}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </SmritiScrollArea>
            </div>
          )}

          {activeSubView === "simulator" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Simulator Config */}
              <div className="bg-theme-surface-1 border border-theme-divider rounded-2xl p-5 shadow-xl space-y-5">
                <div className="flex items-center gap-2 text-sm font-bold text-theme-body border-b border-theme-divider pb-3">
                  <Cpu size={16} className="text-indigo-500" />
                  Atomic Concurrency Lock Test
                </div>
                <p className="text-xs text-theme-muted leading-relaxed">
                  Test the strength of SMRITI's centralized atomic counter. In a multi-user retail operation, multiple POS counters submit checkouts simultaneously. 
                  Our engine isolates serial sequence steps to ensure zero duplicate invoice allocations.
                </p>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-wider font-bold text-theme-muted">Select Target Series</label>
                  <select 
                    value={selectedSimSeries}
                    onChange={(e) => setSelectedSimSeries(e.target.value)}
                    className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-xs text-theme-body focus:outline-none focus:border-indigo-500 transition-colors"
                  >
                    {seriesList.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.prefix}#)</option>
                    ))}
                  </select>
                </div>

                <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl space-y-2">
                  <div className="text-[10px] uppercase tracking-wider font-bold text-yellow-500 flex items-center gap-1">
                    <Lock size={11} /> Concurrency Guard Status
                  </div>
                  <div className="text-[11px] text-yellow-400 font-medium">
                    Strict isolation is active. Single-threaded Node.js server acts as the sequence arbiter with mutex-like locks simulation.
                  </div>
                </div>

                <button 
                  onClick={runConcurrencyTest}
                  disabled={isSimulating}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 shadow-lg shadow-indigo-500/10"
                >
                  {isSimulating ? "Simulating Concurrent Requests..." : "Trigger 40 Parallel Sales Transactions"}
                </button>
              </div>

              {/* Live Simulated Result Streams */}
              <div className="lg:col-span-2 bg-theme-surface-1 border border-theme-divider rounded-2xl shadow-xl flex flex-col min-h-[400px]">
                <div className="p-4 border-b border-theme-divider bg-theme-surface-2 font-bold text-xs text-theme-body flex items-center gap-2">
                  <Activity size={15} className="text-emerald-500" />
                  Live Memory Locks Thread Output ({simResults.length} events resolved)
                </div>

                <div className="flex-1 p-5 overflow-hidden">
                  <SmritiScrollArea className="h-[350px]">
                    {simResults.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-theme-muted gap-2 py-16">
                        <Cpu size={24} className="text-theme-muted/50" />
                        Click "Trigger 40 Parallel Sales Transactions" on the left to start the stress test.
                      </div>
                    ) : (
                      <div className="space-y-2 font-mono text-[11px]">
                        {simResults.map((r) => (
                          <div key={r.id} className="flex items-center justify-between px-3 py-1.5 bg-theme-surface-2 border border-theme-divider rounded-lg">
                            <div className="flex items-center gap-2">
                              <span className="text-theme-muted">[{r.timestamp}]</span>
                              <span className="text-theme-muted">Pos Checkout #{String(r.id).padStart(2, "0")}</span>
                            </div>
                            <div className="flex items-center gap-4">
                              <span className="font-bold text-indigo-400">{r.invoiceNo}</span>
                              <span className="text-[10px] bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 px-1.5 py-0.5 rounded font-bold font-sans">
                                {r.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </SmritiScrollArea>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : activeSeries ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Config Form */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-theme-surface-1 border border-theme-divider rounded-2xl shadow-xl overflow-hidden">
              <div className="p-4 border-b border-theme-divider bg-theme-surface-2 flex items-center gap-2">
                <Settings2 size={16} className="text-indigo-400" />
                <h3 className="text-sm font-bold text-theme-body">Series Configuration</h3>
              </div>
              
              <div className="p-5 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase tracking-wider font-bold text-theme-muted">Series Name</label>
                    <input 
                      type="text" 
                      value={activeSeries.name}
                      onChange={(e) => setActiveSeries({...activeSeries, name: e.target.value})}
                      className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-sm text-theme-body focus:outline-none focus:border-indigo-500 transition-colors" 
                      placeholder="e.g. Standard Retail Invoice"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase tracking-wider font-bold text-theme-muted">Document Type</label>
                    <select 
                      value={activeSeries.documentType}
                      onChange={(e) => {
                        const val = e.target.value;
                        let mod = "Sales";
                        if (val.includes("Purchase") || val.includes("Note") || val.includes("GRN") || val.includes("Goods")) mod = "Purchase";
                        setActiveSeries({...activeSeries, documentType: val, module: mod});
                      }}
                      className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-sm text-theme-body focus:outline-none focus:border-indigo-500 transition-colors"
                    >
                      <option value="Retail Invoice">Retail Invoice</option>
                      <option value="Purchase Order">Purchase Order</option>
                      <option value="Goods Received Note">Goods Received Note</option>
                      <option value="Quotation">Quotation</option>
                      <option value="Sales Order">Sales Order</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 border-t border-theme-divider pt-5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase tracking-wider font-bold text-theme-muted">Prefix Format</label>
                    <input 
                      ref={prefixRef}
                      type="text" 
                      value={activeSeries.prefix}
                      onFocus={() => setFocusedField("prefix")}
                      onChange={(e) => setActiveSeries({...activeSeries, prefix: e.target.value})}
                      className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-sm text-theme-body focus:outline-none focus:border-indigo-500 font-mono transition-colors" 
                      placeholder="INV/{FY}/"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase tracking-wider font-bold text-theme-muted">Running No. Length</label>
                    <input 
                      type="number" 
                      value={activeSeries.runningLength}
                      onChange={(e) => setActiveSeries({...activeSeries, runningLength: parseInt(e.target.value) || 0})}
                      className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-sm text-theme-body focus:outline-none focus:border-indigo-500 font-mono transition-colors" 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase tracking-wider font-bold text-theme-muted">Suffix Format</label>
                    <input 
                      ref={suffixRef}
                      type="text" 
                      value={activeSeries.suffix}
                      onFocus={() => setFocusedField("suffix")}
                      onChange={(e) => setActiveSeries({...activeSeries, suffix: e.target.value})}
                      className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-sm text-theme-body focus:outline-none focus:border-indigo-500 font-mono transition-colors" 
                      placeholder="-RET"
                    />
                  </div>
                </div>

                {/* Interactive Variable Clicker */}
                <div className="p-4 bg-theme-surface-2 border border-theme-divider border-dashed rounded-xl space-y-3">
                  <div className="text-[10px] uppercase tracking-wider font-bold text-indigo-400 flex items-center gap-1">
                    <Activity size={12} /> Dynamic Format Builder (Appending to {focusedField === "prefix" ? "Prefix" : "Suffix"})
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { key: "{FY}", desc: "Financial Year (e.g. 26-27)" },
                      { key: "{Branch}", desc: "Branch Code (e.g. MUM)" },
                      { key: "{Store}", desc: "Store / Outlets context" },
                      { key: "{Month}", desc: "2-digit Month (e.g. 07)" },
                      { key: "{Year}", desc: "4-digit Year (e.g. 2026)" },
                      { key: "{Date}", desc: "2-digit Date (e.g. 10)" },
                      { key: "{User}", desc: "Authorized operator login username" },
                      { key: "{Module}", desc: "Scope domain of event" }
                    ].map((tok) => (
                      <span 
                        key={tok.key} 
                        onClick={() => handleTokenClick(tok.key)}
                        className="px-2.5 py-1.5 bg-theme-surface-1 border border-theme-divider hover:border-indigo-500 rounded text-xs font-mono text-theme-primary cursor-pointer hover:bg-indigo-500/10 transition-all shadow-sm"
                        title={tok.desc}
                      >
                        {tok.key}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 border-t border-theme-divider pt-5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase tracking-wider font-bold text-theme-muted">Numbering Mode</label>
                    <select 
                      value={activeSeries.mode}
                      onChange={(e) => setActiveSeries({...activeSeries, mode: e.target.value as any})}
                      className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-sm text-theme-body focus:outline-none focus:border-indigo-500 transition-colors"
                    >
                      <option value="Auto">Auto-Increment</option>
                      <option value="Manual">Manual Entry</option>
                      <option value="Hybrid">Hybrid (Prefix + Manual)</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase tracking-wider font-bold text-theme-muted">Reset Rule</label>
                    <select 
                      value={activeSeries.resetRule}
                      onChange={(e) => setActiveSeries({...activeSeries, resetRule: e.target.value as any})}
                      className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-sm text-theme-body focus:outline-none focus:border-indigo-500 transition-colors"
                    >
                      <option value="Never">Never Reset</option>
                      <option value="Financial Year">Every Financial Year</option>
                      <option value="Monthly">Monthly</option>
                      <option value="Daily">Daily</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase tracking-wider font-bold text-theme-muted">Current Sequence No.</label>
                    <input 
                      type="number" 
                      value={activeSeries.currentNumber}
                      onChange={(e) => setActiveSeries({...activeSeries, currentNumber: parseInt(e.target.value) || 0})}
                      className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-sm text-theme-body focus:outline-none focus:border-indigo-500 font-mono transition-colors" 
                    />
                  </div>
                </div>

                <div className="space-y-1.5 border-t border-theme-divider pt-5">
                  <label className="text-[10px] uppercase tracking-wider font-bold text-theme-muted">Description / Operational Intent</label>
                  <textarea 
                    value={activeSeries.description || ""}
                    onChange={(e) => setActiveSeries({...activeSeries, description: e.target.value})}
                    rows={2}
                    className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-sm text-theme-body focus:outline-none focus:border-indigo-500 transition-colors"
                    placeholder="Enter notes on how or when this series format must be utilized..."
                  />
                </div>

              </div>
            </div>

            {/* Enterprise Control Parameters */}
            <div className="bg-theme-surface-1 border border-theme-divider rounded-2xl shadow-xl overflow-hidden">
              <div className="p-4 border-b border-theme-divider bg-theme-surface-2 flex items-center gap-2">
                <Lock size={16} className="text-emerald-500" />
                <h3 className="text-sm font-bold text-theme-body">Regulatory & Integration Controls (TALLY PRIME READY)</h3>
              </div>
              <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase tracking-wider font-bold text-theme-muted">Tally Prime Voucher Type</label>
                    <input 
                      type="text" 
                      value={activeSeries.tallyVoucherType || ""}
                      onChange={(e) => setActiveSeries({...activeSeries, tallyVoucherType: e.target.value})}
                      className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-xs text-theme-body focus:outline-none focus:border-indigo-500 transition-colors font-semibold"
                      placeholder="e.g. Sales, Purchase Order, Material In"
                    />
                  </div>
                  
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase tracking-wider font-bold text-theme-muted">Company Reference Mapping</label>
                    <input 
                      type="text" 
                      value={activeSeries.companyCode || ""}
                      onChange={(e) => setActiveSeries({...activeSeries, companyCode: e.target.value})}
                      className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-xs text-theme-body focus:outline-none focus:border-indigo-500 transition-colors font-mono"
                      placeholder="e.g. SMRITI_IND"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase tracking-wider font-bold text-theme-muted">Branch / Store Boundary</label>
                    <select 
                      value={activeSeries.branch}
                      onChange={(e) => setActiveSeries({...activeSeries, branch: e.target.value})}
                      className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-xs text-theme-body focus:outline-none focus:border-indigo-500 transition-colors"
                    >
                      <option value="All">All Branches / Outlets</option>
                      <option value="MUM">Mumbai HQ</option>
                      <option value="DEL">Delhi Branch</option>
                      <option value="BLR">Bangalore Outlet</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <label className="flex items-start gap-2.5 text-xs cursor-pointer text-theme-body font-semibold">
                    <input 
                      type="checkbox" 
                      checked={activeSeries.dateLockEnabled}
                      onChange={(e) => setActiveSeries({...activeSeries, dateLockEnabled: e.target.checked})}
                      className="mt-0.5 rounded border-theme-divider"
                    />
                    <div>
                      <div>Date-Range Lock Verification</div>
                      <div className="text-[10px] text-theme-muted font-normal mt-0.5">Prevent voucher number generation if system date is outside effective ranges.</div>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 text-xs cursor-pointer text-theme-body font-semibold">
                    <input 
                      type="checkbox" 
                      checked={activeSeries.periodLockEnabled}
                      onChange={(e) => setActiveSeries({...activeSeries, periodLockEnabled: e.target.checked})}
                      className="mt-0.5 rounded border-theme-divider"
                    />
                    <div>
                      <div>Fiscal Period Date Locking</div>
                      <div className="text-[10px] text-theme-muted font-normal mt-0.5">Strictly lock voucher numbering in historic closed calendar months / quarters.</div>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 text-xs cursor-pointer text-theme-body font-semibold">
                    <input 
                      type="checkbox" 
                      checked={activeSeries.preventManualOverrides}
                      onChange={(e) => setActiveSeries({...activeSeries, preventManualOverrides: e.target.checked})}
                      className="mt-0.5 rounded border-theme-divider"
                    />
                    <div>
                      <div>Block Cashier Manual Overrides</div>
                      <div className="text-[10px] text-theme-muted font-normal mt-0.5">POS and invoice inputs will disable typing overrides, forcing sequence integrity.</div>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 text-xs cursor-pointer text-theme-body font-semibold">
                    <input 
                      type="checkbox" 
                      checked={activeSeries.preventDuplicateCheck}
                      onChange={(e) => setActiveSeries({...activeSeries, preventDuplicateCheck: e.target.checked})}
                      className="mt-0.5 rounded border-theme-divider"
                    />
                    <div>
                      <div>Prevent Duplicate Numbers</div>
                      <div className="text-[10px] text-theme-muted font-normal mt-0.5">Ensure duplicate sequence identifiers are blocked, protecting Tally synchronization.</div>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Right Live Preview Sidebar */}
          <div className="space-y-6">
            <div className="bg-theme-surface-1 border border-theme-divider rounded-2xl shadow-xl overflow-hidden sticky top-6">
              <div className="p-4 border-b border-theme-divider bg-theme-surface-2 flex items-center gap-2 text-sm font-bold text-theme-body">
                <Eye size={16} className="text-blue-500" /> Live Preview
              </div>
              
              <div className="p-6 space-y-6 flex flex-col items-center">
                <div className="text-center space-y-2 w-full">
                  <div className="text-[10px] uppercase tracking-wider font-bold text-theme-muted">Format Preview</div>
                  <div className="text-lg font-bold font-mono tracking-wider text-theme-primary px-3 py-2 border border-theme-divider rounded-xl bg-theme-surface-2 shadow-inner break-all">
                    {NumberingEngine.formatPreview(activeSeries)}
                  </div>
                </div>

                <div className="w-full border-t border-theme-divider pt-6 space-y-4">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-theme-muted">Module Context</span>
                    <span className="font-bold text-theme-body">{activeSeries.module} / {activeSeries.documentType}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-theme-muted">Reset Rule</span>
                    <span className="font-bold text-theme-body">{activeSeries.resetRule}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-theme-muted">Sequence Mode</span>
                    <span className="font-bold text-theme-body">{activeSeries.mode}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-theme-muted">Status</span>
                    <div className="flex items-center gap-2 pt-1">
                      <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
                        <input 
                          type="radio" 
                          name="status-form" 
                          checked={activeSeries.isActive}
                          onChange={() => setActiveSeries({...activeSeries, isActive: true})}
                        /> Active
                      </label>
                      <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer text-theme-muted">
                        <input 
                          type="radio" 
                          name="status-form" 
                          checked={!activeSeries.isActive}
                          onChange={() => setActiveSeries({...activeSeries, isActive: false})}
                        /> Retired
                      </label>
                    </div>
                  </div>
                </div>
                
                <div className="w-full bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-xs text-blue-400 font-medium leading-relaxed">
                  This series configuration will be automatically enforced for all new {activeSeries.documentType} records created within the permitted context.
                </div>
              </div>
            </div>
          </div>
          
        </div>
      ) : null}
    </div>
  );
};
