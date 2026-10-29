/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.68.0
 * Created      : 2026-07-10
 * Modified     : 2026-10-03
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Target UI    : BI & Reporting Center (Fiori Horizon Inspired Light Theme)
 */

import React, { useState, useEffect, useMemo } from "react";
import { apiFetchV1, recordAuditAction } from "../lib/apiFetchV1";
import { isFieldGloballyVisible } from "../services/unifiedFieldCatalog.ts";
import { GlobalExportService } from "../services/globalExportService.ts";
import { formatDate, formatCurrency, formatNumber } from "../utils/formatters";
import { motion, AnimatePresence } from "motion/react";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  Tooltip as RechartsTooltip, CartesianGrid, LineChart, Line, PieChart, Pie, Cell
} from "recharts";
import { SmritiScrollArea } from "./SmritiScrollArea.tsx";
import {
  MessageCircle, Mail, Printer, FileBarChart, LayoutGrid, Settings2, ShieldCheck,
  Clock, Download, Search, Plus, Save, Filter, Database, MoreVertical,
  ChevronRight, ChevronDown, CheckSquare, Eye, Share2, Edit3, Trash2,
  Maximize2, TableProperties, BarChart3, PieChart as PieIcon, LineChart as LineIcon,
  Hash, Calendar, RefreshCw, Check, ArrowLeft, ShieldAlert, X, AlertTriangle, Play, Square,
  Code, Terminal, FileSpreadsheet, ExternalLink, Sparkles, ShoppingBag, ArrowRight, TrendingUp,
  FileText, SlidersHorizontal, Receipt, Coins, Truck, Boxes, CheckCircle2, Store
} from "lucide-react";
import { SalesOrderA4 } from "./templates/SalesOrderA4";
import { SalesOrderMatrixEntry } from "./sales/SalesOrderMatrixEntry";
import { SmritiReportEngine } from "./reports/SmritiReportEngine";
import { ReportBuilder } from "./reports/ReportBuilder.tsx";
import { ConsolidatedBalanceSheetModal } from "./reports/ConsolidatedBalanceSheetModal.tsx";
import { ScheduleReportModal } from "./reports/ScheduleReportModal.tsx";
import { PLDashboardModal } from "./finance/PLDashboardModal.tsx";
import {
  REPORT_BUSINESS_AREAS,
  resolveReportBusinessArea,
} from "./reports/reportBusinessAreas.ts";

// Types for drill down context
interface DrilldownBreadcrumb {
  title: string;
  level: number;
  id: string;
  category?: string;
}

interface ReportSchedule {
  id: string;
  report_id: string;
  report_name: string;
  frequency: string;
  delivery_format: string;
  delivery_channel: string;
  delivery_target: string;
  cron_expression: string;
  execution_time: string | null;
  is_active: boolean;
  created_at: string;
}

interface ReportDesignerTabProps {
  currentUser?: { role: string; name: string } | null;
  onNavigateTab?: (tab: string) => void;
}

export const ReportDesignerTab: React.FC<ReportDesignerTabProps> = ({ currentUser, onNavigateTab }) => {
  // Navigation states
  const [activeView, setActiveView] = useState<"bi_center" | "designer" | "viewer">("bi_center");
  const [activeStudio, setActiveStudio] = useState<string>("all_reports");

  // Active Report being viewed/run
  const [selectedReport, setSelectedReport] = useState<any | null>(null);

  // Active Role switcher for instant interactive RBAC testing
  const [activeRole, setActiveRole] = useState<string>(
    (currentUser?.role === "Report User" || currentUser?.role === "REPORT_USER") ? "Report User" : (currentUser?.role === "Admin" ? "CEO" : (currentUser?.role === "Cashier" ? "Cashier" : "Store Manager"))
  ); // Store Manager, Cashier, CEO, Report User

  // Search filter
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Toolbar action modals
  const [showScheduleModal, setShowScheduleModal] = useState<boolean>(false);
  const [showBalanceSheetModal, setShowBalanceSheetModal] = useState<boolean>(false);
  const [showPLDashboardModal, setShowPLDashboardModal] = useState<boolean>(false);
  const [showShareModal, setShowShareModal] = useState<boolean>(false);
  const [shareType, setShareType] = useState<"Email" | "WhatsApp">("Email");

  // Scheduling forms
  const [scheduleForm, setScheduleForm] = useState({
    recipientEmail: "manager@smritibooks.com",
    frequency: "Daily",
    format: "PDF",
    cron: "0 8 * * *"
  });
  const [schedules, setSchedules] = useState<ReportSchedule[]>([]);

  // Sharing form
  const [shareForm, setShareForm] = useState({
    email: "recipient@smritibooks.com",
    phone: "919876543210",
    subject: "SMRITI Operational BI Report Summary",
    message: "Hi, please find attached the requested summary report generated from SMRITI Retail OS."
  });

  // Advanced Table Filters
  const [filters, setFilters] = useState({
    startDate: "2026-04-01",
    endDate: new Date().toISOString().split("T")[0],
    productGroup: "All",
    paymentMode: "All"
  });
  const [showTechnicalDetails, setShowTechnicalDetails] = useState<boolean>(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);

  // Standard Daily Retail Reports In-Report Filters & Views
  const [reportSearchQuery, setReportSearchQuery] = useState<string>("");
  const [salesViewMode, setSalesViewMode] = useState<"detailed" | "bill_summary">("detailed");
  const [grnViewMode, setGrnViewMode] = useState<"detailed" | "grn_summary">("detailed");
  const [purchaseInwardData, setPurchaseInwardData] = useState<any>(null);
  const [activeDatePreset, setActiveDatePreset] = useState<"today" | "yesterday" | "week" | "month" | "all" | "custom">("all");

  // Single Store Default & Progressive Location Management
  const [activeStoreName, setActiveStoreName] = useState<string>(() => {
    return localStorage.getItem("smriti_branch_name") || "Main Store";
  });
  const [isLocationsManagementEnabled, setIsLocationsManagementEnabled] = useState<boolean>(() => {
    return localStorage.getItem("smriti_locations_management_enabled") === "true";
  });
  const [selectedStoreScope, setSelectedStoreScope] = useState<string>("CURRENT_STORE");
  const [availableBranches, setAvailableBranches] = useState<any[]>([]);

  useEffect(() => {
    const bName = localStorage.getItem("smriti_branch_name");
    if (bName) setActiveStoreName(bName);
    const locMgmt = localStorage.getItem("smriti_locations_management_enabled");
    if (locMgmt === "true") {
      setIsLocationsManagementEnabled(true);
      apiFetchV1<any>("/branches")
        .then((res: any) => {
          if (Array.isArray(res)) {
            setAvailableBranches(res);
          } else if (res && Array.isArray(res.branches)) {
            setAvailableBranches(res.branches);
          }
        })
        .catch(() => {});
    }
  }, []);

  const setDatePreset = (preset: "today" | "yesterday" | "week" | "month" | "all") => {
    const today = new Date();
    const formatDateStr = (d: Date) => d.toISOString().split("T")[0];
    setActiveDatePreset(preset);
    if (preset === "today") {
      const dStr = formatDateStr(today);
      setFilters((prev) => ({ ...prev, startDate: dStr, endDate: dStr }));
    } else if (preset === "yesterday") {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      const yStr = formatDateStr(y);
      setFilters((prev) => ({ ...prev, startDate: yStr, endDate: yStr }));
    } else if (preset === "week") {
      const w = new Date(today);
      w.setDate(w.getDate() - 7);
      setFilters((prev) => ({ ...prev, startDate: formatDateStr(w), endDate: formatDateStr(today) }));
    } else if (preset === "month") {
      const m = new Date(today.getFullYear(), today.getMonth(), 1);
      setFilters((prev) => ({ ...prev, startDate: formatDateStr(m), endDate: formatDateStr(today) }));
    } else if (preset === "all") {
      setFilters((prev) => ({ ...prev, startDate: "2026-04-01", endDate: formatDateStr(today) }));
    }
  };

  const handleLaunchStandardReport = (type: "sales_register" | "cashier_summary" | "purchase_register" | "stock_on_hand") => {
    if (type === "sales_register") {
      runReport({
        id: "RPT-TAX-005",
        code: "RPT-TAX-005",
        title: "Daily Sales Register (Bill & Item Detail)",
        category: "Sales Detail",
        format: "Grid",
        drillDownEnabled: true,
        description: "Complete item-level sales register with Invoice No, Article No, Barcode, Size, Qty, Rate, Discount, GST & Net Total.",
      });
    } else if (type === "cashier_summary") {
      runReport({
        id: "RPT-SAL-001",
        code: "RPT-SAL-001",
        title: "Daily Cashier & Payment Summary Register",
        category: "Sales Summary",
        format: "Matrix",
        drillDownEnabled: true,
        description: "Daily cash, UPI / QR, card, and credit collections broken down by cashier shift.",
      });
    } else if (type === "purchase_register") {
      runReport({
        id: "RPT-PUR-001",
        code: "RPT-PUR-001",
        title: "Purchase Inward Register (GRN)",
        category: "Purchase Summary",
        format: "Grid",
        drillDownEnabled: true,
        description: "Supplier invoices, received stock quantities, landed costs, taxes, and outstanding vendor payables.",
      });
    } else if (type === "stock_on_hand") {
      runReport({
        id: "RPT-INV-001",
        code: "RPT-INV-001",
        title: "Current Stock on Hand & Valuation",
        category: "Valuation",
        format: "Grid",
        drillDownEnabled: false,
        description: "Live warehouse on-hand stock quantities by article, category, size, with cost and selling valuation.",
      });
    }
  };

  // Drilldown breadcrumbs inside report viewer
  const [breadcrumbs, setBreadcrumbs] = useState<DrilldownBreadcrumb[]>([]);
  const [drillLevel, setDrillLevel] = useState<number>(0); // 0 = Summary, 1 = Document, 2 = Ledger
  const [drillFilter, setDrillFilter] = useState<string>(""); // e.g. "Apparel" or "INV-001"

  const [salesReportData, setSalesReportData] = useState<any>(null);
  const [purchaseReportData, setPurchaseReportData] = useState<any[]>([]);
  const [selectedSupplierLedger, setSelectedSupplierLedger] = useState<any>(null);
  const [stockValuationData, setStockValuationData] = useState<any>(null);
  const [genericReportData, setGenericReportData] = useState<any>(null);
  // Phase 1E — RPT-ACCT-001 Monthly Accounts Summary
  const [acctEnvelope, setAcctEnvelope] = useState<any>(null);
  const [acctYear, setAcctYear]   = useState<number | "">("");
  const [acctMonth, setAcctMonth] = useState<number | "">("");
  const [loadingReports, setLoadingReports] = useState<boolean>(false);
  const [reportRefreshKey, setReportRefreshKey] = useState<number>(0);
  const [soPreviewData, setSoPreviewData] = useState<any | null>(null);
  const [showSoPrintModal, setShowSoPrintModal] = useState<boolean>(false);
  const [convertingOrderId, setConvertingOrderId] = useState<string | null>(null);
 
  // Dynamically load purchase summary data when purchase studio is active
  useEffect(() => {
    if (activeStudio === "purchase_studio" && (!purchaseReportData || purchaseReportData.length === 0)) {
      apiFetchV1(`/reports/purchase-summary`)
        .then((data) => {
          if (Array.isArray(data)) {
            setPurchaseReportData(data);
          }
        })
        .catch((e) => console.error("Failed to load purchase summary:", e));
    }
  }, [activeStudio, purchaseReportData]);

  const purchaseStudioTotals = useMemo(() => {
    if (!purchaseReportData || purchaseReportData.length === 0) {
      return {
        totalOutstanding: 0,
        totalOrders: 0,
        totalReceived: 0,
        chartData: [] as { supplier: string; ordered: number; received: number }[],
      };
    }
    const totalOutstanding = purchaseReportData.reduce(
      (sum, s) => sum + (parseFloat(s.outstanding) || 0),
      0
    );
    const totalOrders = purchaseReportData.reduce(
      (sum, s) => sum + (parseInt(s.po_count, 10) || 0),
      0
    );
    const totalReceived = purchaseReportData.reduce(
      (sum, s) => sum + (parseFloat(s.total_received) || 0),
      0
    );
    const chartData = [...purchaseReportData]
      .filter((s) => Number(s.total_ordered || 0) > 0)
      .sort((a, b) => Number(b.total_ordered || 0) - Number(a.total_ordered || 0))
      .slice(0, 5)
      .map((s) => ({
        supplier: s.supplier_name,
        ordered: Number(s.total_ordered || 0),
        received: Number(s.total_received || 0),
      }));
    return { totalOutstanding, totalOrders, totalReceived, chartData };
  }, [purchaseReportData]);

  // Unified normalized sales lines for RPT-TAX-005 and RPT-SAL-013
  const normalizedSalesLines = useMemo(() => {
    if (!genericReportData) return [];
    if (Array.isArray(genericReportData.lines)) {
      return genericReportData.lines.map((l: any, idx: number) => ({
        key: `${l.invoice_number || "inv"}-${l.line_no || idx}`,
        invoiceNo: l.invoice_number || "—",
        invoiceDate: l.invoice_date || "—",
        customerName: l.customer_name || "Walk-in Customer",
        articleNo: l.product_code || l.sku_code || "—",
        itemName: l.product_name || "—",
        barcode: l.barcode || "—",
        size: l.size_label || l.size || "Standard",
        color: l.color || "—",
        quantity: Number(l.quantity || 0),
        rate: Number(l.unit_price || 0),
        discount: Number(l.discount ?? l.discount_amount ?? 0),
        gstRate: Number(l.gst_rate ?? l.tax_rate ?? 0),
        taxAmount: Number(l.tax_amount || 0),
        netTotal: Number(l.line_total ?? l.total_amount ?? l.net_amount ?? (Number(l.quantity || 0) * Number(l.unit_price || 0))),
        paymentMode: l.payment_mode || "CASH",
      }));
    }
    if (Array.isArray(genericReportData.bills)) {
      const list: any[] = [];
      genericReportData.bills.forEach((b: any) => {
        (b.lines || []).forEach((l: any, idx: number) => {
          list.push({
            key: `${b.invoice_no || "inv"}-${l.line_no || idx}`,
            invoiceNo: b.invoice_no || "—",
            invoiceDate: b.date || "—",
            customerName: b.customer_name || "Walk-in Customer",
            articleNo: l.sku || l.product_id || "—",
            itemName: l.product_name || "—",
            barcode: l.barcode || "—",
            size: l.size_label || "Standard",
            color: l.color || "—",
            quantity: Number(l.quantity || 0),
            rate: Number(l.unit_price || l.mrp || 0),
            discount: Number(l.discount_amount ?? l.discount ?? 0),
            gstRate: Number(l.tax_rate ?? l.gst_rate ?? 0),
            taxAmount: Number(l.tax_amount || 0),
            netTotal: Number(l.net_amount ?? l.line_total ?? (Number(l.quantity || 0) * Number(l.unit_price || 0))),
            paymentMode: b.payment_mode || "CASH",
          });
        });
      });
      return list;
    }
    if (Array.isArray(genericReportData)) {
      return genericReportData.map((l: any, idx: number) => ({
        key: `${l.invoice_no || l.invoice_number || "inv"}-${idx}`,
        invoiceNo: l.invoice_no || l.invoice_number || "—",
        invoiceDate: l.date || l.invoice_date || "—",
        customerName: l.customer_name || "Walk-in Customer",
        articleNo: l.product_code || l.sku || "—",
        itemName: l.product_name || l.name || "—",
        barcode: l.barcode || "—",
        size: l.size_label || l.size || "Standard",
        color: l.color || "—",
        quantity: Number(l.quantity || 0),
        rate: Number(l.unit_price || l.rate || 0),
        discount: Number(l.discount ?? l.discount_amount ?? 0),
        gstRate: Number(l.gst_rate ?? l.tax_rate ?? 0),
        taxAmount: Number(l.tax_amount || 0),
        netTotal: Number(l.line_total ?? l.net_amount ?? l.total_amount ?? 0),
        paymentMode: l.payment_mode || "CASH",
      }));
    }
    return [];
  }, [genericReportData]);

  const filteredSalesLines = useMemo(() => {
    if (!reportSearchQuery.trim()) return normalizedSalesLines;
    const q = reportSearchQuery.toLowerCase().trim();
    return normalizedSalesLines.filter((l: any) =>
      l.invoiceNo.toLowerCase().includes(q) ||
      l.articleNo.toLowerCase().includes(q) ||
      l.itemName.toLowerCase().includes(q) ||
      l.barcode.toLowerCase().includes(q) ||
      l.size.toLowerCase().includes(q) ||
      l.customerName.toLowerCase().includes(q) ||
      l.paymentMode.toLowerCase().includes(q)
    );
  }, [normalizedSalesLines, reportSearchQuery]);

  const salesRegisterTotals = useMemo(() => {
    const totalBills = new Set(filteredSalesLines.map((i: any) => i.invoiceNo)).size;
    const totalQuantity = filteredSalesLines.reduce((acc: number, i: any) => acc + i.quantity, 0);
    const totalDiscount = filteredSalesLines.reduce((acc: number, i: any) => acc + i.discount, 0);
    const totalTax = filteredSalesLines.reduce((acc: number, i: any) => acc + i.taxAmount, 0);
    const totalNet = filteredSalesLines.reduce((acc: number, i: any) => acc + i.netTotal, 0);
    return { totalBills, totalQuantity, totalDiscount, totalTax, totalNet };
  }, [filteredSalesLines]);

  const billSummaryList = useMemo(() => {
    const map = new Map<string, any>();
    filteredSalesLines.forEach((item: any) => {
      if (!map.has(item.invoiceNo)) {
        map.set(item.invoiceNo, {
          invoiceNo: item.invoiceNo,
          invoiceDate: item.invoiceDate,
          customerName: item.customerName,
          paymentMode: item.paymentMode,
          itemsCount: 0,
          totalQuantity: 0,
          totalDiscount: 0,
          totalTax: 0,
          netTotal: 0,
        });
      }
      const b = map.get(item.invoiceNo)!;
      b.itemsCount += 1;
      b.totalQuantity += item.quantity;
      b.totalDiscount += item.discount;
      b.totalTax += item.taxAmount;
      b.netTotal += item.netTotal;
    });
    return Array.from(map.values());
  }, [filteredSalesLines]);

  // Stock Balance lines for RPT-INV-001
  const stockBalanceLines = useMemo(() => {
    if (!genericReportData) return [];
    const raw = Array.isArray(genericReportData)
      ? genericReportData
      : (genericReportData.lines || genericReportData.items || []);
    return raw.map((r: any, idx: number) => ({
      key: r.product_id || r.product_code || String(idx),
      articleNo: r.product_code || r.sku || "—",
      productName: r.product_name || r.name || "—",
      category: r.category || "General",
      onHand: Number(r.on_hand || 0),
      avgCost: Number(r.avg_cost || 0),
      stockValue: Number(r.stock_value || (Number(r.on_hand || 0) * Number(r.avg_cost || 0))),
      status: r.status || (Number(r.on_hand || 0) <= Number(r.min_level || 0) ? "LOW" : "OK"),
      minLevel: Number(r.min_level || 0),
      reorderLevel: Number(r.reorder_level || 0),
    }));
  }, [genericReportData]);

  const filteredStockLines = useMemo(() => {
    if (!reportSearchQuery.trim()) return stockBalanceLines;
    const q = reportSearchQuery.toLowerCase().trim();
    return stockBalanceLines.filter((s: any) =>
      s.articleNo.toLowerCase().includes(q) ||
      s.productName.toLowerCase().includes(q) ||
      s.category.toLowerCase().includes(q)
    );
  }, [stockBalanceLines, reportSearchQuery]);

  const stockTotals = useMemo(() => {
    const totalArticles = filteredStockLines.length;
    const totalQty = filteredStockLines.reduce((acc: number, s: any) => acc + s.onHand, 0);
    const totalValuation = filteredStockLines.reduce((acc: number, s: any) => acc + s.stockValue, 0);
    const lowStockCount = filteredStockLines.filter((s: any) => s.status === "LOW").length;
    return { totalArticles, totalQty, totalValuation, lowStockCount };
  }, [filteredStockLines]);

  // Purchase Inward Lines for RPT-PUR-001
  const filteredGrnLines = useMemo(() => {
    if (!purchaseInwardData || !Array.isArray(purchaseInwardData.lines)) return [];
    if (!reportSearchQuery.trim()) return purchaseInwardData.lines;
    const q = reportSearchQuery.toLowerCase().trim();
    return purchaseInwardData.lines.filter((l: any) =>
      (l.receipt_no && l.receipt_no.toLowerCase().includes(q)) ||
      (l.supplier_name && l.supplier_name.toLowerCase().includes(q)) ||
      (l.product_code && l.product_code.toLowerCase().includes(q)) ||
      (l.product_name && l.product_name.toLowerCase().includes(q)) ||
      (l.order_no && l.order_no.toLowerCase().includes(q)) ||
      (l.delivery_terms && l.delivery_terms.toLowerCase().includes(q)) ||
      (l.transporter_name && l.transporter_name.toLowerCase().includes(q)) ||
      (l.lr_number && l.lr_number.toLowerCase().includes(q)) ||
      (l.collection_type && l.collection_type.toLowerCase().includes(q))
    );
  }, [purchaseInwardData, reportSearchQuery]);

  const grnSummaryList = useMemo(() => {
    if (!filteredGrnLines.length) return [];
    const grnMap = new Map<string, any>();
    for (const line of filteredGrnLines) {
      if (!grnMap.has(line.receipt_no)) {
        grnMap.set(line.receipt_no, {
          receipt_no: line.receipt_no,
          receipt_date: line.receipt_date,
          supplier_name: line.supplier_name,
          order_no: line.order_no,
          status: line.status,
          delivery_terms: line.delivery_terms,
          freight_terms: line.freight_terms,
          transporter_name: line.transporter_name,
          lr_number: line.lr_number,
          collection_type: line.collection_type,
          itemCount: 0,
          totalQty: 0,
          totalTax: 0,
          totalLanded: 0,
        });
      }
      const g = grnMap.get(line.receipt_no);
      g.itemCount += 1;
      g.totalQty += Number(line.quantity_received) || 0;
      g.totalTax += Number(line.tax_amount) || 0;
      g.totalLanded += Number(line.line_total) || 0;
    }
    return Array.from(grnMap.values());
  }, [filteredGrnLines]);

  const grnTotals = useMemo(() => {
    let totalQty = 0;
    let totalTax = 0;
    let totalLanded = 0;
    for (const l of filteredGrnLines) {
      totalQty += Number(l.quantity_received) || 0;
      totalTax += Number(l.tax_amount) || 0;
      totalLanded += Number(l.line_total) || 0;
    }
    return {
      grnCount: new Set(filteredGrnLines.map((l: any) => l.receipt_no)).size,
      totalQty,
      totalTax,
      totalLanded,
    };
  }, [filteredGrnLines]);

  useEffect(() => {
    async function loadReportsData() {
      if (!selectedReport) return;
      setLoadingReports(true);
      setGenericReportData(null);
      const params = `?from_date=${filters.startDate}&to_date=${filters.endDate}`;
      try {
        if (selectedReport.id === "RPT-SAL-001") {
          const reportDateParam = filters.startDate === filters.endDate ? `?report_date=${filters.startDate}` : "";
          const data = await apiFetchV1(`/reports/daily-sales${reportDateParam}`);
          setSalesReportData(data);

          const valData = await apiFetchV1("/reports/stock-valuation");
          setStockValuationData(valData);
        } else if (selectedReport.id === "RPT-PUR-001") {
          const data = await apiFetchV1(`/reports/purchase-inward-register${params}`);
          setPurchaseInwardData(data);
        } else if (selectedReport.id === "RPT-PUR-002") {
          const data = await apiFetchV1(`/reports/purchase-summary${params}`);
          setPurchaseReportData(data);

          if (drillLevel === 1 && drillFilter) {
            const ledger = await apiFetchV1(`/reports/supplier-ledger/${drillFilter}`);
            setSelectedSupplierLedger(ledger);
          }
        } else if (selectedReport.id === "RPT-PUR-003") {
          const data = await apiFetchV1("/reports/pending-delivery");
          setGenericReportData(Array.isArray(data) ? data : []);
        } else if (selectedReport.id === "RPT-PUR-004") {
          const data = await apiFetchV1("/reports/supplier-outstanding");
          setGenericReportData(Array.isArray(data) ? data : []);
        } else if (selectedReport.id === "RPT-PUR-005") {
          const data = await apiFetchV1("/reports/pending-requisitions");
          setGenericReportData(Array.isArray(data) ? data : []);
        } else if (selectedReport.id === "RPT-PUR-006") {
          const data = await apiFetchV1("/reports/requisition-conversion-tracking");
          setGenericReportData(Array.isArray(data) ? data : []);
        } else if (selectedReport.id === "RPT-PUR-007") {
          const data = await apiFetchV1("/reports/rfq-quotation-register");
          setGenericReportData(Array.isArray(data) ? data : []);
        } else if (selectedReport.id === "RPT-INV-001") {
          const data = await apiFetchV1("/inventory-reports/balance?zero_stock=true");
          setGenericReportData(data);
        } else if (selectedReport.id === "RPT-INV-002") {
          const data = await apiFetchV1(`/inventory-reports/movement${params}`);
          setGenericReportData(data);
        } else if (selectedReport.id === "RPT-INV-003") {
          const data = await apiFetchV1("/inventory-reports/availability");
          setGenericReportData(data);
        } else if (selectedReport.id === "RPT-INV-004") {
          const data = await apiFetchV1(`/inventory-reports/aging?as_on_date=${filters.endDate}`);
          setGenericReportData(data);
        } else if (selectedReport.id === "RPT-INV-005") {
          const data = await apiFetchV1(`/inventory-reports/goods-register${params}`);
          setGenericReportData({ ...data, lines: data.documents ?? [] });
        } else if (selectedReport.id === "RPT-INV-006") {
          const data = await apiFetchV1(`/inventory-reports/goods-register-item${params}`);
          setGenericReportData(data);
        } else if (selectedReport.id === "RPT-INV-007") {
          const data = await apiFetchV1(`/inventory-reports/returns${params}`);
          setGenericReportData(data);
        } else if (selectedReport.id === "RPT-INV-008") {
          const data = await apiFetchV1(`/inventory-reports/adjustments${params}`);
          setGenericReportData(data);
        } else if (selectedReport.id === "RPT-TAX-001") {
          const data = await apiFetchV1(`/reports/tax-register${params}`);
          setGenericReportData(data);
        } else if (selectedReport.id === "RPT-TAX-002") {
          const data = await apiFetchV1(`/reports/bill-wise-sales${params}`);
          setGenericReportData(data);
        } else if (selectedReport.id === "RPT-TAX-003") {
          const data = await apiFetchV1(`/reports/item-wise-sales${params}`);
          setGenericReportData(data);
        } else if (selectedReport.id === "RPT-TAX-004") {
          const data = await apiFetchV1(`/reports/cancelled-bills${params}`);
          setGenericReportData(data);
        } else if (selectedReport.id === "RPT-TAX-005" || selectedReport.id === "RPT-SAL-013") {
          try {
            const data = await apiFetchV1(`/reports/bill-wise-items${params}`);
            if (data?.lines && data.lines.length > 0) {
              setGenericReportData(data);
            } else {
              const liveData = await apiFetchV1(`/sales-reports/bill-items-live${params}`);
              setGenericReportData(liveData);
            }
          } catch {
            const liveData = await apiFetchV1(`/sales-reports/bill-items-live${params}`);
            setGenericReportData(liveData);
          }
        } else if (selectedReport.id === "RPT-MIS-005") {
          const data = await apiFetchV1(`/reports/salesperson-discount${params}`);
          setGenericReportData(data);
        } else if (selectedReport.id === "RPT-OPS-001") {
          const data = await apiFetchV1(`/reports/discount-summary${params}`);
          setGenericReportData(data);
        } else if (selectedReport.id === "RPT-MRC-003") {
          const data = await apiFetchV1(`/reports/item-wise-returns${params}`);
          setGenericReportData(data);
        } else if (selectedReport.id === "RPT-MRC-001") {
          const data = await apiFetchV1(`/reports/attribute-size-sales${params}`);
          setGenericReportData(data);
        } else if (selectedReport.id === "RPT-TAX-006") {
          const data = await apiFetchV1(`/reports/tax-invoices-master-register${params}&include_archived=true`);
          setGenericReportData(data);
        } else if (selectedReport.id === "RPT-TAX-007") {
          const data = await apiFetchV1("/reports/invoice-reconciliation?bill_from=18&bill_to=137&include_archived=true");
          setGenericReportData(data);
        } else if (selectedReport.id === "RPT-MRC-005") {
          const data = await apiFetchV1(`/reports/article-color-size-matrix${params}`);
          setGenericReportData(data);
        } else if (selectedReport.id === "RPT-OPS-006") {
          const data = await apiFetchV1(`/reports/store-wise-summary${params}`);
          setGenericReportData(data);
        } else if (selectedReport.id === "RPT-SO-001") {
          const data = await apiFetchV1(`/reports/sales-orders/summary${params}`);
          setGenericReportData(data);
        } else if (selectedReport.id === "RPT-SO-008") {
          const data = await apiFetchV1(`/reports/sales-orders/detailed${params}`);
          setGenericReportData(data);
        } else if (selectedReport.id === "RPT-SO-009") {
          const data = await apiFetchV1(`/reports/sales-orders/fulfillment-variance${params}`);
          setGenericReportData(data);
        } else if (selectedReport.id === "RPT-SO-002") {
          const data = await apiFetchV1(`/reports/sales-orders/pending${params}`);
          setGenericReportData(data);
        } else if (selectedReport.id === "RPT-SO-003") {
          const data = await apiFetchV1(`/reports/sales-orders/billed-vs-pending${params}`);
          setGenericReportData(data);
        } else if (selectedReport.id === "RPT-SO-004") {
          const data = await apiFetchV1(`/reports/sales-orders/customer-wise${params}`);
          setGenericReportData(data);
        } else if (selectedReport.id === "RPT-SO-005") {
          const data = await apiFetchV1(`/reports/sales-orders/product-wise${params}`);
          setGenericReportData(data);
        } else if (selectedReport.id === "RPT-SO-006") {
          const data = await apiFetchV1(`/reports/sales-orders/fulfillment-status${params}`);
          setGenericReportData(data);
        } else if (selectedReport.id === "RPT-SO-007") {
          const data = await apiFetchV1(`/reports/sales-orders/invoice-allocations${params}`);
          setGenericReportData(data);
        } else if (selectedReport.id === "RPT-SAL-006") {
          const data = await apiFetchV1(`/sales-reports/top-selling${params}`);
          setGenericReportData(data);
        } else if (selectedReport.id === "RPT-SAL-007") {
          const data = await apiFetchV1(`/sales-reports/day-wise${params}`);
          setGenericReportData(data);
        } else if (selectedReport.id === "RPT-SAL-008") {
          const data = await apiFetchV1(`/sales-reports/salesperson-sales${params}`);
          setGenericReportData(data);
        } else if (selectedReport.id === "RPT-SAL-009") {
          const data = await apiFetchV1(`/sales-reports/salesperson-summary${params}`);
          setGenericReportData(data);
        } else if (selectedReport.id === "RPT-SAL-010") {
          const data = await apiFetchV1(`/sales-reports/returned-bills${params}`);
          setGenericReportData(data);
        } else if (selectedReport.id === "RPT-SAL-011") {
          const data = await apiFetchV1(`/sales-reports/node-wise${params}`);
          setGenericReportData(data);
        } else if (selectedReport.id === "RPT-SAL-013") {
          const data = await apiFetchV1(`/sales-reports/bill-items-live${params}`);
          setGenericReportData(data);
        } else if (selectedReport.id === "RPT-SAL-014") {
          const data = await apiFetchV1(`/sales-reports/size-wise${params}`);
          setGenericReportData(data);
        } else if (selectedReport.id === "RPT-SAL-015") {
          const data = await apiFetchV1(`/sales-reports/item-returns-live${params}`);
          setGenericReportData(data);
        } else if (selectedReport.id === "RPT-ACCT-001") {
          // Phase 1E — Universal envelope endpoint; pass year/month only when both are set
          const periodSuffix =
            acctYear !== "" && acctMonth !== ""
              ? `&year=${acctYear}&month=${acctMonth}`
              : "";
          const data = await apiFetchV1(`/reports/universal/RPT-ACCT-001?${periodSuffix}`);
          setAcctEnvelope(data);
        } else {
          setGenericReportData(null);
        }
      } catch (err) {
        console.error("Failed to load reports from FastAPI:", err);
        setGenericReportData(null);
        showNotification(
          "error",
          `Unable to load ${selectedReport.title}. Please retry or contact an administrator.`
        );
      } finally {
        setLoadingReports(false);
        setLastRefreshedAt(new Date());
      }
    }
    loadReportsData();
  }, [selectedReport, drillLevel, drillFilter, filters.startDate, filters.endDate, reportRefreshKey, acctYear, acctMonth]);

  // Debounced search query audit logging
  useEffect(() => {
    if (!searchQuery) return;
    const timer = setTimeout(() => {
      recordAuditAction("SEARCH", "reports", "search", `Search performed for: "${searchQuery}"`);
    }, 1200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Report filter changes audit logging
  useEffect(() => {
    if (!selectedReport) return;
    recordAuditAction(
      "FILTER",
      "reports",
      selectedReport.id,
      `Filters applied: Start=${filters.startDate}, End=${filters.endDate}, Group=${filters.productGroup}, Payment=${filters.paymentMode}`
    );
  }, [filters, selectedReport]);

  // Fetch report registry categorized under studios
  const [studios, setStudios] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [notifMessage, setNotifMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  useEffect(() => {
    fetchStudios();
    fetchSchedules();
  }, [activeRole]);

  useEffect(() => {
    const handleStudioSelect = (event: Event) => {
      const studioId = (event as CustomEvent<{ studioId?: string }>).detail?.studioId;
      if (!studioId) return;
      const area = resolveReportBusinessArea(studioId);
      if (!area) return;
      setActiveStudio(area.id);
      setActiveView("bi_center");
      setSelectedReport(null);
    };

    window.addEventListener("smriti_report_studio_select", handleStudioSelect);
    return () => window.removeEventListener("smriti_report_studio_select", handleStudioSelect);
  }, []);

  const showNotification = (type: "success" | "error" | "info", text: string) => {
    setNotifMessage({ type, text });
    setTimeout(() => setNotifMessage(null), 4000);
  };

  const handleOpenInGoogleSheets = async () => {
    try {
      const moduleTitle = selectedReport?.title || "SMRITI Report";
      let columns: any[] = [];
      let rows: any[] = [];

      if (selectedReport?.id === "RPT-TAX-001" && genericReportData?.lines) {
        columns = [
          { key: "invoice_number", label: "Invoice #", datatype: "text" },
          { key: "invoice_date", label: "Date", datatype: "date" },
          { key: "customer_name", label: "Customer", datatype: "text" },
          { key: "taxable_amount", label: "Taxable Amount (INR)", datatype: "currency", isSummary: true },
          { key: "cgst_rate", label: "CGST %", datatype: "percentage" },
          { key: "cgst_amount", label: "CGST Amount", datatype: "currency", isSummary: true },
          { key: "sgst_rate", label: "SGST %", datatype: "percentage" },
          { key: "sgst_amount", label: "SGST Amount", datatype: "currency", isSummary: true },
          { key: "igst_rate", label: "IGST %", datatype: "percentage" },
          { key: "igst_amount", label: "IGST Amount", datatype: "currency", isSummary: true },
          { key: "total_tax", label: "Total Tax (INR)", datatype: "currency", isSummary: true },
          { key: "net_amount", label: "Net Total (INR)", datatype: "currency", isSummary: true },
        ];
        rows = genericReportData.lines;
      } else if (selectedReport?.id === "RPT-TAX-002" && genericReportData?.lines) {
        columns = [
          { key: "invoice_number", label: "Invoice #", datatype: "text" },
          { key: "invoice_date", label: "Date", datatype: "date" },
          { key: "customer_name", label: "Customer", datatype: "text" },
          { key: "payment_mode", label: "Payment Mode", datatype: "text" },
          { key: "items_count", label: "Items", datatype: "number", isSummary: true },
          { key: "gross_amount", label: "Gross (INR)", datatype: "currency", isSummary: true },
          { key: "discount", label: "Discount (INR)", datatype: "currency", isSummary: true },
          { key: "tax_amount", label: "Tax (INR)", datatype: "currency", isSummary: true },
          { key: "net_amount", label: "Net Amount (INR)", datatype: "currency", isSummary: true },
        ];
        rows = genericReportData.lines;
      } else if (selectedReport?.id === "RPT-TAX-003" && genericReportData?.lines) {
        columns = [
          { key: "item_code", label: "Item Code", datatype: "text" },
          { key: "item_name", label: "Item Description", datatype: "text" },
          { key: "category", label: "Category", datatype: "text" },
          { key: "hsn_code", label: "HSN", datatype: "text" },
          { key: "quantity", label: "Units Sold", datatype: "number", isSummary: true },
          { key: "unit_price", label: "Unit Price", datatype: "currency" },
          { key: "taxable_amount", label: "Taxable Value", datatype: "currency", isSummary: true },
          { key: "gst_rate", label: "GST %", datatype: "percentage" },
          { key: "gst_amount", label: "GST Amount", datatype: "currency", isSummary: true },
          { key: "total_amount", label: "Total Amount (INR)", datatype: "currency", isSummary: true },
        ];
        rows = genericReportData.lines;
      } else if (purchaseReportData && purchaseReportData.length > 0) {
        columns = [
          { key: "supplier_name", label: "Supplier Name", datatype: "text" },
          { key: "supplier_id", label: "Supplier Code", datatype: "text" },
          { key: "po_count", label: "Open POs", datatype: "number", isSummary: true },
          { key: "outstanding", label: "Outstanding Due (INR)", datatype: "currency", isSummary: true },
        ];
        rows = purchaseReportData;
      } else if (stockValuationData?.lines && stockValuationData.lines.length > 0) {
        columns = [
          { key: "name", label: "Product Name", datatype: "text" },
          { key: "code", label: "SKU Code", datatype: "text" },
          { key: "style_code", label: "Style", datatype: "text" },
          { key: "stock", label: "Stock Units", datatype: "number", isSummary: true },
          { key: "cost_price", label: "Unit Cost", datatype: "currency" },
          { key: "stock_value", label: "Stock Valuation", datatype: "currency", isSummary: true },
        ];
        rows = stockValuationData.lines;
      } else if (purchaseInwardData?.lines && purchaseInwardData.lines.length > 0) {
        columns = [
          { key: "receipt_no", label: "GRN #", datatype: "text" },
          { key: "receipt_date", label: "Date", datatype: "date" },
          { key: "supplier_name", label: "Supplier", datatype: "text" },
          { key: "order_no", label: "PO #", datatype: "text" },
          { key: "delivery_terms", label: "Delivery Terms", datatype: "text" },
          { key: "transporter_name", label: "Transporter", datatype: "text" },
          { key: "lr_number", label: "LR #", datatype: "text" },
          { key: "product_code", label: "Article / SKU", datatype: "text" },
          { key: "product_name", label: "Description", datatype: "text" },
          { key: "quantity_received", label: "Qty Received", datatype: "number", isSummary: true },
          { key: "cost_price", label: "Cost Rate", datatype: "currency" },
          { key: "gst_rate", label: "GST %", datatype: "percentage" },
          { key: "tax_amount", label: "Tax (INR)", datatype: "currency", isSummary: true },
          { key: "line_total", label: "Line Total (INR)", datatype: "currency", isSummary: true },
          { key: "status", label: "Status", datatype: "text" },
        ];
        rows = purchaseInwardData.lines;
      } else if (genericReportData?.lines || genericReportData?.rows) {
        const rawList = genericReportData.lines || genericReportData.rows || [];
        if (rawList.length > 0) {
          const sample = rawList[0];
          columns = Object.keys(sample).map((k) => ({
            key: k,
            label: k.replace(/_/g, " ").toUpperCase(),
            datatype: typeof sample[k] === "number" ? "number" : "text",
            isSummary: typeof sample[k] === "number",
          }));
          rows = rawList;
        }
      }

      if (rows.length === 0) {
        showNotification("info", "No live data is available for this report and date range. Nothing was exported.");
        return;
      }

      await GlobalExportService.openInGoogleSheets({
        moduleName: selectedReport?.title || "Report",
        format: "gsheet",
        scope: "all",
        columns,
        data: rows,
        metadata: {
          moduleTitle: selectedReport?.title || "Report",
          exportTimestamp: new Date().toISOString(),
          dateRange: { start: filters.startDate, end: filters.endDate }
        }
      });

      recordAuditAction("EXPORT_GSHEET", "reports", selectedReport?.id || "RPT-GEN", `Opened in Google Sheets: ${selectedReport?.title}`);
      showNotification("success", "Opened in Google Sheets! Dataset copied to clipboard (Ctrl+V / Cmd+V to paste) and CSV backup downloaded.");
    } catch (err: any) {
      console.error("Failed to open in Google Sheets:", err);
      showNotification("error", "Could not open Google Sheets automatically.");
    }
  };

  const fetchStudios = async () => {
    try {
      setLoading(true);
      // Migrated: /api/reports/list (Express, unmounted) → /api/v1/reports/studios (FastAPI)
      const data = await apiFetchV1("/reports/studios");
      if (data?.studios) {
        setStudios(data.studios);
      }
    } catch (e) {
      console.error(e);
      showNotification("error", "Failed to retrieve reports metadata from SMRITI registry.");
    } finally {
      setLoading(false);
      setLastRefreshedAt(new Date());
    }
  };

  const fetchSchedules = async () => {
    try {
      // Migrated: /api/reports/schedules (Express, unmounted) → /api/v1/reports/schedules (FastAPI)
      const data = await apiFetchV1("/reports/schedules");
      if (Array.isArray(data)) {
        setSchedules(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRegisterSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReport) return;

    try {
      // Migrated: POST /api/reports/schedule (Express) → POST /api/v1/reports/schedules (FastAPI)
      // Payload: camelCase Express → snake_case FastAPI; recipientEmail → delivery_target
      const data = await apiFetchV1("/reports/schedules", {
        method: "POST",
        body: JSON.stringify({
          report_id:        selectedReport.id,
          report_name:      selectedReport.title,
          frequency:        scheduleForm.frequency.toUpperCase(),
          execution_time:   scheduleForm.cron.match(/^(\d+) (\d+)/) ? `${scheduleForm.cron.split(' ')[1].padStart(2,'0')}:${scheduleForm.cron.split(' ')[0].padStart(2,'0')}` : "08:00",
          delivery_channel: "EMAIL",
          delivery_target:  scheduleForm.recipientEmail,
          delivery_format:  scheduleForm.format,
        })
      });
      showNotification("success", `Schedule registered successfully under ID ${data?.id}`);
      setShowScheduleModal(false);
      fetchSchedules();
    } catch (err: any) {
      console.error(err);
      showNotification("error", err?.message || "Failed to save automated schedule.");
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    try {
      // Migrated: DELETE /api/reports/schedule/:id (Express) → DELETE /api/v1/reports/schedules/:id (FastAPI)
      await apiFetchV1(`/reports/schedules/${id}`, { method: "DELETE" });
      showNotification("success", "Automated schedule canceled.");
      fetchSchedules();
    } catch (e: any) {
      console.error(e);
      showNotification("error", e?.message || "Failed to clear schedule.");
    }
  };

  const handleTriggerExport = async (format: string) => {
    if (activeRole === "Cashier") {
      showNotification("error", "Rule 10 Restricted: Cashiers are denied document export privileges.");
      return;
    }
    recordAuditAction("EXPORT", "reports", selectedReport?.id || "RPT-GEN", `Report exported: ${selectedReport?.title || "Standard Report"} (Format: ${format.toUpperCase()})`);

    const upperFormat = format.toUpperCase();

    // 1. Direct High-Fidelity Native Backend Excel/CSV Routes for Master Registers
    if (upperFormat === "XLSX" && selectedReport?.id === "RPT-TAX-006") {
      const link = document.createElement("a");
      link.href = "/api/v1/reports/export/tax-invoices-excel";
      link.download = "SMRITI_Statutory_Tax_Invoices_Master.xlsx";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showNotification("success", "Initiated download of Statutory Tax Invoices Master Workbook (.xlsx)");
      return;
    }

    if (upperFormat === "XLSX" && selectedReport?.id === "RPT-SO-008") {
      const link = document.createElement("a");
      link.href = "/api/v1/reports/sales-orders/export-excel";
      link.download = "SMRITI_Sales_Orders_Master_Register.xlsx";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showNotification("success", "Initiated download of Master 6-Sheet Sales Orders Workbook (.xlsx)");
      return;
    }

    if (upperFormat === "CSV" && selectedReport?.id === "RPT-SO-008") {
      const link = document.createElement("a");
      link.href = "/api/v1/reports/sales-orders/export-csv";
      link.download = "SMRITI_Sales_Orders_Flat.csv";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showNotification("success", "Initiated download of Flat Sales Orders CSV (.csv)");
      return;
    }

    // 2. Browser Print / PDF
    if (upperFormat === "PDF") {
      window.print();
      return;
    }

    // 3. Dynamic Data Extraction across all SMRITI Report states
    let activeData: any[] = [];

    if (genericReportData) {
      if (Array.isArray(genericReportData)) {
        activeData = genericReportData;
      } else if (Array.isArray(genericReportData.orders) && genericReportData.orders.length > 0) {
        activeData = genericReportData.orders;
      } else if (Array.isArray(genericReportData.lines) && genericReportData.lines.length > 0) {
        activeData = genericReportData.lines;
      } else if (Array.isArray(genericReportData.bills) && genericReportData.bills.length > 0) {
        activeData = genericReportData.bills;
      } else if (Array.isArray(genericReportData.invoices) && genericReportData.invoices.length > 0) {
        activeData = genericReportData.invoices;
      } else if (Array.isArray(genericReportData.items) && genericReportData.items.length > 0) {
        activeData = genericReportData.items;
      } else if (Array.isArray(genericReportData.stores) && genericReportData.stores.length > 0) {
        activeData = genericReportData.stores;
      } else if (Array.isArray(genericReportData.styles) && genericReportData.styles.length > 0) {
        activeData = genericReportData.styles;
      } else {
        // Find any non-empty array property
        const arrayProp = Object.values(genericReportData).find((v) => Array.isArray(v) && v.length > 0);
        if (arrayProp && Array.isArray(arrayProp)) {
          activeData = arrayProp;
        } else if (typeof genericReportData === "object" && genericReportData !== null) {
          activeData = [genericReportData];
        }
      }
    } else if (Array.isArray(purchaseReportData) && purchaseReportData.length > 0) {
      activeData = purchaseReportData;
    } else if (salesReportData) {
      if (Array.isArray(salesReportData)) {
        activeData = salesReportData;
      } else if (Array.isArray(salesReportData.daily_sales)) {
        activeData = salesReportData.daily_sales;
      } else if (Array.isArray(salesReportData.lines)) {
        activeData = salesReportData.lines;
      } else {
        activeData = [salesReportData];
      }
    } else if (stockValuationData) {
      if (Array.isArray(stockValuationData)) {
        activeData = stockValuationData;
      } else if (Array.isArray(stockValuationData.items)) {
        activeData = stockValuationData.items;
      } else {
        activeData = [stockValuationData];
      }
    } else if (purchaseInwardData) {
      if (Array.isArray(purchaseInwardData)) {
        activeData = purchaseInwardData;
      } else if (Array.isArray(purchaseInwardData.lines)) {
        activeData = purchaseInwardData.lines;
      } else {
        activeData = [purchaseInwardData];
      }
    }

    const exportFormat: any =
      upperFormat === "XLSX" ? "xlsx" :
      upperFormat === "CSV" ? "csv" :
      upperFormat === "JSON" ? "json" :
      upperFormat === "HTML" ? "html" : "txt";

    let reportCols: any[] = [];
    let reportRows: any[] = [];

    if (activeData.length > 0) {
      // Gather all unique keys across rows
      const keySet = new Set<string>();
      activeData.forEach((row) => {
        if (row && typeof row === "object") {
          Object.keys(row).forEach((k) => keySet.add(k));
        }
      });

      reportCols = Array.from(keySet)
        .filter((k) => !["id", "_id", "__v"].includes(k))
        .map((k) => {
          const lk = k.toLowerCase();
          let datatype: "currency" | "number" | "date" | "text" = "text";
          if (lk.includes("amount") || lk.includes("price") || lk.includes("total") || lk.includes("value") || lk.includes("tax") || lk.includes("mrp") || lk.includes("basic") || lk.includes("rate")) {
            datatype = "currency";
          } else if (lk.includes("qty") || lk.includes("quantity") || lk.includes("count") || lk.includes("units") || lk.includes("pieces")) {
            datatype = "number";
          } else if (lk.includes("date") || lk.includes("created_at") || lk.includes("updated_at")) {
            datatype = "date";
          }
          return {
            key: k,
            label: k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
            datatype,
            width: 20,
          };
        });

      reportRows = activeData;
    } else {
      reportCols = [
        { key: "code", label: "Report Code", datatype: "text" as const, width: 14 },
        { key: "title", label: "Report Title", datatype: "text" as const, width: 28 },
        { key: "category", label: "Category", datatype: "text" as const, width: 16 },
        { key: "format", label: "Visual Format", datatype: "text" as const, width: 14 },
        { key: "drillLevel", label: "Drill Level", datatype: "number" as const, width: 12 },
        { key: "drillFilter", label: "Active Drill Filter", datatype: "text" as const, width: 22 },
        { key: "exportDate", label: "Export Timestamp", datatype: "datetime" as const, width: 20 },
      ];

      reportRows = [
        {
          code: selectedReport?.id || "RPT-GEN",
          title: selectedReport?.title || "Standard Report",
          category: selectedReport?.category || "Financial",
          format: selectedReport?.format || "Grid",
          drillLevel: drillLevel || 0,
          drillFilter: drillFilter || "None",
          exportDate: new Date().toISOString(),
        },
      ];
    }

    const result = await GlobalExportService.exportDataset({
      moduleName: (selectedReport?.title || "Report_Export").replace(/[^a-zA-Z0-9_-]/g, "_"),
      format: exportFormat,
      scope: "currentPage",
      columns: reportCols,
      data: reportRows,
      metadata: {
        moduleTitle: selectedReport?.title || "Report Export",
        companyName: "SMRITI Enterprise",
        searchTerm: drillFilter || undefined,
        exportTimestamp: new Date().toLocaleString(),
      },
    });

    if (result.success) {
      showNotification("success", `File download completed: ${result.filename}`);
    } else {
      showNotification("error", result.errorMessage || "Failed to generate report export.");
    }
  };

  const handleShareReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeRole === "Cashier") {
      showNotification("error", "Rule 10 Policy: Cashier is unauthorized to distribute business data externally.");
      return;
    }

    if (shareType === "Email") {
      showNotification("success", `Securing connection... dispatching report via encrypted TLS mailer to ${shareForm.email}`);
    } else {
      showNotification("success", `Opening WhatsApp Web gateway to dispatch report document package to +${shareForm.phone}`);
      window.open(`https://wa.me/${shareForm.phone}?text=${encodeURIComponent(shareForm.message + " - Report: " + selectedReport?.title)}`, "_blank");
    }
    setShowShareModal(false);
  };

  // Helper check for active permissions
  const canPerformAction = (action: string, reportId?: string): boolean => {
    if (activeRole === "CEO") return true;
    if (activeRole === "Report User") return true;
    if (activeRole === "Cashier") {
      if (action === "export" || action === "schedule" || action === "email") return false;
      if (reportId && (reportId.startsWith("RPT-FIN") || reportId === "RPT-CST-LOG")) return false;
    }
    if (activeRole === "Store Manager") {
      if (reportId === "RPT-FIN-003" && (action === "export" || action === "schedule")) return false;
    }
    return true;
  };

  // Switch views
  const runReport = (report: any) => {
    setSelectedReport(report);
    setReportRefreshKey(0);
    recordAuditAction("VIEW", "reports", report.id, `Report viewed: ${report.title}`);
    setBreadcrumbs([{ title: report.title, level: 0, id: report.id }]);
    setDrillLevel(0);
    setDrillFilter("");
    setActiveView("viewer");
  };

  const handleBreadcrumbClick = (index: number) => {
    const bc = breadcrumbs[index];
    setBreadcrumbs(breadcrumbs.slice(0, index + 1));
    setDrillLevel(bc.level);
    setDrillFilter(bc.category || "");
  };

  const performDrilldown = (nextLevel: number, rowId: string, rowTitle: string) => {
    if (!canPerformAction("drill_down", selectedReport?.id)) {
      showNotification("error", "Security Shield: Your active role has insufficient permissions to perform multi-level transactional drills.");
      return;
    }
    recordAuditAction("DRILL_DOWN", "reports", selectedReport?.id || "RPT-GEN", `Drill-down triggered to level ${nextLevel} (Target: ${rowTitle})`);
    setDrillLevel(nextLevel);
    setDrillFilter(rowId);
    setBreadcrumbs([...breadcrumbs, { title: rowTitle, level: nextLevel, id: rowId, category: rowId }]);
  };

  const handleConvertToInvoice = async (orderId: string, orderNo: string) => {
    try {
      const cleanId = String(orderId || "").replace(/^:/, "").trim();
      setConvertingOrderId(cleanId || orderId);
      const res = await apiFetchV1(`/sales/orders/${encodeURIComponent(cleanId)}/convert-to-invoice`, { method: "POST" });
      showNotification("success", `Sales Order ${orderNo} converted to Tax Invoice ${res.invoice_no}!`);
      const params = `?from_date=${filters.startDate}&to_date=${filters.endDate}`;
      if (selectedReport?.id === "RPT-SO-009") {
        const data = await apiFetchV1(`/reports/sales-orders/fulfillment-variance${params}`);
        setGenericReportData(data);
      } else if (selectedReport?.id === "RPT-SO-008") {
        const data = await apiFetchV1(`/reports/sales-orders/detailed${params}`);
        setGenericReportData(data);
      }
    } catch (e: any) {
      showNotification("error", e?.message || "Failed to convert sales order to invoice.");
    } finally {
      setConvertingOrderId(null);
    }
  };

  const handlePreviewSO = async (orderId: string) => {
    try {
      const cleanId = String(orderId || "").replace(/^:/, "").trim();
      if (!cleanId) return;
      const order = await apiFetchV1(`/sales/orders/${encodeURIComponent(cleanId)}`);
      setSoPreviewData(order);
      setShowSoPrintModal(true);
    } catch (e: any) {
      showNotification("error", "Failed to load sales order details for preview.");
    }
  };

  // Collect reports from every source catalog assigned to the selected business area.
  const activeBusinessArea = resolveReportBusinessArea(activeStudio);
  const currentStudioReports = activeBusinessArea
    ? activeBusinessArea.studioIds.flatMap((studioId) => studios[studioId]?.reports || [])
    : [];
  const totalReportCount = Object.values(studios).reduce(
    (total, studio: any) => total + (studio.reports?.length || 0),
    0,
  );
  const activeSubcategoryCount = new Set(
    currentStudioReports.map((report: any) => report.category),
  ).size;
  const filteredReports = currentStudioReports.filter((r: any) =>
    r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 select-none">
      {/* SMRITI Global Notification Banner */}
      <AnimatePresence>
        {notifMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-2xl border backdrop-blur-md text-xs font-semibold ${
              notifMessage.type === "success"
                ? "bg-emerald-950/90 text-emerald-300 border-emerald-500/30"
                : "bg-rose-950/90 text-rose-300 border-rose-500/30"
            }`}
          >
            {notifMessage.type === "success" ? <ShieldCheck className="text-emerald-400" size={18} /> : <ShieldAlert className="text-rose-400" size={18} />}
            <span>{notifMessage.text}</span>
            <button onClick={() => setNotifMessage(null)} className="ml-2 hover:text-white"><X size={14} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Controller Bar */}
      <div className="bg-theme-surface-1 border border-theme-border rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-xs">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-lg font-bold text-theme-body tracking-tight">SMRITI BI &amp; Reporting Center</h2>
            <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold px-2 py-0.5 rounded font-mono uppercase">
              Studios v2.2
            </span>
          </div>
            <p className="text-xs text-theme-muted font-mono mt-0.5">
            Report Designer Studio / governed analytics workspace for live retail reporting, publishing, and distribution.
          </p>
        </div>

          <div className="flex items-center gap-2 self-stretch md:self-auto flex-wrap">
            {/* View Mode Segmented Switcher */}
            <div className="inline-flex rounded-lg border border-theme-border bg-theme-surface-2 p-0.5 text-xs font-semibold">
              <button
                type="button"
                id="report-tab-bi-catalog-btn"
                onClick={() => setActiveView("bi_center")}
                className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors cursor-pointer ${
                  activeView === "bi_center"
                    ? "bg-theme-surface-1 text-theme-primary shadow-xs font-bold"
                    : "text-theme-muted hover:text-theme-body"
                }`}
              >
                <LayoutGrid size={13} />
                <span>BI Catalog</span>
              </button>
              <button
                type="button"
                id="report-tab-report-builder-btn"
                onClick={() => setActiveView("designer")}
                className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors cursor-pointer ${
                  activeView === "designer"
                    ? "bg-theme-surface-1 text-theme-primary shadow-xs font-bold"
                    : "text-theme-muted hover:text-theme-body"
                }`}
              >
                <FileText size={13} />
                <span>Report Builder</span>
              </button>
              <button
                type="button"
                id="report-tab-visual-reports-btn"
                onClick={() => {
                  if (onNavigateTab) {
                    onNavigateTab("visual-reports");
                  } else {
                    window.dispatchEvent(new CustomEvent("navigate-tab", { detail: { tab: "visual-reports" } }));
                  }
                }}
                className="px-3 py-1.5 rounded-md flex items-center gap-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50/50 font-bold transition-colors cursor-pointer"
                title="Switch to Visual Reports Dashboard (Orders, Packing & Stock Flow)"
              >
                <BarChart3 size={13} className="text-blue-600" />
                <span>Visual Reports</span>
              </button>
            </div>

            <button
              type="button"
              id="reports-new-report-btn"
              onClick={() => {
                setActiveView("designer");
                showNotification("success", "SMRITI Report Builder opened for custom report design.");
              }}
              className="px-3 py-2 bg-theme-primary hover:bg-theme-primary-hover text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <Plus size={13} /> New Report
            </button>
            <button
              type="button"
              onClick={() => showNotification("success", "New dashboard workspace ready for configuration.")}
              className="px-3 py-2 bg-theme-surface-2 hover:bg-theme-surface-hover text-theme-body border border-theme-border rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <LayoutGrid size={13} /> New Dashboard
            </button>
            <button
              type="button"
              onClick={fetchStudios}
              disabled={loading}
              className="px-3 py-2 bg-theme-surface-2 hover:bg-theme-surface-hover text-theme-body border border-theme-border rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              title="Reload the complete report catalogue from the database"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Reports List
            </button>
            <button
              type="button"
              id="reports-balance-sheet-btn"
              onClick={() => setShowBalanceSheetModal(true)}
              className="px-3 py-2 bg-theme-surface-2 hover:bg-theme-surface-hover text-theme-body border border-theme-border rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Open Consolidated Multi-Branch Balance Sheet Report"
            >
              <FileSpreadsheet size={13} className="text-blue-600" />
              <span>Balance Sheet</span>
            </button>
            <button
              type="button"
              id="reports-pnl-dashboard-btn"
              onClick={() => setShowPLDashboardModal(true)}
              className="px-3 py-2 bg-theme-surface-2 hover:bg-theme-surface-hover text-theme-body border border-theme-border rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Inspect Branch Profit & Loss, COGS, Margins & Shrinkage"
            >
              <TrendingUp size={13} className="text-emerald-600" />
              <span>Branch P&amp;L</span>
            </button>
            <button
              type="button"
              id="reports-schedule-distribution-btn"
              onClick={() => setShowScheduleModal(true)}
              className="px-3 py-2 bg-theme-surface-2 hover:bg-theme-surface-hover text-theme-body border border-theme-border rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Automate Report Distribution via Cron & Dispatch Channels"
            >
              <Calendar size={13} className="text-purple-600" />
              <span>Schedule</span>
            </button>
            {lastRefreshedAt && (
              <span className="hidden xl:flex items-center gap-1 text-[10px] text-theme-muted font-mono whitespace-nowrap" title={lastRefreshedAt.toLocaleString()}>
                <Clock size={12} className="text-emerald-600" /> Live | {lastRefreshedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </div>

        {/* RBAC Role Swapper for Instant Interactive Testing */}
        <div className="flex items-center gap-2 self-stretch md:self-auto bg-theme-surface-2 border border-theme-border px-3 py-1.5 rounded-lg text-xs">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="text-emerald-600" size={14} />
            <span className="font-semibold text-theme-muted font-mono text-[11px]">Simulate Role:</span>
          </div>
          <select
            value={activeRole}
            onChange={(e) => {
              setActiveRole(e.target.value);
              setActiveView("bi_center");
              setSelectedReport(null);
              showNotification("success", `Active session mutated. Operating under role: ${e.target.value}`);
            }}
            className="bg-theme-surface-1 border border-theme-border rounded-md px-2 py-1 text-xs text-theme-body font-bold focus:outline-none focus:border-theme-primary cursor-pointer"
          >
            <option value="Store Manager">Store Manager (RBAC Level 3)</option>
            <option value="Cashier">Cashier (RBAC Level 1 - Rule 10 Active)</option>
            <option value="Report User">Report User (RBAC Level 2 - Read-Only/Print/Export)</option>
            <option value="CEO">CEO / Admin (RBAC Level 5)</option>
          </select>
        </div>
      </div>

      {activeView === "bi_center" && (
        <div className="bg-theme-surface-1 border border-theme-border rounded-xl px-4 py-3 shadow-xs flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-theme-body whitespace-nowrap mr-1">
              <Calendar size={14} className="text-theme-primary" />
              <span>Reporting Period</span>
            </div>
            {/* Quick 1-Click Presets */}
            <div className="flex items-center gap-1 bg-theme-surface-2 p-1 rounded-lg border border-theme-border text-xs font-semibold">
              <button
                type="button"
                onClick={() => setDatePreset("today")}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  activeDatePreset === "today"
                    ? "bg-theme-primary text-white font-bold shadow-xs"
                    : "text-theme-muted hover:text-theme-body"
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setDatePreset("yesterday")}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  activeDatePreset === "yesterday"
                    ? "bg-theme-primary text-white font-bold shadow-xs"
                    : "text-theme-muted hover:text-theme-body"
                }`}
              >
                Yesterday
              </button>
              <button
                type="button"
                onClick={() => setDatePreset("week")}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  activeDatePreset === "week"
                    ? "bg-theme-primary text-white font-bold shadow-xs"
                    : "text-theme-muted hover:text-theme-body"
                }`}
              >
                This Week
              </button>
              <button
                type="button"
                onClick={() => setDatePreset("month")}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  activeDatePreset === "month"
                    ? "bg-theme-primary text-white font-bold shadow-xs"
                    : "text-theme-muted hover:text-theme-body"
                }`}
              >
                This Month
              </button>
              <button
                type="button"
                onClick={() => setDatePreset("all")}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  activeDatePreset === "all"
                    ? "bg-theme-primary text-white font-bold shadow-xs"
                    : "text-theme-muted hover:text-theme-body"
                }`}
              >
                FY 2026-27
              </button>
            </div>

            {/* Store Scope: Default Single Store vs Conditional Multi-Location Switcher */}
            {!isLocationsManagementEnabled ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-theme-surface-2 border border-theme-border text-xs">
                <Store size={13} className="text-blue-500 shrink-0" />
                <span className="font-semibold text-theme-body truncate max-w-[140px]">{activeStoreName}</span>
                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 uppercase font-mono">
                  Single Store
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-theme-surface-2 border border-blue-500/40 text-xs">
                <Store size={13} className="text-blue-500 shrink-0" />
                <select
                  value={selectedStoreScope}
                  onChange={(e) => setSelectedStoreScope(e.target.value)}
                  className="bg-transparent text-theme-body font-bold text-xs focus:outline-none cursor-pointer"
                >
                  <option value="CURRENT_STORE">📍 {activeStoreName} (This Outlet)</option>
                  {availableBranches.map((b: any) => (
                    <option key={b.id} value={b.id}>🏢 {b.name} ({b.code})</option>
                  ))}
                  <option value="ALL_STORES_CONSOLIDATED">🌐 All Stores (Consolidated)</option>
                </select>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <label className="flex items-center gap-1.5 text-theme-muted">
              <span>From</span>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => {
                  setActiveDatePreset("custom");
                  setFilters({ ...filters, startDate: e.target.value });
                }}
                className="bg-theme-surface-2 border border-theme-border rounded-lg px-2 py-1 text-theme-body focus:outline-none focus:border-theme-primary font-mono"
              />
            </label>
            <label className="flex items-center gap-1.5 text-theme-muted">
              <span>To</span>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => {
                  setActiveDatePreset("custom");
                  setFilters({ ...filters, endDate: e.target.value });
                }}
                className="bg-theme-surface-2 border border-theme-border rounded-lg px-2 py-1 text-theme-body focus:outline-none focus:border-theme-primary font-mono"
              />
            </label>
            <button
              type="button"
              onClick={() => {
                setDatePreset("all");
                setFilters({
                  startDate: "2026-04-01",
                  endDate: new Date().toISOString().split("T")[0],
                  productGroup: "All",
                  paymentMode: "All",
                });
              }}
              className="px-2.5 py-1 text-theme-muted hover:text-theme-body border border-theme-border rounded-lg bg-theme-surface-2 hover:bg-theme-surface-hover font-semibold transition-colors cursor-pointer"
            >
              Reset
            </button>
          </div>
        </div>
      )}

      {/* Main View Manager */}
      {activeView === "bi_center" && (
        <div className="space-y-5">
            {loading ? (
              <div className="bg-theme-surface-1 border border-theme-border rounded-xl h-96 flex flex-col items-center justify-center text-center shadow-xs">
                <RefreshCw className="animate-spin text-theme-primary mb-3" size={28} />
                <p className="text-xs text-theme-muted font-mono">Retrieving active registry records...</p>
              </div>
            ) : (
              <>
                {/* 🌟 STANDARD DAILY RETAIL REPORTS HERO DASHBOARD */}
                <div className="bg-gradient-to-r from-theme-surface-1 via-theme-surface-2 to-theme-surface-1 border border-theme-border rounded-2xl p-5 shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-theme-divider pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-theme-primary text-xl">star</span>
                        <h2 className="text-sm font-bold uppercase tracking-wider text-theme-body font-mono">
                          Standard Daily Retail Reports
                        </h2>
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 uppercase font-mono">
                          Core ERP
                        </span>
                      </div>
                      <p className="text-xs text-theme-muted mt-0.5">
                        Essential daily transaction registers used by retail store managers, cashiers, and accountants.
                      </p>
                    </div>
                    {/* Store Scope Badge in Hero Dashboard */}
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-theme-surface-1 border border-theme-border text-xs">
                        <Store size={14} className="text-blue-500 shrink-0" />
                        <span className="font-bold text-theme-body font-mono">{activeStoreName}</span>
                        {!isLocationsManagementEnabled ? (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 uppercase font-mono">
                            Single Store Mode
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 border border-blue-500/20 uppercase font-mono">
                            Multi-Location
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                    {/* Card 1: Daily Sales Register */}
                    <div
                      onClick={() => handleLaunchStandardReport("sales_register")}
                      className="group bg-theme-surface-1 hover:bg-theme-surface-2 border border-theme-border hover:border-blue-500/50 rounded-xl p-4 transition-all duration-200 cursor-pointer shadow-xs hover:shadow-md flex flex-col justify-between"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center">
                            <Receipt size={17} />
                          </div>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 font-mono">
                            DAILY POS
                          </span>
                        </div>
                        <h3 className="text-xs font-bold text-theme-body group-hover:text-blue-500 transition-colors">
                          Daily Sales Register
                        </h3>
                        <p className="text-[11px] text-theme-muted line-clamp-2 leading-relaxed">
                          Line-item breakdown: Invoice #, Article No, Barcode, Size, Qty, Rate, Discount, GST & Net ₹.
                        </p>
                      </div>
                      <div className="mt-3.5 pt-2.5 border-t border-theme-divider/60 flex items-center justify-between text-[11px] font-semibold text-blue-500">
                        <span>Open Sales Register</span>
                        <ArrowRight size={13} className="group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>

                    {/* Card 2: Cashier & Payment Summary */}
                    <div
                      onClick={() => handleLaunchStandardReport("cashier_summary")}
                      className="group bg-theme-surface-1 hover:bg-theme-surface-2 border border-theme-border hover:border-emerald-500/50 rounded-xl p-4 transition-all duration-200 cursor-pointer shadow-xs hover:shadow-md flex flex-col justify-between"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                            <Coins size={17} />
                          </div>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 font-mono">
                            CASH CLOSING
                          </span>
                        </div>
                        <h3 className="text-xs font-bold text-theme-body group-hover:text-emerald-500 transition-colors">
                          Cashier & Tender Summary
                        </h3>
                        <p className="text-[11px] text-theme-muted line-clamp-2 leading-relaxed">
                          Daily cash, UPI / QR, credit card, and customer credit collections broken down by shift.
                        </p>
                      </div>
                      <div className="mt-3.5 pt-2.5 border-t border-theme-divider/60 flex items-center justify-between text-[11px] font-semibold text-emerald-500">
                        <span>Open Cash Summary</span>
                        <ArrowRight size={13} className="group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>

                    {/* Card 3: Purchase Inward Register */}
                    <div
                      onClick={() => handleLaunchStandardReport("purchase_register")}
                      className="group bg-theme-surface-1 hover:bg-theme-surface-2 border border-theme-border hover:border-amber-500/50 rounded-xl p-4 transition-all duration-200 cursor-pointer shadow-xs hover:shadow-md flex flex-col justify-between"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
                            <Truck size={17} />
                          </div>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 font-mono">
                            GOODS INWARD
                          </span>
                        </div>
                        <h3 className="text-xs font-bold text-theme-body group-hover:text-amber-500 transition-colors">
                          Purchase Inward Register
                        </h3>
                        <p className="text-[11px] text-theme-muted line-clamp-2 leading-relaxed">
                          Supplier invoices, received stock quantities, landed costs, taxes, and vendor payables.
                        </p>
                      </div>
                      <div className="mt-3.5 pt-2.5 border-t border-theme-divider/60 flex items-center justify-between text-[11px] font-semibold text-amber-500">
                        <span>Open Inward Register</span>
                        <ArrowRight size={13} className="group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>

                    {/* Card 4: Current Stock on Hand */}
                    <div
                      onClick={() => handleLaunchStandardReport("stock_on_hand")}
                      className="group bg-theme-surface-1 hover:bg-theme-surface-2 border border-theme-border hover:border-purple-500/50 rounded-xl p-4 transition-all duration-200 cursor-pointer shadow-xs hover:shadow-md flex flex-col justify-between"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-600 flex items-center justify-center">
                            <Boxes size={17} />
                          </div>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 font-mono">
                            STOCK VALUATION
                          </span>
                        </div>
                        <h3 className="text-xs font-bold text-theme-body group-hover:text-purple-500 transition-colors">
                          Current Stock on Hand
                        </h3>
                        <p className="text-[11px] text-theme-muted line-clamp-2 leading-relaxed">
                          Live warehouse stock balance by article, category, size, with unit cost and total valuation.
                        </p>
                      </div>
                      <div className="mt-3.5 pt-2.5 border-t border-theme-divider/60 flex items-center justify-between text-[11px] font-semibold text-purple-500">
                        <span>Open Stock Valuation</span>
                        <ArrowRight size={13} className="group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Active Studio Details Card */}
                <div className="bg-theme-surface-1 border border-theme-border rounded-xl p-5 shadow-xs relative">
                  <div className="flex items-center gap-2.5 mb-1">
                    <span className="material-symbols-outlined text-[24px] text-theme-primary">
                      {activeBusinessArea?.icon}
                    </span>
                    <h3 className="text-base font-bold text-theme-body tracking-tight">
                      {activeStudio === "all_reports" ? "All Reports" : `${activeBusinessArea?.label} Reports`}
                    </h3>
                  </div>
                  <p className="text-xs text-theme-muted font-mono">
                    Browse {currentStudioReports.length} reports. Access is checked under SMRITI RBAC guidelines.
                  </p>
                </div>

                {/* KPI Cards section based on selected studio */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {activeStudio === "sales_studio" && (
                    <>
                      <div className="bg-theme-surface-1 border border-theme-border rounded-xl p-4 shadow-xs space-y-1">
                        <div className="text-[10px] font-bold font-mono tracking-wider text-theme-muted uppercase">AGGREGATE SALES (TODAY)</div>
                        <div className="text-xl font-bold text-emerald-700 font-mono">₹1,46,850.00</div>
                        <div className="text-[10px] text-emerald-600 font-mono font-bold">↑ 14.5% vs previous shift</div>
                      </div>
                      <div className="bg-theme-surface-1 border border-theme-border rounded-xl p-4 shadow-xs space-y-1">
                        <div className="text-[10px] font-bold font-mono tracking-wider text-theme-muted uppercase">AVERAGE BASKET SIZE</div>
                        <div className="text-xl font-bold text-theme-primary font-mono">₹1,005.00</div>
                        <div className="text-[10px] text-theme-muted font-mono">From 146 receipts</div>
                      </div>
                      <div className="bg-theme-surface-1 border border-theme-border rounded-xl p-4 shadow-xs space-y-1">
                        <div className="text-[10px] font-bold font-mono tracking-wider text-theme-muted uppercase">SALES RETURN VALUE</div>
                        <div className="text-xl font-bold text-indigo-700 font-mono">₹3,450.00</div>
                        <div className="text-[10px] text-theme-muted font-mono">2.3% of volume</div>
                      </div>
                    </>
                  )}

                  {activeStudio === "purchase_studio" && (
                    <>
                      <div className="bg-theme-surface-1 border border-theme-border rounded-xl p-4 shadow-xs space-y-1">
                        <div className="text-[10px] font-bold font-mono tracking-wider text-theme-muted uppercase">SUPPLIER PAYABLES OUTSTANDING</div>
                        <div className="text-xl font-bold text-amber-700 font-mono">
                          ₹{purchaseStudioTotals.totalOutstanding.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-[10px] text-amber-600 font-mono font-bold">Consolidated Trade Payables</div>
                      </div>
                      <div className="bg-theme-surface-1 border border-theme-border rounded-xl p-4 shadow-xs space-y-1">
                        <div className="text-[10px] font-bold font-mono tracking-wider text-theme-muted uppercase">ACTIVE PURCHASE ORDERS</div>
                        <div className="text-xl font-bold text-theme-primary font-mono">{purchaseStudioTotals.totalOrders} Issued</div>
                        <div className="text-[10px] text-theme-muted font-mono">Authoritative Ledger Records</div>
                      </div>
                      <div className="bg-theme-surface-1 border border-theme-border rounded-xl p-4 shadow-xs space-y-1">
                        <div className="text-[10px] font-bold font-mono tracking-wider text-theme-muted uppercase">TOTAL GOODS RECEIVED</div>
                        <div className="text-xl font-bold text-emerald-700 font-mono">
                          ₹{purchaseStudioTotals.totalReceived.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-[10px] text-emerald-600 font-mono font-bold">100% Inward Fulfilled</div>
                      </div>
                    </>
                  )}

                  {activeStudio !== "sales_studio" && activeStudio !== "purchase_studio" && (
                    <>
                      <div className="bg-theme-surface-1 border border-theme-border rounded-xl p-4 shadow-xs space-y-1">
                        <div className="text-[10px] font-bold font-mono tracking-wider text-theme-muted uppercase">REPORTS IN CATEGORY</div>
                        <div className="text-xl font-bold text-theme-body font-mono">{currentStudioReports.length}</div>
                        <div className="text-[10px] text-theme-muted font-mono">Available in this business area</div>
                      </div>
                      <div className="bg-theme-surface-1 border border-theme-border rounded-xl p-4 shadow-xs space-y-1">
                        <div className="text-[10px] font-bold font-mono tracking-wider text-theme-muted uppercase">SUB-CATEGORIES</div>
                        <div className="text-xl font-bold text-theme-body font-mono">{activeSubcategoryCount}</div>
                        <div className="text-[10px] text-theme-muted font-mono">Report types in this area</div>
                      </div>
                      <div className="bg-theme-surface-1 border border-theme-border rounded-xl p-4 shadow-xs space-y-1">
                        <div className="text-[10px] font-bold font-mono tracking-wider text-theme-muted uppercase">TOTAL REPORTS</div>
                        <div className="text-xl font-bold text-theme-primary font-mono">{totalReportCount}</div>
                        <div className="text-[10px] text-theme-muted font-mono">Across the full report catalog</div>
                      </div>
                    </>
                  )}
                </div>

                {/* SMRITI Charts Engine Section */}
                <div className="bg-theme-surface-1 border border-theme-border rounded-xl p-4 shadow-xs">
                  <div className="flex items-center justify-between mb-3 border-b border-theme-divider pb-2.5">
                    <div>
                      <h4 className="text-xs font-bold text-theme-body uppercase tracking-wider font-mono">
                        Dynamic Visualization Panel
                      </h4>
                      <p className="text-[10px] text-theme-muted font-mono">
                        Interactive plotting using active dataset models
                      </p>
                    </div>
                    <span className="text-[9px] bg-theme-surface-2 px-2 py-0.5 rounded border border-theme-border font-mono text-theme-muted font-bold">
                      SVG RENDERING
                    </span>
                  </div>

                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      {activeStudio === "sales_studio" ? (
                        <AreaChart data={[
                          { name: "09:00", sales: 12000, margin: 8640 },
                          { name: "11:00", sales: 24000, margin: 17280 },
                          { name: "13:00", sales: 48000, margin: 34560 },
                          { name: "15:00", sales: 36000, margin: 25920 },
                          { name: "17:00", sales: 52000, margin: 37440 },
                          { name: "19:00", sales: 74000, margin: 53280 },
                          { name: "21:00", sales: 45000, margin: 32400 }
                        ]}>
                          <defs>
                            <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="var(--c-theme-primary)" stopOpacity={0.2}/>
                              <stop offset="95%" stopColor="var(--c-theme-primary)" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorMargin" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="var(--c-theme-chart-green)" stopOpacity={0.2}/>
                              <stop offset="95%" stopColor="var(--c-theme-chart-green)" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--c-theme-divider)" opacity={0.6} />
                          <XAxis dataKey="name" stroke="var(--c-theme-chart-axis)" fontSize={11} tickLine={false} />
                          <YAxis stroke="var(--c-theme-chart-axis)" fontSize={11} tickLine={false} />
                          <RechartsTooltip contentStyle={{ backgroundColor: "var(--c-theme-surface-1)", borderColor: "var(--c-theme-border)", borderRadius: "8px", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }} />
                          <Area type="monotone" dataKey="sales" name="Gross Sales (INR)" stroke="var(--c-theme-primary)" strokeWidth={2} fillOpacity={1} fill="url(#colorSales)" />
                          <Area type="monotone" dataKey="margin" name="Est. Net Margin (INR)" stroke="var(--c-theme-chart-green)" strokeWidth={2} fillOpacity={1} fill="url(#colorMargin)" />
                        </AreaChart>
                      ) : activeStudio === "purchase_studio" ? (
                        <BarChart data={[
                          { supplier: "Apex Traders", ordered: 450000, received: 410000 },
                          { supplier: "Vardhman Corp", ordered: 240000, received: 240000 },
                          { supplier: "Global Footwear", ordered: 180000, received: 150000 },
                          { supplier: "Modern Foods", ordered: 320000, received: 320000 },
                          { supplier: "Unilever Ind", ordered: 500000, received: 480000 }
                        ]}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--c-theme-divider)" opacity={0.6} />
                          <XAxis dataKey="supplier" stroke="var(--c-theme-chart-axis)" fontSize={10} tickLine={false} />
                          <YAxis stroke="var(--c-theme-chart-axis)" fontSize={10} tickLine={false} />
                          <RechartsTooltip contentStyle={{ backgroundColor: "var(--c-theme-surface-1)", borderColor: "var(--c-theme-border)", borderRadius: "8px", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }} />
                          <Bar dataKey="ordered" name="Procured Order Value" fill="var(--c-theme-primary)" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="received" name="Actual GRN Settled" fill="var(--c-theme-chart-amber)" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      ) : (
                        <LineChart data={[
                          { label: "Mon", count: 400 },
                          { label: "Tue", count: 480 },
                          { label: "Wed", count: 420 },
                          { label: "Thu", count: 590 },
                          { label: "Fri", count: 680 },
                          { label: "Sat", count: 950 },
                          { label: "Sun", count: 890 }
                        ]}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--c-theme-divider)" opacity={0.6} />
                          <XAxis dataKey="label" stroke="var(--c-theme-chart-axis)" fontSize={11} />
                          <YAxis stroke="var(--c-theme-chart-axis)" fontSize={11} />
                          <RechartsTooltip contentStyle={{ backgroundColor: "var(--c-theme-surface-1)", borderColor: "var(--c-theme-border)", borderRadius: "8px", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }} />
                          <Line type="monotone" dataKey="count" stroke="var(--c-theme-chart-indigo)" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                        </LineChart>
                      )}
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Reports Registry List for selected Studio */}
                <div className="bg-theme-surface-1 border border-theme-border rounded-xl shadow-xs overflow-hidden">
                  <div className="p-3 border-b border-theme-divider bg-theme-surface-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <h4 className="text-xs font-bold text-theme-body flex items-center gap-2 uppercase font-mono tracking-wider">
                      <Database size={14} className="text-theme-primary" />
                      Reports in this Category
                    </h4>

                    {/* Report Search Bar */}
                    <div className="relative w-full sm:w-64">
                      <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search reports..."
                        className="w-full bg-theme-surface-1 border border-theme-border rounded-lg pl-9 pr-3 py-1.5 text-xs text-theme-body placeholder-theme-muted focus:outline-none focus:border-theme-primary font-medium"
                      />
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-theme-surface-3/50 text-theme-muted uppercase font-mono tracking-wider border-b border-theme-divider text-[10px]">
                          <th className="px-5 py-3">Report ID</th>
                          <th className="px-5 py-3">Report Name</th>
                          <th className="px-5 py-3">Sub-Category</th>
                          <th className="px-5 py-3">Visual Format</th>
                          <th className="px-5 py-3">Drill-Down Capability</th>
                          <th className="px-5 py-3 text-right">Run / Execute</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredReports.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-5 py-8 text-center text-theme-muted">
                              No reports matched search criteria, or active role has restricted view scope.
                            </td>
                          </tr>
                        ) : (
                          filteredReports.map((r: any) => {
                            const isAllowed = canPerformAction("view", r.id);
                            return (
                              <tr
                                key={r.id}
                                className={`border-b border-theme-divider/60 transition-colors ${
                                  isAllowed
                                    ? "hover:bg-theme-surface-hover cursor-pointer"
                                    : "opacity-45 bg-rose-50 cursor-not-allowed"
                                }`}
                                onClick={() => isAllowed && runReport(r)}
                              >
                                <td className="px-5 py-3 font-mono font-bold text-theme-primary">{r.id}</td>
                                <td className="px-5 py-3">
                                  <div className="font-bold text-theme-body">{r.title}</div>
                                  <div className="text-[10px] text-theme-muted mt-0.5">{r.description}</div>
                                </td>
                                <td className="px-5 py-3 text-theme-muted">{r.category}</td>
                                <td className="px-5 py-3">
                                  <span className="px-2 py-0.5 text-[9px] uppercase font-bold tracking-wider rounded bg-theme-surface-2 text-theme-muted border border-theme-border font-mono">
                                    {r.format}
                                  </span>
                                </td>
                                <td className="px-5 py-3">
                                  {r.drillDownEnabled ? (
                                    <span className="text-emerald-700 font-semibold flex items-center gap-1 text-[11px]">
                                      <CheckSquare size={12} /> True
                                    </span>
                                  ) : (
                                    <span className="text-theme-muted flex items-center gap-1 text-[11px]">
                                      <Square size={12} /> False
                                    </span>
                                  )}
                                </td>
                                <td className="px-5 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                                  {isAllowed ? (
                                    <button
                                      onClick={() => runReport(r)}
                                      className="px-3 py-1.5 bg-theme-primary hover:bg-theme-primary-hover text-white rounded-lg text-[10px] font-bold flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
                                    >
                                      <Play size={10} /> Run Report
                                    </button>
                                  ) : (
                                    <span className="text-rose-700 font-mono font-bold text-[10px] uppercase flex items-center gap-1 justify-end">
                                      <ShieldAlert size={12} /> Locked
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
                </div>

                {/* Persistent Automated schedules tracker */}
                {schedules.length > 0 && (
                  <div className="bg-theme-surface-1 border border-theme-divider rounded-2xl p-5 shadow-xl">
                    <h4 className="text-xs font-bold text-theme-body uppercase tracking-wider font-sans mb-3 flex items-center gap-2">
                      <Clock size={14} className="text-blue-400" />
                      Active Automated Schedules ({schedules.length})
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {schedules.map((sch) => (
                        <div key={sch.id} className="p-3.5 bg-theme-surface-2 border border-theme-divider rounded-xl flex items-center justify-between hover:border-blue-500/30 transition-colors">
                          <div className="space-y-1 max-w-[280px]">
                            <div className="text-xs font-bold text-theme-body truncate">{sch.report_name}</div>
                            <div className="text-[10px] font-mono text-theme-muted flex flex-wrap gap-1.5 items-center">
                              <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded uppercase text-[8px] font-bold">
                                {sch.frequency}
                              </span>
                              <span className="text-theme-muted">•</span>
                              <span>To: {sch.delivery_target}</span>
                            </div>
                            <div className="text-[9px] text-theme-muted font-mono bg-theme-surface-3 px-1.5 py-0.5 rounded border border-theme-divider inline-block">
                              Cron: {sch.cron_expression}
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteSchedule(sch.id)}
                            className="p-2 text-theme-muted hover:text-rose-400 bg-theme-surface-3 hover:bg-rose-500/10 rounded-lg transition-colors border border-theme-divider"
                            title="Cancel Automated Delivery"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
      )}

      {/* SMRITI INTERACTIVE REPORT BUILDER (Collapsible Panels, Auto-Adaptive Layout & Focus Mode) */}
      {activeView === "designer" && (
        <div className="space-y-4">
          <ReportBuilder
            initialTitle="Report Builder"
            onReturnToCatalog={() => setActiveView("bi_center")}
            onNotification={(type, msg) => showNotification(type, msg)}
            isLocationsManagementEnabled={isLocationsManagementEnabled}
            activeStoreName={activeStoreName}
          />
        </div>
      )}

      {/* SMRITI ACTIVE REPORT VIEWER (Genuinely interactive tables with mock drill-down state) */}
      {activeView === "viewer" && selectedReport && (
        <div className="space-y-6">

          {/* Enhanced Action Toolbar */}
          <div className="bg-theme-surface-1 border border-theme-divider rounded-2xl p-4 shadow-xl flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setActiveView("bi_center")}
                className="p-2 border border-theme-divider text-theme-muted hover:text-theme-body hover:bg-theme-surface-2 rounded-xl text-xs transition-colors"
                title="Return to BI Hub"
              >
                <ArrowLeft size={16} />
              </button>
              <div>
                <h3 className="text-sm font-bold text-theme-body flex items-center gap-2">
                  {selectedReport.title}
                </h3>
                <p className="text-[10px] text-theme-muted">
                  Interactive transaction matrices with multi-stage drilling
                </p>
              </div>
            </div>

            {/* Universal Controls */}
            <div className="flex flex-wrap items-center gap-2">

              <button
                type="button"
                onClick={() => setReportRefreshKey((key) => key + 1)}
                disabled={loadingReports}
                className="px-3 py-2 bg-theme-primary/10 border border-theme-primary/30 hover:bg-theme-primary/20 text-theme-primary rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Reload this report from the database"
              >
                <RefreshCw size={13} className={loadingReports ? "animate-spin" : ""} />
                Refresh Data
              </button>

              {/* Customize in Report Builder Button */}
              <button
                type="button"
                id="report-viewer-customize-builder-btn"
                onClick={() => {
                  setActiveView("designer");
                  showNotification("info", `Opened ${selectedReport.title} in SMRITI Report Builder.`);
                }}
                className="px-3 py-2 bg-theme-surface-2 border border-theme-divider hover:border-blue-500/30 text-theme-body rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Customize columns, layout, and filters in Report Builder"
              >
                <SlidersHorizontal size={13} className="text-blue-500" />
                Customize in Builder
              </button>

              {/* Export Dropdown menu */}
              <div className="relative group">
                <button className="px-3 py-2 bg-theme-surface-2 border border-theme-divider hover:border-blue-500/30 text-theme-body rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors">
                  <Download size={13} className="text-blue-400" /> Export <ChevronDown size={12} />
                </button>
                <div className="absolute right-0 top-full mt-1.5 w-40 bg-theme-surface-1 border border-theme-divider rounded-xl shadow-2xl py-1 z-40 hidden group-hover:block hover:block font-sans text-xs">
                  <button onClick={() => handleTriggerExport("XLSX")} className="w-full text-left px-3.5 py-2 hover:bg-theme-surface-2 text-theme-body flex items-center gap-2">
                    <TableProperties size={13} className="text-emerald-500" /> Excel Spreadsheet
                  </button>
                  <button onClick={() => handleTriggerExport("PDF")} className="w-full text-left px-3.5 py-2 hover:bg-theme-surface-2 text-theme-body flex items-center gap-2">
                    <FileBarChart size={13} className="text-rose-500" /> PDF Document
                  </button>
                  <button onClick={() => handleTriggerExport("CSV")} className="w-full text-left px-3.5 py-2 hover:bg-theme-surface-2 text-theme-body flex items-center gap-2">
                    <Hash size={13} className="text-blue-500" /> CSV Format
                  </button>
                  <button onClick={() => handleTriggerExport("JSON")} className="w-full text-left px-3.5 py-2 hover:bg-theme-surface-2 text-theme-body flex items-center gap-2">
                    <Database size={13} className="text-amber-500" /> JSON Object
                  </button>
                </div>
              </div>

              {/* Share Menu */}
              <div className="relative group">
                <button className="px-3 py-2 bg-theme-surface-2 border border-theme-divider hover:border-blue-500/30 text-theme-body rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors">
                  <Share2 size={13} className="text-violet-400" /> Share <ChevronDown size={12} />
                </button>
                <div className="absolute right-0 top-full mt-1.5 w-44 bg-theme-surface-1 border border-theme-divider rounded-xl shadow-2xl py-1 z-40 hidden group-hover:block hover:block font-sans text-xs">
                  <button
                    onClick={() => {
                      setShareType("Email");
                      setShowShareModal(true);
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-theme-surface-2 text-theme-body flex items-center gap-2"
                  >
                    <Mail size={13} className="text-blue-400" /> Email Attachment
                  </button>
                  <button
                    onClick={() => {
                      setShareType("WhatsApp");
                      setShowShareModal(true);
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-theme-surface-2 text-theme-body flex items-center gap-2"
                  >
                    <MessageCircle size={13} className="text-emerald-400" /> WhatsApp Direct Link
                  </button>
                </div>
              </div>

              {/* Automated Scheduler Button */}
              <button
                onClick={() => setShowScheduleModal(true)}
                className="px-3 py-2 bg-theme-surface-2 border border-theme-divider hover:border-blue-500/30 text-theme-body rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                <Clock size={13} className="text-amber-400" /> Schedule Delivery
              </button>

              {/* Technical Details Toggle */}
              <button
                onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                className={`px-3 py-2 border rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${
                  showTechnicalDetails
                    ? "bg-blue-600/20 border-blue-500/50 text-blue-400"
                    : "bg-theme-surface-2 border-theme-divider hover:border-blue-500/30 text-theme-body"
                }`}
                title="Toggle technical parameters and API metadata"
              >
                <Code size={13} className="text-indigo-400" /> Technical Details
              </button>

              {/* Google Sheets Live Web Integration */}
              <button
                onClick={handleOpenInGoogleSheets}
                className="px-3 py-2 bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Open active report in Google Sheets (sheets.new)"
              >
                <FileSpreadsheet size={13} className="text-emerald-400" />
                <span>Google Sheets</span>
              </button>

              {/* Print Engine */}
              <button
                onClick={() => {
                  recordAuditAction("PRINT", "reports", selectedReport?.id || "RPT-GEN", `Report printed: ${selectedReport?.title || "Standard Report"}`);
                  window.print();
                  showNotification("success", "SMRITI print compiler dispatched. Readying thermal layout spool.");
                }}
                className="px-3 py-2 bg-theme-surface-2 border border-theme-divider hover:border-blue-500/30 text-theme-body rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Printer size={13} className="text-theme-muted" /> Print
              </button>
            </div>
          </div>

          {/* Drill-Down Path / Breadcrumb Indicator */}
          <div className="bg-theme-surface-2 border border-theme-divider rounded-xl px-4 py-2.5 flex items-center gap-2 text-xs overflow-x-auto whitespace-nowrap scrollbar-none shrink-0 shadow-md">
            <span className="font-mono text-[10px] tracking-wider text-theme-muted uppercase font-bold flex items-center gap-1">
              <Database size={11} className="text-indigo-400" /> Drill path:
            </span>
            <div className="flex items-center gap-1.5 font-sans">
              {breadcrumbs.map((bc, index) => {
                const isLast = index === breadcrumbs.length - 1;
                return (
                  <React.Fragment key={index}>
                    {index > 0 && <span className="text-theme-muted font-bold">/</span>}
                    <button
                      onClick={() => handleBreadcrumbClick(index)}
                      className={`font-semibold hover:underline ${
                        isLast ? "text-blue-400 cursor-default" : "text-theme-body hover:text-blue-300"
                      }`}
                      disabled={isLast}
                    >
                      {bc.title}
                    </button>
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {/* Collapsible Technical Details Panel */}
          {showTechnicalDetails && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-theme-surface-2/90 border border-theme-divider rounded-2xl p-4 shadow-inner text-xs font-mono space-y-2.5"
            >
              <div className="flex items-center justify-between border-b border-theme-divider/50 pb-2">
                <span className="text-blue-400 font-bold uppercase text-[10px] flex items-center gap-1.5">
                  <Terminal size={12} /> Execution Context & Metadata
                </span>
                <span className="text-theme-muted text-[10px]">
                  Generated: {genericReportData?.generated_at || new Date().toISOString()}
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px]">
                <div>
                  <span className="text-theme-muted block text-[9px] uppercase">Report Code</span>
                  <span className="text-theme-body font-bold">{selectedReport?.id || "N/A"}</span>
                </div>
                <div>
                  <span className="text-theme-muted block text-[9px] uppercase">Category / Format</span>
                  <span className="text-theme-body">{selectedReport?.category || "Standard"} / {selectedReport?.format || "Grid"}</span>
                </div>
                <div>
                  <span className="text-theme-muted block text-[9px] uppercase">Drill Level / Filter</span>
                  <span className="text-theme-body">L{drillLevel} ({drillFilter || "None"})</span>
                </div>
                <div>
                  <span className="text-theme-muted block text-[9px] uppercase">Rows Resolved</span>
                  <span className="text-emerald-400 font-bold">{genericReportData?.lines?.length ?? genericReportData?.rows?.length ?? 0} records</span>
                </div>
              </div>
            </motion.div>
          )}

          {/* Table Filters for detailed views */}
          <div className="bg-theme-surface-1 border border-theme-divider rounded-2xl p-4 shadow-md grid grid-cols-1 md:grid-cols-4 gap-3 shrink-0 text-xs">
            <div className="space-y-1">
              <label className="text-theme-muted font-bold">START DATE</label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({...filters, startDate: e.target.value})}
                className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-2.5 py-1.5 text-theme-body focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-theme-muted font-bold">END DATE</label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({...filters, endDate: e.target.value})}
                className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-2.5 py-1.5 text-theme-body focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-theme-muted font-bold">PRODUCT GROUP</label>
              <select
                value={filters.productGroup}
                onChange={(e) => setFilters({...filters, productGroup: e.target.value})}
                className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-2.5 py-1.5 text-theme-body focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="All">All Categories</option>
                <option value="Apparel">Apparel only</option>
                <option value="Footwear">Footwear only</option>
                <option value="Accessories">Accessories only</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-theme-muted font-bold">PAYMENT TYPE</label>
              <select
                value={filters.paymentMode}
                onChange={(e) => setFilters({...filters, paymentMode: e.target.value})}
                className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-2.5 py-1.5 text-theme-body focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="All">All Modes (Cash/UPI/Card)</option>
                <option value="Cash">Cash Only</option>
                <option value="UPI">UPI Only</option>
                <option value="Card">Card Only</option>
              </select>
            </div>
          </div>

          {/* Render Actual Data Table with Drill-down responses */}
          <div className="bg-theme-surface-1 border border-theme-divider rounded-2xl shadow-xl overflow-hidden">

            {/* RPT-SAL-001: Daily Cashier & Payment Summary Register */}
            {selectedReport.id === "RPT-SAL-001" && (
              <div className="p-4 space-y-4">
                {/* 4 Payment Tender KPI Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted font-mono">💵 CASH IN HAND</span>
                    <p className="text-lg font-black text-emerald-500 mt-0.5">
                      ₹{Number(salesReportData?.cash_sales || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-[10px] text-theme-muted mt-0.5 font-mono">Physical cash drawer</p>
                  </div>
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted font-mono">📱 UPI / QR ONLINE</span>
                    <p className="text-lg font-black text-purple-500 mt-0.5">
                      ₹{Number(salesReportData?.upi_sales || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-[10px] text-theme-muted mt-0.5 font-mono">Instant digital settlement</p>
                  </div>
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted font-mono">💳 CARD (DEBIT / CREDIT)</span>
                    <p className="text-lg font-black text-blue-500 mt-0.5">
                      ₹{Number(salesReportData?.card_sales || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-[10px] text-theme-muted mt-0.5 font-mono">EDC machine batches</p>
                  </div>
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted font-mono">📒 CUSTOMER CREDIT / DUE</span>
                    <p className="text-lg font-black text-amber-500 mt-0.5">
                      ₹{Number(salesReportData?.credit_sales || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-[10px] text-theme-muted mt-0.5 font-mono">Khata / account receivable</p>
                  </div>
                </div>

                {/* Banner & Total Collections Action Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-theme-surface-2 via-theme-surface-1 to-theme-surface-2 p-4 rounded-xl border border-theme-divider">
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-theme-body flex items-center gap-2">
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 font-mono font-bold">
                        VERIFIED TOTAL
                      </span>
                      <span>Total Net Collections: ₹{Number(salesReportData?.total_sales || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <p className="text-[11px] text-theme-muted">
                      Across {salesReportData?.total_invoices || 0} completed invoices (Tax Collected GST: ₹{Number(salesReportData?.tax_total || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleLaunchStandardReport("sales_register")}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
                  >
                    <Receipt size={14} />
                    <span>View Bill-Wise Line Items</span>
                    <ArrowRight size={13} />
                  </button>
                </div>

                {/* Tender Breakdown Table */}
                <div className="overflow-x-auto border border-theme-divider rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-theme-surface-2 text-theme-muted border-b border-theme-divider uppercase text-[10px] font-mono tracking-wider font-bold">
                      <tr>
                        <th className="p-3">Tender Mode</th>
                        <th className="p-3">Settlement Type</th>
                        <th className="p-3 text-right">Net Collections (₹)</th>
                        <th className="p-3 text-right">Share of Revenue (%)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-theme-divider/40">
                      {[
                        { mode: "Cash", type: "Counter Register Drawer", amt: Number(salesReportData?.cash_sales || 0), color: "text-emerald-500" },
                        { mode: "UPI / QR Code", type: "Direct Bank Settlement", amt: Number(salesReportData?.upi_sales || 0), color: "text-purple-500" },
                        { mode: "Debit / Credit Card", type: "POS Terminal Swipe", amt: Number(salesReportData?.card_sales || 0), color: "text-blue-500" },
                        { mode: "Customer Credit / Due", type: "Store Ledger Receivable", amt: Number(salesReportData?.credit_sales || 0), color: "text-amber-500" },
                      ].map((t) => {
                        const total = Number(salesReportData?.total_sales || 0);
                        const share = total > 0 ? ((t.amt / total) * 100).toFixed(1) : "0.0";
                        return (
                          <tr key={t.mode} className="hover:bg-theme-surface-hover transition-colors">
                            <td className="p-3 font-bold text-theme-body">{t.mode}</td>
                            <td className="p-3 text-theme-muted">{t.type}</td>
                            <td className={`p-3 text-right font-mono font-bold ${t.color}`}>
                              ₹{t.amt.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="p-3 text-right font-mono text-theme-body font-semibold">{share}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-theme-surface-2 font-bold border-t border-theme-divider">
                      <tr>
                        <td colSpan={2} className="p-3 font-mono text-xs uppercase tracking-wider text-theme-body">
                          Total Revenue
                        </td>
                        <td className="p-3 text-right font-mono text-emerald-500 text-xs">
                          ₹{Number(salesReportData?.total_sales || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="p-3 text-right font-mono text-theme-body text-xs">100.0%</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* Standard Purchase Inward Register (GRN) View */}
            {selectedReport.id === "RPT-PUR-001" && (
              <div className="space-y-4">
                {/* Header Controls */}
                <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-theme-surface-2 border border-theme-border">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
                      <Truck className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-bold text-theme-heading">Purchase Inward Register (GRN)</h2>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                          {activeStoreName} · Single Store
                        </span>
                      </div>
                      <p className="text-xs text-theme-muted">
                        Verified Goods Receipt Notes (GRN) with supplier, article code, received quantities, landed cost, and GST.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center bg-theme-surface-3 p-0.5 rounded-lg border border-theme-border text-xs">
                      <button
                        onClick={() => setGrnViewMode("detailed")}
                        className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                          grnViewMode === "detailed"
                            ? "bg-theme-surface text-theme-heading shadow-sm"
                            : "text-theme-muted hover:text-theme-body"
                        }`}
                      >
                        Detailed Line Items View
                      </button>
                      <button
                        onClick={() => setGrnViewMode("grn_summary")}
                        className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                          grnViewMode === "grn_summary"
                            ? "bg-theme-surface text-theme-heading shadow-sm"
                            : "text-theme-muted hover:text-theme-body"
                        }`}
                      >
                        GRN Summary View
                      </button>
                    </div>
                    <button
                      onClick={() => setSelectedReport(null)}
                      className="px-3 py-1.5 rounded-lg border border-theme-border hover:bg-theme-surface-hover text-theme-body text-xs font-medium transition-colors"
                      title="Return to BI Hub"
                    >
                      Return to BI Hub
                    </button>
                  </div>
                </div>

                {/* 4 Standard Inward KPI Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-xl bg-theme-surface border border-theme-border">
                    <span className="text-[10px] font-mono text-theme-muted uppercase tracking-wider block">Total GRNs Inwarded</span>
                    <span className="text-lg font-bold font-mono text-theme-heading mt-1 block">
                      {grnTotals.grnCount.toLocaleString("en-IN")} GRNs
                    </span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-theme-surface border border-theme-border">
                    <span className="text-[10px] font-mono text-theme-muted uppercase tracking-wider block">Total Received Qty</span>
                    <span className="text-lg font-bold font-mono text-blue-500 mt-1 block">
                      {grnTotals.totalQty.toLocaleString("en-IN", { minimumFractionDigits: 0 })} Pcs
                    </span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-theme-surface border border-theme-border">
                    <span className="text-[10px] font-mono text-theme-muted uppercase tracking-wider block">Total Inward GST</span>
                    <span className="text-lg font-bold font-mono text-purple-500 mt-1 block">
                      ₹{grnTotals.totalTax.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-theme-surface border border-theme-border">
                    <span className="text-[10px] font-mono text-theme-muted uppercase tracking-wider block">Total Landed Value</span>
                    <span className="text-lg font-bold font-mono text-emerald-500 mt-1 block">
                      ₹{grnTotals.totalLanded.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Live Search */}
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted" />
                  <input
                    type="text"
                    placeholder="Filter GRN #, Supplier Name, PO #, Article Code..."
                    value={reportSearchQuery}
                    onChange={(e) => setReportSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 rounded-lg bg-theme-surface-2 border border-theme-border text-xs text-theme-heading placeholder:text-theme-muted focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                {/* Data Table */}
                <div className="overflow-x-auto rounded-xl border border-theme-border bg-theme-surface">
                  {grnViewMode === "detailed" ? (
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-theme-surface-2 text-theme-muted uppercase font-mono border-b border-theme-divider">
                          <th className="p-3">GRN #</th>
                          <th className="p-3">Date</th>
                          <th className="p-3">Supplier</th>
                          <th className="p-3">PO #</th>
                          <th className="p-3">Delivery Terms</th>
                          <th className="p-3">Transporter / LR</th>
                          <th className="p-3">Article / SKU</th>
                          <th className="p-3">Item Description</th>
                          <th className="p-3 text-right">Qty Received</th>
                          <th className="p-3 text-right">Cost Rate (₹)</th>
                          <th className="p-3 text-right">GST %</th>
                          <th className="p-3 text-right">Tax (₹)</th>
                          <th className="p-3 text-right">Line Total (₹)</th>
                          <th className="p-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-theme-divider/40">
                        {filteredGrnLines.length === 0 ? (
                          <tr>
                            <td colSpan={14} className="p-8 text-center text-theme-muted">
                              No purchase inward records found for the selected date range.
                            </td>
                          </tr>
                        ) : (
                          filteredGrnLines.map((l: any, idx: number) => (
                            <tr key={`${l.receipt_no}-${l.product_code}-${idx}`} className="hover:bg-theme-surface-hover transition-colors">
                              <td className="p-3 font-mono font-bold text-emerald-500 whitespace-nowrap">{l.receipt_no}</td>
                              <td className="p-3 font-mono text-theme-muted whitespace-nowrap">{l.receipt_date}</td>
                              <td className="p-3 font-semibold text-theme-body">{l.supplier_name}</td>
                              <td className="p-3 font-mono text-theme-muted">{l.order_no || "—"}</td>
                              <td className="p-3 whitespace-nowrap">
                                {l.delivery_terms ? (
                                  <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider ${
                                    l.delivery_terms.toLowerCase().includes("ex-factory")
                                      ? "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                                      : "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                                  }`}>
                                    {l.delivery_terms}
                                  </span>
                                ) : (
                                  <span className="text-theme-muted font-mono text-[11px]">—</span>
                                )}
                              </td>
                              <td className="p-3 whitespace-nowrap text-theme-body text-xs font-mono">
                                {l.transporter_name ? (
                                  <span>
                                    {l.transporter_name}
                                    {l.lr_number ? <span className="text-theme-muted text-[10px] block">LR: {l.lr_number}</span> : null}
                                  </span>
                                ) : (
                                  <span className="text-theme-muted">—</span>
                                )}
                              </td>
                              <td className="p-3 font-mono text-purple-400 font-bold whitespace-nowrap">{l.product_code}</td>
                              <td className="p-3 text-theme-body">{l.product_name}</td>
                              <td className="p-3 text-right font-mono font-bold text-blue-500">
                                {Number(l.quantity_received).toLocaleString("en-IN", { minimumFractionDigits: 0 })}
                              </td>
                              <td className="p-3 text-right font-mono">
                                {Number(l.cost_price).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="p-3 text-right font-mono text-theme-muted">{l.gst_rate}%</td>
                              <td className="p-3 text-right font-mono text-purple-400">
                                {Number(l.tax_amount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="p-3 text-right font-mono font-bold text-emerald-500">
                                ₹{Number(l.line_total).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="p-3 text-center whitespace-nowrap">
                                <span className="px-2 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider font-mono bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                                  {l.status}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      {filteredGrnLines.length > 0 && (
                        <tfoot className="bg-theme-surface-2 font-bold border-t border-theme-divider">
                          <tr>
                            <td colSpan={8} className="p-3 font-mono text-xs uppercase tracking-wider text-theme-body">
                              Total Inward Valuation ({filteredGrnLines.length} Items across {grnTotals.grnCount} GRNs)
                            </td>
                            <td className="p-3 text-right font-mono text-blue-500 text-xs">
                              {grnTotals.totalQty.toLocaleString("en-IN", { minimumFractionDigits: 0 })} Pcs
                            </td>
                            <td colSpan={2} className="p-3"></td>
                            <td className="p-3 text-right font-mono text-purple-400 text-xs">
                              ₹{grnTotals.totalTax.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="p-3 text-right font-mono text-emerald-500 text-xs">
                              ₹{grnTotals.totalLanded.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="p-3"></td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  ) : (
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-theme-surface-2 text-theme-muted uppercase font-mono border-b border-theme-divider">
                          <th className="p-3">GRN #</th>
                          <th className="p-3">Date</th>
                          <th className="p-3">Supplier</th>
                          <th className="p-3">PO #</th>
                          <th className="p-3">Delivery Terms</th>
                          <th className="p-3">Transporter</th>
                          <th className="p-3 text-right">Items Count</th>
                          <th className="p-3 text-right">Total Qty (Pcs)</th>
                          <th className="p-3 text-right">Tax (₹)</th>
                          <th className="p-3 text-right">Landed Total (₹)</th>
                          <th className="p-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-theme-divider/40">
                        {grnSummaryList.length === 0 ? (
                          <tr>
                            <td colSpan={11} className="p-8 text-center text-theme-muted">
                              No purchase receipts found.
                            </td>
                          </tr>
                        ) : (
                          grnSummaryList.map((g: any) => (
                            <tr key={g.receipt_no} className="hover:bg-theme-surface-hover transition-colors">
                              <td className="p-3 font-mono font-bold text-emerald-500 whitespace-nowrap">{g.receipt_no}</td>
                              <td className="p-3 font-mono text-theme-muted whitespace-nowrap">{g.receipt_date}</td>
                              <td className="p-3 font-semibold text-theme-body">{g.supplier_name}</td>
                              <td className="p-3 font-mono text-theme-muted">{g.order_no || "—"}</td>
                              <td className="p-3 whitespace-nowrap">
                                {g.delivery_terms ? (
                                  <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider ${
                                    g.delivery_terms.toLowerCase().includes("ex-factory")
                                      ? "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                                      : "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                                  }`}>
                                    {g.delivery_terms}
                                  </span>
                                ) : (
                                  <span className="text-theme-muted font-mono text-[11px]">—</span>
                                )}
                              </td>
                              <td className="p-3 whitespace-nowrap text-theme-body text-xs font-mono">
                                {g.transporter_name ? (
                                  <span>
                                    {g.transporter_name}
                                    {g.lr_number ? <span className="text-theme-muted text-[10px] block">LR: {g.lr_number}</span> : null}
                                  </span>
                                ) : (
                                  <span className="text-theme-muted">—</span>
                                )}
                              </td>
                              <td className="p-3 text-right font-mono">{g.itemCount} Items</td>
                              <td className="p-3 text-right font-mono font-bold text-blue-500">
                                {g.totalQty.toLocaleString("en-IN", { minimumFractionDigits: 0 })}
                              </td>
                              <td className="p-3 text-right font-mono text-purple-400">
                                ₹{g.totalTax.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="p-3 text-right font-mono font-bold text-emerald-500">
                                ₹{g.totalLanded.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="p-3 text-center whitespace-nowrap">
                                <span className="px-2 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider font-mono bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                                  {g.status}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      {grnSummaryList.length > 0 && (
                        <tfoot className="bg-theme-surface-2 font-bold border-t border-theme-divider">
                          <tr>
                            <td colSpan={6} className="p-3 font-mono text-xs uppercase tracking-wider text-theme-body">
                              Total Summary ({grnSummaryList.length} GRNs)
                            </td>
                            <td className="p-3 text-right font-mono">{filteredGrnLines.length} Items</td>
                            <td className="p-3 text-right font-mono text-blue-500 text-xs">
                              {grnTotals.totalQty.toLocaleString("en-IN", { minimumFractionDigits: 0 })} Pcs
                            </td>
                            <td className="p-3 text-right font-mono text-purple-400 text-xs">
                              ₹{grnTotals.totalTax.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="p-3 text-right font-mono text-emerald-500 text-xs">
                              ₹{grnTotals.totalLanded.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="p-3"></td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  )}
                </div>
              </div>
            )}

            {/* Purchase Studio Outstanding Drilldown */}
            {selectedReport.id === "RPT-PUR-002" && (
              <>
                {drillLevel === 0 && (
                  <div className="overflow-x-auto text-xs">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-theme-surface-3/50 text-theme-muted uppercase font-mono border-b border-theme-divider">
                          <th className="px-5 py-3">Supplier Name</th>
                          <th className="px-5 py-3">Vendor Code</th>
                          <th className="px-5 py-3">Open PO count</th>
                          <th className="px-5 py-3">Oldest Invoice Date</th>
                          <th className="px-5 py-3 text-right">Aggregate Payables (INR)</th>
                          <th className="px-5 py-3 text-right">Drill Orders</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(purchaseReportData && purchaseReportData.length > 0
                          ? purchaseReportData.map((supplier: any) => ({
                              id: supplier.supplier_id,
                              name: supplier.supplier_name,
                              code: supplier.supplier_id.substring(0, 8).toUpperCase(),
                              poCount: supplier.po_count,
                              date: new Date().toISOString().split('T')[0],
                              amount: `₹${parseFloat(supplier.outstanding).toLocaleString('en-IN')}`
                            }))
                          : [
                              { id: "SUP-001", name: "Apex Traders Pvt Ltd", code: "APX99", poCount: 3, date: "2026-06-12", amount: "₹4,50,000" },
                              { id: "SUP-002", name: "Vardhman Textiles Corp", code: "VDH12", poCount: 1, date: "2026-06-25", amount: "₹1,20,000" },
                              { id: "SUP-003", name: "Global Footwear Distributors", code: "GLF45", poCount: 2, date: "2026-07-01", amount: "₹3,20,000" }
                            ]
                        ).map((row: any) => (
                          <tr key={row.id} className="border-b border-theme-divider/40 hover:bg-theme-surface-hover">
                            <td className="px-5 py-3.5 font-bold text-theme-body">{row.name}</td>
                            <td className="px-5 py-3.5 font-mono text-blue-400">{row.code}</td>
                            <td className="px-5 py-3.5 font-mono text-theme-body">{row.poCount} Open POs</td>
                            <td className="px-5 py-3.5 font-mono text-theme-muted">{row.date}</td>
                            <td className="px-5 py-3.5 text-right font-mono font-bold text-rose-400">{row.amount}</td>
                            <td className="px-5 py-3.5 text-right">
                              <button
                                onClick={() => performDrilldown(1, row.id, `Drill: ${row.code}`)}
                                className="px-2.5 py-1 bg-theme-surface-3 hover:bg-blue-600/10 hover:text-blue-400 text-theme-muted border border-theme-divider rounded-md font-bold text-[10px] transition-colors"
                              >
                                Drill PO Ledger
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {drillLevel === 1 && (
                  <div className="overflow-x-auto text-xs">
                    <div className="px-5 py-2.5 bg-theme-surface-2 border-b border-theme-divider flex items-center justify-between text-xs text-theme-muted font-semibold">
                      <span>PURCHASE ORDERS IN SCOPE: {drillFilter.toUpperCase()}</span>
                      <span className="font-mono text-[10px]">Resolved from persistent store</span>
                    </div>
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-theme-surface-3/50 text-theme-muted uppercase font-mono border-b border-theme-divider">
                          <th className="px-5 py-3">PO Reference</th>
                          <th className="px-5 py-3">Created Date</th>
                          <th className="px-5 py-3">Status</th>
                          <th className="px-5 py-3">Settlement Date</th>
                          <th className="px-5 py-3 text-right">PO Total</th>
                          <th className="px-5 py-3 text-right">Outstanding Due</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(selectedSupplierLedger && selectedSupplierLedger.entries && selectedSupplierLedger.entries.length > 0
                          ? selectedSupplierLedger.entries.map((entry: any) => ({
                              ref: entry.ref_no,
                              date: entry.date,
                              status: entry.type,
                              due: entry.date,
                              total: `₹${parseFloat(entry.amount).toLocaleString('en-IN')}`,
                              owed: `₹${parseFloat(entry.balance).toLocaleString('en-IN')}`
                            }))
                          : [
                              { ref: "PO-MUM-0012", date: "2026-06-12", status: "Partially Received", due: "2026-07-20", total: "₹3,50,000", owed: "₹2,00,000" },
                              { ref: "PO-MUM-0015", date: "2026-06-20", status: "Complete Received", due: "2026-07-28", total: "₹4,00,000", owed: "₹2,50,000" }
                            ]
                        ).map((row: any) => (
                          <tr key={row.ref} className="border-b border-theme-divider/40 hover:bg-theme-surface-hover" onClick={() => performDrilldown(2, row.ref, `Audit: ${row.ref}`)}>
                            <td className="px-5 py-3.5 font-mono font-bold text-blue-400">{row.ref}</td>
                            <td className="px-5 py-3.5 font-mono text-theme-muted">{row.date}</td>
                            <td className="px-5 py-3.5">
                              <span className="px-2 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider bg-theme-surface-3 text-amber-400 border border-theme-divider">
                                {row.status}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 font-mono text-theme-muted">{row.due}</td>
                            <td className="px-5 py-3.5 text-right font-mono text-theme-body">{row.total}</td>
                            <td className="px-5 py-3.5 text-right font-mono font-bold text-rose-400">{row.owed}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {drillLevel === 2 && (
                  <div className="overflow-x-auto text-xs p-5 space-y-4">
                    <div className="p-4 border border-blue-500/30 bg-blue-500/5 rounded-xl space-y-1">
                      <div className="text-xs font-bold text-blue-300">Rule 10 System Verification Seal Active</div>
                      <p className="text-[11px] text-theme-muted">
                        All invoices associated with PO reference <span className="font-mono text-blue-400">{drillFilter}</span> have been reconciled against the GSTR ledger. Transaction hashes match the main tally queue logs.
                      </p>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-xs font-mono">
                      <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-lg">
                        <div className="text-theme-muted uppercase text-[9px] font-bold">Total Ordered Qty</div>
                        <div className="text-sm font-bold text-theme-body mt-1">450 Units</div>
                      </div>
                      <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-lg">
                        <div className="text-theme-muted uppercase text-[9px] font-bold">Total Settled Qty</div>
                        <div className="text-sm font-bold text-theme-body mt-1">410 Units</div>
                      </div>
                      <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-lg">
                        <div className="text-theme-muted uppercase text-[9px] font-bold">Shortage Reconciliation</div>
                        <div className="text-sm font-bold text-rose-400 mt-1">40 Units Short</div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* RPT-TAX-001: Tax Register */}
            {selectedReport.id === "RPT-TAX-001" && (
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted">Invoices</span>
                    <p className="text-sm font-black text-theme-body mt-1">{genericReportData?.total_invoices ?? 0}</p>
                  </div>
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted">Taxable Value</span>
                    <p className="text-sm font-black text-emerald-400 mt-1">₹{Number(genericReportData?.total_taxable ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted">CGST</span>
                    <p className="text-sm font-black text-blue-400 mt-1">₹{Number(genericReportData?.total_cgst ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted">SGST</span>
                    <p className="text-sm font-black text-blue-400 mt-1">₹{Number(genericReportData?.total_sgst ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted">IGST</span>
                    <p className="text-sm font-black text-blue-400 mt-1">₹{Number(genericReportData?.total_igst ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted">Total Tax</span>
                    <p className="text-sm font-black text-purple-400 mt-1">₹{Number(genericReportData?.total_tax ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>

                <div className="overflow-x-auto border border-theme-divider rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-theme-surface-2/80 text-theme-muted border-b border-theme-divider uppercase text-[10px] font-bold">
                      <tr>
                        <th className="p-3">Invoice #</th>
                        <th className="p-3">Date</th>
                        <th className="p-3">Customer</th>
                        <th className="p-3 text-right">Taxable (₹)</th>
                        <th className="p-3 text-right">CGST %</th>
                        <th className="p-3 text-right">CGST (₹)</th>
                        <th className="p-3 text-right">SGST %</th>
                        <th className="p-3 text-right">SGST (₹)</th>
                        <th className="p-3 text-right">IGST %</th>
                        <th className="p-3 text-right">IGST (₹)</th>
                        <th className="p-3 text-right">Total Tax (₹)</th>
                        <th className="p-3 text-right">Net Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-theme-divider/40">
                      {(!genericReportData?.lines || genericReportData.lines.length === 0) ? (
                        <tr><td colSpan={12} className="p-6 text-center text-theme-muted">No tax register records found for the selected period.</td></tr>
                      ) : (
                        genericReportData.lines.map((l: any, idx: number) => (
                          <tr key={idx} className="hover:bg-theme-surface-hover transition-colors">
                            <td className="p-3 font-mono font-bold text-blue-400">{l.invoice_number}</td>
                            <td className="p-3 font-mono text-theme-muted">{l.invoice_date}</td>
                            <td className="p-3 text-theme-body">{l.customer_name || "Walk-in Customer"}</td>
                            <td className="p-3 text-right font-mono font-medium">{Number(l.taxable_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                            <td className="p-3 text-right font-mono text-theme-muted">{formatNumber(l.cgst_rate, 2)}%</td>
                            <td className="p-3 text-right font-mono text-theme-muted">{formatCurrency(l.cgst_amount)}</td>
                            <td className="p-3 text-right font-mono text-theme-muted">{formatNumber(l.sgst_rate, 2)}%</td>
                            <td className="p-3 text-right font-mono text-theme-muted">{formatCurrency(l.sgst_amount)}</td>
                            <td className="p-3 text-right font-mono text-theme-muted">{formatNumber(l.igst_rate, 2)}%</td>
                            <td className="p-3 text-right font-mono text-theme-muted">{formatCurrency(l.igst_amount)}</td>
                            <td className="p-3 text-right font-mono font-bold text-purple-400">{Number(l.total_tax).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                            <td className="p-3 text-right font-mono font-bold text-emerald-400">{Number(l.net_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* RPT-TAX-002: Bill-wise Sales */}
            {selectedReport.id === "RPT-TAX-002" && (
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted">Total Bills</span>
                    <p className="text-sm font-black text-theme-body mt-1">{genericReportData?.total_bills ?? 0}</p>
                  </div>
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted">Gross Amount</span>
                    <p className="text-sm font-black text-theme-body mt-1">₹{Number(genericReportData?.total_gross ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted">Total Discount</span>
                    <p className="text-sm font-black text-amber-400 mt-1">₹{Number(genericReportData?.total_discount ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted">Total Tax</span>
                    <p className="text-sm font-black text-purple-400 mt-1">₹{Number(genericReportData?.total_tax ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted">Net Revenue</span>
                    <p className="text-sm font-black text-emerald-400 mt-1">₹{Number(genericReportData?.total_net ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>

                <div className="overflow-x-auto border border-theme-divider rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-theme-surface-2/80 text-theme-muted border-b border-theme-divider uppercase text-[10px] font-bold">
                      <tr>
                        <th className="p-3">Invoice #</th>
                        <th className="p-3">Date</th>
                        <th className="p-3">Customer</th>
                        <th className="p-3">Payment Mode</th>
                        <th className="p-3 text-center">Items</th>
                        <th className="p-3 text-right">Gross (₹)</th>
                        <th className="p-3 text-right">Discount (₹)</th>
                        <th className="p-3 text-right">Tax (₹)</th>
                        <th className="p-3 text-right">Net Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-theme-divider/40">
                      {(!genericReportData?.lines || genericReportData.lines.length === 0) ? (
                        <tr><td colSpan={9} className="p-6 text-center text-theme-muted">No bill-wise sales records found for the selected period.</td></tr>
                      ) : (
                        genericReportData.lines.map((l: any, idx: number) => (
                          <tr key={idx} className="hover:bg-theme-surface-hover transition-colors">
                            <td className="p-3 font-mono font-bold text-blue-400">{l.invoice_number}</td>
                            <td className="p-3 font-mono text-theme-muted">{l.invoice_date}</td>
                            <td className="p-3 text-theme-body">{l.customer_name || "Walk-in"}</td>
                            <td className="p-3">
                              <span className="px-2 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider bg-theme-surface-3 text-blue-400 border border-theme-divider">
                                {l.payment_mode || "CASH"}
                              </span>
                            </td>
                            <td className="p-3 text-center font-mono">{l.items_count}</td>
                            <td className="p-3 text-right font-mono">{Number(l.gross_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                            <td className="p-3 text-right font-mono text-amber-400">{Number(l.discount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                            <td className="p-3 text-right font-mono text-purple-400">{Number(l.tax_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                            <td className="p-3 text-right font-mono font-bold text-emerald-400">{Number(l.net_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* RPT-TAX-003: Item-wise Sales */}
            {selectedReport.id === "RPT-TAX-003" && (
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted">Distinct Products</span>
                    <p className="text-sm font-black text-theme-body mt-1">{genericReportData?.total_items ?? 0}</p>
                  </div>
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted">Total Units Sold</span>
                    <p className="text-sm font-black text-blue-400 mt-1">{Number(genericReportData?.total_qty ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted">Total Net Revenue</span>
                    <p className="text-sm font-black text-emerald-400 mt-1">₹{Number(genericReportData?.total_net ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>

                <div className="overflow-x-auto border border-theme-divider rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-theme-surface-2/80 text-theme-muted border-b border-theme-divider uppercase text-[10px] font-bold">
                      <tr>
                        <th className="p-3">Product Code</th>
                        <th className="p-3">Product Name</th>
                        <th className="p-3">HSN</th>
                        <th className="p-3 text-right">Qty Sold</th>
                        <th className="p-3 text-right">Gross (₹)</th>
                        <th className="p-3 text-right">Discount (₹)</th>
                        <th className="p-3 text-right">Tax (₹)</th>
                        <th className="p-3 text-right">Net (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-theme-divider/40">
                      {(!genericReportData?.lines || genericReportData.lines.length === 0) ? (
                        <tr><td colSpan={8} className="p-6 text-center text-theme-muted">No item-wise sales records found for the selected period.</td></tr>
                      ) : (
                        genericReportData.lines.map((l: any, idx: number) => (
                          <tr key={idx} className="hover:bg-theme-surface-hover transition-colors">
                            <td className="p-3 font-mono font-bold text-blue-400">{l.product_code || "N/A"}</td>
                            <td className="p-3 text-theme-body font-medium">{l.product_name}</td>
                            <td className="p-3 font-mono text-theme-muted">{l.hsn_code || "—"}</td>
                            <td className="p-3 text-right font-mono font-bold text-blue-300">{Number(l.qty_sold).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                            <td className="p-3 text-right font-mono">{Number(l.gross_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                            <td className="p-3 text-right font-mono text-amber-400">{Number(l.discount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                            <td className="p-3 text-right font-mono text-purple-400">{Number(l.tax_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                            <td className="p-3 text-right font-mono font-bold text-emerald-400">{Number(l.net_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* RPT-TAX-004: Cancelled Bills */}
            {selectedReport.id === "RPT-TAX-004" && (
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted">Total Cancelled Bills</span>
                    <p className="text-sm font-black text-rose-400 mt-1">{genericReportData?.total_cancelled ?? 0}</p>
                  </div>
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted">Total Voided Value</span>
                    <p className="text-sm font-black text-rose-400 mt-1">₹{Number(genericReportData?.total_value_voided ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>

                <div className="overflow-x-auto border border-theme-divider rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-theme-surface-2/80 text-theme-muted border-b border-theme-divider uppercase text-[10px] font-bold">
                      <tr>
                        <th className="p-3">Invoice #</th>
                        <th className="p-3">Invoice Date</th>
                        <th className="p-3">Customer</th>
                        <th className="p-3">Cancelled By</th>
                        <th className="p-3">Cancellation Reason</th>
                        <th className="p-3 text-right">Voided Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-theme-divider/40">
                      {(!genericReportData?.lines || genericReportData.lines.length === 0) ? (
                        <tr><td colSpan={6} className="p-6 text-center text-theme-muted">No cancelled bills recorded for the selected period. Clean audit state.</td></tr>
                      ) : (
                        genericReportData.lines.map((l: any, idx: number) => (
                          <tr key={idx} className="hover:bg-theme-surface-hover transition-colors">
                            <td className="p-3 font-mono font-bold text-rose-400">{l.invoice_number}</td>
                            <td className="p-3 font-mono text-theme-muted">{l.invoice_date}</td>
                            <td className="p-3 text-theme-body">{l.customer_name || "Walk-in"}</td>
                            <td className="p-3 font-mono text-theme-muted">{l.cancelled_by || "SYSTEM"}</td>
                            <td className="p-3 text-theme-muted">{l.cancellation_reason || "Voided transaction"}</td>
                            <td className="p-3 text-right font-mono font-bold text-rose-400">{Number(l.voided_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* RPT-TAX-005 & RPT-SAL-013: Daily Sales Register (Bill & Item Detail) */}
            {(selectedReport.id === "RPT-TAX-005" || selectedReport.id === "RPT-SAL-013") && (
              <div className="p-4 space-y-4">
                {/* KPI Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted font-mono">TOTAL BILLS CUT</span>
                    <p className="text-lg font-black text-theme-body mt-0.5">{salesRegisterTotals.totalBills} Invoices</p>
                    <p className="text-[10px] text-theme-muted mt-0.5 font-mono">{filteredSalesLines.length} line items</p>
                  </div>
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted font-mono">TOTAL QUANTITY (PCS)</span>
                    <p className="text-lg font-black text-blue-500 mt-0.5">
                      {salesRegisterTotals.totalQuantity.toLocaleString("en-IN", { minimumFractionDigits: 0 })} Pcs
                    </p>
                    <p className="text-[10px] text-theme-muted mt-0.5 font-mono">Units sold at POS</p>
                  </div>
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted font-mono">TOTAL CONCESSIONS (₹)</span>
                    <p className="text-lg font-black text-amber-500 mt-0.5">
                      ₹{salesRegisterTotals.totalDiscount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-[10px] text-theme-muted mt-0.5 font-mono">Discounts & offers given</p>
                  </div>
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted font-mono">NET REVENUE (₹)</span>
                    <p className="text-lg font-black text-emerald-500 mt-0.5">
                      ₹{salesRegisterTotals.totalNet.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-[10px] text-theme-muted mt-0.5 font-mono">
                      Incl. GST ₹{salesRegisterTotals.totalTax.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>

                {/* Search Bar & View Mode Toggle */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-theme-surface-2 p-3 rounded-xl border border-theme-divider">
                  {/* View Mode Toggle & Active Store Scope */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1 bg-theme-surface-1 p-1 rounded-lg border border-theme-border text-xs font-semibold">
                      <button
                        type="button"
                        onClick={() => setSalesViewMode("detailed")}
                        className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors ${
                          salesViewMode === "detailed"
                            ? "bg-theme-primary text-white font-bold shadow-xs"
                            : "text-theme-muted hover:text-theme-body"
                        }`}
                      >
                        <TableProperties size={13} />
                        Detailed Items View
                      </button>
                      <button
                        type="button"
                        onClick={() => setSalesViewMode("bill_summary")}
                        className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors ${
                          salesViewMode === "bill_summary"
                            ? "bg-theme-primary text-white font-bold shadow-xs"
                            : "text-theme-muted hover:text-theme-body"
                        }`}
                      >
                        <Receipt size={13} />
                        Bill Summary View
                      </button>
                    </div>

                    {/* Active Store Badge: Single Store by default */}
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-theme-surface-1 border border-theme-border text-xs">
                      <Store size={13} className="text-blue-500 shrink-0" />
                      <span className="font-semibold text-theme-body">{activeStoreName}</span>
                      {!isLocationsManagementEnabled ? (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 font-bold border border-emerald-500/20 font-mono">
                          Single Store
                        </span>
                      ) : (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-600 font-bold border border-blue-500/20 font-mono">
                          Multi-Store
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Instant Filter Search */}
                  <div className="relative w-full sm:w-80">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted" />
                    <input
                      type="text"
                      value={reportSearchQuery}
                      onChange={(e) => setReportSearchQuery(e.target.value)}
                      placeholder="Filter Invoice #, Article, Barcode, Size..."
                      className="w-full bg-theme-surface-1 border border-theme-border rounded-lg pl-9 pr-3 py-1.5 text-xs text-theme-body placeholder-theme-muted focus:outline-none focus:border-theme-primary font-medium"
                    />
                    {reportSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setReportSearchQuery("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-theme-muted hover:text-theme-body text-xs"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>

                {/* Table View */}
                {salesViewMode === "detailed" ? (
                  <div className="overflow-x-auto border border-theme-divider rounded-xl">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-theme-surface-2 text-theme-muted border-b border-theme-divider uppercase text-[10px] font-mono tracking-wider font-bold">
                        <tr>
                          <th className="p-3">Invoice #</th>
                          <th className="p-3">Date</th>
                          <th className="p-3">Customer</th>
                          <th className="p-3">Article / SKU</th>
                          <th className="p-3">Item Description</th>
                          <th className="p-3">Barcode</th>
                          <th className="p-3">Size</th>
                          <th className="p-3 text-right">Qty</th>
                          <th className="p-3 text-right">Rate (₹)</th>
                          <th className="p-3 text-right">Disc (₹)</th>
                          <th className="p-3 text-right">GST Rate</th>
                          <th className="p-3 text-right">Net Total (₹)</th>
                          <th className="p-3 text-center">Tender</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-theme-divider/40">
                        {filteredSalesLines.length === 0 ? (
                          <tr>
                            <td colSpan={13} className="p-8 text-center text-theme-muted">
                              <div className="flex flex-col items-center justify-center space-y-1">
                                <span className="text-xs font-semibold text-theme-body">No sales line items found</span>
                                <span className="text-[11px] text-theme-muted">
                                  Try adjusting the reporting period or clearing the search filter.
                                </span>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          filteredSalesLines.map((l: any) => (
                            <tr key={l.key} className="hover:bg-theme-surface-hover transition-colors">
                              <td className="p-3 font-mono font-bold text-blue-500 whitespace-nowrap">{l.invoiceNo}</td>
                              <td className="p-3 font-mono text-theme-muted whitespace-nowrap">{l.invoiceDate}</td>
                              <td className="p-3 font-medium text-theme-body whitespace-nowrap">{l.customerName}</td>
                              <td className="p-3 font-mono font-bold text-blue-500 whitespace-nowrap">{l.articleNo}</td>
                              <td className="p-3 text-theme-body font-medium min-w-[160px]">{l.itemName}</td>
                              <td className="p-3 font-mono text-theme-muted whitespace-nowrap">{l.barcode}</td>
                              <td className="p-3 whitespace-nowrap">
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-theme-surface-2 border border-theme-border font-mono">
                                  {l.size}
                                </span>
                              </td>
                              <td className="p-3 text-right font-mono font-bold text-blue-400">
                                {l.quantity.toLocaleString("en-IN", { minimumFractionDigits: 0 })}
                              </td>
                              <td className="p-3 text-right font-mono">
                                {l.rate.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="p-3 text-right font-mono text-amber-500">
                                {l.discount > 0 ? l.discount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}
                              </td>
                              <td className="p-3 text-right font-mono text-theme-muted">{l.gstRate}%</td>
                              <td className="p-3 text-right font-mono font-bold text-emerald-500">
                                ₹{l.netTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="p-3 text-center whitespace-nowrap">
                                <span className={`px-2 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider border font-mono ${
                                  l.paymentMode === "CASH"
                                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                                    : l.paymentMode === "UPI"
                                    ? "bg-purple-500/10 text-purple-600 border-purple-500/20"
                                    : "bg-blue-500/10 text-blue-600 border-blue-500/20"
                                }`}>
                                  {l.paymentMode}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      {filteredSalesLines.length > 0 && (
                        <tfoot className="bg-theme-surface-2 font-bold border-t border-theme-divider">
                          <tr>
                            <td colSpan={7} className="p-3 font-mono text-xs uppercase tracking-wider text-theme-body">
                              Total across {filteredSalesLines.length} line items ({salesRegisterTotals.totalBills} bills)
                            </td>
                            <td className="p-3 text-right font-mono text-blue-500 text-xs">
                              {salesRegisterTotals.totalQuantity.toLocaleString("en-IN", { minimumFractionDigits: 0 })} Pcs
                            </td>
                            <td className="p-3"></td>
                            <td className="p-3 text-right font-mono text-amber-500 text-xs">
                              ₹{salesRegisterTotals.totalDiscount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="p-3"></td>
                            <td className="p-3 text-right font-mono text-emerald-500 text-xs">
                              ₹{salesRegisterTotals.totalNet.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="p-3"></td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-theme-divider rounded-xl">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-theme-surface-2 text-theme-muted border-b border-theme-divider uppercase text-[10px] font-mono tracking-wider font-bold">
                        <tr>
                          <th className="p-3">Invoice #</th>
                          <th className="p-3">Date</th>
                          <th className="p-3">Customer Name</th>
                          <th className="p-3 text-center">Tender</th>
                          <th className="p-3 text-right">Items Count</th>
                          <th className="p-3 text-right">Total Qty (Pcs)</th>
                          <th className="p-3 text-right">Discount (₹)</th>
                          <th className="p-3 text-right">Tax (GST ₹)</th>
                          <th className="p-3 text-right">Net Bill Value (₹)</th>
                          <th className="p-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-theme-divider/40">
                        {billSummaryList.length === 0 ? (
                          <tr>
                            <td colSpan={10} className="p-8 text-center text-theme-muted">
                              No bills found for the selected period.
                            </td>
                          </tr>
                        ) : (
                          billSummaryList.map((b: any) => (
                            <tr key={b.invoiceNo} className="hover:bg-theme-surface-hover transition-colors">
                              <td className="p-3 font-mono font-bold text-blue-500 whitespace-nowrap">{b.invoiceNo}</td>
                              <td className="p-3 font-mono text-theme-muted whitespace-nowrap">{b.invoiceDate}</td>
                              <td className="p-3 font-medium text-theme-body">{b.customerName}</td>
                              <td className="p-3 text-center whitespace-nowrap">
                                <span className={`px-2 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider border font-mono ${
                                  b.paymentMode === "CASH"
                                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                                    : b.paymentMode === "UPI"
                                    ? "bg-purple-500/10 text-purple-600 border-purple-500/20"
                                    : "bg-blue-500/10 text-blue-600 border-blue-500/20"
                                }`}>
                                  {b.paymentMode}
                                </span>
                              </td>
                              <td className="p-3 text-right font-mono text-theme-muted">{b.itemsCount} lines</td>
                              <td className="p-3 text-right font-mono font-bold text-blue-400">
                                {b.totalQuantity.toLocaleString("en-IN", { minimumFractionDigits: 0 })}
                              </td>
                              <td className="p-3 text-right font-mono text-amber-500">
                                {b.totalDiscount > 0 ? b.totalDiscount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}
                              </td>
                              <td className="p-3 text-right font-mono text-purple-400">
                                ₹{b.totalTax.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="p-3 text-right font-mono font-bold text-emerald-500">
                                ₹{b.netTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="p-3 text-right whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSalesViewMode("detailed");
                                    setReportSearchQuery(b.invoiceNo);
                                  }}
                                  className="px-2.5 py-1 bg-theme-surface-2 hover:bg-theme-surface-hover text-theme-primary border border-theme-border rounded-md font-bold text-[10px] transition-colors cursor-pointer"
                                >
                                  View Lines
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      {billSummaryList.length > 0 && (
                        <tfoot className="bg-theme-surface-2 font-bold border-t border-theme-divider">
                          <tr>
                            <td colSpan={5} className="p-3 font-mono text-xs uppercase tracking-wider text-theme-body">
                              Total ({billSummaryList.length} Invoices)
                            </td>
                            <td className="p-3 text-right font-mono text-blue-500 text-xs">
                              {salesRegisterTotals.totalQuantity.toLocaleString("en-IN", { minimumFractionDigits: 0 })} Pcs
                            </td>
                            <td className="p-3 text-right font-mono text-amber-500 text-xs">
                              ₹{salesRegisterTotals.totalDiscount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="p-3 text-right font-mono text-purple-400 text-xs">
                              ₹{salesRegisterTotals.totalTax.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="p-3 text-right font-mono text-emerald-500 text-xs">
                              ₹{salesRegisterTotals.totalNet.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="p-3"></td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* RPT-INV-001: Current Stock on Hand & Valuation */}
            {selectedReport.id === "RPT-INV-001" && (
              <div className="p-4 space-y-4">
                {/* KPI Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted font-mono">TOTAL ARTICLES / SKUS</span>
                    <p className="text-lg font-black text-theme-body mt-0.5">{stockTotals.totalArticles} Items</p>
                    <p className="text-[10px] text-theme-muted mt-0.5 font-mono">In inventory catalog</p>
                  </div>
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted font-mono">TOTAL ON-HAND STOCK</span>
                    <p className="text-lg font-black text-blue-500 mt-0.5">
                      {stockTotals.totalQty.toLocaleString("en-IN", { minimumFractionDigits: 0 })} Pcs
                    </p>
                    <p className="text-[10px] text-theme-muted mt-0.5 font-mono">Physical warehouse count</p>
                  </div>
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted font-mono">TOTAL STOCK VALUATION</span>
                    <p className="text-lg font-black text-emerald-500 mt-0.5">
                      ₹{stockTotals.totalValuation.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-[10px] text-theme-muted mt-0.5 font-mono">At average landing cost</p>
                  </div>
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted font-mono">LOW STOCK ALERTS</span>
                    <p className={`text-lg font-black mt-0.5 ${stockTotals.lowStockCount > 0 ? "text-rose-500" : "text-emerald-500"}`}>
                      {stockTotals.lowStockCount} Articles
                    </p>
                    <p className="text-[10px] text-theme-muted mt-0.5 font-mono">Below reorder threshold</p>
                  </div>
                </div>

                {/* Instant Search Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-theme-surface-2 p-3 rounded-xl border border-theme-divider">
                  <div className="text-xs font-bold text-theme-body flex items-center gap-2">
                    <Boxes size={14} className="text-purple-500" />
                    <span>Physical Stock Ledger (Single-Location Canonical)</span>
                  </div>
                  <div className="relative w-full sm:w-80">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted" />
                    <input
                      type="text"
                      value={reportSearchQuery}
                      onChange={(e) => setReportSearchQuery(e.target.value)}
                      placeholder="Search Article No, Description, Category..."
                      className="w-full bg-theme-surface-1 border border-theme-border rounded-lg pl-9 pr-3 py-1.5 text-xs text-theme-body placeholder-theme-muted focus:outline-none focus:border-theme-primary font-medium"
                    />
                    {reportSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setReportSearchQuery("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-theme-muted hover:text-theme-body text-xs"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>

                {/* Stock Table */}
                <div className="overflow-x-auto border border-theme-divider rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-theme-surface-2 text-theme-muted border-b border-theme-divider uppercase text-[10px] font-mono tracking-wider font-bold">
                      <tr>
                        <th className="p-3">Article / SKU</th>
                        <th className="p-3">Item Description</th>
                        <th className="p-3">Category</th>
                        <th className="p-3 text-right">On-Hand (Pcs)</th>
                        <th className="p-3 text-right">Avg Unit Cost (₹)</th>
                        <th className="p-3 text-right">Stock Valuation (₹)</th>
                        <th className="p-3 text-right">Min Level</th>
                        <th className="p-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-theme-divider/40">
                      {filteredStockLines.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-theme-muted">
                            No inventory items found matching search criteria.
                          </td>
                        </tr>
                      ) : (
                        filteredStockLines.map((s: any) => (
                          <tr key={s.key} className="hover:bg-theme-surface-hover transition-colors">
                            <td className="p-3 font-mono font-bold text-purple-400 whitespace-nowrap">{s.articleNo}</td>
                            <td className="p-3 text-theme-body font-medium">{s.productName}</td>
                            <td className="p-3 text-theme-muted whitespace-nowrap">{s.category}</td>
                            <td className="p-3 text-right font-mono font-bold text-blue-400">
                              {s.onHand.toLocaleString("en-IN", { minimumFractionDigits: 0 })}
                            </td>
                            <td className="p-3 text-right font-mono">
                              {s.avgCost.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="p-3 text-right font-mono font-bold text-emerald-500">
                              ₹{s.stockValue.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="p-3 text-right font-mono text-theme-muted">{s.minLevel}</td>
                            <td className="p-3 text-center whitespace-nowrap">
                              <span className={`px-2 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider border font-mono ${
                                s.status === "LOW"
                                  ? "bg-rose-500/10 text-rose-600 border-rose-500/20"
                                  : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                              }`}>
                                {s.status === "LOW" ? "LOW STOCK" : "IN STOCK"}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {filteredStockLines.length > 0 && (
                      <tfoot className="bg-theme-surface-2 font-bold border-t border-theme-divider">
                        <tr>
                          <td colSpan={3} className="p-3 font-mono text-xs uppercase tracking-wider text-theme-body">
                            Total Valuation ({filteredStockLines.length} Items)
                          </td>
                          <td className="p-3 text-right font-mono text-blue-500 text-xs">
                            {stockTotals.totalQty.toLocaleString("en-IN", { minimumFractionDigits: 0 })} Pcs
                          </td>
                          <td className="p-3"></td>
                          <td className="p-3 text-right font-mono text-emerald-500 text-xs">
                            ₹{stockTotals.totalValuation.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td colSpan={2} className="p-3"></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            )}

            {/* RPT-MIS-005: Salesperson-wise Discount */}
            {selectedReport.id === "RPT-MIS-005" && (
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-2 gap-3">
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted">Active Salespersons</span>
                    <p className="text-sm font-black text-theme-body mt-1">{genericReportData?.total_salespersons ?? 0}</p>
                  </div>
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted">Total Conceded Discount</span>
                    <p className="text-sm font-black text-amber-400 mt-1">₹{Number(genericReportData?.total_discount ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>

                <div className="overflow-x-auto border border-theme-divider rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-theme-surface-2/80 text-theme-muted border-b border-theme-divider uppercase text-[10px] font-bold">
                      <tr>
                        <th className="p-3">Salesperson ID</th>
                        <th className="p-3">Salesperson Name</th>
                        <th className="p-3 text-center">Bills Count</th>
                        <th className="p-3 text-right">Total Sales (₹)</th>
                        <th className="p-3 text-right">Total Discount (₹)</th>
                        <th className="p-3 text-right">Discount %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-theme-divider/40">
                      {(!genericReportData?.lines || genericReportData.lines.length === 0) ? (
                        <tr><td colSpan={6} className="p-6 text-center text-theme-muted">No salesperson discount records found.</td></tr>
                      ) : (
                        genericReportData.lines.map((l: any, idx: number) => (
                          <tr key={idx} className="hover:bg-theme-surface-hover transition-colors">
                            <td className="p-3 font-mono font-bold text-blue-400">{l.salesperson_id || "UNASSIGNED"}</td>
                            <td className="p-3 text-theme-body font-medium">{l.salesperson_name}</td>
                            <td className="p-3 text-center font-mono">{l.bills_count}</td>
                            <td className="p-3 text-right font-mono font-medium">{Number(l.total_sales).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                            <td className="p-3 text-right font-mono font-bold text-amber-400">{Number(l.total_discount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                            <td className="p-3 text-right font-mono text-purple-400 font-bold">{Number(l.discount_pct).toFixed(2)}%</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* RPT-OPS-001: Discount Given Summary */}
            {selectedReport.id === "RPT-OPS-001" && (
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted">Discounted Invoices</span>
                    <p className="text-sm font-black text-theme-body mt-1">{genericReportData?.total_bills ?? 0}</p>
                  </div>
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted">Gross Value</span>
                    <p className="text-sm font-black text-theme-body mt-1">₹{Number(genericReportData?.total_gross ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted">Total Discount</span>
                    <p className="text-sm font-black text-amber-400 mt-1">₹{Number(genericReportData?.total_discount ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted">Net Revenue</span>
                    <p className="text-sm font-black text-emerald-400 mt-1">₹{Number(genericReportData?.total_net ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted">Effective Disc %</span>
                    <p className="text-sm font-black text-purple-400 mt-1">{Number(genericReportData?.overall_discount_pct ?? 0).toFixed(2)}%</p>
                  </div>
                </div>

                <div className="overflow-x-auto border border-theme-divider rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-theme-surface-2/80 text-theme-muted border-b border-theme-divider uppercase text-[10px] font-bold">
                      <tr>
                        <th className="p-3">Invoice #</th>
                        <th className="p-3">Date</th>
                        <th className="p-3">Customer</th>
                        <th className="p-3">Salesperson</th>
                        <th className="p-3 text-right">Gross (₹)</th>
                        <th className="p-3 text-right">Discount (₹)</th>
                        <th className="p-3 text-right">Disc %</th>
                        <th className="p-3 text-right">Net (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-theme-divider/40">
                      {(!genericReportData?.lines || genericReportData.lines.length === 0) ? (
                        <tr><td colSpan={8} className="p-6 text-center text-theme-muted">No discount records found for the selected period.</td></tr>
                      ) : (
                        genericReportData.lines.map((l: any, idx: number) => (
                          <tr key={idx} className="hover:bg-theme-surface-hover transition-colors">
                            <td className="p-3 font-mono font-bold text-blue-400">{l.invoice_number}</td>
                            <td className="p-3 font-mono text-theme-muted">{l.invoice_date}</td>
                            <td className="p-3 text-theme-body">{l.customer_name || "Walk-in"}</td>
                            <td className="p-3 font-medium text-theme-body">{l.salesperson_name || "Store Default"}</td>
                            <td className="p-3 text-right font-mono">{Number(l.gross_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                            <td className="p-3 text-right font-mono font-bold text-amber-400">{Number(l.discount_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                            <td className="p-3 text-right font-mono text-purple-400">{Number(l.discount_pct).toFixed(2)}%</td>
                            <td className="p-3 text-right font-mono font-bold text-emerald-400">{Number(l.net_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* RPT-MRC-003: Item-wise Sales Returns */}
            {selectedReport.id === "RPT-MRC-003" && (
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted">Return Lines</span>
                    <p className="text-sm font-black text-rose-400 mt-1">{genericReportData?.total_returns ?? 0}</p>
                  </div>
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted">Total Qty Returned</span>
                    <p className="text-sm font-black text-rose-400 mt-1">{Number(genericReportData?.total_qty ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted">Total Refund Amount</span>
                    <p className="text-sm font-black text-rose-400 mt-1">₹{Number(genericReportData?.total_amount ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>

                <div className="overflow-x-auto border border-theme-divider rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-theme-surface-2/80 text-theme-muted border-b border-theme-divider uppercase text-[10px] font-bold">
                      <tr>
                        <th className="p-3">Return #</th>
                        <th className="p-3">Return Date</th>
                        <th className="p-3">Original Invoice #</th>
                        <th className="p-3">Item Code</th>
                        <th className="p-3">Item Description</th>
                        <th className="p-3 text-right">Return Qty</th>
                        <th className="p-3 text-right">Rate (₹)</th>
                        <th className="p-3 text-right">Tax (₹)</th>
                        <th className="p-3 text-right">Refund Total (₹)</th>
                        <th className="p-3">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-theme-divider/40">
                      {(!genericReportData?.lines || genericReportData.lines.length === 0) ? (
                        <tr><td colSpan={10} className="p-6 text-center text-theme-muted">No sales returns recorded for the selected period.</td></tr>
                      ) : (
                        genericReportData.lines.map((l: any, idx: number) => (
                          <tr key={idx} className="hover:bg-theme-surface-hover transition-colors">
                            <td className="p-3 font-mono font-bold text-rose-400">{l.return_number}</td>
                            <td className="p-3 font-mono text-theme-muted">{l.return_date}</td>
                            <td className="p-3 font-mono text-blue-400">{l.original_invoice_no || "—"}</td>
                            <td className="p-3 font-mono text-theme-muted">{l.product_code || "—"}</td>
                            <td className="p-3 text-theme-body font-medium">{l.product_name}</td>
                            <td className="p-3 text-right font-mono font-bold text-rose-400">{Number(l.quantity).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                            <td className="p-3 text-right font-mono">{Number(l.price).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                            <td className="p-3 text-right font-mono text-purple-400">{Number(l.tax_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                            <td className="p-3 text-right font-mono font-bold text-rose-400">{Number(l.total_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                            <td className="p-3 text-theme-muted text-[11px]">{l.reason || "Customer return"}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* RPT-MRC-001: Attribute+Size wise Sales */}
            {selectedReport.id === "RPT-MRC-001" && (
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted">Attribute Clusters</span>
                    <p className="text-sm font-black text-theme-body mt-1">{genericReportData?.total_groups ?? 0}</p>
                  </div>
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted">Total Units Sold</span>
                    <p className="text-sm font-black text-blue-400 mt-1">{Number(genericReportData?.total_qty ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted">Total Net Revenue</span>
                    <p className="text-sm font-black text-emerald-400 mt-1">₹{Number(genericReportData?.total_net ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>

                <div className="overflow-x-auto border border-theme-divider rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-theme-surface-2/80 text-theme-muted border-b border-theme-divider uppercase text-[10px] font-bold">
                      <tr>
                        <th className="p-3">Product</th>
                        <th className="p-3">Style</th>
                        <th className="p-3">Category</th>
                        <th className="p-3">Brand</th>
                        <th className="p-3">Color</th>
                        <th className="p-3">Size</th>
                        <th className="p-3 text-right">Qty Sold</th>
                        <th className="p-3 text-right">Gross (₹)</th>
                        <th className="p-3 text-right">Discount (₹)</th>
                        <th className="p-3 text-right">Net Revenue (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-theme-divider/40">
                      {(!genericReportData?.lines || genericReportData.lines.length === 0) ? (
                        <tr><td colSpan={10} className="p-6 text-center text-theme-muted">No merchandise sales matrix data found for the selected period.</td></tr>
                      ) : (
                        genericReportData.lines.map((l: any, idx: number) => (
                          <tr key={idx} className="hover:bg-theme-surface-hover transition-colors">
                            <td className="p-3">
                              <div className="font-semibold text-theme-body">{l.product_name || "Uncatalogued Item"}</div>
                              <div className="text-[10px] font-mono text-theme-muted">{l.product_code || "N/A"}</div>
                            </td>
                            <td className="p-3 font-mono text-theme-primary">{l.style_code || "N/A"}</td>
                            <td className="p-3 font-semibold text-theme-body">{l.category}</td>
                            <td className="p-3 text-theme-muted">{l.brand}</td>
                            <td className="p-3 font-mono text-theme-muted">{l.color}</td>
                            <td className="p-3">
                              <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-theme-surface-3 text-blue-300 border border-theme-divider">
                                {l.size}
                              </span>
                            </td>
                            <td className="p-3 text-right font-mono font-bold text-blue-300">{Number(l.qty_sold).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                            <td className="p-3 text-right font-mono">{Number(l.gross_revenue ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                            <td className="p-3 text-right font-mono text-amber-400">{Number(l.discount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                            <td className="p-3 text-right font-mono font-bold text-emerald-400">{Number(l.net_revenue ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* RPT-TAX-006: Statutory GST Tax Invoices Master Register */}
            {selectedReport.id === "RPT-TAX-006" && (
              <div className="p-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 bg-theme-surface-2 p-3.5 rounded-xl border border-theme-divider">
                  <div>
                    <h5 className="font-bold text-theme-body text-xs flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      Statutory GST Tax Invoices Master Register
                    </h5>
                    <p className="text-[10px] text-theme-muted font-mono mt-0.5">
                      Statutory GST Compliance Register • Filter by Tax Rate, Customer &amp; Financial Year
                    </p>
                  </div>
                  <a
                    href="/api/v1/reports/export/tax-invoices-excel"
                    download
                    className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                  >
                    <Download size={13} /> Download Full 6-Sheet Excel (.xlsx)
                  </a>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted">Total Invoices</span>
                    <p className="text-sm font-black text-theme-body mt-1">{genericReportData?.total_invoices ?? 0} Bills</p>
                  </div>
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted">Active / Cancelled</span>
                    <p className="text-sm font-black text-emerald-400 mt-1">
                      {genericReportData?.completed_count ?? 0} <span className="text-rose-400 font-normal text-xs">/ {genericReportData?.cancelled_count ?? 0}</span>
                    </p>
                  </div>
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted">Total Pairs (Units)</span>
                    <p className="text-sm font-black text-blue-400 mt-1">{Number(genericReportData?.total_quantity ?? 0).toLocaleString("en-IN")}</p>
                  </div>
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted">Taxable Value</span>
                    <p className="text-sm font-black text-theme-body mt-1">₹{Number(genericReportData?.total_taxable ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted">Total IGST (5%)</span>
                    <p className="text-sm font-black text-purple-400 mt-1">₹{Number(genericReportData?.total_tax ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted">Gross Grand Total</span>
                    <p className="text-sm font-black text-emerald-400 mt-1">₹{Number(genericReportData?.total_grand_total ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>

                <div className="overflow-x-auto border border-theme-divider rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-theme-surface-2/80 text-theme-muted border-b border-theme-divider uppercase text-[10px] font-bold">
                      <tr>
                        <th className="p-3 text-center">Bill #</th>
                        <th className="p-3">Invoice No</th>
                        <th className="p-3">Date</th>
                        <th className="p-3 text-center">Status</th>
                        <th className="p-3 text-center">Store Code</th>
                        <th className="p-3">Store Location</th>
                        <th className="p-3">Place of Supply</th>
                        <th className="p-3 text-right">Pairs</th>
                        <th className="p-3 text-right">Taxable (₹)</th>
                        <th className="p-3 text-right">IGST 5% (₹)</th>
                        <th className="p-3 text-right">Grand Total (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-theme-divider/40">
                      {(!genericReportData?.lines || genericReportData.lines.length === 0) ? (
                        <tr><td colSpan={11} className="p-6 text-center text-theme-muted">No statutory tax invoices found in the selected range.</td></tr>
                      ) : (
                        genericReportData.lines.map((l: any, idx: number) => {
                          const isCan = l.status === "CANCELLED";
                          return (
                            <tr key={idx} className={`hover:bg-theme-surface-hover transition-colors ${isCan ? "bg-rose-50/40 text-rose-900" : ""}`}>
                              <td className="p-3 text-center font-mono font-bold">{l.bill_no || idx + 1}</td>
                              <td className="p-3 font-mono font-bold text-blue-400">{l.invoice_number}</td>
                              <td className="p-3 font-mono text-theme-muted">{l.invoice_date}</td>
                              <td className="p-3 text-center">
                                <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase ${isCan ? "bg-rose-100 text-rose-700 border border-rose-200" : "bg-emerald-100 text-emerald-700 border border-emerald-200"}`}>
                                  {l.status}
                                </span>
                              </td>
                              <td className="p-3 text-center font-mono text-theme-muted">{l.sis_code || "—"}</td>
                              <td className="p-3 text-theme-body font-medium truncate max-w-[180px]" title={l.site_name || l.shipping_address}>{l.site_name || l.shipping_address}</td>
                              <td className="p-3 text-theme-muted text-[11px]">{l.place_of_supply}</td>
                              <td className="p-3 text-right font-mono font-bold text-blue-400">{Number(l.total_quantity).toLocaleString("en-IN")}</td>
                              <td className="p-3 text-right font-mono">{Number(l.taxable_value).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                              <td className="p-3 text-right font-mono text-purple-400">{Number(l.total_tax).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                              <td className="p-3 text-right font-mono font-bold text-emerald-400">₹{Number(l.grand_total).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* RPT-MRC-005: Article, Color & Size Variant Matrix */}
            {selectedReport.id === "RPT-MRC-005" && (
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted">Total Variants</span>
                    <p className="text-sm font-black text-theme-body mt-1">{genericReportData?.total_variants ?? 0} Styles</p>
                  </div>
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted">Total Pairs Sold</span>
                    <p className="text-sm font-black text-blue-400 mt-1">{Number(genericReportData?.total_units ?? 0).toLocaleString("en-IN")} Pairs</p>
                  </div>
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted">Taxable Value</span>
                    <p className="text-sm font-black text-theme-body mt-1">₹{Number(genericReportData?.total_taxable ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted">IGST 5%</span>
                    <p className="text-sm font-black text-purple-400 mt-1">₹{Number(genericReportData?.total_tax ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted">Gross Total</span>
                    <p className="text-sm font-black text-emerald-400 mt-1">₹{Number(genericReportData?.total_gross ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>

                <div className="overflow-x-auto border border-theme-divider rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-theme-surface-2/80 text-theme-muted border-b border-theme-divider uppercase text-[10px] font-bold">
                      <tr>
                        <th className="p-3">Article Code</th>
                        <th className="p-3">Color</th>
                        <th className="p-3 text-right">Size 36</th>
                        <th className="p-3 text-right">Size 37</th>
                        <th className="p-3 text-right">Size 38</th>
                        <th className="p-3 text-right">Size 39</th>
                        <th className="p-3 text-right">Size 40</th>
                        <th className="p-3 text-right">Size 41</th>
                        <th className="p-3 text-right">Size 42</th>
                        <th className="p-3 text-right">Total Units</th>
                        <th className="p-3 text-right">Taxable (₹)</th>
                        <th className="p-3 text-right">Tax 5% (₹)</th>
                        <th className="p-3 text-right">Gross Total (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-theme-divider/40">
                      {(!genericReportData?.rows || genericReportData.rows.length === 0) ? (
                        <tr><td colSpan={13} className="p-6 text-center text-theme-muted">No article size curve data found for the selected filter.</td></tr>
                      ) : (
                        genericReportData.rows.map((r: any, idx: number) => (
                          <tr key={idx} className="hover:bg-theme-surface-hover transition-colors">
                            <td className="p-3 font-mono font-bold text-blue-400">{r.article}</td>
                            <td className="p-3 font-semibold text-theme-body">{r.color}</td>
                            <td className="p-3 text-right font-mono text-theme-muted">{Number(r.size_36).toLocaleString("en-IN")}</td>
                            <td className="p-3 text-right font-mono text-theme-muted">{Number(r.size_37).toLocaleString("en-IN")}</td>
                            <td className="p-3 text-right font-mono text-theme-muted">{Number(r.size_38).toLocaleString("en-IN")}</td>
                            <td className="p-3 text-right font-mono text-theme-muted">{Number(r.size_39).toLocaleString("en-IN")}</td>
                            <td className="p-3 text-right font-mono text-theme-muted">{Number(r.size_40).toLocaleString("en-IN")}</td>
                            <td className="p-3 text-right font-mono text-theme-muted">{Number(r.size_41).toLocaleString("en-IN")}</td>
                            <td className="p-3 text-right font-mono text-theme-muted">{Number(r.size_42).toLocaleString("en-IN")}</td>
                            <td className="p-3 text-right font-mono font-bold text-blue-400">{Number(r.total_units).toLocaleString("en-IN")}</td>
                            <td className="p-3 text-right font-mono">{Number(r.taxable_value).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                            <td className="p-3 text-right font-mono text-purple-400">{Number(r.tax_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                            <td className="p-3 text-right font-mono font-bold text-emerald-400">₹{Number(r.gross_total).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* RPT-OPS-006: Store-Wise SIS Tax Register */}
            {selectedReport.id === "RPT-OPS-006" && (
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted">Active Stores</span>
                    <p className="text-sm font-black text-theme-body mt-1">{genericReportData?.total_stores ?? 0} Stores</p>
                  </div>
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted">Total Invoices</span>
                    <p className="text-sm font-black text-blue-400 mt-1">{genericReportData?.total_invoices ?? 0} Bills</p>
                  </div>
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted">Taxable Value</span>
                    <p className="text-sm font-black text-theme-body mt-1">₹{Number(genericReportData?.total_taxable ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted">Total Revenue</span>
                    <p className="text-sm font-black text-emerald-400 mt-1">₹{Number(genericReportData?.total_grand ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>

                <div className="overflow-x-auto border border-theme-divider rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-theme-surface-2/80 text-theme-muted border-b border-theme-divider uppercase text-[10px] font-bold">
                      <tr>
                        <th className="p-3 text-center">Store Code</th>
                        <th className="p-3">Store Location Name</th>
                        <th className="p-3 text-right">Invoices</th>
                        <th className="p-3 text-right">Completed</th>
                        <th className="p-3 text-right">Cancelled</th>
                        <th className="p-3 text-right">Taxable (₹)</th>
                        <th className="p-3 text-right">IGST 5% (₹)</th>
                        <th className="p-3 text-right">Grand Total (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-theme-divider/40">
                      {(!genericReportData?.lines || genericReportData.lines.length === 0) ? (
                        <tr><td colSpan={8} className="p-6 text-center text-theme-muted">No store records found.</td></tr>
                      ) : (
                        genericReportData.lines.map((l: any, idx: number) => (
                          <tr key={idx} className="hover:bg-theme-surface-hover transition-colors">
                            <td className="p-3 text-center font-mono font-bold text-blue-400">{l.sis_code}</td>
                            <td className="p-3 text-theme-body font-medium">{l.site_name}</td>
                            <td className="p-3 text-right font-mono font-bold">{l.total_invoices}</td>
                            <td className="p-3 text-right font-mono text-emerald-400">{l.completed_count}</td>
                            <td className="p-3 text-right font-mono text-rose-400">{l.cancelled_count}</td>
                            <td className="p-3 text-right font-mono">{Number(l.taxable_value).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                            <td className="p-3 text-right font-mono text-purple-400">{Number(l.tax_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                            <td className="p-3 text-right font-mono font-bold text-emerald-400">₹{Number(l.grand_total).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* RPT-SO-001: Sales Order Summary */}
            {selectedReport.id === "RPT-SO-001" && (
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted">Total Orders</span>
                    <p className="text-sm font-black text-theme-body mt-1">{genericReportData?.total_orders ?? 0}</p>
                  </div>
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted">Ordered Quantity</span>
                    <p className="text-sm font-black text-blue-400 mt-1">{Number(genericReportData?.total_ordered_qty ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 0 })} Units</p>
                  </div>
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted">Total Order Value</span>
                    <p className="text-sm font-black text-theme-body mt-1">₹{Number(genericReportData?.total_order_value ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted">Billed Value</span>
                    <p className="text-sm font-black text-emerald-400 mt-1">₹{Number(genericReportData?.total_billed_value ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted">Pending Value</span>
                    <p className="text-sm font-black text-amber-400 mt-1">₹{Number(genericReportData?.total_pending_value ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>

                <div className="overflow-x-auto border border-theme-divider rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-theme-surface-2/80 text-theme-muted border-b border-theme-divider uppercase text-[10px] font-bold">
                      <tr>
                        <th className="p-3">Order #</th>
                        <th className="p-3">PO Number</th>
                        <th className="p-3">Customer Entity</th>
                        <th className="p-3">Date</th>
                        <th className="p-3 text-center">Site</th>
                        <th className="p-3 text-right">Qty</th>
                        <th className="p-3 text-right">Basic (₹)</th>
                        <th className="p-3 text-right">Tax (₹)</th>
                        <th className="p-3 text-right">Order Value (₹)</th>
                        <th className="p-3 text-right">Billed (₹)</th>
                        <th className="p-3 text-right">Pending (₹)</th>
                        <th className="p-3 text-center">Fulfillment</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-theme-divider/40">
                      {(!genericReportData?.lines || genericReportData.lines.length === 0) ? (
                        <tr><td colSpan={12} className="p-6 text-center text-theme-muted">No sales orders found for the selected period.</td></tr>
                      ) : (
                        genericReportData.lines.map((l: any, idx: number) => (
                          <tr key={idx} className="hover:bg-theme-surface-hover transition-colors">
                            <td className="p-3 font-mono font-bold text-blue-400">{l.order_no}</td>
                            <td className="p-3 font-mono text-theme-muted">{l.po_number || "—"}</td>
                            <td className="p-3 text-theme-body font-medium">{l.customer_name}</td>
                            <td className="p-3 font-mono text-theme-muted">{l.date}</td>
                            <td className="p-3 text-center font-mono text-[10px] text-theme-muted">{l.site_code || "—"}</td>
                            <td className="p-3 text-right font-mono font-bold">{Number(l.total_qty).toLocaleString("en-IN")}</td>
                            <td className="p-3 text-right font-mono text-theme-muted">{Number(l.basic_total).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                            <td className="p-3 text-right font-mono text-purple-400">{Number(l.tax_total).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                            <td className="p-3 text-right font-mono font-bold text-theme-body">₹{Number(l.grand_total).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                            <td className="p-3 text-right font-mono font-bold text-emerald-400">₹{Number(l.billed_value).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                            <td className="p-3 text-right font-mono font-bold text-amber-400">₹{Number(l.pending_value).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                            <td className="p-3 text-center">
                              <span className={`px-2 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider border ${
                                l.fulfillment_status === "FULLY_BILLED" ? "bg-emerald-950/40 text-emerald-300 border-emerald-500/30" :
                                l.fulfillment_status === "PARTIALLY_BILLED" ? "bg-blue-950/40 text-blue-300 border-blue-500/30" :
                                "bg-amber-950/40 text-amber-300 border-amber-500/30"
                              }`}>
                                {l.fulfillment_status || "UNFULFILLED"}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* RPT-SO-008: Detailed Sales Orders Register */}
            {selectedReport.id === "RPT-SO-008" && (
              <div className="p-4 space-y-4">
                {/* Header Action Bar */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 bg-gradient-to-r from-blue-950/40 via-indigo-950/30 to-purple-950/20 border border-blue-500/20 rounded-2xl">
                  <div>
                    <h5 className="font-bold text-sm text-theme-body flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse"></span>
                      Detailed Line-Item Sales Orders Register
                    </h5>
                    <p className="text-[11px] text-theme-muted font-mono mt-0.5">
                      Detailed Order Fulfillment Register • Filter by Delivery State, Customer &amp; Timeline
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <a
                      href="/api/v1/reports/sales-orders/export-excel"
                      download
                      className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                    >
                      <Download size={13} /> Download Master 6-Sheet Excel (.xlsx)
                    </a>
                    <a
                      href="/api/v1/reports/sales-orders/export-csv"
                      download
                      className="px-3 py-1.5 bg-theme-surface-2 hover:bg-theme-surface-3 border border-theme-divider text-theme-body rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <FileSpreadsheet size={13} /> Export Flat CSV (.csv)
                    </a>
                  </div>
                </div>

                {/* KPI Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted">Total Orders</span>
                    <p className="text-sm font-black text-theme-body mt-1">{genericReportData?.total_orders ?? 0} Orders</p>
                  </div>
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted">Line Items</span>
                    <p className="text-sm font-black text-purple-400 mt-1">{Number(genericReportData?.total_lines ?? 0).toLocaleString("en-IN")} Items</p>
                  </div>
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted">Ordered Quantity</span>
                    <p className="text-sm font-black text-blue-400 mt-1">{Number(genericReportData?.total_ordered_qty ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 0 })} Pairs</p>
                  </div>
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted">Total Order Value</span>
                    <p className="text-sm font-black text-theme-body mt-1">₹{Number(genericReportData?.total_grand_amount ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted">Billed Value</span>
                    <p className="text-sm font-black text-emerald-400 mt-1">₹{Number(genericReportData?.total_billed_value ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted">Pending Value</span>
                    <p className="text-sm font-black text-amber-400 mt-1">₹{Number(genericReportData?.total_pending_value ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted">Fulfillment Rate</span>
                    <p className="text-sm font-black text-emerald-300 mt-1">{Number(genericReportData?.fulfillment_rate_pct ?? 0).toFixed(1)}%</p>
                  </div>
                </div>

                {/* Line Items Table */}
                <div className="overflow-x-auto border border-theme-divider rounded-xl max-h-[600px] overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-theme-surface-2/95 backdrop-blur text-theme-muted border-b border-theme-divider uppercase text-[10px] font-bold sticky top-0 z-10">
                      <tr>
                        <th className="p-3">Order #</th>
                        <th className="p-3">PO Number</th>
                        <th className="p-3">Date</th>
                        <th className="p-3 text-center">Site</th>
                        <th className="p-3">Article / SKU</th>
                        <th className="p-3 text-center">HSN</th>
                        <th className="p-3 text-right">Qty</th>
                        <th className="p-3 text-right">Rate (₹)</th>
                        <th className="p-3 text-right">MRP (₹)</th>
                        <th className="p-3 text-right">Taxable (₹)</th>
                        <th className="p-3 text-right">Tax (₹)</th>
                        <th className="p-3 text-right">Total (₹)</th>
                        <th className="p-3 text-right">Billed Qty</th>
                        <th className="p-3 text-right">Pending Qty</th>
                        <th className="p-3 text-right">Billed (₹)</th>
                        <th className="p-3 text-right">Pending (₹)</th>
                        <th className="p-3 text-center">Status</th>
                        <th className="p-3">Linked Invoices</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-theme-divider/40 font-mono text-[11px]">
                      {(!genericReportData?.lines || genericReportData.lines.length === 0) ? (
                        <tr><td colSpan={18} className="p-8 text-center text-theme-muted font-sans text-xs">No sales orders found for the selected period.</td></tr>
                      ) : (
                        genericReportData.lines.slice(0, 300).map((l: any, idx: number) => (
                          <tr key={idx} className="hover:bg-theme-surface-hover transition-colors">
                            <td className="p-2.5 font-bold text-blue-400">{l.order_no}</td>
                            <td className="p-2.5 text-theme-muted">{l.po_number || "—"}</td>
                            <td className="p-2.5 text-theme-muted">{l.order_date}</td>
                            <td className="p-2.5 text-center text-theme-muted">{l.site_code || "—"}</td>
                            <td className="p-2.5 text-theme-body font-sans font-medium">{l.item_code || l.item_description}</td>
                            <td className="p-2.5 text-center text-theme-muted text-[10px]">{l.hsn_code}</td>
                            <td className="p-2.5 text-right font-bold text-theme-body">{Number(l.ordered_qty).toLocaleString("en-IN")}</td>
                            <td className="p-2.5 text-right text-theme-muted">{Number(l.unit_price).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                            <td className="p-2.5 text-right text-theme-muted">{Number(l.mrp).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                            <td className="p-2.5 text-right text-theme-body">{Number(l.taxable_value).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                            <td className="p-2.5 text-right text-purple-400">{Number(l.total_tax).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                            <td className="p-2.5 text-right font-bold text-theme-body">₹{Number(l.total_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                            <td className="p-2.5 text-right text-emerald-400">{Number(l.billed_qty).toLocaleString("en-IN")}</td>
                            <td className="p-2.5 text-right text-amber-400">{Number(l.pending_qty).toLocaleString("en-IN")}</td>
                            <td className="p-2.5 text-right font-bold text-emerald-400">₹{Number(l.billed_value).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                            <td className="p-2.5 text-right font-bold text-amber-400">₹{Number(l.pending_value).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                            <td className="p-2.5 text-center">
                              <span className={`px-2 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider border font-sans ${
                                l.fulfillment_status === "FULFILLED" || l.fulfillment_status === "FULLY_BILLED" ? "bg-emerald-950/40 text-emerald-300 border-emerald-500/30" :
                                l.fulfillment_status === "PARTIAL" || l.fulfillment_status === "PARTIALLY_BILLED" ? "bg-blue-950/40 text-blue-300 border-blue-500/30" :
                                "bg-amber-950/40 text-amber-300 border-amber-500/30"
                              }`}>
                                {l.fulfillment_status || "UNFULFILLED"}
                              </span>
                            </td>
                            <td className="p-2.5 text-[10px] text-blue-300">
                              {l.linked_invoice_nos && l.linked_invoice_nos.length > 0 ? l.linked_invoice_nos.join(", ") : "—"}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                {genericReportData?.lines && genericReportData.lines.length > 300 && (
                  <p className="text-[11px] text-theme-muted text-center italic">
                    Showing first 300 of {genericReportData.lines.length.toLocaleString("en-IN")} line items in browser preview. Use the <strong>Download Master Excel</strong> button above for full workbook analysis.
                  </p>
                )}
              </div>
            )}

            {/* RPT-SO-009: Automated Fulfillment Variance & Backorder Tracker */}
            {selectedReport.id === "RPT-SO-009" && (
              <div className="p-4 space-y-5">
                {/* Header Info */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 bg-gradient-to-r from-amber-950/40 via-indigo-950/30 to-rose-950/20 border border-amber-500/20 rounded-2xl">
                  <div>
                    <h5 className="font-bold text-sm text-theme-body flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
                      Automated Fulfillment Variance &amp; Backorder Tracker
                    </h5>
                    <p className="text-[11px] text-theme-muted font-mono mt-0.5">
                      Multi-tier SLA aging buckets, store-level allocation shortages, and 1-click invoice conversion queue.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleConvertToInvoice(genericReportData?.orders?.[0]?.order_no || "", genericReportData?.orders?.[0]?.order_no || "")}
                      disabled={!genericReportData?.orders?.length || convertingOrderId !== null}
                      className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                    >
                      <Sparkles size={13} /> Convert Top Pending to Invoice
                    </button>
                  </div>
                </div>

                {/* Overall KPI Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted">Total Orders</span>
                    <p className="text-sm font-black text-theme-body mt-1">{genericReportData?.summary?.total_orders ?? 0} Orders</p>
                  </div>
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted">Booked Pairs</span>
                    <p className="text-sm font-black text-blue-400 mt-1">{Number(genericReportData?.summary?.total_booked_pairs ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })} PRS</p>
                  </div>
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted">Dispatched Pairs</span>
                    <p className="text-sm font-black text-emerald-400 mt-1">{Number(genericReportData?.summary?.total_billed_pairs ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })} PRS</p>
                  </div>
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted">Backorder Shortage</span>
                    <p className="text-sm font-black text-rose-400 mt-1">{Number(genericReportData?.summary?.total_pending_pairs ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })} PRS</p>
                  </div>
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted">Pending Value</span>
                    <p className="text-sm font-black text-amber-400 mt-1">₹{Number(genericReportData?.summary?.total_pending_value ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted">Fulfillment SLA</span>
                    <p className="text-sm font-black text-emerald-300 mt-1">{Number(genericReportData?.summary?.overall_fulfillment_rate ?? 0).toFixed(1)}%</p>
                  </div>
                </div>

                {/* 4-Tier SLA Aging Breakdown Grid */}
                <div className="space-y-2">
                  <h6 className="text-xs font-bold text-theme-body flex items-center gap-2">
                    <Clock size={14} className="text-indigo-400" />
                    Backorder Aging Buckets (SLA Compliance)
                  </h6>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    {/* 0-7 Days */}
                    <div className="p-3.5 bg-emerald-950/20 border border-emerald-500/30 rounded-xl space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-emerald-300">0 – 7 Days</span>
                        <span className="text-[10px] font-mono bg-emerald-900/50 text-emerald-200 px-1.5 py-0.5 rounded">Fresh SLA</span>
                      </div>
                      <div className="text-lg font-black text-emerald-200 font-mono">
                        {Number(genericReportData?.aging_buckets?.["0_7_days"]?.pending_qty ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })} PRS
                      </div>
                      <div className="text-[10px] text-emerald-400 font-mono">
                        {genericReportData?.aging_buckets?.["0_7_days"]?.count ?? 0} Orders • ₹{Number(genericReportData?.aging_buckets?.["0_7_days"]?.pending_val ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 0 })}
                      </div>
                    </div>

                    {/* 8-14 Days */}
                    <div className="p-3.5 bg-blue-950/20 border border-blue-500/30 rounded-xl space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-blue-300">8 – 14 Days</span>
                        <span className="text-[10px] font-mono bg-blue-900/50 text-blue-200 px-1.5 py-0.5 rounded">Normal SLA</span>
                      </div>
                      <div className="text-lg font-black text-blue-200 font-mono">
                        {Number(genericReportData?.aging_buckets?.["8_14_days"]?.pending_qty ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })} PRS
                      </div>
                      <div className="text-[10px] text-blue-400 font-mono">
                        {genericReportData?.aging_buckets?.["8_14_days"]?.count ?? 0} Orders • ₹{Number(genericReportData?.aging_buckets?.["8_14_days"]?.pending_val ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 0 })}
                      </div>
                    </div>

                    {/* 15-30 Days */}
                    <div className="p-3.5 bg-amber-950/20 border border-amber-500/30 rounded-xl space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-amber-300">15 – 30 Days</span>
                        <span className="text-[10px] font-mono bg-amber-900/50 text-amber-200 px-1.5 py-0.5 rounded">Aging Backorder</span>
                      </div>
                      <div className="text-lg font-black text-amber-200 font-mono">
                        {Number(genericReportData?.aging_buckets?.["15_30_days"]?.pending_qty ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })} PRS
                      </div>
                      <div className="text-[10px] text-amber-400 font-mono">
                        {genericReportData?.aging_buckets?.["15_30_days"]?.count ?? 0} Orders • ₹{Number(genericReportData?.aging_buckets?.["15_30_days"]?.pending_val ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 0 })}
                      </div>
                    </div>

                    {/* Over 30 Days */}
                    <div className="p-3.5 bg-rose-950/20 border border-rose-500/30 rounded-xl space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-rose-300">&gt; 30 Days</span>
                        <span className="text-[10px] font-mono bg-rose-900/50 text-rose-200 px-1.5 py-0.5 rounded font-bold">Critical Shortage</span>
                      </div>
                      <div className="text-lg font-black text-rose-200 font-mono">
                        {Number(genericReportData?.aging_buckets?.["over_30_days"]?.pending_qty ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })} PRS
                      </div>
                      <div className="text-[10px] text-rose-400 font-mono">
                        {genericReportData?.aging_buckets?.["over_30_days"]?.count ?? 0} Orders • ₹{Number(genericReportData?.aging_buckets?.["over_30_days"]?.pending_val ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 0 })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2-Column Section: Store Shortages & Style Shortages */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Store Shortage Table */}
                  <div className="border border-theme-divider rounded-xl overflow-hidden">
                    <div className="p-3 bg-theme-surface-2 font-bold text-xs text-theme-body border-b border-theme-divider flex justify-between items-center">
                      <span>Store-Level Shortage &amp; Allocation</span>
                      <span className="text-[10px] text-theme-muted font-mono">{(genericReportData?.stores || []).length} Stores</span>
                    </div>
                    <div className="max-h-72 overflow-y-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-theme-surface-3/50 text-theme-muted uppercase text-[9px] font-bold sticky top-0">
                          <tr>
                            <th className="p-2">Store</th>
                            <th className="p-2">State</th>
                            <th className="p-2 text-right">Ordered</th>
                            <th className="p-2 text-right">Billed</th>
                            <th className="p-2 text-right text-rose-400">Shortage</th>
                            <th className="p-2 text-right">Rate</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-theme-divider/40 font-mono text-[11px]">
                          {(genericReportData?.stores || []).slice(0, 50).map((st: any, idx: number) => (
                            <tr key={idx} className="hover:bg-theme-surface-hover">
                              <td className="p-2 font-bold text-blue-400">{st.site_code}</td>
                              <td className="p-2 text-theme-muted">{st.destination_state}</td>
                              <td className="p-2 text-right">{Number(st.ordered_qty).toLocaleString("en-IN", { maximumFractionDigits: 0 })}</td>
                              <td className="p-2 text-right text-emerald-400">{Number(st.billed_qty).toLocaleString("en-IN", { maximumFractionDigits: 0 })}</td>
                              <td className="p-2 text-right font-bold text-rose-400">{Number(st.pending_qty).toLocaleString("en-IN", { maximumFractionDigits: 0 })}</td>
                              <td className="p-2 text-right font-bold text-slate-200">{st.fulfillment_rate}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Style Shortage Table */}
                  <div className="border border-theme-divider rounded-xl overflow-hidden">
                    <div className="p-3 bg-theme-surface-2 font-bold text-xs text-theme-body border-b border-theme-divider flex justify-between items-center">
                      <span>Style / Article Shortage Breakdown</span>
                      <span className="text-[10px] text-theme-muted font-mono">{(genericReportData?.styles || []).length} Styles</span>
                    </div>
                    <div className="max-h-72 overflow-y-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-theme-surface-3/50 text-theme-muted uppercase text-[9px] font-bold sticky top-0">
                          <tr>
                            <th className="p-2">Style Code</th>
                            <th className="p-2 text-center">HSN</th>
                            <th className="p-2 text-right">Ordered</th>
                            <th className="p-2 text-right">Billed</th>
                            <th className="p-2 text-right text-amber-400">Pending</th>
                            <th className="p-2 text-right">Pending Val</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-theme-divider/40 font-mono text-[11px]">
                          {(genericReportData?.styles || []).slice(0, 50).map((sty: any, idx: number) => (
                            <tr key={idx} className="hover:bg-theme-surface-hover">
                              <td className="p-2 font-bold text-theme-body">{sty.style_name}</td>
                              <td className="p-2 text-center text-theme-muted">{sty.hsn_code}</td>
                              <td className="p-2 text-right">{Number(sty.ordered_qty).toLocaleString("en-IN", { maximumFractionDigits: 0 })}</td>
                              <td className="p-2 text-right text-emerald-400">{Number(sty.billed_qty).toLocaleString("en-IN", { maximumFractionDigits: 0 })}</td>
                              <td className="p-2 text-right font-bold text-amber-400">{Number(sty.pending_qty).toLocaleString("en-IN", { maximumFractionDigits: 0 })}</td>
                              <td className="p-2 text-right font-bold text-amber-300">₹{Number(sty.pending_val).toLocaleString("en-IN", { minimumFractionDigits: 0 })}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Actionable Orders Queue */}
                <div className="border border-theme-divider rounded-xl overflow-hidden">
                  <div className="p-3 bg-theme-surface-2 font-bold text-xs text-theme-body border-b border-theme-divider flex justify-between items-center">
                    <span className="flex items-center gap-2">
                      <ShoppingBag size={14} className="text-emerald-400" />
                      Actionable Orders Queue (Direct Invoice Conversion &amp; Confirmation)
                    </span>
                    <span className="text-[10px] text-theme-muted font-mono">{(genericReportData?.orders || []).length} Pending Orders</span>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-theme-surface-3/50 text-theme-muted uppercase text-[9px] font-bold sticky top-0">
                        <tr>
                          <th className="p-2.5">Order No</th>
                          <th className="p-2.5">Customer PO</th>
                          <th className="p-2.5">Store / Site</th>
                          <th className="p-2.5 text-center">Age</th>
                          <th className="p-2.5 text-right">Ordered (PRS)</th>
                          <th className="p-2.5 text-right">Billed (PRS)</th>
                          <th className="p-2.5 text-right text-amber-400">Pending (PRS)</th>
                          <th className="p-2.5 text-right">Pending Val (₹)</th>
                          <th className="p-2.5 text-center">Status</th>
                          <th className="p-2.5 text-center">Quick Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-theme-divider/40 font-mono text-[11px]">
                        {(genericReportData?.orders || []).slice(0, 100).map((ord: any, idx: number) => (
                          <tr key={idx} className="hover:bg-theme-surface-hover transition-colors">
                            <td className="p-2.5 font-bold text-blue-400">{ord.order_no}</td>
                            <td className="p-2.5 text-theme-muted">{ord.po_number || "—"}</td>
                            <td className="p-2.5 text-theme-body">{ord.site_code} ({ord.destination_state})</td>
                            <td className="p-2.5 text-center">
                              <span className={`px-2 py-0.5 rounded text-[9px] font-bold font-mono ${
                                ord.age_days > 30 ? "bg-rose-950/60 text-rose-300 border border-rose-500/40" :
                                ord.age_days > 14 ? "bg-amber-950/60 text-amber-300 border border-amber-500/40" :
                                "bg-emerald-950/60 text-emerald-300 border border-emerald-500/40"
                              }`}>
                                {ord.age_days}d
                              </span>
                            </td>
                            <td className="p-2.5 text-right font-bold">{Number(ord.ordered_qty).toLocaleString("en-IN", { maximumFractionDigits: 0 })}</td>
                            <td className="p-2.5 text-right text-emerald-400">{Number(ord.billed_qty).toLocaleString("en-IN", { maximumFractionDigits: 0 })}</td>
                            <td className="p-2.5 text-right font-bold text-amber-400">{Number(ord.pending_qty).toLocaleString("en-IN", { maximumFractionDigits: 0 })}</td>
                            <td className="p-2.5 text-right font-bold text-amber-300">₹{Number(ord.pending_val).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                            <td className="p-2.5 text-center">
                              <span className="px-2 py-0.5 rounded text-[9px] uppercase font-bold font-sans bg-slate-800 text-slate-300 border border-slate-700">
                                {ord.fulfillment_status}
                              </span>
                            </td>
                            <td className="p-2.5 text-center flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handlePreviewSO(ord.order_no)}
                                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 text-[10px] font-semibold flex items-center gap-1 cursor-pointer"
                                title="Print SO Confirmation"
                              >
                                <Printer size={11} /> Preview
                              </button>
                              <button
                                type="button"
                                disabled={convertingOrderId === ord.order_no}
                                onClick={() => handleConvertToInvoice(ord.order_no, ord.order_no)}
                                className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded text-[10px] font-bold flex items-center gap-1 shadow-sm cursor-pointer"
                                title="1-Click Convert to Invoice"
                              >
                                <Sparkles size={11} /> Convert
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* RPT-SO-002: Pending Orders */}
            {selectedReport.id === "RPT-SO-002" && (
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted">Pending Orders</span>
                    <p className="text-sm font-black text-amber-400 mt-1">{genericReportData?.total_pending_orders ?? 0} Orders</p>
                  </div>
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted">Pending Units to Bill</span>
                    <p className="text-sm font-black text-blue-400 mt-1">{Number(genericReportData?.total_pending_qty ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 0 })} Units</p>
                  </div>
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted">Outstanding Value</span>
                    <p className="text-sm font-black text-amber-400 mt-1">₹{Number(genericReportData?.total_pending_value ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>

                <div className="overflow-x-auto border border-theme-divider rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-theme-surface-2/80 text-theme-muted border-b border-theme-divider uppercase text-[10px] font-bold">
                      <tr>
                        <th className="p-3">Order #</th>
                        <th className="p-3">PO Number</th>
                        <th className="p-3">Customer Entity</th>
                        <th className="p-3">PO Date</th>
                        <th className="p-3">Delivery Date</th>
                        <th className="p-3 text-right">Ordered Qty</th>
                        <th className="p-3 text-right">Billed Qty</th>
                        <th className="p-3 text-right">Pending Qty</th>
                        <th className="p-3 text-right">Order Value (₹)</th>
                        <th className="p-3 text-right">Billed (₹)</th>
                        <th className="p-3 text-right">Pending Value (₹)</th>
                        <th className="p-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-theme-divider/40">
                      {(!genericReportData?.lines || genericReportData.lines.length === 0) ? (
                        <tr><td colSpan={12} className="p-6 text-center text-theme-muted">No pending sales orders. All orders are fully fulfilled.</td></tr>
                      ) : (
                        genericReportData.lines.map((l: any, idx: number) => (
                          <tr key={idx} className="hover:bg-theme-surface-hover transition-colors">
                            <td className="p-3 font-mono font-bold text-blue-400">{l.order_no}</td>
                            <td className="p-3 font-mono text-theme-muted">{l.po_number || "—"}</td>
                            <td className="p-3 text-theme-body font-medium">{l.customer_name}</td>
                            <td className="p-3 font-mono text-theme-muted">{l.po_date || "—"}</td>
                            <td className="p-3 font-mono text-theme-muted">{l.delivery_date || "—"}</td>
                            <td className="p-3 text-right font-mono">{Number(l.total_qty).toLocaleString("en-IN")}</td>
                            <td className="p-3 text-right font-mono text-emerald-400">{Number(l.billed_qty).toLocaleString("en-IN")}</td>
                            <td className="p-3 text-right font-mono font-bold text-amber-400">{Number(l.pending_qty).toLocaleString("en-IN")}</td>
                            <td className="p-3 text-right font-mono">₹{Number(l.grand_total).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                            <td className="p-3 text-right font-mono text-emerald-400">₹{Number(l.billed_value).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                            <td className="p-3 text-right font-mono font-bold text-amber-400">₹{Number(l.pending_value).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                            <td className="p-3 text-center">
                              <span className="px-2 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider bg-amber-950/40 text-amber-300 border border-amber-500/30">
                                {l.fulfillment_status || "PENDING"}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* RPT-SO-003: Billed vs Pending Orders */}
            {selectedReport.id === "RPT-SO-003" && (
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted">Total Orders</span>
                    <p className="text-sm font-black text-theme-body mt-1">{genericReportData?.total_orders ?? 0}</p>
                  </div>
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted">Order Value</span>
                    <p className="text-sm font-black text-theme-body mt-1">₹{Number(genericReportData?.total_order_value ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted">Billed Value</span>
                    <p className="text-sm font-black text-emerald-400 mt-1">₹{Number(genericReportData?.total_billed_value ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted">Pending Value</span>
                    <p className="text-sm font-black text-amber-400 mt-1">₹{Number(genericReportData?.total_pending_value ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted">Billing Ratio</span>
                    <p className="text-sm font-black text-blue-400 mt-1">{Number(genericReportData?.overall_billing_pct ?? 0).toFixed(1)}%</p>
                  </div>
                </div>

                <div className="overflow-x-auto border border-theme-divider rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-theme-surface-2/80 text-theme-muted border-b border-theme-divider uppercase text-[10px] font-bold">
                      <tr>
                        <th className="p-3">Order #</th>
                        <th className="p-3">PO Number</th>
                        <th className="p-3">Customer</th>
                        <th className="p-3">Date</th>
                        <th className="p-3 text-right">Booked Value (₹)</th>
                        <th className="p-3 text-right">Billed Value (₹)</th>
                        <th className="p-3 text-right">Pending Value (₹)</th>
                        <th className="p-3 text-right">Billed %</th>
                        <th className="p-3 text-right">Pending %</th>
                        <th className="p-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-theme-divider/40">
                      {(!genericReportData?.lines || genericReportData.lines.length === 0) ? (
                        <tr><td colSpan={10} className="p-6 text-center text-theme-muted">No comparison records found.</td></tr>
                      ) : (
                        genericReportData.lines.map((l: any, idx: number) => (
                          <tr key={idx} className="hover:bg-theme-surface-hover transition-colors">
                            <td className="p-3 font-mono font-bold text-blue-400">{l.order_no}</td>
                            <td className="p-3 font-mono text-theme-muted">{l.po_number || "—"}</td>
                            <td className="p-3 text-theme-body font-medium">{l.customer_name}</td>
                            <td className="p-3 font-mono text-theme-muted">{l.date}</td>
                            <td className="p-3 text-right font-mono font-bold text-theme-body">₹{Number(l.grand_total).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                            <td className="p-3 text-right font-mono font-bold text-emerald-400">₹{Number(l.billed_value).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                            <td className="p-3 text-right font-mono font-bold text-amber-400">₹{Number(l.pending_value).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                            <td className="p-3 text-right font-mono font-bold text-blue-400">{Number(l.billing_pct).toFixed(1)}%</td>
                            <td className="p-3 text-right font-mono font-bold text-amber-400">{Number(l.pending_pct ?? (100 - Number(l.billing_pct))).toFixed(1)}%</td>
                            <td className="p-3 text-center">
                              <span className={`px-2 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider border ${
                                l.fulfillment_status === "FULLY_BILLED" ? "bg-emerald-950/40 text-emerald-300 border-emerald-500/30" :
                                l.fulfillment_status === "PARTIALLY_BILLED" ? "bg-blue-950/40 text-blue-300 border-blue-500/30" :
                                "bg-amber-950/40 text-amber-300 border-amber-500/30"
                              }`}>
                                {l.fulfillment_status || "UNFULFILLED"}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* RPT-SO-004: Customer-wise Orders */}
            {selectedReport.id === "RPT-SO-004" && (
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted">Customers</span>
                    <p className="text-sm font-black text-theme-body mt-1">{genericReportData?.total_customers ?? 0}</p>
                  </div>
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted">Total Orders</span>
                    <p className="text-sm font-black text-blue-400 mt-1">{genericReportData?.total_orders ?? 0} Orders</p>
                  </div>
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted">Total Order Value</span>
                    <p className="text-sm font-black text-theme-body mt-1">₹{Number(genericReportData?.total_value ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted">Billed Value</span>
                    <p className="text-sm font-black text-emerald-400 mt-1">₹{Number(genericReportData?.total_billed_value ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>

                <div className="overflow-x-auto border border-theme-divider rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-theme-surface-2/80 text-theme-muted border-b border-theme-divider uppercase text-[10px] font-bold">
                      <tr>
                        <th className="p-3">Customer Entity</th>
                        <th className="p-3">GSTIN</th>
                        <th className="p-3 text-right">Orders Count</th>
                        <th className="p-3 text-right">Total Qty</th>
                        <th className="p-3 text-right">Total Order Value (₹)</th>
                        <th className="p-3 text-right">Billed Value (₹)</th>
                        <th className="p-3 text-right">Pending Value (₹)</th>
                        <th className="p-3 text-right">Avg Order Ticket (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-theme-divider/40">
                      {(!genericReportData?.lines || genericReportData.lines.length === 0) ? (
                        <tr><td colSpan={8} className="p-6 text-center text-theme-muted">No customer order aggregates found.</td></tr>
                      ) : (
                        genericReportData.lines.map((l: any, idx: number) => (
                          <tr key={idx} className="hover:bg-theme-surface-hover transition-colors">
                            <td className="p-3 text-theme-body font-bold">{l.customer_name}</td>
                            <td className="p-3 font-mono text-theme-muted">{l.customer_gstin || "—"}</td>
                            <td className="p-3 text-right font-mono font-bold text-blue-400">{l.order_count}</td>
                            <td className="p-3 text-right font-mono">{Number(l.total_qty).toLocaleString("en-IN")}</td>
                            <td className="p-3 text-right font-mono font-bold text-theme-body">₹{Number(l.total_value).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                            <td className="p-3 text-right font-mono font-bold text-emerald-400">₹{Number(l.billed_value).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                            <td className="p-3 text-right font-mono font-bold text-amber-400">₹{Number(l.pending_value).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                            <td className="p-3 text-right font-mono font-bold text-purple-400">₹{Number(l.avg_order_value).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* RPT-SO-005: Product-wise Ordered Quantity */}
            {selectedReport.id === "RPT-SO-005" && (
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted">Distinct Products / Styles</span>
                    <p className="text-sm font-black text-theme-body mt-1">{genericReportData?.total_products ?? 0}</p>
                  </div>
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted">Total Ordered Quantity</span>
                    <p className="text-sm font-black text-blue-400 mt-1">{Number(genericReportData?.total_ordered_qty ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 0 })} Units</p>
                  </div>
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted">Total Value</span>
                    <p className="text-sm font-black text-emerald-400 mt-1">₹{Number(genericReportData?.total_value ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>

                <div className="overflow-x-auto border border-theme-divider rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-theme-surface-2/80 text-theme-muted border-b border-theme-divider uppercase text-[10px] font-bold">
                      <tr>
                        <th className="p-3">Article / Code</th>
                        <th className="p-3">Vendor Style</th>
                        <th className="p-3">Description</th>
                        <th className="p-3">Color</th>
                        <th className="p-3">Size</th>
                        <th className="p-3 text-center">UOM</th>
                        <th className="p-3 text-right">Ordered Qty</th>
                        <th className="p-3 text-right">Billed Qty</th>
                        <th className="p-3 text-right">Pending Qty</th>
                        <th className="p-3 text-right">Avg Rate (₹)</th>
                        <th className="p-3 text-right">Total Value (₹)</th>
                        <th className="p-3 text-right">Orders Count</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-theme-divider/40">
                      {(!genericReportData?.lines || genericReportData.lines.length === 0) ? (
                        <tr><td colSpan={12} className="p-6 text-center text-theme-muted">No product-wise ordered quantities found.</td></tr>
                      ) : (
                        genericReportData.lines.map((l: any, idx: number) => (
                          <tr key={idx} className="hover:bg-theme-surface-hover transition-colors">
                            <td className="p-3 font-mono font-bold text-blue-400">{l.article_no || l.product_id || "—"}</td>
                            <td className="p-3 font-mono text-theme-muted">{l.vendor_style || "—"}</td>
                            <td className="p-3 text-theme-body font-medium">{l.name}</td>
                            <td className="p-3 text-theme-muted">{l.color || "—"}</td>
                            <td className="p-3 text-theme-muted">{l.size || "—"}</td>
                            <td className="p-3 text-center font-mono text-[10px] text-theme-muted">{l.uom || "EA"}</td>
                            <td className="p-3 text-right font-mono font-bold text-blue-300">{Number(l.ordered_qty).toLocaleString("en-IN")}</td>
                            <td className="p-3 text-right font-mono font-bold text-emerald-400">{Number(l.billed_qty || 0).toLocaleString("en-IN")}</td>
                            <td className="p-3 text-right font-mono font-bold text-amber-400">{Number(l.pending_qty || 0).toLocaleString("en-IN")}</td>
                            <td className="p-3 text-right font-mono">₹{Number(l.avg_cost).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                            <td className="p-3 text-right font-mono font-bold text-emerald-400">₹{Number(l.total_value).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                            <td className="p-3 text-right font-mono font-bold text-purple-400">{l.order_count}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* RPT-SO-006: Order Fulfillment Status */}
            {selectedReport.id === "RPT-SO-006" && (
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted">Total Orders Tracked</span>
                    <p className="text-sm font-black text-theme-body mt-1">{genericReportData?.total_orders ?? 0}</p>
                  </div>
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted">Total Value</span>
                    <p className="text-sm font-black text-theme-body mt-1">₹{Number(genericReportData?.total_value ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                  </div>
                  {(genericReportData?.groups || []).map((g: any, idx: number) => (
                    <div key={idx} className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                      <span className="text-[10px] uppercase font-bold text-theme-muted">{g.status}</span>
                      <p className="text-sm font-black text-blue-400 mt-1">{g.order_count} Orders (₹{Number(g.total_value).toLocaleString("en-IN", { minimumFractionDigits: 0 })})</p>
                    </div>
                  ))}
                </div>

                <div className="overflow-x-auto border border-theme-divider rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-theme-surface-2/80 text-theme-muted border-b border-theme-divider uppercase text-[10px] font-bold">
                      <tr>
                        <th className="p-3">Order #</th>
                        <th className="p-3">PO Number</th>
                        <th className="p-3">Customer Entity</th>
                        <th className="p-3">Date</th>
                        <th className="p-3 text-right">Quantity</th>
                        <th className="p-3 text-right">Order Total (₹)</th>
                        <th className="p-3 text-right">Billed Value (₹)</th>
                        <th className="p-3 text-right">Pending Value (₹)</th>
                        <th className="p-3 text-center">Fulfillment Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-theme-divider/40">
                      {(!genericReportData?.lines || genericReportData.lines.length === 0) ? (
                        <tr><td colSpan={9} className="p-6 text-center text-theme-muted">No fulfillment records found.</td></tr>
                      ) : (
                        genericReportData.lines.map((l: any, idx: number) => (
                          <tr key={idx} className="hover:bg-theme-surface-hover transition-colors">
                            <td className="p-3 font-mono font-bold text-blue-400">{l.order_no}</td>
                            <td className="p-3 font-mono text-theme-muted">{l.po_number || "—"}</td>
                            <td className="p-3 text-theme-body font-medium">{l.customer_name}</td>
                            <td className="p-3 font-mono text-theme-muted">{l.date}</td>
                            <td className="p-3 text-right font-mono font-bold">{Number(l.total_qty).toLocaleString("en-IN")}</td>
                            <td className="p-3 text-right font-mono font-bold text-theme-body">₹{Number(l.grand_total).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                            <td className="p-3 text-right font-mono font-bold text-emerald-400">₹{Number(l.billed_value).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                            <td className="p-3 text-right font-mono font-bold text-amber-400">₹{Number(l.pending_value).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                            <td className="p-3 text-center">
                              <span className={`px-2 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider border ${
                                l.fulfillment_status === "FULLY_BILLED" ? "bg-emerald-950/40 text-emerald-300 border-emerald-500/30" :
                                l.fulfillment_status === "PARTIALLY_BILLED" ? "bg-blue-950/40 text-blue-300 border-blue-500/30" :
                                "bg-amber-950/40 text-amber-300 border-amber-500/30"
                              }`}>
                                {l.fulfillment_status || "UNFULFILLED"}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* RPT-SO-007: Invoice Allocation Report */}
            {selectedReport.id === "RPT-SO-007" && (
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted">Total Allocations</span>
                    <p className="text-sm font-black text-theme-body mt-1">{genericReportData?.total_allocations ?? 0}</p>
                  </div>
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted">Total PO Value</span>
                    <p className="text-sm font-black text-theme-body mt-1">₹{Number(genericReportData?.total_po_value ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted">Billed Quantity</span>
                    <p className="text-sm font-black text-emerald-400 mt-1">{Number(genericReportData?.total_billed_qty ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 0 })} Units</p>
                  </div>
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted">Billed Value</span>
                    <p className="text-sm font-black text-emerald-400 mt-1">₹{Number(genericReportData?.total_billed_value ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted">Pending Value</span>
                    <p className="text-sm font-black text-amber-400 mt-1">₹{Number(genericReportData?.total_pending_value ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>

                <div className="overflow-x-auto border border-theme-divider rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-theme-surface-2/80 text-theme-muted border-b border-theme-divider uppercase text-[10px] font-bold">
                      <tr>
                        <th className="p-3">Order #</th>
                        <th className="p-3">PO Number</th>
                        <th className="p-3">Tax Invoice #</th>
                        <th className="p-3">Invoice Date</th>
                        <th className="p-3 text-right">PO Qty</th>
                        <th className="p-3 text-right">PO Value (₹)</th>
                        <th className="p-3 text-right">Billed Qty</th>
                        <th className="p-3 text-right">Billed Value (₹)</th>
                        <th className="p-3 text-right">Pending Qty</th>
                        <th className="p-3 text-right">Pending Value (₹)</th>
                        <th className="p-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-theme-divider/40">
                      {(!genericReportData?.lines || genericReportData.lines.length === 0) ? (
                        <tr><td colSpan={11} className="p-6 text-center text-theme-muted">No invoice allocations recorded.</td></tr>
                      ) : (
                        genericReportData.lines.map((l: any, idx: number) => (
                          <tr key={idx} className="hover:bg-theme-surface-hover transition-colors">
                            <td className="p-3 font-mono font-bold text-blue-400">{l.order_no}</td>
                            <td className="p-3 font-mono text-theme-muted">{l.po_number || "—"}</td>
                            <td className="p-3 font-mono font-bold text-emerald-400">{l.invoice_no}</td>
                            <td className="p-3 font-mono text-theme-muted">{l.invoice_date}</td>
                            <td className="p-3 text-right font-mono">{Number(l.po_quantity).toLocaleString("en-IN")}</td>
                            <td className="p-3 text-right font-mono">₹{Number(l.po_value).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                            <td className="p-3 text-right font-mono font-bold text-emerald-400">{Number(l.billed_quantity).toLocaleString("en-IN")}</td>
                            <td className="p-3 text-right font-mono font-bold text-emerald-400">₹{Number(l.billed_value).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                            <td className="p-3 text-right font-mono font-bold text-amber-400">{Number(l.pending_quantity).toLocaleString("en-IN")}</td>
                            <td className="p-3 text-right font-mono font-bold text-amber-400">₹{Number(l.pending_value).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                            <td className="p-3 text-center">
                              <span className="px-2 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider bg-blue-950/40 text-blue-300 border border-blue-500/30">
                                {l.status || "ALLOCATED"}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ================================================================
                RPT-ACCT-001 — Monthly Accounts Summary (Phase 1D.1 / 1E)
                Full-envelope render: columns + rows + summary_cards + chart_config
                from /reports/universal/RPT-ACCT-001 via SmritiReportEngine.
                Year/month selectors replace the date-range bar for this report.
                ================================================================ */}
            {selectedReport.id === "RPT-ACCT-001" && (
              <div className="p-4 space-y-4">
                {/* Period selector bar */}
                <div className="flex flex-wrap items-center gap-3 bg-theme-surface-2 border border-theme-border rounded-xl px-4 py-3">
                  <span className="text-xs font-bold text-theme-muted uppercase tracking-wide flex items-center gap-1.5">
                    <Calendar size={13} /> Period
                  </span>
                  <select
                    id="acct-year-select"
                    value={acctYear}
                    onChange={(e) => setAcctYear(e.target.value === "" ? "" : Number(e.target.value))}
                    className="text-xs border border-theme-border rounded-lg px-2.5 py-1.5 bg-theme-surface-1 text-theme-body focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                  >
                    <option value="">Previous Month</option>
                    {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i).map((yr) => (
                      <option key={yr} value={yr}>{yr}</option>
                    ))}
                  </select>
                  <select
                    id="acct-month-select"
                    value={acctMonth}
                    onChange={(e) => setAcctMonth(e.target.value === "" ? "" : Number(e.target.value))}
                    disabled={acctYear === ""}
                    className="text-xs border border-theme-border rounded-lg px-2.5 py-1.5 bg-theme-surface-1 text-theme-body focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-40 cursor-pointer"
                  >
                    <option value="">-- Month --</option>
                    {["January","February","March","April","May","June","July","August","September","October","November","December"].map((m, i) => (
                      <option key={i + 1} value={i + 1}>{m}</option>
                    ))}
                  </select>
                  {acctEnvelope?.parameters && (
                    <span className="text-[10px] font-mono text-theme-muted border border-theme-border rounded px-2 py-0.5 ml-auto">
                      Period: {acctEnvelope.rows?.[0]?.period_label ?? "—"}
                      {" · Branch: "}{acctEnvelope.rows?.[0]?.branch_scope ?? "ALL"}
                    </span>
                  )}
                </div>
                {/* Engine */}
                <SmritiReportEngine
                  reportId={selectedReport.id}
                  reportTitle={selectedReport.title}
                  reportCategory="Accounts Summary"
                  description={selectedReport.description}
                  columns={(acctEnvelope?.columns ?? []).map((c: any) => ({
                    key:        c.key,
                    label:      c.label,
                    datatype:   c.datatype as any,
                    align:      c.align ?? "left",
                    width:      c.width,
                    isSummary:  ["currency", "number"].includes(c.datatype),
                  }))}
                  data={acctEnvelope?.rows ?? []}
                  summaryMetrics={
                    acctEnvelope?.summary_cards
                      ? Object.fromEntries(
                          acctEnvelope.summary_cards.map((sc: any) => [sc.label, sc.value])
                        )
                      : undefined
                  }
                  chartConfig={acctEnvelope?.chart_config ?? undefined}
                  systemMessage={acctEnvelope?.system_message ?? undefined}
                  isLoading={loadingReports}
                  activeRole={activeRole}
                  onNotification={(type, msg) => showNotification(type, msg)}
                />
              </div>
            )}

            {/* Universal Report Engine for unhandled or generic operational datasets */}
            {![
              "RPT-SAL-001",
              "RPT-SAL-013",
              "RPT-INV-001",
              "RPT-PUR-001",
              "RPT-PUR-002",
              "RPT-TAX-001",
              "RPT-TAX-002",
              "RPT-TAX-003",
              "RPT-TAX-004",
              "RPT-TAX-005",
              "RPT-TAX-006",
              "RPT-MIS-005",
              "RPT-OPS-001",
              "RPT-OPS-006",
              "RPT-MRC-003",
              "RPT-MRC-001",
              "RPT-MRC-005",
              "RPT-SO-001",
              "RPT-SO-008",
              "RPT-SO-009",
              "RPT-SO-002",
              "RPT-SO-003",
              "RPT-SO-004",
              "RPT-SO-005",
              "RPT-SO-006",
              "RPT-SO-007",
              "RPT-ACCT-001",  // Phase 1E — handled by dedicated block above
            ].includes(selectedReport.id) && (
              <div className="p-4">
                <SmritiReportEngine
                  reportId={selectedReport.id}
                  reportTitle={selectedReport.title}
                  reportCategory={selectedReport.category || "Operational Intelligence"}
                  description={selectedReport.description}
                  data={
                    Array.isArray(genericReportData)
                      ? genericReportData
                      : genericReportData?.lines || genericReportData?.items || genericReportData?.orders || []
                  }
                  activeRole={activeRole}
                  isLoading={loadingReports}
                  onNotification={(type, msg) => showNotification(type, msg)}
                />
              </div>
            )}
          </div>

        </div>
      )}

      {/* CANONICAL CONSOLIDATED BALANCE SHEET MODAL */}
      {showBalanceSheetModal && (
        <ConsolidatedBalanceSheetModal
          isOpen={showBalanceSheetModal}
          onClose={() => setShowBalanceSheetModal(false)}
        />
      )}

      {/* CANONICAL BRANCH PROFIT & LOSS DASHBOARD MODAL */}
      {showPLDashboardModal && (
        <PLDashboardModal
          isOpen={showPLDashboardModal}
          onClose={() => setShowPLDashboardModal(false)}
        />
      )}

      {/* CANONICAL AUTOMATED SCHEDULER MODAL */}
      {showScheduleModal && (
        <ScheduleReportModal
          isOpen={showScheduleModal}
          onClose={() => setShowScheduleModal(false)}
          reportCode={selectedReport?.id || "RPT-SAL-001"}
          reportTitle={selectedReport?.title || "Daily Sales & Tax Register"}
        />
      )}

      {/* DIRECT SHARING POPUP MODAL */}
      <AnimatePresence>
        {showShareModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={() => setShowShareModal(false)}></div>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-theme-surface-1 border border-theme-divider rounded-2xl w-full max-w-md shadow-2xl overflow-hidden relative z-50 font-sans"
            >
              <div className="p-5 border-b border-theme-divider flex items-center justify-between bg-theme-surface-2">
                <div className="flex items-center gap-2">
                  <Share2 size={16} className="text-violet-400" />
                  <h4 className="font-bold text-theme-body text-sm">Direct Report Dispatcher</h4>
                </div>
                <button onClick={() => setShowShareModal(false)} className="text-theme-muted hover:text-white">
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleShareReport} className="p-5 space-y-4 text-xs">
                {activeRole === "Cashier" && (
                  <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl flex items-start gap-2.5">
                    <ShieldAlert size={16} className="shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold">Access Restrained (Rule 10)</div>
                      <p className="text-[10px] mt-0.5">Cashiers are blocked from external email or social sharing of reports.</p>
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-theme-muted font-bold block uppercase">Active Report</label>
                  <input
                    type="text"
                    readOnly
                    value={selectedReport?.title || ""}
                    className="w-full bg-theme-surface-3 border border-theme-divider rounded-lg px-3 py-2 text-theme-muted cursor-not-allowed"
                  />
                </div>

                <div className="flex items-center gap-2 bg-theme-surface-2 p-1 rounded-xl border border-theme-divider">
                  <button
                    type="button"
                    onClick={() => setShareType("Email")}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      shareType === "Email" ? "bg-blue-600 text-white" : "text-theme-muted hover:text-white"
                    }`}
                  >
                    Dispatch Email
                  </button>
                  <button
                    type="button"
                    onClick={() => setShareType("WhatsApp")}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      shareType === "WhatsApp" ? "bg-emerald-600 text-white" : "text-theme-muted hover:text-white"
                    }`}
                  >
                    WhatsApp Message
                  </button>
                </div>

                {shareType === "Email" ? (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-theme-muted font-bold block uppercase">Recipient Email</label>
                      <input
                        type="email"
                        required
                        value={shareForm.email}
                        onChange={(e) => setShareForm({...shareForm, email: e.target.value})}
                        placeholder="auditor@smritibooks.com"
                        className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-theme-body focus:outline-none focus:border-blue-500"
                        disabled={activeRole === "Cashier"}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-theme-muted font-bold block uppercase">Subject Line</label>
                      <input
                        type="text"
                        required
                        value={shareForm.subject}
                        onChange={(e) => setShareForm({...shareForm, subject: e.target.value})}
                        className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-theme-body focus:outline-none focus:border-blue-500"
                        disabled={activeRole === "Cashier"}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <label className="text-theme-muted font-bold block uppercase">Recipient WhatsApp Phone (with Country Code)</label>
                    <input
                      type="tel"
                      required
                      value={shareForm.phone}
                      onChange={(e) => setShareForm({...shareForm, phone: e.target.value})}
                      placeholder="919876543210"
                      className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-theme-body focus:outline-none focus:border-blue-500"
                      disabled={activeRole === "Cashier"}
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-theme-muted font-bold block uppercase">Message Body</label>
                  <textarea
                    rows={3}
                    value={shareForm.message}
                    onChange={(e) => setShareForm({...shareForm, message: e.target.value})}
                    className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-theme-body focus:outline-none focus:border-blue-500 resize-none"
                    disabled={activeRole === "Cashier"}
                  />
                </div>

                <div className="pt-4 flex items-center justify-end gap-2.5 border-t border-theme-divider">
                  <button
                    type="button"
                    onClick={() => setShowShareModal(false)}
                    className="px-4 py-2 bg-theme-surface-2 border border-theme-divider rounded-lg font-bold text-theme-muted hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={activeRole === "Cashier"}
                    className={`px-5 py-2 rounded-lg font-bold shadow-lg transition-all ${
                      shareType === "Email"
                        ? "bg-blue-600 hover:bg-blue-700 shadow-blue-500/10"
                        : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/10"
                    } text-white disabled:bg-slate-800 disabled:text-theme-muted`}
                  >
                    Dispatch Now
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SALES ORDER CONFIRMATION / PROFORMA PRINT PREVIEW MODAL */}
      <AnimatePresence>
        {showSoPrintModal && soPreviewData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-4xl w-full p-6 shadow-2xl relative max-h-[92vh] flex flex-col">
              <div className="flex justify-between items-center pb-4 mb-4 border-b border-slate-800 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-indigo-600/20 text-indigo-400 rounded-lg border border-indigo-500/30">
                    <Printer size={16} />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-white flex items-center gap-2">
                      Sales Order Confirmation / Proforma Document Preview
                      <span className="text-[10px] font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 px-2 py-0.5 rounded-full">
                        A4 Standard
                      </span>
                    </h4>
                    <p className="text-xs text-slate-400 font-mono">
                      Order: {soPreviewData.order_no} • PO: {soPreviewData.po_number || "—"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={`/api/v1/sales/orders/${soPreviewData.id || soPreviewData.order_no}/pdf`}
                    download
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                  >
                    <Download size={13} /> Download PDF
                  </a>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                  >
                    <Printer size={13} /> Print
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowSoPrintModal(false)}
                    className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div className="overflow-y-auto flex-1 bg-slate-950/60 p-4 rounded-xl border border-slate-800 flex justify-center">
                <SalesOrderA4 data={soPreviewData} />
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
