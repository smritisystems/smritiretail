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

import { useState, useCallback } from "react";
import {
  ExportColumnDefinition,
  ExportFormat,
  ExportProgressState,
  ExportResult,
  ExportScope,
} from "../components/export/types.ts";
import { GlobalExportService } from "../services/globalExportService.ts";

export interface UseGlobalExportOptions {
  moduleTitle: string;
  columns: ExportColumnDefinition[];
  apiEndpoint?: string;
  defaultFormat?: ExportFormat;
  companyName?: string;
  branchName?: string;
  onNotification?: (title: string, message: string, type?: "success" | "error" | "info" | "warning") => void;
}

export function useGlobalExport(options: UseGlobalExportOptions) {
  const { moduleTitle, columns, apiEndpoint, defaultFormat = "xlsx", companyName, branchName, onNotification } = options;

  const [isExportCenterOpen, setIsExportCenterOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [progressState, setProgressState] = useState<ExportProgressState>({
    isExporting: false,
    currentStep: "idle",
    fetchedCount: 0,
    totalEstimatedCount: 0,
    currentPage: 0,
    totalPages: 0,
    percentage: 0,
  });

  const openExportCenter = useCallback(() => {
    setIsExportCenterOpen(true);
  }, []);

  const closeExportCenter = useCallback(() => {
    setIsExportCenterOpen(false);
  }, []);

  const triggerDirectExport = useCallback(
    async (
      data: any[],
      format: ExportFormat = defaultFormat,
      scope: ExportScope = "currentPage",
      customOptions?: {
        selectedRows?: any[];
        searchTerm?: string;
        appliedFilters?: Record<string, any>;
        customFilename?: string;
      }
    ): Promise<ExportResult> => {
      setIsExporting(true);
      try {
        const targetRows = customOptions?.selectedRows?.length ? customOptions.selectedRows : data;
        const result = await GlobalExportService.exportDataset({
          moduleName: moduleTitle,
          format,
          scope,
          columns: columns.filter((c) => c.isVisible !== false),
          data: targetRows,
          selectedRows: customOptions?.selectedRows,
          customFilename: customOptions?.customFilename,
          metadata: {
            moduleTitle,
            companyName,
            branchName,
            exportTimestamp: new Date().toLocaleString(),
            searchTerm: customOptions?.searchTerm,
            appliedFilters: customOptions?.appliedFilters,
            totalRecordsCount: targetRows.length,
            selectedRecordsCount: customOptions?.selectedRows?.length,
          },
        });

        if (result.success) {
          onNotification?.(
            "Export Successful",
            `Successfully exported ${result.rowCount} records to ${result.filename}`,
            "success"
          );
        } else {
          onNotification?.("Export Failed", result.errorMessage || "No records to export.", "error");
        }
        return result;
      } catch (err: any) {
        onNotification?.("Export Failed", err?.message || "Failed to generate export.", "error");
        return {
          success: false,
          filename: "",
          format,
          rowCount: 0,
          fileSizeBytes: 0,
          errorMessage: err?.message,
        };
      } finally {
        setIsExporting(false);
      }
    },
    [moduleTitle, columns, defaultFormat, companyName, branchName, onNotification]
  );

  return {
    isExportCenterOpen,
    isExporting,
    progressState,
    openExportCenter,
    closeExportCenter,
    triggerDirectExport,
  };
}
