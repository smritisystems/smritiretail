/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.99.1
 * Created      : 2026-08-21
 * Modified     : 2026-10-25
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

export type CustomerAddressType = "mailing" | "billing" | "shipping";

export interface CustomerGSTRegistrationOption {
  id: string;
  gstin: string;
  stateName: string;
  stateCode: string;
  registrationType: string;
  isPrimary: boolean;
  isActive: boolean;
}

export interface CustomerDirectoryItem {
  id: string;
  code: string | null;
  name: string;
  mobile: string | null;
  customer_group_id: string | null;
  customer_group_name: string | null;
  status: string;
  is_active: boolean;
  is_dependant?: boolean;
  parent_customer_id?: string | null;
  primary_account_code?: string | null;
  primary_account_name?: string | null;
  parent_customer_code?: string | null;
  parent_customer_name?: string | null;
  primary_account_status?: string | null;
  primary_account_is_active?: boolean | null;
  child_count?: number;
  relationship_type?: "parent" | "child" | "standalone" | string;
}

export interface CustomerDirectoryResponse {
  items: CustomerDirectoryItem[];
  total: number;
  skip: number;
  limit: number;
}

export interface CustomerAddressEntry {
  id?: string;
  code: string;
  contactPerson: string;
  addressType?: CustomerAddressType;
  locationName?: string;
  stateCode?: string;
  gstin?: string;
  gstRegistrationId?: string;
  storeCode?: string;
  billingStoreCode?: string;
  shippingStoreCode?: string;
  address1: string;
  address2: string;
  address3: string;
  address4: string;
  address5: string;
  locality: string;
  city: string;
  postalCode: string;
  state: string;
  zone: string;
  country: string;
  officePhone: string;
  homePhone: string;
  mobilePhone: string;
  faxNumber: string;
  email1: string;
  email2: string;
  email3: string;
  isDefault: boolean;
}

export const normalizeAddressPart = (value: unknown): string => String(value ?? "")
  .trim()
  .toLowerCase()
  .replace(/[\s,./\\#-]+/g, " ")
  .replace(/\s+/g, " ")
  .trim();

export const getCustomerAddressFingerprint = (address: Partial<CustomerAddressEntry>): string => {
  const addressType = address.addressType || "mailing";
  const parts = [
    address.address1,
    address.address2,
    address.address3,
    address.address4,
    address.address5,
    address.locality,
    address.city,
    address.state,
    address.stateCode,
    address.postalCode,
    address.country
  ].map(normalizeAddressPart);

  return parts.slice(0, -1).some(Boolean) ? `${addressType}|${parts.join("|")}` : "";
};

/**
 * Determines whether an address entry is an untouched default placeholder synthesized
 * during Customer Master normalization or default state initialization.
 */
export const isAddressEntryPlaceholder = (
  address?: Partial<CustomerAddressEntry>,
  customerName?: string
): boolean => {
  if (!address) return true;
  if (address.id) return false;

  // Check if any substantive address line, identifier, contact, or store code was entered
  const hasSubstantiveDetails = [
    address.address1,
    address.address2,
    address.address3,
    address.address4,
    address.address5,
    address.locality,
    address.postalCode,
    address.locationName,
    address.gstin,
    address.mobilePhone,
    address.officePhone,
    address.homePhone,
    address.email1,
    address.email2,
    address.email3,
    address.billingStoreCode,
    address.shippingStoreCode,
    address.storeCode
  ].some(val => Boolean(val && String(val).trim()));

  if (hasSubstantiveDetails) return false;

  // Check if contact person was changed to an active custom contact
  const contact = (address.contactPerson || "").trim();
  const isDefaultContact = !contact ||
    contact === (customerName || "").trim() ||
    contact === "Primary Contact" ||
    contact === "Contact Person";
  if (!isDefaultContact) return false;

  // Check if city or state was actively customized away from defaults
  const city = (address.city || "").trim();
  const isDefaultCity = !city || city.toLowerCase() === "gorakhpur";
  if (!isDefaultCity) return false;

  const state = (address.state || "").trim();
  const isDefaultState = !state || state.toLowerCase() === "uttar pradesh";
  if (!isDefaultState) return false;

  return true;
};

/**
 * Finds any actual new or edited Billing or Shipping address in addressList that is missing
 * its required store code. Untouched default placeholders from normalization are skipped.
 */
export const findMissingStoreCodeAddress = (
  addressList: CustomerAddressEntry[],
  initialAddresses: CustomerAddressEntry[] = [],
  customerName?: string
): CustomerAddressEntry | undefined => {
  return addressList.find((address, index) => {
    // Persisted records with an ID are already established
    if (address.id) return false;

    const isBilling = address.addressType === "billing";
    const isShipping = address.addressType === "shipping";
    if (!isBilling && !isShipping) return false;

    // Check if this entry corresponds to an initial placeholder passed into the editor
    const isInitialPlaceholder = initialAddresses &&
      index < initialAddresses.length &&
      isAddressEntryPlaceholder(initialAddresses[index], customerName);

    // If it was an initial placeholder and remains completely devoid of substantive address content,
    // it is an untouched default placeholder and should not block saving
    if (isInitialPlaceholder && isAddressEntryPlaceholder(address, customerName)) {
      return false;
    }

    // Otherwise, it is an actual new or edited Billing or Shipping address.
    // Enforce mandatory store code:
    if (isBilling && !address.billingStoreCode?.trim()) {
      return true;
    }
    if (isShipping && !address.shippingStoreCode?.trim()) {
      return true;
    }

    return false;
  });
};

export interface CustomerDependantEntry {
  id?: string;
  code: string;
  name: string;
  dependantCustomerId?: string;
  dependantCustomerCode?: string;
  dependantCustomerName?: string;
  parentCustomerId?: string;
  relation: string;
  applySameMailing: boolean;
  notes?: string;
}

export interface RetailCustomerRecord {
  id: string;
  code: string;
  name: string;
  parentCustomerId?: string;
  priceGroup: string;
  customerGroupId?: string;
  customer_group_id?: string;
  phone: string;
  email: string;
  
  // Classification Details
  religion: "Muslim" | "Hindu" | "Christian" | "Sikh" | "Jain" | "Buddhist" | "Jewish" | "Other" | string;
  ethnicity: "Asian" | "Arab" | "European" | "Australian" | "American" | "African" | "Other" | string;
  ageGroup: "<20" | ">=20 - <35" | ">=35 - <45" | ">=45 - <60" | ">=60" | string;
  profession: string;
  customerType: "Retail" | "VIP" | "Corporate" | "Wholesale" | "Walk-In" | string;
  
  // Profile Details
  profileNotes: string;
  
  // Details of Shoper
  companyCode: string;
  environment: "Retail" | "Distribution" | "Warehouse" | string;
  flatFileFormat: "GUI with Delimiter Format" | "Fixed Length Format" | "XML Format" | "JSON Format" | string;
  storeCode?: string;
  billingStoreCode?: string;
  shippingStoreCode?: string;
  isTaxInclusive: boolean;
  is_tax_inclusive?: boolean;
  delimiter: string;
  buyingFactor: number;
  sellingFactor: number;
  pricingBasis?: "MRP" | "RATE";
  pricing_basis?: "MRP" | "RATE";
  allowPromotionsOnRate?: boolean;
  allow_promotions_on_rate?: boolean;
  
  // Mailing Addresses
  mailingAddresses: CustomerAddressEntry[];
  
  // Retail Details: Dependant / Sub-Ordinate
  isDependant: boolean;
  showChildCustomersInBilling?: boolean;
  show_child_customers_in_billing?: boolean;
  primaryAccountCode: string;
  primaryAccountName: string;
  applyParentMailingInfo: boolean;
  dependants: CustomerDependantEntry[];
  
  // Enterprise Corporate Workspace Extensions (Reference Redesign)
  shortName?: string;
  legalEntityType?: string;
  accountManager?: string;
  tanNumber?: string;
  iecNumber?: string;
  industry?: string;
  businessNature?: string;
  annualTurnover?: string;
  website?: string;
  businessDescription?: string;
  corporateParent?: string;
  networkType?: string;
  externalCustomerCode?: string;
  ediEnabled?: boolean;
  keyContacts?: Array<{
    id?: string;
    name: string;
    designation: string;
    email: string;
    phone: string;
    isPrimary: boolean;
  }>;

  // Personal Details
  gender: "Female" | "Male" | "Other";
  dateOfBirth: string;
  isMarried: boolean;
  weddingAnniversary: string;
  
  // Loyalty Program Details
  loyaltyPgmId: string;
  loyaltyPgmCode: string;
  loyaltyTier: "Standard" | "Silver" | "Gold" | "Platinum" | "Diamond" | string;
  loyaltyPointsBalance: number;
  
  // Additional Details: Payment & Credit Policy
  paymentCategory: "CASH" | "CREDIT" | "CARD" | "UPI" | "NETBANKING" | "CHEQUE" | string;
  paymentTerm: string;
  defaultSalesChannel?: string | null;
  requirePoNumber?: boolean | null;
  creditLimit: number;
  creditDays: number;
  creditUsed: number;
  
  // Transport & Logistics
  transportMode: "By-Road" | "Air" | "Rail" | "Sea" | "Express Courier" | string;
  transportCode: string;
  transitDays: number;
  bankCode: string;
  bankLocation: string;
  
  // Price & Tax Factors
  retailFactor: number;
  dealerFactor: number;
  destinationTaxType: string;
  
  // Transaction Permissions
  allowCashBill: boolean;
  allowDcGen: boolean;
  allowCreditInvoice: boolean;
  allowMiscIssue: boolean;
  allowMiscReceipts: boolean;
  
  // Tax Registration & Shoper Details
  lstNumber: string;
  lstDate: string;
  cstNumber: string;
  cstDate: string;
  gstin: string;
  panNumber: string;
  isPreSaleFormApplicable: boolean;
  preSaleFormName: string;
  isPostSaleFormApplicable: boolean;
  postSaleFormName: string;
  
  // System Metadata
  status: "Active" | "Inactive" | "Blocked" | "Suspended";
  createdAt: string;
  updatedAt: string;

  // Model C Commercial Relationships
  companyRelationships?: CustomerCompanyRelationship[];
}

export interface CustomerPriceGroup {
  id: string; // Group code or uuid e.g. "CPP"
  code: string; // Code e.g. "CPP"
  description: string; // Description e.g. "Platinum Privilege"
  paymentTerms: string; // e.g. "PT", "Net 30", "Net 60", "Immediate"
  creditDays: number; // e.g. 60
  destTaxType: "Local" | "Interstate" | "Export" | "SEZ (With Tax)" | "SEZ (Without Tax)" | "Exempt" | string;
  creditLimit: number; // e.g. 500000
  itemClassificationPriceFactorApplicable: boolean;
  
  // Transactions Allowed
  allowCreditInvoice: boolean;
  allowCashInvoice: boolean;
  taxExclusiveInvoice: boolean;
  isTaxInclusive?: boolean;
  is_tax_inclusive?: boolean;
  allowMiscIssue: boolean; // Allow Goods (Misc.,) Issue (Without Invoicing)

  // Status & Audit
  status?: "Active" | "Inactive";
  createdAt?: string;
  modifiedAt?: string;
}

export interface CustomerCompanyRelationship {
  id: string;
  uuid?: string;
  customerId?: string;
  customer_id?: string;
  companyId?: string;
  company_id?: string;
  branchId?: string | null;
  branch_id?: string | null;
  customerGroupId?: string | null;
  customer_group_id?: string | null;
  priceTierId?: string | null;
  price_tier_id?: string | null;
  creditLimit?: number;
  credit_limit?: number;
  creditDays?: number;
  credit_days?: number;
  creditHold?: boolean;
  credit_hold?: boolean;
  status?: string;
  isActive?: boolean;
  is_active?: boolean;
  isDeleted?: boolean;
  is_deleted?: boolean;
  createdAt?: string;
  created_at?: string;
  modifiedAt?: string;
  modified_at?: string;
}

export interface CompanyCreditExposureItem {
  companyId: string;
  companyName?: string;
  companyCode?: string;
  relationshipId?: string;
  customerGroupId?: string;
  creditLimit: number;
  creditDays: number;
  creditHold: boolean;
  creditUsed: number;
  availableCredit: number;
  utilizationPercent: number;
  exposureStatus: "NORMAL" | "HIGH_WARNING" | "CRITICAL_BREACH" | "ON_HOLD" | string;
  status: string;
}

export interface CustomerCreditExposureResponse {
  customerId: string;
  customerName: string;
  code?: string;
  identityCode?: string;
  panNumber?: string;
  totalCreditLimit: number;
  totalCreditUsed: number;
  totalAvailableCredit: number;
  groupUtilizationPercent: number;
  groupRiskLevel: "LOW" | "MODERATE" | "HIGH" | "CRITICAL" | "ON_HOLD" | string;
  companyCount: number;
  holdCount: number;
  companyExposures: CompanyCreditExposureItem[];
}

