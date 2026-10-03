/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.55.0
 * Created      : 2026-10-03
 * Modified     : 2026-10-03
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: SMRITI Global Grid Input & Import Standard
 */

import React, { useState, useRef, useMemo, useEffect } from "react";
import {
  Upload,
  X,
  FileText,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Layers,
  ArrowRight,
  Clipboard,
  Scan,
  RefreshCw,
  Search,
  Filter,
  Check,
  ShieldAlert,
} from "lucide-react";
import {
  GridInputProfile,
  GridProfileId,
  GridImportMode,
  GridDuplicatePolicy,
  ParsedGridRow,
  GridInputParseResult,
} from "../../services/gridInput/types";
import { GRID_PROFILES } from "../../services/gridInput/gridProfiles";
import { GridInputEngine } from "../../services/gridInput/gridInputEngine";
import { ColumnMappingResult } from "../../lib/headerMapping/types";

export interface GlobalGridImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: GridInputProfile | GridProfileId;
  title?: string;
  companyId?: string;
  existingRowCount?: number;
  onCommit: (rows: ParsedGridRow[], mode: GridImportMode) => void;
}

type InputTab = "PASTE" | "FILE" | "SCANNER";
type Step = "INPUT" | "MAPPING" | "PREVIEW";

export const GlobalGridImportModal: React.FC<GlobalGridImportModalProps> = ({
  isOpen,
  onClose,
  profile: profileOrId,
  title,
  companyId,
  existingRowCount = 0,
  onCommit,
}) => {
  const profile: GridInputProfile = useMemo(() => {
    return typeof profileOrId === "string" ? GRID_PROFILES[profileOrId] : profileOrId;
  }, [profileOrId]);

  // Wizard state
  const [activeTab, setActiveTab] = useState<InputTab>("PASTE");
  const [currentStep, setCurrentStep] = useState<Step>("INPUT");
  const [rawText, setRawText] = useState("");
  const [delimiterOverride, setDelimiterOverride] = useState<string>("");
  const [importMode, setImportMode] = useState<GridImportMode>(profile.defaultImportMode);
  const [duplicatePolicy, setDuplicatePolicy] = useState<GridDuplicatePolicy>(
    profile.defaultDuplicatePolicy
  );

  // Scanner state
  const [scannerBuffer, setScannerBuffer] = useState<string[]>([]);
  const [scannerInputVal, setScannerInputVal] = useState("");
  const scannerInputRef = useRef<HTMLInputElement>(null);

  // Engine state
  const [rawMatrix, setRawMatrix] = useState<string[][]>([]);
  const [columnMappings, setColumnMappings] = useState<ColumnMappingResult[]>([]);
  const [hasHeaders, setHasHeaders] = useState(false);
  const [headerRowIndex, setHeaderRowIndex] = useState(0);
  const [dataRows, setDataRows] = useState<string[][]>([]);
  const [parsedRows, setParsedRows] = useState<ParsedGridRow[]>([]);
  const [isResolving, setIsResolving] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentStep("INPUT");
      setActiveTab("PASTE");
      setRawText("");
      setScannerBuffer([]);
      setScannerInputVal("");
      setRawMatrix([]);
      setColumnMappings([]);
      setParsedRows([]);
      setImportMode(profile.defaultImportMode);
      setDuplicatePolicy(profile.defaultDuplicatePolicy);
    }
  }, [isOpen, profile]);

  if (!isOpen) return null;

  // Process raw text into matrix and mapping
  const processRawInput = (textToProcess: string) => {
    const { matrix, delimiter } = GridInputEngine.parseDelimitedText(
      textToProcess,
      delimiterOverride || undefined
    );

    if (matrix.length === 0) {
      alert("No data detected. Please paste or enter rows.");
      return;
    }

    setRawMatrix(matrix);

    const mappingRes = GridInputEngine.mapColumns(matrix, profile);
    setColumnMappings(mappingRes.columnMappings);
    setHasHeaders(mappingRes.hasHeaders);
    setHeaderRowIndex(mappingRes.headerRowIndex);
    setDataRows(mappingRes.dataRows);

    // If headers exist and mapping is confident, or if single column, we can proceed
    if (matrix[0].length <= 1) {
      // Direct barcode list: jump to resolution
      executeBuildAndResolve(mappingRes.dataRows, mappingRes.columnMappings);
    } else {
      setCurrentStep("MAPPING");
    }
  };

  // Build grid rows and trigger batch product resolution
  const executeBuildAndResolve = async (
    rowsData: string[][],
    mappings: ColumnMappingResult[]
  ) => {
    const rawParsed = GridInputEngine.buildGridRows(
      rowsData,
      mappings,
      profile,
      duplicatePolicy
    );

    setCurrentStep("PREVIEW");

    if (profile.requireProductResolution) {
      setIsResolving(true);
      try {
        const resolved = await GridInputEngine.resolveRowsInBatch(rawParsed, companyId);
        setParsedRows(resolved);
      } catch (err) {
        console.error("Batch resolution failed:", err);
        setParsedRows(rawParsed);
      } finally {
        setIsResolving(false);
      }
    } else {
      // Master data mode: items are valid for creation
      const masterRows = rawParsed.map((r) => ({
        ...r,
        resolutionStatus: "VALID" as const,
      }));
      setParsedRows(masterRows);
    }
  };

  // Handle Mapping Override
  const handleMappingChange = (columnIndex: number, newFieldKey: string) => {
    setColumnMappings((prev) =>
      prev.map((col) => {
        if (col.sourceIndex !== columnIndex) return col;
        if (!newFieldKey) {
          return {
            ...col,
            mappedFieldKey: null,
            mappedFieldLabel: null,
            confidence: "UNMAPPED",
            confidenceScore: 0,
          };
        }
        const field = profile.allowedFields.find((f) => f.key === newFieldKey);
        return {
          ...col,
          mappedFieldKey: newFieldKey,
          mappedFieldLabel: field?.label || newFieldKey,
          confidence: "EXACT",
          confidenceScore: 100,
        };
      })
    );
  };

  // Scanner helpers
  const handleScannerAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const val = scannerInputVal.trim();
    if (!val) return;
    setScannerBuffer((prev) => [val, ...prev]);
    setScannerInputVal("");
    scannerInputRef.current?.focus();
  };

  // Clipboard Paste Helper
  const handlePasteFromClipboard = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        setRawText(text);
      }
    } catch (err) {
      console.warn("Clipboard access denied or unavailable:", err);
    }
  };

  // File Upload Helper
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setRawText(text);
      processRawInput(text);
    };
    reader.readAsText(file);
  };

  // Statistics
  const stats = useMemo(() => {
    let valid = 0;
    let warning = 0;
    let invalid = 0;

    parsedRows.forEach((r) => {
      if (
        r.resolutionStatus === "PRODUCT_NOT_FOUND" ||
        r.resolutionStatus === "PRODUCT_INACTIVE" ||
        r.resolutionStatus === "PRODUCT_QUARANTINED" ||
        r.resolutionStatus === "VALIDATION_ERROR"
      ) {
        invalid++;
      } else if (r.warnings && r.warnings.length > 0) {
        warning++;
      } else {
        valid++;
      }
    });

    return {
      total: parsedRows.length,
      valid,
      warning,
      invalid,
    };
  }, [parsedRows]);

  // Filtered rows for preview
  const displayRows = useMemo(() => {
    return parsedRows.filter((r) => {
      if (filterStatus === "VALID" && r.resolutionStatus !== "VALID") return false;
      if (
        filterStatus === "ERRORS" &&
        r.resolutionStatus !== "PRODUCT_NOT_FOUND" &&
        r.resolutionStatus !== "PRODUCT_INACTIVE" &&
        r.resolutionStatus !== "PRODUCT_QUARANTINED" &&
        r.resolutionStatus !== "VALIDATION_ERROR"
      ) {
        return false;
      }
      if (
        filterStatus === "WARNINGS" &&
        (!r.warnings || r.warnings.length === 0)
      ) {
        return false;
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const idMatch = r.identifier.toLowerCase().includes(q);
        const nameMatch = (r.resolvedProduct?.name || "").toLowerCase().includes(q);
        return idMatch || nameMatch;
      }
      return true;
    });
  }, [parsedRows, filterStatus, searchQuery]);

  // Commit Execution
  const handleCommit = (validOnly: boolean = false) => {
    const rowsToCommit = validOnly
      ? parsedRows.filter(
          (r) =>
            r.resolutionStatus === "VALID" ||
            (r.resolutionStatus === "WARNING" && (!r.errorCode || r.errorCode === ""))
        )
      : parsedRows;

    if (rowsToCommit.length === 0) {
      alert("No valid rows available to commit.");
      return;
    }

    onCommit(rowsToCommit, importMode);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl flex flex-col w-full max-w-5xl max-h-[92vh] overflow-hidden text-slate-100 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold tracking-wide flex items-center gap-2 text-white">
                {title || profile.label}
                <span className="text-xs font-mono font-normal px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                  {profile.profileId}
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">{profile.description}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stepper Progress */}
        <div className="px-6 py-2.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between text-xs font-medium">
          <div className="flex items-center gap-6">
            <div
              className={`flex items-center gap-2 ${
                currentStep === "INPUT" ? "text-indigo-400 font-semibold" : "text-slate-400"
              }`}
            >
              <span className="w-5 h-5 rounded-full flex items-center justify-center bg-slate-800 border border-slate-700">
                1
              </span>
              <span>Input Data</span>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-slate-600" />
            <div
              className={`flex items-center gap-2 ${
                currentStep === "MAPPING" ? "text-indigo-400 font-semibold" : "text-slate-400"
              }`}
            >
              <span className="w-5 h-5 rounded-full flex items-center justify-center bg-slate-800 border border-slate-700">
                2
              </span>
              <span>Field Mapping</span>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-slate-600" />
            <div
              className={`flex items-center gap-2 ${
                currentStep === "PREVIEW" ? "text-indigo-400 font-semibold" : "text-slate-400"
              }`}
            >
              <span className="w-5 h-5 rounded-full flex items-center justify-center bg-slate-800 border border-slate-700">
                3
              </span>
              <span>Validation & Commit</span>
            </div>
          </div>

          {currentStep === "PREVIEW" && (
            <div className="flex items-center gap-4 text-xs">
              <span className="text-slate-400">
                Mode:{" "}
                <select
                  value={importMode}
                  onChange={(e) => setImportMode(e.target.value as GridImportMode)}
                  className="bg-slate-800 border border-slate-700 rounded px-2 py-0.5 text-slate-200 text-xs focus:ring-1 focus:ring-indigo-500"
                >
                  {profile.supportedImportModes.map((m) => (
                    <option key={m} value={m}>
                      {m === "APPEND"
                        ? `Append (+${existingRowCount} existing)`
                        : m === "MERGE"
                        ? "Merge / Accumulate Qty"
                        : "Replace Entire Grid"}
                    </option>
                  ))}
                </select>
              </span>
              <span className="text-slate-400">
                Duplicates:{" "}
                <select
                  value={duplicatePolicy}
                  onChange={(e) => setDuplicatePolicy(e.target.value as GridDuplicatePolicy)}
                  className="bg-slate-800 border border-slate-700 rounded px-2 py-0.5 text-slate-200 text-xs focus:ring-1 focus:ring-indigo-500"
                >
                  {profile.supportedDuplicatePolicies.map((p) => (
                    <option key={p} value={p}>
                      {p === "MERGE_ROWS"
                        ? "Sum Quantities"
                        : p === "ADD_AS_SEPARATE_ROWS"
                        ? "Keep Separate"
                        : "Reject Duplicates"}
                    </option>
                  ))}
                </select>
              </span>
            </div>
          )}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* STEP 1: INPUT DATA */}
          {currentStep === "INPUT" && (
            <div className="space-y-4">
              {/* Source Tabs */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveTab("PASTE")}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                      activeTab === "PASTE"
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-slate-400 hover:text-white hover:bg-slate-800"
                    }`}
                  >
                    <Clipboard className="w-3.5 h-3.5" />
                    Excel / Clipboard Paste (Ctrl+V)
                  </button>
                  <button
                    onClick={() => setActiveTab("FILE")}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                      activeTab === "FILE"
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-slate-400 hover:text-white hover:bg-slate-800"
                    }`}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    CSV / TSV / TXT File
                  </button>
                  <button
                    onClick={() => setActiveTab("SCANNER")}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                      activeTab === "SCANNER"
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-slate-400 hover:text-white hover:bg-slate-800"
                    }`}
                  >
                    <Scan className="w-3.5 h-3.5" />
                    Rapid Barcode Scanner
                  </button>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span>Delimiter:</span>
                  <select
                    value={delimiterOverride}
                    onChange={(e) => setDelimiterOverride(e.target.value)}
                    className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="">Auto-Detect (TSV, CSV, Pipe, Tilde)</option>
                    <option value="&#9;">Tab (\t) — Excel / Google Sheets</option>
                    <option value=",">Comma (,) — Standard CSV</option>
                    <option value=";">Semicolon (;) — European CSV</option>
                    <option value="|">Pipe (|) — PDT Format</option>
                    <option value="~">Tilde (~) — PDT Format</option>
                  </select>
                </div>
              </div>

              {/* Tab 1: Direct Clipboard Paste */}
              {activeTab === "PASTE" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>
                      Copy cells directly from Excel or Google Sheets and paste below, or click
                      Paste.
                    </span>
                    <button
                      type="button"
                      onClick={handlePasteFromClipboard}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-indigo-400 border border-slate-700 transition flex items-center gap-1.5"
                    >
                      <Clipboard className="w-3 h-3" />
                      Paste from Clipboard
                    </button>
                  </div>
                  <textarea
                    rows={12}
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    placeholder={`Barcode\tQty\tPrice\n8901030383123\t5\t299\n8901030383124\t2\t499`}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none"
                  />
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] text-slate-500">
                      Supports: Barcode, SKU, Item Name, Quantity, Rate, MRP, Discount, Batch,
                      Expiry, Warehouse.
                    </p>
                    <button
                      disabled={!rawText.trim()}
                      onClick={() => processRawInput(rawText)}
                      className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-xs flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition"
                    >
                      <span>Analyze & Map Columns</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Tab 2: File Upload */}
              {activeTab === "FILE" && (
                <div className="space-y-4">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer bg-slate-950/40 hover:bg-slate-950/80 transition"
                  >
                    <div className="p-3 rounded-full bg-indigo-500/10 text-indigo-400">
                      <Upload className="w-6 h-6" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-slate-200">
                        Click or drag CSV, TSV, or TXT file here
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Files are parsed locally with zero latency
                      </p>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,.tsv,.txt,.pdt"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                  </div>

                  {rawText && (
                    <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-slate-400 max-h-40 overflow-y-auto">
                      <p className="text-[10px] text-slate-500 mb-1 font-sans">
                        Preview loaded content:
                      </p>
                      {rawText.slice(0, 500)}...
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3: Rapid Scanner */}
              {activeTab === "SCANNER" && (
                <div className="space-y-4">
                  <form onSubmit={handleScannerAdd} className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        ref={scannerInputRef}
                        type="text"
                        value={scannerInputVal}
                        onChange={(e) => setScannerInputVal(e.target.value)}
                        placeholder="Scan or type barcode and press ENTER..."
                        autoFocus
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium"
                    >
                      Add
                    </button>
                  </form>

                  <div className="border border-slate-800 rounded-lg p-3 bg-slate-950 max-h-64 overflow-y-auto">
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-2 pb-1 border-b border-slate-800">
                      <span>Scanned Items ({scannerBuffer.length})</span>
                      {scannerBuffer.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setScannerBuffer([])}
                          className="text-[11px] text-rose-400 hover:underline"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    {scannerBuffer.length === 0 ? (
                      <p className="text-xs text-slate-600 text-center py-6">
                        No barcodes scanned yet. Scan with hardware scanner or type above.
                      </p>
                    ) : (
                      <div className="space-y-1">
                        {scannerBuffer.map((b, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between px-2 py-1 rounded bg-slate-900 text-xs font-mono text-slate-300"
                          >
                            <span>
                              #{scannerBuffer.length - idx} : {b}
                            </span>
                            <span className="text-slate-500 text-[10px]">Qty: 1</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end">
                    <button
                      disabled={scannerBuffer.length === 0}
                      onClick={() => {
                        const generatedText = ["barcode\tquantity", ...scannerBuffer.map((b) => `${b}\t1`)].join("\n");
                        processRawInput(generatedText);
                      }}
                      className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-xs flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition"
                    >
                      <span>Process {scannerBuffer.length} Scans</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: COLUMN MAPPING */}
          {currentStep === "MAPPING" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-200">
                    Review Column Header Mapping
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Match source file columns to target {profile.profileId} fields.
                  </p>
                </div>
                <button
                  onClick={() => executeBuildAndResolve(dataRows, columnMappings)}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition"
                >
                  <span>Confirm Mapping & Resolve ({dataRows.length} Rows)</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 font-medium">
                    <tr>
                      <th className="py-2.5 px-4 w-12">#</th>
                      <th className="py-2.5 px-4">Source Header</th>
                      <th className="py-2.5 px-4">Sample Data</th>
                      <th className="py-2.5 px-4">Target Field</th>
                      <th className="py-2.5 px-4 w-32">Confidence</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {columnMappings.map((col, idx) => {
                      const sampleVal = dataRows[0]?.[col.sourceIndex] || "(empty)";
                      return (
                        <tr key={idx} className="hover:bg-slate-900/50">
                          <td className="py-2.5 px-4 text-slate-500">{idx + 1}</td>
                          <td className="py-2.5 px-4 font-sans font-medium text-slate-200">
                            {col.sourceHeader || `Column ${idx + 1}`}
                          </td>
                          <td className="py-2.5 px-4 text-slate-400 truncate max-w-xs">
                            {sampleVal}
                          </td>
                          <td className="py-2.5 px-4">
                            <select
                              value={col.mappedFieldKey || ""}
                              onChange={(e) => handleMappingChange(col.sourceIndex, e.target.value)}
                              className="bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-slate-200 text-xs w-full focus:ring-1 focus:ring-indigo-500 font-sans"
                            >
                              <option value="">-- Ignore Column --</option>
                              {profile.allowedFields.map((f) => (
                                <option key={f.key} value={f.key}>
                                  {f.label} {f.required ? "*" : ""}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2.5 px-4">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-sans font-semibold tracking-wide ${
                                col.confidence === "EXACT"
                                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                  : col.confidence === "HIGH"
                                  ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                                  : col.confidence === "MEDIUM"
                                  ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                  : "bg-slate-800 text-slate-500 border border-slate-700"
                              }`}
                            >
                              {col.confidence}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between items-center text-xs">
                <button
                  onClick={() => setCurrentStep("INPUT")}
                  className="px-3 py-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  ← Back to Input
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: PREVIEW & VALIDATION */}
          {currentStep === "PREVIEW" && (
            <div className="space-y-4">
              {/* Metric Cards */}
              <div className="grid grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-[11px] font-medium text-slate-400">Total Rows</span>
                  <p className="text-xl font-bold text-white mt-1">{stats.total}</p>
                </div>
                <div className="p-3 rounded-lg bg-emerald-950/20 border border-emerald-800/40">
                  <span className="text-[11px] font-medium text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Valid & Resolved
                  </span>
                  <p className="text-xl font-bold text-emerald-400 mt-1">{stats.valid}</p>
                </div>
                <div className="p-3 rounded-lg bg-amber-950/20 border border-amber-800/40">
                  <span className="text-[11px] font-medium text-amber-400 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> Warnings / Merged
                  </span>
                  <p className="text-xl font-bold text-amber-400 mt-1">{stats.warning}</p>
                </div>
                <div className="p-3 rounded-lg bg-rose-950/20 border border-rose-800/40">
                  <span className="text-[11px] font-medium text-rose-400 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> Invalid / Unresolved
                  </span>
                  <p className="text-xl font-bold text-rose-400 mt-1">{stats.invalid}</p>
                </div>
              </div>

              {/* Atomic Safety Notice if invalid rows exist */}
              {stats.invalid > 0 && profile.atomicTransactionSafety && (
                <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800 flex items-start gap-3 text-rose-200">
                  <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <p className="font-semibold">Atomic Transaction Protection Enforced</p>
                    <p className="text-rose-300/80 mt-0.5">
                      This transaction profile requires 100% item resolution. {stats.invalid} row(s)
                      are unregistered or invalid. You may either commit only the {stats.valid} valid
                      rows or rectify the source data.
                    </p>
                  </div>
                </div>
              )}

              {/* Filter bar */}
              <div className="flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  <div className="flex rounded-lg bg-slate-950 border border-slate-800 p-0.5">
                    <button
                      onClick={() => setFilterStatus("ALL")}
                      className={`px-2.5 py-1 rounded text-xs transition ${
                        filterStatus === "ALL"
                          ? "bg-indigo-600 text-white"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      All ({parsedRows.length})
                    </button>
                    <button
                      onClick={() => setFilterStatus("VALID")}
                      className={`px-2.5 py-1 rounded text-xs transition ${
                        filterStatus === "VALID"
                          ? "bg-emerald-600 text-white"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      Valid ({stats.valid})
                    </button>
                    <button
                      onClick={() => setFilterStatus("ERRORS")}
                      className={`px-2.5 py-1 rounded text-xs transition ${
                        filterStatus === "ERRORS"
                          ? "bg-rose-600 text-white"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      Errors ({stats.invalid})
                    </button>
                  </div>
                </div>

                <div className="relative w-64">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search barcode, SKU, name..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Rows Table */}
              <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950 max-h-80 overflow-y-auto">
                {isResolving ? (
                  <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
                    <p className="text-xs">
                      Resolving items against authoritative Product Resolution Service...
                    </p>
                  </div>
                ) : (
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 font-medium sticky top-0 z-10">
                      <tr>
                        <th className="py-2 px-3 w-10">#</th>
                        <th className="py-2 px-3">Status</th>
                        <th className="py-2 px-3">Identifier</th>
                        <th className="py-2 px-3">Product Name</th>
                        <th className="py-2 px-3 text-right">Qty</th>
                        <th className="py-2 px-3 text-right">Rate</th>
                        <th className="py-2 px-3 text-right">MRP</th>
                        <th className="py-2 px-3">Message / Resolution</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {displayRows.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-slate-600 font-sans">
                            No rows matching the filter.
                          </td>
                        </tr>
                      ) : (
                        displayRows.map((r, idx) => {
                          const isValid = r.resolutionStatus === "VALID";
                          const isErr =
                            r.resolutionStatus === "PRODUCT_NOT_FOUND" ||
                            r.resolutionStatus === "PRODUCT_INACTIVE" ||
                            r.resolutionStatus === "PRODUCT_QUARANTINED" ||
                            r.resolutionStatus === "VALIDATION_ERROR";

                          return (
                            <tr
                              key={idx}
                              className={`hover:bg-slate-900/50 ${
                                isErr ? "bg-rose-950/10" : ""
                              }`}
                            >
                              <td className="py-2 px-3 text-slate-500">{r.rowNumber}</td>
                              <td className="py-2 px-3">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-sans font-semibold ${
                                    isValid
                                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                      : isErr
                                      ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                      : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                  }`}
                                >
                                  {r.resolutionStatus}
                                </span>
                              </td>
                              <td className="py-2 px-3 font-semibold text-slate-200">
                                {r.identifier || "(none)"}
                              </td>
                              <td className="py-2 px-3 font-sans text-slate-300 truncate max-w-xs">
                                {r.resolvedProduct?.name || r.mappedValues["name"] || "—"}
                              </td>
                              <td className="py-2 px-3 text-right text-slate-200 font-semibold">
                                {r.quantity}
                              </td>
                              <td className="py-2 px-3 text-right text-slate-400">
                                {r.rate !== undefined ? `₹${r.rate}` : "—"}
                              </td>
                              <td className="py-2 px-3 text-right text-slate-400">
                                {r.mrp !== undefined ? `₹${r.mrp}` : "—"}
                              </td>
                              <td className="py-2 px-3 font-sans text-[11px] truncate max-w-xs">
                                {r.errorMessage ? (
                                  <span className="text-rose-400">{r.errorMessage}</span>
                                ) : r.warnings && r.warnings.length > 0 ? (
                                  <span className="text-amber-400">{r.warnings.join("; ")}</span>
                                ) : (
                                  <span className="text-emerald-400">
                                    Resolved (SKU: {r.resolvedProduct?.sku || "OK"})
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <div>
            {currentStep === "PREVIEW" && (
              <button
                onClick={() => setCurrentStep("INPUT")}
                className="px-3 py-1.5 rounded text-xs text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                ← Restart Input
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              Cancel
            </button>

            {currentStep === "PREVIEW" && (
              <>
                {stats.invalid > 0 && stats.valid > 0 && (
                  <button
                    onClick={() => handleCommit(true)}
                    className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium text-xs shadow-lg shadow-amber-600/20 transition flex items-center gap-2"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Commit Valid Only ({stats.valid} Rows)
                  </button>
                )}

                <button
                  disabled={
                    parsedRows.length === 0 ||
                    (profile.atomicTransactionSafety && stats.invalid > 0)
                  }
                  onClick={() => handleCommit(false)}
                  className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium text-xs shadow-lg shadow-indigo-600/20 transition flex items-center gap-2"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>
                    Commit All ({parsedRows.length} Rows) via {importMode}
                  </span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
