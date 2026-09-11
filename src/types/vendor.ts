/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.16.0
 * Created      : 2026-09-11
 * Modified     : 2026-09-11
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

export type VendorStatus = 
  | "ACTIVE"
  | "INACTIVE"
  | "BLOCKED"
  | "ON_HOLD"
  | "PENDING_VERIFICATION"
  | "ARCHIVED"
  | "MERGED";

export type SupplierType = 
  | "MANUFACTURER"
  | "DISTRIBUTOR"
  | "IMPORTER"
  | "TRADER"
  | "SERVICE_PROVIDER";

export type CommercialClassification = 
  | "PREFERRED"
  | "APPROVED"
  | "CONDITIONAL"
  | "RESTRICTED"
  | "BLOCKED";

export type MSMECategory = 
  | "MICRO"
  | "SMALL"
  | "MEDIUM"
  | "NOT_APPLICABLE";

export type ContactCategory = 
  | "SALES"
  | "ACCOUNTS"
  | "LOGISTICS"
  | "MANAGEMENT"
  | "OTHER"
  | "GENERAL";

export interface VendorBankAccount {
  id?: string;
  bankName: string;
  accountHolderName: string;
  accountNumber: string;
  ifsc: string;
  branch?: string;
  accountType: "CURRENT" | "SAVINGS" | "CC" | "OVERDRAFT";
  isPrimary: boolean;
  verificationStatus: "PENDING" | "VERIFIED" | "REJECTED";
  verifiedAt?: string;
}

export interface VendorContact {
  id?: string;
  contactName: string;
  contactCategory: ContactCategory;
  designation?: string;
  department?: string;
  phone?: string;
  mobile?: string;
  email?: string;
  isPrimary: boolean;
}

export interface VendorAddress {
  id?: string;
  addressType: "BILLING" | "SHIPPING" | "WAREHOUSE" | "REGISTERED_OFFICE" | "BRANCH";
  addressTitle?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  stateCode?: string;
  pincode: string;
  country: string;
  gstin?: string;
  isPrimary: boolean;
}

export interface VendorCommercialProfile {
  supplierType: SupplierType;
  paymentTermsDays: number;
  msmeRegistrationNo?: string;
  msmeCategory: MSMECategory;
  commercialClassification: CommercialClassification;
  tdsSection?: string;
  tdsRate: number;
  taxTreatment: string;
  outstandingLiability: number;
}

export interface VendorComplianceProfile {
  gstin?: string;
  pan?: string;
  msmeRegistrationNo?: string;
  msmeCategory: MSMECategory;
  verificationFlags: {
    gstVerified?: boolean;
    panVerified?: boolean;
    bankVerified?: boolean;
    msmeVerified?: boolean;
  };
}

export interface VendorSummary {
  id: string;
  code: string;
  legalName: string;
  tradeName?: string;
  gstin?: string;
  pan?: string;
  mobile?: string;
  email?: string;
  city?: string;
  state?: string;
  status: VendorStatus;
  commercialClassification: CommercialClassification;
  supplierType: SupplierType;
  outstanding: number;
}

export interface VendorDetail {
  id: string;
  code: string;
  legalName: string;
  tradeName?: string;
  partyType: string;
  gstin?: string;
  pan?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  pincode?: string;
  status: VendorStatus;
  mergedIntoPartyId?: string;

  commercial: VendorCommercialProfile;
  compliance: VendorComplianceProfile;
  contacts: VendorContact[];
  addresses: VendorAddress[];
  bankAccounts: VendorBankAccount[];
  roles: string[];
  tags: string[];
}

export interface VendorCreateRequest {
  code?: string;
  legalName: string;
  tradeName?: string;
  partyType?: string;
  gstin?: string;
  pan?: string;
  email?: string;
  mobile?: string;
  phone?: string;
  status?: VendorStatus;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  commercial?: Partial<VendorCommercialProfile>;
  contacts?: VendorContact[];
  addresses?: VendorAddress[];
  bankAccounts?: VendorBankAccount[];
  tags?: string[];
}

export interface VendorUpdateRequest {
  legalName?: string;
  tradeName?: string;
  gstin?: string;
  pan?: string;
  email?: string;
  mobile?: string;
  phone?: string;
  status?: VendorStatus;
  addressLine1?: string;
  city?: string;
  state?: string;
  pincode?: string;
  commercial?: Partial<VendorCommercialProfile>;
  contacts?: VendorContact[];
  addresses?: VendorAddress[];
  bankAccounts?: VendorBankAccount[];
  tags?: string[];
}

export type PartyRole = "SUPPLIER" | "CUSTOMER" | "EMPLOYEE" | "TRANSPORTER";
export type PartyType = "ORGANIZATION" | "INDIVIDUAL";
export type AddressType = "BILLING" | "SHIPPING" | "WAREHOUSE" | "REGISTERED_OFFICE" | "BRANCH";
export type BankAccountType = "CURRENT" | "SAVINGS" | "CC" | "OVERDRAFT";
export type BankVerificationStatus = "PENDING" | "VERIFIED" | "REJECTED";
export type TaxTreatment = "REGISTERED_REGULAR" | "REGISTERED_COMPOSITION" | "UNREGISTERED" | "OVERSEAS" | "SEZ";

export type VendorCommercial = VendorCommercialProfile;
export type VendorCompliance = VendorComplianceProfile;

export interface VendorMergeRequest {
  sourcePartyId: string;
  targetPartyId: string;
  mergeReason: string;
  reassignTransactions?: boolean;
}

export interface VendorMergeResponse {
  success: boolean;
  message: string;
  sourcePartyId: string;
  targetPartyId: string;
  reassignedCounts?: Record<string, number>;
}

export type VendorTabId =
  | "overview"
  | "identity"
  | "addresses"
  | "contacts"
  | "commercial"
  | "banking"
  | "procurement"
  | "payables"
  | "scorecard";

