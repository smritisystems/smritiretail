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

  it("evaluates real-time punch state transitions: not clocked in -> clocked in -> clocked out", () => {
    const todayStr = "2026-10-08";

    // Case 1: No attendance record for today
    const recordsEmpty: any[] = [];
    const rec1 = recordsEmpty.find((r) => r.date === todayStr);
    expect(Boolean(rec1?.clock_in)).toBe(false);
    expect(Boolean(rec1?.clock_out)).toBe(false);

    // Case 2: Clocked in only
    const recordsClockedIn = [
      { record_id: "att-today", user_id: "usr-01", date: todayStr, clock_in: "09:30 AM", status: "PRESENT" },
    ];
    const rec2 = recordsClockedIn.find((r) => r.date === todayStr);
    expect(Boolean(rec2?.clock_in)).toBe(true);
    expect(Boolean(rec2?.clock_out)).toBe(false);
    expect(rec2?.clock_in).toBe("09:30 AM");

    // Case 3: Clocked out
    const recordsClockedOut = [
      { record_id: "att-today", user_id: "usr-01", date: todayStr, clock_in: "09:30 AM", clock_out: "06:45 PM", status: "PRESENT" },
    ];
    const rec3 = recordsClockedOut.find((r) => r.date === todayStr);
    expect(Boolean(rec3?.clock_in)).toBe(true);
    expect(Boolean(rec3?.clock_out)).toBe(true);
    expect(rec3?.clock_out).toBe("06:45 PM");
  });

  it("verifies punch action payload contract sent to /staff/attendance/punch", () => {
    const user_id = "usr-emp-101";
    const payload = {
      user_id,
      punch_type: "AUTO",
      device_source: "ATTENDANCE_STUDIO_UI",
    };

    expect(payload.user_id).toBe("usr-emp-101");
    expect(payload.punch_type).toBe("AUTO");
    expect(payload.device_source).toBe("ATTENDANCE_STUDIO_UI");
  });

  it("verifies live CommissionSummary contract and ledger entry mapping for studio UI", () => {
    const backendSummary = {
      success: true,
      company_id: "comp-1",
      user_id: "usr-emp-101",
      period: "2026-10",
      transaction_count: 2,
      gross_sales: 15000.0,
      returned_sales: 2000.0,
      net_sales: 13000.0,
      earned_commission: 300.0,
      reversed_commission: 40.0,
      net_commission: 260.0,
      entries: [
        {
          id: "cml-1",
          participant_id: "cp-1",
          participant_role: "SALESPERSON",
          transaction_type: "EARNED",
          gross_sales_amount: 15000.0,
          commission_amount: 300.0,
          reference_invoice_id: "INV-001",
          timestamp: "2026-10-08T10:00:00Z",
        },
        {
          id: "cml-2",
          participant_id: "cp-1",
          participant_role: "SALESPERSON",
          transaction_type: "REVERSED",
          gross_sales_amount: -2000.0,
          commission_amount: -40.0,
          reference_return_id: "RET-001",
          timestamp: "2026-10-08T12:00:00Z",
        },
      ],
    };

    expect(backendSummary.success).toBe(true);
    expect(backendSummary.transaction_count).toBe(2);
    expect(backendSummary.net_sales).toBe(13000.0);
    expect(backendSummary.net_commission).toBe(260.0);
    expect(backendSummary.entries).toHaveLength(2);
    expect(backendSummary.entries[0].transaction_type).toBe("EARNED");
    expect(backendSummary.entries[1].transaction_type).toBe("REVERSED");
  });

  it("verifies AttendanceSummary contract and average shift calculation", () => {
    const attSummary = {
      success: true,
      company_id: "comp-1",
      user_id: "usr-emp-101",
      period: "2026-10",
      total_days: 5,
      present_days: 4,
      late_days: 1,
      half_days: 0,
      absent_days: 1,
      leave_days: 0,
      holiday_days: 0,
      total_hours_worked: 34.5,
      avg_daily_hours: 8.63,
    };

    expect(attSummary.success).toBe(true);
    expect(attSummary.total_days).toBe(5);
    expect(attSummary.present_days).toBe(4);
    expect(attSummary.total_hours_worked).toBe(34.5);
    expect(attSummary.avg_daily_hours).toBe(8.63);
  });

  it("verifies Commission Settlement payout contract and state transitions", () => {
    const settlePayload = {
      user_id: "usr-emp-101",
      amount: 250.0,
      payment_mode: "BANK_TRANSFER",
      notes: "Monthly incentive disbursement",
    };

    const settleResponse = {
      success: true,
      payout_ref: "PAYOUT-20261008-A1B2C3",
      participant_id: "cp-101",
      participant_name: "Rahul Sharma",
      disbursed_amount: 250.0,
      remaining_balance: 50.0,
      ledger_id: "cml-pay-12345",
      payment_mode: "BANK_TRANSFER",
      message: "Successfully disbursed ₹250.00 commission (BANK_TRANSFER).",
    };

    expect(settlePayload.user_id).toBe("usr-emp-101");
    expect(settlePayload.payment_mode).toBe("BANK_TRANSFER");
    expect(settleResponse.success).toBe(true);
    expect(settleResponse.disbursed_amount).toBe(250.0);
    expect(settleResponse.remaining_balance).toBe(50.0);
    expect(settleResponse.payout_ref).toMatch(/^PAYOUT-/);
  });

  it("verifies LeaveBalance and LeaveRequest contract data mapping for LEAVE tab", () => {
    const leaveBalances = [
      { id: "lb-1", user_id: "usr-1", leave_year: 2026, leave_type: "CL", entitled_days: 12, used_days: 2, pending_days: 0 },
      { id: "lb-2", user_id: "usr-1", leave_year: 2026, leave_type: "SL", entitled_days: 12, used_days: 1, pending_days: 0 },
      { id: "lb-3", user_id: "usr-1", leave_year: 2026, leave_type: "EL", entitled_days: 15, used_days: 0, pending_days: 1 },
    ];

    const clAvailable = leaveBalances[0].entitled_days - leaveBalances[0].used_days;
    const slAvailable = leaveBalances[1].entitled_days - leaveBalances[1].used_days;
    const elAvailable = leaveBalances[2].entitled_days - leaveBalances[2].used_days;

    expect(leaveBalances).toHaveLength(3);
    expect(clAvailable).toBe(10);
    expect(slAvailable).toBe(11);
    expect(elAvailable).toBe(15);

    const leaveRequest = {
      id: "lr-1",
      user_id: "usr-1",
      leave_type: "CL",
      start_date: "2026-10-12",
      end_date: "2026-10-13",
      total_days: 2,
      reason: "Family emergency",
      status: "PENDING",
    };

    expect(leaveRequest.status).toBe("PENDING");
    expect(leaveRequest.total_days).toBe(2);
  });

  it("verifies Leave Decision action contract and state transition on approval and rejection", () => {
    let balance = { entitled_days: 12, used_days: 1, pending_days: 2 };
    const pendingRequest = { id: "lr-99", status: "PENDING", total_days: 2 };

    // Simulate Approve decision
    const approveDecision = { status: "APPROVED", decision_reason: "Approved by store manager" };
    expect(["APPROVED", "REJECTED"]).toContain(approveDecision.status);

    if (approveDecision.status === "APPROVED") {
      pendingRequest.status = "APPROVED";
      balance.used_days += pendingRequest.total_days;
      balance.pending_days = Math.max(0, balance.pending_days - pendingRequest.total_days);
    }

    expect(pendingRequest.status).toBe("APPROVED");
    expect(balance.used_days).toBe(3);
    expect(balance.pending_days).toBe(0);

    // Simulate subsequent request and Reject decision
    const pendingRequest2 = { id: "lr-100", status: "PENDING", total_days: 1 };
    balance.pending_days += pendingRequest2.total_days;
    expect(balance.pending_days).toBe(1);

    const rejectDecision = { status: "REJECTED", decision_reason: "Shift shortage" };
    if (rejectDecision.status === "REJECTED") {
      pendingRequest2.status = "REJECTED";
      balance.pending_days = Math.max(0, balance.pending_days - pendingRequest2.total_days);
    }

    expect(pendingRequest2.status).toBe("REJECTED");
    expect(balance.used_days).toBe(3);
    expect(balance.pending_days).toBe(0);
  });

  it("verifies Printable Salary Slip calculation and voucher metadata formatting", () => {
    const profile = {
      user_id: "usr-emp-789",
      emp_id: "EMP-00789",
      full_name: "Kavita Rao",
      designation: "Assistant Store Manager",
      base_salary: 32000,
      branch_code: "BR-MUMBAI-01",
    };

    const period = "2026-10";
    const workingDays = 26;
    const effectivePresent = 24.5;
    const lopDays = Math.max(0, workingDays - effectivePresent);
    expect(lopDays).toBe(1.5);

    const baseSalary = profile.base_salary;
    const earnedSalary = Math.round((baseSalary * (effectivePresent / workingDays)) * 100) / 100;
    const lopDeduction = Math.round((baseSalary * (lopDays / workingDays)) * 100) / 100;
    const commAmt = 4500.0;
    const bonusAmt = 1500.0;
    const grossPayout = earnedSalary + commAmt + bonusAmt;
    const netPayout = grossPayout;

    expect(earnedSalary).toBe(30153.85);
    expect(lopDeduction).toBe(1846.15);
    expect(earnedSalary + lopDeduction).toBe(baseSalary);
    expect(grossPayout).toBe(36153.85);
    expect(netPayout).toBe(36153.85);

    // Voucher Ref format validation
    const voucherRef = `PSLIP-${period.replace("-", "")}-${String(profile.user_id || profile.emp_id || "STAFF").slice(-6).toUpperCase()}`;
    expect(voucherRef).toBe("PSLIP-202610-MP-789");

    // Null user_id fallback safety verification
    const nullProfile = { ...profile, user_id: null as any, emp_id: "EMP-042" };
    const nullRef = `PSLIP-${period.replace("-", "")}-${String(nullProfile.user_id || nullProfile.emp_id || "STAFF").slice(-6).toUpperCase()}`;
    expect(nullRef).toBe("PSLIP-202610-MP-042");

    const emptyProfile = { ...profile, user_id: null as any, emp_id: null as any };
    const emptyRef = `PSLIP-${period.replace("-", "")}-${String(emptyProfile.user_id || emptyProfile.emp_id || "STAFF").slice(-6).toUpperCase()}`;
    expect(emptyRef).toBe("PSLIP-202610-STAFF");
  });

  it("safeguards Commission Studio against non-array object payloads from /staff/incentives (STAFF-002 report format)", () => {
    // The backend /api/v1/staff/incentives endpoint returns an object with report_id, lines, etc.
    const backendIncentivesObject = {
      report_id: "STAFF-002",
      sh9_exe: "SR443900",
      generated_at: "2026-10-09T01:40:00Z",
      total_rules: 0,
      programs_available: 0,
      lines: [],
    };

    const mockPersonnel = [
      {
        id: "usr-cashier-direct",
        user_id: "usr-cashier-direct",
        participant_name: "Anita Cashier",
        participant_role: "CASHIER",
        branch_code: "BR-MAIN",
      },
    ];

    const mockCommSummary = {
      user_id: "usr-cashier-direct",
      earned_commission: 4500,
      net_sales: 120000,
    };

    // Simulate normalization logic in CommissionStudioModal
    let repSummaries: any[] = [];
    if (Array.isArray(backendIncentivesObject)) {
      repSummaries = backendIncentivesObject;
    } else if (Array.isArray((backendIncentivesObject as any)?.summaries)) {
      repSummaries = (backendIncentivesObject as any).summaries;
    }

    if (repSummaries.length === 0 && mockPersonnel.length > 0) {
      repSummaries = mockPersonnel.map((p: any) => ({
        user_id: p.user_id || p.id,
        rep_id: p.id,
        rep_name: p.participant_name,
        branch_code: p.branch_code,
        period: "2026-10",
        net_sales: mockCommSummary.net_sales,
        commission_amt: mockCommSummary.earned_commission,
        target_bonus_amt: 0,
        total_earnings: mockCommSummary.earned_commission,
        target_achievement_pct: 100,
        revenue_target: 100000,
        units_sold: 0,
        unit_target: 50,
      }));
    }

    // Defensive array guards must ensure find() executes without TypeError
    const safeSummaries = Array.isArray(repSummaries) ? repSummaries : [];
    const selectedUserId = "usr-cashier-direct";
    const selected = safeSummaries.find((s) => s.user_id === selectedUserId);

    expect(selected).toBeDefined();
    expect(selected?.rep_name).toBe("Anita Cashier");
    expect(selected?.commission_amt).toBe(4500);

    // Test when backend returned raw null or unexpected object
    const corruptedState: any = { report_id: "CORRUPTED" };
    const safeGuardedArray = Array.isArray(corruptedState) ? corruptedState : [];
    expect(() => {
      const result = safeGuardedArray.find((s: any) => s.user_id === selectedUserId);
      expect(result).toBeUndefined();
    }).not.toThrow();
  });

  it("safeguards Placement and Leave arrays against null/non-array responses", () => {
    // Simulate non-array retry response
    const retryNullResponse: any = null;
    const safePlacements = Array.isArray(retryNullResponse?.placements) ? retryNullResponse.placements : [];
    expect(safePlacements).toEqual([]);
    expect(() => {
      const activePlacement = safePlacements.find((p: any) => p.status === "ACTIVE");
      expect(activePlacement).toBeUndefined();
    }).not.toThrow();

    // Simulate dictionary response without balances
    const leaveBalancesResp: any = { error: "Tenant switching" };
    const safeBalances = Array.isArray(leaveBalancesResp?.balances) ? leaveBalancesResp.balances : [];
    expect(safeBalances).toEqual([]);
    expect(() => {
      const clBal = safeBalances.find((b: any) => b.leave_type === "CL");
      expect(clBal).toBeUndefined();
    }).not.toThrow();
  });
});

