/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.30.0
 * Created      : 2026-09-17
 * Modified     : 2026-09-17
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: SMRITI POS Counter Resilience — F12 Park & Recall Engine
 */

import { apiFetchV1 } from "../lib/apiFetchV1";
import type { ProPosCartItem, ProPosCustomer, SuspendedBill } from "../components/billing/propos/types";

export interface ParkedCartRecord {
  id: string;
  holdSlipNumber: string;
  sessionId: string;
  cashierId?: string;
  branchId?: string;
  customer: ProPosCustomer;
  salesStaff: string;
  items: ProPosCartItem[];
  itemsCount: number;
  totalQty: number;
  totalAmount: number;
  parkedAt: string;
  expiresAt: string;
  status: "PARKED" | "RECALLED" | "CANCELLED" | "EXPIRED";
  recalledAt?: string;
  recalledBy?: string;
}

export class SmritiPosParkedCartService {
  private static readonly STORAGE_KEY = "smriti_pos_parked_carts";
  public static readonly DEFAULT_EXPIRATION_HOURS = 4;
  private static memoryStore = new Map<string, string>();

  private static getStoredRaw(): string | null {
    if (typeof localStorage !== "undefined") {
      try {
        return localStorage.getItem(this.STORAGE_KEY);
      } catch {
        return this.memoryStore.get(this.STORAGE_KEY) || null;
      }
    }
    return this.memoryStore.get(this.STORAGE_KEY) || null;
  }

  private static setStoredRaw(value: string): void {
    this.memoryStore.set(this.STORAGE_KEY, value);
    if (typeof localStorage !== "undefined") {
      try {
        localStorage.setItem(this.STORAGE_KEY, value);
      } catch {
        // Fallback to memoryStore
      }
    }
  }

  public static clearLocalStore(): void {
    this.memoryStore.clear();
    if (typeof localStorage !== "undefined") {
      try {
        localStorage.removeItem(this.STORAGE_KEY);
      } catch {
        // Ignore
      }
    }
  }

  public static seedParkedCarts(carts: ParkedCartRecord[]): void {
    this.setStoredRaw(JSON.stringify(carts));
  }

  /**
   * Generates a canonical hold slip number: HOLD-YYYYMMDD-XXXX
   */
  public static generateHoldSlipNumber(): string {
    const d = new Date();
    const dateStr = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
    const randSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `HOLD-${dateStr}-${randSuffix}`;
  }

  /**
   * Calculates expiration timestamp (default 4 hours)
   */
  public static calculateExpiresAt(hours: number = SmritiPosParkedCartService.DEFAULT_EXPIRATION_HOURS): string {
    const expires = new Date(Date.now() + hours * 60 * 60 * 1000);
    return expires.toISOString();
  }

  /**
   * Checks if a parked cart is expired
   */
  public static isCartExpired(cart: ParkedCartRecord): boolean {
    if (cart.status === "EXPIRED") return true;
    const expiresTime = new Date(cart.expiresAt).getTime();
    return !isNaN(expiresTime) && Date.now() > expiresTime;
  }

  /**
   * Parks the active cart with 4-hour automatic expiration window.
   * Stored locally for immediate counter responsiveness and synced to Postgres durability layer.
   */
  public static async parkCart(params: {
    sessionId: string;
    branchId?: string;
    cashierId?: string;
    customer: ProPosCustomer;
    salesStaff: string;
    items: ProPosCartItem[];
    totalAmount: number;
    expirationHours?: number;
  }): Promise<ParkedCartRecord> {
    const now = new Date();
    const holdSlipNumber = this.generateHoldSlipNumber();
    const expiresAt = this.calculateExpiresAt(params.expirationHours || this.DEFAULT_EXPIRATION_HOURS);

    const totalQty = params.items.reduce((sum, it) => sum + (it.qty || 0), 0);
    const newCart: ParkedCartRecord = {
      id: `park-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      holdSlipNumber,
      sessionId: params.sessionId,
      branchId: params.branchId || "BR-001",
      cashierId: params.cashierId || "cashier-1",
      customer: params.customer,
      salesStaff: params.salesStaff,
      items: params.items,
      itemsCount: params.items.length,
      totalQty,
      totalAmount: params.totalAmount,
      parkedAt: now.toISOString(),
      expiresAt,
      status: "PARKED",
    };

    // 1. Save to local storage / memory store for instant zero-latency counter resilience
    const stored = this.getAllParkedCarts();
    stored.unshift(newCart);
    this.setStoredRaw(JSON.stringify(stored));

    // 2. Asynchronously persist to PostgreSQL durability layer
    try {
      void apiFetchV1("/pos/parked-carts", {
        method: "POST",
        body: JSON.stringify({
          hold_slip_number: holdSlipNumber,
          branch_id: newCart.branchId,
          session_id: newCart.sessionId,
          cashier_id: newCart.cashierId,
          customer_id: params.customer.id,
          customer_name: params.customer.name,
          customer_phone: params.customer.phone,
          items_count: newCart.itemsCount,
          total_amount: newCart.totalAmount,
          cart_snapshot: {
            customer: params.customer,
            salesStaff: params.salesStaff,
            items: params.items,
            totalQty,
            totalAmount: params.totalAmount,
          },
          expiration_hours: params.expirationHours || this.DEFAULT_EXPIRATION_HOURS,
        }),
      }).catch(() => {
        // Tolerant: Postgres offline does not freeze POS
      });
    } catch {
      // Ignore background fetch error
    }

    return newCart;
  }

  /**
   * Retrieves all parked carts from local store.
   */
  public static getAllParkedCarts(): ParkedCartRecord[] {
    try {
      const raw = this.getStoredRaw();
      if (!raw) return [];
      return JSON.parse(raw) as ParkedCartRecord[];
    } catch {
      return [];
    }
  }

  /**
   * Retrieves only ACTIVE, non-expired parked carts.
   * Carts older than 4 hours are automatically flagged as EXPIRED.
   */
  public static getActiveParkedCarts(): ParkedCartRecord[] {
    const all = this.getAllParkedCarts();
    let hasMutated = false;

    const active: ParkedCartRecord[] = [];
    for (const cart of all) {
      if (cart.status === "PARKED") {
        if (this.isCartExpired(cart)) {
          cart.status = "EXPIRED";
          hasMutated = true;
        } else {
          active.push(cart);
        }
      }
    }

    if (hasMutated) {
      this.setStoredRaw(JSON.stringify(all));
    }

    return active;
  }

  /**
   * Recalls a parked cart by hold slip number, marking it RECALLED.
   */
  public static async recallCart(holdSlipNumber: string, recalledBy?: string): Promise<ParkedCartRecord | null> {
    const all = this.getAllParkedCarts();
    const cartIndex = all.findIndex((c) => c.holdSlipNumber === holdSlipNumber);

    if (cartIndex === -1) return null;

    const cart = all[cartIndex];
    if (this.isCartExpired(cart)) {
      cart.status = "EXPIRED";
      this.setStoredRaw(JSON.stringify(all));
      throw new Error(`Hold slip ${holdSlipNumber} has expired (> 4 hours). Shift reconciliation excludes stale carts.`);
    }

    cart.status = "RECALLED";
    cart.recalledAt = new Date().toISOString();
    cart.recalledBy = recalledBy || "cashier-1";

    this.setStoredRaw(JSON.stringify(all));

    // Notify backend
    try {
      void apiFetchV1(`/pos/parked-carts/${encodeURIComponent(holdSlipNumber)}/recall`, {
        method: "POST",
      }).catch(() => {});
    } catch {
      // Ignore
    }

    return cart;
  }

  /**
   * Cancels a parked cart by hold slip number.
   */
  public static async cancelParkedCart(holdSlipNumber: string): Promise<boolean> {
    const all = this.getAllParkedCarts();
    const cart = all.find((c) => c.holdSlipNumber === holdSlipNumber);
    if (!cart) return false;

    cart.status = "CANCELLED";
    this.setStoredRaw(JSON.stringify(all));

    try {
      void apiFetchV1(`/pos/parked-carts/${encodeURIComponent(holdSlipNumber)}`, {
        method: "DELETE",
      }).catch(() => {});
    } catch {
      // Ignore
    }

    return true;
  }

  /**
   * Helper to convert ParkedCartRecord to SuspendedBill format for existing UI components.
   */
  public static toSuspendedBill(cart: ParkedCartRecord): SuspendedBill {
    return {
      id: cart.id,
      billNo: cart.holdSlipNumber,
      timestamp: new Date(cart.parkedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      customer: cart.customer,
      salesStaff: cart.salesStaff,
      items: cart.items,
      itemCount: cart.itemsCount,
      totalQty: cart.totalQty,
      netAmount: cart.totalAmount,
    };
  }
}
