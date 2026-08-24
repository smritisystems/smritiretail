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

import React, { useState, useRef, useEffect } from "react";
import {
  Download,
  FileSpreadsheet,
  Table,
  FileText,
  ChevronDown,
  SlidersHorizontal,
  Loader2,
} from "lucide-react";
import {
  ExportColumnDefinition,
  ExportFormat,
  ExportScope,
} from "./types.ts";
import { ExportCenterModal } from "./ExportCenterModal.tsx";
import { GlobalExportService } from "../../services/globalExportService.ts";

export interface ExportButtonProps {
  moduleTitle: string;
  columns: ExportColumnDefinition[];
  data?: any[];
  selectedRows?: any[];
  totalRecordsCount?: number;
  filteredRecordsCount?: number;
  apiEndpoint?: string;
  appliedFilters?: Record<string, any>;
  searchTerm?: string;
  dateRange?: { start?: string; end?: string };
  companyName?: string;
  branchName?: string;
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  className?: string;
  disabled?: boolean;
  onNotification?: (title: string, message: string, type?: "success" | "error" | "info" | "warning") => void;
}

export const ExportButton: React.FC<ExportButtonProps> = ({
  moduleTitle,
  columns = [],
  data = [],
  selectedRows = [],
  totalRecordsCount,
  filteredRecordsCount,
  apiEndpoint,
  appliedFilters = {},
  searchTerm = "",
  dateRange,
  companyName,
  branchName,
  variant = "outline",
  size = "sm",
  className = "",
  disabled = false,
  onNotification,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isQuickExporting, setIsQuickExporting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isMenuOpen]);

  const handleQuickExport = async (format: ExportFormat) => {
    setIsMenuOpen(false);
    setIsQuickExporting(true);

    try {
      const scope: ExportScope = selectedRows.length > 0 ? "selected" : "currentPage";
      const targetRows = selectedRows.length > 0 ? selectedRows : data;

      const result = await GlobalExportService.exportDataset({
        moduleName: moduleTitle,
        format,
        scope,
        columns: columns.filter((c) => c.isVisible !== false),
        data: targetRows,
        selectedRows,
        metadata: {
          moduleTitle,
          companyName,
          branchName,
          exportTimestamp: new Date().toLocaleString(),
          searchTerm: searchTerm || undefined,
          appliedFilters: Object.keys(appliedFilters).length > 0 ? appliedFilters : undefined,
          totalRecordsCount: targetRows.length,
          selectedRecordsCount: selectedRows.length,
        },
      });

      if (result.success) {
        onNotification?.(
          "Export Successful",
          `Exported ${result.rowCount} records to ${result.filename}`,
          "success"
        );
      } else {
        onNotification?.("Export Failed", result.errorMessage || "No records to export.", "error");
      }
    } catch (err: any) {
      onNotification?.("Export Failed", err?.message || "Failed to generate export.", "error");
    } finally {
      setIsQuickExporting(false);
    }
  };

  const sizeClasses = {
    sm: "px-2.5 py-1.5 text-xs gap-1.5",
    md: "px-3.5 py-2 text-xs gap-2",
    lg: "px-4 py-2.5 text-sm gap-2.5",
  }[size];

  const variantClasses = {
    primary: "bg-[#003d9b] hover:bg-[#002f7a] text-white border-transparent shadow-xs font-bold",
    secondary: "bg-[#e1e2e5] hover:bg-[#c6c6cd] dark:bg-[#282d34] dark:hover:bg-[#35393e] text-[#191c1e] dark:text-white border-transparent font-semibold",
    outline: "bg-white dark:bg-[#191c1e] hover:bg-[#f7f9fc] dark:hover:bg-[#22272e] text-[#191c1e] dark:text-[#e1e2e5] border border-[#c6c6cd] dark:border-[#45464d] shadow-2xs font-semibold",
    ghost: "bg-transparent hover:bg-black/5 dark:hover:bg-white/5 text-[#515f74] hover:text-[#191c1e] dark:text-[#bec6e0] dark:hover:text-white border-transparent font-medium",
  }[variant];

  return (
    <div className={`relative inline-flex items-center ${className}`} ref={menuRef}>
      <div className="inline-flex rounded-lg shadow-2xs overflow-hidden border border-[#c6c6cd] dark:border-[#45464d]">
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          disabled={disabled || isQuickExporting}
          className={`inline-flex items-center transition-colors ${sizeClasses} ${variantClasses} border-r border-[#c6c6cd]/50 dark:border-[#45464d]/50 disabled:opacity-50 disabled:cursor-not-allowed`}
          title={`Export ${moduleTitle} data in Excel, CSV, or Text`}
        >
          {isQuickExporting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#003d9b] dark:text-[#b2c5ff]" />
          ) : (
            <Download className="w-3.5 h-3.5 text-[#003d9b] dark:text-[#b2c5ff]" />
          )}
          <span>Export</span>
        </button>

        <button
          type="button"
          onClick={() => setIsMenuOpen((prev) => !prev)}
          disabled={disabled || isQuickExporting}
          className="px-1.5 py-1.5 bg-white dark:bg-[#191c1e] hover:bg-[#f7f9fc] dark:hover:bg-[#22272e] text-[#515f74] dark:text-[#bec6e0] transition-colors disabled:opacity-50"
          title="Quick Export Options"
        >
          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${isMenuOpen ? "rotate-180" : ""}`} />
        </button>
      </div>

      {/* Quick Dropdown Menu */}
      {isMenuOpen && (
        <div className="absolute right-0 top-full mt-1.5 w-56 bg-white dark:bg-[#1e2329] border border-[#c6c6cd] dark:border-[#45464d] rounded-xl shadow-xl z-50 py-1.5 text-xs text-[#191c1e] dark:text-[#e1e2e5] animate-in fade-in zoom-in-95 duration-150">
          <div className="px-3 py-1.5 text-[10px] font-bold tracking-wider uppercase text-[#72777f] dark:text-[#8c9199] border-b border-[#e1e2e5] dark:border-[#35393e]">
            Quick Export ({selectedRows.length > 0 ? `${selectedRows.length} Selected` : `${data.length} Rows`})
          </div>

          <button
            type="button"
            onClick={() => handleQuickExport("xlsx")}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-[#f7f9fc] dark:hover:bg-[#282d34] transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div>
              <span className="font-medium block">Excel Spreadsheet (.xlsx)</span>
              <span className="text-[10px] text-[#72777f] dark:text-[#8c9199]">Styled Workbook with Totals</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleQuickExport("csv")}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-[#f7f9fc] dark:hover:bg-[#282d34] transition-colors"
          >
            <Table className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <div>
              <span className="font-medium block">Comma-Separated (.csv)</span>
              <span className="text-[10px] text-[#72777f] dark:text-[#8c9199]">Universal RFC 4180 Format</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleQuickExport("txt")}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-[#f7f9fc] dark:hover:bg-[#282d34] transition-colors"
          >
            <FileText className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <span className="font-medium block">Plain Text (.txt)</span>
              <span className="text-[10px] text-[#72777f] dark:text-[#8c9199]">Aligned Monospace Table</span>
            </div>
          </button>

          <div className="my-1 border-t border-[#e1e2e5] dark:border-[#35393e]" />

          <button
            type="button"
            onClick={() => {
              setIsMenuOpen(false);
              setIsModalOpen(true);
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-[#003d9b]/10 dark:hover:bg-[#003d9b]/25 text-[#003d9b] dark:text-[#b2c5ff] font-bold transition-colors"
          >
            <SlidersHorizontal className="w-4 h-4 shrink-0" />
            <span>Open Export Center...</span>
          </button>
        </div>
      )}

      {/* Advanced Export Center Modal */}
      <ExportCenterModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        moduleTitle={moduleTitle}
        columns={columns}
        currentPageData={data}
        selectedRows={selectedRows}
        totalRecordsCount={totalRecordsCount}
        filteredRecordsCount={filteredRecordsCount}
        apiEndpoint={apiEndpoint}
        appliedFilters={appliedFilters}
        searchTerm={searchTerm}
        dateRange={dateRange}
        companyName={companyName}
        branchName={branchName}
        onNotification={onNotification}
      />
    </div>
  );
};
