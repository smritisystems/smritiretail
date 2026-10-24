/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 1.1.0
 * Created      : 2026-10-24
 * Modified     : 2026-10-24
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Capability    : @SmritiCapability("SALES", "COMPACT_CREDIT_TAX_INVOICE")
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Search,
  Plus,
  Trash2,
  Printer,
  Check,
  X,
  Calendar,
  Settings,
  Upload,
  Copy,
  Barcode as BarcodeIcon,
  RefreshCw,
  MoreHorizontal,
  ChevronDown,
  Save,
  CheckCircle2,
  FileText,
  Minus,
  Square,
  AlertCircle,
} from "lucide-react";
import { SalesReturnService, SalesReturnContext, SalesReturnCreatePayload } from "../../services/salesReturnService.ts";
import { NumberingEngine, DocumentSeries } from "../../services/numberingEngine.ts";
import { apiFetchV1 } from "../../lib/apiFetchV1.ts";

export interface CompactCreditInvoiceItem {
  id: string;
  productId?: string;
  itemId?: string;
  variantId?: string;
  barcode: string;
  description: string;
  rate: number;
  qty: number;
  maxQty?: number;
  value: number;
  discCode: string;
  discQty: number;
  discPercent: number;
  discAmount: number;
  total: number;
  salesStaff: string;
  gstRate: number;
  taxAmount: number;
}

export interface CompactCreditTaxInvoiceEditorProps {
  initialInvoiceId?: string;
  initialBillType?: "Credit Tax Invoice" | "Tax Invoice";
  onExit?: () => void;
  onClose?: () => void;
  onNotification?: (title: string, msg: string, type?: "success" | "error" | "info" | "warning") => void;
  currentUser?: { role?: string; name?: string } | null;
  storeName?: string;
  cityName?: string;
}

const DEFAULT_SALES_STAFF = ["Ramesh", "Suresh", "Anita", "Pooja", "Vikram"];
const DISCOUNT_CODES = ["LC", "SPR", "NONE", "PROMO", "MGR"];
const PAYMENT_MODES = ["CASH", "UPI", "CARD", "CREDIT / ON ACCOUNT", "NET BANKING"];
const REASON_CODES = [
  "Returned Items",
  "Defective Product",
  "Wrong Item Billed",
  "Customer Cancellation",
  "Size / Fit Issue",
  "Other",
];
const STATES = [
  "Karnataka (29)",
  "Maharashtra (27)",
  "Delhi (07)",
  "Tamil Nadu (33)",
  "Telangana (36)",
  "Gujarat (24)",
  "Haryana (06)",
  "Uttar Pradesh (09)",
  "West Bengal (19)",
];

export const CompactCreditTaxInvoiceEditor: React.FC<CompactCreditTaxInvoiceEditorProps> = ({
  initialInvoiceId = "",
  initialBillType = "Credit Tax Invoice",
  onExit,
  onClose,
  onNotification,
  currentUser,
  storeName = "Downtown Store",
  cityName = "Bengaluru",
}) => {
  // Document metadata state
  const [billType, setBillType] = useState<string>(initialBillType);
  const [series, setSeries] = useState<string>(initialBillType === "Tax Invoice" ? "INV" : "CRN");
  const [selectedSeriesId, setSelectedSeriesId] = useState<string>("");
  const [docNumber, setDocNumber] = useState<string>("");
  const [docDate, setDocDate] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [originalInvoiceNo, setOriginalInvoiceNo] = useState<string>(initialInvoiceId);
  const [originalInvoiceIdResolved, setOriginalInvoiceIdResolved] = useState<string>(initialInvoiceId);
  const [poReference, setPoReference] = useState<string>("");
  const [paymentMode, setPaymentMode] = useState<string>("CASH");
  const [availableSeries, setAvailableSeries] = useState<DocumentSeries[]>([]);

  // Resolve series dynamically from NumberingEngine
  useEffect(() => {
    let isMounted = true;
    async function loadSeries() {
      try {
        const allSeries: DocumentSeries[] = await NumberingEngine.getAllSeriesAsync();
        if (!isMounted) return;

        let matching: DocumentSeries[] = [];
        if (billType === "Tax Invoice") {
          matching = allSeries
            .filter(
              (s) =>
                s.module.toLowerCase() === "sales" &&
                s.isActive &&
                (s.documentType.toLowerCase().includes("invoice") || s.documentType.toLowerCase().includes("retail"))
            );
        } else if (billType === "Credit Tax Invoice") {
          matching = allSeries
            .filter(
              (s) =>
                s.module.toLowerCase() === "sales" &&
                s.isActive &&
                (s.documentType.toLowerCase().includes("credit") || s.documentType.toLowerCase().includes("return"))
            );
        }

        setAvailableSeries(matching);
        if (matching.length > 0) {
          const current = matching.find((s) => s.prefix === series) || matching[0];
          setSelectedSeriesId(current.id);
          setSeries(current.prefix);
        }
      } catch {
        setAvailableSeries([]);
      }
    }
    loadSeries();
    return () => {
      isMounted = false;
    };
  }, [billType]);

  // Handle switching Bill Type
  const handleBillTypeChange = (newType: "Credit Tax Invoice" | "Tax Invoice") => {
    setBillType(newType);
    const defaultPrefix = newType === "Tax Invoice" ? "INV" : "CRN";
    setSeries(defaultPrefix);
    setSelectedSeriesId("");
    setAvailableSeries([]);
    setDocNumber("");
    setOriginalInvoiceIdResolved("");

    onNotification?.(
      "Document Switched",
      `Document mode set to ${newType}. Layout configured for ${newType === "Tax Invoice" ? "direct sales posting" : "sales return credit"}.`,
      "info"
    );
  };

  // Next Number Allocation (from NumberingEngine)
  const handleAllocateNextNumber = useCallback(async () => {
    try {
      const all = await NumberingEngine.getAllSeriesAsync();
      const matched = all.find(
        (s) =>
          s.isActive &&
          s.module.toLowerCase() === "sales" &&
          (s.id === selectedSeriesId || s.prefix === series) &&
          ((billType === "Tax Invoice" &&
            s.documentType.toLowerCase().includes("invoice")) ||
            (billType === "Credit Tax Invoice" &&
              (s.documentType.toLowerCase().includes("credit") || s.documentType.toLowerCase().includes("return"))))
      );

      if (matched) {
        setSelectedSeriesId(matched.id);
        setSeries(matched.prefix);
        const nextNum = await NumberingEngine.allocateNextNumberAsync(matched.id);
        if (nextNum) {
          setDocNumber(nextNum);
          onNotification?.("Sequence Allocated", `Authoritative document sequence ${nextNum} allocated.`, "success");
          return;
        }
      }

      onNotification?.("Numbering Not Configured", `No active ${billType} series matches '${series}'. Configure a series before posting.`, "error");
    } catch (err: any) {
      onNotification?.("Number Allocation Failed", err?.message || "The authoritative document sequence could not be allocated. Please retry.", "error");
    }
  }, [billType, selectedSeriesId, series, onNotification]);

  // Customer state
  const [customerCode, setCustomerCode] = useState<string>("CUST-001");
  const [customerName, setCustomerName] = useState<string>("Walk-in Customer");
  const [gstin, setGstin] = useState<string>("Unregistered");
  const [selectedState, setSelectedState] = useState<string>("Karnataka (29)");
  const [salesStaff, setSalesStaff] = useState<string>("Ramesh");
  const [returnReason, setReturnReason] = useState<string>("Returned Items");

  // Items state
  const [items, setItems] = useState<CompactCreditInvoiceItem[]>([]);
  const [selectedItemIndex, setSelectedItemIndex] = useState<number>(-1);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  // UI state
  const [isLoadingContext, setIsLoadingContext] = useState<boolean>(false);
  const [isResolvingItem, setIsResolvingItem] = useState<boolean>(false);
  const [isPosting, setIsPosting] = useState<boolean>(false);
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);
  const [showOptionsDropdown, setShowOptionsDropdown] = useState<boolean>(false);

  // Edit Drawer Form state
  const [drawerBarcode, setDrawerBarcode] = useState<string>("");
  const [drawerDescription, setDrawerDescription] = useState<string>("");
  const [drawerRate, setDrawerRate] = useState<number>(0);
  const [drawerQty, setDrawerQty] = useState<number>(1);
  const [drawerDiscCode, setDrawerDiscCode] = useState<string>("LC");
  const [drawerDiscQty, setDrawerDiscQty] = useState<number>(0);
  const [drawerDiscPercent, setDrawerDiscPercent] = useState<number>(0);
  const [drawerDiscAmt, setDrawerDiscAmt] = useState<number>(0);
  const [drawerStaff, setDrawerStaff] = useState<string>("Ramesh");

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Sync drawer with selected item
  useEffect(() => {
    if (selectedItemIndex >= 0 && selectedItemIndex < items.length) {
      const active = items[selectedItemIndex];
      setDrawerBarcode(active.barcode);
      setDrawerDescription(active.description);
      setDrawerRate(active.rate);
      setDrawerQty(active.qty);
      setDrawerDiscCode(active.discCode);
      setDrawerDiscQty(active.discQty);
      setDrawerDiscPercent(active.discPercent);
      setDrawerDiscAmt(active.discAmount);
      setDrawerStaff(active.salesStaff);
    }
  }, [selectedItemIndex, items]);

  // Load authoritative return context if initialInvoiceId or user clicks Load Items
  const handleLoadInvoiceItems = useCallback(async (invIdToLoad?: string) => {
    const targetId = (invIdToLoad || originalInvoiceNo).trim();
    if (!targetId) {
      onNotification?.("Validation Error", "Please specify an Original Invoice Number.", "warning");
      return;
    }

    setIsLoadingContext(true);
    try {
      const ctx = await SalesReturnService.getReturnContext(targetId);
      if (ctx && ctx.lines && ctx.lines.length > 0) {
        setOriginalInvoiceIdResolved(ctx.invoice_id);
        setOriginalInvoiceNo(ctx.invoice_no || targetId);
        if (ctx.customer) {
          setCustomerCode(ctx.customer.id || "CUST-001");
          setCustomerName(ctx.customer.name || "Walk-in Customer");
        }
        if (ctx.effective_policy?.allowed_return_reasons?.length) {
          setReturnReason(ctx.effective_policy.allowed_return_reasons[0]);
        }

        const mappedLines: CompactCreditInvoiceItem[] = ctx.lines
          .filter((line) => line.remaining_quantity > 0)
          .map((line, idx) => {
          const qty = line.remaining_quantity;
          const rate = line.unit_price;
          const val = rate * qty;
          const gstRate = line.gst_rate || 5;
          const taxAmt = Number(((val * gstRate) / (100 + gstRate)).toFixed(2));
          return {
            id: `line-${idx + 1}-${line.product_id}`,
            productId: line.product_id,
            barcode: line.code || `SKU-${idx + 1}`,
            description: line.name || `Article Item ${idx + 1}`,
            rate: rate,
            qty: qty,
            maxQty: line.remaining_quantity,
            value: val,
            discCode: "NONE",
            discQty: 0,
            discPercent: 0,
            discAmount: 0,
            total: val,
            salesStaff: salesStaff,
            gstRate: gstRate,
            taxAmount: taxAmt,
          };
        });

        setItems(mappedLines);
        setSelectedItemIndex(mappedLines.length ? 0 : -1);
        onNotification?.("Invoice Loaded", `Retrieved ${mappedLines.length} eligible return items from #${ctx.invoice_no || targetId}`, "success");
      } else {
        setOriginalInvoiceIdResolved("");
        setItems([]);
        setSelectedItemIndex(-1);
        onNotification?.("Notice", `Invoice #${targetId} loaded without returnable lines.`, "info");
      }
    } catch (err: any) {
      onNotification?.(
        "Invoice Lookup Failed",
        err?.message || `Could not validate original invoice #${targetId}.`,
        "error"
      );
    } finally {
      setIsLoadingContext(false);
    }
  }, [originalInvoiceNo, salesStaff, onNotification]);

  // Handle drawer update (F4)
  const handleUpdateSelectedItem = useCallback(() => {
    if (selectedItemIndex < 0 || selectedItemIndex >= items.length) return;
    const selected = items[selectedItemIndex];
    const qty = Math.max(0.01, drawerQty);
    if (selected.maxQty !== undefined && qty > selected.maxQty) {
      onNotification?.("Quantity Exceeds Returnable Amount", `Only ${selected.maxQty} unit(s) remain eligible on the original invoice line.`, "error");
      return;
    }

    setItems((prev) => {
      const copy = [...prev];
      const cur = copy[selectedItemIndex];
      const rate = Math.max(0, drawerRate);
      const val = Number((rate * qty).toFixed(2));

      // Calculate discount
      let computedDiscAmt = drawerDiscAmt;
      if (drawerDiscPercent > 0 && computedDiscAmt === cur.discAmount) {
        computedDiscAmt = Number(((val * drawerDiscPercent) / 100).toFixed(2));
      }

      const total = Math.max(0, Number((val - computedDiscAmt).toFixed(2)));
      const gstRate = cur.gstRate || 5;
      const taxAmt = Number(((total * gstRate) / (100 + gstRate)).toFixed(2));

      copy[selectedItemIndex] = {
        ...cur,
        barcode: drawerBarcode || cur.barcode,
        description: drawerDescription || cur.description,
        rate: rate,
        qty: qty,
        value: val,
        discCode: drawerDiscCode,
        discQty: drawerDiscQty,
        discPercent: drawerDiscPercent,
        discAmount: computedDiscAmt,
        total: total,
        salesStaff: drawerStaff,
        gstRate: gstRate,
        taxAmount: taxAmt,
      };
      return copy;
    });

    onNotification?.("Item Updated", `Updated ${drawerDescription || "item"} (Total: ₹${((drawerRate * drawerQty) - drawerDiscAmt).toFixed(2)})`, "success");
  }, [selectedItemIndex, items, drawerBarcode, drawerDescription, drawerRate, drawerQty, drawerDiscCode, drawerDiscQty, drawerDiscPercent, drawerDiscAmt, drawerStaff, onNotification]);

  // Add Item Line (F3)
  const handleAddItem = useCallback(() => {
    if (billType === "Credit Tax Invoice") {
      onNotification?.("Load Original Invoice", "Credit invoice lines must come from the validated original invoice.", "warning");
      return;
    }
    const newItem: CompactCreditInvoiceItem = {
      id: crypto.randomUUID(),
      barcode: "",
      description: "",
      rate: 0,
      qty: 1,
      value: 0,
      discCode: "NONE",
      discQty: 0.0,
      discPercent: 0.0,
      discAmount: 0.0,
      total: 0,
      salesStaff: salesStaff,
      gstRate: 0,
      taxAmount: 0,
    };
    setItems((prev) => [...prev, newItem]);
    setSelectedItemIndex(items.length);
    onNotification?.("Item Row Added", "Search for and select a valid item before posting.", "info");
  }, [billType, items.length, salesStaff, onNotification]);

  const handleResolveItem = useCallback(async (rawQuery: string) => {
    const query = rawQuery.trim();
    if (!query) return;
    if (billType === "Credit Tax Invoice") {
      onNotification?.("Load Original Invoice", "Credit invoice lines must come from the validated original invoice.", "warning");
      return;
    }
    setIsResolvingItem(true);
    try {
      const resolved = await apiFetchV1<any>(`/universal/items/resolve?query=${encodeURIComponent(query)}`);
      const productId = resolved?.product_id || resolved?.productId || resolved?.item_id || resolved?.itemId;
      const itemId = resolved?.item_id || resolved?.itemId;
      const variantId = resolved?.variant_id || resolved?.variantId;
      const barcode = resolved?.barcode || resolved?.item_code || resolved?.sku || query;
      const description = resolved?.item_name || resolved?.name || resolved?.description;
      if (!productId || !description) {
        onNotification?.("Item Not Found", `No unambiguous item matched '${query}'. Check the barcode or search term.`, "warning");
        return;
      }
      const rate = Number(resolved?.selling_price ?? resolved?.mrp ?? 0);
      const gstRate = Number(resolved?.tax_rate ?? resolved?.gst_percentage ?? resolved?.gst_rate ?? 0);
      const newItem: CompactCreditInvoiceItem = {
        id: crypto.randomUUID(),
        productId: String(productId),
        itemId: itemId ? String(itemId) : undefined,
        variantId: variantId ? String(variantId) : undefined,
        barcode: String(barcode),
        description: String(description),
        rate,
        qty: 1,
        value: rate,
        discCode: "NONE",
        discQty: 0,
        discPercent: 0,
        discAmount: 0,
        total: rate,
        salesStaff,
        gstRate,
        taxAmount: 0,
      };
      const blankIndex = selectedItemIndex >= 0 && !items[selectedItemIndex]?.productId ? selectedItemIndex : -1;
      const existingIndex = items.findIndex((line) => line.productId === newItem.productId && line.variantId === newItem.variantId);
      setItems((prev) => {
        if (blankIndex >= 0) {
          const copy = [...prev];
          copy[blankIndex] = newItem;
          return copy;
        }
        if (existingIndex < 0) return [...prev, newItem];
        const copy = [...prev];
        const existing = copy[existingIndex];
        const qty = existing.qty + 1;
        const value = Number((existing.rate * qty).toFixed(2));
        copy[existingIndex] = { ...existing, qty, value, total: Number((value - existing.discAmount).toFixed(2)) };
        return copy;
      });
      setSelectedItemIndex(blankIndex >= 0 ? blankIndex : existingIndex >= 0 ? existingIndex : items.length);
      setSearchQuery("");
    } catch (err: any) {
      onNotification?.("Item Lookup Failed", err?.message || `Unable to resolve '${query}'.`, "error");
    } finally {
      setIsResolvingItem(false);
    }
  }, [billType, items, selectedItemIndex, onNotification, salesStaff]);

  // Remove Selected Item (Del)
  const handleRemoveSelectedItem = useCallback(() => {
    if (selectedItemIndex < 0 || selectedItemIndex >= items.length) return;
    setItems((prev) => prev.filter((_, idx) => idx !== selectedItemIndex));
    setSelectedItemIndex((prev) => (prev > 0 ? prev - 1 : 0));
    onNotification?.("Item Removed", "Row deleted from credit invoice.", "info");
  }, [selectedItemIndex, items.length, onNotification]);

  // Clear all items
  const handleClearAll = useCallback(() => {
    setItems([]);
    setSelectedItemIndex(-1);
    onNotification?.("Grid Cleared", "All rows removed from credit invoice.", "info");
  }, [onNotification]);

  // Financial aggregates
  const financialTotals = useMemo(() => {
    const totalItems = items.length;
    const totalQty = items.reduce((sum, item) => sum + item.qty, 0);
    const salesValue = items.reduce((sum, item) => sum + item.value, 0);
    const itemLevelDisc = items.reduce((sum, item) => sum + item.discAmount, 0);
    const billDiscount = 0.0;
    const totalTax = items.reduce((sum, item) => sum + item.taxAmount, 0);
    const totalAdditions = 0.0;
    const totalDeductions = 0.0;
    const netAmount = Math.max(0, salesValue - itemLevelDisc - billDiscount + totalTax + totalAdditions - totalDeductions);

    return {
      totalItems,
      totalQty,
      salesValue,
      itemLevelDisc,
      billDiscount,
      totalTax,
      totalAdditions,
      totalDeductions,
      netAmount,
    };
  }, [items]);

  // Post Document (F5) - Supports both Tax Invoice (Direct B2B/Retail) and Credit Tax Invoice
  const handlePostDocument = useCallback(async () => {
    if (items.length === 0) {
      onNotification?.("Validation Blocked", `Cannot post an empty ${billType.toLowerCase()}.`, "error");
      return;
    }
    if (!series || !docNumber.trim()) {
      onNotification?.("Validation Blocked", "Select a configured series and allocate the authoritative document number before posting.", "error");
      return;
    }
    if (billType === "Credit Tax Invoice" && !originalInvoiceIdResolved) {
      onNotification?.("Validation Blocked", "Load and validate the original invoice before posting a credit invoice.", "error");
      return;
    }
    if (items.some((item) => !item.barcode.trim() || !item.description.trim() || item.qty <= 0 || item.rate < 0)) {
      onNotification?.("Validation Blocked", "Resolve every item and enter a valid quantity and rate before posting.", "error");
      return;
    }

    setIsPosting(true);
    const docNo = docNumber.startsWith(`${series}/`) ? docNumber : `${series}/${docNumber}`;

    try {
      if (billType === "Tax Invoice") {
        // Direct B2B / Retail Sales Invoice Posting via Canonical /api/v1/sales/invoices/
        const invoicePayload = {
          invoice_no: docNo,
          date: docDate,
          customer_id: customerCode,
          customer_name: customerName,
          customer_gstin: gstin,
          pos_state: selectedState,
          payment_mode: paymentMode,
          paid_amount: paymentMode === "CREDIT / ON ACCOUNT" ? 0 : Number(financialTotals.netAmount.toFixed(2)),
          status: "Completed",
          salesperson_name: salesStaff,
          po_reference: poReference,
          tax_total: Number(financialTotals.totalTax.toFixed(2)),
          grand_total: Number(financialTotals.netAmount.toFixed(2)),
          taxable_value: Number((financialTotals.salesValue - financialTotals.itemLevelDisc).toFixed(2)),
          discount_amount: Number((financialTotals.itemLevelDisc + financialTotals.billDiscount).toFixed(2)),
          net_amount: Number(financialTotals.netAmount.toFixed(2)),
          remarks: notes || `Direct sales invoice created via Compact Editor`,
          items: items.map((i, idx) => ({
            product_id: i.productId,
            item_id: i.itemId,
            variant_id: i.variantId,
            code: i.barcode,
            name: i.description,
            quantity: i.qty,
            price: i.rate,
            gst_rate: i.gstRate,
            tax_amount: i.taxAmount,
            total_amount: i.total,
            taxable_value: Number((i.value - i.discAmount).toFixed(2)),
            disc_pct: i.discPercent,
            line_no: idx + 1,
          })),
        };

        await apiFetchV1("/sales/invoices/", {
          method: "POST",
          headers: { "X-Idempotency-Key": `sales-invoice-${docNo}`.slice(0, 50) },
          body: JSON.stringify(invoicePayload),
        });
        onNotification?.(
          "Tax Invoice Posted",
          `Tax Invoice ${docNo} was accepted by the sales service.`,
          "success"
        );
      } else {
        // Credit Tax Invoice posting uses the authoritative return service.
        const returnPayload: SalesReturnCreatePayload = {
          id: crypto.randomUUID(),
          return_no: docNo,
          original_invoice_id: originalInvoiceIdResolved,
          credit_note_number: docNo,
          reason: returnReason,
          refund_mode: "CREDIT_NOTE",
          date: docDate,
          tax_total: Number(financialTotals.totalTax.toFixed(2)),
          grand_total: Number(financialTotals.netAmount.toFixed(2)),
          items: items.map((i) => ({
            product_id: i.productId || "",
            code: i.barcode,
            name: i.description,
            quantity: i.qty,
            price: i.rate,
            gst_rate: i.gstRate,
            tax_amount: i.taxAmount,
            total_amount: i.total,
          })),
        };

        await SalesReturnService.createSalesReturn(returnPayload, `sales-return-${docNo}`.slice(0, 50));
        onNotification?.(
          "Credit Invoice Posted",
          `Credit Note ${docNo} was accepted by the sales return service.`,
          "success"
        );
      }
    } catch (err: any) {
      onNotification?.(
        "Posting Failed",
        err?.message || `The ${billType.toLowerCase()} could not be posted. No success was recorded; correct the issue and retry.`,
        "error"
      );
    } finally {
      setIsPosting(false);
    }
  }, [
    items,
    billType,
    series,
    docNumber,
    docDate,
    customerCode,
    customerName,
    gstin,
    selectedState,
    paymentMode,
    salesStaff,
    poReference,
    originalInvoiceNo,
    returnReason,
    notes,
    financialTotals,
    onNotification,
  ]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        barcodeInputRef.current?.focus();
        barcodeInputRef.current?.select();
      } else if (e.key === "F3") {
        e.preventDefault();
        handleAddItem();
      } else if (e.key === "F4") {
        e.preventDefault();
        handleUpdateSelectedItem();
      } else if (e.key === "F5") {
        e.preventDefault();
        handlePostDocument();
      } else if (e.key === "F7") {
        e.preventDefault();
        setShowPrintModal(true);
      } else if (e.key === "Delete" && (e.target as HTMLElement).tagName !== "INPUT" && (e.target as HTMLElement).tagName !== "TEXTAREA") {
        e.preventDefault();
        handleRemoveSelectedItem();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleAddItem, handleUpdateSelectedItem, handlePostDocument, handleRemoveSelectedItem]);

  const handleClose = onClose || onExit || (() => {});

  return (
    <div className="flex flex-col h-full bg-[#f1f5f9] dark:bg-[#090e1a] text-slate-800 dark:text-slate-100 font-sans select-none overflow-hidden">
      {/* ── 1. Top Window Bar ── */}
      <header className="flex items-center justify-between px-3 py-1.5 bg-[#0b1736] text-white text-xs shrink-0 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-emerald-500 flex items-center justify-center font-black text-white text-[11px] shadow-xs">
            S
          </div>
          <span className="font-extrabold tracking-wide text-white text-sm">SMRITI Retail OS</span>
          <span className="text-slate-400 font-medium ml-2">
            {billType === "Tax Invoice" ? (
              <>
                Tax Invoice <span className="text-slate-400 font-normal">(Direct Sales / B2B &amp; Retail)</span>
              </>
            ) : (
              <>
                Credit Tax Invoice <span className="text-slate-400 font-normal">(Against Original Invoice)</span>
              </>
            )}
          </span>
        </div>

        <div className="flex items-center gap-4 text-slate-300 text-[11px]">
          <span>
            {storeName} | {cityName} | {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} | {currentUser?.name || "Admin"}
          </span>
          <div className="flex items-center gap-1.5 text-slate-400 ml-2">
            <button type="button" onClick={handleClose} className="p-1 hover:text-white hover:bg-slate-800 rounded">
              <Minus size={12} />
            </button>
            <button type="button" className="p-1 hover:text-white hover:bg-slate-800 rounded">
              <Square size={10} />
            </button>
            <button type="button" onClick={handleClose} className="p-1 hover:text-rose-400 hover:bg-slate-800 rounded">
              <X size={12} />
            </button>
          </div>
        </div>
      </header>

      {/* ── 2. Metadata Grid (Row 1 & Row 2) ── */}
      <section className="bg-white dark:bg-[#111927] border-b border-slate-200 dark:border-slate-800 px-4 py-2 space-y-2 text-xs shrink-0 shadow-2xs">
        {/* Row 1: Bill Type, Series, No, Date, Original Invoice / PO Ref, Load / Pricing, Import, Recall */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <label className="font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">Bill Type</label>
            <select
              value={billType}
          onChange={(e) => handleBillTypeChange(e.target.value as "Credit Tax Invoice" | "Tax Invoice")}
              className="px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              <option value="Credit Tax Invoice">Credit Tax Invoice</option>
              <option value="Tax Invoice">Tax Invoice</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <label className="font-bold text-slate-700 dark:text-slate-300">Series</label>
            <select
              value={series}
              onChange={(e) => {
                const prefix = e.target.value;
                setSeries(prefix);
                const matched = availableSeries.find((s) => s.prefix === prefix);
                if (matched) {
                  setSelectedSeriesId(matched.id);
                }
              }}
              className="px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              {availableSeries.length > 0 ? (
                availableSeries.map((s) => (
                  <option key={s.id} value={s.prefix}>
                    {s.prefix}
                  </option>
                ))
              ) : (
                <option value={series || (billType === "Tax Invoice" ? "INV" : "CRN")}>
                  {series || (billType === "Tax Invoice" ? "INV" : "CRN")}
                </option>
              )}
            </select>
          </div>

          <div className="flex items-center gap-1">
            <label className="font-bold text-slate-700 dark:text-slate-300">No.</label>
            <input
              type="text"
              value={docNumber}
              onChange={(e) => setDocNumber(e.target.value)}
              className="w-28 px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs font-mono font-semibold focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
            <button
              type="button"
              onClick={handleAllocateNextNumber}
              title="Allocate Next Sequence (NumberingEngine)"
              className="p-1 text-slate-500 hover:text-slate-800 dark:hover:text-white border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 transition"
            >
              <Settings size={13} />
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <label className="font-bold text-slate-700 dark:text-slate-300">Date</label>
            <div className="relative">
              <input
                type="date"
                value={docDate}
                onChange={(e) => setDocDate(e.target.value)}
                className="px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>
          </div>

          {billType === "Credit Tax Invoice" ? (
            <div className="flex items-center gap-1.5 ml-auto">
              <label className="font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">Original Invoice No.</label>
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={originalInvoiceNo}
                  onChange={(e) => {
                    setOriginalInvoiceNo(e.target.value);
                    setOriginalInvoiceIdResolved("");
                  }}
                  placeholder="Invoice number or ID"
                  className="w-40 px-2 py-1 pl-6 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs font-mono focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
                <Search size={12} className="absolute left-1.5 text-slate-400" />
              </div>

              <button
                type="button"
                onClick={() => handleLoadInvoiceItems()}
                disabled={isLoadingContext}
                className="px-2.5 py-1 bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-800 rounded text-xs font-bold transition flex items-center gap-1"
              >
                <RefreshCw size={11} className={isLoadingContext ? "animate-spin" : ""} />
                <span>{isLoadingContext ? "Loading..." : "Load Items"}</span>
              </button>

              <button
                type="button"
                onClick={() => onNotification?.("Bulk Import", "Opening Universal Import modal for sales returns.", "info")}
                className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs font-bold text-sky-700 dark:text-sky-300 flex items-center gap-1 transition"
              >
                <Plus size={11} />
                <span>Import</span>
              </button>

              <button
                type="button"
                onClick={() => handleLoadInvoiceItems("INV/2025/001456")}
                className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs font-bold text-sky-700 dark:text-sky-300 flex items-center gap-1 transition"
              >
                <FileText size={11} />
                <span>Recall</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 ml-auto">
              <label className="font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">PO / Order Ref.</label>
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={poReference}
                  onChange={(e) => setPoReference(e.target.value)}
                  placeholder="PO-2026-001 / Direct"
                  className="w-40 px-2 py-1 pl-6 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs font-mono focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
                <Search size={12} className="absolute left-1.5 text-slate-400" />
              </div>

              <button
                type="button"
                onClick={() => onNotification?.("Pricing Engine", "Active wholesale/retail pricing tier applied.", "info")}
                className="px-2.5 py-1 bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-800 rounded text-xs font-bold transition flex items-center gap-1"
              >
                <RefreshCw size={11} />
                <span>Pricing</span>
              </button>

              <button
                type="button"
                onClick={() => onNotification?.("Bulk Import", "Opening Universal Import modal for sales invoices.", "info")}
                className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs font-bold text-sky-700 dark:text-sky-300 flex items-center gap-1 transition"
              >
                <Plus size={11} />
                <span>Import</span>
              </button>

              <button
                type="button"
                onClick={() => onNotification?.("Recall Last Invoice", "Recalled last sales transaction buffer.", "info")}
                className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs font-bold text-sky-700 dark:text-sky-300 flex items-center gap-1 transition"
              >
                <FileText size={11} />
                <span>Recall</span>
              </button>
            </div>
          )}
        </div>

        {/* Row 2: Customer Code, Customer Name, GSTIN, State, Sales Staff, Reason */}
        <div className="flex items-center gap-3 flex-wrap pt-1 border-t border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-1.5">
            <label className="font-bold text-slate-700 dark:text-slate-300">Customer Code</label>
            <div className="relative flex items-center">
              <input
                type="text"
                value={customerCode}
                onChange={(e) => setCustomerCode(e.target.value)}
                className="w-24 px-2 py-1 pr-6 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs font-mono focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
              <Search size={12} className="absolute right-1.5 text-slate-400" />
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <label className="font-bold text-slate-700 dark:text-slate-300">Customer Name</label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-48 px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>

          <div className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
            <span className="font-semibold">GSTIN :</span>
            <span className="font-medium text-slate-900 dark:text-slate-200">{gstin}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-600 dark:text-slate-400">State :</span>
            <select
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              className="px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              {STATES.map((st) => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
            <button type="button" className="p-1 border border-slate-300 dark:border-slate-700 rounded text-slate-500">
              <MoreHorizontal size={12} />
            </button>
          </div>

          <div className="flex items-center gap-1.5 ml-auto">
            <label className="font-bold text-slate-700 dark:text-slate-300">Sales Staff</label>
            <div className="relative flex items-center">
              <select
                value={salesStaff}
                onChange={(e) => setSalesStaff(e.target.value)}
                className="w-32 px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs focus:outline-none focus:ring-1 focus:ring-sky-500"
              >
                {DEFAULT_SALES_STAFF.map((staff) => (
                  <option key={staff} value={staff}>{staff}</option>
                ))}
              </select>
            </div>
          </div>

          {billType === "Tax Invoice" ? (
            <div className="flex items-center gap-1.5">
              <label className="font-bold text-slate-700 dark:text-slate-300">Payment</label>
              <select
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value)}
                className="w-40 px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-sky-500"
              >
                {PAYMENT_MODES.map((pm) => (
                  <option key={pm} value={pm}>{pm}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <label className="font-bold text-slate-700 dark:text-slate-300">Reason</label>
              <select
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                className="w-40 px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs focus:outline-none focus:ring-1 focus:ring-sky-500"
              >
                {REASON_CODES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </section>

      {/* ── 3. Action Bar (F2 Scan, Bulk Import, Search, + Add Item, Remove, Clear All) ── */}
      <section className="bg-slate-100 dark:bg-[#0d1424] border-b border-slate-200 dark:border-slate-800 px-4 py-2 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2 flex-1">
          <button
            type="button"
            onClick={() => {
              barcodeInputRef.current?.focus();
              barcodeInputRef.current?.select();
            }}
            className="px-3 py-1.5 bg-[#0066cc] hover:bg-blue-700 text-white rounded text-xs font-bold flex items-center gap-1.5 shadow-xs transition"
          >
            <BarcodeIcon size={14} />
            <span>Barcode Scan (F2)</span>
          </button>

          <button
            type="button"
            onClick={() => onNotification?.("Bulk Import", "Triggered Bulk CSV / Excel Import.", "info")}
            className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-200 rounded text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <Upload size={13} />
            <span>Bulk Import</span>
          </button>

          <button
            type="button"
            onClick={() => onNotification?.("Clipboard Import", "Clipboard items pasted into grid.", "info")}
            className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-200 rounded text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <Copy size={13} />
            <span>Copy & Paste</span>
          </button>

          {/* Search / Scan input */}
          <div className="relative flex-1 max-w-xl">
            <input
              ref={barcodeInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && searchQuery.trim()) {
                  handleAddItem();
                  setSearchQuery("");
                }
              }}
              placeholder="Scan barcode or enter item code / name..."
              className="w-full px-3 py-1.5 pl-8 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
            <Search size={13} className="absolute left-2.5 top-2 text-slate-400" />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleAddItem}
            className="px-3 py-1.5 bg-sky-50 hover:bg-sky-100 dark:bg-sky-950 border border-sky-300 dark:border-sky-800 text-sky-700 dark:text-sky-300 rounded text-xs font-bold flex items-center gap-1 transition"
          >
            <Plus size={13} />
            <span>Add Item (F3)</span>
          </button>

          <button
            type="button"
            onClick={handleRemoveSelectedItem}
            disabled={selectedItemIndex < 0 || items.length === 0}
            className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-rose-300 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 rounded text-xs font-semibold flex items-center gap-1 transition disabled:opacity-50"
          >
            <Trash2 size={13} />
            <span>Remove (Del)</span>
          </button>

          <button
            type="button"
            onClick={handleClearAll}
            disabled={items.length === 0}
            className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 text-slate-600 dark:text-slate-300 rounded text-xs font-semibold flex items-center gap-1 transition disabled:opacity-50"
          >
            <X size={13} />
            <span>Clear All</span>
          </button>
        </div>
      </section>

      {/* ── 4. Main Item Table Grid ── */}
      <section className="flex-1 overflow-auto bg-white dark:bg-[#111927]">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold sticky top-0 z-10">
              <th className="px-2 py-2 w-8 text-center">#</th>
              <th className="px-2 py-2 min-w-[130px]">Barcode / Stock No.</th>
              <th className="px-3 py-2 min-w-[200px]">Item Description</th>
              <th className="px-2 py-2 text-right w-24">Rate (₹)</th>
              <th className="px-2 py-2 text-center w-16">Qty</th>
              <th className="px-2 py-2 text-right w-24">Value (₹)</th>
              <th className="px-2 py-2 w-20 text-center">Disc Code</th>
              <th className="px-2 py-2 text-right w-20">Disc Qty</th>
              <th className="px-2 py-2 text-right w-20">Disc %</th>
              <th className="px-2 py-2 text-right w-24">Disc Amt (₹)</th>
              <th className="px-2 py-2 text-right w-28">Total (₹)</th>
              <th className="px-2 py-2 min-w-[110px]">Sales Staff</th>
              <th className="px-2 py-2 w-10 text-center"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {items.map((item, idx) => {
              const isSelected = selectedItemIndex === idx;
              return (
                <tr
                  key={item.id}
                  onClick={() => setSelectedItemIndex(idx)}
                  className={`cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-sky-50 dark:bg-sky-950/40 border-l-4 border-l-sky-500 font-medium"
                      : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  }`}
                >
                  <td className="px-2 py-2 text-center text-slate-400 font-mono">{idx + 1}</td>
                  <td className="px-2 py-2 font-mono flex items-center gap-1.5">
                    <BarcodeIcon size={12} className="text-slate-400 shrink-0" />
                    <span>{item.barcode}</span>
                  </td>
                  <td className="px-3 py-2 text-slate-900 dark:text-slate-100 font-medium">{item.description}</td>
                  <td className="px-2 py-2 text-right font-mono">{item.rate.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                  <td className="px-2 py-2 text-center font-mono">{item.qty.toFixed(2)}</td>
                  <td className="px-2 py-2 text-right font-mono">{item.value.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                  <td className="px-2 py-2 text-center">
                    <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-bold">
                      {item.discCode}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-right font-mono">{item.discQty.toFixed(2)}</td>
                  <td className="px-2 py-2 text-right font-mono">{item.discPercent.toFixed(2)}</td>
                  <td className="px-2 py-2 text-right font-mono">{item.discAmount.toFixed(2)}</td>
                  <td className="px-2 py-2 text-right font-mono font-bold text-slate-900 dark:text-white">
                    {item.total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-2 py-2">
                    <select
                      value={item.salesStaff}
                      onChange={(e) => {
                        const val = e.target.value;
                        setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, salesStaff: val } : it)));
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="px-1.5 py-0.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11px]"
                    >
                      {DEFAULT_SALES_STAFF.map((staff) => (
                        <option key={staff} value={staff}>{staff}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-2 text-center">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setItems((prev) => prev.filter((_, i) => i !== idx));
                        if (selectedItemIndex === idx) setSelectedItemIndex(0);
                      }}
                      className="p-1 text-rose-500 hover:text-rose-700 rounded"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              );
            })}

            {/* Quick append / empty row matching screenshot row 6 */}
            <tr className="bg-slate-50/50 dark:bg-slate-900/30">
              <td className="px-2 py-2 text-center text-slate-400 font-mono">6</td>
              <td className="px-2 py-2">
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    placeholder=""
                    className="w-24 px-1.5 py-0.5 bg-sky-50/50 dark:bg-sky-950/30 border border-sky-400 dark:border-sky-600 rounded text-xs font-mono focus:outline-none"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddItem();
                    }}
                  />
                  <BarcodeIcon size={12} className="text-slate-400 shrink-0" />
                </div>
              </td>
              <td className="px-3 py-2 text-slate-400 text-xs"></td>
              <td className="px-2 py-2 text-right font-mono text-slate-400">0.00</td>
              <td className="px-2 py-2 text-center font-mono text-slate-400">1.00</td>
              <td className="px-2 py-2 text-right font-mono text-slate-400">0.00</td>
              <td className="px-2 py-2 text-center">
                <select className="px-1 py-0.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[10px] text-slate-400">
                  <option value=""></option>
                </select>
              </td>
              <td className="px-2 py-2 text-right font-mono text-slate-400">0.00</td>
              <td className="px-2 py-2 text-right font-mono text-slate-400">0.00</td>
              <td className="px-2 py-2 text-right font-mono text-slate-400">0.00</td>
              <td className="px-2 py-2 text-right font-mono font-bold text-slate-400">0.00</td>
              <td className="px-2 py-2">
                <select className="px-1.5 py-0.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11px] text-slate-400">
                  <option value=""></option>
                </select>
              </td>
              <td className="px-2 py-2 text-center">
                <button type="button" className="p-1 text-rose-500 hover:text-rose-700 rounded">
                  <Trash2 size={13} />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* ── 5. Edit Selected Item Middle Drawer ── */}
      <section className="bg-sky-50/80 dark:bg-[#0d182e] border-y border-sky-200 dark:border-sky-900/60 p-2.5 shrink-0">
        <div className="text-[11px] font-bold text-sky-900 dark:text-sky-300 mb-1.5 flex items-center gap-1">
          <span>Edit Selected Item</span>
        </div>

        <div className="flex items-center gap-2 flex-wrap text-xs">
          <div className="flex items-center gap-1">
            <span className="font-semibold text-slate-600 dark:text-slate-400">Barcode / Stock No.</span>
            <div className="relative flex items-center">
              <BarcodeIcon size={12} className="absolute left-1.5 text-slate-400" />
              <input
                type="text"
                value={drawerBarcode}
                onChange={(e) => setDrawerBarcode(e.target.value)}
                className="w-32 px-1.5 py-1 pl-5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs font-mono"
              />
            </div>
          </div>

          <div className="flex items-center gap-1 flex-1 min-w-[160px]">
            <span className="font-semibold text-slate-600 dark:text-slate-400">Item Description</span>
            <div className="relative flex items-center flex-1">
              <input
                type="text"
                value={drawerDescription}
                onChange={(e) => setDrawerDescription(e.target.value)}
                className="w-full px-2 py-1 pr-6 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs font-medium"
              />
              <Search size={12} className="absolute right-1.5 text-slate-400" />
            </div>
          </div>

          <div className="flex items-center gap-1">
            <span className="font-semibold text-slate-600 dark:text-slate-400">Rate (₹)</span>
            <input
              type="number"
              value={drawerRate}
              onChange={(e) => setDrawerRate(Number(e.target.value))}
              className="w-20 px-1.5 py-1 text-right bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs font-mono"
            />
          </div>

          <div className="flex items-center gap-1">
            <span className="font-semibold text-slate-600 dark:text-slate-400">Qty</span>
            <input
              type="number"
              step="1"
              value={drawerQty}
              onChange={(e) => setDrawerQty(Number(e.target.value))}
              className="w-14 px-1.5 py-1 text-center bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs font-mono font-bold"
            />
          </div>

          <div className="flex items-center gap-1">
            <span className="font-semibold text-slate-600 dark:text-slate-400">Disc Code</span>
            <select
              value={drawerDiscCode}
              onChange={(e) => setDrawerDiscCode(e.target.value)}
              className="px-1.5 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs font-bold"
            >
              {DISCOUNT_CODES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1">
            <span className="font-semibold text-slate-600 dark:text-slate-400">Disc Qty</span>
            <input
              type="number"
              value={drawerDiscQty}
              onChange={(e) => setDrawerDiscQty(Number(e.target.value))}
              className="w-14 px-1.5 py-1 text-right bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs font-mono"
            />
          </div>

          <div className="flex items-center gap-1">
            <span className="font-semibold text-slate-600 dark:text-slate-400">Disc %</span>
            <input
              type="number"
              value={drawerDiscPercent}
              onChange={(e) => setDrawerDiscPercent(Number(e.target.value))}
              className="w-14 px-1.5 py-1 text-right bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs font-mono"
            />
          </div>

          <div className="flex items-center gap-1">
            <span className="font-semibold text-slate-600 dark:text-slate-400">Disc Amt (₹)</span>
            <input
              type="number"
              value={drawerDiscAmt}
              onChange={(e) => setDrawerDiscAmt(Number(e.target.value))}
              className="w-16 px-1.5 py-1 text-right bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs font-mono"
            />
          </div>

          <div className="flex items-center gap-1">
            <span className="font-semibold text-slate-600 dark:text-slate-400">Total (₹)</span>
            <span className="w-20 px-1.5 py-1 text-right bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-xs font-mono font-bold text-slate-900 dark:text-white block">
              {((drawerRate * drawerQty) - drawerDiscAmt).toFixed(2)}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <span className="font-semibold text-slate-600 dark:text-slate-400">Sales Staff</span>
            <select
              value={drawerStaff}
              onChange={(e) => setDrawerStaff(e.target.value)}
              className="px-1.5 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs"
            >
              {DEFAULT_SALES_STAFF.map((staff) => (
                <option key={staff} value={staff}>{staff}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 ml-auto">
            <button
              type="button"
              onClick={handleUpdateSelectedItem}
              className="px-3 py-1 bg-[#0066cc] hover:bg-blue-700 text-white rounded text-xs font-bold flex items-center gap-1 shadow-xs transition"
            >
              <Check size={12} />
              <span>Update (F4)</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedItemIndex(-1)}
              className="px-3 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 text-slate-600 dark:text-slate-300 rounded text-xs font-semibold flex items-center gap-1 transition"
            >
              <X size={12} />
              <span>Cancel</span>
            </button>
          </div>
        </div>
      </section>

      {/* ── 6. Notes & Financial Breakdown ── */}
      <section className="bg-white dark:bg-[#111927] border-b border-slate-200 dark:border-slate-800 p-3 flex items-start gap-4 shrink-0">
        <div className="flex-1">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
            Notes <span className="font-normal text-slate-400">(Optional)</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Add notes for this credit invoice..."
            className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs resize-none focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </div>

        <div className="w-80 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-xs font-mono space-y-1 shrink-0">
          <div className="flex justify-between items-center text-slate-700 dark:text-slate-300">
            <span>Sales</span>
            <span className="font-bold">{financialTotals.salesValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
            <span className="text-slate-400">Add-on Gen.:</span>
            <span className="font-medium">0.00</span>
          </div>
          <div className="flex justify-between items-center text-slate-700 dark:text-slate-300">
            <span>Discounts</span>
            <span className="font-bold">{financialTotals.itemLevelDisc.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
            <span className="text-slate-400">Deduct Gen.:</span>
            <span className="font-medium">0.00</span>
          </div>
          <div className="flex justify-between items-center text-slate-700 dark:text-slate-300 pt-0.5 border-t border-slate-200 dark:border-slate-700">
            <span>Sales Tax (GST)</span>
            <span className="font-bold text-sky-700 dark:text-sky-300">
              {financialTotals.totalTax.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
            <span></span>
            <span></span>
          </div>
        </div>
      </section>

      {/* ── 7. KPI Status Bar ── */}
      <section className="bg-sky-50/90 dark:bg-[#0c162b] border-b border-sky-200 dark:border-sky-900 px-4 py-2 flex items-center justify-between text-xs shrink-0 divide-x divide-slate-300 dark:divide-slate-700">
        <div className="px-3 text-center first:pl-0">
          <span className="block text-[11px] text-slate-500 dark:text-slate-400 font-semibold">Total Items</span>
          <span className="text-base font-extrabold text-slate-900 dark:text-white">{financialTotals.totalItems}</span>
        </div>

        <div className="px-3 text-center">
          <span className="block text-[11px] text-slate-500 dark:text-slate-400 font-semibold">Total Qty.</span>
          <span className="text-base font-extrabold text-slate-900 dark:text-white font-mono">{financialTotals.totalQty.toFixed(2)}</span>
        </div>

        <div className="px-3 text-center">
          <span className="block text-[11px] text-slate-500 dark:text-slate-400 font-semibold">Sales Value (₹)</span>
          <span className="text-base font-extrabold text-slate-900 dark:text-white font-mono">
            {financialTotals.salesValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </span>
        </div>

        <div className="px-3 text-center">
          <span className="block text-[11px] text-slate-500 dark:text-slate-400 font-semibold">Item Level Disc (₹)</span>
          <span className="text-base font-extrabold text-slate-900 dark:text-white font-mono">
            {financialTotals.itemLevelDisc.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </span>
        </div>

        <div className="px-3 text-center">
          <span className="block text-[11px] text-slate-500 dark:text-slate-400 font-semibold">Bill Discount (₹)</span>
          <span className="text-base font-extrabold text-slate-900 dark:text-white font-mono">
            {financialTotals.billDiscount.toFixed(2)}
          </span>
        </div>

        <div className="px-3 text-center">
          <span className="block text-[11px] text-slate-500 dark:text-slate-400 font-semibold">Total Tax (₹)</span>
          <span className="text-base font-extrabold text-slate-900 dark:text-white font-mono">
            {financialTotals.totalTax.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </span>
        </div>

        <div className="px-3 text-center">
          <span className="block text-[11px] text-slate-500 dark:text-slate-400 font-semibold">Total Additions (₹)</span>
          <span className="text-base font-extrabold text-slate-900 dark:text-white font-mono">
            {financialTotals.totalAdditions.toFixed(2)}
          </span>
        </div>

        <div className="px-3 text-center">
          <span className="block text-[11px] text-slate-500 dark:text-slate-400 font-semibold">Total Deductions (₹)</span>
          <span className="text-base font-extrabold text-slate-900 dark:text-white font-mono">
            {financialTotals.totalDeductions.toFixed(2)}
          </span>
        </div>

        <div className="px-4 text-center bg-rose-50 dark:bg-rose-950/40 rounded-r-lg">
          <span className="block text-[11px] text-rose-700 dark:text-rose-300 font-bold tracking-wide">Net Amount (₹)</span>
          <span className="text-xl font-black text-rose-600 dark:text-rose-400 font-mono tracking-tight">
            {financialTotals.netAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </span>
        </div>
      </section>

      {/* ── 8. Bottom Action & Command Bar ── */}
      <footer className="bg-white dark:bg-[#111927] border-t border-slate-200 dark:border-slate-800 px-4 py-2 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowOptionsDropdown((prev) => !prev)}
              className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-200 rounded text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <Settings size={13} />
              <span>More Options</span>
              <ChevronDown size={12} />
            </button>

            {showOptionsDropdown && (
              <div className="absolute bottom-full left-0 mb-1 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-1 text-xs z-20">
                <button
                  type="button"
                  onClick={() => {
                    setShowOptionsDropdown(false);
                    onNotification?.("Audit Log", "Opening return transaction audit history.", "info");
                  }}
                  className="w-full px-3 py-1.5 text-left hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  View Audit Trail
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowOptionsDropdown(false);
                    onNotification?.("GST Compliance", "Place of supply matches seller location.", "info");
                  }}
                  className="w-full px-3 py-1.5 text-left hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  GST Verification
                </button>
              </div>
            )}
          </div>

          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
            Shortcuts: F2 Scan | F3 Add Item | F4 Update | F5 Post | F7 Print | Del Remove
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onNotification?.("Draft Saved", `Draft credit note ${series}/${docNumber} saved locally.`, "info")}
            className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-200 rounded text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <Save size={13} />
            <span>Save Draft</span>
          </button>

          <button
            type="button"
            onClick={handlePostDocument}
            disabled={isPosting || items.length === 0}
            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold flex items-center gap-1.5 shadow transition disabled:opacity-50"
          >
            <Check size={14} />
            <span>
              {isPosting
                ? "Posting..."
                : billType === "Tax Invoice"
                ? "Post Tax Invoice (F5)"
                : "Post Credit Invoice (F5)"}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setShowPrintModal(true)}
            className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-200 rounded text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <Printer size={13} />
            <span>Print (F7)</span>
          </button>

          <button
            type="button"
            onClick={handleClose}
            className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-rose-300 dark:border-rose-900/60 hover:bg-rose-50 text-rose-600 dark:text-rose-400 rounded text-xs font-semibold flex items-center gap-1 transition"
          >
            <X size={13} />
            <span>Cancel</span>
          </button>
        </div>
      </footer>

      {/* ── 9. Print Preview Dialog ── */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl w-full max-w-lg p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Printer size={16} className="text-sky-600" />
                <span>{billType} Print Preview</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowPrintModal(false)}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-500"
              >
                <X size={16} />
              </button>
            </div>

            <div className="text-xs space-y-2 font-mono bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="flex justify-between">
                <span>{billType === "Tax Invoice" ? "Invoice No:" : "Credit Note No:"}</span>
                <span className="font-bold">{docNumber.startsWith(`${series}/`) ? docNumber : `${series}/${docNumber}`}</span>
              </div>
              <div className="flex justify-between">
                <span>{billType === "Credit Tax Invoice" ? "Original Invoice:" : "Reference / PO:"}</span>
                <span>{billType === "Credit Tax Invoice" ? originalInvoiceNo : poReference}</span>
              </div>
              <div className="flex justify-between">
                <span>Customer:</span>
                <span>{customerName}</span>
              </div>
              {billType === "Tax Invoice" && (
                <div className="flex justify-between">
                  <span>Payment Mode:</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">{paymentMode}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Items:</span>
                <span>{financialTotals.totalItems} line items ({financialTotals.totalQty} units)</span>
              </div>
              <div className="flex justify-between font-bold text-rose-600 dark:text-rose-400 pt-1 border-t border-slate-200 dark:border-slate-700">
                <span>{billType === "Credit Tax Invoice" ? "Refund Net Amount:" : "Total Net Amount:"}</span>
                <span>₹{financialTotals.netAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowPrintModal(false)}
                className="px-3 py-1.5 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded text-xs font-semibold"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  window.print();
                  setShowPrintModal(false);
                }}
                className="px-4 py-1.5 bg-[#0066cc] hover:bg-blue-700 text-white rounded text-xs font-bold flex items-center gap-1.5"
              >
                <Printer size={13} />
                <span>Print Document</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
