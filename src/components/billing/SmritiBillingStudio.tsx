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
  ExternalLink,
  FileText,
  Clock,
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
  consolidatedBatch?: { selectedSlips: any[]; items: any[]; customer: any } | null;
  onClearConsolidatedBatch?: () => void;
  packingSlips?: any[];
  onSavePackingSlips?: (slips: any[]) => void;
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
  "Reshma",
  "Amit Pat",
  "Anita",
  "John Doe",
  "Cashier Lead",
];

// Initial demo cart items from frozen visual specification (6 items)
export const INITIAL_DEMO_CART_ITEMS: ProPosCartItem[] = [
  {
    id: "CART-01",
    productId: "P-TATLD-41",
    itemNo: 1,
    sku: "TATLD-BRONZE-41",
    barcode: "8904551002082",
    name: "TATLD CASUAL CHAPPAL",
    size: "41",
    color: "BRONZE",
    brand: "Tattly Threads",
    salesStaff: "Amit Pat",
    qty: 2,
    mrp: 2599,
    unitPrice: 2599,
    basePrice: 2356.125,
    discountPct: 5,
    discountAmt: 259.9,
    taxPct: 5,
    taxAmt: 235.15,
    isTaxInclusive: false,
    hsnCode: "6403",
    lineTotal: 4938.1,
  },
  {
    id: "CART-02",
    productId: "P-SND-18-42",
    itemNo: 2,
    sku: "SND-18-V-42",
    barcode: "8904551003412",
    name: "SND-18-V SNEAKER",
    size: "42",
    color: "WHITE",
    brand: "Sportz",
    salesStaff: "Reshma",
    qty: 1,
    mrp: 1999,
    unitPrice: 1999,
    discountPct: 0,
    discountAmt: 0,
    taxPct: 5,
    taxAmt: 99.95,
    isTaxInclusive: false,
    hsnCode: "6404",
    lineTotal: 1999.0,
  },
  {
    id: "CART-03",
    productId: "P-RNG-40",
    itemNo: 3,
    sku: "RNG-RUN-40",
    barcode: "8904551005567",
    name: "RNG RUNNING SHOE",
    size: "40",
    color: "BLACK",
    brand: "Ranger",
    salesStaff: "Amit Pat",
    qty: 1,
    mrp: 3499,
    unitPrice: 3499,
    discountPct: 10,
    discountAmt: 349.9,
    taxPct: 5,
    taxAmt: 157.45,
    isTaxInclusive: false,
    hsnCode: "6404",
    lineTotal: 3149.1,
  },
  {
    id: "CART-04",
    productId: "P-CTN-POLO-L",
    itemNo: 4,
    sku: "CTN-POLO-L",
    barcode: "8904551007711",
    name: "CTN POLO T-SHIRT",
    size: "L",
    color: "NAVY",
    brand: "UrbanWear",
    salesStaff: "Reshma",
    qty: 3,
    mrp: 899,
    unitPrice: 899,
    discountPct: 5,
    discountAmt: 134.85,
    taxPct: 5,
    taxAmt: 128.05,
    isTaxInclusive: false,
    hsnCode: "6105",
    lineTotal: 2561.15,
  },
  {
    id: "CART-05",
    productId: "P-DNM-JEANS-32",
    itemNo: 5,
    sku: "DNM-REG-32",
    barcode: "8904551009932",
    name: "DNM REGULAR JEANS",
    size: "32",
    color: "BLUE",
    brand: "Denim Co.",
    salesStaff: "Amit Pat",
    qty: 1,
    mrp: 1499,
    unitPrice: 1499,
    discountPct: 0,
    discountAmt: 0,
    taxPct: 5,
    taxAmt: 74.95,
    isTaxInclusive: false,
    hsnCode: "6203",
    lineTotal: 1499.0,
  },
  {
    id: "CART-06",
    productId: "P-LADY-HEELS-38",
    itemNo: 6,
    sku: "LADY-GLAM-38",
    barcode: "8904551009932",
    name: "LADY GLAM HEELS",
    size: "38",
    color: "RED",
    brand: "Strella",
    salesStaff: "Reshma",
    qty: 1,
    mrp: 1899,
    unitPrice: 1899,
    discountPct: 0,
    discountAmt: 0,
    taxPct: 5,
    taxAmt: 94.95,
    isTaxInclusive: false,
    hsnCode: "6402",
    lineTotal: 1899.0,
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

  if (items.length === 0) {
    return {
      recomputedItems: [],
      grossTotal: 0,
      subtotal: 0,
      totalItemDiscounts: 0,
      billDiscount: 0,
      totalTaxable: 0,
      totalTax: 0,
      totalCgst: 0,
      totalSgst: 0,
      totalIgst: 0,
      roundOff: 0,
      netPayable: 0,
      totalQty: 0,
      itemCount: 0,
      isInterstate,
    };
  }

  const recomputedItems = items.map((item) => {
    const itemGross = item.basePrice ? item.qty * item.basePrice : item.qty * item.unitPrice;
    const itemDisc = item.discountAmt !== undefined ? item.discountAmt : (item.discountPct ? (itemGross * item.discountPct) / 100 : 0);
    const taxParams = {
      unitPrice: item.unitPrice,
      quantity: item.qty,
      discountAmount: itemDisc,
      gstRate: item.taxPct,
      isTaxInclusive: item.isTaxInclusive ?? false,
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
      lineTotal: item.lineTotal !== undefined ? item.lineTotal : taxRes.totalAmount,
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

  const isAllTaxInclusive = items.length === 0 || items.every((it) => it.isTaxInclusive === true);
  const netTax = isAllTaxInclusive ? totalTax : Math.round((subtotal - calculatedBillDiscount) * 0.05 * 100) / 100;
  const netBeforeRound = isAllTaxInclusive
    ? Math.max(0, subtotal - calculatedBillDiscount)
    : Math.max(0, subtotal - calculatedBillDiscount + netTax);

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
    totalTax: isAllTaxInclusive ? totalTax : netTax,
    totalCgst: isAllTaxInclusive ? totalCgst : netTax / 2,
    totalSgst: isAllTaxInclusive ? totalSgst : netTax / 2,
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
  consolidatedBatch = null,
  onClearConsolidatedBatch,
  packingSlips = [],
  onSavePackingSlips,
}) => {
  // ── State Management ────────────────────────────────────────────────────────
  const [activeStep, setActiveStep] = useState<BillingStep>("SCAN");
  const [currentMode, setCurrentMode] = useState<BillingStudioMode>(mode);
  const [activeConsolidatedSlips, setActiveConsolidatedSlips] = useState<any[]>([]);

  useEffect(() => {
    setCurrentMode(mode);
  }, [mode]);

  // Load consolidated batch into Billing Studio cart when provided
  useEffect(() => {
    if (consolidatedBatch && consolidatedBatch.items.length > 0) {
      setActiveConsolidatedSlips(consolidatedBatch.selectedSlips);
      if (consolidatedBatch.customer) {
        setCustomer({
          id: consolidatedBatch.customer.id || "CUST-B2B",
          code: consolidatedBatch.customer.code || consolidatedBatch.customer.id || "CUST-B2B",
          name: consolidatedBatch.customer.name || "B2B Customer",
          phone: consolidatedBatch.customer.phone || "9999999999",
          gstin: consolidatedBatch.customer.gstin,
          registrationType: consolidatedBatch.customer.gstin ? "REGISTERED" : "UNREGISTERED",
          stateCode: consolidatedBatch.customer.stateCode || "27",
          stateName: consolidatedBatch.customer.stateName || "Maharashtra",
        });
      }
      const mappedCartItems: ProPosCartItem[] = consolidatedBatch.items.map((it: any, idx: number) => ({
        id: `consol_${Date.now()}_${idx}`,
        itemNo: idx + 1,
        productId: it.productId,
        name: it.name,
        sku: it.sku,
        barcode: it.barcode || `890100${idx + 10}`,
        brand: it.brand || it.style || "STANDARD",
        style: it.style || "STANDARD",
        color: it.color || "DEFAULT",
        size: it.size || "M",
        qty: it.invoiceQty,
        unitPrice: it.unitPrice || 1499.0,
        basePrice: it.unitPrice || 1499.0,
        mrp: it.mrp || it.unitPrice || 1999.0,
        taxPct: it.taxPct || 5.0,
        taxAmt: 0,
        hsnCode: it.hsnCode || "6404",
        discountPct: 0,
        discountAmt: 0,
        lineTotal: (it.unitPrice || 1499.0) * it.invoiceQty,
        isTaxInclusive: false,
        salesStaff: globalSalesperson,
      }));
      setCartItems(mappedCartItems);
    }
  }, [consolidatedBatch]);

  // Customer State (B2B Distributor initializes with Reliance Retail, Counter POS / B2C starts with Walk-in Customer)
  const [customer, setCustomer] = useState<ProPosCustomer>(
    mode === "B2B_DISTRIBUTOR" ? DEMO_RELIANCE_CUSTOMER : WALK_IN_CUSTOMER
  );
  const [selectedOutlet, setSelectedOutlet] = useState<string>(
    mode === "B2B_DISTRIBUTOR" ? "Reliance - Andheri (AND)" : ""
  );
  const [customerSearchQuery, setCustomerSearchQuery] = useState<string>(
    mode === "B2B_DISTRIBUTOR" ? "9876543210" : ""
  );
  const [showCustomerDropdown, setShowCustomerDropdown] = useState<boolean>(false);
  const [showNewCustomerModal, setShowNewCustomerModal] = useState<boolean>(false);
  const [newCustName, setNewCustName] = useState<string>("");
  const [newCustPhone, setNewCustPhone] = useState<string>("");
  const [newCustGstin, setNewCustGstin] = useState<string>("");
  const [newCustStateCode, setNewCustStateCode] = useState<string>("27");

  // Session & Draft Identifier Tracking
  const [sessionId] = useState<string>(() => `sess_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);

  // Cart & Line Items: New session starts with an EMPTY cart!
  const [cartItems, setCartItems] = useState<ProPosCartItem[]>([]);
  const [selectedCartItemId, setSelectedCartItemId] = useState<string | null>(null);
  const [billLevelDiscount, setBillLevelDiscount] = useState<number>(0);
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
    rate: 0,
    discountPct: 0,
    discountAmt: 0,
    salesStaff: "Reshma",
  });

  // Scan & Item Search State
  const [barcodeInput, setBarcodeInput] = useState<string>("");
  const [productSearchQuery, setProductSearchQuery] = useState<string>("");
  const [showProductDropdown, setShowProductDropdown] = useState<boolean>(false);
  const [showF2Modal, setShowF2Modal] = useState<boolean>(false);
  const [globalSalesperson, setGlobalSalesperson] = useState<string>("Reshma");

  // Payment Settlement State
  const [paymentMode, setPaymentMode] = useState<"CASH" | "UPI" | "CARD" | "CREDIT">("CASH");
  const [receivedAmount, setReceivedAmount] = useState<string>("0.00");
  const [upiRefNumber, setUpiRefNumber] = useState<string>("");
  const [cardAuthCode, setCardAuthCode] = useState<string>("");

  // Right Panel: More Details (COLLAPSED BY DEFAULT per UX Simplification)
  const [showMoreDetails, setShowMoreDetails] = useState<boolean>(false);
  const [billType, setBillType] = useState<string>("Product Sale");
  const [salesChannel, setSalesChannel] = useState<string>("Modern Trade (LF)");
  const [billingStore, setBillingStore] = useState<string>("Reliance - Andheri (AND)");
  const [deliveryStore, setDeliveryStore] = useState<string>("Same as Billing Store");
  const [posState, setPosState] = useState<string>("Maharashtra");
  const [poReference, setPoReference] = useState<string>("");

  // Autofocus scanner input on initial mount for instant scanning readiness
  useEffect(() => {
    const timer = setTimeout(() => {
      barcodeInputRef.current?.focus();
    }, 80);
    return () => clearTimeout(timer);
  }, []);

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
    if (paymentMode === "CASH") {
      setReceivedAmount(calculations.netPayable > 0 ? calculations.netPayable.toFixed(2) : "0.00");
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

    // 2.5. Check if explicit Packing Slip format (PS-... or ps_...)
    const isSlipFormat = targetBarcode.toUpperCase().startsWith("PS-") || targetBarcode.toLowerCase().startsWith("ps_");
    if (isSlipFormat) {
      if (currentMode !== "B2B_DISTRIBUTOR") {
        playBeep(false);
        onNotification?.(
          "B2B Workflow Required",
          `Packing Slip "${targetBarcode}" cannot be processed in B2C Counter POS. Please switch to B2B / Tax Invoice mode (Alt+3).`,
          "info"
        );
        setBarcodeInput("");
        setTimeout(() => barcodeInputRef.current?.focus(), 50);
        return;
      }

      // Resolve packing slip from prop list or construct/lookup
      const slipMatch = (packingSlips || []).find(
        (s: any) =>
          s.packingSlipNumber?.toLowerCase() === targetBarcode.toLowerCase() ||
          s.id?.toLowerCase() === targetBarcode.toLowerCase()
      );

      const resolvedSlip = slipMatch || {
        id: `ps_scanned_${Date.now()}`,
        packingSlipNumber: targetBarcode.toUpperCase(),
        salesInvoiceId: "UNBILLED",
        customerId: customer.id !== WALK_IN_CUSTOMER.id ? customer.id : "cust-ril-01",
        customerName: customer.name !== WALK_IN_CUSTOMER.name ? customer.name : "Reliance Retail Ltd (B2B)",
        status: "PACKED",
        totalPackages: 1,
        weightKg: 2.0,
        items: [
          {
            id: `psi_${Date.now()}_1`,
            productId: products[0]?.id || "p-chap-01",
            sku: products[0]?.sku || "FL-CHP-01",
            name: products[0]?.name || "Premium Leather Chappal",
            quantity: 10,
          },
        ],
      };

      if (resolvedSlip.status === "BILLED") {
        playBeep(false);
        onNotification?.(
          "Already Invoiced",
          `Packing Slip #${resolvedSlip.packingSlipNumber} has already been fully invoiced.`,
          "warning"
        );
        setBarcodeInput("");
        setTimeout(() => barcodeInputRef.current?.focus(), 50);
        return;
      }

      if (activeConsolidatedSlips.some((s) => s.packingSlipNumber === resolvedSlip.packingSlipNumber)) {
        playBeep(false);
        onNotification?.(
          "Duplicate Slip Scan",
          `Packing Slip #${resolvedSlip.packingSlipNumber} is already selected in the active consolidated invoice.`,
          "info"
        );
        setBarcodeInput("");
        setTimeout(() => barcodeInputRef.current?.focus(), 50);
        return;
      }

      // Customer compatibility check
      if (customer.id !== WALK_IN_CUSTOMER.id && resolvedSlip.customerId && resolvedSlip.customerId !== customer.id) {
        playBeep(false);
        onNotification?.(
          "Customer Incompatibility",
          `Customer Incompatibility: Packing Slip #${resolvedSlip.packingSlipNumber} belongs to "${resolvedSlip.customerName}", whereas current invoice is for "${customer.name}". Incompatible customer accounts cannot be consolidated into a single invoice.`,
          "error"
        );
        setBarcodeInput("");
        setTimeout(() => barcodeInputRef.current?.focus(), 50);
        return;
      }

      // Set customer if walk-in
      if (customer.id === WALK_IN_CUSTOMER.id && resolvedSlip.customerId) {
        const foundCust = customers.find((c) => c.id === resolvedSlip.customerId || c.name === resolvedSlip.customerName);
        if (foundCust) {
          setCustomer({
            id: foundCust.id,
            code: (foundCust as any).code || foundCust.id || "CUST-B2B",
            name: foundCust.name,
            phone: foundCust.phone || "9999999999",
            gstin: (foundCust as any).gstin,
            state: (foundCust as any).state,
            stateCode: (foundCust as any).stateCode || "27",
            registrationType: (foundCust as any).gstin ? "REGISTERED" : "UNREGISTERED",
          });
        }
      }

      setActiveConsolidatedSlips((prev) => [...prev, resolvedSlip]);

      // Add slip items to cart
      const newItems: ProPosCartItem[] = resolvedSlip.items.map((it: any, idx: number) => ({
        id: `ps_item_${Date.now()}_${idx}`,
        itemNo: cartItems.length + idx + 1,
        productId: it.productId,
        name: it.name,
        sku: it.sku,
        barcode: it.sku,
        brand: it.brand || "STANDARD",
        style: "STANDARD",
        color: "BLACK",
        size: "8",
        qty: it.quantity,
        unitPrice: 1499.0,
        basePrice: 1499.0,
        mrp: 1999.0,
        taxPct: 5.0,
        taxAmt: 0,
        hsnCode: "6404",
        discountPct: 0,
        discountAmt: 0,
        lineTotal: 1499.0 * it.quantity,
        isTaxInclusive: false,
        salesStaff: globalSalesperson,
      }));

      setCartItems((prev) => [...prev, ...newItems]);
      playBeep(true);
      onNotification?.(
        "Packing Slip Added",
        `Packing Slip #${resolvedSlip.packingSlipNumber} added to consolidated invoice (${newItems.length} items). Scanning a slip never auto-posts an invoice.`,
        "success"
      );
      setBarcodeInput("");
      setTimeout(() => barcodeInputRef.current?.focus(), 50);
      return;
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
      `Barcode "${targetBarcode}" was not found in catalog. Never guessing unknown barcodes as packing slips. Please check barcode or register product in Master Data.`,
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
    setActiveDraftId(null);
    setSelectedCartItemId(null);
    onNotification?.("Cart Cleared", "All items cleared from cart.", "info");
    setTimeout(() => barcodeInputRef.current?.focus(), 50);
  };

  // Explicit user choice: Load sample demo products only when deliberately requested
  const handleLoadSampleDemoItems = useCallback(() => {
    setCartItems(INITIAL_DEMO_CART_ITEMS);
    setBillLevelDiscount(50);
    setBillDiscountType("FLAT");
    if (currentMode === "B2B_DISTRIBUTOR") {
      setCustomer(DEMO_RELIANCE_CUSTOMER);
      setSelectedOutlet("Reliance - Andheri (AND)");
      setCustomerSearchQuery("9876543210");
    }
    onNotification?.(
      "Sample Items Loaded",
      "Loaded 6 sample footwear products into the cart for visual demonstration.",
      "info"
    );
    setTimeout(() => barcodeInputRef.current?.focus(), 50);
  }, [currentMode, onNotification]);

  // F12 / Action: Park Current Cart as Hold Slip
  const handleParkCurrentCart = useCallback(async () => {
    if (cartItems.length === 0) {
      onNotification?.("Cannot Park", "Cart is empty. Add items before parking.", "warning");
      return;
    }
    try {
      const parked = await SmritiPosParkedCartService.parkCart({
        sessionId: sessionId || effectiveShiftId || "SESS-LIVE-01",
        customer,
        salesStaff: globalSalesperson,
        items: cartItems,
        totalAmount: calculations.netPayable,
        expirationHours: 4,
      });
      setCartItems([]);
      setBillLevelDiscount(0);
      setActiveDraftId(null);
      refreshParkedCarts();
      playBeep(true);
      onNotification?.(
        "Cart Parked [F12]",
        `Cart saved as Hold Slip #${parked.holdSlipNumber}. Cart is now clear for next customer.`,
        "info"
      );
      setTimeout(() => barcodeInputRef.current?.focus(), 50);
    } catch (err: any) {
      onNotification?.("Park Failed", `Could not park cart: ${err.message}`, "error");
    }
  }, [cartItems, customer, globalSalesperson, calculations.netPayable, sessionId, effectiveShiftId, refreshParkedCarts, playBeep, onNotification]);

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

    const payload: any = {
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
      source_document_type: activeConsolidatedSlips.length > 0 ? "PACKING_SLIP_CONSOLIDATED" : undefined,
      source_document_id: activeConsolidatedSlips.length > 0 ? activeConsolidatedSlips.map((s) => s.packingSlipNumber).join(",") : undefined,
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
        source_line_type: activeConsolidatedSlips.length > 0 ? "PACKING_SLIP_ITEM" : undefined,
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
      setCartItems([]);
      setBillLevelDiscount(0);
      setActiveDraftId(null);
      setSelectedCartItemId(null);
      if (currentMode === "RETAIL_POS") {
        setCustomer(WALK_IN_CUSTOMER);
        setCustomerSearchQuery("");
      }
      setTimeout(() => barcodeInputRef.current?.focus(), 100);
      if (activeConsolidatedSlips.length > 0) {
        try {
          await apiFetchV1("/fulfillment/consolidated-finalize", {
            method: "POST",
            body: JSON.stringify({
              packing_slip_ids: activeConsolidatedSlips.map((s) => s.id),
              invoice_id: recorded.billNo,
              invoice_no: recorded.billNo,
            }),
          });
        } catch {
          // offline fallback
        }
        setActiveConsolidatedSlips([]);
        onClearConsolidatedBatch?.();
      }
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
        setCartItems([]);
        setBillLevelDiscount(0);
        setActiveDraftId(null);
        setSelectedCartItemId(null);
        if (currentMode === "RETAIL_POS") {
          setCustomer(WALK_IN_CUSTOMER);
          setCustomerSearchQuery("");
        }
        setTimeout(() => barcodeInputRef.current?.focus(), 100);
        if (activeConsolidatedSlips.length > 0) {
          setActiveConsolidatedSlips([]);
          onClearConsolidatedBatch?.();
        }
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
      if (e.key === "F12") {
        e.preventDefault();
        if (cartItems.length > 0) {
          handleParkCurrentCart();
        } else if (parkedBills.length > 0) {
          setShowParkedBillsModal(true);
        } else {
          onNotification?.("Parked Bills", "No active parked bills found for this register.", "info");
        }
        return;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cartItems, isSubmitting, handlePostTransaction, parkedBills, handleParkCurrentCart, onNotification]);

  // ── Inline SVG Footwear Icons ─────────────────────────────────────────────
  // ── Inline SVG Footwear & Apparel Icons matching Frozen Specification ────
  const ChappalThumbnail = () => (
    <div className="w-8 h-8 rounded-md bg-[#fef3c7] dark:bg-amber-950/40 border border-[#fde68a] dark:border-amber-800 flex items-center justify-center shrink-0 shadow-2xs overflow-hidden">
      <svg className="w-6 h-6 text-[#92400e]" viewBox="0 0 32 32" fill="none">
        <ellipse cx="16" cy="18" rx="11" ry="5" fill="#b45309" fillOpacity="0.8" />
        <path d="M8 18c1-4 6-7 11-7s7 3 7 7" stroke="#78350f" strokeWidth="2" strokeLinecap="round" />
        <path d="M12 18c0-3 3-5 6-5s5 2 5 5" stroke="#92400e" strokeWidth="1.5" strokeLinecap="round" />
        <ellipse cx="16" cy="18.5" rx="8" ry="3" fill="#d97706" />
      </svg>
    </div>
  );

  const SneakerThumbnail = () => (
    <div className="w-8 h-8 rounded-md bg-[#f1f5f9] dark:bg-slate-800 border border-[#cbd5e1] dark:border-slate-700 flex items-center justify-center shrink-0 shadow-2xs overflow-hidden">
      <svg className="w-6 h-6 text-[#475569]" viewBox="0 0 32 32" fill="none">
        <path d="M5 21h22c0 2-2 3-5 3H10c-3 0-5-1-5-3z" fill="#94a3b8" />
        <path d="M5 21c0-2 2-6 7-7l6-1c3 0 6 3 9 8H5z" fill="#f8fafc" stroke="#64748b" strokeWidth="1.2" />
        <path d="M14 14l2 4M17 13.5l2 4M20 13l2 4" stroke="#0284c7" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    </div>
  );

  const RunningShoeThumbnail = () => (
    <div className="w-8 h-8 rounded-md bg-[#1e293b] dark:bg-slate-900 border border-[#334155] dark:border-slate-700 flex items-center justify-center shrink-0 shadow-2xs overflow-hidden">
      <svg className="w-6 h-6 text-[#ef4444]" viewBox="0 0 32 32" fill="none">
        <path d="M5 22h22c0 2-2 3-5 3H10c-3 0-5-1-5-3z" fill="#dc2626" />
        <path d="M5 22c0-3 3-7 8-8l6-1c3 0 5 3 8 9H5z" fill="#0f172a" stroke="#ef4444" strokeWidth="1.2" />
        <path d="M13 18c3-2 7-2 10 1" stroke="#f87171" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </div>
  );

  const PoloThumbnail = () => (
    <div className="w-8 h-8 rounded-md bg-[#dbeafe] dark:bg-blue-950/60 border border-[#bfdbfe] dark:border-blue-900 flex items-center justify-center shrink-0 shadow-2xs overflow-hidden">
      <svg className="w-6 h-6 text-[#1e3a8a] dark:text-blue-400" viewBox="0 0 32 32" fill="currentColor">
        <path d="M10 8l6 3 6-3 4 3-2 5-3-1v10H11V15l-3 1-2-5 4-3z" fill="#1e3a8a" />
        <path d="M13 8l3 4 3-4" stroke="#93c5fd" strokeWidth="1.2" fill="none" />
        <circle cx="16" cy="13" r="0.8" fill="#ffffff" />
        <circle cx="16" cy="15" r="0.8" fill="#ffffff" />
      </svg>
    </div>
  );

  const JeansThumbnail = () => (
    <div className="w-8 h-8 rounded-md bg-[#eff6ff] dark:bg-blue-950/40 border border-[#bfdbfe] dark:border-blue-900 flex items-center justify-center shrink-0 shadow-2xs overflow-hidden">
      <svg className="w-6 h-6 text-[#2563eb]" viewBox="0 0 32 32" fill="none">
        <path d="M9 7h14l-1 18h-4.5l-.5-11-.5 11H10L9 7z" fill="#2563eb" stroke="#1d4ed8" strokeWidth="1.2" />
        <path d="M9 10h14M16 7v4" stroke="#93c5fd" strokeWidth="1" />
        <path d="M11 13c1 2 3 2 4 0M17 13c1 2 3 2 4 0" stroke="#bfdbfe" strokeWidth="0.8" />
      </svg>
    </div>
  );

  const HeelsThumbnail = () => (
    <div className="w-8 h-8 rounded-md bg-[#fee2e2] dark:bg-rose-950/40 border border-[#fecaca] dark:border-rose-900 flex items-center justify-center shrink-0 shadow-2xs overflow-hidden">
      <svg className="w-6 h-6 text-[#dc2626]" viewBox="0 0 32 32" fill="none">
        <path d="M6 18c4 0 7 2 9 4l5-9c2-3 4-4 7-4v2c-2 0-3 1-5 4l-4 8c-1 2-3 3-6 3H6v-4z" fill="#dc2626" />
        <path d="M21 21v6h2v-6" fill="#b91c1c" />
      </svg>
    </div>
  );

  const ShoeThumbnail = SneakerThumbnail;

  const renderProductThumbnail = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes("chappal") || lower.includes("sandal")) return <ChappalThumbnail />;
    if (lower.includes("sneaker")) return <SneakerThumbnail />;
    if (lower.includes("running") || lower.includes("sport")) return <RunningShoeThumbnail />;
    if (lower.includes("polo") || lower.includes("t-shirt") || lower.includes("shirt")) return <PoloThumbnail />;
    if (lower.includes("jean") || lower.includes("dnm") || lower.includes("trouser")) return <JeansThumbnail />;
    if (lower.includes("heel") || lower.includes("lady") || lower.includes("glam")) return <HeelsThumbnail />;
    return <SneakerThumbnail />;
  };

  const getColorDot = (color: string) => {
    const c = color.toUpperCase();
    if (c.includes("BRONZE")) return "bg-[#8B5A2B]";
    if (c.includes("WHITE")) return "bg-white border border-slate-400";
    if (c.includes("BLACK")) return "bg-black";
    if (c.includes("NAVY")) return "bg-[#1e3a8a]";
    if (c.includes("BLUE")) return "bg-[#2563eb]";
    if (c.includes("RED")) return "bg-[#dc2626]";
    return "bg-slate-500";
  };

  return (
    <div className="h-full flex flex-col bg-[#f0f4f9] dark:bg-[#0b1329] text-[#1e293b] dark:text-[#f8fafc] font-sans overflow-hidden select-none">
      {/* ── TOP HEADER (Dark Navy #041632, only rendered in standalone tab mode) ── */}
      {isStandaloneTab && (
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
      )}

      {/* ── MAIN STUDIO WORKSPACE (FROZEN UX: 2-COLUMN UPPER AREA + BOTTOM SCANNER BAR) ── */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#f0f4f9] dark:bg-[#0b1329] p-3 gap-2.5">
        {/* Upper Area: 2-Column Grid */}
        <div className="flex-1 flex flex-col lg:flex-row gap-3 min-h-0 overflow-hidden">
          {/* Left Column: Customer Card + Read-Only Cart Grid Card */}
          <div className="flex-1 flex flex-col gap-2.5 min-w-0 overflow-hidden">
            {/* ── CUSTOMER CARD ── */}
            <div className="bg-white dark:bg-[#1a233a] rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-2xs px-3.5 py-2.5">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xs font-bold text-slate-800 dark:text-slate-100">
                  Customer
                </h2>
              </div>

              {/* Customer Row: Search + Info Pill + Outlets + Buttons */}
              <div className="flex items-center gap-3 flex-wrap">
                {/* Search Bar */}
                <div className="relative w-52 shrink-0">
                  <Search size={13} className="absolute left-2.5 top-2 text-slate-400" />
                  <input
                    type="text"
                    value={customerSearchQuery}
                    onChange={(e) => {
                      setCustomerSearchQuery(e.target.value);
                      setShowCustomerDropdown(true);
                    }}
                    placeholder="Search customer..."
                    className="w-full pl-7 pr-6 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono font-medium focus:outline-hidden focus:border-blue-500"
                  />
                  {customerSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setCustomerSearchQuery("")}
                      className="absolute right-2 top-1.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X size={12} />
                    </button>
                  )}
                  {/* Customer Dropdown */}
                  {showCustomerDropdown && filteredCustomers.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 z-50 max-h-56 overflow-y-auto">
                      {filteredCustomers.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setCustomer(c as ProPosCustomer);
                            setShowCustomerDropdown(false);
                          }}
                          className="w-full text-left px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-slate-700 flex justify-between items-center border-b border-slate-100 dark:border-slate-700 text-xs cursor-pointer"
                        >
                          <div>
                            <span className="font-bold">{c.name}</span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 ml-2 font-mono">{c.phone}</span>
                          </div>
                          {c.gstin && (
                            <span className="text-[10px] bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded font-mono">
                              {c.gstin}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Customer Details Pill */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-xs text-slate-900 dark:text-slate-100">
                    {customer.name} · {customer.phone}
                  </span>
                  {customer.gstin && (
                    <span className="px-2 py-0.5 text-[10px] font-bold font-mono rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      GST: {customer.gstin}
                    </span>
                  )}
                  <select
                    value={selectedOutlet}
                    onChange={(e) => setSelectedOutlet(e.target.value)}
                    className="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-medium cursor-pointer shadow-2xs"
                  >
                    {DEMO_STORES.map((s) => (
                      <option key={s.id} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Right Action Buttons */}
                <div className="flex items-center gap-2 shrink-0 ml-auto">
                  <button
                    type="button"
                    onClick={() => setShowNewCustomerModal(true)}
                    className="flex items-center gap-1 px-2.5 py-1 border border-blue-400 bg-blue-50/50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800 rounded-lg text-xs font-bold transition cursor-pointer shadow-2xs"
                  >
                    <Plus size={12} />
                    <span>New Customer</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomer(WALK_IN_CUSTOMER)}
                    className="flex items-center gap-1 px-2.5 py-1 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 rounded-lg text-xs font-semibold cursor-pointer transition shadow-2xs"
                  >
                    <span>⇄ Change</span>
                  </button>
                </div>
              </div>

              {/* Mandatory PO banner if configured */}
              {effectiveProfileConfig?.customer_po_reference === "REQUIRED" && (
                <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 bg-amber-50/60 dark:bg-amber-950/20 px-2.5 py-1 rounded-lg border border-amber-200/80 dark:border-amber-900/40">
                  <span className="text-xs font-bold text-amber-800 dark:text-amber-300 shrink-0">
                    Customer PO Reference <span className="text-red-500">*</span>:
                  </span>
                  <input
                    type="text"
                    value={poReference === "PO / Order Ref" ? "" : poReference}
                    onChange={(e) => setPoReference(e.target.value)}
                    placeholder="Enter Customer PO / Order Ref..."
                    className="flex-1 px-2.5 py-0.5 bg-white dark:bg-slate-900 border rounded text-xs font-mono font-bold"
                  />
                </div>
              )}
            </div>

            {/* ── ITEMS IN CART GRID CARD (READ-ONLY) ── */}
            <div className="flex-1 bg-white dark:bg-[#1a233a] rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-2xs p-3.5 flex flex-col min-h-0 overflow-hidden">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-800 shrink-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xs font-bold text-slate-800 dark:text-slate-100">
                    Items in Cart ({cartItems.length})
                  </h2>
                  {activeDraftId && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 border border-amber-300 font-mono flex items-center gap-1">
                      <span>DRAFT #{activeDraftId}</span>
                      <button
                        type="button"
                        onClick={() => {
                          clearCart();
                          onNotification?.("Session Cleared", "Started fresh session.", "info");
                        }}
                        className="hover:text-red-600 font-bold ml-1 cursor-pointer"
                        title="Dismiss resumed draft and start fresh"
                      >
                        ×
                      </button>
                    </span>
                  )}
                  {activeConsolidatedSlips.length > 0 && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300 border border-blue-300 font-mono">
                      CONSOLIDATED: {activeConsolidatedSlips.length} SLIPS ({activeConsolidatedSlips.map((s: any) => s.packingSlipNumber).join(", ")})
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {cartItems.length > 0 && (
                    <>
                      <button
                        type="button"
                        onClick={handleParkCurrentCart}
                        className="flex items-center gap-1 px-2.5 py-1 border border-amber-300 bg-amber-50/70 hover:bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 rounded-lg text-xs font-semibold transition cursor-pointer shadow-2xs"
                        title="Park Cart / Hold Slip (F12)"
                      >
                        <Clock size={12} />
                        <span>Park (F12)</span>
                      </button>
                      <button
                        type="button"
                        onClick={clearCart}
                        className="flex items-center gap-1 px-2 py-1 border border-red-200 bg-red-50/50 hover:bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/50 rounded-lg text-xs font-semibold transition cursor-pointer shadow-2xs"
                        title="Clear all items from cart"
                      >
                        <Trash2 size={12} />
                        <span>Clear</span>
                      </button>
                    </>
                  )}
                  {parkedBills.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowParkedBillsModal(true)}
                      className="flex items-center gap-1 px-2.5 py-1 border border-amber-400 bg-amber-500 text-white hover:bg-amber-600 rounded-lg text-xs font-bold transition cursor-pointer shadow-2xs"
                      title="View & Resume Saved Drafts / Parked Carts"
                    >
                      <Clock size={12} />
                      <span>Drafts ({parkedBills.length})</span>
                    </button>
                  )}
                  {effectiveProfileConfig?.bulk_add_enabled !== false && (
                    <button
                      type="button"
                      id="bulk-add-items-btn"
                      onClick={() => setShowBulkAddModal(true)}
                      className="flex items-center gap-1 px-2.5 py-1 border border-indigo-300 dark:border-indigo-700 bg-indigo-50/70 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 dark:bg-indigo-950/40 rounded-lg text-xs font-bold transition cursor-pointer shadow-2xs"
                    >
                      <FileSpreadsheet size={12} />
                      <span>Bulk Add</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowF2Modal(true)}
                    className="flex items-center gap-1 px-2.5 py-1 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold transition cursor-pointer shadow-2xs"
                  >
                    <Layers size={12} />
                    <span>Select Product (F2)</span>
                  </button>
                </div>
              </div>

              {/* Read-Only Table Container (13 Columns) */}
              <div className="flex-1 overflow-auto rounded-lg border border-slate-200/80 dark:border-slate-800">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="bg-slate-100/90 dark:bg-slate-900/90 text-slate-600 dark:text-slate-400 font-bold text-[11px] uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10 select-none">
                      <th className="py-2 px-2 text-center w-8">#</th>
                      <th className="py-2 px-2.5 text-left min-w-[200px]">Product Name</th>
                      <th className="py-2 px-2 text-left font-mono">Barcode ▽</th>
                      <th className="py-2 px-2 text-left">Style ▽</th>
                      <th className="py-2 px-2 text-left">Color ▽</th>
                      <th className="py-2 px-2 text-center">Size</th>
                      <th className="py-2 px-2 text-center">Qty</th>
                      <th className="py-2 px-2 text-right">Rate (₹)</th>
                      <th className="py-2 px-2 text-right">Disc %</th>
                      <th className="py-2 px-2 text-right">Disc Amt (₹)</th>
                      <th className="py-2 px-2 text-right">Tax %</th>
                      <th className="py-2 px-2.5 text-right">Amount (₹)</th>
                      <th className="py-2 px-2.5 text-left">Salesperson</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                    {cartItems.length === 0 ? (
                      <tr>
                        <td colSpan={13} className="py-14 text-center">
                          <div className="flex flex-col items-center justify-center gap-2.5 text-slate-400 dark:text-slate-500">
                            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                              <ShoppingCart size={24} className="stroke-1.5" />
                            </div>
                            <div className="text-center">
                              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Cart is empty</p>
                              <p className="text-[11px] text-slate-400 max-w-sm mt-0.5">
                                Scan a barcode (F1), use Advanced Item Search (F2), or Bulk Add to begin this billing session.
                              </p>
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                              <button
                                type="button"
                                onClick={() => barcodeInputRef.current?.focus()}
                                className="px-3 py-1 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-lg text-xs font-semibold hover:bg-blue-100 transition cursor-pointer"
                              >
                                Start Scanning (F1)
                              </button>
                              <button
                                type="button"
                                onClick={() => setShowF2Modal(true)}
                                className="px-3 py-1 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 transition cursor-pointer"
                              >
                                Search Items (F2)
                              </button>
                              <button
                                type="button"
                                onClick={handleLoadSampleDemoItems}
                                className="px-3 py-1 bg-slate-50 dark:bg-slate-800/60 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 border border-dashed border-slate-300 dark:border-slate-700 rounded-lg text-xs font-medium transition cursor-pointer"
                                title="Explicitly load the 6 approved sample items for testing or demonstration"
                              >
                                Load Sample Items
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      cartItems.map((item, index) => {
                      const rate = item.basePrice || item.unitPrice;
                      const discAmt =
                        item.discountAmt !== undefined
                          ? item.discountAmt
                          : item.discountPct
                          ? (item.qty * rate * item.discountPct) / 100
                          : 0;
                      const amount =
                        item.lineTotal !== undefined
                          ? item.lineTotal
                          : item.qty * rate - discAmt;
                      return (
                        <tr
                          key={item.id}
                          onClick={() => setSelectedCartItemId(item.id)}
                          className={`transition cursor-default ${
                            selectedCartItemId === item.id
                              ? "bg-blue-50/60 dark:bg-blue-950/30"
                              : index % 2 === 0
                              ? "bg-white dark:bg-[#1a233a]"
                              : "bg-slate-50/50 dark:bg-slate-900/30"
                          } hover:bg-blue-50/30 dark:hover:bg-slate-800/50`}
                        >
                          <td className="py-2 px-2 text-center font-mono text-slate-400 font-semibold">
                            {index + 1}
                          </td>
                          <td className="py-2 px-2.5">
                            <div className="flex items-center gap-2.5">
                              {renderProductThumbnail(item.name)}
                              <div className="flex flex-col min-w-0">
                                <span className="font-bold text-slate-900 dark:text-slate-100 truncate leading-tight">
                                  {item.name}
                                </span>
                                <span className="text-[10px] text-slate-400 truncate leading-tight mt-0.5">
                                  {item.brand || item.sku}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="py-2 px-2 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                            {item.barcode}
                          </td>
                          <td className="py-2 px-2 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                            {item.brand || item.sku}
                          </td>
                          <td className="py-2 px-2">
                            <div className="flex items-center gap-1.5">
                              <span className={`w-2 h-2 rounded-full ${getColorDot(item.color)} shrink-0`} />
                              <span className="text-slate-700 dark:text-slate-300 font-medium">{item.color}</span>
                            </div>
                          </td>
                          <td className="py-2 px-2 text-center font-semibold text-slate-700 dark:text-slate-300">
                            {item.size}
                          </td>
                          <td className="py-2 px-2 text-center font-bold text-slate-900 dark:text-slate-100">
                            {item.qty}
                          </td>
                          <td className="py-2 px-2 text-right font-mono text-slate-700 dark:text-slate-300">
                            {rate.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-2 px-2 text-right font-mono text-slate-600 dark:text-slate-400">
                            {item.discountPct}%
                          </td>
                          <td className="py-2 px-2 text-right font-mono text-slate-600 dark:text-slate-400">
                            {discAmt.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-2 px-2 text-right font-mono text-slate-600 dark:text-slate-400">
                            {item.taxPct}%
                          </td>
                          <td className="py-2 px-2.5 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                            {amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-2 px-2.5 text-slate-700 dark:text-slate-300 font-medium">
                            {item.salesStaff || "Reshma"}
                          </td>
                        </tr>
                      );
                    }))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right Column: Bill Summary Card + Payment Method & Settlement Card */}
          <div className="w-full lg:w-80 xl:w-96 flex flex-col gap-2.5 shrink-0 overflow-y-auto">
            {/* ── BILL SUMMARY CARD ── */}
            <div className="bg-white dark:bg-[#1a233a] rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-2xs p-3.5">
              <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-slate-100 dark:border-slate-800">
                <h2 className="text-xs font-bold text-slate-800 dark:text-slate-100">
                  Bill Summary
                </h2>
                <button
                  type="button"
                  onClick={() => setShowMoreDetails(true)}
                  className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
                >
                  <span>View Details</span>
                  <ExternalLink size={12} />
                </button>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                  <span>Items ({calculations.itemCount})</span>
                  <span className="font-mono font-medium">
                    ₹ {calculations.grossTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400">
                  <span>Item Discount</span>
                  <span className="font-mono font-semibold">
                    - ₹ {calculations.totalItemDiscounts.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400">
                  <div className="flex items-center gap-1">
                    <span>Bill Discount</span>
                    <button
                      type="button"
                      onClick={() => setShowDiscountModal(true)}
                      className="text-blue-600 hover:text-blue-800 p-0.5 rounded cursor-pointer"
                      title="Edit Bill Discount"
                    >
                      <Pencil size={11} />
                    </button>
                  </div>
                  <span className="font-mono font-semibold">
                    - ₹ {calculations.billDiscount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="flex justify-between items-center text-slate-800 dark:text-slate-200 font-semibold pt-1 border-t border-slate-100 dark:border-slate-800">
                  <span>Subtotal</span>
                  <span className="font-mono">
                    ₹ {calculations.subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                  <span>GST (5%)</span>
                  <span className="font-mono">
                    ₹ {calculations.totalTax.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                {/* Highlight Box: PAYABLE AMOUNT */}
                <div className="bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-xl p-3 mt-2.5">
                  <div className="text-[11px] font-bold text-blue-900 dark:text-blue-200 uppercase tracking-wider">
                    Payable Amount
                  </div>
                  <div className="text-2xl font-black text-[#041632] dark:text-blue-100 font-mono tracking-tight mt-0.5">
                    ₹ {calculations.netPayable.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            </div>

            {/* ── PAYMENT METHOD & SETTLEMENT CARD ── */}
            <div className="bg-white dark:bg-[#1a233a] rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-2xs p-3.5">
              <div className="pb-2 mb-2.5 border-b border-slate-100 dark:border-slate-800">
                <h2 className="text-xs font-bold text-slate-800 dark:text-slate-100">
                  Payment Method &amp; Settlement
                </h2>
              </div>

              {/* 4 Tenders in a 4-col grid */}
              <div className="grid grid-cols-4 gap-1.5 mb-3">
                {(["CASH", "UPI", "CARD", "CREDIT"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPaymentMode(m)}
                    className={`py-2 px-1 rounded-lg text-xs font-bold cursor-pointer transition text-center ${
                      paymentMode === m
                        ? "bg-[#041632] text-white shadow-xs"
                        : "bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100"
                    }`}
                  >
                    {m === "CASH" ? "Cash" : m === "UPI" ? "UPI" : m === "CARD" ? "Card" : "Credit"}
                  </button>
                ))}
              </div>

              {/* Received Amount & Change Due */}
              <div className="flex items-center gap-2 mb-3">
                <div className="flex-1">
                  <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-0.5">
                    Received (₹)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={receivedAmount}
                      onChange={(e) => setReceivedAmount(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono font-bold text-right"
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

                <div className="shrink-0 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg flex flex-col items-end">
                  <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">
                    Change Due
                  </span>
                  <span className="text-sm font-extrabold font-mono text-emerald-600">
                    ₹ {changeDue.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Actions: Save & Print F7 / Settle & Save F8 */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handlePostTransaction(true)}
                  disabled={cartItems.length === 0 || isSubmitting}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-800 dark:text-slate-100 rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs disabled:opacity-50"
                >
                  <Printer size={13} />
                  <span>Save &amp; Print</span>
                  <kbd className="px-1 py-0.2 bg-slate-100 dark:bg-slate-700 rounded text-[9px] font-mono">F7</kbd>
                </button>

                <button
                  type="button"
                  onClick={() => handlePostTransaction(false)}
                  disabled={cartItems.length === 0 || isSubmitting}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-md cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 size={14} />
                  <span>Settle &amp; Save</span>
                  <kbd className="px-1 py-0.2 bg-white/20 rounded text-[9px] font-mono">F8</kbd>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── BOTTOM-ANCHORED SINGLE-LINE SCANNER BAR ── */}
        <div className="bg-white dark:bg-[#1a233a] border border-slate-200/90 dark:border-slate-800 rounded-xl px-3 py-2 shadow-xs shrink-0 flex items-center gap-2">
          {/* Barcode scanner input */}
          <form onSubmit={handleBarcodeSubmit} className="relative flex-1">
            <Barcode size={15} className="absolute left-2.5 top-2.5 text-slate-400" />
            <input
              ref={barcodeInputRef}
              type="text"
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              placeholder="Scan Barcode / Enter SKU / Item Name (Press Enter)"
              className="w-full pl-8 pr-16 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono font-medium focus:outline-hidden focus:border-blue-500"
            />
            <kbd className="absolute right-2 top-1.5 px-1.5 py-0.5 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[9px] font-mono rounded">
              F1
            </kbd>
          </form>

          {/* Qty Stepper */}
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[11px] font-semibold text-slate-500">Qty:</span>
            <div className="inline-flex items-center rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-0.5">
              <button
                type="button"
                onClick={() => setStagedProduct((prev) => ({ ...prev, qty: Math.max(1, prev.qty - 1) }))}
                className="w-5 h-5 flex items-center justify-center rounded text-slate-600 dark:text-slate-300 hover:bg-slate-100 text-xs font-bold cursor-pointer"
              >
                <Minus size={10} />
              </button>
              <input
                ref={stagedQtyInputRef}
                type="number"
                min={1}
                value={stagedProduct.qty}
                onChange={(e) => setStagedProduct((prev) => ({ ...prev, qty: Math.max(1, parseInt(e.target.value) || 1) }))}
                className="w-8 text-center py-0.5 bg-transparent border-none text-xs font-bold font-mono focus:outline-hidden"
              />
              <button
                type="button"
                onClick={() => setStagedProduct((prev) => ({ ...prev, qty: prev.qty + 1 }))}
                className="w-5 h-5 flex items-center justify-center rounded text-slate-600 dark:text-slate-300 hover:bg-slate-100 text-xs font-bold cursor-pointer"
              >
                <Plus size={10} />
              </button>
            </div>
          </div>

          {/* Rate (₹) */}
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[11px] font-semibold text-slate-500">Rate:</span>
            <input
              ref={stagedRateInputRef}
              type="number"
              value={stagedProduct.rate}
              onChange={(e) => setStagedProduct((prev) => ({ ...prev, rate: parseFloat(e.target.value) || 0 }))}
              disabled={!canOverridePrice}
              className="w-16 px-1.5 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono font-medium text-right disabled:opacity-60"
            />
          </div>

          {/* Disc % */}
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[11px] font-semibold text-slate-500">Disc%:</span>
            <input
              ref={stagedDiscountInputRef}
              type="number"
              value={stagedProduct.discountPct}
              onChange={(e) => {
                const pct = parseFloat(e.target.value) || 0;
                setStagedProduct((prev) => ({
                  ...prev,
                  discountPct: pct,
                  discountAmt: ((prev.rate * prev.qty) * pct) / 100,
                }));
              }}
              disabled={!canOverrideDiscount}
              className="w-12 px-1.5 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono font-medium text-right disabled:opacity-60"
            />
          </div>

          {/* Disc Amt (₹) */}
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[11px] font-semibold text-slate-500">Amt:</span>
            <input
              type="number"
              value={stagedProduct.discountAmt}
              onChange={(e) => {
                const amt = parseFloat(e.target.value) || 0;
                setStagedProduct((prev) => ({
                  ...prev,
                  discountAmt: amt,
                  discountPct: prev.rate * prev.qty > 0 ? (amt / (prev.rate * prev.qty)) * 100 : 0,
                }));
              }}
              disabled={!canOverrideDiscount}
              className="w-14 px-1.5 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono font-medium text-right disabled:opacity-60"
            />
          </div>

          {/* Salesperson */}
          <div className="flex items-center gap-1 shrink-0">
            <select
              ref={stagedSalespersonSelectRef}
              value={stagedProduct.salesStaff}
              onChange={(e) => setStagedProduct((prev) => ({ ...prev, salesStaff: e.target.value }))}
              className="px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-medium cursor-pointer"
            >
              {DEMO_SALESPERSONS.map((sp) => (
                <option key={sp} value={sp}>
                  {sp}
                </option>
              ))}
            </select>
          </div>

          {/* Add to Cart button */}
          <button
            type="button"
            onClick={addStagedItemToCart}
            className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer shrink-0"
          >
            <Plus size={13} />
            <span>Add to Cart</span>
          </button>
        </div>
      </div>

      {/* ── MORE DETAILS MODAL / DRAWER (COLLAPSIBLE / SECONDARY) ── */}
      {showMoreDetails && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-md bg-white dark:bg-[#1a233a] h-full shadow-2xl p-5 overflow-y-auto space-y-4 animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-1 rounded bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300">
                  <Sliders size={15} />
                </div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  More Details <span className="font-normal text-slate-400">(Optional / Secondary)</span>
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowMoreDetails(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                title="Close Details Panel"
              >
                <X size={16} />
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
                  Billing Store / Issuing Branch
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

              {/* Delivery Store */}
              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-semibold mb-1">
                  Delivery Store / Destination
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

              {/* Place of Supply State */}
              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-semibold mb-1">
                  Place of Supply (POS)
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
              {renderProductThumbnail(pendingConfirmItem.product.name)}
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
      {/* ── PARKED BILLS / RESUME DRAFT MODAL (F12) ── */}
      {showParkedBillsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 max-w-lg w-full p-5 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-amber-600" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Parked Bills &amp; Saved Drafts
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowParkedBillsModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {parkedBills.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">
                No active parked drafts found for this shift.
              </p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {parkedBills.map((record) => (
                  <div
                    key={record.holdSlipNumber}
                    className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                        #{record.holdSlipNumber}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Customer: {record.customer?.name || "Walk-in"} • Items: {record.items.length}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Parked at: {new Date(record.parkedAt).toLocaleTimeString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                        ₹ {Number(record.totalAmount || 0).toFixed(2)}
                      </span>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const recalled = await SmritiPosParkedCartService.recallCart(record.holdSlipNumber, globalSalesperson);
                            if (!recalled) {
                              onNotification?.("Recall Failed", "Hold slip not found or expired", "error");
                              return;
                            }
                            setCartItems(recalled.items);
                            if (recalled.customer) setCustomer(recalled.customer);
                            setActiveDraftId(recalled.holdSlipNumber);
                            refreshParkedCarts();
                            setShowParkedBillsModal(false);
                            onNotification?.(
                              "Draft Restored",
                              `Resumed Hold Slip #${recalled.holdSlipNumber} with ${recalled.items.length} items.`,
                              "success"
                            );
                            setTimeout(() => barcodeInputRef.current?.focus(), 50);
                          } catch (err: any) {
                            onNotification?.("Recall Failed", err.message || "Failed to recall draft", "error");
                          }
                        }}
                        className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-xs cursor-pointer shadow-2xs"
                      >
                        Resume Draft
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowParkedBillsModal(false)}
                className="px-4 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SmritiBillingStudio;
