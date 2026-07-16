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
 * * Created    : 2026-07-10
 * * Modified   : 2026-07-14
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

export interface ProductBatch {
  batchNo: string;
  mfgDate: string;
  expiryDate: string;
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
  secondaryBarcodes?: string[]; // Added for secondary barcodes support
  barcodes?: { type: string; value: string; isPrimary?: boolean }[]; // Barcode Mapping relationships
  brand?: string; // Added for brand support in template tokens
  color?: string;
  size?: string;
  mrp?: number;
  gstPercentage?: number;
  styleCode?: string;
  costPrice?: number; // Added for variant cost price support
  sku?: string; // Added for variant SKU support
  hsnCode?: string; // Added for HSN Code support
  // Extensible Attribute fields
  attributes?: Record<string, string>; // e.g. { "Sole Type": "Rubber", "Color": "Navy", "Size": "M" }
  pricingMode?: "Fixed" | "Weight-based" | "Negotiated" | "Service";
  trackingMode?: "Standard" | "Batch" | "Serial" | "No-stock";
  variantTemplateId?: string; // Reference to VariantTemplate
  weightGrams?: number; // Used for Weight-based pricing
  batches?: ProductBatch[]; // Used for Batch tracking
  serialNumbers?: string[]; // Used for Serial tracking
  primaryImageUrl?: string; // SPIF Primary Product Image
  galleryImages?: string[]; // SPIF Gallery Images URLs list
}

export interface AttributeDefinition {
  id: string;
  name: string; // Name (e.g., Sole Type, Material, Screen Size, Molecule, Pack Size)
  label: string; // Human-friendly label (e.g., Sole Type, Material)
  dataType: "text" | "number" | "date" | "select";
  isVariantDimension: boolean; // If true, contributes to variant SKU and grid structure
  isMandatory: boolean;
  validValues: string[]; // Set of allowed values, e.g., ["Rubber", "PU", "PVC"]
}

export interface AttributeGroup {
  id: string;
  name: string; // Name (e.g., "Footwear Standard", "Apparel Basic", "Hardware Fasteners")
  attributeIds: string[]; // Ordered attribute IDs
  gridColumnAttributeId?: string; // E.g. "Size"
  gridRowAttributeId?: string; // E.g. "Color"
}

export interface VariantTemplate {
  id: string;
  styleCode: string; // Parent template style code prefix
  name: string; // Base name of the product line
  brand: string;
  category: string;
  hsnCode: string;
  basePrice: number;
  baseMrp: number;
  gstPercentage: number;
  attributeGroupId: string;
  pricingMode: "Fixed" | "Weight-based" | "Negotiated" | "Service";
  trackingMode: "Standard" | "Batch" | "Serial" | "No-stock";
}

export interface CategoryAttributeGroupMapping {
  category: string;
  attributeGroupId: string;
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
  openedAt: string;
  closedAt: string | null;
  openingBalance: number;
  closingBalance: number | null;
  salesCount: number;
  salesValue: number;
  status: "Open" | "Closed" | "Locked";
  cashier?: string;
  warehouse?: string;
  branch?: string;
  startTime?: string;
  endTime?: string | null;
  openingCash?: number;
  closingCash?: number | null;
}

export interface FieldInfo {
  id: string;
  fieldName: string;
  label: string;
  fieldType: string;
  docType: string;
  isStable: boolean;
  description: string;
  sampleValue: string;
}

export interface Formula {
  id: string;
  name: string;
  category: string;
  expression: string;
  meaning: string;
  workedExample: string;
  dataSources: string[];
  interpretation: {
    critical: string;
    monitor: string;
    healthy: string;
  };
  recommendedAction: string;
  value: string;
}

export interface PSVPartySkuTracking {
  productId: string;
  sku: string;
  productName: string;
  invoicedQty: number;      // Quantity dispatched to partner via SalesInvoices
  confirmedSoldQty: number; // Quantity sold by partner (from report)
  returnedQty: number;      // Quantity returned back via SalesReturns
}

export interface PSVParty {
  id: string;
  name: string;
  location: string;
  stockCount: number;
  sellThrough: number; // percentage
  weeksOfCover: number;
  capitalLocked: number; // in INR
  status: "Healthy" | "Monitor" | "Critical";
  history: { date: string; sales: number; stock: number }[];
  skuTracking?: PSVPartySkuTracking[]; // per-SKU tracking
}

export interface Bill {
  id: string;
  timestamp: string;
  items: { product: Product; quantity: number }[];
  total: number;
  customerName?: string;
}

export interface SalesItemLine {
  productId: string;
  code: string;
  name: string;
  color?: string;
  size?: string;
  quantity: number;
  price: number;
  taxRate: number; // e.g. 18 for 18% GST
  taxAmount: number;
  totalAmount: number;
}

export interface Quotation {
  id: string;
  quotationNo: string;
  date: string;
  customerName: string;
  items: SalesItemLine[];
  taxTotal: number;
  grandTotal: number;
  status: "Draft" | "Submitted" | "Approved" | "Rejected" | "Cancelled" | "Converted";
  salesOrderId?: string;
}

export interface SalesOrder {
  id: string;
  orderNo: string;
  date: string;
  customerName: string;
  items: SalesItemLine[];
  taxTotal: number;
  grandTotal: number;
  status: "Draft" | "Submitted" | "Approved" | "Rejected" | "Confirmed" | "Shipped" | "Cancelled";
  sourceQuotationId?: string;
}

export interface PrintTemplate {
  id: string;
  title: string;
  labelSize: "50x25" | "50x30" | "75x50" | "100x50";
  printerLanguage: "ZPL" | "TSPL";
  printerFamily: "ZPL" | "TSPL";
  version?: string;
  isActive: boolean;
  isDefaultSize: boolean;
  rawPRN: string;
  fieldMappings?: { token: string; source_field: string }[];
}

export interface PrintProfile {
  id: string;
  name: string;
  templateId: string;
  printerIP: string;
  printerPort: number;
  dpi: number;
  copies: number;
  labelSize: string;
  isDefault: boolean;
}



// Reporting Engine Metadata Types
export interface ReportDefinition {
  id: string;
  name: string;
  description?: string;
  module: string;
  category: string;
  type: "Grid" | "Pivot" | "Chart" | "Matrix" | "Dashboard";
  owner: string;
  version: number;
  dataSources: string[];
  fields: any[]; // field IDs and formatting
  filters: any[];
  grouping: any[];
  aggregations: any[];
  permissions: {
    roleId: string;
    canView: boolean;
    canExport: boolean;
    canEdit: boolean;
  }[];
}

export interface PartnerCounterAssignment {
  customerId: string; // Reference to partner Customer ID
  startDate: string;  // ISO date string
  endDate?: string;   // ISO date string, optional if current/ongoing
}

export interface Staff {
  id: string;
  // 1. Employee Information
  employeeId: string;
  name: string;
  department: string;
  designation: string;
  branch: string;
  dateOfJoining: string;
  reportingManager: string;
  employmentType: "Permanent" | "Contract" | "Part-time";
  counterAssignment?: PartnerCounterAssignment; // Optional placement at partner counter

  // 2. Salary Structure
  salary: {
    fixedMonthly: number;
    commission: {
      type: "None" | "Fixed" | "Percentage" | "Target-based";
      value: number; // e.g., flat amount or percentage
    };
    travelAllowance: {
      type: "None" | "Fixed Monthly" | "Per Kilometer" | "Actual Reimbursement";
      value: number;
    };
    otherAllowances: {
      da: number;
      mobile: number;
      internet: number;
      fuel: number;
    };
  };

  // 3. Notifications Preferences (boolean flags)
  notifications: {
    salaryCredit: boolean;
    commissionEarned: boolean;
    targetAchievement: boolean;
    travelClaimApproval: boolean;
    leaveApproval: boolean;
    attendanceAlerts: boolean;
    holidayWeeklyOff: boolean;
    birthdayAnniversary: boolean;
    policyAnnouncements: boolean;
  };

  // 4. Payment Details
  payment: {
    frequency: "Monthly" | "Weekly" | "Bi-weekly";
    bankDetails: string;
    upi: string;
    salaryEffectiveFrom: string;
    commissionEffectiveFrom: string;
  };

  // 5. Attendance & Performance Metrics (Snapshot/Summary)
  performance: {
    attendancePercentage: number;
    monthlySales: number;
    targetsAssigned: number;
    targetsAchieved: number;
    commissionEarned: number;
    travelClaimStatus: "Pending" | "Approved" | "Rejected" | "None";
  };
}

export interface LedgerEntry {
  id: string;
  date: string;
  account: string;
  type: 'Credit' | 'Debit';
  amount: number;
  referenceId?: string; // invoice ID, payment ID
  referenceType?: 'SalesInvoice' | 'PurchaseInvoice' | 'PaymentReceipt' | 'JournalEntry';
  description?: string;
  balance?: number;
}

export interface StockLedgerEntry {
  id: string;
  timestamp: string;
  productId: string;
  productCode: string;
  productName: string;
  movementType: "IN" | "OUT" | "ADJUSTMENT" | "TRANSFER";
  quantity: number;
  balanceAfter: number;
  referenceDocType: "SalesInvoice" | "PurchaseGRN" | "ManualAdjustment" | "Return";
  referenceDocId: string;
  warehouse: string;
  notes?: string;
  
  // Extended Metadata for granular stock tracking
  user?: string;
  sourceModule?: string;
  bin?: string;
  batch?: string;
  serial?: string;
  quantityIn?: number;
  quantityOut?: number;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  module: string;
  action: "CREATE" | "UPDATE" | "DELETE" | "APPROVE";
  targetId: string;
  targetName: string;
  oldValue?: string;
  newValue?: string;
  ipAddress?: string;
}

// ============================================================================
// Customer & Customer Group — Policy Inheritance Model
// CustomerGroup defines defaults; Customer inherits and may selectively override.
// A field left `undefined` on a Customer means "inherit from its CustomerGroup".
// Use resolveCustomerPolicy() (src/services/customerPolicyEngine.ts) to merge them
// into the shape actually used at billing/checkout time.
// ============================================================================

export type PaymentMethod = "Cash" | "Credit" | "Advance" | "Partial" | "UPI" | "BankTransfer" | "Cheque" | "Card";
export type TaxCategory = "Standard" | "Zero-Rated" | "Exempt" | "Reverse Charge";
export type InvoiceLanguage = "en" | "hi" | "mr" | "gu" | "ta" | "te" | "kn"; // extend as needed
export type RoundingRule = "None" | "Nearest1" | "Nearest5" | "Nearest10";

export interface CustomerGroup {
  id: string;
  name: string; // e.g. "Retail Customers", "Corporate Customers", "Export Customers"

  // Credit Management
  creditLimit: number; // ignored if unlimitedCredit is true
  unlimitedCredit: boolean;
  creditDays: number; // payment terms, e.g. 30
  graceDays: number; // additional days before marked overdue
  creditHold: boolean; // true = new credit sales blocked regardless of limit
  autoBlockSales: boolean; // true = block sale automatically once limit exceeded
  warningThresholdPercent: number; // e.g. 80 = warn at 80% of credit limit used
  allowOverride: boolean; // can an individual Customer override this group's settings
  overridePermissionRole?: string; // role required to approve an override, e.g. "Store Manager"

  // Tax Rules
  taxInclusive: boolean; // true = prices shown inclusive of tax
  gstPercentageOverride?: number; // if set, overrides item-level GST for this group
  taxCategory?: TaxCategory;

  // Price Policy
  defaultPriceListId?: string;
  maxDiscountPercent: number;
  minMarginPercent: number;
  roundingRule: RoundingRule;

  // Payment Policy
  allowedPaymentMethods: PaymentMethod[];
  preferredPaymentMethod?: PaymentMethod;

  // Sales Policy
  allowBackOrders: boolean;
  allowNegativeStockSales: boolean;
  requireApprovalAboveAmount?: number;
  requirePoNumber: boolean;

  // Communication Defaults
  defaultWhatsappTemplateId?: string;
  defaultEmailTemplateId?: string;
  defaultSmsTemplateId?: string;
  invoiceLanguage: InvoiceLanguage;

  // Document Defaults
  invoiceSeriesId?: string; // links to DocumentSeries (numberingEngine)
  quotationSeriesId?: string;
  salesOrderSeriesId?: string;

  // Permissions
  canViewPrice: boolean;
  canViewMargin: boolean;
  canPurchaseOnCredit: boolean;
  canReceiveDiscount: boolean;
}

export interface Customer {
  id: string;
  customerGroupId: string; // every customer must belong to a CustomerGroup

  // Identity
  name: string;
  mobile: string;
  /** @deprecated Use mobile instead */
  phone?: string;
  email?: string;
  gstNumber?: string;
  pan?: string;
  code?: string;
  shortName?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  sortOrder?: number;

  // --- Everything below is optional: undefined = inherit from CustomerGroup ---

  // Credit overrides
  creditLimit?: number;
  unlimitedCredit?: boolean;
  creditDays?: number;
  graceDays?: number;
  creditHold?: boolean;

  // Tax overrides
  taxInclusive?: boolean;
  gstPercentageOverride?: number;
  taxCategory?: TaxCategory;

  // Pricing overrides
  priceListId?: string;
  discountPercent?: number;

  // Payment overrides
  preferredPaymentMethod?: PaymentMethod;

  // Sales overrides
  salesPerson?: string;
  salesperson?: string; // added to match lowercase property
  territory?: string;
  preferredWarehouse?: string;
  route?: string;

  // Address Details
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

  // Overrides & Additional Info
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

  // Communication overrides
  preferredLanguageEnum?: InvoiceLanguage;
  marketingOptIn?: boolean;

  // --- Always customer-specific, never inherited ---
  outstanding: number; // current amount owed, updated by ledger transactions
  status: "Active" | "Inactive" | "Blocked" | string;
  createdDate: string;
  lastPurchaseDate?: string;
  lastPaymentDate?: string;
  tags?: string[];
}

// The resolved, ready-to-use shape after merging a Customer's overrides
// on top of its CustomerGroup's defaults. Nothing downstream (billing,
// checkout, pricing) should read Customer or CustomerGroup fields directly —
// always go through resolveCustomerPolicy() and use this instead.
export interface ResolvedCustomerPolicy {
  creditLimit: number;
  unlimitedCredit: boolean;
  creditDays: number;
  graceDays: number;
  creditHold: boolean;
  autoBlockSales: boolean;
  warningThresholdPercent: number;
  taxInclusive: boolean;
  gstPercentageOverride?: number;
  taxCategory?: TaxCategory;
  priceListId?: string;
  maxDiscountPercent: number;
  minMarginPercent: number;
  roundingRule: RoundingRule;
  preferredPaymentMethod?: PaymentMethod;
  allowBackOrders: boolean;
  allowNegativeStockSales: boolean;
  requireApprovalAboveAmount?: number;
  requirePoNumber: boolean;
  invoiceLanguage: InvoiceLanguage;
  canViewPrice: boolean;
  canViewMargin: boolean;
  canPurchaseOnCredit: boolean;
  canReceiveDiscount: boolean;
}

export interface CreditCheckResult {
  allowed: boolean;
  reason?: string;
  effectiveCreditLimit: number;
  currentOutstanding: number;
  wouldBeOutstanding: number;
  usagePercentAfter: number;
  warningTriggered: boolean;
}

// ============================================================================
// Sales Invoice and Sales Return — Large Format Retail & GST 2.0
// ============================================================================

export interface SalesInvoiceItemLine {
  productId: string;
  code: string;
  name: string;
  quantity: number;
  price: number;
  hsnCode: string;
  gstRate: number; // e.g. 18 for 18% GST
  taxAmount: number;
  totalAmount: number;
}

export interface SalesInvoice {
  id: string;
  invoiceNo: string;
  date: string;
  customerId: string; // link to Customer (e.g. Reliance, Shoppers Stop, Lifestyle)
  items: SalesInvoiceItemLine[];
  taxTotal: number;
  grandTotal: number;
  isInterstate: boolean;
  eWayBillNo?: string;
  status: "Draft" | "Submitted" | "Approved" | "Cancelled";
}

export interface SalesReturnItemLine {
  productId: string;
  quantity: number;
  price: number;
  gstRate: number; // e.g. 18 for 18% GST
  taxAmount: number;
  totalAmount: number;
}

export interface SalesReturn {
  id: string;
  returnNo: string;
  originalInvoiceId: string;
  items: SalesReturnItemLine[];
  creditNoteNumber: string;
  date: string;
  reason: string;
  taxTotal: number;
  grandTotal: number;
  isInterstate: boolean;
  status: "Draft" | "Submitted" | "Approved" | "Cancelled";
}

export interface UserPreferences {
  theme: "light" | "dark";
  language: string;
  timeZone: string;
}

export interface User {
  id: string; // Keep for Staff-compatibility
  userId: string;
  employeeId: string;
  username: string;
  passwordHash: string; // Plain password or bcrypt hash
  role: string;
  status: "Active" | "Inactive" | "Suspended" | "Locked" | "Resigned";
  failedAttempts?: number;
  lockedUntil?: string;

  // Personal/Contact Info
  photo: string; // base64 or url
  fullName: string;
  displayName: string;
  employeeCode: string;
  gender: string;
  dateOfBirth: string;
  mobile: string;
  alternateMobile?: string;
  email: string;
  emergencyContact: string;
  address: string;
  landmark?: string;
  city: string;
  state: string;
  country: string;
  pinCode: string;

  // Staff Fields
  department: string;
  designation: string;
  branch: string;
  departmentId?: string;
  designationId?: string;
  branchId?: string;
  dateOfJoining: string;
  reportingManager: string;
  employmentType: "Permanent" | "Contract" | "Part-time";
  allowedBranches: string[];

  // Salary Structure
  salary?: {
    fixedMonthly: number;
    commission: {
      type: "None" | "Fixed" | "Percentage" | "Target-based";
      value: number;
    };
    travelAllowance: {
      type: "None" | "Fixed Monthly" | "Per Kilometer" | "Actual Reimbursement";
      value: number;
    };
    otherAllowances: {
      da: number;
      mobile: number;
      internet: number;
      fuel: number;
    };
  };

  // Notification Preferences (Mutes)
  notificationSettings: {
    salaryCredit: boolean;
    commissionEarned: boolean;
    targetAchievement: boolean;
    travelClaimApproval: boolean;
    leaveApproval: boolean;
    attendanceAlerts: boolean;
    holidayWeeklyOff: boolean;
    birthdayAnniversary: boolean;
    policyAnnouncements: boolean;
  };

  // Payment Details
  payment?: {
    frequency: "Monthly" | "Weekly" | "Bi-weekly";
    bankDetails: string;
    upi: string;
    salaryEffectiveFrom: string;
    commissionEffectiveFrom: string;
  };

  // Attendance & Performance
  performance?: {
    attendancePercentage: number;
    monthlySales: number;
    targetsAssigned: number;
    targetsAchieved: number;
    commissionEarned: number;
    travelClaimStatus: "Pending" | "Approved" | "Rejected" | "None";
  };

  preferences: UserPreferences;
}

export interface Supplier {
  id: string;
  name: string;
  vendorCode: string;
  taxRegistrationNumber: string;
  category: string;
  address: string;
  landmark?: string;
  contactDetails: string;
}

export interface PurchaseItem {
  productId: string;
  code: string;
  name: string;
  color: string;
  size: string;
  quantity: number;
  receivedQuantity: number;
  price: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
}

export interface PurchaseOrder {
  id: string;
  orderNo: string;
  date: string;
  supplierId: string;
  supplierName: string;
  expectedDeliveryDate: string;
  company: string;
  currency: string;
  items: PurchaseItem[];
  taxTotal: number;
  grandTotal: number;
  receivedPercentage: number;
  status: "Draft" | "Confirmed" | "Complete" | "Cancelled";
  remarks: string;
  paidAmount: number;
  submittedBy?: string;
  submittedAt?: string;
  amendedFromId?: string;
}

export interface GoodsReceipt {
  id: string;
  receiptNo: string;
  date: string;
  purchaseOrderId: string;
  supplierName: string;
  items: {
    productId: string;
    code: string;
    name: string;
    color: string;
    size: string;
    quantityReceived: number;
  }[];
}


