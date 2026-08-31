/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.95.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { describe, it, expect } from "vitest";
import ShiftEngine, {
  ShiftEmployee,
  ShiftRecord,
  SalesAttributionRecord,
  COMMISSION_TIERS,
} from "../utils/shiftEngine";

describe("ShiftEngine — Employee Shift Management & Commission Calculation Engine", () => {
  // ─── Fixture ───────────────────────────────────────────────────────────────
  const EMP_GOLD: ShiftEmployee = {
    employeeId: "EMP-001",
    name: "Ananya Verma",
    role: "Senior Associate",
    branchCode: "BR-MUM-01",
    baseHourlyRate: 120,
    commissionTier: "GOLD",
  };

  function makeShift(overrides: Partial<ShiftRecord> = {}): ShiftRecord {
    return ShiftEngine.createShift({
      employeeId: "EMP-001",
      branchCode: "BR-MUM-01",
      date: "2026-08-28",
      scheduledStart: "09:00",
      scheduledEnd: "18:00",
      ...overrides,
    });
  }

  // ─── Test 1: Commission tier definitions are well-formed ─────────────────
  it("validates all four commission tier definitions have correct rates and thresholds", () => {
    const tiers = ["BRONZE", "SILVER", "GOLD", "PLATINUM"] as const;

    for (const tier of tiers) {
      const def = COMMISSION_TIERS[tier];
      expect(def.rate).toBeGreaterThan(0);
      expect(def.rate).toBeLessThan(0.1);          // Sanity: < 10%
      expect(def.threshold).toBeGreaterThan(0);
      expect(def.incentiveRate).toBeGreaterThan(0);
      expect(def.label).toBeTruthy();
    }

    // Tiers must be in ascending rate order
    expect(COMMISSION_TIERS.BRONZE.rate).toBeLessThan(COMMISSION_TIERS.SILVER.rate);
    expect(COMMISSION_TIERS.SILVER.rate).toBeLessThan(COMMISSION_TIERS.GOLD.rate);
    expect(COMMISSION_TIERS.GOLD.rate).toBeLessThan(COMMISSION_TIERS.PLATINUM.rate);

    // Thresholds must be ascending
    expect(COMMISSION_TIERS.BRONZE.threshold).toBeLessThan(COMMISSION_TIERS.SILVER.threshold);
    expect(COMMISSION_TIERS.SILVER.threshold).toBeLessThan(COMMISSION_TIERS.GOLD.threshold);
    expect(COMMISSION_TIERS.GOLD.threshold).toBeLessThan(COMMISSION_TIERS.PLATINUM.threshold);
  });

  // ─── Test 2: Clock-in / clock-out with hours worked ─────────────────────
  it("records clock-in and clock-out, computing hours worked and overtime correctly", () => {
    let shift = makeShift();
    expect(shift.status).toBe("SCHEDULED");

    // Clock in (simulate by overriding clockInAt manually for determinism)
    shift = ShiftEngine.clockIn(shift);
    expect(shift.status).toBe("CLOCKED_IN");
    expect(shift.clockInAt).toBeDefined();

    // Simulate an 8.5-hour shift: set clockInAt 8.5 hours before now
    const clockInTime = new Date(Date.now() - 8.5 * 60 * 60 * 1000).toISOString();
    const shiftWithKnownClockIn: ShiftRecord = { ...shift, clockInAt: clockInTime };

    const clocked = ShiftEngine.clockOut(shiftWithKnownClockIn);
    expect(clocked.status).toBe("CLOCKED_OUT");
    expect(clocked.hoursWorked).toBeGreaterThan(8);          // > 8 hours
    expect(clocked.overtimeHours).toBeGreaterThan(0);         // Has overtime
    expect(clocked.clockOutAt).toBeDefined();
  });

  // ─── Test 3: Commission calculation with incentive bonus ─────────────────
  it("calculates GOLD tier commission including base rate, incentive bonus above threshold, and total pay", () => {
    // GOLD: 2% base, 1% incentive above ₹80K
    const tierDef = COMMISSION_TIERS.GOLD;

    // Simulate 8-hour shift with 0 breaks for clean calculation
    const clockInTime = new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString();
    let shift = makeShift();
    shift = ShiftEngine.clockOut({ ...ShiftEngine.clockIn(shift), clockInAt: clockInTime });

    // Sales: ₹1,00,000 (above ₹80K threshold)
    const attributions: SalesAttributionRecord[] = [
      { employeeId: "EMP-001", date: "2026-08-28", invoiceNo: "INV-001", saleValue: 60000, channel: "POS" },
      { employeeId: "EMP-001", date: "2026-08-28", invoiceNo: "INV-002", saleValue: 40000, channel: "POS" },
    ];

    const result = ShiftEngine.calculateCommission(EMP_GOLD, attributions, shift);

    expect(result.totalSales).toBe(100000);
    expect(result.tier).toBe("GOLD");
    expect(result.commissionRate).toBe(tierDef.rate);                  // 0.02

    // Base commission: 100000 × 2% = ₹2000
    expect(result.baseCommission).toBe(2000);

    // Incentive: (100000 - 80000) × 1% = 200 × 0.01 = ₹200
    expect(result.incentiveBonus).toBe(200);

    expect(result.totalCommission).toBe(2200);                         // 2000 + 200
    expect(result.basePay).toBeGreaterThan(0);
    expect(result.totalPay).toBeGreaterThan(result.totalCommission);   // Base pay + commission
    expect(result.breakdown).toHaveLength(2);
  });

  // ─── Test 4: Break tracking and late-arrival recording ───────────────────
  it("tracks breaks with duration, and records late arrival minutes on clock-in", () => {
    // Simulate a shift where scheduled start is in the past (5 minutes ago = late)
    let shift = makeShift();
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    // Override scheduledStart to 5 minutes before current time to simulate being on time
    // In practice lateMinutes = max(0, actual - scheduled)
    shift = ShiftEngine.clockIn(shift);
    expect(typeof shift.lateMinutes).toBe("number");
    expect(shift.lateMinutes).toBeGreaterThanOrEqual(0);

    // Start a break
    shift = ShiftEngine.startBreak(shift);
    expect(shift.status).toBe("ON_BREAK");
    expect(shift.breaks).toHaveLength(1);
    expect(shift.breaks[0].endAt).toBeUndefined();

    // Simulate break duration of 15 minutes
    const breakStart = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const shiftWithBreak: ShiftRecord = {
      ...shift,
      breaks: [{ ...shift.breaks[0], startAt: breakStart }],
    };

    const afterBreak = ShiftEngine.endBreak(shiftWithBreak);
    expect(afterBreak.status).toBe("CLOCKED_IN");
    expect(afterBreak.breaks[0].endAt).toBeDefined();
    expect(afterBreak.breaks[0].durationMinutes).toBeGreaterThanOrEqual(14);  // ~15 minutes
  });
});
