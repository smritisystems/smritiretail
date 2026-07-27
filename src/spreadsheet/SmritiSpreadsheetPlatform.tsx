/**
 * Project      : SMRITI Retail OS
 * Module       : SMRITI Spreadsheet Platform (SSP)
 * Organization : SmritiSys
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 5.3.0
 * Created      : 2026-07-27
 * Copyright    : © SmritiSys. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { 
  FileSpreadsheet, Sparkles, Download, Upload, Copy, Check, 
  Trash2, RefreshCw, AlertTriangle, AlertCircle, Info, Sliders,
  CheckCircle2, Search, Filter, Layers, Maximize2, Zap, RotateCcw,
  RotateCw, Save, Shield
} from "lucide-react";
import { evaluateFormula, isFormula } from "./core/FormulaEngine.js";
import { parseClipboardData } from "./core/ClipboardEngine.js";
import { validateCell, validateGrid } from "./core/ValidationEngine.js";
import { HistoryEngine } from "./core/HistoryEngine.js";
import { TransactionEngine } from "./core/TransactionEngine.js";
import { PermissionEngine } from "./core/PermissionEngine.js";
import { parseSSPAIPrompt, executeSSPAICommand } from "./ai/AIAssistant.js";

export interface SpreadsheetColumn {
  key: string;
  label: string;
  required?: boolean;
  type?: "text" | "number" | "currency" | "gst" | "gstin" | "pincode" | "barcode" | "select";
  options?: string[];
  aliases?: string[];
}

export interface SmritiSpreadsheetPlatformProps<TRow = Record<string, any>> {
  title?: string;
  subtitle?: string;
  columns: SpreadsheetColumn[];
  initialData?: TRow[];
  userRole?: string;
  onSaveData?: (data: TRow[]) => Promise<void> | void;
  onNotification?: (title: string, message: string, type?: "success" | "error") => void;
  isReadOnly?: boolean;
}

export function SmritiSpreadsheetPlatform<TRow extends Record<string, any>>({
  title = "SMRITI Spreadsheet Platform (SSP)",
  subtitle = "Universal Enterprise Live Grid Workspace — Formula engine, clipboard parser, history undo/redo, and transaction buffer",
  columns,
  initialData = [],
  userRole = "Store Manager",
  onSaveData,
  onNotification,
  isReadOnly = false,
}: SmritiSpreadsheetPlatformProps<TRow>) {
  const [rows, setRows] = useState<Record<string, any>[]>(initialData);
  const [selectedCell, setSelectedCell] = useState<{ rowIndex: number; colKey: string } | null>(null);
  const [formulaInput, setFormulaInput] = useState<string>("");
  const [aiPrompt, setAiPrompt] = useState<string>("");
  const [isAiProcessing, setIsAiProcessing] = useState<boolean>(false);
  const [savedStatus, setSavedStatus] = useState<string>("✓ Synced");
  const [highlightedRows, setHighlightedRows] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Instantiated Core Platform Engines
  const historyEngine = useMemo(() => new HistoryEngine<Record<string, any>[]>(50), []);
  const transactionEngine = useMemo(() => new TransactionEngine(), []);
  const permissionEngine = useMemo(() => new PermissionEngine([]), []);

  useEffect(() => {
    if (initialData && initialData.length > 0) {
      setRows(initialData);
      historyEngine.pushState(initialData);
      transactionEngine.createSnapshot("initial", initialData);
    }
  }, [initialData]);

  // Sync formula bar input when selected cell changes
  useEffect(() => {
    if (selectedCell) {
      const cellVal = rows[selectedCell.rowIndex]?.[selectedCell.colKey] ?? "";
      setFormulaInput(cellVal.toString());
    } else {
      setFormulaInput("");
    }
  }, [selectedCell, rows]);

  // Formula Context Evaluator
  const getContextForCell = useCallback(
    (targetRowIndex: number): any => ({
      getValue: (cellRef: string) => {
        const row = rows[targetRowIndex];
        if (!row) return 0;
        if (cellRef in row) return row[cellRef];
        const match = cellRef.match(/^([A-Z]+)(\d+)$/i);
        if (match) {
          const colLetters = match[1].toUpperCase();
          const rIndex = parseInt(match[2], 10) - 1;
          const targetRow = rows[rIndex];
          const cIndex = colLetters.charCodeAt(0) - 65;
          const col = columns[cIndex];
          if (targetRow && col) return targetRow[col.key] ?? 0;
        }
        return 0;
      },
    }),
    [rows, columns]
  );

  // Handle Cell Change
  const handleCellChange = (rowIndex: number, colKey: string, value: string) => {
    if (isReadOnly || !permissionEngine.isColumnEditable(colKey, userRole)) return;
    
    // Push current state to undo history
    historyEngine.pushState(rows);

    const oldValue = rows[rowIndex]?.[colKey];
    const updated = [...rows];
    updated[rowIndex] = { ...updated[rowIndex], [colKey]: value };

    // Evaluate formula if prefixed with '='
    if (isFormula(value)) {
      const computed = evaluateFormula(value, getContextForCell(rowIndex));
      updated[rowIndex][colKey] = computed.toString();
    }

    // Record pending transaction
    transactionEngine.recordChange({
      rowIndex,
      colKey,
      oldValue,
      newValue: value,
      timestamp: Date.now(),
    });

    setRows(updated);
    setSavedStatus("Editing (Pending Commit)...");
  };

  // Undo (Ctrl+Z)
  const handleUndo = () => {
    if (!historyEngine.canUndo() || isReadOnly) return;
    const prev = historyEngine.undo(rows);
    if (prev) {
      setRows(prev);
      setSavedStatus("Editing (Undo)...");
    }
  };

  // Redo (Ctrl+Y)
  const handleRedo = () => {
    if (!historyEngine.canRedo() || isReadOnly) return;
    const next = historyEngine.redo(rows);
    if (next) {
      setRows(next);
      setSavedStatus("Editing (Redo)...");
    }
  };

  // Commit Pending Transactions to Database
  const handleCommitTransaction = async () => {
    setSavedStatus("Committing...");
    try {
      if (onSaveData) {
        await onSaveData(rows as TRow[]);
      }
      transactionEngine.commit();
      setSavedStatus("✓ Synced to DB");
      if (onNotification) {
        onNotification("Transaction Committed", "SSP grid edits successfully committed to database.", "success");
      }
    } catch (err) {
      setSavedStatus("⚠️ Commit Failed");
      if (onNotification) {
        onNotification("Commit Error", "Failed to commit grid changes to database.", "error");
      }
    }
  };

  // Rollback Transactions to Snapshot
  const handleRollbackTransaction = () => {
    const initialSnap = transactionEngine.restoreSnapshot("initial");
    if (initialSnap) {
      setRows(initialSnap);
      transactionEngine.rollback();
      historyEngine.clear();
      setSavedStatus("✓ Restored Snapshot");
      if (onNotification) {
        onNotification("Rollback Executed", "Restored grid dataset to pre-transaction snapshot.", "success");
      }
    }
  };

  // MS Excel Clipboard Engine Handler
  const handlePaste = (e: React.ClipboardEvent) => {
    if (isReadOnly) return;
    const text = e.clipboardData.getData("text");
    if (!text) return;

    const parsed = parseClipboardData(text, columns);
    if (parsed.rowCount > 0) {
      e.preventDefault();
      historyEngine.pushState(rows);
      const nextRows = [...rows, ...parsed.rows];
      setRows(nextRows);
      setSavedStatus("Pasted (Pending Commit)");
      if (onNotification) {
        onNotification("Clipboard Import", `Pasted ${parsed.rowCount} rows directly into SSP grid.`, "success");
      }
    }
  };

  // AI Assistant Runner
  const handleRunAI = () => {
    if (!aiPrompt.trim() || isReadOnly) return;
    setIsAiProcessing(true);
    const cmd = parseSSPAIPrompt(aiPrompt);

    if (!cmd) {
      if (onNotification) {
        onNotification("AI Assistant Notice", "Command not recognized. Try: 'Increase MRP by 7%' or 'Normalize brands'.", "error");
      }
      setIsAiProcessing(false);
      return;
    }

    historyEngine.pushState(rows);
    const { updatedRows, result } = executeSSPAICommand(rows, cmd);
    setRows(updatedRows);
    setHighlightedRows(new Set(result.highlightedRowIndices));
    setIsAiProcessing(false);
    setSavedStatus("AI Modified (Pending Commit)");
    if (onNotification) {
      onNotification("AI Action Executed", result.summary, "success");
    }
  };

  // Filtered Rows
  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return rows;
    const q = searchQuery.toLowerCase();
    return rows.filter((r) =>
      Object.values(r).some((v) => (v ?? "").toString().toLowerCase().includes(q))
    );
  }, [rows, searchQuery]);

  return (
    <div className="flex flex-col h-full bg-[#0d1017] text-theme-body rounded-2xl border border-theme-divider overflow-hidden font-sans">
      {/* Header Bar */}
      <div className="p-4 bg-[#141824] border-b border-theme-divider flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
            <FileSpreadsheet size={22} />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              {title}
            </h2>
            <p className="text-xs text-theme-muted">{subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* History Undo / Redo */}
          <div className="flex items-center bg-[#1c2234] rounded-xl border border-theme-divider p-0.5">
            <button
              onClick={handleUndo}
              disabled={!historyEngine.canUndo() || isReadOnly}
              className="p-1.5 text-theme-muted hover:text-white disabled:opacity-30 rounded-lg transition-colors cursor-pointer"
              title="Undo Edit (Ctrl+Z)"
            >
              <RotateCcw size={14} />
            </button>
            <button
              onClick={handleRedo}
              disabled={!historyEngine.canRedo() || isReadOnly}
              className="p-1.5 text-theme-muted hover:text-white disabled:opacity-30 rounded-lg transition-colors cursor-pointer"
              title="Redo Edit (Ctrl+Y)"
            >
              <RotateCw size={14} />
            </button>
          </div>

          <span className="text-xs font-mono px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
            <Zap size={12} /> {savedStatus}
          </span>

          <div className="relative w-60">
            <Search size={14} className="absolute left-3 top-2.5 text-theme-muted" />
            <input
              type="text"
              placeholder="Search SSP grid..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#1c2234] border border-theme-divider rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-theme-muted outline-none focus:border-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* Formula Bar & AI Assistant Bar */}
      <div className="p-3 bg-[#11141f] border-b border-theme-divider grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
        <div className="md:col-span-7 flex items-center gap-2 bg-[#1a1f30] px-3 py-1.5 rounded-xl border border-theme-divider">
          <span className="text-xs font-mono font-bold text-emerald-400 italic shrink-0">fx =</span>
          <input
            type="text"
            placeholder={selectedCell ? `Formula for cell [Row ${selectedCell.rowIndex + 1}, ${selectedCell.colKey}] (e.g. =MARGIN(price, costPrice))` : "Select cell to enter formula..."}
            value={formulaInput}
            onChange={(e) => {
              setFormulaInput(e.target.value);
              if (selectedCell) {
                handleCellChange(selectedCell.rowIndex, selectedCell.colKey, e.target.value);
              }
            }}
            disabled={!selectedCell || isReadOnly}
            className="w-full bg-transparent text-xs text-white font-mono outline-none placeholder-theme-muted"
          />
        </div>

        <div className="md:col-span-5 flex items-center gap-2">
          <div className="relative flex-1">
            <Sparkles size={14} className="absolute left-3 top-2.5 text-amber-400" />
            <input
              type="text"
              placeholder="AI Command: 'Increase MRP by 10%'..."
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRunAI()}
              className="w-full bg-[#1c2234] border border-amber-500/30 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-theme-muted outline-none focus:border-amber-400"
            />
          </div>
          <button
            onClick={handleRunAI}
            disabled={isAiProcessing || isReadOnly}
            className="px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-emerald-500 hover:from-amber-400 hover:to-emerald-400 text-black font-bold text-xs rounded-xl shadow-md transition-all shrink-0 cursor-pointer"
          >
            {isAiProcessing ? "Running..." : "Run AI"}
          </button>
        </div>
      </div>

      {/* Grid Table Surface */}
      <div className="flex-1 overflow-auto bg-[#0a0c12] relative scrollbar-none" onPaste={handlePaste}>
        <table className="w-full border-collapse text-xs select-none">
          <thead>
            <tr className="bg-[#161a29] border-b border-theme-divider text-theme-muted sticky top-0 z-20">
              <th className="w-12 p-2 border-r border-theme-divider text-center font-mono text-[10px]">#</th>
              {columns.map((col) => (
                <th key={col.key} className="p-2.5 border-r border-theme-divider text-left font-semibold text-white font-mono text-[11px]">
                  <div className="flex items-center justify-between">
                    <span>{col.label}</span>
                    {col.required && <span className="text-rose-400 text-[10px]">*</span>}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row, rIdx) => {
              const isHighlighted = highlightedRows.has(rIdx);
              return (
                <tr key={rIdx} className={`border-b border-theme-divider/50 transition-colors ${isHighlighted ? "bg-amber-500/10" : "hover:bg-[#151927]"}`}>
                  <td className="p-2 border-r border-theme-divider bg-[#121624] text-center font-mono text-[10px] text-theme-muted">
                    {rIdx + 1}
                  </td>
                  {columns.map((col) => {
                    const validation = validateCell(row, col.key, rows);
                    const isSelected = selectedCell?.rowIndex === rIdx && selectedCell?.colKey === col.key;

                    return (
                      <td
                        key={col.key}
                        onClick={() => setSelectedCell({ rowIndex: rIdx, colKey: col.key })}
                        className={`p-0 border-r border-theme-divider relative transition-all ${isSelected ? "ring-2 ring-emerald-500 z-10" : ""} ${
                          validation.status === "error"
                            ? "bg-rose-500/15"
                            : validation.status === "warning"
                            ? "bg-amber-500/15"
                            : validation.status === "formula"
                            ? "bg-blue-500/10"
                            : ""
                        }`}
                      >
                        <input
                          type="text"
                          value={row[col.key] ?? ""}
                          onChange={(e) => handleCellChange(rIdx, col.key, e.target.value)}
                          readOnly={isReadOnly}
                          className={`w-full h-full px-2.5 py-2 bg-transparent font-mono text-xs text-white outline-none border-none ${
                            validation.status === "error"
                              ? "text-rose-300 font-bold"
                              : validation.status === "formula"
                              ? "text-blue-300 font-semibold"
                              : ""
                          }`}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer Bar with Commit / Rollback Actions */}
      <div className="p-3 bg-[#11141f] border-t border-theme-divider flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-theme-muted font-mono">
        <div className="flex items-center gap-4">
          <span>Total Rows: <strong className="text-white">{rows.length}</strong></span>
          <span>Pending Edits: <strong className="text-amber-400">{transactionEngine.getPendingCount()}</strong></span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRollbackTransaction}
            disabled={isReadOnly}
            className="px-3 py-1.5 bg-[#1c2234] hover:bg-theme-surface-hover text-rose-400 border border-rose-500/30 rounded-xl transition-all cursor-pointer"
          >
            Rollback
          </button>
          <button
            onClick={handleCommitTransaction}
            disabled={isReadOnly}
            className="px-4 py-1.5 bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-500 hover:to-blue-500 text-white font-bold rounded-xl shadow-lg transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Save size={13} />
            <span>Commit Transactions to DB</span>
          </button>
        </div>
      </div>
    </div>
  );
}
