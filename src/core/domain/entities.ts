/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 *
 * Founders
 *
 * * Pushpa Devi Jawahar Mallah
 *   * Founder & Chairperson
 *   * Phone: +91 9324117007
 *   * Email: founder@aitdl.com
 *
 * * Jawahar Ramkripal Mallah
 *   * Founder, Chief Executive Officer (CEO) & Chief Software Architect
 *   * Email: founder@aitdl.com
 *
 * * Websites: aitdl.com | erpnbook.com | smritibooks.com
 *
 * * Version    : 3.16.1
 * * Created    : 2026-07-11
 * * Modified   : 2026-07-14
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

export interface ProductBatch {
  batchNo: string;
  expiryDate?: string;
  stock: number;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  price: number;
  stock: number;
  category: string;
  isFavorite?: boolean;
  barcode: string;
  secondaryBarcodes?: string[];
  barcodes?: { type: string; value: string; isPrimary?: boolean }[];
  brand?: string;
  color?: string;
  size?: string;
  mrp?: number;
  gstPercentage?: number;
  styleCode?: string;
  costPrice?: number;
  sku?: string;
  hsnCode?: string;
  attributes?: Record<string, string>;
  pricingMode?: "Fixed" | "Weight-based" | "Negotiated" | "Service";
  trackingMode?: "Standard" | "Batch" | "Serial" | "No-stock";
  variantTemplateId?: string;
  weightGrams?: number;
  batches?: ProductBatch[];
  serialNumbers?: string[];
}

export interface CustomerGroup {
  id: string;
  name: string;
  discountPercentage: number;
  allowCredit: boolean;
}

export interface Customer {
  id: string;
  name: string;
  mobile: string;
  /** @deprecated Use mobile instead */
  phone?: string;
  email?: string;
  outstanding?: number;
  creditLimit?: number;
  group?: string;
  loyaltyPoints?: number;
  gstNumber?: string;
  pan?: string;
  alternateMobile?: string;
  customerType?: "Individual" | "Business";
  aadhaar?: string;
  billingAddressLine1?: string;
  billingAddressLine2?: string;
  billingCity?: string;
  billingState?: string;
  billingCountry?: string;
  billingPincode?: string;
  shippingSameAsBilling?: boolean;
  shippingAddressLine1?: string;
  shippingAddressLine2?: string;
  shippingCity?: string;
  shippingState?: string;
  shippingCountry?: string;
  shippingPincode?: string;
  priceListId?: string;
  salesperson?: string;
  territory?: string;
  route?: string;
  creditLimitOverride?: number;
  creditDaysOverride?: number;
  openingBalance?: number;
  openingBalanceType?: "Dr" | "Cr";
  blacklisted?: boolean;
  photoUrl?: string;
  dateOfBirth?: string;
  anniversaryDate?: string;
  gender?: string;
  occupation?: string;
  preferredLanguage?: string;
  loyaltyMember?: boolean;
  leadSource?: string;
  notes?: string;
  status?: string;
  createdDate?: string;
}

export interface POSProfile {
  id: string;
  name: string;
  cashier: string;
  warehouse: string;
  branch: string;
  isLocked: boolean;
  isArchived: boolean;
}

export interface Shift {
  id: string;
  profileId: string;
  cashier: string;
  warehouse: string;
  branch: string;
  startTime: string;
  endTime?: string | null;
  status: "Open" | "Closed" | "Locked";
  openingCash: number;
  closingCash?: number | null;
  salesCount: number;
  salesValue: number;
  // Compatibility fields
  openedAt?: string;
  closedAt?: string | null;
  openingBalance?: number;
  closingBalance?: number | null;
}

export interface SalesInvoiceItem {
  id?: string;
  productId: string;
  code: string;
  name: string;
  quantity: number;
  price: number;
  gstRate: number;
  taxAmount: number;
  totalAmount: number;
  hsnCode?: string;
}

export interface SalesInvoice {
  id: string;
  invoiceNo: string;
  date: string;
  customerId: string;
  taxTotal: number;
  grandTotal: number;
  status: string;
  items: SalesInvoiceItem[];
  isInterstate?: boolean;
  eWayBillNo?: string;
}

export interface AuditLog {
  id?: string;
  timestamp?: string;
  operator: string;
  actionType: string;
  tableName: string;
  recordId: string;
  oldValue: string;
  newValue: string;
  reason: string;
}

export interface SyncQueueItem {
  id?: number;
  uuid: string;
  module: string;
  operation: string;
  entity: string;
  payload: string; // JSON Stringified data
  status: "pending" | "synced" | "failed";
  retryCount: number;
  createdAt: string;
  updatedAt: string;
  lastAttempt?: string;
  deviceId?: string;
  companyId?: string;
  branchId?: string;
}
