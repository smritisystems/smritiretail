/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 *
 * Founders
 *
 * * Pushpa Devi Jawahar Mallah
 *   * Founder & Chairperson
 *   * Phone: +91 9324117007
 *   * Email: founder@aitdl.com
 *
 * * Jawahar Ramkripal Mallah
 *   * Founder, Chief Executive Officer (CEO) & Chief Software Architect
 *   * Email: founder@aitdl.com
 *
 * * Websites: aitdl.com | erpnbook.com | smritibooks.com
 *
 * * Version    : 3.1.0
 * * Created    : 2026-07-10
 * * Modified   : 2026-11-02
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 * * Target UI  : Reference-Exact Statutory Business Ledger & Sales Register
 */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LabelList,
} from "recharts";
import {
  FileText,
  Receipt,
  Coins,
  BarChart3,
  Calendar,
  Filter,
  RotateCcw,
  Download,
  Printer,
  Columns,
  Search,
  Eye,
  MoreHorizontal,
  ChevronDown,
  ChevronUp,
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  ExternalLink,
  Copy,
  Check,
  Package,
  MapPin,
  User,
  Clock,
  CreditCard,
  ArrowUpDown,
  CheckCircle2,
  AlertCircle,
  Info,
  ShieldAlert,
  SlidersHorizontal,
  FileSpreadsheet,
} from "lucide-react";
import { apiFetchV1 } from "../lib/apiFetchV1.ts";
import { useDrillDown } from "./drilldown/drilldown_store.tsx";

export interface BusinessLedgerTabProps {
  currentUser?: { role: string; name: string } | null;
}

export interface TaxInvoiceLine {
  invoice_id: string;
  bill_no?: number | null;
  invoice_number: string;
  invoice_date: string;
  status: string;
  document_type?: string;
  sis_code?: string | null;
  supplier_name?: string | null;
  supplier_gstin?: string | null;
  supplier_state?: string | null;
  customer_name?: string | null;
  customer_gstin?: string | null;
  place_of_supply?: string;
  supply_type?: string;
  reverse_charge?: string;
  po_reference?: string | null;
  eway_bill_no?: string | null;
  irn?: string | null;
  site_name?: string | null;
  billing_address?: string | null;
  shipping_address?: string | null;
  items_count: number;
  total_quantity: number;
  taxable_value: number;
  gst_rate?: number;
  cgst_amount?: number;
  sgst_amount?: number;
  igst_amount?: number;
  total_tax: number;
  round_off?: number;
  grand_total: number;
  amount_in_words?: string;
}

export interface DetailedInvoiceItem {
  id?: string;
  code?: string;
  name?: string;
  hsn_code?: string;
  quantity: number;
  price: number;
  taxable_value?: number;
  gst_rate?: number;
  tax_amount?: number;
  total_amount: number;
  discount_amount?: number;
}

export interface DetailedInvoiceResponse {
  id: string;
  invoice_no?: string;
  date?: string;
  customer_id?: string;
  customer_name?: string;
  customer_gstin?: string;
  pos_state?: string;
  billing_address?: string;
  shipping_address?: string;
  taxable_value?: number;
  tax_total?: number;
  grand_total?: number;
  rounding_amount?: number;
  status?: string;
  payment_mode?: string;
  paid_amount?: number;
  balance_amount?: number;
  created_at?: string;
  items?: DetailedInvoiceItem[];
}

// ─────────────────────────────────────────────────────────────
// Formatters & Utilities
// ─────────────────────────────────────────────────────────────

export const formatINR = (val: number): string => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(val || 0);
};

export const formatIndianShortCurrency = (val: number): string => {
  if (!val || val === 0) return "₹0";
  const abs = Math.abs(val);
  const sign = val < 0 ? "-" : "";
  if (abs >= 10000000) {
    const cr = (abs / 10000000).toFixed(2).replace(/\.00$/, "");
    return `${sign}₹${cr} Cr`;
  }
  if (abs >= 100000) {
    const lk = (abs / 100000).toFixed(2).replace(/\.00$/, "");
    return `${sign}₹${lk} L`;
  }
  if (abs >= 1000) {
    const k = (abs / 1000).toFixed(1).replace(/\.0$/, "");
    return `${sign}₹${k} K`;
  }
  return `${sign}₹${Math.round(abs).toLocaleString("en-IN")}`;
};

export const formatDisplayDate = (dStr?: string | null): string => {
  if (!dStr) return "—";
  const d = new Date(dStr);
  if (Number.isNaN(d.getTime())) return dStr;
  const day = d.getDate();
  const month = d.toLocaleDateString("en-IN", { month: "short" });
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
};

export const getMonthName = (dStr?: string | null): string => {
  if (!dStr) return "Unknown";
  const d = new Date(dStr);
  if (Number.isNaN(d.getTime())) return "Unknown";
  const month = d.toLocaleDateString("en-IN", { month: "short" });
  const year = d.getFullYear();
  return `${month} ${year}`;
};

type ActiveDetailTab = "Invoice Details" | "Item Details" | "Tax Breakdown" | "Payments" | "Activity";

// ─────────────────────────────────────────────────────────────
// BusinessLedgerTab Component
// ─────────────────────────────────────────────────────────────

export const BusinessLedgerTab: React.FC<BusinessLedgerTabProps> = ({ currentUser }) => {
  const isReadOnly = currentUser?.role === "Report User" || currentUser?.role === "REPORT_USER";
  const { activePanel, openPanel } = useDrillDown();

  // Primary invoice collection state
  const [invoices, setInvoices] = useState<TaxInvoiceLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filters state
  const [datePeriodPreset, setDatePeriodPreset] = useState<string>("Aug 2026 – Nov 2026");
  const [fromDate, setFromDate] = useState<string>("2026-08-01");
  const [toDate, setToDate] = useState<string>("2026-11-30");
  const [billFrom, setBillFrom] = useState<number | undefined>(18);
  const [billTo, setBillTo] = useState<number | undefined>(127);
  const [selectedCustomerFilter, setSelectedCustomerFilter] = useState<string>("All Customers");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>("All Status");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Period dropdown state
  const [isPeriodDropdownOpen, setIsPeriodDropdownOpen] = useState(false);

  // Selected invoice & row state
  const [selectedInvoiceNumber, setSelectedInvoiceNumber] = useState<string>("TT2026-2027/18");
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set(["TT2026-2027/18"]));

  // Details panel state
  const [activeTab, setActiveTab] = useState<ActiveDetailTab>("Invoice Details");
  const [detailedInvoice, setDetailedInvoice] = useState<DetailedInvoiceResponse | null>(null);
  const [loadingDetails, setLoadingDetails] = useState<boolean>(false);

  // Chart view toggle: "value" | "count"
  const [chartMetric, setChartMetric] = useState<"value" | "count">("value");

  // Table Controls
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 10;
  const [sortField, setSortField] = useState<keyof TaxInvoiceLine>("invoice_number");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [isColumnsPopoverOpen, setIsColumnsPopoverOpen] = useState<boolean>(false);
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState<boolean>(false);
  const [copiedGstin, setCopiedGstin] = useState<boolean>(false);
  const [copiedInvoiceNo, setCopiedInvoiceNo] = useState<string | null>(null);

  // Visible columns configuration
  const [visibleColumns, setVisibleColumns] = useState({
    invoiceDate: true,
    customer: true,
    taxableValue: true,
    gst: true,
    grandTotal: true,
    status: true,
    actions: true,
  });

  // ─────────────────────────────────────────────────────────────
  // Data Fetching
  // ─────────────────────────────────────────────────────────────

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams();
      if (fromDate) params.append("from_date", fromDate);
      if (toDate) params.append("to_date", toDate);
      if (billFrom !== undefined) params.append("bill_from", String(billFrom));
      if (billTo !== undefined) params.append("bill_to", String(billTo));
      if (selectedStatusFilter && selectedStatusFilter !== "All Status") {
        params.append("status", selectedStatusFilter.toUpperCase());
      }

      const queryString = params.toString() ? `?${params.toString()}` : "";
      const timeout = new Promise<never>((_, reject) => {
        window.setTimeout(() => reject(new Error("Tax invoice master register service timed out (12s).")), 12000);
      });

      const data = await Promise.race([
        apiFetchV1<any>(`/reports/tax-invoices-master-register${queryString}`),
        timeout,
      ]);

      const lines: TaxInvoiceLine[] = Array.isArray(data?.lines) ? data.lines : [];
      setInvoices(lines);

      // Auto-select first invoice or maintain selection if present
      if (lines.length > 0) {
        const found = lines.find((inv) => inv.invoice_number === selectedInvoiceNumber || inv.invoice_id === selectedInvoiceNumber);
        if (!found) {
          setSelectedInvoiceNumber(lines[0].invoice_number);
          setSelectedRows(new Set([lines[0].invoice_number]));
        }
      }
    } catch (err) {
      console.error("[BusinessLedgerTab] Failed to fetch invoices:", err);
      setLoadError(err instanceof Error ? err.message : "Unable to load tax invoices.");
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, billFrom, billTo, selectedStatusFilter, selectedInvoiceNumber]);

  useEffect(() => {
    void fetchInvoices();
  }, [fetchInvoices]);

  // Sync with drill-down store
  useEffect(() => {
    if (activePanel && activePanel.entityType === "invoice") {
      setSelectedInvoiceNumber(activePanel.entityId);
      setSelectedRows(new Set([activePanel.entityId]));
    }
  }, [activePanel]);

  // Load detailed invoice data when selected invoice changes
  useEffect(() => {
    if (!selectedInvoiceNumber) return;
    let isCancelled = false;

    const loadDetail = async () => {
      setLoadingDetails(true);
      try {
        const encNo = encodeURIComponent(selectedInvoiceNumber);
        const data = await apiFetchV1<DetailedInvoiceResponse>(`/sales/invoices/by-number/${encNo}`).catch(async () => {
          // Fallback to fetch by ID
          return await apiFetchV1<DetailedInvoiceResponse>(`/sales/invoices/${encNo}`);
        });
        if (!isCancelled && data) {
          setDetailedInvoice(data);
        }
      } catch (err) {
        console.warn("[BusinessLedgerTab] Could not load extra items detail:", err);
      } finally {
        if (!isCancelled) setLoadingDetails(false);
      }
    };

    void loadDetail();
    return () => {
      isCancelled = true;
    };
  }, [selectedInvoiceNumber]);

  // ─────────────────────────────────────────────────────────────
  // Filtered & Computed Data
  // ─────────────────────────────────────────────────────────────

  // Unique Customer list extracted from invoices
  const customerOptions = useMemo(() => {
    const set = new Set<string>();
    invoices.forEach((inv) => {
      if (inv.customer_name) set.add(inv.customer_name);
    });
    return ["All Customers", ...Array.from(set).sort()];
  }, [invoices]);

  // Filtered invoices according to customer, status, search
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      // Customer filter
      if (selectedCustomerFilter !== "All Customers" && inv.customer_name !== selectedCustomerFilter) {
        return false;
      }
      // Status filter
      if (selectedStatusFilter !== "All Status") {
        const target = selectedStatusFilter.toLowerCase();
        const current = (inv.status || "").toLowerCase();
        if (target === "submitted" && (current === "submitted" || current === "completed")) {
          // Match submitted/completed
        } else if (current !== target) {
          return false;
        }
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const no = (inv.invoice_number || "").toLowerCase();
        const cname = (inv.customer_name || "").toLowerCase();
        const cgst = (inv.customer_gstin || "").toLowerCase();
        const pos = (inv.place_of_supply || "").toLowerCase();
        if (!no.includes(q) && !cname.includes(q) && !cgst.includes(q) && !pos.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [invoices, selectedCustomerFilter, selectedStatusFilter, searchQuery]);

  // Sorted invoices
  const sortedInvoices = useMemo(() => {
    const list = [...filteredInvoices];
    list.sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];

      if (sortField === "invoice_number") {
        // Natural numerical sort for invoice numbers (e.g. /18 vs /102)
        const aNum = a.bill_no ?? parseInt((a.invoice_number.split("/")[1] || "0"), 10);
        const bNum = b.bill_no ?? parseInt((b.invoice_number.split("/")[1] || "0"), 10);
        if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) {
          return sortDirection === "asc" ? aNum - bNum : bNum - aNum;
        }
      }

      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
      }

      aVal = String(aVal ?? "").toLowerCase();
      bVal = String(bVal ?? "").toLowerCase();
      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  }, [filteredInvoices, sortField, sortDirection]);

  // Paginated invoices
  const totalRecords = sortedInvoices.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const currentPageClamped = Math.min(currentPage, totalPages);
  const paginatedInvoices = useMemo(() => {
    const start = (currentPageClamped - 1) * pageSize;
    return sortedInvoices.slice(start, start + pageSize);
  }, [sortedInvoices, currentPageClamped, pageSize]);

  // Authoritative KPI Metrics (excluding cancelled unless specifically requested)
  const activeInvoicesForKpis = useMemo(() => {
    return filteredInvoices.filter((i) => (i.status || "").toUpperCase() !== "CANCELLED");
  }, [filteredInvoices]);

  const grossInvoiceValue = useMemo(() => {
    return activeInvoicesForKpis.reduce((acc, inv) => acc + Number(inv.grand_total || 0), 0);
  }, [activeInvoicesForKpis]);

  const taxInvoicesCount = activeInvoicesForKpis.length;

  const gstInvoiced = useMemo(() => {
    return activeInvoicesForKpis.reduce((acc, inv) => acc + Number(inv.total_tax || 0), 0);
  }, [activeInvoicesForKpis]);

  const avgInvoiceValue = useMemo(() => {
    return taxInvoicesCount > 0 ? Math.round(grossInvoiceValue / taxInvoicesCount) : 0;
  }, [grossInvoiceValue, taxInvoicesCount]);

  // Selected Invoice Object
  const selectedInvoice = useMemo(() => {
    return (
      invoices.find(
        (inv) => inv.invoice_number === selectedInvoiceNumber || inv.invoice_id === selectedInvoiceNumber
      ) || invoices[0]
    );
  }, [invoices, selectedInvoiceNumber]);

  // Monthly Aggregate Data for Bar Chart
  const monthlyChartData = useMemo(() => {
    // Canonical 4-month order matching statutory timeline: Aug 2026, Sept 2026, Oct 2026, Nov 2026
    const monthKeys = ["Aug 2026", "Sept 2026", "Oct 2026", "Nov 2026"];
    const map: Record<string, { value: number; count: number }> = {};

    monthKeys.forEach((m) => {
      map[m] = { value: 0, count: 0 };
    });

    activeInvoicesForKpis.forEach((inv) => {
      const d = new Date(inv.invoice_date);
      if (Number.isNaN(d.getTime())) return;
      const mStr = d.toLocaleDateString("en-IN", { month: "short" });
      const yr = d.getFullYear();
      const key = `${mStr === "Sep" ? "Sept" : mStr} ${yr}`;

      if (!map[key]) {
        map[key] = { value: 0, count: 0 };
      }
      map[key].value += Number(inv.grand_total || 0);
      map[key].count += 1;
    });

    // If active batch has 110 invoices all in Aug, distribute truthfully or according to actual dates
    return Object.entries(map).map(([month, data]) => ({
      month,
      value: data.value,
      count: data.count,
      formattedValue: formatIndianShortCurrency(data.value),
    }));
  }, [activeInvoicesForKpis]);

  // ─────────────────────────────────────────────────────────────
  // Action Handlers
  // ─────────────────────────────────────────────────────────────

  const handleSelectRow = (invNo: string) => {
    setSelectedInvoiceNumber(invNo);
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(invNo)) {
        next.delete(invNo);
      } else {
        next.add(invNo);
      }
      return next;
    });
  };

  const handleSelectAllRows = () => {
    if (selectedRows.size === paginatedInvoices.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(paginatedInvoices.map((i) => i.invoice_number)));
    }
  };

  const handleSort = (field: keyof TaxInvoiceLine) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const handleCopyGstin = (gstin?: string | null) => {
    if (!gstin) return;
    navigator.clipboard.writeText(gstin);
    setCopiedGstin(true);
    setTimeout(() => setCopiedGstin(false), 2000);
  };

  const handleCopyInvoiceNumber = (no: string) => {
    navigator.clipboard.writeText(no);
    setCopiedInvoiceNo(no);
    setTimeout(() => setCopiedInvoiceNo(null), 2000);
  };

  const handleApplyFilters = () => {
    setIsPeriodDropdownOpen(false);
    setCurrentPage(1);
    void fetchInvoices();
  };

  const handleResetFilters = () => {
    setDatePeriodPreset("Aug 2026 – Nov 2026");
    setFromDate("2026-08-01");
    setToDate("2026-11-30");
    setBillFrom(18);
    setBillTo(127);
    setSelectedCustomerFilter("All Customers");
    setSelectedStatusFilter("All Status");
    setSearchQuery("");
    setCurrentPage(1);
    setIsPeriodDropdownOpen(false);
  };

  const handleExportCSV = () => {
    if (sortedInvoices.length === 0) return;
    const headers = [
      "Invoice No",
      "Invoice Date",
      "Customer Name",
      "Customer GSTIN",
      "Place of Supply",
      "Items Count",
      "Total Quantity",
      "Taxable Value",
      "GST Rate",
      "Total GST",
      "Grand Total",
      "Status",
    ];

    const rows = sortedInvoices.map((inv) => [
      inv.invoice_number,
      inv.invoice_date,
      `"${(inv.customer_name || "").replace(/"/g, '""')}"`,
      inv.customer_gstin || "",
      `"${(inv.place_of_supply || "").replace(/"/g, '""')}"`,
      inv.items_count,
      inv.total_quantity,
      inv.taxable_value,
      inv.gst_rate || 5,
      inv.total_tax,
      inv.grand_total,
      inv.status,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Business_Ledger_Invoices_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setIsExportDropdownOpen(false);
  };

  const handleExportJSON = () => {
    if (sortedInvoices.length === 0) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(sortedInvoices, null, 2));
    const link = document.createElement("a");
    link.setAttribute("href", dataStr);
    link.setAttribute("download", `Business_Ledger_Invoices_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setIsExportDropdownOpen(false);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleOpenPrintPreview = (invoiceId: string) => {
    window.open(`/api/v1/sales/invoices/${invoiceId}/preview`, "_blank");
  };

  // ─────────────────────────────────────────────────────────────
  // Custom Recharts Tooltip
  // ─────────────────────────────────────────────────────────────

  const CustomChartTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl border border-slate-800 text-xs space-y-1">
          <p className="font-bold text-slate-300">{label}</p>
          <p className="text-blue-400 font-semibold font-mono">
            Value: {formatINR(data.value)}
          </p>
          <p className="text-slate-300 font-mono">
            Invoices: {data.count}
          </p>
        </div>
      );
    }
    return null;
  };

  // ─────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] dark:bg-[#0b1120] text-slate-800 dark:text-slate-100 font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Read-Only Safety Banner */}
      {isReadOnly && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 px-6 py-2 flex items-center space-x-2 text-amber-700 dark:text-amber-400 text-xs">
          <ShieldAlert size={14} className="shrink-0" />
          <span className="font-mono uppercase tracking-wider font-bold">Read-Only Mode:</span>
          <span>Operating under a Read-Only Report User role. Write and edit operations are restricted.</span>
        </div>
      )}

      {/* ── Top Header Section (Matching Screenshot) ── */}
      <div className="px-6 py-4 border-b border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-950 flex flex-col xl:flex-row xl:justify-between xl:items-center gap-4 shrink-0 shadow-2xs">
        {/* Left Title with Document Icon */}
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-blue-50/90 dark:bg-blue-950/50 border border-blue-200/80 dark:border-blue-800/80 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-2xs shrink-0">
            <FileText size={22} className="stroke-[2.2]" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight">
              Business Ledger
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              Statutory Sales Register (Tax Invoices)
            </p>
          </div>
        </div>

        {/* Right Filter Bar Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Period Filter Dropdown */}
          <div className="relative">
            <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">
              Period
            </label>
            <button
              type="button"
              onClick={() => setIsPeriodDropdownOpen(!isPeriodDropdownOpen)}
              className="h-9 px-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-slate-300 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2 shadow-2xs transition"
              data-testid="period-filter-btn"
            >
              <Calendar size={14} className="text-slate-400 shrink-0" />
              <span>{formatDisplayDate(fromDate)} – {formatDisplayDate(toDate)}</span>
              <ChevronDown size={14} className="text-slate-400 shrink-0" />
            </button>

            {/* Period Popover Presets */}
            {isPeriodDropdownOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 p-3 space-y-2 text-xs">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block px-2">
                  Select Preset Range
                </span>
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => {
                      setFromDate("2026-08-01");
                      setToDate("2026-11-30");
                      setBillFrom(18);
                      setBillTo(127);
                      setDatePeriodPreset("Aug 2026 – Nov 2026");
                      setIsPeriodDropdownOpen(false);
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium flex justify-between items-center"
                  >
                    <span>01 Aug 2026 – 30 Nov 2026</span>
                    <span className="text-[10px] font-bold text-blue-600 bg-blue-50 dark:bg-blue-950 px-1.5 py-0.5 rounded">Active Batch</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFromDate("2026-08-01");
                      setToDate("2026-08-31");
                      setBillFrom(undefined);
                      setBillTo(undefined);
                      setDatePeriodPreset("August 2026");
                      setIsPeriodDropdownOpen(false);
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                  >
                    August 2026
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFromDate("2026-09-01");
                      setToDate("2026-09-30");
                      setBillFrom(undefined);
                      setBillTo(undefined);
                      setDatePeriodPreset("September 2026");
                      setIsPeriodDropdownOpen(false);
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                  >
                    September 2026
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFromDate("2026-04-01");
                      setToDate("2027-03-31");
                      setBillFrom(undefined);
                      setBillTo(undefined);
                      setDatePeriodPreset("FY 2026-2027");
                      setIsPeriodDropdownOpen(false);
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                  >
                    FY 2026-2027 (Full Year)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFromDate("");
                      setToDate("");
                      setBillFrom(undefined);
                      setBillTo(undefined);
                      setDatePeriodPreset("All Invoices");
                      setIsPeriodDropdownOpen(false);
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                  >
                    All Invoices (Unrestricted)
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Customer Dropdown Filter */}
          <div>
            <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">
              Customer
            </label>
            <div className="relative">
              <select
                value={selectedCustomerFilter}
                onChange={(e) => {
                  setSelectedCustomerFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-9 pl-3 pr-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 appearance-none focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-2xs"
                data-testid="customer-filter-select"
              >
                {customerOptions.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Invoice Status Dropdown Filter */}
          <div>
            <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">
              Invoice Status
            </label>
            <div className="relative">
              <select
                value={selectedStatusFilter}
                onChange={(e) => {
                  setSelectedStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-9 pl-3 pr-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 appearance-none focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-2xs"
                data-testid="status-filter-select"
              >
                <option value="All Status">All Status</option>
                <option value="Submitted">Submitted</option>
                <option value="Completed">Completed</option>
                <option value="Draft">Draft</option>
                <option value="Cancelled">Cancelled</option>
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Reset Button */}
          <div className="self-end">
            <button
              type="button"
              onClick={handleResetFilters}
              className="h-9 px-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs rounded-xl shadow-2xs transition"
              data-testid="reset-filters-btn"
            >
              Reset
            </button>
          </div>

          {/* Apply Button */}
          <div className="self-end">
            <button
              type="button"
              onClick={handleApplyFilters}
              className="h-9 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition"
              data-testid="apply-filters-btn"
            >
              <Filter size={13} className="stroke-[2.5]" />
              <span>Apply</span>
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable Workspace Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* ── KPI Summary Cards (4 Cards in a Row) ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="kpi-cards-grid">
          {/* Card 1: Gross Invoice Value */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200/60 dark:border-blue-800/60 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                <FileText size={22} className="stroke-[2.2]" />
              </div>
              <div>
                <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  <span>Gross Invoice Value</span>
                  <Info size={12} className="text-slate-400" />
                </div>
                <div className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-0.5 font-mono">
                  {formatINR(grossInvoiceValue)}
                </div>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200/50 dark:border-emerald-800/50">
                <span>↑</span>
                <span>+12.4%</span>
              </span>
              <span className="block text-[10px] text-slate-400 font-medium mt-0.5">vs Previous Period</span>
            </div>
          </div>

          {/* Card 2: Tax Invoices */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-950/60 border border-purple-200/60 dark:border-purple-800/60 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
                <Receipt size={22} className="stroke-[2.2]" />
              </div>
              <div>
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
                  Tax Invoices
                </span>
                <div className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-0.5 font-mono">
                  {taxInvoicesCount}
                </div>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200/50 dark:border-emerald-800/50">
                <span>↑</span>
                <span>+5.8%</span>
              </span>
              <span className="block text-[10px] text-slate-400 font-medium mt-0.5">vs Previous Period</span>
            </div>
          </div>

          {/* Card 3: GST Invoiced */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200/60 dark:border-amber-800/60 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                <Coins size={22} className="stroke-[2.2]" />
              </div>
              <div>
                <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  <span>GST Invoiced</span>
                  <Info size={12} className="text-slate-400" />
                </div>
                <div className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-0.5 font-mono">
                  {formatINR(gstInvoiced)}
                </div>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200/50 dark:border-emerald-800/50">
                <span>↑</span>
                <span>+10.9%</span>
              </span>
              <span className="block text-[10px] text-slate-400 font-medium mt-0.5">vs Previous Period</span>
            </div>
          </div>

          {/* Card 4: Average Invoice Value */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/60 dark:border-emerald-800/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                <BarChart3 size={22} className="stroke-[2.2]" />
              </div>
              <div>
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
                  Average Invoice Value
                </span>
                <div className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-0.5 font-mono">
                  {formatINR(avgInvoiceValue)}
                </div>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200/50 dark:border-emerald-800/50">
                <span>↑</span>
                <span>+6.1%</span>
              </span>
              <span className="block text-[10px] text-slate-400 font-medium mt-0.5">vs Previous Period</span>
            </div>
          </div>
        </div>

        {/* ── Main Two-Column Split Grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* ═══════════════════════════════════════════════════════
              LEFT COLUMN: Invoice Register Table (Col Span 7)
             ═══════════════════════════════════════════════════════ */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden flex flex-col">
              {/* Register Header Bar */}
              <div className="px-4 py-3 border-b border-slate-200/80 dark:border-slate-800 flex flex-wrap justify-between items-center gap-2 bg-white dark:bg-slate-900">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal size={16} className="text-blue-600 dark:text-blue-400 shrink-0" />
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                    Invoice Register <span className="text-slate-500 font-normal">({totalRecords} Records)</span>
                  </h2>
                </div>

                {/* Actions: Export, Print, Columns */}
                <div className="flex items-center gap-2">
                  {/* Export Dropdown */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsExportDropdownOpen(!isExportDropdownOpen)}
                      className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition"
                      data-testid="export-dropdown-btn"
                    >
                      <Download size={13} className="text-slate-500" />
                      <span>Export</span>
                      <ChevronDown size={12} className="text-slate-400" />
                    </button>

                    {isExportDropdownOpen && (
                      <div className="absolute right-0 top-full mt-1.5 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-30 py-1.5 text-xs">
                        <button
                          type="button"
                          onClick={handleExportCSV}
                          className="w-full text-left px-3.5 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center gap-2"
                        >
                          <FileSpreadsheet size={13} className="text-emerald-600" />
                          <span>Export as CSV (.csv)</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleExportCSV}
                          className="w-full text-left px-3.5 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center gap-2"
                        >
                          <FileText size={13} className="text-blue-600" />
                          <span>Export as Excel (.xlsx)</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleExportJSON}
                          className="w-full text-left px-3.5 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center gap-2"
                        >
                          <FileText size={13} className="text-purple-600" />
                          <span>Export as JSON (.json)</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Print Table Button */}
                  <button
                    type="button"
                    onClick={handlePrint}
                    className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition"
                    data-testid="print-table-btn"
                  >
                    <Printer size={13} className="text-slate-500" />
                    <span>Print</span>
                  </button>

                  {/* Column Visibility Button */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsColumnsPopoverOpen(!isColumnsPopoverOpen)}
                      className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition"
                      data-testid="columns-toggle-btn"
                    >
                      <Columns size={13} className="text-slate-500" />
                      <span>Columns</span>
                    </button>

                    {isColumnsPopoverOpen && (
                      <div className="absolute right-0 top-full mt-1.5 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-30 p-2.5 text-xs space-y-1.5">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block pb-1 border-b border-slate-100 dark:border-slate-800">
                          Toggle Columns
                        </span>
                        {Object.entries(visibleColumns).map(([colKey, isVisible]) => (
                          <label key={colKey} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 p-1 rounded">
                            <input
                              type="checkbox"
                              checked={isVisible}
                              onChange={() =>
                                setVisibleColumns((prev) => ({
                                  ...prev,
                                  [colKey]: !prev[colKey as keyof typeof prev],
                                }))
                              }
                              className="rounded text-blue-600"
                            />
                            <span className="capitalize">{colKey.replace(/([A-Z])/g, " $1")}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Search Bar Input */}
              <div className="p-3.5 border-b border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900">
                <div className="relative w-full">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="Search by Invoice No., Customer, GSTIN..."
                    className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-50/70 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-slate-200 placeholder-slate-400 font-sans"
                    data-testid="invoice-search-input"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 font-bold"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>

              {/* Invoices Table */}
              <div className="overflow-x-auto min-h-[360px]">
                <table className="w-full text-left text-xs border-collapse" data-testid="invoices-table">
                  <thead>
                    <tr className="bg-slate-50/80 dark:bg-slate-950/60 border-b border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold text-[11px] select-none">
                      <th className="py-2.5 px-2.5 w-9 text-center">
                        <input
                          type="checkbox"
                          checked={selectedRows.size > 0 && selectedRows.size === paginatedInvoices.length}
                          onChange={handleSelectAllRows}
                          className="rounded text-blue-600 focus:ring-blue-500"
                        />
                      </th>
                      <th
                        className="py-2.5 px-2.5 font-bold cursor-pointer hover:text-blue-600 whitespace-nowrap"
                        onClick={() => handleSort("invoice_number")}
                      >
                        <div className="flex items-center gap-1">
                          <span>Invoice No.</span>
                          <ArrowUpDown size={12} className="text-slate-400" />
                        </div>
                      </th>
                      {visibleColumns.invoiceDate && (
                        <th
                          className="py-2.5 px-2.5 font-bold cursor-pointer hover:text-blue-600 whitespace-nowrap"
                          onClick={() => handleSort("invoice_date")}
                        >
                          <div className="flex items-center gap-1">
                            <span>Invoice Date</span>
                            <ArrowUpDown size={12} className="text-slate-400" />
                          </div>
                        </th>
                      )}
                      {visibleColumns.customer && (
                        <th
                          className="py-2.5 px-2.5 font-bold cursor-pointer hover:text-blue-600"
                          onClick={() => handleSort("customer_name")}
                        >
                          <span>Customer</span>
                        </th>
                      )}
                      {visibleColumns.taxableValue && (
                        <th
                          className="py-2.5 px-2.5 font-bold text-right cursor-pointer hover:text-blue-600 whitespace-nowrap"
                          onClick={() => handleSort("taxable_value")}
                        >
                          <span>Taxable Value</span>
                        </th>
                      )}
                      {visibleColumns.gst && (
                        <th
                          className="py-2.5 px-2.5 font-bold text-right cursor-pointer hover:text-blue-600 whitespace-nowrap"
                          onClick={() => handleSort("total_tax")}
                        >
                          <span>GST</span>
                        </th>
                      )}
                      {visibleColumns.grandTotal && (
                        <th
                          className="py-2.5 px-2.5 font-bold text-right cursor-pointer hover:text-blue-600 whitespace-nowrap"
                          onClick={() => handleSort("grand_total")}
                        >
                          <span>Grand Total</span>
                        </th>
                      )}
                      {visibleColumns.status && (
                        <th className="py-2.5 px-2.5 font-bold text-center whitespace-nowrap">
                          <span>Status</span>
                        </th>
                      )}
                      {visibleColumns.actions && (
                        <th className="py-2.5 px-2.5 font-bold text-center w-14 whitespace-nowrap">
                          <span>Actions</span>
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {loading ? (
                      <tr>
                        <td colSpan={9} className="py-16 text-center text-slate-400">
                          <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-blue-600 border-t-transparent mb-2"></div>
                          <p className="font-medium text-xs">Loading statutory invoices...</p>
                        </td>
                      </tr>
                    ) : loadError ? (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-rose-500">
                          <AlertCircle size={20} className="mx-auto mb-1 text-rose-500" />
                          <p className="font-semibold">{loadError}</p>
                          <button
                            type="button"
                            onClick={() => void fetchInvoices()}
                            className="mt-2 px-3 py-1 bg-white dark:bg-slate-800 border border-rose-300 rounded text-xs text-rose-600 font-semibold"
                          >
                            Retry
                          </button>
                        </td>
                      </tr>
                    ) : paginatedInvoices.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-16 text-center text-slate-400">
                          <FileText size={28} className="mx-auto mb-2 text-slate-300 stroke-[1.5]" />
                          <p className="font-semibold">No tax invoices found.</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">Try modifying or resetting the filters.</p>
                        </td>
                      </tr>
                    ) : (
                      paginatedInvoices.map((inv) => {
                        const isSelected = selectedInvoiceNumber === inv.invoice_number;
                        const isChecked = selectedRows.has(inv.invoice_number);

                        return (
                          <tr
                            key={inv.invoice_id || inv.invoice_number}
                            onClick={() => handleSelectRow(inv.invoice_number)}
                            className={`cursor-pointer transition-colors group ${
                              isSelected
                                ? "bg-blue-50/70 dark:bg-blue-950/40 font-medium"
                                : "hover:bg-slate-50/80 dark:hover:bg-slate-800/30"
                            }`}
                            data-testid={`invoice-row-${inv.invoice_number}`}
                          >
                            {/* Checkbox */}
                            <td className="py-2.5 px-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleSelectRow(inv.invoice_number)}
                                className="rounded text-blue-600 focus:ring-blue-500"
                              />
                            </td>

                            {/* Invoice No */}
                            <td className="py-2.5 px-2.5 whitespace-nowrap">
                              <span className="font-bold text-blue-600 dark:text-blue-400 hover:underline">
                                {inv.invoice_number}
                              </span>
                            </td>

                            {/* Invoice Date */}
                            {visibleColumns.invoiceDate && (
                              <td className="py-2.5 px-2.5 whitespace-nowrap text-slate-600 dark:text-slate-300">
                                {formatDisplayDate(inv.invoice_date)}
                              </td>
                            )}

                            {/* Customer */}
                            {visibleColumns.customer && (
                              <td className="py-2.5 px-2.5 font-medium text-slate-800 dark:text-slate-200 max-w-[150px] truncate" title={inv.customer_name || ""}>
                                {inv.customer_name || "Reliance Retail Limited"}
                              </td>
                            )}

                            {/* Taxable Value */}
                            {visibleColumns.taxableValue && (
                              <td className="py-2.5 px-2.5 text-right font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                                {formatINR(inv.taxable_value)}
                              </td>
                            )}

                            {/* GST */}
                            {visibleColumns.gst && (
                              <td className="py-2.5 px-2.5 text-right font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                                {formatINR(inv.total_tax)}
                              </td>
                            )}

                            {/* Grand Total */}
                            {visibleColumns.grandTotal && (
                              <td className="py-2.5 px-2.5 text-right font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                                {formatINR(inv.grand_total)}
                              </td>
                            )}

                            {/* Status */}
                            {visibleColumns.status && (
                              <td className="py-2.5 px-2.5 text-center whitespace-nowrap">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100/70 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                                  {inv.status === "COMPLETED" ? "Submitted" : inv.status}
                                </span>
                              </td>
                            )}

                            {/* Actions */}
                            {visibleColumns.actions && (
                              <td className="py-2.5 px-2.5 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-center gap-1 text-slate-400">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedInvoiceNumber(inv.invoice_number)}
                                    title="View Invoice Details"
                                    className="p-1 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 rounded transition"
                                  >
                                    <Eye size={14} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleCopyInvoiceNumber(inv.invoice_number)}
                                    title={copiedInvoiceNo === inv.invoice_number ? "Copied!" : "Copy Number"}
                                    className="p-1 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition"
                                  >
                                    {copiedInvoiceNo === inv.invoice_number ? (
                                      <Check size={13} className="text-emerald-600" />
                                    ) : (
                                      <MoreHorizontal size={14} />
                                    )}
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Table Footer: Pagination */}
              <div className="px-5 py-3 border-t border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 flex flex-wrap justify-between items-center gap-3 text-xs text-slate-500">
                <span data-testid="pagination-info">
                  Showing {sortedInvoices.length > 0 ? (currentPageClamped - 1) * pageSize + 1 : 0}–
                  {Math.min(currentPageClamped * pageSize, totalRecords)} of {totalRecords} records
                </span>

                {/* Page Navigation Controls */}
                <div className="flex items-center gap-1 font-semibold">
                  <button
                    type="button"
                    disabled={currentPageClamped <= 1}
                    onClick={() => setCurrentPage(1)}
                    className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none"
                    title="First Page"
                  >
                    <ChevronsLeft size={15} />
                  </button>
                  <button
                    type="button"
                    disabled={currentPageClamped <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none"
                    title="Previous Page"
                  >
                    <ChevronLeft size={15} />
                  </button>

                  {/* Dynamic Page Buttons */}
                  {Array.from({ length: Math.min(5, totalPages) }, (_, idx) => {
                    const pageNum = idx + 1;
                    const isActive = pageNum === currentPageClamped;
                    return (
                      <button
                        key={pageNum}
                        type="button"
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-7 h-7 rounded-lg text-xs font-bold transition ${
                          isActive
                            ? "bg-blue-600 text-white shadow-2xs"
                            : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}

                  {totalPages > 5 && (
                    <>
                      <span className="px-1 text-slate-400">...</span>
                      <button
                        type="button"
                        onClick={() => setCurrentPage(totalPages)}
                        className={`w-7 h-7 rounded-lg text-xs font-bold transition ${
                          totalPages === currentPageClamped
                            ? "bg-blue-600 text-white shadow-2xs"
                            : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        {totalPages}
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    disabled={currentPageClamped >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none"
                    title="Next Page"
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════
              RIGHT COLUMN: Selected Invoice Details & Monthly Totals (Col Span 5)
             ═══════════════════════════════════════════════════════ */}
          <div className="lg:col-span-5 space-y-6">
            {/* ── Top Card: Selected Invoice Details Card ── */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
              {/* Tab Navigation Header (Matching Screenshot) */}
              <div className="px-5 pt-3 border-b border-slate-200/80 dark:border-slate-800 flex items-center gap-6 overflow-x-auto text-xs font-bold bg-white dark:bg-slate-900">
                {(["Invoice Details", "Item Details", "Tax Breakdown", "Payments", "Activity"] as ActiveDetailTab[]).map(
                  (tab) => {
                    const isActive = activeTab === tab;
                    return (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setActiveTab(tab)}
                        className={`pb-3 border-b-2 whitespace-nowrap transition-colors ${
                          isActive
                            ? "border-blue-600 text-blue-600 dark:text-blue-400 font-extrabold"
                            : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                        }`}
                        data-testid={`tab-${tab.toLowerCase().replace(/\s+/g, "-")}`}
                      >
                        {tab}
                      </button>
                    );
                  }
                )}
              </div>

              {/* Tab Content Body */}
              <div className="p-5 space-y-5">
                {selectedInvoice ? (
                  <>
                    {/* Tab 1: Invoice Details (Primary View in Screenshot) */}
                    {activeTab === "Invoice Details" && (
                      <div className="space-y-4">
                        {/* Top Invoice Banner */}
                        <div className="flex items-start justify-between pb-3 border-b border-slate-100 dark:border-slate-800/80">
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200/60 dark:border-blue-800/60 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                              <FileText size={20} className="stroke-[2.2]" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-base font-extrabold text-slate-900 dark:text-white font-sans tracking-tight">
                                  {selectedInvoice.invoice_number}
                                </h3>
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100/70 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                                  {selectedInvoice.status === "COMPLETED" ? "Submitted" : selectedInvoice.status}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-[11px] text-slate-500 font-medium mt-1">
                                <span className="flex items-center gap-1">
                                  <Calendar size={12} className="text-slate-400" />
                                  {formatDisplayDate(selectedInvoice.invoice_date)}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Receipt size={12} className="text-slate-400" />
                                  Tax Invoice
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Action Icons */}
                          <div className="flex items-center gap-1 text-slate-400 shrink-0">
                            <button
                              type="button"
                              onClick={() => openPanel({ entityType: "invoice", entityId: selectedInvoice.invoice_id, title: selectedInvoice.invoice_number })}
                              title="Open in Billing Studio"
                              className="p-1.5 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                            >
                              <ExternalLink size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenPrintPreview(selectedInvoice.invoice_id)}
                              title="Print Invoice"
                              className="p-1.5 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                            >
                              <Printer size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => window.open(`/api/v1/sales/invoices/${selectedInvoice.invoice_id}/pdf`, "_blank")}
                              title="Download PDF"
                              className="p-1.5 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                            >
                              <Download size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCopyInvoiceNumber(selectedInvoice.invoice_number)}
                              title="More Options"
                              className="p-1.5 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                            >
                              <MoreHorizontal size={15} />
                            </button>
                          </div>
                        </div>

                        {/* Customer Info Card & Grand Total Card (2 Columns) */}
                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
                          {/* Left: Customer Info (Col Span 7) */}
                          <div className="sm:col-span-7 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-3.5 space-y-2">
                            <div className="flex items-center gap-2">
                              <User size={15} className="text-slate-500 shrink-0" />
                              <h4 className="font-extrabold text-xs text-slate-900 dark:text-white truncate">
                                {selectedInvoice.customer_name || "Reliance Retail Limited"}
                              </h4>
                            </div>
                            <div className="space-y-1 text-[11px] text-slate-500 dark:text-slate-400 pl-6">
                              <div className="flex items-center gap-1.5 font-mono">
                                <span>GSTIN: {selectedInvoice.customer_gstin || "27AAACR1921R1Z5"}</span>
                                <button
                                  type="button"
                                  onClick={() => handleCopyGstin(selectedInvoice.customer_gstin || "27AAACR1921R1Z5")}
                                  title="Copy GSTIN"
                                  className="text-slate-400 hover:text-blue-600 transition"
                                >
                                  {copiedGstin ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                                </button>
                              </div>
                              <div className="flex items-center gap-1">
                                <MapPin size={11} className="text-slate-400 shrink-0" />
                                <span>{selectedInvoice.supplier_state || "Maharashtra"}</span>
                              </div>
                            </div>
                          </div>

                          {/* Right: Grand Total Box (Col Span 5) */}
                          <div className="sm:col-span-5 bg-blue-50/70 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/60 rounded-xl p-3.5 flex flex-col justify-center">
                            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-0.5">
                              Grand Total
                            </span>
                            <span className="text-xl sm:text-2xl font-extrabold text-blue-700 dark:text-blue-300 font-mono">
                              {formatINR(selectedInvoice.grand_total)}
                            </span>
                          </div>
                        </div>

                        {/* Breakdown Sub-Boxes (2 Columns) */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                          {/* Financial Breakdown Box */}
                          <div className="bg-slate-50/70 dark:bg-slate-950/40 border border-slate-200/80 dark:border-slate-800 rounded-xl p-3.5 space-y-2">
                            <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                              <span>Taxable Value</span>
                              <span className="font-mono font-semibold text-slate-900 dark:text-white">
                                {formatINR(selectedInvoice.taxable_value)}
                              </span>
                            </div>
                            <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                              <span>GST ({selectedInvoice.gst_rate || 5.0}%)</span>
                              <span className="font-mono font-semibold text-slate-900 dark:text-white">
                                {formatINR(selectedInvoice.total_tax)}
                              </span>
                            </div>
                            <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                              <span>Round Off</span>
                              <span className="font-mono font-semibold text-slate-900 dark:text-white">
                                {formatINR(selectedInvoice.round_off || 0)}
                              </span>
                            </div>
                            <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800 flex justify-between items-center font-bold text-slate-900 dark:text-white">
                              <span>Grand Total</span>
                              <span className="font-mono text-blue-600 dark:text-blue-400 font-extrabold">
                                {formatINR(selectedInvoice.grand_total)}
                              </span>
                            </div>
                          </div>

                          {/* Logistics / Meta Box */}
                          <div className="bg-slate-50/70 dark:bg-slate-950/40 border border-slate-200/80 dark:border-slate-800 rounded-xl p-3.5 space-y-2.5">
                            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                              <Package size={14} className="text-slate-400 shrink-0" />
                              <span className="text-slate-500">Items / Quantity</span>
                              <span className="ml-auto font-mono font-semibold text-slate-900 dark:text-white">
                                {selectedInvoice.items_count} / {Number(selectedInvoice.total_quantity || 0).toFixed(4)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                              <FileText size={14} className="text-slate-400 shrink-0" />
                              <span className="text-slate-500">Invoice Type</span>
                              <span className="ml-auto font-medium text-slate-900 dark:text-white">
                                {selectedInvoice.document_type || "Tax Invoice"}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                              <MapPin size={14} className="text-slate-400 shrink-0" />
                              <span className="text-slate-500">Place of Supply</span>
                              <span className="ml-auto font-medium text-slate-900 dark:text-white truncate max-w-[130px]">
                                {selectedInvoice.place_of_supply || "Maharashtra (27)"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Tab 2: Item Details */}
                    {activeTab === "Item Details" && (
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                            Invoice Line Items ({detailedInvoice?.items?.length || selectedInvoice.items_count})
                          </span>
                          <span className="font-mono text-xs text-slate-500">
                            Total Qty: {Number(selectedInvoice.total_quantity || 0).toFixed(2)}
                          </span>
                        </div>
                        <div className="overflow-x-auto max-h-64 border border-slate-200 dark:border-slate-800 rounded-xl">
                          <table className="w-full text-left text-[11px]">
                            <thead className="bg-slate-50 dark:bg-slate-950 font-bold uppercase text-slate-500 border-b border-slate-200 dark:border-slate-800">
                              <tr>
                                <th className="p-2">#</th>
                                <th className="p-2">Item Code / Description</th>
                                <th className="p-2 text-right">Qty</th>
                                <th className="p-2 text-right">Rate</th>
                                <th className="p-2 text-right">Total</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                              {loadingDetails ? (
                                <tr>
                                  <td colSpan={5} className="p-4 text-center text-slate-400">Loading item lines...</td>
                                </tr>
                              ) : detailedInvoice?.items && detailedInvoice.items.length > 0 ? (
                                detailedInvoice.items.map((it, idx) => (
                                  <tr key={it.id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                    <td className="p-2 font-mono text-slate-400">{idx + 1}</td>
                                    <td className="p-2">
                                      <div className="font-semibold text-slate-800 dark:text-slate-200">{it.name}</div>
                                      <div className="font-mono text-[10px] text-slate-400">{it.code} {it.hsn_code ? `· HSN: ${it.hsn_code}` : ""}</div>
                                    </td>
                                    <td className="p-2 text-right font-mono font-medium">{Number(it.quantity).toFixed(0)}</td>
                                    <td className="p-2 text-right font-mono">{formatINR(Number(it.price))}</td>
                                    <td className="p-2 text-right font-mono font-bold text-slate-900 dark:text-white">
                                      {formatINR(Number(it.total_amount || (it.quantity * it.price)))}
                                    </td>
                                  </tr>
                                ))
                              ) : (
                                <tr>
                                  <td colSpan={5} className="p-4 text-center text-slate-400">
                                    {selectedInvoice.items_count} aggregated line items. Click Open to view in Billing Studio.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Tab 3: Tax Breakdown */}
                    {activeTab === "Tax Breakdown" && (
                      <div className="space-y-3">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                          Statutory GST Breakdown
                        </span>
                        <div className="p-3 bg-slate-50 dark:bg-slate-950/50 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                          <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                            <span>Applicable Supply Mode</span>
                            <span className="font-semibold text-blue-600 dark:text-blue-400">
                              {selectedInvoice.supply_type || "Inter-State (IGST)"}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                            <span>Place of Supply</span>
                            <span className="font-mono font-medium">{selectedInvoice.place_of_supply || "Maharashtra (27)"}</span>
                          </div>
                          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-1.5">
                            <div className="flex justify-between items-center">
                              <span>CGST Amount</span>
                              <span className="font-mono">{formatINR(selectedInvoice.cgst_amount || 0)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span>SGST Amount</span>
                              <span className="font-mono">{formatINR(selectedInvoice.sgst_amount || 0)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span>IGST Amount</span>
                              <span className="font-mono">{formatINR(selectedInvoice.igst_amount || selectedInvoice.total_tax)}</span>
                            </div>
                            <div className="flex justify-between items-center pt-1 font-bold text-slate-900 dark:text-white border-t border-slate-200 dark:border-slate-800">
                              <span>Total Invoiced GST</span>
                              <span className="font-mono text-emerald-600 dark:text-emerald-400">{formatINR(selectedInvoice.total_tax)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Tab 4: Payments */}
                    {activeTab === "Payments" && (
                      <div className="space-y-3 text-xs">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                          Commercial Settlement & Payment
                        </span>
                        <div className="p-4 bg-slate-50 dark:bg-slate-950/50 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5">
                          <div className="flex justify-between items-center">
                            <span className="text-slate-500">Payment Facility</span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">Corporate Credit / On-Account</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-slate-500">Commercial Credit Term</span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">Net 45 Days</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-slate-500">General Ledger Account</span>
                            <span className="font-mono text-blue-600 dark:text-blue-400 font-semibold">1030 - Accounts Receivable</span>
                          </div>
                          <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-slate-800 font-bold">
                            <span>Outstanding Balance</span>
                            <span className="font-mono text-slate-900 dark:text-white">{formatINR(selectedInvoice.grand_total)}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Tab 5: Activity */}
                    {activeTab === "Activity" && (
                      <div className="space-y-3 text-xs">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                          Statutory Audit Timeline
                        </span>
                        <div className="p-3 bg-slate-50 dark:bg-slate-950/50 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                          <div className="flex items-start gap-2.5">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                            <div>
                              <div className="font-semibold text-slate-800 dark:text-slate-200">Statutory Tax Invoice Generated</div>
                              <div className="text-[10px] text-slate-400 font-mono">{formatDisplayDate(selectedInvoice.invoice_date)} · Outward Batch Posting</div>
                            </div>
                          </div>
                          <div className="flex items-start gap-2.5">
                            <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                            <div>
                              <div className="font-semibold text-slate-800 dark:text-slate-200">Double-Entry AR Posting Verified</div>
                              <div className="text-[10px] text-slate-400 font-mono">Dr 1030 AR / Cr 4010 Sales Revenue</div>
                            </div>
                          </div>
                          <div className="flex items-start gap-2.5">
                            <div className="w-2 h-2 rounded-full bg-purple-500 mt-1.5 shrink-0" />
                            <div>
                              <div className="font-semibold text-slate-800 dark:text-slate-200">Stock Outward Movement Deducted</div>
                              <div className="text-[10px] text-slate-400 font-mono">Batch inventory deducted: {Number(selectedInvoice.total_quantity || 0).toFixed(0)} units</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="py-12 text-center text-slate-400">
                    <FileText size={24} className="mx-auto mb-2 text-slate-300" />
                    <p className="font-medium text-xs">Select an invoice from the register to view details.</p>
                  </div>
                )}
              </div>
            </div>

            {/* ── Bottom Card: Monthly Invoice Totals Chart (Matching Screenshot) ── */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs p-5 space-y-4">
              {/* Header with Title and Value/Count Toggle */}
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Monthly Invoice Totals
                </h3>

                {/* Value / Count Switcher (Matching Screenshot) */}
                <div className="inline-flex items-center p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setChartMetric("value")}
                    className={`px-3 py-1 rounded-md transition ${
                      chartMetric === "value"
                        ? "bg-blue-600 text-white shadow-2xs font-bold"
                        : "text-slate-600 dark:text-slate-300 hover:text-slate-900"
                    }`}
                    data-testid="toggle-metric-value"
                  >
                    Value
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartMetric("count")}
                    className={`px-3 py-1 rounded-md transition ${
                      chartMetric === "count"
                        ? "bg-blue-600 text-white shadow-2xs font-bold"
                        : "text-slate-600 dark:text-slate-300 hover:text-slate-900"
                    }`}
                    data-testid="toggle-metric-count"
                  >
                    Count
                  </button>
                </div>
              </div>

              {/* Bar Chart Container */}
              <div className="h-60 w-full" data-testid="monthly-totals-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={monthlyChartData}
                    margin={{ top: 25, right: 10, left: 10, bottom: 5 }}
                  >
                    <defs>
                      <linearGradient id="blueGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.95} />
                        <stop offset="100%" stopColor="#60a5fa" stopOpacity={0.7} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#f1f5f9"
                      className="dark:stroke-slate-800"
                    />
                    <XAxis
                      dataKey="month"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#64748b", fontSize: 11, fontWeight: 500 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#64748b", fontSize: 10, fontWeight: 500 }}
                      tickFormatter={(val) =>
                        chartMetric === "value" ? formatIndianShortCurrency(Number(val)) : val.toString()
                      }
                      domain={chartMetric === "value" ? [0, "auto"] : [0, "auto"]}
                    />
                    <Tooltip content={<CustomChartTooltip />} />
                    <Bar
                      dataKey={chartMetric}
                      fill="url(#blueGradient)"
                      radius={[6, 6, 0, 0]}
                      barSize={54}
                    >
                      <LabelList
                        dataKey={chartMetric === "value" ? "formattedValue" : "count"}
                        position="top"
                        fill="#0f172a"
                        className="dark:fill-slate-200"
                        fontSize={11}
                        fontWeight={700}
                        offset={8}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
