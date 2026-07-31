/**
 * Project      : SMRITI Retail OS
 * Organization : SmritiSys
 * Component    : CustomerMasterTab (Customer CRM & Loyalty Studio — ADR-020 & ADR-015 Standard v7.0)
 * Standard     : ADR-020 (Common Workspace UX Framework) & ADR-015 (Customer CRM Domain Architecture)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Version      : 7.0.0
 * License      : Proprietary Commercial Software
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import React, { useState, useMemo, useEffect } from "react";
import {
  Users, UserCheck, Building2, Plus, Search, X, Phone, Mail, MapPin,
  CheckCircle2, AlertCircle, FileText, ShieldCheck, DollarSign,
  Briefcase, AlertTriangle, Scale, Award, CreditCard, Percent, Truck,
  Tag, Calendar, Clock, MessageSquare, Send, History, Lock, Unlock,
  CheckSquare, FileCheck, PackageCheck, TrendingUp, Trash2, UploadCloud,
  FilePlus, Star, ChevronRight, ChevronDown, ChevronUp, Zap, Settings2,
  RotateCcw, Save, AlertOctagon, Info, Globe, Store, Layers, Sparkles,
  ShoppingBag, Receipt, ArrowUpRight, ArrowDownRight, Compass, Ticket,
  Network, Activity, PieChart, BarChart2, ExternalLink, Image as ImageIcon,
  Sliders, Filter, Check, ShieldAlert
} from "lucide-react";
import { Customer } from "../types.js";
import { WindowManager } from "../sdk/index.js";
import { SPK } from "../kernel/SPK.js";
import { CreateCustomerCommand } from "../kernel/commands/CreateCustomerCommand.js";
import { ICustomerService } from "../kernel/public/ICustomerService.js";

export type CustomerFilterMode = "ALL" | "CORPORATE" | "RETAIL" | "PENDING_APPROVAL";

export interface CustomerExtendedRow extends Customer {
  isTemporary?: boolean;
  approvalStatus?: "PENDING_APPROVAL" | "APPROVED" | "REJECTED";
  loyaltyPoints?: number;
  loyaltyTier?: "Silver" | "Gold" | "Platinum" | "Diamond";
  creditDays?: number;
  photoUrl?: string;
}

interface CustomerMasterTabProps {
  customers?: Customer[];
  onRefreshCustomers?: () => Promise<void>;
  onNotification?: (title: string, message: string, type?: "success" | "error") => void;
  currentUser?: { role: string; name: string } | null;
}

export const CustomerMasterTab: React.FC<CustomerMasterTabProps> = ({
  customers: propsCustomers = [],
  onRefreshCustomers,
  onNotification,
  currentUser,
}) => {
  const [customerList, setCustomerList] = useState<CustomerExtendedRow[]>([
    {
      id: "CUST-1001",
      name: "Apex Retailers Pvt Ltd",
      shortName: "Apex Retail",
      category: "corporate",
      customerGroupId: "CG-Corporate",
      mobile: "9822001122",
      email: "accounts@apexretail.com",
      gstNumber: "27AAACA1234F1Z5",
      outstanding: 180000,
      creditLimit: 500000,
      creditDays: 30,
      status: "Active",
      billingCity: "Mumbai",
      billingState: "Maharashtra",
      isTemporary: false,
      approvalStatus: "APPROVED",
      loyaltyPoints: 4500,
      loyaltyTier: "Platinum",
      photoUrl: "https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=150&auto=format&fit=crop&q=60",
    },
    {
      id: "CUST-1002",
      name: "Rajesh Kumar",
      category: "standard",
      customerGroupId: "CG-Retail",
      mobile: "9876543210",
      email: "rajesh.k@gmail.com",
      outstanding: 0,
      creditLimit: 25000,
      creditDays: 0,
      status: "Active",
      billingCity: "Pune",
      billingState: "Maharashtra",
      isTemporary: false,
      approvalStatus: "APPROVED",
      loyaltyPoints: 1200,
      loyaltyTier: "Gold",
      photoUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=60",
    },
    {
      id: "TEMP-CUST-9901",
      name: "Metro Supermarket Chain (New Branch)",
      category: "corporate",
      customerGroupId: "CG-Corporate",
      mobile: "9988776655",
      email: "billing@metrosuper.com",
      gstNumber: "27BBBCC9988F1Z2",
      outstanding: 45000,
      creditLimit: 300000,
      creditDays: 45,
      status: "Active",
      billingCity: "Thane",
      billingState: "Maharashtra",
      isTemporary: true,
      approvalStatus: "PENDING_APPROVAL",
      loyaltyPoints: 0,
      loyaltyTier: "Silver",
      photoUrl: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=60",
    },
  ]);

  // Sync props customers if provided
  useEffect(() => {
    if (propsCustomers && propsCustomers.length > 0) {
      setCustomerList(
        propsCustomers.map((c) => ({
          ...c,
          isTemporary: false,
          approvalStatus: "APPROVED",
          loyaltyPoints: 1000,
          loyaltyTier: "Gold",
        }))
      );
    }
  }, [propsCustomers]);

  // UI Search & Filter States
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [filterMode, setFilterMode] = useState<CustomerFilterMode>("ALL");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("CUST-1001");
  const [highlightedCustomerId, setHighlightedCustomerId] = useState<string | null>("CUST-1001");

  // Modals & Menu States
  const [showAddMenu, setShowAddMenu] = useState<boolean>(false);
  const [showNewCustomerModal, setShowNewCustomerModal] = useState<boolean>(false);
  const [showTempCustomerModal, setShowTempCustomerModal] = useState<boolean>(false);
  const [showConfigModal, setShowConfigModal] = useState<boolean>(false);

  // New Customer Form State
  const [newCustForm, setNewCustForm] = useState({
    name: "",
    mobile: "",
    email: "",
    gstNumber: "",
    category: "standard",
    customerGroupId: "CG-Retail",
    creditLimit: 50000,
    creditDays: 30,
    billingCity: "Mumbai",
  });

  // Selected Active Customer
  const activeCustomer = useMemo(() => {
    return customerList.find((c) => c.id === selectedCustomerId) || customerList[0];
  }, [customerList, selectedCustomerId]);

  // Filtered Customer List
  const filteredCustomers = useMemo(() => {
    return customerList.filter((c) => {
      const matchSearch =
        !searchTerm ||
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.mobile && c.mobile.includes(searchTerm)) ||
        (c.id && c.id.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (c.gstNumber && c.gstNumber.toLowerCase().includes(searchTerm.toLowerCase()));

      let matchFilter = true;
      if (filterMode === "CORPORATE") {
        matchFilter = c.category === "corporate";
      } else if (filterMode === "RETAIL") {
        matchFilter = c.category === "standard";
      } else if (filterMode === "PENDING_APPROVAL") {
        matchFilter = c.approvalStatus === "PENDING_APPROVAL";
      }

      return matchSearch && matchFilter;
    });
  }, [customerList, searchTerm, filterMode]);

  // Financial Summaries
  const totals = useMemo(() => {
    let totalOutstanding = 0;
    let totalCreditLimit = 0;
    let pendingApprovalCount = 0;

    customerList.forEach((c) => {
      totalOutstanding += c.outstanding || 0;
      totalCreditLimit += c.creditLimit || 0;
      if (c.approvalStatus === "PENDING_APPROVAL") pendingApprovalCount++;
    });

    return {
      totalCount: customerList.length,
      corporateCount: customerList.filter((c) => c.category === "corporate").length,
      retailCount: customerList.filter((c) => c.category === "standard").length,
      pendingApprovalCount,
      totalOutstanding,
      totalCreditLimit,
    };
  }, [customerList]);

  // Approve Temporary Customer
  const handleApproveCustomer = (id: string) => {
    setCustomerList((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          return {
            ...c,
            isTemporary: false,
            approvalStatus: "APPROVED",
            id: c.id.replace("TEMP-", ""),
          };
        }
        return c;
      })
    );
    if (onNotification)
      onNotification("Customer Master Approved", `Promoted temporary customer into Customer Master registry`, "success");
  };

  // Approve All Pending Customers
  const handleApproveAllPending = () => {
    setCustomerList((prev) =>
      prev.map((c) => {
        if (c.isTemporary) {
          return {
            ...c,
            isTemporary: false,
            approvalStatus: "APPROVED",
            id: c.id.replace("TEMP-", ""),
          };
        }
        return c;
      })
    );
    if (onNotification)
      onNotification("All Customers Approved", "Promoted all temporary records into Permanent Customer Masters", "success");
  };

  // Add Temporary Customer (On-the-Fly POS Billing)
  const handleCreateTempCustomer = () => {
    if (!newCustForm.name || !newCustForm.mobile) {
      if (onNotification) onNotification("Validation Error", "Customer Name and Mobile are required", "error");
      return;
    }

    const newTemp: CustomerExtendedRow = {
      id: `TEMP-CUST-${Math.floor(1000 + Math.random() * 9000)}`,
      name: newCustForm.name,
      mobile: newCustForm.mobile,
      email: newCustForm.email,
      gstNumber: newCustForm.gstNumber,
      category: (newCustForm.category as any) || "standard",
      customerGroupId: newCustForm.customerGroupId,
      outstanding: 0,
      creditLimit: newCustForm.creditLimit,
      creditDays: newCustForm.creditDays,
      status: "Active",
      billingCity: newCustForm.billingCity,
      isTemporary: true,
      approvalStatus: "PENDING_APPROVAL",
      loyaltyPoints: 100,
      loyaltyTier: "Silver",
    };

    setCustomerList((prev) => [newTemp, ...prev]);
    setShowTempCustomerModal(false);
    setShowAddMenu(false);
    setSelectedCustomerId(newTemp.id);
    if (onNotification)
      onNotification(
        "Temporary Customer Created",
        `Created temporary customer ${newTemp.name}. Tagged PENDING APPROVAL.`,
        "success"
      );
  };

  // Keyboard Shortcuts (F2 Search)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        setShowNewCustomerModal(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="w-full bg-slate-100 font-sans text-slate-800 p-2.5 sm:p-3 space-y-3">
      {/* ================= SINGLE HORIZONTAL TOOLBAR (55px HERO COMPRESSION) ================= */}
      <div className="bg-white border border-slate-200 rounded-xl px-4 py-2 shadow-xs flex flex-wrap items-center justify-between gap-2">
        {/* Left Title & Overdue Risk Badge */}
        <div className="flex items-center space-x-2">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">CRM /</span>
          <h1 className="text-base font-extrabold text-slate-900 tracking-tight">Customer & Loyalty Studio</h1>
          <span className="px-2 py-0.2 text-[9px] font-extrabold uppercase rounded bg-indigo-100 text-indigo-700 border border-indigo-300">
            {totals.totalCount} CUSTOMERS
          </span>
          {totals.totalOutstanding > 0 && (
            <span className="px-2 py-0.2 text-[9px] font-extrabold uppercase rounded bg-rose-100 text-rose-800 border border-rose-300 flex items-center space-x-1">
              <AlertCircle className="w-2.5 h-2.5 mr-0.5 text-rose-600" />
              <span>₹ {totals.totalOutstanding.toLocaleString("en-IN")} RECEIVABLE</span>
            </span>
          )}
          <span className="flex items-center text-[10px] text-emerald-600 font-bold ml-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1 animate-pulse"></span>
            Online
          </span>
        </div>

        {/* Right Actions & SWMF Pop-Out Button */}
        <div className="flex items-center space-x-2 text-xs">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
            <input
              type="text"
              placeholder="Search Customer / Mobile (F2)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-7 pr-2.5 py-1 bg-slate-50 border border-slate-300 rounded-md text-xs font-semibold text-slate-700 focus:outline-none focus:border-blue-500 w-48"
            />
          </div>

          {/* Split Button: + Add Customer Dropdown */}
          <div className="relative inline-block">
            <div className="flex items-center shadow-xs rounded-lg overflow-hidden border border-blue-700">
              <button
                onClick={() => setShowTempCustomerModal(true)}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center cursor-pointer text-[11px]"
                title="Create On-the-Fly Temporary Customer for instant POS billing"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                + Add Customer (Quick)
              </button>
              <button
                onClick={() => setShowAddMenu(!showAddMenu)}
                className="px-1.5 py-1 bg-blue-700 hover:bg-blue-800 text-white flex items-center justify-center cursor-pointer border-l border-blue-500"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Dropdown Options */}
            {showAddMenu && (
              <div className="absolute right-0 top-full mt-1 w-60 bg-white border border-slate-200 rounded-xl shadow-xl z-30 p-1 text-xs space-y-0.5">
                <button
                  onClick={() => {
                    setShowTempCustomerModal(true);
                    setShowAddMenu(false);
                  }}
                  className="w-full text-left px-2.5 py-1.5 hover:bg-amber-50 rounded-lg flex items-center justify-between text-amber-800 font-bold"
                >
                  <span className="flex items-center"><Sparkles className="w-3.5 h-3.5 mr-2 text-amber-600" />+ Temporary Customer (POS)</span>
                  <span className="text-[9px] bg-amber-100 text-amber-800 px-1 rounded font-mono">STAGING</span>
                </button>
                <button
                  onClick={() => {
                    setShowNewCustomerModal(true);
                    setShowAddMenu(false);
                  }}
                  className="w-full text-left px-2.5 py-1.5 hover:bg-slate-100 rounded-lg flex items-center text-slate-700 font-semibold border-t border-slate-100"
                >
                  <UserCheck className="w-3.5 h-3.5 mr-2 text-blue-600" />+ Full Permanent Master
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => WindowManager.openTabStandalone("crm", "SMRITI Customer CRM Studio")}
            className="p-1 bg-slate-50 hover:bg-slate-100 border border-slate-300 text-slate-600 rounded-md cursor-pointer"
            title="Pop-out Standalone Window (SWMF)"
          >
            <ExternalLink className="w-3.5 h-3.5 text-indigo-600" />
          </button>
        </div>
      </div>

      {/* ================= QUICK FILTER PILLS & STAGING APPROVAL BAR ================= */}
      <div className="bg-white border border-slate-200 rounded-xl p-2.5 shadow-xs flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center space-x-1.5">
          <span className="text-[10px] font-bold text-slate-400 uppercase mr-1">Customer Group Filters:</span>
          <button
            onClick={() => setFilterMode("ALL")}
            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] cursor-pointer ${
              filterMode === "ALL" ? "bg-blue-600 text-white shadow-2xs" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            All ({totals.totalCount})
          </button>
          <button
            onClick={() => setFilterMode("CORPORATE")}
            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] cursor-pointer ${
              filterMode === "CORPORATE" ? "bg-blue-600 text-white shadow-2xs" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            Corporate B2B ({totals.corporateCount})
          </button>
          <button
            onClick={() => setFilterMode("RETAIL")}
            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] cursor-pointer ${
              filterMode === "RETAIL" ? "bg-blue-600 text-white shadow-2xs" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            Retail B2C ({totals.retailCount})
          </button>
          <button
            onClick={() => setFilterMode("PENDING_APPROVAL")}
            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] cursor-pointer flex items-center space-x-1 ${
              filterMode === "PENDING_APPROVAL" ? "bg-amber-600 text-white shadow-2xs" : "bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100"
            }`}
          >
            <Sparkles className="w-3 h-3 text-amber-500 mr-0.5" />
            <span>Pending Approval ({totals.pendingApprovalCount})</span>
          </button>
        </div>

        {totals.pendingApprovalCount > 0 && (
          <button
            onClick={handleApproveAllPending}
            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] flex items-center cursor-pointer shadow-xs"
          >
            <ShieldCheck className="w-3.5 h-3.5 mr-1" />
            Approve & Promote Customers ({totals.pendingApprovalCount})
          </button>
        )}
      </div>

      {/* ================= 2-COLUMN MASTER FORM (7/5 SPLIT) ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* ----- LEFT SIDE: CUSTOMER DATA GRID (7 COLUMNS) ----- */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-3 shadow-xs space-y-2">
          <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
            <div className="flex items-center space-x-1.5 text-blue-600 font-bold text-xs uppercase tracking-wide">
              <Users className="w-3.5 h-3.5" />
              <span>Customer Master Directory ({filteredCustomers.length})</span>
            </div>
          </div>

          {/* SUPG Customer Data Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-lg smriti-custom-scroll">
            <table className="w-full text-left text-xs border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-extrabold text-slate-600 uppercase tracking-wider">
                  <th className="py-1.5 px-2 w-8 text-center">#</th>
                  <th className="py-1.5 px-2">Customer ID *</th>
                  <th className="py-1.5 px-2">Name & Mobile *</th>
                  <th className="py-1.5 px-2">Group / Tier</th>
                  <th className="py-1.5 px-2 text-right">Credit Limit (₹)</th>
                  <th className="py-1.5 px-2 text-right font-extrabold">Receivable (₹)</th>
                  <th className="py-1.5 px-2 text-center">Master Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-[11px]">
                {filteredCustomers.map((cust, idx) => {
                  const isSelected = selectedCustomerId === cust.id;
                  const isOverdue = (cust.outstanding || 0) > 0;

                  return (
                    <tr
                      key={cust.id}
                      onClick={() => {
                        setSelectedCustomerId(cust.id);
                        setHighlightedCustomerId(cust.id);
                      }}
                      className={`hover:bg-blue-50/40 transition-colors cursor-pointer ${
                        isSelected ? "bg-blue-50/70 border-l-4 border-blue-600" : ""
                      }`}
                    >
                      <td className="py-1 px-2 text-center font-bold text-slate-400">{idx + 1}</td>
                      <td className="py-1 px-2 font-mono font-bold text-slate-800">{cust.id}</td>
                      <td className="py-1 px-2">
                        <div className="font-semibold text-slate-900">{cust.name}</div>
                        <div className="text-[10px] font-mono text-slate-500">{cust.mobile}</div>
                      </td>
                      <td className="py-1 px-2">
                        <span className="px-1.5 py-0.2 bg-slate-100 text-slate-700 rounded font-bold text-[10px]">
                          {cust.customerGroupId || "Retail"}
                        </span>
                      </td>
                      <td className="py-1 px-2 text-right font-mono text-slate-600">
                        ₹ {(cust.creditLimit || 0).toLocaleString("en-IN")}
                      </td>
                      <td className="py-1 px-2 text-right font-mono font-bold">
                        <span className={isOverdue ? "text-rose-600" : "text-emerald-600"}>
                          ₹ {(cust.outstanding || 0).toLocaleString("en-IN")}
                        </span>
                      </td>
                      <td className="py-1 px-2 text-center">
                        {cust.isTemporary ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleApproveCustomer(cust.id);
                            }}
                            className="px-2 py-0.5 bg-amber-100 text-amber-800 hover:bg-emerald-600 hover:text-white rounded text-[9px] font-mono font-bold border border-amber-300 transition-colors"
                            title="Click to approve customer master"
                          >
                            PENDING (APPROVE)
                          </button>
                        ) : (
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[9px] font-mono font-bold border border-emerald-200">
                            APPROVED MASTER
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ----- RIGHT SIDE: CUSTOMER 360 & CREDIT SUMMARY (5 COLUMNS) ----- */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-3 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
            <div className="flex items-center space-x-1.5 text-blue-600 font-bold text-xs uppercase tracking-wide">
              <UserCheck className="w-3.5 h-3.5" />
              <span>Customer 360° Inspector</span>
            </div>
          </div>

          {/* Credit & Balance Summary Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2 text-xs">
            <div className="flex items-center justify-between text-slate-600">
              <span>Total CRM Customers</span>
              <span className="font-mono font-bold text-slate-800">{totals.totalCount}</span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span>Total Sanctioned Credit Limit</span>
              <span className="font-mono font-bold text-slate-800">
                ₹ {totals.totalCreditLimit.toLocaleString("en-IN")}
              </span>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-slate-200">
              <span className="font-bold text-slate-800">Total Outstanding Receivables</span>
              <span className="font-mono font-black text-rose-600 text-sm">
                ₹ {totals.totalOutstanding.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Selected Customer Inspector */}
          {activeCustomer ? (
            <div className="border border-slate-200 rounded-xl p-3 space-y-2 text-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-1">
                <div>
                  <h4 className="font-extrabold text-slate-900 text-sm">{activeCustomer.name}</h4>
                  <span className="text-[10px] text-slate-400 font-mono">{activeCustomer.id} | {activeCustomer.category?.toUpperCase()}</span>
                </div>
                <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded font-bold text-[10px] border border-indigo-200">
                  {activeCustomer.loyaltyTier || "Gold"} Tier
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-slate-400 uppercase text-[9px] block">Mobile</span>
                  <span className="font-mono font-bold text-slate-800">{activeCustomer.mobile}</span>
                </div>
                <div>
                  <span className="text-slate-400 uppercase text-[9px] block">Email</span>
                  <span className="font-semibold text-slate-700 truncate block">{activeCustomer.email || "N/A"}</span>
                </div>
                <div>
                  <span className="text-slate-400 uppercase text-[9px] block">Credit Limit</span>
                  <span className="font-mono font-bold text-slate-700">₹ {(activeCustomer.creditLimit || 0).toLocaleString("en-IN")}</span>
                </div>
                <div>
                  <span className="text-slate-400 uppercase text-[9px] block">Outstanding Balance</span>
                  <span className="font-mono font-bold text-rose-600">₹ {(activeCustomer.outstanding || 0).toLocaleString("en-IN")}</span>
                </div>
                <div>
                  <span className="text-slate-400 uppercase text-[9px] block">GSTIN</span>
                  <span className="font-mono font-semibold text-slate-700">{activeCustomer.gstNumber || "Unregistered"}</span>
                </div>
                <div>
                  <span className="text-slate-400 uppercase text-[9px] block">Loyalty Points</span>
                  <span className="font-mono font-bold text-emerald-600">{activeCustomer.loyaltyPoints || 0} Pts</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 text-center text-slate-400 text-xs italic">Select a customer row to inspect profile.</div>
          )}
        </div>
      </div>

      {/* ================= BOTTOM COLLAPSIBLE VISUAL CUSTOMER GALLERY ================= */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs space-y-2">
        <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
          <div className="flex items-center space-x-2 text-indigo-600 font-bold text-xs uppercase tracking-wide">
            <ImageIcon className="w-4 h-4" />
            <span>Customer Visual Directory Gallery ({customerList.length})</span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">Bi-directional Interactive Card Highlighting</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
          {customerList.map((cust) => {
            const isSelected = highlightedCustomerId === cust.id;
            return (
              <div
                key={cust.id}
                onClick={() => {
                  setSelectedCustomerId(cust.id);
                  setHighlightedCustomerId(cust.id);
                }}
                className={`p-2 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? "bg-indigo-50 border-indigo-500 ring-2 ring-indigo-400/40 shadow-sm"
                    : "bg-slate-50 border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="space-y-1">
                  <div className="h-20 w-full bg-slate-200 rounded-lg overflow-hidden relative flex items-center justify-center">
                    {cust.photoUrl ? (
                      <img src={cust.photoUrl} alt={cust.name} className="h-full w-full object-cover" />
                    ) : (
                      <Users className="w-8 h-8 text-slate-400" />
                    )}
                    {cust.isTemporary && (
                      <span className="absolute top-1 left-1 bg-amber-600 text-white font-mono font-bold text-[8px] px-1 rounded shadow-xs">
                        STAGING
                      </span>
                    )}
                  </div>
                  <div className="font-bold text-slate-900 text-xs truncate">{cust.name}</div>
                  <div className="text-[10px] text-slate-500 font-mono flex items-center justify-between">
                    <span>{cust.id}</span>
                    <span className="font-bold text-indigo-600">{cust.loyaltyTier || "Gold"}</span>
                  </div>
                </div>

                <div className="pt-1.5 mt-1 border-t border-slate-200/60 flex items-center justify-between text-[10px]">
                  <span className="font-bold text-slate-600 font-mono">{cust.billingCity || "Mumbai"}</span>
                  <span className={`font-bold font-mono ${(cust.outstanding || 0) > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                    ₹ {(cust.outstanding || 0).toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ================= ON-THE-FLY TEMPORARY CUSTOMER MODAL ================= */}
      {showTempCustomerModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm">Create Temporary Customer (POS Billing)</h3>
                  <p className="text-xs text-slate-500">Quick-add customer for fast checkout. Tagged PENDING APPROVAL.</p>
                </div>
              </div>
              <button onClick={() => setShowTempCustomerModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Customer Name *</label>
                <input
                  type="text"
                  required
                  value={newCustForm.name}
                  onChange={(e) => setNewCustForm({ ...newCustForm, name: e.target.value })}
                  placeholder="e.g. Ramesh Patel"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-semibold text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Mobile Number *</label>
                  <input
                    type="text"
                    required
                    value={newCustForm.mobile}
                    onChange={(e) => setNewCustForm({ ...newCustForm, mobile: e.target.value })}
                    placeholder="9876543210"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">GSTIN (Optional)</label>
                  <input
                    type="text"
                    value={newCustForm.gstNumber}
                    onChange={(e) => setNewCustForm({ ...newCustForm, gstNumber: e.target.value })}
                    placeholder="27AAACA1234F1Z5"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono uppercase text-slate-800"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
              <button onClick={() => setShowTempCustomerModal(false)} className="px-4 py-1.5 bg-slate-100 text-slate-700 rounded-xl font-bold">
                Cancel
              </button>
              <button onClick={handleCreateTempCustomer} className="px-5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold flex items-center shadow-md">
                <Check className="w-4 h-4 mr-1" />
                Add Temporary Customer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerMasterTab;
