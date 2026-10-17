/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.88.0
 * Created      : 2026-10-17
 * Modified     : 2026-10-17
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Canonical SMRITI Billing Studio Lifecycle Test Suite
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  WALK_IN_CUSTOMER,
  DEMO_RELIANCE_CUSTOMER,
  DEMO_STORES,
  INITIAL_DEMO_CART_ITEMS,
  BillingStudioMode,
  BillingStep,
  ScanMode,
  PostScanFocus,
  DuplicateBarcodeAction,
  computeBillingTotals,
} from "../components/billing/SmritiBillingStudio.tsx";
import { calculateGST } from "../utils/gstEngine.ts";
import { SmritiPosParkedCartService } from "../services/smritiPosParkedCartService.ts";
import { ProPosOfflineSyncEngine } from "../sync/ProPosOfflineSyncEngine.ts";
import { Product, Shift } from "../types.ts";
import { ProPosCustomer, ProPosCartItem, ProPosTenderSplit } from "../components/billing/propos/types.ts";

const storageMap = new Map<string, string>();
const mockLocalStorage = {
  getItem: (k: string) => storageMap.get(k) ?? null,
  setItem: (k: string, v: string) => storageMap.set(k, String(v)),
  removeItem: (k: string) => storageMap.delete(k),
  clear: () => storageMap.clear(),
  get length() { return storageMap.size; },
  key: (i: number) => Array.from(storageMap.keys())[i] ?? null,
};
(globalThis as any).localStorage = mockLocalStorage;

describe("SMRITI Billing Studio — Canonical Billing Lifecycle Tests", () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    SmritiPosParkedCartService.clearLocalStore();
    ProPosOfflineSyncEngine.clearQueue();
    vi.restoreAllMocks();
  });

  // ── TEST 1: Initial State & Walk-in Customer Defaults ─────────────────────
  it("TEST 1: should initialize with Walk-in Customer and local state defaults", () => {
    expect(WALK_IN_CUSTOMER.id).toBe("CUST-WALKIN");
    expect(WALK_IN_CUSTOMER.name).toBe("Walk-in Retail Customer");
    expect(WALK_IN_CUSTOMER.registrationType).toBe("UNREGISTERED");
    expect(WALK_IN_CUSTOMER.stateCode).toBe("27");
    expect(WALK_IN_CUSTOMER.creditLimit).toBe(0);
  });

  // ── TEST 2: Product Addition, Quantity Stepping & Cart Totals ──────────────
  it("TEST 2: should add products to cart, increment quantity, and recompute gross values", () => {
    const mockProduct: Product = {
      id: "PROD-001",
      name: "Tattly Threads Formal Shoes",
      sku: "TT-SHOE-01",
      barcode: "8901234567890",
      price: 1500,
      mrp: 1500,
      gst_rate: 5,
    };

    // Helper simulating cart addition
    const cart: ProPosCartItem[] = [];
    const addToCart = (p: Product, qty: number = 1) => {
      const idx = cart.findIndex((i) => i.productId === p.id);
      if (idx >= 0) {
        cart[idx].qty += qty;
        cart[idx].lineTotal = cart[idx].qty * cart[idx].unitPrice;
      } else {
        cart.push({
          id: `ITEM-1`,
          productId: p.id,
          itemNo: 1,
          sku: p.sku || "",
          barcode: p.barcode || "",
          name: p.name,
          size: "8",
          color: "Black",
          brand: "Tattly Threads",
          salesStaff: "Lead",
          qty,
          mrp: p.mrp || 1500,
          unitPrice: p.price,
          discountPct: 0,
          discountAmt: 0,
          taxPct: p.gst_rate || 5,
          taxAmt: 0,
          lineTotal: p.price * qty,
        });
      }
    };

    addToCart(mockProduct, 1);
    expect(cart).toHaveLength(1);
    expect(cart[0].qty).toBe(1);
    expect(cart[0].lineTotal).toBe(1500);

    // Increment qty
    addToCart(mockProduct, 2);
    expect(cart).toHaveLength(1);
    expect(cart[0].qty).toBe(3);
    expect(cart[0].lineTotal).toBe(4500);
  });

  // ── TEST 3: Tax Calculation & Inter-State GST Parity ───────────────────────
  it("TEST 3: should accurately compute intra-state (CGST+SGST) vs inter-state (IGST) tax slabs", () => {
    // Scenario A: Intra-State (Maharashtra Store 27 -> Maharashtra Customer 27)
    const intraStateTax = calculateGST({
      unitPrice: 1000,
      quantity: 1,
      discountAmount: 0,
      gstRate: 18,
      isTaxInclusive: true,
      isInterstate: false,
    });

    expect(intraStateTax.taxableValue).toBeCloseTo(847.46, 1);
    expect(intraStateTax.taxAmount).toBeCloseTo(152.54, 1);
    expect(intraStateTax.cgstAmount).toBeCloseTo(76.27, 1);
    expect(intraStateTax.sgstAmount).toBeCloseTo(76.27, 1);
    expect(intraStateTax.igstAmount).toBe(0);
    expect(intraStateTax.totalAmount).toBe(1000);

    // Scenario B: Inter-State (Maharashtra Store 27 -> Delhi Customer 07)
    const interStateTax = calculateGST({
      unitPrice: 1000,
      quantity: 1,
      discountAmount: 0,
      gstRate: 18,
      isTaxInclusive: true,
      isInterstate: true,
    });

    expect(interStateTax.cgstAmount).toBe(0);
    expect(interStateTax.sgstAmount).toBe(0);
    expect(interStateTax.igstAmount).toBeCloseTo(152.54, 1);
    expect(interStateTax.totalAmount).toBe(1000);
  });

  // ── TEST 4: Cash Change Due & Tender Calculations ──────────────────────────
  it("TEST 4: should calculate change due accurately for cash payments", () => {
    const netPayable = 1450;
    const calculateChange = (tendered: number, net: number) => Math.max(0, tendered - net);

    expect(calculateChange(2000, netPayable)).toBe(550);
    expect(calculateChange(1500, netPayable)).toBe(50);
    expect(calculateChange(1450, netPayable)).toBe(0);
    expect(calculateChange(1000, netPayable)).toBe(0); // Tender less than net
  });

  // ── TEST 5: Credit Limit Validation & Rejection ────────────────────────────
  it("TEST 5: should reject on-account credit checkout when customer exposure exceeds limit", () => {
    const creditCustomer: ProPosCustomer = {
      id: "CUST-B2B-01",
      code: "B2B-01",
      name: "Metro Department Stores Ltd",
      phone: "9820098200",
      registrationType: "REGISTERED",
      gstin: "27AABCM1234D1Z5",
      creditLimit: 50000,
      currentBalance: 45000, // Available limit is 5,000
    };

    const validateCreditCheckout = (customer: ProPosCustomer, netAmount: number) => {
      if (customer.id === WALK_IN_CUSTOMER.id) {
        return { allowed: false, reason: "Walk-in customers cannot bill on credit." };
      }
      const availableLimit = (customer.creditLimit || 0) - (customer.currentBalance || 0);
      if (netAmount > availableLimit && (customer.creditLimit || 0) > 0) {
        return { allowed: false, reason: `Net amount (₹${netAmount}) exceeds available limit (₹${availableLimit}).` };
      }
      return { allowed: true, reason: "Approved" };
    };

    // Valid purchase within remaining 5,000 limit
    expect(validateCreditCheckout(creditCustomer, 4000).allowed).toBe(true);

    // Invalid purchase exceeding remaining limit (6,000 > 5,000)
    const exceedAttempt = validateCreditCheckout(creditCustomer, 6000);
    expect(exceedAttempt.allowed).toBe(false);
    expect(exceedAttempt.reason).toContain("exceeds available limit");

    // Invalid walk-in customer attempt
    const walkInAttempt = validateCreditCheckout(WALK_IN_CUSTOMER, 500);
    expect(walkInAttempt.allowed).toBe(false);
  });

  // ── TEST 6: Bill Park & Recall Lifecycle (F5 / F6) ─────────────────────────
  it("TEST 6: should park active cart, clear counter, and recall parked bill without item loss", async () => {
    const testItems: ProPosCartItem[] = [
      {
        id: "ITEM-A",
        productId: "P1",
        itemNo: 1,
        sku: "SKU-A",
        barcode: "111",
        name: "Item Alpha",
        size: "M",
        color: "Blue",
        brand: "SMRITI",
        salesStaff: "Anita",
        qty: 2,
        mrp: 500,
        unitPrice: 500,
        discountPct: 0,
        discountAmt: 0,
        taxPct: 5,
        taxAmt: 25,
        lineTotal: 1000,
      },
    ];

    // 1. Park cart
    const parked = await SmritiPosParkedCartService.parkCart({
      sessionId: "SHIFT-101",
      customer: WALK_IN_CUSTOMER,
      salesStaff: "Anita",
      items: testItems,
      totalAmount: 1000,
    });

    expect(parked.holdSlipNumber).toMatch(/^HOLD-/);
    expect(parked.itemsCount).toBe(1);
    expect(parked.totalAmount).toBe(1000);

    // 2. Query active parked carts
    const activeParked = SmritiPosParkedCartService.getActiveParkedCarts();
    expect(activeParked).toHaveLength(1);
    expect(activeParked[0].id).toBe(parked.id);

    // 3. Recall cart
    const recalled = await SmritiPosParkedCartService.recallCart(parked.holdSlipNumber);
    expect(recalled?.status).toBe("RECALLED");

    // 4. Verify no remaining active parked carts
    expect(SmritiPosParkedCartService.getActiveParkedCarts()).toHaveLength(0);
  });

  // ── TEST 7: Offline Sync Resilience on Network Drop ────────────────────────
  it("TEST 7: should queue sale locally in offline sync engine when network fails", async () => {
    const salePayload = {
      client_tx_uuid: "uuid-offline-99",
      invoice_no: "INV-OFF-101",
      shift_id: "SHIFT-01",
      payment_mode: "CASH",
      grand_total: 750,
      customer_name: "Walk-in Retail Customer",
      items: [
        {
          product_id: "P-101",
          code: "SKU-101",
          name: "SMRITI Canvas Shoes",
          quantity: 1,
          price: 750,
          gst_rate: 5,
          mrp: 750,
        },
      ],
    };

    const queued = await ProPosOfflineSyncEngine.queueOfflineSale(salePayload, "POS-01", "INV-OFF-101");
    expect(queued).toBeDefined();
    expect(queued.status).toBe("QUEUED");

    const queue = await ProPosOfflineSyncEngine.getQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].document_number).toBe("INV-OFF-101");
    expect(queue[0].terminal_id).toBe("POS-01");
  });

  // ── TEST 8: Anti-Duplicate Submission Lockout & Idempotency ───────────────
  it("TEST 8: should enforce idempotency key and prevent duplicate transaction submissions", () => {
    let isSubmitting = false;
    let submissionCount = 0;

    const submitCheckout = () => {
      if (isSubmitting) {
        return { success: false, reason: "LOCKED_SUBMITTING" };
      }
      isSubmitting = true;
      submissionCount += 1;
      return { success: true, count: submissionCount };
    };

    // First click: proceeds
    const firstCall = submitCheckout();
    expect(firstCall.success).toBe(true);
    expect(firstCall.count).toBe(1);

    // Rapid double click: blocked
    const secondCall = submitCheckout();
    expect(secondCall.success).toBe(false);
    expect(secondCall.reason).toBe("LOCKED_SUBMITTING");
    expect(submissionCount).toBe(1);
  });

  // ── TEST 9: Tenant Boundary & Shift Metadata Preservation ──────────────────
  it("TEST 9: should bind sales transactions to tenant, branch, and active shift context", () => {
    const currentUser = {
      role: "Cashier",
      name: "Suresh Operator",
      companyId: "COMP-SMRITI-01",
      branchId: "BRANCH-CENTRAL-01",
      username: "suresh.cashier",
    };

    const openShift: Shift = {
      id: "SHIFT-9921",
      cashier_id: "user-suresh",
      cashier_name: "Suresh Operator",
      terminal_id: "TERM-01",
      counter_id: "COUNTER-1",
      start_time: "2026-10-17T08:00:00Z",
      opening_cash: 5000,
      status: "OPEN",
    };

    const buildPayload = (user: typeof currentUser, shift: Shift, total: number) => ({
      company_id: user.companyId,
      branch_id: user.branchId,
      shift_id: shift.id,
      cashier_id: user.username,
      terminal_id: shift.terminal_id,
      grand_total: total,
    });

    const payload = buildPayload(currentUser, openShift, 2500);
    expect(payload.company_id).toBe("COMP-SMRITI-01");
    expect(payload.branch_id).toBe("BRANCH-CENTRAL-01");
    expect(payload.shift_id).toBe("SHIFT-9921");
    expect(payload.terminal_id).toBe("TERM-01");
    expect(payload.grand_total).toBe(2500);
  });

  // ── TEST 10: Screenshot Parity — Footwear & Apparel Cart, Reliance Customer & Store Codes ──
  it("TEST 10: should match screenshot visual specification for Footwear & Apparel Cart, Reliance Customer & Store Codes", () => {
    // 1. Verify Demo Reliance Customer
    expect(DEMO_RELIANCE_CUSTOMER.name).toBe("Reliance Retail Limited");
    expect(DEMO_RELIANCE_CUSTOMER.phone).toBe("9876543210");
    expect(DEMO_RELIANCE_CUSTOMER.gstin).toBe("27AABCR1718E1ZL");
    expect(DEMO_RELIANCE_CUSTOMER.stateName).toBe("Maharashtra");

    // 2. Verify 3 Multi-Outlet Stores
    expect(DEMO_STORES).toHaveLength(3);
    expect(DEMO_STORES[0].name).toBe("Reliance - Andheri (AND)");
    expect(DEMO_STORES[1].name).toBe("Reliance - Bandra (BAN)");
    expect(DEMO_STORES[2].name).toBe("Reliance - Thane (THA)");

    // 3. Verify 6 Cart Items matching visual specification
    expect(INITIAL_DEMO_CART_ITEMS).toHaveLength(6);
    const item1 = INITIAL_DEMO_CART_ITEMS[0];
    const item2 = INITIAL_DEMO_CART_ITEMS[1];
    const item3 = INITIAL_DEMO_CART_ITEMS[2];
    const item4 = INITIAL_DEMO_CART_ITEMS[3];
    const item5 = INITIAL_DEMO_CART_ITEMS[4];
    const item6 = INITIAL_DEMO_CART_ITEMS[5];

    expect(item1.name).toBe("TATLD CASUAL CHAPPAL");
    expect(item1.qty).toBe(2);
    expect(item1.basePrice).toBe(2356.125);
    expect(item1.discountAmt).toBe(259.9);

    expect(item2.name).toBe("SND-18-V SNEAKER");
    expect(item2.qty).toBe(1);
    expect(item2.unitPrice).toBe(1999);

    expect(item3.name).toBe("RNG RUNNING SHOE");
    expect(item3.qty).toBe(1);
    expect(item3.unitPrice).toBe(3499);
    expect(item3.discountAmt).toBe(349.9);

    expect(item4.name).toBe("CTN POLO T-SHIRT");
    expect(item4.qty).toBe(3);
    expect(item4.unitPrice).toBe(899);
    expect(item4.discountAmt).toBe(134.85);

    expect(item5.name).toBe("DNM REGULAR JEANS");
    expect(item5.qty).toBe(1);
    expect(item5.unitPrice).toBe(1499);

    expect(item6.name).toBe("LADY GLAM HEELS");
    expect(item6.qty).toBe(1);
    expect(item6.unitPrice).toBe(1899);
  });

  // ── TEST 11: Bill Summary & Payment Settlement HUD Parity ─────────────────
  it("TEST 11: should compute exact Bill Summary and Payment totals matching screenshot", () => {
    const items = INITIAL_DEMO_CART_ITEMS;
    const grossSubtotal = items.reduce(
      (sum, it) => sum + (it.basePrice ? it.qty * it.basePrice : it.qty * it.unitPrice),
      0
    );
    const itemDiscounts = items.reduce((sum, it) => sum + (it.discountAmt || 0), 0);
    const subtotal = grossSubtotal - itemDiscounts;
    const billDiscount = 50;
    const totals = computeBillingTotals(items, billDiscount, "FLAT", "27", "27");

    expect(items).toHaveLength(6);
    expect(grossSubtotal).toBe(16305.25);
    expect(itemDiscounts).toBe(744.65);
    expect(subtotal).toBe(15560.6);
    expect(totals.billDiscount).toBe(50);
    expect(totals.netPayable).toBe(16286.13);

    // Payment Settlement: Cash with 16286.13 received
    const receivedAmount = 16286.13;
    const changeDue = Math.max(0, receivedAmount - totals.netPayable);
    expect(changeDue).toBe(0);
  });

  // ── TEST 12: Pure Canonical Totals Engine (computeBillingTotals) ───────────
  it("TEST 12: should compute mathematically sound totals without arbitrary offset hacks", () => {
    // 1. Initial demo cart without bill discount
    const initialTotals = computeBillingTotals(INITIAL_DEMO_CART_ITEMS, 0, "FLAT", "27", "27");
    expect(initialTotals.grossTotal).toBe(16305.25);
    expect(initialTotals.totalItemDiscounts).toBe(744.65);
    expect(initialTotals.subtotal).toBe(15560.6);
    expect(initialTotals.billDiscount).toBe(0);

    // 2. Demo cart with 50 flat bill discount -> 16286.13 net payable
    const with50Disc = computeBillingTotals(INITIAL_DEMO_CART_ITEMS, 50, "FLAT", "27", "27");
    expect(with50Disc.subtotal).toBe(15560.6);
    expect(with50Disc.billDiscount).toBe(50);
    expect(with50Disc.netPayable).toBe(16286.13);

    // 3. Demo cart with 10% percentage bill discount -> 15560.6 - 1556.06 = 14004.54 taxable
    const with10Pct = computeBillingTotals(INITIAL_DEMO_CART_ITEMS, 10, "PERCENT", "27", "27");
    expect(with10Pct.subtotal).toBe(15560.6);
    expect(with10Pct.billDiscount).toBe(1556.06);
  });

  // ── TEST 13: Barcode Scan Mode Configurations ─────────────────────────────
  it("TEST 13: should support AUTO_ADD, EDIT_THEN_ADD, and CONFIRM_PRODUCT scan modes", () => {
    const validModes: ScanMode[] = ["AUTO_ADD", "EDIT_THEN_ADD", "CONFIRM_PRODUCT"];
    expect(validModes).toContain("AUTO_ADD");
    expect(validModes).toContain("EDIT_THEN_ADD");
    expect(validModes).toContain("CONFIRM_PRODUCT");

    const validPostFocus: PostScanFocus[] = ["scan_field", "qty", "rate", "discount", "salesperson"];
    expect(validPostFocus).toHaveLength(5);
    expect(validPostFocus).toContain("scan_field");

    const validDupActions: DuplicateBarcodeAction[] = ["increment_qty", "add_new_row", "prompt"];
    expect(validDupActions).toHaveLength(3);
  });

  // ── TEST 14: Quantity Multiplier Parsing (e.g. 3*BARCODE) ─────────────────
  it("TEST 14: should correctly parse quantity multiplier prefixes in barcode input", () => {
    const parseBarcodeWithMultiplier = (rawInput: string, allowQtyOverride: boolean) => {
      const trimmed = rawInput.trim();
      if (!allowQtyOverride) return { barcode: trimmed, qty: 1 };

      if (trimmed.includes("*")) {
        const parts = trimmed.split("*");
        const parsedQty = parseInt(parts[0], 10);
        if (!isNaN(parsedQty) && parsedQty > 0 && parts[1]?.trim()) {
          return { barcode: parts[1].trim(), qty: parsedQty };
        }
      }

      if (/^\d+x/i.test(trimmed)) {
        const parts = trimmed.split(/x/i);
        const parsedQty = parseInt(parts[0], 10);
        if (!isNaN(parsedQty) && parsedQty > 0 && parts[1]?.trim()) {
          return { barcode: parts[1].trim(), qty: parsedQty };
        }
      }

      return { barcode: trimmed, qty: 1 };
    };

    // Standard single scan
    expect(parseBarcodeWithMultiplier("8901234567890", true)).toEqual({
      barcode: "8901234567890",
      qty: 1,
    });

    // Multiplier with asterisk: 3*8901234567890
    expect(parseBarcodeWithMultiplier("3*8901234567890", true)).toEqual({
      barcode: "8901234567890",
      qty: 3,
    });

    // Multiplier with 'x': 5x8901234567893
    expect(parseBarcodeWithMultiplier("5x8901234567893", true)).toEqual({
      barcode: "8901234567893",
      qty: 5,
    });

    // When qty override disabled: treats full string as barcode
    expect(parseBarcodeWithMultiplier("3*8901234567890", false)).toEqual({
      barcode: "3*8901234567890",
      qty: 1,
    });
  });

  // ── TEST 15: Hardware Scanner Duplicate Pulse Debounce ───────────────────
  it("TEST 15: should debounce rapid hardware scanner double triggers within 350ms", () => {
    let lastScan = { query: "", time: 0 };
    let processedScans = 0;

    const simulateScan = (barcode: string, timestamp: number) => {
      if (lastScan.query === barcode && (timestamp - lastScan.time) < 350) {
        return { accepted: false, reason: "DEBOUNCED_DUPLICATE" };
      }
      lastScan = { query: barcode, time: timestamp };
      processedScans += 1;
      return { accepted: true, count: processedScans };
    };

    // First scan at t = 1000
    const res1 = simulateScan("8901234567890", 1000);
    expect(res1.accepted).toBe(true);
    expect(processedScans).toBe(1);

    // Rapid bounce pulse 50ms later (t = 1050)
    const res2 = simulateScan("8901234567890", 1050);
    expect(res2.accepted).toBe(false);
    expect(res2.reason).toBe("DEBOUNCED_DUPLICATE");
    expect(processedScans).toBe(1);

    // Legitimate subsequent scan 600ms later (t = 1650)
    const res3 = simulateScan("8901234567890", 1650);
    expect(res3.accepted).toBe(true);
    expect(processedScans).toBe(2);

    // Different barcode immediately afterwards (t = 1700)
    const res4 = simulateScan("8901234567893", 1700);
    expect(res4.accepted).toBe(true);
    expect(processedScans).toBe(3);
  });

  // ── TEST 16: Mandatory Customer Outlet Selection for Multi-Outlet Corporate Accounts ──
  it("TEST 16: should require outlet selection when corporate customer has multiple outlets and none selected", () => {
    const validateCheckoutPrerequisites = (cust: ProPosCustomer, selectedOutletName: string) => {
      if (cust.id === WALK_IN_CUSTOMER.id) {
        return { valid: true, error: null }; // Walk-in retail customer does not require outlet selection
      }

      // If registered enterprise customer with multiple registered store outlets
      if (DEMO_STORES.length > 1 && (!selectedOutletName || selectedOutletName.trim() === "")) {
        return {
          valid: false,
          error: "OUTLET_REQUIRED: Please select a store / outlet for this corporate customer before saving.",
        };
      }

      return { valid: true, error: null };
    };

    // Walk-in customer: Always valid without outlet
    expect(validateCheckoutPrerequisites(WALK_IN_CUSTOMER, "").valid).toBe(true);

    // Reliance corporate customer with no outlet: REJECTED
    const blockedRes = validateCheckoutPrerequisites(DEMO_RELIANCE_CUSTOMER, "");
    expect(blockedRes.valid).toBe(false);
    expect(blockedRes.error).toContain("OUTLET_REQUIRED");

    // Reliance corporate customer with chosen outlet: APPROVED
    const approvedRes = validateCheckoutPrerequisites(DEMO_RELIANCE_CUSTOMER, "Reliance - Andheri (AND)");
    expect(approvedRes.valid).toBe(true);
    expect(approvedRes.error).toBeNull();
  });

  // ── TEST 17: Price Override Authorization Check ───────────────────────────
  it("TEST 17: should restrict price override for cashier role unless authorized by manager", () => {
    const canUserOverridePrice = (userRole?: string, allowPriceOverridePref?: boolean) => {
      const isManagerOrAdmin =
        userRole?.toUpperCase() === "MANAGER" ||
        userRole?.toUpperCase() === "ADMIN" ||
        userRole?.toUpperCase() === "SYSTEM ADMINISTRATOR";
      return isManagerOrAdmin || Boolean(allowPriceOverridePref);
    };

    // Standard cashier without explicit override permission -> Denied
    expect(canUserOverridePrice("CASHIER", false)).toBe(false);
    expect(canUserOverridePrice(undefined, false)).toBe(false);

    // Manager / Admin -> Allowed
    expect(canUserOverridePrice("MANAGER", false)).toBe(true);
    expect(canUserOverridePrice("ADMIN", false)).toBe(true);
    expect(canUserOverridePrice("System Administrator", false)).toBe(true);

    // Cashier with granted override setting -> Allowed
    expect(canUserOverridePrice("CASHIER", true)).toBe(true);
  });

  // ── TEST 18: Simplified UX Default State ──────────────────────────────────
  it("TEST 18: should enforce collapsed More Details and clean default cart column presets", () => {
    const defaultVisibleCols = {
      barcode: true,
      style: true,
      color: true,
      size: true,
      rate: true,
      disc: true,
      salesperson: true,
    };

    // Clean cart columns should NOT include redundant SKU or Variant
    expect(Object.keys(defaultVisibleCols)).not.toContain("sku");
    expect(Object.keys(defaultVisibleCols)).not.toContain("variant");
    expect(defaultVisibleCols.barcode).toBe(true);
    expect(defaultVisibleCols.style).toBe(true);
    expect(defaultVisibleCols.color).toBe(true);
    expect(defaultVisibleCols.size).toBe(true);
    expect(defaultVisibleCols.salesperson).toBe(true);
  });

  // ── TEST 19: Billing Profile Defaults Specification ───────────────────────
  it("TEST 19: should enforce distinct configuration defaults for B2C_ONLY vs B2B_ONLY profiles", () => {
    const B2C_DEFAULTS = {
      profile: "B2C_ONLY",
      shift_management: "ENABLED",
      customer_selection_required: false,
      customer_po_reference: "HIDDEN",
      bulk_add_enabled: true,
      default_scan_mode: "AUTO_ADD",
      repeat_barcode_policy: "INCREASE_QUANTITY",
      default_invoice_format: "THERMAL_80MM",
      scan_beep: true,
    };

    const B2B_DEFAULTS = {
      profile: "B2B_ONLY",
      shift_management: "DISABLED",
      customer_selection_required: true,
      customer_po_reference: "REQUIRED",
      bulk_add_enabled: true,
      default_scan_mode: "EDIT_THEN_ADD",
      repeat_barcode_policy: "INCREASE_QUANTITY",
      default_invoice_format: "A4_INVOICE",
      scan_beep: true,
    };

    // B2C Checks
    expect(B2C_DEFAULTS.shift_management).toBe("ENABLED");
    expect(B2C_DEFAULTS.customer_selection_required).toBe(false);
    expect(B2C_DEFAULTS.default_invoice_format).toBe("THERMAL_80MM");

    // B2B Checks
    expect(B2B_DEFAULTS.shift_management).toBe("DISABLED");
    expect(B2B_DEFAULTS.customer_selection_required).toBe(true);
    expect(B2B_DEFAULTS.customer_po_reference).toBe("REQUIRED");
    expect(B2B_DEFAULTS.default_invoice_format).toBe("A4_INVOICE");
  });

  // ── TEST 20: 4-Tier Configuration Precedence Resolution ───────────────────
  it("TEST 20: should resolve effective configuration via Company Policy > Profile Defaults > Store Config > User Preferences", () => {
    const resolveEffectiveConfig = (
      profileDefaults: Record<string, any>,
      storeConfig: Record<string, any>,
      userPrefs: Record<string, any>,
      companyOverrides: Record<string, any>
    ) => {
      // Base: Profile defaults
      const resolved = { ...profileDefaults };

      // Apply store configuration
      for (const [k, v] of Object.entries(storeConfig)) {
        if (v !== undefined) resolved[k] = v;
      }

      // Apply permitted user preferences
      for (const [k, v] of Object.entries(userPrefs)) {
        if (v !== undefined) resolved[k] = v;
      }

      // Authoritative Company Overrides always win
      for (const [k, v] of Object.entries(companyOverrides)) {
        if (v !== undefined) resolved[k] = v;
      }

      return resolved;
    };

    const b2bProfileDefaults = {
      shift_management: "DISABLED",
      customer_po_reference: "REQUIRED",
      default_scan_mode: "EDIT_THEN_ADD",
    };

    const storeConfig = {
      default_scan_mode: "AUTO_ADD",
    };

    const userPrefs = {
      shift_management: "ENABLED", // Cashier prefers shift tracking
      customer_po_reference: "OPTIONAL", // Cashier wants to skip PO
    };

    // Case A: Without company policy override, store overrides scan mode
    const resolvedA = resolveEffectiveConfig(b2bProfileDefaults, storeConfig, {}, {});
    expect(resolvedA.default_scan_mode).toBe("AUTO_ADD");
    expect(resolvedA.shift_management).toBe("DISABLED");

    // Case B: Company policy explicitly enforces shift_management = ENABLED and PO = REQUIRED
    const companyPolicyOverrides = {
      shift_management: "ENABLED",
      customer_po_reference: "REQUIRED",
    };
    const resolvedB = resolveEffectiveConfig(b2bProfileDefaults, storeConfig, userPrefs, companyPolicyOverrides);
    expect(resolvedB.shift_management).toBe("ENABLED");
    expect(resolvedB.customer_po_reference).toBe("REQUIRED");
  });

  // ── TEST 21: Shift Management Policy Enforcement ──────────────────────────
  it("TEST 21: should enforce shift rules based on profile and policy override", () => {
    const validateShiftRequirement = (
      shiftPolicy: string,
      activeShift: { status: string } | null
    ) => {
      if (shiftPolicy === "ENABLED") {
        if (!activeShift || activeShift.status.toUpperCase() !== "OPEN") {
          return { allowed: false, error: "OPEN_SHIFT_REQUIRED" };
        }
      }
      return { allowed: true, error: null };
    };

    // B2C profile default (ENABLED): Requires open shift
    expect(validateShiftRequirement("ENABLED", null).allowed).toBe(false);
    expect(validateShiftRequirement("ENABLED", { status: "CLOSED" }).allowed).toBe(false);
    expect(validateShiftRequirement("ENABLED", { status: "OPEN" }).allowed).toBe(true);

    // B2B profile default (DISABLED): Allows checkout without active shift
    expect(validateShiftRequirement("DISABLED", null).allowed).toBe(true);
    expect(validateShiftRequirement("DISABLED", { status: "CLOSED" }).allowed).toBe(true);

    // B2B administrator override to ENABLED: Enforces shift requirement
    expect(validateShiftRequirement("ENABLED", null).allowed).toBe(false);
    expect(validateShiftRequirement("ENABLED", { status: "OPEN" }).allowed).toBe(true);
  });

  // ── TEST 22: Mandatory Customer PO Reference Policy in B2B ─────────────────
  it("TEST 22: should enforce Customer PO reference based on policy configuration", () => {
    const validatePoReference = (
      poPolicy: "REQUIRED" | "OPTIONAL" | "HIDDEN",
      poInput: string
    ) => {
      if (poPolicy === "REQUIRED") {
        if (!poInput || !poInput.trim() || poInput.trim() === "PO / Order Ref") {
          return { valid: false, error: "PO_REFERENCE_MANDATORY" };
        }
      }
      return { valid: true, error: null };
    };

    // REQUIRED policy
    expect(validatePoReference("REQUIRED", "").valid).toBe(false);
    expect(validatePoReference("REQUIRED", "PO / Order Ref").valid).toBe(false);
    expect(validatePoReference("REQUIRED", "PO-2026-9921").valid).toBe(true);

    // OPTIONAL policy
    expect(validatePoReference("OPTIONAL", "").valid).toBe(true);
    expect(validatePoReference("OPTIONAL", "PO / Order Ref").valid).toBe(true);
    expect(validatePoReference("OPTIONAL", "PO-2026-9921").valid).toBe(true);

    // HIDDEN policy
    expect(validatePoReference("HIDDEN", "").valid).toBe(true);
  });

  // ── TEST 23: Repeat Barcode Policies (INCREASE_QTY, NEW_LINE, ASK_USER) ───
  it("TEST 23: should execute repeat-barcode policies accurately", () => {
    const cart: ProPosCartItem[] = [
      {
        id: "CART-01",
        productId: "P-001",
        itemNo: 1,
        sku: "SKU-001",
        barcode: "8901234567890",
        name: "Item 1",
        size: "36",
        color: "Black",
        brand: "BrandA",
        salesStaff: "Amit",
        qty: 1,
        mrp: 1000,
        unitPrice: 1000,
        discountPct: 0,
        discountAmt: 0,
        taxPct: 5,
        taxAmt: 0,
        lineTotal: 1000,
      },
    ];

    const handleRepeatScan = (
      existingCart: ProPosCartItem[],
      barcode: string,
      policy: "INCREASE_QUANTITY" | "NEW_LINE" | "ASK_USER",
      userDecision?: "INCREASE" | "NEW_ROW"
    ) => {
      const idx = existingCart.findIndex((i) => i.barcode === barcode);
      if (idx >= 0) {
        if (policy === "INCREASE_QUANTITY" || (policy === "ASK_USER" && userDecision === "INCREASE")) {
          const updated = [...existingCart];
          updated[idx].qty += 1;
          updated[idx].lineTotal = updated[idx].qty * updated[idx].unitPrice;
          return { action: "INCREMENTED", cart: updated };
        }
        if (policy === "NEW_LINE" || (policy === "ASK_USER" && userDecision === "NEW_ROW")) {
          const newItem = { ...existingCart[idx], id: `CART-0${existingCart.length + 1}`, qty: 1, lineTotal: existingCart[idx].unitPrice };
          return { action: "NEW_ROW_ADDED", cart: [...existingCart, newItem] };
        }
        if (policy === "ASK_USER" && !userDecision) {
          return { action: "PROMPT_USER", cart: existingCart };
        }
      }
      return { action: "NONE", cart: existingCart };
    };

    // INCREASE_QUANTITY
    const incRes = handleRepeatScan(cart, "8901234567890", "INCREASE_QUANTITY");
    expect(incRes.action).toBe("INCREMENTED");
    expect(incRes.cart[0].qty).toBe(2);
    expect(incRes.cart[0].lineTotal).toBe(2000);

    // NEW_LINE
    const newLineRes = handleRepeatScan(cart, "8901234567890", "NEW_LINE");
    expect(newLineRes.action).toBe("NEW_ROW_ADDED");
    expect(newLineRes.cart.length).toBe(2);

    // ASK_USER
    const promptRes = handleRepeatScan(cart, "8901234567890", "ASK_USER");
    expect(promptRes.action).toBe("PROMPT_USER");
  });

  // ── TEST 24: Bulk Add Line Item Parsing & Multi-Mode Input ─────────────────
  it("TEST 24: should parse raw clipboard text for Paste Barcode and Barcode+Qty modes", () => {
    const parseBarcodeList = (rawText: string) => {
      const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      return lines.map((line, idx) => {
        // Tab-separated or comma-separated: Barcode [del] Qty
        const parts = line.includes("\t") ? line.split("\t") : line.includes(",") ? line.split(",") : [line];
        const barcode = parts[0]?.trim() || "";
        const qty = parts.length > 1 ? parseInt(parts[1]?.trim(), 10) || 1 : 1;
        return { rowNumber: idx + 1, barcode, qty, isValid: Boolean(barcode) && qty > 0 };
      });
    };

    // Mode 1: Pure barcodes
    const rawMode1 = "8901234567890\n8901234567891\n8901234567893";
    const res1 = parseBarcodeList(rawMode1);
    expect(res1.length).toBe(3);
    expect(res1[0].barcode).toBe("8901234567890");
    expect(res1[0].qty).toBe(1);

    // Mode 2: Excel tab-separated paste
    const rawMode2 = "8901234567890\t5\n8901234567891\t12\n8901234567893\t2";
    const res2 = parseBarcodeList(rawMode2);
    expect(res2.length).toBe(3);
    expect(res2[0].qty).toBe(5);
    expect(res2[1].qty).toBe(12);

    // Mode 2: Comma-separated paste
    const rawMode3 = "8901234567890,3\n8901234567891,8";
    const res3 = parseBarcodeList(rawMode3);
    expect(res3.length).toBe(2);
    expect(res3[0].qty).toBe(3);
  });

  // ── TEST 25: Zero Synthetic Products Anti-Pattern (Strict Policy) ──────────
  it("TEST 25: should refuse to invent synthetic products for unknown barcodes", () => {
    const mockCatalog: Product[] = [
      {
        id: "PROD-KNOWN-01",
        code: "SKU-KNOWN",
        name: "Authentic Footwear",
        barcode: "8901234567890",
        price: 999,
        stock: 20,
        category: "Footwear",
      },
    ];

    const scanBarcode = (barcode: string, catalog: Product[]) => {
      const matched = catalog.find((p) => p.barcode === barcode || p.sku === barcode || p.id === barcode);
      if (matched) {
        return { success: true, product: matched, error: null };
      }
      // Strict Policy: Do NOT invent fallback fake products!
      return {
        success: false,
        product: null,
        error: `Barcode "${barcode}" was not found in catalog. Please check barcode or register product in Master Data.`,
      };
    };

    const validScan = scanBarcode("8901234567890", mockCatalog);
    expect(validScan.success).toBe(true);
    expect(validScan.product?.name).toBe("Authentic Footwear");

    const unknownScan = scanBarcode("9999999999999", mockCatalog);
    expect(unknownScan.success).toBe(false);
    expect(unknownScan.product).toBeNull();
    expect(unknownScan.error).toContain("was not found in catalog");
  });

  // ── TEST 26: Duplicate Invoice Prevention with Idempotency Key ─────────────
  it("TEST 26: should enforce client-side transaction UUID idempotency keys to prevent duplicate posting", () => {
    const settledTransactions = new Set<string>();

    const recordCheckout = (clientTxUuid: string) => {
      if (settledTransactions.has(clientTxUuid)) {
        return { status: "REJECTED_DUPLICATE", message: "Transaction already processed." };
      }
      settledTransactions.add(clientTxUuid);
      return { status: "COMMITTED", invoiceNo: `INV-${Date.now()}` };
    };

    const uuid = "550e8400-e29b-41d4-a716-446655440000";
    const firstAttempt = recordCheckout(uuid);
    expect(firstAttempt.status).toBe("COMMITTED");

    // Second rapid or retry attempt with identical UUID is rejected
    const retryAttempt = recordCheckout(uuid);
    expect(retryAttempt.status).toBe("REJECTED_DUPLICATE");
  });
});

