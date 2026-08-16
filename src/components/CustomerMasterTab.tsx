/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.28.0
 * Created      : 2026-07-13
 * Modified     : 2026-08-16
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Target UI    : Customer Master Data (Fiori Horizon Inspired Light Theme)
 */

import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { SmritiScrollArea } from "./SmritiScrollArea.tsx";
import { getCustomers, saveCustomers, getCustomerGroups } from "../services/customerStore.ts";
import { Customer } from "../types";
import { recordAuditAction } from "../lib/apiFetch.ts";
import { CustomerProfile } from "./customer/CustomerProfile.tsx";
import { CustomerLedger } from "./customer/CustomerLedger.tsx";
import { validateCustomerProfile } from "../services/customerValidation.ts";
import { apiFetchV1 } from "../lib/apiFetchV1.ts";
import { 
  User, 
  Users, 
  Search, 
  Plus, 
  Download, 
  FileSpreadsheet, 
  SlidersHorizontal, 
  CreditCard, 
  Award, 
  ShieldAlert, 
  CheckCircle2, 
  X, 
  Edit, 
  Trash2, 
  Phone, 
  Mail, 
  Building 
} from "lucide-react";

export interface CustomerMasterTabProps {
  currentUser?: { role: string; name: string } | null;
}

export const CustomerMasterTab: React.FC<CustomerMasterTabProps> = ({ currentUser }) => {
  const isReadOnly = currentUser?.role === "Report User";
  const [customers, setCustomers] = useState<Customer[]>(() => getCustomers());
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>("All");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>("All");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  // New Customer Modal states
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [formMode, setFormMode] = useState<"quick" | "advanced">("quick");
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerMobile, setNewCustomerMobile] = useState("");
  const [newCustomerEmail, setNewCustomerEmail] = useState("");
  const [newCustomerGst, setNewCustomerGst] = useState("");
  const [newCustomerPan, setNewCustomerPan] = useState("");
  const [newCustomerGroup, setNewCustomerGroup] = useState("CG-Retail");
  const [newCustomerStatus, setNewCustomerStatus] = useState<"Active" | "Inactive" | "Blocked">("Active");
  const [newCustomerCode, setNewCustomerCode] = useState("");
  const [newCustomerShortName, setNewCustomerShortName] = useState("");
  const [newCustomerNotes, setNewCustomerNotes] = useState("");
  const [newCustomerTags, setNewCustomerTags] = useState("");
  const [newCustomerEffectiveFrom, setNewCustomerEffectiveFrom] = useState("");
  const [newCustomerEffectiveTo, setNewCustomerEffectiveTo] = useState("");
  const [newCustomerSortOrder, setNewCustomerSortOrder] = useState("");
  const [newCustomerSalesperson, setNewCustomerSalesperson] = useState("");
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isValidating, setIsValidating] = useState(false);

  const customerGroups = getCustomerGroups();

  const handleRegisterCustomer = async () => {
    if (isReadOnly) {
      setValidationErrors(["Access Denied: Read-only operators cannot register new profiles."]);
      return;
    }
    setValidationErrors([]);
    if (!newCustomerName.trim()) {
      setValidationErrors(["Customer Name is required."]);
      return;
    }
    const payload: any = {
      name: newCustomerName,
      mobile: newCustomerMobile,
      email: formMode === "advanced" ? newCustomerEmail : "",
      gstNumber: formMode === "advanced" ? newCustomerGst : "",
      pan: formMode === "advanced" ? newCustomerPan : "",
      customerGroupId: newCustomerGroup,
      status: formMode === "advanced" ? newCustomerStatus : "Active",
      outstanding: 0,
      code: formMode === "advanced" && newCustomerCode.trim() ? newCustomerCode.trim() : undefined,
      shortName: formMode === "advanced" && newCustomerShortName.trim() ? newCustomerShortName.trim() : undefined,
      notes: formMode === "advanced" && newCustomerNotes.trim() ? newCustomerNotes.trim() : undefined,
      tags: formMode === "advanced" && newCustomerTags.trim() ? newCustomerTags.split(",").map(t => t.trim()).filter(Boolean) : undefined,
      effectiveFrom: formMode === "advanced" && newCustomerEffectiveFrom ? newCustomerEffectiveFrom : undefined,
      effectiveTo: formMode === "advanced" && newCustomerEffectiveTo ? newCustomerEffectiveTo : undefined,
      sortOrder: formMode === "advanced" && newCustomerSortOrder ? parseInt(newCustomerSortOrder, 10) : undefined,
      salesperson: formMode === "advanced" && newCustomerSalesperson.trim() ? newCustomerSalesperson.trim() : undefined,
    };

    const localVal = validateCustomerProfile(payload, customers);
    if (!localVal.valid) {
      setValidationErrors(localVal.errors);
      return;
    }

    setIsValidating(true);

    try {
      const data = await apiFetchV1("/customers/validate-add", {
        method: "POST",
        body: JSON.stringify({
          customer: payload,
          existingCustomers: customers
        })
      });

      if (!data.valid) {
        setValidationErrors(data.errors || ["Smriti validation failed."]);
        setIsValidating(false);
        return;
      }

      // Synchronously POST new customer to register in Postgres and generate sequence ID
      const createdCustomer: Customer = await apiFetchV1("/customers", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      setIsValidating(false);
      const updatedList = [...customers, createdCustomer];
      
      // Update local storage and state directly
      localStorage.setItem("smriti_customers", JSON.stringify(updatedList));
      try {
        window.dispatchEvent(new CustomEvent("smriti_customer_updated"));
      } catch (e) {
        console.error("Failed to dispatch update event:", e);
      }
      setCustomers(updatedList);
      recordAuditAction("CREATE", "customers", createdCustomer.id, `Created new customer profile: "${newCustomerName}"`);

      // Reset form
      setIsAddingCustomer(false);
      setNewCustomerName("");
      setNewCustomerMobile("");
      setNewCustomerEmail("");
      setNewCustomerGst("");
      setNewCustomerPan("");
      setNewCustomerGroup("CG-Retail");
      setNewCustomerStatus("Active");
      setNewCustomerCode("");
      setNewCustomerShortName("");
      setNewCustomerNotes("");
      setNewCustomerTags("");
      setNewCustomerEffectiveFrom("");
      setNewCustomerEffectiveTo("");
      setNewCustomerSortOrder("");
      setNewCustomerSalesperson("");
      setFormMode("quick");
    } catch (err) {
      console.error(err);
      setValidationErrors(["Smriti Network validation timed out. Please try again."]);
      setIsValidating(false);
    }
  };

  // Debounced search audit logging
  useEffect(() => {
    if (!searchQuery.trim()) return;
    const delay = setTimeout(() => {
      recordAuditAction("SEARCH", "customers", "search", `Search performed for customer master: "${searchQuery}"`);
    }, 1200);
    return () => clearTimeout(delay);
  }, [searchQuery]);

  useEffect(() => {
    if (selectedCustomerId) {
      const selected = customers.find(c => c.id === selectedCustomerId);
      if (selected) {
        recordAuditAction("TRANSACTION_VIEW", "customers", selected.id, `Viewed customer master details: ${selected.name}`);
      }
    }
  }, [selectedCustomerId, customers]);

  const filteredCustomers = customers.filter((c) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesQuery = !q ||
      c.name.toLowerCase().includes(q) ||
      (c.mobile && c.mobile.includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q)) ||
      (c.gstNumber && c.gstNumber.toLowerCase().includes(q)) ||
      c.id.toLowerCase().includes(q);
    
    const matchesGroup = selectedGroupFilter === "All" || c.customerGroupId === selectedGroupFilter;
    const matchesStatus = selectedStatusFilter === "All" || c.status === selectedStatusFilter;

    return matchesQuery && matchesGroup && matchesStatus;
  });

  const totalCount = customers.length;
  const activeCount = customers.filter(c => c.status === "Active" || !c.status).length;
  const totalOutstandingSum = customers.reduce((sum, c) => sum + (c.outstanding || 0), 0);

  return (
    <div className="flex flex-col h-full bg-theme-surface-1 text-theme-body font-sans space-y-5 p-6">
      
      {/* Read Only Banner Warning */}
      {isReadOnly && (
        <div className="bg-amber-50 border border-amber-200 px-4 py-2.5 rounded-xl flex items-center space-x-2 text-amber-800 text-xs shadow-xs">
          <ShieldAlert size={16} className="text-amber-600 shrink-0" />
          <span className="font-mono uppercase tracking-wider font-bold">Read-Only Mode:</span>
          <span>Operating under a Read-Only Report User role. Modifying customer profiles is prohibited.</span>
        </div>
      )}

      {/* Top Workspace Subheader & Action Bar */}
      <div className="bg-theme-surface-1 border border-theme-border rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-lg font-bold text-theme-body tracking-tight">Customer Master Data</h2>
            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded font-mono uppercase">
              Active Registry
            </span>
          </div>
          <p className="text-xs text-theme-muted font-mono mt-0.5">
            CRM &amp; Loyalty &gt; Customer Master Data &gt; Directory
          </p>
        </div>

        <div className="flex items-center space-x-2 text-xs">
          <button 
            onClick={() => recordAuditAction("EXPORT", "customers", "export", "Exported customer master registry")}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-theme-border text-theme-body hover:bg-theme-surface-hover font-semibold transition-colors cursor-pointer"
          >
            <Download size={13} className="text-theme-muted" />
            <span>Export List</span>
          </button>
          <button 
            onClick={() => recordAuditAction("IMPORT", "customers", "import", "Opened customer import dialog")}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-theme-border text-theme-body hover:bg-theme-surface-hover font-semibold transition-colors cursor-pointer"
          >
            <FileSpreadsheet size={13} className="text-theme-muted" />
            <span>Import Customers</span>
          </button>
          <button 
            onClick={() => {
              if (isReadOnly) return;
              setValidationErrors([]);
              setIsAddingCustomer(true);
            }}
            disabled={isReadOnly}
            className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-theme-primary text-white font-bold transition-colors cursor-pointer shadow-xs ${
              isReadOnly ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            <Plus size={13} />
            <span>+ New Customer</span>
          </button>
        </div>
      </div>

      {/* Top 4 KPI Metrics Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        
        <div className="bg-theme-surface-1 border border-theme-border rounded-xl p-4 space-y-2 shadow-xs">
          <div className="flex justify-between items-center text-theme-muted text-xs">
            <span className="font-semibold uppercase tracking-wider font-mono text-[10px]">Total Registered</span>
            <Users size={16} className="text-theme-primary" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-theme-body font-mono">{totalCount}</span>
            <span className="text-[10px] text-emerald-600 font-mono font-bold">+48 this month</span>
          </div>
        </div>

        <div className="bg-theme-surface-1 border border-theme-border rounded-xl p-4 space-y-2 shadow-xs">
          <div className="flex justify-between items-center text-theme-muted text-xs">
            <span className="font-semibold uppercase tracking-wider font-mono text-[10px]">Active Profiles</span>
            <User size={16} className="text-emerald-600" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-emerald-600 font-mono">{activeCount}</span>
            <span className="text-[10px] text-theme-muted font-mono">
              {totalCount > 0 ? ((activeCount / totalCount) * 100).toFixed(1) : "100"}% Active
            </span>
          </div>
        </div>

        <div className="bg-theme-surface-1 border border-theme-border rounded-xl p-4 space-y-2 shadow-xs">
          <div className="flex justify-between items-center text-theme-muted text-xs">
            <span className="font-semibold uppercase tracking-wider font-mono text-[10px]">Total Outstanding</span>
            <CreditCard size={16} className="text-amber-600" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-bold text-theme-body font-mono">
              ₹{totalOutstandingSum.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-amber-600 font-mono font-bold">28 Overdue</span>
          </div>
        </div>

        <div className="bg-theme-surface-1 border border-theme-border rounded-xl p-4 space-y-2 shadow-xs">
          <div className="flex justify-between items-center text-theme-muted text-xs">
            <span className="font-semibold uppercase tracking-wider font-mono text-[10px]">Loyalty Points Liability</span>
            <Award size={16} className="text-indigo-600" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-bold text-indigo-700 font-mono">4,12,000 Pts</span>
            <span className="text-[10px] text-theme-muted font-mono">₹41,200.00 Val</span>
          </div>
        </div>

      </div>

      {/* Search & Directory Filter Toolbar */}
      <div className="bg-theme-surface-1 border border-theme-border rounded-xl p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs text-xs">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Name, Mobile, Email, GSTIN or Customer ID..."
              className="w-full bg-theme-surface-2 border border-theme-border rounded-lg pl-9 pr-3 py-1.5 text-xs text-theme-body placeholder-theme-muted focus:outline-none focus:border-theme-primary font-medium"
            />
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted" />
          </div>

          <div className="flex items-center space-x-2">
            <select
              value={selectedGroupFilter}
              onChange={(e) => setSelectedGroupFilter(e.target.value)}
              className="bg-theme-surface-2 border border-theme-border rounded-lg px-2.5 py-1.5 text-xs text-theme-body font-semibold focus:outline-none focus:border-theme-primary cursor-pointer"
            >
              <option value="All">All Groups</option>
              {customerGroups.map(cg => (
                <option key={cg.id} value={cg.id}>{cg.name}</option>
              ))}
            </select>

            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="bg-theme-surface-2 border border-theme-border rounded-lg px-2.5 py-1.5 text-xs text-theme-body font-semibold focus:outline-none focus:border-theme-primary cursor-pointer"
            >
              <option value="All">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="Blocked">Blocked</option>
            </select>
          </div>
        </div>

        <div className="text-right text-theme-muted font-mono">
          Showing <strong className="text-theme-body font-bold">{filteredCustomers.length}</strong> of {totalCount} profiles
        </div>
      </div>

      {/* Main Split Grid View: Directory Table + Side Inspector Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 flex-1 min-h-0">
        
        {/* Left Column: Customer Directory Table */}
        <div className={`${selectedCustomerId ? "lg:col-span-2" : "lg:col-span-3"} transition-all duration-300`}>
          <div className="bg-theme-surface-1 border border-theme-border rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-theme-surface-2 border-b border-theme-border text-[10px] uppercase tracking-wider text-theme-muted font-bold font-mono">
                    <th className="px-4 py-3">Customer ID</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Mobile / Contact</th>
                    <th className="px-4 py-3">Email Address</th>
                    <th className="px-4 py-3 font-mono">GSTIN</th>
                    <th className="px-4 py-3 text-right font-mono">Outstanding (₹)</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-theme-divider text-xs">
                  {filteredCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-theme-muted text-xs">
                        No customer profiles match the search and filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredCustomers.map((c) => (
                      <tr 
                        key={c.id} 
                        onClick={() => setSelectedCustomerId(c.id)}
                        className={`hover:bg-theme-surface-hover transition-colors cursor-pointer ${
                          selectedCustomerId === c.id ? "bg-theme-selection border-l-4 border-l-theme-primary" : ""
                        }`}
                      >
                        <td className="px-4 py-3 font-mono font-bold text-theme-primary">{c.id}</td>
                        <td className="px-4 py-3 font-bold text-theme-body">{c.name}</td>
                        <td className="px-4 py-3 text-theme-muted font-mono">{c.mobile || "—"}</td>
                        <td className="px-4 py-3 text-theme-muted text-[11px]">{c.email || "—"}</td>
                        <td className="px-4 py-3 font-mono text-theme-muted">{c.gstNumber || "—"}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-theme-body">
                          ₹{(c.outstanding || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider font-mono ${
                            c.status === "Active" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                            c.status === "Inactive" ? "bg-slate-100 text-slate-700 border border-slate-200" :
                            "bg-rose-50 text-rose-700 border border-rose-200 font-bold animate-pulse"
                          }`}>
                            {c.status || "Active"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center space-x-1">
                            <button 
                              onClick={(e) => { e.stopPropagation(); setSelectedCustomerId(c.id); }}
                              className="p-1 text-theme-muted hover:text-theme-primary rounded transition-colors" 
                              title="Inspect profile"
                            >
                              <Edit size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: Customer Inspector Side Drawer */}
        {selectedCustomerId && (() => {
          const selectedCustomer = customers.find(c => c.id === selectedCustomerId);
          return selectedCustomer ? (
            <div className="space-y-4 lg:col-span-1">
              <CustomerProfile 
                customer={selectedCustomer} 
                isReadOnly={isReadOnly} 
                onClose={() => setSelectedCustomerId(null)} 
              />
              <CustomerLedger customer={selectedCustomer} />
            </div>
          ) : null;
        })()}

      </div>

      {/* Register Customer Modal */}
      {isAddingCustomer && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-theme-surface-1 border border-theme-border rounded-2xl w-full max-w-lg shadow-2xl p-6 relative">
            <button
              onClick={() => setIsAddingCustomer(false)}
              className="absolute top-4 right-4 text-theme-muted hover:text-theme-body cursor-pointer"
            >
              <X size={18} />
            </button>

            <div className="flex justify-between items-center border-b border-theme-divider pb-3 mb-4">
              <h3 className="text-sm font-bold text-theme-body uppercase tracking-wider font-mono">
                Register New Customer Profile
              </h3>
              <div className="flex bg-theme-surface-2 border border-theme-border rounded-lg p-0.5">
                <button
                  type="button"
                  onClick={() => setFormMode("quick")}
                  className={`px-3 py-1 rounded-md text-[10px] uppercase font-bold tracking-wider transition-colors cursor-pointer ${
                    formMode === "quick"
                      ? "bg-theme-primary text-white"
                      : "text-theme-muted hover:text-theme-body"
                  }`}
                >
                  Quick
                </button>
                <button
                  type="button"
                  onClick={() => setFormMode("advanced")}
                  className={`px-3 py-1 rounded-md text-[10px] uppercase font-bold tracking-wider transition-colors cursor-pointer ${
                    formMode === "advanced"
                      ? "bg-theme-primary text-white"
                      : "text-theme-muted hover:text-theme-body"
                  }`}
                >
                  Advanced
                </button>
              </div>
            </div>

            {validationErrors.length > 0 && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-lg text-xs mb-4 space-y-1 font-mono">
                {validationErrors.map((err, idx) => (
                  <div key={idx}>• {err}</div>
                ))}
              </div>
            )}

            <SmritiScrollArea maxHeight="60vh" className="text-xs" fadeColorClass="from-theme-surface-1">
              <div className="space-y-4 pr-2">
                <div>
                  <label className="block text-theme-muted mb-1 font-bold">Full Name *</label>
                  <input
                    type="text"
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                    placeholder="e.g. John Doe"
                    className="w-full bg-theme-surface-2 border border-theme-border rounded-lg p-2 text-theme-body focus:outline-none focus:border-theme-primary"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-theme-muted mb-1 font-bold">Mobile *</label>
                    <input
                      type="text"
                      value={newCustomerMobile}
                      onChange={(e) => setNewCustomerMobile(e.target.value)}
                      placeholder="10-digit number"
                      className="w-full bg-theme-surface-2 border border-theme-border rounded-lg p-2 text-theme-body focus:outline-none focus:border-theme-primary font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-theme-muted mb-1 font-bold">Customer Group</label>
                    <select
                      value={newCustomerGroup}
                      onChange={(e) => setNewCustomerGroup(e.target.value)}
                      className="w-full bg-theme-surface-2 border border-theme-border rounded-lg p-2 text-theme-body focus:outline-none focus:border-theme-primary cursor-pointer"
                    >
                      {customerGroups.map((cg) => (
                        <option key={cg.id} value={cg.id}>
                          {cg.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {formMode === "advanced" && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-theme-muted mb-1 font-bold">Email Address</label>
                        <input
                          type="email"
                          value={newCustomerEmail}
                          onChange={(e) => setNewCustomerEmail(e.target.value)}
                          placeholder="name@domain.com"
                          className="w-full bg-theme-surface-2 border border-theme-border rounded-lg p-2 text-theme-body focus:outline-none focus:border-theme-primary"
                        />
                      </div>
                      <div>
                        <label className="block text-theme-muted mb-1 font-bold">Profile Status</label>
                        <select
                          value={newCustomerStatus}
                          onChange={(e) => setNewCustomerStatus(e.target.value as any)}
                          className="w-full bg-theme-surface-2 border border-theme-border rounded-lg p-2 text-theme-body focus:outline-none focus:border-theme-primary cursor-pointer"
                        >
                          <option value="Active">Active</option>
                          <option value="Inactive">Inactive</option>
                          <option value="Blocked">Blocked</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-theme-muted mb-1 font-bold">GSTIN</label>
                        <input
                          type="text"
                          value={newCustomerGst}
                          onChange={(e) => setNewCustomerGst(e.target.value)}
                          placeholder="15-character GSTIN"
                          className="w-full bg-theme-surface-2 border border-theme-border rounded-lg p-2 text-theme-body focus:outline-none focus:border-theme-primary font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-theme-muted mb-1 font-bold">PAN</label>
                        <input
                          type="text"
                          value={newCustomerPan}
                          onChange={(e) => setNewCustomerPan(e.target.value)}
                          placeholder="10-character PAN card"
                          className="w-full bg-theme-surface-2 border border-theme-border rounded-lg p-2 text-theme-body focus:outline-none focus:border-theme-primary font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-theme-muted mb-1 font-bold">Customer Code</label>
                        <input
                          type="text"
                          value={newCustomerCode}
                          onChange={(e) => setNewCustomerCode(e.target.value)}
                          placeholder="e.g. CUST-MANUAL"
                          className="w-full bg-theme-surface-2 border border-theme-border rounded-lg p-2 text-theme-body focus:outline-none focus:border-theme-primary font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-theme-muted mb-1 font-bold">Short Name</label>
                        <input
                          type="text"
                          value={newCustomerShortName}
                          onChange={(e) => setNewCustomerShortName(e.target.value)}
                          placeholder="Alias name"
                          className="w-full bg-theme-surface-2 border border-theme-border rounded-lg p-2 text-theme-body focus:outline-none focus:border-theme-primary"
                        />
                      </div>
                      <div>
                        <label className="block text-theme-muted mb-1 font-bold">Salesperson</label>
                        <input
                          type="text"
                          value={newCustomerSalesperson}
                          onChange={(e) => setNewCustomerSalesperson(e.target.value)}
                          placeholder="Sales agent"
                          className="w-full bg-theme-surface-2 border border-theme-border rounded-lg p-2 text-theme-body focus:outline-none focus:border-theme-primary"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-theme-muted mb-1 font-bold">Effective From</label>
                        <input
                          type="date"
                          value={newCustomerEffectiveFrom}
                          onChange={(e) => setNewCustomerEffectiveFrom(e.target.value)}
                          className="w-full bg-theme-surface-2 border border-theme-border rounded-lg p-2 text-theme-body focus:outline-none focus:border-theme-primary font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-theme-muted mb-1 font-bold">Effective To</label>
                        <input
                          type="date"
                          value={newCustomerEffectiveTo}
                          onChange={(e) => setNewCustomerEffectiveTo(e.target.value)}
                          className="w-full bg-theme-surface-2 border border-theme-border rounded-lg p-2 text-theme-body focus:outline-none focus:border-theme-primary font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-theme-muted mb-1 font-bold">Sort Order</label>
                        <input
                          type="number"
                          value={newCustomerSortOrder}
                          onChange={(e) => setNewCustomerSortOrder(e.target.value)}
                          placeholder="0"
                          className="w-full bg-theme-surface-2 border border-theme-border rounded-lg p-2 text-theme-body focus:outline-none focus:border-theme-primary font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-theme-muted mb-1 font-bold">Tags (comma-separated)</label>
                      <input
                        type="text"
                        value={newCustomerTags}
                        onChange={(e) => setNewCustomerTags(e.target.value)}
                        placeholder="e.g. VIP, Retail"
                        className="w-full bg-theme-surface-2 border border-theme-border rounded-lg p-2 text-theme-body focus:outline-none focus:border-theme-primary font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-theme-muted mb-1 font-bold">Notes / Description</label>
                      <textarea
                        value={newCustomerNotes}
                        onChange={(e) => setNewCustomerNotes(e.target.value)}
                        placeholder="Internal business comments..."
                        rows={3}
                        className="w-full bg-theme-surface-2 border border-theme-border rounded-lg p-2 text-theme-body focus:outline-none focus:border-theme-primary resize-none"
                      />
                    </div>
                  </>
                )}
              </div>
            </SmritiScrollArea>

            <div className="flex justify-end gap-2 mt-5 border-t border-theme-divider pt-3">
              <button
                onClick={() => setIsAddingCustomer(false)}
                className="px-4 py-2 border border-theme-border hover:bg-theme-surface-hover text-theme-muted rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleRegisterCustomer}
                disabled={isValidating}
                className="bg-theme-primary hover:bg-theme-primary-hover disabled:bg-slate-400 text-white px-5 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-xs"
              >
                {isValidating ? "Validating..." : "Register Profile"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
