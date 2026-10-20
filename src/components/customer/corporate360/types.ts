/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.99.0
 * Created      : 2026-10-18
 * Modified     : 2026-10-18
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Target UI    : Corporate Customer 360 Dashboard Types
 */

import { Customer } from "../../../types.ts";

export type CorporateTabKey =
  | "overview"
  | "basic"
  | "corporate_tax"
  | "addresses"
  | "parent_child"
  | "stores"
  | "commercial"
  | "psv"
  | "sales_invoices"
  | "contacts_docs"
  | "activity_audit"
  // Legacy aliases
  | "orders"
  | "invoices"
  | "payments"
  | "products"
  | "communication"
  | "contracts"
  | "team"
  | "notes"
  | "history";

export interface PsvDetailedItem {
  id: string;
  doc_no: string;
  date: string;
  customer_code: string;
  customer_name?: string;
  store_code: string;
  article_style: string;
  color: string;
  size: string;
  barcode: string;
  document_qty: number;
  received_qty: number;
  pending_approval_qty: number;
  approved_qty: number;
  shortage_qty: number;
  excess_qty: number;
  status: "Approved" | "Pending" | "Excess" | "Shortage" | "Rejected" | string;
}

export interface CorporateKpis {
  total_orders: number;
  orders_growth_pct: number;
  total_purchase_value: number;
  purchase_growth_pct: number;
  average_order_value: number;
  aov_growth_pct: number;
  last_order_date: string;
  last_order_relative: string;
  total_stores: number;
  active_stores: number;
  active_stores_pct: number;
  total_psv_value: number;
  psv_stores_count: number;
}

export interface StoreAddressItem {
  id: string;
  address_type: "Delivery" | "Billing" | "Warehouse" | "Registered" | "Shipping" | "Other" | string;
  address_title?: string;
  address_line1: string;
  address_line2?: string;
  locality?: string;
  city: string;
  district?: string;
  state: string;
  state_code?: string;
  pincode: string;
  country?: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  is_primary: boolean;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface StoreCodeLookupItem {
  id: string;
  store_code: string;
  store_name: string;
  city: string;
  state?: string;
  store_type: string;
  status: string;
  address_summary: string;
  assigned_customer_id?: string;
  assigned_customer_name?: string;
  assigned_customer_code?: string;
  is_assigned: boolean;
  is_selectable: boolean;
  disabled_reason?: string;
  addresses_count: number;
  psv_value: number;
}

export interface CorporateStoreItem {
  id: string;
  store_code: string;
  store_name: string;
  city: string;
  state: string;
  store_type: "Supermarket" | "Hypermarket" | "Fashion" | "Electronics" | "Others" | string;
  status: "Active" | "Inactive" | string;
  psv_value: number;
  psv_status?: string;
  psv_value_display?: string;
  contact?: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  gstin?: string;
  address_summary?: string;
  addresses?: StoreAddressItem[];
}

export interface CorporatePsvSummary {
  total_value: number;
  in_stock_value: number;
  in_stock_stores: number;
  low_stock_value: number;
  low_stock_stores: number;
  out_of_stock_value: number;
  out_of_stock_stores: number;
  not_reporting_stores?: number;
}

export interface StoreTypeSlice {
  type: string;
  count: number;
  percentage: number;
  color: string;
}

export interface RecentOrderItem {
  order_no: string;
  date: string;
  stores_count: number;
  items_count: number;
  value: number;
  status: "Completed" | "Dispatched" | "Pending" | "Cancelled" | string;
}

export interface PurchaseTrendItem {
  month: string;
  purchase_value: number;
  orders: number;
}

export interface CategoryShareItem {
  category: string;
  value: number;
  share_pct: number;
  share_percentage?: number;
  value_formatted?: string;
}

export interface CorporateCustomer360Data {
  customer: Customer & {
    customer_type?: string;
    credit_limit?: number;
    credit_days?: number;
    payment_term?: string;
    payment_terms?: string;
    price_group?: string;
    segment?: string;
    servicing_region?: string;
    primary_account_manager?: {
      name: string;
      title: string;
      initials: string;
    };
    registered_address?: string;
    website?: string;
    gst_number?: string;
    gstin?: string;
    pan_number?: string;
    legal_name?: string;
    account_status?: string;
    is_corporate?: boolean;
    badges?: string[];
    address_line1?: string;
    city?: string;
    state?: string;
    pincode?: string;
    country?: string;
    children?: any[];
    dependants?: any[];
    delivery_locations?: any[];
    stores?: any[];
  };
  kpis: CorporateKpis;
  store_network: CorporateStoreItem[];
  psv_summary: CorporatePsvSummary;
  store_type_distribution: StoreTypeSlice[];
  recent_orders: RecentOrderItem[];
  purchase_trend: PurchaseTrendItem[];
  top_categories: CategoryShareItem[];
  sales_invoices?: Array<{
    id?: string;
    invoice_number?: string;
    date?: string;
    total_amount?: number;
    status?: string;
  }>;
}
