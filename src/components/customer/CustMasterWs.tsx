/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 5.6.0
 * Created      : 2026-08-21
 * Modified     : 2026-09-02
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
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
  Loader2
} from "lucide-react";
import { RetailCustomerRecord, CustomerAddressEntry } from "./types.ts";
import { SmritiCustomerFormTab } from "./CustFormTab.tsx";
import { SmritiCustomerRetailDetailsTab } from "./CustRetailDetTab.tsx";
import { SmritiCustomerAdditionalDetailsTab } from "./CustAddlDetTab.tsx";
import { SmritiCustomerMailingModal } from "./CustMailingDlg.tsx";
import { SmritiAdvancedCustomerSearchModal } from "./AdvancedCustSearch.tsx";
import { ExportButton } from "../export/ExportButton.tsx";
import { ExportColumnDefinition } from "../export/types.ts";
import { apiFetchV1 } from "../../lib/apiFetchV1.ts";

const DEFAULT_MAILING_ADDRESS: CustomerAddressEntry = {
  code: "001",
  contactPerson: "Primary Contact",
  address1: "Plot No. 42, 5th Main Road",
  address2: "4th Block, Near Central Park",
  address3: "Jayanagar",
  address4: "",
  address5: "",
  locality: "Jayanagar",
  city: "Bangalore",
  postalCode: "560027",
  state: "Karnataka",
  zone: "South",
  country: "India",
  officePhone: "080-26654321",
  homePhone: "",
  mobilePhone: "",
  faxNumber: "",
  email1: "customer@domain.com",
  email2: "",
  email3: "",
  isDefault: true
};

const SEED_CUSTOMERS: RetailCustomerRecord[] = [
  {
    id: "cust-1",
    code: "CUST-001",
    name: "Farida Jameel",
    priceGroup: "TI#Tech Infotech Ltd",
    phone: "9845510001",
    email: "farida.jameel@gmail.com",
    religion: "Muslim",
    ethnicity: "Arab",
    ageGroup: ">=35 - <45",
    profession: "Senior Consultant",
    customerType: "Retail",
    profileNotes: "Prefers leather footwear and comfort insoles. Regular VIP shopper at Jayanagar store.",
    companyCode: "009",
    environment: "Retail",
    flatFileFormat: "GUI with Delimiter Format",
    isTaxInclusive: true,
    delimiter: ";",
    buyingFactor: 1.00,
    sellingFactor: 1.00,
    mailingAddresses: [DEFAULT_MAILING_ADDRESS],
    isDependant: false,
    primaryAccountCode: "",
    primaryAccountName: "",
    applyParentMailingInfo: false,
    dependants: [
      { code: "DEP-001", name: "Sara Jameel", relation: "Daughter", applySameMailing: true }
    ],
    gender: "Female",
    dateOfBirth: "1988-05-14",
    isMarried: true,
    weddingAnniversary: "2012-11-20",
    loyaltyPgmId: "024",
    loyaltyPgmCode: "DSC",
    loyaltyTier: "Gold",
    loyaltyPointsBalance: 1450,
    paymentCategory: "CASH",
    paymentTerm: "Immediate",
    creditLimit: 50000,
    creditDays: 30,
    creditUsed: 12500,
    transportMode: "By-Road",
    transportCode: "VRL",
    transitDays: 2,
    bankCode: "HDFC000123",
    bankLocation: "Jayanagar 4th Block",
    retailFactor: 1.00,
    dealerFactor: 0.85,
    destinationTaxType: "318#GST_RETAIL",
    allowCashBill: true,
    allowDcGen: true,
    allowCreditInvoice: true,
    allowMiscIssue: false,
    allowMiscReceipts: true,
    lstNumber: "LST-KA-9901",
    lstDate: "2020-04-01",
    cstNumber: "CST-KA-8802",
    cstDate: "2020-04-01",
    gstin: "29AABCT1332L1ZV",
    panNumber: "ABCDE1234F",
    isPreSaleFormApplicable: false,
    preSaleFormName: "",
    isPostSaleFormApplicable: false,
    postSaleFormName: "",
    status: "Active",
    createdAt: "2026-01-10",
    updatedAt: "2026-08-21"
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
    isTaxInclusive: true,
    delimiter: ";",
    buyingFactor: 1.00,
    sellingFactor: 1.00,
    mailingAddresses: [{
      ...DEFAULT_MAILING_ADDRESS,
      code: "001",
      contactPerson: "Rajesh Ramachandran",
      locality: "Indiranagar",
      city: "Bangalore",
      postalCode: "560038"
    }],
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
  priceGroup: "TI#Tech Infotech Ltd",
  phone: "",
  email: "",
  religion: "Muslim",
  ethnicity: "Asian",
  ageGroup: ">=20 - <35",
  profession: "",
  customerType: "Retail",
  profileNotes: "",
  companyCode: "001",
  environment: "Retail",
  flatFileFormat: "GUI with Delimiter Format",
  isTaxInclusive: true,
  delimiter: ";",
  buyingFactor: 1.00,
  sellingFactor: 1.00,
  mailingAddresses: [DEFAULT_MAILING_ADDRESS],
  isDependant: false,
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
  paymentTerm: "Immediate",
  creditLimit: 25000,
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
  const grpId = bCust.customer_group_id || bCust.customerGroupId || "";
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
    isWholesale ? "TI#Tech Infotech Ltd" :
    "TI#Tech Infotech Ltd"
  );

  return {
    id: bCust.id || `cust-${Date.now()}`,
    code: bCust.code || bCust.id || "CUST-001",
    name: bCust.name || "",
    priceGroup: derivedPriceGroup,
    phone: bCust.mobile || bCust.phone || "",
    email: bCust.email || "",
    religion: bCust.religion || "Muslim",
    ethnicity: bCust.ethnicity || "Asian",
    ageGroup: bCust.age_group || bCust.ageGroup || ">=20 - <35",
    profession: bCust.profession || "",
    customerType: derivedCustomerType,
    profileNotes: bCust.profile_notes || bCust.profileNotes || "",
    companyCode: bCust.company_code || bCust.companyCode || "001",
    environment: derivedEnvironment,
    flatFileFormat: bCust.flat_file_format || bCust.flatFileFormat || "GUI with Delimiter Format",
    isTaxInclusive: bCust.is_tax_inclusive ?? true,
    delimiter: bCust.delimiter || ";",
    buyingFactor: Number(bCust.buying_factor ?? 1.00),
    sellingFactor: Number(bCust.selling_factor ?? 1.00),
    mailingAddresses: Array.isArray(bCust.mailing_addresses || bCust.mailingAddresses) && (bCust.mailing_addresses || bCust.mailingAddresses).length > 0
      ? (bCust.mailing_addresses || bCust.mailingAddresses)
      : [{
          ...DEFAULT_MAILING_ADDRESS,
          mobilePhone: bCust.mobile || bCust.phone || "",
          email1: bCust.email || ""
        }],
    isDependant: bCust.is_dependant ?? false,
    primaryAccountCode: bCust.primary_account_code || "",
    primaryAccountName: bCust.primary_account_name || "",
    applyParentMailingInfo: bCust.apply_parent_mailing_info ?? false,
    dependants: bCust.dependants || [],
    gender: bCust.gender || "Female",
    dateOfBirth: bCust.date_of_birth || "",
    isMarried: bCust.is_married ?? false,
    weddingAnniversary: bCust.wedding_anniversary || "",
    loyaltyPgmId: bCust.loyalty_pgm_id || "024",
    loyaltyPgmCode: bCust.loyalty_pgm_code || "DSC",
    loyaltyTier: bCust.loyalty_tier || "Standard",
    loyaltyPointsBalance: Number(bCust.loyalty_points_balance || 0),
    paymentCategory: bCust.payment_category || "CASH",
    paymentTerm: bCust.payment_term || "Immediate",
    creditLimit: Number(bCust.credit_limit || 25000),
    creditDays: Number(bCust.credit_days || 0),
    creditUsed: Number(bCust.outstanding || bCust.credit_used || 0),
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
    gstin: bCust.gst_number || bCust.gstin || "",
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
  const [customers, setCustomers] = useState<RetailCustomerRecord[]>(() => {
    try {
      const stored = localStorage.getItem("smriti_customers") || localStorage.getItem("smriti_retail_customers");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed.map(mapBackendCustomerToRecord);
      }
    } catch {}
    return SEED_CUSTOMERS;
  });

  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<"form" | "retail" | "additional">("form");
  const [viewMode, setViewMode] = useState<"catalogue" | "directory">("catalogue");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Modals
  const [isMailingModalOpen, setIsMailingModalOpen] = useState<boolean>(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState<boolean>(false);

  // Active customer in editor
  const [currentCustomer, setCurrentCustomer] = useState<RetailCustomerRecord>(() => {
    return customers[0] || createEmptyCustomer(1);
  });

  const [isDirty, setIsDirty] = useState<boolean>(false);

  // Authoritative Backend Hydration
  const loadCustomersFromBackend = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await apiFetchV1("/crm/customers");
      const list = Array.isArray(res) ? res : (res?.items || []);
      if (list && list.length > 0) {
        const mappedList = list.map(mapBackendCustomerToRecord);
        setCustomers(mappedList);
        localStorage.setItem("smriti_customers", JSON.stringify(list));
        try {
          localStorage.removeItem("smriti_retail_customers");
        } catch {}
      }
    } catch (err) {
      // Offline fallback: load from cached smriti_customers
      try {
        const cached = localStorage.getItem("smriti_customers") || localStorage.getItem("smriti_retail_customers");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setCustomers(parsed.map(mapBackendCustomerToRecord));
          }
        }
      } catch {}
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCustomersFromBackend();
    const handleCustomerUpdated = () => {
      loadCustomersFromBackend();
    };
    window.addEventListener("smriti_customer_updated", handleCustomerUpdated);
    return () => window.removeEventListener("smriti_customer_updated", handleCustomerUpdated);
  }, [loadCustomersFromBackend]);

  // Sync current customer when currentIndex changes
  useEffect(() => {
    if (customers[currentIndex]) {
      setCurrentCustomer(JSON.parse(JSON.stringify(customers[currentIndex])));
      setIsDirty(false);
    }
  }, [currentIndex, customers]);

  const handleFieldChange = (field: keyof RetailCustomerRecord, value: any) => {
    setCurrentCustomer(prev => ({
      ...prev,
      [field]: value
    }));
    setIsDirty(true);
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

      const isExistingInBackend = customers.some(c => c.id === currentCustomer.id && !c.id.startsWith("cust-draft-") && !c.id.startsWith("cust-17"));
      const isBackendId = currentCustomer.id && !currentCustomer.id.startsWith("cust-draft-") && !currentCustomer.id.startsWith("cust-17");

      const grpId = currentCustomer.customerType === "Corporate" || currentCustomer.customerType === "Wholesale" ? "CG-Corporate" : (currentCustomer.customerType === "VIP" ? "CG-LargeRetail" : "CG-Retail");

      const backendPayload: any = {
        name: cleanName,
        code: cleanCode,
        mobile: cleanMobile,
        email: cleanEmail,
        gst_number: cleanGstin,
        customer_group_id: grpId,
        outstanding: Number(currentCustomer.creditUsed || 0),
        status: currentCustomer.status || "Active",
        tags: [currentCustomer.customerType || "Retail", "B2B"].filter(Boolean)
      };

      let savedBackendCust: any = null;
      if (isExistingInBackend && isBackendId) {
        savedBackendCust = await apiFetchV1(`/crm/customers/${currentCustomer.id}`, {
          method: "PUT",
          body: JSON.stringify(backendPayload)
        });
      } else {
        savedBackendCust = await apiFetchV1("/crm/customers", {
          method: "POST",
          body: JSON.stringify(backendPayload)
        });
      }

      const recordToSave: RetailCustomerRecord = {
        ...currentCustomer,
        id: savedBackendCust?.id || currentCustomer.id,
        code: savedBackendCust?.code || currentCustomer.code,
        name: savedBackendCust?.name || currentCustomer.name,
        phone: savedBackendCust?.mobile || currentCustomer.phone,
        gstin: savedBackendCust?.gst_number || currentCustomer.gstin,
        updatedAt: new Date().toISOString().split("T")[0]
      };

      const updated = [...customers];
      const existingIndex = updated.findIndex(c => c.id === currentCustomer.id || c.code === currentCustomer.code || c.id === recordToSave.id);

      if (existingIndex >= 0) {
        updated[existingIndex] = recordToSave;
      } else {
        updated.push(recordToSave);
        setCurrentIndex(updated.length - 1);
      }

      setCustomers(updated);
      setCurrentCustomer(recordToSave);
      setIsDirty(false);

      // Universal cache synchronization
      try {
        const grpIdToSave = recordToSave.customerType === "Corporate" || recordToSave.customerType === "Wholesale" ? "CG-Corporate" : (recordToSave.customerType === "VIP" ? "CG-LargeRetail" : "CG-Retail");
        localStorage.setItem("smriti_customers", JSON.stringify(updated.map(c => ({
          id: c.id,
          code: c.code,
          name: c.name,
          mobile: c.phone,
          email: c.email,
          gstNumber: c.gstin,
          customer_group_id: c.customerType === "Corporate" || c.customerType === "Wholesale" ? "CG-Corporate" : (c.customerType === "VIP" ? "CG-LargeRetail" : "CG-Retail"),
          customerGroupId: c.customerType === "Corporate" || c.customerType === "Wholesale" ? "CG-Corporate" : (c.customerType === "VIP" ? "CG-LargeRetail" : "CG-Retail"),
          outstanding: c.creditUsed,
          status: c.status,
          tags: [c.customerType || "Retail", "B2B"],
          customer_type: c.customerType,
          customerType: c.customerType,
          environment: c.environment,
          price_group: c.priceGroup,
          priceGroup: c.priceGroup
        }))));
        localStorage.removeItem("smriti_retail_customers");
      } catch {}

      window.dispatchEvent(new CustomEvent("smriti_customer_updated"));
      onNotification?.(
        "Catalogue Saved",
        `Customer account ${recordToSave.name} (${recordToSave.code}) persisted to PostgreSQL database.`,
        "success"
      );
    } catch (err: any) {
      console.error("[Customer Master Save Error]:", err);
      let errMsg = err?.message || "Failed to persist customer to backend database.";
      if (typeof errMsg === "string" && errMsg.toLowerCase().includes("mobile number already exists")) {
        errMsg = "A customer with this mobile number is already registered in the system. Please provide a distinct mobile number or update the existing customer profile.";
      }
      onNotification?.(
        "Save Failed",
        errMsg,
        "error"
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleNew = () => {
    const newRecord = createEmptyCustomer(customers.length + 1);
    setCurrentCustomer(newRecord);
    setIsDirty(true);
    setActiveTab("form");
    onNotification?.("New Record", `Initialized new customer entry (${newRecord.code}).`, "info");
  };

  const handleDelete = async () => {
    if (customers.length <= 1) {
      onNotification?.("Action Restricted", "Cannot delete the only existing customer record.", "warning");
      return;
    }

    const confirmDelete = window.confirm(`Are you sure you want to delete customer record "${currentCustomer.name}" (${currentCustomer.code})?`);
    if (!confirmDelete) return;

    try {
      if (currentCustomer.id && !currentCustomer.id.startsWith("cust-draft-") && !currentCustomer.id.startsWith("cust-17")) {
        await apiFetchV1(`/crm/customers/${currentCustomer.id}`, {
          method: "DELETE"
        });
      }
    } catch (err: any) {
      console.warn("[Customer Master Delete]: Backend delete notification:", err);
    }

    const filtered = customers.filter((_, idx) => idx !== currentIndex);
    setCustomers(filtered);
    try {
      localStorage.setItem("smriti_customers", JSON.stringify(filtered));
      localStorage.removeItem("smriti_retail_customers");
    } catch {}

    window.dispatchEvent(new CustomEvent("smriti_customer_updated"));
    const nextIdx = Math.max(0, currentIndex - 1);
    setCurrentIndex(nextIdx);
    onNotification?.("Customer Deleted", `Customer account was removed successfully.`, "success");
  };

  const handlePrev = () => {
    if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
  };

  const handleNext = () => {
    if (currentIndex < customers.length - 1) setCurrentIndex(currentIndex + 1);
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
      setCurrentIndex(idx);
      onNotification?.(
        "Customer Loaded",
        `Loaded catalogue record for ${customers[idx].name} (${customers[idx].code}).`,
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
          return;
        }
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
      } else if (e.altKey && e.key.toLowerCase() === "d") {
        e.preventDefault();
        handleDelete();
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

  return (
    <div className="flex flex-col h-full bg-[#f7f9fb] dark:bg-[#191c1e] text-[#191c1e] dark:text-[#eff1f3] overflow-hidden">
      
      {/* ── Top Header & High-Density Action Bar ──────────────────────────────── */}
      <header className="px-6 py-3.5 bg-white dark:bg-[#131b2e] border-b border-[#c6c6cd] dark:border-[#45464d] flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-xs">
        
        {/* Title & Status Badges */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#00355f] text-white rounded-xl shadow-xs">
            <Users size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-[#191c1e] dark:text-white uppercase tracking-wider">
                Customer Catalogue ({currentCustomer.customerType || currentCustomer.environment || "Retail"})
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#d0e1fb] dark:bg-[#0f4c81] text-[#00355f] dark:text-[#8ebdf9]">
                Environment: {currentCustomer.environment || "Retail"}
              </span>
              {isDirty && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#ffdad6] text-[#ba1a1a] animate-pulse">
                  ● Unsaved Changes
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#515f74] dark:text-[#bec6e0]">
              Central window to create, view, edit, and audit retail customer accounts.
            </p>
          </div>
        </div>

        {/* Action Buttons Toolbar */}
        <div className="flex items-center gap-2">
          
          {/* Record Navigator (< | >) */}
          <div className="flex items-center bg-[#f2f4f6] dark:bg-[#2d3133] border border-[#c6c6cd] dark:border-[#45464d] rounded-xl px-2 py-1 gap-1.5">
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
              {customers.length > 0 ? `${currentIndex + 1} of ${customers.length}` : "0 of 0"}
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
          </div>

          <div className="h-5 w-[1px] bg-[#c6c6cd] dark:bg-[#45464d] mx-1" />

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

          {/* Search Button */}
          <button
            type="button"
            onClick={() => setIsSearchModalOpen(true)}
            data-testid="search-customer-btn"
            className="px-3.5 py-2 bg-white dark:bg-[#2d3133] border border-[#c6c6cd] dark:border-[#45464d] hover:bg-[#eceef0] rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-2xs"
            title="Advanced Customer Search (F2 / Alt+S)"
          >
            <Search size={14} className="text-[#00355f] dark:text-[#8ebdf9]" />
            <span>Search</span>
            <kbd className="text-[9px] px-1 bg-[#f2f4f6] dark:bg-[#191c1e] rounded text-[#76777d]">F2</kbd>
          </button>

          {/* Export Button */}
          <ExportButton
            moduleTitle="Customer Master"
            columns={customerExportColumns}
            data={customers}
            selectedRows={[currentCustomer]}
            totalRecordsCount={customers.length}
            filteredRecordsCount={customers.length}
            companyName="SMRITI Retail"
            onNotification={onNotification}
          />

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

          {/* Delete Button */}
          <button
            type="button"
            onClick={handleDelete}
            className="p-2 border border-[#ba1a1a] text-[#ba1a1a] hover:bg-[#ffdad6] rounded-xl text-xs font-bold transition"
            title="Delete Current Customer Record (Alt+D)"
          >
            <Trash2 size={15} />
          </button>

          {/* View Mode Toggle */}
          <div className="ml-2 flex items-center bg-[#f2f4f6] dark:bg-[#2d3133] p-0.5 rounded-xl border border-[#c6c6cd] dark:border-[#45464d]">
            <button
              type="button"
              onClick={() => setViewMode("catalogue")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition ${
                viewMode === "catalogue"
                  ? "bg-white dark:bg-[#191c1e] text-[#00355f] dark:text-[#8ebdf9] shadow-xs"
                  : "text-[#515f74] dark:text-[#bec6e0]"
              }`}
            >
              <FileText size={13} /> Form
            </button>
            <button
              type="button"
              onClick={() => setViewMode("directory")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition ${
                viewMode === "directory"
                  ? "bg-white dark:bg-[#191c1e] text-[#00355f] dark:text-[#8ebdf9] shadow-xs"
                  : "text-[#515f74] dark:text-[#bec6e0]"
              }`}
            >
              <Grid size={13} /> Directory
            </button>
          </div>

        </div>

      </header>

      {/* ── Main Workspace Body ────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden flex flex-col p-5">
        
        {viewMode === "directory" ? (
          /* Full Customer Directory Grid Mode */
          <div className="flex-1 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded-2xl shadow-xs overflow-hidden flex flex-col">
            <div className="p-4 bg-[#f2f4f6] dark:bg-[#131b2e] border-b border-[#c6c6cd] dark:border-[#45464d] flex items-center justify-between shrink-0">
              <span className="font-bold text-xs uppercase tracking-wider text-[#00355f] dark:text-[#8ebdf9]">
                Customer Master Directory ({customers.length} Accounts)
              </span>
              <button
                type="button"
                onClick={() => setIsSearchModalOpen(true)}
                className="px-3 py-1.5 bg-[#00355f] text-white rounded-lg text-xs font-bold flex items-center gap-1"
              >
                <Search size={12} /> Open Advanced Search Filter
              </button>
            </div>

            <div className="flex-1 overflow-auto">
              <table className="w-full text-left text-xs border-collapse min-w-[800px]">
                <thead className="sticky top-0 bg-[#f7f9fb] dark:bg-[#131b2e] border-b border-[#c6c6cd] dark:border-[#45464d] font-bold text-[10px] uppercase text-[#515f74] dark:text-[#bec6e0]">
                  <tr>
                    <th className="p-3">Customer Code</th>
                    <th className="p-3">Customer Name</th>
                    <th className="p-3">Price Group</th>
                    <th className="p-3">Phone</th>
                    <th className="p-3">City</th>
                    <th className="p-3">Classification</th>
                    <th className="p-3">Loyalty Tier</th>
                    <th className="p-3">Credit Limit</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eceef0] dark:divide-[#2d3133]">
                  {customers.map((c, idx) => (
                    <tr
                      key={c.id || c.code}
                      onClick={() => {
                        setCurrentIndex(idx);
                        setViewMode("catalogue");
                      }}
                      className="hover:bg-[#f7f9fb] dark:hover:bg-[#2d3133] cursor-pointer transition"
                    >
                      <td className="p-3 font-mono font-bold text-[#00355f] dark:text-[#8ebdf9]">{c.code}</td>
                      <td className="p-3 font-bold">{c.name}</td>
                      <td className="p-3 text-[11px]">{c.priceGroup}</td>
                      <td className="p-3 font-mono">{c.phone || "—"}</td>
                      <td className="p-3">{c.mailingAddresses[0]?.city || "Bangalore"}</td>
                      <td className="p-3">{c.religion} • {c.ageGroup}</td>
                      <td className="p-3 font-semibold">{c.loyaltyTier} ({c.loyaltyPointsBalance} pts)</td>
                      <td className="p-3 font-mono font-bold">₹{c.creditLimit.toLocaleString("en-IN")}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#dcfce7] text-[#166534]">
                          {c.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Catalogue 3-Tab View Mode */
          <div className="flex-1 flex flex-col min-h-0">
            
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
                  onOpenMailingModal={() => setIsMailingModalOpen(true)}
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
        )}

      </div>

      {/* ── Sub-Modals ──────────────────────────────────────────────────────── */}
      <SmritiCustomerMailingModal
        isOpen={isMailingModalOpen}
        onClose={() => setIsMailingModalOpen(false)}
        customerName={currentCustomer.name}
        addresses={currentCustomer.mailingAddresses}
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
        customers={customers}
        onSelectCustomer={selected => {
          const idx = customers.findIndex(c => c.id === selected.id || c.code === selected.code);
          if (idx >= 0) setCurrentIndex(idx);
          onNotification?.("Customer Loaded", `Loaded catalogue record for ${selected.name} (${selected.code}).`, "info");
        }}
      />

    </div>
  );
};
