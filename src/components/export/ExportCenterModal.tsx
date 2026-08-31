/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.25.0
 * Created      : 2026-08-24
 * Modified     : 2026-08-24
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useRef } from "react";
import {
  Download,
  FileSpreadsheet,
  FileText,
  Table,
  CheckCircle,
  AlertCircle,
  Loader2,
  X,
  SlidersHorizontal,
  Layers,
  Filter,
  CheckSquare,
  Square,
  Building,
  Calendar,
  Search,
  ExternalLink,
} from "lucide-react";
import {
  ExportColumnDefinition,
  ExportFormat,
  ExportMetadata,
  ExportProgressState,
  ExportResult,
  ExportScope,
} from "./types.ts";
import { GlobalExportService } from "../../services/globalExportService.ts";

export interface ExportCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  moduleTitle: string;
  columns: ExportColumnDefinition[];
  currentPageData?: any[];
  selectedRows?: any[];
  totalRecordsCount?: number;
  filteredRecordsCount?: number;
  apiEndpoint?: string;
  appliedFilters?: Record<string, any>;
  searchTerm?: string;
  dateRange?: { start?: string; end?: string };
  companyName?: string;
  branchName?: string;
  onNotification?: (title: string, message: string, type?: "success" | "error" | "info" | "warning") => void;
}

export const ExportCenterModal: React.FC<ExportCenterModalProps> = ({
  isOpen,
  onClose,
  moduleTitle,
  columns = [],
  currentPageData = [],
  selectedRows = [],
  totalRecordsCount,
  filteredRecordsCount,
  apiEndpoint,
  appliedFilters = {},
  searchTerm = "",
  dateRange,
  companyName = "SMRITI Enterprise",
  branchName = "Main Branch",
  onNotification,
}) => {
  const [format, setFormat] = useState<ExportFormat>("xlsx");
  const [scope, setScope] = useState<ExportScope>(() => {
    if (selectedRows && selectedRows.length > 0) return "selected";
    if (searchTerm || Object.keys(appliedFilters).length > 0) return "filtered";
    return "currentPage";
  });

  const [selectedColumnKeys, setSelectedColumnKeys] = useState<Set<string>>(() => {
    return new Set(columns.filter((c) => c.isVisible !== false).map((c) => c.key));
  });

  const [includeMetadataHeader, setIncludeMetadataHeader] = useState<boolean>(true);
  const [customFilename, setCustomFilename] = useState<string>("");
  const [progressState, setProgressState] = useState<ExportProgressState>({
    isExporting: false,
    currentStep: "idle",
    fetchedCount: 0,
    totalEstimatedCount: 0,
    currentPage: 0,
    totalPages: 0,
    percentage: 0,
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  if (!isOpen) return null;

  const totalColCount = columns.length;
  const activeColCount = selectedColumnKeys.size;

  const toggleColumn = (key: string) => {
    setSelectedColumnKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size > 1) next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleSelectAllColumns = () => {
    setSelectedColumnKeys(new Set(columns.map((c) => c.key)));
  };

  const handleDeselectAllColumns = () => {
    if (columns.length > 0) {
      setSelectedColumnKeys(new Set([columns[0].key]));
    }
  };

  const handleCancelExport = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setProgressState((prev) => ({
      ...prev,
      isExporting: false,
      currentStep: "idle",
      errorMessage: "Export cancelled by user.",
    }));
  };

  const handleExecuteExport = async () => {
    const exportColumns = columns
      .filter((c) => selectedColumnKeys.has(c.key))
      .map((c) => ({ ...c, isVisible: true }));

    if (exportColumns.length === 0) {
      onNotification?.("No Columns Selected", "Please select at least one column to export.", "error");
      return;
    }

    const metadata: ExportMetadata | undefined = includeMetadataHeader
      ? {
          moduleTitle,
          companyName,
          branchName,
          exportedBy: "Authorized User",
          exportTimestamp: new Date().toLocaleString(),
          searchTerm: searchTerm || undefined,
          appliedFilters: Object.keys(appliedFilters).length > 0 ? appliedFilters : undefined,
          dateRange: dateRange?.start || dateRange?.end ? dateRange : undefined,
          totalRecordsCount: totalRecordsCount || currentPageData.length,
          selectedRecordsCount: selectedRows.length,
        }
      : undefined;

    setProgressState({
      isExporting: true,
      currentStep: "collecting",
      fetchedCount: 0,
      totalEstimatedCount: 0,
      currentPage: 1,
      totalPages: 1,
      percentage: 5,
    });

    abortControllerRef.current = new AbortController();

    try {
      let result: ExportResult;

      if ((scope === "all" || scope === "filtered") && apiEndpoint) {
        // Multi-page streaming from backend
        const queryParams: Record<string, any> = { ...appliedFilters };
        if (searchTerm) queryParams.q = searchTerm;
        if (dateRange?.start) queryParams.start_date = dateRange.start;
        if (dateRange?.end) queryParams.end_date = dateRange.end;

        result = await GlobalExportService.exportPagedEndpoint({
          moduleName: moduleTitle,
          format,
          scope,
          endpoint: apiEndpoint,
          columns: exportColumns,
          queryParams,
          metadata,
          selectedRows,
          abortSignal: abortControllerRef.current.signal,
          customFilename: customFilename.trim() || undefined,
          onProgress: (p) => setProgressState(p),
        });
      } else {
        // In-memory export
        let exportData = currentPageData;
        if (scope === "selected") {
          exportData = selectedRows.length > 0 ? selectedRows : currentPageData;
        }

        result = await GlobalExportService.exportDataset({
          moduleName: moduleTitle,
          format,
          scope,
          columns: exportColumns,
          data: exportData,
          selectedRows,
          metadata,
          customFilename: customFilename.trim() || undefined,
        });
      }

      if (result.success) {
        onNotification?.(
          "Export Successful",
          `Successfully exported ${result.rowCount} records to ${result.filename} (${(result.fileSizeBytes / 1024).toFixed(1)} KB).`,
          "success"
        );
        onClose();
      } else {
        onNotification?.("Export Failed", result.errorMessage || "Unable to complete export.", "error");
      }
    } catch (err: any) {
      onNotification?.("Export Failed", err?.message || "An unexpected error occurred during export.", "error");
    } finally {
      setProgressState((prev) => ({ ...prev, isExporting: false }));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#1e2329] border border-[#c6c6cd] dark:border-[#45464d] rounded-2xl shadow-2xl max-w-2xl w-full flex flex-col overflow-hidden text-[#191c1e] dark:text-[#e1e2e5]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e1e2e5] dark:border-[#35393e] bg-[#f7f9fc] dark:bg-[#15191e]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#003d9b]/10 dark:bg-[#003d9b]/30 text-[#003d9b] dark:text-[#b2c5ff]">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">SMRITI Export Center</h2>
              <p className="text-xs text-[#515f74] dark:text-[#bec6e0]">
                {moduleTitle} • Multi-Format &amp; Multi-Scope Data Dispatch
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={progressState.isExporting}
            className="p-1.5 rounded-lg text-[#515f74] hover:text-[#191c1e] dark:text-[#bec6e0] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* 1. Format Selection */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-[#515f74] dark:text-[#bec6e0] flex items-center gap-1.5">
              <FileSpreadsheet className="w-4 h-4 text-[#003d9b] dark:text-[#b2c5ff]" />
              1. Select File Format
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
              <button
                type="button"
                onClick={() => setFormat("xlsx")}
                disabled={progressState.isExporting}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${
                  format === "xlsx"
                    ? "border-[#003d9b] bg-[#003d9b]/10 dark:bg-[#003d9b]/25 text-[#003d9b] dark:text-[#b2c5ff] font-bold shadow-sm"
                    : "border-[#c6c6cd] dark:border-[#45464d] hover:bg-[#f7f9fc] dark:hover:bg-[#282d34] text-[#515f74] dark:text-[#bec6e0]"
                }`}
              >
                <FileSpreadsheet className="w-5 h-5 mb-1 text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs font-bold">Excel</span>
                <span className="text-[9px] opacity-75 font-normal">.xlsx</span>
              </button>

              <button
                type="button"
                onClick={() => setFormat("gsheet")}
                disabled={progressState.isExporting}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${
                  format === "gsheet"
                    ? "border-emerald-600 bg-emerald-500/10 dark:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 font-bold shadow-sm ring-1 ring-emerald-500/50"
                    : "border-[#c6c6cd] dark:border-[#45464d] hover:bg-[#f7f9fc] dark:hover:bg-[#282d34] text-[#515f74] dark:text-[#bec6e0]"
                }`}
              >
                <FileSpreadsheet className="w-5 h-5 mb-1 text-emerald-500" />
                <span className="text-xs font-bold">Google Sheets</span>
                <span className="text-[9px] opacity-75 font-normal">sheets.new</span>
              </button>

              <button
                type="button"
                onClick={() => setFormat("csv")}
                disabled={progressState.isExporting}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${
                  format === "csv"
                    ? "border-[#003d9b] bg-[#003d9b]/10 dark:bg-[#003d9b]/25 text-[#003d9b] dark:text-[#b2c5ff] font-bold shadow-sm"
                    : "border-[#c6c6cd] dark:border-[#45464d] hover:bg-[#f7f9fc] dark:hover:bg-[#282d34] text-[#515f74] dark:text-[#bec6e0]"
                }`}
              >
                <Table className="w-5 h-5 mb-1 text-blue-600 dark:text-blue-400" />
                <span className="text-xs font-bold">CSV</span>
                <span className="text-[9px] opacity-75 font-normal">.csv</span>
              </button>

              <button
                type="button"
                onClick={() => setFormat("json")}
                disabled={progressState.isExporting}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${
                  format === "json"
                    ? "border-[#003d9b] bg-[#003d9b]/10 dark:bg-[#003d9b]/25 text-[#003d9b] dark:text-[#b2c5ff] font-bold shadow-sm"
                    : "border-[#c6c6cd] dark:border-[#45464d] hover:bg-[#f7f9fc] dark:hover:bg-[#282d34] text-[#515f74] dark:text-[#bec6e0]"
                }`}
              >
                <Table className="w-5 h-5 mb-1 text-purple-600 dark:text-purple-400" />
                <span className="text-xs font-bold">JSON</span>
                <span className="text-[9px] opacity-75 font-normal">.json</span>
              </button>

              <button
                type="button"
                onClick={() => setFormat("txt")}
                disabled={progressState.isExporting}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${
                  format === "txt"
                    ? "border-[#003d9b] bg-[#003d9b]/10 dark:bg-[#003d9b]/25 text-[#003d9b] dark:text-[#b2c5ff] font-bold shadow-sm"
                    : "border-[#c6c6cd] dark:border-[#45464d] hover:bg-[#f7f9fc] dark:hover:bg-[#282d34] text-[#515f74] dark:text-[#bec6e0]"
                }`}
              >
                <FileText className="w-5 h-5 mb-1 text-amber-600 dark:text-amber-400" />
                <span className="text-xs font-bold">Text</span>
                <span className="text-[9px] opacity-75 font-normal">.txt</span>
              </button>

              <button
                type="button"
                onClick={() => setFormat("html")}
                disabled={progressState.isExporting}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${
                  format === "html"
                    ? "border-[#003d9b] bg-[#003d9b]/10 dark:bg-[#003d9b]/25 text-[#003d9b] dark:text-[#b2c5ff] font-bold shadow-sm"
                    : "border-[#c6c6cd] dark:border-[#45464d] hover:bg-[#f7f9fc] dark:hover:bg-[#282d34] text-[#515f74] dark:text-[#bec6e0]"
                }`}
              >
                <FileSpreadsheet className="w-5 h-5 mb-1 text-rose-600 dark:text-rose-400" />
                <span className="text-xs font-bold">HTML</span>
                <span className="text-[9px] opacity-75 font-normal">.html</span>
              </button>
            </div>

            {format === "gsheet" && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2 mt-2">
                <FileSpreadsheet className="w-4 h-4 shrink-0 text-emerald-500" />
                <span>
                  <strong>Google Sheets Direct Integration:</strong> Opens a new spreadsheet at <code>sheets.new</code> in your browser with the full dataset copied to your clipboard (Ctrl+V / Cmd+V to paste immediately) and downloads a CSV backup.
                </span>
              </div>
            )}
          </div>

          {/* 2. Scope Selection */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-[#515f74] dark:text-[#bec6e0] flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-[#003d9b] dark:text-[#b2c5ff]" />
              2. Export Scope
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <label
                className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer text-xs transition-all ${
                  scope === "currentPage"
                    ? "border-[#003d9b] bg-[#003d9b]/5 dark:bg-[#003d9b]/20 font-bold text-[#003d9b] dark:text-[#b2c5ff]"
                    : "border-[#c6c6cd] dark:border-[#45464d] hover:bg-[#f7f9fc] dark:hover:bg-[#282d34]"
                }`}
              >
                <input
                  type="radio"
                  name="exportScope"
                  value="currentPage"
                  checked={scope === "currentPage"}
                  onChange={() => setScope("currentPage")}
                  disabled={progressState.isExporting}
                  className="accent-[#003d9b]"
                />
                <div>
                  <span className="block font-semibold">Current Page</span>
                  <span className="text-[10px] text-[#515f74] dark:text-[#bec6e0]">
                    ({currentPageData.length} records)
                  </span>
                </div>
              </label>

              <label
                className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer text-xs transition-all ${
                  scope === "all"
                    ? "border-[#003d9b] bg-[#003d9b]/5 dark:bg-[#003d9b]/20 font-bold text-[#003d9b] dark:text-[#b2c5ff]"
                    : "border-[#c6c6cd] dark:border-[#45464d] hover:bg-[#f7f9fc] dark:hover:bg-[#282d34]"
                }`}
              >
                <input
                  type="radio"
                  name="exportScope"
                  value="all"
                  checked={scope === "all"}
                  onChange={() => setScope("all")}
                  disabled={progressState.isExporting}
                  className="accent-[#003d9b]"
                />
                <div>
                  <span className="block font-semibold">All Records</span>
                  <span className="text-[10px] text-[#515f74] dark:text-[#bec6e0]">
                    ({totalRecordsCount || "All API Pages"})
                  </span>
                </div>
              </label>

              <label
                className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer text-xs transition-all ${
                  scope === "filtered"
                    ? "border-[#003d9b] bg-[#003d9b]/5 dark:bg-[#003d9b]/20 font-bold text-[#003d9b] dark:text-[#b2c5ff]"
                    : "border-[#c6c6cd] dark:border-[#45464d] hover:bg-[#f7f9fc] dark:hover:bg-[#282d34]"
                }`}
              >
                <input
                  type="radio"
                  name="exportScope"
                  value="filtered"
                  checked={scope === "filtered"}
                  onChange={() => setScope("filtered")}
                  disabled={progressState.isExporting}
                  className="accent-[#003d9b]"
                />
                <div>
                  <span className="block font-semibold">Filtered Only</span>
                  <span className="text-[10px] text-[#515f74] dark:text-[#bec6e0]">
                    ({filteredRecordsCount || "Matching Search"})
                  </span>
                </div>
              </label>

              <label
                className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer text-xs transition-all ${
                  selectedRows.length === 0
                    ? "opacity-50 cursor-not-allowed border-[#c6c6cd] dark:border-[#45464d]"
                    : scope === "selected"
                    ? "border-[#003d9b] bg-[#003d9b]/5 dark:bg-[#003d9b]/20 font-bold text-[#003d9b] dark:text-[#b2c5ff]"
                    : "border-[#c6c6cd] dark:border-[#45464d] hover:bg-[#f7f9fc] dark:hover:bg-[#282d34]"
                }`}
              >
                <input
                  type="radio"
                  name="exportScope"
                  value="selected"
                  checked={scope === "selected"}
                  onChange={() => setScope("selected")}
                  disabled={selectedRows.length === 0 || progressState.isExporting}
                  className="accent-[#003d9b]"
                />
                <div>
                  <span className="block font-semibold">Selected Rows</span>
                  <span className="text-[10px] text-[#515f74] dark:text-[#bec6e0]">
                    ({selectedRows.length} checked)
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* 3. Applied Filters & Context Card */}
          {(searchTerm || Object.keys(appliedFilters).length > 0 || dateRange?.start) && (
            <div className="p-3.5 bg-[#f0f4f9] dark:bg-[#171b20] border border-[#d8e2ee] dark:border-[#383d44] rounded-xl space-y-2 text-xs">
              <div className="flex items-center gap-2 font-bold text-[#003d9b] dark:text-[#b2c5ff]">
                <Filter className="w-3.5 h-3.5" />
                <span>Active Context &amp; Filters applied to this export:</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[#515f74] dark:text-[#bec6e0] text-[11px]">
                {companyName && (
                  <div className="flex items-center gap-1.5">
                    <Building className="w-3 h-3 text-[#003d9b]" />
                    <span>Company: <strong className="text-[#191c1e] dark:text-white">{companyName}</strong></span>
                  </div>
                )}
                {searchTerm && (
                  <div className="flex items-center gap-1.5">
                    <Search className="w-3 h-3 text-[#003d9b]" />
                    <span>Search: <strong className="text-[#191c1e] dark:text-white">"{searchTerm}"</strong></span>
                  </div>
                )}
                {dateRange?.start && (
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3 h-3 text-[#003d9b]" />
                    <span>Date: {dateRange.start} to {dateRange.end || "Now"}</span>
                  </div>
                )}
                {Object.entries(appliedFilters).map(([k, v]) => (
                  <div key={k} className="capitalize">
                    {k}: <strong className="text-[#191c1e] dark:text-white">{String(v)}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. Column Selection Checklist */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-[#515f74] dark:text-[#bec6e0] flex items-center gap-1.5">
                <SlidersHorizontal className="w-4 h-4 text-[#003d9b] dark:text-[#b2c5ff]" />
                3. Choose Columns ({activeColCount}/{totalColCount})
              </label>
              <div className="flex items-center gap-3 text-xs">
                <button
                  type="button"
                  onClick={handleSelectAllColumns}
                  disabled={progressState.isExporting}
                  className="text-[#003d9b] dark:text-[#b2c5ff] hover:underline font-semibold"
                >
                  Select All
                </button>
                <span className="text-[#c6c6cd]">|</span>
                <button
                  type="button"
                  onClick={handleDeselectAllColumns}
                  disabled={progressState.isExporting}
                  className="text-[#515f74] dark:text-[#bec6e0] hover:underline"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="p-3 bg-[#f7f9fc] dark:bg-[#15191e] border border-[#e1e2e5] dark:border-[#35393e] rounded-xl grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-44 overflow-y-auto">
              {columns.map((col) => {
                const isChecked = selectedColumnKeys.has(col.key);
                return (
                  <button
                    key={col.key}
                    type="button"
                    onClick={() => toggleColumn(col.key)}
                    disabled={progressState.isExporting}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors ${
                      isChecked
                        ? "bg-white dark:bg-[#252a30] text-[#191c1e] dark:text-white font-medium shadow-2xs border border-[#c6c6cd] dark:border-[#45464d]"
                        : "text-[#72777f] dark:text-[#8c9199] hover:bg-black/5 dark:hover:bg-white/5"
                    }`}
                  >
                    {isChecked ? (
                      <CheckSquare className="w-3.5 h-3.5 text-[#003d9b] dark:text-[#b2c5ff] shrink-0" />
                    ) : (
                      <Square className="w-3.5 h-3.5 text-[#72777f] shrink-0" />
                    )}
                    <span className="truncate" title={col.label}>{col.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 5. Additional Options */}
          <div className="space-y-3 pt-2 border-t border-[#e1e2e5] dark:border-[#35393e]">
            <div className="flex items-center justify-between text-xs">
              <label className="flex items-center gap-2 cursor-pointer font-medium">
                <input
                  type="checkbox"
                  checked={includeMetadataHeader}
                  onChange={(e) => setIncludeMetadataHeader(e.target.checked)}
                  disabled={progressState.isExporting}
                  className="rounded accent-[#003d9b]"
                />
                <span>Include Organization Metadata Header &amp; Filter Summary</span>
              </label>
            </div>

            <div>
              <label className="text-[11px] font-bold text-[#515f74] dark:text-[#bec6e0] block mb-1">
                Custom Filename (Optional)
              </label>
              <input
                type="text"
                value={customFilename}
                onChange={(e) => setCustomFilename(e.target.value)}
                disabled={progressState.isExporting}
                placeholder={`SMRITI_${moduleTitle}_${scope}_${new Date().toISOString().split("T")[0]}`}
                className="w-full px-3 py-1.5 text-xs bg-white dark:bg-[#15191e] border border-[#c6c6cd] dark:border-[#45464d] rounded-lg font-mono focus:outline-none focus:border-[#003d9b]"
              />
            </div>
          </div>

          {/* Progress Bar Display */}
          {progressState.isExporting && (
            <div className="p-4 bg-[#003d9b]/5 dark:bg-[#003d9b]/15 border border-[#003d9b]/30 rounded-xl space-y-2.5 animate-in fade-in">
              <div className="flex items-center justify-between text-xs font-bold text-[#003d9b] dark:text-[#b2c5ff]">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-[#003d9b]" />
                  <span>
                    {progressState.currentStep === "collecting"
                      ? `Fetching Page ${progressState.currentPage} of ${progressState.totalPages}...`
                      : progressState.currentStep === "formatting"
                      ? "Formatting spreadsheet and compiling data..."
                      : "Generating final download file..."}
                  </span>
                </div>
                <span>{progressState.percentage}%</span>
              </div>

              <div className="w-full bg-[#d8e2ee] dark:bg-[#2d333b] h-2 rounded-full overflow-hidden">
                <div
                  className="bg-[#003d9b] dark:bg-[#7ca8ff] h-full transition-all duration-300 rounded-full"
                  style={{ width: `${progressState.percentage}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-[#515f74] dark:text-[#bec6e0]">
                <span>Collected {progressState.fetchedCount} records</span>
                <button
                  type="button"
                  onClick={handleCancelExport}
                  className="text-[#ba1a1a] dark:text-[#ffb4ab] hover:underline font-bold"
                >
                  Cancel Export
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#e1e2e5] dark:border-[#35393e] bg-[#f7f9fc] dark:bg-[#15191e]">
          <div className="text-[11px] text-[#515f74] dark:text-[#bec6e0]">
            Format: <strong className="uppercase">{format}</strong> • Columns: <strong>{activeColCount}</strong>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={progressState.isExporting}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-[#c6c6cd] dark:border-[#45464d] hover:bg-black/5 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleExecuteExport}
              disabled={progressState.isExporting || activeColCount === 0}
              className={`flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-xl text-white shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                format === "gsheet"
                  ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-900/20"
                  : "bg-[#003d9b] hover:bg-[#002f7a]"
              }`}
            >
              {progressState.isExporting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Exporting...</span>
                </>
              ) : format === "gsheet" ? (
                <>
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open in Google Sheets</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>Download File</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
