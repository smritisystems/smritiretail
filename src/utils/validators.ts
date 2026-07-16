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
 * Validates Indian GSTIN format.
 * Format: 2 digits (State Code) + 10 characters (PAN) + 1 digit (Entity code) + 1 character (Z by default) + 1 checksum digit/char.
 */
export function isValidGSTIN(gstin: string): boolean {
  if (!gstin) return false;
  const clean = gstin.trim().toUpperCase();
  const regex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return regex.test(clean);
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
