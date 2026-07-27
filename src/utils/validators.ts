/**
 * Project      : SMRITI Retail OS
 * Organization : SmritiSys
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.0
 * Created      : 2026-07-12
 * Modified     : 2026-07-12
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

const GSTIN_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * Calculates the 15th checksum character of an Indian GSTIN using Luhn Mod 36.
 */
export function calculateGSTINChecksum(gstin14: string): string {
  if (!gstin14 || gstin14.length !== 14) return "";
  const clean = gstin14.trim().toUpperCase();
  let total = 0;
  for (let i = 0; i < 14; i++) {
    const val = GSTIN_CHARS.indexOf(clean[i]);
    if (val === -1) return "";
    const factor = (i % 2 === 0) ? 2 : 1;
    const product = val * factor;
    total += Math.floor(product / 36) + (product % 36);
  }
  const remainder = total % 36;
  const checkVal = (36 - remainder) % 36;
  return GSTIN_CHARS[checkVal];
}

/**
 * Validates Indian GSTIN format and checksum digit.
 * Format: 2 digits (State Code) + 10 characters (PAN) + 1 digit (Entity code) + 1 character (Z) + 1 checksum char.
 */
export function isValidGSTIN(gstin: string): boolean {
  if (!gstin) return false;
  const clean = gstin.trim().toUpperCase();
  const regex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  if (!regex.test(clean)) return false;
  return calculateGSTINChecksum(clean.slice(0, 14)) === clean[14];
}

/**
 * Validates Indian Pincode format.
 * Format: 6 digits, cannot start with 0.
 */
export function isValidPIN(pin: string): boolean {
  if (!pin) return false;
  const clean = pin.trim();
  const regex = /^[1-9][0-9]{5}$/;
  return regex.test(clean);
}

/**
 * Validates Indian mobile number format.
 * Format: 10 digits, starting with 6, 7, 8, or 9.
 */
export function isValidMobile(mobile: string): boolean {
  if (!mobile) return false;
  const clean = mobile.replace(/[- ]/g, "").trim();
  const regex = /^[6-9]\d{9}$/;
  return regex.test(clean);
}

/**
 * Validates basic email address format.
 */
export function isValidEmail(email: string): boolean {
  if (!email) return false;
  const clean = email.trim();
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(clean);
}
