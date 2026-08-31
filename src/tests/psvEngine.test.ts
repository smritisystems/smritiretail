/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.9.0
 * Created      : 2026-08-22
 * Modified     : 2026-08-22
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Test Suite   : Party Stock Visibility (PSV) Engine & Partner Sell-Through Verification
 */

import { describe, it, expect } from "vitest";
import {
  computeSkuLyingWithPartner,
  computeSkuSellThrough,
  computeTotalLyingWithPartner,
  computeOverallSellThrough
} from "../services/partnerSellThru.ts";
import { PSVParty, PSVPartySkuTracking } from "../types.ts";

describe("Party Stock Visibility (PSV) & Partner Sell-Through Engine", () => {
  const sampleSku1: PSVPartySkuTracking = {
    productId: "PROD-001",
    sku: "TSHIRT-BLK-M",
    invoicedQty: 100,
    confirmedSoldQty: 65,
    returnedQty: 5
  };

  const sampleSku2: PSVPartySkuTracking = {
    productId: "PROD-002",
    sku: "JEANS-SLIM-32",
    invoicedQty: 80,
    confirmedSoldQty: 30,
    returnedQty: 2
  };

  const sampleParty: PSVParty = {
    id: "PSV-BLR-01",
    name: "Southern Distributor Hub",
    location: "Bangalore Central",
    stockCount: 84,
    sellThrough: 43.5,
    weeksOfCover: 5.2,
    capitalLocked: 129500,
    status: "Healthy",
    skuTracking: [sampleSku1, sampleSku2]
  };

  it("should accurately compute SKU inventory lying with partner (Invoiced - Sold - Returned)", () => {
    const lyingSku1 = computeSkuLyingWithPartner(sampleSku1);
    expect(lyingSku1).toBe(30); // 100 - 65 - 5

    const lyingSku2 = computeSkuLyingWithPartner(sampleSku2);
    expect(lyingSku2).toBe(48); // 80 - 30 - 2
  });

  it("should accurately compute individual SKU sell-through percentage", () => {
    const sellThrough1 = computeSkuSellThrough(sampleSku1);
    expect(sellThrough1).toBe(65); // 65 / 100 * 100

    const sellThrough2 = computeSkuSellThrough(sampleSku2);
    expect(sellThrough2).toBe(37.5); // 30 / 80 * 100
  });

  it("should handle edge cases with 0 invoiced quantity without throwing NaN or infinity", () => {
    const zeroSku: PSVPartySkuTracking = {
      productId: "PROD-003",
      sku: "PROD-ZERO",
      invoicedQty: 0,
      confirmedSoldQty: 0,
      returnedQty: 0
    };
    expect(computeSkuLyingWithPartner(zeroSku)).toBe(0);
    expect(computeSkuSellThrough(zeroSku)).toBe(0);
  });

  it("should compute aggregate lying inventory across all partner SKUs", () => {
    const totalLying = computeTotalLyingWithPartner(sampleParty);
    expect(totalLying).toBe(78); // 30 + 48
  });

  it("should compute overall sell-through rate across all tracked SKUs for the partner", () => {
    const overallSellThrough = computeOverallSellThrough(sampleParty);
    // Total Sold: 65 + 30 = 95, Total Invoiced: 100 + 80 = 180
    // (95 / 180) * 100 = 52.78%
    expect(overallSellThrough).toBeCloseTo(52.78, 1);
  });
});
