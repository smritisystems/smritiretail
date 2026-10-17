/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.90.0
 * Created      : 2026-10-17
 * Modified     : 2026-10-17
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Canonical SMRITI Billing Studio Component
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Product, POSProfile, Shift, Customer } from "../../types.ts";
import {
  ProPosCartItem,
  ProPosCustomer,
  POSTenderItem,
} from "./propos/types.ts";
import { calculateGST, parseAndValidateGSTIN, GST_STATE_MAP } from "../../utils/gstEngine.ts";
import { SmritiPosParkedCartService, ParkedCartRecord } from "../../services/smritiPosParkedCartService.ts";
import { ProPosOfflineSyncEngine } from "../../sync/ProPosOfflineSyncEngine.ts";
import { apiFetchV1 } from "../../lib/apiFetchV1.ts";
import { recordAuditAction } from "../../lib/apiFetch";
import { SmritiF2AdvancedItemSearch, SmritiF2SelectedItem } from "./SmritiF2AdvancedItemSearch.tsx";
import { BulkAddItemsModal } from "./modals/BulkAddItemsModal.tsx";
import { BillingProfileSetupModal } from "./modals/BillingProfileSetupModal.tsx";
import { BillingProfileConfigModal } from "./modals/BillingProfileConfigModal.tsx";
import {
  Barcode,
  Search,
  ShoppingCart,
  User,
  UserPlus,
  Plus,
  Minus,
  Trash2,
  CreditCard,
  Banknote,
  QrCode,
  Printer,
  Share2,
  CheckCircle2,
  X,
  Building2,
  ChevronDown,
  ChevronRight,
  Layers,
  Check,
  Settings,
  Keyboard as KeyboardIcon,
  Filter,
  Sliders,
  Pencil,
  Percent,
  Lock,
  Volume2,
  VolumeX,
  AlertTriangle,
  FileSpreadsheet,
} from "lucide-react";

export type BillingStudioMode = "RETAIL_POS" | "CREDIT_BILLING" | "B2B_DISTRIBUTOR";
export type BillingStep = "CUSTOMER" | "SCAN" | "CART" | "REVIEW" | "PAYMENT" | "COMPLETE";
export type ScanMode = "AUTO_ADD" | "EDIT_THEN_ADD" | "CONFIRM_PRODUCT";
export type PostScanFocus = "scan_field" | "qty" | "rate" | "discount" | "salesperson";
export type DuplicateBarcodeAction = "increment_qty" | "add_new_row" | "prompt";

export interface SmritiBillingStudioProps {
  products?: Product[];
  customers?: Customer[];
  profiles?: POSProfile[];
  shifts?: Shift[];
  currentUser?: { role: string; name: string; companyId?: string; branchId?: string; username?: string } | null;
  mode?: BillingStudioMode;
  onModeChange?: (mode: BillingStudioMode) => void;
  onNotification?: (title: string, msg: string, type: "success" | "error" | "info" | "warning") => void;
  onRefreshData?: () => void;
  shiftId?: string;
  isStandaloneTab?: boolean;
}

export const WALK_IN_CUSTOMER: ProPosCustomer = {
  id: "CUST-WALKIN",
  code: "WALKIN",
  name: "Walk-in Retail Customer",
  phone: "9999999999",
  registrationType: "UNREGISTERED",
  stateCode: "27", // Default local state (Maharashtra)
  stateName: "Maharashtra",
  creditLimit: 0,
  currentBalance: 0,
  loyaltyPoints: 0,
};

// Canonical Reliance Retail demo customer matching screenshot
export const DEMO_RELIANCE_CUSTOMER: ProPosCustomer = {
  id: "cust-rrl-192b561d",
  code: "RRL-001",
  name: "Reliance Retail Limited",
  phone: "9876543210",
  gstin: "27AABCR1718E1ZL",
  registrationType: "REGISTERED",
  stateCode: "27",
  stateName: "Maharashtra",
  creditLimit: 250000,
  currentBalance: 12400,
  loyaltyPoints: 340,
};

export const DEMO_STORES = [
  { id: "cdl-c64f6f2fec8a1d4e0a656483", code: "S4NN/8319", name: "Reliance - Andheri (AND)" },
  { id: "cdl-e60327e0", code: "TEST-MUM-001", name: "Reliance - Bandra (BAN)" },
  { id: "cdl-a0550ba334c04bb28966a1a4", code: "V051", name: "Reliance - Thane (THA)" },
];

export const DEMO_SALESPERSONS = [
  "Amit Patil",
  "Reshma",
  "Anita",
  "John Doe",
  "Cashier Lead",
];

// Initial demo cart items from visual specification
export const INITIAL_DEMO_CART_ITEMS: ProPosCartItem[] = [
  {
    id: "CART-01",
    productId: "P-SND-18-36",
    itemNo: 1,
    sku: "SND-18-36",
    barcode: "8901234567890",
    name: "Regular Sandal",
    size: "36",
    color: "BEIGE",
    brand: "SND-18",
    salesStaff: "Amit",
    qty: 1,
    mrp: 750,
    unitPrice: 750,
    discountPct: 0,
    discountAmt: 0,
    taxPct: 5,
    taxAmt: 35.71,
    isTaxInclusive: true,
    hsnCode: "6403",
    lineTotal: 750,
  },
  {
    id: "CART-02",
    productId: "P-SND-18-37",
    itemNo: 2,
    sku: "SND-18-37",
    barcode: "8901234567891",
    name: "Regular Sandal",
    size: "37",
    color: "BEIGE",
    brand: "SND-18",
    salesStaff: "Amit",
    qty: 2,
    mrp: 750,
    unitPrice: 750,
    discountPct: 5,
    discountAmt: 75,
    taxPct: 5,
    taxAmt: 67.86,
    isTaxInclusive: true,
    hsnCode: "6403",
    lineTotal: 1425,
  },
  {
    id: "CART-03",
    productId: "P-SPL-22-42",
    itemNo: 3,
    sku: "SPL-22-42",
    barcode: "8901234567893",
    name: "Sport Shoe",
    size: "42",
    color: "WHITE",
    brand: "SPL-22",
    salesStaff: "Reshma",
    qty: 1,
    mrp: 1200,
    unitPrice: 1200,
    discountPct: 0,
    discountAmt: 0,
    taxPct: 5,
    taxAmt: 57.14,
    isTaxInclusive: true,
    hsnCode: "6404",
    lineTotal: 1200,
  },
];

/**
 * Pure Canonical Calculation Engine
 * Computes exact subtotal, item discounts, bill discount, GST, and rounded payable amount
 */
export function computeBillingTotals(
  items: ProPosCartItem[],
  billDiscountVal: number = 0,
  billDiscountType: "FLAT" | "PERCENT" = "FLAT",
  storeStateCode: string = "27",
  customerStateCode: string = "27"
) {
  let grossTotal = 0;
  let totalItemDiscounts = 0;
  let totalTaxable = 0;
  let totalTax = 0;
  let totalCgst = 0;
  let totalSgst = 0;
  let totalIgst = 0;

  const isInterstate = Boolean(
    customerStateCode &&
    customerStateCode.trim() !== "" &&
    customerStateCode.trim() !== storeStateCode
  );

  const recomputedItems = items.map((item) => {
    const itemGross = item.qty * item.unitPrice;
    const itemDisc = item.discountAmt || (item.discountPct ? (itemGross * item.discountPct) / 100 : 0);
    const taxParams = {
      unitPrice: item.unitPrice,
      quantity: item.qty,
      discountAmount: itemDisc,
      gstRate: item.taxPct,
      isTaxInclusive: item.isTaxInclusive ?? true,
      isInterstate,
    };
    const taxRes = calculateGST(taxParams);

    grossTotal += itemGross;
    totalItemDiscounts += itemDisc;
    totalTaxable += taxRes.taxableValue;
    totalTax += taxRes.taxAmount;
    totalCgst += taxRes.cgstAmount;
    totalSgst += taxRes.sgstAmount;
    totalIgst += taxRes.igstAmount;

    return {
      ...item,
      lineTotal: taxRes.totalAmount,
      taxAmt: taxRes.taxAmount,
      taxableValue: taxRes.taxableValue,
      cgstAmount: taxRes.cgstAmount,
      sgstAmount: taxRes.sgstAmount,
      igstAmount: taxRes.igstAmount,
    };
  });

  const subtotal = grossTotal - totalItemDiscounts;
  const calculatedBillDiscount = billDiscountType === "PERCENT"
    ? (subtotal * billDiscountVal) / 100
    : billDiscountVal;

  const isAllTaxInclusive = items.length === 0 || items.every((it) => it.isTaxInclusive !== false);
  const netBeforeRound = isAllTaxInclusive
    ? Math.max(0, subtotal - calculatedBillDiscount)
    : Math.max(0, subtotal - calculatedBillDiscount + totalTax);

  const netPayable = Math.round(netBeforeRound * 100) / 100;
  const roundOff = Math.round((Math.round(netPayable) - netPayable) * 100) / 100;
  const totalQty = items.reduce((sum, item) => sum + item.qty, 0);

  return {
    recomputedItems,
    grossTotal,
    subtotal,
    totalItemDiscounts,
    billDiscount: calculatedBillDiscount,
    totalTaxable,
    totalTax,
    totalCgst,
    totalSgst,
    totalIgst,
    roundOff,
    netPayable,
    totalQty,
    itemCount: items.length,
    isInterstate,
  };
}

export const SmritiBillingStudio: React.FC<SmritiBillingStudioProps> = ({
  products = [],
  customers = [],
  profiles = [],
  shifts = [],
  currentUser,
  mode = "RETAIL_POS",
  onModeChange,
  onNotification,
  onRefreshData,
  shiftId,
  isStandaloneTab = false,
}) => {
  // ── State Management ────────────────────────────────────────────────────────
  const [activeStep, setActiveStep] = useState<BillingStep>("SCAN");
  const [currentMode, setCurrentMode] = useState<BillingStudioMode>(mode);

  useEffect(() => {
    setCurrentMode(mode);
  }, [mode]);

  // Customer State (Initialized with Reliance Retail Demo customer for full visual parity)
  const [customer, setCustomer] = useState<ProPosCustomer>(DEMO_RELIANCE_CUSTOMER);
  const [selectedOutlet, setSelectedOutlet] = useState<string>("Reliance - Andheri (AND)");
  const [customerSearchQuery, setCustomerSearchQuery] = useState<string>("9876543210");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState<boolean>(false);
  const [showNewCustomerModal, setShowNewCustomerModal] = useState<boolean>(false);
  const [newCustName, setNewCustName] = useState<string>("");
  const [newCustPhone, setNewCustPhone] = useState<string>("");
  const [newCustGstin, setNewCustGstin] = useState<string>("");
  const [newCustStateCode, setNewCustStateCode] = useState<string>("27");

  // Cart & Line Items
  const [cartItems, setCartItems] = useState<ProPosCartItem[]>(INITIAL_DEMO_CART_ITEMS);
  const [selectedCartItemId, setSelectedCartItemId] = useState<string | null>(null);
  const [billLevelDiscount, setBillLevelDiscount] = useState<number>(15);
  const [billDiscountType, setBillDiscountType] = useState<"FLAT" | "PERCENT">("FLAT");
  const [showDiscountModal, setShowDiscountModal] = useState<boolean>(false);

  // Staged Item Row (for barcode scanner / quick add)
  const [stagedProduct, setStagedProduct] = useState<{
    id: string;
    name: string;
    style: string;
    color: string;
    size: string;
    barcode: string;
    qty: number;
    rate: number;
    discountPct: number;
    discountAmt: number;
    salesStaff: string;
  }>({
    id: "STAGED-01",
    name: "Sport Shoe",
    style: "SPL-22",
    color: "WHITE",
    size: "42",
    barcode: "8901234567893",
    qty: 1,
    rate: 1200,
    discountPct: 0,
    discountAmt: 0,
    salesStaff: "Reshma",
  });

  // Scan & Item Search State
  const [barcodeInput, setBarcodeInput] = useState<string>("");
  const [productSearchQuery, setProductSearchQuery] = useState<string>("");
  const [showProductDropdown, setShowProductDropdown] = useState<boolean>(false);
  const [showF2Modal, setShowF2Modal] = useState<boolean>(false);
  const [globalSalesperson, setGlobalSalesperson] = useState<string>("Amit Patil");

  // Payment Settlement State
  const [paymentMode, setPaymentMode] = useState<"CASH" | "UPI" | "CARD" | "CREDIT">("CASH");
  const [receivedAmount, setReceivedAmount] = useState<string>("3360.00");
  const [upiRefNumber, setUpiRefNumber] = useState<string>("");
  const [cardAuthCode, setCardAuthCode] = useState<string>("");

  // Right Panel: More Details (COLLAPSED BY DEFAULT per UX Simplification)
  const [showMoreDetails, setShowMoreDetails] = useState<boolean>(false);
  const [billType, setBillType] = useState<string>("Product Sale");
  const [salesChannel, setSalesChannel] = useState<string>("Modern Trade (LF)");
  const [billingStore, setBillingStore] = useState<string>("Reliance - Andheri (AND)");
  const [deliveryStore, setDeliveryStore] = useState<string>("Same as Billing Store");
  const [posState, setPosState] = useState<string>("Maharashtra");
  const [poReference, setPoReference] = useState<string>("PO / Order Ref");

  // Settings Dialog (Modal encapsulation replaces permanently visible card)
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [scanMode, setScanMode] = useState<ScanMode>("AUTO_ADD");
  const [postScanFocus, setPostScanFocus] = useState<PostScanFocus>("scan_field");
  const [duplicateBarcodeAction, setDuplicateBarcodeAction] = useState<DuplicateBarcodeAction>("increment_qty");
  const [scanPrefBeep, setScanPrefBeep] = useState<boolean>(true);
  const [scanPrefShowImage, setScanPrefShowImage] = useState<boolean>(true);
  const [scanPrefAllowQtyOverride, setScanPrefAllowQtyOverride] = useState<boolean>(true);
  const [scanPrefAllowPriceOverride, setScanPrefAllowPriceOverride] = useState<boolean>(false);
  const [scanPrefAllowDiscountOverride, setScanPrefAllowDiscountOverride] = useState<boolean>(true);
  const [scanPrefAutoFillRate, setScanPrefAutoFillRate] = useState<boolean>(true);
  const [scanPrefAutoSalesperson, setScanPrefAutoSalesperson] = useState<boolean>(true);

  // Column Visibility Configuration
  const [showColConfig, setShowColConfig] = useState<boolean>(false);
  const [visibleCols, setVisibleCols] = useState({
    barcode: true,
    style: true,
    color: true,
    size: true,
    rate: true,
    disc: true,
    salesperson: true,
  });

  // Product Confirmation Modal (for CONFIRM_PRODUCT scan mode)
  const [showConfirmProductModal, setShowConfirmProductModal] = useState<boolean>(false);
  const [pendingConfirmItem, setPendingConfirmItem] = useState<{ product: any; qty: number } | null>(null);

  // Modals & Feedback
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [lastBillRecord, setLastBillRecord] = useState<any>(null);
  const [showReceiptModal, setShowReceiptModal] = useState<boolean>(false);
  const [showParkedBillsModal, setShowParkedBillsModal] = useState<boolean>(false);
  const [parkedBills, setParkedBills] = useState<ParkedCartRecord[]>([]);
  const [receiptPrintView, setReceiptPrintView] = useState<"THERMAL_80MM" | "A4_INVOICE">("THERMAL_80MM");

  // Company Billing Profile Engine State
  const [billingProfile, setBillingProfile] = useState<"B2C_ONLY" | "B2B_ONLY" | null>(null);
  const [isProfileConfigured, setIsProfileConfigured] = useState<boolean>(true);
  const [effectiveProfileConfig, setEffectiveProfileConfig] = useState<any>(null);
  const [customProfileOverrides, setCustomProfileOverrides] = useState<any>({});
  const [profileHistory, setProfileHistory] = useState<any[]>([]);
  const [showProfileSetupModal, setShowProfileSetupModal] = useState<boolean>(false);
  const [showProfileConfigModal, setShowProfileConfigModal] = useState<boolean>(false);
  const [showBulkAddModal, setShowBulkAddModal] = useState<boolean>(false);
  const [showAskUserRepeatModal, setShowAskUserRepeatModal] = useState<boolean>(false);
  const [pendingRepeatItem, setPendingRepeatItem] = useState<{ product: any; qty: number } | null>(null);

  // DOM Refs
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const stagedQtyInputRef = useRef<HTMLInputElement>(null);
  const stagedRateInputRef = useRef<HTMLInputElement>(null);
  const stagedDiscountInputRef = useRef<HTMLInputElement>(null);
  const stagedSalespersonSelectRef = useRef<HTMLSelectElement>(null);
  const lastScanRef = useRef<{ query: string; time: number }>({ query: "", time: 0 });

  // Active shift
  const activeShift = shifts.find((s) => s.status?.toUpperCase() === "OPEN") || shifts[0] || null;
  const effectiveShiftId = shiftId || activeShift?.id || "shift_canon_open_01";
  const registerLabel = activeShift?.profileId || (activeShift as any)?.counter_id || "REG-01";
  const storeStateCode = "27"; // Maharashtra

  // User authorization checks
  const isManagerOrAdmin =
    currentUser?.role?.toUpperCase() === "MANAGER" ||
    currentUser?.role?.toUpperCase() === "ADMIN" ||
    currentUser?.role?.toUpperCase() === "SYSTEM ADMINISTRATOR";
  const canOverridePrice = isManagerOrAdmin || scanPrefAllowPriceOverride;
  const canOverrideDiscount = isManagerOrAdmin || scanPrefAllowDiscountOverride;

  // ── Audio Beep Feedback ───────────────────────────────────────────────────
  const playBeep = useCallback((success: boolean = true) => {
    if (!scanPrefBeep || typeof window === "undefined") return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = success ? "sine" : "sawtooth";
      osc.frequency.setValueAtTime(success ? 880 : 330, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + (success ? 0.12 : 0.25));
      osc.start();
      osc.stop(audioCtx.currentTime + (success ? 0.12 : 0.25));
    } catch {
      // AudioContext not supported or permission blocked
    }
  }, [scanPrefBeep]);

  // ── Refresh Parked Carts ─────────────────────────────────────────────────
  const refreshParkedCarts = useCallback(() => {
    const active = SmritiPosParkedCartService.getActiveParkedCarts();
    setParkedBills(active);
  }, []);

  useEffect(() => {
    refreshParkedCarts();
  }, [refreshParkedCarts]);

  // ── Company Billing Profile Engine Fetch & Configuration Sync ──────────────
  const fetchBillingProfile = useCallback(async () => {
    try {
      const res = await apiFetchV1<any>("/billing/profile");
      if (res && res.success && res.data) {
        const { profile, is_configured, effective_config, overrides, history } = res.data;
        setBillingProfile(profile || null);
        setIsProfileConfigured(Boolean(is_configured));
        setEffectiveProfileConfig(effective_config || {});
        setCustomProfileOverrides(overrides || {});
        setProfileHistory(history || []);

        if (!is_configured) {
          setShowProfileSetupModal(true);
        } else if (effective_config) {
          if (effective_config.default_scan_mode) {
            setScanMode(effective_config.default_scan_mode);
          }
          if (effective_config.repeat_barcode_policy) {
            const pol = effective_config.repeat_barcode_policy;
            if (pol === "INCREASE_QUANTITY") setDuplicateBarcodeAction("increment_qty");
            else if (pol === "NEW_LINE") setDuplicateBarcodeAction("add_new_row");
            else if (pol === "ASK_USER") setDuplicateBarcodeAction("prompt");
          }
          if (effective_config.default_invoice_format) {
            setReceiptPrintView(effective_config.default_invoice_format === "A4_INVOICE" ? "A4_INVOICE" : "THERMAL_80MM");
          }
          if (profile === "B2C_ONLY") {
            setCustomer(WALK_IN_CUSTOMER);
          } else if (profile === "B2B_ONLY") {
            setCustomer(DEMO_RELIANCE_CUSTOMER);
          }
        }
      }
    } catch (err) {
      console.warn("Unable to fetch billing profile:", err);
    }
  }, []);

  useEffect(() => {
    fetchBillingProfile();
  }, [fetchBillingProfile]);

  // ── Live Calculation Engine ──────────────────────────────────────────────
  const calculations = useMemo(() => {
    return computeBillingTotals(
      cartItems,
      billLevelDiscount,
      billDiscountType,
      storeStateCode,
      customer.stateCode || "27"
    );
  }, [cartItems, customer.stateCode, billLevelDiscount, billDiscountType]);

  // Sync received amount to net payable when net payable changes if cash tender
  useEffect(() => {
    if (paymentMode === "CASH" && calculations.netPayable > 0) {
      setReceivedAmount(calculations.netPayable.toFixed(2));
    }
  }, [calculations.netPayable, paymentMode]);

  // Change Due calculation
  const receivedNum = Number(receivedAmount) || 0;
  const changeDue = Math.max(0, receivedNum - calculations.netPayable);

  // ── Add Item to Cart Execution Helpers ─────────────────────────────────────
  const executeIncreaseQuantity = useCallback((product: any, overrideQty: number = 1) => {
    setCartItems((prevItems) => {
      const existingIndex = prevItems.findIndex(
        (i) => i.productId === product.id || (product.sku && i.sku === product.sku) || (product.barcode && i.barcode === product.barcode)
      );
      if (existingIndex >= 0) {
        const updated = [...prevItems];
        const existing = updated[existingIndex];
        const newQty = existing.qty + overrideQty;
        const lineGross = newQty * existing.unitPrice;
        const lineDisc = existing.discountAmt || (existing.discountPct ? (lineGross * existing.discountPct) / 100 : 0);
        updated[existingIndex] = {
          ...existing,
          qty: newQty,
          lineTotal: lineGross - lineDisc,
        };
        return updated;
      }
      return prevItems;
    });
    playBeep(true);
    onNotification?.("Quantity Increased", `Updated quantity for ${product.name || "Item"}.`, "info");
    setTimeout(() => barcodeInputRef.current?.focus(), 50);
  }, [playBeep, onNotification]);

  const executeAddNewRow = useCallback((product: any, overrideQty: number = 1) => {
    setCartItems((prevItems) => {
      const price = Number(product.price ?? product.mrp ?? product.rate ?? 750);
      const mrp = Number(product.mrp ?? product.price ?? product.rate ?? 750);
      const gstRate = Number(product.gst_rate ?? product.gstPercentage ?? product.taxRate ?? 5);
      const assignedStaff = scanPrefAutoSalesperson
        ? (prevItems[prevItems.length - 1]?.salesStaff || globalSalesperson)
        : globalSalesperson;

      const newItem: ProPosCartItem = {
        id: `CART-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        productId: product.id || `P-${Date.now()}`,
        itemNo: prevItems.length + 1,
        sku: product.sku || product.code || `SKU-${Date.now()}`,
        barcode: product.barcode || product.sku || "8901234567890",
        name: product.name || "Regular Sandal",
        size: product.size || "36",
        color: product.color || "BEIGE",
        brand: product.brand || product.style || "SND-18",
        salesStaff: assignedStaff,
        qty: overrideQty,
        mrp,
        unitPrice: price,
        discountPct: 0,
        discountAmt: 0,
        taxPct: gstRate,
        taxAmt: 0,
        isTaxInclusive: true,
        hsnCode: product.hsn_code || product.hsn || "6403",
        lineTotal: price * overrideQty,
      };
      return [...prevItems, newItem];
    });
    playBeep(true);
    onNotification?.("Item Added", `${product.name || "Item"} added to cart.`, "success");
    setBarcodeInput("");
    setProductSearchQuery("");
    setShowProductDropdown(false);
    setTimeout(() => barcodeInputRef.current?.focus(), 50);
  }, [globalSalesperson, scanPrefAutoSalesperson, playBeep, onNotification]);

  // ── Add Item to Cart with Repeat Barcode Policy ────────────────────────────
  const addItemToCart = useCallback((product: Product | any, overrideQty: number = 1) => {
    const existingIndex = cartItems.findIndex(
      (i) => i.productId === product.id || (product.sku && i.sku === product.sku) || (product.barcode && i.barcode === product.barcode)
    );

    const repeatPolicy = effectiveProfileConfig?.repeat_barcode_policy;
    const isAskUser = duplicateBarcodeAction === "prompt" || repeatPolicy === "ASK_USER";
    const isNewLine = duplicateBarcodeAction === "add_new_row" || repeatPolicy === "NEW_LINE";

    if (existingIndex >= 0) {
      if (isAskUser) {
        setPendingRepeatItem({ product, qty: overrideQty });
        setShowAskUserRepeatModal(true);
        return;
      }
      if (!isNewLine) {
        executeIncreaseQuantity(product, overrideQty);
        return;
      }
    }

    executeAddNewRow(product, overrideQty);
  }, [cartItems, duplicateBarcodeAction, effectiveProfileConfig, executeIncreaseQuantity, executeAddNewRow]);

  // ── Bulk Add Commitment Handler ───────────────────────────────────────────
  const handleCommitBulkItems = useCallback((itemsToAdd: { product: any; qty: number }[]) => {
    itemsToAdd.forEach(({ product, qty }) => {
      addItemToCart(product, qty);
    });
    setShowBulkAddModal(false);
    onNotification?.("Bulk Items Added", `Successfully added ${itemsToAdd.length} items to cart.`, "success");
  }, [addItemToCart, onNotification]);

  // ── Add Staged Item to Cart ───────────────────────────────────────────────
  const addStagedItemToCart = () => {
    addItemToCart(stagedProduct, stagedProduct.qty);
    setTimeout(() => barcodeInputRef.current?.focus(), 50);
  };

  // ── Dispatch Product Processing by Scan Mode ──────────────────────────────
  const processMatchedProduct = (matched: Product | any, multiplierQty: number = 1) => {
    if (scanMode === "AUTO_ADD") {
      addItemToCart(matched, multiplierQty);
      setBarcodeInput("");
      setTimeout(() => barcodeInputRef.current?.focus(), 50);
    } else if (scanMode === "EDIT_THEN_ADD") {
      setStagedProduct({
        id: matched.id,
        name: matched.name,
        style: matched.brand || (matched as any).style || "SND-18",
        color: (matched as any).color || "BEIGE",
        size: (matched as any).size || "36",
        barcode: matched.barcode || matched.sku || "",
        qty: multiplierQty,
        rate: Number(scanPrefAutoFillRate ? (matched.price || matched.mrp || 750) : stagedProduct.rate),
        discountPct: 0,
        discountAmt: 0,
        salesStaff: scanPrefAutoSalesperson
          ? (cartItems[cartItems.length - 1]?.salesStaff || globalSalesperson)
          : globalSalesperson,
      });
      playBeep(true);
      setBarcodeInput("");
      if (postScanFocus === "qty") {
        setTimeout(() => stagedQtyInputRef.current?.focus(), 60);
      } else if (postScanFocus === "rate") {
        setTimeout(() => stagedRateInputRef.current?.focus(), 60);
      } else if (postScanFocus === "discount") {
        setTimeout(() => stagedDiscountInputRef.current?.focus(), 60);
      } else if (postScanFocus === "salesperson") {
        setTimeout(() => stagedSalespersonSelectRef.current?.focus(), 60);
      } else {
        setTimeout(() => barcodeInputRef.current?.focus(), 60);
      }
    } else if (scanMode === "CONFIRM_PRODUCT") {
      setPendingConfirmItem({ product: matched, qty: multiplierQty });
      setShowConfirmProductModal(true);
      playBeep(true);
      setBarcodeInput("");
    }
  };

  // ── Barcode Scanner Handler with Backend Lookup (Zero Synthetic Products) ─
  const handleBarcodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawQuery = barcodeInput.trim();
    if (!rawQuery) return;

    // 1. Debounce rapid duplicate hardware scan pulses
    const now = Date.now();
    if (lastScanRef.current.query === rawQuery && (now - lastScanRef.current.time) < 350) {
      return;
    }
    lastScanRef.current = { query: rawQuery, time: now };

    // 2. Quantity multiplier support (e.g., "3*8901234567890" or "2x8901234567890")
    let targetBarcode = rawQuery;
    let multiplierQty = 1;
    if (scanPrefAllowQtyOverride && (rawQuery.includes("*") || /^\d+x/i.test(rawQuery))) {
      const parts = rawQuery.includes("*") ? rawQuery.split("*") : rawQuery.split(/x/i);
      const parsedQty = parseInt(parts[0], 10);
      if (!isNaN(parsedQty) && parsedQty > 0 && parts[1]?.trim()) {
        multiplierQty = parsedQty;
        targetBarcode = parts[1].trim();
      }
    }

    // 3. Match against products catalog prop
    const matched = products.find(
      (p) =>
        p.barcode?.toLowerCase() === targetBarcode.toLowerCase() ||
        p.sku?.toLowerCase() === targetBarcode.toLowerCase() ||
        p.code?.toLowerCase() === targetBarcode.toLowerCase() ||
        p.id?.toLowerCase() === targetBarcode.toLowerCase()
    );

    if (matched) {
      processMatchedProduct(matched, multiplierQty);
      return;
    }

    // 4. Try backend scan API endpoint
    try {
      const scanRes = await apiFetchV1<any>(`/billing/scan/${encodeURIComponent(targetBarcode)}`);
      if (scanRes && scanRes.product) {
        processMatchedProduct(scanRes.product, multiplierQty);
        return;
      }
    } catch {
      // Backend lookup returned 404 or failed
    }

    // 5. Initial cart demo fallback matching if items are in catalog
    const demoMatch = INITIAL_DEMO_CART_ITEMS.find(
      (it) => it.barcode?.toLowerCase() === targetBarcode.toLowerCase() || it.sku?.toLowerCase() === targetBarcode.toLowerCase()
    );
    if (demoMatch) {
      processMatchedProduct({
        id: demoMatch.productId,
        name: demoMatch.name,
        sku: demoMatch.sku,
        barcode: demoMatch.barcode,
        price: demoMatch.unitPrice,
        mrp: demoMatch.mrp,
        brand: demoMatch.brand,
        color: demoMatch.color,
        size: demoMatch.size,
        gst_rate: demoMatch.taxPct,
      }, multiplierQty);
      return;
    }

    // 6. Unknown barcode: Never invent or silently add products! Actionable HREP message
    playBeep(false);
    onNotification?.(
      "Barcode Not Found",
      `Barcode "${targetBarcode}" was not found in catalog. Please check barcode or register product in Master Data.`,
      "error"
    );
    setBarcodeInput("");
    setTimeout(() => barcodeInputRef.current?.focus(), 50);
  };

  // ── Cart Manipulations ───────────────────────────────────────────────────
  const updateItemQty = (id: string, delta: number) => {
    setCartItems((prev) =>
      prev
        .map((item) => {
          if (item.id === id) {
            const nextQty = Math.max(1, item.qty + delta);
            const lineGross = nextQty * item.unitPrice;
            const lineDisc = item.discountAmt || (item.discountPct ? (lineGross * item.discountPct) / 100 : 0);
            return { ...item, qty: nextQty, lineTotal: lineGross - lineDisc };
          }
          return item;
        })
        .filter((item) => item.qty > 0)
    );
  };

  const removeItem = (id: string) => {
    setCartItems((prev) => prev.filter((i) => i.id !== id));
    onNotification?.("Item Removed", "Item removed from cart.", "info");
  };

  const clearCart = () => {
    if (cartItems.length === 0) return;
    setCartItems([]);
    setBillLevelDiscount(0);
    onNotification?.("Cart Cleared", "All items cleared from cart.", "info");
  };

  // ── Customer Search Filter ────────────────────────────────────────────────
  const filteredCustomers = useMemo(() => {
    const q = customerSearchQuery.trim().toLowerCase();
    if (!q || q.length < 2) return [];
    const sourceList = customers.length > 0 ? customers : [DEMO_RELIANCE_CUSTOMER];
    return sourceList.filter(
      (c) =>
        c.name?.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q) ||
        (c as any).gstin?.toLowerCase().includes(q)
    ).slice(0, 6);
  }, [customers, customerSearchQuery]);

  // ── Settle & Post Invoice Transaction ─────────────────────────────────────
  const handlePostTransaction = async (shouldPrint: boolean = false) => {
    if (cartItems.length === 0) {
      onNotification?.("Cart Empty", "Cannot bill an empty cart.", "error");
      return;
    }

    // Require outlet selection if customer has multiple registered outlets
    if (customer.id !== WALK_IN_CUSTOMER.id && DEMO_STORES.length > 1 && !selectedOutlet) {
      onNotification?.(
        "Outlet Selection Required",
        "Please select a customer store / outlet before saving this bill.",
        "error"
      );
      return;
    }

    // ── Billing Profile Enforcements ─────────────────────────────────────────
    // 1. Customer Selection Requirement for B2B Profile
    if (billingProfile === "B2B_ONLY" || effectiveProfileConfig?.customer_selection_required) {
      if (customer.id === WALK_IN_CUSTOMER.id) {
        onNotification?.(
          "Customer Selection Required",
          "B2B Invoicing requires selecting a registered business customer with tax identification.",
          "error"
        );
        return;
      }
    }

    // 2. Customer Purchase Order (PO) Reference Requirement
    const poPolicy = effectiveProfileConfig?.customer_po_reference;
    if (poPolicy === "REQUIRED") {
      if (!poReference || !poReference.trim() || poReference === "PO / Order Ref") {
        onNotification?.(
          "PO Reference Required",
          "Customer Purchase Order (PO) reference is mandatory under company policy.",
          "error"
        );
        return;
      }
    }

    // 3. Shift Management Policy Check
    const shiftPolicy = effectiveProfileConfig?.shift_management || (billingProfile === "B2C_ONLY" ? "ENABLED" : "DISABLED");
    if (shiftPolicy === "ENABLED") {
      if (!activeShift || activeShift.status?.toUpperCase() !== "OPEN") {
        onNotification?.(
          "Open Shift Required",
          "POS Retail billing requires an active open cashier shift. Please open a shift before checkout.",
          "error"
        );
        return;
      }
    }

    // Credit billing validations
    if (currentMode === "CREDIT_BILLING" || paymentMode === "CREDIT") {
      if (customer.id === WALK_IN_CUSTOMER.id) {
        onNotification?.("Customer Required", "Credit billing requires a registered customer account.", "error");
        return;
      }
      const availableLimit = (customer.creditLimit || 0) - (customer.currentBalance || 0);
      if (calculations.netPayable > availableLimit && (customer.creditLimit || 0) > 0) {
        onNotification?.(
          "Credit Limit Exceeded",
          `Net payable (₹${calculations.netPayable}) exceeds available credit limit (₹${availableLimit}).`,
          "error"
        );
        return;
      }
    }

    const clientTxUuid = crypto.randomUUID ? crypto.randomUUID() : `tx-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const generatedInvoiceNo = `INV-${Date.now().toString().slice(-6)}`;

    const backendTenders: POSTenderItem[] = [
      {
        tender_type: paymentMode,
        amount: calculations.netPayable,
        reference_no: paymentMode === "UPI" ? upiRefNumber : paymentMode === "CARD" ? cardAuthCode : undefined,
      },
    ];

    const storeObj = DEMO_STORES.find(
      (s) => s.name === selectedOutlet || s.code === selectedOutlet || s.id === selectedOutlet
    );
    const resolvedDeliveryLocationId = storeObj?.id || (customer.id !== WALK_IN_CUSTOMER.id ? "cdl-c64f6f2fec8a1d4e0a656483" : undefined);
    const resolvedStoreCode = storeObj?.code || "TEST-MUM-001";

    const payload = {
      client_tx_uuid: clientTxUuid,
      invoice_no: generatedInvoiceNo,
      shift_id: effectiveShiftId,
      payment_mode: paymentMode,
      grand_total: calculations.netPayable,
      customer_id: customer.id !== WALK_IN_CUSTOMER.id ? customer.id : undefined,
      customer_name: customer.name,
      customer_po: poReference || undefined,
      delivery_location_id: resolvedDeliveryLocationId,
      store_code: resolvedStoreCode,
      billing_store_code: resolvedStoreCode,
      delivery_store_code: resolvedStoreCode,
      place_of_supply_code: customer.stateCode || "27",
      bill_discount_val: calculations.billDiscount,
      bill_discount_type: billDiscountType === "PERCENT" ? "percent" : "flat",
      sales_channel: salesChannel,
      tenders: backendTenders,
      items: calculations.recomputedItems.map((item) => ({
        product_id: item.productId,
        code: item.sku,
        name: item.name,
        quantity: item.qty,
        price: item.unitPrice,
        hsn_code: item.hsnCode,
        gst_rate: item.taxPct,
        discount_amount: item.discountAmt,
        mrp: item.mrp,
        is_tax_inclusive: item.isTaxInclusive,
        salesperson_name: item.salesStaff || globalSalesperson,
      })),
    };

    setIsSubmitting(true);

    try {
      const res = await apiFetchV1<{ invoice_no: string; grand_total: number; tax_total: number }>(
        "/pos/checkout",
        {
          method: "POST",
          headers: { "Idempotency-Key": clientTxUuid },
          body: JSON.stringify(payload),
        }
      );

      const recorded = {
        billNo: res.invoice_no || generatedInvoiceNo,
        billDate: new Date().toLocaleString(),
        customer,
        selectedOutlet,
        items: calculations.recomputedItems,
        subTotal: Number(calculations.subtotal) || 0,
        discountTotal: (Number(calculations.totalItemDiscounts) || 0) + (Number(calculations.billDiscount) || 0),
        taxTotal: Number(res.tax_total !== undefined ? res.tax_total : calculations.totalTax) || 0,
        netPayable: Number(res.grand_total !== undefined ? res.grand_total : calculations.netPayable) || 0,
        paymentMode,
        tendered: Number(receivedNum || calculations.netPayable) || 0,
        changeDue: Number(changeDue) || 0,
        isOffline: false,
      };

      setLastBillRecord(recorded);
      if (shouldPrint) {
        setShowReceiptModal(true);
      }
      playBeep(true);
      onNotification?.("Invoice Saved", `Invoice #${recorded.billNo} committed successfully.`, "success");
      recordAuditAction("POS_SETTLEMENT", "sales_invoices", recorded.billNo, `Settled ${recorded.billNo} via ${paymentMode}`);
      onRefreshData?.();
    } catch (err: any) {
      // Offline fallback
      try {
        await ProPosOfflineSyncEngine.queueOfflineSale(payload, registerLabel, generatedInvoiceNo);
        const offlineRecord = {
          billNo: `${generatedInvoiceNo} (OFFLINE)`,
          billDate: new Date().toLocaleString(),
          customer,
          selectedOutlet,
          items: calculations.recomputedItems,
          subTotal: calculations.subtotal,
          discountTotal: calculations.totalItemDiscounts + calculations.billDiscount,
          taxTotal: calculations.totalTax,
          netPayable: calculations.netPayable,
          paymentMode,
          tendered: receivedNum || calculations.netPayable,
          changeDue,
          isOffline: true,
        };
        setLastBillRecord(offlineRecord);
        if (shouldPrint) setShowReceiptModal(true);
        onNotification?.("Offline Mode", `Network drop handled. Saved to local sync queue.`, "warning");
      } catch (offlineErr: any) {
        onNotification?.("Transaction Failed", `Checkout rejected: ${err.message}`, "error");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Keyboard Shortcuts (Cashier Productivity) ────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F1") {
        e.preventDefault();
        barcodeInputRef.current?.focus();
        return;
      }
      if (e.key === "F2") {
        e.preventDefault();
        setShowF2Modal(true);
        return;
      }
      if (e.key === "F4") {
        e.preventDefault();
        setShowMoreDetails((prev) => !prev);
        return;
      }
      if (e.key === "F7") {
        e.preventDefault();
        if (cartItems.length > 0 && !isSubmitting) {
          handlePostTransaction(true);
        }
        return;
      }
      if (e.key === "F8") {
        e.preventDefault();
        if (cartItems.length > 0 && !isSubmitting) {
          handlePostTransaction(false);
        }
        return;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cartItems, isSubmitting, handlePostTransaction]);

  // ── Inline SVG Footwear Icons ─────────────────────────────────────────────
  const SandalThumbnail = () => (
    <div className="w-8 h-8 rounded-md bg-[#fef3c7] dark:bg-amber-950/40 border border-[#fde68a] dark:border-amber-800 flex items-center justify-center shrink-0">
      <svg className="w-5 h-5 text-[#d97706]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M4 16c2-4 6-6 10-6s6 2 6 6" />
        <path d="M4 16h16v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3z" fill="currentColor" fillOpacity="0.2" />
        <path d="M8 10V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v4" />
      </svg>
    </div>
  );

  const ShoeThumbnail = () => (
    <div className="w-8 h-8 rounded-md bg-[#e0f2fe] dark:bg-sky-950/40 border border-[#bae6fd] dark:border-sky-800 flex items-center justify-center shrink-0">
      <svg className="w-5 h-5 text-[#0284c7]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 14c2-2 5-3 8-3s6 2 10 5" />
        <path d="M3 14h18v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4z" fill="currentColor" fillOpacity="0.2" />
        <path d="M7 11V7l5 2" />
      </svg>
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-[#f0f4f9] dark:bg-[#0b1329] text-[#1e293b] dark:text-[#f8fafc] font-sans overflow-hidden select-none">
      {/* ── TOP HEADER (Dark Navy #041632) ── */}
      <header className="px-4 py-2 bg-[#041632] text-white shrink-0 flex items-center justify-between gap-3 shadow-md z-20">
        {/* Left: Brand + Branch Selector */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 pr-3 border-r border-white/15">
            <div className="flex flex-col">
              <span className="font-extrabold text-sm tracking-wider text-white leading-tight">
                SMRITI
              </span>
              <span className="text-[9px] font-bold tracking-widest text-blue-300 uppercase leading-none">
                RETAIL OS
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-white tracking-tight">
                Billing Studio
              </span>
              <div className="text-[11px] text-blue-200 flex items-center gap-1 font-medium">
                <span>Main Branch (MAIN)</span>
              </div>
            </div>

            {/* Profile Engine Indicator & Configuration Modal Trigger */}
            <button
              type="button"
              onClick={() => {
                if (isProfileConfigured) setShowProfileConfigModal(true);
                else setShowProfileSetupModal(true);
              }}
              title="Click to view or customize Company Billing Profile"
              className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase border flex items-center gap-1 transition cursor-pointer shadow-xs ${
                billingProfile === "B2C_ONLY"
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-400/40 hover:bg-emerald-500/30"
                  : billingProfile === "B2B_ONLY"
                  ? "bg-purple-500/20 text-purple-300 border-purple-400/40 hover:bg-purple-500/30"
                  : "bg-amber-500/20 text-amber-300 border-amber-400/40 hover:bg-amber-500/30"
              }`}
            >
              <Building2 size={10} />
              <span>{billingProfile || "SETUP REQUIRED"}</span>
            </button>
          </div>
        </div>

        {/* Center: Search Customer Bar with F1 Hotkey */}
        <div className="flex-1 max-w-md mx-4 relative hidden md:block">
          <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={customerSearchQuery}
            onChange={(e) => {
              setCustomerSearchQuery(e.target.value);
              setShowCustomerDropdown(true);
            }}
            placeholder="Search customer by name, mobile or barcode..."
            className="w-full pl-9 pr-12 py-1.5 bg-white text-slate-800 rounded-lg text-xs border border-transparent focus:outline-hidden focus:ring-2 focus:ring-blue-400 shadow-inner"
          />
          <kbd className="absolute right-2.5 top-1.5 px-1.5 py-0.5 bg-slate-100 text-slate-600 border border-slate-300 rounded font-mono text-[10px] font-bold">
            F1
          </kbd>

          {/* Customer Dropdown */}
          {showCustomerDropdown && filteredCustomers.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-white text-slate-800 rounded-lg shadow-xl border border-slate-200 z-50 max-h-56 overflow-y-auto">
              {filteredCustomers.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setCustomer(c as ProPosCustomer);
                    setShowCustomerDropdown(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-blue-50 flex justify-between items-center border-b border-slate-100 text-xs"
                >
                  <div>
                    <span className="font-bold">{c.name}</span>
                    <span className="text-[10px] text-slate-500 ml-2 font-mono">{c.phone}</span>
                  </div>
                  {c.gstin && (
                    <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-mono">
                      {c.gstin}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Keyboard F2, Settings, More Details Toggle, Print Last, User Badge */}
        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => setShowF2Modal(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 hover:bg-white/10 text-white rounded-lg transition cursor-pointer font-medium"
            title="Advanced Item Search across Warehouses (F2)"
          >
            <KeyboardIcon size={14} />
            <span className="hidden sm:inline">Keyboard (F2)</span>
          </button>

          <button
            type="button"
            onClick={() => setShowSettingsModal(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 hover:bg-white/10 text-white/90 rounded-lg transition cursor-pointer font-medium"
            title="Scan & Add Settings"
          >
            <Settings size={14} />
            <span className="hidden sm:inline">Settings</span>
          </button>

          <button
            type="button"
            onClick={() => setShowMoreDetails((prev) => !prev)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition cursor-pointer font-medium ${
              showMoreDetails ? "bg-white/20 text-white" : "hover:bg-white/10 text-white/90"
            }`}
            title="Toggle More Details (F4)"
          >
            <Sliders size={14} />
            <span className="hidden sm:inline">More Details</span>
            <ChevronRight
              size={12}
              className={`transition-transform duration-200 ${showMoreDetails ? "rotate-90" : ""}`}
            />
          </button>

          <button
            type="button"
            onClick={() => {
              if (lastBillRecord) setShowReceiptModal(true);
              else onNotification?.("Print Last", "No bill record available from current session.", "info");
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 hover:bg-white/10 text-white rounded-lg transition cursor-pointer font-medium"
            title="Print Last Finalized Bill"
          >
            <Printer size={14} />
            <span className="hidden sm:inline">Print Last</span>
          </button>

          {/* User Profile Badge */}
          <div className="flex items-center gap-2 pl-2 border-l border-white/15">
            <div className="w-8 h-8 rounded-full bg-[#1e40af] text-white flex items-center justify-center font-bold text-xs ring-2 ring-white/20">
              {currentUser?.name ? currentUser.name.slice(0, 2).toUpperCase() : "JD"}
            </div>
            <div className="hidden xl:flex flex-col text-left">
              <span className="text-[9px] font-mono text-blue-200 uppercase leading-none">
                {currentUser?.role || "Cashier"}
              </span>
              <span className="text-xs font-semibold text-white leading-tight">
                {currentUser?.name || "John Doe"}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* ── MAIN STUDIO WORKSPACE ── */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden p-3 gap-3">
        {/* ── MAIN WORKFLOW COLUMN (Full width when More Details collapsed) ── */}
        <div className="flex-1 flex flex-col gap-3 overflow-y-auto pr-0.5 min-w-0">
          {/* ── CARD 1: CUSTOMER (SEARCH BY MOBILE OR NAME) ── */}
          <div className="bg-white dark:bg-[#1a233a] rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-2xs p-3.5">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-[#1a56db] text-white font-bold text-xs flex items-center justify-center shrink-0">
                  1
                </div>
                <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  Customer <span className="font-normal text-slate-500">(Search by Mobile or Name)</span>
                </h2>
              </div>
            </div>

            {/* Customer Search Bar & New Customer Button */}
            <div className="flex items-center gap-3 mb-3">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={customerSearchQuery}
                  onChange={(e) => setCustomerSearchQuery(e.target.value)}
                  placeholder="Enter 10-digit mobile number or customer name..."
                  className="w-full pl-9 pr-14 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono font-medium focus:outline-hidden focus:border-blue-500"
                />
                {customerSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setCustomerSearchQuery("")}
                    className="absolute right-7 top-2 text-slate-400 hover:text-slate-600"
                  >
                    <X size={13} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowCustomerDropdown(true)}
                  className="absolute right-2 top-2 text-slate-500 hover:text-blue-600 border-l border-slate-300 pl-1.5"
                >
                  <Search size={13} />
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowNewCustomerModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-blue-400/80 bg-blue-50/60 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800 rounded-lg text-xs font-bold transition cursor-pointer shadow-2xs shrink-0"
              >
                <UserPlus size={13} />
                <span>New Customer</span>
              </button>
            </div>

            {/* Selected Customer Details & Multi-Outlet Store Code Dropdown */}
            <div className="p-2.5 bg-blue-50/40 dark:bg-slate-900/60 rounded-xl border border-blue-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#1a56db] text-white flex items-center justify-center shrink-0">
                  <User size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
                      {customer.name}
                    </span>
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                      customer.registrationType === "REGISTERED"
                        ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                        : "bg-slate-100 text-slate-600 border-slate-300"
                    }`}>
                      {customer.registrationType === "REGISTERED" ? "GST Customer" : "Retail Customer"}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono flex items-center gap-2 mt-0.5">
                    <span>{customer.phone}</span>
                    {customer.gstin && (
                      <>
                        <span>|</span>
                        <span>GSTIN: {customer.gstin}</span>
                      </>
                    )}
                    <span>|</span>
                    <span>{customer.stateName || "Maharashtra"}</span>
                  </div>
                </div>
              </div>

              {/* Outlet / Store Code Selector (Mandatory for multi-outlet corporate accounts) */}
              <div className="flex items-center gap-2">
                {customer.id !== WALK_IN_CUSTOMER.id && (
                  <div className="flex flex-col text-left">
                    <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400">
                      Select Store / Outlet <span className="text-red-500">*</span>
                    </label>
                    <div className="flex items-center gap-1">
                      <select
                        value={selectedOutlet}
                        onChange={(e) => setSelectedOutlet(e.target.value)}
                        className={`px-2.5 py-1 bg-white dark:bg-slate-800 border rounded-lg text-xs font-medium cursor-pointer shadow-2xs ${
                          !selectedOutlet ? "border-red-400 ring-1 ring-red-400" : "border-slate-300 dark:border-slate-700"
                        }`}
                      >
                        <option value="">-- Choose Outlet --</option>
                        {DEMO_STORES.map((s) => (
                          <option key={s.id} value={s.name}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <span className="text-[9px] text-slate-400 mt-0.5">
                      3 outlets available. Select store for this bill.
                    </span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setCustomer(WALK_IN_CUSTOMER)}
                  className="px-3 py-1 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 rounded-lg text-xs font-semibold cursor-pointer transition shadow-2xs self-center ml-2"
                >
                  Change
                </button>
              </div>
            </div>

            {/* Mandatory Customer PO Reference Banner for B2B Wholesale */}
            {effectiveProfileConfig?.customer_po_reference === "REQUIRED" && (
              <div className="mt-2.5 pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-amber-50/50 dark:bg-amber-950/20 p-2 rounded-lg border border-amber-200/80 dark:border-amber-900/40">
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-xs font-bold text-amber-800 dark:text-amber-300">
                    Customer PO Reference <span className="text-red-500">*</span>:
                  </span>
                </div>
                <input
                  type="text"
                  value={poReference === "PO / Order Ref" ? "" : poReference}
                  onChange={(e) => setPoReference(e.target.value)}
                  placeholder="Enter mandatory Customer PO / Order Ref..."
                  className={`flex-1 px-3 py-1 bg-white dark:bg-slate-900 border rounded-lg text-xs font-mono font-bold ${
                    !poReference || poReference === "PO / Order Ref"
                      ? "border-amber-400 ring-1 ring-amber-300"
                      : "border-emerald-500 ring-1 ring-emerald-300"
                  }`}
                />
              </div>
            )}
          </div>

          {/* ── CARD 2: ITEMS IN CART ── */}
          <div className="bg-white dark:bg-[#1a233a] rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-2xs p-3.5 flex flex-col">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-[#1a56db] text-white font-bold text-xs flex items-center justify-center shrink-0">
                  2
                </div>
                <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  Items in Cart ({calculations.itemCount})
                </h2>
              </div>

              {/* Configure Columns Button */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowColConfig((prev) => !prev)}
                  className="flex items-center gap-1.5 px-2.5 py-1 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-xs font-medium cursor-pointer"
                >
                  <Settings size={12} />
                  <span>Configure Columns</span>
                  <ChevronDown size={11} />
                </button>

                {showColConfig && (
                  <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 p-2 z-40 text-xs space-y-1">
                    <label className="flex items-center gap-2 cursor-pointer p-1 hover:bg-slate-50 dark:hover:bg-slate-700 rounded">
                      <input
                        type="checkbox"
                        checked={visibleCols.barcode}
                        onChange={(e) => setVisibleCols((c) => ({ ...c, barcode: e.target.checked }))}
                      />
                      <span>Barcode</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer p-1 hover:bg-slate-50 dark:hover:bg-slate-700 rounded">
                      <input
                        type="checkbox"
                        checked={visibleCols.style}
                        onChange={(e) => setVisibleCols((c) => ({ ...c, style: e.target.checked }))}
                      />
                      <span>Style</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer p-1 hover:bg-slate-50 dark:hover:bg-slate-700 rounded">
                      <input
                        type="checkbox"
                        checked={visibleCols.color}
                        onChange={(e) => setVisibleCols((c) => ({ ...c, color: e.target.checked }))}
                      />
                      <span>Color</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer p-1 hover:bg-slate-50 dark:hover:bg-slate-700 rounded">
                      <input
                        type="checkbox"
                        checked={visibleCols.size}
                        onChange={(e) => setVisibleCols((c) => ({ ...c, size: e.target.checked }))}
                      />
                      <span>Size</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer p-1 hover:bg-slate-50 dark:hover:bg-slate-700 rounded">
                      <input
                        type="checkbox"
                        checked={visibleCols.rate}
                        onChange={(e) => setVisibleCols((c) => ({ ...c, rate: e.target.checked }))}
                      />
                      <span>Rate</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer p-1 hover:bg-slate-50 dark:hover:bg-slate-700 rounded">
                      <input
                        type="checkbox"
                        checked={visibleCols.disc}
                        onChange={(e) => setVisibleCols((c) => ({ ...c, disc: e.target.checked }))}
                      />
                      <span>Discount</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer p-1 hover:bg-slate-50 dark:hover:bg-slate-700 rounded">
                      <input
                        type="checkbox"
                        checked={visibleCols.salesperson}
                        onChange={(e) => setVisibleCols((c) => ({ ...c, salesperson: e.target.checked }))}
                      />
                      <span>Salesperson</span>
                    </label>
                  </div>
                )}
              </div>
            </div>

            {/* Cart Table (Default Clean Columns without redundant SKU or Variant) */}
            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#f8fafc] dark:bg-slate-900 text-slate-600 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2 px-2 text-center w-8">#</th>
                    <th className="py-2 px-2 w-8"></th>
                    <th className="py-2 px-3">Product Name</th>
                    {visibleCols.barcode && (
                      <th className="py-2 px-2 font-mono">
                        <div className="flex items-center gap-1">
                          <span>Barcode</span>
                          <Filter size={10} className="text-slate-400" />
                        </div>
                      </th>
                    )}
                    {visibleCols.style && (
                      <th className="py-2 px-2">
                        <div className="flex items-center gap-1">
                          <span>Style</span>
                          <Filter size={10} className="text-slate-400" />
                        </div>
                      </th>
                    )}
                    {visibleCols.color && (
                      <th className="py-2 px-2">
                        <div className="flex items-center gap-1">
                          <span>Color</span>
                          <Filter size={10} className="text-slate-400" />
                        </div>
                      </th>
                    )}
                    {visibleCols.size && (
                      <th className="py-2 px-2">
                        <div className="flex items-center gap-1">
                          <span>Size</span>
                          <Filter size={10} className="text-slate-400" />
                        </div>
                      </th>
                    )}
                    <th className="py-2 px-2 text-center w-20">Qty</th>
                    {visibleCols.rate && <th className="py-2 px-2 text-right w-20">Rate (₹)</th>}
                    {visibleCols.disc && (
                      <th className="py-2 px-2 text-center w-24">
                        <div className="flex items-center justify-center gap-1">
                          <span>Disc</span>
                          <div className="inline-flex rounded border border-slate-300 text-[9px] p-0.2 bg-white dark:bg-slate-800">
                            <span className="px-1 font-bold text-blue-600 bg-blue-50 dark:bg-blue-950 rounded-xs">%</span>
                            <span className="px-1 text-slate-500">₹</span>
                          </div>
                        </div>
                      </th>
                    )}
                    <th className="py-2 px-3 text-right w-24">Amount (₹)</th>
                    {visibleCols.salesperson && (
                      <th className="py-2 px-2 w-28">Salesperson</th>
                    )}
                    <th className="py-2 px-2 text-center w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-sans">
                  {calculations.recomputedItems.map((item, idx) => (
                    <tr
                      key={item.id}
                      className="hover:bg-blue-50/40 dark:hover:bg-slate-800/40 transition"
                    >
                      <td className="py-2 px-2 text-center text-slate-500 text-[11px]">{idx + 1}</td>
                      <td className="py-2 px-1 text-center">
                        {item.name.toLowerCase().includes("sandal") ? <SandalThumbnail /> : <ShoeThumbnail />}
                      </td>
                      <td className="py-2 px-3 font-semibold text-slate-900 dark:text-slate-100">
                        {item.name}
                      </td>
                      {visibleCols.barcode && (
                        <td className="py-2 px-2 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                          {item.barcode}
                        </td>
                      )}
                      {visibleCols.style && (
                        <td className="py-2 px-2 text-slate-600 dark:text-slate-400 text-[11px] font-mono">
                          {item.brand || "SND-18"}
                        </td>
                      )}
                      {visibleCols.color && (
                        <td className="py-2 px-2 text-slate-600 dark:text-slate-400 text-[11px]">
                          {item.color || "BEIGE"}
                        </td>
                      )}
                      {visibleCols.size && (
                        <td className="py-2 px-2 text-slate-600 dark:text-slate-400 text-[11px] font-mono">
                          {item.size || "36"}
                        </td>
                      )}
                      <td className="py-2 px-2 text-center">
                        <div className="inline-flex items-center rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-0.5">
                          <button
                            type="button"
                            onClick={() => updateItemQty(item.id, -1)}
                            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-600 dark:text-slate-300 cursor-pointer"
                          >
                            <Minus size={10} />
                          </button>
                          <span className="w-6 text-center font-bold text-xs font-mono">{item.qty}</span>
                          <button
                            type="button"
                            onClick={() => updateItemQty(item.id, 1)}
                            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-600 dark:text-slate-300 cursor-pointer"
                          >
                            <Plus size={10} />
                          </button>
                        </div>
                      </td>
                      {visibleCols.rate && (
                        <td className="py-2 px-2 text-right font-mono font-medium text-slate-800 dark:text-slate-200">
                          {Number(item.unitPrice).toFixed(2)}
                        </td>
                      )}
                      {visibleCols.disc && (
                        <td className="py-2 px-2 text-center font-mono text-slate-600 dark:text-slate-400">
                          {item.discountPct > 0 ? `${item.discountPct}%` : "0"}
                        </td>
                      )}
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                        {Number(item.lineTotal).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      {visibleCols.salesperson && (
                        <td className="py-2 px-2">
                          <select
                            value={item.salesStaff || "Amit"}
                            onChange={(e) => {
                              const staff = e.target.value;
                              setCartItems((prev) =>
                                prev.map((it) => (it.id === item.id ? { ...it, salesStaff: staff } : it))
                              );
                            }}
                            className="w-full px-2 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-[11px] cursor-pointer"
                          >
                            {DEMO_SALESPERSONS.map((sp) => (
                              <option key={sp} value={sp}>
                                {sp}
                              </option>
                            ))}
                          </select>
                        </td>
                      )}
                      <td className="py-2 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="p-1 text-red-500 hover:text-red-700 rounded transition cursor-pointer"
                          title="Delete Item"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Table Footer: Clear Cart & Apply Bill Discount (Eliminated duplicate More Details entry) */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 mt-1">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={clearCart}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 hover:border-red-300 bg-red-50/50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-semibold cursor-pointer transition shadow-2xs"
                >
                  <Trash2 size={12} />
                  <span>Clear Cart</span>
                </button>
                <span className="text-xs text-slate-500 font-medium">
                  {calculations.itemCount} items
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowDiscountModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-blue-400 bg-blue-50/50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold transition cursor-pointer shadow-2xs"
                >
                  <Percent size={12} />
                  <span>Apply Bill Discount</span>
                </button>
              </div>
            </div>
          </div>

          {/* ── CARD 3: ADD ITEM (SCAN BARCODE OR SEARCH PRODUCT) ── */}
          <div className="bg-white dark:bg-[#1a233a] rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-2xs p-3.5 flex flex-col">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-[#1a56db] text-white font-bold text-xs flex items-center justify-center shrink-0">
                  3
                </div>
                <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  Add Item <span className="font-normal text-slate-500">(Scan Barcode or Search Product)</span>
                </h2>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 rounded font-mono text-[10px] font-bold">
                  MODE: {scanMode}
                </span>
              </div>
            </div>

            {/* Barcode Search Form Bar */}
            <form onSubmit={handleBarcodeSubmit} className="flex items-center gap-2 mb-3">
              <div className="relative flex-1">
                <div className="absolute left-3 top-2.5 text-blue-600 flex items-center">
                  <Barcode size={18} />
                </div>
                <input
                  ref={barcodeInputRef}
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  placeholder="Scan barcode here (e.g. 8901234567890 or 3*890123... for multi-qty)..."
                  className="w-full pl-10 pr-9 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono font-medium focus:outline-hidden focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                />
                {barcodeInput && (
                  <button
                    type="button"
                    onClick={() => setBarcodeInput("")}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setShowF2Modal(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs shrink-0"
              >
                <Layers size={13} />
                <span>Select Product (F2)</span>
              </button>

              {effectiveProfileConfig?.bulk_add_enabled !== false && (
                <button
                  type="button"
                  id="bulk-add-items-btn"
                  onClick={() => setShowBulkAddModal(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 border border-indigo-300 dark:border-indigo-700 bg-indigo-50/80 dark:bg-indigo-950/40 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs shrink-0"
                >
                  <FileSpreadsheet size={13} />
                  <span>Bulk Add</span>
                </button>
              )}
            </form>

            {/* Staged Product Row with Direct "Add to Cart" Button */}
            <div className="p-3 bg-slate-50/70 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              {/* Product Thumbnail + Name & Variant */}
              <div className="flex items-center gap-3">
                <ShoeThumbnail />
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    {stagedProduct.name}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    {stagedProduct.style} | {stagedProduct.color} | {stagedProduct.size}
                  </div>
                </div>
              </div>

              {/* Quantity Stepper */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold text-slate-500">Qty</span>
                <div className="inline-flex items-center rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-0.5">
                  <button
                    type="button"
                    onClick={() => setStagedProduct((s) => ({ ...s, qty: Math.max(1, s.qty - 1) }))}
                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-600 dark:text-slate-300 cursor-pointer"
                  >
                    <Minus size={11} />
                  </button>
                  <input
                    ref={stagedQtyInputRef}
                    type="number"
                    min="1"
                    value={stagedProduct.qty}
                    onChange={(e) => setStagedProduct((s) => ({ ...s, qty: Math.max(1, Number(e.target.value) || 1) }))}
                    className="w-8 text-center font-bold text-xs font-mono bg-transparent border-none focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setStagedProduct((s) => ({ ...s, qty: s.qty + 1 }))}
                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-600 dark:text-slate-300 cursor-pointer"
                  >
                    <Plus size={11} />
                  </button>
                </div>
              </div>

              {/* Rate (₹) with Permission Guard against Unauthorized Overrides */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold text-slate-500">Rate (₹)</span>
                <div className="relative">
                  <input
                    ref={stagedRateInputRef}
                    type="number"
                    value={stagedProduct.rate}
                    readOnly={!canOverridePrice}
                    onChange={(e) => {
                      if (!canOverridePrice) {
                        onNotification?.("Permission Denied", "Price override requires manager authorization.", "warning");
                        return;
                      }
                      setStagedProduct((s) => ({ ...s, rate: Number(e.target.value) || 0 }));
                    }}
                    className={`w-20 px-2 py-1 bg-white dark:bg-slate-900 border rounded-lg text-xs font-mono text-right font-medium ${
                      !canOverridePrice ? "border-slate-200 bg-slate-100/70 text-slate-500 cursor-not-allowed" : "border-slate-300 dark:border-slate-700"
                    }`}
                  />
                  {!canOverridePrice && (
                    <Lock size={10} className="absolute right-1 top-2 text-slate-400 pointer-events-none" />
                  )}
                </div>
              </div>

              {/* Discount with Permission Guard */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold text-slate-500">Discount</span>
                <div className="inline-flex rounded border border-slate-300 text-[10px] p-0.5 bg-white dark:bg-slate-800">
                  <span className="px-1.5 font-bold text-blue-600 bg-blue-50 dark:bg-blue-950 rounded-xs">%</span>
                  <span className="px-1.5 text-slate-500">₹</span>
                </div>
                <input
                  ref={stagedDiscountInputRef}
                  type="number"
                  value={stagedProduct.discountPct}
                  readOnly={!canOverrideDiscount}
                  onChange={(e) => {
                    if (!canOverrideDiscount) {
                      onNotification?.("Permission Denied", "Discount override is restricted.", "warning");
                      return;
                    }
                    setStagedProduct((s) => ({ ...s, discountPct: Number(e.target.value) || 0 }));
                  }}
                  className={`w-12 px-2 py-1 bg-white dark:bg-slate-900 border rounded-lg text-xs font-mono text-center font-medium ${
                    !canOverrideDiscount ? "border-slate-200 bg-slate-100/70 text-slate-500 cursor-not-allowed" : "border-slate-300 dark:border-slate-700"
                  }`}
                />
              </div>

              {/* Salesperson */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold text-slate-500">Salesperson</span>
                <select
                  ref={stagedSalespersonSelectRef}
                  value={stagedProduct.salesStaff}
                  onChange={(e) => setStagedProduct((s) => ({ ...s, salesStaff: e.target.value }))}
                  className="px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs cursor-pointer"
                >
                  {DEMO_SALESPERSONS.map((sp) => (
                    <option key={sp} value={sp}>
                      {sp}
                    </option>
                  ))}
                </select>
              </div>

              {/* Add to Cart Button */}
              <button
                type="button"
                onClick={addStagedItemToCart}
                className="flex items-center gap-2 px-5 py-2 bg-[#1a56db] hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer shrink-0"
              >
                <ShoppingCart size={14} />
                <span>Add to Cart</span>
              </button>
            </div>
          </div>

          {/* ── CARD 4: BILL SUMMARY ── */}
          <div className="bg-white dark:bg-[#1a233a] rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-2xs p-3.5">
            <div className="flex items-center gap-2 mb-2.5">
              <div className="w-6 h-6 rounded-full bg-[#1a56db] text-white font-bold text-xs flex items-center justify-center shrink-0">
                4
              </div>
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                Bill Summary
              </h2>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 p-3 bg-slate-50/60 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-800">
              {/* Items Count */}
              <div>
                <div className="text-[11px] text-slate-500 font-medium">Items</div>
                <div className="text-base font-bold text-slate-800 dark:text-slate-100">
                  {calculations.itemCount}
                </div>
              </div>

              {/* Subtotal */}
              <div>
                <div className="text-[11px] text-slate-500 font-medium">Subtotal</div>
                <div className="text-base font-bold text-slate-800 dark:text-slate-100 font-mono">
                  ₹ {calculations.subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>

              {/* Item Discount */}
              <div>
                <div className="text-[11px] text-slate-500 font-medium">Item Discount</div>
                <div className="text-base font-bold text-emerald-600 font-mono">
                  - ₹ {calculations.totalItemDiscounts.toFixed(2)}
                </div>
              </div>

              {/* Bill Discount */}
              <div>
                <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                  <span>Bill Discount</span>
                  <button
                    type="button"
                    onClick={() => setShowDiscountModal(true)}
                    className="text-slate-400 hover:text-blue-600 cursor-pointer"
                  >
                    <Pencil size={11} />
                  </button>
                </div>
                <div className="text-base font-bold text-emerald-600 font-mono">
                  - ₹ {calculations.billDiscount.toFixed(2)}
                </div>
              </div>

              {/* GST */}
              <div>
                <div className="text-[11px] text-slate-500 font-medium">GST (5%)</div>
                <div className="text-base font-bold text-slate-800 dark:text-slate-100 font-mono">
                  ₹ {calculations.totalTax.toFixed(2)}
                </div>
              </div>

              {/* Payable Amount Highlight (Prominent, High-Contrast) */}
              <div className="pl-4 border-l border-slate-200 dark:border-slate-800 text-right bg-blue-50/50 dark:bg-blue-950/20 px-3.5 py-1.5 rounded-xl">
                <div className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  Payable Amount
                </div>
                <div className="text-2xl lg:text-3xl font-black text-[#1a56db] dark:text-blue-400 font-mono tracking-tight">
                  ₹ {calculations.netPayable.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          </div>

          {/* ── CARD 5: PAYMENT METHOD & SETTLEMENT ── */}
          <div className="bg-white dark:bg-[#1a233a] rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-2xs p-3.5">
            <div className="flex items-center gap-2 mb-2.5">
              <div className="w-6 h-6 rounded-full bg-[#1a56db] text-white font-bold text-xs flex items-center justify-center shrink-0">
                5
              </div>
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                Payment Method &amp; Settlement
              </h2>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Tender Option Buttons */}
              <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setPaymentMode("CASH")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition ${
                    paymentMode === "CASH"
                      ? "bg-[#1a56db] text-white shadow-xs"
                      : "text-slate-700 dark:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-800"
                  }`}
                >
                  <Banknote size={14} />
                  <span>Cash</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMode("UPI")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition ${
                    paymentMode === "UPI"
                      ? "bg-[#1a56db] text-white shadow-xs"
                      : "text-slate-700 dark:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-800"
                  }`}
                >
                  <QrCode size={14} />
                  <span>UPI</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMode("CARD")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition ${
                    paymentMode === "CARD"
                      ? "bg-[#1a56db] text-white shadow-xs"
                      : "text-slate-700 dark:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-800"
                  }`}
                >
                  <CreditCard size={14} />
                  <span>Card</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMode("CREDIT")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition ${
                    paymentMode === "CREDIT"
                      ? "bg-[#1a56db] text-white shadow-xs"
                      : "text-slate-700 dark:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-800"
                  }`}
                >
                  <Building2 size={14} />
                  <span>Credit</span>
                </button>
              </div>

              {/* Received Amount & Change Due */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-slate-500">Received (₹)</span>
                  <div className="relative">
                    <input
                      type="text"
                      value={receivedAmount}
                      onChange={(e) => setReceivedAmount(e.target.value)}
                      className="w-28 px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono font-bold text-right"
                    />
                    {receivedAmount && (
                      <button
                        type="button"
                        onClick={() => setReceivedAmount("")}
                        className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Change Due Box */}
                <div className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                    Change Due
                  </span>
                  <span className="text-sm font-extrabold font-mono text-emerald-600">
                    ₹ {changeDue.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Actions: Save & Print F7 / Settle & Save F8 */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handlePostTransaction(true)}
                  disabled={cartItems.length === 0 || isSubmitting}
                  className="flex items-center gap-1.5 px-4 py-2 border-2 border-[#1a56db] text-[#1a56db] hover:bg-blue-50/60 rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Printer size={14} />
                  <span>Save &amp; Print</span>
                  <kbd className="px-1 py-0.2 bg-blue-100 rounded text-[9px] font-mono">F7</kbd>
                </button>

                <button
                  type="button"
                  onClick={() => handlePostTransaction(false)}
                  disabled={cartItems.length === 0 || isSubmitting}
                  className="flex items-center gap-2 px-5 py-2 bg-[#1a56db] hover:bg-blue-700 text-white rounded-xl text-xs font-extrabold transition shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckCircle2 size={15} />
                  <span>Settle &amp; Save</span>
                  <kbd className="px-1 py-0.2 bg-white/20 rounded text-[9px] font-mono">F8</kbd>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN: MORE DETAILS (COLLAPSED BY DEFAULT) ── */}
        {showMoreDetails && (
          <div className="w-full lg:w-80 xl:w-96 flex flex-col gap-3 overflow-y-auto shrink-0 animate-in fade-in slide-in-from-right-4 duration-150">
            <div className="bg-white dark:bg-[#1a233a] rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-2xs p-3.5">
              <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded bg-blue-50 text-blue-600">
                    <Sliders size={14} />
                  </div>
                  <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100">
                    More Details <span className="font-normal text-slate-400">(Optional)</span>
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowMoreDetails(false)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                  title="Collapse Details Panel"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                {/* Billing Level Salesperson */}
                <div>
                  <label className="block text-slate-600 dark:text-slate-300 font-semibold mb-1">
                    Billing Level Salesperson
                  </label>
                  <select
                    value={globalSalesperson}
                    onChange={(e) => setGlobalSalesperson(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs cursor-pointer"
                  >
                    {DEMO_SALESPERSONS.map((sp) => (
                      <option key={sp} value={sp}>
                        {sp}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Applied to newly scanned items (can be adjusted per line)
                  </p>
                </div>

                {/* Bill Type */}
                <div>
                  <label className="block text-slate-600 dark:text-slate-300 font-semibold mb-1">
                    Bill Type
                  </label>
                  <select
                    value={billType}
                    onChange={(e) => setBillType(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs cursor-pointer"
                  >
                    <option value="Product Sale">Product Sale</option>
                    <option value="Service Invoice">Service Invoice</option>
                    <option value="Sample Delivery">Sample Delivery</option>
                    <option value="Consignment Transfer">Consignment Transfer</option>
                  </select>
                </div>

                {/* Sales Channel */}
                <div>
                  <label className="block text-slate-600 dark:text-slate-300 font-semibold mb-1">
                    Sales Channel
                  </label>
                  <select
                    value={salesChannel}
                    onChange={(e) => setSalesChannel(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs cursor-pointer"
                  >
                    <option value="Modern Trade (LF)">Modern Trade (LF)</option>
                    <option value="Counter POS">Counter POS</option>
                    <option value="Institutional Sale">Institutional Sale</option>
                    <option value="E-Commerce">E-Commerce</option>
                    <option value="Wholesale Distribution">Wholesale Distribution</option>
                  </select>
                </div>

                {/* Billing Store (Issuing Warehouse) */}
                <div>
                  <label className="block text-slate-600 dark:text-slate-300 font-semibold mb-1">
                    Billing Store (Issuing Location)
                  </label>
                  <select
                    value={billingStore}
                    onChange={(e) => setBillingStore(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs cursor-pointer"
                  >
                    {DEMO_STORES.map((s) => (
                      <option key={s.id} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Delivery / Shipping Store */}
                <div>
                  <label className="block text-slate-600 dark:text-slate-300 font-semibold mb-1">
                    Delivery / Shipping Store
                  </label>
                  <select
                    value={deliveryStore}
                    onChange={(e) => setDeliveryStore(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs cursor-pointer"
                  >
                    <option value="Same as Billing Store">Same as Billing Store</option>
                    {DEMO_STORES.map((s) => (
                      <option key={s.id} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* POS State */}
                <div>
                  <label className="block text-slate-600 dark:text-slate-300 font-semibold mb-1">
                    POS State (Place of Supply)
                  </label>
                  <input
                    type="text"
                    value={posState}
                    onChange={(e) => setPosState(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                  />
                </div>

                {/* PO Reference */}
                <div>
                  <label className="block text-slate-600 dark:text-slate-300 font-semibold mb-1">
                    PO Reference
                  </label>
                  <input
                    type="text"
                    value={poReference}
                    onChange={(e) => setPoReference(e.target.value)}
                    placeholder="PO / Order Ref"
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── SETTINGS DIALOG (MODAL ENCAPSULATION) ── */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-lg w-full p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-2.5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300">
                  <Settings size={16} />
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Scan &amp; Billing Settings (Cashier Preferences)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={16} />
              </button>
            </div>

            {/* 1. Barcode Scanning Workflow Mode */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Barcode Scanning Mode
              </div>
              <div className="space-y-1.5 text-xs">
                {[
                  {
                    id: "AUTO_ADD",
                    title: "Auto add immediately to cart",
                    desc: "Fastest retail flow — item added directly, scanner stays ready for next scan",
                  },
                  {
                    id: "EDIT_THEN_ADD",
                    title: "Stage item first (Edit quantity/price before adding)",
                    desc: "Populates the staging bar and moves cursor to the configured field",
                  },
                  {
                    id: "CONFIRM_PRODUCT",
                    title: "Product Confirmation Popup",
                    desc: "Opens item details modal for explicit cashier verification",
                  },
                ].map((modeOpt) => (
                  <label
                    key={modeOpt.id}
                    className={`flex items-start gap-2.5 p-2 rounded-xl border cursor-pointer transition ${
                      scanMode === modeOpt.id
                        ? "bg-blue-50/70 border-blue-400 dark:bg-blue-950/40 dark:border-blue-700"
                        : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
                    }`}
                  >
                    <input
                      type="radio"
                      name="scanMode"
                      checked={scanMode === modeOpt.id}
                      onChange={() => setScanMode(modeOpt.id as ScanMode)}
                      className="mt-0.5 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                    />
                    <div>
                      <span className="font-bold text-slate-800 dark:text-slate-100 block text-xs">
                        {modeOpt.title}
                      </span>
                      <span className="text-[11px] text-slate-500 block">
                        {modeOpt.desc}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* 2. Post-Scan Focus Field */}
            {scanMode === "EDIT_THEN_ADD" && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5">
                  Post-Scan Cursor Target
                </div>
                <select
                  value={postScanFocus}
                  onChange={(e) => setPostScanFocus(e.target.value as PostScanFocus)}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                >
                  <option value="scan_field">Stay in Barcode Input Field (Default)</option>
                  <option value="qty">Move cursor to Quantity Field</option>
                  <option value="rate">Move cursor to Rate Field</option>
                  <option value="discount">Move cursor to Discount Field</option>
                  <option value="salesperson">Move cursor to Salesperson Dropdown</option>
                </select>
              </div>
            )}

            {/* 3. Duplicate Barcode Behavior */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5">
                Duplicate Barcode Behavior
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <label className="flex items-center gap-2 p-2 border rounded-lg cursor-pointer">
                  <input
                    type="radio"
                    name="dupBarcode"
                    checked={duplicateBarcodeAction === "increment_qty"}
                    onChange={() => setDuplicateBarcodeAction("increment_qty")}
                  />
                  <span>Increment Qty (Default)</span>
                </label>
                <label className="flex items-center gap-2 p-2 border rounded-lg cursor-pointer">
                  <input
                    type="radio"
                    name="dupBarcode"
                    checked={duplicateBarcodeAction === "add_new_row"}
                    onChange={() => setDuplicateBarcodeAction("add_new_row")}
                  />
                  <span>Add as New Row</span>
                </label>
              </div>
            </div>

            {/* 4. Business Permissions & Safety Rules */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Scan Rules &amp; Permissions
              </div>
              <div className="space-y-1.5 text-xs">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={scanPrefBeep}
                    onChange={(e) => setScanPrefBeep(e.target.checked)}
                    className="text-blue-600 rounded"
                  />
                  <span>Play audio beep feedback on scan</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={scanPrefAllowQtyOverride}
                    onChange={(e) => setScanPrefAllowQtyOverride(e.target.checked)}
                    className="text-blue-600 rounded"
                  />
                  <span>Allow quantity override (e.g., 3*BARCODE or stepper)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={scanPrefAutoFillRate}
                    onChange={(e) => setScanPrefAutoFillRate(e.target.checked)}
                    className="text-blue-600 rounded"
                  />
                  <span>Auto-fill rate from product price list</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={scanPrefAutoSalesperson}
                    onChange={(e) => setScanPrefAutoSalesperson(e.target.checked)}
                    className="text-blue-600 rounded"
                  />
                  <span>Auto-select last used salesperson on new lines</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={scanPrefAllowPriceOverride}
                    onChange={(e) => setScanPrefAllowPriceOverride(e.target.checked)}
                    className="text-blue-600 rounded"
                  />
                  <span className="flex items-center gap-1">
                    <span>Allow Cashier Price Overrides</span>
                    <span className="text-[10px] text-amber-600 font-mono">(Restricted)</span>
                  </span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition"
              >
                Save Preferences
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CONFIRM PRODUCT MODAL (CONFIRM_PRODUCT MODE) ── */}
      {showConfirmProductModal && pendingConfirmItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 max-w-sm w-full p-5 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b">
              <h3 className="text-sm font-bold">Confirm Product Addition</h3>
              <button type="button" onClick={() => setShowConfirmProductModal(false)} className="text-slate-400">
                <X size={16} />
              </button>
            </div>
            <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
              <ShoeThumbnail />
              <div>
                <h4 className="text-xs font-bold">{pendingConfirmItem.product.name}</h4>
                <p className="text-[11px] text-slate-500 font-mono">
                  {pendingConfirmItem.product.sku || pendingConfirmItem.product.barcode}
                </p>
                <p className="text-xs font-bold text-blue-600 font-mono mt-1">
                  ₹ {Number(pendingConfirmItem.product.price || pendingConfirmItem.product.mrp || 750).toFixed(2)}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setShowConfirmProductModal(false)}
                className="px-3 py-1.5 border rounded-lg text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  addItemToCart(pendingConfirmItem.product, pendingConfirmItem.qty);
                  setShowConfirmProductModal(false);
                  setTimeout(() => barcodeInputRef.current?.focus(), 50);
                }}
                className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold"
              >
                Add to Cart
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── BILL DISCOUNT EDIT MODAL ── */}
      {showDiscountModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 max-w-sm w-full p-4 space-y-3">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold">Apply Bill Discount</h3>
              <button type="button" onClick={() => setShowDiscountModal(false)} className="text-slate-400">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setBillDiscountType("FLAT")}
                  className={`flex-1 py-1 rounded font-bold ${
                    billDiscountType === "FLAT" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  Flat Amount (₹)
                </button>
                <button
                  type="button"
                  onClick={() => setBillDiscountType("PERCENT")}
                  className={`flex-1 py-1 rounded font-bold ${
                    billDiscountType === "PERCENT" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  Percentage (%)
                </button>
              </div>
              <input
                type="number"
                value={billLevelDiscount || ""}
                onChange={(e) => setBillLevelDiscount(Number(e.target.value) || 0)}
                placeholder="Discount value..."
                className="w-full px-3 py-2 border rounded text-sm font-mono font-bold"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setShowDiscountModal(false)}
                className="px-4 py-1.5 bg-blue-600 text-white rounded text-xs font-bold"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── RECEIPT / PRINT MODAL (THERMAL & A4) ── */}
      {showReceiptModal && lastBillRecord && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 relative flex flex-col max-h-[90vh]">
            <button
              type="button"
              onClick={() => setShowReceiptModal(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-100">
              <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                <Check size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Bill Saved: {lastBillRecord.billNo}
                </h3>
                <p className="text-xs text-slate-500">
                  {lastBillRecord.billDate} • Cashier: {globalSalesperson}
                </p>
              </div>
            </div>

            {/* Dual Format Switcher */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl mb-3 text-xs font-bold">
              <button
                type="button"
                onClick={() => setReceiptPrintView("THERMAL_80MM")}
                className={`flex-1 py-1.5 rounded-lg transition ${
                  receiptPrintView === "THERMAL_80MM"
                    ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-xs"
                    : "text-slate-600 dark:text-slate-400"
                }`}
              >
                Thermal Slip (80mm)
              </button>
              <button
                type="button"
                onClick={() => setReceiptPrintView("A4_INVOICE")}
                className={`flex-1 py-1.5 rounded-lg transition ${
                  receiptPrintView === "A4_INVOICE"
                    ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-xs"
                    : "text-slate-600 dark:text-slate-400"
                }`}
              >
                A4 Tax Invoice
              </button>
            </div>

            {/* Printable Preview: Thermal 80mm OR A4 Statutory Invoice */}
            {receiptPrintView === "THERMAL_80MM" ? (
              <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 font-mono text-xs space-y-2">
                <div className="text-center pb-2 border-b border-dashed border-slate-300">
                  <div className="font-bold text-sm">TATTLY THREADS</div>
                  <div className="text-[10px] text-slate-500">Main Branch (MAIN) • GSTIN: 27AAXFT2508H1ZR</div>
                  <div className="text-[10px] text-slate-500">Tax Invoice / Cash Receipt</div>
                </div>

                <div className="text-[11px] space-y-0.5">
                  <div>Invoice No: <span className="font-bold">{lastBillRecord.billNo}</span></div>
                  <div>Customer: {lastBillRecord.customer.name}</div>
                  {lastBillRecord.customer.gstin && <div>GSTIN: {lastBillRecord.customer.gstin}</div>}
                  <div>Outlet: {lastBillRecord.selectedOutlet || selectedOutlet}</div>
                  <div>Place of Supply: {lastBillRecord.customer.stateName || "Maharashtra"} (27)</div>
                  <div>Tender: {lastBillRecord.paymentMode}</div>
                </div>

                <div className="py-2 border-t border-b border-dashed border-slate-300 space-y-1">
                  {lastBillRecord.items.map((it: any, i: number) => (
                    <div key={i} className="flex justify-between text-[11px]">
                      <span className="truncate max-w-[200px]">{it.name} x {it.qty}</span>
                      <span>₹{Number(it.lineTotal).toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                <div className="space-y-0.5 pt-1 text-[11px]">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>₹{Number(lastBillRecord.subTotal || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tax Total (GST):</span>
                    <span>₹{Number(lastBillRecord.taxTotal || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-sm pt-1 border-t border-slate-300">
                    <span>Payable Amount:</span>
                    <span>₹{Number(lastBillRecord.netPayable || 0).toFixed(2)}</span>
                  </div>
                  {Number(lastBillRecord.changeDue || 0) > 0 && (
                    <div className="flex justify-between text-emerald-600">
                      <span>Change Returned:</span>
                      <span>₹{Number(lastBillRecord.changeDue || 0).toFixed(2)}</span>
                    </div>
                  )}
                </div>

                <div className="text-center pt-3 text-[10px] text-slate-500">
                  *** Thank You for Shopping with Us! ***
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto bg-white dark:bg-slate-950 p-4 rounded-xl border border-slate-300 font-sans text-xs space-y-3">
                <div className="flex justify-between items-start pb-2 border-b border-slate-200">
                  <div>
                    <h4 className="font-extrabold text-sm text-blue-900 dark:text-blue-300">TATTLY THREADS</h4>
                    <p className="text-[10px] text-slate-500">Office No. 81, Beside Jio Gallery, Mumbai</p>
                    <p className="text-[10px] text-slate-500 font-mono">GSTIN: 27AAXFT2508H1ZR</p>
                  </div>
                  <div className="text-right">
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-bold text-[10px] uppercase">Tax Invoice</span>
                    <p className="font-mono font-bold text-xs mt-1">{lastBillRecord.billNo}</p>
                    <p className="text-[10px] text-slate-500">{lastBillRecord.billDate}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 p-2 bg-slate-50 dark:bg-slate-900 rounded text-[11px]">
                  <div>
                    <span className="font-bold text-slate-700 dark:text-slate-300 block">Billed To (Recipient):</span>
                    <span className="font-semibold">{lastBillRecord.customer.name}</span>
                    <p className="text-slate-500 font-mono">{lastBillRecord.customer.phone}</p>
                    {lastBillRecord.customer.gstin && (
                      <p className="font-mono text-blue-600">GSTIN: {lastBillRecord.customer.gstin}</p>
                    )}
                  </div>
                  <div>
                    <span className="font-bold text-slate-700 dark:text-slate-300 block">Shipped To (Delivery Site):</span>
                    <span>{lastBillRecord.selectedOutlet || selectedOutlet}</span>
                    <p className="text-slate-500">POS State: {posState} (27)</p>
                  </div>
                </div>

                <table className="w-full text-left text-[11px] border-collapse">
                  <thead className="bg-slate-100 dark:bg-slate-800 font-bold border-b">
                    <tr>
                      <th className="py-1 px-1.5">#</th>
                      <th className="py-1 px-1.5">Item Description</th>
                      <th className="py-1 px-1.5 text-center">Qty</th>
                      <th className="py-1 px-1.5 text-right">Rate</th>
                      <th className="py-1 px-1.5 text-right">Tax</th>
                      <th className="py-1 px-1.5 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lastBillRecord.items.map((it: any, i: number) => (
                      <tr key={i}>
                        <td className="py-1 px-1.5 text-slate-500">{i + 1}</td>
                        <td className="py-1 px-1.5 font-medium">{it.name} ({it.brand} {it.color} {it.size})</td>
                        <td className="py-1 px-1.5 text-center font-mono">{it.qty}</td>
                        <td className="py-1 px-1.5 text-right font-mono">₹{Number(it.unitPrice).toFixed(2)}</td>
                        <td className="py-1 px-1.5 text-right font-mono">{it.taxPct || 5}%</td>
                        <td className="py-1 px-1.5 text-right font-mono font-bold">₹{Number(it.lineTotal).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="pt-2 border-t flex justify-between font-mono text-[11px]">
                  <span>Grand Total (Net Payable):</span>
                  <span className="font-bold text-xs text-blue-700">₹{Number(lastBillRecord.netPayable || 0).toFixed(2)}</span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t">
              <button
                type="button"
                onClick={() => window.print()}
                className="py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5"
              >
                <Printer size={13} />
                <span>Thermal Slip</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const shareText = `Invoice: ${lastBillRecord.billNo}%0AAmount: Rs.${lastBillRecord.netPayable}%0AThank you!`;
                  window.open(`https://wa.me/?text=${shareText}`, "_blank");
                }}
                className="py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5"
              >
                <Share2 size={13} />
                <span>WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={() => setShowReceiptModal(false)}
                className="py-2 bg-slate-800 text-white rounded-lg text-xs font-bold"
              >
                <span>Close</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── NEW CUSTOMER MODAL ── */}
      {showNewCustomerModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-5 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b">
              <h3 className="text-sm font-bold">New Customer Creation</h3>
              <button type="button" onClick={() => setShowNewCustomerModal(false)} className="text-slate-400">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-500 mb-1">Customer Name *</label>
                <input
                  type="text"
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  placeholder="e.g. Ramesh Sharma"
                  className="w-full px-3 py-1.5 rounded border"
                />
              </div>
              <div>
                <label className="block text-slate-500 mb-1">Mobile Phone Number *</label>
                <input
                  type="text"
                  value={newCustPhone}
                  onChange={(e) => setNewCustPhone(e.target.value)}
                  placeholder="10-digit mobile"
                  className="w-full px-3 py-1.5 rounded border font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-500 mb-1">GSTIN (Optional)</label>
                <input
                  type="text"
                  value={newCustGstin}
                  onChange={(e) => setNewCustGstin(e.target.value)}
                  placeholder="15-character GSTIN"
                  className="w-full px-3 py-1.5 rounded border font-mono uppercase"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setShowNewCustomerModal(false)}
                className="px-3 py-1.5 rounded border text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!newCustName || !newCustPhone) return;
                  const created: ProPosCustomer = {
                    id: `CUST-${Date.now()}`,
                    code: `C-${Date.now().toString().slice(-4)}`,
                    name: newCustName.trim(),
                    phone: newCustPhone.trim(),
                    gstin: newCustGstin.trim() || undefined,
                    stateCode: "27",
                    stateName: "Maharashtra",
                    registrationType: newCustGstin.trim() ? "REGISTERED" : "UNREGISTERED",
                    creditLimit: 0,
                    currentBalance: 0,
                    loyaltyPoints: 0,
                  };
                  setCustomer(created);
                  setShowNewCustomerModal(false);
                }}
                className="px-4 py-1.5 bg-blue-600 text-white rounded text-xs font-bold"
              >
                Save &amp; Select
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── F2 ADVANCED ITEM SEARCH MODAL ── */}
      {showF2Modal && (
        <SmritiF2AdvancedItemSearch
          isOpen={showF2Modal}
          products={products}
          onClose={() => setShowF2Modal(false)}
          onSelectProduct={(selected: SmritiF2SelectedItem) => {
            const product = products.find((p) => p.sku === selected.stockNo || p.barcode === selected.barcode) || {
              id: selected.barcode || selected.stockNo,
              code: selected.stockNo,
              name: selected.name,
              sku: selected.stockNo,
              barcode: selected.barcode,
              price: selected.rate,
              stock: selected.stock || 10,
              category: selected.category || "General",
              mrp: selected.mrp,
              gstPercentage: selected.gstRate,
            };
            addItemToCart(product as Product, 1);
            setShowF2Modal(false);
          }}
        />
      )}

      {/* ── BULK ADD ITEMS MODAL (Paste Barcodes, Barcode+Qty, CSV Import) ── */}
      {showBulkAddModal && (
        <BulkAddItemsModal
          isOpen={showBulkAddModal}
          onClose={() => setShowBulkAddModal(false)}
          products={products}
          onCommitItems={handleCommitBulkItems}
          salesperson={globalSalesperson}
        />
      )}

      {/* ── INITIAL COMPANY BILLING PROFILE SETUP MODAL ── */}
      {showProfileSetupModal && (
        <BillingProfileSetupModal
          isOpen={showProfileSetupModal}
          canConfigure={isManagerOrAdmin}
          onProfileActivated={(newProfile, effectiveConfig) => {
            setBillingProfile(newProfile);
            setIsProfileConfigured(true);
            setEffectiveProfileConfig(effectiveConfig);
            setShowProfileSetupModal(false);
            if (newProfile === "B2C_ONLY") {
              setCustomer(WALK_IN_CUSTOMER);
              setReceiptPrintView("THERMAL_80MM");
            } else {
              setCustomer(DEMO_RELIANCE_CUSTOMER);
              setReceiptPrintView("A4_INVOICE");
            }
          }}
          onNotification={onNotification}
        />
      )}

      {/* ── BILLING PROFILE & CONFIGURATION MODAL ── */}
      {showProfileConfigModal && (
        <BillingProfileConfigModal
          isOpen={showProfileConfigModal}
          onClose={() => setShowProfileConfigModal(false)}
          activeProfile={billingProfile || "B2C_ONLY"}
          effectiveConfig={effectiveProfileConfig}
          customOverrides={customProfileOverrides}
          history={profileHistory}
          canManage={isManagerOrAdmin}
          onConfigSaved={(data) => {
            if (data.billing_profile) {
              setBillingProfile(data.billing_profile);
              if (data.billing_profile === "B2C_ONLY") {
                setCustomer(WALK_IN_CUSTOMER);
                setReceiptPrintView("THERMAL_80MM");
              } else {
                setCustomer(DEMO_RELIANCE_CUSTOMER);
                setReceiptPrintView("A4_INVOICE");
              }
            }
            if (data.effective_configuration) {
              setEffectiveProfileConfig(data.effective_configuration);
              if (data.effective_configuration.default_scan_mode) {
                setScanMode(data.effective_configuration.default_scan_mode);
              }
              if (data.effective_configuration.repeat_barcode_policy) {
                const pol = data.effective_configuration.repeat_barcode_policy;
                if (pol === "INCREASE_QUANTITY") setDuplicateBarcodeAction("increment_qty");
                else if (pol === "NEW_LINE") setDuplicateBarcodeAction("add_new_row");
                else if (pol === "ASK_USER") setDuplicateBarcodeAction("prompt");
              }
            }
            fetchBillingProfile();
          }}
          onNotification={onNotification}
        />
      )}

      {/* ── REPEAT BARCODE ACTION PROMPT MODAL (ASK_USER) ── */}
      {showAskUserRepeatModal && pendingRepeatItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 max-w-sm w-full p-5 space-y-4">
            <div className="flex items-center gap-2 text-amber-600">
              <AlertTriangle size={18} />
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Item Already in Cart
              </h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              <strong>{pendingRepeatItem.product.name}</strong> ({pendingRepeatItem.product.barcode || pendingRepeatItem.product.sku}) is already in the cart.
              How would you like to handle this duplicate scan?
            </p>
            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  executeIncreaseQuantity(pendingRepeatItem.product, pendingRepeatItem.qty);
                  setShowAskUserRepeatModal(false);
                  setPendingRepeatItem(null);
                }}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus size={13} />
                <span>Increase Quantity (+{pendingRepeatItem.qty})</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  executeAddNewRow(pendingRepeatItem.product, pendingRepeatItem.qty);
                  setShowAskUserRepeatModal(false);
                  setPendingRepeatItem(null);
                }}
                className="w-full py-2 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold transition cursor-pointer"
              >
                Add as New Row
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAskUserRepeatModal(false);
                  setPendingRepeatItem(null);
                  setTimeout(() => barcodeInputRef.current?.focus(), 50);
                }}
                className="w-full py-1.5 text-slate-500 hover:text-slate-700 text-xs text-center cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SmritiBillingStudio;
