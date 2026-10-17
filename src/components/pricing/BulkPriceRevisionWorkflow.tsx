/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.16.3
 * Created      : 2026-10-13
 * Modified     : 2026-10-17
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Bulk Price Revision Studio Workflow (Phase 4)
 */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  TrendingUp,
  Search,
  Filter,
  Upload,
  Download,
  RotateCcw,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Calendar,
  Layers,
  Check,
  X,
  FileSpreadsheet,
  ArrowRight,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  Send,
  Save,
  Sliders,
  DollarSign,
  Package,
} from "lucide-react";
import { apiFetchV1 } from "../../lib/apiFetchV1";
import { withCapability } from "../../types/architecture";

// ============================================================================
// DATA CONTRACTS & PURE CALCULATION ENGINES
// ============================================================================

export interface BulkItemCandidate {
  item_id: string;
  variant_id: string;
  style_code?: string;
  article_no?: string;
  item_code?: string;
  item_name: string;
  variant_sku: string;
  barcode?: string;
  brand?: string;
  category?: string;
  color?: string;
  size?: string;
  vendor_code?: string;
  current_mrp: number;
  current_selling_price: number;
  current_distributor_price?: number | null;
  current_cost_price: number;
  status: string;
}

export interface BulkItemFilterResponse {
  total_count: number;
  total_styles: number;
  items: BulkItemCandidate[];
  available_brands: string[];
  available_categories: string[];
  available_colors: string[];
  available_sizes: string[];
  available_suppliers: string[];
}

export interface RevisionConfig {
  reviseSp: boolean;
  reviseMrp: boolean;
  reviseDp: boolean;
  method: "PERCENTAGE" | "AMOUNT" | "FIXED";
  value: number;
  direction: "INCREASE" | "DECREASE";
  effectiveDate: string;
  reasonCode: string;
}

export interface PreviewRow extends BulkItemCandidate {
  proposed_mrp: number;
  proposed_selling_price: number;
  proposed_distributor_price?: number | null;
  mrp_delta: number;
  mrp_delta_pct: number;
  sp_delta: number;
  sp_delta_pct: number;
  dp_delta: number;
  dp_delta_pct: number;
  status_badge: "VALID" | "ERROR" | "WARNING";
  errorMessage?: string;
  warningMessage?: string;
}

/**
 * Pure arithmetic currency calculation for price revisions.
 * Enforces two decimal place rounding and non-negative constraints.
 */
export function calculateProposedPrice(
  currentPrice: number,
  method: "PERCENTAGE" | "AMOUNT" | "FIXED",
  direction: "INCREASE" | "DECREASE",
  val: number
): number {
  if (isNaN(val) || val < 0 || !isFinite(val)) {
    return currentPrice;
  }
  let res = currentPrice;
  if (method === "PERCENTAGE") {
    const factor = direction === "INCREASE" ? 1 + val / 100 : 1 - val / 100;
    res = currentPrice * factor;
  } else if (method === "AMOUNT") {
    const delta = direction === "INCREASE" ? val : -val;
    res = currentPrice + delta;
  } else if (method === "FIXED") {
    res = val;
  }
  return Math.max(0, Math.round(res * 100) / 100);
}

/**
 * Evaluates proposed prices, statutory ceiling, and distributor pricing invariants.
 */
export function computeItemPreviewPrices(item: BulkItemCandidate, config: RevisionConfig): PreviewRow {
  const curMrp = item.current_mrp;
  const curSp = item.current_selling_price;
  const curDp = item.current_distributor_price !== undefined && item.current_distributor_price !== null
    ? item.current_distributor_price
    : Math.round(curSp * 0.90 * 100) / 100;
  const curCp = item.current_cost_price;

  const propMrp = config.reviseMrp
    ? calculateProposedPrice(curMrp, config.method, config.direction, config.value)
    : curMrp;

  const propSp = config.reviseSp
    ? calculateProposedPrice(curSp, config.method, config.direction, config.value)
    : curSp;

  const propDp = config.reviseDp
    ? calculateProposedPrice(curDp, config.method, config.direction, config.value)
    : curDp;

  const mrpDelta = Math.round((propMrp - curMrp) * 100) / 100;
  const mrpDeltaPct = curMrp > 0 ? Math.round(((propMrp - curMrp) / curMrp) * 10000) / 100 : 0;

  const spDelta = Math.round((propSp - curSp) * 100) / 100;
  const spDeltaPct = curSp > 0 ? Math.round(((propSp - curSp) / curSp) * 10000) / 100 : 0;

  const dpDelta = Math.round((propDp - curDp) * 100) / 100;
  const dpDeltaPct = curDp > 0 ? Math.round(((propDp - curDp) / curDp) * 10000) / 100 : 0;

  let status_badge: "VALID" | "ERROR" | "WARNING" = "VALID";
  let errorMessage: string | undefined;
  let warningMessage: string | undefined;

  // Invariant 1: Statutory Ceiling Check (Selling Price <= MRP)
  if (propSp > propMrp) {
    status_badge = "ERROR";
    errorMessage = `SMRITI-PRICE-001: Selling price (₹${propSp.toFixed(2)}) cannot exceed statutory MRP (₹${propMrp.toFixed(2)}).`;
  }
  // Invariant 2: Distributor Price Check (Distributor Price <= Selling Price)
  else if (config.reviseDp && propDp > propSp) {
    status_badge = "ERROR";
    errorMessage = `SMRITI-PRICE-002: Distributor price (₹${propDp.toFixed(2)}) cannot exceed retail selling price (₹${propSp.toFixed(2)}).`;
  }
  // Advisory 1: Selling below cost price warning
  else if (curCp > 0 && propSp < curCp) {
    status_badge = "WARNING";
    warningMessage = `Commercial Warning: Selling price (₹${propSp.toFixed(2)}) is below inward cost price (₹${curCp.toFixed(2)}).`;
  }

  return {
    ...item,
    proposed_mrp: propMrp,
    proposed_selling_price: propSp,
    proposed_distributor_price: propDp,
    mrp_delta: mrpDelta,
    mrp_delta_pct: mrpDeltaPct,
    sp_delta: spDelta,
    sp_delta_pct: spDeltaPct,
    dp_delta: dpDelta,
    dp_delta_pct: dpDeltaPct,
    status_badge,
    errorMessage,
    warningMessage,
  };
}

/**
 * Parses and validates CSV/TSV input strings.
 * Resolves header aliases, tolerates BOM, strips quotes, and discards Cost Price.
 */
export function parseBulkPriceCsv(csvText: string): {
  rows: BulkItemCandidate[];
  errors: string[];
  warnings: string[];
} {
  // Strip BOM
  const cleanText = csvText.replace(/^\uFEFF/, "").trim();
  const rawLines = cleanText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const rows: BulkItemCandidate[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  if (rawLines.length === 0) {
    return { rows, errors: ["Empty CSV or TSV data."], warnings };
  }

  // Parse CSV line handling quotes
  const parseLine = (line: string, isTab: boolean): string[] => {
    if (isTab) return line.split("\t").map((p) => p.trim().replace(/^"|"$/g, ""));
    const regex = /(?:,|\n|^)("(?:(?:"")*[^"]*)*"|[^",\n]*|(?:\n|$))/g;
    const matches: string[] = [];
    let match;
    while ((match = regex.exec(line))) {
      let val = match[1];
      if (val === undefined) break;
      val = val.trim();
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.slice(1, -1).replace(/""/g, '"');
      }
      matches.push(val);
      if (regex.lastIndex >= line.length) break;
    }
    return matches.length > 0 ? matches : line.split(",").map((p) => p.trim());
  };

  const isTab = rawLines[0].includes("\t");
  const headerParts = parseLine(rawLines[0], isTab).map((h) => h.toLowerCase().trim().replace(/[\s_-]+/g, "_"));

  // Check header mapping
  let skuIdx = -1;
  let mrpIdx = -1;
  let spIdx = -1;
  let dpIdx = -1;
  let cpIdx = -1;

  headerParts.forEach((h, idx) => {
    if (["sku_or_barcode", "sku", "barcode", "item_code", "code", "identifier"].includes(h)) skuIdx = idx;
    else if (["revised_mrp", "mrp", "new_mrp"].includes(h)) mrpIdx = idx;
    else if (["revised_selling_price", "revised_sp", "selling_price", "sp", "new_sp", "new_selling_price"].includes(h)) spIdx = idx;
    else if (["revised_distributor_price", "distributor_price", "revised_wholesale_price", "wholesale_price", "dp", "wp"].includes(h)) dpIdx = idx;
    else if (["revised_cost_price", "cost_price", "cp"].includes(h)) cpIdx = idx;
  });

  const hasHeader = skuIdx !== -1 || mrpIdx !== -1 || spIdx !== -1;
  const startLine = hasHeader ? 1 : 0;

  if (cpIdx !== -1) {
    warnings.push("Notice: Cost Price column found in import file. Cost Price is permanently read-only and has been ignored.");
  }

  for (let i = startLine; i < rawLines.length; i++) {
    const line = rawLines[i];
    if (line.startsWith("#")) continue; // Comment line
    const parts = parseLine(line, isTab);
    if (parts.length < 2) continue;

    const sku = skuIdx !== -1 ? parts[skuIdx] : parts[0];
    const mrpStr = mrpIdx !== -1 ? parts[mrpIdx] : parts[1];
    const spStr = spIdx !== -1 ? parts[spIdx] : parts[2];
    const dpStr = dpIdx !== -1 ? parts[dpIdx] : parts[3];

    const mrp = parseFloat(mrpStr);
    const sp = parseFloat(spStr);
    const dp = dpStr ? parseFloat(dpStr) : undefined;

    if (!sku) {
      errors.push(`Row ${i + 1}: Missing SKU or barcode identifier.`);
      continue;
    }
    if (isNaN(mrp) || mrp < 0) {
      errors.push(`Row ${i + 1} (${sku}): Invalid or negative MRP.`);
      continue;
    }
    if (isNaN(sp) || sp < 0) {
      errors.push(`Row ${i + 1} (${sku}): Invalid or negative Selling Price.`);
      continue;
    }
    if (sp > mrp) {
      errors.push(`Row ${i + 1} (${sku}): Statutory Violation! Selling Price (₹${sp}) exceeds MRP (₹${mrp}).`);
    }
    if (dp !== undefined && dp > sp) {
      errors.push(`Row ${i + 1} (${sku}): Distributor Price (₹${dp}) exceeds Selling Price (₹${sp}).`);
    }

    rows.push({
      item_id: `itm_${sku}`,
      variant_id: `var_${sku}`,
      style_code: sku.split("-")[0] || sku,
      article_no: sku,
      item_code: sku,
      item_name: `Imported Item (${sku})`,
      variant_sku: sku,
      current_mrp: mrp,
      current_selling_price: sp,
      current_distributor_price: dp ?? Math.round(sp * 0.90 * 100) / 100,
      current_cost_price: 0,
      status: "ACTIVE",
    });
  }

  return { rows, errors, warnings };
}

/**
 * Formats a currency amount with ₹ symbol and 2 decimal places.
 */
const fmt = (n?: number | null) =>
  n !== undefined && n !== null
    ? `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "—";

// ============================================================================
// COMPONENT IMPLEMENTATION
// ============================================================================

export interface BulkPriceRevisionWorkflowProps {
  currentUser?: { role: string; name?: string; id?: string } | null;
  onNotification?: (title: string, message: string, type?: "success" | "error" | "info" | "warning") => void;
  onSuccessSubmit?: (batchId: string) => void;
}

const BulkPriceRevisionWorkflowBase: React.FC<BulkPriceRevisionWorkflowProps> = ({
  currentUser,
  onNotification,
  onSuccessSubmit,
}) => {
  // ── Mode & Stepper ──
  const [importMode, setImportMode] = useState<"FILTER" | "CSV">("FILTER");
  const [selectionMethod, setSelectionMethod] = useState<"STYLE" | "ATTRIBUTES" | "SKU" | "ADVANCED">("STYLE");

  // ── Step 1: Filter Form States ──
  const [styleCode, setStyleCode] = useState<string>("SND-18-V");
  const [articleNo, setArticleNo] = useState<string>("");
  const [selectedBrand, setSelectedBrand] = useState<string>("ALL");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedColor, setSelectedColor] = useState<string>("BEIGE");
  const [selectedSize, setSelectedSize] = useState<string>("36, 37, 38, 39, 40, 41, 42");
  const [selectedSupplier, setSelectedSupplier] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ACTIVE");

  // ── Facets from Catalog ──
  const [facets, setFacets] = useState<{
    brands: string[];
    categories: string[];
    colors: string[];
    sizes: string[];
    suppliers: string[];
  }>({
    brands: ["SMRITI", "SND", "Tattly Threads"],
    categories: ["Footwear", "Apparel", "Accessories"],
    colors: ["BEIGE", "BLACK", "BLUE", "BROWN", "GOLD", "TAN"],
    sizes: ["36", "37", "38", "39", "40", "41", "42"],
    suppliers: ["V6DC543", "V33B46F", "VEE8B90"],
  });

  // ── Step 1: Items & Selection ──
  const [isLoadingItems, setIsLoadingItems] = useState<boolean>(false);
  const [candidateItems, setCandidateItems] = useState<BulkItemCandidate[]>([]);
  const [selectedVariantIds, setSelectedVariantIds] = useState<Set<string>>(new Set());
  const [selectAllMatching, setSelectAllMatching] = useState<boolean>(true);
  const [totalStylesCount, setTotalStylesCount] = useState<number>(1);

  // ── Step 2: Revision Configuration (Defaults per User Specification) ──
  const [reviseSp, setReviseSp] = useState<boolean>(true);
  const [reviseMrp, setReviseMrp] = useState<boolean>(true);
  const [reviseDp, setReviseDp] = useState<boolean>(true);
  const [adjustmentMethod, setAdjustmentMethod] = useState<"PERCENTAGE" | "AMOUNT" | "FIXED">("PERCENTAGE");
  const [adjustmentValue, setAdjustmentValue] = useState<string>("5");
  const [adjustmentDirection, setAdjustmentDirection] = useState<"INCREASE" | "DECREASE">("INCREASE");
  const [effectiveDate, setEffectiveDate] = useState<string>("2026-11-01");
  const [reasonCode, setReasonCode] = useState<string>("SEASONAL_DISCOUNT");

  // ── CSV Import States ──
  const [csvText, setCsvText] = useState<string>("");
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [csvWarnings, setCsvWarnings] = useState<string[]>([]);

  // ── Step 3: Grid Search, Filter & Pagination ──
  const [previewSearch, setPreviewSearch] = useState<string>("");
  const [previewFilter, setPreviewFilter] = useState<"ALL" | "VALID" | "ERROR" | "WARNING">("ALL");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [rowsPerPage, setRowsPerPage] = useState<number>(50);

  // ── Step 4: Submission States ──
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // ── Live Backend Search Handler ──
  const handleSearchItems = useCallback(async () => {
    setIsLoadingItems(true);
    try {
      const payload: any = {
        style_code: styleCode.trim() || undefined,
        article_no: articleNo.trim() || undefined,
        brand: selectedBrand !== "ALL" ? selectedBrand : undefined,
        category: selectedCategory !== "ALL" ? selectedCategory : undefined,
        status: selectedStatus,
        limit: 200,
        offset: 0,
      };

      if (selectedColor.trim() && selectedColor !== "ALL") {
        payload.color = selectedColor.trim();
      }

      const res = await apiFetchV1<BulkItemFilterResponse>("/pricing/revisions/filter-items", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (res && Array.isArray(res.items) && res.items.length > 0) {
        setCandidateItems(res.items);
        setTotalStylesCount(res.total_styles || 1);
        if (res.available_brands?.length) {
          setFacets((prev) => ({
            ...prev,
            brands: res.available_brands,
            categories: res.available_categories || prev.categories,
            colors: res.available_colors || prev.colors,
            sizes: res.available_sizes || prev.sizes,
            suppliers: res.available_suppliers || prev.suppliers,
          }));
        }
        // Select all by default
        setSelectedVariantIds(new Set(res.items.map((it) => it.variant_id)));
        setSelectAllMatching(true);
      } else {
        // Truthful empty state: no items matched the filter criteria
        setCandidateItems([]);
        setTotalStylesCount(0);
        setSelectedVariantIds(new Set());
        setSelectAllMatching(false);
      }
    } catch (err: any) {
      setCandidateItems([]);
      setTotalStylesCount(0);
      setSelectedVariantIds(new Set());
      setSelectAllMatching(false);
      onNotification?.(
        "Search Failed",
        err?.message || "Failed to retrieve items from pricing revision service.",
        "error"
      );
    } finally {
      setIsLoadingItems(false);
      setCurrentPage(1);
    }
  }, [styleCode, articleNo, selectedBrand, selectedCategory, selectedColor, selectedStatus, onNotification]);

  // Initial load
  useEffect(() => {
    handleSearchItems();
  }, [handleSearchItems]);

  // ── Reset Configuration to Default ──
  const handleResetToDefault = () => {
    setReviseSp(true);
    setReviseMrp(true);
    setReviseDp(true);
    setAdjustmentMethod("PERCENTAGE");
    setAdjustmentValue("5");
    setAdjustmentDirection("INCREASE");
    setEffectiveDate("2026-11-01");
    setReasonCode("SEASONAL_DISCOUNT");
    onNotification?.("Configuration Reset", "Revision parameters reset to default (Percentage / Increase / 5%).", "info");
  };

  // ── Clear Filters ──
  const handleClearFilters = () => {
    setStyleCode("");
    setArticleNo("");
    setSelectedBrand("ALL");
    setSelectedCategory("ALL");
    setSelectedColor("ALL");
    setSelectedSize("ALL");
    setSelectedSupplier("ALL");
    setSelectedStatus("ALL");
    handleSearchItems();
  };

  // ── Parse CSV/TSV Action ──
  const handleParseCsv = () => {
    if (!csvText.trim()) {
      onNotification?.("Validation", "Please paste or enter CSV/TSV data.", "warning");
      return;
    }
    const result = parseBulkPriceCsv(csvText);
    setCsvErrors(result.errors);
    setCsvWarnings(result.warnings);

    if (result.rows.length > 0) {
      setCandidateItems(result.rows);
      setSelectedVariantIds(new Set(result.rows.map((r) => r.variant_id)));
      setSelectAllMatching(true);
      setTotalStylesCount(new Set(result.rows.map((r) => r.style_code)).size);
      setCurrentPage(1);
      onNotification?.(
        "Import Parsed",
        `Successfully loaded ${result.rows.length} item(s) from CSV/TSV.${result.errors.length ? ` (${result.errors.length} validation errors found)` : ""}`,
        result.errors.length ? "warning" : "success"
      );
    }
  };

  // ── Download Canonical Template ──
  const handleDownloadTemplate = () => {
    const comment = "# SMRITI Bulk Price Revision Import Template. Cost Price is permanently read-only and excluded.";
    const headers = "sku_or_barcode,revised_mrp,revised_selling_price,revised_distributor_price,effective_from,reason_code";
    const sample1 = "SND-18-V-BEIGE-36,525.00,472.50,420.00,2026-11-01,SEASONAL_DISCOUNT";
    const sample2 = "SND-18-V-BEIGE-37,525.00,472.50,420.00,2026-11-01,SEASONAL_DISCOUNT";
    const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent([comment, headers, sample1, sample2].join("\n"));
    const link = document.createElement("a");
    link.setAttribute("href", csvContent);
    link.setAttribute("download", "smriti_bulk_price_revision_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onNotification?.("Template Downloaded", "Downloaded canonical Bulk Price Revision CSV template.", "info");
  };

  // ── Export Rejected Rows ──
  const handleExportRejectedRows = () => {
    const rejected = previewItems.filter((item) => item.status_badge === "ERROR");
    if (rejected.length === 0) {
      onNotification?.("Notice", "No rejected rows to export. All selected items are valid.", "info");
      return;
    }
    const headers = [
      "Row",
      "Style Code",
      "Item Code",
      "SKU",
      "Barcode",
      "Item Name",
      "Color",
      "Size",
      "Current MRP",
      "Current Selling Price",
      "Current Distributor Price",
      "Proposed MRP",
      "Proposed Selling Price",
      "Proposed Distributor Price",
      "Rejection Reason",
    ];
    const rows = rejected.map((r, i) => [
      i + 1,
      `"${r.style_code || ""}"`,
      `"${r.item_code || ""}"`,
      `"${r.variant_sku || ""}"`,
      `"${r.barcode || ""}"`,
      `"${r.item_name || ""}"`,
      `"${r.color || ""}"`,
      `"${r.size || ""}"`,
      r.current_mrp,
      r.current_selling_price,
      r.current_distributor_price ?? "",
      r.proposed_mrp,
      r.proposed_selling_price,
      r.proposed_distributor_price ?? "",
      `"${r.errorMessage || "Statutory Ceiling Violation"}"`,
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent([headers.join(","), ...rows.map((e) => e.join(","))].join("\n"));
    const link = document.createElement("a");
    link.setAttribute("href", csvContent);
    link.setAttribute("download", `rejected_price_revisions_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onNotification?.("Export Complete", `Exported ${rejected.length} rejected row(s) to CSV.`, "success");
  };

  // ── Compute Preview Rows Dynamically ──
  const currentConfig: RevisionConfig = useMemo(() => {
    return {
      reviseSp,
      reviseMrp,
      reviseDp,
      method: adjustmentMethod,
      value: parseFloat(adjustmentValue) || 0,
      direction: adjustmentDirection,
      effectiveDate,
      reasonCode,
    };
  }, [reviseSp, reviseMrp, reviseDp, adjustmentMethod, adjustmentValue, adjustmentDirection, effectiveDate, reasonCode]);

  const previewItems: PreviewRow[] = useMemo(() => {
    return candidateItems.map((it) => computeItemPreviewPrices(it, currentConfig));
  }, [candidateItems, currentConfig]);

  // ── Metrics Calculation ──
  const metrics = useMemo(() => {
    const total = previewItems.length;
    const valid = previewItems.filter((r) => r.status_badge === "VALID").length;
    const warnings = previewItems.filter((r) => r.status_badge === "WARNING").length;
    const errors = previewItems.filter((r) => r.status_badge === "ERROR").length;
    const selectedCount = selectAllMatching
      ? previewItems.length
      : previewItems.filter((r) => selectedVariantIds.has(r.variant_id)).length;
    return { total, valid, warnings, errors, selectedCount };
  }, [previewItems, selectedVariantIds, selectAllMatching]);

  // ── Filtered & Paginated Rows for Step 3 Grid ──
  const filteredGridRows = useMemo(() => {
    return previewItems.filter((row) => {
      // Status filter
      if (previewFilter === "VALID" && row.status_badge !== "VALID") return false;
      if (previewFilter === "ERROR" && row.status_badge !== "ERROR") return false;
      if (previewFilter === "WARNING" && row.status_badge !== "WARNING") return false;

      // Text search filter
      if (previewSearch.trim()) {
        const q = previewSearch.toLowerCase();
        const mStyle = (row.style_code || "").toLowerCase().includes(q);
        const mSku = (row.variant_sku || "").toLowerCase().includes(q);
        const mCode = (row.item_code || "").toLowerCase().includes(q);
        const mBar = (row.barcode || "").toLowerCase().includes(q);
        const mName = (row.item_name || "").toLowerCase().includes(q);
        const mColor = (row.color || "").toLowerCase().includes(q);
        const mSize = (row.size || "").toLowerCase().includes(q);
        if (!mStyle && !mSku && !mCode && !mBar && !mName && !mColor && !mSize) {
          return false;
        }
      }
      return true;
    });
  }, [previewItems, previewFilter, previewSearch]);

  const totalPages = Math.max(1, Math.ceil(filteredGridRows.length / rowsPerPage));
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredGridRows.slice(start, start + rowsPerPage);
  }, [filteredGridRows, currentPage, rowsPerPage]);

  // ── Selection Toggle Handlers ──
  const handleToggleSelectAll = () => {
    if (selectAllMatching) {
      setSelectAllMatching(false);
      setSelectedVariantIds(new Set());
    } else {
      setSelectAllMatching(true);
      setSelectedVariantIds(new Set(previewItems.map((r) => r.variant_id)));
    }
  };

  const handleToggleRow = (variantId: string) => {
    const next = new Set(selectedVariantIds);
    if (next.has(variantId)) {
      next.delete(variantId);
      setSelectAllMatching(false);
    } else {
      next.add(variantId);
      if (next.size === previewItems.length) {
        setSelectAllMatching(true);
      }
    }
    setSelectedVariantIds(next);
  };

  // ── Step 4: Submission Execution ──
  const handleConfirmAndSubmit = async (isDraft: boolean = false) => {
    const itemsToSubmit = previewItems.filter((r) =>
      selectAllMatching ? r.status_badge !== "ERROR" : selectedVariantIds.has(r.variant_id) && r.status_badge !== "ERROR"
    );

    if (itemsToSubmit.length === 0) {
      onNotification?.("Validation", "No valid selected items to submit.", "warning");
      return;
    }

    if (metrics.errors > 0 && !isDraft) {
      onNotification?.(
        "Statutory Violation",
        `Cannot submit while ${metrics.errors} error(s) exist. Please rectify errors or export rejected rows.`,
        "error"
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const payloadItems = itemsToSubmit.map((r) => ({
        sku_or_barcode: r.variant_sku || r.barcode || r.item_code,
        revised_mrp: r.proposed_mrp,
        revised_selling_price: r.proposed_selling_price,
        revised_distributor_price: r.proposed_distributor_price ?? undefined,
        // Cost Price is permanently excluded from write payloads!
        effective_from: effectiveDate ? new Date(effectiveDate).toISOString() : undefined,
        reason_code: reasonCode,
        justification: isDraft
          ? `Bulk revision draft for style ${r.style_code}`
          : `Bulk price revision approved batch (${adjustmentMethod} ${adjustmentDirection} ${adjustmentValue})`,
      }));

      const res = await apiFetchV1<any>("/pricing/revisions/bulk", {
        method: "POST",
        body: JSON.stringify({ items: payloadItems }),
      });

      const batchId = res?.batch_id || "BATCH-OK";
      onNotification?.(
        "Revisions Applied",
        `Successfully submitted ${itemsToSubmit.length} revisions. Batch: ${batchId}. (${res.approved_count || 0} active, ${res.pending_count || 0} pending approval).`,
        "success"
      );
      onSuccessSubmit?.(batchId);
    } catch (err: any) {
      onNotification?.("Submission Failed", err?.message || "Failed to submit bulk price revision.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ============================================================================
  // RENDER WORKFLOW INTERFACE
  // ============================================================================

  return (
    <div className="flex flex-col h-full w-full bg-[#f8fafc] dark:bg-[#070b14] text-slate-900 dark:text-slate-100 font-sans select-none overflow-y-auto">
      
      {/* ── TOP HEADER (Page Title & Global Actions) ── */}
      <div className="bg-white dark:bg-[#0c1322] border-b border-slate-200 dark:border-slate-800/80 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-600/10 text-blue-600 dark:text-blue-400 rounded-xl">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
              Bulk Price Revision
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Select items, configure price changes and review before applying. Cost Price is read-only.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onNotification?.("Saved Filters", "Loaded default filter set: Footwear Regular Styles.", "info")}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-2xs transition-colors"
          >
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <span>Load Saved Filter</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-2xs transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Download Template</span>
          </button>

          <button
            type="button"
            onClick={() => setImportMode(importMode === "FILTER" ? "CSV" : "FILTER")}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800 rounded-lg shadow-2xs transition-colors"
          >
            <Upload className="w-3.5 h-3.5 text-blue-600" />
            <span>{importMode === "FILTER" ? "Switch to CSV Import" : "Switch to Catalog Filter"}</span>
          </button>
        </div>
      </div>

      {/* ── STEPPER PROGRESS BAR (4 Steps) ── */}
      <div className="bg-white dark:bg-[#0c1322] border-b border-slate-200 dark:border-slate-800/80 px-6 py-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-5xl mx-auto">
          {/* Step 1 */}
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
              1
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">Select Items</div>
              <div className="text-[10px] text-slate-400">Filter and choose items</div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center justify-center shrink-0">
              2
            </div>
            <div>
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300">Configure Revision</div>
              <div className="text-[10px] text-slate-400">Choose fields and adjustment</div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center justify-center shrink-0">
              3
            </div>
            <div>
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300">Preview &amp; Validate</div>
              <div className="text-[10px] text-slate-400">Review proposed changes</div>
            </div>
          </div>

          {/* Step 4 */}
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center justify-center shrink-0">
              4
            </div>
            <div>
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300">Confirm &amp; Submit</div>
              <div className="text-[10px] text-slate-400">Apply with approval &amp; audit</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── WORKSPACE CONTENT BODY ── */}
      <div className="p-6 space-y-6 flex-1">
        
        {/* ── TOP CONFIGURATION TRIPLE-CARD ROW ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          
          {/* ═════════════════════════════════════════════════════════════════════
              CARD 1: SELECT ITEMS (or CSV IMPORT PANEL)
             ═════════════════════════════════════════════════════════════════════ */}
          <div className="lg:col-span-4 bg-white dark:bg-[#0c1322] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-2xs">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <span>1. Select Items</span>
                </h2>
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <button
                    type="button"
                    onClick={() => onNotification?.("Saved Filters", "Loaded default filter set.", "info")}
                    className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                  >
                    <span>Saved Filters</span>
                    <Filter className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {importMode === "FILTER" ? (
                <>
                  {/* Selection Method Pills */}
                  <div className="mb-3">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 block">
                      Selection Method
                    </label>
                    <div className="grid grid-cols-4 gap-1 p-0.5 bg-slate-100 dark:bg-slate-800/80 rounded-lg text-[11px] font-semibold text-center">
                      {(["STYLE", "ATTRIBUTES", "SKU", "ADVANCED"] as const).map((m) => {
                        const labels = { STYLE: "Style / Article", ATTRIBUTES: "Attributes", SKU: "SKU / Barcode", ADVANCED: "Advanced" };
                        return (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setSelectionMethod(m)}
                            className={`py-1 rounded-md transition-all ${
                              selectionMethod === m
                                ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-2xs font-bold"
                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                            }`}
                          >
                            {labels[m]}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Filter Form Controls */}
                  <div className="space-y-2.5 text-xs">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-0.5">Style Code</label>
                        <div className="relative">
                          <input
                            type="text"
                            value={styleCode}
                            onChange={(e) => setStyleCode(e.target.value)}
                            placeholder="e.g. SND-18-V"
                            className="w-full pl-2.5 pr-7 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                          />
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
                        </div>
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-0.5">Article No.</label>
                        <input
                          type="text"
                          value={articleNo}
                          onChange={(e) => setArticleNo(e.target.value)}
                          placeholder="Enter article (optional)"
                          className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-0.5">Brand</label>
                        <select
                          value={selectedBrand}
                          onChange={(e) => setSelectedBrand(e.target.value)}
                          className="w-full px-2 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                        >
                          <option value="ALL">All Brands</option>
                          {facets.brands.map((b) => (
                            <option key={b} value={b}>{b}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-0.5">Category</label>
                        <select
                          value={selectedCategory}
                          onChange={(e) => setSelectedCategory(e.target.value)}
                          className="w-full px-2 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                        >
                          <option value="ALL">All Categories</option>
                          {facets.categories.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-0.5">Color</label>
                        <input
                          type="text"
                          value={selectedColor}
                          onChange={(e) => setSelectedColor(e.target.value)}
                          placeholder="e.g. BEIGE"
                          className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-medium"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-0.5">Size</label>
                        <input
                          type="text"
                          value={selectedSize}
                          onChange={(e) => setSelectedSize(e.target.value)}
                          placeholder="e.g. 36, 37, 38..."
                          className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-0.5">Supplier</label>
                        <select
                          value={selectedSupplier}
                          onChange={(e) => setSelectedSupplier(e.target.value)}
                          className="w-full px-2 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                        >
                          <option value="ALL">All Suppliers</option>
                          {facets.suppliers.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-0.5">Item Status</label>
                        <select
                          value={selectedStatus}
                          onChange={(e) => setSelectedStatus(e.target.value)}
                          className="w-full px-2 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                        >
                          <option value="ACTIVE">Active Items</option>
                          <option value="ALL">All Items</option>
                          <option value="INACTIVE">Inactive Items</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                /* CSV Paste Mode */
                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Paste CSV / TSV Content
                    </label>
                    <textarea
                      value={csvText}
                      onChange={(e) => setCsvText(e.target.value)}
                      placeholder={`sku_or_barcode, revised_mrp, revised_selling_price, revised_distributor_price\nSND-18-V-BEIGE-36, 525.00, 472.50, 420.00\nSND-18-V-BEIGE-37, 525.00, 472.50, 420.00`}
                      rows={7}
                      className="w-full p-2.5 font-mono text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                    />
                  </div>
                  {csvWarnings.length > 0 && (
                    <div className="p-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-lg text-[11px] text-amber-700 dark:text-amber-300">
                      {csvWarnings.map((w, i) => (
                        <div key={i}>{w}</div>
                      ))}
                    </div>
                  )}
                  {csvErrors.length > 0 && (
                    <div className="p-2 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 rounded-lg text-[11px] text-rose-700 dark:text-rose-300">
                      <div className="font-bold">Errors found ({csvErrors.length}):</div>
                      <div className="truncate">{csvErrors[0]}</div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Step 1 Actions */}
            <div className="pt-4 flex items-center gap-2 border-t border-slate-100 dark:border-slate-800/60 mt-3">
              {importMode === "FILTER" ? (
                <>
                  <button
                    type="button"
                    onClick={handleSearchItems}
                    disabled={isLoadingItems}
                    className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-xs rounded-xl shadow-2xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Search className={`w-3.5 h-3.5 ${isLoadingItems ? "animate-spin" : ""}`} />
                    <span>{isLoadingItems ? "Searching..." : "Search Items"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl transition-colors"
                  >
                    Clear Filters
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleParseCsv}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-2xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Parse &amp; Preview CSV</span>
                </button>
              )}
            </div>
          </div>

          {/* ═════════════════════════════════════════════════════════════════════
              CARD 2: CONFIGURE PRICE REVISION
             ═════════════════════════════════════════════════════════════════════ */}
          <div className="lg:col-span-5 bg-white dark:bg-[#0c1322] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-2xs">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  2. Configure Price Revision
                </h2>
                <button
                  type="button"
                  onClick={handleResetToDefault}
                  className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset to Default</span>
                </button>
              </div>

              {/* Price Fields to Revise (Checkboxes) */}
              <div className="mb-4">
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5 block">
                  Price Fields to Revise
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={reviseSp}
                      onChange={(e) => setReviseSp(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span className="font-semibold text-slate-900 dark:text-white">Selling Price (Retail)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={reviseMrp}
                      onChange={(e) => setReviseMrp(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span className="font-semibold text-slate-900 dark:text-white">MRP (Maximum Retail Price)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={reviseDp}
                      onChange={(e) => setReviseDp(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span className="font-semibold text-slate-900 dark:text-white">Distributor Price (Wholesale)</span>
                  </label>

                  <label
                    className="flex items-center gap-2 opacity-50 cursor-not-allowed select-none"
                    title="Cost price cannot be changed in bulk revision"
                  >
                    <input
                      type="checkbox"
                      checked={false}
                      disabled
                      className="w-4 h-4 rounded text-slate-400 cursor-not-allowed"
                    />
                    <span className="font-semibold text-slate-500 flex items-center gap-1">
                      Cost Price (Read-only)
                      <HelpCircle className="w-3 h-3 text-slate-400" />
                    </span>
                  </label>
                </div>
              </div>

              {/* Adjustment Method (Radio Pills) */}
              <div className="mb-4">
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5 block">
                  Adjustment Method
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustmentMethod("PERCENTAGE")}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      adjustmentMethod === "PERCENTAGE"
                        ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 text-blue-900 dark:text-blue-200 ring-1 ring-blue-500"
                        : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <div className="font-bold text-xs flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${adjustmentMethod === "PERCENTAGE" ? "bg-blue-600" : "bg-slate-400"}`} />
                      By Percentage (%)
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Increase or decrease by percentage
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAdjustmentMethod("AMOUNT")}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      adjustmentMethod === "AMOUNT"
                        ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 text-blue-900 dark:text-blue-200 ring-1 ring-blue-500"
                        : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <div className="font-bold text-xs flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${adjustmentMethod === "AMOUNT" ? "bg-blue-600" : "bg-slate-400"}`} />
                      By Amount (₹)
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Increase or decrease by fixed amount
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAdjustmentMethod("FIXED")}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      adjustmentMethod === "FIXED"
                        ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 text-blue-900 dark:text-blue-200 ring-1 ring-blue-500"
                        : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <div className="font-bold text-xs flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${adjustmentMethod === "FIXED" ? "bg-blue-600" : "bg-slate-400"}`} />
                      Fixed Price (₹)
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Set new price directly
                    </div>
                  </button>
                </div>
              </div>

              {/* Adjustment Value, Direction, Effective Date Row */}
              <div className="grid grid-cols-12 gap-3 text-xs">
                {/* Value Input */}
                <div className="col-span-4">
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Adjustment Value
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      value={adjustmentValue}
                      onChange={(e) => setAdjustmentValue(e.target.value)}
                      className="w-full pl-3 pr-8 py-1.5 text-xs font-mono font-bold bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                    />
                    <span className="absolute right-2.5 top-1.5 text-slate-400 font-bold text-xs">
                      {adjustmentMethod === "PERCENTAGE" ? "%" : "₹"}
                    </span>
                  </div>
                </div>

                {/* Direction Toggle */}
                <div className="col-span-4">
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Direction
                  </label>
                  <div className="flex items-center gap-3 pt-1 text-xs">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="adjDirection"
                        checked={adjustmentDirection === "INCREASE"}
                        onChange={() => setAdjustmentDirection("INCREASE")}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className="font-semibold text-slate-800 dark:text-slate-200">Increase</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="adjDirection"
                        checked={adjustmentDirection === "DECREASE"}
                        onChange={() => setAdjustmentDirection("DECREASE")}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className="font-semibold text-slate-800 dark:text-slate-200">Decrease</span>
                    </label>
                  </div>
                </div>

                {/* Effective Date */}
                <div className="col-span-4">
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Effective From
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={effectiveDate}
                      onChange={(e) => setEffectiveDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Reason Code */}
              <div className="mt-3">
                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Reason Code
                </label>
                <select
                  value={reasonCode}
                  onChange={(e) => setReasonCode(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                >
                  <option value="SEASONAL_DISCOUNT">SEASONAL_DISCOUNT</option>
                  <option value="MANUAL_REVISION">MANUAL_REVISION</option>
                  <option value="SUPPLIER_RATE_HIKE">SUPPLIER_RATE_HIKE</option>
                  <option value="COMPETITOR_PRICE_MATCH">COMPETITOR_PRICE_MATCH</option>
                  <option value="STATUTORY_TAX_ADJUSTMENT">STATUTORY_TAX_ADJUSTMENT</option>
                  <option value="CLEARANCE_PROMO">CLEARANCE_PROMO</option>
                </select>
              </div>
            </div>
          </div>

          {/* ═════════════════════════════════════════════════════════════════════
              CARD 3: SELECTED ITEMS SUMMARY
             ═════════════════════════════════════════════════════════════════════ */}
          <div className="lg:col-span-3 bg-white dark:bg-[#0c1322] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-2xs">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Selected Items Summary
                </h2>
                <button
                  type="button"
                  onClick={handleSearchItems}
                  className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-white"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Refresh Count</span>
                </button>
              </div>

              {/* 4 KPI Metric Blocks */}
              <div className="grid grid-cols-4 gap-2 mb-4 text-center">
                <div className="p-2.5 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 rounded-xl">
                  <div className="text-base font-extrabold text-blue-600 dark:text-blue-400 font-mono">
                    {metrics.total}
                  </div>
                  <div className="text-[10px] font-semibold text-slate-500">Total Items</div>
                </div>

                <div className="p-2.5 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 rounded-xl">
                  <div className="text-base font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
                    {metrics.valid}
                  </div>
                  <div className="text-[10px] font-semibold text-slate-500">Valid Items</div>
                </div>

                <div className="p-2.5 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 rounded-xl">
                  <div className="text-base font-extrabold text-amber-600 dark:text-amber-400 font-mono">
                    {metrics.warnings}
                  </div>
                  <div className="text-[10px] font-semibold text-slate-500">Warnings</div>
                </div>

                <div className="p-2.5 bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 rounded-xl">
                  <div className="text-base font-extrabold text-rose-600 dark:text-rose-400 font-mono">
                    {metrics.errors}
                  </div>
                  <div className="text-[10px] font-semibold text-slate-500">Errors</div>
                </div>
              </div>

              {/* Selection Details Box */}
              <div className="bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs space-y-1.5">
                <div className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-1">
                  <Package className="w-3.5 h-3.5 text-blue-500" />
                  <span>Selection Details</span>
                </div>
                <div className="grid grid-cols-12 gap-1 text-[11px]">
                  <span className="col-span-4 text-slate-500">Style Code:</span>
                  <span className="col-span-8 font-semibold text-slate-800 dark:text-slate-200">{styleCode || "All"}</span>

                  <span className="col-span-4 text-slate-500">Color:</span>
                  <span className="col-span-8 font-semibold text-slate-800 dark:text-slate-200">{selectedColor || "All"}</span>

                  <span className="col-span-4 text-slate-500">Size:</span>
                  <span className="col-span-8 font-semibold text-slate-800 dark:text-slate-200">{selectedSize || "All"}</span>

                  <span className="col-span-4 text-slate-500">Scope:</span>
                  <span className="col-span-8 font-semibold text-slate-800 dark:text-slate-200">
                    {selectAllMatching ? `All matching variants (${totalStylesCount} style)` : `${metrics.selectedCount} variant(s)`}
                  </span>

                  <span className="col-span-4 text-slate-500">Category:</span>
                  <span className="col-span-8 font-semibold text-slate-800 dark:text-slate-200">{selectedCategory}</span>

                  <span className="col-span-4 text-slate-500">Brand:</span>
                  <span className="col-span-8 font-semibold text-slate-800 dark:text-slate-200">{selectedBrand}</span>

                  <span className="col-span-4 text-slate-500">Supplier:</span>
                  <span className="col-span-8 font-semibold text-slate-800 dark:text-slate-200">{selectedSupplier}</span>

                  <span className="col-span-4 text-slate-500">Status:</span>
                  <span className="col-span-8 font-semibold text-slate-800 dark:text-slate-200">{selectedStatus}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ═════════════════════════════════════════════════════════════════════
            CARD 4: 3. PREVIEW & VALIDATE GRID
           ═════════════════════════════════════════════════════════════════════ */}
        <div className="bg-white dark:bg-[#0c1322] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xs">
          
          {/* Grid Toolbar */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                3. Preview &amp; Validate ({metrics.total} items)
              </h3>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-semibold">
                {metrics.selectedCount} selected
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Search input in results */}
              <div className="relative min-w-[200px]">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={previewSearch}
                  onChange={(e) => {
                    setPreviewSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search in results..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>

              {/* Status Filter */}
              <select
                value={previewFilter}
                onChange={(e) => {
                  setPreviewFilter(e.target.value as any);
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              >
                <option value="ALL">All Rows</option>
                <option value="VALID">Valid Only ({metrics.valid})</option>
                <option value="ERROR">Errors Only ({metrics.errors})</option>
                <option value="WARNING">Warnings Only ({metrics.warnings})</option>
              </select>

              {/* Export Rejected Rows */}
              <button
                type="button"
                onClick={handleExportRejectedRows}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 border border-rose-200 dark:border-rose-900/50 rounded-lg transition-colors"
                title="Export rows failing statutory constraints to CSV"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Rejected Rows</span>
              </button>
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/80 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800 text-[11px]">
                  <th className="p-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={selectAllMatching}
                      onChange={handleToggleSelectAll}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th className="p-3 w-10 text-center">#</th>
                  <th className="p-3">Style / Article</th>
                  <th className="p-3">Item Code / SKU<br /><span className="text-[10px] text-slate-400 font-normal">Barcode</span></th>
                  <th className="p-3">Item Name<br /><span className="text-[10px] text-slate-400 font-normal">Color / Size</span></th>
                  
                  {/* Current Prices Group */}
                  <th className="p-3 border-l border-slate-200 dark:border-slate-800 text-center" colSpan={4}>
                    Current Prices (₹)
                    <div className="grid grid-cols-4 font-mono font-normal text-[10px] text-slate-400 mt-0.5">
                      <span>MRP</span>
                      <span>Selling</span>
                      <span>Distributor</span>
                      <span className="text-slate-400">Cost (Read-only)</span>
                    </div>
                  </th>

                  {/* Proposed Prices Group */}
                  <th className="p-3 border-l border-slate-200 dark:border-slate-800 text-center" colSpan={3}>
                    Proposed Prices (₹)
                    <div className="grid grid-cols-3 font-mono font-normal text-[10px] text-slate-400 mt-0.5">
                      <span>MRP</span>
                      <span>Selling</span>
                      <span>Distributor</span>
                    </div>
                  </th>

                  {/* Change Group */}
                  <th className="p-3 border-l border-slate-200 dark:border-slate-800 text-center" colSpan={3}>
                    Change
                    <div className="grid grid-cols-3 font-mono font-normal text-[10px] text-slate-400 mt-0.5">
                      <span>MRP</span>
                      <span>Selling</span>
                      <span>Distributor</span>
                    </div>
                  </th>

                  <th className="p-3 border-l border-slate-200 dark:border-slate-800 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-[11px] font-mono">
                {paginatedRows.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="p-8 text-center text-slate-400 font-sans text-xs">
                      No matching items found for the current filter criteria.
                    </td>
                  </tr>
                ) : (
                  paginatedRows.map((row, idx) => {
                    const rowGlobalIdx = (currentPage - 1) * rowsPerPage + idx + 1;
                    const isSelected = selectAllMatching || selectedVariantIds.has(row.variant_id);

                    return (
                      <tr
                        key={row.variant_id}
                        className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${
                          !isSelected ? "opacity-60 bg-slate-50/30" : ""
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleRow(row.variant_id)}
                            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                          />
                        </td>

                        {/* Row Index */}
                        <td className="p-3 text-center text-slate-400 font-sans">
                          {rowGlobalIdx}
                        </td>

                        {/* Style / Article */}
                        <td className="p-3 font-sans font-bold text-slate-900 dark:text-white">
                          {row.style_code || row.article_no || "—"}
                        </td>

                        {/* Item Code / SKU / Barcode */}
                        <td className="p-3">
                          <div className="font-semibold text-slate-800 dark:text-slate-200">{row.item_code || row.variant_sku}</div>
                          <div className="text-[10px] text-slate-400">{row.barcode || "—"}</div>
                        </td>

                        {/* Item Name / Color / Size */}
                        <td className="p-3 font-sans">
                          <div className="font-semibold text-slate-800 dark:text-slate-200">{row.item_name}</div>
                          <div className="text-[10px] text-slate-500">
                            {row.color || "—"} / {row.size || "—"}
                          </div>
                        </td>

                        {/* Current Prices Group */}
                        <td className="p-3 border-l border-slate-200 dark:border-slate-800 text-right text-slate-600 dark:text-slate-400">
                          {row.current_mrp.toFixed(2)}
                        </td>
                        <td className="p-3 text-right text-slate-600 dark:text-slate-400">
                          {row.current_selling_price.toFixed(2)}
                        </td>
                        <td className="p-3 text-right text-slate-600 dark:text-slate-400">
                          {row.current_distributor_price !== null && row.current_distributor_price !== undefined
                            ? Number(row.current_distributor_price).toFixed(2)
                            : "—"}
                        </td>
                        <td className="p-3 text-right text-slate-400 bg-slate-50/50 dark:bg-slate-900/40">
                          {row.current_cost_price.toFixed(2)}
                        </td>

                        {/* Proposed Prices Group */}
                        <td className="p-3 border-l border-slate-200 dark:border-slate-800 text-right font-bold text-slate-900 dark:text-white">
                          {row.proposed_mrp.toFixed(2)}
                        </td>
                        <td className="p-3 text-right font-bold text-blue-600 dark:text-blue-400">
                          {row.proposed_selling_price.toFixed(2)}
                        </td>
                        <td className="p-3 text-right font-bold text-slate-900 dark:text-white">
                          {row.proposed_distributor_price !== null && row.proposed_distributor_price !== undefined
                            ? Number(row.proposed_distributor_price).toFixed(2)
                            : "—"}
                        </td>

                        {/* Changes Group (MRP, Selling, Distributor) */}
                        <td className="p-3 border-l border-slate-200 dark:border-slate-800 text-right">
                          <div className={`font-semibold ${row.mrp_delta >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600"}`}>
                            {row.mrp_delta >= 0 ? `+${row.mrp_delta.toFixed(2)}` : row.mrp_delta.toFixed(2)}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            ({row.mrp_delta_pct >= 0 ? `+${row.mrp_delta_pct}%` : `${row.mrp_delta_pct}%`})
                          </div>
                        </td>

                        <td className="p-3 text-right">
                          <div className={`font-semibold ${row.sp_delta >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600"}`}>
                            {row.sp_delta >= 0 ? `+${row.sp_delta.toFixed(2)}` : row.sp_delta.toFixed(2)}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            ({row.sp_delta_pct >= 0 ? `+${row.sp_delta_pct}%` : `${row.sp_delta_pct}%`})
                          </div>
                        </td>

                        <td className="p-3 text-right">
                          <div className={`font-semibold ${row.dp_delta >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600"}`}>
                            {row.dp_delta >= 0 ? `+${row.dp_delta.toFixed(2)}` : row.dp_delta.toFixed(2)}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            ({row.dp_delta_pct >= 0 ? `+${row.dp_delta_pct}%` : `${row.dp_delta_pct}%`})
                          </div>
                        </td>

                        {/* Status Badge */}
                        <td className="p-3 border-l border-slate-200 dark:border-slate-800 text-center font-sans">
                          {row.status_badge === "VALID" ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                              Valid
                            </span>
                          ) : row.status_badge === "WARNING" ? (
                            <span
                              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                              title={row.warningMessage}
                            >
                              <AlertTriangle className="w-3 h-3 text-amber-500" />
                              Warning
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
                              title={row.errorMessage}
                            >
                              <XCircle className="w-3 h-3 text-rose-500" />
                              Error
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Grid Footer / Pagination */}
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="text-slate-500">
              Showing {filteredGridRows.length > 0 ? (currentPage - 1) * rowsPerPage + 1 : 0} -{" "}
              {Math.min(currentPage * rowsPerPage, filteredGridRows.length)} of {filteredGridRows.length} items
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map((pg) => (
                  <button
                    key={pg}
                    type="button"
                    onClick={() => setCurrentPage(pg)}
                    className={`w-7 h-7 rounded-lg font-bold text-xs ${
                      currentPage === pg
                        ? "bg-blue-600 text-white"
                        : "border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100"
                    }`}
                  >
                    {pg}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-1.5 text-slate-500">
                <span>Rows per page</span>
                <select
                  value={rowsPerPage}
                  onChange={(e) => {
                    setRowsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-xs"
                >
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* ═════════════════════════════════════════════════════════════════════
            CARD 5: 4. CONFIRM & SUBMIT FOOTER BAR
           ═════════════════════════════════════════════════════════════════════ */}
        <div className="bg-white dark:bg-[#0c1322] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-2xs">
          <div>
            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              4. Confirm &amp; Submit
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Review summary and submit for approval. Preview calculations do not mutate database records until submitted.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => handleConfirmAndSubmit(true)}
              disabled={isSubmitting || metrics.selectedCount === 0}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 border border-slate-300 dark:border-slate-700 rounded-xl transition-colors disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save as Draft</span>
            </button>

            <button
              type="button"
              onClick={() => handleConfirmAndSubmit(false)}
              disabled={isSubmitting || metrics.selectedCount === 0 || metrics.errors > 0}
              className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md transition-all disabled:opacity-50"
            >
              <Send className={`w-3.5 h-3.5 ${isSubmitting ? "animate-spin" : ""}`} />
              <span>{isSubmitting ? "Submitting..." : "Submit for Approval"}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export const BulkPriceRevisionWorkflow = withCapability(BulkPriceRevisionWorkflowBase, {
  entity: "item",
  capability: "item.price_revision",
  role: "SPECIALIZED_UI",
  canonicalOwner: "PriceRevisionStudioWorkspace.tsx",
  decisionId: "ADR-PRICE-01",
});

export default BulkPriceRevisionWorkflow;
