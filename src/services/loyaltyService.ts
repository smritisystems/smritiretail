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

export interface Wallet {
  id: string;
  customer: string;
  points: number;
  tier: "Silver" | "Gold" | "Platinum";
}

export function calculatePointsEarned(spendAmount: number, multiplier: number): number {
  if (spendAmount <= 0) return 0;
  return Math.floor(spendAmount * multiplier);
}

export function determineTier(spendAmount: number): "Silver" | "Gold" | "Platinum" {
  if (spendAmount >= 75000) return "Platinum";
  if (spendAmount >= 25000) return "Gold";
  return "Silver";
}
