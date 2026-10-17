/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 1.1.0
 * Created      : 2026-10-16
 * Modified     : 2026-10-16
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Target UI    : SMRITI Report Builder (Collapsible Panels, Auto-Adaptive Layout & Focus Mode)
 * Classification: Internal
 */

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Search, Play, Save, Download, SlidersHorizontal, Filter,
  Maximize2, Minimize2, ChevronDown, ChevronRight, ChevronLeft,
  X, Check, RotateCcw, TableProperties, FileSpreadsheet, Printer,
  FileText, ExternalLink, Hash, Calendar, Layers, CheckSquare,
  Sparkles, ShieldCheck, Clock, ChevronUp, Menu, Settings,
  ShoppingBag, TrendingUp, Boxes, Package, Users, Building, Landmark,
  GripVertical, ArrowLeft, ArrowRight, Eye, AlertCircle
} from "lucide-react";
import { withCapability } from "../../types/architecture.ts";
import { formatCurrency, formatNumber, formatDate } from "../../utils/formatters.ts";
import { GlobalExportService } from "../../services/globalExportService.ts";

export type SidebarState = "expanded" | "collapsed" | "hidden";
export type FiltersState = "expanded" | "compact" | "hidden";
export type LayoutPreset = "both" | "vertical" | "horizontal" | "focus" | "custom";

export interface ReportBuilderField {
  id: string;
  category: "Purchase" | "Sales" | "Inventory" | "Items" | "Customers" | "Suppliers" | "Finance";
  label: string;
  key: string;
  datatype: "text" | "number" | "currency" | "date" | "badge";
  iconType: "text" | "number" | "date" | "doc";
  isSummary?: boolean;
  align?: "left" | "right" | "center";
  defaultSelected?: boolean;
}

export interface ReportBuilderRow {
  id: string;
  [key: string]: any;
}

// ─────────────────────────────────────────────────────────────────────────────
// Canonical Retail Fields Catalog for Report Builder (30+ Fields Across 7 Domains)
// ─────────────────────────────────────────────────────────────────────────────
export const REPORT_BUILDER_CATALOG_FIELDS: ReportBuilderField[] = [
  // 1. Purchase
  { id: "pur_supplier", category: "Purchase", label: "Supplier", key: "supplier", datatype: "text", iconType: "text", defaultSelected: true },
  { id: "pur_po_no", category: "Purchase", label: "PO No", key: "po_no", datatype: "text", iconType: "text", defaultSelected: false },
  { id: "pur_po_date", category: "Purchase", label: "PO Date", key: "po_date", datatype: "date", iconType: "date", defaultSelected: true },
  { id: "pur_invoice_no", category: "Purchase", label: "Invoice No", key: "invoice_no", datatype: "text", iconType: "doc", defaultSelected: false },
  { id: "pur_article_sku", category: "Purchase", label: "Article / SKU", key: "article_sku", datatype: "text", iconType: "number", defaultSelected: true },
  { id: "pur_color", category: "Purchase", label: "Color", key: "color", datatype: "text", iconType: "text", defaultSelected: true },
  { id: "pur_size", category: "Purchase", label: "Size", key: "size", datatype: "number", iconType: "number", align: "right", defaultSelected: true },
  { id: "pur_quantity", category: "Purchase", label: "Quantity", key: "quantity", datatype: "number", iconType: "number", isSummary: true, align: "right", defaultSelected: true },
  { id: "pur_net_amount", category: "Purchase", label: "Net Amount", key: "net_amount", datatype: "currency", iconType: "number", isSummary: true, align: "right", defaultSelected: true },

  // 2. Sales
  { id: "sal_invoice_no", category: "Sales", label: "Invoice No", key: "sale_invoice_no", datatype: "text", iconType: "doc" },
  { id: "sal_invoice_date", category: "Sales", label: "Invoice Date", key: "sale_date", datatype: "date", iconType: "date" },
  { id: "sal_customer", category: "Sales", label: "Customer", key: "customer_name", datatype: "text", iconType: "text" },
  { id: "sal_staff", category: "Sales", label: "Sales Staff", key: "staff_name", datatype: "text", iconType: "text" },
  { id: "sal_gross_total", category: "Sales", label: "Gross Total", key: "gross_total", datatype: "currency", iconType: "number", isSummary: true, align: "right" },
  { id: "sal_tax_amount", category: "Sales", label: "Tax Amount", key: "tax_amount", datatype: "currency", iconType: "number", isSummary: true, align: "right" },
  { id: "sal_net_total", category: "Sales", label: "Net Total", key: "net_total", datatype: "currency", iconType: "number", isSummary: true, align: "right" },
  { id: "sal_payment_mode", category: "Sales", label: "Payment Mode", key: "payment_mode", datatype: "badge", iconType: "text" },

  // 3. Inventory
  { id: "inv_warehouse", category: "Inventory", label: "Warehouse", key: "warehouse", datatype: "text", iconType: "text" },
  { id: "inv_stock_on_hand", category: "Inventory", label: "Stock On Hand", key: "stock_on_hand", datatype: "number", iconType: "number", isSummary: true, align: "right" },
  { id: "inv_reserved_qty", category: "Inventory", label: "Reserved Qty", key: "reserved_qty", datatype: "number", iconType: "number", isSummary: true, align: "right" },
  { id: "inv_available_qty", category: "Inventory", label: "Available Qty", key: "available_qty", datatype: "number", iconType: "number", isSummary: true, align: "right" },
  { id: "inv_reorder_level", category: "Inventory", label: "Reorder Level", key: "reorder_level", datatype: "number", iconType: "number", align: "right" },
  { id: "inv_valuation_cost", category: "Inventory", label: "Valuation Cost", key: "valuation_cost", datatype: "currency", iconType: "number", isSummary: true, align: "right" },

  // 4. Items
  { id: "itm_code", category: "Items", label: "Item Code", key: "item_code", datatype: "text", iconType: "text" },
  { id: "itm_name", category: "Items", label: "Item Name", key: "item_name", datatype: "text", iconType: "text" },
  { id: "itm_category", category: "Items", label: "Category", key: "item_category", datatype: "text", iconType: "text" },
  { id: "itm_brand", category: "Items", label: "Brand", key: "brand", datatype: "text", iconType: "text" },
  { id: "itm_mrp", category: "Items", label: "MRP", key: "mrp", datatype: "currency", iconType: "number", align: "right" },
  { id: "itm_standard_cost", category: "Items", label: "Standard Cost", key: "standard_cost", datatype: "currency", iconType: "number", align: "right" },
  { id: "itm_selling_price", category: "Items", label: "Selling Price", key: "selling_price", datatype: "currency", iconType: "number", align: "right" },

  // 5. Customers
  { id: "crm_customer_code", category: "Customers", label: "Customer Code", key: "customer_code", datatype: "text", iconType: "text" },
  { id: "crm_customer_name", category: "Customers", label: "Customer Name", key: "crm_name", datatype: "text", iconType: "text" },
  { id: "crm_phone", category: "Customers", label: "Phone", key: "phone", datatype: "text", iconType: "text" },
  { id: "crm_city", category: "Customers", label: "City", key: "city", datatype: "text", iconType: "text" },
  { id: "crm_outstanding", category: "Customers", label: "Outstanding Balance", key: "outstanding_balance", datatype: "currency", iconType: "number", isSummary: true, align: "right" },

  // 6. Suppliers
  { id: "sup_code", category: "Suppliers", label: "Supplier Code", key: "supplier_code", datatype: "text", iconType: "text" },
  { id: "sup_name", category: "Suppliers", label: "Supplier Name", key: "sup_full_name", datatype: "text", iconType: "text" },
  { id: "sup_gstin", category: "Suppliers", label: "GSTIN", key: "supplier_gstin", datatype: "text", iconType: "doc" },
  { id: "sup_city", category: "Suppliers", label: "City", key: "supplier_city", datatype: "text", iconType: "text" },
  { id: "sup_balance", category: "Suppliers", label: "Current Balance", key: "supplier_balance", datatype: "currency", iconType: "number", isSummary: true, align: "right" },

  // 7. Finance
  { id: "fin_account_code", category: "Finance", label: "Account Code", key: "account_code", datatype: "text", iconType: "doc" },
  { id: "fin_account_name", category: "Finance", label: "Account Name", key: "account_name", datatype: "text", iconType: "text" },
  { id: "fin_debit_total", category: "Finance", label: "Debit Total", key: "debit_total", datatype: "currency", iconType: "number", isSummary: true, align: "right" },
  { id: "fin_credit_total", category: "Finance", label: "Credit Total", key: "credit_total", datatype: "currency", iconType: "number", isSummary: true, align: "right" },
  { id: "fin_closing_balance", category: "Finance", label: "Closing Balance", key: "closing_balance", datatype: "currency", iconType: "number", isSummary: true, align: "right" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Default Realistic Footwear Dataset Matching User Mockups Exactly (132 units, ₹66,500)
// ─────────────────────────────────────────────────────────────────────────────
export const DEFAULT_REPORT_BUILDER_ROWS: ReportBuilderRow[] = [
  { id: "row-1", supplier: "ABC Footwear", po_no: "PO-2025-001", po_date: "2025-04-02", invoice_no: "INV-8801", article_sku: "CH-01", color: "Black", size: 7, quantity: 24, net_amount: 12000 },
  { id: "row-2", supplier: "ABC Footwear", po_no: "PO-2025-001", po_date: "2025-04-02", invoice_no: "INV-8801", article_sku: "CH-01", color: "Black", size: 8, quantity: 18, net_amount: 9000 },
  { id: "row-3", supplier: "XYZ Traders",  po_no: "PO-2025-002", po_date: "2025-04-10", invoice_no: "INV-8802", article_sku: "SN-02", color: "Brown", size: 7, quantity: 30, net_amount: 15000 },
  { id: "row-4", supplier: "XYZ Traders",  po_no: "PO-2025-002", po_date: "2025-04-10", invoice_no: "INV-8802", article_sku: "SN-02", color: "Brown", size: 8, quantity: 20, net_amount: 10000 },
  { id: "row-5", supplier: "LMN Suppliers", po_no: "PO-2025-003", po_date: "2025-04-18", invoice_no: "INV-8803", article_sku: "SP-03", color: "Blue", size: 9, quantity: 25, net_amount: 12500 },
  { id: "row-6", supplier: "LMN Suppliers", po_no: "PO-2025-003", po_date: "2025-04-18", invoice_no: "INV-8803", article_sku: "SP-03", color: "Blue", size: 10, quantity: 15, net_amount: 8000 },
];

export interface ReportBuilderProps {
  initialTitle?: string;
  initialData?: ReportBuilderRow[];
  onNotification?: (type: "success" | "error" | "info", msg: string) => void;
  onReturnToCatalog?: () => void;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  Purchase: <ShoppingBag size={14} className="text-blue-500" />,
  Sales: <TrendingUp size={14} className="text-emerald-500" />,
  Inventory: <Boxes size={14} className="text-amber-500" />,
  Items: <Package size={14} className="text-indigo-500" />,
  Customers: <Users size={14} className="text-rose-500" />,
  Suppliers: <Building size={14} className="text-purple-500" />,
  Finance: <Landmark size={14} className="text-cyan-500" />,
};

const STORAGE_KEY = "smriti_report_builder_layout_v1";

const ReportBuilderBase: React.FC<ReportBuilderProps> = ({
  initialTitle = "Report Builder",
  initialData = DEFAULT_REPORT_BUILDER_ROWS,
  onNotification,
  onReturnToCatalog,
}) => {
  // ───────────────────────────────────────────────────────────────────────────
  // 1. Layout Visibility States (Independent Controls per Rules 1-7)
  // ───────────────────────────────────────────────────────────────────────────
  const [sidebarState, setSidebarState] = useState<SidebarState>("expanded");
  const [toolbarVisible, setToolbarVisible] = useState<boolean>(true);
  const [filtersState, setFiltersState] = useState<FiltersState>("expanded");
  const [isFocusMode, setIsFocusMode] = useState<boolean>(false);
  const [showAdvancedConfig, setShowAdvancedConfig] = useState<boolean>(false);
  const [showLayoutMenu, setShowLayoutMenu] = useState<boolean>(false);
  const [showExportMenu, setShowExportMenu] = useState<boolean>(false);

  // Remember the last non-hidden sidebar state (expanded vs collapsed) to restore on reopen
  const lastNonHiddenSidebarStateRef = useRef<"expanded" | "collapsed">("expanded");

  // Snapshot to restore previous visibility when exiting Focus Mode (Rule 6)
  const previousLayoutStateRef = useRef<{
    sidebarState: SidebarState;
    toolbarVisible: boolean;
    filtersState: FiltersState;
  }>({
    sidebarState: "expanded",
    toolbarVisible: true,
    filtersState: "expanded",
  });

  // Advanced Configuration State (Rule 4)
  const [showGrandTotal, setShowGrandTotal] = useState<boolean>(true);
  const [showSubTotals, setShowSubTotals] = useState<boolean>(true);
  const [tableDensity, setTableDensity] = useState<"compact" | "regular" | "comfortable">("regular");
  const [pageSize, setPageSize] = useState<number>(50);
  const [currencySymbol, setCurrencySymbol] = useState<string>("₹");

  // Draft state inside Advanced Settings to detect unsaved changes
  const [draftDensity, setDraftDensity] = useState<"compact" | "regular" | "comfortable">(tableDensity);
  const [draftGrandTotal, setDraftGrandTotal] = useState<boolean>(showGrandTotal);
  const [draftSubTotals, setDraftSubTotals] = useState<boolean>(showSubTotals);
  const [draftCurrencySymbol, setDraftCurrencySymbol] = useState<string>(currencySymbol);
  const [draftPageSize, setDraftPageSize] = useState<number>(pageSize);

  // Load persisted layout preferences from localStorage (Rule 7 & 8)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.sidebarState) {
          setSidebarState(parsed.sidebarState);
          if (parsed.sidebarState !== "hidden") {
            lastNonHiddenSidebarStateRef.current = parsed.sidebarState;
          }
        }
        if (typeof parsed.toolbarVisible === "boolean") setToolbarVisible(parsed.toolbarVisible);
        if (parsed.filtersState) setFiltersState(parsed.filtersState);
        if (parsed.tableDensity) {
          setTableDensity(parsed.tableDensity);
          setDraftDensity(parsed.tableDensity);
        }
        if (typeof parsed.showGrandTotal === "boolean") {
          setShowGrandTotal(parsed.showGrandTotal);
          setDraftGrandTotal(parsed.showGrandTotal);
        }
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Responsive small-screen adaptation: auto-collapse sidebar if screen < 768px
  useEffect(() => {
    const handleResize = () => {
      if (typeof window !== "undefined" && window.innerWidth < 768) {
        if (sidebarState === "expanded") {
          setSidebarState("collapsed");
        }
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [sidebarState]);

  // Persist layout state when changed (unless in temporary Focus Mode)
  const persistLayout = (updates: Partial<{
    sidebarState: SidebarState;
    toolbarVisible: boolean;
    filtersState: FiltersState;
    tableDensity: "compact" | "regular" | "comfortable";
    showGrandTotal: boolean;
  }>) => {
    try {
      const current = {
        sidebarState,
        toolbarVisible,
        filtersState,
        tableDensity,
        showGrandTotal,
        ...updates,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    } catch {
      // Ignore
    }
  };

  // ───────────────────────────────────────────────────────────────────────────
  // 2. Field Selection & Category Tree State
  // ───────────────────────────────────────────────────────────────────────────
  const [selectedFieldKeys, setSelectedFieldKeys] = useState<string[]>([
    "supplier", "po_date", "article_sku", "color", "size", "quantity", "net_amount"
  ]);
  const [fieldSearchTerm, setFieldSearchTerm] = useState<string>("");
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    Purchase: true,
    Sales: false,
    Inventory: false,
    Items: false,
    Customers: false,
    Suppliers: false,
    Finance: false,
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Filters State: Applied vs Draft / Unsaved Edits (Rule 3)
  // ───────────────────────────────────────────────────────────────────────────
  const [appliedDateRange, setAppliedDateRange] = useState({ start: "2025-04-01", end: "2025-04-30" });
  const [appliedBranch, setAppliedBranch] = useState<string>("Main Store");
  const [draftDateRange, setDraftDateRange] = useState({ start: "2025-04-01", end: "2025-04-30" });
  const [draftBranch, setDraftBranch] = useState<string>("Main Store");

  // Check if draft filter differs from applied filter
  const isFilterDirty = useMemo(() => {
    return (
      draftDateRange.start !== appliedDateRange.start ||
      draftDateRange.end !== appliedDateRange.end ||
      draftBranch !== appliedBranch
    );
  }, [draftDateRange, appliedDateRange, draftBranch, appliedBranch]);

  const activeFiltersCount = 2;

  // Apply draft filters
  const handleApplyFilters = () => {
    setAppliedDateRange({ ...draftDateRange });
    setAppliedBranch(draftBranch);
    onNotification?.("success", `Filters applied: ${draftBranch}, ${formatDate(draftDateRange.start)} to ${formatDate(draftDateRange.end)}`);
  };

  // Reset draft filters to currently applied
  const handleResetDraftFilters = () => {
    setDraftDateRange({ ...appliedDateRange });
    setDraftBranch(appliedBranch);
  };

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Data, Sorting & Grid State (Rule 5)
  // ───────────────────────────────────────────────────────────────────────────
  const [data, setData] = useState<ReportBuilderRow[]>(initialData);
  const [sortField, setSortField] = useState<string>("supplier");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isSavedView, setIsSavedView] = useState<boolean>(false);

  // Close menus when clicking outside
  const layoutMenuRef = useRef<HTMLDivElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (layoutMenuRef.current && !layoutMenuRef.current.contains(e.target as Node)) {
        setShowLayoutMenu(false);
      }
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Keyboard shortcut listener (Escape closes modals and exits Focus Mode)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showAdvancedConfig) {
          handleCloseAdvancedConfig();
        }
        if (showLayoutMenu) setShowLayoutMenu(false);
        if (showExportMenu) setShowExportMenu(false);
        if (isFocusMode) handleToggleFocusMode();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showAdvancedConfig, showLayoutMenu, showExportMenu, isFocusMode]);

  // Active columns resolved from catalog
  const activeColumns = useMemo(() => {
    return selectedFieldKeys
      .map((key) => REPORT_BUILDER_CATALOG_FIELDS.find((f) => f.key === key))
      .filter((f): f is ReportBuilderField => !!f);
  }, [selectedFieldKeys]);

  // Filtered fields in sidebar based on search query
  const filteredCatalogFields = useMemo(() => {
    if (!fieldSearchTerm.trim()) return REPORT_BUILDER_CATALOG_FIELDS;
    const lower = fieldSearchTerm.toLowerCase();
    return REPORT_BUILDER_CATALOG_FIELDS.filter(
      (f) =>
        f.label.toLowerCase().includes(lower) ||
        f.category.toLowerCase().includes(lower) ||
        f.key.toLowerCase().includes(lower)
    );
  }, [fieldSearchTerm]);

  // Grouped fields by category
  const categoriesList = useMemo(() => {
    const categories: Record<string, ReportBuilderField[]> = {
      Purchase: [],
      Sales: [],
      Inventory: [],
      Items: [],
      Customers: [],
      Suppliers: [],
      Finance: [],
    };
    filteredCatalogFields.forEach((f) => {
      if (categories[f.category]) {
        categories[f.category].push(f);
      }
    });
    return categories;
  }, [filteredCatalogFields]);

  // Sorted and filtered rows
  const displayRows = useMemo(() => {
    const sorted = [...data];
    if (sortField) {
      sorted.sort((a, b) => {
        const valA = a[sortField];
        const valB = b[sortField];
        if (valA === valB) return 0;
        if (valA === null || valA === undefined) return 1;
        if (valB === null || valB === undefined) return -1;
        if (typeof valA === "number" && typeof valB === "number") {
          return sortDirection === "asc" ? valA - valB : valB - valA;
        }
        return sortDirection === "asc"
          ? String(valA).localeCompare(String(valB))
          : String(valB).localeCompare(String(valA));
      });
    }
    return sorted;
  }, [data, sortField, sortDirection]);

  // Total Row Calculations (Grand totals matching mockup: 132 units, ₹66,500)
  const totals = useMemo(() => {
    const res: Record<string, number> = {};
    activeColumns.forEach((col) => {
      if (col.isSummary) {
        res[col.key] = displayRows.reduce((acc, row) => acc + (Number(row[col.key]) || 0), 0);
      }
    });
    return res;
  }, [activeColumns, displayRows]);

  // Toggle field selection
  const handleToggleField = (key: string) => {
    setSelectedFieldKeys((prev) => {
      if (prev.includes(key)) {
        if (prev.length <= 1) {
          onNotification?.("info", "At least one column must remain in the report grid.");
          return prev;
        }
        return prev.filter((k) => k !== key);
      } else {
        return [...prev, key];
      }
    });
  };

  // Remove field chip
  const handleRemoveField = (key: string) => {
    if (selectedFieldKeys.length <= 1) {
      onNotification?.("info", "At least one column must remain selected.");
      return;
    }
    setSelectedFieldKeys((prev) => prev.filter((k) => k !== key));
  };

  // Reorder field columns left or right
  const handleMoveColumn = (key: string, direction: "left" | "right") => {
    setSelectedFieldKeys((prev) => {
      const idx = prev.indexOf(key);
      if (idx === -1) return prev;
      const targetIdx = direction === "left" ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= prev.length) return prev;
      const copy = [...prev];
      const temp = copy[idx];
      copy[idx] = copy[targetIdx];
      copy[targetIdx] = temp;
      return copy;
    });
  };

  // ───────────────────────────────────────────────────────────────────────────
  // 5. Sidebar State Updates with Non-Hidden State Memory (Rule 1)
  // ───────────────────────────────────────────────────────────────────────────
  const updateSidebarState = (newState: SidebarState) => {
    if (newState !== "hidden") {
      lastNonHiddenSidebarStateRef.current = newState;
    }
    setSidebarState(newState);
    persistLayout({ sidebarState: newState });
  };

  const handleReopenSidebar = () => {
    const targetState = lastNonHiddenSidebarStateRef.current || "expanded";
    setSidebarState(targetState);
    persistLayout({ sidebarState: targetState });
    onNotification?.("info", `Restored sidebar to ${targetState} mode.`);
  };

  // ───────────────────────────────────────────────────────────────────────────
  // 6. Focus Mode Logic (Rule 6)
  // ───────────────────────────────────────────────────────────────────────────
  const handleToggleFocusMode = () => {
    if (!isFocusMode) {
      // Save current layout states
      previousLayoutStateRef.current = {
        sidebarState,
        toolbarVisible,
        filtersState,
      };
      setSidebarState("hidden");
      setToolbarVisible(false);
      setFiltersState("hidden");
      setShowAdvancedConfig(false);
      setIsFocusMode(true);
      onNotification?.("info", "Focus Mode enabled. Max usable grid space active.");
    } else {
      // Restore previous layout states
      const prev = previousLayoutStateRef.current;
      setSidebarState(prev.sidebarState);
      setToolbarVisible(prev.toolbarVisible);
      setFiltersState(prev.filtersState);
      setIsFocusMode(false);
      onNotification?.("info", "Exited Focus Mode. Restored previous workspace panels.");
    }
  };

  // ───────────────────────────────────────────────────────────────────────────
  // 7. Layout Presets Switching: Both, Vertical, Horizontal, Focus (Rule 7)
  // ───────────────────────────────────────────────────────────────────────────
  const currentPreset: LayoutPreset = useMemo(() => {
    if (isFocusMode) return "focus";
    if (sidebarState === "expanded" && toolbarVisible && filtersState === "expanded") return "both";
    if (sidebarState === "hidden" && toolbarVisible && filtersState === "expanded") return "vertical";
    if (sidebarState === "expanded" && !toolbarVisible && filtersState === "compact") return "horizontal";
    return "custom";
  }, [isFocusMode, sidebarState, toolbarVisible, filtersState]);

  const handleApplyPreset = (preset: "both" | "vertical" | "horizontal" | "focus") => {
    setShowLayoutMenu(false);
    if (preset === "focus") {
      if (!isFocusMode) handleToggleFocusMode();
      return;
    }

    if (isFocusMode) {
      setIsFocusMode(false);
    }

    if (preset === "both") {
      updateSidebarState("expanded");
      setToolbarVisible(true);
      setFiltersState("expanded");
      persistLayout({ sidebarState: "expanded", toolbarVisible: true, filtersState: "expanded" });
      onNotification?.("info", "Switched to Both / Adaptive layout (Recommended Default).");
    } else if (preset === "vertical") {
      setSidebarState("hidden");
      setToolbarVisible(true);
      setFiltersState("expanded");
      persistLayout({ sidebarState: "hidden", toolbarVisible: true, filtersState: "expanded" });
      onNotification?.("info", "Switched to Vertical layout (Full-width stacked).");
    } else if (preset === "horizontal") {
      updateSidebarState("expanded");
      setToolbarVisible(false);
      setFiltersState("compact");
      persistLayout({ sidebarState: "expanded", toolbarVisible: false, filtersState: "compact" });
      onNotification?.("info", "Switched to Horizontal layout (Sidebar priority).");
    }
  };

  // Reset Layout Logic (Rule 7)
  const handleResetLayout = () => {
    updateSidebarState("expanded");
    setToolbarVisible(true);
    setFiltersState("expanded");
    setIsFocusMode(false);
    setTableDensity("regular");
    setShowGrandTotal(true);
    setShowSubTotals(true);
    setCurrencySymbol("₹");
    setPageSize(50);
    setShowLayoutMenu(false);
    persistLayout({
      sidebarState: "expanded",
      toolbarVisible: true,
      filtersState: "expanded",
      tableDensity: "regular",
      showGrandTotal: true,
    });
    onNotification?.("success", "Layout reset to default Both/Adaptive view.");
  };

  // ───────────────────────────────────────────────────────────────────────────
  // 8. Advanced Settings Drawer Logic (Rule 4)
  // ───────────────────────────────────────────────────────────────────────────
  const handleOpenAdvancedConfig = () => {
    setDraftDensity(tableDensity);
    setDraftGrandTotal(showGrandTotal);
    setDraftSubTotals(showSubTotals);
    setDraftCurrencySymbol(currencySymbol);
    setDraftPageSize(pageSize);
    setShowAdvancedConfig(true);
  };

  const isAdvancedDirty = useMemo(() => {
    return (
      draftDensity !== tableDensity ||
      draftGrandTotal !== showGrandTotal ||
      draftSubTotals !== showSubTotals ||
      draftCurrencySymbol !== currencySymbol ||
      draftPageSize !== pageSize
    );
  }, [draftDensity, tableDensity, draftGrandTotal, showGrandTotal, draftSubTotals, showSubTotals, draftCurrencySymbol, currencySymbol, draftPageSize, pageSize]);

  const handleCloseAdvancedConfig = () => {
    if (isAdvancedDirty) {
      if (confirm("You have unsaved changes in Advanced Settings. Discard them?")) {
        setShowAdvancedConfig(false);
      }
    } else {
      setShowAdvancedConfig(false);
    }
  };

  const handleSaveAdvancedConfig = () => {
    setTableDensity(draftDensity);
    setShowGrandTotal(draftGrandTotal);
    setShowSubTotals(draftSubTotals);
    setCurrencySymbol(draftCurrencySymbol);
    setPageSize(draftPageSize);
    setShowAdvancedConfig(false);
    persistLayout({
      tableDensity: draftDensity,
      showGrandTotal: draftGrandTotal,
    });
    onNotification?.("success", "Advanced report settings saved and applied.");
  };

  // ───────────────────────────────────────────────────────────────────────────
  // 9. Export Handlers
  // ───────────────────────────────────────────────────────────────────────────
  const handleExport = async (format: "xlsx" | "csv" | "pdf" | "gsheet") => {
    setShowExportMenu(false);
    if (format === "pdf") {
      window.print();
      onNotification?.("success", `Dispatching print spool for ${initialTitle}.`);
      return;
    }
    const exportColumns = activeColumns.map((col) => ({
      key: col.key,
      label: col.label,
      datatype: col.datatype as any,
    }));
    await GlobalExportService.exportDataset({
      moduleName: "SMRITI_Report_Builder",
      format: format as "xlsx" | "csv" | "gsheet",
      scope: "all",
      columns: exportColumns,
      data: displayRows,
      metadata: {
        moduleTitle: initialTitle,
        companyName: "SMRITI Retail OS",
        exportTimestamp: new Date().toLocaleString(),
      },
    });
    onNotification?.("success", `Exporting ${initialTitle} in ${format.toUpperCase()} format.`);
  };

  return (
    <div className="w-full flex flex-col bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden font-sans text-slate-800 dark:text-slate-100 shadow-sm min-h-[640px]">
      
      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* 1. TOP HEADER & PRIMARY ACTION TOOLBAR (Max 7 Primary Actions)         */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-850 border-b border-slate-200 dark:border-slate-700 px-4 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5">
          {/* Reopen Sidebar Icon Button (Shown when sidebar is hidden per Rule 1) */}
          {sidebarState === "hidden" && !isFocusMode && (
            <button
              type="button"
              id="report-builder-show-sidebar-btn"
              onClick={handleReopenSidebar}
              className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title={`Show sidebar (restore ${lastNonHiddenSidebarStateRef.current})`}
              aria-label="Show sidebar"
            >
              <Menu size={18} />
            </button>
          )}

          {onReturnToCatalog && (
            <button
              type="button"
              onClick={onReturnToCatalog}
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg text-xs"
              title="Back to BI Hub"
            >
              <ChevronLeft size={16} />
            </button>
          )}

          <div className="flex items-center gap-2">
            <span className="p-1 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-lg">
              <FileText size={18} />
            </span>
            <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
              {initialTitle}
            </h2>
            {isFocusMode && (
              <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold rounded-full border border-indigo-200 dark:border-indigo-800">
                FOCUS MODE
              </span>
            )}
          </div>
        </div>

        {/* Primary Action Buttons Bar (Max 7 buttons: Run, Save, Export, Layout, Filters, Settings, Focus) */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Action 1: Run */}
          <button
            type="button"
            id="report-builder-run-btn"
            onClick={() => onNotification?.("success", "Report query executed with current filters and columns.")}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
            title="Execute query and refresh data"
          >
            <Play size={13} className="fill-current" />
            <span>Run</span>
          </button>

          {/* Action 2: Save View */}
          <button
            type="button"
            id="report-builder-save-view-btn"
            onClick={() => {
              setIsSavedView(true);
              onNotification?.("success", "Report layout and column configuration saved.");
            }}
            className={`px-3 py-1.5 border rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
              isSavedView
                ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300"
                : "bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750"
            }`}
            title="Save current columns, filters, and layout"
          >
            <Save size={13} />
            <span>{isSavedView ? "Saved" : "Save View"}</span>
          </button>

          {/* Action 3: Export ▾ */}
          <div className="relative" ref={exportMenuRef}>
            <button
              type="button"
              id="report-builder-export-btn"
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
              aria-expanded={showExportMenu}
              aria-haspopup="true"
            >
              <span>Export</span>
              <ChevronDown size={13} />
            </button>

            {showExportMenu && (
              <div className="absolute right-0 top-full mt-1.5 w-44 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl py-1 z-30 text-xs">
                <button
                  type="button"
                  onClick={() => handleExport("xlsx")}
                  className="w-full text-left px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center gap-2 cursor-pointer"
                >
                  <TableProperties size={14} className="text-emerald-600" /> Excel (.xlsx)
                </button>
                <button
                  type="button"
                  onClick={() => handleExport("csv")}
                  className="w-full text-left px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center gap-2 cursor-pointer"
                >
                  <FileSpreadsheet size={14} className="text-blue-600" /> CSV Format
                </button>
                <button
                  type="button"
                  onClick={() => handleExport("pdf")}
                  className="w-full text-left px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center gap-2 cursor-pointer"
                >
                  <Printer size={14} className="text-rose-600" /> PDF / Print
                </button>
                <button
                  type="button"
                  onClick={() => handleExport("gsheet")}
                  className="w-full text-left px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center gap-2 cursor-pointer"
                >
                  <ExternalLink size={14} className="text-amber-600" /> Google Sheets
                </button>
              </div>
            )}
          </div>

          {/* Action 4: Layout ▾ (Rule 7 Presets + Granular Panel Toggles) */}
          <div className="relative" ref={layoutMenuRef}>
            <button
              type="button"
              id="report-builder-layout-menu-btn"
              onClick={() => setShowLayoutMenu(!showLayoutMenu)}
              className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
              aria-expanded={showLayoutMenu}
              aria-haspopup="true"
            >
              <span>Layout</span>
              <ChevronDown size={13} />
            </button>

            {showLayoutMenu && (
              <div className="absolute right-0 top-full mt-1.5 w-64 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl py-2 z-30 text-xs">
                {/* Presets Header */}
                <div className="px-3.5 py-1 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  Layout Presets
                </div>
                <button
                  type="button"
                  id="layout-preset-both-btn"
                  onClick={() => handleApplyPreset("both")}
                  className="w-full text-left px-3.5 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-blue-500">❖</span>
                    <span className="font-medium">Both / Adaptive (Default)</span>
                  </div>
                  {currentPreset === "both" && <Check size={14} className="text-blue-600" />}
                </button>
                <button
                  type="button"
                  id="layout-preset-vertical-btn"
                  onClick={() => handleApplyPreset("vertical")}
                  className="w-full text-left px-3.5 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-500">⬍</span>
                    <span className="font-medium">Vertical (Stacked)</span>
                  </div>
                  {currentPreset === "vertical" && <Check size={14} className="text-blue-600" />}
                </button>
                <button
                  type="button"
                  id="layout-preset-horizontal-btn"
                  onClick={() => handleApplyPreset("horizontal")}
                  className="w-full text-left px-3.5 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-amber-500">⬌</span>
                    <span className="font-medium">Horizontal (Sidebar Priority)</span>
                  </div>
                  {currentPreset === "horizontal" && <Check size={14} className="text-blue-600" />}
                </button>
                <button
                  type="button"
                  id="layout-preset-focus-btn"
                  onClick={() => handleApplyPreset("focus")}
                  className="w-full text-left px-3.5 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-indigo-500">⛶</span>
                    <span className="font-medium">Focus Mode (Max Grid)</span>
                  </div>
                  {currentPreset === "focus" && <Check size={14} className="text-blue-600" />}
                </button>

                {/* Section 1: Field Panel (Left Sidebar) */}
                <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 px-3.5 py-1 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  Field Panel (Left Sidebar)
                </div>
                <button
                  type="button"
                  id="layout-sidebar-expanded-btn"
                  onClick={() => updateSidebarState("expanded")}
                  className="w-full text-left px-3.5 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">⊞</span>
                    <span>Show (Expanded)</span>
                  </div>
                  {sidebarState === "expanded" && <Check size={14} className="text-blue-600" />}
                </button>
                <button
                  type="button"
                  id="layout-sidebar-collapsed-btn"
                  onClick={() => updateSidebarState("collapsed")}
                  className="w-full text-left px-3.5 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">⊟</span>
                    <span>Show (Collapsed Rail)</span>
                  </div>
                  {sidebarState === "collapsed" && <Check size={14} className="text-blue-600" />}
                </button>
                <button
                  type="button"
                  id="layout-sidebar-hide-btn"
                  onClick={() => updateSidebarState("hidden")}
                  className="w-full text-left px-3.5 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">⊘</span>
                    <span>Hide</span>
                  </div>
                  {sidebarState === "hidden" && <Check size={14} className="text-blue-600" />}
                </button>

                {/* Section 2: Top Field Toolbar */}
                <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 px-3.5 py-1 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  Top Field Toolbar
                </div>
                <button
                  type="button"
                  id="layout-toolbar-show-btn"
                  onClick={() => {
                    setToolbarVisible(true);
                    persistLayout({ toolbarVisible: true });
                  }}
                  className="w-full text-left px-3.5 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">⊤</span>
                    <span>Show</span>
                  </div>
                  {toolbarVisible && <Check size={14} className="text-blue-600" />}
                </button>
                <button
                  type="button"
                  id="layout-toolbar-hide-btn"
                  onClick={() => {
                    setToolbarVisible(false);
                    persistLayout({ toolbarVisible: false });
                  }}
                  className="w-full text-left px-3.5 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">⊘</span>
                    <span>Hide</span>
                  </div>
                  {!toolbarVisible && <Check size={14} className="text-blue-600" />}
                </button>

                {/* Section 3: Filters Panel */}
                <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 px-3.5 py-1 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  Filters Panel
                </div>
                <button
                  type="button"
                  id="layout-filters-show-btn"
                  onClick={() => {
                    setFiltersState("expanded");
                    persistLayout({ filtersState: "expanded" });
                  }}
                  className="w-full text-left px-3.5 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">∇</span>
                    <span>Show (Expanded)</span>
                  </div>
                  {filtersState === "expanded" && <Check size={14} className="text-blue-600" />}
                </button>
                <button
                  type="button"
                  id="layout-filters-compact-btn"
                  onClick={() => {
                    setFiltersState("compact");
                    persistLayout({ filtersState: "compact" });
                  }}
                  className="w-full text-left px-3.5 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">⊝</span>
                    <span>Show (Compact)</span>
                  </div>
                  {filtersState === "compact" && <Check size={14} className="text-blue-600" />}
                </button>
                <button
                  type="button"
                  id="layout-filters-hide-btn"
                  onClick={() => {
                    setFiltersState("hidden");
                    persistLayout({ filtersState: "hidden" });
                  }}
                  className="w-full text-left px-3.5 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">⊘</span>
                    <span>Hide</span>
                  </div>
                  {filtersState === "hidden" && <Check size={14} className="text-blue-600" />}
                </button>

                {/* Section 4: Reset Layout */}
                <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    id="layout-reset-btn"
                    onClick={handleResetLayout}
                    className="w-full text-left px-3.5 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-600 dark:text-slate-300 flex items-center gap-2 font-medium cursor-pointer"
                  >
                    <RotateCcw size={13} className="text-slate-400" />
                    <span>Reset Layout</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Action 5: Filters (2) Toggle Button (Rule 3) */}
          <button
            type="button"
            id="report-builder-filters-toggle-btn"
            onClick={() => {
              const nextState: FiltersState = filtersState === "hidden" ? "expanded" : "hidden";
              setFiltersState(nextState);
              persistLayout({ filtersState: nextState });
            }}
            className={`px-3 py-1.5 border rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
              filtersState !== "hidden"
                ? "bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300"
                : "bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750"
            }`}
            title="Toggle Filters Panel"
          >
            <Filter size={13} />
            <span>Filters ({activeFiltersCount})</span>
            {isFilterDirty && (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" title="Unsaved filter edits" />
            )}
          </button>

          {/* Action 6: Advanced Config Gear (⚙) (Rule 4) */}
          <button
            type="button"
            id="report-builder-config-btn"
            onClick={handleOpenAdvancedConfig}
            className={`p-2 border rounded-lg transition-colors cursor-pointer ${
              showAdvancedConfig
                ? "bg-blue-50 dark:bg-blue-950/40 border-blue-400 text-blue-600 dark:text-blue-400"
                : "bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750"
            }`}
            title="Advanced Configuration"
            aria-label="Advanced Configuration"
          >
            <Settings size={14} />
          </button>

          {/* Action 7: Focus Mode Control (Rule 6) */}
          <button
            type="button"
            id="report-builder-focus-mode-btn"
            onClick={handleToggleFocusMode}
            className={`px-3 py-1.5 border rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
              isFocusMode
                ? "bg-indigo-600 text-white border-indigo-700 shadow-sm hover:bg-indigo-700"
                : "bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750"
            }`}
            title={isFocusMode ? "Exit Focus Mode (restore panels)" : "Enter Focus Mode (maximize grid space)"}
          >
            {isFocusMode ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            <span>{isFocusMode ? "Exit Focus" : "Focus"}</span>
          </button>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* 2. MAIN WORKSPACE CONTAINER (Sidebar + Center Content)                 */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden relative">

        {/* ── LEFT PANEL: AVAILABLE FIELDS SIDEBAR (Rule 1) ─────────────────── */}
        {sidebarState === "expanded" && (
          <aside className="w-64 border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 flex flex-col shrink-0 relative transition-all duration-200 select-none">
            {/* Search Input Box */}
            <div className="p-3 border-b border-slate-200 dark:border-slate-700">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search fields..."
                  value={fieldSearchTerm}
                  onChange={(e) => setFieldSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-7 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                />
                {fieldSearchTerm && (
                  <button
                    type="button"
                    onClick={() => setFieldSearchTerm("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* Tree Categories List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1 text-xs">
              {Object.entries(categoriesList).map(([category, catFields]) => {
                if (catFields.length === 0) return null;
                const isCatOpen = expandedCategories[category] !== false;

                return (
                  <div key={category} className="rounded-lg overflow-hidden">
                    {/* Category Header Accordion */}
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedCategories((prev) => ({
                          ...prev,
                          [category]: !isCatOpen,
                        }))
                      }
                      className="w-full px-2.5 py-1.5 flex items-center justify-between text-left hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md font-semibold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        {isCatOpen ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
                        <span>{category}</span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                        {catFields.length}
                      </span>
                    </button>

                    {/* Fields List inside category */}
                    {isCatOpen && (
                      <div className="pl-6 pr-1 py-0.5 space-y-0.5">
                        {catFields.map((field) => {
                          const isSelected = selectedFieldKeys.includes(field.key);

                          return (
                            <div
                              key={field.id}
                              onClick={() => handleToggleField(field.key)}
                              className={`group px-2 py-1.5 rounded-md flex items-center justify-between text-xs cursor-pointer transition-colors ${
                                isSelected
                                  ? "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-medium"
                                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200"
                              }`}
                            >
                              <div className="flex items-center gap-2 truncate">
                                {/* Type indicator icon */}
                                <span className={`text-[10px] font-mono font-bold w-4 text-center ${
                                  field.iconType === "number" ? "text-emerald-500" :
                                  field.iconType === "date" ? "text-purple-500" :
                                  field.iconType === "doc" ? "text-amber-500" : "text-blue-500"
                                }`}>
                                  {field.iconType === "number" ? "#" :
                                   field.iconType === "date" ? "📅" :
                                   field.iconType === "doc" ? "📄" : "T"}
                                </span>
                                <span className="truncate">{field.label}</span>
                              </div>

                              <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100">
                                {isSelected ? (
                                  <Check size={13} className="text-blue-600 dark:text-blue-400" />
                                ) : (
                                  <GripVertical size={13} className="text-slate-300 dark:text-slate-600" />
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Circular Collapse Sidebar Button positioned on border (Mockup 1) */}
            <button
              type="button"
              id="report-builder-collapse-sidebar-circle-btn"
              onClick={() => updateSidebarState("hidden")}
              className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-white dark:bg-slate-850 border border-slate-300 dark:border-slate-600 shadow-md flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-white cursor-pointer z-10"
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
            >
              <ChevronLeft size={14} />
            </button>
          </aside>
        )}

        {/* ── COMPACT ICON RAIL SIDEBAR (Collapsed mode per Rule 1) ─────────── */}
        {sidebarState === "collapsed" && (
          <aside className="w-12 border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 flex flex-col items-center py-3 shrink-0 select-none gap-3">
            <button
              type="button"
              onClick={() => updateSidebarState("expanded")}
              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
              title="Expand field sidebar"
            >
              <ChevronRight size={16} />
            </button>

            <div className="w-6 border-b border-slate-200 dark:border-slate-700" />

            {Object.keys(categoriesList).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  updateSidebarState("expanded");
                  setExpandedCategories((prev) => ({ ...prev, [cat]: true }));
                }}
                className="p-2 text-slate-600 dark:text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                title={`${cat} Fields`}
              >
                {CATEGORY_ICONS[cat]}
              </button>
            ))}
          </aside>
        )}

        {/* ── RIGHT MAIN WORKSPACE: TOOLBAR, FILTERS & GRID ─────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0 bg-slate-50 dark:bg-slate-900">

          {/* ── TOP FIELD TOOLBAR (Rule 2 - Mockup 1 & 2) ───────────────────── */}
          {toolbarVisible ? (
            <div className="bg-white dark:bg-slate-850 border-b border-slate-200 dark:border-slate-700 px-4 py-2 flex items-center justify-between gap-3 shrink-0 overflow-x-auto">
              <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
                {activeColumns.map((col, idx) => (
                  <div
                    key={col.key}
                    className="inline-flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 px-2.5 py-1 rounded-md text-xs font-medium shrink-0 group hover:border-slate-300"
                  >
                    <GripVertical size={11} className="text-slate-400 cursor-grab" />
                    <span>{col.label}</span>

                    {/* Column Reordering Buttons */}
                    <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                      {idx > 0 && (
                        <button
                          type="button"
                          onClick={() => handleMoveColumn(col.key, "left")}
                          className="text-slate-400 hover:text-slate-700 p-0.5"
                          title="Move column left"
                        >
                          <ChevronLeft size={11} />
                        </button>
                      )}
                      {idx < activeColumns.length - 1 && (
                        <button
                          type="button"
                          onClick={() => handleMoveColumn(col.key, "right")}
                          className="text-slate-400 hover:text-slate-700 p-0.5"
                          title="Move column right"
                        >
                          <ChevronRight size={11} />
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveField(col.key)}
                      className="text-slate-400 hover:text-rose-500 rounded p-0.5 transition-colors cursor-pointer"
                      title={`Remove ${col.label}`}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Collapse Toolbar Control (^) */}
              <button
                type="button"
                id="report-builder-collapse-toolbar-btn"
                onClick={() => {
                  setToolbarVisible(false);
                  persistLayout({ toolbarVisible: false });
                }}
                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
                title="Collapse field toolbar"
              >
                <ChevronUp size={16} />
              </button>
            </div>
          ) : (
            /* Reopen Top Field Toolbar Control (Rule 2 - Mockup 3) */
            <div className="bg-white dark:bg-slate-850 border-b border-slate-200 dark:border-slate-700 px-4 py-1.5 flex items-center justify-between text-xs shrink-0">
              <span className="text-[11px] text-slate-400 font-mono">
                {activeColumns.length} columns active in grid
              </span>
              <button
                type="button"
                id="report-builder-show-toolbar-btn"
                onClick={() => {
                  setToolbarVisible(true);
                  persistLayout({ toolbarVisible: true });
                }}
                className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Show field toolbar"
              >
                <span>Show Fields</span>
                <ChevronDown size={13} />
              </button>
            </div>
          )}

          {/* ── FILTERS PANEL (Rule 3 - Mockup 1, 2, 4) ────────────────────── */}
          {filtersState === "expanded" && (
            <div className="bg-white dark:bg-slate-850 border-b border-slate-200 dark:border-slate-700 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
              <div className="flex flex-wrap items-center gap-3">
                {/* Date range filter */}
                <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-medium">
                  <span className="text-slate-400">Date:</span>
                  <input
                    type="date"
                    value={draftDateRange.start}
                    onChange={(e) => setDraftDateRange((prev) => ({ ...prev, start: e.target.value }))}
                    className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-0.5 text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                  <span className="text-slate-400">to</span>
                  <input
                    type="date"
                    value={draftDateRange.end}
                    onChange={(e) => setDraftDateRange((prev) => ({ ...prev, end: e.target.value }))}
                    className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-0.5 text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <span className="text-slate-300 dark:text-slate-700">|</span>

                {/* Branch filter */}
                <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-medium">
                  <span className="text-slate-400">Branch:</span>
                  <select
                    value={draftBranch}
                    onChange={(e) => setDraftBranch(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-slate-800 dark:text-slate-200 font-medium focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="Main Store">Main Store</option>
                    <option value="Store B">Store B</option>
                    <option value="Central Godown">Central Godown</option>
                    <option value="All Branches">All Branches</option>
                  </select>
                </div>

                {/* Add Filter Button */}
                <button
                  type="button"
                  onClick={() => onNotification?.("info", "Additional dimensional filter conditions can be configured here.")}
                  className="px-2.5 py-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-md font-semibold transition-colors cursor-pointer"
                >
                  + Add Filter ▾
                </button>

                {/* Unsaved Filter Changes & Apply Button (Rule 3) */}
                {isFilterDirty && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                      <AlertCircle size={12} />
                      Unsaved filter edits
                    </span>
                    <button
                      type="button"
                      id="report-builder-apply-filters-btn"
                      onClick={handleApplyFilters}
                      className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-xs shadow-2xs transition-colors cursor-pointer"
                    >
                      Apply Filters
                    </button>
                    <button
                      type="button"
                      onClick={handleResetDraftFilters}
                      className="px-2 py-1 text-slate-500 hover:text-slate-800 text-xs"
                      title="Discard filter edits"
                    >
                      Reset
                    </button>
                  </div>
                )}
              </div>

              {/* Collapse filters button */}
              <button
                type="button"
                onClick={() => {
                  setFiltersState("compact");
                  persistLayout({ filtersState: "compact" });
                }}
                className="text-slate-400 hover:text-slate-600 text-xs font-medium cursor-pointer"
                title="Collapse filters to compact summary"
              >
                Compact View
              </button>
            </div>
          )}

          {filtersState === "compact" && (
            /* Compact Filter Summary Bar (Rule 3) */
            <div className="bg-white dark:bg-slate-850 border-b border-slate-200 dark:border-slate-700 px-4 py-1.5 flex items-center justify-between text-xs text-slate-500 shrink-0">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[11px] font-mono">
                  <Filter size={10} className="text-blue-500" />
                  <span>{formatDate(appliedDateRange.start)} – {formatDate(appliedDateRange.end)} · {appliedBranch}</span>
                </span>
                <span className="text-[11px] text-slate-400">(2 filters applied)</span>
              </div>
              <button
                type="button"
                id="report-builder-expand-filters-btn"
                onClick={() => {
                  setFiltersState("expanded");
                  persistLayout({ filtersState: "expanded" });
                }}
                className="px-2 py-0.5 text-blue-600 hover:text-blue-700 font-medium hover:underline cursor-pointer"
              >
                Expand filters
              </button>
            </div>
          )}

          {/* ── REPORT GRID (Rule 5 - Always Primary Workspace) ─────────────── */}
          <div className="flex-1 overflow-auto bg-white dark:bg-slate-850 flex flex-col justify-between">
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 font-semibold border-b border-slate-200 dark:border-slate-700 select-none">
                    {activeColumns.map((col) => {
                      const isSorted = sortField === col.key;
                      return (
                        <th
                          key={col.key}
                          onClick={() => {
                            if (isSorted) {
                              setSortDirection(sortDirection === "asc" ? "desc" : "asc");
                            } else {
                              setSortField(col.key);
                              setSortDirection("asc");
                            }
                          }}
                          className={`px-4 ${tableDensity === "compact" ? "py-2" : tableDensity === "comfortable" ? "py-3.5" : "py-2.5"} ${
                            col.align === "right" ? "text-right" : "text-left"
                          } hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer transition-colors whitespace-nowrap`}
                        >
                          <div className={`inline-flex items-center gap-1.5 ${col.align === "right" ? "justify-end" : "justify-start"}`}>
                            <span>{col.label}</span>
                            {isSorted && (
                              <span className="text-blue-600 font-bold">
                                {sortDirection === "asc" ? "↑" : "↓"}
                              </span>
                            )}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-200">
                  {displayRows.length === 0 ? (
                    <tr>
                      <td colSpan={activeColumns.length} className="px-4 py-12 text-center text-slate-400 font-mono">
                        No records match the active criteria.
                      </td>
                    </tr>
                  ) : (
                    displayRows.map((row) => (
                      <tr
                        key={row.id}
                        className="hover:bg-blue-50/40 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        {activeColumns.map((col) => {
                          const val = row[col.key];
                          let formattedVal: React.ReactNode = val ?? "—";

                          if (col.datatype === "currency" && typeof val === "number") {
                            formattedVal = `${currencySymbol}${val.toLocaleString("en-IN")}`;
                          } else if (col.datatype === "number" && typeof val === "number") {
                            formattedVal = val.toLocaleString("en-IN");
                          } else if (col.datatype === "date" && val) {
                            formattedVal = formatDate(String(val));
                          }

                          return (
                            <td
                              key={col.key}
                              className={`px-4 ${tableDensity === "compact" ? "py-1.5" : tableDensity === "comfortable" ? "py-3" : "py-2.5"} ${
                                col.align === "right" ? "text-right font-mono" : "text-left"
                              } ${col.key === "net_amount" ? "font-semibold text-slate-900 dark:text-white" : ""}`}
                            >
                              {formattedVal}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>

                {/* Footer Total Row (Matching Mockup 1 & 2: Quantity: 132, Net Amount: ₹66,500) */}
                {showGrandTotal && displayRows.length > 0 && (
                  <tfoot>
                    <tr className="bg-slate-50 dark:bg-slate-800/90 font-bold border-t-2 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white">
                      {activeColumns.map((col, idx) => {
                        if (idx === 0) {
                          return (
                            <td key={col.key} className="px-4 py-2.5 font-bold text-slate-900 dark:text-white">
                              Total
                            </td>
                          );
                        }

                        if (col.isSummary && totals[col.key] !== undefined) {
                          const sumVal = totals[col.key];
                          return (
                            <td key={col.key} className="px-4 py-2.5 text-right font-mono font-bold">
                              {col.datatype === "currency"
                                ? `${currencySymbol}${sumVal.toLocaleString("en-IN")}`
                                : sumVal.toLocaleString("en-IN")}
                            </td>
                          );
                        }

                        return <td key={col.key} className="px-4 py-2.5" />;
                      })}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {/* Pagination Controls Footer Bar (Matching Mockup 1 & 2) */}
            <div className="border-t border-slate-200 dark:border-slate-700 px-4 py-2.5 flex items-center justify-between text-xs text-slate-500 bg-white dark:bg-slate-850 shrink-0">
              <span className="font-mono">
                1 - {displayRows.length} of {displayRows.length} rows
              </span>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                    className="p-1 border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-50 disabled:opacity-30 cursor-pointer"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-950/40 text-blue-600 font-bold rounded border border-blue-200 dark:border-blue-800">
                    {currentPage}
                  </span>
                  <button
                    type="button"
                    disabled
                    className="p-1 border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-50 disabled:opacity-30 cursor-pointer"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>

                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-slate-700 dark:text-slate-200 font-medium cursor-pointer"
                >
                  <option value={25}>25 / page</option>
                  <option value={50}>50 / page</option>
                  <option value={100}>100 / page</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* 3. ADVANCED CONFIGURATION DRAWER (Rule 4)                               */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      {showAdvancedConfig && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-2xs flex justify-end">
          <div className="w-84 max-w-full bg-white dark:bg-slate-850 border-l border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col justify-between p-5 text-xs">
            <div className="space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2">
                  <Settings size={16} className="text-blue-600" />
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                    Advanced Settings
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={handleCloseAdvancedConfig}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
                  title="Close (Esc)"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Table Density */}
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700 dark:text-slate-300">Table Density</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(["compact", "regular", "comfortable"] as const).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDraftDensity(d)}
                      className={`py-1.5 rounded-lg border text-xs capitalize font-medium transition-colors cursor-pointer ${
                        draftDensity === d
                          ? "bg-blue-50 dark:bg-blue-950/40 border-blue-500 text-blue-700 dark:text-blue-300"
                          : "border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              {/* Aggregations */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <span className="font-semibold text-slate-700 dark:text-slate-300 block">Totals & Aggregations</span>
                <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={draftGrandTotal}
                    onChange={(e) => setDraftGrandTotal(e.target.checked)}
                    className="rounded text-blue-600"
                  />
                  <span>Show Grand Total Row</span>
                </label>
                <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={draftSubTotals}
                    onChange={(e) => setDraftSubTotals(e.target.checked)}
                    className="rounded text-blue-600"
                  />
                  <span>Show Sub-totals for Grouping</span>
                </label>
              </div>

              {/* Currency Symbol */}
              <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                <label className="font-semibold text-slate-700 dark:text-slate-300">Currency Display</label>
                <div className="flex items-center gap-2">
                  {(["₹", "$", "€"] as const).map((sym) => (
                    <button
                      key={sym}
                      type="button"
                      onClick={() => setDraftCurrencySymbol(sym)}
                      className={`px-3 py-1 rounded-md border font-mono font-bold cursor-pointer ${
                        draftCurrencySymbol === sym
                          ? "bg-blue-600 text-white border-blue-600"
                          : "border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {sym}
                    </button>
                  ))}
                </div>
              </div>

              {/* Page Size */}
              <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                <label className="font-semibold text-slate-700 dark:text-slate-300">Default Page Size</label>
                <select
                  value={draftPageSize}
                  onChange={(e) => setDraftPageSize(Number(e.target.value))}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-700 dark:text-slate-200 font-medium cursor-pointer"
                >
                  <option value={25}>25 rows</option>
                  <option value={50}>50 rows</option>
                  <option value={100}>100 rows</option>
                </select>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-slate-700 flex items-center gap-2">
              <button
                type="button"
                onClick={handleSaveAdvancedConfig}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-xs transition-colors cursor-pointer"
              >
                Save Settings
              </button>
              <button
                type="button"
                onClick={handleCloseAdvancedConfig}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 rounded-lg font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const ReportBuilder = withCapability(ReportBuilderBase, {
  entity: "reports",
  capability: "report_builder",
  role: "CANONICAL",
  canonicalOwner: "src/components/reports/ReportBuilder.tsx",
  description: "SMRITI Report Builder with Collapsible Panels, Auto-Adaptive Layout, and Focus Mode",
});

export default ReportBuilder;
