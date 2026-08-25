/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.17.0
 * Created      : 2026-08-21
 * Modified     : 2026-08-25
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useEffect, useMemo, useRef } from "react";
import { 
  ProPosCartItem, 
  ProPosCustomer, 
  ProPosTenderSplit, 
  SuspendedBill, 
  CancelledBillRecord,
  ReturnItem,
  POSZReportData,
  ShiftCashMovementRecord
} from "./types.ts";
import { SmritiPosSettlement } from "./ProPosSettlementDl.tsx";
import { SmritiProPosRecallDlg } from "./ProPosRecallDlg.tsx";
import { SmritiProPosCancelDlg } from "./ProPosCancellation.tsx";
import { SmritiLoyaltyLookupDlgpModal } from "./ProPosLoyaltyLooku.tsx";
import { SmritiProPosSalesReturnModal } from "./ProPosSalesReturnD.tsx";
import { SmritiProPosTaxInvoiceReceipt } from "./ProPosTaxInvoiceRc.tsx";
import { SmritiPdtImportDlg } from "./ProPosPdtImportDlg.tsx";
import { SmritiCustomerBrowseModal } from "./CustBrowseDlg.tsx";
import { SmritiProPosHotkeysDlg } from "./ProPosHotkeysDlg.tsx";
import { SmritiProPosReprintDlg } from "./ProPosReprintDlg.tsx";
import { SmritiProPosCashMovementsModal } from "./ProPosCashMovesDlg.tsx";
import { SmritiProPosShiftCloseModal } from "./ProPosShiftCloseDl.tsx";
import { apiFetchV1 } from "../../../lib/apiFetchV1.ts";
import { calculateGST, parseAndValidateGSTIN, GST_STATE_MAP } from "../../../utils/gstEngine.ts";
import { searchBackendProducts, AutoPopulateProductResult } from "../../../services/autoPopulateService.ts";
import { SmritiItemTypeaheadDropdown } from "../../common/ItemTypeaheadDrop.tsx";
import { 
  Barcode, 
  Search, 
  History, 
  Award, 
  Trash2, 
  Plus, 
  Minus, 
  Printer, 
  CheckCircle, 
  AlertCircle, 
  User, 
  X,
  RotateCcw,
  ShieldAlert,
  Pause,
  Play,
  CornerDownLeft,
  UploadCloud,
  FileSpreadsheet,
  Calendar,
  Clock,
  ChevronRight,
  FilePlus,
  HelpCircle,
  Calculator,
  RefreshCw,
  Vault,
  Lock
} from "lucide-react";

interface SmritiProPosBillinginalProps {
  onNotification?: (title: string, message: string, type: "success" | "error" | "info") => void;
}

export const SmritiProPosBillinginal: React.FC<SmritiProPosBillinginalProps> = ({
  onNotification
}) => {
  // --- POS Mode & Activity State ---
  const [activeActivity, setActiveActivity] = useState<"BILLING" | "RETURN" | "RETURN_BLIND">("BILLING");

  // --- Header Group State ---
  const [billType, setBillType] = useState<"Product" | "Service">("Product");
  const [transactionType, setTransactionType] = useState<"Cash" | "Credit">("Cash");
  const [billDocPrefix, setBillDocPrefix] = useState<string>("INV");
  const [billDocNumber, setBillDocNumber] = useState<string>("84920");
  const [currentDateTime, setCurrentDateTime] = useState<string>(() => {
    const d = new Date();
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  });

  const [customer, setCustomer] = useState<ProPosCustomer>({
    id: "cust-01",
    code: "C01",
    name: "Customer01 (Walk-in)",
    phone: "9876543210",
    loyaltyPoints: 1200,
    loyaltyTier: "Gold",
    creditLimit: 50000,
    currentBalance: 0
  });

  const storeStateCode = "27"; // Maharashtra store default

  const gstAnalysis = useMemo(() => {
    return parseAndValidateGSTIN(customer.gstin);
  }, [customer.gstin]);

  const isB2B = Boolean(customer.gstin && gstAnalysis.isValid);
  const posStateCode = gstAnalysis.stateCode || customer.stateCode || storeStateCode;
  const posStateName = gstAnalysis.stateName || customer.state || GST_STATE_MAP[posStateCode] || "Home State";
  const isInterstate = storeStateCode !== posStateCode;

  const [salesStaff, setSalesStaff] = useState<string>("SM1");
  const [selectedRowIndex, setSelectedRowIndex] = useState<number>(1);
  const [showTotalsPanel, setShowTotalsPanel] = useState<boolean>(true);

  // --- Detail Group: Accepted Item Details Grid State ---
  const [cartItems, setCartItems] = useState<ProPosCartItem[]>([
    {
      id: "item-init-1",
      itemNo: 1,
      sku: "8887462974641",
      barcode: "8887462974641",
      name: "regular straight Med Beige",
      size: "32",
      color: "Beige",
      brand: "SMRITI",
      salesStaff: "SM1",
      qty: 1.00,
      mrp: 999.00,
      unitPrice: 999.00,
      discCode: "ILD",
      discQty: 1.00,
      discountPct: 10.00,
      discountAmt: 99.90,
      taxPct: 5.00,
      taxAmt: 42.81,
      lineTotal: 899.10
    },
    {
      id: "item-init-2",
      itemNo: 2,
      sku: "8887462974825",
      barcode: "8887462974825",
      name: "regular straight Med Beige",
      size: "34",
      color: "Beige",
      brand: "SMRITI",
      salesStaff: "SM1",
      qty: 1.00,
      mrp: 999.00,
      unitPrice: 999.00,
      discCode: "ILD",
      discQty: 1.00,
      discountPct: 10.00,
      discountAmt: 99.90,
      taxPct: 5.00,
      taxAmt: 42.81,
      lineTotal: 899.10
    }
  ]);

  // --- Detail Group: Direct Entry Grid State ---
  const [directBarcode, setDirectBarcode] = useState<string>("");
  const [directStockNo, setDirectStockNo] = useState<string>("");
  const [directDescription, setDirectDescription] = useState<string>("");
  const [directRate, setDirectRate] = useState<string>("999.00");
  const [directQty, setDirectQty] = useState<string>("1.00");
  const [directDiscCode, setDirectDiscCode] = useState<string>("ILD");
  const [directDiscQty, setDirectDiscQty] = useState<string>("1.00");
  const [directDiscPct, setDirectDiscPct] = useState<string>("10.00");
  const [directDiscAmtInput, setDirectDiscAmtInput] = useState<string>("99.90");
  const [directStaff, setDirectStaff] = useState<string>("SM1");

  // Live Item Typeahead / Auto-Populate State
  const [productSuggestions, setProductSuggestions] = useState<AutoPopulateProductResult[]>([]);
  const [isProductSearchOpen, setIsProductSearchOpen] = useState<boolean>(false);
  const [isProductSearching, setIsProductSearching] = useState<boolean>(false);
  const [selectedSuggestionIdx, setSelectedSuggestionIdx] = useState<number>(0);
  const [activeSearchField, setActiveSearchField] = useState<"stockNo" | "barcode">("stockNo");
  const [selectedProductMeta, setSelectedProductMeta] = useState<AutoPopulateProductResult | null>(null);

  const directStockNoRef = useRef<HTMLInputElement | null>(null);
  const directBarcodeRef = useRef<HTMLInputElement | null>(null);
  const searchDebounceTimer = useRef<any>(null);

  // Debounced Universal Product Lookup from Barcode or Stock No
  const handleItemLiveSearch = (query: string, fieldType: "stockNo" | "barcode") => {
    setActiveSearchField(fieldType);
    if (!query.trim()) {
      setProductSuggestions([]);
      setIsProductSearchOpen(false);
      return;
    }

    if (searchDebounceTimer.current) {
      clearTimeout(searchDebounceTimer.current);
    }

    setIsProductSearching(true);
    searchDebounceTimer.current = setTimeout(async () => {
      try {
        const results = await searchBackendProducts(query);
        setProductSuggestions(results);
        setIsProductSearchOpen(results.length > 0);
        setSelectedSuggestionIdx(0);
      } catch (err) {
        console.warn("Item search failed", err);
      } finally {
        setIsProductSearching(false);
      }
    }, 150);
  };

  // Select Item from Dropdown / Autocomplete
  const handleSelectProductSuggestion = (item: AutoPopulateProductResult) => {
    setDirectStockNo(item.stockNo || item.code);
    setDirectBarcode(item.barcode);
    setDirectDescription(item.name);
    const unitP = item.sellingPrice ? item.sellingPrice.toFixed(2) : (item.mrp || 999).toFixed(2);
    handleRateOrQtyChange(unitP, directQty);
    setSelectedProductMeta(item);
    setIsProductSearchOpen(false);
    onNotification?.("Item Identified", `${item.name} (Stock No: ${item.stockNo || item.code}, Barcode: ${item.barcode}) loaded.`, "info");
  };

  // Direct Entry Computed Values
  const directValue = useMemo(() => {
    const rate = parseFloat(directRate) || 0;
    const qty = parseFloat(directQty) || 0;
    return rate * qty;
  }, [directRate, directQty]);

  // Helper to determine effective discountable quantity (Disc Qty)
  const getEffectiveDiscQty = (dQtyStr: string, totalQtyStr: string) => {
    if (dQtyStr.trim() !== "") {
      const parsed = parseFloat(dQtyStr);
      return isNaN(parsed) ? 0 : parsed;
    }
    const totalQ = parseFloat(totalQtyStr) || 0;
    return totalQ;
  };

  // Handle Disc Qty input change (triggers Disc.Amt recalculation based on Disc. %)
  const handleDiscQtyChange = (dQtyStr: string) => {
    setDirectDiscQty(dQtyStr);
    const effDiscQ = getEffectiveDiscQty(dQtyStr, directQty);
    const rate = parseFloat(directRate) || 0;
    const pct = parseFloat(directDiscPct) || 0;
    const computedAmt = (rate * effDiscQ * pct) / 100;
    setDirectDiscAmtInput(computedAmt.toFixed(2));
  };

  // Handle Disc % input change (computes and updates Disc.Amt based on Disc Qty)
  const handleDiscPctChange = (pctStr: string) => {
    setDirectDiscPct(pctStr);
    const pct = parseFloat(pctStr) || 0;
    const rate = parseFloat(directRate) || 0;
    const effDiscQ = getEffectiveDiscQty(directDiscQty, directQty);
    const computedAmt = (rate * effDiscQ * pct) / 100;
    setDirectDiscAmtInput(computedAmt.toFixed(2));
  };

  // Handle Disc.Amt input change (computes and updates Disc. % based on Disc Qty)
  const handleDiscAmtChange = (amtStr: string) => {
    setDirectDiscAmtInput(amtStr);
    const amt = parseFloat(amtStr) || 0;
    const rate = parseFloat(directRate) || 0;
    const effDiscQ = getEffectiveDiscQty(directDiscQty, directQty);
    const baseVal = rate * effDiscQ;

    if (baseVal > 0) {
      const computedPct = (amt / baseVal) * 100;
      setDirectDiscPct(computedPct.toFixed(2));
    } else {
      setDirectDiscPct("0.00");
    }
  };

  // Handle Rate or Qty changes
  const handleRateOrQtyChange = (newRate: string, newQty: string) => {
    setDirectRate(newRate);
    setDirectQty(newQty);
    const r = parseFloat(newRate) || 0;
    // If discQty was previously matching the old qty, update it
    let dQty = directDiscQty;
    if (directDiscQty === "" || directDiscQty === directQty) {
      dQty = newQty;
      setDirectDiscQty(newQty);
    }
    const effDiscQ = getEffectiveDiscQty(dQty, newQty);
    const pct = parseFloat(directDiscPct) || 0;
    setDirectDiscAmtInput(((r * effDiscQ * pct) / 100).toFixed(2));
  };

  const directDiscAmt = parseFloat(directDiscAmtInput) || 0;
  const directTotal = useMemo(() => {
    return Math.max(0, directValue - directDiscAmt);
  }, [directValue, directDiscAmt]);

  // --- Suspended Bills & Recalls State ---
  const [suspendedBills, setSuspendedBills] = useState<SuspendedBill[]>([]);

  // --- Modals State ---
  const [showSettlementModal, setShowSettlementModal] = useState<boolean>(false);
  const [showRecallModal, setShowRecallModal] = useState<boolean>(false);
  const [showCancelModal, setShowCancelModal] = useState<boolean>(false);
  const [showLoyaltyModal, setShowLoyaltyModal] = useState<boolean>(false);
  const [showReturnModal, setShowReturnModal] = useState<boolean>(false);
  const [showReceiptModal, setShowReceiptModal] = useState<boolean>(false);
  const [showPdtImportModal, setShowPdtImportModal] = useState<boolean>(false);
  const [showCustomerBrowseModal, setShowCustomerBrowseModal] = useState<boolean>(false);
  const [showHotkeysModal, setShowHotkeysModal] = useState<boolean>(false);
  const [showReprintModal, setShowReprintModal] = useState<boolean>(false);
  const [showCashMovementsModal, setShowCashMovementsModal] = useState<boolean>(false);
  const [showShiftCloseModal, setShowShiftCloseModal] = useState<boolean>(false);
  const [activeShiftId, setActiveShiftId] = useState<string>("shift-01");
  const [activeShiftCode, setActiveShiftCode] = useState<string>("REG-01 / SHIFT-CURRENT");

  // Fetch active shift on load
  useEffect(() => {
    let isMounted = true;
    const fetchActiveShift = async () => {
      try {
        const shifts = await apiFetchV1<any[]>("/pos/shifts/");
        if (isMounted && shifts && shifts.length > 0) {
          const openShift = shifts.find((s: any) => s.status === "OPEN") || shifts[0];
          setActiveShiftId(openShift.id);
          setActiveShiftCode(openShift.shift_code || `REG-01 / SHIFT-${openShift.id.slice(-6).toUpperCase()}`);
        }
      } catch (e) {
        // Fallback default shift ID
      }
    };
    fetchActiveShift();
    return () => {
      isMounted = false;
    };
  }, []);

  // Last Completed Invoice for Tax Printing
  const [lastCompletedBill, setLastCompletedBill] = useState<{
    billNo: string;
    billDate: string;
    customer: ProPosCustomer;
    salesStaff: string;
    items: ProPosCartItem[];
    subTotal: number;
    discountTotal: number;
    taxTotal: number;
    netPayable: number;
    tenders?: ProPosTenderSplit;
    changeDue?: number;
  } | null>(null);

  // Live timer for header clock
  useEffect(() => {
    const timer = setInterval(() => {
      const d = new Date();
      setCurrentDateTime(`${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // Focus direct entry input on mount
  useEffect(() => {
    directStockNoRef.current?.focus();
  }, []);

  // --- Footer Totals Calculations ---
  const totalItemsCount = cartItems.length;
  const totalQuantity = useMemo(() => cartItems.reduce((acc, it) => acc + it.qty, 0), [cartItems]);
  const grossSalesValue = useMemo(() => cartItems.reduce((acc, it) => acc + (it.qty * it.unitPrice), 0), [cartItems]);
  const itemDiscountsTotal = useMemo(() => cartItems.reduce((acc, it) => acc + it.discountAmt, 0), [cartItems]);
  const totalTaxAmount = useMemo(() => {
    return cartItems.reduce((acc, it) => {
      const gst = calculateGST({
        unitPrice: it.unitPrice,
        quantity: it.qty,
        discountAmount: it.discountAmt,
        gstRate: it.taxPct || 5.00,
        isTaxInclusive: it.isTaxInclusive ?? !isB2B,
        isInterstate: isInterstate,
      });
      return acc + gst.taxAmount;
    }, 0);
  }, [cartItems, isB2B, isInterstate]);
  const netPayableAmount = useMemo(() => {
    const raw = cartItems.reduce((acc, it) => {
      const gst = calculateGST({
        unitPrice: it.unitPrice,
        quantity: it.qty,
        discountAmount: it.discountAmt,
        gstRate: it.taxPct || 5.00,
        isTaxInclusive: it.isTaxInclusive ?? !isB2B,
        isInterstate: isInterstate,
      });
      return acc + gst.totalAmount;
    }, 0);
    return Math.round(raw * 100) / 100;
  }, [cartItems, isB2B, isInterstate]);

  // Create New Bill (Alt+1)
  const handleNewBill = () => {
    setCartItems([]);
    setCustomer({
      id: "cust-01",
      code: "C01",
      name: "Customer01 (Walk-in)",
      phone: "9876543210",
      loyaltyPoints: 1200,
      loyaltyTier: "Gold",
      creditLimit: 50000,
      currentBalance: 0
    });
    setDirectStockNo("");
    setDirectDescription("");
    setDirectQty("1.00");
    setDirectDiscQty("1.00");
    setDirectDiscPct("10.00");
    setDirectDiscAmtInput("99.90");
    setActiveActivity("BILLING");
    directStockNoRef.current?.focus();
    onNotification?.("New Bill Created", "Terminal reset for new billing transaction [Alt+1].", "info");
  };

  // Stock No / Barcode Lookup
  const handleDirectStockNoLookup = async (code: string) => {
    if (!code.trim()) return;
    const term = code.trim();

    try {
      const resp = await apiFetchV1<any>(`/products/search?q=${encodeURIComponent(term)}&limit=1`);
      const items = Array.isArray(resp) ? resp : (resp?.items || []);
      if (items.length > 0) {
        const p = items[0];
        setDirectDescription(p.product_name || p.name || `Retail Item ${term}`);
        const unitP = (parseFloat(p.selling_price || p.mrp || p.price) || 999.00).toFixed(2);
        handleRateOrQtyChange(unitP, directQty);
        return;
      }
    } catch (e) {
      console.warn("Direct lookup fallback to auto-generated details", e);
    }

    if (!directDescription) {
      setDirectDescription(`regular straight Med Beige`);
    }
  };

  // Keyboard navigation helper for Typeahead dropdown
  const handleItemInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, fieldType: "stockNo" | "barcode") => {
    if (isProductSearchOpen && productSuggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedSuggestionIdx(prev => (prev + 1) % productSuggestions.length);
        return;
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedSuggestionIdx(prev => (prev - 1 + productSuggestions.length) % productSuggestions.length);
        return;
      } else if (e.key === "Enter") {
        e.preventDefault();
        const selected = productSuggestions[selectedSuggestionIdx];
        if (selected) {
          handleSelectProductSuggestion(selected);
        } else {
          handleAcceptDirectEntryItem();
        }
        return;
      } else if (e.key === "Escape") {
        e.preventDefault();
        setIsProductSearchOpen(false);
        return;
      }
    }

    if (e.key === "Enter") {
      e.preventDefault();
      if (productSuggestions.length === 1 && isProductSearchOpen) {
        handleSelectProductSuggestion(productSuggestions[0]);
      } else {
        handleAcceptDirectEntryItem();
      }
    }
  };

  // Accept Item from Direct Entry Grid into Item Details Grid
  const handleAcceptDirectEntryItem = () => {
    if (!directStockNo.trim() && !directBarcode.trim()) {
      onNotification?.("Stock No / Barcode Required", "Please enter a Stock No or scan a barcode.", "error");
      directStockNoRef.current?.focus();
      return;
    }

    if (transactionType === "Credit" && (!customer.code || customer.code === "C01" && customer.name.includes("Walk-in"))) {
      onNotification?.("Customer Required", "Credit billing requires a registered customer account.", "error");
      setShowCustomerBrowseModal(true);
      return;
    }

    const stockCode = directStockNo.trim() || directBarcode.trim();
    const barcodeCode = directBarcode.trim() || selectedProductMeta?.barcode || stockCode;
    const desc = directDescription.trim() || selectedProductMeta?.name || `Retail Item ${stockCode}`;
    const rate = parseFloat(directRate) || selectedProductMeta?.sellingPrice || 999.00;
    const qty = parseFloat(directQty) || 1.00;
    const effDiscQ = getEffectiveDiscQty(directDiscQty, directQty);
    const discPct = parseFloat(directDiscPct) || 0.00;
    const discAmt = parseFloat(directDiscAmtInput) || ((rate * effDiscQ * discPct) / 100);
    const staff = directStaff || salesStaff;
    const gstRate = selectedProductMeta?.gstPercentage || 5.00;

    const gstCalc = calculateGST({
      unitPrice: rate,
      quantity: qty,
      discountAmount: discAmt,
      gstRate: gstRate,
      isTaxInclusive: !isB2B,
      isInterstate: isInterstate,
    });

    const existingIndex = cartItems.findIndex(
      it => (it.sku === stockCode || it.barcode === barcodeCode) &&
            it.unitPrice === rate &&
            Math.abs((it.discQty || 0) - effDiscQ) < 0.01 &&
            Math.abs(it.discountPct - discPct) < 0.01 &&
            it.salesStaff === staff
    );

    if (existingIndex >= 0) {
      setCartItems(prev => {
        const next = [...prev];
        const cur = next[existingIndex];
        const newQty = cur.qty + qty;
        const newDiscQ = (cur.discQty || 0) + effDiscQ;
        const newDiscAmt = (cur.unitPrice * newDiscQ * cur.discountPct) / 100;
        const updatedGst = calculateGST({
          unitPrice: cur.unitPrice,
          quantity: newQty,
          discountAmount: newDiscAmt,
          gstRate: cur.taxPct || gstRate,
          isTaxInclusive: !isB2B,
          isInterstate: isInterstate,
        });
        next[existingIndex] = {
          ...cur,
          qty: newQty,
          discQty: newDiscQ,
          discountAmt: newDiscAmt,
          taxAmt: updatedGst.taxAmount,
          taxableValue: updatedGst.taxableValue,
          cgstAmount: updatedGst.cgstAmount,
          sgstAmount: updatedGst.sgstAmount,
          igstAmount: updatedGst.igstAmount,
          lineTotal: updatedGst.totalAmount
        };
        return next;
      });
      setSelectedRowIndex(existingIndex);
      onNotification?.("Item Clubbed", `Repeated item ${stockCode} clubbed (+${qty.toFixed(2)} qty, ${effDiscQ.toFixed(2)} disc qty).`, "info");
    } else {
      const newItem: ProPosCartItem = {
        id: `item-${Date.now()}`,
        itemNo: cartItems.length + 1,
        sku: stockCode,
        barcode: barcodeCode,
        name: desc,
        size: selectedProductMeta?.size || "32",
        color: selectedProductMeta?.color || "Beige",
        brand: selectedProductMeta?.brand || "SMRITI",
        salesStaff: staff,
        qty: qty,
        mrp: selectedProductMeta?.mrp || rate,
        unitPrice: rate,
        discCode: directDiscCode || "ILD",
        discQty: effDiscQ,
        discountPct: discPct,
        discountAmt: discAmt,
        taxPct: gstRate,
        taxAmt: gstCalc.taxAmount,
        taxableValue: gstCalc.taxableValue,
        cgstAmount: gstCalc.cgstAmount,
        sgstAmount: gstCalc.sgstAmount,
        igstAmount: gstCalc.igstAmount,
        isTaxInclusive: !isB2B,
        lineTotal: gstCalc.totalAmount
      };

      setCartItems(prev => [...prev, newItem]);
      setSelectedRowIndex(cartItems.length);
      onNotification?.("Item Accepted", `${desc} (${stockCode}) accepted (${effDiscQ.toFixed(2)} Disc Qty, ₹${discAmt.toFixed(2)} Disc Amt).`, "success");
    }

    setDirectStockNo("");
    setDirectBarcode("");
    setDirectDescription("");
    setDirectQty("1.00");
    setDirectDiscQty("1.00");
    setDirectDiscPct("0.00");
    setDirectDiscAmtInput("0.00");
    setSelectedProductMeta(null);
    setIsProductSearchOpen(false);

    if (activeSearchField === "barcode") {
      directBarcodeRef.current?.focus();
    } else {
      directStockNoRef.current?.focus();
    }
  };

  // Import PDT Items callback
  const handlePdtImportSuccess = (imported: Partial<ProPosCartItem>[]) => {
    const converted: ProPosCartItem[] = imported.map((it, idx) => ({
      id: `pdt-${Date.now()}-${idx}`,
      itemNo: cartItems.length + idx + 1,
      sku: it.sku || `SKU-${idx + 1}`,
      barcode: it.barcode || it.sku || `SKU-${idx + 1}`,
      name: it.name || `Imported Item ${it.sku}`,
      size: it.size || "M",
      color: it.color || "Standard",
      brand: it.brand || "SMRITI",
      salesStaff: salesStaff,
      qty: it.qty || 1.00,
      mrp: it.mrp || 999.00,
      unitPrice: it.unitPrice || 999.00,
      discCode: "ILD",
      discQty: it.qty || 1.00,
      discountPct: it.discountPct || 10.00,
      discountAmt: it.discountAmt || 99.90,
      taxPct: it.taxPct || 5.00,
      taxAmt: it.taxAmt || 42.81,
      lineTotal: it.lineTotal || 899.10
    }));

    setCartItems(prev => [...prev, ...converted]);
    onNotification?.("PDT Loaded", `Successfully imported ${converted.length} items from PDT.`, "success");
  };

  // Remove Item from Grid
  const handleRemoveItem = (id: string) => {
    setCartItems(prev => prev.filter(it => it.id !== id).map((it, idx) => ({ ...it, itemNo: idx + 1 })));
  };

  // Hold / Suspend Current Bill
  const handleHoldBill = () => {
    if (cartItems.length === 0) {
      onNotification?.("Empty Cart", "No items to hold/suspend.", "error");
      return;
    }

    const newSuspended: SuspendedBill = {
      id: `susp-${Date.now()}`,
      billNo: `SUSP-${Date.now().toString().slice(-4)}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      customer,
      salesStaff,
      items: cartItems,
      itemCount: totalItemsCount,
      totalQty: totalQuantity,
      netAmount: netPayableAmount
    };

    setSuspendedBills(prev => [newSuspended, ...prev]);
    setCartItems([]);
    onNotification?.("Bill Suspended", `Bill ${newSuspended.billNo} suspended to queue.`, "info");
  };

  // Recall Bill
  const handleRecallBill = (bill: SuspendedBill) => {
    setCartItems(bill.items);
    setCustomer(bill.customer);
    setSalesStaff(bill.salesStaff);
    setSuspendedBills(prev => prev.filter(b => b.id !== bill.id));
    onNotification?.("Bill Restored", `Restored bill ${bill.billNo} to terminal.`, "success");
  };

  // Settlement Success
  const handleSettlementSuccess = (tenders: ProPosTenderSplit, changeDue: number) => {
    const generatedBillNo = `${billDocPrefix}-${billDocNumber}`;
    const billRecord = {
      billNo: generatedBillNo,
      billDate: new Date().toISOString().slice(0, 10),
      customer,
      salesStaff,
      items: cartItems,
      subTotal: grossSalesValue,
      discountTotal: itemDiscountsTotal,
      taxTotal: totalTaxAmount,
      netPayable: netPayableAmount,
      tenders,
      changeDue
    };

    setLastCompletedBill(billRecord);
    setShowSettlementModal(false);
    setShowReceiptModal(true);
    setCartItems([]);
    setBillDocNumber((prev) => (parseInt(prev) + 1).toString());
    onNotification?.("Invoice Finalized", `Invoice ${generatedBillNo} generated successfully!`, "success");
  };

  // --- Complete Global POS Keyboard Shortcuts ---
  useEffect(() => {
    const handleGlobalShortcuts = (e: KeyboardEvent) => {
      // Escape: Close open modals
      if (e.key === "Escape") {
        setShowHotkeysModal(false);
        setShowReprintModal(false);
        setShowCustomerBrowseModal(false);
        setShowPdtImportModal(false);
        setShowRecallModal(false);
        setShowCancelModal(false);
        setShowReturnModal(false);
        setShowSettlementModal(false);
        setShowReceiptModal(false);
        setShowLoyaltyModal(false);
        setShowCashMovementsModal(false);
        setShowShiftCloseModal(false);
        return;
      }

      if (e.altKey && e.key === "1") {
        e.preventDefault();
        handleNewBill();
      } else if (e.altKey && e.key === "2") {
        e.preventDefault();
        setShowCancelModal(true);
      } else if (e.altKey && e.key === "3") {
        e.preventDefault();
        setActiveActivity("RETURN");
        setShowReturnModal(true);
      } else if (e.altKey && e.key === "5") {
        e.preventDefault();
        setActiveActivity("RETURN_BLIND");
        setShowReturnModal(true);
      } else if (e.altKey && e.key === "6") {
        e.preventDefault();
        setShowReprintModal(true);
      } else if (e.altKey && (e.key === "d" || e.key === "D")) {
        e.preventDefault();
        setShowCashMovementsModal(true);
      } else if (e.altKey && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        setShowShiftCloseModal(true);
      } else if (e.altKey && (e.key === "h" || e.key === "H")) {
        e.preventDefault();
        setShowHotkeysModal(prev => !prev);
      } else if (e.altKey && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        handleHoldBill();
      } else if (e.altKey && (e.key === "r" || e.key === "R")) {
        e.preventDefault();
        setShowRecallModal(true);
      } else if (e.altKey && (e.key === "i" || e.key === "I")) {
        e.preventDefault();
        setShowPdtImportModal(true);
      } else if (e.key === "F2") {
        e.preventDefault();
        setShowCustomerBrowseModal(true);
      } else if (e.key === "F7") {
        e.preventDefault();
        if (cartItems.length > 0) {
          handleSettlementSuccess({
            cash: netPayableAmount,
            card: 0,
            upi: 0,
            giftVoucher: 0,
            loyaltyPointsRedeemed: 0,
            loyaltyAmount: 0,
            creditNote: 0
          }, 0);
        } else {
          onNotification?.("Empty Bill", "Please add items to bill before exact cash settlement [F7].", "error");
        }
      } else if (e.key === "F8") {
        e.preventDefault();
        if (cartItems.length > 0) {
          setShowSettlementModal(true);
        } else {
          onNotification?.("Empty Bill", "Please add items to bill before opening settlement [F8].", "error");
        }
      } else if (e.key === "F9") {
        e.preventDefault();
        setShowTotalsPanel(prev => !prev);
        onNotification?.("Totals Toggled", "Bill totals panel toggled [F9].", "info");
      } else if (e.key === "F10") {
        e.preventDefault();
        if (cartItems.length > 0) {
          setShowSettlementModal(true);
        } else {
          onNotification?.("Empty Bill", "Please add items to bill before print & pay [F10].", "error");
        }
      }
    };

    window.addEventListener("keydown", handleGlobalShortcuts);
    return () => window.removeEventListener("keydown", handleGlobalShortcuts);
  }, [cartItems, netPayableAmount, customer, salesStaff, billDocPrefix, billDocNumber]);

  const emptyRowsCount = Math.max(0, 10 - cartItems.length);

  return (
    <div className="h-full flex flex-col bg-[#f8f9fa] dark:bg-[#191c1e] text-[#191c1e] dark:text-[#eff1f3] overflow-hidden font-sans select-none">
      
      {/* ========================================================================= */}
      {/* 0. POS ACTIVITIES TOOLBAR RIBBON (Alt+1, Alt+2, Alt+3, Alt+5, Alt+6, etc.) */}
      {/* ========================================================================= */}
      <div className="bg-[#edeae1] dark:bg-[#131b2e] px-4 py-1.5 border-b border-[#c4c5d5] dark:border-[#444653] flex flex-wrap items-center justify-between gap-2 shrink-0">
        
        {/* Left: Standard POS Activities Buttons */}
        <div className="flex items-center gap-1.5">
          
          {/* Alt+1: New Bill */}
          <button
            type="button"
            onClick={handleNewBill}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-2xs border ${
              activeActivity === "BILLING"
                ? "bg-[#00288e] text-white border-[#00288e]"
                : "bg-white dark:bg-[#2d3133] border-[#c4c5d5] text-[#191c1d] dark:text-white hover:bg-[#f3f4f5]"
            }`}
            title="Create a new bill [Alt+1]"
          >
            <FilePlus size={13} />
            <span>New Bill</span>
            <kbd className="text-[10px] opacity-80 font-mono">[Alt+1]</kbd>
          </button>

          {/* Alt+2: Void / Cancel */}
          <button
            type="button"
            onClick={() => setShowCancelModal(true)}
            className="px-2.5 py-1 bg-white dark:bg-[#2d3133] border border-[#ba1a1a]/40 text-[#ba1a1a] hover:bg-[#ffdad6]/50 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
            title="Void / cancel a bill [Alt+2]"
          >
            <ShieldAlert size={13} />
            <span>Cancel Bill</span>
            <kbd className="text-[10px] opacity-80 font-mono">[Alt+2]</kbd>
          </button>

          {/* Alt+3: Sales Return with Ref */}
          <button
            type="button"
            onClick={() => {
              setActiveActivity("RETURN");
              setShowReturnModal(true);
            }}
            className="px-2.5 py-1 bg-white dark:bg-[#2d3133] border border-[#c4c5d5] hover:bg-[#f3f4f5] rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
            title="Record sales return with reference [Alt+3]"
          >
            <RotateCcw size={13} />
            <span>Return (Ref)</span>
            <kbd className="text-[10px] opacity-80 font-mono text-[#00288e]">[Alt+3]</kbd>
          </button>

          {/* Alt+5: Return without Ref */}
          <button
            type="button"
            onClick={() => {
              setActiveActivity("RETURN_BLIND");
              setShowReturnModal(true);
            }}
            className="px-2.5 py-1 bg-white dark:bg-[#2d3133] border border-[#c4c5d5] hover:bg-[#f3f4f5] rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
            title="Record sales return without reference [Alt+5]"
          >
            <RotateCcw size={13} />
            <span>Return w/o Ref</span>
            <kbd className="text-[10px] opacity-80 font-mono text-[#00288e]">[Alt+5]</kbd>
          </button>

          {/* Alt+6: Reprint Document */}
          <button
            type="button"
            onClick={() => setShowReprintModal(true)}
            className="px-2.5 py-1 bg-white dark:bg-[#2d3133] border border-[#c4c5d5] hover:bg-[#f3f4f5] rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
            title="Reprint a bill or sales return document [Alt+6]"
          >
            <Printer size={13} />
            <span>Reprint</span>
            <kbd className="text-[10px] opacity-80 font-mono text-[#00288e]">[Alt+6]</kbd>
          </button>

          {/* Alt+D: Cash Movements (Safe Drop & Till Expense) */}
          <button
            type="button"
            onClick={() => setShowCashMovementsModal(true)}
            className="px-2.5 py-1 bg-[#f0fdf4] dark:bg-[#14532d]/40 border border-[#86efac] text-[#166534] dark:text-[#86efac] hover:bg-[#dcfce7] rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
            title="Mid-shift Cash Drop to Safe or Petty Till Expense Disbursal [Alt+D]"
          >
            <Vault size={13} />
            <span>Cash Movements</span>
            <kbd className="text-[10px] opacity-80 font-mono text-[#166534] dark:text-[#86efac]">[Alt+D]</kbd>
          </button>

          {/* Alt+Z: Shift Close & Z-Report Reconciliation */}
          <button
            type="button"
            onClick={() => setShowShiftCloseModal(true)}
            className="px-2.5 py-1 bg-[#fef2f2] dark:bg-[#7f1d1d]/40 border border-[#fca5a5] text-[#991b1b] dark:text-[#fca5a5] hover:bg-[#fee2e2] rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
            title="Perform Physical Denomination Count & Finalize Shift Closeout [Alt+Z]"
          >
            <Lock size={13} />
            <span>Shift Close</span>
            <kbd className="text-[10px] opacity-80 font-mono text-[#991b1b] dark:text-[#fca5a5]">[Alt+Z]</kbd>
          </button>

        </div>

        {/* Right: Totals Toggle (F9) and Hotkeys Reference (Alt+H) */}
        <div className="flex items-center gap-1.5">
          
          <button
            type="button"
            onClick={() => setShowTotalsPanel(!showTotalsPanel)}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-2xs border ${
              showTotalsPanel
                ? "bg-[#dde1ff] text-[#00288e] border-[#00288e]"
                : "bg-white dark:bg-[#2d3133] border-[#c4c5d5] text-[#565e74]"
            }`}
            title="Display total values in bill [F9]"
          >
            <Calculator size={13} />
            <span>Bill Totals</span>
            <kbd className="text-[10px] font-mono">[F9]</kbd>
          </button>

          <button
            type="button"
            onClick={() => setShowHotkeysModal(true)}
            className="px-2.5 py-1 bg-[#00288e] text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-2xs hover:bg-[#1e40af]"
            title="Display list of hot keys [Alt+H]"
          >
            <HelpCircle size={13} />
            <span>Hot Keys</span>
            <kbd className="text-[10px] font-mono opacity-80">[Alt+H]</kbd>
          </button>

        </div>

      </div>

      {/* ========================================================================= */}
      {/* 1. HEADER GROUP: Bill Type, Tx Type, Doc Prefix, Customer, Staff, PDT    */}
      {/* ========================================================================= */}
      <section className="bg-white dark:bg-[#131b2e] px-5 py-2.5 border-b border-[#c4c5d5] dark:border-[#444653] shrink-0 flex flex-wrap gap-3 items-end shadow-xs">
        
        {/* Bill Type (Product / Service) */}
        <div className="flex flex-col gap-1 w-28">
          <label className="text-[10px] font-bold uppercase tracking-wider text-[#565e74] dark:text-[#bec6e0]">
            Bill Type
          </label>
          <select
            value={billType}
            onChange={e => setBillType(e.target.value as any)}
            className="border border-[#c4c5d5] dark:border-[#444653] rounded-lg px-2 h-8 text-xs font-semibold bg-white dark:bg-[#191c1e] text-[#191c1e] dark:text-white outline-none focus:border-[#00288e]"
          >
            <option value="Product">Product</option>
            <option value="Service">Service</option>
          </select>
        </div>

        {/* Transaction Type (Cash / Credit) */}
        <div className="flex flex-col gap-1 w-24">
          <label className="text-[10px] font-bold uppercase tracking-wider text-[#565e74] dark:text-[#bec6e0]">
            Tx Type
          </label>
          <select
            value={transactionType}
            onChange={e => setTransactionType(e.target.value as any)}
            className={`border rounded-lg px-2 h-8 text-xs font-bold outline-none ${
              transactionType === "Credit"
                ? "bg-[#dde1ff] text-[#00288e] border-[#00288e]"
                : "bg-white dark:bg-[#191c1e] text-[#191c1e] dark:text-white border-[#c4c5d5]"
            }`}
          >
            <option value="Cash">Cash</option>
            <option value="Credit">Credit</option>
          </select>
        </div>

        {/* Bill Doc Prefix & Number */}
        <div className="flex flex-col gap-1 w-32">
          <label className="text-[10px] font-bold uppercase tracking-wider text-[#565e74] dark:text-[#bec6e0]">
            Doc Prefix / No
          </label>
          <div className="flex gap-1">
            <input
              type="text"
              value={billDocPrefix}
              onChange={e => setBillDocPrefix(e.target.value)}
              className="w-12 border border-[#c4c5d5] dark:border-[#444653] rounded-lg px-1 h-8 text-xs font-mono font-bold bg-[#f3f4f5] dark:bg-[#2d3133] text-center outline-none"
            />
            <input
              type="text"
              readOnly
              value={billDocNumber}
              className="flex-1 border border-[#c4c5d5] dark:border-[#444653] rounded-lg px-2 h-8 text-xs font-mono font-bold bg-[#f3f4f5] dark:bg-[#2d3133] text-[#00288e] dark:text-[#a8b8ff] outline-none"
            />
          </div>
        </div>

        {/* Current Date & Time (Readonly) */}
        <div className="flex flex-col gap-1 w-36">
          <label className="text-[10px] font-bold uppercase tracking-wider text-[#565e74] dark:text-[#bec6e0]">
            Bill Date &amp; Time
          </label>
          <input
            type="text"
            readOnly
            value={currentDateTime}
            className="border border-[#c4c5d5] dark:border-[#444653] rounded-lg px-2 h-8 text-[11px] font-mono bg-[#f3f4f5] dark:bg-[#2d3133] text-[#565e74] dark:text-[#bec6e0] outline-none"
          />
        </div>

        {/* Customer Code & Name (with F2 Browse Window) */}
        <div className="flex flex-col gap-1 flex-1 min-w-[240px]">
          <div className="flex justify-between items-center">
            <label className="text-[10px] font-bold uppercase tracking-wider text-[#565e74] dark:text-[#bec6e0]">
              Customer Code &amp; Name
            </label>
            <button
              type="button"
              onClick={() => setShowCustomerBrowseModal(true)}
              className="text-[10px] font-bold text-[#00288e] dark:text-[#a8b8ff] hover:underline flex items-center gap-0.5"
            >
              <span>[F2] Browse</span>
            </button>
          </div>
          <div className="flex gap-1.5">
            <input
              type="text"
              name="posCustomerCode"
              aria-label="Customer Code"
              data-f2-browse="customer"
              value={customer.code}
              onChange={e => setCustomer(prev => ({ ...prev, code: e.target.value }))}
              onKeyDown={e => {
                if (e.key === "F2") {
                  e.preventDefault();
                  setShowCustomerBrowseModal(true);
                }
              }}
              placeholder="Code..."
              className="w-20 border border-[#c4c5d5] dark:border-[#444653] rounded-lg px-2 h-8 text-xs font-mono font-bold bg-white dark:bg-[#191c1e] outline-none focus:border-[#00288e]"
            />
            <input
              type="text"
              name="posCustomerName"
              aria-label="Customer Name"
              data-f2-browse="customer"
              value={customer.name}
              onChange={e => setCustomer(prev => ({ ...prev, name: e.target.value }))}
              onKeyDown={e => {
                if (e.key === "F2") {
                  e.preventDefault();
                  setShowCustomerBrowseModal(true);
                }
              }}
              placeholder="Customer Name..."
              className="flex-1 border border-[#c4c5d5] dark:border-[#444653] rounded-lg px-2.5 h-8 text-xs font-semibold bg-white dark:bg-[#191c1e] outline-none focus:border-[#00288e]"
            />
          </div>
        </div>

        {/* Live Tax Classification Badge */}
        <div className="flex flex-col gap-1 w-44">
          <label className="text-[10px] font-bold uppercase tracking-wider text-[#565e74] dark:text-[#bec6e0]">
            Tax Jurisdiction
          </label>
          <div className={`h-8 px-2 rounded-lg border flex items-center justify-between text-[11px] font-bold ${
            isB2B
              ? "bg-[#dde1ff] border-[#00288e] text-[#00288e] dark:bg-[#1e293b] dark:border-[#3b82f6] dark:text-[#93c5fd]"
              : "bg-[#dcfce7] border-[#16a34a] text-[#15803d] dark:bg-[#064e3b] dark:border-[#10b981] dark:text-[#6ee7b7]"
          }`}>
            <span className="flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${isB2B ? "bg-[#00288e] dark:bg-[#60a5fa]" : "bg-[#16a34a] dark:bg-[#34d399]"}`} />
              {isB2B ? "B2B" : "B2C"}
            </span>
            <span className="font-mono text-[10px]">
              {isInterstate ? `IGST (${posStateCode})` : `CGST+SGST (${posStateCode})`}
            </span>
          </div>
        </div>

        {/* Sales Staff ID */}
        <div className="flex flex-col gap-1 w-28">
          <label className="text-[10px] font-bold uppercase tracking-wider text-[#565e74] dark:text-[#bec6e0]">
            Sales Staff
          </label>
          <select
            value={salesStaff}
            onChange={e => {
              setSalesStaff(e.target.value);
              setDirectStaff(e.target.value);
            }}
            className="border border-[#c4c5d5] dark:border-[#444653] rounded-lg px-2 h-8 text-xs font-semibold bg-white dark:bg-[#191c1e] outline-none focus:border-[#00288e]"
          >
            <option value="SM1">SM1</option>
            <option value="SM2">SM2</option>
            <option value="SM3">SM3</option>
          </select>
        </div>

        {/* Header Action Buttons (PDT Import, Recall, Hold) */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowPdtImportModal(true)}
            className="h-8 px-2.5 border border-[#c4c5d5] dark:border-[#444653] rounded-lg bg-white dark:bg-[#2d3133] hover:bg-[#f3f4f5] transition text-xs font-bold flex items-center gap-1 shadow-2xs"
            title="Import PDT File or Transaction"
          >
            <UploadCloud size={13} />
            <span>Import</span>
          </button>

          <button
            type="button"
            onClick={() => setShowRecallModal(true)}
            className="h-8 px-2.5 border border-[#c4c5d5] dark:border-[#444653] rounded-lg bg-[#dde1ff] dark:bg-[#1e40af] text-[#00288e] dark:text-white hover:brightness-105 transition text-xs font-bold flex items-center gap-1 shadow-2xs"
          >
            <History size={13} />
            <span>Recall ({suspendedBills.length})</span>
          </button>

          <button
            type="button"
            onClick={handleHoldBill}
            disabled={cartItems.length === 0}
            className="h-8 px-2.5 border border-[#c4c5d5] dark:border-[#444653] rounded-lg bg-white dark:bg-[#2d3133] hover:bg-[#f3f4f5] transition text-xs font-bold flex items-center gap-1 shadow-2xs disabled:opacity-40"
          >
            <Pause size={13} />
            <span>Hold</span>
          </button>

        </div>

      </section>

      {/* ========================================================================= */}
      {/* 2. DETAIL GROUP: Item Details Grid (Top) + Direct Entry Grid (Bottom)     */}
      {/* ========================================================================= */}
      <main className="flex-1 flex flex-col md:flex-row overflow-hidden p-3 gap-3">
        
        {/* Left Side: Dual-Grid Workspace (Item Details + Direct Entry) */}
        <div className="flex-1 bg-white dark:bg-[#131b2e] border border-[#c4c5d5] dark:border-[#444653] rounded-xl overflow-hidden flex flex-col shadow-xs">
          
          {/* Top: Item Details Grid (Accepted Items) */}
          <div className="overflow-auto flex-1 bg-white dark:bg-[#131b2e]">
            <table className="w-full text-left border-collapse text-xs whitespace-nowrap min-w-[1020px]">
              <thead className="bg-[#edeae1] dark:bg-[#252836] sticky top-0 z-10 border-b border-[#c4c5d5] dark:border-[#444653] text-[11px] font-bold text-[#444653] dark:text-[#bec6e0]">
                <tr className="h-8">
                  <th className="px-3 border-r border-[#c4c5d5] dark:border-[#444653] w-36">Stock No</th>
                  <th className="px-3 border-r border-[#c4c5d5] dark:border-[#444653]">Item Description</th>
                  <th className="px-3 border-r border-[#c4c5d5] dark:border-[#444653] text-right w-24">Rate</th>
                  <th className="px-3 border-r border-[#c4c5d5] dark:border-[#444653] text-right w-20">Qty</th>
                  <th className="px-3 border-r border-[#c4c5d5] dark:border-[#444653] text-right w-24">Value</th>
                  <th className="px-3 border-r border-[#c4c5d5] dark:border-[#444653] text-center w-24">Disc Code</th>
                  <th className="px-3 border-r border-[#c4c5d5] dark:border-[#444653] text-right w-20">Disc Qty</th>
                  <th className="px-3 border-r border-[#c4c5d5] dark:border-[#444653] text-right w-20">Disc. %</th>
                  <th className="px-3 border-r border-[#c4c5d5] dark:border-[#444653] text-right w-24">Disc.Amt</th>
                  <th className="px-3 border-r border-[#c4c5d5] dark:border-[#444653] text-right w-24 font-bold text-[#191c1d] dark:text-white">Total</th>
                  <th className="px-3 border-r border-[#c4c5d5] dark:border-[#444653] text-center w-24">SalesStaff</th>
                  <th className="px-2 text-center w-10">Del</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eceef0] dark:divide-[#2d3133] font-mono text-[11px]">
                {cartItems.map((item, idx) => {
                  const isSelected = selectedRowIndex === idx;
                  return (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedRowIndex(idx)}
                      className={`h-7 cursor-pointer transition ${
                        isSelected
                          ? "bg-[#ffffcc] dark:bg-[#3a3a1a] text-black dark:text-yellow-200 font-semibold"
                          : "hover:bg-[#f8f9fa] dark:hover:bg-[#1d222e]"
                      }`}
                    >
                      <td className="px-3 border-r border-[#c4c5d5] dark:border-[#444653] font-bold">
                        {item.sku}
                      </td>
                      <td className="px-3 border-r border-[#c4c5d5] dark:border-[#444653] font-sans font-medium truncate max-w-[280px]">
                        {item.name}
                      </td>
                      <td className="px-3 border-r border-[#c4c5d5] dark:border-[#444653] text-right">
                        {item.unitPrice.toFixed(2)}
                      </td>
                      <td className="px-3 border-r border-[#c4c5d5] dark:border-[#444653] text-right font-bold">
                        {item.qty.toFixed(2)}
                      </td>
                      <td className="px-3 border-r border-[#c4c5d5] dark:border-[#444653] text-right">
                        {(item.unitPrice * item.qty).toFixed(2)}
                      </td>
                      <td className="px-3 border-r border-[#c4c5d5] dark:border-[#444653] text-center">
                        <span className="font-bold text-[10px]">{item.discCode || "ILD"}</span>
                      </td>
                      <td className="px-3 border-r border-[#c4c5d5] dark:border-[#444653] text-right font-bold text-[#00288e] dark:text-[#a8b8ff]">
                        {(item.discQty !== undefined ? item.discQty : item.qty).toFixed(2)}
                      </td>
                      <td className="px-3 border-r border-[#c4c5d5] dark:border-[#444653] text-right">
                        {item.discountPct.toFixed(2)}
                      </td>
                      <td className="px-3 border-r border-[#c4c5d5] dark:border-[#444653] text-right font-bold text-[#ba1a1a]">
                        {item.discountAmt.toFixed(2)}
                      </td>
                      <td className="px-3 border-r border-[#c4c5d5] dark:border-[#444653] text-right font-bold">
                        {item.lineTotal.toFixed(2)}
                      </td>
                      <td className="px-3 border-r border-[#c4c5d5] dark:border-[#444653] text-center">
                        {item.salesStaff}
                      </td>
                      <td className="px-2 text-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveItem(item.id);
                          }}
                          className="text-[#ba1a1a] hover:bg-[#ffdad6] p-0.5 rounded transition"
                          title="Remove Row"
                        >
                          <Trash2 size={11} />
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {/* Empty Filler Rows */}
                {Array.from({ length: emptyRowsCount }).map((_, i) => (
                  <tr key={`empty-${i}`} className="h-7 border-b border-[#eceef0] dark:border-[#2d3133]">
                    <td className="border-r border-[#c4c5d5] dark:border-[#444653]"></td>
                    <td className="border-r border-[#c4c5d5] dark:border-[#444653]"></td>
                    <td className="border-r border-[#c4c5d5] dark:border-[#444653]"></td>
                    <td className="border-r border-[#c4c5d5] dark:border-[#444653]"></td>
                    <td className="border-r border-[#c4c5d5] dark:border-[#444653]"></td>
                    <td className="border-r border-[#c4c5d5] dark:border-[#444653]"></td>
                    <td className="border-r border-[#c4c5d5] dark:border-[#444653]"></td>
                    <td className="border-r border-[#c4c5d5] dark:border-[#444653]"></td>
                    <td className="border-r border-[#c4c5d5] dark:border-[#444653]"></td>
                    <td className="border-r border-[#c4c5d5] dark:border-[#444653]"></td>
                    <td className="border-r border-[#c4c5d5] dark:border-[#444653]"></td>
                    <td></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Bottom: Direct Entry Grid Header & Input Strip */}
          <div className="border-t-2 border-[#a4a5b5] dark:border-[#5c5d6c] bg-[#edeae1] dark:bg-[#252836] shrink-0 shadow-sm relative">
            
            {/* Live Selected Item Multi-Attribute Inspection Ribbon */}
            {selectedProductMeta && (
              <div className="bg-[#e8edff] dark:bg-[#1a233b] border-b border-[#c4c5d5] dark:border-[#3b4252] px-3 py-1 flex items-center justify-between text-[11px] font-sans">
                <div className="flex items-center gap-3 overflow-x-auto text-[#00288e] dark:text-[#93c5fd]">
                  <span className="font-bold flex items-center gap-1">
                    <Barcode size={13} /> {selectedProductMeta.barcode}
                  </span>
                  <span>•</span>
                  <span><strong>Stock/SKU:</strong> {selectedProductMeta.stockNo || selectedProductMeta.sku}</span>
                  <span>•</span>
                  <span><strong>Stock:</strong> <span className="font-bold font-mono">{selectedProductMeta.stockQty} {selectedProductMeta.uom}</span></span>
                  <span>•</span>
                  <span><strong>MRP:</strong> ₹{selectedProductMeta.mrp.toFixed(2)}</span>
                  <span>•</span>
                  <span><strong>Cost:</strong> ₹{selectedProductMeta.costPrice.toFixed(2)}</span>
                  <span>•</span>
                  <span><strong>Size/Color:</strong> {selectedProductMeta.size}/{selectedProductMeta.color}</span>
                  <span>•</span>
                  <span><strong>Brand:</strong> {selectedProductMeta.brand}</span>
                  <span>•</span>
                  <span><strong>HSN:</strong> {selectedProductMeta.hsnCode} ({selectedProductMeta.gstPercentage}%)</span>
                </div>
                <button 
                  type="button" 
                  onClick={() => setSelectedProductMeta(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xs px-1"
                  title="Dismiss inspector"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Direct Entry Header Row (Exact Column Headers) */}
            <div className="grid grid-cols-12 text-[11px] font-bold text-[#444653] dark:text-[#bec6e0] border-b border-[#c4c5d5] dark:border-[#444653] py-1 px-1 bg-[#e4e1d7] dark:bg-[#1d202d] min-w-[1020px]">
              <div className="col-span-2 px-2 border-r border-[#c4c5d5] dark:border-[#444653]">Barcode / Scan</div>
              <div className="col-span-2 px-2 border-r border-[#c4c5d5] dark:border-[#444653]">Stock No / SKU</div>
              <div className="col-span-2 px-2 border-r border-[#c4c5d5] dark:border-[#444653]">Item Description</div>
              <div className="col-span-1 px-2 border-r border-[#c4c5d5] dark:border-[#444653] text-right">Rate</div>
              <div className="col-span-1 px-2 border-r border-[#c4c5d5] dark:border-[#444653] text-right">Qty</div>
              <div className="col-span-1 px-2 border-r border-[#c4c5d5] dark:border-[#444653] text-right">Value</div>
              <div className="col-span-1 px-2 border-r border-[#c4c5d5] dark:border-[#444653] text-center">Disc Code</div>
              <div className="col-span-1 px-2 border-r border-[#c4c5d5] dark:border-[#444653] text-right text-[#00288e] dark:text-[#a8b8ff]">Disc Qty</div>
              <div className="col-span-1 px-2 border-r border-[#c4c5d5] dark:border-[#444653] text-right">Disc. %</div>
            </div>

            {/* Direct Entry Interactive Inputs */}
            <div className="grid grid-cols-12 p-1.5 gap-1.5 items-center bg-[#edeae1] dark:bg-[#252836] min-w-[1020px]">
              
              {/* Barcode No Input with Live Typeahead */}
              <div className="col-span-2 relative">
                <input
                  ref={directBarcodeRef}
                  type="text"
                  value={directBarcode}
                  onChange={e => {
                    setDirectBarcode(e.target.value);
                    handleItemLiveSearch(e.target.value, "barcode");
                  }}
                  onKeyDown={e => handleItemInputKeyDown(e, "barcode")}
                  placeholder="Scan Barcode No..."
                  className="w-full h-8 px-2 bg-white dark:bg-[#131b2e] border-2 border-blue-600/60 dark:border-blue-500/60 rounded text-xs font-mono font-bold outline-none focus:border-[#00288e] focus:ring-1 focus:ring-[#00288e]"
                />
                {activeSearchField === "barcode" && (
                  <SmritiItemTypeaheadDropdown
                    isOpen={isProductSearchOpen}
                    items={productSuggestions}
                    selectedIndex={selectedSuggestionIdx}
                    onSelect={handleSelectProductSuggestion}
                    onClose={() => setIsProductSearchOpen(false)}
                    isLoading={isProductSearching}
                    searchFieldType="barcode"
                    anchorRef={directBarcodeRef}
                  />
                )}
              </div>

              {/* Stock No / SKU Input with Live Typeahead */}
              <div className="col-span-2 relative">
                <input
                  ref={directStockNoRef}
                  type="text"
                  value={directStockNo}
                  onChange={e => {
                    setDirectStockNo(e.target.value);
                    handleItemLiveSearch(e.target.value, "stockNo");
                  }}
                  onKeyDown={e => handleItemInputKeyDown(e, "stockNo")}
                  placeholder="Stock No / SKU..."
                  className="w-full h-8 px-2 bg-white dark:bg-[#131b2e] border border-[#a4a5b5] dark:border-[#5c5d6c] rounded text-xs font-mono font-bold outline-none focus:border-[#00288e] focus:ring-1 focus:ring-[#00288e]"
                />
                {activeSearchField === "stockNo" && (
                  <SmritiItemTypeaheadDropdown
                    isOpen={isProductSearchOpen}
                    items={productSuggestions}
                    selectedIndex={selectedSuggestionIdx}
                    onSelect={handleSelectProductSuggestion}
                    onClose={() => setIsProductSearchOpen(false)}
                    isLoading={isProductSearching}
                    searchFieldType="stockNo"
                    anchorRef={directStockNoRef}
                  />
                )}
              </div>

              {/* Item Description Input */}
              <div className="col-span-2">
                <input
                  type="text"
                  value={directDescription}
                  onChange={e => setDirectDescription(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleAcceptDirectEntryItem()}
                  placeholder="Item Description..."
                  className="w-full h-8 px-2 bg-white dark:bg-[#131b2e] border border-[#a4a5b5] dark:border-[#5c5d6c] rounded text-xs font-sans outline-none focus:border-[#00288e]"
                />
              </div>

              {/* Rate Input */}
              <div className="col-span-1">
                <input
                  type="text"
                  value={directRate}
                  onChange={e => handleRateOrQtyChange(e.target.value, directQty)}
                  onKeyDown={e => e.key === "Enter" && handleAcceptDirectEntryItem()}
                  className="w-full h-8 px-1.5 bg-white dark:bg-[#131b2e] border border-[#a4a5b5] dark:border-[#5c5d6c] rounded text-xs font-mono font-bold text-right outline-none focus:border-[#00288e]"
                />
              </div>

              {/* Qty Input */}
              <div className="col-span-1">
                <input
                  type="text"
                  value={directQty}
                  onChange={e => handleRateOrQtyChange(directRate, e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleAcceptDirectEntryItem()}
                  className="w-full h-8 px-1.5 bg-white dark:bg-[#131b2e] border border-[#a4a5b5] dark:border-[#5c5d6c] rounded text-xs font-mono font-bold text-right outline-none focus:border-[#00288e]"
                />
              </div>

              {/* Computed Value (Readonly) */}
              <div className="col-span-1">
                <input
                  type="text"
                  readOnly
                  value={directValue.toFixed(2)}
                  className="w-full h-8 px-1.5 bg-[#e4e1d7] dark:bg-[#1d202d] border border-[#a4a5b5] dark:border-[#5c5d6c] rounded text-xs font-mono text-right text-gray-700 dark:text-gray-300 outline-none"
                />
              </div>

              {/* Disc Code Select */}
              <div className="col-span-1">
                <select
                  value={directDiscCode}
                  onChange={e => setDirectDiscCode(e.target.value)}
                  className="w-full h-8 px-1 bg-white dark:bg-[#131b2e] border border-[#a4a5b5] dark:border-[#5c5d6c] rounded text-[11px] font-bold outline-none focus:border-[#00288e]"
                >
                  <option value="ILD">ILD</option>
                  <option value="B2G1">B2G1</option>
                  <option value="SCHEME">SCHEME</option>
                  <option value="NONE">NONE</option>
                </select>
              </div>

              {/* Disc Qty Input (Drives Discount Eligible Units!) */}
              <div className="col-span-1">
                <input
                  type="text"
                  value={directDiscQty}
                  onChange={e => handleDiscQtyChange(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleAcceptDirectEntryItem()}
                  placeholder="Disc Qty"
                  className="w-full h-8 px-1.5 bg-white dark:bg-[#131b2e] border-2 border-[#00288e] rounded text-xs font-mono font-bold text-right text-[#00288e] dark:text-[#a8b8ff] outline-none"
                  title="Quantity eligible for discount"
                />
              </div>

              {/* Disc % Input (Updates Disc.Amt) */}
              <div className="col-span-1">
                <input
                  type="text"
                  value={directDiscPct}
                  onChange={e => handleDiscPctChange(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleAcceptDirectEntryItem()}
                  placeholder="%"
                  className="w-full h-8 px-1.5 bg-white dark:bg-[#131b2e] border border-[#a4a5b5] dark:border-[#5c5d6c] rounded text-xs font-mono font-bold text-right outline-none focus:border-[#00288e]"
                />
              </div>

              {/* Disc.Amt Input (Updates Disc. %) */}
              <div className="col-span-1">
                <input
                  type="text"
                  value={directDiscAmtInput}
                  onChange={e => handleDiscAmtChange(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleAcceptDirectEntryItem()}
                  placeholder="₹ Amt"
                  className="w-full h-8 px-1.5 bg-white dark:bg-[#131b2e] border border-[#00288e] rounded text-xs font-mono font-bold text-right text-[#ba1a1a] outline-none focus:ring-1 focus:ring-[#00288e]"
                />
              </div>

              {/* Computed Net Total (Readonly) */}
              <div className="col-span-1">
                <input
                  type="text"
                  readOnly
                  value={directTotal.toFixed(2)}
                  className="w-full h-8 px-1.5 bg-[#e4e1d7] dark:bg-[#1d202d] border border-[#a4a5b5] dark:border-[#5c5d6c] rounded text-xs font-mono font-bold text-right text-[#191c1d] dark:text-white outline-none"
                />
              </div>

              {/* Action: Accept Item */}
              <div className="col-span-1 flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleAcceptDirectEntryItem}
                  className="w-full h-8 bg-[#00288e] hover:bg-[#1e40af] text-white text-xs font-bold rounded flex items-center justify-center gap-1 shadow-xs transition active:scale-95"
                  title="Accept into Item Details Grid [Enter]"
                >
                  <CornerDownLeft size={13} />
                  <span>Accept</span>
                </button>
              </div>

            </div>

          </div>

        </div>

        {/* Right Side: Exclusive Net Values Summary Panel (Shoper 9 Specification, Toggle with F9) */}
        {showTotalsPanel && (
          <div className="w-full md:w-64 bg-white dark:bg-[#131b2e] border border-[#c4c5d5] dark:border-[#444653] rounded-xl p-3 flex flex-col gap-2 shrink-0 shadow-xs">
            <div className="flex justify-between items-center pb-2 border-b border-[#c4c5d5] dark:border-[#444653]">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#565e74] dark:text-[#bec6e0]">
                Description
              </span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#565e74] dark:text-[#bec6e0]">
                Net Values
              </span>
            </div>

            <div className="space-y-1.5 font-mono text-xs">
              <div className="flex justify-between items-center">
                <span className="bg-[#f3f4f5] dark:bg-[#2d3133] px-2 py-0.5 rounded text-[10px] font-bold text-[#565e74]">
                  Sales
                </span>
                <span className="font-bold text-[#191c1d] dark:text-white">
                  ₹{grossSalesValue.toFixed(2)}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="bg-[#f3f4f5] dark:bg-[#2d3133] px-2 py-0.5 rounded text-[10px] font-bold text-[#ba1a1a]">
                  Discounts
                </span>
                <span className="font-bold text-[#ba1a1a]">
                  -₹{itemDiscountsTotal.toFixed(2)}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="bg-[#f3f4f5] dark:bg-[#2d3133] px-2 py-0.5 rounded text-[10px] font-bold text-[#565e74]">
                  Sales Tax
                </span>
                <span className="font-bold text-[#191c1d] dark:text-white">
                  ₹{totalTaxAmount.toFixed(2)}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="bg-[#f3f4f5] dark:bg-[#2d3133] px-2 py-0.5 rounded text-[10px] font-bold text-[#565e74]">
                  Addon-Gen
                </span>
                <span className="font-bold text-[#191c1d] dark:text-white">
                  ₹0.00
                </span>
              </div>

              <div className="flex justify-between items-center pb-2 border-b border-[#eceef0] dark:border-[#444653]">
                <span className="bg-[#f3f4f5] dark:bg-[#2d3133] px-2 py-0.5 rounded text-[10px] font-bold text-[#ba1a1a]">
                  Dedns-Gen
                </span>
                <span className="font-bold text-[#ba1a1a]">
                  -₹0.00
                </span>
              </div>

              <div className="flex justify-between items-center pt-1 text-sm font-bold text-[#00288e] dark:text-[#a8b8ff]">
                <span>Net Payable</span>
                <span className="text-base font-bold">₹{netPayableAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* ========================================================================= */}
      {/* 3. FOOTER GROUP: Totals Dashboard Ribbon + Shortcuts & Fast Tenders      */}
      {/* ========================================================================= */}
      <footer className="bg-white dark:bg-[#131b2e] border-t border-[#c4c5d5] dark:border-[#444653] shadow-lg flex flex-col p-3 w-full shrink-0 gap-2.5">
        
        {/* Totals KPI Dashboard Ribbon */}
        <div className="grid grid-cols-2 md:grid-cols-9 gap-1 bg-[#f8f9fa] dark:bg-[#1d222e] border border-[#c4c5d5] dark:border-[#444653] rounded-xl overflow-hidden divide-x divide-[#c4c5d5] dark:divide-[#444653] text-center">
          
          <div className="flex flex-col p-1.5 bg-[#f3f4f5] dark:bg-[#191c1e]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#565e74] dark:text-[#bec6e0]">Total Items</span>
            <span className="text-base font-mono font-bold text-[#191c1d] dark:text-white">{totalItemsCount}</span>
          </div>

          <div className="flex flex-col p-1.5 bg-[#f3f4f5] dark:bg-[#191c1e]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#565e74] dark:text-[#bec6e0]">Total Qty.</span>
            <span className="text-base font-mono font-bold text-[#191c1d] dark:text-white">{totalQuantity.toFixed(2)}</span>
          </div>

          <div className="flex flex-col p-1.5 bg-white dark:bg-[#2d3133] col-span-2 text-right px-4 justify-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#565e74] dark:text-[#bec6e0]">Sales Value</span>
            <span className="text-lg font-mono font-bold text-[#191c1d] dark:text-white">₹{grossSalesValue.toFixed(2)}</span>
          </div>

          <div className="flex flex-col p-1.5 bg-[#f3f4f5] dark:bg-[#191c1e] text-right px-3 justify-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#ba1a1a]">Item Disc</span>
            <span className="text-sm font-mono font-bold text-[#ba1a1a]">-₹{itemDiscountsTotal.toFixed(2)}</span>
          </div>

          <div className="flex flex-col p-1.5 bg-[#f3f4f5] dark:bg-[#191c1e] text-right px-3 justify-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#565e74] dark:text-[#bec6e0]">Total Tax</span>
            <span className="text-sm font-mono font-bold text-[#191c1d] dark:text-white">₹{totalTaxAmount.toFixed(2)}</span>
          </div>

          <div className="flex flex-col p-1.5 bg-[#f3f4f5] dark:bg-[#191c1e] text-right px-3 justify-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#565e74] dark:text-[#bec6e0]">Addons</span>
            <span className="text-sm font-mono font-bold text-[#191c1d] dark:text-white">₹0.00</span>
          </div>

          <div className="flex flex-col p-1.5 bg-[#00288e] text-white col-span-2 text-right px-5 justify-center border-l-4 border-[#1e40af] shadow-inner">
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">Net Amount</span>
            <span className="text-2xl font-mono font-bold tracking-tight">₹{netPayableAmount.toFixed(2)}</span>
          </div>

        </div>

        {/* Shortcuts & Action Triggers */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-3">
          <span className="text-[11px] font-bold text-[#565e74] dark:text-[#bec6e0]">
            ProPOS Activities: [Alt+1: New Bill, Alt+2: Void, Alt+3: Return, Alt+5: Return w/o Ref, Alt+6: Reprint, Alt+H: Hotkeys, F7: Cash, F8: Settle].
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={cartItems.length === 0}
              onClick={() => {
                handleSettlementSuccess({
                  cash: netPayableAmount,
                  card: 0,
                  upi: 0,
                  giftVoucher: 0,
                  loyaltyPointsRedeemed: 0,
                  loyaltyAmount: 0,
                  creditNote: 0
                }, 0);
              }}
              className="bg-[#e7e8e9] dark:bg-[#2d3133] hover:bg-[#d9dadb] dark:hover:bg-[#3f465c] text-xs font-bold px-4 py-2 rounded-xl transition flex items-center gap-1.5 disabled:opacity-40 active:scale-95"
            >
              <span className="text-[#00288e] dark:text-[#a8b8ff] font-mono">[F7]</span>
              <span>Exact Cash</span>
            </button>

            <button
              type="button"
              disabled={cartItems.length === 0}
              onClick={() => setShowSettlementModal(true)}
              className="bg-[#dde1ff] dark:bg-[#1e40af] text-[#00288e] dark:text-white hover:brightness-105 text-xs font-bold px-5 py-2 rounded-xl transition flex items-center gap-1.5 disabled:opacity-40 active:scale-95 shadow-xs"
            >
              <span className="font-mono">[F8]</span>
              <span>Settlement</span>
            </button>

            <button
              type="button"
              disabled={cartItems.length === 0}
              onClick={() => setShowSettlementModal(true)}
              className="bg-[#00288e] hover:bg-[#1e40af] text-white text-xs font-bold px-6 py-2 rounded-xl transition flex items-center gap-2 shadow-md disabled:opacity-40 active:scale-95"
            >
              <Printer size={15} />
              <span className="opacity-80 font-mono">[F10]</span>
              <span>Print &amp; Pay</span>
            </button>
          </div>
        </div>

      </footer>

      {/* ========================================================================= */}
      {/* 4. MODALS & POPUPS (Customer Browse, PDT Import, Recall, Void, Settle)    */}
      {/* ========================================================================= */}
      {showHotkeysModal && (
        <SmritiProPosHotkeysDlg
          onClose={() => setShowHotkeysModal(false)}
        />
      )}

      {showReprintModal && (
        <SmritiProPosReprintDlg
          onReprintBill={(docType, docNo) => {
            onNotification?.("Document Reprinted", `${docType} #${docNo} sent to thermal printer.`, "success");
          }}
          onClose={() => setShowReprintModal(false)}
        />
      )}

      {showCustomerBrowseModal && (
        <SmritiCustomerBrowseModal
          onSelectCustomer={(c) => {
            setCustomer(c);
            onNotification?.("Customer Selected", `${c.name} (${c.code}) loaded.`, "success");
          }}
          onClose={() => setShowCustomerBrowseModal(false)}
        />
      )}

      {showPdtImportModal && (
        <SmritiPdtImportDlg
          onImportItems={handlePdtImportSuccess}
          onClose={() => setShowPdtImportModal(false)}
        />
      )}

      {showSettlementModal && (
        <SmritiPosSettlement
          netAmount={netPayableAmount}
          customer={customer}
          onSettle={handleSettlementSuccess}
          onClose={() => setShowSettlementModal(false)}
        />
      )}

      {showRecallModal && (
        <SmritiProPosRecallDlg
          suspendedBills={suspendedBills}
          onRecallBill={handleRecallBill}
          onDeleteSuspendedBill={(id) => setSuspendedBills(prev => prev.filter(b => b.id !== id))}
          onClose={() => setShowRecallModal(false)}
        />
      )}

      {showCancelModal && (
        <SmritiProPosCancelDlg
          onCancelBill={(rec) => {
            onNotification?.("Invoice Cancelled", `Bill ${rec.billNo} voided successfully.`, "info");
          }}
          onClose={() => setShowCancelModal(false)}
        />
      )}

      {showLoyaltyModal && (
        <SmritiLoyaltyLookupDlgpModal
          currentCustomer={customer}
          onSelectCustomer={(c) => setCustomer(c)}
          onApplyLoyaltyPoints={(pts, amt) => {
            onNotification?.("Loyalty Redeemed", `${pts} points (₹${amt}) applied to transaction.`, "success");
          }}
          onClose={() => setShowLoyaltyModal(false)}
        />
      )}

      {showReturnModal && (
        <SmritiProPosSalesReturnModal
          onProcessReturn={(ret) => {
            onNotification?.("Return Processed", `Credit Note for ₹${ret.totalRefund.toFixed(2)} generated.`, "success");
          }}
          onClose={() => setShowReturnModal(false)}
        />
      )}

      {showReceiptModal && lastCompletedBill && (
        <SmritiProPosTaxInvoiceReceipt
          billNo={lastCompletedBill.billNo}
          billDate={lastCompletedBill.billDate}
          customer={lastCompletedBill.customer}
          salesStaff={lastCompletedBill.salesStaff}
          items={lastCompletedBill.items}
          subTotal={lastCompletedBill.subTotal}
          discountTotal={lastCompletedBill.discountTotal}
          taxTotal={lastCompletedBill.taxTotal}
          netPayable={lastCompletedBill.netPayable}
          tenders={lastCompletedBill.tenders}
          changeDue={lastCompletedBill.changeDue}
          onClose={() => setShowReceiptModal(false)}
        />
      )}

      {showCashMovementsModal && (
        <SmritiProPosCashMovementsModal
          shiftId={activeShiftId}
          onSuccess={(mov) => {
            onNotification?.(
              "Movement Recorded",
              `${mov.type === "CASH_DROP" ? "Cash Drop" : "Till Expense"} of ₹${mov.amount.toFixed(2)} posted.`,
              "success"
            );
          }}
          onClose={() => setShowCashMovementsModal(false)}
          onNotification={onNotification}
        />
      )}

      {showShiftCloseModal && (
        <SmritiProPosShiftCloseModal
          shiftId={activeShiftId}
          onShiftClosed={(zRep) => {
            onNotification?.(
              "Register Closed",
              `Shift ${zRep.shift_code || activeShiftId} successfully closed and reconciled.`,
              "success"
            );
          }}
          onClose={() => setShowShiftCloseModal(false)}
          onNotification={onNotification}
        />
      )}

    </div>
  );
};

export default SmritiProPosBillinginal;
