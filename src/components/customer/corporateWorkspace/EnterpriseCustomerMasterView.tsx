/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.99.0
 * Created      : 2026-10-20
 * Modified     : 2026-10-20
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
  gstRegistrations = [],
  onNotification,
}) => {
  const [activeSection, setActiveSection] = useState<CustomerMasterSectionId>("basic");
  const [addressSubTab, setAddressSubTab] = useState<"billing" | "delivery" | "registered">("billing");

  // Sample Documents & Notes matching reference screenshot
  const [documents, setDocuments] = useState<Array<{ id: string; name: string; type: string; date: string }>>([
    { id: "1", name: "GST Registration.pdf", type: "Tax Document", date: "12/04/2026" },
    { id: "2", name: "MSA_Reliance.pdf", type: "Agreement", date: "15/04/2026" },
    { id: "3", name: "PAN_Certificate.pdf", type: "KYC Document", date: "10/04/2026" },
    { id: "4", name: "Store_List.xlsx", type: "Reference", date: "10/05/2026" },
  ]);

  // Sample Audit Entries matching reference screenshot
  const auditLogs = [
    { id: "1", dateTime: "16/05/2026 10:30", action: "Updated", by: "admin", details: "Commercial terms changed" },
    { id: "2", dateTime: "12/05/2026 14:12", action: "Address Added", by: "admin", details: "New delivery address added" },
    { id: "3", dateTime: "05/04/2026 09:44", action: "Created", by: "admin", details: "Customer created" },
    { id: "4", dateTime: "02/04/2026 11:20", action: "Store Linked", by: "admin", details: "REL-MUM-001 linked" },
  ];

  // Sample Stores matching reference screenshot
  const storeNetwork = [
    { id: "1", code: "REL-MUM-001", name: "Phoenix Mall", location: "Mumbai", type: "Store", status: "Active" },
    { id: "2", code: "REL-MUM-002", name: "Inorbit Mall", location: "Mumbai", type: "Store", status: "Active" },
    { id: "3", code: "REL-PUN-001", name: "Amanora Mall", location: "Pune", type: "Store", status: "Active" },
    { id: "4", code: "REL-AHM-001", name: "AlphaOne Mall", location: "Ahmedabad", type: "Store", status: "Active" },
  ];

  // Sample Child Customers matching reference screenshot
  const childCustomers: HierarchyChildNode[] = [
    { id: "1", code: "REL001-001", name: "Reliance - Phoenix Mall", storeCode: "REL-MUM-001", location: "Mumbai", status: "Active" },
    { id: "2", code: "REL001-002", name: "Reliance - Inorbit Mall", storeCode: "REL-MUM-002", location: "Mumbai", status: "Active" },
    { id: "3", code: "REL001-003", name: "Reliance - Amanora Mall", storeCode: "REL-PUN-001", location: "Pune", status: "Active" },
    { id: "4", code: "REL001-004", name: "Reliance - AlphaOne", storeCode: "REL-AHM-001", location: "Ahmedabad", status: "Active" },
  ];

  // Sample Contacts matching reference screenshot
  const contacts = [
    { id: "1", name: "Amit Sharma", designation: "Purchase Head", phone: "9876543210", email: "amit@reliance.com" },
    { id: "2", name: "Neha Verma", designation: "Accounts", phone: "9876501234", email: "neha@reliance.com" },
    { id: "3", name: "Rajiv Mehta", designation: "Store Operations", phone: "9876512345", email: "rajiv@reliance.com" },
  ];

  // Addresses categorized
  const billingAddresses = useMemo(() => {
    return [
      {
        id: "b1",
        isDefault: true,
        name: "Head Office",
        address: "3rd Floor, MMRDA Building, BKC",
        city: "Mumbai",
        state: "Maharashtra",
        pin: "400051",
        gstin: customer.gstin || "27AABCR1234F1Z5",
      },
      {
        id: "b2",
        isDefault: false,
        name: "Regional Office",
        address: "R-Tech Park, MIDC",
        city: "Navi Mumbai",
        state: "Maharashtra",
        pin: "400710",
        gstin: "—",
      },
    ];
  }, [customer.gstin]);

  const deliveryAddresses = useMemo(() => {
    return [
      {
        id: "d1",
        isDefault: true,
        name: "Phoenix Mall Outlet",
        address: "Senapati Bapat Marg, Lower Parel",
        city: "Mumbai",
        state: "Maharashtra",
        pin: "400013",
        gstin: customer.gstin || "27AABCR1234F1Z5",
      },
      {
        id: "d2",
        isDefault: false,
        name: "Inorbit Mall Store",
        address: "Link Road, Malad West",
        city: "Mumbai",
        state: "Maharashtra",
        pin: "400064",
        gstin: customer.gstin || "27AABCR1234F1Z5",
      },
    ];
  }, [customer.gstin]);

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
                      value={customer.code || "REL001"}
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
                      value={customer.name || "Reliance Retail Limited"}
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
                      value={customer.shortName || customer.name || "Reliance Retail"}
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
                <CustomerSummaryCard customer={customer} />
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
                    value={customer.name || "Reliance Retail Limited"}
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
                    value={customer.gstin || "27AABCR1234F1Z5"}
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
                    value={customer.panNumber || "AABCR1234F"}
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
                    value={customer.iecNumber || "IEC1234567"}
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
                        ? `${customer.mailingAddresses[0].address1}, ${customer.mailingAddresses[0].locality || "Bandra-Kurla Complex"}, ${customer.mailingAddresses[0].city} - ${customer.mailingAddresses[0].postalCode}, ${customer.mailingAddresses[0].state}, India`
                        : "3rd Floor, Corporate Office, MMRDA Building, Bandra-Kurla Complex, Mumbai - 400051, Maharashtra, India"
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
                    value={customer.priceGroup || "Reliance Corporate"}
                    onChange={(e) => onChange("priceGroup", e.target.value)}
                    className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold outline-none focus:border-purple-500"
                  >
                    <option value="Reliance Corporate">Reliance Corporate</option>
                    <option value="Standard Retail">Standard Retail</option>
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
                    value={customer.paymentTerm || "30 Days"}
                    onChange={(e) => onChange("paymentTerm", e.target.value)}
                    className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold outline-none focus:border-purple-500"
                  >
                    <option value="30 Days">30 Days</option>
                    <option value="15 Days">15 Days</option>
                    <option value="45 Days">45 Days</option>
                    <option value="60 Days">60 Days</option>
                    <option value="Immediate">Immediate</option>
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
                    value={customer.creditLimit || 5000000}
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
                    value={customer.creditDays || 30}
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
                    value={customer.accountManager || "Corporate Sales"}
                    onChange={(e) => onChange("accountManager", e.target.value)}
                    className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none focus:border-purple-500"
                  >
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
                  Registered Office
                </button>
              </div>

              {/* Addresses Table */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse min-w-[650px]">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 font-bold text-[10px] uppercase text-slate-500 border-b border-slate-200 dark:border-slate-800">
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
                    {(addressSubTab === "billing" ? billingAddresses : deliveryAddresses).map((addr) => (
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
                    ))}
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
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="w-5 h-5 rounded-full bg-teal-600 text-white flex items-center justify-center font-bold text-xs">
                    5
                  </div>
                  <h2 className="font-bold text-xs uppercase tracking-wide text-teal-700 dark:text-teal-400">
                    Store / Outlet Network
                  </h2>
                </div>

                <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 font-bold text-[10px] uppercase text-slate-500 border-b border-slate-200 dark:border-slate-800">
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
                      {storeNetwork.map((st) => (
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
                      {contacts.map((c) => (
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
                      ))}
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
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                <div className="w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-xs">
                  7
                </div>
                <h2 className="font-bold text-xs uppercase tracking-wide text-purple-700 dark:text-purple-400">
                  Child Customers ({childCustomers.length})
                </h2>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse min-w-[650px]">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 font-bold text-[10px] uppercase text-slate-500 border-b border-slate-200 dark:border-slate-800">
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
                    {childCustomers.map((cc) => (
                      <tr key={cc.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="p-2 font-mono font-bold text-[#00355f] dark:text-[#8ebdf9]">{cc.code}</td>
                        <td className="p-2 font-bold text-slate-900 dark:text-white">{cc.name}</td>
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
                            className="p-1 text-slate-400 hover:text-blue-600 rounded transition"
                          >
                            <Edit2 size={12} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
                      {documents.map((doc) => (
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
                      ))}
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
                      {auditLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                          <td className="p-2 font-mono text-[10px] text-slate-500 whitespace-nowrap">
                            {log.dateTime}
                          </td>
                          <td className="p-2 font-bold text-slate-800 dark:text-slate-200">{log.action}</td>
                          <td className="p-2 font-mono text-slate-500">{log.by}</td>
                          <td className="p-2 text-slate-600 dark:text-slate-300">{log.details}</td>
                        </tr>
                      ))}
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
                onNotification?.("Customer Selected", `Navigating to child customer ${code}...`, "info");
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
