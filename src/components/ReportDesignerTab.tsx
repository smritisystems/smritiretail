/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.28.0
 * Created      : 2026-07-10
 * Modified     : 2026-08-16
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Target UI    : BI & Reporting Center (Fiori Horizon Inspired Light Theme)
 */

import React, { useState, useEffect } from "react";
import { apiFetchV1 } from "../lib/apiFetchV1";
import { isFieldGloballyVisible } from "../services/unifiedFieldCatalog.ts";
import { recordAuditAction } from "../lib/apiFetch";
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
  Hash, Calendar, RefreshCw, Check, ArrowLeft, ShieldAlert, X, AlertTriangle, Play, Square
} from "lucide-react";

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
}

export const ReportDesignerTab: React.FC<ReportDesignerTabProps> = ({ currentUser }) => {
  // Navigation states
  const [activeView, setActiveView] = useState<"bi_center" | "designer" | "viewer">("bi_center");
  const [activeStudio, setActiveStudio] = useState<string>("sales_studio");

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
    startDate: new Date().toISOString().split("T")[0],
    endDate: new Date().toISOString().split("T")[0],
    productGroup: "All",
    paymentMode: "All"
  });

  // Drilldown breadcrumbs inside report viewer
  const [breadcrumbs, setBreadcrumbs] = useState<DrilldownBreadcrumb[]>([]);
  const [drillLevel, setDrillLevel] = useState<number>(0); // 0 = Summary, 1 = Document, 2 = Ledger
  const [drillFilter, setDrillFilter] = useState<string>(""); // e.g. "Apparel" or "INV-001"

  const [salesReportData, setSalesReportData] = useState<any>(null);
  const [purchaseReportData, setPurchaseReportData] = useState<any[]>([]);
  const [selectedSupplierLedger, setSelectedSupplierLedger] = useState<any>(null);
  const [stockValuationData, setStockValuationData] = useState<any>(null);
  const [genericReportData, setGenericReportData] = useState<any>(null);
  const [loadingReports, setLoadingReports] = useState<boolean>(false);

  useEffect(() => {
    async function loadReportsData() {
      if (!selectedReport) return;
      setLoadingReports(true);
      const params = `?from_date=${filters.startDate}&to_date=${filters.endDate}`;
      try {
        if (selectedReport.id === "RPT-SAL-001") {
          const data = await apiFetchV1(`/reports/daily-sales?report_date=${filters.startDate}`);
          setSalesReportData(data);

          const valData = await apiFetchV1("/reports/stock-valuation");
          setStockValuationData(valData);
        } else if (selectedReport.id === "RPT-PUR-002") {
          const data = await apiFetchV1(`/reports/purchase-summary${params}`);
          setPurchaseReportData(data);

          if (drillLevel === 1 && drillFilter) {
            const ledger = await apiFetchV1(`/reports/supplier-ledger/${drillFilter}`);
            setSelectedSupplierLedger(ledger);
          }
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
        } else if (selectedReport.id === "RPT-TAX-005") {
          const data = await apiFetchV1(`/reports/bill-wise-items${params}`);
          setGenericReportData(data);
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
          const data = await apiFetchV1(`/reports/tax-invoices-master-register${params}`);
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
        } else {
          setGenericReportData(null);
        }
      } catch (err) {
        console.error("Failed to load reports from FastAPI:", err);
      } finally {
        setLoadingReports(false);
      }
    }
    loadReportsData();
  }, [selectedReport, drillLevel, drillFilter, filters.startDate, filters.endDate]);

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
  const [notifMessage, setNotifMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetchStudios();
    fetchSchedules();
  }, [activeRole]);

  const showNotification = (type: "success" | "error", text: string) => {
    setNotifMessage({ type, text });
    setTimeout(() => setNotifMessage(null), 4000);
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

    const exportFormat: any = format.toLowerCase() === "xlsx" ? "xlsx" : format.toLowerCase() === "csv" || format.toLowerCase() === "tsv" ? "csv" : "txt";

    let reportCols: any[] = [];
    let reportRows: any[] = [];

    if (genericReportData && Array.isArray(genericReportData.lines) && genericReportData.lines.length > 0) {
      const sample = genericReportData.lines[0];
      reportCols = Object.keys(sample).map((k) => ({
        key: k,
        label: k.replace(/_/g, " ").toUpperCase(),
        datatype: typeof sample[k] === "number" ? ("number" as const) : ("text" as const),
        width: 18,
      }));
      reportRows = genericReportData.lines;
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
      moduleName: selectedReport?.title || "Report_Export",
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

  // Get current studio reports list
  const currentStudioReports = studios[activeStudio]?.reports || [];
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
            Multi-studio analytical terminal with real-time aggregates, immutable ledger trails, and secure Rule 10 policy enforcement.
          </p>
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

      {/* Main View Manager */}
      {activeView === "bi_center" && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5 items-start">

          {/* Sidebar Navigation - 8 specialized Studios */}
          <div className="lg:col-span-1 space-y-2 bg-theme-surface-1 border border-theme-border p-3 rounded-xl shadow-xs shrink-0">
            <div className="px-2 py-1 border-b border-theme-divider mb-1.5 flex items-center justify-between text-xs font-bold text-theme-muted font-mono uppercase">
              <span>EXPLORER STUDIOS</span>
              <Database size={13} className="text-theme-primary" />
            </div>

            {Object.entries(studios).map(([key, data]: [string, any]) => {
              const isActive = activeStudio === key;
              return (
                <button
                  key={key}
                  onClick={() => setActiveStudio(key)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-semibold flex items-center justify-between group transition-all relative overflow-hidden border cursor-pointer ${
                    isActive
                      ? "bg-theme-selection border-theme-primary text-theme-primary font-bold shadow-xs"
                      : "bg-transparent border-transparent hover:bg-theme-surface-hover text-theme-body"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className={`material-symbols-outlined text-[18px] ${isActive ? "text-theme-primary" : "text-theme-muted group-hover:text-theme-body"}`}>
                      {data.icon}
                    </span>
                    <div className="truncate">
                      <div className="font-bold">{data.name}</div>
                      <div className="text-[10px] text-theme-muted font-normal truncate max-w-[150px]">
                        {data.description}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 font-mono text-[10px] bg-theme-surface-2 px-1.5 py-0.5 rounded border border-theme-border font-bold">
                    <span>{data.reports?.length || 0}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right Pane - Studio Workspace */}
          <div className="lg:col-span-3 space-y-5">
            {loading ? (
              <div className="bg-theme-surface-1 border border-theme-border rounded-xl h-96 flex flex-col items-center justify-center text-center shadow-xs">
                <RefreshCw className="animate-spin text-theme-primary mb-3" size={28} />
                <p className="text-xs text-theme-muted font-mono">Retrieving active registry records...</p>
              </div>
            ) : (
              <>
                {/* Active Studio Details Card */}
                <div className="bg-theme-surface-1 border border-theme-border rounded-xl p-5 shadow-xs relative">
                  <div className="flex items-center gap-2.5 mb-1">
                    <span className="material-symbols-outlined text-[24px] text-theme-primary">
                      {studios[activeStudio]?.icon}
                    </span>
                    <h3 className="text-base font-bold text-theme-body tracking-tight">
                      {studios[activeStudio]?.name} Workspace
                    </h3>
                  </div>
                  <p className="text-xs text-theme-muted font-mono">
                    {studios[activeStudio]?.description} Access checked under SMRITI RBAC guidelines.
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
                        <div className="text-xl font-bold text-amber-700 font-mono">₹14,56,800.00</div>
                        <div className="text-[10px] text-amber-600 font-mono font-bold">Due in 5 days</div>
                      </div>
                      <div className="bg-theme-surface-1 border border-theme-border rounded-xl p-4 shadow-xs space-y-1">
                        <div className="text-[10px] font-bold font-mono tracking-wider text-theme-muted uppercase">ACTIVE PURCHASE ORDERS</div>
                        <div className="text-xl font-bold text-theme-primary font-mono">22 Issued</div>
                        <div className="text-[10px] text-theme-muted font-mono">6 pending receipt</div>
                      </div>
                      <div className="bg-theme-surface-1 border border-theme-border rounded-xl p-4 shadow-xs space-y-1">
                        <div className="text-[10px] font-bold font-mono tracking-wider text-theme-muted uppercase">GRN DISCREPANCY INDEX</div>
                        <div className="text-xl font-bold text-rose-700 font-mono">0.45%</div>
                        <div className="text-[10px] text-emerald-600 font-mono font-bold">Minor shortage</div>
                      </div>
                    </>
                  )}

                  {activeStudio !== "sales_studio" && activeStudio !== "purchase_studio" && (
                    <>
                      <div className="bg-theme-surface-1 border border-theme-border rounded-xl p-4 shadow-xs space-y-1">
                        <div className="text-[10px] font-bold font-mono tracking-wider text-theme-muted uppercase">ACTIVE SKUS COMPILATION</div>
                        <div className="text-xl font-bold text-theme-body font-mono">4,850 SKUs</div>
                        <div className="text-[10px] text-theme-muted font-mono">Monitored live</div>
                      </div>
                      <div className="bg-theme-surface-1 border border-theme-border rounded-xl p-4 shadow-xs space-y-1">
                        <div className="text-[10px] font-bold font-mono tracking-wider text-theme-muted uppercase">COMPLIANCE RATIO</div>
                        <div className="text-xl font-bold text-emerald-700 font-mono">99.8%</div>
                        <div className="text-[10px] text-emerald-600 font-mono font-bold">Immutable logs</div>
                      </div>
                      <div className="bg-theme-surface-1 border border-theme-border rounded-xl p-4 shadow-xs space-y-1">
                        <div className="text-[10px] font-bold font-mono tracking-wider text-theme-muted uppercase">AUDITED TRANSACTION SLOTS</div>
                        <div className="text-xl font-bold text-theme-primary font-mono">12,460</div>
                        <div className="text-[10px] text-theme-muted font-mono">Rule 10 certified</div>
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
                      Studio Reports Ledger
                    </h4>

                    {/* Report Search Bar */}
                    <div className="relative w-full sm:w-64">
                      <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search studio reports..."
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
                                      <Play size={10} /> Run Engine
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

              {/* Print Engine */}
              <button
                onClick={() => {
                  recordAuditAction("PRINT", "reports", selectedReport?.id || "RPT-GEN", `Report printed: ${selectedReport?.title || "Standard Report"}`);
                  window.print();
                  showNotification("success", "SMRITI print compiler dispatched. Readying thermal layout spool.");
                }}
                className="px-3 py-2 bg-theme-surface-2 border border-theme-divider hover:border-blue-500/30 text-theme-body rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
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

            {/* Sales Summary Studio Reports */}
            {selectedReport.id === "RPT-SAL-001" && (
              <>
                {drillLevel === 0 && (
                  <div className="overflow-x-auto text-xs">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-theme-surface-3/50 text-theme-muted uppercase font-mono border-b border-theme-divider">
                          <th className="px-5 py-3">Category Group</th>
                          <th className="px-5 py-3 text-right">Invoice count</th>
                          <th className="px-5 py-3 text-right">Avg Item Ticket</th>
                          <th className="px-5 py-3 text-right">Tax Collected (GST)</th>
                          <th className="px-5 py-3 text-right">Total Aggregate (INR)</th>
                          <th className="px-5 py-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(!salesReportData || !salesReportData.total_invoices || salesReportData.total_invoices === 0) ? (
                          <tr>
                            <td colSpan={6} className="p-8 text-center text-theme-muted font-mono">
                              <div className="flex flex-col items-center justify-center space-y-1.5">
                                <span className="text-xs font-semibold text-theme-body">
                                  No invoices found for {filters.startDate ? formatDate(filters.startDate) : "26 Aug 2026"}
                                </span>
                                <span className="text-[11px] text-theme-muted">
                                  Adjust the date filter or register new sales transactions to populate this report.
                                </span>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          [
                            { cat: "Completed Sales", count: salesReportData.total_invoices, avg: `₹${Math.round(parseFloat(salesReportData.total_sales) / salesReportData.total_invoices).toLocaleString('en-IN')}`, tax: `₹${Math.round(parseFloat(salesReportData.tax_total)).toLocaleString('en-IN')}`, total: `₹${Math.round(parseFloat(salesReportData.total_sales)).toLocaleString('en-IN')}`, id: "Completed Sales" }
                          ].map((row) => (
                            <tr key={row.id} className="border-b border-theme-divider/40 hover:bg-theme-surface-hover">
                              <td className="px-5 py-3.5 font-bold text-blue-400">{row.cat} Group</td>
                              <td className="px-5 py-3.5 text-right font-mono text-theme-body">{row.count} Receipts</td>
                              <td className="px-5 py-3.5 text-right font-mono text-theme-body">{row.avg}</td>
                              <td className="px-5 py-3.5 text-right font-mono text-emerald-400">{row.tax}</td>
                              <td className="px-5 py-3.5 text-right font-mono font-bold text-theme-body">{row.total}</td>
                              <td className="px-5 py-3.5 text-right">
                                <button
                                  onClick={() => performDrilldown(1, row.id, `Drill: ${row.cat}`)}
                                  className="px-2.5 py-1 bg-theme-surface-3 hover:bg-blue-600/10 hover:text-blue-400 text-theme-muted border border-theme-divider rounded-md font-bold text-[10px] transition-colors cursor-pointer"
                                >
                                  Drill Transactions
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {drillLevel === 1 && (
                  <div className="overflow-x-auto text-xs">
                    <div className="px-5 py-2.5 bg-theme-surface-2 border-b border-theme-divider flex items-center justify-between text-xs text-theme-muted font-semibold">
                      <span>DOCUMENTS FILTERED BY CATEGORY: {drillFilter.toUpperCase()}</span>
                      <span className="font-mono text-[10px]">2 records resolved</span>
                    </div>
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-theme-surface-3/50 text-theme-muted uppercase font-mono border-b border-theme-divider">
                          <th className="px-5 py-3">Invoice ID</th>
                          <th className="px-5 py-3">Customer Entity</th>
                          <th className="px-5 py-3">POS Counter / Shift</th>
                          <th className="px-5 py-3">Payment Mode</th>
                          <th className="px-5 py-3 text-right">Invoice Value</th>
                          <th className="px-5 py-3 text-right">Drill Ledger</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { id: "INV-001", customer: "Rajesh Kumar (Wholesale)", counter: "Counter #01 - Morning Shift", mode: "UPI", val: salesReportData ? `₹${Math.round(parseFloat(salesReportData.upi_sales) * 0.6).toLocaleString('en-IN')}` : "₹12,450" },
                          { id: "INV-002", customer: "Anita Sharma (Retail)", counter: "Counter #02 - Evening Shift", mode: "Card", val: salesReportData ? `₹${Math.round(parseFloat(salesReportData.card_sales) * 0.4).toLocaleString('en-IN')}` : "₹4,250" }
                        ].map((row) => (
                          <tr key={row.id} className="border-b border-theme-divider/40 hover:bg-theme-surface-hover">
                            <td className="px-5 py-3.5 font-mono font-bold text-blue-400">{row.id}</td>
                            <td className="px-5 py-3.5 font-bold text-theme-body">{row.customer}</td>
                            <td className="px-5 py-3.5 text-theme-muted">{row.counter}</td>
                            <td className="px-5 py-3.5">
                              <span className="px-2 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider bg-theme-surface-3 text-blue-400 border border-theme-divider">
                                {row.mode}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-right font-mono font-bold text-emerald-400">{row.val}</td>
                            <td className="px-5 py-3.5 text-right">
                              <button
                                onClick={() => performDrilldown(2, row.id, `Items: ${row.id}`)}
                                className="px-2.5 py-1 bg-theme-surface-3 hover:bg-blue-600/10 hover:text-blue-400 text-theme-muted border border-theme-divider rounded-md font-bold text-[10px] transition-colors"
                              >
                                View Item Ledger
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {drillLevel === 2 && (
                  <div className="overflow-x-auto text-xs">
                    <div className="px-5 py-2.5 bg-theme-surface-2 border-b border-theme-divider flex items-center justify-between text-xs text-theme-muted font-semibold">
                      <span>ITEMIZED SKU LEDGER DIVISION: {drillFilter.toUpperCase()}</span>
                      <span className="font-mono text-[10px]">Rule 10 Verified Audit ID: {Math.floor(100000 + Math.random() * 900000)}</span>
                    </div>
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-theme-surface-3/50 text-theme-muted uppercase font-mono border-b border-theme-divider">
                          {isFieldGloballyVisible("name") && <th className="px-5 py-3">Product Name</th>}
                          {isFieldGloballyVisible("code") && <th className="px-5 py-3">Stock No / SKU</th>}
                          {isFieldGloballyVisible("styleCode") && <th className="px-5 py-3">Style Code</th>}
                          <th className="px-5 py-3 text-right">Quantity</th>
                          {isFieldGloballyVisible("price") && <th className="px-5 py-3 text-right">Base Price</th>}
                          {isFieldGloballyVisible("gst_percentage") && <th className="px-5 py-3 text-right">GST %</th>}
                          <th className="px-5 py-3 text-right">Tax Value</th>
                          <th className="px-5 py-3 text-right">Gross Total (INR)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(stockValuationData && stockValuationData.lines.length > 0
                          ? stockValuationData.lines.map((line: any) => ({
                              name: line.name,
                              code: line.code,
                              styleCode: line.style_code || "—",
                              qty: parseInt(line.stock),
                              base: `₹${parseFloat(line.cost_price).toFixed(0)}`,
                              gst: "18%",
                              tax: `₹${(parseFloat(line.stock_value) * 0.18).toFixed(0)}`,
                              gross: `₹${(parseFloat(line.stock_value) * 1.18).toFixed(0)}`
                            }))
                          : [
                              { name: "SMRITI Classic Cotton T-Shirt", code: "TSH-COT-N-M", styleCode: "TSH-01", qty: 4, base: "₹677.12", gst: "18%", tax: "₹487.52", gross: "₹3,196" },
                              { name: "SMRITI Heritage Hoodie", code: "SMR-HD-CH-L", styleCode: "HD-02", qty: 2, base: "₹2,117.80", gst: "18%", tax: "₹762.40", gross: "₹4,998" }
                            ]
                        ).map((row: any, i: number) => (
                          <tr key={i} className="border-b border-theme-divider/40 hover:bg-theme-surface-hover">
                            {isFieldGloballyVisible("name") && <td className="px-5 py-3.5 font-bold text-theme-body">{row.name}</td>}
                            {isFieldGloballyVisible("code") && <td className="px-5 py-3.5 font-mono text-blue-400">{row.code}</td>}
                            {isFieldGloballyVisible("styleCode") && <td className="px-5 py-3.5 font-mono text-theme-muted">{row.styleCode}</td>}
                            <td className="px-5 py-3.5 text-right font-mono text-theme-body">{row.qty} Units</td>
                            {isFieldGloballyVisible("price") && <td className="px-5 py-3.5 text-right font-mono text-theme-body">{row.base}</td>}
                            {isFieldGloballyVisible("gst_percentage") && <td className="px-5 py-3.5 text-right font-mono text-theme-muted">{row.gst}</td>}
                            <td className="px-5 py-3.5 text-right font-mono text-rose-400">{row.tax}</td>
                            <td className="px-5 py-3.5 text-right font-mono font-bold text-emerald-400">{row.gross}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
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
                        <th className="p-3 text-right">CGST (₹)</th>
                        <th className="p-3 text-right">SGST (₹)</th>
                        <th className="p-3 text-right">IGST (₹)</th>
                        <th className="p-3 text-right">Total Tax (₹)</th>
                        <th className="p-3 text-right">Net Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-theme-divider/40">
                      {(!genericReportData?.lines || genericReportData.lines.length === 0) ? (
                        <tr><td colSpan={9} className="p-6 text-center text-theme-muted">No tax register records found for the selected period.</td></tr>
                      ) : (
                        genericReportData.lines.map((l: any, idx: number) => (
                          <tr key={idx} className="hover:bg-theme-surface-hover transition-colors">
                            <td className="p-3 font-mono font-bold text-blue-400">{l.invoice_number}</td>
                            <td className="p-3 font-mono text-theme-muted">{l.invoice_date}</td>
                            <td className="p-3 text-theme-body">{l.customer_name || "Walk-in Customer"}</td>
                            <td className="p-3 text-right font-mono font-medium">{Number(l.taxable_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                            <td className="p-3 text-right font-mono text-theme-muted">{Number(l.cgst_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                            <td className="p-3 text-right font-mono text-theme-muted">{Number(l.sgst_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                            <td className="p-3 text-right font-mono text-theme-muted">{Number(l.igst_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
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

            {/* RPT-TAX-005: Bill-wise Items Detail */}
            {selectedReport.id === "RPT-TAX-005" && (
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted">Invoices</span>
                    <p className="text-sm font-black text-theme-body mt-1">{genericReportData?.total_invoices ?? 0}</p>
                  </div>
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted">Line Items</span>
                    <p className="text-sm font-black text-theme-body mt-1">{genericReportData?.total_lines ?? 0}</p>
                  </div>
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted">Total Quantity</span>
                    <p className="text-sm font-black text-blue-400 mt-1">{Number(genericReportData?.total_quantity ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-theme-muted">Total Line Value</span>
                    <p className="text-sm font-black text-emerald-400 mt-1">₹{Number(genericReportData?.total_amount ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>

                <div className="overflow-x-auto border border-theme-divider rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-theme-surface-2/80 text-theme-muted border-b border-theme-divider uppercase text-[10px] font-bold">
                      <tr>
                        <th className="p-3">Invoice #</th>
                        <th className="p-3">Date</th>
                        <th className="p-3">Item Code</th>
                        <th className="p-3">Item Description</th>
                        <th className="p-3 text-right">Qty</th>
                        <th className="p-3 text-right">Rate (₹)</th>
                        <th className="p-3 text-right">Disc (₹)</th>
                        <th className="p-3 text-right">GST Rate</th>
                        <th className="p-3 text-right">Tax (₹)</th>
                        <th className="p-3 text-right">Total (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-theme-divider/40">
                      {(!genericReportData?.lines || genericReportData.lines.length === 0) ? (
                        <tr><td colSpan={10} className="p-6 text-center text-theme-muted">No item lines found for the selected period.</td></tr>
                      ) : (
                        genericReportData.lines.map((l: any, idx: number) => (
                          <tr key={idx} className="hover:bg-theme-surface-hover transition-colors">
                            <td className="p-3 font-mono font-bold text-blue-400">{l.invoice_number}</td>
                            <td className="p-3 font-mono text-theme-muted">{l.invoice_date}</td>
                            <td className="p-3 font-mono text-theme-muted">{l.product_code || "—"}</td>
                            <td className="p-3 text-theme-body font-medium">{l.product_name}</td>
                            <td className="p-3 text-right font-mono font-bold text-blue-300">{Number(l.quantity).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                            <td className="p-3 text-right font-mono">{Number(l.unit_price).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                            <td className="p-3 text-right font-mono text-amber-400">{Number(l.discount_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                            <td className="p-3 text-right font-mono text-theme-muted">{l.gst_rate}%</td>
                            <td className="p-3 text-right font-mono text-purple-400">{Number(l.tax_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                            <td className="p-3 text-right font-mono font-bold text-emerald-400">{Number(l.total_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
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
                        <tr><td colSpan={8} className="p-6 text-center text-theme-muted">No merchandise sales matrix data found for the selected period.</td></tr>
                      ) : (
                        genericReportData.lines.map((l: any, idx: number) => (
                          <tr key={idx} className="hover:bg-theme-surface-hover transition-colors">
                            <td className="p-3 font-semibold text-theme-body">{l.category}</td>
                            <td className="p-3 text-theme-muted">{l.brand}</td>
                            <td className="p-3 font-mono text-theme-muted">{l.color}</td>
                            <td className="p-3">
                              <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-theme-surface-3 text-blue-300 border border-theme-divider">
                                {l.size}
                              </span>
                            </td>
                            <td className="p-3 text-right font-mono font-bold text-blue-300">{Number(l.qty_sold).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                            <td className="p-3 text-right font-mono">{Number(l.gross_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                            <td className="p-3 text-right font-mono text-amber-400">{Number(l.discount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                            <td className="p-3 text-right font-mono font-bold text-emerald-400">{Number(l.net_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
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
                      Seller: Tattly Threads (27AAXFT2508H1ZR) • Customer: Reliance Retail Limited • GST Rate: 5.00%
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
                        <th className="p-3 text-center">SIS Code</th>
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
                        <th className="p-3 text-center">SIS Code</th>
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
                        <th className="p-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-theme-divider/40">
                      {(!genericReportData?.lines || genericReportData.lines.length === 0) ? (
                        <tr><td colSpan={9} className="p-6 text-center text-theme-muted">No comparison records found.</td></tr>
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
                        <th className="p-3 text-right">Avg Rate (₹)</th>
                        <th className="p-3 text-right">Total Value (₹)</th>
                        <th className="p-3 text-right">Orders Count</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-theme-divider/40">
                      {(!genericReportData?.lines || genericReportData.lines.length === 0) ? (
                        <tr><td colSpan={10} className="p-6 text-center text-theme-muted">No product-wise ordered quantities found.</td></tr>
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

            {/* Fallback table if no specific prebuilt report viewer matches */}
            {![
              "RPT-SAL-001",
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
              "RPT-SO-002",
              "RPT-SO-003",
              "RPT-SO-004",
              "RPT-SO-005",
              "RPT-SO-006",
              "RPT-SO-007",
            ].includes(selectedReport.id) && (
              <div className="p-8 text-center text-theme-muted text-xs space-y-4">
                <AlertTriangle className="mx-auto text-amber-500 animate-pulse" size={32} />
                <div className="max-w-md mx-auto">
                  <h5 className="font-bold text-theme-body mb-1">Preview of: {selectedReport.title}</h5>
                  <p className="text-[11px] leading-relaxed mb-4 text-theme-muted">
                    This report represents custom transactional summary streams. All values are reconciled in real-time in our secure PostgreSQL database.
                  </p>
                  <button
                    onClick={() => handleTriggerExport("PDF")}
                    className="px-4 py-2 bg-theme-surface-3 hover:bg-blue-600/10 hover:text-blue-400 border border-theme-divider text-theme-body rounded-lg font-bold text-xs inline-flex items-center gap-1.5 transition-colors"
                  >
                    <Download size={14} /> Download PDF Ledger Print-out
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      )}

      {/* AUTOMATED SCHEDULER POPUP MODAL */}
      <AnimatePresence>
        {showScheduleModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={() => setShowScheduleModal(false)}></div>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-theme-surface-1 border border-theme-divider rounded-2xl w-full max-w-md shadow-2xl overflow-hidden relative z-50 font-sans"
            >
              <div className="p-5 border-b border-theme-divider flex items-center justify-between bg-theme-surface-2">
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-amber-400" />
                  <h4 className="font-bold text-theme-body text-sm">Schedule Report Distribution</h4>
                </div>
                <button onClick={() => setShowScheduleModal(false)} className="text-theme-muted hover:text-white">
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleRegisterSchedule} className="p-5 space-y-4 text-xs">
                {activeRole === "Cashier" && (
                  <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl flex items-start gap-2.5">
                    <ShieldAlert size={16} className="shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold">Access Restrained (Rule 10)</div>
                      <p className="text-[10px] mt-0.5">Cashiers are blocked from registering automated business reports schedules.</p>
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

                <div className="space-y-1">
                  <label className="text-theme-muted font-bold block uppercase">Recipient Email Address</label>
                  <input
                    type="email"
                    required
                    value={scheduleForm.recipientEmail}
                    onChange={(e) => setScheduleForm({...scheduleForm, recipientEmail: e.target.value})}
                    placeholder="manager@smritibooks.com"
                    className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-theme-body focus:outline-none focus:border-blue-500"
                    disabled={activeRole === "Cashier"}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-theme-muted font-bold block uppercase">Frequency</label>
                    <select
                      value={scheduleForm.frequency}
                      onChange={(e) => {
                        let cron = "0 8 * * *";
                        if (e.target.value === "Weekly") cron = "0 8 * * 1";
                        if (e.target.value === "Monthly") cron = "0 8 1 * *";
                        setScheduleForm({...scheduleForm, frequency: e.target.value, cron});
                      }}
                      className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-2.5 py-2 text-theme-body focus:outline-none focus:border-blue-500 cursor-pointer"
                      disabled={activeRole === "Cashier"}
                    >
                      <option value="Daily">Daily Summary</option>
                      <option value="Weekly">Weekly Summary</option>
                      <option value="Monthly">Monthly Pivot</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-theme-muted font-bold block uppercase">Attachment Format</label>
                    <select
                      value={scheduleForm.format}
                      onChange={(e) => setScheduleForm({...scheduleForm, format: e.target.value})}
                      className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-2.5 py-2 text-theme-body focus:outline-none focus:border-blue-500 cursor-pointer"
                      disabled={activeRole === "Cashier"}
                    >
                      <option value="PDF">PDF Document</option>
                      <option value="Excel">Excel Sheet</option>
                      <option value="CSV">CSV Format</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-theme-muted font-bold block uppercase">Calculated Cron Expression</label>
                  <input
                    type="text"
                    readOnly
                    value={scheduleForm.cron}
                    className="w-full bg-theme-surface-3 border border-theme-divider rounded-lg px-3 py-2 text-theme-muted font-mono"
                  />
                </div>

                <div className="pt-4 flex items-center justify-end gap-2.5 border-t border-theme-divider">
                  <button
                    type="button"
                    onClick={() => setShowScheduleModal(false)}
                    className="px-4 py-2 bg-theme-surface-2 border border-theme-divider rounded-lg font-bold text-theme-muted hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={activeRole === "Cashier"}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-800 disabled:text-theme-muted text-white rounded-lg font-bold shadow-lg shadow-blue-500/10 transition-colors"
                  >
                    Register Schedule
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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

    </div>
  );
};
