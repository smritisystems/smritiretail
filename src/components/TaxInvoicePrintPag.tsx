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
  HelpCircle,
  Zap,
  Truck,
  QrCode,
  CheckCircle2,
  AlertTriangle
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
  irn?: string;
  ackNo?: number;
  ackDate?: string;
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

  // SGIP Statutory Compliance Gateway State
  const [einvoiceState, setEinvoiceState] = useState<{
    irn?: string;
    ackNo?: number;
    ackDate?: string;
    signedQr?: string;
    loading: boolean;
    error?: string;
  }>({ loading: false });

  const [ewaybillState, setEwaybillState] = useState<{
    ewbNo?: string;
    validUpto?: string;
    loading: boolean;
    error?: string;
  }>({ loading: false });
  const [showTransportDialog, setShowTransportDialog] = useState(false);
  const [transportDetails, setTransportDetails] = useState({
    mode: "Road",
    distanceKm: "120",
    transporterId: "",
    transporterName: "",
    vehicleNo: "",
    transportDocNo: "",
    transportDocDate: "",
  });

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
        grandTotal: Number(data.grandTotal ?? data.grand_total ?? data.total_amount ?? 0),
        taxTotal: Number(data.taxTotal ?? data.tax_total ?? 0),
        taxableValue: Number(data.taxableValue ?? data.taxable_value ?? 0),
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
        poRef: data.poRef || data.po_reference || data.po_so_number || data.po_order_reference || data.poOrderReference || "",
        sisCode: data.sisCode || data.sis_code || data.delivery_store_code || "",
        customerGst: data.customerGst || data.customer_gstin || "",
        billingAddressLine1: data.billingAddressLine1 || data.billing_address || data.shippingAddressLine1 || "",
        billingAddressLine2: data.billingAddressLine2 || data.shippingAddressLine2 || "",
        billingCity: data.billingCity || data.shippingCity || "",
        billingState: data.billingState || data.shippingState || "",
        billingPincode: data.billingPincode || data.shippingPincode || "",
        shippingName: data.shippingName || data.customerName || data.customer_name || "",
        shippingAddressLine1: data.shippingAddressLine1 || data.shipping_address || data.billingAddressLine1 || "",
        shippingAddressLine2: data.shippingAddressLine2 || data.billingAddressLine2 || "",
        shippingCity: data.shippingCity || data.billingCity || "",
        shippingState: data.shippingState || data.billingState || "",
        shippingPincode: data.shippingPincode || data.billingPincode || "",
        supplyType: data.supplyType || (data.is_interstate ? "Interstate" : (Number(data.igst_amount || 0) > 0 || Number(data.igst_total || 0) > 0 ? "Interstate" : "Intrastate")),
        placeOfSupply: data.placeOfSupply || data.billingState || "TELANGANA",
        items: (data.items || []).map((item: any) => ({
          ...item,
          code: item.code || item.item_code || item.sku || "",
          name: (() => {
            const rawName = item.name || item.item_name || "Footwear Item";
            const match = rawName.match(/^Tattly Footwear (.+) Size (.+)$/i);
            return match ? `${match[1]} ${match[2]}` : rawName;
          })(),
          hsn: item.hsn || item.hsn_code || "64041990",
          gstPercentage: item.gstPercentage ?? item.gst_rate ?? 5,
          qty: item.qty ?? item.quantity ?? 1,
          quantity: item.quantity ?? item.qty ?? 1,
          rate: item.rate ?? item.unit_price ?? item.price ?? 0,
          unit_price: item.unit_price ?? item.price ?? item.rate ?? 0,
          line_total: item.line_total ?? item.total_amount ?? item.taxable_amount ?? ((item.unit_price || item.rate || 0) * (item.quantity || item.qty || 1)),
          taxable_value: item.taxable_value ?? item.taxable_amount ?? 0,
          discount_percent: item.discount_percent ?? item.disc_pct ?? 0,
          discount_amount: item.discount_amount ?? 0,
          tax_amount: item.tax_amount ?? 0,
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

  const openAuthenticatedDocument = async (endpoint: string, autoPrint = false) => {
    const printWindow = window.open("about:blank", "_blank");
    try {
      const documentData = await apiFetchV1(endpoint);
      const documentBlob = documentData instanceof Blob
        ? documentData
        : new Blob([documentData], { type: "text/html" });
      const documentUrl = URL.createObjectURL(documentBlob);
      if (printWindow) {
        printWindow.location.href = documentUrl;
        if (autoPrint) {
          printWindow.addEventListener("load", () => printWindow.print(), { once: true });
        }
      } else {
        window.open(documentUrl, "_blank");
      }
    } catch (err: any) {
      printWindow?.close();
      setError(`SMRITI-DATA-002: Unable to open the invoice document. (${err?.message || "Verify authentication and backend connection"})`);
    }
  };

  const handlePrint = () => {
    if (activeInvoiceId) {
      void openAuthenticatedDocument(`/sales/invoices/${encodeURIComponent(activeInvoiceId)}/print`, true);
    } else {
      window.print();
    }
  };

  const handleExportPDF = () => {
    if (activeInvoiceId) {
      void openAuthenticatedDocument(`/sales/invoices/${encodeURIComponent(activeInvoiceId)}/download`);
    } else {
      window.print();
    }
  };

  const handleReprint = () => {
    if (activeInvoiceId) {
      void openAuthenticatedDocument(`/sales/invoices/${encodeURIComponent(activeInvoiceId)}/reprint`);
    }
  };

  // SGIP Statutory Compliance Gateway Handlers
  const handleGenerateEInvoice = async () => {
    if (!invoice) return;
    setEinvoiceState(prev => ({ ...prev, loading: true, error: undefined }));
    try {
      const items = (invoice.items || []).map((itm: any, idx: number) => ({
        item_code: itm.itemCode || `SKU-${idx + 1}`,
        description: itm.description || itm.name || itm.itemName || "Retail Garments",
        hsn_code: itm.hsnCode || "6203",
        quantity: Number(itm.qty || itm.quantity || 1),
        unit: "PCS",
        unit_price: Number(itm.rate || itm.unitPrice || 1000),
        gross_amount: Number(itm.amount || itm.grossAmount || 1000),
        discount_amount: Number(itm.discount_amount ?? itm.discount ?? 0),
        taxable_amount: Number(itm.taxable_value ?? itm.taxableValue ?? itm.amount ?? 0),
        gst_rate: Number(itm.gst_rate ?? itm.gstRate ?? 5),
        cgst_amount: Number(itm.cgst_amount ?? itm.cgstAmount ?? 0),
        sgst_amount: Number(itm.sgst_amount ?? itm.sgstAmount ?? 0),
        igst_amount: Number(itm.igst_amount ?? itm.igstAmount ?? 0),
        total_item_value: Number(itm.total_amount ?? itm.total ?? itm.amount ?? 0),
      }));

      const reqPayload = {
        invoice_id: invoice.id || activeInvoiceId,
        invoice_no: invoice.invoiceNo || "INV/2026/001",
        invoice_date: invoice.date ? invoice.date.split("T")[0] : "28/08/2026",
        supplier_gstin: invoice.companyGst || "27AAXFT2508H1ZR",
        supplier_legal_name: headerConfig.companyDisplayName || "Tattly Threads",
        supplier_address: headerConfig.companyAddressDisplay || "Mumbai",
        supplier_pincode: "400003",
        supplier_state_code: "27",
        buyer_gstin: invoice.customerGst || "URP",
        buyer_legal_name: invoice.customerName || "Consumer",
        buyer_address: invoice.customerAddress || "Market",
        buyer_pincode: "400001",
        buyer_state_code: invoice.placeOfSupplyCode || invoice.place_of_supply_code || "27",
        items: items.length > 0 ? items : [{
          item_code: "SKU-001",
          description: "Retail Garments",
          hsn_code: "6203",
          quantity: 1,
          unit: "PCS",
          unit_price: Number(invoice.grandTotal || 1000),
          gross_amount: Number(invoice.grandTotal || 1000),
          discount_amount: 0,
          taxable_amount: Number(invoice.taxableAmount || invoice.grandTotal || 1000),
          gst_rate: 12,
          cgst_amount: Number(invoice.cgstTotal || 0),
          sgst_amount: Number(invoice.sgstTotal || 0),
          igst_amount: Number(invoice.igstTotal || 0),
          total_item_value: Number(invoice.grandTotal || 1000),
        }],
        total_taxable_value: Number(invoice.taxableAmount || invoice.grandTotal || 1000),
        total_cgst_value: Number(invoice.cgstTotal || 0),
        total_sgst_value: Number(invoice.sgstTotal || 0),
        total_igst_value: Number(invoice.igstTotal || 0),
        total_invoice_value: Number(invoice.grandTotal || 1000),
        financial_year: "2026-27",
      };

      const res = await apiFetchV1("/compliance/einvoice/generate", {
        method: "POST",
        body: JSON.stringify(reqPayload),
      });

      setEinvoiceState({
        irn: res.irn,
        ackNo: res.ack_no,
        ackDate: res.ack_date,
        signedQr: res.signed_qr_code,
        loading: false,
      });
      updateHeaderConfig({
        irn: res.irn,
        ackNo: res.ack_no,
        ackDate: res.ack_date,
      });
    } catch (err: any) {
      setEinvoiceState(prev => ({
        ...prev,
        loading: false,
        error: err?.message || "Failed to generate E-Invoice",
      }));
    }
  };

  const buildEWayBillPayload = () => {
    const items = (invoice?.items || []).map((item: any, index: number) => ({
      itemNo: index + 1,
      productName: item.name || item.description || item.itemName || "Item",
      productDesc: item.description || item.name || "Item",
      hsnCode: item.hsnCode || item.hsn_code || "",
      quantity: Number(item.quantity || item.qty || 0),
      qtyUnit: item.unit || "PCS",
      taxableAmount: Number(item.taxable_value || item.taxableValue || item.amount || 0),
      sgstRate: Number(item.sgst_rate || item.sgstRate || 0),
      cgstRate: Number(item.cgst_rate || item.cgstRate || 0),
      igstRate: Number(item.igst_rate || item.igstRate || 0),
      cessRate: 0,
      cessNonAdvol: 0,
    }));
    return {
      userGstin: invoice?.companyGst || "",
      supplyType: "O",
      subSupplyType: 1,
      subSupplyDesc: "",
      docType: "INV",
      docNo: invoice?.invoiceNo || "",
      docDate: invoice?.date ? String(invoice.date).slice(0, 10).split("-").reverse().join("/") : "",
      fromGstin: invoice?.companyGst || "",
      fromTrdName: headerConfig.companyDisplayName,
      fromAddr1: headerConfig.companyAddressDisplay,
      fromPlace: "Mumbai",
      fromPincode: 400003,
      fromStateCode: Number((invoice?.companyGst || "27").slice(0, 2)) || 27,
      actualFromStateCode: Number((invoice?.companyGst || "27").slice(0, 2)) || 27,
      toGstin: invoice?.customerGst || "URP",
      toTrdName: invoice?.customerName || "",
      toAddr1: invoice?.shippingAddress || invoice?.customerAddress || "",
      toPlace: invoice?.pos_state || "",
      toPincode: Number(invoice?.shippingPincode || invoice?.pincode || 0),
      toStateCode: Number(invoice?.placeOfSupplyCode || "27") || 27,
      actualToStateCode: Number(invoice?.placeOfSupplyCode || "27") || 27,
      totalValue: Number(invoice?.taxableAmount || invoice?.taxable_value || 0),
      cgstValue: Number(invoice?.cgstTotal || 0),
      sgstValue: Number(invoice?.sgstTotal || 0),
      igstValue: Number(invoice?.igstTotal || 0),
      cessValue: 0,
      TotNonAdvolVal: 0,
      OthValue: Number(invoice?.rounding_amount || 0),
      totInvValue: Number(invoice?.grandTotal || 0),
      transMode: transportDetails.mode === "Road" ? 1 : transportDetails.mode === "Rail" ? 2 : transportDetails.mode === "Air" ? 3 : 4,
      transDistance: Number(transportDetails.distanceKm || 0),
      transporterName: transportDetails.transporterName.trim(),
      transporterId: transportDetails.transporterId.trim(),
      transDocNo: transportDetails.transportDocNo.trim(),
      transDocDate: transportDetails.transportDocDate,
      vehicleNo: transportDetails.vehicleNo.trim().toUpperCase(),
      vehicleType: "R",
      mainHsnCode: items[0]?.hsnCode || "",
      itemList: items,
    };
  };

  const handleDownloadEWayJson = () => {
    if (!invoice) return;
    const payload = buildEWayBillPayload();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${String(invoice.invoiceNo || "invoice").replace(/[^a-zA-Z0-9-_]/g, "_")}_EWayBill.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleGenerateEWayBill = async () => {
    if (!invoice) return;
    setEwaybillState(prev => ({ ...prev, loading: true, error: undefined }));
    try {
      const reqPayload = {
        invoice_id: invoice.id || activeInvoiceId,
        doc_no: invoice.invoiceNo || "INV/2026/001",
        doc_type: "INV",
        from_gstin: invoice.companyGst || "27AAXFT2508H1ZR",
        to_gstin: invoice.customerGst || "27BBBCU9603R1ZM",
        from_pincode: "400003",
        to_pincode: "400001",
        trans_distance_km: Number(transportDetails.distanceKm),
        vehicle_no: transportDetails.vehicleNo.trim().toUpperCase(),
        transporter_id: transportDetails.transporterId.trim() || undefined,
        transporter_name: transportDetails.transporterName.trim() || undefined,
        transport_doc_no: transportDetails.transportDocNo.trim() || undefined,
        transport_doc_date: transportDetails.transportDocDate || undefined,
        total_invoice_value: Number(invoice.grandTotal || 1000),
      };

      const res = await apiFetchV1("/compliance/ewaybill/generate", {
        method: "POST",
        body: JSON.stringify(reqPayload),
      });

      setEwaybillState({
        ewbNo: res.eway_bill_no,
        validUpto: res.valid_upto,
        loading: false,
      });
      updateHeaderConfig({ eWayBillNo: res.eway_bill_no });
    } catch (err: any) {
      setEwaybillState(prev => ({
        ...prev,
        loading: false,
        error: err?.message || "Failed to generate E-Way Bill",
      }));
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
      irn: headerConfig.irn || einvoiceState.irn,
      ackNo: headerConfig.ackNo || einvoiceState.ackNo,
      ackDate: headerConfig.ackDate || einvoiceState.ackDate,
    };
  }, [invoice, headerConfig, einvoiceState]);

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
            {/* SGIP E-Invoice Action */}
            <button
              onClick={handleGenerateEInvoice}
              disabled={einvoiceState.loading || !!einvoiceState.irn}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-md transition border ${
                einvoiceState.irn
                  ? "bg-emerald-950/80 text-emerald-300 border-emerald-600"
                  : "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400 shadow-emerald-600/30"
              }`}
              title="Generate Statutory GSTN E-Invoice (IRN & Signed QR Code)"
            >
              {einvoiceState.loading ? (
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : einvoiceState.irn ? (
                <CheckCircle2 size={14} className="text-emerald-400" />
              ) : (
                <Zap size={14} />
              )}
              <span>{einvoiceState.irn ? "IRN Active" : "Generate IRN"}</span>
            </button>

            {/* SGIP E-Way Bill Action */}
            <button
              onClick={() => setShowTransportDialog(true)}
              disabled={ewaybillState.loading || !!(ewaybillState.ewbNo || headerConfig.eWayBillNo)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-md transition border ${
                ewaybillState.ewbNo || headerConfig.eWayBillNo
                  ? "bg-amber-950/80 text-amber-300 border-amber-600"
                  : "bg-amber-600 hover:bg-amber-500 text-white border-amber-400 shadow-amber-600/30"
              }`}
              title="Generate Statutory NIC E-Way Bill"
            >
              {ewaybillState.loading ? (
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : ewaybillState.ewbNo || headerConfig.eWayBillNo ? (
                <CheckCircle2 size={14} className="text-amber-400" />
              ) : (
                <Truck size={14} />
              )}
              <span>{ewaybillState.ewbNo || headerConfig.eWayBillNo ? "EWB Active" : "Generate EWB"}</span>
            </button>

            <button
              onClick={handleDownloadEWayJson}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded-lg text-xs font-semibold border border-cyan-700/60 transition"
              title="Download a portal-ready E-Way Bill JSON payload"
            >
              <Download size={14} />
              <span>E-Way JSON</span>
            </button>

            <button
              type="button"
              disabled
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-slate-500 rounded-lg text-xs font-semibold border border-slate-800 cursor-not-allowed"
              title="Live GSP/NIC API submission is coming soon"
            >
              <ShieldCheck size={14} />
              <span>API Coming Soon</span>
            </button>

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
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold shadow-md border border-slate-700 transition"
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

      {/* ── SGIP STATUTORY COMPLIANCE STATUS BANNER (No-Print) ── */}
      {(showTransportDialog || einvoiceState.irn || ewaybillState.ewbNo || headerConfig.eWayBillNo || einvoiceState.error || ewaybillState.error) && (
        <div className="max-w-4xl mx-auto mb-4 no-print">
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 shadow-xl backdrop-blur-md flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-emerald-950 border border-emerald-500/30 text-emerald-400">
                <ShieldCheck size={18} />
              </div>
              <div>
                <div className="flex items-center space-x-2">

            {showTransportDialog && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 no-print">
                <div className="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl">
                  <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
                    <div>
                      <h2 className="text-sm font-bold">Prepare E-Way Bill</h2>
                      <p className="mt-1 text-[11px] text-slate-400">Enter transport details before portal submission.</p>
                    </div>
                    <button type="button" onClick={() => setShowTransportDialog(false)} className="p-1 text-slate-400 hover:text-white" title="Close">
                      <X size={18} />
                    </button>
                  </div>
                  <form
                    className="space-y-4 p-5"
                    onSubmit={async event => {
                      event.preventDefault();
                      await handleGenerateEWayBill();
                      setShowTransportDialog(false);
                    }}
                  >
                    <div className="grid grid-cols-2 gap-3">
                      <label className="text-xs text-slate-300">
                        Transport mode
                        <select value={transportDetails.mode} onChange={event => setTransportDetails(prev => ({ ...prev, mode: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-white">
                          <option>Road</option>
                          <option>Rail</option>
                          <option>Air</option>
                          <option>Ship</option>
                        </select>
                      </label>
                      <label className="text-xs text-slate-300">
                        Distance (KM)
                        <input required min="1" type="number" value={transportDetails.distanceKm} onChange={event => setTransportDetails(prev => ({ ...prev, distanceKm: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-white" />
                      </label>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="text-xs text-slate-300">
                        Vehicle number
                        <input required={transportDetails.mode === "Road"} placeholder="MH12AB1234" value={transportDetails.vehicleNo} onChange={event => setTransportDetails(prev => ({ ...prev, vehicleNo: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 font-mono text-xs uppercase text-white" />
                      </label>
                      <label className="text-xs text-slate-300">
                        Transporter GSTIN / ID
                        <input value={transportDetails.transporterId} onChange={event => setTransportDetails(prev => ({ ...prev, transporterId: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 font-mono text-xs uppercase text-white" />
                      </label>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="text-xs text-slate-300">
                        Transporter name
                        <input value={transportDetails.transporterName} onChange={event => setTransportDetails(prev => ({ ...prev, transporterName: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-white" />
                      </label>
                      <label className="text-xs text-slate-300">
                        LR / transport document no.
                        <input value={transportDetails.transportDocNo} onChange={event => setTransportDetails(prev => ({ ...prev, transportDocNo: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-white" />
                      </label>
                    </div>
                    <label className="block text-xs text-slate-300">
                      Transport document date
                      <input type="date" value={transportDetails.transportDocDate} onChange={event => setTransportDetails(prev => ({ ...prev, transportDocDate: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-white" />
                    </label>
                    <div className="flex items-center justify-between border-t border-slate-800 pt-4">
                      <button type="button" onClick={handleDownloadEWayJson} className="flex items-center gap-2 rounded-lg border border-cyan-700/60 bg-slate-800 px-3 py-2 text-xs font-semibold text-cyan-300">
                        <Download size={14} /> Download JSON
                      </button>
                      <button type="submit" disabled={ewaybillState.loading} className="flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-500 disabled:opacity-50">
                        <Truck size={14} /> Generate E-Way Bill
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
                  <span className="font-bold text-slate-100">SGIP Statutory Status:</span>
                  {einvoiceState.irn && (
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono font-bold border border-emerald-500/40">
                      IRN Active
                    </span>
                  )}
                  {(ewaybillState.ewbNo || headerConfig.eWayBillNo) && (
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono font-bold border border-amber-500/40">
                      EWB Active ({ewaybillState.ewbNo || headerConfig.eWayBillNo})
                    </span>
                  )}
                </div>
                {einvoiceState.irn && (
                  <p className="font-mono text-[10px] text-slate-400 mt-0.5 truncate max-w-xl">
                    IRN: {einvoiceState.irn} | Ack: {einvoiceState.ackNo}
                  </p>
                )}
                {(einvoiceState.error || ewaybillState.error) && (
                  <p className="text-rose-400 text-[11px] mt-0.5 flex items-center gap-1">
                    <AlertTriangle size={12} />
                    <span>{einvoiceState.error || ewaybillState.error}</span>
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-2 text-[11px] text-slate-400 font-mono">
              <span>Sandbox Gateway</span>
              <span>•</span>
              <span>GSTN Schema v1.03</span>
            </div>
          </div>
        </div>
      )}

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
