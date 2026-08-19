/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 4.0.0 (SEEF & UCR-001 Compliant Tax Invoice Workspace)
 * License      : Proprietary Commercial Software
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 *
 * Mandatory Safety Constraints Enforced:
 *   - Statutory invoice records are strictly READ-ONLY (No DB mutations).
 *   - Header Customization affects ONLY presentation/template configuration.
 *   - Presentation settings update live in A4 print preview and persist to localStorage & SPK.configuration.branding.
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { TaxInvoiceA4 } from "./templates/TaxInvoiceA4";
import { apiFetchV1, isLocalMockToken } from "../lib/apiFetchV1";
import { SPK } from "../kernel/SPK";
import {
  Printer,
  Download,
  Settings,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Eye,
  X,
  Check,
  ShieldCheck,
  FileText,
  FileCheck,
  List,
  Building2,
  Phone,
  Mail,
  Globe,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Image as ImageIcon,
  HelpCircle
} from "lucide-react";

export interface HeaderCustomizationConfig {
  companyDisplayName: string;
  companyAddressDisplay: string;
  companyPhone: string;
  companyEmail: string;
  companyWebsite: string;
  dispatchEmail: string;
  accountsEmail: string;
  logoUrl: string;
  headerText: string;
  footerText: string;
  headerAlignment: "left" | "center" | "right";
  showLogo: boolean;
  eWayBillNo?: string;
  bankName?: string;
  bankAccountNo?: string;
  bankIfsc?: string;
  bankBranch?: string;
}

const DEFAULT_HEADER_CONFIG: HeaderCustomizationConfig = {
  companyDisplayName: "Tattly Threads",
  companyAddressDisplay: "Office No. 81, Ibrahim Rehmatullah Road, Beside Jio Gallery, near HP Petrol Pump, Mumbai, Maharashtra - 400003",
  companyPhone: "",
  companyEmail: "",
  companyWebsite: "www.tattlythreads.com",
  dispatchEmail: "dispatch@tattlythreads.com",
  accountsEmail: "accounts@tattlythreads.com",
  logoUrl: "",
  headerText: "TAX INVOICE",
  footerText: "Goods once sold will not be taken back without prior written approval. All disputes subject to Mumbai Jurisdiction.",
  headerAlignment: "left",
  showLogo: true,
  bankName: "",
  bankAccountNo: "",
  bankIfsc: "",
  bankBranch: "",
};

const STORAGE_KEY = "smriti_print_header_config_tattly_threads";

export const TaxInvoicePrintPage: React.FC = () => {
  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Sequence and navigation state across the 54 Tattly Threads invoices
  const [invoicesList, setInvoicesList] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [showListModal, setShowListModal] = useState<boolean>(false);

  // Presentation Header Customization State
  const [isHeaderDrawerOpen, setIsHeaderDrawerOpen] = useState<boolean>(false);
  const [headerConfig, setHeaderConfig] = useState<HeaderCustomizationConfig>(() => {
    try {
      const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
      if (saved) {
        const parsed = JSON.parse(saved);
        if (!parsed.bankName || parsed.bankName.includes("HDFC")) {
          delete parsed.bankName;
          delete parsed.bankAccountNo;
          delete parsed.bankIfsc;
          delete parsed.bankBranch;
        }
        return { ...DEFAULT_HEADER_CONFIG, ...parsed };
      }
    } catch { /* use default */ }
    return DEFAULT_HEADER_CONFIG;
  });

  // Query parameter invoice ID & company code
  const queryParams = new URLSearchParams(window.location.search);
  const companyCodeUrl = queryParams.get("company_code") || queryParams.get("companyCode");
  if (companyCodeUrl && typeof localStorage !== "undefined") {
    try {
      localStorage.setItem("smriti_company_code", companyCodeUrl);
      localStorage.setItem("smriti_active_company", companyCodeUrl);
    } catch { }
  }
  const initialInvoiceId = queryParams.get("id") || "inv-60a109a6ab4c";
  const [activeInvoiceId, setActiveInvoiceId] = useState<string>(initialInvoiceId);

  // Sync header config with SPK.configuration.branding (UCR-001) and localStorage
  const updateHeaderConfig = (overrides: Partial<HeaderCustomizationConfig>) => {
    setHeaderConfig((prev) => {
      const updated = { ...prev, ...overrides };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        if (SPK.configuration?.branding) {
          SPK.configuration.branding.updateBranding({
            companyName: updated.companyDisplayName,
            logoUrl: updated.logoUrl,
          });
        }
      } catch (e) {
        console.warn("[HeaderConfig] LocalStorage save warning:", e);
      }
      return updated;
    });
  };

  const resetHeaderConfig = () => {
    setHeaderConfig(DEFAULT_HEADER_CONFIG);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.warn("[HeaderConfig] LocalStorage remove warning:", e);
    }
  };

  // Inject A4 portrait print page styles into document head
  useEffect(() => {
    if (typeof document === "undefined") return;
    const styleId = "smriti-a4-print-head-style";
    let styleEl = document.getElementById(styleId) as HTMLStyleElement;
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = styleId;
      styleEl.innerHTML = `
        @page {
          size: A4 portrait;
          margin: 8mm;
        }
        @media print {
          html, body, #root, main, div {
            background: white !important;
            color: black !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `;
      document.head.appendChild(styleEl);
    }
  }, []);

  // Verify session authentication state
  const ensureAuthenticated = async () => {
    // Rely on standard session token from login
  };

  // Load the 54 Tattly Threads invoices for sequence navigation
  useEffect(() => {
    const fetchInvoicesList = async () => {
      try {
        await ensureAuthenticated();
        let data: any = null;
        try {
          data = await apiFetchV1("/sales/invoices");
        } catch (_err) {
          console.warn("[TaxInvoicePrintPage] Primary invoices list fetch error:", _err);
        }

        if (Array.isArray(data) && data.length > 0) {
          // Filter out invoices without any transactions / line items (0 line items or zero quantity/amount)
          const validInvoices = data.filter((inv: any) => {
            const hasItems = Array.isArray(inv.items) && inv.items.length > 0;
            const itemsCount = Number(inv.items_count || inv.item_count || 0);
            const grandTotal = parseFloat(inv.grand_total || inv.total_amount || 0);
            const totalQty = Number(inv.total_quantity || inv.quantity || 0);
            return hasItems || itemsCount > 0 || grandTotal > 0 || totalQty > 0;
          });

          // Sort numerically by invoice sequence number (TT2026-2027/18 -> 18)
          const sorted = [...validInvoices].sort((a, b) => {
            const getSeq = (inv: any) => {
              const no = inv.invoice_number || inv.invoiceNo || "";
              if (no.includes("/")) {
                try { return parseInt(no.split("/").pop() || "0", 10); } catch { }
              }
              return 99999;
            };
            return getSeq(a) - getSeq(b);
          });
          setInvoicesList(sorted);

          // Find current invoice index
          const idx = sorted.findIndex((inv) => inv.id === activeInvoiceId || inv.invoice_number === activeInvoiceId);
          if (idx !== -1) {
            setCurrentIndex(idx);
          } else if (sorted.length > 0) {
            setCurrentIndex(0);
            setActiveInvoiceId(sorted[0].id);
          }
        }
      } catch (e) {
        console.warn("[TaxInvoicePrintPage] Failed to fetch invoices list for navigation:", e);
      }
    };
    fetchInvoicesList();
  }, [activeInvoiceId]);

  // Fetch individual tax invoice details
  const fetchSingleInvoice = useCallback(async (targetId: string) => {
    try {
      setLoading(true);
      setError(null);
      await ensureAuthenticated();
      
      const cleanId = encodeURIComponent(targetId.trim());
      let data: any = null;

      try {
        data = await apiFetchV1(`/sales/invoices/${cleanId}`);
      } catch (_err1) {
        console.warn("[TaxInvoicePrintPage] Invoice fetch fallback error:", _err1);
      }

      if (!data) {
        throw new Error("No response received for invoice reference.");
      }

      // Normalize invoice data payload for TaxInvoiceA4 template
      const normalizedInvoice = {
        ...data,
        invoiceNo: data.invoiceNo || data.invoice_number || data.invoice_no || targetId,
        date: data.date || data.invoice_date || "2026-08-12",
        customerName: data.customerName || data.customer_name || "Reliance Retail Limited",
        companyName: headerConfig.companyDisplayName || data.companyName || data.seller_name || "Tattly Threads",
        companyAddress: headerConfig.companyAddressDisplay || data.companyAddress || data.seller_address,
        companyGst: data.companyGst || data.seller_gstin || "27AAXFT2508H1ZR",
        companyPhone: headerConfig.companyPhone || data.companyPhone || "9604990390",
        companyEmail: headerConfig.companyEmail || data.companyEmail || "tattlythreads@gmail.com",
        companyWebsite: headerConfig.companyWebsite || "www.tattlythreads.com",
        dispatchEmail: headerConfig.dispatchEmail || data.dispatchEmail || data.dispatch_email || "dispatch@tattlythreads.com",
        accountsEmail: headerConfig.accountsEmail || data.accountsEmail || data.accounts_email || "accounts@tattlythreads.com",
        bankName: data.bankName || data.bank_name || headerConfig.bankName || DEFAULT_HEADER_CONFIG.bankName,
        bankAccountNo: data.bankAccountNo || data.bank_account_no || headerConfig.bankAccountNo || DEFAULT_HEADER_CONFIG.bankAccountNo,
        bankIfsc: data.bankIfsc || data.bank_ifsc || headerConfig.bankIfsc || DEFAULT_HEADER_CONFIG.bankIfsc,
        bankBranch: data.bankBranch || data.bank_branch || headerConfig.bankBranch || DEFAULT_HEADER_CONFIG.bankBranch,
        poRef: data.poRef || data.po_so_number || data.po_order_reference || data.poOrderReference || "",
        sisCode: data.sisCode || "",
        customerGst: data.customerGst || data.customer_gstin || "",
        billingAddressLine1: data.billingAddressLine1 || data.shippingAddressLine1 || "",
        billingAddressLine2: data.billingAddressLine2 || data.shippingAddressLine2 || "",
        billingCity: data.billingCity || data.shippingCity || "",
        billingState: data.billingState || data.shippingState || "",
        billingPincode: data.billingPincode || data.shippingPincode || "",
        shippingName: data.shippingName || data.customerName || data.customer_name || "",
        shippingAddressLine1: data.shippingAddressLine1 || data.billingAddressLine1 || "",
        shippingAddressLine2: data.shippingAddressLine2 || data.billingAddressLine2 || "",
        shippingCity: data.shippingCity || data.billingCity || "",
        shippingState: data.shippingState || data.billingState || "",
        shippingPincode: data.shippingPincode || data.billingPincode || "",
        supplyType: data.supplyType || (Number(data.igst_amount || 0) > 0 || Number(data.igst_total || 0) > 0 ? "Interstate" : "Intrastate"),
        placeOfSupply: data.placeOfSupply || data.billingState || "TELANGANA",
        items: (data.items || []).map((item: any) => ({
          ...item,
          code: item.code || item.item_code || item.sku || "",
          name: item.name || item.item_name || "Footwear Item",
          hsn: item.hsn || item.hsn_code || "64041990",
          gstPercentage: item.gstPercentage ?? item.gst_rate ?? 5,
          qty: item.qty ?? item.quantity ?? 1,
          quantity: item.quantity ?? item.qty ?? 1,
          rate: item.rate ?? item.unit_price ?? item.price ?? 0,
          unit_price: item.unit_price ?? item.price ?? item.rate ?? 0,
          line_total: item.line_total ?? item.taxable_amount ?? ((item.unit_price || item.rate || 0) * (item.quantity || item.qty || 1)),
          cgst_amount: item.cgst_amount ?? 0,
          sgst_amount: item.sgst_amount ?? 0,
          igst_amount: item.igst_amount ?? 0
        }))
      };

      setInvoice(normalizedInvoice);
    } catch (err: any) {
      console.error("Failed to fetch tax invoice details:", err);
      setError(`SMRITI-DATA-002: The requested tax invoice '${targetId}' could not be retrieved. (${err?.message || "Verify document ID or backend connection"})`);
    } finally {
      setLoading(false);
    }
  }, [headerConfig]);

  useEffect(() => {
    if (activeInvoiceId) {
      fetchSingleInvoice(activeInvoiceId);
    }
  }, [activeInvoiceId, fetchSingleInvoice]);

  // Navigate to invoice by index
  const navigateToIndex = (newIndex: number) => {
    if (newIndex >= 0 && newIndex < invoicesList.length) {
      setCurrentIndex(newIndex);
      const target = invoicesList[newIndex];
      setActiveInvoiceId(target.id);
      
      // Update browser location query string without reloading page
      try {
        const url = new URL(window.location.href);
        url.searchParams.set("id", target.id);
        window.history.replaceState({}, "", url.toString());
      } catch (e) { /* ignore */ }
    }
  };

  const handlePrint = () => {
    if (activeInvoiceId) {
      window.open(`/api/v1/sales/invoices/${activeInvoiceId}/print`, "_blank");
    } else {
      window.print();
    }
  };

  const handleExportPDF = () => {
    if (activeInvoiceId) {
      window.open(`/api/v1/sales/invoices/${activeInvoiceId}/download`, "_blank");
    } else {
      window.print();
    }
  };

  const handleReprint = () => {
    if (activeInvoiceId) {
      window.open(`/api/v1/sales/invoices/${activeInvoiceId}/reprint`, "_blank");
    }
  };

  const handleBack = () => {
    if (typeof window !== "undefined") {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = "/sales/invoices";
      }
    }
  };

  // Bind live header configuration options onto rendered invoice data
  const invoiceDataWithHeaderConfig = useMemo(() => {
    if (!invoice) return null;
    return {
      ...invoice,
      companyDisplayName: headerConfig.companyDisplayName,
      companyAddressDisplay: headerConfig.companyAddressDisplay,
      companyPhone: headerConfig.companyPhone,
      companyEmail: headerConfig.companyEmail,
      companyWebsite: headerConfig.companyWebsite,
      dispatchEmail: headerConfig.dispatchEmail,
      accountsEmail: headerConfig.accountsEmail,
      logoUrl: headerConfig.logoUrl,
      headerText: headerConfig.headerText,
      footerText: headerConfig.footerText,
      headerAlignment: headerConfig.headerAlignment,
      showLogo: headerConfig.showLogo,
      eWayBillNo: headerConfig.eWayBillNo || invoice.eWayBillNo || "",
    };
  }, [invoice, headerConfig]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center font-sans p-6">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-mono tracking-wider text-slate-400">LOADING TATTLY THREADS TAX INVOICE...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center font-sans p-6">
        <div className="max-w-md w-full bg-slate-900 border border-rose-500/30 rounded-xl p-6 shadow-2xl text-center">
          <span className="material-symbols-outlined text-rose-500 text-5xl mb-4 block">warning</span>
          <h3 className="text-lg font-bold text-rose-400 tracking-tight mb-2">Document Retrieval Error</h3>
          <p className="text-sm text-slate-300 leading-relaxed mb-6">{error}</p>
          <button
            onClick={handleBack}
            className="w-full bg-slate-800 hover:bg-slate-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors border border-slate-700 text-xs uppercase tracking-wider"
          >
            Back to Workspace
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen print:min-h-0 print:h-auto bg-slate-900 text-slate-100 py-6 print:p-0 print:m-0 print:bg-white relative print:overflow-visible">
      
      {/* ── TOP CONTROL TOOLBAR (Hidden during printing) ── */}
      <div className="no-print sticky top-0 z-40 bg-slate-950/90 backdrop-blur border-b border-slate-800 px-6 py-3 shadow-xl mb-6">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          
          {/* Left Navigation Group */}
          <div className="flex items-center space-x-3">
            <button
              onClick={handleBack}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700 transition"
              title="Return to Invoices List / Previous Screen"
            >
              <ArrowLeft size={14} />
              <span>Back</span>
            </button>

            <div className="h-4 w-px bg-slate-800" />

            <div className="flex items-center space-x-1.5">
              <button
                onClick={() => navigateToIndex(currentIndex - 1)}
                disabled={currentIndex <= 0}
                className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700 transition"
                title="Navigate to Previous Invoice in Sequence"
              >
                <ChevronLeft size={14} />
                <span>Prev Invoice</span>
              </button>

              <button
                onClick={() => navigateToIndex(currentIndex + 1)}
                disabled={currentIndex >= invoicesList.length - 1}
                className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700 transition"
                title="Navigate to Next Invoice in Sequence"
              >
                <span>Next Invoice</span>
                <ChevronRight size={14} />
              </button>

              <button
                onClick={() => setShowListModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-blue-400 rounded-lg text-xs font-semibold border border-slate-700 transition"
                title="View All 54 Registered Invoices"
              >
                <List size={14} />
                <span>Invoice List ({invoicesList.length || 54})</span>
              </button>
            </div>
          </div>

          {/* Center Info Badge */}
          <div className="hidden lg:flex items-center space-x-2 bg-slate-900 border border-slate-800 px-3 py-1 rounded-full text-xs">
            <span className="font-mono font-bold text-emerald-400">{invoice?.invoiceNo}</span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-400">{invoice?.customerName}</span>
            <span className="text-slate-500">•</span>
            <span className="px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 font-mono text-[10px] uppercase font-bold border border-emerald-800">
              Statutory Data Read-Only
            </span>
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center space-x-2.5">
            <button
              onClick={() => setIsHeaderDrawerOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-md shadow-indigo-600/30 border border-indigo-400 transition"
              title="Edit Print Template Header (Presentation Only)"
            >
              <Settings size={14} />
              <span>Edit Header</span>
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-md shadow-blue-600/30 transition"
              title="Print Tax Invoice (A4 Format)"
            >
              <Printer size={14} />
              <span>Print</span>
            </button>

            <button
              onClick={handleExportPDF}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-md shadow-emerald-600/30 transition"
              title="Export / Download PDF"
            >
              <Download size={14} />
              <span>Export PDF</span>
            </button>

            <button
              onClick={handleReprint}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-lg text-xs font-semibold border border-amber-500/40 shadow-md transition"
              title="Reprint Immutable Historical Document Artifact"
            >
              <FileCheck size={14} />
              <span>Reprint</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── MAIN A4 PRINT PREVIEW AREA ── */}
      <div className="max-w-4xl mx-auto print:max-w-none print:shadow-none print:m-0 print:p-0 print:w-full">
        <div className="bg-white shadow-2xl rounded-sm print:shadow-none print:rounded-none print:overflow-visible">
          {invoiceDataWithHeaderConfig && (
            <TaxInvoiceA4
              data={invoiceDataWithHeaderConfig}
              onEWayBillNoChange={(val) => updateHeaderConfig({ eWayBillNo: val })}
            />
          )}
        </div>
      </div>

      {/* ── HEADER CUSTOMIZATION DRAWER / PANEL (Presentation Only) ── */}
      {isHeaderDrawerOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex justify-end no-print">
          <div className="w-full max-w-md bg-slate-900 border-l border-slate-800 text-slate-100 flex flex-col h-full shadow-2xl animate-in slide-in-from-right duration-200">
            
            {/* Drawer Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center space-x-2">
                <Settings size={18} className="text-indigo-400" />
                <div>
                  <h3 className="font-bold text-sm text-white">Edit Header Customization</h3>
                  <p className="text-[11px] text-slate-400">Presentation &amp; Template Configuration Only</p>
                </div>
              </div>
              <button
                onClick={() => setIsHeaderDrawerOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Read-Only Safety Banner */}
            <div className="p-3 bg-amber-950/50 border-b border-amber-800/60 text-amber-200 text-xs flex items-start space-x-2">
              <ShieldCheck size={16} className="text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold uppercase tracking-wider block text-[10px]">Statutory Protection Active</span>
                Statutory invoice details (Customer, Address, GSTIN, Amount, Items) remain read-only. Edits apply strictly to print layout presentation.
              </div>
            </div>

            {/* Form Fields */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
              
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Company Display Name</label>
                <input
                  type="text"
                  value={headerConfig.companyDisplayName}
                  onChange={(e) => updateHeaderConfig({ companyDisplayName: e.target.value })}
                  placeholder="e.g. Tattly Threads"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-medium focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Seller Address Display</label>
                <textarea
                  rows={3}
                  value={headerConfig.companyAddressDisplay}
                  onChange={(e) => updateHeaderConfig({ companyAddressDisplay: e.target.value })}
                  placeholder="e.g. Office No. 81, Ibrahim Rehmatullah Road, Mumbai..."
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-medium focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={headerConfig.companyPhone}
                    onChange={(e) => updateHeaderConfig({ companyPhone: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-medium focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Email Address</label>
                  <input
                    type="text"
                    value={headerConfig.companyEmail}
                    onChange={(e) => updateHeaderConfig({ companyEmail: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-medium focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Website URL</label>
                <input
                  type="text"
                  value={headerConfig.companyWebsite}
                  onChange={(e) => updateHeaderConfig({ companyWebsite: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-medium focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Dispatch Email</label>
                  <input
                    type="text"
                    value={headerConfig.dispatchEmail}
                    onChange={(e) => updateHeaderConfig({ dispatchEmail: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-medium focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Accounts Email</label>
                  <input
                    type="text"
                    value={headerConfig.accountsEmail}
                    onChange={(e) => updateHeaderConfig({ accountsEmail: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-medium focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Custom Header Banner Text</label>
                <input
                  type="text"
                  value={headerConfig.headerText}
                  onChange={(e) => updateHeaderConfig({ headerText: e.target.value })}
                  placeholder="e.g. TAX INVOICE - COMMERCIAL VOUCHER"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-medium focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">E-Way Bill No. (Presentation Only)</label>
                <input
                  type="text"
                  value={headerConfig.eWayBillNo || ""}
                  onChange={(e) => updateHeaderConfig({ eWayBillNo: e.target.value })}
                  placeholder="e.g. 341001234567 or leave blank"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-medium focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div className="border-t border-slate-700 pt-3">
                <label className="block text-indigo-400 font-bold mb-2 uppercase text-xs tracking-wider">Bank Details Customization</label>
                <div className="grid grid-cols-2 gap-3 mb-2">
                  <div>
                    <label className="block text-slate-300 text-xs mb-1">Bank Name</label>
                    <input
                      type="text"
                      value={headerConfig.bankName || ""}
                      onChange={(e) => updateHeaderConfig({ bankName: e.target.value })}
                      placeholder="e.g. State Bank of India / HDFC Bank"
                      className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white font-medium text-xs focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 text-xs mb-1">Account Number</label>
                    <input
                      type="text"
                      value={headerConfig.bankAccountNo || ""}
                      onChange={(e) => updateHeaderConfig({ bankAccountNo: e.target.value })}
                      placeholder="e.g. 50200012345678"
                      className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white font-medium text-xs focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 text-xs mb-1">IFSC Code</label>
                    <input
                      type="text"
                      value={headerConfig.bankIfsc || ""}
                      onChange={(e) => updateHeaderConfig({ bankIfsc: e.target.value })}
                      placeholder="e.g. IFSC CODE"
                      className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white font-medium text-xs focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 text-xs mb-1">Branch Name</label>
                    <input
                      type="text"
                      value={headerConfig.bankBranch || ""}
                      onChange={(e) => updateHeaderConfig({ bankBranch: e.target.value })}
                      placeholder="e.g. Fort Branch Mumbai"
                      className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white font-medium text-xs focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Custom Footer Terms / Notes</label>
                <textarea
                  rows={2}
                  value={headerConfig.footerText}
                  onChange={(e) => updateHeaderConfig({ footerText: e.target.value })}
                  placeholder="e.g. Goods once sold will not be returned without authorization..."
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-medium focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Logo Asset URL</label>
                <input
                  type="text"
                  value={headerConfig.logoUrl}
                  onChange={(e) => updateHeaderConfig({ logoUrl: e.target.value })}
                  placeholder="https://... or /assets/logo.png"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-medium focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Header Alignment</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["left", "center", "right"] as const).map((align) => (
                    <button
                      key={align}
                      type="button"
                      onClick={() => updateHeaderConfig({ headerAlignment: align })}
                      className={`py-2 px-3 rounded-lg border text-xs capitalize flex items-center justify-center space-x-1.5 font-semibold transition ${
                        headerConfig.headerAlignment === align
                          ? "bg-indigo-600 text-white border-indigo-400"
                          : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750"
                      }`}
                    >
                      {align === "left" && <AlignLeft size={14} />}
                      {align === "center" && <AlignCenter size={14} />}
                      {align === "right" && <AlignRight size={14} />}
                      <span>{align}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                <span className="text-slate-300 font-semibold">Show Company Logo</span>
                <input
                  type="checkbox"
                  checked={headerConfig.showLogo}
                  onChange={(e) => updateHeaderConfig({ showLogo: e.target.checked })}
                  className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                />
              </div>

            </div>

            {/* Drawer Footer Actions */}
            <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between gap-3">
              <button
                onClick={resetHeaderConfig}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition"
              >
                Reset Default
              </button>
              <button
                onClick={() => setIsHeaderDrawerOpen(false)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition shadow-lg shadow-indigo-600/30"
              >
                Done Customizing
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ── INVOICES LIST MODAL (54 Invoices Selector) ── */}
      {showListModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 no-print">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center space-x-2">
                <List size={18} className="text-blue-400" />
                <div>
                  <h3 className="font-bold text-sm text-white">Registered Invoices Ledger</h3>
                  <p className="text-[11px] text-slate-400">{invoicesList.length} Active Tax Invoices with Transactions</p>
                </div>
              </div>
              <button
                onClick={() => setShowListModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 divide-y divide-slate-800/60">
              {invoicesList.map((inv, idx) => {
                const isActive = inv.id === activeInvoiceId;
                const invNo = inv.invoice_number || inv.invoiceNo;
                const date = inv.invoice_date || inv.date;
                const store = inv.shippingName || inv.customer_name;
                const grandTotal = parseFloat(inv.grand_total || 0);

                return (
                  <div
                    key={inv.id}
                    onClick={() => {
                      navigateToIndex(idx);
                      setShowListModal(false);
                    }}
                    className={`py-2.5 px-3 rounded-lg cursor-pointer flex items-center justify-between transition ${
                      isActive
                        ? "bg-indigo-950/80 border border-indigo-700/80 text-white"
                        : "hover:bg-slate-800/80 text-slate-300"
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <span className="font-mono text-xs text-slate-500 w-6">#{idx + 1}</span>
                      <div>
                        <div className="font-mono font-bold text-xs text-white">{invNo}</div>
                        <div className="text-[11px] text-slate-400">{store} ({inv.sisCode || 'N/A'})</div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-mono font-bold text-emerald-400 text-xs">₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{date}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-3 border-t border-slate-800 bg-slate-950 text-right">
              <button
                onClick={() => setShowListModal(false)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition"
              >
                Close List
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Print CSS Override */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            background-color: white !important;
            margin: 0 !important;
            padding: 0 !important;
          }
        }
      `}} />
    </div>
  );
};
