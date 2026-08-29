/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.16.0
 * Created      : 2026-08-29
 * Modified     : 2026-08-29
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { apiFetchV1 } from "../lib/apiFetchV1";

export interface SalesReturnContextLine {
  product_id: string;
  code: string;
  name: string;
  original_quantity: number;
  returned_quantity: number;
  remaining_quantity: number;
  unit_price: number;
  gst_rate: number;
  tax_amount: number;
  total_amount: number;
}

export interface SalesReturnPolicySummary {
  policy_id: string;
  policy_version: number;
  resolution_scope: string;
  return_window_days: number;
  allowed_refund_modes: string[];
  allowed_return_reasons: string[];
  supervisor_threshold: number;
}

export interface SalesReturnContext {
  invoice_id: string;
  invoice_no: string;
  invoice_date: string;
  status: string;
  customer?: {
    id: string;
    name: string;
    phone?: string;
    email?: string;
    outstanding?: number;
  };
  payment_context?: {
    payment_mode: string;
  };
  branch_id?: string;
  terminal_id?: string;
  shift_id?: string;
  lines: SalesReturnContextLine[];
  effective_policy: SalesReturnPolicySummary;
}

export interface SalesReturnItemPayload {
  product_id: string;
  code: string;
  name: string;
  quantity: number;
  price: number;
  gst_rate?: number;
  tax_amount?: number;
  total_amount?: number;
}

export interface SalesReturnCreatePayload {
  id: string;
  return_no: string;
  original_invoice_id: string;
  credit_note_number?: string;
  date?: string;
  reason?: string;
  refund_mode?: "CASH" | "CREDIT_NOTE" | "ORIGINAL_PAYMENT" | "STORE_CREDIT";
  supervisor_auth_token?: string;
  is_blind_return?: boolean;
  tax_total?: number;
  grand_total?: number;
  status?: string;
  items: SalesReturnItemPayload[];
}

export interface SalesReturnResponse {
  id: string;
  return_no: string;
  original_invoice_id: string;
  credit_note_number?: string;
  date: string;
  reason?: string;
  tax_total: number;
  grand_total: number;
  status: string;
  refund_mode?: string;
  customer_id?: string;
  idempotency_key?: string;
  policy_id?: string;
  policy_version?: number;
  policy_scope?: string;
  policy_snapshot?: any;
  items: any[];
}

export class SalesReturnService {
  /**
   * Fetches authoritative sales return context for an invoice from the backend.
   * Includes remaining returnable quantities, customer details, and resolved policy.
   */
  static async getReturnContext(invoiceId: string): Promise<SalesReturnContext> {
    const cleanId = encodeURIComponent(invoiceId.trim());
    return await apiFetchV1<SalesReturnContext>(`/sales/invoices/${cleanId}/return-context`);
  }

  /**
   * Submits a sales return request to the backend with atomic validation,
   * transaction-safe numbering, stock replenishment, and refund ledger adapter.
   */
  static async createSalesReturn(
    payload: SalesReturnCreatePayload,
    idempotencyKey?: string
  ): Promise<SalesReturnResponse> {
    const headers: Record<string, string> = {};
    if (idempotencyKey) {
      headers["Idempotency-Key"] = idempotencyKey;
    }

    return await apiFetchV1<SalesReturnResponse>("/sales/returns/", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
  }

  /**
   * Lists historical sales returns for the active tenant branch.
   */
  static async listSalesReturns(): Promise<SalesReturnResponse[]> {
    return await apiFetchV1<SalesReturnResponse[]>("/sales/returns/");
  }
}
