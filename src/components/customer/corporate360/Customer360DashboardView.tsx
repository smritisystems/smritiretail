/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.99.1
 * Created      : 2026-10-25
 * Modified     : 2026-10-26
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Target UI    : Corporate Customer 360 Dashboard View
 * Capability   : withCapability("customer.crud", "CRM")
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Ban, CalendarDays, CreditCard, Loader2, MapPin, PackageCheck, Pencil, Plus, Receipt, RefreshCw, Save, Search, ShoppingCart, Store, Users, X } from "lucide-react";
import { CorporateCustomerTabs } from "./CorporateCustomerTabs.tsx";
import { CorporateTabKey, CorporateCustomer360Data, PsvDetailedItem, PsvQuantityReconciliationPayload, PsvQuantityReconciliationSummary } from "./types.ts";
import { apiFetchV1 } from "../../../lib/apiFetchV1.ts";
import type { CustomerAddressEntry, CustomerDirectoryItem, RetailCustomerRecord } from "../types.ts";
import { SmritiAdvancedCustomerSearchModal } from "../AdvancedCustSearch.tsx";
import { AddEditGstModal, GstRegistrationEntry } from "../corporateWorkspace/AddEditGstModal.tsx";
import { CorporateStoreNetwork } from "./CorporateStoreNetwork.tsx";
import type { CustomerCompanyRelationship } from "../types.ts";
import type { CorporateStoreItem, StoreCodeLookupItem } from "./types.ts";

export interface Customer360DashboardViewProps {
  customerId?: string;
  customer?: any;
  corporate360Data?: CorporateCustomer360Data | null;
  initialPsvItems?: PsvDetailedItem[];
  initialPsvSummary?: PsvQuantityReconciliationSummary | null;
  initialInvoices?: any[];
  initialTab?: CorporateTabKey;
  onSave?: () => void;
  onDeactivate?: () => void;
  onEditCustomer?: (customer: any) => void;
  onCreateCustomer?: () => void;
  onCreateChildCustomer?: () => void;
  onRefresh?: () => Promise<void> | void;
  onManageHierarchy?: () => void;
  onStoreAssigned?: (store: StoreCodeLookupItem) => Promise<void> | void;
  companyRelationships?: CustomerCompanyRelationship[];
  onSaveCompanyRelationship?: (relationshipId: string, updates: Partial<CustomerCompanyRelationship>) => Promise<boolean>;
  onCreateCompanyRelationship?: (relationship: Partial<CustomerCompanyRelationship>) => Promise<boolean>;
  onCustomerChange?: <K extends keyof RetailCustomerRecord>(field: K, value: RetailCustomerRecord[K]) => void;
  onCancelEdit?: () => void;
  onSelectCustomer?: (customer: CustomerDirectoryItem) => void;
  onBack?: () => void;
  isEditing?: boolean;
  isSaving?: boolean;
  isDirty?: boolean;
}

const textValue = (value: unknown): string => {
  if (value === null || value === undefined || value === "") return "Not provided";
  return String(value);
};

const amountValue = (value: unknown): string => {
  if (value === null || value === undefined || value === "") return "Not set";
  const amount = Number(value);
  return Number.isFinite(amount)
    ? new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(amount)
    : String(value);
};

const isDeleted = (item: any): boolean => item?.is_deleted === true || item?.isDeleted === true;
const CUSTOMER_GROUP_OPTIONS = [
  { value: "CG-Retail", label: "Retail customers" },
  { value: "CG-Corporate", label: "Corporate customers" },
  { value: "CG-LargeRetail", label: "Large retail customers" },
  { value: "CG-Branches", label: "Branch accounts" },
  { value: "CG-Franchises", label: "Franchise accounts" },
];
const PAYMENT_CATEGORY_OPTIONS = [
  { value: "CASH", label: "Cash" },
  { value: "CREDIT", label: "Credit" },
  { value: "CARD", label: "Card" },
  { value: "UPI", label: "UPI" },
  { value: "NETBANKING", label: "Net banking" },
  { value: "CHEQUE", label: "Cheque" },
];

const Field: React.FC<{ label: string; value: unknown }> = ({ label, value }) => (
  <div className="min-w-0">
    <dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt>
    <dd className="mt-1 break-words text-sm font-medium text-slate-900 dark:text-white">{textValue(value)}</dd>
  </div>
);

const Section: React.FC<{ title: string; children: React.ReactNode; description?: string }> = ({ title, description, children }) => (
  <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-[#1a202c]">
    <div className="mb-4">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h2>
      {description && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{description}</p>}
    </div>
    {children}
  </section>
);

export const Customer360DashboardView: React.FC<Customer360DashboardViewProps> = ({
  customerId,
  customer: propCustomer,
  corporate360Data,
  initialPsvItems,
  initialPsvSummary,
  initialInvoices,
  initialTab = "overview",
  onSave,
  onDeactivate,
  onEditCustomer,
  onCreateCustomer,
  onCreateChildCustomer,
  onRefresh,
  onManageHierarchy,
  onStoreAssigned,
  companyRelationships = [],
  onSaveCompanyRelationship,
  onCreateCompanyRelationship,
  onCustomerChange,
  onCancelEdit,
  onSelectCustomer,
  onBack,
  isEditing = false,
  isSaving = false,
  isDirty = false,
}) => {
  const customer = propCustomer || corporate360Data?.customer;
  const id = customerId || customer?.id;
  const [activeTab, setActiveTab] = useState<CorporateTabKey>(initialTab || (isEditing ? "basic" : "overview"));
  const [psvSummary, setPsvSummary] = useState<PsvQuantityReconciliationSummary | null>(initialPsvSummary || corporate360Data?.psv_reconciliation?.summary || null);
  const [psvItems, setPsvItems] = useState<PsvDetailedItem[]>(initialPsvItems || corporate360Data?.psv_reconciliation?.items || []);
  const [psvLoading, setPsvLoading] = useState(false);
  const [psvError, setPsvError] = useState<string | null>(null);
  const [psvStatus, setPsvStatus] = useState("all");
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [isGstEditorOpen, setIsGstEditorOpen] = useState(false);
  const [editingGstRegistration, setEditingGstRegistration] = useState<GstRegistrationEntry | null>(null);
  const [gstRegistrationRows, setGstRegistrationRows] = useState<any[]>([]);
  const [gstRegistrationError, setGstRegistrationError] = useState<string | null>(null);
  const [selectedRelationshipId, setSelectedRelationshipId] = useState(() =>
    companyRelationships.find(relationship =>
      !relationship.is_deleted && !relationship.isDeleted && !relationship.id.startsWith("rel-COMP-")
    )?.id || ""
  );
  const [relationshipDraft, setRelationshipDraft] = useState<Partial<CustomerCompanyRelationship>>({});
  const [newRelationshipDraft, setNewRelationshipDraft] = useState<Partial<CustomerCompanyRelationship>>({
    customer_group_id: "CG-Corporate",
    credit_limit: 0,
    credit_days: 0,
    credit_hold: false,
    status: "Active",
  });
  const [isSavingRelationship, setIsSavingRelationship] = useState(false);
  const persistedCompanyRelationships = useMemo(
    () => companyRelationships.filter(
      relationship => !relationship.is_deleted && !relationship.isDeleted && !relationship.id.startsWith("rel-COMP-")
    ),
    [companyRelationships],
  );

  const loadPsv = useCallback(async () => {
    if (!id || initialPsvItems || corporate360Data?.psv_reconciliation) return;
    setPsvLoading(true);
    setPsvError(null);
    try {
      const query = new URLSearchParams({ customer_id: String(id), limit: "500" });
      const response = await apiFetchV1<PsvQuantityReconciliationPayload>(`/psv/reconciliation?${query.toString()}`);
      setPsvSummary(response?.summary || null);
      setPsvItems(response?.items || []);
    } catch (error: any) {
      setPsvError(error?.message || "PSV reconciliation could not be loaded.");
    } finally {
      setPsvLoading(false);
    }
  }, [id, initialPsvItems, corporate360Data?.psv_reconciliation]);

  const loadGstRegistrations = useCallback(async () => {
    if (!id || id.startsWith("cust-draft-")) {
      setGstRegistrationRows([]);
      setGstRegistrationError(null);
      return;
    }
    try {
      const registrations = await apiFetchV1<any[]>(`/crm/customers/${encodeURIComponent(id)}/gst-registrations?includeInactive=true`);
      setGstRegistrationRows(Array.isArray(registrations) ? registrations : []);
      setGstRegistrationError(null);
    } catch (error: any) {
      setGstRegistrationError(error?.message || "GST registrations could not be loaded.");
    }
  }, [id]);

  useEffect(() => {
    setActiveTab(initialTab || (isEditing ? "basic" : "overview"));
  }, [initialTab, id]);

  useEffect(() => {
    if (activeTab === "psv" || activeTab === "overview") loadPsv();
  }, [activeTab, loadPsv]);

  useEffect(() => {
    if (activeTab === "corporate_tax") void loadGstRegistrations();
  }, [activeTab, loadGstRegistrations]);

  useEffect(() => {
    if (isEditing && customer?.id?.startsWith("cust-draft-")) setActiveTab("basic");
  }, [customer?.id, isEditing]);

  useEffect(() => {
    const activeRelationship = persistedCompanyRelationships.find(relationship => relationship.id === selectedRelationshipId)
      || persistedCompanyRelationships[0];
    if (activeRelationship) {
      setSelectedRelationshipId(activeRelationship.id);
      setRelationshipDraft({ ...activeRelationship });
    } else {
      setSelectedRelationshipId("");
      setRelationshipDraft({});
    }
  }, [persistedCompanyRelationships, selectedRelationshipId]);

  const stores = useMemo(() => {
    if (corporate360Data?.store_network && corporate360Data.store_network.length > 0) return corporate360Data.store_network;
    const directLocations = (customer?.delivery_locations || customer?.deliveryLocations || [])
      .filter((location: any) => !isDeleted(location))
      .map((location: any) => ({
        id: location.id,
        store_code: location.store_code || location.storeCode,
        store_name: location.location_name || location.locationName || location.name,
        city: location.city,
        state: location.state,
        store_type: location.location_type || location.locationType || "Store",
        status: location.status || ((location.is_active ?? location.isActive) === false ? "Inactive" : "Active"),
      }));
    if (directLocations.length > 0) return directLocations;

    // Subordinate child branch stores (consistent with Customer Master)
    return (customer?.dependants || customer?.children || [])
      .filter((row: any) => !isDeleted(row))
      .map((dep: any, idx: number) => ({
        id: dep.dependantCustomerId || dep.dependant_customer_id || dep.id || String(idx + 1),
        store_code: dep.dependantCustomerCode || dep.dependant_customer_code || dep.code || "—",
        store_name: dep.dependantCustomerName || dep.dependant_customer_name || dep.name || "Child Store",
        city: dep.dependantCustomerCity || dep.dependant_customer_city || dep.city || "—",
        state: dep.dependantCustomerState || dep.dependant_customer_state || dep.state || "—",
        store_type: "Branch Outlet",
        status: dep.dependantCustomerStatus || dep.status || "Active",
      }));
  }, [corporate360Data?.store_network, customer]);

  const children = useMemo(() => {
    const rows = customer?.dependants || customer?.children || [];
    return Array.isArray(rows) ? rows.filter((row: any) => !isDeleted(row)) : [];
  }, [customer]);

  const invoices = initialInvoices || corporate360Data?.sales_invoices || corporate360Data?.recent_orders || customer?.invoices || [];
  const activeStores = stores.filter((store: any) => String(store.status || "").toLowerCase() === "active").length;
  const isDraft = customer?.id?.startsWith("cust-draft-") === true;
  const status = isDraft
    ? "Draft"
    : String(customer?.status || ((customer?.is_active ?? customer?.isActive) === false ? "Inactive" : "Active"));
  const isActive = !isDraft && status.toLowerCase() === "active";
  const creditHold = Boolean(customer?.credit_hold ?? customer?.creditHold);
  const pendingPsvQty = psvSummary?.total_pending_approval_qty ?? 0;
  const displayName = customer?.display_name || customer?.displayName || customer?.name;
  const customerInitials = String(displayName || customer?.code || "C")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part: string) => part.charAt(0))
    .join("")
    .toUpperCase();
  const kpis = corporate360Data?.kpis;
  const availableMetric = (value: unknown, formatter: (input: unknown) => string = textValue): string =>
    value === null || value === undefined || value === "" || value === "—" ? "Not available" : formatter(value);
  const gstRegistrations = (customer?.gst_registrations || customer?.gstRegistrations || []).filter((row: any) => !isDeleted(row));
  const billingLocations = (customer?.billing_locations || customer?.billingLocations || []).filter((row: any) => !isDeleted(row));
  const deliveryLocations = (customer?.delivery_locations || customer?.deliveryLocations || []).filter((row: any) => !isDeleted(row));
  const filteredPsvItems = psvStatus === "all" ? psvItems : psvItems.filter((row) => {
    switch (psvStatus) {
      case "approved": return row.approved_qty > 0 && row.pending_approval_qty === 0;
      case "pending": return row.pending_approval_qty > 0;
      case "shortage": return row.short_qty > 0;
      case "excess": return row.excess_qty > 0;
      case "rejected": return row.rejected_qty > 0;
      default: return true;
    }
  });
  const mailingAddresses: CustomerAddressEntry[] = customer?.mailingAddresses || [];
  const updateMailingAddress = (addressIndex: number, field: keyof CustomerAddressEntry, value: any) => {
    const updated = mailingAddresses.map((address, index) =>
      index === addressIndex ? { ...address, [field]: value } : address
    );
    if (field === "isDefault" && value) {
      updated.forEach((address, index) => {
        address.isDefault = index === addressIndex;
      });
    }
    onCustomerChange?.("mailingAddresses", updated);
  };
  const addMailingAddress = () => {
    const address: CustomerAddressEntry = {
      code: String(mailingAddresses.length + 1).padStart(3, "0"),
      contactPerson: customer?.name || "",
      addressType: mailingAddresses.length ? "billing" : "mailing",
      address1: "",
      address2: "",
      address3: "",
      address4: "",
      address5: "",
      locality: "",
      city: "",
      postalCode: "",
      state: "",
      zone: "",
      country: "India",
      officePhone: "",
      homePhone: "",
      mobilePhone: "",
      faxNumber: "",
      email1: "",
      email2: "",
      email3: "",
      isDefault: mailingAddresses.length === 0,
    };
    onCustomerChange?.("mailingAddresses", [...mailingAddresses, address]);
  };
  const removeMailingAddress = (addressIndex: number) => {
    const address = mailingAddresses[addressIndex];
    if (address?.id && !window.confirm("Remove this saved address? It will be deactivated when you save the customer.")) return;
    const updated = mailingAddresses.filter((_, index) => index !== addressIndex);
    if (updated.length && !updated.some(item => item.isDefault)) updated[0].isDefault = true;
    onCustomerChange?.("mailingAddresses", updated);
  };

  const saveGstRegistration = async (entry: GstRegistrationEntry) => {
    if (!id || id.startsWith("cust-draft-")) {
      setGstRegistrationError("Save the customer profile before adding an additional GST registration.");
      return;
    }
    setGstRegistrationError(null);
    try {
      const payload = {
        gstin: entry.gstin,
        stateName: entry.state,
        stateCode: entry.stateCode,
        registrationType: entry.registrationType.toUpperCase(),
        isPrimary: Boolean(entry.isPrimary),
        status: entry.status === "Active" ? "ACTIVE" : "CANCELLED",
      };
      const saved = entry.id && !entry.id.startsWith("gst-reg-")
        ? await apiFetchV1<any>(`/crm/customers/${encodeURIComponent(id)}/gst-registrations/${encodeURIComponent(entry.id)}`, {
            method: "PUT",
            body: payload,
          })
        : await apiFetchV1<any>(`/crm/customers/${encodeURIComponent(id)}/gst-registrations`, {
            method: "POST",
            body: payload,
          });
      if (entry.isPrimary && saved?.id) {
        await apiFetchV1(`/crm/customers/${encodeURIComponent(id)}/gst-registrations/${encodeURIComponent(saved.id)}/primary`, {
          method: "PUT",
        });
      }
      await loadGstRegistrations();
      await onRefresh?.();
    } catch (error: any) {
      setGstRegistrationError(error?.message || "GST registration could not be saved.");
    }
  };

  const deactivateGstRegistration = async (registrationId: string) => {
    if (!id || !window.confirm("Deactivate this GST registration? Historical invoices will remain unchanged.")) return;
    setGstRegistrationError(null);
    try {
      await apiFetchV1(`/crm/customers/${encodeURIComponent(id)}/gst-registrations/${encodeURIComponent(registrationId)}`, {
        method: "DELETE",
      });
      await loadGstRegistrations();
      await onRefresh?.();
    } catch (error: any) {
      setGstRegistrationError(error?.message || "GST registration could not be deactivated.");
    }
  };

  const saveCompanyRelationship = async () => {
    if (!selectedRelationshipId || !onSaveCompanyRelationship) return;
    setIsSavingRelationship(true);
    try {
      await onSaveCompanyRelationship(selectedRelationshipId, relationshipDraft);
    } finally {
      setIsSavingRelationship(false);
    }
  };

  const createCompanyRelationship = async () => {
    if (!onCreateCompanyRelationship) return;
    setIsSavingRelationship(true);
    try {
      const created = await onCreateCompanyRelationship(newRelationshipDraft);
      if (created) setNewRelationshipDraft({
        customer_group_id: "CG-Corporate",
        credit_limit: 0,
        credit_days: 0,
        credit_hold: false,
        status: "Active",
      });
    } finally {
      setIsSavingRelationship(false);
    }
  };

  if (!customer) {
    return <div className="p-6 text-sm text-slate-600 dark:text-slate-300">Customer details are unavailable. Return to Customer Master and open a customer record.</div>;
  }

  const openTab = (tab: CorporateTabKey) => {
    setActiveTab(tab);
    window.scrollTo?.({ top: 0, behavior: "smooth" });
  };

  return (
    <main className="min-h-full bg-slate-50 p-4 text-slate-900 dark:bg-[#111827] dark:text-slate-100 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-[#1a202c]">
          <div className="flex min-w-0 items-center gap-3">
            <div aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sm font-bold text-sky-800 dark:bg-sky-950 dark:text-sky-200">{customerInitials}</div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-lg font-semibold">{customer.id?.startsWith("cust-draft-") ? "New customer" : textValue(displayName)}</h1>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${isActive ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200"}`}>{status}</span>
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">{textValue(customer.code)}</span>
                <span className="mx-1.5">·</span>{textValue(customer.customer_type || customer.customerType || "Customer")}
                {(customer.mobile || customer.phone) && <><span className="mx-1.5">·</span>{textValue(customer.mobile || customer.phone)}</>}
                {customer.email && <><span className="mx-1.5">·</span>{textValue(customer.email)}</>}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {!isEditing && onCreateCustomer && <button type="button" onClick={onCreateCustomer} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium dark:border-slate-700"><Plus size={15} />New customer</button>}
            {!isEditing && onSelectCustomer && <button type="button" onClick={() => setShowCustomerSearch(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium dark:border-slate-700"><Search size={15} />Search customer</button>}
            {onBack && <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium dark:border-slate-700"><ArrowLeft size={15} />Back</button>}
            {!isEditing && onEditCustomer && <button type="button" onClick={() => onEditCustomer(customer)} className="inline-flex items-center gap-1.5 rounded-lg border border-sky-300 px-3 py-2 text-sm font-semibold text-sky-800 dark:border-sky-800 dark:text-sky-200"><Pencil size={15} />Edit customer</button>}
            {isEditing && onSave && <button type="button" onClick={onSave} disabled={isSaving || !isDirty} className="inline-flex items-center gap-1.5 rounded-lg bg-sky-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">{isSaving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}Save changes</button>}
            {isEditing && onCancelEdit && <button type="button" onClick={onCancelEdit} disabled={isSaving} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium disabled:opacity-60 dark:border-slate-700"><X size={15} />Cancel</button>}
            {!isEditing && isActive && onDeactivate && <button type="button" onClick={onDeactivate} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 px-3 py-2 text-sm font-medium text-rose-700 dark:border-rose-900 dark:text-rose-300"><Ban size={15} />Deactivate</button>}
          </div>
        </header>

        {onSelectCustomer && <SmritiAdvancedCustomerSearchModal
          isOpen={showCustomerSearch}
          onClose={() => setShowCustomerSearch(false)}
          onSelectCustomer={selectedCustomer => {
            onSelectCustomer(selectedCustomer);
            setShowCustomerSearch(false);
          }}
        />}

        {isEditing && <div role="status" className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-100">
          Editing is enabled across customer master tabs. Use <strong>Save changes</strong> for profile and address fields; GST registrations, store addresses, and company credit terms have their own save actions. Invoices and PSV results stay read-only.
        </div>}
        <CorporateCustomerTabs activeTab={activeTab} onTabChange={openTab} />

        {isEditing && activeTab === "overview" && <Section title="Customer overview" description="This tab contains calculated balances and activity, not editable master fields.">
          <p className="text-sm text-slate-600 dark:text-slate-300">Choose Basic Details, Corporate &amp; Tax, Addresses, Parent – Child, Stores / Outlets, or Commercial Terms to add or edit customer information. Financial and stock history remains read-only.</p>
        </Section>}

        {isEditing && activeTab === "basic" && <Section title="Basic customer details" description="Edit customer identity and contact information. Save changes to apply these profile fields.">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <EditInput label="Customer name" value={customer.name} required onChange={value => onCustomerChange?.("name", value)} />
            <EditSelect label="Customer type" value={customer.customerType || customer.customer_type || "Retail"} options={["Retail", "Corporate", "VIP", "Wholesale", "Distribution", "Walk-In", "Institutional / Government"]} onChange={value => onCustomerChange?.("customerType", value)} />
            <EditSelect label="Customer group" value={customer.customerGroupId || customer.customer_group_id || "CG-Retail"} options={CUSTOMER_GROUP_OPTIONS} onChange={value => onCustomerChange?.("customerGroupId", value)} />
            <EditInput label="Mobile number" value={customer.phone || customer.mobile} onChange={value => onCustomerChange?.("phone", value)} />
            <EditInput label="Email" value={customer.email} type="email" onChange={value => onCustomerChange?.("email", value)} />
            <EditInput label="Company code" value={customer.companyCode || customer.company_code} onChange={value => onCustomerChange?.("companyCode", value)} />
            <EditSelect label="Business environment" value={customer.environment || "Retail"} options={["Retail", "Distribution", "Warehouse", "Corporate"]} onChange={value => onCustomerChange?.("environment", value)} />
            <div className="sm:col-span-2 lg:col-span-3"><EditTextarea label="Internal customer notes" value={customer.profileNotes || customer.profile_notes} onChange={value => onCustomerChange?.("profileNotes", value)} /></div>
            <div className="sm:col-span-2 lg:col-span-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-300">
              Customer code: <strong>{customer.code || "Assigned after save"}</strong>. Account status changes use the separate deactivate/reactivate workflow so they remain auditable.
            </div>
          </div>
        </Section>}

        {isEditing && activeTab === "corporate_tax" && <div className="space-y-4">
          <Section title="Legal and tax identity" description="Customer name is the legal name of record; tax identifiers are validated before saving.">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <EditInput label="Customer / legal name" value={customer.name} required onChange={value => onCustomerChange?.("name", value)} />
              <EditInput label="Primary GSTIN" value={customer.gstin || customer.gst_number || customer.gstNumber} onChange={value => onCustomerChange?.("gstin", value.toUpperCase())} />
              <EditInput label="PAN" value={customer.panNumber || customer.pan_number || customer.pan} onChange={value => onCustomerChange?.("panNumber", value.toUpperCase())} />
              <EditInput label="LST number" value={customer.lstNumber || customer.lst_number} onChange={value => onCustomerChange?.("lstNumber", value)} />
              <EditInput label="LST date" value={customer.lstDate || customer.lst_date} type="date" onChange={value => onCustomerChange?.("lstDate", value)} />
              <EditInput label="CST number" value={customer.cstNumber || customer.cst_number} onChange={value => onCustomerChange?.("cstNumber", value)} />
              <EditInput label="CST date" value={customer.cstDate || customer.cst_date} type="date" onChange={value => onCustomerChange?.("cstDate", value)} />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <EditCheckbox label="Pre-sale form required" checked={Boolean(customer.isPreSaleFormApplicable ?? customer.is_pre_sale_form_applicable)} onChange={value => onCustomerChange?.("isPreSaleFormApplicable", value)} />
              {Boolean(customer.isPreSaleFormApplicable ?? customer.is_pre_sale_form_applicable) && <EditInput label="Pre-sale form name" value={customer.preSaleFormName || customer.pre_sale_form_name} onChange={value => onCustomerChange?.("preSaleFormName", value)} />}
              <EditCheckbox label="Post-sale form required" checked={Boolean(customer.isPostSaleFormApplicable ?? customer.is_post_sale_form_applicable)} onChange={value => onCustomerChange?.("isPostSaleFormApplicable", value)} />
              {Boolean(customer.isPostSaleFormApplicable ?? customer.is_post_sale_form_applicable) && <EditInput label="Post-sale form name" value={customer.postSaleFormName || customer.post_sale_form_name} onChange={value => onCustomerChange?.("postSaleFormName", value)} />}
            </div>
          </Section>
          <Section title="GST registrations by state" description="Add, edit, or deactivate registrations with the GST registration API.">
            {gstRegistrationError && <p role="alert" className="mb-3 text-sm text-rose-700 dark:text-rose-300">{gstRegistrationError}</p>}
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-slate-500">Customer-level GSTIN and PAN changes are saved with the profile. Registration rows are saved separately.</p>
              <button type="button" disabled={!id || id.startsWith("cust-draft-")} onClick={() => { setEditingGstRegistration(null); setIsGstEditorOpen(true); }} className="rounded-lg bg-sky-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"><Plus size={14} className="mr-1 inline" />Add GST registration</button>
            </div>
            {id?.startsWith("cust-draft-") && <p className="mb-3 text-xs text-amber-800 dark:text-amber-200">Save the customer profile before adding additional state registrations.</p>}
            {gstRegistrationRows.length ? <DataTable headers={["GSTIN", "State", "Type", "Status", "Primary", "Actions"]} rows={gstRegistrationRows.map((row: any) => [
              row.gstin,
              row.state_name || row.stateName || row.state_code || row.stateCode,
              row.registration_type || row.registrationType,
              row.status,
              (row.is_primary ?? row.isPrimary) ? "Yes" : "No",
              <span className="inline-flex gap-2" key={row.id}>
                <button type="button" onClick={() => { setEditingGstRegistration({ id: row.id, gstin: row.gstin, state: row.state_name || row.stateName || "", stateCode: row.state_code || row.stateCode, registrationType: row.registration_type || row.registrationType || "Regular", status: String(row.status).toUpperCase() === "ACTIVE" ? "Active" : "Inactive", isPrimary: Boolean(row.is_primary ?? row.isPrimary) }); setIsGstEditorOpen(true); }} className="font-semibold text-sky-700 underline dark:text-sky-300">Edit</button>
                <button type="button" onClick={() => void deactivateGstRegistration(String(row.id))} className="font-semibold text-rose-700 underline dark:text-rose-300">Deactivate</button>
              </span>,
            ])} /> : <Empty>No GST registrations are recorded.</Empty>}
          </Section>
        </div>}

        {isEditing && activeTab === "addresses" && <Section title="Customer addresses" description="Edit or add mailing, billing, and shipping locations here. Changes are saved with the customer profile; removed saved addresses are deactivated, not erased.">
          <div className="mb-4 flex justify-end"><button type="button" onClick={addMailingAddress} className="inline-flex items-center gap-1.5 rounded-lg bg-sky-700 px-3 py-2 text-sm font-semibold text-white"><Plus size={14} />Add address</button></div>
          {mailingAddresses.length ? <div className="space-y-4">{mailingAddresses.map((address, addressIndex) => <div key={address.id || address.code || addressIndex} className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-semibold">{address.locationName || `${address.addressType || "Customer"} address ${addressIndex + 1}`}</h3>
              <div className="flex items-center gap-3">
                <label className="inline-flex items-center gap-2 text-xs"><input type="radio" name="primary-customer-address" checked={Boolean(address.isDefault)} onChange={() => updateMailingAddress(addressIndex, "isDefault", true)} />Primary address</label>
                <button type="button" onClick={() => removeMailingAddress(addressIndex)} className="text-xs font-semibold text-rose-700 underline dark:text-rose-300">Remove</button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <EditSelect label="Address purpose" value={address.addressType || "mailing"} options={[{ value: "mailing", label: "Mailing" }, { value: "billing", label: "Billing" }, { value: "shipping", label: "Shipping / delivery" }]} onChange={value => updateMailingAddress(addressIndex, "addressType", value as "mailing" | "billing" | "shipping")} />
              <EditInput label="Location name" value={address.locationName} onChange={value => updateMailingAddress(addressIndex, "locationName", value)} />
              <EditInput label="Store code" value={address.storeCode} onChange={value => updateMailingAddress(addressIndex, "storeCode", value)} />
              <EditInput label="Billing store code" value={address.billingStoreCode} onChange={value => updateMailingAddress(addressIndex, "billingStoreCode", value)} />
              <EditInput label="Shipping store code" value={address.shippingStoreCode} onChange={value => updateMailingAddress(addressIndex, "shippingStoreCode", value)} />
              <EditInput label="Contact person" value={address.contactPerson} onChange={value => updateMailingAddress(addressIndex, "contactPerson", value)} />
              <EditInput label="Address line 1" value={address.address1} onChange={value => updateMailingAddress(addressIndex, "address1", value)} />
              <EditInput label="Address line 2" value={address.address2} onChange={value => updateMailingAddress(addressIndex, "address2", value)} />
              <EditInput label="Address line 3" value={address.address3} onChange={value => updateMailingAddress(addressIndex, "address3", value)} />
              <EditInput label="Address line 4" value={address.address4} onChange={value => updateMailingAddress(addressIndex, "address4", value)} />
              <EditInput label="Address line 5" value={address.address5} onChange={value => updateMailingAddress(addressIndex, "address5", value)} />
              <EditInput label="Locality" value={address.locality} onChange={value => updateMailingAddress(addressIndex, "locality", value)} />
              <EditInput label="City" value={address.city} onChange={value => updateMailingAddress(addressIndex, "city", value)} />
              <EditInput label="State" value={address.state} onChange={value => updateMailingAddress(addressIndex, "state", value)} />
              <EditInput label="State code" value={address.stateCode} onChange={value => updateMailingAddress(addressIndex, "stateCode", value)} />
              <EditInput label="PIN code" value={address.postalCode} onChange={value => updateMailingAddress(addressIndex, "postalCode", value)} />
              <EditInput label="Country" value={address.country} onChange={value => updateMailingAddress(addressIndex, "country", value)} />
              <EditInput label="GSTIN" value={address.gstin} onChange={value => updateMailingAddress(addressIndex, "gstin", value.toUpperCase())} />
              <EditInput label="GST registration ID" value={address.gstRegistrationId} onChange={value => updateMailingAddress(addressIndex, "gstRegistrationId", value)} />
              <EditInput label="Mobile" value={address.mobilePhone} onChange={value => updateMailingAddress(addressIndex, "mobilePhone", value)} />
              <EditInput label="Email" value={address.email1} type="email" onChange={value => updateMailingAddress(addressIndex, "email1", value)} />
            </div>
          </div>)}</div> : <Empty>No addresses are recorded. Add an address to start.</Empty>}
        </Section>}

        {isEditing && activeTab === "parent_child" && <div className="space-y-4">
          <Section title="Customer relationships" description="Create a child account or open an existing child to edit its profile. Use Manage hierarchy to reassign linked accounts.">
            <div className="mb-4 flex flex-wrap justify-end gap-2">
              {onManageHierarchy && <button type="button" onClick={onManageHierarchy} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold dark:border-slate-700">Manage hierarchy</button>}
              {onCreateChildCustomer && <button type="button" onClick={onCreateChildCustomer} className="inline-flex items-center gap-1.5 rounded-lg bg-sky-700 px-3 py-2 text-sm font-semibold text-white"><Plus size={14} />Add child customer</button>}
            </div>
            {children.length ? <DataTable headers={["Customer code", "Customer", "Status", "Actions"]} rows={children.map((row: any) => [
              row.dependant_customer_code || row.dependantCustomerCode || row.customer_code || row.customerCode || row.code || "—",
              row.dependant_customer_name || row.dependantCustomerName || row.customer_name || row.customerName || row.name || "Child Account",
              row.dependant_customer_status || row.dependantCustomerStatus || row.status || "Active",
              row.dependant_customer_id || row.dependantCustomerId || row.customer_id || row.customerId || row.id
                ? <button type="button" key={row.id} onClick={() => onSelectCustomer?.({
                    id: String(row.dependant_customer_id || row.dependantCustomerId || row.customer_id || row.customerId || row.id),
                    code: row.dependant_customer_code || row.dependantCustomerCode || row.customer_code || row.customerCode || row.code || null,
                    name: row.dependant_customer_name || row.dependantCustomerName || row.customer_name || row.customerName || row.name || "Child Account",
                    mobile: row.mobile || row.phone || null,
                    customer_group_id: row.customer_group_id || null,
                    customer_group_name: row.customer_group_name || null,
                    status: row.status || "Active",
                    is_active: String(row.status || "Active").toLowerCase() === "active",
                    is_dependant: true,
                    parent_customer_id: String(id || ""),
                    relationship_type: "child",
                  })} className="font-semibold text-sky-700 underline dark:text-sky-300">Open and edit</button>
                : "—",
            ])} /> : <Empty>This customer has no linked child accounts.</Empty>}
            <EditCheckbox label="Show child customers in billing" checked={Boolean(customer.show_child_customers_in_billing || customer.showChildCustomersInBilling)} onChange={value => onCustomerChange?.("showChildCustomersInBilling", value)} />
          </Section>
        </div>}

        {activeTab === "stores" && <Section title="Stores and outlets" description={isEditing ? "Add stores and manage store addresses while edit mode is enabled. Store codes are canonical identifiers." : "Customer delivery locations and store network."}>
          <CorporateStoreNetwork
            stores={stores.map((store: any, index: number): CorporateStoreItem => ({
              id: String(store.id || store.store_code || store.storeCode || index),
              store_code: String(store.store_code || store.storeCode || "—"),
              store_name: String(store.store_name || store.storeName || store.name || "Store"),
              city: String(store.city || "—"),
              state: String(store.state || ""),
              store_type: String(store.store_type || store.storeType || "Store"),
              status: String(store.status || "Active"),
              psv_value: Number(store.psv_value || store.psvValue || 0),
              psv_value_display: store.psv_value_display || store.psvValueDisplay,
              psv_status: store.psv_status || store.psvStatus,
              contact_person: store.contact_person || store.contactPerson,
              phone: store.phone,
              email: store.email,
              address_summary: store.address_summary || store.addressSummary,
              addresses: store.addresses || [],
            }))}
            customerId={id}
            customerName={String(displayName || "")}
            isEditing={isEditing}
            onStoreAssigned={onStoreAssigned}
            onStoreUpdated={onRefresh}
          />
        </Section>}

        {isEditing && activeTab === "commercial" && <div className="space-y-4">
          <Section title="Sales and payment preferences" description="These customer-level preferences save with the profile. Credit limits and holds are company-specific terms below.">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <EditSelect label="Payment category" value={customer.paymentCategory || customer.payment_category || "CASH"} options={PAYMENT_CATEGORY_OPTIONS} onChange={value => onCustomerChange?.("paymentCategory", value)} />
              <EditInput label="Payment terms" value={customer.paymentTerm || customer.payment_term} onChange={value => onCustomerChange?.("paymentTerm", value)} />
              <EditInput label="Default sales channel" value={customer.defaultSalesChannel || customer.default_sales_channel} onChange={value => onCustomerChange?.("defaultSalesChannel", value)} />
              <EditSelect label="Pricing basis" value={customer.pricingBasis || customer.pricing_basis || "MRP"} options={["MRP", "RATE"]} onChange={value => onCustomerChange?.("pricingBasis" as any, value as any)} />
              <EditInput label="Transport mode" value={customer.transportMode || customer.transport_mode} onChange={value => onCustomerChange?.("transportMode", value)} />
              <EditInput label="Transport code" value={customer.transportCode || customer.transport_code} onChange={value => onCustomerChange?.("transportCode", value)} />
              <EditInput label="Transit days" value={customer.transitDays || customer.transit_days} type="number" onChange={value => onCustomerChange?.("transitDays", Number(value))} />
              <EditInput label="Bank code" value={customer.bankCode || customer.bank_code} onChange={value => onCustomerChange?.("bankCode", value)} />
              <EditInput label="Bank location" value={customer.bankLocation || customer.bank_location} onChange={value => onCustomerChange?.("bankLocation", value)} />
              <EditInput label="Retail factor" value={customer.retailFactor ?? customer.retail_factor} type="number" onChange={value => onCustomerChange?.("retailFactor", Number(value))} />
              <EditInput label="Dealer factor" value={customer.dealerFactor ?? customer.dealer_factor} type="number" onChange={value => onCustomerChange?.("dealerFactor", Number(value))} />
              <EditInput label="Destination tax type" value={customer.destinationTaxType || customer.destination_tax_type} onChange={value => onCustomerChange?.("destinationTaxType", value)} />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <EditCheckbox label="Require purchase order number" checked={Boolean(customer.requirePoNumber ?? customer.require_po_number)} onChange={value => onCustomerChange?.("requirePoNumber", value)} />
              <EditCheckbox label="Allow cash billing" checked={Boolean(customer.allowCashBill ?? customer.allow_cash_bill)} onChange={value => onCustomerChange?.("allowCashBill", value)} />
              <EditCheckbox label="Allow credit invoices" checked={Boolean(customer.allowCreditInvoice ?? customer.allow_credit_invoice)} onChange={value => onCustomerChange?.("allowCreditInvoice", value)} />
              <EditCheckbox label="Allow delivery challan" checked={Boolean(customer.allowDcGen ?? customer.allow_dc_gen)} onChange={value => onCustomerChange?.("allowDcGen", value)} />
              <EditCheckbox label="Allow miscellaneous issues" checked={Boolean(customer.allowMiscIssue ?? customer.allow_misc_issue)} onChange={value => onCustomerChange?.("allowMiscIssue", value)} />
              <EditCheckbox label="Allow miscellaneous receipts" checked={Boolean(customer.allowMiscReceipts ?? customer.allow_misc_receipts)} onChange={value => onCustomerChange?.("allowMiscReceipts", value)} />
              <EditCheckbox label="Allow promotions on rate" checked={Boolean(customer.allowPromotionsOnRate ?? customer.allow_promotions_on_rate)} onChange={value => onCustomerChange?.("allowPromotionsOnRate", value)} />
              <EditCheckbox label="Prices include tax" checked={Boolean(customer.isTaxInclusive ?? customer.is_tax_inclusive)} onChange={value => onCustomerChange?.("isTaxInclusive", value)} />
            </div>
            <dl className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-700">
              <Field label="Credit ledger balance (read-only)" value={amountValue(customer.credit_used ?? customer.creditUsed ?? customer.outstanding)} />
            </dl>
          </Section>
          <Section title="Company-specific commercial terms" description="Credit limit, credit days, and credit hold are saved per operating company, not as customer profile fields.">
            {persistedCompanyRelationships.length > 0 && <div className="mb-4 max-w-md">
              <EditSelect label="Operating company" value={selectedRelationshipId} options={persistedCompanyRelationships.map(row => row.id)} onChange={setSelectedRelationshipId} />
            </div>}
            {selectedRelationshipId && <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <EditSelect label="Customer group for this company" value={relationshipDraft.customer_group_id || relationshipDraft.customerGroupId || ""} options={CUSTOMER_GROUP_OPTIONS} onChange={value => setRelationshipDraft(prev => ({ ...prev, customer_group_id: value }))} />
              <EditInput label="Credit limit" value={relationshipDraft.credit_limit ?? relationshipDraft.creditLimit} type="number" onChange={value => setRelationshipDraft(prev => ({ ...prev, credit_limit: Number(value) }))} />
              <EditInput label="Credit days" value={relationshipDraft.credit_days ?? relationshipDraft.creditDays} type="number" onChange={value => setRelationshipDraft(prev => ({ ...prev, credit_days: Number(value) }))} />
              <EditSelect label="Credit hold" value={Boolean(relationshipDraft.credit_hold ?? relationshipDraft.creditHold) ? "On hold" : "Not on hold"} options={["Not on hold", "On hold"]} onChange={value => setRelationshipDraft(prev => ({ ...prev, credit_hold: value === "On hold" }))} />
              <EditSelect label="Relationship status" value={relationshipDraft.status || "Active"} options={["Active", "Inactive"]} onChange={value => setRelationshipDraft(prev => ({ ...prev, status: value }))} />
              <div className="flex items-end"><button type="button" onClick={() => void saveCompanyRelationship()} disabled={isSavingRelationship || !onSaveCompanyRelationship} className="rounded-lg bg-sky-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{isSavingRelationship ? "Saving…" : "Save company terms"}</button></div>
            </div>}
            {!selectedRelationshipId && <Empty>No company relationship is configured for this customer.</Empty>}
            {id && !id.startsWith("cust-draft-") && onCreateCompanyRelationship && <div className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-700">
              <h3 className="mb-3 text-sm font-semibold">Add company relationship</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <EditInput label="Operating company ID" value={newRelationshipDraft.company_id || newRelationshipDraft.companyId} onChange={value => setNewRelationshipDraft(prev => ({ ...prev, company_id: value }))} />
                <EditSelect label="Customer group" value={newRelationshipDraft.customer_group_id || newRelationshipDraft.customerGroupId || "CG-Corporate"} options={CUSTOMER_GROUP_OPTIONS} onChange={value => setNewRelationshipDraft(prev => ({ ...prev, customer_group_id: value }))} />
                <EditInput label="Credit limit" value={newRelationshipDraft.credit_limit ?? newRelationshipDraft.creditLimit} type="number" onChange={value => setNewRelationshipDraft(prev => ({ ...prev, credit_limit: Number(value) }))} />
                <EditInput label="Credit days" value={newRelationshipDraft.credit_days ?? newRelationshipDraft.creditDays} type="number" onChange={value => setNewRelationshipDraft(prev => ({ ...prev, credit_days: Number(value) }))} />
                <div className="flex items-end"><button type="button" onClick={() => void createCompanyRelationship()} disabled={isSavingRelationship || !String(newRelationshipDraft.company_id || newRelationshipDraft.companyId || "").trim()} className="rounded-lg bg-sky-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{isSavingRelationship ? "Saving…" : "Add company terms"}</button></div>
              </div>
            </div>}
            {id?.startsWith("cust-draft-") && <p className="mt-3 text-xs text-amber-800 dark:text-amber-200">Save this customer first, then add company-specific credit terms.</p>}
          </Section>
        </div>}

        {!isEditing && activeTab === "overview" && <div className="space-y-4">
          {isDirty && <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"><strong>Changes are not saved.</strong><span className="ml-1">Use “Save changes” above to persist the customer update.</span></div>}
          {!isActive && <div role="status" className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100"><strong>New billing is blocked.</strong><span className="ml-1">This customer is {status.toLowerCase()}. Review the account in Customer Master if its status needs to change.</span></div>}
          {creditHold && <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"><strong>Credit invoices are on hold.</strong><span className="ml-1">Review the customer’s company commercial terms before processing a credit sale.</span><button type="button" onClick={() => openTab("commercial")} className="ml-2 font-semibold underline">Review terms</button></div>}
          {pendingPsvQty > 0 && <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"><div><strong>{pendingPsvQty.toLocaleString("en-IN")} units await PSV approval.</strong><span className="ml-1">Unapproved receipts are not included in approved stock.</span></div><button type="button" onClick={() => openTab("psv")} className="rounded-lg border border-amber-500 px-3 py-2 font-semibold">Review reconciliation</button></div>}
          {psvError && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100"><span><strong>PSV status could not be loaded.</strong><span className="ml-1">{psvError}</span></span><button type="button" onClick={() => openTab("psv")} className="font-semibold underline">Review PSV data</button></div>}

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric icon={<ShoppingCart size={18} />} label="Total purchases" value={availableMetric(kpis?.total_purchase_value, amountValue)} onClick={() => openTab("sales_invoices")} />
            <Metric icon={<CreditCard size={18} />} label="Outstanding balance" value={availableMetric(customer.outstanding ?? customer.customer_outstanding, amountValue)} onClick={() => openTab("sales_invoices")} />
            <Metric icon={<Receipt size={18} />} label="Invoices" value={availableMetric(kpis?.total_orders)} onClick={() => openTab("sales_invoices")} />
            <Metric icon={<CalendarDays size={18} />} label="Last purchase" value={availableMetric(kpis?.last_order_date)} onClick={() => openTab("sales_invoices")} />
          </div>

          <div className="grid gap-4 xl:grid-cols-12">
            <div className="xl:col-span-4">
              <Section title="Customer information" description="Saved customer master details.">
                <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1"><Field label="Legal name" value={customer.legal_name || customer.legalName || customer.name} /><Field label="Customer group" value={customer.customer_group_name || customer.customerGroupName || customer.customer_group_id || customer.customerGroupId} /><Field label="GSTIN" value={customer.gst_number || customer.gstNumber || customer.gstin} /><Field label="PAN" value={customer.pan_number || customer.panNumber || customer.pan} /><Field label="Mobile" value={customer.mobile || customer.phone} /><Field label="Email" value={customer.email} /></dl>
              </Section>
            </div>
            <div className="xl:col-span-5">
              <Section title="Recent transactions" description="Recent orders or invoices returned for this customer.">
              {invoices.length ? <div className="divide-y divide-slate-100 dark:divide-slate-800">{invoices.slice(0, 5).map((row: any, index: number) => <div key={row.id || row.order_no || row.invoice_number || index} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"><div><div className="font-medium">{textValue(row.order_no || row.invoice_number || row.no || row.invoice_no)}</div><div className="text-xs text-slate-500">{textValue(row.date)}</div></div><div className="text-right"><div>{amountValue(row.value ?? row.total_amount ?? row.amount)}</div><div className="text-xs text-slate-500">{textValue(row.status)}</div></div></div>)}</div> : <p className="text-sm text-slate-500">No recent orders or invoices are available for this customer.</p>}
              </Section>
            </div>
            <div className="space-y-4 xl:col-span-3">
              <Section title="Account snapshot" description="Credit details on this customer record.">
                <dl className="grid gap-3"><Field label="Credit limit" value={amountValue(customer.credit_limit ?? customer.creditLimit)} /><Field label="Credit ledger balance" value={amountValue(customer.credit_used ?? customer.creditUsed ?? customer.outstanding)} /><Field label="Credit days" value={customer.credit_days ?? customer.creditDays} /></dl>
                <div className={`mt-4 rounded-lg px-3 py-2 text-xs font-semibold ${creditHold ? "bg-amber-50 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200" : "bg-emerald-50 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200"}`}>{creditHold ? "Credit invoices are on hold" : "No credit hold reported"}</div>
                <button type="button" onClick={() => openTab("commercial")} className="mt-3 text-xs font-semibold text-sky-700 hover:underline dark:text-sky-300">View commercial terms</button>
              </Section>
              <Section title="Customer network">
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 text-sm dark:border-slate-800"><span className="flex items-center gap-2 text-slate-600 dark:text-slate-300"><Users size={15} />Child customers</span><strong>{children.length}</strong></div>
                <div className="flex items-center justify-between gap-3 pt-3 text-sm dark:border-slate-800"><span className="flex items-center gap-2 text-slate-600 dark:text-slate-300"><Store size={15} />Active stores / outlets</span><strong>{activeStores} / {stores.length}</strong></div>
                <button type="button" onClick={() => openTab("parent_child")} className="mt-3 text-xs font-semibold text-sky-700 hover:underline dark:text-sky-300">View customer relationships</button>
              </Section>
            </div>
          </div>
        </div>}

        {!isEditing && activeTab === "basic" && <Section title="Customer details"><dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Field label="Customer code" value={customer.code} /><Field label="Name" value={customer.name} /><Field label="Display name" value={displayName} /><Field label="Customer type" value={customer.customer_type || customer.customerType} /><Field label="Status" value={status} /><Field label="Customer group" value={customer.customer_group_name || customer.customer_group_id || customer.customerGroupId} /><Field label="Mobile" value={customer.mobile || customer.phone} /><Field label="Email" value={customer.email} /><Field label="Company" value={customer.company_name || customer.company_id} /></dl></Section>}

        {!isEditing && activeTab === "corporate_tax" && <div className="space-y-4"><Section title="Legal and tax identity"><dl className="grid gap-4 sm:grid-cols-2"><Field label="Legal name" value={customer.legal_name || customer.legalName || customer.name} /><Field label="PAN" value={customer.pan_number || customer.panNumber || customer.pan} /><Field label="Registered address" value={customer.registered_address || customer.registeredAddress || customer.address_line1 || customer.addressLine1 || (billingLocations.length > 0 ? (billingLocations[0].address_line1 || billingLocations[0].addressLine1 || billingLocations[0].address) : "")} /><Field label="GSTIN" value={customer.gst_number || customer.gstNumber || customer.gstin} /></dl></Section><Section title="GST registrations" description="Registrations saved against this customer.">{gstRegistrations.length ? <DataTable headers={["GSTIN", "State", "Status", "Primary"]} rows={gstRegistrations.map((row: any) => [row.gstin, row.state_name || row.stateName || row.state, row.status, (row.is_primary ?? row.isPrimary) ? "Yes" : "No"])} /> : <Empty>No GST registrations are recorded.</Empty>}</Section></div>}

        {!isEditing && activeTab === "addresses" && <div className="grid gap-4 lg:grid-cols-2"><Section title="Billing locations">{billingLocations.length ? <DataTable headers={["Location", "Address", "City", "Default"]} rows={billingLocations.map((row: any) => [row.location_name || row.locationName || row.name || "Billing Location", row.address_line1 || row.addressLine1 || row.address || "—", row.city || "—", (row.is_default ?? row.isDefault) ? "Yes" : "No"])} /> : <Empty>No billing locations are recorded.</Empty>}</Section><Section title="Delivery locations">{deliveryLocations.length ? <DataTable headers={["Store code", "Location", "City", "Status"]} rows={deliveryLocations.map((row: any) => [row.store_code || row.storeCode || "—", row.location_name || row.locationName || row.name || "Delivery Location", row.city || "—", row.status || "Active"])} /> : <Empty>No delivery locations are recorded.</Empty>}</Section></div>}

        {!isEditing && activeTab === "parent_child" && <Section title="Customer relationships" description="Linked customer accounts are separate records from delivery locations.">
          {children.length ? <>
            <DataTable headers={["Customer code", "Customer", "Status"]} rows={children.map((row: any) => [
              row.dependant_customer_code || row.dependantCustomerCode || row.customer_code || row.customerCode || row.code || "—",
              row.dependant_customer_name || row.dependantCustomerName || row.customer_name || row.customerName || row.name || "Child Account",
              row.dependant_customer_status || row.dependantCustomerStatus || row.status || "Active",
            ])} />
            <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">Child customers appear in billing only when this parent’s “Show Child Customers in Billing” setting is enabled.</p>
            <p className="mt-1 text-sm font-medium">Billing visibility: {customer.show_child_customers_in_billing || customer.showChildCustomersInBilling ? "Enabled" : "Disabled"}</p>
          </> : <Empty>This customer has no linked child accounts.</Empty>}
          <p className="mt-3 text-xs text-slate-500">Choose Edit customer to add or manage customer relationships.</p>
        </Section>}

        {!isEditing && activeTab === "commercial" && <Section title="Commercial terms" description="Customer credit policy and group information returned for this company."><dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Field label="Customer group" value={customer.customer_group_name || customer.customer_group_id || customer.customerGroupId} /><Field label="Credit limit" value={amountValue(customer.credit_limit ?? customer.creditLimit)} /><Field label="Credit days" value={customer.credit_days ?? customer.creditDays} /><Field label="Credit hold" value={creditHold ? "On hold" : "Not on hold"} /><Field label="Credit ledger balance" value={amountValue(customer.credit_used ?? customer.creditUsed ?? customer.outstanding)} /></dl><p className="mt-4 text-xs text-slate-500">Commercial terms are maintained in the existing Customer Master workflow.</p></Section>}

        {isEditing && activeTab === "sales_invoices" && <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">Invoices and orders are accounting records. Create or correct them in the Sales workspace; Customer 360 keeps their history read-only.</div>}
        {activeTab === "sales_invoices" && <Section title="Recent orders and invoices">{invoices.length ? <DataTable headers={["Document", "Date", "Amount", "Status"]} rows={invoices.map((row: any) => [row.order_no || row.invoice_number || row.no || row.invoice_no, row.date, amountValue(row.value ?? row.total_amount ?? row.amount), row.status])} /> : <Empty>No recent orders or invoices are available.</Empty>}</Section>}

        {isEditing && activeTab === "psv" && <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">PSV quantities and approvals are inventory-control evidence. Review or approve them in the PSV workflow; this customer profile cannot alter reconciliation results.</div>}
        {activeTab === "psv" && <div className="space-y-4"><Section title="PSV quantity reconciliation" description="Received quantities remain pending until approved through the physical stock verification workflow."><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-2 text-xs"><MetricValue label="Document" value={psvSummary?.total_document_qty} /><MetricValue label="Received" value={psvSummary?.total_received_qty} /><MetricValue label="Approved" value={psvSummary?.total_approved_qty} /><MetricValue label="Pending approval" value={psvSummary?.total_pending_approval_qty} /><MetricValue label="Shortage" value={psvSummary?.total_short_qty} /><MetricValue label="Excess" value={psvSummary?.total_excess_qty} /></div><div className="flex items-center gap-2"><select aria-label="Filter PSV status" value={psvStatus} onChange={(event) => setPsvStatus(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"><option value="all">All statuses</option><option value="approved">Approved</option><option value="pending">Pending</option><option value="shortage">Shortage</option><option value="excess">Excess</option><option value="rejected">Rejected</option></select><button type="button" onClick={loadPsv} disabled={psvLoading} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm disabled:opacity-60 dark:border-slate-700"><RefreshCw size={14} className={psvLoading ? "animate-spin" : ""} />Refresh</button></div></div>{psvError && <p role="alert" className="mb-3 text-sm text-rose-700 dark:text-rose-300">{psvError}</p>}{psvLoading && <p role="status" className="mb-3 text-sm text-slate-500">Loading reconciliation…</p>}{filteredPsvItems.length ? <DataTable headers={["Document", "Date", "Store", "Article / Style", "Document qty", "Received", "Approved", "Pending", "Shortage", "Excess", "Rejected", "Status"]} rows={filteredPsvItems.map((row) => [row.invoice_no, row.invoice_date || "—", row.store_code || "—", row.style_code || row.sku, row.document_qty, row.received_qty, row.approved_qty, row.pending_approval_qty, row.short_qty, row.excess_qty, row.rejected_qty, row.workflow_status])} /> : !psvLoading && <Empty>No PSV reconciliation rows match this filter.</Empty>}</Section></div>}
      </div>
      <AddEditGstModal
        isOpen={isGstEditorOpen}
        onClose={() => setIsGstEditorOpen(false)}
        initialData={editingGstRegistration}
        onSave={entry => { void saveGstRegistration(entry); }}
      />
    </main>
  );
};

const Metric: React.FC<{ icon: React.ReactNode; label: string; value: string; onClick: () => void }> = ({ icon, label, value, onClick }) => (
  <button type="button" onClick={onClick} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left hover:border-sky-400 dark:border-slate-800 dark:bg-[#1a202c]">
    <span className="text-sky-700 dark:text-sky-300">{icon}</span><span><span className="block text-xs text-slate-500 dark:text-slate-400">{label}</span><span className="mt-1 block text-base font-semibold text-slate-900 dark:text-white">{value}</span></span>
  </button>
);

const EditInput: React.FC<{
  label: string;
  value: unknown;
  onChange: (value: string) => void;
  type?: React.HTMLInputTypeAttribute;
  required?: boolean;
}> = ({ label, value, onChange, type = "text", required = false }) => (
  <label className="block min-w-0">
    <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">{label}{required && <span className="ml-1 text-rose-600">*</span>}</span>
    <input
      type={type}
      value={value === null || value === undefined ? "" : String(value)}
      onChange={event => onChange(event.target.value)}
      required={required}
      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:ring-sky-950"
    />
  </label>
);

const EditSelect: React.FC<{
  label: string;
  value: unknown;
  options: Array<string | { value: string; label: string }>;
  onChange: (value: string) => void;
}> = ({ label, value, options, onChange }) => {
  const selectedValue = value === null || value === undefined ? "" : String(value);
  const normalizedOptions = options.map(option => typeof option === "string" ? { value: option, label: option } : option);
  const selectedIsUnknown = selectedValue !== "" && !normalizedOptions.some(option => option.value === selectedValue);
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">{label}</span>
      <select
        value={selectedValue}
        onChange={event => onChange(event.target.value)}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:ring-sky-950"
      >
        {selectedIsUnknown && <option value={selectedValue}>{selectedValue} (existing value)</option>}
        {normalizedOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
};

const EditTextarea: React.FC<{ label: string; value: unknown; onChange: (value: string) => void }> = ({ label, value, onChange }) => (
  <label className="block min-w-0">
    <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">{label}</span>
    <textarea
      value={value === null || value === undefined ? "" : String(value)}
      onChange={event => onChange(event.target.value)}
      rows={3}
      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:ring-sky-950"
    />
  </label>
);

const EditCheckbox: React.FC<{ label: string; checked: boolean; onChange: (value: boolean) => void }> = ({ label, checked, onChange }) => (
  <label className="flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700">
    <input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} />
    <span>{label}</span>
  </label>
);

const MetricValue: React.FC<{ label: string; value?: number }> = ({ label, value }) => (
  <div className="rounded-lg bg-slate-100 px-2.5 py-2 dark:bg-slate-800"><span className="block text-slate-500 dark:text-slate-400">{label}</span><strong>{value === undefined ? "Not available" : value.toLocaleString("en-IN")}</strong></div>
);

const Empty: React.FC<{ children: React.ReactNode }> = ({ children }) => <p className="text-sm text-slate-500 dark:text-slate-400">{children}</p>;

const DataTable: React.FC<{ headers: string[]; rows: unknown[][] }> = ({ headers, rows }) => (
  <div className="overflow-x-auto"><table className="w-full min-w-[520px] border-collapse text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">{headers.map((header) => <th key={header} className="px-3 py-2 font-medium">{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index} className="border-b border-slate-100 last:border-0 dark:border-slate-800">{row.map((cell, cellIndex) => <td key={cellIndex} className="px-3 py-2.5 text-slate-800 dark:text-slate-200">{textValue(cell)}</td>)}</tr>)}</tbody></table></div>
);
