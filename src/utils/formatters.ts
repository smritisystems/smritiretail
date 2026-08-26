/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.32.0
 * Created      : 2026-07-12
 * Modified     : 2026-08-26
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

/**
 * Safely parses any input into a guaranteed finite number.
 * Returns fallback (default 0) if value is null, undefined, NaN, Infinity, -Infinity, or non-numeric string.
 */
export function safeNumber(val: unknown, fallback = 0): number {
  if (val === null || val === undefined || val === "") return fallback;
  if (typeof val === "number") {
    return Number.isFinite(val) ? val : fallback;
  }
  if (typeof val === "string") {
    const cleaned = val.replace(/,/g, "").trim();
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

/**
 * Safely divides two values, preventing Division-by-Zero and NaN/Infinity results.
 */
export function safeDivision(numerator: unknown, denominator: unknown, fallback = 0): number {
  const num = safeNumber(numerator, 0);
  const den = safeNumber(denominator, 0);
  if (den === 0 || !Number.isFinite(den)) return fallback;
  const result = num / den;
  return Number.isFinite(result) ? result : fallback;
}

/**
 * Formats a date using en-IN locale with custom options.
 * Default pattern: day/month/short-form (e.g. "12 Jul")
 */
export function formatDate(
  date: string | Date | number | null | undefined,
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }
): string {
  if (!date) return "-";
  try {
    const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("en-IN", options);
  } catch {
    return "-";
  }
}

/**
 * Formats a datetime using en-IN locale with custom options.
 * Default pattern: "12 Jul, 02:30 PM" or similar depending on browser locale behavior
 */
export function formatDateTime(
  date: string | Date | number | null | undefined,
  options: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }
): string {
  if (!date) return "-";
  try {
    const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("en-IN", options);
  } catch {
    return "-";
  }
}

/**
 * Formats a number or string into Indian Rupees (INR) format.
 * Example: 150000 -> ₹1,50,000.00
 * Strictly guarantees finite formatting; falls back to "₹0.00" on null/undefined/NaN/Infinity.
 */
export function formatCurrency(amount: unknown): string {
  const num = safeNumber(amount, 0);
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num);
  } catch {
    return `₹${num.toFixed(2)}`;
  }
}

/**
 * Formats a number or numeric string into localized en-IN integer or decimal format.
 * Example: 150000 -> "1,50,000" or "1,50,000.00"
 */
export function formatNumber(val: unknown, decimals = 2): string {
  const num = safeNumber(val, 0);
  try {
    return num.toLocaleString("en-IN", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  } catch {
    return num.toFixed(decimals);
  }
}
