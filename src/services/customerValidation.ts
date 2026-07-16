/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.0
 * Created      : 2026-07-13
 * Modified     : 2026-07-13
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import { Customer } from "../types.ts";

export interface CustomerValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateCustomerProfile(
  customer: Partial<Customer>,
  existingCustomers: Customer[]
): CustomerValidationResult {
  const errors: string[] = [];

  if (!customer.name || !customer.name.trim()) {
    errors.push("Customer Name is required.");
  }

  if (customer.mobile) {
    const mobileRegex = /^[0-9]{10}$/;
    if (!mobileRegex.test(customer.mobile)) {
      errors.push("Mobile number must be a valid 10-digit numeric value.");
    }
  }

  if (customer.email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customer.email)) {
      errors.push("Email address format is invalid.");
    }
  }

  if (customer.gstNumber) {
    const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    if (!gstRegex.test(customer.gstNumber)) {
      errors.push("GSTIN format is invalid. Must match standard 15-character structure.");
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
