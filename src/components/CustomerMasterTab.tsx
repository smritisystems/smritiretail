/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.0
 * Created      : 2026-07-13
 * Modified     : 2026-07-13
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
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

export interface CustomerMasterTabProps {
  currentUser?: { role: string; name: string } | null;
}

export const CustomerMasterTab: React.FC<CustomerMasterTabProps> = ({ currentUser }) => {
  const isReadOnly = currentUser?.role === "Report User";
  const [customers, setCustomers] = useState<Customer[]>(() => getCustomers());
  const [searchQuery, setSearchQuery] = useState("");
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

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.mobile && c.mobile.includes(searchQuery)) ||
      c.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-theme-surface-1 text-theme-primary font-sans">
      {isReadOnly && (
        <div className="bg-amber-950/40 border-b border-amber-500/30 px-6 py-2.5 flex items-center space-x-2 text-amber-400 text-xs">
          <span className="material-symbols-outlined text-sm">warning</span>
          <span className="font-mono uppercase tracking-wider font-bold">Read-Only Mode:</span>
          <span>Operating under a Read-Only Report User role. Modifying customer profiles is prohibited.</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-theme-divider bg-theme-surface-2 px-6 py-4">
        <div>
          <h2 className="text-xl font-bold font-display text-theme-primary tracking-tight">
            Customer Master Data
          </h2>
          <p className="text-xs text-theme-muted mt-1 max-w-2xl">
            Single source of truth for customer contacts, addresses, credit profiles, and tax registration records.
          </p>
        </div>
      </div>

      <SmritiScrollArea className="flex-1 bg-theme-base p-6">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-theme-primary font-display uppercase tracking-wider">
              Customer Directory
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search customers..."
                className="bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-1.5 text-xs text-theme-body placeholder-theme-muted focus:outline-none focus:border-blue-500 w-64"
              />
              <button 
                onClick={() => {
                  if (isReadOnly) return;
                  setValidationErrors([]);
                  setIsAddingCustomer(true);
                }}
                disabled={isReadOnly}
                className={`bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 ${
                  isReadOnly ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                }`}
              >
                <span>+ New Customer</span>
              </button>
            </div>
          </div>

          {/* Add Customer Modal Overlay */}
          {isAddingCustomer && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-theme-surface-1 border border-theme-divider rounded-2xl w-full max-w-lg shadow-2xl p-6 relative">
                <button
                  onClick={() => setIsAddingCustomer(false)}
                  className="absolute top-4 right-4 text-theme-muted hover:text-theme-body"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>

                <div className="flex justify-between items-center border-b border-theme-divider/50 pb-3 mb-4">
                  <h3 className="text-sm font-bold text-theme-primary uppercase tracking-wider">
                    Register New Customer
                  </h3>
                  <div className="flex bg-theme-surface-2 border border-theme-divider rounded-lg p-0.5">
                    <button
                      type="button"
                      onClick={() => setFormMode("quick")}
                      className={`px-3 py-1 rounded-md text-[10px] uppercase font-bold tracking-wider transition-colors ${
                        formMode === "quick"
                          ? "bg-blue-600 text-white"
                          : "text-theme-muted hover:text-theme-body"
                      }`}
                    >
                      Quick
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormMode("advanced")}
                      className={`px-3 py-1 rounded-md text-[10px] uppercase font-bold tracking-wider transition-colors ${
                        formMode === "advanced"
                          ? "bg-blue-600 text-white"
                          : "text-theme-muted hover:text-theme-body"
                      }`}
                    >
                      Advanced
                    </button>
                  </div>
                </div>

                {validationErrors.length > 0 && (
                  <div className="bg-rose-950/40 border border-rose-500/30 text-rose-300 p-3 rounded-lg text-xs mb-4 space-y-1 font-mono">
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
                      className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg p-2 text-theme-body focus:outline-none focus:border-blue-500"
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
                        className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg p-2 text-theme-body focus:outline-none focus:border-blue-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-theme-muted mb-1 font-bold">Customer Group</label>
                      <select
                        value={newCustomerGroup}
                        onChange={(e) => setNewCustomerGroup(e.target.value)}
                        className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg p-2 text-theme-body focus:outline-none focus:border-blue-500"
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
                            className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg p-2 text-theme-body focus:outline-none focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-theme-muted mb-1 font-bold">Profile Status</label>
                          <select
                            value={newCustomerStatus}
                            onChange={(e) => setNewCustomerStatus(e.target.value as any)}
                            className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg p-2 text-theme-body focus:outline-none focus:border-blue-500"
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
                            className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg p-2 text-theme-body focus:outline-none focus:border-blue-500 font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-theme-muted mb-1 font-bold">PAN</label>
                          <input
                            type="text"
                            value={newCustomerPan}
                            onChange={(e) => setNewCustomerPan(e.target.value)}
                            placeholder="10-character PAN card"
                            className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg p-2 text-theme-body focus:outline-none focus:border-blue-500 font-mono"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="block text-theme-muted mb-1 font-bold">Customer Code</label>
                          <input
                            type="text"
                            value={newCustomerCode}
                            onChange={(e) => setNewCustomerCode(e.target.value)}
                            placeholder="e.g. CUST-MANUAL"
                            className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg p-2 text-theme-body focus:outline-none focus:border-blue-500 font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-theme-muted mb-1 font-bold">Short Name</label>
                          <input
                            type="text"
                            value={newCustomerShortName}
                            onChange={(e) => setNewCustomerShortName(e.target.value)}
                            placeholder="Alias name"
                            className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg p-2 text-theme-body focus:outline-none focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-theme-muted mb-1 font-bold">Salesperson</label>
                          <input
                            type="text"
                            value={newCustomerSalesperson}
                            onChange={(e) => setNewCustomerSalesperson(e.target.value)}
                            placeholder="Sales agent name"
                            className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg p-2 text-theme-body focus:outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="block text-theme-muted mb-1 font-bold">Effective From</label>
                          <input
                            type="date"
                            value={newCustomerEffectiveFrom}
                            onChange={(e) => setNewCustomerEffectiveFrom(e.target.value)}
                            className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg p-2 text-theme-body focus:outline-none focus:border-blue-500 font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-theme-muted mb-1 font-bold">Effective To</label>
                          <input
                            type="date"
                            value={newCustomerEffectiveTo}
                            onChange={(e) => setNewCustomerEffectiveTo(e.target.value)}
                            className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg p-2 text-theme-body focus:outline-none focus:border-blue-500 font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-theme-muted mb-1 font-bold">Sort Order</label>
                          <input
                            type="number"
                            value={newCustomerSortOrder}
                            onChange={(e) => setNewCustomerSortOrder(e.target.value)}
                            placeholder="0"
                            className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg p-2 text-theme-body focus:outline-none focus:border-blue-500 font-mono"
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
                          className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg p-2 text-theme-body focus:outline-none focus:border-blue-500 font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-theme-muted mb-1 font-bold">Notes / Description</label>
                        <textarea
                          value={newCustomerNotes}
                          onChange={(e) => setNewCustomerNotes(e.target.value)}
                          placeholder="Internal business comments..."
                          rows={3}
                          className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg p-2 text-theme-body focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </>
                  )}
                  </div>
                </SmritiScrollArea>

                <div className="flex justify-end gap-2 mt-6 border-t border-theme-divider/50 pt-4">
                  <button
                    onClick={() => setIsAddingCustomer(false)}
                    className="px-4 py-2 border border-theme-divider hover:bg-theme-surface-hover text-theme-muted rounded-lg text-xs font-bold transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRegisterCustomer}
                    disabled={isValidating}
                    className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white px-5 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                  >
                    {isValidating ? "Validating..." : "Register Profile"}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className={`${selectedCustomerId ? "lg:col-span-2" : "lg:col-span-3"} transition-all duration-300`}>
              <div className="bg-theme-surface-2 border border-theme-divider rounded-xl overflow-hidden shadow-lg">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-theme-surface-3 border-b border-theme-divider text-[10px] uppercase tracking-wider text-theme-muted font-mono">
                      <th className="px-6 py-4 font-semibold">Customer ID</th>
                      <th className="px-6 py-4 font-semibold">Name</th>
                      <th className="px-6 py-4 font-semibold">Contact / Email</th>
                      <th className="px-6 py-4 font-semibold">GSTIN</th>
                      <th className="px-6 py-4 font-semibold text-right">Outstanding Credit</th>
                      <th className="px-6 py-4 font-semibold text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs divide-y divide-theme-divider">
                    {filteredCustomers.map((c) => (
                      <tr 
                        key={c.id} 
                        onClick={() => setSelectedCustomerId(c.id)}
                        className={`hover:bg-theme-surface-hover transition-colors cursor-pointer ${selectedCustomerId === c.id ? "bg-theme-surface-3" : ""}`}
                      >
                        <td className="px-6 py-4 font-mono font-bold text-blue-400">{c.id}</td>
                        <td className="px-6 py-4 font-medium text-theme-body font-display">{c.name}</td>
                        <td className="px-6 py-4 text-theme-muted">
                          <div>{c.mobile || "—"}</div>
                          <div className="text-[10px] opacity-80">{c.email || ""}</div>
                        </td>
                        <td className="px-6 py-4 font-mono">{c.gstNumber || "—"}</td>
                        <td className="px-6 py-4 text-right font-mono text-emerald-400 font-medium">
                          ₹{c.outstanding.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            c.status === "Active" ? "bg-emerald-950 text-emerald-400 border border-emerald-500/30" :
                            c.status === "Inactive" ? "bg-slate-700 text-slate-300" :
                            "bg-rose-950 text-rose-400 border border-rose-500/30 font-bold animate-pulse"
                          }`}>
                            {c.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {selectedCustomerId && (() => {
              const selectedCustomer = customers.find(c => c.id === selectedCustomerId);
              return selectedCustomer ? (
                <div className="space-y-6 lg:col-span-1">
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
        </div>
      </SmritiScrollArea>
    </div>
  );
};
