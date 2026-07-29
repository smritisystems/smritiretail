/**
 * Project      : SMRITI Retail OS
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
  CheckCircle2, Search, Filter, Layers, Maximize2, Zap
} from "lucide-react";
import { evaluateFormula, isFormula } from "../../services/formulaEngine";
import { parseAIPrompt, executeAISpreadsheetCommand } from "../../services/aiSpreadsheetAssistant";
import { isValidGSTIN, isValidPIN } from "../../utils/validators";

export interface SpreadsheetColumn {
  key: string;
  label: string;
  required?: boolean;
  type?: "text" | "number" | "select";
  options?: string[];
  aliases?: string[];
}

export interface SmritiSpreadsheetStudioProps<TRow = Record<string, any>> {
  title?: string;
  subtitle?: string;
  columns: SpreadsheetColumn[];
  initialData?: TRow[];
  onSaveData?: (data: TRow[]) => Promise<void> | void;
  onNotification?: (title: string, message: string, type?: "success" | "error") => void;
  isReadOnly?: boolean;
}

export function SmritiSpreadsheetStudio<TRow extends Record<string, any>>({
  title = "SMRITI Spreadsheet Studio",
  subtitle = "Live Excel Workspace — Real-time database grid editing, formulas, clipboard engine, and AI assistant",
  columns,
  initialData = [],
  onSaveData,
  onNotification,
  isReadOnly = false,
}: SmritiSpreadsheetStudioProps<TRow>) {
  const [rows, setRows] = useState<Record<string, any>[]>(initialData);
  const [selectedCell, setSelectedCell] = useState<{ rowIndex: number; colKey: string } | null>(null);
  const [formulaInput, setFormulaInput] = useState<string>("");
  const [aiPrompt, setAiPrompt] = useState<string>("");
  const [isAiProcessing, setIsAiProcessing] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [savedStatus, setSavedStatus] = useState<string>("✓ Synced");
  const [highlightedRows, setHighlightedRows] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState<string>("");

  useEffect(() => {
    if (initialData && initialData.length > 0) {
      setRows(initialData);
    }
  }, [initialData]);

  // Sync formula input when selected cell changes
  useEffect(() => {
    if (selectedCell) {
      const cellVal = rows[selectedCell.rowIndex]?.[selectedCell.colKey] ?? "";
      setFormulaInput(cellVal.toString());
    } else {
      setFormulaInput("");
    }
  }, [selectedCell, rows]);

  // Live Formula Context Evaluator
  const getContextForCell = useCallback(
    (targetRowIndex: number): any => ({
      getValue: (cellRef: string) => {
        const row = rows[targetRowIndex];
        if (!row) return 0;
        if (cellRef in row) return row[cellRef];
        // Handle Excel A1 / C2 cell reference conversion
        const match = cellRef.match(/^([A-Z]+)(\d+)$/i);
        if (match) {
          const colLetters = match[1].toUpperCase();
          const rIndex = parseInt(match[2], 10) - 1;
          const targetRow = rows[rIndex];
          const cIndex = colLetters.charCodeAt(0) - 65;
          const col = columns[cIndex];
          if (targetRow && col) {
            return targetRow[col.key] ?? 0;
          }
        }
        return 0;
      },
    }),
    [rows, columns]
  );

  // Handle Cell Content Edit
  const handleCellChange = (rowIndex: number, colKey: string, value: string) => {
    if (isReadOnly) return;
    const updated = [...rows];
    updated[rowIndex] = { ...updated[rowIndex], [colKey]: value };

    // Auto-evaluate formula if cell starts with '='
    if (isFormula(value)) {
      const computed = evaluateFormula(value, getContextForCell(rowIndex));
      updated[rowIndex][colKey] = computed.toString();
    }

    setRows(updated);
    setSavedStatus("Editing...");
    triggerAutoSave(updated);
  };

  // Auto-Save Debouncer
  const triggerAutoSave = useCallback(
    async (currentRows: Record<string, any>[]) => {
      setIsSaving(true);
      try {
        if (onSaveData) {
          await onSaveData(currentRows as TRow[]);
        }
        setSavedStatus("✓ Saved to DB");
      } catch (err) {
        setSavedStatus("⚠️ Save Error");
        console.error("Auto-save failed:", err);
      } finally {
        setIsSaving(false);
      }
    },
    [onSaveData]
  );

  // MS Excel 5,000+ Row Clipboard Paste Engine
  const handlePaste = (e: React.ClipboardEvent) => {
    if (isReadOnly) return;
    const clipboardData = e.clipboardData.getData("text");
    if (!clipboardData) return;

    // Check if clipboard contains multi-cell TSV / CSV data
    const lines = clipboardData.split(/\r\n|\n/).filter((l) => l.trim() !== "");
    if (lines.length === 0) return;

    const firstLine = lines[0];
    const isMultiCell = firstLine.includes("\t") || firstLine.includes(",");

    if (isMultiCell) {
      e.preventDefault();
      const delimiter = firstLine.includes("\t") ? "\t" : ",";
      const parsedRows: Record<string, any>[] = [];

      lines.forEach((line) => {
        const values = line.split(delimiter);
        const rowObj: Record<string, any> = {};
        columns.forEach((col, idx) => {
          rowObj[col.key] = values[idx] !== undefined ? values[idx].trim() : "";
        });
        parsedRows.push(rowObj);
      });

      const nextRows = [...rows, ...parsedRows];
      setRows(nextRows);
      if (onNotification) {
        onNotification(
          "Pasted from Clipboard",
          `Imported ${parsedRows.length} rows directly from Excel workspace.`,
          "success"
        );
      }
      triggerAutoSave(nextRows);
    }
  };

  // Run AI Assistant Command
  const handleRunAI = () => {
    if (!aiPrompt.trim() || isReadOnly) return;
    setIsAiProcessing(true);
    const cmd = parseAIPrompt(aiPrompt);

    if (!cmd) {
      if (onNotification) {
        onNotification("AI Assistant Notice", "Command not recognized. Try: 'Increase MRP by 7%' or 'Fill missing HSN'.", "error");
      }
      setIsAiProcessing(false);
      return;
    }

    const { updatedRows, result } = executeAISpreadsheetCommand(rows, cmd);
    setRows(updatedRows);
    setHighlightedRows(new Set(result.highlightedRowIndices));
    setIsAiProcessing(false);
    if (onNotification) {
      onNotification("AI Action Applied", result.summary, "success");
    }
    triggerAutoSave(updatedRows);
  };

  // Live Cell Validation Visualizer
  const getCellValidationStatus = (row: Record<string, any>, colKey: string): "error" | "warning" | "valid" | "formula" => {
    const val = (row[colKey] ?? "").toString().trim();
    if (isFormula(val)) return "formula";

    if (colKey === "gstPercentage") {
      const num = parseFloat(val);
      if (isNaN(num) || num < 0 || num > 50) return "error";
    }

    if (colKey === "gstin" && val !== "") {
      if (!isValidGSTIN(val)) return "error";
    }

    if (colKey === "pinCode" && val !== "") {
      if (!isValidPIN(val)) return "error";
    }

    return "valid";
  };

  // Filtered Rows for Quick Search
  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return rows;
    const q = searchQuery.toLowerCase();
    return rows.filter((r) =>
      Object.values(r).some((v) => (v ?? "").toString().toLowerCase().includes(q))
    );
  }, [rows, searchQuery]);

  return (
    <div className="flex flex-col h-full bg-[#0d1017] text-theme-body rounded-2xl border border-theme-divider overflow-hidden font-sans">
      {/* ── Top Header & Branding ────────────────────────────────────────────── */}
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
          <span className="text-xs font-mono px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
            <Zap size={12} /> {savedStatus}
          </span>

          <div className="relative w-64">
            <Search size={14} className="absolute left-3 top-2.5 text-theme-muted" />
            <input
              type="text"
              placeholder="Search live grid..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#1c2234] border border-theme-divider rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-theme-muted outline-none focus:border-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* ── Formula Bar & AI Assistant Toolbar ──────────────────────────────── */}
      <div className="p-3 bg-[#11141f] border-b border-theme-divider grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
        {/* Formula Bar (7 cols) */}
        <div className="md:col-span-7 flex items-center gap-2 bg-[#1a1f30] px-3 py-1.5 rounded-xl border border-theme-divider">
          <span className="text-xs font-mono font-bold text-emerald-400 italic shrink-0">fx =</span>
          <input
            type="text"
            placeholder={selectedCell ? `Formula for cell [Row ${selectedCell.rowIndex + 1}, ${selectedCell.colKey}] (e.g. =costPrice * 1.25)` : "Select a cell to enter formula..."}
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

        {/* AI Assistant Quick Actions (5 cols) */}
        <div className="md:col-span-5 flex items-center gap-2">
          <div className="relative flex-1">
            <Sparkles size={14} className="absolute left-3 top-2.5 text-amber-400" />
            <input
              type="text"
              placeholder="AI Action: 'Increase MRP by 10%' or 'Fill HSN'..."
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
            {isAiProcessing ? "Applying..." : "Run AI"}
          </button>
        </div>
      </div>

      {/* ── Live Excel Grid Surface ─────────────────────────────────────────── */}
      <div
        className="flex-1 overflow-auto bg-[#0a0c12] relative scrollbar-none"
        onPaste={handlePaste}
      >
        <table className="w-full border-collapse text-xs select-none">
          <thead>
            <tr className="bg-[#161a29] border-b border-theme-divider text-theme-muted sticky top-0 z-20">
              <th className="w-12 p-2 border-r border-theme-divider text-center font-mono text-[10px]">#</th>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="p-2.5 border-r border-theme-divider text-left font-semibold text-white font-mono text-[11px]"
                >
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
                <tr
                  key={rIdx}
                  className={`border-b border-theme-divider/50 transition-colors ${
                    isHighlighted ? "bg-amber-500/10" : "hover:bg-[#151927]"
                  }`}
                >
                  {/* Row Index Indicator */}
                  <td className="p-2 border-r border-theme-divider bg-[#121624] text-center font-mono text-[10px] text-theme-muted">
                    {rIdx + 1}
                  </td>

                  {/* Dynamic Column Cells */}
                  {columns.map((col) => {
                    const status = getCellValidationStatus(row, col.key);
                    const isSelected =
                      selectedCell?.rowIndex === rIdx && selectedCell?.colKey === col.key;

                    return (
                      <td
                        key={col.key}
                        onClick={() => setSelectedCell({ rowIndex: rIdx, colKey: col.key })}
                        className={`p-0 border-r border-theme-divider relative transition-all ${
                          isSelected ? "ring-2 ring-emerald-500 z-10" : ""
                        } ${
                          status === "error"
                            ? "bg-rose-500/15"
                            : status === "formula"
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
                            status === "error"
                              ? "text-rose-300 font-bold"
                              : status === "formula"
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

      {/* ── Bottom Grid Footer Bar ──────────────────────────────────────────── */}
      <div className="p-3 bg-[#11141f] border-t border-theme-divider flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-theme-muted font-mono">
        <div className="flex items-center gap-4">
          <span>Rows: <strong className="text-white">{rows.length}</strong></span>
          <span>Columns: <strong className="text-white">{columns.length}</strong></span>
          {selectedCell && (
            <span className="text-emerald-400">
              Cell: [Row {selectedCell.rowIndex + 1}, {selectedCell.colKey}]
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const newRow: Record<string, any> = {};
              columns.forEach((c) => (newRow[c.key] = ""));
              setRows([...rows, newRow]);
            }}
            disabled={isReadOnly}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-all cursor-pointer"
          >
            + Add Row
          </button>
        </div>
      </div>
    </div>
  );
}
