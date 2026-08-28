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

export type ShiftStatus = "SCHEDULED" | "CLOCKED_IN" | "ON_BREAK" | "CLOCKED_OUT" | "ABSENT" | "HALF_DAY";
export type CommissionTier = "BRONZE" | "SILVER" | "GOLD" | "PLATINUM";

export interface ShiftEmployee {
  employeeId: string;
  name: string;
  role: string;               // "Sales Associate", "Senior Associate", "Team Lead"
  branchCode: string;
  baseHourlyRate: number;     // INR per hour
  commissionTier: CommissionTier;
}

export interface ShiftRecord {
  shiftId: string;
  employeeId: string;
  branchCode: string;
  date: string;               // "YYYY-MM-DD"
  scheduledStart: string;     // "HH:MM"
  scheduledEnd: string;       // "HH:MM"
  clockInAt?: string;         // ISO timestamp
  clockOutAt?: string;        // ISO timestamp
  breaks: BreakRecord[];
  status: ShiftStatus;
  hoursWorked?: number;       // Calculated on clock-out
  overtimeHours?: number;
  lateMinutes?: number;
  earlyDepartureMinutes?: number;
}

export interface BreakRecord {
  breakId: string;
  startAt: string;            // ISO
  endAt?: string;             // ISO (null if still on break)
  durationMinutes?: number;
}

export interface SalesAttributionRecord {
  employeeId: string;
  date: string;
  invoiceNo: string;
  saleValue: number;          // Net taxable value
  channel: string;
}

export interface CommissionResult {
  employeeId: string;
  date: string;
  totalSales: number;
  tier: CommissionTier;
  commissionRate: number;     // As decimal e.g. 0.015 = 1.5%
  baseCommission: number;
  incentiveBonus: number;     // Extra bonus above threshold
  totalCommission: number;
  shiftHours: number;
  basePay: number;
  totalPay: number;
  breakdown: CommissionBreakdown[];
}

export interface CommissionBreakdown {
  invoiceNo: string;
  saleValue: number;
  commissionAmt: number;
}

/** Tier commission rates */
export const COMMISSION_TIERS: Record<CommissionTier, {
  rate: number;               // base rate %
  threshold: number;          // sales value above which incentive kicks in (INR)
  incentiveRate: number;      // extra % on sales above threshold
  label: string;
}> = {
  BRONZE:   { rate: 0.010, threshold: 20000,  incentiveRate: 0.005, label: "Bronze (1.0% + 0.5% above ₹20K)" },
  SILVER:   { rate: 0.015, threshold: 40000,  incentiveRate: 0.008, label: "Silver (1.5% + 0.8% above ₹40K)" },
  GOLD:     { rate: 0.020, threshold: 80000,  incentiveRate: 0.010, label: "Gold (2.0% + 1.0% above ₹80K)" },
  PLATINUM: { rate: 0.025, threshold: 150000, incentiveRate: 0.015, label: "Platinum (2.5% + 1.5% above ₹1.5L)" },
};

export class ShiftEngine {
  /** Clock in an employee */
  public static clockIn(shift: ShiftRecord): ShiftRecord {
    const now = new Date().toISOString();
    const scheduledStart = new Date(`${shift.date}T${shift.scheduledStart}:00`);
    const actual = new Date(now);
    const lateMinutes = Math.max(0, Math.round((actual.getTime() - scheduledStart.getTime()) / 60000));

    return { ...shift, clockInAt: now, status: "CLOCKED_IN", lateMinutes };
  }

  /** Clock out and calculate hours worked */
  public static clockOut(shift: ShiftRecord): ShiftRecord {
    if (!shift.clockInAt) throw new Error("Employee has not clocked in");
    const now = new Date().toISOString();
    const clockIn = new Date(shift.clockInAt);
    const clockOut = new Date(now);

    const totalBreakMs = shift.breaks.reduce((s, b) => {
      if (b.startAt && b.endAt) {
        return s + (new Date(b.endAt).getTime() - new Date(b.startAt).getTime());
      }
      return s;
    }, 0);

    const totalMs = clockOut.getTime() - clockIn.getTime() - totalBreakMs;
    const hoursWorked = Math.round((totalMs / (1000 * 60 * 60)) * 100) / 100;

    const scheduledEnd = new Date(`${shift.date}T${shift.scheduledEnd}:00`);
    const earlyDepartureMinutes = Math.max(0, Math.round((scheduledEnd.getTime() - clockOut.getTime()) / 60000));

    const standardHours = 8;
    const overtimeHours = Math.max(0, Math.round((hoursWorked - standardHours) * 100) / 100);

    const status: ShiftStatus = hoursWorked < 4 ? "HALF_DAY" : "CLOCKED_OUT";

    return { ...shift, clockOutAt: now, status, hoursWorked, overtimeHours, earlyDepartureMinutes };
  }

  /** Start a break */
  public static startBreak(shift: ShiftRecord): ShiftRecord {
    const breakRecord: BreakRecord = {
      breakId: `BRK-${Date.now()}`,
      startAt: new Date().toISOString(),
    };
    return { ...shift, status: "ON_BREAK", breaks: [...shift.breaks, breakRecord] };
  }

  /** End the most recent break */
  public static endBreak(shift: ShiftRecord): ShiftRecord {
    const now = new Date().toISOString();
    const breaks = shift.breaks.map((b, i) => {
      if (i === shift.breaks.length - 1 && !b.endAt) {
        const durationMinutes = Math.round((new Date(now).getTime() - new Date(b.startAt).getTime()) / 60000);
        return { ...b, endAt: now, durationMinutes };
      }
      return b;
    });
    return { ...shift, status: "CLOCKED_IN", breaks };
  }

  /** Calculate commission for a set of sales attributions */
  public static calculateCommission(
    employee: ShiftEmployee,
    attributions: SalesAttributionRecord[],
    shift: ShiftRecord
  ): CommissionResult {
    const tierDef = COMMISSION_TIERS[employee.commissionTier];
    const totalSales = attributions.reduce((s, a) => s + a.saleValue, 0);

    const breakdown: CommissionBreakdown[] = attributions.map((a) => ({
      invoiceNo: a.invoiceNo,
      saleValue: a.saleValue,
      commissionAmt: Math.round(a.saleValue * tierDef.rate * 100) / 100,
    }));

    const baseCommission = Math.round(totalSales * tierDef.rate * 100) / 100;
    const incentiveBase = Math.max(0, totalSales - tierDef.threshold);
    const incentiveBonus = Math.round(incentiveBase * tierDef.incentiveRate * 100) / 100;
    const totalCommission = Math.round((baseCommission + incentiveBonus) * 100) / 100;

    const hoursWorked = shift.hoursWorked ?? 0;
    const standardPay = Math.round(hoursWorked * employee.baseHourlyRate * 100) / 100;
    const overtimePay = Math.round((shift.overtimeHours ?? 0) * employee.baseHourlyRate * 1.5 * 100) / 100;
    const basePay = standardPay + overtimePay;
    const totalPay = Math.round((basePay + totalCommission) * 100) / 100;

    return {
      employeeId: employee.employeeId,
      date: shift.date,
      totalSales,
      tier: employee.commissionTier,
      commissionRate: tierDef.rate,
      baseCommission,
      incentiveBonus,
      totalCommission,
      shiftHours: hoursWorked,
      basePay,
      totalPay,
      breakdown,
    };
  }

  /** Create a new shift record */
  public static createShift(params: {
    employeeId: string;
    branchCode: string;
    date: string;
    scheduledStart: string;
    scheduledEnd: string;
  }): ShiftRecord {
    return {
      shiftId: `SHF-${params.employeeId}-${params.date.replace(/-/g, "")}`,
      ...params,
      breaks: [],
      status: "SCHEDULED",
    };
  }
}

export default ShiftEngine;
