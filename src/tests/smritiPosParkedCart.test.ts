/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 *
 * Founders
 * Pushpa Devi Jawahar Mallah — Founder & Chairperson
 * Jawahar Ramkripal Mallah  — Founder, CEO & Chief Software Architect
 * Websites: aitdl.com | erpnbook.com | smritibooks.com
 *
 * Version    : 6.30.0
 * Created    : 2026-09-17
 * Modified   : 2026-09-17
 * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * License    : Proprietary Commercial Software
 * Classification: Internal
 *
 * Test Suite : SMRITI POS F12 Bill Park & Recall and Expiration Engine
 */

import { describe, it, expect, beforeEach } from "vitest";
import { SmritiPosParkedCartService, ParkedCartRecord } from "../services/smritiPosParkedCartService";
import type { ProPosCartItem, ProPosCustomer } from "../components/billing/propos/types";

const mockCustomer: ProPosCustomer = {
  id: "cust-vip-101",
  code: "VIP101",
  name: "Arun Mehra",
  phone: "9820098200",
  loyaltyTier: "Gold",
  customerGroup: "VIP",
};

const mockItems: ProPosCartItem[] = [
  {
    id: "item-1",
    itemNo: 1,
    sku: "8887462974641",
    barcode: "8887462974641",
    name: "Classic Beige Trouser",
    size: "32",
    color: "Beige",
    brand: "SMRITI",
    salesStaff: "SM1",
    qty: 2,
    mrp: 1499,
    unitPrice: 1499,
    discountPct: 10,
    discountAmt: 299.8,
    taxPct: 5,
    taxAmt: 134.91,
    lineTotal: 2833.11,
  },
];

describe("SmritiPosParkedCartService (F12 Park & Recall)", () => {
  beforeEach(() => {
    SmritiPosParkedCartService.clearLocalStore();
  });

  it("1. Generates canonical hold slip number with HOLD-YYYYMMDD prefix", () => {
    const slipNo = SmritiPosParkedCartService.generateHoldSlipNumber();
    expect(slipNo).toMatch(/^HOLD-\d{8}-[A-Z0-9]{4}$/);
  });

  it("2. Calculates 4-hour expiration window by default", () => {
    const before = Date.now() + 4 * 60 * 60 * 1000 - 1000;
    const expiresAtIso = SmritiPosParkedCartService.calculateExpiresAt(4);
    const expiresTime = new Date(expiresAtIso).getTime();
    const after = Date.now() + 4 * 60 * 60 * 1000 + 1000;

    expect(expiresTime).toBeGreaterThanOrEqual(before);
    expect(expiresTime).toBeLessThanOrEqual(after);
  });

  it("3. Parks active cart into local storage with PARKED status", async () => {
    const parked = await SmritiPosParkedCartService.parkCart({
      sessionId: "SESS-MUM-01",
      branchId: "BR-MUM-01",
      cashierId: "cashier-ramesh",
      customer: mockCustomer,
      salesStaff: "SM1",
      items: mockItems,
      totalAmount: 2833.11,
      expirationHours: 4,
    });

    expect(parked.status).toBe("PARKED");
    expect(parked.holdSlipNumber).toMatch(/^HOLD-/);
    expect(parked.customer.name).toBe("Arun Mehra");
    expect(parked.itemsCount).toBe(1);
    expect(parked.totalQty).toBe(2);
    expect(parked.totalAmount).toBe(2833.11);

    const activeList = SmritiPosParkedCartService.getActiveParkedCarts();
    expect(activeList.length).toBe(1);
    expect(activeList[0].holdSlipNumber).toBe(parked.holdSlipNumber);
  });

  it("4. Filters out stale carts older than 4 hours to prevent shift reconciliation deadlock", async () => {
    // Park cart 1: Fresh (expires in 4 hours)
    const freshCart = await SmritiPosParkedCartService.parkCart({
      sessionId: "SESS-01",
      customer: mockCustomer,
      salesStaff: "SM1",
      items: mockItems,
      totalAmount: 1000,
      expirationHours: 4,
    });

    // Park cart 2: Stale (parked 5 hours ago)
    const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString();
    const expiredTime = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
    const staleCart: ParkedCartRecord = {
      id: "park-stale-01",
      holdSlipNumber: "HOLD-20260917-OLD1",
      sessionId: "SESS-00",
      customer: mockCustomer,
      salesStaff: "SM1",
      items: mockItems,
      itemsCount: 1,
      totalQty: 1,
      totalAmount: 500,
      parkedAt: fiveHoursAgo,
      expiresAt: expiredTime,
      status: "PARKED",
    };

    const stored = SmritiPosParkedCartService.getAllParkedCarts();
    stored.push(staleCart);
    SmritiPosParkedCartService.seedParkedCarts(stored);

    // getActiveParkedCarts should ONLY return freshCart
    const active = SmritiPosParkedCartService.getActiveParkedCarts();
    expect(active.length).toBe(1);
    expect(active[0].holdSlipNumber).toBe(freshCart.holdSlipNumber);

    // Verify stale cart status was mutated to EXPIRED
    const all = SmritiPosParkedCartService.getAllParkedCarts();
    const updatedStale = all.find((c) => c.holdSlipNumber === staleCart.holdSlipNumber);
    expect(updatedStale?.status).toBe("EXPIRED");
  });

  it("5. Successfully recalls an active parked cart and transitions status to RECALLED", async () => {
    const parked = await SmritiPosParkedCartService.parkCart({
      sessionId: "SESS-01",
      customer: mockCustomer,
      salesStaff: "SM1",
      items: mockItems,
      totalAmount: 2833.11,
    });

    const recalled = await SmritiPosParkedCartService.recallCart(parked.holdSlipNumber, "cashier-geeta");
    expect(recalled).not.toBeNull();
    expect(recalled?.status).toBe("RECALLED");
    expect(recalled?.recalledBy).toBe("cashier-geeta");
    expect(recalled?.recalledAt).toBeDefined();

    // After recall, active count becomes 0
    const activeAfter = SmritiPosParkedCartService.getActiveParkedCarts();
    expect(activeAfter.length).toBe(0);
  });

  it("6. Rejects recall of an expired parked cart with operational error", async () => {
    const staleCart: ParkedCartRecord = {
      id: "park-stale-02",
      holdSlipNumber: "HOLD-20260917-OLD2",
      sessionId: "SESS-00",
      customer: mockCustomer,
      salesStaff: "SM1",
      items: mockItems,
      itemsCount: 1,
      totalQty: 1,
      totalAmount: 500,
      parkedAt: new Date(Date.now() - 5 * 3600000).toISOString(),
      expiresAt: new Date(Date.now() - 1 * 3600000).toISOString(),
      status: "PARKED",
    };

    SmritiPosParkedCartService.seedParkedCarts([staleCart]);

    await expect(SmritiPosParkedCartService.recallCart(staleCart.holdSlipNumber)).rejects.toThrow(
      /has expired \(> 4 hours\)/
    );
  });

  it("7. Cancels parked cart and converts to SuspendedBill for UI rendering", async () => {
    const parked = await SmritiPosParkedCartService.parkCart({
      sessionId: "SESS-01",
      customer: mockCustomer,
      salesStaff: "SM1",
      items: mockItems,
      totalAmount: 2833.11,
    });

    const suspended = SmritiPosParkedCartService.toSuspendedBill(parked);
    expect(suspended.billNo).toBe(parked.holdSlipNumber);
    expect(suspended.customer.name).toBe("Arun Mehra");
    expect(suspended.netAmount).toBe(2833.11);

    const cancelled = await SmritiPosParkedCartService.cancelParkedCart(parked.holdSlipNumber);
    expect(cancelled).toBe(true);

    const activeList = SmritiPosParkedCartService.getActiveParkedCarts();
    expect(activeList.length).toBe(0);
  });
});
