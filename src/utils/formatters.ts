/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.0
 * Created      : 2026-07-12
 * Modified     : 2026-07-12
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

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
  } catch (e) {
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
  } catch (e) {
    return "-";
  }
}

/**
 * Formats a number or string into Indian Rupees (INR) format.
 * Example: 150000 -> ₹1,50,000.00
 */
export function formatCurrency(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined) return "₹0.00";
  try {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    if (isNaN(num)) return "₹0.00";
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num);
  } catch (e) {
    return "₹0.00";
  }
}
