/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.0
 * Created      : 2026-09-27
 * Modified     : 2026-09-27
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Isolated Draggable Customer Master Modal (Phase 5)
 */

import React, { useState, useEffect, useRef } from "react";
import {
  Users,
  Search,
  Plus,
  Minus,
  Square,
  X,
  Check,
  ChevronLeft,
  ChevronRight,
  Maximize2,
} from "lucide-react";
import { apiFetchV1 } from "../../lib/apiFetchV1.ts";
import { broadcastBillingDock } from "./billingDockProtocol";

export interface BillingCustomer {
  id: string;
  code: string;
  name: string;
  phone?: string;
  email?: string;
  gst_number?: string;
  credit_limit: number;
  balance: number;
  available_credit: number;
  status: string;
  address?: string;
}

interface CustomerMasterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCustomer: (customer: BillingCustomer) => void;
  selectedCustomerId?: string;
  isStandaloneWindow?: boolean;
}

export const CustomerMasterModal: React.FC<CustomerMasterModalProps> = ({
  isOpen,
  onClose,
  onSelectCustomer,
  selectedCustomerId,
  isStandaloneWindow = false,
}) => {
  const [activeTab, setActiveTab] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [customers, setCustomers] = useState<BillingCustomer[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRow, setSelectedRow] = useState<string | null>(selectedCustomerId || null);

  // Position state for dragging
  const [pos, setPos] = useState({ x: 120, y: 180 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!isOpen) return;
    fetchCustomers();
  }, [isOpen, activeTab, searchTerm]);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const tabParam = activeTab === "ALL" ? "All" : activeTab === "ACTIVE" ? "Active" : "Inactive";
      const queryParam = searchTerm ? `&q=${encodeURIComponent(searchTerm)}` : "";
      const res = await apiFetchV1<any>(`/billing/customers?status_tab=${tabParam}${queryParam}`);
      if (res && res.items) {
        setCustomers(res.items);
        if (!selectedRow && res.items.length > 0) {
          setSelectedRow(res.items[0].id);
        }
      }
    } catch {
      // Fallback showcase customers if offline/network error
      setCustomers([
        {
          id: "cust-001",
          code: "CUST-001",
          name: "ABC Footwear",
          phone: "9876543210",
          credit_limit: 200000,
          balance: 64800,
          available_credit: 135200,
          status: "Active",
          address: "Shop No. 10, Market Road, Mumbai - 400001",
          gst_number: "27ABCDE1234F1Z5",
        },
        {
          id: "cust-002",
          code: "CUST-002",
          name: "Mumbai Traders",
          phone: "9123456780",
          credit_limit: 500000,
          balance: 120450,
          available_credit: 379550,
          status: "Active",
          address: "Gala 4, APMC Market, Vashi, Navi Mumbai - 400703",
          gst_number: "27AAACM1234A1Z1",
        },
        {
          id: "cust-003",
          code: "CUST-003",
          name: "Style Zone",
          phone: "9988776655",
          credit_limit: 100000,
          balance: 12300,
          available_credit: 87700,
          status: "Active",
          address: "Shop 12, Phoenix Palladium, Lower Parel, Mumbai",
          gst_number: "27BBBPS5678B1Z2",
        },
        {
          id: "cust-004",
          code: "CUST-004",
          name: "Walkers Retail",
          phone: "9822334455",
          credit_limit: 300000,
          balance: 0,
          available_credit: 300000,
          status: "Active",
          address: "22 Linking Road, Bandra West, Mumbai",
          gst_number: "27CCCWR9012C1Z3",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pos.x, y: e.clientY - pos.y });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      setPos({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    };
    const handleMouseUp = () => setIsDragging(false);

    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, dragStart]);

  const handleSelectCustomer = (c: BillingCustomer) => {
    onSelectCustomer(c);
    broadcastBillingDock({
      type: "CUSTOMER_SELECTED",
      customer: {
        id: c.id,
        code: c.code,
        name: c.name,
        phone: c.phone,
        email: c.email,
        address: c.address,
        gst_number: c.gst_number,
        credit_limit: c.credit_limit,
        balance: c.balance,
        available_credit: c.available_credit,
        status: c.status,
      },
    });
    onClose();
  };

  const handleOpenExternalWindow = () => {
    try {
      const popout = window.open(
        `${window.location.origin}/?tab=credit-billing&popout=customer-master`,
        "smriti_customer_master_dock",
        "width=720,height=650,menubar=no,toolbar=no,location=no,status=no"
      );
      if (popout) {
        onClose();
      }
    } catch (err) {
      console.warn("Could not open external customer window:", err);
    }
  };

  if (!isOpen && !isStandaloneWindow) return null;

  const currentSelected = customers.find((c) => c.id === selectedRow) || customers[0];

  const fmtCurrency = (n: number) => "₹" + Math.abs(n).toLocaleString("en-IN");

  return (
    <div
      style={
        isStandaloneWindow
          ? { width: "100%", height: "100%" }
          : { left: `${pos.x}px`, top: `${pos.y}px` }
      }
      className={`${
        isStandaloneWindow
          ? "w-full h-full bg-white"
          : "fixed z-50 w-[530px] bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col font-sans transition-shadow select-none animate-in fade-in zoom-in-95 duration-150"
      }`}
    >
      {/* ── Title Bar (Draggable) ── */}
      <div
        onMouseDown={handleMouseDown}
        className="flex items-center justify-between px-3.5 py-2.5 bg-slate-50 border-b border-slate-200 cursor-move"
      >
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center">
            <Users size={12} />
          </div>
          <span className="font-semibold text-xs text-slate-800 tracking-tight">Customer Master</span>
        </div>
        <div className="flex items-center gap-1 text-slate-400">
          {!isStandaloneWindow && (
            <button
              type="button"
              onClick={handleOpenExternalWindow}
              title="Pop out into isolated browser window"
              className="p-1 hover:text-slate-600 rounded hover:bg-slate-200/50"
            >
              <Maximize2 size={12} />
            </button>
          )}
          <button type="button" className="p-1 hover:text-slate-600 rounded hover:bg-slate-200/50">
            <Minus size={13} />
          </button>
          <button type="button" className="p-1 hover:text-slate-600 rounded hover:bg-slate-200/50">
            <Square size={11} />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:text-red-600 rounded hover:bg-red-50 text-slate-400"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* ── Search & Filter Controls ── */}
      <div className="p-3 bg-white border-b border-slate-100 flex flex-col gap-2.5">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search Customer (F2) ..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-blue-500 focus:bg-white text-slate-800"
            />
          </div>
          <button
            type="button"
            className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-md shadow-xs transition"
          >
            <Plus size={13} />
            <span>New</span>
          </button>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 text-[11px]">
          <button
            type="button"
            onClick={() => setActiveTab("ALL")}
            className={`px-3 py-0.5 rounded-full font-medium transition ${
              activeTab === "ALL"
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("ACTIVE")}
            className={`px-3 py-0.5 rounded-full font-medium transition ${
              activeTab === "ACTIVE"
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Active
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("INACTIVE")}
            className={`px-3 py-0.5 rounded-full font-medium transition ${
              activeTab === "INACTIVE"
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Inactive
          </button>
        </div>
      </div>

      {/* ── Customer Table ── */}
      <div className="max-h-[260px] overflow-y-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium text-[11px]">
              <th className="py-2 px-3 font-semibold">Code</th>
              <th className="py-2 px-3 font-semibold">Customer Name</th>
              <th className="py-2 px-3 font-semibold">Phone</th>
              <th className="py-2 px-3 font-semibold text-right">Credit Limit</th>
              <th className="py-2 px-3 font-semibold text-right">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {customers.map((c) => {
              const isSelected = selectedRow === c.id;
              return (
                <tr
                  key={c.id}
                  onClick={() => setSelectedRow(c.id)}
                  onDoubleClick={() => handleSelectCustomer(c)}
                  className={`cursor-pointer transition-colors ${
                    isSelected ? "bg-blue-50/80 font-medium text-blue-900" : "hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  <td className="py-2 px-3 font-mono text-[11px] text-slate-600">{c.code}</td>
                  <td className="py-2 px-3">{c.name}</td>
                  <td className="py-2 px-3 font-mono text-[11px] text-slate-500">{c.phone || "—"}</td>
                  <td className="py-2 px-3 text-right font-mono text-[11px]">{fmtCurrency(c.credit_limit)}</td>
                  <td className="py-2 px-3 text-right font-mono text-[11px] text-red-600 font-bold">
                    {fmtCurrency(c.balance)}
                  </td>
                </tr>
              );
            })}
            {customers.length === 0 && !loading && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-slate-400 text-xs">
                  No customers found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Footer ── */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-50 border-t border-slate-200 text-xs">
        <span className="text-[11px] text-slate-500">Showing 1 - {customers.length} of {customers.length}</span>
        <button
          type="button"
          disabled={!currentSelected}
          onClick={() => {
            if (currentSelected) {
              handleSelectCustomer(currentSelected);
            }
          }}
          className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-md shadow-xs transition"
        >
          Select
        </button>
      </div>
    </div>
  );
};
