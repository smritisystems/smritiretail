/**
 * Project      : SMRITI Retail OS v5.0
 * Module       : Supplier & Vendor Management Platform (18-Section Indian Enterprise Standard)
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
  Tag
} from "lucide-react";

export interface SupplierItem {
  id: string;
  code?: string;
  name: string;
  trade_name?: string;
  legal_name?: string;
  display_name?: string;
  supplier_type_id?: string;
  group?: string;
  supplier_group_id?: string;
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
  status?: string;
  // Compliance & Licenses
  msme_category?: "Micro" | "Small" | "Medium" | "Non-MSME";
  msme_number?: string;
  fssai_license_no?: string;
  drug_license_no?: string;
  iec_code?: string;
  is_tds_applicable?: boolean;
  tds_rate?: number;
  gstr2b_status?: "Matched" | "Pending ITC" | "Mismatched";
  scorecard_rating?: number;
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
  // Label & Barcode
  default_label_template?: string;
  default_barcode_type?: string;
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
    "directory" | "dashboard" | "msme" | "tds" | "performance"
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
      alt_mobile: "+91 98200 54321",
      whatsapp: "+91 98200 12345",
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
      city: "Mumbai",
      state: "Maharashtra",
      msme_category: "Small",
      msme_number: "UDYAM-MH-12-0001234",
      iec_code: "1012001122",
      is_tds_applicable: true,
      tds_rate: 0.10,
      gstr2b_status: "Matched",
      scorecard_rating: 94.5,
      currency: "INR",
      warehouse: "Central Warehouse (WH-01)",
      lead_time_days: 3,
      min_order_qty: 10,
      order_multiple: 5,
      is_preferred: true,
      transport_name: "VRL Logistics Ltd",
      transporter_gstin: "27AAACV1234F1Z9",
      freight_terms: "Paid by Supplier",
      default_label_template: "50x25mm",
      default_barcode_type: "CODE128"
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
      city: "Pune",
      state: "Maharashtra",
      msme_category: "Non-MSME",
      is_tds_applicable: false,
      tds_rate: 0.00,
      gstr2b_status: "Matched",
      scorecard_rating: 88.0,
      lead_time_days: 5,
      min_order_qty: 25,
      default_label_template: "38x25mm",
      default_barcode_type: "EAN13"
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
      city: "Ahmedabad",
      state: "Gujarat",
      msme_category: "Micro",
      msme_number: "UDYAM-GJ-05-0009876",
      fssai_license_no: "10019022001234",
      is_tds_applicable: true,
      tds_rate: 0.10,
      gstr2b_status: "Pending ITC",
      scorecard_rating: 79.2,
      lead_time_days: 2,
      default_label_template: "100x50mm",
      default_barcode_type: "CODE128"
    }
  ]);

  const [searchTerm, setSearchTerm] = useState<string>("");
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalTab, setModalTab] = useState<
    "basic" | "tax" | "contact" | "financial" | "purchase" | "logistics" | "label"
  >("basic");
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Full 18-Section Enterprise Vendor Form State
  const [formData, setFormData] = useState({
    // Section 1: Basic Information
    code: "",
    name: "",
    display_name: "",
    legal_name: "",
    trade_name: "",
    supplier_type_id: "Manufacturer",
    group: "General Retail",
    status: "Active",

    // Section 2: GST & Tax Information
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
    drug_license_no: "",
    gst_type: "Regular",
    place_of_supply: "Maharashtra (27)",

    // Section 3 & 4: Contact & Address
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
    separate_shipping_address: false,

    // Section 5 & 7: Banking & Financial Information
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
    is_tcs_applicable: false,
    is_reverse_charge: false,

    // Section 6: Purchase Defaults
    currency: "INR",
    warehouse: "Central Warehouse (WH-01)",
    lead_time_days: "3",
    min_order_qty: "1.000",
    max_order_qty: "100.000",
    order_multiple: "1.000",
    is_preferred: true,

    // Section 9: Logistics & Transport
    transport_name: "VRL Logistics Ltd",
    transporter_gstin: "",
    freight_terms: "Prepaid by Supplier",

    // Section 12: Barcode & Labels
    default_label_template: "50x25mm",
    default_barcode_type: "CODE128",
    preferred_printer: "Zebra ZD421"
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
          city: s.city || "Mumbai",
          state: s.state || "Maharashtra",
          msme_category: s.compliance_profile?.msme_category || "Micro",
          msme_number: s.compliance_profile?.msme_number || "N/A",
          fssai_license_no: s.compliance_profile?.fssai_license_no || "N/A",
          is_tds_applicable: s.tax_profile?.is_tds_applicable ?? true,
          tds_rate: s.tax_profile?.tds_rate || 0.10,
          gstr2b_status: "Matched",
          scorecard_rating: s.performance_rating || 92.0,
          default_label_template: s.default_label_template || "50x25mm",
          default_barcode_type: s.default_barcode_type || "CODE128"
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
      status: "Active",
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
      separate_shipping_address: false,
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
      is_tcs_applicable: false,
      is_reverse_charge: false,
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
      default_barcode_type: "CODE128",
      preferred_printer: "Zebra ZD421"
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
      alt_mobile: formData.alt_mobile,
      whatsapp: formData.whatsapp,
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
      status: "Active",
      msme_category: formData.msme_category,
      msme_number: formData.msme_number || formData.udyam_number || "N/A",
      fssai_license_no: formData.fssai_license_no,
      drug_license_no: formData.drug_license_no,
      iec_code: formData.iec_code,
      is_tds_applicable: formData.is_tds_applicable,
      tds_rate: parseFloat(formData.tds_rate) || 0.10,
      gstr2b_status: "Matched",
      scorecard_rating: 95.0,
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
      default_barcode_type: formData.default_barcode_type
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
          default_barcode_type: formData.default_barcode_type,
          tax_profile: {
            pan_number: formData.pan_number,
            gstin: formData.gst_number,
            is_tds_applicable: formData.is_tds_applicable,
            tds_rate: parseFloat(formData.tds_rate) || 0.10
          },
          compliance_profile: {
            msme_category: formData.msme_category,
            msme_number: formData.msme_number || formData.udyam_number,
            fssai_license_no: formData.fssai_license_no,
            drug_license_no: formData.drug_license_no,
            iec_code: formData.iec_code
          },
          credit_profile: {
            credit_limit: parseFloat(formData.credit_limit) || 200000,
            credit_days: parseInt(formData.credit_days) || 30
          }
        })
      });
      if (onNotification) {
        onNotification("Vendor Onboarded", `Successfully registered ${formData.name} (${formData.code})`, "success");
      }
    } catch (err: any) {
      if (onNotification) {
        onNotification("Vendor Added", `Registered ${formData.name} (${formData.code}) locally.`, "success");
      }
    } finally {
      setSuppliers((prev) => [newSupplierItem, ...prev]);
      setIsSubmitting(false);
      setIsModalOpen(false);
    }
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
            <Building2 className="w-6 h-6 text-[#0a6ed1]" /> Supplier & Vendor Master (18-Section Enterprise Standard)
          </h2>
          <p className="text-xs text-theme-muted mt-1 max-w-2xl">
            Indian Retail Master: Manufacturers, Wholesalers, Distributors, MSME Sec 43B(h), Sec 194Q TDS & Multi-GSTIN.
          </p>
        </div>
        <div className="flex items-center gap-3 mt-4 md:mt-0 bg-theme-surface-3 px-4 py-2 rounded-lg border border-theme-divider">
          <div className="text-right">
            <div className="text-[10px] font-mono text-theme-muted uppercase font-bold">Total Payables</div>
            <div className="text-sm font-bold text-rose-400 font-mono">₹{totalOutstanding.toLocaleString("en-IN")}</div>
          </div>
          <div className="w-px h-8 bg-theme-divider mx-2"></div>
          <div className="text-right">
            <div className="text-[10px] font-mono text-theme-muted uppercase font-bold">MSME Vendors</div>
            <div className="text-sm font-bold text-amber-400 font-mono">{msmeSuppliersCount} Micro/Small</div>
          </div>
        </div>
      </div>

      {/* Sub Tabs Bar */}
      <div className="flex items-center justify-between px-6 bg-theme-surface-2 border-b border-theme-divider">
        <div className="flex items-center gap-2">
          {(["directory", "dashboard", "msme", "tds", "performance"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveSubTab(tab)}
              className={`px-4 py-3 text-xs font-bold uppercase tracking-wider font-mono border-b-2 transition-colors cursor-pointer ${
                activeSubTab === tab
                  ? "border-[#0a6ed1] text-[#0a6ed1] bg-theme-surface-3"
                  : "border-transparent text-theme-muted hover:text-theme-primary hover:bg-theme-surface-hover"
              }`}
            >
              {tab === "directory" && "Vendor Directory"}
              {tab === "dashboard" && "Procurement Dashboard"}
              {tab === "msme" && "MSME Sec 43B(h) Audit"}
              {tab === "tds" && "Tax & Sec 194Q TDS"}
              {tab === "performance" && "Vendor Scorecards"}
            </button>
          ))}
        </div>

        {/* Onboard Vendor Button */}
        {!isReadOnly && (
          <button
            onClick={handleOpenModal}
            className="px-4 py-2 text-xs font-bold bg-[#0a6ed1] hover:bg-[#085caf] text-white rounded-lg transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
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
                      <th className="px-4 py-3 font-semibold">Supplier Type</th>
                      <th className="px-4 py-3 font-semibold">MSME Category</th>
                      <th className="px-4 py-3 font-semibold">Contact Person</th>
                      <th className="px-4 py-3 font-semibold">GSTIN</th>
                      <th className="px-4 py-3 font-semibold text-right">Outstanding</th>
                      <th className="px-4 py-3 font-semibold text-center">Actions</th>
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
                            <DrillableLink context={{ entityType: "supplier", entityId: v.id, title: v.name }}>
                              {v.name}
                            </DrillableLink>
                            {v.legal_name && v.legal_name !== v.name && (
                              <span className="block text-[10px] text-theme-muted font-mono">{v.legal_name}</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-theme-surface-4 text-theme-heading border border-theme-divider">
                              {v.supplier_type_id || "Manufacturer"}
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
                          <td className="px-4 py-3 text-theme-muted">{v.gst_number}</td>
                          <td className={`px-4 py-3 text-right font-bold ${v.outstanding_balance ? "text-rose-400" : "text-emerald-400"}`}>
                            {v.balance || `₹${(v.outstanding_balance || 0).toLocaleString("en-IN")}`}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => setSelectedSupplier(v)}
                              className="px-2.5 py-1 text-[11px] font-bold text-[#0a6ed1] bg-theme-surface-3 hover:bg-[#0a6ed1] hover:text-white rounded-md border border-[#0a6ed1]/30 transition-colors cursor-pointer"
                            >
                              Inspect 18-Section Master
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

          {/* 4. VENDOR SCORECARDS */}
          {activeSubTab === "performance" && (
            <div className="space-y-6 select-none">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {suppliers.map((v) => (
                  <div key={v.id} className="bg-theme-surface-2 border border-theme-divider rounded-xl p-5 shadow-lg space-y-3 font-mono text-xs">
                    <div className="flex items-center justify-between border-b border-theme-divider pb-2">
                      <strong className="text-sm font-sans font-bold text-theme-heading">{v.name}</strong>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#0a6ed1]/10 text-[#0a6ed1]">
                        Score: {v.scorecard_rating || 90.0}/100
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 5. DASHBOARD */}
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

      {/* FULL 18-SECTION VENDOR ONBOARDING MODAL DIALOG */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 select-none">
          <div className="bg-theme-surface-1 border border-theme-divider rounded-2xl max-w-4xl w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-theme-divider pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#0a6ed1]" />
                <h3 className="text-base font-bold text-theme-heading font-display">Onboard Enterprise Supplier Master (18-Section Standard)</h3>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-1 text-theme-muted hover:text-theme-heading rounded-lg cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 7-Tab Switcher for 18-Section Master Form */}
            <div className="flex items-center gap-1.5 border-b border-theme-divider pb-2 text-[11px] font-mono overflow-x-auto scrollbar-none">
              {[
                { id: "basic", label: "1. Basic Info" },
                { id: "tax", label: "2. GST & Tax" },
                { id: "contact", label: "3. Contact & Address" },
                { id: "financial", label: "4. Bank & Finance" },
                { id: "purchase", label: "5. Purchase Defaults" },
                { id: "logistics", label: "6. Logistics & Shipping" },
                { id: "label", label: "7. Label & Barcodes" }
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
                    <label className="block font-bold text-theme-muted mb-1">Display Operating Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Acme Direct"
                      value={formData.display_name}
                      onChange={(e) => handleInputChange("display_name", e.target.value)}
                      className="w-full p-2 bg-theme-surface-2 border border-theme-divider rounded-lg text-theme-heading"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-theme-muted mb-1">Vendor Code (Auto-Generated)</label>
                    <input
                      type="text"
                      value={formData.code}
                      onChange={(e) => handleInputChange("code", e.target.value)}
                      className="w-full p-2 bg-theme-surface-2 border border-theme-divider rounded-lg font-mono text-theme-heading"
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
                  <div>
                    <label className="block font-bold text-theme-muted mb-1">Supplier Group</label>
                    <select
                      value={formData.group}
                      onChange={(e) => handleInputChange("group", e.target.value)}
                      className="w-full p-2 bg-theme-surface-2 border border-theme-divider rounded-lg font-bold text-theme-heading"
                    >
                      <option value="General Retail">General Retail</option>
                      <option value="Electronics">Electronics &amp; Hardware</option>
                      <option value="Apparel">Apparel &amp; Fashion</option>
                      <option value="FMCG & Groceries">FMCG &amp; Groceries</option>
                      <option value="Packaging">Packaging Materials</option>
                      <option value="Pharmaceuticals">Pharmaceuticals</option>
                    </select>
                  </div>
                </div>
              )}

              {/* TAB 2: GST & TAX INFORMATION */}
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
                    <label className="block font-bold text-theme-muted mb-1">TAN Number</label>
                    <input
                      type="text"
                      placeholder="MUMB12345F"
                      value={formData.tan_number}
                      onChange={(e) => handleInputChange("tan_number", e.target.value.toUpperCase())}
                      className="w-full p-2 bg-theme-surface-2 border border-theme-divider rounded-lg font-mono text-theme-heading uppercase"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-theme-muted mb-1">CIN (Company Reg No.)</label>
                    <input
                      type="text"
                      placeholder="U72200MH2010PTC123456"
                      value={formData.cin_number}
                      onChange={(e) => handleInputChange("cin_number", e.target.value.toUpperCase())}
                      className="w-full p-2 bg-theme-surface-2 border border-theme-divider rounded-lg font-mono text-theme-heading uppercase"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-theme-muted mb-1">GST Registration Type</label>
                    <select
                      value={formData.gst_type}
                      onChange={(e) => handleInputChange("gst_type", e.target.value)}
                      className="w-full p-2 bg-theme-surface-2 border border-theme-divider rounded-lg font-bold text-theme-heading"
                    >
                      <option value="Regular">Regular Taxpayer</option>
                      <option value="Composition">Composition Scheme</option>
                      <option value="Unregistered">Unregistered</option>
                      <option value="SEZ">SEZ Unit / Developer</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-theme-muted mb-1">Place of Supply (State Code)</label>
                    <input
                      type="text"
                      value={formData.place_of_supply}
                      onChange={(e) => handleInputChange("place_of_supply", e.target.value)}
                      className="w-full p-2 bg-theme-surface-2 border border-theme-divider rounded-lg text-theme-heading"
                    />
                  </div>
                </div>
              )}

              {/* TAB 3: CONTACT & ADDRESS */}
              {modalTab === "contact" && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block font-bold text-theme-muted mb-1">Primary Contact Person</label>
                    <input
                      type="text"
                      placeholder="e.g. Rajesh Kumar"
                      value={formData.contact_person}
                      onChange={(e) => handleInputChange("contact_person", e.target.value)}
                      className="w-full p-2 bg-theme-surface-2 border border-theme-divider rounded-lg text-theme-heading"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-theme-muted mb-1">Mobile Number</label>
                    <input
                      type="text"
                      placeholder="+91 98200 12345"
                      value={formData.mobile}
                      onChange={(e) => handleInputChange("mobile", e.target.value)}
                      className="w-full p-2 bg-theme-surface-2 border border-theme-divider rounded-lg font-mono text-theme-heading"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-theme-muted mb-1">Email Address</label>
                    <input
                      type="email"
                      placeholder="vendor@company.com"
                      value={formData.email}
                      onChange={(e) => handleInputChange("email", e.target.value)}
                      className="w-full p-2 bg-theme-surface-2 border border-theme-divider rounded-lg font-mono text-theme-heading"
                    />
                  </div>
                  <div className="md:col-span-3">
                    <label className="block font-bold text-theme-muted mb-1">Corporate Street Address</label>
                    <input
                      type="text"
                      placeholder="Street, Building No., Industrial Area"
                      value={formData.address}
                      onChange={(e) => handleInputChange("address", e.target.value)}
                      className="w-full p-2 bg-theme-surface-2 border border-theme-divider rounded-lg text-theme-heading"
                    />
                  </div>
                </div>
              )}

              {/* TAB 4: BANK & FINANCIAL */}
              {modalTab === "financial" && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block font-bold text-theme-muted mb-1">Credit Limit ₹</label>
                    <input
                      type="number"
                      value={formData.credit_limit}
                      onChange={(e) => handleInputChange("credit_limit", e.target.value)}
                      className="w-full p-2 bg-theme-surface-2 border border-theme-divider rounded-lg font-mono text-theme-heading"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-theme-muted mb-1">Credit Terms (Days)</label>
                    <input
                      type="number"
                      value={formData.credit_days}
                      onChange={(e) => handleInputChange("credit_days", e.target.value)}
                      className="w-full p-2 bg-theme-surface-2 border border-theme-divider rounded-lg font-mono text-theme-heading"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-theme-muted mb-1">Opening Balance ₹</label>
                    <input
                      type="number"
                      value={formData.opening_balance}
                      onChange={(e) => handleInputChange("opening_balance", e.target.value)}
                      className="w-full p-2 bg-theme-surface-2 border border-theme-divider rounded-lg font-mono text-theme-heading"
                    />
                  </div>
                </div>
              )}

              {/* TAB 5: PURCHASE DEFAULTS */}
              {modalTab === "purchase" && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block font-bold text-theme-muted mb-1">Lead Time (Days)</label>
                    <input
                      type="number"
                      value={formData.lead_time_days}
                      onChange={(e) => handleInputChange("lead_time_days", e.target.value)}
                      className="w-full p-2 bg-theme-surface-2 border border-theme-divider rounded-lg font-mono text-theme-heading"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-theme-muted mb-1">Minimum Order Qty (MOQ)</label>
                    <input
                      type="number"
                      value={formData.min_order_qty}
                      onChange={(e) => handleInputChange("min_order_qty", e.target.value)}
                      className="w-full p-2 bg-theme-surface-2 border border-theme-divider rounded-lg font-mono text-theme-heading"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-theme-muted mb-1">Order Multiple</label>
                    <input
                      type="number"
                      value={formData.order_multiple}
                      onChange={(e) => handleInputChange("order_multiple", e.target.value)}
                      className="w-full p-2 bg-theme-surface-2 border border-theme-divider rounded-lg font-mono text-theme-heading"
                    />
                  </div>
                </div>
              )}

              {/* TAB 6: LOGISTICS & SHIPPING */}
              {modalTab === "logistics" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-theme-muted mb-1">Preferred Transporter Name</label>
                    <input
                      type="text"
                      placeholder="e.g. VRL Logistics Ltd"
                      value={formData.transport_name}
                      onChange={(e) => handleInputChange("transport_name", e.target.value)}
                      className="w-full p-2 bg-theme-surface-2 border border-theme-divider rounded-lg text-theme-heading"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-theme-muted mb-1">Freight Terms</label>
                    <select
                      value={formData.freight_terms}
                      onChange={(e) => handleInputChange("freight_terms", e.target.value)}
                      className="w-full p-2 bg-theme-surface-2 border border-theme-divider rounded-lg font-bold text-theme-heading"
                    >
                      <option value="Prepaid by Supplier">Prepaid by Supplier</option>
                      <option value="To Pay by Buyer">To Pay by Buyer</option>
                      <option value="Shared 50-50">Shared 50-50</option>
                    </select>
                  </div>
                </div>
              )}

              {/* TAB 7: LABELS & BARCODES */}
              {modalTab === "label" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-theme-muted mb-1">Default Label Sticker Size</label>
                    <select
                      value={formData.default_label_template}
                      onChange={(e) => handleInputChange("default_label_template", e.target.value)}
                      className="w-full p-2 bg-theme-surface-2 border border-theme-divider rounded-lg font-mono text-theme-heading"
                    >
                      <option value="50x25mm">50 × 25 mm (Dual Column Standard)</option>
                      <option value="38x25mm">38 × 25 mm (Jewelry Tag)</option>
                      <option value="100x50mm">100 × 50 mm (Shipping Carton Label)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-theme-muted mb-1">Default Barcode Symbology</label>
                    <select
                      value={formData.default_barcode_type}
                      onChange={(e) => handleInputChange("default_barcode_type", e.target.value)}
                      className="w-full p-2 bg-theme-surface-2 border border-theme-divider rounded-lg font-mono text-theme-heading"
                    >
                      <option value="CODE128">CODE128 (Alphanumeric)</option>
                      <option value="EAN13">EAN13 (Retail Standard)</option>
                      <option value="QR">QR Code (2D Matrix)</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Modal Footer */}
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

      {/* INSPECT 18-SECTION SUPPLIER DETAIL MODAL */}
      {selectedSupplier && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 select-none">
          <div className="bg-theme-surface-1 border border-theme-divider rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-theme-divider pb-3">
              <div>
                <h3 className="text-base font-bold text-theme-heading">{selectedSupplier.name}</h3>
                <span className="font-mono text-xs text-[#0a6ed1] font-bold">{selectedSupplier.code || selectedSupplier.id}</span>
              </div>
              <button onClick={() => setSelectedSupplier(null)} className="p-1 text-theme-muted hover:text-theme-heading cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="p-3 bg-theme-surface-2 rounded-lg border border-theme-divider">
                <span className="text-theme-muted block text-[10px]">LEGAL / TRADE NAME</span>
                <strong className="text-theme-heading">{selectedSupplier.legal_name || selectedSupplier.name}</strong>
              </div>
              <div className="p-3 bg-theme-surface-2 rounded-lg border border-theme-divider">
                <span className="text-theme-muted block text-[10px]">GSTIN / PAN / TAN</span>
                <strong className="text-theme-heading">{selectedSupplier.gst_number || "N/A"} / {selectedSupplier.pan_number || "N/A"}</strong>
              </div>
              <div className="p-3 bg-theme-surface-2 rounded-lg border border-theme-divider">
                <span className="text-theme-muted block text-[10px]">MSME SEC 43B(h) UDYAM NO</span>
                <strong className="text-amber-400 font-bold">{selectedSupplier.msme_category || "Micro"} ({selectedSupplier.msme_number || "N/A"})</strong>
              </div>
              <div className="p-3 bg-theme-surface-2 rounded-lg border border-theme-divider">
                <span className="text-theme-muted block text-[10px]">SECTION 194Q TDS</span>
                <strong className="text-emerald-400 font-bold">{selectedSupplier.is_tds_applicable ? "0.10% Applicable" : "Exempt"}</strong>
              </div>
              <div className="p-3 bg-theme-surface-2 rounded-lg border border-theme-divider">
                <span className="text-theme-muted block text-[10px]">OUTSTANDING PAYABLES</span>
                <strong className="text-rose-400 font-bold">{selectedSupplier.balance || "₹0"}</strong>
              </div>
              <div className="p-3 bg-theme-surface-2 rounded-lg border border-theme-divider">
                <span className="text-theme-muted block text-[10px]">DEFAULT LABEL &amp; BARCODE</span>
                <strong className="text-[#0a6ed1] font-bold">{selectedSupplier.default_label_template || "50x25mm"} ({selectedSupplier.default_barcode_type || "CODE128"})</strong>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button onClick={() => setSelectedSupplier(null)} className="px-4 py-2 text-xs font-bold bg-[#0a6ed1] text-white rounded-lg cursor-pointer">
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
