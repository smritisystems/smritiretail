/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.35.0
 * Created      : 2026-09-24
 * Modified     : 2026-09-24
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Capability    : @SmritiCapability("PURCHASE", "GRN_DESKTOP_TERMINAL")
 * Target UI    : Goods Receipt Desktop Terminal (High-Speed Inward Workspace)
 */

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Package,
  FolderOpen,
  Plus,
  Save,
  Printer,
  MoreVertical,
  Search,
  Calendar,
  Check,
  X,
  Barcode,
  FileSpreadsheet,
  Layers,
  Tag,
  HelpCircle,
  Keyboard,
  Trash2,
  Edit3,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import { apiFetchV1 } from "../../lib/apiFetchV1.ts";

export interface GrnLineItem {
  rowId: string;
  product_id: string;
  item_id?: string;
  code: string;
  name: string;
  size?: string;
  color?: string;
  quantity_ordered: number;
  quantity_received: number;
  quantity_damaged: number;
  cost_price: number;
  invoice_rate: number;
  trade_discount: number;
  gst_rate: number;
  mrp?: number;
  addon_before_tax?: number;
  addon_after_tax?: number;
  deduction_before_tax?: number;
  deduction_after_tax?: number;
}

export interface GrnDesktopTerminalProps {
  orders: any[];
  selectedOrderId: string;
  selectedOrder: any | null;
  onSelectOrder: (orderId: string) => void;
  suppliersList: any[];
  supplierId: string;
  supplierName: string;
  onSupplierChange: (sid: string) => void;
  grnLines: GrnLineItem[];
  onUpdateGrnLines: (lines: GrnLineItem[]) => void;
  grnNumber: string;
  onGrnNumberChange: (val: string) => void;
  grnDate: string;
  onGrnDateChange: (val: string) => void;
  invoiceNumber: string;
  onInvoiceNumberChange: (val: string) => void;
  invoiceDate: string;
  onInvoiceDateChange: (val: string) => void;
  notes: string;
  onNotesChange: (val: string) => void;
  saving: boolean;
  onSaveGrn: () => void;
  onResetGrn: () => void;
  onOpenHistory: () => void;
  onOpenPrint: () => void;
  onOpenCsvImport: () => void;
  onOpenScanner: () => void;
  onOpenThreeWayMatch?: () => void;
  onOpenDebitNote?: () => void;
  onClose?: () => void;
  onNotification?: (title: string, message: string, type?: "success" | "error" | "info" | "warning") => void;
}

export const GrnDesktopTerminal: React.FC<GrnDesktopTerminalProps> = ({
  orders,
  selectedOrderId,
  selectedOrder,
  onSelectOrder,
  suppliersList,
  supplierId,
  supplierName,
  onSupplierChange,
  grnLines,
  onUpdateGrnLines,
  grnNumber,
  onGrnNumberChange,
  grnDate,
  onGrnDateChange,
  invoiceNumber,
  onInvoiceNumberChange,
  invoiceDate,
  onInvoiceDateChange,
  notes,
  onNotesChange,
  saving,
  onSaveGrn,
  onResetGrn,
  onOpenHistory,
  onOpenPrint,
  onOpenCsvImport,
  onOpenScanner,
  onOpenThreeWayMatch,
  onOpenDebitNote,
  onClose,
  onNotification,
}) => {
  // Form Header State
  const [transactionType, setTransactionType] = useState("Purchase");
  const [reasonCode, setReasonCode] = useState("ITFR");
  const [docPrefix, setDocPrefix] = useState("P17");
  const [docNo, setDocNo] = useState("41");
  const [addTaxToCost, setAddTaxToCost] = useState(true);
  const [dcTotalInput, setDcTotalInput] = useState("");

  // Modals & Popovers
  const [showPoModal, setShowPoModal] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [showItemTagsModal, setShowItemTagsModal] = useState(false);
  const [showHotkeysModal, setShowHotkeysModal] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showOutwardModal, setShowOutwardModal] = useState(false);

  // Selected Grid Row Index
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);

  // Direct Entry Strip State
  const [entryStockNo, setEntryStockNo] = useState("");
  const [entryDescription, setEntryDescription] = useState("");
  const [entryDocQty, setEntryDocQty] = useState("1.00");
  const [entryActQty, setEntryActQty] = useState("1.00");
  const [entrySellingPrice, setEntrySellingPrice] = useState("0.00");
  const [entryPurchasePrice, setEntryPurchasePrice] = useState("0.00");
  const [entryDiscountRate, setEntryDiscountRate] = useState("0.00");
  const [entryDiscountAmount, setEntryDiscountAmount] = useState("0.00");
  const [entryTaxRate, setEntryTaxRate] = useState("0.00");
  const [entryTaxAmount, setEntryTaxAmount] = useState("0.00");
  const [entryAddonBeforeTax, setEntryAddonBeforeTax] = useState("0.00");
  const [entryAddonAfterTax, setEntryAddonAfterTax] = useState("0.00");
  const [entryDeductionBeforeTax, setEntryDeductionBeforeTax] = useState("0.00");
  const [entryDeductionAfterTax, setEntryDeductionAfterTax] = useState("0.00");

  // Real-Time Telemetry State
  const [telemetry, setTelemetry] = useState({
    currentBalance: 0,
    reservedStock: 0,
    availableBalance: 0,
    lastPurchasePrice: 21.09,
    stockNo: "1507S01C",
  });

  const stockInputRef = useRef<HTMLInputElement>(null);
  const docQtyInputRef = useRef<HTMLInputElement>(null);

  // Focus direct entry stock input on mount
  useEffect(() => {
    stockInputRef.current?.focus();
  }, []);

  // Keyboard Shortcuts (F2: PO, F3: Hotkeys, F4: PDT, Enter: Commit)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        setShowPoModal(true);
      } else if (e.key === "F3") {
        e.preventDefault();
        setShowHotkeysModal(true);
      } else if (e.key === "F4") {
        e.preventDefault();
        onOpenScanner();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onOpenScanner]);

  // Handle Row Selection in Grid
  const handleSelectRow = (idx: number) => {
    setSelectedRowIndex(idx);
    const item = grnLines[idx];
    if (item) {
      setEntryStockNo(item.code);
      setEntryDescription(item.name);
      setEntryDocQty(item.quantity_ordered ? item.quantity_ordered.toFixed(2) : item.quantity_received.toFixed(2));
      setEntryActQty(item.quantity_received.toFixed(2));
      setEntrySellingPrice((item.mrp || 0).toFixed(2));
      setEntryPurchasePrice((item.cost_price || item.invoice_rate).toFixed(2));
      setEntryDiscountRate((item.trade_discount || 0).toFixed(2));
      const discAmt = ((item.trade_discount || 0) * item.quantity_received).toFixed(2);
      setEntryDiscountAmount(discAmt);
      setEntryTaxRate((item.gst_rate || 0).toFixed(2));
      const lineVal = item.quantity_received * (item.cost_price || item.invoice_rate);
      const taxAmt = ((lineVal * (item.gst_rate || 0)) / 100).toFixed(2);
      setEntryTaxAmount(taxAmt);
      setEntryAddonBeforeTax((item.addon_before_tax || 0).toFixed(2));
      setEntryAddonAfterTax((item.addon_after_tax || 0).toFixed(2));
      setEntryDeductionBeforeTax((item.deduction_before_tax || 0).toFixed(2));
      setEntryDeductionAfterTax((item.deduction_after_tax || 0).toFixed(2));

      setTelemetry({
        currentBalance: 0,
        reservedStock: 0,
        availableBalance: 0,
        lastPurchasePrice: Number(item.cost_price || item.invoice_rate || 0),
        stockNo: item.code,
      });
    }
  };

  // Direct Entry Item Lookup
  const handleStockNoLookup = async (code: string) => {
    if (!code.trim()) return;
    const cleanCode = code.trim().toLowerCase();

    // Check if in existing lines
    const existing = grnLines.find(
      (r) => r.code.toLowerCase() === cleanCode || (r.product_id && r.product_id.toLowerCase() === cleanCode)
    );
    if (existing) {
      setEntryDescription(existing.name);
      setEntrySellingPrice((existing.mrp || 0).toFixed(2));
      setEntryPurchasePrice((existing.cost_price || existing.invoice_rate).toFixed(2));
      setEntryTaxRate((existing.gst_rate || 0).toFixed(2));
      setTelemetry((prev) => ({
        ...prev,
        stockNo: existing.code,
        lastPurchasePrice: existing.cost_price,
      }));
      docQtyInputRef.current?.focus();
      return;
    }

    // Query inventory catalog
    try {
      const res = await apiFetchV1(`/inventory/?page=1&page_size=10&q=${encodeURIComponent(code)}`);
      const items = Array.isArray(res) ? res : res?.items || [];
      if (items.length > 0) {
        const match = items[0];
        setEntryDescription(match.name || `Item ${code}`);
        const cost = Number(match.cost_price || match.purchase_price || 100);
        const mrp = Number(match.mrp || cost * 1.5);
        const gst = Number(match.gst_rate || 18);
        setEntryPurchasePrice(cost.toFixed(2));
        setEntrySellingPrice(mrp.toFixed(2));
        setEntryTaxRate(gst.toFixed(2));
        setTelemetry({
          currentBalance: match.current_stock || 0,
          reservedStock: match.reserved_stock || 0,
          availableBalance: match.available_stock || 0,
          lastPurchasePrice: cost,
          stockNo: match.sku || match.code || code,
        });
      } else {
        setEntryDescription(`New Inward SKU ${code}`);
      }
      docQtyInputRef.current?.focus();
    } catch {
      setEntryDescription(`Item ${code}`);
      docQtyInputRef.current?.focus();
    }
  };

  // Commit Direct Entry Row to Grid
  const handleCommitDirectEntry = () => {
    if (!entryStockNo.trim()) {
      onNotification?.("Validation", "Please enter a Stock No or Barcode.", "warning");
      stockInputRef.current?.focus();
      return;
    }

    const docQty = parseFloat(entryDocQty) || 1;
    const actQty = parseFloat(entryActQty) || 1;
    const purchasePrice = parseFloat(entryPurchasePrice) || 0;
    const sellingPrice = parseFloat(entrySellingPrice) || 0;
    const discRate = parseFloat(entryDiscountRate) || 0;
    const taxRate = parseFloat(entryTaxRate) || 0;
    const addonBeforeTax = parseFloat(entryAddonBeforeTax) || 0;
    const addonAfterTax = parseFloat(entryAddonAfterTax) || 0;
    const dedBeforeTax = parseFloat(entryDeductionBeforeTax) || 0;
    const dedAfterTax = parseFloat(entryDeductionAfterTax) || 0;

    if (selectedRowIndex !== null && selectedRowIndex < grnLines.length) {
      // Update existing selected row
      const updated = [...grnLines];
      updated[selectedRowIndex] = {
        ...updated[selectedRowIndex],
        code: entryStockNo.trim(),
        name: entryDescription || updated[selectedRowIndex].name,
        quantity_ordered: docQty,
        quantity_received: actQty,
        cost_price: purchasePrice,
        invoice_rate: purchasePrice,
        mrp: sellingPrice,
        trade_discount: discRate,
        gst_rate: taxRate,
        addon_before_tax: addonBeforeTax,
        addon_after_tax: addonAfterTax,
        deduction_before_tax: dedBeforeTax,
        deduction_after_tax: dedAfterTax,
      };
      onUpdateGrnLines(updated);
      onNotification?.("Item Updated", `Updated row #${selectedRowIndex + 1} (${entryStockNo}).`, "info");
      setSelectedRowIndex(null);
    } else {
      // Append new line
      const newLine: GrnLineItem = {
        rowId: `row-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        product_id: `prod-${entryStockNo.trim()}`,
        code: entryStockNo.trim(),
        name: entryDescription || `Item ${entryStockNo.trim()}`,
        quantity_ordered: docQty,
        quantity_received: actQty,
        quantity_damaged: 0,
        cost_price: purchasePrice,
        invoice_rate: purchasePrice,
        trade_discount: discRate,
        gst_rate: taxRate,
        mrp: sellingPrice,
        addon_before_tax: addonBeforeTax,
        addon_after_tax: addonAfterTax,
        deduction_before_tax: dedBeforeTax,
        deduction_after_tax: dedAfterTax,
      };
      onUpdateGrnLines([...grnLines, newLine]);
      onNotification?.("Item Added", `Added ${entryStockNo} (${actQty} units) to Goods Receipt.`, "success");
    }

    // Reset direct entry inputs for next scan
    setEntryStockNo("");
    setEntryDescription("");
    setEntryDocQty("1.00");
    setEntryActQty("1.00");
    setEntrySellingPrice("0.00");
    setEntryPurchasePrice("0.00");
    setEntryDiscountRate("0.00");
    setEntryDiscountAmount("0.00");
    setEntryTaxRate("0.00");
    setEntryTaxAmount("0.00");
    setEntryAddonBeforeTax("0.00");
    setEntryAddonAfterTax("0.00");
    setEntryDeductionBeforeTax("0.00");
    setEntryDeductionAfterTax("0.00");
    stockInputRef.current?.focus();
  };

  // Calculations for Summary Blocks
  const totalDocQty = useMemo(() => {
    return grnLines.reduce((acc, r) => acc + (r.quantity_ordered || r.quantity_received || 0), 0);
  }, [grnLines]);

  const totalActQty = useMemo(() => {
    return grnLines.reduce((acc, r) => acc + (r.quantity_received || 0), 0);
  }, [grnLines]);

  const totalValue = useMemo(() => {
    return grnLines.reduce((acc, r) => {
      const rate = r.cost_price || r.invoice_rate || 0;
      return acc + r.quantity_received * rate;
    }, 0);
  }, [grnLines]);

  const totalTaxAmount = useMemo(() => {
    return grnLines.reduce((acc, r) => {
      const rate = r.cost_price || r.invoice_rate || 0;
      const lineVal = r.quantity_received * rate;
      return acc + (lineVal * (r.gst_rate || 0)) / 100;
    }, 0);
  }, [grnLines]);

  const totalAddons = useMemo(() => {
    return grnLines.reduce((acc, r) => {
      return acc + (r.addon_before_tax || 0) + (r.addon_after_tax || 0);
    }, 0);
  }, [grnLines]);

  const totalDeductions = useMemo(() => {
    return grnLines.reduce((acc, r) => {
      return acc + (r.deduction_before_tax || 0) + (r.deduction_after_tax || 0);
    }, 0);
  }, [grnLines]);

  const docTotal = useMemo(() => {
    let tot = totalValue + totalTaxAmount + totalAddons - totalDeductions;
    return Math.max(0, tot);
  }, [totalValue, totalTaxAmount, totalAddons, totalDeductions]);

  // Sync dcTotalInput with docTotal by default if empty
  useEffect(() => {
    if (!dcTotalInput && docTotal > 0) {
      setDcTotalInput(docTotal.toFixed(2));
    }
  }, [docTotal, dcTotalInput]);

  // Minimum 15 display rows
  const displayRowsCount = Math.max(15, grnLines.length);

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] text-slate-800 text-xs select-none">
      
      {/* ========================================================================= */}
      {/* 1. TOP HEADER BAR                                                         */}
      {/* ========================================================================= */}
      <header className="bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between shadow-2xs shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#00288e] flex items-center justify-center text-white shadow-xs">
            <Package size={18} />
          </div>
          <div>
            <h1 className="font-extrabold text-base text-slate-900 tracking-tight leading-none">
              Goods Receipt
            </h1>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
              Open For {grnDate} - Smriti System
            </p>
          </div>
        </div>

        {/* Action Buttons Right */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onOpenHistory}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 rounded-md font-semibold text-slate-700 shadow-2xs transition"
          >
            <FolderOpen size={14} className="text-slate-500" />
            <span>Open</span>
          </button>

          <button
            type="button"
            onClick={onResetGrn}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 rounded-md font-semibold text-slate-700 shadow-2xs transition"
          >
            <Plus size={14} className="text-slate-500" />
            <span>New</span>
          </button>

          <button
            type="button"
            onClick={onSaveGrn}
            disabled={saving}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#00288e] text-white hover:bg-[#1e40af] rounded-md font-bold shadow-xs transition disabled:opacity-50"
          >
            <Save size={14} />
            <span>{saving ? "Saving..." : "Save"}</span>
          </button>

          <button
            type="button"
            onClick={onOpenPrint}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 rounded-md font-semibold text-slate-700 shadow-2xs transition"
          >
            <Printer size={14} className="text-slate-500" />
            <span>Print</span>
          </button>

          {/* Options Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowOptionsMenu(!showOptionsMenu)}
              className="p-1.5 bg-white border border-slate-300 hover:bg-slate-50 rounded-md text-slate-600 shadow-2xs transition"
              title="More Options"
            >
              <MoreVertical size={16} />
            </button>
            {showOptionsMenu && (
              <div className="absolute right-0 mt-1 w-52 bg-white rounded-lg shadow-xl border border-slate-200 py-1 z-50 text-xs font-medium">
                {onOpenThreeWayMatch && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowOptionsMenu(false);
                      onOpenThreeWayMatch();
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2"
                  >
                    <span>⚖</span>
                    <span>3-Way Invoice Match</span>
                  </button>
                )}
                {onOpenDebitNote && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowOptionsMenu(false);
                      onOpenDebitNote();
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 text-rose-600"
                  >
                    <span>📄</span>
                    <span>Generate Debit Note</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setShowOptionsMenu(false);
                    setShowHotkeysModal(true);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2"
                >
                  <Keyboard size={13} className="text-slate-400" />
                  <span>List Hotkeys (F3)</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 2. PARAMETERS CARD (SUBHEADER FORM)                                       */}
      {/* ========================================================================= */}
      <section className="p-3 pb-1 shrink-0">
        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs grid grid-cols-12 gap-3 items-start">
          
          {/* Left Column (2 Cols): Transaction Type & Reason Code */}
          <div className="col-span-12 md:col-span-2 space-y-2.5">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Transaction Type
              </label>
              <select
                value={transactionType}
                onChange={(e) => setTransactionType(e.target.value)}
                className="w-full h-8 px-2 border border-slate-300 rounded-md bg-white text-xs font-semibold outline-none focus:border-[#00288e]"
              >
                <option value="Purchase">Purchase</option>
                <option value="Inter-Branch Inward">Inter-Branch Inward</option>
                <option value="Consignment">Consignment</option>
                <option value="Direct Inward">Direct Inward</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Reason Code
              </label>
              <select
                value={reasonCode}
                onChange={(e) => setReasonCode(e.target.value)}
                className="w-full h-8 px-2 border border-slate-300 rounded-md bg-white text-xs font-semibold outline-none focus:border-[#00288e]"
              >
                <option value="ITFR">ITFR</option>
                <option value="NORMAL">NORMAL</option>
                <option value="DAMAGE_REPLACEMENT">DAMAGE_REPLACEMENT</option>
                <option value="PROMOTIONAL">PROMOTIONAL</option>
              </select>
            </div>
          </div>

          {/* Middle Section (7 Cols): Supplier, Ref/DC, Remarks, Prefix & No */}
          <div className="col-span-12 md:col-span-7 space-y-2">
            {/* Row 1: Supplier ID + Search + Name + Add Tax to Cost Checkbox */}
            <div className="flex items-center gap-2">
              <label className="w-20 text-[11px] font-bold text-slate-600 shrink-0">
                Supplier Id
              </label>
              <div className="relative flex-1 max-w-[160px]">
                <input
                  type="text"
                  value={supplierId}
                  onChange={(e) => onSupplierChange(e.target.value)}
                  placeholder="soham"
                  className="w-full h-8 pl-2.5 pr-7 border border-slate-300 rounded-md text-xs font-semibold outline-none focus:border-[#00288e]"
                />
                <button
                  type="button"
                  onClick={() => setShowSupplierModal(true)}
                  className="absolute right-1 top-1.5 p-1 text-slate-400 hover:text-[#00288e]"
                  title="Search Suppliers"
                >
                  <Search size={14} />
                </button>
              </div>

              <input
                type="text"
                readOnly
                value={supplierName || (supplierId ? "Supplier Linked" : "Sohan Collection Pvt Ltd")}
                className="flex-1 h-8 px-2.5 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-600 font-medium"
              />

              <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 cursor-pointer ml-1 whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={addTaxToCost}
                  onChange={(e) => setAddTaxToCost(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-[#00288e] focus:ring-0"
                />
                <span>Add Tax to Cost</span>
              </label>
            </div>

            {/* Row 2: Ref./DC No + DC Date */}
            <div className="flex items-center gap-2">
              <label className="w-20 text-[11px] font-bold text-slate-600 shrink-0">
                Ref./DC No
              </label>
              <div className="flex items-center gap-1 flex-1 max-w-[160px]">
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => onInvoiceNumberChange(e.target.value)}
                  placeholder="0154"
                  className="w-full h-8 px-2.5 border border-slate-300 rounded-md text-xs font-semibold outline-none focus:border-[#00288e]"
                />
                <button
                  type="button"
                  onClick={() => setShowPoModal(true)}
                  className="h-8 px-2 border border-slate-300 rounded-md bg-slate-50 hover:bg-slate-100 font-bold text-slate-600"
                  title="Browse PO / Invoices"
                >
                  ...
                </button>
              </div>

              <div className="flex items-center gap-2 ml-4 flex-1">
                <label className="text-[11px] font-bold text-slate-600 shrink-0">
                  DC Date
                </label>
                <div className="relative flex-1 max-w-[160px]">
                  <input
                    type="date"
                    value={invoiceDate || grnDate}
                    onChange={(e) => onInvoiceDateChange(e.target.value)}
                    className="w-full h-8 px-2.5 border border-slate-300 rounded-md text-xs font-medium outline-none focus:border-[#00288e]"
                  />
                </div>
              </div>
            </div>

            {/* Row 3: Doc Remarks */}
            <div className="flex items-center gap-2">
              <label className="w-20 text-[11px] font-bold text-slate-600 shrink-0">
                Doc Remarks
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => onNotesChange(e.target.value)}
                placeholder="Enter document remarks or delivery notes..."
                className="flex-1 h-8 px-2.5 border border-slate-300 rounded-md text-xs outline-none focus:border-[#00288e]"
              />
            </div>

            {/* Row 4: Doc Prefix + Doc No. */}
            <div className="flex items-center gap-2">
              <label className="w-20 text-[11px] font-bold text-slate-600 shrink-0">
                Doc Prefix
              </label>
              <select
                value={docPrefix}
                onChange={(e) => setDocPrefix(e.target.value)}
                className="h-8 px-2 border border-slate-300 rounded-md bg-white text-xs font-semibold outline-none focus:border-[#00288e] w-28"
              >
                <option value="P17">P17</option>
                <option value="GRN">GRN</option>
                <option value="INW">INW</option>
                <option value="PO">PO</option>
              </select>

              <label className="text-[11px] font-bold text-slate-600 shrink-0 ml-4">
                Doc No.
              </label>
              <input
                type="text"
                value={docNo}
                onChange={(e) => setDocNo(e.target.value)}
                className="h-8 px-2.5 border border-slate-300 rounded-md text-xs font-bold font-mono w-28 outline-none focus:border-[#00288e]"
              />
            </div>
          </div>

          {/* Right Column (3 Cols): 5 Action Links Box (Shoper 9 Parity) */}
          <div className="col-span-12 md:col-span-3">
            <div className="border border-slate-200 rounded-lg p-1.5 bg-slate-50/50 space-y-1 text-xs">
              <button
                type="button"
                onClick={() => setShowPoModal(true)}
                className="w-full text-left px-2.5 py-1.5 rounded-md font-semibold text-[#00288e] bg-[#e0f2fe] hover:bg-[#bae6fd] transition flex items-center justify-between"
              >
                <span>1. Select Purchase Order</span>
                {selectedOrderId && <Check size={14} className="text-[#00288e]" />}
              </button>

              <button
                type="button"
                onClick={onOpenCsvImport}
                className="w-full text-left px-2.5 py-1.5 rounded-md font-semibold text-slate-700 hover:bg-slate-100 transition"
              >
                2. Load from PF File
              </button>

              <button
                type="button"
                onClick={onOpenScanner}
                className="w-full text-left px-2.5 py-1.5 rounded-md font-semibold text-slate-700 hover:bg-slate-100 transition flex items-center justify-between"
              >
                <span>3. Load from PDT File</span>
                <Barcode size={13} className="text-slate-400" />
              </button>

              <button
                type="button"
                onClick={() => setShowOutwardModal(true)}
                className="w-full text-left px-2.5 py-1.5 rounded-md font-semibold text-slate-700 hover:bg-slate-100 transition"
              >
                4. Load Outward to Inward
              </button>

              <button
                type="button"
                onClick={() => setShowItemTagsModal(true)}
                className="w-full text-left px-2.5 py-1.5 rounded-md font-semibold text-slate-700 hover:bg-slate-100 transition"
              >
                5. Show Item Tags
              </button>
            </div>
          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. MAIN TABLE GRID + DOCKED DIRECT ENTRY STRIP                             */}
      {/* ========================================================================= */}
      <main className="flex-1 flex flex-col px-3 overflow-hidden">
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col flex-1 shadow-2xs">
          
          {/* Main Items Table (15+ Rows) */}
          <div className="overflow-auto flex-1">
            <table className="w-full text-left border-collapse text-xs whitespace-nowrap min-w-[1240px]">
              <thead className="bg-[#f1f5f9] sticky top-0 z-10 border-b border-slate-200 text-[11px] font-bold text-slate-600">
                <tr className="h-7.5">
                  <th className="px-2 border-r border-slate-200 w-10 text-center">#</th>
                  <th className="px-2.5 border-r border-slate-200 w-32">Stock No</th>
                  <th className="px-2.5 border-r border-slate-200 min-w-[160px]">Item Description</th>
                  <th className="px-2 border-r border-slate-200 text-right w-16">Doc Qty</th>
                  <th className="px-2 border-r border-slate-200 text-right w-16">Act Qty</th>
                  <th className="px-2 border-r border-slate-200 text-right w-20">Selling Price</th>
                  <th className="px-2 border-r border-slate-200 text-right w-20">Purchase Price</th>
                  <th className="px-2 border-r border-slate-200 text-right w-20">Value</th>
                  <th className="px-2 border-r border-slate-200 text-right w-18">Discount Rate</th>
                  <th className="px-2 border-r border-slate-200 text-right w-18">Discount Amount</th>
                  <th className="px-2 border-r border-slate-200 text-right w-16">Tax Rate</th>
                  <th className="px-2 border-r border-slate-200 text-right w-18">Tax Amount</th>
                  <th className="px-2 border-r border-slate-200 text-right w-18">Addon Before Tax</th>
                  <th className="px-2 border-r border-slate-200 text-right w-18">Addon After Tax</th>
                  <th className="px-2 border-r border-slate-200 text-right w-20">Deduction Before Tax</th>
                  <th className="px-2 text-right w-20">Deduction After Tax</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {Array.from({ length: displayRowsCount }).map((_, idx) => {
                  const item = grnLines[idx];
                  const isSelected = selectedRowIndex === idx;

                  if (item) {
                    const lineValue = item.quantity_received * (item.cost_price || item.invoice_rate);
                    const discAmt = (item.trade_discount || 0) * item.quantity_received;
                    const taxAmt = (lineValue * (item.gst_rate || 0)) / 100;

                    return (
                      <tr
                        key={item.rowId || idx}
                        onClick={() => handleSelectRow(idx)}
                        className={`h-7 cursor-pointer transition ${
                          isSelected
                            ? "bg-[#e0f2fe] text-blue-950 font-semibold"
                            : "hover:bg-slate-50"
                        }`}
                      >
                        <td className="px-2 border-r border-slate-200 text-center font-bold text-slate-500">
                          {idx + 1}
                        </td>
                        <td className="px-2.5 border-r border-slate-200 font-bold text-slate-900">
                          {item.code}
                        </td>
                        <td className="px-2.5 border-r border-slate-200 font-sans font-medium text-slate-800 truncate max-w-[200px]">
                          {item.name}
                        </td>
                        <td className="px-2 border-r border-slate-200 text-right">
                          {(item.quantity_ordered || item.quantity_received).toFixed(2)}
                        </td>
                        <td className="px-2 border-r border-slate-200 text-right font-bold text-emerald-600">
                          {item.quantity_received.toFixed(2)}
                        </td>
                        <td className="px-2 border-r border-slate-200 text-right">
                          {(item.mrp || 0).toFixed(2)}
                        </td>
                        <td className="px-2 border-r border-slate-200 text-right font-bold text-slate-900">
                          {(item.cost_price || item.invoice_rate).toFixed(2)}
                        </td>
                        <td className="px-2 border-r border-slate-200 text-right font-bold">
                          {lineValue.toFixed(2)}
                        </td>
                        <td className="px-2 border-r border-slate-200 text-right">
                          {(item.trade_discount || 0).toFixed(2)}
                        </td>
                        <td className="px-2 border-r border-slate-200 text-right">
                          {discAmt.toFixed(2)}
                        </td>
                        <td className="px-2 border-r border-slate-200 text-right">
                          {(item.gst_rate || 0).toFixed(2)}
                        </td>
                        <td className="px-2 border-r border-slate-200 text-right">
                          {taxAmt.toFixed(2)}
                        </td>
                        <td className="px-2 border-r border-slate-200 text-right">
                          {(item.addon_before_tax || 0).toFixed(2)}
                        </td>
                        <td className="px-2 border-r border-slate-200 text-right">
                          {(item.addon_after_tax || 0).toFixed(2)}
                        </td>
                        <td className="px-2 border-r border-slate-200 text-right">
                          {(item.deduction_before_tax || 0).toFixed(2)}
                        </td>
                        <td className="px-2 text-right">
                          {(item.deduction_after_tax || 0).toFixed(2)}
                        </td>
                      </tr>
                    );
                  }

                  // Empty Placeholder Row (Matches Shoper 9 rows 2..15)
                  return (
                    <tr key={`empty-${idx}`} className="h-7 text-slate-300">
                      <td className="px-2 border-r border-slate-200 text-center font-bold text-slate-400">
                        {idx + 1}
                      </td>
                      <td className="px-2.5 border-r border-slate-200">&nbsp;</td>
                      <td className="px-2.5 border-r border-slate-200">&nbsp;</td>
                      <td className="px-2 border-r border-slate-200">&nbsp;</td>
                      <td className="px-2 border-r border-slate-200">&nbsp;</td>
                      <td className="px-2 border-r border-slate-200">&nbsp;</td>
                      <td className="px-2 border-r border-slate-200">&nbsp;</td>
                      <td className="px-2 border-r border-slate-200">&nbsp;</td>
                      <td className="px-2 border-r border-slate-200">&nbsp;</td>
                      <td className="px-2 border-r border-slate-200">&nbsp;</td>
                      <td className="px-2 border-r border-slate-200">&nbsp;</td>
                      <td className="px-2 border-r border-slate-200">&nbsp;</td>
                      <td className="px-2 border-r border-slate-200">&nbsp;</td>
                      <td className="px-2 border-r border-slate-200">&nbsp;</td>
                      <td className="px-2 border-r border-slate-200">&nbsp;</td>
                      <td className="px-2">&nbsp;</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* DOCKED DIRECT ENTRY STRIP (Exact Shoper 9 Parity) */}
          <div className="bg-[#f8fafc] border-t-2 border-[#00288e] p-1 overflow-x-auto">
            <div className="flex items-center min-w-[1240px] text-xs">
              
              {/* Row # */}
              <div className="w-10 text-center font-bold text-slate-600 px-1">
                {selectedRowIndex !== null ? selectedRowIndex + 1 : grnLines.length + 1}
              </div>

              {/* Stock No Input */}
              <div className="w-32 px-1">
                <input
                  ref={stockInputRef}
                  type="text"
                  value={entryStockNo}
                  onChange={(e) => setEntryStockNo(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleStockNoLookup(entryStockNo);
                    }
                  }}
                  onBlur={() => handleStockNoLookup(entryStockNo)}
                  placeholder="Stock No / SKU"
                  className="w-full h-7 px-2 border border-slate-300 rounded font-mono font-bold text-xs bg-white outline-none focus:border-[#00288e]"
                />
              </div>

              {/* Description Display */}
              <div className="min-w-[160px] flex-1 px-1">
                <input
                  type="text"
                  readOnly
                  value={entryDescription}
                  placeholder="Item Description"
                  className="w-full h-7 px-2 border border-slate-200 bg-white rounded font-sans text-xs text-slate-700 truncate"
                />
              </div>

              {/* Doc Qty (Active Blue Focus Box as shown in user image) */}
              <div className="w-16 px-1">
                <input
                  ref={docQtyInputRef}
                  type="text"
                  value={entryDocQty}
                  onChange={(e) => setEntryDocQty(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCommitDirectEntry();
                  }}
                  className="w-full h-7 px-1.5 text-right font-mono font-bold text-xs bg-[#00288e] text-white rounded outline-none shadow-xs"
                />
              </div>

              {/* Act Qty */}
              <div className="w-16 px-1">
                <input
                  type="text"
                  value={entryActQty}
                  onChange={(e) => setEntryActQty(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCommitDirectEntry();
                  }}
                  className="w-full h-7 px-1.5 text-right font-mono font-bold text-xs bg-white border border-slate-300 rounded outline-none focus:border-[#00288e]"
                />
              </div>

              {/* Selling Price */}
              <div className="w-20 px-1">
                <input
                  type="text"
                  value={entrySellingPrice}
                  onChange={(e) => setEntrySellingPrice(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCommitDirectEntry();
                  }}
                  className="w-full h-7 px-1.5 text-right font-mono text-xs bg-white border border-slate-300 rounded outline-none focus:border-[#00288e]"
                />
              </div>

              {/* Purchase Price */}
              <div className="w-20 px-1">
                <input
                  type="text"
                  value={entryPurchasePrice}
                  onChange={(e) => setEntryPurchasePrice(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCommitDirectEntry();
                  }}
                  className="w-full h-7 px-1.5 text-right font-mono font-bold text-xs bg-white border border-slate-300 rounded outline-none focus:border-[#00288e]"
                />
              </div>

              {/* Value (Calculated) */}
              <div className="w-20 px-1 text-right font-mono font-bold text-xs">
                {((parseFloat(entryActQty) || 0) * (parseFloat(entryPurchasePrice) || 0)).toFixed(2)}
              </div>

              {/* Discount Rate */}
              <div className="w-18 px-1">
                <input
                  type="text"
                  value={entryDiscountRate}
                  onChange={(e) => setEntryDiscountRate(e.target.value)}
                  className="w-full h-7 px-1 text-right font-mono text-xs bg-white border border-slate-300 rounded outline-none"
                />
              </div>

              {/* Discount Amount */}
              <div className="w-18 px-1">
                <input
                  type="text"
                  value={entryDiscountAmount}
                  onChange={(e) => setEntryDiscountAmount(e.target.value)}
                  className="w-full h-7 px-1 text-right font-mono text-xs bg-white border border-slate-300 rounded outline-none"
                />
              </div>

              {/* Tax Rate */}
              <div className="w-16 px-1">
                <input
                  type="text"
                  value={entryTaxRate}
                  onChange={(e) => setEntryTaxRate(e.target.value)}
                  className="w-full h-7 px-1 text-right font-mono text-xs bg-white border border-slate-300 rounded outline-none"
                />
              </div>

              {/* Tax Amount */}
              <div className="w-18 px-1">
                <input
                  type="text"
                  value={entryTaxAmount}
                  onChange={(e) => setEntryTaxAmount(e.target.value)}
                  className="w-full h-7 px-1 text-right font-mono text-xs bg-white border border-slate-300 rounded outline-none"
                />
              </div>

              {/* Addon Before Tax */}
              <div className="w-18 px-1">
                <input
                  type="text"
                  value={entryAddonBeforeTax}
                  onChange={(e) => setEntryAddonBeforeTax(e.target.value)}
                  className="w-full h-7 px-1 text-right font-mono text-xs bg-white border border-slate-300 rounded outline-none"
                />
              </div>

              {/* Addon After Tax */}
              <div className="w-18 px-1">
                <input
                  type="text"
                  value={entryAddonAfterTax}
                  onChange={(e) => setEntryAddonAfterTax(e.target.value)}
                  className="w-full h-7 px-1 text-right font-mono text-xs bg-white border border-slate-300 rounded outline-none"
                />
              </div>

              {/* Deduction Before Tax */}
              <div className="w-20 px-1">
                <input
                  type="text"
                  value={entryDeductionBeforeTax}
                  onChange={(e) => setEntryDeductionBeforeTax(e.target.value)}
                  className="w-full h-7 px-1 text-right font-mono text-xs bg-white border border-slate-300 rounded outline-none"
                />
              </div>

              {/* Deduction After Tax */}
              <div className="w-20 px-1">
                <input
                  type="text"
                  value={entryDeductionAfterTax}
                  onChange={(e) => setEntryDeductionAfterTax(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCommitDirectEntry();
                  }}
                  className="w-full h-7 px-1 text-right font-mono text-xs bg-white border border-slate-300 rounded outline-none"
                />
              </div>

            </div>
          </div>

        </div>
      </main>

      {/* ========================================================================= */}
      {/* 4. SUMMARY & CALCULATION SECTION                                         */}
      {/* ========================================================================= */}
      <section className="p-3 pt-2 shrink-0">
        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs grid grid-cols-12 gap-4 items-center">
          
          {/* Left Column (3 cols): Total Doc Qty, Act Qty, Total Value */}
          <div className="col-span-12 md:col-span-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-600">Total Doc Quantity</span>
              <div className="w-28 h-7 px-2.5 bg-slate-50 border border-slate-300 rounded flex items-center justify-end font-mono font-bold text-xs text-slate-900">
                {totalDocQty.toFixed(2)}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-600">Total Act Quantity</span>
              <div className="w-28 h-7 px-2.5 bg-slate-50 border border-slate-300 rounded flex items-center justify-end font-mono font-bold text-xs text-emerald-600">
                {totalActQty.toFixed(2)}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-600">Total Value</span>
              <div className="w-28 h-7 px-2.5 bg-slate-50 border border-slate-300 rounded flex items-center justify-end font-mono font-bold text-xs text-slate-900">
                {totalValue.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Middle Columns (6 cols): Discount, Deduction, Addon Matrices */}
          <div className="col-span-12 md:col-span-6 grid grid-cols-3 gap-3">
            
            {/* Discount Block */}
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] font-bold uppercase text-slate-500 px-1">
                <span>Rate</span>
                <span>Discount</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-slate-500 w-16 truncate">Doc Level</span>
                <input type="text" placeholder="0.00" className="w-14 h-6 text-right px-1 border border-slate-200 rounded font-mono text-[10px]" />
                <input type="text" placeholder="0.00" className="w-16 h-6 text-right px-1 border border-slate-200 rounded font-mono text-[10px]" />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-slate-500 w-16 truncate">Item Level</span>
                <input type="text" placeholder="0.00" className="w-14 h-6 text-right px-1 border border-slate-200 rounded font-mono text-[10px]" />
                <input type="text" placeholder="0.00" className="w-16 h-6 text-right px-1 border border-slate-200 rounded font-mono text-[10px]" />
              </div>
            </div>

            {/* Deduction Block */}
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] font-bold uppercase text-slate-500 px-1">
                <span>Rate</span>
                <span>Deduction</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-slate-500 w-16 truncate">Before Tax</span>
                <input type="text" placeholder="0.00" className="w-14 h-6 text-right px-1 border border-slate-200 rounded font-mono text-[10px]" />
                <input type="text" placeholder="0.00" className="w-16 h-6 text-right px-1 border border-slate-200 rounded font-mono text-[10px]" />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-slate-500 w-16 truncate">After Tax</span>
                <input type="text" placeholder="0.00" className="w-14 h-6 text-right px-1 border border-slate-200 rounded font-mono text-[10px]" />
                <input type="text" placeholder="0.00" className="w-16 h-6 text-right px-1 border border-slate-200 rounded font-mono text-[10px]" />
              </div>
            </div>

            {/* Addon Block */}
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] font-bold uppercase text-slate-500 px-1">
                <span>Rate</span>
                <span>Addon</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-slate-500 w-16 truncate">Before Tax</span>
                <input type="text" placeholder="0.00" className="w-14 h-6 text-right px-1 border border-slate-200 rounded font-mono text-[10px]" />
                <input type="text" placeholder="0.00" className="w-16 h-6 text-right px-1 border border-slate-200 rounded font-mono text-[10px]" />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-slate-500 w-16 truncate">After Tax</span>
                <input type="text" placeholder="0.00" className="w-14 h-6 text-right px-1 border border-slate-200 rounded font-mono text-[10px]" />
                <input type="text" placeholder="0.00" className="w-16 h-6 text-right px-1 border border-slate-200 rounded font-mono text-[10px]" />
              </div>
            </div>

          </div>

          {/* Right Column (3 cols): Doc. Total & DC/Inv. Total */}
          <div className="col-span-12 md:col-span-3 space-y-2 border-l border-slate-100 pl-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">Doc. Total</span>
              <div className="text-base font-extrabold font-mono text-slate-900">
                {docTotal.toFixed(2)}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-slate-600 shrink-0">DC/Inv. Total</span>
              <input
                type="text"
                value={dcTotalInput}
                onChange={(e) => setDcTotalInput(e.target.value)}
                placeholder="161.27"
                className="w-28 h-7 px-2 text-right font-mono font-bold text-xs bg-[#fef9c3] border border-[#fde047] rounded outline-none focus:ring-1 focus:ring-yellow-500"
                title="Type vendor invoice total to compare against calculated doc total"
              />
            </div>
          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* 5. REAL-TIME TELEMETRY & SEARCH STRIP                                    */}
      {/* ========================================================================= */}
      <div className="px-4 py-1.5 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-[11px] font-medium text-slate-600 shrink-0">
        <div>
          <span>Stock Quantity: Current Balance: </span>
          <span className="font-bold text-slate-900">{telemetry.currentBalance}</span>
          <span>, Reserved Stock: </span>
          <span className="font-bold text-slate-900">{telemetry.reservedStock}</span>
          <span>, Available Balance: </span>
          <span className="font-bold text-slate-900">{telemetry.availableBalance}</span>
          <span> And Last Purchase Price : </span>
          <span className="font-bold text-emerald-700">{telemetry.lastPurchasePrice.toFixed(2)}</span>
          <span> For Stock No : </span>
          <span className="font-mono font-bold text-[#00288e]">{telemetry.stockNo}</span>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setShowHotkeysModal(true)}
            className="hover:text-[#00288e] font-semibold flex items-center gap-1"
          >
            <Keyboard size={13} />
            <span>List Hotkeys (F3)</span>
          </button>

          <button
            type="button"
            onClick={() => setShowSupplierModal(true)}
            className="hover:text-[#00288e] font-semibold flex items-center gap-1"
          >
            <Search size={13} />
            <span>Search/Help</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 6. BOTTOM ACTION FOOTER BAR                                               */}
      {/* ========================================================================= */}
      <footer className="bg-white border-t border-slate-200 px-4 py-2 flex items-center justify-between shadow-lg shrink-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setSelectedRowIndex(null);
              setEntryStockNo("");
              stockInputRef.current?.focus();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 rounded-md font-bold text-xs text-slate-700 shadow-2xs transition"
          >
            <Plus size={14} />
            <span>Add</span>
          </button>

          <button
            type="button"
            disabled={selectedRowIndex === null}
            onClick={() => {
              if (selectedRowIndex !== null) handleSelectRow(selectedRowIndex);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-400 rounded-md font-semibold text-xs shadow-2xs disabled:opacity-40"
          >
            <Edit3 size={14} />
            <span>Edit</span>
          </button>

          <button
            type="button"
            disabled={selectedRowIndex === null}
            onClick={() => {
              if (selectedRowIndex !== null) {
                const updated = grnLines.filter((_, i) => i !== selectedRowIndex);
                onUpdateGrnLines(updated);
                setSelectedRowIndex(null);
                onNotification?.("Item Removed", "Row deleted from goods receipt.", "info");
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-rose-500 rounded-md font-semibold text-xs shadow-2xs disabled:opacity-40"
          >
            <Trash2 size={14} />
            <span>Delete</span>
          </button>

          <button
            type="button"
            onClick={onOpenPrint}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-500 rounded-md font-semibold text-xs shadow-2xs hover:bg-slate-50"
          >
            <Printer size={14} />
            <span>Reprint</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-500 rounded-md font-semibold text-xs shadow-2xs hover:bg-slate-50"
          >
            <ExternalLink size={14} />
            <span>Exit</span>
          </button>
        </div>

        {/* Right Confirm / Cancel */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onSaveGrn}
            disabled={saving}
            className="flex items-center gap-1.5 px-6 py-2 bg-[#00288e] hover:bg-[#1e40af] text-white rounded-md font-bold text-xs shadow-sm transition disabled:opacity-50"
          >
            <Check size={16} />
            <span>{saving ? "Posting..." : "OK"}</span>
          </button>

          <button
            type="button"
            onClick={onResetGrn}
            className="flex items-center gap-1.5 px-5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-md font-bold text-xs shadow-2xs transition"
          >
            <X size={16} />
            <span>Cancel</span>
          </button>
        </div>
      </footer>

      {/* ========================================================================= */}
      {/* 7. MODALS                                                                */}
      {/* ========================================================================= */}

      {/* Select Purchase Order Modal */}
      {showPoModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-2xl w-full p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <FileSpreadsheet size={18} className="text-[#00288e]" />
                <h3 className="font-bold text-sm text-slate-900">Select Purchase Order</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPoModal(false)}
                className="p-1 rounded hover:bg-slate-100 text-slate-500"
              >
                <X size={16} />
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto space-y-1 text-xs">
              {orders.length === 0 ? (
                <div className="p-6 text-center text-slate-400">No open purchase orders found.</div>
              ) : (
                orders.map((po) => (
                  <div
                    key={po.id}
                    onClick={() => {
                      onSelectOrder(po.id);
                      setShowPoModal(false);
                    }}
                    className={`p-3 rounded-lg border cursor-pointer transition flex items-center justify-between ${
                      selectedOrderId === po.id
                        ? "border-[#00288e] bg-blue-50/50"
                        : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <div>
                      <div className="font-bold text-slate-900">{po.order_no || po.id}</div>
                      <div className="text-[11px] text-slate-500">
                        Supplier: {po.supplier_name || po.supplier_id} | Status: {po.status}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold font-mono">
                        ₹{(po.total_amount || po.grand_total || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </div>
                      <span className="text-[10px] text-[#00288e] font-bold">Select →</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowPoModal(false)}
                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 rounded text-xs font-bold text-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Supplier Browse Modal */}
      {showSupplierModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Search size={18} className="text-[#00288e]" />
                <h3 className="font-bold text-sm text-slate-900">Search Supplier</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSupplierModal(false)}
                className="p-1 rounded hover:bg-slate-100 text-slate-500"
              >
                <X size={16} />
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-1 text-xs">
              {suppliersList.map((s) => (
                <div
                  key={s.id}
                  onClick={() => {
                    onSupplierChange(s.id);
                    setShowSupplierModal(false);
                  }}
                  className={`p-2.5 rounded-lg border cursor-pointer transition flex items-center justify-between ${
                    supplierId === s.id ? "border-[#00288e] bg-blue-50/50" : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <div>
                    <div className="font-bold text-slate-900">{s.name || s.company_name}</div>
                    <div className="text-[11px] text-slate-500 font-mono">ID: {s.id} {s.gstin ? `| GSTIN: ${s.gstin}` : ""}</div>
                  </div>
                  <span className="text-[10px] text-[#00288e] font-bold">Select →</span>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowSupplierModal(false)}
                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 rounded text-xs font-bold text-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Item Tags Modal */}
      {showItemTagsModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Tag size={18} className="text-[#00288e]" />
                <h3 className="font-bold text-sm text-slate-900">Item Serial &amp; Batch Tags</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowItemTagsModal(false)}
                className="p-1 rounded hover:bg-slate-100 text-slate-500"
              >
                <X size={16} />
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-1 text-xs">
              {grnLines.length === 0 ? (
                <div className="p-6 text-center text-slate-400">No items in receipt. Scan items to view tags.</div>
              ) : (
                grnLines.map((item, idx) => (
                  <div key={item.rowId || idx} className="p-2 border-b border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-800">#{idx + 1} {item.code}</span> - {item.name}
                      <div className="text-[10px] text-slate-500">Qty: {item.quantity_received} | Rate: ₹{item.cost_price}</div>
                    </div>
                    <span className="font-mono text-[10px] px-2 py-0.5 bg-slate-100 rounded font-bold">
                      TAG-{item.code}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowItemTagsModal(false)}
                className="px-4 py-1.5 bg-[#00288e] text-white rounded text-xs font-bold hover:bg-[#1e40af]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Outward to Inward Modal */}
      {showOutwardModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Layers size={18} className="text-[#00288e]" />
                <h3 className="font-bold text-sm text-slate-900">Load Outward to Inward</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowOutwardModal(false)}
                className="p-1 rounded hover:bg-slate-100 text-slate-500"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-600">
                Match an inter-branch transfer dispatch challan from warehouse depot to automatically reconcile inward receipt.
              </p>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Transfer Dispatch Challan No.
                </label>
                <input
                  type="text"
                  placeholder="e.g. TR-DISP-2026-081"
                  className="w-full h-8 px-2.5 border border-slate-300 rounded font-mono text-xs outline-none focus:border-[#00288e]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowOutwardModal(false)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded text-xs font-bold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowOutwardModal(false);
                  onNotification?.("Outward Matched", "Loaded items from transfer dispatch challan.", "success");
                }}
                className="px-4 py-1.5 bg-[#00288e] text-white rounded text-xs font-bold hover:bg-[#1e40af]"
              >
                Load Dispatch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* List Hotkeys (F3) Modal */}
      {showHotkeysModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Keyboard size={18} className="text-[#00288e]" />
                <h3 className="font-bold text-sm text-slate-900">Goods Receipt Hotkeys</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowHotkeysModal(false)}
                className="p-1 rounded hover:bg-slate-100 text-slate-500"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-2 text-xs divide-y divide-slate-100">
              <div className="flex justify-between items-center py-1">
                <span className="font-medium text-slate-700">Select Purchase Order</span>
                <span className="font-mono font-bold bg-slate-100 px-2 py-0.5 rounded text-[11px]">F2</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="font-medium text-slate-700">List Hotkeys Guide</span>
                <span className="font-mono font-bold bg-slate-100 px-2 py-0.5 rounded text-[11px]">F3</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="font-medium text-slate-700">Load from PDT / Camera Scanner</span>
                <span className="font-mono font-bold bg-slate-100 px-2 py-0.5 rounded text-[11px]">F4</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="font-medium text-slate-700">Commit Direct Entry Row to Grid</span>
                <span className="font-mono font-bold bg-slate-100 px-2 py-0.5 rounded text-[11px]">Enter</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="font-medium text-slate-700">Save &amp; Post Goods Receipt</span>
                <span className="font-mono font-bold bg-slate-100 px-2 py-0.5 rounded text-[11px]">Ctrl+S</span>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowHotkeysModal(false)}
                className="px-4 py-1.5 bg-[#00288e] text-white rounded text-xs font-bold hover:bg-[#1e40af]"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default GrnDesktopTerminal;
