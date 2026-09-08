/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 4.12.0
 * Created      : 2026-08-24
 * Modified     : 2026-09-07
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState } from "react";
import {
  Download,
  History,
  Printer,
  Plus,
  MoreHorizontal,
  ArrowRight,
  Building2,
  FileText,
  Truck,
  MapPin,
  CreditCard,
  UserCheck,
  X,
  ExternalLink,
  ChevronDown
} from "lucide-react";
import { TaxInvoiceDocumentState } from "../types.ts";

export interface TaxInvoiceDocumentPanelProps {
  docState: TaxInvoiceDocumentState;
  onChange: (updates: Partial<TaxInvoiceDocumentState>) => void;
  onCustomerSearchOpen: () => void;
  onAddCustomerOpen: () => void;
  onImportClick: () => void;
  onRecallClick: () => void;
  onSaveClick?: () => void;
  onNewClick?: () => void;
  onPrintClick?: () => void;
  netAmount?: number;
  staffList?: { id: string; name: string }[];
  customerGstRegistrations?: any[];
  customerDeliveryLocations?: any[];
  customerBillingLocations?: any[];
  isLoadingB2BData?: boolean;
  initialActivePopover?: string | null;
}

export const TaxInvoiceDoc: React.FC<TaxInvoiceDocumentPanelProps> = ({
  docState,
  onChange,
  onCustomerSearchOpen,
  onAddCustomerOpen,
  onImportClick,
  onRecallClick,
  onSaveClick,
  onNewClick,
  onPrintClick,
  netAmount = 0,
  staffList = [
    { id: "EMP001", name: "EMP001 - Jawahar Mallah" },
    { id: "EMP002", name: "EMP002 - John Doe" },
    { id: "EMP003", name: "EMP003 - Jane Smith" },
  ],
  customerGstRegistrations = [],
  customerDeliveryLocations = [],
  customerBillingLocations = [],
  isLoadingB2BData = false,
  initialActivePopover = null,
}) => {
  const [activePopover, setActivePopover] = useState<string | null>(initialActivePopover);

  const togglePopover = (name: string) => {
    setActivePopover((prev) => (prev === name ? null : name));
  };

  const isInterstate = docState.transactionMode === "Interstate Sale";

  return (
    <div className="flex flex-col flex-none border-b border-slate-200 bg-white shadow-2xs select-none">
      {/* ─── LAYER 1: Billing Workspace Controls Bar ───────────────────────────────── */}
      <section
        className="bg-white px-4 py-2 flex flex-wrap items-center justify-between border-b border-slate-200 gap-3"
        data-purpose="billing-control-bar"
      >
        <div className="flex items-center space-x-4 flex-wrap gap-y-2">
          {/* Title & Document Category */}
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-200 shadow-2xs">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight leading-none">
                Speed Invoice
              </h1>
              <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">
                DISTRIBUTOR WORKSPACE
              </span>
            </div>
          </div>

          {/* Vertical Divider */}
          <div className="hidden sm:block h-7 w-px bg-slate-200"></div>

          {/* Selector: Bill Type */}
          <div className="flex flex-col">
            <label className="text-[10px] text-slate-500 font-semibold tracking-wider uppercase leading-tight">
              Bill Type
            </label>
            <select
              value={docState.billType}
              onChange={(e) => onChange({ billType: e.target.value as any })}
              className="text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded px-2 py-1 mt-0.5 min-w-[120px] focus:outline-none focus:border-blue-600 cursor-pointer"
            >
              <option value="Product">📦 Product</option>
              <option value="Tax Invoice">📄 Tax Invoice</option>
              <option value="Service">🛠 Service</option>
              <option value="Bill of Supply">📑 Bill of Supply</option>
              <option value="Credit Note">↩ Credit Note</option>
            </select>
          </div>

          {/* Selector: Txn Type */}
          <div className="flex flex-col">
            <label className="text-[10px] text-slate-500 font-semibold tracking-wider uppercase leading-tight">
              Txn Type
            </label>
            <select
              value={docState.transactionMode}
              onChange={(e) => onChange({ transactionMode: e.target.value as any })}
              className="text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded px-2 py-1 mt-0.5 min-w-[120px] focus:outline-none focus:border-blue-600 cursor-pointer"
            >
              <option value="Tax Invoice">⇄ Regular / Local</option>
              <option value="Interstate Sale">⇄ Interstate Sale (IGST)</option>
              <option value="Export (Zero Rated)">✈ Export (Zero Rated)</option>
              <option value="SEZ Supply">🏢 SEZ Supply</option>
            </select>
          </div>

          {/* Doc Series & Number */}
          <div className="flex flex-col">
            <label className="text-[10px] text-slate-500 font-semibold tracking-wider uppercase leading-tight">
              Doc No.
            </label>
            <div className="inline-flex items-center text-xs font-mono font-bold text-slate-800 bg-slate-50 border border-slate-300 rounded px-2.5 py-1 mt-0.5 space-x-1.5 shadow-2xs">
              <span className="text-slate-500">#</span>
              <span>{docState.docPrefix || "D1DS13"} / {docState.docNo || "1"}</span>
            </div>
          </div>
        </div>

        {/* Right Quick Actions */}
        <div className="flex items-center space-x-2">
          {onNewClick && (
            <button
              type="button"
              onClick={onNewClick}
              className="flex items-center space-x-1 px-2.5 py-1 rounded text-slate-700 hover:bg-slate-100 text-xs font-medium border border-slate-200 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-blue-600" />
              <span>New</span>
            </button>
          )}
          <button
            type="button"
            onClick={onImportClick}
            className="flex items-center space-x-1 px-2.5 py-1 rounded text-slate-700 hover:bg-slate-100 text-xs font-medium border border-slate-200 transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            <span>Import</span>
          </button>
          <button
            type="button"
            onClick={onRecallClick}
            className="flex items-center space-x-1 px-2.5 py-1 rounded text-slate-700 hover:bg-slate-100 text-xs font-medium border border-slate-200 transition cursor-pointer"
          >
            <History className="w-3.5 h-3.5 text-slate-600" />
            <span>Recall</span>
          </button>
          {onPrintClick && (
            <button
              type="button"
              onClick={onPrintClick}
              className="flex items-center space-x-1 px-2.5 py-1 rounded text-slate-700 hover:bg-slate-100 text-xs font-medium border border-slate-200 transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-slate-600" />
              <span>Print</span>
            </button>
          )}

          {/* Primary Action CTA */}
          {onSaveClick && (
            <button
              type="button"
              onClick={onSaveClick}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded bg-[#0066cc] hover:bg-[#0052a3] text-white font-bold text-xs tracking-wide shadow-sm transition active:scale-95 cursor-pointer ml-1"
            >
              <span>Settle &amp; Save (F8)</span>
            </button>
          )}
        </div>
      </section>

      {/* ─── LAYER 2: 8 High-Fidelity Transaction Context Cards Ribbon ─────────────── */}
      <section
        className="bg-white px-3 py-2 border-b border-slate-200 overflow-x-auto shadow-2xs"
        data-purpose="transaction-context-strip"
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 min-w-[1100px]">
          {/* Card 1: Customer (Active State) */}
          <div
            onClick={() => togglePopover("customer")}
            className="group relative bg-[#f0f7ff] border-2 border-blue-500 rounded-lg p-2 cursor-pointer transition-all duration-150 hover:shadow-md flex items-center space-x-2.5"
          >
            <div className="w-8 h-8 rounded bg-blue-600 text-white flex items-center justify-center flex-none font-bold text-sm shadow-xs">
              <Building2 className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider leading-none">
                Customer
              </div>
              <div className="text-xs font-bold text-blue-950 truncate mt-0.5 leading-tight">
                {docState.customerName || "Select Customer (F2)"}
              </div>
              <div className="text-[11px] font-mono text-slate-500 leading-none mt-0.5">
                {docState.customerCode || "WALK-IN"}
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-blue-500 flex-none" />
          </div>

          {/* Card 2: GST */}
          <div
            onClick={() => togglePopover("gst")}
            className="group relative bg-white border border-slate-200 hover:border-slate-300 rounded-lg p-2 cursor-pointer transition-all duration-150 hover:shadow-md flex items-center space-x-2.5"
          >
            <div className="w-8 h-8 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center flex-none font-bold text-sm">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider leading-none">
                GST
              </div>
              <div className="text-xs font-bold text-slate-800 font-mono truncate mt-0.5 leading-tight">
                {docState.customerGstin ? `${docState.customerGstin.slice(0, 10)}...` : "Unregistered"}
              </div>
              <div className="text-[11px] text-slate-500 leading-none mt-0.5">
                {docState.customerGstin ? `State (${docState.customerGstin.slice(0, 2)})` : "Retail / B2C"}
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 flex-none" />
          </div>

          {/* Card 3: Bill To */}
          <div
            onClick={() => togglePopover("billing")}
            className="group relative bg-white border border-slate-200 hover:border-slate-300 rounded-lg p-2 cursor-pointer transition-all duration-150 hover:shadow-md flex items-center space-x-2.5"
          >
            <div className="w-8 h-8 rounded bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center flex-none font-bold text-sm">
              <MapPin className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider leading-none">
                Bill To
              </div>
              <div className="text-xs font-bold text-slate-800 truncate mt-0.5 leading-tight font-mono">
                {docState.billingStoreCode || "BILL-A"}
              </div>
              <div className="text-[11px] text-slate-500 leading-none mt-0.5">
                {customerBillingLocations.length > 0 ? `${customerBillingLocations.length} Sites` : "1 Location"}
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 flex-none" />
          </div>

          {/* Card 4: Ship To */}
          <div
            onClick={() => togglePopover("delivery")}
            className="group relative bg-white border border-slate-200 hover:border-slate-300 rounded-lg p-2 cursor-pointer transition-all duration-150 hover:shadow-md flex items-center space-x-2.5"
          >
            <div className="w-8 h-8 rounded bg-orange-50 text-orange-700 border border-orange-200 flex items-center justify-center flex-none font-bold text-sm">
              <Truck className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider leading-none">
                Ship To
              </div>
              <div className="text-xs font-bold text-slate-800 truncate mt-0.5 leading-tight font-mono">
                {docState.deliveryStoreCode || "8361"}
              </div>
              <div className="text-[11px] text-slate-500 leading-none mt-0.5">
                {customerDeliveryLocations.length > 0 ? `${customerDeliveryLocations.length} Stores` : "1 Location"}
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 flex-none" />
          </div>

          {/* Card 5: POS (Place of Supply) */}
          <div
            onClick={() => togglePopover("delivery")}
            className="group relative bg-white border border-slate-200 hover:border-slate-300 rounded-lg p-2 cursor-pointer transition-all duration-150 hover:shadow-md flex items-center space-x-2.5"
          >
            <div className="w-8 h-8 rounded bg-sky-50 text-sky-700 border border-sky-200 flex items-center justify-center flex-none font-bold text-sm">
              <MapPin className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider leading-none">
                POS
              </div>
              <div className="text-xs font-bold text-slate-800 truncate mt-0.5 leading-tight">
                {docState.placeOfSupplyCode ? `State (${docState.placeOfSupplyCode})` : (isInterstate ? "Assam (18)" : "Local (27)")}
              </div>
              <div className={`text-[10px] leading-none mt-0.5 font-medium ${isInterstate ? "text-blue-600" : "text-emerald-600"}`}>
                {isInterstate ? "Inter-State (IGST)" : "Intra-State"}
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 flex-none" />
          </div>

          {/* Card 6: Payment / Credit Details */}
          <div
            onClick={() => togglePopover("credit")}
            className="group relative bg-white border border-slate-200 hover:border-slate-300 rounded-lg p-2 cursor-pointer transition-all duration-150 hover:shadow-md flex items-center space-x-2.5"
          >
            <div className="w-8 h-8 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center justify-center flex-none font-bold text-sm">
              <CreditCard className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider leading-none">
                Payment
              </div>
              <div className="text-xs font-bold text-slate-800 truncate mt-0.5 leading-tight">
                {docState.paymentDetails.some(p => (p.mode || "").toUpperCase() === "CREDIT") ? "Credit Account" : (docState.paymentDetails[0]?.mode || "Cash / Direct")}
              </div>
              <div className="text-[11px] text-slate-500 leading-none mt-0.5 font-mono">
                {docState.paymentDetails.some(p => (p.mode || "").toUpperCase() === "CREDIT") ? "Net 60" : "Settled"}
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 flex-none" />
          </div>

          {/* Card 7: Sales Staff */}
          <div className="group relative bg-white border border-slate-200 hover:border-slate-300 rounded-lg p-2 cursor-pointer transition-all duration-150 hover:shadow-md flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded bg-teal-50 text-teal-700 border border-teal-200 flex items-center justify-center flex-none font-bold text-sm">
              <UserCheck className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider leading-none">
                Sales Staff
              </div>
              <div className="text-xs font-bold text-slate-800 truncate mt-0.5 leading-tight">
                {docState.salesStaff ? docState.salesStaff.split("-")[1]?.trim() || docState.salesStaff : "Staff"}
              </div>
              <div className="text-[11px] text-slate-500 leading-none mt-0.5 font-mono">
                {docState.salesStaff ? docState.salesStaff.split("-")[0]?.trim() || "EMP001" : "EMP001"}
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 flex-none" />
          </div>

          {/* Card 8: Quick Net Amount Box */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 flex flex-col justify-center items-end text-right">
            <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider leading-tight">
              Net Amount
            </span>
            <span className="text-sm lg:text-base font-extrabold text-slate-900 font-mono leading-none mt-0.5">
              ₹{netAmount.toFixed(2)}
            </span>
          </div>
        </div>
      </section>

      {/* ─── LAYER 3: Interactive Popover Panels ──────────────────────────────────── */}
      {activePopover && (
        <section
          className="bg-slate-100 px-3 py-2 border-b border-slate-200 animate-in fade-in duration-150"
          data-purpose="active-context-popovers"
        >
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {/* Popover 1: Customer Details */}
            {activePopover === "customer" && (
              <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-3 flex flex-col justify-between text-xs md:col-span-2">
                <div>
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2">
                    <h3 className="font-bold text-slate-900 text-xs">Customer Master &amp; Credit</h3>
                    <button
                      type="button"
                      onClick={() => setActivePopover(null)}
                      className="text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Name:</span>
                      <span className="font-bold text-slate-800 text-right truncate max-w-[200px]">
                        {docState.customerName || "Not Assigned"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Code:</span>
                      <span className="font-mono font-bold text-slate-800">
                        {docState.customerCode || "CUST-WALK-IN"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Mobile:</span>
                      <span className="font-mono text-slate-700">{docState.customerMobile || "-"}</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-slate-100">
                      <span className="text-slate-500">Credit Limit:</span>
                      <span className="font-mono font-bold text-slate-800">₹5,00,000.00</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Outstanding:</span>
                      <span className="font-mono font-bold text-slate-800">₹1,25,000.00</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Available:</span>
                      <span className="font-mono font-bold text-emerald-600">₹3,75,000.00</span>
                    </div>
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-100 flex justify-between items-center">
                  <button
                    type="button"
                    onClick={onCustomerSearchOpen}
                    className="text-blue-600 hover:text-blue-800 font-semibold text-[11px] inline-flex items-center space-x-1 cursor-pointer"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Change Customer (F2)</span>
                  </button>
                  <button
                    type="button"
                    onClick={onAddCustomerOpen}
                    className="text-slate-600 hover:text-blue-600 font-medium text-[11px] cursor-pointer"
                  >
                    + New Customer
                  </button>
                </div>
              </div>
            )}

            {/* Popover 2: GST Registration */}
            {activePopover === "gst" && (
              <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-3 flex flex-col justify-between text-xs md:col-span-2">
                <div>
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2">
                    <h3 className="font-bold text-slate-900 text-xs">GST Registration</h3>
                    <button
                      type="button"
                      onClick={() => setActivePopover(null)}
                      className="text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {customerGstRegistrations.length > 0 && (
                    <div className="mb-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Select Registered GSTIN</label>
                      <select
                        aria-label="GST Registration"
                        data-testid="dist-gst-registration-select"
                        value={docState.billedPartyGstinId || ""}
                        onChange={(e) => {
                          const sel = customerGstRegistrations.find((r: any) => r.id === e.target.value);
                          onChange({
                            billedPartyGstinId: sel?.id || null,
                            customerGstin: sel?.gstin || docState.customerGstin,
                            placeOfSupplyCode: !docState.deliveryLocationId && sel?.state_code ? sel.state_code : docState.placeOfSupplyCode,
                          });
                        }}
                        className="mt-1 w-full text-xs font-medium border border-slate-300 rounded px-2 py-1.5 bg-slate-50"
                      >
                        <option value="">-- Select Registered GSTIN --</option>
                        {customerGstRegistrations.map((r: any) => (
                          <option key={r.id} value={r.id}>
                            {r.gstin} ({r.state_name || r.state_code || "State"}) {r.is_primary ? "★ Primary" : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Active GSTIN:</span>
                      <span className="font-mono font-bold text-slate-900">
                        {docState.customerGstin || "Unregistered"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">State:</span>
                      <span className="font-semibold text-slate-800">
                        {docState.customerGstin ? `Code ${docState.customerGstin.slice(0, 2)}` : "-"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Regime:</span>
                      <span className="text-slate-700 font-medium">Regular Taxpayer</span>
                    </div>
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-100">
                  <span className="text-[10px] text-slate-400">
                    Compliant with GST e-Invoice &amp; NIC E-Way Bill specifications.
                  </span>
                </div>
              </div>
            )}

            {/* Popover 3: Billing Location */}
            {activePopover === "billing" && (
              <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-3 flex flex-col justify-between text-xs md:col-span-2">
                <div>
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2">
                    <h3 className="font-bold text-slate-900 text-xs">Billing Location</h3>
                    <button
                      type="button"
                      onClick={() => setActivePopover(null)}
                      className="text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {customerBillingLocations.length > 0 && (
                    <div className="mb-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Select Registered Billing Site</label>
                      <select
                        aria-label="Billing Location"
                        data-testid="dist-billing-location-select"
                        value={docState.billingLocationId || ""}
                        onChange={(e) => {
                          const sel = customerBillingLocations.find((b: any) => b.id === e.target.value);
                          onChange({
                            billingLocationId: sel?.id || null,
                            billingStoreCode: sel?.billing_store_code || sel?.store_code || null,
                            billingAddress: sel ? [sel.address_line1, sel.city, sel.state].filter(Boolean).join(", ") : docState.customerAddress,
                          });
                        }}
                        className="mt-1 w-full text-xs font-medium border border-slate-300 rounded px-2 py-1.5 bg-slate-50"
                      >
                        <option value="">-- Select Billing Location --</option>
                        {customerBillingLocations.map((b: any) => (
                          <option key={b.id} value={b.id}>
                            [{b.billing_store_code || b.store_code || "STORE"}] {b.name || b.location_name || "Location"} — {b.city || ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Code:</span>
                      <span className="font-mono font-bold text-slate-900">{docState.billingStoreCode || "BILL-A"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Office:</span>
                      <span className="font-semibold text-slate-800">Corporate HQ Billing Desk</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Address:</span>
                      <p className="text-slate-700 text-[10px] leading-relaxed mt-0.5">
                        {docState.billingAddress || docState.customerAddress || "Unit No. 101, Corporate Tower BKC, Mumbai - 400051"}
                      </p>
                    </div>
                    <div className="pt-2 border-t border-slate-100">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">PO / Buyer Reference</label>
                      <input
                        type="text"
                        aria-label="PO Reference"
                        data-testid="dist-po-reference-input"
                        value={docState.poReference || ""}
                        placeholder="Enter PO / Order Reference"
                        onChange={(e) => onChange({ poReference: e.target.value })}
                        className="mt-1 w-full text-xs font-medium border border-slate-300 rounded px-2 py-1"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Popover 4: Delivery Location */}
            {activePopover === "delivery" && (
              <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-3 flex flex-col justify-between text-xs md:col-span-2">
                <div>
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2">
                    <h3 className="font-bold text-slate-900 text-xs">Delivery Location</h3>
                    <button
                      type="button"
                      onClick={() => setActivePopover(null)}
                      className="text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {customerDeliveryLocations.length > 0 && (
                    <div className="mb-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Select Registered Delivery Store</label>
                      <select
                        aria-label="Delivery Location"
                        data-testid="dist-delivery-location-select"
                        value={docState.deliveryLocationId || ""}
                        onChange={(e) => {
                          const sel = customerDeliveryLocations.find((l: any) => l.id === e.target.value);
                          const snap = sel ? {
                            id: sel.id,
                            store_code: sel.store_code,
                            location_name: sel.location_name,
                            address_line1: sel.address_line1,
                            address_line2: sel.address_line2,
                            city: sel.city,
                            state_code: sel.state_code,
                            state_name: sel.state_name || sel.state,
                            pin_code: sel.pin_code || sel.pincode,
                            delivery_gstin: sel.delivery_gstin || sel.gstin,
                            contact_person: sel.contact_person,
                            contact_phone: sel.contact_phone || sel.phone,
                          } : null;
                          onChange({
                            deliveryLocationId: sel?.id || null,
                            deliveryStoreCode: sel?.store_code || null,
                            deliveryGstin: sel?.delivery_gstin || sel?.gstin || null,
                            deliveryLocationSnapshot: snap,
                            shippingAddress: sel ? [sel.address_line1, sel.city, sel.state_name || sel.state].filter(Boolean).join(", ") : docState.shippingAddress,
                            placeOfSupplyCode: sel?.state_code || docState.placeOfSupplyCode,
                          });
                        }}
                        className="mt-1 w-full text-xs font-medium border border-slate-300 rounded px-2 py-1.5 bg-slate-50"
                      >
                        <option value="">-- Select Delivery Location --</option>
                        {customerDeliveryLocations.map((l: any) => (
                          <option key={l.id} value={l.id}>
                            [{l.store_code}] {l.location_name} — {l.city}, {l.state_name || l.state} ({l.delivery_gstin || l.gstin || "No GSTIN"})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Store Code:</span>
                      <span className="font-mono font-bold text-slate-900">{docState.deliveryStoreCode || "8361"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Store Name:</span>
                      <span className="font-semibold text-slate-800">
                        {docState.deliveryLocationSnapshot?.location_name || "RRL Footprint Store"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Delivery Address:</span>
                      <p className="text-slate-700 text-[10px] leading-relaxed mt-0.5">
                        {docState.shippingAddress || "GS Road, Guwahati, Assam - 781001"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Popover 5: Credit Details */}
            {activePopover === "credit" && (
              <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-3 flex flex-col justify-between text-xs md:col-span-2">
                <div>
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2">
                    <h3 className="font-bold text-slate-900 text-xs">Credit &amp; Payment Terms</h3>
                    <button
                      type="button"
                      onClick={() => setActivePopover(null)}
                      className="text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Terms:</span>
                      <span className="font-bold text-slate-900">Net 60 Days</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Credit Days:</span>
                      <span className="font-mono font-bold text-slate-800">60</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Payment Mode:</span>
                      <span className="font-semibold text-slate-800">On Account Ledger</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Hidden input anchor for F2 Universal Lookup Architecture v2 */}
      <input
        id="dist-customer-search"
        data-f2-entity="customer"
        type="hidden"
        value={docState.customerCode}
        onChange={() => {}}
      />
    </div>
  );
};
