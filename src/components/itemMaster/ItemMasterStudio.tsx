/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.70.48
 * Created      : 2026-08-21
 * Modified     : 2026-10-09 (v6.70.48 — Smart Import & Correction Studio, blank row filtering, inline cell editing, 7-metric dashboard, conflict drawer, bulk auto-fix, and safe partial commits)
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { 
  Table, 
  CheckCircle, 
  AlertCircle,
  AlertTriangle,
  Filter, 
  Play, 
  RefreshCw,
  Sparkles,
  Layers,
  Database,
  Undo,
  Download,
  Eye,
  X,
  Check,
  ArrowRight,
  Search,
  Plus,
  Trash2,
  Edit3,
  ShieldAlert,
  FileText,
  RotateCcw,
  CheckSquare,
  Square,
  HelpCircle,
  ChevronDown,
  Info
} from "lucide-react";
import { apiFetchV1 } from "../../lib/apiFetchV1.ts";
import { HeaderMappingEngine } from "../../lib/headerMapping/HeaderMappingEngine.ts";
import { ColumnMappingResult } from "../../lib/headerMapping/types.ts";
import { GridInputEngine } from "../../services/gridInput/gridInputEngine.ts";
import { 
  getGloballyVisibleFields,
  isFieldGloballyVisible,
  getUnifiedHeaderMappingFields, 
  CORE_STANDARD_ITEM_FIELDS,
  UnifiedItemField
} from "../../services/unifiedFieldCatalog.ts";
import { generateSkuCode } from "../../services/skuGenerationEngine.ts";
import { AttributeDefinition } from "../../types.ts";
import { ImportBatchManager, ImportBatchRecord } from "../../services/importBatchManager.ts";

interface SmritiItemMasterStudioProps {
  onRefreshProducts?: () => Promise<void>;
  onNotification?: (title: string, message: string, type?: "success" | "error" | "info" | "warning") => void;
  currentUser?: { role: string; name: string } | null;
  onCancel?: () => void;
  onImportCompleted?: (batch: ImportBatchRecord) => void;
}

interface ParsedRowData {
  rowIndex: number;
  tokens: string[];
  hasError: boolean;
  errorMessage?: string;
  isSkipped?: boolean;
}

type FilterTab = "ALL" | "VALID" | "ERRORS" | "WARNINGS" | "CORRECTED" | "SKIPPED";
type ImportStrategy = "ALL_ELIGIBLE" | "VALID_ONLY" | "STRICT";
type MatchMode = "SKIP" | "UPDATE_METADATA_AND_PRICE" | "FAIL_ON_EXISTING";

const FIELD_LABEL: Record<string, string> = {
  BRAND_NAME: 'Brand Name',
  brand: 'Brand',
  COLOR: 'Colour',
  color: 'Colour',
  SIZE: 'Size',
  size: 'Size',
  GENDER: 'Gender',
  gender: 'Gender',
  MERCHANDISE_DEPARTMENT: 'Department',
  department: 'Department',
  MERCHANDISE_CATEGORY: 'Category',
  category: 'Category',
  PRODUCT_TYPE: 'Product Type',
  product_type: 'Product Type',
  HEEL_TYPE: 'Heel Type',
  heel_type: 'Heel Type',
  UPPER_MATERIAL: 'Upper Material',
  upper_material: 'Upper Material',
  UOM: 'Unit of Measure',
  uom: 'Unit of Measure',
  DESIGN_ATTRIBUTE: 'Design / Sub-Category',
  design_attribute: 'Design / Sub-Category',
  OUTSOLE_MATERIAL: 'Outsole Material',
  outsole_material: 'Outsole Material',
  COLLECTION_TYPE: 'Collection Type',
  collection_type: 'Collection Type',
  GST_RATE_PERCENT: 'GST %',
  tax_rate: 'GST Tax Rate',
  style_code: 'Style / Article Code',
  sku: 'Variant SKU',
  barcode: 'Barcode (EAN-13 / UPC)',
  mrp: 'Maximum Retail Price (MRP)',
  selling_price: 'Selling Price',
  cost_price: 'Cost Price',
  vendor_code: 'Supplier / Vendor Code',
  warehouse_code: 'Warehouse Location',
  hsn: 'HSN Code',
};

export const ItemMasterStudio: React.FC<SmritiItemMasterStudioProps> = ({
  onRefreshProducts,
  onNotification,
  currentUser,
  onCancel,
  onImportCompleted,
}) => {
  const [rawText, setRawText] = useState<string>("");
  const [dynamicDefinitions, setDynamicDefinitions] = useState<AttributeDefinition[]>([]);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState<boolean>(true);
  const [detectedColumns, setDetectedColumns] = useState<ColumnMappingResult[]>([]);
  const [manualOverrides, setManualOverrides] = useState<Record<number, string>>({});
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeFilterTab, setActiveFilterTab] = useState<FilterTab>("ALL");
  const [visibilityVersion, setVisibilityVersion] = useState<number>(0);

  // Backend preview results & reconciliation report
  const [previewResult, setPreviewResult] = useState<Record<string, any> | null>(null);
  const [previewReport, setPreviewReport] = useState<any[]>([]);
  const [previewErrors, setPreviewErrors] = useState<string[]>([]);
  const [previewWarnings, setPreviewWarnings] = useState<string[]>([]);
  const [approvedValuesMap, setApprovedValuesMap] = useState<Record<string, string[]>>({});

  // Cell-level inline corrections & user state
  const [rowCorrections, setRowCorrections] = useState<Map<number, Record<string, string>>>(new Map());
  const [skippedByUser, setSkippedByUser] = useState<Set<number>>(new Set());
  const [activeConflictRow, setActiveConflictRow] = useState<number | null>(null);
  const [editingCell, setEditingCell] = useState<{ rowNumber: number; fieldKey: string } | null>(null);

  // Import Strategy & Match Mode
  const [importStrategy, setImportStrategy] = useState<ImportStrategy>("ALL_ELIGIBLE");
  const [existingMatchMode, setExistingMatchMode] = useState<MatchMode>("SKIP");
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [hasHeaderRow, setHasHeaderRow] = useState<boolean>(true);
  const [isDraggingFile, setIsDraggingFile] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── 1. Listen to global visibility changes ────────────────────────────────
  useEffect(() => {
    const handleVisChange = () => setVisibilityVersion(v => v + 1);
    window.addEventListener("smriti_field_visibility_updated", handleVisChange);
    return () => window.removeEventListener("smriti_field_visibility_updated", handleVisChange);
  }, []);

  // ── 2. Load Canonical Backend Attribute Definitions ───────────────────────
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

  // ── 3. Construct Canonical Unified Field Catalog & Mapping Engine ─────────
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

  // ── 4. Parse Raw Matrix from Textarea via SMRITI GridInputEngine ──────────
  const matrix = useMemo(() => {
    if (!rawText.trim()) return [];
    const parseResult = GridInputEngine.parseDelimitedText(rawText);
    return parseResult.matrix;
  }, [rawText]);

  // Auto-detect header row presence when matrix changes
  useEffect(() => {
    if (matrix.length === 0) return;
    const detected = mappingEngine.detectHeaderRow(matrix);
    const hasRecognized = detected.headers.some(h => mappingEngine.isKnownHeader(h));
    if (hasRecognized && detected.headerRowIndex >= 0) {
      setHasHeaderRow(true);
    }
  }, [matrix, mappingEngine]);

  // ── 5. Detect Header Row & Extract Columns ────────────────────────────────
  const headerDetection = useMemo(() => {
    if (matrix.length === 0) {
      return { headerRowIndex: 0, headers: [] as string[], dataRows: [] as string[][] };
    }

    if (!hasHeaderRow) {
      const maxCols = Math.max(...matrix.map(r => r.length));
      const headers = Array.from({ length: maxCols }, (_, i) => `Column ${i + 1}`);
      return {
        headerRowIndex: -1,
        headers,
        dataRows: matrix
      };
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
  }, [matrix, mappingEngine, hasHeaderRow]);

  // ── 6. Auto-Map Detected Headers via Canonical HeaderMappingEngine ────────
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
      if (target.startsWith("attr_")) {
        target = target.replace(/^attr_/, "");
      }
      if (target) map.set(col.sourceIndex, target);
    });
    return map;
  }, [detectedColumns, manualOverrides]);

  // Inverted mapping: fieldKey -> sourceIndex
  const fieldToColMap = useMemo(() => {
    const map = new Map<string, number>();
    effectiveMapping.forEach((fieldKey, colIdx) => {
      map.set(fieldKey.toLowerCase(), colIdx);
    });
    return map;
  }, [effectiveMapping]);

  // ── 7. Build Import Payload with merged inline corrections ────────────────
  const buildImportRows = useCallback(
    (
      correctionsMap: Map<number, Record<string, string>> = rowCorrections,
      userSkips: Set<number> = skippedByUser
    ) => {
      return headerDetection.dataRows.map((tokens, idx) => {
        const rowNum = idx + 1;
        const obj: Record<string, any> = { rowNumber: rowNum };
        let hasAnyData = false;
        tokens.forEach((val, colIdx) => {
          const fieldKey = effectiveMapping.get(colIdx);
          if (!fieldKey || !val.trim()) return;
          obj[fieldKey] = val.trim();
          hasAnyData = true;
        });
        // Merge user corrections
        if (correctionsMap.has(rowNum)) {
          const edits = correctionsMap.get(rowNum) || {};
          Object.assign(obj, edits);
          if (Object.keys(edits).length > 0) hasAnyData = true;
        }
        return { obj, hasAnyData };
      })
      .filter(item => item.hasAnyData && !userSkips.has(item.obj.rowNumber))
      .map(item => item.obj);
    },
    [headerDetection.dataRows, effectiveMapping, rowCorrections, skippedByUser]
  );

  // ── 8. Run Server-Side Preview Validation ─────────────────────────────────
  const runPreviewValidation = useCallback(async (
    correctionsToUse: Map<number, Record<string, string>> = rowCorrections,
    skipsToUse: Set<number> = skippedByUser
  ) => {
    const rows = buildImportRows(correctionsToUse, skipsToUse);
    if (rows.length === 0) return;
    setIsValidating(true);
    setPreviewErrors([]);
    setPreviewWarnings([]);

    try {
      const previewResp = await apiFetchV1("/universal-import/preview", {
        method: "POST",
        body: {
          target: "ITEM_MASTER",
          rows,
        },
      });

      setPreviewResult(previewResp?.summary ?? previewResp);

      const rowReport: any[] = (
        Array.isArray(previewResp?.reconciliation_report) ? previewResp.reconciliation_report :
        Array.isArray(previewResp?.rows) ? previewResp.rows :
        Array.isArray(previewResp?.row_results) ? previewResp.row_results : []
      );
      setPreviewReport(rowReport);

      if (previewResp?.approved_values_map && typeof previewResp.approved_values_map === 'object') {
        setApprovedValuesMap(previewResp.approved_values_map);
      }

      const blocking: string[] = [];
      rowReport.forEach((rr: any) => {
        if (Array.isArray(rr?.errors) && rr.errors.length > 0) {
          rr.errors.forEach((e: string) => blocking.push(`Row ${rr.row_number || '?'}: ${e}`));
        } else if (rr?.status === "INVALID" || rr?.action === "BLOCK" || rr?.reconciliation_state === "INVALID") {
          blocking.push(`Row ${rr.row_number || '?'}: Validation failed.`);
        }
      });
      setPreviewErrors(blocking);

      const warnings: string[] = [];
      if (Array.isArray(previewResp?.all_warnings)) {
        previewResp.all_warnings.forEach((w: string) => warnings.push(w));
      } else if (Array.isArray(previewResp?.warnings)) {
        previewResp.warnings.forEach((w: string) => warnings.push(w));
      }
      setPreviewWarnings(warnings);

      return { previewResp, rowReport, blocking, warnings };
    } catch (err: any) {
      const msg = err?.message || "Failed to execute preview validation.";
      setPreviewErrors([msg]);
      onNotification?.("Validation Error", msg, "error");
    } finally {
      setIsValidating(false);
    }
  }, [buildImportRows, onNotification, rowCorrections, skippedByUser]);

  // Auto-validate whenever raw text matrix is parsed or columns mapped
  useEffect(() => {
    if (headerDetection.dataRows.length > 0 && effectiveMapping.size > 0) {
      const timer = setTimeout(() => {
        runPreviewValidation();
      }, 350);
      return () => clearTimeout(timer);
    } else {
      setPreviewResult(null);
      setPreviewReport([]);
      setPreviewErrors([]);
      setPreviewWarnings([]);
    }
  }, [headerDetection.dataRows.length, effectiveMapping.size]);

  // ── 9. Interactive Cell Correction Handlers ───────────────────────────────
  const handleApplyCellCorrection = (rowNumber: number, fieldKey: string, value: string) => {
    setRowCorrections(prev => {
      const next = new Map(prev);
      const rowEdits = { ...(next.get(rowNumber) || {}) };
      if (value === "") {
        delete rowEdits[fieldKey];
        if (Object.keys(rowEdits).length === 0) {
          next.delete(rowNumber);
        } else {
          next.set(rowNumber, rowEdits);
        }
      } else {
        rowEdits[fieldKey] = value;
        next.set(rowNumber, rowEdits);
      }
      return next;
    });
    setEditingCell(null);
  };

  const handleRevertCellCorrection = (rowNumber: number, fieldKey: string) => {
    setRowCorrections(prev => {
      const next = new Map(prev);
      const rowEdits = { ...(next.get(rowNumber) || {}) };
      delete rowEdits[fieldKey];
      if (Object.keys(rowEdits).length === 0) {
        next.delete(rowNumber);
      } else {
        next.set(rowNumber, rowEdits);
      }
      return next;
    });
  };

  const handleToggleSkipRow = (rowNumber: number) => {
    setSkippedByUser(prev => {
      const next = new Set(prev);
      if (next.has(rowNumber)) {
        next.delete(rowNumber);
      } else {
        next.add(rowNumber);
      }
      return next;
    });
  };

  const handleSkipAllErrors = () => {
    const errorRows = previewReport
      .filter(r => r.status === "INVALID" || r.action === "BLOCK" || (r.errors && r.errors.length > 0))
      .map(r => r.row_number);
    setSkippedByUser(prev => new Set([...prev, ...errorRows]));
    onNotification?.("Rows Skipped", `Marked ${errorRows.length} invalid rows as skipped.`, "info");
  };

  const handleRestoreAllOriginals = () => {
    setRowCorrections(new Map());
    setSkippedByUser(new Set());
    onNotification?.("Restored", "All manual cell edits and skipped states have been cleared.", "info");
  };

  // ── 10. Auto-Fix Safe Errors Engine ───────────────────────────────────────
  const handleAutoFixSafeErrors = async () => {
    if (previewReport.length === 0) return;
    let fixedCount = 0;
    const nextCorrections = new Map(rowCorrections);

    previewReport.forEach((row: any) => {
      const rowNum = row.row_number;
      const currentEdits = { ...(nextCorrections.get(rowNum) || {}) };
      let rowModified = false;

      // 1. Auto-apply near_match suggestions for master fields
      if (Array.isArray(row.field_failures)) {
        row.field_failures.forEach((ff: any) => {
          if (ff.near_match && !currentEdits[ff.field]) {
            currentEdits[ff.field] = ff.near_match;
            rowModified = true;
            fixedCount++;
          }
        });
      }

      // 2. Auto-fix selling price > MRP (clamp selling to MRP)
      const mrp = parseFloat(currentEdits.mrp || row.mrp || 0);
      const selling = parseFloat(currentEdits.selling_price || row.selling_price || 0);
      if (selling > mrp && mrp > 0) {
        currentEdits.selling_price = String(mrp);
        rowModified = true;
        fixedCount++;
      }

      if (rowModified) {
        nextCorrections.set(rowNum, currentEdits);
      }
    });

    if (fixedCount > 0) {
      setRowCorrections(nextCorrections);
      onNotification?.("Auto-Fix Applied", `Applied ${fixedCount} safe corrections. Re-validating...`, "success");
      await runPreviewValidation(nextCorrections, skippedByUser);
    } else {
      onNotification?.("No Safe Fixes", "No automatic suggestions or safe corrections found for current errors.", "info");
    }
  };

  // ── 11. Download Error Report (TSV) ───────────────────────────────────────
  const handleDownloadErrorReport = () => {
    if (previewReport.length === 0) {
      onNotification?.("No Errors", "No preview validation report available to export.", "info");
      return;
    }
    const errorRows = previewReport.filter(r => (r.errors && r.errors.length > 0) || r.status === "INVALID" || (r.warnings && r.warnings.length > 0));
    if (errorRows.length === 0) {
      onNotification?.("All Valid", "Zero errors or warnings detected in current dataset.", "success");
      return;
    }

    const headers = ["Row Number", "Reconciliation Status", "Barcode", "SKU", "Style Code", "Errors", "Review Warnings", "Suggested Action"];
    const rows = errorRows.map(r => [
      String(r.row_number),
      r.reconciliation_state || r.status,
      r.barcode || "",
      r.sku || "",
      r.style_code || "",
      (r.errors || []).join(" | "),
      (r.warnings || []).join(" | "),
      r.action || ""
    ]);

    const tsvContent = [headers.join("\t"), ...rows.map(r => r.join("\t"))].join("\n");
    const blob = new Blob([tsvContent], { type: "text/tab-separated-values;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `SMRITI_Import_Validation_Errors_${Date.now()}.tsv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // ── 12. File Upload & Template Download ───────────────────────────────────
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      setRawText(text);
      setRowCorrections(new Map());
      setSkippedByUser(new Set());
    } catch (err: any) {
      onNotification?.("File Read Error", err?.message || "Could not read file.", "error");
    } finally {
      e.target.value = "";
    }
  };

  const handleFileDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      setRawText(text);
      setRowCorrections(new Map());
      setSkippedByUser(new Set());
    } catch (err: any) {
      onNotification?.("File Drop Error", err?.message || "Could not read file.", "error");
    }
  };

  const handleDownloadTemplate = () => {
    const headers = [
      "StyleCode", "ProductName", "Brand", "Gender", "ProductType", "HeelType",
      "UpperMaterial", "Color", "Size", "Barcode", "MRP", "CostPrice", "SellingPrice",
      "GST_Rate", "HSN", "VendorCode", "WarehouseCode"
    ];
    const sampleRow = [
      "ART-1001", "Classic Leather Derby", "Apex", "Men", "Formal Shoes", "Low Heel",
      "Genuine Leather", "Black", "42", "8901234567890", "2999", "1200", "2499",
      "18", "6403", "V-001", "WH-MAIN"
    ];
    const tsvContent = `${headers.join("\t")}\n${sampleRow.join("\t")}\n`;
    const blob = new Blob([tsvContent], { type: "text/tab-separated-values;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "Item_Master_Import_Template.tsv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // ── 13. Dynamic 7-Metric Calculations ─────────────────────────────────────
  const totalRowsCount = headerDetection.dataRows.length;
  const skippedRowsCount = skippedByUser.size;
  const correctedRowsCount = rowCorrections.size;

  const previewRowMap = useMemo(() => {
    const map = new Map<number, any>();
    previewReport.forEach(r => map.set(r.row_number, r));
    return map;
  }, [previewReport]);

  const metricStats = useMemo(() => {
    let valid = 0;
    let blocking = 0;
    let warnings = 0;

    for (let i = 1; i <= totalRowsCount; i++) {
      if (skippedByUser.has(i)) continue;
      const report = previewRowMap.get(i);
      if (!report) continue;
      if (report.status === "VALID" && report.action !== "BLOCK") {
        valid++;
      } else {
        blocking++;
      }
      if (Array.isArray(report.warnings) && report.warnings.length > 0) {
        warnings++;
      }
    }

    const ready = Math.max(0, valid);

    return {
      total: totalRowsCount,
      valid,
      blocking,
      warnings,
      corrected: correctedRowsCount,
      skipped: skippedRowsCount,
      ready,
    };
  }, [totalRowsCount, skippedByUser, previewRowMap, correctedRowsCount, skippedRowsCount]);

  // Filtered rows for grid display
  const displayRows = useMemo(() => {
    return headerDetection.dataRows.map((tokens, idx) => {
      const rowNumber = idx + 1;
      const isSkipped = skippedByUser.has(rowNumber);
      const isCorrected = rowCorrections.has(rowNumber);
      const report = previewRowMap.get(rowNumber);
      const hasErrors = report ? (report.status === "INVALID" || report.action === "BLOCK" || (report.errors && report.errors.length > 0)) : false;
      const hasWarnings = report ? (report.warnings && report.warnings.length > 0) : false;
      const isValid = report ? (report.status === "VALID" && !hasErrors) : false;

      // Extract effective token values (original token or corrected override)
      const edits = rowCorrections.get(rowNumber) || {};
      const effectiveTokens = tokens.map((token, colIdx) => {
        const fieldKey = effectiveMapping.get(colIdx);
        if (fieldKey && edits[fieldKey] !== undefined) {
          return edits[fieldKey];
        }
        return token;
      });

      return {
        rowNumber,
        originalTokens: tokens,
        effectiveTokens,
        isSkipped,
        isCorrected,
        hasErrors,
        hasWarnings,
        isValid,
        report,
        edits
      };
    }).filter(row => {
      // Filter tab check
      if (activeFilterTab === "VALID" && (!row.isValid || row.isSkipped)) return false;
      if (activeFilterTab === "ERRORS" && (!row.hasErrors || row.isSkipped)) return false;
      if (activeFilterTab === "WARNINGS" && (!row.hasWarnings || row.isSkipped)) return false;
      if (activeFilterTab === "CORRECTED" && !row.isCorrected) return false;
      if (activeFilterTab === "SKIPPED" && !row.isSkipped) return false;

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTokens = row.effectiveTokens.some(t => t.toLowerCase().includes(q));
        const matchesErrors = (row.report?.errors || []).some((e: string) => e.toLowerCase().includes(q));
        const matchesWarnings = (row.report?.warnings || []).some((w: string) => w.toLowerCase().includes(q));
        if (!matchesTokens && !matchesErrors && !matchesWarnings) return false;
      }

      return true;
    });
  }, [headerDetection.dataRows, skippedByUser, rowCorrections, previewRowMap, effectiveMapping, activeFilterTab, searchQuery]);

  // ── 14. Commit Import Handler ─────────────────────────────────────────────
  const handleCommitImport = async () => {
    const rows = buildImportRows(rowCorrections, skippedByUser);
    if (rows.length === 0) {
      onNotification?.("No Data", "No eligible rows to import.", "error");
      return;
    }

    setIsProcessing(true);
    setShowConfirmModal(false);

    try {
      const commitResp = await apiFetchV1("/universal-import/commit", {
        method: "POST",
        body: {
          target: "ITEM_MASTER",
          rows,
          import_strategy: importStrategy,
          existing_match_mode: existingMatchMode,
          idempotency_key: `im-studio-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        },
      });

      const saved = commitResp?.saved ?? commitResp?.created ?? 0;
      const skipped = commitResp?.skipped ?? 0;
      const failed = commitResp?.failed ?? commitResp?.errors ?? 0;

      if (saved > 0 || skipped > 0) {
        const itemCodes = (commitResp?.results || []).map((r: any) => r.item_code || r.variant_sku).filter(Boolean);
        const barcodes = (commitResp?.results || []).map((r: any) => r.barcode).filter(Boolean);

        const batchRecord = ImportBatchManager.recordBatch({
          batchId: commitResp?.idempotency_key || `batch-${Date.now()}`,
          savedCount: saved,
          createdCount: commitResp?.created ?? saved,
          skippedCount: skipped,
          failedCount: failed,
          itemCodes,
          barcodes,
          summary: `Import Batch (${saved} items) • ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
          strategy: importStrategy,
        });

        onNotification?.(
          "Import Successful",
          `Committed to PostgreSQL: ${saved} item(s) created/updated${skipped > 0 ? `, ${skipped} skipped (existing matches)` : ""}.${failed > 0 ? ` (${failed} rows skipped due to errors)` : ""}`,
          "success"
        );
        await onRefreshProducts?.();
        setRawText("");
        setRowCorrections(new Map());
        setSkippedByUser(new Set());
        setPreviewResult(null);
        setPreviewReport([]);

        if (onImportCompleted) {
          onImportCompleted(batchRecord);
        }
      } else {
        onNotification?.(
          "Import Summary",
          `No new items were created. ${failed > 0 ? `${failed} rows failed validation.` : "All rows matched existing items."}`,
          "warning"
        );
      }
    } catch (err: any) {
      const raw = err?.message || "Commit failed due to database or validation conflict.";
      onNotification?.("Import Conflict", raw, "error");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-[#f7f9fb] dark:bg-[#191c1e] text-[#191c1e] dark:text-[#eff1f3] h-full flex flex-col antialiased select-none overflow-hidden font-sans">
      
      {/* ── Top Studio Header ── */}
      <header className="bg-white dark:bg-[#131b2e] border-b border-[#c6c6cd] dark:border-[#45464d] px-6 py-3 flex items-center justify-between shrink-0 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#1565c0] dark:text-[#90caf9] text-xl">dataset</span>
            <h2 className="text-base font-bold text-[#191c1e] dark:text-white">
              SMRITI Smart Import &amp; Correction Studio
            </h2>
            <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-[#e3f2fd] text-[#1565c0] rounded border border-[#1565c0]/20">
              v6.70.47 · SSOT
            </span>
          </div>
          <p className="text-xs text-[#515f74] dark:text-[#a0a5b5] mt-0.5">
            Same-window live validation, cell-level correction, conflict resolution, and safe multi-strategy database commit.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-[#76777d] text-[#191c1e] dark:text-[#eff1f3] bg-white dark:bg-[#2d3133] hover:bg-[#eceef0] rounded text-xs font-semibold transition"
          >
            Exit Studio
          </button>
          
          <button
            type="button"
            onClick={() => runPreviewValidation()}
            disabled={isProcessing || isValidating || totalRowsCount === 0}
            className="px-3.5 py-2 border border-[#1565c0] text-[#1565c0] dark:text-[#90caf9] bg-white dark:bg-[#2d3133] hover:bg-[#e3f2fd] dark:hover:bg-[#1565c0]/20 rounded text-xs font-bold transition flex items-center gap-1.5 shadow-xs disabled:opacity-40"
          >
            <RefreshCw size={13} className={isValidating ? "animate-spin" : ""} />
            Re-validate All
          </button>

          <button
            type="button"
            onClick={() => setShowConfirmModal(true)}
            disabled={isProcessing || isValidating || totalRowsCount === 0 || (importStrategy === "STRICT" && metricStats.blocking > 0)}
            className="px-5 py-2 bg-[#1565c0] hover:bg-[#0d47a1] text-white rounded text-xs font-bold transition flex items-center gap-2 shadow-xs disabled:opacity-40"
          >
            {isProcessing ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                Committing to Postgres...
              </>
            ) : (
              <>
                <Play size={14} />
                Import &amp; Commit ({metricStats.ready} Ready)
              </>
            )}
          </button>
        </div>
      </header>

      {/* ── 7-Metric Dynamic Dashboard Header ── */}
      <div className="bg-white dark:bg-[#131b2e] border-b border-[#c6c6cd] dark:border-[#45464d] px-6 py-2 grid grid-cols-7 gap-3 shrink-0 text-center">
        <div 
          onClick={() => setActiveFilterTab("ALL")}
          className={`px-3 py-1.5 rounded-lg border transition cursor-pointer ${
            activeFilterTab === "ALL" ? "bg-[#e0e3e5] dark:bg-[#2d3133] border-[#76777d]" : "border-transparent hover:bg-[#f2f4f6]"
          }`}
        >
          <div className="text-[10px] uppercase font-bold text-[#515f74] dark:text-[#a0a5b5]">Total Rows</div>
          <div className="text-base font-black text-[#191c1e] dark:text-white font-mono">{metricStats.total}</div>
        </div>

        <div 
          onClick={() => setActiveFilterTab("VALID")}
          className={`px-3 py-1.5 rounded-lg border transition cursor-pointer ${
            activeFilterTab === "VALID" ? "bg-[#d1fae5] border-[#10b981]" : "border-transparent hover:bg-[#f0fdf4]"
          }`}
        >
          <div className="text-[10px] uppercase font-bold text-[#065f46] dark:text-[#34d399] flex items-center justify-center gap-1">
            <CheckCircle size={10} /> Valid
          </div>
          <div className="text-base font-black text-[#065f46] dark:text-[#34d399] font-mono">{metricStats.valid}</div>
        </div>

        <div 
          onClick={() => setActiveFilterTab("ERRORS")}
          className={`px-3 py-1.5 rounded-lg border transition cursor-pointer ${
            activeFilterTab === "ERRORS" ? "bg-[#ffdad6] border-[#ba1a1a]" : "border-transparent hover:bg-[#fff8f7]"
          }`}
        >
          <div className="text-[10px] uppercase font-bold text-[#93000a] dark:text-[#ffdad6] flex items-center justify-center gap-1">
            <AlertCircle size={10} /> Blocking Errors
          </div>
          <div className="text-base font-black text-[#93000a] dark:text-[#ffdad6] font-mono">{metricStats.blocking}</div>
        </div>

        <div 
          onClick={() => setActiveFilterTab("WARNINGS")}
          className={`px-3 py-1.5 rounded-lg border transition cursor-pointer ${
            activeFilterTab === "WARNINGS" ? "bg-[#fef08a] border-[#eab308]" : "border-transparent hover:bg-[#fefce8]"
          }`}
        >
          <div className="text-[10px] uppercase font-bold text-[#854d0e] dark:text-[#fef08a] flex items-center justify-center gap-1">
            <AlertTriangle size={10} /> Review Warnings
          </div>
          <div className="text-base font-black text-[#854d0e] dark:text-[#fef08a] font-mono">{metricStats.warnings}</div>
        </div>

        <div 
          onClick={() => setActiveFilterTab("CORRECTED")}
          className={`px-3 py-1.5 rounded-lg border transition cursor-pointer ${
            activeFilterTab === "CORRECTED" ? "bg-[#e3f2fd] border-[#1565c0]" : "border-transparent hover:bg-[#f0f9ff]"
          }`}
        >
          <div className="text-[10px] uppercase font-bold text-[#1565c0] dark:text-[#90caf9] flex items-center justify-center gap-1">
            <Edit3 size={10} /> Corrected
          </div>
          <div className="text-base font-black text-[#1565c0] dark:text-[#90caf9] font-mono">{metricStats.corrected}</div>
        </div>

        <div 
          onClick={() => setActiveFilterTab("SKIPPED")}
          className={`px-3 py-1.5 rounded-lg border transition cursor-pointer ${
            activeFilterTab === "SKIPPED" ? "bg-[#eceef0] border-[#9e9e9e]" : "border-transparent hover:bg-[#f5f5f5]"
          }`}
        >
          <div className="text-[10px] uppercase font-bold text-[#76777d] flex items-center justify-center gap-1">
            <RotateCcw size={10} /> Skipped
          </div>
          <div className="text-base font-black text-[#76777d] font-mono">{metricStats.skipped}</div>
        </div>

        <div className="px-3 py-1.5 rounded-lg bg-[#002244] text-white border border-[#003366]">
          <div className="text-[10px] uppercase font-bold text-[#90caf9] flex items-center justify-center gap-1">
            <Play size={10} /> Ready to Commit
          </div>
          <div className="text-base font-black text-white font-mono">{metricStats.ready}</div>
        </div>
      </div>

      {/* ── Main Split Canvas ── */}
      <div className="flex-1 grid grid-cols-12 gap-4 p-4 min-h-0 overflow-hidden">
        
        {/* Left Panel: Raw Paste Area */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDraggingFile(true); }}
          onDragLeave={() => setIsDraggingFile(false)}
          onDrop={handleFileDrop}
          className="col-span-12 xl:col-span-4 flex flex-col bg-white dark:bg-[#2d3133] border border-[#c6c6cd] dark:border-[#45464d] rounded-lg overflow-hidden shadow-xs relative"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain"
            onChange={handleFileSelect}
            className="hidden"
          />

          {isDraggingFile && (
            <div className="absolute inset-0 z-30 bg-blue-500/10 dark:bg-blue-400/10 border-2 border-dashed border-blue-500 rounded-lg flex flex-col items-center justify-center backdrop-blur-xs pointer-events-none">
              <span className="material-symbols-outlined text-4xl text-blue-500 mb-2">upload_file</span>
              <p className="text-xs font-bold text-blue-600 dark:text-blue-400">Drop CSV or TSV file here</p>
            </div>
          )}

          <div className="bg-[#f2f4f6] dark:bg-[#131b2e] px-4 py-2.5 border-b border-[#c6c6cd] dark:border-[#45464d] flex items-center justify-between shrink-0">
            <h3 className="text-xs font-bold text-[#191c1e] dark:text-white flex items-center gap-1.5 uppercase tracking-wider">
              <span className="material-symbols-outlined text-[#515f74] text-base">content_paste</span>
              Raw Matrix Input
            </h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1 px-2 py-0.5 bg-[#e0e3e5] dark:bg-[#45464d] hover:bg-[#d0d3d5] text-[#191c1e] dark:text-[#eff1f3] text-[10px] font-semibold rounded transition"
                title="Upload CSV, TSV or TXT file"
              >
                <span className="material-symbols-outlined text-[13px]">upload_file</span>
                Upload
              </button>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="flex items-center gap-1 px-2 py-0.5 bg-[#e0e3e5] dark:bg-[#45464d] hover:bg-[#d0d3d5] text-[#191c1e] dark:text-[#eff1f3] text-[10px] font-semibold rounded transition"
                title="Download standard TSV template"
              >
                <span className="material-symbols-outlined text-[13px]">download</span>
                Template
              </button>
            </div>
          </div>

          <div className="flex-1 p-2 relative">
            <textarea
              value={rawText}
              onChange={e => {
                setRawText(e.target.value);
                setRowCorrections(new Map());
                setSkippedByUser(new Set());
              }}
              placeholder="Paste tab-delimited or CSV rows from Excel / Google Sheets here...

Example Columns:
StyleCode	ProductName	Brand	Gender	ProductType	HeelType	UpperMaterial	Color	Size	Barcode	MRP	CostPrice	SellingPrice	GST_Rate	HSN"
              className="w-full h-full resize-none border-none p-3 font-mono text-xs text-[#191c1e] dark:text-[#eff1f3] bg-transparent outline-none leading-relaxed placeholder-[#76777d]"
            />

            {!rawText && (
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center opacity-40">
                <span className="material-symbols-outlined text-4xl mb-1 text-[#76777d]">grid_on</span>
                <p className="text-xs font-semibold text-[#191c1e] dark:text-white text-center max-w-[220px]">
                  Copy rows in Excel (Ctrl+C) and paste them here (Ctrl+V), or drag &amp; drop a CSV/TSV file.
                </p>
              </div>
            )}
          </div>

          {/* Left Footer Bar */}
          <div className="bg-[#eceef0] dark:bg-[#131b2e] px-4 py-2 border-t border-[#c6c6cd] dark:border-[#45464d] flex justify-between items-center shrink-0 text-xs">
            <div className="flex items-center gap-3">
              <span className="font-mono text-[#515f74] dark:text-[#bec6e0] font-bold">
                {headerDetection.dataRows.length} data rows
              </span>
              {matrix.length > 0 && (
                <label className="flex items-center gap-1.5 cursor-pointer text-xs select-none border-l border-[#c6c6cd] dark:border-[#45464d] pl-3">
                  <input
                    type="checkbox"
                    checked={hasHeaderRow}
                    onChange={(e) => setHasHeaderRow(e.target.checked)}
                    className="rounded border-[#c6c6cd] text-black focus:ring-0 cursor-pointer"
                  />
                  <span className="text-[11px] text-[#515f74] dark:text-[#bec6e0]">Header row</span>
                </label>
              )}
            </div>
            <button
              type="button"
              onClick={() => { setRawText(""); setRowCorrections(new Map()); setSkippedByUser(new Set()); }}
              disabled={!rawText}
              className="text-[#ba1a1a] font-semibold hover:underline disabled:opacity-30"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Right Panel: Smart Correction Grid & Actions */}
        <div className="col-span-12 xl:col-span-8 flex flex-col bg-white dark:bg-[#2d3133] border border-[#c6c6cd] dark:border-[#45464d] rounded-lg overflow-hidden shadow-xs min-h-0">
          
          {/* Right Header Bar & Bulk Actions */}
          <div className="bg-[#f2f4f6] dark:bg-[#131b2e] px-4 py-2 border-b border-[#c6c6cd] dark:border-[#45464d] flex items-center justify-between shrink-0 flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#76777d]" />
                <input
                  type="text"
                  placeholder="Filter rows, barcodes, styles..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1 text-xs rounded border border-[#c6c6cd] dark:border-[#45464d] bg-white dark:bg-[#2d3133] text-[#191c1e] dark:text-white outline-none w-52"
                />
              </div>

              {/* Bulk Actions Button Group */}
              <button
                type="button"
                onClick={handleAutoFixSafeErrors}
                disabled={metricStats.blocking === 0 && metricStats.warnings === 0}
                className="px-2.5 py-1 bg-[#e3f2fd] hover:bg-[#bbdefb] text-[#1565c0] rounded text-[11px] font-bold border border-[#1565c0]/30 flex items-center gap-1 transition disabled:opacity-40"
                title="Automatically fix typos, clamp selling price to MRP, and apply master lookup suggestions"
              >
                <Sparkles size={12} />
                Auto-Fix Safe Errors
              </button>

              <button
                type="button"
                onClick={handleSkipAllErrors}
                disabled={metricStats.blocking === 0}
                className="px-2.5 py-1 bg-[#eceef0] hover:bg-[#e0e3e5] text-[#515f74] rounded text-[11px] font-semibold transition disabled:opacity-40"
                title="Mark all rows with blocking errors as skipped"
              >
                Skip All Errors
              </button>

              <button
                type="button"
                onClick={handleRestoreAllOriginals}
                disabled={metricStats.corrected === 0 && metricStats.skipped === 0}
                className="px-2.5 py-1 bg-[#eceef0] hover:bg-[#e0e3e5] text-[#515f74] rounded text-[11px] font-semibold transition disabled:opacity-40"
                title="Revert all manual edits and restore uploaded values"
              >
                Restore Originals
              </button>

              <button
                type="button"
                onClick={handleDownloadErrorReport}
                disabled={previewReport.length === 0}
                className="px-2.5 py-1 bg-[#eceef0] hover:bg-[#e0e3e5] text-[#515f74] rounded text-[11px] font-semibold transition flex items-center gap-1 disabled:opacity-40"
                title="Export TSV error report"
              >
                <Download size={12} />
                Error TSV
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-[#515f74]">
                Showing {displayRows.length} of {totalRowsCount} rows
              </span>
            </div>
          </div>

          {/* Interactive Grid Table */}
          <div className="flex-1 overflow-auto bg-white dark:bg-[#191c1e]">
            {totalRowsCount === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8 text-center">
                <Table size={36} className="mb-2 opacity-30 text-[#515f74]" />
                <p className="text-xs font-semibold">No data loaded yet.</p>
                <p className="text-[11px] text-[#76777d] mt-0.5">Paste tab-delimited Excel cells on the left to preview column mapping.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse min-w-[1000px]">
                <thead className="sticky top-0 bg-white dark:bg-[#131b2e] z-10 shadow-xs">
                  <tr className="border-b border-[#c6c6cd] dark:border-[#45464d]">
                    <th className="w-12 px-2 py-2 border-r border-[#c6c6cd] dark:border-[#45464d] bg-[#f2f4f6] dark:bg-[#131b2e] text-center text-[10px] font-mono font-bold text-[#515f74]">
                      #
                    </th>
                    <th className="w-24 px-2 py-2 border-r border-[#c6c6cd] dark:border-[#45464d] bg-[#f2f4f6] dark:bg-[#131b2e] text-center text-[10px] font-bold text-[#515f74]">
                      Status
                    </th>
                    {detectedColumns.map((col) => {
                      const override = manualOverrides[col.sourceIndex];
                      let effectiveKey = override !== undefined ? override : (col.mappedFieldKey || "");
                      if (effectiveKey.startsWith("attr_")) effectiveKey = effectiveKey.replace(/^attr_/, "");
                      const isAutoMapped = col.confidence === 'EXACT' || col.confidence === 'HIGH';

                      return (
                        <th
                          key={col.sourceIndex}
                          className="px-3 py-2 border-r border-[#c6c6cd] dark:border-[#45464d] min-w-[150px]"
                        >
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] text-[#76777d] font-mono uppercase truncate">
                              Col {col.sourceIndex + 1}: {col.sourceHeader}
                            </span>
                            
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
                  {displayRows.map((row) => {
                    const isSkipped = row.isSkipped;
                    const report = row.report;
                    const isConflict = row.hasErrors && !isSkipped;

                    return (
                      <tr
                        key={row.rowNumber}
                        className={`transition ${
                          isSkipped
                            ? "opacity-35 bg-[#eceef0]"
                            : isConflict
                            ? "bg-[#ffdad6]/20 hover:bg-[#ffdad6]/35"
                            : row.hasWarnings
                            ? "bg-[#fefce8] hover:bg-[#fef9c3]"
                            : row.isCorrected
                            ? "bg-[#f0f9ff] hover:bg-[#e0f2fe]"
                            : "hover:bg-[#f7f9fb] dark:hover:bg-[#2d3133]"
                        }`}
                      >
                        {/* Row Number & Skip Action */}
                        <td className="px-2 py-2 border-r border-[#c6c6cd] dark:border-[#45464d] text-center font-mono text-[11px] text-[#515f74] bg-[#f2f4f6]/60 dark:bg-[#131b2e]/60">
                          <button
                            type="button"
                            onClick={() => handleToggleSkipRow(row.rowNumber)}
                            className="hover:text-black font-bold flex items-center justify-center w-full"
                            title={isSkipped ? "Include row" : "Skip row"}
                          >
                            {row.rowNumber}
                          </button>
                        </td>

                        {/* Status Badge */}
                        <td className="px-2 py-2 border-r border-[#c6c6cd] dark:border-[#45464d] text-center">
                          {isSkipped ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#e0e3e5] text-[#515f74]">
                              SKIPPED
                            </span>
                          ) : isConflict ? (
                            <button
                              type="button"
                              onClick={() => setActiveConflictRow(activeConflictRow === row.rowNumber ? null : row.rowNumber)}
                              className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#ffdad6] text-[#93000a] border border-[#ba1a1a]/30 flex items-center gap-1 mx-auto"
                              title={report?.errors?.join("; ") || "Validation Error"}
                            >
                              <AlertCircle size={10} />
                              ERROR
                            </button>
                          ) : row.hasWarnings ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#fef08a] text-[#854d0e] border border-[#eab308]/40">
                              REVIEW
                            </span>
                          ) : row.isCorrected ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#dbeafe] text-[#1e40af] border border-[#3b82f6]/30">
                              CORRECTED
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#d1fae5] text-[#065f46]">
                              VALID
                            </span>
                          )}
                        </td>

                        {/* Data Cells with Inline Edit & Revert */}
                        {detectedColumns.map((col) => {
                          const fieldKey = effectiveMapping.get(col.sourceIndex) || "";
                          const rawVal = row.originalTokens[col.sourceIndex] || "";
                          const isCellEdited = row.edits[fieldKey] !== undefined;
                          const currentVal = isCellEdited ? row.edits[fieldKey] : rawVal;
                          const isEditingThisCell = editingCell?.rowNumber === row.rowNumber && editingCell?.fieldKey === fieldKey;
                          
                          // Check if this field failed validation in preview report
                          const fieldFailure = report?.field_failures?.find((ff: any) => ff.field.toLowerCase() === fieldKey.toLowerCase());
                          const isErrorField = Boolean(fieldFailure);
                          const approvedOptions = approvedValuesMap[fieldKey] || approvedValuesMap[fieldKey.toUpperCase()] || [];

                          return (
                            <td
                              key={col.sourceIndex}
                              className={`px-3 py-1.5 border-r border-[#c6c6cd] dark:border-[#45464d] relative group ${
                                isCellEdited
                                  ? "bg-[#e0f2fe]/40 font-semibold text-[#0369a1]"
                                  : isErrorField
                                  ? "bg-[#fee2e2]/40 text-[#991b1b]"
                                  : ""
                              }`}
                            >
                              {isEditingThisCell ? (
                                <div className="flex items-center gap-1">
                                  {approvedOptions.length > 0 ? (
                                    <select
                                      autoFocus
                                      value={currentVal}
                                      onChange={e => handleApplyCellCorrection(row.rowNumber, fieldKey, e.target.value)}
                                      onBlur={() => setEditingCell(null)}
                                      className="w-full text-xs font-semibold px-1.5 py-0.5 rounded border border-[#1565c0] bg-white outline-none"
                                    >
                                      <option value="">— Select —</option>
                                      {approvedOptions.map(opt => (
                                        <option key={opt} value={opt}>{opt}</option>
                                      ))}
                                    </select>
                                  ) : (
                                    <input
                                      autoFocus
                                      type="text"
                                      value={currentVal}
                                      onChange={e => handleApplyCellCorrection(row.rowNumber, fieldKey, e.target.value)}
                                      onBlur={() => setEditingCell(null)}
                                      onKeyDown={e => {
                                        if (e.key === "Enter" || e.key === "Escape") setEditingCell(null);
                                      }}
                                      className="w-full text-xs px-1.5 py-0.5 rounded border border-[#1565c0] bg-white outline-none"
                                    />
                                  )}
                                </div>
                              ) : (
                                <div 
                                  onClick={() => setEditingCell({ rowNumber: row.rowNumber, fieldKey })}
                                  className="flex items-center justify-between cursor-pointer min-h-[22px]"
                                >
                                  <span className="truncate">
                                    {currentVal || <span className="text-[#76777d] italic text-[11px]">—</span>}
                                  </span>

                                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                                    {isCellEdited && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleRevertCellCorrection(row.rowNumber, fieldKey);
                                        }}
                                        className="p-0.5 text-[#0369a1] hover:text-[#0c4a6e]"
                                        title={`Revert to original: "${rawVal}"`}
                                      >
                                        <Undo size={11} />
                                      </button>
                                    )}
                                    <Edit3 size={10} className="text-[#76777d]" />
                                  </div>
                                </div>
                              )}

                              {/* Near match pill suggestion if invalid */}
                              {fieldFailure?.near_match && !isCellEdited && (
                                <div className="mt-0.5">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleApplyCellCorrection(row.rowNumber, fieldKey, fieldFailure.near_match);
                                    }}
                                    className="text-[10px] px-1 py-0.2 bg-[#dbeafe] text-[#1e40af] rounded border border-[#3b82f6]/30 hover:bg-[#bfdbfe] font-bold"
                                    title={`Click to apply suggested value: ${fieldFailure.near_match}`}
                                  >
                                    Use "{fieldFailure.near_match}"
                                  </button>
                                </div>
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

          {/* Conflict Resolution Popover Drawer */}
          {activeConflictRow !== null && previewRowMap.get(activeConflictRow) && (() => {
            const r = previewRowMap.get(activeConflictRow);
            const conflict = r.conflict_details;

            return (
              <div className="bg-[#fff1f2] dark:bg-[#93000a]/20 border-t border-[#f43f5e] p-3 shrink-0 flex items-start gap-3">
                <span className="material-symbols-outlined text-[#e11d48] mt-0.5">report_problem</span>
                <div className="flex-1 text-xs">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-[#9f1239] dark:text-[#fda4af] uppercase tracking-wide">
                      Row {activeConflictRow} Conflict Resolution
                    </h4>
                    <button
                      type="button"
                      onClick={() => setActiveConflictRow(null)}
                      className="text-[#9f1239] hover:text-black"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  
                  <div className="mt-1 text-[#9f1239] dark:text-[#fda4af]">
                    {(r.errors || []).map((e: string, idx: number) => (
                      <p key={idx}>• {e}</p>
                    ))}
                  </div>

                  {conflict && (
                    <div className="mt-2 p-2 bg-white dark:bg-[#1f1315] rounded border border-[#f43f5e]/30 text-[11px]">
                      <span className="font-bold text-[#515f74]">Conflicting Database Record: </span>
                      <span className="font-mono font-bold text-[#191c1e] dark:text-white">
                        {conflict.existing_item_name} ({conflict.existing_item_code}) — SKU: {conflict.existing_variant_sku}
                      </span>
                    </div>
                  )}

                  <div className="mt-2.5 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleSkipRow(activeConflictRow)}
                      className="px-3 py-1 bg-white dark:bg-[#2d3133] border border-[#c6c6cd] rounded font-semibold text-[11px] hover:bg-[#eceef0]"
                    >
                      Skip Row {activeConflictRow}
                    </button>
                    {r.field_failures?.length > 0 && r.field_failures[0]?.near_match && (
                      <button
                        type="button"
                        onClick={() => {
                          handleApplyCellCorrection(activeConflictRow, r.field_failures[0].field, r.field_failures[0].near_match);
                          setActiveConflictRow(null);
                        }}
                        className="px-3 py-1 bg-[#1565c0] text-white rounded font-bold text-[11px] hover:bg-[#0d47a1] flex items-center gap-1"
                      >
                        <Sparkles size={11} />
                        Apply "{r.field_failures[0].near_match}"
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

        </div>
      </div>

      {/* ── Pre-Commit Confirmation Modal ── */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1e2327] rounded-xl border border-[#c6c6cd] dark:border-[#45464d] shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in duration-200">
            <div className="bg-[#f2f4f6] dark:bg-[#131b2e] px-5 py-3.5 border-b border-[#c6c6cd] dark:border-[#45464d] flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#191c1e] dark:text-white flex items-center gap-2">
                <Database size={16} className="text-[#1565c0]" />
                Confirm Database Import
              </h3>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="text-[#76777d] hover:text-black"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 bg-[#d1fae5]/50 border border-[#10b981]/30 rounded-lg">
                  <div className="text-[10px] font-bold text-[#065f46]">Ready to Commit</div>
                  <div className="text-xl font-black text-[#065f46] font-mono mt-0.5">{metricStats.ready}</div>
                </div>

                <div className="p-3 bg-[#eceef0] border border-[#c6c6cd] rounded-lg">
                  <div className="text-[10px] font-bold text-[#515f74]">Skipped Rows</div>
                  <div className="text-xl font-black text-[#515f74] font-mono mt-0.5">{metricStats.skipped}</div>
                </div>

                <div className="p-3 bg-[#ffdad6]/40 border border-[#ba1a1a]/30 rounded-lg">
                  <div className="text-[10px] font-bold text-[#93000a]">Blocking Errors</div>
                  <div className="text-xl font-black text-[#93000a] font-mono mt-0.5">{metricStats.blocking}</div>
                </div>
              </div>

              {/* Import Strategy Selector */}
              <div className="space-y-1.5">
                <label className="font-bold text-[#191c1e] dark:text-white block">
                  Import Strategy:
                </label>
                <select
                  value={importStrategy}
                  onChange={e => setImportStrategy(e.target.value as ImportStrategy)}
                  className="w-full text-xs font-semibold px-3 py-2 rounded-lg border border-[#c6c6cd] dark:border-[#45464d] bg-white dark:bg-[#2d3133] outline-none"
                >
                  <option value="ALL_ELIGIBLE">ALL_ELIGIBLE — Import all valid rows and gracefully skip invalid rows (Recommended)</option>
                  <option value="VALID_ONLY">VALID_ONLY — Commit valid rows only and ignore uncorrected errors</option>
                  <option value="STRICT">STRICT — Abort commit if any blocking error remains</option>
                </select>
              </div>

              {/* Existing Match Mode Selector */}
              <div className="space-y-1.5">
                <label className="font-bold text-[#191c1e] dark:text-white block">
                  Existing Item Handling:
                </label>
                <select
                  value={existingMatchMode}
                  onChange={e => setExistingMatchMode(e.target.value as MatchMode)}
                  className="w-full text-xs font-semibold px-3 py-2 rounded-lg border border-[#c6c6cd] dark:border-[#45464d] bg-white dark:bg-[#2d3133] outline-none"
                >
                  <option value="SKIP">SKIP — Skip existing database items without altering them</option>
                  <option value="UPDATE_METADATA_AND_PRICE">UPDATE_METADATA_AND_PRICE — Update pricing &amp; attributes on existing matches</option>
                  <option value="FAIL_ON_EXISTING">FAIL_ON_EXISTING — Disallow importing items that already exist in database</option>
                </select>
              </div>

              {metricStats.warnings > 0 && (
                <div className="p-3 bg-[#fef9c3] border border-[#facc15] rounded-lg text-[#854d0e] flex items-start gap-2 text-[11px]">
                  <AlertTriangle size={14} className="text-[#ca8a04] mt-0.5 shrink-0" />
                  <div>
                    <span className="font-bold">CA / Human Review Sign-Off: </span>
                    {metricStats.warnings} row(s) contain advisory flags (e.g. HSN material chapter or GST rate slabs). These will be flagged with status <code>REQUIRES_REVIEW</code> upon creation.
                  </div>
                </div>
              )}
            </div>

            <div className="bg-[#f2f4f6] dark:bg-[#131b2e] px-5 py-3 border-t border-[#c6c6cd] dark:border-[#45464d] flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 border border-[#76777d] text-[#191c1e] dark:text-[#eff1f3] bg-white dark:bg-[#2d3133] rounded text-xs font-semibold hover:bg-[#eceef0]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCommitImport}
                disabled={isProcessing}
                className="px-5 py-2 bg-[#1565c0] hover:bg-[#0d47a1] text-white rounded text-xs font-bold transition flex items-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    Committing...
                  </>
                ) : (
                  <>
                    <Play size={14} />
                    Confirm &amp; Commit
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ItemMasterStudio;
