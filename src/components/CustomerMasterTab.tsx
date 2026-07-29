/**
 * Project      : SMRITI Retail OS v6.0
 * Module       : Customer Master & CRM Platform
 *                SMRITI Adaptive Form Framework v2.0 — Standard (B2C) & Corporate (B2B)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com and AITDL.com. All Rights Reserved.
 * Version      : 6.2.0
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { SmritiScrollArea } from "./SmritiScrollArea.tsx";
import { getCustomers, saveCustomers, getCustomerGroups } from "../services/customerStore.ts";
import { Customer, AdditionalAddress } from "../types";
import { recordAuditAction } from "../lib/apiFetch.ts";
import { apiFetchV1 } from "../lib/apiFetchV1.ts";
import { CustomerLedger } from "./customer/CustomerLedger.tsx";
import { FioriListReport, ListReportColumn } from "./common/FioriListReport.tsx";
import { FioriObjectPage, ObjectPageTab, ObjectPageMetric } from "./common/FioriObjectPage.tsx";
import {
  Users, UserCheck, Building2, Plus, Search, X, Phone, Mail, MapPin,
  CheckCircle2, AlertCircle, FileText, ShieldCheck, DollarSign,
  Briefcase, AlertTriangle, Scale, Award, CreditCard, Percent, Truck,
  Tag, Calendar, Clock, MessageSquare, Send, History, Lock, Unlock,
  CheckSquare, FileCheck, PackageCheck, TrendingUp, Trash2, UploadCloud,
  FilePlus, Star, ChevronRight, ChevronDown, ChevronUp, Zap, Settings2,
  RotateCcw, Save, AlertOctagon, Info, Globe, Store, Layers
} from "lucide-react";

/* ═══════════════════ TYPES & INTERFACES ═══════════════════ */
export type CustomerCategory = "standard" | "corporate";
export type CustomerFormMode = "quick" | "advanced";

export interface CustomerContactPerson {
  id: string;
  name: string;
  role: "Purchasing Head" | "Accounts Officer" | "Store Manager" | "Director" | "General";
  mobile: string;
  email: string;
  is_primary: boolean;
}

export interface CustomerDocumentRecord {
  id: string;
  doc_type: "GST Certificate" | "PAN Card" | "MSME Certificate" | "FSSAI License" | "Credit Agreement" | "Trade License";
  doc_number: string;
  expiry_date: string;
  status: "Valid" | "Expiring Soon" | "Expired";
  file_name?: string;
}

export interface CustomerCommunicationItem {
  id: string;
  timestamp: string;
  type: "Email" | "WhatsApp" | "Call" | "Payment Reminder" | "Sales Quotation";
  summary: string;
  user: string;
}

type SectionKey =
  | "company"
  | "gst"
  | "billing"
  | "shipping"
  | "contacts"
  | "credit"
  | "pricing"
  | "banking"
  | "documents"
  | "notes";

/* ═══════════════════ CONSTANTS ═══════════════════ */
const DRAFT_KEY = "smriti_customer_draft_v2";
const MODE_KEY  = "smriti_customer_form_mode_v2";

const GSTIN_STATE_MAP: Record<string, string> = {
  "01": "Jammu & Kashmir", "02": "Himachal Pradesh", "03": "Punjab",
  "04": "Chandigarh", "05": "Uttarakhand", "06": "Haryana",
  "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh",
  "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh",
  "13": "Nagaland", "14": "Manipur", "15": "Mizoram",
  "16": "Tripura", "17": "Meghalaya", "18": "Assam",
  "19": "West Bengal", "20": "Jharkhand", "21": "Odisha",
  "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat",
  "26": "Dadra and Nagar Haveli", "27": "Maharashtra", "28": "Andhra Pradesh",
  "29": "Karnataka", "30": "Goa", "31": "Lakshadweep",
  "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry",
  "35": "Andaman and Nicobar Islands", "36": "Telangana", "37": "Andhra Pradesh"
};

const INDIAN_STATES = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa",
  "Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala",
  "Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland",
  "Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura",
  "Uttar Pradesh","Uttarakhand","West Bengal","Andaman and Nicobar Islands",
  "Chandigarh","Dadra and Nagar Haveli","Daman and Diu","Delhi","Jammu & Kashmir",
  "Ladakh","Lakshadweep","Puducherry"
];

const BANKS = [
  "HDFC Bank","ICICI Bank","State Bank of India","Axis Bank","Kotak Mahindra Bank",
  "Punjab National Bank","Bank of Baroda","Canara Bank","Union Bank of India",
  "Bank of India","IndusInd Bank","Yes Bank","Federal Bank","IDFC First Bank"
];

/* ═══════════════════ BLANK FORM FORMULA ═══════════════════ */
const blankCustomerForm = () => ({
  code: `CUST-${Math.floor(100000 + Math.random() * 900000)}`,
  name: "",
  shortName: "",
  legal_name: "",
  category: "standard" as CustomerCategory,
  customerGroupId: "CG-Retail",
  pricingGroupId: "",
  mobile: "",
  alt_mobile: "",
  email: "",
  website: "",
  contact_person: "",
  designation: "Purchasing Head",
  // GST
  is_gst_registered: false,
  gstNumber: "",
  gst_type: "Regular",
  gst_category: "B2C",
  place_of_supply: "Maharashtra",
  pan: "",
  tan: "",
  cin: "",
  // TDS / TCS
  is_tds_applicable: false,
  tds_section: "194Q",
  tds_rate: "0.10",
  is_tcs_applicable: false,
  tcs_section: "206C(1H)",
  tcs_rate: "0.10",
  // Address
  billingAddressLine1: "",
  billingAddressLine2: "",
  billingCity: "Mumbai",
  billingState: "Maharashtra",
  billingPincode: "",
  billingCountry: "India",
  shippingSameAsBilling: true,
  shippingAddressLine1: "",
  shippingAddressLine2: "",
  shippingCity: "Mumbai",
  shippingState: "Maharashtra",
  shippingPincode: "",
  shippingCountry: "India",
  // Financial
  creditLimit: "50000",
  creditDays: "30",
  paymentTerms: "Net 30 Days",
  openingBalance: "0.00",
  // Banking
  bankName: "",
  accountName: "",
  accountNumber: "",
  ifscCode: "",
  branchName: "",
  upiId: "",
  // Sales & Operations
  salesperson: "",
  status: "Active" as "Active" | "Inactive" | "Blocked",
  tags: "",
  notes: "",
  effectiveFrom: "",
  effectiveTo: "",
  sortOrder: "1"
});

type CustomerFormData = ReturnType<typeof blankCustomerForm>;

export interface CustomerMasterTabProps {
  currentUser?: { role: string; name: string } | null;
  onNotification?: (title: string, message: string, type?: "success" | "error") => void;
}

/* ═══════════════════ COMPONENT ═══════════════════ */
export const CustomerMasterTab: React.FC<CustomerMasterTabProps> = ({
  currentUser,
  onNotification,
}) => {
  const isReadOnly = currentUser?.role === "Report User";

  /* ── Core Datastore State ── */
  const [customers, setCustomers] = useState<Customer[]>(() => getCustomers());
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  /* ── Adaptive Modal States ── */
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [customerCategory, setCustomerCategory] = useState<CustomerCategory>("standard");
  const [formMode, setFormMode] = useState<CustomerFormMode>(() => {
    try {
      return (localStorage.getItem(MODE_KEY) as CustomerFormMode) || "quick";
    } catch {
      return "quick";
    }
  });

  const [formData, setFormData] = useState<CustomerFormData>(blankCustomerForm);
  const [isDirty, setIsDirty] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  /* ── Collapsible Sections for Advanced Add ── */
  const [openSections, setOpenSections] = useState<Set<SectionKey>>(
    new Set(["company", "gst", "billing"])
  );

  /* ── Dynamic Child Lists ── */
  const [extraAddresses, setExtraAddresses] = useState<AdditionalAddress[]>([]);
  const [extraContacts, setExtraContacts] = useState<CustomerContactPerson[]>([]);
  const [attachedDocs, setAttachedDocs] = useState<CustomerDocumentRecord[]>([]);

  /* ── Pricing Groups & Customer Groups ── */
  const [pricingGroups, setPricingGroups] = useState<{ id: string; name: string; discount_percent: number }[]>([]);
  const customerGroups = getCustomerGroups();

  /* ── Draft Auto-Save System ── */
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveDraft = useCallback((data: CustomerFormData) => {
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      try {
        sessionStorage.setItem(DRAFT_KEY, JSON.stringify(data));
      } catch {
        /* storage quota exceeded */
      }
    }, 500);
  }, []);

  const clearDraft = useCallback(() => {
    try {
      sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
    setHasDraft(false);
  }, []);

  /* ── Setter Helper ── */
  const set = (field: string, value: any) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };
      // Auto-extract state from GSTIN prefix
      if (field === "gstNumber" && typeof value === "string" && value.length >= 2) {
        const prefix = value.substring(0, 2);
        const detectedState = GSTIN_STATE_MAP[prefix];
        if (detectedState) {
          next.place_of_supply = detectedState;
          next.billingState = detectedState;
          if (next.shippingSameAsBilling) next.shippingState = detectedState;
        }
      }
      saveDraft(next);
      setIsDirty(true);
      return next;
    });
    if (validationErrors[field]) {
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  /* ── Toggle Category (Standard B2C vs Corporate B2B) ── */
  const handleCategoryToggle = (cat: CustomerCategory) => {
    setCustomerCategory(cat);
    setFormData((prev) => {
      const next = {
        ...prev,
        category: cat,
        is_gst_registered: cat === "corporate",
        gst_category: cat === "corporate" ? "B2B" : "B2C",
        customerGroupId: cat === "corporate" ? "CG-Corporate" : "CG-Retail",
        creditLimit: cat === "corporate" ? "200000" : "50000",
        paymentTerms: cat === "corporate" ? "Net 30 Days" : "Cash on Delivery"
      };
      saveDraft(next);
      return next;
    });
  };

  /* ── Switch Form Mode (Quick vs Advanced) ── */
  const switchMode = (mode: CustomerFormMode) => {
    setFormMode(mode);
    try {
      localStorage.setItem(MODE_KEY, mode);
    } catch {
      /* ignore */
    }
    if (mode === "advanced") {
      setOpenSections(new Set(["company", "gst", "billing"]));
    }
  };

  /* ── Toggle Section Expansion ── */
  const toggleSection = (key: SectionKey) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  /* ── Fetch Pricing Groups ── */
  useEffect(() => {
    if (!isAddingCustomer) return;
    apiFetchV1("/crm/pricing-groups")
      .then((data: any) => {
        if (Array.isArray(data)) setPricingGroups(data);
        else if (data?.items) setPricingGroups(data.items);
      })
      .catch(() => setPricingGroups([]));
  }, [isAddingCustomer]);

  /* ── Open Modal with Draft Recovery ── */
  const handleOpenModal = () => {
    if (isReadOnly) {
      onNotification?.("Access Denied", "Read-Only operators cannot create customers.", "error");
      return;
    }
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as CustomerFormData;
        setFormData(saved);
        setCustomerCategory(saved.category || "standard");
        setHasDraft(true);
        setIsDirty(false);
        setIsAddingCustomer(true);
        return;
      }
    } catch {
      /* ignore bad json */
    }
    const fresh = blankCustomerForm();
    setFormData(fresh);
    setCustomerCategory("standard");
    setExtraAddresses([]);
    setExtraContacts([]);
    setAttachedDocs([]);
    setValidationErrors({});
    setIsDirty(false);
    setHasDraft(false);
    setIsAddingCustomer(true);
  };

  /* ── Discard Draft ── */
  const handleDiscardDraft = () => {
    clearDraft();
    const fresh = blankCustomerForm();
    setFormData(fresh);
    setCustomerCategory("standard");
    setExtraAddresses([]);
    setExtraContacts([]);
    setAttachedDocs([]);
    setIsDirty(false);
  };

  /* ── Close Modal Guard ── */
  const handleCloseModal = () => {
    if (isDirty) {
      const ok = window.confirm("You have unsaved changes. Discard them?");
      if (!ok) return;
      clearDraft();
    }
    setIsAddingCustomer(false);
    setIsDirty(false);
  };

  /* ── Dynamic Validation ── */
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = customerCategory === "corporate" ? "Company / Legal Name is required." : "Customer Full Name is required.";
    }
    if (!formData.mobile.trim()) {
      errors.mobile = "10-digit Mobile Number is required.";
    }

    if (customerCategory === "corporate" || formData.is_gst_registered) {
      if (formData.is_gst_registered) {
        if (!formData.gstNumber.trim()) {
          errors.gstNumber = "GSTIN is required when GST Registered.";
        } else if (formData.gstNumber.trim().length !== 15) {
          errors.gstNumber = "GSTIN must be exactly 15 characters.";
        }
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  /* ── Submit Customer Registration ── */
  const handleSubmit = async (e: React.FormEvent, saveAndNew = false) => {
    e.preventDefault();
    if (!validateForm()) {
      onNotification?.("Validation Error", "Please fill in all required fields.", "error");
      return;
    }

    setIsSubmitting(true);

    const generatedId = `CUST-${Date.now().toString().slice(-6)}`;
    const newCust: Customer = {
      id: generatedId,
      code: formData.code || generatedId,
      name: formData.name.trim(),
      shortName: formData.shortName.trim() || undefined,
      mobile: formData.mobile.trim(),
      email: formData.email.trim() || undefined,
      gstNumber: formData.gstNumber.trim() || undefined,
      pan: formData.pan.trim() || undefined,
      customerGroupId: formData.customerGroupId,
      pricingGroupId: formData.pricingGroupId || undefined,
      outstanding: parseFloat(formData.openingBalance) || 0,
      status: formData.status,
      createdDate: new Date().toISOString().slice(0, 10),
      notes: formData.notes.trim() || undefined,
      tags: formData.tags ? formData.tags.split(",").map((t) => t.trim()).filter(Boolean) : undefined,
      effectiveFrom: formData.effectiveFrom || undefined,
      effectiveTo: formData.effectiveTo || undefined,
      sortOrder: formData.sortOrder ? parseInt(formData.sortOrder, 10) : undefined,
      salesperson: formData.salesperson.trim() || undefined,
      billingAddressLine1: formData.billingAddressLine1.trim() || undefined,
      billingAddressLine2: formData.billingAddressLine2.trim() || undefined,
      billingCity: formData.billingCity.trim() || undefined,
      billingState: formData.billingState.trim() || undefined,
      billingCountry: formData.billingCountry.trim() || "India",
      billingPincode: formData.billingPincode.trim() || undefined,
      shippingSameAsBilling: formData.shippingSameAsBilling,
      shippingAddressLine1: formData.shippingSameAsBilling ? formData.billingAddressLine1.trim() || undefined : formData.shippingAddressLine1.trim() || undefined,
      shippingAddressLine2: formData.shippingSameAsBilling ? formData.billingAddressLine2.trim() || undefined : formData.shippingAddressLine2.trim() || undefined,
      shippingCity: formData.shippingSameAsBilling ? formData.billingCity.trim() || undefined : formData.shippingCity.trim() || undefined,
      shippingState: formData.shippingSameAsBilling ? formData.billingState.trim() || undefined : formData.shippingState.trim() || undefined,
      shippingCountry: formData.shippingSameAsBilling ? formData.billingCountry.trim() || "India" : formData.shippingCountry.trim() || "India",
      shippingPincode: formData.shippingSameAsBilling ? formData.billingPincode.trim() || undefined : formData.shippingPincode.trim() || undefined,
      additionalAddresses: extraAddresses.length > 0 ? extraAddresses : undefined,
    };

    try {
      await apiFetchV1("/crm/customers", {
        method: "POST",
        body: JSON.stringify({
          name: newCust.name,
          mobile: newCust.mobile,
          email: newCust.email,
          gstNumber: newCust.gstNumber,
          customerGroupId: newCust.customerGroupId
        })
      });
      onNotification?.("Customer Registered ✓", `${newCust.name} (${newCust.id}) created successfully.`, "success");
    } catch {
      onNotification?.("Customer Added Locally", `${newCust.name} added to directory.`, "success");
    } finally {
      const updated = [newCust, ...customers];
      setCustomers(updated);
      saveCustomers(updated);
      recordAuditAction("CREATE", "customers", newCust.id, `Registered ${customerCategory} customer: ${newCust.name}`);
      clearDraft();
      setIsSubmitting(false);

      if (saveAndNew) {
        const fresh = blankCustomerForm();
        setFormData(fresh);
        setExtraAddresses([]);
        setExtraContacts([]);
        setAttachedDocs([]);
        setValidationErrors({});
        setIsDirty(false);
      } else {
        setIsAddingCustomer(false);
        setSelectedCustomerId(newCust.id); // Open Object Page Workspace immediately
      }
    }
  };

  /* ── List Report Columns (WNG-002 Pattern) ── */
  const COLUMNS: ListReportColumn<Customer>[] = [
    {
      key: "id",
      label: "Customer ID",
      render: (c) => <span className="font-mono font-bold text-[#0a6ed1]">{c.id}</span>,
    },
    {
      key: "name",
      label: "Name & Legal Entity",
      render: (c) => (
        <div>
          <div className="font-bold text-theme-heading text-xs">{c.name}</div>
          {c.shortName && <div className="text-[10px] text-theme-muted font-mono">{c.shortName}</div>}
        </div>
      ),
    },
    {
      key: "mobile",
      label: "Contact & Email",
      render: (c) => (
        <div className="font-mono text-xs">
          <div className="text-theme-heading font-medium">{c.mobile || "—"}</div>
          <div className="text-[10px] text-theme-muted">{c.email || ""}</div>
        </div>
      ),
    },
    {
      key: "gstNumber",
      label: "GSTIN / PAN",
      render: (c) => (
        <div className="font-mono text-xs">
          <span className={c.gstNumber ? "text-cyan-400 font-bold" : "text-theme-muted"}>
            {c.gstNumber || "Unregistered"}
          </span>
          {c.pan && <span className="block text-[10px] text-theme-muted">PAN: {c.pan}</span>}
        </div>
      ),
    },
    {
      key: "outstanding",
      label: "Receivable Balance",
      align: "right",
      render: (c) => (
        <span className={`font-mono font-bold text-xs ${c.outstanding > 0 ? "text-rose-400" : "text-emerald-400"}`}>
          ₹{(c.outstanding || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      align: "center",
      render: (c) => (
        <span
          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
            c.status === "Active"
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
              : c.status === "Inactive"
              ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
              : "bg-rose-500/10 text-rose-400 border-rose-500/30"
          }`}
        >
          {c.status}
        </span>
      ),
    },
  ];

  /* ── Style Tokens ── */
  const inp = "w-full p-2.5 bg-theme-surface-2 border border-theme-divider rounded-lg text-theme-heading text-xs focus:outline-none focus:border-[#0a6ed1] focus:ring-1 focus:ring-[#0a6ed1]/20 transition-all placeholder:text-theme-muted";
  const inpErr = (f: string) => inp + (validationErrors[f] ? " border-rose-500 ring-1 ring-rose-500/20" : "");
  const inpMono = inp + " font-mono";
  const inpMonoErr = (f: string) => inpMono + (validationErrors[f] ? " border-rose-500 ring-1 ring-rose-500/20" : "");
  const lbl = "block font-bold text-theme-muted mb-1 text-[11px] uppercase tracking-wide";
  const sel = inp + " cursor-pointer";

  /* ── Collapsible Panel Component ── */
  const SectionPanel: React.FC<{
    sectionKey: SectionKey;
    title: string;
    icon: React.ReactNode;
    badge?: string | number;
    children: React.ReactNode;
  }> = ({ sectionKey, title, icon, badge, children }) => {
    const isOpen = openSections.has(sectionKey);
    return (
      <div className="border border-theme-divider rounded-xl overflow-hidden bg-theme-surface-2">
        <button
          type="button"
          onClick={() => toggleSection(sectionKey)}
          className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-theme-surface-3 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <span className="text-[#0a6ed1]">{icon}</span>
            <span className="font-bold text-theme-heading text-xs uppercase tracking-wide font-mono">{title}</span>
            {badge !== undefined && (
              <span className="px-2 py-0.5 bg-[#0a6ed1]/10 text-[#0a6ed1] rounded-full text-[10px] font-bold">{badge}</span>
            )}
          </div>
          {isOpen ? <ChevronUp className="w-4 h-4 text-theme-muted" /> : <ChevronDown className="w-4 h-4 text-theme-muted" />}
        </button>
        <AnimatePresence initial={false}>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              style={{ overflow: "hidden" }}
            >
              <div className="px-5 pb-5 pt-1 border-t border-theme-divider/50 space-y-4">
                {children}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  /* ════════════════════════════════════════════════════ */
  /*        RENDER OBJECT PAGE (SELECTED CUSTOMER)       */
  /* ════════════════════════════════════════════════════ */
  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

  if (selectedCustomer) {
    const objectPageTabs: ObjectPageTab[] = [
      {
        id: "profile",
        label: "Profile & Identity",
        content: (
          <div className="space-y-6 max-w-5xl font-sans text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-theme-surface-2 p-5 rounded-xl border border-theme-divider space-y-3">
                <span className="text-[10px] font-mono uppercase text-theme-muted tracking-wider block font-bold flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-[#0a6ed1]" /> Basic Identity & Contact
                </span>
                <div className="grid grid-cols-2 gap-3 pt-1 font-mono">
                  <div><span className="text-theme-muted text-[10px] uppercase block">Customer Name</span><span className="font-bold text-theme-heading text-sm">{selectedCustomer.name}</span></div>
                  <div><span className="text-theme-muted text-[10px] uppercase block">Mobile Number</span><span className="font-bold text-[#0a6ed1]">{selectedCustomer.mobile || "Unregistered"}</span></div>
                  <div><span className="text-theme-muted text-[10px] uppercase block">Email Address</span><span className="text-theme-heading truncate">{selectedCustomer.email || "Unregistered"}</span></div>
                  <div><span className="text-theme-muted text-[10px] uppercase block">Salesperson</span><span className="text-theme-heading">{selectedCustomer.salesperson || "Default Account Exec"}</span></div>
                </div>
              </div>

              <div className="bg-theme-surface-2 p-5 rounded-xl border border-theme-divider space-y-3">
                <span className="text-[10px] font-mono uppercase text-theme-muted tracking-wider block font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#0a6ed1]" /> GST & Tax Compliance
                </span>
                <div className="grid grid-cols-2 gap-3 pt-1 font-mono">
                  <div><span className="text-theme-muted text-[10px] uppercase block">GSTIN Registration</span><span className="font-bold text-cyan-400">{selectedCustomer.gstNumber || "Unregistered (B2C)"}</span></div>
                  <div><span className="text-theme-muted text-[10px] uppercase block">PAN Number</span><span className="text-theme-heading">{selectedCustomer.pan || "Unregistered"}</span></div>
                  <div><span className="text-theme-muted text-[10px] uppercase block">Customer Group</span><span className="text-theme-heading">{selectedCustomer.customerGroupId}</span></div>
                  <div><span className="text-theme-muted text-[10px] uppercase block">Pricing Tier</span><span className="text-theme-heading">{selectedCustomer.pricingGroupId || "Standard Retail"}</span></div>
                </div>
              </div>
            </div>

            {selectedCustomer.tags && selectedCustomer.tags.length > 0 && (
              <div className="bg-theme-surface-2 p-4 rounded-xl border border-theme-divider">
                <span className="text-[10px] font-mono uppercase text-theme-muted tracking-wider block font-bold mb-2">Customer Tags</span>
                <div className="flex flex-wrap gap-1.5">
                  {selectedCustomer.tags.map((tag, idx) => (
                    <span key={idx} className="bg-theme-surface-3 border border-theme-divider text-[#0a6ed1] text-xs px-2.5 py-1 rounded-lg font-mono font-bold">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {selectedCustomer.notes && (
              <div className="bg-theme-surface-2 p-4 rounded-xl border border-theme-divider">
                <span className="text-[10px] font-mono uppercase text-theme-muted tracking-wider block font-bold mb-1">Internal Account Comments</span>
                <p className="text-theme-heading text-xs leading-relaxed whitespace-pre-wrap">{selectedCustomer.notes}</p>
              </div>
            )}
          </div>
        ),
      },
      {
        id: "addresses",
        label: "Addresses & Shipping",
        content: (
          <div className="space-y-4 max-w-5xl font-sans text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-theme-surface-2 p-4 rounded-xl border border-theme-divider space-y-2">
                <span className="text-[10px] font-mono uppercase text-[#0a6ed1] tracking-wider font-bold block">Primary Billing Address</span>
                {selectedCustomer.billingAddressLine1 ? (
                  <p className="text-theme-heading leading-relaxed font-mono">
                    {selectedCustomer.billingAddressLine1}
                    {selectedCustomer.billingAddressLine2 ? `, ${selectedCustomer.billingAddressLine2}` : ""}<br />
                    {selectedCustomer.billingCity}, {selectedCustomer.billingState} - {selectedCustomer.billingPincode}<br />
                    {selectedCustomer.billingCountry}
                  </p>
                ) : (
                  <p className="text-theme-muted italic">No billing address listed.</p>
                )}
              </div>

              <div className="bg-theme-surface-2 p-4 rounded-xl border border-theme-divider space-y-2">
                <span className="text-[10px] font-mono uppercase text-emerald-400 tracking-wider font-bold block">Shipping Location</span>
                {selectedCustomer.shippingSameAsBilling !== false ? (
                  <p className="text-theme-muted italic">Same as Billing Address</p>
                ) : selectedCustomer.shippingAddressLine1 ? (
                  <p className="text-theme-heading leading-relaxed font-mono">
                    {selectedCustomer.shippingAddressLine1}
                    {selectedCustomer.shippingAddressLine2 ? `, ${selectedCustomer.shippingAddressLine2}` : ""}<br />
                    {selectedCustomer.shippingCity}, {selectedCustomer.shippingState} - {selectedCustomer.shippingPincode}<br />
                    {selectedCustomer.shippingCountry}
                  </p>
                ) : (
                  <p className="text-theme-muted italic">No shipping address listed.</p>
                )}
              </div>
            </div>

            {selectedCustomer.additionalAddresses && selectedCustomer.additionalAddresses.length > 0 && (
              <div className="bg-theme-surface-2 p-4 rounded-xl border border-theme-divider space-y-3">
                <span className="text-[10px] font-mono uppercase text-theme-muted tracking-wider font-bold block">Linked Warehouses &amp; Branch Locations ({selectedCustomer.additionalAddresses.length})</span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {selectedCustomer.additionalAddresses.map((addr, idx) => (
                    <div key={idx} className="bg-theme-surface-1 p-3 rounded-xl border border-theme-divider font-mono space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-theme-heading text-xs">{addr.label}</span>
                        <span className="bg-[#0a6ed1]/10 text-[#0a6ed1] px-2 py-0.5 rounded text-[10px] uppercase font-bold">{addr.address_type}</span>
                      </div>
                      <p className="text-theme-muted text-xs">{addr.line1}, {addr.city}, {addr.state} - {addr.pincode}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ),
      },
      {
        id: "ledger",
        label: "Financial Ledger & History",
        content: (
          <div className="max-w-5xl font-mono text-xs">
            <CustomerLedger customer={selectedCustomer} />
          </div>
        ),
      },
    ];

    const metrics: ObjectPageMetric[] = [
      { label: "Receivable Balance", value: `₹${(selectedCustomer.outstanding || 0).toLocaleString("en-IN")}`, highlight: true },
      { label: "GSTIN Status", value: selectedCustomer.gstNumber || "Unregistered" },
      { label: "Customer Group", value: selectedCustomer.customerGroupId || "CG-Retail" },
      { label: "Pricing Tier", value: selectedCustomer.pricingGroupId || "Standard" },
    ];

    return (
      <div className="flex flex-col h-full bg-theme-base p-6">
        <FioriObjectPage
          title={selectedCustomer.name}
          subtitle={`Customer ID: ${selectedCustomer.id} | Mobile: ${selectedCustomer.mobile || "Unregistered"}`}
          badgeStatus={{
            label: selectedCustomer.status,
            type: selectedCustomer.status === "Active" ? "success" : selectedCustomer.status === "Inactive" ? "warning" : "error",
          }}
          metrics={metrics}
          tabs={objectPageTabs}
          onBack={() => setSelectedCustomerId(null)}
        />
      </div>
    );
  }

  /* ════════════════════════════════════════════════════ */
  /*         MAIN RENDER (DIRECTORY LIST REPORT)          */
  /* ════════════════════════════════════════════════════ */
  return (
    <div className="flex flex-col h-full bg-theme-base text-theme-body">
      {/* Read-Only Banner */}
      {isReadOnly && (
        <div className="bg-amber-950/40 border-b border-amber-500/30 px-6 py-2.5 flex items-center space-x-2 text-amber-400 text-xs flex-shrink-0">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="font-mono uppercase tracking-wider font-bold">Read-Only Mode:</span>
          <span>Operating under a Read-Only Report User role. Registering or modifying customer profiles is disabled.</span>
        </div>
      )}

      {/* List Report Directory View */}
      <div className="flex-1 overflow-hidden">
        <FioriListReport<Customer>
          title="Customer Master Data"
          subtitle="Single source of truth for Standard Retail Customers (B2C) & Corporate Enterprise Accounts (B2B)"
          data={customers}
          columns={COLUMNS}
          onRowClick={(c) => setSelectedCustomerId(c.id)}
          searchPlaceholder="Search customers by name, mobile, GSTIN, PAN, or Customer ID..."
          onCreateNew={!isReadOnly ? handleOpenModal : undefined}
          primaryActionLabel="Register New Customer"
          filterOptions={[
            {
              key: "status",
              label: "Status",
              options: [
                { label: "Active", value: "Active" },
                { label: "Inactive", value: "Inactive" },
                { label: "Blocked", value: "Blocked" },
              ],
            },
            {
              key: "customerGroupId",
              label: "Group",
              options: customerGroups.map((g) => ({ label: g.name, value: g.id })),
            },
          ]}
        />
      </div>

      {/* ════════════════════════════════════════════════ */}
      {/*      SMRITI ADAPTIVE CUSTOMER ONBOARDING MODAL    */}
      {/* ════════════════════════════════════════════════ */}
      {isAddingCustomer && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ duration: 0.18 }}
            className="bg-theme-surface-1 border border-theme-divider rounded-2xl w-full shadow-2xl flex flex-col overflow-hidden"
            style={{ maxWidth: formMode === "quick" ? 640 : 880, maxHeight: "94vh" }}
          >
            {/* ── Modal Header ── */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-theme-divider bg-theme-surface-2">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${customerCategory === "corporate" ? "bg-purple-500/10 text-purple-400" : "bg-[#0a6ed1]/10 text-[#0a6ed1]"}`}>
                  {customerCategory === "corporate" ? <Building2 className="w-5 h-5" /> : <Users className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-theme-heading font-display">
                    {formMode === "quick"
                      ? customerCategory === "corporate" ? "Quick Add — Corporate Customer (B2B)" : "Quick Add — Standard Customer (B2C)"
                      : customerCategory === "corporate" ? "Advanced Onboarding — Corporate Enterprise Account" : "Advanced Onboarding — Customer Master"}
                  </h3>
                  <p className="text-[11px] text-theme-muted font-mono">
                    {formMode === "quick" ? "Minimal essentials for fast registration under 15–30 seconds." : "Complete 10-panel enterprise profile. Expand panels as needed."}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isDirty && (
                  <span className="px-2.5 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-lg text-[10px] font-bold font-mono flex items-center gap-1">
                    <Save className="w-3 h-3" /> Unsaved Changes
                  </span>
                )}
                <button onClick={handleCloseModal} className="p-1.5 text-theme-muted hover:text-theme-heading rounded-lg cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* ── Draft Recovery Banner ── */}
            {hasDraft && (
              <div className="px-6 py-2.5 bg-[#0a6ed1]/5 border-b border-[#0a6ed1]/20 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-[#0a6ed1]">
                  <Info className="w-4 h-4 flex-shrink-0" />
                  <span><strong>Draft recovered.</strong> Your previous unsaved customer inputs have been restored.</span>
                </div>
                <button onClick={handleDiscardDraft} className="flex items-center gap-1 text-[11px] text-theme-muted hover:text-rose-400 font-mono cursor-pointer transition-colors">
                  <RotateCcw className="w-3 h-3" /> Discard Draft
                </button>
              </div>
            )}

            {/* ── Customer Type & Mode Switchers ── */}
            <div className="px-6 pt-4 pb-2 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 border-b border-theme-divider/50 bg-theme-surface-2/40">

              {/* Customer Category Segmented Toggle */}
              <div className="flex items-center bg-theme-surface-3 p-1 rounded-xl border border-theme-divider">
                <button
                  type="button"
                  onClick={() => handleCategoryToggle("standard")}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    customerCategory === "standard"
                      ? "bg-[#0a6ed1] text-white shadow-xs"
                      : "text-theme-muted hover:text-theme-heading"
                  }`}
                >
                  <Users className="w-3.5 h-3.5" /> Standard Customer (B2C)
                </button>
                <button
                  type="button"
                  onClick={() => handleCategoryToggle("corporate")}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    customerCategory === "corporate"
                      ? "bg-purple-600 text-white shadow-xs"
                      : "text-theme-muted hover:text-theme-heading"
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5" /> Corporate Customer (B2B)
                </button>
              </div>

              {/* Quick vs Advanced Mode Switcher Pills */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => switchMode("quick")}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                    formMode === "quick"
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/40"
                      : "bg-theme-surface-2 text-theme-muted border-theme-divider hover:border-emerald-500/40"
                  }`}
                >
                  <Zap className="w-3.5 h-3.5" /> Quick Add
                </button>
                <button
                  type="button"
                  onClick={() => switchMode("advanced")}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                    formMode === "advanced"
                      ? "bg-purple-500/10 text-purple-400 border-purple-500/40"
                      : "bg-theme-surface-2 text-theme-muted border-theme-divider hover:border-purple-500/40"
                  }`}
                >
                  <Settings2 className="w-3.5 h-3.5" /> Advanced Add
                </button>
              </div>
            </div>

            {/* ── Form Body ── */}
            <SmritiScrollArea className="flex-1 overflow-y-auto px-6 pb-2">
              <form id="customer-form" onSubmit={(e) => handleSubmit(e, false)} className="space-y-4 text-xs font-sans py-3">

                {/* ════════════════════════════════════════ */}
                {/*             QUICK ADD MODE               */}
                {/* ════════════════════════════════════════ */}
                {formMode === "quick" && (
                  <div className="space-y-4">

                    {/* Standard B2C Quick Add */}
                    {customerCategory === "standard" && (
                      <div className="p-4 bg-theme-surface-2 border border-theme-divider rounded-xl space-y-4">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-theme-heading uppercase tracking-wide font-mono flex items-center gap-2">
                            <Users className="w-4 h-4 text-[#0a6ed1]" /> Standard Retail Customer Essentials
                          </span>
                          <span className="text-[10px] font-mono text-emerald-400 font-bold">Target: &lt; 15 seconds</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="md:col-span-2">
                            <label className={lbl}>Full Customer Name <span className="text-rose-400">*</span></label>
                            <input
                              type="text"
                              required
                              placeholder="e.g. Rahul Sharma"
                              value={formData.name}
                              onChange={(e) => set("name", e.target.value)}
                              className={inpErr("name")}
                              autoFocus
                            />
                            {validationErrors.name && (
                              <p className="text-rose-400 text-[10px] mt-1 flex items-center gap-1"><AlertOctagon className="w-3 h-3" />{validationErrors.name}</p>
                            )}
                          </div>

                          <div>
                            <label className={lbl}>Mobile Number <span className="text-rose-400">*</span></label>
                            <input
                              type="tel"
                              required
                              placeholder="e.g. 9820012345"
                              value={formData.mobile}
                              onChange={(e) => set("mobile", e.target.value)}
                              className={inpMonoErr("mobile")}
                            />
                            {validationErrors.mobile && (
                              <p className="text-rose-400 text-[10px] mt-1 flex items-center gap-1"><AlertOctagon className="w-3 h-3" />{validationErrors.mobile}</p>
                            )}
                          </div>

                          <div>
                            <label className={lbl}>Email Address</label>
                            <input
                              type="email"
                              placeholder="customer@example.com"
                              value={formData.email}
                              onChange={(e) => set("email", e.target.value)}
                              className={inpMono}
                            />
                          </div>

                          <div>
                            <label className={lbl}>City</label>
                            <input
                              type="text"
                              placeholder="e.g. Mumbai"
                              value={formData.billingCity}
                              onChange={(e) => set("billingCity", e.target.value)}
                              className={inp}
                            />
                          </div>

                          <div>
                            <label className={lbl}>Pricing Group / Tier</label>
                            <select
                              value={formData.pricingGroupId}
                              onChange={(e) => set("pricingGroupId", e.target.value)}
                              className={sel}
                            >
                              <option value="">Standard Retail Price</option>
                              {pricingGroups.map((pg) => (
                                <option key={pg.id} value={pg.id}>
                                  {pg.name} ({pg.discount_percent}% off)
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="md:col-span-2">
                            <label className={lbl}>Address / Area</label>
                            <input
                              type="text"
                              placeholder="Flat/House No., Street, Locality"
                              value={formData.billingAddressLine1}
                              onChange={(e) => set("billingAddressLine1", e.target.value)}
                              className={inp}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Corporate B2B Quick Add */}
                    {customerCategory === "corporate" && (
                      <div className="p-4 bg-theme-surface-2 border border-theme-divider rounded-xl space-y-4">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-theme-heading uppercase tracking-wide font-mono flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-purple-400" /> Corporate B2B Account Essentials
                          </span>
                          <span className="text-[10px] font-mono text-purple-400 font-bold">Target: &lt; 30 seconds</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="md:col-span-2">
                            <label className={lbl}>Corporate / Legal Entity Name <span className="text-rose-400">*</span></label>
                            <input
                              type="text"
                              required
                              placeholder="e.g. Reliance Retail Industries Ltd"
                              value={formData.name}
                              onChange={(e) => set("name", e.target.value)}
                              className={inpErr("name")}
                              autoFocus
                            />
                            {validationErrors.name && (
                              <p className="text-rose-400 text-[10px] mt-1 flex items-center gap-1"><AlertOctagon className="w-3 h-3" />{validationErrors.name}</p>
                            )}
                          </div>

                          <div>
                            <label className={lbl}>Contact Person Name</label>
                            <input
                              type="text"
                              placeholder="e.g. Amit Varma"
                              value={formData.contact_person}
                              onChange={(e) => set("contact_person", e.target.value)}
                              className={inp}
                            />
                          </div>

                          <div>
                            <label className={lbl}>Corporate Mobile <span className="text-rose-400">*</span></label>
                            <input
                              type="tel"
                              required
                              placeholder="e.g. 9833311223"
                              value={formData.mobile}
                              onChange={(e) => set("mobile", e.target.value)}
                              className={inpMonoErr("mobile")}
                            />
                            {validationErrors.mobile && (
                              <p className="text-rose-400 text-[10px] mt-1 flex items-center gap-1"><AlertOctagon className="w-3 h-3" />{validationErrors.mobile}</p>
                            )}
                          </div>

                          {/* GST Registration Block */}
                          <div className="md:col-span-2 border-t border-theme-divider/50 pt-3">
                            <div className="flex items-center gap-3 mb-3">
                              <span className={lbl + " mb-0"}>GST Registered?</span>
                              {[{ v: true, l: "Yes — B2B Tax Invoice" }, { v: false, l: "No / Composition" }].map((opt) => (
                                <button
                                  key={opt.l}
                                  type="button"
                                  onClick={() => set("is_gst_registered", opt.v)}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                                    formData.is_gst_registered === opt.v
                                      ? opt.v ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/40" : "bg-slate-500/10 text-slate-400 border-slate-500/30"
                                      : "bg-theme-surface-1 text-theme-muted border-theme-divider hover:border-theme-muted"
                                  }`}
                                >
                                  {opt.l}
                                </button>
                              ))}
                            </div>

                            <AnimatePresence>
                              {formData.is_gst_registered && (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: "auto" }}
                                  exit={{ opacity: 0, height: 0 }}
                                  transition={{ duration: 0.18 }}
                                  className="grid grid-cols-1 md:grid-cols-2 gap-4"
                                >
                                  <div>
                                    <label className={lbl}>GSTIN (15-digit) <span className="text-rose-400">*</span></label>
                                    <input
                                      type="text"
                                      placeholder="e.g. 27AAACR1234F1Z5"
                                      maxLength={15}
                                      value={formData.gstNumber}
                                      onChange={(e) => set("gstNumber", e.target.value.toUpperCase())}
                                      className={inpMonoErr("gstNumber")}
                                    />
                                    {validationErrors.gstNumber && (
                                      <p className="text-rose-400 text-[10px] mt-1 flex items-center gap-1"><AlertOctagon className="w-3 h-3" />{validationErrors.gstNumber}</p>
                                    )}
                                    {formData.gstNumber.length >= 2 && GSTIN_STATE_MAP[formData.gstNumber.substring(0, 2)] && (
                                      <p className="text-emerald-400 text-[10px] mt-1 flex items-center gap-1">
                                        <CheckCircle2 className="w-3 h-3" /> State Auto-Detected: {GSTIN_STATE_MAP[formData.gstNumber.substring(0, 2)]}
                                      </p>
                                    )}
                                  </div>

                                  <div>
                                    <label className={lbl}>Place of Supply</label>
                                    <select
                                      value={formData.place_of_supply}
                                      onChange={(e) => set("place_of_supply", e.target.value)}
                                      className={sel}
                                    >
                                      {INDIAN_STATES.map((s) => (
                                        <option key={s} value={s}>{s}</option>
                                      ))}
                                    </select>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>

                          <div>
                            <label className={lbl}>Credit Limit (₹)</label>
                            <input
                              type="number"
                              step="1000"
                              placeholder="200000"
                              value={formData.creditLimit}
                              onChange={(e) => set("creditLimit", e.target.value)}
                              className={inpMono}
                            />
                          </div>

                          <div>
                            <label className={lbl}>Payment Terms</label>
                            <select
                              value={formData.paymentTerms}
                              onChange={(e) => set("paymentTerms", e.target.value)}
                              className={sel}
                            >
                              {["Net 7 Days", "Net 15 Days", "Net 30 Days", "Net 45 Days", "Net 60 Days", "Advance Payment", "Letter of Credit"].map((pt) => (
                                <option key={pt} value={pt}>{pt}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Switch to Advanced Button Link */}
                    <button
                      type="button"
                      onClick={() => switchMode("advanced")}
                      className="w-full py-2.5 border border-dashed border-purple-500/40 rounded-xl text-xs font-bold text-purple-400 hover:bg-purple-500/5 transition-colors cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Settings2 className="w-3.5 h-3.5" /> Switch to Advanced Add — Full Enterprise Workspace →
                    </button>
                  </div>
                )}

                {/* ════════════════════════════════════════ */}
                {/*            ADVANCED ADD MODE             */}
                {/* ════════════════════════════════════════ */}
                {formMode === "advanced" && (
                  <div className="space-y-3">

                    {/* 1. Company & Identity */}
                    <SectionPanel sectionKey="company" title="Company & Identity" icon={<Building2 className="w-4 h-4" />}>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-2">
                          <label className={lbl}>{customerCategory === "corporate" ? "Corporate Legal Entity Name" : "Customer Full Name"} <span className="text-rose-400">*</span></label>
                          <input
                            type="text"
                            required
                            placeholder="Full name as per legal records"
                            value={formData.name}
                            onChange={(e) => set("name", e.target.value)}
                            className={inpErr("name")}
                          />
                          {validationErrors.name && (
                            <p className="text-rose-400 text-[10px] mt-1 flex items-center gap-1"><AlertOctagon className="w-3 h-3" />{validationErrors.name}</p>
                          )}
                        </div>

                        <div>
                          <label className={lbl}>Customer Code</label>
                          <input
                            type="text"
                            value={formData.code}
                            onChange={(e) => set("code", e.target.value)}
                            className={inpMono}
                          />
                        </div>

                        <div>
                          <label className={lbl}>Short / Display Name</label>
                          <input
                            type="text"
                            placeholder="Short name for invoices"
                            value={formData.shortName}
                            onChange={(e) => set("shortName", e.target.value)}
                            className={inp}
                          />
                        </div>

                        <div>
                          <label className={lbl}>Customer Group</label>
                          <select
                            value={formData.customerGroupId}
                            onChange={(e) => set("customerGroupId", e.target.value)}
                            className={sel}
                          >
                            {customerGroups.map((cg) => (
                              <option key={cg.id} value={cg.id}>{cg.name}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className={lbl}>Account Status</label>
                          <select
                            value={formData.status}
                            onChange={(e) => set("status", e.target.value as any)}
                            className={sel}
                          >
                            <option value="Active">Active</option>
                            <option value="Inactive">Inactive</option>
                            <option value="Blocked">Blocked / On Hold</option>
                          </select>
                        </div>

                        <div>
                          <label className={lbl}>Assigned Salesperson</label>
                          <input
                            type="text"
                            placeholder="e.g. Ramesh Chandra"
                            value={formData.salesperson}
                            onChange={(e) => set("salesperson", e.target.value)}
                            className={inp}
                          />
                        </div>

                        <div>
                          <label className={lbl}>Primary Mobile <span className="text-rose-400">*</span></label>
                          <input
                            type="tel"
                            required
                            placeholder="+91 98200 12345"
                            value={formData.mobile}
                            onChange={(e) => set("mobile", e.target.value)}
                            className={inpMonoErr("mobile")}
                          />
                        </div>

                        <div>
                          <label className={lbl}>Alternate Mobile</label>
                          <input
                            type="tel"
                            placeholder="+91 98200 00000"
                            value={formData.alt_mobile}
                            onChange={(e) => set("alt_mobile", e.target.value)}
                            className={inpMono}
                          />
                        </div>

                        <div>
                          <label className={lbl}>Primary Email</label>
                          <input
                            type="email"
                            placeholder="accounts@company.com"
                            value={formData.email}
                            onChange={(e) => set("email", e.target.value)}
                            className={inpMono}
                          />
                        </div>

                        <div>
                          <label className={lbl}>Website URL</label>
                          <input
                            type="url"
                            placeholder="https://company.com"
                            value={formData.website}
                            onChange={(e) => set("website", e.target.value)}
                            className={inpMono}
                          />
                        </div>
                      </div>
                    </SectionPanel>

                    {/* 2. GST & Compliance */}
                    <SectionPanel sectionKey="gst" title="GST & Compliance" icon={<ShieldCheck className="w-4 h-4" />}>
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <span className={lbl + " mb-0"}>GST Registration Status:</span>
                          {[{ v: true, l: "Yes — Tax Registered (B2B)" }, { v: false, l: "No — Unregistered (B2C)" }].map((opt) => (
                            <button
                              key={opt.l}
                              type="button"
                              onClick={() => set("is_gst_registered", opt.v)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                                formData.is_gst_registered === opt.v
                                  ? opt.v ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/40" : "bg-slate-500/10 text-slate-400 border-slate-500/30"
                                  : "bg-theme-surface-1 text-theme-muted border-theme-divider"
                              }`}
                            >
                              {opt.l}
                            </button>
                          ))}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {formData.is_gst_registered && (
                            <>
                              <div>
                                <label className={lbl}>GSTIN (15-digit) <span className="text-rose-400">*</span></label>
                                <input
                                  type="text"
                                  placeholder="27AAACR1234F1Z5"
                                  maxLength={15}
                                  value={formData.gstNumber}
                                  onChange={(e) => set("gstNumber", e.target.value.toUpperCase())}
                                  className={inpMonoErr("gstNumber")}
                                />
                                {validationErrors.gstNumber && <p className="text-rose-400 text-[10px] mt-1">{validationErrors.gstNumber}</p>}
                                {formData.gstNumber.length >= 2 && GSTIN_STATE_MAP[formData.gstNumber.substring(0, 2)] && (
                                  <p className="text-emerald-400 text-[10px] mt-1">✓ State: {GSTIN_STATE_MAP[formData.gstNumber.substring(0, 2)]}</p>
                                )}
                              </div>

                              <div>
                                <label className={lbl}>GST Category</label>
                                <select value={formData.gst_type} onChange={(e) => set("gst_type", e.target.value)} className={sel}>
                                  {["Regular", "Composition", "SEZ Unit", "SEZ Developer", "Embassy/UN Body", "TDS Deductor", "Unregistered"].map((t) => (
                                    <option key={t} value={t}>{t}</option>
                                  ))}
                                </select>
                              </div>
                            </>
                          )}

                          <div>
                            <label className={lbl}>Place of Supply</label>
                            <select value={formData.place_of_supply} onChange={(e) => set("place_of_supply", e.target.value)} className={sel}>
                              {INDIAN_STATES.map((s) => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className={lbl}>PAN Number</label>
                            <input
                              type="text"
                              placeholder="ABCDE1234F"
                              maxLength={10}
                              value={formData.pan}
                              onChange={(e) => set("pan", e.target.value.toUpperCase())}
                              className={inpMono}
                            />
                          </div>

                          <div>
                            <label className={lbl}>TAN Number</label>
                            <input
                              type="text"
                              placeholder="MUMB12345F"
                              value={formData.tan}
                              onChange={(e) => set("tan", e.target.value.toUpperCase())}
                              className={inpMono}
                            />
                          </div>

                          <div>
                            <label className={lbl}>CIN Number</label>
                            <input
                              type="text"
                              placeholder="U72200MH2010PLC123456"
                              value={formData.cin}
                              onChange={(e) => set("cin", e.target.value.toUpperCase())}
                              className={inpMono}
                            />
                          </div>

                          <div>
                            <label className={lbl}>TCS Sec 206C(1H) Applicable</label>
                            <select value={formData.is_tcs_applicable ? "true" : "false"} onChange={(e) => set("is_tcs_applicable", e.target.value === "true")} className={sel}>
                              <option value="true">Yes — Collect TCS on High Turnover</option>
                              <option value="false">No — Exempt</option>
                            </select>
                          </div>

                          {formData.is_tcs_applicable && (
                            <div>
                              <label className={lbl}>TCS Rate (%)</label>
                              <input type="number" step="0.01" value={formData.tcs_rate} onChange={(e) => set("tcs_rate", e.target.value)} className={inpMono} />
                            </div>
                          )}
                        </div>
                      </div>
                    </SectionPanel>

                    {/* 3. Billing Address */}
                    <SectionPanel sectionKey="billing" title="Billing Address" icon={<MapPin className="w-4 h-4" />}>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="md:col-span-2">
                          <label className={lbl}>Building / Flat / House No.</label>
                          <input type="text" placeholder="Plot No. 45, Tower B" value={formData.billingAddressLine1} onChange={(e) => set("billingAddressLine1", e.target.value)} className={inp} />
                        </div>
                        <div>
                          <label className={lbl}>Street / Road</label>
                          <input type="text" placeholder="MIDC Industrial Area" value={formData.billingAddressLine2} onChange={(e) => set("billingAddressLine2", e.target.value)} className={inp} />
                        </div>
                        <div>
                          <label className={lbl}>City</label>
                          <input type="text" value={formData.billingCity} onChange={(e) => set("billingCity", e.target.value)} className={inp} />
                        </div>
                        <div>
                          <label className={lbl}>State</label>
                          <select value={formData.billingState} onChange={(e) => set("billingState", e.target.value)} className={sel}>
                            {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className={lbl}>PIN Code</label>
                          <input type="text" maxLength={6} placeholder="400093" value={formData.billingPincode} onChange={(e) => set("billingPincode", e.target.value)} className={inpMono} />
                        </div>
                      </div>
                    </SectionPanel>

                    {/* 4. Shipping Addresses */}
                    <SectionPanel sectionKey="shipping" title="Shipping Addresses" icon={<Truck className="w-4 h-4" />} badge={extraAddresses.length > 0 ? extraAddresses.length + 1 : undefined}>
                      <div className="space-y-4">
                        <div className="p-3 bg-theme-surface-1 border border-theme-divider rounded-xl flex items-center justify-between">
                          <span className="text-xs font-bold text-theme-heading">Shipping Same as Billing Address?</span>
                          <button
                            type="button"
                            onClick={() => set("shippingSameAsBilling", !formData.shippingSameAsBilling)}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                              formData.shippingSameAsBilling
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/40"
                                : "bg-slate-500/10 text-slate-400 border-slate-500/30"
                            }`}
                          >
                            {formData.shippingSameAsBilling ? "Yes — Same as Billing" : "No — Custom Shipping Location"}
                          </button>
                        </div>

                        {!formData.shippingSameAsBilling && (
                          <div className="p-4 bg-theme-surface-1 border border-theme-divider rounded-xl grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="md:col-span-2"><label className={lbl}>Shipping Line 1</label><input type="text" value={formData.shippingAddressLine1} onChange={(e) => set("shippingAddressLine1", e.target.value)} className={inp} /></div>
                            <div><label className={lbl}>Shipping Line 2</label><input type="text" value={formData.shippingAddressLine2} onChange={(e) => set("shippingAddressLine2", e.target.value)} className={inp} /></div>
                            <div><label className={lbl}>City</label><input type="text" value={formData.shippingCity} onChange={(e) => set("shippingCity", e.target.value)} className={inp} /></div>
                            <div>
                              <label className={lbl}>State</label>
                              <select value={formData.shippingState} onChange={(e) => set("shippingState", e.target.value)} className={sel}>
                                {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                              </select>
                            </div>
                            <div><label className={lbl}>PIN Code</label><input type="text" maxLength={6} value={formData.shippingPincode} onChange={(e) => set("shippingPincode", e.target.value)} className={inpMono} /></div>
                          </div>
                        )}

                        {extraAddresses.map((addr, i) => (
                          <div key={i} className="p-4 bg-theme-surface-1 border border-theme-divider rounded-xl space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-xs text-theme-heading font-mono">{addr.label} ({addr.address_type})</span>
                              <button type="button" onClick={() => setExtraAddresses((p) => p.filter((_, j) => j !== i))} className="text-rose-400 hover:text-rose-300 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                            <div className="text-xs text-theme-muted font-mono">{addr.line1}, {addr.city}, {addr.state} - {addr.pincode}</div>
                          </div>
                        ))}

                        <button
                          type="button"
                          onClick={() => setExtraAddresses((p) => [...p, { label: `Warehouse ${p.length + 1}`, address_type: "Warehouse", line1: "", city: formData.billingCity, state: formData.billingState, pincode: "", country: "India" }])}
                          className="w-full py-2 border border-dashed border-[#0a6ed1]/40 text-[#0a6ed1] text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 hover:bg-[#0a6ed1]/5 transition-colors cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add Additional Linked Warehouse / Branch Location
                        </button>
                      </div>
                    </SectionPanel>

                    {/* 5. Contacts */}
                    <SectionPanel sectionKey="contacts" title="Contacts" icon={<UserCheck className="w-4 h-4" />} badge={extraContacts.length > 0 ? extraContacts.length + 1 : undefined}>
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div><label className={lbl}>Primary Contact Person</label><input type="text" placeholder="Full Name" value={formData.contact_person} onChange={(e) => set("contact_person", e.target.value)} className={inp} /></div>
                          <div><label className={lbl}>Designation</label><input type="text" placeholder="e.g. Purchasing Manager" value={formData.designation} onChange={(e) => set("designation", e.target.value)} className={inp} /></div>
                        </div>

                        {extraContacts.map((c, i) => (
                          <div key={c.id} className="p-3 bg-theme-surface-1 border border-theme-divider rounded-xl grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
                            <div><label className={lbl}>Name</label><input type="text" value={c.name} onChange={(e) => setExtraContacts((p) => p.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} className={inp} /></div>
                            <div>
                              <label className={lbl}>Role</label>
                              <select value={c.role} onChange={(e) => setExtraContacts((p) => p.map((x, j) => (j === i ? { ...x, role: e.target.value as any } : x)))} className={sel}>
                                {["Purchasing Head", "Accounts Officer", "Store Manager", "Director", "General"].map((r) => <option key={r} value={r}>{r}</option>)}
                              </select>
                            </div>
                            <div><label className={lbl}>Mobile</label><input type="tel" value={c.mobile} onChange={(e) => setExtraContacts((p) => p.map((x, j) => (j === i ? { ...x, mobile: e.target.value } : x)))} className={inpMono} /></div>
                            <div className="flex items-center gap-2">
                              <input type="email" placeholder="Email" value={c.email} onChange={(e) => setExtraContacts((p) => p.map((x, j) => (j === i ? { ...x, email: e.target.value } : x)))} className={inpMono + " flex-1"} />
                              <button type="button" onClick={() => setExtraContacts((p) => p.filter((_, j) => j !== i))} className="p-1.5 text-rose-400 cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                            </div>
                          </div>
                        ))}

                        <button
                          type="button"
                          onClick={() => setExtraContacts((p) => [...p, { id: `c-${Date.now()}`, name: "", role: "Accounts Officer", mobile: "", email: "", is_primary: false }])}
                          className="w-full py-2 border border-dashed border-[#0a6ed1]/40 text-[#0a6ed1] text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 hover:bg-[#0a6ed1]/5 transition-colors cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add Additional Contact Person
                        </button>
                      </div>
                    </SectionPanel>

                    {/* 6. Credit & Finance */}
                    <SectionPanel sectionKey="credit" title="Credit & Finance" icon={<DollarSign className="w-4 h-4" />}>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div><label className={lbl}>Opening Balance (₹)</label><input type="number" step="0.01" value={formData.openingBalance} onChange={(e) => set("openingBalance", e.target.value)} className={inpMono} /></div>
                        <div><label className={lbl}>Credit Limit (₹)</label><input type="number" step="1000" min="0" value={formData.creditLimit} onChange={(e) => set("creditLimit", e.target.value)} className={inpMono} /></div>
                        <div><label className={lbl}>Credit Days</label><input type="number" min="0" max="365" value={formData.creditDays} onChange={(e) => set("creditDays", e.target.value)} className={inpMono} /></div>
                        <div>
                          <label className={lbl}>Payment Terms</label>
                          <select value={formData.paymentTerms} onChange={(e) => set("paymentTerms", e.target.value)} className={sel}>
                            {["Net 7 Days", "Net 15 Days", "Net 30 Days", "Net 45 Days", "Net 60 Days", "Advance Payment", "Cash on Delivery"].map((pt) => <option key={pt} value={pt}>{pt}</option>)}
                          </select>
                        </div>
                      </div>
                    </SectionPanel>

                    {/* 7. Pricing & Sales */}
                    <SectionPanel sectionKey="pricing" title="Pricing & Sales" icon={<Tag className="w-4 h-4" />}>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className={lbl}>Assigned Pricing Group</label>
                          <select value={formData.pricingGroupId} onChange={(e) => set("pricingGroupId", e.target.value)} className={sel}>
                            <option value="">Standard Retail Price</option>
                            {pricingGroups.map((pg) => (
                              <option key={pg.id} value={pg.id}>{pg.name} ({pg.discount_percent}% off)</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className={lbl}>Account Sort Order</label>
                          <input type="number" min="1" value={formData.sortOrder} onChange={(e) => set("sortOrder", e.target.value)} className={inpMono} />
                        </div>
                      </div>
                    </SectionPanel>

                    {/* 8. Banking */}
                    <SectionPanel sectionKey="banking" title="Banking" icon={<CreditCard className="w-4 h-4" />}>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className={lbl}>Bank Name</label>
                          <select value={formData.bankName} onChange={(e) => set("bankName", e.target.value)} className={sel}>
                            <option value="">— Select Bank —</option>
                            {BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
                          </select>
                        </div>
                        <div><label className={lbl}>Account Name</label><input type="text" value={formData.accountName} onChange={(e) => set("accountName", e.target.value)} className={inp} /></div>
                        <div><label className={lbl}>Account Number</label><input type="text" value={formData.accountNumber} onChange={(e) => set("accountNumber", e.target.value)} className={inpMono} /></div>
                        <div><label className={lbl}>IFSC Code</label><input type="text" maxLength={11} value={formData.ifscCode} onChange={(e) => set("ifscCode", e.target.value.toUpperCase())} className={inpMono} /></div>
                        <div><label className={lbl}>Branch Name</label><input type="text" value={formData.branchName} onChange={(e) => set("branchName", e.target.value)} className={inp} /></div>
                        <div><label className={lbl}>UPI Virtual ID</label><input type="text" value={formData.upiId} onChange={(e) => set("upiId", e.target.value)} className={inpMono} /></div>
                      </div>
                    </SectionPanel>

                    {/* 9. Documents */}
                    <SectionPanel sectionKey="documents" title="Documents" icon={<FileText className="w-4 h-4" />} badge={attachedDocs.length || undefined}>
                      <div className="space-y-4">
                        {attachedDocs.map((doc, i) => (
                          <div key={doc.id} className="p-3 bg-theme-surface-1 border border-theme-divider rounded-xl grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                            <div>
                              <label className={lbl}>Doc Type</label>
                              <select value={doc.doc_type} onChange={(e) => setAttachedDocs((p) => p.map((x, j) => (j === i ? { ...x, doc_type: e.target.value as any } : x)))} className={sel}>
                                {["GST Certificate", "PAN Card", "MSME Certificate", "FSSAI License", "Credit Agreement"].map((dt) => <option key={dt} value={dt}>{dt}</option>)}
                              </select>
                            </div>
                            <div><label className={lbl}>Doc Number</label><input type="text" value={doc.doc_number} onChange={(e) => setAttachedDocs((p) => p.map((x, j) => (j === i ? { ...x, doc_number: e.target.value } : x)))} className={inpMono} /></div>
                            <div className="flex items-center gap-2">
                              <input type="date" value={doc.expiry_date} onChange={(e) => setAttachedDocs((p) => p.map((x, j) => (j === i ? { ...x, expiry_date: e.target.value } : x)))} className={inpMono + " flex-1"} />
                              <button type="button" onClick={() => setAttachedDocs((p) => p.filter((_, j) => j !== i))} className="p-1.5 text-rose-400 cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                            </div>
                          </div>
                        ))}

                        <button
                          type="button"
                          onClick={() => setAttachedDocs((p) => [...p, { id: `d-${Date.now()}`, doc_type: "GST Certificate", doc_number: "", expiry_date: "2028-12-31", status: "Valid", file_name: "doc.pdf" }])}
                          className="w-full py-2 border border-dashed border-[#0a6ed1]/40 text-[#0a6ed1] text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 hover:bg-[#0a6ed1]/5 transition-colors cursor-pointer"
                        >
                          <UploadCloud className="w-3.5 h-3.5" /> Attach Compliance Document / Identity Proof
                        </button>
                      </div>
                    </SectionPanel>

                    {/* 10. Notes & Audit */}
                    <SectionPanel sectionKey="notes" title="Notes & Audit" icon={<Info className="w-4 h-4" />}>
                      <div className="space-y-4">
                        <div>
                          <label className={lbl}>Account Tags (comma-separated)</label>
                          <input type="text" placeholder="VIP, Wholesale, High-Volume, Direct-Bill" value={formData.tags} onChange={(e) => set("tags", e.target.value)} className={inpMono} />
                        </div>
                        <div>
                          <label className={lbl}>Internal Account Notes</label>
                          <textarea rows={3} placeholder="Add operational notes or credit comments..." value={formData.notes} onChange={(e) => set("notes", e.target.value)} className={inp + " resize-none"} />
                        </div>
                      </div>
                    </SectionPanel>

                    {/* Link back to Quick Add */}
                    <button
                      type="button"
                      onClick={() => switchMode("quick")}
                      className="w-full py-2 border border-dashed border-theme-divider rounded-xl text-xs font-bold text-theme-muted hover:text-[#0a6ed1] hover:border-[#0a6ed1]/40 transition-colors cursor-pointer flex items-center justify-center gap-2"
                    >
                      ← Back to Quick Add Mode
                    </button>
                  </div>
                )}
              </form>
            </SmritiScrollArea>

            {/* ── Modal Sticky Footer ── */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-theme-divider bg-theme-surface-2">
              <button
                type="button"
                onClick={handleCloseModal}
                className="px-4 py-2 text-xs font-bold text-theme-muted hover:text-theme-heading transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => handleSubmit(e as any, true)}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-bold bg-theme-surface-3 hover:bg-theme-surface-4 text-theme-heading border border-theme-divider rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" /> Save &amp; New
                </button>
                <button
                  type="submit"
                  form="customer-form"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-bold bg-[#0a6ed1] hover:bg-[#085caf] text-white rounded-lg transition-colors shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-60"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {isSubmitting ? "Registering..." : "Save Customer Profile"}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};
