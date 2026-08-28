/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.121.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { describe, it, expect } from "vitest";
import EmployeeAttendanceEngine from "../utils/employeeAttendanceEngine";
import type { EmployeeProfile } from "../utils/employeeAttendanceEngine";

describe("EmployeeAttendanceEngine — Employee Attendance & Commission Tracking", () => {

  // ─── Test 1: clockIn/clockOut → hoursWorked; HALF_DAY < 4h ─────────────
  it("clockIn/clockOut computes hoursWorked; status HALF_DAY when < 4 hours", () => {
    const rec = EmployeeAttendanceEngine.clockIn("EMP-001", "2026-08-01", "09:00");
    expect(rec.status).toBe("PRESENT");
    expect(rec.clockInTime).toBe("09:00");

    const full = EmployeeAttendanceEngine.clockOut(rec, "18:30");
    expect(full.hoursWorked).toBe(9.5);
    expect(full.status).toBe("PRESENT");

    // Half day: < 4 hours
    const halfRec = EmployeeAttendanceEngine.clockIn("EMP-001", "2026-08-02", "09:00");
    const half    = EmployeeAttendanceEngine.clockOut(halfRec, "11:00");
    expect(half.hoursWorked).toBe(2);
    expect(half.status).toBe("HALF_DAY");
  });

  // ─── Test 2: FLAT_PCT commission + TARGET bonus ──────────────────────────
  it("FLAT_PCT commission = netSales × pct; target bonus when target achieved", () => {
    const profile: EmployeeProfile = {
      empId: "EMP-002", name: "Priya Sharma", branchCode: "BR-MUM-01",
      designation: "Sales Associate", baseSalary: 25000,
      commissionType: "FLAT_PCT", flatPct: 1.5,
      targetAmt: 200000, targetBonusPct: 10,
    };

    // Net sales ₹300,000 — target hit
    const result = EmployeeAttendanceEngine.computeCommission(profile, 300000, "2026-08");
    expect(result.commissionAmt).toBe(4500);         // 300000 × 1.5%
    expect(result.targetAchievementPct).toBe(150);   // 300000/200000 × 100
    expect(result.targetBonusAmt).toBe(2500);        // 25000 × 10%
    expect(result.totalEarnings).toBe(7000);         // 4500 + 2500

    // Net sales ₹150,000 — target not hit; no bonus
    const miss = EmployeeAttendanceEngine.computeCommission(profile, 150000, "2026-08");
    expect(miss.targetAchievementPct).toBe(75);
    expect(miss.targetBonusAmt).toBe(0);
    expect(miss.commissionAmt).toBe(2250);           // 150000 × 1.5%
  });

  // ─── Test 3: TIERED commission — marginal slab breakdown ────────────────
  it("TIERED commission applies marginal slabs correctly with slabBreakdown", () => {
    const profile: EmployeeProfile = {
      empId: "EMP-003", name: "Rajan Kumar", branchCode: "BR-DEL-01",
      designation: "Senior Sales", baseSalary: 35000,
      commissionType: "TIERED",
      slabs: [
        { fromAmt: 0,      toAmt: 100000,   pct: 1.0 },
        { fromAmt: 100000, toAmt: 200000,   pct: 1.5 },
        { fromAmt: 200000, toAmt: Infinity,  pct: 2.0 },
      ],
    };

    // ₹250,000 net sales
    // Slab 1: ₹100,000 × 1.0% = ₹1,000
    // Slab 2: ₹100,000 × 1.5% = ₹1,500
    // Slab 3: ₹50,000  × 2.0% = ₹1,000
    // Total: ₹3,500
    const result = EmployeeAttendanceEngine.computeCommission(profile, 250000, "2026-08");
    expect(result.commissionAmt).toBe(3500);
    expect(result.slabBreakdown).toHaveLength(3);
    expect(result.slabBreakdown![0].amount).toBe(1000);
    expect(result.slabBreakdown![1].amount).toBe(1500);
    expect(result.slabBreakdown![2].amount).toBe(1000);
  });

  // ─── Test 4: computePayout — earnedSalary, LOP, periodReport ────────────
  it("computePayout applies LOP for absent/unpaid leave; periodReport aggregates correctly", () => {
    const profile: EmployeeProfile = {
      empId: "EMP-004", name: "Aisha Verma", branchCode: "BR-MUM-01",
      designation: "Cashier", baseSalary: 20000,
      commissionType: "FLAT_PCT", flatPct: 1.0,
    };
    const workingDays = 26;

    const attendance = [
      ...Array.from({ length: 22 }, (_, i) =>
        EmployeeAttendanceEngine.clockOut(
          EmployeeAttendanceEngine.clockIn("EMP-004", `2026-08-${String(i + 1).padStart(2, "0")}`, "09:00"),
          "18:00"
        )
      ),
      EmployeeAttendanceEngine.markAbsent("EMP-004", "2026-08-23"),
      EmployeeAttendanceEngine.markAbsent("EMP-004", "2026-08-24"),
      EmployeeAttendanceEngine.markLeave("EMP-004", "2026-08-25", "CASUAL"),
      EmployeeAttendanceEngine.markLeave("EMP-004", "2026-08-26", "UNPAID"),
    ];

    const commission = EmployeeAttendanceEngine.computeCommission(profile, 150000, "2026-08");
    const payout     = EmployeeAttendanceEngine.computePayout(profile, attendance, commission, workingDays);

    expect(payout.presentDays).toBe(22);
    expect(payout.absentDays).toBe(2);
    expect(payout.leaveDays).toBe(2);
    expect(payout.lop).toBe(3);              // 2 absent + 1 unpaid leave
    expect(payout.commissionAmt).toBe(1500); // 150000 × 1.0%
    // earnedSalary = 20000 × (22/26) = 16923.08
    expect(payout.earnedSalary).toBeCloseTo(16923.08, 1);

    // periodReport
    const report = EmployeeAttendanceEngine.periodReport([payout]);
    expect(report.totalHeadcount).toBe(1);
    expect(report.totalCommission).toBe(1500);
    expect(report.avgAttendancePct).toBeCloseTo((22 / 26) * 100, 0);
  });
});
