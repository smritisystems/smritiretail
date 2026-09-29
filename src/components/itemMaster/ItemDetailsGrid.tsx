/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.47.3
 * Created      : 2026-08-21
 * Modified     : 2026-09-30
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal — Read-Only Quick-Audit Table (Phase 3 Legacy Retirement)
 * Policy ID    : UADHP-v1.0
 */

import React, { useState, useEffect, useMemo } from "react";
import { 
  Plus, 
  Filter, 
  LayoutGrid, 
  FileText, 
  Info,
  HelpCircle, 
  Printer, 
  ChevronLeft, 
  ChevronRight, 
  ShieldAlert, 
  Search, 
  Image as ImageIcon, 
  ArrowUp, 
  ArrowDown, 
  ArrowUpDown, 
  X,
  Package,
  FileSpreadsheet
} from "lucide-react";
import { Product, AttributeDefinition } from "../../types.ts";
import { apiFetchV1 } from "../../lib/apiFetchV1.ts";
import {
  fetchGovernedLookupOptions,
  validateHsnCode,
  LookupOption,
} from "../../services/itemMasterLookupGate.ts";
import { getUnifiedItemMasterFields, getGlobalFieldVisibility } from "../../services/unifiedFieldCatalog.ts";
import { getCustomFieldLabels } from "../../lib/headerMapping/HeaderAliasRegistry.ts";
import { resolveProductImageUrl, getImagePathConfig } from "../../services/imagePathConfig.ts";
import { ItemShortcuts } from "./ItemShortcuts.tsx";
import { ItemViewConfigState } from "./ItemViewConfig.tsx";
import { ExportButton } from "../export/ExportButton.tsx";
import { ExportColumnDefinition } from "../export/types.ts";

export type MasterEntryMode = "add" | "edit" | "delete" | "audit";
export type SortDirection = "asc" | "desc";

const DEFAULT_COLUMN_WIDTHS: Record<string, number> = {
  code: 150,
  sku: 150,
  stockNo: 150,
  barcode: 150,
  name: 220,
  brand: 150,
  styleCode: 140,
  colour: 130,
  size: 90,
  mrp: 110,
  price: 120,
  costPrice: 120,
  gst_percentage: 110,
  hsn_code: 130,
};

const getDefaultColumnWidth = (key: string): number => DEFAULT_COLUMN_WIDTHS[key] || 140;

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
  onNotification?: (title: string, message: string, type?: "info" | "error" | "success" | "warning") => void;
  onNavigateToItemViewConfig?: () => void;
  onNavigateToCommonFields?: () => void;
  onNavigateToCatalog?: () => void;
  onAddNew?: () => void;
}

export const ItemDetailsGrid: React.FC<SmritiItemDetailsGridProps> = ({
  products = [],
  viewConfig,
  commonFields,
  entryMode = "audit",
  onRefreshProducts,
  onNotification,
  onNavigateToItemViewConfig,
  onNavigateToCommonFields,
  onNavigateToCatalog,
  onAddNew,
}) => {
  const [dynamicDefinitions, setDynamicDefinitions] = useState<AttributeDefinition[]>([]);
  const [gridRows, setGridRows] = useState<any[]>([]);
  const [selectedRowIndices, setSelectedRowIndices] = useState<Set<number>>(new Set());
  const [viewMode, setViewMode] = useState<"grid" | "classic">(viewConfig?.viewMode || "grid");
  const [classicRecordIndex, setClassicRecordIndex] = useState<number>(0);
  const activeMode: MasterEntryMode = "audit";
  
  // Hover image preview
  const [hoverPreview, setHoverPreview] = useState<{ url: string; name: string; x: number; y: number } | null>(null);

  // Modals state
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState<boolean>(false);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchFilter, setSearchFilter] = useState<string>("");
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem("smriti_item_master_column_widths");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [visibilityVersion, setVisibilityVersion] = useState<number>(0);
  const [warehouseOptions, setWarehouseOptions] = useState<{ id: string; code: string; name: string }[]>([]);
  const [locationOptions, setLocationOptions] = useState<{ id: string; warehouseId: string; code: string; name: string }[]>([]);
  const [governedLookups, setGovernedLookups] = useState<Record<string, LookupOption[]>>({});
  /** Per-record HSN validation advisory { [stockNo|rowKey]: { valid, gstPct, description } } */
  const [hsnValidation, setHsnValidation] = useState<Record<string, { valid: boolean; gstPct?: number; description?: string }>>({});

  // Listen to global visibility changes
  useEffect(() => {
    const handleVisChange = () => setVisibilityVersion(v => v + 1);
    window.addEventListener("smriti_field_visibility_updated", handleVisChange);
    return () => window.removeEventListener("smriti_field_visibility_updated", handleVisChange);
  }, []);

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      apiFetchV1("/wms/warehouses"),
      apiFetchV1("/wms/locations")
    ]).then(([warehouses, locations]) => {
      if (!isMounted) return;
      if (Array.isArray(warehouses)) {
        setWarehouseOptions(warehouses.map((item: any) => ({
          id: String(item.id), code: String(item.code || ""), name: String(item.name || item.code || "")
        })));
      }
      if (Array.isArray(locations)) {
        setLocationOptions(locations.map((item: any) => ({
          id: String(item.id), warehouseId: String(item.warehouse_id || ""),
          code: String(item.code || ""), name: String(item.name || item.code || "")
        })));
      }
    }).catch(() => {
      if (isMounted) {
        setWarehouseOptions([]);
        setLocationOptions([]);
      }
    });
    return () => { isMounted = false; };
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

  // Load governed lookup options for dropdown / datalist typeahead
  useEffect(() => {
    let isMounted = true;
    fetchGovernedLookupOptions().then(options => {
      if (isMounted) setGovernedLookups(options);
    }).catch(() => {});
    return () => { isMounted = false; };
  }, []);

  const mapProductToGridRow = (p: any, idx: number) => ({
    _id: p.id || `row-${idx}`,
    code: p.code || "",
    name: p.name || "",
    imageName: p.image_name || p.imageName || p.image || "",
    brand: p.brand || commonFields?.brand || "",
    styleCode: p.style_code || p.styleCode || "",
    colour: p.colour || p.color || "",
    size: p.size || "",
    category: p.category || commonFields?.category || "Footwear",
    subCategory: p.sub_category || commonFields?.subCategory || "",
    mrp: p.mrp || p.price || 0,
    price: p.price || 0,
    costPrice: p.costPrice || p.cost_price || 0,
    gst_percentage: p.gst_percentage || p.gstPercentage || commonFields?.gstPercentage || 18,
    hsn_code: p.hsn_code || p.hsnCode || commonFields?.hsnCode || "",
    barcode: p.barcode || "",
    uom: p.uom || commonFields?.uom || "Pair",
    a1: p.attributes?.a1 || p.attributes?.heels || "",
    a2: p.attributes?.a2 || p.attributes?.upperMaterial || "",
    a3: p.attributes?.a3 || p.attributes?.outsole || "",
    a4: p.attributes?.a4 || p.attributes?.gender || commonFields?.department || "",
    a5: p.attributes?.a5 || commonFields?.vendorCode || "",
    a6: p.attributes?.a6 || commonFields?.purchaseClass || "",
    a7: p.attributes?.a7 || "",
    a8: p.attributes?.a8 || "",
    a9: p.attributes?.a9 || "",
    warehouseId: p.attributes?.warehouse_id || "",
    binLocation: p.attributes?.location_id || "",
    hasTransactions: p.has_transactions || Boolean(p.id && idx % 3 === 0)
  });

  // Initialize rows from products
  useEffect(() => {
    setGridRows(products.map(mapProductToGridRow));
  }, [products]);

  // Debounced search
  useEffect(() => {
    const query = searchFilter.trim();
    if (query.length === 0) {
      setGridRows(products.map(mapProductToGridRow));
      return;
    }
    if (query.length < 2) return;

    let isMounted = true;
    const timer = window.setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await apiFetchV1<unknown>(`/inventory/search?q=${encodeURIComponent(query)}&limit=100`);
        const items = Array.isArray(response) ? response : [];
        if (isMounted) {
          setGridRows(items.map(mapProductToGridRow));
          setSelectedRowIndices(new Set());
        }
      } catch (error) {
        if (isMounted) {
          onNotification?.("Search Unavailable", error instanceof Error ? error.message : "Could not search item records.", "error");
        }
      } finally {
        if (isMounted) setIsSearching(false);
      }
    }, 300);

    return () => {
      isMounted = false;
      window.clearTimeout(timer);
    };
  }, [searchFilter, products]);

  // Keyboard shortcut listeners (F1, Ctrl+S)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F1") {
        e.preventDefault();
        setIsShortcutsModalOpen(true);
      } else if (e.ctrlKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        onNotification?.(
          "Read-Only Quick-Audit Mode",
          "Spreadsheet writes are retired. To create or edit articles, use the Article / Design Catalog and Drawer.",
          "info"
        );
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onNotification]);

  // Unified available fields
  const catalogFields = useMemo(() => {
    const customLabels = getCustomFieldLabels();
    return getUnifiedItemMasterFields(dynamicDefinitions).map(f => ({
      key: f.key,
      label: customLabels[f.key] || f.label
    }));
  }, [dynamicDefinitions]);

  // Active columns to show based on global visibility & viewConfig
  const visibleColumns: { key: string; label: string }[] = useMemo(() => {
    const globalVisibleKeys = getGlobalFieldVisibility();
    const customLabels = getCustomFieldLabels();

    if (globalVisibleKeys && globalVisibleKeys.length > 0) {
      return globalVisibleKeys.map((key: string) => {
        const found = catalogFields.find(f => f.key === key);
        return found ? { key: found.key, label: customLabels[found.key] || found.label } : { key, label: key.toUpperCase() };
      });
    }

    if (viewConfig?.visibleColumns && viewConfig.visibleColumns.length > 0) {
      return viewConfig.visibleColumns.map((key: string) => {
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

  const getColumnWidth = (key: string): number => columnWidths[key] ?? getDefaultColumnWidth(key);

  const handleColumnResize = (key: string, event: React.MouseEvent<HTMLSpanElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startWidth = getColumnWidth(key);
    const handleMove = (moveEvent: MouseEvent) => {
      const nextWidth = Math.min(520, Math.max(72, startWidth + moveEvent.clientX - startX));
      setColumnWidths(previous => ({ ...previous, [key]: nextWidth }));
    };
    const handleUp = () => {
      setColumnWidths(previous => {
        try { localStorage.setItem("smriti_item_master_column_widths", JSON.stringify(previous)); } catch { /* ignore */ }
        return previous;
      });
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  };

  const handleAutoSizeColumn = (key: string) => {
    const contentWidth = gridRows.reduce((maxWidth, row) => {
      return Math.max(maxWidth, String(row[key] ?? "").length * 7 + 28);
    }, getDefaultColumnWidth(key));
    const nextWidth = Math.min(520, Math.max(72, contentWidth));
    setColumnWidths(previous => {
      const next = { ...previous, [key]: nextWidth };
      try { localStorage.setItem("smriti_item_master_column_widths", JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const totalTableWidth = 36 + 40 + visibleColumns.reduce((total: number, column: { key: string; label: string }) => total + getColumnWidth(column.key), 0);

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

  // Read-only Quick-Audit mode: spreadsheet write/mutation handlers retired.

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
        
        {/* Left: Quick-Audit Mode & Actions */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#e0f2fe] dark:bg-[#0369a1]/30 text-[#0369a1] dark:text-[#7dd3fc] rounded-lg border border-[#bae6fd] dark:border-[#0284c7]/40 text-xs font-bold">
            <FileSpreadsheet size={15} />
            <span>Quick-Audit Table (Read-Only)</span>
          </div>

          {onNavigateToCatalog && (
            <button
              type="button"
              onClick={onNavigateToCatalog}
              className="px-3 py-1.5 bg-[#0052cc] hover:bg-[#003d9b] text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
              title="Open canonical Article / Design Catalog for creating and editing articles"
            >
              <Package size={14} />
              <span>Open Article Catalog</span>
            </button>
          )}

          {onAddNew && (
            <button
              type="button"
              onClick={onAddNew}
              className="px-3 py-1.5 border border-[#0052cc] text-[#0052cc] dark:text-[#93c5fd] hover:bg-[#e9edff] dark:hover:bg-[#1d3054] rounded-lg text-xs font-bold transition flex items-center gap-1"
              title="Create new Article using the standardized Drawer"
            >
              <span>+ New Article</span>
            </button>
          )}
        </div>

        {/* View Switchers */}
        <div className="flex items-center gap-3">
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
              data-field-key="product_name"
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder={isSearching ? "Searching items..." : "Search SKU, barcode, name..."}
              aria-label="Filter items globally"
              aria-busy={isSearching}
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

      {/* Read-Only Quick-Audit Banner */}
      <div className="bg-[#f0f9ff] dark:bg-[#0c2a4d] border-b border-[#bae6fd] dark:border-[#1e4976] px-6 py-2 flex items-center justify-between text-xs text-[#0369a1] dark:text-[#7dd3fc]">
        <div className="flex items-center gap-2">
          <Info size={14} className="shrink-0" />
          <span>
            <strong>Read-Only Mode:</strong> This matrix displays existing catalog items for rapid inventory review, filtering, and export. Direct spreadsheet mutations are retired.
          </span>
        </div>
        {onNavigateToCatalog && (
          <button
            type="button"
            onClick={onNavigateToCatalog}
            className="text-[#0052cc] dark:text-[#93c5fd] font-bold text-xs hover:underline flex items-center gap-1"
          >
            Switch to Article Catalog →
          </button>
        )}
      </div>

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
              <table
                className="w-full min-w-max table-fixed text-left border-collapse text-xs whitespace-nowrap"
                style={{ width: `${Math.max(totalTableWidth, 720)}px` }}
              >
                <colgroup>
                  <col style={{ width: "36px" }} />
                  <col style={{ width: "40px" }} />
                  {visibleColumns.map(column => (
                    <col key={column.key} style={{ width: `${getColumnWidth(column.key)}px` }} />
                  ))}
                </colgroup>
                <thead className="sticky top-0 bg-[#f2f4f6] dark:bg-[#131b2e] border-b border-[#c6c6cd] dark:border-[#45464d] z-20">
                  <tr>
                    <th className="p-2 w-10 text-center border-r border-[#c6c6cd] dark:border-[#45464d] sticky left-0 z-30 bg-[#f2f4f6] dark:bg-[#131b2e] align-top">
                      <div className="flex flex-col items-center gap-1.5 pt-0.5">
                        <input
                          type="checkbox"
                          aria-label="Select all visible items"
                          checked={isAllFilteredSelected}
                          ref={(el) => {
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
                      const isSorted = Boolean(sortConfig && sortConfig.columnKey === col.key);
                      const sortDirection = isSorted && sortConfig ? sortConfig.direction : null;
                      const ariaSortValue = sortDirection === "asc" ? "ascending" : sortDirection === "desc" ? "descending" : "none";
                      const filterValue = columnFilters[col.key] || "";
                      const isRequiredCol = isItemFieldRequired(col.key);

                      return (
                        <th
                          key={col.key}
                          aria-sort={ariaSortValue}
                          style={{ width: `${getColumnWidth(col.key)}px` }}
                          className={`relative p-2 font-bold text-[#515f74] dark:text-[#bec6e0] uppercase text-[10px] border-r border-[#c6c6cd] dark:border-[#45464d] min-w-[72px] ${
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
                                data-field-key="product_name"
                                aria-label={`Filter by ${col.label}`}
                                placeholder="Filter..."
                                value={filterValue}
                                onChange={(e) => handleColumnFilterChange(col.key, e.target.value)}
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
                            <span
                              role="separator"
                              aria-label={`Resize ${col.label} column`}
                              title="Drag to resize. Double-click to auto-fit."
                              onMouseDown={(event) => handleColumnResize(col.key, event)}
                              onDoubleClick={() => handleAutoSizeColumn(col.key)}
                              className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-[#0052cc]"
                            />
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
                          <td className="p-0.5 text-center border-r border-[#eceef0] dark:border-[#2d3133] sticky left-0 z-10 bg-inherit">
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
                          <td className="p-0.5 text-center font-mono text-[10px] text-[#76777d] border-r border-[#eceef0] dark:border-[#2d3133]">
                            {displayIdx + 1}
                          </td>
                          {visibleColumns.map((col, cIdx) => {
                            const isFrozen = cIdx < frozenCount;
                            const isCode = col.key === "code" || col.key === "sku" || col.key === "stockNo";
                            const isBarcode = col.key === "barcode";
                            const isImage = col.key === "imageName" || col.key === "image";
                            const isDuplicateCode = isCode && (duplicatesInfo.duplicateCodes.has(sourceIndex) || duplicatesInfo.duplicateDbCodes.has(sourceIndex));
                            const isDuplicateBarcode = isBarcode && (duplicatesInfo.duplicateBarcodes.has(sourceIndex) || duplicatesInfo.duplicateDbBarcodes.has(sourceIndex));
                            const isDuplicate = isDuplicateCode || isDuplicateBarcode;
                            const val = row[col.key] ?? "";
                            const dbConflictMsg = isCode ? duplicatesInfo.duplicateDbCodes.get(sourceIndex) : duplicatesInfo.duplicateDbBarcodes.get(sourceIndex);

                            const isRequiredField = isItemFieldRequired(col.key);
                            const isBlankValue = isRequiredField && (val === null || val === undefined || String(val).trim() === "");

                            // Format displayed value for lookup fields
                            let displayVal = val;
                            if (col.key === "warehouseId") {
                              const found = warehouseOptions.find(o => o.id === val);
                              displayVal = found ? `${found.code} - ${found.name}` : val;
                            } else if (col.key === "binLocation") {
                              const found = locationOptions.find(o => o.id === val);
                              displayVal = found ? `${found.code} - ${found.name}` : val;
                            }

                            return (
                              <td
                                key={col.key}
                                className={`p-0 border-r border-[#eceef0] dark:border-[#2d3133] ${
                                  isFrozen ? "sticky left-[88px] z-10 bg-inherit shadow-xs" : ""
                                } ${
                                  isDuplicate
                                    ? "bg-[#ffdad6] dark:bg-[#93000a]/40"
                                    : isBlankValue
                                    ? "bg-[#ffdad6]/20 dark:bg-[#93000a]/20"
                                    : ""
                                }`}
                              >
                                <div className="flex items-center justify-between gap-1 px-1 min-h-[30px]">
                                  <span
                                    title={isBlankValue ? `${col.label} is missing in record.` : String(displayVal || "")}
                                    className={`select-text truncate block px-1 py-1 text-xs ${
                                      isCode || isBarcode || col.key === "hsn_code" || col.key === "price" || col.key === "mrp"
                                        ? "font-mono font-semibold"
                                        : "font-normal"
                                    } ${
                                      isDuplicate
                                        ? "text-[#ba1a1a] dark:text-[#ffb4ab] font-bold"
                                        : isBlankValue
                                        ? "text-[#ba1a1a] dark:text-[#ffb4ab] italic"
                                        : "text-[#191c1e] dark:text-[#eff1f3]"
                                    }`}
                                  >
                                    {displayVal !== "" && displayVal !== null && displayVal !== undefined
                                      ? String(displayVal)
                                      : isBlankValue
                                      ? "Missing"
                                      : "—"}
                                  </span>

                                  <div className="flex items-center gap-1 shrink-0">
                                    {isDuplicate && (
                                      <span
                                        title={
                                          dbConflictMsg
                                            ? `Already registered in database for '${dbConflictMsg}'`
                                            : isDuplicateCode
                                            ? "Duplicate Stock No detected in records"
                                            : "Duplicate Barcode detected in records"
                                        }
                                        className="text-[#ba1a1a] px-0.5 font-bold animate-pulse cursor-help"
                                      >
                                        ⚠️
                                      </span>
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
                                        className="cursor-pointer p-0.5 text-[#0052cc] hover:bg-[#e9edff] rounded"
                                        title="Hover to preview resolved image"
                                      >
                                        <ImageIcon size={13} />
                                      </div>
                                    )}
                                  </div>
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
          /* Classic Single-Record View (Read-Only Quick-Audit Inspector) */
          <div className="h-full overflow-y-auto bg-white dark:bg-[#2d3133] border border-[#c6c6cd] dark:border-[#45464d] rounded-xl p-6 shadow-xs space-y-6">
            <div className="flex justify-between items-center border-b border-[#eceef0] dark:border-[#45464d] pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-[#003d9b] dark:text-[#b2c5ff]">
                    Item Details — Classic View
                  </h2>
                  <span className="px-2 py-0.5 bg-[#e0f2fe] dark:bg-[#0369a1]/30 text-[#0369a1] dark:text-[#7dd3fc] text-[10px] font-bold rounded">
                    Read-Only Inspector
                  </span>
                </div>
                <p className="text-xs text-[#76777d]">Single-record inspector &amp; detailed attribute auditing.</p>
              </div>
              <div className="flex items-center gap-3">
                {onNavigateToCatalog && (
                  <button
                    type="button"
                    onClick={onNavigateToCatalog}
                    className="px-3 py-1.5 bg-[#0052cc] hover:bg-[#003d9b] text-white rounded text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                    title="Open canonical Article / Design Catalog to edit this item"
                  >
                    <Package size={13} />
                    <span>Open in Article Catalog</span>
                  </button>
                )}
                <div className="flex items-center gap-1">
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
            </div>

            {/* Form Sections */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-xs">
              
              {/* Basic Details */}
              <div className="space-y-3 bg-[#f7f9fb] dark:bg-[#191c1e] p-4 rounded-xl border border-[#c6c6cd] dark:border-[#45464d]">
                <h3 className="font-bold uppercase tracking-wider text-[#003d9b] dark:text-[#b2c5ff] text-[10px]">1. Identification</h3>
                <div>
                  <label className="text-[#515f74] font-bold text-[10px] block mb-1">
                    Stock No / SKU
                  </label>
                  <input
                    type="text"
                    readOnly={true}
                    value={currentClassicRecord.code || ""}
                    className="w-full p-2 bg-[#f2f4f6] dark:bg-[#191c1e] text-[#191c1e] dark:text-[#eff1f3] border border-[#c6c6cd] dark:border-[#45464d] rounded font-mono font-bold select-text cursor-default"
                  />
                  {!currentClassicRecord.code?.toString().trim() && (
                    <span className="text-[#ba1a1a] dark:text-[#ffb4ab] text-[10px] font-semibold block mt-1">
                      Stock No / SKU is blank in database.
                    </span>
                  )}
                </div>
                <div>
                  <label className="text-[#515f74] font-bold text-[10px] block mb-1">
                    Barcode (EAN-13)
                  </label>
                  <input
                    type="text"
                    readOnly={true}
                    value={currentClassicRecord.barcode || ""}
                    className="w-full p-2 bg-[#f2f4f6] dark:bg-[#191c1e] text-[#191c1e] dark:text-[#eff1f3] border border-[#c6c6cd] dark:border-[#45464d] rounded font-mono font-bold select-text cursor-default"
                  />
                  {!currentClassicRecord.barcode?.toString().trim() && (
                    <span className="text-[#ba1a1a] dark:text-[#ffb4ab] text-[10px] font-semibold block mt-1">
                      Barcode is blank in database.
                    </span>
                  )}
                </div>
                <div>
                  <label className="text-[#515f74] font-bold text-[10px] block mb-1">
                    Product Title / Name
                  </label>
                  <input
                    type="text"
                    readOnly={true}
                    value={currentClassicRecord.name || ""}
                    className="w-full p-2 bg-[#f2f4f6] dark:bg-[#191c1e] text-[#191c1e] dark:text-[#eff1f3] border border-[#c6c6cd] dark:border-[#45464d] rounded font-semibold select-text cursor-default"
                  />
                  {!currentClassicRecord.name?.toString().trim() && (
                    <span className="text-[#ba1a1a] dark:text-[#ffb4ab] text-[10px] font-semibold block mt-1">
                      Product Name is blank in database.
                    </span>
                  )}
                </div>
                <div>
                  <label className="text-[#515f74] font-bold text-[10px] block mb-1">
                    HSN Code
                  </label>
                  <input
                    type="text"
                    readOnly={true}
                    value={currentClassicRecord.hsn_code || ""}
                    className="w-full p-2 bg-[#f2f4f6] dark:bg-[#191c1e] text-[#191c1e] dark:text-[#eff1f3] border border-[#c6c6cd] dark:border-[#45464d] rounded font-mono font-bold select-text cursor-default"
                  />
                  {!currentClassicRecord.hsn_code?.toString().trim() && (
                    <span className="text-[#ba1a1a] dark:text-[#ffb4ab] text-[10px] font-semibold block mt-1">
                      HSN Code is blank in database.
                    </span>
                  )}
                  {currentClassicRecord.hsn_code?.toString().trim() && (() => {
                    const rowKey = currentClassicRecord.stockNo || currentClassicRecord.code || String(currentClassicSourceIndex);
                    const hsn = hsnValidation[rowKey];
                    if (!hsn) return null;
                    if (hsn.valid) return (
                      <span className="text-emerald-600 dark:text-emerald-400 text-[10px] block mt-1">
                        ✓ {hsn.description ? `${hsn.description} — ` : ""}GST {hsn.gstPct}%
                      </span>
                    );
                    return (
                      <span className="text-amber-600 dark:text-amber-400 text-[10px] font-semibold block mt-1">
                        ⚠ HSN not found in standard list — verify before filing.
                      </span>
                    );
                  })()}
                </div>
                <div>
                  <label className="text-[#515f74] font-bold text-[10px] block mb-1">Image Filename</label>
                  <input
                    type="text"
                    readOnly={true}
                    value={currentClassicRecord.imageName || ""}
                    className="w-full p-2 bg-[#f2f4f6] dark:bg-[#191c1e] text-[#191c1e] dark:text-[#eff1f3] border border-[#c6c6cd] dark:border-[#45464d] rounded font-mono text-xs select-text cursor-default"
                  />
                </div>
              </div>

              {/* Pricing & Tax */}
              <div className="space-y-3 bg-[#f7f9fb] dark:bg-[#191c1e] p-4 rounded-xl border border-[#c6c6cd] dark:border-[#45464d]">
                <h3 className="font-bold uppercase tracking-wider text-[#003d9b] dark:text-[#b2c5ff] text-[10px]">2. Pricing &amp; Taxes</h3>
                <div>
                  <label className="text-[#515f74] font-bold text-[10px] block mb-1">
                    Buying Price
                  </label>
                  <input
                    type="text"
                    readOnly={true}
                    value={currentClassicRecord.buyingPrice !== undefined && currentClassicRecord.buyingPrice !== null ? currentClassicRecord.buyingPrice : (currentClassicRecord.buying_price ?? "—")}
                    className="w-full p-2 bg-[#f2f4f6] dark:bg-[#191c1e] text-[#191c1e] dark:text-[#eff1f3] border border-[#c6c6cd] dark:border-[#45464d] rounded font-mono font-bold select-text cursor-default"
                  />
                </div>
                <div>
                  <label className="text-[#515f74] font-bold text-[10px] block mb-1">
                    Cost Price
                  </label>
                  <input
                    type="text"
                    readOnly={true}
                    value={currentClassicRecord.costPrice !== undefined && currentClassicRecord.costPrice !== null ? currentClassicRecord.costPrice : (currentClassicRecord.cost_price ?? "—")}
                    className="w-full p-2 bg-[#f2f4f6] dark:bg-[#191c1e] text-[#191c1e] dark:text-[#eff1f3] border border-[#c6c6cd] dark:border-[#45464d] rounded font-mono font-bold select-text cursor-default"
                  />
                </div>
                <div>
                  <label className="text-[#515f74] font-bold text-[10px] block mb-1">
                    Selling Price
                  </label>
                  <input
                    type="text"
                    readOnly={true}
                    value={currentClassicRecord.price !== undefined && currentClassicRecord.price !== null ? currentClassicRecord.price : "—"}
                    className="w-full p-2 bg-[#f2f4f6] dark:bg-[#191c1e] text-[#0c9488] dark:text-[#2dd4bf] border border-[#c6c6cd] dark:border-[#45464d] rounded font-mono font-bold select-text cursor-default"
                  />
                </div>
                <div>
                  <label className="text-[#515f74] font-bold text-[10px] block mb-1">
                    MRP
                  </label>
                  <input
                    type="text"
                    readOnly={true}
                    value={currentClassicRecord.mrp !== undefined && currentClassicRecord.mrp !== null ? currentClassicRecord.mrp : "—"}
                    className="w-full p-2 bg-[#f2f4f6] dark:bg-[#191c1e] text-[#191c1e] dark:text-[#eff1f3] border border-[#c6c6cd] dark:border-[#45464d] rounded font-mono font-bold select-text cursor-default"
                  />
                </div>
                <div>
                  <label className="text-[#515f74] font-bold text-[10px] block mb-1">
                    GST Tax Rate (%)
                  </label>
                  <input
                    type="text"
                    readOnly={true}
                    value={currentClassicRecord.gst_percentage !== undefined && currentClassicRecord.gst_percentage !== null ? `${currentClassicRecord.gst_percentage}%` : "—"}
                    className="w-full p-2 bg-[#f2f4f6] dark:bg-[#191c1e] text-[#191c1e] dark:text-[#eff1f3] border border-[#c6c6cd] dark:border-[#45464d] rounded font-mono font-semibold select-text cursor-default"
                  />
                </div>
              </div>

              {/* Dynamic Business Attributes */}
              <div className="space-y-3 bg-[#f7f9fb] dark:bg-[#191c1e] p-4 rounded-xl border border-[#c6c6cd] dark:border-[#45464d]">
                <h3 className="font-bold uppercase tracking-wider text-[#003d9b] dark:text-[#b2c5ff] text-[10px]">3. Attributes (A1..A3)</h3>
                <div>
                  <label className="text-[#515f74] font-bold text-[10px] block mb-1">A1 (Heels / Heel Type)</label>
                  <input
                    type="text"
                    readOnly={true}
                    value={currentClassicRecord.a1 || "—"}
                    className="w-full p-2 bg-[#f2f4f6] dark:bg-[#191c1e] text-[#191c1e] dark:text-[#eff1f3] border border-[#c6c6cd] dark:border-[#45464d] rounded select-text cursor-default"
                  />
                </div>
                <div>
                  <label className="text-[#515f74] font-bold text-[10px] block mb-1">A2 (Upper Material)</label>
                  <input
                    type="text"
                    readOnly={true}
                    value={currentClassicRecord.a2 || "—"}
                    className="w-full p-2 bg-[#f2f4f6] dark:bg-[#191c1e] text-[#191c1e] dark:text-[#eff1f3] border border-[#c6c6cd] dark:border-[#45464d] rounded select-text cursor-default"
                  />
                </div>
                <div>
                  <label className="text-[#515f74] font-bold text-[10px] block mb-1">A3 (Outsole Material)</label>
                  <input
                    type="text"
                    readOnly={true}
                    value={currentClassicRecord.a3 || "—"}
                    className="w-full p-2 bg-[#f2f4f6] dark:bg-[#191c1e] text-[#191c1e] dark:text-[#eff1f3] border border-[#c6c6cd] dark:border-[#45464d] rounded select-text cursor-default"
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

      {/* Enterprise Standard Footer Bar (Read-Only Quick-Audit Table) */}
      <footer className="h-12 border-t border-[#c6c6cd] dark:border-[#45464d] bg-white dark:bg-[#131b2e] px-6 flex items-center justify-between shrink-0 shadow-xs text-xs">
        <div className="flex items-center gap-2 font-mono text-[11px] text-[#76777d]">
          <span>SMRITI Retail OS • Quick-Audit Table (Read-Only)</span>
        </div>

        <div className="flex items-center gap-2">
          {onRefreshProducts && (
            <button
              type="button"
              onClick={async () => {
                await onRefreshProducts();
                onNotification?.("Refreshed", "Reloaded latest inventory records from database.", "info");
              }}
              className="px-3 py-1.5 border border-[#c6c6cd] dark:border-[#45464d] hover:bg-[#eceef0] dark:hover:bg-[#1f2224] rounded font-semibold transition"
            >
              Refresh Data
            </button>
          )}

          <button
            type="button"
            onClick={handlePrintManifest}
            className="px-3 py-1.5 border border-[#c6c6cd] dark:border-[#45464d] hover:bg-[#eceef0] dark:hover:bg-[#1f2224] rounded font-semibold transition flex items-center gap-1"
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

          {onNavigateToCatalog && (
            <button
              type="button"
              onClick={onNavigateToCatalog}
              className="px-4 py-1.5 bg-[#0052cc] hover:bg-[#003d9b] text-white rounded font-bold transition flex items-center gap-1.5 shadow-xs"
              title="Open canonical Article / Design Catalog for creating and editing articles"
            >
              <Package size={14} />
              <span>Open Article Catalog</span>
            </button>
          )}
        </div>
      </footer>

      {/* Modals */}
      <ItemShortcuts
        isOpen={isShortcutsModalOpen}
        onClose={() => setIsShortcutsModalOpen(false)}
      />

      {/* Governed Lookup Datalists for Auto-completion */}
      <datalist id="grid-lookup-brand-list">
        {(governedLookups.brand || []).map(opt => (
          <option key={opt.code} value={opt.code}>{opt.name !== opt.code ? opt.name : ""}</option>
        ))}
      </datalist>
      {/* Panel 5 Bottom Note: Immutability Warning */}
      <div className="bg-[#fffbeb] dark:bg-[#2d2415] border-t border-[#fef3c7] dark:border-[#45371c] px-6 py-2 flex items-center gap-2 text-xs text-[#92400e] dark:text-[#fcd34d]">
        <Info size={14} className="shrink-0" />
        <span>Note: Article Code, SKU and Barcode are system controlled and cannot be modified.</span>
      </div>

      <datalist id="grid-lookup-category-list">
        {(governedLookups.category || []).map(opt => (
          <option key={opt.code} value={opt.code}>{opt.name !== opt.code ? opt.name : ""}</option>
        ))}
      </datalist>
      <datalist id="grid-lookup-color-list">
        {(governedLookups.color || []).map(opt => (
          <option key={opt.code} value={opt.code}>{opt.name !== opt.code ? opt.name : ""}</option>
        ))}
      </datalist>
      <datalist id="grid-lookup-size-list">
        {(governedLookups.size || []).map(opt => (
          <option key={opt.code} value={opt.code}>{opt.name !== opt.code ? opt.name : ""}</option>
        ))}
      </datalist>
      <datalist id="grid-lookup-style-list">
        {(governedLookups.style_article || []).map(opt => (
          <option key={opt.code} value={opt.code}>{opt.name !== opt.code ? opt.name : ""}</option>
        ))}
      </datalist>
      <datalist id="grid-lookup-vendor-list">
        {(governedLookups.vendor_code || []).map(opt => (
          <option key={opt.code} value={opt.code}>{opt.name !== opt.code ? opt.name : ""}</option>
        ))}
      </datalist>

    </div>
  );
};

export default ItemDetailsGrid;
