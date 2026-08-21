/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.32.0
 * Created      : 2026-08-21
 * Modified     : 2026-08-21
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useEffect, useRef, useMemo } from "react";
import { Product, Customer, POSProfile, Shift } from "../../types.ts";
import { apiFetchV1 } from "../../lib/apiFetch.ts";
import {
  BillingLineItem,
  BillType,
  PaymentMode,
  BillingHeaderState,
  BillingSummaryTotals
} from "./types.ts";
import { ProductSearchBrowserModal } from "./ProductSearchBrowserModal.tsx";
import { ItemBrowseOverlayModal } from "./ItemBrowseOverlayModal.tsx";
import { PdtImportModal } from "./PdtImportModal.tsx";
import { PrintPreviewModal } from "../PrintPreviewModal.tsx";

interface SmritiBillingTerminalProps {
  products?: Product[];
  profiles?: POSProfile[];
  shifts?: Shift[];
  currentUser?: { role: string; name: string } | null;
  onRefreshData?: () => void;
  onNotification?: (title: string, message: string, type: "success" | "error") => void;
  isStandaloneTab?: boolean;
}

export const SmritiBillingTerminal: React.FC<SmritiBillingTerminalProps> = ({
  products = [],
  currentUser,
  onRefreshData,
  onNotification,
  isStandaloneTab = false
}) => {
  // Line items in current bill
  const [items, setItems] = useState<BillingLineItem[]>([]);
  const [selectedRowIndex, setSelectedRowIndex] = useState<number>(0);

  // Header state
  const [headerState, setHeaderState] = useState<BillingHeaderState>({
    billType: "Product",
    paymentMode: "Cash",
    billNo: "INV-" + Math.floor(100000 + Math.random() * 900000),
    billDate: new Date().toLocaleDateString("en-GB"),
    customer: null,
    salesStaff: currentUser?.name || "Staff A",
    counterPcs: "PCS12",
    counterBatch: "252"
  });

  // Customers state & Customer Quick Add Modal
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newCustomerGstin, setNewCustomerGstin] = useState("");

  // Modals state
  const [showProductSearchModal, setShowProductSearchModal] = useState(false);
  const [showItemBrowseModal, setShowItemBrowseModal] = useState(false);
  const [showPdtImportModal, setShowPdtImportModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [lastCompletedInvoice, setLastCompletedInvoice] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Secondary Bottom Scanner Bar state
  const [scanInput, setScanInput] = useState("");
  const [activeMirrorItem, setActiveMirrorItem] = useState<Partial<BillingLineItem>>({});

  const scannerInputRef = useRef<HTMLInputElement>(null);
  const gridContainerRef = useRef<HTMLDivElement>(null);

  // Focus scanner on mount and when modal closes
  useEffect(() => {
    scannerInputRef.current?.focus();
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      const res = await apiFetchV1("/customers");
      if (res && Array.isArray(res)) {
        setCustomers(res);
      }
    } catch {
      // Fallback
    }
  };

  // Recompute live summary totals
  const summaryTotals: BillingSummaryTotals = useMemo(() => {
    let itemCount = items.length;
    let totalQty = 0;
    let salesValue = 0;
    let itemDiscount = 0;
    let totalTax = 0;

    items.forEach(it => {
      totalQty += Number(it.qty || 0);
      const gross = Number(it.rate || 0) * Number(it.qty || 0);
      salesValue += gross;
      itemDiscount += Number(it.discAmt || 0);
      totalTax += Number(it.taxAmount || 0);
    });

    const billDiscount = 0;
    const totalAddons = 0;
    const totalDeductions = 0;
    const rawNet = salesValue - itemDiscount - billDiscount + totalTax + totalAddons - totalDeductions;
    const roundedNet = Math.round(rawNet);
    const roundOff = Number((roundedNet - rawNet).toFixed(2));

    return {
      itemCount,
      totalQty,
      salesValue: Number(salesValue.toFixed(2)),
      itemDiscount: Number(itemDiscount.toFixed(2)),
      billDiscount,
      totalTax: Number(totalTax.toFixed(2)),
      totalAddons,
      totalDeductions,
      roundOff,
      netAmount: roundedNet
    };
  }, [items]);

  // Recalculate line item financials
  const calculateLineItem = (
    base: Partial<BillingLineItem>,
    rate: number,
    qty: number,
    discPercent: number = 0,
    discAmt: number = 0,
    gstPct: number = 18
  ): BillingLineItem => {
    const value = Number((rate * qty).toFixed(2));
    let calculatedDiscAmt = discAmt;
    if (discPercent > 0) {
      calculatedDiscAmt = Number(((value * discPercent) / 100).toFixed(2));
    }
    const taxableValue = Math.max(0, value - calculatedDiscAmt);
    const taxAmount = Number(((taxableValue * gstPct) / 100).toFixed(2));
    const total = Number((taxableValue + taxAmount).toFixed(2));

    return {
      id: base.id || "item-" + Math.random().toString(36).substr(2, 9),
      sNo: base.sNo || 1,
      stockNo: base.stockNo || "",
      barcode: base.barcode || "",
      itemDescription: base.itemDescription || "",
      rate,
      qty,
      value,
      discCode: base.discCode || "",
      discQty: base.discQty || 0,
      discPercent,
      discAmt: calculatedDiscAmt,
      total,
      salesStaff: base.salesStaff || headerState.salesStaff,
      productId: base.productId,
      hsnCode: base.hsnCode || "61091000",
      gstPercentage: gstPct,
      taxAmount,
      brand: base.brand,
      color: base.color,
      size: base.size,
      attributes: base.attributes || {}
    };
  };

  // Add Product to line items
  const addProductToBill = (product: Product, quantityToAdd = 1) => {
    const existingIndex = items.findIndex(
      it => it.productId === product.id || (product.barcode && it.barcode === product.barcode) || it.stockNo === product.code
    );

    const rate = product.price || product.mrp || 0;
    const gstPct = (product as any).gst_percentage || (product as any).gstPercentage || 18;

    let updatedItems: BillingLineItem[];
    if (existingIndex >= 0) {
      const existing = items[existingIndex];
      const newQty = existing.qty + quantityToAdd;
      const updatedItem = calculateLineItem(
        existing,
        existing.rate,
        newQty,
        existing.discPercent,
        existing.discAmt,
        existing.gstPercentage
      );
      updatedItems = [...items];
      updatedItems[existingIndex] = updatedItem;
      setSelectedRowIndex(existingIndex);
      setActiveMirrorItem(updatedItem);
    } else {
      const newItem = calculateLineItem(
        {
          sNo: items.length + 1,
          stockNo: product.code,
          barcode: product.barcode || product.code,
          itemDescription: product.name,
          productId: product.id,
          brand: product.brand,
          color: product.color,
          size: product.size,
          salesStaff: headerState.salesStaff,
          attributes: product.attributes || {}
        },
        rate,
        quantityToAdd,
        0,
        0,
        gstPct
      );
      updatedItems = [...items, newItem];
      setSelectedRowIndex(updatedItems.length - 1);
      setActiveMirrorItem(newItem);
    }

    setItems(updatedItems);
    setTimeout(() => {
      if (gridContainerRef.current) {
        gridContainerRef.current.scrollTop = gridContainerRef.current.scrollHeight;
      }
    }, 50);
  };

  // Handle Secondary Scanning Bar
  const handleBarcodeScan = (e: React.FormEvent) => {
    e.preventDefault();
    const barcode = scanInput.trim();
    if (!barcode) return;

    const matched = products.find(
      p => p.barcode?.toLowerCase() === barcode.toLowerCase() || p.code?.toLowerCase() === barcode.toLowerCase()
    );

    if (matched) {
      addProductToBill(matched, 1);
      setScanInput("");
    } else {
      if (onNotification) {
        onNotification("Barcode Not Found", `Item with barcode "${barcode}" not in inventory catalog.`, "error");
      }
      setScanInput("");
    }
  };

  // Handle New Bill (Alt+N)
  const handleNewBill = () => {
    setItems([]);
    setSelectedRowIndex(0);
    setActiveMirrorItem({});
    setHeaderState(prev => ({
      ...prev,
      billNo: "INV-" + Math.floor(100000 + Math.random() * 900000),
      billDate: new Date().toLocaleDateString("en-GB"),
      customer: null
    }));
    scannerInputRef.current?.focus();
    if (onNotification) {
      onNotification("New Bill", "Ready for new invoice scanning.", "success");
    }
  };

  // Handle Void Bill (Alt+V)
  const handleVoidBill = () => {
    if (items.length === 0) return;
    if (window.confirm("Are you sure you want to VOID and discard current bill items?")) {
      handleNewBill();
      if (onNotification) {
        onNotification("Bill Voided", "Current invoice lines cleared.", "error");
      }
    }
  };

  // Handle Return Mode (Alt+R)
  const handleToggleReturn = () => {
    if (items[selectedRowIndex]) {
      const current = items[selectedRowIndex];
      const newQty = current.qty > 0 ? -Math.abs(current.qty) : Math.abs(current.qty);
      const updated = calculateLineItem(
        current,
        current.rate,
        newQty,
        current.discPercent,
        current.discAmt,
        current.gstPercentage
      );
      const copy = [...items];
      copy[selectedRowIndex] = updated;
      setItems(copy);
      setActiveMirrorItem(updated);
    }
  };

  // Save / Commit Invoice (F4 or Checkout)
  const handleSaveInvoice = async () => {
    if (items.length === 0) {
      if (onNotification) {
        onNotification("Empty Bill", "Please scan or add at least one item before saving.", "error");
      }
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        invoice_number: headerState.billNo,
        customer_id: headerState.customer?.id,
        customer_name: headerState.customer?.name || "Walk-in Customer",
        customer_phone: headerState.customer?.phone || "",
        payment_mode: headerState.paymentMode,
        bill_type: headerState.billType,
        total_amount: summaryTotals.netAmount,
        subtotal: summaryTotals.salesValue,
        tax_amount: summaryTotals.totalTax,
        discount_amount: summaryTotals.itemDiscount + summaryTotals.billDiscount,
        round_off: summaryTotals.roundOff,
        sales_staff: headerState.salesStaff,
        items: items.map(it => ({
          product_id: it.productId,
          product_name: it.itemDescription,
          barcode: it.barcode,
          stock_no: it.stockNo,
          quantity: it.qty,
          unit_price: it.rate,
          discount_amount: it.discAmt,
          tax_percentage: it.gstPercentage,
          tax_amount: it.taxAmount,
          total_price: it.total
        }))
      };

      const response = await apiFetchV1("/sales/invoices/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      setLastCompletedInvoice({
        ...payload,
        id: response?.id || headerState.billNo,
        date: headerState.billDate
      });

      if (onNotification) {
        onNotification("Invoice Saved", `Invoice ${headerState.billNo} saved successfully. Total: ₹${summaryTotals.netAmount}`, "success");
      }

      setShowPrintModal(true);
      if (onRefreshData) onRefreshData();
      handleNewBill();
    } catch (err: any) {
      if (onNotification) {
        onNotification("Save Error", err.message || "Failed to persist invoice to server.", "error");
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Keyboard shortcut handler
  useEffect(() => {
    const handleGlobalKeys = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === "n" || e.key === "N")) {
        e.preventDefault();
        handleNewBill();
      } else if (e.altKey && (e.key === "v" || e.key === "V")) {
        e.preventDefault();
        handleVoidBill();
      } else if (e.altKey && (e.key === "r" || e.key === "R")) {
        e.preventDefault();
        handleToggleReturn();
      } else if (e.altKey && (e.key === "p" || e.key === "P")) {
        e.preventDefault();
        if (lastCompletedInvoice) setShowPrintModal(true);
      } else if (e.altKey && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        setShowProductSearchModal(true);
      } else if (e.altKey && (e.key === "d" || e.key === "D")) {
        e.preventDefault();
        setShowItemBrowseModal(true);
      } else if (e.altKey && (e.key === "i" || e.key === "I")) {
        e.preventDefault();
        setShowPdtImportModal(true);
      } else if (e.key === "F4") {
        e.preventDefault();
        handleSaveInvoice();
      }
    };

    window.addEventListener("keydown", handleGlobalKeys);
    return () => window.removeEventListener("keydown", handleGlobalKeys);
  }, [items, selectedRowIndex, summaryTotals, lastCompletedInvoice]);

  return (
    <div className="bg-[#faf9ff] text-[#1a1b20] h-full flex flex-col font-sans overflow-hidden select-none">
      {/* Top Navigation & Action Header */}
      <header className="bg-white text-[#00296d] w-full top-0 z-20 border-b border-[#c4c6d4] flex justify-between items-center h-14 px-4 shrink-0 shadow-sm">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[24px] text-[#00296d]">point_of_sale</span>
            <span className="font-bold text-base tracking-wide text-[#00296d]">Smriti Billing</span>
            <span className="text-[10px] bg-[#e9edff] text-[#00296d] px-2 py-0.5 rounded font-mono font-bold uppercase">
              Terminal SM-492
            </span>
          </div>

          {/* Action Buttons */}
          <nav className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleNewBill}
              className="flex flex-col items-center justify-center w-14 h-11 rounded hover:bg-[#e8e7ed] transition-colors text-[#00296d] font-bold border-b-2 border-[#00296d] pb-0.5 group"
              title="New Bill (Alt+N)"
            >
              <span className="material-symbols-outlined text-[18px] group-hover:scale-110 transition-transform">add_box</span>
              <span className="text-[9px] uppercase font-bold tracking-wider">New</span>
            </button>

            <button
              type="button"
              onClick={handleVoidBill}
              className="flex flex-col items-center justify-center w-14 h-11 rounded hover:bg-[#e8e7ed] transition-colors text-[#434652] group"
              title="Void Bill (Alt+V)"
            >
              <span className="material-symbols-outlined text-[18px] group-hover:scale-110 transition-transform text-[#ba1a1a]">cancel</span>
              <span className="text-[9px] uppercase font-bold tracking-wider">Void</span>
            </button>

            <button
              type="button"
              onClick={handleToggleReturn}
              className="flex flex-col items-center justify-center w-14 h-11 rounded hover:bg-[#e8e7ed] transition-colors text-[#434652] group"
              title="Sales Return (Alt+R)"
            >
              <span className="material-symbols-outlined text-[18px] group-hover:scale-110 transition-transform">keyboard_return</span>
              <span className="text-[9px] uppercase font-bold tracking-wider">Return</span>
            </button>

            <div className="w-[1px] h-6 bg-[#c4c6d4] mx-1"></div>

            <button
              type="button"
              onClick={() => {
                if (lastCompletedInvoice) setShowPrintModal(true);
                else if (onNotification) onNotification("No Recent Bill", "Complete a bill first to reprint.", "error");
              }}
              className="flex flex-col items-center justify-center w-14 h-11 rounded hover:bg-[#e8e7ed] transition-colors text-[#434652] group"
              title="Reprint Last Bill (Alt+P)"
            >
              <span className="material-symbols-outlined text-[18px] group-hover:scale-110 transition-transform">print</span>
              <span className="text-[9px] uppercase font-bold tracking-wider">Reprint</span>
            </button>

            <button
              type="button"
              onClick={() => setShowProductSearchModal(true)}
              className="flex flex-col items-center justify-center w-16 h-11 rounded hover:bg-[#e8e7ed] transition-colors text-[#00296d] group"
              title="Search Product Catalog (Alt+S)"
            >
              <span className="material-symbols-outlined text-[18px] group-hover:scale-110 transition-transform">search</span>
              <span className="text-[9px] uppercase font-bold tracking-wider">Search</span>
            </button>

            <button
              type="button"
              onClick={() => setShowItemBrowseModal(true)}
              className="flex flex-col items-center justify-center w-16 h-11 rounded hover:bg-[#e8e7ed] transition-colors text-[#00296d] group"
              title="Browse Attributes (Alt+D)"
            >
              <span className="material-symbols-outlined text-[18px] group-hover:scale-110 transition-transform">filter_list</span>
              <span className="text-[9px] uppercase font-bold tracking-wider">Browse</span>
            </button>
          </nav>
        </div>

        {/* Right Info Header */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 text-xs text-[#434652]">
            <span className="font-mono">{headerState.billDate} {new Date().toLocaleTimeString()}</span>
            <div className="flex items-center gap-1 font-bold text-[#00296d]">
              <span className="material-symbols-outlined text-[16px]">receipt_long</span>
              <span>{headerState.billNo}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSaveInvoice}
            disabled={items.length === 0 || isSaving}
            className="bg-[#00296d] hover:bg-[#003d9b] disabled:opacity-40 text-white px-4 py-1.5 rounded font-bold text-xs uppercase flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">payments</span>
            {isSaving ? "Saving..." : "Checkout (F4)"}
          </button>
        </div>
      </header>

      {/* Main Terminal Body */}
      <main className="flex-1 flex flex-col h-full bg-[#f4f3f9] overflow-hidden">
        {/* Top Input / Context Controls Section */}
        <section className="bg-white p-2.5 border-b border-[#c4c6d4] shrink-0 flex flex-col gap-2 shadow-xs">
          {/* Row 1: Bill Type, Payment Mode, Counters, Import, Recall */}
          <div className="flex flex-wrap items-center gap-4 justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <label className="text-xs font-bold text-[#434652]">Bill Type</label>
                <select
                  value={headerState.billType}
                  onChange={(e) => setHeaderState({ ...headerState, billType: e.target.value as BillType })}
                  className="border border-[#737685] rounded bg-white px-2 py-1 text-xs font-semibold focus:border-[#00296d] focus:ring-1 focus:ring-[#00296d] h-7"
                >
                  <option value="Product">Product</option>
                  <option value="Service">Service</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <label className="text-xs font-bold text-[#434652]">Pay Mode</label>
                <select
                  value={headerState.paymentMode}
                  onChange={(e) => setHeaderState({ ...headerState, paymentMode: e.target.value as PaymentMode })}
                  className="border border-[#737685] rounded bg-white px-2 py-1 text-xs text-[#00296d] font-bold focus:border-[#00296d] focus:ring-1 focus:ring-[#00296d] h-7"
                >
                  <option value="Cash">Cash</option>
                  <option value="Credit">Credit</option>
                  <option value="UPI">UPI</option>
                  <option value="Card">Card</option>
                  <option value="Split">Split</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={headerState.counterPcs}
                className="border border-[#c4c6d4] rounded bg-[#e8e7ed] px-2 py-1 text-xs font-mono font-bold text-center w-20 h-7"
              />
              <input
                type="text"
                readOnly
                value={headerState.counterBatch}
                className="border border-[#c4c6d4] rounded bg-[#e8e7ed] px-2 py-1 text-xs font-mono font-bold text-center w-16 h-7"
              />
              <button
                type="button"
                onClick={() => setShowPdtImportModal(true)}
                className="bg-[#e9edff] border border-[#00296d] text-[#00296d] text-[10px] font-bold uppercase px-3 py-1 rounded hover:bg-[#cdddff] transition-colors flex items-center gap-1 h-7"
              >
                <span className="material-symbols-outlined text-[14px]">cloud_upload</span>
                Import PDT
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onNotification) onNotification("Recall Bills", "No suspended bills in local queue.", "success");
                }}
                className="bg-[#faf9ff] border border-[#737685] text-[#434652] text-[10px] font-bold uppercase px-3 py-1 rounded hover:bg-[#e8e7ed] transition-colors h-7"
              >
                Recall
              </button>
            </div>
          </div>

          {/* Row 2: Customer Selector & Sales Staff */}
          <div className="flex flex-wrap items-center gap-4">
            {/* Customer Search & Select */}
            <div className="flex items-center gap-2 flex-1 max-w-lg">
              <label className="text-xs font-bold text-[#434652] w-16">Customer</label>
              <div className="flex flex-1 items-center">
                <input
                  type="text"
                  placeholder="Search customer by name or phone..."
                  value={headerState.customer ? `${headerState.customer.name} (${headerState.customer.phone})` : customerSearchQuery}
                  onChange={(e) => {
                    setHeaderState({ ...headerState, customer: null });
                    setCustomerSearchQuery(e.target.value);
                  }}
                  data-context-type="customer"
                  aria-label="Customer Search Input"
                  name="customer_search"
                  className="border border-[#737685] rounded-l bg-white px-2 py-1 text-xs focus:border-[#00296d] focus:ring-1 focus:ring-[#00296d] flex-1 h-7 outline-none font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowAddCustomerModal(true)}
                  className="bg-[#e8e7ed] border-y border-r border-[#737685] text-[#1a1b20] px-3 h-7 rounded-r hover:bg-[#c4c6d4] text-xs font-bold transition-colors"
                >
                  + Add
                </button>
              </div>
            </div>

            {/* Sales Staff */}
            <div className="flex items-center gap-2 flex-1 max-w-xs">
              <label className="text-xs font-bold text-[#434652] w-20">Sales Staff</label>
              <select
                value={headerState.salesStaff}
                onChange={(e) => setHeaderState({ ...headerState, salesStaff: e.target.value })}
                className="border border-[#737685] rounded bg-white px-2 py-1 text-xs focus:border-[#00296d] focus:ring-1 focus:ring-[#00296d] flex-1 h-7 font-medium"
              >
                <option value="Staff A">Staff A (Main Counter)</option>
                <option value="Staff B">Staff B (Floor Executive)</option>
                <option value="Cashier">Cashier</option>
                {currentUser?.name && <option value={currentUser.name}>{currentUser.name}</option>}
              </select>
            </div>
          </div>
        </section>

        {/* Middle Split Pane: Tactical Item Grid + Right Summary Panel */}
        <section className="flex-1 flex overflow-hidden">
          {/* Left/Main: Grid */}
          <div className="flex-1 flex flex-col bg-white overflow-hidden border-r border-[#c4c6d4]">
            {/* Table Header */}
            <div className="bg-[#e8e7ed] border-b border-[#c4c6d4] flex text-[10px] font-bold uppercase tracking-wider text-[#434652] sticky top-0 shrink-0 select-none">
              <div className="w-10 px-1 py-1.5 border-r border-[#c4c6d4] text-center shrink-0">S No.</div>
              <div className="w-24 px-2 py-1.5 border-r border-[#c4c6d4] shrink-0">Stock No</div>
              <div className="flex-1 px-2 py-1.5 border-r border-[#c4c6d4] min-w-[140px]">Item Description</div>
              <div className="w-20 px-2 py-1.5 border-r border-[#c4c6d4] text-right shrink-0">Rate</div>
              <div className="w-16 px-2 py-1.5 border-r border-[#c4c6d4] text-right shrink-0">Qty</div>
              <div className="w-24 px-2 py-1.5 border-r border-[#c4c6d4] text-right shrink-0">Value</div>
              <div className="w-16 px-1 py-1.5 border-r border-[#c4c6d4] shrink-0 text-center">Disc Code</div>
              <div className="w-16 px-1 py-1.5 border-r border-[#c4c6d4] text-right shrink-0">Disc Qty</div>
              <div className="w-14 px-1 py-1.5 border-r border-[#c4c6d4] text-right shrink-0">Disc. %</div>
              <div className="w-20 px-2 py-1.5 border-r border-[#c4c6d4] text-right shrink-0">Disc.Amt</div>
              <div className="w-24 px-2 py-1.5 border-r border-[#c4c6d4] text-right shrink-0 font-bold">Total</div>
              <div className="w-20 px-2 py-1.5 shrink-0">SalesStaff</div>
            </div>

            {/* Table Body (Scrollable) */}
            <div ref={gridContainerRef} className="flex-1 overflow-y-auto custom-scrollbar bg-white">
              {items.map((item, idx) => {
                const isSelected = idx === selectedRowIndex;
                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      setSelectedRowIndex(idx);
                      setActiveMirrorItem(item);
                    }}
                    className={`flex border-b border-[#e2e2e8] text-xs h-7 items-center cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-[#cdddff] text-[#00296d] font-semibold border-l-4 border-l-[#00296d]"
                        : "hover:bg-[#f4f3f9] text-[#1a1b20]"
                    }`}
                  >
                    <div className="w-10 px-1 text-center shrink-0 text-[#737685] font-mono">{idx + 1}</div>
                    <div className="w-24 px-2 border-l border-[#c4c6d4]/50 shrink-0 font-mono font-bold truncate">{item.stockNo}</div>
                    <div className="flex-1 px-2 border-l border-[#c4c6d4]/50 min-w-[140px] truncate font-medium">{item.itemDescription}</div>
                    <div className="w-20 px-2 border-l border-[#c4c6d4]/50 text-right shrink-0 font-mono">{item.rate.toFixed(2)}</div>
                    <div className="w-16 px-1 border-l border-[#c4c6d4]/50 text-right shrink-0 font-mono">
                      <input
                        type="number"
                        min="1"
                        value={item.qty}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 1;
                          const updated = calculateLineItem(item, item.rate, val, item.discPercent, item.discAmt, item.gstPercentage);
                          const copy = [...items];
                          copy[idx] = updated;
                          setItems(copy);
                          setActiveMirrorItem(updated);
                        }}
                        className="w-full text-right bg-transparent border-none p-0 focus:ring-0 font-mono font-bold"
                      />
                    </div>
                    <div className="w-24 px-2 border-l border-[#c4c6d4]/50 text-right shrink-0 font-mono">{item.value.toFixed(2)}</div>
                    <div className="w-16 px-1 border-l border-[#c4c6d4]/50 text-center shrink-0 font-mono text-[10px]">{item.discCode || "-"}</div>
                    <div className="w-16 px-1 border-l border-[#c4c6d4]/50 text-right shrink-0 font-mono">{item.discQty}</div>
                    <div className="w-14 px-1 border-l border-[#c4c6d4]/50 text-right shrink-0 font-mono">{item.discPercent}%</div>
                    <div className="w-20 px-2 border-l border-[#c4c6d4]/50 text-right shrink-0 font-mono text-amber-800">{item.discAmt.toFixed(2)}</div>
                    <div className="w-24 px-2 border-l border-[#c4c6d4]/50 text-right shrink-0 font-mono font-bold text-[#00296d]">{item.total.toFixed(2)}</div>
                    <div className="w-20 px-2 border-l border-[#c4c6d4]/50 shrink-0 truncate text-[11px]">{item.salesStaff}</div>
                  </div>
                );
              })}

              {/* Empty Rows Padding to simulate high-throughput spreadsheet */}
              {Array.from({ length: Math.max(0, 14 - items.length) }).map((_, i) => (
                <div key={"empty-" + i} className="flex border-b border-[#e2e2e8]/60 text-xs h-7 items-center bg-white/40">
                  <div className="w-10 px-1 text-center shrink-0 text-[#c4c6d4] font-mono">{items.length + i + 1}</div>
                  <div className="w-24 border-l border-[#c4c6d4]/30 shrink-0 h-full"></div>
                  <div className="flex-1 border-l border-[#c4c6d4]/30 min-w-[140px] h-full"></div>
                  <div className="w-20 border-l border-[#c4c6d4]/30 shrink-0 h-full"></div>
                  <div className="w-16 border-l border-[#c4c6d4]/30 shrink-0 h-full"></div>
                  <div className="w-24 border-l border-[#c4c6d4]/30 shrink-0 h-full"></div>
                  <div className="w-16 border-l border-[#c4c6d4]/30 shrink-0 h-full"></div>
                  <div className="w-16 border-l border-[#c4c6d4]/30 shrink-0 h-full"></div>
                  <div className="w-14 border-l border-[#c4c6d4]/30 shrink-0 h-full"></div>
                  <div className="w-20 border-l border-[#c4c6d4]/30 shrink-0 h-full"></div>
                  <div className="w-24 border-l border-[#c4c6d4]/30 shrink-0 h-full"></div>
                  <div className="w-20 border-l border-[#c4c6d4]/30 shrink-0 h-full"></div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Summary Table */}
          <div className="w-64 bg-[#f4f3f9] shrink-0 flex flex-col p-3 border-l border-[#c4c6d4]">
            <div className="bg-white border border-[#c4c6d4] rounded flex flex-col overflow-hidden shadow-sm">
              <div className="flex border-b border-[#c4c6d4] bg-[#e9edff] text-xs font-bold text-[#00296d]">
                <div className="flex-1 p-1.5 text-center border-r border-[#c4c6d4]">Description</div>
                <div className="flex-1 p-1.5 text-center">Net Values</div>
              </div>

              <div className="flex border-b border-[#e2e2e8] text-xs h-7 items-center bg-white">
                <div className="flex-1 px-2 py-1 border-r border-[#c4c6d4] font-medium text-[#434652]">Gross Sales</div>
                <div className="flex-1 px-2 text-right font-mono font-bold">₹{summaryTotals.salesValue.toFixed(2)}</div>
              </div>

              <div className="flex border-b border-[#e2e2e8] text-xs h-7 items-center bg-white">
                <div className="flex-1 px-2 py-1 border-r border-[#c4c6d4] font-medium text-[#434652]">Discount</div>
                <div className="flex-1 px-2 text-right font-mono text-amber-700">-₹{summaryTotals.itemDiscount.toFixed(2)}</div>
              </div>

              <div className="flex border-b border-[#e2e2e8] text-xs h-7 items-center bg-white">
                <div className="flex-1 px-2 py-1 border-r border-[#c4c6d4] font-medium text-[#434652]">Total GST</div>
                <div className="flex-1 px-2 text-right font-mono text-emerald-700">+₹{summaryTotals.totalTax.toFixed(2)}</div>
              </div>

              <div className="flex border-b border-[#e2e2e8] text-xs h-7 items-center bg-white">
                <div className="flex-1 px-2 py-1 border-r border-[#c4c6d4] font-medium text-[#434652]">Round Off</div>
                <div className="flex-1 px-2 text-right font-mono">{summaryTotals.roundOff.toFixed(2)}</div>
              </div>

              <div className="flex text-xs h-8 items-center bg-[#00296d] text-white font-bold">
                <div className="flex-1 px-2 py-1 border-r border-white/20 uppercase text-[11px]">Net Payable</div>
                <div className="flex-1 px-2 text-right font-mono text-sm">₹{summaryTotals.netAmount.toFixed(2)}</div>
              </div>
            </div>

            {/* Quick Tender Summary */}
            <div className="mt-3 bg-white p-2.5 rounded border border-[#c4c6d4] flex flex-col gap-1.5">
              <span className="text-[10px] uppercase font-bold text-[#434652] tracking-wider">Payment Tender</span>
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-[#00296d]">{headerState.paymentMode}</span>
                <span className="font-mono font-bold text-sm">₹{summaryTotals.netAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Secondary Bottom Scanning Bar */}
        <section className="bg-[#e8e7ed] border-t border-[#c4c6d4] px-3 py-1 flex items-center gap-2 overflow-x-auto shrink-0 shadow-inner">
          <form onSubmit={handleBarcodeScan} className="flex items-center bg-white border border-[#737685] rounded h-7 shrink-0">
            <div className="bg-[#dae2ff] px-2 text-[10px] font-bold text-[#00296d] border-r border-[#737685] h-full flex items-center">
              {selectedRowIndex + 1}
            </div>
            <input
              ref={scannerInputRef}
              type="text"
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
              placeholder="Scan Barcode... (Press Enter)"
              data-context-type="product"
              aria-label="Barcode Scanner Input"
              name="barcode_scan"
              className="w-44 h-full bg-transparent border-none focus:ring-0 font-mono text-xs px-2 outline-none font-bold"
            />
          </form>

          {/* Active Item Live Mirror */}
          <div className="flex-1 flex gap-1 items-center">
            <div className="flex flex-col min-w-[80px]">
              <span className="text-[8px] uppercase text-[#434652] font-bold px-1">Stock No</span>
              <div className="bg-white border border-[#c4c6d4] h-5 px-1.5 text-[11px] flex items-center font-mono font-bold text-[#00296d] truncate">
                {activeMirrorItem.stockNo || "-"}
              </div>
            </div>

            <div className="flex flex-col flex-1 min-w-[140px]">
              <span className="text-[8px] uppercase text-[#434652] font-bold px-1">Item Description</span>
              <div className="bg-white border border-[#c4c6d4] h-5 px-1.5 text-[11px] flex items-center font-medium truncate">
                {activeMirrorItem.itemDescription || "Ready for scan..."}
              </div>
            </div>

            <div className="flex flex-col min-w-[65px]">
              <span className="text-[8px] uppercase text-[#434652] font-bold px-1">Rate</span>
              <div className="bg-white border border-[#c4c6d4] h-5 px-1.5 text-[11px] flex items-center justify-end font-mono">
                {activeMirrorItem.rate !== undefined ? activeMirrorItem.rate.toFixed(2) : "0.00"}
              </div>
            </div>

            <div className="flex flex-col min-w-[45px]">
              <span className="text-[8px] uppercase text-[#434652] font-bold px-1">Qty</span>
              <div className="bg-white border border-[#c4c6d4] h-5 px-1.5 text-[11px] flex items-center justify-end font-mono font-bold text-[#00296d]">
                {activeMirrorItem.qty ?? "0"}
              </div>
            </div>

            <div className="flex flex-col min-w-[70px]">
              <span className="text-[8px] uppercase text-[#434652] font-bold px-1">Value</span>
              <div className="bg-white border border-[#c4c6d4] h-5 px-1.5 text-[11px] flex items-center justify-end font-mono">
                {activeMirrorItem.value !== undefined ? activeMirrorItem.value.toFixed(2) : "0.00"}
              </div>
            </div>

            <div className="flex flex-col min-w-[60px]">
              <span className="text-[8px] uppercase text-[#434652] font-bold px-1">Disc.Amt</span>
              <div className="bg-white border border-[#c4c6d4] h-5 px-1.5 text-[11px] flex items-center justify-end font-mono text-amber-800">
                {activeMirrorItem.discAmt !== undefined ? activeMirrorItem.discAmt.toFixed(2) : "0.00"}
              </div>
            </div>

            <div className="flex flex-col min-w-[75px]">
              <span className="text-[8px] uppercase text-[#434652] font-bold px-1">Total</span>
              <div className="bg-white border border-[#c4c6d4] h-5 px-1.5 text-[11px] flex items-center justify-end font-mono font-bold text-[#00296d]">
                {activeMirrorItem.total !== undefined ? activeMirrorItem.total.toFixed(2) : "0.00"}
              </div>
            </div>
          </div>
        </section>

        {/* Institutional Status / Summary Footer */}
        <footer className="bg-[#2f3035] text-[#f1f0f6] shrink-0 border-t border-[#737685] flex text-[11px] font-semibold">
          <div className="flex-1 flex divide-x divide-[#737685]/50 overflow-x-auto">
            <div className="px-3 py-1.5 flex flex-col justify-center min-w-[75px]">
              <span className="text-[#c4c6d4] font-normal text-[9px]">No. of Items</span>
              <span className="font-mono text-xs font-bold text-white">{summaryTotals.itemCount}</span>
            </div>

            <div className="px-3 py-1.5 flex flex-col justify-center min-w-[75px]">
              <span className="text-[#c4c6d4] font-normal text-[9px]">Total Qty.</span>
              <span className="font-mono text-xs font-bold text-white">{summaryTotals.totalQty.toFixed(2)}</span>
            </div>

            <div className="px-3 py-1.5 flex flex-col justify-center min-w-[90px]">
              <span className="text-[#c4c6d4] font-normal text-[9px]">Sales Value</span>
              <span className="font-mono text-xs font-bold text-white">{summaryTotals.salesValue.toFixed(2)}</span>
            </div>

            <div className="px-3 py-1.5 flex flex-col justify-center min-w-[110px]">
              <span className="text-[#c4c6d4] font-normal text-[9px]">Item Lvl. Discount</span>
              <span className="font-mono text-xs text-amber-300 font-bold">{summaryTotals.itemDiscount.toFixed(2)}</span>
            </div>

            <div className="px-3 py-1.5 flex flex-col justify-center min-w-[90px]">
              <span className="text-[#c4c6d4] font-normal text-[9px]">Bill Discount</span>
              <span className="font-mono text-xs font-bold text-white">{summaryTotals.billDiscount.toFixed(2)}</span>
            </div>

            <div className="px-3 py-1.5 flex flex-col justify-center min-w-[80px]">
              <span className="text-[#c4c6d4] font-normal text-[9px]">Total Tax</span>
              <span className="font-mono text-xs text-emerald-300 font-bold">{summaryTotals.totalTax.toFixed(2)}</span>
            </div>

            <div className="px-3 py-1.5 flex flex-col justify-center min-w-[90px]">
              <span className="text-[#c4c6d4] font-normal text-[9px]">Total Addons</span>
              <span className="font-mono text-xs font-bold text-white">{summaryTotals.totalAddons.toFixed(2)}</span>
            </div>

            <div className="px-3 py-1.5 flex flex-col justify-center min-w-[100px]">
              <span className="text-[#c4c6d4] font-normal text-[9px]">Total Deductions</span>
              <span className="font-mono text-xs font-bold text-white">{summaryTotals.totalDeductions.toFixed(2)}</span>
            </div>
          </div>

          <div className="w-52 bg-[#00296d] text-white flex flex-col justify-center items-end px-4 py-1.5 shrink-0 border-l border-[#737685]">
            <span className="text-[#dae2ff] font-normal text-[9px] uppercase tracking-wider">Net Amount</span>
            <span className="font-mono font-bold text-xl tracking-tight leading-none mt-0.5">
              ₹{summaryTotals.netAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
          </div>
        </footer>
      </main>

      {/* Product Catalog Search Modal */}
      <ProductSearchBrowserModal
        isOpen={showProductSearchModal}
        products={products}
        onSelectProduct={(p) => addProductToBill(p, 1)}
        onClose={() => setShowProductSearchModal(false)}
      />

      {/* Item Column/Attribute Browser Modal */}
      <ItemBrowseOverlayModal
        isOpen={showItemBrowseModal}
        products={products}
        onSelectProduct={(p) => addProductToBill(p, 1)}
        onClose={() => setShowItemBrowseModal(false)}
      />

      {/* PDT Batch Import Modal */}
      <PdtImportModal
        isOpen={showPdtImportModal}
        products={products}
        onImportItems={(imported) => {
          imported.forEach(({ product, qty }) => addProductToBill(product, qty));
          if (onNotification) {
            onNotification("PDT Ingest Complete", `Imported ${imported.length} items from batch collector.`, "success");
          }
        }}
        onClose={() => setShowPdtImportModal(false)}
      />

      {/* Add Quick Customer Modal */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-[#faf9ff] text-[#1a1b20] w-full max-w-md rounded-lg shadow-2xl border border-[#c4c6d4] flex flex-col overflow-hidden">
            <div className="bg-[#00296d] text-white px-4 py-2.5 flex justify-between items-center">
              <span className="font-bold text-sm">Quick Add Customer</span>
              <button onClick={() => setShowAddCustomerModal(false)} className="text-white hover:opacity-80">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            <div className="p-4 flex flex-col gap-3 text-xs">
              <div>
                <label className="font-bold text-[#434652] block mb-1">Customer Full Name *</label>
                <input
                  type="text"
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                  placeholder="e.g. Ramesh Sharma"
                  className="w-full border border-[#737685] rounded p-1.5 bg-white text-xs outline-none focus:ring-1 focus:ring-[#00296d]"
                />
              </div>
              <div>
                <label className="font-bold text-[#434652] block mb-1">Phone / Mobile Number *</label>
                <input
                  type="text"
                  value={newCustomerPhone}
                  onChange={(e) => setNewCustomerPhone(e.target.value)}
                  placeholder="e.g. 9876543210"
                  className="w-full border border-[#737685] rounded p-1.5 bg-white text-xs outline-none focus:ring-1 focus:ring-[#00296d]"
                />
              </div>
              <div>
                <label className="font-bold text-[#434652] block mb-1">GSTIN (Optional)</label>
                <input
                  type="text"
                  value={newCustomerGstin}
                  onChange={(e) => setNewCustomerGstin(e.target.value)}
                  placeholder="e.g. 27AAAAA0000A1Z5"
                  className="w-full border border-[#737685] rounded p-1.5 bg-white text-xs outline-none focus:ring-1 focus:ring-[#00296d]"
                />
              </div>
            </div>
            <div className="bg-[#e8e7ed] p-3 flex justify-end gap-2 border-t border-[#c4c6d4]">
              <button
                type="button"
                onClick={() => setShowAddCustomerModal(false)}
                className="bg-white border border-[#c4c6d4] px-3 py-1 rounded text-xs font-bold text-[#434652]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!newCustomerName.trim() || !newCustomerPhone.trim()) {
                    alert("Please enter both Customer Name and Phone.");
                    return;
                  }
                  try {
                    const created = await apiFetchV1("/customers", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        name: newCustomerName.trim(),
                        phone: newCustomerPhone.trim(),
                        gstin: newCustomerGstin.trim() || undefined
                      })
                    });
                    setHeaderState({ ...headerState, customer: created });
                    setCustomers(prev => [...prev, created]);
                    setShowAddCustomerModal(false);
                    setNewCustomerName("");
                    setNewCustomerPhone("");
                    setNewCustomerGstin("");
                  } catch (e: any) {
                    alert(e.message || "Failed to create customer.");
                  }
                }}
                className="bg-[#00296d] text-white px-4 py-1 rounded text-xs font-bold"
              >
                Save & Select
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Preview Modal */}
      {showPrintModal && (
        <PrintPreviewModal
          isOpen={showPrintModal}
          onClose={() => setShowPrintModal(false)}
          activeTabId="pos"
        />
      )}
    </div>
  );
};
