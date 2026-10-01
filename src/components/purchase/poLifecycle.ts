/**
 * Project      : SMRITI Retail OS
 * Module       : Purchase Order Lifecycle Helpers (Phase A + D)
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Version      : 2.1.0
 * Created      : 2026-07-11
 * Modified     : 2026-10-01
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

/**
 * Canonical PO status values (uppercase, server-side authoritative).
 * Phase A adds SUBMITTED as a real intermediate state.
 */
export type POStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "CONFIRMED"
  | "RECEIVED"
  | "COMPLETED"
  | "CANCELLED";

/** Normalize any raw status string to a canonical POStatus. */
export function normalizePOStatus(status?: string | null): POStatus {
  const upper = String(status || "").trim().toUpperCase();
  if (upper === "DRAFT" || upper === "D") return "DRAFT";
  if (upper === "SUBMITTED") return "SUBMITTED";
  if (upper === "CONFIRMED" || upper === "OPEN") return "CONFIRMED";
  if (upper === "RECEIVED") return "RECEIVED";
  if (upper === "COMPLETED") return "COMPLETED";
  if (upper === "CANCELLED") return "CANCELLED";
  return "DRAFT"; // safe default
}

/**
 * Display label for a PO status.
 * Each status is deliberately distinct — SUBMITTED ≠ CONFIRMED.
 */
export function formatPOStatusLabel(status?: string | null): string {
  switch (normalizePOStatus(status)) {
    case "DRAFT":     return "Draft";
    case "SUBMITTED": return "Submitted";
    case "CONFIRMED": return "Confirmed";
    case "RECEIVED":  return "Received";
    case "COMPLETED": return "Completed";
    case "CANCELLED": return "Cancelled";
  }
}

/**
 * @deprecated Use normalizePOStatus() + formatPOStatusLabel() instead.
 * Kept for backward compatibility with callers that relied on the old combined label.
 */
export function normalizePurchaseStatus(status?: string | null): string {
  return formatPOStatusLabel(status);
}

/** Returns true if this status allows editing (only DRAFT is editable). */
export function isPOEditable(status?: string | null): boolean {
  return normalizePOStatus(status) === "DRAFT";
}

/** Returns true if this status allows submission (DRAFT only). */
export function isPOSubmittable(status?: string | null): boolean {
  return normalizePOStatus(status) === "DRAFT";
}

/** Returns true if this status allows confirmation (SUBMITTED only). */
export function isPOConfirmable(status?: string | null): boolean {
  return normalizePOStatus(status) === "SUBMITTED";
}

/** Returns true if this status allows cancellation (DRAFT or CONFIRMED or SUBMITTED). */
export function isPOCancellable(status?: string | null): boolean {
  const s = normalizePOStatus(status);
  return s === "DRAFT" || s === "SUBMITTED" || s === "CONFIRMED";
}

/**
 * Phase D: Returns true if this status allows amendment (CONFIRMED only).
 * Only Managers/SysAdmins may amend; the button is hidden for other roles.
 * Amendment creates a new Confirmed revision; original becomes Superseded.
 */
export function isPOAmendable(status?: string | null): boolean {
  return normalizePOStatus(status) === "CONFIRMED";
}

export function buildPurchaseOrderDetailUrl(orderNo?: string | null): string {
  if (!orderNo) return "/purchase/orders/";
  return `/purchase/orders/${encodeURIComponent(String(orderNo).trim())}`;
}

export function buildVendor360SelectionKey(supplierId?: string | null): string {
  return String(supplierId || "").trim();
}
