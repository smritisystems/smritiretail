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
 * Version    : 6.31.0
 * Created    : 2026-09-17
 * Modified     : 2026-09-17
 * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * License    : Proprietary Commercial Software
 * Classification: Internal
 *
 * Test Suite : Line-Level Sales Staff Attribution & Shift Handover Reconciliation
 */

import { describe, it, expect } from "vitest";
import {
  SmritiSalesStaffIncentiveService,
} from "../services/smritiSalesStaffIncentiveService";
import { ProPosCartItem, CommissionRule } from "../components/billing/propos/types";

describe("SmritiSalesStaffIncentiveService (Line-Level Staff Attribution & Commission)", () => {
  const customRules: CommissionRule[] = [
    {
      id: "rule-sm1-apparel",
      salesStaffCode: "SM1",
      staffName: "Rahul Sharma",
      category: "Apparel",
      tierMin: 0,
      tierMax: 50000,
      commissionPct: 3.0,
      effectiveFrom: "2026-01-01",
      isActive: true,
    },
    {
      id: "rule-sm1-footwear",
      salesStaffCode: "SM1",
      staffName: "Rahul Sharma",
      category: "Footwear",
      tierMin: 0,
      tierMax: 50000,
      commissionPct: 5.0,
      effectiveFrom: "2026-01-01",
      isActive: true,
    },
    {
      id: "rule-sm2-general",
      salesStaffCode: "SM2",
      staffName: "Priya Nair",
      category: "All Categories",
      tierMin: 0,
      tierMax: 100000,
      commissionPct: 2.5,
      effectiveFrom: "2026-01-01",
      isActive: true,
    },
  ];

  it("1. Automatically falls back to bill header staff if cart line does not specify an attendant", () => {
    const cartItems: ProPosCartItem[] = [
      {
        id: "line-1",
        itemNo: 1,
        sku: "SHIRT-01",
        barcode: "89010001",
        name: "Formal Shirt",
        size: "40",
        color: "Blue",
        brand: "Apparel",
        salesStaff: "", // omitted
        qty: 1,
        mrp: 2000,
        unitPrice: 2000,
        discountPct: 0,
        discountAmt: 0,
        taxPct: 5,
        taxAmt: 100,
        lineTotal: 2000,
      },
    ];

    const result = SmritiSalesStaffIncentiveService.calculateBasketCommissions({
      cartItems,
      defaultHeaderStaff: "SM1",
      rules: customRules,
    });

    expect(result.lineAttributions.length).toBe(1);
    expect(result.lineAttributions[0].salesStaffCode).toBe("SM1");
    expect(result.lineAttributions[0].commissionPct).toBe(3.0); // Apparel rate for SM1
    expect(result.lineAttributions[0].commissionEarned).toBe(60.0); // 3% of 2000
    expect(result.totalBasketCommission).toBe(60.0);
  });

  it("2. Accurately attributes multi-department basket across different staff attendants", () => {
    const cartItems: ProPosCartItem[] = [
      {
        id: "line-suit",
        itemNo: 1,
        sku: "SUIT-01",
        barcode: "89010002",
        name: "Executive Suit",
        size: "42",
        color: "Black",
        brand: "Apparel",
        salesStaff: "SM1", // Attendant Rahul
        qty: 1,
        mrp: 8000,
        unitPrice: 8000,
        discountPct: 0,
        discountAmt: 0,
        taxPct: 12,
        taxAmt: 960,
        lineTotal: 8000,
      },
      {
        id: "line-shoes",
        itemNo: 2,
        sku: "SHOE-01",
        barcode: "89010003",
        name: "Leather Oxford Shoes",
        size: "9",
        color: "Brown",
        brand: "Footwear",
        salesStaff: "SM1", // Attendant Rahul (Footwear rate = 5%)
        qty: 1,
        mrp: 4000,
        unitPrice: 4000,
        discountPct: 0,
        discountAmt: 0,
        taxPct: 18,
        taxAmt: 720,
        lineTotal: 4000,
      },
      {
        id: "line-perfume",
        itemNo: 3,
        sku: "PERF-01",
        barcode: "89010004",
        name: "Eau De Parfum",
        size: "100ml",
        color: "Clear",
        brand: "Cosmetics",
        salesStaff: "SM2", // Attendant Priya (All Categories rate = 2.5%)
        qty: 1,
        mrp: 3000,
        unitPrice: 3000,
        discountPct: 0,
        discountAmt: 0,
        taxPct: 18,
        taxAmt: 540,
        lineTotal: 3000,
      },
    ];

    const result = SmritiSalesStaffIncentiveService.calculateBasketCommissions({
      cartItems,
      defaultHeaderStaff: "SM1",
      rules: customRules,
    });

    expect(result.staffSummaries.length).toBe(2);

    const sm1Summary = result.staffSummaries.find((s) => s.salesStaffCode === "SM1");
    expect(sm1Summary).toBeDefined();
    expect(sm1Summary!.totalTurnover).toBe(12000); // 8000 + 4000
    // SM1 Apparel: 3% of 8000 = 240
    // SM1 Footwear: 5% of 4000 = 200
    // Total SM1 = 440
    expect(sm1Summary!.totalCommissionEarned).toBe(440);

    const sm2Summary = result.staffSummaries.find((s) => s.salesStaffCode === "SM2");
    expect(sm2Summary).toBeDefined();
    expect(sm2Summary!.totalTurnover).toBe(3000);
    // SM2 All Categories: 2.5% of 3000 = 75
    expect(sm2Summary!.totalCommissionEarned).toBe(75);

    expect(result.totalBasketCommission).toBe(515); // 440 + 75
  });

  it("3. Correctly handles tiered commission slabs when staff exceeds volume thresholds", () => {
    const tieredRules: CommissionRule[] = [
      {
        id: "tier-1",
        salesStaffCode: "SM1",
        staffName: "Rahul",
        category: "All Categories",
        tierMin: 0,
        tierMax: 10000,
        commissionPct: 2.0,
        effectiveFrom: "2026-01-01",
        isActive: true,
      },
      {
        id: "tier-2",
        salesStaffCode: "SM1",
        staffName: "Rahul",
        category: "All Categories",
        tierMin: 10001,
        tierMax: 50000,
        commissionPct: 4.0, // High-turnover kicker
        effectiveFrom: "2026-01-01",
        isActive: true,
      },
    ];

    // Basket total = ₹15,000, which falls into Tier 2 (4.0%)
    const highCart: ProPosCartItem[] = [
      {
        id: "line-high",
        itemNo: 1,
        sku: "HIGH-01",
        barcode: "89010005",
        name: "Designer Watch",
        size: "Std",
        color: "Gold",
        brand: "Watches",
        salesStaff: "SM1",
        qty: 1,
        mrp: 15000,
        unitPrice: 15000,
        discountPct: 0,
        discountAmt: 0,
        taxPct: 18,
        taxAmt: 2700,
        lineTotal: 15000,
      },
    ];

    const result = SmritiSalesStaffIncentiveService.calculateBasketCommissions({
      cartItems: highCart,
      rules: tieredRules,
    });

    expect(result.lineAttributions[0].commissionPct).toBe(4.0);
    expect(result.lineAttributions[0].commissionEarned).toBe(600); // 4% of 15,000
  });
});
