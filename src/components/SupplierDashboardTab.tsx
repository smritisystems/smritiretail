/**
 * Project      : SMRITI Retail OS v5.0
 * Module       : Supplier & Vendor Management Platform
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
  Briefcase
} from "lucide-react";

export interface SupplierItem {
  id: string;
  code?: string;
  name: string;
  trade_name?: string;
  group?: string;
  supplier_group_id?: string;
  contact_person?: string;
  mobile?: string;
  email?: string;
  gst_number?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  outstanding_balance?: number;
  balance?: string;
  credit_limit?: number;
  credit_days?: number;
  status?: string;
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
  const [activeSubTab, setActiveSubTab] = useState<"dashboard" | "directory" | "performance">("directory");

  // State for Supplier Directory
  const [suppliers, setSuppliers] = useState<SupplierItem[]>([
    {
      id: "SUP-001",
      code: "SUP-001",
      name: "TechCorp Distributors",
      group: "Electronics",
      contact_person: "Rajesh Kumar",
      mobile: "+91 98200 12345",
      email: "rajesh@techcorp.com",
      gst_number: "27ABCDE1234F1Z5",
      balance: "₹1,20,000",
      outstanding_balance: 120000,
      credit_limit: 500000,
      credit_days: 30,
      city: "Mumbai",
      state: "Maharashtra"
    },
    {
      id: "SUP-002",
      code: "SUP-002",
      name: "Global Supplies Ltd.",
      group: "General Retail",
      contact_person: "Anita Singh",
      mobile: "+91 98333 99887",
      email: "anita@globalsupplies.com",
      gst_number: "27XYZPQ9876G1Z3",
      balance: "₹0",
      outstanding_balance: 0,
      credit_limit: 300000,
      credit_days: 15,
      city: "Pune",
      state: "Maharashtra"
    },
    {
      id: "SUP-003",
      code: "SUP-003",
      name: "Metro Wholesale Hub",
      group: "FMCG & Groceries",
      contact_person: "Vikram Mehta",
      mobile: "+91 97111 22334",
      email: "vikram@metrowholesale.in",
      gst_number: "24AAAAA0000A1Z5",
      balance: "₹45,500",
      outstanding_balance: 45500,
      credit_limit: 250000,
      credit_days: 30,
      city: "Ahmedabad",
      state: "Gujarat"
    },
    {
      id: "SUP-004",
      code: "SUP-004",
      name: "Prime Packaging Solutions",
      group: "Packaging",
      contact_person: "Sunil Verma",
      mobile: "+91 99887 76655",
      email: "sunil@primepack.com",
      gst_number: "27BBBCC1122D1Z8",
      balance: "₹2,60,300",
      outstanding_balance: 260300,
      credit_limit: 400000,
      credit_days: 45,
      city: "Thane",
      state: "Maharashtra"
    }
  ]);

  const [searchTerm, setSearchTerm] = useState<string>("");
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // New Vendor Form State
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    trade_name: "",
    group: "General Retail",
    contact_person: "",
    mobile: "",
    email: "",
    gst_number: "",
    address: "",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "400001",
    credit_limit: "200000",
    credit_days: "30"
  });

  // Fetch live suppliers on component mount
  const fetchSuppliers = async () => {
    try {
      const data = await apiFetchV1("/purchase/suppliers/");
      if (Array.isArray(data) && data.length > 0) {
        setSuppliers(data.map((s: any) => ({
          id: s.id,
          code: s.code || s.id,
          name: s.name,
          trade_name: s.trade_name,
          group: s.supplier_group_id || s.group || "General Retail",
          contact_person: s.contacts?.[0]?.name || s.contact_person || "Primary Contact",
          mobile: s.mobile || s.contacts?.[0]?.mobile || "N/A",
          email: s.email || s.contacts?.[0]?.email || "N/A",
          gst_number: s.gst_number || s.tax_profile?.gstin || "N/A",
          balance: `₹${(s.outstanding_balance || 0).toLocaleString("en-IN")}`,
          outstanding_balance: s.outstanding_balance || 0,
          credit_limit: s.credit_profile?.credit_limit || 200000,
          credit_days: s.credit_profile?.credit_days || 30,
          city: s.city || "Mumbai",
          state: s.state || "Maharashtra"
        })));
      }
    } catch (err) {
      // Keep seeded fallback suppliers list if offline
    }
  };

  useEffect(() => {
    fetchSuppliers();
    recordAuditAction("VIEW", "suppliers", activeSubTab, `Switched supplier dashboard view to: ${activeSubTab}`);
  }, [activeSubTab]);

  const handleInputChange = (field: string, value: string) => {
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
      name: "",
      code: autoCode,
      trade_name: "",
      group: "General Retail",
      contact_person: "",
      mobile: "",
      email: "",
      gst_number: "",
      address: "",
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "400001",
      credit_limit: "200000",
      credit_days: "30"
    });
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
      trade_name: formData.trade_name || formData.name,
      group: formData.group,
      contact_person: formData.contact_person || "Primary Contact",
      mobile: formData.mobile || "N/A",
      email: formData.email || "N/A",
      gst_number: formData.gst_number || "N/A",
      address: formData.address,
      city: formData.city,
      state: formData.state,
      pincode: formData.pincode,
      balance: "₹0",
      outstanding_balance: 0,
      credit_limit: parseFloat(formData.credit_limit) || 200000,
      credit_days: parseInt(formData.credit_days) || 30,
      status: "Active"
    };

    try {
      await apiFetchV1("/purchase/suppliers/", {
        method: "POST",
        body: JSON.stringify({
          name: formData.name.trim(),
          code: formData.code || newVendorId,
          trade_name: formData.trade_name,
          supplier_group_id: formData.group,
          gst_number: formData.gst_number,
          mobile: formData.mobile,
          email: formData.email,
          address: formData.address,
          city: formData.city,
          state: formData.state,
          pincode: formData.pincode,
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
      // Fallback: add locally to state
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
            <Building2 className="w-6 h-6 text-[#0a6ed1]" /> Supplier & Vendor Management Platform
          </h2>
          <p className="text-xs text-theme-muted mt-1 max-w-2xl">
            Centralized hub for vendor onboarding, credit terms, payables, and supply chain performance.
          </p>
        </div>
        <div className="flex items-center gap-3 mt-4 md:mt-0 bg-theme-surface-3 px-4 py-2 rounded-lg border border-theme-divider">
          <div className="text-right">
            <div className="text-[10px] font-mono text-theme-muted uppercase font-bold">
              Total Payables
            </div>
            <div className="text-sm font-bold text-rose-400 font-mono">
              ₹{totalOutstanding.toLocaleString("en-IN")}
            </div>
          </div>
          <div className="w-px h-8 bg-theme-divider mx-2"></div>
          <div className="text-right">
            <div className="text-[10px] font-mono text-theme-muted uppercase font-bold">
              Active Vendors
            </div>
            <div className="text-sm font-bold text-emerald-400 font-mono">
              {suppliers.length}
            </div>
          </div>
        </div>
      </div>

      {/* Sub Tabs Bar */}
      <div className="flex items-center justify-between px-6 bg-theme-surface-2 border-b border-theme-divider">
        <div className="flex items-center gap-2">
          {(["directory", "dashboard", "performance"] as const).map((tab) => (
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
            <Plus className="w-4 h-4" /> Onboard New Vendor
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
          {activeSubTab === "directory" && (
            <div className="space-y-6">
              {/* Directory Filter Bar */}
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

              {/* Vendor Directory Table */}
              <div className="bg-theme-surface-2 border border-theme-divider rounded-xl overflow-hidden shadow-lg">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-theme-surface-3 border-b border-theme-divider text-[10px] uppercase tracking-wider text-theme-muted font-mono">
                      <th className="px-4 py-3 font-semibold">Vendor Code</th>
                      <th className="px-4 py-3 font-semibold">Supplier Name</th>
                      <th className="px-4 py-3 font-semibold">Category Group</th>
                      <th className="px-4 py-3 font-semibold">Contact Person</th>
                      <th className="px-4 py-3 font-semibold">GSTIN</th>
                      <th className="px-4 py-3 font-semibold text-right">Outstanding</th>
                      <th className="px-4 py-3 font-semibold text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs divide-y divide-theme-divider font-mono">
                    {filteredSuppliers.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-theme-muted">
                          No vendors match the search query. Click "+ Onboard New Vendor" to add a supplier.
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
                            {v.trade_name && v.trade_name !== v.name && (
                              <span className="block text-[10px] text-theme-muted font-mono">{v.trade_name}</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-theme-surface-4 text-theme-muted border border-theme-divider font-sans">
                              {v.group || "General"}
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
                              Inspect
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

          {activeSubTab === "dashboard" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-5 shadow-lg">
                  <h4 className="text-xs font-bold text-theme-muted font-display uppercase tracking-wider mb-2">Open POs</h4>
                  <div className="text-2xl font-bold text-theme-primary font-mono">12</div>
                  <div className="text-[10px] text-theme-muted mt-1 font-mono">Valued at ₹1,85,000</div>
                </div>
                <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-5 shadow-lg">
                  <h4 className="text-xs font-bold text-theme-muted font-display uppercase tracking-wider mb-2">GRNs Pending</h4>
                  <div className="text-2xl font-bold text-theme-primary font-mono">5</div>
                  <div className="text-[10px] text-amber-400 mt-1 flex items-center gap-1 font-mono">2 Overdue</div>
                </div>
                <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-5 shadow-lg">
                  <h4 className="text-xs font-bold text-theme-muted font-display uppercase tracking-wider mb-2">Total Payables</h4>
                  <div className="text-2xl font-bold text-rose-400 font-mono">₹{totalOutstanding.toLocaleString("en-IN")}</div>
                  <div className="text-[10px] text-theme-muted mt-1 font-mono">Across {suppliers.length} Vendors</div>
                </div>
                <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-5 shadow-lg">
                  <h4 className="text-xs font-bold text-theme-muted font-display uppercase tracking-wider mb-2">Avg Delivery SLA</h4>
                  <div className="text-2xl font-bold text-emerald-400 font-mono">4.2 Days</div>
                  <div className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1 font-mono">On-Time SLA: 96.8%</div>
                </div>
              </div>
            </div>
          )}

          {activeSubTab === "performance" && (
            <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-8 shadow-lg text-center select-none">
              <ShieldCheck className="w-12 h-12 text-[#0a6ed1] mx-auto mb-4" />
              <h3 className="text-lg font-bold text-theme-primary font-display uppercase tracking-wider">
                Vendor Performance Scorecards
              </h3>
              <p className="text-theme-muted text-sm mt-2 max-w-md mx-auto">
                Track On-Time Delivery (OTD), Defect Rates, GSTIN Compliance, and Order Fulfillment Accuracy.
              </p>
            </div>
          )}
        </motion.div>
      </SmritiScrollArea>

      {/* ONBOARD NEW VENDOR DIALOG MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-theme-surface-1 border border-theme-divider rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-theme-divider pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#0a6ed1]" />
                <h3 className="text-base font-bold text-theme-heading font-display">Onboard New Supplier / Vendor</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-theme-muted hover:text-theme-heading rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSupplier} className="space-y-4 text-xs font-sans">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-theme-muted mb-1">Corporate Vendor Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Acme Textiles Pvt Ltd"
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    className="w-full p-2 bg-theme-surface-2 border border-theme-divider rounded-lg font-bold text-theme-heading focus:outline-none focus:border-[#0a6ed1]"
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
                  <label className="block font-bold text-theme-muted mb-1">Category Group</label>
                  <select
                    value={formData.group}
                    onChange={(e) => handleInputChange("group", e.target.value)}
                    className="w-full p-2 bg-theme-surface-2 border border-theme-divider rounded-lg font-bold text-theme-heading"
                  >
                    <option value="General Retail">General Retail</option>
                    <option value="Electronics">Electronics & Hardware</option>
                    <option value="Apparel">Apparel & Textiles</option>
                    <option value="FMCG & Groceries">FMCG & Groceries</option>
                    <option value="Packaging">Packaging Materials</option>
                    <option value="Pharmaceuticals">Pharmaceuticals</option>
                  </select>
                </div>

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
                  <label className="block font-bold text-theme-muted mb-1">Contact Person Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Rajesh Kumar"
                    value={formData.contact_person}
                    onChange={(e) => handleInputChange("contact_person", e.target.value)}
                    className="w-full p-2 bg-theme-surface-2 border border-theme-divider rounded-lg text-theme-heading"
                  />
                </div>

                <div>
                  <label className="block font-bold text-theme-muted mb-1">Mobile / Phone Number</label>
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

                <div>
                  <label className="block font-bold text-theme-muted mb-1">Credit Limit ₹</label>
                  <input
                    type="number"
                    value={formData.credit_limit}
                    onChange={(e) => handleInputChange("credit_limit", e.target.value)}
                    className="w-full p-2 bg-theme-surface-2 border border-theme-divider rounded-lg font-mono text-theme-heading"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-theme-muted mb-1">Corporate Address</label>
                <input
                  type="text"
                  placeholder="Street, Building No., Industrial Area"
                  value={formData.address}
                  onChange={(e) => handleInputChange("address", e.target.value)}
                  className="w-full p-2 bg-theme-surface-2 border border-theme-divider rounded-lg text-theme-heading"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block font-bold text-theme-muted mb-1">City</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => handleInputChange("city", e.target.value)}
                    className="w-full p-2 bg-theme-surface-2 border border-theme-divider rounded-lg text-theme-heading"
                  />
                </div>
                <div>
                  <label className="block font-bold text-theme-muted mb-1">State</label>
                  <input
                    type="text"
                    value={formData.state}
                    onChange={(e) => handleInputChange("state", e.target.value)}
                    className="w-full p-2 bg-theme-surface-2 border border-theme-divider rounded-lg text-theme-heading"
                  />
                </div>
                <div>
                  <label className="block font-bold text-theme-muted mb-1">Pincode</label>
                  <input
                    type="text"
                    value={formData.pincode}
                    onChange={(e) => handleInputChange("pincode", e.target.value)}
                    className="w-full p-2 bg-theme-surface-2 border border-theme-divider rounded-lg font-mono text-theme-heading"
                  />
                </div>
              </div>

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
                  <CheckCircle2 className="w-4 h-4" /> Save & Onboard Vendor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* INSPECT SUPPLIER DETAIL MODAL */}
      {selectedSupplier && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 select-none">
          <div className="bg-theme-surface-1 border border-theme-divider rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-theme-divider pb-3">
              <div>
                <h3 className="text-base font-bold text-theme-heading">{selectedSupplier.name}</h3>
                <span className="font-mono text-xs text-[#0a6ed1] font-bold">{selectedSupplier.code || selectedSupplier.id}</span>
              </div>
              <button onClick={() => setSelectedSupplier(null)} className="p-1 text-theme-muted hover:text-theme-heading cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs font-mono">
              <div className="p-3 bg-theme-surface-2 rounded-lg border border-theme-divider flex justify-between">
                <span className="text-theme-muted">GSTIN Number:</span>
                <strong className="text-theme-heading">{selectedSupplier.gst_number || "N/A"}</strong>
              </div>
              <div className="p-3 bg-theme-surface-2 rounded-lg border border-theme-divider flex justify-between">
                <span className="text-theme-muted">Contact Person:</span>
                <strong className="text-theme-heading">{selectedSupplier.contact_person || "N/A"}</strong>
              </div>
              <div className="p-3 bg-theme-surface-2 rounded-lg border border-theme-divider flex justify-between">
                <span className="text-theme-muted">Mobile Number:</span>
                <strong className="text-theme-heading">{selectedSupplier.mobile || "N/A"}</strong>
              </div>
              <div className="p-3 bg-theme-surface-2 rounded-lg border border-theme-divider flex justify-between">
                <span className="text-theme-muted">Outstanding Payables:</span>
                <strong className="text-rose-400 font-bold">{selectedSupplier.balance || "₹0"}</strong>
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
