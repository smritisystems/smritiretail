/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.0
 * Created      : 2026-07-13
 * Modified     : 2026-07-13
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

/**
 * Formats a number or numeric string into the Indian numbering format (Lakhs and Crores).
 * Example:
 *   150000 -> "1,50,000"
 *   1024500.50 -> "10,24,500.50"
 *   12345678.9 -> "1,23,45,678.90"
 */
export function formatIndianNumber(num: number | string): string {
  if (num === null || num === undefined || num === "") return "0.00";

  const numVal = typeof num === "string" ? parseFloat(num) : num;
  if (isNaN(numVal)) return "0.00";

  // Split integer and decimal parts
  const fixedStr = numVal.toFixed(2);
  const parts = fixedStr.split(".");
  let integerPart = parts[0];
  const decimalPart = parts[1];

  const isNegative = integerPart.startsWith("-");
  if (isNegative) {
    integerPart = integerPart.substring(1);
  }

  // Indian layout grouping: last 3 digits, then pairs of 2 digits
  const lastThree = integerPart.substring(integerPart.length - 3);
  const otherParts = integerPart.substring(0, integerPart.length - 3);

  let formattedInteger = lastThree;
  if (otherParts !== "") {
    // Group remaining digits in groups of 2
    const remainingGroups: string[] = [];
    let i = otherParts.length;
    while (i > 0) {
      const start = Math.max(0, i - 2);
      remainingGroups.unshift(otherParts.substring(start, i));
      i -= 2;
    }
    formattedInteger = remainingGroups.join(",") + "," + lastThree;
  }

  const sign = isNegative ? "-" : "";
  return `${sign}${formattedInteger}.${decimalPart}`;
}
