/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.93.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { describe, it, expect } from "vitest";
import OmniOrderEngine, { CollectionSlot, OmniOrder } from "../utils/omniOrderEngine";

describe("OmniOrderEngine — Omnichannel Order Management & Click-and-Collect", () => {
  // ─── Fixture ───────────────────────────────────────────────────────────────
  function makeOrder(): OmniOrder {
    return OmniOrderEngine.placeOrder({
      channel: "WEBSITE",
      fulfilmentMode: "BOPIS",
      customerName: "Ravi Sharma",
      customerPhone: "9876543210",
      branchCode: "BR-MUM-01",
      lines: [
        { sku: "APP-POLO-NAVY-M",   productName: "Polo Shirt Navy M",   qty: 2, unitPrice: 1200 },
        { sku: "DNM-SLIM-BLK-32",   productName: "Slim Denim Black 32", qty: 1, unitPrice: 1999 },
      ],
      placedBy: "WEB-CHECKOUT",
    });
  }

  function makeSlot(overrides: Partial<CollectionSlot> = {}): CollectionSlot {
    return {
      slotId: "SLOT-MUM-001",
      date: "2026-08-29",
      startTime: "11:00",
      endTime: "12:00",
      branchCode: "BR-MUM-01",
      capacity: 10,
      booked: 3,
      ...overrides,
    };
  }

  // ─── Test 1: Order creation and line item totals ──────────────────────────
  it("creates an order with correct line totals, order total, and initial PLACED status", () => {
    const order = makeOrder();

    expect(order.orderId).toMatch(/^OMO-\d+$/);
    expect(order.channel).toBe("WEBSITE");
    expect(order.fulfilmentMode).toBe("BOPIS");
    expect(order.status).toBe("PLACED");

    // Line item totals
    expect(order.lines).toHaveLength(2);
    expect(order.lines[0].lineTotal).toBe(2400);   // 2 × 1200
    expect(order.lines[1].lineTotal).toBe(1999);   // 1 × 1999

    // Order total
    expect(order.orderTotal).toBe(4399);           // 2400 + 1999

    // Initial audit entry
    expect(order.auditLog).toHaveLength(1);
    expect(order.auditLog[0].toStatus).toBe("PLACED");
  });

  // ─── Test 2: Slot reservation and pickup token ───────────────────────────
  it("reserves a slot, increments slot.booked, generates a 6-digit pickup token, and rejects full slots", () => {
    const order = makeOrder();
    const slot = makeSlot();

    const result = OmniOrderEngine.reserveSlot(order, slot, "BOPIS-SYS");
    if ("error" in result) throw new Error(result.error);

    expect(result.order.status).toBe("SLOT_RESERVED");
    expect(result.order.slotId).toBe("SLOT-MUM-001");
    expect(result.order.pickupToken).toMatch(/^\d{6}$/);   // 6-digit OTP
    expect(result.slot.booked).toBe(4);                    // 3 + 1

    // Full slot should reject
    const fullSlot = makeSlot({ capacity: 3, booked: 3 });
    const rejected = OmniOrderEngine.reserveSlot(order, fullSlot, "BOPIS-SYS");
    expect("error" in rejected).toBe(true);
    if ("error" in rejected) expect(rejected.error).toBe("Slot is fully booked");

    // Branch mismatch should reject
    const wrongBranch = makeSlot({ branchCode: "BR-DEL-01" });
    const branchRejected = OmniOrderEngine.reserveSlot(order, wrongBranch, "BOPIS-SYS");
    expect("error" in branchRejected).toBe(true);
  });

  // ─── Test 3: Pick recording and auto-READY transition ────────────────────
  it("records picked qty per line and auto-transitions to READY_FOR_PICKUP when all lines are picked", () => {
    let order = OmniOrderEngine.transition(makeOrder(), "CONFIRMED", "OPR-001");
    order = OmniOrderEngine.transition(order, "PICKING", "PICKER-01");

    // Pick first line
    order = OmniOrderEngine.recordPick(order, "LINE-1", 2, "PICKER-01");
    expect(order.status).toBe("PICKING");       // Not all picked yet

    // Pick second line — should auto-transition
    order = OmniOrderEngine.recordPick(order, "LINE-2", 1, "PICKER-01");
    expect(order.status).toBe("READY_FOR_PICKUP");
    expect(order.readyAt).toBeDefined();
  });

  // ─── Test 4: Metrics computation ─────────────────────────────────────────
  it("computes metrics correctly across multiple orders with slot utilisation", () => {
    const o1 = makeOrder();
    const o2 = OmniOrderEngine.placeOrder({
      channel: "MOBILE_APP", fulfilmentMode: "HOME_DELIVERY",
      customerName: "Priya Nair", customerPhone: "9123456789", branchCode: "BR-MUM-01",
      lines: [{ sku: "FTW-SNEAKER-WHT-8", productName: "Sneakers", qty: 1, unitPrice: 2800 }],
      placedBy: "APP-CHECKOUT",
    });
    const o3 = OmniOrderEngine.transition(makeOrder(), "CANCELLED", "OPR-001", "Customer requested cancellation");

    const slots = [makeSlot({ capacity: 10, booked: 6 }), makeSlot({ slotId: "SLOT-002", capacity: 5, booked: 5 })];
    const metrics = OmniOrderEngine.computeMetrics([o1, o2, o3], slots);

    expect(metrics.totalOrders).toBe(3);
    expect(metrics.byChannel["WEBSITE"]).toBe(2);
    expect(metrics.byChannel["MOBILE_APP"]).toBe(1);
    expect(metrics.byFulfilmentMode["BOPIS"]).toBe(2);
    expect(metrics.byFulfilmentMode["HOME_DELIVERY"]).toBe(1);
    expect(metrics.cancellationRate).toBe(33);           // 1/3 → 33%
    expect(metrics.slotsUtilisationPct).toBe(73);        // 11/(15) → 73%
  });
});
