/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.32.0
 * Created      : 2026-08-21
 * Modified     : 2026-08-21
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import React, { useState, useMemo, useRef, useEffect } from "react";
import { 
  ClipboardPaste, Plus, Trash2, CheckCircle, 
  Sparkles, AlertCircle, RefreshCw, X, CheckCheck, AlertTriangle, HelpCircle
} from "lucide-react";
import { 
  ItemMasterFieldDefinition, 
  ItemMasterGridRow, 
  ItemMasterCommonFieldValues, 
  ALL_AVAILABLE_ITEM_FIELDS 
} from "../types.ts";
import { generateSkuCode } from "../../../services/skuGenerationEngine.ts";
import { HeaderMappingEngine } from "../../../lib/headerMapping/HeaderMappingEngine";
import { ColumnMappingResult } from "../../../lib/headerMapping/types";

// Singleton engine for item master column detection
const _itemMasterEngine = new HeaderMappingEngine();

interface ItemDetailsGridTabProps {
  selectedFieldIds: string[];
  commonFieldValues: ItemMasterCommonFieldValues;
  rows: ItemMasterGridRow[];
  onRowsChange: (newRows: ItemMasterGridRow[]) => void;
  onSaveRows: () => void;
  onCancel: () => void;
  isSaving?: boolean;
  onNotification?: (title: string, message: string, type?: "success" | "error") => void;
  allAvailableFields?: ItemMasterFieldDefinition[];
}

export const ItemDetailsGridTab: React.FC<ItemDetailsGridTabProps> = ({
  selectedFieldIds,
  commonFieldValues,
  rows,
  onRowsChange,
  onSaveRows,
  onCancel,
  isSaving = false,
  onNotification,
  allAvailableFields = ALL_AVAILABLE_ITEM_FIELDS
}) => {
  const [frozenColsCount, setFrozenColsCount] = useState<number>(1);
  const [selectedRowIndex, setSelectedRowIndex] = useState<number>(0);
  const [showPasteModal, setShowPasteModal] = useState<boolean>(false);
  const [pastedRawText, setPastedRawText] = useState<string>("");

  // ── Smart Column Detection State ─────────────────────────────────────────
  // Step 1 = paste textarea;  Step 2 = review detected mapping
  const [pasteStep, setPasteStep] = useState<1 | 2>(1);
  const [detectedMatrix, setDetectedMatrix] = useState<string[][]>([]);
  const [detectedHeaderRowIdx, setDetectedHeaderRowIdx] = useState<number>(0);
  const [detectedMappings, setDetectedMappings] = useState<ColumnMappingResult[]>([]);
  // Override map: sourceIndex → target fieldKey (user can change per column)
  const [mappingOverrides, setMappingOverrides] = useState<Record<number, string>>({});

  const tableContainerRef = useRef<HTMLDivElement>(null);

  const fieldMap = useMemo(() => {
    const map = new Map<string, ItemMasterFieldDefinition>();
    allAvailableFields.forEach(f => map.set(f.id, f));
    return map;
  }, [allAvailableFields]);

  const activeColumns = useMemo(() => {
    return selectedFieldIds.map(id => fieldMap.get(id) || {
      id,
      key: id,
      label: id.charAt(0).toUpperCase() + id.slice(1),
      isMandatory: false,
      type: "text" as const,
      width: "120px"
    });
  }, [selectedFieldIds, fieldMap]);

  // Ensure there is at least one row on mount
  useEffect(() => {
    if (rows.length === 0) {
      handleAddRow();
    }
  }, []);

  const createBlankRow = (index: number): ItemMasterGridRow => {
    const defaultTax = commonFieldValues.taxRate ? `STD_${commonFieldValues.taxRate}` : "STD_18";
    return {
      id: `row-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      stockNo: `STK-${1000 + rows.length + index + 1}`,
      barcode: "",
      product: "",
      brand: commonFieldValues.brand || "",
      style: "",
      shade: "",
      size: "",
      itemDescription: "",
      mrp: "",
      sellingPrice: "",
      dealerPrice: "",
      costPrice: "",
      productTax: defaultTax,
      hsnCode: "",
      uom: "Pcs",
      customFields: {},
      isNewRow: true
    };
  };

  const handleAddRow = () => {
    const newRow = createBlankRow(0);
    onRowsChange([...rows, newRow]);
    setSelectedRowIndex(rows.length);
  };

  const handleDeleteRow = (indexToDelete: number) => {
    if (rows.length <= 1) {
      // Clear single row instead of empty array
      const cleared = [createBlankRow(0)];
      onRowsChange(cleared);
      setSelectedRowIndex(0);
      return;
    }
    const filtered = rows.filter((_, idx) => idx !== indexToDelete);
    onRowsChange(filtered);
    if (selectedRowIndex >= filtered.length) {
      setSelectedRowIndex(filtered.length - 1);
    }
  };

  const handleCellChange = (rowIndex: number, fieldKey: string, value: string) => {
    const updated = [...rows];
    const targetRow = { ...updated[rowIndex] };

    if (fieldKey in targetRow && fieldKey !== "customFields" && fieldKey !== "attributes") {
      (targetRow as any)[fieldKey] = value;
    } else {
      targetRow.customFields = {
        ...(targetRow.customFields || {}),
        [fieldKey]: value
      };
      (targetRow as any)[fieldKey] = value;
    }

    // Smart auto-fill for descriptions and pricing
    if (fieldKey === "product" && !targetRow.itemDescription) {
      targetRow.itemDescription = value;
    }
    if (fieldKey === "mrp" && !targetRow.sellingPrice && value) {
      targetRow.sellingPrice = value;
    }

    updated[rowIndex] = targetRow;
    onRowsChange(updated);
  };

  const handleAutoGenerateSkus = () => {
    const updated = rows.map((row, idx) => {
      if (!row.stockNo || row.stockNo.startsWith("STK-")) {
        const sku = generateSkuCode({
          brand: row.brand || commonFieldValues.brand || "GEN",
          styleCode: row.style || "STYLE",
          colour: row.shade || "STD",
          size: row.size || "M"
        }, { mode: "AUTO", prefix: "SKU", sequenceStart: 1001 }, idx);

        return { ...row, stockNo: sku };
      }
      return row;
    });

    onRowsChange(updated);
    if (onNotification) {
      onNotification("SKUs Generated", "Auto-generated standardized SKU codes for rows.", "success");
    }
  };

  // ── Step 1: Analyse pasted text and detect headers ───────────────────────
  const handleAnalysePaste = () => {
    if (!pastedRawText.trim()) return;

    const lines = pastedRawText.trim().split(/\r\n|\n|\r/);
    const matrix = lines.map(l => l.split("\t"));
    if (matrix.length === 0) return;

    const headerInfo = _itemMasterEngine.detectHeaderRow(matrix);
    const hasHeaders = headerInfo.headers.some(h => _itemMasterEngine.isKnownHeader(
      h.toLowerCase().replace(/[^a-z0-9]/g, " ").trim()
    ));

    if (hasHeaders) {
      // Header row found → map columns and show Step 2 review panel
      const engineResult = _itemMasterEngine.mapHeaders(headerInfo.headers, 'ITEM_MASTER');
      setDetectedMatrix(matrix);
      setDetectedHeaderRowIdx(headerInfo.headerRowIndex);
      setDetectedMappings(engineResult.columns);
      setMappingOverrides({});
      setPasteStep(2);
    } else {
      // No recognisable headers → positional sequential import (original behaviour)
      handlePositionalImport(matrix, 0);
    }
  };

  // ── Step 2: Apply confirmed column mapping and import rows ────────────────
  const handleConfirmMapping = () => {
    // Build final mapping: sourceIndex → fieldKey
    const finalMap = new Map<number, string>();
    detectedMappings.forEach(m => {
      const override = mappingOverrides[m.sourceIndex];
      const targetKey = override !== undefined ? override : (m.mappedFieldKey ?? "");
      if (targetKey) finalMap.set(m.sourceIndex, targetKey);
    });

    const dataRows = detectedMatrix.slice(detectedHeaderRowIdx + 1);
    const parsedRows: ItemMasterGridRow[] = [];

    dataRows.forEach((rowTokens, lIdx) => {
      if (rowTokens.every(t => !t.trim())) return; // skip blank rows
      const newRow = createBlankRow(lIdx);

      finalMap.forEach((fieldKey, srcIdx) => {
        const val = (rowTokens[srcIdx] || "").trim();
        if (!val) return;
        if (fieldKey in newRow && fieldKey !== "customFields" && fieldKey !== "attributes") {
          (newRow as any)[fieldKey] = val;
        } else {
          newRow.customFields = { ...(newRow.customFields || {}), [fieldKey]: val };
          (newRow as any)[fieldKey] = val;
        }
      });

      // Smart auto-fill
      if (newRow.product && !newRow.itemDescription) newRow.itemDescription = newRow.product;
      if (newRow.mrp && !newRow.sellingPrice) newRow.sellingPrice = newRow.mrp;

      parsedRows.push(newRow);
    });

    if (parsedRows.length > 0) {
      onRowsChange(parsedRows);
      closePasteModal();
      setSelectedRowIndex(0);
      if (onNotification) {
        onNotification(
          "Imported Successfully",
          `${parsedRows.length} rows imported with auto-detected column mapping.`,
          "success"
        );
      }
    }
  };

  // ── Positional (no-header) sequential import ──────────────────────────────
  const handlePositionalImport = (matrix: string[][], startRow: number) => {
    const parsedRows: ItemMasterGridRow[] = [];

    matrix.slice(startRow).forEach((tokens, lIdx) => {
      if (tokens.every(t => !t.trim())) return;
      const newRow = createBlankRow(lIdx);

      activeColumns.forEach((col, cIdx) => {
        if (cIdx < tokens.length) {
          const val = tokens[cIdx].trim();
          if (col.key in newRow && col.key !== "customFields" && col.key !== "attributes") {
            (newRow as any)[col.key] = val;
          } else {
            newRow.customFields = { ...(newRow.customFields || {}), [col.key]: val };
            (newRow as any)[col.key] = val;
          }
        }
      });
      parsedRows.push(newRow);
    });

    if (parsedRows.length > 0) {
      onRowsChange(parsedRows);
      closePasteModal();
      setSelectedRowIndex(0);
      if (onNotification) {
        onNotification(
          "Pasted (Positional)",
          `${parsedRows.length} rows imported in sequential column order.`,
          "success"
        );
      }
    }
  };

  const closePasteModal = () => {
    setShowPasteModal(false);
    setPastedRawText("");
    setPasteStep(1);
    setDetectedMatrix([]);
    setDetectedMappings([]);
    setMappingOverrides({});
  };

  // Legacy alias kept for any existing call sites
  const handleParsePastedData = handleAnalysePaste;


  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm overflow-hidden font-sans">
      
      {/* Context Controls Bar */}
      <div className="bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 px-6 py-3 flex flex-wrap justify-between items-center gap-4 shrink-0">
        <div>
          <h2 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
            Item Details — Tactical Spreadsheet Grid
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Rapid catalog management and batch matrix data entry.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          {/* Frozen Columns Controller */}
          <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-1.5 rounded text-xs shadow-xs">
            <label htmlFor="frozen-cols-input" className="text-slate-600 dark:text-slate-400 font-semibold">
              Frozen Columns:
            </label>
            <input
              id="frozen-cols-input"
              type="number"
              min="0"
              max="5"
              value={frozenColsCount}
              onChange={e => setFrozenColsCount(Math.max(0, Math.min(5, parseInt(e.target.value) || 0)))}
              className="w-12 h-6 text-center font-mono font-bold bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-white outline-none focus:border-blue-600"
            />
          </div>

          <button
            type="button"
            onClick={handleAutoGenerateSkus}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800 rounded transition"
            title="Auto generate standard SKU codes"
          >
            <Sparkles size={13} />
            Auto SKU
          </button>

          <button
            type="button"
            onClick={() => setShowPasteModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded transition shadow-xs"
          >
            <ClipboardPaste size={13} />
            Paste from Excel
          </button>

          <button
            type="button"
            onClick={handleAddRow}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-blue-700 hover:bg-blue-600 rounded transition shadow"
          >
            <Plus size={14} />
            Add Row
          </button>
        </div>
      </div>

      {/* Main Tactical Grid Table Container */}
      <div 
        ref={tableContainerRef} 
        className="flex-1 overflow-auto bg-slate-100 dark:bg-slate-950 min-h-[380px]"
      >
        <table className="w-full text-left whitespace-nowrap border-collapse min-w-[1200px]">
          {/* Table Header */}
          <thead className="bg-[#F4F5F7] dark:bg-slate-800 sticky top-0 z-30 shadow-xs">
            <tr className="border-b border-slate-300 dark:border-slate-700">
              {/* Row Index Column */}
              <th className="w-12 px-3 py-2.5 border-r border-slate-300 dark:border-slate-700 text-center text-[11px] font-bold text-slate-500 uppercase sticky left-0 z-40 bg-[#F4F5F7] dark:bg-slate-800">
                #
              </th>

              {/* Dynamic Columns */}
              {activeColumns.map((col, idx) => {
                const isFrozen = idx < frozenColsCount;
                // Calculate sticky left offset
                const leftOffset = isFrozen ? (idx === 0 ? 48 : 48 + 140 * idx) : undefined;

                return (
                  <th
                    key={col.id}
                    style={{
                      width: col.width || "120px",
                      minWidth: col.width || "120px",
                      left: isFrozen ? `${leftOffset}px` : undefined,
                      textAlign: col.align || "left"
                    }}
                    className={`px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider border-r border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 ${
                      isFrozen
                        ? "sticky z-30 bg-[#F4F5F7] dark:bg-slate-800 border-r-2 border-r-slate-400 dark:border-r-slate-600 shadow-xs"
                        : "bg-[#F4F5F7] dark:bg-slate-800"
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      <span>{col.label}</span>
                      {col.isMandatory && <span className="text-red-500">*</span>}
                    </div>
                  </th>
                );
              })}

              {/* Row Actions Header */}
              <th className="w-12 px-2 py-2.5 text-center text-[11px] font-bold uppercase text-slate-500 border-l border-slate-300 dark:border-slate-700">
                Action
              </th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-200 dark:divide-slate-800 text-xs">
            {rows.map((row, rIdx) => {
              const isSelected = selectedRowIndex === rIdx;

              return (
                <tr
                  key={row.id || `row-${rIdx}`}
                  onClick={() => setSelectedRowIndex(rIdx)}
                  className={`transition group ${
                    isSelected
                      ? "bg-blue-50/80 dark:bg-blue-950/40 border-l-4 border-l-blue-600"
                      : "hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  }`}
                >
                  {/* Row Index Cell */}
                  <td className={`px-3 py-2 text-center text-[11px] font-mono font-bold text-slate-500 border-r border-slate-200 dark:border-slate-800 sticky left-0 z-20 ${
                    isSelected ? "bg-blue-100/90 dark:bg-blue-900/60 text-blue-900 dark:text-blue-200" : "bg-[#F4F5F7] dark:bg-slate-800"
                  }`}>
                    {rIdx + 1}
                  </td>

                  {/* Column Cells */}
                  {activeColumns.map((col, cIdx) => {
                    const isFrozen = cIdx < frozenColsCount;
                    const leftOffset = isFrozen ? (cIdx === 0 ? 48 : 48 + 140 * cIdx) : undefined;
                    const cellValue = (row as any)[col.key] !== undefined && (row as any)[col.key] !== null && (row as any)[col.key] !== ""
                      ? (row as any)[col.key] 
                      : (row.customFields?.[col.key] ?? row.customFields?.[col.id] ?? row.attributes?.[col.key] ?? row.attributes?.[col.label] ?? "");

                    return (
                      <td
                        key={`${row.id}-${col.id}`}
                        style={{
                          left: isFrozen ? `${leftOffset}px` : undefined,
                          textAlign: col.align || "left"
                        }}
                        className={`px-2.5 py-1.5 border-r border-slate-200 dark:border-slate-800 ${
                          isFrozen
                            ? "sticky z-10 bg-inherit border-r-2 border-r-slate-400 dark:border-r-slate-600"
                            : ""
                        }`}
                      >
                        {col.type === "select" ? (
                          <select
                            value={cellValue}
                            onChange={e => handleCellChange(rIdx, col.key, e.target.value)}
                            className="w-full bg-transparent border-none p-1 text-xs text-slate-900 dark:text-slate-100 outline-none focus:bg-white dark:focus:bg-slate-800 focus:ring-1 focus:ring-blue-500 rounded cursor-pointer"
                          >
                            <option value="">-</option>
                            {(col.options || ["STD_18", "GST_12", "GST_5", "EXEMPT"]).map(opt => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type={col.type === "number" || col.type === "currency" ? "text" : "text"}
                            value={cellValue}
                            onChange={e => handleCellChange(rIdx, col.key, e.target.value)}
                            placeholder={col.key === "stockNo" ? "[Auto]" : ""}
                            className={`w-full bg-transparent border-none p-1 text-xs text-slate-900 dark:text-slate-100 outline-none focus:bg-white dark:focus:bg-slate-800 focus:ring-1 focus:ring-blue-500 rounded ${
                              col.align === "right" ? "text-right font-mono" : ""
                            } ${col.key === "stockNo" ? "font-mono font-bold text-blue-700 dark:text-blue-400" : ""}`}
                          />
                        )}
                      </td>
                    );
                  })}

                  {/* Row Delete Action */}
                  <td className="px-2 py-1.5 text-center border-l border-slate-200 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteRow(rIdx);
                      }}
                      className="p-1 text-slate-400 hover:text-red-600 rounded transition opacity-60 group-hover:opacity-100"
                      title="Delete row"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Grid Footer Actions Bar */}
      <div className="bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-6 py-3 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-400">
          <span className="font-semibold">
            Row <span className="text-blue-600 font-bold">{selectedRowIndex + 1}</span> of {rows.length}
          </span>
          <span className="text-slate-300 dark:text-slate-700">•</span>
          <span>Shortcuts: <kbd className="bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded font-mono text-[10px]">Alt+1</kbd> View | <kbd className="bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded font-mono text-[10px]">Alt+2</kbd> Common Fields | <kbd className="bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded font-mono text-[10px]">Alt+3</kbd> Grid</span>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="px-6 py-2 bg-transparent border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition min-w-[100px]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSaveRows}
            disabled={isSaving}
            className="px-6 py-2 bg-blue-700 hover:bg-blue-600 text-white font-bold text-xs rounded transition shadow flex items-center gap-2 min-w-[120px] justify-center disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <CheckCircle size={15} />
                OK / Save Items
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Paste From Excel Modal ───────────────────────────────────────── */}
      {showPasteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg shadow-2xl w-full max-w-3xl flex flex-col gap-0 overflow-hidden">

            {/* Modal Header */}
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 px-5 py-3.5 bg-slate-50 dark:bg-slate-900 shrink-0">
              <div className="flex items-center gap-2.5">
                <ClipboardPaste size={18} className="text-blue-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wide">
                    Paste From Excel / Google Sheets
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {pasteStep === 1 ? "Step 1 of 2 — Paste your copied cells below" : "Step 2 of 2 — Review auto-detected column mapping"}
                  </p>
                </div>
              </div>
              <button type="button" onClick={closePasteModal} className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded">
                <X size={18} />
              </button>
            </div>

            {/* ── STEP 1: Paste textarea ─────────────────────────────────── */}
            {pasteStep === 1 && (
              <div className="flex flex-col gap-4 p-5">
                <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-xs text-blue-800 dark:text-blue-200 flex gap-2">
                  <AlertCircle size={14} className="shrink-0 mt-0.5 text-blue-500" />
                  <span>
                    Select cells in Excel or Google Sheets and press <kbd className="bg-white border border-blue-200 px-1 py-0.5 rounded font-mono text-[10px]">Ctrl+C</kbd>,
                    then click inside the box below and press <kbd className="bg-white border border-blue-200 px-1 py-0.5 rounded font-mono text-[10px]">Ctrl+V</kbd>.
                    Column headers in your spreadsheet will be <strong>auto-detected and mapped</strong> to the correct Item Master fields.
                  </span>
                </div>

                <textarea
                  rows={8}
                  value={pastedRawText}
                  onChange={e => setPastedRawText(e.target.value)}
                  placeholder="Paste tab-separated rows here (Ctrl+V)..."
                  autoFocus
                  className="w-full p-3 font-mono text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 resize-none"
                />

                <div className="text-xs text-slate-500 dark:text-slate-400">
                  <strong>Tip:</strong> If your spreadsheet has a header row (like <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">SKU, Name, Barcode...</span>), SMRITI will auto-detect and map them. If not, columns map positionally left-to-right.
                </div>

                <div className="flex justify-end gap-3 pt-1">
                  <button type="button" onClick={closePasteModal}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded border border-slate-300 dark:border-slate-700">
                    Cancel
                  </button>
                  <button type="button" onClick={handleAnalysePaste} disabled={!pastedRawText.trim()}
                    className="px-5 py-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-600 rounded transition disabled:opacity-50 shadow flex items-center gap-1.5">
                    <Sparkles size={13} />
                    Detect Columns
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP 2: Column mapping review ──────────────────────────── */}
            {pasteStep === 2 && (
              <div className="flex flex-col gap-0 overflow-hidden">

                {/* Summary banner */}
                <div className="bg-emerald-50 dark:bg-emerald-950/40 border-b border-emerald-200 dark:border-emerald-800 px-5 py-2.5 flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-200 shrink-0">
                  <CheckCheck size={14} className="text-emerald-600" />
                  <span>
                    Detected <strong>{detectedMappings.filter(m => m.mappedFieldKey).length}</strong> auto-mapped columns
                    from <strong>{detectedMatrix.length - detectedHeaderRowIdx - 1}</strong> data rows.
                    Review and adjust below, then click <strong>Import</strong>.
                  </span>
                </div>

                {/* Column mapping table */}
                <div className="overflow-auto max-h-64 border-b border-slate-200 dark:border-slate-800">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                      <tr>
                        <th className="px-4 py-2 text-left border-r border-slate-200 dark:border-slate-700 w-8">#</th>
                        <th className="px-4 py-2 text-left border-r border-slate-200 dark:border-slate-700">Excel Column Header</th>
                        <th className="px-4 py-2 text-left border-r border-slate-200 dark:border-slate-700">Confidence</th>
                        <th className="px-4 py-2 text-left">Maps To (SMRITI Field)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {detectedMappings.map((m) => {
                        const override = mappingOverrides[m.sourceIndex];
                        const effectiveKey = override !== undefined ? override : (m.mappedFieldKey ?? "");
                        const isAutoMapped = (m.confidence === 'EXACT' || m.confidence === 'HIGH') && !override;
                        const isSuggested = (m.confidence === 'MEDIUM' || m.confidence === 'LOW') && !override;
                        const isUnknown = !m.mappedFieldKey && !override;

                        return (
                          <tr key={m.sourceIndex} className={`${
                            isAutoMapped ? 'bg-emerald-50/60 dark:bg-emerald-950/20' :
                            isSuggested ? 'bg-amber-50/60 dark:bg-amber-950/20' :
                            'bg-rose-50/40 dark:bg-rose-950/10'
                          }`}>
                            <td className="px-4 py-2 text-slate-500 font-mono border-r border-slate-200 dark:border-slate-700">{m.sourceIndex + 1}</td>
                            <td className="px-4 py-2 border-r border-slate-200 dark:border-slate-700">
                              <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{m.sourceHeader}</span>
                            </td>
                            <td className="px-4 py-2 border-r border-slate-200 dark:border-slate-700">
                              {isAutoMapped && (
                                <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-semibold">
                                  <CheckCheck size={12} /> Auto
                                </span>
                              )}
                              {isSuggested && (
                                <span className="flex items-center gap-1 text-amber-700 dark:text-amber-400 font-semibold">
                                  <AlertTriangle size={12} /> Suggested
                                </span>
                              )}
                              {isUnknown && !override && (
                                <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400 font-semibold">
                                  <HelpCircle size={12} /> Unknown
                                </span>
                              )}
                              {override && (
                                <span className="flex items-center gap-1 text-blue-700 dark:text-blue-400 font-semibold">
                                  <CheckCircle size={12} /> Manual
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-1.5">
                              <select
                                value={effectiveKey}
                                onChange={e => setMappingOverrides(prev => ({ ...prev, [m.sourceIndex]: e.target.value }))}
                                className="w-full border border-slate-300 dark:border-slate-600 rounded px-2 py-1 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                              >
                                <option value="">(Skip this column)</option>
                                {ALL_AVAILABLE_ITEM_FIELDS.map(f => (
                                  <option key={f.id} value={f.key}>{f.label}</option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Sample data preview */}
                {detectedMatrix.length > detectedHeaderRowIdx + 1 && (
                  <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Sample Data Preview (first row)</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(detectedMatrix[detectedHeaderRowIdx + 1] || []).slice(0, 10).map((cell, idx) => (
                        <span key={idx} className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded text-[10px] font-mono text-slate-700 dark:text-slate-300">
                          <span className="text-slate-400">{detectedMappings[idx]?.sourceHeader || `Col ${idx+1}`}: </span>
                          {cell.trim() || <em className="text-slate-300">empty</em>}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Footer actions */}
                <div className="flex justify-between items-center px-5 py-3 bg-slate-50 dark:bg-slate-900 shrink-0">
                  <button type="button" onClick={() => setPasteStep(1)}
                    className="text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center gap-1">
                    ← Back to Paste
                  </button>
                  <div className="flex gap-3">
                    <button type="button" onClick={closePasteModal}
                      className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded border border-slate-300 dark:border-slate-700">
                      Cancel
                    </button>
                    <button type="button" onClick={handleConfirmMapping}
                      disabled={detectedMappings.every(m => !(mappingOverrides[m.sourceIndex] ?? m.mappedFieldKey))}
                      className="px-6 py-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-600 rounded transition disabled:opacity-40 shadow flex items-center gap-1.5">
                      <CheckCheck size={13} />
                      Import {detectedMatrix.length - detectedHeaderRowIdx - 1} Rows
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      )}


    </div>
  );
};
