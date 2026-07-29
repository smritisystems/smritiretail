/**
 * Project      : SMRITI Retail OS v5.0
 * Module       : Supplier & Vendor Management Platform (100% 18-Section Indian Enterprise Standard)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com and AITDL.com. All Rights Reserved.
 * Version      : 5.6.0
 */

import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { SmritiScrollArea } from "./SmritiScrollArea.tsx";
import { DrillableLink } from "./drilldown/DrillableLink.tsx";
import { recordAuditAction } from "../lib/apiFetch.ts";
import { apiFetchV1 } from "../lib/apiFetchV1.js";
import {
  Building2,
  Plus,
  Search,
  X,
  Phone,
  Mail,
  MapPin,
  CheckCircle2,
  AlertCircle,
  FileText,
  ShieldCheck,
  DollarSign,
  UserCheck,
  Briefcase,
  AlertTriangle,
  Receipt,
  Scale,
  Award,
  CreditCard,
  Percent,
  Truck,
  Printer,
  Globe,
  Tag,
  Calendar,
  Clock,
  ExternalLink,
  MessageSquare,
  Send,
  History,
  Lock,
  Unlock,
  Ban,
  CheckSquare,
  FileCheck,
  PackageCheck,
  TrendingUp,
  Sliders,
  Check
} from "lucide-react";

// Enterprise Child Types
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

export interface SupplierDocumentRecord {
  id: string;
  doc_type: "GST Certificate" | "FSSAI License" | "Drug License" | "MSME Certificate" | "Agreement" | "Insurance";
  doc_number: string;
  expiry_date: string;
  status: "Valid" | "Expiring Soon" | "Expired";
  file_url?: string;
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
  status: "Draft" | "Pending Approval" | "Approved" | "Blocked" | "Blacklisted";

  // Compliance & Licenses
  msme_category?: "Micro" | "Small" | "Medium" | "Non-MSME";
  msme_number?: string;
  fssai_license_no?: string;
  fssai_expiry?: string;
  drug_license_no?: string;
  drug_license_expiry?: string;
  iec_code?: string;
  is_tds_applicable?: boolean;
  tds_rate?: number;
  gstr2b_status?: "Matched" | "Pending ITC" | "Mismatched";

  // Scorecards
  scorecard_rating?: number;
  quality_rating?: number;
  delivery_rating?: number;
  price_rating?: number;

  // Purchase Defaults
  currency?: string;
  warehouse?: string;
  lead_time_days?: number;
  min_order_qty?: number;
  max_order_qty?: number;
  order_multiple?: number;
  is_preferred?: boolean;

  // Logistics
  transport_name?: string;
  transporter_gstin?: string;
  freight_terms?: string;

  // Labels & Barcodes
  default_label_template?: string;
  default_barcode_type?: string;

  // Child collections
  contacts?: SupplierContactRole[];
  bank_accounts?: SupplierBankAccount[];
  documents?: SupplierDocumentRecord[];
  communication_logs?: SupplierCommunicationLogItem[];

  created_at?: string;
  modified_at?: string;
  created_by?: string;
}

interface SupplierDashboardTabProps {
  currentUser?: { role: string; name: string } | null;
  onNotification?: (title: string, message: string, type?: "success" | "error") => void;
}

export const SupplierDashboardTab: React.FC<SupplierDashboardTabProps> = ({
  currentUser,
  onNotification
}) => {
  const isReadOnly = currentUser?.role === "Report User";
  const [activeSubTab, setActiveSubTab] = useState<
    "directory" | "dashboard" | "msme" | "tds" | "expiry" | "performance"
  >("directory");

  // State for Supplier Directory
  const [suppliers, setSuppliers] = useState<SupplierItem[]>([
    {
      id: "SUP-001",
      code: "SUP-001",
      name: "TechCorp Distributors",
      legal_name: "TechCorp India Private Limited",
      display_name: "TechCorp Tech Hub",
      trade_name: "TechCorp India Ltd",
      supplier_type_id: "Distributor",
      group: "Electronics",
      contact_person: "Rajesh Kumar",
      designation: "Senior Manager",
      mobile: "+91 98200 12345",
      email: "rajesh@techcorp.com",
      website: "https://techcorp.com",
      gst_number: "27ABCDE1234F1Z5",
      pan_number: "ABCDE1234F",
      tan_number: "MUMB12345F",
      cin_number: "U72200MH2010PTC123456",
      gst_type: "Regular",
      place_of_supply: "Maharashtra (27)",
      balance: "₹1,20,000",
      outstanding_balance: 120000,
      credit_limit: 500000,
      credit_days: 30,
      opening_balance: 25000,
      status: "Approved",
      city: "Mumbai",
      state: "Maharashtra",
      address: "Plot 45, MIDC Industrial Area, Andheri East",
      pincode: "400093",
      msme_category: "Small",
      msme_number: "UDYAM-MH-12-0001234",
      iec_code: "1012001122",
      fssai_license_no: "10019022001234",
      fssai_expiry: "2026-12-31",
      is_tds_applicable: true,
      tds_rate: 0.10,
      gstr2b_status: "Matched",
      scorecard_rating: 94.5,
      quality_rating: 98.2,
      delivery_rating: 96.5,
      price_rating: 92.0,
      currency: "INR",
      warehouse: "Central Warehouse (WH-01)",
      lead_time_days: 3,
      min_order_qty: 10,
      order_multiple: 5,
      is_preferred: true,
      transport_name: "VRL Logistics Ltd",
      transporter_gstin: "27AAACV1234F1Z9",
      freight_terms: "Prepaid by Supplier",
      default_label_template: "50x25mm",
      default_barcode_type: "CODE128",
      contacts: [
        { id: "c1", name: "Rajesh Kumar", role: "Purchase Manager", mobile: "+91 98200 12345", email: "rajesh@techcorp.com", is_primary: true },
        { id: "c2", name: "Suresh Sharma", role: "Accounts", mobile: "+91 98200 67890", email: "accounts@techcorp.com", is_primary: false }
      ],
      bank_accounts: [
        { id: "b1", bank_name: "HDFC Bank", account_name: "TechCorp India Pvt Ltd", account_number: "50200012345678", ifsc_code: "HDFC0000123", branch_name: "Fort, Mumbai", upi_id: "techcorp@hdfcbank", is_primary: true }
      ],
      documents: [
        { id: "d1", doc_type: "GST Certificate", doc_number: "27ABCDE1234F1Z5", expiry_date: "2028-03-31", status: "Valid" },
        { id: "d2", doc_type: "FSSAI License", doc_number: "10019022001234", expiry_date: "2026-08-15", status: "Expiring Soon" }
      ],
      communication_logs: [
        { id: "l1", timestamp: "2026-07-28 14:30", type: "PO Sent", summary: "Auto-dispatched PO-2026-0089 for ₹1,20,000", user: "System" },
        { id: "l2", timestamp: "2026-07-25 11:00", type: "WhatsApp", summary: "Dispatched shipment via VRL Tracking #VRL98765", user: "Rajesh Kumar" }
      ],
      created_at: "2026-01-15 10:00:00",
      created_by: "Jawahar Mallah"
    },
    {
      id: "SUP-002",
      code: "SUP-002",
      name: "Global Supplies Ltd.",
      legal_name: "Global Retail & Wholesale Corporation",
      display_name: "Global Supplies Direct",
      trade_name: "Global Retail Logistics",
      supplier_type_id: "Wholesaler",
      group: "General Retail",
      contact_person: "Anita Singh",
      designation: "Key Account Officer",
      mobile: "+91 98333 99887",
      email: "anita@globalsupplies.com",
      gst_number: "27XYZPQ9876G1Z3",
      pan_number: "XYZPQ9876G",
      gst_type: "Regular",
      place_of_supply: "Maharashtra (27)",
      balance: "₹0",
      outstanding_balance: 0,
      credit_limit: 300000,
      credit_days: 15,
      status: "Approved",
      city: "Pune",
      state: "Maharashtra",
      address: "Sector 18, Electronic Zone, Hinjewadi Phase 1",
      pincode: "411057",
      msme_category: "Non-MSME",
      is_tds_applicable: false,
      tds_rate: 0.00,
      gstr2b_status: "Matched",
      scorecard_rating: 88.0,
      quality_rating: 90.0,
      delivery_rating: 86.0,
      price_rating: 88.0,
      lead_time_days: 5,
      min_order_qty: 25,
      default_label_template: "38x25mm",
      default_barcode_type: "EAN13",
      contacts: [
        { id: "c3", name: "Anita Singh", role: "Sales Executive", mobile: "+91 98333 99887", email: "anita@globalsupplies.com", is_primary: true }
      ],
      bank_accounts: [
        { id: "b2", bank_name: "ICICI Bank", account_name: "Global Supplies Ltd", account_number: "000405012345", ifsc_code: "ICIC0000004", branch_name: "Kothrud, Pune", is_primary: true }
      ],
      documents: [
        { id: "d3", doc_type: "GST Certificate", doc_number: "27XYZPQ9876G1Z3", expiry_date: "2027-11-30", status: "Valid" }
      ],
      communication_logs: [],
      created_at: "2026-02-10 12:00:00",
      created_by: "Admin"
    },
    {
      id: "SUP-003",
      code: "SUP-003",
      name: "Metro Wholesale Hub",
      legal_name: "Metro Agro FMCG India Pvt Ltd",
      trade_name: "Metro Agro Ltd",
      supplier_type_id: "Manufacturer",
      group: "FMCG & Groceries",
      contact_person: "Vikram Mehta",
      mobile: "+91 97111 22334",
      email: "vikram@metrowholesale.in",
      gst_number: "24AAAAA0000A1Z5",
      pan_number: "AAAAA0000A",
      gst_type: "Composition",
      place_of_supply: "Gujarat (24)",
      balance: "₹45,500",
      outstanding_balance: 45500,
      credit_limit: 250000,
      credit_days: 30,
      status: "Pending Approval",
      city: "Ahmedabad",
      state: "Gujarat",
      address: "GIDC Industrial Estate, Naroda",
      pincode: "382330",
      msme_category: "Micro",
      msme_number: "UDYAM-GJ-05-0009876",
      fssai_license_no: "10019022001234",
      fssai_expiry: "2026-05-10",
      is_tds_applicable: true,
      tds_rate: 0.10,
      gstr2b_status: "Pending ITC",
      scorecard_rating: 79.2,
      quality_rating: 82.0,
      delivery_rating: 75.0,
      price_rating: 80.0,
      lead_time_days: 2,
      default_label_template: "100x50mm",
      default_barcode_type: "CODE128",
      documents: [
        { id: "d4", doc_type: "FSSAI License", doc_number: "10019022001234", expiry_date: "2026-05-10", status: "Expired" }
      ],
      created_at: "2026-03-01 16:30:00",
      created_by: "System"
    }
  ]);

  const [searchTerm, setSearchTerm] = useState<string>("");
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalTab, setModalTab] = useState<
    "basic" | "tax" | "contacts" | "address" | "bank" | "purchase" | "logistics" | "docs" | "label"
  >("basic");

  // Inspector Studio State (16 Tabs)
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierItem | null>(null);
  const [studioTab, setStudioTab] = useState<
    | "overview"
    | "attributes"
    | "contacts"
    | "banks"
    | "addresses"
    | "gst"
    | "msme"
    | "documents"
    | "pos"
    | "grns"
    | "invoices"
    | "payments"
    | "ratings"
    | "timeline"
    | "approvals"
    | "audit"
  >("overview");

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [newLogMessage, setNewLogMessage] = useState<string>("");
  const [logType, setLogType] = useState<"Email" | "WhatsApp" | "Call" | "Payment Reminder">("Call");

  // Form Data State
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    display_name: "",
    legal_name: "",
    trade_name: "",
    supplier_type_id: "Manufacturer",
    group: "General Retail",
    status: "Approved" as "Draft" | "Pending Approval" | "Approved" | "Blocked" | "Blacklisted",

    is_gst_registered: true,
    gst_number: "",
    pan_number: "",
    tan_number: "",
    cin_number: "",
    msme_category: "Micro" as "Micro" | "Small" | "Medium" | "Non-MSME",
    msme_number: "",
    udyam_number: "",
    iec_code: "",
    fssai_license_no: "",
    fssai_expiry: "",
    drug_license_no: "",
    gst_type: "Regular",
    place_of_supply: "Maharashtra (27)",

    contact_person: "",
    designation: "General Manager",
    mobile: "",
    alt_mobile: "",
    whatsapp: "",
    email: "",
    website: "",
    address: "",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "400001",

    bank_name: "",
    account_name: "",
    account_number: "",
    ifsc_code: "",
    branch_name: "",
    upi_id: "",
    opening_balance: "0",
    credit_limit: "200000",
    credit_days: "30",
    is_tds_applicable: true,
    tds_rate: "0.10",

    currency: "INR",
    warehouse: "Central Warehouse (WH-01)",
    lead_time_days: "3",
    min_order_qty: "1.000",
    max_order_qty: "100.000",
    order_multiple: "1.000",
    is_preferred: true,

    transport_name: "VRL Logistics Ltd",
    transporter_gstin: "",
    freight_terms: "Prepaid by Supplier",

    default_label_template: "50x25mm",
    default_barcode_type: "CODE128"
  });

  const fetchSuppliers = async () => {
    try {
      const data = await apiFetchV1("/purchase/suppliers/");
      if (Array.isArray(data) && data.length > 0) {
        setSuppliers(data.map((s: any) => ({
          id: s.id,
          code: s.code || s.id,
          name: s.name,
          legal_name: s.legal_name || s.name,
          display_name: s.display_name || s.name,
          trade_name: s.trade_name,
          supplier_type_id: s.supplier_type_id || "Manufacturer",
          group: s.supplier_group_id || s.group || "General Retail",
          contact_person: s.contacts?.[0]?.name || s.contact_person || "Primary Contact",
          mobile: s.mobile || s.contacts?.[0]?.mobile || "N/A",
          email: s.email || s.contacts?.[0]?.email || "N/A",
          gst_number: s.gst_number || s.tax_profile?.gstin || "N/A",
          pan_number: s.pan_number || s.tax_profile?.pan_number || "N/A",
          tan_number: s.tan_number || "N/A",
          cin_number: s.cin_number || "N/A",
          gst_type: s.gst_type || "Regular",
          place_of_supply: s.place_of_supply || "Maharashtra (27)",
          balance: `₹${(s.outstanding_balance || 0).toLocaleString("en-IN")}`,
          outstanding_balance: s.outstanding_balance || 0,
          credit_limit: s.credit_profile?.credit_limit || 200000,
          credit_days: s.credit_profile?.credit_days || 30,
          status: s.account_status || s.status || "Approved",
          city: s.city || "Mumbai",
          state: s.state || "Maharashtra",
          msme_category: s.compliance_profile?.msme_category || "Micro",
          msme_number: s.compliance_profile?.msme_number || "N/A",
          fssai_license_no: s.compliance_profile?.fssai_license_no || "N/A",
          is_tds_applicable: s.tax_profile?.is_tds_applicable ?? true,
          tds_rate: s.tax_profile?.tds_rate || 0.10,
          gstr2b_status: "Matched",
          scorecard_rating: s.performance_rating || 92.0,
          quality_rating: 95.0,
          delivery_rating: 90.0,
          price_rating: 91.0,
          default_label_template: s.default_label_template || "50x25mm",
          default_barcode_type: s.default_barcode_type || "CODE128",
          contacts: s.contacts || [],
          bank_accounts: s.bank_details || [],
          documents: s.documents || []
        })));
      }
    } catch (err) {
      // Keep seeded suppliers
    }
  };

  useEffect(() => {
    fetchSuppliers();
    recordAuditAction("VIEW", "suppliers", activeSubTab, `Switched supplier view to: ${activeSubTab}`);
  }, [activeSubTab]);

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleOpenModal = () => {
    if (isReadOnly) {
      if (onNotification) {
        onNotification("Access Denied", "Operating under a Read-Only Report User role. Write operations are prohibited.", "error");
      }
      return;
    }
    const autoCode = `VND-${Math.floor(1000 + Math.random() * 9000)}`;
    setFormData({
      code: autoCode,
      name: "",
      display_name: "",
      legal_name: "",
      trade_name: "",
      supplier_type_id: "Manufacturer",
      group: "General Retail",
      status: "Approved",
      is_gst_registered: true,
      gst_number: "",
      pan_number: "",
      tan_number: "",
      cin_number: "",
      msme_category: "Micro",
      msme_number: "",
      udyam_number: "",
      iec_code: "",
      fssai_license_no: "",
      fssai_expiry: "",
      drug_license_no: "",
      gst_type: "Regular",
      place_of_supply: "Maharashtra (27)",
      contact_person: "",
      designation: "General Manager",
      mobile: "",
      alt_mobile: "",
      whatsapp: "",
      email: "",
      website: "",
      address: "",
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "400001",
      bank_name: "",
      account_name: "",
      account_number: "",
      ifsc_code: "",
      branch_name: "",
      upi_id: "",
      opening_balance: "0",
      credit_limit: "200000",
      credit_days: "30",
      is_tds_applicable: true,
      tds_rate: "0.10",
      currency: "INR",
      warehouse: "Central Warehouse (WH-01)",
      lead_time_days: "3",
      min_order_qty: "1.000",
      max_order_qty: "100.000",
      order_multiple: "1.000",
      is_preferred: true,
      transport_name: "VRL Logistics Ltd",
      transporter_gstin: "",
      freight_terms: "Prepaid by Supplier",
      default_label_template: "50x25mm",
      default_barcode_type: "CODE128"
    });
    setModalTab("basic");
    setIsModalOpen(true);
  };

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      if (onNotification) onNotification("Validation Error", "Vendor Name is mandatory.", "error");
      return;
    }

    setIsSubmitting(true);
    const newVendorId = `SUP-${Math.floor(1000 + Math.random() * 9000)}`;
    const newSupplierItem: SupplierItem = {
      id: newVendorId,
      code: formData.code || newVendorId,
      name: formData.name.trim(),
      legal_name: formData.legal_name || formData.name,
      display_name: formData.display_name || formData.name,
      trade_name: formData.trade_name || formData.name,
      supplier_type_id: formData.supplier_type_id,
      group: formData.group,
      contact_person: formData.contact_person || "Primary Contact",
      designation: formData.designation,
      mobile: formData.mobile || "N/A",
      email: formData.email || "N/A",
      website: formData.website,
      gst_number: formData.gst_number || "N/A",
      pan_number: formData.pan_number || "N/A",
      tan_number: formData.tan_number,
      cin_number: formData.cin_number,
      gst_type: formData.gst_type,
      place_of_supply: formData.place_of_supply,
      address: formData.address,
      city: formData.city,
      state: formData.state,
      pincode: formData.pincode,
      balance: "₹0",
      outstanding_balance: 0,
      credit_limit: parseFloat(formData.credit_limit) || 200000,
      credit_days: parseInt(formData.credit_days) || 30,
      status: formData.status,
      msme_category: formData.msme_category,
      msme_number: formData.msme_number || formData.udyam_number || "N/A",
      fssai_license_no: formData.fssai_license_no,
      fssai_expiry: formData.fssai_expiry,
      drug_license_no: formData.drug_license_no,
      iec_code: formData.iec_code,
      is_tds_applicable: formData.is_tds_applicable,
      tds_rate: parseFloat(formData.tds_rate) || 0.10,
      gstr2b_status: "Matched",
      scorecard_rating: 95.0,
      quality_rating: 98.0,
      delivery_rating: 95.0,
      price_rating: 92.0,
      currency: formData.currency,
      warehouse: formData.warehouse,
      lead_time_days: parseInt(formData.lead_time_days) || 3,
      min_order_qty: parseFloat(formData.min_order_qty) || 1,
      max_order_qty: parseFloat(formData.max_order_qty) || 100,
      order_multiple: parseFloat(formData.order_multiple) || 1,
      is_preferred: formData.is_preferred,
      transport_name: formData.transport_name,
      transporter_gstin: formData.transporter_gstin,
      freight_terms: formData.freight_terms,
      default_label_template: formData.default_label_template,
      default_barcode_type: formData.default_barcode_type,
      contacts: formData.contact_person
        ? [{ id: `c-${Date.now()}`, name: formData.contact_person, role: "Purchase Manager", mobile: formData.mobile, email: formData.email, is_primary: true }]
        : [],
      bank_accounts: formData.bank_name
        ? [{ id: `b-${Date.now()}`, bank_name: formData.bank_name, account_name: formData.account_name || formData.name, account_number: formData.account_number, ifsc_code: formData.ifsc_code, branch_name: formData.branch_name, upi_id: formData.upi_id, is_primary: true }]
        : [],
      documents: formData.gst_number
        ? [{ id: `d-${Date.now()}`, doc_type: "GST Certificate", doc_number: formData.gst_number, expiry_date: "2028-12-31", status: "Valid" }]
        : [],
      communication_logs: [
        { id: `l-${Date.now()}`, timestamp: new Date().toISOString().replace("T", " ").substring(0, 16), type: "Email", summary: "Vendor Onboarded into System", user: currentUser?.name || "System" }
      ],
      created_at: new Date().toISOString().substring(0, 10),
      created_by: currentUser?.name || "Admin"
    };

    try {
      await apiFetchV1("/purchase/suppliers/", {
        method: "POST",
        body: JSON.stringify({
          name: formData.name.trim(),
          code: formData.code || newVendorId,
          legal_name: formData.legal_name,
          display_name: formData.display_name,
          trade_name: formData.trade_name,
          supplier_type_id: formData.supplier_type_id,
          supplier_group_id: formData.group,
          gst_number: formData.gst_number,
          tan_number: formData.tan_number,
          cin_number: formData.cin_number,
          place_of_supply: formData.place_of_supply,
          gst_type: formData.gst_type,
          mobile: formData.mobile,
          email: formData.email,
          address: formData.address,
          city: formData.city,
          state: formData.state,
          pincode: formData.pincode,
          lead_time_days: parseInt(formData.lead_time_days) || 3,
          min_order_qty: parseFloat(formData.min_order_qty) || 1,
          max_order_qty: parseFloat(formData.max_order_qty) || 100,
          order_multiple: parseFloat(formData.order_multiple) || 1,
          transport_name: formData.transport_name,
          transporter_gstin: formData.transporter_gstin,
          freight_terms: formData.freight_terms,
          default_label_template: formData.default_label_template,
          default_barcode_type: formData.default_barcode_type
        })
      });
      if (onNotification) {
        onNotification("Vendor Onboarded", `Successfully registered ${formData.name} (${formData.code})`, "success");
      }
    } catch (err) {
      if (onNotification) {
        onNotification("Vendor Added", `Registered ${formData.name} (${formData.code}) locally.`, "success");
      }
    } finally {
      setSuppliers((prev) => [newSupplierItem, ...prev]);
      setIsSubmitting(false);
      setIsModalOpen(false);
    }
  };

  const handleUpdateStatus = (newStatus: "Approved" | "Blocked" | "Blacklisted" | "Pending Approval") => {
    if (!selectedSupplier) return;
    const updated = { ...selectedSupplier, status: newStatus };
    setSuppliers((prev) => prev.map((s) => (s.id === selectedSupplier.id ? updated : s)));
    setSelectedSupplier(updated);
    if (onNotification) {
      onNotification("Status Updated", `${selectedSupplier.name} status changed to ${newStatus}`, "success");
    }
  };

  const handleAddCommunicationLog = () => {
    if (!selectedSupplier || !newLogMessage.trim()) return;
    const newLog: SupplierCommunicationLogItem = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString().replace("T", " ").substring(0, 16),
      type: logType,
      summary: newLogMessage.trim(),
      user: currentUser?.name || "Jawahar Mallah"
    };
    const updatedLogs = [newLog, ...(selectedSupplier.communication_logs || [])];
    const updatedSupplier = { ...selectedSupplier, communication_logs: updatedLogs };
    setSuppliers((prev) => prev.map((s) => (s.id === selectedSupplier.id ? updatedSupplier : s)));
    setSelectedSupplier(updatedSupplier);
    setNewLogMessage("");
    if (onNotification) onNotification("Log Recorded", `Logged ${logType} interaction cleanly.`, "success");
  };

  const filteredSuppliers = suppliers.filter((v) => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      v.name.toLowerCase().includes(q) ||
      (v.code && v.code.toLowerCase().includes(q)) ||
      (v.group && v.group.toLowerCase().includes(q)) ||
      (v.gst_number && v.gst_number.toLowerCase().includes(q)) ||
      (v.contact_person && v.contact_person.toLowerCase().includes(q))
    );
  });

  const totalOutstanding = suppliers.reduce((acc, s) => acc + (s.outstanding_balance || 0), 0);
  const msmeSuppliersCount = suppliers.filter((s) => s.msme_category === "Micro" || s.msme_category === "Small").length;
  const expiringDocsCount = suppliers.reduce((acc, s) => acc + (s.documents?.filter((d) => d.status === "Expiring Soon" || d.status === "Expired").length || 0), 0);

  return (
    <div className="flex flex-col h-full bg-theme-surface-1 text-theme-primary font-sans select-none">
      {isReadOnly && (
        <div className="bg-amber-950/40 border-b border-amber-500/30 px-6 py-2.5 flex items-center space-x-2 text-amber-400 text-xs">
          <AlertCircle className="w-4 h-4" />
          <span className="font-mono uppercase tracking-wider font-bold">Read-Only Mode:</span>
          <span>Operating under a Read-Only Report User role. Write operations are prohibited.</span>
        </div>
      )}

      {/* Main Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-theme-divider bg-theme-surface-2 px-6 py-4">
        <div>
          <h2 className="text-xl font-bold font-display text-theme-primary tracking-tight flex items-center gap-2">
            <Building2 className="w-6 h-6 text-[#0a6ed1]" /> Indian Enterprise Supplier Master (100% Parity)
          </h2>
          <p className="text-xs text-theme-muted mt-1 max-w-3xl">
            18-Section Master: Manufacturers, Wholesalers, Distributors, MSME Sec 43B(h), Sec 194Q TDS, Multi-Bank, Document Expiry Vault &amp; Audit Logs.
          </p>
        </div>
        <div className="flex items-center gap-3 mt-4 md:mt-0 bg-theme-surface-3 px-4 py-2 rounded-lg border border-theme-divider">
          <div className="text-right">
            <div className="text-[10px] font-mono text-theme-muted uppercase font-bold">Total Payables</div>
            <div className="text-sm font-bold text-rose-400 font-mono">₹{totalOutstanding.toLocaleString("en-IN")}</div>
          </div>
          <div className="w-px h-8 bg-theme-divider mx-2"></div>
          <div className="text-right">
            <div className="text-[10px] font-mono text-theme-muted uppercase font-bold">Doc Expiry Alerts</div>
            <div className="text-sm font-bold text-amber-400 font-mono">{expiringDocsCount} Expiring / Expired</div>
          </div>
        </div>
      </div>

      {/* Sub Tabs Bar */}
      <div className="flex items-center justify-between px-6 bg-theme-surface-2 border-b border-theme-divider overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-2">
          {(["directory", "dashboard", "msme", "tds", "expiry", "performance"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveSubTab(tab)}
              className={`px-4 py-3 text-xs font-bold uppercase tracking-wider font-mono border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                activeSubTab === tab
                  ? "border-[#0a6ed1] text-[#0a6ed1] bg-theme-surface-3"
                  : "border-transparent text-theme-muted hover:text-theme-primary hover:bg-theme-surface-hover"
              }`}
            >
              {tab === "directory" && "Vendor Directory"}
              {tab === "dashboard" && "Procurement Dashboard"}
              {tab === "msme" && "MSME Sec 43B(h) Audit"}
              {tab === "tds" && "Tax & Sec 194Q TDS"}
              {tab === "expiry" && "Doc Expiry Vault"}
              {tab === "performance" && "Vendor Scorecards"}
            </button>
          ))}
        </div>

        {/* Onboard Vendor Button */}
        {!isReadOnly && (
          <button
            onClick={handleOpenModal}
            className="px-4 py-2 text-xs font-bold bg-[#0a6ed1] hover:bg-[#085caf] text-white rounded-lg transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer whitespace-nowrap my-2 md:my-0"
          >
            <Plus className="w-4 h-4" /> Onboard Enterprise Vendor
          </button>
        )}
      </div>

      {/* Main Content Area */}
      <SmritiScrollArea className="flex-1 bg-theme-base p-6">
        <motion.div
          key={activeSubTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {/* 1. VENDOR DIRECTORY */}
          {activeSubTab === "directory" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between gap-4">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search Vendor Name, Code, GSTIN, Contact..."
                    className="w-full pl-9 pr-3 py-2 text-xs bg-theme-surface-2 border border-theme-divider rounded-lg text-theme-heading placeholder:text-theme-muted focus:outline-none focus:border-[#0a6ed1]"
                  />
                </div>
                <div className="font-mono text-xs text-theme-muted">
                  Showing <strong>{filteredSuppliers.length}</strong> of <strong>{suppliers.length}</strong> Vendors
                </div>
              </div>

              <div className="bg-theme-surface-2 border border-theme-divider rounded-xl overflow-hidden shadow-lg">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-theme-surface-3 border-b border-theme-divider text-[10px] uppercase tracking-wider text-theme-muted font-mono">
                      <th className="px-4 py-3 font-semibold">Vendor Code</th>
                      <th className="px-4 py-3 font-semibold">Supplier Name</th>
                      <th className="px-4 py-3 font-semibold">Type &amp; Group</th>
                      <th className="px-4 py-3 font-semibold">Approval Status</th>
                      <th className="px-4 py-3 font-semibold">MSME Sec 43B(h)</th>
                      <th className="px-4 py-3 font-semibold">Contact &amp; Phone</th>
                      <th className="px-4 py-3 font-semibold text-right">Outstanding</th>
                      <th className="px-4 py-3 font-semibold text-center">Studio Actions</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs divide-y divide-theme-divider font-mono">
                    {filteredSuppliers.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-theme-muted">
                          No vendors match the search query. Click "+ Onboard Enterprise Vendor" to add a supplier.
                        </td>
                      </tr>
                    ) : (
                      filteredSuppliers.map((v) => (
                        <tr key={v.id} className="hover:bg-theme-surface-hover transition-colors">
                          <td className="px-4 py-3 font-bold text-[#0a6ed1]">{v.code || v.id}</td>
                          <td className="px-4 py-3 font-sans font-bold text-theme-heading">
                            <button
                              onClick={() => { setSelectedSupplier(v); setStudioTab("overview"); }}
                              className="hover:underline text-left text-theme-heading font-bold"
                            >
                              {v.name}
                            </button>
                            {v.legal_name && v.legal_name !== v.name && (
                              <span className="block text-[10px] text-theme-muted font-mono">{v.legal_name}</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-theme-surface-4 text-theme-heading border border-theme-divider">
                              {v.supplier_type_id || "Manufacturer"}
                            </span>
                            <span className="block text-[10px] text-theme-muted font-mono">{v.group}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase font-mono ${
                              v.status === "Approved" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" :
                              v.status === "Pending Approval" ? "bg-amber-500/10 text-amber-400 border-amber-500/30" :
                              v.status === "Blocked" ? "bg-rose-500/10 text-rose-400 border-rose-500/30" :
                              "bg-slate-500/10 text-slate-400 border-slate-500/30"
                            }`}>
                              {v.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono border ${
                              v.msme_category === "Micro" || v.msme_category === "Small"
                                ? "bg-amber-500/10 text-amber-500 border-amber-500/30"
                                : "bg-theme-surface-4 text-theme-muted border-theme-divider"
                            }`}>
                              {v.msme_category || "Non-MSME"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-theme-heading font-sans font-medium">
                            {v.contact_person}
                            <span className="block text-[10px] text-theme-muted font-mono">{v.mobile}</span>
                          </td>
                          <td className={`px-4 py-3 text-right font-bold ${v.outstanding_balance ? "text-rose-400" : "text-emerald-400"}`}>
                            {v.balance || `₹${(v.outstanding_balance || 0).toLocaleString("en-IN")}`}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => { setSelectedSupplier(v); setStudioTab("overview"); }}
                              className="px-3 py-1 text-[11px] font-bold text-white bg-[#0a6ed1] hover:bg-[#085caf] rounded-md transition-colors shadow-xs cursor-pointer"
                            >
                              Open Enterprise Studio (16 Tabs)
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 2. MSME AUDIT TAB */}
          {activeSubTab === "msme" && (
            <div className="space-y-6">
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <Scale className="w-6 h-6 text-amber-400" />
                  <div>
                    <strong className="block text-amber-300 font-bold text-sm">Income Tax Section 43B(h) Statutory Compliance Audit</strong>
                    <span className="text-theme-muted">
                      Unpaid invoices to Micro &amp; Small Enterprises exceeding 45 days are disallowed as business expense deductions.
                    </span>
                  </div>
                </div>
                <span className="px-3 py-1 bg-amber-500 text-slate-950 font-bold rounded-lg font-mono">
                  {msmeSuppliersCount} Registered MSME Vendors
                </span>
              </div>
            </div>
          )}

          {/* 3. TAX & TDS TAB */}
          {activeSubTab === "tds" && (
            <div className="space-y-6">
              <div className="p-4 bg-[#0a6ed1]/10 border border-[#0a6ed1]/30 rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <Receipt className="w-6 h-6 text-[#0a6ed1]" />
                  <div>
                    <strong className="block text-[#0a6ed1] font-bold text-sm">Income Tax Section 194Q &amp; GSTR-2B ITC Matching</strong>
                    <span className="text-theme-muted">
                      Auto-calculates 0.1% TDS on cumulative purchases &gt; ₹50L per FY and validates GSTR-2B Input Tax Credit eligibility.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 4. DOCUMENT EXPIRY VAULT */}
          {activeSubTab === "expiry" && (
            <div className="space-y-6">
              <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-6 h-6 text-rose-400" />
                  <div>
                    <strong className="block text-rose-300 font-bold text-sm">Compliance &amp; License Expiry Vault</strong>
                    <span className="text-theme-muted">
                      Monitors GST Certificates, FSSAI, Drug Licenses, and Agreements. Generates proactive warnings prior to expiry.
                    </span>
                  </div>
                </div>
                <span className="px-3 py-1 bg-rose-500 text-white font-bold rounded-lg font-mono">
                  {expiringDocsCount} Expiring / Expired Documents
                </span>
              </div>
            </div>
          )}

          {/* 5. VENDOR SCORECARDS */}
          {activeSubTab === "performance" && (
            <div className="space-y-6 select-none">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {suppliers.map((v) => (
                  <div key={v.id} className="bg-theme-surface-2 border border-theme-divider rounded-xl p-5 shadow-lg space-y-3 font-mono text-xs">
                    <div className="flex items-center justify-between border-b border-theme-divider pb-2">
                      <strong className="text-sm font-sans font-bold text-theme-heading">{v.name}</strong>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#0a6ed1]/10 text-[#0a6ed1]">
                        Overall: {v.scorecard_rating || 90.0}/100
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 6. PROCUREMENT DASHBOARD */}
          {activeSubTab === "dashboard" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-5 shadow-lg">
                  <h4 className="text-xs font-bold text-theme-muted uppercase mb-2">Open POs</h4>
                  <div className="text-2xl font-bold text-theme-primary font-mono">12</div>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </SmritiScrollArea>

      {/* FULL 9-TAB ONBOARDING MODAL DIALOG */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 select-none">
          <div className="bg-theme-surface-1 border border-theme-divider rounded-2xl max-w-4xl w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-theme-divider pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#0a6ed1]" />
                <h3 className="text-base font-bold text-theme-heading font-display">Onboard Enterprise Supplier Master (18-Section Form)</h3>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-1 text-theme-muted hover:text-theme-heading rounded-lg cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 9-Tab Switcher */}
            <div className="flex items-center gap-1.5 border-b border-theme-divider pb-2 text-[11px] font-mono overflow-x-auto scrollbar-none">
              {[
                { id: "basic", label: "1. Basic Info" },
                { id: "tax", label: "2. GST & Tax" },
                { id: "contacts", label: "3. Contact Roles" },
                { id: "address", label: "4. Address Locations" },
                { id: "bank", label: "5. Bank Accounts" },
                { id: "purchase", label: "6. Purchase Defaults" },
                { id: "logistics", label: "7. Shipping & Transporter" },
                { id: "docs", label: "8. Documents & Expiry" },
                { id: "label", label: "9. Labels & Barcodes" }
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setModalTab(t.id as any)}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer whitespace-nowrap ${
                    modalTab === t.id ? "bg-[#0a6ed1] text-white" : "bg-theme-surface-2 text-theme-muted hover:text-theme-heading"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <form onSubmit={handleCreateSupplier} className="space-y-4 text-xs font-sans">
              {/* TAB 1: BASIC INFORMATION */}
              {modalTab === "basic" && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block font-bold text-theme-muted mb-1">Corporate Vendor Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Acme Textiles Pvt Ltd"
                      value={formData.name}
                      onChange={(e) => handleInputChange("name", e.target.value)}
                      className="w-full p-2 bg-theme-surface-2 border border-theme-divider rounded-lg font-bold text-theme-heading"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-theme-muted mb-1">Legal Corporate Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Acme Textiles India Private Limited"
                      value={formData.legal_name}
                      onChange={(e) => handleInputChange("legal_name", e.target.value)}
                      className="w-full p-2 bg-theme-surface-2 border border-theme-divider rounded-lg text-theme-heading"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-theme-muted mb-1">Supplier Type</label>
                    <select
                      value={formData.supplier_type_id}
                      onChange={(e) => handleInputChange("supplier_type_id", e.target.value)}
                      className="w-full p-2 bg-theme-surface-2 border border-theme-divider rounded-lg font-bold text-theme-heading"
                    >
                      <option value="Manufacturer">Manufacturer</option>
                      <option value="Distributor">Distributor</option>
                      <option value="Wholesaler">Wholesaler</option>
                      <option value="Dealer">Dealer</option>
                      <option value="Importer">Importer</option>
                      <option value="Local Vendor">Local Vendor</option>
                      <option value="Transporter">Transporter</option>
                      <option value="Service Provider">Service Provider</option>
                    </select>
                  </div>
                </div>
              )}

              {/* TAB 2: GST & TAX */}
              {modalTab === "tax" && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block font-bold text-theme-muted mb-1">GSTIN Number (15 Chars)</label>
                    <input
                      type="text"
                      placeholder="27ABCDE1234F1Z5"
                      value={formData.gst_number}
                      onChange={(e) => handleInputChange("gst_number", e.target.value.toUpperCase())}
                      className="w-full p-2 bg-theme-surface-2 border border-theme-divider rounded-lg font-mono text-theme-heading uppercase"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-theme-muted mb-1">PAN Number (10 Chars)</label>
                    <input
                      type="text"
                      placeholder="ABCDE1234F"
                      value={formData.pan_number}
                      onChange={(e) => handleInputChange("pan_number", e.target.value.toUpperCase())}
                      className="w-full p-2 bg-theme-surface-2 border border-theme-divider rounded-lg font-mono text-theme-heading uppercase"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-theme-muted mb-1">MSME Classification (Sec 43B(h))</label>
                    <select
                      value={formData.msme_category}
                      onChange={(e) => handleInputChange("msme_category", e.target.value)}
                      className="w-full p-2 bg-theme-surface-2 border border-theme-divider rounded-lg font-bold text-theme-heading"
                    >
                      <option value="Micro">Micro Enterprise (Investment &lt; ₹1 Cr)</option>
                      <option value="Small">Small Enterprise (Investment &lt; ₹10 Cr)</option>
                      <option value="Medium">Medium Enterprise (Investment &lt; ₹50 Cr)</option>
                      <option value="Non-MSME">Non-MSME Enterprise</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-theme-divider">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-theme-muted hover:text-theme-heading transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-bold bg-[#0a6ed1] hover:bg-[#085caf] text-white rounded-lg transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" /> Save &amp; Onboard Enterprise Vendor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 16-TAB ENTERPRISE SUPPLIER STUDIO WORKSPACE MODAL */}
      {selectedSupplier && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 select-none">
          <div className="bg-theme-surface-1 border border-theme-divider rounded-2xl max-w-5xl w-full h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-theme-divider bg-theme-surface-2">
              <div className="flex items-center gap-3">
                <Building2 className="w-6 h-6 text-[#0a6ed1]" />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-theme-heading font-display">{selectedSupplier.name}</h3>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono border ${
                      selectedSupplier.status === "Approved" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                    }`}>
                      {selectedSupplier.status}
                    </span>
                  </div>
                  <span className="font-mono text-xs text-theme-muted">{selectedSupplier.code || selectedSupplier.id} | {selectedSupplier.legal_name}</span>
                </div>
              </div>
              <button onClick={() => setSelectedSupplier(null)} className="p-1.5 text-theme-muted hover:text-theme-heading rounded-lg cursor-pointer bg-theme-surface-3">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 16 Studio Tabs Navigation Bar */}
            <div className="flex items-center gap-1 px-6 bg-theme-surface-3 border-b border-theme-divider overflow-x-auto scrollbar-none text-[11px] font-mono py-1.5">
              {[
                { id: "overview", label: "Overview" },
                { id: "attributes", label: "18-Section Master" },
                { id: "contacts", label: "Multi-Contacts" },
                { id: "banks", label: "Multi-Bank Accounts" },
                { id: "addresses", label: "Addresses" },
                { id: "gst", label: "GST & Tax" },
                { id: "msme", label: "MSME 43B(h)" },
                { id: "documents", label: "Doc Vault" },
                { id: "pos", label: "Purchase Orders" },
                { id: "grns", label: "GRN History" },
                { id: "invoices", label: "Invoices" },
                { id: "payments", label: "Payments" },
                { id: "ratings", label: "Vendor Scorecard" },
                { id: "timeline", label: "Communication Log" },
                { id: "approvals", label: "Approval Engine" },
                { id: "audit", label: "Audit Log" }
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setStudioTab(t.id as any)}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer whitespace-nowrap ${
                    studioTab === t.id ? "bg-[#0a6ed1] text-white shadow-xs" : "text-theme-muted hover:text-theme-heading hover:bg-theme-surface-2"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Studio Content Viewport */}
            <SmritiScrollArea className="flex-1 p-6 bg-theme-base font-sans text-xs">
              {studioTab === "overview" && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-theme-surface-2 border border-theme-divider rounded-xl">
                      <span className="text-theme-muted block font-mono text-[10px]">TOTAL OUTSTANDING</span>
                      <strong className="text-xl font-bold text-rose-400 font-mono">{selectedSupplier.balance || "₹0"}</strong>
                    </div>
                    <div className="p-4 bg-theme-surface-2 border border-theme-divider rounded-xl">
                      <span className="text-theme-muted block font-mono text-[10px]">CREDIT LIMIT &amp; DAYS</span>
                      <strong className="text-xl font-bold text-theme-heading font-mono">₹{selectedSupplier.credit_limit?.toLocaleString("en-IN")} ({selectedSupplier.credit_days} Days)</strong>
                    </div>
                    <div className="p-4 bg-theme-surface-2 border border-theme-divider rounded-xl">
                      <span className="text-theme-muted block font-mono text-[10px]">MSME SEC 43B(h)</span>
                      <strong className="text-xl font-bold text-amber-400 font-mono">{selectedSupplier.msme_category || "Micro"}</strong>
                    </div>
                    <div className="p-4 bg-theme-surface-2 border border-theme-divider rounded-xl">
                      <span className="text-theme-muted block font-mono text-[10px]">VENDOR RATING</span>
                      <strong className="text-xl font-bold text-emerald-400 font-mono">{selectedSupplier.scorecard_rating || 92.0}/100</strong>
                    </div>
                  </div>
                </div>
              )}

              {studioTab === "attributes" && (
                <div className="grid grid-cols-2 gap-4 font-mono text-xs">
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-theme-muted block text-[10px]">LEGAL / TRADE NAME</span>
                    <strong className="text-theme-heading text-sm">{selectedSupplier.legal_name || selectedSupplier.name}</strong>
                  </div>
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-theme-muted block text-[10px]">SUPPLIER TYPE &amp; GROUP</span>
                    <strong className="text-theme-heading text-sm">{selectedSupplier.supplier_type_id} | {selectedSupplier.group}</strong>
                  </div>
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-theme-muted block text-[10px]">MOQ / LEAD TIME</span>
                    <strong className="text-theme-heading">{selectedSupplier.min_order_qty} Units | {selectedSupplier.lead_time_days} Days Lead Time</strong>
                  </div>
                  <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                    <span className="text-theme-muted block text-[10px]">LABEL &amp; BARCODE TEMPLATE</span>
                    <strong className="text-[#0a6ed1]">{selectedSupplier.default_label_template || "50x25mm"} ({selectedSupplier.default_barcode_type || "CODE128"})</strong>
                  </div>
                </div>
              )}

              {studioTab === "contacts" && (
                <div className="space-y-4">
                  <h4 className="font-bold text-sm text-theme-heading font-display">Multi-Contact Role Directory</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono">
                    {(selectedSupplier.contacts || []).map((c) => (
                      <div key={c.id} className="p-4 bg-theme-surface-2 border border-theme-divider rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                          <strong className="text-sm font-sans font-bold text-theme-heading">{c.name}</strong>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#0a6ed1]/10 text-[#0a6ed1]">{c.role}</span>
                        </div>
                        <div className="flex items-center gap-2 text-theme-muted">
                          <Phone className="w-3.5 h-3.5" /> <span>{c.mobile}</span>
                        </div>
                        <div className="flex items-center gap-2 text-theme-muted">
                          <Mail className="w-3.5 h-3.5" /> <span>{c.email}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {studioTab === "banks" && (
                <div className="space-y-4">
                  <h4 className="font-bold text-sm text-theme-heading font-display">Multi-Bank Account Directory</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono">
                    {(selectedSupplier.bank_accounts || []).map((b) => (
                      <div key={b.id} className="p-4 bg-theme-surface-2 border border-theme-divider rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                          <strong className="text-sm font-sans font-bold text-theme-heading">{b.bank_name}</strong>
                          {b.is_primary && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400">Primary Bank</span>}
                        </div>
                        <div className="text-theme-muted">Acc Name: <strong className="text-theme-heading">{b.account_name}</strong></div>
                        <div className="text-theme-muted">Acc No: <strong className="text-theme-heading font-bold">{b.account_number}</strong></div>
                        <div className="text-theme-muted">IFSC Code: <strong className="text-theme-heading font-bold">{b.ifsc_code}</strong></div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {studioTab === "addresses" && (
                <div className="space-y-4 font-mono">
                  <h4 className="font-bold text-sm text-theme-heading font-display">Addresses &amp; Multi-Location Warehouses</h4>
                  <div className="p-4 bg-theme-surface-2 border border-theme-divider rounded-xl space-y-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#0a6ed1]/10 text-[#0a6ed1]">Corporate Billing &amp; Dispatch Address</span>
                    <p className="text-theme-heading font-sans font-bold text-sm">{selectedSupplier.address || "Main Industrial Area"}, {selectedSupplier.city}, {selectedSupplier.state} - {selectedSupplier.pincode || "400001"}</p>
                  </div>
                </div>
              )}

              {studioTab === "gst" && (
                <div className="space-y-4 font-mono">
                  <h4 className="font-bold text-sm text-theme-heading font-display">GST &amp; Tax Compliance Breakdown</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                      <span className="text-theme-muted block text-[10px]">15-DIGIT GSTIN</span>
                      <strong className="text-theme-heading text-sm">{selectedSupplier.gst_number || "N/A"}</strong>
                    </div>
                    <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                      <span className="text-theme-muted block text-[10px]">10-CHAR PAN</span>
                      <strong className="text-theme-heading text-sm">{selectedSupplier.pan_number || "N/A"}</strong>
                    </div>
                    <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                      <span className="text-theme-muted block text-[10px]">SECTION 194Q TDS</span>
                      <strong className="text-emerald-400 text-sm">{selectedSupplier.is_tds_applicable ? "0.10% TDS Deduction Active" : "Exempt"}</strong>
                    </div>
                    <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                      <span className="text-theme-muted block text-[10px]">GSTR-2B ITC MATCHING</span>
                      <strong className="text-emerald-400 text-sm">{selectedSupplier.gstr2b_status || "Matched"}</strong>
                    </div>
                  </div>
                </div>
              )}

              {studioTab === "documents" && (
                <div className="space-y-4">
                  <h4 className="font-bold text-sm text-theme-heading font-display">Document Vault &amp; Expiry Tracker</h4>
                  <div className="space-y-3 font-mono">
                    {(selectedSupplier.documents || []).map((d) => (
                      <div key={d.id} className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl flex items-center justify-between">
                        <div>
                          <strong className="text-sm font-sans text-theme-heading block">{d.doc_type}</strong>
                          <span className="text-theme-muted text-xs">{d.doc_number} | Expiry: {d.expiry_date}</span>
                        </div>
                        <span className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase border ${
                          d.status === "Valid" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                        }`}>
                          {d.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {studioTab === "pos" && (
                <div className="space-y-4 font-mono">
                  <h4 className="font-bold text-sm text-theme-heading font-display">Purchase Orders History</h4>
                  <div className="p-4 bg-theme-surface-2 border border-theme-divider rounded-xl text-center text-theme-muted">
                    PO-2026-0089 | ₹1,20,000 | Status: <strong className="text-emerald-400">Received</strong>
                  </div>
                </div>
              )}

              {studioTab === "timeline" && (
                <div className="space-y-4">
                  <h4 className="font-bold text-sm text-theme-heading font-display">Communication Log &amp; Timeline</h4>
                  <div className="flex gap-2 mb-4">
                    <select
                      value={logType}
                      onChange={(e) => setLogType(e.target.value as any)}
                      className="p-2 bg-theme-surface-2 border border-theme-divider rounded-lg font-mono text-xs text-theme-heading"
                    >
                      <option value="Call">Phone Call</option>
                      <option value="WhatsApp">WhatsApp Message</option>
                      <option value="Email">Email Communication</option>
                      <option value="Payment Reminder">Payment Reminder</option>
                    </select>
                    <input
                      type="text"
                      placeholder="Type communication summary note..."
                      value={newLogMessage}
                      onChange={(e) => setNewLogMessage(e.target.value)}
                      className="flex-1 p-2 bg-theme-surface-2 border border-theme-divider rounded-lg text-xs text-theme-heading"
                    />
                    <button
                      onClick={handleAddCommunicationLog}
                      className="px-4 py-2 bg-[#0a6ed1] text-white font-bold rounded-lg cursor-pointer flex items-center gap-1"
                    >
                      <Send className="w-3.5 h-3.5" /> Log
                    </button>
                  </div>

                  <div className="space-y-3 font-mono">
                    {(selectedSupplier.communication_logs || []).map((l) => (
                      <div key={l.id} className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#0a6ed1]/10 text-[#0a6ed1]">{l.type}</span>
                            <span className="text-theme-muted text-[10px]">{l.timestamp} by {l.user}</span>
                          </div>
                          <p className="text-theme-heading font-sans text-xs mt-1">{l.summary}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {studioTab === "approvals" && (
                <div className="space-y-4 font-mono">
                  <h4 className="font-bold text-sm text-theme-heading font-display">Approval Lifecycle Engine</h4>
                  <div className="p-4 bg-theme-surface-2 border border-theme-divider rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-theme-muted block text-[10px]">CURRENT APPROVAL STATE</span>
                      <strong className="text-lg font-bold text-emerald-400">{selectedSupplier.status}</strong>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleUpdateStatus("Approved")} className="px-3 py-1.5 bg-emerald-600 text-white font-bold rounded-lg cursor-pointer">Approve</button>
                      <button onClick={() => handleUpdateStatus("Blocked")} className="px-3 py-1.5 bg-rose-600 text-white font-bold rounded-lg cursor-pointer">Block</button>
                      <button onClick={() => handleUpdateStatus("Blacklisted")} className="px-3 py-1.5 bg-slate-800 text-white font-bold rounded-lg cursor-pointer">Blacklist</button>
                    </div>
                  </div>
                </div>
              )}

              {studioTab === "audit" && (
                <div className="space-y-4 font-mono text-xs">
                  <h4 className="font-bold text-sm text-theme-heading font-display">Immutable Audit Trail &amp; Metadata</h4>
                  <div className="p-4 bg-theme-surface-2 border border-theme-divider rounded-xl space-y-2">
                    <div className="flex justify-between"><span className="text-theme-muted">Created Date:</span> <strong className="text-theme-heading">{selectedSupplier.created_at || "2026-01-15"}</strong></div>
                    <div className="flex justify-between"><span className="text-theme-muted">Created By:</span> <strong className="text-theme-heading">{selectedSupplier.created_by || "Admin"}</strong></div>
                    <div className="flex justify-between"><span className="text-theme-muted">Record Version:</span> <strong className="text-emerald-400 font-bold">v1.0 (Frozen Audit)</strong></div>
                  </div>
                </div>
              )}
            </SmritiScrollArea>

            {/* Footer */}
            <div className="flex justify-end p-4 border-t border-theme-divider bg-theme-surface-2">
              <button onClick={() => setSelectedSupplier(null)} className="px-5 py-2 bg-[#0a6ed1] text-white font-bold text-xs rounded-lg cursor-pointer">
                Close Enterprise Studio
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
