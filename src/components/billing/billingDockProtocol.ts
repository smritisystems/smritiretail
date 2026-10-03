/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.0
 * Created      : 2026-09-27
 * Modified     : 2026-09-27
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Billing Dock Cross-Window Synchronization Protocol
 */

export const SMRITI_BILLING_DOCK_CHANNEL = "SMRITI_BILLING_DOCK";

export interface DockProductPayload {
  id?: string;
  code: string;
  name: string;
  price?: number;
  mrp?: number;
  gst_rate?: number;
  hsn_code?: string;
  unit?: string;
  stock?: number;
  category?: string;
  brand?: string;
}

export interface DockCustomerPayload {
  id: string;
  code: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  gst_number?: string;
  credit_limit?: number;
  balance?: number;
  available_credit?: number;
  status?: string;
}

export type BillingDockMessage =
  | {
      type: "ADD_TO_CART";
      product: DockProductPayload;
      quantity: number;
    }
  | {
      type: "CUSTOMER_SELECTED";
      customer: DockCustomerPayload;
    }
  | {
      type: "CART_UPDATED";
      itemsCount: number;
      totalQty: number;
      netAmount: number;
      invoiceNo?: string;
    };

/**
 * Creates or gets the singleton BroadcastChannel for SMRITI Billing Dock.
 */
export function getBillingDockChannel(): BroadcastChannel | null {
  if (typeof window === "undefined" || !("BroadcastChannel" in window)) {
    return null;
  }
  return new BroadcastChannel(SMRITI_BILLING_DOCK_CHANNEL);
}

/**
 * Dispatches an event on the Billing Dock channel.
 */
export function broadcastBillingDock(message: BillingDockMessage): void {
  try {
    const ch = getBillingDockChannel();
    if (ch) {
      ch.postMessage(message);
      ch.close();
    }
  } catch (err) {
    console.warn("[BILLING_DOCK] Failed to broadcast message:", err);
  }
}
