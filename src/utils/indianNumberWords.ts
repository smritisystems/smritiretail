/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.29.0
 * Created      : 2026-08-20
 * Modified     : 2026-08-20
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

/**
 * Converts a numeric amount into Indian currency words format.
 * Correctly handles:
 * - Sub-rupee amounts (e.g. 0.50 -> "Zero Rupees and Fifty Paisa Only")
 * - Singular Rupee (e.g. 1.00 -> "One Rupee Only", 1.50 -> "One Rupee and Fifty Paisa Only")
 * - Plural Rupees (e.g. 2.00 -> "Two Rupees Only")
 * - Standard Indian numbering: Thousands, Lakhs, Crores
 */
export function numberToIndianWords(num: number): string {
  if (num === 0 || !Number.isFinite(num)) {
    return "Zero Rupees Only";
  }

  const singleDigits = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
  const doubleDigits = ["Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tensMultiple = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  const getWordForThreeDigits = (n: number): string => {
    let word = "";
    if (n >= 100) {
      word += singleDigits[Math.floor(n / 100)] + " Hundred ";
      n %= 100;
    }
    if (n >= 10 && n < 20) {
      word += doubleDigits[n - 10] + " ";
    } else if (n >= 20) {
      word += tensMultiple[Math.floor(n / 10)] + " " + singleDigits[n % 10] + " ";
    } else if (n > 0) {
      word += singleDigits[n] + " ";
    }
    return word;
  };

  let integerPart = Math.floor(Math.abs(num));
  let paisaPart = Math.round((Math.abs(num) - integerPart) * 100);
  if (paisaPart === 100) {
    integerPart += 1;
    paisaPart = 0;
  }

  let strWords = "";
  if (integerPart >= 10000000) {
    strWords += getWordForThreeDigits(Math.floor(integerPart / 10000000)) + "Crore ";
    integerPart %= 10000000;
  }
  if (integerPart >= 100000) {
    strWords += getWordForThreeDigits(Math.floor(integerPart / 100000)) + "Lakh ";
    integerPart %= 100000;
  }
  if (integerPart >= 1000) {
    strWords += getWordForThreeDigits(Math.floor(integerPart / 1000)) + "Thousand ";
    integerPart %= 1000;
  }
  if (integerPart > 0) {
    strWords += getWordForThreeDigits(integerPart);
  }

  const trimmedRupees = strWords.trim();
  const rupeeUnit = Math.floor(Math.abs(num)) === 1 ? "Rupee" : "Rupees";

  let result = "";
  if (trimmedRupees) {
    result = `${trimmedRupees} ${rupeeUnit}`;
  } else {
    result = "Zero Rupees";
  }

  if (paisaPart > 0) {
    const paisaWords = getWordForThreeDigits(paisaPart).trim();
    result += ` and ${paisaWords} Paisa`;
  }

  result += " Only";
  return result.replace(/\s{2,}/g, " ").trim();
}
