/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 5.5.0
 * Created      : 2026-08-21
 * Modified     : 2026-08-21
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

export type CustomerAddressType = "mailing" | "billing" | "shipping";

export interface CustomerAddressEntry {
  code: string;
  contactPerson: string;
  addressType?: CustomerAddressType;
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

export interface CustomerDependantEntry {
  code: string;
  name: string;
  relation: string;
  applySameMailing: boolean;
  notes?: string;
}

export interface RetailCustomerRecord {
  id: string;
  code: string;
  name: string;
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
  delimiter: string;
  buyingFactor: number;
  sellingFactor: number;
  
  // Mailing Addresses
  mailingAddresses: CustomerAddressEntry[];
  
  // Retail Details: Dependant / Sub-Ordinate
  isDependant: boolean;
  primaryAccountCode: string;
  primaryAccountName: string;
  applyParentMailingInfo: boolean;
  dependants: CustomerDependantEntry[];
  
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
}

export interface CustomerSearchFilterState {
  code: string;
  name: string;
  priceGroup: string;
  loyaltyPgmId: string;
  dateOfBirth: string;
  religion: string;
  ethnicity: string;
  ageGroup: string;
  profession: string;
  city: string;
  phone: string;
  state: string;
  locality: string;
  email: string;
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
  allowMiscIssue: boolean; // Allow Goods (Misc.,) Issue (Without Invoicing)

  // Status & Audit
  status?: "Active" | "Inactive";
  createdAt?: string;
  modifiedAt?: string;
}

