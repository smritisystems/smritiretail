/**
 * Project      : SMRITI Retail OS v5.0
 * Module       : SMRITI Label Print Ledger Audit Log Tab (Section 5.6 Compliance)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com and AITDL.com. All Rights Reserved.
 * Version      : 5.6.0
 */

import React, { useState } from "react";
import { Printer, ShieldCheck, Download, Search, Filter, History, RotateCcw, CheckCircle2, AlertCircle } from "lucide-react";
import { Product } from "../../types.js";

export interface LedgerEntry {
  print_job_id: string;
  timestamp: string;
  user_name: string;
  source_module: string;
  barcode: string;
  quantity: number;
  template_name: string;
  printer_name: string;
  output_type: "PDF" | "ZPL" | "TSPL" | "EPL" | "Direct (QZ)" | "Browser Print";
  status: "Success" | "Downloaded" | "Failed" | "Cancelled";
  reprint_reason?: string;
}

interface ItemMasterPrintHistoryTabProps {
  product: Product;
}

export const ItemMasterPrintHistoryTab: React.FC<ItemMasterPrintHistoryTabProps> = ({ product }) => {
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [filterModule, setFilterModule] = useState<string>("ALL");

  // Simulated immutable Label Print Ledger records
  const [ledgerEntries] = useState<LedgerEntry[]>([
    {
      print_job_id: "LP-20260730-000001",
      timestamp: "30-Jul-2026 11:42 AM",
      user_name: "Admin",
      source_module: "Purchase",
      barcode: product.barcode || "8904551000002",
      quantity: 20,
      template_name: "50x25mm Thermal",
      printer_name: "Zebra ZD421",
      output_type: "Direct (QZ)",
      status: "Success"
    },
    {
      print_job_id: "LP-20260729-000412",
      timestamp: "29-Jul-2026 04:18 PM",
      user_name: "Manager",
      source_module: "Item Master",
      barcode: product.barcode || "8904551000002",
      quantity: 10,
      template_name: "Shelf Price Tag",
      printer_name: "PDF Stream",
      output_type: "PDF",
      status: "Downloaded",
      reprint_reason: "Damaged Label"
    },
    {
      print_job_id: "LP-20260728-000189",
      timestamp: "28-Jul-2026 09:30 AM",
      user_name: "Admin",
      source_module: "GRN",
      barcode: product.barcode || "8904551000002",
      quantity: 100,
      template_name: "38x25mm Dual",
      printer_name: "TSC TTP-244",
      output_type: "TSPL",
      status: "Success"
    }
  ]);

  const filteredEntries = ledgerEntries.filter((e) => {
    const matchSearch =
      !searchTerm ||
      e.print_job_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.barcode.toLowerCase().includes(searchTerm.toLowerCase());

    const matchModule = filterModule === "ALL" || e.source_module === filterModule;
    return matchSearch && matchModule;
  });

  const totalPrinted = ledgerEntries.reduce((acc, e) => acc + e.quantity, 0);

  return (
    <div className="space-y-4 select-none">
      {/* Header Audit Metric Banner */}
      <div className="p-4 bg-theme-surface-2/60 border border-theme-divider rounded-xl grid grid-cols-1 md:grid-cols-4 gap-4 text-xs font-mono">
        <div>
          <span className="text-theme-muted block">Total Labels Printed</span>
          <strong className="text-lg text-theme-heading font-bold">{totalPrinted} Pcs</strong>
        </div>
        <div>
          <span className="text-theme-muted block">Print Jobs Captured</span>
          <strong className="text-lg text-[#0a6ed1] font-bold">{ledgerEntries.length} Jobs</strong>
        </div>
        <div>
          <span className="text-theme-muted block">Last Printed By</span>
          <strong className="text-sm text-theme-heading font-bold">{ledgerEntries[0]?.user_name || "N/A"}</strong>
        </div>
        <div>
          <span className="text-theme-muted block">Audit Ledger Status</span>
          <span className="inline-flex items-center gap-1 font-bold text-emerald-500">
            <ShieldCheck className="w-4 h-4" /> Immutable Append-Only
          </span>
        </div>
      </div>

      {/* Toolbar Filters */}
      <div className="flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <Search className="w-4 h-4 text-theme-muted" />
          <input
            type="text"
            placeholder="Search Print Job ID, User, or Barcode..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full p-2 bg-theme-surface-2 border border-theme-divider rounded-lg font-mono text-theme-heading"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-theme-muted" />
          <select
            value={filterModule}
            onChange={(e) => setFilterModule(e.target.value)}
            className="p-2 bg-theme-surface-2 border border-theme-divider rounded-lg font-mono text-theme-heading"
          >
            <option value="ALL">All Source Modules</option>
            <option value="Item Master">Item Master</option>
            <option value="Purchase">Purchase</option>
            <option value="GRN">GRN</option>
            <option value="POS">POS</option>
            <option value="Stock Transfer">Stock Transfer</option>
          </select>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="border border-theme-divider rounded-xl overflow-hidden bg-theme-surface-1">
        <table className="w-full text-left text-xs">
          <thead className="bg-theme-surface-2 text-theme-muted font-bold uppercase tracking-wider text-[10px] border-b border-theme-divider">
            <tr>
              <th className="p-3">Print Job ID</th>
              <th className="p-3">Date & Time</th>
              <th className="p-3">User</th>
              <th className="p-3">Source</th>
              <th className="p-3">Quantity</th>
              <th className="p-3">Template</th>
              <th className="p-3">Printer / Output</th>
              <th className="p-3">Reprint Reason</th>
              <th className="p-3 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-theme-divider font-mono text-[11px]">
            {filteredEntries.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-6 text-center text-theme-muted">
                  No print ledger entries match criteria.
                </td>
              </tr>
            ) : (
              filteredEntries.map((e) => (
                <tr key={e.print_job_id} className="hover:bg-theme-surface-hover transition-colors">
                  <td className="p-3 font-bold text-[#0a6ed1]">{e.print_job_id}</td>
                  <td className="p-3 text-theme-muted">{e.timestamp}</td>
                  <td className="p-3 text-theme-heading font-sans font-bold">{e.user_name}</td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded text-[10px] bg-theme-surface-2 border border-theme-divider text-theme-heading font-sans">
                      {e.source_module}
                    </span>
                  </td>
                  <td className="p-3 font-bold text-emerald-500">{e.quantity} Pcs</td>
                  <td className="p-3 text-theme-muted">{e.template_name}</td>
                  <td className="p-3 text-theme-heading">
                    {e.printer_name} ({e.output_type})
                  </td>
                  <td className="p-3 text-amber-400 font-sans italic">
                    {e.reprint_reason || "—"}
                  </td>
                  <td className="p-3 text-right">
                    <span className="inline-flex items-center gap-1 font-bold text-emerald-500">
                      <CheckCircle2 className="w-3.5 h-3.5" /> {e.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
