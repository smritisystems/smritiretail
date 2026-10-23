/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.99.1
 * Created      : 2026-08-21
 * Modified     : 2026-10-23
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useF2Screen, useF2Dispatcher } from "../../context/F2DispatcherContext.tsx";
import type { LookupResult } from "../../context/F2DispatcherContext.tsx";
import { 
  Users, 
  Plus, 
  Search, 
  Save, 
  Trash2, 
  ChevronLeft, 
  ChevronRight, 
  RotateCcw, 
  Layers, 
  FileText, 
  Heart, 
  CreditCard, 
  Grid, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  Edit3,
  Building2,
  ChevronDown,
  History,
  Share2,
  Sliders,
  PowerOff,
  Power,
  Eye,
  XCircle,
  GitMerge,
  Globe2
} from "lucide-react";
import { RetailCustomerRecord, CustomerAddressEntry, CustomerAddressType, CustomerGSTRegistrationOption, getCustomerAddressFingerprint, CustomerCompanyRelationship, CustomerCreditExposureResponse, CustomerDirectoryItem, CustomerDirectoryResponse } from "./types.ts";
import { SmritiCustomerFormTab } from "./CustFormTab.tsx";
import { SmritiCustomerRetailDetailsTab } from "./CustRetailDetTab.tsx";
import { SmritiCustomerAdditionalDetailsTab } from "./CustAddlDetTab.tsx";
import { SmritiCustomerMailingModal } from "./CustMailingDlg.tsx";
import { SmritiAdvancedCustomerSearchModal } from "./AdvancedCustSearch.tsx";
import { ExportButton } from "../export/ExportButton.tsx";
import { ExportColumnDefinition } from "../export/types.ts";
import { apiFetchV1 } from "../../lib/apiFetchV1.ts";
import { cacheCustomersSession } from "../../services/customerStore.ts";
import { CorporateMasterAccountHeader } from "./corporateWorkspace/CorporateMasterAccountHeader.tsx";
import { CorporateIdentityCompliancePanel } from "./corporateWorkspace/CorporateIdentityCompliancePanel.tsx";
import { CorporateNetworkPanel } from "./corporateWorkspace/CorporateNetworkPanel.tsx";
import { CorporateAddressesContactsPanel } from "./corporateWorkspace/CorporateAddressesContactsPanel.tsx";
import { CorporateIntegrationsPanel } from "./corporateWorkspace/CorporateIntegrationsPanel.tsx";
import { CorporateActivityAuditPanel } from "./corporateWorkspace/CorporateActivityAuditPanel.tsx";
import { GstRegistrationEntry } from "./corporateWorkspace/AddEditGstModal.tsx";
import { SmritiCustomerPriceGroupModal } from "./CustPriceGroupDlg.tsx";
import { StoreCodeLookupItem } from "./corporate360/types.ts";
import { CreateCustomerModal } from "./lifecycle/CreateCustomerModal.tsx";
import { CustomerDeactivateModal } from "./lifecycle/CustomerDeactivateModal.tsx";
import { CustomerDeleteConfirmationModal } from "./lifecycle/CustomerDeleteConfirmationModal.tsx";
import { CustomerMergeModal } from "./lifecycle/CustomerMergeModal.tsx";
import { EnterpriseCustomerSearchModal } from "./lifecycle/EnterpriseCustomerSearchModal.tsx";
import { CustomerLifecycleMode, CustomerMergeResult } from "./lifecycle/types.ts";

const LazyCorporateCustomer360 = React.lazy(() =>
  import("./corporate360/CorporateCustomer360.tsx").then((module) => ({
    default: module.CorporateCustomer360,
  })),
);
const LazyEnterpriseCustomerMasterView = React.lazy(() =>
  import("./corporateWorkspace/EnterpriseCustomerMasterView.tsx").then((module) => ({
    default: module.EnterpriseCustomerMasterView,
  })),
);
const LazyCorporateCommercialTermsPanel = React.lazy(() =>
  import("./corporateWorkspace/CorporateCommercialTermsPanel.tsx").then((module) => ({
    default: module.CorporateCommercialTermsPanel,
  })),
);

const DEFAULT_MAILING_ADDRESS: CustomerAddressEntry = {
  code: "001",
  addressType: "mailing",
  contactPerson: "",
  storeCode: "",
  billingStoreCode: "",
  shippingStoreCode: "",
  address1: "",
  address2: "",
  address3: "",
  address4: "",
  address5: "",
  locality: "",
  city: "Gorakhpur",
  postalCode: "",
  state: "Uttar Pradesh",
  zone: "North",
  country: "India",
  officePhone: "",
  homePhone: "",
  mobilePhone: "",
  faxNumber: "",
  email1: "",
  email2: "",
  email3: "",
  isDefault: true
};

const createDefaultMailingAddress = (overrides: Partial<CustomerAddressEntry> = {}): CustomerAddressEntry => ({
  ...DEFAULT_MAILING_ADDRESS,
  ...overrides
});

const createDefaultAddressSet = (): CustomerAddressEntry[] => [
  createDefaultMailingAddress({ code: "001", addressType: "mailing" }),
  createDefaultMailingAddress({ code: "002", addressType: "billing" }),
  createDefaultMailingAddress({ code: "003", addressType: "shipping" })
];

const normalizeMailingAddresses = (addresses: unknown, fallback: Partial<CustomerAddressEntry> = {}): CustomerAddressEntry[] => {
  const source = Array.isArray(addresses) && addresses.length > 0 ? addresses : [createDefaultMailingAddress(fallback)];
  const normalized = source.map((address, index) => ({
    ...DEFAULT_MAILING_ADDRESS,
    ...(address as Partial<CustomerAddressEntry>),
    code: (address as Partial<CustomerAddressEntry>).code || String(index + 1).padStart(3, "0"),
    addressType: ((address as Partial<CustomerAddressEntry>).addressType ?? (address as any).address_type ?? "mailing") as CustomerAddressType,
    storeCode: (address as Partial<CustomerAddressEntry>).storeCode ?? (address as any).store_code ?? "",
    billingStoreCode: (address as Partial<CustomerAddressEntry>).billingStoreCode ?? (address as any).billing_store_code ?? "",
    shippingStoreCode: (address as Partial<CustomerAddressEntry>).shippingStoreCode ?? (address as any).shipping_store_code ?? "",
    isDefault: Boolean((address as Partial<CustomerAddressEntry>).isDefault ?? (address as any).is_default)
  }));
  const complete: CustomerAddressEntry[] = [...normalized];
  if (!complete.some(address => address.addressType === "billing")) {
    complete.push(createDefaultMailingAddress({ code: String(complete.length + 1).padStart(3, "0"), addressType: "billing" }));
  }
  if (!complete.some(address => address.addressType === "shipping")) {
    complete.push(createDefaultMailingAddress({ code: String(complete.length + 1).padStart(3, "0"), addressType: "shipping" }));
  }

  const deduplicated = complete.reduce<CustomerAddressEntry[]>((result, address) => {
    const storeCode = address.storeCode || address.shippingStoreCode || address.billingStoreCode;
    if (storeCode) {
      const existingStoreIndex = result.findIndex(
        existing => (existing.storeCode || existing.shippingStoreCode || existing.billingStoreCode) === storeCode && existing.addressType === address.addressType
      );
      if (existingStoreIndex >= 0) {
        result[existingStoreIndex] = { ...result[existingStoreIndex], ...address };
        return result;
      }
      result.push(address);
      return result;
    }

    const fingerprint = getCustomerAddressFingerprint(address);
    if (!fingerprint) {
      result.push(address);
      return result;
    }

    const duplicateIndex = result.findIndex(existing => getCustomerAddressFingerprint(existing) === fingerprint);
    if (duplicateIndex < 0) {
      result.push(address);
      return result;
    }

    const existing = result[duplicateIndex];
    result[duplicateIndex] = Object.keys(address).reduce((merged, key) => {
      const value = address[key as keyof CustomerAddressEntry];
      if (value !== undefined && value !== null && String(value).trim() !== "") {
        (merged as any)[key] = value;
      }
      return merged;
    }, { ...existing, isDefault: existing.isDefault || address.isDefault });
    return result;
  }, []);

  const defaultIndexes = new Map<CustomerAddressType, number>();
  deduplicated.forEach((address, index) => {
    const addressType = address.addressType || "mailing";
    if (address.isDefault && !defaultIndexes.has(addressType)) defaultIndexes.set(addressType, index);
  });
  if (!defaultIndexes.has("mailing")) defaultIndexes.set("mailing", 0);
  if (!defaultIndexes.has("billing")) {
    const billingIndex = deduplicated.findIndex(address => address.addressType === "billing");
    if (billingIndex >= 0) defaultIndexes.set("billing", billingIndex);
  }
  if (!defaultIndexes.has("shipping")) {
    const shippingIndex = deduplicated.findIndex(address => address.addressType === "shipping");
    if (shippingIndex >= 0) defaultIndexes.set("shipping", shippingIndex);
  }

  return deduplicated.map((address, index) => ({
    ...address,
    isDefault: index === defaultIndexes.get(address.addressType || "mailing")
  }));
};

const INDIAN_STATE_CODES: Record<string, string> = {
  andhra: "37", arunachal: "12", assam: "18", bihar: "10", chhattisgarh: "22",
  goa: "30", gujarat: "24", haryana: "06", himachal: "02", jharkhand: "20",
  karnataka: "29", kerala: "32", madhya: "23", maharashtra: "27", manipur: "14",
  meghalaya: "17", mizoram: "15", nagaland: "13", odisha: "21", punjab: "03",
  rajasthan: "08", sikkim: "11", tamil: "33", telangana: "36", tripura: "16",
  uttar: "09", uttarakhand: "05", bengal: "19", delhi: "07", chandigarh: "04",
  puducherry: "34", puducheri: "34", ladakh: "38", lakshadweep: "31",
  "jammu": "01", "dadra": "26", "daman": "25", "andaman": "35"
};

const resolveStateCode = (address: CustomerAddressEntry): string => {
  if (address.stateCode?.trim()) return address.stateCode.trim().padStart(2, "0");
  const state = address.state.trim().toLowerCase();
  const match = Object.entries(INDIAN_STATE_CODES).find(([name]) => state.includes(name));
  return match?.[1] || "";
};

export const mergeCanonicalLocationsIntoAddresses = (
  addresses: unknown,
  deliveryLocations: any[] = [],
  billingLocations: any[] = [],
  fallback: Partial<CustomerAddressEntry> = {}
): CustomerAddressEntry[] => {
  const merged = normalizeMailingAddresses(addresses, fallback);
  const appendLocation = (location: any, addressType: CustomerAddressType, codeField: "shippingStoreCode" | "billingStoreCode") => {
    const locationCode = location.store_code ?? location.storeCode ?? location.billing_store_code ?? location.billingStoreCode;
    if (!locationCode) return;
    const existingIndex = merged.findIndex(address =>
      address.id === location.id ||
      address[codeField] === locationCode ||
      (addressType === "shipping" && address.storeCode === locationCode)
    );
    const mapped: CustomerAddressEntry = {
      ...DEFAULT_MAILING_ADDRESS,
      id: location.id,
      code: location.id || String(merged.length + 1).padStart(3, "0"),
      addressType,
      locationName: location.location_name ?? location.locationName ?? "",
      contactPerson: location.contact_person ?? location.contactPerson ?? "",
      stateCode: location.state_code ?? location.stateCode ?? "",
      gstin: location.gstin ?? location.delivery_gstin ?? location.deliveryGstin ?? "",
      gstRegistrationId: location.gst_registration_id ?? location.gstRegistrationId ?? "",
      [codeField]: String(locationCode),
      storeCode: String(locationCode),
      shippingStoreCode: addressType === "shipping" ? String(locationCode) : (location.shipping_store_code ?? location.shippingStoreCode ?? ""),
      billingStoreCode: addressType === "billing" ? String(locationCode) : (location.billing_store_code ?? location.billingStoreCode ?? ""),
      address1: location.address_line1 ?? location.addressLine1 ?? "",
      address2: location.address_line2 ?? location.addressLine2 ?? "",
      city: location.city ?? "",
      postalCode: location.pincode ?? location.pin_code ?? location.pinCode ?? "",
      state: location.state ?? location.state_name ?? location.stateName ?? "",
      country: location.country ?? "India",
      mobilePhone: location.phone ?? location.contact_phone ?? location.contactPhone ?? "",
      email1: location.email ?? location.contact_email ?? location.contactEmail ?? "",
      isDefault: Boolean(location.is_default ?? location.isDefault)
    };
    if (existingIndex >= 0) {
      merged[existingIndex] = { ...merged[existingIndex], ...mapped };
    } else {
      merged.push(mapped);
    }
  };

  deliveryLocations.forEach(location => appendLocation(location, "shipping", "shippingStoreCode"));
  billingLocations.forEach(location => appendLocation(location, "billing", "billingStoreCode"));
  const populatedTypes = new Set(
    merged
      .filter(address => address.id || address.storeCode || address.shippingStoreCode || address.billingStoreCode)
      .map(address => address.addressType || "mailing")
  );
  const withoutEmptyPlaceholders = merged.filter(address => {
    const type = address.addressType || "mailing";
    const hasContent = [address.address1, address.address2, address.address3, address.address4, address.address5, address.locality, address.postalCode]
      .some(value => value.trim());
    return address.id || !populatedTypes.has(type) || hasContent;
  });
  return normalizeMailingAddresses(withoutEmptyPlaceholders, fallback);
};

export const getLocationIdsToDeactivate = (
  existingLocations: Array<{ id: string }>,
  knownAddressIds: Set<string>,
  submittedLocationIds: Set<string>
): string[] => existingLocations
  .filter(location => knownAddressIds.has(location.id) && !submittedLocationIds.has(location.id))
  .map(location => location.id);

const syncCanonicalCustomerLocations = async (
  customerId: string,
  addresses: CustomerAddressEntry[]
): Promise<CustomerAddressEntry[]> => {
  const [existingDelivery, existingBilling] = await Promise.all([
    apiFetchV1<any[]>(`/crm/customers/${customerId}/delivery-locations`),
    apiFetchV1<any[]>(`/crm/customers/${customerId}/billing-locations`)
  ]);
  const savedAddresses = addresses.map(address => ({ ...address }));
  const knownAddressIds = new Set(
    savedAddresses.map(address => address.id).filter((id): id is string => Boolean(id))
  );
  const submittedLocationIds = new Set<string>();
  const addressLine = (address: CustomerAddressEntry) =>
    [address.address1, address.address2, address.address3, address.address4, address.address5, address.locality]
      .map(value => value.trim()).filter(Boolean).join(", ");
  const locationName = (address: CustomerAddressEntry, code: string) =>
    address.locationName?.trim() || address.contactPerson?.trim() || `${address.city || "Customer"} (${code})`;

  for (const address of savedAddresses) {
    const isBilling = address.addressType === "billing";
    const code = (isBilling ? address.billingStoreCode : (address.shippingStoreCode || address.storeCode))?.trim().toUpperCase();
    if (!code) continue;

    const stateCode = resolveStateCode(address);
    if (!address.city.trim() || !address.state.trim() || !address.postalCode.trim() || !stateCode || !addressLine(address)) {
      if (address.id) continue;
      throw new Error(`${isBilling ? "Billing" : "Delivery"} location ${code} needs a complete address, state, state code, and PIN code.`);
    }

    if (isBilling) {
      const existing = (existingBilling || []).find(location =>
        location.id === address.id || String(location.billing_store_code ?? location.billingStoreCode).toUpperCase() === code
      );
      const payload = {
        billingStoreCode: code,
        locationName: locationName(address, code),
        addressLine1: addressLine(address),
        city: address.city.trim(),
        state: address.state.trim(),
        stateCode,
        pincode: address.postalCode.trim(),
        country: address.country || "India",
        ...(address.id ? {} : {
          gstRegistrationId: address.gstRegistrationId || undefined,
          gstin: address.gstin?.trim().toUpperCase() || undefined
        }),
        contactPerson: address.contactPerson || undefined,
        phone: address.mobilePhone || address.officePhone || undefined,
        email: address.email1 || undefined,
        isDefault: address.isDefault
      };
      const saved = existing
        ? await apiFetchV1<any>(`/crm/customers/${customerId}/billing-locations/${existing.id}`, { method: "PUT", body: payload })
        : await apiFetchV1<any>(`/crm/customers/${customerId}/billing-locations`, { method: "POST", body: payload });
      address.id = saved?.id || existing?.id;
      if (address.id) submittedLocationIds.add(address.id);
    } else {
      const existing = (existingDelivery || []).find(location =>
        location.id === address.id || String(location.store_code ?? location.storeCode).toUpperCase() === code
      );
      const payload = {
        storeCode: code,
        locationName: locationName(address, code),
        addressLine1: addressLine(address),
        addressLine2: address.address2 || undefined,
        city: address.city.trim(),
        state: address.state.trim(),
        stateCode,
        pincode: address.postalCode.trim(),
        country: address.country || "India",
        ...(address.id ? {} : {
          gstRegistrationId: address.gstRegistrationId || undefined,
          gstin: address.gstin?.trim().toUpperCase() || undefined
        }),
        contactPerson: address.contactPerson || undefined,
        phone: address.mobilePhone || address.officePhone || undefined,
        email: address.email1 || undefined,
        isDefault: address.isDefault
      };
      const saved = existing
        ? await apiFetchV1<any>(`/crm/customers/${customerId}/delivery-locations/${existing.id}`, { method: "PUT", body: payload })
        : await apiFetchV1<any>(`/crm/customers/${customerId}/delivery-locations`, { method: "POST", body: payload });
      address.id = saved?.id || existing?.id;
      if (address.id) submittedLocationIds.add(address.id);
    }
  }

  const deliveryIdsToDeactivate = getLocationIdsToDeactivate(existingDelivery || [], knownAddressIds, submittedLocationIds);
  const billingIdsToDeactivate = getLocationIdsToDeactivate(existingBilling || [], knownAddressIds, submittedLocationIds);

  await Promise.all([
    ...deliveryIdsToDeactivate.map(locationId =>
      apiFetchV1(`/crm/customers/${customerId}/delivery-locations/${locationId}`, { method: "DELETE" })
    ),
    ...billingIdsToDeactivate.map(locationId =>
      apiFetchV1(`/crm/customers/${customerId}/billing-locations/${locationId}`, { method: "DELETE" })
    )
  ]);

  return savedAddresses;
};

const SEED_CUSTOMERS: RetailCustomerRecord[] = [
  {
    id: "cust-rrl-192b561d",
    code: "RRL-001",
    name: "Reliance Retail Limited",
    priceGroup: "CORP#Standard Corporate",
    phone: "9820098200",
    email: "billing@relianceretail.com",
    religion: "Hindu",
    ethnicity: "Asian",
    ageGroup: ">=20 - <35",
    profession: "Corporate Enterprise",
    customerType: "Corporate",
    profileNotes: "Authoritative Enterprise Corporate Customer with multiple delivery and billing locations.",
    companyCode: "001",
    environment: "Corporate",
    flatFileFormat: "GUI with Delimiter Format",
    storeCode: "",
    billingStoreCode: "BILL-A",
    shippingStoreCode: "",
    isTaxInclusive: true,
    pricingBasis: "MRP",
    allowPromotionsOnRate: false,
    delimiter: ";",
    buyingFactor: 1.00,
    sellingFactor: 1.00,
    mailingAddresses: createDefaultAddressSet(),
    isDependant: false,
    showChildCustomersInBilling: false,
    show_child_customers_in_billing: false,
    primaryAccountCode: "",
    primaryAccountName: "",
    applyParentMailingInfo: false,
    dependants: [],
    gender: "Female",
    dateOfBirth: "",
    isMarried: false,
    weddingAnniversary: "",
    loyaltyPgmId: "024",
    loyaltyPgmCode: "DSC",
    loyaltyTier: "Standard",
    loyaltyPointsBalance: 0,
    paymentCategory: "CASH",
    paymentTerm: "Net 45 Days",
    creditLimit: 100000,
    creditDays: 45,
    creditUsed: 0,
    transportMode: "By-Road",
    transportCode: "VRL",
    transitDays: 2,
    bankCode: "HDFC000123",
    bankLocation: "Mumbai Bandra Kurla",
    retailFactor: 1.00,
    dealerFactor: 0.85,
    destinationTaxType: "318#GST_RETAIL",
    allowCashBill: true,
    allowDcGen: true,
    allowCreditInvoice: true,
    allowMiscIssue: false,
    allowMiscReceipts: true,
    lstNumber: "LST-001",
    lstDate: "",
    cstNumber: "CST-001",
    cstDate: "",
    gstin: "27AAACR1921R1Z5",
    panNumber: "ABCDE1234F",
    isPreSaleFormApplicable: false,
    preSaleFormName: "",
    isPostSaleFormApplicable: false,
    postSaleFormName: "",
    status: "Active",
    createdAt: "2026-01-10",
    updatedAt: "2026-09-17"
  },
  {
    id: "cust-2",
    code: "CUST-002",
    name: "Rajesh Ramachandran",
    priceGroup: "VIP#Platinum Retail",
    phone: "9845520002",
    email: "rajesh.r@smriti.net",
    religion: "Hindu",
    ethnicity: "Asian",
    ageGroup: ">=45 - <60",
    profession: "Chief Architect",
    customerType: "VIP",
    profileNotes: "Prefers formal brogues and semi-annual bulk corporate purchases.",
    companyCode: "001",
    environment: "Retail",
    flatFileFormat: "GUI with Delimiter Format",
    storeCode: "",
    billingStoreCode: "",
    shippingStoreCode: "",
    isTaxInclusive: true,
    delimiter: ";",
    buyingFactor: 1.00,
    sellingFactor: 1.00,
    mailingAddresses: createDefaultAddressSet().map((address, index) => index === 0 ? {
      ...address,
      contactPerson: "Rajesh Ramachandran",
      locality: "Indiranagar",
      city: "Bangalore",
      postalCode: "560038"
    } : address),
    isDependant: false,
    primaryAccountCode: "",
    primaryAccountName: "",
    applyParentMailingInfo: false,
    dependants: [],
    gender: "Male",
    dateOfBirth: "1978-08-22",
    isMarried: true,
    weddingAnniversary: "2004-02-14",
    loyaltyPgmId: "024",
    loyaltyPgmCode: "DSC",
    loyaltyTier: "Platinum",
    loyaltyPointsBalance: 3820,
    paymentCategory: "CARD",
    paymentTerm: "Net 15 Days",
    creditLimit: 100000,
    creditDays: 45,
    creditUsed: 35000,
    transportMode: "Express Courier",
    transportCode: "BLUE DART",
    transitDays: 1,
    bankCode: "ICIC0000456",
    bankLocation: "MG Road, Bangalore",
    retailFactor: 1.00,
    dealerFactor: 0.80,
    destinationTaxType: "318#GST_RETAIL",
    allowCashBill: true,
    allowDcGen: true,
    allowCreditInvoice: true,
    allowMiscIssue: true,
    allowMiscReceipts: true,
    lstNumber: "",
    lstDate: "",
    cstNumber: "",
    cstDate: "",
    gstin: "29AABCR4455P1ZX",
    panNumber: "ABCPR4455P",
    isPreSaleFormApplicable: false,
    preSaleFormName: "",
    isPostSaleFormApplicable: false,
    postSaleFormName: "",
    status: "Active",
    createdAt: "2026-02-15",
    updatedAt: "2026-08-21"
  }
];

const createEmptyCustomer = (newCodeNumber: number): RetailCustomerRecord => ({
  id: `cust-draft-${Date.now()}`,
  code: `CUST-${String(newCodeNumber).padStart(3, "0")}`,
  name: "",
  // priceGroup will be overridden by the first available group loaded from /api/v1/customer-price-groups
  priceGroup: "",
  phone: "",
  email: "",
  customerGroupId: "CG-Retail",
  customer_group_id: "CG-Retail",
  religion: "Hindu",
  ethnicity: "Asian",
  ageGroup: ">=20 - <35",
  profession: "",
  customerType: "Retail",
  profileNotes: "",
  companyCode: "001",
  environment: "Retail",
  flatFileFormat: "GUI with Delimiter Format",
  storeCode: "",
  billingStoreCode: "",
  shippingStoreCode: "",
  isTaxInclusive: true,
  delimiter: ";",
  buyingFactor: 1.00,
  sellingFactor: 1.00,
  mailingAddresses: createDefaultAddressSet().map((address, index) => ({
    ...address,
    contactPerson: "",
    city: index === 0 ? "Gorakhpur" : address.city,
    state: index === 0 ? "Uttar Pradesh" : address.state,
    addressType: index === 0 ? "mailing" : address.addressType,
    isDefault: index === 0
  })),
  isDependant: false,
  showChildCustomersInBilling: false,
  show_child_customers_in_billing: false,
  primaryAccountCode: "",
  primaryAccountName: "",
  applyParentMailingInfo: false,
  dependants: [],
  gender: "Female",
  dateOfBirth: "",
  isMarried: false,
  weddingAnniversary: "",
  // loyaltyPgmId/Code intentionally left blank — assigned when customer enrolls in a program
  loyaltyPgmId: "",
  loyaltyPgmCode: "",
  loyaltyTier: "Standard",
  loyaltyPointsBalance: 0,
  paymentCategory: "CASH",
  paymentTerm: "Policy Not Configured",
  creditLimit: 0,
  creditDays: 0,
  creditUsed: 0,
  transportMode: "By-Road",
  transportCode: "VRL",
  transitDays: 2,
  bankCode: "",
  bankLocation: "",
  retailFactor: 1.00,
  dealerFactor: 0.85,
  destinationTaxType: "318#GST_RETAIL",
  allowCashBill: true,
  allowDcGen: false,
  allowCreditInvoice: true,
  allowMiscIssue: false,
  allowMiscReceipts: true,
  lstNumber: "",
  lstDate: "",
  cstNumber: "",
  cstDate: "",
  gstin: "",
  panNumber: "",
  isPreSaleFormApplicable: false,
  preSaleFormName: "",
  isPostSaleFormApplicable: false,
  postSaleFormName: "",
  status: "Active",
  createdAt: new Date().toISOString().split("T")[0],
  updatedAt: new Date().toISOString().split("T")[0]
});

export function mapBackendCustomerToRecord(bCust: any): RetailCustomerRecord {
  // Classification derivation from canonical backend fields
  const grpId = bCust.customerGroupId ?? bCust.customer_group_id ?? "";
  const tagList = Array.isArray(bCust.tags) ? bCust.tags : [];
  const isCorp = grpId === "CG-Corporate" || tagList.includes("Corporate") || tagList.includes("B2B");
  const isVIP = grpId === "CG-LargeRetail" || tagList.includes("VIP");
  const isWholesale = grpId === "CG-Wholesale" || tagList.includes("Wholesale");
  const isDist = grpId === "CG-Distribution" || tagList.includes("Distribution");

  // Determine customerType: respect explicit backend value if provided, else derive
  const derivedCustomerType = bCust.customer_type || bCust.customerType || (
    isCorp ? "Corporate" :
    isVIP ? "VIP" :
    isWholesale ? "Wholesale" :
    isDist ? "Distribution" :
    "Retail"
  );

  // Determine environment: respect explicit backend value if provided, else derive from type
  const derivedEnvironment = bCust.environment || (
    derivedCustomerType === "Corporate" || derivedCustomerType === "Wholesale" || derivedCustomerType === "Distribution"
      ? "Corporate"
      : "Retail"
  );

  // Determine priceGroup: respect explicit backend value if provided, else derive
  const derivedPriceGroup = bCust.price_group || bCust.priceGroup || (
    isCorp ? "CORP#Standard Corporate" :
    isVIP ? "VIP#Platinum Retail" :
    "TI#Tech Infotech Ltd"
  );

  // Normalize fields using API DTO aliases (camelCase) and raw model fields (snake_case)
  const rawGstin = bCust.gstNumber ?? bCust.gst_number ?? bCust.gstin;
  const rawLimit = bCust.creditLimit ?? bCust.credit_limit;
  const rawDays = bCust.creditDays ?? bCust.credit_days;
  const rawTerm = bCust.paymentTerm ?? bCust.payment_term;

  const normalizedGstin = rawGstin !== undefined && rawGstin !== null ? String(rawGstin).trim() : "";
  const normalizedLimit = rawLimit !== undefined && rawLimit !== null ? Number(rawLimit) : 0;
  const normalizedDays = rawDays !== undefined && rawDays !== null ? Number(rawDays) : 0;
  const normalizedTerm = rawTerm !== undefined && rawTerm !== null && String(rawTerm).trim() !== ""
    ? String(rawTerm).trim()
    : (rawDays !== undefined && rawDays !== null && Number(rawDays) > 0 ? `Net ${rawDays}` : "Policy Not Configured");

  const resolvedGroupId = grpId || (isCorp ? "CG-Corporate" : (isVIP ? "CG-LargeRetail" : "CG-Retail"));

  return {
    id: bCust.id || `cust-${Date.now()}`,
    code: bCust.code || bCust.id || "CUST-001",
    name: bCust.name || "",
    priceGroup: derivedPriceGroup,
    customerGroupId: resolvedGroupId,
    customer_group_id: resolvedGroupId,
    phone: bCust.mobile || bCust.phone || "",
    email: bCust.email || "",
    religion: bCust.religion || "Hindu",
    ethnicity: bCust.ethnicity || "Asian",
    ageGroup: bCust.age_group || bCust.ageGroup || ">=20 - <35",
    profession: bCust.profession || "",
    customerType: derivedCustomerType,
    profileNotes: bCust.profile_notes || bCust.profileNotes || "",
    companyCode: bCust.company_code || bCust.companyCode || "001",
    environment: derivedEnvironment,
    flatFileFormat: bCust.flat_file_format || bCust.flatFileFormat || "GUI with Delimiter Format",
    storeCode: bCust.store_code ?? bCust.storeCode ?? "",
    billingStoreCode: bCust.billing_store_code ?? bCust.billingStoreCode ?? "",
    shippingStoreCode: bCust.shipping_store_code ?? bCust.shippingStoreCode ?? "",
    isTaxInclusive: bCust.is_tax_inclusive ?? bCust.isTaxInclusive ?? true,
    is_tax_inclusive: bCust.is_tax_inclusive ?? bCust.isTaxInclusive ?? true,
    pricingBasis: (bCust.pricing_basis || bCust.pricingBasis || "MRP") as "MRP" | "RATE",
    pricing_basis: (bCust.pricing_basis || bCust.pricingBasis || "MRP") as "MRP" | "RATE",
    allowPromotionsOnRate: Boolean(bCust.allow_promotions_on_rate ?? bCust.allowPromotionsOnRate ?? false),
    allow_promotions_on_rate: Boolean(bCust.allow_promotions_on_rate ?? bCust.allowPromotionsOnRate ?? false),
    delimiter: bCust.delimiter || ";",
    buyingFactor: Number(bCust.buying_factor ?? 1.00),
    sellingFactor: Number(bCust.selling_factor ?? 1.00),
    mailingAddresses: mergeCanonicalLocationsIntoAddresses(
      bCust.mailing_addresses || bCust.mailingAddresses,
      bCust.delivery_locations || bCust.deliveryLocations || [],
      bCust.billing_locations || bCust.billingLocations || [],
      {
          mobilePhone: bCust.mobile || bCust.phone || "",
          email1: bCust.email || ""
      }
    ),
    isDependant: bCust.is_dependant ?? false,
    showChildCustomersInBilling: bCust.show_child_customers_in_billing ?? bCust.showChildCustomersInBilling ?? false,
    show_child_customers_in_billing: bCust.show_child_customers_in_billing ?? bCust.showChildCustomersInBilling ?? false,
    primaryAccountCode: bCust.primary_account_code || "",
    primaryAccountName: bCust.primary_account_name || "",
    applyParentMailingInfo: bCust.apply_parent_mailing_info ?? false,
    dependants: bCust.dependants || [],
    gender: bCust.gender || "Female",
    dateOfBirth: bCust.date_of_birth || "",
    isMarried: bCust.is_married ?? false,
    weddingAnniversary: bCust.wedding_anniversary || "",
    // loyaltyPgmId/Code: respect backend value; do NOT fall back to hardcoded defaults
    loyaltyPgmId: bCust.loyalty_pgm_id || bCust.loyaltyPgmId || "",
    loyaltyPgmCode: bCust.loyalty_pgm_code || bCust.loyaltyPgmCode || "",
    loyaltyTier: bCust.loyalty_tier || bCust.loyaltyTier || "Standard",
    loyaltyPointsBalance: Number(bCust.loyalty_points_balance || 0),
    paymentCategory: bCust.payment_category || bCust.paymentCategory || "CASH",
    paymentTerm: normalizedTerm,
    creditLimit: normalizedLimit,
    creditDays: normalizedDays,
    creditUsed: Number(bCust.outstanding ?? bCust.credit_used ?? bCust.creditUsed ?? 0),
    transportMode: bCust.transport_mode || "By-Road",
    transportCode: bCust.transport_code || "VRL",
    transitDays: Number(bCust.transit_days || 2),
    bankCode: bCust.bank_code || "",
    bankLocation: bCust.bank_location || "",
    retailFactor: Number(bCust.retail_factor || 1.00),
    dealerFactor: Number(bCust.dealer_factor || 0.85),
    destinationTaxType: bCust.destination_tax_type || "318#GST_RETAIL",
    allowCashBill: bCust.allow_cash_bill ?? true,
    allowDcGen: bCust.allow_dc_gen ?? false,
    allowCreditInvoice: bCust.allow_credit_invoice ?? true,
    allowMiscIssue: bCust.allow_misc_issue ?? false,
    allowMiscReceipts: bCust.allow_misc_receipts ?? true,
    lstNumber: bCust.lst_number || "",
    lstDate: bCust.lst_date || "",
    cstNumber: bCust.cst_number || "",
    cstDate: bCust.cst_date || "",
    gstin: normalizedGstin,
    panNumber: bCust.pan_number || "",
    isPreSaleFormApplicable: bCust.is_pre_sale_form_applicable ?? false,
    preSaleFormName: bCust.pre_sale_form_name || "",
    isPostSaleFormApplicable: bCust.is_post_sale_form_applicable ?? false,
    postSaleFormName: bCust.post_sale_form_name || "",
    status: bCust.status || "Active",
    createdAt: bCust.created_date || bCust.created_at || new Date().toISOString().split("T")[0],
    updatedAt: bCust.updated_at || bCust.modified_at || new Date().toISOString().split("T")[0]
  };
}

export interface SmritiCustomerMasterWorkspaceProps {
  currentUser?: { role: string; name: string } | null;
  onNotification?: (title: string, message: string, type?: "success" | "error" | "info" | "warning") => void;
}

export const CustMasterWs: React.FC<SmritiCustomerMasterWorkspaceProps> = ({
  currentUser,
  onNotification
}) => {
  const [customers, setCustomers] = useState<RetailCustomerRecord[]>([]);

  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<"form" | "retail" | "additional">("form");
  const [activeCorporateTab, setActiveCorporateTab] = useState<"identity" | "network" | "addresses" | "commercial" | "integrations" | "audit">("identity");
  const [corporateWorkspaceMode, setCorporateWorkspaceMode] = useState<"tabbed" | "overview">("overview");
  const [viewMode, setViewMode] = useState<"catalogue" | "directory" | "360">("catalogue");
  const [layoutStyle, setLayoutStyle] = useState<"enterprise" | "classic">("enterprise");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [directoryItems, setDirectoryItems] = useState<CustomerDirectoryItem[]>([]);
  const [directoryTotal, setDirectoryTotal] = useState(0);
  const [directoryPage, setDirectoryPage] = useState(0);
  const [directoryQuery, setDirectoryQuery] = useState("");
  const [directoryStatus, setDirectoryStatus] = useState("all");
  const [isDirectoryLoading, setIsDirectoryLoading] = useState(false);
  const [directoryError, setDirectoryError] = useState("");
  const [directoryRefreshVersion, setDirectoryRefreshVersion] = useState(0);
  const directoryPageSize = 25;

  // Modals
  const [isMailingModalOpen, setIsMailingModalOpen] = useState<boolean>(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState<boolean>(false);
  const [isPriceGroupModalOpen, setIsPriceGroupModalOpen] = useState<boolean>(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState<boolean>(false);
  const [customerGstRegistrations, setCustomerGstRegistrations] = useState<CustomerGSTRegistrationOption[]>([]);
  const [gstRegistrations, setGstRegistrations] = useState<GstRegistrationEntry[]>([]);
  const [isLoadingGstRegistrations, setIsLoadingGstRegistrations] = useState<boolean>(false);

  // Model C: Customer Company Relationships
  const [companyRelationships, setCompanyRelationships] = useState<CustomerCompanyRelationship[]>([]);
  const [isLoadingRelationships, setIsLoadingRelationships] = useState<boolean>(false);
  const [selectedRelId, setSelectedRelId] = useState<string>("");

  // BD-6: Consolidated Customer Credit Exposure
  const [creditExposure, setCreditExposure] = useState<CustomerCreditExposureResponse | null>(null);
  const [isLoadingCreditExposure, setIsLoadingCreditExposure] = useState<boolean>(false);

  // Active customer in editor
  const [currentCustomer, setCurrentCustomer] = useState<RetailCustomerRecord>(() => {
    return customers[0] || createEmptyCustomer(1);
  });

  // Customer Master CRUD Lifecycle States
  const [lifecycleMode, setLifecycleMode] = useState<CustomerLifecycleMode>("view");
  const originalCustomerRef = useRef<RetailCustomerRecord | null>(null);

  // Lifecycle Modals
  const [isCreateCustomerModalOpen, setIsCreateCustomerModalOpen] = useState<boolean>(false);
  const [isDeactivateModalOpen, setIsDeactivateModalOpen] = useState<boolean>(false);
  const [isDeleteConfirmationModalOpen, setIsDeleteConfirmationModalOpen] = useState<boolean>(false);
  const [isMergeModalOpen, setIsMergeModalOpen] = useState<boolean>(false);
  const [isEnterpriseSearchOpen, setIsEnterpriseSearchOpen] = useState<boolean>(false);

  // Corporate account detector
  const isCorporate = useMemo(() => {
    const grp = currentCustomer.customerGroupId || currentCustomer.customer_group_id || "";
    return currentCustomer.customerType === "Corporate" ||
           currentCustomer.environment === "Corporate" ||
           grp === "CG-Corporate" ||
           (currentCustomer.code && currentCustomer.code.startsWith("RRL")) ||
           (currentCustomer.name && currentCustomer.name.toLowerCase().includes("reliance"));
  }, [currentCustomer]);

  // Synchronize corporate GST registrations list from backend data or customer record
  useEffect(() => {
    if (!currentCustomer) return;
    if (customerGstRegistrations.length > 0) {
      setGstRegistrations(customerGstRegistrations.map(r => ({
        id: r.id,
        gstin: r.gstin,
        state: r.stateName || "Maharashtra",
        stateCode: r.stateCode,
        registrationType: r.registrationType || "Regular",
        status: r.isActive ? "Active" : "Inactive",
        isPrimary: r.isPrimary
      })));
    } else if (currentCustomer.gstin && currentCustomer.gstin.trim()) {
      setGstRegistrations([
        {
          id: "gst-primary-1",
          gstin: currentCustomer.gstin.trim(),
          state: "Maharashtra",
          stateCode: "27",
          registrationType: "Regular",
          status: "Active",
          isPrimary: true
        }
      ]);
    } else {
      setGstRegistrations([]);
    }
  }, [currentCustomer.id, currentCustomer.gstin, customerGstRegistrations]);

  const handleSaveGstRegistration = (entry: GstRegistrationEntry) => {
    setGstRegistrations(prev => {
      let updated = [...prev];
      if (entry.isPrimary) {
        updated = updated.map(g => ({ ...g, isPrimary: false }));
      }
      const idx = updated.findIndex(g => g.id === entry.id || g.gstin === entry.gstin);
      if (idx >= 0) {
        updated[idx] = entry;
      } else {
        updated.push(entry);
      }
      return updated;
    });
    if (entry.isPrimary || !currentCustomer.gstin) {
      handleFieldChange("gstin", entry.gstin);
    }
    setIsDirty(true);
    isDirtyRef.current = true;
  };

  const handleDeleteGstRegistration = (regId: string) => {
    setGstRegistrations(prev => prev.filter(g => g.id !== regId && g.gstin !== regId));
    setIsDirty(true);
    isDirtyRef.current = true;
  };

  const handleStoreAssigned = async (store: StoreCodeLookupItem) => {
    await loadDeliveryLocations(currentCustomerRef.current.id);
    onNotification?.("Store Location Saved", `Store ${store.store_name} (${store.store_code}) was saved to this customer.`, "success");
    setIsDirty(true);
    isDirtyRef.current = true;
  };

  // Stable active customer identity model (ID first, code second) — never relies on array index
  const [activeCustomerId, setActiveCustomerId] = useState<string>(() => {
    return customers[0]?.id || "cust-draft-1";
  });

  const [isDirty, setIsDirty] = useState<boolean>(false);

  // Synchronous refs to prevent stale closure race conditions in async backend responses
  const activeCustomerIdRef = useRef<string>(activeCustomerId);
  const currentCustomerRef = useRef<RetailCustomerRecord>(currentCustomer);
  const isDirtyRef = useRef<boolean>(isDirty);

  useEffect(() => {
    activeCustomerIdRef.current = activeCustomerId;
  }, [activeCustomerId]);

  useEffect(() => {
    currentCustomerRef.current = currentCustomer;
  }, [currentCustomer]);

  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  // Authoritative Backend Hydration with Identity-Based Reconciliation
  const loadCustomersFromBackend = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch with explicit limit — the API caps at 100 per request
      const res = await apiFetchV1("/crm/customers?limit=100&skip=0");
      const list = Array.isArray(res) ? res : (res?.items || []);
      {
        const mappedList = list.map(mapBackendCustomerToRecord);
        setCustomers(mappedList);

        // Identity-based reconciliation
        const currentActiveId = activeCustomerIdRef.current;
        const currentCust = currentCustomerRef.current;

        // Unsaved draft protection: Never let an async background refresh overwrite a newly initialized draft
        if (currentActiveId?.startsWith("cust-draft-") || currentCust?.id?.startsWith("cust-draft-")) {
          return;
        }

        // Reconcile by stable ID first, then code — NEVER by array index
        const matchIndex = mappedList.findIndex(
          (c: RetailCustomerRecord) => (currentActiveId && c.id === currentActiveId) ||
               (currentCust?.id && c.id === currentCust.id) ||
               (currentCust?.code && c.code === currentCust.code)
        );

        let targetCust: RetailCustomerRecord | null = null;
        let targetIndex = 0;

        if (matchIndex >= 0) {
          targetIndex = matchIndex;
          targetCust = mappedList[matchIndex];
        } else if (mappedList.length > 0 && !currentActiveId?.startsWith("cust-draft-")) {
          targetIndex = 0;
          targetCust = mappedList[0];
        }

        if (targetCust) {
          setCurrentIndex(targetIndex);
          setActiveCustomerId(targetCust.id);
          activeCustomerIdRef.current = targetCust.id;
          // If the user has pending edits in the active editor, preserve local form changes
          if (!isDirtyRef.current) {
            setCurrentCustomer(JSON.parse(JSON.stringify(targetCust)));
            currentCustomerRef.current = targetCust;
          }
        }
      }
    } catch (err) {
      console.warn("[Customer Master] Backend customer list unavailable; no persistent profile cache was loaded.", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCustomersFromBackend();
    const handleCustomerUpdated = () => {
      loadCustomersFromBackend();
      setDirectoryRefreshVersion(version => version + 1);
    };
    window.addEventListener("smriti_customer_updated", handleCustomerUpdated);
    return () => window.removeEventListener("smriti_customer_updated", handleCustomerUpdated);
  }, [loadCustomersFromBackend]);

  useEffect(() => {
    if (viewMode !== "directory") return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setIsDirectoryLoading(true);
      setDirectoryError("");
      try {
        const params = new URLSearchParams({
          skip: String(directoryPage * directoryPageSize),
          limit: String(directoryPageSize),
          status: directoryStatus
        });
        if (directoryQuery.trim()) params.set("q", directoryQuery.trim());
        const result = await apiFetchV1<CustomerDirectoryResponse>(`/crm/customers/directory?${params.toString()}`);
        if (!cancelled) {
          setDirectoryItems(result.items || []);
          setDirectoryTotal(result.total || 0);
        }
      } catch (err: any) {
        if (!cancelled) {
          setDirectoryItems([]);
          setDirectoryTotal(0);
          setDirectoryError(err?.message || "Could not load the customer directory.");
        }
      } finally {
        if (!cancelled) setIsDirectoryLoading(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [viewMode, directoryPage, directoryPageSize, directoryQuery, directoryStatus, directoryRefreshVersion]);

  const handleOpenDirectoryCustomer = async (item: CustomerDirectoryItem, intent: "view" | "edit" | "360" = "view") => {
    setIsLoading(true);
    try {
      const backendCustomer = await apiFetchV1<any>(`/crm/customers/${encodeURIComponent(item.id)}`);
      const record = mapBackendCustomerToRecord(backendCustomer);
      const updated = [...customers];
      const existingIndex = updated.findIndex(customer => customer.id === record.id);
      const targetIndex = existingIndex >= 0 ? existingIndex : updated.length;
      if (existingIndex >= 0) updated[existingIndex] = record;
      else updated.push(record);
      setCustomers(updated);
      cacheCustomersSession(updated);
      setCurrentIndex(targetIndex);
      setActiveCustomerId(record.id);
      activeCustomerIdRef.current = record.id;
      setCurrentCustomer(JSON.parse(JSON.stringify(record)));
      currentCustomerRef.current = record;
      originalCustomerRef.current = JSON.parse(JSON.stringify(record));
      setIsDirty(intent === "edit");
      isDirtyRef.current = intent === "edit";
      setLifecycleMode(intent === "edit" ? "edit" : "view");
      if (intent === "edit") setActiveTab("form");
      setViewMode(intent === "360" ? "360" : "catalogue");
    } catch (err: any) {
      onNotification?.("Customer Load Failed", err?.message || "Could not open this customer profile.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFieldChange = (field: keyof RetailCustomerRecord, value: any) => {
    if (lifecycleMode === "view") {
      onNotification?.(
        "Read-Only View Mode",
        "Customer account is open in View Mode. Click 'Edit' (Alt+E) to modify fields.",
        "warning"
      );
      return;
    }
    setCurrentCustomer(prev => {
      const updated = {
        ...prev,
        [field]: value
      };
      currentCustomerRef.current = updated;
      return updated;
    });
    setIsDirty(true);
    isDirtyRef.current = true;
  };

  const handleOpenMailingModal = async () => {
    setIsMailingModalOpen(true);
    const customerId = currentCustomer.id;
    if (!customerId || customerId.startsWith("cust-draft-")) {
      setCustomerGstRegistrations([]);
      return;
    }

    setIsLoadingGstRegistrations(true);
    try {
      const response = await apiFetchV1<any>(`/crm/customers/${customerId}/gst-registrations`);
      const registrations = Array.isArray(response) ? response : (response?.items || []);
      setCustomerGstRegistrations(registrations.map((registration: any) => ({
        id: String(registration.id),
        gstin: String(registration.gstin || "").trim().toUpperCase(),
        stateName: registration.stateName ?? registration.state_name ?? "",
        stateCode: String(registration.stateCode ?? registration.state_code ?? "").padStart(2, "0"),
        registrationType: registration.registrationType ?? registration.registration_type ?? "REGULAR",
        isPrimary: Boolean(registration.isPrimary ?? registration.is_primary),
        isActive: registration.isActive ?? registration.is_active ?? registration.status === "ACTIVE"
      })).filter((registration: CustomerGSTRegistrationOption) => registration.isActive && registration.gstin));
    } catch (error) {
      setCustomerGstRegistrations([]);
      onNotification?.("GST Registrations Unavailable", "The address form is still available, but customer GST registrations could not be loaded.", "warning");
    } finally {
      setIsLoadingGstRegistrations(false);
    }
  };

  // Model C: Load and sync Customer Company Commercial Relationships
  const loadCompanyRelationships = useCallback(async (customerId: string) => {
    if (!customerId || customerId.startsWith("cust-draft-")) {
      const defaultCompanyId = currentCustomer.companyCode || "COMP-001";
      const fallbackRel: CustomerCompanyRelationship = {
        id: `rel-${defaultCompanyId}`,
        company_id: defaultCompanyId,
        customer_id: customerId,
        customer_group_id: currentCustomer.customerGroupId || currentCustomer.customer_group_id || "CG-Corporate",
        credit_limit: Number(currentCustomer.creditLimit || 0),
        credit_days: Number(currentCustomer.creditDays || 0),
        credit_hold: false,
        status: "Active",
        is_active: true
      };
      setCompanyRelationships([fallbackRel]);
      setSelectedRelId(fallbackRel.id);
      return;
    }

    setIsLoadingRelationships(true);
    try {
      const res = await apiFetchV1<CustomerCompanyRelationship[]>(`/crm/customers/${customerId}/company-relationships`);
      const list = Array.isArray(res) ? res : [];
      if (list.length > 0) {
        setCompanyRelationships(list);
        setSelectedRelId(list[0].id);
      } else {
        const defaultCompanyId = currentCustomer.companyCode || "COMP-001";
        const fallbackRel: CustomerCompanyRelationship = {
          id: `rel-${defaultCompanyId}`,
          company_id: defaultCompanyId,
          customer_id: customerId,
          customer_group_id: currentCustomer.customerGroupId || currentCustomer.customer_group_id || "CG-Corporate",
          credit_limit: Number(currentCustomer.creditLimit || 0),
          credit_days: Number(currentCustomer.creditDays || 0),
          credit_hold: false,
          status: "Active",
          is_active: true
        };
        setCompanyRelationships([fallbackRel]);
        setSelectedRelId(fallbackRel.id);
      }
    } catch (err) {
      console.warn("[CRM] Company relationships fetch error, fallback to primary:", err);
      const defaultCompanyId = currentCustomer.companyCode || "COMP-001";
      const fallbackRel: CustomerCompanyRelationship = {
        id: `rel-${defaultCompanyId}`,
        company_id: defaultCompanyId,
        customer_id: customerId,
        customer_group_id: currentCustomer.customerGroupId || currentCustomer.customer_group_id || "CG-Corporate",
        credit_limit: Number(currentCustomer.creditLimit || 0),
        credit_days: Number(currentCustomer.creditDays || 0),
        credit_hold: false,
        status: "Active",
        is_active: true
      };
      setCompanyRelationships([fallbackRel]);
      setSelectedRelId(fallbackRel.id);
    } finally {
      setIsLoadingRelationships(false);
    }
  }, [currentCustomer.companyCode, currentCustomer.customerGroupId, currentCustomer.customer_group_id, currentCustomer.creditLimit, currentCustomer.creditDays]);

  // BD-6: Load consolidated customer credit exposure
  const loadCreditExposure = useCallback(async (customerId: string) => {
    if (!customerId || customerId.startsWith("cust-draft-")) {
      setCreditExposure(null);
      return;
    }
    setIsLoadingCreditExposure(true);
    try {
      const data = await apiFetchV1<CustomerCreditExposureResponse>(`/crm/customers/${customerId}/credit-exposure`);
      setCreditExposure(data);
    } catch (err) {
      console.warn("[CRM] Credit exposure fetch warning:", err);
    } finally {
      setIsLoadingCreditExposure(false);
    }
  }, []);

  // Load canonical delivery locations for customer
  const loadDeliveryLocations = useCallback(async (customerId: string) => {
    if (!customerId || customerId.startsWith("cust-draft-")) return;
    try {
      const locations = await apiFetchV1<any[]>(`/crm/customers/${customerId}/delivery-locations`);
      if (Array.isArray(locations) && locations.length > 0) {
        setCurrentCustomer(prev => {
          if (prev.id !== customerId) return prev;
          const merged = mergeCanonicalLocationsIntoAddresses(
            prev.mailingAddresses,
            locations,
            [],
            { mobilePhone: prev.phone, email1: prev.email }
          );
          return {
            ...prev,
            mailingAddresses: merged
          };
        });
      }
    } catch (err) {
      console.warn("[CRM] Delivery locations fetch warning:", err);
    }
  }, []);

  // Load canonical billing locations for customer
  const loadBillingLocations = useCallback(async (customerId: string) => {
    if (!customerId || customerId.startsWith("cust-draft-")) return;
    try {
      const locations = await apiFetchV1<any[]>(`/crm/customers/${customerId}/billing-locations`);
      if (Array.isArray(locations) && locations.length > 0) {
        setCurrentCustomer(prev => {
          if (prev.id !== customerId) return prev;
          const merged = mergeCanonicalLocationsIntoAddresses(
            prev.mailingAddresses,
            [],
            locations,
            { mobilePhone: prev.phone, email1: prev.email }
          );
          return {
            ...prev,
            mailingAddresses: merged
          };
        });
      }
    } catch (err) {
      console.warn("[CRM] Billing locations fetch warning:", err);
    }
  }, []);

  // Load canonical dependants / child customers
  const loadCustomerDependants = useCallback(async (customerId: string) => {
    if (!customerId || customerId.startsWith("cust-draft-")) return;
    try {
      const deps = await apiFetchV1<any[]>(`/crm/customers/${customerId}/dependants`);
      if (Array.isArray(deps)) {
        setCurrentCustomer(prev => {
          if (prev.id !== customerId) return prev;
          return { ...prev, dependants: deps };
        });
      }
    } catch (err) {
      console.warn("[CRM] Customer dependants fetch warning:", err);
    }
  }, []);

  // Load canonical GST registrations for customer
  const loadCustomerGstRegistrations = useCallback(async (customerId: string) => {
    if (!customerId || customerId.startsWith("cust-draft-")) return;
    try {
      setIsLoadingGstRegistrations(true);
      const regs = await apiFetchV1<any[]>(`/crm/customers/${customerId}/gst-registrations`);
      if (Array.isArray(regs)) {
        setCustomerGstRegistrations(regs);
        if (regs.length > 0) {
          setGstRegistrations(regs.map(r => ({
            id: r.id,
            gstin: r.gstin,
            state: r.stateName || r.state_name || "Maharashtra",
            stateCode: r.stateCode || r.state_code || "",
            registrationType: r.registrationType || r.registration_type || "Regular",
            status: (r.isActive ?? r.is_active) ? "Active" : "Inactive",
            isPrimary: Boolean(r.isPrimary ?? r.is_primary)
          })));
        }
      }
    } catch (err) {
      console.warn("[CRM] Customer GST registrations fetch warning:", err);
    } finally {
      setIsLoadingGstRegistrations(false);
    }
  }, []);

  useEffect(() => {
    if (currentCustomer?.id) {
      loadCompanyRelationships(currentCustomer.id);
      loadCreditExposure(currentCustomer.id);
      loadDeliveryLocations(currentCustomer.id);
      loadBillingLocations(currentCustomer.id);
      loadCustomerDependants(currentCustomer.id);
      loadCustomerGstRegistrations(currentCustomer.id);
    }
  }, [
    currentCustomer?.id,
    loadCompanyRelationships,
    loadCreditExposure,
    loadDeliveryLocations,
    loadBillingLocations,
    loadCustomerDependants,
    loadCustomerGstRegistrations
  ]);

  const handleUpdateCompanyRelationship = async (relId: string, updates: Partial<CustomerCompanyRelationship>) => {
    setCompanyRelationships(prev =>
      prev.map(r => (r.id === relId ? { ...r, ...updates } : r))
    );

    // Sync to active customer state
    if (updates.credit_limit !== undefined || updates.creditLimit !== undefined) {
      const newLimit = Number(updates.credit_limit ?? updates.creditLimit ?? 0);
      handleFieldChange("creditLimit", newLimit);
    }
    if (updates.credit_days !== undefined || updates.creditDays !== undefined) {
      const newDays = Number(updates.credit_days ?? updates.creditDays ?? 0);
      handleFieldChange("creditDays", newDays);
    }
    if (updates.customer_group_id !== undefined || updates.customerGroupId !== undefined) {
      const newGrp = String(updates.customer_group_id ?? updates.customerGroupId);
      handleFieldChange("customerGroupId", newGrp);
      handleFieldChange("customer_group_id", newGrp);
    }

    // Persist to backend if real ID
    if (currentCustomer.id && !currentCustomer.id.startsWith("cust-draft-") && !relId.startsWith("rel-COMP-")) {
      try {
        const payload: any = {};
        if (updates.credit_limit !== undefined || updates.creditLimit !== undefined) {
          payload.credit_limit = Number(updates.credit_limit ?? updates.creditLimit);
        }
        if (updates.credit_days !== undefined || updates.creditDays !== undefined) {
          payload.credit_days = Number(updates.credit_days ?? updates.creditDays);
        }
        if (updates.credit_hold !== undefined || updates.creditHold !== undefined) {
          payload.credit_hold = Boolean(updates.credit_hold ?? updates.creditHold);
        }
        if (updates.customer_group_id !== undefined || updates.customerGroupId !== undefined) {
          payload.customer_group_id = updates.customer_group_id ?? updates.customerGroupId;
        }
        if (updates.status !== undefined) {
          payload.status = updates.status;
        }

        await apiFetchV1(`/crm/customers/${currentCustomer.id}/company-relationships/${relId}`, {
          method: "PUT",
          body: JSON.stringify(payload)
        });
        loadCreditExposure(currentCustomer.id);
        onNotification?.("Commercial Policy Updated", "Operating entity terms saved to database.", "success");
      } catch (err: any) {
        onNotification?.("Update Warning", err.message || "Failed to update relationship in database.", "warning");
      }
    }
  };

  const handleAddCompanyRelationship = async (newRel: Partial<CustomerCompanyRelationship>) => {
    const compId = (newRel.company_id || newRel.companyId || "").trim();
    if (!compId) return;

    if (currentCustomer.id && !currentCustomer.id.startsWith("cust-draft-")) {
      try {
        const payload = {
          company_id: compId,
          customer_id: currentCustomer.id,
          customer_group_id: newRel.customer_group_id || newRel.customerGroupId || undefined,
          credit_limit: Number(newRel.credit_limit ?? newRel.creditLimit ?? 0),
          credit_days: Number(newRel.credit_days ?? newRel.creditDays ?? 0),
          credit_hold: Boolean(newRel.credit_hold ?? newRel.creditHold ?? false),
          status: newRel.status || "Active"
        };
        const created = await apiFetchV1<CustomerCompanyRelationship>(
          `/crm/customers/${currentCustomer.id}/company-relationships`,
          {
            method: "POST",
            body: JSON.stringify(payload)
          }
        );
        setCompanyRelationships(prev => [...prev, created]);
        setSelectedRelId(created.id);
        loadCreditExposure(currentCustomer.id);
        onNotification?.("Entity Added", `Commercial relationship created for ${compId}.`, "success");
      } catch (err: any) {
        onNotification?.("Creation Failed", err.message || "Failed to create commercial relationship.", "error");
      }
    } else {
      const localRel: CustomerCompanyRelationship = {
        id: `rel-${compId}-${Date.now()}`,
        customer_id: currentCustomer.id,
        company_id: compId,
        customer_group_id: newRel.customer_group_id || newRel.customerGroupId || "CG-Corporate",
        credit_limit: Number(newRel.credit_limit ?? newRel.creditLimit ?? 0),
        credit_days: Number(newRel.credit_days ?? newRel.creditDays ?? 0),
        credit_hold: Boolean(newRel.credit_hold ?? newRel.creditHold ?? false),
        status: newRel.status || "Active",
        is_active: true
      };
      setCompanyRelationships(prev => [...prev, localRel]);
      setSelectedRelId(localRel.id);
      onNotification?.("Entity Added", `Commercial relationship for ${compId} added locally.`, "info");
    }
  };

  const handleSave = async () => {
    if (!currentCustomer.name.trim()) {
      onNotification?.("Validation Error", "Customer Name is mandatory.", "error");
      return;
    }

    setIsSaving(true);
    try {
      const primaryMobile = currentCustomer.phone?.trim() || currentCustomer.mailingAddresses?.[0]?.mobilePhone?.trim();
      const cleanMobile = primaryMobile ? primaryMobile.replace(/\s+/g, "").replace(/-/g, "") : undefined;
      const cleanEmail = currentCustomer.email?.trim() || currentCustomer.mailingAddresses?.[0]?.email1?.trim() || undefined;
      const cleanGstin = currentCustomer.gstin?.trim() || undefined;
      const cleanName = currentCustomer.name.trim();
      const cleanCode = currentCustomer.code?.trim() || undefined;

      const existingInList = customers.find(c =>
        (c.id === currentCustomer.id && !c.id.startsWith("cust-draft-") && !c.id.startsWith("cust-1")) ||
        (c.code && currentCustomer.code && c.code.trim().toUpperCase() === currentCustomer.code.trim().toUpperCase() && !c.id.startsWith("cust-draft-"))
      );
      const targetBackendId = existingInList ? existingInList.id : currentCustomer.id;
      const isExistingInBackend = Boolean(existingInList) && !targetBackendId.startsWith("cust-draft-") && !targetBackendId.startsWith("cust-1");

      const resolvedCustomerGroupId = currentCustomer.customerGroupId || currentCustomer.customer_group_id || (
        currentCustomer.customerType === "Corporate" || currentCustomer.customerType === "Wholesale" ? "CG-Corporate" : (currentCustomer.customerType === "VIP" ? "CG-LargeRetail" : "CG-Retail")
      );

      const backendPayload: any = {
        name: cleanName,
        code: cleanCode,
        mobile: cleanMobile,
        email: cleanEmail,
        gst_number: cleanGstin,
        customer_group_id: resolvedCustomerGroupId,
        pricing_basis: currentCustomer.pricingBasis || currentCustomer.pricing_basis || "MRP",
        allow_promotions_on_rate: Boolean(currentCustomer.allowPromotionsOnRate ?? currentCustomer.allow_promotions_on_rate),
        is_tax_inclusive: Boolean(currentCustomer.isTaxInclusive ?? currentCustomer.is_tax_inclusive),
        show_child_customers_in_billing: Boolean(currentCustomer.showChildCustomersInBilling ?? currentCustomer.show_child_customers_in_billing),
        outstanding: Number(currentCustomer.creditUsed || 0),
        status: currentCustomer.status || "Active",
        tags: [currentCustomer.customerType || "Retail", "B2B"].filter(Boolean),
        expected_modified_at: currentCustomer.updatedAt || undefined
      };

      let savedBackendCust: any = null;
      if (isExistingInBackend) {
        savedBackendCust = await apiFetchV1(`/crm/customers/${targetBackendId}`, {
          method: "PUT",
          body: JSON.stringify(backendPayload)
        });
      } else {
        savedBackendCust = await apiFetchV1("/crm/customers", {
          method: "POST",
          body: JSON.stringify(backendPayload)
        });
      }

      const rawSavedGstin = savedBackendCust?.gstNumber ?? savedBackendCust?.gst_number ?? savedBackendCust?.gstin ?? currentCustomer.gstin;
      const rawSavedLimit = savedBackendCust?.creditLimit ?? savedBackendCust?.credit_limit ?? currentCustomer.creditLimit;
      const rawSavedDays = savedBackendCust?.creditDays ?? savedBackendCust?.credit_days ?? currentCustomer.creditDays;
      const rawSavedTerm = savedBackendCust?.paymentTerm ?? savedBackendCust?.payment_term ?? currentCustomer.paymentTerm;
      const rawSavedGroupId = savedBackendCust?.customerGroupId ?? savedBackendCust?.customer_group_id ?? resolvedCustomerGroupId;
      const rawSavedBasis = savedBackendCust?.pricingBasis ?? savedBackendCust?.pricing_basis ?? currentCustomer.pricingBasis ?? "MRP";
      const rawSavedAllowPromo = savedBackendCust?.allowPromotionsOnRate ?? savedBackendCust?.allow_promotions_on_rate ?? currentCustomer.allowPromotionsOnRate ?? false;
      const rawSavedTaxInc = savedBackendCust?.isTaxInclusive ?? savedBackendCust?.is_tax_inclusive ?? currentCustomer.isTaxInclusive ?? true;

      const recordToSave: RetailCustomerRecord = {
        ...currentCustomer,
        id: savedBackendCust?.id || currentCustomer.id,
        code: savedBackendCust?.code || currentCustomer.code,
        name: savedBackendCust?.name || currentCustomer.name,
        phone: savedBackendCust?.mobile || currentCustomer.phone,
        gstin: rawSavedGstin !== undefined && rawSavedGstin !== null ? String(rawSavedGstin).trim() : "",
        customerGroupId: rawSavedGroupId,
        customer_group_id: rawSavedGroupId,
        pricingBasis: rawSavedBasis,
        pricing_basis: rawSavedBasis,
        allowPromotionsOnRate: rawSavedAllowPromo,
        allow_promotions_on_rate: rawSavedAllowPromo,
        isTaxInclusive: rawSavedTaxInc,
        is_tax_inclusive: rawSavedTaxInc,
        showChildCustomersInBilling: savedBackendCust?.show_child_customers_in_billing ?? savedBackendCust?.showChildCustomersInBilling ?? currentCustomer.showChildCustomersInBilling ?? false,
        show_child_customers_in_billing: savedBackendCust?.show_child_customers_in_billing ?? savedBackendCust?.showChildCustomersInBilling ?? currentCustomer.show_child_customers_in_billing ?? false,
        creditLimit: rawSavedLimit !== undefined && rawSavedLimit !== null ? Number(rawSavedLimit) : 0,
        creditDays: rawSavedDays !== undefined && rawSavedDays !== null ? Number(rawSavedDays) : 0,
        paymentTerm: rawSavedTerm !== undefined && rawSavedTerm !== null && String(rawSavedTerm).trim() !== ""
          ? String(rawSavedTerm).trim()
          : (rawSavedDays && Number(rawSavedDays) > 0 ? `Net ${rawSavedDays}` : "Policy Not Configured"),
        updatedAt: new Date().toISOString().split("T")[0]
      };

      try {
        recordToSave.mailingAddresses = await syncCanonicalCustomerLocations(
          savedBackendCust?.id || currentCustomer.id,
          currentCustomer.mailingAddresses
        );
      } catch (locErr) {
        console.warn("[Customer Master Location Sync Warning]:", locErr);
      }

      const savedId = recordToSave.id;
      const savedCode = recordToSave.code;

      const updated = [...customers];
      const existingIndex = updated.findIndex(c => c.id === currentCustomer.id || c.code === currentCustomer.code || c.id === savedId || c.code === savedCode);

      let savedIndex: number;
      if (existingIndex >= 0) {
        updated[existingIndex] = recordToSave;
        savedIndex = existingIndex;
      } else {
        updated.push(recordToSave);
        savedIndex = updated.length - 1;
      }

      setActiveCustomerId(savedId);
      activeCustomerIdRef.current = savedId;
      setCurrentIndex(savedIndex);
      setCustomers(updated);
      setCurrentCustomer(recordToSave);
      currentCustomerRef.current = recordToSave;
      originalCustomerRef.current = JSON.parse(JSON.stringify(recordToSave));
      setIsDirty(false);
      isDirtyRef.current = false;
      setLifecycleMode("view");

      cacheCustomersSession(updated);

      window.dispatchEvent(new CustomEvent("smriti_customer_updated"));
      onNotification?.(
        "Catalogue Saved",
        `Customer account ${recordToSave.name} (${recordToSave.code}) saved successfully.`,
        "success"
      );
    } catch (err: any) {
      console.error("[Customer Master Save Error]:", err);
      const rawErrMsg = String(err?.detail?.message || err?.message || err || "");
      let errorTitle = "Save Failed";
      let errorExplanation = "Failed to persist customer details to backend database.";
      let suggestedAction = "Please verify your entries and try again.";

      if (rawErrMsg.includes("CONCURRENT_MODIFICATION_DETECTED") || rawErrMsg.includes("modified by another session")) {
        errorTitle = "Concurrent Modification Detected";
        errorExplanation = "This customer account was updated in another session. Please review changes before re-saving.";
        suggestedAction = "Your current form edits have been preserved so your work is not lost.";
      } else if (rawErrMsg.includes("DUPLICATE_CUSTOMER") || rawErrMsg.includes("already recorded") || rawErrMsg.includes("already registered")) {
        errorTitle = "Duplicate Customer Account";
        const reasonMatch = rawErrMsg.match(/['"]reason['"]:\s*['"]([^'"]+)['"]/);
        errorExplanation = reasonMatch ? reasonMatch[1] : "A customer profile with this mobile number, GSTIN, or customer code is already registered in the system.";
        suggestedAction = "Please search and open the existing customer profile to update details, or provide distinct credentials.";
      } else if (rawErrMsg.toLowerCase().includes("mobile number already exists")) {
        errorTitle = "Mobile Number In Use";
        errorExplanation = "A customer with this mobile number is already registered in the system.";
        suggestedAction = "Please provide a distinct mobile number or update the existing customer profile.";
      } else if (rawErrMsg) {
        errorExplanation = rawErrMsg;
      }

      onNotification?.(
        errorTitle,
        `${errorExplanation} ${suggestedAction}`,
        "error"
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = () => {
    setViewMode("catalogue");
    originalCustomerRef.current = JSON.parse(JSON.stringify(currentCustomer));
    setLifecycleMode("edit");
    onNotification?.(
      "Edit Mode Enabled",
      `Editing customer account "${currentCustomer.name || currentCustomer.code}". Make modifications and press Ctrl+S to save, or Esc to cancel.`,
      "info"
    );
    setTimeout(() => {
      const nameEl = document.querySelector('input[data-field-key="customer_name"]') as HTMLInputElement;
      if (nameEl) {
        nameEl.focus();
        nameEl.select();
      }
    }, 150);
  };

  const handleCancelEdit = () => {
    if (isDirty) {
      const confirmDiscard = window.confirm("You have unsaved changes. Discard all modifications and return to view mode?");
      if (!confirmDiscard) return;
    }
    if (originalCustomerRef.current) {
      setCurrentCustomer(JSON.parse(JSON.stringify(originalCustomerRef.current)));
      currentCustomerRef.current = originalCustomerRef.current;
    }
    setIsDirty(false);
    isDirtyRef.current = false;
    setLifecycleMode("view");
    onNotification?.("Modifications Discarded", "Customer record returned to view mode.", "info");
  };

  const handleNew = () => {
    setIsCreateCustomerModalOpen(true);
  };

  const handleCustomerCreated = (newRecord: RetailCustomerRecord) => {
    const updated = [newRecord, ...customers];
    setCustomers(updated);
    setCurrentIndex(0);
    setActiveCustomerId(newRecord.id);
    activeCustomerIdRef.current = newRecord.id;
    setCurrentCustomer(newRecord);
    currentCustomerRef.current = newRecord;
    originalCustomerRef.current = JSON.parse(JSON.stringify(newRecord));
    setIsDirty(false);
    isDirtyRef.current = false;
    setLifecycleMode("view");
    setViewMode("catalogue");

    cacheCustomersSession(updated);

    window.dispatchEvent(new CustomEvent("smriti_customer_updated"));
  };

  const handleOpenDeactivate = () => {
    setIsDeactivateModalOpen(true);
  };

  const handleDuplicate = () => {
    const newCode = `${currentCustomer.code || "CUST"}-COPY`;
    const duplicated: RetailCustomerRecord = {
      ...JSON.parse(JSON.stringify(currentCustomer)),
      id: `cust-draft-${Date.now()}`,
      code: newCode,
      name: `${currentCustomer.name || "Customer"} (Copy)`,
      shortName: `${currentCustomer.shortName || currentCustomer.name || "Customer"} (Copy)`,
      status: "Active",
      createdAt: new Date().toISOString().split("T")[0],
      updatedAt: new Date().toISOString().split("T")[0]
    };
    setCurrentCustomer(duplicated);
    currentCustomerRef.current = duplicated;
    setIsDirty(true);
    isDirtyRef.current = true;
    setLifecycleMode("edit");
    onNotification?.(
      "Customer Record Duplicated",
      `Created duplicate draft with code ${newCode}. Press Save to persist to database.`,
      "info"
    );
  };

  const handleSaveAndNew = async () => {
    await handleSave();
    handleNew();
  };

  const handleCustomerDeactivated = (updatedRecord: RetailCustomerRecord) => {
    setCurrentCustomer(updatedRecord);
    currentCustomerRef.current = updatedRecord;
    const updated = [...customers];
    const idx = updated.findIndex(c => c.id === updatedRecord.id);
    if (idx >= 0) {
      updated[idx] = updatedRecord;
      setCustomers(updated);
      cacheCustomersSession(updated);
    }
    window.dispatchEvent(new CustomEvent("smriti_customer_updated"));
  };

  const handleReactivate = async () => {
    try {
      if (!currentCustomer.id.startsWith("cust-draft-")) {
        await apiFetchV1(`/crm/customers/${currentCustomer.id}/reactivate`, {
          method: "POST"
        });
      }
      const updatedRecord: RetailCustomerRecord = {
        ...currentCustomer,
        status: "Active",
        updatedAt: new Date().toISOString().split("T")[0]
      };
      setCurrentCustomer(updatedRecord);
      currentCustomerRef.current = updatedRecord;
      const updated = [...customers];
      const idx = updated.findIndex(c => c.id === updatedRecord.id);
      if (idx >= 0) {
        updated[idx] = updatedRecord;
        setCustomers(updated);
        cacheCustomersSession(updated);
      }
      window.dispatchEvent(new CustomEvent("smriti_customer_updated"));
      onNotification?.(
        "Account Reactivated",
        `Customer "${currentCustomer.name}" (${currentCustomer.code}) is now Active. Full transaction privileges restored.`,
        "success"
      );
    } catch (err: any) {
      console.error("[Customer Master] Reactivation error:", err);
      const msg = err?.detail?.message || err?.message || "Failed to reactivate customer account.";
      onNotification?.("Reactivation Failed", String(msg), "error");
    }
  };

  const handleOpenDelete = () => {
    setIsDeleteConfirmationModalOpen(true);
  };

  const handleCustomerDeleted = (deletedId: string) => {
    const filtered = customers.filter(c => c.id !== deletedId);
    setCustomers(filtered);
    cacheCustomersSession(filtered);
    window.dispatchEvent(new CustomEvent("smriti_customer_updated"));
    const nextIdx = Math.max(0, Math.min(currentIndex, filtered.length - 1));
    setCurrentIndex(nextIdx);
    if (filtered[nextIdx]) {
      setActiveCustomerId(filtered[nextIdx].id);
      activeCustomerIdRef.current = filtered[nextIdx].id;
      setCurrentCustomer(JSON.parse(JSON.stringify(filtered[nextIdx])));
      currentCustomerRef.current = filtered[nextIdx];
      originalCustomerRef.current = JSON.parse(JSON.stringify(filtered[nextIdx]));
      setIsDirty(false);
      isDirtyRef.current = false;
      setLifecycleMode("view");
    } else {
      const draft = createEmptyCustomer(1);
      setCurrentCustomer(draft);
      currentCustomerRef.current = draft;
      setIsDirty(false);
      isDirtyRef.current = false;
      setLifecycleMode("view");
    }
  };

  const handleCustomerMerged = (result: CustomerMergeResult) => {
    const sourceId = result.sourceCustomerId || result.source_customer_id || "";
    const targetId = result.targetCustomerId || result.target_customer_id || "";
    const consolidatedOutstanding = result.consolidated_outstanding ?? 0;
    const mergedTimestamp = result.mergedAt || result.merged_at || new Date().toISOString();
    const sourceCode = result.source_code || "Source";
    const targetName = result.target_name || currentCustomer.name;
    const reassignedCount = result.reassigned_records_count ?? 
      (result.reassignedRecords ? Object.values(result.reassignedRecords).reduce((a, b) => a + b, 0) : 
       result.reassigned_records ? Object.values(result.reassigned_records).reduce((a, b) => a + b, 0) : 0);

    // 1. Remove retired source customer from local customers array
    const filtered = customers.filter(c => c.id !== sourceId);
    
    // 2. Update target customer outstanding and timestamp if current is target
    const updated = filtered.map(c => {
      if (c.id === targetId) {
        return {
          ...c,
          credit_balance: consolidatedOutstanding,
          creditBalance: consolidatedOutstanding,
          closingBalance: consolidatedOutstanding,
          outstanding: consolidatedOutstanding,
          updated_at: mergedTimestamp,
          updatedAt: mergedTimestamp
        };
      }
      return c;
    });

    setCustomers(updated);
    cacheCustomersSession(updated);
    window.dispatchEvent(new CustomEvent("smriti_customer_updated"));

    // Update current customer if currently loaded
    if (currentCustomer.id === targetId) {
      setCurrentCustomer(prev => ({
        ...prev,
        credit_balance: consolidatedOutstanding,
        creditBalance: consolidatedOutstanding,
        closingBalance: consolidatedOutstanding,
        outstanding: consolidatedOutstanding,
        updated_at: mergedTimestamp,
        updatedAt: mergedTimestamp
      }));
    }

    onNotification?.(
      "Customer Accounts Consolidated",
      `Source customer (${sourceCode}) was merged into ${targetName}. Reassigned ${reassignedCount} records. Outstanding balance consolidated to ₹${consolidatedOutstanding.toLocaleString("en-IN", { minimumFractionDigits: 2 })}.`,
      "success"
    );
  };

  const handleEnterpriseCustomerSelected = (selected: RetailCustomerRecord) => {
    // Check if customer already exists in local list
    const existingIdx = customers.findIndex(c => c.id === selected.id || c.code === selected.code);
    if (existingIdx >= 0) {
      setCurrentIndex(existingIdx);
      setActiveCustomerId(selected.id);
      activeCustomerIdRef.current = selected.id;
      setCurrentCustomer(JSON.parse(JSON.stringify(customers[existingIdx])));
      currentCustomerRef.current = customers[existingIdx];
      originalCustomerRef.current = JSON.parse(JSON.stringify(customers[existingIdx]));
    } else {
      // Append newly linked enterprise customer to active list
      const updated = [...customers, selected];
      setCustomers(updated);
      cacheCustomersSession(updated);
      const newIdx = updated.length - 1;
      setCurrentIndex(newIdx);
      setActiveCustomerId(selected.id);
      activeCustomerIdRef.current = selected.id;
      setCurrentCustomer(JSON.parse(JSON.stringify(selected)));
      currentCustomerRef.current = selected;
      originalCustomerRef.current = JSON.parse(JSON.stringify(selected));
      window.dispatchEvent(new CustomEvent("smriti_customer_updated"));
    }
    setIsDirty(false);
    isDirtyRef.current = false;
    setLifecycleMode("view");
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      if (isDirty) {
        const confirmDiscard = window.confirm("You have unsaved changes. Discard changes to navigate?");
        if (!confirmDiscard) return;
      }
      const newIdx = currentIndex - 1;
      const target = customers[newIdx];
      if (target) {
        setCurrentIndex(newIdx);
        setActiveCustomerId(target.id);
        activeCustomerIdRef.current = target.id;
        setCurrentCustomer(JSON.parse(JSON.stringify(target)));
        currentCustomerRef.current = target;
        originalCustomerRef.current = JSON.parse(JSON.stringify(target));
        setIsDirty(false);
        isDirtyRef.current = false;
        setLifecycleMode("view");
      }
    }
  };

  const handleNext = () => {
    if (currentIndex < customers.length - 1) {
      if (isDirty) {
        const confirmDiscard = window.confirm("You have unsaved changes. Discard changes to navigate?");
        if (!confirmDiscard) return;
      }
      const newIdx = currentIndex + 1;
      const target = customers[newIdx];
      if (target) {
        setCurrentIndex(newIdx);
        setActiveCustomerId(target.id);
        activeCustomerIdRef.current = target.id;
        setCurrentCustomer(JSON.parse(JSON.stringify(target)));
        currentCustomerRef.current = target;
        originalCustomerRef.current = JSON.parse(JSON.stringify(target));
        setIsDirty(false);
        isDirtyRef.current = false;
        setLifecycleMode("view");
      }
    }
  };

  const customerExportColumns = useMemo<ExportColumnDefinition[]>(() => [
    { key: "code", label: "Customer Code", datatype: "text", width: 12 },
    { key: "name", label: "Customer Name", datatype: "text", width: 25 },
    { key: "mobile", label: "Mobile No.", datatype: "text", width: 15 },
    { key: "email", label: "Email Address", datatype: "text", width: 22 },
    { key: "customerCategory", label: "Category", datatype: "text", width: 15 },
    { key: "creditLimit", label: "Credit Limit", datatype: "currency", isSummary: true, width: 14 },
    { key: "currentBalance", label: "Current Balance", datatype: "currency", isSummary: true, width: 14 },
    { key: "loyaltyPoints", label: "Loyalty Points", datatype: "number", isSummary: true, width: 12 },
    { key: "city", label: "City", datatype: "text", width: 15 },
    { key: "state", label: "State", datatype: "text", width: 15 },
    { key: "gstin", label: "GSTIN", datatype: "text", width: 18 },
    { key: "status", label: "Status", datatype: "text", width: 10 },
  ], []);

  const directoryExportColumns = useMemo<ExportColumnDefinition[]>(() => [
    { key: "code", label: "Customer Code", datatype: "text", width: 18 },
    { key: "name", label: "Customer Name", datatype: "text", width: 32 },
    { key: "mobile", label: "Phone", datatype: "text", width: 16 },
    { key: "customer_group_name", label: "Customer Group", datatype: "text", width: 24 },
    { key: "status", label: "Status", datatype: "text", width: 12 },
  ], []);

  // ─── F2 Universal Lookup Architecture v2 — Screen Registration (Phase C Batch 1) ──
  // F2 pressed anywhere on this screen → entity=customer (Tier 3 screen default).
  // SmritiAdvancedCustomerSearchModal continues to be opened by Alt+S and UI buttons —
  // it is a domain-specific modal and is NOT replaced by Universal Lookup.
  // Adapter resolves by canonical id/code identity (same as SmritiAdvancedCustomerSearchModal
  // onSelectCustomer handler at JSX line ~757) — never by positional array index.
  const dispatcher = useF2Dispatcher();

  const custF2Adapter = useCallback((result: LookupResult) => {
    if (result.entity !== "customer") {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[CustMasterWs][F2] FieldAdapter: unhandled entity:", result.entity);
      }
      return;
    }
    // Canonical identity resolution: match on id first, then code.
    // result.id is the Postgres UUID; result.record.code is the human-readable customer code.
    const lookupId   = result.id || (result.record?.id as string) || "";
    const lookupCode = (result.record?.code as string) || result.returnValue || "";
    const idx = customers.findIndex(
      c => (lookupId && c.id === lookupId) || (lookupCode && c.code === lookupCode)
    );
    if (idx >= 0) {
      const target = customers[idx];
      setCurrentIndex(idx);
      setActiveCustomerId(target.id);
      activeCustomerIdRef.current = target.id;
      setCurrentCustomer(JSON.parse(JSON.stringify(target)));
      currentCustomerRef.current = target;
      originalCustomerRef.current = JSON.parse(JSON.stringify(target));
      setIsDirty(false);
      isDirtyRef.current = false;
      setLifecycleMode("view");
      onNotification?.(
        "Customer Loaded",
        `Loaded catalogue record for ${target.name} (${target.code}).`,
        "info"
      );
    }
  }, [customers, onNotification]);

  useF2Screen({
    screenId: "CustMasterWs",
    defaultEntity: "customer",
    adapter: custF2Adapter,
  });

  // Keyboard Shortcuts Listener — F2 removed: now handled exclusively by F2DispatcherProvider.
  // F2 is a platform protocol; this screen registers via useF2Screen() above.
  // Alt+S continues to open SmritiAdvancedCustomerSearchModal (domain-specific, not Universal Lookup).
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        if (e.key === "Escape") {
          (e.target as HTMLElement).blur();
          if (lifecycleMode === "edit") {
            handleCancelEdit();
          }
          return;
        }
      }

      if (e.key === "Escape" && lifecycleMode === "edit") {
        e.preventDefault();
        handleCancelEdit();
        return;
      }

      if (e.ctrlKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSave();
      } else if (e.altKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        setIsSearchModalOpen(true);
      } else if (e.altKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        handleNew();
      } else if (e.altKey && e.key.toLowerCase() === "e") {
        e.preventDefault();
        handleEdit();
      } else if (e.altKey && e.key.toLowerCase() === "d") {
        e.preventDefault();
        handleOpenDelete();
      } else if (isCorporate) {
        if (e.altKey && e.key === "1") {
          e.preventDefault();
          setActiveCorporateTab("identity");
          setCorporateWorkspaceMode("tabbed");
        } else if (e.altKey && e.key === "2") {
          e.preventDefault();
          setActiveCorporateTab("network");
          setCorporateWorkspaceMode("tabbed");
        } else if (e.altKey && e.key === "3") {
          e.preventDefault();
          setActiveCorporateTab("addresses");
          setCorporateWorkspaceMode("tabbed");
        } else if (e.altKey && e.key === "4") {
          e.preventDefault();
          setActiveCorporateTab("commercial");
          setCorporateWorkspaceMode("tabbed");
        } else if (e.altKey && e.key === "5") {
          e.preventDefault();
          setActiveCorporateTab("integrations");
          setCorporateWorkspaceMode("tabbed");
        } else if (e.altKey && e.key === "6") {
          e.preventDefault();
          setActiveCorporateTab("audit");
          setCorporateWorkspaceMode("tabbed");
        }
      } else if (e.altKey && e.key === "1") {
        e.preventDefault();
        setActiveTab("form");
      } else if (e.altKey && e.key === "2") {
        e.preventDefault();
        setActiveTab("retail");
      } else if (e.altKey && e.key === "3") {
        e.preventDefault();
        setActiveTab("additional");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentCustomer, customers, currentIndex]);

  const handleSelectCustomerByIdOrCode = (identifier: string) => {
    const clean = identifier.trim();
    const idx = customers.findIndex(
      (c) => c.id === clean || (c.code && c.code.toUpperCase() === clean.toUpperCase())
    );
    if (idx !== -1) {
      const found = customers[idx];
      setCurrentIndex(idx);
      setActiveCustomerId(found.id);
      activeCustomerIdRef.current = found.id;
      setCurrentCustomer(JSON.parse(JSON.stringify(found)));
      currentCustomerRef.current = found;
      setIsDirty(false);
      isDirtyRef.current = false;
      setViewMode("catalogue");
      onNotification?.("Account Loaded", `Loaded customer account ${found.code} - ${found.name}.`, "info");
    } else {
      apiFetchV1<any>(`/crm/customers/${encodeURIComponent(clean)}`)
        .then((bCust) => {
          if (bCust) {
            const mapped = mapBackendCustomerToRecord(bCust);
            setCurrentCustomer(mapped);
            setViewMode("catalogue");
            onNotification?.("Account Loaded", `Loaded customer record ${mapped.code} - ${mapped.name}.`, "info");
          }
        })
        .catch(() => {
          onNotification?.("Customer Lookup", `Customer account '${clean}' is not yet loaded in active cache.`, "info");
        });
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#f7f9fb] dark:bg-[#191c1e] text-[#191c1e] dark:text-[#eff1f3] overflow-hidden">
      {viewMode === "360" ? (
        <div className="flex-1 overflow-y-auto">
          <React.Suspense fallback={<div role="status" className="p-4 text-sm text-slate-500">Loading customer profile…</div>}>
            <LazyCorporateCustomer360
              customerId={currentCustomer?.id || ""}
              customer={currentCustomer}
              currentUser={currentUser}
              onChange={(field, value) => handleFieldChange(field as any, value)}
              onSave={handleSave}
              onSaveAndNew={handleSaveAndNew}
              onDuplicate={handleDuplicate}
              onDeactivate={handleOpenDeactivate}
              onNotification={onNotification}
              onBack={() => setViewMode("catalogue")}
              onEditCustomer={() => {
                setViewMode("catalogue");
                setActiveTab("form");
              }}
              isSaving={isSaving}
              isDirty={isDirty}
            />
          </React.Suspense>
        </div>
      ) : viewMode === "catalogue" && layoutStyle === "enterprise" ? (
        <React.Suspense fallback={<div role="status" className="p-4 text-sm text-slate-500">Loading enterprise customer workspace…</div>}>
          <LazyEnterpriseCustomerMasterView
            customer={currentCustomer}
            onChange={handleFieldChange}
            onSave={handleSave}
            onSaveAndNew={handleSaveAndNew}
            onDuplicate={handleDuplicate}
            onDeactivate={handleOpenDeactivate}
            onBack={() => setViewMode("directory")}
            onOpenDirectory={() => setViewMode("directory")}
            onOpen360={() => setViewMode("360")}
            onToggleLayout={() => setLayoutStyle("classic")}
            isSaving={isSaving}
            isDirty={isDirty}
            lifecycleMode={lifecycleMode}
            onEdit={handleEdit}
            onCancelEdit={handleCancelEdit}
            onOpenMailingModal={handleOpenMailingModal}
            onOpenStoreLookupModal={() => setIsSearchModalOpen(true)}
            onOpenContactModal={() => handleOpenMailingModal()}
            onOpenAddChildModal={() => setIsCreateCustomerModalOpen(true)}
            onSelectCustomer={handleSelectCustomerByIdOrCode}
            gstRegistrations={gstRegistrations}
            onNotification={onNotification}
          />
        </React.Suspense>
      ) : (
        <>
          {/* ── Top Header & High-Density Action Bar ──────────────────────────────── */}
          <header className="px-6 py-3.5 bg-white dark:bg-[#131b2e] border-b border-[#c6c6cd] dark:border-[#45464d] flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-xs">
        
        {/* Title & Status Badges */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#00355f] text-white rounded-xl shadow-xs">
            {isCorporate ? <Building2 size={20} /> : <Users size={20} />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-[#191c1e] dark:text-white uppercase tracking-wider">
                Customer Catalogue ({isCorporate ? "Corporate" : (currentCustomer.customerType || currentCustomer.environment || "Retail")})
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#d0e1fb] dark:bg-[#0f4c81] text-[#00355f] dark:text-[#8ebdf9]">
                Environment: {isCorporate ? "Corporate" : (currentCustomer.environment || "Retail")}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 ${
                lifecycleMode === "view"
                  ? "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700"
                  : "bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700 animate-pulse"
              }`}>
                {lifecycleMode === "view" ? <Eye size={11} /> : <Edit3 size={11} />}
                <span>{lifecycleMode === "view" ? "View Mode" : "Editing"}</span>
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                currentCustomer.status === "Active"
                  ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
                  : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
              }`}>
                {currentCustomer.status || "Active"}
              </span>
              {isDirty && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#ffdad6] text-[#ba1a1a] animate-pulse">
                  ● Unsaved Changes
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#515f74] dark:text-[#bec6e0]">
              Central window to create, view, edit, and audit {isCorporate ? "corporate" : "retail"} customer accounts.
            </p>
          </div>
        </div>

        {/* Action Buttons Toolbar */}
        <div className="flex items-center gap-2">
          
          {/* Catalogue Record Navigator (< | >) */}
          {viewMode !== "directory" && <div className="flex items-center bg-[#f2f4f6] dark:bg-[#2d3133] border border-[#c6c6cd] dark:border-[#45464d] rounded-xl px-2 py-1 gap-1.5" aria-label="Catalogue record navigation">
            <button
              type="button"
              onClick={handlePrev}
              disabled={currentIndex === 0}
              className="p-1 text-[#515f74] hover:text-[#191c1e] dark:text-[#bec6e0] dark:hover:text-white disabled:opacity-30 rounded transition"
              title="Previous Customer Record"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="font-mono text-xs font-bold px-1.5 text-[#00355f] dark:text-[#8ebdf9]">
              {customers.length > 0 ? `Catalogue record ${currentIndex + 1} of ${customers.length}` : "Catalogue record 0 of 0"}
            </span>
            <button
              type="button"
              onClick={handleNext}
              disabled={currentIndex >= customers.length - 1}
              className="p-1 text-[#515f74] hover:text-[#191c1e] dark:text-[#bec6e0] dark:hover:text-white disabled:opacity-30 rounded transition"
              title="Next Customer Record"
            >
              <ChevronRight size={16} />
            </button>
          </div>}

          {viewMode !== "directory" && <div className="h-5 w-[1px] bg-[#c6c6cd] dark:bg-[#45464d] mx-1" />}

          {/* New Button */}
          <button
            type="button"
            onClick={handleNew}
            data-testid="new-customer-btn"
            className="px-3.5 py-2 bg-white dark:bg-[#2d3133] border border-[#c6c6cd] dark:border-[#45464d] hover:bg-[#eceef0] rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-2xs"
            title="Create New Customer Record (Alt+N)"
          >
            <Plus size={14} className="text-[#00355f] dark:text-[#8ebdf9]" />
            <span>New</span>
            <kbd className="text-[9px] px-1 bg-[#f2f4f6] dark:bg-[#191c1e] rounded text-[#76777d]">Alt+N</kbd>
          </button>

          {lifecycleMode === "view" ? (
            <>
              {/* Edit Button */}
              <button
                type="button"
                onClick={handleEdit}
                data-testid="edit-customer-btn"
                className="px-3.5 py-2 bg-white dark:bg-[#2d3133] border border-[#c6c6cd] dark:border-[#45464d] hover:bg-[#eceef0] rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-2xs text-[#00355f] dark:text-[#8ebdf9]"
                title="Edit Current Customer Record (Alt+E)"
              >
                <Edit3 size={14} className="text-[#00355f] dark:text-[#8ebdf9]" />
                <span>Edit</span>
                <kbd className="text-[9px] px-1 bg-[#f2f4f6] dark:bg-[#191c1e] rounded text-[#76777d]">Alt+E</kbd>
              </button>

              {/* Deactivate / Reactivate Action */}
              {currentCustomer.status === "Active" ? (
                <button
                  type="button"
                  onClick={handleOpenDeactivate}
                  data-testid="deactivate-customer-btn"
                  className="px-3 py-2 bg-white dark:bg-[#2d3133] border border-amber-500/50 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-amber-700 dark:text-amber-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-2xs"
                  title="Deactivate Customer Account (Suspend Billing)"
                >
                  <PowerOff size={14} />
                  <span>Deactivate</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleReactivate}
                  data-testid="reactivate-customer-btn"
                  className="px-3 py-2 bg-white dark:bg-[#2d3133] border border-emerald-500/50 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-2xs"
                  title="Reactivate Customer Account"
                >
                  <Power size={14} />
                  <span>Reactivate</span>
                </button>
              )}

              {/* Delete Button (Pre-flight Safety Dialog) */}
              <button
                type="button"
                onClick={handleOpenDelete}
                data-testid="delete-customer-btn"
                className="p-2 border border-[#ba1a1a] text-[#ba1a1a] hover:bg-[#ffdad6] rounded-xl text-xs font-bold transition"
                title="Delete Customer Record (Alt+D)"
              >
                <Trash2 size={15} />
              </button>
            </>
          ) : (
            <>
              {/* Save Button */}
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                data-testid="save-customer-btn"
                className="px-4 py-2 bg-[#00355f] dark:bg-[#8ebdf9] text-white dark:text-[#001c37] hover:bg-[#0f4c81] dark:hover:bg-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-xs disabled:opacity-60"
                title="Save Changes to Database (Ctrl+S)"
              >
                {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                <span>{isSaving ? "Saving..." : "Save"}</span>
                <kbd className="text-[9px] px-1 bg-white/20 dark:bg-black/20 rounded text-inherit">Ctrl+S</kbd>
              </button>

              {/* Cancel Changes Button */}
              <button
                type="button"
                onClick={handleCancelEdit}
                data-testid="cancel-edit-btn"
                className="px-3.5 py-2 bg-white dark:bg-[#2d3133] border border-slate-300 dark:border-slate-700 hover:bg-slate-100 rounded-xl text-xs font-bold flex items-center gap-1.5 transition text-slate-700 dark:text-slate-200"
                title="Cancel Changes (Esc)"
              >
                <XCircle size={14} className="text-slate-400" />
                <span>Cancel</span>
                <kbd className="text-[9px] px-1 bg-[#f2f4f6] dark:bg-[#191c1e] rounded text-[#76777d]">Esc</kbd>
              </button>
            </>
          )}

          {/* More Menu Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsMoreMenuOpen(prev => !prev)}
              className="px-3 py-2 bg-white dark:bg-[#2d3133] border border-[#c6c6cd] dark:border-[#45464d] hover:bg-[#eceef0] rounded-xl text-xs font-bold flex items-center gap-1 transition shadow-2xs"
            >
              <span>More</span>
              <ChevronDown size={14} />
            </button>
            {isMoreMenuOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-60 bg-white dark:bg-[#1e222d] border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg z-50 p-1.5 space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsMoreMenuOpen(false);
                    setIsSearchModalOpen(true);
                  }}
                  className="w-full px-3 py-2 text-left text-xs font-semibold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2"
                >
                  <Search size={14} className="text-[#00355f] dark:text-[#8ebdf9]" />
                  <span>Advanced Search (F2)</span>
                </button>
                <button
                  type="button"
                  data-testid="merge-customer-btn"
                  onClick={() => {
                    setIsMoreMenuOpen(false);
                    setIsMergeModalOpen(true);
                  }}
                  className="w-full px-3 py-2 text-left text-xs font-semibold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 text-blue-700 dark:text-blue-400"
                >
                  <GitMerge size={14} className="text-blue-500" />
                  <span>Merge Account (BD-2)</span>
                </button>
                <button
                  type="button"
                  data-testid="enterprise-search-btn"
                  onClick={() => {
                    setIsMoreMenuOpen(false);
                    setIsEnterpriseSearchOpen(true);
                  }}
                  className="w-full px-3 py-2 text-left text-xs font-semibold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 text-indigo-700 dark:text-indigo-400"
                >
                  <Globe2 size={14} className="text-indigo-500" />
                  <span>Enterprise Group Search (BD-4)</span>
                </button>
                <div className="px-1 py-1">
                  <ExportButton
                    moduleTitle="Customer Master"
                    columns={viewMode === "directory" ? directoryExportColumns : customerExportColumns}
                    data={viewMode === "directory" ? directoryItems : customers}
                    selectedRows={viewMode === "directory" ? [] : [currentCustomer]}
                    totalRecordsCount={viewMode === "directory" ? directoryTotal : customers.length}
                    filteredRecordsCount={viewMode === "directory" ? directoryTotal : customers.length}
                    searchTerm={viewMode === "directory" ? directoryQuery : ""}
                    appliedFilters={viewMode === "directory" ? { status: directoryStatus } : {}}
                    companyName="SMRITI Retail"
                    onNotification={onNotification}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsMoreMenuOpen(false);
                    setViewMode(viewMode === "directory" ? "catalogue" : "directory");
                  }}
                  className="w-full px-3 py-2 text-left text-xs font-semibold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2"
                >
                  <Grid size={14} className="text-[#00355f] dark:text-[#8ebdf9]" />
                  <span>{viewMode === "directory" ? "Return to Catalogue" : "Directory Grid View"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsMoreMenuOpen(false);
                    setLayoutStyle("enterprise");
                    onNotification?.(
                      "Workspace Layout Switched",
                      "Switched to the Enterprise Customer Workspace.",
                      "info"
                    );
                  }}
                  className="w-full px-3 py-2 text-left text-xs font-semibold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2"
                >
                  <Sliders size={14} className="text-[#00355f] dark:text-[#8ebdf9]" />
                  <span>Switch to Enterprise Workspace</span>
                </button>
              </div>
            )}
          </div>

          {/* Corporate 360 Button */}
          <button
            type="button"
            onClick={() => setViewMode("360")}
            className="px-3.5 py-2 bg-white dark:bg-[#2d3133] border border-[#00355f] dark:border-[#8ebdf9] text-[#00355f] dark:text-[#8ebdf9] hover:bg-[#e8f1fc] dark:hover:bg-[#1a2e4a] rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-2xs"
            title="Open Corporate 360 Full Dashboard"
          >
            <Building2 size={14} />
            <span>Corporate 360</span>
          </button>

        </div>

      </header>

      {/* ── Main Workspace Body ────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden flex flex-col p-5">
        
        {viewMode === "directory" ? (
          /* Full Customer Directory Grid Mode */
          <div className="flex-1 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded-2xl shadow-xs overflow-hidden flex flex-col">
            <div className="p-4 bg-[#f2f4f6] dark:bg-[#131b2e] border-b border-[#c6c6cd] dark:border-[#45464d] flex items-center justify-between shrink-0">
              <span className="font-bold text-xs uppercase tracking-wider text-[#00355f] dark:text-[#8ebdf9]">
                Customer Directory ({directoryTotal} Accounts)
              </span>
              <div className="flex items-center gap-2">
                <label className="relative">
                  <span className="sr-only">Search customer directory</span>
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    value={directoryQuery}
                    onChange={event => { setDirectoryQuery(event.target.value); setDirectoryPage(0); }}
                    placeholder="Name, code, or phone"
                    className="pl-8 pr-2 py-1.5 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded-lg text-xs w-48"
                  />
                </label>
                <label className="sr-only" htmlFor="customer-directory-status">Filter by status</label>
                <select id="customer-directory-status" value={directoryStatus} onChange={event => { setDirectoryStatus(event.target.value); setDirectoryPage(0); }} className="px-2 py-1.5 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded-lg text-xs">
                  <option value="all">All statuses</option><option value="Active">Active</option><option value="Inactive">Inactive</option><option value="Archived">Archived</option><option value="Merged">Merged</option>
                </select>
                <button type="button" onClick={() => setIsSearchModalOpen(true)} className="px-3 py-1.5 bg-[#00355f] text-white rounded-lg text-xs font-bold flex items-center gap-1">
                  <Search size={12} /> Advanced Search
                </button>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-auto">
              <table className="w-full text-left text-xs border-collapse min-w-[700px]">
                <thead className="sticky top-0 bg-[#f7f9fb] dark:bg-[#131b2e] border-b border-[#c6c6cd] dark:border-[#45464d] font-bold text-[10px] uppercase text-[#515f74] dark:text-[#bec6e0]">
                  <tr>
                    <th className="p-3">Customer Code</th>
                    <th className="p-3">Customer Name</th>
                    <th className="p-3">Customer Group</th>
                    <th className="p-3">Phone</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eceef0] dark:divide-[#2d3133]">
                  {isDirectoryLoading ? (
                    <tr><td colSpan={6} className="p-8 text-center text-slate-500">Loading customers…</td></tr>
                  ) : directoryError ? (
                    <tr><td colSpan={6} role="alert" className="p-8 text-center text-red-700">{directoryError}</td></tr>
                  ) : directoryItems.length === 0 ? (
                    <tr><td colSpan={6} className="p-8 text-center text-slate-500">No customers match this search.</td></tr>
                  ) : directoryItems.map(c => {
                    const active = c.status?.toLowerCase() === "active" && c.is_active;
                    return (
                    <tr
                      key={c.id || c.code}
                      onClick={() => void handleOpenDirectoryCustomer(c)}
                      className="hover:bg-[#f7f9fb] dark:hover:bg-[#2d3133] cursor-pointer transition"
                    >
                      <td className="p-3 font-mono font-bold text-[#00355f] dark:text-[#8ebdf9]">{c.code || "—"}</td>
                      <td className="p-3 font-bold"><button type="button" onClick={event => { event.stopPropagation(); void handleOpenDirectoryCustomer(c); }} className="text-left hover:underline">{c.name}</button></td>
                      <td className="p-3 text-[11px]">{c.customer_group_name || "—"}</td>
                      <td className="p-3 font-mono">{c.mobile || "—"}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${active ? "bg-[#dcfce7] text-[#166534]" : "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200"}`}>
                          {c.status || "Unknown"}
                        </span>
                      </td>
                      <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => void handleOpenDirectoryCustomer(c, "edit")}
                          className="px-2.5 py-1 bg-[#00355f] dark:bg-[#8ebdf9] text-white dark:text-[#001c37] hover:bg-[#0f4c81] dark:hover:bg-white rounded-lg font-bold text-[11px] inline-flex items-center gap-1 transition shadow-2xs"
                          title={`Edit Customer ${c.code}`}
                        >
                          <Edit3 size={12} />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void handleOpenDirectoryCustomer(c, "360");
                          }}
                          className="px-2.5 py-1 bg-white dark:bg-[#191c1e] border border-[#00355f] dark:border-[#8ebdf9] text-[#00355f] dark:text-[#8ebdf9] hover:bg-[#e0e8f0] dark:hover:bg-[#2d3133] rounded-lg font-bold text-[11px] inline-flex items-center gap-1 transition shadow-2xs ml-1"
                          title={`Open Corporate 360 for ${c.name}`}
                        >
                          <Building2 size={12} />
                          <span>360</span>
                        </button>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-[#c6c6cd] dark:border-[#45464d] flex items-center justify-between text-xs shrink-0">
              <span aria-live="polite">
                {directoryTotal === 0 ? "0 customers" : `Showing ${directoryPage * directoryPageSize + 1}–${Math.min((directoryPage + 1) * directoryPageSize, directoryTotal)} of ${directoryTotal} customers`}
              </span>
              <div className="flex items-center gap-2">
                <button type="button" disabled={directoryPage === 0 || isDirectoryLoading} onClick={() => setDirectoryPage(page => Math.max(0, page - 1))} className="px-3 py-1.5 border rounded-lg disabled:opacity-40">Previous</button>
                <span>Page {directoryPage + 1} of {Math.max(1, Math.ceil(directoryTotal / directoryPageSize))}</span>
                <button type="button" disabled={(directoryPage + 1) * directoryPageSize >= directoryTotal || isDirectoryLoading} onClick={() => setDirectoryPage(page => page + 1)} className="px-3 py-1.5 border rounded-lg disabled:opacity-40">Next</button>
              </div>
            </div>
          </div>
        ) : (
          /* Catalogue View Mode */
          isCorporate ? (
            /* Corporate Workspace View */
            <div className="flex-1 flex flex-col min-h-0 space-y-4">
              
              {/* Lifecycle Mode Banner */}
              {lifecycleMode === "view" ? (
                <div className="px-3.5 py-2 bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/60 rounded-xl flex items-center justify-between text-xs text-sky-900 dark:text-sky-200 shrink-0 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <Eye size={15} className="text-sky-600 dark:text-sky-400 shrink-0" />
                    <span><strong>View Mode (Read-Only)</strong>: Displaying saved corporate account data. Click Edit (Alt+E) to modify commercial terms or credentials.</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleEdit}
                    className="px-2.5 py-1 bg-sky-700 hover:bg-sky-800 text-white rounded-lg font-bold text-[11px] flex items-center gap-1 transition shadow-2xs"
                  >
                    <Edit3 size={12} />
                    <span>Edit Account (Alt+E)</span>
                  </button>
                </div>
              ) : (
                <div className="px-3.5 py-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl flex items-center justify-between text-xs text-amber-900 dark:text-amber-200 shrink-0 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <Edit3 size={15} className="text-amber-600 dark:text-amber-400 shrink-0" />
                    <span><strong>Edit Mode Active</strong>: Modifying corporate master record. Press <kbd className="font-mono bg-amber-100 dark:bg-amber-900/60 px-1 py-0.5 rounded text-[10px]">Ctrl+S</kbd> to save or <kbd className="font-mono bg-amber-100 dark:bg-amber-900/60 px-1 py-0.5 rounded text-[10px]">Esc</kbd> to cancel.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="px-2.5 py-1 bg-white dark:bg-amber-900/40 border border-amber-300 dark:border-amber-700 hover:bg-amber-100 text-amber-800 dark:text-amber-200 rounded-lg font-bold text-[11px] flex items-center gap-1 transition shadow-2xs"
                    >
                      <XCircle size={12} />
                      <span>Cancel (Esc)</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={isSaving}
                      className="px-2.5 py-1 bg-amber-700 hover:bg-amber-800 text-white rounded-lg font-bold text-[11px] flex items-center gap-1 transition shadow-2xs disabled:opacity-60"
                    >
                      {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                      <span>Save Changes (Ctrl+S)</span>
                    </button>
                  </div>
                </div>
              )}

              {/* A. Persistent Corporate Account Header */}
              <CorporateMasterAccountHeader
                customer={currentCustomer}
                creditExposure={creditExposure ?? undefined}
              />

              {/* B. Corporate Workspace Navigation Tabs */}
              <div className="flex items-center justify-between gap-2 border-b border-[#c6c6cd] dark:border-[#45464d] pb-2 shrink-0 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveCorporateTab("identity");
                      if (corporateWorkspaceMode === "overview") {
                        document.getElementById("sec-identity")?.scrollIntoView({ behavior: "smooth" });
                      }
                    }}
                    className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition ${
                      activeCorporateTab === "identity"
                        ? "bg-[#00355f] dark:bg-[#8ebdf9] text-white dark:text-[#001c37] shadow-xs"
                        : "bg-white dark:bg-[#2d3133] text-[#515f74] dark:text-[#bec6e0] border border-[#c6c6cd] dark:border-[#45464d] hover:bg-[#eceef0]"
                    }`}
                  >
                    <FileText size={14} />
                    <span>1. Identity & Compliance</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveCorporateTab("network");
                      if (corporateWorkspaceMode === "overview") {
                        document.getElementById("sec-network")?.scrollIntoView({ behavior: "smooth" });
                      }
                    }}
                    className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition ${
                      activeCorporateTab === "network"
                        ? "bg-[#00355f] dark:bg-[#8ebdf9] text-white dark:text-[#001c37] shadow-xs"
                        : "bg-white dark:bg-[#2d3133] text-[#515f74] dark:text-[#bec6e0] border border-[#c6c6cd] dark:border-[#45464d] hover:bg-[#eceef0]"
                    }`}
                  >
                    <Users size={14} />
                    <span>2. Corporate Network</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveCorporateTab("addresses");
                      if (corporateWorkspaceMode === "overview") {
                        document.getElementById("sec-addresses")?.scrollIntoView({ behavior: "smooth" });
                      }
                    }}
                    className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition ${
                      activeCorporateTab === "addresses"
                        ? "bg-[#00355f] dark:bg-[#8ebdf9] text-white dark:text-[#001c37] shadow-xs"
                        : "bg-white dark:bg-[#2d3133] text-[#515f74] dark:text-[#bec6e0] border border-[#c6c6cd] dark:border-[#45464d] hover:bg-[#eceef0]"
                    }`}
                  >
                    <ShieldCheck size={14} />
                    <span>3. Addresses & Contacts</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveCorporateTab("commercial");
                      if (corporateWorkspaceMode === "overview") {
                        document.getElementById("sec-commercial")?.scrollIntoView({ behavior: "smooth" });
                      }
                    }}
                    className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition ${
                      activeCorporateTab === "commercial"
                        ? "bg-[#00355f] dark:bg-[#8ebdf9] text-white dark:text-[#001c37] shadow-xs"
                        : "bg-white dark:bg-[#2d3133] text-[#515f74] dark:text-[#bec6e0] border border-[#c6c6cd] dark:border-[#45464d] hover:bg-[#eceef0]"
                    }`}
                  >
                    <CreditCard size={14} />
                    <span>4. Commercial Terms</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveCorporateTab("integrations");
                      if (corporateWorkspaceMode === "overview") {
                        document.getElementById("sec-integrations")?.scrollIntoView({ behavior: "smooth" });
                      }
                    }}
                    className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition ${
                      activeCorporateTab === "integrations"
                        ? "bg-[#00355f] dark:bg-[#8ebdf9] text-white dark:text-[#001c37] shadow-xs"
                        : "bg-white dark:bg-[#2d3133] text-[#515f74] dark:text-[#bec6e0] border border-[#c6c6cd] dark:border-[#45464d] hover:bg-[#eceef0]"
                    }`}
                  >
                    <Layers size={14} />
                    <span>5. Integrations</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveCorporateTab("audit");
                      if (corporateWorkspaceMode === "overview") {
                        document.getElementById("sec-audit")?.scrollIntoView({ behavior: "smooth" });
                      }
                    }}
                    className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition ${
                      activeCorporateTab === "audit"
                        ? "bg-[#00355f] dark:bg-[#8ebdf9] text-white dark:text-[#001c37] shadow-xs"
                        : "bg-white dark:bg-[#2d3133] text-[#515f74] dark:text-[#bec6e0] border border-[#c6c6cd] dark:border-[#45464d] hover:bg-[#eceef0]"
                    }`}
                  >
                    <History size={14} />
                    <span>6. Activity & Audit</span>
                  </button>
                </div>

                {/* Workspace Mode Switcher */}
                <div className="flex items-center bg-[#f2f4f6] dark:bg-[#2d3133] p-1 rounded-xl border border-[#c6c6cd] dark:border-[#45464d] gap-1">
                  <button
                    type="button"
                    onClick={() => setCorporateWorkspaceMode("overview")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                      corporateWorkspaceMode === "overview"
                        ? "bg-white dark:bg-[#191c1e] text-[#00355f] dark:text-[#8ebdf9] shadow-xs"
                        : "text-[#515f74] dark:text-[#bec6e0]"
                    }`}
                    title="Display All Corporate Panels in Structured Layout (Reference View)"
                  >
                    <Grid size={13} />
                    <span>Full Overview</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCorporateWorkspaceMode("tabbed")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                      corporateWorkspaceMode === "tabbed"
                        ? "bg-white dark:bg-[#191c1e] text-[#00355f] dark:text-[#8ebdf9] shadow-xs"
                        : "text-[#515f74] dark:text-[#bec6e0]"
                    }`}
                    title="Focus on Selected Section Tab"
                  >
                    <Layers size={13} />
                    <span>Tab Focus</span>
                  </button>
                </div>
              </div>

              {/* Corporate Panels Container */}
              <div className="flex-1 overflow-y-auto pr-1">
                {corporateWorkspaceMode === "overview" ? (
                  <div className="space-y-6 pt-2 pb-12">
                    {/* Row 1: Identity & Compliance */}
                    <div id="sec-identity">
                      <CorporateIdentityCompliancePanel
                        customer={currentCustomer}
                        onChange={handleFieldChange}
                        gstRegistrations={gstRegistrations}
                        onSaveGstRegistration={handleSaveGstRegistration}
                        onDeleteGstRegistration={handleDeleteGstRegistration}
                        onOpenPriceListModal={() => setIsPriceGroupModalOpen(true)}
                        onOpenGroupsModal={() => setIsPriceGroupModalOpen(true)}
                      />
                    </div>

                    {/* Row 2: Corporate Network + Addresses & Contacts + Key Contacts */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                      <div id="sec-network" className="lg:col-span-1">
                        <CorporateNetworkPanel
                          customer={currentCustomer}
                          onChange={handleFieldChange}
                          onStoreAssigned={handleStoreAssigned}
                        />
                      </div>
                      <div id="sec-addresses" className="lg:col-span-2">
                        <CorporateAddressesContactsPanel
                          customer={currentCustomer}
                          onChange={handleFieldChange}
                          onOpenMailingModal={handleOpenMailingModal}
                        />
                      </div>
                    </div>

                    {/* Row 3: Commercial Terms + Integrations & Data Exchange */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                      <div id="sec-commercial" className="lg:col-span-7">
                        <React.Suspense fallback={<div role="status" className="p-3 text-sm text-slate-500">Loading commercial terms…</div>}>
                          <LazyCorporateCommercialTermsPanel
                            customer={currentCustomer}
                            onChange={handleFieldChange}
                            relationships={companyRelationships}
                            activeRelationshipId={selectedRelId}
                            onSelectRelationship={setSelectedRelId}
                            onUpdateRelationship={handleUpdateCompanyRelationship}
                            onAddRelationship={handleAddCompanyRelationship}
                            creditExposure={creditExposure ?? undefined}
                            isReadOnly={lifecycleMode === "view"}
                          />
                        </React.Suspense>
                      </div>
                      <div id="sec-integrations" className="lg:col-span-5">
                        <CorporateIntegrationsPanel
                          customer={currentCustomer}
                          onChange={handleFieldChange}
                        />
                      </div>
                    </div>

                    {/* Row 4: Activity & Audit Trail */}
                    <div id="sec-audit">
                      <CorporateActivityAuditPanel customer={currentCustomer} />
                    </div>
                  </div>
                ) : (
                  <div className="pt-2 pb-12">
                    {activeCorporateTab === "identity" && (
                      <CorporateIdentityCompliancePanel
                        customer={currentCustomer}
                        onChange={handleFieldChange}
                        gstRegistrations={gstRegistrations}
                        onSaveGstRegistration={handleSaveGstRegistration}
                        onDeleteGstRegistration={handleDeleteGstRegistration}
                        onOpenPriceListModal={() => setIsPriceGroupModalOpen(true)}
                        onOpenGroupsModal={() => setIsPriceGroupModalOpen(true)}
                      />
                    )}
                    {activeCorporateTab === "network" && (
                      <CorporateNetworkPanel
                        customer={currentCustomer}
                        onChange={handleFieldChange}
                        onStoreAssigned={handleStoreAssigned}
                      />
                    )}
                    {activeCorporateTab === "addresses" && (
                      <CorporateAddressesContactsPanel
                        customer={currentCustomer}
                        onChange={handleFieldChange}
                        onOpenMailingModal={handleOpenMailingModal}
                      />
                    )}
                    {activeCorporateTab === "commercial" && (
                      <React.Suspense fallback={<div role="status" className="p-3 text-sm text-slate-500">Loading commercial terms…</div>}>
                        <LazyCorporateCommercialTermsPanel
                          customer={currentCustomer}
                          onChange={handleFieldChange}
                          relationships={companyRelationships}
                          activeRelationshipId={selectedRelId}
                          onSelectRelationship={setSelectedRelId}
                          onUpdateRelationship={handleUpdateCompanyRelationship}
                          onAddRelationship={handleAddCompanyRelationship}
                          creditExposure={creditExposure ?? undefined}
                          isReadOnly={lifecycleMode === "view"}
                        />
                      </React.Suspense>
                    )}
                    {activeCorporateTab === "integrations" && (
                      <CorporateIntegrationsPanel
                        customer={currentCustomer}
                        onChange={handleFieldChange}
                      />
                    )}
                    {activeCorporateTab === "audit" && (
                      <CorporateActivityAuditPanel customer={currentCustomer} />
                    )}
                  </div>
                )}
              </div>

            </div>
          ) : (
            /* Retail 3-Tab View Mode */
            <div className="flex-1 flex flex-col min-h-0">
              
              {/* Lifecycle Mode Banner */}
              {lifecycleMode === "view" ? (
                <div className="mb-3 px-3.5 py-2 bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/60 rounded-xl flex items-center justify-between text-xs text-sky-900 dark:text-sky-200 shrink-0 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <Eye size={15} className="text-sky-600 dark:text-sky-400 shrink-0" />
                    <span><strong>View Mode (Read-Only)</strong>: Displaying saved customer account records. Field edits are locked.</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleEdit}
                    className="px-2.5 py-1 bg-sky-700 hover:bg-sky-800 text-white rounded-lg font-bold text-[11px] flex items-center gap-1 transition shadow-2xs"
                  >
                    <Edit3 size={12} />
                    <span>Edit Customer (Alt+E)</span>
                  </button>
                </div>
              ) : (
                <div className="mb-3 px-3.5 py-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl flex items-center justify-between text-xs text-amber-900 dark:text-amber-200 shrink-0 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <Edit3 size={15} className="text-amber-600 dark:text-amber-400 shrink-0" />
                    <span><strong>Edit Mode Active</strong>: Unsaved changes will be highlighted. Press <kbd className="font-mono bg-amber-100 dark:bg-amber-900/60 px-1 py-0.5 rounded text-[10px]">Ctrl+S</kbd> to save or <kbd className="font-mono bg-amber-100 dark:bg-amber-900/60 px-1 py-0.5 rounded text-[10px]">Esc</kbd> to cancel.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="px-2.5 py-1 bg-white dark:bg-amber-900/40 border border-amber-300 dark:border-amber-700 hover:bg-amber-100 text-amber-800 dark:text-amber-200 rounded-lg font-bold text-[11px] flex items-center gap-1 transition shadow-2xs"
                    >
                      <XCircle size={12} />
                      <span>Cancel (Esc)</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={isSaving}
                      className="px-2.5 py-1 bg-amber-700 hover:bg-amber-800 text-white rounded-lg font-bold text-[11px] flex items-center gap-1 transition shadow-2xs disabled:opacity-60"
                    >
                      {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                      <span>Save Changes (Ctrl+S)</span>
                    </button>
                  </div>
                </div>
              )}

              {/* 3 Main Tabs Switcher */}
              <div className="flex items-center gap-2 border-b border-[#c6c6cd] dark:border-[#45464d] pb-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveTab("form")}
                  className={`px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition ${
                    activeTab === "form"
                      ? "bg-[#00355f] dark:bg-[#8ebdf9] text-white dark:text-[#001c37] shadow-xs"
                      : "bg-white dark:bg-[#2d3133] text-[#515f74] dark:text-[#bec6e0] border border-[#c6c6cd] dark:border-[#45464d] hover:bg-[#eceef0]"
                  }`}
                >
                  <FileText size={14} />
                  <span>1. The "Form" Tab</span>
                  <kbd className="text-[9px] px-1 bg-black/10 rounded">Alt+1</kbd>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("retail")}
                  className={`px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition ${
                    activeTab === "retail"
                      ? "bg-[#00355f] dark:bg-[#8ebdf9] text-white dark:text-[#001c37] shadow-xs"
                      : "bg-white dark:bg-[#2d3133] text-[#515f74] dark:text-[#bec6e0] border border-[#c6c6cd] dark:border-[#45464d] hover:bg-[#eceef0]"
                  }`}
                >
                  <Heart size={14} />
                  <span>2. The "Retail Details" Tab</span>
                  <kbd className="text-[9px] px-1 bg-black/10 rounded">Alt+2</kbd>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("additional")}
                  className={`px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition ${
                    activeTab === "additional"
                      ? "bg-[#00355f] dark:bg-[#8ebdf9] text-white dark:text-[#001c37] shadow-xs"
                      : "bg-white dark:bg-[#2d3133] text-[#515f74] dark:text-[#bec6e0] border border-[#c6c6cd] dark:border-[#45464d] hover:bg-[#eceef0]"
                  }`}
                >
                  <CreditCard size={14} />
                  <span>3. The "Additional Details" Tab</span>
                  <kbd className="text-[9px] px-1 bg-black/10 rounded">Alt+3</kbd>
                </button>
              </div>

              {/* Tab Panels Content */}
              <div className="flex-1 overflow-y-auto pt-4 pr-1">
                {activeTab === "form" && (
                  <SmritiCustomerFormTab
                    customer={currentCustomer}
                    onChange={handleFieldChange}
                    onOpenMailingModal={handleOpenMailingModal}
                  />
                )}

                {activeTab === "retail" && (
                  <SmritiCustomerRetailDetailsTab
                    customer={currentCustomer}
                    onChange={handleFieldChange}
                  />
                )}

                {activeTab === "additional" && (
                  <SmritiCustomerAdditionalDetailsTab
                    customer={currentCustomer}
                    onChange={handleFieldChange}
                  />
                )}
              </div>

            </div>
          )
        )}

      </div>
    </>
  )}

      {/* ── Sub-Modals ──────────────────────────────────────────────────────── */}
      <SmritiCustomerMailingModal
        isOpen={isMailingModalOpen}
        onClose={() => setIsMailingModalOpen(false)}
        customerName={currentCustomer.name}
        addresses={currentCustomer.mailingAddresses}
        customerId={currentCustomer.id}
        gstRegistrations={customerGstRegistrations}
        isLoadingGstRegistrations={isLoadingGstRegistrations}
        onSaveAddresses={newAddrs => {
          handleFieldChange("mailingAddresses", newAddrs);
          if (newAddrs[0]) {
            handleFieldChange("phone", newAddrs[0].mobilePhone);
            handleFieldChange("email", newAddrs[0].email1);
          }
        }}
        onNotification={onNotification}
      />

      <SmritiAdvancedCustomerSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        onSelectCustomer={selected => {
          setIsSearchModalOpen(false);
          void handleOpenDirectoryCustomer(selected);
        }}
      />

      <SmritiCustomerPriceGroupModal
        isOpen={isPriceGroupModalOpen}
        onClose={() => setIsPriceGroupModalOpen(false)}
        onSelectGroup={group => {
          handleFieldChange("priceGroup", `${group.code}#${group.description}`);
          setIsPriceGroupModalOpen(false);
        }}
      />

      {/* ── Lifecycle Modals ─────────────────────────────────────────────────── */}
      <CreateCustomerModal
        isOpen={isCreateCustomerModalOpen}
        onClose={() => setIsCreateCustomerModalOpen(false)}
        onCreated={handleCustomerCreated}
        onNotification={onNotification}
      />

      <CustomerDeactivateModal
        isOpen={isDeactivateModalOpen}
        onClose={() => setIsDeactivateModalOpen(false)}
        customer={currentCustomer}
        onDeactivated={handleCustomerDeactivated}
        onNotification={onNotification}
      />

      <CustomerDeleteConfirmationModal
        isOpen={isDeleteConfirmationModalOpen}
        onClose={() => setIsDeleteConfirmationModalOpen(false)}
        customer={currentCustomer}
        onDeleted={handleCustomerDeleted}
        onSwitchToDeactivate={() => {
          setIsDeleteConfirmationModalOpen(false);
          setIsDeactivateModalOpen(true);
        }}
        onNotification={onNotification}
      />

      <CustomerMergeModal
        isOpen={isMergeModalOpen}
        onClose={() => setIsMergeModalOpen(false)}
        targetCustomer={currentCustomer}
        onMerged={handleCustomerMerged}
        onNotification={onNotification}
      />

      <EnterpriseCustomerSearchModal
        isOpen={isEnterpriseSearchOpen}
        onClose={() => setIsEnterpriseSearchOpen(false)}
        onSelectCustomer={handleEnterpriseCustomerSelected}
        onNotification={onNotification}
        currentUser={currentUser}
        currentCompanyId={(currentCustomer as any).companyId || (currentCustomer as any).company_id || "COMP-001"}
        currentCompanyCode={currentCustomer.companyCode || "001"}
      />

    </div>
  );
};
