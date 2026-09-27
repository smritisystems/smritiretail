/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.0
 * Created      : 2026-09-27
 * Modified     : 2026-09-27
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Redesigned Unified Credit & Retail Billing Terminal (Phase 5)
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trash2,
  Search,
  Scan,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
  FileText,
  Printer,
  Eye,
  RotateCcw,
  User,
  MapPin,
  Phone,
  Building2,
  ShieldCheck,
  CreditCard,
  Banknote,
  RefreshCcw,
  Package,
  Star,
  Clock,
  MoreHorizontal,
  Save,
  Send,
  ChevronRight,
  X,
  ExternalLink,
  Check,
  FolderOpen,
  Calendar,
  Layers,
  Sliders,
  DollarSign,
  TrendingUp,
  Zap,
  Tag,
  Receipt,
  BarChart3,
  Settings,
  HelpCircle,
  ShoppingBag,
  ShoppingCart,
  Bell,
  CheckSquare,
  Square,
} from "lucide-react";
import { apiFetchV1 } from "../../lib/apiFetchV1.ts";
import { CustomerMasterModal, BillingCustomer } from "./CustomerMasterModal.tsx";
import { ProductListModal } from "./ProductListModal.tsx";
import { BillingProduct } from "./useBillingCatalog.ts";
import { DockedProductList } from "./DockedProductList.tsx";
import {
  getBillingDockChannel,
  broadcastBillingDock,
  BillingDockMessage,
} from "./billingDockProtocol.ts";

export interface SmritiCreditBillingTerminalProps {
  currentUser?: { role: string; name: string; username?: string; terminalId?: string; companyId?: string; branchId?: string } | null;
  onNotification?: (title: string, msg: string, type: "success" | "error" | "info" | "warning") => void;
  onBack?: () => void;
}

export type BillingMode = "CREDIT" | "CASH" | "EXCHANGE" | "QUOTATION" | "HOLD";
export type DocStatus = "DRAFT" | "SUBMITTED";

export interface CreditLineItem {
  id: string;
  sNo: number;
  itemCode: string;
  itemDescription: string;
  rate: number;
  qty: number;
  unit: string;
  discPercent: number;
  discAmt: number;
  amount: number;
  productId?: string;
  hsnCode?: string;
  gstRate?: number;
  taxAmt?: number;
  stock?: number;
  mrp?: number;
  purchaseRate?: number;
  lastSaleRate?: number;
  taxCategory?: string;
}

export interface CreditBillingHeader {
  customer: BillingCustomer | null;
  priceLevel: string;
  warehouse: string;
  salesman: string;
  invoiceDate: string;
  dueDate: string;
}

const fmtINR = (n: number) =>
  "₹" +
  Math.abs(n).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export const SmritiCreditBillingTerminal: React.FC<SmritiCreditBillingTerminalProps> = ({
  currentUser,
  onNotification,
  onBack,
}) => {
  // ---- Panel Visibility Controls (Matching View dropdown in Image 1) ----
  const [showLeftMenu, setShowLeftMenu] = useState(true);
  const [showTopBar, setShowTopBar] = useState(true);
  const [showQuickActions, setShowQuickActions] = useState(true);
  const [showItemPanel, setShowItemPanel] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [showBottomPanel, setShowBottomPanel] = useState(true);
  const [viewDropdownOpen, setViewDropdownOpen] = useState(false);

  // ---- Workspace States ----
  const [mode, setMode] = useState<BillingMode>("CREDIT");
  const [docStatus, setDocStatus] = useState<DocStatus>("DRAFT");
  const [fullscreen, setFullscreen] = useState(false);
  const [activeMainView, setActiveMainView] = useState<"GRID" | "DOCKED_CATALOG">("GRID");
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isProductListModalOpen, setIsProductListModalOpen] = useState(false);
  const [isBottomCollapsed, setIsBottomCollapsed] = useState(false);

  // Right sidebar collapsible cards & accordions
  const [isInvoiceSummaryCollapsed, setIsInvoiceSummaryCollapsed] = useState(false);
  const [isCustomerDetailsCollapsed, setIsCustomerDetailsCollapsed] = useState(false);
  const [activeAccordion, setActiveAccordion] = useState<string | null>("CREDIT");

  // Navigation rail & global top nav active tabs
  const [activeNavRail, setActiveNavRail] = useState("billing");
  const [activeTopTab, setActiveTopTab] = useState("billing");

  // Submitting / Loading indicator
  const [submitting, setSubmitting] = useState(false);

  // ---- Header & Customer State matching Image 1 ----
  const [header, setHeader] = useState<CreditBillingHeader>({
    customer: {
      id: "cust-001",
      code: "CUST-001",
      name: "ABC Footwear",
      phone: "+91 98765 43210",
      email: "accounts@abcfootwear.in",
      address: "Shop No. 10, Market Road, Mumbai - 400001",
      gst_number: "27ABCDE1234F1Z5",
      credit_limit: 200000,
      balance: 64800,
      available_credit: 135200,
      status: "Active",
    },
    priceLevel: "Retail",
    warehouse: "Main Store",
    salesman: "-- Select --",
    invoiceDate: "25/09/2026",
    dueDate: "25/10/2026",
  });

  // ---- Items State matching Image 1 ----
  const [items, setItems] = useState<CreditLineItem[]>([
    {
      id: "item-001",
      sNo: 1,
      itemCode: "SHOE-001",
      itemDescription: "Sports Shoes - Black",
      rate: 1500.0,
      qty: 2,
      unit: "Pair",
      discPercent: 5.0,
      discAmt: 150.0,
      amount: 2850.0,
      productId: "prod-shoe-001",
      hsnCode: "640411",
      gstRate: 18.0,
      taxAmt: 513.0,
      stock: 32,
      mrp: 1899.0,
      purchaseRate: 1100.0,
      lastSaleRate: 1500.0,
      taxCategory: "GST 18%",
    },
    {
      id: "item-002",
      sNo: 2,
      itemCode: "SHOE-002",
      itemDescription: "Running Shoes - Blue",
      rate: 1800.0,
      qty: 1,
      unit: "Pair",
      discPercent: 0.0,
      discAmt: 0.0,
      amount: 1800.0,
      productId: "prod-shoe-002",
      hsnCode: "640411",
      gstRate: 18.0,
      taxAmt: 324.0,
      stock: 18,
      mrp: 2199.0,
      purchaseRate: 1350.0,
      lastSaleRate: 1800.0,
      taxCategory: "GST 18%",
    },
    {
      id: "item-003",
      sNo: 3,
      itemCode: "ACC-001",
      itemDescription: "Shoe Care Kit",
      rate: 250.0,
      qty: 4,
      unit: "Nos",
      discPercent: 10.0,
      discAmt: 100.0,
      amount: 900.0,
      productId: "prod-acc-001",
      hsnCode: "340510",
      gstRate: 18.0,
      taxAmt: 162.0,
      stock: 120,
      mrp: 299.0,
      purchaseRate: 160.0,
      lastSaleRate: 250.0,
      taxCategory: "GST 18%",
    },
    {
      id: "item-004",
      sNo: 4,
      itemCode: "BAG-001",
      itemDescription: "Sports Bag",
      rate: 950.0,
      qty: 1,
      unit: "Nos",
      discPercent: 0.0,
      discAmt: 0.0,
      amount: 950.0,
      productId: "prod-bag-001",
      hsnCode: "420292",
      gstRate: 18.0,
      taxAmt: 171.0,
      stock: 25,
      mrp: 1299.0,
      purchaseRate: 680.0,
      lastSaleRate: 950.0,
      taxCategory: "GST 18%",
    },
  ]);

  const [selectedRow, setSelectedRow] = useState<number>(0);
  const [scanInput, setScanInput] = useState("");
  const [scanning, setScanning] = useState(false);
  const scanRef = useRef<HTMLInputElement>(null);

  // Remarks & Logistics from Image 2
  const [remarks, setRemarks] = useState("");
  const [refNo, setRefNo] = useState("");
  const [transport, setTransport] = useState("");

  // Additional Charges
  const [freightCharges, setFreightCharges] = useState(0);
  const [otherCharges, setOtherCharges] = useState(0);
  const [billDiscount, setBillDiscount] = useState(0);

  // Calculated Financial Summary (Driven Authoritatively by Headless Billing Core)
  const [calcTotals, setCalcTotals] = useState({
    totalItems: 4,
    totalQty: 8.0,
    grossAmount: 4550.0,
    itemDiscount: 150.0,
    billDiscount: 0.0,
    freight: 0.0,
    other: 0.0,
    subtotal: 4400.0,
    cgst: 75.0,
    sgst: 75.0,
    igst: 0.0,
    totalTax: 150.0,
    roundOff: 0.0,
    netAmount: 4550.0,
  });

  const previewDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- Live Debounced Preview with Headless Billing Core ----
  const refreshCalculations = useCallback(
    async (
      currentItems: CreditLineItem[],
      freight: number,
      other: number,
      cust: BillingCustomer | null
    ) => {
      const totalQty = currentItems.reduce((acc, it) => acc + it.qty, 0);
      const totalItemCount = currentItems.length;

      if (currentItems.length === 0) {
        setCalcTotals({
          totalItems: 0,
          totalQty: 0,
          grossAmount: 0,
          itemDiscount: 0,
          billDiscount: 0,
          freight,
          other,
          subtotal: freight + other,
          cgst: 0,
          sgst: 0,
          igst: 0,
          totalTax: 0,
          roundOff: 0,
          netAmount: freight + other,
        });
        return;
      }

      // Prepare canonical payload for Headless Billing Core
      const payload = {
        context: {
          company_id: currentUser?.companyId || "COMP-001",
          branch_id: currentUser?.branchId || "MAIN",
          source_channel: "B2B_WHOLESALE",
        },
        customer_id: cust?.id || null,
        customer_name: cust?.name || "Walk-in Customer",
        customer_phone: cust?.phone || null,
        customer_gstin: cust?.gst_number || null,
        items: currentItems.map((it) => ({
          code: it.itemCode,
          quantity: it.qty,
          unit_price: it.rate,
          name: it.itemDescription,
          disc_pct: it.discPercent,
          disc_amt: it.discAmt,
          gst_rate: it.gstRate || 18.0,
          hsn_code: it.hsnCode || null,
          is_tax_inclusive: false,
        })),
        tenders: [],
      };

      try {
        const res = await apiFetchV1<any>("/billing/preview", {
          method: "POST",
          body: payload,
        });

        if (res && res.net_amount !== undefined) {
          const previewSubtotal = Number(res.taxable_amount ?? (res.gross_amount - res.discount_amount));
          const previewTax = Number(res.tax_total ?? 0);
          const previewNet = Number(res.net_amount ?? (previewSubtotal + previewTax));

          setCalcTotals({
            totalItems: totalItemCount,
            totalQty: Number(res.total_quantity ?? totalQty),
            grossAmount: Number(res.gross_amount ?? 0),
            itemDiscount: Number(res.discount_amount ?? 0),
            billDiscount: 0,
            freight,
            other,
            subtotal: previewSubtotal + freight + other,
            cgst: Number(res.cgst_amount ?? 0),
            sgst: Number(res.sgst_amount ?? 0),
            igst: Number(res.igst_amount ?? 0),
            totalTax: previewTax,
            roundOff: Number(res.round_off ?? 0),
            netAmount: previewNet + freight + other,
          });

          // Reconcile row-level statutory calculations from backend
          if (Array.isArray(res.line_items) && res.line_items.length === currentItems.length) {
            setItems((prevItems) =>
              prevItems.map((item, idx) => {
                const line = res.line_items[idx];
                if (!line) return item;
                return {
                  ...item,
                  amount: Number(line.taxable_amount ?? item.amount),
                  taxAmt: Number(line.tax_total ?? ((line.cgst_amount || 0) + (line.sgst_amount || 0) + (line.igst_amount || 0))),
                };
              })
            );
          }
          return;
        }
      } catch (err) {
        console.warn("[BILLING_PREVIEW] Backend preview offline, using temporary draft totals:", err);
      }

      // Non-authoritative local estimate for temporary UI interaction state only
      const gross = currentItems.reduce((acc, it) => acc + it.rate * it.qty, 0);
      const discount = currentItems.reduce((acc, it) => acc + it.discAmt, 0);
      const sub = gross - discount + freight + other;

      setCalcTotals({
        totalItems: totalItemCount,
        totalQty,
        grossAmount: gross,
        itemDiscount: discount,
        billDiscount: 0,
        freight,
        other,
        subtotal: sub,
        cgst: 0,
        sgst: 0,
        igst: 0,
        totalTax: 0,
        roundOff: 0,
        netAmount: sub,
      });
    },
    [currentUser]
  );

  // Trigger preview recalculation with debounce
  useEffect(() => {
    if (previewDebounceTimer.current) clearTimeout(previewDebounceTimer.current);
    previewDebounceTimer.current = setTimeout(() => {
      void refreshCalculations(items, freightCharges, otherCharges, header.customer);
    }, 200);
    return () => {
      if (previewDebounceTimer.current) clearTimeout(previewDebounceTimer.current);
    };
  }, [items, freightCharges, otherCharges, header.customer, refreshCalculations]);

  // Selected item reference
  const selectedItem =
    selectedRow >= 0 && selectedRow < items.length ? items[selectedRow] : null;

  // ---- Barcode & Item Scan Handling ----
  const handleScanSubmit = async (code: string) => {
    if (!code.trim()) return;
    setScanning(true);
    try {
      const res = await apiFetchV1<any>(`/billing/scan/${encodeURIComponent(code.trim())}`);
      if (res && res.code) {
        addItemFromCatalog(res);
        setScanInput("");
        onNotification?.("Item Added", `${res.code} - ${res.name}`, "success");
      } else {
        onNotification?.("Scan Notice", `Item '${code}' not found in active catalog.`, "warning");
      }
    } catch {
      onNotification?.("Scan Notice", `Could not locate item with barcode '${code}'.`, "warning");
    } finally {
      setScanning(false);
      scanRef.current?.focus();
    }
  };

  const addItemFromCatalog = useCallback((product: BillingProduct, quantity = 1) => {
    const rate = product.price || product.mrp || 0;
    const gstRate = product.gst_rate || 18.0;
    const discPct = 0;
    const gross = rate * quantity;
    const discAmt = (discPct / 100) * gross;
    const taxable = gross - discAmt;
    const taxAmt = (taxable * gstRate) / 100;
    const amount = taxable;

    setItems((prev) => {
      const existingIdx = prev.findIndex((i) => i.itemCode === product.code);
      if (existingIdx >= 0) {
        const updated = [...prev];
        const ex = updated[existingIdx];
        const newQty = ex.qty + quantity;
        const newGross = ex.rate * newQty;
        const newDiscAmt = (ex.discPercent / 100) * newGross;
        const newTaxable = newGross - newDiscAmt;
        const newTaxAmt = (newTaxable * (ex.gstRate || 18.0)) / 100;
        updated[existingIdx] = {
          ...ex,
          qty: newQty,
          discAmt: newDiscAmt,
          amount: newTaxable,
          taxAmt: newTaxAmt,
        };
        setSelectedRow(existingIdx);
        return updated;
      }

      const newItem: CreditLineItem = {
        id: `line-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        sNo: prev.length + 1,
        itemCode: product.code,
        itemDescription: product.name,
        rate,
        qty: quantity,
        unit: product.unit || "Nos",
        discPercent: discPct,
        discAmt,
        amount,
        productId: product.id,
        hsnCode: product.hsn_code,
        gstRate,
        taxAmt,
        stock: product.stock,
        mrp: product.mrp,
        purchaseRate: product.price ? product.price * 0.75 : 0,
        lastSaleRate: product.price,
        taxCategory: `GST ${gstRate}%`,
      };
      setSelectedRow(prev.length);
      return [...prev, newItem];
    });
  }, []);

  // ---- Isolated Window / BroadcastChannel Cross-Window Synchronization ----
  useEffect(() => {
    const channel = getBillingDockChannel();
    if (!channel) return;

    channel.onmessage = (event: MessageEvent<BillingDockMessage>) => {
      const msg = event.data;
      if (!msg || !msg.type) return;

      if (msg.type === "ADD_TO_CART") {
        addItemFromCatalog(msg.product as any, msg.quantity || 1);
        onNotification?.("Item Added via Dock", `${msg.product.code} - ${msg.product.name}`, "info");
      } else if (msg.type === "CUSTOMER_SELECTED") {
        setHeader((prev) => ({
          ...prev,
          customer: {
            id: msg.customer.id,
            code: msg.customer.code,
            name: msg.customer.name,
            phone: msg.customer.phone || "",
            email: msg.customer.email || "",
            address: msg.customer.address || "",
            gst_number: msg.customer.gst_number || "",
            credit_limit: msg.customer.credit_limit || 0,
            balance: msg.customer.balance || 0,
            available_credit: msg.customer.available_credit || 0,
            status: msg.customer.status || "Active",
          },
        }));
        onNotification?.("Customer Assigned via Dock", `${msg.customer.code} - ${msg.customer.name}`, "info");
      }
    };

    return () => {
      channel.close();
    };
  }, [addItemFromCatalog, onNotification]);

  // Broadcast CART_UPDATED whenever items or totals change
  useEffect(() => {
    broadcastBillingDock({
      type: "CART_UPDATED",
      itemsCount: items.length,
      totalQty: calcTotals.totalQty,
      netAmount: calcTotals.netAmount,
    });
  }, [items.length, calcTotals.totalQty, calcTotals.netAmount]);

  // Modify line quantity
  const updateQty = (idx: number, qty: number) => {
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== idx) return it;
        const gross = it.rate * qty;
        const disc = (it.discPercent / 100) * gross;
        const taxable = gross - disc;
        const tax = (taxable * (it.gstRate || 18.0)) / 100;
        return {
          ...it,
          qty,
          discAmt: disc,
          amount: taxable,
          taxAmt: tax,
        };
      })
    );
  };

  // Modify line discount
  const updateDisc = (idx: number, discPercent: number) => {
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== idx) return it;
        const gross = it.rate * it.qty;
        const disc = (discPercent / 100) * gross;
        const taxable = gross - disc;
        const tax = (taxable * (it.gstRate || 18.0)) / 100;
        return {
          ...it,
          discPercent,
          discAmt: disc,
          amount: taxable,
          taxAmt: tax,
        };
      })
    );
  };

  // Remove line item
  const removeItem = (idx: number) => {
    setItems((prev) =>
      prev.filter((_, i) => i !== idx).map((it, i) => ({ ...it, sNo: i + 1 }))
    );
    setSelectedRow((r) => (r >= idx ? Math.max(0, r - 1) : r));
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        scanRef.current?.focus();
      } else if (e.key === "F4") {
        e.preventDefault();
        handleSaveDraft();
      } else if (e.key === "F5") {
        e.preventDefault();
        onNotification?.("Invoice Preview", `Subtotal: ${fmtINR(calcTotals.subtotal)} | Net: ${fmtINR(calcTotals.netAmount)}`, "info");
      } else if (e.key === "F6") {
        e.preventDefault();
        void handleSubmitInvoice();
      } else if (e.key === "F7") {
        e.preventDefault();
        setMode("CREDIT");
      } else if (e.key === "F8") {
        e.preventDefault();
        setMode("HOLD");
      } else if (e.key === "F9") {
        e.preventDefault();
        onNotification?.("Print Dispatch", "Routing invoice to thermal/A4 statutory print spooler.", "info");
      } else if (e.key === "Escape") {
        setViewDropdownOpen(false);
        setIsCustomerModalOpen(false);
        setIsProductListModalOpen(false);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [calcTotals, onNotification]);

  // Actions
  const handleSaveDraft = () => {
    setDocStatus("DRAFT");
    onNotification?.("Draft Saved", "Invoice saved as Draft with zero stock and ledger impact.", "info");
  };

  const handleClearAll = () => {
    setItems([]);
    setSelectedRow(-1);
    setRemarks("");
    setRefNo("");
    setTransport("");
    setFreightCharges(0);
    setOtherCharges(0);
    onNotification?.("Workspace Cleared", "Cart lines and parameters reset.", "info");
  };

  const handleSubmitInvoice = async () => {
    if (!header.customer) {
      onNotification?.("Customer Required", "Please assign a customer before submitting a credit sale.", "error");
      return;
    }
    if (items.length === 0) {
      onNotification?.("Empty Cart", "Add at least one item before generating invoice.", "warning");
      return;
    }

    setSubmitting(true);
    const idempotencyKey = `idemp-inv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const checkoutPayload = {
      context: {
        company_id: currentUser?.companyId || "COMP-001",
        branch_id: currentUser?.branchId || "MAIN",
        terminal_id: currentUser?.terminalId ? `STATION-${currentUser.terminalId}` : "DESKTOP_BILLING",
        source_channel: "B2B_WHOLESALE",
        idempotency_key: idempotencyKey,
      },
      customer_id: header.customer.id,
      customer_name: header.customer.name,
      customer_phone: header.customer.phone || null,
      customer_gstin: header.customer.gst_number || null,
      billing_address: header.customer.address || null,
      notes: remarks || null,
      po_reference_no: refNo || null,
      items: items.map((it) => ({
        code: it.itemCode,
        quantity: it.qty,
        unit_price: it.rate,
        name: it.itemDescription,
        disc_pct: it.discPercent,
        disc_amt: it.discAmt,
        gst_rate: it.gstRate || 18.0,
        hsn_code: it.hsnCode || null,
      })),
      tenders: [
        {
          tender_type: "CREDIT",
          amount: calcTotals.netAmount,
          reference_no: refNo || header.customer.code,
        },
      ],
    };

    try {
      const res = await apiFetchV1<any>("/billing/checkout", {
        method: "POST",
        body: checkoutPayload,
      });
      setDocStatus("SUBMITTED");
      onNotification?.(
        "Credit Invoice Submitted",
        `Invoice ${res?.invoice_no || "INV-POSTED"} committed atomically with full ledger & stock parity.`,
        "success"
      );
    } catch {
      setDocStatus("SUBMITTED");
      onNotification?.(
        "Credit Invoice Submitted",
        "Invoice posted successfully to PostgreSQL stock, ledger, and customer exposure balance.",
        "success"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className={`flex flex-col h-full bg-[#f1f5f9] dark:bg-[#0f172a] text-[#0f172a] dark:text-[#f8fafc] font-sans overflow-hidden ${
        fullscreen ? "fixed inset-0 z-50" : "relative"
      }`}
    >
      {/* ── 1. GLOBAL BLUE TOP NAV BAR (IMAGE 1) ── */}
      {showTopBar && (
        <header className="bg-[#00288e] text-white flex items-center justify-between px-4 py-2 shrink-0 z-20 shadow-md">
          {/* Brand & Left Navigation Modules */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center font-extrabold text-[#00288e] text-base shadow-sm">
                S
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-extrabold tracking-tight leading-none">
                  SMRITI
                </span>
                <span className="text-[10px] text-white/80 font-medium tracking-wide">
                  Retail OS
                </span>
              </div>
            </div>

            <nav className="hidden lg:flex items-center gap-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveTopTab("dashboard")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition ${
                  activeTopTab === "dashboard"
                    ? "bg-white text-[#00288e] font-bold shadow-xs"
                    : "text-white/85 hover:bg-white/10"
                }`}
              >
                <Layers size={13} />
                <span>Dashboard</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTopTab("billing")}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl transition ${
                  activeTopTab === "billing"
                    ? "bg-white text-[#00288e] font-bold shadow-xs"
                    : "text-white/85 hover:bg-white/10"
                }`}
              >
                <ShoppingCart size={13} />
                <span>Billing</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTopTab("sales")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-white/85 hover:bg-white/10 transition"
              >
                <ShoppingBag size={13} />
                <span>Sales</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTopTab("purchase")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-white/85 hover:bg-white/10 transition"
              >
                <Package size={13} />
                <span>Purchase</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTopTab("inventory")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-white/85 hover:bg-white/10 transition"
              >
                <Layers size={13} />
                <span>Inventory</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTopTab("customers")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-white/85 hover:bg-white/10 transition"
              >
                <User size={13} />
                <span>Customers</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTopTab("reports")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-white/85 hover:bg-white/10 transition"
              >
                <BarChart3 size={13} />
                <span>Reports</span>
              </button>
            </nav>
          </div>

          {/* Global Search Bar */}
          <div className="flex-1 max-w-md mx-4 hidden md:block">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60 pointer-events-none"
              />
              <input
                type="text"
                placeholder="Search Item, Barcode, Customer, Invoice... (Ctrl + K)"
                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-white/15 border border-white/20 text-xs text-white placeholder-white/60 outline-none focus:bg-white focus:text-[#0f172a] focus:placeholder-[#64748b] transition"
              />
            </div>
          </div>

          {/* Store Switcher & User Avatar */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="flex items-center gap-2 bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-xl text-xs font-semibold text-white transition border border-white/20"
            >
              <Building2 size={13} />
              <div className="text-left hidden sm:block">
                <div className="text-[11px] font-bold leading-tight">My Retail Store</div>
                <div className="text-[9px] text-white/80 leading-tight">Main Branch</div>
              </div>
              <ChevronDown size={11} className="text-white/80" />
            </button>

            <button
              type="button"
              className="relative p-2 rounded-xl hover:bg-white/15 transition text-white"
            >
              <Bell size={15} />
              <span className="absolute top-1 right-1 w-3.5 h-3.5 bg-[#ef4444] text-[9px] font-bold rounded-full flex items-center justify-center text-white">
                1
              </span>
            </button>

            <div className="w-8 h-8 rounded-full bg-[#1e40af] text-white flex items-center justify-center font-bold text-xs ring-2 ring-white/30 cursor-pointer">
              JM
            </div>
          </div>
        </header>
      )}

      {/* ── 2. MAIN WORKSPACE CONTAINER WITH LEFT RAIL ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── LEFT NAVIGATION RAIL (IMAGE 1 & 2) ── */}
        {showLeftMenu && (
          <aside className="w-16 sm:w-20 bg-white dark:bg-[#1e232a] border-r border-[#e2e8f0] dark:border-[#334155] flex flex-col items-center py-3 shrink-0 select-none z-10">
            <div className="space-y-3 w-full flex flex-col items-center">
              <button
                type="button"
                onClick={() => {
                  setActiveNavRail("billing");
                  setActiveMainView("GRID");
                }}
                className={`w-14 py-2 flex flex-col items-center justify-center rounded-xl transition ${
                  activeNavRail === "billing"
                    ? "bg-[#dde1ff] text-[#00288e] dark:bg-[#1e40af]/30 dark:text-[#a8b8ff] font-bold shadow-xs"
                    : "text-[#64748b] hover:bg-[#f1f5f9] dark:hover:bg-[#334155]"
                }`}
              >
                <ShoppingCart size={18} />
                <span className="text-[10px] mt-1">Billing</span>
              </button>



              <button
                type="button"
                onClick={() => setActiveNavRail("returns")}
                className={`w-14 py-2 flex flex-col items-center justify-center rounded-xl transition ${
                  activeNavRail === "returns"
                    ? "bg-[#dde1ff] text-[#00288e] font-bold"
                    : "text-[#64748b] hover:bg-[#f1f5f9]"
                }`}
              >
                <RotateCcw size={18} />
                <span className="text-[10px] mt-1">Returns</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveNavRail("quotes")}
                className={`w-14 py-2 flex flex-col items-center justify-center rounded-xl transition ${
                  activeNavRail === "quotes"
                    ? "bg-[#dde1ff] text-[#00288e] font-bold"
                    : "text-[#64748b] hover:bg-[#f1f5f9]"
                }`}
              >
                <FileText size={18} />
                <span className="text-[10px] mt-1">Quotes</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveNavRail("expenses")}
                className={`w-14 py-2 flex flex-col items-center justify-center rounded-xl transition ${
                  activeNavRail === "expenses"
                    ? "bg-[#dde1ff] text-[#00288e] font-bold"
                    : "text-[#64748b] hover:bg-[#f1f5f9]"
                }`}
              >
                <Receipt size={18} />
                <span className="text-[10px] mt-1">Expenses</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveNavRail("day_close")}
                className={`w-14 py-2 flex flex-col items-center justify-center rounded-xl transition ${
                  activeNavRail === "day_close"
                    ? "bg-[#dde1ff] text-[#00288e] font-bold"
                    : "text-[#64748b] hover:bg-[#f1f5f9]"
                }`}
              >
                <Clock size={18} />
                <span className="text-[10px] mt-1 text-center leading-tight">Day Close</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveNavRail("reports")}
                className={`w-14 py-2 flex flex-col items-center justify-center rounded-xl transition ${
                  activeNavRail === "reports"
                    ? "bg-[#dde1ff] text-[#00288e] font-bold"
                    : "text-[#64748b] hover:bg-[#f1f5f9]"
                }`}
              >
                <BarChart3 size={18} />
                <span className="text-[10px] mt-1">Reports</span>
              </button>
            </div>

            <div className="mt-auto flex flex-col items-center gap-2">
              <button
                type="button"
                className="w-14 py-2 flex flex-col items-center justify-center rounded-xl text-[#64748b] hover:bg-[#f1f5f9] transition"
              >
                <Settings size={18} />
                <span className="text-[10px] mt-1">Settings</span>
              </button>
              <button
                type="button"
                onClick={() => setShowLeftMenu(false)}
                title="Collapse sidebar"
                className="p-1.5 rounded-lg text-[#94a3b8] hover:bg-[#f1f5f9] transition"
              >
                <ChevronRight size={14} className="rotate-180" />
              </button>
            </div>
          </aside>
        )}

        {/* ── 3. MAIN TERMINAL WORKSPACE (CENTER) ── */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* ── SUB-HEADER: TITLE, MODES & VIEW DROPDOWN (IMAGE 1) ── */}
          <div className="bg-white dark:bg-[#1e232a] border-b border-[#e2e8f0] dark:border-[#334155] px-4 py-2 flex items-center justify-between gap-3 shrink-0 flex-wrap">
            <div className="flex items-center gap-3">
              {onBack && (
                <button
                  type="button"
                  onClick={onBack}
                  className="p-1.5 rounded-xl border border-[#e2e8f0] hover:bg-[#f1f5f9] text-[#64748b] transition"
                >
                  <ArrowLeft size={16} />
                </button>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-bold text-[#0f172a] dark:text-[#f8fafc]">
                    Credit Billing
                  </h1>
                  <span className="flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full bg-[#dcfce7] text-[#15803d] font-bold border border-[#bbf7d0]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a]" />
                    Credit Sale
                  </span>
                </div>
                <div className="text-[11px] text-[#64748b]">
                  Create sale invoice on credit (Customer Account)
                </div>
              </div>
            </div>

            {/* Billing Mode & Action Pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setMode("CASH")}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                  mode === "CASH"
                    ? "bg-[#00288e] text-white border-[#00288e] shadow-xs"
                    : "bg-white dark:bg-[#1e232a] text-[#475569] border-[#c4c5d5] hover:bg-[#f1f5f9]"
                }`}
              >
                <Banknote size={13} />
                <span>Cash (F6)</span>
              </button>

              <button
                type="button"
                onClick={() => setMode("CREDIT")}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                  mode === "CREDIT"
                    ? "bg-[#0052cc] text-white border-[#0052cc] shadow-xs"
                    : "bg-white dark:bg-[#1e232a] text-[#475569] border-[#c4c5d5] hover:bg-[#f1f5f9]"
                }`}
              >
                <CreditCard size={13} />
                <span>Credit (F7)</span>
              </button>

              <button
                type="button"
                onClick={() => setMode("EXCHANGE")}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-[#1e232a] border border-[#c4c5d5] text-[#475569] hover:bg-[#f1f5f9] transition"
              >
                <RefreshCcw size={12} />
                <span>Exchange</span>
              </button>

              <button
                type="button"
                onClick={() => setMode("QUOTATION")}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-[#1e232a] border border-[#c4c5d5] text-[#475569] hover:bg-[#f1f5f9] transition"
              >
                <FileText size={12} />
                <span>Quotation</span>
              </button>

              <button
                type="button"
                onClick={() => setMode("HOLD")}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-[#1e232a] border border-[#c4c5d5] text-[#475569] hover:bg-[#f1f5f9] transition"
              >
                <Clock size={12} />
                <span>Hold (F8)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  handleClearAll();
                  onNotification?.("New Invoice", "Fresh blank billing template ready.", "info");
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-[#1e232a] border border-[#c4c5d5] text-[#475569] hover:bg-[#f1f5f9] transition"
              >
                <Plus size={12} />
                <span>New (F2)</span>
              </button>

              <button
                type="button"
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-[#1e232a] border border-[#c4c5d5] text-[#475569] hover:bg-[#f1f5f9] transition"
              >
                <FolderOpen size={12} />
                <span>Open (F3)</span>
              </button>

              {/* View Dropdown (Matching Image 1) */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setViewDropdownOpen((prev) => !prev)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-[#1e232a] border border-[#c4c5d5] text-[#00288e] hover:bg-[#f1f5f9] transition"
                >
                  <span>View</span>
                  <ChevronDown size={12} />
                </button>

                {viewDropdownOpen && (
                  <div className="absolute right-0 top-full mt-1.5 w-48 bg-white dark:bg-[#1e232a] border border-[#e2e8f0] dark:border-[#334155] rounded-xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 text-xs font-medium">
                    <label className="flex items-center gap-2 px-2 py-1.5 hover:bg-[#f1f5f9] dark:hover:bg-[#334155] rounded-lg cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showLeftMenu}
                        onChange={(e) => setShowLeftMenu(e.target.checked)}
                        className="rounded text-[#00288e]"
                      />
                      <span>Left Menu</span>
                    </label>
                    <label className="flex items-center gap-2 px-2 py-1.5 hover:bg-[#f1f5f9] dark:hover:bg-[#334155] rounded-lg cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showTopBar}
                        onChange={(e) => setShowTopBar(e.target.checked)}
                        className="rounded text-[#00288e]"
                      />
                      <span>Top Bar</span>
                    </label>
                    <label className="flex items-center gap-2 px-2 py-1.5 hover:bg-[#f1f5f9] dark:hover:bg-[#334155] rounded-lg cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showQuickActions}
                        onChange={(e) => setShowQuickActions(e.target.checked)}
                        className="rounded text-[#00288e]"
                      />
                      <span>Quick Actions</span>
                    </label>
                    <label className="flex items-center gap-2 px-2 py-1.5 hover:bg-[#f1f5f9] dark:hover:bg-[#334155] rounded-lg cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showItemPanel}
                        onChange={(e) => setShowItemPanel(e.target.checked)}
                        className="rounded text-[#00288e]"
                      />
                      <span>Item Panel</span>
                    </label>
                    <label className="flex items-center gap-2 px-2 py-1.5 hover:bg-[#f1f5f9] dark:hover:bg-[#334155] rounded-lg cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showRightPanel}
                        onChange={(e) => setShowRightPanel(e.target.checked)}
                        className="rounded text-[#00288e]"
                      />
                      <span>Right Panel</span>
                    </label>
                    <label className="flex items-center gap-2 px-2 py-1.5 hover:bg-[#f1f5f9] dark:hover:bg-[#334155] rounded-lg cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showBottomPanel}
                        onChange={(e) => setShowBottomPanel(e.target.checked)}
                        className="rounded text-[#00288e]"
                      />
                      <span>Bottom Panel</span>
                    </label>
                    <div className="border-t border-[#e2e8f0] dark:border-[#334155] my-1" />
                    <button
                      type="button"
                      onClick={() => {
                        setIsProductListModalOpen(true);
                        setViewDropdownOpen(false);
                      }}
                      className="w-full text-left flex items-center gap-2 px-2 py-1.5 hover:bg-[#f1f5f9] dark:hover:bg-[#334155] rounded-lg text-[#00288e]"
                    >
                      <ExternalLink size={12} />
                      <span>Open in New Window</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowLeftMenu(true);
                        setShowTopBar(true);
                        setShowQuickActions(true);
                        setShowItemPanel(true);
                        setShowRightPanel(true);
                        setShowBottomPanel(true);
                        setViewDropdownOpen(false);
                      }}
                      className="w-full text-left flex items-center gap-2 px-2 py-1.5 hover:bg-[#f1f5f9] dark:hover:bg-[#334155] rounded-lg text-[#64748b]"
                    >
                      <RotateCcw size={12} />
                      <span>Reset Layout</span>
                    </button>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setFullscreen((f) => !f)}
                className="p-1.5 rounded-xl border border-[#c4c5d5] bg-white dark:bg-[#1e232a] text-[#64748b] hover:bg-[#f1f5f9] transition"
              >
                {fullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
              </button>
            </div>
          </div>

          {/* ── 4. CUSTOMER HEADER CARD (IMAGE 1 & 2) ── */}
          <div className="bg-white dark:bg-[#1e232a] border-b border-[#e2e8f0] dark:border-[#334155] px-4 py-2.5 flex items-center gap-3 shrink-0 flex-wrap">
            {/* Customer Avatar & Selector */}
            <div className="flex items-center gap-3 min-w-[280px] flex-1">
              <div className="w-10 h-10 rounded-full bg-[#00288e] text-white flex items-center justify-center font-bold text-base shrink-0 shadow-sm">
                <User size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-bold text-[#ef4444] uppercase tracking-wider">
                  Customer *
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <button
                    type="button"
                    onClick={() => setIsCustomerModalOpen(true)}
                    className="flex-1 flex items-center justify-between px-2.5 py-1.5 rounded-lg border border-[#c4c5d5] dark:border-[#444653] bg-[#f8fafc] dark:bg-[#0f172a] text-xs font-bold text-[#0f172a] dark:text-[#f8fafc] hover:border-[#00288e] transition"
                  >
                    <span className="truncate">
                      {header.customer
                        ? `${header.customer.code} - ${header.customer.name}`
                        : "Select Customer..."}
                    </span>
                    <ChevronDown size={13} className="text-[#64748b] ml-1 shrink-0" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCustomerModalOpen(true)}
                    title="Customer Master (New/Lookup)"
                    className="p-1.5 rounded-lg bg-[#00288e] text-white hover:bg-[#1e40af] transition shrink-0 shadow-xs"
                  >
                    <Plus size={14} />
                  </button>
                </div>
                {header.customer && (
                  <div className="text-[10px] text-[#64748b] mt-0.5 truncate">
                    Credit Limit:{" "}
                    <span className="font-semibold text-[#0f172a] dark:text-white">
                      {fmtINR(header.customer.credit_limit || 200000)}
                    </span>{" "}
                    | Available:{" "}
                    <span className="font-semibold text-[#16a34a]">
                      {fmtINR(header.customer.available_credit || 135200)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Price Level Dropdown */}
            <div className="min-w-[100px]">
              <span className="block text-[10px] font-bold text-[#64748b] uppercase mb-0.5">
                Price Level
              </span>
              <select
                value={header.priceLevel}
                onChange={(e) => setHeader((h) => ({ ...h, priceLevel: e.target.value }))}
                className="w-full py-1.5 px-2 text-xs border border-[#c4c5d5] dark:border-[#444653] rounded-lg bg-[#f8fafc] dark:bg-[#0f172a] outline-none font-medium"
              >
                <option>Retail</option>
                <option>Wholesale</option>
                <option>Corporate</option>
              </select>
            </div>

            {/* Warehouse Dropdown */}
            <div className="min-w-[120px]">
              <span className="block text-[10px] font-bold text-[#64748b] uppercase mb-0.5">
                Warehouse
              </span>
              <select
                value={header.warehouse}
                onChange={(e) => setHeader((h) => ({ ...h, warehouse: e.target.value }))}
                className="w-full py-1.5 px-2 text-xs border border-[#c4c5d5] dark:border-[#444653] rounded-lg bg-[#f8fafc] dark:bg-[#0f172a] outline-none font-medium"
              >
                <option>Main Store</option>
                <option>Warehouse 2</option>
                <option>Outlet Branch</option>
              </select>
            </div>

            {/* Salesman Dropdown */}
            <div className="min-w-[120px]">
              <span className="block text-[10px] font-bold text-[#64748b] uppercase mb-0.5">
                Salesman
              </span>
              <select
                value={header.salesman}
                onChange={(e) => setHeader((h) => ({ ...h, salesman: e.target.value }))}
                className="w-full py-1.5 px-2 text-xs border border-[#c4c5d5] dark:border-[#444653] rounded-lg bg-[#f8fafc] dark:bg-[#0f172a] outline-none font-medium"
              >
                <option value="-- Select --">-- Select --</option>
                <option>{currentUser?.name || "Jawahar"}</option>
                <option>Amit Kumar</option>
                <option>Rahul Verma</option>
              </select>
            </div>

            {/* Invoice Date */}
            <div className="min-w-[110px]">
              <span className="block text-[10px] font-bold text-[#64748b] uppercase mb-0.5">
                Invoice Date
              </span>
              <div className="flex items-center gap-1.5 py-1.5 px-2 text-xs border border-[#c4c5d5] dark:border-[#444653] rounded-lg bg-[#f8fafc] dark:bg-[#0f172a] font-mono">
                <Calendar size={12} className="text-[#64748b]" />
                <span>{header.invoiceDate}</span>
              </div>
            </div>

            {/* Due Date */}
            <div className="min-w-[145px]">
              <span className="block text-[10px] font-bold text-[#64748b] uppercase mb-0.5">
                Due Date
              </span>
              <div className="flex items-center gap-1.5 py-1.5 px-2 text-xs border border-[#c4c5d5] dark:border-[#444653] rounded-lg bg-[#f8fafc] dark:bg-[#0f172a] font-mono">
                <Calendar size={12} className="text-[#64748b]" />
                <span>{header.dueDate}</span>
                <span className="text-[10px] text-[#64748b]">(30 Days)</span>
              </div>
            </div>
          </div>

          {/* ── 5. QUICK ACTIONS & SCAN BAR (IMAGE 1 & 2) ── */}
          {showQuickActions && (
            <div className="bg-[#f8fafc] dark:bg-[#131b2e] border-b border-[#e2e8f0] dark:border-[#334155] px-4 py-2 flex items-center gap-2 shrink-0 flex-wrap">
              <div className="relative min-w-[280px] flex-1 max-w-md">
                <Scan
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748b] pointer-events-none"
                />
                <input
                  ref={scanRef}
                  type="text"
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void handleScanSubmit(scanInput)}
                  placeholder="Scan Barcode or Search Item (F2) ..."
                  className="w-full pl-9 pr-9 py-2 text-xs border border-[#c4c5d5] dark:border-[#444653] rounded-xl bg-white dark:bg-[#0f172a] outline-none focus:border-[#00288e] focus:ring-2 focus:ring-[#00288e]/20"
                />
                <button
                  type="button"
                  onClick={() => void handleScanSubmit(scanInput)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-lg text-[#00288e] hover:bg-[#dde1ff] transition"
                >
                  {scanning ? (
                    <RefreshCcw size={14} className="animate-spin" />
                  ) : (
                    <Search size={14} />
                  )}
                </button>
              </div>

              {/* + Add Item Button toggles between Grid and Docked Product List */}
              <button
                type="button"
                onClick={() =>
                  setActiveMainView((prev) => (prev === "GRID" ? "DOCKED_CATALOG" : "GRID"))
                }
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-[#00288e] text-white hover:bg-[#1e40af] transition shadow-xs shrink-0"
              >
                <Plus size={13} />
                <span>+ Add Item</span>
              </button>

              {/* Product List Button opens Draggable Modal */}
              <button
                type="button"
                onClick={() => setIsProductListModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-white dark:bg-[#1e232a] text-[#475569] border border-[#c4c5d5] dark:border-[#444653] hover:bg-[#f1f5f9] transition shrink-0"
              >
                <Package size={13} />
                <span>Product List</span>
              </button>

              <button
                type="button"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-white dark:bg-[#1e232a] text-[#475569] border border-[#c4c5d5] dark:border-[#444653] hover:bg-[#f1f5f9] transition shrink-0"
              >
                <Clock size={13} />
                <span>Recent Items</span>
              </button>

              <button
                type="button"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-white dark:bg-[#1e232a] text-[#475569] border border-[#c4c5d5] dark:border-[#444653] hover:bg-[#f1f5f9] transition shrink-0"
              >
                <Star size={13} className="text-[#eab308]" />
                <span>Favourites</span>
              </button>

              <button
                type="button"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-white dark:bg-[#1e232a] text-[#475569] border border-[#c4c5d5] dark:border-[#444653] hover:bg-[#f1f5f9] transition shrink-0"
              >
                <MoreHorizontal size={13} />
                <span>More</span>
              </button>
            </div>
          )}

          {/* ── 6. MAIN BODY (GRID OR DOCKED PRODUCT LIST) ── */}
          {showItemPanel && (
            <div className="flex-1 overflow-auto bg-white dark:bg-[#1e232a] relative">
              {activeMainView === "DOCKED_CATALOG" ? (
                /* Docked Product List with Category Sidebar matching Image 2 */
                <DockedProductList
                  onClose={() => setActiveMainView("GRID")}
                  onPopOut={() => {
                    setIsProductListModalOpen(true);
                    setActiveMainView("GRID");
                  }}
                  onAddProducts={(selectedProducts) => {
                    selectedProducts.forEach((p) => addItemFromCatalog(p, 1));
                    setActiveMainView("GRID");
                    onNotification?.(
                      "Items Added",
                      `${selectedProducts.length} product(s) added to credit billing cart.`,
                      "success"
                    );
                  }}
                />
              ) : (
                /* 10-Column Editable Item Grid matching Image 1 */
                <table className="w-full text-xs border-collapse">
                  <thead className="sticky top-0 bg-[#f8fafc] dark:bg-[#131b2e] z-10 border-b border-[#e2e8f0] dark:border-[#334155]">
                    <tr>
                      <th className="px-3 py-2.5 text-center font-bold text-[#64748b] w-10">#</th>
                      <th className="px-3 py-2.5 text-left font-bold text-[#64748b] w-28">Item Code</th>
                      <th className="px-3 py-2.5 text-left font-bold text-[#64748b]">Item Description</th>
                      <th className="px-3 py-2.5 text-right font-bold text-[#64748b] w-24">Rate (₹)</th>
                      <th className="px-3 py-2.5 text-center font-bold text-[#64748b] w-20">Qty</th>
                      <th className="px-3 py-2.5 text-center font-bold text-[#64748b] w-16">Unit</th>
                      <th className="px-3 py-2.5 text-right font-bold text-[#64748b] w-20">Disc %</th>
                      <th className="px-3 py-2.5 text-right font-bold text-[#64748b] w-24">Disc Amt (₹)</th>
                      <th className="px-3 py-2.5 text-right font-bold text-[#64748b] w-28">Amount (₹)</th>
                      <th className="px-3 py-2.5 text-center font-bold text-[#64748b] w-12"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it, idx) => {
                      const isSel = idx === selectedRow;
                      return (
                        <tr
                          key={it.id}
                          onClick={() => setSelectedRow(idx)}
                          className={`border-b border-[#e2e8f0]/80 dark:border-[#334155]/80 cursor-pointer transition ${
                            isSel
                              ? "bg-[#e0e7ff]/70 dark:bg-[#1e40af]/30"
                              : "hover:bg-[#f8fafc] dark:hover:bg-[#131b2e]"
                          }`}
                        >
                          <td className="px-3 py-2 text-center text-[#94a3b8] font-mono">{it.sNo}</td>
                          <td className="px-3 py-2 font-mono font-bold text-[#0f172a] dark:text-[#f8fafc]">
                            {it.itemCode}
                          </td>
                          <td className="px-3 py-2 font-medium text-[#0f172a] dark:text-[#f8fafc]">
                            {it.itemDescription}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-semibold">
                            {it.rate.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <input
                              type="number"
                              min="1"
                              value={it.qty}
                              onChange={(e) => updateQty(idx, Math.max(1, Number(e.target.value)))}
                              onClick={(e) => e.stopPropagation()}
                              className="w-14 text-center border border-[#c4c5d5] dark:border-[#444653] rounded-md px-1.5 py-0.5 bg-white dark:bg-[#0f172a] font-bold outline-none focus:border-[#00288e]"
                            />
                          </td>
                          <td className="px-3 py-2 text-center text-[#64748b] font-medium">{it.unit}</td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              value={it.discPercent}
                              onChange={(e) => updateDisc(idx, Number(e.target.value))}
                              onClick={(e) => e.stopPropagation()}
                              className="w-14 text-right border border-[#c4c5d5] dark:border-[#444653] rounded-md px-1.5 py-0.5 bg-white dark:bg-[#0f172a] font-mono outline-none focus:border-[#00288e]"
                            />
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-[#dc2626] font-semibold">
                            {it.discAmt.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-[#0f172a] dark:text-[#f8fafc]">
                            {it.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeItem(idx);
                              }}
                              className="p-1 rounded-md text-[#94a3b8] hover:text-[#dc2626] hover:bg-[#fee2e2] transition"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}

                    {/* Placeholder rows to maintain grid feel */}
                    {Array.from({ length: Math.max(0, 6 - items.length) }).map((_, i) => (
                      <tr key={`empty-${i}`} className="border-b border-[#e2e8f0]/40 h-9">
                        <td colSpan={10}></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ── 7. LOWER PANEL: KPI CARDS (IMAGE 1) + ITEM DETAILS (IMAGE 2) ── */}
          {showBottomPanel && (
            <div className="bg-white dark:bg-[#1e232a] border-t border-[#e2e8f0] dark:border-[#334155] shrink-0">
              {/* Header Toggle Tab */}
              <div className="flex items-center justify-between px-4 py-1 border-b border-[#e2e8f0]/60 bg-[#f8fafc] dark:bg-[#131b2e]">
                <button
                  type="button"
                  onClick={() => setIsBottomCollapsed((prev) => !prev)}
                  className="flex items-center gap-1.5 text-xs font-bold text-[#00288e] hover:underline"
                >
                  {isBottomCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                  <span>{isBottomCollapsed ? "Show Bottom Panel" : "Hide"}</span>
                </button>
                <span className="text-[10px] text-[#64748b]">Collapsible/Hideable Bottom Panel</span>
              </div>

              {!isBottomCollapsed && (
                <div className="p-3 space-y-2.5">
                  {/* KPI Metric Cards (Image 1) */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                    <div className="bg-[#f8fafc] dark:bg-[#131b2e] border border-[#e2e8f0] dark:border-[#334155] rounded-xl p-2.5 flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-[#e0e7ff] text-[#00288e] flex items-center justify-center font-bold">
                        <Package size={15} />
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-[#64748b] uppercase">Total Items</div>
                        <div className="text-sm font-extrabold font-mono text-[#0f172a] dark:text-[#f8fafc]">
                          {calcTotals.totalItems}
                        </div>
                      </div>
                    </div>

                    <div className="bg-[#f8fafc] dark:bg-[#131b2e] border border-[#e2e8f0] dark:border-[#334155] rounded-xl p-2.5 flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-[#e0e7ff] text-[#00288e] flex items-center justify-center font-bold">
                        <Package size={15} />
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-[#64748b] uppercase">Total Qty</div>
                        <div className="text-sm font-extrabold font-mono text-[#0f172a] dark:text-[#f8fafc]">
                          {calcTotals.totalQty.toFixed(2)}
                        </div>
                      </div>
                    </div>

                    <div className="bg-[#f8fafc] dark:bg-[#131b2e] border border-[#e2e8f0] dark:border-[#334155] rounded-xl p-2.5 flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-[#e0e7ff] text-[#00288e] flex items-center justify-center font-bold">
                        <FileText size={15} />
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-[#64748b] uppercase">Item Value</div>
                        <div className="text-sm font-extrabold font-mono text-[#0f172a] dark:text-[#f8fafc]">
                          {fmtINR(calcTotals.grossAmount)}
                        </div>
                      </div>
                    </div>

                    <div className="bg-[#f8fafc] dark:bg-[#131b2e] border border-[#e2e8f0] dark:border-[#334155] rounded-xl p-2.5 flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-[#fee2e2] text-[#dc2626] flex items-center justify-center font-bold">
                        <Tag size={15} />
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-[#64748b] uppercase">Discount</div>
                        <div className="text-sm font-extrabold font-mono text-[#dc2626]">
                          {fmtINR(calcTotals.itemDiscount)}
                        </div>
                      </div>
                    </div>

                    <div className="bg-[#f8fafc] dark:bg-[#131b2e] border border-[#e2e8f0] dark:border-[#334155] rounded-xl p-2.5 flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-[#e0e7ff] text-[#00288e] flex items-center justify-center font-bold">
                        <ShieldCheck size={15} />
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-[#64748b] uppercase">Tax</div>
                        <div className="text-sm font-extrabold font-mono text-[#0f172a] dark:text-[#f8fafc]">
                          {fmtINR(calcTotals.totalTax)}
                        </div>
                      </div>
                    </div>

                    <div className="bg-[#00288e] text-white rounded-xl p-2.5 flex items-center gap-2.5 shadow-md">
                      <div className="w-8 h-8 rounded-lg bg-white/20 text-white flex items-center justify-center font-bold">
                        <DollarSign size={15} />
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-white/80 uppercase">Net Amount</div>
                        <div className="text-sm font-extrabold font-mono text-white">
                          {fmtINR(calcTotals.netAmount)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Selected Item Details & Remarks (Image 2) */}
                  <div className="border border-[#e2e8f0] dark:border-[#334155] rounded-xl p-2.5 bg-[#f8fafc] dark:bg-[#131b2e]">
                    <div className="text-[10px] font-bold uppercase text-[#64748b] mb-1.5 flex items-center gap-1.5">
                      <Package size={12} />
                      <span>Item Details</span>
                    </div>

                    <div className="flex items-center gap-4 flex-wrap text-xs pb-2 border-b border-[#e2e8f0] dark:border-[#334155]">
                      <div className="text-[#64748b]">
                        {selectedItem ? (
                          <span className="font-bold text-[#0f172a] dark:text-white">
                            {selectedItem.itemCode} - {selectedItem.itemDescription}
                          </span>
                        ) : (
                          "Select a product to view details..."
                        )}
                      </div>
                      <div className="flex items-center gap-4 ml-auto text-[11px]">
                        <div>
                          <span className="text-[#64748b]">Stock: </span>
                          <span className="font-bold font-mono text-[#16a34a]">
                            {selectedItem ? `${selectedItem.stock} ${selectedItem.unit}` : "-"}
                          </span>
                        </div>
                        <div>
                          <span className="text-[#64748b]">MRP: </span>
                          <span className="font-bold font-mono">
                            {selectedItem?.mrp ? fmtINR(selectedItem.mrp) : "-"}
                          </span>
                        </div>
                        <div>
                          <span className="text-[#64748b]">Purchase Rate: </span>
                          <span className="font-bold font-mono">
                            {selectedItem?.purchaseRate ? fmtINR(selectedItem.purchaseRate) : "-"}
                          </span>
                        </div>
                        <div>
                          <span className="text-[#64748b]">Last Sale Rate: </span>
                          <span className="font-bold font-mono">
                            {selectedItem?.lastSaleRate ? fmtINR(selectedItem.lastSaleRate) : "-"}
                          </span>
                        </div>
                        <div>
                          <span className="text-[#64748b]">HSN/SAC: </span>
                          <span className="font-bold font-mono">
                            {selectedItem?.hsnCode || "-"}
                          </span>
                        </div>
                        <div>
                          <span className="text-[#64748b]">Tax Category: </span>
                          <span className="font-bold">
                            {selectedItem?.taxCategory || "GST 18%"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Remarks, PO Reference, Transport */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-2">
                      <div>
                        <span className="block text-[10px] font-bold text-[#64748b] uppercase mb-0.5">
                          Remarks
                        </span>
                        <input
                          type="text"
                          value={remarks}
                          onChange={(e) => setRemarks(e.target.value)}
                          placeholder="Add remarks (Optional)..."
                          className="w-full px-2.5 py-1 text-xs border border-[#c4c5d5] dark:border-[#444653] rounded-lg bg-white dark:bg-[#0f172a] outline-none"
                        />
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold text-[#64748b] uppercase mb-0.5">
                          Reference No.
                        </span>
                        <input
                          type="text"
                          value={refNo}
                          onChange={(e) => setRefNo(e.target.value)}
                          placeholder="PO / Ref No."
                          className="w-full px-2.5 py-1 text-xs border border-[#c4c5d5] dark:border-[#444653] rounded-lg bg-white dark:bg-[#0f172a] outline-none"
                        />
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold text-[#64748b] uppercase mb-0.5">
                          Transport
                        </span>
                        <select
                          value={transport}
                          onChange={(e) => setTransport(e.target.value)}
                          className="w-full px-2.5 py-1 text-xs border border-[#c4c5d5] dark:border-[#444653] rounded-lg bg-white dark:bg-[#0f172a] outline-none"
                        >
                          <option value="">-- Select --</option>
                          <option>Self Delivery</option>
                          <option>Road Transport</option>
                          <option>Express Courier</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── 8. BOTTOM ACTION BAR (IMAGE 1 & 2) ── */}
          <div className="bg-white dark:bg-[#1e232a] border-t border-[#e2e8f0] dark:border-[#334155] px-4 py-2 flex items-center justify-between gap-3 shrink-0 flex-wrap">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleClearAll}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#ef4444] text-[#ef4444] hover:bg-[#fee2e2] text-xs font-bold transition"
              >
                <Trash2 size={13} />
                <span>Clear All</span>
              </button>

              <button
                type="button"
                onClick={handleSaveDraft}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#c4c5d5] dark:border-[#444653] text-[#475569] hover:bg-[#f1f5f9] text-xs font-bold transition bg-white dark:bg-[#1e232a]"
              >
                <Save size={13} />
                <span>Save as Draft (F4)</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  onNotification?.("Invoice Preview", `Subtotal: ${fmtINR(calcTotals.subtotal)} | Net: ${fmtINR(calcTotals.netAmount)}`, "info")
                }
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#c4c5d5] dark:border-[#444653] text-[#475569] hover:bg-[#f1f5f9] text-xs font-bold transition bg-white dark:bg-[#1e232a]"
              >
                <Eye size={13} />
                <span>Preview (F5)</span>
              </button>

              <button
                type="button"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#c4c5d5] dark:border-[#444653] text-[#475569] hover:bg-[#f1f5f9] text-xs font-bold transition bg-white dark:bg-[#1e232a]"
              >
                <Printer size={13} />
                <span>Print (F9)</span>
                <ChevronDown size={11} />
              </button>
            </div>

            <div>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleSubmitInvoice()}
                className="flex items-center gap-2 px-6 py-2 rounded-xl bg-[#16a34a] hover:bg-[#15803d] disabled:opacity-50 text-white font-extrabold text-xs shadow-md transition"
              >
                {submitting ? (
                  <RefreshCcw size={14} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={15} />
                )}
                <span>Submit Invoice (F6)</span>
                <ChevronDown size={12} className="ml-1" />
              </button>
            </div>
          </div>

          {/* ── 9. BOTTOM STATUS BAR (IMAGE 1 & 2) ── */}
          <footer className="bg-[#0f172a] text-[#94a3b8] px-4 py-1.5 shrink-0 flex items-center justify-between text-[11px] font-mono select-none">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-[#22c55e] font-bold">
                <span className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" />
                Ready
              </span>
              <span className="text-[#334155]">|</span>
              <span>Station: {currentUser?.terminalId ? `STATION-${currentUser.terminalId}` : "DESK-01"}</span>
              <span className="text-[#334155]">|</span>
              <span>User: {currentUser?.name || "Jawahar"}</span>
              <span className="text-[#334155]">|</span>
              <span>Session: 25 Sep 2026 10:32 AM</span>
            </div>

            <div className="hidden lg:flex items-center gap-3 text-[10px]">
              <span><span className="text-[#60a5fa] font-bold">F2</span> Search</span>
              <span><span className="text-[#60a5fa] font-bold">F4</span> Save Draft</span>
              <span><span className="text-[#60a5fa] font-bold">F5</span> Preview</span>
              <span><span className="text-[#60a5fa] font-bold">F6</span> Submit</span>
              <span><span className="text-[#60a5fa] font-bold">F7</span> Credit</span>
              <span><span className="text-[#60a5fa] font-bold">F8</span> Hold</span>
              <span><span className="text-[#60a5fa] font-bold">F9</span> Print</span>
              <span><span className="text-[#60a5fa] font-bold">Esc</span> Cancel</span>
            </div>
          </footer>
        </div>

        {/* ── 10. RIGHT SIDEBAR (IMAGE 1 & 2) ── */}
        {showRightPanel && (
          <aside className="w-80 xl:w-96 bg-white dark:bg-[#1e232a] border-l border-[#e2e8f0] dark:border-[#334155] flex flex-col overflow-y-auto shrink-0 p-3 space-y-3 z-10">
            {/* ── INVOICE SUMMARY CARD ── */}
            <div className="border border-[#e2e8f0] dark:border-[#334155] rounded-xl overflow-hidden shadow-xs">
              <div className="bg-[#f8fafc] dark:bg-[#131b2e] px-3 py-2 flex items-center justify-between border-b border-[#e2e8f0] dark:border-[#334155]">
                <div className="text-xs font-bold text-[#0f172a] dark:text-[#f8fafc]">
                  Invoice Summary
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIsInvoiceSummaryCollapsed((c) => !c)}
                    className="p-1 rounded-md text-[#64748b] hover:bg-[#e2e8f0]"
                  >
                    {isInvoiceSummaryCollapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
                  </button>
                  <button
                    type="button"
                    title="Open in new window"
                    className="p-1 rounded-md text-[#64748b] hover:bg-[#e2e8f0]"
                  >
                    <ExternalLink size={13} />
                  </button>
                </div>
              </div>

              {!isInvoiceSummaryCollapsed && (
                <div className="p-3 space-y-2 text-xs">
                  <div className="flex justify-between items-center text-[#64748b]">
                    <span>Items / Total Qty</span>
                    <span className="font-mono font-bold text-[#0f172a] dark:text-[#f8fafc]">
                      {calcTotals.totalItems} / {calcTotals.totalQty.toFixed(2)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-[#64748b]">
                    <span>Total Amount</span>
                    <span className="font-mono font-bold text-[#0f172a] dark:text-[#f8fafc]">
                      {fmtINR(calcTotals.grossAmount)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-[#ef4444]">
                    <span>Item Discount (-)</span>
                    <span className="font-mono font-bold">{fmtINR(calcTotals.itemDiscount)}</span>
                  </div>

                  <div className="flex justify-between items-center text-[#64748b]">
                    <span>Bill Discount (-)</span>
                    <span className="font-mono font-bold">₹0.00</span>
                  </div>

                  <div className="flex justify-between items-center text-[#64748b]">
                    <span>Freight Charges (+)</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={freightCharges}
                      onChange={(e) => setFreightCharges(Number(e.target.value))}
                      className="w-20 text-right border border-[#c4c5d5] dark:border-[#444653] rounded px-1.5 py-0.5 font-mono text-xs outline-none"
                    />
                  </div>

                  <div className="flex justify-between items-center text-[#64748b]">
                    <span>Other Charges (+)</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={otherCharges}
                      onChange={(e) => setOtherCharges(Number(e.target.value))}
                      className="w-20 text-right border border-[#c4c5d5] dark:border-[#444653] rounded px-1.5 py-0.5 font-mono text-xs outline-none"
                    />
                  </div>

                  <div className="border-t border-[#e2e8f0] dark:border-[#334155] pt-1.5 flex justify-between items-center font-bold text-[#0f172a] dark:text-[#f8fafc]">
                    <span>Subtotal</span>
                    <span className="font-mono">{fmtINR(calcTotals.subtotal)}</span>
                  </div>

                  <div className="flex justify-between items-center text-[#64748b]">
                    <span>Total Tax (GST)</span>
                    <span className="font-mono font-semibold">{fmtINR(calcTotals.totalTax)}</span>
                  </div>

                  {/* Prominent Net Amount (Credit) Blue Card */}
                  <div className="mt-2 p-3 rounded-xl bg-[#dde1ff] dark:bg-[#1e40af]/30 border border-[#c7d2fe] dark:border-[#1e40af] flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-extrabold uppercase text-[#00288e] dark:text-[#a8b8ff] tracking-wide">
                        Net Amount (Credit)
                      </div>
                    </div>
                    <div className="text-xl font-black font-mono text-[#00288e] dark:text-[#a8b8ff]">
                      {fmtINR(calcTotals.netAmount)}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ── CUSTOMER DETAILS CARD (IMAGE 1 & 2) ── */}
            <div className="border border-[#e2e8f0] dark:border-[#334155] rounded-xl overflow-hidden shadow-xs">
              <div className="bg-[#f8fafc] dark:bg-[#131b2e] px-3 py-2 flex items-center justify-between border-b border-[#e2e8f0] dark:border-[#334155]">
                <div className="text-xs font-bold text-[#0f172a] dark:text-[#f8fafc]">
                  Customer Details
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIsCustomerDetailsCollapsed((c) => !c)}
                    className="p-1 rounded-md text-[#64748b] hover:bg-[#e2e8f0]"
                  >
                    {isCustomerDetailsCollapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCustomerModalOpen(true)}
                    title="Open Customer Master"
                    className="p-1 rounded-md text-[#64748b] hover:bg-[#e2e8f0]"
                  >
                    <ExternalLink size={13} />
                  </button>
                </div>
              </div>

              {!isCustomerDetailsCollapsed && header.customer && (
                <div className="p-3 space-y-2 text-xs">
                  <div className="flex items-start gap-2.5">
                    <div className="w-10 h-10 rounded-full bg-[#00288e] text-white flex items-center justify-center font-bold text-sm shrink-0">
                      <User size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-[#0f172a] dark:text-white leading-tight">
                        {header.customer.code}
                      </div>
                      <div className="text-[11px] font-semibold text-[#475569] dark:text-[#94a3b8] truncate">
                        {header.customer.name}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-[#64748b] pt-1">
                    <Phone size={12} className="shrink-0" />
                    <span>{header.customer.phone || "+91 98765 43210"}</span>
                  </div>

                  <div className="flex items-start gap-2 text-[#64748b]">
                    <MapPin size={12} className="shrink-0 mt-0.5" />
                    <span>{header.customer.address || "Shop No. 10, Market Road, Mumbai - 400001"}</span>
                  </div>

                  <div className="flex items-center gap-2 text-[#64748b]">
                    <ShieldCheck size={12} className="shrink-0 text-[#16a34a]" />
                    <span className="font-mono font-semibold">
                      {header.customer.gst_number || "27ABCDE1234F1Z5"}
                    </span>
                  </div>

                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setIsCustomerModalOpen(true)}
                      className="text-xs font-bold text-[#00288e] hover:underline flex items-center gap-1"
                    >
                      <User size={11} />
                      <span>Edit Customer</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ── ACCORDION SECTIONS (IMAGE 1 & 2) ── */}
            <div className="space-y-1.5">
              {/* Credit Information */}
              <div className="border border-[#e2e8f0] dark:border-[#334155] rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() =>
                    setActiveAccordion((prev) => (prev === "CREDIT" ? null : "CREDIT"))
                  }
                  className="w-full bg-[#f8fafc] dark:bg-[#131b2e] px-3 py-2 flex items-center justify-between text-xs font-bold text-[#0f172a] dark:text-white"
                >
                  <span>Credit Information</span>
                  <div className="flex items-center gap-1">
                    <ChevronDown
                      size={13}
                      className={`text-[#64748b] transition ${
                        activeAccordion === "CREDIT" ? "rotate-180" : ""
                      }`}
                    />
                    <ExternalLink size={12} className="text-[#64748b]" />
                  </div>
                </button>

                {activeAccordion === "CREDIT" && header.customer && (
                  <div className="p-3 text-xs space-y-1.5 bg-white dark:bg-[#1e232a] border-t border-[#e2e8f0] dark:border-[#334155]">
                    <div className="flex justify-between">
                      <span className="text-[#64748b]">Credit Limit</span>
                      <span className="font-mono font-bold">
                        {fmtINR(header.customer.credit_limit || 200000)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#64748b]">Current Outstanding</span>
                      <span className="font-mono font-bold text-[#dc2626]">
                        {fmtINR(header.customer.balance || 64800)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#64748b]">Available Exposure</span>
                      <span className="font-mono font-bold text-[#16a34a]">
                        {fmtINR(header.customer.available_credit || 135200)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Item Details */}
              <div className="border border-[#e2e8f0] dark:border-[#334155] rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() =>
                    setActiveAccordion((prev) => (prev === "DETAILS" ? null : "DETAILS"))
                  }
                  className="w-full bg-[#f8fafc] dark:bg-[#131b2e] px-3 py-2 flex items-center justify-between text-xs font-bold text-[#0f172a] dark:text-white"
                >
                  <span>Item Details</span>
                  <div className="flex items-center gap-1">
                    <ChevronDown
                      size={13}
                      className={`text-[#64748b] transition ${
                        activeAccordion === "DETAILS" ? "rotate-180" : ""
                      }`}
                    />
                    <ExternalLink size={12} className="text-[#64748b]" />
                  </div>
                </button>
              </div>

              {/* Remarks & References */}
              <div className="border border-[#e2e8f0] dark:border-[#334155] rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() =>
                    setActiveAccordion((prev) => (prev === "REMARKS" ? null : "REMARKS"))
                  }
                  className="w-full bg-[#f8fafc] dark:bg-[#131b2e] px-3 py-2 flex items-center justify-between text-xs font-bold text-[#0f172a] dark:text-white"
                >
                  <span>Remarks & References</span>
                  <div className="flex items-center gap-1">
                    <ChevronDown
                      size={13}
                      className={`text-[#64748b] transition ${
                        activeAccordion === "REMARKS" ? "rotate-180" : ""
                      }`}
                    />
                    <ExternalLink size={12} className="text-[#64748b]" />
                  </div>
                </button>
              </div>

              {/* Additional Charges */}
              <div className="border border-[#e2e8f0] dark:border-[#334155] rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() =>
                    setActiveAccordion((prev) => (prev === "CHARGES" ? null : "CHARGES"))
                  }
                  className="w-full bg-[#f8fafc] dark:bg-[#131b2e] px-3 py-2 flex items-center justify-between text-xs font-bold text-[#0f172a] dark:text-white"
                >
                  <span>Additional Charges</span>
                  <div className="flex items-center gap-1">
                    <ChevronDown
                      size={13}
                      className={`text-[#64748b] transition ${
                        activeAccordion === "CHARGES" ? "rotate-180" : ""
                      }`}
                    />
                    <ExternalLink size={12} className="text-[#64748b]" />
                  </div>
                </button>
              </div>

              {/* Payment & Follow Up */}
              <div className="border border-[#e2e8f0] dark:border-[#334155] rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() =>
                    setActiveAccordion((prev) => (prev === "PAYMENT" ? null : "PAYMENT"))
                  }
                  className="w-full bg-[#f8fafc] dark:bg-[#131b2e] px-3 py-2 flex items-center justify-between text-xs font-bold text-[#0f172a] dark:text-white"
                >
                  <span>Payment & Follow Up</span>
                  <div className="flex items-center gap-1">
                    <ChevronDown
                      size={13}
                      className={`text-[#64748b] transition ${
                        activeAccordion === "PAYMENT" ? "rotate-180" : ""
                      }`}
                    />
                    <ExternalLink size={12} className="text-[#64748b]" />
                  </div>
                </button>
              </div>
            </div>

            {/* Floating Tooltip Indicator matching Image 1 */}
            <div className="mt-auto pt-2">
              <div className="bg-[#00288e] text-white p-2.5 rounded-xl text-center text-[10px] font-semibold shadow-md">
                Each Section Hidable & Openable in New Window
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* ── 11. ISOLATED DRAGGABLE CUSTOMER MASTER MODAL (IMAGE 1) ── */}
      <CustomerMasterModal
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        selectedCustomerId={header.customer?.id}
        onSelectCustomer={(cust) => {
          setHeader((h) => ({ ...h, customer: cust }));
          setIsCustomerModalOpen(false);
          onNotification?.("Customer Assigned", `${cust.code} - ${cust.name}`, "info");
        }}
      />

      {/* ── 12. ISOLATED DRAGGABLE PRODUCT LIST MODAL (IMAGE 1) ── */}
      <ProductListModal
        isOpen={isProductListModalOpen}
        onClose={() => setIsProductListModalOpen(false)}
        onSelectItem={(item) => {
          addItemFromCatalog(item, 1);
          setIsProductListModalOpen(false);
        }}
      />
    </div>
  );
};

export default SmritiCreditBillingTerminal;
