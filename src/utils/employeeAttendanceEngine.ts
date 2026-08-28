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

/**
 * Employee Attendance & Commission Tracking Engine
 *
 * Manages daily attendance records and commission calculation:
 *   Attendance : `clockIn()` / `clockOut()` / `markAbsent()` / `markLeave()`
 *   Commission : `computeCommission()` — tiered/flat slabs on net sales
 *   Target     : `salesTargetStatus()` — actual vs target + achievement %
 *   Payout     : `payoutSummary()` — base + commission + deductions per employee
 *   Period     : `periodReport()` — attendance + payout across employees
 */

export type AttendanceStatus = "PRESENT" | "ABSENT" | "LEAVE" | "HALF_DAY" | "HOLIDAY";
export type CommissionType   = "FLAT_PCT" | "TIERED" | "TARGET_BASED";
export type LeaveType        = "CASUAL" | "SICK" | "EARNED" | "UNPAID";

export interface CommissionSlab {
  fromAmt: number;
  toAmt:   number;   // Infinity for the last slab
  pct:     number;   // e.g. 2.5 means 2.5%
}

export interface EmployeeProfile {
  empId:          string;
  name:           string;
  branchCode:     string;
  designation:    string;
  baseSalary:     number;     // Monthly
  commissionType: CommissionType;
  flatPct?:       number;     // For FLAT_PCT
  slabs?:         CommissionSlab[];  // For TIERED
  targetAmt?:     number;     // Monthly sales target
  targetBonusPct?: number;    // Bonus % on base if target hit
}

export interface AttendanceRecord {
  recordId:    string;
  empId:       string;
  date:        string;         // YYYY-MM-DD
  status:      AttendanceStatus;
  clockInTime?: string;
  clockOutTime?: string;
  hoursWorked?: number;
  leaveType?:  LeaveType;
  note?:       string;
}

export interface CommissionResult {
  empId:         string;
  period:        string;       // YYYY-MM
  netSales:      number;
  commissionAmt: number;
  targetAmt:     number;
  targetAchievementPct: number;
  targetBonusAmt: number;
  totalEarnings:  number;     // commission + targetBonus
  slabBreakdown?: Array<{ slab: string; salesInSlab: number; rate: number; amount: number }>;
}

export interface PayoutRecord {
  empId:        string;
  name:         string;
  period:       string;
  baseSalary:   number;
  presentDays:  number;
  workingDays:  number;
  earnedSalary: number;       // baseSalary × (presentDays / workingDays)
  leaveDays:    number;
  absentDays:   number;
  lop:          number;       // Loss-of-pay deductions (unpaid leave + absent)
  commissionAmt: number;
  targetBonusAmt: number;
  grossPayout:   number;
  netPayout:     number;
}

export class EmployeeAttendanceEngine {
  private static counter      = 1;
  private static auditCounter = 1;

  /** Clock-in for a day */
  public static clockIn(empId: string, date: string, clockInTime: string, note?: string): AttendanceRecord {
    return {
      recordId:    `ATT-${this.counter++}`,
      empId, date, status: "PRESENT",
      clockInTime, hoursWorked: 0, note,
    };
  }

  /** Clock-out — computes hoursWorked */
  public static clockOut(record: AttendanceRecord, clockOutTime: string): AttendanceRecord {
    const inMs  = new Date(`${record.date}T${record.clockInTime}`).getTime();
    const outMs = new Date(`${record.date}T${clockOutTime}`).getTime();
    const hours = Math.round(((outMs - inMs) / 3600000) * 100) / 100;
    const status: AttendanceStatus = hours < 4 ? "HALF_DAY" : "PRESENT";
    return { ...record, clockOutTime, hoursWorked: hours, status };
  }

  /** Mark absent */
  public static markAbsent(empId: string, date: string, note?: string): AttendanceRecord {
    return { recordId: `ATT-${this.counter++}`, empId, date, status: "ABSENT", note };
  }

  /** Mark leave */
  public static markLeave(empId: string, date: string, leaveType: LeaveType, note?: string): AttendanceRecord {
    return { recordId: `ATT-${this.counter++}`, empId, date, status: "LEAVE", leaveType, note };
  }

  /**
   * Compute commission for a period.
   * FLAT_PCT: commission = netSales × flatPct / 100
   * TIERED: commission = Σ(salesInSlab × slab.pct / 100) — marginal slab system
   * TARGET_BASED: commission paid only if targetAmt achieved; bonus = base × targetBonusPct / 100
   */
  public static computeCommission(
    profile:  EmployeeProfile,
    netSales: number,
    period:   string
  ): CommissionResult {
    const targetAmt = profile.targetAmt ?? 0;
    const targetAchievementPct = targetAmt > 0
      ? Math.round((netSales / targetAmt) * 10000) / 100
      : 100;
    const targetBonusAmt = (profile.targetBonusPct && netSales >= targetAmt)
      ? Math.round((profile.baseSalary * profile.targetBonusPct / 100) * 100) / 100
      : 0;

    let commissionAmt   = 0;
    let slabBreakdown: CommissionResult["slabBreakdown"] = undefined;

    if (profile.commissionType === "FLAT_PCT" && profile.flatPct) {
      commissionAmt = Math.round((netSales * profile.flatPct / 100) * 100) / 100;
    } else if (profile.commissionType === "TIERED" && profile.slabs) {
      slabBreakdown = [];
      let remaining = netSales;
      for (const slab of profile.slabs) {
        if (remaining <= 0) break;
        const slabWidth     = slab.toAmt === Infinity ? remaining : Math.min(slab.toAmt - slab.fromAmt, remaining);
        const salesInSlab   = Math.min(slabWidth, remaining);
        const amount        = Math.round((salesInSlab * slab.pct / 100) * 100) / 100;
        slabBreakdown.push({
          slab:        `₹${slab.fromAmt}–${slab.toAmt === Infinity ? "∞" : "₹" + slab.toAmt}`,
          salesInSlab, rate: slab.pct, amount,
        });
        commissionAmt += amount;
        remaining     -= salesInSlab;
      }
      commissionAmt = Math.round(commissionAmt * 100) / 100;
    } else if (profile.commissionType === "TARGET_BASED") {
      // Commission earned only if target hit
      commissionAmt = netSales >= targetAmt && profile.flatPct
        ? Math.round((netSales * profile.flatPct / 100) * 100) / 100
        : 0;
    }

    return {
      empId:    profile.empId,
      period,   netSales, commissionAmt,
      targetAmt, targetAchievementPct, targetBonusAmt,
      totalEarnings: Math.round((commissionAmt + targetBonusAmt) * 100) / 100,
      slabBreakdown,
    };
  }

  /**
   * Compute payout for a period.
   * earnedSalary = baseSalary × (presentDays / workingDays)
   * LOP = unpaid leave days + absent days
   */
  public static computePayout(
    profile:        EmployeeProfile,
    attendanceRecs: AttendanceRecord[],
    commission:     CommissionResult,
    workingDays:    number
  ): PayoutRecord {
    const present  = attendanceRecs.filter((r) => r.status === "PRESENT" || r.status === "HALF_DAY").length;
    const halfDays = attendanceRecs.filter((r) => r.status === "HALF_DAY").length;
    const effectivePresent = present - halfDays * 0.5;  // Half-days count as 0.5

    const leaveRecs    = attendanceRecs.filter((r) => r.status === "LEAVE");
    const leaveDays    = leaveRecs.length;
    const unpaidLeave  = leaveRecs.filter((r) => r.leaveType === "UNPAID").length;
    const absentDays   = attendanceRecs.filter((r) => r.status === "ABSENT").length;
    const lop          = unpaidLeave + absentDays;
    const earnedSalary = Math.round((profile.baseSalary * (effectivePresent / workingDays)) * 100) / 100;
    const grossPayout  = Math.round((earnedSalary + commission.commissionAmt + commission.targetBonusAmt) * 100) / 100;
    const lopDeduction = Math.round(((lop / workingDays) * profile.baseSalary) * 100) / 100;
    const netPayout    = Math.round((grossPayout - lopDeduction) * 100) / 100;

    return {
      empId:        profile.empId,
      name:         profile.name,
      period:       commission.period,
      baseSalary:   profile.baseSalary,
      presentDays:  effectivePresent,
      workingDays,
      earnedSalary,
      leaveDays,
      absentDays,
      lop,
      commissionAmt:  commission.commissionAmt,
      targetBonusAmt: commission.targetBonusAmt,
      grossPayout,
      netPayout,
    };
  }

  /** Period report across employees */
  public static periodReport(payouts: PayoutRecord[]): {
    totalHeadcount:  number;
    totalNetPayout:  number;
    totalCommission: number;
    totalBonus:      number;
    avgAttendancePct: number;
  } {
    const totalNetPayout  = Math.round(payouts.reduce((s, p) => s + p.netPayout, 0) * 100) / 100;
    const totalCommission = Math.round(payouts.reduce((s, p) => s + p.commissionAmt, 0) * 100) / 100;
    const totalBonus      = Math.round(payouts.reduce((s, p) => s + p.targetBonusAmt, 0) * 100) / 100;
    const avgAttendancePct = payouts.length
      ? Math.round((payouts.reduce((s, p) => s + (p.presentDays / p.workingDays) * 100, 0) / payouts.length) * 100) / 100
      : 0;
    return { totalHeadcount: payouts.length, totalNetPayout, totalCommission, totalBonus, avgAttendancePct };
  }
}

export default EmployeeAttendanceEngine;
