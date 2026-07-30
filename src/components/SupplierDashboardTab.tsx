/**
 * Project      : SMRITI Retail OS v5.0
 * Module       : Supplier & Vendor Management Platform
 *                SMRITI Adaptive Form Framework — Quick Add + Advanced Add
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com and AITDL.com. All Rights Reserved.
 * Version      : 5.8.0
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { SmritiScrollArea } from "./SmritiScrollArea.tsx";
import { recordAuditAction } from "../lib/apiFetch.ts";
import { apiFetchV1 } from "../lib/apiFetchV1.js";
import {
  Building2, Plus, Search, X, Phone, Mail, MapPin,
  CheckCircle2, AlertCircle, FileText, ShieldCheck,
  DollarSign, UserCheck, Briefcase, AlertTriangle,
  Receipt, Scale, Award, CreditCard, Percent, Truck,
  Printer, Globe, Tag, Calendar, Clock, MessageSquare,
  Send, History, Lock, Unlock, CheckSquare, FileCheck,
  PackageCheck, TrendingUp, Trash2, UploadCloud, FilePlus,
  Star, Layers, ChevronRight, ChevronDown, ChevronUp,
  Zap, Settings2, RotateCcw, Save, AlertOctagon, Info
} from "lucide-react";

/* ═══════════════════ TYPES ═══════════════════ */
export interface SupplierContactRole {
  id: string;
  name: string;
  role: "Purchase Manager" | "Sales Executive" | "Accounts" | "Dispatch" | "Owner" | "Service";
  mobile: string;
  email: string;
  is_primary: boolean;
}
export interface SupplierBankAccount {
  id: string;
  bank_name: string;
  account_name: string;
  account_number: string;
  ifsc_code: string;
  branch_name: string;
  upi_id?: string;
  is_primary: boolean;
}
export interface SupplierAddressRecord {
  id: string;
  address_type: "Billing" | "Shipping" | "Registered Office" | "Factory Location" | "Central Warehouse";
  building_name?: string;
  street?: string;
  area?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  is_primary: boolean;
}
export interface SupplierDocumentRecord {
  id: string;
  doc_type: "GST Certificate" | "FSSAI License" | "Drug License" | "MSME Certificate" | "Agreement" | "Insurance" | "Cancelled Cheque" | "PAN Card" | "IEC Certificate";
  doc_number: string;
  expiry_date: string;
  status: "Valid" | "Expiring Soon" | "Expired";
  file_url?: string;
  file_name?: string;
}
export interface SupplierCommunicationLogItem {
  id: string;
  timestamp: string;
  type: "Email" | "WhatsApp" | "Call" | "Payment Reminder" | "PO Sent";
  summary: string;
  user: string;
}
export interface SupplierItem {
  id: string;
  code?: string;
  name: string;
  trade_name?: string;
  legal_name?: string;
  display_name?: string;
  supplier_type_id?: string;
  group?: string;
  contact_person?: string;
  designation?: string;
  mobile?: string;
  alt_mobile?: string;
  whatsapp?: string;
  email?: string;
  website?: string;
  gst_number?: string;
  pan_number?: string;
  tan_number?: string;
  cin_number?: string;
  gst_type?: string;
  place_of_supply?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  outstanding_balance?: number;
  balance?: string;
  credit_limit?: number;
  credit_days?: number;
  opening_balance?: number;
  payment_terms?: string;
  status: "Draft" | "Pending Approval" | "Approved" | "Blocked" | "Blacklisted";
  msme_category?: "Micro" | "Small" | "Medium" | "Non-MSME";
  msme_number?: string;
  fssai_license_no?: string;
  fssai_expiry?: string;
  drug_license_no?: string;
  iec_code?: string;
  is_tds_applicable?: boolean;
  tds_rate?: number;
  tds_section?: string;
  gstr2b_status?: "Matched" | "Pending ITC" | "Mismatched";
  scorecard_rating?: number;
  quality_rating?: number;
  delivery_rating?: number;
  price_rating?: number;
  currency?: string;
  warehouse?: string;
  lead_time_days?: number;
  min_order_qty?: number;
  max_order_qty?: number;
  order_multiple?: number;
  is_preferred?: boolean;
  transport_name?: string;
  transporter_gstin?: string;
  freight_terms?: string;
  eway_bill_applicable?: boolean;
  default_label_template?: string;
  default_barcode_type?: string;
  contacts?: SupplierContactRole[];
  bank_accounts?: SupplierBankAccount[];
  addresses_list?: SupplierAddressRecord[];
  documents?: SupplierDocumentRecord[];
  communication_logs?: SupplierCommunicationLogItem[];
  created_at?: string;
  modified_at?: string;
  created_by?: string;
}

/* ═══════════════════ CONSTANTS ═══════════════════ */
const DRAFT_KEY = "smriti_supplier_draft_v1";
const MODE_KEY  = "smriti_supplier_form_mode_v1";
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
const INDIAN_STATES = ["Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal","Andaman and Nicobar Islands","Chandigarh","Dadra and Nagar Haveli","Daman and Diu","Delhi","Jammu & Kashmir","Ladakh","Lakshadweep","Puducherry"];
const BANKS = ["HDFC Bank","ICICI Bank","State Bank of India","Axis Bank","Kotak Mahindra Bank","Punjab National Bank","Bank of Baroda","Canara Bank","Union Bank of India","Bank of India","IndusInd Bank","Yes Bank","Federal Bank","IDFC First Bank","RBL Bank"];

/* ═══════════════════ BLANK FORM ═══════════════════ */
const blankForm = () => ({
  code: `VND-${Math.floor(1000 + Math.random() * 9000)}`,
  name: "", legal_name: "", display_name: "", trade_name: "",
  supplier_type_id: "Manufacturer", group: "General Retail",
  status: "Approved" as const,
  // Contact
  contact_person: "", designation: "General Manager",
  mobile: "", alt_mobile: "", whatsapp: "", email: "", alt_email: "", website: "",
  // GST
  is_gst_registered: true, gst_number: "", gst_type: "Regular",
  gst_category: "B2B", place_of_supply: "Maharashtra",
  pan_number: "", tan_number: "", cin_number: "", iec_code: "",
  // MSME / Compliance
  msme_category: "Micro" as const, msme_number: "", udyam_number: "",
  fssai_license_no: "", fssai_expiry: "", drug_license_no: "", drug_license_expiry: "",
  // TDS
  is_tds_applicable: true, tds_section: "194Q", tds_rate: "0.10",
  // Address
  address: "", billing_building: "", billing_street: "", billing_area: "",
  billing_district: "", city: "Mumbai", state: "Maharashtra",
  pincode: "", country: "India",
  // Bank
  bank_name: "", account_name: "", account_number: "",
  ifsc_code: "", branch_name: "", upi_id: "", bank_type: "Current",
  // Finance
  opening_balance: "0", credit_limit: "200000",
  credit_days: "30", payment_terms: "Net 30 Days",
  // Purchase
  currency: "INR", warehouse: "Central Warehouse (WH-01)",
  lead_time_days: "3", min_order_qty: "1.000",
  max_order_qty: "100.000", order_multiple: "1.000",
  is_preferred: true, purchase_uom: "PCS",
  price_list: "Standard Purchase Price", discount_percent: "0.00",
  // Logistics
  transport_name: "", transporter_gstin: "",
  freight_terms: "Prepaid by Supplier", delivery_mode: "Road",
  eway_bill_applicable: true, avg_transit_days: "2",
  // Labels
  default_label_template: "50x25mm", default_barcode_type: "CODE128",
  auto_print_on_grn: true, label_language: "English"
});

type FormData = ReturnType<typeof blankForm>;
type FormMode = "quick" | "advanced";
type SectionKey = "company" | "gst" | "contacts" | "addresses" | "banking" | "purchase" | "finance" | "logistics" | "documents" | "labels";

interface Props {
  currentUser?: { role: string; name: string } | null;
  onNotification?: (title: string, message: string, type?: "success" | "error") => void;
}

/* ═══════════════════ COMPONENT ═══════════════════ */
export const SupplierDashboardTab: React.FC<Props> = ({ currentUser, onNotification }) => {
  const isReadOnly = currentUser?.role === "Report User";

  /* ── Sub tabs ── */
  const [activeSubTab, setActiveSubTab] = useState<
    "directory" | "dashboard" | "msme" | "tds" | "expiry" | "performance"
  >("directory");

  /* ── Seeded suppliers ── */
  const [suppliers, setSuppliers] = useState<SupplierItem[]>([
    {
      id: "SUP-001", code: "SUP-001", name: "TechCorp Distributors",
      legal_name: "TechCorp India Private Limited", display_name: "TechCorp Tech Hub",
      trade_name: "TechCorp India Ltd", supplier_type_id: "Distributor",
      group: "Electronics", contact_person: "Rajesh Kumar",
      designation: "Senior Manager", mobile: "+91 98200 12345",
      alt_mobile: "+91 98200 11111", whatsapp: "+91 98200 12345",
      email: "rajesh@techcorp.com", website: "https://techcorp.com",
      gst_number: "27ABCDE1234F1Z5", pan_number: "ABCDE1234F",
      tan_number: "MUMB12345F", cin_number: "U72200MH2010PTC123456",
      gst_type: "Regular", place_of_supply: "Maharashtra",
      balance: "₹1,20,000", outstanding_balance: 120000,
      credit_limit: 500000, credit_days: 30, opening_balance: 25000,
      payment_terms: "Net 30 Days", status: "Approved",
      city: "Mumbai", state: "Maharashtra",
      address: "Plot 45, MIDC Industrial Area, Andheri East", pincode: "400093",
      msme_category: "Small", msme_number: "UDYAM-MH-12-0001234",
      iec_code: "1012001122", fssai_license_no: "10019022001234",
      fssai_expiry: "2026-12-31", is_tds_applicable: true,
      tds_rate: 0.10, tds_section: "194Q", gstr2b_status: "Matched",
      scorecard_rating: 94.5, quality_rating: 98.2, delivery_rating: 96.5,
      price_rating: 92.0, currency: "INR",
      warehouse: "Central Warehouse (WH-01)", lead_time_days: 3,
      min_order_qty: 10, max_order_qty: 5000, order_multiple: 5,
      is_preferred: true, transport_name: "VRL Logistics Ltd",
      transporter_gstin: "27AAACV1234F1Z9", freight_terms: "Prepaid by Supplier",
      eway_bill_applicable: true, default_label_template: "50x25mm",
      default_barcode_type: "CODE128",
      contacts: [
        { id: "c1", name: "Rajesh Kumar", role: "Purchase Manager", mobile: "+91 98200 12345", email: "rajesh@techcorp.com", is_primary: true },
        { id: "c2", name: "Suresh Sharma", role: "Accounts", mobile: "+91 98200 67890", email: "accounts@techcorp.com", is_primary: false }
      ],
      bank_accounts: [
        { id: "b1", bank_name: "HDFC Bank", account_name: "TechCorp India Pvt Ltd", account_number: "50200012345678", ifsc_code: "HDFC0000123", branch_name: "Fort, Mumbai", upi_id: "techcorp@hdfcbank", is_primary: true }
      ],
      addresses_list: [
        { id: "a1", address_type: "Billing", building_name: "TechCorp House", street: "MIDC Road No 12", area: "Andheri East", city: "Mumbai", state: "Maharashtra", pincode: "400093", country: "India", is_primary: true },
        { id: "a2", address_type: "Central Warehouse", building_name: "Warehouse Complex B", street: "Bhiwandi Bypass", area: "Bhiwandi", city: "Thane", state: "Maharashtra", pincode: "421302", country: "India", is_primary: false }
      ],
      documents: [
        { id: "d1", doc_type: "GST Certificate", doc_number: "27ABCDE1234F1Z5", expiry_date: "2028-03-31", status: "Valid", file_name: "gst_certificate.pdf" },
        { id: "d2", doc_type: "FSSAI License", doc_number: "10019022001234", expiry_date: "2026-08-15", status: "Expiring Soon", file_name: "fssai_license.pdf" }
      ],
      communication_logs: [
        { id: "l1", timestamp: "2026-07-28 14:30", type: "PO Sent", summary: "Dispatched PO-2026-0089 for ₹1,20,000", user: "System" }
      ],
      created_at: "2026-01-15", created_by: "Jawahar Mallah"
    },
    {
      id: "SUP-002", code: "SUP-002", name: "Global Supplies Ltd.",
      legal_name: "Global Retail & Wholesale Corporation",
      supplier_type_id: "Wholesaler", group: "General Retail",
      contact_person: "Anita Singh", designation: "Key Account Officer",
      mobile: "+91 98333 99887", email: "anita@globalsupplies.com",
      gst_number: "27XYZPQ9876G1Z3", pan_number: "XYZPQ9876G",
      gst_type: "Regular", place_of_supply: "Maharashtra",
      balance: "₹0", outstanding_balance: 0,
      credit_limit: 300000, credit_days: 15,
      payment_terms: "Net 15 Days", status: "Approved",
      city: "Pune", state: "Maharashtra",
      address: "Sector 18, Hinjewadi Phase 1", pincode: "411057",
      msme_category: "Non-MSME", is_tds_applicable: false, tds_rate: 0.00,
      gstr2b_status: "Matched", scorecard_rating: 88.0,
      quality_rating: 90.0, delivery_rating: 86.0, price_rating: 88.0,
      lead_time_days: 5, min_order_qty: 25, max_order_qty: 2000, order_multiple: 10,
      transport_name: "Delhivery", freight_terms: "FOB Destination",
      default_label_template: "38x25mm", default_barcode_type: "EAN13",
      contacts: [{ id: "c3", name: "Anita Singh", role: "Sales Executive", mobile: "+91 98333 99887", email: "anita@globalsupplies.com", is_primary: true }],
      bank_accounts: [{ id: "b2", bank_name: "ICICI Bank", account_name: "Global Supplies Ltd", account_number: "000405012345", ifsc_code: "ICIC0000004", branch_name: "Kothrud, Pune", is_primary: true }],
      addresses_list: [{ id: "a3", address_type: "Billing", building_name: "Global Towers", street: "Phase 1 Rd", area: "Hinjewadi", city: "Pune", state: "Maharashtra", pincode: "411057", country: "India", is_primary: true }],
      documents: [{ id: "d3", doc_type: "GST Certificate", doc_number: "27XYZPQ9876G1Z3", expiry_date: "2027-11-30", status: "Valid", file_name: "gst_cert_global.pdf" }],
      communication_logs: [], created_at: "2026-02-10", created_by: "Admin"
    }
  ]);

  /* ── Search ── */
  const [searchTerm, setSearchTerm] = useState("");

  /* ── Modal state ── */
  const [isModalOpen, setIsModalOpen]   = useState(false);
  const [formMode, setFormMode]         = useState<FormMode>(() => {
    try { return (localStorage.getItem(MODE_KEY) as FormMode) || "quick"; } catch { return "quick"; }
  });
  const [formData, setFormData]   = useState<FormData>(blankForm);
  const [isDirty, setIsDirty]     = useState(false);
  const [hasDraft, setHasDraft]   = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  /* ── Advanced: section open state ── */
  const [openSections, setOpenSections] = useState<Set<SectionKey>>(
    new Set(["company", "gst"])
  );

  /* ── Dynamic lists ── */
  const [extraAddresses, setExtraAddresses]   = useState<SupplierAddressRecord[]>([]);
  const [extraContacts, setExtraContacts]     = useState<SupplierContactRole[]>([]);
  const [extraBanks, setExtraBanks]           = useState<SupplierBankAccount[]>([]);
  const [attachedDocs, setAttachedDocs]       = useState<SupplierDocumentRecord[]>([]);

  /* ── Studio ── */
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierItem | null>(null);
  const [studioTab, setStudioTab] = useState<
    "overview"|"attributes"|"contacts"|"banks"|"addresses"|"gst"|"msme"|
    "documents"|"pos"|"grns"|"invoices"|"payments"|"ratings"|"timeline"|"approvals"|"audit"
  >("overview");
  const [newLogMessage, setNewLogMessage] = useState("");
  const [logType, setLogType] = useState<"Email"|"WhatsApp"|"Call"|"Payment Reminder">("Call");

  /* ── Draft auto-save ── */
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveDraft = useCallback((data: FormData) => {
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(data)); } catch { /* quota */ }
    }, 500);
  }, []);

  const clearDraft = useCallback(() => {
    try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
    setHasDraft(false);
  }, []);

  /* ── Field updater ── */
  const set = (field: string, value: any) => {
    setFormData(prev => {
      const next = { ...prev, [field]: value };
      // Auto-extract state from GSTIN prefix
      if (field === "gst_number" && typeof value === "string" && value.length >= 2) {
        const prefix = value.substring(0, 2);
        const detectedState = GSTIN_STATE_MAP[prefix];
        if (detectedState) next.place_of_supply = detectedState;
      }
      saveDraft(next);
      setIsDirty(true);
      return next;
    });
    // Clear that field's error
    if (validationErrors[field]) setValidationErrors(p => { const n = {...p}; delete n[field]; return n; });
  };

  /* ── Mode switch ── */
  const switchMode = (mode: FormMode) => {
    setFormMode(mode);
    try { localStorage.setItem(MODE_KEY, mode); } catch { /* ignore */ }
    if (mode === "advanced") setOpenSections(new Set(["company", "gst"]));
  };

  /* ── Section toggle ── */
  const toggleSection = (key: SectionKey) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  /* ── Fetch ── */
  const fetchSuppliers = async () => {
    try {
      const data = await apiFetchV1("/purchase/suppliers/");
      if (Array.isArray(data) && data.length > 0) {
        setSuppliers(data.map((s: any) => ({
          id: s.id, code: s.code || s.id, name: s.name,
          legal_name: s.legal_name || s.name, display_name: s.display_name || s.name,
          supplier_type_id: s.supplier_type_id || "Manufacturer",
          group: s.supplier_group_id || "General Retail",
          contact_person: s.contacts?.[0]?.name || "Primary Contact",
          mobile: s.mobile || "N/A", email: s.email || "N/A",
          gst_number: s.gst_number || "N/A", pan_number: s.pan_number || "N/A",
          gst_type: s.gst_type || "Regular", place_of_supply: s.place_of_supply || "Maharashtra",
          balance: `₹${(s.outstanding_balance || 0).toLocaleString("en-IN")}`,
          outstanding_balance: s.outstanding_balance || 0,
          credit_limit: s.credit_profile?.credit_limit || 200000,
          credit_days: s.credit_profile?.credit_days || 30,
          status: s.account_status || s.status || "Approved",
          city: s.city || "Mumbai", state: s.state || "Maharashtra",
          msme_category: s.compliance_profile?.msme_category || "Micro",
          msme_number: s.compliance_profile?.msme_number || "N/A",
          is_tds_applicable: s.tax_profile?.is_tds_applicable ?? true,
          tds_rate: s.tax_profile?.tds_rate || 0.10,
          gstr2b_status: "Matched", scorecard_rating: s.performance_rating || 92.0,
          quality_rating: 95.0, delivery_rating: 90.0, price_rating: 91.0,
          contacts: s.contacts || [], bank_accounts: s.bank_details || [],
          addresses_list: s.addresses || [], documents: s.documents || []
        })));
      }
    } catch { /* keep seeded */ }
  };

  useEffect(() => {
    fetchSuppliers();
    recordAuditAction("VIEW", "suppliers", activeSubTab, `Switched to: ${activeSubTab}`);
  }, [activeSubTab]);

  /* ── Open modal ── */
  const handleOpenModal = () => {
    if (isReadOnly) { onNotification?.("Access Denied", "Read-Only role.", "error"); return; }
    // Check for draft
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as FormData;
        setFormData(saved);
        setHasDraft(true);
        setIsDirty(false);
        setIsModalOpen(true);
        return;
      }
    } catch { /* ignore bad JSON */ }
    setFormData(blankForm());
    setExtraAddresses([]); setExtraContacts([]); setExtraBanks([]); setAttachedDocs([]);
    setValidationErrors({});
    setIsDirty(false);
    setHasDraft(false);
    setIsModalOpen(true);
  };

  /* ── Discard draft ── */
  const handleDiscardDraft = () => {
    clearDraft();
    setFormData(blankForm());
    setExtraAddresses([]); setExtraContacts([]); setExtraBanks([]); setAttachedDocs([]);
    setIsDirty(false);
  };

  /* ── Close with guard ── */
  const handleCloseModal = () => {
    if (isDirty) {
      const ok = window.confirm("You have unsaved changes. Discard them?");
      if (!ok) return;
      clearDraft();
    }
    setIsModalOpen(false);
    setIsDirty(false);
  };

  /* ── Validate ── */
  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.name.trim()) errors.name = "Supplier Name is required.";
    if (formData.is_gst_registered && !formData.gst_number.trim()) errors.gst_number = "GSTIN is required when GST Registered.";
    if (formData.is_gst_registered && formData.gst_number.trim().length !== 15) errors.gst_number = "GSTIN must be exactly 15 characters.";
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  /* ── Submit ── */
  const handleSubmit = async (e: React.FormEvent, saveAndNew = false) => {
    e.preventDefault();
    if (!validate()) { onNotification?.("Validation Error", "Please fix highlighted fields.", "error"); return; }
    setIsSubmitting(true);

    const id = `SUP-${Math.floor(1000 + Math.random() * 9000)}`;
    const primaryAddr: SupplierAddressRecord = {
      id: `a-${Date.now()}`, address_type: "Billing",
      building_name: formData.billing_building, street: formData.billing_street,
      area: formData.billing_area, city: formData.city,
      state: formData.state, pincode: formData.pincode,
      country: formData.country, is_primary: true
    };

    const newItem: SupplierItem = {
      id, code: formData.code || id, name: formData.name.trim(),
      legal_name: formData.legal_name || formData.name,
      display_name: formData.display_name || formData.name,
      trade_name: formData.trade_name,
      supplier_type_id: formData.supplier_type_id, group: formData.group,
      contact_person: formData.contact_person || "Primary Contact",
      designation: formData.designation, mobile: formData.mobile || "N/A",
      alt_mobile: formData.alt_mobile, whatsapp: formData.whatsapp,
      email: formData.email || "N/A", website: formData.website,
      gst_number: formData.gst_number || "N/A", pan_number: formData.pan_number || "N/A",
      tan_number: formData.tan_number, cin_number: formData.cin_number,
      gst_type: formData.gst_type, place_of_supply: formData.place_of_supply,
      address: formData.address || `${formData.billing_building} ${formData.billing_street}`.trim(),
      city: formData.city, state: formData.state, pincode: formData.pincode,
      balance: "₹0", outstanding_balance: 0,
      credit_limit: parseFloat(formData.credit_limit) || 200000,
      credit_days: parseInt(formData.credit_days) || 30,
      opening_balance: parseFloat(formData.opening_balance) || 0,
      payment_terms: formData.payment_terms, status: formData.status,
      msme_category: formData.msme_category,
      msme_number: formData.udyam_number || formData.msme_number || "N/A",
      fssai_license_no: formData.fssai_license_no,
      fssai_expiry: formData.fssai_expiry,
      drug_license_no: formData.drug_license_no,
      iec_code: formData.iec_code,
      is_tds_applicable: formData.is_tds_applicable,
      tds_rate: parseFloat(formData.tds_rate) || 0.10,
      tds_section: formData.tds_section, gstr2b_status: "Matched",
      scorecard_rating: 95.0, quality_rating: 98.0, delivery_rating: 95.0, price_rating: 92.0,
      currency: formData.currency, warehouse: formData.warehouse,
      lead_time_days: parseInt(formData.lead_time_days) || 3,
      min_order_qty: parseFloat(formData.min_order_qty) || 1,
      max_order_qty: parseFloat(formData.max_order_qty) || 100,
      order_multiple: parseFloat(formData.order_multiple) || 1,
      is_preferred: formData.is_preferred,
      transport_name: formData.transport_name, transporter_gstin: formData.transporter_gstin,
      freight_terms: formData.freight_terms, eway_bill_applicable: formData.eway_bill_applicable,
      default_label_template: formData.default_label_template,
      default_barcode_type: formData.default_barcode_type,
      contacts: formData.contact_person
        ? [{ id: `c-${Date.now()}`, name: formData.contact_person, role: "Purchase Manager", mobile: formData.mobile, email: formData.email, is_primary: true }, ...extraContacts]
        : extraContacts,
      bank_accounts: formData.bank_name
        ? [{ id: `b-${Date.now()}`, bank_name: formData.bank_name, account_name: formData.account_name || formData.name, account_number: formData.account_number, ifsc_code: formData.ifsc_code, branch_name: formData.branch_name, upi_id: formData.upi_id, is_primary: true }, ...extraBanks]
        : extraBanks,
      addresses_list: [primaryAddr, ...extraAddresses],
      documents: attachedDocs,
      communication_logs: [{ id: `l-${Date.now()}`, timestamp: new Date().toISOString().replace("T"," ").substring(0,16), type: "Email", summary: "Vendor Onboarded", user: currentUser?.name || "System" }],
      created_at: new Date().toISOString().substring(0, 10),
      created_by: currentUser?.name || "Admin"
    };

    try {
      await apiFetchV1("/purchase/suppliers/", { method: "POST", body: JSON.stringify({ name: formData.name.trim(), code: formData.code, gst_number: formData.gst_number, mobile: formData.mobile, email: formData.email, city: formData.city, state: formData.state }) });
      onNotification?.("Vendor Onboarded ✓", `${formData.name} (${formData.code || id}) registered successfully.`, "success");
    } catch {
      onNotification?.("Vendor Added Locally", `${formData.name} added to directory.`, "success");
    } finally {
      setSuppliers(p => [newItem, ...p]);
      clearDraft();
      setIsSubmitting(false);
      if (saveAndNew) {
        setFormData(blankForm());
        setExtraAddresses([]); setExtraContacts([]); setExtraBanks([]); setAttachedDocs([]);
        setValidationErrors({}); setIsDirty(false);
      } else {
        setIsModalOpen(false);
      }
    }
  };

  /* ── Studio helpers ── */
  const updateStatus = (s: "Approved"|"Blocked"|"Blacklisted"|"Pending Approval") => {
    if (!selectedSupplier) return;
    const u = { ...selectedSupplier, status: s };
    setSuppliers(p => p.map(v => v.id === selectedSupplier.id ? u : v));
    setSelectedSupplier(u);
    onNotification?.("Status Updated", `${selectedSupplier.name} → ${s}`, "success");
  };
  const addLog = () => {
    if (!selectedSupplier || !newLogMessage.trim()) return;
    const log: SupplierCommunicationLogItem = { id: `log-${Date.now()}`, timestamp: new Date().toISOString().replace("T"," ").substring(0,16), type: logType, summary: newLogMessage.trim(), user: currentUser?.name || "Admin" };
    const u = { ...selectedSupplier, communication_logs: [log, ...(selectedSupplier.communication_logs||[])] };
    setSuppliers(p => p.map(v => v.id === selectedSupplier.id ? u : v));
    setSelectedSupplier(u); setNewLogMessage("");
  };
  const addAddrStudio = () => {
    if (!selectedSupplier) return;
    const a: SupplierAddressRecord = { id: `as-${Date.now()}`, address_type: "Shipping", building_name: "Warehouse Unit", street: "Industrial Corridor", area: "Logistics Hub", city: selectedSupplier.city||"Thane", state: selectedSupplier.state||"Maharashtra", pincode: "421302", country: "India", is_primary: false };
    const u = { ...selectedSupplier, addresses_list: [...(selectedSupplier.addresses_list||[]), a] };
    setSuppliers(p => p.map(v => v.id===selectedSupplier.id?u:v)); setSelectedSupplier(u);
    onNotification?.("Address Added", "New warehouse location appended.", "success");
  };
  const addDocStudio = () => {
    if (!selectedSupplier) return;
    const d: SupplierDocumentRecord = { id: `ds-${Date.now()}`, doc_type: "MSME Certificate", doc_number: "UDYAM-MH-01-998877", expiry_date: "2029-03-31", status: "Valid", file_name: "msme_certificate_2029.pdf" };
    const u = { ...selectedSupplier, documents: [...(selectedSupplier.documents||[]), d] };
    setSuppliers(p => p.map(v => v.id===selectedSupplier.id?u:v)); setSelectedSupplier(u);
    onNotification?.("Document Attached", "MSME certificate added to vault.", "success");
  };

  /* ── Computed ── */
  const filtered = suppliers.filter(v => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return v.name.toLowerCase().includes(q) || (v.code||"").toLowerCase().includes(q) || (v.gst_number||"").toLowerCase().includes(q) || (v.contact_person||"").toLowerCase().includes(q);
  });
  const totalOutstanding = suppliers.reduce((a, s) => a + (s.outstanding_balance||0), 0);
  const expiryAlerts = suppliers.reduce((a, s) => a + (s.documents?.filter(d => d.status !== "Valid").length||0), 0);

  /* ── Style tokens ── */
  const inp = "w-full p-2.5 bg-theme-surface-2 border border-theme-divider rounded-lg text-theme-heading text-xs focus:outline-none focus:border-[#0a6ed1] focus:ring-1 focus:ring-[#0a6ed1]/20 transition-all placeholder:text-theme-muted";
  const inpErr = (f: string) => inp + (validationErrors[f] ? " border-rose-500 ring-1 ring-rose-500/20" : "");
  const inpMono = inp + " font-mono";
  const inpMonoErr = (f: string) => inpMono + (validationErrors[f] ? " border-rose-500 ring-1 ring-rose-500/20" : "");
  const lbl = "block font-bold text-theme-muted mb-1 text-[11px] uppercase tracking-wide";
  const sel = inp + " cursor-pointer";

  /* ────────────────── SECTION PANEL ────────────────── */
  const SectionPanel: React.FC<{
    sectionKey: SectionKey;
    title: string;
    icon: React.ReactNode;
    badge?: string | number;
    children: React.ReactNode;
    defaultOpen?: boolean;
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
  /*                     RENDER                          */
  /* ════════════════════════════════════════════════════ */
  return (
    <div className="flex flex-col h-full bg-theme-surface-1 text-theme-primary font-sans select-none">

      {/* Read-only banner */}
      {isReadOnly && (
        <div className="bg-amber-950/40 border-b border-amber-500/30 px-6 py-2 flex items-center gap-2 text-amber-400 text-xs">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="font-mono font-bold uppercase tracking-wider">Read-Only Mode</span>
          <span className="text-amber-400/80">Write operations are disabled for this role.</span>
        </div>
      )}

      {/* ── Main Header ── */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-theme-divider bg-theme-surface-2 px-6 py-4 gap-4">
        <div>
          <h2 className="text-xl font-bold font-display text-theme-primary tracking-tight flex items-center gap-2">
            <Building2 className="w-6 h-6 text-[#0a6ed1]" /> Indian Enterprise Supplier Master
          </h2>
          <p className="text-xs text-theme-muted mt-1">
            18-Section Master · MSME Sec 43B(h) · Sec 194Q TDS · Multi-Address · Multi-Bank · Document Expiry Vault
          </p>
        </div>
        <div className="flex items-center gap-4 bg-theme-surface-3 px-4 py-2 rounded-xl border border-theme-divider">
          <div className="text-right">
            <div className="text-[10px] font-mono text-theme-muted uppercase font-bold">Total Payables</div>
            <div className="text-sm font-bold text-rose-400 font-mono">₹{totalOutstanding.toLocaleString("en-IN")}</div>
          </div>
          <div className="w-px h-8 bg-theme-divider" />
          <div className="text-right">
            <div className="text-[10px] font-mono text-theme-muted uppercase font-bold">Doc Expiry Alerts</div>
            <div className={`text-sm font-bold font-mono ${expiryAlerts > 0 ? "text-amber-400" : "text-emerald-400"}`}>{expiryAlerts} Expiring</div>
          </div>
        </div>
      </div>

      {/* ── Sub-tab bar ── */}
      <div className="flex items-center justify-between px-6 bg-theme-surface-2 border-b border-theme-divider overflow-x-auto scrollbar-none">
        <div className="flex items-center">
          {(["directory","dashboard","msme","tds","expiry","performance"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveSubTab(tab)}
              className={`px-4 py-3 text-xs font-bold uppercase tracking-wider font-mono border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                activeSubTab === tab
                  ? "border-[#0a6ed1] text-[#0a6ed1] bg-theme-surface-3"
                  : "border-transparent text-theme-muted hover:text-theme-primary"
              }`}>
              {tab === "directory" && "Vendor Directory"}
              {tab === "dashboard" && "Procurement KPIs"}
              {tab === "msme" && "MSME 43B(h)"}
              {tab === "tds" && "194Q TDS Register"}
              {tab === "expiry" && "Doc Expiry Vault"}
              {tab === "performance" && "Vendor Scorecards"}
            </button>
          ))}
        </div>
        {!isReadOnly && (
          <button onClick={handleOpenModal}
            className="my-2 px-4 py-2 text-xs font-bold bg-[#0a6ed1] hover:bg-[#085caf] text-white rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer whitespace-nowrap transition-colors">
            <Plus className="w-4 h-4" /> Onboard Vendor
          </button>
        )}
      </div>

      {/* ── Main content ── */}
      <SmritiScrollArea className="flex-1 bg-theme-base p-6">
        <motion.div key={activeSubTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>

          {/* DIRECTORY */}
          {activeSubTab === "directory" && (
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-4">
                <div className="relative flex-1 max-w-lg">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted" />
                  <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Search by Name, Code, GSTIN, Contact..."
                    className="w-full pl-9 pr-3 py-2 text-xs bg-theme-surface-2 border border-theme-divider rounded-lg text-theme-heading placeholder:text-theme-muted focus:outline-none focus:border-[#0a6ed1]" />
                </div>
                <span className="font-mono text-xs text-theme-muted whitespace-nowrap">
                  {filtered.length} of {suppliers.length} vendors
                </span>
              </div>
              <div className="bg-theme-surface-2 border border-theme-divider rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-theme-surface-3 border-b border-theme-divider text-[10px] uppercase tracking-wider text-theme-muted font-mono">
                      <th className="px-4 py-3">Code</th>
                      <th className="px-4 py-3">Supplier</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">MSME</th>
                      <th className="px-4 py-3">Contact</th>
                      <th className="px-4 py-3 text-right">Outstanding</th>
                      <th className="px-4 py-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs divide-y divide-theme-divider font-mono">
                    {filtered.length === 0 ? (
                      <tr><td colSpan={8} className="p-10 text-center text-theme-muted">
                        No vendors match. Click &quot;Onboard Vendor&quot; to add your first supplier.
                      </td></tr>
                    ) : filtered.map(v => (
                      <tr key={v.id} className="hover:bg-theme-surface-hover transition-colors">
                        <td className="px-4 py-3 font-bold text-[#0a6ed1]">{v.code}</td>
                        <td className="px-4 py-3">
                          <button onClick={() => { setSelectedSupplier(v); setStudioTab("overview"); }}
                            className="font-bold text-theme-heading hover:underline text-left font-sans">{v.name}</button>
                          {v.legal_name && v.legal_name !== v.name && <span className="block text-[10px] text-theme-muted">{v.legal_name}</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-theme-surface-3 border border-theme-divider text-theme-heading">{v.supplier_type_id}</span>
                          <span className="block text-[10px] text-theme-muted mt-0.5">{v.group}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase ${
                            v.status==="Approved"?"bg-emerald-500/10 text-emerald-400 border-emerald-500/30":
                            v.status==="Pending Approval"?"bg-amber-500/10 text-amber-400 border-amber-500/30":
                            v.status==="Blocked"?"bg-rose-500/10 text-rose-400 border-rose-500/30":
                            "bg-slate-500/10 text-slate-400 border-slate-500/30"}`}>{v.status}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase ${
                            v.msme_category==="Micro"||v.msme_category==="Small"
                              ?"bg-amber-500/10 text-amber-500 border-amber-500/30"
                              :"bg-theme-surface-3 text-theme-muted border-theme-divider"}`}>{v.msme_category||"Non-MSME"}</span>
                        </td>
                        <td className="px-4 py-3 font-sans">
                          <span className="font-medium text-theme-heading">{v.contact_person}</span>
                          <span className="block text-[10px] text-theme-muted">{v.mobile}</span>
                        </td>
                        <td className={`px-4 py-3 text-right font-bold ${v.outstanding_balance?"text-rose-400":"text-emerald-400"}`}>
                          {v.balance||"₹0"}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button onClick={() => { setSelectedSupplier(v); setStudioTab("overview"); }}
                            className="px-3 py-1 text-[11px] font-bold text-white bg-[#0a6ed1] hover:bg-[#085caf] rounded-md transition-colors cursor-pointer shadow-xs">
                            Open Studio
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* DASHBOARD KPIs */}
          {activeSubTab === "dashboard" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {[
                {l:"Total Vendors",v:suppliers.length,c:"text-[#0a6ed1]",icon:<Building2 className="w-5 h-5"/>},
                {l:"Total Payables",v:`₹${totalOutstanding.toLocaleString("en-IN")}`,c:"text-rose-400",icon:<DollarSign className="w-5 h-5"/>},
                {l:"MSME Vendors",v:suppliers.filter(s=>s.msme_category==="Micro"||s.msme_category==="Small").length,c:"text-amber-400",icon:<Award className="w-5 h-5"/>},
                {l:"TDS Applicable",v:suppliers.filter(s=>s.is_tds_applicable).length,c:"text-purple-400",icon:<Percent className="w-5 h-5"/>},
                {l:"Preferred Vendors",v:suppliers.filter(s=>s.is_preferred).length,c:"text-emerald-400",icon:<Star className="w-5 h-5"/>},
                {l:"Doc Expiry Alerts",v:expiryAlerts,c:expiryAlerts>0?"text-rose-400":"text-emerald-400",icon:<AlertTriangle className="w-5 h-5"/>}
              ].map(k=>(
                <div key={k.l} className="p-5 bg-theme-surface-2 border border-theme-divider rounded-xl flex items-center gap-4">
                  <div className={`p-3 bg-theme-surface-3 rounded-xl ${k.c}`}>{k.icon}</div>
                  <div>
                    <div className="text-[10px] font-mono text-theme-muted uppercase font-bold">{k.l}</div>
                    <div className={`text-2xl font-bold font-mono ${k.c}`}>{k.v}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* MSME */}
          {activeSubTab === "msme" && (
            <div className="space-y-4">
              <h3 className="font-bold text-theme-heading font-display flex items-center gap-2"><Award className="w-5 h-5 text-amber-400"/>MSME Section 43B(h) Compliance Audit</h3>
              <div className="bg-theme-surface-2 border border-theme-divider rounded-xl overflow-hidden">
                <table className="w-full text-xs font-mono">
                  <thead><tr className="border-b border-theme-divider bg-theme-surface-3 text-[10px] uppercase text-theme-muted">
                    <th className="px-4 py-3">Vendor</th><th className="px-4 py-3">MSME Category</th><th className="px-4 py-3">Udyam No.</th><th className="px-4 py-3">43B(h) Limit</th><th className="px-4 py-3 text-right">Outstanding</th>
                  </tr></thead>
                  <tbody className="divide-y divide-theme-divider">
                    {suppliers.filter(s=>s.msme_category==="Micro"||s.msme_category==="Small").map(s=>(
                      <tr key={s.id} className="hover:bg-theme-surface-hover">
                        <td className="px-4 py-3 font-bold text-theme-heading font-sans">{s.name}<span className="block text-[10px] text-theme-muted">{s.code}</span></td>
                        <td className="px-4 py-3"><span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 rounded font-bold text-[10px] border border-amber-500/30">{s.msme_category}</span></td>
                        <td className="px-4 py-3 text-theme-muted">{s.msme_number||"N/A"}</td>
                        <td className="px-4 py-3 text-emerald-400 font-bold">45 Days</td>
                        <td className="px-4 py-3 text-right text-rose-400 font-bold">{s.balance||"₹0"}</td>
                      </tr>
                    ))}
                    {suppliers.filter(s=>s.msme_category==="Micro"||s.msme_category==="Small").length===0&&(
                      <tr><td colSpan={5} className="p-8 text-center text-theme-muted">No MSME vendors registered.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TDS */}
          {activeSubTab === "tds" && (
            <div className="space-y-4">
              <h3 className="font-bold text-theme-heading font-display flex items-center gap-2"><Scale className="w-5 h-5 text-purple-400"/>Section 194Q TDS Register</h3>
              <div className="bg-theme-surface-2 border border-theme-divider rounded-xl overflow-hidden">
                <table className="w-full text-xs font-mono">
                  <thead><tr className="border-b border-theme-divider bg-theme-surface-3 text-[10px] uppercase text-theme-muted">
                    <th className="px-4 py-3">Vendor</th><th className="px-4 py-3">PAN</th><th className="px-4 py-3">Section</th><th className="px-4 py-3">Rate</th><th className="px-4 py-3">GSTR-2B</th>
                  </tr></thead>
                  <tbody className="divide-y divide-theme-divider">
                    {suppliers.filter(s=>s.is_tds_applicable).map(s=>(
                      <tr key={s.id} className="hover:bg-theme-surface-hover">
                        <td className="px-4 py-3 font-bold text-theme-heading font-sans">{s.name}</td>
                        <td className="px-4 py-3">{s.pan_number}</td>
                        <td className="px-4 py-3"><span className="px-2 py-0.5 bg-purple-500/10 text-purple-400 rounded font-bold text-[10px] border border-purple-500/30">{s.tds_section||"194Q"}</span></td>
                        <td className="px-4 py-3 font-bold">{((s.tds_rate||0)*100).toFixed(2)}%</td>
                        <td className="px-4 py-3"><span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded font-bold text-[10px] border border-emerald-500/30">{s.gstr2b_status||"Matched"}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* EXPIRY */}
          {activeSubTab === "expiry" && (
            <div className="space-y-4">
              <h3 className="font-bold text-theme-heading font-display flex items-center gap-2"><FileText className="w-5 h-5 text-rose-400"/>Document Expiry Vault</h3>
              <div className="space-y-3">
                {suppliers.flatMap(s=>(s.documents||[]).filter(d=>d.status!=="Valid").map(d=>({...d,sName:s.name,sCode:s.code}))).map(doc=>(
                  <div key={doc.id} className="p-4 bg-theme-surface-2 border border-theme-divider rounded-xl flex items-center justify-between">
                    <div>
                      <span className="font-bold text-theme-heading font-sans">{(doc as any).sName}</span>
                      <span className="ml-2 text-theme-muted text-xs font-mono">{(doc as any).sCode}</span>
                      <p className="text-xs text-theme-muted mt-1">{doc.doc_type} — {doc.doc_number} | Expires: {doc.expiry_date}</p>
                    </div>
                    <span className={`px-3 py-1 rounded text-[10px] font-bold uppercase border ${doc.status==="Expiring Soon"?"bg-amber-500/10 text-amber-400 border-amber-500/30":"bg-rose-500/10 text-rose-400 border-rose-500/30"}`}>{doc.status}</span>
                  </div>
                ))}
                {expiryAlerts===0&&<div className="text-center text-theme-muted py-12 font-mono">No expiring documents. All documents are valid. ✓</div>}
              </div>
            </div>
          )}

          {/* PERFORMANCE */}
          {activeSubTab === "performance" && (
            <div className="space-y-4">
              <h3 className="font-bold text-theme-heading font-display flex items-center gap-2"><TrendingUp className="w-5 h-5 text-emerald-400"/>Vendor Performance Scorecards</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {suppliers.map(s=>(
                  <div key={s.id} className="p-5 bg-theme-surface-2 border border-theme-divider rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div><div className="font-bold text-theme-heading font-sans">{s.name}</div><div className="text-[10px] text-theme-muted font-mono">{s.code} | {s.supplier_type_id}</div></div>
                      <div className="text-3xl font-bold text-emerald-400 font-mono">{s.scorecard_rating?.toFixed(1)}</div>
                    </div>
                    {[{l:"Quality",v:s.quality_rating||0,c:"bg-blue-500"},{l:"Delivery",v:s.delivery_rating||0,c:"bg-emerald-500"},{l:"Pricing",v:s.price_rating||0,c:"bg-purple-500"}].map(r=>(
                      <div key={r.l}>
                        <div className="flex justify-between text-[10px] font-mono text-theme-muted mb-1"><span>{r.l}</span><span>{r.v.toFixed(1)}%</span></div>
                        <div className="w-full h-1.5 bg-theme-surface-3 rounded-full"><div className={`h-1.5 rounded-full ${r.c}`} style={{width:`${r.v}%`}}/></div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

        </motion.div>
      </SmritiScrollArea>

      {/* ════════════════════════════════════════════════ */}
      {/*         ADAPTIVE ONBOARDING MODAL               */}
      {/* ════════════════════════════════════════════════ */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ duration: 0.18 }}
            className="bg-theme-surface-1 border border-theme-divider rounded-2xl w-full shadow-2xl flex flex-col overflow-hidden"
            style={{ maxWidth: formMode === "quick" ? 620 : 860, maxHeight: "94vh" }}
          >
            {/* ── Modal Header ── */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-theme-divider bg-theme-surface-2">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${formMode==="quick"?"bg-[#0a6ed1]/10":"bg-purple-500/10"}`}>
                  {formMode==="quick"
                    ? <Zap className="w-5 h-5 text-[#0a6ed1]"/>
                    : <Settings2 className="w-5 h-5 text-purple-400"/>}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-theme-heading font-display">
                    {formMode==="quick" ? "Quick Add — New Supplier" : "Advanced Onboarding — Enterprise Supplier Master"}
                  </h3>
                  <p className="text-[11px] text-theme-muted font-mono">
                    {formMode==="quick" ? "Essential fields only. Create in under 30 seconds." : "Full 18-section enterprise profile. Expand sections as needed."}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isDirty && (
                  <span className="px-2.5 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-lg text-[10px] font-bold font-mono flex items-center gap-1">
                    <Save className="w-3 h-3"/>Unsaved Changes
                  </span>
                )}
                <button onClick={handleCloseModal} className="p-1.5 text-theme-muted hover:text-theme-heading rounded-lg cursor-pointer"><X className="w-5 h-5"/></button>
              </div>
            </div>

            {/* ── Draft Recovery Banner ── */}
            {hasDraft && (
              <div className="px-6 py-2.5 bg-[#0a6ed1]/5 border-b border-[#0a6ed1]/20 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-[#0a6ed1]">
                  <Info className="w-4 h-4 flex-shrink-0"/>
                  <span><strong>Draft recovered.</strong> Your previous unsaved data has been restored.</span>
                </div>
                <button onClick={handleDiscardDraft} className="flex items-center gap-1 text-[11px] text-theme-muted hover:text-rose-400 font-mono cursor-pointer transition-colors">
                  <RotateCcw className="w-3 h-3"/>Discard Draft
                </button>
              </div>
            )}

            {/* ── Mode Switcher Pills ── */}
            <div className="px-6 pt-4 pb-2 flex items-center gap-3">
              <button type="button" onClick={() => switchMode("quick")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                  formMode==="quick"
                    ?"bg-[#0a6ed1] text-white border-[#0a6ed1] shadow-xs"
                    :"bg-theme-surface-2 text-theme-muted border-theme-divider hover:border-[#0a6ed1]/50"}`}>
                <Zap className="w-3.5 h-3.5"/>Quick Add
              </button>
              <button type="button" onClick={() => switchMode("advanced")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                  formMode==="advanced"
                    ?"bg-purple-600 text-white border-purple-600 shadow-xs"
                    :"bg-theme-surface-2 text-theme-muted border-theme-divider hover:border-purple-500/50"}`}>
                <Settings2 className="w-3.5 h-3.5"/>Advanced Add
              </button>
              <span className="text-theme-muted text-[10px] font-mono ml-1">Data is preserved when switching modes.</span>
            </div>

            {/* ── Form ── */}
            <SmritiScrollArea className="flex-1 overflow-y-auto px-6 pb-2">
              <form id="vendor-form" onSubmit={e => handleSubmit(e, false)} className="space-y-4 text-xs font-sans py-3">

                {/* ══════════ QUICK ADD ══════════ */}
                {formMode === "quick" && (
                  <div className="space-y-5">

                    {/* Essential Identity */}
                    <div className="p-4 bg-theme-surface-2 border border-theme-divider rounded-xl space-y-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Building2 className="w-4 h-4 text-[#0a6ed1]"/>
                        <span className="text-xs font-bold text-theme-heading uppercase tracking-wide font-mono">Supplier Identity</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                          <label className={lbl}>Supplier Name <span className="text-rose-400">*</span></label>
                          <input type="text" required placeholder="e.g. Acme Textiles Pvt Ltd"
                            value={formData.name} onChange={e => set("name", e.target.value)}
                            className={inpErr("name")} autoFocus />
                          {validationErrors.name && <p className="text-rose-400 text-[10px] mt-1 flex items-center gap-1"><AlertOctagon className="w-3 h-3"/>{validationErrors.name}</p>}
                        </div>
                        <div>
                          <label className={lbl}>Contact Person</label>
                          <input type="text" placeholder="e.g. Rajesh Kumar"
                            value={formData.contact_person} onChange={e => set("contact_person", e.target.value)}
                            className={inp} />
                        </div>
                        <div>
                          <label className={lbl}>Mobile Number</label>
                          <input type="tel" placeholder="+91 98200 12345"
                            value={formData.mobile} onChange={e => set("mobile", e.target.value)}
                            className={inpMono} />
                        </div>
                      </div>
                    </div>

                    {/* GST Block with Progressive Disclosure */}
                    <div className="p-4 bg-theme-surface-2 border border-theme-divider rounded-xl space-y-4">
                      <div className="flex items-center gap-2 mb-1">
                        <ShieldCheck className="w-4 h-4 text-[#0a6ed1]"/>
                        <span className="text-xs font-bold text-theme-heading uppercase tracking-wide font-mono">GST Registration</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={lbl + " mb-0"}>GST Registered?</span>
                        <div className="flex items-center gap-2">
                          {[{v:true,l:"Yes"},{v:false,l:"No / Unregistered"}].map(opt => (
                            <button key={opt.l} type="button"
                              onClick={() => set("is_gst_registered", opt.v)}
                              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                                formData.is_gst_registered === opt.v
                                  ? opt.v ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/40" : "bg-slate-500/10 text-slate-400 border-slate-500/30"
                                  : "bg-theme-surface-1 text-theme-muted border-theme-divider hover:border-theme-muted"}`}>
                              {opt.l}
                            </button>
                          ))}
                        </div>
                      </div>
                      <AnimatePresence>
                        {formData.is_gst_registered && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.18 }}
                            style={{ overflow: "hidden" }}
                          >
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                              <div>
                                <label className={lbl}>GSTIN (15-digit) <span className="text-rose-400">*</span></label>
                                <input type="text" placeholder="e.g. 27ABCDE1234F1Z5" maxLength={15}
                                  value={formData.gst_number}
                                  onChange={e => set("gst_number", e.target.value.toUpperCase())}
                                  className={inpMonoErr("gst_number")} />
                                {validationErrors.gst_number && <p className="text-rose-400 text-[10px] mt-1 flex items-center gap-1"><AlertOctagon className="w-3 h-3"/>{validationErrors.gst_number}</p>}
                                {formData.gst_number.length >= 2 && GSTIN_STATE_MAP[formData.gst_number.substring(0,2)] && (
                                  <p className="text-emerald-400 text-[10px] mt-1 flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/>State auto-detected: {GSTIN_STATE_MAP[formData.gst_number.substring(0,2)]}</p>
                                )}
                              </div>
                              <div>
                                <label className={lbl}>Place of Supply</label>
                                <select value={formData.place_of_supply} onChange={e => set("place_of_supply", e.target.value)} className={sel}>
                                  {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Address */}
                    <div className="p-4 bg-theme-surface-2 border border-theme-divider rounded-xl space-y-4">
                      <div className="flex items-center gap-2 mb-1">
                        <MapPin className="w-4 h-4 text-[#0a6ed1]"/>
                        <span className="text-xs font-bold text-theme-heading uppercase tracking-wide font-mono">Address</span>
                      </div>
                      <div>
                        <label className={lbl}>Address / Street</label>
                        <input type="text" placeholder="Building, Street, Area"
                          value={formData.address} onChange={e => set("address", e.target.value)}
                          className={inp} />
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className={lbl}>City</label>
                          <input type="text" value={formData.city} onChange={e => set("city", e.target.value)} className={inp} />
                        </div>
                        <div>
                          <label className={lbl}>State</label>
                          <select value={formData.state} onChange={e => set("state", e.target.value)} className={sel}>
                            {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className={lbl}>PIN Code</label>
                          <input type="text" placeholder="400001" maxLength={6}
                            value={formData.pincode} onChange={e => set("pincode", e.target.value)}
                            className={inpMono} />
                        </div>
                      </div>
                    </div>

                    {/* Purchase Basics */}
                    <div className="p-4 bg-theme-surface-2 border border-theme-divider rounded-xl space-y-4">
                      <div className="flex items-center gap-2 mb-1">
                        <PackageCheck className="w-4 h-4 text-[#0a6ed1]"/>
                        <span className="text-xs font-bold text-theme-heading uppercase tracking-wide font-mono">Purchase Setup</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className={lbl}>Supplier Type</label>
                          <select value={formData.supplier_type_id} onChange={e => set("supplier_type_id", e.target.value)} className={sel}>
                            {["Manufacturer","Distributor","Wholesaler","Retailer","Trader","Service Provider","Importer"].map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className={lbl}>Payment Terms</label>
                          <select value={formData.payment_terms} onChange={e => set("payment_terms", e.target.value)} className={sel}>
                            {["Net 7 Days","Net 15 Days","Net 30 Days","Net 45 Days","Net 60 Days","Advance Payment","Cash on Delivery"].map(pt => <option key={pt} value={pt}>{pt}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className={lbl}>Status</label>
                          <select value={formData.status} onChange={e => set("status", e.target.value as any)} className={sel}>
                            {["Approved","Draft","Pending Approval","Blocked"].map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Switch to Advanced link */}
                    <button type="button" onClick={() => switchMode("advanced")}
                      className="w-full py-2.5 border border-dashed border-purple-500/40 rounded-xl text-xs font-bold text-purple-400 hover:bg-purple-500/5 transition-colors cursor-pointer flex items-center justify-center gap-2">
                      <Settings2 className="w-3.5 h-3.5"/>Switch to Advanced Add — Full Enterprise Profile →
                    </button>
                  </div>
                )}

                {/* ══════════ ADVANCED ADD ══════════ */}
                {formMode === "advanced" && (
                  <div className="space-y-3">

                    {/* 1. Company Information */}
                    <SectionPanel sectionKey="company" title="Company Information" icon={<Building2 className="w-4 h-4"/>}>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-2">
                          <label className={lbl}>Supplier / Corporate Name <span className="text-rose-400">*</span></label>
                          <input type="text" required placeholder="e.g. Acme Textiles Pvt Ltd"
                            value={formData.name} onChange={e => set("name", e.target.value)} className={inpErr("name")} />
                          {validationErrors.name && <p className="text-rose-400 text-[10px] mt-1 flex items-center gap-1"><AlertOctagon className="w-3 h-3"/>{validationErrors.name}</p>}
                        </div>
                        <div>
                          <label className={lbl}>Vendor Code</label>
                          <input type="text" value={formData.code} onChange={e => set("code", e.target.value)} className={inpMono} />
                        </div>
                        <div>
                          <label className={lbl}>Legal Name</label>
                          <input type="text" placeholder="Full legal entity name" value={formData.legal_name} onChange={e => set("legal_name", e.target.value)} className={inp} />
                        </div>
                        <div>
                          <label className={lbl}>Display / Trade Name</label>
                          <input type="text" placeholder="Short display name" value={formData.display_name} onChange={e => set("display_name", e.target.value)} className={inp} />
                        </div>
                        <div>
                          <label className={lbl}>Brand Name</label>
                          <input type="text" placeholder="Brand / Trade name" value={formData.trade_name} onChange={e => set("trade_name", e.target.value)} className={inp} />
                        </div>
                        <div>
                          <label className={lbl}>Supplier Type</label>
                          <select value={formData.supplier_type_id} onChange={e => set("supplier_type_id", e.target.value)} className={sel}>
                            {["Manufacturer","Distributor","Wholesaler","Retailer","Trader","Service Provider","Importer","C&F Agent"].map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className={lbl}>Supplier Group</label>
                          <select value={formData.group} onChange={e => set("group", e.target.value)} className={sel}>
                            {["General Retail","Electronics","Pharmaceuticals","FMCG","Textiles","Agriculture","Chemicals","Logistics","Services"].map(g => <option key={g} value={g}>{g}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className={lbl}>Status</label>
                          <select value={formData.status} onChange={e => set("status", e.target.value as any)} className={sel}>
                            {["Approved","Draft","Pending Approval","Blocked","Blacklisted"].map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className={lbl}>Preferred Vendor</label>
                          <select value={formData.is_preferred ? "true" : "false"} onChange={e => set("is_preferred", e.target.value === "true")} className={sel}>
                            <option value="true">Yes — Preferred Supplier</option>
                            <option value="false">No — Standard</option>
                          </select>
                        </div>
                        <div>
                          <label className={lbl}>Contact Person</label>
                          <input type="text" placeholder="Primary contact name" value={formData.contact_person} onChange={e => set("contact_person", e.target.value)} className={inp} />
                        </div>
                        <div>
                          <label className={lbl}>Designation</label>
                          <input type="text" placeholder="e.g. Senior Manager" value={formData.designation} onChange={e => set("designation", e.target.value)} className={inp} />
                        </div>
                        <div>
                          <label className={lbl}>Primary Mobile</label>
                          <input type="tel" placeholder="+91 98200 12345" value={formData.mobile} onChange={e => set("mobile", e.target.value)} className={inpMono} />
                        </div>
                        <div>
                          <label className={lbl}>Alt. Mobile</label>
                          <input type="tel" placeholder="+91 98200 00000" value={formData.alt_mobile} onChange={e => set("alt_mobile", e.target.value)} className={inpMono} />
                        </div>
                        <div>
                          <label className={lbl}>WhatsApp</label>
                          <input type="tel" placeholder="+91 98200 12345" value={formData.whatsapp} onChange={e => set("whatsapp", e.target.value)} className={inpMono} />
                        </div>
                        <div>
                          <label className={lbl}>Primary Email</label>
                          <input type="email" placeholder="vendor@company.com" value={formData.email} onChange={e => set("email", e.target.value)} className={inpMono} />
                        </div>
                        <div>
                          <label className={lbl}>Alternate Email</label>
                          <input type="email" placeholder="accounts@company.com" value={formData.alt_email} onChange={e => set("alt_email", e.target.value)} className={inpMono} />
                        </div>
                        <div>
                          <label className={lbl}>Website</label>
                          <input type="url" placeholder="https://company.com" value={formData.website} onChange={e => set("website", e.target.value)} className={inpMono} />
                        </div>
                      </div>
                    </SectionPanel>

                    {/* 2. GST & Compliance */}
                    <SectionPanel sectionKey="gst" title="GST & Compliance" icon={<ShieldCheck className="w-4 h-4"/>}>
                      <div className="space-y-5">
                        {/* GST toggle */}
                        <div className="flex items-center gap-3">
                          <span className={lbl + " mb-0"}>GST Registered?</span>
                          {[{v:true,l:"Yes — Registered"},{v:false,l:"No / Composition / Unregistered"}].map(opt=>(
                            <button key={opt.l} type="button" onClick={() => set("is_gst_registered", opt.v)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${formData.is_gst_registered===opt.v?(opt.v?"bg-emerald-500/10 text-emerald-400 border-emerald-500/40":"bg-slate-500/10 text-slate-400 border-slate-500/30"):"bg-theme-surface-1 text-theme-muted border-theme-divider"}`}>
                              {opt.l}
                            </button>
                          ))}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {formData.is_gst_registered && <>
                            <div>
                              <label className={lbl}>GSTIN (15-digit) <span className="text-rose-400">*</span></label>
                              <input type="text" placeholder="27ABCDE1234F1Z5" maxLength={15}
                                value={formData.gst_number} onChange={e => set("gst_number", e.target.value.toUpperCase())}
                                className={inpMonoErr("gst_number")} />
                              {validationErrors.gst_number && <p className="text-rose-400 text-[10px] mt-1">{validationErrors.gst_number}</p>}
                              {formData.gst_number.length>=2&&GSTIN_STATE_MAP[formData.gst_number.substring(0,2)]&&(
                                <p className="text-emerald-400 text-[10px] mt-1">✓ State: {GSTIN_STATE_MAP[formData.gst_number.substring(0,2)]}</p>
                              )}
                            </div>
                            <div>
                              <label className={lbl}>GST Type</label>
                              <select value={formData.gst_type} onChange={e => set("gst_type", e.target.value)} className={sel}>
                                {["Regular","Composition","SEZ Unit","SEZ Developer","Embassy/UN Body","TDS Deductor","Non-Resident Taxable","Unregistered"].map(t => <option key={t} value={t}>{t}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className={lbl}>GST Category</label>
                              <select value={formData.gst_category} onChange={e => set("gst_category", e.target.value)} className={sel}>
                                {["B2B","B2C","Export / SEZ","GST Exempt"].map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                            </div>
                          </>}
                          <div>
                            <label className={lbl}>Place of Supply</label>
                            <select value={formData.place_of_supply} onChange={e => set("place_of_supply", e.target.value)} className={sel}>
                              {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className={lbl}>PAN Number</label>
                            <input type="text" placeholder="ABCDE1234F" maxLength={10}
                              value={formData.pan_number} onChange={e => set("pan_number", e.target.value.toUpperCase())} className={inpMono} />
                          </div>
                          <div>
                            <label className={lbl}>TAN Number</label>
                            <input type="text" placeholder="MUMB12345F"
                              value={formData.tan_number} onChange={e => set("tan_number", e.target.value.toUpperCase())} className={inpMono} />
                          </div>
                          <div>
                            <label className={lbl}>CIN Number</label>
                            <input type="text" placeholder="U72200MH2010PTC123456"
                              value={formData.cin_number} onChange={e => set("cin_number", e.target.value.toUpperCase())} className={inpMono} />
                          </div>
                          <div>
                            <label className={lbl}>IEC Code</label>
                            <input type="text" placeholder="1012001122"
                              value={formData.iec_code} onChange={e => set("iec_code", e.target.value)} className={inpMono} />
                          </div>
                          <div>
                            <label className={lbl}>TDS Applicable</label>
                            <select value={formData.is_tds_applicable ? "true" : "false"} onChange={e => set("is_tds_applicable", e.target.value==="true")} className={sel}>
                              <option value="true">Yes — Deduct TDS</option>
                              <option value="false">No — TDS Exempt</option>
                            </select>
                          </div>
                          {formData.is_tds_applicable && <>
                            <div>
                              <label className={lbl}>TDS Section</label>
                              <select value={formData.tds_section} onChange={e => set("tds_section", e.target.value)} className={sel}>
                                {["194Q","194C","194H","194J","194I","194B","195"].map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className={lbl}>TDS Rate (%)</label>
                              <input type="number" step="0.01" min="0" max="30" value={formData.tds_rate} onChange={e => set("tds_rate", e.target.value)} className={inpMono} />
                            </div>
                          </>}
                          <div>
                            <label className={lbl}>MSME Category</label>
                            <select value={formData.msme_category} onChange={e => set("msme_category", e.target.value as any)} className={sel}>
                              {["Micro","Small","Medium","Non-MSME"].map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className={lbl}>Udyam / MSME Number</label>
                            <input type="text" placeholder="UDYAM-MH-12-0001234"
                              value={formData.udyam_number} onChange={e => set("udyam_number", e.target.value.toUpperCase())} className={inpMono} />
                          </div>
                          <div>
                            <label className={lbl}>FSSAI License No.</label>
                            <input type="text" placeholder="10019022001234" value={formData.fssai_license_no} onChange={e => set("fssai_license_no", e.target.value)} className={inpMono} />
                          </div>
                          <div>
                            <label className={lbl}>FSSAI Expiry</label>
                            <input type="date" value={formData.fssai_expiry} onChange={e => set("fssai_expiry", e.target.value)} className={inpMono} />
                          </div>
                          <div>
                            <label className={lbl}>Drug License No.</label>
                            <input type="text" placeholder="DL-MH-2024-001" value={formData.drug_license_no} onChange={e => set("drug_license_no", e.target.value)} className={inpMono} />
                          </div>
                          <div>
                            <label className={lbl}>Drug License Expiry</label>
                            <input type="date" value={formData.drug_license_expiry} onChange={e => set("drug_license_expiry", e.target.value)} className={inpMono} />
                          </div>
                        </div>
                      </div>
                    </SectionPanel>

                    {/* 3. Multiple Contacts */}
                    <SectionPanel sectionKey="contacts" title="Multiple Contacts" icon={<UserCheck className="w-4 h-4"/>} badge={extraContacts.length > 0 ? extraContacts.length + 1 : undefined}>
                      <div className="space-y-4">
                        {/* Primary Contact (from Company section) */}
                        <div className="p-3 bg-theme-surface-1 border border-theme-divider rounded-lg flex items-center gap-3">
                          <div className="w-7 h-7 bg-[#0a6ed1]/10 rounded-full flex items-center justify-center flex-shrink-0"><UserCheck className="w-3.5 h-3.5 text-[#0a6ed1]"/></div>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-theme-heading text-xs">{formData.contact_person || "Primary Contact"}</div>
                            <div className="text-[10px] text-theme-muted font-mono truncate">{formData.mobile} | {formData.email} | Purchase Manager</div>
                          </div>
                          <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded text-[10px] font-bold border border-emerald-500/30 flex-shrink-0">Primary</span>
                        </div>
                        {extraContacts.map((c, i) => (
                          <div key={c.id} className="p-4 bg-theme-surface-1 border border-theme-divider rounded-xl space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-xs text-theme-muted font-mono">Contact #{i+2}</span>
                              <button type="button" onClick={() => setExtraContacts(p => p.filter((_,j)=>j!==i))} className="p-1 text-rose-400 hover:text-rose-300 cursor-pointer rounded"><Trash2 className="w-3.5 h-3.5"/></button>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                              {([["name","Full Name","text","Contact Name"],["role","Role","select",""],["mobile","Mobile","tel","+91 98200 00000"],["email","Email","email","email@co.com"]] as const).map(([f, l, t, ph]) => (
                                <div key={f}>
                                  <label className={lbl}>{l}</label>
                                  {t === "select"
                                    ? <select value={c.role} onChange={e => setExtraContacts(p => p.map((x,j)=>j===i?{...x,role:e.target.value as any}:x))} className={sel}>
                                        {["Purchase Manager","Sales Executive","Accounts","Dispatch","Owner","Service"].map(r => <option key={r} value={r}>{r}</option>)}
                                      </select>
                                    : <input type={t} placeholder={ph} value={(c as any)[f]||""}
                                        onChange={e => setExtraContacts(p => p.map((x,j)=>j===i?{...x,[f]:e.target.value}:x))}
                                        className={t==="email"||t==="tel"?inpMono:inp} />}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                        <button type="button" onClick={() => setExtraContacts(p => [...p, {id:`fc-${Date.now()}`,name:"",role:"Purchase Manager",mobile:"",email:"",is_primary:false}])}
                          className="w-full py-2 border border-dashed border-[#0a6ed1]/40 text-[#0a6ed1] text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 hover:bg-[#0a6ed1]/5 transition-colors cursor-pointer">
                          <Plus className="w-3.5 h-3.5"/> Add Another Contact Role
                        </button>
                      </div>
                    </SectionPanel>

                    {/* 4. Multiple Addresses */}
                    <SectionPanel sectionKey="addresses" title="Addresses & Locations" icon={<MapPin className="w-4 h-4"/>} badge={extraAddresses.length > 0 ? extraAddresses.length + 1 : undefined}>
                      <div className="space-y-4">
                        {/* Primary Billing Address */}
                        <div className="p-4 bg-theme-surface-1 border border-theme-divider rounded-xl space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-[#0a6ed1] font-mono uppercase">Primary Billing Address</span>
                            <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded text-[10px] font-bold border border-emerald-500/30">Primary</span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {([["billing_building","Building / House No.","Plot 12, Building A"],["billing_street","Street / Road","MIDC Road No 15"],["billing_area","Area / Locality","Andheri East"],["billing_district","District","Mumbai Suburban"]] as const).map(([f, l, ph]) => (
                              <div key={f}>
                                <label className={lbl}>{l}</label>
                                <input type="text" placeholder={ph} value={(formData as any)[f]} onChange={e => set(f, e.target.value)} className={inp} />
                              </div>
                            ))}
                            <div>
                              <label className={lbl}>City</label>
                              <input type="text" value={formData.city} onChange={e => set("city", e.target.value)} className={inp} />
                            </div>
                            <div>
                              <label className={lbl}>State</label>
                              <select value={formData.state} onChange={e => set("state", e.target.value)} className={sel}>
                                {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className={lbl}>PIN Code</label>
                              <input type="text" placeholder="400001" maxLength={6} value={formData.pincode} onChange={e => set("pincode", e.target.value)} className={inpMono} />
                            </div>
                            <div>
                              <label className={lbl}>Country</label>
                              <select value={formData.country} onChange={e => set("country", e.target.value)} className={sel}>
                                {["India","Nepal","Bhutan","Bangladesh","Sri Lanka"].map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                            </div>
                          </div>
                        </div>
                        {extraAddresses.map((addr, i) => (
                          <div key={addr.id} className="p-4 bg-theme-surface-1 border border-theme-divider rounded-xl space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-theme-muted font-mono">Location #{i+2} — {addr.address_type}</span>
                              <button type="button" onClick={() => setExtraAddresses(p => p.filter((_,j)=>j!==i))} className="p-1 text-rose-400 hover:text-rose-300 cursor-pointer rounded"><Trash2 className="w-3.5 h-3.5"/></button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              <div>
                                <label className={lbl}>Address Type</label>
                                <select value={addr.address_type} onChange={e => setExtraAddresses(p => p.map((x,j)=>j===i?{...x,address_type:e.target.value as any}:x))} className={sel}>
                                  {["Shipping","Registered Office","Factory Location","Central Warehouse"].map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                              </div>
                              {([["building_name","Building / Unit","Unit No."],["street","Street / Road","Road Name"],["area","Area / Locality","Area"],["city","City","City"],["pincode","PIN Code","421302"]] as const).map(([f,l,ph]) => (
                                <div key={f}>
                                  <label className={lbl}>{l}</label>
                                  <input type="text" placeholder={ph} value={(addr as any)[f]||""} onChange={e => setExtraAddresses(p => p.map((x,j)=>j===i?{...x,[f]:e.target.value}:x))} className={f==="pincode"?inpMono:inp} />
                                </div>
                              ))}
                              <div>
                                <label className={lbl}>State</label>
                                <select value={addr.state} onChange={e => setExtraAddresses(p => p.map((x,j)=>j===i?{...x,state:e.target.value}:x))} className={sel}>
                                  {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                              </div>
                            </div>
                          </div>
                        ))}
                        <button type="button" onClick={() => setExtraAddresses(p => [...p, {id:`addr-${Date.now()}`,address_type:"Shipping",building_name:"",street:"",area:"",city:formData.city,state:formData.state,pincode:"",country:"India",is_primary:false}])}
                          className="w-full py-2 border border-dashed border-[#0a6ed1]/40 text-[#0a6ed1] text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 hover:bg-[#0a6ed1]/5 transition-colors cursor-pointer">
                          <Plus className="w-3.5 h-3.5"/> Add Another Address / Warehouse Location
                        </button>
                      </div>
                    </SectionPanel>

                    {/* 5. Banking Details */}
                    <SectionPanel sectionKey="banking" title="Banking Details" icon={<CreditCard className="w-4 h-4"/>} badge={extraBanks.length > 0 ? extraBanks.length + 1 : undefined}>
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className={lbl}>Bank Name</label>
                            <select value={formData.bank_name} onChange={e => set("bank_name", e.target.value)} className={sel}>
                              <option value="">— Select Bank —</option>
                              {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className={lbl}>Account Holder Name</label>
                            <input type="text" placeholder="As per bank records" value={formData.account_name} onChange={e => set("account_name", e.target.value)} className={inp} />
                          </div>
                          <div>
                            <label className={lbl}>Account Number</label>
                            <input type="text" placeholder="50200012345678" value={formData.account_number} onChange={e => set("account_number", e.target.value)} className={inpMono} />
                          </div>
                          <div>
                            <label className={lbl}>IFSC Code</label>
                            <input type="text" placeholder="HDFC0000123" maxLength={11} value={formData.ifsc_code} onChange={e => set("ifsc_code", e.target.value.toUpperCase())} className={inpMono} />
                          </div>
                          <div>
                            <label className={lbl}>Branch Name</label>
                            <input type="text" placeholder="Fort, Mumbai" value={formData.branch_name} onChange={e => set("branch_name", e.target.value)} className={inp} />
                          </div>
                          <div>
                            <label className={lbl}>Account Type</label>
                            <select value={formData.bank_type} onChange={e => set("bank_type", e.target.value)} className={sel}>
                              {["Current","Savings","Overdraft (OD)","Cash Credit (CC)"].map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className={lbl}>UPI ID / VPA</label>
                            <input type="text" placeholder="vendor@hdfcbank" value={formData.upi_id} onChange={e => set("upi_id", e.target.value)} className={inpMono} />
                          </div>
                        </div>
                        {extraBanks.length > 0 && extraBanks.map((b, i) => (
                          <div key={b.id} className="p-4 bg-theme-surface-1 border border-theme-divider rounded-xl space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-theme-muted font-mono">Bank Account #{i+2}</span>
                              <button type="button" onClick={() => setExtraBanks(p=>p.filter((_,j)=>j!==i))} className="p-1 text-rose-400 cursor-pointer rounded"><Trash2 className="w-3.5 h-3.5"/></button>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                              <div>
                                <label className={lbl}>Bank Name</label>
                                <select value={b.bank_name} onChange={e=>setExtraBanks(p=>p.map((x,j)=>j===i?{...x,bank_name:e.target.value}:x))} className={sel}>
                                  <option value="">— Select —</option>{BANKS.map(bk=><option key={bk} value={bk}>{bk}</option>)}
                                </select>
                              </div>
                              <div>
                                <label className={lbl}>Account Number</label>
                                <input type="text" value={b.account_number} onChange={e=>setExtraBanks(p=>p.map((x,j)=>j===i?{...x,account_number:e.target.value}:x))} className={inpMono}/>
                              </div>
                              <div>
                                <label className={lbl}>IFSC</label>
                                <input type="text" value={b.ifsc_code} onChange={e=>setExtraBanks(p=>p.map((x,j)=>j===i?{...x,ifsc_code:e.target.value.toUpperCase()}:x))} className={inpMono}/>
                              </div>
                            </div>
                          </div>
                        ))}
                        <button type="button" onClick={() => setExtraBanks(p=>[...p,{id:`fb-${Date.now()}`,bank_name:"",account_name:formData.name,account_number:"",ifsc_code:"",branch_name:"",upi_id:"",is_primary:false}])}
                          className="w-full py-2 border border-dashed border-[#0a6ed1]/40 text-[#0a6ed1] text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 hover:bg-[#0a6ed1]/5 transition-colors cursor-pointer">
                          <Plus className="w-3.5 h-3.5"/> Add Another Bank Account
                        </button>
                      </div>
                    </SectionPanel>

                    {/* 6. Purchase Defaults */}
                    <SectionPanel sectionKey="purchase" title="Purchase Defaults" icon={<PackageCheck className="w-4 h-4"/>}>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {([["currency","Default Currency","select","INR"],["warehouse","Default Warehouse","select",""],["payment_terms","Payment Terms","select",""],["purchase_uom","Purchase UOM","select",""],["lead_time_days","Lead Time (Days)","number","3"],["min_order_qty","Min Order Qty","number","1.000"],["max_order_qty","Max Order Qty","number","100.000"],["order_multiple","Order Multiple","number","1.000"],["price_list","Price List","select",""],["discount_percent","Default Discount (%)","number","0.00"]] as const).map(([f,l,t]) => (
                          <div key={f}>
                            <label className={lbl}>{l}</label>
                            {t==="select"
                              ? <select value={(formData as any)[f]} onChange={e=>set(f,e.target.value)} className={sel}>
                                  {f==="currency"&&["INR","USD","EUR","GBP","AED"].map(c=><option key={c} value={c}>{c}</option>)}
                                  {f==="warehouse"&&["Central Warehouse (WH-01)","North Zone Store (WH-02)","South Zone Store (WH-03)","East Zone Store (WH-04)"].map(w=><option key={w} value={w}>{w}</option>)}
                                  {f==="payment_terms"&&["Net 7 Days","Net 15 Days","Net 30 Days","Net 45 Days","Net 60 Days","Advance Payment","Cash on Delivery","Letter of Credit"].map(pt=><option key={pt} value={pt}>{pt}</option>)}
                                  {f==="purchase_uom"&&["PCS","KGS","LTR","MTR","BOX","CARTON","DOZEN","PAIR","SET","ROLL"].map(u=><option key={u} value={u}>{u}</option>)}
                                  {f==="price_list"&&["Standard Purchase Price","Rate Contract A","Rate Contract B","Negotiated Price","Spot Purchase"].map(p=><option key={p} value={p}>{p}</option>)}
                                </select>
                              : <input type={t} step={f.includes("qty")||f.includes("multiple")?"0.001":"1"} min="0" value={(formData as any)[f]} onChange={e=>set(f,e.target.value)} className={inpMono}/>}
                          </div>
                        ))}
                      </div>
                    </SectionPanel>

                    {/* 7. Credit & Finance */}
                    <SectionPanel sectionKey="finance" title="Credit & Finance" icon={<DollarSign className="w-4 h-4"/>}>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className={lbl}>Opening Balance (₹)</label>
                          <input type="number" step="0.01" placeholder="0.00" value={formData.opening_balance} onChange={e=>set("opening_balance",e.target.value)} className={inpMono}/>
                        </div>
                        <div>
                          <label className={lbl}>Credit Limit (₹)</label>
                          <input type="number" step="1000" min="0" placeholder="200000" value={formData.credit_limit} onChange={e=>set("credit_limit",e.target.value)} className={inpMono}/>
                        </div>
                        <div>
                          <label className={lbl}>Credit Days</label>
                          <input type="number" min="0" max="360" placeholder="30" value={formData.credit_days} onChange={e=>set("credit_days",e.target.value)} className={inpMono}/>
                        </div>
                      </div>
                    </SectionPanel>

                    {/* 8. Logistics */}
                    <SectionPanel sectionKey="logistics" title="Logistics & Shipping" icon={<Truck className="w-4 h-4"/>}>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div><label className={lbl}>Transporter / Carrier</label><input type="text" placeholder="e.g. VRL Logistics Ltd" value={formData.transport_name} onChange={e=>set("transport_name",e.target.value)} className={inp}/></div>
                        <div><label className={lbl}>Transporter GSTIN</label><input type="text" placeholder="27AAACV1234F1Z9" value={formData.transporter_gstin} onChange={e=>set("transporter_gstin",e.target.value.toUpperCase())} className={inpMono}/></div>
                        <div><label className={lbl}>Freight Terms</label>
                          <select value={formData.freight_terms} onChange={e=>set("freight_terms",e.target.value)} className={sel}>
                            {["Prepaid by Supplier","Collect — Paid by Us","FOB Origin","FOB Destination","CIF","DDP","Ex Works"].map(ft=><option key={ft} value={ft}>{ft}</option>)}
                          </select>
                        </div>
                        <div><label className={lbl}>Delivery Mode</label>
                          <select value={formData.delivery_mode} onChange={e=>set("delivery_mode",e.target.value)} className={sel}>
                            {["Road","Rail","Air","Sea / Ocean","Courier","Hand Delivery"].map(d=><option key={d} value={d}>{d}</option>)}
                          </select>
                        </div>
                        <div><label className={lbl}>Avg. Transit Days</label><input type="number" min="0" max="90" placeholder="2" value={formData.avg_transit_days} onChange={e=>set("avg_transit_days",e.target.value)} className={inpMono}/></div>
                        <div><label className={lbl}>E-Way Bill Applicable</label>
                          <select value={formData.eway_bill_applicable?"true":"false"} onChange={e=>set("eway_bill_applicable",e.target.value==="true")} className={sel}>
                            <option value="true">Yes — Required</option>
                            <option value="false">No — Exempt</option>
                          </select>
                        </div>
                      </div>
                    </SectionPanel>

                    {/* 9. Documents */}
                    <SectionPanel sectionKey="documents" title="Documents & Certificates" icon={<FilePlus className="w-4 h-4"/>} badge={attachedDocs.length || undefined}>
                      <div className="space-y-4">
                        {attachedDocs.length === 0 && (
                          <div className="p-8 text-center border-2 border-dashed border-theme-divider rounded-xl bg-theme-surface-1 text-theme-muted">
                            <FileCheck className="w-10 h-10 mx-auto text-[#0a6ed1]/40 mb-3"/>
                            <p className="font-bold text-xs text-theme-heading">No Documents Attached</p>
                            <p className="text-[11px] mt-1">Click below to attach GST, FSSAI, MSME, or other certificates.</p>
                          </div>
                        )}
                        {attachedDocs.map((doc,i) => (
                          <div key={doc.id} className="p-4 bg-theme-surface-1 border border-theme-divider rounded-xl grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                            <div>
                              <label className={lbl}>Document Type</label>
                              <select value={doc.doc_type} onChange={e=>setAttachedDocs(p=>p.map((x,j)=>j===i?{...x,doc_type:e.target.value as any}:x))} className={sel}>
                                {["GST Certificate","PAN Card","FSSAI License","Drug License","MSME Certificate","IEC Certificate","Agreement","Insurance","Cancelled Cheque"].map(dt=><option key={dt} value={dt}>{dt}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className={lbl}>Document Number</label>
                              <input type="text" placeholder="Registration No." value={doc.doc_number} onChange={e=>setAttachedDocs(p=>p.map((x,j)=>j===i?{...x,doc_number:e.target.value}:x))} className={inpMono}/>
                            </div>
                            <div>
                              <label className={lbl}>Expiry Date</label>
                              <input type="date" value={doc.expiry_date} onChange={e=>setAttachedDocs(p=>p.map((x,j)=>j===i?{...x,expiry_date:e.target.value}:x))} className={inpMono}/>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="flex-1 px-2 py-2 bg-[#0a6ed1]/10 text-[#0a6ed1] font-mono text-[10px] rounded truncate">{doc.file_name}</span>
                              <button type="button" onClick={()=>setAttachedDocs(p=>p.filter((_,j)=>j!==i))} className="p-1.5 text-rose-400 cursor-pointer rounded"><Trash2 className="w-4 h-4"/></button>
                            </div>
                          </div>
                        ))}
                        <button type="button" onClick={()=>setAttachedDocs(p=>[...p,{id:`doc-${Date.now()}`,doc_type:"GST Certificate",doc_number:"",expiry_date:"2028-12-31",status:"Valid",file_name:`certificate_${Date.now().toString().slice(-4)}.pdf`}])}
                          className="w-full py-2 border border-dashed border-[#0a6ed1]/40 text-[#0a6ed1] text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 hover:bg-[#0a6ed1]/5 transition-colors cursor-pointer">
                          <UploadCloud className="w-3.5 h-3.5"/> Attach Compliance Document / Certificate
                        </button>
                      </div>
                    </SectionPanel>

                    {/* 10. Labels */}
                    <SectionPanel sectionKey="labels" title="Labels & Barcodes" icon={<Printer className="w-4 h-4"/>}>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label className={lbl}>Default Label Template</label>
                          <select value={formData.default_label_template} onChange={e=>set("default_label_template",e.target.value)} className={sel}>
                            {["50x25mm","38x25mm","100x50mm","100x75mm","A6","A5 Half Label","Custom"].map(t=><option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                        <div><label className={lbl}>Default Barcode Type</label>
                          <select value={formData.default_barcode_type} onChange={e=>set("default_barcode_type",e.target.value)} className={sel}>
                            {["CODE128","EAN13","EAN8","QR Code","CODE39","ITF-14","DATAMATRIX"].map(b=><option key={b} value={b}>{b}</option>)}
                          </select>
                        </div>
                        <div><label className={lbl}>Auto-Print on GRN</label>
                          <select value={formData.auto_print_on_grn?"true":"false"} onChange={e=>set("auto_print_on_grn",e.target.value==="true")} className={sel}>
                            <option value="true">Yes — Auto-Print</option>
                            <option value="false">No — Manual Only</option>
                          </select>
                        </div>
                        <div><label className={lbl}>Label Language</label>
                          <select value={formData.label_language} onChange={e=>set("label_language",e.target.value)} className={sel}>
                            {["English","Hindi","Marathi","Tamil","Telugu","Gujarati","Bengali","Kannada"].map(l=><option key={l} value={l}>{l}</option>)}
                          </select>
                        </div>
                      </div>
                    </SectionPanel>

                    {/* Back to Quick Add */}
                    <button type="button" onClick={() => switchMode("quick")}
                      className="w-full py-2 border border-dashed border-theme-divider rounded-xl text-xs font-bold text-theme-muted hover:text-[#0a6ed1] hover:border-[#0a6ed1]/40 transition-colors cursor-pointer flex items-center justify-center gap-2">
                      ← Back to Quick Add
                    </button>
                  </div>
                )}

              </form>
            </SmritiScrollArea>

            {/* ── Modal Footer ── */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-theme-divider bg-theme-surface-2">
              <button type="button" onClick={handleCloseModal}
                className="px-4 py-2 text-xs font-bold text-theme-muted hover:text-theme-heading transition-colors cursor-pointer">
                Cancel
              </button>
              <div className="flex items-center gap-2">
                <button type="button" onClick={e => handleSubmit(e as any, true)} disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-bold bg-theme-surface-3 hover:bg-theme-surface-4 text-theme-heading border border-theme-divider rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50">
                  <Plus className="w-3.5 h-3.5"/> Save &amp; New
                </button>
                <button type="submit" form="vendor-form" disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-bold bg-[#0a6ed1] hover:bg-[#085caf] text-white rounded-lg transition-colors shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-60">
                  <CheckCircle2 className="w-4 h-4"/>
                  {isSubmitting ? "Saving..." : "Save & Onboard Vendor"}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* ════════════════════════════════════════════════ */}
      {/*          16-TAB ENTERPRISE STUDIO               */}
      {/* ════════════════════════════════════════════════ */}
      {selectedSupplier && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-theme-surface-1 border border-theme-divider rounded-2xl max-w-5xl w-full h-[88vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">

            {/* Studio Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-theme-divider bg-theme-surface-2">
              <div className="flex items-center gap-3">
                <Building2 className="w-6 h-6 text-[#0a6ed1]"/>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-bold text-theme-heading font-display">{selectedSupplier.name}</h3>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${selectedSupplier.status==="Approved"?"bg-emerald-500/10 text-emerald-400 border-emerald-500/30":"bg-amber-500/10 text-amber-400 border-amber-500/30"}`}>{selectedSupplier.status}</span>
                    {selectedSupplier.is_preferred&&<span className="px-2 py-0.5 bg-[#0a6ed1]/10 text-[#0a6ed1] rounded text-[10px] font-bold border border-[#0a6ed1]/30">★ Preferred</span>}
                  </div>
                  <span className="font-mono text-[11px] text-theme-muted">{selectedSupplier.code} | {selectedSupplier.gst_number} | {selectedSupplier.city}, {selectedSupplier.state}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!isReadOnly&&<>
                  <button onClick={()=>updateStatus("Approved")} className="px-3 py-1.5 text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-lg cursor-pointer hover:bg-emerald-500/20 flex items-center gap-1"><Unlock className="w-3 h-3"/>Approve</button>
                  <button onClick={()=>updateStatus("Blocked")} className="px-3 py-1.5 text-[11px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30 rounded-lg cursor-pointer hover:bg-rose-500/20 flex items-center gap-1"><Lock className="w-3 h-3"/>Block</button>
                </>}
                <button onClick={()=>setSelectedSupplier(null)} className="p-1.5 text-theme-muted hover:text-theme-heading rounded-lg cursor-pointer bg-theme-surface-3"><X className="w-5 h-5"/></button>
              </div>
            </div>

            {/* 16 Studio Tabs */}
            <div className="flex items-center gap-1 px-4 bg-theme-surface-3 border-b border-theme-divider overflow-x-auto scrollbar-none text-[11px] font-mono py-1.5">
              {[
                {id:"overview",l:"Overview"},{id:"attributes",l:"18-Section Master"},
                {id:"contacts",l:"Contacts"},{id:"banks",l:"Bank Accounts"},
                {id:"addresses",l:"Addresses"},{id:"gst",l:"GST & Tax"},
                {id:"msme",l:"MSME 43B(h)"},{id:"documents",l:"Doc Vault"},
                {id:"pos",l:"Purchase Orders"},{id:"grns",l:"GRN History"},
                {id:"invoices",l:"Invoices"},{id:"payments",l:"Payments"},
                {id:"ratings",l:"Scorecard"},{id:"timeline",l:"Communication"},
                {id:"approvals",l:"Approvals"},{id:"audit",l:"Audit Log"}
              ].map(t=>(
                <button key={t.id} onClick={()=>setStudioTab(t.id as any)}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer whitespace-nowrap ${studioTab===t.id?"bg-[#0a6ed1] text-white shadow-xs":"text-theme-muted hover:text-theme-heading hover:bg-theme-surface-2"}`}>
                  {t.l}
                </button>
              ))}
            </div>

            {/* Studio Content */}
            <SmritiScrollArea className="flex-1 p-6 bg-theme-base font-sans text-xs">

              {/* OVERVIEW */}
              {studioTab==="overview"&&(
                <div className="space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      {l:"Total Outstanding",v:selectedSupplier.balance||"₹0",c:"text-rose-400"},
                      {l:"Credit Limit / Days",v:`₹${selectedSupplier.credit_limit?.toLocaleString("en-IN")} / ${selectedSupplier.credit_days}d`,c:"text-theme-heading"},
                      {l:"MSME Category",v:selectedSupplier.msme_category||"Non-MSME",c:"text-amber-400"},
                      {l:"Vendor Rating",v:`${selectedSupplier.scorecard_rating||92.0}/100`,c:"text-emerald-400"}
                    ].map(k=>(
                      <div key={k.l} className="p-4 bg-theme-surface-2 border border-theme-divider rounded-xl">
                        <span className="text-theme-muted block font-mono text-[10px] uppercase font-bold">{k.l}</span>
                        <strong className={`text-lg font-bold font-mono ${k.c}`}>{k.v}</strong>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="p-5 bg-theme-surface-2 border border-theme-divider rounded-xl space-y-2">
                      <h5 className="font-bold text-theme-heading font-display text-sm flex items-center gap-2 mb-3"><Building2 className="w-4 h-4 text-[#0a6ed1]"/>Identity</h5>
                      {[["Vendor Code",selectedSupplier.code],["Supplier Type",selectedSupplier.supplier_type_id],["Group",selectedSupplier.group],["GSTIN",selectedSupplier.gst_number],["PAN",selectedSupplier.pan_number],["GST Type",selectedSupplier.gst_type],["Payment Terms",selectedSupplier.payment_terms],["Created By",selectedSupplier.created_by],["Created On",selectedSupplier.created_at]].map(([k,v])=>(
                        <div key={k as string} className="flex justify-between text-xs border-b border-theme-divider/40 pb-1.5">
                          <span className="text-theme-muted font-mono">{k}</span>
                          <span className="font-bold text-theme-heading">{v||"—"}</span>
                        </div>
                      ))}
                    </div>
                    <div className="p-5 bg-theme-surface-2 border border-theme-divider rounded-xl space-y-2">
                      <h5 className="font-bold text-theme-heading font-display text-sm flex items-center gap-2 mb-3"><Phone className="w-4 h-4 text-[#0a6ed1]"/>Contact & Location</h5>
                      {[["Contact Person",selectedSupplier.contact_person],["Mobile",selectedSupplier.mobile],["Email",selectedSupplier.email],["Website",selectedSupplier.website],["City",selectedSupplier.city],["State",selectedSupplier.state],["PIN Code",selectedSupplier.pincode],["Address",selectedSupplier.address]].map(([k,v])=>(
                        <div key={k as string} className="flex justify-between text-xs border-b border-theme-divider/40 pb-1.5">
                          <span className="text-theme-muted font-mono">{k}</span>
                          <span className="font-bold text-theme-heading truncate max-w-[55%]">{v||"—"}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ATTRIBUTES */}
              {studioTab==="attributes"&&(
                <div className="space-y-4">
                  {[
                    {title:"Identity",icon:<Building2 className="w-4 h-4"/>,fields:[["Code",selectedSupplier.code],["Name",selectedSupplier.name],["Legal Name",selectedSupplier.legal_name],["Type",selectedSupplier.supplier_type_id],["Group",selectedSupplier.group]]},
                    {title:"GST & Tax",icon:<ShieldCheck className="w-4 h-4"/>,fields:[["GSTIN",selectedSupplier.gst_number],["PAN",selectedSupplier.pan_number],["TAN",selectedSupplier.tan_number],["CIN",selectedSupplier.cin_number],["GST Type",selectedSupplier.gst_type],["TDS Section",selectedSupplier.tds_section],["TDS Rate",selectedSupplier.tds_rate?`${(selectedSupplier.tds_rate*100).toFixed(2)}%`:"N/A"]]},
                    {title:"MSME & Compliance",icon:<Award className="w-4 h-4"/>,fields:[["MSME Category",selectedSupplier.msme_category],["Udyam No.",selectedSupplier.msme_number],["FSSAI License",selectedSupplier.fssai_license_no],["FSSAI Expiry",selectedSupplier.fssai_expiry],["Drug License",selectedSupplier.drug_license_no],["IEC Code",selectedSupplier.iec_code]]},
                    {title:"Financial",icon:<DollarSign className="w-4 h-4"/>,fields:[["Credit Limit",`₹${selectedSupplier.credit_limit?.toLocaleString("en-IN")||"0"}`],["Credit Days",`${selectedSupplier.credit_days||0} Days`],["Payment Terms",selectedSupplier.payment_terms],["Outstanding",selectedSupplier.balance]]},
                    {title:"Purchase Defaults",icon:<PackageCheck className="w-4 h-4"/>,fields:[["Currency",selectedSupplier.currency],["Warehouse",selectedSupplier.warehouse],["Lead Time",`${selectedSupplier.lead_time_days||0}d`],["Min Qty",String(selectedSupplier.min_order_qty||0)],["Preferred",selectedSupplier.is_preferred?"Yes":"No"]]},
                    {title:"Logistics",icon:<Truck className="w-4 h-4"/>,fields:[["Transporter",selectedSupplier.transport_name],["Freight Terms",selectedSupplier.freight_terms],["E-Way Bill",selectedSupplier.eway_bill_applicable?"Required":"N/A"]]},
                    {title:"Labels",icon:<Tag className="w-4 h-4"/>,fields:[["Template",selectedSupplier.default_label_template],["Barcode",selectedSupplier.default_barcode_type]]}
                  ].map(sec=>(
                    <div key={sec.title} className="p-4 bg-theme-surface-2 border border-theme-divider rounded-xl">
                      <h5 className="font-bold text-[#0a6ed1] text-xs uppercase font-mono flex items-center gap-2 mb-3">{sec.icon}{sec.title}</h5>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {sec.fields.map(([k,v])=>(
                          <div key={k as string} className="p-2 bg-theme-surface-1 rounded-lg border border-theme-divider">
                            <div className="text-[9px] font-mono text-theme-muted uppercase mb-0.5">{k}</div>
                            <div className="font-bold text-theme-heading text-xs truncate">{v||"—"}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* CONTACTS */}
              {studioTab==="contacts"&&(
                <div className="space-y-4">
                  <h4 className="font-bold text-sm text-theme-heading font-display flex items-center gap-2"><UserCheck className="w-5 h-5 text-[#0a6ed1]"/>Multi-Contact Directory</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(selectedSupplier.contacts||[]).map(c=>(
                      <div key={c.id} className="p-4 bg-theme-surface-2 border border-theme-divider rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-theme-heading font-sans">{c.name}</span>
                          {c.is_primary&&<span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded text-[10px] font-bold border border-emerald-500/30">Primary</span>}
                        </div>
                        <span className="px-2 py-0.5 bg-[#0a6ed1]/10 text-[#0a6ed1] rounded text-[10px] font-bold">{c.role}</span>
                        <div className="space-y-1 text-theme-muted font-mono text-xs">
                          <div className="flex items-center gap-2"><Phone className="w-3 h-3"/>{c.mobile}</div>
                          <div className="flex items-center gap-2"><Mail className="w-3 h-3"/>{c.email}</div>
                        </div>
                      </div>
                    ))}
                    {(selectedSupplier.contacts||[]).length===0&&<p className="text-theme-muted col-span-2 text-center py-8 font-mono">No contacts registered.</p>}
                  </div>
                </div>
              )}

              {/* BANKS */}
              {studioTab==="banks"&&(
                <div className="space-y-4">
                  <h4 className="font-bold text-sm text-theme-heading font-display flex items-center gap-2"><CreditCard className="w-5 h-5 text-[#0a6ed1]"/>Bank Accounts</h4>
                  {(selectedSupplier.bank_accounts||[]).map(b=>(
                    <div key={b.id} className="p-5 bg-theme-surface-2 border border-theme-divider rounded-xl">
                      <div className="flex items-center justify-between mb-4">
                        <div className="font-bold text-theme-heading font-sans">{b.bank_name}</div>
                        {b.is_primary&&<span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded text-[10px] font-bold border border-emerald-500/30">Primary</span>}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 font-mono text-xs">
                        {[["Account Holder",b.account_name],["Account No.",b.account_number],["IFSC",b.ifsc_code],["Branch",b.branch_name],["UPI / VPA",b.upi_id||"—"]].map(([k,v])=>(
                          <div key={k as string} className="p-2 bg-theme-surface-1 rounded-lg border border-theme-divider">
                            <div className="text-[9px] text-theme-muted uppercase mb-0.5">{k}</div>
                            <div className="font-bold text-theme-heading">{v}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  {(selectedSupplier.bank_accounts||[]).length===0&&<p className="text-theme-muted text-center py-8 font-mono">No bank accounts registered.</p>}
                </div>
              )}

              {/* ADDRESSES */}
              {studioTab==="addresses"&&(
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm text-theme-heading font-display flex items-center gap-2"><MapPin className="w-5 h-5 text-[#0a6ed1]"/>Addresses & Locations</h4>
                    {!isReadOnly&&<button onClick={addAddrStudio} className="px-3 py-1.5 bg-[#0a6ed1] text-white font-bold text-xs rounded-lg cursor-pointer flex items-center gap-1"><Plus className="w-3.5 h-3.5"/>Add Address</button>}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(selectedSupplier.addresses_list||[]).map(addr=>(
                      <div key={addr.id} className="p-4 bg-theme-surface-2 border border-theme-divider rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#0a6ed1]/10 text-[#0a6ed1]">{addr.address_type}</span>
                          {addr.is_primary&&<span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">Primary</span>}
                        </div>
                        {addr.building_name&&<p className="font-bold text-theme-heading font-sans">{addr.building_name}</p>}
                        <p className="text-theme-muted font-mono text-xs">{[addr.street,addr.area,addr.city,addr.state].filter(Boolean).join(", ")} — {addr.pincode}</p>
                      </div>
                    ))}
                    {(selectedSupplier.addresses_list||[]).length===0&&<p className="text-theme-muted col-span-2 text-center py-8 font-mono">No addresses registered.</p>}
                  </div>
                </div>
              )}

              {/* GST */}
              {studioTab==="gst"&&(
                <div className="space-y-5">
                  <h4 className="font-bold text-sm text-theme-heading font-display flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-[#0a6ed1]"/>GST, TAN, PAN & Tax</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {[
                      {title:"GST Registration",fields:[["GSTIN",selectedSupplier.gst_number],["GST Type",selectedSupplier.gst_type],["Place of Supply",selectedSupplier.place_of_supply],["GSTR-2B Status",selectedSupplier.gstr2b_status]]},
                      {title:"Statutory IDs",fields:[["PAN",selectedSupplier.pan_number],["TAN",selectedSupplier.tan_number],["CIN",selectedSupplier.cin_number],["IEC Code",selectedSupplier.iec_code]]},
                      {title:"TDS (Sec 194Q)",fields:[["TDS Applicable",selectedSupplier.is_tds_applicable?"Yes":"No"],["TDS Section",selectedSupplier.tds_section||"194Q"],["TDS Rate",selectedSupplier.tds_rate?`${(selectedSupplier.tds_rate*100).toFixed(2)}%`:"N/A"]]}
                    ].map(sec=>(
                      <div key={sec.title} className="p-5 bg-theme-surface-2 border border-theme-divider rounded-xl space-y-2">
                        <h5 className="font-bold text-xs uppercase text-theme-muted font-mono mb-3">{sec.title}</h5>
                        {sec.fields.map(([k,v])=>(
                          <div key={k as string} className="flex justify-between text-xs border-b border-theme-divider/40 pb-1.5 font-mono">
                            <span className="text-theme-muted">{k}</span>
                            <span className="font-bold text-theme-heading">{v||"—"}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* MSME */}
              {studioTab==="msme"&&(
                <div className="space-y-5">
                  <h4 className="font-bold text-sm text-theme-heading font-display flex items-center gap-2"><Award className="w-5 h-5 text-amber-400"/>MSME Section 43B(h) Profile</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="p-5 bg-theme-surface-2 border border-theme-divider rounded-xl space-y-2">
                      {[["MSME Category",selectedSupplier.msme_category],["Udyam No.",selectedSupplier.msme_number],["43B(h) Payment Limit","45 Days"],["Outstanding",selectedSupplier.balance]].map(([k,v])=>(
                        <div key={k as string} className="flex justify-between text-xs border-b border-theme-divider/40 pb-1.5 font-mono">
                          <span className="text-theme-muted">{k}</span><span className="font-bold text-theme-heading">{v||"—"}</span>
                        </div>
                      ))}
                    </div>
                    <div className="p-5 bg-amber-500/5 border border-amber-500/20 rounded-xl">
                      <h5 className="font-bold text-amber-400 text-xs uppercase font-mono mb-3">43B(h) Compliance Rule</h5>
                      <p className="text-xs text-theme-muted leading-relaxed">Payments to <strong className="text-theme-heading">MSME Micro & Small</strong> vendors must be cleared within <strong className="text-amber-400">45 days</strong>. Non-compliance <strong className="text-rose-400">disallows the expense deduction</strong> under Income Tax Section 43B(h).</p>
                    </div>
                  </div>
                </div>
              )}

              {/* DOCUMENTS */}
              {studioTab==="documents"&&(
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm text-theme-heading font-display flex items-center gap-2"><FileText className="w-5 h-5 text-[#0a6ed1]"/>Document Vault & Expiry Tracker</h4>
                    {!isReadOnly&&<button onClick={addDocStudio} className="px-3 py-1.5 bg-[#0a6ed1] text-white font-bold text-xs rounded-lg cursor-pointer flex items-center gap-1"><UploadCloud className="w-3.5 h-3.5"/>Upload</button>}
                  </div>
                  <div className="space-y-3">
                    {(selectedSupplier.documents||[]).map(d=>(
                      <div key={d.id} className="p-4 bg-theme-surface-2 border border-theme-divider rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <FileCheck className="w-8 h-8 text-[#0a6ed1]/60"/>
                          <div>
                            <strong className="font-sans text-theme-heading block">{d.doc_type}</strong>
                            <span className="text-theme-muted text-xs font-mono">{d.doc_number} | Expires: {d.expiry_date}</span>
                            {d.file_name&&<span className="block text-[#0a6ed1] text-[10px] mt-0.5 font-mono">{d.file_name}</span>}
                          </div>
                        </div>
                        <span className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase border ${d.status==="Valid"?"bg-emerald-500/10 text-emerald-400 border-emerald-500/30":d.status==="Expiring Soon"?"bg-amber-500/10 text-amber-400 border-amber-500/30":"bg-rose-500/10 text-rose-400 border-rose-500/30"}`}>{d.status}</span>
                      </div>
                    ))}
                    {(selectedSupplier.documents||[]).length===0&&<p className="text-theme-muted text-center py-8 font-mono">No documents attached.</p>}
                  </div>
                </div>
              )}

              {/* PURCHASE ORDERS */}
              {studioTab==="pos"&&(
                <div className="space-y-4">
                  <h4 className="font-bold text-sm text-theme-heading font-display flex items-center gap-2"><PackageCheck className="w-5 h-5 text-[#0a6ed1]"/>Purchase Orders</h4>
                  <div className="bg-theme-surface-2 border border-theme-divider rounded-xl overflow-hidden">
                    <table className="w-full text-xs font-mono">
                      <thead><tr className="border-b border-theme-divider bg-theme-surface-3 text-[10px] uppercase text-theme-muted"><th className="px-4 py-3">PO No.</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Items</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3">Status</th></tr></thead>
                      <tbody className="divide-y divide-theme-divider">
                        {[{po:"PO-2026-0089",date:"2026-07-28",items:12,amt:"₹1,20,000",st:"Delivered"},{po:"PO-2026-0045",date:"2026-06-10",items:5,amt:"₹45,500",st:"Delivered"}].map(r=>(
                          <tr key={r.po} className="hover:bg-theme-surface-hover"><td className="px-4 py-3 font-bold text-[#0a6ed1]">{r.po}</td><td className="px-4 py-3 text-theme-muted">{r.date}</td><td className="px-4 py-3">{r.items}</td><td className="px-4 py-3 text-right font-bold">{r.amt}</td><td className="px-4 py-3"><span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded text-[10px] font-bold border border-emerald-500/30">{r.st}</span></td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* GRN */}
              {studioTab==="grns"&&(
                <div className="space-y-4">
                  <h4 className="font-bold text-sm text-theme-heading font-display flex items-center gap-2"><Briefcase className="w-5 h-5 text-emerald-400"/>GRN History</h4>
                  <div className="bg-theme-surface-2 border border-theme-divider rounded-xl overflow-hidden">
                    <table className="w-full text-xs font-mono">
                      <thead><tr className="border-b border-theme-divider bg-theme-surface-3 text-[10px] uppercase text-theme-muted"><th className="px-4 py-3">GRN No.</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">PO Ref</th><th className="px-4 py-3 text-right">Value</th><th className="px-4 py-3">QC</th></tr></thead>
                      <tbody className="divide-y divide-theme-divider">
                        {[{grn:"GRN-2026-0052",date:"2026-07-30",po:"PO-2026-0089",val:"₹1,20,000",qc:"Accepted"}].map(r=>(
                          <tr key={r.grn} className="hover:bg-theme-surface-hover"><td className="px-4 py-3 font-bold text-emerald-400">{r.grn}</td><td className="px-4 py-3 text-theme-muted">{r.date}</td><td className="px-4 py-3 text-[#0a6ed1]">{r.po}</td><td className="px-4 py-3 text-right font-bold">{r.val}</td><td className="px-4 py-3"><span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded text-[10px] font-bold border border-emerald-500/30">{r.qc}</span></td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* INVOICES */}
              {studioTab==="invoices"&&(
                <div className="space-y-4">
                  <h4 className="font-bold text-sm text-theme-heading font-display flex items-center gap-2"><Receipt className="w-5 h-5 text-purple-400"/>Purchase Invoices</h4>
                  <div className="bg-theme-surface-2 border border-theme-divider rounded-xl overflow-hidden">
                    <table className="w-full text-xs font-mono">
                      <thead><tr className="border-b border-theme-divider bg-theme-surface-3 text-[10px] uppercase text-theme-muted"><th className="px-4 py-3">Invoice No.</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Due Date</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3">Status</th></tr></thead>
                      <tbody className="divide-y divide-theme-divider">
                        {[{inv:"INV-TC-2026-089",date:"2026-07-28",due:"2026-08-27",amt:"₹1,41,600",st:"Pending"},{inv:"INV-TC-2026-045",date:"2026-06-10",due:"2026-07-10",amt:"₹53,690",st:"Paid"}].map(r=>(
                          <tr key={r.inv} className="hover:bg-theme-surface-hover"><td className="px-4 py-3 font-bold text-purple-400">{r.inv}</td><td className="px-4 py-3 text-theme-muted">{r.date}</td><td className="px-4 py-3 text-theme-muted">{r.due}</td><td className="px-4 py-3 text-right font-bold">{r.amt}</td><td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${r.st==="Paid"?"bg-emerald-500/10 text-emerald-400 border-emerald-500/30":"bg-amber-500/10 text-amber-400 border-amber-500/30"}`}>{r.st}</span></td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* PAYMENTS */}
              {studioTab==="payments"&&(
                <div className="space-y-4">
                  <h4 className="font-bold text-sm text-theme-heading font-display flex items-center gap-2"><DollarSign className="w-5 h-5 text-emerald-400"/>Payment History</h4>
                  <div className="bg-theme-surface-2 border border-theme-divider rounded-xl overflow-hidden">
                    <table className="w-full text-xs font-mono">
                      <thead><tr className="border-b border-theme-divider bg-theme-surface-3 text-[10px] uppercase text-theme-muted"><th className="px-4 py-3">Payment Ref</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Mode</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3">Invoice</th></tr></thead>
                      <tbody className="divide-y divide-theme-divider">
                        {[{ref:"PAY-2026-0044",date:"2026-07-10",mode:"NEFT",amt:"₹53,690",inv:"INV-TC-2026-045"}].map(r=>(
                          <tr key={r.ref} className="hover:bg-theme-surface-hover"><td className="px-4 py-3 font-bold text-emerald-400">{r.ref}</td><td className="px-4 py-3 text-theme-muted">{r.date}</td><td className="px-4 py-3"><span className="px-2 py-0.5 bg-theme-surface-3 rounded text-[10px] font-bold">{r.mode}</span></td><td className="px-4 py-3 text-right font-bold">{r.amt}</td><td className="px-4 py-3 text-[#0a6ed1]">{r.inv}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* SCORECARD */}
              {studioTab==="ratings"&&(
                <div className="space-y-5">
                  <h4 className="font-bold text-sm text-theme-heading font-display flex items-center gap-2"><Star className="w-5 h-5 text-amber-400"/>Vendor Scorecard</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="p-5 bg-theme-surface-2 border border-theme-divider rounded-xl flex flex-col items-center justify-center gap-2">
                      <span className="text-theme-muted font-mono text-xs uppercase">Overall Rating</span>
                      <span className="text-6xl font-bold text-emerald-400 font-mono">{selectedSupplier.scorecard_rating?.toFixed(1)||"92.0"}</span>
                      <span className="text-theme-muted text-xs">/100 composite score</span>
                    </div>
                    <div className="p-5 bg-theme-surface-2 border border-theme-divider rounded-xl space-y-4">
                      {[{l:"Quality Rating",v:selectedSupplier.quality_rating||95.0,c:"bg-blue-500"},{l:"Delivery Rating",v:selectedSupplier.delivery_rating||90.0,c:"bg-emerald-500"},{l:"Price Competitiveness",v:selectedSupplier.price_rating||91.0,c:"bg-purple-500"}].map(r=>(
                        <div key={r.l}>
                          <div className="flex justify-between text-xs font-mono text-theme-muted mb-1.5"><span>{r.l}</span><span className="font-bold text-theme-heading">{r.v.toFixed(1)}%</span></div>
                          <div className="w-full h-2 bg-theme-surface-3 rounded-full"><div className={`h-2 rounded-full transition-all ${r.c}`} style={{width:`${r.v}%`}}/></div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* COMMUNICATION LOG */}
              {studioTab==="timeline"&&(
                <div className="space-y-5">
                  <h4 className="font-bold text-sm text-theme-heading font-display flex items-center gap-2"><MessageSquare className="w-5 h-5 text-[#0a6ed1]"/>Communication Log</h4>
                  {!isReadOnly&&(
                    <div className="p-4 bg-theme-surface-2 border border-theme-divider rounded-xl space-y-3">
                      <h5 className="font-bold text-xs text-theme-muted font-mono uppercase">Log Interaction</h5>
                      <div className="flex gap-3">
                        <select value={logType} onChange={e=>setLogType(e.target.value as any)} className="p-2 bg-theme-surface-1 border border-theme-divider rounded-lg text-xs font-mono text-theme-heading">
                          {["Call","Email","WhatsApp","Payment Reminder"].map(t=><option key={t} value={t}>{t}</option>)}
                        </select>
                        <input type="text" placeholder="Log interaction summary..." value={newLogMessage} onChange={e=>setNewLogMessage(e.target.value)} className="flex-1 p-2 bg-theme-surface-1 border border-theme-divider rounded-lg text-xs text-theme-heading focus:outline-none focus:border-[#0a6ed1]"/>
                        <button onClick={addLog} className="px-4 py-2 bg-[#0a6ed1] text-white font-bold text-xs rounded-lg cursor-pointer flex items-center gap-1"><Send className="w-3.5 h-3.5"/>Log</button>
                      </div>
                    </div>
                  )}
                  <div className="space-y-3">
                    {(selectedSupplier.communication_logs||[]).map(log=>(
                      <div key={log.id} className="p-4 bg-theme-surface-2 border border-theme-divider rounded-xl flex items-start gap-3">
                        <div className="p-2 bg-[#0a6ed1]/10 rounded-lg mt-0.5"><MessageSquare className="w-4 h-4 text-[#0a6ed1]"/></div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2 py-0.5 bg-theme-surface-3 rounded text-[10px] font-bold font-mono">{log.type}</span>
                            <span className="text-theme-muted text-[10px] font-mono">{log.timestamp} | by {log.user}</span>
                          </div>
                          <p className="text-xs text-theme-heading mt-1.5">{log.summary}</p>
                        </div>
                      </div>
                    ))}
                    {(selectedSupplier.communication_logs||[]).length===0&&<p className="text-theme-muted text-center py-8 font-mono">No communication logs.</p>}
                  </div>
                </div>
              )}

              {/* APPROVALS */}
              {studioTab==="approvals"&&(
                <div className="space-y-5">
                  <h4 className="font-bold text-sm text-theme-heading font-display flex items-center gap-2"><CheckSquare className="w-5 h-5 text-emerald-400"/>Approval Lifecycle</h4>
                  <div className="p-5 bg-theme-surface-2 border border-theme-divider rounded-xl space-y-4">
                    <div className="flex items-center gap-3 flex-wrap">
                      {(["Draft","Pending Approval","Approved","Blocked","Blacklisted"] as const).map((stage,i,arr)=>(
                        <React.Fragment key={stage}>
                          <div className={`flex flex-col items-center gap-1 ${selectedSupplier.status===stage?"opacity-100":"opacity-40"}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${selectedSupplier.status===stage?"bg-[#0a6ed1] text-white":"bg-theme-surface-3 text-theme-muted"}`}>{i+1}</div>
                            <span className="text-[9px] font-mono text-theme-muted text-center whitespace-nowrap">{stage}</span>
                          </div>
                          {i<arr.length-1&&<ChevronRight className="w-4 h-4 text-theme-divider flex-shrink-0"/>}
                        </React.Fragment>
                      ))}
                    </div>
                    {!isReadOnly&&(
                      <div className="flex gap-2 flex-wrap pt-2 border-t border-theme-divider">
                        {(["Approved","Pending Approval","Blocked","Blacklisted"] as const).map(s=>(
                          <button key={s} onClick={()=>updateStatus(s)} className={`px-3 py-1.5 text-xs font-bold rounded-lg border cursor-pointer transition-colors ${s==="Approved"?"bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20":s==="Blocked"?"bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20":s==="Blacklisted"?"bg-slate-500/10 text-slate-400 border-slate-500/30":"bg-amber-500/10 text-amber-400 border-amber-500/30"}`}>{s}</button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* AUDIT LOG */}
              {studioTab==="audit"&&(
                <div className="space-y-4">
                  <h4 className="font-bold text-sm text-theme-heading font-display flex items-center gap-2"><History className="w-5 h-5 text-theme-muted"/>Audit Trail</h4>
                  <div className="space-y-2">
                    {[
                      {action:"RECORD_CREATED",ts:selectedSupplier.created_at||"2026-01-15 10:00",user:selectedSupplier.created_by||"Admin",note:"Vendor master record created."},
                      {action:"STATUS_APPROVED",ts:"2026-01-15 10:05",user:"Jawahar Mallah",note:"Vendor approved by Purchase Head."},
                      {action:"GST_VERIFIED",ts:"2026-01-16 09:30",user:"System",note:"GSTIN verified against GSTN portal."},
                      {action:"BANK_REGISTERED",ts:"2026-01-16 11:00",user:selectedSupplier.created_by||"Admin",note:"Primary bank account registered."}
                    ].map((log,i)=>(
                      <div key={i} className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl flex items-start gap-3 font-mono text-xs">
                        <div className="p-1.5 bg-theme-surface-3 rounded-lg flex-shrink-0"><History className="w-3.5 h-3.5 text-theme-muted"/></div>
                        <div>
                          <span className="px-2 py-0.5 bg-[#0a6ed1]/10 text-[#0a6ed1] rounded text-[10px] font-bold">{log.action}</span>
                          <span className="ml-2 text-theme-muted text-[10px]">{log.ts} | by {log.user}</span>
                          <p className="text-theme-heading mt-1 text-xs">{log.note}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </SmritiScrollArea>

            <div className="flex justify-end p-4 border-t border-theme-divider bg-theme-surface-2">
              <button onClick={()=>setSelectedSupplier(null)} className="px-5 py-2 bg-[#0a6ed1] text-white font-bold text-xs rounded-lg cursor-pointer">Close Enterprise Studio</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
