/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.46.1
 * Created      : 2026-08-21
 * Modified     : 2026-09-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { 
  Table, 
  CheckCircle, 
  Filter, 
  Play, 
  RefreshCw,
  Sparkles,
  Layers,
  Database
} from "lucide-react";
import { apiFetchV1 } from "../../lib/apiFetchV1.ts";
import { validateItemMasterLookupOptions } from "../../services/itemMasterLookupGate.ts";
import { HeaderMappingEngine } from "../../lib/headerMapping/HeaderMappingEngine.ts";
import { ColumnMappingResult } from "../../lib/headerMapping/types.ts";
import { 
  getUnifiedItemMasterFields, 
  getGloballyVisibleFields,
  isFieldGloballyVisible,
  getUnifiedHeaderMappingFields, 
  serializeProductAttributes,
  CORE_STANDARD_ITEM_FIELDS,
  UnifiedItemField
} from "../../services/unifiedFieldCatalog.ts";
import { generateSkuCode } from "../../services/skuGenerationEngine.ts";
import { AttributeDefinition, Product } from "../../types.ts";
import { ItemMasterFieldDefinition } from "./types.ts";

interface SmritiItemMasterStudioProps {
  onRefreshProducts?: () => Promise<void>;
  onNotification?: (title: string, message: string, type?: "success" | "error") => void;
  currentUser?: { role: string; name: string } | null;
  onCancel?: () => void;
}

interface ParsedRowData {
  rowIndex: number;
  tokens: string[];
  hasError: boolean;
  errorMessage?: string;
  isSkipped?: boolean;
}

export const ItemMasterStudio: React.FC<SmritiItemMasterStudioProps> = ({
  onRefreshProducts,
  onNotification,
  currentUser,
  onCancel
}) => {
  const [rawText, setRawText] = useState<string>("");
  const [dynamicDefinitions, setDynamicDefinitions] = useState<AttributeDefinition[]>([]);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState<boolean>(true);
  const [detectedColumns, setDetectedColumns] = useState<ColumnMappingResult[]>([]);
  const [manualOverrides, setManualOverrides] = useState<Record<number, string>>({});
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showOnlyErrors, setShowOnlyErrors] = useState<boolean>(false);
  const [skippedRowIndices, setSkippedRowIndices] = useState<Set<number>>(new Set());
  const [activeConflictRow, setActiveConflictRow] = useState<number | null>(null);
  const [visibilityVersion, setVisibilityVersion] = useState<number>(0);
  // Backend-driven preview results — validity banner and error counts derived from IM-001 backend
  const [previewResult, setPreviewResult] = useState<Record<string, any> | null>(null);
  const [previewErrors, setPreviewErrors] = useState<string[]>([]);
  const [previewWarnings, setPreviewWarnings] = useState<string[]>([]);
  const [isValidating, setIsValidating] = useState<boolean>(false);

  // Listen to global visibility changes
  useEffect(() => {
    const handleVisChange = () => setVisibilityVersion(v => v + 1);
    window.addEventListener("smriti_field_visibility_updated", handleVisChange);
    return () => window.removeEventListener("smriti_field_visibility_updated", handleVisChange);
  }, []);

  // ── 1. Load Canonical Backend Attribute Definitions ───────────────────────
  useEffect(() => {
    let isMounted = true;
    const fetchMetadata = async () => {
      setIsLoadingMetadata(true);
      try {
        const defs = await apiFetchV1("/attributes/definitions");
        if (isMounted && Array.isArray(defs)) {
          setDynamicDefinitions(defs);
        }
      } catch (err) {
        console.warn("[ItemMasterStudio] Metadata load notice:", err);
      } finally {
        if (isMounted) setIsLoadingMetadata(false);
      }
    };

    fetchMetadata();
    return () => { isMounted = false; };
  }, []);

  // ── 2. Construct Canonical Unified Field Catalog & Mapping Engine (Globally Synced) ─────────
  const unifiedItemFields = useMemo<UnifiedItemField[]>(() => {
    return getGloballyVisibleFields(dynamicDefinitions);
  }, [dynamicDefinitions, visibilityVersion]);

  const mappingEngine = useMemo<HeaderMappingEngine>(() => {
    const unifiedHeaderFields = getUnifiedHeaderMappingFields(dynamicDefinitions)
      .filter(f => {
        const cleanKey = f.key.replace(/^attr_/, "");
        return isFieldGloballyVisible(cleanKey) || isFieldGloballyVisible(f.key);
      });
    return new HeaderMappingEngine(unifiedHeaderFields);
  }, [dynamicDefinitions, visibilityVersion]);

  // ── 3. Parse Raw Matrix from Textarea ─────────────────────────────────────
  const matrix = useMemo(() => {
    if (!rawText.trim()) return [];
    const lines = rawText.trim().split(/\r\n|\n|\r/).filter(l => l.trim().length > 0);
    if (lines.length === 0) return [];

    const firstLine = lines[0];
    const hasTabs = firstLine.includes("\t");
    const hasCommas = !hasTabs && firstLine.includes(",");
    const hasSemicolons = !hasTabs && !hasCommas && firstLine.includes(";");

    return lines.map(line => {
      if (hasTabs) {
        return line.split("\t").map(c => c.trim());
      } else if (hasCommas) {
        return line.split(",").map(c => c.trim());
      } else if (hasSemicolons) {
        return line.split(";").map(c => c.trim());
      } else {
        return line.split(/\t+|\s{2,}/).map(c => c.trim());
      }
    });
  }, [rawText]);

  // ── 4. Detect Header Row & Extract Columns ────────────────────────────────
  const headerDetection = useMemo(() => {
    if (matrix.length === 0) {
      return { headerRowIndex: 0, headers: [] as string[], dataRows: [] as string[][] };
    }

    const detected = mappingEngine.detectHeaderRow(matrix);
    const hasRecognized = detected.headers.some(h => mappingEngine.isKnownHeader(h));
    
    if (hasRecognized && detected.headerRowIndex >= 0) {
      return {
        headerRowIndex: detected.headerRowIndex,
        headers: detected.headers,
        dataRows: matrix.slice(detected.headerRowIndex + 1)
      };
    } else {
      const firstRow = matrix[0] || [];
      return {
        headerRowIndex: 0,
        headers: firstRow,
        dataRows: matrix.slice(1)
      };
    }
  }, [matrix, mappingEngine]);

  // ── 5. Auto-Map Detected Headers via Canonical HeaderMappingEngine ────────
  useEffect(() => {
    if (headerDetection.headers.length > 0) {
      const mapping = mappingEngine.mapHeaders(headerDetection.headers, 'ITEM_MASTER');
      setDetectedColumns(mapping.columns);
      setManualOverrides({});
    } else {
      setDetectedColumns([]);
      setManualOverrides({});
    }
  }, [headerDetection.headers, mappingEngine]);

  // Effective mapping lookup: sourceIndex -> canonical fieldKey
  const effectiveMapping = useMemo(() => {
    const map = new Map<number, string>();
    detectedColumns.forEach(col => {
      const override = manualOverrides[col.sourceIndex];
      let target = override !== undefined ? override : (col.mappedFieldKey || "");
      // Clean prefix if generated as attr_key
      if (target.startsWith("attr_")) {
        target = target.replace(/^attr_/, "");
      }
      if (target) map.set(col.sourceIndex, target);
    });
    return map;
  }, [detectedColumns, manualOverrides]);

  // ── 6. Validate Data Rows Against Schema ──────────────────────────────────
  const parsedRows: ParsedRowData[] = useMemo(() => {
    return headerDetection.dataRows.map((tokens, idx) => {
      const isSkipped = skippedRowIndices.has(idx);
      let hasError = false;
      let errorMessage = "";

      const stockNoColIdx = detectedColumns.findIndex(c => {
        const key = (manualOverrides[c.sourceIndex] || c.mappedFieldKey || "").replace(/^attr_/, "");
        return key === "code" || key === "stockNo";
      });
      const nameColIdx = detectedColumns.findIndex(c => {
        const key = (manualOverrides[c.sourceIndex] || c.mappedFieldKey || "").replace(/^attr_/, "");
        return key === "name" || key === "product";
      });

      if (stockNoColIdx >= 0 && !tokens[stockNoColIdx]?.trim()) {
        hasError = true;
        errorMessage = "Missing required SKU / Stock No.";
      } else if (nameColIdx >= 0 && !tokens[nameColIdx]?.trim()) {
        hasError = true;
        errorMessage = "Missing required Product Name.";
      } else if (tokens.length < 2) {
        hasError = true;
        errorMessage = "Insufficient columns in row.";
      }

      return {
        rowIndex: idx + 1,
        tokens,
        hasError,
        errorMessage,
        isSkipped
      };
    });
  }, [headerDetection.dataRows, detectedColumns, manualOverrides, skippedRowIndices]);

  const errorCount = useMemo(() => parsedRows.filter(r => r.hasError && !r.isSkipped).length, [parsedRows]);

  // Derived mandatory columns check — prevents 'All Rows Valid' when required footwear dimensions are dropped
  const missingMandatoryColumns = useMemo(() => {
    if (headerDetection.dataRows.length === 0) return [];
    const mapped = new Set(Array.from(effectiveMapping.values()).map(k => k.toLowerCase()));
    const requiredFields = [
      { key: "style_code", label: "Style Code", aliases: ["style", "style_code", "article", "article_style_code"] },
      { key: "brand", label: "Brand", aliases: ["brand", "brand_name"] },
      { key: "gender", label: "Gender", aliases: ["gender"] },
      { key: "product_type", label: "Product Type", aliases: ["product_type", "merchandise_category", "producttype"] },
      { key: "heel_type", label: "Heel Type", aliases: ["heel_type", "heeltype"] },
      { key: "upper_material", label: "Upper Material", aliases: ["upper_material", "uppermaterial"] },
      { key: "color", label: "Color", aliases: ["color", "colour"] },
      { key: "size", label: "Size", aliases: ["size"] },
    ];
    return requiredFields.filter(f => !f.aliases.some(a => mapped.has(a)));
  }, [effectiveMapping, headerDetection.dataRows.length]);

  const filteredRows = useMemo(() => {
    return parsedRows.filter(r => {
      if (showOnlyErrors && !r.hasError) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return r.tokens.some(t => t.toLowerCase().includes(q));
      }
      return true;
    });
  }, [parsedRows, showOnlyErrors, searchQuery]);

  useEffect(() => {
    const firstErr = parsedRows.find(r => r.hasError && !r.isSkipped);
    if (firstErr) {
      setActiveConflictRow(firstErr.rowIndex - 1);
    } else {
      setActiveConflictRow(null);
    }
  }, [parsedRows]);

  // ── 7. Auto-Resolve Missing SKU via Canonical skuGenerationEngine ─────────
  const handleAutoFillSku = useCallback((rowIdx: number) => {
    const targetDataRow = headerDetection.dataRows[rowIdx];
    if (!targetDataRow) return;

    // Resolve brand, style, shade, size from row tokens
    let brand = "GEN";
    let styleCode = "STYLE";
    let colour = "STD";
    let size = "M";

    targetDataRow.forEach((val, colIdx) => {
      const key = effectiveMapping.get(colIdx);
      if (!val.trim()) return;
      if (key === "brand") brand = val.trim();
      else if (key === "style" || key === "style_code") styleCode = val.trim();
      else if (key === "colour" || key === "color" || key === "shade") colour = val.trim();
      else if (key === "size") size = val.trim();
    });

    const generatedSku = generateSkuCode({
      brand,
      styleCode,
      colour,
      size
    }, { mode: "AUTO", prefix: "SKU", sequenceStart: 1001 }, rowIdx);

    const nextMatrix = [...matrix];
    const absoluteRowIdx = headerDetection.headerRowIndex >= 0
      ? headerDetection.headerRowIndex + 1 + rowIdx
      : rowIdx;

    if (nextMatrix[absoluteRowIdx]) {
      nextMatrix[absoluteRowIdx][0] = generatedSku;
      setRawText(nextMatrix.map(r => r.join("\t")).join("\n"));
    }
  }, [headerDetection, matrix, effectiveMapping]);

  // ── 8. Two-Phase Universal Import: Preview then Commit via IM-001 governed route ─────────
  // CRITICAL: This component MUST route through /api/v1/universal-import/preview and
  // /api/v1/universal-import/commit. The legacy /products/ endpoint is decommissioned.
  // Style/article MUST come from the mapped field — never derived from SKU code.

  const buildImportRows = useCallback(() => {
    return parsedRows
      .filter(r => !r.isSkipped)
      .map((row, idx) => {
        const obj: Record<string, any> = { rowNumber: idx + 1 };
        row.tokens.forEach((val, colIdx) => {
          const fieldKey = effectiveMapping.get(colIdx);
          // Skip unmapped columns and blank values entirely — no fabricated defaults
          if (!fieldKey || !val.trim()) return;
          obj[fieldKey] = val.trim();
        });
        return obj;
      });
  }, [parsedRows, effectiveMapping]);

  const handlePreviewAndImport = async () => {
    const rows = buildImportRows();
    if (rows.length === 0) {
      onNotification?.("No Data", "Please paste valid rows before importing.", "error");
      return;
    }

    setIsProcessing(true);
    setPreviewResult(null);
    setPreviewErrors([]);

    try {
      // PHASE 1: Preview — backend validates against IM-001 mandatory fields, lookup master, duplicates
      const previewResp = await apiFetchV1("/universal-import/preview", {
        method: "POST",
        body: JSON.stringify({
          target: "ITEM_MASTER",
          rows
        })
      });

      setPreviewResult(previewResp);

      // Collect all blocking errors from preview row results
      const blockingErrors: string[] = [];
      if (Array.isArray(previewResp?.row_results)) {
        previewResp.row_results.forEach((rr: any) => {
          if (Array.isArray(rr?.errors) && rr.errors.length > 0) {
            rr.errors.forEach((e: string) => blockingErrors.push(`Row ${rr.row_number}: ${e}`));
          }
        });
      }

      // Collect warnings (including HSN/synthetic mismatch review flags)
      const warnings: string[] = [];
      if (Array.isArray(previewResp?.all_warnings)) {
        previewResp.all_warnings.forEach((w: string) => warnings.push(w));
      } else if (Array.isArray(previewResp?.warnings)) {
        previewResp.warnings.forEach((w: string) => warnings.push(w));
      }
      setPreviewWarnings(warnings);

      if (blockingErrors.length > 0) {
        setPreviewErrors(blockingErrors);
        onNotification?.(
          "Preview: Validation Errors Detected",
          `${blockingErrors.length} blocking error(s) found. Fix issues before committing. First error: ${blockingErrors[0]}`,
          "error"
        );
        return; // Do not proceed to commit
      }

      // PHASE 2: Commit — all rows passed preview validation
      const commitResp = await apiFetchV1("/universal-import/commit", {
        method: "POST",
        body: JSON.stringify({
          target: "ITEM_MASTER",
          rows
        })
      });

      const saved = commitResp?.saved ?? commitResp?.created ?? 0;
      const skipped = commitResp?.skipped ?? 0;
      const failed = commitResp?.failed ?? commitResp?.errors ?? 0;

      if (saved > 0) {
        onNotification?.(
          "Import Complete",
          `IM-001 committed: ${saved} items saved${skipped > 0 ? `, ${skipped} skipped (existing)` : ""}.${failed > 0 ? ` ${failed} failed.` : ""}`,
          "success"
        );
        await onRefreshProducts?.();
        setRawText("");
        setPreviewResult(null);
        setPreviewWarnings([]);
      } else {
        onNotification?.(
          "Import Failed",
          `No items were saved. ${failed > 0 ? `${failed} row(s) failed validation or conflict.` : "All rows may already exist."}`,
          "error"
        );
      }
    } catch (err: any) {
      const msg = err?.message || "Unexpected error during import";
      onNotification?.("Import Exception", msg, "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRunPreviewOnly = async () => {
    const rows = buildImportRows();
    if (rows.length === 0) return;
    setIsValidating(true);
    setPreviewResult(null);
    setPreviewErrors([]);
    setPreviewWarnings([]);
    try {
      const previewResp = await apiFetchV1("/universal-import/preview", {
        method: "POST",
        body: JSON.stringify({
          target: "ITEM_MASTER",
          rows
        })
      });
      setPreviewResult(previewResp);
      const blockingErrors: string[] = [];
      if (Array.isArray(previewResp?.row_results)) {
        previewResp.row_results.forEach((rr: any) => {
          if (Array.isArray(rr?.errors) && rr.errors.length > 0) {
            rr.errors.forEach((e: string) => blockingErrors.push(`Row ${rr.row_number}: ${e}`));
          }
        });
      }
      setPreviewErrors(blockingErrors);
      const warnings: string[] = [];
      if (Array.isArray(previewResp?.all_warnings)) {
        previewResp.all_warnings.forEach((w: string) => warnings.push(w));
      } else if (Array.isArray(previewResp?.warnings)) {
        previewResp.warnings.forEach((w: string) => warnings.push(w));
      }
      setPreviewWarnings(warnings);
      if (blockingErrors.length === 0) {
        onNotification?.("Preview Succeeded", `${previewResp?.new_rows ?? rows.length} row(s) validated against IM-001 master. Ready to import.`, "success");
      } else {
        onNotification?.("Preview Validation Failed", `${blockingErrors.length} blocking error(s) found.`, "error");
      }
    } catch (err: any) {
      setPreviewErrors([err?.message || "Failed to execute preview validation."]);
    } finally {
      setIsValidating(false);
    }
  };

  // Legacy stub kept to satisfy existing JSX button ref — delegates to new handler
  const handleResolveAndImport = handlePreviewAndImport;


  const handleSkipActiveConflict = () => {
    if (activeConflictRow !== null) {
      setSkippedRowIndices(prev => new Set([...prev, activeConflictRow]));
    }
  };

  return (
    <div className="bg-[#f7f9fb] dark:bg-[#191c1e] text-[#191c1e] dark:text-[#eff1f3] h-full flex flex-col antialiased select-none overflow-hidden font-sans">
      
      {/* Top Studio Control Header */}
      <header className="bg-white dark:bg-[#131b2e] border-b border-[#c6c6cd] dark:border-[#45464d] px-6 py-3 flex items-center justify-between shrink-0 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#515f74] dark:text-[#bec6e0]">table_view</span>
            <h2 className="text-base font-bold text-[#191c1e] dark:text-white">
              Item Master — Bulk Excel Paste &amp; Mapping Engine
            </h2>
            <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-[#e0e3e5] dark:bg-[#2d3133] text-[#515f74] dark:text-[#bec6e0] rounded">
              Unified Catalog: {unifiedItemFields.length} Attributes Active
            </span>
          </div>
          <p className="text-xs text-[#515f74] dark:text-[#a0a5b5] mt-0.5">
            Real-time spreadsheet parser, canonical schema alignment, and database persistence.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-[#76777d] text-[#191c1e] dark:text-[#eff1f3] bg-white dark:bg-[#2d3133] hover:bg-[#eceef0] rounded text-xs font-semibold transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleRunPreviewOnly}
            disabled={isProcessing || isValidating || matrix.length === 0 || headerDetection.dataRows.length === 0}
            className="px-3.5 py-2 border border-[#515f74] dark:border-[#bec6e0] text-[#191c1e] dark:text-[#eff1f3] bg-white dark:bg-[#2d3133] hover:bg-[#eceef0] rounded text-xs font-bold transition flex items-center gap-1.5 shadow-xs disabled:opacity-40"
          >
            {isValidating ? (
              <>
                <RefreshCw size={13} className="animate-spin" />
                Validating...
              </>
            ) : (
              <>
                <CheckCircle size={13} />
                Validate Preview
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handleResolveAndImport}
            disabled={isProcessing || isValidating || matrix.length === 0}
            className="px-5 py-2 bg-[#000000] dark:bg-[#dae2fd] text-white dark:text-[#131b2e] hover:bg-[#2d3133] dark:hover:bg-white rounded text-xs font-bold transition flex items-center gap-2 shadow-xs disabled:opacity-40"
          >
            {isProcessing ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                Saving to Database...
              </>
            ) : (
              <>
                <Play size={14} />
                Resolve &amp; Import ({headerDetection.dataRows.length} Rows)
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Split-Screen Canvas */}
      <div className="flex-1 grid grid-cols-12 gap-4 p-4 min-h-0 overflow-hidden">
        
        {/* Left Panel: Raw Paste Area */}
        <div className="col-span-12 xl:col-span-4 flex flex-col bg-white dark:bg-[#2d3133] border border-[#c6c6cd] dark:border-[#45464d] rounded-lg overflow-hidden shadow-xs">
          <div className="bg-[#f2f4f6] dark:bg-[#131b2e] px-4 py-2.5 border-b border-[#c6c6cd] dark:border-[#45464d] flex items-center justify-between shrink-0">
            <h3 className="text-xs font-bold text-[#191c1e] dark:text-white flex items-center gap-1.5 uppercase tracking-wider">
              <span className="material-symbols-outlined text-[#515f74] text-base">content_paste</span>
              Raw Data Input
            </h3>
            <span className="px-2 py-0.5 bg-[#e0e3e5] dark:bg-[#45464d] text-[#191c1e] dark:text-[#eff1f3] text-[10px] font-mono font-bold rounded">
              Ctrl+V
            </span>
          </div>

          <div className="flex-1 p-2 relative">
            <textarea
              value={rawText}
              onChange={e => setRawText(e.target.value)}
              placeholder="Paste your Excel or Google Sheets cells here...

Expected Columns:
StockNo	Product	Brand	Style	Shade	Size	MRP	Price	Tax"
              className="w-full h-full resize-none border-none p-3 font-mono text-xs text-[#191c1e] dark:text-[#eff1f3] bg-transparent outline-none leading-relaxed placeholder-[#76777d]"
            />

            {!rawText && (
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center opacity-40">
                <span className="material-symbols-outlined text-4xl mb-1 text-[#76777d]">grid_on</span>
                <p className="text-xs font-semibold text-[#191c1e] dark:text-white text-center max-w-[200px]">
                  Copy rows in Excel (Ctrl+C) and paste them here (Ctrl+V).
                </p>
              </div>
            )}
          </div>

          {/* Left Footer Bar */}
          <div className="bg-[#eceef0] dark:bg-[#131b2e] px-4 py-2 border-t border-[#c6c6cd] dark:border-[#45464d] flex justify-between items-center shrink-0 text-xs">
            <span className="font-mono text-[#515f74] dark:text-[#bec6e0] font-bold">
              {headerDetection.dataRows.length} data rows detected
            </span>
            <button
              type="button"
              onClick={() => { setRawText(""); setSkippedRowIndices(new Set()); }}
              disabled={!rawText}
              className="text-[#000000] dark:text-[#dae2fd] font-semibold hover:underline disabled:opacity-30"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Right Panel: Live Mapping & Preview Table */}
        <div className="col-span-12 xl:col-span-8 flex flex-col bg-white dark:bg-[#2d3133] border border-[#c6c6cd] dark:border-[#45464d] rounded-lg overflow-hidden shadow-xs min-h-0">
          
          {/* Right Header Bar */}
          <div className="bg-[#f2f4f6] dark:bg-[#131b2e] px-4 py-2 border-b border-[#c6c6cd] dark:border-[#45464d] flex items-center justify-between shrink-0">
            <h3 className="text-xs font-bold text-[#191c1e] dark:text-white flex items-center gap-1.5 uppercase tracking-wider">
              <span className="material-symbols-outlined text-[#515f74] text-base">table_chart</span>
              Live Mapping Preview
            </h3>

            <div className="flex items-center gap-3">
              {headerDetection.dataRows.length === 0 ? null : missingMandatoryColumns.length > 0 ? (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#ffdad6] text-[#93000a] rounded text-[11px] font-bold border border-[#ba1a1a]/30" title={`Missing required columns: ${missingMandatoryColumns.map(f => f.label).join(", ")}`}>
                  <span className="w-2 h-2 rounded-full bg-[#ba1a1a]"></span>
                  Missing Mandatory: {missingMandatoryColumns.map(f => f.label).join(", ")}
                </div>
              ) : previewErrors.length > 0 ? (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#ffdad6] text-[#93000a] rounded text-[11px] font-bold border border-[#ba1a1a]/30" title={previewErrors.slice(0, 3).join("\n")}>
                  <span className="w-2 h-2 rounded-full bg-[#ba1a1a]"></span>
                  {previewErrors.length} IM-001 Validation Error{previewErrors.length > 1 ? "s" : ""}
                </div>
              ) : previewResult && previewResult.status === "READY_FOR_IMPORT" ? (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#d1fae5] text-[#065f46] rounded text-[11px] font-bold border border-[#10b981]/30">
                  <CheckCircle size={12} className="text-[#059669]" />
                  IM-001 Validated ({previewResult.new_rows || 0} New Rows Ready)
                </div>
              ) : (
                <div className="flex items-center gap-1 text-[#515f74] dark:text-[#bec6e0] text-[11px] font-semibold bg-[#e0e3e5] dark:bg-[#45464d] px-2.5 py-1 rounded">
                  <span>Pending IM-001 Validation</span>
                </div>
              )}

              {previewWarnings.length > 0 && (
                <div className="flex items-center gap-1 px-2 py-0.5 bg-[#fef08a] text-[#854d0e] rounded text-[11px] font-bold border border-[#eab308]/40" title={previewWarnings.slice(0, 3).join("\n")}>
                  <span className="material-symbols-outlined text-[14px]">flag</span>
                  {previewWarnings.length} Review Flag{previewWarnings.length > 1 ? "s" : ""}
                </div>
              )}

              <div className="h-4 w-px bg-[#c6c6cd] dark:bg-[#45464d]"></div>

              <button
                type="button"
                onClick={() => setShowOnlyErrors(prev => !prev)}
                className={`text-xs px-2 py-1 rounded flex items-center gap-1 transition ${
                  showOnlyErrors ? "bg-[#ba1a1a] text-white font-bold" : "text-[#515f74] hover:text-[#191c1e] dark:text-[#bec6e0]"
                }`}
                title="Toggle errors filter"
              >
                <Filter size={12} />
                <span>Errors Only</span>
              </button>
            </div>
          </div>

          {/* Human / CA Sign-Off Review Flag Banner (e.g. HSN 6403 with Synthetic Upper) */}
          {previewWarnings.length > 0 && (
            <div className="bg-[#fef9c3] dark:bg-[#713f12]/40 border-b border-[#facc15] px-4 py-2 flex items-center justify-between text-xs text-[#854d0e] dark:text-[#fef08a] shrink-0">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-base text-[#ca8a04]">warning</span>
                <span className="font-bold">Human / CA Sign-Off Flag (REQUIRES_REVIEW):</span>
                <span>{previewWarnings[0]}</span>
                {previewWarnings.length > 1 && (
                  <span className="text-[11px] opacity-80">(+{previewWarnings.length - 1} more flag{previewWarnings.length > 2 ? "s" : ""})</span>
                )}
              </div>
            </div>
          )}

          {/* Table Container with Sticky Column Header Selectors */}
          <div className="flex-1 overflow-auto bg-white dark:bg-[#191c1e]">
            {headerDetection.dataRows.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8 text-center">
                <Table size={36} className="mb-2 opacity-30 text-[#515f74]" />
                <p className="text-xs font-semibold">No data loaded yet.</p>
                <p className="text-[11px] text-[#76777d] mt-0.5">Paste tab-delimited Excel cells on the left to preview column mapping.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead className="sticky top-0 bg-white dark:bg-[#131b2e] z-10 shadow-xs">
                  <tr className="border-b border-[#c6c6cd] dark:border-[#45464d]">
                    <th className="w-10 px-3 py-2 border-r border-[#c6c6cd] dark:border-[#45464d] bg-[#f2f4f6] dark:bg-[#131b2e] text-center text-[10px] font-mono font-bold text-[#515f74]">
                      #
                    </th>
                    {detectedColumns.map((col) => {
                      const override = manualOverrides[col.sourceIndex];
                      let effectiveKey = override !== undefined ? override : (col.mappedFieldKey || "");
                      if (effectiveKey.startsWith("attr_")) effectiveKey = effectiveKey.replace(/^attr_/, "");
                      const isAutoMapped = col.confidence === 'EXACT' || col.confidence === 'HIGH';

                      return (
                        <th
                          key={col.sourceIndex}
                          className="px-3 py-2 border-r border-[#c6c6cd] dark:border-[#45464d] min-w-[140px]"
                        >
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] text-[#76777d] font-mono uppercase truncate">
                              Input Col {col.sourceIndex + 1}: {col.sourceHeader}
                            </span>
                            
                            {/* Interactive Target Field Selector from Canonical Unified Catalog */}
                            <select
                              value={effectiveKey}
                              onChange={e => setManualOverrides(prev => ({ ...prev, [col.sourceIndex]: e.target.value }))}
                              className={`w-full text-xs font-semibold px-2 py-1 rounded border outline-none cursor-pointer transition ${
                                effectiveKey
                                  ? isAutoMapped
                                    ? "bg-[#d5e3fd] text-[#0d1c2f] border-[#515f74]"
                                    : "bg-[#e0e3e5] text-[#191c1e] border-[#76777d]"
                                  : "bg-[#ffdad6] text-[#93000a] border-[#ba1a1a]"
                              }`}
                            >
                              <option value="">(Skip Column)</option>
                              {unifiedItemFields.map(f => (
                                <option key={f.id} value={f.key}>
                                  {f.label}{f.source === "dynamic" ? " [Dynamic]" : ""}
                                </option>
                              ))}
                            </select>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#eceef0] dark:divide-[#2d3133] text-xs">
                  {filteredRows.map((row) => {
                    const isConflict = row.hasError && !row.isSkipped;
                    const isSkipped = row.isSkipped;

                    return (
                      <tr
                        key={row.rowIndex}
                        className={`transition ${
                          isSkipped
                            ? "opacity-30 bg-[#eceef0]"
                            : isConflict
                            ? "bg-[#ffdad6]/25 hover:bg-[#ffdad6]/40"
                            : "hover:bg-[#f7f9fb] dark:hover:bg-[#2d3133]"
                        }`}
                      >
                        <td className="px-3 py-2 border-r border-[#c6c6cd] dark:border-[#45464d] text-center font-mono font-bold text-[#515f74] bg-[#f2f4f6] dark:bg-[#131b2e]/60">
                          {row.rowIndex}
                        </td>
                        {detectedColumns.map((col) => {
                          const val = row.tokens[col.sourceIndex] || "";
                          const fieldKey = effectiveMapping.get(col.sourceIndex);
                          const isKeyField = fieldKey === "code" || fieldKey === "stockNo";

                          return (
                            <td
                              key={col.sourceIndex}
                              className={`px-3 py-2 border-r border-[#c6c6cd] dark:border-[#45464d] ${
                                isKeyField ? "font-mono font-bold text-[#000000] dark:text-[#dae2fd]" : ""
                              }`}
                            >
                              {val ? (
                                <span>{val}</span>
                              ) : (
                                <span className="text-[#76777d] italic text-[11px]">—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Bottom Resolution Drawer */}
          {activeConflictRow !== null && (
            <div className="bg-[#ffdad6] dark:bg-[#93000a]/30 border-t border-[#ba1a1a] p-4 flex items-start gap-3 shrink-0">
              <span className="material-symbols-outlined text-[#ba1a1a] mt-0.5">error</span>
              <div className="flex-1 text-xs">
                <h4 className="font-bold text-[#93000a] dark:text-[#ffdad6] text-xs uppercase tracking-wide">
                  Mapping Conflict Detected in Row {activeConflictRow + 1}
                </h4>
                <p className="text-[#93000a] dark:text-[#ffdad6] mt-0.5">
                  {parsedRows[activeConflictRow]?.errorMessage || "Required fields are missing or unassigned for this row."}
                </p>
                <div className="mt-2.5 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSkipActiveConflict}
                    className="px-3 py-1 bg-white dark:bg-[#2d3133] text-[#191c1e] dark:text-white border border-[#c6c6cd] rounded font-semibold text-[11px] hover:bg-[#eceef0] transition"
                  >
                    Skip Row {activeConflictRow + 1}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAutoFillSku(activeConflictRow)}
                    className="px-3 py-1 bg-[#ba1a1a] text-white rounded font-bold text-[11px] hover:bg-[#93000a] transition flex items-center gap-1"
                  >
                    <Sparkles size={11} />
                    Auto-Fill Standard SKU
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

    </div>
  );
};

export default ItemMasterStudio;
