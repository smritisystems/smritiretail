/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.33.0
 * Created      : 2026-09-19
 * Modified     : 2026-09-19
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Capability    : @SmritiCapability("PURCHASE", "LANDED_COST_DOCK")
 */

import React from "react";
import {
  Truck,
  Plus,
  Scale,
  Trash2,
  FileText,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { InwardCostItem } from "./types/inwardCost.ts";

interface InwardCostDockProps {
  isOpen: boolean;
  onToggle: () => void;
  transporterName: string;
  setTransporterName: (val: string) => void;
  lrNumber: string;
  setLrNumber: (val: string) => void;
  lrDate: string;
  setLrDate: (val: string) => void;
  vehicleNumber: string;
  setVehicleNumber: (val: string) => void;
  costItems: InwardCostItem[];
  onAddCostClick: () => void;
  onRemoveCostItem: (id: string) => void;
  allocationMethod: "VALUE" | "QUANTITY" | "WEIGHT";
  setAllocationMethod: (val: "VALUE" | "QUANTITY" | "WEIGHT") => void;
  onPreviewClick: () => void;
}

export const InwardCostDock: React.FC<InwardCostDockProps> = ({
  isOpen,
  onToggle,
  transporterName,
  setTransporterName,
  lrNumber,
  setLrNumber,
  lrDate,
  setLrDate,
  vehicleNumber,
  setVehicleNumber,
  costItems,
  onAddCostClick,
  onRemoveCostItem,
  allocationMethod,
  setAllocationMethod,
  onPreviewClick,
}) => {
  const totalCost = costItems.reduce((s, c) => s + (c.is_capitalizable ? c.amount : 0), 0);

  return (
    <div className="border border-indigo-200 dark:border-indigo-900/60 rounded-xl bg-gradient-to-br from-indigo-50/40 via-white to-slate-50/50 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/20 overflow-hidden shadow-sm">
      {/* Dock Collapsible Bar */}
      <div
        onClick={onToggle}
        className="px-5 py-3.5 flex items-center justify-between cursor-pointer select-none hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 transition"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-600 text-white shadow-sm">
            <Truck className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-slate-900 dark:text-white">
                Transport, Freight & Landed Cost Dock
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                Optional
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Traceable acquisition costs: freight, cartage, loading, hamali, insurance & customs
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={`px-3 py-1 rounded-full text-xs font-mono font-bold ${
              totalCost > 0
                ? "bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800"
                : "bg-slate-100 dark:bg-slate-800 text-slate-500"
            }`}
          >
            {totalCost > 0
              ? `₹${totalCost.toLocaleString("en-IN", { minimumFractionDigits: 2 })} Added Cost`
              : "₹0.00 Added Cost"}
          </span>
          <button className="text-slate-400 p-1 hover:text-slate-600 dark:hover:text-slate-200">
            {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Dock Expanded Workspace */}
      {isOpen && (
        <div className="p-5 border-t border-indigo-100 dark:border-indigo-900/50 space-y-5 text-xs">
          {/* Top Row: Transport Logistics Metadata */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-white/70 dark:bg-slate-850/70 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800">
            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">
                Transporter / Logistics
              </label>
              <input
                type="text"
                placeholder="e.g. XYZ Logistics"
                value={transporterName}
                onChange={(e) => setTransporterName(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">
                LR / Bilty Number
              </label>
              <input
                type="text"
                placeholder="e.g. LR-88452"
                value={lrNumber}
                onChange={(e) => setLrNumber(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-mono text-slate-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">
                Freight / Dispatch Date
              </label>
              <input
                type="date"
                value={lrDate}
                onChange={(e) => setLrDate(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">
                Vehicle Number
              </label>
              <input
                type="text"
                placeholder="e.g. MH01AB1234"
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-mono text-slate-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Middle Row: Cost Components Master Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  Cost Components ({costItems.length})
                </span>
                <span className="text-slate-500 text-[11px]">
                  Each expense item is independently auditable and traceable.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onAddCostClick}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-sm transition flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>＋ Add Cost</span>
                </button>
                {costItems.length > 0 && (
                  <button
                    type="button"
                    onClick={onPreviewClick}
                    className="px-3 py-1.5 rounded-lg border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950 font-semibold text-xs transition flex items-center gap-1.5"
                  >
                    <Scale className="w-3.5 h-3.5" />
                    <span>Preview Allocation</span>
                  </button>
                )}
              </div>
            </div>

            {costItems.length > 0 ? (
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">Type & Description</th>
                      <th className="py-2.5 px-3">Method</th>
                      <th className="py-2.5 px-3">Transporter / Doc</th>
                      <th className="py-2.5 px-3 text-right">Taxable</th>
                      <th className="py-2.5 px-3 text-right">GST</th>
                      <th className="py-2.5 px-3 text-right">Capitalized (₹)</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                      <th className="py-2.5 px-2 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {costItems.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-3">
                          <span className="font-bold text-slate-800 dark:text-slate-200 block">
                            {c.component_type}
                          </span>
                          <span className="text-[11px] text-slate-500 line-clamp-1">
                            {c.description || "Inward charge"}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {c.allocation_method}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                          {c.document_no || c.transporter_name
                            ? `${c.document_no || ""} ${c.transporter_name ? `• ${c.transporter_name}` : ""}`
                            : "--"}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono">
                          ₹{c.taxable_amount.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-500">
                          {c.tax_rate}% (₹{c.tax_amount.toFixed(2)})
                          <span className="block text-[9px]">
                            {c.itc_eligible ? "✓ ITC Asset" : "Capitalized"}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                          ₹{(c.is_capitalizable ? c.amount : 0).toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                            ● Ready
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => onRemoveCostItem(c.id)}
                            className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded transition"
                            title="Remove cost component"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-6 px-4 border border-dashed border-slate-300 dark:border-slate-800 rounded-xl text-center bg-slate-50/50 dark:bg-slate-850/40">
                <Truck className="w-8 h-8 text-slate-400 mx-auto mb-1.5 opacity-60" />
                <p className="font-semibold text-slate-700 dark:text-slate-300">
                  No Additional Costs Added
                </p>
                <p className="text-slate-500 text-[11px] mt-0.5">
                  Click "＋ Add Cost" to add freight, cartage, hamali, packaging, or customs duty.
                </p>
              </div>
            )}
          </div>

          {/* Bottom Allocation Mode Selector */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="font-bold text-slate-700 dark:text-slate-300">
                Default GRN Allocation Mode:
              </span>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700 dark:text-slate-300">
                  <input
                    type="radio"
                    name="allocMethodDock"
                    checked={allocationMethod === "VALUE"}
                    onChange={() => setAllocationMethod("VALUE")}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>By Value (Proportional to PO line cost)</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700 dark:text-slate-300">
                  <input
                    type="radio"
                    name="allocMethodDock"
                    checked={allocationMethod === "QUANTITY"}
                    onChange={() => setAllocationMethod("QUANTITY")}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>By Quantity (Uniform per piece)</span>
                </label>
              </div>
            </div>

            {totalCost > 0 && (
              <span className="font-mono font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 px-3 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800">
                Total Capitalizable: ₹{totalCost.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
