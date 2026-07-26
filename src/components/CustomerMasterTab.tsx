/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Version      : 6.0.0  (SEEF Phase 6 — SEEFListReport + SEEFObjectPage Cascade Integration)
 * Created      : 2026-07-13
 * Modified     : 2026-07-26
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 *
 * WNG-002: Master Entity Pattern — Customer Master Data
 * List Report Pattern (Directory view) + Object Page Pattern (Entity view)
 */

import React, { useState, useEffect } from "react";
import { SmritiScrollArea } from "./SmritiScrollArea.tsx";
import { getCustomers, saveCustomers, getCustomerGroups } from "../services/customerStore.ts";
import { Customer, AdditionalAddress } from "../types";
import { recordAuditAction } from "../lib/apiFetch.ts";
import { CustomerLedger } from "./customer/CustomerLedger.tsx";
import { validateCustomerProfile } from "../services/customerValidation.ts";
import { apiFetchV1 } from "../lib/apiFetchV1.ts";
// SEEF Phase 6 — SEEF-upgraded primitives with backward-compatible aliases
import { FioriListReport, ListReportColumn } from "./common/FioriListReport.tsx";
export { FioriListReport as SEEFListReport };
import { FioriObjectPage, ObjectPageTab, ObjectPageMetric } from "./common/FioriObjectPage.tsx";
export { FioriObjectPage as SEEFObjectPage };
import { useSEEF } from "../layout_engine/SEEFContext.tsx";

export interface CustomerMasterTabProps {
  currentUser?: { role: string; name: string } | null;
}

export const CustomerMasterTab: React.FC<CustomerMasterTabProps> = ({ currentUser }) => {
  const isReadOnly = currentUser?.role === "Report User";
  const [customers, setCustomers] = useState<Customer[]>(() => getCustomers());
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
  const [newCustomerPricingGroup, setNewCustomerPricingGroup] = useState<string>("");
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isValidating, setIsValidating] = useState(false);

  // Address management state variables
  const [newBillingLine1, setNewBillingLine1] = useState("");
  const [newBillingLine2, setNewBillingLine2] = useState("");
  const [newBillingCity, setNewBillingCity] = useState("");
  const [newBillingState, setNewBillingState] = useState("");
  const [newBillingCountry, setNewBillingCountry] = useState("India");
  const [newBillingPincode, setNewBillingPincode] = useState("");

  const [newShippingSameAsBilling, setNewShippingSameAsBilling] = useState(true);

  const [newShippingLine1, setNewShippingLine1] = useState("");
  const [newShippingLine2, setNewShippingLine2] = useState("");
  const [newShippingCity, setNewShippingCity] = useState("");
  const [newShippingState, setNewShippingState] = useState("");
  const [newShippingCountry, setNewShippingCountry] = useState("India");
  const [newShippingPincode, setNewShippingPincode] = useState("");

  const [newAdditionalAddresses, setNewAdditionalAddresses] = useState<AdditionalAddress[]>([]);

  // State for single new additional address input form
  const [newAddLabel, setNewAddLabel] = useState("");
  const [newAddType, setNewAddType] = useState<AdditionalAddress["address_type"]>("Warehouse");
  const [newAddLine1, setNewAddLine1] = useState("");
  const [newAddLine2, setNewAddLine2] = useState("");
  const [newAddCity, setNewAddCity] = useState("");
  const [newAddState, setNewAddState] = useState("");
  const [newAddCountry, setNewAddCountry] = useState("India");
  const [newAddPincode, setNewAddPincode] = useState("");
  const [newAddGstin, setNewAddGstin] = useState("");
  const [newAddIsDefault, setNewAddIsDefault] = useState(false);

  const handleAddAdditionalAddress = () => {
    if (!newAddLabel.trim()) {
      alert("Address Label is required (e.g. Warehouse 1)");
      return;
    }
    if (!newAddLine1.trim() || !newAddCity.trim() || !newAddState.trim() || !newAddPincode.trim()) {
      alert("Line 1, City, State, and Pincode are required.");
      return;
    }
    if (newAdditionalAddresses.length >= 10) {
      alert("Maximum limit of 10 additional addresses reached.");
      return;
    }
    const newAddr: AdditionalAddress = {
      label: newAddLabel.trim(),
      address_type: newAddType,
      line1: newAddLine1.trim(),
      line2: newAddLine2.trim() || undefined,
      city: newAddCity.trim(),
      state: newAddState.trim(),
      country: newAddCountry.trim(),
      pincode: newAddPincode.trim(),
      gstin: newAddGstin.trim() || undefined,
      is_default_shipping: newAddIsDefault,
    };

    setNewAdditionalAddresses([...newAdditionalAddresses, newAddr]);
    setNewAddLabel("");
    setNewAddType("Warehouse");
    setNewAddLine1("");
    setNewAddLine2("");
    setNewAddCity("");
    setNewAddState("");
    setNewAddCountry("India");
    setNewAddPincode("");
    setNewAddGstin("");
    setNewAddIsDefault(false);
  };

  const handleRemoveAdditionalAddress = (idx: number) => {
    setNewAdditionalAddresses(newAdditionalAddresses.filter((_, i) => i !== idx));
  };

  const [pricingGroups, setPricingGroups] = useState<{ id: string; name: string; discount_percent: number }[]>([]);
  const customerGroups = getCustomerGroups();

  useEffect(() => {
    if (!isAddingCustomer) return;
    apiFetchV1("/crm/pricing-groups")
      .then((data: any) => {
        if (Array.isArray(data)) setPricingGroups(data);
        else if (data?.items) setPricingGroups(data.items);
      })
      .catch(() => setPricingGroups([]));
  }, [isAddingCustomer]);

  const handleRegisterCustomer = async () => {
    if (isReadOnly) {
      setValidationErrors(["Access Denied: Read-only operators cannot register new profiles."]);
      return;
    }
    setIsValidating(true);
    setValidationErrors([]);

    const payload: Partial<Customer> = {
      name: newCustomerName.trim(),
      mobile: newCustomerMobile.trim(),
      email: newCustomerEmail.trim() || undefined,
      gstNumber: newCustomerGst.trim() || undefined,
      pan: newCustomerPan.trim() || undefined,
      customerGroupId: newCustomerGroup,
      status: newCustomerStatus,
      code: newCustomerCode.trim() || undefined,
      shortName: newCustomerShortName.trim() || undefined,
      notes: newCustomerNotes.trim() || undefined,
      tags: newCustomerTags ? newCustomerTags.split(",").map((t) => t.trim()).filter(Boolean) : undefined,
      effectiveFrom: newCustomerEffectiveFrom || undefined,
      effectiveTo: newCustomerEffectiveTo || undefined,
      sortOrder: newCustomerSortOrder ? parseInt(newCustomerSortOrder, 10) : undefined,
      salesperson: newCustomerSalesperson.trim() || undefined,
      pricingGroupId: newCustomerPricingGroup || undefined,
      billingAddressLine1: newBillingLine1.trim() || undefined,
      billingAddressLine2: newBillingLine2.trim() || undefined,
      billingCity: newBillingCity.trim() || undefined,
      billingState: newBillingState.trim() || undefined,
      billingCountry: newBillingCountry.trim() || "India",
      billingPincode: newBillingPincode.trim() || undefined,
      shippingSameAsBilling: newShippingSameAsBilling,
      shippingAddressLine1: newShippingSameAsBilling ? newBillingLine1.trim() || undefined : newShippingLine1.trim() || undefined,
      shippingAddressLine2: newShippingSameAsBilling ? newBillingLine2.trim() || undefined : newShippingLine2.trim() || undefined,
      shippingCity: newShippingSameAsBilling ? newBillingCity.trim() || undefined : newShippingCity.trim() || undefined,
      shippingState: newShippingSameAsBilling ? newBillingState.trim() || undefined : newShippingState.trim() || undefined,
      shippingCountry: newShippingSameAsBilling ? newBillingCountry.trim() || "India" : newShippingCountry.trim() || "India",
      shippingPincode: newShippingSameAsBilling ? newBillingPincode.trim() || undefined : newShippingPincode.trim() || undefined,
      additionalAddresses: newAdditionalAddresses.length > 0 ? newAdditionalAddresses : undefined,
    };

    try {
      const valResult = await validateCustomerProfile(payload);
      if (!valResult.valid) {
        setValidationErrors(valResult.errors);
        setIsValidating(false);
        return;
      }

      const generatedId = `CUST-${Date.now().toString().slice(-6)}`;
      const created: Customer = {
        id: generatedId,
        name: payload.name!,
        mobile: payload.mobile!,
        email: payload.email,
        gstNumber: payload.gstNumber,
        pan: payload.pan,
        customerGroupId: payload.customerGroupId || "CG-Retail",
        outstanding: 0,
        status: payload.status || "Active",
        code: payload.code,
        shortName: payload.shortName,
        notes: payload.notes,
        tags: payload.tags,
        effectiveFrom: payload.effectiveFrom,
        effectiveTo: payload.effectiveTo,
        sortOrder: payload.sortOrder,
        salesperson: payload.salesperson,
        pricingGroupId: payload.pricingGroupId,
        billingAddressLine1: payload.billingAddressLine1,
        billingAddressLine2: payload.billingAddressLine2,
        billingCity: payload.billingCity,
        billingState: payload.billingState,
        billingCountry: payload.billingCountry,
        billingPincode: payload.billingPincode,
        shippingSameAsBilling: payload.shippingSameAsBilling,
        shippingAddressLine1: payload.shippingAddressLine1,
        shippingAddressLine2: payload.shippingAddressLine2,
        shippingCity: payload.shippingCity,
        shippingState: payload.shippingState,
        shippingCountry: payload.shippingCountry,
        shippingPincode: payload.shippingPincode,
        additionalAddresses: payload.additionalAddresses,
      };

      const updated = [created, ...customers];
      setCustomers(updated);
      saveCustomers(updated);
      recordAuditAction("CREATE", "customers", created.id, `Registered customer profile: ${created.name}`);

      setIsAddingCustomer(false);
      setIsValidating(false);
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
      setNewBillingLine1("");
      setNewBillingLine2("");
      setNewBillingCity("");
      setNewBillingState("");
      setNewBillingCountry("India");
      setNewBillingPincode("");
      setNewShippingSameAsBilling(true);
      setNewShippingLine1("");
      setNewShippingLine2("");
      setNewShippingCity("");
      setNewShippingState("");
      setNewShippingCountry("India");
      setNewShippingPincode("");
      setNewAdditionalAddresses([]);
    } catch (err) {
      console.error(err);
      setValidationErrors(["Smriti Network validation timed out. Please try again."]);
      setIsValidating(false);
    }
  };

  useEffect(() => {
    if (selectedCustomerId) {
      const selected = customers.find((c) => c.id === selectedCustomerId);
      if (selected) {
        recordAuditAction("TRANSACTION_VIEW", "customers", selected.id, `Viewed customer master details: ${selected.name}`);
      }
    }
  }, [selectedCustomerId, customers]);

  // WNG-002 Columns for List Report Pattern
  const COLUMNS: ListReportColumn<Customer>[] = [
    {
      key: "id",
      label: "Customer ID",
      render: (c) => <span className="font-mono font-bold text-cyan-400">{c.id}</span>,
    },
    {
      key: "name",
      label: "Name",
      render: (c) => (
        <div>
          <div className="font-semibold text-slate-100">{c.name}</div>
          {c.shortName && <div className="text-[10px] text-slate-500 font-mono">{c.shortName}</div>}
        </div>
      ),
    },
    {
      key: "mobile",
      label: "Contact / Email",
      render: (c) => (
        <div className="text-slate-300">
          <div>{c.mobile || "—"}</div>
          <div className="text-[10px] text-slate-500">{c.email || ""}</div>
        </div>
      ),
    },
    {
      key: "gstNumber",
      label: "GSTIN",
      render: (c) => <span className="font-mono text-slate-400">{c.gstNumber || "—"}</span>,
    },
    {
      key: "outstanding",
      label: "Outstanding Credit",
      align: "right",
      render: (c) => (
        <span className="font-mono font-bold text-emerald-400">
          ₹{c.outstanding.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      align: "center",
      render: (c) => (
        <span
          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
            c.status === "Active"
              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
              : c.status === "Inactive"
              ? "bg-slate-500/10 text-slate-400 border border-slate-500/30"
              : "bg-rose-500/10 text-rose-400 border border-rose-500/30"
          }`}
        >
          {c.status}
        </span>
      ),
    },
  ];

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

  // If a customer is selected, render the WNG-002 Object Page Pattern
  if (selectedCustomer) {
    const objectPageTabs: ObjectPageTab[] = [
      {
        id: "profile",
        label: "Profile & Identity",
        content: (
          <div className="space-y-6 max-w-4xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-3">
                <span className="text-[10px] font-mono uppercase text-slate-500 tracking-wider block font-bold">
                  Basic Contact Information
                </span>
                <div>
                  <span className="text-slate-500 text-xs block">Full Name</span>
                  <span className="font-semibold text-slate-100 text-sm">{selectedCustomer.name}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-xs block">Mobile Number</span>
                  <span className="font-mono text-slate-200">{selectedCustomer.mobile || "Unregistered"}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-xs block">Email Address</span>
                  <span className="text-slate-200">{selectedCustomer.email || "Unregistered"}</span>
                </div>
                {selectedCustomer.salesperson && (
                  <div>
                    <span className="text-slate-500 text-xs block">Salesperson</span>
                    <span className="text-slate-200">{selectedCustomer.salesperson}</span>
                  </div>
                )}
              </div>

              <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-3">
                <span className="text-[10px] font-mono uppercase text-slate-500 tracking-wider block font-bold">
                  Taxation & Risk Classification
                </span>
                <div>
                  <span className="text-slate-500 text-xs block">GSTIN Registration</span>
                  <span className="font-mono font-bold text-cyan-400">{selectedCustomer.gstNumber || "Unregistered"}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-xs block">PAN</span>
                  <span className="font-mono text-slate-200">{selectedCustomer.pan || "Unregistered"}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-xs block">Customer Group</span>
                  <span className="font-mono text-slate-200">{selectedCustomer.customerGroupId}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-xs block">Pricing Group</span>
                  <span className="font-mono text-slate-200">{selectedCustomer.pricingGroupId || "Standard Pricing"}</span>
                </div>
              </div>
            </div>

            {selectedCustomer.tags && selectedCustomer.tags.length > 0 && (
              <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                <span className="text-[10px] font-mono uppercase text-slate-500 tracking-wider block font-bold mb-2">
                  Customer Tags
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {selectedCustomer.tags.map((tag, idx) => (
                    <span key={idx} className="bg-slate-800 border border-slate-700 text-cyan-300 text-xs px-2 py-0.5 rounded font-mono">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {selectedCustomer.notes && (
              <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                <span className="text-[10px] font-mono uppercase text-slate-500 tracking-wider block font-bold mb-1">
                  Internal Business Comments
                </span>
                <p className="text-slate-300 text-xs leading-relaxed whitespace-pre-wrap">{selectedCustomer.notes}</p>
              </div>
            )}
          </div>
        ),
      },
      {
        id: "addresses",
        label: "Addresses & Locations",
        content: (
          <div className="space-y-4 max-w-4xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-2">
                <span className="text-[10px] font-mono uppercase text-slate-400 tracking-wider font-bold block">
                  Billing Address
                </span>
                {selectedCustomer.billingAddressLine1 ? (
                  <p className="text-slate-200 text-xs leading-relaxed">
                    {selectedCustomer.billingAddressLine1}
                    {selectedCustomer.billingAddressLine2 ? `, ${selectedCustomer.billingAddressLine2}` : ""}
                    <br />
                    {selectedCustomer.billingCity}, {selectedCustomer.billingState} - {selectedCustomer.billingPincode}
                    {selectedCustomer.billingCountry && `, ${selectedCustomer.billingCountry}`}
                  </p>
                ) : (
                  <p className="text-slate-500 italic text-xs">No billing address listed.</p>
                )}
              </div>

              <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-2">
                <span className="text-[10px] font-mono uppercase text-slate-400 tracking-wider font-bold block">
                  Shipping Address
                </span>
                {selectedCustomer.shippingSameAsBilling !== false ? (
                  <p className="text-slate-400 italic text-xs">Same as Billing Address</p>
                ) : selectedCustomer.shippingAddressLine1 ? (
                  <p className="text-slate-200 text-xs leading-relaxed">
                    {selectedCustomer.shippingAddressLine1}
                    {selectedCustomer.shippingAddressLine2 ? `, ${selectedCustomer.shippingAddressLine2}` : ""}
                    <br />
                    {selectedCustomer.shippingCity}, {selectedCustomer.shippingState} - {selectedCustomer.shippingPincode}
                    {selectedCustomer.shippingCountry && `, ${selectedCustomer.shippingCountry}`}
                  </p>
                ) : (
                  <p className="text-slate-500 italic text-xs">No shipping address listed.</p>
                )}
              </div>
            </div>

            {selectedCustomer.additionalAddresses && selectedCustomer.additionalAddresses.length > 0 && (
              <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-3">
                <span className="text-[10px] font-mono uppercase text-slate-400 tracking-wider font-bold block">
                  Additional Linked Locations ({selectedCustomer.additionalAddresses.length})
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {selectedCustomer.additionalAddresses.map((addr, idx) => (
                    <div key={idx} className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-200">{addr.label}</span>
                        <span className="bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded text-[9px] font-mono uppercase">
                          {addr.address_type}
                        </span>
                      </div>
                      <p className="text-slate-400 leading-snug">
                        {addr.line1}, {addr.city}, {addr.state} - {addr.pincode}
                      </p>
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
          <div className="max-w-4xl">
            <CustomerLedger customer={selectedCustomer} />
          </div>
        ),
      },
    ];

    const metrics: ObjectPageMetric[] = [
      { label: "Outstanding Credit", value: `₹${selectedCustomer.outstanding.toLocaleString("en-IN")}`, highlight: true },
      { label: "GSTIN", value: selectedCustomer.gstNumber || "Unregistered" },
      { label: "Customer Group", value: selectedCustomer.customerGroupId || "CG-Retail" },
      { label: "Pricing Tier", value: selectedCustomer.pricingGroupId || "Standard" },
    ];

    return (
      <div className="flex flex-col h-full bg-slate-950 p-6">
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

  // WNG-002 Directory view: List Report Pattern
  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100">
      {/* Read-Only Banner */}
      {isReadOnly && (
        <div className="bg-amber-950/40 border-b border-amber-500/30 px-6 py-2.5 flex items-center space-x-2 text-amber-400 text-xs flex-shrink-0">
          <span className="material-symbols-outlined text-sm">warning</span>
          <span className="font-mono uppercase tracking-wider font-bold">Read-Only Mode:</span>
          <span>Operating under a Read-Only Report User role. Modifying customer profiles is prohibited.</span>
        </div>
      )}

      {/* List Report View */}
      <div className="flex-1 overflow-hidden">
        <FioriListReport<Customer>
          title="Customer Master Data"
          subtitle="Single source of truth for customer contacts, addresses, credit profiles, and tax registration records"
          data={customers}
          columns={COLUMNS}
          onRowClick={(c) => setSelectedCustomerId(c.id)}
          searchPlaceholder="Search customers by name, mobile, GSTIN, or ID..."
          primaryAction={
            !isReadOnly
              ? {
                  label: "Register New Customer",
                  onClick: () => {
                    setValidationErrors([]);
                    setIsAddingCustomer(true);
                  },
                }
              : undefined
          }
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

      {/* Add Customer Modal Overlay */}
      {isAddingCustomer && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 relative text-slate-100">
            <button
              onClick={() => setIsAddingCustomer(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>

            <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Register New Customer Profile
              </h3>
              <div className="flex bg-slate-950 border border-slate-800 rounded-lg p-0.5">
                <button
                  type="button"
                  onClick={() => setFormMode("quick")}
                  className={`px-3 py-1 rounded-md text-[10px] uppercase font-bold tracking-wider transition-colors ${
                    formMode === "quick" ? "bg-cyan-500 text-slate-950" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Quick
                </button>
                <button
                  type="button"
                  onClick={() => setFormMode("advanced")}
                  className={`px-3 py-1 rounded-md text-[10px] uppercase font-bold tracking-wider transition-colors ${
                    formMode === "advanced" ? "bg-cyan-500 text-slate-950" : "text-slate-400 hover:text-slate-200"
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

            <SmritiScrollArea maxHeight="60vh" className="text-xs" fadeColorClass="from-slate-900">
              <div className="space-y-4 pr-2">
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Full Name *</label>
                  <input
                    type="text"
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                    placeholder="e.g. John Doe"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-400 mb-1 font-bold">Mobile *</label>
                    <input
                      type="text"
                      value={newCustomerMobile}
                      onChange={(e) => setNewCustomerMobile(e.target.value)}
                      placeholder="10-digit number"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 focus:outline-none focus:border-cyan-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1 font-bold">Customer Group</label>
                    <select
                      value={newCustomerGroup}
                      onChange={(e) => setNewCustomerGroup(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 focus:outline-none focus:border-cyan-500"
                    >
                      {customerGroups.map((cg) => (
                        <option key={cg.id} value={cg.id}>
                          {cg.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-bold flex items-center gap-1.5">
                    Pricing Group
                  </label>
                  <select
                    value={newCustomerPricingGroup}
                    onChange={(e) => setNewCustomerPricingGroup(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="">Standard Retail Price</option>
                    {pricingGroups.map((pg) => (
                      <option key={pg.id} value={pg.id}>
                        {pg.name} ({pg.discount_percent}% off)
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </SmritiScrollArea>

            <div className="flex justify-end gap-2 mt-6 border-t border-slate-800 pt-4">
              <button
                onClick={() => setIsAddingCustomer(false)}
                className="px-4 py-2 border border-slate-800 hover:bg-slate-800 text-slate-300 rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleRegisterCustomer}
                disabled={isValidating}
                className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-5 py-2 rounded-lg text-xs transition-colors cursor-pointer disabled:opacity-50"
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
