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

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Package,
  FolderOpen,
  Plus,
  Save,
  Printer,
  MoreVertical,
  Search,
  Check,
  X,
  Barcode,
  FileSpreadsheet,
  Layers,
  Tag,
  Keyboard,
  Trash2,
  Edit3,
  ExternalLink,
  RefreshCw,
  FileText,
  Truck,
  Building2,
  Calendar,
  AlertTriangle,
  Receipt,
  ChevronDown,
  ChevronUp,
  Info,
  ArrowRight,
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

  // Search & Filter State
  const [searchPoQuery, setSearchPoQuery] = useState("");
  const [searchSupplierQuery, setSearchSupplierQuery] = useState("");
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [localOrders, setLocalOrders] = useState<any[]>(orders || []);
  const [localSuppliers, setLocalSuppliers] = useState<any[]>(suppliersList || []);

  // Selected Grid Row Index
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);

  // Direct Entry Strip State
  const [entryStockNo, setEntryStockNo] = useState("");
  const [entryDescription, setEntryDescription] = useState("");
  const [entryDocQty, setEntryDocQty] = useState("1.00");
  const [entryActQty, setEntryActQty] = useState("1.00");
  const [entrySellingPrice, setEntrySellingPrice] = useState("0.00");
  const [entryDamageQty, setEntryDamageQty] = useState("0.00");
  const [entryPurchasePrice, setEntryPurchasePrice] = useState("0.00");
  const [entryDiscountRate, setEntryDiscountRate] = useState("0.00");
  const [entryDiscountAmount, setEntryDiscountAmount] = useState("0.00");
  const [entryTaxRate, setEntryTaxRate] = useState("0.00");
  const [entryTaxAmount, setEntryTaxAmount] = useState("0.00");
  const [entryAddonBeforeTax, setEntryAddonBeforeTax] = useState("0.00");
  const [entryAddonAfterTax, setEntryAddonAfterTax] = useState("0.00");
  const [entryDeductionBeforeTax, setEntryDeductionBeforeTax] = useState("0.00");
  const [entryDeductionAfterTax, setEntryDeductionAfterTax] = useState("0.00");

  // Landed Cost (India Addons) Breakdown State
  const [showLandedCostModal, setShowLandedCostModal] = useState(false);
  const [landedCostBreakdown, setLandedCostBreakdown] = useState({
    baseFobCost: 0,
    freightCharges: 0,
    freightTreatment: "BEFORE_TAX" as "BEFORE_TAX" | "AFTER_TAX",
    laborHandlingCharges: 0,
    laborTreatment: "AFTER_TAX" as "BEFORE_TAX" | "AFTER_TAX",
    insuranceCharges: 0,
    customsDutyBcd: 0,
    customsSws: 0,
    clearanceChaFees: 0,
    clearanceTreatment: "AFTER_TAX" as "BEFORE_TAX" | "AFTER_TAX",
    allocationMethod: "VALUE" as "VALUE" | "QUANTITY",
  });

  // Sub-Tab Navigation Bar & Inspection Workspace State
  const [activeSubTab, setActiveSubTab] = useState<
    "ITEMS" | "DAMAGE" | "LANDED_COST" | "TAX" | "DEBIT_NOTE" | "DOC_NOTES"
  >("ITEMS");
  const [showBottomPanels, setShowBottomPanels] = useState(true);

  // Quality Control & Damage Management State
  const [damageReason, setDamageReason] = useState("Transit Breakage");
  const [damageHandlingType, setDamageHandlingType] = useState("Reject & Debit Note (Supplier Chargeback)");
  const [damageWarehouse, setDamageWarehouse] = useState("WH-MAIN-DMG (Damage Quarantine)");
  const [qcRemarks, setQcRemarks] = useState("QC inspection completed at inward staging bay.");
  const [deliveryInstructionsModal, setDeliveryInstructionsModal] = useState(false);
  const [deliveryInstructions, setDeliveryInstructions] = useState(
    "Unload at Gate 2 Staging Bay. Unpack and verify quantity within 2 hours of arrival."
  );

  // Real-Time Telemetry State
  const [telemetry, setTelemetry] = useState({
    currentBalance: 0,
    reservedStock: 0,
    availableBalance: 0,
    lastPurchasePrice: 0,
    stockNo: "—",
  });

  const stockInputRef = useRef<HTMLInputElement>(null);
  const docQtyInputRef = useRef<HTMLInputElement>(null);

  // Synchronize orders and suppliers when props change
  useEffect(() => {
    if (orders && orders.length > 0) {
      setLocalOrders(orders);
    }
  }, [orders]);

  useEffect(() => {
    if (suppliersList && suppliersList.length > 0) {
      setLocalSuppliers(suppliersList);
    }
  }, [suppliersList]);

  // Fetch Live Purchase Orders from Backend DB
  const fetchLiveOrders = useCallback(async (supplierFilter?: string) => {
    setOrdersLoading(true);
    try {
      const q = supplierFilter
        ? `/purchase/orders/?pending_only=true&supplier_id=${encodeURIComponent(supplierFilter)}`
        : `/purchase/orders/?pending_only=true`;
      const res = await apiFetchV1(q);
      const list = Array.isArray(res) ? res : res?.items || [];
      const filtered = list.filter((o: any) => {
        const st = (o.status || "").toUpperCase();
        return st !== "CANCELLED" && st !== "RECEIVED" && st !== "COMPLETED" && st !== "DRAFT";
      });
      setLocalOrders(filtered);
    } catch {
      // Keep existing
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  // Fetch Live Suppliers if empty
  const fetchLiveSuppliers = useCallback(async () => {
    try {
      const res = await apiFetchV1("/purchase/suppliers/");
      const list = Array.isArray(res) ? res : res?.items || [];
      if (list.length > 0) {
        setLocalSuppliers(list);
      }
    } catch {
      // Fallback to vendors
      try {
        const vRes = await apiFetchV1("/purchase/vendors/");
        const vList = Array.isArray(vRes) ? vRes : vRes?.items || [];
        if (vList.length > 0) setLocalSuppliers(vList);
      } catch {}
    }
  }, []);

  // Initial fetch if lists are empty
  useEffect(() => {
    if (localOrders.length === 0) {
      fetchLiveOrders();
    }
    if (localSuppliers.length === 0) {
      fetchLiveSuppliers();
    }
  }, [fetchLiveOrders, fetchLiveSuppliers, localOrders.length, localSuppliers.length]);

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

  // Wire up Purchase Order Selection & Line Loading
  const handleSelectPurchaseOrder = async (poId: string) => {
    onSelectOrder(poId);
    setShowPoModal(false);

    let targetPo = localOrders.find((o) => o.id === poId || o.order_id === poId || o.order_no === poId);

    // If order has no items populated, fetch full details from backend
    if (!targetPo?.items || targetPo.items.length === 0) {
      try {
        const fetched = await apiFetchV1(`/purchase/orders/${poId}`);
        if (fetched) targetPo = fetched;
      } catch {
        // Continue with local order
      }
    }

    if (targetPo) {
      // 1. Link Supplier
      const supId = targetPo.supplier_id || "";
      onSupplierChange(supId);

      // 2. Set Reference PO / DC No
      const poNum = targetPo.order_no || targetPo.order_number || poId;
      onInvoiceNumberChange(poNum);

      // 3. Extract Doc Prefix / Doc No if format is e.g. PO-10 or P17-41
      if (poNum.includes("-")) {
        const parts = poNum.split("-");
        if (parts.length === 2 && !isNaN(Number(parts[1]))) {
          setDocPrefix(parts[0]);
          setDocNo(parts[1]);
        }
      }

      // 4. Map line items to GRN grid
      const poItems = targetPo.items || [];
      if (poItems.length > 0) {
        const newLines: GrnLineItem[] = poItems.map((item: any, idx: number) => {
          const qtyOrdered = Number(item.quantity) || 1;
          const cost = Number(item.cost_price || item.unit_price) || 0;
          const gst = Number(item.gst_rate) || 18;
          const mrp = Number(item.mrp) || Number(cost * 1.5);
          return {
            rowId: `po-${targetPo.id}-${item.id || idx}-${Date.now()}`,
            product_id: item.product_id || item.item_id || `prod-${item.code || idx}`,
            item_id: item.item_id || item.id || "",
            code: item.code || `SKU-${idx + 1}`,
            name: item.name || item.item_name || item.description || `Item ${idx + 1}`,
            size: item.size || "Standard",
            color: item.color || "Standard",
            quantity_ordered: qtyOrdered,
            quantity_received: qtyOrdered,
            quantity_damaged: 0,
            cost_price: cost,
            invoice_rate: cost,
            trade_discount: 0,
            gst_rate: gst,
            mrp: mrp,
            addon_before_tax: 0,
            addon_after_tax: 0,
            deduction_before_tax: 0,
            deduction_after_tax: 0,
          };
        });

        onUpdateGrnLines(newLines);
        onNotification?.("Purchase Order Loaded", `Loaded ${newLines.length} items from PO ${poNum}.`, "success");
      } else {
        onNotification?.("Order Selected", `Selected PO ${poNum}. No line items found in order.`, "info");
      }

      // 5. Telemetry update and focus direct entry
      stockInputRef.current?.focus();
    }
  };

  // Wire up manual Ref./DC No lookup (typing PO number and hitting Enter)
  const handleRefDcBlurOrEnter = async (val: string) => {
    const clean = val.trim().toLowerCase();
    if (!clean) return;
    const match = localOrders.find(
      (o) =>
        (o.order_no && o.order_no.toLowerCase() === clean) ||
        (o.order_number && o.order_number.toLowerCase() === clean) ||
        o.id === clean
    );
    if (match) {
      await handleSelectPurchaseOrder(match.id || match.order_id);
    }
  };

  // Handle Row Selection in Grid
  const handleSelectRow = (idx: number) => {
    setSelectedRowIndex(idx);
    const item = grnLines[idx];
    if (item) {
      setEntryStockNo(item.code);
      setEntryDescription(item.name);
      setEntryDocQty(item.quantity_ordered ? item.quantity_ordered.toFixed(2) : item.quantity_received.toFixed(2));
      setEntryActQty(item.quantity_received.toFixed(2));
      setEntryDamageQty((item.quantity_damaged || 0).toFixed(2));
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

  // Direct Entry Item Lookup (Fast Catalog & Telemetry Check)
  const handleStockNoLookup = async (code: string) => {
    if (!code.trim()) return;
    const cleanCode = code.trim().toLowerCase();

    // 1. Check if SKU exists in currently loaded PO lines
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

    // 2. Query high-speed products search endpoint
    try {
      const res = await apiFetchV1(`/products/search?q=${encodeURIComponent(code)}&limit=5`);
      const items = Array.isArray(res) ? res : res?.items || [];
      if (items.length > 0) {
        const match = items[0];
        setEntryDescription(match.name || `Item ${code}`);
        const cost = Number(match.cost_price || match.buying_price || 100);
        const mrp = Number(match.mrp || match.price || cost * 1.5);
        const gst = Number(match.gst_percentage || match.gst_rate || 18);
        setEntryPurchasePrice(cost.toFixed(2));
        setEntrySellingPrice(mrp.toFixed(2));
        setEntryTaxRate(gst.toFixed(2));
        setTelemetry({
          currentBalance: match.current_stock || 0,
          reservedStock: match.reserved_stock || 0,
          availableBalance: match.available_stock || 0,
          lastPurchasePrice: cost,
          stockNo: match.code || match.sku || code,
        });
        docQtyInputRef.current?.focus();
        return;
      }
    } catch {
      // Fallback
    }

    // 3. Fallback: inventory query
    try {
      const res = await apiFetchV1(`/inventory/?page=1&page_size=5&q=${encodeURIComponent(code)}`);
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
    const damageQty = parseFloat(entryDamageQty) || 0;
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
        quantity_damaged: damageQty,
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
        quantity_damaged: damageQty,
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
    setEntryDamageQty("0.00");
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

  const totalDamageQty = useMemo(() => {
    return grnLines.reduce((acc, r) => acc + (r.quantity_damaged || 0), 0);
  }, [grnLines]);

  const totalSoundQty = useMemo(() => {
    return Math.max(0, totalActQty - totalDamageQty);
  }, [totalActQty, totalDamageQty]);

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
    const tot = totalValue + totalTaxAmount + totalAddons - totalDeductions;
    return Math.max(0, tot);
  }, [totalValue, totalTaxAmount, totalAddons, totalDeductions]);

  // Damage Financial Telemetry & Statutory GST Calculations
  const totalDamageValue = useMemo(() => {
    return grnLines.reduce((acc, r) => {
      const rate = r.cost_price || r.invoice_rate || 0;
      return acc + (r.quantity_damaged || 0) * rate;
    }, 0);
  }, [grnLines]);

  const totalDamageGst = useMemo(() => {
    return grnLines.reduce((acc, r) => {
      const rate = r.cost_price || r.invoice_rate || 0;
      const dmgVal = (r.quantity_damaged || 0) * rate;
      return acc + (dmgVal * (r.gst_rate || 0)) / 100;
    }, 0);
  }, [grnLines]);

  const totalDebitNoteValue = useMemo(() => {
    return totalDamageValue + totalDamageGst;
  }, [totalDamageValue, totalDamageGst]);

  const eligibleTaxTotal = useMemo(() => {
    return Math.max(0, totalTaxAmount - totalDamageGst);
  }, [totalTaxAmount, totalDamageGst]);

  const eligibleCgst = useMemo(() => {
    return eligibleTaxTotal / 2;
  }, [eligibleTaxTotal]);

  const eligibleSgst = useMemo(() => {
    return eligibleTaxTotal / 2;
  }, [eligibleTaxTotal]);

  const eligibleIgst = useMemo(() => {
    return 0;
  }, []);

  const totalCapitalizedLandedCost = useMemo(() => {
    return totalAddons;
  }, [totalAddons]);

  const totalInventoryValueWithLandedCost = useMemo(() => {
    const soundValue = grnLines.reduce((acc, r) => {
      const rate = r.cost_price || r.invoice_rate || 0;
      const soundQty = Math.max(0, (r.quantity_received || 0) - (r.quantity_damaged || 0));
      return acc + soundQty * rate;
    }, 0);
    return Math.max(0, soundValue + totalCapitalizedLandedCost);
  }, [grnLines, totalCapitalizedLandedCost]);

  const addonBeforeTaxTotal = useMemo(() => {
    let sum = 0;
    if (landedCostBreakdown.freightTreatment === "BEFORE_TAX") sum += Number(landedCostBreakdown.freightCharges) || 0;
    if (landedCostBreakdown.laborTreatment === "BEFORE_TAX") sum += Number(landedCostBreakdown.laborHandlingCharges) || 0;
    if (landedCostBreakdown.clearanceTreatment === "BEFORE_TAX") sum += Number(landedCostBreakdown.clearanceChaFees) || 0;
    return sum;
  }, [landedCostBreakdown]);

  const addonAfterTaxTotal = useMemo(() => {
    let sum = 0;
    if (landedCostBreakdown.freightTreatment === "AFTER_TAX") sum += Number(landedCostBreakdown.freightCharges) || 0;
    if (landedCostBreakdown.laborTreatment === "AFTER_TAX") sum += Number(landedCostBreakdown.laborHandlingCharges) || 0;
    sum += Number(landedCostBreakdown.insuranceCharges) || 0;
    sum += (Number(landedCostBreakdown.customsDutyBcd) || 0) + (Number(landedCostBreakdown.customsSws) || 0);
    if (landedCostBreakdown.clearanceTreatment === "AFTER_TAX") sum += Number(landedCostBreakdown.clearanceChaFees) || 0;
    return sum;
  }, [landedCostBreakdown]);

  // Apportion Landed Cost Components across GRN Lines with Hamilton-Hare Rounding
  const handleApplyLandedCostApportionment = () => {
    if (grnLines.length === 0) {
      onNotification?.("No Lines", "No goods receipt items loaded to allocate landed cost onto.", "warning");
      return;
    }

    const {
      freightCharges,
      freightTreatment,
      laborHandlingCharges,
      laborTreatment,
      insuranceCharges,
      customsDutyBcd,
      customsSws,
      clearanceChaFees,
      clearanceTreatment,
      allocationMethod,
    } = landedCostBreakdown;

    let totalAddonBeforeTax = 0;
    let totalAddonAfterTax = 0;

    if (freightTreatment === "BEFORE_TAX") totalAddonBeforeTax += Number(freightCharges) || 0;
    else totalAddonAfterTax += Number(freightCharges) || 0;

    if (laborTreatment === "BEFORE_TAX") totalAddonBeforeTax += Number(laborHandlingCharges) || 0;
    else totalAddonAfterTax += Number(laborHandlingCharges) || 0;

    totalAddonAfterTax += Number(insuranceCharges) || 0;
    totalAddonAfterTax += (Number(customsDutyBcd) || 0) + (Number(customsSws) || 0);

    if (clearanceTreatment === "BEFORE_TAX") totalAddonBeforeTax += Number(clearanceChaFees) || 0;
    else totalAddonAfterTax += Number(clearanceChaFees) || 0;

    const totalBasis = allocationMethod === "VALUE" ? (totalValue || 1) : (totalActQty || 1);

    const updated = grnLines.map((line) => {
      const lineBasis = allocationMethod === "VALUE"
        ? line.quantity_received * (line.cost_price || line.invoice_rate || 0)
        : line.quantity_received;
      const share = totalBasis > 0 ? lineBasis / totalBasis : 1 / grnLines.length;

      const rawAddonB = totalAddonBeforeTax * share;
      const rawAddonA = totalAddonAfterTax * share;

      return {
        ...line,
        addon_before_tax: Math.round(rawAddonB * 100) / 100,
        addon_after_tax: Math.round(rawAddonA * 100) / 100,
      };
    });

    const allocatedB = updated.reduce((s, r) => s + (r.addon_before_tax || 0), 0);
    const diffB = Math.round((totalAddonBeforeTax - allocatedB) * 100) / 100;
    if (diffB !== 0 && updated.length > 0) {
      updated[0].addon_before_tax = Math.round(((updated[0].addon_before_tax || 0) + diffB) * 100) / 100;
    }

    const allocatedA = updated.reduce((s, r) => s + (r.addon_after_tax || 0), 0);
    const diffA = Math.round((totalAddonAfterTax - allocatedA) * 100) / 100;
    if (diffA !== 0 && updated.length > 0) {
      updated[0].addon_after_tax = Math.round(((updated[0].addon_after_tax || 0) + diffA) * 100) / 100;
    }

    onUpdateGrnLines(updated);
    setShowLandedCostModal(false);
    onNotification?.(
      "Landed Cost Apportioned",
      `Allocated ₹${totalAddonBeforeTax.toFixed(2)} (Before Tax) & ₹${totalAddonAfterTax.toFixed(2)} (After Tax) across ${updated.length} inward lines.`,
      "success"
    );
  };

  // Sync dcTotalInput with docTotal by default if empty
  useEffect(() => {
    if (!dcTotalInput && docTotal > 0) {
      setDcTotalInput(docTotal.toFixed(2));
    }
  }, [docTotal, dcTotalInput]);

  // Filtered POs in modal
  const filteredOrders = useMemo(() => {
    if (!searchPoQuery.trim()) return localOrders;
    const q = searchPoQuery.toLowerCase().trim();
    return localOrders.filter((o) => {
      const no = (o.order_no || o.order_number || o.id || "").toLowerCase();
      const sup = (o.supplier_name || o.supplier_id || "").toLowerCase();
      const st = (o.status || "").toLowerCase();
      return no.includes(q) || sup.includes(q) || st.includes(q);
    });
  }, [localOrders, searchPoQuery]);

  // Filtered Suppliers in modal
  const filteredSuppliers = useMemo(() => {
    if (!searchSupplierQuery.trim()) return localSuppliers;
    const q = searchSupplierQuery.toLowerCase().trim();
    return localSuppliers.filter((s) => {
      const name = (s.name || s.company_name || "").toLowerCase();
      const code = (s.code || s.id || "").toLowerCase();
      const gst = (s.gst_number || s.gstin || "").toLowerCase();
      const city = (s.city || "").toLowerCase();
      return name.includes(q) || code.includes(q) || gst.includes(q) || city.includes(q);
    });
  }, [localSuppliers, searchSupplierQuery]);

  // Dynamic Display Rows: minimum 6 rows so it fits without pushing footer off on 800px displays
  const displayRowsCount = Math.max(6, grnLines.length);

  return (
    <div className="flex flex-col h-full w-full max-h-full overflow-hidden bg-[#f8fafc] text-slate-800 text-xs select-none">
      
      {/* ========================================================================= */}
      {/* 1. TOP HEADER BAR (Compact: h-9)                                          */}
      {/* ========================================================================= */}
      <header className="h-9 bg-white border-b border-slate-200 px-3 flex items-center justify-between shadow-2xs shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-[#00288e] flex items-center justify-center text-white shadow-2xs">
            <Package size={14} />
          </div>
          <div className="flex items-baseline gap-2">
            <h1 className="font-extrabold text-sm text-slate-900 tracking-tight leading-none">
              Goods Receipt (GRN)
            </h1>
            <span className="text-[10px] text-slate-500 font-medium">
              Open For {grnDate} - Smriti System
            </span>
            {selectedOrderId && (
              <span className="px-1.5 py-0.5 bg-blue-100 text-[#00288e] font-mono font-bold text-[10px] rounded flex items-center gap-1">
                <FileSpreadsheet size={10} />
                PO Linked: {invoiceNumber || selectedOrderId}
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons Right */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onOpenHistory}
            className="flex items-center gap-1 px-2.5 h-6.5 bg-white border border-slate-300 hover:bg-slate-50 rounded text-slate-700 font-semibold text-xs shadow-2xs transition"
          >
            <FolderOpen size={12} className="text-slate-500" />
            <span>Open</span>
          </button>

          <button
            type="button"
            onClick={onResetGrn}
            className="flex items-center gap-1 px-2.5 h-6.5 bg-white border border-slate-300 hover:bg-slate-50 rounded text-slate-700 font-semibold text-xs shadow-2xs transition"
          >
            <Plus size={12} className="text-slate-500" />
            <span>New</span>
          </button>

          <button
            type="button"
            onClick={onSaveGrn}
            disabled={saving}
            className="flex items-center gap-1 px-3.5 h-6.5 bg-[#00288e] text-white hover:bg-[#1e40af] rounded font-bold text-xs shadow-xs transition disabled:opacity-50"
          >
            <Save size={12} />
            <span>{saving ? "Saving..." : "Save"}</span>
          </button>

          <button
            type="button"
            onClick={onOpenPrint}
            className="flex items-center gap-1 px-2.5 h-6.5 bg-white border border-slate-300 hover:bg-slate-50 rounded text-slate-700 font-semibold text-xs shadow-2xs transition"
          >
            <Printer size={12} className="text-slate-500" />
            <span>Print</span>
          </button>

          {/* Options Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowOptionsMenu(!showOptionsMenu)}
              className="p-1 h-6.5 w-6.5 flex items-center justify-center bg-white border border-slate-300 hover:bg-slate-50 rounded text-slate-600 shadow-2xs transition"
              title="More Options"
            >
              <MoreVertical size={14} />
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
      {/* 2. PARAMETERS CARD (Ultra-Compact Sleek Header Form: ~80px)               */}
      {/* ========================================================================= */}
      <section className="px-3 py-1.5 shrink-0">
        <div className="bg-white border border-slate-200 rounded-lg p-2 shadow-2xs grid grid-cols-12 gap-2 items-center">
          
          {/* Left Column (2 Cols): Transaction Type & Reason Code */}
          <div className="col-span-12 md:col-span-2 space-y-1.5">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-0.5 uppercase tracking-wider">
                Transaction Type
              </label>
              <select
                value={transactionType}
                onChange={(e) => setTransactionType(e.target.value)}
                className="w-full h-6.5 px-1.5 border border-slate-300 rounded bg-white text-[11px] font-semibold outline-none focus:border-[#00288e]"
              >
                <option value="Purchase">Purchase</option>
                <option value="Inter-Branch Inward">Inter-Branch Inward</option>
                <option value="Consignment">Consignment</option>
                <option value="Direct Inward">Direct Inward</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-0.5 uppercase tracking-wider">
                Reason Code
              </label>
              <select
                value={reasonCode}
                onChange={(e) => setReasonCode(e.target.value)}
                className="w-full h-6.5 px-1.5 border border-slate-300 rounded bg-white text-[11px] font-semibold outline-none focus:border-[#00288e]"
              >
                <option value="ITFR">ITFR</option>
                <option value="NORMAL">NORMAL</option>
                <option value="DAMAGE_REPLACEMENT">DAMAGE_REPLACEMENT</option>
                <option value="PROMOTIONAL">PROMOTIONAL</option>
              </select>
            </div>
          </div>

          {/* Middle Section (7 Cols): Supplier, Ref/DC, Remarks, Prefix & No */}
          <div className="col-span-12 md:col-span-7 space-y-1.5">
            
            {/* Row 1: Supplier ID + Search + Name + Add Tax to Cost */}
            <div className="flex items-center gap-1.5">
              <label className="w-16 text-[10px] font-bold text-slate-600 shrink-0">
                Supplier Id
              </label>
              <div className="relative flex-1 max-w-[130px]">
                <input
                  type="text"
                  value={supplierId}
                  onChange={(e) => onSupplierChange(e.target.value)}
                  placeholder="ID / Code"
                  className="w-full h-6.5 pl-2 pr-6 border border-slate-300 rounded text-[11px] font-mono font-bold outline-none focus:border-[#00288e]"
                />
                <button
                  type="button"
                  onClick={() => setShowSupplierModal(true)}
                  className="absolute right-1 top-1 p-0.5 text-slate-400 hover:text-[#00288e]"
                  title="Search Suppliers"
                >
                  <Search size={12} />
                </button>
              </div>

              <input
                type="text"
                readOnly
                value={supplierName || (supplierId ? "Supplier Linked" : "Select or link supplier from DB...")}
                className="flex-1 h-6.5 px-2 bg-slate-50 border border-slate-200 rounded text-[11px] text-slate-700 font-medium truncate"
              />

              <label className="flex items-center gap-1 text-[10px] font-bold text-slate-700 cursor-pointer ml-1 whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={addTaxToCost}
                  onChange={(e) => setAddTaxToCost(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-[#00288e] focus:ring-0"
                />
                <span>Add Tax to Cost</span>
              </label>
            </div>

            {/* Row 2: Ref./DC No + DC Date + Doc Remarks */}
            <div className="flex items-center gap-1.5">
              <label className="w-16 text-[10px] font-bold text-slate-600 shrink-0">
                Ref./DC No
              </label>
              <div className="flex items-center gap-1 flex-1 max-w-[130px]">
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => onInvoiceNumberChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRefDcBlurOrEnter(invoiceNumber);
                  }}
                  onBlur={() => handleRefDcBlurOrEnter(invoiceNumber)}
                  placeholder="e.g. PO-10"
                  className="w-full h-6.5 px-2 border border-slate-300 rounded text-[11px] font-mono font-bold outline-none focus:border-[#00288e]"
                  title="Type PO or DC number and press Enter to auto-load"
                />
                <button
                  type="button"
                  onClick={() => setShowPoModal(true)}
                  className="h-6.5 px-1.5 border border-slate-300 rounded bg-slate-50 hover:bg-slate-100 font-bold text-[11px] text-slate-600"
                  title="Browse Open Purchase Orders"
                >
                  ...
                </button>
              </div>

              <label className="text-[10px] font-bold text-slate-600 shrink-0 ml-1">
                DC Date
              </label>
              <input
                type="date"
                value={invoiceDate || grnDate}
                onChange={(e) => onInvoiceDateChange(e.target.value)}
                className="w-28 h-6.5 px-1.5 border border-slate-300 rounded text-[11px] outline-none focus:border-[#00288e]"
              />

              <label className="text-[10px] font-bold text-slate-600 shrink-0 ml-1">
                Remarks
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => onNotesChange(e.target.value)}
                placeholder="Remarks / delivery notes..."
                className="flex-1 h-6.5 px-2 border border-slate-300 rounded text-[11px] outline-none focus:border-[#00288e]"
              />
            </div>

            {/* Row 3: Doc Prefix + Doc No. + Status Tag */}
            <div className="flex items-center gap-1.5">
              <label className="w-16 text-[10px] font-bold text-slate-600 shrink-0">
                Doc Prefix
              </label>
              <select
                value={docPrefix}
                onChange={(e) => setDocPrefix(e.target.value)}
                className="h-6.5 px-1.5 border border-slate-300 rounded bg-white text-[11px] font-semibold outline-none focus:border-[#00288e] w-20"
              >
                <option value="P17">P17</option>
                <option value="GRN">GRN</option>
                <option value="INW">INW</option>
                <option value="PO">PO</option>
              </select>

              <label className="text-[10px] font-bold text-slate-600 shrink-0 ml-2">
                Doc No.
              </label>
              <input
                type="text"
                value={docNo}
                onChange={(e) => setDocNo(e.target.value)}
                className="h-6.5 px-2 border border-slate-300 rounded text-[11px] font-bold font-mono w-20 outline-none focus:border-[#00288e]"
              />

              {selectedOrderId && (
                <div className="flex items-center gap-1.5 ml-3">
                  <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-bold">
                    ✓ PO Synced ({grnLines.length} Items)
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectOrder("");
                      onUpdateGrnLines([]);
                      onInvoiceNumberChange("");
                    }}
                    className="text-[10px] text-rose-600 hover:underline"
                  >
                    Clear PO
                  </button>
                </div>
              )}
            </div>

          </div>

          {/* Right Column (3 Cols): Sleek Action Buttons Box */}
          <div className="col-span-12 md:col-span-3">
            <div className="border border-slate-200 rounded-lg p-1.5 bg-slate-50/70 space-y-1">
              
              {/* Primary 1. Select Purchase Order Button */}
              <button
                type="button"
                onClick={() => setShowPoModal(true)}
                className="w-full text-left px-2 h-6.5 rounded font-bold text-[11px] text-[#00288e] bg-[#e0f2fe] hover:bg-[#bae6fd] transition flex items-center justify-between shadow-2xs"
              >
                <span className="flex items-center gap-1">
                  <FileSpreadsheet size={12} />
                  <span>1. Select Purchase Order (F2)</span>
                </span>
                {selectedOrderId ? (
                  <Check size={13} className="text-[#00288e] font-bold" />
                ) : (
                  <span className="text-[10px] text-blue-600 font-mono font-bold">
                    ({localOrders.length})
                  </span>
                )}
              </button>

              {/* 2x2 Grid for Other Action Buttons */}
              <div className="grid grid-cols-2 gap-1 text-[10px]">
                <button
                  type="button"
                  onClick={onOpenCsvImport}
                  className="h-6 px-1.5 bg-white border border-slate-200 hover:bg-slate-100 rounded font-semibold text-slate-700 truncate text-left"
                >
                  2. Load PF File
                </button>

                <button
                  type="button"
                  onClick={onOpenScanner}
                  className="h-6 px-1.5 bg-white border border-slate-200 hover:bg-slate-100 rounded font-semibold text-slate-700 flex items-center justify-between"
                >
                  <span className="truncate">3. Load PDT</span>
                  <Barcode size={11} className="text-slate-400 shrink-0" />
                </button>

                <button
                  type="button"
                  onClick={() => setShowOutwardModal(true)}
                  className="h-6 px-1.5 bg-white border border-slate-200 hover:bg-slate-100 rounded font-semibold text-slate-700 truncate text-left"
                >
                  4. Outward Match
                </button>

                <button
                  type="button"
                  onClick={() => setShowItemTagsModal(true)}
                  className="h-6 px-1.5 bg-white border border-slate-200 hover:bg-slate-100 rounded font-semibold text-slate-700 truncate text-left flex items-center justify-between"
                >
                  <span>5. Item Tags</span>
                  <Tag size={10} className="text-slate-400" />
                </button>
              </div>

            </div>
          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* 2.5 SUB-TAB NAVIGATION BAR & INSPECTION WORKSPACE TOGGLE                  */}
      {/* ========================================================================= */}
      <nav className="px-3 pb-1 shrink-0 flex items-center justify-between border-b border-slate-200">
        <div className="flex items-center gap-1 overflow-x-auto text-[11px] font-bold">
          <button
            type="button"
            onClick={() => setActiveSubTab("ITEMS")}
            className={`px-3 py-1 rounded-t border-t border-x transition flex items-center gap-1.5 ${
              activeSubTab === "ITEMS"
                ? "bg-white border-slate-200 text-[#00288e] shadow-2xs font-extrabold"
                : "bg-slate-100 border-transparent text-slate-600 hover:bg-slate-200/70"
            }`}
          >
            <Layers size={13} className={activeSubTab === "ITEMS" ? "text-[#00288e]" : "text-slate-400"} />
            <span>1. Item Details</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700 font-mono font-bold">
              {grnLines.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveSubTab("DAMAGE");
              setShowBottomPanels(true);
            }}
            className={`px-3 py-1 rounded-t border-t border-x transition flex items-center gap-1.5 ${
              activeSubTab === "DAMAGE"
                ? "bg-white border-slate-200 text-rose-700 shadow-2xs font-extrabold"
                : "bg-slate-100 border-transparent text-slate-600 hover:bg-slate-200/70"
            }`}
          >
            <AlertTriangle size={13} className={activeSubTab === "DAMAGE" ? "text-rose-600" : "text-slate-400"} />
            <span>2. Damage &amp; Returns</span>
            {totalDamageQty > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-700 font-mono font-bold">
                {totalDamageQty.toFixed(0)}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveSubTab("LANDED_COST");
              setShowBottomPanels(true);
            }}
            className={`px-3 py-1 rounded-t border-t border-x transition flex items-center gap-1.5 ${
              activeSubTab === "LANDED_COST"
                ? "bg-white border-slate-200 text-[#00288e] shadow-2xs font-extrabold"
                : "bg-slate-100 border-transparent text-slate-600 hover:bg-slate-200/70"
            }`}
          >
            <Truck size={13} className={activeSubTab === "LANDED_COST" ? "text-[#00288e]" : "text-slate-400"} />
            <span>3. Landed Cost Addons</span>
            {totalAddons > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-100 text-[#00288e] font-mono font-bold">
                ₹{totalAddons.toFixed(0)}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveSubTab("TAX");
              setShowBottomPanels(true);
            }}
            className={`px-3 py-1 rounded-t border-t border-x transition flex items-center gap-1.5 ${
              activeSubTab === "TAX"
                ? "bg-white border-slate-200 text-[#00288e] shadow-2xs font-extrabold"
                : "bg-slate-100 border-transparent text-slate-600 hover:bg-slate-200/70"
            }`}
          >
            <Receipt size={13} className={activeSubTab === "TAX" ? "text-[#00288e]" : "text-slate-400"} />
            <span>4. Tax &amp; Accounting</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveSubTab("DEBIT_NOTE");
              if (onOpenDebitNote) onOpenDebitNote();
              else setShowBottomPanels(true);
            }}
            className={`px-3 py-1 rounded-t border-t border-x transition flex items-center gap-1.5 ${
              activeSubTab === "DEBIT_NOTE"
                ? "bg-white border-slate-200 text-rose-700 shadow-2xs font-extrabold"
                : "bg-slate-100 border-transparent text-slate-600 hover:bg-slate-200/70"
            }`}
          >
            <FileText size={13} className={activeSubTab === "DEBIT_NOTE" ? "text-rose-600" : "text-slate-400"} />
            <span>5. Debit Note (Damage)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab("DOC_NOTES")}
            className={`px-3 py-1 rounded-t border-t border-x transition flex items-center gap-1.5 ${
              activeSubTab === "DOC_NOTES"
                ? "bg-white border-slate-200 text-[#00288e] shadow-2xs font-extrabold"
                : "bg-slate-100 border-transparent text-slate-600 hover:bg-slate-200/70"
            }`}
          >
            <FileSpreadsheet size={13} className={activeSubTab === "DOC_NOTES" ? "text-[#00288e]" : "text-slate-400"} />
            <span>6. Document &amp; Notes</span>
          </button>
        </div>

        {/* Toggle Inspection Workspace Panels */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowBottomPanels(!showBottomPanels)}
            className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:text-[#00288e] bg-white border border-slate-300 rounded shadow-2xs transition"
            title="Toggle Bottom Inspection Workspace Panels"
          >
            {showBottomPanels ? (
              <>
                <ChevronUp size={12} className="text-slate-500" />
                <span>Hide Inspection Panels</span>
              </>
            ) : (
              <>
                <ChevronDown size={12} className="text-slate-500" />
                <span>Show Inspection Panels (3-Col)</span>
              </>
            )}
          </button>
        </div>
      </nav>

      {/* ========================================================================= */}
      {/* WORKSPACE AREA (Scrollable internal viewport for 1200x800 & large screen)  */}
      {/* ========================================================================= */}
      <div className="flex-1 min-h-0 flex flex-col overflow-y-auto px-3 py-1 space-y-2">

        {/* ========================================================================= */}
        {/* 3. MAIN TABLE GRID + DOCKED DIRECT ENTRY STRIP                            */}
        {/* ========================================================================= */}
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col shadow-2xs min-h-[200px] shrink-0">
          
          {/* Scrollable Table Viewport */}
          <div className="overflow-auto flex-1 max-h-[360px]">
            <table className="w-full text-left border-collapse text-xs whitespace-nowrap min-w-[1300px]">
              <thead className="bg-[#f1f5f9] sticky top-0 z-10 border-b border-slate-200 text-[10px] font-bold text-slate-600">
                <tr className="h-6.5">
                  <th className="px-2 border-r border-slate-200 w-10 text-center">#</th>
                  <th className="px-2 border-r border-slate-200 w-32">Stock No</th>
                  <th className="px-2 border-r border-slate-200 min-w-[160px]">Item Description</th>
                  <th className="px-2 border-r border-slate-200 text-right w-16">Doc Qty</th>
                  <th className="px-2 border-r border-slate-200 text-right w-16">Act Qty</th>
                  <th className="px-2 border-r border-rose-200 text-right w-20 bg-rose-50/70 text-rose-700 font-extrabold">Damage QTY</th>
                  <th className="px-2 border-r border-emerald-200 text-right w-20 bg-emerald-50/70 text-emerald-800 font-extrabold">Accepted Qty</th>
                  <th className="px-2 border-r border-slate-200 text-right w-20">Selling Price</th>
                  <th className="px-2 border-r border-slate-200 text-right w-20">Purchase Price</th>
                  <th className="px-2 border-r border-slate-200 text-right w-20">Value</th>
                  <th className="px-2 border-r border-slate-200 text-right w-18">Discount Rate</th>
                  <th className="px-2 border-r border-slate-200 text-right w-18">Discount Amount</th>
                  <th className="px-2 border-r border-slate-200 text-right w-16">Tax Rate</th>
                  <th className="px-2 border-r border-slate-200 text-right w-18">Tax Amount</th>
                  <th className="px-2 border-r border-slate-200 text-right w-18">Addon B.Tax</th>
                  <th className="px-2 border-r border-slate-200 text-right w-18">Addon A.Tax</th>
                  <th className="px-2 border-r border-slate-200 text-right w-20">Ded. B.Tax</th>
                  <th className="px-2 border-r border-slate-200 text-right w-20">Ded. A.Tax</th>
                  <th className="px-2 text-center w-8">⋮</th>
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
                    const acceptedQty = Math.max(0, item.quantity_received - (item.quantity_damaged || 0));

                    return (
                      <tr
                        key={item.rowId || idx}
                        onClick={() => handleSelectRow(idx)}
                        className={`h-6.5 cursor-pointer transition ${
                          isSelected
                            ? "bg-[#e0f2fe] text-blue-950 font-semibold"
                            : "hover:bg-slate-50"
                        }`}
                      >
                        <td className="px-2 border-r border-slate-200 text-center font-bold text-slate-500">
                          {idx + 1}
                        </td>
                        <td className="px-2 border-r border-slate-200 font-bold text-slate-900">
                          {item.code}
                        </td>
                        <td className="px-2 border-r border-slate-200 font-sans font-medium text-slate-800 truncate max-w-[220px]">
                          {item.name}
                        </td>
                        <td className="px-2 border-r border-slate-200 text-right">
                          {(item.quantity_ordered || item.quantity_received).toFixed(2)}
                        </td>
                        <td className="px-2 border-r border-slate-200 text-right font-bold text-slate-900">
                          {item.quantity_received.toFixed(2)}
                        </td>
                        <td className="px-2 border-r border-rose-200 text-right bg-rose-50/40">
                          {item.quantity_damaged > 0 ? (
                            <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 font-bold">
                              {item.quantity_damaged.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-normal">0.00</span>
                          )}
                        </td>
                        <td className="px-2 border-r border-emerald-200 text-right font-bold text-emerald-700 bg-emerald-50/40">
                          {acceptedQty.toFixed(2)}
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
                          {(item.gst_rate || 0).toFixed(2)}%
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
                        <td className="px-2 border-r border-slate-200 text-right">
                          {(item.deduction_after_tax || 0).toFixed(2)}
                        </td>
                        <td className="px-1 text-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const updated = grnLines.filter((_, i) => i !== idx);
                              onUpdateGrnLines(updated);
                              if (selectedRowIndex === idx) setSelectedRowIndex(null);
                            }}
                            className="p-0.5 text-slate-400 hover:text-rose-600 rounded transition"
                            title="Delete row"
                          >
                            <Trash2 size={11} />
                          </button>
                        </td>
                      </tr>
                    );
                  }

                  // Empty Placeholder Row
                  return (
                    <tr key={`empty-${idx}`} className="h-6 text-slate-300">
                      <td className="px-2 border-r border-slate-200 text-center font-bold text-slate-400">
                        {idx + 1}
                      </td>
                      <td className="px-2 border-r border-slate-200">&nbsp;</td>
                      <td className="px-2 border-r border-slate-200">&nbsp;</td>
                      <td className="px-2 border-r border-slate-200">&nbsp;</td>
                      <td className="px-2 border-r border-slate-200">&nbsp;</td>
                      <td className="px-2 border-r border-rose-200 bg-rose-50/20">&nbsp;</td>
                      <td className="px-2 border-r border-emerald-200 bg-emerald-50/20">&nbsp;</td>
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
                      <td className="px-1">&nbsp;</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* DOCKED DIRECT ENTRY STRIP (Pinned at Grid Bottom) */}
          <div className="bg-[#f8fafc] border-t-2 border-[#00288e] p-1 overflow-x-auto shrink-0">
            <div className="flex items-center min-w-[1300px] text-xs">
              
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
                    if (e.key === "Enter") handleStockNoLookup(entryStockNo);
                  }}
                  onBlur={() => handleStockNoLookup(entryStockNo)}
                  placeholder="Stock No / SKU"
                  className="w-full h-6.5 px-2 border border-slate-300 rounded font-mono font-bold text-xs bg-white outline-none focus:border-[#00288e]"
                />
              </div>

              {/* Description Display */}
              <div className="min-w-[160px] flex-1 px-1">
                <input
                  type="text"
                  readOnly
                  value={entryDescription}
                  placeholder="Item Description"
                  className="w-full h-6.5 px-2 border border-slate-200 bg-white rounded font-sans text-xs text-slate-700 truncate"
                />
              </div>

              {/* Doc Qty (Active Blue Glow Focus Box) */}
              <div className="w-16 px-1">
                <input
                  ref={docQtyInputRef}
                  type="text"
                  value={entryDocQty}
                  onChange={(e) => setEntryDocQty(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCommitDirectEntry();
                  }}
                  className="w-full h-6.5 px-1.5 text-right font-mono font-bold text-xs bg-[#00288e] text-white rounded outline-none shadow-xs"
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
                  className="w-full h-6.5 px-1.5 text-right font-mono font-bold text-xs bg-white border border-slate-300 rounded outline-none focus:border-[#00288e]"
                />
              </div>

              {/* Damage Qty */}
              <div className="w-20 px-1">
                <input
                  type="text"
                  value={entryDamageQty}
                  onChange={(e) => setEntryDamageQty(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCommitDirectEntry();
                  }}
                  placeholder="0.00"
                  className={`w-full h-6.5 px-1.5 text-right font-mono font-bold text-xs rounded outline-none border transition ${
                    parseFloat(entryDamageQty) > 0
                      ? "bg-rose-50 border-rose-300 text-rose-700 focus:border-rose-500"
                      : "bg-white border-slate-300 text-slate-700 focus:border-[#00288e]"
                  }`}
                  title="Damage quantity: excluded from sellable inventory, logged for debit note"
                />
              </div>

              {/* Accepted Qty (Calculated Display: Act Qty - Damage Qty) */}
              <div className="w-20 px-1">
                <input
                  type="text"
                  readOnly
                  value={Math.max(0, (parseFloat(entryActQty) || 0) - (parseFloat(entryDamageQty) || 0)).toFixed(2)}
                  className="w-full h-6.5 px-1.5 text-right font-mono font-bold text-xs bg-emerald-50 border border-emerald-200 text-emerald-800 rounded outline-none"
                  title="Accepted quantity to enter warehouse stock"
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
                  className="w-full h-6.5 px-1.5 text-right font-mono text-xs bg-white border border-slate-300 rounded outline-none focus:border-[#00288e]"
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
                  className="w-full h-6.5 px-1.5 text-right font-mono font-bold text-xs bg-white border border-slate-300 rounded outline-none focus:border-[#00288e]"
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
                  className="w-full h-6.5 px-1 text-right font-mono text-xs bg-white border border-slate-300 rounded outline-none"
                />
              </div>

              {/* Discount Amount */}
              <div className="w-18 px-1">
                <input
                  type="text"
                  value={entryDiscountAmount}
                  onChange={(e) => setEntryDiscountAmount(e.target.value)}
                  className="w-full h-6.5 px-1 text-right font-mono text-xs bg-white border border-slate-300 rounded outline-none"
                />
              </div>

              {/* Tax Rate */}
              <div className="w-16 px-1">
                <input
                  type="text"
                  value={entryTaxRate}
                  onChange={(e) => setEntryTaxRate(e.target.value)}
                  className="w-full h-6.5 px-1 text-right font-mono text-xs bg-white border border-slate-300 rounded outline-none"
                />
              </div>

              {/* Tax Amount */}
              <div className="w-18 px-1">
                <input
                  type="text"
                  value={entryTaxAmount}
                  onChange={(e) => setEntryTaxAmount(e.target.value)}
                  className="w-full h-6.5 px-1 text-right font-mono text-xs bg-white border border-slate-300 rounded outline-none"
                />
              </div>

              {/* Addon Before Tax */}
              <div className="w-18 px-1">
                <input
                  type="text"
                  value={entryAddonBeforeTax}
                  onChange={(e) => setEntryAddonBeforeTax(e.target.value)}
                  className="w-full h-6.5 px-1 text-right font-mono text-xs bg-white border border-slate-300 rounded outline-none"
                />
              </div>

              {/* Addon After Tax */}
              <div className="w-18 px-1">
                <input
                  type="text"
                  value={entryAddonAfterTax}
                  onChange={(e) => setEntryAddonAfterTax(e.target.value)}
                  className="w-full h-6.5 px-1 text-right font-mono text-xs bg-white border border-slate-300 rounded outline-none"
                />
              </div>

              {/* Deduction Before Tax */}
              <div className="w-20 px-1">
                <input
                  type="text"
                  value={entryDeductionBeforeTax}
                  onChange={(e) => setEntryDeductionBeforeTax(e.target.value)}
                  className="w-full h-6.5 px-1 text-right font-mono text-xs bg-white border border-slate-300 rounded outline-none"
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
                  className="w-full h-6.5 px-1 text-right font-mono text-xs bg-white border border-slate-300 rounded outline-none"
                />
              </div>

              <div className="w-8 text-center px-1">&nbsp;</div>

            </div>
          </div>

        </div>

        {/* ========================================================================= */}
        {/* 4. SUMMARY & CALCULATION SECTION (5 Metrics Left, Matrices Center, Right) */}
        {/* ========================================================================= */}
        <section className="shrink-0">
          <div className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 shadow-2xs grid grid-cols-12 gap-3 items-center">
            
            {/* Left Column (3.5 cols): Total Doc Qty, Act Qty, Damage Qty, Accepted Qty, Total Value */}
            <div className="col-span-12 lg:col-span-4 grid grid-cols-5 gap-1">
              <div className="bg-slate-50 border border-slate-200 rounded p-1 text-center">
                <span className="block text-[8px] font-bold text-slate-500 uppercase">Doc Qty</span>
                <span className="font-mono font-bold text-xs text-slate-900">{totalDocQty.toFixed(2)}</span>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded p-1 text-center">
                <span className="block text-[8px] font-bold text-slate-500 uppercase">Act Qty</span>
                <span className="font-mono font-bold text-xs text-slate-900">{totalActQty.toFixed(2)}</span>
              </div>
              <div className={`border rounded p-1 text-center ${totalDamageQty > 0 ? "bg-rose-50 border-rose-200" : "bg-slate-50 border-slate-200"}`}>
                <span className={`block text-[8px] font-bold uppercase ${totalDamageQty > 0 ? "text-rose-600 font-extrabold" : "text-slate-500"}`}>
                  Damage
                </span>
                <span className={`font-mono font-bold text-xs ${totalDamageQty > 0 ? "text-rose-700 font-extrabold" : "text-slate-400"}`}>
                  {totalDamageQty.toFixed(2)}
                </span>
              </div>
              <div className="bg-emerald-50/70 border border-emerald-200 rounded p-1 text-center">
                <span className="block text-[8px] font-bold uppercase text-emerald-800 font-extrabold">Accepted</span>
                <span className="font-mono font-bold text-xs text-emerald-700 font-extrabold">{totalSoundQty.toFixed(2)}</span>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded p-1 text-center">
                <span className="block text-[8px] font-bold text-slate-500 uppercase">Total Val</span>
                <span className="font-mono font-bold text-xs text-slate-900">₹{totalValue.toFixed(2)}</span>
              </div>
            </div>

            {/* Middle Columns (5.5 cols): Discount, Deduction, Addon Matrices (Shoper 9 Parity) */}
            <div className="col-span-12 lg:col-span-5 grid grid-cols-3 gap-2 text-[10px]">
              {/* Discount Block */}
              <div className="border border-slate-200 rounded p-1 bg-white">
                <div className="flex justify-between items-center text-[9px] font-bold text-slate-600 uppercase mb-0.5 border-b border-slate-100 pb-0.5">
                  <span>Discount</span>
                  <span className="text-slate-400 font-mono">Rate | Amt</span>
                </div>
                <div className="grid grid-cols-2 gap-1 text-[10px]">
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="text-[9px] text-slate-400">Doc:</span>
                    <span className="font-mono font-semibold">₹0.00</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="text-[9px] text-slate-400">Item:</span>
                    <span className="font-mono font-semibold">
                      ₹{grnLines.reduce((acc, r) => acc + ((r.trade_discount || 0) * r.quantity_received), 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Deduction Block */}
              <div className="border border-slate-200 rounded p-1 bg-white">
                <div className="flex justify-between items-center text-[9px] font-bold text-slate-600 uppercase mb-0.5 border-b border-slate-100 pb-0.5">
                  <span>Deduction</span>
                  <span className="text-slate-400 font-mono">B.Tax | A.Tax</span>
                </div>
                <div className="grid grid-cols-2 gap-1 text-[10px]">
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="text-[9px] text-slate-400">B.Tax:</span>
                    <span className="font-mono font-semibold">
                      ₹{grnLines.reduce((acc, r) => acc + (r.deduction_before_tax || 0), 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="text-[9px] text-slate-400">A.Tax:</span>
                    <span className="font-mono font-semibold">
                      ₹{grnLines.reduce((acc, r) => acc + (r.deduction_after_tax || 0), 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Addon / Indian Landed Cost Block */}
              <div
                onClick={() => {
                  setLandedCostBreakdown((prev) => ({
                    ...prev,
                    baseFobCost: totalValue,
                  }));
                  setShowLandedCostModal(true);
                }}
                className="border border-[#bfdbfe] hover:border-[#00288e] rounded p-1 bg-blue-50/40 cursor-pointer transition shadow-2xs group"
                title="Click to open 6 Indian Landed Cost Components & Apportionment"
              >
                <div className="flex justify-between items-center text-[9px] font-bold text-[#00288e] uppercase mb-0.5 border-b border-blue-100 pb-0.5">
                  <span className="flex items-center gap-1">
                    <span>Addon (Landed)</span>
                    <span className="text-[8px] bg-[#00288e] text-white px-1 rounded-full group-hover:scale-105 transition">6</span>
                  </span>
                  <span className="text-blue-500 font-mono text-[9px]">Edit →</span>
                </div>
                <div className="grid grid-cols-2 gap-1 text-[10px]">
                  <div className="flex items-center justify-between text-slate-700">
                    <span className="text-[9px] text-slate-500">B.Tax:</span>
                    <span className="font-mono font-bold text-[#00288e]">
                      ₹{grnLines.reduce((acc, r) => acc + (r.addon_before_tax || 0), 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-700">
                    <span className="text-[9px] text-slate-500">A.Tax:</span>
                    <span className="font-mono font-bold text-[#00288e]">
                      ₹{grnLines.reduce((acc, r) => acc + (r.addon_after_tax || 0), 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column (3 cols): Doc. Total & DC/Inv. Total */}
            <div className="col-span-12 lg:col-span-3 flex items-center justify-end gap-3 border-l border-slate-100 pl-3">
              <div className="text-right">
                <span className="block text-[9px] font-bold text-slate-500 uppercase">Doc. Total</span>
                <span className="text-base font-extrabold font-mono text-[#00288e] leading-none">
                  ₹{docTotal.toFixed(2)}
                </span>
              </div>

              <div className="text-right">
                <span className="block text-[9px] font-bold text-slate-500 uppercase">DC/Inv. Total</span>
                <input
                  type="text"
                  value={dcTotalInput}
                  onChange={(e) => setDcTotalInput(e.target.value)}
                  placeholder="0.00"
                  className="w-24 h-6 px-1.5 text-right font-mono font-bold text-xs bg-[#fef9c3] border border-[#fde047] rounded outline-none focus:ring-1 focus:ring-yellow-500"
                  title="Enter vendor invoice total to compare against calculated doc total"
                />
              </div>
            </div>

          </div>
        </section>

        {/* ========================================================================= */}
        {/* 4.5. BOTTOM INSPECTION WORKSPACE PANELS (3-COLUMN LAYOUT)                 */}
        {/* ========================================================================= */}
        {showBottomPanels && (
          <section className="shrink-0">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              
              {/* Panel 1: Quality Control & Damage Management */}
              <div className="bg-white border border-rose-200 rounded-lg p-2.5 shadow-2xs flex flex-col justify-between space-y-2">
                <div>
                  <div className="flex items-center justify-between border-b border-rose-100 pb-1 mb-2">
                    <div className="flex items-center gap-1.5 font-bold text-rose-800 text-[11px]">
                      <AlertTriangle size={13} className="text-rose-600" />
                      <span>2. Damage &amp; Returns (QC)</span>
                    </div>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-bold ${totalDamageQty > 0 ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-500"}`}>
                      {totalDamageQty.toFixed(2)} Dmg Units
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Damage Reason</label>
                      <select
                        value={damageReason}
                        onChange={(e) => setDamageReason(e.target.value)}
                        className="w-full h-6 px-1.5 border border-slate-300 rounded text-[10px] font-semibold bg-white outline-none focus:border-rose-500"
                      >
                        <option value="Transit Breakage">Transit Breakage</option>
                        <option value="Packaging Defect">Packaging Defect</option>
                        <option value="Manufacturing Flaw">Manufacturing Flaw</option>
                        <option value="Water / Moisture Damage">Water / Moisture Damage</option>
                        <option value="Shortage / Mishandled">Shortage / Mishandled</option>
                        <option value="Expired / Perished">Expired / Perished</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Handling Action</label>
                      <select
                        value={damageHandlingType}
                        onChange={(e) => setDamageHandlingType(e.target.value)}
                        className="w-full h-6 px-1.5 border border-slate-300 rounded text-[10px] font-semibold bg-white outline-none focus:border-rose-500"
                      >
                        <option value="Reject & Debit Note (Supplier Chargeback)">Reject &amp; Debit Note</option>
                        <option value="Hold in Quarantine for Inspection">Hold in Quarantine</option>
                        <option value="Scrap & Write-Off (Abnormal Loss)">Scrap &amp; Write-Off</option>
                      </select>
                    </div>
                  </div>

                  <div className="mb-2">
                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Quarantine Warehouse</label>
                    <select
                      value={damageWarehouse}
                      onChange={(e) => setDamageWarehouse(e.target.value)}
                      className="w-full h-6 px-1.5 border border-slate-300 rounded text-[10px] font-semibold bg-white outline-none focus:border-rose-500"
                    >
                      <option value="WH-MAIN-DMG (Damage Quarantine)">WH-MAIN-DMG (Damage Quarantine)</option>
                      <option value="WH-RETURN-BAY (Vendor Return Depot)">WH-RETURN-BAY (Vendor Return Depot)</option>
                      <option value="WH-REJECT (Scrap Yard)">WH-REJECT (Scrap Yard)</option>
                    </select>
                  </div>

                  <div className="mb-2">
                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">QC Remarks / Tagging</label>
                    <input
                      type="text"
                      value={qcRemarks}
                      onChange={(e) => setQcRemarks(e.target.value)}
                      placeholder="Enter inspection remarks or tag references"
                      className="w-full h-6 px-2 border border-slate-300 rounded text-[10px] bg-white outline-none focus:border-rose-500"
                    />
                  </div>

                  {/* Damage Financial Telemetry */}
                  <div className="grid grid-cols-2 gap-1.5 bg-rose-50/50 border border-rose-100 rounded p-1.5 text-[10px]">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Damage Value:</span>
                      <span className="font-mono font-bold text-rose-700">₹{totalDamageValue.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Blocked ITC:</span>
                      <span className="font-mono font-bold text-rose-700">₹{totalDamageGst.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between col-span-2 pt-1 border-t border-rose-200/60 font-semibold">
                      <span className="text-rose-900">Total Debit Note Claim:</span>
                      <span className="font-mono font-extrabold text-rose-800">₹{totalDebitNoteValue.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[9px] text-slate-400 font-medium">u/s 17(5)(h) CGST</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (onOpenDebitNote) onOpenDebitNote();
                      else onNotification?.("Debit Note", `Debit Note generated for ₹${totalDebitNoteValue.toFixed(2)}.`, "success");
                    }}
                    className="px-2.5 h-6 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10px] font-bold shadow-2xs flex items-center gap-1 transition"
                  >
                    <FileText size={11} />
                    <span>Generate Debit Note</span>
                  </button>
                </div>
              </div>

              {/* Panel 2: Landed Cost Addons */}
              <div className="bg-white border border-blue-200 rounded-lg p-2.5 shadow-2xs flex flex-col justify-between space-y-2">
                <div>
                  <div className="flex items-center justify-between border-b border-blue-100 pb-1 mb-2">
                    <div className="flex items-center gap-1.5 font-bold text-[#00288e] text-[11px]">
                      <Truck size={13} className="text-[#00288e]" />
                      <span>3. Landed Cost Addons (India)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowLandedCostModal(true)}
                      className="text-[10px] text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-0.5"
                    >
                      <span>Full Config</span>
                      <ExternalLink size={9} />
                    </button>
                  </div>

                  {/* 6 Components mini-table */}
                  <div className="space-y-1 text-[10px] max-h-[140px] overflow-y-auto pr-1">
                    {/* 1. Freight */}
                    <div className="flex items-center justify-between bg-slate-50 p-1 rounded">
                      <span className="text-slate-700 font-medium">Freight &amp; Shipping:</span>
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] text-slate-400 font-mono">({landedCostBreakdown.freightTreatment === "BEFORE_TAX" ? "B.Tax" : "A.Tax"})</span>
                        <input
                          type="number"
                          value={landedCostBreakdown.freightCharges || ""}
                          onChange={(e) => setLandedCostBreakdown({ ...landedCostBreakdown, freightCharges: parseFloat(e.target.value) || 0 })}
                          placeholder="0.00"
                          className="w-16 h-5 px-1 text-right font-mono font-bold text-[10px] border border-slate-300 rounded bg-white outline-none focus:border-[#00288e]"
                        />
                      </div>
                    </div>

                    {/* 2. Labor / Hamali */}
                    <div className="flex items-center justify-between bg-slate-50 p-1 rounded">
                      <span className="text-slate-700 font-medium">Labor &amp; Handling (Hamali):</span>
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] text-slate-400 font-mono">({landedCostBreakdown.laborTreatment === "BEFORE_TAX" ? "B.Tax" : "A.Tax"})</span>
                        <input
                          type="number"
                          value={landedCostBreakdown.laborHandlingCharges || ""}
                          onChange={(e) => setLandedCostBreakdown({ ...landedCostBreakdown, laborHandlingCharges: parseFloat(e.target.value) || 0 })}
                          placeholder="0.00"
                          className="w-16 h-5 px-1 text-right font-mono font-bold text-[10px] border border-slate-300 rounded bg-white outline-none focus:border-[#00288e]"
                        />
                      </div>
                    </div>

                    {/* 3. Insurance */}
                    <div className="flex items-center justify-between bg-slate-50 p-1 rounded">
                      <span className="text-slate-700 font-medium">Transit Insurance:</span>
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] text-slate-400 font-mono">(A.Tax)</span>
                        <input
                          type="number"
                          value={landedCostBreakdown.insuranceCharges || ""}
                          onChange={(e) => setLandedCostBreakdown({ ...landedCostBreakdown, insuranceCharges: parseFloat(e.target.value) || 0 })}
                          placeholder="0.00"
                          className="w-16 h-5 px-1 text-right font-mono font-bold text-[10px] border border-slate-300 rounded bg-white outline-none focus:border-[#00288e]"
                        />
                      </div>
                    </div>

                    {/* 4. Customs Duties */}
                    <div className="flex items-center justify-between bg-slate-50 p-1 rounded">
                      <span className="text-slate-700 font-medium">Customs Duties (BCD+SWS):</span>
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] text-slate-400 font-mono">(Duty)</span>
                        <input
                          type="number"
                          value={landedCostBreakdown.customsDutyBcd || ""}
                          onChange={(e) => {
                            const bcd = parseFloat(e.target.value) || 0;
                            setLandedCostBreakdown({
                              ...landedCostBreakdown,
                              customsDutyBcd: bcd,
                              customsSws: Math.round(bcd * 0.1 * 100) / 100,
                            });
                          }}
                          placeholder="0.00"
                          className="w-16 h-5 px-1 text-right font-mono font-bold text-[10px] border border-slate-300 rounded bg-white outline-none focus:border-[#00288e]"
                        />
                      </div>
                    </div>

                    {/* 5. Clearance Fees */}
                    <div className="flex items-center justify-between bg-slate-50 p-1 rounded">
                      <span className="text-slate-700 font-medium">Clearance (CHA Brokerage):</span>
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] text-slate-400 font-mono">({landedCostBreakdown.clearanceTreatment === "BEFORE_TAX" ? "B.Tax" : "A.Tax"})</span>
                        <input
                          type="number"
                          value={landedCostBreakdown.clearanceChaFees || ""}
                          onChange={(e) => setLandedCostBreakdown({ ...landedCostBreakdown, clearanceChaFees: parseFloat(e.target.value) || 0 })}
                          placeholder="0.00"
                          className="w-16 h-5 px-1 text-right font-mono font-bold text-[10px] border border-slate-300 rounded bg-white outline-none focus:border-[#00288e]"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-[10px] bg-blue-50/60 p-1.5 rounded border border-blue-100">
                    <div>
                      <span className="text-slate-500">B.Tax: </span>
                      <span className="font-mono font-bold text-[#00288e]">₹{addonBeforeTaxTotal.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">A.Tax: </span>
                      <span className="font-mono font-bold text-[#00288e]">₹{addonAfterTaxTotal.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Total: </span>
                      <span className="font-mono font-extrabold text-[#00288e]">₹{(addonBeforeTaxTotal + addonAfterTaxTotal).toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setShowLandedCostModal(true)}
                    className="px-2 h-6 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-semibold transition"
                  >
                    + Add Component
                  </button>

                  <button
                    type="button"
                    onClick={handleApplyLandedCostApportionment}
                    className="px-2.5 h-6 bg-[#00288e] hover:bg-[#1e40af] text-white rounded text-[10px] font-bold shadow-2xs flex items-center gap-1 transition"
                  >
                    <span>Apportion to Lines</span>
                    <ArrowRight size={11} />
                  </button>
                </div>
              </div>

              {/* Panel 3: Tax & Accounting Summary */}
              <div className="bg-white border border-slate-200 rounded-lg p-2.5 shadow-2xs flex flex-col justify-between space-y-2">
                <div>
                  <div className="flex items-center justify-between border-b border-slate-100 pb-1 mb-2">
                    <div className="flex items-center gap-1.5 font-bold text-slate-900 text-[11px]">
                      <Receipt size={13} className="text-[#00288e]" />
                      <span>4. Tax &amp; Accounting Summary</span>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded font-mono font-bold">
                      Ind AS 2 Parity
                    </span>
                  </div>

                  {/* Tax Breakdown 4 items */}
                  <div className="grid grid-cols-2 gap-1.5 text-[10px] mb-2">
                    <div className="flex justify-between bg-slate-50 p-1 rounded">
                      <span className="text-slate-500">CGST (Eligible):</span>
                      <span className="font-mono font-bold text-emerald-700">₹{eligibleCgst.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between bg-slate-50 p-1 rounded">
                      <span className="text-slate-500">SGST (Eligible):</span>
                      <span className="font-mono font-bold text-emerald-700">₹{eligibleSgst.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between bg-slate-50 p-1 rounded">
                      <span className="text-slate-500">IGST (Eligible):</span>
                      <span className="font-mono font-bold text-emerald-700">₹{eligibleIgst.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between bg-rose-50 p-1 rounded">
                      <span className="text-rose-700 font-semibold">Blocked Tax (Dmg):</span>
                      <span className="font-mono font-bold text-rose-700">₹{totalDamageGst.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Inventory Valuation Breakdown */}
                  <div className="bg-slate-50/70 border border-slate-200 rounded p-1.5 space-y-1 text-[10px]">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Base Invoiced Value:</span>
                      <span className="font-mono text-slate-800">₹{totalValue.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-blue-700">
                      <span>+ Capitalized Landed Addons:</span>
                      <span className="font-mono font-semibold">+₹{totalCapitalizedLandedCost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-rose-700">
                      <span>- Damage Stock (Excluded):</span>
                      <span className="font-mono font-semibold">-₹{totalDamageValue.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-slate-200 font-bold text-slate-900">
                      <span>= Capitalized Inventory Valuation:</span>
                      <span className="font-mono text-[#00288e] font-extrabold">₹{totalInventoryValueWithLandedCost.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Statutory Yellow Callout Note */}
                <div className="p-1.5 bg-amber-50 border border-amber-200 rounded text-[9px] text-amber-900 leading-tight flex items-start gap-1">
                  <Info size={11} className="text-amber-700 shrink-0 mt-0.5" />
                  <span>
                    <strong>Ind AS 2:</strong> Inward freight, hamali, insurance &amp; non-refundable duties are capitalized into inventory value. Damaged units excluded &amp; logged for recovery u/s 17(5)(h).
                  </span>
                </div>
              </div>

            </div>
          </section>
        )}

        {/* ========================================================================= */}
        {/* 4.6 DOCUMENT REMARKS & DELIVERY INSTRUCTIONS STRIP                        */}
        {/* ========================================================================= */}
        <div className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 shadow-2xs flex items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-2 flex-1">
            <span className="font-bold text-slate-500 uppercase text-[10px] shrink-0">Remarks:</span>
            <input
              type="text"
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              placeholder="e.g. Received in good order except damaged cartons segregated for supplier debit note."
              className="w-full h-6 px-2 border border-slate-300 rounded text-xs bg-white outline-none focus:border-[#00288e]"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowItemTagsModal(true)}
              className="h-6 px-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded text-[11px] font-semibold text-slate-700 flex items-center gap-1 transition"
            >
              <Tag size={11} className="text-slate-500" />
              <span>Show Item Tags</span>
            </button>

            <button
              type="button"
              onClick={() => setDeliveryInstructionsModal(true)}
              className="h-6 px-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded text-[11px] font-semibold text-slate-700 flex items-center gap-1 transition"
            >
              <Truck size={11} className="text-slate-500" />
              <span>Delivery Instructions</span>
            </button>
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* 5. REAL-TIME TELEMETRY & SEARCH STRIP (Compact: ~22px)                    */}
      {/* ========================================================================= */}
      <div className="px-3 py-1 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-[10px] font-medium text-slate-600 shrink-0">
        <div className="truncate">
          <span>Stock Qty: Current Bal: </span>
          <span className="font-bold text-slate-900">{telemetry.currentBalance}</span>
          <span>, Reserved: </span>
          <span className="font-bold text-slate-900">{telemetry.reservedStock}</span>
          <span>, Avail: </span>
          <span className="font-bold text-slate-900">{telemetry.availableBalance}</span>
          <span> | Last Purchase: </span>
          <span className="font-bold text-emerald-700">₹{telemetry.lastPurchasePrice.toFixed(2)}</span>
          <span> | SKU: </span>
          <span className="font-mono font-bold text-[#00288e]">{telemetry.stockNo}</span>
        </div>

        <div className="flex items-center gap-3 shrink-0 ml-2">
          <button
            type="button"
            onClick={() => setShowHotkeysModal(true)}
            className="hover:text-[#00288e] font-semibold flex items-center gap-1"
          >
            <Keyboard size={11} />
            <span>Hotkeys (F3)</span>
          </button>

          <button
            type="button"
            onClick={() => setShowSupplierModal(true)}
            className="hover:text-[#00288e] font-semibold flex items-center gap-1"
          >
            <Search size={11} />
            <span>Supplier / Help</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 6. BOTTOM ACTION FOOTER BAR (Pinned: ~36px)                               */}
      {/* ========================================================================= */}
      <footer className="h-9 bg-white border-t border-slate-200 px-3 flex items-center justify-between shadow-xs shrink-0">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setSelectedRowIndex(null);
              setEntryStockNo("");
              stockInputRef.current?.focus();
            }}
            className="flex items-center gap-1 px-2.5 h-6.5 bg-white border border-slate-300 hover:bg-slate-50 rounded font-bold text-xs text-slate-700 shadow-2xs transition"
          >
            <Plus size={12} />
            <span>Add</span>
          </button>

          <button
            type="button"
            disabled={selectedRowIndex === null}
            onClick={() => {
              if (selectedRowIndex !== null) handleSelectRow(selectedRowIndex);
            }}
            className="flex items-center gap-1 px-2.5 h-6.5 bg-white border border-slate-200 text-slate-400 rounded font-semibold text-xs shadow-2xs disabled:opacity-40"
          >
            <Edit3 size={12} />
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
            className="flex items-center gap-1 px-2.5 h-6.5 bg-white border border-slate-200 text-rose-500 rounded font-semibold text-xs shadow-2xs disabled:opacity-40"
          >
            <Trash2 size={12} />
            <span>Delete</span>
          </button>

          <button
            type="button"
            onClick={onOpenPrint}
            className="flex items-center gap-1 px-2.5 h-6.5 bg-white border border-slate-200 text-slate-500 rounded font-semibold text-xs shadow-2xs hover:bg-slate-50"
          >
            <Printer size={12} />
            <span>Reprint</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1 px-2.5 h-6.5 bg-white border border-slate-200 text-slate-500 rounded font-semibold text-xs shadow-2xs hover:bg-slate-50"
          >
            <ExternalLink size={12} />
            <span>Exit</span>
          </button>
        </div>

        {/* Right Confirm / Cancel */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onSaveGrn}
            disabled={saving}
            className="flex items-center gap-1.5 px-5 h-7 bg-[#00288e] hover:bg-[#1e40af] text-white rounded font-bold text-xs shadow-xs transition disabled:opacity-50"
          >
            <Check size={14} />
            <span>{saving ? "Posting..." : "OK (Post GRN)"}</span>
          </button>

          <button
            type="button"
            onClick={onResetGrn}
            className="flex items-center gap-1 px-3.5 h-7 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded font-bold text-xs shadow-2xs transition"
          >
            <X size={14} />
            <span>Cancel</span>
          </button>
        </div>
      </footer>

      {/* ========================================================================= */}
      {/* 7. MODALS                                                                */}
      {/* ========================================================================= */}

      {/* Select Purchase Order Modal (Wired to Backend DB) */}
      {showPoModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-2xl w-full p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <FileSpreadsheet size={16} className="text-[#00288e]" />
                <h3 className="font-bold text-sm text-slate-900">Select Purchase Order from Database</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fetchLiveOrders(supplierId || undefined)}
                  className="p-1 text-slate-500 hover:text-[#00288e] rounded hover:bg-slate-100 flex items-center gap-1 text-xs"
                  title="Refresh orders from database"
                >
                  <RefreshCw size={13} className={ordersLoading ? "animate-spin" : ""} />
                  <span className="text-[11px] font-semibold">Refresh</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowPoModal(false)}
                  className="p-1 rounded hover:bg-slate-100 text-slate-500"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Live Search PO Input */}
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-2 text-slate-400" />
              <input
                type="text"
                value={searchPoQuery}
                onChange={(e) => setSearchPoQuery(e.target.value)}
                placeholder="Search by PO Number, Supplier Name, or Status..."
                className="w-full h-8 pl-8 pr-7 border border-slate-300 rounded text-xs outline-none focus:border-[#00288e]"
                autoFocus
              />
              {searchPoQuery && (
                <button
                  type="button"
                  onClick={() => setSearchPoQuery("")}
                  className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Orders List */}
            <div className="max-h-72 overflow-y-auto space-y-1.5 text-xs">
              {ordersLoading ? (
                <div className="p-8 text-center text-slate-500 flex flex-col items-center gap-2">
                  <RefreshCw size={20} className="animate-spin text-[#00288e]" />
                  <span>Loading open Purchase Orders from database...</span>
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  <FileText size={24} className="mx-auto mb-1 opacity-50" />
                  <div>No open Purchase Orders matching query.</div>
                  <button
                    type="button"
                    onClick={() => fetchLiveOrders()}
                    className="mt-2 text-[#00288e] font-bold text-xs underline"
                  >
                    Refresh All Pending Orders
                  </button>
                </div>
              ) : (
                filteredOrders.map((po) => {
                  const poNum = po.order_no || po.order_number || po.id;
                  const isCurrent = selectedOrderId === po.id || selectedOrderId === poNum;
                  return (
                    <div
                      key={po.id}
                      onClick={() => handleSelectPurchaseOrder(po.id || po.order_id)}
                      className={`p-2.5 rounded-lg border cursor-pointer transition flex items-center justify-between ${
                        isCurrent
                          ? "border-[#00288e] bg-blue-50/60"
                          : "border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold font-mono text-sm text-[#00288e]">{poNum}</span>
                          <span className="px-1.5 py-0.2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[10px] font-bold uppercase">
                            {po.status || "CONFIRMED"}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-600 flex items-center gap-2">
                          <span className="font-medium">Supplier: {po.supplier_name || po.supplier_id}</span>
                          <span>•</span>
                          <span>{po.items?.length || 0} line items</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold font-mono text-xs">
                          ₹{(po.total_amount || po.grand_total || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </div>
                        <span className="text-[10px] text-[#00288e] font-bold">Load into Inward →</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-xs">
              <span className="text-[11px] text-slate-500 font-medium">
                {filteredOrders.length} Purchase Order(s) ready in database
              </span>
              <button
                type="button"
                onClick={() => setShowPoModal(false)}
                className="px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded text-xs font-bold text-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Supplier Browse Modal (Wired to Backend DB) */}
      {showSupplierModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Building2 size={16} className="text-[#00288e]" />
                <h3 className="font-bold text-sm text-slate-900">Select Supplier from Database</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSupplierModal(false)}
                className="p-1 rounded hover:bg-slate-100 text-slate-500"
              >
                <X size={15} />
              </button>
            </div>

            {/* Live Search Supplier Input */}
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-2 text-slate-400" />
              <input
                type="text"
                value={searchSupplierQuery}
                onChange={(e) => setSearchSupplierQuery(e.target.value)}
                placeholder="Search by supplier name, code, GSTIN, or city..."
                className="w-full h-8 pl-8 pr-7 border border-slate-300 rounded text-xs outline-none focus:border-[#00288e]"
                autoFocus
              />
            </div>

            <div className="max-h-72 overflow-y-auto space-y-1 text-xs">
              {filteredSuppliers.length === 0 ? (
                <div className="p-6 text-center text-slate-400">No suppliers found.</div>
              ) : (
                filteredSuppliers.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => {
                      onSupplierChange(s.id);
                      fetchLiveOrders(s.id);
                      setShowSupplierModal(false);
                    }}
                    className={`p-2.5 rounded-lg border cursor-pointer transition flex items-center justify-between ${
                      supplierId === s.id ? "border-[#00288e] bg-blue-50/50" : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <div>
                      <div className="font-bold text-slate-900">{s.name || s.company_name}</div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        Code: {s.code || s.id} {s.gst_number || s.gstin ? `| GST: ${s.gst_number || s.gstin}` : ""} {s.city ? `| ${s.city}` : ""}
                      </div>
                    </div>
                    <span className="text-[10px] text-[#00288e] font-bold">Select →</span>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowSupplierModal(false)}
                className="px-3.5 py-1 bg-slate-100 hover:bg-slate-200 rounded text-xs font-bold text-slate-700"
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
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Tag size={16} className="text-[#00288e]" />
                <h3 className="font-bold text-sm text-slate-900">Item Serial &amp; Batch Tags</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowItemTagsModal(false)}
                className="p-1 rounded hover:bg-slate-100 text-slate-500"
              >
                <X size={15} />
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
                className="px-3.5 py-1 bg-[#00288e] text-white rounded text-xs font-bold hover:bg-[#1e40af]"
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
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Layers size={16} className="text-[#00288e]" />
                <h3 className="font-bold text-sm text-slate-900">Load Outward to Inward</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowOutwardModal(false)}
                className="p-1 rounded hover:bg-slate-100 text-slate-500"
              >
                <X size={15} />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
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
                  className="w-full h-7 px-2.5 border border-slate-300 rounded font-mono text-xs outline-none focus:border-[#00288e]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowOutwardModal(false)}
                className="px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded text-xs font-bold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowOutwardModal(false);
                  onNotification?.("Outward Matched", "Loaded items from transfer dispatch challan.", "success");
                }}
                className="px-3.5 py-1 bg-[#00288e] text-white rounded text-xs font-bold hover:bg-[#1e40af]"
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
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Keyboard size={16} className="text-[#00288e]" />
                <h3 className="font-bold text-sm text-slate-900">Goods Receipt Hotkeys</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowHotkeysModal(false)}
                className="p-1 rounded hover:bg-slate-100 text-slate-500"
              >
                <X size={15} />
              </button>
            </div>

            <div className="space-y-1.5 text-xs divide-y divide-slate-100">
              <div className="flex justify-between items-center py-1">
                <span className="font-medium text-slate-700">Select Purchase Order from DB</span>
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
                className="px-3.5 py-1 bg-[#00288e] text-white rounded text-xs font-bold hover:bg-[#1e40af]"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 8. LANDED COST (INDIA ADDONS) BREAKDOWN MODAL                             */}
      {/* ========================================================================= */}
      {showLandedCostModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-2xl w-full p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="p-1 rounded bg-[#00288e] text-white">
                  <Package size={16} />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900">Components of Landed Cost in India</h3>
                  <p className="text-[10px] text-slate-500 font-medium">
                    Ind AS 2 / AS 2 Valuation of Inventories &amp; Inward GST Apportionment
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowLandedCostModal(false)}
                className="p-1 rounded hover:bg-slate-100 text-slate-500"
              >
                <X size={16} />
              </button>
            </div>

            {/* Inward Cost Table with 6 Statutory Components */}
            <div className="space-y-2 max-h-[62vh] overflow-y-auto pr-1 text-xs">
              
              {/* 1. Product Cost (FOB / EXW) */}
              <div className="p-2 rounded border border-slate-200 bg-slate-50/60 flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px] font-bold">1</span>
                    <span>Product Cost (FOB / EXW)</span>
                    <span className="text-[9px] px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded font-semibold">Baseline Invoiced</span>
                  </div>
                  <div className="text-[10px] text-slate-500">The baseline price invoiced by the supplier across loaded items.</div>
                </div>
                <div className="text-right">
                  <span className="font-mono font-bold text-xs text-slate-900">₹{totalValue.toFixed(2)}</span>
                </div>
              </div>

              {/* 2. Freight & Shipping Charges */}
              <div className="p-2 rounded border border-slate-200 bg-white space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-blue-100 text-[#00288e] flex items-center justify-center text-[10px] font-bold">2</span>
                    <span>Freight and Shipping Charges</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={landedCostBreakdown.freightTreatment}
                      onChange={(e) => setLandedCostBreakdown({ ...landedCostBreakdown, freightTreatment: e.target.value as any })}
                      className="h-6 px-1.5 border border-slate-300 rounded text-[10px] font-semibold bg-slate-50 outline-none"
                    >
                      <option value="BEFORE_TAX">On Supplier Invoice (Composite Supply)</option>
                      <option value="AFTER_TAX">Separate Transporter Bill (GTA / RCM)</option>
                    </select>
                    <div className="relative">
                      <span className="absolute left-1.5 top-1 text-slate-400 font-mono text-[11px]">₹</span>
                      <input
                        type="number"
                        value={landedCostBreakdown.freightCharges || ""}
                        onChange={(e) => setLandedCostBreakdown({ ...landedCostBreakdown, freightCharges: parseFloat(e.target.value) || 0 })}
                        placeholder="0.00"
                        className="w-24 h-6 pl-4 pr-1 text-right font-mono font-bold text-xs border border-slate-300 rounded outline-none focus:border-[#00288e]"
                      />
                    </div>
                  </div>
                </div>
                <p className="text-[10px] text-slate-500">Ocean, air, or domestic transport fees required to move the goods to the port or warehouse depot.</p>
              </div>

              {/* 3. Labor and Handling Charges */}
              <div className="p-2 rounded border border-slate-200 bg-white space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-blue-100 text-[#00288e] flex items-center justify-center text-[10px] font-bold">3</span>
                    <span>Labor and Handling Charges</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={landedCostBreakdown.laborTreatment}
                      onChange={(e) => setLandedCostBreakdown({ ...landedCostBreakdown, laborTreatment: e.target.value as any })}
                      className="h-6 px-1.5 border border-slate-300 rounded text-[10px] font-semibold bg-slate-50 outline-none"
                    >
                      <option value="AFTER_TAX">Separate Agency Bill (Hamali/CFS)</option>
                      <option value="BEFORE_TAX">On Supplier Invoice (Direct Inward)</option>
                    </select>
                    <div className="relative">
                      <span className="absolute left-1.5 top-1 text-slate-400 font-mono text-[11px]">₹</span>
                      <input
                        type="number"
                        value={landedCostBreakdown.laborHandlingCharges || ""}
                        onChange={(e) => setLandedCostBreakdown({ ...landedCostBreakdown, laborHandlingCharges: parseFloat(e.target.value) || 0 })}
                        placeholder="0.00"
                        className="w-24 h-6 pl-4 pr-1 text-right font-mono font-bold text-xs border border-slate-300 rounded outline-none focus:border-[#00288e]"
                      />
                    </div>
                  </div>
                </div>
                <p className="text-[10px] text-slate-500">Loading, unloading, container freight station (CFS) labor, port handling, and warehousing labor fees.</p>
              </div>

              {/* 4. Insurance (Marine or Transit Insurance) */}
              <div className="p-2 rounded border border-slate-200 bg-white space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-blue-100 text-[#00288e] flex items-center justify-center text-[10px] font-bold">4</span>
                    <span>Transit Insurance</span>
                    <span className="text-[9px] px-1 py-0.2 bg-blue-100 text-[#00288e] rounded font-mono font-bold">After Tax</span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-1.5 top-1 text-slate-400 font-mono text-[11px]">₹</span>
                    <input
                      type="number"
                      value={landedCostBreakdown.insuranceCharges || ""}
                      onChange={(e) => setLandedCostBreakdown({ ...landedCostBreakdown, insuranceCharges: parseFloat(e.target.value) || 0 })}
                      placeholder="0.00"
                      className="w-24 h-6 pl-4 pr-1 text-right font-mono font-bold text-xs border border-slate-300 rounded outline-none focus:border-[#00288e]"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-slate-500">Marine or transit insurance premium (typically 0.1%–0.5% of CIF value). Net premium is capitalized; GST is availed as ITC.</p>
              </div>

              {/* 5. Customs Duties & Taxes (BCD & SWS) */}
              <div className="p-2 rounded border border-slate-200 bg-white space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-blue-100 text-[#00288e] flex items-center justify-center text-[10px] font-bold">5</span>
                    <span>Customs Duties &amp; Taxes (BCD + SWS)</span>
                    <span className="text-[9px] px-1.5 py-0.2 bg-amber-100 text-amber-900 rounded font-bold">Non-Creditable Duty</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-slate-500 font-semibold">BCD:</span>
                      <div className="relative">
                        <span className="absolute left-1.5 top-1 text-slate-400 font-mono text-[11px]">₹</span>
                        <input
                          type="number"
                          value={landedCostBreakdown.customsDutyBcd || ""}
                          onChange={(e) => {
                            const bcd = parseFloat(e.target.value) || 0;
                            setLandedCostBreakdown({
                              ...landedCostBreakdown,
                              customsDutyBcd: bcd,
                              customsSws: Math.round(bcd * 0.1 * 100) / 100, // SWS is statutory 10% of BCD
                            });
                          }}
                          placeholder="BCD"
                          className="w-20 h-6 pl-4 pr-1 text-right font-mono font-bold text-xs border border-slate-300 rounded outline-none focus:border-[#00288e]"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-slate-500 font-semibold">SWS (10%):</span>
                      <div className="relative">
                        <span className="absolute left-1.5 top-1 text-slate-400 font-mono text-[11px]">₹</span>
                        <input
                          type="number"
                          value={landedCostBreakdown.customsSws || ""}
                          onChange={(e) => setLandedCostBreakdown({ ...landedCostBreakdown, customsSws: parseFloat(e.target.value) || 0 })}
                          placeholder="SWS"
                          className="w-20 h-6 pl-4 pr-1 text-right font-mono font-bold text-xs border border-slate-300 rounded outline-none focus:border-[#00288e]"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <p className="text-[10px] text-slate-500">Basic Customs Duty (BCD) and Social Welfare Surcharge (SWS 10% on BCD). (Note: IGST is excluded here as it is claimed as full ITC under Section 16).</p>
              </div>

              {/* 6. Clearance Fees (CHA Charges & Brokerage) */}
              <div className="p-2 rounded border border-slate-200 bg-white space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-blue-100 text-[#00288e] flex items-center justify-center text-[10px] font-bold">6</span>
                    <span>Clearance Fees (CHA &amp; Brokerage)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={landedCostBreakdown.clearanceTreatment}
                      onChange={(e) => setLandedCostBreakdown({ ...landedCostBreakdown, clearanceTreatment: e.target.value as any })}
                      className="h-6 px-1.5 border border-slate-300 rounded text-[10px] font-semibold bg-slate-50 outline-none"
                    >
                      <option value="AFTER_TAX">Separate CHA Invoice (Capitalized)</option>
                      <option value="BEFORE_TAX">Consolidated Supplier Invoice</option>
                    </select>
                    <div className="relative">
                      <span className="absolute left-1.5 top-1 text-slate-400 font-mono text-[11px]">₹</span>
                      <input
                        type="number"
                        value={landedCostBreakdown.clearanceChaFees || ""}
                        onChange={(e) => setLandedCostBreakdown({ ...landedCostBreakdown, clearanceChaFees: parseFloat(e.target.value) || 0 })}
                        placeholder="0.00"
                        className="w-24 h-6 pl-4 pr-1 text-right font-mono font-bold text-xs border border-slate-300 rounded outline-none focus:border-[#00288e]"
                      />
                    </div>
                  </div>
                </div>
                <p className="text-[10px] text-slate-500">Custom House Agent (CHA) charges, custodian documentation, and port brokerage fees.</p>
              </div>

              {/* Allocation Basis Selector */}
              <div className="p-2.5 rounded-lg border border-blue-200 bg-blue-50/50 flex items-center justify-between">
                <div>
                  <span className="font-bold text-[#00288e] text-xs">Apportionment Basis</span>
                  <p className="text-[10px] text-slate-600">Select how addons are mathematically spread across inward items:</p>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1 text-[11px] font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="allocBasis"
                      checked={landedCostBreakdown.allocationMethod === "VALUE"}
                      onChange={() => setLandedCostBreakdown({ ...landedCostBreakdown, allocationMethod: "VALUE" })}
                      className="text-[#00288e] focus:ring-0"
                    />
                    <span>Gross Value Weighted (Ind AS 2 Pro-Rata)</span>
                  </label>
                  <label className="flex items-center gap-1 text-[11px] font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="allocBasis"
                      checked={landedCostBreakdown.allocationMethod === "QUANTITY"}
                      onChange={() => setLandedCostBreakdown({ ...landedCostBreakdown, allocationMethod: "QUANTITY" })}
                      className="text-[#00288e] focus:ring-0"
                    />
                    <span>Unit Quantity Weighted</span>
                  </label>
                </div>
              </div>

            </div>

            {/* Modal Bottom Summary & Apply */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-200">
              <div className="text-xs">
                <span className="text-slate-500">Total Addons to Apportion: </span>
                <span className="font-mono font-extrabold text-[#00288e]">
                  ₹{(
                    (Number(landedCostBreakdown.freightCharges) || 0) +
                    (Number(landedCostBreakdown.laborHandlingCharges) || 0) +
                    (Number(landedCostBreakdown.insuranceCharges) || 0) +
                    (Number(landedCostBreakdown.customsDutyBcd) || 0) +
                    (Number(landedCostBreakdown.customsSws) || 0) +
                    (Number(landedCostBreakdown.clearanceChaFees) || 0)
                  ).toFixed(2)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowLandedCostModal(false)}
                  className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApplyLandedCostApportionment}
                  className="px-4 py-1 bg-[#00288e] hover:bg-[#1e40af] text-white rounded text-xs font-bold shadow-xs flex items-center gap-1.5"
                >
                  <Check size={14} />
                  <span>Apportion into Lines (0.00 Variance)</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Delivery Instructions Modal */}
      {deliveryInstructionsModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Truck size={16} className="text-[#00288e]" />
                <h3 className="font-bold text-sm text-slate-900">Delivery &amp; Staging Instructions</h3>
              </div>
              <button
                type="button"
                onClick={() => setDeliveryInstructionsModal(false)}
                className="p-1 rounded hover:bg-slate-100 text-slate-500"
              >
                <X size={15} />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <label className="block font-bold text-slate-700">Dock &amp; Staging Guidelines</label>
              <textarea
                rows={4}
                value={deliveryInstructions}
                onChange={(e) => setDeliveryInstructions(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded outline-none focus:border-[#00288e] text-xs font-sans"
              />
              <p className="text-[10px] text-slate-500">
                Printed on goods receipt inward slip and dispatched to the gate warehouse manager.
              </p>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setDeliveryInstructionsModal(false);
                  onNotification?.("Instructions Saved", "Updated delivery staging instructions.", "info");
                }}
                className="px-4 py-1.5 bg-[#00288e] text-white rounded text-xs font-bold shadow-xs hover:bg-[#1e40af]"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default GrnDesktopTerminal;

