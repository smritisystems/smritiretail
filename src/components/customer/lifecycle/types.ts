/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.99.0
 * Created      : 2026-10-19
 * Modified     : 2026-10-19
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
  * Capability    : withCapability("customer.crud", "CRM")
 */

export type CustomerLifecycleMode = "view" | "edit" | "new";

export interface DeleteEligibilityMetrics {
  invoice_count: number;
  order_count: number;
  return_count: number;
  ledger_count: number;
  po_count: number;
  psv_count: number;
  relationship_count: number;
  outstanding_balance: number;
}

export interface CustomerDeleteEligibility {
  customerId: string;
  customerCode?: string;
  customerName: string;
  status: string;
  eligible: boolean;
  blockers: string[];
  warnings: string[];
  recommendation: "DEACTIVATE" | "PERMANENT_DELETE";
  reason: string;
  metrics: Partial<DeleteEligibilityMetrics>;
}

export interface DuplicateCheckCandidate {
  id: string;
  code?: string;
  name: string;
  mobile?: string;
  email?: string;
  gst_number?: string;
  status?: string;
}

export interface DuplicateCheckResult {
  decision: "NO_DUPLICATE" | "POSSIBLE_DUPLICATE" | "HARD_DUPLICATE";
  matched_identity?: "CUSTOMER_ID" | "CUSTOMER_CODE" | "GSTIN" | "EXTERNAL_ID" | "MOBILE" | "EMAIL";
  existing_customer?: DuplicateCheckCandidate;
  reason: string;
  allow_override: boolean;
}

export interface CustomerMergeResult {
  targetCustomerId: string;
  sourceCustomerId: string;
  target_customer_id?: string;
  source_customer_id?: string;
  source_code?: string;
  target_name?: string;
  status: string;
  message: string;
  reassignedRecords?: Record<string, number>;
  reassigned_records?: Record<string, number>;
  reassigned_records_count?: number;
  consolidated_outstanding?: number;
  mergedAt?: string;
  merged_at?: string;
}

