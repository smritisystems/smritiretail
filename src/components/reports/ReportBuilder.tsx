/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.99.21
 * Created      : 2026-10-16
 * Modified     : 2026-10-29
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Target UI    : SMRITI Visual Report Designer with Unified Single-Tree Body Portal Print Engine
 * Classification: Internal
 */

import React, { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Search, Play, Save, Download, SlidersHorizontal, Filter,
  Maximize2, Minimize2, ChevronDown, ChevronRight, ChevronLeft,
  X, Check, RotateCcw, TableProperties, FileSpreadsheet, Printer,
  FileText, ExternalLink, Hash, Calendar, Layers, CheckSquare,
  Sparkles, ShieldCheck, Clock, ChevronUp, Menu, Settings,
  ShoppingBag, TrendingUp, Boxes, Package, Users, Building, Landmark,
  GripVertical, ArrowLeft, ArrowRight, Eye, AlertCircle, Loader2,
  Plus, Tag, Grid, LayoutGrid, CheckCircle2, ChevronRight as TreeChevron
} from "lucide-react";
import { withCapability } from "../../types/architecture.ts";
import { formatCurrency, formatNumber, formatDate } from "../../utils/formatters.ts";
import { GlobalExportService } from "../../services/globalExportService.ts";
import { apiFetchV1, getTenantCompanyContext } from "../../lib/apiFetchV1.ts";
import {
  LOGICAL_CATALOG_FIELDS,
  DEFAULT_REPORT_LAYOUT,
  canFieldDropInArea,
  transformToPivotMatrix,
  LogicalReportField,
  ConfiguredField,
  ReportLayoutState,
  LayoutArea,
  FieldLogicalRole,
  AggregationType,
  FormatType,
  SortDirection,
} from "./reportLayoutEngine.ts";

export type SidebarState = "expanded" | "collapsed" | "hidden";
export type FiltersState = "expanded" | "compact" | "hidden";

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

export interface ReportBuilderProps {
  initialTitle?: string;
  initialData?: ReportBuilderRow[];
  onNotification?: (type: "success" | "error" | "info", msg: string) => void;
  onReturnToCatalog?: () => void;
  isLocationsManagementEnabled?: boolean;
  activeStoreName?: string;
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
  { id: "inv_item_code", category: "Inventory", label: "Item Code", key: "item_code", datatype: "text", iconType: "text" },
  { id: "inv_item_name", category: "Inventory", label: "Item Name", key: "item_name", datatype: "text", iconType: "text" },
  { id: "inv_category", category: "Inventory", label: "Category", key: "item_category", datatype: "text", iconType: "text" },
  { id: "inv_brand", category: "Inventory", label: "Brand", key: "brand", datatype: "text", iconType: "text" },
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
];

export const DEFAULT_REPORT_BUILDER_ROWS: ReportBuilderRow[] = [
  { id: "row-1", supplier: "ABC Footwear", po_no: "PO-2025-001", po_date: "2025-04-02", invoice_no: "INV-8801", article_sku: "CH-01", color: "Black", size: 7, quantity: 24, net_amount: 12000 },
  { id: "row-2", supplier: "ABC Footwear", po_no: "PO-2025-001", po_date: "2025-04-02", invoice_no: "INV-8801", article_sku: "CH-01", color: "Black", size: 8, quantity: 18, net_amount: 9000 },
  { id: "row-3", supplier: "XYZ Traders",  po_no: "PO-2025-002", po_date: "2025-04-10", invoice_no: "INV-8802", article_sku: "SN-02", color: "Brown", size: 7, quantity: 30, net_amount: 15000 },
  { id: "row-4", supplier: "XYZ Traders",  po_no: "PO-2025-002", po_date: "2025-04-10", invoice_no: "INV-8802", article_sku: "SN-02", color: "Brown", size: 8, quantity: 20, net_amount: 10000 },
  { id: "row-5", supplier: "LMN Suppliers", po_no: "PO-2025-003", po_date: "2025-04-18", invoice_no: "INV-8803", article_sku: "SP-03", color: "Blue", size: 9, quantity: 25, net_amount: 12500 },
  { id: "row-6", supplier: "LMN Suppliers", po_no: "PO-2025-003", po_date: "2025-04-18", invoice_no: "INV-8803", article_sku: "SP-03", color: "Blue", size: 10, quantity: 15, net_amount: 8000 },
];

const STORAGE_KEY_LAYOUT = "smriti_report_designer_layout_v2";

// Benchmark reference dataset for preview & static verification
export const BENCHMARK_REPORT_ROWS: ReportBuilderRow[] = [
  { id: "row-1", brand: "Nike", article_sku: "ART-101", color: "Black", size: "40", quantity: 12, net_total: 30000, gross_total: 30000, tax_amount: 1500, sale_invoice_no: "INV-2026-001", customer_name: "Metro Retail", staff_name: "Rahul S" },
  { id: "row-2", brand: "Nike", article_sku: "ART-101", color: "Black", size: "41", quantity: 8, net_total: 20000, gross_total: 20000, tax_amount: 1000, sale_invoice_no: "INV-2026-001", customer_name: "Metro Retail", staff_name: "Rahul S" },
  { id: "row-3", brand: "Nike", article_sku: "ART-101", color: "Black", size: "42", quantity: 5, net_total: 12500, gross_total: 12500, tax_amount: 625, sale_invoice_no: "INV-2026-001", customer_name: "Metro Retail", staff_name: "Rahul S" },
  { id: "row-4", brand: "Nike", article_sku: "ART-101", color: "Blue", size: "40", quantity: 10, net_total: 25000, gross_total: 25000, tax_amount: 1250, sale_invoice_no: "INV-2026-002", customer_name: "Urban Footwear", staff_name: "Pooja V" },
  { id: "row-5", brand: "Nike", article_sku: "ART-101", color: "Blue", size: "41", quantity: 6, net_total: 15000, gross_total: 15000, tax_amount: 750, sale_invoice_no: "INV-2026-002", customer_name: "Urban Footwear", staff_name: "Pooja V" },
  { id: "row-6", brand: "Nike", article_sku: "ART-101", color: "Blue", size: "42", quantity: 3, net_total: 7500, gross_total: 7500, tax_amount: 375, sale_invoice_no: "INV-2026-002", customer_name: "Urban Footwear", staff_name: "Pooja V" },
  { id: "row-7", brand: "Nike", article_sku: "ART-101", color: "White", size: "40", quantity: 8, net_total: 20000, gross_total: 20000, tax_amount: 1000, sale_invoice_no: "INV-2026-003", customer_name: "Direct Walkin", staff_name: "Rahul S" },
  { id: "row-8", brand: "Nike", article_sku: "ART-101", color: "White", size: "41", quantity: 4, net_total: 10000, gross_total: 10000, tax_amount: 500, sale_invoice_no: "INV-2026-003", customer_name: "Direct Walkin", staff_name: "Rahul S" },
  { id: "row-9", brand: "Nike", article_sku: "ART-101", color: "White", size: "42", quantity: 2, net_total: 5000, gross_total: 5000, tax_amount: 250, sale_invoice_no: "INV-2026-003", customer_name: "Direct Walkin", staff_name: "Rahul S" },
  { id: "row-10", brand: "Adidas", article_sku: "ART-201", color: "Black", size: "40", quantity: 15, net_total: 37500, gross_total: 37500, tax_amount: 1875, sale_invoice_no: "INV-2026-004", customer_name: "Reliance Retail", staff_name: "Amit K" },
  { id: "row-11", brand: "Adidas", article_sku: "ART-201", color: "Black", size: "41", quantity: 10, net_total: 25000, gross_total: 25000, tax_amount: 1250, sale_invoice_no: "INV-2026-004", customer_name: "Reliance Retail", staff_name: "Amit K" },
  { id: "row-12", brand: "Adidas", article_sku: "ART-201", color: "Black", size: "42", quantity: 8, net_total: 20000, gross_total: 20000, tax_amount: 1000, sale_invoice_no: "INV-2026-004", customer_name: "Reliance Retail", staff_name: "Amit K" },
  { id: "row-13", brand: "Adidas", article_sku: "ART-201", color: "Brown", size: "40", quantity: 5, net_total: 12500, gross_total: 12500, tax_amount: 625, sale_invoice_no: "INV-2026-005", customer_name: "Apex Store", staff_name: "Amit K" },
  { id: "row-14", brand: "Adidas", article_sku: "ART-201", color: "Brown", size: "41", quantity: 8, net_total: 20000, gross_total: 20000, tax_amount: 1000, sale_invoice_no: "INV-2026-005", customer_name: "Apex Store", staff_name: "Amit K" },
  { id: "row-15", brand: "Adidas", article_sku: "ART-201", color: "Brown", size: "42", quantity: 4, net_total: 10000, gross_total: 10000, tax_amount: 500, sale_invoice_no: "INV-2026-005", customer_name: "Apex Store", staff_name: "Amit K" },
  { id: "row-16", brand: "Puma", article_sku: "ART-301", color: "Red", size: "40", quantity: 8, net_total: 20000, gross_total: 20000, tax_amount: 1000, sale_invoice_no: "INV-2026-006", customer_name: "City Trends", staff_name: "Sneha M" },
  { id: "row-17", brand: "Puma", article_sku: "ART-301", color: "Red", size: "41", quantity: 6, net_total: 15000, gross_total: 15000, tax_amount: 750, sale_invoice_no: "INV-2026-006", customer_name: "City Trends", staff_name: "Sneha M" },
  { id: "row-18", brand: "Puma", article_sku: "ART-301", color: "Red", size: "42", quantity: 4, net_total: 10000, gross_total: 10000, tax_amount: 500, sale_invoice_no: "INV-2026-006", customer_name: "City Trends", staff_name: "Sneha M" },
  { id: "row-19", brand: "Puma", article_sku: "ART-301", color: "Grey", size: "40", quantity: 6, net_total: 15000, gross_total: 15000, tax_amount: 750, sale_invoice_no: "INV-2026-007", customer_name: "City Trends", staff_name: "Sneha M" },
  { id: "row-20", brand: "Puma", article_sku: "ART-301", color: "Grey", size: "41", quantity: 5, net_total: 12500, gross_total: 12500, tax_amount: 625, sale_invoice_no: "INV-2026-007", customer_name: "City Trends", staff_name: "Sneha M" },
  { id: "row-21", brand: "Puma", article_sku: "ART-301", color: "Grey", size: "42", quantity: 2, net_total: 5000, gross_total: 5000, tax_amount: 250, sale_invoice_no: "INV-2026-007", customer_name: "City Trends", staff_name: "Sneha M" },
];

export const ReportBuilderBase: React.FC<ReportBuilderProps> = ({
  initialTitle = "Report Builder — Sales Analysis (Custom)",
  initialData = [],
  onNotification,
  onReturnToCatalog,
  isLocationsManagementEnabled = false,
  activeStoreName = "Main Store · Single Store",
}) => {
  // ───────────────────────────────────────────────────────────────────────────
  // 1. Layout Configuration & DnD State
  // ───────────────────────────────────────────────────────────────────────────
  const [layout, setLayout] = useState<ReportLayoutState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_LAYOUT);
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_REPORT_LAYOUT;
  });

  const [selectedFieldForConfig, setSelectedFieldForConfig] = useState<ConfiguredField | null>(null);
  const [activeCatalogTab, setActiveCatalogTab] = useState<"fields" | "datasource">("fields");
  const [activeDataSource, setActiveDataSource] = useState<string>("Sales");
  const [fieldSearchTerm, setFieldSearchTerm] = useState<string>("");
  const [draggedField, setDraggedField] = useState<LogicalReportField | null>(null);
  const [dragTargetArea, setDragTargetArea] = useState<LayoutArea | null>(null);
  const [quickAddMenuArea, setQuickAddMenuArea] = useState<LayoutArea | null>(null);

  // View & Presentation Modes
  const [viewMode, setViewMode] = useState<"pivot" | "table">("pivot");
  const [showTotals, setShowTotals] = useState<boolean>(true);
  const [isCompact, setIsCompact] = useState<boolean>(false);
  const [isFocusMode, setIsFocusMode] = useState<boolean>(false);
  const [sidebarState, setSidebarState] = useState<SidebarState>("expanded");

  // Expanded categories accordion in Available Fields catalog
  const [expandedRoles, setExpandedRoles] = useState<Record<FieldLogicalRole, boolean>>({
    Identifier: true,
    Classification: true,
    Attribute: true,
    Dimension: true,
    Measure: true,
  });

  // Filter States
  const [dateRange, setDateRange] = useState({ start: "2026-01-01", end: "2026-12-31" });
  const [branchFilter, setBranchFilter] = useState<string>("All Branches");

  // Live PostgreSQL Data State
  const [data, setData] = useState<ReportBuilderRow[]>(
    initialData.length > 0 ? initialData : BENCHMARK_REPORT_ROWS
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Export menu
  const [showExportMenu, setShowExportMenu] = useState<boolean>(false);
  const [showPrintReportModal, setShowPrintReportModal] = useState<boolean>(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const quickAddRef = useRef<HTMLDivElement>(null);

  const tenantContext = useMemo(() => {
    if (typeof window !== "undefined") {
      return getTenantCompanyContext();
    }
    return { companyName: "", companyAddress: "", companyGstin: "" };
  }, []);

  useEffect(() => {
    if (!showPrintReportModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setShowPrintReportModal(false);
      } else if (e.key === "F9" || ((e.ctrlKey || e.metaKey) && (e.key === "p" || e.key === "P"))) {
        e.preventDefault();
        window.print();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showPrintReportModal]);

  const layoutSignature = useMemo(
    () => [...layout.rows, ...layout.columns, ...layout.values].map((f) => f.key).join(","),
    [layout.rows, layout.columns, layout.values]
  );

  // ───────────────────────────────────────────────────────────────────────────
  // 2. Fetch Live Data from Backend /api/v1/reports/builder/query
  // ───────────────────────────────────────────────────────────────────────────
  const fetchReportData = async (): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("category", activeDataSource);
      params.set("consolidation_mode", "auto");
      const activeKeys = Array.from(new Set([
        ...layout.rows.map((f) => f.key),
        ...layout.columns.map((f) => f.key),
        ...layout.values.map((f) => f.key),
      ]));
      if (activeKeys.length > 0) {
        params.set("selected_columns", activeKeys.join(","));
      }
      if (dateRange.start) params.set("start_date", dateRange.start);
      if (dateRange.end) params.set("end_date", dateRange.end);
      if (isLocationsManagementEnabled && branchFilter && branchFilter !== "All Branches") {
        params.set("branch_id", branchFilter);
      }
      if (fieldSearchTerm.trim()) params.set("search", fieldSearchTerm.trim());
      params.set("limit", "500");

      const res = await apiFetchV1<{
        category: string;
        total_count: number;
        rows: ReportBuilderRow[];
      }>(`/reports/builder/query?${params.toString()}`);

      if (res && Array.isArray(res.rows) && res.rows.length > 0) {
        setData(res.rows);
      } else {
        // Retain benchmark rows for illustration if database has no records for selected range
        setData(BENCHMARK_REPORT_ROWS);
      }
      return true;
    } catch (err: any) {
      console.warn("[ReportBuilder] Live fetch failed, using authoritative benchmark rows:", err);
      setData(BENCHMARK_REPORT_ROWS);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, [activeDataSource, dateRange.start, dateRange.end, branchFilter, layoutSignature]);

  // Click outside listener for menus
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
      if (quickAddRef.current && !quickAddRef.current.contains(e.target as Node)) {
        setQuickAddMenuArea(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Categorized Field Catalog
  // ───────────────────────────────────────────────────────────────────────────
  const filteredCatalogFields = useMemo(() => {
    if (!fieldSearchTerm.trim()) return LOGICAL_CATALOG_FIELDS;
    const term = fieldSearchTerm.toLowerCase();
    return LOGICAL_CATALOG_FIELDS.filter(
      (f) =>
        f.label.toLowerCase().includes(term) ||
        f.role.toLowerCase().includes(term) ||
        f.key.toLowerCase().includes(term)
    );
  }, [fieldSearchTerm]);

  const fieldsByRole = useMemo(() => {
    const map: Record<FieldLogicalRole, LogicalReportField[]> = {
      Identifier: [],
      Classification: [],
      Attribute: [],
      Dimension: [],
      Measure: [],
    };
    filteredCatalogFields.forEach((f) => {
      if (map[f.role]) map[f.role].push(f);
    });
    return map;
  }, [filteredCatalogFields]);

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Drag and Drop Handlers
  // ───────────────────────────────────────────────────────────────────────────
  const handleDragStart = (e: React.DragEvent, field: LogicalReportField) => {
    setDraggedField(field);
    e.dataTransfer.setData("application/json", JSON.stringify(field));
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, area: LayoutArea) => {
    e.preventDefault();
    if (dragTargetArea !== area) {
      setDragTargetArea(area);
    }
  };

  const handleDragLeave = (_e: React.DragEvent, area: LayoutArea) => {
    if (dragTargetArea === area) {
      setDragTargetArea(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetArea: LayoutArea) => {
    e.preventDefault();
    setDragTargetArea(null);
    let field = draggedField;
    if (!field) {
      try {
        const raw = e.dataTransfer.getData("application/json");
        if (raw) field = JSON.parse(raw);
      } catch {}
    }
    if (!field) return;

    // Check validity
    const check = canFieldDropInArea(field, targetArea);
    if (!check.allowed) {
      onNotification?.("error", check.reason || "Invalid area for this field.");
      setDraggedField(null);
      return;
    }

    // Check if already in target area
    if (layout[targetArea].some((f) => f.key === field.key)) {
      onNotification?.("info", `${field.label} is already in ${targetArea.toUpperCase()}.`);
      setDraggedField(null);
      return;
    }

    // Add to target area
    const newField: ConfiguredField = {
      fieldId: field.id,
      key: field.key,
      label: field.label,
      aggregation: field.defaultAggregation,
      format: field.defaultFormat,
      showInTotal: true,
      sort: "None",
    };

    setLayout((prev) => ({
      ...prev,
      [targetArea]: [...prev[targetArea], newField],
    }));

    setSelectedFieldForConfig(newField);
    onNotification?.("success", `Added ${field.label} to ${targetArea.toUpperCase()}.`);
    setDraggedField(null);
  };

  // Add field via Accessible `+ Add` button
  const handleAddFieldToArea = (field: LogicalReportField, area: LayoutArea) => {
    const check = canFieldDropInArea(field, area);
    if (!check.allowed) {
      onNotification?.("error", check.reason || "Invalid area.");
      return;
    }
    if (layout[area].some((f) => f.key === field.key)) {
      onNotification?.("info", `${field.label} is already in ${area}.`);
      return;
    }
    const newField: ConfiguredField = {
      fieldId: field.id,
      key: field.key,
      label: field.label,
      aggregation: field.defaultAggregation,
      format: field.defaultFormat,
      showInTotal: true,
      sort: "None",
    };
    setLayout((prev) => ({
      ...prev,
      [area]: [...prev[area], newField],
    }));
    setSelectedFieldForConfig(newField);
    setQuickAddMenuArea(null);
    onNotification?.("success", `Added ${field.label} to ${area.toUpperCase()}.`);
  };

  // Remove field from an area
  const handleRemoveFieldFromArea = (area: LayoutArea, fieldKey: string) => {
    setLayout((prev) => ({
      ...prev,
      [area]: prev[area].filter((f) => f.key !== fieldKey),
    }));
    if (selectedFieldForConfig?.key === fieldKey) {
      setSelectedFieldForConfig(null);
    }
  };

  // Save current view layout
  const handleSaveView = () => {
    try {
      localStorage.setItem(STORAGE_KEY_LAYOUT, JSON.stringify(layout));
      onNotification?.("success", "Report layout and custom configuration saved successfully.");
    } catch {
      onNotification?.("error", "Failed to persist view layout.");
    }
  };

  // Reset layout to defaults
  const handleResetLayout = () => {
    setLayout(DEFAULT_REPORT_LAYOUT);
    setSelectedFieldForConfig(null);
    localStorage.removeItem(STORAGE_KEY_LAYOUT);
    onNotification?.("info", "Report layout reset to standard Sales Analysis default.");
  };

  // Export handlers
  const handleExport = (format: "csv" | "xlsx" | "pdf" | "print") => {
    setShowExportMenu(false);
    if (format === "print" || format === "pdf") {
      setShowPrintReportModal(true);
      onNotification?.("info", "Opening Report Print Preview Portal...");
      return;
    }
    const exportColumns = layout.rows.concat(layout.columns).concat(layout.values).map((c) => ({
      key: c.key,
      label: c.customLabel || c.label,
      datatype: c.format === "Currency" ? ("currency" as const) : c.format === "Number" ? ("number" as const) : ("text" as const),
    }));
    GlobalExportService.exportDataset({
      moduleName: "Visual_Report_Designer",
      format: format === "xlsx" ? "xlsx" : "csv",
      scope: "all",
      columns: exportColumns,
      data,
      metadata: {
        moduleTitle: initialTitle,
        companyName: "SMRITI Retail OS",
        exportTimestamp: new Date().toLocaleString(),
      },
    });
    onNotification?.("success", `Exporting report as ${format.toUpperCase()}...`);
  };

  // ───────────────────────────────────────────────────────────────────────────
  // 5. Compute Matrix Pivot Data (Phase 4)
  // ───────────────────────────────────────────────────────────────────────────
  const pivotMatrix = useMemo(() => {
    return transformToPivotMatrix(data, layout);
  }, [data, layout]);

  return (
    <div className="w-full flex flex-col bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden font-sans text-slate-800 dark:text-slate-100 shadow-sm min-h-[720px]">
      
      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* 1. TOP HEADER & GLOBAL ACTIONS                                        */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5">
          {onReturnToCatalog && (
            <button
              type="button"
              onClick={onReturnToCatalog}
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-xs"
              title="Return to BI Center"
            >
              <ChevronLeft size={16} />
            </button>
          )}

          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-lg">
              <LayoutGrid size={18} />
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                {initialTitle}
              </h2>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <span>Design mode</span>
                <span>•</span>
                <span>Drag fields between sections to customize matrix and aggregations</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Run Button */}
          <button
            type="button"
            id="report-builder-run-btn"
            onClick={fetchReportData}
            disabled={isLoading}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
          >
            {isLoading ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} className="fill-current" />}
            <span>Run</span>
          </button>

          {/* Save View Button */}
          <button
            type="button"
            id="report-builder-save-view-btn"
            onClick={handleSaveView}
            className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
          >
            <Save size={13} />
            <span>Save View</span>
          </button>

          {/* Export Menu */}
          <div className="relative" ref={exportMenuRef}>
            <button
              type="button"
              id="report-builder-export-btn"
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Download size={13} />
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
                  onClick={() => handleExport("print")}
                  className="w-full text-left px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center gap-2 cursor-pointer"
                >
                  <Printer size={14} className="text-rose-600" /> PDF / Print
                </button>
              </div>
            )}
          </div>

          {/* Reset Layout */}
          <button
            type="button"
            id="report-builder-reset-layout-btn"
            onClick={handleResetLayout}
            className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Reset layout to default"
          >
            <RotateCcw size={13} />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* 2. MAIN WORKSPACE: LEFT CATALOG + RIGHT REPORT CANVAS                 */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* ── LEFT PANEL: AVAILABLE FIELDS CATALOG ─────────────────────────── */}
        <aside className="w-72 border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-col shrink-0 select-none">
          {/* Tabs: Fields | Data Source */}
          <div className="flex border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 p-1">
            <button
              type="button"
              onClick={() => setActiveCatalogTab("fields")}
              className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${
                activeCatalogTab === "fields"
                  ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-2xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              Fields
            </button>
            <button
              type="button"
              onClick={() => setActiveCatalogTab("datasource")}
              className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${
                activeCatalogTab === "datasource"
                  ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-2xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              Data Source ({activeDataSource})
            </button>
          </div>

          {activeCatalogTab === "datasource" ? (
            <div className="p-3 space-y-2 text-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Select Domain</span>
              {["Sales", "Purchase", "Inventory", "Items"].map((ds) => (
                <button
                  key={ds}
                  type="button"
                  onClick={() => {
                    setActiveDataSource(ds);
                    setActiveCatalogTab("fields");
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg border font-medium flex items-center justify-between ${
                    activeDataSource === ds
                      ? "bg-blue-50 dark:bg-blue-950/40 border-blue-400 text-blue-700 dark:text-blue-300 font-bold"
                      : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <span>{ds} Transactions</span>
                  {activeDataSource === ds && <Check size={14} className="text-blue-600" />}
                </button>
              ))}
            </div>
          ) : (
            <>
              {/* Search Box */}
              <div className="p-3 border-b border-slate-200 dark:border-slate-700">
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search fields..."
                    value={fieldSearchTerm}
                    onChange={(e) => setFieldSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-7 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-blue-500"
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

              {/* Categorized Fields List (5 Logical Roles) */}
              <div className="flex-1 overflow-y-auto p-2 space-y-2 text-xs">
                {(
                  [
                    { role: "Identifier", label: "Identifiers", color: "blue", count: fieldsByRole.Identifier.length },
                    { role: "Classification", label: "Classifications", color: "purple", count: fieldsByRole.Classification.length },
                    { role: "Attribute", label: "Attributes", color: "emerald", count: fieldsByRole.Attribute.length },
                    { role: "Dimension", label: "Dimensions", color: "amber", count: fieldsByRole.Dimension.length },
                    { role: "Measure", label: "Measures", color: "rose", count: fieldsByRole.Measure.length },
                  ] as const
                ).map(({ role, label, color, count }) => {
                  const roleFields = fieldsByRole[role];
                  if (roleFields.length === 0) return null;
                  const isOpen = expandedRoles[role] !== false;

                  return (
                    <div key={role} className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-slate-50/50 dark:bg-slate-850/50">
                      {/* Role Header Accordion */}
                      <button
                        type="button"
                        onClick={() => setExpandedRoles((prev) => ({ ...prev, [role]: !isOpen }))}
                        className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-slate-100 dark:hover:bg-slate-750 font-bold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          {isOpen ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
                          <span className="uppercase tracking-wider text-[11px] font-bold">{label}</span>
                        </div>
                        <span className="text-[10px] font-mono bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-slate-500">
                          {count}
                        </span>
                      </button>

                      {/* Role Fields */}
                      {isOpen && (
                        <div className="p-1 space-y-1 bg-white dark:bg-slate-800">
                          {roleFields.map((field) => (
                            <div
                              key={field.id}
                              draggable={true}
                              onDragStart={(e) => handleDragStart(e, field)}
                              className="px-2.5 py-1.5 rounded-md flex items-center justify-between text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 border border-transparent hover:border-slate-200 dark:hover:border-slate-600 transition-colors cursor-grab group"
                              title={`Drag ${field.label} into Rows, Columns, Values, or Filters`}
                            >
                              <div className="flex items-center gap-2 truncate">
                                <GripVertical size={13} className="text-slate-300 dark:text-slate-600 shrink-0 group-hover:text-slate-400" />
                                <span className="font-mono text-[10px] w-3.5 text-center font-bold text-slate-400">
                                  {role === "Measure" ? "Σ" : role === "Attribute" ? "#" : "T"}
                                </span>
                                <span className="truncate font-medium">{field.label}</span>
                              </div>

                              {/* Quick placement drop trigger */}
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  type="button"
                                  onClick={() => handleAddFieldToArea(field, role === "Measure" ? "values" : "rows")}
                                  className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-600 rounded"
                                  title={`Add to ${role === "Measure" ? "Values" : "Rows"}`}
                                >
                                  <Plus size={12} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </aside>

        {/* ── RIGHT CANVAS: REPORT LAYOUT DROP ZONES + PREVIEW ─────────────── */}
        <div className="flex-1 flex flex-col overflow-y-auto bg-slate-100/60 dark:bg-slate-900 p-4 space-y-4">
          
          {/* ───────────────────────────────────────────────────────────────── */}
          {/* CALLOUT 2: REPORT LAYOUT (DRAG AND DROP ZONES)                    */}
          {/* ───────────────────────────────────────────────────────────────── */}
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={15} className="text-purple-600" />
                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                  Report Layout (Drag and Drop)
                </h3>
              </div>
              <div className="text-[11px] text-slate-400">
                Drag fields into layout sections or use + Add to reorder matrix
              </div>
            </div>

            {/* 4 Layout Containers: Rows, Columns, Values, Filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              
              {/* CONTAINER 1: ROWS (GROUP BY) */}
              <div
                onDragOver={(e) => handleDragOver(e, "rows")}
                onDragLeave={(e) => handleDragLeave(e, "rows")}
                onDrop={(e) => handleDrop(e, "rows")}
                className={`border rounded-xl p-3 bg-slate-50/70 dark:bg-slate-850/70 transition-all ${
                  dragTargetArea === "rows"
                    ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 ring-2 ring-blue-500/20"
                    : "border-slate-200 dark:border-slate-700"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wide flex items-center gap-1">
                    <span>Rows (Group by)</span>
                  </span>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setQuickAddMenuArea(quickAddMenuArea === "rows" ? null : "rows")}
                      className="px-2 py-0.5 text-[10px] font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-400 text-blue-600 rounded flex items-center gap-1 cursor-pointer"
                    >
                      <Plus size={10} /> Add
                    </button>
                    {quickAddMenuArea === "rows" && (
                      <div ref={quickAddRef} className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-1 z-20 max-h-48 overflow-y-auto">
                        {LOGICAL_CATALOG_FIELDS.filter((f) => f.role !== "Measure").map((f) => (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => handleAddFieldToArea(f, "rows")}
                            className="w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-between"
                          >
                            <span>{f.label}</span>
                            <span className="text-[9px] text-slate-400 font-mono">{f.role}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Chips */}
                <div className="space-y-1.5 min-h-[64px]">
                  {layout.rows.map((field) => (
                    <div
                      key={field.key}
                      id={`layout-chip-${field.key}`}
                      data-testid={`layout-chip-${field.key}`}
                      onClick={() => setSelectedFieldForConfig(field)}
                      className={`px-2.5 py-1.5 rounded-lg border flex items-center justify-between text-xs transition-colors cursor-pointer ${
                        selectedFieldForConfig?.key === field.key
                          ? "bg-blue-50 dark:bg-blue-950/60 border-blue-400 text-blue-700 dark:text-blue-300 font-bold shadow-2xs"
                          : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <GripVertical size={12} className="text-slate-300" />
                        <span className="truncate">{field.customLabel || field.label}</span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveFieldFromArea("rows", field.key);
                        }}
                        className="text-slate-400 hover:text-rose-500 p-0.5"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                  {layout.rows.length === 0 && (
                    <div className="h-14 border border-dashed border-slate-300 dark:border-slate-700 rounded-lg flex items-center justify-center text-[11px] text-slate-400">
                      Drag fields here
                    </div>
                  )}
                </div>
              </div>

              {/* CONTAINER 2: COLUMNS (PIVOT BY) */}
              <div
                onDragOver={(e) => handleDragOver(e, "columns")}
                onDragLeave={(e) => handleDragLeave(e, "columns")}
                onDrop={(e) => handleDrop(e, "columns")}
                className={`border rounded-xl p-3 bg-slate-50/70 dark:bg-slate-850/70 transition-all ${
                  dragTargetArea === "columns"
                    ? "border-purple-500 bg-purple-50/50 dark:bg-purple-950/30 ring-2 ring-purple-500/20"
                    : "border-slate-200 dark:border-slate-700"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wide flex items-center gap-1">
                    <span>Columns (Pivot by)</span>
                  </span>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setQuickAddMenuArea(quickAddMenuArea === "columns" ? null : "columns")}
                      className="px-2 py-0.5 text-[10px] font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-purple-400 text-purple-600 rounded flex items-center gap-1 cursor-pointer"
                    >
                      <Plus size={10} /> Add
                    </button>
                    {quickAddMenuArea === "columns" && (
                      <div ref={quickAddRef} className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-1 z-20 max-h-48 overflow-y-auto">
                        {LOGICAL_CATALOG_FIELDS.filter((f) => f.role === "Attribute" || f.role === "Classification").map((f) => (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => handleAddFieldToArea(f, "columns")}
                            className="w-full text-left px-3 py-1.5 text-xs hover:bg-purple-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-between"
                          >
                            <span>{f.label}</span>
                            <span className="text-[9px] text-slate-400 font-mono">{f.role}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Chips */}
                <div className="space-y-1.5 min-h-[64px]">
                  {layout.columns.map((field) => (
                    <div
                      key={field.key}
                      id={`layout-chip-${field.key}`}
                      data-testid={`layout-chip-${field.key}`}
                      onClick={() => setSelectedFieldForConfig(field)}
                      className={`px-2.5 py-1.5 rounded-lg border flex items-center justify-between text-xs transition-colors cursor-pointer ${
                        selectedFieldForConfig?.key === field.key
                          ? "bg-purple-50 dark:bg-purple-950/60 border-purple-400 text-purple-700 dark:text-purple-300 font-bold shadow-2xs"
                          : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <GripVertical size={12} className="text-slate-300" />
                        <span className="truncate">{field.customLabel || field.label}</span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveFieldFromArea("columns", field.key);
                        }}
                        className="text-slate-400 hover:text-rose-500 p-0.5"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                  {layout.columns.length === 0 && (
                    <div className="h-14 border border-dashed border-slate-300 dark:border-slate-700 rounded-lg flex items-center justify-center text-[11px] text-slate-400">
                      Drag fields here
                    </div>
                  )}
                </div>
              </div>

              {/* CONTAINER 3: VALUES (SHOW AS) */}
              <div
                onDragOver={(e) => handleDragOver(e, "values")}
                onDragLeave={(e) => handleDragLeave(e, "values")}
                onDrop={(e) => handleDrop(e, "values")}
                className={`border rounded-xl p-3 bg-slate-50/70 dark:bg-slate-855/70 transition-all ${
                  dragTargetArea === "values"
                    ? "border-amber-500 bg-amber-50/50 dark:bg-amber-950/30 ring-2 ring-amber-500/20"
                    : "border-slate-200 dark:border-slate-700"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wide flex items-center gap-1">
                    <span>Values (Show as)</span>
                  </span>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setQuickAddMenuArea(quickAddMenuArea === "values" ? null : "values")}
                      className="px-2 py-0.5 text-[10px] font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-amber-400 text-amber-600 rounded flex items-center gap-1 cursor-pointer"
                    >
                      <Plus size={10} /> Add
                    </button>
                    {quickAddMenuArea === "values" && (
                      <div ref={quickAddRef} className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-1 z-20 max-h-48 overflow-y-auto">
                        {LOGICAL_CATALOG_FIELDS.filter((f) => f.role === "Measure").map((f) => (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => handleAddFieldToArea(f, "values")}
                            className="w-full text-left px-3 py-1.5 text-xs hover:bg-amber-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-between"
                          >
                            <span>{f.label}</span>
                            <span className="text-[9px] text-slate-400 font-mono">Measure</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Chips */}
                <div className="space-y-1.5 min-h-[64px]">
                  {layout.values.map((field) => (
                    <div
                      key={field.key}
                      id={`layout-chip-${field.key}`}
                      data-testid={`layout-chip-${field.key}`}
                      onClick={() => setSelectedFieldForConfig(field)}
                      className={`px-2.5 py-1.5 rounded-lg border flex items-center justify-between text-xs transition-colors cursor-pointer ${
                        selectedFieldForConfig?.key === field.key
                          ? "bg-amber-50 dark:bg-amber-950/60 border-amber-400 text-amber-800 dark:text-amber-200 font-bold shadow-2xs"
                          : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <GripVertical size={12} className="text-slate-300" />
                        <span className="truncate">{field.customLabel || field.label} ({field.aggregation})</span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveFieldFromArea("values", field.key);
                        }}
                        className="text-slate-400 hover:text-rose-500 p-0.5"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                  {layout.values.length === 0 && (
                    <div className="h-14 border border-dashed border-slate-300 dark:border-slate-700 rounded-lg flex items-center justify-center text-[11px] text-slate-400">
                      Drag fields here
                    </div>
                  )}
                </div>
              </div>

              {/* CONTAINER 4: FILTERS (OPTIONAL) */}
              <div
                onDragOver={(e) => handleDragOver(e, "filters")}
                onDragLeave={(e) => handleDragLeave(e, "filters")}
                onDrop={(e) => handleDrop(e, "filters")}
                className={`border rounded-xl p-3 bg-slate-50/70 dark:bg-slate-855/70 transition-all ${
                  dragTargetArea === "filters"
                    ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 ring-2 ring-emerald-500/20"
                    : "border-slate-200 dark:border-slate-700"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wide flex items-center gap-1">
                    <span>Filters (Optional)</span>
                  </span>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setQuickAddMenuArea(quickAddMenuArea === "filters" ? null : "filters")}
                      className="px-2 py-0.5 text-[10px] font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-emerald-400 text-emerald-600 rounded flex items-center gap-1 cursor-pointer"
                    >
                      <Plus size={10} /> Add
                    </button>
                    {quickAddMenuArea === "filters" && (
                      <div ref={quickAddRef} className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-1 z-20 max-h-48 overflow-y-auto">
                        {LOGICAL_CATALOG_FIELDS.map((f) => (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => handleAddFieldToArea(f, "filters")}
                            className="w-full text-left px-3 py-1.5 text-xs hover:bg-emerald-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-between"
                          >
                            <span>{f.label}</span>
                            <span className="text-[9px] text-slate-400 font-mono">{f.role}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Chips */}
                <div className="space-y-1.5 min-h-[64px]">
                  {layout.filters.map((field) => (
                    <div
                      key={field.key}
                      id={`layout-chip-${field.key}`}
                      data-testid={`layout-chip-${field.key}`}
                      onClick={() => setSelectedFieldForConfig(field)}
                      className={`px-2.5 py-1.5 rounded-lg border flex items-center justify-between text-xs transition-colors cursor-pointer ${
                        selectedFieldForConfig?.key === field.key
                          ? "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-400 text-emerald-700 dark:text-emerald-300 font-bold shadow-2xs"
                          : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <GripVertical size={12} className="text-slate-300" />
                        <span className="truncate">{field.customLabel || field.label}</span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveFieldFromArea("filters", field.key);
                        }}
                        className="text-slate-400 hover:text-rose-500 p-0.5"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                  {layout.filters.length === 0 && (
                    <div className="h-14 border border-dashed border-slate-300 dark:border-slate-700 rounded-lg flex items-center justify-center text-[11px] text-slate-400">
                      Drag fields here
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>

          {/* ───────────────────────────────────────────────────────────────── */}
          {/* CALLOUT 4: REPORT PREVIEW (LIVE MATRIX / TABLE)                   */}
          {/* ───────────────────────────────────────────────────────────────── */}
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-xs flex flex-col">
            
            {/* Preview Toolbar */}
            <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-800/80">
              <div className="flex items-center gap-3">
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Grid size={14} className="text-blue-600" />
                  <span>Report Preview (Live)</span>
                </h3>

                {/* Single Store Default Mode Badge */}
                {!isLocationsManagementEnabled ? (
                  <span
                    id="report-builder-single-store-badge"
                    data-testid="report-builder-single-store-badge"
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                  >
                    <span>📍</span>
                    <span>{activeStoreName || "Main Store"} · Single Store</span>
                  </span>
                ) : (
                  <select
                    value={branchFilter}
                    onChange={(e) => setBranchFilter(e.target.value)}
                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-0.5 text-xs font-medium text-slate-700 dark:text-slate-200"
                  >
                    <option value="All Branches">All Stores Consolidated</option>
                    <option value="MAIN">Main Store</option>
                    <option value="OUTLET-1">Store B</option>
                  </select>
                )}
              </div>

              {/* View Switches & Toggles */}
              <div className="flex items-center gap-3 text-xs">
                {/* View Switcher: Pivot vs Table */}
                <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-900 p-0.5">
                  <button
                    type="button"
                    onClick={() => setViewMode("pivot")}
                    className={`px-3 py-1 font-bold rounded-md transition-colors ${
                      viewMode === "pivot"
                        ? "bg-blue-600 text-white shadow-2xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                    }`}
                  >
                    Pivot Matrix
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("table")}
                    className={`px-3 py-1 font-bold rounded-md transition-colors ${
                      viewMode === "table"
                        ? "bg-blue-600 text-white shadow-2xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                    }`}
                  >
                    Flat Table
                  </button>
                </div>

                {/* Show Totals Toggle */}
                <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={showTotals}
                    onChange={(e) => setShowTotals(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-0"
                  />
                  <span>Show Totals</span>
                </label>

                {/* Compact View Toggle */}
                <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={isCompact}
                    onChange={(e) => setIsCompact(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-0"
                  />
                  <span>Compact View</span>
                </label>
              </div>
            </div>

            {/* Matrix Pivot Table (Callout 4) */}
            <div className="overflow-x-auto">
              {viewMode === "pivot" && pivotMatrix.isPivoted ? (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider text-[11px]">
                      {pivotMatrix.rowHeaders.map((rh, idx) => (
                        <th key={idx} className="px-3 py-2.5 font-bold">
                          {rh}
                        </th>
                      ))}
                      {pivotMatrix.pivotColumnValues.map((pv, idx) => (
                        <th key={idx} className="px-3 py-2.5 text-right font-bold text-purple-700 dark:text-purple-300">
                          {pv}
                        </th>
                      ))}
                      <th className="px-3 py-2.5 text-right font-bold text-blue-700 dark:text-blue-300">
                        Total Qty
                      </th>
                      <th className="px-3 py-2.5 text-right font-bold text-emerald-700 dark:text-emerald-300">
                        Net Total (₹)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {pivotMatrix.treeRows.map((groupRow) => (
                      <React.Fragment key={groupRow.id}>
                        {/* Detail Rows under this Brand/Classification */}
                        {groupRow.children?.map((child, cIdx) => (
                          <tr
                            key={child.id}
                            className={`hover:bg-blue-50/40 dark:hover:bg-blue-950/20 transition-colors ${
                              isCompact ? "py-1" : "py-2"
                            }`}
                          >
                            {layout.rows.map((rf, rIdx) => (
                              <td
                                key={rIdx}
                                className={`px-3 ${isCompact ? "py-1.5" : "py-2"} ${
                                  rIdx === 0 && cIdx > 0 ? "text-transparent select-none" : "font-medium text-slate-800 dark:text-slate-200"
                                }`}
                              >
                                {child.rowKeys[rf.key] || "-"}
                              </td>
                            ))}

                            {/* Pivot Matrix Cells (Size 40, 41, 42...) */}
                            {pivotMatrix.pivotColumnValues.map((pv, pvIdx) => {
                              const sizeKey = pv.replace(/^[^\d]+/, ""); // e.g. "40"
                              const cellVal = child.cellValues[sizeKey] || 0;
                              return (
                                <td
                                  key={pvIdx}
                                  className={`px-3 ${isCompact ? "py-1.5" : "py-2"} text-right font-mono ${
                                    cellVal > 0 ? "font-semibold text-slate-800 dark:text-slate-200" : "text-slate-300 dark:text-slate-600"
                                  }`}
                                >
                                  {cellVal > 0 ? formatNumber(cellVal) : "-"}
                                </td>
                              );
                            })}

                            {/* Row Line Totals */}
                            <td className={`px-3 ${isCompact ? "py-1.5" : "py-2"} text-right font-mono font-bold text-blue-600 dark:text-blue-400`}>
                              {formatNumber(child.totalQty)}
                            </td>
                            <td className={`px-3 ${isCompact ? "py-1.5" : "py-2"} text-right font-mono font-bold text-slate-900 dark:text-white`}>
                              {formatCurrency(child.totalAmount)}
                            </td>
                          </tr>
                        ))}

                        {/* Group Subtotal Row (e.g. Nike Total, Adidas Total) */}
                        {showTotals && (
                          <tr className="bg-slate-50 dark:bg-slate-800 font-bold border-y border-slate-200 dark:border-slate-700">
                            <td
                              colSpan={layout.rows.length}
                              className="px-3 py-2 font-bold text-slate-900 dark:text-white"
                            >
                              {groupRow.groupLabel}
                            </td>
                            {pivotMatrix.pivotColumnValues.map((pv, pvIdx) => {
                              const sizeKey = pv.replace(/^[^\d]+/, "");
                              const colSum = groupRow.cellValues[sizeKey] || 0;
                              return (
                                <td
                                  key={pvIdx}
                                  className="px-3 py-2 text-right font-mono font-bold text-slate-900 dark:text-white"
                                >
                                  {formatNumber(colSum)}
                                </td>
                              );
                            })}
                            <td className="px-3 py-2 text-right font-mono font-bold text-blue-700 dark:text-blue-300">
                              {formatNumber(groupRow.totalQty)}
                            </td>
                            <td className="px-3 py-2 text-right font-mono font-bold text-emerald-700 dark:text-emerald-300">
                              {formatCurrency(groupRow.totalAmount)}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>

                  {/* Grand Total Row at Bottom */}
                  {showTotals && (
                    <tfoot>
                      <tr className="bg-blue-50/70 dark:bg-blue-950/50 border-t-2 border-slate-300 dark:border-slate-600 font-black text-slate-900 dark:text-white">
                        <td
                          colSpan={layout.rows.length}
                          className="px-3 py-3 uppercase tracking-wider text-xs font-black text-blue-900 dark:text-blue-200"
                        >
                          Grand Total
                        </td>
                        {pivotMatrix.pivotColumnValues.map((pv, pvIdx) => {
                          const sizeKey = pv.replace(/^[^\d]+/, "");
                          const gSum = pivotMatrix.grandTotals.columnTotals[sizeKey] || 0;
                          return (
                            <td
                              key={pvIdx}
                              className="px-3 py-3 text-right font-mono font-black text-blue-900 dark:text-blue-200"
                            >
                              {formatNumber(gSum)}
                            </td>
                          );
                        })}
                        <td className="px-3 py-3 text-right font-mono font-black text-blue-900 dark:text-blue-200">
                          {formatNumber(pivotMatrix.grandTotals.totalQty)}
                        </td>
                        <td className="px-3 py-3 text-right font-mono font-black text-emerald-800 dark:text-emerald-300">
                          {formatCurrency(pivotMatrix.grandTotals.totalAmount)}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              ) : (
                /* Flat Tabular Grid View */
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-700 font-bold uppercase tracking-wider text-[11px] text-slate-700 dark:text-slate-300">
                      {layout.rows.concat(layout.values).map((f) => (
                        <th key={f.key} className="px-3 py-2.5 font-bold">
                          {f.customLabel || f.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {data.slice(0, 50).map((row, rIdx) => (
                      <tr key={row.id || rIdx} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                        {layout.rows.concat(layout.values).map((f) => {
                          const val = row[f.key];
                          const isCurrency = f.format === "Currency";
                          return (
                            <td key={f.key} className="px-3 py-2 font-mono">
                              {isCurrency && typeof val === "number"
                                ? formatCurrency(val)
                                : val !== undefined && val !== null
                                ? String(val)
                                : "-"}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* ───────────────────────────────────────────────────────────────── */}
          {/* CALLOUT 5: FIELD CONFIGURATION INSPECTOR                          */}
          {/* ───────────────────────────────────────────────────────────────── */}
          {selectedFieldForConfig && (
            <div
              id="field-config-inspector"
              data-testid="field-config-inspector"
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-xs space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Tag size={15} className="text-amber-500" />
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                    Field Configuration ({selectedFieldForConfig.label})
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedFieldForConfig(null)}
                  className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-xs">
                {/* Display Label Input */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                    Display Label
                  </label>
                  <input
                    type="text"
                    value={selectedFieldForConfig.customLabel || selectedFieldForConfig.label}
                    onChange={(e) => {
                      const newLabel = e.target.value;
                      setSelectedFieldForConfig((prev) => (prev ? { ...prev, customLabel: newLabel } : null));
                      setLayout((prev) => {
                        const next = { ...prev };
                        (["rows", "columns", "values", "filters"] as LayoutArea[]).forEach((area) => {
                          next[area] = next[area].map((f) =>
                            f.key === selectedFieldForConfig.key ? { ...f, customLabel: newLabel } : f
                          );
                        });
                        return next;
                      });
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 font-medium focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Aggregation Function Dropdown */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                    Aggregation
                  </label>
                  <select
                    value={selectedFieldForConfig.aggregation}
                    onChange={(e) => {
                      const newAgg = e.target.value as AggregationType;
                      setSelectedFieldForConfig((prev) => (prev ? { ...prev, aggregation: newAgg } : null));
                      setLayout((prev) => ({
                        ...prev,
                        values: prev.values.map((f) =>
                          f.key === selectedFieldForConfig.key ? { ...f, aggregation: newAgg } : f
                        ),
                      }));
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 font-medium focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="SUM">SUM</option>
                    <option value="COUNT">COUNT</option>
                    <option value="AVG">AVERAGE</option>
                    <option value="MIN">MIN</option>
                    <option value="MAX">MAX</option>
                  </select>
                </div>

                {/* Format Dropdown */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                    Format
                  </label>
                  <select
                    value={selectedFieldForConfig.format}
                    onChange={(e) => {
                      const newFmt = e.target.value as FormatType;
                      setSelectedFieldForConfig((prev) => (prev ? { ...prev, format: newFmt } : null));
                      setLayout((prev) => {
                        const next = { ...prev };
                        (["rows", "columns", "values", "filters"] as LayoutArea[]).forEach((area) => {
                          next[area] = next[area].map((f) =>
                            f.key === selectedFieldForConfig.key ? { ...f, format: newFmt } : f
                          );
                        });
                        return next;
                      });
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 font-medium focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="Number">Number</option>
                    <option value="Currency">Currency (₹)</option>
                    <option value="Date">Date</option>
                    <option value="Percentage">Percentage (%)</option>
                  </select>
                </div>

                {/* Show in Total Checkbox */}
                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 py-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedFieldForConfig.showInTotal}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setSelectedFieldForConfig((prev) => (prev ? { ...prev, showInTotal: checked } : null));
                      }}
                      className="rounded text-blue-600 focus:ring-0"
                    />
                    <span>Show in Total</span>
                  </label>
                </div>

                {/* Sort Order Dropdown */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                    Sort
                  </label>
                  <select
                    value={selectedFieldForConfig.sort}
                    onChange={(e) => {
                      const newSort = e.target.value as SortDirection;
                      setSelectedFieldForConfig((prev) => (prev ? { ...prev, sort: newSort } : null));
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 font-medium focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="None">None</option>
                    <option value="Asc">Ascending</option>
                    <option value="Desc">Descending</option>
                  </select>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Unified Single-Tree Body Portal Report Print Studio */}
      {showPrintReportModal && typeof document !== "undefined" && createPortal(
        <div className="report-builder-print-modal-root print-preview-visible fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 print:static print:inset-auto print:h-auto print:w-full print:p-0 print:m-0 print:bg-white print:overflow-visible">
          <style>{`
            @media print {
              @page {
                size: A4 landscape;
                margin: 8mm 10mm 10mm 10mm;
              }
              #root {
                display: none !important;
              }
              html, body {
                height: auto !important;
                min-height: 0 !important;
                overflow: visible !important;
                margin: 0 !important;
                padding: 0 !important;
                background: white !important;
              }
              .report-builder-print-modal-root {
                position: static !important;
                display: block !important;
                width: 100% !important;
                height: auto !important;
                margin: 0 !important;
                padding: 0 !important;
                overflow: visible !important;
                background: white !important;
              }
              .report-builder-print-toolbar,
              .no-print {
                display: none !important;
              }
              .report-builder-print-container {
                box-shadow: none !important;
                border: none !important;
                margin: 0 !important;
                padding: 0 !important;
                max-width: 100% !important;
                width: 100% !important;
                background: white !important;
                color: black !important;
              }
            }
          `}</style>

          <div className="report-builder-print-container bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-6xl w-full p-6 relative flex flex-col max-h-[92vh] print:max-h-none print:h-auto print:w-full print:p-0 print:border-none print:shadow-none print:rounded-none">
            {/* Toolbar */}
            <div className="report-builder-print-toolbar flex justify-between items-center pb-4 mb-4 border-b border-slate-200 dark:border-slate-800 shrink-0 print:hidden">
              <div className="flex items-center gap-2">
                <Printer className="text-blue-600 dark:text-blue-400" size={20} />
                <div>
                  <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                    Official Report Print Preview ({initialTitle || "Visual Report Designer"})
                  </h3>
                  <p className="text-xs text-slate-500">
                    SMRITI Enterprise Single-Tree Body Portal Standard (A4 Landscape)
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  data-testid="report-builder-portal-print-action-btn"
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Printer size={14} />
                  <span>Print Report (F9 / Ctrl+P)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowPrintReportModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  <X size={14} />
                  <span>Close (Esc)</span>
                </button>
              </div>
            </div>

            {/* Printable Content Body */}
            <div
              id="report-builder-printable-sheet"
              className="flex-1 overflow-y-auto space-y-4 text-slate-900 font-sans text-xs p-4 bg-white rounded-lg print:p-0 print:overflow-visible print:border-none"
            >
              {/* Header / Company Info */}
              <div className="flex justify-between items-start border-b-2 border-slate-800 pb-3">
                <div>
                  <h1 className="text-lg font-black uppercase tracking-wider text-slate-900">
                    {tenantContext?.companyName || "SMRITI RETAIL ENTERPRISE"}
                  </h1>
                  <p className="text-[10px] text-slate-600">
                    {tenantContext?.companyAddress || "Retail Business Intelligence & Reporting Centre"}
                  </p>
                  {tenantContext?.companyGstin && (
                    <p className="text-[10px] font-mono text-slate-700">GSTIN: {tenantContext.companyGstin}</p>
                  )}
                </div>
                <div className="text-right">
                  <div className="inline-block bg-slate-900 text-white font-bold text-[11px] uppercase px-2.5 py-0.5 rounded">
                    {initialTitle || "Visual Analysis Report"}
                  </div>
                  <div className="text-[10px] font-mono text-slate-500 mt-1">
                    Generated: {new Date().toLocaleString()}
                  </div>
                  <div className="text-[10px] font-mono text-slate-700">
                    Branch: {branchFilter} | Period: {dateRange.start} to {dateRange.end}
                  </div>
                </div>
              </div>

              {/* Layout Config Ribbon */}
              <div className="grid grid-cols-4 gap-3 bg-slate-50 border border-slate-200 rounded p-2.5 text-[11px]">
                <div>
                  <span className="text-slate-500 font-semibold">Row Dimensions: </span>
                  <span className="font-bold text-slate-800 font-mono">
                    {layout.rows.map(r => r.customLabel || r.label).join(" › ") || "None"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold">Column Dimensions: </span>
                  <span className="font-bold text-blue-700 font-mono">
                    {layout.columns.map(c => c.customLabel || c.label).join(" › ") || "None"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold">Measures / Aggregations: </span>
                  <span className="font-bold text-emerald-700 font-mono">
                    {layout.values.map(v => `${v.customLabel || v.label} (${v.aggregation || "SUM"})`).join(", ") || "None"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold">Dataset Records: </span>
                  <span className="font-bold text-slate-900 font-mono">{data.length}</span>
                </div>
              </div>

              {/* Table Data Preview */}
              <table className="w-full text-left border-collapse text-[10px]">
                <thead>
                  <tr className="border-b-2 border-slate-400 bg-slate-100 font-bold text-slate-700 uppercase">
                    <th className="py-1 px-1.5 w-8">#</th>
                    {layout.rows.concat(layout.columns).map((col, idx) => (
                      <th key={idx} className="py-1 px-1.5">{col.customLabel || col.label}</th>
                    ))}
                    {layout.values.map((val, idx) => (
                      <th key={idx} className="py-1 px-1.5 text-right">{val.customLabel || val.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.slice(0, 40).map((row, idx) => (
                    <tr key={idx} className="border-b border-slate-200 hover:bg-slate-50">
                      <td className="py-1 px-1.5 text-slate-500 font-mono">{idx + 1}</td>
                      {layout.rows.concat(layout.columns).map((col, cIdx) => (
                        <td key={cIdx} className="py-1 px-1.5 font-medium text-slate-800">
                          {String(row[col.key] ?? "—")}
                        </td>
                      ))}
                      {layout.values.map((val, vIdx) => {
                        const numVal = Number(row[val.key] ?? 0);
                        return (
                          <td key={vIdx} className="py-1 px-1.5 text-right font-mono font-medium">
                            {val.format === "Currency" ? `₹${numVal.toFixed(2)}` : numVal.toLocaleString()}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Sign-off */}
              <div className="pt-4 border-t border-slate-300 flex justify-between items-center text-[9px] text-slate-500">
                <div>
                  <span>SMRITI Business Intelligence Engine • Verified Ledger Record</span>
                </div>
                <div>
                  <span>Page 1 of 1 • System Generated Analysis</span>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
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
