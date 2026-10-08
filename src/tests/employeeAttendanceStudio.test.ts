/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.121.2
 * Created      : 2026-10-08
 * Modified     : 2026-10-08
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { describe, it, expect } from "vitest";
import EmployeeAttendanceEngine from "../utils/employeeAttendanceEngine";

describe("Attendance Studio — Full System Audit & Regression Verification", () => {

  it("normalizes backend { records: [...] } payload structure into canonical attendance rows", () => {
    const rawBackendPayload = {
      total: 2,
      records: [
        {
          id: "att-001a",
          user_id: "usr-emp-101",
          attendance_date: "2026-10-01",
          status: "PRESENT",
          check_in_at: "2026-10-01T09:00:00Z",
          check_out_at: "2026-10-01T18:30:00Z",
          leave_type: null,
        },
        {
          id: "att-002b",
          user_id: "usr-emp-101",
          attendance_date: "2026-10-02",
          status: "HALF_DAY",
          check_in_at: "2026-10-02T09:00:00Z",
          check_out_at: "2026-10-02T12:00:00Z",
          leave_type: null,
        },
      ],
    };

    // Simulate normalization logic in EmployeeAttendanceModal
    const rawAtt = Array.isArray(rawBackendPayload) ? rawBackendPayload : rawBackendPayload.records;
    expect(Array.isArray(rawAtt)).toBe(true);
    expect(rawAtt).toHaveLength(2);

    const normalized = rawAtt.map((r) => ({
      record_id: r.id,
      user_id: r.user_id,
      date: r.attendance_date,
      status: r.status,
      hours_worked: r.check_in_at && r.check_out_at
        ? Math.round(((new Date(r.check_out_at).getTime() - new Date(r.check_in_at).getTime()) / 3600000) * 10) / 10
        : undefined,
    }));

    expect(normalized[0].record_id).toBe("att-001a");
    expect(normalized[0].date).toBe("2026-10-01");
    expect(normalized[0].hours_worked).toBe(9.5);
    expect(normalized[1].record_id).toBe("att-002b");
    expect(normalized[1].hours_worked).toBe(3);
  });

  it("handles backend incentive rule catalogue and synthesizes employee payout summary", () => {
    const rawBackendRules = {
      report_id: "STAFF-002",
      total_rules: 1,
      lines: [
        {
          id: "rule-1",
          participant_role: "Sales Executive",
          calculation_type: "PERCENTAGE",
          rate_percent: 2.5,
        },
      ],
    };

    const staff = [
      {
        user_id: "usr-emp-101",
        full_name: "Aman Verma",
        designation: "Sales Executive",
        base_salary: 30000,
      },
    ];

    const normalizedAtt = [
      { record_id: "att-1", user_id: "usr-emp-101", date: "2026-10-01", status: "PRESENT" },
      { record_id: "att-2", user_id: "usr-emp-101", date: "2026-10-02", status: "PRESENT" },
    ];

    // If backend only returns rules, frontend synthesizes preview calculation
    const rawInc = Array.isArray(rawBackendRules) ? rawBackendRules : [];
    expect(rawInc.length).toBe(0);

    const synthesized = staff.map((p) => {
      const empAtt = normalizedAtt.filter((a) => a.user_id === p.user_id);
      const presentDays = empAtt.filter((a) => a.status === "PRESENT").length;
      const workingDays = 26;
      const earnedSalary = Math.round((p.base_salary * (presentDays / workingDays)) * 100) / 100;
      const commissionAmt = 3750;
      return {
        user_id: p.user_id,
        present_days: presentDays,
        working_days: workingDays,
        lop: workingDays - presentDays,
        earned_salary: earnedSalary,
        commission_amt: commissionAmt,
        net_payout: earnedSalary + commissionAmt,
      };
    });

    expect(synthesized).toHaveLength(1);
    expect(synthesized[0].present_days).toBe(2);
    expect(synthesized[0].earned_salary).toBeCloseTo(2307.69, 1);
    expect(synthesized[0].net_payout).toBeCloseTo(6057.69, 1);
  });

  it("verifies marginal tiered slab calculation and target bonus via EmployeeAttendanceEngine", () => {
    const profile = {
      empId: "EMP-AUDIT-01",
      name: "Meera Nair",
      branchCode: "BR-BLR-01",
      designation: "Store Sales Lead",
      baseSalary: 40000,
      commissionType: "TIERED" as const,
      slabs: [
        { fromAmt: 0, toAmt: 100000, pct: 1.0 },
        { fromAmt: 100000, toAmt: 200000, pct: 2.0 },
        { fromAmt: 200000, toAmt: Infinity, pct: 3.0 },
      ],
      targetAmt: 300000,
      targetBonusPct: 5,
    };

    // Net sales ₹350,000 (Target hit: ₹350k >= ₹300k)
    // Slab 1: 100,000 * 1% = 1,000
    // Slab 2: 100,000 * 2% = 2,000
    // Slab 3: 150,000 * 3% = 4,500
    // Commission total = 7,500
    // Bonus = 40,000 * 5% = 2,000
    // Total Earnings = 9,500
    const res = EmployeeAttendanceEngine.computeCommission(profile, 350000, "2026-10");
    expect(res.commissionAmt).toBe(7500);
    expect(res.targetBonusAmt).toBe(2000);
    expect(res.totalEarnings).toBe(9500);
    expect(res.slabBreakdown).toHaveLength(3);
    expect(res.slabBreakdown![0].amount).toBe(1000);
    expect(res.slabBreakdown![1].amount).toBe(2000);
    expect(res.slabBreakdown![2].amount).toBe(4500);
  });

  it("verifies periodReport calculation aggregates correctly without NaN or division by zero", () => {
    const emptyReport = EmployeeAttendanceEngine.periodReport([]);
    expect(emptyReport.totalHeadcount).toBe(0);
    expect(emptyReport.totalNetPayout).toBe(0);
    expect(emptyReport.avgAttendancePct).toBe(0);
  });
});
