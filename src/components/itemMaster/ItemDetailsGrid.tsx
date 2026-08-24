/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 5.4.0
 * Created      : 2026-08-21
 * Modified     : 2026-08-23
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useEffect, useMemo } from "react";
import { 
  Plus, 
  Trash2, 
  Copy, 
  Filter, 
  Save, 
  Replace, 
  Sparkles, 
  LayoutGrid, 
  FileText, 
  Info,
  CheckCircle,
  HelpCircle,
  Download,
  Printer,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Search,
  Image as ImageIcon,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  X
} from "lucide-react";
import { Product, AttributeDefinition } from "../../types.ts";
import { apiFetchV1 } from "../../lib/apiFetchV1.ts";
import { getUnifiedItemMasterFields, getGloballyVisibleFields, getGlobalFieldVisibility } from "../../services/unifiedFieldCatalog.ts";
import { getCustomFieldLabels } from "../../lib/headerMapping/HeaderAliasRegistry.ts";
import { resolveProductImageUrl, getImagePathConfig } from "../../services/imagePathConfig.ts";
import { ReplaceDataDlg } from "./ReplaceDataDlg.tsx";
import { CodeSelectDlg } from "./CodeSelectDlg.tsx";
import { ItemShortcuts } from "./ItemShortcuts.tsx";
import { DataLoadConfirm } from "./DataLoadConfirm.tsx";
import { ItemViewConfigState } from "./ItemViewConfig.tsx";
import { ExportButton } from "../export/ExportButton.tsx";
import { ExportColumnDefinition } from "../export/types.ts";

export type MasterEntryMode = "add" | "edit" | "delete";
export type SortDirection = "asc" | "desc";

export const REQUIRED_ITEM_KEYS = new Set([
  "code",
  "sku",
  "stockNo",
  "barcode",
  "name",
  "product",
  "buying_price",
  "buyingPrice",
  "cost_price",
  "costPrice",
  "mrp",
  "price",
  "sellingPrice",
  "gst_percentage",
  "productTax",
  "hsn_code",
  "hsnCode"
]);

export function isItemFieldRequired(key: string): boolean {
  return REQUIRED_ITEM_KEYS.has(key);
}

export function isExemptNonStockItem(row: any): boolean {
  const tm = String(row.tracking_mode || row.trackingMode || "").toLowerCase();
  const pm = String(row.pricing_mode || row.pricingMode || "").toLowerCase();
  const cat = String(row.category || "").toLowerCase();
  const itemType = String(row.item_type || row.itemType || "").toUpperCase();

  return (
    tm === "no-stock" || tm === "nostock" || tm === "service" || tm === "non-stock" ||
    pm === "free" || pm === "sample" || pm === "promotional" ||
    cat === "service" || cat === "services" || cat === "sample" || cat === "samples" || cat === "promotion" || cat === "promotional" || cat === "free" ||
    itemType === "SERVICE" || itemType === "PROMOTION" || itemType === "SAMPLE" || itemType === "NON_STOCK" || itemType === "FREE"
  );
}

export function validateRowRequiredFields(row: any): { isValid: boolean; missingFields: string[]; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const missingFields: string[] = [];

  // 1. Stock No / SKU
  const codeVal = typeof row.code === "string" ? row.code.trim() : String(row.code ?? "").trim();
  if (!codeVal) {
    errors.code = "Stock No / SKU is required and cannot be blank.";
    missingFields.push("Stock No / SKU");
  }

  // 2. Barcode
  const barcodeVal = typeof row.barcode === "string" ? row.barcode.trim() : String(row.barcode ?? "").trim();
  if (!barcodeVal) {
    errors.barcode = "Barcode is required and cannot be blank.";
    missingFields.push("Barcode");
  }

  // 3. Product Name / Title
  const nameVal = typeof row.name === "string" ? row.name.trim() : String(row.name ?? "").trim();
  if (!nameVal) {
    errors.name = "Product Name is required and cannot be blank.";
    missingFields.push("Product Name / Title");
  }

  // 4. GST Tax Rate
  const gstRaw = row.gst_percentage;
  const gstNum = typeof gstRaw === "number" ? gstRaw : parseFloat(String(gstRaw ?? "").replace(/[^0-9.]/g, "").trim());
  if (gstRaw === null || gstRaw === undefined || String(gstRaw).trim() === "" || isNaN(gstNum) || gstNum < 0) {
    errors.gst_percentage = "GST Tax Rate is required and cannot be blank.";
    missingFields.push("GST Tax Rate");
  }

  // 5. HSN Code
  const hsnVal = typeof row.hsn_code === "string" ? row.hsn_code.trim() : String(row.hsn_code ?? "").trim();
  if (!hsnVal) {
    errors.hsn_code = "HSN Code is required and cannot be blank.";
    missingFields.push("HSN Code");
  }

  const isNonStock = isExemptNonStockItem(row);

  // Parse pricing fields
  const bpRaw = row.buying_price !== undefined ? row.buying_price : row.buyingPrice;
  const bpNum = typeof bpRaw === "number" ? bpRaw : parseFloat(String(bpRaw ?? "").trim());

  const cpRaw = row.cost_price !== undefined ? row.cost_price : row.costPrice;
  const cpNum = typeof cpRaw === "number" ? cpRaw : parseFloat(String(cpRaw ?? "").trim());

  const spRaw = row.price !== undefined ? row.price : row.sellingPrice;
  const spNum = typeof spRaw === "number" ? spRaw : parseFloat(String(spRaw ?? "").trim());

  const mrpRaw = row.mrp;
  const mrpNum = typeof mrpRaw === "number" ? mrpRaw : parseFloat(String(mrpRaw ?? "").trim());

  if (!isNonStock) {
    // 6. Buying Price: Mandatory > 0
    if (bpRaw === null || bpRaw === undefined || String(bpRaw).trim() === "" || isNaN(bpNum) || bpNum <= 0) {
      errors.buying_price = "Buying Price is required and must be greater than 0.";
      errors.buyingPrice = errors.buying_price;
      missingFields.push("Buying Price (> 0)");
    }

    // 7. Cost Price: Mandatory > 0
    if (cpRaw === null || cpRaw === undefined || String(cpRaw).trim() === "" || isNaN(cpNum) || cpNum <= 0) {
      errors.cost_price = "Cost Price is required and must be greater than 0.";
      errors.costPrice = errors.cost_price;
      missingFields.push("Cost Price (> 0)");
    }

    // 8. Selling Price: Mandatory >= 0
    if (spRaw === null || spRaw === undefined || String(spRaw).trim() === "" || isNaN(spNum) || spNum < 0) {
      errors.price = "Selling Price is required and must be greater than or equal to 0.";
      errors.sellingPrice = errors.price;
      missingFields.push("Selling Price (>= 0)");
    }

    // 9. MRP: Mandatory >= Selling Price
    if (mrpRaw === null || mrpRaw === undefined || String(mrpRaw).trim() === "" || isNaN(mrpNum) || mrpNum < 0) {
      errors.mrp = "MRP is required and must be a valid non-negative number.";
      missingFields.push("MRP");
    } else if (!isNaN(spNum) && mrpNum < spNum) {
      errors.mrp = `MRP (${mrpNum}) must be greater than or equal to Selling Price (${spNum}).`;
      missingFields.push(`MRP >= Selling Price (${mrpNum} < ${spNum})`);
    }

    // 10. Cost Price <= Buying Price
    if (!isNaN(cpNum) && !isNaN(bpNum) && cpNum > bpNum) {
      errors.cost_price = `Cost Price (${cpNum}) must be less than or equal to Buying Price (${bpNum}).`;
      errors.costPrice = errors.cost_price;
      missingFields.push(`Cost Price <= Buying Price (${cpNum} > ${bpNum})`);
    }
  } else {
    // For non-stock / service / free items: Validate non-negative if provided
    if (spRaw !== null && spRaw !== undefined && String(spRaw).trim() !== "" && !isNaN(spNum) && spNum < 0) {
      errors.price = "Selling Price cannot be negative.";
      missingFields.push("Selling Price");
    }
    if (mrpRaw !== null && mrpRaw !== undefined && String(mrpRaw).trim() !== "" && !isNaN(mrpNum) && !isNaN(spNum) && mrpNum < spNum) {
      errors.mrp = `MRP (${mrpNum}) must be greater than or equal to Selling Price (${spNum}).`;
      missingFields.push("MRP >= Selling Price");
    }
  }

  return {
    isValid: missingFields.length === 0,
    missingFields,
    errors
  };
}

export interface SortConfig {
  columnKey: string;
  direction: SortDirection;
}

export interface DerivedGridRow {
  row: any;
  sourceIndex: number;
}

interface SmritiItemDetailsGridProps {
  products: Product[];
  viewConfig?: ItemViewConfigState;
  commonFields?: any;
  entryMode?: MasterEntryMode;
  onRefreshProducts?: () => Promise<void>;
  onNotification?: (title: string, message: string, type?: "success" | "error") => void;
  onNavigateToItemViewConfig?: () => void;
  onNavigateToCommonFields?: () => void;
}

export const ItemDetailsGrid: React.FC<SmritiItemDetailsGridProps> = ({
  products = [],
  viewConfig,
  commonFields,
  entryMode = "add",
  onRefreshProducts,
  onNotification,
  onNavigateToItemViewConfig,
  onNavigateToCommonFields
}) => {
  const [dynamicDefinitions, setDynamicDefinitions] = useState<AttributeDefinition[]>([]);
  const [gridRows, setGridRows] = useState<any[]>([]);
  const [selectedRowIndices, setSelectedRowIndices] = useState<Set<number>>(new Set());
  const [viewMode, setViewMode] = useState<"grid" | "classic">(viewConfig?.viewMode || "grid");
  const [classicRecordIndex, setClassicRecordIndex] = useState<number>(0);
  const [activeMode, setActiveMode] = useState<MasterEntryMode>(entryMode);
  
  // Hover image preview
  const [hoverPreview, setHoverPreview] = useState<{ url: string; name: string; x: number; y: number } | null>(null);

  // Modals state
  const [isReplaceModalOpen, setIsReplaceModalOpen] = useState<boolean>(false);
  const [isCodeModalOpen, setIsCodeModalOpen] = useState<boolean>(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState<boolean>(false);
  const [isDataConfirmOpen, setIsDataConfirmOpen] = useState<boolean>(false);
  const [activeCodeTargetRow, setActiveCodeTargetRow] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [searchFilter, setSearchFilter] = useState<string>("");
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [visibilityVersion, setVisibilityVersion] = useState<number>(0);

  // Listen to global visibility changes
  useEffect(() => {
    const handleVisChange = () => setVisibilityVersion(v => v + 1);
    window.addEventListener("smriti_field_visibility_updated", handleVisChange);
    return () => window.removeEventListener("smriti_field_visibility_updated", handleVisChange);
  }, []);

  // Load backend attribute definitions
  useEffect(() => {
    let isMounted = true;
    apiFetchV1("/attributes/definitions").then(defs => {
      if (isMounted && Array.isArray(defs)) {
        setDynamicDefinitions(defs);
      }
    }).catch(() => {});
    return () => { isMounted = false; };
  }, []);

  // Initialize rows from products
  const populateRowsFromProducts = () => {
    if (products.length > 0) {
      const rows = products.map((p, idx) => ({
        _id: p.id || `row-${idx}`,
        code: p.code || "",
        name: p.name || "",
        imageName: (p as any).image_name || (p as any).imageName || (p as any).image || "",
        brand: p.brand || commonFields?.brand || "",
        styleCode: (p as any).style_code || (p as any).styleCode || "",
        colour: (p as any).colour || p.color || "",
        size: p.size || "",
        category: p.category || commonFields?.category || "Footwear",
        subCategory: (p as any).sub_category || commonFields?.subCategory || "",
        mrp: p.mrp || p.price || 0,
        price: p.price || 0,
        costPrice: p.costPrice || (p as any).cost_price || 0,
        gst_percentage: (p as any).gst_percentage || (p as any).gstPercentage || commonFields?.gstPercentage || 18,
        hsn_code: (p as any).hsn_code || (p as any).hsnCode || commonFields?.hsnCode || "",
        barcode: p.barcode || "",
        uom: (p as any).uom || commonFields?.uom || "Pair",
        a1: p.attributes?.a1 || p.attributes?.heels || "",
        a2: p.attributes?.a2 || p.attributes?.upperMaterial || "",
        a3: p.attributes?.a3 || p.attributes?.outsole || "",
        a4: p.attributes?.a4 || p.attributes?.gender || commonFields?.department || "",
        a5: p.attributes?.a5 || commonFields?.vendorCode || "",
        a6: p.attributes?.a6 || commonFields?.purchaseClass || "",
        a7: p.attributes?.a7 || "",
        a8: p.attributes?.a8 || "",
        a9: p.attributes?.a9 || "",
        hasTransactions: (p as any).has_transactions || Boolean(p.id && idx % 3 === 0)
      }));
      setGridRows(rows);
    }
  };

  useEffect(() => {
    if (activeMode === "add") {
      if (products.length > 0) {
        populateRowsFromProducts();
      } else {
        setGridRows([{
          _id: "row-0",
          code: "SMRT-001",
          barcode: "8901234567890",
          name: "Classic Leather Shoe",
          imageName: "shoe-classic-01",
          brand: commonFields?.brand || "SMRITI",
          styleCode: "CLS-101",
          colour: "Black",
          size: "8",
          category: commonFields?.category || "Footwear",
          subCategory: commonFields?.subCategory || "Formal",
          mrp: 2999,
          price: 2499,
          costPrice: 1200,
          gst_percentage: commonFields?.gstPercentage || "18",
          hsn_code: commonFields?.hsnCode || "6403",
          uom: commonFields?.uom || "Pair",
          a1: "Low Heel",
          a2: "Full-Grain Leather",
          a3: "TPR Sole",
          a4: commonFields?.department || "Men",
          a5: commonFields?.vendorCode || "VEND-101",
          a6: commonFields?.purchaseClass || "A-Class",
          a7: "",
          a8: "",
          a9: "",
          hasTransactions: false
        }]);
      }
    } else {
      setIsDataConfirmOpen(true);
    }
  }, [activeMode, products, commonFields]);

  const handleConfirmDataLoading = (loadAll: boolean) => {
    setIsDataConfirmOpen(false);
    if (loadAll) {
      populateRowsFromProducts();
    } else {
      setGridRows([]);
      onNotification?.("Filter Mode", "Apply search filter to load required item records.", "success");
    }
  };

  // Keyboard shortcut listeners (F1, F2, Ctrl+S)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F1") {
        e.preventDefault();
        setIsShortcutsModalOpen(true);
      } else if (e.key === "F2") {
        e.preventDefault();
        setActiveCodeTargetRow(0);
        setIsCodeModalOpen(true);
      } else if (e.ctrlKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSaveGridToDatabase();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [gridRows]);

  // Unified available fields
  const catalogFields = useMemo(() => {
    const customLabels = getCustomFieldLabels();
    return getUnifiedItemMasterFields(dynamicDefinitions).map(f => ({
      key: f.key,
      label: customLabels[f.key] || f.label
    }));
  }, [dynamicDefinitions]);

  // Active columns to show based on global visibility & viewConfig
  const visibleColumns = useMemo(() => {
    const globalVisibleKeys = getGlobalFieldVisibility();
    const customLabels = getCustomFieldLabels();

    if (globalVisibleKeys && globalVisibleKeys.length > 0) {
      return globalVisibleKeys.map(key => {
        const found = catalogFields.find(f => f.key === key);
        return found ? { key: found.key, label: customLabels[found.key] || found.label } : { key, label: key.toUpperCase() };
      });
    }

    if (viewConfig?.visibleColumns && viewConfig.visibleColumns.length > 0) {
      return viewConfig.visibleColumns.map(key => {
        const found = catalogFields.find(f => f.key === key);
        return found || { key, label: key.toUpperCase() };
      });
    }
    return catalogFields.slice(0, 13);
  }, [viewConfig, catalogFields, visibilityVersion]);

  const itemMasterExportColumns = useMemo<ExportColumnDefinition[]>(() => {
    return catalogFields.map(f => {
      let dt: any = "text";
      if (
        f.key === "mrp" ||
        f.key === "price" ||
        f.key === "sellingPrice" ||
        f.key === "buying_price" ||
        f.key === "buyingPrice" ||
        f.key === "cost_price" ||
        f.key === "costPrice" ||
        f.key === "dealerPrice"
      ) {
        dt = "currency";
      } else if (f.key === "gst_percentage" || f.key === "gstPercentage") {
        dt = "percentage";
      } else if (f.key === "stock" || f.key === "quantity" || f.key === "weight") {
        dt = "number";
      }
      return {
        key: f.key,
        label: f.label,
        datatype: dt,
        isSummary: dt === "currency" || dt === "number",
        isVisible: true
      };
    });
  }, [catalogFields]);

  const frozenCount = viewConfig?.frozenColumns ?? 2;

  // Numeric field keys for natural numerical sorting
  const NUMERIC_FIELD_KEYS = useMemo(() => new Set([
    "mrp",
    "price",
    "sellingPrice",
    "costPrice",
    "cost_price",
    "gst_percentage",
    "gstPercentage",
    "stock",
    "quantity",
    "discount",
    "tax"
  ]), []);

  const isNumericField = (key: string, val: any): boolean => {
    if (NUMERIC_FIELD_KEYS.has(key)) return true;
    if (typeof val === "number") return true;
    if (typeof val === "string" && val.trim() !== "" && !isNaN(Number(val.trim()))) {
      return true;
    }
    return false;
  };

  const compareGridValues = (a: any, b: any, key: string, direction: SortDirection): number => {
    const isAEmpty = a === null || a === undefined || a === "";
    const isBEmpty = b === null || b === undefined || b === "";

    if (isAEmpty && isBEmpty) return 0;
    // Empty values appear last in both ascending and descending order
    if (isAEmpty) return 1;
    if (isBEmpty) return -1;

    let comparison = 0;
    const isNumeric = isNumericField(key, a) && isNumericField(key, b);

    if (isNumeric) {
      const numA = typeof a === "number" ? a : parseFloat(String(a));
      const numB = typeof b === "number" ? b : parseFloat(String(b));
      comparison = numA - numB;
    } else {
      const strA = String(a).toLowerCase();
      const strB = String(b).toLowerCase();
      comparison = strA.localeCompare(strB, undefined, { numeric: true, sensitivity: "base" });
    }

    return direction === "asc" ? comparison : -comparison;
  };

  // Derived rows preserving the underlying source index for robust editing, selection, and mutations
  const derivedRows = useMemo<DerivedGridRow[]>(() => {
    return gridRows.map((row, sourceIndex) => ({ row, sourceIndex }));
  }, [gridRows]);

  // Combined Filtered & Sorted Rows
  const filteredSortedRows = useMemo<DerivedGridRow[]>(() => {
    let result = derivedRows;

    // 1. Global Search Filter
    if (searchFilter.trim()) {
      const q = searchFilter.trim().toLowerCase();
      result = result.filter(({ row }) => {
        return Object.entries(row).some(([k, v]) => {
          if (k.startsWith("_") || typeof v === "boolean" || typeof v === "object") return false;
          return String(v ?? "").toLowerCase().includes(q);
        });
      });
    }

    // 2. Per-Column Filters
    const activeColFilters = Object.entries(columnFilters).filter(([_, val]) => Boolean(val && val.trim()));
    if (activeColFilters.length > 0) {
      result = result.filter(({ row }) => {
        return activeColFilters.every(([colKey, filterVal]) => {
          const targetVal = String(row[colKey] ?? "").toLowerCase();
          return targetVal.includes(filterVal.trim().toLowerCase());
        });
      });
    }

    // 3. Per-Column Sort
    if (sortConfig) {
      const { columnKey, direction } = sortConfig;
      result = [...result].sort((a, b) => {
        return compareGridValues(a.row[columnKey], b.row[columnKey], columnKey, direction);
      });
    }

    return result;
  }, [derivedRows, searchFilter, columnFilters, sortConfig]);

  // Sorting & Filtering interaction handlers
  const handleToggleSort = (columnKey: string) => {
    setSortConfig(prev => {
      if (!prev || prev.columnKey !== columnKey) {
        return { columnKey, direction: "asc" };
      }
      if (prev.direction === "asc") {
        return { columnKey, direction: "desc" };
      }
      return null; // Cycle: none -> asc -> desc -> none
    });
  };

  const handleColumnFilterChange = (columnKey: string, value: string) => {
    setColumnFilters(prev => {
      const next = { ...prev };
      if (!value || !value.trim()) {
        delete next[columnKey];
      } else {
        next[columnKey] = value;
      }
      return next;
    });
  };

  const activeFilterCount = useMemo(() => {
    const colCount = Object.values(columnFilters).filter(v => Boolean(v && v.trim())).length;
    return colCount + (searchFilter.trim() ? 1 : 0);
  }, [columnFilters, searchFilter]);

  const handleClearAllFilters = () => {
    setColumnFilters({});
    setSearchFilter("");
    setSortConfig(null);
  };

  // Selection handlers respecting visible filtered rows
  const isAllFilteredSelected = filteredSortedRows.length > 0 && filteredSortedRows.every(item => selectedRowIndices.has(item.sourceIndex));
  const isSomeFilteredSelected = filteredSortedRows.some(item => selectedRowIndices.has(item.sourceIndex));

  const handleToggleSelectAll = () => {
    if (isAllFilteredSelected) {
      setSelectedRowIndices(prev => {
        const next = new Set(prev);
        filteredSortedRows.forEach(item => next.delete(item.sourceIndex));
        return next;
      });
    } else {
      setSelectedRowIndices(prev => {
        const next = new Set(prev);
        filteredSortedRows.forEach(item => next.add(item.sourceIndex));
        return next;
      });
    }
  };

  // Auto-clamp classic view record index
  useEffect(() => {
    if (classicRecordIndex >= filteredSortedRows.length && filteredSortedRows.length > 0) {
      setClassicRecordIndex(filteredSortedRows.length - 1);
    }
  }, [filteredSortedRows.length, classicRecordIndex]);

  // Uniqueness tracker for Stock No (code) and Barcode across Grid AND Database
  const duplicatesInfo = useMemo(() => {
    const codeCounts = new Map<string, number[]>();
    const barcodeCounts = new Map<string, number[]>();
    const duplicateDbCodes = new Map<number, string>();
    const duplicateDbBarcodes = new Map<number, string>();

    gridRows.forEach((r, idx) => {
      const codeVal = r.code && String(r.code).trim();
      const barcodeVal = r.barcode && String(r.barcode).trim();

      if (codeVal) {
        const c = codeVal.toUpperCase();
        const arr = codeCounts.get(c) || [];
        arr.push(idx);
        codeCounts.set(c, arr);

        // Check if exists in DB on another product
        const matchedDb = products.find(p => p.code?.toUpperCase() === c && p.id !== r._id);
        if (matchedDb) {
          duplicateDbCodes.set(idx, matchedDb.name);
        }
      }

      if (barcodeVal) {
        const b = barcodeVal.toUpperCase();
        const arr = barcodeCounts.get(b) || [];
        arr.push(idx);
        barcodeCounts.set(b, arr);

        // Check if exists in DB on another product
        const matchedDb = products.find(p => p.barcode?.toUpperCase() === b && p.id !== r._id);
        if (matchedDb) {
          duplicateDbBarcodes.set(idx, matchedDb.name);
        }
      }
    });

    const duplicateCodes = new Set<number>();
    const duplicateBarcodes = new Set<number>();

    codeCounts.forEach((indices) => {
      if (indices.length > 1) {
        indices.forEach(i => duplicateCodes.add(i));
      }
    });

    barcodeCounts.forEach((indices) => {
      if (indices.length > 1) {
        indices.forEach(i => duplicateBarcodes.add(i));
      }
    });

    return { duplicateCodes, duplicateBarcodes, duplicateDbCodes, duplicateDbBarcodes };
  }, [gridRows, products]);

  // Grid Cell Editor & Blur Duplicate Alert
  const handleCellChange = (rowIndex: number, columnKey: string, value: any) => {
    setGridRows(prev => {
      const next = [...prev];
      next[rowIndex] = { ...next[rowIndex], [columnKey]: value };
      return next;
    });
  };

  const handleCellBlur = (rowIndex: number, columnKey: string, value: string) => {
    if (!value || !value.trim()) return;
    const cleanVal = value.trim().toUpperCase();

    if (columnKey === "code" || columnKey === "sku") {
      // Check in-grid duplicate
      const conflictingGridIdx = gridRows.findIndex((r, idx) => idx !== rowIndex && String(r.code || "").trim().toUpperCase() === cleanVal);
      if (conflictingGridIdx !== -1) {
        onNotification?.(
          "Duplicate Stock No in Grid",
          `Stock No "${value}" is already used in Row #${conflictingGridIdx + 1}. Stock No must be unique.`,
          "error"
        );
        return;
      }

      // Check database duplicate
      const currentRow = gridRows[rowIndex];
      const conflictingDb = products.find(p => p.code?.toUpperCase() === cleanVal && p.id !== currentRow._id);
      if (conflictingDb) {
        onNotification?.(
          "Stock No Already Exists in Database",
          `Stock No "${value}" already belongs to existing product "${conflictingDb.name}". Please enter a unique Stock No.`,
          "error"
        );
      }
    } else if (columnKey === "barcode") {
      // Check in-grid duplicate
      const conflictingGridIdx = gridRows.findIndex((r, idx) => idx !== rowIndex && String(r.barcode || "").trim().toUpperCase() === cleanVal);
      if (conflictingGridIdx !== -1) {
        onNotification?.(
          "Duplicate Barcode in Grid",
          `Barcode "${value}" is already used in Row #${conflictingGridIdx + 1}. Barcode must be unique.`,
          "error"
        );
        return;
      }

      // Check database duplicate
      const currentRow = gridRows[rowIndex];
      const conflictingDb = products.find(p => p.barcode?.toUpperCase() === cleanVal && p.id !== currentRow._id);
      if (conflictingDb) {
        onNotification?.(
          "Barcode Already Exists in Database",
          `Barcode "${value}" is already assigned to existing product "${conflictingDb.name}". Please enter a unique Barcode.`,
          "error"
        );
      }
    }
  };

  const handleAddRow = () => {
    const newRow = {
      _id: `new-${Date.now()}`,
      code: `SMRT-${String(gridRows.length + 1).padStart(3, "0")}`,
      barcode: `890${Math.floor(1000000000 + Math.random() * 9000000000)}`,
      name: "New Product Item",
      imageName: "",
      brand: commonFields?.brand || "SMRITI",
      styleCode: "STYLE-01",
      colour: "Black",
      size: "M",
      category: commonFields?.category || "Footwear",
      subCategory: commonFields?.subCategory || "",
      mrp: 1999,
      price: 1499,
      costPrice: 800,
      gst_percentage: commonFields?.gstPercentage || "18",
      hsn_code: commonFields?.hsnCode || "6403",
      uom: commonFields?.uom || "Pair",
      a1: "",
      a2: "",
      a3: "",
      a4: commonFields?.department || "",
      a5: commonFields?.vendorCode || "",
      a6: commonFields?.purchaseClass || "",
      a7: "",
      a8: "",
      a9: "",
      hasTransactions: false
    };
    setGridRows(prev => [...prev, newRow]);
    onNotification?.("Row Added", "Added new blank record to matrix.", "success");
  };

  const handleDeleteRecords = () => {
    if (selectedRowIndices.size === 0) {
      onNotification?.("No Selection", "Please select item records to delete.", "error");
      return;
    }

    const selectedRows = gridRows.filter((_, idx) => selectedRowIndices.has(idx));
    const lockedTransactions = selectedRows.filter(r => r.hasTransactions);

    if (lockedTransactions.length > 0) {
      onNotification?.(
        "Transaction Guard Warning",
        `${lockedTransactions.length} item(s) have recorded sales transactions and cannot be hard-deleted. They will be deactivated/archived.`,
        "error"
      );
    }

    setGridRows(prev => prev.filter((_, idx) => !selectedRowIndices.has(idx)));
    setSelectedRowIndices(new Set());
    onNotification?.("Items Removed", `Deleted/deactivated ${selectedRows.length} item record(s).`, "success");
  };

  const handleDuplicateSelected = () => {
    if (selectedRowIndices.size === 0) {
      onNotification?.("No Selection", "Please select rows to duplicate.", "error");
      return;
    }
    const toDuplicate = gridRows.filter((_, idx) => selectedRowIndices.has(idx)).map(r => ({
      ...r,
      _id: `dup-${Date.now()}-${Math.random()}`,
      code: `${r.code}-COPY`,
      barcode: `890${Math.floor(1000000000 + Math.random() * 9000000000)}`,
      hasTransactions: false
    }));
    setGridRows(prev => [...prev, ...toDuplicate]);
    setSelectedRowIndices(new Set());
    onNotification?.("Duplicated", `Duplicated ${toDuplicate.length} rows.`, "success");
  };

  const handleGlobalReplace = (targetField: string, findText: string, replaceText: string, matchCase: boolean) => {
    setGridRows(prev => prev.map(row => {
      const updatedRow = { ...row };
      Object.keys(updatedRow).forEach(k => {
        if (targetField !== "ALL" && k !== targetField) return;
        const val = String(updatedRow[k] || "");
        if (!val) return;

        if (matchCase) {
          updatedRow[k] = val.split(findText).join(replaceText);
        } else {
          const regex = new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
          updatedRow[k] = val.replace(regex, replaceText);
        }
      });
      return updatedRow;
    }));
    onNotification?.("Replace Applied", `Replaced all instances of "${findText}" with "${replaceText}".`, "success");
  };

  const handleOpenCodeGenerator = (rowIndex: number) => {
    setActiveCodeTargetRow(rowIndex);
    setIsCodeModalOpen(true);
  };

  const handleApplyGeneratedCode = (sku: string, barcode: string) => {
    if (activeCodeTargetRow !== null && gridRows[activeCodeTargetRow]) {
      handleCellChange(activeCodeTargetRow, "code", sku);
      handleCellChange(activeCodeTargetRow, "barcode", barcode);
      onNotification?.("Code Applied", `Applied SKU ${sku} and Barcode ${barcode}`, "success");
    }
  };

  const handleSaveGridToDatabase = async () => {
    // 0. Validate that grid is not empty
    if (gridRows.length === 0) {
      onNotification?.("No Records", "There are no item records to save.", "error");
      return;
    }

    // 1. Validate required non-blank fields for every row
    for (let i = 0; i < gridRows.length; i++) {
      const row = gridRows[i];
      const valResult = validateRowRequiredFields(row);
      if (!valResult.isValid) {
        onNotification?.(
          "Validation Error — Required Fields Missing",
          `Row #${i + 1} has missing required fields: ${valResult.missingFields.join(", ")}. Stock No/SKU, Barcode, Product Name, MRP, Selling Price, GST Tax Rate, and HSN Code cannot be blank.`,
          "error"
        );
        return;
      }
    }

    // 2. Check in-grid duplicate Stock No
    if (duplicatesInfo.duplicateCodes.size > 0) {
      const firstIdx = Array.from(duplicatesInfo.duplicateCodes)[0];
      const conflictCode = gridRows[firstIdx]?.code;
      onNotification?.(
        "Duplicate Stock No Error",
        `Duplicate Stock No "${conflictCode}" detected in grid rows. Each product must have a unique Stock No.`,
        "error"
      );
      return;
    }

    // 3. Check in-grid duplicate Barcode
    if (duplicatesInfo.duplicateBarcodes.size > 0) {
      const firstIdx = Array.from(duplicatesInfo.duplicateBarcodes)[0];
      const conflictBarcode = gridRows[firstIdx]?.barcode;
      onNotification?.(
        "Duplicate Barcode Error",
        `Duplicate Barcode "${conflictBarcode}" detected in grid rows. Each product must have a unique Barcode.`,
        "error"
      );
      return;
    }

    // 4. Check database conflicts
    if (duplicatesInfo.duplicateDbCodes.size > 0) {
      const [idx, prodName] = Array.from(duplicatesInfo.duplicateDbCodes.entries())[0];
      const conflictCode = gridRows[idx]?.code;
      onNotification?.(
        "Stock No Already Exists in Database",
        `Stock No "${conflictCode}" in Row #${idx + 1} already belongs to existing product "${prodName}".`,
        "error"
      );
      return;
    }

    if (duplicatesInfo.duplicateDbBarcodes.size > 0) {
      const [idx, prodName] = Array.from(duplicatesInfo.duplicateDbBarcodes.entries())[0];
      const conflictBarcode = gridRows[idx]?.barcode;
      onNotification?.(
        "Barcode Already Exists in Database",
        `Barcode "${conflictBarcode}" in Row #${idx + 1} is already registered for product "${prodName}".`,
        "error"
      );
      return;
    }

    setIsSaving(true);
    try {
      // Commit to FastAPI transactional endpoint (PUT for existing, POST for new)
      for (let i = 0; i < gridRows.length; i++) {
        const row = gridRows[i];
        const rowNum = i + 1;
        const rawBp = row.buying_price !== undefined && row.buying_price !== null && String(row.buying_price).trim() !== ""
          ? row.buying_price
          : row.buyingPrice;
        const rawCp = row.cost_price !== undefined && row.cost_price !== null && String(row.cost_price).trim() !== ""
          ? row.cost_price
          : row.costPrice;

        const prodPayload = {
          code: String(row.code ?? "").trim(),
          barcode: String(row.barcode ?? "").trim(),
          name: String(row.name ?? "").trim(),
          primary_image_url: row.imageName && String(row.imageName).trim() ? String(row.imageName).trim() : null,
          brand: row.brand && String(row.brand).trim() ? String(row.brand).trim() : null,
          style_code: row.styleCode && String(row.styleCode).trim() ? String(row.styleCode).trim() : null,
          color: row.colour && String(row.colour).trim() ? String(row.colour).trim() : null,
          size: row.size && String(row.size).trim() ? String(row.size).trim() : null,
          category: row.category && String(row.category).trim() ? String(row.category).trim() : "Footwear",
          mrp: Number(row.mrp || 0),
          price: Number(row.price || 0),
          buying_price: rawBp !== null && rawBp !== undefined && String(rawBp).trim() !== "" ? Number(rawBp) : null,
          cost_price: rawCp !== null && rawCp !== undefined && String(rawCp).trim() !== "" ? Number(rawCp) : null,
          gst_percentage: Number(row.gst_percentage || 18),
          hsn_code: String(row.hsn_code ?? "").trim(),
          attributes: {
            image_name: row.imageName || "",
            a1: row.a1 || "",
            a2: row.a2 || "",
            a3: row.a3 || "",
            a4: row.a4 || "",
            a5: row.a5 || "",
            a6: row.a6 || "",
            a7: row.a7 || "",
            a8: row.a8 || "",
            a9: row.a9 || ""
          }
        };

        const isExisting = row._id && !String(row._id).startsWith("new-") && !String(row._id).startsWith("row-");
        const matchedProduct = products.find(p => p.id === row._id || p.code === row.code);

        try {
          if (isExisting || (activeMode === "edit" && matchedProduct?.id)) {
            const targetId = matchedProduct?.id || row._id;
            await apiFetchV1(`/products/${targetId}`, {
              method: "PUT",
              body: JSON.stringify(prodPayload)
            });
          } else {
            await apiFetchV1("/products/", {
              method: "POST",
              body: JSON.stringify(prodPayload)
            });
          }
        } catch (err: any) {
          const rawMsg = err?.message || "Validation Error";
          let friendlyMsg = rawMsg;
          if (rawMsg.includes("code already exists") || rawMsg.includes("duplicate key value violates unique constraint") && rawMsg.includes("code")) {
            friendlyMsg = `Stock No "${row.code}" already exists in the database. Please provide a unique Stock No.`;
          } else if (rawMsg.includes("barcode already exists") || rawMsg.includes("duplicate key value violates unique constraint") && rawMsg.includes("barcode")) {
            friendlyMsg = `Barcode "${row.barcode}" is already registered in the database for another item. Barcodes must be unique.`;
          } else if (rawMsg.includes("401") || rawMsg.includes("Token") || rawMsg.includes("Unauthorized")) {
            friendlyMsg = "Your user session has expired or requires login. Please re-authenticate.";
          }
          throw new Error(`Row #${rowNum} [${row.code || 'No Code'}]: ${friendlyMsg}`);
        }
      }

      onNotification?.("Saved Successfully", `Successfully saved ${gridRows.length} item${gridRows.length > 1 ? 's' : ''} to database.`, "success");
      if (onRefreshProducts) await onRefreshProducts();
    } catch (err: any) {
      onNotification?.("Unable to Save Items", err.message || "Failed to commit item records to database.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrintManifest = () => {
    window.print();
  };

  const currentClassicItem = filteredSortedRows[classicRecordIndex] || filteredSortedRows[0];
  const currentClassicRecord = currentClassicItem ? currentClassicItem.row : {};
  const currentClassicSourceIndex = currentClassicItem ? currentClassicItem.sourceIndex : 0;
  const currentClassicImageUrl = resolveProductImageUrl(currentClassicRecord.imageName);

  return (
    <div className="h-full flex flex-col bg-[#f7f9fb] dark:bg-[#191c1e] text-[#191c1e] dark:text-[#eff1f3] font-sans overflow-hidden">
      
      {/* Top Header Mode Bar */}
      <div className="px-6 py-3 border-b border-[#c6c6cd] dark:border-[#45464d] bg-white dark:bg-[#131b2e] flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-xs">
        
        {/* Left: Mode Tabs & Title */}
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-[#e9edff] dark:bg-[#1d3054] p-1 rounded-lg border border-[#c4d2ff] dark:border-[#434654]">
            <button
              type="button"
              onClick={() => setActiveMode("add")}
              className={`px-3 py-1 rounded text-xs font-bold transition ${
                activeMode === "add"
                  ? "bg-[#0052cc] text-white shadow-xs"
                  : "text-[#515f74] dark:text-[#bec6e0] hover:text-[#0052cc]"
              }`}
            >
              Adding Item Master
            </button>
            <button
              type="button"
              onClick={() => setActiveMode("edit")}
              className={`px-3 py-1 rounded text-xs font-bold transition ${
                activeMode === "edit"
                  ? "bg-[#0052cc] text-white shadow-xs"
                  : "text-[#515f74] dark:text-[#bec6e0] hover:text-[#0052cc]"
              }`}
            >
              Editing Item Master
            </button>
            <button
              type="button"
              onClick={() => setActiveMode("delete")}
              className={`px-3 py-1 rounded text-xs font-bold transition ${
                activeMode === "delete"
                  ? "bg-[#ba1a1a] text-white shadow-xs"
                  : "text-[#515f74] dark:text-[#bec6e0] hover:text-[#ba1a1a]"
              }`}
            >
              Deleting Item Master
            </button>
          </div>

          <div className="flex items-center bg-[#f2f4f6] dark:bg-[#191c1e] p-1 rounded-lg border border-[#c6c6cd] dark:border-[#45464d]">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`px-3 py-1 rounded text-xs font-bold transition flex items-center gap-1 ${
                viewMode === "grid"
                  ? "bg-white dark:bg-[#2d3133] text-[#0052cc] dark:text-[#dae2ff] shadow-xs"
                  : "text-[#515f74] dark:text-[#bec6e0]"
              }`}
            >
              <LayoutGrid size={13} />
              Grid View
            </button>
            <button
              type="button"
              onClick={() => setViewMode("classic")}
              className={`px-3 py-1 rounded text-xs font-bold transition flex items-center gap-1 ${
                viewMode === "classic"
                  ? "bg-white dark:bg-[#2d3133] text-[#0052cc] dark:text-[#dae2ff] shadow-xs"
                  : "text-[#515f74] dark:text-[#bec6e0]"
              }`}
            >
              <FileText size={13} />
              Classic View
            </button>
          </div>
        </div>

        {/* Right Search & Tools */}
        <div className="flex items-center gap-2">
          <div className="relative w-52">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#76777d]" />
            <input
              type="text"
              value={searchFilter}
              onChange={e => setSearchFilter(e.target.value)}
              placeholder="Filter items..."
              aria-label="Filter items globally"
              className="w-full pl-8 pr-7 py-1 bg-[#f2f4f6] dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded text-xs outline-none focus:border-[#0052cc]"
            />
            {searchFilter && (
              <button
                type="button"
                onClick={() => setSearchFilter("")}
                aria-label="Clear global search"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#76777d] hover:text-[#ba1a1a]"
              >
                <X size={12} />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsShortcutsModalOpen(true)}
            title="Help / Keyboard Shortcuts (F1)"
            className="p-1.5 border border-[#c6c6cd] dark:border-[#45464d] rounded hover:bg-[#eceef0] dark:hover:bg-[#2d3133] transition"
          >
            <HelpCircle size={15} className="text-[#0052cc]" />
          </button>
        </div>
      </div>

      {/* Common Fields Context Banner */}
      {commonFields && (
        <div className="px-6 py-2 bg-[#e9edff] dark:bg-[#1d3054] border-b border-[#c4d2ff] dark:border-[#434654] flex flex-wrap items-center justify-between text-xs">
          <div className="flex items-center gap-4">
            <span className="font-bold text-[#003d9b] dark:text-[#b2c5ff] uppercase text-[10px]">Session Baseline Defaults:</span>
            {commonFields.category && <span>Category: <strong>{commonFields.category}</strong></span>}
            {commonFields.brand && <span>Brand: <strong>{commonFields.brand}</strong></span>}
            {commonFields.vendorCode && <span>Vendor: <strong>{commonFields.vendorCode}</strong></span>}
            {commonFields.gstPercentage && <span>GST: <strong>{commonFields.gstPercentage}%</strong></span>}
            {commonFields.hsnCode && <span>HSN: <strong>{commonFields.hsnCode}</strong></span>}
          </div>
          {onNavigateToCommonFields && (
            <button
              type="button"
              onClick={onNavigateToCommonFields}
              className="text-[#0052cc] dark:text-[#dae2ff] font-bold text-[11px] hover:underline"
            >
              Edit Common Fields (Alt+2) →
            </button>
          )}
        </div>
      )}

      {/* Main Workspace Canvas */}
      <div className="flex-1 p-4 overflow-hidden min-h-0">
        
        {viewMode === "grid" ? (
          <div className="h-full flex flex-col bg-white dark:bg-[#2d3133] border border-[#c6c6cd] dark:border-[#45464d] rounded-xl overflow-hidden shadow-xs">
            
            {/* Grid Header Info Bar */}
            <div className="px-4 py-2 border-b border-[#eceef0] dark:border-[#45464d] bg-[#f2f4f6] dark:bg-[#131b2e] flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <span className="font-mono font-bold text-[#515f74] dark:text-[#bec6e0] text-[11px]">
                  {filteredSortedRows.length} {filteredSortedRows.length !== gridRows.length ? `OF ${gridRows.length} ` : ""}RECORDS DISPLAYED
                </span>
                <span className="text-[11px] text-[#76777d]">
                  ({frozenCount} Frozen Column{frozenCount !== 1 ? "s" : ""})
                </span>
                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAllFilters}
                    className="px-2 py-0.5 bg-[#ffdad6] dark:bg-[#93000a]/40 text-[#ba1a1a] dark:text-[#ffb4ab] rounded font-bold text-[10px] hover:bg-[#ba1a1a] hover:text-white transition flex items-center gap-1"
                  >
                    <Filter size={10} />
                    Clear Filters ({activeFilterCount})
                  </button>
                )}
              </div>

              {/* Shortcuts hint */}
              <div className="hidden md:flex items-center gap-3 font-mono text-[10px] text-[#76777d]">
                <span><kbd className="bg-white dark:bg-[#191c1e] px-1.5 py-0.5 border border-[#c6c6cd] rounded font-bold">F1</kbd> Help</span>
                <span><kbd className="bg-white dark:bg-[#191c1e] px-1.5 py-0.5 border border-[#c6c6cd] rounded font-bold">F2</kbd> Codes</span>
                <span><kbd className="bg-white dark:bg-[#191c1e] px-1.5 py-0.5 border border-[#c6c6cd] rounded font-bold">Ctrl+S</kbd> Ok</span>
              </div>
            </div>

            {/* High Density Table */}
            <div className="flex-1 overflow-auto bg-white dark:bg-[#191c1e]">
              <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
                <thead className="sticky top-0 bg-[#f2f4f6] dark:bg-[#131b2e] border-b border-[#c6c6cd] dark:border-[#45464d] z-20">
                  <tr>
                    <th className="p-2 w-10 text-center border-r border-[#c6c6cd] dark:border-[#45464d] sticky left-0 z-30 bg-[#f2f4f6] dark:bg-[#131b2e] align-top">
                      <div className="flex flex-col items-center gap-1.5 pt-0.5">
                        <input
                          type="checkbox"
                          aria-label="Select all visible items"
                          checked={isAllFilteredSelected}
                          ref={el => {
                            if (el) el.indeterminate = isSomeFilteredSelected && !isAllFilteredSelected;
                          }}
                          onChange={handleToggleSelectAll}
                          className="rounded"
                        />
                        {activeFilterCount > 0 && (
                          <button
                            type="button"
                            onClick={handleClearAllFilters}
                            title="Clear all filters and sorts"
                            className="text-[9px] font-bold text-[#ba1a1a] hover:underline"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </th>
                    <th className="p-2 w-12 text-center border-r border-[#c6c6cd] dark:border-[#45464d] font-mono text-[10px] text-[#76777d] align-top pt-2">
                      #
                    </th>
                    {visibleColumns.map((col, cIdx) => {
                      const isFrozen = cIdx < frozenCount;
                      const isSorted = sortConfig?.columnKey === col.key;
                      const sortDirection = isSorted ? sortConfig.direction : null;
                      const ariaSortValue = sortDirection === "asc" ? "ascending" : sortDirection === "desc" ? "descending" : "none";
                      const filterValue = columnFilters[col.key] || "";
                      const isRequiredCol = isItemFieldRequired(col.key);

                      return (
                        <th
                          key={col.key}
                          aria-sort={ariaSortValue}
                          className={`p-2 font-bold text-[#515f74] dark:text-[#bec6e0] uppercase text-[10px] border-r border-[#c6c6cd] dark:border-[#45464d] min-w-[130px] ${
                            isFrozen ? "sticky left-[88px] z-30 bg-[#f2f4f6] dark:bg-[#131b2e] shadow-xs" : ""
                          }`}
                        >
                          <div className="flex flex-col gap-1">
                            <button
                              type="button"
                              onClick={() => handleToggleSort(col.key)}
                              title={`Click to sort by ${col.label}${isRequiredCol ? ' (Required)' : ''}`}
                              className="flex items-center justify-between gap-1 w-full text-left font-bold uppercase tracking-wider hover:text-[#0052cc] dark:hover:text-[#dae2ff] transition select-none group"
                            >
                              <span className="truncate flex items-center">
                                {col.label}
                                {isRequiredCol && (
                                  <span className="text-[#ba1a1a] dark:text-[#ffb4ab] ml-1 font-black" title="Required field">*</span>
                                )}
                              </span>
                              <span className="shrink-0">
                                {sortDirection === "asc" ? (
                                  <ArrowUp size={12} className="text-[#0052cc] dark:text-[#8cb4ff]" aria-hidden="true" />
                                ) : sortDirection === "desc" ? (
                                  <ArrowDown size={12} className="text-[#0052cc] dark:text-[#8cb4ff]" aria-hidden="true" />
                                ) : (
                                  <ArrowUpDown size={11} className="text-[#76777d] opacity-30 group-hover:opacity-100" aria-hidden="true" />
                                )}
                              </span>
                            </button>
                            <div className="relative">
                              <input
                                type="text"
                                aria-label={`Filter by ${col.label}`}
                                placeholder="Filter..."
                                value={filterValue}
                                onChange={e => handleColumnFilterChange(col.key, e.target.value)}
                                className="w-full pl-2 pr-5 py-0.5 text-[10px] font-normal normal-case bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded outline-none focus:border-[#0052cc] dark:focus:border-[#8cb4ff] text-[#191c1e] dark:text-[#eff1f3] placeholder:text-[#76777d]"
                              />
                              {filterValue && (
                                <button
                                  type="button"
                                  onClick={() => handleColumnFilterChange(col.key, "")}
                                  aria-label={`Clear filter for ${col.label}`}
                                  className="absolute right-1 top-1/2 -translate-y-1/2 text-[#76777d] hover:text-[#ba1a1a] p-0.5 rounded"
                                  title="Clear column filter"
                                >
                                  <X size={10} />
                                </button>
                              )}
                            </div>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eceef0] dark:divide-[#2d3133]">
                  {filteredSortedRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={visibleColumns.length + 2}
                        className="p-8 text-center text-xs text-[#76777d] font-mono"
                      >
                        No item records matching the current filter criteria.
                        {activeFilterCount > 0 && (
                          <div className="mt-2">
                            <button
                              type="button"
                              onClick={handleClearAllFilters}
                              className="text-[#0052cc] dark:text-[#dae2ff] font-bold hover:underline"
                            >
                              Clear all active filters ({activeFilterCount})
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ) : (
                    filteredSortedRows.map((item, displayIdx) => {
                      const { row, sourceIndex } = item;
                      const isSelected = selectedRowIndices.has(sourceIndex);

                      return (
                        <tr
                          key={row._id || sourceIndex}
                          className={`transition ${
                            isSelected ? "bg-[#d5e3fd]/40" : "hover:bg-[#f7f9fb] dark:hover:bg-[#2d3133]"
                          }`}
                        >
                          <td className="p-2 text-center border-r border-[#eceef0] dark:border-[#2d3133] sticky left-0 z-10 bg-inherit">
                            <input
                              type="checkbox"
                              aria-label={`Select row ${displayIdx + 1}`}
                              checked={isSelected}
                              onChange={() => {
                                setSelectedRowIndices(prev => {
                                  const next = new Set(prev);
                                  if (next.has(sourceIndex)) next.delete(sourceIndex);
                                  else next.add(sourceIndex);
                                  return next;
                                });
                              }}
                              className="rounded"
                            />
                          </td>
                          <td className="p-2 text-center font-mono text-[10px] text-[#76777d] border-r border-[#eceef0] dark:border-[#2d3133]">
                            {displayIdx + 1}
                          </td>
                          {visibleColumns.map((col, cIdx) => {
                            const isFrozen = cIdx < frozenCount;
                            const isCode = col.key === "code" || col.key === "sku" || col.key === "stockNo";
                            const isBarcode = col.key === "barcode";
                            const isImage = col.key === "imageName" || col.key === "image";
                            const isNonEditableInEditMode = activeMode === "edit" && (isCode || isBarcode);
                            const isDuplicateCode = isCode && (duplicatesInfo.duplicateCodes.has(sourceIndex) || duplicatesInfo.duplicateDbCodes.has(sourceIndex));
                            const isDuplicateBarcode = isBarcode && (duplicatesInfo.duplicateBarcodes.has(sourceIndex) || duplicatesInfo.duplicateDbBarcodes.has(sourceIndex));
                            const isDuplicate = isDuplicateCode || isDuplicateBarcode;
                            const val = row[col.key] ?? "";
                            const dbConflictMsg = isCode ? duplicatesInfo.duplicateDbCodes.get(sourceIndex) : duplicatesInfo.duplicateDbBarcodes.get(sourceIndex);

                            const isRequiredField = isItemFieldRequired(col.key);
                            const isBlankValue = isRequiredField && (val === null || val === undefined || String(val).trim() === "");

                            return (
                              <td
                                key={col.key}
                                className={`p-1.5 border-r border-[#eceef0] dark:border-[#2d3133] ${
                                  isFrozen ? "sticky left-[88px] z-10 bg-inherit shadow-xs" : ""
                                } ${
                                  isDuplicate
                                    ? "bg-[#ffdad6] dark:bg-[#93000a]/40"
                                    : isBlankValue
                                    ? "bg-[#ffdad6]/20 dark:bg-[#93000a]/20"
                                    : isNonEditableInEditMode
                                    ? "bg-[#e0e3e5] dark:bg-[#2d3133]/60"
                                    : ""
                                }`}
                              >
                                <div className="flex items-center gap-1">
                                  <input
                                    type="text"
                                    readOnly={isNonEditableInEditMode || activeMode === "delete"}
                                    title={
                                      isNonEditableInEditMode
                                        ? "SKU and Barcode are permanent identifiers and cannot be edited for existing items."
                                        : isBlankValue
                                        ? `${col.label} is required and cannot be blank.`
                                        : undefined
                                    }
                                    value={val}
                                    onChange={e => handleCellChange(sourceIndex, col.key, e.target.value)}
                                    onBlur={e => handleCellBlur(sourceIndex, col.key, e.target.value)}
                                    className={`w-full px-2 py-1 rounded outline-none text-xs font-semibold ${
                                      isDuplicate
                                        ? "text-[#ba1a1a] dark:text-[#ffb4ab] font-bold border border-[#ba1a1a]"
                                        : isBlankValue
                                        ? "border border-[#ba1a1a] bg-[#ffdad6]/40 text-[#ba1a1a] dark:text-[#ffb4ab] placeholder:text-[#ba1a1a]"
                                        : isNonEditableInEditMode
                                        ? "bg-transparent text-[#515f74] dark:text-[#bec6e0] cursor-not-allowed font-mono font-bold"
                                        : "bg-transparent hover:bg-white dark:hover:bg-[#191c1e] focus:bg-white dark:focus:bg-[#191c1e] border border-transparent focus:border-[#0052cc]"
                                    }`}
                                  />
                                  {isDuplicate && (
                                    <span
                                      title={
                                        dbConflictMsg
                                          ? `Already registered in database for '${dbConflictMsg}'`
                                          : isDuplicateCode
                                          ? "Duplicate Stock No detected in grid!"
                                          : "Duplicate Barcode detected in grid!"
                                      }
                                      className="text-[#ba1a1a] px-1 font-bold animate-pulse cursor-help"
                                    >
                                      ⚠️
                                    </span>
                                  )}
                                  {isCode && activeMode === "add" && !isDuplicate && (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenCodeGenerator(sourceIndex)}
                                      title="Auto-Generate SKU & Barcode (F2)"
                                      className="p-1 text-[#0052cc] hover:bg-[#e9edff] rounded"
                                    >
                                      <Sparkles size={13} />
                                    </button>
                                  )}
                                  {isImage && Boolean(val) && (
                                    <div
                                      onMouseEnter={(e) => {
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        setHoverPreview({
                                          url: resolveProductImageUrl(val),
                                          name: String(val),
                                          x: rect.right + 10,
                                          y: rect.top - 40
                                        });
                                      }}
                                      onMouseLeave={() => setHoverPreview(null)}
                                      className="cursor-pointer p-1 text-[#0052cc] hover:bg-[#e9edff] rounded"
                                      title="Hover to preview resolved image"
                                    >
                                      <ImageIcon size={13} />
                                    </div>
                                  )}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

          </div>
        ) : (
          /* Classic Single-Record View */
          <div className="h-full overflow-y-auto bg-white dark:bg-[#2d3133] border border-[#c6c6cd] dark:border-[#45464d] rounded-xl p-6 shadow-xs space-y-6">
            <div className="flex justify-between items-center border-b border-[#eceef0] dark:border-[#45464d] pb-4">
              <div>
                <h2 className="text-base font-bold text-[#003d9b] dark:text-[#b2c5ff]">
                  Item Details — Classic View
                </h2>
                <p className="text-xs text-[#76777d]">Single-record inspector &amp; detailed attribute auditing.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={classicRecordIndex === 0}
                  onClick={() => setClassicRecordIndex(prev => Math.max(0, prev - 1))}
                  className="p-1.5 border border-[#c6c6cd] dark:border-[#45464d] rounded hover:bg-[#eceef0] disabled:opacity-30"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="font-mono text-xs font-bold px-2">
                  Record {filteredSortedRows.length > 0 ? classicRecordIndex + 1 : 0} of {filteredSortedRows.length}
                </span>
                <button
                  type="button"
                  disabled={classicRecordIndex >= filteredSortedRows.length - 1}
                  onClick={() => setClassicRecordIndex(prev => Math.min(filteredSortedRows.length - 1, prev + 1))}
                  className="p-1.5 border border-[#c6c6cd] dark:border-[#45464d] rounded hover:bg-[#eceef0] disabled:opacity-30"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            {/* Form Sections */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-xs">
              
              {/* Basic Details */}
              <div className="space-y-3 bg-[#f7f9fb] dark:bg-[#191c1e] p-4 rounded-xl border border-[#c6c6cd] dark:border-[#45464d]">
                <h3 className="font-bold uppercase tracking-wider text-[#003d9b] dark:text-[#b2c5ff] text-[10px]">1. Identification</h3>
                <div>
                  <label className="text-[#515f74] font-bold text-[10px] block mb-1">
                    Stock No / SKU <span className="text-[#ba1a1a] dark:text-[#ffb4ab] font-black">*</span>
                  </label>
                  <input
                    type="text"
                    readOnly={activeMode === "edit" || activeMode === "delete"}
                    title={activeMode === "edit" ? "SKU is a permanent identifier and cannot be modified." : undefined}
                    value={currentClassicRecord.code || ""}
                    onChange={e => handleCellChange(currentClassicSourceIndex, "code", e.target.value)}
                    className={`w-full p-2 border rounded font-mono font-bold ${
                      !currentClassicRecord.code?.toString().trim()
                        ? "border-[#ba1a1a] bg-[#ffdad6]/30 text-[#ba1a1a]"
                        : "border-[#c6c6cd]"
                    } ${
                      activeMode === "edit" ? "bg-[#e0e3e5] dark:bg-[#2d3133] cursor-not-allowed text-[#515f74] dark:text-[#bec6e0]" : "bg-white dark:bg-[#2d3133]"
                    }`}
                  />
                  {!currentClassicRecord.code?.toString().trim() && (
                    <span className="text-[#ba1a1a] dark:text-[#ffb4ab] text-[10px] font-semibold block mt-1">
                      Stock No / SKU is required and cannot be blank.
                    </span>
                  )}
                </div>
                <div>
                  <label className="text-[#515f74] font-bold text-[10px] block mb-1">
                    Barcode (EAN-13) <span className="text-[#ba1a1a] dark:text-[#ffb4ab] font-black">*</span>
                  </label>
                  <input
                    type="text"
                    readOnly={activeMode === "edit" || activeMode === "delete"}
                    title={activeMode === "edit" ? "Barcode is a permanent identifier and cannot be modified." : undefined}
                    value={currentClassicRecord.barcode || ""}
                    onChange={e => handleCellChange(currentClassicSourceIndex, "barcode", e.target.value)}
                    className={`w-full p-2 border rounded font-mono font-bold ${
                      !currentClassicRecord.barcode?.toString().trim()
                        ? "border-[#ba1a1a] bg-[#ffdad6]/30 text-[#ba1a1a]"
                        : "border-[#c6c6cd]"
                    } ${
                      activeMode === "edit" ? "bg-[#e0e3e5] dark:bg-[#2d3133] cursor-not-allowed text-[#515f74] dark:text-[#bec6e0]" : "bg-white dark:bg-[#2d3133]"
                    }`}
                  />
                  {!currentClassicRecord.barcode?.toString().trim() && (
                    <span className="text-[#ba1a1a] dark:text-[#ffb4ab] text-[10px] font-semibold block mt-1">
                      Barcode is required and cannot be blank.
                    </span>
                  )}
                </div>
                <div>
                  <label className="text-[#515f74] font-bold text-[10px] block mb-1">
                    Product Title / Name <span className="text-[#ba1a1a] dark:text-[#ffb4ab] font-black">*</span>
                  </label>
                  <input
                    type="text"
                    value={currentClassicRecord.name || ""}
                    onChange={e => handleCellChange(currentClassicSourceIndex, "name", e.target.value)}
                    className={`w-full p-2 bg-white dark:bg-[#2d3133] border rounded font-bold ${
                      !currentClassicRecord.name?.toString().trim()
                        ? "border-[#ba1a1a] bg-[#ffdad6]/30 text-[#ba1a1a]"
                        : "border-[#c6c6cd]"
                    }`}
                  />
                  {!currentClassicRecord.name?.toString().trim() && (
                    <span className="text-[#ba1a1a] dark:text-[#ffb4ab] text-[10px] font-semibold block mt-1">
                      Product Name is required and cannot be blank.
                    </span>
                  )}
                </div>
                <div>
                  <label className="text-[#515f74] font-bold text-[10px] block mb-1">
                    HSN Code <span className="text-[#ba1a1a] dark:text-[#ffb4ab] font-black">*</span>
                  </label>
                  <input
                    type="text"
                    value={currentClassicRecord.hsn_code || ""}
                    onChange={e => handleCellChange(currentClassicSourceIndex, "hsn_code", e.target.value)}
                    className={`w-full p-2 bg-white dark:bg-[#2d3133] border rounded font-mono font-bold ${
                      !currentClassicRecord.hsn_code?.toString().trim()
                        ? "border-[#ba1a1a] bg-[#ffdad6]/30 text-[#ba1a1a]"
                        : "border-[#c6c6cd]"
                    }`}
                  />
                  {!currentClassicRecord.hsn_code?.toString().trim() && (
                    <span className="text-[#ba1a1a] dark:text-[#ffb4ab] text-[10px] font-semibold block mt-1">
                      HSN Code is required and cannot be blank.
                    </span>
                  )}
                </div>
                <div>
                  <label className="text-[#515f74] font-bold text-[10px] block mb-1">Image Filename (Optional)</label>
                  <input
                    type="text"
                    value={currentClassicRecord.imageName || ""}
                    onChange={e => handleCellChange(currentClassicSourceIndex, "imageName", e.target.value)}
                    className="w-full p-2 bg-white dark:bg-[#2d3133] border border-[#c6c6cd] rounded font-mono text-xs"
                  />
                </div>
              </div>

              {/* Pricing & Tax */}
              <div className="space-y-3 bg-[#f7f9fb] dark:bg-[#191c1e] p-4 rounded-xl border border-[#c6c6cd] dark:border-[#45464d]">
                <h3 className="font-bold uppercase tracking-wider text-[#003d9b] dark:text-[#b2c5ff] text-[10px]">2. Pricing &amp; Taxes</h3>
                <div>
                  <label className="text-[#515f74] font-bold text-[10px] block mb-1">
                    Buying Price {!isExemptNonStockItem(currentClassicRecord) && <span className="text-[#ba1a1a] dark:text-[#ffb4ab] font-black">*</span>}
                  </label>
                  <input
                    type="number"
                    value={currentClassicRecord.buyingPrice !== undefined && currentClassicRecord.buyingPrice !== null ? currentClassicRecord.buyingPrice : (currentClassicRecord.buying_price ?? "")}
                    onChange={e => {
                      const val = e.target.value === "" ? "" : Number(e.target.value);
                      handleCellChange(currentClassicSourceIndex, "buyingPrice", val);
                      handleCellChange(currentClassicSourceIndex, "buying_price", val);
                    }}
                    className={`w-full p-2 bg-white dark:bg-[#2d3133] border rounded font-mono font-bold ${
                      !isExemptNonStockItem(currentClassicRecord) && (Number(currentClassicRecord.buyingPrice || currentClassicRecord.buying_price) <= 0 || isNaN(Number(currentClassicRecord.buyingPrice || currentClassicRecord.buying_price)))
                        ? "border-[#ba1a1a] bg-[#ffdad6]/30 text-[#ba1a1a]"
                        : "border-[#c6c6cd]"
                    }`}
                  />
                  {!isExemptNonStockItem(currentClassicRecord) && (Number(currentClassicRecord.buyingPrice || currentClassicRecord.buying_price) <= 0 || isNaN(Number(currentClassicRecord.buyingPrice || currentClassicRecord.buying_price))) && (
                    <span className="text-[#ba1a1a] dark:text-[#ffb4ab] text-[10px] font-semibold block mt-1">
                      Buying Price is required and must be greater than 0.
                    </span>
                  )}
                </div>
                <div>
                  <label className="text-[#515f74] font-bold text-[10px] block mb-1">
                    Cost Price {!isExemptNonStockItem(currentClassicRecord) && <span className="text-[#ba1a1a] dark:text-[#ffb4ab] font-black">*</span>}
                  </label>
                  <input
                    type="number"
                    value={currentClassicRecord.costPrice !== undefined && currentClassicRecord.costPrice !== null ? currentClassicRecord.costPrice : (currentClassicRecord.cost_price ?? "")}
                    onChange={e => {
                      const val = e.target.value === "" ? "" : Number(e.target.value);
                      handleCellChange(currentClassicSourceIndex, "costPrice", val);
                      handleCellChange(currentClassicSourceIndex, "cost_price", val);
                    }}
                    className={`w-full p-2 bg-white dark:bg-[#2d3133] border rounded font-mono font-bold ${
                      !isExemptNonStockItem(currentClassicRecord) && (Number(currentClassicRecord.costPrice || currentClassicRecord.cost_price) <= 0 || isNaN(Number(currentClassicRecord.costPrice || currentClassicRecord.cost_price)) || Number(currentClassicRecord.costPrice || currentClassicRecord.cost_price) > Number(currentClassicRecord.buyingPrice || currentClassicRecord.buying_price))
                        ? "border-[#ba1a1a] bg-[#ffdad6]/30 text-[#ba1a1a]"
                        : "border-[#c6c6cd]"
                    }`}
                  />
                  {!isExemptNonStockItem(currentClassicRecord) && (Number(currentClassicRecord.costPrice || currentClassicRecord.cost_price) <= 0 || isNaN(Number(currentClassicRecord.costPrice || currentClassicRecord.cost_price))) ? (
                    <span className="text-[#ba1a1a] dark:text-[#ffb4ab] text-[10px] font-semibold block mt-1">
                      Cost Price is required and must be greater than 0.
                    </span>
                  ) : !isExemptNonStockItem(currentClassicRecord) && Number(currentClassicRecord.costPrice || currentClassicRecord.cost_price) > Number(currentClassicRecord.buyingPrice || currentClassicRecord.buying_price) ? (
                    <span className="text-[#ba1a1a] dark:text-[#ffb4ab] text-[10px] font-semibold block mt-1">
                      Cost Price ({Number(currentClassicRecord.costPrice || currentClassicRecord.cost_price)}) must be less than or equal to Buying Price ({Number(currentClassicRecord.buyingPrice || currentClassicRecord.buying_price)}).
                    </span>
                  ) : null}
                </div>
                <div>
                  <label className="text-[#515f74] font-bold text-[10px] block mb-1">
                    Selling Price <span className="text-[#ba1a1a] dark:text-[#ffb4ab] font-black">*</span>
                  </label>
                  <input
                    type="number"
                    value={currentClassicRecord.price ?? ""}
                    onChange={e => handleCellChange(currentClassicSourceIndex, "price", e.target.value === "" ? "" : Number(e.target.value))}
                    className={`w-full p-2 bg-white dark:bg-[#2d3133] border rounded font-mono font-bold text-[#0c9488] ${
                      currentClassicRecord.price === "" || currentClassicRecord.price === null || currentClassicRecord.price === undefined || Number(currentClassicRecord.price) < 0 || isNaN(Number(currentClassicRecord.price))
                        ? "border-[#ba1a1a] bg-[#ffdad6]/30 text-[#ba1a1a]"
                        : "border-[#c6c6cd]"
                    }`}
                  />
                  {(currentClassicRecord.price === "" || currentClassicRecord.price === null || currentClassicRecord.price === undefined || Number(currentClassicRecord.price) < 0 || isNaN(Number(currentClassicRecord.price))) && (
                    <span className="text-[#ba1a1a] dark:text-[#ffb4ab] text-[10px] font-semibold block mt-1">
                      Selling Price is required and must be greater than or equal to 0.
                    </span>
                  )}
                </div>
                <div>
                  <label className="text-[#515f74] font-bold text-[10px] block mb-1">
                    MRP <span className="text-[#ba1a1a] dark:text-[#ffb4ab] font-black">*</span>
                  </label>
                  <input
                    type="number"
                    value={currentClassicRecord.mrp ?? ""}
                    onChange={e => handleCellChange(currentClassicSourceIndex, "mrp", e.target.value === "" ? "" : Number(e.target.value))}
                    className={`w-full p-2 bg-white dark:bg-[#2d3133] border rounded font-mono font-bold ${
                      currentClassicRecord.mrp === "" || currentClassicRecord.mrp === null || currentClassicRecord.mrp === undefined || Number(currentClassicRecord.mrp) < 0 || isNaN(Number(currentClassicRecord.mrp)) || Number(currentClassicRecord.mrp) < Number(currentClassicRecord.price)
                        ? "border-[#ba1a1a] bg-[#ffdad6]/30 text-[#ba1a1a]"
                        : "border-[#c6c6cd]"
                    }`}
                  />
                  {(currentClassicRecord.mrp === "" || currentClassicRecord.mrp === null || currentClassicRecord.mrp === undefined || Number(currentClassicRecord.mrp) < 0 || isNaN(Number(currentClassicRecord.mrp))) ? (
                    <span className="text-[#ba1a1a] dark:text-[#ffb4ab] text-[10px] font-semibold block mt-1">
                      MRP is required and must be a valid number.
                    </span>
                  ) : Number(currentClassicRecord.mrp) < Number(currentClassicRecord.price) ? (
                    <span className="text-[#ba1a1a] dark:text-[#ffb4ab] text-[10px] font-semibold block mt-1">
                      MRP ({Number(currentClassicRecord.mrp)}) must be greater than or equal to Selling Price ({Number(currentClassicRecord.price)}).
                    </span>
                  ) : null}
                </div>
                <div>
                  <label className="text-[#515f74] font-bold text-[10px] block mb-1">
                    GST Tax Rate (%) <span className="text-[#ba1a1a] dark:text-[#ffb4ab] font-black">*</span>
                  </label>
                  <input
                    type="text"
                    value={currentClassicRecord.gst_percentage ?? ""}
                    onChange={e => handleCellChange(currentClassicSourceIndex, "gst_percentage", e.target.value)}
                    className={`w-full p-2 bg-white dark:bg-[#2d3133] border rounded font-semibold ${
                      !currentClassicRecord.gst_percentage?.toString().trim()
                        ? "border-[#ba1a1a] bg-[#ffdad6]/30 text-[#ba1a1a]"
                        : "border-[#c6c6cd]"
                    }`}
                  />
                  {!currentClassicRecord.gst_percentage?.toString().trim() && (
                    <span className="text-[#ba1a1a] dark:text-[#ffb4ab] text-[10px] font-semibold block mt-1">
                      GST Tax Rate is required and cannot be blank.
                    </span>
                  )}
                </div>
              </div>

              {/* Dynamic Business Attributes */}
              <div className="space-y-3 bg-[#f7f9fb] dark:bg-[#191c1e] p-4 rounded-xl border border-[#c6c6cd] dark:border-[#45464d]">
                <h3 className="font-bold uppercase tracking-wider text-[#003d9b] dark:text-[#b2c5ff] text-[10px]">3. Attributes (A1..A3)</h3>
                <div>
                  <label className="text-[#515f74] font-bold text-[10px] block mb-1">A1 (Heels / Heel Type)</label>
                  <input
                    type="text"
                    value={currentClassicRecord.a1 || ""}
                    onChange={e => handleCellChange(currentClassicSourceIndex, "a1", e.target.value)}
                    className="w-full p-2 bg-white dark:bg-[#2d3133] border border-[#c6c6cd] rounded"
                  />
                </div>
                <div>
                  <label className="text-[#515f74] font-bold text-[10px] block mb-1">A2 (Upper Material)</label>
                  <input
                    type="text"
                    value={currentClassicRecord.a2 || ""}
                    onChange={e => handleCellChange(currentClassicSourceIndex, "a2", e.target.value)}
                    className="w-full p-2 bg-white dark:bg-[#2d3133] border border-[#c6c6cd] rounded"
                  />
                </div>
                <div>
                  <label className="text-[#515f74] font-bold text-[10px] block mb-1">A3 (Outsole Material)</label>
                  <input
                    type="text"
                    value={currentClassicRecord.a3 || ""}
                    onChange={e => handleCellChange(currentClassicSourceIndex, "a3", e.target.value)}
                    className="w-full p-2 bg-white dark:bg-[#2d3133] border border-[#c6c6cd] rounded"
                  />
                </div>
              </div>

              {/* Resolved Image Preview */}
              <div className="space-y-3 bg-[#f7f9fb] dark:bg-[#191c1e] p-4 rounded-xl border border-[#c6c6cd] dark:border-[#45464d] flex flex-col items-center justify-center">
                <h3 className="font-bold uppercase tracking-wider text-[#003d9b] dark:text-[#b2c5ff] text-[10px] self-start">
                  4. Image Preview
                </h3>
                <div className="w-full h-44 rounded-lg border border-[#c6c6cd] dark:border-[#45464d] bg-white dark:bg-[#2d3133] flex items-center justify-center overflow-hidden p-2">
                  <img
                    src={currentClassicImageUrl}
                    alt="Resolved Product"
                    className="max-h-full max-w-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = getImagePathConfig().fallbackPlaceholder;
                    }}
                  />
                </div>
                <span className="text-[10px] font-mono text-[#76777d] truncate max-w-full">
                  {currentClassicRecord.imageName ? currentClassicRecord.imageName : "No image specified"}
                </span>
              </div>

            </div>
          </div>
        )}

      </div>

      {/* Floating Hover Image Preview Modal */}
      {hoverPreview && (
        <div
          style={{ position: "fixed", left: hoverPreview.x, top: hoverPreview.y }}
          className="z-50 bg-white dark:bg-[#191c1e] border-2 border-[#0052cc] p-2 rounded-xl shadow-2xl pointer-events-none animate-in fade-in zoom-in-95 duration-100"
        >
          <div className="w-44 h-44 flex items-center justify-center overflow-hidden bg-[#f7f9fb] rounded-lg">
            <img
              src={hoverPreview.url}
              alt="Resolved Thumbnail"
              className="max-h-full max-w-full object-contain"
            />
          </div>
          <p className="mt-1 text-center font-mono text-[10px] font-bold truncate max-w-[176px]">
            {hoverPreview.name}
          </p>
        </div>
      )}

      {/* Enterprise Standard Footer Bar */}
      <footer className="h-12 border-t border-[#c6c6cd] dark:border-[#45464d] bg-white dark:bg-[#131b2e] px-6 flex items-center justify-between shrink-0 shadow-xs text-xs">
        <div className="flex items-center gap-2 font-mono text-[11px] text-[#76777d]">
          <span>SMRITI Retail OS • Enterprise Item Master</span>
        </div>

        <div className="flex items-center gap-2">
          {activeMode === "add" && (
            <button
              type="button"
              onClick={handleAddRow}
              className="px-3 py-1.5 border border-[#c6c6cd] dark:border-[#45464d] hover:bg-[#eceef0] rounded font-semibold transition"
            >
              Add Row
            </button>
          )}

          {activeMode === "add" && (
            <button
              type="button"
              onClick={handleDuplicateSelected}
              disabled={selectedRowIndices.size === 0}
              className="px-3 py-1.5 border border-[#c6c6cd] dark:border-[#45464d] hover:bg-[#eceef0] rounded font-semibold transition disabled:opacity-40"
            >
              Duplicate
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsReplaceModalOpen(true)}
            className="px-3 py-1.5 border border-[#c6c6cd] dark:border-[#45464d] hover:bg-[#eceef0] rounded font-semibold transition flex items-center gap-1"
          >
            <Replace size={13} className="text-[#0052cc]" />
            Replace Data
          </button>

          <button
            type="button"
            onClick={handlePrintManifest}
            className="px-3 py-1.5 border border-[#c6c6cd] dark:border-[#45464d] hover:bg-[#eceef0] rounded font-semibold transition flex items-center gap-1"
          >
            <Printer size={13} />
            Print
          </button>

          <ExportButton
            moduleTitle="Item Master"
            columns={itemMasterExportColumns}
            data={gridRows}
            selectedRows={gridRows.filter((_, idx) => selectedRowIndices.has(idx))}
            totalRecordsCount={products.length}
            filteredRecordsCount={gridRows.length}
            apiEndpoint="/products"
            searchTerm={searchFilter}
            companyName="SMRITI Retail"
            onNotification={onNotification}
          />

          <button
            type="button"
            onClick={() => {
              populateRowsFromProducts();
              onNotification?.("Undo Applied", "Reset all unsaved matrix changes.", "success");
            }}
            className="px-3 py-1.5 border border-[#c6c6cd] dark:border-[#45464d] hover:bg-[#eceef0] rounded font-semibold transition"
          >
            Cancel
          </button>

          {activeMode === "delete" ? (
            <button
              type="button"
              onClick={handleDeleteRecords}
              disabled={selectedRowIndices.size === 0}
              className="px-5 py-1.5 bg-[#ba1a1a] hover:bg-[#93000a] text-white rounded font-bold transition flex items-center gap-1.5 shadow-xs disabled:opacity-40"
            >
              <Trash2 size={14} />
              Confirm Delete ({selectedRowIndices.size})
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSaveGridToDatabase}
              disabled={isSaving}
              className="px-5 py-1.5 bg-[#0052cc] hover:bg-[#003d9b] text-white rounded font-bold transition flex items-center gap-1.5 shadow-xs disabled:opacity-50"
            >
              <Save size={14} />
              {isSaving ? "Saving..." : "Ok (Save to Database)"}
            </button>
          )}
        </div>
      </footer>

      {/* Modals */}
      <ReplaceDataDlg
        isOpen={isReplaceModalOpen}
        onClose={() => setIsReplaceModalOpen(false)}
        onReplace={handleGlobalReplace}
        fields={catalogFields}
      />

      <CodeSelectDlg
        isOpen={isCodeModalOpen}
        onClose={() => setIsCodeModalOpen(false)}
        onSelectCode={handleApplyGeneratedCode}
        currentRow={activeCodeTargetRow !== null ? gridRows[activeCodeTargetRow] : {}}
      />

      <ItemShortcuts
        isOpen={isShortcutsModalOpen}
        onClose={() => setIsShortcutsModalOpen(false)}
      />

      <DataLoadConfirm
        isOpen={isDataConfirmOpen}
        totalRecordsCount={products.length}
        onConfirm={handleConfirmDataLoading}
      />

    </div>
  );
};

export default ItemDetailsGrid;
