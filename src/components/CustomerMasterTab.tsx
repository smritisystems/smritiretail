/**
 * Project      : SMRITI Retail OS v6.5
 * Module       : Customer Master & Customer 360° Operational Workspace
 *                Standard (B2C) & Corporate (B2B) · Adaptive Framework v2.0
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com and AITDL.com. All Rights Reserved.
 * Version      : 6.5.0
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
  RotateCcw, Save, AlertOctagon, Info, Globe, Store, Layers, Sparkles,
  ShoppingBag, Receipt, ArrowUpRight, ArrowDownRight, Compass, Ticket,
  Network, Activity, PieChart, BarChart2
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

export interface CustomerTimelineEvent {
  id: string;
  timestamp: string;
  type: "Invoice" | "Payment" | "WhatsApp" | "Call" | "Order" | "Visit" | "Ticket" | "Loyalty" | "Credit";
  title: string;
  description: string;
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
  is_gst_registered: false,
  gstNumber: "",
  gst_type: "Regular",
  gst_category: "B2C",
  place_of_supply: "Maharashtra",
  pan: "",
  tan: "",
  cin: "",
  is_tds_applicable: false,
  tds_section: "194Q",
  tds_rate: "0.10",
  is_tcs_applicable: false,
  tcs_section: "206C(1H)",
  tcs_rate: "0.10",
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
  creditLimit: "50000",
  creditDays: "30",
  paymentTerms: "Net 30 Days",
  openingBalance: "0.00",
  bankName: "",
  accountName: "",
  accountNumber: "",
  ifscCode: "",
  branchName: "",
  upiId: "",
  salesperson: "",
  status: "Active" as "Active" | "Inactive" | "Blocked",
  tags: "",
  notes: "",
  effectiveFrom: "",
  effectiveTo: "",
  sortOrder: "1",
  channelTrackingEnabled: false,
  supplyModel: "ModernTrade",
  selloutSource: "Excel",
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

  /* ── Customer 360 Active Workspace Tab ── */
  const [workspaceTab, setWorkspaceTab] = useState<
    | "overview" | "orders" | "invoices" | "payments" | "ledger"
    | "addresses" | "contacts" | "documents" | "timeline"
    | "campaigns" | "loyalty" | "support" | "audit" | "analytics"
  >("overview");

  /* ── Adaptive Onboarding Modal States ── */
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

  /* ── Dynamic Timeline Log ── */
  const [newTimelineText, setNewTimelineText] = useState("");
  const [newTimelineType, setNewTimelineType] = useState<CustomerTimelineEvent["type"]>("Call");

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

  /* ── Toggle Category ── */
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

  /* ── Switch Form Mode ── */
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
        setSelectedCustomerId(newCust.id);
        setWorkspaceTab("overview");
      }
    }
  };

  /* ── List Report Columns ── */
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
  /*    RENDER CUSTOMER 360 WORKSPACE (SELECTED CUSTOMER) */
  /* ════════════════════════════════════════════════════ */
  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

  if (selectedCustomer) {
    const creditLimit = 500000;
    const healthScore = 95;
    const totalSales = 4582000;
    const loyaltyPoints = 4850;
    const walletBalance = 2350;
    const loyaltyTier = "Gold";

    const riskAlerts = [
      { text: "Credit utilization at 25%", type: "info" as const },
      { text: "GSTIN Status: Active ✓", type: "success" as const },
      { text: "No overdue invoices", type: "success" as const },
    ];

    const aiSuggestions = [
      "Offer Gold Membership Escalation Voucher",
      "Eligible for Credit Line Expansion (₹ 5L → ₹ 10L)",
      "Cross-sell Recommendation: Premium Office Stationery & Beverage Supplies",
    ];

    return (
      <div className="flex flex-col h-full bg-theme-surface-1 text-theme-primary font-sans select-none">

        {/* ── Customer 360 Top Action Bar & Back ── */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-theme-divider bg-theme-surface-2 px-6 py-3.5 gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedCustomerId(null)}
              className="p-1.5 text-theme-muted hover:text-theme-heading bg-theme-surface-3 hover:bg-theme-surface-hover rounded-xl cursor-pointer transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-theme-heading font-display">{selectedCustomer.name}</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase border bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                  {selectedCustomer.status}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-[#0a6ed1]/10 text-[#0a6ed1] border border-[#0a6ed1]/30">
                  {selectedCustomer.customerGroupId || "CG-Retail"}
                </span>
              </div>
              <span className="font-mono text-xs text-theme-muted">
                {selectedCustomer.id} | GSTIN: {selectedCustomer.gstNumber || "Unregistered (B2C)"} | Mobile: {selectedCustomer.mobile || "N/A"}
              </span>
            </div>
          </div>

          {/* Quick Action Shortcuts */}
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => onNotification?.("Action", "Opening New Order Creator...", "success")} className="px-3 py-1.5 text-xs font-bold bg-[#0a6ed1] hover:bg-[#085caf] text-white rounded-lg cursor-pointer flex items-center gap-1 shadow-xs">
              <ShoppingBag className="w-3.5 h-3.5" /> New Order
            </button>
            <button onClick={() => onNotification?.("Action", "Opening Invoice Generator...", "success")} className="px-3 py-1.5 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-lg cursor-pointer flex items-center gap-1 shadow-xs">
              <Receipt className="w-3.5 h-3.5" /> New Invoice
            </button>
            <button onClick={() => onNotification?.("Action", "Opening Receive Payment dialog...", "success")} className="px-3 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg cursor-pointer flex items-center gap-1 shadow-xs">
              <DollarSign className="w-3.5 h-3.5" /> Receive Payment
            </button>
            <button onClick={() => window.open(`https://wa.me/${selectedCustomer.mobile?.replace(/\D/g,"")}`, "_blank")} className="px-3 py-1.5 text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-lg cursor-pointer hover:bg-emerald-500/20 flex items-center gap-1">
              <MessageSquare className="w-3.5 h-3.5" /> WhatsApp
            </button>
            <button onClick={() => onNotification?.("Visit Scheduled", "Field visit logged.", "success")} className="px-3 py-1.5 text-xs font-bold bg-theme-surface-3 hover:bg-theme-surface-4 text-theme-heading border border-theme-divider rounded-lg cursor-pointer flex items-center gap-1">
              <Compass className="w-3.5 h-3.5" /> Visit
            </button>
          </div>
        </div>

        {/* ── Customer 360° KPI Header Bar ── */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-4 bg-theme-surface-2/60 border-b border-theme-divider">
          <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
            <span className="text-[9px] font-mono text-theme-muted uppercase font-bold block">Total Lifetime Sales</span>
            <strong className="text-base font-bold text-theme-heading font-mono">₹{totalSales.toLocaleString("en-IN")}</strong>
            <span className="block text-[9px] text-emerald-400 font-mono mt-0.5">+18% growth YTD</span>
          </div>

          <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
            <span className="text-[9px] font-mono text-theme-muted uppercase font-bold block">Receivable Balance</span>
            <strong className={`text-base font-bold font-mono ${selectedCustomer.outstanding > 0 ? "text-rose-400" : "text-emerald-400"}`}>
              ₹{(selectedCustomer.outstanding || 0).toLocaleString("en-IN")}
            </strong>
            <span className="block text-[9px] text-theme-muted font-mono mt-0.5">Credit limit: ₹{creditLimit.toLocaleString("en-IN")}</span>
          </div>

          <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
            <span className="text-[9px] font-mono text-theme-muted uppercase font-bold block">Loyalty Tier &amp; Wallet</span>
            <strong className="text-base font-bold text-amber-400 font-mono flex items-center gap-1">
              <Award className="w-4 h-4" /> {loyaltyTier}
            </strong>
            <span className="block text-[9px] text-theme-muted font-mono mt-0.5">{loyaltyPoints} Pts (₹{walletBalance} Wallet)</span>
          </div>

          <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
            <span className="text-[9px] font-mono text-theme-muted uppercase font-bold block">Customer Health Score</span>
            <strong className="text-base font-bold text-emerald-400 font-mono flex items-center gap-1">
              {healthScore}% <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            </strong>
            <span className="block text-[9px] text-emerald-400 font-mono mt-0.5">★★★★★ Excellent Account</span>
          </div>

          <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl col-span-2 md:col-span-1">
            <span className="text-[9px] font-mono text-theme-muted uppercase font-bold block">Risk Status</span>
            <div className="flex items-center gap-1 mt-1 flex-wrap">
              {riskAlerts.map((r, i) => (
                <span key={i} className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {r.text}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ── 14 Workspace Navigation Tabs ── */}
        <div className="flex items-center gap-1 px-4 bg-theme-surface-3 border-b border-theme-divider overflow-x-auto scrollbar-none text-xs font-mono py-1.5">
          {[
            { id: "overview", label: "Overview" },
            { id: "orders", label: "Orders" },
            { id: "invoices", label: "Invoices" },
            { id: "payments", label: "Payments" },
            { id: "ledger", label: "Ledger" },
            { id: "addresses", label: "Addresses" },
            { id: "contacts", label: "Contacts" },
            { id: "documents", label: "Documents" },
            { id: "timeline", label: "Timeline" },
            { id: "campaigns", label: "Campaigns" },
            { id: "loyalty", label: "Loyalty" },
            { id: "support", label: "Support" },
            { id: "audit", label: "Audit" },
            { id: "analytics", label: "Analytics" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setWorkspaceTab(t.id as any)}
              className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer whitespace-nowrap ${
                workspaceTab === t.id
                  ? "bg-[#0a6ed1] text-white shadow-xs"
                  : "text-theme-muted hover:text-theme-heading hover:bg-theme-surface-2"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Workspace Tab Content ── */}
        <SmritiScrollArea className="flex-1 p-6 bg-theme-base font-sans text-xs">
          <motion.div key={workspaceTab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }}>

            {/* OVERVIEW */}
            {workspaceTab === "overview" && (
              <div className="space-y-6 max-w-5xl">
                {/* AI Recommendations Banner */}
                <div className="p-4 bg-gradient-to-r from-purple-950/40 to-blue-950/40 border border-purple-500/30 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-purple-400 font-bold uppercase font-mono text-[11px]">
                    <Sparkles className="w-4 h-4" /> AI Smart Recommendations &amp; Nudges
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                    {aiSuggestions.map((sug, i) => (
                      <div key={i} className="p-3 bg-theme-surface-2/80 border border-theme-divider rounded-lg font-mono text-[11px] text-theme-heading flex items-start gap-2">
                        <ChevronRight className="w-3.5 h-3.5 text-[#0a6ed1] flex-shrink-0 mt-0.5" />
                        <span>{sug}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="p-5 bg-theme-surface-2 border border-theme-divider rounded-xl space-y-3 font-mono">
                    <h5 className="font-bold text-theme-heading font-display text-sm flex items-center gap-2 mb-2">
                      <UserCheck className="w-4 h-4 text-[#0a6ed1]" /> Account Profile &amp; Contact
                    </h5>
                    {[
                      ["Customer ID", selectedCustomer.id],
                      ["Category", selectedCustomer.gstNumber ? "Corporate Account (B2B)" : "Standard Retail (B2C)"],
                      ["Full Name", selectedCustomer.name],
                      ["Mobile", selectedCustomer.mobile || "N/A"],
                      ["Email", selectedCustomer.email || "N/A"],
                      ["Salesperson", selectedCustomer.salesperson || "Default Account Manager"],
                      ["Group", selectedCustomer.customerGroupId],
                      ["Pricing Tier", selectedCustomer.pricingGroupId || "Standard Price"],
                    ].map(([k, v]) => (
                      <div key={k as string} className="flex justify-between text-xs border-b border-theme-divider/40 pb-1.5">
                        <span className="text-theme-muted">{k}</span>
                        <span className="font-bold text-theme-heading">{v || "—"}</span>
                      </div>
                    ))}
                  </div>

                  <div className="p-5 bg-theme-surface-2 border border-theme-divider rounded-xl space-y-3 font-mono">
                    <h5 className="font-bold text-theme-heading font-display text-sm flex items-center gap-2 mb-2">
                      <ShieldCheck className="w-4 h-4 text-[#0a6ed1]" /> Taxation &amp; Commercial Terms
                    </h5>
                    {[
                      ["GSTIN", selectedCustomer.gstNumber || "Unregistered"],
                      ["PAN", selectedCustomer.pan || "Unregistered"],
                      ["Place of Supply", selectedCustomer.billingState || "Maharashtra"],
                      ["Credit Limit", `₹${creditLimit.toLocaleString("en-IN")}`],
                      ["Outstanding Balance", `₹${(selectedCustomer.outstanding || 0).toLocaleString("en-IN")}`],
                      ["Payment Terms", "Net 30 Days"],
                      ["Registration Date", selectedCustomer.createdDate || "2026-01-15"],
                    ].map(([k, v]) => (
                      <div key={k as string} className="flex justify-between text-xs border-b border-theme-divider/40 pb-1.5">
                        <span className="text-theme-muted">{k}</span>
                        <span className="font-bold text-theme-heading">{v || "—"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ORDERS */}
            {workspaceTab === "orders" && (
              <div className="space-y-4 max-w-5xl">
                <h4 className="font-bold text-sm text-theme-heading font-display flex items-center gap-2"><ShoppingBag className="w-5 h-5 text-[#0a6ed1]" /> Sales Orders History</h4>
                <div className="bg-theme-surface-2 border border-theme-divider rounded-xl overflow-hidden">
                  <table className="w-full text-xs font-mono">
                    <thead>
                      <tr className="border-b border-theme-divider bg-theme-surface-3 text-[10px] uppercase text-theme-muted">
                        <th className="px-4 py-3">Order No</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Items</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3">Fulfillment</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-theme-divider">
                      {[{ so: "SO-2026-0891", date: "2026-07-28", items: 8, amt: "₹45,800", st: "Dispatched" }, { so: "SO-2026-0740", date: "2026-06-15", items: 3, amt: "₹12,400", st: "Delivered" }].map((r) => (
                        <tr key={r.so} className="hover:bg-theme-surface-hover">
                          <td className="px-4 py-3 font-bold text-[#0a6ed1]">{r.so}</td>
                          <td className="px-4 py-3 text-theme-muted">{r.date}</td>
                          <td className="px-4 py-3">{r.items} items</td>
                          <td className="px-4 py-3 text-right font-bold text-theme-heading">{r.amt}</td>
                          <td className="px-4 py-3"><span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded text-[10px] font-bold border border-emerald-500/30">{r.st}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* INVOICES */}
            {workspaceTab === "invoices" && (
              <div className="space-y-4 max-w-5xl">
                <h4 className="font-bold text-sm text-theme-heading font-display flex items-center gap-2"><Receipt className="w-5 h-5 text-purple-400" /> Tax Invoices</h4>
                <div className="bg-theme-surface-2 border border-theme-divider rounded-xl overflow-hidden">
                  <table className="w-full text-xs font-mono">
                    <thead>
                      <tr className="border-b border-theme-divider bg-theme-surface-3 text-[10px] uppercase text-theme-muted">
                        <th className="px-4 py-3">Invoice No</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Due Date</th><th className="px-4 py-3 text-right">Taxable</th><th className="px-4 py-3 text-right">Net Value</th><th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-theme-divider">
                      {[{ inv: "INV-2026-0901", date: "2026-07-28", due: "2026-08-27", tax: "₹38,813", net: "₹45,800", st: "Unpaid" }, { inv: "INV-2026-0710", date: "2026-06-15", due: "2026-07-15", tax: "₹10,508", net: "₹12,400", st: "Paid" }].map((r) => (
                        <tr key={r.inv} className="hover:bg-theme-surface-hover">
                          <td className="px-4 py-3 font-bold text-purple-400">{r.inv}</td>
                          <td className="px-4 py-3 text-theme-muted">{r.date}</td>
                          <td className="px-4 py-3 text-theme-muted">{r.due}</td>
                          <td className="px-4 py-3 text-right font-mono">{r.tax}</td>
                          <td className="px-4 py-3 text-right font-bold font-mono">{r.net}</td>
                          <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${r.st === "Paid" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-amber-500/10 text-amber-400 border-amber-500/30"}`}>{r.st}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* PAYMENTS */}
            {workspaceTab === "payments" && (
              <div className="space-y-4 max-w-5xl">
                <h4 className="font-bold text-sm text-theme-heading font-display flex items-center gap-2"><DollarSign className="w-5 h-5 text-emerald-400" /> Payments Received</h4>
                <div className="bg-theme-surface-2 border border-theme-divider rounded-xl overflow-hidden">
                  <table className="w-full text-xs font-mono">
                    <thead>
                      <tr className="border-b border-theme-divider bg-theme-surface-3 text-[10px] uppercase text-theme-muted">
                        <th className="px-4 py-3">Receipt Ref</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Mode</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3">Invoice Ref</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-theme-divider">
                      {[{ ref: "RCP-2026-0310", date: "2026-07-10", mode: "UPI / Razorpay", amt: "₹12,400", inv: "INV-2026-0710" }].map((r) => (
                        <tr key={r.ref} className="hover:bg-theme-surface-hover">
                          <td className="px-4 py-3 font-bold text-emerald-400">{r.ref}</td>
                          <td className="px-4 py-3 text-theme-muted">{r.date}</td>
                          <td className="px-4 py-3"><span className="px-2 py-0.5 bg-theme-surface-3 rounded text-[10px] font-bold">{r.mode}</span></td>
                          <td className="px-4 py-3 text-right font-bold text-emerald-400">{r.amt}</td>
                          <td className="px-4 py-3 text-purple-400 font-bold">{r.inv}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* LEDGER */}
            {workspaceTab === "ledger" && (
              <div className="max-w-5xl font-mono text-xs">
                <CustomerLedger customer={selectedCustomer} />
              </div>
            )}

            {/* ADDRESSES */}
            {workspaceTab === "addresses" && (
              <div className="space-y-4 max-w-5xl">
                <h4 className="font-bold text-sm text-theme-heading font-display flex items-center gap-2"><MapPin className="w-5 h-5 text-[#0a6ed1]" /> Billing, Shipping &amp; Branch Locations</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono">
                  <div className="p-4 bg-theme-surface-2 border border-theme-divider rounded-xl space-y-2">
                    <span className="text-[10px] font-bold uppercase text-[#0a6ed1]">Primary Billing Address</span>
                    <p className="text-theme-heading leading-relaxed">
                      {selectedCustomer.billingAddressLine1 || "MIDC Industrial Area, Plot 45"}<br />
                      {selectedCustomer.billingCity || "Mumbai"}, {selectedCustomer.billingState || "Maharashtra"} - {selectedCustomer.billingPincode || "400093"}
                    </p>
                  </div>
                  <div className="p-4 bg-theme-surface-2 border border-theme-divider rounded-xl space-y-2">
                    <span className="text-[10px] font-bold uppercase text-emerald-400">Default Shipping Address</span>
                    <p className="text-theme-heading leading-relaxed">
                      {selectedCustomer.shippingSameAsBilling !== false ? "Same as Billing Address" : `${selectedCustomer.shippingAddressLine1}, ${selectedCustomer.shippingCity}`}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* CONTACTS */}
            {workspaceTab === "contacts" && (
              <div className="space-y-4 max-w-5xl">
                <h4 className="font-bold text-sm text-theme-heading font-display flex items-center gap-2"><UserCheck className="w-5 h-5 text-[#0a6ed1]" /> Multi-Contact Directory</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono">
                  <div className="p-4 bg-theme-surface-2 border border-theme-divider rounded-xl space-y-2">
                    <div className="flex justify-between items-center"><strong className="font-sans text-theme-heading text-xs">{selectedCustomer.name}</strong><span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded text-[10px] font-bold border border-emerald-500/30">Primary</span></div>
                    <div className="text-theme-muted text-xs"><Phone className="w-3 h-3 inline mr-1" />{selectedCustomer.mobile || "N/A"}</div>
                    <div className="text-theme-muted text-xs"><Mail className="w-3 h-3 inline mr-1" />{selectedCustomer.email || "N/A"}</div>
                  </div>
                </div>
              </div>
            )}

            {/* DOCUMENTS */}
            {workspaceTab === "documents" && (
              <div className="space-y-4 max-w-5xl font-mono">
                <h4 className="font-bold text-sm text-theme-heading font-display flex items-center gap-2"><FileText className="w-5 h-5 text-[#0a6ed1]" /> Compliance Document Vault</h4>
                <div className="p-4 bg-theme-surface-2 border border-theme-divider rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileCheck className="w-7 h-7 text-[#0a6ed1]" />
                    <div>
                      <strong className="font-sans text-theme-heading block">GST Certificate</strong>
                      <span className="text-theme-muted text-xs">{selectedCustomer.gstNumber || "27AAACR1234F1Z5"} | Expires: 2028-03-31</span>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 rounded text-[10px] font-bold border border-emerald-500/30">Valid</span>
                </div>
              </div>
            )}

            {/* TIMELINE */}
            {workspaceTab === "timeline" && (
              <div className="space-y-5 max-w-5xl">
                <h4 className="font-bold text-sm text-theme-heading font-display flex items-center gap-2"><History className="w-5 h-5 text-[#0a6ed1]" /> Unified Chronological Activity Timeline</h4>

                {!isReadOnly && (
                  <div className="p-4 bg-theme-surface-2 border border-theme-divider rounded-xl space-y-3">
                    <span className="font-bold text-xs text-theme-muted font-mono uppercase">Log Customer Interaction</span>
                    <div className="flex gap-3">
                      <select value={newTimelineType} onChange={(e) => setNewTimelineType(e.target.value as any)} className="p-2 bg-theme-surface-1 border border-theme-divider rounded-lg text-xs font-mono text-theme-heading">
                        {["Call", "WhatsApp", "Visit", "Email", "Ticket"].map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <input type="text" placeholder="Interaction details..." value={newTimelineText} onChange={(e) => setNewTimelineText(e.target.value)} className="flex-1 p-2 bg-theme-surface-1 border border-theme-divider rounded-lg text-xs text-theme-heading focus:outline-none focus:border-[#0a6ed1]" />
                      <button onClick={() => { if (!newTimelineText.trim()) return; setNewTimelineText(""); onNotification?.("Logged", "Interaction appended to timeline.", "success"); }} className="px-4 py-2 bg-[#0a6ed1] text-white font-bold text-xs rounded-lg cursor-pointer flex items-center gap-1">
                        <Send className="w-3.5 h-3.5" /> Log Event
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-3 font-mono">
                  {[
                    { type: "Invoice", title: "Tax Invoice Issued", desc: "Generated INV-2026-0901 for ₹45,800", time: "2026-07-28 14:30", user: "System" },
                    { type: "WhatsApp", title: "Promotional Voucher Sent", desc: "Monsoon Discount voucher dispatched via WhatsApp", time: "2026-07-25 11:15", user: "Campaign Bot" },
                    { type: "Payment", title: "Payment Received", desc: "Cleared ₹12,400 via UPI Razorpay (RCP-2026-0310)", time: "2026-07-10 16:45", user: "Accounts" },
                    { type: "Visit", title: "Sales Rep Visit Logged", desc: "Field rep Ramesh visited client office for catalog review", time: "2026-07-02 10:00", user: "Ramesh C." },
                  ].map((item, idx) => (
                    <div key={idx} className="p-4 bg-theme-surface-2 border border-theme-divider rounded-xl flex items-start gap-3">
                      <div className="p-2 bg-[#0a6ed1]/10 rounded-lg mt-0.5 text-[#0a6ed1]"><Activity className="w-4 h-4" /></div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 bg-theme-surface-3 rounded text-[10px] font-bold">{item.type}</span>
                          <span className="font-bold text-theme-heading text-xs">{item.title}</span>
                          <span className="text-theme-muted text-[10px]">{item.time} | by {item.user}</span>
                        </div>
                        <p className="text-xs text-theme-muted mt-1">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* CAMPAIGNS */}
            {workspaceTab === "campaigns" && (
              <div className="space-y-4 max-w-5xl font-mono">
                <h4 className="font-bold text-sm text-theme-heading font-display flex items-center gap-2"><Send className="w-5 h-5 text-purple-400" /> Marketing Campaigns &amp; Promo Usage</h4>
                <div className="p-4 bg-theme-surface-2 border border-theme-divider rounded-xl space-y-2">
                  <div className="flex justify-between items-center"><strong className="font-sans text-theme-heading text-xs">Monsoon Special Discount Voucher</strong><span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded text-[10px] font-bold">Redeemed ✓</span></div>
                  <p className="text-theme-muted text-xs">Channel: WhatsApp Business API | Promo: MONSOON2026 | Saved ₹1,500</p>
                </div>
              </div>
            )}

            {/* LOYALTY */}
            {workspaceTab === "loyalty" && (
              <div className="space-y-5 max-w-5xl font-mono">
                <h4 className="font-bold text-sm text-theme-heading font-display flex items-center gap-2"><Award className="w-5 h-5 text-amber-400" /> Membership Wallet &amp; Reward Points</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-theme-muted text-[10px] uppercase font-bold block">Current Tier</span>
                    <strong className="text-xl font-bold text-amber-400">Gold Tier</strong>
                  </div>
                  <div className="p-4 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-theme-muted text-[10px] uppercase font-bold block">Points Balance</span>
                    <strong className="text-xl font-bold text-emerald-400">4,850 Points</strong>
                  </div>
                  <div className="p-4 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-theme-muted text-[10px] uppercase font-bold block">Redeemable Wallet</span>
                    <strong className="text-xl font-bold text-purple-400">₹2,350.00</strong>
                  </div>
                </div>
              </div>
            )}

            {/* SUPPORT */}
            {workspaceTab === "support" && (
              <div className="space-y-4 max-w-5xl font-mono">
                <h4 className="font-bold text-sm text-theme-heading font-display flex items-center gap-2"><Ticket className="w-5 h-5 text-[#0a6ed1]" /> Helpdesk Tickets &amp; Complaints</h4>
                <div className="p-4 bg-theme-surface-2 border border-theme-divider rounded-xl flex items-center justify-between">
                  <div>
                    <strong className="font-sans text-theme-heading text-xs block">TKT-2026-0412 — Invoice Address Correction</strong>
                    <span className="text-theme-muted text-xs">Logged: 2026-07-20 | Resolved in 4 hours</span>
                  </div>
                  <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded text-[10px] font-bold">Resolved</span>
                </div>
              </div>
            )}

            {/* AUDIT */}
            {workspaceTab === "audit" && (
              <div className="space-y-4 max-w-5xl font-mono text-xs">
                <h4 className="font-bold text-sm text-theme-heading font-display flex items-center gap-2"><History className="w-5 h-5 text-theme-muted" /> Audit Log Trail</h4>
                <div className="space-y-2">
                  {[
                    { action: "RECORD_CREATED", ts: selectedCustomer.createdDate || "2026-01-15", user: "Admin", note: "Customer profile created." },
                    { action: "CREDIT_LIMIT_UPDATED", ts: "2026-03-01", user: "Jawahar Mallah", note: "Approved credit limit increase to ₹5,00,000." },
                  ].map((log, i) => (
                    <div key={i} className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl flex items-start gap-3">
                      <div className="p-1.5 bg-theme-surface-3 rounded-lg flex-shrink-0"><History className="w-3.5 h-3.5 text-theme-muted" /></div>
                      <div>
                        <span className="px-2 py-0.5 bg-[#0a6ed1]/10 text-[#0a6ed1] rounded text-[10px] font-bold">{log.action}</span>
                        <span className="ml-2 text-theme-muted text-[10px]">{log.ts} | by {log.user}</span>
                        <p className="text-theme-heading mt-1">{log.note}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ANALYTICS */}
            {workspaceTab === "analytics" && (
              <div className="space-y-5 max-w-5xl font-mono">
                <h4 className="font-bold text-sm text-theme-heading font-display flex items-center gap-2"><BarChart2 className="w-5 h-5 text-[#0a6ed1]" /> Account Analytics &amp; Purchasing Trends</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="p-5 bg-theme-surface-2 border border-theme-divider rounded-xl space-y-3">
                    <span className="text-xs font-bold text-theme-heading uppercase block">Top Purchased Categories</span>
                    {[{ c: "Office Stationery & Paper", p: 45 }, { c: "Electronics & Peripherals", p: 35 }, { c: "Beverages & Pantry", p: 20 }].map((item) => (
                      <div key={item.c}>
                        <div className="flex justify-between text-xs text-theme-muted mb-1"><span>{item.c}</span><span className="font-bold text-theme-heading">{item.p}%</span></div>
                        <div className="w-full h-2 bg-theme-surface-3 rounded-full"><div className="h-2 rounded-full bg-[#0a6ed1]" style={{ width: `${item.p}%` }} /></div>
                      </div>
                    ))}
                  </div>

                  <div className="p-5 bg-theme-surface-2 border border-theme-divider rounded-xl space-y-3">
                    <span className="text-xs font-bold text-theme-heading uppercase block">Payment Timeliness Breakdown</span>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs"><span className="text-theme-muted">On-Time Payments (&lt; 30d)</span><span className="font-bold text-emerald-400">92%</span></div>
                      <div className="flex justify-between text-xs"><span className="text-theme-muted">Slight Delay (30–45d)</span><span className="font-bold text-amber-400">8%</span></div>
                      <div className="flex justify-between text-xs"><span className="text-theme-muted">Default / Overdue (&gt; 45d)</span><span className="font-bold text-rose-400">0%</span></div>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </motion.div>
        </SmritiScrollArea>
      </div>
    );
  }

  /* ════════════════════════════════════════════════════ */
  /*         DIRECTORY VIEW (LIST REPORT PATTERN)        */
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
          onRowClick={(c) => { setSelectedCustomerId(c.id); setWorkspaceTab("overview"); }}
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
            {/* Modal Header */}
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

            {/* Draft Recovery Banner */}
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

            {/* Customer Type & Mode Switchers */}
            <div className="px-6 pt-4 pb-2 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 border-b border-theme-divider/50 bg-theme-surface-2/40">
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

            {/* Form Body */}
            <SmritiScrollArea className="flex-1 overflow-y-auto px-6 pb-2">
              <form id="customer-form" onSubmit={(e) => handleSubmit(e, false)} className="space-y-4 text-xs font-sans py-3">

                {/* QUICK ADD MODE */}
                {formMode === "quick" && (
                  <div className="space-y-4">
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

                          {/* ── SCDM: Channel Distribution Management (AOP-004) ────── */}
                          <div className="md:col-span-2 p-3 bg-indigo-500/5 border border-indigo-500/20 rounded-xl space-y-3">
                            <div className="flex items-center justify-between">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={formData.channelTrackingEnabled || false}
                                  onChange={(e) => set("channelTrackingEnabled", e.target.checked)}
                                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-theme-divider"
                                />
                                <span className="text-xs font-bold text-theme-heading flex items-center gap-1.5">
                                  <Truck className="w-4 h-4 text-indigo-500" />
                                  Enable SCDM Channel Distribution Tracking
                                </span>
                              </label>
                              <span className="text-[10px] font-mono text-indigo-400 font-semibold">SCDM v1.0</span>
                            </div>

                            {formData.channelTrackingEnabled && (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                                <div>
                                  <label className={lbl}>Supply Model</label>
                                  <select
                                    value={formData.supplyModel || "ModernTrade"}
                                    onChange={(e) => set("supplyModel", e.target.value)}
                                    className={sel}
                                  >
                                    <option value="Normal">Normal Direct Sale</option>
                                    <option value="ModernTrade">Modern Trade (National Chain)</option>
                                    <option value="Distributor">Distributor / Stockist</option>
                                    <option value="Franchise">Franchise Store Network</option>
                                    <option value="Institutional">Institutional B2B</option>
                                  </select>
                                </div>

                                <div>
                                  <label className={lbl}>Primary Sell-Out Ingestion Source</label>
                                  <select
                                    value={formData.selloutSource || "Excel"}
                                    onChange={(e) => set("selloutSource", e.target.value)}
                                    className={sel}
                                  >
                                    <option value="Manual">Manual Ingestion</option>
                                    <option value="Excel">Excel / Spreadsheet Upload</option>
                                    <option value="CSV">CSV Flat File</option>
                                    <option value="API">REST API Endpoint</option>
                                    <option value="EDI">EDI X12 / EDIFACT</option>
                                    <option value="POSFeed">POS Direct Feed</option>
                                    <option value="FTP">FTP / SFTP Drop</option>
                                  </select>
                                </div>
                              </div>
                            )}
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

                    <button
                      type="button"
                      onClick={() => switchMode("advanced")}
                      className="w-full py-2.5 border border-dashed border-purple-500/40 rounded-xl text-xs font-bold text-purple-400 hover:bg-purple-500/5 transition-colors cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Settings2 className="w-3.5 h-3.5" /> Switch to Advanced Add — Full Enterprise Workspace →
                    </button>
                  </div>
                )}

                {/* ADVANCED ADD MODE */}
                {formMode === "advanced" && (
                  <div className="space-y-3">
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
                          <input type="text" value={formData.code} onChange={(e) => set("code", e.target.value)} className={inpMono} />
                        </div>

                        <div>
                          <label className={lbl}>Short / Display Name</label>
                          <input type="text" placeholder="Short name for invoices" value={formData.shortName} onChange={(e) => set("shortName", e.target.value)} className={inp} />
                        </div>

                        <div>
                          <label className={lbl}>Customer Group</label>
                          <select value={formData.customerGroupId} onChange={(e) => set("customerGroupId", e.target.value)} className={sel}>
                            {customerGroups.map((cg) => (<option key={cg.id} value={cg.id}>{cg.name}</option>))}
                          </select>
                        </div>

                        <div>
                          <label className={lbl}>Account Status</label>
                          <select value={formData.status} onChange={(e) => set("status", e.target.value as any)} className={sel}>
                            <option value="Active">Active</option>
                            <option value="Inactive">Inactive</option>
                            <option value="Blocked">Blocked / On Hold</option>
                          </select>
                        </div>

                        <div>
                          <label className={lbl}>Assigned Salesperson</label>
                          <input type="text" placeholder="e.g. Ramesh Chandra" value={formData.salesperson} onChange={(e) => set("salesperson", e.target.value)} className={inp} />
                        </div>

                        <div>
                          <label className={lbl}>Primary Mobile <span className="text-rose-400">*</span></label>
                          <input type="tel" required placeholder="+91 98200 12345" value={formData.mobile} onChange={(e) => set("mobile", e.target.value)} className={inpMonoErr("mobile")} />
                        </div>

                        <div>
                          <label className={lbl}>Alternate Mobile</label>
                          <input type="tel" placeholder="+91 98200 00000" value={formData.alt_mobile} onChange={(e) => set("alt_mobile", e.target.value)} className={inpMono} />
                        </div>

                        <div>
                          <label className={lbl}>Primary Email</label>
                          <input type="email" placeholder="accounts@company.com" value={formData.email} onChange={(e) => set("email", e.target.value)} className={inpMono} />
                        </div>

                        <div>
                          <label className={lbl}>Website URL</label>
                          <input type="url" placeholder="https://company.com" value={formData.website} onChange={(e) => set("website", e.target.value)} className={inpMono} />
                        </div>
                      </div>
                    </SectionPanel>

                    <SectionPanel sectionKey="gst" title="GST & Compliance" icon={<ShieldCheck className="w-4 h-4" />}>
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <span className={lbl + " mb-0"}>GST Registration Status:</span>
                          {[{ v: true, l: "Yes — Tax Registered (B2B)" }, { v: false, l: "No — Unregistered (B2C)" }].map((opt) => (
                            <button key={opt.l} type="button" onClick={() => set("is_gst_registered", opt.v)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${formData.is_gst_registered === opt.v ? opt.v ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/40" : "bg-slate-500/10 text-slate-400 border-slate-500/30" : "bg-theme-surface-1 text-theme-muted border-theme-divider"}`}>
                              {opt.l}
                            </button>
                          ))}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {formData.is_gst_registered && (
                            <>
                              <div>
                                <label className={lbl}>GSTIN (15-digit) <span className="text-rose-400">*</span></label>
                                <input type="text" placeholder="27AAACR1234F1Z5" maxLength={15} value={formData.gstNumber} onChange={(e) => set("gstNumber", e.target.value.toUpperCase())} className={inpMonoErr("gstNumber")} />
                                {validationErrors.gstNumber && <p className="text-rose-400 text-[10px] mt-1">{validationErrors.gstNumber}</p>}
                                {formData.gstNumber.length >= 2 && GSTIN_STATE_MAP[formData.gstNumber.substring(0, 2)] && (
                                  <p className="text-emerald-400 text-[10px] mt-1">✓ State: {GSTIN_STATE_MAP[formData.gstNumber.substring(0, 2)]}</p>
                                )}
                              </div>
                              <div>
                                <label className={lbl}>GST Category</label>
                                <select value={formData.gst_type} onChange={(e) => set("gst_type", e.target.value)} className={sel}>
                                  {["Regular", "Composition", "SEZ Unit", "SEZ Developer", "Embassy/UN Body", "TDS Deductor", "Unregistered"].map((t) => (<option key={t} value={t}>{t}</option>))}
                                </select>
                              </div>
                            </>
                          )}
                          <div>
                            <label className={lbl}>Place of Supply</label>
                            <select value={formData.place_of_supply} onChange={(e) => set("place_of_supply", e.target.value)} className={sel}>
                              {INDIAN_STATES.map((s) => (<option key={s} value={s}>{s}</option>))}
                            </select>
                          </div>
                          <div><label className={lbl}>PAN Number</label><input type="text" placeholder="ABCDE1234F" maxLength={10} value={formData.pan} onChange={(e) => set("pan", e.target.value.toUpperCase())} className={inpMono} /></div>
                          <div><label className={lbl}>TAN Number</label><input type="text" placeholder="MUMB12345F" value={formData.tan} onChange={(e) => set("tan", e.target.value.toUpperCase())} className={inpMono} /></div>
                          <div><label className={lbl}>CIN Number</label><input type="text" placeholder="U72200MH2010PLC123456" value={formData.cin} onChange={(e) => set("cin", e.target.value.toUpperCase())} className={inpMono} /></div>
                        </div>
                      </div>
                    </SectionPanel>

                    <SectionPanel sectionKey="billing" title="Billing Address" icon={<MapPin className="w-4 h-4" />}>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="md:col-span-2"><label className={lbl}>Building / Flat / House No.</label><input type="text" placeholder="Plot No. 45, Tower B" value={formData.billingAddressLine1} onChange={(e) => set("billingAddressLine1", e.target.value)} className={inp} /></div>
                        <div><label className={lbl}>Street / Road</label><input type="text" placeholder="MIDC Industrial Area" value={formData.billingAddressLine2} onChange={(e) => set("billingAddressLine2", e.target.value)} className={inp} /></div>
                        <div><label className={lbl}>City</label><input type="text" value={formData.billingCity} onChange={(e) => set("billingCity", e.target.value)} className={inp} /></div>
                        <div>
                          <label className={lbl}>State</label>
                          <select value={formData.billingState} onChange={(e) => set("billingState", e.target.value)} className={sel}>
                            {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                        <div><label className={lbl}>PIN Code</label><input type="text" maxLength={6} placeholder="400093" value={formData.billingPincode} onChange={(e) => set("billingPincode", e.target.value)} className={inpMono} /></div>
                      </div>
                    </SectionPanel>

                    <SectionPanel sectionKey="shipping" title="Shipping Addresses" icon={<Truck className="w-4 h-4" />} badge={extraAddresses.length > 0 ? extraAddresses.length + 1 : undefined}>
                      <div className="space-y-4">
                        <div className="p-3 bg-theme-surface-1 border border-theme-divider rounded-xl flex items-center justify-between">
                          <span className="text-xs font-bold text-theme-heading">Shipping Same as Billing Address?</span>
                          <button type="button" onClick={() => set("shippingSameAsBilling", !formData.shippingSameAsBilling)} className={`px-3.5 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${formData.shippingSameAsBilling ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/40" : "bg-slate-500/10 text-slate-400 border-slate-500/30"}`}>
                            {formData.shippingSameAsBilling ? "Yes — Same as Billing" : "No — Custom Shipping Location"}
                          </button>
                        </div>
                      </div>
                    </SectionPanel>

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

                    <button type="button" onClick={() => switchMode("quick")} className="w-full py-2 border border-dashed border-theme-divider rounded-xl text-xs font-bold text-theme-muted hover:text-[#0a6ed1] hover:border-[#0a6ed1]/40 transition-colors cursor-pointer flex items-center justify-center gap-2">
                      ← Back to Quick Add Mode
                    </button>
                  </div>
                )}
              </form>
            </SmritiScrollArea>

            {/* Modal Sticky Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-theme-divider bg-theme-surface-2">
              <button type="button" onClick={handleCloseModal} className="px-4 py-2 text-xs font-bold text-theme-muted hover:text-theme-heading transition-colors cursor-pointer">
                Cancel
              </button>
              <div className="flex items-center gap-2">
                <button type="button" onClick={(e) => handleSubmit(e as any, true)} disabled={isSubmitting} className="px-4 py-2 text-xs font-bold bg-theme-surface-3 hover:bg-theme-surface-4 text-theme-heading border border-theme-divider rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50">
                  <Plus className="w-3.5 h-3.5" /> Save &amp; New
                </button>
                <button type="submit" form="customer-form" disabled={isSubmitting} className="px-5 py-2 text-xs font-bold bg-[#0a6ed1] hover:bg-[#085caf] text-white rounded-lg transition-colors shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-60">
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
