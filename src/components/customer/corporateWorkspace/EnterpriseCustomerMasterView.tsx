/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.99.1
 * Created      : 2026-10-20
 * Modified     : 2026-10-23
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Target UI    : Reference-Exact Enterprise Customer Master Workspace
 * Capability    : withCapability("customer.crud", "CRM")
 */

import React, { useState, useMemo } from "react";
import {
  Building2,
  FileText,
  CreditCard,
  MapPin,
  Store,
  Users,
  Network,
  Files,
  History,
  Save,
  Plus,
  Copy,
  PowerOff,
  ChevronLeft,
  Edit2,
  Trash2,
  Download,
  ExternalLink,
  CheckCircle2,
  Star,
  Eye,
  Loader2,
  XCircle,
  HelpCircle,
  ShieldCheck,
  Check
} from "lucide-react";
import { RetailCustomerRecord, CustomerAddressEntry } from "../types.ts";
import { CustomerMasterSideNav, CustomerMasterSectionId } from "./CustomerMasterSideNav.tsx";
import { CustomerSummaryCard } from "./CustomerSummaryCard.tsx";
import { CustomerHierarchyTree, HierarchyChildNode } from "./CustomerHierarchyTree.tsx";
import { CustomerTaxInvoicePreview } from "./CustomerTaxInvoicePreview.tsx";
import { GstRegistrationEntry } from "./AddEditGstModal.tsx";
import { CustomerLifecycleMode } from "../lifecycle/types.ts";

export interface EnterpriseCustomerMasterViewProps {
  customer: RetailCustomerRecord;
  onChange: (field: keyof RetailCustomerRecord, value: any) => void;
  onSave: () => void;
  onSaveAndNew?: () => void;
  onDuplicate?: () => void;
  onDeactivate?: () => void;
  onBack?: () => void;
  onOpenDirectory?: () => void;
  onOpen360?: () => void;
  onToggleLayout?: () => void;
  isSaving?: boolean;
  isDirty?: boolean;
  lifecycleMode?: CustomerLifecycleMode;
  onEdit?: () => void;
  onCancelEdit?: () => void;
  onOpenMailingModal?: () => void;
  onOpenStoreLookupModal?: () => void;
  onOpenContactModal?: (contact?: any) => void;
  onOpenAddChildModal?: () => void;
  onSelectCustomer?: (customerIdentifier: string) => void;
  gstRegistrations?: GstRegistrationEntry[];
  onNotification?: (title: string, message: string, type?: "success" | "error" | "info" | "warning") => void;
}

export const EnterpriseCustomerMasterView: React.FC<EnterpriseCustomerMasterViewProps> = ({
  customer,
  onChange,
  onSave,
  onSaveAndNew,
  onDuplicate,
  onDeactivate,
  onBack,
  onOpenDirectory,
  onOpen360,
  onToggleLayout,
  isSaving = false,
  isDirty = false,
  lifecycleMode = "view",
  onEdit,
  onCancelEdit,
  onOpenMailingModal,
  onOpenStoreLookupModal,
  onOpenContactModal,
  onOpenAddChildModal,
  onSelectCustomer,
  gstRegistrations = [],
  onNotification,
}) => {
  const [activeSection, setActiveSection] = useState<CustomerMasterSectionId>("basic");
  const [addressSubTab, setAddressSubTab] = useState<"billing" | "delivery" | "registered">("billing");
  const [storeSearch, setStoreSearch] = useState<string>("");
  const [childSearch, setChildSearch] = useState<string>("");

  // Documents & Notes
  const [documents, setDocuments] = useState<Array<{ id: string; name: string; type: string; date: string }>>([]);

  // Audit Entries
  const auditLogs: Array<{ id: string; dateTime: string; action: string; by: string; details: string }> = [];

  // Dynamic Stores derived from customer delivery locations / addresses / dependants
  const storeNetwork = useMemo(() => {
    // 1. First check customer.mailingAddresses for delivery locations with store codes
    const addressStores = (customer.mailingAddresses || [])
      .filter((a) => a.storeCode || a.shippingStoreCode || a.addressType === "shipping")
      .map((a, idx) => {
        const code = a.storeCode || a.shippingStoreCode || "—";
        const name = a.locationName || (a.contactPerson ? `${a.contactPerson}` : `${a.city || "Retail"} Store`);
        const location = a.city ? (a.state ? `${a.city}, ${a.state}` : a.city) : (a.state || "India");
        const isHub = name.toLowerCase().includes("hub") || name.toLowerCase().includes("wh") || name.toLowerCase().includes("warehouse");
        return {
          id: a.id || a.code || String(idx + 1),
          code,
          name,
          location,
          type: isHub ? "Regional Hub" : "Store",
          status: "Active",
        };
      });

    if (addressStores.length > 0) return addressStores;

    // 2. Check customer.dependants
    if (customer.dependants && customer.dependants.length > 0) {
      return customer.dependants.map((dep: any, idx: number) => {
        let storeCode = "";
        let location = "India";
        if (dep.notes) {
          const matchStore = dep.notes.match(/Store Code:\s*([^|]+)/i);
          if (matchStore) storeCode = matchStore[1].trim();
          const matchState = dep.notes.match(/State:\s*([^|]+)/i);
          if (matchState) location = matchState[1].trim();
        }
        return {
          id: dep.id || dep.dependantCustomerId || String(idx + 1),
          code: storeCode || dep.code || "—",
          name: dep.dependantCustomerName || "Unnamed customer",
          location,
          type: "Store",
          status: "Active",
        };
      });
    }

    return [];
  }, [customer.mailingAddresses, customer.dependants]);

  // Dynamic Child Customers derived from customer dependants / store network
  const childCustomers: HierarchyChildNode[] = useMemo(() => {
    if (customer.dependants && customer.dependants.length > 0) {
      return customer.dependants.map((dep: any, idx: number) => {
        let storeCode = "";
        let location = "";
        if (dep.notes) {
          const matchStore = dep.notes.match(/Store Code:\s*([^|]+)/i);
          if (matchStore) storeCode = matchStore[1].trim();
          const matchState = dep.notes.match(/State:\s*([^|]+)/i);
          if (matchState) location = matchState[1].trim();
        }
        if (!storeCode && customer.mailingAddresses) {
          const matched = customer.mailingAddresses.find(
            (a) => a.locationName === dep.dependantCustomerName || a.contactPerson === dep.dependantCustomerName
          );
          if (matched) {
            storeCode = matched.storeCode || matched.shippingStoreCode || "";
            location = matched.city ? (matched.state ? `${matched.city}, ${matched.state}` : matched.city) : (matched.state || "");
          }
        }
        const code = storeCode || dep.code || "—";
        return {
          id: dep.id || dep.dependantCustomerId || String(idx + 1),
          code,
          name: dep.dependantCustomerName || "Unnamed customer",
          storeCode: storeCode || "—",
          location: location || "India",
          status: "Active",
        };
      });
    }

    return [];
  }, [customer.dependants, customer.mailingAddresses]);

  // Filtered store network based on storeSearch
  const filteredStoreNetwork = useMemo(() => {
    if (!storeSearch.trim()) return storeNetwork;
    const q = storeSearch.trim().toLowerCase();
    return storeNetwork.filter(
      (st) =>
        st.code.toLowerCase().includes(q) ||
        st.name.toLowerCase().includes(q) ||
        st.location.toLowerCase().includes(q) ||
        st.type.toLowerCase().includes(q)
    );
  }, [storeNetwork, storeSearch]);

  // Filtered child customers based on childSearch
  const filteredChildCustomers = useMemo(() => {
    if (!childSearch.trim()) return childCustomers;
    const q = childSearch.trim().toLowerCase();
    return childCustomers.filter(
      (cc) =>
        cc.code.toLowerCase().includes(q) ||
        cc.name.toLowerCase().includes(q) ||
        (cc.storeCode && cc.storeCode.toLowerCase().includes(q)) ||
        (cc.location && cc.location.toLowerCase().includes(q))
    );
  }, [childCustomers, childSearch]);

  // Dynamic Contacts derived from addresses or customer profile
  const contacts = useMemo(() => {
    const list: Array<{ id: string; name: string; designation: string; phone: string; email: string }> = [];
    if (customer.mailingAddresses) {
      customer.mailingAddresses.forEach((a, idx) => {
        if (a.contactPerson && a.contactPerson.trim()) {
          list.push({
            id: `c-${idx}`,
            name: a.contactPerson,
            designation: a.locationName || (a.addressType === "billing" ? "Corporate Billing Officer" : "Store Manager"),
            phone: a.mobilePhone || customer.phone || "—",
            email: a.email1 || customer.email || "—"
          });
        }
      });
    }
    if (list.length === 0 && (customer.phone || customer.email)) {
      list.push({
        id: "c-primary",
        name: customer.name || "Primary Contact",
        designation: "Authorized Representative",
        phone: customer.phone || "—",
        email: customer.email || "—"
      });
    }
    return list;
  }, [customer.mailingAddresses, customer.phone, customer.email, customer.name]);

  // Addresses categorized dynamically from customer.mailingAddresses
  const billingAddresses = useMemo(() => {
    const list = (customer.mailingAddresses || []).filter(
      (a) => a.addressType === "billing" || a.addressType === "mailing"
    );
    if (list.length > 0) {
      return list.map((a, idx) => ({
        id: a.id || a.code || `b-${idx}`,
        isDefault: Boolean(a.isDefault),
        name: a.locationName || (a.contactPerson ? a.contactPerson : (idx === 0 ? "Head Office" : "Regional Office")),
        address: [a.address1, a.address2, a.locality].filter(Boolean).join(", ") || (idx === 0 ? "Corporate Headquarters" : "Regional Office"),
        city: a.city || "—",
        state: a.state || "—",
        pin: a.postalCode || "—",
        gstin: a.gstin || customer.gstin || "—",
      }));
    }
    return [];
  }, [customer.mailingAddresses, customer.gstin]);

  const deliveryAddresses = useMemo(() => {
    const list = (customer.mailingAddresses || []).filter(
      (a) => a.addressType === "shipping" || Boolean(a.shippingStoreCode || a.storeCode)
    );
    if (list.length > 0) {
      return list.map((a, idx) => ({
        id: a.id || a.code || `d-${idx}`,
        isDefault: Boolean(a.isDefault),
        name: a.locationName || (a.contactPerson ? a.contactPerson : (a.city ? `${a.city} Outlet (${a.storeCode || a.shippingStoreCode || idx + 1})` : `Store ${a.storeCode || a.shippingStoreCode || idx + 1}`)),
        address: [a.address1, a.address2, a.locality].filter(Boolean).join(", ") || "Physical Store Delivery Location",
        city: a.city || "—",
        state: a.state || "—",
        pin: a.postalCode || "—",
        gstin: a.gstin || customer.gstin || "—",
      }));
    }
    return [];
  }, [customer.mailingAddresses, customer.gstin]);

  const registeredAddresses = useMemo(() => {
    const list = (customer.mailingAddresses || []).filter((a) => a.addressType === "mailing");
    if (list.length > 0) {
      return list.map((a, idx) => ({
        id: a.id || a.code || `r-${idx}`,
        isDefault: Boolean(a.isDefault),
        name: a.locationName || (a.contactPerson ? a.contactPerson : "Corporate Registered Office"),
        address: [a.address1, a.address2, a.locality].filter(Boolean).join(", ") || "Registered Corporate Office",
        city: a.city || "—",
        state: a.state || "—",
        pin: a.postalCode || "—",
        gstin: a.gstin || customer.gstin || "—",
      }));
    }
    return [];
  }, [customer.mailingAddresses, customer.gstin]);

  const scrollToSection = (sectionId: CustomerMasterSectionId) => {
    setActiveSection(sectionId);
    const targetMap: Record<CustomerMasterSectionId, string> = {
      basic: "sec-basic-details",
      corporate: "sec-corporate-tax",
      addresses: "sec-addresses",
      stores: "sec-store-network",
      commercial: "sec-commercial-terms",
      contacts: "sec-contacts",
      "parent-child": "sec-parent-child",
      documents: "sec-documents",
      audit: "sec-activity-audit",
    };
    const el = document.getElementById(targetMap[sectionId]);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const isReadOnly = lifecycleMode === "view";

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f4f7fb] dark:bg-[#0f172a] text-slate-800 dark:text-slate-200 overflow-hidden select-none">
      
      {/* ── Page Header & Action Bar ───────────────────────────────────────── */}
      <header className="px-6 py-3 bg-white dark:bg-[#1e293b] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 shrink-0 shadow-xs">
        {/* Title & Breadcrumb */}
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
            Customer Master
          </h1>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
            <span>Customers</span>
            <span>&gt;</span>
            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
              {customer.code || "REL001"}
            </span>
          </div>
        </div>

        {/* Action Buttons Toolbar */}
        <div className="flex items-center gap-2">
          {/* Back Button */}
          <button
            type="button"
            onClick={onBack}
            className="px-3.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-2xs"
            title="Go Back"
          >
            <ChevronLeft size={14} />
            <span>Back</span>
          </button>

          {/* Save Button */}
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className="px-4 py-1.5 bg-[#1d4ed8] hover:bg-[#1e40af] text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-xs disabled:opacity-60"
            title="Save Customer Record (Ctrl+S)"
          >
            {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            <span>Save</span>
          </button>

          {/* Save & New Button */}
          <button
            type="button"
            onClick={onSaveAndNew || onSave}
            disabled={isSaving}
            className="px-3.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-2xs"
            title="Save and Create New Record"
          >
            <span>Save &amp; New</span>
          </button>

          {/* Duplicate Button */}
          <button
            type="button"
            onClick={onDuplicate}
            className="px-3.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-2xs"
            title="Duplicate Customer Record"
          >
            <Copy size={13} />
            <span>Duplicate</span>
          </button>

          {/* Deactivate Button */}
          <button
            type="button"
            onClick={onDeactivate}
            className="px-3.5 py-1.5 bg-white dark:bg-slate-800 border border-red-300 dark:border-red-900/60 hover:bg-red-50 text-red-600 dark:text-red-400 rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-2xs"
            title="Deactivate Customer Account"
          >
            <PowerOff size={13} />
            <span>Deactivate</span>
          </button>

          {/* Directory & 360 Quick Actions */}
          {(onOpenDirectory || onOpen360) && (
            <>
              <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 mx-1" />
              {onOpenDirectory && (
                <button
                  type="button"
                  onClick={onOpenDirectory}
                  className="px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold flex items-center gap-1 transition shadow-2xs"
                  title="Open Customer Directory"
                >
                  <Files size={13} />
                  <span>Directory</span>
                </button>
              )}
              {onOpen360 && (
                <button
                  type="button"
                  onClick={onOpen360}
                  className="px-2.5 py-1.5 bg-sky-50 dark:bg-sky-950/60 border border-sky-300 dark:border-sky-800 text-[#00355f] dark:text-[#8ebdf9] hover:bg-sky-100 rounded-lg text-xs font-bold flex items-center gap-1 transition shadow-2xs"
                  title="Open Corporate 360 Dashboard"
                >
                  <Building2 size={13} />
                  <span>360</span>
                </button>
              )}
            </>
          )}
        </div>
      </header>

      {/* ── Main Layout: Left Nav + Middle Workspace + Right Sidebar ────────── */}
      <div className="flex-1 overflow-hidden flex gap-4 p-4 min-h-0">
        
        {/* Left Side Navigation (w-52) */}
        <CustomerMasterSideNav
          activeSection={activeSection}
          onSelectSection={scrollToSection}
        />

        {/* Scrollable Center & Right Workspace Grid */}
        <div className="flex-1 overflow-y-auto pr-1 flex flex-col xl:flex-row gap-4 min-w-0">
          
          {/* ── Left / Center Form Workspace (~65% width) ──────────────────── */}
          <div className="flex-1 space-y-4 min-w-0">
            
            {/* Top Row: Basic Details (Card 1) + Customer Summary Card */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
              
              {/* Card 1: Basic Details (lg:col-span-8) */}
              <div
                id="sec-basic-details"
                className="lg:col-span-8 bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs space-y-3.5"
              >
                {/* Section Header */}
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="w-5 h-5 rounded-full bg-[#1d4ed8] text-white flex items-center justify-center font-bold text-xs">
                    1
                  </div>
                  <h2 className="font-bold text-xs uppercase tracking-wide text-slate-900 dark:text-white">
                    Basic Details
                  </h2>
                </div>

                {/* Parent Customer Banner (Visible when viewing child customer) */}
                {Boolean(customer.isDependant || customer.primaryAccountCode) && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 bg-blue-600 text-white rounded-md shrink-0">
                        <Building2 size={14} />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-blue-900 dark:text-blue-100 flex items-center gap-2">
                          <span>Child Store Account of:</span>
                          <span className="font-extrabold">{customer.primaryAccountName || "Reliance Retail Limited"}</span>
                          <span className="font-mono text-[11px] bg-blue-200 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-1.5 py-0.5 rounded">
                            {customer.primaryAccountCode || "—"}
                          </span>
                        </div>
                        <div className="text-[11px] text-blue-700 dark:text-blue-300 mt-0.5">
                          Relationship Type: <span className="font-bold">{customer.customerType || "STORE"}</span> • Centralized B2B Corporate Parent
                        </div>
                      </div>
                    </div>
                    {onBack && (
                      <button
                        type="button"
                        onClick={() => onSelectCustomer && customer.primaryAccountCode ? onSelectCustomer(customer.primaryAccountCode) : onBack()}
                        className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-blue-300 dark:border-blue-700 hover:bg-blue-50 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-2xs shrink-0"
                        title={`Navigate to Parent Account (${customer.primaryAccountCode || "Parent"})`}
                      >
                        <ChevronLeft size={13} />
                        <span>View Parent</span>
                      </button>
                    )}
                  </div>
                )}

                {/* 3-Column Field Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  {/* Customer Code */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      Customer Code <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      readOnly={isReadOnly}
                      value={customer.code || ""}
                      onChange={(e) => onChange("code", e.target.value)}
                      className={`w-full p-2 border rounded-lg font-mono font-bold text-xs outline-none ${
                        isReadOnly
                          ? "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 cursor-not-allowed"
                          : "bg-white dark:bg-slate-900 border-blue-400 focus:ring-1 focus:ring-blue-500"
                      }`}
                    />
                  </div>

                  {/* Customer Name */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      Customer Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      readOnly={isReadOnly}
                      value={customer.name || ""}
                      onChange={(e) => onChange("name", e.target.value)}
                      className={`w-full p-2 border rounded-lg font-bold text-xs outline-none ${
                        isReadOnly
                          ? "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                          : "bg-white dark:bg-slate-900 border-blue-400 focus:ring-1 focus:ring-blue-500"
                      }`}
                    />
                  </div>

                  {/* Display Name */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      Display Name
                    </label>
                    <input
                      type="text"
                      readOnly={isReadOnly}
                      value={customer.shortName || customer.name || ""}
                      onChange={(e) => onChange("shortName", e.target.value)}
                      className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Type of Customer */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      Type of Customer <span className="text-red-500">*</span>
                    </label>
                    <select
                      disabled={isReadOnly}
                      value={customer.customerType || "Corporate / Enterprise"}
                      onChange={(e) => onChange("customerType", e.target.value)}
                      className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold outline-none focus:border-blue-500"
                    >
                      <option value="Corporate / Enterprise">🏢 Corporate / Enterprise</option>
                      <option value="Retail / Individual">👤 Retail / Individual</option>
                      <option value="Wholesale / Trade">📦 Wholesale / Trade</option>
                      <option value="Institutional / Government">🏛️ Institutional / Government</option>
                    </select>
                  </div>

                  {/* Relationship Type */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      Relationship Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      disabled={isReadOnly}
                      value={customer.corporateParent ? "Child / Branch" : "Parent"}
                      onChange={(e) => onChange("corporateParent", e.target.value === "Child / Branch" ? "REL001" : "")}
                      className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold outline-none focus:border-blue-500"
                    >
                      <option value="Standalone">Standalone</option>
                      <option value="Parent">👥 Parent</option>
                      <option value="Child / Branch">🏬 Child / Branch</option>
                    </select>
                  </div>

                  {/* Business Category */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      Business Category <span className="text-red-500">*</span>
                    </label>
                    <select
                      disabled={isReadOnly}
                      value={customer.businessNature || "Key Account"}
                      onChange={(e) => onChange("businessNature", e.target.value)}
                      className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold outline-none focus:border-blue-500"
                    >
                      <option value="Key Account">⭐ Key Account</option>
                      <option value="Retailer">Retailer</option>
                      <option value="Dealer">Dealer</option>
                      <option value="Distributor">Distributor</option>
                      <option value="Wholesaler">Wholesaler</option>
                      <option value="Reseller">Reseller</option>
                      <option value="Institution">Institution</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  {/* Customer Group */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      Customer Group
                    </label>
                    <select
                      disabled={isReadOnly}
                      value={customer.customerGroupId || "Corporate Accounts"}
                      onChange={(e) => onChange("customerGroupId", e.target.value)}
                      className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none focus:border-blue-500"
                    >
                      <option value="Corporate Accounts">Corporate Accounts</option>
                      <option value="Retail Accounts">Retail Accounts</option>
                      <option value="Institutional Accounts">Institutional Accounts</option>
                      <option value="VIP Accounts">VIP Accounts</option>
                    </select>
                  </div>

                  {/* Status */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      Status
                    </label>
                    <select
                      disabled={isReadOnly}
                      value={customer.status || "Active"}
                      onChange={(e) => onChange("status", e.target.value)}
                      className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold outline-none focus:border-blue-500"
                    >
                      <option value="Active">🟢 Active</option>
                      <option value="Inactive">⚪ Inactive</option>
                      <option value="Suspended">🟡 Suspended</option>
                      <option value="Blocked">🔴 Blocked</option>
                    </select>
                  </div>

                  {/* Territory / Region */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      Territory / Region
                    </label>
                    <select
                      disabled={isReadOnly}
                      value={customer.mailingAddresses?.[0]?.zone || "West India"}
                      onChange={(e) => {
                        const newZone = e.target.value;
                        const addrs = customer.mailingAddresses || [];
                        if (addrs.length > 0) {
                          onChange("mailingAddresses", addrs.map((a, i) => (i === 0 ? { ...a, zone: newZone } : a)));
                        }
                      }}
                      className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none focus:border-blue-500"
                    >
                      <option value="West India">West India</option>
                      <option value="North India">North India</option>
                      <option value="South India">South India</option>
                      <option value="East India">East India</option>
                      <option value="Central India">Central India</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Customer Summary Panel (lg:col-span-4) */}
              <div className="lg:col-span-4">
                <CustomerSummaryCard
                  customer={customer}
                  childCustomerCount={childCustomers.length}
                  totalStoreCount={storeNetwork.length}
                />
              </div>
            </div>

            {/* Card 2: Corporate Identity & Tax */}
            <div
              id="sec-corporate-tax"
              className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs space-y-3.5"
            >
              {/* Header */}
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                <div className="w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center font-bold text-xs">
                  2
                </div>
                <h2 className="font-bold text-xs uppercase tracking-wide text-rose-600 dark:text-rose-400">
                  Corporate Identity &amp; Tax
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                {/* Legal Name */}
                <div className="sm:col-span-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Legal Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    readOnly={isReadOnly}
                    value={customer.name || ""}
                    onChange={(e) => onChange("name", e.target.value)}
                    className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold outline-none focus:border-blue-500"
                  />
                </div>

                {/* GSTIN */}
                <div className="sm:col-span-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    GSTIN
                  </label>
                  <input
                    type="text"
                    readOnly={isReadOnly}
                    value={customer.gstin || ""}
                    onChange={(e) => onChange("gstin", e.target.value.toUpperCase())}
                    className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono font-bold outline-none focus:border-blue-500"
                  />
                </div>

                {/* PAN */}
                <div className="sm:col-span-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    PAN
                  </label>
                  <input
                    type="text"
                    readOnly={isReadOnly}
                    value={customer.panNumber || ""}
                    onChange={(e) => onChange("panNumber", e.target.value.toUpperCase())}
                    className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono font-bold outline-none focus:border-blue-500"
                  />
                </div>

                {/* IEC (Optional) */}
                <div className="sm:col-span-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    IEC (Optional)
                  </label>
                  <input
                    type="text"
                    readOnly={isReadOnly}
                    value={customer.iecNumber || ""}
                    onChange={(e) => onChange("iecNumber", e.target.value)}
                    className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono outline-none focus:border-blue-500"
                  />
                </div>

                {/* Registered Address */}
                <div className="sm:col-span-4">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Registered Address
                  </label>
                  <textarea
                    rows={2}
                    readOnly={isReadOnly}
                    value={
                      customer.mailingAddresses?.[0]?.address1
                        ? `${customer.mailingAddresses[0].address1}, ${customer.mailingAddresses[0].city} - ${customer.mailingAddresses[0].postalCode || ""}, ${customer.mailingAddresses[0].state || ""}, India`
                        : ""
                    }
                    className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs leading-relaxed outline-none focus:border-blue-500 resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Card 3: Commercial Terms */}
            <div
              id="sec-commercial-terms"
              className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs space-y-3.5"
            >
              {/* Header */}
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                <div className="w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-xs">
                  3
                </div>
                <h2 className="font-bold text-xs uppercase tracking-wide text-purple-700 dark:text-purple-400">
                  Commercial Terms
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-6 gap-3 text-xs">
                {/* Default Price List */}
                <div className="sm:col-span-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Default Price List
                  </label>
                  <select
                    disabled={isReadOnly}
                    value={customer.priceGroup || "Standard Retail"}
                    onChange={(e) => onChange("priceGroup", e.target.value)}
                    className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold outline-none focus:border-purple-500"
                  >
                    <option value="Standard Retail">Standard Retail</option>
                    <option value="Reliance Corporate">Reliance Corporate</option>
                    <option value="Wholesale Tier 1">Wholesale Tier 1</option>
                    <option value="Distributor Price">Distributor Price</option>
                  </select>
                </div>

                {/* Payment Terms */}
                <div className="sm:col-span-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Payment Terms
                  </label>
                  <select
                    disabled={isReadOnly}
                    value={customer.paymentTerm || "Immediate"}
                    onChange={(e) => onChange("paymentTerm", e.target.value)}
                    className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold outline-none focus:border-purple-500"
                  >
                    <option value="Immediate">Immediate</option>
                    <option value="15 Days">15 Days</option>
                    <option value="30 Days">30 Days</option>
                    <option value="45 Days">45 Days</option>
                    <option value="60 Days">60 Days</option>
                    <option value="90 Days">90 Days</option>
                  </select>
                </div>

                {/* Credit Limit */}
                <div className="sm:col-span-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Credit Limit (₹)
                  </label>
                  <input
                    type="number"
                    readOnly={isReadOnly}
                    value={typeof customer.creditLimit === "number" ? customer.creditLimit : 0}
                    onChange={(e) => onChange("creditLimit", Number(e.target.value))}
                    className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono font-bold outline-none focus:border-purple-500"
                  />
                </div>

                {/* Credit Days */}
                <div className="sm:col-span-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Credit Days
                  </label>
                  <input
                    type="number"
                    readOnly={isReadOnly}
                    value={typeof customer.creditDays === "number" ? customer.creditDays : 0}
                    onChange={(e) => onChange("creditDays", Number(e.target.value))}
                    className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono font-bold outline-none focus:border-purple-500"
                  />
                </div>

                {/* Sales Person */}
                <div className="sm:col-span-3">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Sales Person
                  </label>
                  <select
                    disabled={isReadOnly}
                    value={customer.accountManager || ""}
                    onChange={(e) => onChange("accountManager", e.target.value)}
                    className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none focus:border-purple-500"
                  >
                    <option value="">— Direct / None —</option>
                    <option value="Corporate Sales">Corporate Sales</option>
                    <option value="Key Accounts Team">Key Accounts Team</option>
                    <option value="Direct Sales Head">Direct Sales Head</option>
                  </select>
                </div>

                {/* Currency */}
                <div className="sm:col-span-3">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Currency
                  </label>
                  <select
                    disabled={isReadOnly}
                    value="INR"
                    className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold outline-none focus:border-purple-500"
                  >
                    <option value="INR">INR</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Card 4: Addresses */}
            <div
              id="sec-addresses"
              className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs space-y-3.5"
            >
              {/* Header */}
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
                  4
                </div>
                <h2 className="font-bold text-xs uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                  Addresses
                </h2>
              </div>

              {/* Sub-Tabs: Billing Addresses / Delivery Addresses / Registered Office */}
              <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                <button
                  type="button"
                  onClick={() => setAddressSubTab("billing")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    addressSubTab === "billing"
                      ? "bg-sky-50 dark:bg-sky-950 text-blue-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100"
                  }`}
                >
                  Billing Addresses ({billingAddresses.length})
                </button>
                <button
                  type="button"
                  onClick={() => setAddressSubTab("delivery")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    addressSubTab === "delivery"
                      ? "bg-sky-50 dark:bg-sky-950 text-blue-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100"
                  }`}
                >
                  Delivery Addresses ({deliveryAddresses.length})
                </button>
                <button
                  type="button"
                  onClick={() => setAddressSubTab("registered")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    addressSubTab === "registered"
                      ? "bg-sky-50 dark:bg-sky-950 text-blue-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100"
                  }`}
                >
                  Registered Office ({registeredAddresses.length})
                </button>
              </div>

              {/* Addresses Table */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto max-h-[360px] overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse min-w-[650px]">
                  <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 font-bold text-[10px] uppercase text-slate-500 border-b border-slate-200 dark:border-slate-800 z-10">
                    <tr>
                      <th className="p-2 w-12 text-center">Default</th>
                      <th className="p-2">Address Name</th>
                      <th className="p-2">Address</th>
                      <th className="p-2">City</th>
                      <th className="p-2">State</th>
                      <th className="p-2">PIN</th>
                      <th className="p-2">GSTIN</th>
                      <th className="p-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {(() => {
                      const list = addressSubTab === "billing" ? billingAddresses : (addressSubTab === "delivery" ? deliveryAddresses : registeredAddresses);
                      if (list.length === 0) {
                        return (
                          <tr>
                            <td colSpan={8} className="p-8 text-center text-xs text-slate-500">
                              No {addressSubTab === "billing" ? "billing" : addressSubTab === "delivery" ? "delivery" : "registered"} addresses recorded for this customer.
                            </td>
                          </tr>
                        );
                      }
                      return list.map((addr) => (
                        <tr key={addr.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                          <td className="p-2 text-center">
                            <input
                              type="radio"
                              name="default_addr"
                              checked={addr.isDefault}
                              readOnly
                              className="text-blue-600 focus:ring-blue-500"
                            />
                          </td>
                          <td className="p-2 font-bold text-slate-900 dark:text-white">{addr.name}</td>
                          <td className="p-2 text-slate-600 dark:text-slate-300">{addr.address}</td>
                          <td className="p-2">{addr.city}</td>
                          <td className="p-2">{addr.state}</td>
                          <td className="p-2 font-mono">{addr.pin}</td>
                          <td className="p-2 font-mono text-[11px] font-bold text-slate-700 dark:text-slate-300">
                            {addr.gstin}
                          </td>
                          <td className="p-2 text-right space-x-1">
                            <button
                              type="button"
                              onClick={onOpenMailingModal}
                              className="p-1 text-slate-400 hover:text-blue-600 rounded transition"
                              title="Edit Address"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              type="button"
                              className="p-1 text-slate-400 hover:text-red-600 rounded transition"
                              title="Delete Address"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>

              {/* Add Button */}
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={onOpenMailingModal}
                  className="px-3 py-1.5 bg-sky-50 dark:bg-sky-950 border border-sky-200 dark:border-sky-800 text-blue-700 dark:text-sky-300 hover:bg-sky-100 rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-2xs"
                >
                  <Plus size={14} />
                  <span>+ Add {addressSubTab === "billing" ? "Billing" : "Delivery"} Address</span>
                </button>
              </div>
            </div>

            {/* Row: Store Network (Card 5) & Contacts (Card 6) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              
              {/* Card 5: Store / Outlet Network */}
              <div
                id="sec-store-network"
                className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs space-y-3.5"
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-teal-600 text-white flex items-center justify-center font-bold text-xs">
                      5
                    </div>
                    <div>
                      <h2 className="font-bold text-xs uppercase tracking-wide text-teal-700 dark:text-teal-400">
                        Store / Outlet Network ({storeNetwork.length})
                      </h2>
                      {storeSearch && (
                        <span className="text-[10px] text-slate-500 font-medium">
                          Showing {filteredStoreNetwork.length} of {storeNetwork.length}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="relative flex items-center">
                    <input
                      type="text"
                      placeholder="Search stores..."
                      value={storeSearch}
                      onChange={(e) => setStoreSearch(e.target.value)}
                      className="px-2.5 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 w-36 sm:w-48 focus:w-56 transition-all outline-none"
                    />
                    {storeSearch && (
                      <button
                        type="button"
                        onClick={() => setStoreSearch("")}
                        className="absolute right-2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                        title="Clear filter"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>

                <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto max-h-[360px] overflow-y-auto">
                  {filteredStoreNetwork.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-500">
                      {storeSearch
                        ? <>No store outlets match <span className="font-bold font-mono">"{storeSearch}"</span>.</>
                        : "No store or delivery locations recorded for this customer."}
                    </div>
                  ) : (
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 font-bold text-[10px] uppercase text-slate-500 border-b border-slate-200 dark:border-slate-800 z-10">
                        <tr>
                          <th className="p-2">Store Code</th>
                          <th className="p-2">Store Name</th>
                          <th className="p-2">Location</th>
                          <th className="p-2">Type</th>
                          <th className="p-2">Status</th>
                          <th className="p-2 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
                        {filteredStoreNetwork.map((st) => (
                          <tr key={st.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                            <td className="p-2 font-mono font-bold text-slate-900 dark:text-white">{st.code}</td>
                            <td className="p-2 font-medium">{st.name}</td>
                            <td className="p-2">{st.location}</td>
                            <td className="p-2 text-slate-500">{st.type}</td>
                            <td className="p-2">
                              <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-bold">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                {st.status}
                              </span>
                            </td>
                            <td className="p-2 text-right">
                              <button
                                type="button"
                                onClick={onOpenStoreLookupModal}
                                className="p-1 text-slate-400 hover:text-blue-600 rounded transition"
                              >
                                <Edit2 size={12} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={onOpenStoreLookupModal}
                    className="px-3 py-1.5 bg-teal-50 dark:bg-teal-950 border border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-300 hover:bg-teal-100 rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-2xs"
                  >
                    <Plus size={14} />
                    <span>+ Add Store / Outlet</span>
                  </button>
                </div>
              </div>

              {/* Card 6: Contacts */}
              <div
                id="sec-contacts"
                className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs space-y-3.5"
              >
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-xs">
                    6
                  </div>
                  <h2 className="font-bold text-xs uppercase tracking-wide text-amber-700 dark:text-amber-400">
                    Contacts
                  </h2>
                </div>

                <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 font-bold text-[10px] uppercase text-slate-500 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="p-2">Name</th>
                        <th className="p-2">Designation</th>
                        <th className="p-2">Phone</th>
                        <th className="p-2">Email</th>
                        <th className="p-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
                      {contacts.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-xs text-slate-500">
                            No contact persons recorded for this customer.
                          </td>
                        </tr>
                      ) : (
                        contacts.map((c) => (
                          <tr key={c.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                            <td className="p-2 font-bold text-slate-900 dark:text-white">{c.name}</td>
                            <td className="p-2 text-slate-600 dark:text-slate-300">{c.designation}</td>
                            <td className="p-2 font-mono">{c.phone}</td>
                            <td className="p-2 font-mono text-[10px] text-slate-600 dark:text-slate-400 truncate max-w-[130px]">
                              {c.email}
                            </td>
                            <td className="p-2 text-right space-x-1">
                              <button
                                type="button"
                                onClick={() => onOpenContactModal?.(c)}
                                className="p-1 text-slate-400 hover:text-blue-600 rounded transition"
                              >
                                <Edit2 size={12} />
                              </button>
                              <button
                                type="button"
                                className="p-1 text-slate-400 hover:text-red-600 rounded transition"
                              >
                                <Trash2 size={12} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => onOpenContactModal?.()}
                    className="px-3 py-1.5 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 hover:bg-amber-100 rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-2xs"
                  >
                    <Plus size={14} />
                    <span>+ Add Contact</span>
                  </button>
                </div>
              </div>

            </div>

            {/* Card 7: Child Customers (12) */}
            <div
              id="sec-parent-child"
              className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs space-y-3.5"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-xs">
                    7
                  </div>
                  <div>
                    <h2 className="font-bold text-xs uppercase tracking-wide text-purple-700 dark:text-purple-400">
                      Child Customers ({childCustomers.length})
                    </h2>
                    {childSearch && (
                      <span className="text-[10px] text-slate-500 font-medium">
                        Showing {filteredChildCustomers.length} of {childCustomers.length}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Parent Setting: Show Child Customers in Billing */}
                  <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={Boolean(customer.showChildCustomersInBilling)}
                        onChange={(e) => {
                          onChange("showChildCustomersInBilling", e.target.checked);
                          onChange("show_child_customers_in_billing", e.target.checked);
                        }}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Show Child Customers in Billing
                      </span>
                    </label>
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                        customer.showChildCustomersInBilling
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                          : "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                      }`}
                      title="When enabled, eligible child customers under this parent can be searched and selected while creating bills or sales invoices."
                    >
                      {customer.showChildCustomersInBilling ? "ON" : "OFF"}
                    </span>
                  </div>

                  <div className="relative flex items-center">
                    <input
                      type="text"
                      placeholder="Search child accounts..."
                      value={childSearch}
                      onChange={(e) => setChildSearch(e.target.value)}
                      className="px-2.5 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 w-36 sm:w-48 focus:w-56 transition-all outline-none"
                    />
                    {childSearch && (
                      <button
                        type="button"
                        onClick={() => setChildSearch("")}
                        className="absolute right-2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                        title="Clear filter"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto max-h-[360px] overflow-y-auto">
                {filteredChildCustomers.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500">
                    {childSearch
                      ? <>No child customer accounts match <span className="font-bold font-mono">"{childSearch}"</span>.</>
                      : "No child customer accounts linked to this corporate account."}
                  </div>
                ) : (
                  <table className="w-full text-left text-xs border-collapse min-w-[650px]">
                    <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 font-bold text-[10px] uppercase text-slate-500 border-b border-slate-200 dark:border-slate-800 z-10">
                      <tr>
                        <th className="p-2">Customer Code</th>
                        <th className="p-2">Customer Name</th>
                        <th className="p-2">Store Code</th>
                        <th className="p-2">Location</th>
                        <th className="p-2">Status</th>
                        <th className="p-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
                      {filteredChildCustomers.map((cc) => (
                        <tr key={cc.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                          <td
                            className="p-2 font-mono font-bold text-[#00355f] dark:text-[#8ebdf9] cursor-pointer hover:underline"
                            onClick={() => {
                              if (onSelectCustomer) {
                                onSelectCustomer(cc.code);
                              } else {
                                onNotification?.("Child Account", `Opening child store account ${cc.code} - ${cc.name}...`, "info");
                              }
                            }}
                            title="Open Child Account Record"
                          >
                            {cc.code}
                          </td>
                          <td
                            className="p-2 font-bold text-slate-900 dark:text-white cursor-pointer hover:underline"
                            onClick={() => {
                              if (onSelectCustomer) {
                                onSelectCustomer(cc.code);
                              } else {
                                onNotification?.("Child Account", `Opening child store account ${cc.code} - ${cc.name}...`, "info");
                              }
                            }}
                            title="Open Child Account Record"
                          >
                            {cc.name}
                          </td>
                          <td className="p-2 font-mono">{cc.storeCode || "—"}</td>
                          <td className="p-2">{cc.location || "Mumbai"}</td>
                          <td className="p-2">
                            <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-bold">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              {cc.status || "Active"}
                            </span>
                          </td>
                          <td className="p-2 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                if (onSelectCustomer) {
                                  onSelectCustomer(cc.code);
                                } else {
                                  onNotification?.("Child Account", `Viewing child store account ${cc.code}...`, "info");
                                }
                              }}
                              className="p-1 text-slate-400 hover:text-blue-600 rounded transition"
                              title="Open Account Record"
                            >
                              <Edit2 size={12} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={onOpenAddChildModal}
                  className="px-3 py-1.5 bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 text-purple-800 dark:text-purple-300 hover:bg-purple-100 rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-2xs"
                >
                  <Plus size={14} />
                  <span>+ Add Child Customer</span>
                </button>
              </div>
            </div>

            {/* Row: Documents & Notes (Card 8) & Activity & Audit (Card 9) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              
              {/* Card 8: Documents & Notes */}
              <div
                id="sec-documents"
                className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs space-y-3.5"
              >
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="w-5 h-5 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold text-xs">
                    8
                  </div>
                  <h2 className="font-bold text-xs uppercase tracking-wide text-orange-700 dark:text-orange-400">
                    Documents &amp; Notes
                  </h2>
                </div>

                <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 font-bold text-[10px] uppercase text-slate-500 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="p-2">File Name</th>
                        <th className="p-2">Type</th>
                        <th className="p-2">Uploaded On</th>
                        <th className="p-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
                      {documents.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="p-8 text-center text-xs text-slate-500">
                            No compliance documents or agreements attached.
                          </td>
                        </tr>
                      ) : (
                        documents.map((doc) => (
                          <tr key={doc.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                            <td className="p-2 font-medium text-slate-900 dark:text-white flex items-center gap-1.5">
                              <Files size={13} className="text-blue-500 shrink-0" />
                              <span className="truncate">{doc.name}</span>
                            </td>
                            <td className="p-2 text-slate-500">{doc.type}</td>
                            <td className="p-2 font-mono text-[10px] text-slate-500">{doc.date}</td>
                            <td className="p-2 text-right space-x-1">
                              <button
                                type="button"
                                onClick={() => onNotification?.("Download Document", `Downloading ${doc.name}...`, "info")}
                                className="p-1 text-slate-400 hover:text-blue-600 rounded transition"
                                title="Download Document"
                              >
                                <Download size={12} />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
                                  onNotification?.("Document Removed", `${doc.name} removed from record.`, "info");
                                }}
                                className="p-1 text-slate-400 hover:text-red-600 rounded transition"
                                title="Delete Document"
                              >
                                <Trash2 size={12} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => onNotification?.("Upload Document", "Opening compliance file upload vault...", "info")}
                    className="px-3 py-1.5 bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 text-orange-800 dark:text-orange-300 hover:bg-orange-100 rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-2xs"
                  >
                    <Plus size={14} />
                    <span>+ Upload Document</span>
                  </button>
                </div>
              </div>

              {/* Card 9: Activity & Audit */}
              <div
                id="sec-activity-audit"
                className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs space-y-3.5"
              >
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="w-5 h-5 rounded-full bg-slate-700 text-white flex items-center justify-center font-bold text-xs">
                    9
                  </div>
                  <h2 className="font-bold text-xs uppercase tracking-wide text-slate-800 dark:text-slate-200">
                    Activity &amp; Audit
                  </h2>
                </div>

                <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 font-bold text-[10px] uppercase text-slate-500 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="p-2">Date &amp; Time</th>
                        <th className="p-2">Action</th>
                        <th className="p-2">By</th>
                        <th className="p-2">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
                      {auditLogs.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="p-8 text-center text-xs text-slate-500">
                            No audit activity recorded yet.
                          </td>
                        </tr>
                      ) : (
                        auditLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                            <td className="p-2 font-mono text-[10px] text-slate-500 whitespace-nowrap">
                              {log.dateTime}
                            </td>
                            <td className="p-2 font-bold text-slate-800 dark:text-slate-200">{log.action}</td>
                            <td className="p-2 font-mono text-slate-500">{log.by}</td>
                            <td className="p-2 text-slate-600 dark:text-slate-300">{log.details}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

          </div>

          {/* ── Right Sidebar (~35% width, w-96 to w-[420px]) ──────────────── */}
          <div className="w-full xl:w-[380px] 2xl:w-[420px] shrink-0 space-y-4">
            
            {/* Top Right: Parent – Child Hierarchy (Example) */}
            <CustomerHierarchyTree
              customer={customer}
              childrenNodes={childCustomers}
              onSelectCustomer={(code) => {
                if (onSelectCustomer) {
                  onSelectCustomer(code);
                } else {
                  onNotification?.("Customer Selected", `Navigating to child customer ${code}...`, "info");
                }
              }}
            />

            {/* Bottom Right: Tax Invoice (Example) */}
            <CustomerTaxInvoicePreview
              customer={customer}
              onOpenFullInvoice={(invNo) => {
                onNotification?.("Tax Invoice Viewer", `Opening invoice ${invNo}...`, "info");
              }}
            />

          </div>

        </div>

      </div>

    </div>
  );
};
