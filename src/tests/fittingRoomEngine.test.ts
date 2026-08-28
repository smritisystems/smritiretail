/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.89.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { describe, it, expect } from "vitest";
import FittingRoomEngine, { RFIDGarmentTag, FittingRoomSession } from "../utils/fittingRoomEngine";

describe("FittingRoomEngine — RFID Smart Fitting Room & Garment Interaction Analytics", () => {
  // ─── Fixture ───────────────────────────────────────────────────────────────
  function makeSampleGarments(): RFIDGarmentTag[] {
    return [
      {
        rfidTag: "RFID-TAG-001",
        sku: "APP-POLO-NAVY-M",
        productName: "Polo Shirt Navy M",
        category: "Apparel",
        size: "M",
        color: "Navy",
        mrp: 1499,
        sellingPrice: 1200,
      },
      {
        rfidTag: "RFID-TAG-002",
        sku: "DNM-SLIM-BLK-32",
        productName: "Slim Fit Denim Black 32",
        category: "Denim",
        size: "32",
        color: "Black",
        mrp: 2499,
        sellingPrice: 1999,
      },
    ];
  }

  // ─── Test 1: Session open with garments and RFID events ──────────────────
  it("opens a fitting room session with correct BROUGHT_IN events for each RFID tag", () => {
    const garments = makeSampleGarments();
    const session = FittingRoomEngine.openSession({ roomId: "FR-01", garmentTags: garments, customerId: "CUST-001" });

    expect(session.roomId).toBe("FR-01");
    expect(session.status).toBe("TRIAL_IN_PROGRESS");
    expect(session.customerId).toBe("CUST-001");
    expect(session.garments).toHaveLength(2);
    expect(session.garments.every((e) => e.action === "BROUGHT_IN")).toBe(true);
    expect(session.garments[0].rfidTag).toBe("RFID-TAG-001");
    expect(session.garments[1].rfidTag).toBe("RFID-TAG-002");
  });

  // ─── Test 2: Cross-sell recommendation generation ────────────────────────
  it("generates cross-sell recommendations with affinity > 0.7 from Apparel and Denim categories", () => {
    const garments = makeSampleGarments();
    const session = FittingRoomEngine.openSession({ roomId: "FR-01", garmentTags: garments });

    expect(session.crossSellsGenerated.length).toBeGreaterThan(0);
    expect(session.crossSellsGenerated.length).toBeLessThanOrEqual(5); // capped at 5

    // All cross-sells must be above the 0.7 affinity threshold
    session.crossSellsGenerated.forEach((rec) => {
      expect(rec.affinity).toBeGreaterThan(0.7);
    });

    // Sorted descending by affinity
    for (let i = 0; i < session.crossSellsGenerated.length - 1; i++) {
      expect(session.crossSellsGenerated[i].affinity).toBeGreaterThanOrEqual(session.crossSellsGenerated[i + 1].affinity);
    }
  });

  // ─── Test 3: Garment exit recording and session status transition ─────────
  it("records TAKEN_OUT event and marks session VACANT when all garments exit", () => {
    const garments = makeSampleGarments();
    let session = FittingRoomEngine.openSession({ roomId: "FR-02", garmentTags: garments });

    // Remove first garment (not purchased)
    session = FittingRoomEngine.recordGarmentOut(session, "RFID-TAG-001", false);
    expect(session.status).toBe("TRIAL_IN_PROGRESS");  // Still has TAG-002

    const outEvent = session.garments.find((e) => e.rfidTag === "RFID-TAG-001" && e.action === "TAKEN_OUT");
    expect(outEvent).toBeDefined();
    expect(outEvent?.action).toBe("TAKEN_OUT");

    // Remove second garment as purchased
    session = FittingRoomEngine.recordGarmentOut(session, "RFID-TAG-002", true);
    expect(session.status).toBe("VACANT");

    const purchaseEvent = session.garments.find((e) => e.rfidTag === "RFID-TAG-002" && e.action === "PURCHASED");
    expect(purchaseEvent).toBeDefined();
    expect(purchaseEvent?.action).toBe("PURCHASED");
  });

  // ─── Test 4: Analytics computation for multi-session data ────────────────
  it("computes fitting room analytics with correct conversion rate and top-trialled SKUs", () => {
    const garments = makeSampleGarments();

    // Session A: Customer tries both garments, buys one
    let sessionA = FittingRoomEngine.openSession({ roomId: "FR-03", garmentTags: garments });
    sessionA = FittingRoomEngine.recordGarmentOut(sessionA, "RFID-TAG-001", true);   // Purchased
    sessionA = FittingRoomEngine.recordGarmentOut(sessionA, "RFID-TAG-002", false);  // Returned

    // Session B: Customer tries only the polo
    let sessionB = FittingRoomEngine.openSession({ roomId: "FR-04", garmentTags: [garments[0]] });
    sessionB = FittingRoomEngine.recordGarmentOut(sessionB, "RFID-TAG-001", false);

    const analytics = FittingRoomEngine.computeAnalytics([sessionA, sessionB]);

    expect(analytics.totalSessions).toBe(2);
    expect(analytics.totalGarmentsTrialled).toBe(3);  // 2 in A + 1 in B
    expect(analytics.totalGarmentsPurchased).toBe(1); // 1 purchased in A

    // Conversion rate: 1/3 = 33.33%
    expect(analytics.conversionRate).toBeCloseTo(33.33, 0);

    // Top trialled SKU should be APP-POLO-NAVY-M (tried in both sessions)
    expect(analytics.topTrialledSkus[0].sku).toBe("APP-POLO-NAVY-M");
    expect(analytics.topTrialledSkus[0].trialCount).toBe(2);
    expect(analytics.topTrialledSkus[0].purchaseCount).toBe(1);

    // Abandoned garments: Denim was tried but never purchased
    const abandonedDenim = analytics.abandonedGarments.find((a) => a.sku === "DNM-SLIM-BLK-32");
    expect(abandonedDenim).toBeDefined();
  });
});
